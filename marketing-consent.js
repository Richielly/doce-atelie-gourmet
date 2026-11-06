/* Customer's choice about offers, per shop. Never pre-marked, never a condition to buy or book, and
   revoking takes one step in the same place. Shown only when the server and the shop support it. */
(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const when=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR');};
 const statusText={granted:'Você autorizou receber ofertas desta loja.',revoked:'Você revogou a autorização. Não recebe ofertas desta loja.',none:'Você ainda não autorizou. Nada muda nas suas compras e agendamentos.',outdated:'O termo mudou. Sua autorização anterior não vale mais; leia a nova versão se quiser continuar recebendo.'};
 function view(data,ui={}){
  if(!data||!data.available)return '';
  const granted=data.status==='granted';
  const term=data.term?`<details class="consent-term"${granted?'':' open'}><summary>Ler o termo completo (versão ${esc(data.term.version)})</summary><div class="consent-text" tabindex="0">${esc(data.term.text)}</div></details>`:'';
  const form=!granted&&data.term?`<form class="stack consent-form" data-consent-form>
    <label class="consent-check"><input type="checkbox" name="accept"><span>Li o termo e autorizo o uso dos meus dados para receber ofertas personalizadas desta loja.</span></label>
    <label class="consent-check"><input type="checkbox" name="adult"><span>Declaro ter 18 anos ou mais.</span></label>
    <button class="btn primary" type="submit">Autorizar ofertas</button></form>`:'';
  const revoke=granted?(ui.confirmRevoke?`<p class="muted tiny">Ao revogar, os novos envios param e seus resultados são desvinculados do seu cadastro.</p><div class="consent-actions"><button class="btn primary" type="button" data-consent="revoke">Confirmar revogação</button><button class="btn" type="button" data-consent="keep">Manter autorização</button></div>`:`<button class="btn" type="button" data-consent="ask-revoke">Revogar autorização</button>`):'';
  const offers=(data.campaigns||[]).length?`<details class="consent-term"><summary>O que foi feito com meus dados</summary><ul class="consent-list">${data.campaigns.map(c=>`<li><b>${esc(c.title)}</b> · ${esc(when(c.at))}<br><span class="tiny muted">${c.received?'Oferta enviada':'Você ficou no grupo de comparação e não recebeu esta oferta'}. Nota de interesse: ${esc(c.score_percent)}%.${(c.reasons||[]).length?' Motivos: '+esc(c.reasons.join('; '))+'.':''}</span></li>`).join('')}</ul></details>`:'';
  const history=(data.history||[]).length?`<p class="tiny muted">Histórico: ${data.history.slice(0,5).map(h=>(h.action==='granted'?'autorizou':'revogou')+' em '+esc(when(h.at))).join(' · ')}</p>`:'';
  return `<section class="panel stack consent-panel" aria-label="Ofertas desta loja"><h3>Ofertas</h3><p>${esc(statusText[data.status]||'')}</p><p class="tiny muted">Compras, agendamentos, preços e benefícios não dependem desta escolha.</p>${term}${form}${revoke}${offers}${history}</section>`;
 }
 const CSS='.consent-term summary{cursor:pointer;font-weight:600;padding:6px 0}.consent-text{white-space:pre-wrap;max-height:320px;overflow:auto;padding:12px;border:1px solid var(--line,#eadfe7);border-radius:12px;font-size:13px;line-height:1.55;background:#fff;color:#2c2230}.consent-check{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.45}.consent-check input{flex:none;width:20px;height:20px;margin-top:1px}.consent-actions{display:flex;flex-wrap:wrap;gap:8px}.consent-list{margin:6px 0;padding-left:18px;display:grid;gap:8px}.consent-panel{margin-top:14px}';
 function style(){if(document.getElementById('elume-consent-style'))return;const s=document.createElement('style');s.id='elume-consent-style';s.textContent=CSS;document.head.append(s);}
 const caches=new Map();
 // Called after every render; reads the server only when the container is new for this store.
 async function mount(el,{key,request,notify}){
  if(!el)return;style();
  let cache=caches.get(key);if(!cache){cache={data:null,ui:{},loaded:false};caches.set(key,cache);}
  cache.el=el; // The page may redraw during a request: results go to the container on screen now.
  const paint=()=>{if(cache.el.isConnected)cache.el.innerHTML=view(cache.data,cache.ui);};
  const act=async(path,body)=>{try{cache.data=await request(path,'POST',body);cache.ui={};paint();return true;}catch(e){notify(e.message,true);return false;}};
  el.onsubmit=async event=>{
   if(!event.target.matches('[data-consent-form]'))return;event.preventDefault();
   const form=new FormData(event.target),accept=form.get('accept')==='on',adult=form.get('adult')==='on';
   if(!accept||!adult){notify(!accept?'Marque a autorização para continuar.':'Estas ofertas são somente para maiores de 18 anos.',true);return;}
   if(await act('/me/marketing/consent',{term_hash:cache.data.term.hash,accept,adult}))notify('Autorização registrada. Você pode revogar quando quiser.');
   else{try{cache.data=await request('/me/marketing');paint();}catch{}}
  };
  el.onclick=async event=>{
   const action=event.target.closest('[data-consent]')?.dataset.consent;if(!action)return;
   if(action==='ask-revoke'){cache.ui={confirmRevoke:true};paint();}
   else if(action==='keep'){cache.ui={};paint();}
   else if(action==='revoke'&&await act('/me/marketing/revoke',{}))notify('Autorização revogada. Você não receberá mais ofertas desta loja.');
  };
  if(cache.loaded){paint();return;}
  try{cache.data=await request('/me/marketing');}catch{cache.data=null;} // Older server: the section is simply absent.
  cache.loaded=true;paint();
 }
 const api={view,mount};if(typeof module!=='undefined')module.exports=api;if(root)root.ElumeConsent=api;
})(typeof window!=='undefined'?window:null);
