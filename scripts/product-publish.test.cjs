const {test}=require('node:test'),assert=require('node:assert/strict');
const {merge}=require('../product-publish.js');
test('publicação mantém produtos, pedidos e configurações existentes',()=>{
 const original={products:[{id:4,apiId:'server-id',name:'Existente',price:8,stock:2}],orders:[{id:'keep'}],settings:{name:'Loja destino'},branding:{color:'pink'},nextId:8};
 const result=merge([{id:1,apiId:'id-from-other-shop',name:'Novo',price:5,stock:10},{id:4,name:'Existente',price:999,stock:999}],{data:original},{});
 assert.equal(result.added,1);assert.equal(result.skipped,1);assert.equal(result.data.products[0].price,8);assert.equal(result.data.products[1].id,8);assert.equal(result.data.products[1].apiId,undefined);
 assert.deepEqual(result.data.orders,original.orders);assert.equal(original.products.length,1);assert.equal(result.data.settings.name,'Loja destino');
});
test('primeira publicação preserva produtos ocultos que já estavam na API',()=>{
 const result=merge([{name:'Local',price:3,stock:5}],{data:null},{shop:{name:'Destino',branding:{}},products:[{id:'hidden',name:'Oculto',price_cents:1000,stock:7,min_qty:1,increment:1,enabled:false}]});
 assert.equal(result.data.products[0].apiId,'hidden');assert.equal(result.data.products[0].active,false);assert.equal(result.added,1);
 const repeat=merge([{name:'Local',price:3,stock:5}],{data:result.data},{});assert.equal(repeat.added,0);
 assert.throws(()=>merge([{name:'Inválido',price:-1,stock:0}],{data:result.data},{}));
});
