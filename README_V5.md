# GeoSismosLatam V5 — Portal Nacional

## Qué cambia
- Nueva interfaz oscura tipo centro de monitoreo con identidad propia.
- Monitoreo IGP/CENSIS + USGS, consulta del navegador cada 10 segundos.
- Historial visible en panel flotante.
- Proyección experimental con heatmap y zonas priorizadas, sin cuadrícula saturada.
- Portal Lluvias con enlaces oficiales SENAMHI / INDECI / ANA.
- Portal Riesgos con SIGRID / INDECI / INGEMMET y capa WMS de INGEMMET cuando responde.
- Portal Suelos con capas oficiales del servicio ArcGIS IGP EstudiosZonificacion:
  - Zonificación (9)
  - Suelos (4)
  - Capacidad portante (5)
  - Zona estudiada (10)
- Logo CLIF y botón WhatsApp.
- Créditos permanentes a fuentes oficiales.

## Para publicar
Sube/reemplaza en GitHub:
index.html
app.js
styles.css
sw.js
manifest.webmanifest
logo.svg
clif_logo.jpg
yape_qr.png (conservar si ya existe)

Después espera el deploy de Cloudflare y recarga con Ctrl+Shift+R.

## Nota técnica
La web consulta las fuentes desde el navegador. Si una entidad bloquea CORS o cambia su servicio,
se requiere un Worker proxy propio para estabilizar la ingestión. La interfaz ya está preparada para esa fase.
