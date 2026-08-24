(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let roadMap=null,roadLayer=null,roadIncidents=[];
const ROAD_COLORS={accident:'#e64646',blocked:'#ef9b28',fog:'#b7c7cf',weather:'#2d9be8',damage:'#8b5cf6',social:'#d264c6',other:'#6dbf72'};
function roadLabel(t){return ({accident:'Accidente',blocked:'Vía obstaculizada',fog:'Neblina',weather:'Lluvia / huaico',damage:'Daño de vía',social:'Reporte público',other:'Incidencia'})[t]||'Incidencia'}
function initRoadMap(){
  if(roadMap||!$('roadMap')||!window.L)return;
  roadMap=L.map('roadMap',{minZoom:4,maxZoom:18}).setView([-9.3,-75.1],5);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri'}).addTo(roadMap);
  roadLayer=L.layerGroup().addTo(roadMap);window.GSL_ROAD_MAP=roadMap;
  roadMap.fitBounds([[-20.5,-82.5],[-2,-68]],{padding:[8,8]});
  roadMap.on('click',e=>{if(window.setContextLegend)setContextLegend('roads',{theme:'risk',title:'Carreteras · punto consultado',source:'GeoSismosLatam',situation:'Punto del mapa',variable:'Estado vial',unit:'Categoría / reporte',horizon:'Actual',intro:`Coordenadas ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}.`,items:Object.entries(ROAD_COLORS).map(([k,c])=>[c,'',roadLabel(k),'Categoría visual del portal.']),note:'La ausencia de un marcador no garantiza que la vía esté libre. Verifique SUTRAN/MTC antes de viajar.'});});
}
function roadPopup(i){return `<div class="popup"><b>${esc(roadLabel(i.type))}</b><p>${esc(i.title||i.summary||'Reporte vial')}</p><small>${esc(i.source||'Fuente pública')} · ${i.published?new Date(i.published).toLocaleString('es-PE'):'hora no disponible'}</small></div>`}
function renderRoads(){
  initRoadMap(); if(!roadMap)return; roadLayer.clearLayers();
  const f=$('roadFilter')?.value||'all'; const arr=roadIncidents.filter(x=>f==='all'||x.type===f);
  arr.forEach(i=>{if(!Number.isFinite(+i.lat)||!Number.isFinite(+i.lon))return;const c=ROAD_COLORS[i.type]||ROAD_COLORS.other;const m=L.circleMarker([+i.lat,+i.lon],{radius:8,color:'#fff',weight:1.5,fillColor:c,fillOpacity:.95}).bindPopup(roadPopup(i)).addTo(roadLayer);m.on('click',()=>selectRoad(i));});
  if($('roadUpdated'))$('roadUpdated').textContent=`${arr.length} reportes visibles · ${new Date().toLocaleTimeString('es-PE')}`;
  if(window.setContextLegend)setContextLegend('roads',{theme:'risk',title:'Carreteras e incidencias',source:'SUTRAN/MTC + fuentes públicas indexables',situation:f==='all'?'Todos los reportes':roadLabel(f),variable:'Incidente / condición de vía',unit:'Categoría y confianza',horizon:'Últimas 24–48 h',intro:'Cada color corresponde al tipo de incidencia detectada o reportada.',items:[['#e64646','','Accidente','Accidente o siniestro vial.'],['#ef9b28','','Vía obstaculizada','Bloqueo, interrupción o restricción.'],['#b7c7cf','','Neblina','Visibilidad reducida / neblina reportada.'],['#2d9be8','','Lluvia / huaico','Evento meteorológico que puede afectar la vía.'],['#8b5cf6','','Daño de vía','Daño de infraestructura, derrumbe o pérdida de plataforma.'],['#d264c6','','Reporte público','Señal de fuente secundaria o social pública, aún por verificar.']],note:'Los reportes de prensa/redes son experimentales. El mapa oficial SUTRAN prevalece para el estado de la vía.'});
}
function selectRoad(i){
  $('roadInfoTitle').textContent=i.title||roadLabel(i.type);$('roadInfoText').textContent=i.summary||'Incidencia detectada en una fuente pública.';
  $('roadInfoFacts').innerHTML=`<span>Tipo</span><b>${esc(roadLabel(i.type))}</b><span>Fuente</span><b>${esc(i.source||'—')}</b><span>Confianza</span><b>${esc(i.confidence||'Baja')}</b><span>Ubicación</span><b>${esc(i.place||`${(+i.lat).toFixed(3)}, ${(+i.lon).toFixed(3)}`)}</b>`;
  $('roadInfoLinks').innerHTML=(i.url?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(i.url)}">VER FUENTE ↗</a>`:'')+`<a class="btn" target="_blank" rel="noopener" href="https://gis.sutran.gob.pe/alerta_sutran/">CONTRASTAR SUTRAN ↗</a>`;
  if(window.setContextLegend)setContextLegend('roads',{theme:'risk',title:roadLabel(i.type),source:i.source||'Fuente pública',situation:i.place||'Ubicación aproximada',variable:'Incidente seleccionado',unit:'Categoría / confianza',horizon:i.published?new Date(i.published).toLocaleString('es-PE'):'Reciente',intro:i.summary||i.title||'',items:[[ROAD_COLORS[i.type]||ROAD_COLORS.other,'',roadLabel(i.type),'Clasificación automática del reporte.']],note:`Confianza: ${i.confidence||'Baja'}. Verifique la fuente original y SUTRAN.`});
}
async function loadRoads(){
  initRoadMap();if($('roadUpdated'))$('roadUpdated').textContent='Consultando fuentes…';
  try{const r=await fetch('/api/roads',{cache:'no-store'});const j=await r.json();roadIncidents=j.incidents||[];window.GSL_ROAD_INCIDENTS=roadIncidents;renderRoads();}
  catch(e){roadIncidents=[];renderRoads();if($('roadUpdated'))$('roadUpdated').textContent='Fuente temporalmente no disponible';}
}
function gpsRoad(){if(!navigator.geolocation)return alert('Este dispositivo no ofrece ubicación.');navigator.geolocation.getCurrentPosition(p=>{initRoadMap();const ll=[p.coords.latitude,p.coords.longitude];roadMap.setView(ll,13);L.circleMarker(ll,{radius:8,color:'#fff',weight:2,fillColor:'#2fe0a0',fillOpacity:1}).bindPopup('Tu ubicación aproximada').addTo(roadMap).openPopup();},()=>alert('No fue posible obtener tu ubicación. Revisa el permiso de GPS.'));}
function googleTraffic(){const key=window.GSL_V14_CONFIG?.GOOGLE_MAPS_API_KEY||'';if(!key){$('googleTrafficStatus').innerHTML='Para tráfico Google real debes configurar una clave de <b>Google Maps JavaScript API</b> restringida a tu dominio. Mientras tanto usa el mapa de incidencias y SUTRAN.';return;}window.open('https://www.google.com/maps/@-9.3,-75.1,5z/data=!5m1!1e1','_blank','noopener');$('googleTrafficStatus').textContent='Se abrió Google Maps con tráfico. La integración embebida requiere habilitar la API en tu cuenta.';}
function marketRows(rows){if(!rows?.length)return '<p class="muted">No hay un valor fresco verificable para ese filtro. Se conservan los accesos a la fuente y el modelo no inventa un precio.</p>';return `<table class="market-data"><thead><tr><th>Producto</th><th>Precio</th><th>Unidad</th><th>Ingreso</th><th>Mercado</th><th>Tipo</th><th>Confianza</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.product)}</b></td><td>${x.price!=null?'S/ '+Number(x.price).toFixed(2):'—'}</td><td>${esc(x.unit||'kg')}</td><td>${x.ingressTons!=null?Number(x.ingressTons).toFixed(1)+' t':'—'}</td><td>${esc(x.market||x.zone||'—')}</td><td>${esc(x.kind||'Oficial')}</td><td><span class="confidence ${(x.confidence||'low').toLowerCase()}">${esc(x.confidence||'Baja')}</span></td></tr>`).join('')}</tbody></table>`}
async function loadMarkets(){
  const zone=$('marketZone')?.value||'lima_gmml',product=$('marketProduct')?.value?.trim()||'';$('marketTable').innerHTML='<p class="muted">Consultando fuentes…</p>';
  try{const r=await fetch(`/api/markets?zone=${encodeURIComponent(zone)}&product=${encodeURIComponent(product)}`,{cache:'no-store'});const j=await r.json();$('marketUpdated').textContent=j.updatedAt?new Date(j.updatedAt).toLocaleString('es-PE'):'—';$('marketTable').innerHTML=marketRows(j.rows||[])+`<div class="source-list">${(j.sources||[]).map(s=>`<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.name)} ↗</a>`).join('')}</div>`;renderSeedModel(j.model||{});}
  catch(e){$('marketTable').innerHTML='<p class="muted">No se pudo actualizar el mercado en este momento.</p>';}
}
function renderSeedModel(m){$('seedOfficial').textContent=m.officialSignals??'—';$('seedSecondary').textContent=m.secondarySignals??'—';$('seedConfidence').textContent=m.confidence||'Baja';$('seedUpdated').textContent=m.updatedAt?new Date(m.updatedAt).toLocaleTimeString('es-PE'):'10:00';$('seedModelText').textContent=m.note||'Modelo experimental multifuentе.';$('seedSources').innerHTML=(m.sources||[]).map(s=>`<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.name)} ↗</a>`).join('');}
async function estimateFreight(){const origin=$('freightOrigin').value.trim(),destination=$('freightDestination').value.trim(),tons=+$('freightTons').value||0;if(!origin||!destination||tons<=0){$('freightResult').textContent='Completa origen, destino y toneladas.';return}$('freightResult').textContent='Calculando ruta y rango referencial…';try{const r=await fetch(`/api/freight?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&tons=${encodeURIComponent(tons)}`);const j=await r.json();if(!j.ok)throw new Error(j.error||'No disponible');$('freightResult').innerHTML=`<b>${esc(j.origin)} → ${esc(j.destination)}</b><p>Distancia vial estimada: <strong>${Math.round(j.distanceKm)} km</strong>. Carga: <strong>${tons.toFixed(1)} t</strong>. Rango logístico experimental: <strong>S/ ${Math.round(j.low).toLocaleString('es-PE')} – S/ ${Math.round(j.high).toLocaleString('es-PE')}</strong>.</p><small>${esc(j.note)}</small>`;}catch(e){$('freightResult').textContent='No se pudo calcular la ruta. Prueba con nombres de ciudad más específicos.';}}
function hookNavigation(){document.querySelector('[data-view="roads"]')?.addEventListener('click',()=>{setTimeout(()=>{initRoadMap();roadMap?.invalidateSize();loadRoads();},140)});}
function bindV14(){
  $('roadRefresh')?.addEventListener('click',loadRoads);$('roadFilter')?.addEventListener('change',renderRoads);$('roadGps')?.addEventListener('click',gpsRoad);$('googleTrafficBtn')?.addEventListener('click',googleTraffic);$('marketSearch')?.addEventListener('click',loadMarkets);$('marketZone')?.addEventListener('change',loadMarkets);$('freightCalc')?.addEventListener('click',estimateFreight);hookNavigation();
  const agriBtn=document.querySelector('[data-view="agriculture"]');agriBtn?.addEventListener('click',()=>setTimeout(loadMarkets,200));
  const mins=Math.max(5,+window.GSL_V14_CONFIG?.ROAD_REFRESH_MINUTES||10);setInterval(()=>{if(document.getElementById('roads')?.classList.contains('active'))loadRoads()},mins*60000);
}
document.addEventListener('DOMContentLoaded',bindV14);
})();
