/* Guard local edits without publishing drafts or accepting duplicate actions. */
(()=>{
 function create({snapshot,choose,persist,close,onError=()=>{}}){
  let initial=snapshot(),busy=false;
  const dirty=()=>snapshot()!==initial;
  async function save({closeAfter=true}={}){
   if(busy)return false;busy=true;
   try{if(await persist()===false)return false;initial=snapshot();if(closeAfter)close();return true;}
   catch(error){onError(error);return false;}finally{busy=false;}
  }
  async function exit(){
   if(busy)return false;
   if(!dirty()){close();return true;}
   busy=true;let decision;
   try{decision=await choose();}catch(error){onError(error);return false;}finally{busy=false;}
   if(decision==='save')return save();
   if(decision==='discard'){close();return true;}
   return false;
  }
  return {dirty,save,exit,get busy(){return busy;}};
 }
 function chooseRecipeExit(){
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='recipe-exit-dialog';dialog.setAttribute('aria-labelledby','recipe-exit-title');
   dialog.innerHTML='<h2 id="recipe-exit-title">Salvar antes de sair?</h2><p>Você alterou a ficha técnica. Salvar guarda o rascunho neste aparelho; publicar na loja continua exigindo Enviar alterações.</p><div class="stack"><button type="button" class="btn primary" data-choice="save">Salvar e sair</button><button type="button" class="btn danger" data-choice="discard">Sair sem salvar</button><button type="button" class="btn" data-choice="continue">Continuar editando</button></div>';
   let done=false;const finish=choice=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(choice);};
   for(const b of dialog.querySelectorAll('[data-choice]'))b.onclick=()=>finish(b.dataset.choice);
   dialog.addEventListener('cancel',e=>{e.preventDefault();finish('continue');});
   document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-choice="continue"]').focus();
  });
 }
 window.DoceFormExit={create,chooseRecipeExit};
})();
