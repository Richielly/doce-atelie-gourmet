const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../pix.js'),decode=require('jsqr'),generate=require('qrcode-generator');

test('reproduz o exemplo oficial do Manual de Padrões do BR Code',()=>{
 assert.equal(P.payload({pixKey:'123e4567-e12b-12d1-a456-426655440000',name:'Fulano de Tal',city:'BRASILIA'}),
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');
});

test('inclui valor, limita nome e cidade e remove acentos',()=>{
 const code=P.payload({pixKey:'loja@exemplo.com',name:'Doçaria da Conceição e Companhia Limitada',city:'São José dos Campos',amount:42.5,txid:'pedido-1a2b'});
 assert.match(code,/540542\.50/);
 assert.match(code,/5925Docaria da Conceicao e Co/);
 assert.match(code,/6015Sao Jose dos Ca/);
 assert.match(code,/0510pedido1a2b/);
 assert.equal(code.slice(-4),P.crc16(code.slice(0,-4)));
});

test('normaliza chaves de telefone, CPF, CNPJ e e-mail',()=>{
 assert.equal(P.key('(11) 98765-4321'),'+5511987654321');
 assert.equal(P.key('+55 11 98765-4321'),'+5511987654321');
 assert.equal(P.key('123.456.789-09'),'12345678909');
 assert.equal(P.key('12.345.678/0001-90'),'12345678000190');
 assert.equal(P.key('Loja@Exemplo.com'),'loja@exemplo.com');
 assert.throws(()=>P.payload({pixKey:''}),/Chave Pix/);
});

test('o QR gerado é lido de volta com o mesmo código',()=>{
 const code=P.payload({pixKey:'+5511987654321',name:'Salão Bela',city:'Campinas',amount:80});
 const qr=generate(0,'M');qr.addData(code);qr.make();
 const size=qr.getModuleCount()+8,scale=4,width=size*scale,data=new Uint8ClampedArray(width*width*4);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){const mx=Math.floor(x/scale)-4,my=Math.floor(y/scale)-4,dark=mx>=0&&my>=0&&mx<size-8&&my<size-8&&qr.isDark(my,mx),i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=dark?0:255;data[i+3]=255;}
 assert.equal(decode(data,width,width).data,code);
});

test('bloco sem chave Pix não aparece',()=>{assert.equal(P.block({pixKey:''},10),'');assert.match(P.block({pixKey:'a@b.com',name:'Loja'},10),/Copiar código Pix/);});
