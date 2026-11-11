/* Notification metadata is independent from unpublished business drafts. */
(()=>{
 'use strict';
 const C=DoceNotificationCore,contexts=new Map(),preferenceOpen=new Set(),native=window.Capacitor?.isNativePlatform?.()===true;
 const plugins=window.Capacitor?.Plugins||{},local=plugins.LocalNotifications,push=plugins.PushNotifications;
 let skipDeviceAlertUntil=native?Date.now()+10000:0;
 let current=null,dialog,content,iconButton,polling=false,initialized=false,osToken='',audio,filter='all',errorMessage='',pushReady=false,registrationStarted=false,selectedNotice=null,preferencesVisible=false;
 let installation=localStorage.getItem('doce-notice-installation');if(!installation){installation=crypto.randomUUID();localStorage.setItem('doce-notice-installation',installation);}
 const storageKey=ctx=>'doce-notices-v1:'+C.key(ctx.store,ctx.role);
 const usageSessions=new Map(),usageKinds=new Set(['qr','store_visit','product','service','cart','booking_start','order_created','booking_created','notification_open','notification_action']);
 function trackUsage(kind,ctx=current){
  if(!ctx?.analytics?.enabled||!usageKinds.has(kind))return;
  try{
   const origin=new URL(ctx.store.api).origin,key='elume-usage-installation:'+origin;let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
   let s=usageSessions.get(origin);if(!s){try{s=JSON.parse(sessionStorage.getItem('elume-usage-session:'+origin));}catch{}}const fresh=!s||Date.now()-s.last>1800000;if(fresh){s={id:crypto.randomUUID(),last:Date.now()};usageSessions.set(origin,s);}s.last=Date.now();sessionStorage.setItem('elume-usage-session:'+origin,JSON.stringify(s));
   const event=k=>({event_id:crypto.randomUUID(),session_id:s.id,installation:id,kind:k,channel:native?'android':'web'});
   // Best effort only: never persists drafts, queues offline writes or retries on reconnect.
   void ctx.request('/analytics/events','POST',{events:[...(fresh?[event('app_open')]:[]),event(kind)]}).catch(()=>{});
  }catch{/* Optional analytics must never block shopping or administration. */}
 }
 async function loadUsage(ctx){
  if(ctx.analyticsLoading)return;
  ctx.analyticsLoading=true;
  try{if(ctx.analyticsIdentity!==ctx.identity){ctx.analytics=await ctx.request('/analytics/preferences');ctx.analyticsIdentity=ctx.identity;}
   if(ctx===current&&ctx.analyticsVisitPending){ctx.analyticsVisitPending=false;trackUsage('store_visit',ctx);if(new URLSearchParams(location.search).get('entry')==='qr'){trackUsage('qr',ctx);try{const url=new URL(location.href);url.searchParams.delete('entry');history.replaceState(null,'',url.href);}catch{}}}
  }catch{ctx.analytics=null;}finally{ctx.analyticsLoading=false;}
 }
 async function setUsage(ctx,enabled){ctx.analytics=await ctx.request('/analytics/preferences','PUT',{enabled});ctx.analyticsIdentity=ctx.identity;if(enabled)trackUsage('store_visit',ctx);render();}
 function save(ctx){try{localStorage.setItem(storageKey(ctx),JSON.stringify({identity:ctx.identity,items:ctx.items.slice(0,100),unread:ctx.unread,preferences:ctx.preferences,shop:{id:ctx.store.id,name:ctx.shop?.name||ctx.store.name},latest:ctx.latest}));}catch{/* The server remains the source of history/read state. */}}
 function connect(options){const key=C.key(options.store,options.role);let ctx=contexts.get(key);if(!ctx){let cached={};try{cached=JSON.parse(localStorage.getItem('doce-notices-v1:'+key)||'{}');}catch{}ctx={...cached,loaded:false,items:cached.items||[],unread:cached.unread||0,latest:cached.latest||0,preferences:cached.preferences||{categories:{},sound:true,push:false,desktop:false},store:{...options.store},role:options.role,request:options.request};contexts.set(key,ctx);}else ctx.request=options.request;
  if(options.role==='admin'){try{const stores=JSON.parse(localStorage.getItem('doce-notice-admin-stores')||'[]').filter(s=>C.key(s,'admin')!==key);stores.push(options.store);localStorage.setItem('doce-notice-admin-stores',JSON.stringify(stores));}catch{}}
  if(options.active!==false){if(current!==ctx)ctx.analyticsVisitPending=true;current=ctx;}mount();if(options.role==='admin')setTimeout(()=>paintUrgent(),0);void load(ctx);return ctx;
 }
 function customerContexts(){for(const store of window.DoceStores?.registry.list()||[]){try{const state=JSON.parse(localStorage.getItem('doce-customer-v2:'+DoceStores.key(store))||'{}');if(!state.token)continue;const id=C.key(store,'customer');if(contexts.has(id))continue;const token=state.token;
  connect({store,role:'customer',active:false,request:async(suffix,method='GET',body)=>{const r=await fetch(store.api+'/public/shops/'+encodeURIComponent(store.id)+'/me/notifications'+suffix,{method,cache:'no-store',headers:{Accept:'application/json',Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Não foi possível consultar os avisos.');return data;}});
 }catch{}}}
 async function load(ctx,before){
  if(ctx.loading)return;ctx.loading=true;
  try{
   const result=await ctx.request(before?'?before='+before+'&limit=60':'?limit=60');if(ctx.identity&&result.identity&&ctx.identity!==result.identity){ctx.items=[];ctx.latest=0;ctx.loaded=false;ctx.registered='';}ctx.identity=result.identity;
   const baseline=ctx.latest||0,wasLoaded=ctx.loaded;
   ctx.items=C.merge(ctx.items,result.items);ctx.unread=result.unread;ctx.preferences=result.preferences;ctx.shop=result.shop;ctx.configured=result.push_configured;ctx.more=result.more;ctx.latest=Math.max(baseline,...result.items.map(x=>x.id));ctx.error='';
   // A first connection restores history silently instead of sounding every old event.
   ctx.loaded=true;if(wasLoaded&&!before)for(const notice of result.items.filter(n=>n.id>baseline&&!n.read))void alert(ctx,notice);
   // Sales/bookings that arrived while the system was closed still get the sale panel, without repeating sound.
   else if(!wasLoaded&&!before&&typeof announcePending==='function')announcePending(ctx,result.items);
   save(ctx);paintBadge();if(dialog?.open)render();void loadUsage(ctx);
   if(osToken&&ctx.preferences.push)await register(ctx);else if(native&&push&&ctx.preferences.push&&ctx.configured&&window.DOCE_PUSH_BUILD?.firebase&&!registrationStarted){registrationStarted=true;await setupPush();await push.register();}
  }catch(e){ctx.error=e.message;if(dialog?.open)render();}finally{ctx.loading=false;}
 }
 async function adminKeys(store){
  const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('doce-atelie-admin-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{const tx=database.transaction('keys','readonly'),keys=tx.objectStore('keys'),name='doce-admin-key-'+store.id+'@'+store.api,privateKey=keys.get(name),publicKey=keys.get(name+'-public');tx.oncomplete=()=>resolve({privateKey:privateKey.result,publicKey:publicKey.result});tx.onerror=()=>reject(tx.error);});}finally{database.close();}
 }
 function adminContexts(){let stores=[];try{stores=JSON.parse(localStorage.getItem('doce-notice-admin-stores')||'[]');}catch{}
  for(const candidate of stores){try{const store={...candidate,api:DoceStores.apiOrigin(candidate.api)};if(contexts.has(C.key(store,'admin')))continue;let token='',expires=0;
   async function http(path,method='GET',body,authenticated=false){const r=await fetch(store.api+path,{method,cache:'no-store',headers:{Accept:'application/json',...(authenticated?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){if(r.status===401)expires=0;throw Error(typeof data.detail==='string'?data.detail:'Acesso administrativo indisponível.');}return data;}
   connect({store,role:'admin',active:false,request:async(suffix,method='GET',body)=>{
    if(Date.now()>=expires){const pair=await adminKeys(store);if(!pair.privateKey||!pair.publicKey)throw Error('Ative este aparelho para consultar os avisos administrativos.');const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join(''),public_key=hex(await crypto.subtle.exportKey('raw',pair.publicKey)),base='/auth/shops/'+encodeURIComponent(store.id);
     const challenge=await http(base+'/challenge','POST',{public_key}),signature=hex(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(challenge.nonce))),session=await http(base+'/session','POST',{...challenge,signature});token=session.access_token;expires=Date.now()+session.expires_in_seconds*1000-10000;
    }return http('/admin/shops/'+encodeURIComponent(store.id)+'/notifications'+suffix,method,body,true);
   }});
  }catch{}}
 }
 function professionalContexts(){for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('salon-professional:'))continue;try{const [api,id]=JSON.parse(key.slice('salon-professional:'.length)),store=DoceStores.parse(id,api),saved=JSON.parse(localStorage.getItem(key));if(!saved?.access_token||contexts.has(C.key(store,'professional')))continue;connect({store,role:'professional',active:false,request:async(suffix,method='GET',body)=>{const r=await fetch(store.api+'/professional/shops/'+encodeURIComponent(store.id)+'/notifications'+suffix,{method,cache:'no-store',headers:{Accept:'application/json',Authorization:'Bearer '+saved.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw Error(typeof result.detail==='string'?result.detail:'Acesso profissional indisponível.');return result;}});}catch{}}}
 // On the web the owner's tab keeps checking in the background, so a sale is not missed behind another tab.
 async function poll(){if(polling||document.hidden&&(native||![...contexts.values()].some(c=>c.preferences.desktop||c.role==='admin')))return;polling=true;try{customerContexts();adminContexts();professionalContexts();await Promise.allSettled([...contexts.values()].map(ctx=>load(ctx)));checkDrafts();paintUrgent();}finally{polling=false;}}
 function totalUnread(){return [...contexts.values()].reduce((sum,c)=>sum+(c.unread||0),0)+draftRows().filter(n=>!n.read).length;}
 function paintBadge(){mount();if(!iconButton)return;const count=totalUnread(),badge=iconButton.querySelector('span');badge.textContent=String(count);badge.hidden=!count;const hot=[...contexts.values()].some(c=>(c.items||[]).some(n=>!n.read&&C.lane(c.role,n)!=='system'));iconButton.classList?.toggle('hot',hot);iconButton.setAttribute('aria-label','Notificações'+(count?' · '+count+' não lidas':''));}
 function mount(){
  if(!document.body)return;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='doce-notification-center';dialog.setAttribute('aria-label','Central de notificações');const head=document.createElement('div');head.className='notice-center-heading';const title=document.createElement('h2');title.textContent='Notificações';const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Fechar';close.onclick=()=>dialog.close();head.append(title,close);content=document.createElement('div');dialog.append(head,content);document.body.append(dialog);}
  if(iconButton?.isConnected)return;
  const host=document.querySelector('.headright')||document.querySelector('header');if(!host)return;
  iconButton=document.createElement('button');iconButton.className='iconbtn doce-notice-bell';iconButton.type='button';iconButton.setAttribute('aria-label','Notificações');iconButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span hidden></span>';iconButton.onclick=()=>{customerContexts();errorMessage='';selectedNotice=null;preferencesVisible=false;render();dialog.showModal();void poll();};host.prepend(iconButton);
 }
 function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
 function button(text,fn,className='btn'){const b=el('button',text,className);b.type='button';b.onclick=()=>void Promise.resolve(fn()).catch(e=>{errorMessage=e.message;render();});return b;}
 function rows(){const remote=[...contexts.values()].flatMap(ctx=>ctx.items.map(n=>({...n,ctx,key:C.key(ctx.store,ctx.role)+':'+n.id})));return [...remote,...draftRows()].filter(n=>filter==='all'||(filter==='sales'?C.lane(n.ctx.role,n)!=='system':filter==='system'?C.lane(n.ctx.role,n)==='system':n.ctx.role===filter)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));}
 function noticeIdentity(n){const ctx=n.ctx;return (ctx.shop?.name||ctx.store.name||'Loja')+' · '+(ctx.role==='admin'?'Lojista':ctx.role==='professional'?'Profissional':'Cliente');}
 function selectedEntry(){
  if(!selectedNotice)return null;
  if(selectedNotice.identity!==selectedNotice.ctx.identity){selectedNotice=null;return null;}
  const current=selectedNotice.local?draftRows().find(n=>n.ctx===selectedNotice.ctx):selectedNotice.ctx.items.find(n=>n.id===selectedNotice.id);
  return {...selectedNotice,...current,ctx:selectedNotice.ctx};
 }
 async function showNotice(n){trackUsage('notification_open',n.ctx);selectedNotice={...n,identity:n.ctx.identity};preferencesVisible=false;errorMessage='';render();if(!dialog.open)dialog.showModal();try{await readOne(n);}catch(error){errorMessage='Não foi possível registrar a leitura: '+error.message;render();}}
 function render(){
  if(!content)return;content.replaceChildren();
  const selected=selectedEntry();
  if(selected){
   content.append(button('Voltar à lista',()=>{selectedNotice=null;errorMessage='';render();}));
   if(errorMessage)content.append(el('p',errorMessage,'notice-error'));
   const kind=C.lane(selected.ctx.role,selected),full=el('article',undefined,'notice-full lane-'+kind);full.append(el('small',noticeIdentity(selected),'notice-store'));if(kind!=='system')full.append(el('span',C.lanes[kind].label,'notice-chip lane-'+kind));full.append(el('h3',selected.title),el('p',selected.body,'notice-full-body'),el('small',new Date(selected.created_at).toLocaleString('pt-BR')));
   if(C.hasAction(selected.ctx.role,selected.target)){const actions=el('div',undefined,'notice-actions');actions.append(button(kind==='system'?'Ver':C.lanes[kind].action,()=>openNotice(selected),'btn primary'));full.append(actions);}
   content.append(full);return;
  }
  if(preferencesVisible){
   content.append(button('Voltar à lista',()=>{preferencesVisible=false;errorMessage='';render();}));
   if(errorMessage)content.append(el('p',errorMessage,'notice-error'));
  for(const ctx of contexts.values()){
   if(filter!=='all'&&filter!==ctx.role)continue;
   const settings=document.createElement('details');settings.className='notice-preferences';const preferenceKey=C.key(ctx.store,ctx.role);settings.open=preferenceOpen.has(preferenceKey);settings.ontoggle=()=>{if(settings.isConnected){if(settings.open)preferenceOpen.add(preferenceKey);else preferenceOpen.delete(preferenceKey);}};settings.append(el('summary',(ctx.shop?.name||ctx.store.name||'Loja')+' · '+(ctx.role==='admin'?'Lojista':ctx.role==='professional'?'Profissional':'Cliente')+' · Preferências'));
   const allowed=ctx.role==='admin'?['orders','quotes','on_way','inventory','drafts','salon','offers']:ctx.role==='professional'?['salon']:['orders','quotes','benefits','salon','offers'];
   for(const category of allowed)settings.append(toggle(C.categories[category],ctx.preferences.categories[category]!==false,value=>setPref(ctx,{categories:{[category]:value}})));
   settings.append(toggle('Som para novos avisos',ctx.preferences.sound,value=>setPref(ctx,{sound:value})));
   if(ctx.role==='admin')settings.append(el('p','Pedidos, orçamentos e agendamentos aparecem em destaque no topo e o som se repete a cada 30 segundos, por até 10 minutos, até você abrir ou tocar em Depois. No navegador, mantenha a aba da loja aberta; ative os avisos do navegador para receber mesmo em outra aba.','muted tiny'));
   settings.append(toggle('Compartilhar estatísticas opcionais de uso',ctx.analytics?.enabled===true,value=>setUsage(ctx,value)));
   settings.append(el('p','Sem nome, contato ou conteúdo cadastrado. Eventos guardados por até 180 dias. Desativar remove as medições deste acesso.','muted tiny'));
   settings.append(button(native?'Ativar avisos neste aparelho':'Ativar avisos do navegador',()=>enableLocal(ctx)));
   if(native){const pushStatus=ctx.configured&&window.DOCE_PUSH_BUILD?.firebase?'Push disponível para ativação.':'Push com o aplicativo fechado aguarda configuração do Firebase.';settings.append(el('p',pushStatus,'muted tiny'));if(ctx.configured&&window.DOCE_PUSH_BUILD?.firebase)settings.append(button(ctx.preferences.push?'Desativar push desta loja':'Ativar push desta loja',()=>enablePush(ctx)));}
   if(ctx.preferences.desktop)settings.append(button('Desativar avisos deste aparelho',()=>setPref(ctx,{desktop:false})));
   if(ctx.error)settings.append(el('p','Não foi possível atualizar esta loja: '+ctx.error,'notice-error'));
   settings.append(button('Atualizar avisos',()=>load(ctx)));content.append(settings);
  }
   return;
  }
  const actions=el('div',undefined,'notice-list-toolbar'),label=el('label','Mostrar','notice-filter'),select=el('select');select.setAttribute('aria-label','Tipo de notificações');
  const owner=[...contexts.values()].some(c=>c.role==='admin');
  for(const [id,text] of [['all','Todas'],...(owner?[['sales','Vendas, orçamentos e agenda'],['system','Avisos do sistema']]:[]),['customer','Meus avisos'],['admin','Administração'],['professional','Profissional']]){const option=el('option',text);option.value=id;option.selected=filter===id;select.append(option);}
  select.onchange=()=>{filter=select.value;render();};label.append(select);actions.append(label);content.append(actions);
  content.append(el('p',totalUnread()+' não lidas no total · até 5 mais recentes','notice-list-summary'));
  if(errorMessage)content.append(el('p',errorMessage,'notice-error'));
  if(!contexts.size)content.append(el('p','Ao entrar em uma loja ou na administração, os avisos desse acesso aparecerão aqui.'));
  const list=el('div',undefined,'notice-list'),entries=C.previews(rows());if(!entries.length)list.append(el('p','Nenhuma notificação por aqui.'));
  for(const n of entries){
   const kind=C.lane(n.ctx.role,n),preview=button('',()=>showNotice(n),'notice-preview lane-'+kind+(n.read?'':' unread'));preview.setAttribute('aria-label',(kind==='system'?'':C.lanes[kind].label+' · ')+n.title+' · '+noticeIdentity(n)+(n.read?'':' · Não lida'));
   if(kind!=='system')preview.append(el('span',C.lanes[kind].label,'notice-chip lane-'+kind));
   preview.append(el('strong',n.title,'notice-preview-title'),el('span',String(n.body||'').slice(0,120)+(String(n.body||'').length>120?'…':''),'notice-preview-body'),el('small',noticeIdentity(n)+' · '+new Date(n.created_at).toLocaleString('pt-BR'),'notice-preview-meta'));list.append(preview);
  }
  content.append(list);const footer=el('div',undefined,'notice-actions notice-list-footer');
  footer.append(button(filter==='all'?'Marcar todas como lidas':'Marcar perfil como lido',readAll),button('Configurar avisos',()=>{preferencesVisible=true;render();}));content.append(footer);
 }
 function toggle(label,value,fn){const line=el('label',undefined,'notice-toggle'),input=el('input');input.type='checkbox';input.checked=!!value;input.onchange=()=>{input.disabled=true;Promise.resolve(fn(input.checked)).catch(e=>{errorMessage=e.message;render();}).finally(()=>input.disabled=false);};line.append(input,el('span',label));return line;}
 async function setPref(ctx,patch){ctx.preferenceWrite=(ctx.preferenceWrite||Promise.resolve()).catch(()=>{}).then(async()=>{const next={...ctx.preferences,...patch,categories:{...ctx.preferences.categories,...(patch.categories||{})}};ctx.preferences=await ctx.request('/preferences','PUT',next);save(ctx);render();});return ctx.preferenceWrite;}
 async function readOne(n){if(n.read||n.ctx.items?.find(x=>x.id===n.id)?.read)return;if(n.local){markDraft(n);return;}const ctx=n.ctx;ctx.reading=ctx.reading||new Map();if(ctx.reading.has(n.id))return ctx.reading.get(n.id);const pending=(async()=>{await ctx.request('/read','POST',{ids:[n.id]});n.read=true;if(typeof dismissUrgent==='function')dismissUrgent(C.key(ctx.store,ctx.role)+':'+n.id);const item=ctx.items.find(x=>x.id===n.id);if(item)item.read=true;ctx.unread=Math.max(0,ctx.unread-1);save(ctx);paintBadge();render();})();ctx.reading.set(n.id,pending);try{return await pending;}finally{ctx.reading.delete(n.id);}}
 async function readAll(){for(const ctx of contexts.values()){if(filter!=='all'&&ctx.role!==filter||!ctx.items.length)continue;await ctx.request('/read','POST',{through:ctx.latest});ctx.items.forEach(n=>n.read=true);ctx.unread=0;save(ctx);}for(const n of draftRows())if(filter==='all'||filter==='admin')markDraft(n);if(typeof dismissUrgent==='function')for(const key of [...urgent.keys()])dismissUrgent(key);paintBadge();render();}
 async function openNotice(n){if(!C.hasAction(n.ctx.role,n.target))return;await readOne(n);trackUsage('notification_action',n.ctx);const ctx=n.ctx;if(current&&C.key(current.store,current.role)===C.key(ctx.store,ctx.role)&&current.navigate){await current.navigate(n.target);dialog.close();return;}const href=C.route(ctx.store,ctx.role,n.target,document.baseURI);dialog.close();location.href=href;}
 let unlocked=false;
 // Browsers only allow sound after the first touch/click/key on the page.
 function unlock(){if(!window.AudioContext&&!window.webkitAudioContext)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();void audio.resume();unlocked=true;paintUrgent();}catch{}}
 for(const type of ['pointerdown','keydown'])document.addEventListener(type,unlock,{once:true,capture:true});
 function tone(notes,volume,wave='sine'){if(!unlocked||!audio)return;try{let at=audio.currentTime;for(const [freq,len] of notes){const o=audio.createOscillator(),g=audio.createGain();o.type=wave;o.frequency.value=freq;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.02);g.gain.exponentialRampToValueAtTime(.0001,at+len);o.start(at);o.stop(at+len+.02);at+=len*.85;}}catch{}}
 // System notices: one short, soft beep. Sales and bookings: a louder, distinct chime.
 function sound(){tone([[880,.2]],.08);}
 function chime(kind){tone(kind==='booking'?[[659,.22],[880,.22],[1047,.4]]:kind==='quote'?[[784,.2],[988,.2],[784,.2],[988,.35]]:[[784,.18],[988,.18],[1319,.45]],.32,'triangle');}
 // ---- Sale/booking panel: stays on screen until the owner opens it or chooses Depois. ----
 const urgent=new Map(),REPEAT_MS=30000,REPEAT_FOR=10*60000;let repeatTimer=null,repeatUntil=0,titleTimer=null,baseTitle='';
 const laneIcons={order:'M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0',quote:'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',booking:'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4M9 13h2M13 13h2M9 16h2'};
 function laneSvg(kind){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(laneIcons[kind]||laneIcons.order)+'"/></svg>';}
 function urgentHost(){let host=document.getElementById('doce-sale-alerts');if(!host&&document.body){host=el('aside');host.id='doce-sale-alerts';host.setAttribute('aria-live','assertive');host.setAttribute('aria-label','Novas vendas e agendamentos');document.body.append(host);}return host;}
 function paintUrgent(){
  const host=urgentHost();if(!host)return;host.replaceChildren();
  const owner=[...contexts.values()].some(c=>c.role==='admin');
  if(owner&&!unlocked&&!native){const b=button('',()=>{unlock();chime('order');},'sale-sound-off');b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6"/></svg><span>Toque para ativar o som de pedidos</span>';host.append(b);}
  const list=[...urgent.values()].sort((a,b)=>b.at-a.at);if(!list.length)return;
  const {ctx,n,kind}=list[0],card=el('section',undefined,'sale-alert lane-'+kind);card.setAttribute('role','alert');
  const head=el('div',undefined,'sale-alert-head'),icon=el('span',undefined,'sale-alert-icon');icon.innerHTML=laneSvg(kind);
  const label=el('div');label.append(el('span',C.lanes[kind].label.toUpperCase()+' · '+(ctx.shop?.name||ctx.store.name||'Loja'),'sale-alert-kind'),el('strong',n.title,'sale-alert-title'));head.append(icon,label);
  card.append(head,el('p',n.body,'sale-alert-body'),el('small',new Date(n.created_at||Date.now()).toLocaleString('pt-BR')+(list.length>1?' · mais '+(list.length-1)+' aguardando':''),'sale-alert-meta'));
  const actions=el('div',undefined,'sale-alert-actions'),open=button('',async()=>{dismissUrgent(list[0].key);await openNotice({...n,ctx});},'btn primary');open.innerHTML=laneSvg(kind)+'<span>'+C.lanes[kind].action+'</span>';
  const later=button('',()=>dismissUrgent(list[0].key,true),'btn');later.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"/></svg><span>Depois</span>';
  actions.append(open,later);if(list.length>1){const all=button('',()=>{for(const x of [...urgent.keys()])dismissUrgent(x,true);if(dialog){filter='sales';selectedNotice=null;preferencesVisible=false;render();dialog.showModal();}},'btn');all.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Ver todos ('+list.length+')</span>';actions.append(all);}
  card.append(actions);host.append(card);
 }
 function flashTitle(){
  if(!urgent.size){if(titleTimer){clearInterval(titleTimer);titleTimer=null;if(baseTitle)document.title=baseTitle;baseTitle='';}return;}
  if(titleTimer)return;baseTitle=document.title;let on=false;
  titleTimer=setInterval(()=>{const top=[...urgent.values()].sort((a,b)=>b.at-a.at)[0];on=!on;document.title=on&&top?'('+urgent.size+') '+top.n.title+'!':baseTitle;},1200);
 }
 function repeat(){
  if(repeatTimer)return;
  repeatTimer=setInterval(()=>{const live=[...urgent.values()].filter(x=>x.loud);if(!live.length||Date.now()>repeatUntil){clearInterval(repeatTimer);repeatTimer=null;return;}if(live.some(x=>x.ctx.preferences.sound!==false))chime(live.sort((a,b)=>b.at-a.at)[0].kind);},REPEAT_MS);
 }
 function saleAlert(ctx,n,kind,loud=true){
  const key=C.key(ctx.store,ctx.role)+':'+n.id;if(urgent.has(key))return;
  urgent.set(key,{key,ctx,n,kind,loud,at:Date.parse(n.created_at)||Date.now()});
  if(ctx.preferences.sound!==false)chime(kind);
  if(loud){repeatUntil=Date.now()+REPEAT_FOR;repeat();}
  paintUrgent();flashTitle();paintBadge();
 }
 function dismissUrgent(key){if(!urgent.delete(key))return;paintUrgent();flashTitle();}
 function announcePending(ctx,items){
  if(ctx.role!=='admin')return;const recent=Date.now()-12*3600000;
  for(const n of items.filter(n=>!n.read&&C.lane(ctx.role,n)!=='system'&&Date.parse(n.created_at)>=recent).slice(0,10).reverse())saleAlert(ctx,n,C.lane(ctx.role,n),false);
 }
 async function channels(){if(!native||!local)return;await local.createChannel({id:'doce_alertas',name:'Pedidos e avisos',importance:4,visibility:0,sound:'default'});await local.createChannel({id:'doce_silenciosas',name:'Avisos sem som',importance:2,visibility:0});}
 async function enableLocal(ctx){
  if(native&&local){const permission=await local.requestPermissions();if(permission.display!=='granted')throw Error('Notificações não autorizadas. Você pode permitir nas configurações do Android.');await channels();}
  else{if(!('Notification'in window))throw Error('Este navegador não oferece notificações. A central continua disponível.');if(await Notification.requestPermission()!=='granted')throw Error('Permissão não concedida. A central continua disponível.');}
  await setPref(ctx,{desktop:true});
 }
 function toast(ctx,n){
  let host=document.getElementById('doce-notice-toasts');if(!host){host=el('aside');host.id='doce-notice-toasts';host.setAttribute('aria-live','polite');document.body.append(host);}
  const row=el('div',undefined,'doce-notice-toast');row.append(el('strong',(ctx.shop?.name||ctx.store.name||'Loja')+' · '+n.title),el('p',n.body));const actions=el('div',undefined,'notice-actions');actions.append(button('Conferir',()=>{row.remove();return showNotice({...n,ctx});}),button('Fechar',()=>row.remove()));row.append(actions);host.append(row);while(host.children.length>3)host.firstElementChild.remove();setTimeout(()=>row.remove(),10000);
 }
 async function alert(ctx,n){
  if(ctx.preferences.categories[n.category]===false)return;
  const kind=C.lane(ctx.role,n);
  if(kind!=='system')saleAlert(ctx,n,kind);
  else{toast(ctx,n);if(ctx.preferences.sound&&(!native||!ctx.preferences.desktop))sound();}
  if(!ctx.preferences.desktop||native&&ctx.preferences.push&&Date.now()<skipDeviceAlertUntil)return;
  if(native&&local){try{await local.schedule({notifications:[{id:C.nativeId(C.key(ctx.store,ctx.role)+':'+n.id),title:(ctx.shop?.name||ctx.store.name)+' · '+n.title,body:n.body,channelId:ctx.preferences.sound?'doce_alertas':'doce_silenciosas',smallIcon:'ic_notification',extra:{shop_id:ctx.store.id,api:ctx.store.api,role:ctx.role,target:n.target,notice_id:String(n.id)}}]});}catch{}}
  else if('Notification'in window&&Notification.permission==='granted'){const note=new Notification((ctx.shop?.name||ctx.store.name)+' · '+n.title,{body:n.body,tag:C.key(ctx.store,ctx.role)+':'+n.id,silent:!ctx.preferences.sound,requireInteraction:kind!=='system'});note.onclick=()=>{window.focus();void showNotice({...n,ctx});};}
 }
 async function register(ctx){if(!osToken||!ctx.preferences.push)return;const key=C.key(ctx.store,ctx.role)+':'+osToken;if(ctx.registered===key)return;await ctx.request('/push','POST',{token:osToken,installation});ctx.registered=key;}
 async function enablePush(ctx){
  if(ctx.preferences.push){await setPref(ctx,{push:false});if(osToken)await ctx.request('/push/remove','POST',{token:osToken,installation});return;}
  if(!native||!push||!ctx.configured||!window.DOCE_PUSH_BUILD?.firebase)throw Error('Conecte o Firebase no app e no servidor antes de ativar o push.');
  const p=await push.requestPermissions();if(p.receive!=='granted')throw Error('Permita notificações nas configurações do Android.');await channels();await setPref(ctx,{push:true,desktop:true});await setupPush();registrationStarted=true;await push.register();
 }
 function handleAction(data){try{const store=DoceStores.parse(data.shop_id,data.api),role=['admin','professional'].includes(data.role)?data.role:'customer',target=typeof data.target==='string'?JSON.parse(data.target):data.target||{};target.notice_id=data.notice_id;location.href=C.route(store,role,target,document.baseURI);}catch{errorMessage='Não foi possível abrir este aviso. Entre pela vitrine da loja.';render();}}
 async function setupPush(){if(pushReady||!push)return;pushReady=true;
  await push.addListener('registration',token=>{osToken=token.value;void Promise.allSettled([...contexts.values()].map(register));});
  await push.addListener('registrationError',()=>{errorMessage='Não foi possível conectar o push. Confira a configuração do Firebase.';render();});
  await push.addListener('pushNotificationReceived',()=>void poll());
  await push.addListener('pushNotificationActionPerformed',action=>handleAction(action.notification.data));
 }
 const draftKey=ctx=>'doce-notice-draft:'+C.key(ctx.store,'admin');
 function draft(store,dirty){const key='doce-notice-draft:'+C.key(store,'admin'),id=C.nativeId('draft:'+key);let value;try{value=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(!dirty){localStorage.removeItem(key);if(local)void local.cancel({notifications:[{id}]}).catch(()=>{});paintBadge();return;}
  if(!value){value={since:Date.now(),read:false};localStorage.setItem(key,JSON.stringify(value));}
  const ctx=contexts.get(C.key(store,'admin'));if(ctx?.preferences.desktop&&ctx.preferences.categories.drafts!==false&&local&&!value.scheduled){value.scheduled=true;localStorage.setItem(key,JSON.stringify(value));void local.schedule({notifications:[{id,title:(ctx.shop?.name||store.name||'Sua loja')+' · Alterações não enviadas',body:'Seu rascunho continua neste aparelho. Abra a administração para revisar e enviar.',schedule:{at:new Date(Math.max(Date.now()+1000,value.since+300000))},channelId:ctx.preferences.sound?'doce_alertas':'doce_silenciosas',smallIcon:'ic_notification',extra:{shop_id:store.id,api:store.api,role:'admin',target:{screen:'drafts'}}}]}).catch(()=>{value.scheduled=false;localStorage.setItem(key,JSON.stringify(value));});}
 }
 function draftRows(){const rows=[];for(const ctx of contexts.values()){if(ctx.role!=='admin'||ctx.preferences.categories.drafts===false)continue;let value;try{value=JSON.parse(localStorage.getItem(draftKey(ctx))||'null');}catch{}if(!value||Date.now()-value.since<300000)continue;rows.push({id:'draft',local:true,ctx,created_at:new Date(value.since+300000).toISOString(),read:value.read,title:'Alterações não enviadas',body:'Há um rascunho neste aparelho. Revise e use Enviar alterações para publicar.',target:{screen:'drafts'},category:'drafts'});}return rows;}
 function markDraft(n){const key=draftKey(n.ctx);try{const value=JSON.parse(localStorage.getItem(key));value.read=true;localStorage.setItem(key,JSON.stringify(value));}catch{}paintBadge();render();}
 function checkDrafts(){for(const n of draftRows()){try{const key=draftKey(n.ctx),value=JSON.parse(localStorage.getItem(key));if(!value.announced){value.announced=true;localStorage.setItem(key,JSON.stringify(value));toast(n.ctx,n);}}catch{}}paintBadge();}
 function navigate(fn){if(current)current.navigate=fn;}
 const style=document.createElement('style');style.textContent=`.doce-notice-bell{position:relative;margin-right:8px;display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border:1px solid #eadfe4;border-radius:16px;background:white;color:var(--p,#985272);cursor:pointer}.doce-notice-bell svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.doce-notice-bell span{position:absolute;right:-3px;top:-5px;border-radius:20px;background:#985272;color:white;font:700 11px system-ui;padding:3px 5px}.doce-notice-bell span[hidden]{display:none}#doce-notification-center{width:min(640px,calc(100vw - 24px));max-height:88dvh;box-sizing:border-box;border:0;border-radius:22px;padding:20px;background:#fff9f6;color:#32222f;font:15px system-ui}#doce-notification-center::backdrop{background:#25162280;backdrop-filter:blur(3px)}.notice-center-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;position:sticky;top:-20px;background:#fff9f6;z-index:1}.notice-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.notice-card,.notice-preferences{background:white;border:1px solid #eadfe4;border-radius:16px;padding:16px;margin:12px 0}.notice-card.unread{border-left:5px solid var(--p,#985272)}.notice-card h3{font-size:16px;margin:12px 0 8px}.notice-store{display:flex;align-items:center;gap:10px;font-size:13px}.notice-store img,.notice-monogram{width:32px;height:32px;border-radius:10px;object-fit:contain}.notice-monogram{display:grid;place-items:center;background:#f3e1e9;color:#985272;font-weight:bold}.notice-toggle{display:flex;gap:10px;align-items:center;margin:14px 0}.notice-toggle input{width:20px;height:20px}.notice-error{color:#9d223e}.notice-preferences summary{font-weight:600;cursor:pointer}#doce-notification-center .btn{padding:9px 12px;border:1px solid #eadfe4;border-radius:12px;background:white;color:#49313f;font:600 13px system-ui;cursor:pointer}#doce-notification-center .primary{background:var(--p,#985272);color:white}`;document.head.append(style);
 style.textContent+='header:has(>.doce-notice-bell){position:relative}header>.doce-notice-bell{position:absolute;right:max(24px,calc((100vw - 1060px)/2));top:30px}#doce-notice-toasts{position:fixed;bottom:calc(85px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));z-index:900}.doce-notice-toast{background:#fff9f6;border:1px solid #eadfe4;border-left:5px solid var(--p,#985272);box-shadow:0 8px 30px #32222f26;padding:15px;border-radius:18px;margin-top:8px;color:#32222f;font:14px system-ui}.doce-notice-toast p{margin:8px 0}.doce-notice-toast .btn{border:1px solid #eadfe4;border-radius:12px;background:white;padding:8px 12px;cursor:pointer}';
 style.textContent+=`.notice-list-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px}.notice-filter{display:flex;align-items:center;gap:10px;font-size:13px}.notice-filter select{width:auto;margin:0;padding:9px 12px;border:1px solid #eadfe4;border-radius:12px;background:white;color:#49313f;font:inherit}.notice-list-summary{font-size:12px;color:#786672;margin:12px 0}.notice-preview{position:relative;display:flex;flex-direction:column;gap:6px;width:100%;text-align:left;background:white;border:1px solid #eadfe4;border-radius:14px;padding:13px 15px;margin:9px 0;color:#32222f;cursor:pointer;font:14px system-ui}.notice-preview.unread{border-left:4px solid var(--p,#985272)}.notice-preview-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:1.3}.notice-preview-body{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.4;color:#786672}.notice-preview-meta{font-size:10px;line-height:1.4;color:#786672}.notice-list-footer{justify-content:space-between;margin-top:14px}.notice-full{padding:16px 0}.notice-full h3{font-size:21px;line-height:1.3;margin:14px 0}.notice-full-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.6}.notice-preview:focus-visible{outline:3px solid var(--p,#985272);outline-offset:2px}`;
 function focusTarget(target){const id=target.order_id||target.quote_id;if(!id)return;const node=[...document.querySelectorAll('[data-order-id],[data-quote-id]')].find(n=>n.dataset.orderId===id||n.dataset.quoteId===id);if(node){node.classList.add('notice-target');node.tabIndex=-1;node.scrollIntoView({block:'center'});node.focus({preventScroll:true});setTimeout(()=>node.classList.remove('notice-target'),10000);}}
 async function consume(ctx){const id=Number(new URLSearchParams(location.search).get('notification_id'));if(Number.isSafeInteger(id)&&id>0){try{await ctx.request('/read','POST',{ids:[id]});await load(ctx);}catch{/* A stale/deleted notice must not block opening the shop. */}}}
 style.textContent+='.notice-target{outline:3px solid var(--p,#985272);outline-offset:4px}';
 // Sales lane: green for orders, amber for quotes, blue for salon bookings; system notices stay neutral.
 style.textContent+=`#doce-sale-alerts{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(480px,calc(100vw - 20px));z-index:2147483000;display:flex;flex-direction:column;gap:8px;pointer-events:none}#doce-sale-alerts>*{pointer-events:auto}
.sale-alert{--lane:#1f8a4c;--soft:#e8f6ee;background:#fff;border:2px solid var(--lane);border-radius:20px;padding:16px;box-shadow:0 14px 40px #1f141c40;color:#2a1f27;font:15px system-ui;animation:sale-in .35s ease-out,sale-pulse 2s ease-in-out .35s 3}
.sale-alert.lane-quote{--lane:#b86e00;--soft:#fff3df}.sale-alert.lane-booking{--lane:#2f5fb3;--soft:#e8effb}
.sale-alert-head{display:flex;gap:12px;align-items:center}.sale-alert-icon{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--lane);color:#fff}.sale-alert svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.sale-alert-kind{display:block;font:800 11px system-ui;letter-spacing:.06em;color:var(--lane)}.sale-alert-title{display:block;font-size:19px;line-height:1.25}.sale-alert-body{margin:10px 0 4px;line-height:1.45}.sale-alert-meta{color:#786672;font-size:12px}
.sale-alert-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.sale-alert-actions .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border:1px solid #e3d9df;border-radius:12px;background:#fff;color:#3b2a35;font:700 14px system-ui;cursor:pointer}.sale-alert-actions .btn svg{width:18px;height:18px}.sale-alert-actions .btn.primary{background:var(--lane);border-color:var(--lane);color:#fff;flex:1;justify-content:center}
.sale-sound-off{align-self:center;display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid #e3d9df;border-radius:999px;background:#fff8e6;color:#6b4a00;font:700 13px system-ui;box-shadow:0 6px 18px #1f141c26;cursor:pointer}.sale-sound-off svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@keyframes sale-in{from{transform:translateY(-16px);opacity:0}}@keyframes sale-pulse{50%{box-shadow:0 0 0 8px color-mix(in srgb,var(--lane) 22%,transparent),0 14px 40px #1f141c40}}
@media (prefers-reduced-motion:reduce){.sale-alert{animation:none}}
.doce-notice-bell.hot{border-color:#1f8a4c;color:#1f8a4c}.doce-notice-bell.hot span{background:#1f8a4c;animation:sale-badge 1.4s ease-in-out infinite}@keyframes sale-badge{50%{transform:scale(1.18)}}
.notice-chip{align-self:flex-start;display:inline-block;padding:2px 9px;border-radius:999px;font:800 11px system-ui;letter-spacing:.04em;color:#fff;background:#1f8a4c}.notice-chip.lane-quote{background:#b86e00}.notice-chip.lane-booking{background:#2f5fb3}
.notice-preview.lane-order.unread{border-left:5px solid #1f8a4c;background:#f4fbf7}.notice-preview.lane-quote.unread{border-left:5px solid #b86e00;background:#fffaf0}.notice-preview.lane-booking.unread{border-left:5px solid #2f5fb3;background:#f4f7fd}.notice-preview.lane-system{background:#fbf9fa}.notice-preview.lane-system.unread{border-left:4px solid #9a8f96}`;
 window.DoceNotify={connect,navigate,draft,focusTarget,consume,refresh:poll,track:trackUsage,open:()=>{selectedNotice=null;preferencesVisible=false;render();dialog.showModal();}};
 document.addEventListener('DOMContentLoaded',()=>{initialized=true;mount();customerContexts();void poll();});
 new MutationObserver(()=>{if(initialized)mount();}).observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){skipDeviceAlertUntil=Date.now()+10000;void poll();}});window.addEventListener('storage',()=>void poll());
 setInterval(()=>void poll(),15000);
 if(local)void local.addListener('localNotificationActionPerformed',action=>handleAction(action.notification.extra));
 if(native&&push&&window.DOCE_PUSH_BUILD?.firebase){void setupPush().then(()=>{if([...contexts.values()].some(c=>c.preferences.push))return push.register();}).catch(()=>{});}
})();
