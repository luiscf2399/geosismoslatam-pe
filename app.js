const $=id=>document.getElementById(id);
const PERU={minLat:-22.8,maxLat:1.5,minLon:-85.5,maxLon:-68};
const IGP='https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/SismosReportados/MapServer/0/query';
const IGP_LAST='https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/UltimoSismo/MapServer/0/query';
const USGS_DAY='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const USGS_WEEK='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';
const USGS_MONTH='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
const IMG='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const STREET='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const LABEL='https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
const DEP='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_departamental_simple.geojson';
const PROV='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_provincial_simple.geojson';
const DIST='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_distrital_simple.geojson';
const IGP_SOIL='https://ide.igp.gob.pe/arcgis/rest/services/cienciastierrasolida/EstudiosZonificacion/MapServer';
const INGEMMET_WMS='https://geocatmin.ingemmet.gob.pe/arcgis/services/SERV_GEOLOGIA/MapServer/WMSServer';
const peFmt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const clockFmt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit'});
let maps={},quakeLayer,histLayer,forecastHeat,forecastZones,riskWms,soilLayer;
let igp=[],usgs=[],catalog=[],mapWindow=24,initialized=false,seen=new Set(JSON.parse(localStorage.getItem('gsl5_seen')||'[]'));
let sound=false,audioCtx=null,forecastHours=24,forecastTimer=0,adminLayers={},boundsData={};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pe=t=>{try{return peFmt.format(new Date(t))}catch{return'—'}};
const color=m=>m>=6?'#df3e3e':m>=4.5?'#f2a51a':'#35a769';
async function get(url,timeout=12000){const c=new AbortController(),to=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw Error(String(r.status));return await r.json()}finally{clearTimeout(to)}}
function inPeru(f){const [x,y]=f.geometry.coordinates;return y>=PERU.minLat&&y<=PERU.maxLat&&x>=PERU.minLon&&x<=PERU.maxLon}
function hav(a,b,c,d){const R=6371,p=Math.PI/180,da=(c-a)*p,db=(d-b)*p,A=Math.sin(da/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(db/2)**2;return 2*R*Math.asin(Math.sqrt(A))}
function parseIGPTime(p){
  const raw=p.fechaevento??p.fecha;
  if(typeof raw==='number'&&raw>1e11){
    let d=new Date(raw), y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,'0'),day=String(d.getUTCDate()).padStart(2,'0'),h=String(p.hora||'00:00:00').trim();
    if(/^\d{1,2}:\d{2}/.test(h)){let [hh,mm,ss='00']=h.split(':');let t=Date.parse(`${y}-${m}-${day}T${String(hh).padStart(2,'0')}:${mm}:${ss}-05:00`);if(Number.isFinite(t))return t}
    return raw;
  }
  if(typeof raw==='string'){const t=Date.parse(raw);if(Number.isFinite(t))return t}
  return 0;
}
function normIGP(j){
  return (j?.features||[]).map((f,i)=>{
    const p=f.properties||f.attributes||{},g=f.geometry||{},c=Array.isArray(g.coordinates)?g.coordinates:[g.x??p.lon,g.y??p.lat],t=parseIGPTime(p);
    const mag=Number(p.magnitud??p.mag??0),depth=Number(p.prof??0);
    return {type:'Feature',id:`IGP-${p.code||p.objectid||i}-${t}`,geometry:{type:'Point',coordinates:[Number(c[0]),Number(c[1]),depth]},properties:{source:'IGP',mag,time:t,place:p.ref||p.departamento||'Perú',department:p.departamento||'',intensity:p.int_||'',code:p.code||'',url:p.reporte?`https://ultimosismo.igp.gob.pe/evento/${p.code||''}`:'https://ultimosismo.igp.gob.pe/'}};
  }).filter(f=>Number.isFinite(f.geometry.coordinates[0])&&Number.isFinite(f.geometry.coordinates[1])&&f.properties.time);
}
function normUSGS(j){return (j?.features||[]).filter(inPeru).map(f=>{const c=f.geometry.coordinates,p=f.properties;return {type:'Feature',id:'USGS-'+f.id,geometry:{type:'Point',coordinates:[+c[0],+c[1],+c[2]||0]},properties:{source:'USGS',mag:+p.mag||0,time:+p.time||0,place:p.place||'Perú',magType:p.magType||'',url:p.url||'https://earthquake.usgs.gov/'}}})}
async function fetchIGP(){
  const q=new URLSearchParams({where:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',orderByFields:'fechaevento DESC',resultRecordCount:'2000',f:'geojson'});
  try{return normIGP(await get(`${IGP}?${q}`))}
  catch(e){
    const q2=new URLSearchParams({where:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',orderByFields:'fechaevento DESC',resultRecordCount:'2000',f:'json'});
    return normIGP(await get(`${IGP}?${q2}`));
  }
}
function merge(){
  const used=new Set(),out=[];
  for(const a of [...igp].sort((x,y)=>y.properties.time-x.properties.time)){
    let best=-1,bd=1e9;
    usgs.forEach((b,i)=>{if(used.has(i))return;const dt=Math.abs(a.properties.time-b.properties.time)/1000,d=hav(a.geometry.coordinates[1],a.geometry.coordinates[0],b.geometry.coordinates[1],b.geometry.coordinates[0]);if(dt<180&&d<80&&d<bd){best=i;bd=d}});
    if(best>=0){const b=usgs[best];used.add(best);out.push({...a,properties:{...a.properties,source:'IGP+USGS',usgsMag:b.properties.mag,usgsUrl:b.properties.url,usgsMagType:b.properties.magType}})} else out.push(a)
  }
  usgs.forEach((b,i)=>{if(!used.has(i))out.push(b)});
  catalog=out.sort((a,b)=>b.properties.time-a.properties.time);
}
function icon(f,last=false){const m=+f.properties.mag||0,s=Math.max(24,Math.min(42,22+m*2.2));return L.divIcon({className:`gsl ${last?'latest':''}`,html:`<div class="p" style="width:${s}px;height:${s}px;background:${color(m)}">M${m.toFixed(1)}</div>`,iconSize:[s,s],iconAnchor:[s/2,s/2]})}
function popup(f){const p=f.properties,[x,y,d=0]=f.geometry.coordinates;return `<div class="popup"><div class="pt" style="border-left-color:${color(p.mag)}"><b>M ${(+p.mag||0).toFixed(1)}</b><span>${esc(p.source==='IGP+USGS'?'IGP + USGS':p.source==='IGP'?'IGP/CENSIS':'USGS')}</span></div><div class="place">${esc(p.place||'Perú')}</div><div class="pg"><span>Fecha / hora Perú</span><b>${pe(p.time)}</b><span>Profundidad</span><b>${(+d).toFixed(0)} km</b><span>Coordenadas</span><b>${y.toFixed(3)}, ${x.toFixed(3)}</b>${p.intensity?`<span>Intensidad IGP</span><b>${esc(p.intensity)}</b>`:''}${p.code?`<span>Código IGP</span><b>${esc(p.code)}</b>`:''}${p.usgsMag?`<span>USGS</span><b>M ${(+p.usgsMag).toFixed(1)} ${esc(p.usgsMagType||'')}</b>`:''}</div><div class="pa">${p.source!=='USGS'?`<a target="_blank" href="${esc(p.url)}">IGP ↗</a>`:''}${p.usgsUrl||p.source==='USGS'?`<a target="_blank" href="${esc(p.usgsUrl||p.url)}">USGS ↗</a>`:''}</div></div>`}
function mkMap(id){const m=L.map(id,{minZoom:4,maxZoom:18,zoomControl:true}).setView([-9.3,-75.1],5);m._img=L.tileLayer(IMG,{maxZoom:18,attribution:'Esri'}).addTo(m);m._labels=L.tileLayer(LABEL,{subdomains:'abcd',maxZoom:20,opacity:.95}).addTo(m);return m}
async function initMapData(){
  try{boundsData.dep=await get(DEP);adminLayers.dep=L.geoJSON(boundsData.dep,{style:{color:'#f2da75',weight:1.1,fillOpacity:0},interactive:false}).addTo(maps.map)}catch{}
  try{boundsData.prov=await get(PROV);adminLayers.prov=L.geoJSON(boundsData.prov,{style:{color:'#d5e2e9',weight:.45,fillOpacity:0},interactive:false}).addTo(maps.map)}catch{}
}
async function ensureDistrict(){if(adminLayers.dist)return;try{boundsData.dist=await get(DIST);adminLayers.dist=L.geoJSON(boundsData.dist,{style:{color:'#c8d7df',weight:.3,fillOpacity:0},interactive:false}).addTo(maps.map)}catch{}}
function initMaps(){
  maps.map=mkMap('map');quakeLayer=L.layerGroup().addTo(maps.map);
  maps.historyMap=mkMap('historyMap');histLayer=L.layerGroup().addTo(maps.historyMap);
  maps.forecastMap=mkMap('forecastMap');forecastZones=L.layerGroup().addTo(maps.forecastMap);
  maps.rainMap=mkMap('rainMap');
  maps.riskMap=mkMap('riskMap');
  maps.soilMap=mkMap('soilMap');
  Object.values(maps).forEach(m=>m.fitBounds([[-20.5,-82.5],[-2,-68]],{padding:[8,8]}));
  initMapData();
  try{
    soilLayer=L.esri.dynamicMapLayer({url:IGP_SOIL,layers:[9],opacity:.72,useCors:true}).addTo(maps.soilMap);
  }catch(e){}
}
function currentEvents(){const cut=Date.now()-mapWindow*3600000,min=+$('minMag').value;return catalog.filter(f=>f.properties.time>=cut&&(+f.properties.mag||0)>=min)}
function renderMonitor(){
  const d=currentEvents();quakeLayer.clearLayers();
  d.forEach((f,i)=>{const c=f.geometry.coordinates;L.marker([c[1],c[0]],{icon:icon(f,i===0)}).bindPopup(popup(f),{maxWidth:350}).addTo(quakeLayer)});
  $('count').textContent=d.length;
  $('recentList').innerHTML=d.slice(0,14).map((f,i)=>{const p=f.properties;return `<div class="quake-item" data-q="${i}"><div class="m" style="background:${color(p.mag)}">M ${(+p.mag||0).toFixed(1)}</div><div class="where"><b>${esc(p.place)}</b><small>${p.source==='IGP'?'IGP/CENSIS':p.source==='IGP+USGS'?'IGP + USGS':'USGS'}</small></div><time>${new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'}).format(new Date(p.time))}</time></div>`}).join('')||'<div class="loading">No hay eventos visibles con este filtro.</div>';
  document.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>{const f=d[+x.dataset.q],c=f.geometry.coordinates;maps.map.flyTo([c[1],c[0]],8);L.popup().setLatLng([c[1],c[0]]).setContent(popup(f)).openOn(maps.map)});
  renderLatest();
}
function renderLatest(){const f=[...igp].sort((a,b)=>b.properties.time-a.properties.time)[0]||catalog[0];if(!f)return;const p=f.properties,[x,y,d=0]=f.geometry.coordinates;$('latestMag').textContent=`M ${(+p.mag||0).toFixed(1)}`;$('latestMag').style.color=color(p.mag);$('latestPlace').textContent=p.place||'Perú';$('latestTime').textContent=pe(p.time);$('latestDepth').textContent=`${(+d).toFixed(0)} km`;$('latestIntensity').textContent=p.intensity||'—';$('latestCoords').textContent=`${y.toFixed(2)}, ${x.toFixed(2)}`;$('latestCode').textContent=p.code||'—';$('latestLink').href=p.url||'https://ultimosismo.igp.gob.pe/'}
function renderHistory(){
  const days=$('histDays').value,src=$('histSource').value,min=+$('histMag').value,q=$('histSearch').value.toLowerCase();let d=[...catalog];
  if(days!=='all')d=d.filter(f=>f.properties.time>=Date.now()-(+days)*86400000);
  if(src!=='all')d=d.filter(f=>f.properties.source.includes(src));
  d=d.filter(f=>(+f.properties.mag||0)>=min&&(!q||(f.properties.place||'').toLowerCase().includes(q)||(f.properties.code||'').toLowerCase().includes(q)));
  histLayer.clearLayers();d.slice(0,1000).forEach(f=>{const c=f.geometry.coordinates;L.marker([c[1],c[0]],{icon:icon(f)}).bindPopup(popup(f)).addTo(histLayer)});
  $('histRows').innerHTML=d.slice(0,1000).map(f=>{const p=f.properties,z=f.geometry.coordinates[2]||0;return `<tr><td>${pe(p.time)}</td><td>${esc(p.source)}</td><td><b style="color:${color(p.mag)}">M ${(+p.mag||0).toFixed(1)}</b></td><td>${(+z).toFixed(0)} km</td><td>${esc(p.place)}</td><td><a target="_blank" href="${esc(p.url||p.usgsUrl||'#')}">Abrir ↗</a></td></tr>`}).join('')||'<tr><td colspan="6">Sin eventos.</td></tr>';
}
function playAlert(){
  if(!sound)return;
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  const start=audioCtx.currentTime;
  for(let i=0;i<14;i++){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=i%2?740:520;g.gain.setValueAtTime(.0001,start+i*.5);g.gain.exponentialRampToValueAtTime(.18,start+i*.5+.03);g.gain.exponentialRampToValueAtTime(.0001,start+i*.5+.42);o.connect(g).connect(audioCtx.destination);o.start(start+i*.5);o.stop(start+i*.5+.45)}
}
function alertNew(){
  const fresh=catalog.filter(f=>Date.now()-f.properties.time<20*60*1000);
  if(!initialized){fresh.forEach(f=>seen.add(f.id));initialized=true;return}
  const n=fresh.find(f=>!seen.has(f.id));fresh.forEach(f=>seen.add(f.id));localStorage.setItem('gsl5_seen',JSON.stringify([...seen].slice(-800)));
  if(n){$('alertState').textContent=`NUEVO SISMO M ${(+n.properties.mag||0).toFixed(1)}`;$('alertState').style.background='#9c272a';playAlert();const c=n.geometry.coordinates;maps.map.flyTo([c[1],c[0]],8);setTimeout(()=>{$('alertState').textContent='SIN ALERTAS';$('alertState').style.background=''},12000)}
}
async function poll(){
  $('lastPoll').textContent='Consultando…';
  const results=await Promise.allSettled([fetchIGP(),get(USGS_DAY)]);
  if(results[0].status==='fulfilled'){igp=results[0].value;$('igpStatus').textContent='IGP CONECTADO';$('igpHealth').textContent='Operativo'}else{$('igpStatus').textContent='IGP SIN RESPUESTA';$('igpHealth').textContent='Sin respuesta'}
  if(results[1].status==='fulfilled'){usgs=normUSGS(results[1].value);$('usgsStatus').textContent='USGS CONECTADO';$('usgsHealth').textContent='Operativo'}else{$('usgsStatus').textContent='USGS SIN RESPUESTA';$('usgsHealth').textContent='Sin respuesta'}
  merge();renderMonitor();alertNew();$('lastPoll').textContent=clockFmt.format(new Date());$('updated').textContent='Actualizado: '+pe(Date.now());
  if(Date.now()-forecastTimer>30*60*1000){renderForecast();forecastTimer=Date.now()}
}
function localScore(events,lat,lon,h){
  let s=0,near=[];
  for(const f of events){const c=f.geometry.coordinates,m=Math.max(1,+f.properties.mag||0),age=(Date.now()-f.properties.time)/3600000;if(age<0||age>h*3)continue;const d=hav(lat,lon,c[1],c[0]);const temporal=Math.pow(age+2,-1.05),spatial=Math.exp(-d/90),product=Math.pow(10,.32*Math.max(0,m-3));const w=temporal*spatial*product;s+=w;if(d<120)near.push(m)}
  return {s,near}
}
function renderForecast(){
  if(!maps.forecastMap||!catalog.length)return;const events=catalog.filter(f=>f.properties.time>=Date.now()-Math.max(forecastHours,720)*3600000);
  const pts=[],cells=[];for(let lat=-19.5;lat<=-3;lat+=.45){for(let lon=-81.8;lon<=-69.3;lon+=.45){const r=localScore(events,lat,lon,forecastHours);if(r.s>0.0002)cells.push({lat,lon,score:r.s,near:r.near})}}
  const max=Math.max(...cells.map(x=>x.score),.0001);cells.forEach(c=>pts.push([c.lat,c.lon,Math.min(1,c.score/max)]));
  if(forecastHeat)maps.forecastMap.removeLayer(forecastHeat);forecastHeat=L.heatLayer(pts,{radius:28,blur:24,maxZoom:8,minOpacity:.12,gradient:{0.15:'#1e6fa5',0.35:'#2dac69',0.55:'#e4d233',0.75:'#f08a19',1:'#d52d2d'}}).addTo(maps.forecastMap);
  forecastZones.clearLayers();const top=[...cells].sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.slice(0,i).every(x=>hav(c.lat,c.lon,x.lat,x.lon)>150)).slice(0,4);
  $('zoneCards').innerHTML=top.map((c,i)=>{const ratio=Math.round(c.score/max*100),ms=c.near.sort((a,b)=>a-b),lo=ms.length?ms[Math.floor(ms.length*.25)]:0,hi=ms.length?ms[Math.min(ms.length-1,Math.floor(ms.length*.8))]:0;return `<div class="zone" data-z="${i}"><div class="zonehead"><h4>Zona ${i+1}</h4><span class="level">${ratio>=75?'MUY ALTA':ratio>=50?'ALTA':ratio>=25?'MODERADA':'BAJA'}</span></div><p>Índice relativo: <b>${ratio}/100</b></p><p>Magnitud observada de referencia: <b>${lo?`M ${lo.toFixed(1)}–${hi.toFixed(1)}`:'—'}</b></p><p>Centro analítico: ${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}</p></div>`}).join('')||'<div class="loading">Actividad insuficiente para destacar zonas.</div>';
  top.forEach((c,i)=>L.circle([c.lat,c.lon],{radius:42000,color:'#fff',weight:1,fillColor:'#ff8a20',fillOpacity:.08,dashArray:'4,5'}).bindTooltip(`Zona ${i+1}`).addTo(forecastZones));
  document.querySelectorAll('[data-z]').forEach(x=>x.onclick=()=>{const c=top[+x.dataset.z];maps.forecastMap.flyTo([c.lat,c.lon],7)});
  $('projEvents').textContent=events.length;$('projTime').textContent=clockFmt.format(new Date());
}
function initRisk(){
  try{riskWms=L.tileLayer.wms(INGEMMET_WMS,{layers:'0',format:'image/png',transparent:true,opacity:.58,attribution:'INGEMMET'}).addTo(maps.riskMap)}catch(e){}
}
function setSoilLayer(id){
  try{if(soilLayer)maps.soilMap.removeLayer(soilLayer);soilLayer=L.esri.dynamicMapLayer({url:IGP_SOIL,layers:[+id],opacity:.72,useCors:true}).addTo(maps.soilMap)}catch(e){}
}
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.mainnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  setTimeout(()=>{if(maps[id+'Map'])maps[id+'Map'].invalidateSize();if(id==='monitor')maps.map.invalidateSize();if(id==='forecast'){maps.forecastMap.invalidateSize();renderForecast()}if(id==='risk'){maps.riskMap.invalidateSize();if(!riskWms)initRisk()}if(id==='soil')maps.soilMap.invalidateSize();if(id==='rain')maps.rainMap.invalidateSize()},120);
}
function bind(){
  document.querySelectorAll('.mainnav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $('soundBtn').onclick=async()=>{sound=!sound;if(sound&&!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();$('soundBtn').textContent=sound?'🔊 ALERTAS ACTIVAS':'🔇 ACTIVAR ALERTAS'};
  document.querySelectorAll('[data-window]').forEach(b=>b.onclick=()=>{mapWindow=+b.dataset.window;document.querySelectorAll('[data-window]').forEach(x=>x.classList.toggle('active',x===b));renderMonitor()});
  $('minMag').oninput=()=>{$('minMagVal').textContent=(+$('minMag').value).toFixed(1);renderMonitor()};
  $('sat').onchange=e=>e.target.checked?maps.map._img.addTo(maps.map):maps.map.removeLayer(maps.map._img);
  $('labels').onchange=e=>e.target.checked?maps.map._labels.addTo(maps.map):maps.map.removeLayer(maps.map._labels);
  $('deps').onchange=e=>{if(adminLayers.dep)e.target.checked?adminLayers.dep.addTo(maps.map):maps.map.removeLayer(adminLayers.dep)};
  $('provs').onchange=e=>{if(adminLayers.prov)e.target.checked?adminLayers.prov.addTo(maps.map):maps.map.removeLayer(adminLayers.prov)};
  $('dists').onchange=async e=>{if(e.target.checked){await ensureDistrict();if(adminLayers.dist)adminLayers.dist.addTo(maps.map)}else if(adminLayers.dist)maps.map.removeLayer(adminLayers.dist)};
  $('historyBtn').onclick=()=>{$('historyDrawer').classList.add('open');setTimeout(()=>maps.historyMap.invalidateSize(),120);renderHistory()};
  $('closeHistory').onclick=()=>$('historyDrawer').classList.remove('open');$('runHistory').onclick=renderHistory;
  document.querySelectorAll('#forecastRange button').forEach(b=>b.onclick=()=>{forecastHours=+b.dataset.h;document.querySelectorAll('#forecastRange button').forEach(x=>x.classList.toggle('active',x===b));renderForecast()});
  document.querySelectorAll('.soil-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.soil-tabs button').forEach(x=>x.classList.toggle('active',x===b));setSoilLayer(b.dataset.soil)});
  $('riskOff').onclick=()=>{if(riskWms){maps.riskMap.removeLayer(riskWms);riskWms=null}};
  $('riskMass').onclick=()=>{if(!riskWms)initRisk()};
}
function renderNews(){
  $('newsFeed').innerHTML=[
    ['IGP / CENSIS','Últimos sismos oficiales del Perú','Consulta la información oficial de los eventos sísmicos reportados por el Centro Sismológico Nacional.','https://ultimosismo.igp.gob.pe/'],
    ['SENAMHI','Avisos meteorológicos nacionales','Revisa avisos preventivos, niveles de peligrosidad y pronósticos oficiales.','https://www.senamhi.gob.pe/?p=aviso-meteorologico'],
    ['CENEPRED / SIGRID','Escenarios y estudios de riesgo','Mapas, evaluaciones y documentos técnicos para la gestión del riesgo de desastres.','https://sigrid4.cenepred.gob.pe/']
  ].map(x=>`<article class="news-card"><span class="official-chip">${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p><a target="_blank" rel="noopener" href="${x[3]}">ABRIR FUENTE OFICIAL ↗</a></article>`).join('');
}
function tick(){ $('clock').textContent=clockFmt.format(new Date()) }
document.addEventListener('DOMContentLoaded',()=>{
  initMaps();bind();renderNews();initRisk();tick();setInterval(tick,1000);poll();setInterval(poll,10000);
  setTimeout(()=>renderForecast(),2500);
});