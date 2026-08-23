# GeoSismosLatam V7.2 — Leyendas contextuales + hotfix raíz

## Leyenda dinámica
Se añadió un panel flotante "Cómo leer este visor" que cambia automáticamente según:
- Monitoreo
- Proyección
- Lluvias
- Mar y pesca
- Riesgos
- Suelos
- Agricultura
- Actualidad
- Prevención
- Metodología

También cambia al modificar:
- capa de lluvia
- modo de riesgo
- capa de suelos
- cultivo
- zona del litoral

La leyenda explica:
- qué significa cada color/símbolo
- fuente
- interpretación
- limitación o advertencia

## Hotfix HTTP 404
El Worker atiende explícitamente `/` devolviendo `/index.html`.
Además:
- html_handling: auto-trailing-slash
- not_found_handling: single-page-application

## Para subir desde V7
Reemplaza:
index.html
app.js
styles.css
sw.js
worker.js
wrangler.jsonc

No es necesario volver a ejecutar migration_v7.sql si ya fue ejecutada.
