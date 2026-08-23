// GeoSismosLatam V12 · leyenda contextual por visor/capa/variable/horizonte/selección
const $=id=>document.getElementById(id);
const PERU={minLat:-22.8,maxLat:1.5,minLon:-85.5,maxLon:-68};
const API_QUAKES='/api/quakes';
const IMG='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const STREET='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const LABEL='https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
const DEP='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_departamental_simple.geojson';
const PROV='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_provincial_simple.geojson';
const DIST='https://raw.githubusercontent.com/orbisgeo/geojson-peru-data/master/peru_distrital_simple.geojson';
const IGP_SOIL='/api/arcgis/igp_zoning';
const SEN_JJA='/api/wms/sen_jja';
const SEN_AUG='/api/wms/sen_aug';
const SEN_NUM='/api/wms/sen_numeric';
const SEN_24H='/api/wms/sen_24h';
const SEN_Q='/api/wms/sen_quebradas';
const NASA_GIBS='https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';
const NASA_IMERG_LAYER='IMERG_Precipitation_Rate_30min';
const SEN_JJA_LAYER='g_03_02:03_02_001_03_000_512_0000_00_00';
const SEN_AUG_LAYER='g_05_02:05_02_008_03_001_512_0000_00_00';
const ING_MASS='/api/arcgis/risk_mass';
const ING_FLOOD='/api/arcgis/risk_flood';
const ING_HAZ='/api/arcgis/risk_hazards';
const IGP_GEO='/api/arcgis/igp_zoning';
const peFmt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const clockFmt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit'});
let maps={},quakeLayer,histLayer,forecastHeat,forecastZones,riskWms,soilLayer,rainLayer,marineLayer,riskDistrictLayer,agriDistrictLayer;
let igp=[],usgs=[],catalog=[],mapWindow=24,initialized=false,seen=new Set(JSON.parse(localStorage.getItem('gsl6_seen')||'[]'));
let currentRainMode='now', sigridData=null, selectedSound=localStorage.getItem('gsl_sound')||'sirena_emergencia';
let sound=false,audioCtx=null,forecastHours=24,forecastTimer=0,adminLayers={},boundsData={},historyCatalog=[],forecastCatalog=[],projectionMode='prob',selectedEventId=null,riskMode='hazards',emergencyData=null,enfenData=null,agriData=null,selectedAgriFeature=null;
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
async function ensureDistrict(){
  if(!boundsData.dist){try{boundsData.dist=await get(DIST,25000)}catch{return null}}
  if(!adminLayers.dist)adminLayers.dist=L.geoJSON(boundsData.dist,{style:{color:'#c8d7df',weight:.3,fillOpacity:0},interactive:false});
  if($('dists')?.checked&&!maps.map.hasLayer(adminLayers.dist))adminLayers.dist.addTo(maps.map);
  return boundsData.dist;
}
function initMaps(){
  maps.map=mkMap('map');quakeLayer=L.layerGroup().addTo(maps.map);
  maps.historyMap=mkMap('historyMap');histLayer=L.layerGroup().addTo(maps.historyMap);
  maps.forecastMap=mkMap('forecastMap');forecastZones=L.layerGroup().addTo(maps.forecastMap);
  maps.rainMap=mkMap('rainMap');
  maps.riskMap=mkMap('riskMap');
  maps.soilMap=mkMap('soilMap');
  maps.marineMap=mkMap('marineMap');
  maps.agriMap=mkMap('agriMap');
  Object.values(maps).forEach(m=>m.fitBounds([[-20.5,-82.5],[-2,-68]],{padding:[8,8]}));
  initMapData();
  try{
    soilLayer=L.esri.dynamicMapLayer({url:IGP_SOIL,layers:[9],opacity:.72,useCors:true}).addTo(maps.soilMap);
  }catch(e){}
}
function currentEvents(){const cut=Date.now()-mapWindow*3600000,min=+$('minMag').value;return catalog.filter(f=>f.properties.time>=cut&&(+f.properties.mag||0)>=min)}

function rangeForMag(m){
  m=+m||0;
  if(m>=6) return {key:'high',label:'M ≥ 6.0 · rango mayor'};
  if(m>=4.5) return {key:'medium',label:'M4.5–5.9 · rango moderado'};
  return {key:'low',label:'M < 4.5 · rango menor'};
}
function renderSelectedEvent(f){
  if(!f) return;
  selectedEventId=f.id;
  const p=f.properties||{}, c=f.geometry?.coordinates||[0,0,0];
  const [lon,lat,depth=0]=c;
  $('detailTitle').textContent=`M ${(+p.mag||0).toFixed(1)} · ${p.place||'Perú'}`;
  $('detailSourceBadge').textContent=p.source==='IGP+USGS'?'IGP/CENSIS + USGS':p.source==='IGP'?'IGP/CENSIS':'USGS';
  $('detailUpdated').textContent='Evento: '+pe(p.time);
  $('detailPlace').textContent=p.place||'—';
  $('detailTime').textContent=pe(p.time);
  $('detailCoords').textContent=`${(+lat).toFixed(3)}°, ${(+lon).toFixed(3)}°`;
  $('detailDepth').textContent=`${(+depth).toFixed(0)} km`;
  $('detailIntensity').textContent=p.intensity||'No reportada / no disponible';
  $('detailMagnitude').textContent=`M ${(+p.mag||0).toFixed(1)}${p.magType?' '+p.magType:''}`;
  $('detailOfficialLink').href=p.source==='USGS'?(p.url||'https://earthquake.usgs.gov/'):(p.url||'https://ultimosismo.igp.gob.pe/');
  const usgs=$('detailUSGSLink');
  const usgsUrl=p.usgsUrl || (p.source==='USGS'?p.url:'');
  if(usgsUrl){usgs.href=usgsUrl;usgs.classList.remove('hidden')}else usgs.classList.add('hidden');
  const rr=rangeForMag(p.mag);
  const mag=+p.mag||0;setContextLegend('monitor',{title:`Sismo seleccionado · M ${mag.toFixed(1)}`,situation:`Evento M ${mag.toFixed(1)} · ${p.place||'Perú'}`,variable:'Magnitud / profundidad / ubicación',unit:'M · km · coordenadas',horizon:'Evento reportado',source:p.source==='IGP'||p.source==='IGP+USGS'?'IGP/CENSIS':'USGS',intro:`El marcador usa ${mag>=6?'rojo para magnitudes altas':mag>=4.5?'naranja para magnitudes moderadas':'verde para eventos de menor magnitud'} dentro de la escala visual del portal. La magnitud no equivale por sí sola a daño o intensidad sentida.`,items:[[color(mag),'circle',`M ${mag.toFixed(1)}`,`Profundidad ${(+depth).toFixed(0)} km · ${p.place||'Perú'}`],['#ffffff','outline','Profundidad','La profundidad hipocentral ayuda a contextualizar el evento.'],['#2f9bd7','line','Fuente','Abra el reporte original para verificar parámetros oficiales.']]});
  document.querySelectorAll('.range-card').forEach(x=>x.classList.toggle('current',x.dataset.range===rr.key));
  $('detailRangeText').textContent=rr.label;
  $('detailCenterMap').onclick=()=>{
    maps.map.flyTo([lat,lon],8,{duration:.8});
    L.popup({maxWidth:350}).setLatLng([lat,lon]).setContent(popup(f)).openOn(maps.map);
    window.scrollTo({top:0,behavior:'smooth'});
  };
}

