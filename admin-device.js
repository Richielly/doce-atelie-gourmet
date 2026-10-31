import {DoceAtelieAPI} from './api-client.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let last;try{last=JSON.parse(localStorage.getItem('doce-admin-last-store')||'null');}catch{}
$('api').value=params.get('api')||last?.api||((location.hostname!=='localhost'||location.port==='6001')?location.origin:'');
$('shop').value=params.get('shop')||last?.id||'';
function message(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';}
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('doce-atelie-admin-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function pair(store,create=false){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys',create?'readwrite':'readonly'),bucket=tx.objectStore('keys'),name='doce-admin-key-'+store.id+'@'+store.api;let privateKey,publicKey;if(create){privateKey=bucket.put(create.privateKey,name);publicKey=bucket.put(create.publicKey,name+'-public');}else{privateKey=bucket.get(name);publicKey=bucket.get(name+'-public');}tx.oncomplete=()=>resolve(create||{privateKey:privateKey.result,publicKey:publicKey.result});tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function run(activate){
 const end=window.DoceLoading?.begin()||(()=>{});
 $('activate').disabled=true;$('login').disabled=true;
 try{
  const store=DoceStores.parse($('shop').value,$('api').value),client=new DoceAtelieAPI(store.api),catalog=await client.catalog(store.id);
  let keys=await pair(store);
  if(activate){
   const code=$('code').value.trim();if(!code)throw Error('Informe o código gerado pelo Master para esta loja.');
   if(!confirm('Autorizar este aparelho a administrar '+catalog.shop.name+'? Os outros aparelhos autorizados continuarão funcionando.'))return;
   if(!keys.privateKey||!keys.publicKey){keys=await crypto.subtle.generateKey('Ed25519',false,['sign','verify']);await pair(store,keys);}
   await client.activate(store.id,code,hex(await crypto.subtle.exportKey('raw',keys.publicKey)));$('code').value='';
  }
  if(!keys.privateKey||!keys.publicKey)throw Error('Este aparelho ainda não está autorizado. Gere uma ativação no Master.');
  const challenge=await client.challenge(store.id,hex(await crypto.subtle.exportKey('raw',keys.publicKey)));
  await client.session(store.id,challenge.challenge_id,challenge.nonce,hex(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(challenge.nonce))));
  localStorage.setItem('doce-admin-last-store',JSON.stringify(store));localStorage.setItem('doce-api-url',store.api);localStorage.setItem('doce-shop-id',store.id);
  location.href='index.html?admin=1&shop='+encodeURIComponent(store.id)+'&api='+encodeURIComponent(store.api);
 }catch(e){message(e.message,true);}finally{end();$('activate').disabled=false;$('login').disabled=false;}
}
$('activate').onclick=()=>void run(true);$('login').onclick=()=>void run(false);
