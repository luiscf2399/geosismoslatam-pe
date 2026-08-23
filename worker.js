
const IGP_QUERY = "https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/SismosReportados/MapServer/0/query";
const USGS_DAY = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const USGS_WEEK = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const USGS_MONTH = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
const USGS_FDSN = "https://earthquake.usgs.gov/fdsnws/event/1/query";

const WMS = {
  sen_jja: "https://idesep.senamhi.gob.pe/geoserver/g_03_02/wms",
  sen_aug: "https://idesep.senamhi.gob.pe/geoserver/g_05_02/wms",
  sen_numeric: "https://idesep.senamhi.gob.pe/geoserver/g_03_05/wms",
  sen_24h: "http://idesep.senamhi.gob.pe/geoserver/g_prono_pp_24h/wms",
  sen_quebradas: "http://idesep.senamhi.gob.pe/geoserver/g_acti_quebrada/wms"
};

const ARCGIS = {
  risk_mass: "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_SUSCEPTIBLE_MOV_MASA_REGIONAL/MapServer",
  risk_flood: "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_SUSCEPTIBILIDAD_INUNDACION_FLUVIAL_MIL1/MapServer",
  risk_hazards: "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_PELIGROS_GEOLOGICOS/MapServer",
  igp_zoning: "https://ide.igp.gob.pe/arcgis/rest/services/cienciastierrasolida/EstudiosZonificacion/MapServer"
};


const EMERGENCY_DECLARATIONS = [
  {
    decree:"094-2026-PCM",
    cause:"Intensas precipitaciones pluviales",
    start:"2026-06-25T00:00:00-05:00",
    end:"2026-08-24T00:00:00-05:00",
    official:"https://www.gob.pe/institucion/pcm/normas-legales",
    html:"https://busquedas.elperuano.pe/api/visor_html/2527462-3"
  },
  {
    decree:"097-2026-PCM",
    cause:"Intensas precipitaciones asociadas al Fenómeno El Niño 2026-2027",
    start:"2026-07-02T00:00:00-05:00",
    end:"2026-08-31T00:00:00-05:00",
    official:"https://www.gob.pe/institucion/pcm/normas-legales/8372996-097-2026-pcm",
    html:"https://busquedas.elperuano.pe/api/visor_html/2530995-1"
  },
  {
    decree:"116-2026-PCM",
    cause:"Déficit hídrico para el período de lluvias 2026-2027",
    start:"2026-08-14T00:00:00-05:00",
    end:"2026-10-13T00:00:00-05:00",
    official:"https://www.gob.pe/institucion/pcm/normas-legales",
    html:"https://busquedas.elperuano.pe/api/visor_html/2542969-2"
  }
];

const CROP_CALENDAR = {
  potato:{name:"Papa",months:5,planting:"agosto–enero (varía por zona)",harvest:"enero–junio",note:"Periodo vegetativo referencial cercano a 5 meses en el ejemplo metodológico SIEA; puede variar por variedad, altitud y manejo."},
  rice:{name:"Arroz cáscara",months:5,planting:"variable según valle y disponibilidad hídrica",harvest:"aprox. 4–6 meses después",note:"El calendario cambia marcadamente entre costa y selva y depende del manejo de agua."},
  yellow_maize:{name:"Maíz amarillo duro",months:5,planting:"campaña variable por región",harvest:"aprox. 4–6 meses después",note:"Referencia general; consultar estadística local SIEA."},
  starchy_maize:{name:"Maíz amiláceo",months:7,planting:"principalmente campaña grande andina",harvest:"aprox. 6–9 meses después",note:"Duración muy dependiente de altitud y variedad."},
  bean:{name:"Frijol grano seco",months:4,planting:"campañas variables por valle",harvest:"aprox. 3–5 meses después",note:"Referencia agronómica orientativa."},
  onion:{name:"Cebolla",months:5,planting:"escalonada según valle",harvest:"aprox. 4–6 meses después",note:"La fecha de cosecha depende de cultivar y manejo."},
  quinoa:{name:"Quinua",months:6,planting:"principalmente primavera andina",harvest:"aprox. 5–8 meses después",note:"Referencia orientativa por diversidad de ecotipos."},
  wheat:{name:"Trigo",months:6,planting:"campaña andina variable",harvest:"aprox. 5–7 meses después",note:"Referencia general; validar localmente."}
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8", ...cors, ...extra}
  });
}

