(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 function blank(shop={name:'Minha loja',branding:{}},products=[]){return {products:copy(products),orders:[],settings:{name:shop.name,whatsapp:'',deliveryFee:0,minimum:0,color:'#a84e6e',pixKey:'',pixName:''},nextId:products.reduce((n,p)=>Math.max(n,p.id+1),1),pantry:[],pantryEntries:[],pantryLots:[],pantryMovements:[],recipes:[],production:[],kits:[],kitPlans:[],kitAssemblies:[],allocations:[],loyalty:{enabled:true,threshold:100,stamps:10,prize:'Prêmio da loja',validDays:30,rules:'Consulte as regras desta loja.'},quotes:[],booking:{dates:[],capacity:5,leadDays:1},branding:{headerSubtitle:'',bannerTitle:shop.name,bannerSubtitle:'Conheça os produtos da loja',bannerTag:'',bannerEmoji:'🛍️',bannerColor:'#a84e6e',bannerTextColor:'#ffffff',backgroundColor:'#fff9f6',logo:'',icon:'',slides:[],carouselSeconds:5,...copy(shop.branding||{})},loyaltyAccounts:{},loyaltyVouchers:[]};}
 function key(store){return JSON.stringify([store.api.replace(/\/+$/,''),store.id]);}
 function create(storage){return {load(store){try{return JSON.parse(storage.getItem('doce-admin-draft-v2:'+key(store))||'null');}catch{return null;}},save(store,draft){storage.setItem('doce-admin-draft-v2:'+key(store),JSON.stringify(draft));},clear(store){storage.removeItem('doce-admin-draft-v2:'+key(store));}};}
 const api={blank,key,create};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.DoceTenants=api;
})(typeof window!=='undefined'?window:null);
