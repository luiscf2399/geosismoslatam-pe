# GeoSismosLatam V6 — versión robusta

## Correcciones estructurales
- `worker.js` centraliza IGP/CENSIS + USGS y evita que cada navegador consulte directamente a las instituciones.
- Cache de borde: ~10 s para actividad sísmica reciente.
- Proxy WMS para SENAMHI: elimina problemas CORS y mixed-content de avisos 24h/quebradas.
- Proxy ArcGIS para INGEMMET e IGP: mejora carga de Riesgos y Suelos.
- Historial consulta al backend según período, no solo lo que estaba cargado en memoria.
- Proyección carga hasta 1 año de catálogo disponible y combina actividad reciente + fondo histórico.
- Service Worker NO cachea `/api/*`.
- `.assetsignore` impide publicar `.env`, Python y archivos internos como assets.
- Mejoras responsive, foco de teclado y reduced-motion.

## Archivos que deben subirse/reemplazarse
- index.html
- app.js
- styles.css
- sw.js
- worker.js
- wrangler.jsonc
- .assetsignore
- SECURITY_ACTIONS.txt

Conservar:
- logo.svg
- clif_logo.jpg
- yape_qr.png
- manifest.webmanifest

## Después de subir
Cloudflare -> Deployments -> esperar check verde -> Visit -> Ctrl+Shift+R.
