# GeoSismosLatam V11 — Leyendas cartográficas y prueba de sonidos

## Cambios
- Se elimina la leyenda flotante/desplegable que cubría parte del geovisor.
- La leyenda ahora se muestra en flujo, debajo de la pestaña activa, como una tabla cartográfica.
- Cada tabla presenta color/símbolo, elemento representado y explicación breve.
- La escala cambia automáticamente según visor, capa, horizonte o elemento seleccionado.
- Se ocultan los callouts/leyendas flotantes redundantes para despejar el mapa.
- La biblioteca web incorpora los 14 sonidos disponibles en Android.
- El botón `Probar` usa ruta relativa versionada y muestra estado de reproducción/error.
- Android mantiene la reproducción nativa mediante `GeoSismosAndroid.previewEarthquakeSound`.

## Orden de despliegue web
1. Subir/reemplazar todo el contenido de esta carpeta en el proyecto Cloudflare/GitHub.
2. Verificar que la carpeta `sounds/` se publique completa.
3. Hacer deploy.
4. Abrir con `?v=11.0` o hacer recarga forzada.
5. Probar `SONIDOS > Probar` y cambiar por todas las pestañas para revisar las tablas de leyenda.

## Android
La versión Android V6 apunta a `index.html?v=11.0`; por eso primero debe publicarse la Web V11.
