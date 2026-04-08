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

from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# --- Auto-install dependencies ---
def _pip_install(*packages):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", *packages],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except: pass

def _ensure_deps():
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

# --- Global State ---
search_state = {"is_running": False, "progress": 0, "total": 0, "processed": 0, "results": [], "error": None, "failed_files": []}

# --- Search Tasks ---
def run_search_task(directory: str, terms: list):
    global search_state
    search_state.update({"is_running": True, "progress": 0, "results": [], "processed": 0, "error": None, "failed_files": []})
    
    from core.engine import build_file_list, process_file
    import pytesseract
    try:
        pytesseract.get_tesseract_version()
        ocr_ok, lang = True, ("por" if "por" in pytesseract.get_languages() else "eng")
    except: ocr_ok, lang = False, "eng"
    
    try:
        arquivos = build_file_list(directory)
        search_state["total"] = len(arquivos)
        if search_state["total"] == 0:
            search_state["progress"] = 100
            return

        with ThreadPoolExecutor(max_workers=4) as executor:
            def process_one(arq):
                try:
                    return process_file(arq, terms, ocr_ok, lang)
                except Exception as e:
                    search_state["failed_files"].append({"nome": arq.name, "caminho": str(arq), "erro": str(e)})
                    return []

            futures = [executor.submit(process_one, a) for a in arquivos]
            for f in futures:
                search_state["results"].extend(f.result())
                search_state["processed"] += 1
                search_state["progress"] = int((search_state["processed"] / search_state["total"]) * 100)
    except Exception as e:
        search_state["error"] = str(e)
    finally:
        search_state["is_running"] = False

# --- App ---
app = FastAPI()
static_path = Path("static")

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

@app.post("/api/pdf/slice")
async def extract_pdf_slice(request: Request):
    from pypdf import PdfReader, PdfWriter
    import io
    from fastapi.responses import Response
    
    data = await request.json()
    caminho = data.get("caminho")
    range_raw = data.get("range", "")
    nome_final = data.get("nome_final", "Recorte.pdf")
    
    p = Path(caminho)
    if not p.exists() or p.suffix.lower() != ".pdf":
        return JSONResponse({"error": "Arquivo não encontrado ou não é PDF"}, status_code=400)
    
    try:
        reader = PdfReader(str(p))
        writer = PdfWriter()
        paginas_index = []
        for parte in range_raw.replace(" ", "").split(","):
            if "-" in parte:
                inicio, fim = parte.split("-")
                paginas_index.extend(range(int(inicio)-1, int(fim)))
            else:
                if parte: paginas_index.append(int(parte)-1)
        
        for p_idx in paginas_index:
            if 0 <= p_idx < len(reader.pages):
                writer.add_page(reader.pages[p_idx])
                
        if len(writer.pages) == 0:
            return JSONResponse({"error": "Nenhuma página válida selecionada."}, status_code=400)
            
        pdf_out = io.BytesIO()
        writer.write(pdf_out)
        
        # O navegador lida melhor via base64 para downloads controlados pelo fetch no frontend
        return {
            "filename": nome_final if nome_final.endswith(".pdf") else f"{nome_final}.pdf",
            "content": base64.b64encode(pdf_out.getvalue()).decode('utf-8')
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

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

if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    import threading
    import time
    import webbrowser

    def run_server():
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    print("Iniciando servidor local na porta 8000...")
    time.sleep(1.5)
    
    print("Abrindo o navegador...")
    webbrowser.open("http://127.0.0.1:8000")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Servidor finalizado pelo usuário.")
