/* Store administration: margin alerts, use-before-expiry suggestions and a shareable
   shopping list, added to the Planejamento inteligente page. Pure helpers are exported for tests. */
(function(root){
 'use strict';
 const DAY=86400000;
 const round2=v=>Math.round(v*100)/100;
 // Suggested prices end in ,90 and never go below the cost-based minimum.
 function suggestPrice(unitCost,target){const raw=unitCost/(1-target);return Math.max(round2(Math.ceil(raw-.9)+.9),round2(Math.ceil(raw*100)/100));}
 function unitPrice(p){return p.priceBasis==='cento'?Number(p.price)/100:Number(p.price);}
 function margins(db,costOf,target){
  const rows=[];
  for(const recipe of db.recipes||[]){
   const p=(db.products||[]).find(x=>x.id===recipe.product);if(!p||p.active===false)continue;
   let cost;try{cost=costOf(recipe)/Math.max(1,Number(recipe.yieldQty)||1);}catch{continue;}
   const price=unitPrice(p);if(!(price>0)||!(cost>0))continue;
   const margin=(price-cost)/price,suggested=suggestPrice(cost,target);
   rows.push({product:p,cost,price,margin,below:margin<target,suggested:p.priceBasis==='cento'?round2(suggested*100):suggested});
  }
  return rows.sort((a,b)=>a.margin-b.margin);
 }
 function expiring(db,today,days=7){
  const limit=new Date(Date.parse(today+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);
  return (db.pantryLots||[]).filter(l=>l.qty>0&&l.expiry&&l.expiry>=today&&l.expiry<=limit).map(l=>{
   const item=(db.pantry||[]).find(i=>i.id===l.ingredientId);
   const uses=(db.recipes||[]).filter(r=>(r.ingredients||[]).some(x=>x.id===l.ingredientId)).map(r=>(db.products||[]).find(p=>p.id===r.product)?.name).filter(Boolean);
   return {lot:l,item,uses:[...new Set(uses)],days:Math.round((Date.parse(l.expiry+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/DAY)};
  }).filter(x=>x.item).sort((a,b)=>a.lot.expiry.localeCompare(b.lot.expiry));
 }
 function shopping(db,needsOf){
  const open=(db.orders||[]).filter(o=>!['Cancelado','Concluído','Entregue'].includes(o.status)),demand={};
  open.forEach(o=>(o.items||[]).forEach(i=>demand[i.id]=(demand[i.id]||0)+(Number(i.qty)||0)));
  const combined=new Map();
  for(const recipe of db.recipes||[]){
   const p=(db.products||[]).find(x=>x.id===recipe.product),batches=Math.ceil(Math.max(0,(demand[recipe.product]||0)-(p?.stock||0))/Math.max(1,recipe.yieldQty));
   if(!batches)continue;
   let needs;try{needs=needsOf(recipe,batches);}catch{continue;}
   for(const x of needs){const cur=combined.get(x.item.id)||{item:x.item,qty:0};cur.qty+=x.qty;combined.set(x.item.id,cur);}
  }
  return [...combined.values()].map(x=>({item:x.item,missing:Math.round((x.qty-(Number(x.item.qty)||0))*1000)/1000})).filter(x=>x.missing>0);
 }
 function listText(shopName,rows){return 'Lista de compras · '+shopName+'\n'+rows.map(r=>'• '+r.item.name+': '+r.missing.toLocaleString('pt-BR')+' '+r.item.unit).join('\n');}
 const api={suggestPrice,unitPrice,margins,expiring,shopping,listText};
 if(typeof module!=='undefined')module.exports=api;
 if(!root||root.DOCE_MODE!=='admin'||typeof root.adminPlanner!=='function')return;

 // index.html globals (db, esc, money, save…) are script bindings, not window properties.
 const previousPlanner=adminPlanner;
 const pct=v=>(v*100).toLocaleString('pt-BR',{maximumFractionDigits:0})+'%';
 const target=()=>{const v=Number(db.settings.targetMargin);return Number.isFinite(v)&&v>=5&&v<=90?v/100:.6;};
 const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 function section(){
  const goal=target();
  const rows=margins(db,recipeCost,goal),low=rows.filter(r=>r.below);
  const lots=expiring(db,today()),list=shopping(db,recipeNeeds);
  const marginHtml=low.length?low.map(r=>`<div class="panel margin-alert"><b>${esc(r.product.name)}</b><p>Margem atual <b>${pct(r.margin)}</b> · custo ${money(r.cost)} por unidade · preço ${money(r.price)}</p><p>Para chegar a ${pct(goal)}: <b>${money(r.suggested)}</b>${r.product.priceBasis==='cento'?' o cento':''}</p><button class="btn" onclick="useSuggestedPrice(${r.product.id},${r.suggested})">Usar preço sugerido</button></div>`).join(''):
   `<div class="panel">${rows.length?'Todos os produtos com ficha técnica estão na margem desejada ou acima.':'Cadastre fichas técnicas para comparar custo e preço.'}</div>`;
  const lotHtml=lots.length?lots.map(x=>`<div class="note">⏳ <b>${esc(x.item.name)}</b>: ${x.lot.qty.toLocaleString('pt-BR')} ${esc(x.item.unit)} vencem ${x.days===0?'hoje':x.days===1?'amanhã':'em '+x.days+' dias'}. ${x.uses.length?'Use em: '+x.uses.map(esc).join(', ')+'. Produza antes ou faça uma promoção.':'Nenhuma ficha técnica usa este ingrediente.'}</div>`).join(''):'<div class="panel">Nenhum lote vence nos próximos 7 dias.</div>';
  return `<div class="section"><h3>💰 Alerta de margem</h3></div><form class="panel stack" onsubmit="saveTargetMargin(event)"><label class="field">Margem desejada (%)<input name="targetMargin" type="number" min="5" max="90" step="1" value="${Math.round(goal*100)}"></label><button class="btn">Salvar meta</button><p class="muted tiny">Margem = (preço − custo da ficha técnica) ÷ preço. Mudanças de preço ficam no rascunho até Enviar alterações.</p></form>${marginHtml}
<div class="section"><h3>⏳ Aproveite antes de vencer</h3></div>${lotHtml}
<div class="section"><h3>🛒 Lista de compras dos pedidos abertos</h3></div>${list.length?`<div class="panel">${list.map(r=>`<p><b>${esc(r.item.name)}</b>: comprar ${r.missing.toLocaleString('pt-BR')} ${esc(r.item.unit)}</p>`).join('')}<button class="btn primary" onclick="shareShoppingList()">Compartilhar lista</button></div>`:'<div class="panel">Nada a comprar para os pedidos abertos.</div>'}`;
 }
 adminPlanner=function(){return previousPlanner()+section();};
 root.saveTargetMargin=function(e){e.preventDefault();const v=Number(new FormData(e.target).get('targetMargin'));if(!Number.isFinite(v)||v<5||v>90)return notify('Use uma margem entre 5% e 90%.');db.settings.targetMargin=Math.round(v);save();render();notify('Meta de margem salva no rascunho.');};
 root.useSuggestedPrice=function(id,price){
  const p=db.products.find(x=>x.id===id);if(!p)return;
  if(!confirm('Alterar o preço de '+p.name+' de '+money(p.price)+' para '+money(price)+'? A mudança fica no rascunho até Enviar alterações.'))return;
  p.price=price;save();render();notify('Preço alterado no rascunho. Publique com Enviar alterações.');
 };
 root.shareShoppingList=async function(){
  const text=listText(db.settings.name||'Loja',shopping(db,recipeNeeds));
  try{if(navigator.share){await navigator.share({title:'Lista de compras',text});return;}}catch(e){if(e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text);notify('Lista copiada. Cole no WhatsApp ou nas notas.');}catch{window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');}
 };
})(typeof window!=='undefined'?window:null);
