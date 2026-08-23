# GeoSismosLatam 8.0 — clima, riesgos, agricultura y sonidos

## Cambios principales

### Lluvias y clima
- **Ahora:** incorpora una capa NASA GPM/IMERG mediante GIBS como estimación satelital reciente de precipitación.
- **1 día:** prioriza el producto oficial SENAMHI disponible para corto plazo.
- **1 semana:** utiliza el pronóstico numérico SENAMHI disponible y mantiene NASA/NOAA como fuentes de contraste/contexto.
- **1 a 6 meses:** incorpora la guía estacional global **NOAA/NCEP CFSv2**. El Worker obtiene dinámicamente la página oficial y muestra la imagen mensual correspondiente en el panel lateral.
- Los horizontes mensuales se rotulan expresamente como **proyección climática/modelada**, no como predicción de lluvia para una fecha exacta.
- El mapa de lluvias permite hacer clic para ver coordenadas, fuente, horizonte e interpretación de la capa activa.

### Visores dinámicos
- La leyenda contextual cambia con la pestaña y con el elemento seleccionado.
- Monitoreo sísmico: al seleccionar un evento explica el color de magnitud, profundidad y fuente.
- Proyección sísmica: al seleccionar una zona explica el índice relativo y la incertidumbre espacial.
- Lluvias: explica observación, pronóstico o proyección según horizonte.
- Riesgos: explica el modo/capa y las coordenadas del punto seleccionado.
- Suelos: mantiene identificación por punto y explicación S0–S4.
- Agricultura: la selección distrital contextualiza el cultivo y evita generar probabilidades no verificadas.
- Mar y pesca: cada punto costero explica qué significa el marcador y qué fuentes revisar.

### SIGRID / CENEPRED
- Nuevo endpoint `/api/sigrid/latest`.
- El Worker revisa periódicamente la disponibilidad de fuentes oficiales configuradas y registra fecha/estado.
- Esto es un **monitor de fuentes**, no una simulación de una API oficial de SIGRID. Para ingestión total de nuevos documentos se debe utilizar una interfaz pública/documentada si CENEPRED la ofrece o añadir un conector específico validado.

### Agricultura
- El panel incorpora un bloque de modelo agroclimático.
- Mientras no existan series distritales verificables suficientes, devuelve `DATOS INSUFICIENTES` en lugar de fabricar un índice.
- La arquitectura queda preparada para integrar series MIDAGRI/SIEA + SENAMHI + variables climáticas y validación retrospectiva.

### Sonidos
- Biblioteca web de 10 archivos WAV originales/procedurales.
- Ajustes para seleccionar y probar el sonido.
- En Android, la selección se comunica mediante el puente `GeoSismosAndroid`.

## Archivos principales a desplegar
`index.html`, `styles.css`, `app.js`, `worker.js`, `sw.js`, `manifest.webmanifest` y la carpeta `sounds/`.

## Nota técnica sobre NASA IMERG
IMERG es una estimación multisatélite. No debe presentarse como lectura puntual de pluviómetro. La versión Early Run tiene latencia y es adecuada para visualización casi en tiempo real, no para reemplazar observaciones oficiales de estación.

## Nota técnica sobre NOAA CFSv2
CFSv2 se utiliza como guía climática global. Los meses 1–6 representan tendencia/anomalía de modelo a escala amplia. No deben convertirse en afirmaciones del tipo “lloverá X mm en tal distrito el día Y”.
