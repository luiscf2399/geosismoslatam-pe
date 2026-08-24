# GeoSismosLatam V16.8 – pruebas generales y confiabilidad

Cambios: presencia de usuarios en línea, combustible automático con OSINERGMIN/Datos Abiertos cuando la fuente CSV sea accesible, flete automático, estados de emergencia PCM con descubrimiento periódico, color por vigencia y días restantes.

## Cloudflare D1
Ejecutar una sola vez migration_v16_8.sql para habilitar el contador real de usuarios en línea.

## Variables opcionales
- GOOGLE_MAPS_API_KEY: activa Google Routes. Sin ella usa OSRM de respaldo.
- GOOGLE_PLACES_API_KEY: autocompletado Google Places.
- OSINERGMIN_FUEL_CSV_URL: URL directa del CSV oficial si el portal de Datos Abiertos cambia el enlace o bloquea descubrimiento.
- DIESEL_PRICE_PER_GAL: respaldo si OSINERGMIN no responde.
