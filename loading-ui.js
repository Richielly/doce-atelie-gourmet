/* Foreground operations only: background refreshes never block the screen. */
(()=>{
 'use strict';
 const logoUrl=document.currentScript?.src?new URL('elume-icon.svg',document.currentScript.src).href:'elume-icon.svg';
 let count=0,overlay,shown=0,timer,initial;
 function mount(){
  if(overlay||!document.body)return;
  const style=document.createElement('style');
  style.textContent='#doce-loading{visibility:visible!important;position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:rgba(255,249,241,.78);backdrop-filter:blur(4px);z-index:2147483647;align-items:center;justify-content:center}#doce-loading[open]{display:flex}#doce-loading::backdrop{background:transparent}.elume-loading-mark{position:relative;display:grid;place-items:center;width:112px;height:112px;border-radius:50%;background:#fff9f1;box-shadow:0 12px 40px #3d185815;isolation:isolate}.elume-loading-mark img{display:block;width:104px;height:104px;animation:elume-loading-pulse 1.4s ease-in-out infinite}.elume-loading-mark::after{content:"";position:absolute;inset:-6px;border:3px solid #7137c61a;border-top-color:#7137c6;border-right-color:#f58573;border-radius:50%;animation:elume-loading-orbit 1.4s linear infinite;box-sizing:border-box}@keyframes elume-loading-orbit{to{transform:rotate(360deg)}}@keyframes elume-loading-pulse{0%,100%{transform:scale(.9);opacity:.8}50%{transform:scale(1);opacity:1}}@media(prefers-reduced-motion:reduce){.elume-loading-mark img,.elume-loading-mark::after{animation:none}}';
  document.head.append(style);overlay=document.createElement('dialog');overlay.id='doce-loading';overlay.setAttribute('aria-label','Carregando');overlay.setAttribute('aria-busy','true');overlay.tabIndex=-1;
  const mark=document.createElement('span');mark.className='elume-loading-mark';mark.setAttribute('aria-hidden','true');
  const image=document.createElement('img');image.src=logoUrl;image.alt='';image.width=104;image.height=104;mark.append(image);overlay.append(mark);
  overlay.addEventListener('cancel',event=>event.preventDefault());document.body.append(overlay);
 }
 function display(){mount();if(!overlay||overlay.open)return;shown=Date.now();overlay.showModal();}
 function begin(){clearTimeout(timer);count++;display();let done=false;return ()=>{if(done)return;done=true;count=Math.max(0,count-1);if(count)return;timer=setTimeout(()=>{if(!count&&overlay?.open)overlay.close();},Math.max(0,320-(Date.now()-shown)));};}
 async function run(work){const end=begin();try{return await (typeof work==='function'?work():work);}finally{end();}}
 window.DoceLoading={begin,run};
 function watch(){if(document.documentElement.dataset.loading==='true'){if(!initial)initial=begin();}else if(initial){initial();initial=null;}}
 new MutationObserver(watch).observe(document.documentElement,{attributes:true,attributeFilter:['data-loading']});
 document.addEventListener('DOMContentLoaded',()=>{if(count)display();watch();});
 window.addEventListener('pageshow',event=>{if(event.persisted){count=0;initial=null;clearTimeout(timer);if(overlay?.open)overlay.close();watch();}});
})();
