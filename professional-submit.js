/* Explicit confirmation is the only trigger; never retries on load or reconnect. */
(()=>{
 'use strict';
 window.ElumeProfessionalSubmit={create({confirm,begin,track,request,commit,refresh,onRefreshError}){
  let busy=false;
  return {async execute(operation,summary){
   if(busy)return false;
   busy=true;let end;
   try{
    if(!await confirm(summary))return false;
    end=begin();
    track(operation);
    const result=await request(operation);
    commit(operation,result);
    try{await refresh();}catch(error){onRefreshError(error);}
    return true;
   }finally{end?.();busy=false;}
  }};
 }};
})();
