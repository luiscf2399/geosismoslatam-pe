(()=>{
'use strict';
const $=id=>document.getElementById(id);
let rows=[];
const clean=s=>String(s??'').trim();
const uniq=a=>[...new Set(a)].sort((x,y)=>x.localeCompare(y,'es',{sensitivity:'base'}));
function option(v,label=v){return `<option value="${String(v).replace(/"/g,'&quot;')}">${label}</option>`}
function fill(select,values,label){if(!select)return;select.innerHTML=option('',label)+values.map(x=>option(x)).join('');select.disabled=values.length===0;}
function provinces(dep){return uniq(rows.filter(r=>r.departamento===dep).map(r=>r.provincia));}
function districts(dep,prov){return rows.filter(r=>r.departamento===dep&&r.provincia===prov).sort((a,b)=>a.distrito.localeCompare(b.distrito,'es',{sensitivity:'base'}));}
function setupSide(prefix){
 const dep=$(prefix+'Region'),prov=$(prefix+'Province'),dist=$(prefix+'District'),hidden=$(prefix==='freightOrigin'?'freightOrigin':'freightDestination');
 if(!dep||!prov||!dist||!hidden)return;
 fill(dep,uniq(rows.map(r=>r.departamento)),'Seleccionar región/departamento');
 fill(prov,[],'Seleccionar provincia');fill(dist,[],'Seleccionar distrito');
 dep.addEventListener('change',()=>{fill(prov,provinces(dep.value),'Seleccionar provincia');fill(dist,[],'Seleccionar distrito');hidden.value='';});
 prov.addEventListener('change',()=>{const ds=districts(dep.value,prov.value);dist.innerHTML=option('','Seleccionar distrito')+ds.map(r=>`<option value="${r.ubigeo}" data-lat="${r.latitud}" data-lon="${r.longitud}">${r.distrito}</option>`).join('');dist.disabled=!ds.length;hidden.value='';});
 dist.addEventListener('change',()=>{const o=dist.selectedOptions[0];if(!o||!o.value){hidden.value='';return;}hidden.value=`${o.textContent}, ${prov.value}, ${dep.value}, Perú`;hidden.dataset.ubigeo=o.value;hidden.dataset.lat=o.dataset.lat||'';hidden.dataset.lon=o.dataset.lon||'';});
}
async function load(){
 try{
  const r=await fetch('./ubigeo_inei_2025.csv?v=16.1',{cache:'force-cache'});if(!r.ok)throw Error('No se pudo cargar UBIGEO');
  const txt=(await r.text()).replace(/^\uFEFF/,'');const lines=txt.split(/\r?\n/).filter(Boolean);const h=lines.shift().split(';');
  const idx=Object.fromEntries(h.map((k,i)=>[k.trim(),i]));
  rows=lines.map(l=>{const c=l.split(';');return {departamento:clean(c[idx.departamento]),provincia:clean(c[idx.provincia]),distrito:clean(c[idx.distrito]),ubigeo:clean(c[idx.ubigeo]),latitud:clean(c[idx.latitud]),longitud:clean(c[idx.longitud])}}).filter(x=>x.departamento&&x.provincia&&x.distrito);
  setupSide('freightOrigin');setupSide('freightDestination');
  const st=$('freightUbigeoStatus');if(st)st.textContent=`Base territorial cargada: ${rows.length.toLocaleString('es-PE')} distritos/registros INEI 2025.`;
 }catch(e){const st=$('freightUbigeoStatus');if(st)st.textContent='No se pudo cargar la base territorial. Recarga la página.';console.warn(e)}
}
window.GSLFreightUbigeo={selected(prefix){const hidden=$(prefix);return {label:hidden?.value||'',ubigeo:hidden?.dataset.ubigeo||'',lat:+(hidden?.dataset.lat||NaN),lon:+(hidden?.dataset.lon||NaN)}}};
document.addEventListener('DOMContentLoaded',load);
})();