function renderMonitor(){
  const d=currentEvents();quakeLayer.clearLayers();
  d.forEach((f,i)=>{const c=f.geometry.coordinates;const mk=L.marker([c[1],c[0]],{icon:icon(f,i===0)}).bindPopup(popup(f),{maxWidth:350}).addTo(quakeLayer);mk.on('click',()=>renderSelectedEvent(f))});
  $('count').textContent=d.length;
  $('recentList').innerHTML=d.slice(0,14).map((f,i)=>{const p=f.properties;return `<div class="quake-item" data-q="${i}"><div class="m" style="background:${color(p.mag)}">M ${(+p.mag||0).toFixed(1)}</div><div class="where"><b>${esc(p.place)}</b><small>${p.source==='IGP'?'IGP/CENSIS':p.source==='IGP+USGS'?'IGP + USGS':'USGS'}</small></div><time>${new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'}).format(new Date(p.time))}</time></div>`}).join('')||'<div class="loading">No hay eventos visibles con este filtro.</div>';
  document.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>{const f=d[+x.dataset.q],c=f.geometry.coordinates;renderSelectedEvent(f);maps.map.flyTo([c[1],c[0]],8);L.popup().setLatLng([c[1],c[0]]).setContent(popup(f)).openOn(maps.map)});
  renderLatest();
}
function renderLatest(){const f=[...igp].sort((a,b)=>b.properties.time-a.properties.time)[0]||catalog[0];if(!f)return;const p=f.properties,[x,y,d=0]=f.geometry.coordinates;$('latestMag').textContent=`M ${(+p.mag||0).toFixed(1)}`;$('latestMag').style.color=color(p.mag);$('latestPlace').textContent=p.place||'Perú';$('latestTime').textContent=pe(p.time);$('latestDepth').textContent=`${(+d).toFixed(0)} km`;$('latestIntensity').textContent=p.intensity||'—';$('latestCoords').textContent=`${y.toFixed(2)}, ${x.toFixed(2)}`;$('latestCode').textContent=p.code||'—';$('latestLink').href=p.url||'https://ultimosismo.igp.gob.pe/';const selected=catalog.find(x=>x.id===selectedEventId);if(selected)renderSelectedEvent(selected);else renderSelectedEvent(f)}
async function renderHistory(){
  const days=$('histDays').value,src=$('histSource').value,min=+$('histMag').value,q=$('histSearch').value.toLowerCase();
  $('histRows').innerHTML='<tr><td colspan="6">Consultando catálogo…</td></tr>';
  try{
    const hours=days==='all'?8760:Math.max(24,+days*24);
    const data=await get(`${API_QUAKES}?hours=${hours}`,20000);
    historyCatalog=data.events||[];
  }catch(e){ historyCatalog=[...catalog]; }
  let d=[...historyCatalog];
  if(src!=='all')d=d.filter(f=>f.properties.source.includes(src));
  d=d.filter(f=>(+f.properties.mag||0)>=min&&(!q||(f.properties.place||'').toLowerCase().includes(q)||(f.properties.code||'').toLowerCase().includes(q)));
  histLayer.clearLayers();
  d.slice(0,1200).forEach(f=>{const c=f.geometry.coordinates;L.marker([c[1],c[0]],{icon:icon(f)}).bindPopup(popup(f)).addTo(histLayer)});
  $('histRows').innerHTML=d.slice(0,1200).map(f=>{const p=f.properties,z=f.geometry.coordinates[2]||0;return `<tr><td>${pe(p.time)}</td><td>${esc(p.source)}</td><td><b style="color:${color(p.mag)}">M ${(+p.mag||0).toFixed(1)}</b></td><td>${(+z).toFixed(0)} km</td><td>${esc(p.place)}</td><td><a target="_blank" rel="noopener" href="${esc(p.url||p.usgsUrl||'#')}">Abrir ↗</a></td></tr>`}).join('')||'<tr><td colspan="6">Sin eventos para este filtro.</td></tr>';
}
function playAlert(){
  if(!sound)return;
  try{if(nativeBridge())return;previewEarthquakeSound(selectedSound||'sirena_emergencia')}catch(e){}
}
function alertNew(){
  const fresh=catalog.filter(f=>Date.now()-f.properties.time<20*60*1000);
  if(!initialized){fresh.forEach(f=>seen.add(f.id));initialized=true;return}
  const n=fresh.find(f=>!seen.has(f.id));fresh.forEach(f=>seen.add(f.id));localStorage.setItem('gsl6_seen',JSON.stringify([...seen].slice(-800)));
  if(n){$('alertState').textContent=`NUEVO SISMO M ${(+n.properties.mag||0).toFixed(1)}`;$('alertState').style.background='#9c272a';playAlert();const c=n.geometry.coordinates;maps.map.flyTo([c[1],c[0]],8);setTimeout(()=>{$('alertState').textContent='SIN ALERTAS';$('alertState').style.background=''},12000)}
}
async function poll(){
  $('lastPoll').textContent='Consultando…';
  try{
    const data=await get(`${API_QUAKES}?hours=24`);
    catalog=data.events||[];
    igp=catalog.filter(f=>f.properties.source.includes('IGP'));
    usgs=catalog.filter(f=>f.properties.source==='USGS');
    const si=data.sources?.igp, su=data.sources?.usgs;
    $('igpStatus').textContent=si?.ok?'IGP CONECTADO':'IGP SIN RESPUESTA';
    $('igpHealth').textContent=si?.ok?`Operativo · ${si.count||0} eventos`:'Sin respuesta';
    $('usgsStatus').textContent=su?.ok?'USGS CONECTADO':'USGS SIN RESPUESTA';
    $('usgsHealth').textContent=su?.ok?`Operativo · ${su.count||0} eventos`:'Sin respuesta';
    renderMonitor(); alertNew();
    $('lastPoll').textContent=clockFmt.format(new Date());
    $('updated').textContent='Actualizado: '+pe(data.generatedAt||Date.now());
    if(Date.now()-forecastTimer>30*60*1000){ensureForecastData();forecastTimer=Date.now()}
  }catch(e){
    $('igpStatus').textContent='DATOS NO DISPONIBLES';
    $('usgsStatus').textContent='REINTENTANDO';
    $('igpHealth').textContent='Conexión temporalmente interrumpida';
    $('usgsHealth').textContent='Conexión temporalmente interrumpida';
    $('lastPoll').textContent='Error';
  }
}
async function ensureForecastData(){
  if(forecastCatalog.length && Date.now()-(forecastCatalog._loadedAt||0)<20*60*1000){renderForecast();return}
  try{
    const data=await get(`${API_QUAKES}?hours=8760`,25000);
    forecastCatalog=data.events||[];
    forecastCatalog._loadedAt=Date.now();
  }catch(e){forecastCatalog=[...catalog]}
  renderForecast();
}
function forecastComponents(events,lat,lon,h){
  let recent=0,bg=0,now=Date.now(),cur7=0,prev7=0,near=[];
  for(const f of events){
    const c=f.geometry.coordinates,m=Math.max(1,+f.properties.mag||0),age=(now-f.properties.time)/3600000;
    if(age<0)continue;
    const d=hav(lat,lon,c[1],c[0]);
    const magW=Math.pow(10,.28*Math.max(0,m-3));
    if(age<=8760) bg+=magW*Math.exp(-.5*(d/125)**2);
    if(age<=Math.max(720,h*2)){
      const bw=Math.max(35,Math.min(120,42+18*Math.max(0,m-4)));
      const temporal=Math.pow(age+2,-1.08);
      recent+=magW*temporal*Math.exp(-.5*(d/bw)**2);
      if(d<130)near.push(m);
    }
    if(age<=168) cur7+=magW*Math.exp(-.5*(d/90)**2);
    else if(age<=336) prev7+=magW*Math.exp(-.5*(d/90)**2);
  }
  const trend=(cur7+0.02)/(prev7+0.02);
  return {recent,bg,trend,near};
}
function renderForecast(){
  if(!maps.forecastMap)return;
  const events=(forecastCatalog.length?forecastCatalog:catalog);
  if(!events.length){$('zoneCards').innerHTML='<div class="loading">Sin datos suficientes.</div>';return}
  const cells=[];
  for(let lat=-19.5;lat<=-3;lat+=.48)for(let lon=-81.8;lon<=-69.3;lon+=.48){
    const r=forecastComponents(events,lat,lon,forecastHours);
    cells.push({lat,lon,...r});
  }
  const maxR=Math.max(...cells.map(x=>x.recent),1e-9),maxB=Math.max(...cells.map(x=>x.bg),1e-9);
  cells.forEach(c=>{
    c.rate=.72*(c.recent/maxR)+.28*(c.bg/maxB);
    c.score=projectionMode==='trend'?Math.max(0,Math.min(1,(Math.log(c.trend)+1)/2.5)):c.rate;
  });
  const pts=cells.filter(c=>c.score>.04).map(c=>[c.lat,c.lon,c.score]);
  if(forecastHeat)maps.forecastMap.removeLayer(forecastHeat);
  forecastHeat=L.heatLayer(pts,{radius:24,blur:30,maxZoom:8,minOpacity:.08,gradient:{0.12:'#2877a8',0.32:'#36a96b',0.52:'#d5c83a',0.72:'#ec8a28',1:'#cc3b37'}}).addTo(maps.forecastMap);
  forecastZones.clearLayers();
  const top=[...cells].sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.slice(0,i).every(x=>hav(c.lat,c.lon,x.lat,x.lon)>165)).slice(0,4);
  $('zoneCards').innerHTML=top.map((c,i)=>{
    const ratio=Math.round(c.score*100),ms=[...c.near].sort((a,b)=>a-b),lo=ms.length?ms[Math.floor(ms.length*.25)]:0,hi=ms.length?ms[Math.min(ms.length-1,Math.floor(ms.length*.8))]:0;
    const trend=c.trend>1.35?'↑ aumentando':c.trend<.75?'↓ disminuyendo':'→ estable';
    return `<div class="zone" data-z="${i}"><div class="zonehead"><h4>Zona ${i+1}</h4><span class="level">${ratio>=75?'MUY ALTO':ratio>=50?'ALTO':ratio>=25?'MODERADO':'BAJO'}</span></div><p>Índice relativo: <b>${ratio}/100</b></p><p>Tendencia semanal: <b>${trend}</b></p><p>Magnitud observada de referencia: <b>${lo?`M ${lo.toFixed(1)}–${hi.toFixed(1)}`:'—'}</b></p><p>Incertidumbre espacial orientativa: <b>±45–80 km</b></p></div>`;
  }).join('');
  top.forEach((c,i)=>L.circle([c.lat,c.lon],{radius:38000,color:'#dceaf2',weight:.7,fillColor:'#ff8a20',fillOpacity:.04,dashArray:'4,6'}).bindTooltip(`Zona ${i+1}`).addTo(forecastZones));
  document.querySelectorAll('[data-z]').forEach(x=>x.onclick=()=>{const c=top[+x.dataset.z],ratio=Math.round(c.score*100);maps.forecastMap.flyTo([c.lat,c.lon],7);setContextLegend('forecast',{title:`Zona probabilística · ${ratio}/100`,situation:`Zona seleccionada · índice ${ratio}/100`,variable:'Concentración relativa del modelo',unit:'Índice 0–100',horizon:'Ventana del modelo activo',source:'Modelo GS-ENSEMBLE · experimental',intro:'El color indica concentración/tasa relativa dentro del modelo, no la certeza de que ocurrirá un sismo. Un valor mayor solo prioriza comparación estadística dentro del mismo cálculo.',items:[[ratio>=75?'#cc3b37':ratio>=50?'#ec8a28':ratio>=25?'#d5c83a':'#36a96b','circle',`Índice ${ratio}/100`,'Nivel relativo de esta zona dentro del cálculo actual.'],['#ffffff','outline','±45–80 km','Incertidumbre espacial orientativa del modelo.']]})});
  $('projEvents').textContent=events.length;
  $('projTime').textContent=clockFmt.format(new Date());
}
function setLayerStatus(id,msg,ok=true){
  const el=$(id); if(!el)return; el.textContent=msg; el.classList.toggle('error',!ok); el.classList.toggle('ok',ok);
}
function directText(el,tag){
  for(const n of el.children||[]) if(n.localName===tag||n.nodeName===tag) return (n.textContent||'').trim();
  return '';
}
async function discoverWms(base,keywords=[]){
  const u=base+'?service=WMS&version=1.3.0&request=GetCapabilities&_='+Date.now();
  const r=await fetch(u,{cache:'no-store'});
  if(!r.ok) throw Error('HTTP '+r.status);
  const xml=new DOMParser().parseFromString(await r.text(),'text/xml');
  const ls=[...xml.getElementsByTagName('Layer')].map(el=>({name:directText(el,'Name'),title:directText(el,'Title')})).filter(x=>x.name);
  if(!ls.length)throw Error('Sin capas publicadas');
  const words=keywords.map(x=>x.toLowerCase());
  return ls.find(x=>words.some(w=>(x.title+' '+x.name).toLowerCase().includes(w)))||ls[0];
}
function clearRain(){
  if(rainLayer){try{maps.rainMap.removeLayer(rainLayer)}catch{} rainLayer=null}
}

function targetMonthISO(h){
  const d=new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+h);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
