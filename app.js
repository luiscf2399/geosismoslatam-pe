
const $=id=>document.getElementById(id);
const FEEDS={
 day:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
 week:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
 month:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson'
};
const FAST_FEED='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const ALERT_POLL_MS=60*1000;
const seenEventIds=new Set(JSON.parse(localStorage.getItem('geosismos_seen_ids')||'[]'));
let fastCheckRunning=false;
let selectedQuake=null;
const PERU={minLat:-20.6,maxLat:.5,minLon:-82,maxLon:-68};
const esriImageryUrl='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const esriStreetUrl='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const depUrl='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_departamental_simple.geojson';
const provUrl='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_provincial_simple.geojson';
const distUrl='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_distrital_simple.geojson';

let actualMap=L.map('actualMap',{zoomControl:true,minZoom:4,maxZoom:12}).setView([-9.2,-75.2],5);
let forecastMap=L.map('forecastMap',{zoomControl:true,minZoom:4,maxZoom:12}).setView([-9.2,-75.2],5);
let satA=L.tileLayer(esriImageryUrl,{maxZoom:19,attribution:'Tiles © Esri'}).addTo(actualMap);
let satF=L.tileLayer(esriImageryUrl,{maxZoom:19,attribution:'Tiles © Esri'}).addTo(forecastMap);
let osmA=L.tileLayer(esriStreetUrl,{maxZoom:19,attribution:'Tiles © Esri'});
let osmF=L.tileLayer(esriStreetUrl,{maxZoom:19,attribution:'Tiles © Esri'});
let quakeLayers=[L.layerGroup().addTo(actualMap),L.layerGroup().addTo(forecastMap)];
let forecastLayer=L.layerGroup().addTo(forecastMap);
let borderLayers={dep:[],prov:[],dist:[]};
let geoData={dep:null,prov:null,dist:null};
let currentFeatures=[],allData=null,selected={dep:'',prov:'',dist:'',ubigeo:''};
let magChart,trendChart,depthChart;

const adminPE=window.PERU_UBIGEO_2025||{};

