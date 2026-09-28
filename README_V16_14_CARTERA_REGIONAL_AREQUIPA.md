# V16.14 · Cartera regional de Arequipa

## Cambios de navegación

- Se retira la pestaña y página “Centro”. El orden inicial queda Monitoreo, Proyección y MEF.
- La tercera pestaña se identifica como MEF y abre la cartera regional.

## Cartera MEF

- La consulta predeterminada cubre toda Arequipa y pagina el recurso oficial en bloques de 1,000 registros. Los filtros de provincia y distrito se generan desde los registros recuperados.
- Datos Abiertos MEF devolvió 7,222 inversiones para Arequipa en 2026 en la validación de este paquete. El visor calcula PIM y devengado sumando directamente los campos publicados; no estima Girado con una fórmula.
- La lista muestra 100 obras por vez; “Mostrar 100 más” evita saturar la página. La búsqueda incluye toda la cartera ya cargada.
- Girado por inversión solo se muestra con cruce directo verificado por año, CUI, unidad ejecutora y ubicación. No se atribuye a cada CUI el total municipal de Consulta Amigable.
- El reporte compartido indica Girado municipal de Bella Unión por S/ 9,281,805. Ese total es de la Municipalidad Distrital de Bella Unión, no el Girado de una obra individual ni el total regional.
- La cobertura de Girado continúa siendo parcial; los CUI sin cruce se muestran “No verificado”.

## Publicación

El Worker conserva el nombre `geosismoslatam-pe`. La consulta `GET /api/mef/investments` recibe `year`, `department` y `offset`; la interfaz solicita las páginas necesarias para completar la cartera regional. Publica el contenido del directorio junto con `wrangler.jsonc` mediante el Worker conectado a GitHub.

## Fuentes

- [MEF · Detalle de inversiones](https://datosabiertos.mef.gob.pe/dataset/detalle-de-inversiones/resource/f9cc4ba0-931a-4b70-86c9-eacbd8c68596)
- [MEF · Seguimiento de la Ejecución Presupuestal / Consulta Amigable](https://www.mef.gob.pe/es/seguimiento-de-la-ejecucion-presupuestal-consulta-amigable)
- [MEF · SSI](https://ofi5.mef.gob.pe/ssi/ssi/Index)
