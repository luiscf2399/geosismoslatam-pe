(()=>{
'use strict';
const $=id=>document.getElementById(id);

function ad(slot='general'){
 const d=document.createElement('div');d.className='ad-mini';d.dataset.adSlot=slot;d.innerHTML='<div><span class="ad-label">PUBLICIDAD</span><b> Espacio disponible para anunciante</b><small>Patrocinio contextual · no interfiere con alertas ni controles</small></div><button class="btn" type="button">ANUNCIAR AQUÍ</button>';
 d.querySelector('button').onclick=()=>window.open('https://wa.me/message/TJKZ4FZLGCGFD1','_blank','noopener');return d;
}

function enhance(){
 document.querySelectorAll('main > .view').forEach(view=>{
  if(view.dataset.v164)return;
  view.dataset.v164='1';
  const wrap=document.createElement('div');wrap.className='v164-layout';
  const main=document.createElement('div');main.className='v164-main';
  while(view.firstChild)main.appendChild(view.firstChild);
  wrap.appendChild(main);view.appendChild(wrap);
  if(view.id!=='mef')main.insertBefore(ad(view.id),main.children[1]||null);
 });
}

function addServices(){
 if($('services'))return;
 const s=document.createElement('section');s.id='services';s.className='view';
 const services=['Topografía y levantamientos','Fotogrametría con dron','Planos y búsquedas catastrales','Subdivisión, acumulación y lotización','Habilitación urbana','Saneamiento físico legal','Trámites COFOPRI y Gobierno Regional','Declaratoria de fábrica','Diseño urbano y arquitectónico','Puntos geodésicos','Corrección y revisión de expedientes','Proyectos de vivienda y remodelación'];
 s.innerHTML=`<div class="section-hero"><div class="services-brand"><img src="clif_logo.jpg" alt="CLIF"><div><span>SERVICIOS PROFESIONALES</span><h2>CLIF Contratistas Generales</h2><p>Consulta servicios técnicos y solicita información directamente por WhatsApp.</p></div></div></div><div class="service-grid">${services.map(x=>`<article class="service-card"><h3>${x}</h3><p>Consulta alcance, disponibilidad y requerimientos del servicio.</p><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/message/TJKZ4FZLGCGFD1">💬 CONSULTAR POR WHATSAPP</a></article>`).join('')}</div>`;
 document.querySelector('main').appendChild(s);
 const nav=document.querySelector('.mainnav');const button=document.createElement('button');button.dataset.view='services';button.innerHTML='▦ <b>SERVICIOS</b><small>CLIF · Consultas</small>';nav.appendChild(button);
 button.onclick=()=>{document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.mainnav button').forEach(x=>x.classList.remove('active'));s.classList.add('active');button.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});};
}

document.addEventListener('DOMContentLoaded',()=>{addServices();enhance()});
})();
