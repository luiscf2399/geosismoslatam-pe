# OSINT Perú Privado V2

## Qué agrega esta versión

La V2 permite buscar una persona o identificador y aplicar una **palabra clave documental**.

Ejemplos:

```text
/persona 12345678
/persona 12345678 | denuncia
/persona JUAN CARLOS PEREZ FLORES | sentencia
/persona JUAN CARLOS PEREZ FLORES | contrato
/persona 20123456789 | consorcio
```

El bot:

1. Busca coincidencias indexadas en dominios oficiales peruanos.
2. Prioriza PDFs.
3. Descarga un número limitado de PDFs públicos accesibles.
4. Extrae texto del PDF cuando el archivo contiene texto seleccionable.
5. Busca simultáneamente la identidad y la palabra clave.
6. Genera un PDF consolidado con resultados, extractos y enlaces.
7. Entrega el informe directamente en Telegram.

## Alcance real

No existe una API pública universal que permita obtener "todos los documentos de una persona".
Los siguientes casos pueden no aparecer automáticamente:

- portales con CAPTCHA;
- consultas que requieren login;
- documentos no indexados por buscadores;
- expedientes reservados;
- investigaciones fiscales no públicas;
- PDFs escaneados sin capa de texto;
- información protegida por ley.

El sistema no evita esas restricciones.

## Instalación rápida

### 1. Crear bot
En Telegram:
`@BotFather` → `/newbot`

Copia el token.

### 2. Python
Instala Python 3.11 o superior.

### 3. PowerShell dentro de la carpeta

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4. Configuración

```powershell
Copy-Item .env.example .env
notepad .env
```

Configura:

```env
TELEGRAM_BOT_TOKEN=TU_TOKEN_REAL
ADMIN_IDS=
ENABLE_HISTORY=1
MAX_RESULTS=20
MAX_PDFS=12
MAX_PDF_MB=12
BOT_TITLE=OSINT Perú Privado V2
```

### 5. Obtener tu ID

```powershell
python bot.py
```

En Telegram:
`/mi_id`

Copia el número, detén el bot con Ctrl+C y colócalo en:

```env
ADMIN_IDS=123456789
```

Reinicia:

```powershell
python bot.py
```

## Uso

### Sin filtro

```text
/persona 12345678
```

### Denuncias

```text
/persona 12345678 | denuncia
```

### Sentencias

```text
/persona NOMBRES APELLIDOS | sentencia
```

### Contratación pública

```text
/persona NOMBRES APELLIDOS | contrato
```

### Resoluciones

```text
/persona NOMBRES APELLIDOS | resolución
```

## Importante

Una coincidencia con "denuncia" significa que el término fue localizado en una referencia o
documento público asociado a la búsqueda. No significa que la persona haya cometido un delito.

Debe verificarse:
- identidad correcta;
- condición procesal;
- fecha;
- expediente;
- entidad;
- resultado final;
- posibles homónimos.

## Seguridad

- Mantén `.env` fuera de GitHub.
- No compartas el token.
- Usa ADMIN_IDS.
- Si no quieres guardar las búsquedas, usa `ENABLE_HISTORY=0`.
- Los PDFs descargados quedan en `downloaded_docs/`.
