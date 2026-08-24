# GeoSismosLatam V16.3 — Autocompletado ampliado

## Mejoras
- Búsqueda de calles y direcciones.
- Restaurantes, cafés, hoteles y alojamientos.
- Plazas, parques, atractivos y puntos de referencia.
- Centros comerciales, supermercados, mercados y negocios.
- Terminales, estaciones, aeropuertos, hospitales y centros educativos.
- Distritos, ciudades y otros lugares del Perú.
- Cada sugerencia muestra categoría e icono.
- Si existe `GOOGLE_PLACES_API_KEY`, el Worker utiliza Google Places Autocomplete (New) y Place Details.
- Sin clave, queda un respaldo público de menor alcance para pruebas.

## Cloudflare — opción recomendada
Añadir el secreto `GOOGLE_PLACES_API_KEY` en el Worker/Pages y restringir la clave al proyecto/dominio y APIs necesarias.
No escribir la clave dentro de JavaScript público.

## Nota
El servidor público de Nominatim no está pensado para autocomplete intensivo. Para producción con muchos usuarios se recomienda Google Places u otro proveedor autorizado, o una instancia propia de geocodificación.
