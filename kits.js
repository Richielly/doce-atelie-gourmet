/* Kits: a product assembled from other products and pantry supplies. Pure domain code shared by UI/tests.
   Two flows, neither changes normal production:
   - assemble now from the sale balance (capacity() says how many fit);
   - plan N kits: what is produced for the plan stays in plan.reserved, outside product.stock,
     so customers cannot buy it. Only units beyond the plan's need enter the sale balance.
   Selling, costs at sale and margins keep working because the kit is a regular product. */
(function(root){
 'use strict';
 const P=root?.DocePantry||require('./pantry-costs.js');
 const {round}=P;
 const whole=(value,label)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>1000000)throw Error(label+' deve ser um número inteiro de 1 a 1.000.000.');return n;};
 const lookup=(db,id)=>{const p=(db.products||[]).find(p=>p.id===id);if(!p)throw Error('Produto do kit não encontrado.');return p;};
 const kitOf=(db,id)=>{const k=(db.kits||[]).find(k=>k.id===id);if(!k)throw Error('Kit não encontrado.');return k;};
 const openPlan=plan=>{if(!plan||plan.status!=='open')throw Error('Este preparo não está aberto.');return plan;};

 function validate(db,kit){
  const items=kit.items||[],supplies=kit.supplies||[];
  if(!items.length)throw Error('O kit precisa de pelo menos um produto.');
  for(const line of items){
   const p=lookup(db,line.product);if(p.isKit||p.id===kit.product)throw Error('Um kit não pode conter outro kit.');
   if(!Number.isSafeInteger(line.qty)||line.qty<1)throw Error('Use quantidades inteiras de produtos.');
  }
  for(const line of supplies){
   const item=(db.pantry||[]).find(i=>i.id===line.id);if(!item)throw Error('Insumo do kit não encontrado.');
   if(item.category!=='packaging')throw Error(item.name+' não é embalagem. A ficha do kit usa só produtos e embalagens; ingredientes ficam na ficha técnica de cada doce.');
   if(!Number.isFinite(line.qty)||line.qty<=0)throw Error('Quantidade de insumo inválida.');
  }
  if(!Number.isFinite(Number(kit.extraCost||0))||Number(kit.extraCost||0)<0)throw Error('Outros custos inválidos.');
  return kit;
 }
 function economics(db,kit,price){
  const cost=P.kitCost(db,kit),loose=round((kit.items||[]).reduce((s,l)=>s+Number(lookup(db,l.product).price||0)*l.qty,0),2),value=Number(price)||0,profit=round(value-cost.total,2);
  return {...cost,price:value,profit,margin:value>0?profit/value:0,loose,saving:loose>0&&value<loose?(loose-value)/loose:0};
 }
 function supplyNeeds(db,kit,kits){
  return (kit.supplies||[]).map(line=>{const item=(db.pantry||[]).find(i=>i.id===line.id);if(!item)throw Error('Insumo do kit não encontrado.');const qty=round(line.qty*kits,3);return {item,qty,short:round(Math.max(0,qty-P.available(db,item)),3)};});
 }
 const fits=(available,per)=>Math.floor(Math.round(available*1000)/Math.round(per*1000));

 // Flow 1: how many kits the sale balance and the pantry allow right now. Changes nothing.
 function capacity(db,kit){
  P.migrate(db);
  const lines=[...(kit.items||[]).map(l=>{const p=lookup(db,l.product),available=Math.max(0,Number(p.stock)||0);return {name:p.name,unit:'un',per:l.qty,available,max:fits(available,l.qty)};}),
   ...(kit.supplies||[]).map(l=>{const i=(db.pantry||[]).find(i=>i.id===l.id);if(!i)throw Error('Insumo do kit não encontrado.');const available=P.available(db,i);return {name:i.name,unit:i.unit,per:l.qty,available,max:fits(available,l.qty)};})];
  const count=lines.length?Math.min(...lines.map(l=>l.max)):0;
  return {count,lines,limiting:lines.filter(l=>l.max===count),missingNext:lines.map(l=>({...l,missing:round(Math.max(0,l.per*(count+1)-l.available),3)})).filter(l=>l.missing>0)};
 }
 const reservedOf=(plan,id)=>plan.reserved?.[id]||{qty:0,value:0};
 function addReserve(plan,id,qty,value){const old=reservedOf(plan,id);plan.reserved={...plan.reserved,[id]:{qty:old.qty+qty,value:round(old.value+value)}};}
 function assembledLine(db,kit,line,kits,plan){
  const p=lookup(db,line.product),qty=line.qty*kits;
  if(plan){const held=reservedOf(plan,p.id);if(held.qty<qty)throw Error('Falta reservar '+p.name+' para esta montagem.');return {p,qty,unitCost:held.value/held.qty};}
  if((Number(p.stock)||0)<qty)throw Error('Saldo insuficiente de '+p.name+'.');
  return {p,qty,unitCost:P.componentCost(p)};
 }

 // Flow 2: what is still missing to have plan.target kits.
 function createPlan(db,kit,target){
  P.migrate(db);validate(db,kit);
  const plan={id:Date.now()+Math.floor(Math.random()*1000),kit:kit.id,target:whole(target,'A quantidade de kits'),assembled:0,reserved:{},status:'open',at:Date.now()};
  db.kitPlans.push(plan);return plan;
 }
 function planView(db,plan){
  P.migrate(db);
  const kit=kitOf(db,plan.kit),remaining=Math.max(0,plan.target-plan.assembled),buying=new Map(),errors=[];
  const add=(item,qty)=>{const row=buying.get(item.id)||{id:item.id,name:item.name,unit:item.unit,required:0,available:P.available(db,item),unitCost:P.unitCost(item)};row.required=round(row.required+qty,3);buying.set(item.id,row);};
  const components=(kit.items||[]).map(line=>{
   const p=lookup(db,line.product),need=line.qty*remaining,reserved=reservedOf(plan,p.id).qty,toMake=Math.max(0,need-reserved),recipe=(db.recipes||[]).find(r=>r.product===p.id),yieldQty=recipe?Math.max(1,Number(recipe.yieldQty)||1):0,batches=recipe?Math.ceil(toMake/yieldQty):0;
   if(batches)try{for(const x of P.requirements(db,recipe,batches))add(x.item,x.qty);}catch(e){errors.push(p.name+': '+e.message);}
   return {product:p.id,name:p.name,per:line.qty,need,reserved,toMake,free:Math.max(0,Number(p.stock)||0),recipeId:recipe?.id||null,batches,units:batches*yieldQty,surplus:batches*yieldQty-toMake};
  });
  for(const x of supplyNeeds(db,kit,remaining))add(x.item,x.qty);
  const purchases=[...buying.values()].map(x=>({...x,missing:round(Math.max(0,x.required-x.available),3)}));
  const byReserve=(kit.items||[]).length?Math.min(...(kit.items||[]).map(l=>Math.floor(reservedOf(plan,l.product).qty/l.qty))):0;
  const bySupply=(kit.supplies||[]).length?Math.min(...(kit.supplies||[]).map(l=>{const i=(db.pantry||[]).find(i=>i.id===l.id);return i?fits(P.available(db,i),l.qty):0;})):Infinity;
  return {kit,remaining,components,purchases,missing:purchases.filter(x=>x.missing>0),missingCost:round(purchases.reduce((s,x)=>s+x.missing*x.unitCost,0),2),errors,ready:Math.min(remaining,byReserve,bySupply),readyByReserve:Math.min(remaining,byReserve)};
 }
 // Production for a plan: units up to the need stay reserved; only the rest of the batch goes on sale.
 function produceForPlan(db,plan,productId,batches){
  openPlan(plan);
  const line=planView(db,plan).components.find(c=>c.product===productId);if(!line)throw Error('Este produto não faz parte do kit.');
  if(!line.toMake)throw Error('A reserva deste produto já está completa.');
  const recipe=(db.recipes||[]).find(r=>r.product===productId);if(!recipe)throw Error('Cadastre a ficha técnica de '+line.name+' para produzir por aqui.');
  const run=P.brew(db,recipe,batches),p=lookup(db,productId),reservedUnits=Math.min(run.units,line.toMake),extra=run.units-reservedUnits,value=run.cost*reservedUnits/run.units;
  addReserve(plan,productId,reservedUnits,value);
  if(extra)P.stockIn(p,extra,run.cost-value);
  const record={at:run.at,product:productId,batches:run.batches,units:run.units,cost:run.cost,unitCost:round(run.cost/run.units),ingredients:run.lines,extraCost:run.extraCost,kitPlan:plan.id,reservedUnits};
  db.production.push(record);P.reconcile(db);return record;
 }
 // The owner may also set aside what is already on sale; from then on customers cannot buy it.
 function reserveFromStock(db,plan,productId,qty){
  openPlan(plan);
  const line=planView(db,plan).components.find(c=>c.product===productId);if(!line)throw Error('Este produto não faz parte do kit.');
  qty=whole(qty,'A quantidade');if(qty>line.toMake)throw Error('A reserva precisa de só '+line.toMake+' un de '+line.name+'.');
  const p=lookup(db,productId);if((Number(p.stock)||0)<qty)throw Error('Saldo insuficiente de '+p.name+'.');
  addReserve(plan,productId,qty,P.componentCost(p)*qty);p.stock-=qty;P.reconcile(db);return plan;
 }
 function release(db,plan){
  for(const[id,held]of Object.entries(plan.reserved||{})){if(held.qty>0){const p=lookup(db,Number(id));P.stockIn(p,held.qty,held.value);}}
  plan.reserved={};
 }
 // Ends the plan and returns whatever is reserved to the sale balance. Nothing is lost.
 function cancelPlan(db,plan){openPlan(plan);release(db,plan);plan.status='cancelled';plan.closedAt=Date.now();P.reconcile(db);return plan;}

 // Both flows end here. With a plan the products come from its reserve, otherwise from the sale balance.
 function assemble(db,kit,kits,plan=null){
  P.migrate(db);validate(db,kit);kits=whole(kits,'A quantidade de kits');
  const product=lookup(db,kit.product);
  if(plan){openPlan(plan);if(plan.kit!==kit.id)throw Error('Este preparo é de outro kit.');if(kits>plan.target-plan.assembled)throw Error('O preparo precisa de só '+(plan.target-plan.assembled)+' kit(s).');}
  const lines=kit.items.map(l=>assembledLine(db,kit,l,kits,plan)),needs=supplyNeeds(db,kit,kits);
  const short=needs.find(x=>x.short>.0001);if(short)throw Error('Falta '+short.short+' '+short.item.unit+' de '+short.item.name+'.');
  const at=Date.now(),supplies=needs.map(x=>({id:x.item.id,name:x.item.name,unit:x.item.unit,qty:x.qty,unitCost:P.unitCost(x.item),total:round(P.unitCost(x.item)*x.qty)}));
  const components=lines.map(x=>({product:x.p.id,name:x.p.name,qty:x.qty,unitCost:round(x.unitCost),total:round(x.unitCost*x.qty)}));
  const extraCost=round(Number(kit.extraCost||0)*kits),cost=round(components.reduce((s,c)=>s+c.total,0)+supplies.reduce((s,c)=>s+c.total,0)+extraCost);
  P.consumeItems(db,needs,at,'Consumo na montagem');
  for(const x of lines){
   if(plan){const held=reservedOf(plan,x.p.id),left=held.qty-x.qty;plan.reserved={...plan.reserved,[x.p.id]:{qty:left,value:left?round(held.value-x.unitCost*x.qty):0}};}
   else x.p.stock-=x.qty;
  }
  P.stockIn(product,kits,cost);
  const record={at,kind:'assembly',kit:kit.id,product:product.id,qty:kits,cost,unitCost:round(cost/kits),plan:plan?.id||null,components,supplies,extraCost};
  db.kitAssemblies.push(record);
  if(plan){plan.assembled+=kits;if(plan.assembled>=plan.target){release(db,plan);plan.status='done';plan.closedAt=at;}}
  P.reconcile(db);return record;
 }
 // Products go back to the sale balance at the cost they entered the kit. Used supplies are a loss.
 function disassemble(db,kit,kits){
  P.migrate(db);kits=whole(kits,'A quantidade de kits');
  const product=lookup(db,kit.product);if((Number(product.stock)||0)<kits)throw Error('Só há '+(Number(product.stock)||0)+' kit(s) montado(s).');
  const last=db.kitAssemblies.filter(a=>a.kit===kit.id&&a.kind==='assembly').at(-1),at=Date.now();
  const components=kit.items.map(l=>{const p=lookup(db,l.product),per=last?.components.find(c=>c.product===p.id)?.unitCost;const unitCost=Number.isFinite(per)?per:P.componentCost(p),qty=l.qty*kits;P.stockIn(p,qty,unitCost*qty);return {product:p.id,name:p.name,qty,unitCost,total:round(unitCost*qty)};});
  product.stock-=kits;
  const record={at,kind:'disassembly',kit:kit.id,product:product.id,qty:kits,components};
  db.kitAssemblies.push(record);P.reconcile(db);return record;
 }
 const api={validate,economics,capacity,createPlan,planView,produceForPlan,reserveFromStock,cancelPlan,assemble,disassemble};
 if(typeof module!=='undefined')module.exports=api;if(root)root.DoceKits=api;
})(typeof window!=='undefined'?window:null);
