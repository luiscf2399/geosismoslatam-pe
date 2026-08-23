# GeoSismosLatam V4.1 pública

Subir estos archivos a la raíz del repositorio `geosismoslatam-pe`.

No elimina `yape_qr.png`: el HTML lo referencia con ese nombre y se puede conservar el archivo ya existente.

Cambios principales:
- Interfaz renovada tipo centro de monitoreo, sin copiar la identidad visual del IGP.
- Visor 12 h, IGP 24 h y multifuente 24 h.
- Historial 24 h / 7 d / 30 d.
- Ficha flotante por epicentro.
- Sección Mayor Magnitud Registrada.
- Proyección experimental cada 30 min.
- Actualidad sísmica para M >= 4.5 mediante enlaces de fuente.
- Alerta acústica de 7 s, habilitada por el usuario.
- Contactos, WhatsApp CLIF y QR Yape existente.
- Service worker con versión nueva para evitar que el navegador siga mostrando la interfaz anterior.

IMPORTANTE: después del deploy usar Ctrl+Shift+R una vez. El nuevo service worker usa caché gsl-v4-1.
