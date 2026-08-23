const CACHE='geosismos-v7-2-20260823-2';
const ASSETS=['./','./index.html','./styles.css?v=7.2.0','./app.js?v=7.2.0','./logo.svg','./clif_logo.jpg','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r=>{
    const c=r.clone(); caches.open(CACHE).then(x=>x.put(e.request,c)); return r;
  }).catch(()=>caches.match(e.request)));
});
