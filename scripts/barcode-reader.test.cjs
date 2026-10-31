const {test}=require('node:test'),assert=require('node:assert/strict');
const {MultiFormatOneDReader,BinaryBitmap,HybridBinarizer,RGBLuminanceSource}=require('@zxing/library');
test('leitor ZXing usado na câmera decodifica uma embalagem EAN-13',()=>{
 const code='5901234123457',left=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'],parity=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
 const invert=s=>s.replace(/[01]/g,c=>c==='0'?'1':'0');let bars='101';
 for(let i=1;i<7;i++)bars+=parity[code[0]][i-1]==='L'?left[code[i]]:invert(left[code[i]]).split('').reverse().join('');
 bars+='01010';for(let i=7;i<13;i++)bars+=invert(left[code[i]]);bars+='101';
 const width=(bars.length+24)*3,height=140,pixels=new Uint8ClampedArray(width*height).fill(255);
 for(let x=0;x<bars.length;x++)if(bars[x]==='1')for(let dx=0;dx<3;dx++)for(let y=8;y<132;y++)pixels[y*width+(x+12)*3+dx]=0;
 const reader=new MultiFormatOneDReader(new Map());const result=reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,width,height))),new Map());assert.equal(result.getText(),code);
});
