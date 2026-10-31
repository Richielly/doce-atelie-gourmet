import {DoceAtelieAPI} from './api-client.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let source;
try{source=JSON.parse(localStorage.getItem('doce-atelier-v1')||'{}');}catch{source={};}
$('api').value=params.get('api')||localStorage.getItem('doce-api-url')||'';
$('shop').value=params.get('shop')||localStorage.getItem('doce-shop-id')||'';
function notice(text,error=false){$('notice').hidden=false;$('notice').textContent=text;$('notice').className=error?'error':'';}
function preview(){const products=Array.isArray(source.products)?source.products:[];$('summary').textContent=products.length+' produtos encontrados nesta cópia local.';$('preview').replaceChildren();for(const p of products){const li=document.createElement('li');li.textContent=String(p.name||'Sem nome')+' · '+Number(p.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+' · Estoque: '+(p.stock??0);$('preview').append(li);}$('publish').disabled=!products.length;}
function activationLink(){$('activate').href='gestao-conectada.html?api='+encodeURIComponent($('api').value.trim())+'&shop='+encodeURIComponent($('shop').value.trim());}
$('api').oninput=activationLink;$('shop').oninput=activationLink;
$('backup').onchange=async()=>{try{const file=$('backup').files[0];if(!file)return;if(file.size>32*1024*1024)throw Error('Backup excede 32 MB.');const data=JSON.parse(await file.text());if(!Array.isArray(data.products))throw Error('Backup sem produtos.');source=data;preview();notice('Backup carregado para revisão. Nenhum dado local foi substituído.');}catch(e){notice(e.message,true);}};
async function privateKey(api,shop){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('doce-atelie-admin-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys','readonly'),r=tx.objectStore('keys').get('doce-admin-key-'+shop+'@'+api);tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
$('publish-form').onsubmit=async e=>{e.preventDefault();$('publish').disabled=true;try{
 const selected=DoceStores.parse($('shop').value,$('api').value),client=new DoceAtelieAPI(selected.api);
 const catalog=await client.catalog(selected.id);
 const key=await privateKey(selected.api,selected.id);
 if(!key)throw Error('Ative a administração deste aparelho para esta loja pelo link acima e depois volte a esta tela.');
 const challenge=await client.challenge(selected.id);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('Ed25519',key,new TextEncoder().encode(challenge.nonce))),n=>n.toString(16).padStart(2,'0')).join('');
 const session=await client.session(selected.id,challenge.challenge_id,challenge.nonce,signature),prefix='/admin/shops/'+encodeURIComponent(selected.id);
 const workspace=await client.request(prefix+'/workspace',{token:session.access_token});
 const existing=await client.products(selected.id,session.access_token);
 const merged=DocePublish.merge(source.products,workspace,existing);
 if(!merged.added){notice('Os produtos desta cópia já existem no servidor. Nenhum produto foi alterado.');return;}
 if(!confirm('Publicar '+merged.added+' produtos em '+catalog.shop.name+' (ID '+selected.id+')? '+merged.skipped+' produtos já existentes serão mantidos. A cópia local não será apagada.'))return;
 await client.request(prefix+'/workspace',{method:'PUT',token:session.access_token,body:{revision:workspace.revision,data:merged.data}});
 DoceStores.registry.save({...selected,name:catalog.shop.name});
 notice(merged.added+' produtos publicados. Os clientes já podem consultar o catálogo pelo QR Code. A cópia local foi preservada.');
 $('catalog').hidden=false;$('catalog').href='loja-online.html?api='+encodeURIComponent(selected.api)+'&shop='+encodeURIComponent(selected.id);
 }catch(error){notice(error.message,true);}finally{preview();}};
activationLink();preview();
