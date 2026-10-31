(function(root){
 'use strict';
 function merge(local,workspace,catalog){
  if(!Array.isArray(local))throw Error('Backup sem lista de produtos.');
  const data=workspace.data?JSON.parse(JSON.stringify(workspace.data)):{products:catalog.products.map((p,i)=>({id:i+1,apiId:p.id,name:p.name,price:p.price_cents/100,stock:p.stock,minQty:p.min_qty,qtyStep:p.increment,image:p.photo_url||'',active:p.enabled})),orders:[],settings:{name:catalog.shop.name},branding:catalog.shop.branding||{},nextId:1};
  const names=new Set(data.products.map(p=>String(p.name).trim().toLowerCase()));
  const ids=new Set(data.products.map(p=>p.apiId).filter(Boolean));
  let next=data.products.reduce((n,p)=>Math.max(n,p.id+1),Math.max(1,data.nextId)),added=0,skipped=0;
  for(const product of local){
   const name=String(product.name||'').trim();
   if(ids.has(product.apiId)||names.has(name.toLowerCase())){skipped++;continue;}
   const price=Number(product.price),stock=Number(product.stock??0),minQty=Number(product.minQty??1),qtyStep=Number(product.qtyStep??1);
   if(!name||name.length>160||!Number.isFinite(price)||price<0||!Number.isInteger(stock)||stock<0||!Number.isInteger(minQty)||minQty<1||!Number.isInteger(qtyStep)||qtyStep<1)throw Error('Confira nome, preço, estoque e quantidade do produto '+(name||'(sem nome)')+'.');
   const item={...product,id:next++,name,price,stock,minQty,qtyStep,active:product.active!==false};
   delete item.apiId;
   data.products.push(item);names.add(name.toLowerCase());added++;
  }
  data.nextId=next;return {data,added,skipped};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={merge};
 if(root)root.DocePublish={merge};
})(typeof window!=='undefined'?window:null);
