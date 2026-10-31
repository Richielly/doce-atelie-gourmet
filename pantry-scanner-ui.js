/* Camera lifecycle and photo reader for the storekeeper. No persistence here. */
(()=>{
 'use strict';if(window.DOCE_MODE!=='admin')return;
 let stream=null,timer=null,generation=0,handler=null,torch=false,mode='idle';
 const status=text=>{const node=document.getElementById('pantryScanStatus');if(node)node.textContent=text;};
 function stop(){generation++;mode='idle';clearTimeout(timer);timer=null;if(stream)for(const track of stream.getTracks())track.stop();stream=null;const video=document.getElementById('pantryBarcodeVideo');if(video){video.srcObject=null;video.hidden=true;}torch=false;}
 function deliver(result,version){if(version!==generation||!result||!handler)return false;try{DocePantry.barcode(result.text);}catch{status('O código lido não é um código de produto válido. Tente outro enquadramento.');return false;}const callback=handler;stop();handler=null;try{callback(result.text);}catch(e){notify(e.message,'error');}return true;}
 const previousClose=closeModal;closeModal=function(){stop();handler=null;return previousClose();};document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='camera')stop();});
 function open(callback){
  stop();handler=callback;
  showModal('<section class="pantry-scan-panel"><h2>Ler código do produto</h2><p>Enquadre todas as barras, incluindo as margens brancas. Afaste um pouco a câmera se a embalagem estiver desfocada.</p><video hidden id="pantryBarcodeVideo" muted playsinline style="display:block;width:100%;max-height:300px;object-fit:contain;border-radius:14px;background:#241c22"></video><p id="pantryScanStatus" role="status" aria-live="polite">Ligue a câmera ou escolha uma foto da embalagem.</p><div class="stack"><button class="btn primary" onclick="startPantryCamera()">Ligar câmera</button><label class="field" hidden id="pantryCameraField">Câmera<select id="pantryCamera" onchange="startPantryCamera(this.value)"></select></label><button class="btn" id="pantryTorch" hidden onclick="togglePantryTorch()">Ligar luz</button><label class="field" id="pantryZoomField" hidden>Zoom<input type="range" id="pantryZoom" oninput="changePantryZoom(this.value)"></label><label class="field">Escolher foto do código<input id="pantryBarcodeFile" type="file" accept="image/*" onchange="readPantryBarcodePhoto(this)"></label><form class="stack" onsubmit="submitPantryBarcode(event)"><label class="field">Código do produto<input name="code" required maxlength="80" autocomplete="off" inputmode="text"></label><button class="btn">Usar código digitado</button></form><button class="btn" onclick="closeModal()">Voltar</button></div></section>');
 }
 async function configureCamera(track,version){
  const caps=track.getCapabilities?.()||{},settings=track.getSettings?.()||{};
  if(caps.focusMode?.includes('continuous'))try{await track.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch{/* Optional; unsupported focus must not stop scanning. */}
  if(version!==generation)return;
  document.getElementById('pantryTorch').hidden=!caps.torch;
  const zoom=document.getElementById('pantryZoom'),field=document.getElementById('pantryZoomField');field.hidden=!(caps.zoom?.max>caps.zoom?.min);
  if(!field.hidden){zoom.min=caps.zoom.min;zoom.max=Math.min(caps.zoom.max,Math.max(caps.zoom.min,4));zoom.step=caps.zoom.step||.1;zoom.value=settings.zoom||caps.zoom.min;}
  try{const cameras=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');if(version!==generation)return;const select=document.getElementById('pantryCamera');select.replaceChildren();cameras.forEach((camera,i)=>{const option=document.createElement('option');option.value=camera.deviceId;option.textContent=camera.label||'Câmera '+(i+1);option.selected=camera.deviceId===settings.deviceId;select.append(option);});document.getElementById('pantryCameraField').hidden=cameras.length<2;}catch{/* Camera selection is optional. */}
 }
 window.startPantryCamera=async function(deviceId){
  stop();mode='camera';const version=generation;status('Preparando leitor…');let phase='reader';
  try{
   const decode=await DoceProductScanner.ready();if(version!==generation)return;
   if(!navigator.mediaDevices?.getUserMedia)throw Error('A câmera precisa de um endereço HTTPS ou do aplicativo atualizado.');
   phase='camera';status('Abrindo câmera…');
   const videoConstraints={width:{ideal:1920},height:{ideal:1080},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}})};
   const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:videoConstraints});if(version!==generation){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
   const video=document.getElementById('pantryBarcodeVideo');video.hidden=false;video.srcObject=stream;await video.play();if(version!==generation)return;
   void configureCamera(stream.getVideoTracks()[0],version);
   status('Procurando código… Mantenha todas as barras visíveis e a imagem focada.');
   const canvas=document.createElement('canvas');
   const scan=async()=>{if(version!==generation)return;try{const result=await DoceProductScanner.frame(video,canvas,decode);if(deliver(result,version))return;}catch(e){if(version===generation)status('Não foi possível processar a imagem da câmera. Escolha outra câmera ou uma foto.');}if(version===generation)timer=setTimeout(scan,160);};
   void scan();
  }catch(e){if(version!==generation)return;stop();if(phase==='reader')status(e.message||'Falha ao preparar o leitor. Atualize o aplicativo.');else if(e.name==='NotAllowedError'||e.name==='SecurityError')status('Permita o acesso à câmera nas configurações do aplicativo ou navegador.');else if(e.name==='NotFoundError')status('Nenhuma câmera foi encontrada. Escolha uma foto ou digite o código.');else if(e.name==='NotReadableError')status('A câmera está indisponível ou em uso por outro aplicativo. Feche-o e tente novamente.');else status(e.message||'Não foi possível abrir a câmera. Tente novamente ou escolha uma foto.');}
 };
 window.readPantryBarcodePhoto=async function(input){
  const file=input.files[0];if(!file)return;stop();mode='photo';const version=generation;status('Analisando foto… Procurando códigos em diferentes posições e orientações.');
  try{const result=await DoceProductScanner.photo(file);if(version!==generation)return;if(!deliver(result,version))status('Não encontrei um código legível nesta foto. Fotografe de perto todas as barras e suas margens brancas, evitando brilho.');}catch(e){if(version===generation)status(e.message||'Não foi possível analisar essa imagem.');}finally{if(input.isConnected)input.value='';}
 };
 window.submitPantryBarcode=function(event){event.preventDefault();const text=String(new FormData(event.target).get('code')||'');if(!deliver({text},generation))status('Confira o código digitado.');};
 window.togglePantryTorch=async function(){const track=stream?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{torch:!torch}]});torch=!torch;document.getElementById('pantryTorch').textContent=torch?'Desligar luz':'Ligar luz';}catch{status('Esta câmera não permite controlar a luz.');}};
 window.changePantryZoom=async function(value){const track=stream?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{zoom:Number(value)}]});}catch{status('Esta câmera não permite ajustar o zoom.');}};
 const style=document.createElement('style');style.textContent='.pantry-scan-panel [hidden]{display:none!important}';document.head.append(style);window.DocePantryScanner={open};
})();
