const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function button(label,action){const attrs=new Map(),classes=new Set();return {dataset:{action},textContent:label,innerHTML:label,title:'',attrs,classList:{contains:v=>classes.has(v),add:v=>classes.add(v)},getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),closest:()=>null,querySelector:()=>null};}
function icons(){const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../salon-icons.js'),'utf8'),{window});return window.ElumeSalonIcons;}
test('ação vira ícone com nome acessível e dica, sem perder sua identificação',()=>{
 const b=button('Definir preço da manicure','price');icons().decorate({querySelectorAll:()=>[b]});assert.match(b.innerHTML,/<svg/);assert.equal(b.attrs.get('aria-label'),'Definir preço da manicure');assert.equal(b.title,'Definir preço da manicure');assert.equal(b.dataset.action,'price');
});
test('horários de escolha preservam o valor visível e decorar novamente é idempotente',()=>{
 const slot=button('09:00','slot'),save=button('Salvar período','send'),ui=icons();ui.decorate({querySelectorAll:()=>[slot,save]});const original=save.innerHTML;ui.decorate({querySelectorAll:()=>[slot,save]});assert.equal(slot.innerHTML,'09:00');assert.equal(save.innerHTML,original);
});

test('cards e confirmações mantêm ação legível e benefícios diferem de favoritos',()=>{
 const b=button('Resgatar benefício','redeem'),ui=icons();ui.decorate({querySelectorAll:()=>[b]});assert.match(b.innerHTML,/<span>Resgatar benefício<\/span>/);assert.notEqual(ui.svg('gift'),ui.svg('heart'));
});

test('atalho entre telas mantém o nome visível mesmo sem SVG anterior',()=>{
const b=button('Configurar meu salão','page');b.dataset.id='setup';icons().decorate({querySelectorAll:()=>[b]});assert.match(b.innerHTML,/<span>Configurar meu salão<\/span>/);
});
