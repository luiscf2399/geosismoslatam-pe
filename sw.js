const CACHE='geosismos-v16-1-pwa-20260824';
const CORE=[
  './','./index.html','./styles.css?v=16.1.0','./app.js?v=16.1.0','./logo.svg','./clif_logo.jpg','./manifest.webmanifest',
  './v14_extension.css?v=16.1.0','./v15_extension.css?v=16.1.0','./v16_extension.css?v=16.1.0',
  './v14_config.js?v=16.1.0','./v14_extension.js?v=16.1.0','./ubigeo_freight.js?v=16.1.0','./v15_extension.js?v=16.1.0','./v16_extension.js?v=16.2.0','./v16_2_extension.js?v=16.2.0','./v16_2_extension.css?v=16.2.0',
  './ubigeo_inei_2025.csv',
  './icons/apple-touch-icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return;const nav=e.request.mode==='navigate';if(nav){e.respondWith(fetch(e.request).then(r=>{caches.open(CACHE).then(c=>c.put('./index.html',r.clone()));return r}).catch(()=>caches.match('./index.html')));return}e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r})))});
