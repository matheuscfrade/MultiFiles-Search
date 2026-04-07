import os
import re
import csv
import sys
import time
import json
import datetime
import subprocess
import unicodedata
import webbrowser
import threading
import zipfile
import io
import base64
import multiprocessing

import base64
import multiprocessing

# --- PyInstaller & Uvicorn Fixes ---
# Redirecionar stdout/stderr apenas se forem None (para evitar crashes em alguns builds)
if sys.stdout is None or sys.stderr is None:
    class DummyStream:
        def write(self, x): pass
        def flush(self): pass
        def isatty(self): return False
    if sys.stdout is None: sys.stdout = sys.__stdout__ = DummyStream()
    if sys.stderr is None: sys.stderr = sys.__stderr__ = DummyStream()
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# --- PyInstaller Helper ---
def resource_path(relative_path):
    """Obtém o caminho absoluto para recursos, compatível com PyInstaller."""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# --- Auto-install dependencies ---
def _pip_install(*packages):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", *packages],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except: pass

def _ensure_deps():
    # Se estiver rodando como Executável, as dependências já estarão embutidas.
    if getattr(sys, 'frozen', False): return
    try:
        import fastapi
        import uvicorn
        import fitz
        from pypdf import PdfReader, PdfWriter
        from docx import Document
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image
        import openpyxl
    except ImportError:
        _pip_install("fastapi", "uvicorn", "pymupdf", "pypdf", "python-docx",
                     "pytesseract", "pdf2image", "Pillow", "openpyxl")

_ensure_deps()

from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# --- Search Utilities ---
EXTENSOES = {".pdf", ".docx", ".doc", ".txt"}
LIMIAR_TEXTO_PDF = 50

