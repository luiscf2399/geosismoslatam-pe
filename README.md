# GEOSISMOSLATAM.PE — versión 1.0 visual

Prototipo web funcional inspirado en el diseño solicitado, limitado a Perú.

## Funciones incluidas
- Dos visores simultáneos: sismos observados y modelo probabilístico experimental.
- Imagen satelital NASA GIBS/MODIS.
- Límites departamentales y provinciales en GeoJSON público; carga distrital bajo demanda.
- Selección nacional Departamento → Provincia → Distrito mediante UBIGEO.
- Feed sísmico USGS con actualización automática cada 5 minutos.
- Panel de reporte al hacer clic en un sismo o una zona del modelo.
- Magnitud, profundidad, coordenadas, ventana temporal y margen espacial orientativo.
- Gráficas de magnitud, tendencia y profundidad.
- Código QR de Yape y correo de contacto.
- PWA instalable.

## Ejecutar
Use un servidor HTTP local o publique los archivos en Cloudflare Pages, Netlify, GitHub Pages u otro hosting estático.

Ejemplo:
    py -m http.server 8000

Luego abrir:
    http://localhost:8000

## Advertencia científica
El panel probabilístico no es una predicción determinista. Para producción debe reemplazarse el índice actual por un backend validado con ETAS, Gutenberg–Richter, KDE espacio-temporal, backtesting y calibración.
