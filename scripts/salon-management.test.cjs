const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};const context=vm.createContext({window,Date});
vm.runInContext(fs.readFileSync(require.resolve('../salon-icons.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../salon-management-ui.js'),'utf8'),context);
const ui=window.ElumeSalonManagement;
test('situação combina ícone, texto e etapa atual; remanejamento não promete atendimento',()=>{
 assert.match(ui.status({status:'in_service'}),/aria-current="step"/);assert.match(ui.status({status:'in_service'}),/Em atendimento/);
 assert.match(ui.status({status:'confirmed',needs_reassignment:true}),/Precisa de remanejamento/);
 assert.doesNotMatch(ui.status({status:'confirmed',needs_reassignment:true}),/aria-current/);
});
test('offline distingue pausa de novas reservas de ausência e mantém ações visíveis',()=>{
 const html=ui.presence({online:false});assert.match(html,/Ficar online/);assert.match(html,/Informar ausência/);assert.match(html,/compromissos existentes continuam válidos/);
});
test('recuperação mostra só afetados e aguarda aceite de proposta já enviada',()=>{
 const items=[{id:'a',needs_reassignment:true,service:'Unhas',start:'2030-01-01',customer_name:'<script>'},{id:'b',needs_reassignment:false}];
 const html=ui.recovery(items,[{replace_id:'a',status:'pending'}],()=>{throw Error('Não duplicar proposta');});
 assert.match(html,/aguardando cliente/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
