const {test}=require('node:test'),assert=require('node:assert/strict');
const {create,blank}=require('../tenant-state.js');
function memory(){const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
test('rascunhos administrativos não interferem em outra loja nem outro servidor',()=>{
 const storage=memory(),drafts=create(storage),a={api:'https://one.example',id:'A'},b={api:'https://one.example',id:'B'},other={api:'https://two.example',id:'A'};
 drafts.save(a,{revision:7,data:{settings:{name:'Rascunho A'}},dirty:true,operations:[{id:'orderA',kind:'order_status'}]});
 drafts.save(b,{revision:2,data:{settings:{name:'Rascunho B'}},dirty:true,operations:[]});
 assert.equal(drafts.load(a).revision,7);assert.equal(drafts.load(b).data.settings.name,'Rascunho B');assert.equal(drafts.load(other),null);
 drafts.clear(b);assert.equal(drafts.load(b),null);assert.equal(drafts.load(a).operations[0].id,'orderA');
});
test('loja nova começa sem produtos demonstrativos ou dados de outro cliente',()=>{
 const a=blank({name:'A',branding:{bannerColor:'#123456'}}),b=blank({name:'B',branding:{bannerColor:'#abcdef'}});
 a.products.push({id:1});a.loyaltyAccounts.private={phone:'one'};assert.deepEqual(b.products,[]);assert.deepEqual(b.loyaltyAccounts,{});assert.equal(b.settings.name,'B');assert.equal(b.branding.bannerColor,'#abcdef');
});
