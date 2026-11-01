/* Elume charts: dependency-free charts shared by the shop panels and the server Master.
   Every function returns an HTML string; callers escape nothing extra. Colours follow a
   validated colour-blind-safe order (blue, orange, aqua, yellow) and never carry meaning
   alone: values and labels are always written next to the marks. */
(function(global){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const plain=v=>new Intl.NumberFormat('pt-BR').format(v);
 const slot=i=>'var(--ec-'+(i%4+1)+')';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const CSS=`.ec{--ec-1:#2a78d6;--ec-2:#eb6834;--ec-3:#1baf7a;--ec-4:#eda100;--ec-ink:#1d1b22;--ec-muted:#6d6878;--ec-grid:#e9e4ee;--ec-track:#efebf3;--ec-surface:#fff;--ec-good:#0b7a32;--ec-bad:#b3261e;color:var(--ec-ink);font-family:inherit}
.ec-dark,.ec-dark .ec{--ec-1:#3987e5;--ec-2:#d95926;--ec-3:#199e70;--ec-4:#c98500;--ec-ink:#fff;--ec-muted:#b7bcd8;--ec-grid:#3b4163;--ec-track:#353b5b;--ec-surface:#262b45;--ec-good:#5fd38d;--ec-bad:#ff8a80}
.ec-chart{position:relative;min-width:0}
.ec-axis{display:flex;justify-content:space-between;gap:8px;color:var(--ec-muted);font-size:11px;margin-top:6px}
.ec-axis span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ec-max{color:var(--ec-muted);font-size:11px;margin-bottom:4px}
.ec-cols{display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--ec-grid);background:repeating-linear-gradient(to top,transparent 0,transparent calc(25% - 1px),var(--ec-grid) calc(25% - 1px),var(--ec-grid) 25%)}
.ec-col{flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;cursor:default}
.ec-col i{display:block;width:100%;max-width:28px;margin:0 auto;border-radius:4px 4px 0 0;background:var(--ec-1);min-height:0}
.ec-col i.ec-zero{background:var(--ec-track);min-height:2px;border-radius:2px}
.ec-col:hover i,.ec-col:focus i{filter:brightness(1.15);outline:2px solid var(--ec-ink);outline-offset:1px}
.ec-area{display:block;width:100%;overflow:visible}
.ec-area .ec-line{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.ec-hit rect{fill:transparent}.ec-hit line{stroke:var(--ec-muted);stroke-width:1;vector-effect:non-scaling-stroke;opacity:0}
.ec-hit:hover line{opacity:1}
.ec-ring{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center}
.ec-ring-plot{position:relative;width:var(--ec-size,150px);aspect-ratio:1}
.ec-ring-plot svg{display:block;width:100%;height:100%;transform:rotate(-90deg)}
.ec-ring-center{position:absolute;inset:0;display:grid;place-content:center;text-align:center;pointer-events:none}
.ec-ring-center strong{font-size:calc(var(--ec-size,150px)*.17);line-height:1.05;letter-spacing:-.5px}
.ec-ring-center small{color:var(--ec-muted);font-size:11px;margin-top:3px}
.ec-legend{display:grid;gap:8px;margin:0;padding:0;list-style:none;min-width:0}
.ec-legend li{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:13px}
.ec-legend i{width:12px;height:12px;border-radius:3px}
.ec-legend span{overflow-wrap:anywhere}.ec-legend b{white-space:nowrap}
.ec-legend small{color:var(--ec-muted);font-weight:400;margin-left:4px}
.ec-rank{display:grid;gap:12px}
.ec-rank-row{display:grid;gap:5px}
.ec-rank-top{display:flex;justify-content:space-between;gap:10px;font-size:13px}
.ec-rank-top span{min-width:0;overflow-wrap:anywhere}.ec-rank-top b{white-space:nowrap}
.ec-rank-track{height:8px;border-radius:4px;background:var(--ec-track);overflow:hidden}
.ec-rank-track i{display:block;height:100%;border-radius:4px;background:var(--ec-1)}
.ec-tile{display:grid;gap:6px;min-width:0}
.ec-tile-label{font-size:12px;font-weight:600;color:var(--ec-muted);text-transform:uppercase;letter-spacing:.4px}
.ec-tile-value{font-size:clamp(19px,5.2vw,30px);font-weight:700;letter-spacing:-.8px;line-height:1.1;overflow-wrap:anywhere}
.ec-delta{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;width:max-content;max-width:100%;padding:3px 8px;border-radius:999px;background:var(--ec-track)}
.ec-delta.up{color:var(--ec-good)}.ec-delta.down{color:var(--ec-bad)}.ec-delta.flat{color:var(--ec-muted)}
.ec-tile small{color:var(--ec-muted);font-size:12px;line-height:1.45}
.ec-empty{color:var(--ec-muted);font-size:13px;padding:18px 0;text-align:center}
.ec-tip{position:fixed;z-index:9999;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#15131b;color:#fff;font:12px/1.45 system-ui,sans-serif;box-shadow:0 6px 20px #0004;white-space:pre-line}
@media(max-width:520px){.ec-ring{grid-template-columns:1fr;justify-items:center}.ec-ring .ec-legend{width:100%}.ec-tile-value{font-size:clamp(18px,5.6vw,25px)}}`;

 function install(doc){
  if(!doc||doc.getElementById('elume-charts-style'))return;
  const style=doc.createElement('style');style.id='elume-charts-style';style.textContent=CSS;doc.head.append(style);
  let tip=null;
  const show=(target,x,y)=>{
   if(!tip){tip=doc.createElement('div');tip.className='ec-tip';tip.setAttribute('role','tooltip');doc.body.append(tip);}
   tip.textContent=target.getAttribute('data-tip');tip.hidden=false;
   const w=tip.offsetWidth,h=tip.offsetHeight,vw=doc.documentElement.clientWidth;
   tip.style.left=Math.max(8,Math.min(vw-w-8,x+12))+'px';tip.style.top=Math.max(8,y-h-12)+'px';
  };
  const hide=()=>{if(tip)tip.hidden=true;};
  doc.addEventListener('pointermove',e=>{const t=e.target.closest?.('[data-tip]');if(t)show(t,e.clientX,e.clientY);else hide();});
  doc.addEventListener('focusin',e=>{const t=e.target.closest?.('[data-tip]');if(!t)return;const r=t.getBoundingClientRect();show(t,r.left+r.width/2,r.top);});
  doc.addEventListener('focusout',hide);doc.addEventListener('scroll',hide,true);
 }

 function empty(text){return '<p class="ec-empty">'+esc(text||'Sem dados no período.')+'</p>';}

 /** Vertical bars. points: [{label, value, tip?}] in order. */
 function columns(points,o={}){
  const format=o.format||plain,height=o.height||160;
  if(!points.length||!points.some(p=>finite(p.value)&&p.value>0))return empty(o.empty);
  const max=Math.max(...points.map(p=>finite(p.value)?p.value:0));
  const cols=points.map(p=>{
   const v=finite(p.value)?p.value:0,pct=max?v/max*100:0,tip=p.tip||(p.label+': '+format(v));
   return '<span class="ec-col" tabindex="0" data-tip="'+esc(tip)+'" aria-label="'+esc(tip)+'"><i'+(v?'':' class="ec-zero"')+' style="height:'+(v?Math.max(pct,1.5):0).toFixed(2)+'%;'+(p.color?'background:'+p.color:'')+'"></i></span>';
  }).join('');
  return '<div class="ec ec-chart" role="group" aria-label="'+esc(o.title||'Gráfico de barras')+'"><div class="ec-max">Máximo: '+esc(format(max))+'</div><div class="ec-cols" style="height:'+height+'px">'+cols+'</div>'+axis(points)+'</div>';
 }

 function axis(points){
  if(!points.length)return '';
  const picks=points.length<3?points:[points[0],points[Math.floor((points.length-1)/2)],points[points.length-1]];
  return '<div class="ec-axis">'+picks.map(p=>'<span>'+esc(p.short||p.label)+'</span>').join('')+'</div>';
 }

 /** Area trend. points: [{label, value, tip?}] in time order. */
 function area(points,o={}){
  const format=o.format||plain,height=o.height||170,color=o.color||'var(--ec-1)';
  if(points.length<2||!points.some(p=>finite(p.value)&&p.value!==0))return empty(o.empty);
  const W=1000,H=height,max=Math.max(...points.map(p=>finite(p.value)?p.value:0),1),pad=6;
  const xy=points.map((p,i)=>[i*W/(points.length-1),H-pad-(finite(p.value)?p.value:0)/max*(H-pad*2)]);
  const line=xy.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
  const id='ecg'+Math.random().toString(36).slice(2,9),step=W/(points.length-1);
  const hits=points.map((p,i)=>{const tip=p.tip||(p.label+': '+format(finite(p.value)?p.value:0)),x=xy[i][0];
   return '<g class="ec-hit" data-tip="'+esc(tip)+'"><rect x="'+Math.max(0,x-step/2).toFixed(1)+'" y="0" width="'+step.toFixed(1)+'" height="'+H+'"/><line x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="0" y2="'+H+'"/></g>';}).join('');
  const grid=[.25,.5,.75].map(f=>'<line x1="0" x2="'+W+'" y1="'+(H*f).toFixed(1)+'" y2="'+(H*f).toFixed(1)+'" stroke="var(--ec-grid)" stroke-width="1" vector-effect="non-scaling-stroke"/>').join('');
  return '<div class="ec ec-chart" role="img" aria-label="'+esc((o.title||'Evolução')+'. Máximo '+format(max))+'"><div class="ec-max">Máximo: '+esc(format(max))+'</div><svg class="ec-area" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="height:'+H+'px"><defs><linearGradient id="'+id+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity=".35"/><stop offset="1" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+grid+'<line x1="0" x2="'+W+'" y1="'+H+'" y2="'+H+'" stroke="var(--ec-grid)" vector-effect="non-scaling-stroke"/><path d="'+line+' L'+W+' '+H+' L0 '+H+' Z" fill="url(#'+id+')"/><path class="ec-line" d="'+line+'" stroke="'+color+'"/>'+hits+'</svg>'+axis(points)+'</div>';
 }

 function arc(r,share,offset){const c=2*Math.PI*r;return 'stroke-dasharray="'+(c*share).toFixed(2)+' '+c.toFixed(2)+'" stroke-dashoffset="'+(-c*offset).toFixed(2)+'"';}

 /** Ring with a value in the centre and a legend that repeats every value. */
 function donut(segments,o={}){
  const format=o.format||plain,limit=o.limit||4;let rows=segments.filter(s=>finite(s.value)&&s.value>0).sort((x,y)=>o.keepOrder?0:y.value-x.value);
  // Never cycle colours: categories past the palette fold into "Outros".
  if(rows.length>limit)rows=[...rows.slice(0,limit-1),{label:'Outros',value:rows.slice(limit-1).reduce((s,r)=>s+r.value,0),color:'var(--ec-muted)'}];
  const total=rows.reduce((s,r)=>s+r.value,0);
  if(!total)return empty(o.empty);
  const r=42,size=o.size||150;let offset=0;
  const gap=rows.length>1?.006:0;
  const arcs=rows.map((s,i)=>{const share=s.value/total,color=s.color||slot(i),tip=s.label+': '+format(s.value)+' ('+percent(share)+')';
   const out='<circle cx="50" cy="50" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="12" '+arc(r,Math.max(0,share-gap),offset)+' data-tip="'+esc(tip)+'"><title>'+esc(tip)+'</title></circle>';offset+=share;return out;}).join('');
  const legend='<ul class="ec-legend">'+rows.map((s,i)=>'<li><i style="background:'+(s.color||slot(i))+'"></i><span>'+esc(s.label)+'</span><b>'+esc(format(s.value))+'<small>'+percent(s.value/total)+'</small></b></li>').join('')+'</ul>';
  return '<div class="ec ec-ring" style="--ec-size:'+size+'px"><div class="ec-ring-plot" role="img" aria-label="'+esc((o.title||'Distribuição')+': '+rows.map(s=>s.label+' '+format(s.value)).join(', '))+'"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="'+r+'" fill="none" stroke="var(--ec-track)" stroke-width="12"/>'+arcs+'</svg><div class="ec-ring-center"><strong>'+esc(o.center??format(total))+'</strong><small>'+esc(o.sub||'Total')+'</small></div></div>'+legend+'</div>';
 }

 /** Single percentage ring (occupancy, margin, conversion). null means unknown. */
 function gauge(value,o={}){
  const size=o.size||130,known=finite(value),share=known?Math.max(0,Math.min(1,value/100)):0;
  const color=o.color||'var(--ec-1)',label=known?percent(share,value):'Sem base';
  return '<div class="ec ec-ring" style="--ec-size:'+size+'px;grid-template-columns:auto minmax(0,1fr)"><div class="ec-ring-plot" role="img" aria-label="'+esc((o.title||'Indicador')+': '+label)+'"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--ec-track)" stroke-width="10"/>'+(share?'<circle cx="50" cy="50" r="42" fill="none" stroke="'+color+'" stroke-width="10" stroke-linecap="round" '+arc(42,share,0)+'/>':'')+'</svg><div class="ec-ring-center"><strong>'+esc(label)+'</strong><small>'+esc(o.sub||'')+'</small></div></div>'+(o.note?'<p class="ec-tile" style="margin:0"><span class="ec-tile-label">'+esc(o.title||'')+'</span><small>'+esc(o.note)+'</small></p>':'')+'</div>';
 }

 function percent(share,raw){const v=raw!==undefined?raw:share*100;return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:Math.abs(v)<10?1:0}).format(v)+'%';}

 /** Ranked horizontal bars. rows: [{label, value, detail?}] already sorted. */
 function ranking(rows,o={}){
  const format=o.format||plain,list=rows.filter(r=>finite(r.value)).slice(0,o.limit||6);
  if(!list.length||!list.some(r=>r.value>0))return empty(o.empty);
  const max=Math.max(...list.map(r=>r.value));
  return '<div class="ec ec-rank" role="list" aria-label="'+esc(o.title||'Ranking')+'">'+list.map((r,i)=>'<div class="ec-rank-row" role="listitem"><div class="ec-rank-top"><span>'+esc(r.label)+'</span><b>'+esc(r.detail||format(r.value))+'</b></div><div class="ec-rank-track"><i style="width:'+(max?Math.max(r.value/max*100,r.value?2:0):0).toFixed(1)+'%;background:'+(r.color||(o.single===false?slot(i):'var(--ec-1)'))+'"></i></div></div>').join('')+'</div>';
 }

 /** KPI with the change against the previous period, shown with an arrow and words. */
 function tile(label,value,o={}){
  let delta='';
  if(finite(o.current)&&finite(o.previous)){
   const diff=o.current-o.previous,base=Math.abs(o.previous);
   const dir=diff>0?'up':diff<0?'down':'flat',better=o.lowerIsBetter?dir==='down':dir==='up';
   const text=base?(diff>0?'+':'')+percent(0,diff/base*100):diff?'Novo':'Estável';
   delta='<span class="ec-delta '+(dir==='flat'?'flat':better?'up':'down')+'" title="Comparado ao período anterior">'+(dir==='up'?'▲':dir==='down'?'▼':'■')+' '+esc(text)+' <span style="font-weight:400">vs. anterior</span></span>';
  }
  return '<div class="ec ec-tile"><span class="ec-tile-label">'+esc(label)+'</span><strong class="ec-tile-value">'+esc(value)+'</strong>'+delta+(o.note?'<small>'+esc(o.note)+'</small>':'')+'</div>';
 }

 /** Groups dated records into consecutive days ending today (oldest first). */
 function daily(records,days,dateOf,valueOf){
  const out=[],index=new Map(),today=new Date();today.setHours(12,0,0,0);
  for(let i=days-1;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);const row={key,label:d.toLocaleDateString('pt-BR'),short:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),value:0};index.set(key,row);out.push(row);}
  for(const r of records){const d=dateOf(r);if(!d||Number.isNaN(d.getTime()))continue;const local=new Date(d);local.setHours(12,0,0,0);const row=index.get(local.toISOString().slice(0,10));if(row)row.value+=valueOf(r);}
  return out;
 }

 const api={install,columns,area,donut,gauge,ranking,tile,daily,empty,percent,escape:esc};
 if(typeof module==='object'&&module.exports)module.exports=api;
 global.ElumeCharts=api;
 if(global.document)(global.document.readyState==='loading'?global.document.addEventListener('DOMContentLoaded',()=>install(global.document)):install(global.document));
})(typeof window!=='undefined'?window:globalThis);
