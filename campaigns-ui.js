/* Smart campaigns for the owner, shared by the confectionery and salon administration.
   Nothing is sent by opening, refreshing or reconnecting: a campaign leaves only from the confirmation
   dialog. A failed send stays on this device and returns only by the owner's action. */
(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=v=>v===null||v===undefined?'—':Math.round(v*100)+'%';
 const money=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const dateText=v=>{if(!v)return '';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00':v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR');};
 const KINDS={surplus:'Vender uma sobra',slots:'Preencher horários vagos',winback:'Recuperar clientes sumidos'};
 const LEVELS={alta:'Alta',media:'Média',baixa:'Baixa'};
 const OPT_OUT='Para não receber mais: Minha conta > Ofertas.';
 const ICONS={send:'M4 12 20 4l-4 16-4-7Zm8 1 8-9',plus:'M12 5v14M5 12h14',back:'M15 6l-6 6 6 6',chat:'M4 5h16v11H9l-5 4Z',shield:'M12 3l8 3v6c0,5-3.5,8-8,9-4.5-1-8-4-8-9V6Z',list:'M4 6h16M4 12h16M4 18h10',refresh:'M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-1l2 2M4 15l2 2a7 7 0 0 0 12-1'};
 const icon=name=>`<svg class="cmp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
 const action=(label,name,act,id='',primary=false)=>`<button type="button" class="btn${primary?' primary':''}" data-cmp="${act}" data-id="${esc(id)}">${icon(name)}<span>${esc(label)}</span></button>`;
 function whatsappLink(phone,text){let digits=String(phone||'').replace(/\D/g,'');if(!digits)return '';if(digits.length<=11)digits='55'+digits;return 'https://wa.me/'+digits+'?text='+encodeURIComponent(text);}
 function defaults(kind,item,until,shop){
  const end=dateText(until);
  if(kind==='surplus')return {title:(item+' disponível').slice(0,80),body:`Temos ${item} disponível até ${end}. Faça seu pedido pelo aplicativo.`.slice(0,400)};
  if(kind==='slots')return {title:('Horários livres: '+item).slice(0,80),body:`Temos horários livres para ${item} até ${end}. Escolha o seu pelo aplicativo.`.slice(0,400)};
  return {title:'Sentimos sua falta',body:`Faz um tempo que você não vem a ${shop||'nossa loja'}${item?' para '+item:''}. Quando quiser, é só abrir o aplicativo.`.slice(0,400)};
 }
 // Pendulum: -1 promises more than happens, +1 promises less; the needle swings up to 60 degrees.
 function needleAngle(pendulum){return Math.max(-60,Math.min(60,(Number(pendulum)||0)*60));}
 function missingText(m){const parts=[];if(m.results)parts.push(m.results+' resultado(s)');if(m.conversions)parts.push(m.conversions+' venda(s) ou agendamento(s)');if(m.non_conversions)parts.push(m.non_conversions+' cliente(s) que não compraram');return parts.join(', ');}
 const TENDENCY={otimista:'A nota está otimista: promete mais do que acontece.',certeira:'A nota está certeira: promete perto do que acontece.',cautelosa:'A nota está cautelosa: acontece mais do que ela promete.'};
 const GROUPS={amostra_pequena:'Ainda faltam clientes no grupo de comparação para concluir se a campanha fez diferença.',inconclusivo:'Até agora, a diferença para quem não recebeu pode ser acaso.',positivo:'Quem recebeu respondeu mais do que quem não recebeu, além do acaso.',negativo:'Quem recebeu respondeu menos do que quem não recebeu. Revise as ofertas.'};
 function thermometer(t){
  if(t.state!=='medindo')return `<section class="panel stack cmp-thermo"><h3>Termômetro de acerto</h3><p><span class="pill">Ainda aprendendo</span></p><p class="muted">Para medir com segurança, faltam ${esc(missingText(t.missing)||'mais resultados')}. Até lá, nenhuma porcentagem de acerto é exibida.</p><p class="tiny muted">${t.contacted} cliente(s) contatado(s) em campanhas encerradas.</p></section>`;
  const angle=needleAngle(t.pendulum),groups=t.groups||{};
  return `<section class="panel stack cmp-thermo"><h3>Termômetro de acerto</h3>
   <svg class="cmp-gauge" viewBox="0 0 220 124" role="img" aria-label="${esc(TENDENCY[t.tendency])}"><path d="M20 112A90 90 0 0 1 200 112" class="cmp-arc"/><path d="M65 34A90 90 0 0 1 155 34" class="cmp-arc-good"/><line x1="110" y1="112" x2="110" y2="34" class="cmp-needle" transform="rotate(${angle} 110 112)"/><circle cx="110" cy="112" r="6" class="cmp-hub"/><text x="8" y="122">Otimista</text><text x="110" y="14" text-anchor="middle">Certeira</text><text x="212" y="122" text-anchor="end">Cautelosa</text></svg>
   <p><b>${esc(TENDENCY[t.tendency])}</b></p>
   <div class="cmp-facts"><div><b>${pct(t.predicted)}</b><span>nota média prevista</span></div><div><b>${pct(t.rate)}</b><span>compraram ou agendaram</span></div><div><b>${pct(t.accuracy)}</b><span>acerto do ranking (50% seria sorte)</span></div><div><b>${pct(t.top_rate)} × ${pct(t.rest_rate)}</b><span>metade melhor × restante</span></div></div>
   <p class="tiny muted">${esc(GROUPS[groups.state]||'')}${groups.difference!==null&&groups.difference!==undefined?' Diferença: '+Math.round(groups.difference*100)+' pontos.':''}</p>
   <p class="tiny muted">${t.model?.version?`Pesos ajustados ${t.model.version} vez(es) com ${t.model.samples} resultados desta loja.`:'Ainda usando os pesos iniciais.'}</p></section>`;
 }
 function resultLine(r){return `${r.sent} contatado(s) · ${r.converted} compraram ou agendaram (${pct(r.rate)})${r.value_cents?' · '+money(r.value_cents):''}${r.control?` · comparação: ${r.control_converted} de ${r.control} sem receber`:''}`;}
 function campaignCard(c){return `<article class="panel stack"><div class="row"><b>${esc(c.title)}</b><span class="pill">${c.status==='active'?'Ativa até '+esc(dateText(c.until)):'Encerrada'}</span></div><p class="tiny muted">${esc(KINDS[c.kind]||c.kind)}${c.item_name?' · '+esc(c.item_name):''} · enviada em ${esc(dateText(c.created_at))}</p><p>${esc(resultLine(c.results))}</p>${action('Ver clientes e resultados','list','open',c.id)}</article>`;}
 function opportunities(o){
  if(!o)return '';
  const surplus=o.surplus.map(x=>`<article class="cmp-opp"><p><b>${esc(x.name)}</b>: de ${x.stock} em estoque, devem sobrar cerca de <b>${x.left}</b> em ${o.days} dias (entre ${x.left_low} e ${x.left_high}).</p>${action('Criar campanha','plus','plan-surplus',x.id)}</article>`).join('');
  const season=o.season.available?o.season.items.map(x=>`<article class="cmp-opp"><p><b>${esc(x.name)}</b> costuma sair ${String(x.lift).replace('.',',')} vezes acima da média nesta época.</p>${action('Chamar clientes de volta','plus','plan-season',x.id)}</article>`).join(''):'';
  return `<section class="panel stack"><div class="row"><h3>Oportunidades</h3><label class="field">Próximos<select data-cmp-days>${[3,7,14,30].map(d=>`<option value="${d}"${d===o.days?' selected':''}>${d} dias</option>`).join('')}</select></label></div>
   ${surplus||'<p class="muted">Nenhuma sobra prevista para este período.</p>'}${o.without_history?`<p class="tiny muted">${o.without_history} produto(s) com estoque ainda sem histórico suficiente para prever (14 dias e 3 dias com venda).</p>`:''}
   <h4>Nesta época do ano</h4>${o.season.available?(season||'<p class="muted">Nenhum item acima da média nesta época.</p>'):`<p class="muted">Precisa de 1 ano de histórico. A loja tem ${o.season.history_days} dia(s).</p>`}
   <p class="tiny muted">Estimativas pelo histórico de vendas, não garantias. Ver oportunidades não envia nada.</p></section>`;
 }
 function aiPanel(s){
  const ai=s.options?.ai;if(!ai?.available)return '';
  const rows=(s.aiSuggestions||[]).map((x,i)=>`<article class="cmp-opp"><p><b>${esc(x.title)}</b><br>${esc(x.body)}</p>${action('Usar este texto','list','ai-use',String(i))}</article>`).join('');
  return `<div class="stack cmp-ai"><div class="cmp-actions"><label class="field">Tom<select data-cmp-tone>${[['acolhedor','Acolhedor'],['direto','Direto'],['animado','Animado']].map(([v,l])=>`<option value="${v}"${v===(s.aiTone||'acolhedor')?' selected':''}>${l}</option>`).join('')}</select></label>${action('Sugerir texto com IA','plus','ai-suggest')}</div><p class="tiny muted">${ai.remaining} de ${ai.limit} sugestões restantes neste mês. A IA recebe só o nome da loja, o item e a validade, nunca dados de clientes. Confira antes de enviar.</p>${rows}</div>`;
 }
 function responsiblePanel(s){const c=s.controller;return `<section class="panel stack"><h3>Responsável pelos dados (LGPD)</h3><p class="muted">Clientes só recebem ofertas depois de ler o termo e autorizar. O termo precisa identificar quem responde pelos dados: sem isso, a opção não aparece para eles.</p>
   <form class="stack" data-cmp-form="controller"><label class="field">Nome ou razão social<input name="legal_name" required minlength="3" maxlength="160" value="${esc(c.legal_name)}"></label><label class="field">CNPJ (se houver)<input name="document" maxlength="20" inputmode="numeric" value="${esc(c.document)}"></label><label class="field">E-mail ou telefone para privacidade<input name="contact" required maxlength="160" value="${esc(c.contact)}"></label><button class="btn primary" type="submit">${icon('shield')}<span>${c.published?'Publicar alteração':'Publicar termo'}</span></button></form>
   <p class="tiny muted">Este nome e contato aparecem no termo para os clientes. Não informe CPF. Publicar é imediato e fica registrado.${c.published?' Quem já autorizou recebe um aviso sobre a alteração.':''}</p>${c.term?`<details class="consent-term"><summary>Ver o termo publicado (versão ${esc(c.version)})</summary><div class="consent-text" tabindex="0">${esc(c.term)}</div></details>`:''}</section>`;}
 function home(s){const k=s.options.consents;return `<div class="section"><h2>Campanhas</h2>${s.controller.published?action('Nova campanha','plus','new','',true):''}</div>
   ${s.options.month?.limit!=null?`<p class="plan-usage${s.options.month.used>=s.options.month.limit?' plan-usage-full':''}" role="status"><span>${s.options.month.used} de ${s.options.month.limit} campanhas neste mês${s.options.month.used>=s.options.month.limit?' · disponível em planos maiores':''}</span></p>`:''}
   ${s.pending?`<div class="note"><b>Envio não concluído:</b> ${esc(s.pending.error||'Não foi possível enviar.')} A campanha está guardada neste aparelho e só é enviada se você revisar e confirmar.<div class="cmp-actions">${action('Revisar envio','send','resume','',true)}${action('Descartar','back','discard')}</div></div>`:''}
   <section class="panel"><div class="cmp-facts"><div><b>${k.granted}</b><span>clientes autorizaram ofertas</span></div><div><b>${k.not_granted}</b><span>ainda não autorizaram</span></div></div><p class="tiny muted">A autorização é pedida na Minha conta de cada cliente. Só quem autorizou entra no ranking.</p></section>
   ${s.controller.published?opportunities(s.opportunities):''}${thermometer(s.thermometer)}${s.list.length?'<h3>Campanhas enviadas</h3>'+s.list.map(campaignCard).join(''):'<div class="panel">Nenhuma campanha enviada ainda.</div>'}${responsiblePanel(s)}`;}
 function optionTags(rows,selected){return rows.map(r=>`<option value="${esc(r.id)}"${r.id===selected?' selected':''}>${esc(r.label)}</option>`).join('');}
 function newForm(s){
  const o=s.options,f=s.form,kinds=[];
  if(o.products.length&&o.business_type!=='salon')kinds.push('surplus');
  if(o.business_type==='salon')kinds.push('slots');
  kinds.push('winback');
  const kind=kinds.includes(f.kind)?f.kind:kinds[0];
  const items=kind==='surplus'?o.products.map(p=>({id:p.id,label:p.name+' · estoque '+p.stock})):kind==='slots'?o.free_slots.map(x=>({id:x.id,label:x.name+' · '+x.total+' horário(s) livre(s) em 7 dias'})):[{id:'',label:'Todos os produtos e serviços'},...(o.business_type==='salon'?o.services.map(x=>({id:x.id,label:x.name})):o.products.map(p=>({id:p.id,label:p.name})))];
  const noItems=kind==='slots'&&!items.length;
  return `<div class="section"><h2>Nova campanha</h2>${action('Voltar','back','home')}</div><form class="panel stack" data-cmp-form="scope">
   <label class="field">O que você quer fazer?<select name="kind" data-cmp-kind>${kinds.map(k=>`<option value="${k}"${k===kind?' selected':''}>${KINDS[k]}</option>`).join('')}</select></label>
   ${noItems?'<div class="note">Não há horários livres nos próximos 7 dias.</div>':`<label class="field">${kind==='surplus'?'Produto':kind==='slots'?'Serviço':'Item (opcional)'}<select name="item_id">${optionTags(items,f.item_id)}</select></label>`}
   ${kind==='surplus'?`<label class="field">Quantas unidades precisa vender?<input name="quantity" type="number" min="1" max="100000" required value="${esc(f.quantity||'')}"></label>`:''}
   ${kind==='winback'?`<label class="field">Sem comprar ou vir há pelo menos (dias)<input name="inactive_days" type="number" min="15" max="730" required value="${esc(f.inactive_days||60)}"></label>`:''}
   <label class="field">Oferta válida até<input name="until" type="date" required min="${esc(s.today)}" max="${esc(s.lastDay)}" value="${esc(f.until||s.defaultUntil)}"></label>
   <button class="btn primary" type="submit"${noItems?' disabled':''}>${icon('list')}<span>Ver ranking de clientes</span></button><p class="tiny muted">Ver o ranking não envia nada.</p></form>`;
 }
 function review(s){
  const p=s.preview,c=p.counts,rows=p.candidates;
  if(!rows.length)return `<div class="section"><h2>Ranking</h2>${action('Voltar','back','new')}</div><div class="panel stack"><p>Nenhum cliente pode receber esta campanha agora.</p><p class="muted tiny">${c.consented} autorizaram · ${c.cooldown} em intervalo (receberam oferta há menos de 7 dias, foram lembrados de voltar ou já têm horário)${c.recent_activity?' · '+c.recent_activity+' ainda ativos':''} · ${c.not_granted} não autorizaram.</p></div>`;
  const chosen=rows.filter(r=>s.selected.has(r.customer_id)).length,held=chosen>=10&&s.draft.control_percent?Math.max(1,Math.round(chosen*s.draft.control_percent/100)):0;
  return `<div class="section"><h2>Ranking: ${esc(p.item_name||KINDS[s.form.kind])}</h2>${action('Voltar','back','new')}</div>
   <div class="note">${p.quantity?`Para ${s.form.kind==='slots'?'preencher':'vender'} <b>${p.quantity}</b>, sugerimos os <b>${p.suggested}</b> primeiros. `:''}A nota é uma estimativa. Confira a lista: você decide quem recebe.</div>
   <p class="tiny muted">${c.consented} autorizaram · ${c.cooldown} em intervalo · ${c.not_granted} não autorizaram e ficam de fora.</p>
   <form class="stack" data-cmp-form="send"><div class="stack cmp-rows">${rows.map((r,i)=>`<label class="panel cmp-row"><input type="checkbox" data-cmp-pick value="${esc(r.customer_id)}"${s.selected.has(r.customer_id)?' checked':''}><span class="cmp-pos">${i+1}</span><span class="cmp-who"><b>${esc(r.name)}</b> <span class="pill cmp-${esc(r.level)}">${LEVELS[r.level]} · ${r.score_percent}%</span><span class="tiny muted">${esc(r.reasons.join(' · '))}${r.has_phone?'':' · sem WhatsApp'}</span></span></label>`).join('')}</div>
   <section class="panel stack">${aiPanel(s)}<label class="field">Título<input name="title" required minlength="3" maxlength="80" value="${esc(s.draft.title)}"></label><label class="field">Mensagem<textarea name="body" required minlength="5" maxlength="400" rows="3">${esc(s.draft.body)}</textarea></label><p class="tiny muted">Será acrescentado: “${esc(OPT_OUT)}”</p>
   <label class="field">Grupo de comparação<select name="control_percent" data-cmp-control>${[20,10,30,0].map(v=>`<option value="${v}"${v===Number(s.draft.control_percent)?' selected':''}>${v?v+'% por sorteio não recebe':'Sem grupo de comparação'}</option>`).join('')}</select></label>
   <p class="tiny muted">O grupo mostra se a campanha fez diferença. Com menos de 10 clientes, ninguém fica de fora.</p><p><b data-cmp-count>${chosen} selecionado(s)</b>${held?` · cerca de ${held} no grupo de comparação`:''}</p><button class="btn primary" type="submit"${chosen?'':' disabled'}>${icon('send')}<span>Revisar e enviar</span></button></section></form>`;
 }
 function detail(s){
  const c=s.detail,text=c.body+' '+OPT_OUT;
  return `<div class="section"><h2>${esc(c.title)}</h2>${action('Voltar','back','home')}</div><section class="panel stack"><p>${esc(c.body)}</p><p class="tiny muted">${esc(KINDS[c.kind]||c.kind)}${c.item_name?' · '+esc(c.item_name):''} · ${c.status==='active'?'válida até '+esc(dateText(c.until)):'encerrada'}</p><p><b>${esc(resultLine(c.results))}</b></p><p class="tiny muted">${esc(GROUPS[c.results.comparison?.state]||'')}</p>${c.status==='active'?'<p class="tiny muted">Contagem parcial. O resultado fica definitivo 3 dias depois do fim, para considerar cancelamentos.</p>':''}</section>
   <h3>Clientes contatados</h3><p class="tiny muted">Todos receberam na central de avisos. O WhatsApp é opcional e abre uma conversa para você enviar.</p>${c.recipients.map(r=>{const link=whatsappLink(r.phone,text);return `<article class="panel stack"><div class="row"><b>${esc(r.name)}</b><span class="pill cmp-${esc(r.level)}">${LEVELS[r.level]} · ${r.score_percent}%</span></div><p class="tiny muted">${esc((r.reasons||[]).join(' · '))}</p>${c.status==='closed'?`<p class="tiny">${r.outcome==='converted'?'Comprou ou agendou':'Não respondeu'}</p>`:''}${link&&c.status==='active'?`<a class="btn" href="${esc(link)}" target="_blank" rel="noopener" data-cmp-wa="${esc(r.id)}">${icon('chat')}<span>${r.whatsapp_at?'Abrir WhatsApp de novo':'Abrir WhatsApp'}</span></a>`:''}</article>`;}).join('')||'<div class="panel">Nenhum cliente na lista.</div>'}`;
 }
 const CSS='.cmp-ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vertical-align:-4px;margin-right:6px;flex:none}.cmp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.cmp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.cmp-facts div{display:grid;gap:2px}.cmp-facts b{font-size:20px}.cmp-facts span{font-size:12px;color:var(--muted,#6b5a66)}.cmp-gauge{width:100%;max-width:280px;display:block;margin:auto}.cmp-gauge text{font-size:11px;fill:currentColor}.cmp-arc{fill:none;stroke:#d9cfd6;stroke-width:10}.cmp-arc-good{fill:none;stroke:#2a9d8f;stroke-width:10}.cmp-needle{stroke:var(--p,#985272);stroke-width:4;stroke-linecap:round}.cmp-hub{fill:var(--p,#985272)}.cmp-row{display:flex;align-items:flex-start;gap:10px;cursor:pointer}.cmp-row input{width:20px;height:20px;flex:none;margin-top:2px}.cmp-pos{font-weight:700;min-width:22px}.cmp-who{display:grid;gap:4px;min-width:0}.cmp-rows{gap:8px}.cmp-opp{border-top:1px solid var(--line,#eadfe7);padding-top:10px;display:grid;gap:8px;justify-items:start}.cmp-opp p{margin:0;line-height:1.5}.cmp-alta{background:#d8f1ec;color:#14584f}.cmp-media{background:#fbeccd;color:#6d4c07}.cmp-baixa{background:#ece7ea;color:#51464d}';
 function style(){if(document.getElementById('elume-campaign-style'))return;const s=document.createElement('style');s.id='elume-campaign-style';s.textContent=CSS;document.head.append(s);}
 function confirmDialog(title,lines,label){return new Promise(resolve=>{const d=document.createElement('dialog');d.className='plan-dialog';d.innerHTML=`<h2>${esc(title)}</h2>${lines.map(l=>`<p>${esc(l)}</p>`).join('')}<div class="cmp-actions"><button type="button" class="btn primary" data-yes>${esc(label)}</button><button type="button" class="btn" data-no>Voltar</button></div>`;let done=false;const finish=answer=>{if(done)return;done=true;if(d.open)d.close();d.remove();resolve(answer);};d.querySelector('[data-yes]').onclick=()=>finish(true);d.querySelector('[data-no]').onclick=()=>finish(false);d.addEventListener('close',()=>finish(false));document.body.append(d);d.showModal();});}
 const states=new Map();
 const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 function newRequestId(){return 'cmp-'+(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));}
 async function mount(el,ctx){
  if(!el)return;style();
  let s=states.get(ctx.key);
  if(!s){const day=new Date(),add=n=>{const d=new Date(day);d.setDate(d.getDate()+n);return iso(d);};s={view:'loading',today:iso(day),lastDay:add(30),defaultUntil:add(5),form:{},selected:new Set(),draft:{},error:''};try{s.pending=JSON.parse(localStorage.getItem('elume-campaign-pending:'+ctx.key)||'null');}catch{s.pending=null;}states.set(ctx.key,s);}
  s.el=el; // The page may redraw during a request: results go to the container on screen now.
  const paint=()=>{if(!s.el.isConnected)return;
   s.el.innerHTML=s.view==='locked'?s.lockedHtml:s.view==='error'?`<div class="panel stack"><p>${esc(s.error)}</p>${action('Tentar novamente','refresh','reload')}</div>`:s.view==='loading'?'<div class="panel" aria-busy="true">Carregando campanhas…</div>':s.view==='new'?newForm(s):s.view==='review'?review(s):s.view==='detail'?detail(s):home(s);};
  const fail=e=>ctx.notify(e.message,true);
  const savePending=value=>{s.pending=value;try{if(value)localStorage.setItem('elume-campaign-pending:'+ctx.key,JSON.stringify(value));else localStorage.removeItem('elume-campaign-pending:'+ctx.key);}catch{}};
  async function load(){
   if(ctx.plan?.included&&ctx.plan.included('campaigns')===false){s.view='locked';s.lockedHtml=ctx.plan.lockedPanel('Campanhas inteligentes',['Ranking de clientes que autorizaram ofertas','Campanhas de sobras, horários vagos e clientes sumidos','Termômetro de acerto']);paint();return;}
   try{
    const [controller,options,list,thermo]=await Promise.all([ctx.request('/marketing/controller'),ctx.request('/campaigns/options'),ctx.request('/campaigns'),ctx.request('/campaigns/thermometer')]);
    Object.assign(s,{controller,options,list,thermometer:thermo,view:'home',error:''});
    await loadOpportunities(s.opportunities?.days||7);
   }catch(e){s.view='error';s.error=e.status===404?'Atualize o servidor para usar campanhas.':e.message;}
   paint();
  }
  async function loadOpportunities(days){try{s.opportunities=await ctx.request('/campaigns/opportunities?days='+days);}catch{s.opportunities=null;}} // Optional panel.
  function startFrom(form){s.form=form;s.view='new';paint();}
  async function suggestText(){
   keepDraft();
   try{const result=await ctx.request('/campaigns/suggest-text','POST',{...s.scope,tone:s.aiTone||'acolhedor'});s.aiSuggestions=result.suggestions;s.options.ai=result.ai;paint();}
   catch(e){fail(e);}
  }
  async function runPreview(form){
   const body={kind:form.kind,item_id:form.item_id||'',until:form.until};
   if(form.quantity)body.quantity=Number(form.quantity);
   if(form.kind==='winback')body.inactive_days=Number(form.inactive_days||60);
   const preview=await ctx.request('/campaigns/preview','POST',body);
   s.form=form;s.scope=body;s.preview=preview;
   s.selected=new Set(preview.candidates.slice(0,preview.suggested).map(r=>r.customer_id));
   s.draft={...defaults(form.kind,preview.item_name,form.until,ctx.shopName),control_percent:20};
   s.aiSuggestions=[];s.requestId=newRequestId();s.view='review';paint();
  }
  async function send(){
   const chosen=s.preview.candidates.filter(r=>s.selected.has(r.customer_id));
   const yes=await confirmDialog('Enviar esta campanha?',[`${s.draft.title}: ${s.draft.body}`,`Para ${chosen.length} cliente(s) que autorizaram${chosen.length>=10&&Number(s.draft.control_percent)?`, menos o grupo de comparação de ${s.draft.control_percent}%`:''}.`,`Válida até ${dateText(s.scope.until)}. O envio é imediato pela central de avisos do aplicativo.`],'Enviar agora');
   if(!yes)return;
   const payload={...s.scope,request_id:s.requestId,title:s.draft.title,body:s.draft.body,control_percent:Number(s.draft.control_percent),customer_ids:chosen.map(r=>r.customer_id)};
   try{
    s.detail=await ctx.request('/campaigns','POST',payload);savePending(null);s.view='detail';ctx.notify('Campanha enviada.');
    const [list,options]=await Promise.all([ctx.request('/campaigns'),ctx.request('/campaigns/options')]);s.list=list;s.options=options;paint();
   }catch(e){savePending({payload,form:s.form,error:e.message});ctx.notify('Envio não concluído. A campanha ficou guardada neste aparelho.',true);s.view='home';paint();}
  }
  el.onclick=event=>{
   const wa=event.target.closest('[data-cmp-wa]');
   if(wa){void ctx.request('/campaigns/'+encodeURIComponent(s.detail.id)+'/recipients/'+encodeURIComponent(wa.dataset.cmpWa)+'/whatsapp','POST',{}).then(()=>{const row=s.detail.recipients.find(r=>r.id===wa.dataset.cmpWa);if(row)row.whatsapp_at=new Date().toISOString();}).catch(fail);return;}
   const node=event.target.closest('[data-cmp]');if(!node)return;
   const act=node.dataset.cmp,id=node.dataset.id;
   if(act==='home'){s.view='home';void load();}
   else if(act==='reload'){s.view='loading';paint();void load();}
   else if(act==='new'){s.form={};s.view='new';paint();}
   else if(act==='plan-surplus'){const x=s.opportunities.surplus.find(r=>r.id===id);if(x)startFrom({kind:'surplus',item_id:x.id,quantity:x.left});}
   else if(act==='plan-season')startFrom({kind:'winback',item_id:id,inactive_days:60});
   else if(act==='ai-suggest')void suggestText();
   else if(act==='ai-use'){keepDraft();const x=s.aiSuggestions[Number(id)];if(x){s.draft={...s.draft,title:x.title,body:x.body};paint();}}
   else if(act==='open')void ctx.request('/campaigns/'+encodeURIComponent(id)).then(d=>{s.detail=d;s.view='detail';paint();}).catch(fail);
   else if(act==='discard'){savePending(null);paint();}
   else if(act==='resume')void (async()=>{const p=s.pending;try{await runPreview(p.form);s.requestId=p.payload.request_id;s.draft={title:p.payload.title,body:p.payload.body,control_percent:p.payload.control_percent};s.selected=new Set(p.payload.customer_ids.filter(c=>s.preview.candidates.some(r=>r.customer_id===c)));paint();}catch(e){fail(e);}})();
  };
  el.onchange=event=>{
   if(event.target.matches('[data-cmp-kind]')){s.form={...s.form,kind:event.target.value,item_id:''};paint();}
   else if(event.target.matches('[data-cmp-pick]')){if(event.target.checked)s.selected.add(event.target.value);else s.selected.delete(event.target.value);keepDraft();paint();}
   else if(event.target.matches('[data-cmp-control]')){keepDraft();paint();}
   else if(event.target.matches('[data-cmp-tone]')){s.aiTone=event.target.value;keepDraft();}
   else if(event.target.matches('[data-cmp-days]'))void loadOpportunities(Number(event.target.value)).then(paint);
  };
  function keepDraft(){const f=s.el.querySelector('form[data-cmp-form="send"]');if(!f)return;const v=new FormData(f);s.draft={title:String(v.get('title')||''),body:String(v.get('body')||''),control_percent:Number(v.get('control_percent')||0)};}
  el.onsubmit=event=>{
   const type=event.target.dataset.cmpForm;if(!type)return;event.preventDefault();
   const values=Object.fromEntries(new FormData(event.target));
   if(type==='scope')void runPreview(values).catch(fail);
   else if(type==='send'){keepDraft();void send();}
   else if(type==='controller')void (async()=>{
    if(!await confirmDialog('Publicar no termo?',[`Responsável: ${values.legal_name}`,`CNPJ: ${values.document||'não informado'}`,`Contato: ${values.contact}`,'Estes dados ficam visíveis aos clientes no termo de ofertas.'],'Publicar'))return;
    try{s.controller=await ctx.request('/marketing/controller','PUT',{revision:s.controller.revision,...values});s.options=await ctx.request('/campaigns/options');ctx.notify('Termo publicado. Os clientes já podem autorizar em Minha conta.');paint();}catch(e){fail(e);}
   })();
  };
  if(s.view==='loading')await load();else paint();
 }
 const api={mount,whatsappLink,defaults,needleAngle,missingText,thermometer,opportunities,aiPanel};
 if(typeof module!=='undefined')module.exports=api;if(root)root.ElumeCampaigns=api;
 // Confectionery administration: a page in the store's own menu.
 if(root&&typeof document!=='undefined'&&root.DOCE_MODE==='admin'){
  root.adminCampaigns=function(){
   queueMicrotask(()=>{const el=document.getElementById('elume-campaigns');if(el&&root.adminApi)void mount(el,{key:root.adminApi.key(),shopName:root.adminApi.name(),request:root.adminApi.request,notify:(text,error)=>notify(text,error?'error':undefined),plan:root.ElumePlan});});
   return '<div id="elume-campaigns"></div>';
  };
 }
})(typeof window!=='undefined'?window:null);
