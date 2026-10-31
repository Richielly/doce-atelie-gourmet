/* Action buttons are compact; labels remain available to assistive technology. */
(()=>{
 const shapes={
  gift:'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z',
  check:'M5 12l4 4L19 6',close:'M6 6l12 12M18 6 6 18',plus:'M12 4v16M4 12h16',edit:'m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-3-3L5 16z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',calendar:'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16',
  refresh:'M20 7v5h-5M4 17v-5h5M19 11a7 7 0 0 0-12-5M5 13a7 7 0 0 0 12 5',
  send:'m3 11 18-8-8 18-2-8zM11 13 21 3',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
  invite:'M13 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M2 21v-2a7 7 0 0 1 12-5M19 13v8M15 17h8',
  lock:'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4',logout:'M10 3H4v18h6M9 12h12m-5-5 5 5-5 5',
  trash:'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  heart:'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 3 11 8 15 5-4 12-11 8-15Z',bell:'M18 8a6 6 0 0 0-12 0v6l-2 3h16l-2-3zM10 21h4',
  play:'m7 3 14 9-14 9z',arrive:'M10 3H4v18h6M21 12H9m5-5-5 5 5 5',pause:'M8 4v16M16 4v16',
  money:'M3 5h18v14H3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6 8h1m10 8h1',
  chart:'M3 3v18h18M7 17v-5m5 5V8m5 9V5',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',back:'m14 5-7 7 7 7',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',copy:'M8 8h13v13H8zM16 4V2H2v14h2'
 };
 const actions={refresh:'refresh',export:'download',redeem:'gift',suggestions:'calendar',send:'send',discard:'trash','confirm-discard':'trash',book:'calendar',wait:'clock','confirm-booking':'check',accept:'check',decline:'close',favorite:'heart','favorite-notify':'bell','leave-wait':'close',gap:'plus',return:'calendar',reschedule:'calendar',estimate:'clock','close-gap':'close',service:'edit',professional:'user',windows:'clock','remove-window':'trash','remove-opening':'trash',invite:'invite',revoke:'lock','copy-invitation':'copy',logout:'logout','retry-professional':'send',price:'money',presence:'play',absence:'calendar','end-absence':'close','confirm-revoke':'lock'};
 const forms={activation:'lock',profile:'check',estimate:'clock','find-slots':'calendar',wait:'clock',gap:'check',proposal:'check','opening-hours':'plus',module:'check',service:'check',professional:'check',window:'check',price:'money',presence:'play',absence:'calendar','end-absence':'close','confirm-revoke':'lock'};
 function svg(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+(shapes[name]||shapes.check)+'"/></svg>';}
 function decorate(root){
  for(const button of root?.querySelectorAll?.('button')||[]){
   const action=button.dataset.action;
   // Choosing a time is a value selection, not a generic action: keep its value.
   if(['slot','choose-suggestion','calendar-day'].includes(action)||button.classList.contains('slot'))continue;
   const label=button.getAttribute('aria-label')||button.textContent.trim();if(!label)continue;
   button.setAttribute('aria-label',label);button.title=label;
   if(button.classList.contains('salon-icon-action'))continue;
   let name=actions[action]||forms[button.closest('form')?.dataset.form];
   if(action==='service')name=button.dataset.id?'edit':'plus';
   if(action==='professional')name=button.dataset.id?'edit':'invite';
   if(action==='page')name={dashboard:'chart',setup:'settings',account:'user',agenda:'calendar',appointments:'calendar',openings:'clock',proposals:'calendar'}[button.dataset.id];
   if(action==='command'||action==='customer-command'||action==='confirmed-customer-command')name={start:'play',complete:'check',cancel:'close',no_show:'close',arrive:'arrive'}[button.dataset.id?.split(':')[1]];
   const existing=button.querySelector('svg');
   const keepLabel=true;
   if(existing){const icon=existing.cloneNode(true);button.replaceChildren(icon);}else button.innerHTML=svg(name||(/voltar|revisar/i.test(label)?'back':/confirmar|salvar/i.test(label)?'check':/adicionar/i.test(label)?'plus':'check'));
   if(keepLabel){button.innerHTML+='<span>'+label.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</span>';button.classList.add('salon-labeled-action');}
   button.classList.add('salon-icon-action');
  }
 }
 window.ElumeSalonIcons={svg,decorate};
})();