function ownSeasonalSignal(lat,lon,h){
  const d=new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+h);
  const m=d.getUTCMonth()+1, y=d.getUTCFullYear();
  let score=0,reason=[];
  const wet=(m>=11||m<=3);
  const ensoWindow=(y===2026||y===2027);
  if(lon<-76 && lat>-8.5){
    score += wet?28:8; reason.push(wet?'estacionalidad húmeda de verano en costa norte':'señal estacional débil en costa norte');
    if(ensoWindow){score+=12;reason.push('contexto El Niño Costero 2026-27');}
  }else if(lon<-75 && lat<=-8.5 && lat>-13.5){
    score += wet?15:3; reason.push('costa central: señal húmeda estacional moderada');
    if(ensoWindow && wet){score+=8;reason.push('contexto cálido costero');}
  }else if(lon<-73.5 && lat<=-13.5){
    score += wet?6:-2; reason.push('costa sur: climatología árida, señal absoluta de lluvia generalmente baja');
  }else if(lat<-12.5 && lon>=-74.5){
    score += wet?8:-18;
    reason.push(wet?'temporada lluviosa andina':'estación seca andina');
    if(ensoWindow){score-=18;reason.push('riesgo de déficit hídrico en sierra sur considerado por CENEPRED');}
  }else if(lon>-74.5){
    score += wet?20:7; reason.push(wet?'periodo húmedo amazónico':'precipitación amazónica persistente');
  }else{
    score += wet?14:-8; reason.push(wet?'temporada lluviosa andina':'periodo relativamente seco');
  }
  score=Math.max(-45,Math.min(45,score));
  return {score,reason:reason.join('; '),target:`${y}-${String(m).padStart(2,'0')}`};
}
function seasonalColor(v){
  if(v<=-30)return '#8c4f18';
  if(v<=-12)return '#d2aa72';
  if(v<12)return '#eeeeee';
  if(v<25)return '#9ccdf2';
  if(v<38)return '#4388c8';
  return '#174f9a';
}
function normalizeSeasonalResponse(data,h,point){
  const obj=Array.isArray(data)?data[point]:data;
  if(!obj||!obj.monthly)return null;
  const times=obj.monthly.time||[];
  const tgt=targetMonthISO(h);
  let idx=times.findIndex(x=>String(x).slice(0,7)===tgt);
  if(idx<0)idx=Math.min(Math.max(h-1,0),times.length-1);
  const an=obj.monthly.precipitation_anomaly||obj.monthly.precipitation_mean_anomaly||[];
  const mean=obj.monthly.precipitation_mean||obj.monthly.precipitation||[];
  if(idx<0||idx>=Math.max(an.length,mean.length))return null;
  const val=Number(an[idx]), avg=Number(mean[idx]);
  if(!Number.isFinite(val)&&!Number.isFinite(avg))return null;
  return {anomaly:Number.isFinite(val)?val:null,mean:Number.isFinite(avg)?avg:null,time:times[idx]||tgt,unit:(obj.monthly_units&&obj.monthly_units.precipitation_anomaly)||''};
}
async function loadOwnSeasonalMap(h){
  const pts=[];
  for(let lat=-18;lat<=0;lat+=3) for(let lon=-81;lon<=-69;lon+=3) pts.push({lat,lon});
  let rows=null,source='GeoSismosLatam · estimación propia contextual',method='fallback';
  try{
    const lat=pts.map(p=>p.lat).join(','), lon=pts.map(p=>p.lon).join(',');
    const url=`https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&monthly=precipitation_mean,precipitation_anomaly&models=ecmwf_seas5&forecast_months=7&timezone=GMT`;
    const ctrl=new AbortController(), tm=setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'}); clearTimeout(tm);
    if(r.ok){
      const j=await r.json();
      const parsed=pts.map((p,i)=>({...p,...(normalizeSeasonalResponse(j,h,i)||{})}));
      if(parsed.filter(x=>Number.isFinite(x.anomaly)).length>=8){
        rows=parsed;source='ECMWF SEAS5 (acceso Open-Meteo) + interpretación GeoSismosLatam';method='ecmwf';
      }
    }
  }catch(e){console.warn('seasonal grid fallback',e)}
  if(!rows){
    rows=pts.map(p=>{const q=ownSeasonalSignal(p.lat,p.lon,h);return {...p,anomaly:q.score,unit:'índice',reason:q.reason,time:q.target}});
  }
  const group=L.layerGroup();
  rows.forEach(r=>{
    const v=Number(r.anomaly)||0, col=seasonalColor(v);
    const rect=L.rectangle([[r.lat-1.45,r.lon-1.45],[r.lat+1.45,r.lon+1.45]],{stroke:true,color:col,weight:.5,fillColor:col,fillOpacity:.43});
    const label=method==='ecmwf'
      ? `Anomalía del modelo: ${Number.isFinite(r.anomaly)?r.anomaly.toFixed(1):'—'} ${r.unit||''}${Number.isFinite(r.mean)?`<br>Media modelada: ${r.mean.toFixed(1)}`:''}`
      : `Índice orientativo GeoSismos: ${v>0?'+':''}${v.toFixed(0)}<br>${esc(r.reason||'')}`;
    rect.bindTooltip(`<b>${r.time||targetMonthISO(h)}</b><br>${label}`);
    rect.on('click',()=>{
      const intro=(method==='ecmwf')
        ? `Celda de guía estacional basada en ECMWF SEAS5. ${label.replace('<br>',' · ')}. Es un producto de área, sin corrección de sesgo local.`
        : `Estimación propia de respaldo porque la proyección externa no estuvo disponible. Integra estacionalidad regional y el contexto 2026–2027 publicado por ENFEN/CENEPRED. No es un pronóstico oficial ni un valor de diseño. ${r.reason||''}`;
      setRainLegend(`${h}m`,{title:`Proyección ${r.time||targetMonthISO(h)} · celda seleccionada`,source,intro,situation:`Celda climática · ${r.time||targetMonthISO(h)}`,variable:'Anomalía/tendencia de precipitación',unit:r.unit||'Categoría/anomalía',horizon:`+${h} mes${h>1?'es':''}`});
      $('rainInfoTitle').textContent=`Proyección ${r.time||targetMonthISO(h)}`;
      $('rainInfoText').textContent=intro;
      $('rainInfoFacts').innerHTML=`<span>Método</span><b>${method==='ecmwf'?'ECMWF SEAS5':'Modelo contextual propio'}</b><span>Señal</span><b>${method==='ecmwf'?(Number.isFinite(r.anomaly)?r.anomaly.toFixed(1)+' '+(r.unit||''):'—'):(v>0?'+':'')+v.toFixed(0)+' índice'}</b><span>Horizonte</span><b>+${h} mes${h>1?'es':''}</b><span>Uso</span><b>Orientación climática, no ingeniería</b>`;
    });
    group.addLayer(rect);
  });
  group.addTo(maps.rainMap); rainLayer=group;
  return {source,method,count:rows.length};
}
function shortRainColor(mm,days){
  const v=mm/Math.max(days,1);
  if(v<0.2)return '#d9f4ff';
  if(v<2)return '#5bc0eb';
  if(v<7)return '#3a86ff';
  if(v<15)return '#43aa8b';
  if(v<30)return '#f6c945';
  if(v<50)return '#f9844a';
  return '#d62828';
}
async function loadShortRainGrid(days){
  const pts=[];
  for(let lat=-18;lat<=0;lat+=3) for(let lon=-81;lon<=-69;lon+=3) pts.push({lat,lon});
  const lat=pts.map(p=>p.lat).join(','),lon=pts.map(p=>p.lon).join(',');
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&daily=precipitation_sum&forecast_days=${days}&timezone=GMT`;
  const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),8000);
  const r=await fetch(url,{signal:ctrl.signal,cache:'no-store'});clearTimeout(tm);
  if(!r.ok)throw Error('Pronóstico alternativo HTTP '+r.status);
  const j=await r.json(), arr=Array.isArray(j)?j:[j];
  const rows=pts.map((p,i)=>{
    const o=arr[i]||{}, vals=(o.daily&&o.daily.precipitation_sum)||[];
    const mm=vals.slice(0,days).reduce((a,b)=>a+(Number(b)||0),0);
    return {...p,mm,unit:(o.daily_units&&o.daily_units.precipitation_sum)||'mm'};
  });
  if(rows.filter(x=>Number.isFinite(x.mm)).length<8)throw Error('Sin grilla alternativa');
  const group=L.layerGroup();
  rows.forEach(x=>{
    const col=shortRainColor(x.mm,days);
    const rect=L.rectangle([[x.lat-1.45,x.lon-1.45],[x.lat+1.45,x.lon+1.45]],{stroke:true,color:col,weight:.5,fillColor:col,fillOpacity:.46});
    rect.bindTooltip(`<b>${days===1?'24 h':'7 días'}</b><br>Acumulado modelado: ${x.mm.toFixed(1)} ${x.unit}`);
    rect.on('click',()=>{
      setRainLegend(days===1?'1d':'7d',{title:`Pronóstico alternativo ${days===1?'24 h':'7 días'} · celda seleccionada`,source:'Modelo meteorológico global (acceso Open-Meteo) · apoyo, no fuente oficial peruana',intro:`Acumulado modelado para esta celda: ${x.mm.toFixed(1)} ${x.unit}. Se usa solo cuando la capa SENAMHI no responde. Para decisiones locales prevalecen SENAMHI y observaciones disponibles.`,situation:`Celda seleccionada · ${x.mm.toFixed(1)} ${x.unit}`,variable:'Precipitación acumulada modelada',unit:x.unit,horizon:days===1?'24 horas':'7 días'});
    });
    group.addLayer(rect);
  });
  group.addTo(maps.rainMap); rainLayer=group;
  return rows.length;
}

async function loadCfsv2(horizon){
  const img=$('cfsv2Image'),title=$('cfsv2Title'),text=$('cfsv2Text'),meta=$('cfsv2Meta');
  if(!img)return;
  if(!horizon){img.hidden=true;title.textContent='Seleccione 1–6 meses';meta.innerHTML='';return}
  title.textContent=`NOAA CFSv2 · precipitación · +${horizon} mes${horizon>1?'es':''}`;
  text.textContent='Anomalía mensual del modelo climático global CFSv2. Sirve como guía estacional y no predice una lluvia exacta en una fecha, punto o distrito.';
  img.hidden=false;img.src=`/api/noaa/cfsv2/precip?horizon=${horizon}&t=${Math.floor(Date.now()/21600000)}`;
  meta.innerHTML=`<span>Horizonte</span><b>+${horizon} mes${horizon>1?'es':''}</b><span>Producto</span><b>Anomalía de precipitación</b><span>Fuente</span><b>NOAA/NCEP CFSv2</b><span>Uso</span><b>Orientación estacional</b>`;
}
function rainExplanation(mode,latlng){
  const where=latlng?` · ${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)}`:'';
  const cfg={
    now:['Precipitación reciente NASA IMERG','Tasa de precipitación satelital casi en tiempo real. IMERG Early Run tiene latencia; un color intenso representa mayor tasa en el producto, no una medición de pluviómetro en ese punto.','NASA GPM / IMERG','30 min · casi tiempo real'],
    '1d':['Lluvia · 1 día','Producto de corto plazo. Se prioriza la capa oficial SENAMHI disponible; debe revisarse fecha de emisión, validez y leyenda original.','SENAMHI','24 horas'],
    '7d':['Lluvia · 1 semana','Horizonte meteorológico de una semana. Se usa pronóstico numérico oficial disponible; la incertidumbre aumenta con los días.','SENAMHI + apoyo NASA/NOAA','7 días'],
    quebradas:['Activación de quebradas','Aviso oficial de posibilidad de activación de quebradas. El nivel, vigencia y ámbito deben verificarse en la fuente oficial.','SENAMHI','Vigencia del aviso'],
    off:['Sin capa temática','El mapa base permanece visible sin una capa de lluvia activa.','GeoSismosLatam','—']
  };
  if(/^[1-6]m$/.test(mode)){
    const h=+mode[0];
    return [`Proyección climática · +${h} mes${h>1?'es':''}`,`Guía estacional basada en NOAA CFSv2. Muestra anomalías/modelo climático a escala amplia; no significa que lloverá un día exacto ni que el valor sea válido como cálculo puntual de ingeniería.${where}`,'NOAA/NCEP CFSv2 + ECMWF SEAS5 + análisis GeoSismosLatam','Mensual / estacional'];
  }
  return cfg[mode]||cfg.now;
}
function rainLegendFor(mode){
  if(mode==='now') return {
    modeLabel:'OBSERVACIÓN SATELITAL',
    items:[
      ['#d9f4ff','','Sin/Traza','Señal muy baja o ausencia aparente de precipitación en el producto.'],
      ['#5bc0eb','','Ligera','Tonos fríos: menor tasa estimada de precipitación.'],
      ['#3a86ff','','Moderada','Señal intermedia de precipitación estimada.'],
      ['#43aa8b','','Moderada–fuerte','Mayor intensidad relativa dentro de la capa.'],
      ['#f6c945','','Fuerte','Precipitación estimada de mayor intensidad.'],
      ['#f9844a','','Muy fuerte','Valores altos del producto satelital.'],
      ['#d62828','','Extrema','Máximo tramo visual de la escala usada por el portal; confirme el valor en la fuente.']
    ],
    note:'NASA IMERG estima precipitación desde satélite. Los colores son una ayuda visual; para un valor puntual consulte la escala/producto original y estaciones disponibles.'
  };
  if(mode==='1d') return {modeLabel:'PRONÓSTICO 24 H',items:[['#d8f2ff','','Muy baja','Acumulado o señal baja dentro del producto oficial.'],['#54b9e8','','Baja','Precipitación prevista de menor intensidad.'],['#5bc46d','','Moderada','Rango intermedio.'],['#f2d14b','','Significativa','Mayor acumulado/intensidad prevista.'],['#f59b32','','Fuerte','Nivel alto dentro de la simbología mostrada.'],['#d83a3a','','Muy fuerte','Tramo superior. Revise aviso y vigencia SENAMHI.']],note:'La clasificación exacta y los milímetros dependen de la capa SENAMHI cargada. La simbología oficial prevalece.'};
  if(mode==='7d') return {modeLabel:'PRONÓSTICO 7 DÍAS',items:[['#79c7ed','','Menor acumulado','Menor señal prevista en el horizonte semanal.'],['#5fbf70','','Intermedio','Acumulado/modelo de intensidad intermedia.'],['#f0d34d','','Mayor','Señal superior al entorno.'],['#ee8b31','','Alta','Acumulado previsto alto.'],['#cf3b3b','','Muy alta','Extremo visual del producto. Incertidumbre mayor a medida que aumenta el plazo.']],note:'El pronóstico semanal es modelado. No debe interpretarse como certeza de lluvia en un punto exacto.'};
  if(/^[1-6]m$/.test(mode)) return {modeLabel:'PROYECCIÓN ESTACIONAL',items:[['#a65b19','','Más seco / bajo lo normal','Anomalía negativa de precipitación respecto de la climatología del modelo.'],['#e3c89a','','Levemente bajo','Tendencia seca débil.'],['#f5f5f5','outline','Cerca de lo normal','Sin señal marcada respecto de la climatología.'],['#99c9f0','','Levemente sobre','Tendencia húmeda débil.'],['#4388c8','','Sobre lo normal','Anomalía positiva.'],['#174f9a','','Muy sobre lo normal','Señal húmeda más intensa del modelo.']],note:'NOAA CFSv2 sirve como contraste. El mapa intenta usar ECMWF SEAS5; si no responde, muestra una estimación propia de respaldo identificada como tal. Ninguna capa indica día/hora exactos ni sustituye SENAMHI.'};
  if(mode==='quebradas') return {modeLabel:'AVISO DE QUEBRADAS',items:[['#f5d949','','Nivel preventivo','Condición a vigilar según aviso vigente.'],['#f39a32','','Nivel importante','Mayor probabilidad/condición de activación según la simbología oficial.'],['#d93636','','Nivel crítico','Tramo superior de la clasificación del aviso.'],['#ffffff','outline','Sin clasificación visible','No equivale a ausencia de peligro; revise la fuente y la fecha.']],note:'Los colores exactos y categorías dependen del aviso SENAMHI vigente. El aviso oficial prevalece.'};
  return {modeLabel:'SIN CAPA',items:[['#8aa0ae','outline','Mapa base','No hay una capa temática meteorológica activa.']],note:'Seleccione un horizonte para activar la explicación correspondiente.'};
}
function setRainLegend(mode,override={}){
  const base=rainLegendFor(mode); const [title,desc,source,horizon]=rainExplanation(mode);
  const meta=mode==='now'?{variable:'Tasa / intensidad de precipitación',unit:'mm/h aprox. según producto',horizon:'Reciente'}:
    mode==='1d'?{variable:'Precipitación acumulada/pronosticada',unit:'mm / 24 h',horizon:'24 horas'}:
    mode==='7d'?{variable:'Precipitación acumulada/pronosticada',unit:'mm / 7 días',horizon:'7 días'}:
    /^[1-6]m$/.test(mode)?{variable:'Anomalía / tendencia de precipitación',unit:'% o categoría respecto a climatología',horizon:`+${mode[0]} mes${mode[0]==='1'?'':'es'}`}:
    mode==='quebradas'?{variable:'Probabilidad/condición de activación',unit:'Categoría de aviso',horizon:'Vigencia oficial'}:{variable:'Mapa base',unit:'—',horizon:'—'};
  setContextLegend('rain',{title,source,intro:desc,items:base.items,note:base.note,modeLabel:base.modeLabel,situation:title,...meta,...override});
}

function updateRainInfo(mode,latlng=null){
  const [title,desc,source,horizon]=rainExplanation(mode,latlng);
  $('rainInfoTitle').textContent=title;
  $('rainInfoText').textContent=desc;
  $('rainInfoFacts').innerHTML=`<span>Fuente</span><b>${esc(source)}</b><span>Horizonte</span><b>${esc(horizon)}</b>${latlng?`<span>Punto consultado</span><b>${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</b>`:''}<span>Interpretación</span><b>${/m$/.test(mode)?'Probabilística / climática':'Producto observado o pronosticado'}</b>`;
}
async function loadRain(mode='now'){
  currentRainMode=mode;clearRain();updateRainInfo(mode);loadCfsv2(/^[1-6]m$/.test(mode)?+mode[0]:0);
  const title=$('rainLayerTitle'), legend=$('rainLegendText');
  try{
    if(mode==='off'){
      setRainLegend('off');
      title.textContent='Capas ocultas';legend.textContent='Seleccione una capa para visualizarla.';setLayerStatus('rainStatus','Sin capa temática activa.',true);return;
    }
    if(mode==='now'){
      const d=new Date(Date.now()-4*3600e3).toISOString().slice(0,10);
      setRainLegend('now');
      rainLayer=L.tileLayer.wms(NASA_GIBS,{layers:NASA_IMERG_LAYER,format:'image/png',transparent:true,opacity:.70,version:'1.3.0',time:d,attribution:'NASA GPM / GIBS'}).addTo(maps.rainMap);
      title.textContent='NASA GPM · IMERG · precipitación reciente';legend.textContent='IMERG: tasa de precipitación estimada por satélite. Haz clic en el mapa para explicar el punto y la capa.';setLayerStatus('rainStatus','NASA IMERG solicitado. La latencia del Early Run es aproximadamente de horas.',true);return;
    }
    if(mode==='1d'){
      setRainLegend('1d');
      setLayerStatus('rainStatus','Consultando capa SENAMHI de 24 horas…',true);
      try{
        const lyr=await discoverWms(SEN_24H,['lluv','precip','24h','aviso']);
        rainLayer=L.tileLayer.wms(SEN_24H,{layers:lyr.name,format:'image/png',transparent:true,opacity:.74,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
        title.textContent='SENAMHI · 24 h · '+(lyr.title||lyr.name);legend.textContent='Corto plazo: capa oficial SENAMHI. La escala y vigencia corresponden al producto publicado.';setLayerStatus('rainStatus','Capa oficial de 24 h cargada.',true);return;
      }catch(e){
        setLayerStatus('rainStatus','SENAMHI no respondió; cargando pronóstico global alternativo…',false);
        await loadShortRainGrid(1);
        title.textContent='Pronóstico alternativo · 24 h';legend.textContent='Grilla meteorológica alternativa. SENAMHI sigue siendo la referencia oficial peruana.';setLayerStatus('rainStatus','Capa alternativa cargada por falla temporal del servicio SENAMHI.',true);return;
      }
    }
    if(mode==='7d'){
      setRainLegend('7d');
      setLayerStatus('rainStatus','Consultando predicción numérica SENAMHI…',true);
      try{
        const lyr=await discoverWms(SEN_NUM,['prec','precip','lluv']);
        rainLayer=L.tileLayer.wms(SEN_NUM,{layers:lyr.name,format:'image/png',transparent:true,opacity:.72,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
        title.textContent='SENAMHI · pronóstico numérico · horizonte semanal';legend.textContent='Pronóstico modelado; verifique el rango temporal exacto de la capa oficial.';setLayerStatus('rainStatus','Pronóstico numérico cargado.',true);return;
      }catch(e){
        setLayerStatus('rainStatus','SENAMHI no respondió; cargando acumulado global alternativo de 7 días…',false);
        await loadShortRainGrid(7);
        title.textContent='Pronóstico alternativo · 7 días';legend.textContent='Acumulado modelado de 7 días. SENAMHI sigue siendo la referencia oficial peruana.';setLayerStatus('rainStatus','Capa alternativa semanal cargada por falla temporal del servicio SENAMHI.',true);return;
      }
    }
    if(/^[1-6]m$/.test(mode)){
      const h=+mode[0];
      setRainLegend(mode,{intro:`Se muestran dos referencias: NOAA CFSv2 en el panel y una capa espacial propia en el mapa. La capa propia intenta usar ECMWF SEAS5; si esa fuente no responde, activa un respaldo contextual basado en estacionalidad regional y en el escenario ENFEN/CENEPRED 2026–2027. Ninguna de las dos predice día u hora exactos.`});
      title.textContent=`Proyección climática +${h} mes${h>1?'es':''} · generando capa espacial…`;
      legend.textContent='Generando celdas climáticas sobre el Perú. Haz clic en una celda para conocer fuente, método y significado del color.';
      setLayerStatus('rainStatus','Calculando proyección espacial de respaldo…',true);
      const r=await loadOwnSeasonalMap(h);
      title.textContent=`Proyección climática +${h} mes${h>1?'es':''} · ${r.method==='ecmwf'?'ECMWF SEAS5':'estimación propia de respaldo'}`;
      legend.textContent=r.method==='ecmwf'?'Colores = anomalía de precipitación del modelo SEAS5.':'Colores = índice propio de tendencia húmeda/seca; no representa milímetros.';
      setLayerStatus('rainStatus',r.method==='ecmwf'?'Capa SEAS5 generada. NOAA CFSv2 queda como contraste lateral.':'Fuente estacional no respondió: se muestra estimación propia contextual y claramente identificada.',true);return;
    }
    if(mode==='quebradas'){
      setRainLegend('quebradas');
      setLayerStatus('rainStatus','Consultando activación de quebradas SENAMHI…',true);
      const lyr=await discoverWms(SEN_Q,['queb','activ']);
      rainLayer=L.tileLayer.wms(SEN_Q,{layers:lyr.name,format:'image/png',transparent:true,opacity:.74,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
      title.textContent='SENAMHI · '+(lyr.title||lyr.name);legend.textContent='Posible activación de quebradas según aviso oficial y su vigencia.';setLayerStatus('rainStatus','Capa de quebradas cargada.',true);return;
    }
  }catch(e){
    title.textContent='Capa dinámica temporalmente no disponible';legend.textContent='La fuente seleccionada no respondió. El mapa base continúa operativo y la explicación conserva la fuente/horizonte.';setLayerStatus('rainStatus','Fuente temporalmente no disponible. Reintente en unos minutos.',false);
  }
}
function clearRisk(){
  if(riskWms){try{maps.riskMap.removeLayer(riskWms)}catch{} riskWms=null}
}
function loadRisk(mode='mass'){
  clearRisk();
  setRiskLegend('hazards',mode,{title:'Riesgos · '+({mass:'Movimientos en masa',flood:'Inundación fluvial',hazards:'Peligros geológicos',igp:'Geodinámica IGP'}[mode]||'Peligros territoriales')});
  if(mode==='off'){ $('riskLayerTitle').textContent='Capas de riesgo ocultas'; setLayerStatus('riskStatus','Sin capa temática activa.',true); return; }
  try{
    let url,label,layers;
    if(mode==='mass'){url=ING_MASS;label='INGEMMET · Susceptibilidad por movimientos en masa';layers=[1];}
    if(mode==='flood'){url=ING_FLOOD;label='INGEMMET · Susceptibilidad a inundación fluvial';layers=[0];}
    if(mode==='hazards'){url=ING_HAZ;label='INGEMMET · Peligros geológicos inventariados';layers=[0,1,2];}
    if(mode==='igp'){url=IGP_GEO;label='IGP · Geodinámica en ciudades y zonas estudiadas';layers=[3];}
    riskWms=L.esri.dynamicMapLayer({url,opacity:.68,useCors:true,layers}).addTo(maps.riskMap);
    $('riskLayerTitle').textContent=label;
    setLayerStatus('riskStatus','Cargando servicio oficial: '+label,true);
    riskWms.on('load',()=>setLayerStatus('riskStatus','Capa oficial visible · '+label,true));
    riskWms.on('requesterror',()=>setLayerStatus('riskStatus','La entidad no respondió en este momento. Pruebe otra capa o el visor oficial.',false));
  }catch(e){
    setLayerStatus('riskStatus','No se pudo cargar esta capa oficial. Pruebe otra fuente.',false);
  }
}
function initRisk(){loadRisk('mass')}
function soilLegendFor(id){
  const common=[['#817d71','','S0 · roca dura','Terreno muy rígido.'],['#59ab65','','S1 · rígido','Roca o suelo rígido.'],['#d6b338','','S2 · intermedio','Rigidez intermedia.'],['#e88b32','','S3 · blando','Mayor flexibilidad/deformación relativa.'],['#d64242','','S4 · especial','Requiere evaluación específica.']];
  const by={
    9:{modeLabel:'ZONIFICACIÓN',items:common,note:'Las zonas y colores publicados por IGP prevalecen. La clasificación de un lote requiere estudio específico.'},
    4:{modeLabel:'TIPOS DE SUELO',items:common,note:'La capa describe unidades/perfiles estudiados; no reemplaza calicatas, SPT u otros ensayos del predio.'},
    5:{modeLabel:'CAPACIDAD PORTANTE',items:[['#6bb36d','','Mayor capacidad','Valores superiores cuando la capa oficial los representa así.'],['#e3c74a','','Intermedia','Rango intermedio de resistencia admisible.'],['#dc6b3f','','Menor capacidad','Valores inferiores; requiere evaluación geotécnica del proyecto.']],note:'No adopte una capacidad portante de un geovisor como valor de diseño sin EMS.'},
    2:{modeLabel:'GEOLOGÍA',items:[['#b59a74','','Unidad geológica','Cada color puede representar una formación/material diferente.'],['#ffffff','outline','Contacto / límite','Separación entre unidades mapeadas.']],note:'Los colores son categóricos y su significado exacto depende de la leyenda geológica IGP.'},
    1:{modeLabel:'GEOMORFOLOGÍA',items:[['#8fb66b','','Unidad de relieve','Color categórico para una geoforma.'],['#c69a5c','','Relieve distinto','Otra unidad geomorfológica.']],note:'No existe una escala universal de “mejor/peor” por color; seleccione el punto y consulte atributos.'},
    3:{modeLabel:'GEODINÁMICA',items:[['#e7b638','','Proceso identificado','Área asociada a un proceso geodinámico mapeado.'],['#d54a42','','Mayor atención','Sector que puede requerir revisión técnica según la capa oficial.']],note:'La peligrosidad exacta depende del estudio y de sus atributos; el color por sí solo no define riesgo.'},
    10:{modeLabel:'COBERTURA DE ESTUDIO',items:[['#55a8d6','outline','Área estudiada','Delimita cobertura del estudio publicado.'],['#ffffff','outline','Fuera de cobertura','No implica terreno seguro; solo ausencia de esa cobertura específica.']],note:'Fuera del polígono pueden existir otros estudios o peligros no representados.'}
  };return by[+id]||by[9];
}
function setSoilLegend(id,title){
  const x=soilLegendFor(id);
  const meta={9:['Respuesta sísmica-geotécnica','Clase S0–S4 / unidad cartográfica'],4:['Tipo/perfil de suelo','Clase geotécnica'],5:['Capacidad portante','Presión admisible según estudio'],2:['Unidad geológica','Categoría geológica'],1:['Unidad geomorfológica','Categoría de relieve'],3:['Proceso geodinámico','Categoría/proceso'],10:['Cobertura del estudio','Dentro / fuera del ámbito']}[+id]||['Información geotécnica','Clase'];
  setContextLegend('soil',{title:'Suelos · '+title,source:'IGP · Zonifica Perú',intro:'Esta tabla corresponde solo a la capa IGP actualmente visible. Toca/clic en el mapa para consultar los atributos del punto.',items:x.items,note:x.note,modeLabel:x.modeLabel,situation:title,variable:meta[0],unit:meta[1],horizon:'Cartografía/estudio publicado'});
}

function setSoilLayer(id){
  const names={9:'Zonificación sísmica-geotécnica',4:'Tipos de suelo',5:'Capacidad portante',2:'Geología',1:'Geomorfología',3:'Geodinámica',10:'Área estudiada'};
  try{
    const layerExplain={9:'Zonificación sísmica-geotécnica: clasifica zonas según respuesta esperada del terreno.',4:'Tipos de suelo: muestra unidades o perfiles identificados en los estudios.',5:'Capacidad portante: referencia geotécnica de resistencia del terreno donde existe estudio.',2:'Geología: unidades y materiales geológicos mapeados.',1:'Geomorfología: formas del relieve y procesos que modelan el terreno.',3:'Geodinámica: procesos activos o potenciales que pueden afectar el territorio.',10:'Área estudiada: delimita dónde existe información técnica publicada por el IGP.'};
    setSoilLegend(id,names[id]||'capa IGP');
    if(soilLayer)maps.soilMap.removeLayer(soilLayer);
    soilLayer=L.esri.dynamicMapLayer({url:IGP_SOIL,layers:[+id],opacity:.72,useCors:true}).addTo(maps.soilMap);
    $('soilInfoTitle').textContent=names[id]||'Capa IGP';
    $('soilInfoText').textContent='Haz clic sobre el mapa para consultar qué información pública del estudio IGP existe en ese punto.';
    $('soilInfoFacts').innerHTML='<span>Capa activa</span><b>'+esc(names[id]||id)+'</b><span>Fuente</span><b>IGP · EstudiosZonificacion</b>';
  }catch(e){}
}
async function identifySoil(latlng){
  $('soilInfoTitle').textContent='Consultando punto…';
  $('soilInfoText').textContent='Buscando información oficial disponible.';
  try{
    const b=maps.soilMap.getBounds();
    const p=new URLSearchParams({
      f:'json',geometry:`${latlng.lng},${latlng.lat}`,geometryType:'esriGeometryPoint',sr:'4326',
      tolerance:'5',mapExtent:`${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`,
      imageDisplay:'1200,800,96',returnGeometry:'false',layers:'all:0,1,2,3,4,5,9,10'
    });
    const data=await get(`/api/arcgis/igp_zoning/identify?${p}`,15000);
    const rs=data.results||[];
    if(!rs.length){
      $('soilInfoTitle').textContent='Sin estudio identificado en este punto';
      $('soilInfoText').textContent='No se encontró una capa IGP con información para la coordenada seleccionada. Esto no significa que el terreno sea seguro o que no exista otro estudio.';
      $('soilInfoFacts').innerHTML=`<span>Coordenadas</span><b>${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</b>`;
      setContextLegend('soil',{title:'Suelos · punto sin resultado',source:'IGP · Zonifica Perú',intro:'No se encontró información en este punto. Esto solo indica ausencia de resultado en el servicio consultado, no ausencia de peligro.',items:[['#ffffff','outline','Sin resultado','No equivale a suelo seguro ni a S0.']],note:'Realice un EMS para decisiones de diseño.',modeLabel:'CONSULTA DE PUNTO'});
      return;
    }
    const groups=rs.slice(0,8).map(r=>{
      const a=r.attributes||{}, vals=Object.entries(a).filter(([k,v])=>v!==null&&v!==''&&!/objectid/i.test(k)).slice(0,4);
      return `<div class="study-hit"><b>${esc(r.layerName||'Capa IGP')}</b>${vals.map(([k,v])=>`<small>${esc(k)}: ${esc(v)}</small>`).join('')}</div>`;
    }).join('');
    $('soilInfoTitle').textContent='Información IGP encontrada';
    $('soilInfoText').textContent='Resultados del servicio público de Estudios de Zonificación para el punto seleccionado.';
    $('soilInfoFacts').innerHTML=groups;
    setContextLegend('soil',{title:'Suelos · información encontrada',source:'IGP · Zonifica Perú',intro:'El punto seleccionado intersecta información técnica publicada. Revisa los atributos mostrados en la ficha lateral.',items:[['#55a8d6','circle','Punto consultado',latlng.lat.toFixed(4)+', '+latlng.lng.toFixed(4)],['#ffffff','outline','Atributos','La clase exacta se toma del servicio IGP, no del color estimado por GeoSismosLatam.']],note:'El resultado del geovisor no reemplaza el Estudio de Mecánica de Suelos del lote.',modeLabel:'IDENTIFICACIÓN'});
  }catch(e){
    $('soilInfoTitle').textContent='Servicio temporalmente no disponible';
    $('soilInfoText').textContent='No fue posible consultar el punto en este momento. Usa Zonifica Perú como fuente oficial de respaldo.';
  }
}

const LEGENDS={
  monitor:{
    theme:'monitor',title:'Monitoreo sísmico',source:'IGP/CENSIS + USGS',situation:'Sismos reportados visibles',variable:'Magnitud y profundidad',unit:'M · km',horizon:'Últimos reportes',
    intro:'Los símbolos representan sismos publicados por las fuentes consultadas. El color se asigna según magnitud.',
    items:[
      ['#35a769','circle','M < 4.5','Eventos de menor magnitud dentro de la clasificación visual del portal.'],
      ['#f2a51a','circle','M 4.5–5.9','Eventos de magnitud intermedia.'],
      ['#df3e3e','circle','M ≥ 6.0','Eventos de mayor magnitud; consulta siempre el reporte oficial.'],
      ['#ffffff','outline','Círculo resaltado','Evento más reciente o seleccionado.']
    ],
    note:'La alerta del portal indica un nuevo reporte publicado. No constituye predicción previa del sismo.'
  },
  forecast:{
    theme:'forecast',title:'Proyección experimental',source:'Modelo GeoSismosLatam',situation:'Mapa probabilístico activo',variable:'Concentración relativa',unit:'Índice relativo',horizon:'Ventana seleccionada',
    intro:'El mapa de calor representa concentración relativa de actividad sísmica dentro del modelo experimental.',
    items:[
      ['#2877a8','','Muy bajo','Menor concentración relativa dentro de la ventana analizada.'],
      ['#36a96b','','Bajo','Actividad relativa baja.'],
      ['#d5c83a','','Moderado','Concentración intermedia.'],
      ['#ec8a28','','Alto','Mayor concentración relativa.'],
      ['#cc3b37','','Muy alto','Máxima concentración relativa dentro del modelo, no certeza de ocurrencia.']
    ],
    note:'No predice fecha, lugar ni magnitud exacta de un terremoto.'
  },
  rain:{
    theme:'rain',title:'Lluvias y precipitación',source:'SENAMHI / NOAA / NASA / INDECI',situation:'Sin horizonte específico',variable:'Precipitación',unit:'Según capa',horizon:'Seleccione horizonte',
    intro:'Cada capa corresponde a un producto diferente: observación satelital, pronóstico modelado o aviso oficial.',
    items:[
      ['#2f9bd7','','Precipitación / lluvia','La escala exacta depende de la capa oficial seleccionada.'],
      ['#82d7ff','outline','Satélite','Imagen de nubosidad/atmósfera; no equivale directamente a lluvia acumulada.'],
      ['#f0a221','line','Aviso / quebradas','Producto preventivo; revisa nivel, fecha de emisión y vigencia.']
    ],
    note:'La leyenda cromática específica del WMS debe interpretarse con la simbología publicada por la fuente oficial.'
  },
  marine:{
    theme:'marine',title:'Mar, mareas y pesca',source:'DHN / PRODUCE / IMARPE',situation:'Litoral visible',variable:'Condición marina / puertos',unit:'Según producto',horizon:'Actual/aviso vigente',
    intro:'Los puntos del mapa son puertos o sectores de consulta para mareas y condiciones marinas.',
    items:[
      ['#20a8d8','circle','Puerto / sector','Referencia geográfica para consultar mareas y estado del mar.'],
      ['#ffffff','outline','LAM','No se traza automáticamente sin cartografía oficial sectorial.'],
      ['#35aabb','line','Condición marina','Revisa oleaje, viento, avisos y restricciones antes de salir.']
    ],
    note:'Los puntos no representan autorización de pesca ni garantizan presencia de especies.'
  },
  risk:{
    theme:'risk',title:'Riesgos y peligros',source:'CENEPRED / INDECI / PCM / INGEMMET / ENFEN',situation:'Peligro territorial',variable:'Riesgo/peligro según capa',unit:'Categoría oficial',horizon:'Según escenario/estudio',
    intro:'La simbología cambia según el modo seleccionado: peligros, estados de emergencia, El Niño o afectaciones.',
    items:[
      ['#2da7e6','outline','Borde azul','Declaratorias asociadas a lluvias o El Niño.'],
      ['#f0a21a','outline','Borde ámbar','Declaratorias asociadas a déficit hídrico.'],
      ['#8b5cf6','','Relleno por distrito','Diferencia visual entre distritos vigentes; no representa intensidad.']
    ],
    note:'Cuando vence el plazo configurado de una declaratoria, el distrito deja de mostrarse como vigente.'
  },
  soil:{
    theme:'soil',title:'Suelos y construcción segura',source:'IGP / Zonifica Perú',situation:'Zonificación activa',variable:'Clase geotécnica',unit:'Clase/unidad cartográfica',horizon:'Estudio publicado',
    intro:'La interpretación depende de la capa activa. Las clases S0–S4 describen perfiles de suelo de manera general.',
    items:[
      ['#817d71','','S0','Roca dura o terreno extremadamente rígido.'],
      ['#59ab65','','S1','Roca o suelo rígido.'],
      ['#d6b338','','S2','Suelo de rigidez intermedia.'],
      ['#e88b32','','S3','Suelo blando o más flexible.'],
      ['#d64242','','S4','Condiciones especiales que requieren evaluación específica.']
    ],
    note:'La cartografía regional/urbana no reemplaza un Estudio de Mecánica de Suelos del lote.'
  },
  agriculture:{
    theme:'agri',title:'Agricultura y campaña agrícola',source:'MIDAGRI / SIEA',situation:'Vista agrícola',variable:'Distrito/cultivo',unit:'Según indicador',horizon:'Campaña agrícola',
    intro:'El mapa permite seleccionar distritos y contextualizar el cultivo elegido con un calendario referencial.',
    items:[
      ['#77943b','','Distrito','Unidad territorial consultable.'],
      ['#b8ef69','outline','Distrito seleccionado','Ámbito activo para mostrar información del cultivo.'],
      ['#89b64a','line','Etapa de cultivo','Siembra, desarrollo o cosecha según información disponible o referencia agronómica.']
    ],
    note:'Las fechas de cosecha son orientativas cuando no existe un dato oficial verificable para el distrito.'
  },
  news:{
    theme:'monitor',title:'Actualidad',source:'Fuentes identificadas',
    intro:'Cada tarjeta enlaza a su fuente original para que el usuario pueda verificar la publicación.',
    items:[['#1475b7','','Fuente oficial','Información institucional o técnico-científica.'],['#b6842e','','Fuente secundaria','Debe mostrarse como información por verificar cuando provenga de medios o redes.']],
    note:'La plataforma no debe presentar una publicación periodística como si fuera un reporte oficial.'
  },
  prevention:{
    theme:'monitor',title:'Prevención',source:'INDECI / IGP / entidades competentes',
    intro:'Las tarjetas resumen acciones preventivas antes, durante y después de una emergencia.',
    items:[['#1678b4','','Antes','Preparación y reducción de vulnerabilidad.'],['#f0a221','','Durante','Protección inmediata y seguimiento de indicaciones oficiales.'],['#35a769','','Después','Evaluación, réplicas y retorno seguro.']],
    note:'Ante una emergencia real, siguen prevaleciendo las instrucciones de las autoridades.'
  },
  method:{
    theme:'monitor',title:'Metodología y fuentes',source:'GeoSismosLatam',
    intro:'Explica de dónde provienen los datos, cómo se procesan y cuáles son las limitaciones del portal.',
    items:[['#35a769','','Oficial','Dato publicado por una entidad competente.'],['#2f9bd7','','Procesamiento propio','Visualización, integración o cálculo realizado por GeoSismosLatam.'],['#f0a221','','Experimental','Modelo o estimación sujeta a validación.']],
    note:'Citar una entidad no implica afiliación, patrocinio ni respaldo institucional.'
  }
};
function legendRows(items){
  return (items||[]).map(([color,shape,title,desc])=>`<tr><td><span class="legend-chip"><i class="legend-symbol ${shape||''}" style="background:${color};border-color:${shape==='outline'?color:'#ffffff55'}"></i><code>${esc(color)}</code></span></td><td><b>${esc(title)}</b></td><td>${esc(desc)}</td></tr>`).join('');
}
function legendScale(items){
  const cols=(items||[]).map(x=>x[0]).filter(Boolean);
  if(!cols.length)return '';
  return cols.map((c,i)=>`<span style="background:${c}" title="${esc((items[i]&&items[i][2])||'')}"></span>`).join('');
}
function placeLegendInView(view){
  const box=$('contextLegend'),target=$(view); if(!box||!target)return;
  target.appendChild(box);
}
const LEGEND_STATE={};
function setContextLegend(view,override={}){
  const cfg={...(LEGENDS[view]||LEGENDS.monitor),...override};
  LEGEND_STATE[view]=cfg;
  const box=$('contextLegend'); if(!box)return;
  box.className=`map-legend-panel theme-${cfg.theme||view}`;
  $('contextLegendTitle').textContent=cfg.title||'Cómo leer este visor';
  $('contextLegendSource').textContent=cfg.source||'GeoSismosLatam';
  $('contextLegendIntro').textContent=cfg.intro||'';
  $('contextLegendItems').innerHTML=legendRows(cfg.items||[]);
  if($('contextLegendScale')) $('contextLegendScale').innerHTML=legendScale(cfg.items||[]);
  $('contextLegendNote').textContent=cfg.note||'';
  if($('contextLegendMode')) $('contextLegendMode').textContent=cfg.modeLabel||'LEYENDA CONTEXTUAL';
  if($('contextLegendSituation')) $('contextLegendSituation').textContent=cfg.situation||cfg.title||'Vista general';
  if($('contextLegendVariable')) $('contextLegendVariable').textContent=cfg.variable||'—';
  if($('contextLegendUnit')) $('contextLegendUnit').textContent=cfg.unit||'—';
  if($('contextLegendHorizon')) $('contextLegendHorizon').textContent=cfg.horizon||'Actual';
  placeLegendInView(view);
}
function restoreContextLegend(view){ if(LEGEND_STATE[view]) setContextLegend(view,LEGEND_STATE[view]); else setContextLegend(view); }
function toggleContextLegend(){ /* V11: la leyenda ya no es desplegable ni flotante. */ }

function showView(id){
  restoreContextLegend(id);
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.mainnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  setTimeout(()=>{if(maps[id+'Map'])maps[id+'Map'].invalidateSize();if(id==='monitor')maps.map.invalidateSize();if(id==='forecast'){maps.forecastMap.invalidateSize();ensureForecastData()}if(id==='risk'){maps.riskMap.invalidateSize();if(!riskWms)initRisk()}if(id==='soil')maps.soilMap.invalidateSize();if(id==='rain'){maps.rainMap.invalidateSize();if(!rainLayer)loadRain(currentRainMode||'now')}if(id==='marine'){maps.marineMap.invalidateSize();renderMarinePorts()}if(id==='agriculture'){maps.agriMap.invalidateSize();initAgriculture()}if(id==='risk'){maps.riskMap.invalidateSize();refreshRiskMode()}},120);
}


const normTxt=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function geoNames(props={}){
  const pick=(arr)=>{for(const k of arr)if(props[k]!=null&&String(props[k]).trim())return String(props[k]).trim();return''};
  return {
    dep:pick(['NOMBDEP','DEPARTAMEN','DEPARTAMENTO','NOM_DEP','department','dpto','DPTO']),
    prov:pick(['NOMBPROV','PROVINCIA','NOM_PROV','province','prov']),
    dist:pick(['NOMBDIST','DISTRITO','NOM_DIST','district','dist']),
    ubigeo:pick(['UBIGEO','IDDIST','CODDIST','ID_UBIGEO','ubigeo'])
  };
}
function hashColor(s){
  let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;
  return `hsl(${h%360} 68% 48%)`;
}
function causeBorder(cause){
  const n=normTxt(cause);
  return n.includes('DEFICIT HIDRICO')?'#f0a21a':'#2da7e6';
}
async function fetchEmergencyData(force=false){
  if(emergencyData&&!force)return emergencyData;
  try{
    emergencyData=await get('/api/emergencies',25000);
    $('emergencyCount').textContent=emergencyData.districts?.length||0;
    $('emergencyUpdated').textContent=clockFmt.format(new Date(emergencyData.generatedAt||Date.now()));
    return emergencyData;
  }catch(e){
    $('emergencyCount').textContent='—';$('emergencyUpdated').textContent='sin conexión';return null;
  }
}
function emergencyMatch(feature,data){
  const n=geoNames(feature.properties||{}), dn=normTxt(n.dist),pn=normTxt(n.prov),depn=normTxt(n.dep);
  const candidates=(data?.districts||[]).filter(x=>normTxt(x.district)===dn);
  if(!candidates.length)return null;
  return candidates.find(x=>(!x.province||normTxt(x.province)===pn)&&(!x.department||normTxt(x.department)===depn))||candidates[0];
}
async function showEmergencyLayer(filterCause='all'){
  if(riskWms){try{maps.riskMap.removeLayer(riskWms)}catch{}riskWms=null}
  const [geo,data]=await Promise.all([ensureDistrict(),fetchEmergencyData(true)]);
  if(!geo||!data){setLayerStatus('riskStatus','No fue posible cargar la información de estados de emergencia.',false);return}
  if(riskDistrictLayer)maps.riskMap.removeLayer(riskDistrictLayer);
  riskDistrictLayer=L.geoJSON(geo,{
    style:f=>{
      const m=emergencyMatch(f,data);
      if(!m)return {color:'#5f7788',weight:.25,fillOpacity:0};
      if(filterCause==='elnino'&&!normTxt(m.cause).includes('NINO'))return {color:'#5f7788',weight:.2,fillOpacity:0};
      const name=geoNames(f.properties||{}),fill=hashColor(name.ubigeo||name.dist+name.prov);
      return {color:causeBorder(m.cause),weight:1.6,fillColor:fill,fillOpacity:.62};
    },
    onEachFeature:(f,l)=>{
      const m=emergencyMatch(f,data);if(!m)return;
      const n=geoNames(f.properties||{});
      l.on('click',()=>{
        const days=Math.max(0,Math.ceil((Date.parse(m.end)-Date.now())/86400000));
        $('riskInfoTitle').textContent=`${n.dist||m.district} · Estado de Emergencia`;
        $('riskInfoText').textContent=m.cause;
        $('riskInfoFacts').innerHTML=`<span>Departamento</span><b>${esc(n.dep||m.department||'—')}</b><span>Provincia</span><b>${esc(n.prov||m.province||'—')}</b><span>Decreto</span><b>${esc(m.decree)}</b><span>Vigencia restante</span><b>${days} días aprox.</b><span>Fin configurado</span><b>${new Date(m.end).toLocaleDateString('es-PE')}</b>`;
        $('riskInfoLinks').innerHTML=`<a target="_blank" rel="noopener" href="${esc(m.official)}">Ver norma oficial ↗</a>`;
      });
      l.bindTooltip(`${n.dist||m.district} · ${m.decree}`,{sticky:true});
    }
  }).addTo(maps.riskMap);
  $('emergencyLegend').classList.remove('hidden');
  setLayerStatus('riskStatus',`Estados de emergencia vigentes cargados: ${data.districts?.length||0}. Revisión automática cada 30 min.`,true);
}
async function loadEnfen(){
  try{
    enfenData=await get('/api/enfen',15000);
    $('enfenState').textContent=(enfenData.status||enfenData.title||'ENFEN').trim();
    $('enfenSummary').textContent=(enfenData.summary||'Consulta el último comunicado oficial.').slice(0,700);
    return enfenData;
  }catch(e){$('enfenState').textContent='ENFEN temporalmente no disponible';return null}
}
async function loadSigridWatch(){
  try{
    sigridData=await get('/api/sigrid/latest',15000);
    $('sigridWatchBadge').textContent=sigridData.ok?'ACTUALIZADO':'REVISAR';
    $('sigridWatchTitle').textContent='SIGRID / CENEPRED · fuentes verificadas';
    $('sigridWatchText').textContent='Revisión automática de fuentes oficiales configuradas. Cada documento conserva enlace directo y estado de disponibilidad.';
    $('sigridWatchFacts').innerHTML=`<span>Última revisión</span><b>${pe(sigridData.checkedAt)}</b><span>Fuentes disponibles</span><b>${(sigridData.sources||[]).filter(x=>x.ok).length} / ${(sigridData.sources||[]).length}</b>`;
    $('sigridWatchLinks').innerHTML=(sigridData.sources||[]).map(x=>`<a target="_blank" rel="noopener" href="${esc(x.url)}">${esc(x.name)} ↗</a>`).join('');
  }catch(e){$('sigridWatchBadge').textContent='SIN RESPUESTA';$('sigridWatchText').textContent='No fue posible verificar las fuentes SIGRID/CENEPRED en esta consulta.'}
}
function riskLegendFor(mode,layer='mass'){
  if(mode==='emergency') return {modeLabel:'VIGENCIA LEGAL',items:[['#2da7e6','outline','Borde azul','Declaratoria vinculada a lluvias, El Niño u otra causa hídrica configurada.'],['#f0a21a','outline','Borde ámbar','Declaratoria asociada a déficit hídrico.'],['#8b5cf6','','Relleno distrital','Color de identificación territorial; no representa nivel de riesgo.'],['#5f7788','outline','Sin relleno','Distrito no coincidente con declaratoria vigente cargada.']],note:'El color interior permite diferenciar distritos. El borde y la ficha explican la causa y el decreto.'};
  if(mode==='elnino') return {modeLabel:'EL NIÑO / ESCENARIOS',items:[['#2da7e6','outline','Ámbito vinculado','Declaratoria o escenario vinculado a lluvia/El Niño según fuente cargada.'],['#f0a21a','outline','Déficit hídrico','Ámbito vinculado a déficit hídrico cuando corresponda.'],['#8b5cf6','','Distrito resaltado','Identificación territorial, no intensidad del fenómeno.']],note:'La intensidad y probabilidad de El Niño deben leerse en el comunicado ENFEN y escenario CENEPRED correspondiente.'};
  if(mode==='impacts') return {modeLabel:'AFECTACIONES',items:[['#d83a3a','','Personas / vivienda','Categorías de daño humano o habitacional cuando estén presentes.'],['#ef9f32','','Infraestructura / transporte','Afectaciones a vías, puentes o infraestructura.'],['#5e9fd6','','Servicios / agua','Afectaciones a servicios básicos o hidráulicos.'],['#70a84f','','Agricultura','Daños o afectación de medios de vida agrícolas.']],note:'Solo se pinta información que provenga de una fuente identificada; prensa/redes deben rotularse como no oficiales.'};
  const name={mass:'Movimientos en masa',flood:'Inundación fluvial',hazards:'Peligros geológicos',igp:'Geodinámica IGP'}[layer]||'Peligro territorial';
  return {modeLabel:'SIMBOLOGÍA DE FUENTE',items:[['#4aa564','','Baja / menor susceptibilidad','Cuando la capa oficial usa una escala ordinal, los tonos inferiores representan menor condición relativa.'],['#e0c84a','','Media','Condición intermedia según la simbología del servicio.'],['#ef8c32','','Alta','Mayor susceptibilidad o categoría superior.'],['#d53b3b','','Muy alta','Categoría más alta cuando exista en el servicio.'],['#ffffff','outline',name,'Haz clic sobre el mapa para ver coordenadas y contexto de la capa activa.']],note:'INGEMMET/IGP pueden usar colores distintos por producto. La simbología y atributos oficiales del servicio prevalecen sobre esta guía general.'};
}
function setRiskLegend(mode,layer='mass',override={}){
  const x=riskLegendFor(mode,layer);
  const layerName={mass:'Susceptibilidad por movimientos en masa',flood:'Susceptibilidad a inundación fluvial',hazards:'Peligros geológicos inventariados',igp:'Geodinámica IGP'}[layer]||'Riesgo territorial';
  const title='Riesgos · '+(mode==='hazards'?layerName:mode==='emergency'?'Estados de Emergencia':mode==='elnino'?'Fenómeno El Niño':'Afectaciones');
  const meta=mode==='hazards'?{variable:layerName,unit:'Categoría / clase de la fuente',horizon:'Condición cartografiada'}:
    mode==='emergency'?{variable:'Declaratoria y causal',unit:'Vigencia legal / ámbito distrital',horizon:'Plazo vigente'}:
    mode==='elnino'?{variable:'Escenario climático y exposición',unit:'Categoría / probabilidad oficial',horizon:'Periodo del comunicado/escenario'}:
    {variable:'Tipo de afectación',unit:'Categoría / conteo según fuente',horizon:'Evento / periodo reportado'};
  setContextLegend('risk',{title,source:mode==='hazards'?'INGEMMET / IGP':mode==='emergency'?'PCM / El Peruano':mode==='elnino'?'ENFEN / CENEPRED / PCM':'INDECI / COEN / CENEPRED',intro:'La tabla corresponde únicamente a la capa visible en este momento. Si cambias de peligro, modo o selección, la interpretación también cambia.',items:x.items,note:x.note,modeLabel:x.modeLabel,situation:title,...meta,...override});
}

async function setRiskMode(mode){
  riskMode=mode;
  setRiskLegend(mode,'mass');
  document.querySelectorAll('[data-riskmode]').forEach(b=>b.classList.toggle('active',b.dataset.riskmode===mode));
  $('riskHazardToolbar').classList.toggle('hidden',mode!=='hazards');
  $('emergencyLegend').classList.add('hidden');
  if(riskDistrictLayer){maps.riskMap.removeLayer(riskDistrictLayer);riskDistrictLayer=null}
  if(mode==='hazards'){
    $('riskInfoTitle').textContent='Peligros territoriales';
    $('riskInfoText').textContent='Selecciona una capa oficial de INGEMMET o IGP.';
    loadRisk('mass'); return;
  }
  if(mode==='emergency'){
    $('riskLayerTitle').textContent='PCM / El Peruano · Estados de Emergencia vinculados a desastre o peligro inminente';
    $('riskInfoTitle').textContent='Estados de emergencia vigentes';
    $('riskInfoText').textContent='Los distritos se pintan únicamente cuando la declaratoria configurada está dentro de su plazo de vigencia.';
    await showEmergencyLayer('all');return;
  }
  if(mode==='elnino'){
    $('riskLayerTitle').textContent='ENFEN + PCM + CENEPRED · Fenómeno El Niño';
    $('riskInfoTitle').textContent='Desarrollo de El Niño';
    $('riskInfoText').textContent='La síntesis se obtiene del último comunicado oficial ENFEN disponible.';
    await loadEnfen();await showEmergencyLayer('elnino');
    const e=enfenData;
    if(e)$('riskInfoFacts').innerHTML=`<span>Comunicado</span><b>${esc(e.title||'—')}</b><span>Estado</span><b>${esc(e.status||'—')}</b>`;
    return;
  }
  if(mode==='impacts'){
    if(riskWms){try{maps.riskMap.removeLayer(riskWms)}catch{}riskWms=null}
    $('riskLayerTitle').textContent='SINAGERD · categorías de afectación';
    $('riskInfoTitle').textContent='Afectaciones y daños';
    $('riskInfoText').textContent='El módulo organiza afectaciones a personas, viviendas, agricultura, transporte, salud, educación, servicios básicos y riego. Los datos oficiales deben prevalecer sobre prensa y redes.';
    $('riskInfoFacts').innerHTML='<span>Prioridad</span><b>INDECI / COEN / CENEPRED</b><span>Complemento</span><b>Medios identificados y claramente rotulados</b>';
    $('riskInfoLinks').innerHTML='<a target="_blank" rel="noopener" href="https://portal.indeci.gob.pe/">INDECI ↗</a><a target="_blank" rel="noopener" href="https://sigrid4.cenepred.gob.pe/">SIGRID ↗</a>';
  }
}
function refreshRiskMode(){setRiskMode(riskMode)}
async function initAgriculture(){
  if(!agriData){try{agriData=await get('/api/agriculture',15000)}catch{}}
  const geo=await ensureDistrict();
  if(geo&&!agriDistrictLayer){
    agriDistrictLayer=L.geoJSON(geo,{
      style:{color:'#d6e0aa',weight:.45,fillColor:'#77943b',fillOpacity:.08},
      onEachFeature:(f,l)=>{
        l.on('click',()=>selectAgriDistrict(f,l));
        const n=geoNames(f.properties||{}); if(n.dist)l.bindTooltip(n.dist,{sticky:true});
      }
    }).addTo(maps.agriMap);
  }
  renderAgriSelection();
}
function cropInfo(){
  const k=$('agriCropSelect').value;
  return agriData?.crops?.[k]||{name:$('agriCropSelect').selectedOptions[0]?.textContent||'Cultivo',months:5,planting:'variable',harvest:'variable',note:'Referencia general.'};
}
function selectAgriDistrict(feature,layer){
  selectedAgriFeature=feature;
  if(agriDistrictLayer)agriDistrictLayer.eachLayer(l=>l.setStyle&&l.setStyle({fillOpacity:.08,weight:.45,color:'#d6e0aa'}));
  layer.setStyle({fillOpacity:.38,weight:2,color:'#b8ef69',fillColor:'#6a8d31'});
  const n=geoNames(feature.properties||{});
  $('agriAreaTitle').textContent=[n.dist,n.prov,n.dep].filter(Boolean).join(' · ')||'Distrito seleccionado';
  $('agriAreaText').textContent='GeoSismosLatam muestra el ciclo referencial del cultivo seleccionado y enlaza las fuentes oficiales. No inventa superficie sembrada cuando no existe un dato verificable accesible.';
  renderAgriSelection();
}
function renderAgriSelection(){
  const c=cropInfo(),n=selectedAgriFeature?geoNames(selectedAgriFeature.properties||{}):{};
  setContextLegend('agriculture',{title:'Agricultura · '+c.name,source:'MIDAGRI / SIEA',intro:'La leyenda corresponde al cultivo y distrito actualmente seleccionados. El color territorial no representa rendimiento o producción salvo que una capa cuantitativa lo indique expresamente.',items:[['#77943b','','Distrito disponible','Unidad territorial consultable.'],['#6a8d31','','Distrito seleccionado','Ámbito activo para la ficha del cultivo.'],['#b8ef69','outline','Borde seleccionado','Resalta el distrito elegido.'],['#d6e0aa','line','Límite distrital','Referencia administrativa del visor.']],note:'Cuando exista una escala cuantitativa real de siembra/rendimiento, esta misma tabla cambiará a sus unidades, rangos y nivel de confianza.',modeLabel:'CAMPAÑA AGRÍCOLA',situation:(n.dist?`${c.name} · ${n.dist}`:`${c.name} · vista nacional`),variable:'Ámbito/ciclo del cultivo',unit:'Distrito · etapa fenológica/campaña',horizon:agriData?.campaign||'2026-2027'});
  $('agriCropTitle').textContent=c.name;
  $('agriCropText').textContent=c.note;
  $('agriFacts').innerHTML=`<span>Campaña</span><b>${esc(agriData?.campaign||'2026-2027')}</b><span>Siembra referencial</span><b>${esc(c.planting)}</b><span>Cosecha referencial</span><b>${esc(c.harvest)}</b><span>Fuente metodológica</span><b>MIDAGRI / SIEA</b>`;
  const months=+c.months||0;
  $('agriHarvestEstimate').innerHTML=`<b>Estimación orientativa</b><p>Si se conoce el mes real de siembra, una primera aproximación de cosecha puede obtenerse desplazando alrededor de <strong>${months} meses</strong>, sujeto a variedad, clima, altitud y manejo. Para una cifra productiva use SIEA y reportes locales.</p>`;
  const model=agriData?.model||{};$('agriOpportunity').textContent=model.status==='ready'?(model.index+' / 100'):'DATOS INSUFICIENTES';$('agriConfidence').textContent=model.status==='ready'?(model.confidence||'—'):'—';$('agriSample').textContent=model.samples||'Sin serie distrital integrada';$('agriHorizon').textContent=model.horizon||'Campaña 2026-2027';$('agriModelText').textContent=model.status==='ready'?model.note:'El portal no inventará una probabilidad de siembra. El cálculo se habilita cuando MIDAGRI/SIEA, clima y series históricas verificables estén integradas para el distrito y cultivo.';
}

const marinePorts=[
  {name:'Zorritos',lat:-3.68,lon:-80.68,zone:'north'},
  {name:'Cabo Blanco',lat:-4.25,lon:-81.23,zone:'north'},
  {name:'Talara',lat:-4.58,lon:-81.27,zone:'north'},
  {name:'Paita',lat:-5.09,lon:-81.11,zone:'north'},
  {name:'Bayóvar',lat:-5.77,lon:-81.05,zone:'north'},
  {name:'Eten',lat:-6.91,lon:-79.87,zone:'north'},
  {name:'Malabrigo',lat:-7.70,lon:-79.44,zone:'north'},
  {name:'Salaverry',lat:-8.23,lon:-78.98,zone:'north'},
  {name:'Chimbote',lat:-9.08,lon:-78.60,zone:'north'},
  {name:'Huarmey',lat:-10.07,lon:-78.15,zone:'center'},
  {name:'Huacho',lat:-11.11,lon:-77.61,zone:'center'},
  {name:'Chancay',lat:-11.57,lon:-77.27,zone:'center'},
  {name:'Ancón',lat:-11.77,lon:-77.18,zone:'center'},
  {name:'Callao',lat:-12.06,lon:-77.15,zone:'center'},
  {name:'Cerro Azul',lat:-13.03,lon:-76.48,zone:'center'},
  {name:'Pisco',lat:-13.71,lon:-76.21,zone:'center'},
  {name:'San Juan de Marcona',lat:-15.36,lon:-75.16,zone:'south'},
  {name:'Chala',lat:-15.86,lon:-74.25,zone:'south'},
  {name:'Atico',lat:-16.23,lon:-73.61,zone:'south'},
  {name:'Matarani',lat:-17.00,lon:-72.11,zone:'south'},
  {name:'Ilo',lat:-17.65,lon:-71.34,zone:'south'}
];
let marineFilter='all';
function renderMarinePorts(){
  if(!maps.marineMap)return;
  if(!marineLayer)marineLayer=L.layerGroup().addTo(maps.marineMap);
  marineLayer.clearLayers();
  const pts=marinePorts.filter(p=>marineFilter==='all'||p.zone===marineFilter);
  pts.forEach(p=>{
    const mk=L.circleMarker([p.lat,p.lon],{radius:6,color:'#d7f4ff',weight:1.5,fillColor:'#20a8d8',fillOpacity:.9}).addTo(marineLayer);
    mk.bindPopup(`<div class="popup"><b>${esc(p.name)}</b><p>Puerto/sector costero de consulta referencial.</p><p>Antes de una salida revisa mareas, viento, oleaje, vedas y restricciones locales.</p><a target="_blank" rel="noopener" href="https://www.dhn.mil.pe/portal/tabla-mareas">Tabla de mareas DHN ↗</a></div>`);
    mk.on('click',()=>setContextLegend('marine',{title:`Mar y pesca · ${p.name}`,source:'DHN / PRODUCE / IMARPE',intro:'Punto costero seleccionado. La leyenda cambia a la situación del puerto/sector y no implica peligro por sí misma.',situation:`Puerto/sector · ${p.name}`,variable:'Mareas / oleaje / viento / restricciones',unit:'Según producto DHN/IMARPE/PRODUCE',horizon:'Condición y avisos vigentes',items:[['#20a8d8','circle','Punto seleccionado',`Puerto o sector costero: ${p.name}.`],['#55b7dc','line','Mar/oleaje','Consultar altura, periodo y avisos en DHN cuando estén disponibles.'],['#f0a221','outline','Restricción/aviso','Verificar Capitanía, PRODUCE e IMARPE antes de una actividad.']]}));
  });
  const bounds=marineFilter==='north'?[[-9.8,-82.3],[-3,-78.5]]:marineFilter==='center'?[[-15,-79],[-9.5,-75]]:marineFilter==='south'?[[-18.5,-76],[-13.5,-70]]:[[-18.6,-82.4],[-3,-70]];
  maps.marineMap.fitBounds(bounds,{padding:[15,15]});
}
function setMarineFilter(v){
  marineFilter=v;
  setContextLegend('marine',{title:'Mar y pesca · '+(v==='all'?'todo el litoral':v==='north'?'costa norte':v==='center'?'costa central':'costa sur'),source:'DHN / PRODUCE / IMARPE',intro:'La tabla corresponde al sector costero visible. Los marcadores son puntos de consulta, no niveles de peligro.',situation:(v==='all'?'Todo el litoral':v==='north'?'Costa norte':v==='center'?'Costa central':'Costa sur'),variable:'Puntos costeros / condiciones marinas',unit:'Puerto/sector + parámetros de la fuente',horizon:'Condición/aviso vigente'});
  document.querySelectorAll('#marineNorth,#marineCenter,#marineSouth,#marineAll').forEach(b=>b.classList.remove('active'));
  const id=v==='north'?'marineNorth':v==='center'?'marineCenter':v==='south'?'marineSouth':'marineAll';
  $(id)?.classList.add('active');
  renderMarinePorts();
}
function renderFishingSectors(){
  const groups=[
    ['Costa norte','Cabo Blanco · Talara · Paita','Consulta mareas y viento; prioriza captura y liberación de especies protegidas y verifica vedas/tallas vigentes.'],
    ['Costa norte-centro','Salaverry · Chimbote · Huarmey','Planifica según oleaje, acceso seguro y restricciones locales. No dejes líneas, anzuelos ni residuos.'],
    ['Costa central','Huacho · Ancón · Callao · Cerro Azul','Evita zonas portuarias restringidas y verifica avisos de Capitanía y estado del mar antes de ingresar a roqueríos o embarcar.'],
    ['Ica','Pisco · San Juan de Marcona','Atención especial a áreas protegidas y zonas de conservación; confirma dónde está permitida la pesca recreativa.'],
    ['Costa sur','Chala · Atico · Matarani · Ilo','Revisa viento y oleaje DHN; captura únicamente recursos permitidos y respeta tallas mínimas y vedas.']
  ];
  $('fishingSectors').innerHTML=groups.map(g=>`<div class="sector-item"><b>${g[0]}</b><strong>${g[1]}</strong><p>${g[2]}</p></div>`).join('');
}
function refreshMeteoImages(){
  const t=Date.now();
  ['goesImage','dhnWindImage','marineWindImage'].forEach(id=>{const el=$(id);if(el)el.src=(id==='goesImage'?'/api/noaa/geocolor':'/api/dhn/wind')+'?t='+t});
}


const SOUND_OPTIONS=[
 ['sirena_emergencia','🚨 Sirena de emergencia'],
 ['sirena_sismica','🚨 Sirena sísmica intensa'],
 ['radar_alerta','📡 Alerta radar'],
 ['campana_urgente','🔔 Campana urgente'],
 ['alerta_tecnologica','🤖 Alerta tecnológica'],
 ['corre_perra','😂 ¡Corre perra, coooorreee!'],
 ['corran_todos','🏃 ¡Corran todos, está temblando!'],
 ['se_mueve','😅 ¡Se mueve, se mueve!'],
 ['despierta','😴 ¡Despierta, está temblando!'],
 ['panic_mode','🚨 Panic Mode'],
 ['detectado_peruano','🇵🇪 Detectado peruano'],
 ['danger_alarm_meme','⚠️ Danger Alarm Meme'],
 ['ayuda_2','🆘 ¡Ayuda!'],
 ['alarm_sound_effect','🔊 Alarm Sound Effect']
];
let soundPreview=null;
function nativeBridge(){return window.GeoSismosAndroid&&typeof window.GeoSismosAndroid.setEarthquakeSound==='function'?window.GeoSismosAndroid:null}
function soundStatus(msg,ok=true){
  const el=$('soundPreviewStatus');if(!el)return;
  el.textContent=msg;el.classList.toggle('error',!ok);
}
function renderSoundOptions(){
  const box=$('soundOptions');if(!box)return;
  try{const b=nativeBridge();if(b&&b.getEarthquakeSound)selectedSound=b.getEarthquakeSound()||selectedSound}catch(e){}
  box.innerHTML=SOUND_OPTIONS.map(([k,n])=>`<div class="sound-option ${k===selectedSound?'selected':''}"><button class="sound-select" data-sound-select="${k}" title="Usar este sonido">${n}</button><button class="sound-preview" data-sound-preview="${k}" type="button">▶ Probar</button></div>`).join('');
  box.querySelectorAll('[data-sound-select]').forEach(b=>b.onclick=()=>selectEarthquakeSound(b.dataset.soundSelect));
  box.querySelectorAll('[data-sound-preview]').forEach(b=>b.onclick=()=>previewEarthquakeSound(b.dataset.soundPreview,b));
}
function selectEarthquakeSound(k){
  selectedSound=k;localStorage.setItem('gsl_sound',k);try{const b=nativeBridge();if(b)b.setEarthquakeSound(k)}catch(e){}renderSoundOptions();previewEarthquakeSound(k);
}
async function previewEarthquakeSound(k,button=null){
  const label=(SOUND_OPTIONS.find(x=>x[0]===k)||[k,k])[1];
  try{
    const b=nativeBridge();
    if(b&&b.previewEarthquakeSound){
      b.previewEarthquakeSound(k);soundStatus(`Reproduciendo en Android: ${label}`);return;
    }
  }catch(e){}
  try{
    if(soundPreview){soundPreview.pause();soundPreview.currentTime=0;soundPreview=null}
    const url=new URL(`sounds/${encodeURIComponent(k)}.wav?v=11.0`,document.baseURI).href;
    const audio=new Audio();
    soundPreview=audio;
    audio.preload='auto';
    audio.volume=1;
    audio.src=url;
    audio.onplaying=()=>{soundStatus(`Reproduciendo: ${label}`);if(button)button.textContent='■ Sonando'};
    audio.onended=()=>{soundStatus(`Prueba finalizada: ${label}`);if(button)button.textContent='▶ Probar';if(soundPreview===audio)soundPreview=null};
    audio.onerror=()=>{soundStatus(`No se pudo cargar ${label}. Verifica que /sounds/${k}.wav esté publicado.`,false);if(button)button.textContent='▶ Probar'};
    await audio.play();
  }catch(e){
    soundStatus(`El navegador bloqueó o no pudo reproducir ${label}. Pulsa otra vez ▶ Probar y revisa el volumen del navegador.`,false);
    if(button)button.textContent='▶ Probar';
  }
}
function openSoundSettings(){renderSoundOptions();soundStatus('Selecciona ▶ Probar para escuchar un sonido.');$('soundSettings').classList.add('open');$('soundSettings').setAttribute('aria-hidden','false')}
function closeSoundSettings(){if(soundPreview){soundPreview.pause();soundPreview=null}$('soundSettings').classList.remove('open');$('soundSettings').setAttribute('aria-hidden','true')}


function bind(){
  document.querySelectorAll('.mainnav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $('soundSettingsBtn').onclick=openSoundSettings;$('closeSoundSettings').onclick=closeSoundSettings;
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
  document.querySelectorAll('[data-projmode]').forEach(b=>b.onclick=()=>{projectionMode=b.dataset.projmode;document.querySelectorAll('[data-projmode]').forEach(x=>x.classList.toggle('active',x===b));renderForecast()});
  document.querySelectorAll('.soil-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.soil-tabs button').forEach(x=>x.classList.toggle('active',x===b));setSoilLayer(b.dataset.soil)});
  maps.soilMap.on('click',e=>identifySoil(e.latlng));
  maps.rainMap.on('click',e=>{updateRainInfo(currentRainMode,e.latlng);const [t,d,src]=rainExplanation(currentRainMode,e.latlng);setRainLegend(currentRainMode,{title:t,source:src,intro:d+' Punto seleccionado: '+e.latlng.lat.toFixed(4)+', '+e.latlng.lng.toFixed(4)+'.'});});
  maps.riskMap.on('click',e=>{if(riskMode==='hazards'){$('riskInfoTitle').textContent='Punto consultado';$('riskInfoText').textContent='Ubicación seleccionada en la capa de peligro activa. La clase exacta debe verificarse con los atributos/simbología de la fuente oficial.';$('riskInfoFacts').innerHTML=`<span>Coordenadas</span><b>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</b><span>Modo</span><b>Peligros territoriales</b>`;setRiskLegend('hazards','mass',{intro:'Punto consultado: '+e.latlng.lat.toFixed(4)+', '+e.latlng.lng.toFixed(4)+'. La leyenda orienta la lectura; la clasificación exacta corresponde a la capa oficial activa.'});}});
  document.querySelectorAll('[data-riskmode]').forEach(b=>b.onclick=()=>setRiskMode(b.dataset.riskmode));
  $('agriCropSelect').onchange=renderAgriSelection;
  $('agriReset').onclick=()=>{selectedAgriFeature=null;maps.agriMap.fitBounds([[-20.5,-82.5],[-2,-68]],{padding:[8,8]});$('agriAreaTitle').textContent='Selecciona un distrito';$('agriAreaText').textContent='Al seleccionar un ámbito se mostrará el cultivo elegido, su ciclo referencial y los accesos a información oficial disponible.';renderAgriSelection()};
  document.querySelectorAll('.rain-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.rain-tabs button').forEach(x=>x.classList.toggle('active',x===b));loadRain(b.dataset.rain)});
  document.querySelectorAll('.risk-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.risk-tabs button').forEach(x=>x.classList.toggle('active',x===b));loadRisk(b.dataset.risk)});
  $('refreshSatellite').onclick=refreshMeteoImages;
  $('marineNorth').onclick=()=>setMarineFilter('north');
  $('marineCenter').onclick=()=>setMarineFilter('center');
  $('marineSouth').onclick=()=>setMarineFilter('south');
  $('marineAll').onclick=()=>setMarineFilter('all');
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
  initMaps();bind();setContextLegend('monitor');renderNews();renderFishingSectors();loadRain('now');initRisk();loadEnfen();loadSigridWatch();tick();setInterval(tick,1000);poll();setInterval(poll,10000);
  setTimeout(()=>renderForecast(),2500);setInterval(()=>{if(riskMode==='emergency'||riskMode==='elnino')fetchEmergencyData(true).then(()=>refreshRiskMode());loadSigridWatch()},30*60*1000);
});