const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../notification-core.js');
function loadHarness(){const source=fs.readFileSync(require.resolve('../notifications.js'),'utf8'),start=source.indexOf('async function load('),end=source.indexOf('async function adminKeys(',start),alerts=[];const context={loadUsage:async()=>{},C,dialog:null,native:false,push:null,osToken:'',save(){},paintBadge(){},alert:(ctx,n)=>alerts.push(n.id)};vm.runInNewContext(source.slice(start,end)+';this.load=load;',context);return {...context,alerts};}
const response=items=>({items,unread:items.filter(n=>!n.read).length,preferences:{categories:{},sound:true,push:false},shop:{name:'Teste'},push_configured:false,more:false});

function centerHarness(){
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.attributes={};this.className='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attributes[k]=v;}
 }
 const source=fs.readFileSync(require.resolve('../notifications.js'),'utf8'),content=new Element('div'),badge=new Element('span'),bell=new Element('button'),requests=[],navigation=[];
 bell.querySelector=()=>badge;
 const a={store:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',api:'https://a.exemplo',name:'Loja A'},role:'customer',identity:'cliente-a',unread:200,preferences:{categories:{},sound:true},items:Array.from({length:12},(_,id)=>({id:id+1,title:'Aviso '+id,body:'Informação completa '.repeat(35),created_at:new Date(2026,9,id+1).toISOString(),read:false,target:{screen:'orders',order_id:'pedido-'+id}})),request:async(...args)=>{requests.push(args);},navigate:async target=>navigation.push(target)};
 const b={...a,store:{...a.store,id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',api:'https://b.exemplo',name:'Loja B'},identity:'cliente-b',unread:17,items:[{id:31,title:'Outra loja',body:'Outro aviso',created_at:'2026-10-13T00:00:00Z',read:false,target:{screen:'quotes',quote_id:'quote-b'}}]};
 const contexts=new Map([[C.key(a.store,a.role),a],[C.key(b.store,b.role),b]]),dialog={open:true,showModal(){this.open=true;},close(){this.open=false;}};
 const context={trackUsage(){},C,contexts,content,dialog,current:a,filter:'all',selectedNotice:null,preferencesVisible:false,errorMessage:'',document:{createElement:tag=>new Element(tag),baseURI:'https://app.exemplo/index.html'},location:{href:'https://app.exemplo/index.html'},preferenceOpen:new Set(),native:false,window:{},draftRows:()=>[],save(){},mount(){},iconButton:bell,Date,console};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf(' function totalUnread('),source.indexOf(' function mount(')),context);
 vm.runInContext(source.slice(source.indexOf(' function el('),source.indexOf(' let unlocked=')),context);
 const all=(node=content)=>[node,...node.children.flatMap(n=>all(n))];
 return {context,a,b,content,badge,requests,navigation,all};
}

test('central mostra cinco prévias e contador total, preservando avisos antigos',()=>{
 const h=centerHarness();h.context.render();h.context.paintBadge();const preview=h.all().filter(n=>n.className.startsWith('notice-preview')&&n.tagName==='button');assert.equal(preview.length,5);assert.equal(h.badge.textContent,'217');assert.equal(h.a.items.length,12);assert.equal(h.b.items.length,1);assert.equal(h.requests.length,0);
 assert.ok(h.all().some(n=>n.textContent==='217 não lidas no total · até 5 mais recentes'));assert.ok(!h.all().some(n=>n.className==='notice-preferences'));
});

test('tocar prévia abre detalhe completo e lê somente esse aviso; Ver navega depois',async()=>{
 const h=centerHarness(),n=h.context.rows().find(n=>n.ctx===h.a);await h.context.showNotice(n);assert.equal(h.a.unread,199);assert.equal(h.navigation.length,0);assert.equal(h.context.location.href,'https://app.exemplo/index.html');assert.equal(h.requests.length,1);
 assert.ok(h.all().some(e=>e.className==='notice-full-body'&&e.textContent===n.body));assert.ok(h.all().some(e=>e.tagName==='button'&&e.textContent==='Ver'));
 await h.context.openNotice(h.context.selectedEntry());assert.equal(h.navigation.length,1);assert.equal(h.navigation[0].order_id,n.target.order_id);assert.equal(h.requests.length,1);
});

