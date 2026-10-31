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
  for(const k of ['pantry','pantryLots','pantryMovements','pantryEntries','recipes','production'])if(!Array.isArray(db[k]))db[k]=[];
  for(const i of db.pantry){i.qty=Number(i.qty)||0;i.packQty=Number(i.packQty)>0?Number(i.packQty):1;i.stockValue=i.stockValue===undefined?round(i.qty*(Number(i.price)||0)/i.packQty):Number(i.stockValue)||0;i.lastUnitCost=i.lastUnitCost===undefined?(Number(i.price)||0)/i.packQty:Number(i.lastUnitCost)||0;if(i.trackExpiry===undefined)i.trackExpiry=false;if(!Array.isArray(i.barcodes))i.barcodes=i.barcode?[{code:String(i.barcode),packQty:i.packQty}]:[];}
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
 function reconcile(db){
  migrate(db);
  for(const p of db.products||[]){const recipes=db.recipes.filter(r=>r.product===p.id);if(recipes.length===1){try{const r=recipes[0];if(p.stock>0&&!Number.isFinite(p.inventoryCost)&&Number.isFinite(p.cost))p.inventoryCost=p.cost;p.cost=round(recipeCost(db,r)/number(r.yieldQty,'Rendimento',1));p.costSource='recipe';}catch{/* Keep prior cost until a broken legacy recipe is repaired. */}}}
  return db;
 }
 function linkBarcode(db,i,code,packQty){
  code=barcode(code);packQty=number(packQty,'Conteúdo da embalagem',.001);
  const found=findBarcode(db,code);if(found&&found.item.id!==i.id)throw Error('Este código já pertence a outro ingrediente.');
  i.barcodes=i.barcodes||[];const old=i.barcodes.find(b=>b.code===code);if(old)old.packQty=packQty;else i.barcodes.push({code,packQty});return i;
 }
 function findBarcode(db,code){for(const item of db.pantry||[]){const pack=(item.barcodes||[]).find(b=>b.code===code)||(item.barcode===code?{code,packQty:item.packQty}:null);if(pack)return {item,pack};}return null;}
 function purchase(db,id,values){
  migrate(db);const i=db.pantry.find(i=>i.id===id);if(!i)throw Error('Ingrediente não encontrado.');
  const qty=round(number(values.qty,'Quantidade',.001),3),total=round(number(values.total,'Preço total'),2),supplier=text(values.supplier);
  if(!supplier||supplier.length>100)throw Error('Informe o mercado ou fornecedor (até 100 caracteres).');
  const purchasedOn=date(values.purchasedOn||day());if(purchasedOn>day())throw Error('A compra não pode ter data futura.');
  const expiry=text(values.expiry);if(i.trackExpiry&&(!expiry||date(expiry)<day()))throw Error('Informe uma validade válida e não vencida.');
  const code=values.barcode?barcode(values.barcode):'',at=values.at||Date.now(),lotId='purchase-'+at+'-'+Math.random().toString(36).slice(2);
  const movement={at,lotId,kind:'Entrada',id:i.id,name:i.name,unit:i.unit,qty,total,unitCost:total/qty,supplier,purchasedOn,barcode:code,packQty:Number(values.packQty)||i.packQty,packs:Number(values.packs)||0,entryMode:values.entryMode||'direct'};
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
  m.editHistory=m.editHistory||[];m.editHistory.push({at:Date.now(),qty:m.qty,total:m.total,supplier:m.supplier,purchasedOn:m.purchasedOn,reason});
  if(financial){i.qty=round(i.qty+delta,3);i.stockValue=round(Math.max(0,value));i.lastUnitCost=unitCost(i);const lot=purchaseLot(db,m);if(lot){lot.qty=round(lot.qty+delta,3);lot.unitCost=total/qty;}}
  Object.assign(m,{qty,total,unitCost:total/qty,supplier,purchasedOn,editedAt:Date.now()});reconcile(db);return m;
 }
 function cancelPurchase(db,m,reason){
  assertEditable(db,m);if(!text(reason))throw Error('Informe o motivo.');const i=db.pantry.find(i=>i.id===m.id);if(!i||i.qty<m.qty-.0001||i.stockValue<m.total-.0001)throw Error('Saldo insuficiente para estorno.');
  const avg=unitCost(i);i.qty=round(i.qty-m.qty,3);i.stockValue=i.qty?round(Math.max(0,i.stockValue-m.total)):0;i.lastUnitCost=i.qty?unitCost(i):avg;const lot=purchaseLot(db,m);if(lot)lot.qty=0;m.cancelledAt=Date.now();m.cancelReason=text(reason);reconcile(db);
 }
 function produce(db,recipe,batches){
  batches=number(batches,'Número de receitas',1);if(!Number.isInteger(batches))throw Error('Informe um número inteiro de receitas.');
  const p=db.products.find(p=>p.id===recipe?.product);if(!p)throw Error('Produto não encontrado.');
  const units=number(recipe.yieldQty,'Rendimento',1)*batches;if(!Number.isInteger(units))throw Error('O rendimento deve ser inteiro.');
  const req=requirements(db,recipe,batches);if(req.some(x=>x.short>.0001))throw Error('Ingredientes insuficientes ou vencidos.');
  const cost=round(req.reduce((s,x)=>s+unitCost(x.item)*x.qty,0)+number(recipe.extraCost||0,'Custo adicional')*batches),at=Date.now(),oldQty=Number(p.stock)||0,oldCost=Number.isFinite(p.inventoryCost)?p.inventoryCost:Number(p.cost)||0;
  const lines=req.map(x=>({id:x.item.id,name:x.item.name,unit:x.item.unit,qty:x.qty,unitCost:unitCost(x.item),total:round(unitCost(x.item)*x.qty)}));
  for(const x of req){const avg=unitCost(x.item);let remaining=x.qty;const lots=db.pantryLots.filter(l=>l.ingredientId===x.item.id&&l.qty>0&&(!x.item.trackExpiry||!l.expiry||l.expiry>=day())).sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999')||a.at-b.at);for(const lot of lots){const used=Math.min(remaining,lot.qty);lot.qty=round(lot.qty-used,3);remaining=round(remaining-used,3);if(remaining<=0)break;}x.item.qty=round(x.item.qty-x.qty,3);x.item.stockValue=x.item.qty?round(Math.max(0,x.item.stockValue-avg*x.qty)):0;x.item.lastUnitCost=avg;db.pantryMovements.push({at,kind:'Consumo na produção',id:x.item.id,name:x.item.name,unit:x.item.unit,qty:-x.qty,total:-round(avg*x.qty)});}
  p.stock=oldQty+units;p.inventoryCost=round((oldQty*oldCost+cost)/p.stock);db.production.push({at,product:p.id,batches,units,cost,unitCost:round(cost/units),ingredients:lines,extraCost:round((recipe.extraCost||0)*batches)});reconcile(db);return db.production.at(-1);
 }
 function comparisons(db,id,{from='',to='',supplier='',code=''}={}){
  const rows=(db.pantryMovements||[]).filter(m=>m.kind==='Entrada'&&!m.cancelledAt&&m.id===id&&m.qty>0).map(m=>({...m,purchasedOn:m.purchasedOn||new Date(m.at).toISOString().slice(0,10),supplier:text(m.supplier)||'Fornecedor não informado',unitCost:m.total/m.qty})).filter(m=>(!from||m.purchasedOn>=from)&&(!to||m.purchasedOn<=to)&&(!supplier||norm(m.supplier)===norm(supplier))&&(!code||m.barcode===code)).sort((a,b)=>a.purchasedOn.localeCompare(b.purchasedOn)||a.at-b.at);
  const groups=new Map();for(const row of rows){const key=norm(row.supplier),g=groups.get(key)||{supplier:row.supplier,total:0,qty:0,count:0,previous:null,latest:null,min:Infinity,max:0};g.total+=row.total;g.qty+=row.qty;g.count++;g.previous=g.latest;g.latest=row;g.min=Math.min(g.min,row.unitCost);g.max=Math.max(g.max,row.unitCost);groups.set(key,g);}
  const suppliers=[...groups.values()].map(g=>({...g,average:g.total/g.qty,change:g.previous?.unitCost>0?(g.latest.unitCost/g.previous.unitCost-1)*100:null})).sort((a,b)=>a.average-b.average);
  return {rows,suppliers};
 }
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
 const api={round,day,date,norm,barcode,migrate,unitCost,available,requirements,recipeCost,reconcile,findBarcode,linkBarcode,purchase,purchaseLot,assertEditable,editPurchase,cancelPurchase,produce,comparisons,productionCapacity,productionPlan};
 if(typeof module!=='undefined')module.exports=api;if(root)root.DocePantry=api;
})(typeof window!=='undefined'?window:null);
