(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const state={geo:null,geoError:null,routeLayer:null,routeMarkers:null,stopCount:0};

function visibleView(){return document.querySelector('.view.active')||document.querySelector('.view');}
function legendItemsFromGlobal(){
  return [...document.querySelectorAll('#contextLegendItems tr')].slice(0,6).map(tr=>{
    const t=[...tr.querySelectorAll('td')].map(x=>x.textContent.trim());
    const sw=tr.querySelector('i,span[style*="background"]');
    return {label:t[1]||t[0]||'',desc:t[2]||'',color:sw?.style?.backgroundColor||sw?.style?.background||''};
  });
}
function ensureInlineLegend(view){
  if(!view)return null;
  let box=view.querySelector(':scope > .inline-context-legend');
  if(!box){
    box=document.createElement('section');box.className='inline-context-legend';
    const hero=view.querySelector('.section-hero');
    if(hero)hero.insertAdjacentElement('afterend',box); else view.prepend(box);
  }
  return box;
}
function syncInlineLegend(){
  const view=visibleView(),box=ensureInlineLegend(view);if(!box)return;
  const title=$('contextLegendTitle')?.textContent||'Leyenda del visor';
  const intro=$('contextLegendIntro')?.textContent||'';
  const source=$('contextLegendSource')?.textContent||'';
  const situation=$('contextLegendSituation')?.textContent||'';
  const variable=$('contextLegendVariable')?.textContent||'';
  const unit=$('contextLegendUnit')?.textContent||'';
  const horizon=$('contextLegendHorizon')?.textContent||'';
  let items=legendItemsFromGlobal();
  if(!items.length)items=[{label:'Mapa base',desc:'Sin capa temática seleccionada.',color:'#7aa8c2'}];
  box.innerHTML=`<div class="inline-legend-main"><div><b>${esc(title)}</b><small>${esc(intro)}</small></div><div class="inline-legend-meta"><span>${esc(situation)}</span><span>${esc(variable)}${unit&&unit!=='—'?' · '+esc(unit):''}</span><span>${esc(horizon)}</span><span>${esc(source)}</span></div></div><div class="inline-legend-items">${items.map(x=>`<div class="inline-legend-item"><i style="background:${esc(x.color||'#8aa0ae')}"></i><b>${esc(x.label)}</b><span>${esc(x.desc)}</span></div>`).join('')}</div>`;
}
function hookLegend(){
  if(typeof window.setContextLegend==='function'&&!window.__gslV15LegendHook){
    window.__gslV15LegendHook=true;const old=window.setContextLegend;
    window.setContextLegend=function(){const r=old.apply(this,arguments);setTimeout(syncInlineLegend,0);return r};
  }
  syncInlineLegend();
}

function addUniversalGpsButtons(){
  document.querySelectorAll('.map-head').forEach(head=>{
    if(head.querySelector('.universal-gps'))return;
    const b=document.createElement('button');b.className='btn universal-gps';b.type='button';b.textContent='⌖ UBICARME';b.onclick=()=>centerCurrentVisibleMap(true);head.appendChild(b);
  });
}
function requestGeo(){
  if(!navigator.geolocation){state.geoError='GPS no disponible';return Promise.resolve(null)}
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>{
    state.geo={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,at:Date.now()};localStorage.setItem('gsl_last_geo',JSON.stringify(state.geo));
    document.dispatchEvent(new CustomEvent('gsl-location',{detail:state.geo}));resolve(state.geo);
  },e=>{state.geoError=e.message||'Permiso de ubicación no concedido';resolve(null)},{enableHighAccuracy:true,timeout:12000,maximumAge:300000}));
}
function currentMapForView(){
  const v=visibleView()?.id||'';const m=window.GSL_MAPS||{};
  const mapByView={monitor:m.map,history:m.historyMap,forecast:m.forecastMap,rain:m.rainMap,risk:m.riskMap,soil:m.soilMap,marine:m.marineMap,agriculture:m.agriMap,roads:window.GSL_ROAD_MAP};
  return mapByView[v]||null;
}
function putGeoMarker(map){
  if(!map||!state.geo||!window.L)return;
  if(map.__gslGeoMarker)map.removeLayer(map.__gslGeoMarker);
  map.__gslGeoMarker=L.circleMarker([state.geo.lat,state.geo.lon],{radius:8,color:'#fff',weight:2,fillColor:'#18c995',fillOpacity:1}).bindTooltip(`Tu ubicación · precisión ±${Math.round(state.geo.accuracy||0)} m`).addTo(map);
}
function centerCurrentVisibleMap(force=false){
  const map=currentMapForView();if(!map)return;
  if(state.geo){map.setView([state.geo.lat,state.geo.lon],Math.max(map.getZoom(),8));putGeoMarker(map);return}
  if(force)requestGeo().then(g=>{if(g){const mm=currentMapForView();mm?.setView([g.lat,g.lon],9);putGeoMarker(mm)}});
}
function autoCenterOnView(){setTimeout(()=>centerCurrentVisibleMap(false),180)}

