(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const region=byId('mefRegion'),province=byId('mefProvince'),district=byId('mefDistrict'),year=byId('mefYear');
const PAGE_SIZE=100;
let records=[],lastResponse=null,giradoSnapshot=null,activeRequest=null,lastQueryKey='',visibleCount=PAGE_SIZE;

function number(value){const parsed=Number.parseFloat(String(value??'').replaceAll(',',''));return Number.isFinite(parsed)?parsed:0}
function money(value){return `S/ ${new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(value)}`}
function normalized(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('es')}
function currentKey(){return [year.value,region.value].map(normalized).join('|')}
function scopeLabel(){return district.value?`${district.value}, ${province.value}, Arequipa`:province.value?`${province.value}, Arequipa`:'Toda la región Arequipa'}

function setStatus(message,state=''){
 const status=byId('mefStatus');status.textContent=message;status.dataset.state=state;
}

function scopedRecords(){
 const selectedProvince=normalized(province.value),selectedDistrict=normalized(district.value);
 return records.filter(project=>(!selectedProvince||normalized(project.PROVINCIA)===selectedProvince)&&(!selectedDistrict||normalized(project.DISTRITO)===selectedDistrict));
}

function getGirado(project){
 if(!giradoSnapshot||year.value!==String(giradoSnapshot.year))return null;
 const snapshotScope=[giradoSnapshot.filters.department,giradoSnapshot.filters.province,giradoSnapshot.filters.district].map(normalized);
 const projectScope=[project.DEPARTAMENTO,project.PROVINCIA,project.DISTRITO].map(normalized);
 if(projectScope.some((value,index)=>value!==snapshotScope[index]))return null;
 return giradoSnapshot.records.find(item=>String(item.cui)===String(project.CODIGO_UNICO)&&String(item.secEjec)===String(project.SEC_EJEC))||null;
}

function createProject(project){
 const card=document.createElement('details');card.className='mef-project';
 const summary=document.createElement('summary');
 const identity=document.createElement('span');identity.className='mef-project-identity';
 const title=document.createElement('span');title.className='mef-project-title';title.textContent=project.NOMBRE_INVERSION||'Inversión sin nombre';
 const meta=document.createElement('span');meta.className='mef-project-meta';meta.textContent=`CUI ${project.CODIGO_UNICO||'—'} · ${project.PROVINCIA||'Provincia no informada'} / ${project.DISTRITO||'Distrito no informado'} · ${project.FUNCION||project.SECTOR||'Función no informada'} · ${project.SITUACION||project.ESTADO||'Sin estado'}`;
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
 else if(record)source.textContent=`Cruce por CUI ${record.cui} y unidad ejecutora ${record.secEjec}. Corte publicado ${giradoSnapshot.updatedAt}.`;
 else source.textContent='No se asigna un monto de Girado sin cruce confirmado por CUI y unidad ejecutora.';
 const sourceLink=document.createElement('a');sourceLink.href=giradoSnapshot?.sourceUrl||'https://www.mef.gob.pe/es/seguimiento-de-la-ejecucion-presupuestal-consulta-amigable';sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';sourceLink.textContent='Consulta Amigable · fuente oficial';
 source.append(document.createTextNode(' '),sourceLink);detail.append(line,source);card.append(summary,detail);return card;
}

function updateSummary(){
 const selectedRecords=scopedRecords();
 const validatedGirado=selectedRecords.map(getGirado).filter(Boolean);
 byId('mefTotalProjects').textContent=new Intl.NumberFormat('es-PE').format(selectedRecords.length);
 byId('mefTotalPim').textContent=money(selectedRecords.reduce((sum,item)=>sum+number(item.PIM_ANIO_ACTUAL),0));
 byId('mefTotalDev').textContent=money(selectedRecords.reduce((sum,item)=>sum+number(item.DEV_ANIO_ACTUAL),0));
 byId('mefTotalGirado').textContent=money(validatedGirado.reduce((sum,item)=>sum+number(item.girado),0));
 byId('mefTotals').hidden=false;
}

function filteredRecords(){
 const term=normalized(byId('mefSearch').value.trim());
 return scopedRecords().filter(project=>!term||normalized(`${project.NOMBRE_INVERSION} ${project.CODIGO_UNICO} ${project.FUNCION} ${project.SECTOR}`).includes(term));
}

function renderProjects(){
 const filtered=filteredRecords(),shown=filtered.slice(0,visibleCount);
 byId('mefProjects').replaceChildren(...shown.map(createProject));
 byId('mefResultsCount').textContent=`Mostrando ${new Intl.NumberFormat('es-PE').format(shown.length)} de ${new Intl.NumberFormat('es-PE').format(filtered.length)}`;
 byId('mefEmpty').hidden=filtered.length>0;
 byId('mefReport').disabled=filtered.length===0;
 byId('mefLoadMore').hidden=shown.length>=filtered.length;
}

function fillSelect(select,label,values,previousValue){
 select.replaceChildren(new Option(label,''),...values.map(value=>new Option(value,value)));
 select.value=values.includes(previousValue)?previousValue:'';
}

function updateLocationOptions(preserveProvince=true){
 const oldProvince=preserveProvince?province.value:'';
 const provinces=[...new Set(records.map(project=>String(project.PROVINCIA||'').trim()).filter(Boolean))].sort((left,right)=>left.localeCompare(right,'es'));
 fillSelect(province,'Todas las provincias',provinces,oldProvince);
 updateDistrictOptions(false);
}

function updateDistrictOptions(preserveDistrict=true){
 const oldDistrict=preserveDistrict?district.value:'';
 const selectedProvince=normalized(province.value);
 if(!selectedProvince){district.replaceChildren(new Option('Elige una provincia',''));district.value='';district.disabled=true;return}
 district.disabled=false;
 const districts=[...new Set(records.filter(project=>!selectedProvince||normalized(project.PROVINCIA)===selectedProvince).map(project=>String(project.DISTRITO||'').trim()).filter(Boolean))].sort((left,right)=>left.localeCompare(right,'es'));
 fillSelect(district,'Todos los distritos',districts,oldDistrict);
}

async function loadSnapshot(){
 if(giradoSnapshot)return giradoSnapshot;
 try{const response=await fetch('/girados-2026.json',{cache:'no-store'});if(!response.ok)throw new Error('No disponible');giradoSnapshot=await response.json();return giradoSnapshot}catch{giradoSnapshot=null;return null}
}

async function fetchMefPage(params,signal){
 const response=await fetch(`/api/mef/investments?${params}`,{signal,cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
 if(!Array.isArray(data.records)||typeof data.total!=='number')throw new Error('La respuesta del MEF no tiene el formato esperado.');
 return data;
}

async function loadInvestments(force=false){
 const key=currentKey();
 if(!force&&lastResponse&&lastQueryKey===key){updateSummary();renderProjects();return}
 activeRequest?.abort();activeRequest=new AbortController();visibleCount=PAGE_SIZE;
 setStatus('Consultando toda la cartera de inversiones de Arequipa en el MEF…','loading');
 byId('mefProjects').replaceChildren();byId('mefEmpty').hidden=true;byId('mefReport').disabled=true;byId('mefTotals').hidden=true;byId('mefReportPreview').hidden=true;
 const params=new URLSearchParams({year:year.value,department:region.value});
 try{
  const [firstPage]=await Promise.all([fetchMefPage(params,activeRequest.signal),loadSnapshot()]);
  const offsets=[];
  for(let offset=firstPage.records.length;offset<firstPage.total;offset+=firstPage.pageSize||1000)offsets.push(offset);
  const laterPages=await Promise.all(offsets.map(async offset=>{
   const pageParams=new URLSearchParams(params);pageParams.set('offset',String(offset));
   const page=await fetchMefPage(pageParams,activeRequest.signal);
   if(page.total!==firstPage.total||page.offset!==offset)throw new Error('Las páginas del MEF no coinciden; actualiza la consulta.');
   return page.records;
  }));
  records=[...firstPage.records,...laterPages.flat()];
  const complete=records.length===firstPage.total;
  lastResponse={...firstPage,records,complete};lastQueryKey=key;
  updateLocationOptions();updateSummary();
  setStatus(`${new Intl.NumberFormat('es-PE').format(records.length)} de ${new Intl.NumberFormat('es-PE').format(firstPage.total)} inversiones recuperadas para Arequipa · ${complete?'cartera completa':'consulta parcial; revisa los resultados disponibles'} · actualización ${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(firstPage.fetchedAt))}.`,complete?'':'error');
  renderProjects();
 }catch(error){
  if(error.name==='AbortError')return;
  records=[];lastResponse=null;lastQueryKey='';byId('mefTotals').hidden=true;byId('mefResultsCount').textContent='—';byId('mefProjects').replaceChildren();byId('mefEmpty').hidden=false;byId('mefEmpty').textContent='No se pudo cargar la cartera regional. Actualiza e inténtalo nuevamente.';byId('mefReport').disabled=true;
  setStatus(`${error.message} La fuente MEF no está disponible en este momento.`,'error');
 }
}

function emitReport(){
 const analyzed=filteredRecords(),joined=analyzed.map(project=>({project,girado:getGirado(project)}));
 const verified=joined.filter(item=>item.girado);
 const pim=analyzed.reduce((sum,item)=>sum+number(item.PIM_ANIO_ACTUAL),0);
 const accrued=analyzed.reduce((sum,item)=>sum+number(item.DEV_ANIO_ACTUAL),0);
 const girado=verified.reduce((sum,item)=>sum+number(item.girado.girado),0);
 const sample=joined.slice(0,5).map(({project,girado:row})=>`- CUI ${project.CODIGO_UNICO||'—'} · ${project.PROVINCIA||'—'} / ${project.DISTRITO||'—'}: ${row?`Girado ${money(row.girado)}`:'Girado no verificado'}`);
 const lines=[
  'INFORME REGIONAL DE INVERSIONES · GEOSISMOSLATAM',
  `Emitido: ${new Date().toLocaleString('es-PE',{timeZone:'America/Lima',dateStyle:'medium',timeStyle:'short'})} (hora de Perú)`,
  `Año fiscal: ${year.value}`,
  `Ámbito: ${scopeLabel()}`,
  `Búsqueda: ${byId('mefSearch').value.trim()||'sin filtro por texto'}`,
  `Obras analizadas: ${analyzed.length} de ${scopedRecords().length}; cartera regional ${lastResponse?.complete?'completa':'parcial'}.`,
  `PIM del conjunto analizado: ${money(pim)}`,
  `Devengado del conjunto analizado: ${money(accrued)}`,
  `Girado directo verificado: ${money(girado)} en ${verified.length} de ${analyzed.length} obras; subtotal parcial.`,
  'El reporte de Consulta Amigable compartido para Bella Unión es un total municipal, no el Girado de cada CUI ni el total de la región. No se calcula ni se extrapola Girado cuando no hay cruce confirmado.',
  '',
  'Muestra de obras:',
  ...(sample.length?sample:['- No hay obras para los filtros actuales.']),
  '',
  `Fuente de cartera: ${lastResponse?.source||'MEF · Detalle de inversiones'}. Fuente del Girado disponible: Consulta Amigable, corte publicado ${giradoSnapshot?.updatedAt||'no disponible'}.`,
  'El Girado solo está validado para el ámbito y los CUI presentes en el corte contrastado; la cobertura no es regional completa ni representa todos los sistemas MEF.'
 ];
 const text=lines.join('\n');
 byId('mefReportPreview').textContent=`Informe emitido: ${analyzed.length} inversiones en ${scopeLabel()} · PIM ${money(pim)} · devengado ${money(accrued)} · Girado validado parcial ${money(girado)} (${verified.length}/${analyzed.length}).`;
 byId('mefReportPreview').hidden=false;
 const blob=new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`Informe_MEF_Arequipa_${new Date().toISOString().slice(0,10)}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

document.addEventListener('DOMContentLoaded',()=>{
 province.addEventListener('change',()=>{district.value='';updateDistrictOptions(false);visibleCount=PAGE_SIZE;updateSummary();renderProjects()});
 district.addEventListener('change',()=>{visibleCount=PAGE_SIZE;updateSummary();renderProjects()});
 year.addEventListener('change',()=>loadInvestments(true));
 byId('mefRefresh').addEventListener('click',()=>loadInvestments(true));
 byId('mefSearch').addEventListener('input',()=>{visibleCount=PAGE_SIZE;renderProjects()});
 byId('mefLoadMore').addEventListener('click',()=>{visibleCount+=PAGE_SIZE;renderProjects()});
 byId('mefReport').addEventListener('click',emitReport);
 document.querySelector('[data-view="mef"]')?.addEventListener('click',()=>setTimeout(()=>loadInvestments(),0));
});
})();
