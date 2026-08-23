# GeoSismosLatam V7 — Riesgos, estados de emergencia, agricultura y UX

## Cambios principales
1. Panel RIESGOS con cuatro modos:
   - Peligros oficiales (INGEMMET/IGP)
   - Estados de Emergencia vinculados a desastre o peligro inminente
   - Fenómeno El Niño
   - Afectaciones SINAGERD
2. Estados de emergencia:
   - consulta automática cada 30 minutos
   - filtra por vigencia legal configurada
   - distritos vencidos dejan de pintarse
   - relleno diferenciado por distrito; borde azul = lluvias/El Niño, borde ámbar = déficit hídrico
   - fuente visible PCM / Diario Oficial El Peruano
3. ENFEN:
   - síntesis automática del comunicado oficial más reciente que pueda detectarse
   - refresco cada 30 minutos
4. AGRICULTURA:
   - nueva pestaña nacional
   - selección de distrito
   - cultivos temporales principales
   - ventana de siembra/cosecha referencial
   - estimación orientativa de cosecha basada en periodo vegetativo
   - enlaces directos MIDAGRI/SIEA y SIEA Satelital
   - actualización de salud/fuentes cada 24 h
5. SUELOS:
   - capas IGP ampliadas: zonificación, suelos, capacidad portante, geología, geomorfología, geodinámica y área estudiada
   - explicación ciudadana S0–S4
   - identificación del punto consultando el servicio oficial IGP
6. EXPERIENCIA VISUAL:
   - bordes de 2 px y color por módulo
   - mayor contraste entre ventanas
   - panel informativo contextual en Lluvias, Riesgos, Suelos y Agricultura
   - mantiene ficha detallada del sismo seleccionado

## Importante sobre automatización
No se mezclan automáticamente reportes de redes sociales/prensa con datos oficiales.
Los medios secundarios deben mostrarse con etiqueta NO OFICIAL / POR VERIFICAR.
La siguiente fase puede añadir feeds específicos de radios, prensa y TV una vez validados.

## Fuentes principales
IGP/CENSIS
SENAMHI
CENEPRED/SIGRID
INDECI/COEN
PCM / Diario Oficial El Peruano
ENFEN / IMARPE
MIDAGRI / SIEA
INGEMMET
ANA
DHN
USGS como complemento internacional

## Archivos a subir
index.html
app.js
styles.css
sw.js
worker.js
wrangler.jsonc
.assetsignore
migration_v7.sql

### D1
Antes de aprovechar el almacenamiento histórico de V7, ejecutar `migration_v7.sql`
en Cloudflare D1 Console. La interfaz puede funcionar sin estas tablas, pero el histórico
de snapshots y futuras ingestas requiere la migración.