async function routeFetch(){
  if(!window.GSL_ROAD_MAP)return;
  let origin=$('routeOrigin')?.value.trim()||'',destination=$('routeDestination')?.value.trim()||'';
  if(!origin&&state.geo)origin=`${state.geo.lat},${state.geo.lon}`;
  if(!origin||!destination){$('routeSummary').textContent='Completa origen y destino, o usa tu ubicación como origen.';return}
  const stops=[...document.querySelectorAll('.route-stop-input')].map(x=>x.value.trim()).filter(Boolean);
  $('routeSummary').textContent='Calculando ruta vial…';
  try{
    const r=await fetch(`/api/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&stops=${encodeURIComponent(stops.join('|'))}`,{cache:'no-store'});const j=await r.json();if(!j.ok)throw Error(j.error||'Ruta no disponible');
    const map=window.GSL_ROAD_MAP;if(state.routeLayer)map.removeLayer(state.routeLayer);if(state.routeMarkers)map.removeLayer(state.routeMarkers);
    state.routeLayer=L.geoJSON(j.geometry,{style:{color:'#2e9df4',weight:6,opacity:.86}}).addTo(map);state.routeMarkers=L.layerGroup().addTo(map);
    j.places.forEach((p,i)=>L.circleMarker([p.lat,p.lon],{radius:7,color:'#fff',weight:2,fillColor:i===0?'#18c995':i===j.places.length-1?'#ef5656':'#f3c84b',fillOpacity:1}).bindTooltip(i===0?'Origen':i===j.places.length-1?'Destino':`Parada ${i}`).addTo(state.routeMarkers));
    map.fitBounds(state.routeLayer.getBounds(),{padding:[25,25]});
    const near=(window.GSL_ROAD_INCIDENTS||[]).filter(x=>Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)&&state.routeLayer.getBounds().pad(.12).contains([+x.lat,+x.lon]));
    $('routeSummary').innerHTML=`<b>${Math.round(j.distanceKm).toLocaleString('es-PE')} km</b> · <b>${Math.round(j.durationMin/60*10)/10} h</b> estimadas · ${near.length} incidencias dentro del corredor visible. <a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}">Abrir en Google Maps ↗</a>`;
    window.setContextLegend?.('roads',{title:'Ruta seleccionada',source:'OSRM + incidencias GeoSismosLatam',situation:`${origin} → ${destination}`,variable:'Ruta / tiempo / incidencias',unit:'km · horas',horizon:'Actual',intro:'La línea azul representa la ruta vial calculada. Los marcadores de incidencias cercanas deben verificarse en su fuente.',items:[['#2e9df4','line','Ruta calculada','Recorrido vial estimado.'],['#18c995','circle','Origen','Punto de salida.'],['#ef5656','circle','Destino','Punto final.'],['#e64646','circle','Incidencias','Eventos viales reportados en el corredor.']]});
  }catch(e){$('routeSummary').textContent='No se pudo calcular la ruta. Prueba nombres más específicos de ciudad, distrito o mercado.'}
}
function addStop(){if(state.stopCount>=3)return;state.stopCount++;const row=document.createElement('div');row.className='route-stop-row';row.innerHTML=`<input class="route-stop-input" placeholder="Parada ${state.stopCount}: ciudad / mercado / distrito"><button class="btn route-stop-remove">×</button>`;row.querySelector('button').onclick=()=>row.remove();$('routeStops').appendChild(row)}
function useGpsOrigin(){const apply=()=>{if(state.geo)$('routeOrigin').value=`${state.geo.lat.toFixed(6)},${state.geo.lon.toFixed(6)}`};if(state.geo)apply();else requestGeo().then(apply)}

