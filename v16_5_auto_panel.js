(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const LABELS={dashboard:'Centro de situación',monitor:'Monitoreo sísmico',forecast:'Proyección sísmica',rain:'Lluvias',marine:'Mar y pesca',risk:'Riesgos',soil:'Construcción segura',agriculture:'Agricultura y mercados',roads:'Carreteras',news:'Actualidad',prevention:'Prevención',method:'Metodología',services:'Servicios'};
const MAPBY={monitor:'map',forecast:'forecastMap',rain:'rainMap',risk:'riskMap',soil:'soilMap',marine:'marineMap',agriculture:'agriMap'};
const S={lastClick:{},popup:{},hooked:new WeakSet()};
function activeView(){return document.querySelector('.view.active')||document.querySelector('.view')}
function mapFor(id){if(id==='roads')return window.GSL_ROAD_MAP||null;return (window.GSL_MAPS||{})[MAPBY[id]]||null}
function text(id,fallback='—'){return document.getElementById(id)?.textContent?.trim()||fallback}
function legendItems(){
  let rows=[...document.querySelectorAll('.view.active .inline-legend-item')];
  if(!rows.length) rows=[...document.querySelectorAll('#contextLegendItems tr')];
  return rows.slice(0,8).map(el=>{
    if(el.matches('tr')){const td=[...el.querySelectorAll('td')];const sw=el.querySelector('i,[style*="background"]');return {color:sw?.style?.backgroundColor||sw?.style?.background||'#78909c',label:td[1]?.textContent.trim()||td[0]?.textContent.trim()||'Categoría',desc:td[2]?.textContent.trim()||''}}
    const sw=el.querySelector('i');return {color:sw?.style?.backgroundColor||sw?.style?.background||'#78909c',label:el.querySelector('b')?.textContent.trim()||'Categoría',desc:el.querySelector('span')?.textContent.trim()||''}
  }).filter(x=>x.label)
}
function moduleGuide(id){
 const t=text('contextLegendTitle',''); const h=text('contextLegendHorizon','');
 const guides={
  monitor:'El visor muestra sismos reportados y capas territoriales. Al mover el mapa cambia el ámbito visible; al seleccionar un evento se actualiza la interpretación con sus datos disponibles.',
  forecast:'Este mapa representa una estimación probabilística experimental. Las zonas coloreadas indican concentración relativa del modelo y NO permiten predecir fecha, lugar o magnitud exacta de un próximo sismo.',
  rain:/mes/i.test(h+t)?'Se visualiza una tendencia climática de mediano plazo. Los colores deben leerse como anomalía o tendencia relativa, no como lluvia exacta para un día determinado.':'Se visualiza precipitación observada o prevista para el horizonte activo. Los colores corresponden a la escala indicada en la leyenda y deben interpretarse junto con la fuente y fecha de actualización.',
  marine:'El visor reúne condiciones marítimas y pesqueras disponibles. Revise mareas, oleaje, viento y la vigencia de cada fuente antes de planificar una salida.',
  risk:'El mapa presenta peligros, escenarios o incidencias territoriales. El color expresa la categoría de la capa activa; la clasificación oficial de la fuente siempre prevalece.',
  soil:'El visor muestra zonificación sísmica, suelos u otras capas para construcción segura. La información orienta, pero no sustituye un estudio de mecánica de suelos ni el diseño de un profesional responsable.',
  agriculture:'El visor integra cultivos, mercados, precios e indicadores experimentales. Diferencie siempre datos oficiales de estimaciones, señales públicas y proyecciones.',
  roads:'El mapa permite planificar rutas y visualizar incidencias. Puede usar GPS, buscar un lugar o marcar inicio y fin directamente sobre el mapa; los reportes deben revisarse según su antigüedad y fuente.',
  dashboard:'Resume los módulos principales del portal. Cada tarjeta muestra el estado disponible y sirve de acceso rápido a su visor.',
  news:'Presenta enlaces y reportes de actualidad. Verifique siempre la fecha y la fuente original.',
  prevention:'Contiene recomendaciones generales de prevención. Adapte las medidas a las indicaciones de las autoridades y al tipo de emergencia.',
  method:'Explica las fuentes, criterios y limitaciones del portal.',
  services:'Muestra servicios profesionales y accesos de contacto; no forma parte de los datos oficiales de los visores.'
 };
 return guides[id]||'El panel se actualiza automáticamente según lo que se visualiza en este módulo.'
}
function visibleExtent(map){
 if(!map)return '';
 try{const c=map.getCenter(),z=map.getZoom();return `Centro visible: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} · zoom ${z}`;}catch{return ''}
}
function statusBlock(id,map){
 const situation=text('contextLegendSituation','Vista general');
 const variable=text('contextLegendVariable','Variable activa');
 const unit=text('contextLegendUnit','');
 const horizon=text('contextLegendHorizon','Actual');
 const source=text('contextLegendSource','Fuente indicada en el visor');
 const title=text('contextLegendTitle',LABELS[id]||'Visor');
 const intro=text('contextLegendIntro','');
 const click=S.lastClick[id]; const popup=S.popup[id];
 let selected='';
 if(popup) selected=`<div class="auto-selected"><b>Elemento seleccionado</b><span>${esc(popup)}</span></div>`;
 else if(click) selected=`<div class="auto-selected"><b>Punto consultado</b><span>${click.lat.toFixed(4)}, ${click.lng.toFixed(4)}</span></div>`;
 return `<div class="auto-summary"><b>${esc(title)}</b><p>${esc(moduleGuide(id))}</p>${intro?`<small>${esc(intro)}</small>`:''}</div>${selected}<div class="auto-facts"><span>Situación</span><b>${esc(situation)}</b><span>Variable</span><b>${esc(variable)}${unit&&unit!=='—'?' · '+esc(unit):''}</b><span>Horizonte</span><b>${esc(horizon)}</b><span>Fuente</span><b>${esc(source)}</b>${map?`<span>Vista</span><b>${esc(visibleExtent(map))}</b>`:''}</div>`
}
function legendHtml(){const items=legendItems();if(!items.length)return '<div class="auto-empty">No hay una escala temática activa en este momento.</div>';return `<div class="auto-legend-grid">${items.map(x=>`<div class="auto-legend-row"><i style="background:${esc(x.color)}"></i><div><b>${esc(x.label)}</b>${x.desc?`<small>${esc(x.desc)}</small>`:''}</div></div>`).join('')}</div>`}
function buildPanel(view){
 const old=view.querySelector('.v164-ai'); if(!old)return null;
 old.classList.add('v165-auto-panel'); old.classList.remove('v164-ai');
 old.innerHTML=`<span class="auto-kicker">◉ ANÁLISIS AUTOMÁTICO · ${esc((LABELS[view.id]||view.id).toUpperCase())}</span><h3>Interpretación de lo que se visualiza</h3><div class="auto-live">El panel se actualiza automáticamente al cambiar capa, mover el mapa, hacer zoom o seleccionar un elemento.</div><div class="auto-content"></div><div class="auto-legend-title">LEYENDA DEL VISOR</div><div class="auto-legend"></div><div class="auto-note">Esta explicación es automática y se basa únicamente en los datos, leyendas y capas visibles del portal. Las fuentes oficiales prevalecen.</div>`;
 return old
}
function refresh(viewId){
 const view=document.getElementById(viewId)||activeView(); if(!view)return;
 const p=view.querySelector('.v165-auto-panel')||buildPanel(view); if(!p)return;
 const map=mapFor(view.id); p.querySelector('.auto-content').innerHTML=statusBlock(view.id,map); p.querySelector('.auto-legend').innerHTML=legendHtml();
 const kicker=p.querySelector('.auto-kicker'); if(kicker)kicker.textContent=`◉ ANÁLISIS AUTOMÁTICO · ${(LABELS[view.id]||view.id).toUpperCase()}`;
}
let timer;function schedule(id){clearTimeout(timer);timer=setTimeout(()=>refresh(id||activeView()?.id),180)}
function hookLegend(){
 if(typeof window.setContextLegend==='function'&&!window.__gslV165LegendHook){window.__gslV165LegendHook=true;const old=window.setContextLegend;window.setContextLegend=function(){const r=old.apply(this,arguments);schedule(arguments[0]);return r}}
 const target=document.getElementById('contextLegendPanel')||document.body;
 new MutationObserver(()=>schedule()).observe(target,{subtree:true,childList:true,characterData:true,attributes:true});
}
function popupText(e){try{const c=e.popup?.getContent?.();if(typeof c==='string')return c.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,360);if(c?.textContent)return c.textContent.replace(/\s+/g,' ').trim().slice(0,360)}catch{}return ''}
function hookMap(id,map){if(!map||S.hooked.has(map))return;S.hooked.add(map);['moveend','zoomend','layeradd','layerremove'].forEach(ev=>map.on(ev,()=>schedule(id)));map.on('click',e=>{S.lastClick[id]={lat:e.latlng.lat,lng:e.latlng.lng};S.popup[id]='';schedule(id)});map.on('popupopen',e=>{S.popup[id]=popupText(e);schedule(id)});map.on('popupclose',()=>{S.popup[id]='';schedule(id)});}
function hookMaps(){Object.keys(MAPBY).forEach(id=>hookMap(id,mapFor(id)));hookMap('roads',mapFor('roads'))}
function ensureTopLegends(){
 document.querySelectorAll('.view').forEach(v=>{
  const legend=v.querySelector('.inline-context-legend'); if(legend)legend.classList.add('v165-top-legend');
 });
}
function navHooks(){document.querySelectorAll('.mainnav button').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{hookMaps();ensureTopLegends();schedule(b.dataset.view)},220)));}
function init(){document.querySelectorAll('.view').forEach(v=>buildPanel(v));hookLegend();hookMaps();ensureTopLegends();navHooks();schedule();setInterval(hookMaps,1200)}
document.addEventListener('DOMContentLoaded',()=>setTimeout(init,20));
})();
