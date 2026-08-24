# GeoSismosLatam V14 – Carreteras, agricultura, mercados y logística

## Nuevos módulos

### Carreteras
- Nuevo visor nacional de carreteras e incidencias.
- GPS del usuario.
- Clasificación: accidente, vía obstaculizada, neblina, lluvia/huaico, daño de infraestructura y reporte público.
- Ventana de detalle al hacer clic en cada incidente.
- Accesos directos a SUTRAN para contraste oficial.
- Actualización de señales web cada 10 minutos mediante Cloudflare Worker.
- Tráfico Google: integración opcional mediante clave Google Maps JavaScript API restringida al dominio.

### Agricultura y siembras
- Mantiene MIDAGRI/SIEA como fuente estructural.
- Añade modelo experimental multifuentе y separación de señales oficiales/secundarias.
- Fuentes previstas: MIDAGRI/SIEA, INEI, agencias agrarias, gobiernos regionales, ANA/juntas de usuarios y publicaciones públicas verificables.
- El modelo nunca debe mostrarse como estadística oficial.

### Mercados
- Panel de Lima, Arequipa y norte peruano.
- Enlaces oficiales a EMMSA/MIDAGRI y fuentes regionales.
- Cada precio indica tipo y confianza.
- Referencias históricas no se presentan como precio vigente.
- Cron diario configurado a las 10:00 a. m. de Perú (15:00 UTC).

### Fletes
- Cotizador experimental por origen, destino y toneladas.
- Geocodificación + distancia vial + rango operativo.
- No equivale a una cotización comercial y debe contrastarse con transportistas.

## Redes sociales
No existe acceso universal y legítimo a “todas las redes sociales”. WhatsApp privado no puede ser rastreado. Facebook, Instagram, TikTok y Telegram solo deben integrarse cuando la publicación sea pública y el acceso esté permitido por sus APIs/términos o por enlaces aportados. La V14 deja esta información separada como “NO OFICIAL / POR VERIFICAR”.

## Actualización
- Carreteras: cron cada 10 minutos.
- Agricultura/mercados: cron 10:00 a. m. Perú para la actualización diaria principal.
- Las fuentes oficiales prevalecen sobre estimaciones.
