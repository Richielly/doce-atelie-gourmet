/* Bounded public identity cache. Never stores catalogs, sessions or customer data. */
(function(root){
 'use strict';
 const MAX_BYTES=8*1024*1024,MAX_STORES=100,FRESH=6*60*60*1000;
 function create(adapter){
  const records=new Map(),pending=new Map();let writes=Promise.resolve();
  const ready=adapter.read().then(rows=>{for(const r of rows||[])if(r&&typeof r.key==='string'&&r.brand&&r.size<=160000)records.set(r.key,r);}).catch(()=>{});
  function trim(){let total=[...records.values()].reduce((s,r)=>s+r.size,0);for(const r of [...records.values()].sort((a,b)=>a.checkedAt-b.checkedAt)){if(records.size<=MAX_STORES&&total<=MAX_BYTES)break;records.delete(r.key);total-=r.size;}}
  function put(key,brand){if(pending.get(key)?.brand===brand)return pending.get(key).promise;writes=writes.catch(()=>{}).then(async()=>{await ready;const small={};for(const k of ['bannerColor','bannerTitle','bannerSubtitle','headerSubtitle','backgroundColor','bannerTextColor'])if(typeof brand[k]==='string')small[k]=brand[k].slice(0,350);
   const icon=brand.icon||brand.logo,cover=brand.slides?.[0]?.image||brand.logo;
   if(icon)small.icon=await adapter.thumbnail(icon,128);if(cover){const image=await adapter.thumbnail(cover,480);if(brand.slides?.[0]?.image)small.slides=[{image}];else small.logo=image;}
   const record={key,brand:small,checkedAt:adapter.now(),size:JSON.stringify(small).length*2+key.length*2+100};
   if(record.size>160000)return;records.set(key,record);trim();await adapter.write([...records.values()]);
  });const promise=writes.catch(()=>{}).finally(()=>{if(pending.get(key)?.promise===promise)pending.delete(key);});pending.set(key,{brand,promise});return promise;}
  function remove(key){writes=writes.catch(()=>{}).then(async()=>{await ready;records.delete(key);await adapter.write([...records.values()]);});return writes.catch(()=>{});}
  return {ready,put,remove,get:key=>records.get(key)?.brand,fresh:key=>{const r=records.get(key);return !!r&&adapter.now()-r.checkedAt<FRESH;},limits:{maxBytes:MAX_BYTES,maxStores:MAX_STORES,freshMs:FRESH}};
 }
 async function thumbnail(value,max){
  if(typeof value!=='string'||value.length>12000000)return '';
  if(!/^(data:image\/(png|jpeg|webp);base64,|https:\/\/|http:\/\/localhost[:/])/i.test(value))return '';
  try{return await new Promise((resolve,reject)=>{const img=new Image(),timeout=setTimeout(()=>{img.src='';reject(Error('Image timeout'));},8000);img.crossOrigin='anonymous';img.onload=()=>{clearTimeout(timeout);try{const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));c.getContext('2d').drawImage(img,0,0,c.width,c.height);let result=c.toDataURL('image/webp',.72);if(result.length>35000){const small=document.createElement('canvas');small.width=Math.max(1,Math.round(c.width/2));small.height=Math.max(1,Math.round(c.height/2));small.getContext('2d').drawImage(c,0,0,small.width,small.height);result=small.toDataURL('image/webp',.55);}resolve(result.length<=35000?result:'');}catch(e){reject(e);}};img.onerror=()=>{clearTimeout(timeout);reject(Error('Image unavailable'));};img.src=value;});}catch{return /^https?:\/\//.test(value)&&value.length<4000?value:'';}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={create};
 if(!root)return;
 let opening;
 function open(){if(!opening)opening=new Promise((resolve,reject)=>{const r=indexedDB.open('elume-public-brands-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('brands');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Cache unavailable'));});return opening;}
 async function run(mode,rows){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('brands',mode),store=tx.objectStore('brands');let request;if(mode==='readonly')request=store.getAll();else{store.clear();for(const row of rows)store.put(row,row.key);}tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 root.DoceBrandCache=create({read:()=>run('readonly'),write:rows=>run('readwrite',rows),thumbnail,now:()=>Date.now()});
})(typeof window!=='undefined'?window:null);
