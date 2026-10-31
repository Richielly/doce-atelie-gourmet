const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(overrides={}){
 const events=[],window={};vm.runInNewContext(fs.readFileSync(require.resolve('../professional-submit.js'),'utf8'),{window});
 const options={confirm:()=>{events.push('confirm');return true;},begin:()=>{events.push('loading');return()=>events.push('end');},track:op=>events.push(['pending',op]),request:async op=>{events.push(['request',op]);return 7;},commit:op=>events.push(['saved',op]),refresh:async()=>events.push('refresh'),onRefreshError:()=>events.push('refresh-error'),...overrides};
 return {flow:window.ElumeProfessionalSubmit.create(options),events};
}
test('cancelar a confirmação não grava, não solicita API nem mostra carregamento',async()=>{
 const t=setup({confirm:()=>false});assert.equal(await t.flow.execute({id:1},'Conferir dados'),false);assert.deepEqual(t.events,[]);
});
test('confirmar envia somente a ação conferida, sem etapa posterior de sincronização',async()=>{
 const t=setup(),op={id:'horario-ana'};assert.equal(await t.flow.execute(op,'Ana · salão · período'),true);
 assert.deepEqual(t.events,['confirm','loading',['pending',op],['request',op],['saved',op],'refresh','end']);
});
test('erro mantém ação pendente e nova tentativa exige outra confirmação',async()=>{
 let attempts=0,confirms=0;const op={request_id:'same-id'},t=setup({confirm:()=>{confirms++;return true;},request:async()=>{if(++attempts===1)throw Error('Sem rede');return 7;}});
 await assert.rejects(t.flow.execute(op,'Conferir'),/Sem rede/);assert.equal(t.events.filter(e=>Array.isArray(e)&&e[0]==='saved').length,0);assert.equal(t.events.at(-1),'end');
 assert.equal(attempts,1);await t.flow.execute(op,'Conferir novamente');assert.equal(confirms,2);assert.equal(attempts,2);
});
test('toques simultâneos não duplicam confirmação nem envio',async()=>{
 let release,calls=0;const t=setup({request:()=>{calls++;return new Promise(r=>release=r);}}),first=t.flow.execute({id:1},'Conferir');
 await Promise.resolve();assert.equal(await t.flow.execute({id:2},'Outro'),false);release(7);await first;assert.equal(calls,1);
});
test('falha de atualização após salvar não volta a deixar a ação pendente',async()=>{
 const t=setup({refresh:async()=>{throw Error('Leitura falhou');}});assert.equal(await t.flow.execute({id:1},'Conferir'),true);
 assert.ok(t.events.some(e=>Array.isArray(e)&&e[0]==='saved'));assert.ok(t.events.includes('refresh-error'));
});
