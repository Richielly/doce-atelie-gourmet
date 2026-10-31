/* The only persistence trigger for administration is Enviar alterações. */
(()=>{
 'use strict';
 if(window.DOCE_MODE!=='admin')return;
 const fields=['products','orders','settings','nextId','pantry','pantryEntries','pantryLots','pantryMovements','recipes','production','allocations','loyalty','quotes','booking','branding','loyaltyAccounts','loyaltyVouchers'];
 const clone=value=>JSON.parse(JSON.stringify(value)),drafts=DoceTenants.create(localStorage);
 const sync={businessType:'confectionery',productSales:true,store:null,token:'',expires:0,revision:0,dirty:false,running:false,error:'',sequence:0,operations:[],apiIds:new Map(),derivedChanges:false};
 let onlineOrders=[],activity={quotes:[],customers:[]},draftWrite=Promise.resolve();
 try{if(!localStorage.getItem('doce-legacy-snapshot-v1')&&localStorage.getItem('doce-atelier-v1'))localStorage.setItem('doce-legacy-snapshot-v1',localStorage.getItem('doce-atelier-v1'));}catch{/* The original legacy key is never modified by this runtime. */}
 const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
 function snapshot(){const data=Object.fromEntries(fields.filter(k=>db[k]!==undefined).map(k=>[k,clone(db[k])]));data.products=data.products.map(p=>({...p,...((p.apiId||sync.apiIds.get(p.id))?{apiId:p.apiId||sync.apiIds.get(p.id)}:{})}));return data;}
 function remember(){
  if(!sync.store)return Promise.resolve();
  const store=clone(sync.store),draft={data:snapshot(),revision:sync.revision,dirty:sync.dirty,sequence:sync.sequence,operations:clone(sync.operations)};
  draftWrite=draftWrite.catch(()=>{}).then(()=>DoceAdminDrafts.save(store,draft));
  draftWrite.catch(()=>{sync.error='Não foi possível guardar o rascunho. Exporte uma cópia antes de sair.';banner();});
  return draftWrite;
 }
 function apply(data,shop){if(shop)sync.businessType=shop.business_type||'confectionery';db={...DoceTenants.blank(shop),...clone(data),customer:{name:'',phone:'',address:'',notes:''}};for(const p of db.products)if(p.apiId)sync.apiIds.set(p.id,p.apiId);const beforeCosting=JSON.stringify(db);DocePantry.reconcile(db);sync.derivedChanges=JSON.stringify(db)!==beforeCosting;document.documentElement.style.setProperty('--p',db.settings.color||'#a84e6e');}
 function syncLabel(){return sync.running?'Enviando alterações…':sync.error?'Não enviado: '+sync.error:sync.dirty?'Rascunho salvo neste aparelho. Envie para publicar.':'Sem alterações pendentes · revisão '+sync.revision;}
 function failSync(error){sync.error=error.message;banner();notify(error.message,'error');}
 function banner(){
  window.DoceAdminSync?.mount({dirty:!!admin&&sync.dirty,running:sync.running,onSend:send,onError:failSync});
  const status=document.getElementById('adminSyncStatus');if(status)status.textContent=syncLabel();
  const button=document.getElementById('adminConfigSend');if(button)button.disabled=sync.running||!sync.dirty;
 }
 window.reloadAdminStore=()=>reload().catch(failSync);
 window.publishAdminDraft=()=>send().catch(failSync);
 function salonUrl(){const url=new URL('salon.html',document.baseURI);url.searchParams.set('shop',sync.store.id);url.searchParams.set('api',sync.store.api);url.searchParams.set('role','admin');return url.href;}

 save=function(){if(!sync.store||!admin)return;sync.dirty=true;sync.sequence++;const pending=remember();banner();window.DoceNotify?.draft(sync.store,true);return DoceLoading.run(pending);};
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
 async function send(){
  if(!sync.dirty||sync.running)return;
  const sequence=sync.sequence,data=snapshot(),operations=clone(sync.operations);sync.running=true;sync.error='';banner();const endLoading=DoceLoading.begin();
  try{
   const result=await request(prefix()+'/workspace','PUT',{revision:sync.revision,data,operations});sync.revision=result.revision;
   if(sync.sequence===sequence){apply(result.data);sync.dirty=sync.derivedChanges;sync.operations=[];}
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
  apply(remote.data||DoceTenants.blank(catalog.shop,products(catalog.products)),catalog.shop);sync.revision=remote.revision;sync.operations=[];sync.dirty=sync.derivedChanges;sync.error='';sync.sequence++;remember();await live();render();banner();
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
   admin=true;tab=new URLSearchParams(location.search).get('section')==='settings'?'settings':sync.businessType==='salon'?'adminmenu':'dashboard';page='home';cart={};remember();await live();closeModal();render();banner();
   const notifyStore={...store,name:db.settings.name};
   const ctx=window.DoceNotify?.connect({store:notifyStore,role:'admin',request:(suffix,method,body)=>{if(sync.store?.id!==store.id||sync.store?.api!==store.api)throw Error('Abra a administração desta loja para atualizar seus avisos.');return request('/admin/shops/'+encodeURIComponent(store.id)+'/notifications'+suffix,method,body);}});
   if(ctx)ctx.navigate=async target=>{if(target.screen==='salon'){location.href=DoceNotificationCore.route(store,'admin',target,document.baseURI);return;}tab=DoceNotificationCore.pages.admin[target.screen]||'dashboard';if(tab==='deliveries'||tab==='booking')await live();render();if(target.order_id)onlineOrderDetails(target.order_id);else window.DoceNotify?.focusTarget(target);};
   window.DoceNotify?.draft(notifyStore,sync.dirty);
   const notificationParams=new URLSearchParams(location.search),notificationTab=notificationParams.get('notification_page');
   if(['deliveries','booking','stock','pantry','dashboard'].includes(notificationTab)){tab=notificationTab;render();if(notificationTab==='deliveries'&&notificationParams.get('notification_item'))onlineOrderDetails(notificationParams.get('notification_item'));else window.DoceNotify?.focusTarget({quote_id:notificationParams.get('notification_item')});}if(ctx)void window.DoceNotify.consume(ctx);

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
 const originalAdmin=renderAdmin;renderAdmin=function(){return originalAdmin().replace('Modo demonstração · acesso não protegido','Rascunho da loja · publique com Enviar alterações');};
 const originalSettings=adminSettings;adminSettings=function(){
  let html=originalSettings().replace('<h3>Dados de demonstração</h3>','<h3>Backup do rascunho</h3>').replace(/<button class="btn danger"[\s\S]*?<\/button>/,'').replace('Sem autenticação real. Qualquer pessoa com acesso ao código pode alterar os dados locais. Para produção, use API, autenticação e autorização de papéis no servidor.','As mudanças só ficam disponíveis para clientes após Enviar alterações.');
  if(sync.businessType==='salon'&&!sync.productSales)html=html.replace(/<div class="two"><label class="field">Taxa de entrega[\s\S]*?<\/div><div class="field">Paletas/,'<div class="field">Paletas').replace(/<p class="muted tiny">\* Pedido mínimo[\s\S]*?<\/p>/,'');
  return '<div class="elume-platform-signature"><img src="elume-logo-horizontal.svg" alt="Elume Shop" width="240" height="74"></div><div class="panel stack"><h2>Sincronização e rascunho</h2><p>Tipo: <strong>'+(sync.businessType==='salon'?'Salão':'Doçaria')+'</strong> · definido no Master.</p><p id="adminSyncStatus" role="status">'+esc(syncLabel())+'</p><button id="adminConfigSend" class="btn primary full" onclick="publishAdminDraft()" '+(sync.running||!sync.dirty?'disabled':'')+'>Enviar alterações</button><button class="btn full" onclick="reloadAdminStore()">Atualizar do servidor</button><button class="btn full" onclick="exportData()">Exportar rascunho</button></div>'+html;
 };
 getStoreId=function(){return sync.store?.id||'';};
 qrImageUrl=function(){if(!sync.store)throw Error('Entre na administração da loja.');const code=qrcode(0,'M');code.addData(DoceStores.qr(sync.store));code.make();return code.createDataURL(8,32);};
 const originalStoreQr=storeQr;storeQr=function(){return originalStoreQr().replace('QR demonstrativo vinculado ao armazenamento deste navegador. Não use para divulgação comercial definitiva: a versão multi-loja precisará gerar o QR a partir de um identificador permanente registrado no servidor.','Este QR identifica a loja no servidor. O cliente vê apenas os dados publicados com Enviar alterações.');};
 function stage(operation){if(sync.running)return;sync.operations=sync.operations.filter(op=>!(op.kind===operation.kind&&op.id===operation.id));sync.operations.push(operation);save();render();}
 window.getProductionOrders=()=>onlineOrders.map(o=>({id:o.id,status:labels[o.status]||o.status,items:o.items.map(i=>({id:db.products.find(p=>p.apiId===i.product_id)?.id,qty:i.qty}))}));
 const labels={recebido:'Recebido',preparo:'Em preparo',pronto:'Pronto',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue',cancelado:'Cancelado'};
 function choices(order){const current=labels[order.status]||order.status,steps=flowConfig(order.details?.method||'Retirada'),index=steps.indexOf(current);return [...(index>=0&&index<steps.length-1?[steps[index+1]]:[]),...(!['Entregue','Cancelado'].includes(current)?['Cancelado']:[])];}
 const originalOrders=adminOrders;adminOrders=function(){return '<div class="panel"><h2>Pedidos dos clientes</h2><button class="btn" onclick="refreshOnlineOrders()">Atualizar pedidos</button>'+onlineOrders.map(o=>{const pending=sync.operations.find(op=>op.kind==='order_status'&&op.id===o.id);return '<article class="panel"><b>#'+esc(o.id.slice(0,8))+' · '+esc(o.details?.customer?.name||'Cliente')+'</b><p>'+o.items.map(i=>i.qty+' × '+esc(i.name)).join(', ')+'</p><p>'+money(o.total_cents/100)+' · '+esc(o.details?.method||'Retirada')+'</p><p>'+esc(o.details?.address||'')+'</p><p>'+esc(labels[o.status]||o.status)+(pending?' → '+esc(pending.status)+' (não enviado)':'')+'</p>'+(o.details?.customerOnWay?'<p>Cliente avisou que está indo buscar.</p>':'')+'<button class="btn" onclick="onlineOrderDetails('+esc(JSON.stringify(o.id))+')">Detalhes do pedido</button>'+choices(o).map(status=>'<button class="btn" onclick="stageOrderStatus('+esc(JSON.stringify(o.id))+','+esc(JSON.stringify(status))+')">'+esc(status)+'</button>').join('')+'</article>';}).join('')+'</div>'+originalOrders();};
 window.stageOrderStatus=function(id,status){const order=onlineOrders.find(o=>o.id===id);if(!order)return;if(status==='Cancelado'&&!confirm('Preparar cancelamento deste pedido? Ele será efetivado somente ao enviar alterações.'))return;stage({kind:'order_status',id,expected:order.status,status});};
 window.setOnlineOrderStatus=window.stageOrderStatus;
 window.onlineOrderDetails=function(id){const order=onlineOrders.find(o=>o.id===id);if(!order)return;const d=order.details||{};showModal('<h2>Pedido #'+esc(id.slice(0,8))+'</h2><p><b>'+esc(d.customer?.name||'Cliente')+'</b></p><p>WhatsApp: '+esc(d.customer?.phone||'Não informado')+'</p><p>'+esc(d.method||'Retirada')+' · '+esc(d.address||'Retirada na loja')+'</p><p>Observações: '+esc(d.notes||'Nenhuma')+'</p><p>Pagamento: '+esc(d.payment||'A combinar')+' · '+esc(d.paymentStatus||'Não confirmado')+'</p>'+(d.scheduledDate?'<p>Agendado: '+esc(d.scheduledDate)+'</p>':'')+(d.voucherCode?'<p>Voucher: '+esc(d.voucherCode)+'</p>':'')+'<p>'+money(order.total_cents/100)+'</p><button class="btn full" onclick="closeModal()">Fechar</button>');};
 window.refreshOnlineOrders=async()=>{try{await live();render();}catch(e){notify(e.message,'error');}};
 const originalBooking=adminBooking;adminBooking=function(){return '<div class="panel"><h2>Orçamentos recebidos</h2><button class="btn" onclick="refreshOnlineOrders()">Atualizar solicitações</button>'+activity.quotes.map(q=>{const pending=sync.operations.find(op=>op.kind==='quote'&&op.id===q.id);return '<article class="panel" data-quote-id="'+esc(q.id)+'"><b>'+esc(q.customer?.name||'Cliente')+' · '+esc(q.status)+'</b><p>'+esc(q.date)+' · '+q.items.map(i=>i.qty+' × '+esc(i.name)).join(', ')+'</p><p>'+money(q.subtotal+q.fee)+'</p>'+(pending?'<p>Alteração preparada. Clique em Enviar alterações.</p>':'')+(['Solicitado','Aguardando cliente'].includes(q.status)?'<form class="stack" onsubmit="stageQuote(event,'+esc(JSON.stringify(q.id))+')"><label class="field">Data<input name="date" type="date" required value="'+esc(q.date)+'"></label><label class="field">Produtos (R$)<input name="subtotal" type="number" min="0" step="0.01" required value="'+q.subtotal+'"></label><label class="field">Entrega (R$)<input name="fee" type="number" min="0" step="0.01" required value="'+q.fee+'"></label><button class="btn primary">Preparar proposta</button><button type="button" class="btn" onclick="rejectRemoteQuote('+esc(JSON.stringify(q.id))+')">Preparar recusa</button></form>':'')+'</article>';}).join('')+'</div>'+originalBooking();};
 window.stageQuote=function(event,id){event.preventDefault();const quote=activity.quotes.find(q=>q.id===id),f=new FormData(event.target);if(quote)stage({kind:'quote',id,revision:quote.revision,decision:'propose',date:String(f.get('date')),subtotal:Number(f.get('subtotal')),fee:Number(f.get('fee'))});};
 window.rejectRemoteQuote=function(id){const quote=activity.quotes.find(q=>q.id===id);if(quote)stage({kind:'quote',id,revision:quote.revision,decision:'reject'});};
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