test('aviso sem ação não oferece Ver e não inventa um destino',async()=>{
 const h=centerHarness(),n={...h.context.rows()[0],target:{}};h.b.items[0].target={};await h.context.showNotice(n);assert.ok(!h.all().some(e=>e.tagName==='button'&&e.textContent==='Ver'));await h.context.openNotice(n);assert.equal(h.navigation.length,0);assert.equal(h.context.location.href,'https://app.exemplo/index.html');
});

test('Ver de outra loja mantém servidor e identidade corretos',async()=>{
 const h=centerHarness(),n=h.context.rows().find(n=>n.ctx===h.b);await h.context.showNotice(n);await h.context.openNotice(h.context.selectedEntry());const url=new URL(h.context.location.href);assert.equal(url.searchParams.get('loja'),h.b.store.id);assert.equal(url.searchParams.get('api'),h.b.store.api);assert.equal(url.searchParams.get('notification_item'),'quote-b');assert.equal(h.navigation.length,0);
});

test('troca de identidade fecha detalhe antigo sem exibir dados do perfil anterior',async()=>{
 const h=centerHarness(),n=h.context.rows().find(n=>n.ctx===h.a);await h.context.showNotice(n);h.a.identity='novo-cliente';h.a.items=[];h.context.render();assert.equal(h.context.selectedNotice,null);assert.ok(!h.all().some(e=>e.className==='notice-full-body'));
});
test('primeiro histórico é silencioso mas primeiro evento após caixa vazia toca',async()=>{const h=loadHarness(),ctx={items:[],latest:0,loaded:false,request:async()=>response([])};await h.load(ctx);assert.deepEqual(h.alerts,[]);ctx.request=async()=>response([{id:10,read:false}]);await h.load(ctx);assert.deepEqual(h.alerts,[10]);await h.load(ctx);assert.deepEqual(h.alerts,[10]);});
test('restauração inicial não toca eventos históricos e falha não apaga a caixa',async()=>{const h=loadHarness(),ctx={items:[],latest:0,loaded:false,request:async()=>response([{id:3,read:false}])};await h.load(ctx);assert.deepEqual(h.alerts,[]);ctx.request=async()=>{throw Error('Offline')};await h.load(ctx);assert.equal(ctx.items[0].id,3);assert.equal(ctx.error,'Offline');assert.equal(ctx.loading,false);});
test('paginar avisos antigos não gera novo som nem reduz o cursor',async()=>{const h=loadHarness(),ctx={items:[{id:20,read:false}],latest:20,loaded:true,request:async()=>response([{id:7,read:false}])};await h.load(ctx,10);assert.deepEqual(h.alerts,[]);assert.equal(ctx.latest,20);assert.equal(ctx.items.length,2);});
test('trocar a identidade autorizada não mistura histórico nem cursores antigos',async()=>{const h=loadHarness(),ctx={identity:'old-person',items:[{id:100,read:false}],latest:100,loaded:true,registered:'old-token',request:async()=>({...response([{id:8,read:false}]),identity:'new-person'})};await h.load(ctx);assert.equal(ctx.items.length,1);assert.equal(ctx.items[0].id,8);assert.equal(ctx.latest,8);assert.equal(ctx.registered,'');assert.deepEqual(h.alerts,[]);});
test('abrir aviso já lido não decrementa novamente o contador nem faz nova gravação',async()=>{const source=fs.readFileSync(require.resolve('../notifications.js'),'utf8'),start=source.indexOf('async function readOne('),end=source.indexOf('async function readAll(',start);let calls=0;const context={save(){},paintBadge(){},render(){}};vm.runInNewContext(source.slice(start,end)+';this.readOne=readOne;',context);const row={id:1,read:false},ctx={items:[row],unread:3,request:async()=>{calls++}},n={...row,ctx};await context.readOne(n);await context.readOne(n);assert.equal(ctx.unread,2);assert.equal(calls,1);});
test('toques simultâneos no mesmo aviso compartilham a gravação de leitura',async()=>{const source=fs.readFileSync(require.resolve('../notifications.js'),'utf8'),start=source.indexOf('async function readOne('),end=source.indexOf('async function readAll(',start);let calls=0,finish;const context={save(){},paintBadge(){},render(){}};vm.runInNewContext(source.slice(start,end)+';this.readOne=readOne;',context);const row={id:2,read:false},ctx={items:[row],unread:4,request:()=>{calls++;return new Promise(r=>finish=r);}},n={...row,ctx};const a=context.readOne(n),b=context.readOne({...row,ctx});finish();await Promise.all([a,b]);assert.equal(ctx.unread,3);assert.equal(calls,1);});
test('rascunho agenda apenas um lembrete local e envio cancela sem chamar API',()=>{const source=fs.readFileSync(require.resolve('../notifications.js'),'utf8'),start=source.indexOf('const draftKey='),end=source.indexOf('function markDraft(',start),store={api:'https://servidor.exemplo',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},values=new Map(),scheduled=[],cancelled=[];const ctx={store,role:'admin',preferences:{desktop:true,sound:true,categories:{drafts:true}}},context={C,contexts:new Map([[C.key(store,'admin'),ctx]]),localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},local:{schedule:async value=>scheduled.push(value),cancel:async value=>cancelled.push(value)},paintBadge(){},Date};vm.runInNewContext(source.slice(start,end)+';this.draft=draft;this.draftRows=draftRows;',context);context.draft(store,true);context.draft(store,true);assert.equal(scheduled.length,1);assert.equal(context.draftRows().length,0);const key=[...values.keys()][0],value=JSON.parse(values.get(key));value.since=Date.now()-301000;values.set(key,JSON.stringify(value));assert.equal(context.draftRows().length,1);context.draft(store,false);assert.equal(values.size,0);assert.equal(cancelled.length,1);assert.equal(context.draftRows().length,0);});