function parseIGPTime(p) {
  const raw = p.fechaevento ?? p.fecha;
  if (typeof raw === "number" && raw > 1e11) {
    const d = new Date(raw);
    const y = d.getUTCFullYear(), m = String(d.getUTCMonth()+1).padStart(2,"0"), day = String(d.getUTCDate()).padStart(2,"0");
    const h = String(p.hora || "00:00:00").trim();
    if (/^\d{1,2}:\d{2}/.test(h)) {
      let [hh,mm,ss="00"] = h.split(":");
      const t = Date.parse(`${y}-${m}-${day}T${String(hh).padStart(2,"0")}:${mm}:${ss}-05:00`);
      if (Number.isFinite(t)) return t;
    }
    return raw;
  }
  const t = Date.parse(raw || "");
  return Number.isFinite(t) ? t : 0;
}

function normIGP(j) {
  return (j?.features || []).map((f,i) => {
    const p=f.properties||f.attributes||{}, g=f.geometry||{};
    const c=Array.isArray(g.coordinates)?g.coordinates:[g.x??p.lon,g.y??p.lat];
    const t=parseIGPTime(p), mag=Number(p.magnitud??p.mag??0), depth=Number(p.prof??0);
    return {
      id:`IGP-${p.code||p.objectid||i}-${t}`,
      geometry:{type:"Point",coordinates:[Number(c[0]),Number(c[1]),depth]},
      properties:{
        source:"IGP", mag, time:t, place:p.ref||p.departamento||"Perú",
        department:p.departamento||"", intensity:p.int_||"", code:p.code||"",
        depthClass:p.profundidad||"",
        url:p.code?`https://ultimosismo.igp.gob.pe/evento/${p.code}`:"https://ultimosismo.igp.gob.pe/"
      }
    };
  }).filter(f => Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1]) && f.properties.time);
}

function inPeru(c){ return c[1]>=-22.8 && c[1]<=1.5 && c[0]>=-85.5 && c[0]<=-68; }

function normUSGS(j){
  return (j?.features||[]).filter(f=>inPeru(f.geometry.coordinates)).map(f=>{
    const c=f.geometry.coordinates,p=f.properties||{};
    return {
      id:`USGS-${f.id}`,
      geometry:{type:"Point",coordinates:[+c[0],+c[1],+c[2]||0]},
      properties:{source:"USGS",mag:+p.mag||0,time:+p.time||0,place:p.place||"Perú",magType:p.magType||"",url:p.url||"https://earthquake.usgs.gov/"}
    };
  });
}

