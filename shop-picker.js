import {DoceAtelieAPI} from './api-client.js';
const $=id=>document.getElementById(id),stores=window.DoceStores,registry=stores.registry;
let stream=null,timer=null,reading=false;
function notice(text,error=false){$('notice').hidden=false;$('notice').textContent=text;$('notice').className=error?'error':'';}
async function lookup(value){
 let store;try{store=stores.parse(value,registry.active()?.api);}catch{throw Error('Este QR não contém um link completo da loja. Peça ao lojista para atualizar o QR Code.');}
 try{const catalog=await new DoceAtelieAPI(store.api).catalog(store.id);if(catalog.shop.id!==store.id)throw Error('Loja inválida.');return registry.save({...store,name:catalog.shop.name,branding:catalog.shop.branding,color:catalog.settings?.color,available:true});}
 catch(e){if(e.status===404)throw Error('Esta loja não está disponível no momento. Consulte o lojista.');throw Error('Não foi possível acessar a loja agora. Confira sua conexão ou tente novamente mais tarde.');}
}
async function open(value,entry=''){const end=DoceLoading.begin();try{const store=await lookup(value);await window.DoceBrandCache?.put(stores.key(store),store.branding||{});location.href='index.html?loja='+encodeURIComponent(store.id)+'&api='+encodeURIComponent(store.api)+(entry==='qr'?'&entry=qr':'');}catch(e){end();throw e;}}
async function action(fn){const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){notice(e.message,true);}finally{buttons.forEach(b=>b.disabled=false);}}
function picture(value){return typeof value==='string'&&/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(value)?value:'';}
function render(changedStore){
 if(!changedStore)$('saved').replaceChildren();
 for(const store of changedStore?[changedStore]:registry.list()){
  const brand=store.branding||{},card=document.createElement('article');card.className='store-card';card.dataset.storeKey=stores.key(store);
  const color=/^#[a-f0-9]{3,8}$/i.test(brand.bannerColor||store.color)?(brand.bannerColor||store.color):'#a84e6e';card.style.setProperty('--store-color',color);
  const cover=document.createElement('div');cover.className='store-cover';const image=picture(brand.slides?.[0]?.image||brand.logo);
  if(image){const img=document.createElement('img');img.src=image;img.alt='';cover.append(img);}else{const letter=document.createElement('span');letter.className='monogram';letter.textContent=store.name.slice(0,1).toUpperCase();cover.append(letter);}
  const icon=picture(brand.icon||brand.logo);if(icon){const img=document.createElement('img');img.className='store-icon';img.src=icon;img.alt='Marca de '+store.name;card.append(img);}
  const body=document.createElement('div');body.className='store-body';const name=document.createElement('h2'),description=document.createElement('p');name.textContent=store.name;description.textContent=brand.bannerSubtitle||brand.headerSubtitle||'Conheça este estabelecimento e aproveite seus produtos, serviços e benefícios.';body.append(name,description);
  if(store.available===false){const badge=document.createElement('p');badge.className='unavailable';badge.textContent='Temporariamente indisponível';body.append(badge);}
  const button=document.createElement('button');button.className='enter';button.textContent='Entrar na loja';button.onclick=()=>void action(()=>open(stores.qr(store)));
  const remove=document.createElement('button');remove.className='remove';remove.textContent='Remover da minha vitrine';remove.onclick=()=>{if(confirm('Remover '+store.name+' da sua vitrine? Você poderá adicioná-la novamente pelo QR Code.')){registry.remove(store);render();}};
  body.append(button,remove);card.prepend(cover);card.append(body);const previous=[...$('saved').children].find(n=>n.dataset.storeKey===stores.key(store));if(previous)previous.replaceWith(card);else $('saved').append(card);
 }
 if(!registry.list().length){const empty=document.createElement('div');empty.className='empty';const title=document.createElement('h2'),text=document.createElement('p');title.textContent='Sua próxima loja começa aqui';text.textContent='Leia o QR Code disponibilizado por uma loja para adicioná-la à sua vitrine.';empty.append(title,text);$('saved').append(empty);}
}
let refreshing=false;const retryAfter=new Map();
async function refreshCards(){
 if(refreshing||document.hidden)return;refreshing=true;
 try{await window.DoceBrandCache?.ready;const queue=registry.list().filter(s=>!window.DoceBrandCache?.fresh(stores.key(s))&&Date.now()>(retryAfter.get(stores.key(s))||0));
 async function worker(){while(queue.length&&!document.hidden){const store=queue.shift(),key=stores.key(store),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const client=new DoceAtelieAPI(store.api);let data;try{data=await client.identity(store.id,{signal:controller.signal});}catch(e){if(e.status!==404)throw e;data=await client.catalog(store.id,{signal:controller.signal});}
   if(data.shop?.id!==store.id)throw Error('Identidade inválida');if(!registry.list().some(s=>stores.key(s)===key))continue;
   const updated=registry.update({...store,name:data.shop.name,branding:data.shop.branding||{},color:data.settings?.color,available:true});await window.DoceBrandCache?.put(key,data.shop.branding||{});if(registry.list().some(s=>stores.key(s)===key))render({...updated,branding:window.DoceBrandCache?.get(key)||updated.branding});
  }catch(e){retryAfter.set(key,Date.now()+15*60*1000);if(e.status===404&&registry.list().some(s=>stores.key(s)===key)){const updated=registry.update({...store,available:false});render(updated);}}
  finally{clearTimeout(timer);}
 }}await Promise.all([worker(),worker()]);
 }finally{refreshing=false;}
}
function stop(){if(timer)clearInterval(timer);timer=null;if(stream)stream.getTracks().forEach(track=>track.stop());stream=null;$('video').srcObject=null;reading=false;}
async function scan(){
 if(!navigator.mediaDevices?.getUserMedia||typeof window.jsQR!=='function')throw Error('A câmera não está disponível. Use Tenho um link da loja ou verifique a permissão da câmera.');
 $('camera').showModal();
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(!$('camera').open){stop();return;}
  const video=$('video');video.srcObject=stream;await video.play();const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  timer=setInterval(()=>{if(reading||!video.videoWidth)return;const ratio=Math.min(1,800/video.videoWidth);canvas.width=Math.floor(video.videoWidth*ratio);canvas.height=Math.floor(video.videoHeight*ratio);ctx.drawImage(video,0,0,canvas.width,canvas.height);const image=ctx.getImageData(0,0,canvas.width,canvas.height),code=window.jsQR(image.data,image.width,image.height);if(code){reading=true;stop();$('camera').close();void action(()=>open(code.data,'qr'));}},300);
 }catch(e){stop();$('camera').close();throw Error(e.name==='NotAllowedError'?'Permita o acesso à câmera nas configurações do aplicativo.':'Não foi possível abrir a câmera. Tente novamente.');}
}
$('scan').onclick=()=>void action(scan);$('paste').onclick=()=>$('add').showModal();$('close-add').onclick=()=>$('add').close();$('close-camera').onclick=()=>$('camera').close();$('camera').addEventListener('close',stop);
$('add-form').onsubmit=e=>{e.preventDefault();void action(()=>open($('qr-value').value));};
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if($('camera').open)$('camera').close();}else void refreshCards();});
void (async()=>{await window.DoceBrandCache?.ready;render();void refreshCards();if(new URLSearchParams(location.search).has('scan'))void action(scan);})();
