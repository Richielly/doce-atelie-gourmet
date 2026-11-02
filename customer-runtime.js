/* Customer browsing never changes an administrator's workspace or draft. */
(()=>{
 'use strict';
 if(window.DOCE_MODE!=='customer')return;
 const params=new URLSearchParams(location.search);
 const clone=value=>JSON.parse(JSON.stringify(value));
 let store,clientToken='',state={},me=null,catalog=null,orders=[],quotes=[],busy=false,referral=null;
 const photos=new Map();
 let stateKey='';
 const labels={recebido:'Recebido',preparo:'Em preparo',pronto:'Pronto',saiu_para_entrega:'Saiu para entrega',entregue:'Entregue',cancelado:'Cancelado'};
 const apiPath=suffix=>'/public/shops/'+encodeURIComponent(store.id)+suffix;
 function persist(){if(!store)return;state.cart={};for(const [id,qty] of Object.entries(cart)){const product=db.products.find(p=>p.id===Number(id));if(product?.apiId)state.cart[product.apiId]=qty;}state.profile=clone(db.customer);localStorage.setItem(stateKey,JSON.stringify(state));}
 function request(suffix,method='GET',body,auth=true){return method==='GET'||suffix==='/me/notifications/analytics/events'?requestCore(suffix,method,body,auth):DoceLoading.run(()=>requestCore(suffix,method,body,auth));}
 async function requestCore(suffix,method='GET',body,auth=true){
  let response;try{response=await fetch(store.api+apiPath(suffix),{method,cache:'no-store',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:'Bearer '+clientToken}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('Não foi possível acessar esta loja agora. Seus dados continuam guardados. Tente novamente em instantes.');}
  let data;try{data=await response.json();}catch{throw Error('A loja está temporariamente indisponível.');}
  if(!response.ok){const error=Error(typeof data.detail==='string'?data.detail:'Confira os dados e tente novamente.');error.status=response.status;throw error;}return data;
 }
 async function identify(){
  clientToken=state.token||'';
  if(clientToken){try{me=await request('/me');return;}catch(e){if(e.status!==401)throw e;}}
  const result=await request('/customers','POST',{},false);clientToken=result.access_token;state.token=clientToken;localStorage.setItem(stateKey,JSON.stringify(state));me=result.customer;
 }
 function hydrate(){
  const previousCart=state.cart||{};
  const products=catalog.products.map(p=>({id:p.local_id,apiId:p.id,name:p.name,cat:p.category||'Produtos',desc:p.description||'',price:Number.isFinite(p.unit_price)?p.unit_price:p.price_cents/100,priceBasis:p.price_basis||'unit',stock:p.stock,minQty:p.min_qty,qtyStep:p.increment,image:p.photo_url||'',emoji:p.emoji||'🛍️',active:true}));
  db={...DoceTenants.blank(catalog.shop,products),customer:clone(me?.profile||state.profile||{name:'',phone:'',address:'',notes:''})};
  db.settings={...db.settings,...catalog.settings};db.branding={...db.branding,...catalog.shop.branding};db.loyalty=clone(catalog.loyalty);db.booking=clone(catalog.booking);
  db.customer={name:'',phone:'',address:'',notes:'',...db.customer};
  cart={};for(const p of products){const q=Number(previousCart[p.apiId]||0);if(Number.isInteger(q)&&q>0)cart[p.id]=q;}
  hydrateBenefits();
  DoceStores.registry.save({...store,name:catalog.shop.name,branding:catalog.shop.branding,color:catalog.settings?.color});
  document.documentElement.style.setProperty('--p',db.settings.color||'#a84e6e');if(!db.products.some(p=>p.cat===cat))cat='Todos';
 }
 function hydrateBenefits(){
  if(!me)return;const phone=loyaltyKey(db.customer.phone);
  db.loyaltyAccounts={};
  if(phone)db.loyaltyAccounts[phone]={phone,spend:me.benefits.spend_cents/100,earned:me.benefits.earned,awarded:me.benefits.awarded,creditedOrders:[]};
  db.loyaltyVouchers=me.vouchers.map(v=>({...v,phone,expires:v.expires.slice(0,10),orderId:v.order_id}));
 }
 async function refresh(){
  if(busy)return;
  try{
   const result=await Promise.all([request('', 'GET',null,false),request('/me'),request('/me/orders'),request('/me/quotes'),loadReferral()]);
   persist();catalog=result[0];me=result[1];orders=result[2];quotes=result[3];hydrate();render();
  }catch(e){notify(e.message,'error');}
 }
 window.refreshCustomerStore=refresh;
 const baseRender=render;render=function(){baseRender();persist();void showPhotos();};
 // Servers before 0.19.0 have no referral program; the Benefits page simply omits it.
 async function loadReferral(){try{referral=await requestCore('/me/referral');}catch{referral=null;}return referral;}
 // Ready-order photos need the customer token, so they are fetched once per version.
 async function showPhotos(){
  for(const img of document.querySelectorAll('img[data-order-photo]')){
   const key=img.dataset.orderPhoto+':'+img.dataset.version;
   if(!photos.has(key))photos.set(key,fetch(store.api+apiPath('/me/orders/'+encodeURIComponent(img.dataset.orderPhoto)+'/photo'),{cache:'no-store',headers:{Authorization:'Bearer '+clientToken}}).then(r=>r.ok?r.blob():null).then(b=>b?URL.createObjectURL(b):'').catch(()=>''));
   const url=await photos.get(key);if(url)img.src=url;else img.closest('figure')?.remove();
  }
 }
 function referralPanel(){
  if(!referral?.enabled)return '';
  return '<section class="panel referral-panel" aria-label="Indique e ganhe"><h3>🎁 Indique e ganhe</h3><p>Convide um amigo para '+esc(catalog.shop.name)+'. Quando ele '+(catalog.modules?.salon&&!catalog.modules.products?'concluir o primeiro atendimento':'receber o primeiro pedido')+', você ganha <b>'+esc(referral.prize)+'</b>.</p>'+
   '<p>Seu código: <b class="referral-code">'+esc(referral.code)+'</b></p><button class="btn primary" onclick="shareReferral()">Compartilhar convite</button>'+
   '<p class="muted tiny">'+referral.invited+' indicação(ões) · '+referral.rewarded+' prêmio(s) recebido(s). O prêmio vale por '+referral.validDays+' dias.</p>'+
   (referral.can_apply?'<form class="stack" onsubmit="applyReferral(event)"><label class="field">Recebeu um código de um amigo?<input name="code" maxlength="20" autocomplete="off" placeholder="Código de indicação" required></label><button class="btn">Usar código</button></form>':referral.referred?'<p class="muted tiny">Você entrou por indicação de um amigo.</p>':'')+'</section>';
 }
 window.shareReferral=async function(){
  const link=new URL(DoceStores.qr(store));link.searchParams.set('ref',referral.code);
  const text='Conheça '+catalog.shop.name+'! Use meu código '+referral.code+' na primeira compra: '+link.href;
  try{if(navigator.share){await navigator.share({title:catalog.shop.name,text});return;}}catch(e){if(e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text);notify('Convite copiado. Cole no WhatsApp para enviar.');}catch{notify(text);}
 };
 async function useReferral(code){referral=await request('/me/referral','POST',{code});render();notify('Código aplicado. Seu amigo ganha o prêmio quando sua primeira compra for concluída.');}
 window.applyReferral=async function(event){event.preventDefault();try{await useReferral(String(new FormData(event.target).get('code')||'').trim());}catch(e){notify(e.message,'error');}};
 save=function(){persist();};
 getStoreId=function(){return store.id;};
 walletPanel=function(){return '<div class="panel"><h3>'+esc(catalog.shop.name)+'</h3><p>Seus dados, pedidos e benefícios nesta loja ficam separados das outras lojas.</p><a class="btn full" href="minhas-lojas.html">Voltar à minha vitrine</a></div>';};
 const originalProfile=renderProfile;renderProfile=function(){return originalProfile().replace('Dados salvos apenas neste navegador, sem login real ou sincronização entre aparelhos.','Seus dados são enviados somente para esta loja.');};
 saveProfile=async function(event){event.preventDefault();const f=new FormData(event.target),profile=Object.fromEntries(['name','phone','address','notes'].map(k=>[k,String(f.get(k)||'').trim()]));try{me=await request('/me','PUT',profile);db.customer=me.profile;hydrateBenefits();persist();render();notify('Dados atualizados nesta loja.');}catch(e){notify(e.message,'error');}};
 const originalContact=renderContact;renderContact=function(){return originalContact().replace('Catálogo, carrinho e pedidos demonstrativos. Os dados ficam somente neste navegador até conectar um backend.','Você está acessando os dados publicados por '+esc(catalog.shop.name)+'.');};
 const originalHome=renderHome;renderHome=function(){const html=originalHome();if(!catalog?.modules?.salon)return html;const target=new URL('salon.html',document.baseURI);target.searchParams.set('loja',store.id);target.searchParams.set('api',store.api);return '<div class="panel"><h2>Serviços e agendamentos</h2><p>Reserve seu cuidado e acompanhe sua agenda.</p><a class="btn primary" href="'+esc(target.href)+'">Ver serviços e horários</a></div>'+html;};
 const originalCheckout=checkout;checkout=function(){originalCheckout();const note=document.querySelector('#modalhost .note');if(note)note.textContent='O pedido será enviado para esta loja. O pagamento é confirmado pelo lojista, não pelo aplicativo.';};
 function cartItems(){return Object.entries(cart).filter(([,qty])=>Number(qty)>0).map(([id,qty])=>{const p=db.products.find(p=>p.id===Number(id));if(!p)throw Error('Um produto mudou. Atualize o cardápio.');return {product_id:p.apiId,qty:Number(qty)};});}
 function formBody(form){const f=new FormData(form);return {customer:{name:String(f.get('customer')||'').trim(),phone:String(f.get('phone')||'').trim(),address:String(f.get('address')||'').trim(),notes:String(f.get('notes')||'').trim()},method:String(f.get('method')||'Retirada'),address:String(f.get('address')||'').trim(),notes:String(f.get('notes')||'').trim(),payment:String(f.get('payment')||'Na retirada'),voucher_code:String(f.get('voucherCode')||'').trim().toUpperCase(),items:cartItems()};}
 async function submit(form,kind){
  if(busy)return;busy=true;const button=form.querySelector('button[type="submit"],button.btn.primary');if(button)button.disabled=true;
  try{
   const body=formBody(form);if(!body.items.length)throw Error('Adicione um produto ao carrinho.');
   if(kind==='quote')body.date=String(new FormData(form).get('date')||'');
   const fingerprint=JSON.stringify(body),pending=state[kind+'Request'];
   body.request_id=pending?.fingerprint===fingerprint?pending.id:crypto.randomUUID();state[kind+'Request']={id:body.request_id,fingerprint};persist();
   await request(kind==='quote'?'/me/quotes':'/orders','POST',body);if(kind==='order')window.DoceNotify?.track('order_created');
   db.customer=body.customer;cart={};delete state[kind+'Request'];persist();closeModal();page=kind==='quote'?'quotes':'orders';
   busy=false;await refresh();notify(kind==='quote'?'Solicitação enviada para a loja.':'Pedido recebido pela loja. Acompanhe por aqui.');
  }catch(e){notify(e.message,'error');}finally{busy=false;if(button)button.disabled=false;}
 }
 placeOrder=function(event){event.preventDefault();void submit(event.target,'order');};
 submitQuote=function(event){event.preventDefault();void submit(event.target,'quote');};
 renderOrders=function(){return '<div class="section"><h2>Meus pedidos nesta loja</h2><button class="btn" onclick="refreshCustomerStore()">Atualizar</button></div>'+(orders.length?orders.map(o=>{const d=o.details||{},view={id:o.id,method:d.method||'Retirada',status:o.status_label||labels[o.status]||o.status};return '<article class="panel" data-order-id="'+esc(o.id)+'"><b>Pedido #'+esc(o.id.slice(0,8))+' · '+money(o.total_cents/100)+'</b><p>'+o.items.map(i=>i.qty+' × '+esc(i.name)).join(', ')+'</p>'+orderFlow(view,true)+'<p>'+esc(view.status)+'</p>'+(d.scheduledDate?'<p>Agendado: '+esc(d.scheduledDate)+'</p>':'')+(d.payment==='Pix'&&!['entregue','cancelado'].includes(o.status)?(window.ElumePix?.block(db.settings,o.total_cents/100,'pedido'+o.id.slice(0,8))||'<div class="note">Pix: '+esc(db.settings.pixKey||'Consulte a loja')+' · '+esc(db.settings.pixName||'')+'</div>')+'<p class="muted tiny">Pagamento ainda depende de confirmação da loja.</p>':'')+(d.readyPhoto?'<figure class="order-photo"><img data-order-photo="'+esc(o.id)+'" data-version="'+esc(d.readyPhoto)+'" alt="Foto do pedido enviada pela loja"><figcaption>Foto enviada pela loja</figcaption></figure>':'')+(o.status==='pronto'&&d.method!=='Entrega'&&!d.customerOnWay?'<button class="btn" onclick="customerOnWay('+esc(JSON.stringify(o.id))+')">Estou indo buscar</button>':'')+(d.customerOnWay?'<p>Você avisou que está indo buscar.</p>':'')+'</article>';}).join(''):'<div class="panel">Você ainda não fez pedidos nesta loja.</div>');};
 window.customerOnWay=async function(id){try{await request('/me/orders/'+encodeURIComponent(id)+'/on-way','POST',{});await refresh();}catch(e){notify(e.message,'error');}};
 const originalLoyalty=renderLoyalty;renderLoyalty=function(){return '<button class="btn" onclick="refreshCustomerStore()">Atualizar benefícios desta loja</button>'+referralPanel()+originalLoyalty().replace('Programa demonstrativo neste aparelho. Informe seu WhatsApp em Minha conta para identificar seu cartão.','Benefícios desta loja, calculados pelo servidor a partir de pedidos entregues.').replace('DOCE ATELIÊ · CLUBE DE CARINHO',esc(db.settings.name)+' · BENEFÍCIOS');};
 requestLoyaltyVoucher=async function(){if(busy)return;if(!confirm('Resgatar o prêmio de '+catalog.shop.name+'?'))return;busy=true;try{me=await request('/me/vouchers','POST',{});hydrateBenefits();render();notify('Voucher criado para esta loja.');}catch(e){notify(e.message,'error');}finally{busy=false;}};
 renderQuotes=function(){return '<div class="section"><h2>Meus orçamentos nesta loja</h2><button class="btn" onclick="refreshCustomerStore()">Atualizar</button></div>'+(quotes.length?quotes.map(q=>'<article class="panel" data-quote-id="'+esc(q.id)+'"><b>Orçamento #'+esc(q.id.slice(0,8))+' · '+esc(q.status)+'</b><p>'+esc(q.date)+' · '+esc(q.method)+'</p><p>'+q.items.map(i=>i.qty+' × '+esc(i.name)).join(', ')+'</p><p>Proposta: '+money(q.subtotal+q.fee)+'</p>'+(q.status==='Aguardando cliente'?'<button class="btn primary" onclick="decideCustomerQuote('+esc(JSON.stringify(q.id))+',\'accept\')">Aceitar e criar pedido</button>':'')+(['Solicitado','Aguardando cliente'].includes(q.status)?'<button class="btn" onclick="decideCustomerQuote('+esc(JSON.stringify(q.id))+',\'cancel\')">Cancelar orçamento</button>':'')+(q.orderId?'<p>Pedido criado: #'+esc(q.orderId.slice(0,8))+'</p>':'')+'</article>').join(''):'<div class="panel">Monte seu carrinho e escolha Solicitar orçamento.</div>');};
 window.decideCustomerQuote=async function(id,decision){const quote=quotes.find(q=>q.id===id);if(!quote||busy||!confirm(decision==='accept'?'Aceitar a proposta de '+money(quote.subtotal+quote.fee)+' e criar o pedido?':'Cancelar este orçamento?'))return;busy=true;try{await request('/me/quotes/'+encodeURIComponent(id)+'/decision','POST',{revision:quote.revision,decision});busy=false;await refresh();}catch(e){notify(e.message,'error');}finally{busy=false;}};
 openAccess=function(){const target=new URL('index.html',document.baseURI);target.searchParams.set('admin','1');target.searchParams.set('shop',store.id);target.searchParams.set('api',store.api);location.href=target.href;};
 (async()=>{
  try{
   store=DoceStores.parse(params.get('loja')||'',params.get('api')||location.origin);stateKey='doce-customer-v2:'+DoceStores.key(store);
   try{state=JSON.parse(localStorage.getItem(stateKey)||'{}');}catch{state={};}
   catalog=await request('','GET',null,false);window.ElumeArea?.show({role:'customer',name:catalog.shop.name});
   if(catalog.modules?.salon&&!catalog.modules.products){const target=new URL('salon.html',document.baseURI);target.search=location.search;target.searchParams.set('role','customer');location.replace(target.href);return;}
   await identify();
   const result=await Promise.all([request('/me/orders'),request('/me/quotes'),loadReferral()]);orders=result[0];quotes=result[1];hydrate();page='home';admin=false;render();
   // Invitation links carry ?ref=; it is applied once, only while this customer is new.
   const invite=params.get('ref');if(invite&&referral?.can_apply&&state.referralTried!==invite){state.referralTried=invite;persist();try{await useReferral(invite);}catch{}}
   const ctx=window.DoceNotify?.connect({store:{...store,name:catalog.shop.name},role:'customer',request:(suffix,method,body)=>request('/me/notifications'+suffix,method,body)});
   if(ctx)ctx.navigate=async target=>{if(target.screen==='salon'){location.href=DoceNotificationCore.route(store,'customer',target,document.baseURI);return;}await refresh();page=DoceNotificationCore.pages.customer[target.screen]||'orders';render();window.DoceNotify?.focusTarget(target);};
   const notificationPage=params.get('notification_page');if(['orders','quotes','loyalty'].includes(notificationPage)){page=notificationPage;render();window.DoceNotify?.focusTarget({order_id:params.get('notification_item')});}if(ctx)void window.DoceNotify.consume(ctx);

   document.documentElement.dataset.loading='false';
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
   setInterval(()=>{if(!document.hidden)void refresh();},30000);
  }catch(e){document.documentElement.dataset.loading='false';document.getElementById('main').replaceChildren();const title=document.createElement('h2');title.textContent='Não foi possível abrir esta loja';const text=document.createElement('p');text.textContent=e.message;const back=document.createElement('a');back.href='minhas-lojas.html';back.textContent='Voltar à minha vitrine';document.getElementById('main').append(title,text,back);document.getElementById('nav').replaceChildren();}
 })();
})();
