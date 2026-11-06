const test=require('node:test'),assert=require('node:assert/strict');
const U=require('../campaigns-ui.js'),K=require('../marketing-consent.js');
const fs=require('node:fs'),path=require('node:path');
const term={text:'Termo <b>fictício</b>',hash:'a'.repeat(64),version:'1.0'};

test('consentimento nunca vem marcado e não aparece sem o termo da loja',()=>{
 assert.equal(K.view({available:false,status:'none',term:null}),'');
 assert.equal(K.view(null),'');
 const html=K.view({available:true,status:'none',term,history:[],campaigns:[]});
 assert.equal((html.match(/type="checkbox"/g)||[]).length,2);
 assert.ok(!/checked/.test(html));
 assert.match(html,/Compras, agendamentos, preços e benefícios não dependem/);
 assert.match(html,/Termo &lt;b&gt;fictício/);
});

test('o termo aparece aberto antes de autorizar e revogar fica no mesmo lugar',()=>{
 assert.match(K.view({available:true,status:'none',term,history:[],campaigns:[]}),/<details class="consent-term" open>/);
 const granted=K.view({available:true,status:'granted',term,history:[{action:'granted',at:'2026-11-05T12:00:00Z'}],campaigns:[]});
 assert.ok(!/type="checkbox"/.test(granted));
 assert.match(granted,/Revogar autorização/);
 assert.match(K.view({available:true,status:'granted',term,history:[],campaigns:[]},{confirmRevoke:true}),/Confirmar revogação/);
 assert.match(K.view({available:true,status:'outdated',term,history:[],campaigns:[]}),/O termo mudou/);
});

test('cliente vê o que foi feito com seus dados, inclusive o grupo de comparação',()=>{
 const html=K.view({available:true,status:'granted',term,history:[],campaigns:[{title:'Oferta',at:'2026-11-05T12:00:00Z',received:false,score_percent:42,reasons:['Comprou 2 vezes']}]});
 assert.match(html,/grupo de comparação/);assert.match(html,/42%/);assert.match(html,/Comprou 2 vezes/);
});

test('link de WhatsApp só com telefone e com DDI do Brasil',()=>{
 assert.equal(U.whatsappLink('',  'x'),'');
 assert.equal(U.whatsappLink('(41) 99999-0000','Olá & até'),'https://wa.me/5541999990000?text=Ol%C3%A1%20%26%20at%C3%A9');
 assert.ok(U.whatsappLink('5541999990000','x').startsWith('https://wa.me/5541999990000'));
});

test('textos padrão não prometem desconto',()=>{
 for(const kind of ['surplus','slots','winback']){
  const d=U.defaults(kind,'Brigadeiro','2026-11-10','Loja');
  assert.ok(d.title.length<=80&&d.body.length<=400);
  assert.ok(!/desconto|grátis|%/i.test(d.title+d.body));
 }
});

test('pêndulo limitado e sem porcentagem enquanto aprende',()=>{
 assert.equal(U.needleAngle(-5),-60);assert.equal(U.needleAngle(1),60);assert.equal(U.needleAngle(0),0);
 const learning=U.thermometer({state:'aprendendo',contacted:2,missing:{results:28,conversions:5,non_conversions:3}});
 assert.match(learning,/Ainda aprendendo/);assert.match(learning,/28 resultado/);assert.ok(!/<svg/.test(learning));
 const ready=U.thermometer({state:'medindo',contacted:40,tendency:'otimista',pendulum:-.5,predicted:.3,rate:.15,accuracy:.7,top_rate:.25,rest_rate:.05,groups:{state:'inconclusivo',difference:.03},model:{version:2,samples:40}});
 assert.match(ready,/rotate\(-30 110 112\)/);assert.match(ready,/acerto do ranking/);assert.match(ready,/pode ser acaso/);assert.match(ready,/ajustados 2 vez/);
});

test('módulos estão ativos no app, nos dois tipos de loja',()=>{
 const root=path.join(__dirname,'..');
 const assets=JSON.parse(fs.readFileSync(path.join(root,'assets.json'),'utf8'));
 assert.ok(assets.includes('campaigns-ui.js')&&assets.includes('marketing-consent.js'));
 for(const page of ['index.html','salon.html']){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.match(html,/campaigns-ui\.js/);assert.match(html,/marketing-consent\.js/);
 }
});

test('oportunidades mostram faixa, não prometem e dizem quando falta histórico',()=>{
 const none=U.opportunities({days:7,surplus:[],without_history:2,season:{available:false,history_days:40,items:[]}});
 assert.match(none,/Nenhuma sobra prevista/);assert.match(none,/2 produto\(s\)/);assert.match(none,/Precisa de 1 ano de histórico/);assert.match(none,/40 dia/);
 const full=U.opportunities({days:14,surplus:[{id:'p',name:'Brigadeiro <b>',stock:1000,left:100,left_low:40,left_high:170}],without_history:0,season:{available:true,history_days:500,items:[{id:'s',name:'Coloração',lift:1.6}]}});
 assert.match(full,/cerca de <b>100<\/b> em 14 dias \(entre 40 e 170\)/);assert.match(full,/Brigadeiro &lt;b&gt;/);assert.match(full,/1,6 vezes/);assert.match(full,/não garantias/);assert.match(full,/data-cmp="plan-surplus"/);
 assert.equal(U.opportunities(null),'');
});

test('IA fica escondida sem configuração e explica o que recebe',()=>{
 assert.equal(U.aiPanel({options:{ai:{available:false}}}),'');assert.equal(U.aiPanel({}),'');
 const html=U.aiPanel({options:{ai:{available:true,remaining:7,limit:100}},aiSuggestions:[{title:'Título <i>',body:'Texto'}]});
 assert.match(html,/nunca dados de clientes/);assert.match(html,/7 de 100/);assert.match(html,/Usar este texto/);assert.match(html,/Título &lt;i&gt;/);
});
