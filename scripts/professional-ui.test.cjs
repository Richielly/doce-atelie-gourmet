/* Exercises real form -> confirmation -> HTTP flow in an isolated DOM adapter. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({priceAuthority='salon',role='professional',legacyBackend=false,settlementRule=null}={}){
 const nodes=new Map(),dialogs=[],requests=[],cache=new Map();let persisted=[];
 const element=tag=>({tag,open:false,children:[],style:{},dataset:{},append(...children){this.children.push(...children);},setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},focus(){},replaceChildren(...c){this.children=c;}});
 const document={baseURI:'http://localhost:6003/salon.html',getElementById(id){if(!nodes.has(id))nodes.set(id,element('div'));return nodes.get(id);},createElement:element,body:{append(node){dialogs.push(node);}},addEventListener(){}};
 const home=()=>({professional:{id:'ana',name:'Ana',service_ids:['unhas']},services:[{id:'unhas',name:'Manicure',minutes:60,price_cents:5000,price_revision:0,price_source:priceAuthority}],price_policy:{authority:priceAuthority,settlement:settlementRule},schedule:{revision:2,windows:persisted,blocks:[]},opening_hours:[],timezone:'America/Sao_Paulo',items:[],queue:[]});
 const window={DoceAdminSync:{mount(){}},ElumeArea:{show(){}}};
 const context={window,document,URL,URLSearchParams,location:{search:'?role='+role},Intl,Date,crypto:require('node:crypto').webcrypto,
  localStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},setTimeout:()=>1,clearTimeout(){},DoceLoading:{begin:()=>()=>{}},
  FormData:class{constructor(form){this.values=form.values;}get(name){return this.values[name]??null;}has(name){return Object.hasOwn(this.values,name);}getAll(name){const v=this.values[name];return Array.isArray(v)?v:v===undefined?[]:[v];}},
  fetch:async(path,options)=>{requests.push({path,...options});if(legacyBackend&&path.endsWith('/dashboard'))return {ok:false,status:404,json:async()=>({detail:'Not Found'})};if(options.method==='PUT'){if(!path.includes('/prices/'))persisted=JSON.parse(options.body).windows;return {ok:true,json:async()=>({revision:3})};}return {ok:true,json:async()=>path.endsWith('/salon')?home():path.endsWith('/dashboard')?{period_days:30,completed_count:0,upcoming_count:0,own_amount_cents:0,unconfigured_count:0,records:[],basis:'Estimativa'}:{items:[]}};}};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(require.resolve('../professional-submit.js'),'utf8'),context);
 let source=fs.readFileSync(require.resolve('../salon-ui.js'),'utf8');
 source=source.replace(" void DoceLoading.run(start).finally(()=>$('salon-main').removeAttribute('aria-busy'));",`store={id:'shop-test',name:'Salão teste',api:'http://localhost:6003'};professionalId='ana';draftKey='professional:ana:shop-test';catalog={professionals:[{id:'ana',name:'Ana',windows:[],blocks:[],service_ids:['unhas']}],services:[{id:'unhas',name:'Manicure',minutes:60,price_cents:5000,price_revision:0}]};config={revision:2,data:{timezone:'America/Sao_Paulo',opening_hours:[],services:[{id:'unhas',name:'Manicure',price_cents:5000,minutes:60}],professionals:[{id:'ana',name:'Ana',service_ids:['unhas'],windows:[],blocks:[],enabled:true}]}};pricePolicy={authority:${JSON.stringify(priceAuthority)},settlement:${JSON.stringify(settlementRule)}};window.testSubmit=submit;window.testLoad=load;window.testPriceModal=priceModal;window.testProfessionalModal=professionalModal;`);
 vm.runInContext(source,context);
 const submit=()=>window.testSubmit({dataset:{form:'window'},values:{id:'ana',kind:'windows',start:'2030-01-07T09:00',end:'2030-01-07T12:00',weeks:'1'}});
 return {submit,dialogs,requests,cache,window,nodes};
}
test('formulário profissional exibe resumo e cancelar não publica nem cria pendência',async()=>{
 const t=setup(),promise=t.submit(),dialog=t.dialogs[0];
 assert.equal(dialog.open,true);assert.match(dialog.children[1].textContent,/Salão teste/);assert.match(dialog.children[1].textContent,/Profissional: Ana/);assert.match(dialog.children[1].textContent,/Adicionar Atendimento/);
 assert.equal(t.requests.length,0);dialog.children[2].children[0].onclick();await promise;assert.equal(t.requests.length,0);assert.equal(t.cache.size,0);
});
test('confirmar no formulário salva uma vez na API profissional sem botão de sincronização',async()=>{
 const t=setup(),promise=t.submit(),dialog=t.dialogs[0];dialog.children[2].children[1].onclick();await promise;
 const writes=t.requests.filter(r=>r.method==='PUT');assert.equal(writes.length,1);assert.equal(writes[0].path,'http://localhost:6003/professional/shops/shop-test/salon/schedule');
 assert.equal(JSON.parse(writes[0].body).windows.length,1);assert.equal(JSON.parse([...t.cache.values()][0]).schedule,null);
});

test('profissional só abre edição de preço quando o salão autorizou e confirma o valor',async()=>{
 const denied=setup();assert.throws(()=>denied.window.testPriceModal('unhas'),/salão define/);
 const t=setup({priceAuthority:'professional'}),promise=t.window.testSubmit({dataset:{form:'price'},values:{id:'unhas',price:'80.00'}}),dialog=t.dialogs[0];
 assert.match(dialog.children[1].textContent,/Preço definido por você/);assert.equal(t.requests.length,0);dialog.children[2].children[1].onclick();await promise;
 const price=t.requests.find(r=>r.path.endsWith('/prices/unhas'));assert.equal(JSON.parse(price.body).price_cents,8000);assert.equal(JSON.parse(price.body).revision,0);
});

test('dono autoriza preço profissional e escolhe explicitamente a parcela do salão, sem autoenviar',async()=>{
 const t=setup({role:'admin'});t.window.testProfessionalModal('ana');assert.match(t.nodes.get('salon-dialog-content').innerHTML,/Profissional define o preço/);assert.match(t.nodes.get('salon-dialog-content').innerHTML,/Percentual do salão/);assert.doesNotMatch(t.nodes.get('salon-dialog-content').innerHTML,/name="settlement_recipient"/);
 await t.window.testSubmit({dataset:{form:'professional'},values:{id:'ana',name:'Ana',services:['unhas'],enabled:'on',professional_prices:'on',professional_settlement_value:'25'}});
 const p=JSON.parse([...t.cache.values()][0]).config.professionals[0];assert.equal(p.price_authority,'professional');assert.deepEqual(p.settlement,{recipient:'salon',mode:'percentage',value:2500});assert.equal(t.requests.length,0);
});

test('preço do salão configura repasse fixo do profissional em centavos',async()=>{
 const t=setup({role:'admin'});await t.window.testSubmit({dataset:{form:'professional'},values:{id:'ana',name:'Ana',services:['unhas'],enabled:'on',salon_settlement_mode:'fixed',salon_settlement_value:'20.50'}});
 const p=JSON.parse([...t.cache.values()][0]).config.professionals[0];assert.equal(p.price_authority,'salon');assert.deepEqual(p.settlement,{recipient:'professional',mode:'fixed',value:2050});assert.equal(t.requests.length,0);
});

test('servidor antigo preserva a agenda e informa que os painéis exigem atualização',async()=>{
 const t=setup({legacyBackend:true});await t.window.testLoad();assert.match(t.nodes.get('salon-main').innerHTML,/Atualize o servidor/);assert.match(t.nodes.get('salon-main').innerHTML,/agenda continua disponível/);assert.equal(t.requests.filter(r=>r.method!=='GET').length,0);
});

test('preço do profissional mostra só seu repasse líquido do percentual do salão',async()=>{
 const t=setup({priceAuthority:'professional',settlementRule:{recipient:'salon',mode:'percentage',value:2500}}),promise=t.window.testSubmit({dataset:{form:'price'},values:{id:'unhas',price:'80'}}),dialog=t.dialogs[0];
 assert.match(dialog.children[1].textContent,/Seu repasse: 75%/);assert.match(dialog.children[1].textContent,/60,00/);assert.doesNotMatch(dialog.children[1].textContent,/Salão recebe/);dialog.children[2].children[0].onclick();await promise;
});
