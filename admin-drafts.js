/* Large photos and multiple shops must not exhaust localStorage. Drafts live in IndexedDB. */
(function(root){
 'use strict';
 if(!root)return;
 let opening;
 function open(){if(!opening)opening=new Promise((resolve,reject)=>{const r=indexedDB.open('doce-admin-drafts-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return opening;}
 async function run(store,mode,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),bucket=tx.objectStore('drafts'),key=DoceTenants.key(store),request=mode==='readonly'?bucket.get(key):bucket.put(value,key);tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Armazenamento interrompido.'));});}
 root.DoceAdminDrafts={load:store=>run(store,'readonly'),save:(store,value)=>run(store,'readwrite',value)};
})(typeof window!=='undefined'?window:null);
