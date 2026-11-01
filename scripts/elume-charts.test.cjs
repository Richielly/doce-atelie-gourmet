const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../elume-charts.js');

test('gráficos sem dados mostram estado vazio em vez de barras falsas',()=>{
 assert.match(C.columns([{label:'a',value:0}]),/ec-empty/);
 assert.match(C.area([{label:'a',value:0},{label:'b',value:0}]),/ec-empty/);
 assert.match(C.donut([{label:'a',value:0}]),/ec-empty/);
 assert.match(C.ranking([]),/ec-empty/);
});

test('rosca repete cada valor e percentual na legenda',()=>{
 const html=C.donut([{label:'Entregue',value:3},{label:'Cancelado',value:1}],{format:v=>v+' pedidos'});
 assert.match(html,/Entregue<\/span><b>3 pedidos<small>75%/);
 assert.match(html,/Cancelado<\/span><b>1 pedidos<small>25%/);
});

test('texto vindo dos dados é escapado',()=>{
 const html=C.ranking([{label:'<img src=x onerror=alert(1)>',value:2}]);
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
 assert.ok(!C.columns([{label:'"><script>',value:1}]).includes('<script>'));
});

test('variação compara com o período anterior por seta e texto',()=>{
 assert.match(C.tile('Vendas','R$ 10',{current:150,previous:100}),/ec-delta up.*▲ \+50%/s);
 assert.match(C.tile('Faltas','2',{current:2,previous:4,lowerIsBetter:true}),/ec-delta up.*▼ -50%/s);
 assert.match(C.tile('Novos','3',{current:3,previous:0}),/Novo/);
 assert.ok(!C.tile('Sem base','—').includes('ec-delta'));
});

test('medidor sem base não inventa percentual',()=>{
 assert.match(C.gauge(null),/Sem base/);
 assert.match(C.gauge(62.5),/62,5%|63%/);
});

test('agrupa registros por dia terminando hoje',()=>{
 const today=new Date(),yesterday=new Date(Date.now()-864e5);
 const rows=C.daily([{at:today,v:2},{at:today,v:3},{at:yesterday,v:1},{at:new Date('2001-01-01'),v:9}],7,r=>r.at,r=>r.v);
 assert.equal(rows.length,7);assert.equal(rows[6].value,5);assert.equal(rows[5].value,1);
 assert.equal(rows.reduce((s,r)=>s+r.value,0),6);
});

test('rosca agrupa categorias além da paleta em Outros',()=>{
 const html=C.donut(['a','b','c','d','e','f'].map((label,i)=>({label,value:6-i})));
 assert.ok(html.includes('Outros</span><b>6'));assert.equal((html.match(/<li>/g)||[]).length,4);
});
