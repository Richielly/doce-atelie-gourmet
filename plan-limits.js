/* Plan limits of the shop administration (servidor 0.20.0+). The server refuses growth beyond
   the plan; this module only shows usage and padlocks so the shop sees why before sending.
   A feature can be without limit, limited or not included (limit 0 or flag false, servidor 0.22.0+).
   Without a plan (older server or no session) nothing is limited here. Customers never use it. */
(function(root){
 'use strict';
 let plan=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const LOCK='<svg class="plan-lock-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
 const NOUNS={products:['produto','produtos'],recipes:['ficha técnica','fichas técnicas'],pantry_items:['ingrediente','ingredientes'],services:['serviço','serviços'],professionals:['profissional','profissionais'],campaigns_per_month:['campanha neste mês','campanhas neste mês']};
 function set(value){plan=value&&Array.isArray(value.features)?value:null;}
 function get(){return plan;}
 function feature(key){return plan?.features.find(f=>f.key===key)||null;}
 // null = no limit known on this device.
 function limit(key){const f=feature(key);return f&&f.kind==='limit'&&f.value!==null?f.value:null;}
 function included(key){const f=feature(key);return !f||(f.included!==false&&f.value!==false&&f.value!==0);}
 function reached(key,count){const max=limit(key);return max!==null&&count>=max;}
 function noun(key,count){const n=NOUNS[key]||[key,key];return count===1?n[0]:n[1];}
 function usage(key,count){
  const max=limit(key);if(max===null)return '';
  if(max===0)return '<p class="plan-usage plan-usage-full" role="status">'+LOCK+'<span>Não incluído no plano '+esc(plan.plan)+'</span></p>';
  const text=count+' de '+max+' '+noun(key,max)+' no plano '+plan.plan;
  return '<p class="plan-usage'+(count>=max?' plan-usage-full':'')+'" role="status">'+(count>=max?LOCK:'')+'<span>'+esc(text)+(count>=max?' · disponível em planos maiores':'')+'</span></p>';
 }
 function message(key,count){
  if(limit(key)===0)return 'Isto não faz parte do plano '+plan.plan+'. O que já existe continua e pode ser editado. Para cadastrar, fale com o Elume Shop sobre um plano que inclua.';
  return 'Você já usa '+count+' de '+limit(key)+' '+noun(key,limit(key))+' no plano '+plan.plan+'. O que já existe continua e pode ser editado. Para cadastrar mais, fale com o Elume Shop sobre um plano maior.';
 }
 function dialog(title,text){
  const d=document.createElement('dialog');d.className='plan-dialog';
  d.innerHTML='<h2>'+LOCK+'<span>'+esc(title)+'</span></h2><p>'+esc(text)+'</p><button type="button" class="btn primary full">Entendi</button>';
  d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove(),{once:true});
  document.body.append(d);d.showModal();
 }
 // True when the new record may be started; otherwise explains the limit.
 function allow(key,count){
  if(!reached(key,count))return true;
  dialog('Limite do plano '+plan.plan,message(key,count));return false;
 }
 // Puts a padlock inside the button that creates records when full, and the usage line after
 // the first `after` text that follows the button (its header) or before `before`.
 function decorate(html,key,count,marker,place={}){
  const at=html.indexOf(marker);if(at<0||limit(key)===null)return html;
  const end=html.indexOf('</button>',at)+'</button>'.length,start=html.lastIndexOf('<button',at);
  let button=html.slice(start,end);
  if(reached(key,count))button=button.replace(/>/,' data-plan-locked="true">'+LOCK);
  html=html.slice(0,start)+button+html.slice(end);
  const shift=button.length-(end-start);
  let note=end+shift;
  if(place.after){const i=html.indexOf(place.after,note);if(i>=0)note=i+place.after.length;}
  else if(place.before){const i=html.lastIndexOf(place.before,start);if(i>=0)note=i;}
  return html.slice(0,note)+usage(key,count)+html.slice(note);
 }
 function lockedPanel(title,items){
  return '<section class="panel plan-locked-panel"><h2>'+LOCK+'<span>'+esc(title)+'</span></h2><p>Não incluído no seu plano atual: <strong>'+esc(plan?.plan||'')+'</strong>.</p><ul>'+items.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul><p class="muted tiny">Pedidos, agenda e alertas continuam funcionando normalmente.</p></section>';
 }
 const api={set,get,limit,included,reached,usage,message,allow,decorate,lockedPanel};
 if(typeof module!=='undefined')module.exports=api;if(root)root.ElumePlan=api;

 // Confectionery administration (index.html): global page functions are wrapped once loaded.
 if(!root||typeof root.adminProducts!=='function')return;
 const count={products:()=>db.products.length,recipes:()=>(db.recipes||[]).length,pantry_items:()=>(db.pantry||[]).length};
 const guard=(name,key)=>{const original=root[name];root[name]=function(id){if(!id&&admin&&!allow(key,count[key]()))return;return original.apply(this,arguments);};};
 guard('editProduct','products');guard('editRecipe','recipes');guard('editIngredient','pantry_items');
 // A scanned code that is not registered yet also creates an ingredient.
 for(const name of ['saveIngredient','createPantryFromCode']){const original=root[name];if(typeof original!=='function')continue;root[name]=function(event,id){if(!id&&!allow('pantry_items',count.pantry_items())){event.preventDefault();return;}return original.apply(this,arguments);};}
 const originalProducts=adminProducts;root.adminProducts=function(){return decorate(originalProducts(),'products',count.products(),'onclick="editProduct()"',{after:'</div>'});};
 const LOCKED={
  pantry:()=>lockedPanel('Despensa',['Ingredientes, lotes e validades','Leitura de código de barras','Alertas de reposição']),
  planner:()=>lockedPanel('Produção e fichas técnicas',['Fichas técnicas com custo por produto','Plano de produção pelos pedidos','Registro do que foi produzido']),
  bonuses:()=>lockedPanel('Benefícios e indicação',['Cartão de fidelidade e prêmios','Indicação de clientes','Os clientes mantêm o que já ganharam'])};
 const originalPantry=adminPantry;root.adminPantry=function(){if(!included('pantry_items'))return LOCKED.pantry();return decorate(originalPantry(),'pantry_items',count.pantry_items(),'onclick="editIngredient()"',{before:'<div class="pantry-actions"'});};
 const originalPlanner=adminPlanner;root.adminPlanner=function(){if(!included('recipes'))return LOCKED.planner();return decorate(originalPlanner(),'recipes',count.recipes(),'onclick="editRecipe()"',{after:'</div>'});};
 const originalBonuses=adminBonuses;root.adminBonuses=function(){return included('bonuses')?originalBonuses():LOCKED.bonuses();};
 const originalMenu=adminMenu;root.adminMenu=function(){let html=originalMenu();for(const[page,key]of[['pantry','pantry_items'],['planner','recipes'],['bonuses','bonuses'],['campaigns','campaigns']])if(!included(key))html=html.replace("tab='"+page+"';render()\"><span class=\"admin-menu-icon\">","tab='"+page+"';render()\" data-plan-locked=\"true\"><span class=\"admin-menu-icon\">");return html;};
 const originalDashboard=adminDashboard;root.adminDashboard=function(){
  const html=originalDashboard();if(included('management'))return html;
  // Operational blocks stay; indicators, charts and margins belong to the management plans.
  const box=document.createElement('div');box.innerHTML=html;
  const kept=[...box.querySelectorAll('.business-panel')].filter(p=>/Alertas e atenção|Últimos pedidos/.test(p.querySelector('h3')?.textContent||''));
  return '<div class="section"><h2>Gestão do negócio</h2></div>'+kept.map(p=>p.outerHTML).join('')+lockedPanel('Painéis gerenciais',['Vendas, entregas, lucro bruto e ticket médio','Vendas por dia e saúde das vendas','Produtos que mais vendem e margens','Custos de produção e preços sugeridos']);
 };
})(typeof window!=='undefined'?window:null);
