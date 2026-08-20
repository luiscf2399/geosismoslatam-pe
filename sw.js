const C='geosismos-pe-v1';const FILES=['./','./index.html','./styles.css','./app.js','./admin_peru.js','./logo.svg','./yape_qr.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin===location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
