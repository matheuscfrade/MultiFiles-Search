import os
import unicodedata
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

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

def build_file_list(directory: str):
    path_raiz = Path(directory)
    return [p for p in path_raiz.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSOES]

def process_file(arq: Path, terms: list, ocr_ok: bool, lang: str):
    try:
        if arq.suffix.lower() == ".pdf": paginas = extrair_texto_pdf(arq, ocr_ok, lang)
        elif arq.suffix.lower() in (".docx", ".doc"): paginas = extrair_texto_docx(arq)
        elif arq.suffix.lower() == ".txt": paginas = extrair_texto_txt(arq)
        else: return []
        
        marcadores_erro = ("[ERRO DOCX]", "[ERRO TXT]")
        if paginas and any(str(p.get("texto", "")).strip() in marcadores_erro for p in paginas):
            raise Exception(paginas[0]["texto"])

        res_arq = []
        for p in paginas:
            texto_norm = normalizar(p["texto"])
            for termo in terms:
                if normalizar(termo) in texto_norm:
                    res_arq.append({
                        "arquivo": arq.name, 
                        "caminho": str(arq), 
                        "pagina": p["pagina"],
                        "termo": termo, 
                        "assunto": ""
                    })
        return res_arq
    except Exception as e:
        raise e
