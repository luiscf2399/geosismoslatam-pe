(()=>{
'use strict';

const byId=id=>document.getElementById(id);
const year=byId('mefYear');
const province=byId('mefProvince');
const district=byId('mefDistrict');
const portal=byId('mefPortal');
const portalFallback=byId('mefPortalFallback');
const sourcePath=portal.dataset.src;
const reportButton=byId('mefReport');
const preview=byId('mefReportPreview');
const projectList=byId('mefProjectList');
const projectCount=byId('mefProjectCount');
let territory=[];
let selectedProject=null;
let sequence=0;
let reportSequence=0;
let reportController=null;
let initialized=false;
let portalObserver=null;
let observationTimer=0;

function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,' ').toLocaleUpperCase('es').trim()}
function setStatus(message,state=''){const status=byId('mefStatus');status.textContent=message;status.dataset.state=state}
function parseDelimitedLine(line){const values=[];let value='',quoted=false;for(let index=0;index<line.length;index++){const character=line[index];if(character==='"'){if(quoted&&line[index+1]==='"'){value+='"';index++}else quoted=!quoted}else if(character===';'&&!quoted){values.push(value.trim());value=''}else value+=character}values.push(value.trim());return values.map(item=>item.replace(/^"|"$/g,''))}
function fillSelect(select,label,values,disabled=false){select.replaceChildren(new Option(label,''),...values.map(value=>new Option(value,value)));select.value='';select.disabled=disabled}
function fillYears(){const currentYear=new Date().getFullYear();const years=Array.from({length:Math.max(1,currentYear-2022)},(_,index)=>String(2023+index));year.replaceChildren(...years.map(value=>new Option(value,value)));year.value=years.includes(String(currentYear))?String(currentYear):years[years.length-1]}

async function loadTerritory(){
 const response=await fetch('./ubigeo_inei_2025.csv',{cache:'force-cache'});
 if(!response.ok)throw new Error('No se pudo cargar el catálogo territorial INEI.');
 const lines=(await response.text()).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 const headers=parseDelimitedLine(lines.shift()).map(normalize);
 const departmentIndex=headers.indexOf('DEPARTAMENTO'),provinceIndex=headers.indexOf('PROVINCIA'),districtIndex=headers.indexOf('DISTRITO');
 if([departmentIndex,provinceIndex,districtIndex].some(index=>index<0))throw new Error('El catálogo territorial no contiene los campos esperados.');
 territory=lines.map(parseDelimitedLine).filter(row=>normalize(row[departmentIndex])==='AREQUIPA').map(row=>({province:row[provinceIndex],district:row[districtIndex]})).filter(item=>item.province&&item.district);
 const provinces=[...new Set(territory.map(item=>item.province))].sort((left,right)=>left.localeCompare(right,'es'));
 if(provinces.length!==8||territory.length!==109)throw new Error('El catálogo de Arequipa está incompleto.');
 fillSelect(province,'Toda la región · 8 provincias',provinces);
 updateDistricts();
}

function updateDistricts(){
 const selected=province.value;
 if(!selected){fillSelect(district,'Selecciona una provincia',[],true);return}
 const districts=[...new Set(territory.filter(item=>normalize(item.province)===normalize(selected)).map(item=>item.district))].sort((left,right)=>left.localeCompare(right,'es'));
 fillSelect(district,'Toda la provincia',districts);
}

function frameElement(){try{return portal.contentDocument?.querySelector('frame#frame0,frame[name="frame0"],iframe#frame0,iframe[name="frame0"]')||portal}catch{return null}}
function frameDocument(){try{const frame=frameElement();return frame===portal?portal.contentDocument:frame?.contentDocument||null}catch{return null}}
function pageSignature(doc){return `${doc?.defaultView?.location?.href||''}|${doc?.getElementById('ctl00_CPH1_Mt0')?.innerText||''}|${doc?.querySelector('#ctl00_CPH1_DrpYear')?.value||''}`}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function portalProxyError(){const error=new Error('El visor recibió GeoSismos en vez del MEF. Falta publicar el Worker con la ruta /mef-portal/*; el botón Abrir MEF permite consultar la fuente mientras se actualiza Cloudflare.');error.code='MEF_PROXY_UNAVAILABLE';return error}
function portalBlockedError(){const error=new Error('El MEF respondió con su protección anti-bots al puente automático. No se pudo verificar la tabla desde GeoSismos; usa Abrir MEF para continuar en el portal oficial.');error.code='MEF_ACCESS_BLOCKED';return error}
function isGeoSismosFallback(doc){return normalize(doc?.title||'').includes('GEOSISMOSLATAM')||Boolean(doc?.querySelector('header.top,#mefPortal,[data-view="mef"]'))}
function isPortalAccessBlocked(doc){return /incapsula|request unsuccessful|incident_id/i.test(`${doc?.body?.innerText||''} ${(doc?.documentElement?.innerHTML||'').slice(0,12000)}`)}

