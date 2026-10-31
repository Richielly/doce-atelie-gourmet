const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const engine=require('zxing-wasm/reader'),{createDecoder}=require('../product-scanner.js'),{image,png}=require('./barcode-fixture.cjs');
const {MultiFormatOneDReader,BinaryBitmap,HybridBinarizer,RGBLuminanceSource}=require('@zxing/library');
let decode;
before(async()=>{await engine.prepareZXingModule({overrides:{wasmBinary:fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'))},fireImmediately:true});decode=createDecoder(engine);});
function oldRead(input){const gray=Uint8ClampedArray.from({length:input.width*input.height},(_,i)=>input.data[i*4]);return new MultiFormatOneDReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,input.width,input.height)))).getText();}
test('reproduz falha anterior com código vertical; novo caminho usado por câmera/foto lê o mesmo código',async()=>{assert.equal(oldRead(image()),'5901234123457');const rotated=image({angle:90});assert.throws(()=>oldRead(rotated));assert.equal((await decode(rotated)).text,'5901234123457');});
for(const [name,config]of [['girado 45 graus',{angle:45}],['de cabeça para baixo',{angle:180}],['pequeno e fora do centro',{scale:2,frameWidth:1400,frameHeight:900,x:30,y:5}],['contraste reduzido',{angle:12,dark:75,light:160}]])test('lê código '+name,async()=>{assert.equal((await decode(image(config)))?.text,'5901234123457');});
test('lê arquivo de galeria PNG girado, não apenas ImageData sintético',async()=>{const file=new Blob([png(image({angle:90}))],{type:'image/png'});assert.equal((await decode(file))?.text,'5901234123457');});
test('imagem sem código não retorna identificação falsa',async()=>{const blank={width:300,height:200,data:new Uint8ClampedArray(300*200*4).fill(255)};assert.equal(await decode(blank),null);});
