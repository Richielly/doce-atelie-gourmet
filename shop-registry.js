/* Public store membership only. Administrative credentials never belong here. */
(function(root){
 'use strict';
 const ID=/^[a-zA-Z0-9-]{10,64}$/;
 function apiOrigin(value){
  const url=new URL(String(value).trim());
  if(url.username||url.password||url.search||url.hash||!/^\/*$/.test(url.pathname)||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='localhost')))throw Error('Use o endereço HTTPS da API (ou http://localhost para testes), sem caminho.');
  return url.origin;
 }
 function parse(value,fallbackApi){
  let id='',api=fallbackApi;
  const raw=String(value).trim();
  if(ID.test(raw))id=raw;
  else {
   let url;try{url=new URL(raw);}catch{throw Error('QR Code da loja não reconhecido.');}
   if(url.protocol==='doceatelie:'&&url.hostname==='loja'){
    id=decodeURIComponent(url.pathname.replace(/^\//,''));api=url.searchParams.get('api')||api;
   }else if(url.protocol==='https:'||url.protocol==='http:'){
    if(url.username||url.password)throw Error('Link de loja inválido.');
    id=url.searchParams.get('loja')||url.searchParams.get('shop')||url.pathname.match(/^\/public\/shops\/([^/]+)\/?$/)?.[1]||'';
    api=url.searchParams.get('api')||url.origin;
   }
  }
  if(!ID.test(id))throw Error('QR Code da loja não reconhecido.');
  if(!api)throw Error('Este QR antigo contém somente o ID. Informe o endereço da API da loja.');
  return {id,api:apiOrigin(api)};
 }
 function key(store){return JSON.stringify([apiOrigin(store.api),store.id]);}
 function qr(store){if(!ID.test(store.id))throw Error('ID inválido');const url=new URL('/app',apiOrigin(store.api));url.searchParams.set('loja',store.id);return url.href;}
 function create(storage){
  const STORE='doce-saved-shops-v1',ACTIVE='doce-active-customer-shop-v1';
  const liveBrands=new Map();
  function compact(brand){const data={};for(const name of ['bannerColor','bannerTitle','bannerSubtitle','headerSubtitle','backgroundColor','bannerTextColor'])if(typeof brand[name]==='string')data[name]=brand[name].slice(0,350);for(const name of ['icon','logo'])if(typeof brand[name]==='string'&&brand[name].length<16000)data[name]=brand[name];const slide=brand.slides?.[0];if(slide?.image&&slide.image.length<16000)data.slides=[{image:slide.image}];return data;}
  function disk(store){return {...store,branding:compact(store.branding||{})};}
  function list(){try{return JSON.parse(storage.getItem(STORE)||'[]').filter(s=>{try{return s&&ID.test(s.id)&&apiOrigin(s.api)===s.api;}catch{return false;}}).map(s=>({...s,branding:liveBrands.get(key(s))||{...(root?.DoceBrandCache?.get(key(s))||{}),...(s.branding||{})}}));}catch{return [];}}
  function update(store){const normalized={id:store.id,api:apiOrigin(store.api),name:String(store.name||list().find(s=>key(s)===key(store))?.name||store.id),branding:store.branding||{},color:store.color||'#a84e6e',available:store.available!==false};if(!ID.test(normalized.id))throw Error('ID inválido');liveBrands.set(key(normalized),normalized.branding);if(store.branding&&store.available!==false)void root?.DoceBrandCache?.put(key(normalized),normalized.branding);const all=list(),index=all.findIndex(s=>key(s)===key(normalized));if(index<0)all.push(normalized);else all[index]=normalized;storage.setItem(STORE,JSON.stringify(all.map(disk)));return normalized;}
  function save(store){const normalized=update(store);storage.setItem(ACTIVE,JSON.stringify(disk(normalized)));return normalized;}
  function remove(store){void root?.DoceBrandCache?.remove(key(store));storage.setItem(STORE,JSON.stringify(list().filter(s=>key(s)!==key(store)).map(disk)));const selected=active();if(selected&&key(selected)===key(store))storage.removeItem(ACTIVE);}
  function active(){try{return JSON.parse(storage.getItem(ACTIVE)||'null');}catch{return null;}}
  function cart(store,value){const name='doce-cart:'+key(store);if(value!==undefined)storage.setItem(name,JSON.stringify(value));try{return JSON.parse(storage.getItem(name)||'{}');}catch{return {};}}
  function tracking(store,value){const name='doce-tracking:'+key(store);if(value!==undefined)storage.setItem(name,JSON.stringify(value));try{return JSON.parse(storage.getItem(name)||'null');}catch{return null;}}
  function migrateLegacy(){if(list().length)return;const id=storage.getItem('doce-shop-id'),api=storage.getItem('doce-api-url');if(id&&api){try{save({...parse(id,api),name:'Loja já conectada'});}catch{}}}
  function replaceAddress(previous,verified){if(previous.id!==verified.id)throw Error('A loja verificada precisa ter o mesmo ID.');const all=list().filter(s=>key(s)!==key(previous));storage.setItem(STORE,JSON.stringify(all.map(disk)));return save(verified);}
  return {list,save,update,remove,active,cart,tracking,migrateLegacy,replaceAddress};
 }
 const api={apiOrigin,parse,key,qr,create};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root){root.DoceStores=api;api.registry=create(root.localStorage);}
})(typeof window!=='undefined'?window:null);