function signalCards(items){if(!items?.length)return '<p class="muted">No se encontraron señales públicas recientes con ese filtro. Esto no significa que no existan publicaciones fuera de los índices accesibles.</p>';return items.map(x=>`<article class="signal-card">${x.image?`<img loading="lazy" referrerpolicy="no-referrer" src="${esc(x.image)}" onerror="this.remove()">`:''}<div><span class="signal-type ${esc(x.sourceType)}">${x.sourceType==='social'?'RED PÚBLICA':'WEB / NOTICIA'}</span><b>${esc(x.title)}</b><small>${esc(x.domain||'Fuente pública')} · ${esc(x.published||'fecha no disponible')}</small><p>${esc(x.note||'')}</p><a target="_blank" rel="noopener" href="${esc(x.url)}">VER PUBLICACIÓN ↗</a></div></article>`).join('')}
async function loadAgriSignals(){const q=$('agriSignalQuery')?.value.trim()||$('marketProduct')?.value.trim()||'agricultura precios mercados',source=$('agriSignalSource')?.value||'all';$('agriSignalFeed').innerHTML='<p class="muted">Buscando señales públicas recientes…</p>';try{const r=await fetch(`/api/agri-signals?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`,{cache:'no-store'});const j=await r.json();$('agriSignalFeed').innerHTML=signalCards(j.signals||[])}catch{$('agriSignalFeed').innerHTML='<p class="muted">Radar público temporalmente no disponible.</p>'}}

function marketTableUpgrade(){
  const old=window.marketRows;if(typeof old!=='function')return;
}
async function marineRefresh(){
  const port=$('marinePortSelect')?.value||'Callao';$('marineLiveSummary').innerHTML='<p class="muted">Consultando condiciones marinas…</p>';
  try{const r=await fetch(`/api/marine/summary?port=${encodeURIComponent(port)}`,{cache:'no-store'});const j=await r.json();if(!j.ok)throw Error();
    const wh=j.wave?.height,wp=j.wave?.period,ws=j.wind?.speed,wg=j.wind?.gust;
    $('marineLiveUpdated').textContent=new Date(j.updatedAt).toLocaleTimeString('es-PE');
    $('marineLiveSummary').innerHTML=`<div class="marine-metrics"><div><span>Puerto</span><b>${esc(j.port)}</b></div><div><span>Oleaje modelado</span><b>${wh==null?'—':Number(wh).toFixed(1)+' m'}</b></div><div><span>Periodo</span><b>${wp==null?'—':Number(wp).toFixed(0)+' s'}</b></div><div><span>Viento</span><b>${ws==null?'—':Number(ws).toFixed(0)+' km/h'}</b></div><div><span>Ráfaga</span><b>${wg==null?'—':Number(wg).toFixed(0)+' km/h'}</b></div></div><div class="marine-links"><a target="_blank" rel="noopener" href="${esc(j.officialTideUrl)}">Tabla oficial DHN ↗</a><a target="_blank" rel="noopener" href="${esc(j.solunarUrl)}">Referencia solunar ↗</a></div>`;
    $('fishingForecast').innerHTML=`<div class="fishing-score ${j.score>=70?'good':j.score>=45?'warn':'bad'}"><strong>${j.score}/100</strong><div><b>${esc(j.condition)}</b><span>Índice operativo experimental para planificar una salida; no estima cantidad de peces.</span></div></div><p>${esc(j.note)}</p>`;
    window.setContextLegend?.('marine',{title:`Mar y pesca · ${j.port}`,source:'DHN + modelos marinos de apoyo',situation:j.port,variable:'Marea / oleaje / viento',unit:'m · s · km/h',horizon:'Actual',intro:'El portal combina acceso a la tabla oficial de mareas DHN con condiciones marinas modeladas para facilitar la planificación.',items:[['#18a8d8','circle','Puerto','Punto costero consultado.'],['#55b7dc','line','Oleaje','Altura/periodo modelados.'],['#f0a221','outline','Precaución','Verificar avisos DHN y Capitanía.']]});
  }catch{$('marineLiveSummary').innerHTML='<p class="muted">No se pudo actualizar el resumen. Usa los enlaces directos a DHN y la referencia solunar.</p>'}
}
function nearestMarinePort(){if(!state.geo){requestGeo().then(nearestMarinePort);return}const pts={Callao:[-12.05,-77.16],Paita:[-5.09,-81.11],Talara:[-4.58,-81.27],Chimbote:[-9.08,-78.59],Huacho:[-11.11,-77.62],Pisco:[-13.71,-76.22],'San Juan':[-15.35,-75.16],Chala:[-15.86,-74.25],Atico:[-16.22,-73.61],Matarani:[-17,-72.1],Ilo:[-17.64,-71.34]};const d=(a,b)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*Math.cos(a[0]*Math.PI/180));let best=null;for(const [k,v] of Object.entries(pts)){const x=d([state.geo.lat,state.geo.lon],v);if(!best||x<best[1])best=[k,x]}$('marinePortSelect').value=best[0];marineRefresh()}