test('falha de leitura preserva contador e detalhe completo sem navegar',async()=>{
 const h=centerHarness(),n=h.context.rows().find(n=>n.ctx===h.a);h.a.request=async()=>{throw Error('Offline')};await h.context.showNotice(n);assert.equal(h.a.unread,200);assert.equal(h.navigation.length,0);assert.ok(h.all().some(e=>e.className==='notice-full-body'&&e.textContent===n.body));assert.ok(h.context.errorMessage.includes('Offline'));
});
test('pedido, orçamento e agendamento novo são alerta de venda; sistema fica separado',()=>{
 assert.equal(C.lane('admin',{category:'orders',title:'Novo pedido'}),'order');assert.equal(C.lane('admin',{category:'on_way',title:'Cliente a caminho'}),'order');
 assert.equal(C.lane('admin',{category:'quotes',title:'Novo orçamento'}),'quote');assert.equal(C.lane('admin',{category:'salon',title:'Novo agendamento'}),'booking');
 for(const n of [{category:'inventory',title:'Ingrediente precisa de reposição'},{category:'orders',title:'Resumo da semana'},{category:'salon',title:'Atendimento concluído'},{category:'offers',title:'Campanha'},{local:true,category:'drafts',title:'Alterações não enviadas'}])assert.equal(C.lane('admin',n),'system',n.title);
 assert.equal(C.lane('customer',{category:'orders',title:'Pedido recebido'}),'system','cliente não recebe alerta de venda');
});
test('central do lojista filtra vendas e sistema e marca o tipo de cada aviso',()=>{
 const h=centerHarness();for(const c of [h.a,h.b])c.role='admin';h.context.contexts.clear();for(const c of [h.a,h.b])h.context.contexts.set(C.key(c.store,c.role),c);
 h.a.items=[{id:1,category:'orders',title:'Novo pedido',body:'R$ 12,00',created_at:'2026-11-08T10:00:00Z',read:false,target:{screen:'orders'}},{id:2,category:'inventory',title:'Ingrediente precisa de reposição',body:'Leite',created_at:'2026-11-08T09:00:00Z',read:false,target:{screen:'pantry'}}];h.b.items=[{id:3,category:'salon',title:'Novo agendamento',body:'Corte',created_at:'2026-11-08T08:00:00Z',read:false,target:{screen:'salon'}}];
 h.context.filter='sales';assert.equal(h.context.rows().map(n=>n.id).join(),'1,3');h.context.filter='system';assert.equal(h.context.rows().map(n=>n.id).join(),'2');
 h.context.filter='all';h.context.render();const chips=h.all().filter(n=>n.className.startsWith('notice-chip')).map(n=>n.textContent);assert.deepEqual(chips,['Pedido','Agendamento']);
 assert.ok(h.all().some(n=>n.tagName==='option'&&n.textContent==='Vendas, orçamentos e agenda'));
});