function populateDepartments(){
 $('regionSelect').innerHTML='<option value="">Seleccionar</option>';
 Object.entries(adminPE).sort((a,b)=>a[1].name.localeCompare(b[1].name,'es')).forEach(([code,o])=>{
   $('regionSelect').insertAdjacentHTML('beforeend',`<option value="${code}">${o.name}</option>`);
 });
}
function populateProvinces(){
 const d=$('regionSelect').value; $('provinceSelect').innerHTML='<option value="">Seleccionar</option>'; $('districtSelect').innerHTML='<option value="">Seleccionar</option>';
 $('districtSelect').disabled=true; $('ubigeoTxt').textContent=d||'—'; selected={dep:d,prov:'',dist:'',ubigeo:d};
 const obj=adminPE[d]; if(!obj){$('provinceSelect').disabled=true;return}
 Object.entries(obj.provinces).sort((a,b)=>a[1].name.localeCompare(b[1].name,'es')).forEach(([code,o])=>$('provinceSelect').insertAdjacentHTML('beforeend',`<option value="${code}">${o.name}</option>`));
 $('provinceSelect').disabled=false;
}
function populateDistricts(){
 const d=$('regionSelect').value,p=$('provinceSelect').value; $('districtSelect').innerHTML='<option value="">Seleccionar</option>';
 const obj=adminPE[d]?.provinces?.[p]; selected={dep:d,prov:p,dist:'',ubigeo:p}; $('ubigeoTxt').textContent=p||d||'—';
 if(!obj){$('districtSelect').disabled=true;return}
 Object.entries(obj.districts).sort((a,b)=>a[1].localeCompare(b[1],'es')).forEach(([code,name])=>$('districtSelect').insertAdjacentHTML('beforeend',`<option value="${code}">${name}</option>`));
 $('districtSelect').disabled=false;
}
function currentNames(){
 const d=adminPE[selected.dep],p=d?.provinces?.[selected.prov],dist=p?.districts?.[selected.dist];
 return {dep:d?.name||'',prov:p?.name||'',dist:dist||''};
}
async function geocodeSelected(){
 const n=currentNames(); const parts=[n.dist,n.prov,n.dep,'Perú'].filter(Boolean);
 if(!parts.length)return;
 try{
  const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=pe&limit=1&q=${encodeURIComponent(parts.join(', '))}`);
  const j=await r.json(); if(j[0]){const c=[+j[0].lat,+j[0].lon],z=n.dist?10:n.prov?7:6;actualMap.flyTo(c,z);forecastMap.flyTo(c,z);$('analysisArea').textContent=parts[0]}
 }catch(e){}
}

async function loadBoundaries(){
 for(const [key,url] of Object.entries({dep:depUrl,prov:provUrl})){
  try{geoData[key]=await (await fetch(url)).json();renderBoundary(key)}catch(e){console.warn(key,e)}
 }
 // distrital se carga solo si se solicita para reducir tráfico
}
async function ensureDistricts(){
 if(geoData.dist){renderBoundary('dist');return}
 try{geoData.dist=await (await fetch(distUrl)).json();renderBoundary('dist')}catch(e){console.warn(e)}
}
function renderBoundary(type){
 if(!geoData[type])return;
 borderLayers[type].forEach(l=>{actualMap.removeLayer(l);forecastMap.removeLayer(l)}); borderLayers[type]=[];
 const styles={
   dep:{color:'#ffd21f',weight:2,fillOpacity:0},
   prov:{color:'#ffffff',weight:.8,opacity:.75,fillOpacity:0},
   dist:{color:'#5ee3ff',weight:.45,opacity:.55,fillOpacity:0}
 };
 [actualMap,forecastMap].forEach(m=>{
   const layer=L.geoJSON(geoData[type],{style:styles[type]}).addTo(m);
   borderLayers[type].push(layer);
 });
}
function setBoundaryVisible(type,on){
 borderLayers[type].forEach((l,i)=>{const m=i===0?actualMap:forecastMap;if(on){if(!m.hasLayer(l))l.addTo(m)}else if(m.hasLayer(l))m.removeLayer(l)});
}
function drawSeaLimit(){
 const pts=[[0,-82.5],[-4,-83],[-8,-82.6],[-12,-81.7],[-16,-79.6],[-20,-77.6]];
 [actualMap,forecastMap].forEach(m=>L.polyline(pts,{color:'#63c8ff',weight:2,dashArray:'9 7',opacity:.9}).bindTooltip('Límite marítimo 200 millas — representación referencial').addTo(m));
}
function inPeru(f){
 const [lon,lat]=f.geometry.coordinates; return lat>=PERU.minLat&&lat<=PERU.maxLat&&lon>=PERU.minLon&&lon<=PERU.maxLon;
}
function depthOk(dep){
 const v=$('depthSelect').value;
 return v==='all'||(v==='shallow'&&dep<70)||(v==='mid'&&dep>=70&&dep<=300)||(v==='deep'&&dep>300);
}

function localPE(ms){return new Date(ms).toLocaleString('es-PE',{timeZone:'America/Lima'})}
function alertLevel(m){return m>=6?'ALERTA IMPORTANTE':m>=4.5?'ALERTA SÍSMICA':'SISMO REGISTRADO'}
function eventStatus(f){return (f.properties.status||'automatic').toLowerCase()==='reviewed'?'REVISADO':'PRELIMINAR'}
function quakeFingerprint(f){return f.id||`${Math.round(f.properties.time/1000)}-${f.geometry.coordinates[0].toFixed(2)}-${f.geometry.coordinates[1].toFixed(2)}`}
function persistSeen(){
  try{localStorage.setItem('geosismos_seen_ids',JSON.stringify([...seenEventIds].slice(-300)))}catch(e){}
}
function notifyQuake(f){
  const m=f.properties.mag??0, place=f.properties.place||'Perú', dep=f.geometry.coordinates[2]??0;
  $('tickerText').textContent=`${alertLevel(m)} · M ${m.toFixed(1)} ${f.properties.magType||''} · ${place} · Prof. ${dep.toFixed(0)} km · ${localPE(f.properties.time)}`;
  if('Notification' in window && Notification.permission==='granted' && document.hidden){
    try{new Notification(`GeoSismosLatam · M ${m.toFixed(1)}`,{body:`${place} · ${dep.toFixed(0)} km · ${eventStatus(f)}`,icon:'logo.svg'})}catch(e){}
  }
}
async function fastAlertCheck(){
  if(fastCheckRunning)return;
  fastCheckRunning=true;
  try{
    const r=await fetch(`${FAST_FEED}?t=${Date.now()}`,{cache:'no-store'});
    const j=await r.json();
    const pe=(j.features||[]).filter(inPeru).sort((a,b)=>b.properties.time-a.properties.time);
    for(const f of pe){
      const id=quakeFingerprint(f);
      if(!seenEventIds.has(id)){
        seenEventIds.add(id); persistSeen(); notifyQuake(f);
        // Actualiza el visor completo sin bloquear la primera alerta.
        loadQuakes();
        break;
      }
    }
  }catch(e){console.warn('fastAlertCheck',e)}
  finally{fastCheckRunning=false}
}
function requestBrowserAlerts(){
  if(!('Notification' in window)||Notification.permission!=='default')return;
  // El permiso se solicita solo tras interacción del usuario para respetar políticas del navegador.
  const once=()=>{Notification.requestPermission().catch(()=>{});document.removeEventListener('click',once)};
  document.addEventListener('click',once,{once:true});
}
function sourceLink(url,label){
  return url?`<a class="source-link" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`:'';
}
function webSearchLink(f){
  const place=(f.properties.place||'Perú').replace(/\d+\s*km.*?of\s*/i,'');
  const q=encodeURIComponent(`sismo terremoto ${place} Perú`);
  return `https://www.google.com/search?tbm=nws&q=${q}`;
}
function imageSearchLink(f){
  const place=(f.properties.place||'Perú').replace(/\d+\s*km.*?of\s*/i,'');
  const q=encodeURIComponent(`sismo ${place} Perú`);
  return `https://www.google.com/search?tbm=isch&q=${q}`;
}
function renderCoverage(f){
  const box=$('coverageBody'), status=$('coverageStatus');
  if(!box||!status)return;
  const m=f.properties.mag??0, usgs=f.properties.url||'https://earthquake.usgs.gov/earthquakes/map/';
  status.textContent=`M ${m.toFixed(1)} · seguimiento`;
  box.innerHTML=`<div class="coverage-grid">
    <div class="coverage-item official"><b>IGP / CENSIS</b><span>Fuente oficial de información sísmica del Perú.</span>${sourceLink('https://ultimosismo.igp.gob.pe/ultimo-sismo','Abrir último reporte IGP')}</div>
    <div class="coverage-item"><b>USGS</b><span>Magnitud y solución instrumental internacional del evento.</span>${sourceLink(usgs,'Abrir evento USGS')}</div>
    <div class="coverage-item"><b>Noticias relacionadas</b><span>Búsqueda web externa. Verificar fuente y fecha antes de compartir.</span>${sourceLink(webSearchLink(f),'Buscar cobertura reciente')}</div>
    <div class="coverage-item"><b>Fotografías públicas</b><span>Resultados externos; una imagen no implica verificación del hecho.</span>${sourceLink(imageSearchLink(f),'Buscar fotografías')}</div>
  </div>
  <div class="report-note"><b>Verificación:</b> GeoSismosLatam separa datos sísmicos de reportes web. Daños, fotografías y testimonios deben considerarse no confirmados hasta existir comunicado de una autoridad competente.</div>`;
}

async function loadQuakes(){
 $('liveStatus').textContent='Actualizando…';
 try{
  const r=await fetch(FEEDS[$('windowSelect').value],{cache:'no-store'}); allData=await r.json();
  currentFeatures=allData.features.filter(f=>inPeru(f)&&(f.properties.mag??0)>=+$('minMag').value&&depthOk(f.geometry.coordinates[2]??0));
  renderQuakes(); renderForecast(); renderTable(); renderStats();
  $('lastUpdate').textContent=new Date(allData.metadata.generated).toLocaleString('es-PE');
  $('liveStatus').textContent='Actualización automática';
  const last=[...currentFeatures].sort((a,b)=>b.properties.time-a.properties.time)[0];
  if(last)$('tickerText').textContent=`Último evento: M ${(last.properties.mag??0).toFixed(1)} · ${last.properties.place||'Perú'} · ${localPE(last.properties.time)}`;
 }catch(e){$('liveStatus').textContent='Sin conexión'; console.error(e)}
}
function magColor(m){return m>=6?'#e41618':m>=5?'#ff5114':m>=4?'#ff9f00':m>=3?'#f6db17':'#4bbf65'}
function renderQuakes(){
 quakeLayers.forEach(g=>g.clearLayers()); if(!$('quakeToggle').checked)return;
 currentFeatures.forEach(f=>{
  const [lon,lat,dep]=f.geometry.coordinates,m=f.properties.mag??0;
  const mk=L.circleMarker([lat,lon],{radius:Math.max(4,m*1.55),color:'#fff',weight:.5,fillColor:magColor(m),fillOpacity:.9});
  mk.on('click',()=>showQuakeReport(f));
  mk.bindTooltip(`M ${m.toFixed(1)} · ${dep.toFixed(0)} km`);
  mk.addTo(quakeLayers[0]);
 });
}
function renderForecast(){
 forecastLayer.clearLayers(); if(!currentFeatures.length)return;
 const cells=new Map();
 currentFeatures.forEach(f=>{
  const [lon,lat,dep]=f.geometry.coordinates,m=f.properties.mag??0;
  const step=1.25,k=`${Math.floor(lat/step)*step}|${Math.floor(lon/step)*step}`;
  if(!cells.has(k))cells.set(k,{lat:Math.floor(lat/step)*step,lon:Math.floor(lon/step)*step,score:0,events:[],max:0,depths:[]});
  const c=cells.get(k),age=(Date.now()-f.properties.time)/864e5,rec=Math.exp(-age/6),mw=Math.pow(10,.26*Math.max(0,m-3));
  c.score+=rec*mw*(dep<70?1.12:dep<300?.9:.7);c.events.push(f);c.max=Math.max(c.max,m);c.depths.push(dep);
 });
 const arr=[...cells.values()].sort((a,b)=>b.score-a.score).slice(0,18),maxScore=Math.max(...arr.map(x=>x.score),1);
 arr.forEach((c,idx)=>{
   const rel=c.score/maxScore,prob=Math.min(.35,.015+rel*.22),radius=35000+rel*70000;
   const col=rel>.72?'#e0201d':rel>.45?'#ff7c12':rel>.2?'#ffd832':'#51bf63';
   const circle=L.circle([c.lat+.625,c.lon+.625],{radius,color:col,weight:2,fillColor:col,fillOpacity:.28}).addTo(forecastLayer);
   circle.on('click',()=>showForecastReport(c,prob,rel));
   if(idx<6)L.circleMarker([c.lat+.625,c.lon+.625],{radius:7,color:'#fff',weight:2,fillColor:col,fillOpacity:1}).addTo(forecastLayer);
 });
}
function showQuakeReport(f){
 $('tabQuake').classList.add('active');$('tabForecast').classList.remove('active');
 const [lon,lat,dep]=f.geometry.coordinates,m=f.properties.mag??0;
 selectedQuake=f;
 $('reportBody').innerHTML=`<div class="report-card"><div class="headline">${alertLevel(m)}</div>
 <div class="metric"><span>Ubicación</span><b>${f.properties.place||'Perú'}</b></div>
 <div class="metric"><span>Magnitud preferente</span><b>M ${m.toFixed(1)} ${f.properties.magType||''} · USGS</b></div>
 <div class="metric"><span>Estado USGS</span><b>${eventStatus(f)}</b></div>
 <div class="metric"><span>Profundidad</span><b>${dep.toFixed(0)} km</b></div>
 <div class="metric"><span>Coordenadas</span><b>${lat.toFixed(3)}, ${lon.toFixed(3)}</b></div>
 <div class="metric"><span>Fecha / hora Perú</span><b>${localPE(f.properties.time)}</b></div>
 <div class="metric"><span>Referencia oficial Perú</span><b>IGP/CENSIS</b></div>
 <div class="source-actions">${sourceLink(f.properties.url,'Ver evento USGS')} ${sourceLink('https://ultimosismo.igp.gob.pe/ultimo-sismo','Ver IGP/CENSIS')}</div>
 <div class="report-note">IGP/CENSIS es la fuente oficial del Estado peruano. GeoSismosLatam usa USGS para mostrar la magnitud reciente cuando el evento está disponible en su catálogo.</div></div>`;
 renderCoverage(f);
}
function showForecastReport(c,prob,rel){
 $('tabForecast').classList.add('active');$('tabQuake').classList.remove('active');
 const avgDepth=c.depths.reduce((a,b)=>a+b,0)/c.depths.length;
 const magLow=Math.max(3.5,c.max-.4),magHigh=Math.min(7.5,c.max+.8);
 const spatial=Math.round(45+(1-rel)*75);
 const hours=rel>.7?'12–72 horas':rel>.4?'2–7 días':'7–30 días';
 $('reportBody').innerHTML=`<div class="report-card"><div class="headline">ZONA DE MAYOR PROBABILIDAD RELATIVA</div>
 <div class="metric"><span>Centro estadístico</span><b>${(c.lat+.625).toFixed(2)}, ${(c.lon+.625).toFixed(2)}</b></div>
 <div class="metric"><span>Magnitud estadística orientativa</span><b>M ${magLow.toFixed(1)} – ${magHigh.toFixed(1)}</b></div>
 <div class="metric"><span>Probabilidad relativa del modelo</span><b><strong>${(prob*100).toFixed(1)}%</strong></b></div>
 <div class="metric"><span>Margen espacial aproximado</span><b>± ${spatial} km</b></div>
 <div class="metric"><span>Ventana temporal del modelo</span><b>${hours}</b></div>
 <div class="metric"><span>Profundidad media de eventos utilizados</span><b>${avgDepth.toFixed(0)} km</b></div>
 <div class="report-note"><b>Experimental.</b> El cálculo usa concentración, magnitud, profundidad y recencia. No predice un epicentro exacto ni garantiza que ocurra un sismo.</div></div>`;
}
function renderTable(){
 const tb=$('quakeTable');tb.innerHTML='';
 [...currentFeatures].sort((a,b)=>b.properties.time-a.properties.time).slice(0,50).forEach(f=>{
  const d=f.geometry.coordinates[2]??0,m=f.properties.mag??0,tr=document.createElement('tr');
  tr.innerHTML=`<td>${new Date(f.properties.time).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td><td><b style="color:${magColor(m)}">M ${m.toFixed(1)}</b></td><td>${d.toFixed(0)} km</td><td>${f.properties.place||'Perú'}</td>`;
  tr.onclick=()=>{actualMap.flyTo([f.geometry.coordinates[1],f.geometry.coordinates[0]],8);showQuakeReport(f)};tb.appendChild(tr);
 });
}
function countWindow(days){return currentFeatures.filter(f=>(Date.now()-f.properties.time)<=days*864e5).length}
function renderStats(){
 $('q24').textContent=countWindow(1);$('q7').textContent=countWindow(7);$('q30').textContent=countWindow(30);
 $('qmax').textContent=currentFeatures.length?'M '+Math.max(...currentFeatures.map(f=>f.properties.mag??0)).toFixed(1):'—';
 const bins=[0,0,0,0,0];currentFeatures.forEach(f=>{const m=f.properties.mag??0;if(m<3)bins[0]++;else if(m<4)bins[1]++;else if(m<5)bins[2]++;else if(m<6)bins[3]++;else bins[4]++});
 if(magChart)magChart.destroy(); magChart=new Chart($('magChart'),{type:'bar',data:{labels:['<3','3–4','4–5','5–6','≥6'],datasets:[{data:bins,backgroundColor:['#3aa8e8','#50b7e8','#f2c126','#ff7c17','#dd302a']}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}},responsive:true}});
 const sorted=[...currentFeatures].sort((a,b)=>a.properties.time-b.properties.time).slice(-20);
 if(trendChart)trendChart.destroy(); trendChart=new Chart($('trendChart'),{type:'line',data:{labels:sorted.map(f=>new Date(f.properties.time).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit'})),datasets:[{label:'Magnitud',data:sorted.map(f=>f.properties.mag??0),borderColor:'#e86f14',yAxisID:'y'},{label:'Prof. km',data:sorted.map(f=>f.geometry.coordinates[2]??0),borderColor:'#1c71c8',yAxisID:'y1'}]},options:{plugins:{legend:{display:false}},scales:{y:{position:'left'},y1:{position:'right',grid:{drawOnChartArea:false}}},responsive:true}});
 const shallow=currentFeatures.filter(f=>(f.geometry.coordinates[2]??0)<70).length,mid=currentFeatures.filter(f=>{const d=f.geometry.coordinates[2]??0;return d>=70&&d<=300}).length,deep=currentFeatures.filter(f=>(f.geometry.coordinates[2]??0)>300).length;
 if(depthChart)depthChart.destroy();depthChart=new Chart($('depthChart'),{type:'doughnut',data:{labels:['Superficial','Intermedia','Profunda'],datasets:[{data:[shallow,mid,deep],backgroundColor:['#f39b14','#1769be','#55a54d']}]},options:{plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:9}}}},responsive:true}});
 $('trendTag').textContent=currentFeatures.length>25?'Tendencia actual: ACTIVIDAD OBSERVADA SIGNIFICATIVA':'Tendencia actual: ACTIVIDAD OBSERVADA BAJA/MODERADA';
}

