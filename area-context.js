/* Identifies the authenticated area without granting or switching permissions. */
(()=>{
 let bar,observer;
 window.ElumeArea={show({role,name,professional='',kind=''}){
  const header=document.querySelector('body > header');if(!header)return;
  if(!bar){
   bar=document.createElement('aside');bar.className='elume-area-context';bar.setAttribute('aria-label','Área atual');header.after(bar);
   const resize=()=>{bar.style.top=header.offsetHeight+'px';};resize();
   if(window.ResizeObserver){observer=new ResizeObserver(resize);observer.observe(header);}
  }
  bar.dataset.role=role;
  const label=document.createElement('strong');label.textContent=role==='owner'?(kind==='salon'?'Dono do salão':'Lojista'):role==='professional'?'Profissional'+(professional?' — '+professional:''):'Cliente';
  const place=document.createElement('span');place.textContent=name||'';
  bar.replaceChildren(label,place);
 }};
})();
