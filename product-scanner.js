/* Local ZXing-C++ decoder. Camera and photos use the same tested decoding path. */
(function(root){
 'use strict';
 const options=Object.freeze({formats:['AllLinear'],tryHarder:true,tryRotate:true,tryInvert:true,tryDownscale:true,maxNumberOfSymbols:1,minLineCount:2,returnErrors:false});
 function rotatePixels(input){
  const sine=Math.SQRT1_2,cosine=Math.SQRT1_2,width=Math.ceil((input.width+input.height)*cosine),height=width,data=new Uint8ClampedArray(width*height*4).fill(255);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dx=x-width/2,dy=y-height/2,sx=Math.floor(cosine*dx+sine*dy+input.width/2),sy=Math.floor(-sine*dx+cosine*dy+input.height/2);if(sx>=0&&sx<input.width&&sy>=0&&sy<input.height){const from=(sy*input.width+sx)*4,to=(y*width+x)*4;data[to]=input.data[from];data[to+1]=input.data[from+1];data[to+2]=input.data[from+2];data[to+3]=255;}}
  return {width,height,data};
 }
 function createDecoder(engine){return async function(input){
  const scan=async source=>{const results=await engine.readBarcodes(source,{...options,formats:[...options.formats]});const result=results.find(r=>r.isValid&&r.text);return result?{text:result.text,format:result.format}:null;};
  const first=await scan(input);if(first)return first;
  // The native orientation search handles quarter turns. Also search diagonal packaging.
  return input?.data&&input.width&&input.height?scan(rotatePixels(input)):null;
 };}
 let opening;
 async function ready(){
  if(!opening)opening=(async()=>{
   if(!root.ZXingWASM)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('barcode-reader.js?v='+(root.DOCE_BUILD?.code||'dev'),document.baseURI).href;script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar o leitor. Feche e abra esta tela novamente.'));document.head.append(script);});
   if(!root.ZXingWASM?.prepareZXingModule)throw Error('Leitor indisponível. Atualize o aplicativo.');
   const url=new URL('barcode-engine.wasm?v='+(root.DOCE_BUILD?.code||'dev'),document.baseURI),response=await fetch(url);
   if(!response.ok)throw Error('Arquivo do leitor indisponível. Atualize o aplicativo.');
   const wasmBinary=new Uint8Array(await response.arrayBuffer());
   await root.ZXingWASM.prepareZXingModule({overrides:{wasmBinary},fireImmediately:true});
   return createDecoder(root.ZXingWASM);
  })().catch(e=>{opening=null;throw e;});
  return opening;
 }
 function canvasFor(source,rect,maxSide=2400){
  const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
  if(!width||!height)throw Error('A imagem ainda não está pronta.');
  const box=rect||{x:0,y:0,width,height},scale=Math.min(1,maxSide/Math.max(box.width,box.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(box.width*scale));canvas.height=Math.max(1,Math.round(box.height*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,box.x,box.y,box.width,box.height,0,0,canvas.width,canvas.height);return {canvas,ctx};
 }
 async function frame(video,canvas,decode){
  if(video.readyState<2||!video.videoWidth)return null;
  const scale=Math.min(1,1920/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);return decode(ctx.getImageData(0,0,canvas.width,canvas.height));
 }
 async function photo(file){
  if(!file||file.size===0)throw Error('Selecione uma imagem.');if(file.size>25*1024*1024)throw Error('A foto excede 25 MB. Escolha uma foto menor.');
  const decode=await ready();
  // Native decoding preserves the full resolution of photographs, including small codes.
  try{const result=await decode(file);if(result)return result;}catch{/* Browser-supported formats can still be decoded via canvas below. */}
  const url=URL.createObjectURL(file),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Não foi possível abrir essa imagem. Use uma foto JPG, PNG ou WebP.'));image.src=url;});
   const w=image.naturalWidth,h=image.naturalHeight;
   for(const box of [null,{x:w*.1,y:h*.1,width:w*.8,height:h*.8},{x:w*.2,y:h*.2,width:w*.6,height:h*.6}]){const {canvas,ctx}=canvasFor(image,box),result=await decode(ctx.getImageData(0,0,canvas.width,canvas.height));if(result)return result;}
   return null;
  }finally{URL.revokeObjectURL(url);}
 }
 const api={options,createDecoder,ready,frame,photo};if(typeof module!=='undefined')module.exports=api;if(root)root.DoceProductScanner=api;
})(typeof window!=='undefined'?window:null);