$('regionSelect').onchange=populateProvinces;$('provinceSelect').onchange=populateDistricts;
$('districtSelect').onchange=()=>{selected.dist=$('districtSelect').value;selected.ubigeo=selected.dist;$('ubigeoTxt').textContent=selected.dist||selected.prov||selected.dep||'—';geocodeSelected()};
$('locateAdmin').onclick=geocodeSelected;
$('windowSelect').onchange=loadQuakes;$('depthSelect').onchange=loadQuakes;$('refreshBtn').onclick=loadQuakes;
$('minMag').oninput=e=>{$('minMagTxt').textContent='M ≥ '+(+e.target.value).toFixed(1);loadQuakes()};
$('satToggle').onchange=e=>{[[actualMap,satA,osmA],[forecastMap,satF,osmF]].forEach(([m,s,o])=>{if(e.target.checked){if(m.hasLayer(o))m.removeLayer(o);s.addTo(m)}else{if(m.hasLayer(s))m.removeLayer(s);o.addTo(m)}})};
$('depToggle').onchange=e=>setBoundaryVisible('dep',e.target.checked);
$('provToggle').onchange=e=>setBoundaryVisible('prov',e.target.checked);
$('distToggle').onchange=async e=>{if(e.target.checked)await ensureDistricts();setBoundaryVisible('dist',e.target.checked)};
$('quakeToggle').onchange=renderQuakes;
$('tabQuake').onclick=()=>{$('tabQuake').classList.add('active');$('tabForecast').classList.remove('active')};
$('tabForecast').onclick=()=>{$('tabForecast').classList.add('active');$('tabQuake').classList.remove('active')};

populateDepartments();loadBoundaries();drawSeaLimit();loadQuakes();
requestBrowserAlerts();
fastAlertCheck();
setInterval(fastAlertCheck,ALERT_POLL_MS);
// Refresco completo menos frecuente; la detección de eventos nuevos corre cada 60 s.
setInterval(loadQuakes,5*60*1000);

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
