/* Pix "copia e cola" (BR Code / EMV) built on the device from the shop's own key.
   No payment provider: the customer pays in the bank app and the shop confirms receipt. */
(function(root){
 'use strict';
 const field=(id,value)=>id+String(value.length).padStart(2,'0')+value;
 const plain=(text,max)=>String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9 .,&-]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
 function crc16(payload){
  let crc=0xFFFF;
  for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=crc&0x8000?((crc<<1)^0x1021)&0xFFFF:(crc<<1)&0xFFFF;}
  return crc.toString(16).toUpperCase().padStart(4,'0');
 }
 // CPF/CNPJ go as digits, phones need +55, e-mails and random keys stay as typed.
 function key(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(/^[\d.\-/]+$/.test(raw)){const d=raw.replace(/\D/g,'');if(d.length===11||d.length===14)return d;}
  if(/^\+?[\d\s()-]+$/.test(raw)){const d=raw.replace(/\D/g,'');if(d.length>=12&&d.startsWith('55'))return '+'+d;if(d.length===10||d.length===11)return '+55'+d;}
  return raw.includes('@')?raw.toLowerCase():raw;
 }
 function payload({pixKey,name,city,amount=0,txid='***'}){
  const k=key(pixKey);
  if(!k||k.length>77)throw Error('Chave Pix da loja inválida.');
  const merchant=plain(name,25)||'RECEBEDOR',place=plain(city,15)||'BRASIL',reference=plain(txid,25).replace(/[^A-Za-z0-9]/g,'')||'***';
  let body=field('00','01')+field('26',field('00','br.gov.bcb.pix')+field('01',k))+field('52','0000')+field('53','986');
  if(Number(amount)>0)body+=field('54',Number(amount).toFixed(2));
  body+=field('58','BR')+field('59',merchant)+field('60',place)+field('62',field('05',reference))+'6304';
  return body+crc16(body);
 }
 const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // HTML block for an amount; empty when the shop has no Pix key.
 function block(settings,amount,reference){
  if(!settings?.pixKey)return '';
  let code;try{code=payload({pixKey:settings.pixKey,name:settings.pixName||settings.name,city:settings.pixCity,amount,txid:reference});}catch{return '';}
  let image='';
  if(typeof root?.qrcode==='function'){try{const qr=root.qrcode(0,'M');qr.addData(code);qr.make();image='<img class="pix-qr" width="180" height="180" alt="QR Code Pix para pagar '+escape(Number(amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))+'" src="'+qr.createDataURL(6,12)+'">';}catch{}}
  return '<div class="pix-box"><b>Pague com Pix</b>'+image+'<label class="field">Pix copia e cola<textarea readonly rows="3" onclick="this.select()">'+escape(code)+'</textarea></label>'+
   '<button type="button" class="btn" onclick="ElumePix.copy(this)">Copiar código Pix</button>'+
   '<p class="muted tiny">Recebedor: '+escape(plain(settings.pixName||settings.name,25)||'Loja')+'. Confira o nome no app do banco. A loja confirma o recebimento.</p></div>';
 }
 async function copy(button){
  const text=button.closest('.pix-box')?.querySelector('textarea')?.value||'';
  try{await navigator.clipboard.writeText(text);button.textContent='Código copiado';}
  catch{const area=button.closest('.pix-box').querySelector('textarea');area.select();button.textContent='Selecione e copie o código';}
 }
 const api={payload,crc16,key,block,copy};
 if(typeof module!=='undefined')module.exports=api;if(root)root.ElumePix=api;
})(typeof window!=='undefined'?window:null);
