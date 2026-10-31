const {test}=require('node:test'),assert=require('node:assert/strict');
const generate=require('qrcode-generator'),decode=require('jsqr'),stores=require('../shop-registry.js');
test('QR gerado pelo lojista é decodificado pelo mesmo leitor da câmera, com servidor e loja corretos',()=>{
 const store={api:'https://loja.exemplo.com.br',id:'12345678-1234-1234-1234-123456789012'},content=stores.qr(store),qr=generate(0,'M');qr.addData(content);qr.make();
 const size=qr.getModuleCount(),scale=8,padding=4,width=(size+padding*2)*scale,pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(qr.isDark(y,x))for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const p=((y+padding)*scale+dy)*width*4+((x+padding)*scale+dx)*4;pixels[p]=pixels[p+1]=pixels[p+2]=0;}
 const result=decode(pixels,width,width);assert.ok(result);assert.equal(result.data,content);assert.deepEqual(stores.parse(result.data),{api:store.api,id:store.id});assert.match(qr.createDataURL(8,32),/^data:image\/gif;base64,/);
});