function hookFreightDisplay(){
  const b=$('freightCalc');if(!b)return;
  b.replaceWith(b.cloneNode(true));const nb=$('freightCalc');nb.addEventListener('click',async()=>{
    const origin=$('freightOrigin').value.trim(),destination=$('freightDestination').value.trim(),tons=+$('freightTons').value||0;
    if(!origin||!destination||tons<=0){$('freightResult').textContent='Selecciona distrito de salida, distrito de llegada y toneladas.';return}
    $('freightResult').textContent='Calculando distancia vial y flete…';
    try{
      const r=await fetch(`/api/freight?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&tons=${encodeURIComponent(tons)}`,{cache:'no-store'});const j=await r.json();if(!j.ok)throw Error();
      $('freightResult').innerHTML=`<b>${esc(origin)} → ${esc(destination)}</b><div class="freight-metrics"><span>Distancia vial <b>${Number(j.distanceKm).toFixed(1)} km</b></span><span>Carga <b>${tons.toFixed(1)} t</b></span><span>Tarifa fija <b>S/ ${Number(j.ratePerKmTon).toFixed(2)}/km·t</b></span><span>Costo por kg <b>S/ ${Number(j.rateKg).toFixed(3)}</b></span><span>COSTO TOTAL <b>S/ ${Number(j.total).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></span><span>Motor de ruta <b>${esc(j.provider||'—')}</b></span></div><small>${esc(j.note)}</small><details><summary>Ver fórmula</summary><code>${esc(j.excelFormula)}</code><br><small>${esc(j.formula)}</small></details>`
    }catch{$('freightResult').textContent='No se pudo calcular la distancia. Verifica los distritos seleccionados.'}
  })
}

function bind(){
  hookLegend();addUniversalGpsButtons();
  document.querySelectorAll('.nav button[data-view],.navbtn[data-view],[data-view]').forEach(b=>b.addEventListener('click',()=>{setTimeout(()=>{syncInlineLegend();addUniversalGpsButtons();autoCenterOnView()},180)}));
  $('routeUseGps')?.addEventListener('click',useGpsOrigin);$('routeAddStop')?.addEventListener('click',addStop);$('routeDraw')?.addEventListener('click',routeFetch);
  $('agriSignalSearch')?.addEventListener('click',loadAgriSignals);$('marineRefresh')?.addEventListener('click',marineRefresh);$('marinePortSelect')?.addEventListener('change',marineRefresh);$('marineNearest')?.addEventListener('click',nearestMarinePort);
  hookFreightDisplay();
  requestGeo().then(g=>{if(g){setTimeout(()=>{Object.values(window.GSL_MAPS||{}).forEach(m=>{if(m){m.setView([g.lat,g.lon],7);putGeoMarker(m)}});if(window.GSL_ROAD_MAP){window.GSL_ROAD_MAP.setView([g.lat,g.lon],8);putGeoMarker(window.GSL_ROAD_MAP)}},500)}});
  setTimeout(()=>{marineRefresh();loadAgriSignals()},700);
}
document.addEventListener('DOMContentLoaded',bind);
})();
