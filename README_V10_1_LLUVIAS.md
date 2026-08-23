# GeoSismosLatam V10.1 — Proyección de lluvias con respaldo automático

## Qué cambia
- Si el WMS de SENAMHI de 24 h o 7 días no responde, el visor intenta cargar una grilla meteorológica alternativa para que el mapa no quede vacío.
- En horizontes de 1 a 6 meses el mapa ya no queda vacío: genera una capa espacial de celdas sobre Perú.
- La capa mensual intenta usar ECMWF SEAS5 (acceso Open-Meteo). Si el servicio estacional tampoco responde, activa una estimación propia de respaldo, identificada expresamente como no oficial.
- NOAA CFSv2 permanece como contraste visual lateral.
- Cada celda es clickeable y abre explicación de fuente, método, horizonte, color y limitaciones.

## Criterio del respaldo propio 2026–2027
El respaldo contextual no inventa milímetros. Genera un índice relativo húmedo/seco a partir de estacionalidad regional y del escenario 2026–2027 documentado por ENFEN/CENEPRED. Considera, entre otros, el contexto de El Niño Costero y el mayor riesgo de déficit hídrico señalado para sectores de la sierra sur. Por ello el resultado se muestra como índice orientativo y nunca como precipitación observada ni como pronóstico oficial.

## Jerarquía de fuentes
1. SENAMHI para corto plazo y avisos oficiales en Perú.
2. NASA GPM/IMERG para precipitación satelital reciente.
3. NOAA/NCEP CFSv2 como referencia estacional.
4. ECMWF SEAS5 como grilla estacional de respaldo cuando está disponible.
5. Estimación contextual GeoSismosLatam únicamente cuando las fuentes dinámicas no responden.

## Advertencia
Los horizontes mensuales son orientación climática de área. No predicen día, hora o lluvia puntual y no deben usarse como valor de diseño de ingeniería, dimensionamiento hidráulico o declaración oficial de emergencia.
