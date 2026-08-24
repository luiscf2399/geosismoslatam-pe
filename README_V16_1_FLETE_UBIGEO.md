# GeoSismosLatam Web V16.1 — Calculadora de flete accesible

Mejoras:
- Salida y llegada mediante selectores Región/Departamento → Provincia → Distrito.
- Base territorial INEI 2025 incluida localmente (`ubigeo_inei_2025.csv`).
- Se elimina la escritura libre como entrada principal para evitar ambigüedades.
- Campo de carga claramente rotulado en toneladas métricas (t), con equivalencia 1 t = 1000 kg.
- El cálculo sigue usando el endpoint experimental `/api/freight` y muestra distancia, carga, promedio, rango y referencias.
- Diseño responsive para escritorio y móvil.

Fuente territorial de apoyo: dataset público basado en Directorio Nacional de Gobiernos Regionales/Municipales INEI 2025, empaquetado para uso del selector.
