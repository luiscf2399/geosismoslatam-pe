# GeoSismosLatam 3.0 — staging

## Corrige
- Cache/service worker versionado con estrategia network-first para HTML/JS/CSS y eliminación de caches antiguos.
- Visor Leaflet + Esri World Imagery + Esri Boundaries & Places para etiquetas automáticas por zoom.
- USGS consultado cada 60 s con contador visible.
- IGP/CENSIS consultado mediante servicios ArcGIS REST públicos para referencia oficial peruana.
- Permanencia: M<5 = 5 h; M5–6.4 = 24 h; M>=6.5 = 7 días.
- Alarma sonora de 5 segundos para eventos nuevos mientras la página está abierta y el usuario activó audio.
- Proyección probabilística experimental cada 30 min, con persistencia/histéresis y magnitud característica actualizada.
- Contexto global: USGS M4.5+ de 30 días + actividad regional + datos IGP recientes.
- ACTUALIDAD SÍSMICA como feed vertical; usa GDELT si responde y conserva enlace a fuente original.

## Reemplazar en una rama de prueba
- index.html
- app.js
- styles.css
- sw.js
- manifest.webmanifest

Conservar logo.svg y demás recursos existentes.

## Despliegue recomendado
1. Crear rama `v3-staging` en GitHub.
2. Reemplazar los cinco archivos allí.
3. Usar Preview de Cloudflare para probar sin tocar producción.
4. Verificar mapa, etiquetas, USGS, IGP, contador, alarma, expiración, proyección, Actualidad y recarga/caché.
5. Solo después fusionar a `main`.

## Limitaciones
- La proyección no predice fecha/hora/epicentro exactos.
- Audio web requiere interacción del usuario.
- Para push con app/web cerrada y recopilación de noticias en segundo plano se requiere backend y notificaciones, etapa siguiente antes de Google Play.
