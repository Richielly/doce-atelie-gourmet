const {test}=require('node:test');
const assert=require('node:assert/strict');
const stores=require('../shop-registry.js');
function storage(){const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
const a={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',api:'https://a.example',name:'Loja A'},b={id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',api:'https://a.example',name:'Loja B'};
test('QR novo informa API; formatos antigos e links continuam aceitos',()=>{
 assert.equal(new URL(stores.qr(a)).protocol,'https:');
 assert.equal(new URL(stores.qr(a)).pathname,'/app');
 assert.deepEqual(stores.parse(stores.qr(a),'https://wrong.example'),{api:a.api,id:a.id});
 assert.deepEqual(stores.parse('doceatelie://loja/'+a.id,a.api),{api:a.api,id:a.id});
 assert.deepEqual(stores.parse('https://a.example/app?loja='+a.id),{api:a.api,id:a.id});
 assert.throws(()=>stores.parse('javascript:alert(1)',a.api));
 assert.throws(()=>stores.parse('https://user:password@a.example/app?loja='+a.id));
 assert.throws(()=>stores.parse(a.id,'http://insecure.example'));
});
test('atualizar endereço remove entrada antiga sem copiar tokens para outro servidor',()=>{
 const registry=stores.create(storage()),updated={...a,api:'https://new.example'};
 registry.save(a);registry.save(b);registry.tracking(a,{token:'private-lookup'});
 registry.replaceAddress(a,updated);
 assert.equal(registry.list().length,2);assert.ok(registry.list().some(s=>s.api===updated.api));
 assert.equal(registry.tracking(updated),null);assert.equal(registry.tracking(a).token,'private-lookup');
 assert.throws(()=>registry.replaceAddress(updated,b));
});
test('duas lojas permanecem salvas após reabrir, sem duplicar leitura',()=>{
 const local=storage(),registry=stores.create(local);registry.save(a);registry.save(b);registry.save({...a,name:'A atualizado'});
 assert.equal(registry.list().length,2);assert.equal(stores.create(local).list()[0].name,'A atualizado');assert.equal(registry.active().id,a.id);
});
test('carrinhos e acompanhamento são separados por loja e por servidor',()=>{
 const registry=stores.create(storage()),otherServer={...a,api:'https://b.example'};
 registry.save(a);registry.cart(a,{productA:3});registry.tracking(a,{orderId:'order-A',token:'token-A'});
 registry.save(b);registry.cart(b,{productB:7});registry.save(otherServer);registry.cart(otherServer,{different:2});
 assert.deepEqual(registry.cart(a),{productA:3});assert.deepEqual(registry.cart(b),{productB:7});assert.deepEqual(registry.cart(otherServer),{different:2});
 assert.equal(registry.tracking(a).orderId,'order-A');assert.equal(registry.tracking(b),null);assert.equal(registry.tracking(otherServer),null);
});
test('a loja conectada antes da atualização é preservada ao adicionar outra',()=>{
 const local=storage();local.setItem('doce-shop-id',a.id);local.setItem('doce-api-url',a.api);
 const registry=stores.create(local);registry.migrateLegacy();registry.save(b);registry.migrateLegacy();
 assert.deepEqual(registry.list().map(s=>s.id),[a.id,b.id]);
});
test('identidade das lojas permanece separada e fotos grandes não esgotam localStorage',()=>{
 const local=storage(),registry=stores.create(local),huge='data:image/png;base64,'+'A'.repeat(1000000);
 registry.save({...a,branding:{bannerColor:'#aabbcc',icon:huge}});registry.save({...b,branding:{bannerColor:'#ddeeff'}});
 assert.equal(registry.list()[0].branding.icon,huge);assert.equal(registry.list()[1].branding.bannerColor,'#ddeeff');
 assert.ok(local.getItem('doce-saved-shops-v1').length<10000);
 registry.remove(b);assert.equal(registry.list().length,1);assert.equal(registry.list()[0].id,a.id);
});