async function waitForPortalPage(token,timeout=120000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(token!==sequence)throw new DOMException('La consulta fue reemplazada.','AbortError');
  const doc=frameDocument();
  if(isGeoSismosFallback(doc))throw portalProxyError();
  if(doc?.getElementById('ctl00_CPH1_DrpYear')&&doc.querySelector('#ctl00_CPH1_Mt0'))return{frame:frameElement(),doc};
  if(isPortalAccessBlocked(doc))throw portalBlockedError();
  const text=doc?.body?.innerText||'';
  if(/Ha surgido un error|Failed to convert parameter|403 Forbidden/i.test(text))throw new Error('El portal MEF no aceptó la consulta. Abre el enlace oficial y vuelve a intentarlo.');
  await delay(150);
 }
 throw new Error('La Consulta Amigable no terminó de cargar después de dos minutos. Reintentaré al volver a consultar.');
}

async function waitForPortalChange(frame,oldDoc,oldSignature,token,timeout=60000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  if(token!==sequence)throw new DOMException('La consulta fue reemplazada.','AbortError');
  const doc=frameDocument();
  if(isGeoSismosFallback(doc))throw portalProxyError();
  if(doc?.getElementById('ctl00_CPH1_Mt0')&&(doc!==oldDoc||pageSignature(doc)!==oldSignature))return{frame:frameElement(),doc};
  if(isPortalAccessBlocked(doc))throw portalBlockedError();
  const text=doc?.body?.innerText||'';
  if(/Ha surgido un error|Failed to convert parameter|403 Forbidden/i.test(text))throw new Error('El MEF rechazó uno de los filtros. Actualiza e inténtalo otra vez.');
  await delay(150);
 }
 throw new Error('El MEF no respondió al filtro en un minuto. Puedes volver a consultar sin cambiar tus selecciones.');
}

async function changeDimension(buttonId,match,context,token){
 const button=context.doc.getElementById(buttonId);
 if(!button)throw new Error('No se encontró el siguiente nivel de Consulta Amigable en el MEF.');
 setStatus(`Consulta oficial MEF · esperando respuesta de ${button.value||'el siguiente filtro'}…`,'loading');
 const oldDoc=context.doc,signature=pageSignature(oldDoc);
 button.click();
 context=await waitForPortalChange(context.frame,oldDoc,signature,token);
 if(match){
  const targets=(Array.isArray(match)?match:[match]).map(normalize);
  const rows=[...context.doc.querySelectorAll('tr[id^="tr"]')];
  const row=rows.find(item=>targets.some(target=>normalize(item.innerText||item.textContent).includes(target)));
  const radio=row?.querySelector('input[type="radio"]');
  if(!radio)throw new Error(`El MEF no mostró la selección ${Array.isArray(match)?match[0]:match} para los filtros elegidos.`);
  radio.click();
  await delay(120);
 }
 return context;
}

async function applySelection(context,token){
 const provinceValue=province.value,districtValue=district.value;
 const steps=provinceValue||districtValue?[
  ['ctl00_CPH1_BtnTipoGobierno','GOBIERNOS LOCALES'],
  ['ctl00_CPH1_BtnSubTipoGobierno','MUNICIPALIDADES'],
  ['ctl00_CPH1_BtnDepartamento','AREQUIPA'],
  ...(provinceValue?[['ctl00_CPH1_BtnProvincia',provinceValue]]:[]),
  ...(districtValue?[['ctl00_CPH1_BtnMunicipalidad',[`MUNICIPALIDAD DISTRITAL DE ${districtValue}`,`MUNICIPALIDAD PROVINCIAL DE ${districtValue}`]]]:[])
 ]:[['ctl00_CPH1_BtnDepartamentoMeta','AREQUIPA']];
 for(const [buttonId,match] of steps)context=await changeDimension(buttonId,match,context,token);
 return changeDimension('ctl00_CPH1_BtnProdProy',null,context,token);
}

