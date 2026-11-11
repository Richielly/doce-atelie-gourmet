/* Inventory valuation and purchasing analysis. Pure domain code shared by UI/tests. */
(function(root){
 'use strict';
 const round=(v,d=6)=>Number(Number(v).toFixed(d));
 const number=(v,label,min=0)=>{v=Number(v);if(!Number.isFinite(v)||v<min)throw Error(label+' inválido.');return v;};
 const text=v=>String(v||'').trim();
 const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Data inválida.');return value;}
 const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
 function barcode(value){const v=text(value).replace(/\s/g,'');if(!/^[0-9A-Za-z._\-/]{4,80}$/.test(v))throw Error('Código de barras inválido.');return v;}
 function migrate(db){
  for(const k of ['pantry','pantryLots','pantryMovements','pantryEntries','recipes','production','kits','kitPlans','kitAssemblies'])if(!Array.isArray(db[k]))db[k]=[];
  for(const i of db.pantry){i.qty=Number(i.qty)||0;i.packQty=Number(i.packQty)>0?Number(i.packQty):1;i.stockValue=i.stockValue===undefined?round(i.qty*(Number(i.price)||0)/i.packQty):Number(i.stockValue)||0;i.lastUnitCost=i.lastUnitCost===undefined?(Number(i.price)||0)/i.packQty:Number(i.lastUnitCost)||0;if(i.trackExpiry===undefined)i.trackExpiry=false;if(!Array.isArray(i.barcodes))i.barcodes=i.barcode?[{code:String(i.barcode),packQty:i.packQty}]:[];if(i.active===undefined)i.active=true;}
  return db;
 }
 function unitCost(i){return i.qty>0?Number(i.stockValue||0)/i.qty:Number(i.lastUnitCost||0);}
 function available(db,i,today=day()){
  if(!i.trackExpiry)return i.qty;
  const lots=db.pantryLots.filter(l=>l.ingredientId===i.id&&l.qty>0),accounted=lots.reduce((s,l)=>s+l.qty,0);
  return round(Math.min(i.qty,Math.max(0,i.qty-accounted)+lots.filter(l=>!l.expiry||l.expiry>=today).reduce((s,l)=>s+l.qty,0)),3);
 }
 function requirements(db,recipe,batches=1){
  const grouped=new Map();
  for(const line of recipe.ingredients||[]){const i=db.pantry.find(i=>i.id===line.id);if(!i)throw Error('Ingrediente da receita não encontrado. Revise a ficha técnica.');const qty=number(line.qty,'Porção',.001)*batches;grouped.set(i.id,{item:i,qty:round((grouped.get(i.id)?.qty||0)+qty,3)});}
  if(!grouped.size)throw Error('A ficha técnica precisa de ingredientes.');
  return [...grouped.values()].map(x=>({...x,short:round(Math.max(0,x.qty-available(db,x.item)),3)}));
 }
 function recipeCost(db,recipe){return round(requirements(db,recipe).reduce((s,x)=>s+unitCost(x.item)*x.qty,0)+number(recipe.extraCost||0,'Custo adicional'));}
 // Sale-balance cost of a product used inside a kit.
 function componentCost(p){return Number(p.stock)>0&&Number.isFinite(p.inventoryCost)?p.inventoryCost:Number(p.cost)||0;}
 function kitCost(db,kit){
  const components=(kit.items||[]).map(l=>{const p=(db.products||[]).find(p=>p.id===l.product);if(!p)throw Error('Produto do kit não encontrado.');const unit=componentCost(p);return {product:p.id,name:p.name,qty:l.qty,unitCost:unit,total:round(unit*l.qty)};});
  const supplies=(kit.supplies||[]).map(l=>{const i=db.pantry.find(i=>i.id===l.id);if(!i)throw Error('Insumo do kit não encontrado.');const unit=unitCost(i);return {id:i.id,name:i.name,unit:i.unit,qty:l.qty,unitCost:unit,total:round(unit*l.qty)};});
  const extra=number(kit.extraCost||0,'Outros custos');
  return {components,supplies,extra,total:round(components.reduce((s,x)=>s+x.total,0)+supplies.reduce((s,x)=>s+x.total,0)+extra)};
 }
 function reconcile(db){
  migrate(db);
  for(const p of db.products||[]){const recipes=db.recipes.filter(r=>r.product===p.id);if(recipes.length===1){try{const r=recipes[0];if(p.stock>0&&!Number.isFinite(p.inventoryCost)&&Number.isFinite(p.cost))p.inventoryCost=p.cost;p.cost=round(recipeCost(db,r)/number(r.yieldQty,'Rendimento',1));p.costSource='recipe';}catch{/* Keep prior cost until a broken legacy recipe is repaired. */}}}
  for(const kit of db.kits){const p=(db.products||[]).find(p=>p.id===kit.product);if(p){try{p.cost=round(kitCost(db,kit).total);p.costSource='kit';}catch{/* Keep prior cost until the kit is repaired. */}}}
  return db;
 }
 // The brand belongs to the purchase (and to the package code), never to the ingredient:
 // stock, average cost and recipes stay on the generic item whatever brand was bought.
 function brand(value){const v=text(value);if(v.length>60)throw Error('A marca pode ter até 60 caracteres.');return v;}
 function linkBarcode(db,i,code,packQty,brandName){
  code=barcode(code);packQty=number(packQty,'Conteúdo da embalagem',.001);const b=brand(brandName);
  const found=findBarcode(db,code);if(found&&found.item.id!==i.id)throw Error('Este código já pertence a outro ingrediente.');
  i.barcodes=i.barcodes||[];const old=i.barcodes.find(b=>b.code===code);if(old){old.packQty=packQty;if(b)old.brand=b;}else i.barcodes.push(b?{code,packQty,brand:b}:{code,packQty});return i;
 }
 function findBarcode(db,code){for(const item of db.pantry||[]){const pack=(item.barcodes||[]).find(b=>b.code===code)||(item.barcode===code?{code,packQty:item.packQty}:null);if(pack)return {item,pack};}return null;}
 function purchase(db,id,values){
  migrate(db);const i=db.pantry.find(i=>i.id===id);if(!i)throw Error('Ingrediente não encontrado.');
  if(i.active===false)throw Error(i.name+' está desativado. Reative o insumo na Despensa para registrar compras.');
  const qty=round(number(values.qty,'Quantidade',.001),3),total=round(number(values.total,'Preço total'),2),supplier=text(values.supplier);
  if(!supplier||supplier.length>100)throw Error('Informe o mercado ou fornecedor (até 100 caracteres).');
  const purchasedOn=date(values.purchasedOn||day());if(purchasedOn>day())throw Error('A compra não pode ter data futura.');
  const expiry=text(values.expiry);if(i.trackExpiry&&(!expiry||date(expiry)<day()))throw Error('Informe uma validade válida e não vencida.');
  const code=values.barcode?barcode(values.barcode):'',at=values.at||Date.now(),lotId='purchase-'+at+'-'+Math.random().toString(36).slice(2);
  const pack=code?(i.barcodes||[]).find(b=>b.code===code):null,brandName=brand(values.brand)||pack?.brand||'';
  if(pack&&brandName)pack.brand=brandName;
  const movement={at,lotId,kind:'Entrada',id:i.id,name:i.name,unit:i.unit,qty,total,unitCost:total/qty,supplier,brand:brandName,purchasedOn,barcode:code,packQty:Number(values.packQty)||i.packQty,packs:Number(values.packs)||0,entryMode:values.entryMode||'direct'};
  i.qty=round(i.qty+qty,3);i.stockValue=round(i.stockValue+total);i.lastUnitCost=unitCost(i);
  db.pantryLots.push({id:lotId,ingredientId:id,code:text(values.lotCode)||'LOTE-'+at,expiry:i.trackExpiry?expiry:null,qty,unitCost:total/qty,at});db.pantryMovements.push(movement);reconcile(db);return movement;
 }
 function purchaseLot(db,m){return db.pantryLots.find(l=>m.lotId!=null?l.id===m.lotId:l.ingredientId===m.id&&Math.abs(l.at-m.at)<2500&&Math.abs(l.unitCost-m.unitCost)<.00001);}
 function assertEditable(db,m){
  if(!m||m.kind!=='Entrada'||m.cancelledAt)throw Error('Compra indisponível.');
  const n=db.pantryMovements.indexOf(m),lot=purchaseLot(db,m);
  if((lot&&lot.qty<m.qty-.0001)||db.pantryMovements.slice(n+1).some(x=>x.id===m.id&&x.kind!=='Entrada'))throw Error('Há consumo ou ajuste após esta compra. Quantidade e valor não podem ser alterados retroativamente; os custos históricos foram preservados.');
 }
 function editPurchase(db,m,values){
  const i=db.pantry.find(i=>i.id===m?.id);if(!i||!m||m.cancelledAt)throw Error('Compra indisponível.');
  const qty=round(number(values.qty,'Quantidade',.001),3),total=round(number(values.total,'Preço total'),2),supplier=text(values.supplier),reason=text(values.reason),purchasedOn=date(values.purchasedOn||m.purchasedOn||day());
  if(!supplier||!reason)throw Error('Informe fornecedor e motivo.');if(purchasedOn>day())throw Error('Data de compra futura.');
  const financial=qty!==m.qty||total!==m.total;if(financial)assertEditable(db,m);
  const delta=qty-m.qty,value=i.stockValue+total-m.total;if(i.qty+delta<-.0001||value<-.0001)throw Error('A correção deixaria o estoque negativo.');
  const brandName=values.brand===undefined?m.brand||'':brand(values.brand);
  m.editHistory=m.editHistory||[];m.editHistory.push({at:Date.now(),qty:m.qty,total:m.total,supplier:m.supplier,brand:m.brand||'',purchasedOn:m.purchasedOn,reason});
  if(financial){i.qty=round(i.qty+delta,3);i.stockValue=round(Math.max(0,value));i.lastUnitCost=unitCost(i);const lot=purchaseLot(db,m);if(lot){lot.qty=round(lot.qty+delta,3);lot.unitCost=total/qty;}}
  Object.assign(m,{qty,total,unitCost:total/qty,supplier,brand:brandName,purchasedOn,editedAt:Date.now()});reconcile(db);return m;
 }
 const isCorrection=x=>typeof x.kind==='string'&&x.kind.startsWith('Correção');
 // What deleting a purchase would take: manual balance corrections made after it
 // (e.g. zeroing the stock instead of deleting) can be undone with it; production,
 // assembly or other consumption keep the purchase locked to protect recorded costs.
 function purchaseDeletion(db,m){
  if(!m||m.kind!=='Entrada'||m.cancelledAt)throw Error('Compra indisponível.');
  const n=db.pantryMovements.indexOf(m),later=db.pantryMovements.slice(n+1).filter(x=>x.id===m.id&&x.kind!=='Entrada'&&!x.undoneAt);
  const used=later.find(x=>!isCorrection(x));
  if(used)throw Error(`${m.name} já foi usado depois desta compra (${used.kind}). Para não alterar o custo de produções e vendas já registradas, a compra não pode ser excluída. Use Corrigir saldo para acertar a quantidade.`);
  return {corrections:later};
 }
 function cancelPurchase(db,m,reason,options={}){
  const {corrections}=purchaseDeletion(db,m);
  if(corrections.length){
   if(!options.undoCorrections)throw Error('Há correção de saldo feita depois desta compra. Confirme que ela também deve ser desfeita.');
   return undoWithCorrections(db,m,corrections,reason);
  }
  assertEditable(db,m);if(!text(reason))throw Error('Informe o motivo.');const i=db.pantry.find(i=>i.id===m.id);if(!i||i.qty<m.qty-.0001||i.stockValue<m.total-.0001)throw Error('Saldo insuficiente para estorno.');
  const avg=unitCost(i);i.qty=round(i.qty-m.qty,3);i.stockValue=i.qty?round(Math.max(0,i.stockValue-m.total)):0;i.lastUnitCost=i.qty?unitCost(i):avg;const lot=purchaseLot(db,m);if(lot)lot.qty=0;m.cancelledAt=Date.now();m.cancelReason=text(reason);reconcile(db);
 }
 // Restores the balance as if neither the purchase nor the corrections after it had happened.
 function undoWithCorrections(db,m,corrections,reason){
  if(!text(reason))throw Error('Informe o motivo.');const i=db.pantry.find(i=>i.id===m.id);if(!i)throw Error('Ingrediente não encontrado.');
  const qty=round(i.qty-corrections.reduce((s,c)=>s+(Number(c.qty)||0),0)-m.qty,3);
  if(qty<-.001)throw Error('Desfazer esta compra deixaria o saldo negativo. Revise as compras e correções do ingrediente.');
  const raw=Number(i.stockValue||0)-corrections.reduce((s,c)=>s+(Number(c.total)||0),0)-m.total,cents=round(raw,2),value=Math.abs(raw-cents)<.0005?cents:raw; // corrections store rounded values; snap tiny drift back to cents
  const previous=db.pantryMovements.slice(0,db.pantryMovements.indexOf(m)).filter(x=>x.kind==='Entrada'&&x.id===m.id&&!x.cancelledAt&&x.qty>0).at(-1);
  i.qty=Math.max(0,qty);i.stockValue=i.qty?round(Math.max(0,value)):0;i.lastUnitCost=i.qty?unitCost(i):previous?previous.total/previous.qty:Number(i.lastUnitCost)||0;
  // Lots: the purchase and the adjustment lots after it go away; the rest must add up to the restored balance.
  const lot=purchaseLot(db,m);if(lot)lot.qty=0;
  const lots=db.pantryLots.filter(l=>l.ingredientId===i.id);for(const l of lots)if(l.code==='AJUSTE'&&l.at>=m.at)l.qty=0;
  let gap=round(i.qty-lots.reduce((s,l)=>s+(l.qty>0?l.qty:0),0),3);
  if(gap>0)db.pantryLots.push({id:'restore-'+Date.now(),ingredientId:i.id,code:'RESTAURADO',expiry:null,qty:gap,unitCost:unitCost(i),at:Date.now()});
  else for(const l of lots.filter(l=>l.qty>0).sort((a,b)=>a.at-b.at)){if(gap>=0)break;const take=Math.min(-gap,l.qty);l.qty=round(l.qty-take,3);gap=round(gap+take,3);}
  const at=Date.now();for(const c of corrections){c.undoneAt=at;c.undoneWith=m.lotId||m.at;}
  m.cancelledAt=at;m.cancelReason=text(reason);m.undoneCorrections=corrections.length;reconcile(db);return m;
 }
 // A barcode linked to the wrong ingredient would send every later scan back to it.
 function unlinkBarcode(db,i,code){
  if(!i||!code)return false;const before=(i.barcodes||[]).length+(i.barcode?1:0);
  i.barcodes=(i.barcodes||[]).filter(b=>b.code!==code);if(i.barcode===code)delete i.barcode;
  return before!==i.barcodes.length+(i.barcode?1:0);
 }
 function consumeItems(db,req,at,kind){
  for(const x of req){const avg=unitCost(x.item);let remaining=x.qty;const lots=db.pantryLots.filter(l=>l.ingredientId===x.item.id&&l.qty>0&&(!x.item.trackExpiry||!l.expiry||l.expiry>=day())).sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999')||a.at-b.at);for(const lot of lots){const used=Math.min(remaining,lot.qty);lot.qty=round(lot.qty-used,3);remaining=round(remaining-used,3);if(remaining<=0)break;}x.item.qty=round(x.item.qty-x.qty,3);x.item.stockValue=x.item.qty?round(Math.max(0,x.item.stockValue-avg*x.qty)):0;x.item.lastUnitCost=avg;db.pantryMovements.push({at,kind,id:x.item.id,name:x.item.name,unit:x.item.unit,qty:-x.qty,total:-round(avg*x.qty)});}
 }
 function stockIn(p,units,cost){const oldQty=Number(p.stock)||0,oldCost=Number.isFinite(p.inventoryCost)?p.inventoryCost:Number(p.cost)||0;p.stock=oldQty+units;p.inventoryCost=round((oldQty*oldCost+cost)/p.stock);}
 // Consumes the pantry for full recipes; where the units go is up to the caller.
 function brew(db,recipe,batches){
  batches=number(batches,'Número de receitas',1);if(!Number.isInteger(batches))throw Error('Informe um número inteiro de receitas.');
  const p=db.products.find(p=>p.id===recipe?.product);if(!p)throw Error('Produto não encontrado.');
  const units=number(recipe.yieldQty,'Rendimento',1)*batches;if(!Number.isInteger(units))throw Error('O rendimento deve ser inteiro.');
  const req=requirements(db,recipe,batches);if(req.some(x=>x.short>.0001))throw Error('Ingredientes insuficientes ou vencidos.');
  const cost=round(req.reduce((s,x)=>s+unitCost(x.item)*x.qty,0)+number(recipe.extraCost||0,'Custo adicional')*batches),at=Date.now();
  const lines=req.map(x=>({id:x.item.id,name:x.item.name,unit:x.item.unit,qty:x.qty,unitCost:unitCost(x.item),total:round(unitCost(x.item)*x.qty)}));
  consumeItems(db,req,at,'Consumo na produção');
  return {p,at,batches,units,cost,lines,extraCost:round((recipe.extraCost||0)*batches)};
 }
 function produce(db,recipe,batches){
  const run=brew(db,recipe,batches);stockIn(run.p,run.units,run.cost);
  db.production.push({at:run.at,product:run.p.id,batches:run.batches,units:run.units,cost:run.cost,unitCost:round(run.cost/run.units),ingredients:run.lines,extraCost:run.extraCost});reconcile(db);return db.production.at(-1);
 }
 const NO_BRAND='Marca não informada';
 function comparisons(db,id,{from='',to='',supplier='',code='',brand:brandFilter=''}={}){
  const rows=(db.pantryMovements||[]).filter(m=>m.kind==='Entrada'&&!m.cancelledAt&&m.id===id&&m.qty>0).map(m=>({...m,purchasedOn:m.purchasedOn||new Date(m.at).toISOString().slice(0,10),supplier:text(m.supplier)||'Fornecedor não informado',brand:text(m.brand)||NO_BRAND,unitCost:m.total/m.qty})).filter(m=>(!from||m.purchasedOn>=from)&&(!to||m.purchasedOn<=to)&&(!supplier||norm(m.supplier)===norm(supplier))&&(!brandFilter||norm(m.brand)===norm(brandFilter))&&(!code||m.barcode===code)).sort((a,b)=>a.purchasedOn.localeCompare(b.purchasedOn)||a.at-b.at);
  const group=field=>{const groups=new Map();for(const row of rows){const key=norm(row[field]),g=groups.get(key)||{[field]:row[field],total:0,qty:0,count:0,previous:null,latest:null,min:Infinity,max:0};g.total+=row.total;g.qty+=row.qty;g.count++;g.previous=g.latest;g.latest=row;g.min=Math.min(g.min,row.unitCost);g.max=Math.max(g.max,row.unitCost);groups.set(key,g);}
   return [...groups.values()].map(g=>({...g,average:g.total/g.qty,change:g.previous?.unitCost>0?(g.latest.unitCost/g.previous.unitCost-1)*100:null})).sort((a,b)=>a.average-b.average);};
  return {rows,suppliers:group('supplier'),brands:group('brand')};
 }
 // Brands already bought for one ingredient, newest first, to suggest in the purchase form.
 function brandsOf(db,id){const seen=new Map();for(const m of [...(db.pantryMovements||[])].reverse())if(m.kind==='Entrada'&&!m.cancelledAt&&m.id===id&&text(m.brand)&&!seen.has(norm(m.brand)))seen.set(norm(m.brand),text(m.brand));return [...seen.values()];}
 // Where an ingredient is still used, so turning it off never silently breaks a recipe or kit.
 function usage(db,id){
  const name=pid=>(db.products||[]).find(p=>p.id===pid)?.name||'Produto';
  return {recipes:(db.recipes||[]).filter(r=>(r.ingredients||[]).some(l=>l.id===id&&l.qty>0)).map(r=>name(r.product)),kits:(db.kits||[]).filter(k=>(k.supplies||[]).some(l=>l.id===id&&l.qty>0)).map(k=>name(k.product))};
 }
 // Two items that are the same ingredient (usually one per brand) become one: balance, value,
 // purchases, lots, codes, recipes and kits move to the target, which keeps its name and minimum.
 function mergeCheck(db,sourceId,targetId){
  migrate(db);const source=db.pantry.find(i=>i.id===sourceId),target=db.pantry.find(i=>i.id===targetId);
  if(!source||!target)throw Error('Escolha os dois insumos.');if(source.id===target.id)throw Error('Escolha outro insumo para juntar.');
  if(source.unit!==target.unit)throw Error('Só dá para juntar insumos com a mesma unidade ('+source.unit+' e '+target.unit+' são diferentes).');
  if((source.category||'ingredient')!==(target.category||'ingredient'))throw Error('Só dá para juntar ingrediente com ingrediente, ou embalagem com embalagem.');
  const qty=round(target.qty+source.qty,3),value=round(target.stockValue+source.stockValue),use=usage(db,source.id),both=usage(db,target.id);
  return {source,target,qty,value,unitCost:qty>0?value/qty:(target.lastUnitCost||source.lastUnitCost||0),
   purchases:(db.pantryMovements||[]).filter(m=>m.id===source.id&&m.kind==='Entrada'&&!m.cancelledAt).length,
   barcodes:(source.barcodes||[]).length,recipes:use.recipes,kits:use.kits,sharedRecipes:use.recipes.filter(n=>both.recipes.includes(n))};
 }
 function merge(db,sourceId,targetId,{brand:brandName=''}={}){
  const c=mergeCheck(db,sourceId,targetId),{source,target}=c,b=brand(brandName),at=Date.now();
  for(const m of db.pantryMovements)if(m.id===source.id){m.id=target.id;m.mergedFrom=m.name;m.name=target.name;if(m.kind==='Entrada'&&!text(m.brand)&&b)m.brand=b;}
  for(const l of db.pantryLots)if(l.ingredientId===source.id)l.ingredientId=target.id;
  target.barcodes=target.barcodes||[];for(const code of source.barcodes||[])if(!target.barcodes.some(x=>x.code===code.code))target.barcodes.push(code.brand||!b?code:{...code,brand:b});
  // A recipe that already used both keeps one line with the summed portion.
  const relink=lines=>{const out=[];for(const l of lines||[]){const id=l.id===source.id?target.id:l.id,old=out.find(x=>x.id===id);if(old)old.qty=round(old.qty+l.qty,3);else out.push({...l,id});}return out;};
  for(const r of db.recipes||[])r.ingredients=relink(r.ingredients);
  for(const k of db.kits||[])k.supplies=relink(k.supplies);
  target.qty=c.qty;target.stockValue=c.value;target.trackExpiry=!!(target.trackExpiry||source.trackExpiry);
  target.lastUnitCost=c.qty>0?c.value/c.qty:c.unitCost;if(target.active===false&&source.active!==false){target.active=true;delete target.inactiveAt;}
  db.pantry.splice(db.pantry.indexOf(source),1);
  // id:null keeps this note out of the purchase-deletion checks of either item.
  db.pantryMovements.push({at,kind:'Junção de insumos',id:null,mergedInto:target.id,name:source.name+' → '+target.name,unit:target.unit,qty:source.qty,total:source.stockValue,purchasedOn:day()});
  reconcile(db);return {...c,target};
 }
 function setActive(db,i,active){if(!i)throw Error('Ingrediente não encontrado.');i.active=!!active;if(active)delete i.inactiveAt;else i.inactiveAt=Date.now();return usage(db,i.id);}
 function productionCapacity(db,recipe){
  const product=(db.products||[]).find(p=>p.id===recipe.product);
  if(!product)throw Error('Produto da ficha não encontrado.');
  const yieldQty=number(recipe.yieldQty,'Rendimento',1);if(!Number.isSafeInteger(yieldQty))throw Error('O rendimento precisa ser inteiro.');
  const view={...db,pantryLots:db.pantryLots||[]};
  const lines=requirements(view,recipe).map(x=>{const stock=number(available(view,x.item),'Estoque disponível');const required=Math.round(x.qty*1000);return {id:x.item.id,name:x.item.name,unit:x.item.unit,required:x.qty,available:stock,batches:Math.floor(Math.round(stock*1000)/required),unitCost:unitCost(x.item)};});
  const batches=Math.min(...lines.map(x=>x.batches));if(!Number.isSafeInteger(batches)||!Number.isSafeInteger(batches*yieldQty))throw Error('Quantidade fora do limite de cálculo.');
  return {product:product.id,name:product.name,yieldQty,batches,units:batches*yieldQty,
   limiting:lines.filter(x=>x.batches===batches),lines,
   missingNext:lines.map(x=>({...x,missing:round(Math.max(0,x.required*(batches+1)-x.available),3)})).filter(x=>x.missing>0)};
 }
 function productionPlan(db,selections){
  const needed=new Map(),products=[],errors=[];
  for(const selection of selections){
   if(selection.batches===0)continue;
   try{
    if(!Number.isSafeInteger(selection.batches)||selection.batches<1||selection.batches>1000000)throw Error('Escolha de 0 a 1.000.000 receitas completas.');
    const recipe=(db.recipes||[])[selection.index];if(!recipe)throw Error('Ficha técnica não encontrada.');
    const capacity=productionCapacity(db,recipe),units=selection.batches*capacity.yieldQty;if(!Number.isSafeInteger(units))throw Error('Quantidade fora do limite de cálculo.');products.push({name:capacity.name,batches:selection.batches,units});
    for(const line of capacity.lines){const old=needed.get(line.id);needed.set(line.id,{...line,required:round((old?.required||0)+line.required*selection.batches,3)});}
   }catch(e){errors.push(e.message);}
  }
  const ingredients=[...needed.values()].map(x=>({...x,missing:round(Math.max(0,x.required-x.available),3)}));
  return {products,ingredients,missing:ingredients.filter(x=>x.missing>0),errors,
   feasible:products.length>0&&!errors.length&&ingredients.every(x=>x.missing===0),
   estimatedPurchase:round(ingredients.reduce((s,x)=>s+x.missing*x.unitCost,0),2)};
 }
 const api={round,day,date,norm,barcode,migrate,unitCost,available,requirements,recipeCost,reconcile,findBarcode,linkBarcode,purchase,purchaseLot,assertEditable,editPurchase,purchaseDeletion,cancelPurchase,unlinkBarcode,produce,brew,stockIn,consumeItems,componentCost,kitCost,comparisons,brand,brandsOf,usage,setActive,mergeCheck,merge,productionCapacity,productionPlan};
 if(typeof module!=='undefined')module.exports=api;if(root)root.DocePantry=api;
})(typeof window!=='undefined'?window:null);
