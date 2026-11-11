const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../pantry-costs.js'),K=require('../kits.js');

function fixture(){
 const db={orders:[],
  products:[{id:1,name:'Brigadeiro',price:6,cost:.9,stock:40,inventoryCost:.9},{id:2,name:'Beijinho',price:6,cost:.9,stock:10,inventoryCost:.9},{id:3,name:'Caixinha de 3',price:15,cost:0,stock:0,isKit:true}],
  pantry:[{id:10,name:'Leite',unit:'g',qty:10000,stockValue:100,category:'ingredient'},{id:11,name:'Caixinha',unit:'un',qty:30,stockValue:45,category:'packaging'},{id:12,name:'Laço',unit:'un',qty:12,stockValue:6,category:'packaging'}],
  recipes:[{id:100,product:1,yieldQty:20,extraCost:0,ingredients:[{id:10,qty:1000}]}],
  kits:[{id:50,product:3,items:[{product:1,qty:2},{product:2,qty:1}],supplies:[{id:11,qty:1},{id:12,qty:1}],extraCost:0}]};
 P.migrate(db);return db;
}
const stock=(db,id)=>db.products.find(p=>p.id===id).stock;

test('margem do kit soma produtos e insumos pelo custo médio e compara com a venda separada',()=>{
 const db=fixture(),e=K.economics(db,db.kits[0],15);
 // 3 × 0,90 + caixinha 1,50 + laço 0,50
 assert.equal(e.total,4.7);assert.equal(e.profit,10.3);assert.ok(Math.abs(e.margin-10.3/15)<1e-9);
 assert.equal(e.loose,18);assert.ok(Math.abs(e.saving-3/18)<1e-9);
});

test('nova compra de insumo muda o custo médio usado no kit',()=>{
 const db=fixture();
 P.purchase(db,12,{qty:12,total:18,supplier:'Armarinho',purchasedOn:P.day()});
 assert.equal(K.economics(db,db.kits[0],15).supplies.find(s=>s.id===12).unitCost,1);
 P.reconcile(db);assert.equal(db.products[2].cost,5.2);
});

test('insumo também serve na ficha do doce e tem saldo único',()=>{
 const db=fixture();db.recipes[0].ingredients.push({id:11,qty:20});
 assert.equal(P.recipeCost(db,db.recipes[0]),10+30);
 P.produce(db,db.recipes[0],1);
 assert.equal(db.pantry[1].qty,10);assert.equal(K.capacity(db,db.kits[0]).lines.find(l=>l.name==='Caixinha').available,10);
});

test('fluxo 1: mostra quantos dá para montar e o que limita, sem alterar nada',()=>{
 const db=fixture(),before=JSON.stringify(db),c=K.capacity(db,db.kits[0]);
 assert.equal(c.count,10);assert.deepEqual(c.limiting.map(l=>l.name),['Beijinho']);
 assert.equal(c.missingNext.find(l=>l.name==='Beijinho').missing,1);
 assert.equal(JSON.stringify(db),before);
});

test('fluxo 1: montar baixa saldo de venda e insumos e coloca o kit à venda com o custo real',()=>{
 const db=fixture(),r=K.assemble(db,db.kits[0],5);
 assert.equal(stock(db,1),30);assert.equal(stock(db,2),5);assert.equal(stock(db,3),5);
 assert.equal(db.pantry[1].qty,25);assert.equal(db.pantry[2].qty,7);
 assert.equal(r.cost,23.5);assert.equal(db.products[2].inventoryCost,4.7);
 assert.equal(db.pantryMovements.filter(m=>m.kind==='Consumo na montagem').length,2);
});

test('fluxo 1: não monta além do saldo nem deixa nada pela metade',()=>{
 const db=fixture(),before=JSON.stringify(db);
 assert.throws(()=>K.assemble(db,db.kits[0],11),/Saldo insuficiente de Beijinho/);
 assert.equal(JSON.stringify(db),before);
 db.pantry[2].qty=1;db.pantry[2].stockValue=.5;const held=JSON.stringify(db);
 assert.throws(()=>K.assemble(db,db.kits[0],2),/Falta 1 un de Laço/);
 assert.equal(JSON.stringify(db),held);
});

test('fluxo 2: mostra o que falta produzir e comprar, sem mexer no estoque',()=>{
 const db=fixture();db.products[1].stock=0;db.pantry[2].qty=4;db.pantry[2].stockValue=2;
 const before=stock(db,1),plan=K.createPlan(db,db.kits[0],10),v=K.planView(db,plan);
 const brig=v.components.find(c=>c.product===1),beij=v.components.find(c=>c.product===2);
 assert.equal(brig.need,20);assert.equal(brig.toMake,20);assert.equal(brig.batches,1);assert.equal(brig.free,before);
 assert.equal(beij.toMake,10);assert.equal(beij.recipeId,null);
 assert.deepEqual(v.missing.map(x=>[x.name,x.missing]),[['Laço',6]]);assert.equal(v.ready,0);
 assert.equal(stock(db,1),before);
});

test('fluxo 2: produção do preparo fica reservada e não entra no saldo de venda',()=>{
 const db=fixture();db.products[0].stock=0;
 const plan=K.createPlan(db,db.kits[0],10),r=K.produceForPlan(db,plan,1,1);
 assert.equal(stock(db,1),0,'o cliente não pode comprar o que foi reservado');
 assert.equal(plan.reserved[1].qty,20);assert.equal(r.reservedUnits,20);assert.equal(r.kitPlan,plan.id);
 assert.equal(db.pantry[0].qty,9000);
});

