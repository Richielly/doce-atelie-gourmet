/* Shared, explicit publication affordance. Mounting never sends a draft. */
(function(root){
 'use strict';
 function mount({dirty,running=false,onSend,onError=()=>{}}){
  const doc=root.document;
  doc.getElementById('serverSync')?.remove();
  const legacy=doc.getElementById('salon-sync');if(legacy)legacy.hidden=true;
  let button=doc.getElementById('doce-admin-sync');
  if(!dirty){button?.remove();return;}
  const host=doc.querySelector('.headright');if(!host)return;
  if(!doc.getElementById('doce-admin-sync-style')){
   const style=doc.createElement('style');style.id='doce-admin-sync-style';style.textContent='.doce-admin-sync{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:46px;height:46px;padding:10px;border:1px solid var(--line,#eadfe7);border-radius:15px;background:var(--p,#985272);color:#fff;cursor:pointer}.doce-admin-sync svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.doce-admin-sync:disabled{opacity:.6;cursor:wait}.doce-admin-sync[aria-busy="true"] svg{animation:doce-sync-spin 1s linear infinite}@keyframes doce-sync-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.doce-admin-sync[aria-busy="true"] svg{animation:none}}';doc.head.append(style);
  }
  if(!button){button=doc.createElement('button');button.id='doce-admin-sync';button.type='button';button.className='iconbtn doce-admin-sync';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.2 7a7 7 0 0 1 11.6-1L20 9M4 15l2.2 3A7 7 0 0 0 17.8 17"/></svg>';host.append(button);}
  button.disabled=!!running;button.title=running?'Enviando alterações':'Enviar alterações pendentes';button.setAttribute('aria-label',running?'Enviando alterações':'Enviar alterações pendentes');button.setAttribute('aria-busy',String(!!running));
  button.onclick=async()=>{if(button.disabled)return;button.disabled=true;try{await onSend();}catch(error){onError(error);}finally{if(button.isConnected)button.disabled=!!running;}};
 }
 root.DoceAdminSync={mount};
})(typeof window!=='undefined'?window:globalThis);
