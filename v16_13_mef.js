(()=>{
'use strict';
const $=id=>document.getElementById(id);
const region=$('mefRegion'),province=$('mefProvince'),district=$('mefDistrict'),year=$('mefYear');
let records=[],lastResponse=null,giradoSnapshot=null,activeRequest=null,lastQueryKey='';

function number(value){const parsed=Number.parseFloat(String(value??'').replaceAll(',',''));return Number.isFinite(parsed)?parsed:0}
function money(value){return `S/ ${new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(value)}`}
function normalized(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('es')}
function currentKey(){return [year.value,region.value,province.value,district.value].map(normalized).join('|')}

function setStatus(message,state=''){
 const status=$('mefStatus');status.textContent=message;status.dataset.state=state;
}

function getGirado(project){
 if(!giradoSnapshot||year.value!==String(giradoSnapshot.year))return null;
 const scope=[region.value,province.value,district.value].map(normalized);
 const snapshotScope=[giradoSnapshot.filters.department,giradoSnapshot.filters.province,giradoSnapshot.filters.district].map(normalized);
 if(scope.some((value,index)=>value!==snapshotScope[index]))return null;
 if(normalized(project.DEPARTAMENTO)!==snapshotScope[0]||normalized(project.PROVINCIA)!==snapshotScope[1]||normalized(project.DISTRITO)!==snapshotScope[2])return null;
 return giradoSnapshot.records.find(item=>String(item.cui)===String(project.CODIGO_UNICO)&&String(item.secEjec)===String(project.SEC_EJEC))||null;
}

function createProject(project){
 const card=document.createElement('details');card.className='mef-project';
 const summary=document.createElement('summary');
 const identity=document.createElement('span');identity.className='mef-project-identity';
 const title=document.createElement('span');title.className='mef-project-title';title.textContent=project.NOMBRE_INVERSION||'Inversión sin nombre';
 const meta=document.createElement('span');meta.className='mef-project-meta';meta.textContent=`CUI ${project.CODIGO_UNICO||'—'} · ${project.FUNCION||project.SECTOR||'Función no informada'} · ${project.SITUACION||project.ESTADO||'Sin estado'}`;
 identity.append(title,meta);
 const pim=document.createElement('strong');pim.className='mef-project-pim';pim.append(document.createTextNode(money(number(project.PIM_ANIO_ACTUAL))));
 const pimLabel=document.createElement('small');pimLabel.textContent=`PIM ${project.ANIO_PROCESO||year.value}`;pim.append(pimLabel);
 const chevron=document.createElement('span');chevron.className='mef-project-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';
 summary.append(identity,pim,chevron);

 const detail=document.createElement('div');detail.className='mef-project-detail';
 const line=document.createElement('div');line.className='mef-girado-line';
 const caption=document.createElement('span');caption.textContent='Girado';
 const amount=document.createElement('strong');const record=getGirado(project);amount.textContent=record?money(record.girado):'No verificado';
 if(!record)amount.className='unverified';
 line.append(caption,amount);
 const source=document.createElement('p');source.className='mef-project-source';
 if(record?.status==='no_record_zero')source.textContent=record.note;
 else if(record)source.textContent=`Cruce por CUI ${record.cui} y unidad ejecutora ${record.secEjec}. Actualización MEF: ${giradoSnapshot.updatedAt}.`;
 else source.textContent='No hay cruce validado para este año, ubicación, CUI y unidad ejecutora; no se infiere un monto.';
 const sourceLink=document.createElement('a');sourceLink.href=giradoSnapshot?.sourceUrl||'https://www.mef.gob.pe/es/seguimiento-de-la-ejecucion-presupuestal-consulta-amigable';sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';sourceLink.textContent='Consulta Amigable · fuente oficial';
 source.append(document.createTextNode(' '),sourceLink);detail.append(line,source);card.append(summary,detail);return card;
}

function renderProjects(){
 const term=$('mefSearch').value.trim().toLocaleLowerCase('es');
 const filtered=records.filter(project=>`${project.NOMBRE_INVERSION} ${project.CODIGO_UNICO} ${project.FUNCION} ${project.SECTOR}`.toLocaleLowerCase('es').includes(term));
 $('mefProjects').replaceChildren(...filtered.map(createProject));
 $('mefResultsCount').textContent=`${filtered.length} de ${lastResponse?.total??records.length}`;
 $('mefEmpty').hidden=filtered.length>0;
 $('mefReport').disabled=filtered.length===0;
}

async function loadSnapshot(){
 if(giradoSnapshot)return giradoSnapshot;
 try{const response=await fetch('/girados-2026.json',{cache:'no-store'});if(!response.ok)throw new Error('No disponible');giradoSnapshot=await response.json();return giradoSnapshot}catch{giradoSnapshot=null;return null}
}

async function loadInvestments(force=false){
 const key=currentKey();
 if(!force&&lastResponse&&lastQueryKey===key){renderProjects();return}
 activeRequest?.abort();activeRequest=new AbortController();
 setStatus('Consultando inversiones públicas del MEF…','loading');
 $('mefProjects').replaceChildren();$('mefEmpty').hidden=true;$('mefReport').disabled=true;$('mefReportPreview').hidden=true;
 const params=new URLSearchParams({year:year.value,department:normalized(region.value),province:normalized(province.value),district:normalized(district.value)});
 try{
  const [response]=await Promise.all([fetch(`/api/mef/investments?${params}`,{signal:activeRequest.signal,cache:'no-store'}),loadSnapshot()]);
  const data=await response.json();if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
  if(!Array.isArray(data.records)||typeof data.total!=='number')throw new Error('La respuesta del MEF no tiene el formato esperado.');
  records=data.records;lastResponse=data;lastQueryKey=key;
  const filteredGirado=records.map(getGirado).filter(Boolean);
  $('mefTotalProjects').textContent=new Intl.NumberFormat('es-PE').format(data.total);
  $('mefTotalPim').textContent=money(records.reduce((sum,item)=>sum+number(item.PIM_ANIO_ACTUAL),0));
  $('mefTotalDev').textContent=money(records.reduce((sum,item)=>sum+number(item.DEV_ANIO_ACTUAL),0));
  $('mefTotalGirado').textContent=money(filteredGirado.reduce((sum,item)=>sum+number(item.girado),0));
  $('mefTotals').hidden=false;
  setStatus(`${records.length} registros recuperados · ${data.complete?'consulta completa':'consulta parcial'} · consulta ${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.fetchedAt))}.`,data.complete?'':'error');
  renderProjects();
 }catch(error){
  if(error.name==='AbortError')return;
  records=[];lastResponse=null;lastQueryKey='';$('mefTotals').hidden=true;$('mefResultsCount').textContent='—';$('mefProjects').replaceChildren();$('mefEmpty').hidden=false;$('mefEmpty').textContent='No se pudieron cargar las inversiones. Actualiza e inténtalo nuevamente.';$('mefReport').disabled=true;
  setStatus(`${error.message} La fuente MEF no está disponible en este momento.`, 'error');
 }
}

function emitReport(){
 const term=$('mefSearch').value.trim().toLocaleLowerCase('es');
 const analyzed=records.filter(project=>`${project.NOMBRE_INVERSION} ${project.CODIGO_UNICO} ${project.FUNCION} ${project.SECTOR}`.toLocaleLowerCase('es').includes(term));
 const joined=analyzed.map(project=>({project,girado:getGirado(project)}));
 const verified=joined.filter(item=>item.girado);
 const pim=analyzed.reduce((sum,item)=>sum+number(item.PIM_ANIO_ACTUAL),0);
 const accrued=analyzed.reduce((sum,item)=>sum+number(item.DEV_ANIO_ACTUAL),0);
 const girado=verified.reduce((sum,item)=>sum+number(item.girado.girado),0);
 const location=`${district.value}, ${province.value}, ${region.value}`;
 const sample=joined.slice(0,5).map(({project,girado:row})=>`- CUI ${project.CODIGO_UNICO||'—'}: ${row?`Girado ${money(row.girado)}`:'Girado no verificado'}`);
 const lines=[
  'INFORME RESUMIDO DE INVERSIONES · GEOSISMOSLATAM',
  `Emitido: ${new Date().toLocaleString('es-PE',{timeZone:'America/Lima',dateStyle:'medium',timeStyle:'short'})} (hora de Perú)`,
  `Año fiscal: ${year.value}`,
  `Ubicación: ${location}`,
  `Búsqueda: ${$('mefSearch').value.trim()||'sin filtro por texto'}`,
  `Obras analizadas: ${analyzed.length} de ${lastResponse?.total??records.length}; consulta ${lastResponse?.complete?'completa':'parcial'}.`,
  `PIM del conjunto analizado: ${money(pim)}`,
  `Devengado del conjunto analizado: ${money(accrued)}`,
  `Girado verificado: ${money(girado)} en ${verified.length} de ${analyzed.length} obras.`,
  'El Girado suma solo cruces verificados por año, ubicación, CUI y unidad ejecutora; los demás casos no se asumen como cero.',
  '',
  'Muestra de obras:',
  ...(sample.length?sample:['- No hay obras para los filtros actuales.']),
  '',
  `Fuente de inversiones: ${lastResponse?.source||'MEF · Detalle de inversiones'}. Fuente de Girado: Consulta Amigable, actualización publicada ${giradoSnapshot?.updatedAt||'no disponible'}.`,
  'La cobertura de Girado corresponde únicamente al año y ámbito del corte verificado; no representa todos los sistemas MEF.'
 ];
 const text=lines.join('\n');
 $('mefReportPreview').textContent=`Resumen emitido: ${analyzed.length} obras · PIM ${money(pim)} · devengado ${money(accrued)} · Girado verificado ${money(girado)} (${verified.length}/${analyzed.length}). Se descargó el informe completo.`;
 $('mefReportPreview').hidden=false;
 const blob=new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`Informe_GeoSismosLatam_${new Date().toISOString().slice(0,10)}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function updateLocationOptions(){
 const locations={Arequipa:['Caravelí',['Bella Unión']],Cusco:['Cusco',['Cusco']],Lima:['Lima',['Lima']]};
 const [provinceName,districtNames]=locations[region.value]||locations.Arequipa;
 province.replaceChildren(new Option(provinceName,provinceName));district.replaceChildren(...districtNames.map(name=>new Option(name,name)));
}

document.addEventListener('DOMContentLoaded',()=>{
 $('mefRegion').addEventListener('change',()=>{updateLocationOptions();loadInvestments(true)});
 province.addEventListener('change',()=>loadInvestments(true));district.addEventListener('change',()=>loadInvestments(true));year.addEventListener('change',()=>loadInvestments(true));
 $('mefRefresh').addEventListener('click',()=>loadInvestments(true));$('mefSearch').addEventListener('input',renderProjects);$('mefReport').addEventListener('click',emitReport);
 document.querySelector('[data-view="mef"]')?.addEventListener('click',()=>setTimeout(()=>loadInvestments(),0));
});
})();
