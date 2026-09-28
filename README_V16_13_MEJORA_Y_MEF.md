# V16.13 · Vista compacta y seguimiento MEF

## Interfaz

- Las leyendas por visor quedan plegadas en una sola fila y se despliegan cuando hacen falta.
- Se retira el asistente lateral duplicado que no tenía un servicio de IA conectado.
- Se limita cada vista a un espacio publicitario; se eliminan inserciones repetidas dentro de paneles.
- Se elimina la ficha CLIF repetida de la vista de suelos; sus servicios continúan en la sección Servicios.
- Se retira un complemento heredado que volvía a insertar contenido duplicado en Suelos.

## Seguimiento de inversiones

La nueva vista **Inversión · Seguimiento MEF** consulta el recurso oficial Detalle de inversiones por año y ámbito. La cartera y el PIM se muestran en la fila de cada obra. Al expandirla aparece solamente el **Girado**, con cruce por año, departamento, provincia, distrito, CUI y SEC_EJEC. El informe descargable resume el subconjunto buscado y suma Girado únicamente cuando existe un cruce verificado.

El snapshot `girados-2026.json` contiene el corte contrastado para la Municipalidad Distrital de Bella Unión, Arequipa, año 2026, unidad ejecutora 300372; actualización publicada 26/09/2026, verificada el 27/09/2026. Para otras ubicaciones y años el Girado se indica como **No verificado**; no se extrapola ni se presenta como cero. No es una integración del 100% de sistemas del MEF ni una actualización diaria automática de Consulta Amigable.

Ejemplo CUI 2474080: SSI informa PIM S/ 5,618,450.00 y devengado S/ 3,178,586.69; Consulta Amigable publica devengado y Girado por S/ 3,178,587 (redondeo a soles enteros del portal).

## Publicación

El sitio utiliza el Worker y el directorio de assets definidos en `wrangler.jsonc`. Para publicar la actualización, sube los cambios de este paquete al repositorio conectado a Cloudflare o despliega el Worker desde un entorno autenticado. Mantén claves y tokens en Secrets de Cloudflare, nunca dentro de archivos públicos. El nuevo endpoint de consulta es `GET /api/mef/investments`; el snapshot de Girado es un dato público servido como asset.

## Fuentes

- [MEF · Detalle de inversiones](https://datosabiertos.mef.gob.pe/dataset/detalle-de-inversiones/resource/f9cc4ba0-931a-4b70-86c9-eacbd8c68596)
- [MEF · SSI](https://ofi5.mef.gob.pe/ssi/ssi/Index)
- [MEF · Consulta Amigable](https://www.mef.gob.pe/es/seguimiento-de-la-ejecucion-presupuestal-consulta-amigable)
