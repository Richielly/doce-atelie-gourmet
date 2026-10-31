(function(){
 'use strict';
 const url=new URL(location.href),p=url.searchParams;
 window.DOCE_MODE=window.DOCE_MODE==='admin'||url.pathname==='/admin'||p.has('admin')||p.has('painel')?'admin':p.has('loja')?'customer':'showcase';
 document.documentElement.dataset.loading='true';
 if(DOCE_MODE==='showcase')location.replace(new URL('minhas-lojas.html',document.baseURI));
})();
