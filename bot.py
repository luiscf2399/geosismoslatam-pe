import os
import html
import asyncio
from pathlib import Path

from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes

from db import init_db, log_search, get_history
from search_engine import validate_identity, validate_keyword, search_documents, enrich_with_pdfs
from report import create_pdf

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ADMIN_IDS = {int(x.strip()) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()}
ENABLE_HISTORY = os.getenv("ENABLE_HISTORY", "1") == "1"
MAX_RESULTS = max(5, min(int(os.getenv("MAX_RESULTS", "20")), 50))
MAX_PDFS = max(1, min(int(os.getenv("MAX_PDFS", "12")), 25))
MAX_PDF_MB = max(2, min(int(os.getenv("MAX_PDF_MB", "12")), 30))
BOT_TITLE = os.getenv("BOT_TITLE", "OSINT Perú Privado V2")

BASE = Path(__file__).resolve().parent
WORK_DIR = BASE / "downloaded_docs"
REPORT_DIR = BASE / "reports"

HELP = """
<b>OSINT Perú Privado V2</b>

Búsqueda documental pública:

<code>/persona 12345678</code>
Busca documentos públicos relacionados.

<code>/persona 12345678 | denuncia</code>
Busca documentos relacionados con esa persona y filtra por “denuncia”.

<code>/persona NOMBRES APELLIDOS | sentencia</code>
Busca por nombres + palabra clave.

<code>/keyword NOMBRES APELLIDOS | contrato</code>
Alias de /persona.

<code>/historial</code>
Últimas consultas.

<code>/mi_id</code>
Muestra tu Telegram ID.

Palabras clave útiles:
denuncia, sentencia, investigación, proceso, resolución, sanción,
contrato, orden de servicio, consorcio, proveedor, inhabilitación.

El bot solo consulta fuentes públicas. No accede a bases filtradas,
datos bancarios, telecomunicaciones, domicilios privados o registros reservados.
"""

def authorized(update: Update) -> bool:
    u = update.effective_user
    return bool(u and u.id in ADMIN_IDS)

async def reject(update: Update) -> bool:
    if authorized(update):
        return False
    uid = update.effective_user.id if update.effective_user else "desconocido"
    await update.effective_message.reply_text(
        "⛔ <b>Acceso no autorizado.</b>\n"
        f"Tu Telegram ID: <code>{uid}</code>\n"
        "Agrega este número a ADMIN_IDS en el archivo .env.",
        parse_mode=ParseMode.HTML
    )
    return True

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if await reject(update):
        return
    await update.effective_message.reply_text(HELP, parse_mode=ParseMode.HTML)

async def mi_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    await update.effective_message.reply_text(f"Tu Telegram ID es <code>{uid}</code>", parse_mode=ParseMode.HTML)

def parse_persona(text: str):
    # /persona IDENTIDAD | keyword
    parts = (text or "").split(maxsplit=1)
    if len(parts) < 2:
        return "", ""
    payload = parts[1].strip()
    if "|" in payload:
        identity, keyword = payload.split("|", 1)
    else:
        identity, keyword = payload, ""
    return identity.strip(), keyword.strip()

async def persona(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if await reject(update):
        return

    identity_raw, keyword_raw = parse_persona(update.effective_message.text or "")
    try:
        identity = validate_identity(identity_raw)
        keyword = validate_keyword(keyword_raw)
    except ValueError as e:
        await update.effective_message.reply_text(
            "Uso:\n"
            "<code>/persona 12345678 | denuncia</code>\n"
            "<code>/persona NOMBRES APELLIDOS | sentencia</code>\n\n"
            + html.escape(str(e)),
            parse_mode=ParseMode.HTML
        )
        return

    if ENABLE_HISTORY:
        u = update.effective_user
        log_search(u.id, u.username or "", "persona", identity, keyword)

    status = await update.effective_message.reply_text(
        "🔎 Buscando documentos públicos oficiales…"
    )

    try:
        hits = await asyncio.to_thread(search_documents, identity, keyword, MAX_RESULTS)
        await status.edit_text(
            f"📄 Encontré {len(hits)} referencias indexadas. "
            "Ahora verificaré PDFs públicos accesibles."
        )
        person_dir = WORK_DIR / str(update.effective_user.id)
        hits = await asyncio.to_thread(
            enrich_with_pdfs, hits, identity, keyword, person_dir, MAX_PDFS, MAX_PDF_MB
        )
    except Exception:
        hits = []

    await status.edit_text("🧾 Generando informe PDF…")

    pdf = await asyncio.to_thread(create_pdf, identity, keyword, hits, REPORT_DIR)

    kw_count = sum(1 for h in hits if h.keyword_found)
    pdf_count = sum(1 for h in hits if h.local_path)

    summary = [
        "<b>INVESTIGACIÓN DOCUMENTAL</b>",
        f"<b>Persona/identificador:</b> <code>{html.escape(identity)}</code>",
        f"<b>Filtro:</b> {html.escape(keyword) if keyword else 'Sin palabra clave'}",
        "",
        f"Referencias localizadas: <b>{len(hits)}</b>",
        f"PDF públicos descargados y revisados: <b>{pdf_count}</b>",
        f"Coincidencias con palabra clave: <b>{kw_count}</b>",
        "",
        "<i>Una coincidencia documental no acredita responsabilidad. "
        "Una denuncia no equivale a sentencia.</i>"
    ]
    await status.edit_text("\n".join(summary), parse_mode=ParseMode.HTML)

    # Envía hasta 10 fuentes principales.
    for i, h in enumerate(hits[:10], 1):
        flag = "✅" if h.keyword_found else "🔎"
        msg = (
            f"{flag} <b>{i}. {html.escape(h.title[:160])}</b>\n"
            f"{html.escape((h.snippet or '')[:500])}\n"
            f'<a href="{html.escape(h.url, quote=True)}">Abrir fuente oficial</a>'
        )
        await update.effective_message.reply_text(
            msg, parse_mode=ParseMode.HTML, disable_web_page_preview=True
        )

    with pdf.open("rb") as f:
        await update.effective_message.reply_document(
            document=f,
            filename=pdf.name,
            caption="📄 Informe consolidado de coincidencias documentales públicas."
        )

async def historial(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if await reject(update):
        return
    if not ENABLE_HISTORY:
        await update.effective_message.reply_text("Historial desactivado.")
        return
    rows = get_history(update.effective_user.id, 15)
    if not rows:
        await update.effective_message.reply_text("No hay consultas registradas.")
        return
    lines = ["🕘 <b>Historial</b>", ""]
    for qtype, value, keyword, created in rows:
        filt = f" | {keyword}" if keyword else ""
        lines.append(f"• <code>{html.escape(value)}</code>{html.escape(filt)} — {html.escape(created[:16])}")
    await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)

def main():
    if not TOKEN or TOKEN == "PEGA_AQUI_TU_TOKEN":
        raise SystemExit("Configura TELEGRAM_BOT_TOKEN en .env")

    init_db()
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("ayuda", start))
    app.add_handler(CommandHandler("mi_id", mi_id))
    app.add_handler(CommandHandler("persona", persona))
    app.add_handler(CommandHandler("keyword", persona))
    app.add_handler(CommandHandler("historial", historial))

    print(f"{BOT_TITLE} iniciado.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
