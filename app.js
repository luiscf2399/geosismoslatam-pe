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
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  const start=audioCtx.currentTime;
  for(let i=0;i<14;i++){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=i%2?740:520;g.gain.setValueAtTime(.0001,start+i*.5);g.gain.exponentialRampToValueAtTime(.18,start+i*.5+.03);g.gain.exponentialRampToValueAtTime(.0001,start+i*.5+.42);o.connect(g).connect(audioCtx.destination);o.start(start+i*.5);o.stop(start+i*.5+.45)}
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
  document.querySelectorAll('[data-z]').forEach(x=>x.onclick=()=>{const c=top[+x.dataset.z];maps.forecastMap.flyTo([c.lat,c.lon],7)});
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
async function loadRain(mode='jja'){
  clearRain();
  const title=$('rainLayerTitle'), legend=$('rainLegendText');
  try{
    if(mode==='off'){setContextLegend('rain',{title:'Lluvias · sin capa temática',intro:'El mapa base permanece visible, pero no hay una capa meteorológica activa.'});title.textContent='Capas ocultas';legend.textContent='Seleccione una capa oficial para visualizarla.';setLayerStatus('rainStatus','Sin capa temática activa.',true);return}
    if(mode==='jja'){
      setContextLegend('rain',{title:'Lluvias · pronóstico estacional',source:'SENAMHI / IDESEP',intro:'Perspectiva climática estacional de precipitación. No representa lluvia observada en tiempo real.'});
      rainLayer=L.tileLayer.wms(SEN_JJA,{layers:SEN_JJA_LAYER,format:'image/png',transparent:true,opacity:.68,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
      title.textContent='SENAMHI · Pronóstico climático de precipitación JJA';if($('rainInfoTitle')){$('rainInfoTitle').textContent='Pronóstico climático estacional';$('rainInfoText').textContent='Representa una perspectiva climática estacional de precipitación. No equivale a lluvia observada en tiempo real.';$('rainInfoFacts').innerHTML='<span>Fuente</span><b>SENAMHI / IDESEP</b><span>Uso</span><b>Planificación preventiva</b>'};
      legend.textContent='Pronóstico climático estacional JJA. No equivale a lluvia observada en tiempo real.';
      setLayerStatus('rainStatus','SENAMHI: capa JJA solicitada al geoservicio oficial.',true); return;
    }
    if(mode==='aug'){
      rainLayer=L.tileLayer.wms(SEN_AUG,{layers:SEN_AUG_LAYER,format:'image/png',transparent:true,opacity:.65,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
      title.textContent='SENAMHI · Caracterización climatológica de precipitación · agosto';
      legend.textContent='Distribución climatológica de precipitación para agosto; sirve como referencia, no como monitoreo instantáneo.';
      setLayerStatus('rainStatus','SENAMHI: climatología de agosto solicitada al geoservicio oficial.',true); return;
    }
    if(mode==='numeric'){
      setContextLegend('rain',{title:'Lluvias · pronóstico numérico',source:'SENAMHI',intro:'Pronóstico modelado. Revisa siempre fecha y hora de validez del producto.'});
      setLayerStatus('rainStatus','Consultando predicción numérica SENAMHI…',true);
      const lyr=await discoverWms(SEN_NUM,['prec','precip','lluv']);
      rainLayer=L.tileLayer.wms(SEN_NUM,{layers:lyr.name,format:'image/png',transparent:true,opacity:.72,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
      title.textContent='SENAMHI · Predicción numérica · '+(lyr.title||lyr.name);if($('rainInfoTitle')){$('rainInfoTitle').textContent='Pronóstico numérico';$('rainInfoText').textContent='Modelo numérico oficial disponible mediante el geoservicio SENAMHI. Verifica la fecha y hora de validez del producto.';$('rainInfoFacts').innerHTML='<span>Fuente</span><b>SENAMHI</b><span>Tipo</span><b>Pronóstico modelado</b>'};
      legend.textContent='Pronóstico numérico oficial de precipitación. Consulta la fecha de validez del producto original antes de interpretarlo.';
      setLayerStatus('rainStatus','Capa de predicción numérica cargada.',true); return;
    }
    setContextLegend('rain',{title:mode==='24h'?'Lluvias intensas · 24 h':'Activación de quebradas',source:'SENAMHI',intro:mode==='24h'?'Producto preventivo de corto plazo ante lluvias intensas.':'Producto oficial de posibilidad de activación de quebradas. La vigencia y nivel dependen del aviso publicado.'});
    const base=mode==='24h'?SEN_24H:SEN_Q;
    setLayerStatus('rainStatus','Consultando catálogo WMS de SENAMHI…',true);
    const lyr=await discoverWms(base,mode==='24h'?['lluv','precip','24h','aviso']:['queb','activ']);
    rainLayer=L.tileLayer.wms(base,{layers:lyr.name,format:'image/png',transparent:true,opacity:.72,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
    title.textContent='SENAMHI · '+(lyr.title||lyr.name);
    legend.textContent=mode==='24h'?'Aviso/capa de corto plazo ante lluvias intensas publicada por SENAMHI.':'Aviso oficial de activación de quebradas publicado por SENAMHI.';
    setLayerStatus('rainStatus','Capa oficial cargada: '+(lyr.title||lyr.name),true);
  }catch(e){
    title.textContent='SENAMHI · capa dinámica no disponible';
    legend.textContent='El geoservicio dinámico no respondió al navegador. Se muestra automáticamente el pronóstico estacional JJA como respaldo.';
    setLayerStatus('rainStatus','La capa de corto plazo no respondió. Mostrando respaldo oficial JJA.',false);
    rainLayer=L.tileLayer.wms(SEN_JJA,{layers:SEN_JJA_LAYER,format:'image/png',transparent:true,opacity:.68,version:'1.1.1',attribution:'SENAMHI · IDESEP'}).addTo(maps.rainMap);
  }
}
function clearRisk(){
  if(riskWms){try{maps.riskMap.removeLayer(riskWms)}catch{} riskWms=null}
}
function loadRisk(mode='mass'){
  clearRisk();
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
function setSoilLayer(id){
  const names={9:'Zonificación sísmica-geotécnica',4:'Tipos de suelo',5:'Capacidad portante',2:'Geología',1:'Geomorfología',3:'Geodinámica',10:'Área estudiada'};
  try{
    const layerExplain={9:'Zonificación sísmica-geotécnica: clasifica zonas según respuesta esperada del terreno.',4:'Tipos de suelo: muestra unidades o perfiles identificados en los estudios.',5:'Capacidad portante: referencia geotécnica de resistencia del terreno donde existe estudio.',2:'Geología: unidades y materiales geológicos mapeados.',1:'Geomorfología: formas del relieve y procesos que modelan el terreno.',3:'Geodinámica: procesos activos o potenciales que pueden afectar el territorio.',10:'Área estudiada: delimita dónde existe información técnica publicada por el IGP.'};
    setContextLegend('soil',{title:'Suelos · '+(names[id]||'capa IGP'),source:'IGP · Zonifica Perú',intro:layerExplain[id]||LEGENDS.soil.intro});
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
      return;
    }
    const groups=rs.slice(0,8).map(r=>{
      const a=r.attributes||{}, vals=Object.entries(a).filter(([k,v])=>v!==null&&v!==''&&!/objectid/i.test(k)).slice(0,4);
      return `<div class="study-hit"><b>${esc(r.layerName||'Capa IGP')}</b>${vals.map(([k,v])=>`<small>${esc(k)}: ${esc(v)}</small>`).join('')}</div>`;
    }).join('');
    $('soilInfoTitle').textContent='Información IGP encontrada';
    $('soilInfoText').textContent='Resultados del servicio público de Estudios de Zonificación para el punto seleccionado.';
    $('soilInfoFacts').innerHTML=groups;
  }catch(e){
    $('soilInfoTitle').textContent='Servicio temporalmente no disponible';
    $('soilInfoText').textContent='No fue posible consultar el punto en este momento. Usa Zonifica Perú como fuente oficial de respaldo.';
  }
}

const LEGENDS={
  monitor:{
    theme:'monitor',title:'Monitoreo sísmico',source:'IGP/CENSIS + USGS',
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
    theme:'forecast',title:'Proyección experimental',source:'Modelo GeoSismosLatam',
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
    theme:'rain',title:'Lluvias y precipitación',source:'SENAMHI / NOAA / NASA / INDECI',
    intro:'Cada capa corresponde a un producto diferente: observación satelital, pronóstico modelado o aviso oficial.',
    items:[
      ['#2f9bd7','','Precipitación / lluvia','La escala exacta depende de la capa oficial seleccionada.'],
      ['#82d7ff','outline','Satélite','Imagen de nubosidad/atmósfera; no equivale directamente a lluvia acumulada.'],
      ['#f0a221','line','Aviso / quebradas','Producto preventivo; revisa nivel, fecha de emisión y vigencia.']
    ],
    note:'La leyenda cromática específica del WMS debe interpretarse con la simbología publicada por la fuente oficial.'
  },
  marine:{
    theme:'marine',title:'Mar, mareas y pesca',source:'DHN / PRODUCE / IMARPE',
    intro:'Los puntos del mapa son puertos o sectores de consulta para mareas y condiciones marinas.',
    items:[
      ['#20a8d8','circle','Puerto / sector','Referencia geográfica para consultar mareas y estado del mar.'],
      ['#ffffff','outline','LAM','No se traza automáticamente sin cartografía oficial sectorial.'],
      ['#35aabb','line','Condición marina','Revisa oleaje, viento, avisos y restricciones antes de salir.']
    ],
    note:'Los puntos no representan autorización de pesca ni garantizan presencia de especies.'
  },
  risk:{
    theme:'risk',title:'Riesgos y peligros',source:'CENEPRED / INDECI / PCM / INGEMMET / ENFEN',
    intro:'La simbología cambia según el modo seleccionado: peligros, estados de emergencia, El Niño o afectaciones.',
    items:[
      ['#2da7e6','outline','Borde azul','Declaratorias asociadas a lluvias o El Niño.'],
      ['#f0a21a','outline','Borde ámbar','Declaratorias asociadas a déficit hídrico.'],
      ['#8b5cf6','','Relleno por distrito','Diferencia visual entre distritos vigentes; no representa intensidad.']
    ],
    note:'Cuando vence el plazo configurado de una declaratoria, el distrito deja de mostrarse como vigente.'
  },
  soil:{
    theme:'soil',title:'Suelos y construcción segura',source:'IGP / Zonifica Perú',
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
    theme:'agri',title:'Agricultura y campaña agrícola',source:'MIDAGRI / SIEA',
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
  return (items||[]).map(([color,shape,title,desc])=>`<div class="legend-row"><i class="legend-symbol ${shape||''}" style="background:${color};border-color:${shape==='outline'?color:'#ffffff55'}"></i><div><b>${esc(title)}</b><small>${esc(desc)}</small></div></div>`).join('');
}
function setContextLegend(view,override={}){
  const cfg={...(LEGENDS[view]||LEGENDS.monitor),...override};
  const box=$('contextLegend'); if(!box)return;
  box.className=`context-legend theme-${cfg.theme||view}`;
  $('contextLegendTitle').textContent=cfg.title||'Cómo leer este visor';
  $('contextLegendMiniTitle').textContent=cfg.title||'Cómo leer este visor';
  $('contextLegendSource').textContent=cfg.source||'GeoSismosLatam';
  $('contextLegendMiniSource').textContent=cfg.source||'GeoSismosLatam';
  $('contextLegendIntro').textContent=cfg.intro||'';
  $('contextLegendItems').innerHTML=legendRows(cfg.items||[]);
  $('contextLegendNote').textContent=cfg.note||'';
}
function toggleContextLegend(){
  const box=$('contextLegend'),collapsed=box.classList.toggle('collapsed');
  $('contextLegendToggle').setAttribute('aria-expanded',String(!collapsed));
  $('contextLegendArrow').textContent=collapsed?'⌃':'⌄';
}

function showView(id){
  setContextLegend(id);
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.mainnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  setTimeout(()=>{if(maps[id+'Map'])maps[id+'Map'].invalidateSize();if(id==='monitor')maps.map.invalidateSize();if(id==='forecast'){maps.forecastMap.invalidateSize();ensureForecastData()}if(id==='risk'){maps.riskMap.invalidateSize();if(!riskWms)initRisk()}if(id==='soil')maps.soilMap.invalidateSize();if(id==='rain'){maps.rainMap.invalidateSize();if(!rainLayer)loadRain('jja')}if(id==='marine'){maps.marineMap.invalidateSize();renderMarinePorts()}if(id==='agriculture'){maps.agriMap.invalidateSize();initAgriculture()}if(id==='risk'){maps.riskMap.invalidateSize();refreshRiskMode()}},120);
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
async function setRiskMode(mode){
  riskMode=mode;
  if(mode==='hazards')setContextLegend('risk',{title:'Riesgos · peligros territoriales',source:'INGEMMET / IGP',intro:'Capas de susceptibilidad, peligros geológicos y geodinámica. El color depende de la simbología de la fuente oficial.'});
  if(mode==='emergency')setContextLegend('risk',{title:'Riesgos · Estados de Emergencia',source:'PCM / Diario Oficial El Peruano',intro:'Distritos con declaratorias vigentes vinculadas a desastre o peligro inminente dentro del SINAGERD.'});
  if(mode==='elnino')setContextLegend('risk',{title:'Riesgos · Fenómeno El Niño',source:'ENFEN / PCM / CENEPRED',intro:'Combina el estado oficial ENFEN con ámbitos declarados y escenarios disponibles.'});
  if(mode==='impacts')setContextLegend('risk',{title:'Riesgos · afectaciones',source:'INDECI / COEN / CENEPRED',intro:'Organiza daños y afectaciones por categoría. Los reportes secundarios se muestran separados de los oficiales.'});
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
  setContextLegend('agriculture',{title:'Agricultura · '+c.name,source:'MIDAGRI / SIEA',intro:'Selecciona un distrito para contextualizar el cultivo. El portal distingue datos oficiales de referencias agronómicas.'});
  $('agriCropTitle').textContent=c.name;
  $('agriCropText').textContent=c.note;
  $('agriFacts').innerHTML=`<span>Campaña</span><b>${esc(agriData?.campaign||'2026-2027')}</b><span>Siembra referencial</span><b>${esc(c.planting)}</b><span>Cosecha referencial</span><b>${esc(c.harvest)}</b><span>Fuente metodológica</span><b>MIDAGRI / SIEA</b>`;
  const months=+c.months||0;
  $('agriHarvestEstimate').innerHTML=`<b>Estimación orientativa</b><p>Si se conoce el mes real de siembra, una primera aproximación de cosecha puede obtenerse desplazando alrededor de <strong>${months} meses</strong>, sujeto a variedad, clima, altitud y manejo. Para una cifra productiva use SIEA y reportes locales.</p>`;
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
  });
  const bounds=marineFilter==='north'?[[-9.8,-82.3],[-3,-78.5]]:marineFilter==='center'?[[-15,-79],[-9.5,-75]]:marineFilter==='south'?[[-18.5,-76],[-13.5,-70]]:[[-18.6,-82.4],[-3,-70]];
  maps.marineMap.fitBounds(bounds,{padding:[15,15]});
}
function setMarineFilter(v){
  marineFilter=v;
  setContextLegend('marine',{title:'Mar y pesca · '+(v==='all'?'todo el litoral':v==='north'?'costa norte':v==='center'?'costa central':'costa sur'),source:'DHN / PRODUCE / IMARPE',intro:'Los marcadores son puntos costeros de consulta. Revisa mareas, oleaje, viento, vedas y restricciones antes de una salida.'});
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

function bind(){
  document.querySelectorAll('.mainnav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $('contextLegendToggle').onclick=toggleContextLegend;
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
  initMaps();bind();setContextLegend('monitor');renderNews();renderFishingSectors();loadRain('jja');initRisk();loadEnfen();tick();setInterval(tick,1000);poll();setInterval(poll,10000);
  setTimeout(()=>renderForecast(),2500);setInterval(()=>{if(riskMode==='emergency'||riskMode==='elnino')fetchEmergencyData(true).then(()=>refreshRiskMode())},30*60*1000);
});