from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse
import hashlib
import re
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from pypdf import PdfReader

OFFICIAL_DOMAINS = [
    "gob.pe",
    "oece.gob.pe",
    "seace.gob.pe",
    "bi.seace.gob.pe",
    "datosabiertos.gob.pe",
    "servir.gob.pe",
    "contraloria.gob.pe",
    "appdji.contraloria.gob.pe",
    "pj.gob.pe",
    "mpfn.gob.pe",
    "sunat.gob.pe",
    "mef.gob.pe",
]

@dataclass
class DocumentHit:
    title: str
    url: str
    snippet: str
    domain: str
    is_pdf: bool = False
    keyword_found: bool = False
    local_path: Optional[str] = None
    extracted_excerpt: str = ""
    confidence: str = "Coincidencia documental; requiere verificación"

def clean(v: str) -> str:
    return " ".join((v or "").strip().split())

def validate_identity(value: str) -> str:
    value = clean(value)
    if len(value) < 5 or len(value) > 120:
        raise ValueError("Ingresa DNI, RUC o nombres completos válidos.")
    return value

def validate_keyword(value: str) -> str:
    value = clean(value)
    if not value:
        return ""
    if len(value) > 60:
        raise ValueError("La palabra clave es demasiado larga.")
    return value

def _official(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower().split(":")[0]
    except Exception:
        return False
    return any(host == d or host.endswith("." + d) for d in OFFICIAL_DOMAINS)

def search_documents(identity: str, keyword: str = "", max_results: int = 20) -> List[DocumentHit]:
    """
    Busca documentos indexados en dominios oficiales. No evade CAPTCHA ni autenticación.
    La búsqueda se hace por identidad exacta y, si hay keyword, también por esa palabra.
    """
    identity = clean(identity)
    keyword = clean(keyword)
    site_clause = " OR ".join(f"site:{d}" for d in OFFICIAL_DOMAINS)

    queries = [
        f'"{identity}" ({site_clause})',
        f'"{identity}" filetype:pdf ({site_clause})',
    ]
    if keyword:
        queries = [
            f'"{identity}" "{keyword}" ({site_clause})',
            f'"{identity}" "{keyword}" filetype:pdf ({site_clause})',
        ]

    hits: List[DocumentHit] = []
    seen = set()
    with DDGS() as ddgs:
        for q in queries:
            try:
                results = ddgs.text(q, max_results=max_results)
            except Exception:
                results = []
            for r in results or []:
                url = (r.get("href") or r.get("url") or "").strip()
                if not url or url in seen or not _official(url):
                    continue
                seen.add(url)
                title = (r.get("title") or "Documento oficial")[:300]
                snippet = (r.get("body") or r.get("snippet") or "")[:1200]
                low = (title + " " + snippet).lower()
                kf = bool(keyword and keyword.lower() in low)
                is_pdf = ".pdf" in url.lower()
                hits.append(DocumentHit(
                    title=title,
                    url=url,
                    snippet=snippet,
                    domain=urlparse(url).netloc.lower(),
                    is_pdf=is_pdf,
                    keyword_found=kf,
                ))

    # Prioriza keyword exacta y PDFs.
    hits.sort(key=lambda h: (h.keyword_found, h.is_pdf), reverse=True)
    return hits[:max_results]

def _safe_filename(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:20] + ".pdf"

def download_pdf(url: str, dest_dir: Path, max_mb: int = 12) -> Optional[Path]:
    if not _official(url):
        return None
    try:
        with requests.get(
            url,
            timeout=20,
            stream=True,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 OSINT-Public-Research-Bot/2.0"}
        ) as r:
            r.raise_for_status()
            ctype = (r.headers.get("content-type") or "").lower()
            final_url = r.url
            if not _official(final_url):
                return None
            if "pdf" not in ctype and ".pdf" not in final_url.lower():
                return None

            total = 0
            limit = max_mb * 1024 * 1024
            dest_dir.mkdir(parents=True, exist_ok=True)
            out = dest_dir / _safe_filename(final_url)
            with open(out, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > limit:
                        f.close()
                        out.unlink(missing_ok=True)
                        return None
                    f.write(chunk)
            return out
    except Exception:
        return None

def extract_pdf_excerpt(pdf_path: Path, identity: str, keyword: str = "", max_pages: int = 80) -> str:
    """
    Extrae solo un fragmento breve alrededor de la coincidencia.
    No usa OCR. PDFs escaneados sin texto pueden quedar sin coincidencia.
    """
    try:
        reader = PdfReader(str(pdf_path))
    except Exception:
        return ""

    identity_l = identity.lower()
    keyword_l = (keyword or "").lower()
    excerpts = []

    for i, page in enumerate(reader.pages[:max_pages]):
        try:
            text = page.extract_text() or ""
        except Exception:
            continue
        low = text.lower()
        has_identity = identity_l in low
        has_kw = True if not keyword_l else keyword_l in low
        if has_identity and has_kw:
            pos = low.find(keyword_l) if keyword_l else low.find(identity_l)
            if pos < 0:
                pos = 0
            start = max(0, pos - 260)
            end = min(len(text), pos + 700)
            cleaned = re.sub(r"\s+", " ", text[start:end]).strip()
            excerpts.append(f"Página {i+1}: {cleaned}")
            if len(excerpts) >= 3:
                break

    return "\n".join(excerpts)[:3000]

def enrich_with_pdfs(hits: List[DocumentHit], identity: str, keyword: str,
                     work_dir: Path, max_pdfs: int = 12, max_pdf_mb: int = 12) -> List[DocumentHit]:
    count = 0
    for h in hits:
        if count >= max_pdfs:
            break
        if not h.is_pdf:
            continue
        path = download_pdf(h.url, work_dir, max_pdf_mb)
        if not path:
            continue
        excerpt = extract_pdf_excerpt(path, identity, keyword)
        h.local_path = str(path)
        h.extracted_excerpt = excerpt
        if keyword and keyword.lower() in excerpt.lower():
            h.keyword_found = True
        count += 1

    hits.sort(key=lambda h: (h.keyword_found, bool(h.extracted_excerpt), h.is_pdf), reverse=True)
    return hits
