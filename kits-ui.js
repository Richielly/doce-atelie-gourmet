/* Store administration screen for kits. Kit definitions are drafts sent by Enviar alterações;
   assembling, reserving and plans are operation: confirmed in a dialog and sent right after saving. */
(()=>{
 'use strict';if(window.DOCE_MODE!=='admin')return;
 const P=DocePantry,K=DoceKits,clone=v=>JSON.parse(JSON.stringify(v));
 const fail=e=>notify(e.message||String(e),'error');
 const qty=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v);
 const percent=v=>new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1}).format(v);
 const product=id=>db.products.find(p=>p.id===id);
 const icon=(name,text)=>flowSvg(name)+' <span>'+esc(text)+'</span>';
 // Sends only what the server already knows; otherwise the draft has to be sent first.
 function assertPublished(kit){
  const known=window.DoceKitSync?.published;if(!known)return;
  for(const id of [kit.product,...kit.items.map(l=>l.product)])if(!known(id))throw Error('Toque em Enviar alterações para publicar este kit e seus produtos antes de montar ou preparar.');
 }
 // The sale balance may have changed with customer orders since this screen opened.
 async function freshStock(){try{await window.DoceKitSync?.refreshStock();}catch{/* Offline: decides on this device's balance; the server still keeps sales. */}}
 function operate(action,done){try{action();save();closeForm();render();notify(done);}catch(e){fail(e);}}
 function economicsHtml(e){
  const parts=[['Custo do kit',money(e.total)],['Preço de venda',money(e.price)],['Lucro por kit',money(e.profit)],['Margem',percent(e.margin)]];
  return `<div class="kit-numbers">${parts.map(([l,v])=>`<div><small>${l}</small><b>${v}</b></div>`).join('')}</div>${e.loose>0?`<p class="muted tiny">Vendendo os produtos separados daria ${money(e.loose)}${e.saving>0?` · o cliente economiza ${percent(e.saving)}`:''}.</p>`:''}`;
 }
 function capacityHtml(c){
  return `<p>Dá para montar agora: <b>${qty(c.count)} kit(s)</b> com o saldo de venda e a despensa.</p>${c.limiting.length?`<p class="muted tiny">Limita: ${c.limiting.map(l=>esc(l.name)).join(', ')}.</p>`:''}`;
 }
 function planHtml(plan){
  let v;try{v=K.planView(db,plan);}catch(e){return `<div class="note">${esc(e.message)}</div>`;}
  const rows=v.components.map(c=>`<div class="kit-plan-line"><div><b>${esc(c.name)}</b><p class="muted tiny">Precisa: ${qty(c.need)} un · Reservado: ${qty(c.reserved)} un · Falta: ${qty(c.toMake)} un · Saldo de venda: ${qty(c.free)} un</p>${c.toMake&&!c.recipeId?'<p class="muted tiny">Sem ficha técnica: use o saldo de venda ou cadastre a ficha em Produção.</p>':''}</div>${c.toMake?`<div class="kit-actions">${c.recipeId?`<button class="btn" onclick="kitProduce(${plan.id},${c.product})">${icon('chef-hat','Produzir para o kit')}</button>`:''}${c.free?`<button class="btn" onclick="kitReserve(${plan.id},${c.product})">${icon('package-check','Usar do saldo')}</button>`:''}</div>`:''}</div>`).join('');
  const all=v.ready&&v.ready===v.remaining,label=!v.ready?'Montar kits':all?'Montar '+(v.ready>1?'os '+qty(v.ready)+' kits':'o kit'):'Montar '+(v.ready>1?'os '+qty(v.ready)+' prontos':'o 1 pronto');
  const step=n=>`<span class="kit-step${(n===1&&!v.ready)||(n===2&&v.ready)?' current':''}">${n}. ${n===1?'Reservar ou produzir':'Montar'}</span>`;
  return `<section class="kit-plan" aria-label="Preparo de ${plan.target} kits"><h4>Preparo de ${qty(plan.target)} kits</h4><p class="kit-progress">${step(1)} → ${step(2)}</p><p class="muted tiny"><b>${qty(v.ready)} de ${qty(v.remaining)}</b> pronto(s) para montar${plan.assembled?' · '+qty(plan.assembled)+' já montado(s)':''}</p>${rows}${v.errors.map(t=>`<div class="note">${esc(t)}</div>`).join('')}${v.missing.length?`<div class="note"><b>Falta comprar:</b> ${v.missing.map(x=>esc(x.name)+' '+qty(x.missing)+' '+esc(x.unit)).join(', ')} · estimativa ${money(v.missingCost)}</div>`:'<p class="muted tiny">A despensa cobre o que falta, sujeito ao consumo de outras produções.</p>'}<div class="kit-actions"><button class="btn primary" ${v.ready?'':'disabled'} onclick="kitAssembleReady(${plan.kit},${plan.id})">${icon('package-check',label)}</button>${v.ready>1?`<button class="btn" onclick="kitAssemble(${plan.kit},${plan.id})">${icon('edit','Outra quantidade')}</button>`:''}<button class="btn" onclick="kitCancelPlan(${plan.id})">${icon('workflow','Encerrar e liberar reserva')}</button></div></section>`;
 }
 function cardHtml(kit){
  const p=product(kit.product);if(!p)return '';
  try{
   const e=K.economics(db,kit,p.price),c=K.capacity(db,kit),plans=db.kitPlans.filter(x=>x.kit===kit.id&&x.status==='open');
   const parts=[...kit.items.map(l=>qty(l.qty)+' '+esc(product(l.product)?.name||'Produto')),...kit.supplies.map(l=>{const i=db.pantry.find(i=>i.id===l.id);return qty(l.qty)+' '+esc(i?.unit==='un'?i.name:(i?.unit||'')+' de '+(i?.name||'insumo'));})];
   return `<article class="panel kit-card"><div class="row"><h3>${esc(p.name)}</h3><span class="pill">${qty(p.stock||0)} pronto(s)</span></div><p class="muted tiny">${parts.join(' · ')}</p>${economicsHtml(e)}${capacityHtml(c)}<div class="kit-actions"><button class="btn primary" ${c.count?'':'disabled'} onclick="kitAssemble(${kit.id})">${icon('package-check','Montar agora com o estoque')}</button><button class="btn" onclick="kitPlan(${kit.id})">${icon('clipboard-list','Planejar kits (produzir ou reservar)')}</button><button class="btn" onclick="editKit(${kit.id})">${icon('edit','Editar ficha')}</button>${p.stock>0?`<button class="btn" onclick="kitDisassemble(${kit.id})">${icon('workflow','Desmontar')}</button>`:''}</div>${plans.map(planHtml).join('')}</article>`;
  }catch(error){return `<article class="panel"><p>${esc(p.name)}: ${esc(error.message)}</p><button class="btn" onclick="editKit(${kit.id})">${icon('edit','Revisar ficha')}</button></article>`;}
 }
 function historyHtml(){
  const rows=db.kitAssemblies.slice(-30).reverse().map(a=>`<p><b>${esc(product(a.product)?.name||'Kit')}</b> · ${new Date(a.at).toLocaleString('pt-BR')} · ${a.kind==='disassembly'?'Desmontados':'Montados'}: ${qty(a.qty)}${a.kind==='assembly'?' · custo por kit '+money(a.unitCost)+(a.plan?' · do preparo':' · do saldo de venda'):''}</p>`).join('');
  return rows?`<details class="panel"><summary>Histórico de montagem</summary>${rows}</details>`:'';
 }
 window.adminKits=function(){
  P.migrate(db);P.reconcile(db);
  return `<div class="section"><h2>Kits</h2><button class="btn primary" onclick="editKit()">${icon('plus-circle','Novo kit')}</button></div><div class="note">A ficha do kit é o molde: crie uma vez e use sempre que quiser montar. Para montar, use <b>Montar agora com o estoque</b> com os doces à venda, ou <b>Planejar kits</b> para dizer quantos quer: o que for produzido ou reservado para eles sai do saldo de venda, e depois é só montar.</div>${db.kits.map(cardHtml).join('')||'<div class="panel">Crie um kit escolhendo os produtos da loja e os insumos, como caixinha, etiqueta e laço. Cadastre os insumos na Despensa.</div>'}${historyHtml()}`;
 };
 // ---- Kit definition -------------------------------------------------------------------
 function readKit(form,id){
  const f=new FormData(form),old=db.kits.find(k=>k.id===id);
  const items=db.products.filter(p=>!p.isKit).map(p=>({product:p.id,qty:Number(f.get('item_'+p.id))})).filter(l=>l.qty>0);
  const supplies=db.pantry.filter(i=>i.category==='packaging').map(i=>({id:i.id,qty:Number(f.get('sup_'+i.id))})).filter(l=>l.qty>0);
  return {id:old?.id||0,product:old?.product||0,items,supplies,extraCost:Number(f.get('extraCost'))||0};
 }
 window.kitPreview=function(id){
  const form=document.getElementById('kit-form'),host=document.getElementById('kit-preview');if(!form||!host)return;
  try{host.innerHTML=economicsHtml(K.economics(db,readKit(form,id),new FormData(form).get('price')));}catch{host.innerHTML='<p class="muted tiny">Escolha os produtos para ver custo e margem.</p>';}
 };
 let kitEditor=null;const priorClose=closeModal;closeModal=function(){return kitEditor?kitEditor.exit():priorClose();};
 function closeForm(){priorClose();}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&kitEditor&&!document.querySelector('.recipe-exit-dialog[open]')){event.preventDefault();void kitEditor.exit();}});
 window.editKit=function(id){
  P.migrate(db);P.reconcile(db);
  if(!id&&window.ElumePlan&&(!ElumePlan.allow('kits',db.kits.length)||!ElumePlan.allow('products',db.products.length)))return;
  const k=db.kits.find(k=>k.id===id)||{items:[],supplies:[],extraCost:0},p=product(k.product)||{};
  const group=(kind,title)=>{const rows=db.pantry.filter(i=>(i.category==='packaging')===(kind==='packaging')&&(i.active!==false||k.supplies.some(l=>l.id===i.id)));return rows.length?`<h4>${title}</h4>`+rows.map(i=>`<label class="field">${esc(i.name)} (${esc(i.unit)}) · saldo ${qty(i.qty)}${i.active===false?' · <b>desativado</b>: zere e use a embalagem atual':''}<input name="sup_${i.id}" type="number" min="0" step=".001" value="${k.supplies.find(l=>l.id===i.id)?.qty||0}" oninput="kitPreview(${id||0})"></label>`).join(''):'';};
  showModal(`<div class="recipe-editor-head"><h2>Ficha do kit</h2><div class="recipe-editor-tools"><button type="submit" form="kit-form" class="btn primary recipe-icon-action" aria-label="Salvar ficha" title="Salvar ficha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/></svg></button><button type="button" class="btn recipe-icon-action" onclick="closeModal()" aria-label="Sair da ficha do kit" title="Sair da ficha do kit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div></div><form id="kit-form" class="stack" onsubmit="saveKit(event)"><div class="recipe-editor-fields"><label class="field">Nome do kit<input name="name" required maxlength="100" value="${esc(p.name||'')}"></label><label class="field">Preço de venda (R$)<input name="price" type="number" min=".01" step=".01" required value="${p.price||''}" oninput="kitPreview(${id||0})"></label><div id="kit-preview" aria-live="polite"></div><h4>Produtos do kit</h4>${db.products.filter(x=>!x.isKit).map(x=>`<label class="field">${esc(x.name)} · saldo ${qty(x.stock||0)} · custo ${money(P.componentCost(x))}<input name="item_${x.id}" type="number" min="0" step="1" value="${k.items.find(l=>l.product===x.id)?.qty||0}" oninput="kitPreview(${id||0})"></label>`).join('')||'<div class="note">Cadastre produtos no Catálogo antes de criar o kit.</div>'}${group('packaging','Embalagens')}${db.pantry.some(i=>i.category==='packaging')?'':'<h4>Embalagens</h4><div class="note">Nenhuma embalagem cadastrada. Cadastre caixinha, etiqueta e laço na Despensa, com o tipo Embalagem.</div>'}${(()=>{const off=k.supplies.map(l=>db.pantry.find(i=>i.id===l.id)).filter(i=>i&&i.category!=='packaging');return off.length?`<div class="note">${off.map(i=>esc(i.name)).join(', ')} não ${off.length>1?'são embalagens':'é embalagem'} e ${off.length>1?'saem':'sai'} da ficha ao salvar. Se for embalagem, mude o tipo na Despensa.</div>`:'';})()}<label class="field">Outros custos por kit (R$)<input name="extraCost" type="number" min="0" step=".01" required value="${k.extraCost||0}" oninput="kitPreview(${id||0})"></label><p class="muted tiny">Opcional: mão de obra ou outros custos estimados. Saldo e custo médio dos insumos vêm da Despensa.</p></div></form>`);
  const form=document.getElementById('kit-form');document.querySelector('#modalhost .modal').classList.add('recipe-editor');window.kitPreview(id||0);
  kitEditor=DoceFormExit.create({snapshot:()=>JSON.stringify([...new FormData(form).entries()]),choose:DoceFormExit.chooseRecipeExit,persist:()=>persistKit(form,id),close:()=>{kitEditor=null;priorClose();render();},onError:fail});
  window.saveKit=function(event){event.preventDefault();return kitEditor?.save({closeAfter:false});};
 };
 async function persistKit(form,id){
  if(!form.reportValidity())return false;
  const f=new FormData(form),name=String(f.get('name')||'').trim(),price=Number(f.get('price')),before=clone({kits:db.kits,products:db.products,nextId:db.nextId});
  if(!name||!Number.isFinite(price)||price<=0)throw Error('Revise nome e preço.');
  try{
   const kit=readKit(form,id);let p=product(kit.product);
   K.validate(db,{...kit,product:p?.id||-1});
   if(p)Object.assign(p,{name,price});
   else{p={id:db.nextId++,name,cat:'Kits',desc:'',price,priceBasis:'unit',cost:0,stock:0,minQty:1,qtyStep:1,emoji:'🎁',image:'',active:true,isKit:true};db.products.push(p);kit.product=p.id;}
   const n=db.kits.findIndex(k=>k.id===id);
   if(n<0){kit.id=Date.now();db.kits.push(kit);id=kit.id;}else db.kits[n]=kit;
   P.reconcile(db);await save();notify('Ficha do kit salva. Envie as alterações para publicar.');return true;
  }catch(e){Object.assign(db,before);throw e;}
 }
 // ---- Operation ------------------------------------------------------------------------
 const kitById=id=>db.kits.find(k=>k.id===id),planById=id=>db.kitPlans.find(p=>p.id===id);
 function form(title,intro,field,submit,onSubmit){
  window.kitFormSubmit=event=>{event.preventDefault();try{onSubmit(new FormData(event.target));}catch(e){fail(e);}};
  showModal(`<h2>${esc(title)}</h2>${intro}<form class="stack" onsubmit="kitFormSubmit(event)">${field}<button class="btn primary full">${esc(submit)}</button><button type="button" class="btn full" onclick="closeModal()">Voltar</button></form>`);
 }
 window.kitAssemble=async function(id,planId){
  try{
   const kit=kitById(id),plan=planId?planById(planId):null;assertPublished(kit);await freshStock();
   const view=plan?K.planView(db,plan):null,max=plan?view.ready:K.capacity(db,kit).count,name=product(kit.product).name;
   if(!max)return notify(plan?'Ainda não há reserva e insumos para um kit.':'O saldo atual não monta nenhum kit.','error');
   form('Montar '+name,`<p>${plan?'Usa a reserva deste preparo e os insumos da despensa.':'Usa o saldo de venda dos produtos e os insumos da despensa.'} Dá para montar até <b>${qty(max)}</b>.</p>`,`<label class="field">Kits a montar<input name="qty" type="number" min="1" max="${max}" step="1" required value="${max}"></label>`,'Revisar montagem',f=>confirmAssemble(id,planId,Number(f.get('qty'))));
  }catch(e){fail(e);}
 };
 // Review dialog for a quantity already chosen; nothing changes before Montar kits.
 function confirmAssemble(id,planId,n){
  const copy=clone(db),result=K.assemble(copy,copy.kits.find(k=>k.id===id),n,planId?copy.kitPlans.find(p=>p.id===planId):null);
  showConfirm('Montar '+qty(n)+' kit(s)','Custo total '+money(result.cost)+' · '+money(result.unitCost)+' por kit',()=>operate(()=>K.assemble(db,kitById(id),n,planId?planById(planId):null),qty(n)+' kit(s) montado(s) e disponíveis para venda.'),'Montar kits',[...result.components.map(c=>c.name+': '+qty(c.qty)+' un'),...result.supplies.map(c=>c.name+': '+qty(c.qty)+' '+c.unit)].join(' | '));
 }
 // The plan already says how many kits: assemble everything ready, straight to the review.
 window.kitAssembleReady=async function(id,planId){
  try{
   const kit=kitById(id),plan=planById(planId);assertPublished(kit);await freshStock();
   const ready=K.planView(db,plan).ready;
   if(!ready)return notify('Ainda não há reserva e insumos para um kit.','error');
   confirmAssemble(id,planId,ready);
  }catch(e){fail(e);}
 };
 window.kitPlan=function(id){
  try{
   const kit=kitById(id);assertPublished(kit);
   form('Planejar kits',`<p>Informe quantos kits de <b>${esc(product(kit.product).name)}</b> quer ter. O sistema mostra o que falta produzir e comprar, e a produção fica reservada para eles. Depois é só tocar em Montar: a quantidade já vem deste plano.</p>`,'<label class="field">Quantidade de kits<input name="qty" type="number" min="1" step="1" required value="10"></label>','Ver o que precisa',f=>{
    const n=Number(f.get('qty'));operate(()=>K.createPlan(db,kit,n),'Preparo de '+qty(n)+' kit(s) criado.');
   });
  }catch(e){fail(e);}
 };
 window.kitProduce=function(planId,productId){
  try{
   const plan=planById(planId),c=K.planView(db,plan).components.find(c=>c.product===productId),recipe=db.recipes.find(r=>r.id===c.recipeId);
   form('Produzir '+c.name+' para o kit',`<p>Falta reservar <b>${qty(c.toMake)} un</b>. Cada receita rende ${qty(recipe.yieldQty)} un. Só o que passar do necessário entra no saldo de venda.</p>`,`<label class="field">Receitas a produzir<input name="batches" type="number" min="1" step="1" required value="${c.batches||1}"></label>`,'Revisar produção',f=>{
    const n=Number(f.get('batches')),copy=clone(db),r=K.produceForPlan(copy,copy.kitPlans.find(p=>p.id===planId),productId,n),extra=r.units-r.reservedUnits;
    showConfirm('Produzir para o kit',qty(r.units)+' un · custo do lote '+money(r.cost),()=>operate(()=>K.produceForPlan(db,planById(planId),productId,n),'Produção reservada para o kit.'),'Registrar produção',qty(r.reservedUnits)+' un reservadas'+(extra?' | '+qty(extra)+' un no saldo de venda':'')+' | '+r.ingredients.map(x=>x.name+': '+qty(x.qty)+' '+x.unit).join(' | '));
   });
  }catch(e){fail(e);}
 };
 window.kitReserve=async function(planId,productId){
  try{
   await freshStock();const plan=planById(planId),c=K.planView(db,plan).components.find(c=>c.product===productId),max=Math.min(c.toMake,c.free);
   if(!max)return notify('Sem saldo de venda deste produto agora.','error');
   form('Usar saldo de '+c.name,'<p>Estas unidades saem do saldo de venda e ficam reservadas para o kit. Os clientes deixam de poder comprá-las.</p>',`<label class="field">Unidades a reservar<input name="qty" type="number" min="1" max="${max}" step="1" required value="${max}"></label>`,'Reservar',f=>{
    const n=Number(f.get('qty'));operate(()=>K.reserveFromStock(db,planById(planId),productId,n),qty(n)+' un reservadas para o kit.');
   });
  }catch(e){fail(e);}
 };
 window.kitCancelPlan=function(planId){
  const plan=planById(planId);if(!plan)return;
  const total=Object.values(plan.reserved||{}).reduce((s,x)=>s+x.qty,0);
  showConfirm('Encerrar preparo',total?qty(total)+' un reservadas voltam para o saldo de venda.':'Não há unidades reservadas.',()=>operate(()=>K.cancelPlan(db,planById(planId)),'Preparo encerrado.'),'Encerrar preparo','Os kits já montados continuam à venda.');
 };
 window.kitDisassemble=function(id){
  try{
   const kit=kitById(id),p=product(kit.product);assertPublished(kit);
   form('Desmontar '+p.name,`<p>Os produtos voltam para o saldo de venda. Os insumos usados, como caixinha e laço, não voltam para a despensa e ficam como perda.</p>`,`<label class="field">Kits a desmontar<input name="qty" type="number" min="1" max="${p.stock}" step="1" required value="1"></label>`,'Revisar',f=>{
    const n=Number(f.get('qty'));K.disassemble(clone(db),clone(kit),n);
    showConfirm('Desmontar '+qty(n)+' kit(s)','Os produtos voltam ao saldo de venda; os insumos usados ficam como perda.',()=>operate(()=>K.disassemble(db,kitById(id),n),qty(n)+' kit(s) desmontado(s).'),'Desmontar');
   });
  }catch(e){fail(e);}
 };
 // A kit's cost comes from its ficha, and it is never the product of a recipe.
 const priorEditProduct=editProduct;editProduct=function(id){priorEditProduct(id);if(db.kits?.some(k=>k.product===id)){const input=document.querySelector('#productPriceForm [name="cost"]');if(input){input.readOnly=true;const note=document.createElement('small');note.className='muted';note.textContent='Calculado pela ficha do kit e pela despensa. Edite em Kits.';input.after(note);}}};
 const priorEditRecipe=editRecipe;editRecipe=function(id){priorEditRecipe(id);for(const option of document.querySelectorAll('#recipe-form [name="product"] option'))if(product(Number(option.value))?.isKit)option.remove();};
})();
