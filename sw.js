const CACHE='geosismos-v16-14-pwa-20260927';
const CORE=[
  './','./index.html','./styles.css?v=15.0.0','./logo.svg','./clif_logo.jpg','./manifest.webmanifest',
  './v14_extension.css?v=15.0.0','./v15_extension.css?v=16.0.0','./v16_extension.css?v=16.0.0','./v16_2_extension.css?v=16.5.0','./v16_4_extension.css?v=16.5.0','./marine_pro.css?v=16.12','./v16_13_compact.css?v=16.14.0','./v16_13_mef.css?v=16.14.0','./v16_14_mef.css?v=16.14.0','./v16_6_smart_inputs.css?v=16.6.0',
  './app.js?v=16.14.0','./v14_config.js?v=16.14.0','./v14_extension.js?v=16.14.0','./ubigeo_freight.js?v=16.6.0','./v15_extension.js?v=16.14.0','./v16_extension.js?v=16.6.0','./v16_2_extension.js?v=16.6.0','./v16_6_smart_inputs.js?v=16.6.0','./marine_pro.js?v=16.12','./v16_13_mef.js?v=16.14.0','./girados-2026.json',
  './ubigeo_inei_2025.csv','./icons/apple-touch-icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone()));return response}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response})));
});
