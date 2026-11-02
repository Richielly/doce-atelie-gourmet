const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../smart-planner.js');

const db={
 products:[{id:1,name:'Brigadeiro',price:2,stock:10,active:true},{id:2,name:'Beijinho',price:150,priceBasis:'cento',stock:0,active:true},{id:3,name:'Bolo',price:80,stock:0,active:true}],
 pantry:[{id:10,name:'Leite condensado',unit:'g',qty:500},{id:11,name:'Coco',unit:'g',qty:0}],
 pantryLots:[{id:1,ingredientId:10,qty:395,expiry:'2026-11-05'},{id:2,ingredientId:11,qty:100,expiry:'2026-12-30'},{id:3,ingredientId:10,qty:50,expiry:'2026-10-01'}],
 recipes:[{product:1,yieldQty:20,ingredients:[{id:10,qty:395}]},{product:2,yieldQty:50,ingredients:[{id:10,qty:395},{id:11,qty:100}]}],
 orders:[{status:'Recebido',items:[{id:1,qty:30}]},{status:'Entregue',items:[{id:1,qty:500}]},{status:'Em preparo',items:[{id:2,qty:50}]}]
};
const cost=r=>r.product===1?30:60; // R$ por receita
const needs=(r,b)=>r.ingredients.map(x=>({item:db.pantry.find(i=>i.id===x.id),qty:x.qty*b}));

test('preço sugerido termina em ,90 e cobre a margem desejada',()=>{
 assert.equal(S.suggestPrice(1.5,.6),3.9);
 assert.ok((S.suggestPrice(1.5,.6)-1.5)/S.suggestPrice(1.5,.6)>=.6);
 assert.equal(S.suggestPrice(10,.5),20.9);
});

test('margem abaixo da meta aparece com preço sugerido, inclusive para cento',()=>{
 const rows=S.margins(db,cost,.6);
 const brig=rows.find(r=>r.product.id===1),beij=rows.find(r=>r.product.id===2);
 assert.equal(brig.cost,1.5);assert.equal(brig.below,true);assert.equal(brig.suggested,3.9);
 assert.equal(beij.price,1.5);assert.equal(beij.cost,1.2);assert.equal(beij.below,true);
 assert.equal(beij.suggested,390);
 assert.equal(rows.some(r=>r.product.id===3),false); // sem ficha técnica
});

test('lotes que vencem em 7 dias mostram as receitas que os usam; vencidos e distantes ficam fora',()=>{
 const rows=S.expiring(db,'2026-11-02');
 assert.equal(rows.length,1);assert.equal(rows[0].days,3);assert.deepEqual(rows[0].uses,['Brigadeiro','Beijinho']);
});

test('lista de compras considera só pedidos abertos e o estoque pronto',()=>{
 const rows=S.shopping(db,needs);
 // Brigadeiro: 30 pedidos - 10 prontos = 20 → 1 receita; Beijinho: 50 → 1 receita. Leite: 790 - 500 = 290.
 assert.deepEqual(rows.map(r=>[r.item.name,r.missing]),[['Leite condensado',290],['Coco',100]]);
 assert.match(S.listText('Doce Ateliê',rows),/Lista de compras · Doce Ateliê\n• Leite condensado: 290 g\n• Coco: 100 g/);
});
