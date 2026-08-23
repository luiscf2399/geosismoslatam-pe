from pathlib import Path
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from xml.sax.saxutils import escape

def create_pdf(identity: str, keyword: str, hits, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_id = "".join(c for c in identity if c.isalnum() or c in ("-", "_"))[:35] or "persona"
    safe_kw = "".join(c for c in keyword if c.isalnum() or c in ("-", "_"))[:20] or "general"
    path = output_dir / f"informe_{safe_id}_{safe_kw}.pdf"

    styles = getSampleStyleSheet()
    title = ParagraphStyle("TitleX", parent=styles["Title"], alignment=TA_CENTER, fontSize=16, leading=19)
    body = ParagraphStyle("BodyX", parent=styles["BodyText"], fontSize=8.7, leading=11)
    tiny = ParagraphStyle("TinyX", parent=styles["BodyText"], fontSize=7.7, leading=9.5)

    doc = SimpleDocTemplate(
        str(path), pagesize=A4,
        rightMargin=1.3*cm, leftMargin=1.3*cm, topMargin=1.3*cm, bottomMargin=1.3*cm
    )

    story = [
        Paragraph("INFORME DOCUMENTAL OSINT – FUENTES PÚBLICAS DEL PERÚ", title),
        Spacer(1, 8),
        Paragraph(f"<b>Persona / identificador:</b> {escape(identity)}", body),
        Paragraph(f"<b>Palabra clave:</b> {escape(keyword) if keyword else 'Sin filtro'}", body),
        Paragraph(f"<b>Fecha:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", body),
        Spacer(1, 8),
        Paragraph(
            "Este informe reúne coincidencias documentales públicas localizadas en fuentes oficiales. "
            "No certifica antecedentes, culpabilidad ni responsabilidad. Una denuncia no equivale a una condena. "
            "Los portales con CAPTCHA, autenticación, contenido no indexado o PDF escaneado pueden no aparecer.",
            tiny
        ),
        Spacer(1, 10),
    ]

    if not hits:
        story.append(Paragraph("No se recuperaron documentos públicos indexados para esta consulta.", body))
    else:
        data = [["#", "Fuente", "Documento / evidencia"]]
        for i, h in enumerate(hits, 1):
            kw = "Sí" if h.keyword_found else "No verificada"
            detail = (
                f"<b>{escape(h.title)}</b><br/>"
                f"<b>Palabra clave:</b> {kw}<br/>"
                f"{escape((h.snippet or '')[:650])}<br/>"
            )
            if h.extracted_excerpt:
                detail += f"<b>Extracto del PDF:</b> {escape(h.extracted_excerpt[:1200])}<br/>"
            detail += f"<link href='{escape(h.url)}'>{escape(h.url)}</link>"
            data.append([str(i), escape(h.domain), Paragraph(detail, tiny)])

        table = Table(data, colWidths=[0.6*cm, 3.2*cm, 14.2*cm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
            ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,0), 7.8),
            ("LEFTPADDING", (0,0), (-1,-1), 4),
            ("RIGHTPADDING", (0,0), (-1,-1), 4),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))
        story.append(table)

    story.extend([
        Spacer(1, 10),
        Paragraph(
            "<b>Interpretación:</b> “coincidencia encontrada” significa únicamente que el nombre, DNI/RUC "
            "o palabra clave aparece en una fuente pública localizada. Revise siempre la fuente primaria y el contexto.",
            tiny
        )
    ])
    doc.build(story)
    return path
