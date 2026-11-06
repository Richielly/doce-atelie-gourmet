const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../plan-limits.js');

const starter={source:'starter',plan:'Starter',status:'starter',features:[
 {key:'products',label:'Produtos no cardápio',kind:'limit',value:null,used:4},
 {key:'recipes',label:'Fichas técnicas',kind:'limit',value:3,used:3},
 {key:'pantry_items',label:'Ingredientes na despensa',kind:'limit',value:5,used:2},
 {key:'management',label:'Painéis gerenciais e relatórios',kind:'flag',value:false,used:null}]};

test('sem plano (servidor anterior ao 0.20.0) nada é limitado',()=>{
 P.set(null);
 assert.equal(P.limit('recipes'),null);assert.equal(P.reached('recipes',99),false);assert.equal(P.included('management'),true);
 assert.equal(P.usage('recipes',99),'');
 const html='<button class="btn" onclick="editRecipe()">Nova ficha técnica</button>';
 assert.equal(P.decorate(html,'recipes',99,'onclick="editRecipe()"'),html);
});

test('mostra uso e cadeado só ao atingir o limite',()=>{
 P.set(starter);
 assert.equal(P.limit('products'),null);assert.equal(P.limit('recipes'),3);assert.equal(P.included('management'),false);
 assert.equal(P.reached('pantry_items',4),false);assert.equal(P.reached('pantry_items',5),true);
 assert.match(P.usage('pantry_items',2),/2 de 5 ingredientes no plano Starter/);assert.doesNotMatch(P.usage('pantry_items',2),/plan-lock-icon/);
 const full=P.decorate('<div><button class="btn primary" onclick="editRecipe()">Nova ficha técnica</button></div>','recipes',3,'onclick="editRecipe()"');
 assert.match(full,/<button class="btn primary" onclick="editRecipe\(\)" data-plan-locked="true"><svg class="plan-lock-icon"[^]*<\/svg>Nova ficha técnica<\/button><p class="plan-usage plan-usage-full"/);
 assert.match(full,/disponível em planos maiores/);
});

test('acima do limite após troca de plano: nada é apagado, só não cresce',()=>{
 P.set(starter);
 assert.equal(P.reached('recipes',10),true);
 assert.match(P.message('recipes',10),/10 de 3 fichas técnicas[^]*continua e pode ser editado/);
});

test('funcionalidade não incluída: limite 0 ou recurso desligado',()=>{
 P.set({...starter,features:[...starter.features,{key:'services',label:'Serviços',kind:'limit',value:0,included:false,used:2},{key:'bonuses',label:'Benefícios',kind:'flag',value:false,included:false,used:null}]});
 assert.equal(P.included('services'),false);assert.equal(P.included('bonuses'),false);assert.equal(P.included('recipes'),true);
 assert.equal(P.reached('services',0),true);
 assert.match(P.usage('services',2),/Não incluído no plano Starter/);assert.doesNotMatch(P.usage('services',2),/2 de 0/);
 assert.match(P.message('services',2),/não faz parte do plano Starter[^]*continua e pode ser editado/);
});

test('painel bloqueado escapa o nome do plano',()=>{
 P.set({...starter,plan:'<b>X</b>'});
 const html=P.lockedPanel('Painéis gerenciais',['Vendas por dia']);
 assert.match(html,/&lt;b&gt;X&lt;\/b&gt;/);assert.match(html,/Pedidos, agenda e alertas continuam/);
});

test('administração da doçaria: módulo não incluído bloqueia tela e marca o menu',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const tile=(page,name)=>`<button class="admin-menu-tile" onclick="tab='${page}';render()"><span class="admin-menu-icon"></span><span>${name}</span></button>`;
 const box={db:{products:[{}],recipes:[{},{}],pantry:[]},admin:true,
  adminProducts:()=>'<div><button onclick="editProduct()">Novo produto</button></div>',adminPantry:()=>'despensa real',adminPlanner:()=>'produção real',
  adminBonuses:()=>'benefícios reais',adminDashboard:()=>'painel',adminMenu:()=>tile('pantry','Despensa')+tile('planner','Produção')+tile('bonuses','Bonificações')+tile('stock','Estoque'),
  editProduct(){},editRecipe(){},editIngredient(){}};
 box.window=box;vm.createContext(box);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','plan-limits.js'),'utf8'),box);
 const off=(key,kind='limit')=>({key,kind,value:kind==='flag'?false:0,included:false});
 // Without a plan, or with the feature included, the real screens stay.
 assert.equal(box.adminPlanner(),'produção real');assert.doesNotMatch(box.adminMenu(),/data-plan-locked/);
 box.ElumePlan.set({plan:'Sob medida',features:[off('recipes'),off('pantry_items'),off('bonuses','flag'),off('products')]});
 assert.match(box.adminPlanner(),/Não incluído no seu plano atual[^]*Sob medida/);assert.doesNotMatch(box.adminPlanner(),/produção real/);
 assert.doesNotMatch(box.adminPantry(),/despensa real/);assert.doesNotMatch(box.adminBonuses(),/benefícios reais/);
 assert.equal((box.adminMenu().match(/data-plan-locked/g)||[]).length,3);
 assert.match(box.adminMenu(),/onclick="tab='stock';render\(\)"><span/);
 // Products left out keep the screen: what exists stays editable, only new ones stop.
 assert.match(box.adminProducts(),/data-plan-locked[^]*Não incluído no plano Sob medida/);
});
