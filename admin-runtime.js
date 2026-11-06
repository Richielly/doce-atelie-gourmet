/* Configuration waits in the draft for Enviar alterações. Operation (order status, quotes, stock,
   pantry, production and order calendar) is confirmed or saved by the merchant and sent at once.
   Nothing pending is sent by opening, reloading or reconnecting. */
(()=>{
 'use strict';
 if(window.DOCE_MODE!=='admin')return;
 const fields=['products','orders','settings','nextId','pantry','pantryEntries','pantryLots','pantryMovements','recipes','production','allocations','loyalty','quotes','booking','branding','loyaltyAccounts','loyaltyVouchers'];
 // Fields the customer depends on in real time, or that record what already happened.
 const OPERATIONAL=['orders','pantry','pantryEntries','pantryLots','pantryMovements','production','allocations','booking','loyaltyAccounts','loyaltyVouchers'];
 const clone=value=>JSON.parse(JSON.stringify(value)),drafts=DoceTenants.create(localStorage);
 const published={config:'',ops:''};let publishing=Promise.resolve();
 const sync={businessType:'confectionery',productSales:true,store:null,token:'',expires:0,revision:0,dirty:false,running:false,error:'',sequence:0,operations:[],apiIds:new Map(),derivedChanges:false,unsent:false};
 let onlineOrders=[],activity={quotes:[],customers:[]},draftWrite=Promise.resolve();
 try{if(!localStorage.getItem('doce-legacy-snapshot-v1')&&localStorage.getItem('doce-atelier-v1'))localStorage.setItem('doce-legacy-snapshot-v1',localStorage.getItem('doce-atelier-v1'));}catch{/* The original legacy key is never modified by this runtime. */}
 const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
 function snapshot(){const data=Object.fromEntries(fields.filter(k=>db[k]!==undefined).map(k=>[k,clone(db[k])]));data.products=data.products.map(p=>({...p,...((p.apiId||sync.apiIds.get(p.id))?{apiId:p.apiId||sync.apiIds.get(p.id)}:{})}));return data;}
 function part(src,operational){
  const out={};for(const k of fields)if(src[k]!==undefined&&OPERATIONAL.includes(k)===operational&&k!=='products')out[k]=src[k];
  const list=src.products||[];
  if(operational)out.stock=list.filter(p=>p.apiId||sync.apiIds.get(p.id)).map(p=>[p.apiId||sync.apiIds.get(p.id),p.stock]);
  else out.products=list.map(({stock,stockBase,...p})=>p);
  return JSON.stringify(out);
 }
 function rebase(src){published.config=part(src,false);published.ops=part(src,true);}
 function baseline(data,shop){const t={...DoceTenants.blank(shop),...clone(data)};try{DocePantry.reconcile(t);}catch{}return t;}
 function configChanged(){return part(db,false)!==published.config;}
 function operationalChanged(){return part(db,true)!==published.ops;}
 function remember(){
  if(!sync.store)return Promise.resolve();
  const store=clone(sync.store),draft={data:snapshot(),revision:sync.revision,dirty:sync.dirty,sequence:sync.sequence,operations:clone(sync.operations)};
  draftWrite=draftWrite.catch(()=>{}).then(()=>DoceAdminDrafts.save(store,draft));
  draftWrite.catch(()=>{sync.error='Não foi possível guardar o rascunho. Exporte uma cópia antes de sair.';banner();});
  return draftWrite;
 }
 function apply(data,shop){if(shop)sync.businessType=shop.business_type||'confectionery';db={...DoceTenants.blank(shop),...clone(data),customer:{name:'',phone:'',address:'',notes:''}};for(const p of db.products)if(p.apiId)sync.apiIds.set(p.id,p.apiId);const beforeCosting=JSON.stringify(db);DocePantry.reconcile(db);sync.derivedChanges=JSON.stringify(db)!==beforeCosting;document.documentElement.style.setProperty('--p',db.settings.color||'#a84e6e');}
 function syncLabel(){return sync.running?'Enviando alterações…':sync.error?'Não enviado: '+sync.error:sync.dirty?'Configurações em rascunho neste aparelho. Envie para publicar.':'Configurações publicadas · revisão '+sync.revision+'. Pedidos, estoque e produção são enviados na hora.';}
 function failSync(error){sync.error=error.message;banner();notify(error.message,'error');}
 function banner(){
  window.DoceAdminSync?.mount({dirty:!!admin&&sync.dirty,running:sync.running,onSend:send,onError:failSync});
  const status=document.getElementById('adminSyncStatus');if(status)status.textContent=syncLabel();
  const button=document.getElementById('adminConfigSend');if(button)button.disabled=sync.running||!sync.dirty;
 }
 window.reloadAdminStore=()=>reload().catch(failSync);
 window.publishAdminDraft=()=>send().catch(failSync);
 function salonUrl(){const url=new URL('salon.html',document.baseURI);url.searchParams.set('shop',sync.store.id);url.searchParams.set('api',sync.store.api);url.searchParams.set('role','admin');return url.href;}

 save=function(){
  if(!sync.store||!admin)return;
  sync.sequence++;
  const operational=operationalChanged();
  sync.dirty=sync.dirty||configChanged();
  const pending=remember();banner();window.DoceNotify?.draft(sync.store,sync.dirty);
  if(operational&&!sync.unsent)void publishNow([],'Registro enviado. Clientes e outros aparelhos já veem a atualização.').catch(failOperational);
  return DoceLoading.run(pending);
 };
 function failOperational(error){
  // Kept on this device and in the draft: only Enviar alterações or a new confirmation sends it.
  sync.unsent=true;sync.dirty=true;remember();banner();window.DoceNotify?.draft(sync.store,true);
  notify(error.message+' A alteração ficou salva neste aparelho; use Enviar alterações para tentar de novo.','error');
 }
 /* Sends operation now: the published server copy plus this device's operational fields and
    the given order/quote operations. Configuration still waiting in the draft is not sent. */
 function publishNow(operations=[],done){
  const run=async()=>{
   const remote=await request(prefix()+'/workspace');
   if(!remote.data)throw Error('Publique as configurações iniciais da loja com Enviar alterações antes de registrar a operação.');
   const current=(remote.admin_revision??remote.revision)<=sync.revision,payload=clone(remote.data),local=snapshot(),overlay=operationalChanged();
   for(const k of ['orders','settings','branding','nextId'])if(payload[k]===undefined)payload[k]=clone(local[k]);
   if(overlay){
    if(!current)throw Error('Outro aparelho publicou alterações desta loja. Toque em Atualizar do servidor antes de registrar esta movimentação.');
    for(const k of OPERATIONAL)if(local[k]!==undefined)payload[k]=clone(local[k]);
    for(const p of payload.products){const mine=local.products.find(x=>x.apiId===p.apiId);if(mine&&Number.isInteger(mine.stockBase)){p.stock=mine.stock;p.stockBase=mine.stockBase;}}
   }
   const endLoading=DoceLoading.begin();
   try{
    const result=await request(prefix()+'/workspace','PUT',{revision:remote.revision,data:payload,operations});
    for(const k of OPERATIONAL)if(result.data[k]!==undefined)db[k]=clone(result.data[k]);
    for(const p of db.products){const stored=result.data.products.find(x=>x.apiId===(p.apiId||sync.apiIds.get(p.id)));if(stored){p.stock=stored.stock;p.stockBase=stored.stockBase;}}
    published.ops=part(result.data,true);
    // The draft keeps its configuration; its base moves forward only if nobody else published meanwhile.
    if(current){sync.revision=result.revision;if(!sync.dirty)published.config=part(result.data,false);}
    remember();await live().catch(()=>{});render();if(done)notify(done);
    return result;
   }finally{endLoading();}
  };
  const next=publishing.catch(()=>{}).then(run);publishing=next;return next;
 }
 function confirmAction(title,lines,accept){
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='action-confirm';dialog.setAttribute('aria-label',title);
   const h=document.createElement('h2');h.textContent=title;
   const body=document.createElement('div');body.className='action-confirm-body';for(const line of lines){const p=document.createElement('p');p.textContent=line;body.append(p);}
   const actions=document.createElement('div');actions.className='action-confirm-actions';
   const back=document.createElement('button');back.type='button';back.className='btn';back.textContent='Voltar';
   const ok=document.createElement('button');ok.type='button';ok.className='btn primary';ok.textContent=accept||'Confirmar e enviar';
   let settled=false;const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};
   back.onclick=()=>finish(false);ok.onclick=()=>finish(true);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
   actions.append(back,ok);dialog.append(h,body,actions);document.body.append(dialog);dialog.showModal();back.focus();
  });
 }
 async function keys(){
  const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('doce-atelie-admin-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{const tx=database.transaction('keys','readonly'),store=tx.objectStore('keys'),name='doce-admin-key-'+sync.store.id+'@'+sync.store.api;const privateKey=store.get(name),publicKey=store.get(name+'-public');tx.oncomplete=()=>resolve({privateKey:privateKey.result,publicKey:publicKey.result});tx.onerror=()=>reject(tx.error);});}finally{database.close();}
 }
 async function request(path,method='GET',body,auth=true){
  if(auth&&Date.now()>=sync.expires)await authenticate();
  let response;try{response=await fetch(sync.store.api+path,{method,cache:'no-store',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:'Bearer '+sync.token}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('Servidor indisponível. O rascunho foi preservado neste aparelho.');}
  const data=await response.json();if(!response.ok){if(response.status===401)sync.expires=0;throw Error(typeof data.detail==='string'?data.detail:'Não foi possível concluir a operação.');}return data;
 }
 function prefix(){return '/admin/shops/'+encodeURIComponent(sync.store.id);}
 window.adminApi={key:()=>JSON.stringify([sync.store.api,sync.store.id]),name:()=>sync.store.name||db.settings.name,request:(path,method='GET',body)=>DoceLoading.run(()=>request(prefix()+path,method,body))};
 async function authenticate(){
  const pair=await keys();if(!pair.privateKey||!pair.publicKey)throw Error('Ative este aparelho para a loja antes de entrar.');
  const base='/auth/shops/'+encodeURIComponent(sync.store.id),public_key=hex(await crypto.subtle.exportKey('raw',pair.publicKey));
  const challenge=await request(base+'/challenge','POST',{public_key},false);
  const signature=hex(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(challenge.nonce)));
  const session=await request(base+'/session','POST',{...challenge,signature},false);sync.token=session.access_token;sync.expires=Date.now()+session.expires_in_seconds*1000-10000;
 }
 function products(list){return list.map((p,i)=>({id:i+1,apiId:p.id,name:p.name,cat:'Produtos',desc:'',price:p.price_cents/100,cost:0,stock:p.stock,minQty:p.min_qty,qtyStep:p.increment,image:p.photo_url||'',emoji:'🛍️',active:p.enabled}));}
 async function allOrders(){const all=new Map();let offset=0;while(true){const page=await request(prefix()+'/orders?limit=100&offset='+offset);for(const order of page)all.set(order.id,order);if(page.length<100)break;offset+=100;}return [...all.values()];}
 async function live(){const result=await Promise.all([allOrders(),request(prefix()+'/customer-activity')]);onlineOrders=result[0];activity=result[1];}
 // Servers before 0.20.0 have no plans: nothing is limited on the device.
 async function plan(){try{window.ElumePlan?.set(await request(prefix()+'/plan'));}catch{window.ElumePlan?.set(null);}}
 async function send(){
  if(!sync.dirty||sync.running)return;
  const sequence=sync.sequence,data=snapshot(),operations=clone(sync.operations);sync.running=true;sync.error='';banner();const endLoading=DoceLoading.begin();
  try{
   const result=await request(prefix()+'/workspace','PUT',{revision:sync.revision,data,operations});sync.revision=result.revision;
   if(sync.sequence===sequence){apply(result.data);rebase(result.data);sync.dirty=sync.derivedChanges;sync.unsent=false;sync.operations=[];}
   else{for(const product of db.products){const stored=result.data.products.find(p=>p.id===product.id);if(stored)product.apiId=stored.apiId;}sync.operations=sync.operations.filter(op=>!operations.some(sent=>sent.id===op.id&&sent.kind===op.kind&&JSON.stringify(sent)===JSON.stringify(op)));}
   remember();await live();render();notify('Alterações enviadas. A loja já está atualizada para os clientes.');
  }catch(e){sync.error=e.message;sync.dirty=true;remember();throw e;}
  finally{sync.running=false;banner();window.DoceNotify?.draft(sync.store,sync.dirty);endLoading();}
 }
 window.sendAdminChanges=send;
 async function reload(){
  if(sync.running)return;
  if(sync.dirty&&!confirm('Substituir o rascunho deste aparelho pela versão do servidor? Você pode exportar o rascunho antes.'))return;
  const endLoading=DoceLoading.begin();try{
  const remote=await request(prefix()+'/workspace'),catalog=await request(prefix()+'/products');sync.productSales=catalog.modules?.products!==false;
  apply(remote.data||DoceTenants.blank(catalog.shop,products(catalog.products)),catalog.shop);rebase(db);sync.revision=remote.revision;sync.operations=[];sync.dirty=sync.derivedChanges;sync.unsent=false;sync.error='';sync.sequence++;remember();await Promise.all([live(),plan()]);render();banner();
  }finally{endLoading();}
 }
 async function enter(importLocal=false){
  if(sync.running)return;
  const endLoading=DoceLoading.begin();
  try{
   const store=DoceStores.parse(document.getElementById('panelShop').value,document.getElementById('panelApi').value);
   sync.store=store;sync.token='';sync.expires=0;await authenticate();
   const remote=await request(prefix()+'/workspace'),catalog=await request(prefix()+'/products');sync.productSales=catalog.modules?.products!==false;
   const base=remote.data||DoceTenants.blank(catalog.shop,products(catalog.products));sync.apiIds=new Map(base.products.filter(p=>p.apiId).map(p=>[p.id,p.apiId]));
   let pending=await DoceAdminDrafts.load(store)||drafts.load(store);
   if(!pending){try{const old=JSON.parse(localStorage.getItem('doce-pending-workspace:'+store.api+':'+store.id)||'null');if(old)pending={...old,dirty:true,sequence:0,operations:[]};}catch{}}
   rebase(baseline(base,catalog.shop));sync.unsent=false;
   apply(pending?.dirty?pending.data:base,catalog.shop);sync.revision=pending?.dirty?pending.revision:remote.revision;sync.operations=pending?.dirty?pending.operations||[]:[];sync.dirty=!!pending?.dirty||sync.derivedChanges;sync.sequence=pending?.sequence||0;sync.error='';
   if(importLocal){
    const file=document.getElementById('panelBackup').files[0];let imported;
    if(file){if(file.size>32*1024*1024)throw Error('Backup excede 32 MB.');imported=JSON.parse(await file.text());}
    else imported=JSON.parse(localStorage.getItem('doce-legacy-snapshot-v1')||localStorage.getItem('doce-atelier-v1')||'{}');
    if(!imported.settings||!Array.isArray(imported.products))throw Error('Nenhum backup local compatível. Selecione o backup JSON do aplicativo.');
    if(!confirm('Preparar os dados locais de '+imported.settings.name+' como rascunho de '+catalog.shop.name+'? Nada será publicado até clicar em Enviar alterações.'))return;
    const current=clone(base);for(const field of fields)if(Object.hasOwn(imported,field))current[field]=clone(imported[field]);
    const existing=base.products||[],known=new Set(existing.map(p=>p.apiId));
    let next=Math.max(0,...current.products.map(p=>Number(p.id)||0))+1;
    for(const p of current.products)if(p.apiId&&!known.has(p.apiId))delete p.apiId;
    for(const p of existing)if(!current.products.some(local=>local.apiId===p.apiId))current.products.push({...p,id:next++});
    current.settings.name=catalog.shop.name;current.nextId=Math.max(next,Number(current.nextId)||1);apply(current,catalog.shop);sync.dirty=true;sync.sequence++;
   }
   localStorage.setItem('doce-admin-last-store',JSON.stringify(store));
   // These compatibility values belong to the administration only; customers use a separate namespace.
   localStorage.setItem('doce-api-url',store.api);localStorage.setItem('doce-shop-id',store.id);
   admin=true;tab=new URLSearchParams(location.search).get('section')==='settings'?'settings':sync.businessType==='salon'?'adminmenu':'dashboard';page='home';cart={};remember();await Promise.all([live(),plan()]);closeModal();render();banner();
   const notifyStore={...store,name:db.settings.name};
   const ctx=window.DoceNotify?.connect({store:notifyStore,role:'admin',request:(suffix,method,body)=>{if(sync.store?.id!==store.id||sync.store?.api!==store.api)throw Error('Abra a administração desta loja para atualizar seus avisos.');return request('/admin/shops/'+encodeURIComponent(store.id)+'/notifications'+suffix,method,body);}});
   if(ctx)ctx.navigate=async target=>{if(target.screen==='salon'){location.href=DoceNotificationCore.route(store,'admin',target,document.baseURI);return;}tab=DoceNotificationCore.pages.admin[target.screen]||'dashboard';if(tab==='deliveries'||tab==='booking')await live();render();if(target.order_id)onlineOrderDetails(target.order_id);else window.DoceNotify?.focusTarget(target);};
   window.DoceNotify?.draft(notifyStore,sync.dirty);
   const notificationParams=new URLSearchParams(location.search),notificationTab=notificationParams.get('notification_page');
   if(['deliveries','booking','stock','pantry','dashboard','campaigns'].includes(notificationTab)){tab=notificationTab;render();if(notificationTab==='deliveries'&&notificationParams.get('notification_item'))onlineOrderDetails(notificationParams.get('notification_item'));else window.DoceNotify?.focusTarget({quote_id:notificationParams.get('notification_item')});}if(ctx)void window.DoceNotify.consume(ctx);

  }catch(e){notify(e.message,'error');}finally{endLoading();}
 }
 window.openConnectedPanel=enter;
 openAccess=async function(){
  if(admin){await remember();admin=false;sync.token='';sync.expires=0;banner();location.href='minhas-lojas.html';return;}
  let last;try{last=JSON.parse(localStorage.getItem('doce-admin-last-store')||'null');}catch{}
  const p=new URLSearchParams(location.search),store={api:p.get('api')||last?.api||((location.hostname!=='localhost'||location.port==='6001')?location.origin:''),id:p.get('shop')||last?.id||localStorage.getItem('doce-shop-id')||''};
  showModal('<h2>Administração da loja</h2><p>Somente o lojista configura este acesso. As alterações ficam como rascunho até serem enviadas.</p><label class="field">Servidor da loja<input id="panelApi" value="'+esc(store.api)+'" placeholder="https://servidor-da-loja.com"></label><label class="field">ID ou link da loja<input id="panelShop" value="'+esc(store.id)+'"></label><label class="field">Backup anterior, se precisar importar<input id="panelBackup" type="file" accept=".json,application/json"></label><div class="stack"><button class="btn primary full" onclick="openConnectedPanel()">Entrar na administração</button><button class="btn full" onclick="openConnectedPanel(true)">Preparar dados locais como rascunho</button><button class="btn full" onclick="configureAdminDevice()">Ativar celular ou computador</button><a class="btn full" href="minhas-lojas.html">Voltar à vitrine</a></div>');
 };
 window.configureAdminDevice=function(){location.href='gestao-conectada.html?api='+encodeURIComponent(document.getElementById('panelApi').value)+'&shop='+encodeURIComponent(document.getElementById('panelShop').value);};
 const originalMenu=adminMenu;adminMenu=function(){
  if(sync.businessType!=='salon')return originalMenu().replace('>Ajustes<','>Configurações<').replace('>Agenda<','>Encomendas e orçamentos<');
  const pages=[['storeqr','QR do estabelecimento','qr-code'],['branding','Identidade','palette'],['bonuses','Benefícios','gift'],['settings','Configurações','settings'],...(sync.productSales?[['products','Produtos','package-check'],['stock','Estoque de produtos','clipboard-list'],['deliveries','Pedidos de produtos','workflow']]:[])];
  return '<div class="section"><h2>Gestão do salão</h2></div><div class="admin-menu-grid"><a class="admin-menu-tile" href="'+esc(salonUrl())+'"><span class="admin-menu-icon">'+flowSvg('chart')+'</span><span>Gerenciar salão</span></a>'+pages.map(([id,label,icon])=>'<button class="admin-menu-tile" onclick="tab=\''+id+'\';render()"><span class="admin-menu-icon">'+flowSvg(icon)+'</span><span>'+label+'</span></button>').join('')+'</div>';
 };
 const originalRender=render;render=function(){
  const isSalon=admin&&sync.store&&sync.businessType==='salon';
  if(isSalon&&!['adminmenu','storeqr','branding','bonuses','settings',...(sync.productSales?['products','stock','deliveries']:[])].includes(tab))tab='adminmenu';
  originalRender();
  if(isSalon){const nav=document.getElementById('nav');nav.innerHTML='<button onclick="location.href=\''+esc(salonUrl())+'\'"><b>'+flowSvg('chart')+'</b><span>Meu painel</span></button><button class="'+(tab==='adminmenu'?'on':'')+'" onclick="tab=\'adminmenu\';render()"><b>'+flowSvg('settings')+'</b><span>Gestão</span></button><button class="'+(tab==='settings'?'on':'')+'" onclick="tab=\'settings\';render()"><b>'+flowSvg('settings')+'</b><span>Configurações</span></button>';}
  banner();window.ElumeArea?.show({role:'owner',name:db.settings.name,kind:sync.businessType});
 };
 const originalAdmin=renderAdmin;renderAdmin=function(){return originalAdmin().replace('Modo demonstração · acesso não protegido','Configurações vão por Enviar alterações · pedidos e estoque vão na hora');};
 const originalSettings=adminSettings;adminSettings=function(){
  let html=originalSettings().replace('<h3>Dados de demonstração</h3>','<h3>Backup do rascunho</h3>').replace(/<button class="btn danger"[\s\S]*?<\/button>/,'').replace('Sem autenticação real. Qualquer pessoa com acesso ao código pode alterar os dados locais. Para produção, use API, autenticação e autorização de papéis no servidor.','Configurações ficam disponíveis para clientes após Enviar alterações. Pedidos, orçamentos, estoque e produção são enviados na hora.');
  if(sync.businessType==='salon'&&!sync.productSales)html=html.replace(/<div class="two"><label class="field">Taxa de entrega[\s\S]*?<\/div><div class="field">Paletas/,'<div class="field">Paletas').replace(/<p class="muted tiny">\* Pedido mínimo[\s\S]*?<\/p>/,'');
  return '<div class="elume-platform-signature"><img src="elume-logo-horizontal.svg" alt="Elume Shop" width="240" height="74"></div><div class="panel stack"><h2>Sincronização e rascunho</h2><p>Tipo: <strong>'+(sync.businessType==='salon'?'Salão':'Doçaria')+'</strong> · definido no Master.</p><p id="adminSyncStatus" role="status">'+esc(syncLabel())+'</p><button id="adminConfigSend" class="btn primary full" onclick="publishAdminDraft()" '+(sync.running||!sync.dirty?'disabled':'')+'>Enviar alterações</button><button class="btn full" onclick="reloadAdminStore()">Atualizar do servidor</button><button class="btn full" onclick="exportData()">Exportar rascunho</button></div>'+html;
 };
 getStoreId=function(){return sync.store?.id||'';};
 qrImageUrl=function(){if(!sync.store)throw Error('Entre na administração da loja.');const code=qrcode(0,'M');code.addData(DoceStores.qr(sync.store));code.make();return code.createDataURL(8,32);};
 const originalStoreQr=storeQr;storeQr=function(){return originalStoreQr().replace('QR demonstrativo vinculado ao armazenamento deste navegador. Não use para divulgação comercial definitiva: a versão multi-loja precisará gerar o QR a partir de um identificador permanente registrado no servidor.','Este QR identifica a loja no servidor. O cliente vê as configurações publicadas e a operação registrada.');};
 async function sendOperation(operation,title,lines,done,accept){
  if(sync.running)return;
  if(!await confirmAction(title,lines,accept))return;
  try{await publishNow([operation],done);}catch(e){notify(e.message+' Nada foi alterado para o cliente.','error');await live().catch(()=>{});render();}
 }
 window.getProductionOrders=()=>onlineOrders.map(o=>({id:o.id,status:labels[o.status]||o.status,items:o.items.map(i=>({id:db.products.find(p=>p.apiId===i.product_id)?.id,qty:i.qty}))}));
 const labels={recebido:'Recebido',preparo:'Em preparo',pronto:'Pronto',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue',cancelado:'Cancelado'};
 function onlineFlow(o){
  const current=labels[o.status]||o.status,steps=flowConfig(o.details?.method||'Retirada'),done=['Entregue','Concluído'].includes(current);
  let index=steps.indexOf(current);if(done)index=steps.length-1;
  return '<div class="order-flow" role="group" aria-label="Etapas do pedido">'+steps.map((s,i)=>{const next=current!=='Cancelado'&&!done&&i===index+1,label=flowLabel(s);
   return '<div class="order-flow-step '+(i<index||done&&i===index?'flow-done':i===index?'flow-current':'flow-next')+'"><button type="button" '+(next?'onclick="advanceOnlineOrder('+esc(JSON.stringify(o.id))+','+i+')" title="Avançar para '+esc(label)+'" aria-label="Avançar para '+esc(label)+'"':'disabled title="'+esc(label)+'" aria-label="'+esc(label)+'"')+'>'+flowSvg(allFlowSteps()[s]?.[0])+'</button><small>'+esc(label)+'</small></div>';}).join('')+'</div>';
 }
 function onlineCard(o){
  const d=o.details||{},current=labels[o.status]||o.status,open=!['Entregue','Concluído','Cancelado'].includes(current);
  return '<article class="panel order-management-card"><div class="order-management-head"><div><strong>#'+esc(o.id.slice(0,6))+' · '+esc(d.customer?.name||'Cliente')+'</strong><small>'+esc(d.method||'Retirada')+(d.scheduledDate?' · '+esc(new Date(d.scheduledDate+'T12:00:00').toLocaleDateString('pt-BR')):'')+'</small></div><b>'+money(o.total_cents/100)+'</b></div><p>'+o.items.map(i=>i.qty+'× '+esc(i.name)).join(', ')+'</p>'+(current==='Cancelado'?'<p class="order-cancelled">Pedido cancelado</p>':onlineFlow(o))+'<div class="order-management-foot"><span>'+esc(current)+(d.customerOnWay?' · Cliente a caminho':'')+'</span><span class="order-actions"><button class="btn" onclick="onlineOrderDetails('+esc(JSON.stringify(o.id))+')">Detalhes</button>'+(current!=='Cancelado'?'<button class="btn" onclick="attachOrderPhoto('+esc(JSON.stringify(o.id))+')">📷 '+(d.readyPhoto?'Trocar foto':'Foto do pedido')+'</button>':'')+(d.readyPhoto?'<button class="btn" onclick="viewOrderPhoto('+esc(JSON.stringify(o.id))+')">Ver foto</button>':'')+''+(open?'<button class="btn danger" onclick="cancelOnlineOrder('+esc(JSON.stringify(o.id))+')">Cancelar pedido</button>':'')+'</span></div></article>';
 }
 const originalOrders=adminOrders;adminOrders=function(){
  const open=onlineOrders.filter(o=>!['entregue','cancelado'].includes(o.status));
  return '<div class="section"><h2>Pedidos dos clientes</h2><button class="btn" onclick="refreshOnlineOrders()">Atualizar pedidos</button></div><div class="order-stats"><div><strong>'+open.length+'</strong><small>Na fila</small></div><div><strong>'+open.filter(o=>o.status==='preparo').length+'</strong><small>Em preparo</small></div><div><strong>'+open.filter(o=>o.status==='pronto').length+'</strong><small>Prontos</small></div></div><p class="muted tiny">Toque no ícone da próxima etapa. Depois de confirmar, o cliente vê a mudança na hora.</p>'+(onlineOrders.map(onlineCard).join('')||'<div class="empty">Nenhum pedido de cliente ainda.</div>')+(db.orders.length?originalOrders():'');
 };
 function orderLines(o,from,to){const d=o.details||{};return ['Pedido #'+o.id.slice(0,6)+' · '+(d.customer?.name||'Cliente'),o.items.map(i=>i.qty+'× '+i.name).join(', '),'Etapa atual: '+from,'Nova etapa: '+to];}
 window.advanceOnlineOrder=function(id,index){
  const order=onlineOrders.find(o=>o.id===id);if(!order)return;
  const current=labels[order.status]||order.status,steps=flowConfig(order.details?.method||'Retirada');
  if(index!==steps.indexOf(current)+1)return notify('Avance uma etapa de cada vez.');
  const next=steps[index];
  void sendOperation({kind:'order_status',id,expected:order.status,status:next},'Confirmar nova etapa',[...orderLines(order,flowLabel(current),flowLabel(next)),'O cliente verá a nova etapa assim que você confirmar.'],'Pedido atualizado. O cliente já vê: '+flowLabel(next)+'.');
 };
 window.cancelOnlineOrder=function(id){
  const order=onlineOrders.find(o=>o.id===id);if(!order)return;
  void sendOperation({kind:'order_status',id,expected:order.status,status:'Cancelado'},'Cancelar este pedido?',[...orderLines(order,labels[order.status]||order.status,'Cancelado'),'Os itens voltam ao estoque e o cliente é avisado. Não é possível desfazer.'],'Pedido cancelado e cliente avisado.','Cancelar pedido');
 };
 window.stageOrderStatus=function(id,status){
  const order=onlineOrders.find(o=>o.id===id);if(!order)return;
  if(status==='Cancelado')return window.cancelOnlineOrder(id);
  const index=flowConfig(order.details?.method||'Retirada').indexOf(status);if(index>=0)window.advanceOnlineOrder(id,index);
 };
 window.setOnlineOrderStatus=window.stageOrderStatus;
 window.onlineOrderDetails=function(id){const order=onlineOrders.find(o=>o.id===id);if(!order)return;const d=order.details||{};showModal('<h2>Pedido #'+esc(id.slice(0,8))+'</h2><p><b>'+esc(d.customer?.name||'Cliente')+'</b></p><p>WhatsApp: '+esc(d.customer?.phone||'Não informado')+'</p><p>'+esc(d.method||'Retirada')+' · '+esc(d.address||'Retirada na loja')+'</p><p>Observações: '+esc(d.notes||'Nenhuma')+'</p><p>Pagamento: '+esc(d.payment||'A combinar')+' · '+esc(d.paymentStatus||'Não confirmado')+'</p>'+(d.scheduledDate?'<p>Agendado: '+esc(d.scheduledDate)+'</p>':'')+(d.voucherCode?'<p>Voucher: '+esc(d.voucherCode)+'</p>':'')+'<p>'+money(order.total_cents/100)+'</p><button class="btn full" onclick="closeModal()">Fechar</button>');};
 // The photo goes to the customer at once (operational), after the shop confirms it.
 window.attachOrderPhoto=function(id){
  const order=onlineOrders.find(o=>o.id===id);if(!order||sync.running)return;
  const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.setAttribute('capture','environment');
  input.onchange=async()=>{
   try{
    const file=input.files?.[0];if(!file)return;
    const image=await DoceImages.prepare(file,{maxSide:1280,maxBytes:450000});
    if(!await confirmAction('Enviar foto ao cliente?',['Pedido #'+id.slice(0,6)+' · '+(order.details?.customer?.name||'Cliente'),'O cliente recebe um aviso e vê a foto no acompanhamento do pedido.'+(order.details?.readyPhoto?' A foto anterior será substituída.':'')],'Enviar foto'))return;
    await DoceLoading.run(()=>request(prefix()+'/orders/'+encodeURIComponent(id)+'/photo','POST',{photo:image.src}));
    await live();render();notify('Foto enviada. O cliente já pode ver no pedido.');
   }catch(e){notify(e.message,'error');}
  };
  input.click();
 };
 window.viewOrderPhoto=async function(id){
  try{
   if(Date.now()>=sync.expires)await authenticate();
   const response=await fetch(sync.store.api+prefix()+'/orders/'+encodeURIComponent(id)+'/photo',{cache:'no-store',headers:{Authorization:'Bearer '+sync.token}});
   if(!response.ok)throw Error('Foto indisponível.');
   const url=URL.createObjectURL(await response.blob());
   showModal('<h2>Foto do pedido #'+esc(id.slice(0,6))+'</h2><figure class="order-photo"><img src="'+url+'" alt="Foto enviada ao cliente"></figure><button class="btn full" onclick="closeModal()">Fechar</button>');
  }catch(e){notify(e.message,'error');}
 };
 window.refreshOnlineOrders=async()=>{try{await live();render();}catch(e){notify(e.message,'error');}};
 const originalBooking=adminBooking;adminBooking=function(){return '<div class="panel"><h2>Orçamentos recebidos</h2><button class="btn" onclick="refreshOnlineOrders()">Atualizar solicitações</button>'+activity.quotes.map(q=>{const pending=sync.operations.find(op=>op.kind==='quote'&&op.id===q.id);return '<article class="panel" data-quote-id="'+esc(q.id)+'"><b>'+esc(q.customer?.name||'Cliente')+' · '+esc(q.status)+'</b><p>'+esc(q.date)+' · '+q.items.map(i=>i.qty+' × '+esc(i.name)).join(', ')+'</p><p>'+money(q.subtotal+q.fee)+'</p>'+(pending?'<p>Alteração antiga ainda no rascunho deste aparelho. Use Enviar alterações para concluí-la.</p>':'')+(['Solicitado','Aguardando cliente'].includes(q.status)?'<form class="stack" onsubmit="stageQuote(event,'+esc(JSON.stringify(q.id))+')"><label class="field">Data<input name="date" type="date" required value="'+esc(q.date)+'"></label><label class="field">Produtos (R$)<input name="subtotal" type="number" min="0" step="0.01" required value="'+q.subtotal+'"></label><label class="field">Entrega (R$)<input name="fee" type="number" min="0" step="0.01" required value="'+q.fee+'"></label><button class="btn primary">Enviar proposta</button><button type="button" class="btn" onclick="rejectRemoteQuote('+esc(JSON.stringify(q.id))+')">Recusar orçamento</button></form>':'')+'</article>';}).join('')+'</div>'+originalBooking();};
 window.stageQuote=function(event,id){
  event.preventDefault();const quote=activity.quotes.find(q=>q.id===id),f=new FormData(event.target);if(!quote)return;
  const date=String(f.get('date')),subtotal=Number(f.get('subtotal')),fee=Number(f.get('fee'));
  void sendOperation({kind:'quote',id,revision:quote.revision,decision:'propose',date,subtotal,fee},'Enviar proposta ao cliente?',[(quote.customer?.name||'Cliente')+' · '+quote.items.map(i=>i.qty+'× '+i.name).join(', '),'Data: '+new Date(date+'T12:00:00').toLocaleDateString('pt-BR'),'Produtos: '+money(subtotal)+' · Entrega: '+money(fee)+' · Total: '+money(subtotal+fee),'O cliente recebe a proposta na hora e precisa aceitar para virar pedido.'],'Proposta enviada ao cliente.','Enviar proposta');
 };
 window.rejectRemoteQuote=function(id){const quote=activity.quotes.find(q=>q.id===id);if(quote)void sendOperation({kind:'quote',id,revision:quote.revision,decision:'reject'},'Recusar este orçamento?',[(quote.customer?.name||'Cliente')+' · '+quote.items.map(i=>i.qty+'× '+i.name).join(', '),'O cliente é avisado da recusa na hora. Não é possível desfazer.'],'Orçamento recusado e cliente avisado.','Recusar orçamento');};
 const originalBonuses=adminBonuses;adminBonuses=function(){return originalBonuses().replace('Atenção: esta demonstração usa armazenamento local. Para impedir fraude e sincronizar entre aparelhos, a validação deverá ocorrer no servidor.','Os benefícios de clientes são validados no servidor e separados por loja.')+'<div class="panel"><h3>Clientes e benefícios desta loja</h3><button class="btn" onclick="refreshOnlineOrders()">Atualizar benefícios</button>'+activity.customers.map(c=>'<p>'+esc(c.profile.name||'Cliente')+' · '+c.benefits.earned+' carimbos · '+c.vouchers.length+' vouchers</p>').join('')+'</div>';};
 const originalDashboard=adminDashboard;adminDashboard=function(){
  const oldOrders=db.orders,oldVouchers=db.loyaltyVouchers;
  const projected=onlineOrders.map(o=>{const d=o.details||{};return {id:o.id,created:o.created_at,customer:d.customer?.name||'Cliente',phone:d.customer?.phone||'',method:d.method||'Retirada',status:labels[o.status]||o.status,scheduledDate:d.scheduledDate,subtotal:(d.subtotal_cents??o.total_cents)/100,fee:(d.fee_cents||0)/100,items:o.items.map(i=>{const p=db.products.find(p=>p.apiId===i.product_id);return {id:p?.id||i.product_id,name:i.name,qty:i.qty,price:i.unit_price??i.unit_price_cents/100,cost:i.unit_cost!==undefined?i.unit_cost:i.cost_cents!==undefined?i.cost_cents/100:0,costRecorded:i.unit_cost!==undefined||i.cost_cents!==undefined};})};});
  db.orders=[...oldOrders.filter(o=>!projected.some(p=>p.id===o.id)),...projected];db.loyaltyVouchers=[...oldVouchers,...activity.customers.flatMap(c=>c.vouchers)];
  try{return originalDashboard().replace('Dados demonstrativos deste navegador.','Pedidos publicados no servidor e registros do rascunho desta loja.');}finally{db.orders=oldOrders;db.loyaltyVouchers=oldVouchers;}
 };
 document.documentElement.dataset.loading='false';
 db={...DoceTenants.blank(),customer:{name:'',phone:'',address:'',notes:''}};render();openAccess();
})();
