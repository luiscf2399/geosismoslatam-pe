(()=>{'use strict';
const $=id=>document.getElementById(id); const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const V={fav:JSON.parse(localStorage.getItem('gsl16_fav')||'[]'),lastUpdate:{}};
function ago(t){if(!t)return 'sin fecha';const m=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/60000));return m<1?'ahora':m<60?`${m} min`:m<1440?`${Math.round(m/60)} h`:`${Math.round(m/1440)} d`}
function badge(type='official'){return `<span class="v16-source-badge ${type}">${type==='official'?'OFICIAL':type==='community'?'COMUNITARIO':'EXPERIMENTAL'}</span>`}
async function jget(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.json()}
async function dashboard(){const g=$('v16SituationGrid');if(!g)return;g.innerHTML='<div class="v16-card"><b>Actualizando…</b><small>Consultando módulos sin bloquear la interfaz.</small></div>';
 const jobs=await Promise.allSettled([jget('/api/quakes'),jget('/api/roads'),jget('/api/markets?zone=lima&product='),jget('/api/marine/summary?port=Callao'),jget('/api/health')]);
 const q=jobs[0].status==='fulfilled'?jobs[0].value:null,r=jobs[1].status==='fulfilled'?jobs[1].value:null,m=jobs[2].status==='fulfilled'?jobs[2].value:null,sea=jobs[3].status==='fulfilled'?jobs[3].value:null;
 const feats=q?.features||q?.data?.features||[];const max=feats.reduce((a,x)=>Math.max(a,+x?.properties?.mag||0),0);const inc=r?.incidents||[];const rows=m?.rows||[];
 g.innerHTML=[
 ['Sismos',max?`M ${max.toFixed(1)}`:'Sin evento destacado',`${feats.length} eventos disponibles`,badge('official')],
 ['Carreteras',`${inc.length} incidencias`,`Accidentes, bloqueo, infraestructura, niebla y eventos reportados`,badge('official')],
 ['Mercados',`${rows.length} registros`,`Precios/ingresos disponibles en consulta actual`,badge('official')],
 ['Mar y pesca',sea?.port||'Litoral',sea?.waveHeight!=null?`Oleaje ${sea.waveHeight} m`:'Consulta mareas y oleaje',badge('official')],
 ['Lluvias','IMERG + modelos','Observación y proyección se muestran separadas por horizonte',badge('official')],
 ['Modelo experimental','Activo','Estimaciones propias siempre identificadas y separadas de datos oficiales',badge('experimental')]
 ].map(x=>`<article class="v16-card"><div>${x[3]}</div><b>${esc(x[0])}</b><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');
 const ok=jobs.filter(x=>x.status==='fulfilled').length;$('v16QualityBar').innerHTML=`<span class="${ok>=4?'ok':'warn'}">Fuentes operativas ${ok}/${jobs.length}</span><span>Actualizado ${new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</span><span>Datos oficiales y experimentales diferenciados</span>`;
}
function jump(id){document.querySelector(`.mainnav [data-view="${id}"]`)?.click()}
function addTools(){document.querySelectorAll('.map-head').forEach(h=>{if(h.querySelector('.v16-map-tools'))return;const d=document.createElement('div');d.className='v16-map-tools';d.innerHTML='<span class="v16-update-chip">ACTUALIZACIÓN: automática</span><button type="button" class="btn v16-refresh">↻</button><button type="button" class="btn v16-fs">⛶</button><button type="button" class="btn v16-star">☆</button>';h.appendChild(d);d.querySelector('.v16-refresh').onclick=()=>{const active=document.querySelector('.mainnav button.active');active?.click();dashboard()};d.querySelector('.v16-fs').onclick=()=>{const view=h.closest('.view');view?.classList.toggle('v16-fullscreen');setTimeout(()=>Object.values(window.GSL_MAPS||{}).forEach(m=>m.invalidateSize?.()),100)};d.querySelector('.v16-star').onclick=e=>{const id=h.closest('.view')?.id;if(!id)return;V.fav.includes(id)?V.fav=V.fav.filter(x=>x!==id):V.fav.push(id);localStorage.setItem('gsl16_fav',JSON.stringify(V.fav));e.currentTarget.textContent=V.fav.includes(id)?'★':'☆';e.currentTarget.classList.toggle('v16-fav',V.fav.includes(id))}})}
function connectivity(){let n=document.querySelector('.v16-offline');if(!navigator.onLine){if(!n){n=document.createElement('div');n.className='v16-offline';n.textContent='Sin conexión · mostrando contenido disponible en caché';document.body.appendChild(n)}}else n?.remove()}
function init(){addTools();document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));$('dashLocate')?.addEventListener('click',()=>{window.requestGeo?.();navigator.geolocation?.getCurrentPosition(()=>dashboard(),()=>dashboard())});document.querySelectorAll('.mainnav button').forEach(b=>b.addEventListener('click',()=>setTimeout(addTools,60)));window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);connectivity();dashboard();setInterval(dashboard,10*60*1000)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