function hav(a,b,c,d){
  const R=6371,p=Math.PI/180,da=(c-a)*p,db=(d-b)*p;
  const A=Math.sin(da/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(db/2)**2;
  return 2*R*Math.asin(Math.sqrt(A));
}

function merge(igp,usgs){
  const used=new Set(),out=[];
  for(const a of [...igp].sort((x,y)=>y.properties.time-x.properties.time)){
    let best=-1,bd=1e9;
    usgs.forEach((b,i)=>{
      if(used.has(i))return;
      const dt=Math.abs(a.properties.time-b.properties.time)/1000;
      const d=hav(a.geometry.coordinates[1],a.geometry.coordinates[0],b.geometry.coordinates[1],b.geometry.coordinates[0]);
      if(dt<240 && d<90 && d<bd){best=i;bd=d}
    });
    if(best>=0){
      const b=usgs[best]; used.add(best);
      out.push({...a,properties:{...a.properties,source:"IGP+USGS",usgsMag:b.properties.mag,usgsUrl:b.properties.url,usgsMagType:b.properties.magType}});
    } else out.push(a);
  }
  usgs.forEach((b,i)=>{if(!used.has(i))out.push(b)});
  return out.sort((a,b)=>b.properties.time-a.properties.time);
}

async function fetchIGP(){
  const u=new URL(IGP_QUERY);
  Object.entries({
    where:"1=1",outFields:"*",returnGeometry:"true",outSR:"4326",
    orderByFields:"fechaevento DESC",resultRecordCount:"2000",f:"geojson"
  }).forEach(([k,v])=>u.searchParams.set(k,v));
  let r=await fetch(u,{cf:{cacheTtl:10,cacheEverything:true}});
  if(!r.ok){
    u.searchParams.set("f","json");
    r=await fetch(u,{cf:{cacheTtl:10,cacheEverything:true}});
  }
  if(!r.ok) throw new Error(`IGP ${r.status}`);
  return normIGP(await r.json());
}

async function fetchUSGS(hours){
  let url;
  if(hours<=24) url=USGS_DAY;
  else if(hours<=168) url=USGS_WEEK;
  else if(hours<=744) url=USGS_MONTH;
  else {
    const u=new URL(USGS_FDSN);
    const start=new Date(Date.now()-hours*3600000).toISOString();
    u.searchParams.set("format","geojson");
    u.searchParams.set("starttime",start);
    u.searchParams.set("endtime",new Date().toISOString());
    u.searchParams.set("minlatitude","-22.8");
    u.searchParams.set("maxlatitude","1.5");
    u.searchParams.set("minlongitude","-85.5");
    u.searchParams.set("maxlongitude","-68");
    u.searchParams.set("orderby","time");
    u.searchParams.set("limit","20000");
    url=u.toString();
  }
  const r=await fetch(url,{cf:{cacheTtl:hours<=24?10:hours<=168?60:300,cacheEverything:true}});
  if(!r.ok) throw new Error(`USGS ${r.status}`);
  return normUSGS(await r.json());
}

async function cachedJson(cacheKey, ttl, ctx, producer){
  const cache=caches.default;
  const req=new Request(cacheKey);
  const hit=await cache.match(req);
  if(hit) return hit;
  const data=await producer();
  const res=json(data,200,{"Cache-Control":`public, max-age=0, s-maxage=${ttl}`});
  ctx.waitUntil(cache.put(req,res.clone()));
  return res;
}

async function quakes(request,ctx){
  const u=new URL(request.url);
  const hours=Math.max(1,Math.min(8760,Number(u.searchParams.get("hours")||24)));
  const ttl=hours<=24?10:hours<=168?60:300;
  const key=`https://cache.geosismoslatam.pe/quakes?hours=${hours}`;
  return cachedJson(key,ttl,ctx,async()=>{
    const [a,b]=await Promise.allSettled([fetchIGP(),fetchUSGS(hours)]);
    const igp=a.status==="fulfilled"?a.value:[];
    const usgs=b.status==="fulfilled"?b.value:[];
    const cutoff=Date.now()-hours*3600000;
    const events=merge(igp,usgs).filter(f=>f.properties.time>=cutoff);
    return {
      ok:events.length>0 || igp.length>0 || usgs.length>0,
      generatedAt:Date.now(),
      hours,
      sources:{
        igp:{ok:a.status==="fulfilled",count:igp.filter(x=>x.properties.time>=cutoff).length,error:a.status==="rejected"?String(a.reason?.message||a.reason):null},
        usgs:{ok:b.status==="fulfilled",count:usgs.length,error:b.status==="rejected"?String(b.reason?.message||b.reason):null}
      },
      events
    };
  });
}

async function proxyWms(request,source){
  const base=WMS[source];
  if(!base) return json({error:"Fuente WMS no permitida"},404);
  const inUrl=new URL(request.url), target=new URL(base);
  for(const [k,v] of inUrl.searchParams) target.searchParams.append(k,v);
  const r=await fetch(target.toString(),{
    method:request.method,
    headers:{"User-Agent":"GeoSismosLatam/6.0 (+portal ciudadano de prevención)"},
    cf:{cacheTtl:60,cacheEverything:true}
  });
  const h=new Headers(r.headers); Object.entries(cors).forEach(([k,v])=>h.set(k,v));
  h.set("Cache-Control","public, max-age=30, s-maxage=60");
  return new Response(r.body,{status:r.status,headers:h});
}

async function proxyArcgis(request,source,suffix){
  const base=ARCGIS[source];
  if(!base) return json({error:"Fuente ArcGIS no permitida"},404);
  const inUrl=new URL(request.url);
  const target=new URL(base + (suffix||""));
  for(const [k,v] of inUrl.searchParams) target.searchParams.append(k,v);
  const init={method:request.method,headers:{}};
  const ct=request.headers.get("content-type"); if(ct)init.headers["content-type"]=ct;
  if(!["GET","HEAD"].includes(request.method)) init.body=await request.arrayBuffer();
  const r=await fetch(target.toString(),init);
  const h=new Headers(r.headers); Object.entries(cors).forEach(([k,v])=>h.set(k,v));
  h.set("Cache-Control","public, max-age=60, s-maxage=300");
  return new Response(r.body,{status:r.status,headers:h});
}



function decodeEntities(s){
  return String(s||"")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'").replace(/&aacute;/gi,"á").replace(/&eacute;/gi,"é")
    .replace(/&iacute;/gi,"í").replace(/&oacute;/gi,"ó").replace(/&uacute;/gi,"ú")
    .replace(/&ntilde;/gi,"ñ").replace(/\s+/g," ").trim();
}
function stripTags(s){return decodeEntities(String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," "))}
function parseEmergencyAnnex(htmlText, meta){
  const rows=[...htmlText.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  const out=[]; let dep="",prov="";
  for(const row of rows){
    const cells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>stripTags(m[1])).filter(Boolean);
    if(!cells.length)continue;
    const joined=cells.join(" ").toUpperCase();
    if(joined.includes("DEPARTAMENTO") && joined.includes("DISTRITO")) continue;
    const nidx=cells.findIndex(c=>/^\d{1,4}$/.test(c.replace(/[^\d]/g,"")));
    if(nidx<0 || !cells[nidx+1]) continue;
    const before=cells.slice(0,nidx).filter(c=>!/^N[°ºO]?$/i.test(c));
    if(before.length>=2){dep=before[0];prov=before[1]}
    else if(before.length===1){prov=before[0]}
    const district=cells[nidx+1].replace(/\s+/g," ").trim();
    if(!district || district.length<2)continue;
    out.push({department:dep,province:prov,district,decree:meta.decree,cause:meta.cause,start:meta.start,end:meta.end,official:meta.official});
  }
  return out;
}
async function fetchEmergencyDeclaration(meta){
  const r=await fetch(meta.html,{cf:{cacheTtl:1800,cacheEverything:true},headers:{"User-Agent":"GeoSismosLatam/7.0 portal ciudadano"}});
  if(!r.ok) throw new Error(`${meta.decree}: ${r.status}`);
  const text=await r.text();
  const districts=parseEmergencyAnnex(text,meta);
  return {...meta,districts};
}
async function emergencies(request,ctx,env){
  const now=Date.now();
  const active=EMERGENCY_DECLARATIONS.filter(d=>now>=Date.parse(d.start)&&now<Date.parse(d.end));
  const key="https://cache.geosismoslatam.pe/risk/emergencies-v7";
  return cachedJson(key,1800,ctx,async()=>{
    const results=await Promise.allSettled(active.map(fetchEmergencyDeclaration));
    const declarations=[],districts=[],errors=[];
    results.forEach((r,i)=>{
      if(r.status==="fulfilled"){declarations.push({...active[i],count:r.value.districts.length});districts.push(...r.value.districts)}
      else errors.push(String(r.reason?.message||r.reason));
    });
    const payload={ok:true,generatedAt:Date.now(),scope:"SINAGERD: desastre o peligro inminente",declarations,districts,errors};
    if(env?.DB){
      try{
        await env.DB.prepare("INSERT INTO source_snapshots(source_key, fetched_at, payload) VALUES(?1,?2,?3)")
          .bind("emergencies",Date.now(),JSON.stringify(payload)).run();
      }catch{}
    }
    return payload;
  });
}
async function enfen(ctx,env){
  const key="https://cache.geosismoslatam.pe/risk/enfen-v7";
  return cachedJson(key,1800,ctx,async()=>{
    const home=await fetch("https://enfen.imarpe.gob.pe/",{cf:{cacheTtl:1800,cacheEverything:true}});
    if(!home.ok)throw new Error("ENFEN no disponible");
    const ht=await home.text();
    const titleMatch=ht.match(/Comunicado Oficial Enfen N[°º]\s*\d{1,2}-2026/i);
    const hrefMatch=ht.match(/href=["']([^"']+)["'][^>]*>\s*(?:<[^>]+>\s*)*Comunicado Oficial Enfen N[°º]\s*\d{1,2}-2026/i);
    let link=hrefMatch?.[1]||"https://enfen.imarpe.gob.pe/";
    if(link.startsWith("/"))link="https://enfen.imarpe.gob.pe"+link;
    let status="",summary="";
    try{
      const pr=await fetch(link,{cf:{cacheTtl:1800,cacheEverything:true}});
      if(pr.ok){
        const pt=stripTags(await pr.text());
        status=(pt.match(/Estado de sistema de alerta:\s*([^•\n.]{3,90})/i)||[])[1]?.trim()||"";
        const idx=pt.toLowerCase().indexOf("mantiene el estado");
        summary=idx>=0?pt.slice(idx,idx+650):pt.slice(0,650);
      }
    }catch{}
    const payload={ok:true,generatedAt:Date.now(),title:titleMatch?.[0]||"Último comunicado ENFEN",status:status||"Consultar comunicado oficial",summary,link};
    if(env?.DB){
      try{
        await env.DB.prepare("INSERT INTO source_snapshots(source_key, fetched_at, payload) VALUES(?1,?2,?3)")
          .bind("enfen",Date.now(),JSON.stringify(payload)).run();
      }catch{}
    }
    return payload;
  });
}
async function agriculture(ctx,env){
  const key="https://cache.geosismoslatam.pe/agriculture/v7";
  return cachedJson(key,86400,ctx,async()=>{
    const urls=[
      ["SIEA","https://siea.midagri.gob.pe/portal/siea"],
      ["SIEA Satelital","https://siea.midagri.gob.pe/gee/index.html"],
      ["SENAMHI","https://www.senamhi.gob.pe/"],
      ["SIGRID","https://sigrid4.cenepred.gob.pe/"]
    ];
    const checks=await Promise.allSettled(urls.map(async ([name,url])=>{
      const r=await fetch(url,{cf:{cacheTtl:3600,cacheEverything:true}});
      return {name,url,ok:r.ok,status:r.status};
    }));
    const sources=checks.map((x,i)=>x.status==="fulfilled"?x.value:{name:urls[i][0],url:urls[i][1],ok:false,status:0});
    const payload={
      ok:true,generatedAt:Date.now(),campaign:"2026-2027",
      methodology:"SIEA registra avances y perspectivas de cultivos a nivel distrito, provincia y región. Las cosechas proyectadas se relacionan con las siembras ejecutadas y el periodo vegetativo.",
      crops:CROP_CALENDAR,sources
    };
    if(env?.DB){
      try{
        await env.DB.prepare("INSERT INTO source_snapshots(source_key, fetched_at, payload) VALUES(?1,?2,?3)")
          .bind("agriculture",Date.now(),JSON.stringify(payload)).run();
      }catch{}
    }
    return payload;
  });
}

