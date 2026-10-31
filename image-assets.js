/* Snapshot gallery files once; reuse the prepared image for preview and save. */
(function(root){
 'use strict';
 const MAX_INPUT=25*1024*1024,MAX_OUTPUT=1024*1024;
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function imageType(bytes){const b=new Uint8Array(bytes);if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';if(/^GIF8[79]a/.test(String.fromCharCode(...b.slice(0,6))))return 'image/gif';return null;}
 function readOnce(file){if(typeof file.arrayBuffer==='function')return file.arrayBuffer();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||Object.assign(Error('Arquivo temporariamente indisponível.'),{name:'NotReadableError'}));reader.onabort=()=>reject(Object.assign(Error('Leitura interrompida.'),{name:'AbortError'}));reader.readAsArrayBuffer(file);});}
 async function readBytes(file,{read=readOnce,wait=sleep,onProgress=()=>{}}={}){
  if(!file)throw Error('Selecione uma imagem.');if(file.size>MAX_INPUT)throw Error('A imagem excede 25 MB. Escolha uma foto menor.');
  for(let attempt=0;attempt<4;attempt++){
   try{const buffer=await read(file);if(!buffer?.byteLength||(file.size>0&&buffer.byteLength!==file.size))throw Object.assign(Error('A galeria ainda não disponibilizou a foto completa.'),{name:'NotReadableError'});if(buffer.byteLength>MAX_INPUT)throw Error('A imagem excede 25 MB.');const type=imageType(buffer);if(!type)throw Error('O arquivo não é uma imagem JPG, PNG, WebP ou GIF válida.');return {buffer,type};}
   catch(e){const temporary=['NotReadableError','AbortError','NotFoundError','UnknownError'].includes(e?.name)||e instanceof TypeError;if(!temporary||attempt===3){if(temporary)throw Error('Não foi possível acessar a foto da galeria. Baixe a imagem no aparelho e escolha novamente.');throw e;}onProgress('Aguardando a galeria disponibilizar a imagem…');await wait([180,450,900][attempt]);}
  }
 }
 function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível preparar a imagem.'));reader.readAsDataURL(blob);});}
 async function decode(blob){
  if(typeof createImageBitmap==='function')try{const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});if(bitmap.width&&bitmap.height)return {image:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()};bitmap.close();}catch{/* Use an independent image decoder with the same stable bytes. */}
  const url=URL.createObjectURL(blob),image=new Image();try{await new Promise((resolve,reject)=>{image.onload=()=>image.naturalWidth>0?resolve():reject(Error('A imagem não possui dimensões válidas.'));image.onerror=()=>reject(Error('Não foi possível abrir a imagem. Escolha uma foto JPG, PNG ou WebP válida.'));image.src=url;});return {image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(url)};}catch(e){URL.revokeObjectURL(url);throw e;}
 }
 function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>{canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível otimizar a imagem.')),type,quality);});}
 async function prepare(file,{maxSide=1600,maxBytes=MAX_OUTPUT,onProgress=()=>{}}={}){
  onProgress('Carregando imagem…');const {buffer,type}=await readBytes(file,{onProgress}),source=new Blob([buffer],{type}),bitmap=await decode(source);
  try{
   if(bitmap.width*bitmap.height>80*1000*1000)throw Error('A resolução da imagem é muito alta. Escolha uma versão menor.');
   if(type!=='image/gif'&&source.size<=maxBytes&&Math.max(bitmap.width,bitmap.height)<=maxSide)return {src:await dataUrl(source),bytes:source.size,width:bitmap.width,height:bitmap.height,type};
   onProgress('Ajustando a imagem para o aplicativo…');let side=Math.min(maxSide,Math.max(bitmap.width,bitmap.height));
   for(let attempt=0;attempt<5;attempt++){
    const ratio=Math.min(1,side/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a prévia da imagem.');ctx.drawImage(bitmap.image,0,0,canvas.width,canvas.height);
    for(const quality of [.92,.8,.65]){const result=await canvasBlob(canvas,type==='image/jpeg'?'image/jpeg':'image/webp',quality);if(result.size<=maxBytes)return {src:await dataUrl(result),bytes:result.size,width:canvas.width,height:canvas.height,type:result.type};}
    side=Math.max(128,Math.floor(side*.72));
   }
   throw Error('Não foi possível reduzir a imagem para o limite do aplicativo. Escolha uma foto menor.');
  }finally{bitmap.close();}
 }
 function createManager(process=prepare){
  const records=new WeakMap(),cache=new WeakMap();
  function select(input,file,options={}){
   let versions=cache.get(file);if(!versions){versions=new Map();cache.set(file,versions);}const key=JSON.stringify([options.maxSide||1600,options.maxBytes||MAX_OUTPUT]);let promise=versions.get(key);
   if(!promise){promise=Promise.resolve().then(()=>process(file,options));versions.set(key,promise);promise.catch(()=>{if(versions.get(key)===promise)versions.delete(key);});}
   const record={file,promise};records.set(input,record);return record;
  }
  async function value(input){if(!input)return null;while(true){const record=records.get(input);if(!record)return null;try{const result=await record.promise;if(records.get(input)===record)return result;}catch(e){if(records.get(input)===record)throw e;}}}
  return {select,value,record:input=>input?records.get(input):undefined,current:(input,record)=>records.get(input)===record,has:input=>!!input&&records.has(input),clear:input=>records.delete(input)};
 }
 const api={MAX_INPUT,MAX_OUTPUT,imageType,readBytes,prepare,createManager};if(typeof module!=='undefined')module.exports=api;if(root)root.DoceImages=api;
})(typeof window!=='undefined'?window:null);
