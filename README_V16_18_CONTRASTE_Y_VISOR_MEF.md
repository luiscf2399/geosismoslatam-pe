# GeoSismos V16.18 · contraste y visor MEF

## Mejoras

- Aumenta el contraste de textos en leyendas, paneles oscuros, controles, chips, información del mapa y pies de página, manteniendo la paleta marfil, mostaza y naranja opaco.
- Mantiene el visor MEF en la parte inferior y espera hasta dos minutos por la primera carga; al filtrar, espera hasta un minuto por la respuesta. También permite los recursos de verificación anti-bots que el portal MEF carga desde rutas separadas.
- Evita que se muestre GeoSismos duplicado dentro del visor si la ruta proxy todavía no está activa. En ese caso conserva el espacio del visor con un aviso claro y un enlace directo al MEF.
- Aplica una segunda apertura automática si el MEF demora en la primera carga.

## Qué significa el aviso del visor

Si el área inferior vuelve a mostrar la portada de GeoSismos o un aviso de bloqueo, el contenido no es una tabla del MEF. Puede faltar publicar la ruta Worker o el MEF puede estar rechazando temporalmente la conexión automática por su protección anti-bots. No se soluciona aumentando la espera ni subiendo únicamente los archivos HTML.

## Publicación correcta

1. Sube y publica el contenido actualizado incluyendo `worker.js` y `wrangler.jsonc` en la raíz de despliegue de Cloudflare Workers & Pages.
2. Confirma que el Worker esté conectado a los assets y que `wrangler.jsonc` conserve `run_worker_first` para `/mef-portal/*` y `/api/*`.
3. No uses GitHub Pages como único alojamiento: no ejecuta este Worker ni su puente al MEF. Si GitHub es el origen del proyecto, debe desplegar hacia Cloudflare Workers & Pages con la configuración del Worker.
4. Comprueba que `https://geosismoslatam-pe.luis2399cuadrafelipa.workers.dev/mef-portal/transparencia/Navegador/Default.aspx` cargue el portal oficial y no la página de GeoSismos. El `/api/health` identifica la versión publicada.
5. Después de publicar, recarga la página ignorando la caché o vuelve a abrirla en una ventana privada. Entra a **MEF** y consulta año y ámbito; la aplicación filtra automáticamente hasta **Producto/Proyecto** y refleja las filas visibles del portal.

El vínculo **Abrir MEF** permite consultar la fuente directamente si la publicación del Worker aún está pendiente. Esa navegación manual no puede ser leída automáticamente por la página por las restricciones del navegador entre dominios.

## Fuentes y alcance

- [Consulta Amigable · MEF](https://apps5.mineco.gob.pe/transparencia/Navegador/Default.aspx)
- [SSI · Sistema de Seguimiento de Inversiones](https://ofi5.mef.gob.pe/ssi/ssi/Index)
- [Invierte.pe · Consulta pública](https://ofi5.mef.gob.pe/inviertePub/ConsultaPublica/ConsultaAvanzada)

Los portales oficiales determinan sus propios cortes y disponibilidad. Los avisos cruzados son preliminares y requieren verificación documental; no constituyen una auditoría integral ni una certificación de la obra.