def normalizar(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ASCII", "ignore").decode("ASCII").lower()

def limpar_cabecalho(texto: str) -> str:
    linhas = texto.split("\n")
    termos_ignorar = [
        "MINISTERIO", "SECRETARIA", "INSTITUTO FEDERAL", "REPUBLICA FEDERATIVA",
        "GABINETE", "CAMPUS", "BOLETIM DE SERVICO", "DIRECAO", "DIRETORIA", "CONSELHO",
        "CONFECCAO:", "PAGINA:", "ISSN", "ORGAO:", "COORDENACAO"
    ]
    atos_documentos = ["PORTARIA", "EDITAL", "RESOLUCAO", "ATO", "DESPACHO", "EXTRATO", "TERMO"]
    linhas_filtradas = []
    found_ato = False
    for linha in linhas:
        linha_limpa = normalizar(linha).upper().strip()
        if not linha_limpa: continue
        if any(ato in linha_limpa for ato in atos_documentos): found_ato = True
        if not found_ato and any(termo in linha_limpa for termo in termos_ignorar): continue
        linhas_filtradas.append(linha.strip())
        if len(linhas_filtradas) > 4: break
    res = " ".join(linhas_filtradas)
    return res[:250] if res else ""

def extrair_texto_pdf(caminho: Path, ocr_ok: bool, lang: str) -> list:
    import fitz
    from pdf2image import convert_from_path
    import pytesseract
    resultados = []
    try:
        doc = fitz.open(str(caminho))
        for num_pagina, pagina in enumerate(doc):
            texto = pagina.get_text()
            metodo = "digital"
            if len(texto.strip()) < LIMIAR_TEXTO_PDF and ocr_ok: metodo = "ocr"
            cabecalho = limpar_cabecalho(texto)
            if not cabecalho.strip(): cabecalho = texto[:200].replace("\n", " ").strip()
            resultados.append({"pagina": num_pagina + 1, "texto": texto, "metodo": metodo, "cabecalho": cabecalho})
        doc.close()
    except: pass
    if ocr_ok and any(r["metodo"] == "ocr" and not r["texto"].strip() for r in resultados):
        try:
            imagens = convert_from_path(str(caminho), dpi=300)
            for i, img in enumerate(imagens):
                if i < len(resultados) and resultados[i]["metodo"] == "ocr":
                    resultados[i]["texto"] = pytesseract.image_to_string(img, lang=lang)
        except: pass
    return resultados

def extrair_texto_docx(caminho: Path) -> list:
    try:
        from docx import Document
        doc = Document(str(caminho))
        return [{"pagina": 1, "texto": "\n".join(p.text for p in doc.paragraphs), "metodo": "docx"}]
    except: return [{"pagina": 1, "texto": "[ERRO DOCX]", "metodo": "erro"}]

def extrair_texto_txt(caminho: Path) -> list:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try: return [{"pagina": 1, "texto": caminho.read_text(encoding=enc), "metodo": "txt"}]
        except: continue
    return [{"pagina": 1, "texto": "[ERRO TXT]", "metodo": "erro"}]

# --- Global State ---
search_state = {"is_running": False, "progress": 0, "total": 0, "processed": 0, "results": [], "error": None, "failed_files": []}

def run_search_task(directory: str, terms: list):
    global search_state
    search_state.update({"is_running": True, "progress": 0, "results": [], "processed": 0, "error": None, "failed_files": []})
    import pytesseract
    try:
        pytesseract.get_tesseract_version()
        ocr_ok, lang = True, ("por" if "por" in pytesseract.get_languages() else "eng")
    except: ocr_ok, lang = False, "eng"
    try:
        path_raiz = Path(directory)
        arquivos = [p for p in path_raiz.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSOES]
        search_state["total"] = len(arquivos)
        with ThreadPoolExecutor(max_workers=4) as executor:
            def process_one(arq):
                try:
                    if arq.suffix.lower() == ".pdf": paginas = extrair_texto_pdf(arq, ocr_ok, lang)
                    elif arq.suffix.lower() in (".docx", ".doc"): paginas = extrair_texto_docx(arq)
                    elif arq.suffix.lower() == ".txt": paginas = extrair_texto_txt(arq)
                    else: return []
                    
                    marcadores_erro = ("[ERRO DOCX]", "[ERRO TXT]")
                    if paginas and any(str(p.get("texto", "")).strip() in marcadores_erro for p in paginas):
                        search_state["failed_files"].append({"nome": arq.name, "caminho": str(arq), "erro": paginas[0]["texto"]})
                        return []

                    res_arq = []
                    for p in paginas:
                        texto_norm = normalizar(p["texto"])
                        for termo in terms:
                            if normalizar(termo) in texto_norm:
                                res_arq.append({
                                    "arquivo": arq.name, "caminho": str(arq), "pagina": p["pagina"],
                                    "termo": termo, "assunto": ""
                                })
                    return res_arq
                except Exception as e:
                    search_state["failed_files"].append({"nome": arq.name, "caminho": str(arq), "erro": str(e)})
                    return []
            futures = [executor.submit(process_one, a) for a in arquivos]
            for f in futures:
                search_state["results"].extend(f.result())
                search_state["processed"] += 1
                search_state["progress"] = int((search_state["processed"] / search_state["total"]) * 100)
    except Exception as e: search_state["error"] = str(e)
    finally: search_state["is_running"] = False

# --- App ---
app = FastAPI()
# Ajuste vital para o Executável
static_path = Path(resource_path("static"))
if static_path.exists(): app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

@app.get("/", response_class=HTMLResponse)
def read_root():
    idx = static_path / "index.html"
    return idx.read_text(encoding="utf-8") if idx.exists() else "Error: static files not found."

@app.post("/api/search")
async def start_search(request: Request, bg: BackgroundTasks):
    data = await request.json()
    directory, terms = data.get("directory", "").strip().strip('"').strip("'"), data.get("terms", [])
    if not directory or not Path(directory).exists(): return JSONResponse({"error": "Diretório inválido."}, status_code=400)
    if search_state["is_running"]: return JSONResponse({"error": "Em andamento."}, status_code=400)
    bg.add_task(run_search_task, directory, terms)
    return {"message": "Iniciado"}

@app.get("/api/status")
def get_status(): return {**search_state, "found": len(search_state["results"])}

@app.get("/api/results")
def get_results(): return search_state["results"]

@app.get("/api/view")
def view_file(path: str):
    p = Path(path)
    if not p.exists(): return JSONResponse({"error": "404"}, status_code=404)
    return FileResponse(p, media_type="application/pdf" if p.suffix.lower() == ".pdf" else None)

@app.post("/api/export_selected")
async def export_selected(request: Request):
    import io, base64
    from openpyxl import Workbook
    data = await request.json()
    results = data.get("results", [])
    wb = Workbook()
    ws = wb.active
    ws.append(["Documento", "Caminho", "Página", "Termo", "Assunto"])
    for r in results: ws.append([r.get("arquivo"), r.get("caminho"), r.get("pagina"), r.get("termo"), r.get("manual_notes")])
    output = io.BytesIO()
    wb.save(output)
    return {"filename": f"relatorio_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.xlsx", "content": base64.b64encode(output.getvalue()).decode('utf-8')}

@app.post("/api/pdf/zip_all")
async def zip_all(request: Request):
    from pypdf import PdfReader, PdfWriter
    import io, base64, zipfile
    data = await request.json()
    results = data.get("results", [])
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["Documento Extraído", "Arquivo Original", "Página Original", "Termo", "Assunto"])
        for r in results:
            nome_final = r.get("manual_notes") or f"{Path(r['arquivo']).stem}_Pag_{r['pagina']}"
            ws.append([nome_final, r["arquivo"], r["pagina"], r["termo"], r.get("manual_notes", "")])
            try:
                origem_path = Path(r["caminho"])
                if origem_path.exists() and origem_path.suffix.lower() == ".pdf":
                    reader, writer = PdfReader(str(origem_path)), PdfWriter()
                    range_raw = str(r.get("page_range") or r.get("pagina"))
                    paginas_index = []
                    for parte in range_raw.replace(" ", "").split(","):
                        if "-" in parte:
                            inicio, fim = parte.split("-")
                            paginas_index.extend(range(int(inicio)-1, int(fim)))
                        else:
                            if parte: paginas_index.append(int(parte)-1)
                    for p_idx in paginas_index:
                        if 0 <= p_idx < len(reader.pages): writer.add_page(reader.pages[p_idx])
                    if len(writer.pages) > 0:
                        pdf_out = io.BytesIO()
                        writer.write(pdf_out)
                        zip_file.writestr(f"Documentos/{nome_final}.pdf", pdf_out.getvalue())
            except: pass
        excel_out = io.BytesIO()
        wb.save(excel_out)
        zip_file.writestr("Relatorio_Geral.xlsx", excel_out.getvalue())
    return {"filename": f"pacote_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.zip", "content": base64.b64encode(zip_buffer.getvalue()).decode('utf-8')}

if __name__ == "__main__":
    multiprocessing.freeze_support()
    import uvicorn
    import webview
    import threading
    import time

    # Permite downloads na janela do WebView (essencial para ZIP e Excel)
    webview.settings['ALLOW_DOWNLOADS'] = True

    def run_server():
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

    # Inicia o servidor FastAPI em uma thread separada
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Aguarda um momento para o servidor subir
    time.sleep(2)

    # Cria e inicia a janela nativa do Desktop
    window = webview.create_window(
        "MultiFiles Search | Desktop App",
        "http://127.0.0.1:8000",
        width=1280,
        height=850,
        min_size=(800, 600),
        background_color="#0f172a"
    )
    
    webview.start()
