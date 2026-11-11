/* Pure tenant/role routing shared by the UI and regression tests. */
(function(root){
 'use strict';
 const categories={orders:'Pedidos',quotes:'Orçamentos',benefits:'Fidelidade e vouchers',inventory:'Estoque e validade',on_way:'Cliente a caminho',drafts:'Alterações não enviadas',salon:'Agenda, encaixes e retornos',offers:'Ofertas e campanhas'};
 const pages={customer:{orders:'orders',quotes:'quotes',loyalty:'loyalty',salon:'salon',catalog:'home',account:'profile'},admin:{orders:'deliveries',quotes:'booking',stock:'stock',pantry:'pantry',drafts:'dashboard',dashboard:'dashboard',salon:'salon',campaigns:'campaigns'},professional:{salon:'salon'}};
 function key(store,role){return JSON.stringify([store.api.replace(/\/+$/,''),store.id,role]);}
 function route(store,role,target={},base='http://localhost/index.html'){
  const api=new URL(store.api);if(api.username||api.password||api.search||api.hash||api.pathname!=='/'||!(api.protocol==='https:'||api.protocol==='http:'&&api.hostname==='localhost'))throw Error('Servidor da notificação inválido.');
  if(!/^[a-zA-Z0-9-]{10,64}$/.test(store.id)||!pages[role])throw Error('Loja da notificação inválida.');
  const isSalon=role==='professional'||target.screen==='salon',url=new URL(isSalon?'salon.html':'index.html',base);url.searchParams.set(role==='admin'||role==='professional'?'shop':'loja',store.id);if(isSalon)url.searchParams.set('role',role);else if(role==='admin')url.searchParams.set('admin','1');url.searchParams.set('api',api.origin);
  url.searchParams.set('notification_page',pages[role][target.screen]||Object.values(pages[role])[0]);
  const id=target.order_id||target.quote_id||target.appointment_id||target.offer_id;if(typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id))url.searchParams.set('notification_item',id);
  const noticeId=Number(target.notice_id);if(Number.isSafeInteger(noticeId)&&noticeId>0)url.searchParams.set('notification_id',String(noticeId));
  return url.href;
 }
 function merge(previous,incoming){const all=new Map(previous.map(x=>[x.id,x]));for(const row of incoming)all.set(row.id,row);return [...all.values()].sort((a,b)=>b.id-a.id).slice(0,300);}
 function hasAction(role,target){return !!(target&&typeof target==='object'&&Object.hasOwn(pages[role]||{},target.screen));}
 function previews(entries){return [...entries].sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||(Number(b.id)||0)-(Number(a.id)||0)).slice(0,5);}
 function nativeId(value){let hash=2166136261;for(const c of value)hash=Math.imul(hash^c.charCodeAt(0),16777619);return (hash>>>0)%2147483646+1;}
 // Business alerts the owner must not miss (sale, quote, booking) versus system/housekeeping notices.
 const salonUrgent=/^(Novo agendamento|Agendamento cancelado|Atendimento precisa de remanejamento|Profissional informou uma ausência|Presença confirmada|Cliente chegou)/;
 function lane(role,n){
  if(role!=='admin'||!n||n.local||n.title==='Resumo da semana')return 'system';
  if(n.category==='orders'||n.category==='on_way')return 'order';
  if(n.category==='quotes')return 'quote';
  if(n.category==='salon'&&salonUrgent.test(String(n.title||'')))return 'booking';
  return 'system';
 }
 const lanes={order:{label:'Pedido',action:'Ver pedido'},quote:{label:'Orçamento',action:'Ver orçamento'},booking:{label:'Agendamento',action:'Ver agenda'},system:{label:'Sistema',action:'Ver'}};
 const api={categories,pages,key,route,merge,nativeId,hasAction,previews,lane,lanes};if(typeof module!=='undefined')module.exports=api;if(root)root.DoceNotificationCore=api;
})(typeof window!=='undefined'?window:null);
