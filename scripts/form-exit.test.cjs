const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function module(){const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../form-exit.js'),'utf8'),{window});return window.DoceFormExit;}
test('sair sem alterações não pergunta nem salva; reverter campos também fica limpo',async()=>{
 let value='a',closed=0;const c=module().create({snapshot:()=>value,choose:()=>{throw Error('Não perguntar');},persist:()=>{throw Error('Não salvar');},close:()=>closed++});value='b';value='a';await c.exit();assert.equal(closed,1);
});
test('continuar preserva edição; descartar fecha sem persistir',async()=>{
 let value='a',choice='continue',closed=0,saved=0;const c=module().create({snapshot:()=>value,choose:async()=>choice,persist:()=>saved++,close:()=>closed++});value='b';assert.equal(await c.exit(),false);assert.equal(c.dirty(),true);choice='discard';await c.exit();assert.equal(closed,1);assert.equal(saved,0);
});
test('salvar e sair aguarda gravação e bloqueia toques duplicados',async()=>{
 let value='a',resolve,closed=0,saves=0;const c=module().create({snapshot:()=>value,choose:async()=> 'save',persist:()=>{saves++;return new Promise(r=>resolve=r);},close:()=>closed++});value='b';const saving=c.exit();await new Promise(r=>setImmediate(r));await c.exit();await c.save();assert.equal(closed,0);assert.equal(saves,1);resolve(true);await saving;assert.equal(closed,1);
});
test('falha ou formulário inválido não fecha nem elimina edição',async()=>{
 let value='a',closed=0,errors=0,valid=false;const c=module().create({snapshot:()=>value,choose:async()=> 'save',persist:async()=>{if(!valid)return false;throw Error('Falha de armazenamento');},close:()=>closed++,onError:()=>errors++});value='b';await c.exit();valid=true;await c.save();assert.equal(closed,0);assert.equal(errors,1);assert.equal(c.dirty(),true);
});
function recipe({decision='continue',failure=false,valid=true}={}){
 const values={product:'1',yieldQty:'20',extraCost:'0',ing_10:'0'},form={reportValidity:()=>valid},db={products:[{id:1,name:'Brigadeiro'}],pantry:[{id:10,name:'Chocolate',unit:'g'}],recipes:[]};let closed=0,saves=0,errors=0,html='';
 const context={pIcon:()=>'',activeItems:(keep=[])=>db.pantry.filter(i=>i.active!==false||keep.includes(i.id)),window:{},document:{addEventListener(){},getElementById:()=>form,querySelector:()=>({classList:{add(){}}})},db,clone:v=>JSON.parse(JSON.stringify(v)),P:{unitCost:()=>1,recipeCost:()=>1},perUnit:()=> 'R$ 1/g',esc:s=>s,render(){},notify(){},fail(){errors++;},showModal:s=>html=s,closeModal:()=>closed++,save:async()=>{saves++;if(failure)throw Error('Storage');},FormData:class{get(k){return values[k];}entries(){return Object.entries(values);}},Date};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../form-exit.js'),'utf8'),context);context.DoceFormExit=context.window.DoceFormExit;context.DoceFormExit.chooseRecipeExit=async()=>decision;
 const source=fs.readFileSync(require.resolve('../pantry-ui.js'),'utf8');vm.runInContext(source.slice(source.indexOf(' let recipeEditor='),source.indexOf(' const priorPlanner=')),context);context.editRecipe();
 return {values,db,context,form,get closed(){return closed;},get saves(){return saves;},get errors(){return errors;},get html(){return html;}};
}
test('ficha real descarta campos alterados sem criar receita ou salvar rascunho',async()=>{
 const t=recipe({decision:'discard'});assert.match(t.html,/Sair da ficha técnica/);assert.match(t.html,/form="recipe-form"/);assert.equal((t.html.match(/onclick="closeModal\(\)"/g)||[]).length,1);assert.doesNotMatch(t.html,/recipe-editor-actions/);t.values.ing_10='15';await t.context.closeModal();assert.equal(t.db.recipes.length,0);assert.equal(t.saves,0);assert.equal(t.closed,1);
});
test('ficha real salva porções e rendimento antes de fechar, sem publicar',async()=>{
 const t=recipe({decision:'save'});t.values.ing_10='15';t.values.yieldQty='30';await t.context.closeModal();assert.equal(t.saves,1);assert.equal(t.db.recipes[0].ingredients[0].qty,15);assert.equal(t.db.recipes[0].yieldQty,30);assert.equal(t.closed,1);
});
test('ficha com erro de armazenamento restaura receita e mantém editor aberto',async()=>{
 const t=recipe({decision:'save',failure:true});t.values.ing_10='15';await t.context.closeModal();assert.equal(t.db.recipes.length,0);assert.equal(t.closed,0);assert.equal(t.errors,1);
});
test('ficha inválida mantém dados editáveis sem salvar ou fechar',async()=>{
 const t=recipe({decision:'save',valid:false});t.values.yieldQty='';await t.context.closeModal();assert.equal(t.closed,0);assert.equal(t.saves,0);
});

test('salvar pelo ícone mantém ficha aberta e sair depois não pergunta novamente',async()=>{
 const t=recipe();t.values.ing_10='15';await t.context.saveRecipe({preventDefault(){}});assert.equal(t.saves,1);assert.equal(t.closed,0);await t.context.closeModal();assert.equal(t.closed,1);assert.equal(t.saves,1);
});