function parseAmount(value){const numeric=String(value||'').replace(/[^0-9,.-]/g,'').replaceAll(',','');const amount=Number(numeric);return Number.isFinite(amount)?amount:0}
function rowCui(name){const match=String(name||'').match(/^\s*(\d{7})\s*:/)||String(name||'').match(/\bCUI\s*[:#-]?\s*(\d{7})\b/i);if(!match)return null;if(/SIN\s+PRODUCTO|SIN\s+PROYECTO/i.test(name))return null;return match[1]}
function readVisibleProjects(doc){
 const heading=doc?.querySelector('#ctl00_CPH1_Mt0')?.innerText||'';
 if(!normalize(heading).includes('PROYECTO'))return[];
 return [...doc.querySelectorAll('tr[id^="tr"]')].map((row,index)=>{
  const cells=[...row.cells].map(cell=>(cell.innerText||cell.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  if(cells.length<9)return null;
  const name=cells[0];
  if(!name||/^TOTAL\b/i.test(name))return null;
  return{key:`${index}-${name}`,name,cui:rowCui(name),pia:parseAmount(cells[1]),pim:parseAmount(cells[2]),certified:parseAmount(cells[3]),commitment:parseAmount(cells[4]),monthlyCommitment:parseAmount(cells[5]),devengado:parseAmount(cells[6]),girado:parseAmount(cells[7]),advance:parseAmount(cells[8])};
 }).filter(Boolean);
}

function money(value){return`S/ ${new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(value||0)}`}
function appendText(parent,tag,className,text){const element=document.createElement(tag);if(className)element.className=className;element.textContent=text;parent.append(element);return element}

function renderProjectList(doc){
 const projects=readVisibleProjects(doc);
 projectList.replaceChildren();
 selectedProject=null;
 reportButton.disabled=true;
 if(!projects.length){
  projectCount.textContent='No hay filas de Producto/Proyecto visibles en la tabla actual.';
  appendText(projectList,'p','mef-empty','Asegúrate de que la Consulta Amigable muestre el nivel Producto/Proyecto y una página con obras.');
  return 0;
 }
 projectCount.textContent=`${projects.length} filas actualmente visibles en el MEF · selecciona una obra para verificar y analizar`;
 for(const [index,project] of projects.entries()){
  const item=document.createElement('article');item.className='mef-project-item';
  const primary=document.createElement('div');primary.className='mef-project-primary';
  const choose=document.createElement('input');choose.type='radio';choose.name='mef-work';choose.id=`mefWork${index}`;choose.value=project.key;choose.setAttribute('aria-label',`Seleccionar ${project.name}`);
  const label=document.createElement('label');label.htmlFor=choose.id;
  appendText(label,'strong','mef-project-name',project.name);
  appendText(label,'small','mef-project-cui',project.cui?`CUI ${project.cui} · verificación disponible en SSI e Invierte.pe`:'Esta fila no presenta un CUI verificable en SSI');
  primary.append(choose,label);
  const facts=document.createElement('div');facts.className='mef-project-facts';
  for(const [name,value] of [['PIM',project.pim],['Devengado',project.devengado],['Girado',project.girado]]){const fact=document.createElement('span');appendText(fact,'small','',name);appendText(fact,'b','',money(value));facts.append(fact)}
  item.append(primary,facts);projectList.append(item);
  const selectProject=()=>{selectedProject=project;reportButton.disabled=!project.cui;for(const child of projectList.children)child.classList.remove('selected');item.classList.add('selected')};
  choose.addEventListener('change',()=>{
   selectProject();
   if(project.cui)emitReport(project);
   else{preview.textContent='La fila del MEF no muestra un CUI reconocible; no se generó un informe de inversión.';preview.hidden=false;setStatus('La fila seleccionada no tiene CUI identificable para contrastar en SSI e Invierte.pe.','error')}
  });
 }
 return projects.length;
}

function observeVisibleTable(doc){
 portalObserver?.disconnect();
 const table=doc?.querySelector('#ctl00_CPH1_Mt0');
 if(!table||!window.MutationObserver)return;
 portalObserver=new MutationObserver(()=>{
  clearTimeout(observationTimer);
  observationTimer=setTimeout(()=>{
   const count=renderProjectList(doc);
   projectCount.textContent=`${count} filas actualmente visibles en el MEF · lista sincronizada con la tabla oficial`;
  },350);
 });
 portalObserver.observe(table,{subtree:true,childList:true,characterData:true});
}

async function refreshPortal(){
 const token=++sequence;initialized=true;reportButton.disabled=true;preview.hidden=true;
 portalObserver?.disconnect();
 portal.hidden=false;portalFallback.hidden=true;
 projectList.replaceChildren();projectCount.textContent='Consultando la fuente oficial…';
 setStatus('Abriendo la Consulta Amigable oficial. El primer ingreso puede tardar hasta dos minutos; si el MEF no responde, reintentaré automáticamente…','loading');
 const separator=sourcePath.includes('?')?'&':'?';
 try{
  let context=null,lastError=null;
  for(let attempt=1;attempt<=2&&!context;attempt++){
   portal.src=`${sourcePath}${separator}y=${encodeURIComponent(year.value)}&ap=Proyecto&geo=${Date.now()}`;
   try{context=await waitForPortalPage(token,120000)}catch(error){
    lastError=error;
    if(error.name==='AbortError'||error.code==='MEF_PROXY_UNAVAILABLE'||attempt===2)throw error;
    setStatus('El portal MEF sigue tardando. Esperaré unos segundos y volveré a abrirlo automáticamente…','loading');
    await delay(2500);
   }
  }
  if(!context)throw lastError||new Error('No se pudo abrir la Consulta Amigable.');
  context=await applySelection(context,token);
  if(token!==sequence)return;
  const scope=district.value?`${district.value}, ${province.value}`:province.value?`provincia ${province.value}`:'toda la región Arequipa';
  if(!normalize(context.doc.querySelector('#ctl00_CPH1_Mt0')?.innerText||'').includes('PROYECTO'))throw new Error('El MEF no abrió la tabla Producto/Proyecto. Actualiza la consulta.');
  const count=renderProjectList(context.doc);
  observeVisibleTable(context.doc);
  setStatus(count?`MEF oficial conectado · año ${year.value} · ${scope}. La lista replica solo las ${count} filas visibles del portal; PIM, devengado y Girado corresponden a cada fila.`:'Consulta aplicada, pero el MEF no devolvió filas visibles para Producto/Proyecto.',count?'':'error');
 }catch(error){
  if(error.name==='AbortError')return;
  if(error.code==='MEF_PROXY_UNAVAILABLE'||error.code==='MEF_ACCESS_BLOCKED'){
   portal.hidden=true;portalFallback.hidden=false;
   if(error.code==='MEF_ACCESS_BLOCKED'){
    byId('mefPortalFallbackTitle').textContent='El MEF bloqueó la consulta automática desde el puente.';
    byId('mefPortalFallbackText').textContent='La protección anti-bots del portal impidió verificar las filas. El informe no inventa datos: abre la fuente oficial para consultar el gasto y vuelve a intentar más tarde.';
   }else{
    byId('mefPortalFallbackTitle').textContent='El visor oficial aparecerá aquí cuando esté activo el puente de Cloudflare.';
    byId('mefPortalFallbackText').textContent='La versión publicada aún está devolviendo GeoSismos en lugar del portal MEF. Mientras se actualiza el Worker, puedes consultar la fuente oficial directamente.';
   }
  }
  projectCount.textContent='No se pudo leer la tabla oficial.';
  setStatus(error.message,'error');
 }
}

function pdfSafe(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ñÑ]/g,char=>char==='ñ'?'n':'N').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/[•·]/g,'-').replace(/[^\x20-\x7e]/g,'')}
function escapePdf(value){return pdfSafe(value).replace(/([\\()])/g,'\\$1')}
function wrapText(value,width=92){const words=pdfSafe(value).split(/\s+/);const lines=[];let line='';for(const word of words){if(!word)continue;if((line?line.length+1:0)+word.length>width&&line){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);return lines}
function color(r,g,b){return`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`}
function rect(x,y,width,height,fill){return`${color(...fill)} rg ${x} ${y} ${width} ${height} re f`}
function line(x1,y1,x2,y2,stroke,width=1){return`${color(...stroke)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`}
function pdfText(x,y,size,text,bold=false,fill=[0.20,0.18,0.16]){return`${color(...fill)} rg BT /${bold?'F2':'F1'} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`}
function sector(cx,cy,radius,startAngle,endAngle,fill){const steps=Math.max(3,Math.ceil((endAngle-startAngle)/5));const commands=[`${color(...fill)} rg`,`${cx} ${cy} m`];for(let step=0;step<=steps;step++){const angle=(startAngle+(endAngle-startAngle)*step/steps)*Math.PI/180;commands.push(`${(cx+Math.cos(angle)*radius).toFixed(2)} ${(cy+Math.sin(angle)*radius).toFixed(2)} l`)}commands.push('h f');return commands.join('\n')}
function donutChart(cx,cy,radius,percent){const executed=Math.max(0,Math.min(100,percent));const commands=[sector(cx,cy,radius,-90,270,[0.90,0.86,0.79])];if(executed>0)commands.push(sector(cx,cy,radius,-90,-90+360*executed/100,[0.68,0.34,0.14]));return commands.join('\n')}
function circlePath(cx,cy,radius){const points=[];for(let step=0;step<=36;step++){const angle=(step/36)*Math.PI*2;points.push(`${(cx+Math.cos(angle)*radius).toFixed(2)} ${(cy+Math.sin(angle)*radius).toFixed(2)} ${step?'l':'m'}`)}return`${points.join(' ')} h`}
function donutInner(cx,cy,radius){return`${color(1,1,1)} rg ${circlePath(cx,cy,radius*0.62)} f`}

function auditFindings(sources,mef){
 const findings=[];
 const ssi=sources?.ssi,invierte=sources?.invierte;
 const add=(level,title,detail)=>findings.push({level,title,detail});
 if(!ssi?.available)add('revisar','SSI no confirmó el CUI','No se obtuvo una ficha SSI vinculada al código de la fila seleccionada.');
 if(!invierte?.available)add('revisar','Invierte.pe no confirmó el CUI','La ficha pública de ejecución no devolvió el mismo CUI.');
 if(ssi?.available&&invierte?.available&&sources.checks?.updatedCostConsistent===false)add('alerta','Costo actualizado discrepante','SSI e Invierte.pe muestran montos distintos; revisar fecha y registro de modificación.');
 if(ssi?.available&&invierte?.available&&sources.checks?.nameConsistent===false)add('revisar','Nombre diferente entre fuentes','Las denominaciones oficiales difieren; confirmar que corresponden al mismo alcance y CUI.');
 if(sources.checks?.mefSsiSameFiscalYear&&sources.checks?.mefSsiPimMatch===false)add('revisar','PIM MEF/SSI no coincide','Comparación preliminar del mismo ejercicio; verificar código, unidad ejecutora y fecha de corte.');
 if(sources.checks?.mefSsiSameFiscalYear&&sources.checks?.mefSsiDevengadoMatch===false)add('revisar','Devengado MEF/SSI no coincide','Comparación preliminar del mismo ejercicio; revisar corte y precisión de los importes.');
 if(sources.checks?.mefSsiSameFiscalYear&&sources.checks?.mefSsiGiradoMatch===false)add('revisar','Girado MEF/SSI no coincide','Comparación preliminar del mismo ejercicio; comprobar actualización y atribución por CUI.');
 if(mef.pim===0&&(mef.devengado>0||mef.girado>0))add('alerta','Ejecución con PIM igual a cero','La fila MEF muestra ejecución financiera pese a un PIM visible igual a cero. Revisar año, corte y fila seleccionada.');
 if(mef.pim>0&&mef.devengado>mef.pim)add('alerta','Devengado supera el PIM','La razón Devengado/PIM excede 100% en la fila visible; confirmar modificaciones, corte y consistencia de los campos.');
 if(mef.girado>mef.devengado)add('alerta','Girado supera el devengado','La relación de montos es inusual para la fila visible y requiere revisión de fuente y corte.');
 if(mef.advance<0||mef.advance>100)add('alerta','Porcentaje MEF fuera de rango','El porcentaje de avance visible no se encuentra entre 0% y 100%.');
 if(ssi?.physicalExecution!=null&&(ssi.physicalExecution<0||ssi.physicalExecution>100))add('alerta','Avance físico SSI fuera de rango','El porcentaje informado por SSI no se encuentra entre 0% y 100%.');
 if(ssi?.physicalRegistered==='NO'&&ssi?.physicalExecution!=null)add('revisar','Registro físico inconsistente','SSI informa un porcentaje de avance pero marca que no hay ejecución física registrada. Validar el corte del Formato 12-B.');
 if(ssi?.available&&(!ssi.unitFormuladora||!ssi.opmi||!ssi.unitExecutora))add('revisar','Registro orgánico incompleto','Falta identificar en SSI la UF, OPMI o UEI para una revisión de responsabilidades y roles.');
 if(!findings.length)add('nota','Sin alertas preliminares detectadas','Las verificaciones automáticas básicas no encontraron relaciones fuera de rango; esto no sustituye una auditoría documental o de campo.');
 return findings;
}

function financialSummary(mef){return mef.pim>0?mef.devengado/mef.pim*100:null}
function buildPdf(report){
 const {project,yearValue,scope,sources,analysis,generatedAt}=report;
 const mef=sources.mef.financial,ssi=sources.ssi,invierte=sources.invierte;
 const findings=auditFindings(sources,mef);
 const financePct=financialSummary(mef);
 const title=pdfSafe(project.name.replace(/^\s*\d{7}\s*:\s*/,''));
 const commands=[];
 commands.push(rect(0,0,612,792,[1,0.985,0.95]));
 commands.push(rect(0,742,612,50,[0.42,0.25,0.14]));
 commands.push(pdfText(34,768,17,'GEOSISMOS · REPORTE DE OBRA',true,[1,0.98,0.94]));
 commands.push(pdfText(34,750,9,`Emitido ${generatedAt} · año fiscal MEF ${yearValue} · ${scope}`,false,[1,0.94,0.82]));
 let titleLines=wrapText(title,91).slice(0,3),ty=713;
 for(const text of titleLines){commands.push(pdfText(34,ty,12,text,true,[0.19,0.16,0.13]));ty-=15}
 commands.push(pdfText(34,ty-2,9,`CUI ${project.cui||'no disponible'} · Entidad: ${ssi?.entity||'No confirmada por SSI'}`,false));
 const cardY=ty-75;
 const cards=[['PIA · MEF',mef.pia],['PIM · MEF',mef.pim],['DEVENGADO',mef.devengado],['GIRADO · MEF',mef.girado],['COSTO ACTUALIZADO',ssi?.updatedCost]];
 for(let index=0;index<cards.length;index++){
  const x=34+index*109;
  commands.push(rect(x,cardY,104,48,[1,0.97,0.91]));
  commands.push(pdfText(x+6,cardY+31,6.1,cards[index][0],true,[0.48,0.30,0.15]));
  commands.push(pdfText(x+6,cardY+12,7.8,cards[index][1]==null?'No disponible':money(cards[index][1]),true));
 }
 const chartTop=cardY-19;
 commands.push(pdfText(45,chartTop,10,'LECTURA FINANCIERA',true,[0.45,0.27,0.14]));
 commands.push(donutChart(108,chartTop-72,39,financePct||0));
 commands.push(donutInner(108,chartTop-72,39));
 commands.push(pdfText(83,chartTop-70,11,financePct==null?'N/D':`${financePct.toFixed(1)}%`,true));
 commands.push(pdfText(48,chartTop-123,7,'Devengado / PIM del ano elegido',false));
 commands.push(pdfText(51,chartTop-135,7,'Solo referencia financiera; no es avance fisico.',false));
 const barX=205,barTop=chartTop-22,barWidth=150;
 commands.push(pdfText(barX,chartTop,10,'EJECUCION FINANCIERA · S/',true,[0.45,0.27,0.14]));
 const barItems=[['PIA',mef.pia],['PIM',mef.pim],['Devengado',mef.devengado],['Girado',mef.girado]];
 const maxValue=Math.max(1,...barItems.map(item=>item[1]));
 barItems.forEach(([label,value],index)=>{
  const y=barTop-index*25;
  commands.push(pdfText(barX,y+4,7,label));
  commands.push(rect(barX+54,y,barWidth,9,[0.91,0.87,0.80]));
  if(value>0)commands.push(rect(barX+54,y,barWidth*Math.min(1,value/maxValue),9,[0.68,0.34,0.14]));
  commands.push(pdfText(barX+54,y-9,6,money(value),false,[0.35,0.30,0.26]));
 });
 const physX=421,physTop=chartTop-26;
 commands.push(pdfText(physX,chartTop,10,'AVANCE FISICO · SSI',true,[0.45,0.27,0.14]));
 const physical=ssi?.physicalExecution;
 commands.push(pdfText(physX,physTop-18,9,physical==null?'No disponible':`${physical.toFixed(2)}% · registrado en SSI`,true));
 commands.push(pdfText(physX,physTop-35,7,`Dato de referencia MEF: ${mef.advance.toFixed(1)}%`,false));
 commands.push(pdfText(physX,physTop-49,6,'Las bases/cortes pueden diferir; no equivalen.',false));
 commands.push(line(34,chartTop-156,578,chartTop-156,[0.84,0.75,0.62],0.8));
 const statusY=chartTop-177;
 commands.push(pdfText(34,statusY,10,'REVISION PRELIMINAR · POSIBLES INCONSISTENCIAS',true,[0.45,0.27,0.14]));
 findings.slice(0,4).forEach((finding,index)=>{
  const y=statusY-17-index*24;
  const accent=finding.level==='alerta'?[0.69,0.23,0.12]:finding.level==='revisar'?[0.66,0.43,0.13]:[0.28,0.48,0.36];
  commands.push(rect(34,y-5,5,17,accent));
  commands.push(pdfText(45,y+4,8,`${finding.level.toUpperCase()}: ${finding.title}`,true,accent));
  wrapText(finding.detail,115).slice(0,1).forEach(text=>commands.push(pdfText(45,y-7,6.6,text,false,[0.29,0.26,0.22])));
 });
 const summaryY=statusY-17-findings.slice(0,4).length*24-9;
 const summaryText=String(analysis||'').split(/\r?\n/).filter(line=>line.trim()).slice(0,2).join(' ').replace(/^\s*[\d.)-]+\s*/,'');
 if(summaryText){
  commands.push(pdfText(34,summaryY,8.2,'RESUMEN DEL ANALISIS IA',true,[0.45,0.27,0.14]));
  wrapText(summaryText,120).slice(0,3).forEach((text,index)=>commands.push(pdfText(34,summaryY-13-index*10,6.7,text,false,[0.29,0.26,0.22])));
 }
 commands.push(line(34,47,578,47,[0.84,0.75,0.62],0.6));
 commands.push(pdfText(34,32,6.4,'Fuentes consultadas: MEF · SSI · Banco de Inversiones / Invierte.pe. El estado de confirmacion y los cortes figuran en pagina 2.',false,[0.36,0.31,0.25]));
 const pageOne=commands.join('\n');

 const detailLines=[];
 detailLines.push('INFORME DE ANALISIS Y AUDITORIA PRELIMINAR');
 detailLines.push(`Obra: ${title}`);
 detailLines.push(`CUI ${project.cui} · Ambito MEF ${scope} · Ejercicio ${yearValue}`);
 detailLines.push('');
 detailLines.push('FUENTES Y COINCIDENCIAS');
 detailLines.push(`MEF Consulta Amigable: fila seleccionada y montos del ejercicio ${yearValue}; PIM ${money(mef.pim)}, devengado ${money(mef.devengado)}, Girado ${money(mef.girado)}.`);
 detailLines.push(`SSI: ${ssi?.available?'CUI '+ssi.cui+' confirmado':'no confirmado'}; situacion ${ssi?.situation||'no informada'}; estado ${ssi?.status||'no informado'}; actualizacion F12-B ${ssi?.lastPhysicalUpdate||'no indicada'}.`);
 detailLines.push(`Avance fisico SSI: ${ssi?.physicalExecution==null?'no disponible':`${ssi.physicalExecution}%`}; marca de registro de ejecucion fisica: ${ssi?.physicalRegistered||'sin dato'}.`);
 detailLines.push(`Unidades registradas en SSI: UF ${ssi?.unitFormuladora||'no identificada'}; OPMI ${ssi?.opmi||'no identificada'}; UEI ${ssi?.unitExecutora||'no identificada'}.`);
 if(ssi?.latestStatus)detailLines.push(`Ultima situacion reportada por SSI: ${ssi.latestStatus}`);
 if(ssi?.latestProblem)detailLines.push(`Problemas/restricciones reportados en SSI: ${ssi.latestProblem}`);
 detailLines.push(`Cruce financiero MEF/SSI ${yearValue}: ${sources.checks?.mefSsiSameFiscalYear?`PIM ${sources.checks.mefSsiPimMatch===null?'sin comparar':sources.checks.mefSsiPimMatch?'coincide':'difiere'}, Devengado ${sources.checks.mefSsiDevengadoMatch===null?'sin comparar':sources.checks.mefSsiDevengadoMatch?'coincide':'difiere'}, Girado ${sources.checks.mefSsiGiradoMatch===null?'sin comparar':sources.checks.mefSsiGiradoMatch?'coincide':'difiere'}`:'no comparable con el corte del SSI'}.`);
 detailLines.push(`Invierte.pe: ${invierte?.available?'CUI '+invierte.cui+' confirmado':'no confirmado'}; costo inicial ${invierte?.originalCost==null?'no informado':money(invierte.originalCost)}; costo actualizado ${invierte?.updatedCost==null?'no informado':money(invierte.updatedCost)}; ultima modificacion ${invierte?.lastModification||'sin fecha legible'}.`);
 detailLines.push(`Cruce de costos SSI/Invierte.pe: ${sources.checks?.updatedCostConsistent?'coincide al centimo':ssi?.updatedCost!=null&&invierte?.updatedCost!=null?'no coincide':'no se pudo contrastar'}. Nombre entre fuentes: ${sources.checks?.nameConsistent?'consistente':ssi?.available&&invierte?.available?'diferente; revisar alcance':'no contrastado'}.`);
 detailLines.push('');
 detailLines.push('ANALISIS DEL PANEL IA');
 detailLines.push(...String(analysis||'No se recibio analisis IA.').split(/\r?\n/).flatMap(line=>line?wrapText(line):['']));
 detailLines.push('');
 detailLines.push('EVIDENCIA DIRECTA Y LIMITES');
 detailLines.push(`Consulta MEF: ${sources.mef.sourceUrl}`);
 detailLines.push(`Ficha SSI por CUI: ${ssi?.sourceUrl||'No disponible'}`);
 detailLines.push(`Ficha publica de ejecucion Invierte.pe: ${invierte?.sourceUrl||sources.invierteUrl||'No disponible'}`);
 detailLines.push(`Verificacion consultada: ${generatedAt}. La lista corresponde a la fila y pagina visibles del MEF; este reporte no certifica el universo de paginas no consultadas.`);
 detailLines.push('El avance fisico es el ultimo registro SSI disponible, no una inspeccion en campo. Devengado y Girado son ejecucion financiera y no demuestran por si solos avance fisico, calidad, culminacion, valorizacion ni pagos vencidos.');
 const detailPages=[];let current=[];for(const line of detailLines){const parts=wrapText(line,103);if(current.length+parts.length>49&&current.length){detailPages.push(current);current=[]}current.push(...parts)}if(current.length)detailPages.push(current);
 const allPages=[pageOne,...detailPages.map((lines,index)=>{
  const pageCommands=[rect(0,0,612,792,[1,0.985,0.95]),rect(0,742,612,50,[0.42,0.25,0.14]),pdfText(34,766,14,index===0?'ANALISIS POR OBRA · EVIDENCIA OFICIAL':'ANALISIS POR OBRA · CONTINUACION',true,[1,0.98,0.94])];
  let y=718;
  for(const line of lines){if(!line){y-=8;continue}const isHeading=/^(ANALISIS DEL PANEL IA|FUENTES Y COINCIDENCIAS|EVIDENCIA DIRECTA Y LIMITES|INFORME DE ANALISIS)/.test(line);pageCommands.push(pdfText(36,y,isHeading?9:7.7,line,isHeading,isHeading?[0.47,0.27,0.14]:[0.19,0.17,0.15]));y-=isHeading?17:13}
  pageCommands.push(line(34,36,578,36,[0.84,0.75,0.62],0.6));
  pageCommands.push(pdfText(34,22,6,`GeoSismosLatam · CUI ${project.cui} · reporte preliminar basado en fuentes oficiales.`,false,[0.36,0.31,0.25]));
  pageCommands.push(pdfText(542,22,6,`PAG ${index+2}/${detailPages.length+1}`,false,[0.36,0.31,0.25]));
  return pageCommands.join('\n');
 })];
 allPages[0]+=`\n${pdfText(542,32,6,`PAG 1/${allPages.length}`,false,[0.36,0.31,0.25])}`;
 const objects=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
 const pageRefs=[];
 allPages.forEach((content,index)=>{const pageId=5+index*2,streamId=pageId+1;pageRefs.push(`${pageId} 0 R`);objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`;objects[streamId]=`<< /Length ${content.length} >>\nstream\n${content}\nendstream`});
 objects[2]=`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${allPages.length} >>`;
 let pdf='%PDF-1.4\n%GeoSismos Informe\n';const offsets=[0];
 for(let id=1;id<objects.length;id++){if(!objects[id])continue;offsets[id]=pdf.length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`}
 const xrefOffset=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
 for(let id=1;id<objects.length;id++)pdf+=`${String(offsets[id]||0).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
 return new Blob([pdf],{type:'application/pdf'});
}

function showReport(result,project,scope,pdfUrl){
 preview.replaceChildren();
 const title=document.createElement('h3');title.textContent=`Análisis de obra · CUI ${project.cui}`;preview.append(title);
 const summary=document.createElement('p');summary.textContent=result.analysis;preview.append(summary);
 const checks=document.createElement('ul');checks.className='mef-audit-findings';
 auditFindings(result.sources,project).forEach(finding=>{const item=document.createElement('li');item.dataset.level=finding.level;item.textContent=`${finding.title}: ${finding.detail}`;checks.append(item)});
 preview.append(checks);
 const costStatus=result.sources.checks.updatedCostConsistent?'coincidentes':result.sources.ssi.updatedCost!=null&&result.sources.invierte?.updatedCost!=null?'discrepancia detectada':'sin datos suficientes';
 const sourceState=document.createElement('p');sourceState.className='mef-source-state';sourceState.textContent=`CUI ${project.cui} · SSI ${result.sources.ssi.available?'confirmado':'sin confirmación'} · Invierte.pe ${result.sources.invierte?.available?'confirmado':'sin confirmación'} · Costos actualizados ${costStatus}.`;preview.append(sourceState);
 const links=document.createElement('div');links.className='mef-report-links';
 const open=document.createElement('a');open.href=pdfUrl;open.target='_blank';open.rel='noopener';open.textContent='Abrir informe PDF';
 const download=document.createElement('a');download.href=pdfUrl;download.download=`Informe_Obra_${project.cui}_MEF_${year.value}.pdf`;download.textContent='Exportar / descargar PDF';
 const ssiLink=document.createElement('a');ssiLink.href=result.sources.ssi.sourceUrl;ssiLink.target='_blank';ssiLink.rel='noopener';ssiLink.textContent='Ver ficha SSI ↗';
 const invierteLink=document.createElement('a');invierteLink.href=result.sources.invierte?.sourceUrl||result.sources.invierteUrl;invierteLink.target='_blank';invierteLink.rel='noopener';invierteLink.textContent='Ver Invierte.pe ↗';
 links.append(open,download,ssiLink,invierteLink);preview.append(links);preview.hidden=false;
}

async function emitReport(project){
 const reportToken=++reportSequence;
 reportController?.abort();
 const controller=new AbortController();reportController=controller;
 const reportWindow=window.open('about:blank','GeoSismosInformeObra');
 if(reportWindow)reportWindow.document.write('<title>Verificando fuentes oficiales</title><p style="font:16px Arial;padding:24px;color:#6a3a18">Consultando SSI e Invierte.pe y preparando el análisis de auditoría…</p>');
 reportButton.disabled=true;setStatus(`Verificando CUI ${project.cui} en SSI e Invierte.pe; después la IA revisará ejecución física, gasto y alertas preliminares…`,'loading');
 try{
  const scope=district.value?`${district.value}, ${province.value}, Arequipa`:province.value?`${province.value}, Arequipa`:'Toda la región Arequipa';
  const response=await fetch('/api/mef/work-analysis',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({cui:project.cui,year:year.value,scope,mef:{name:project.name,pia:project.pia,pim:project.pim,devengado:project.devengado,girado:project.girado,advance:project.advance}})});
  const result=await response.json();
  if(reportToken!==reportSequence)return;
  if(!response.ok||!result.ok)throw new Error(result.error||`No se pudo generar el informe (HTTP ${response.status}).`);
  const generatedAt=new Intl.DateTimeFormat('es-PE',{dateStyle:'long',timeStyle:'short',timeZone:'America/Lima'}).format(new Date());
  const pdf=buildPdf({project,yearValue:year.value,scope,sources:result.sources,analysis:result.analysis,generatedAt});
  const url=URL.createObjectURL(pdf);showReport(result,project,scope,url);
  if(reportWindow)reportWindow.location.replace(url);
  const findingCount=auditFindings(result.sources,project).filter(finding=>finding.level!=='nota').length;
  setStatus(`PDF listo para CUI ${project.cui}: SSI ${result.sources.ssi.available?'confirmado':'no confirmado'}, Invierte.pe ${result.sources.invierte?.available?'confirmado':'no confirmado'}; ${findingCount} observación(es) preliminar(es). Revisa los cortes y las alertas antes de decidir.`);
  setTimeout(()=>URL.revokeObjectURL(url),60*60*1000);
 }catch(error){
  if(controller.signal.aborted||reportToken!==reportSequence)return;
  reportWindow?.close();setStatus(error.message,'error');preview.textContent=error.message;preview.hidden=false;
 }finally{
  if(reportToken===reportSequence){reportController=null;reportButton.disabled=!selectedProject?.cui}
 }
}

document.addEventListener('DOMContentLoaded',()=>{
 fillYears();
 loadTerritory().then(()=>setStatus('Catálogo INEI cargado: 8 provincias y 109 distritos. La cartera se tomará solo del MEF.')).catch(error=>setStatus(error.message,'error'));
 province.addEventListener('change',()=>{updateDistricts();refreshPortal()});
 district.addEventListener('change',refreshPortal);
 year.addEventListener('change',refreshPortal);
 byId('mefRefresh').addEventListener('click',refreshPortal);
 reportButton.addEventListener('click',()=>{if(selectedProject?.cui)emitReport(selectedProject)});
 document.querySelector('[data-view="mef"]')?.addEventListener('click',()=>{if(!initialized)refreshPortal()});
});
})();