test('fluxo 2: só a sobra da receita vai para o saldo de venda, com custo proporcional',()=>{
 const db=fixture();db.products[0].stock=0;
 const plan=K.createPlan(db,db.kits[0],5);K.produceForPlan(db,plan,1,1);
 assert.equal(plan.reserved[1].qty,10);assert.equal(stock(db,1),10);
 assert.equal(plan.reserved[1].value,5);assert.equal(db.products[0].inventoryCost,.5);
});

test('fluxo 2: venda do saldo não consome a reserva e a montagem usa só a reserva',()=>{
 const db=fixture();db.products[0].stock=0;db.products[1].stock=10;
 const plan=K.createPlan(db,db.kits[0],10);K.produceForPlan(db,plan,1,1);K.reserveFromStock(db,plan,2,10);
 assert.equal(stock(db,2),0);assert.equal(K.planView(db,plan).ready,10);
 db.products[0].stock=7; // produção comum que entrou depois, à venda
 K.assemble(db,db.kits[0],4,plan);
 assert.equal(stock(db,1),7,'saldo de venda intacto');assert.equal(plan.reserved[1].qty,12);assert.equal(plan.assembled,4);assert.equal(stock(db,3),4);
 K.assemble(db,db.kits[0],6,plan);
 assert.equal(plan.status,'done');assert.equal(stock(db,3),10);assert.equal(stock(db,1),7);
 assert.equal(db.kitAssemblies.at(-1).plan,plan.id);
});

test('produção comum continua igual com preparo aberto',()=>{
 const db=fixture(),plan=K.createPlan(db,db.kits[0],10);K.produceForPlan(db,plan,1,1);
 const before=stock(db,1),r=P.produce(db,db.recipes[0],1);
 assert.equal(stock(db,1),before+20);assert.equal(r.kitPlan,undefined);assert.equal(plan.reserved[1].qty,20);
});

test('preparo não reserva além do necessário nem de saldo que não existe',()=>{
 const db=fixture(),plan=K.createPlan(db,db.kits[0],2);
 assert.throws(()=>K.reserveFromStock(db,plan,1,5),/só 4 un/);
 db.products[1].stock=0;assert.throws(()=>K.reserveFromStock(db,plan,2,1),/Saldo insuficiente/);
 K.reserveFromStock(db,plan,1,4);assert.throws(()=>K.produceForPlan(db,plan,1,1),/já está completa/);
 assert.throws(()=>K.createPlan(db,db.kits[0],1.5),/inteiro/);
});

test('encerrar preparo devolve a reserva ao saldo de venda sem perder nada',()=>{
 const db=fixture();db.products[0].stock=0;
 const plan=K.createPlan(db,db.kits[0],10);K.produceForPlan(db,plan,1,1);K.cancelPlan(db,plan);
 assert.equal(stock(db,1),20);assert.equal(db.products[0].inventoryCost,.5);assert.deepEqual(plan.reserved,{});assert.equal(plan.status,'cancelled');
 assert.throws(()=>K.assemble(db,db.kits[0],1,plan),/não está aberto/);
});

test('desmontar devolve produtos pelo custo da montagem e insumos ficam como perda',()=>{
 const db=fixture();K.assemble(db,db.kits[0],5);
 const box=db.pantry[1].qty;K.disassemble(db,db.kits[0],2);
 assert.equal(stock(db,3),3);assert.equal(stock(db,1),34);assert.equal(stock(db,2),7);assert.equal(db.pantry[1].qty,box);
 assert.throws(()=>K.disassemble(db,db.kits[0],4),/Só há 3/);
});

test('ficha inválida é recusada: kit dentro de kit, sem produto e insumo inexistente',()=>{
 const db=fixture();
 assert.throws(()=>K.validate(db,{product:3,items:[{product:3,qty:1}],supplies:[]}),/outro kit/);
 assert.throws(()=>K.validate(db,{product:3,items:[],supplies:[]}),/pelo menos um produto/);
 assert.throws(()=>K.validate(db,{product:3,items:[{product:1,qty:1.5}],supplies:[]}),/inteiras/);
 assert.throws(()=>K.validate(db,{product:3,items:[{product:1,qty:1}],supplies:[{id:99,qty:1}]}),/Insumo/);
});

test('custo do kit fica no produto, para a margem do catálogo',()=>{
 const db=fixture();P.reconcile(db);assert.equal(db.products[2].cost,4.7);assert.equal(db.products[2].costSource,'kit');
 db.kits[0].items[0].product=999;const old=db.products[2].cost;P.reconcile(db);assert.equal(db.products[2].cost,old);
});

test('ficha do kit aceita só produtos e embalagens, não ingredientes',()=>{
 const db=fixture();
 assert.throws(()=>K.validate(db,{product:3,items:[{product:1,qty:2}],supplies:[{id:10,qty:5}]}),/Leite não é embalagem/);
 assert.doesNotThrow(()=>K.validate(db,{product:3,items:[{product:1,qty:2}],supplies:[{id:11,qty:1},{id:12,qty:1}]}));
 db.kits[0].supplies.push({id:10,qty:5});assert.throws(()=>K.assemble(db,db.kits[0],1),/não é embalagem/);
});
