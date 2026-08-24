
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const PORTS={Callao:[-12.05,-77.16],Paita:[-5.09,-81.11],Talara:[-4.58,-81.27],Chimbote:[-9.08,-78.59],Huacho:[-11.11,-77.62],Pisco:[-13.71,-76.22],'San Juan':[-15.35,-75.16],Chala:[-15.86,-74.25],Atico:[-16.22,-73.61],Matarani:[-17.0,-72.10],Ilo:[-17.64,-71.34]};
let data=null;
function fmt(v,d=1,s=''){return Number.isFinite(+v)?Number(v).toFixed(d)+s:'—'}
function phaseInfo(date=new Date()){const syn=29.53058867, known=Date.UTC(2000,0,6,18,14),days=(date.getTime()-known)/86400000,age=((days%syn)+syn)%syn,frac=age/syn,illum=(1-Math.cos(2*Math.PI*frac))/2;let name=frac<.03||frac>.97?'Luna nueva':frac<.22?'Creciente':frac<.28?'Cuarto creciente':frac<.47?'Gibosa creciente':frac<.53?'Luna llena':frac<.72?'Gibosa menguante':frac<.78?'Cuarto menguante':'Menguante';return {age,frac,illum,name}}
function score(j){let s=82;const wh=+j.current?.wave_height,ws=+j.weatherCurrent?.wind_speed_10m,g=+j.weatherCurrent?.wind_gusts_10m;if(Number.isFinite(wh))s-=Math.max(0,wh-1)*17;if(Number.isFinite(ws))s-=Math.max(0,ws-15)*1.1;if(Number.isFinite(g))s-=Math.max(0,g-25)*.5;const ph=phaseInfo();s+=ph.illum>0.85||ph.illum<0.15?5:0;return Math.max(10,Math.min(95,Math.round(s)))}
function conditionLabel(s){return s>=72?'Favorable':s>=48?'Moderada':'Precaución'}
function draw(canvas,seriesA,seriesB=null,labelEvery=4){
 const c=$(canvas);if(!c)return;const ctx=c.getContext('2d'),dpr=devicePixelRatio||1,w=c.clientWidth||700,h=+c.getAttribute('height')||240;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const vals=[...seriesA,...(seriesB||[])].filter(Number.isFinite);if(!vals.length){ctx.fillStyle='#9ab4bd';ctx.fillText('Sin datos disponibles',20,30);return}
 const max=Math.max(...vals)*1.15||1,min=Math.min(0,...vals),pad=30,gw=w-pad*2,gh=h-pad*2;
 ctx.strokeStyle='rgba(140,190,200,.18)';ctx.lineWidth=1;for(let i=0;i<=4;i++){let y=pad+gh*i/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke()}
 function line(arr,dashed=false){ctx.strokeStyle=dashed?'#f0ba4e':'#4fd5e8';ctx.lineWidth=2;ctx.setLineDash(dashed?[5,4]:[]);ctx.beginPath();arr.forEach((v,i)=>{if(!Number.isFinite(v))return;const x=pad+gw*i/Math.max(1,arr.length-1),y=pad+gh-(v-min)/(max-min)*gh;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([])}
 line(seriesA,false);if(seriesB)line(seriesB,true);
 ctx.fillStyle='#91acb5';ctx.font='9px sans-serif';ctx.fillText(max.toFixed(1),3,pad+4);ctx.fillText(min.toFixed(1),8,h-pad+3)
}
function tabs(){
 document.querySelectorAll('[data-marine-tab]').forEach(b=>b.addEventListener('click',()=>{
   document.querySelectorAll('[data-marine-tab]').forEach(x=>x.classList.toggle('active',x===b));
   document.querySelectorAll('[data-marine-panel]').forEach(x=>x.classList.toggle('active',x.dataset.marinePanel===b.dataset.marineTab));
   if(b.dataset.marineTab==='map'){setTimeout(()=>window.GSL_MAPS?.marineMap?.invalidateSize?.(),150)}
 }))
}
function dailyCards(j){
 const d=j.daily||{},days=d.time||[];return days.slice(0,7).map((date,i)=>{
  const wx=d.weather_code?.[i],wmax=d.wind_speed_10m_max?.[i],gust=d.wind_gusts_10m_max?.[i],rain=d.precipitation_probability_max?.[i];
  return `<div class="mp-day"><b>${new Date(date+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short'})}</b><small>${date.slice(5)}</small><strong>${fmt(wmax,0,' km/h')}</strong><small>Ráf. ${fmt(gust,0,' km/h')}</small><small>Lluvia ${fmt(rain,0,'%')}</small></div>`
 }).join('')
}
function explain(j){
 const wh=+j.current?.wave_height,wp=+j.current?.wave_period,ws=+j.weatherCurrent?.wind_speed_10m,s=score(j);
 let t=`En ${j.port}, el oleaje actual es ${fmt(wh,1,' m')} con periodo ${fmt(wp,0,' s')} y viento de ${fmt(ws,0,' km/h')}. `;
 t+=s>=72?'Las condiciones combinadas son relativamente favorables para planificar, siempre verificando avisos oficiales.':s>=48?'La condición es intermedia; revisa ráfagas, oleaje y avisos antes de salir.':'La combinación de oleaje/viento requiere mayor precaución; evita decisiones basadas solo en este índice.';
 $('mpExplain').textContent=t;$('mpSafety').textContent=wh>=2.5||ws>=30?'Precaución elevada: revisa avisos DHN y Capitanía antes de acercarte a roqueríos, embarcar o realizar pesca costera.':'Mantén verificación oficial de DHN/Capitanía, equipo de seguridad y evaluación local antes de la actividad.'
}
function render(j){
 data=j;const s=score(j),ph=phaseInfo();
 $('mpCondition').textContent=conditionLabel(s);$('mpWaveNow').textContent=fmt(j.current?.wave_height,1,' m');$('mpWindNow').textContent=fmt(j.weatherCurrent?.wind_speed_10m,0,' km/h');$('mpSeaTemp').textContent=fmt(j.current?.sea_surface_temperature,1,' °C');$('mpPressure').textContent=fmt(j.weatherCurrent?.surface_pressure,0,' hPa');$('mpActivity').textContent=s+'/100';$('mpUpdated').textContent=new Date(j.updatedAt).toLocaleTimeString('es-PE');
 const h=j.hourly||{},weather=j.weatherHourly||{};draw('mpCombinedChart',(h.wave_height||[]).slice(0,24),(weather.wind_speed_10m||[]).slice(0,24));draw('mpWaveChart',(h.wave_height||[]).slice(0,168),(h.swell_wave_height||[]).slice(0,168));draw('mpWindChart',(weather.wind_speed_10m||[]).slice(0,168),(weather.wind_gusts_10m||[]).slice(0,168));
 $('mpRecommendation').innerHTML=`<b>${conditionLabel(s)} · ${s}/100</b><p>${s>=72?'Oleaje y viento dentro de rangos relativamente cómodos para planificación recreativa.':s>=48?'Condición utilizable con precaución. Revisa cambios horarios y avisos oficiales.':'Condición poco favorable para una salida recreativa. Prioriza seguridad y avisos oficiales.'}</p>`;
 const sr=j.daily?.sunrise?.[0]?.slice(11,16)||'—',ss=j.daily?.sunset?.[0]?.slice(11,16)||'—';
 $('mpBestTimes').innerHTML=`<div>🌅 Amanecer: <b>${sr}</b></div><div>🌇 Atardecer: <b>${ss}</b></div><div>🌙 ${ph.name}: <b>${Math.round(ph.illum*100)}%</b> iluminada</div>`;
 $('mpDailyStrip').innerHTML=dailyCards(j);
 $('mpAstro').innerHTML=`<div><span>Amanecer</span><b>${sr}</b></div><div><span>Atardecer</span><b>${ss}</b></div><div><span>Fase lunar</span><b>${ph.name}</b></div><div><span>Iluminación</span><b>${Math.round(ph.illum*100)}%</b></div>`;
 $('mpSolunarWindows').innerHTML=`<div><b>Ventana mañana</b><span>${sr==='—'?'—':sr+' ± 1 h'}</span></div><div><b>Ventana tarde</b><span>${ss==='—'?'—':ss+' ± 1 h'}</span></div><div><b>Índice combinado</b><span>${s}/100 · experimental</span></div>`;
 const wh=(h.wave_height||[]).filter(Number.isFinite),wp=(h.wave_period||[]).filter(Number.isFinite),sh=(h.swell_wave_height||[]).filter(Number.isFinite);
 $('mpWaveDetails').innerHTML=`<div><span>Máx. 7 días</span><b>${fmt(Math.max(...wh),1,' m')}</b></div><div><span>Periodo actual</span><b>${fmt(j.current?.wave_period,0,' s')}</b></div><div><span>Mar de fondo máx.</span><b>${fmt(sh.length?Math.max(...sh):NaN,1,' m')}</b></div><div><span>Dirección</span><b>${fmt(j.current?.wave_direction,0,'°')}</b></div>`;
 const wind=(weather.wind_speed_10m||[]).filter(Number.isFinite),gust=(weather.wind_gusts_10m||[]).filter(Number.isFinite);
 $('mpWindDetails').innerHTML=`<div><span>Viento actual</span><b>${fmt(j.weatherCurrent?.wind_speed_10m,0,' km/h')}</b></div><div><span>Ráfaga actual</span><b>${fmt(j.weatherCurrent?.wind_gusts_10m,0,' km/h')}</b></div><div><span>Máx. 7 días</span><b>${fmt(wind.length?Math.max(...wind):NaN,0,' km/h')}</b></div><div><span>Ráfaga máx.</span><b>${fmt(gust.length?Math.max(...gust):NaN,0,' km/h')}</b></div>`;
 explain(j);
}
async function refresh(){
 const port=$('marineProPort').value;$('mpCondition').textContent='Cargando…';
 try{const r=await fetch('/api/marine/pro?port='+encodeURIComponent(port),{cache:'no-store'}),j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'No disponible');render(j)}
 catch(e){$('mpCondition').textContent='Sin datos';$('mpExplain').textContent='No se pudo cargar la información marina. Usa los enlaces oficiales DHN mientras se restablece el servicio.'}
}
function nearest(){
 if(!navigator.geolocation)return; navigator.geolocation.getCurrentPosition(p=>{let best=null;for(const [k,[lat,lon]] of Object.entries(PORTS)){const d=Math.hypot(p.coords.latitude-lat,(p.coords.longitude-lon)*Math.cos(lat*Math.PI/180));if(!best||d<best.d)best={k,d}};$('marineProPort').value=best.k;refresh()},()=>{});
}
function tide(){
 const d=$('mpTideDate').value||new Date().toISOString().slice(0,10);$('mpTideFrame').src='https://www.dhn.mil.pe/app/mareas/index.php?f='+d
}
document.addEventListener('DOMContentLoaded',()=>{
 if(!$('marineProPort'))return;tabs();$('marineProRefresh').onclick=refresh;$('marineProPort').onchange=refresh;$('marineProNearest').onclick=nearest;$('mpTideLoad').onclick=tide;$('mpTideDate').value=new Date().toISOString().slice(0,10);refresh();
});
})();
