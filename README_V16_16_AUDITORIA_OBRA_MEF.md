# GeoSismos V16.16 · auditoría preliminar por obra

## Cambios

- Consulta directamente la Consulta Amigable vigente del MEF y fija el ejercicio fiscal desde 2023 y el filtro **Sólo Proyectos**.
- Recorre el nivel **Producto/Proyecto** para Arequipa completa o la ruta de gobierno local, municipalidad, provincia y distrito elegidos.
- La cartera refleja las filas visibles del portal oficial en su página actual; no mezcla un padrón antiguo ni afirma haber leído páginas no abiertas.
- Al seleccionar una fila con CUI, el informe se genera automáticamente y abre un PDF. **Reemitir informe PDF** vuelve a generar el informe de la obra seleccionada.
- Contrasta la fila MEF con SSI e Invierte.pe; revisa PIA, PIM, devengado, Girado, costo actualizado, avance físico, situación registrada y datos disponibles de UF/OPMI/UEI.
- El PDF presenta gráficos financieros, avance físico disponible, alertas preliminares y acciones sugeridas. Devengado/PIM no se confunde con avance físico; discrepancias son señales para verificar, no prueba de irregularidad.
- Conserva la interfaz clara en marfil, mostaza y naranja opaco.

## Fuentes oficiales

- [Consulta Amigable · MEF](https://apps5.mineco.gob.pe/transparencia/Navegador/Default.aspx)
- [Sistema de Seguimiento de Inversiones · SSI](https://ofi5.mef.gob.pe/ssi/ssi/Index)
- [Consulta avanzada · Banco de Inversiones / Invierte.pe](https://ofi5.mef.gob.pe/inviertePub/ConsultaPublica/ConsultaAvanzada)

Si una fuente oficial no entrega datos, el reporte lo indica. Los portales tienen cortes propios; el avance SSI no sustituye inspección física ni expediente. Es un apoyo preliminar, no una auditoría integral ni una certificación de obra.

## Publicación

1. Descarga y extrae el ZIP. Sube el contenido a la raíz que Cloudflare usa para el Worker y los assets, reemplazando los archivos del mismo nombre; no subas el ZIP como si fuera el sitio.
2. Elimina del repositorio las versiones retiradas: `v16_13_mef.js`, `v16_13_mef.css`, `v16_14_mef.css` y `girados-2026.json`.
3. Publica desde Cloudflare Workers & Pages con el repositorio conectado. GitHub Pages por sí solo no ejecuta el proxy ni el endpoint de análisis.
4. Habilita Workers AI y confirma el binding **AI** configurado en `wrangler.jsonc`; pueden aplicar cuotas o cargos de Cloudflare.
5. Abre la web publicada, entra a **MEF**, elige año/ámbito y selecciona una fila con CUI. Permite ventanas emergentes para que se abra el PDF; también puedes descargarlo desde el informe.

Si el portal MEF está temporalmente fuera de servicio o cambia su estructura, usa **Abrir MEF**. El sistema solo presenta registros leídos de la tabla oficial y declara las fuentes que no pudo confirmar.