async function proxyImage(url, ttl=300){
  const r=await fetch(url,{cf:{cacheTtl:ttl,cacheEverything:true}});
  if(!r.ok) throw new Error(`Imagen oficial ${r.status}`);
  const h=new Headers(r.headers);
  Object.entries(cors).forEach(([k,v])=>h.set(k,v));
  h.set("Cache-Control",`public, max-age=60, s-maxage=${ttl}`);
  return new Response(r.body,{status:r.status,headers:h});
}

async function noaaGeoColor(ctx){
  const cache=caches.default;
  const key=new Request("https://cache.geosismoslatam.pe/noaa/geocolor");
  const hit=await cache.match(key);
  if(hit)return hit;
  const page=await fetch("https://www.goes.noaa.gov/sector.php?sat=G19&sector=ssa",{cf:{cacheTtl:300,cacheEverything:true}});
  if(!page.ok)throw new Error("NOAA no disponible");
  const html=await page.text();
  const matches=[...html.matchAll(/https:\/\/cdn\.star\.nesdis\.noaa\.gov\/GOES19\/ABI\/SECTOR\/ssa\/GEOCOLOR\/[^"'<> ]+\.jpg/g)].map(m=>m[0]);
  const preferred=matches.find(x=>x.includes("1800x1080"))||matches.find(x=>x.includes("900x540"))||matches[0];
  if(!preferred)throw new Error("No se encontró imagen GOES");
  const img=await fetch(preferred,{cf:{cacheTtl:300,cacheEverything:true}});
  if(!img.ok)throw new Error("Imagen GOES no disponible");
  const h=new Headers(img.headers);Object.entries(cors).forEach(([k,v])=>h.set(k,v));
  h.set("Cache-Control","public, max-age=60, s-maxage=300");
  const res=new Response(img.body,{status:200,headers:h});
  ctx.waitUntil(cache.put(key,res.clone()));
  return res;
}

async function dhnWind(){
  return proxyImage("https://www.naylamp.dhn.mil.pe/oceano/pronosticos/data/peru_wind_1.gif",300);
}

export default {
  async fetch(request,env,ctx){
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
    const u=new URL(request.url);
    try{
      if(u.pathname==="/api/quakes") return quakes(request,ctx);
      if(u.pathname==="/"){
        const home=new URL("/index.html",request.url);
        return env.ASSETS.fetch(new Request(home,request));
      }
      if(u.pathname==="/api/health") return json({ok:true,time:Date.now(),service:"GeoSismosLatam API v7"});
      if(u.pathname==="/api/emergencies") return emergencies(request,ctx,env);
      if(u.pathname==="/api/enfen") return enfen(ctx,env);
      if(u.pathname==="/api/agriculture") return agriculture(ctx,env);
      if(u.pathname==="/api/noaa/geocolor") return noaaGeoColor(ctx);
      if(u.pathname==="/api/dhn/wind") return dhnWind();
      if(u.pathname.startsWith("/api/wms/")){
        const source=u.pathname.split("/")[3];
        return proxyWms(request,source);
      }
      if(u.pathname.startsWith("/api/arcgis/")){
        const parts=u.pathname.split("/");
        const source=parts[3];
        const suffix="/"+parts.slice(4).join("/");
        return proxyArcgis(request,source,suffix==="/"?"":suffix);
      }
      return env.ASSETS.fetch(request);
    }catch(e){
      return json({ok:false,error:"Servicio temporalmente no disponible",detail:String(e?.message||e)},502,{"Cache-Control":"no-store"});
    }
  },
  async scheduled(event,env,ctx){
    const req=new Request("https://geosismoslatam.local/internal");
    if(event.cron==="*/30 * * * *"){
      ctx.waitUntil(Promise.allSettled([emergencies(req,ctx,env),enfen(ctx,env)]));
    }else{
      ctx.waitUntil(Promise.allSettled([agriculture(ctx,env),enfen(ctx,env)]));
    }
  }
};
