# GeoSismosLatam V4.2 - corrección de monitoreo e historial

Cambios principales:
- Consulta IGP robusta usando ArcGIS JSON y tres endpoints de respaldo (SismosReportados, Sismicidad y UltimoSismo).
- Visor principal por defecto: últimas 24 horas.
- Si no existen eventos en 24 h, amplía automáticamente a 7 días para que el usuario no vea un mapa vacío cuando sí hay actividad reciente.
- Historial ampliado: 24 h, 7, 30, 90, 365 días y todo lo disponible.
- Hasta 1000 eventos visibles en historial.
- Proyección experimental con malla ~35-40 km y celdas más pequeñas. Esto aumenta resolución visual, no precisión predictiva.
- Caché actualizado a V4.2 para evitar que el navegador conserve la versión anterior.

Subir reemplazando: index.html, app.js, styles.css, sw.js, logo.svg y manifest.webmanifest. Conservar yape_qr.png.
