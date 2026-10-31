const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=[],events={},timers=new Map();let id=0;
 const document={head:{append(){}},body:{append(node){nodes.push(node);}},documentElement:{dataset:{}},addEventListener(name,fn){events[name]=fn;},createElement(tag){return {tag,open:false,append(){},setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}};}};
 const window={addEventListener(name,fn){events[name]=fn;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../loading-ui.js'),'utf8'),{document,window,MutationObserver:class{observe(){}},setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},Date});
 return {loading:window.DoceLoading,nodes,flush(){for(const fn of [...timers.values()])fn();timers.clear();}};
}
test('operações sobrepostas mantêm bloqueio até a última terminar e encerramento é idempotente',()=>{
 const ui=setup(),a=ui.loading.begin(),b=ui.loading.begin();assert.equal(ui.nodes[0].open,true);a();a();ui.flush();assert.equal(ui.nodes[0].open,true);b();ui.flush();assert.equal(ui.nodes[0].open,false);
});
test('erro encerra a animação sem ocultar a falha da operação',async()=>{
 const ui=setup();await assert.rejects(ui.loading.run(async()=>{throw Error('Sem conexão');}),/Sem conexão/);ui.flush();assert.equal(ui.nodes[0].open,false);assert.equal(await ui.loading.run(()=>42),42);ui.flush();assert.equal(ui.nodes[0].open,false);
});
