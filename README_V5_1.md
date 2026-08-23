# GeoSismosLatam V5.1 — corrección Lluvias y Riesgos

Se corrigió el motivo por el cual los visores LLUVIAS y RIESGOS mostraban solo el mapa base.

## Lluvias
- Carga visible inicial: pronóstico climático de precipitación JJA del geoservicio WMS oficial SENAMHI/IDESEP.
- Capa climatológica de agosto.
- Intento automático de descubrir y cargar los WMS oficiales de:
  - aviso de corto plazo ante lluvias intensas 24 h
  - activación de quebradas
- Si el servicio de corto plazo bloquea la consulta del navegador, la web muestra el respaldo oficial JJA y explica el estado.

## Riesgos
Capas ArcGIS REST oficiales de INGEMMET:
- susceptibilidad por movimientos en masa
- susceptibilidad a inundación fluvial
- peligros geológicos inventariados
y capa geodinámica del IGP en zonas estudiadas.

## Subir a GitHub
Reemplazar únicamente:
- index.html
- app.js
- styles.css
- sw.js

Luego esperar deployment de Cloudflare y hacer Ctrl+Shift+R.
