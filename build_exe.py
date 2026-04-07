import os
import subprocess
import sys

def build():
    print("Iniciando a criacao do executavel...")
    
    # Comandos para construir o executavel
    # --onefile: Empacota tudo em um único arquivo .exe
    # --windowed: Não abre uma janela de terminal paralela (opcional)
    # --add-data: Inclui a pasta 'static' dentro do executável
    # --name: Nome do arquivo final
    
    # Usando 'py' como launcher padrão no sistema Windows
    command = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--windowed", # Esconde a janela de console
        "--add-data", f"static{os.pathsep}static",
        "--collect-all", "fastapi",
        "--collect-all", "uvicorn",
        "--collect-all", "starlette",
        "--collect-all", "pydantic",
        "--collect-all", "webview",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "fastapi",
        "--hidden-import", "starlette",
        "--hidden-import", "pydantic",
        "--hidden-import", "webview",
        "--hidden-import", "clr",
        "--name", "MultiFileSearch",
        "app.py"
    ]
    
    try:
        # Primeiro, garantimos que todas as dependencias estao instaladas
        print("Verificando dependencias (fastapi, uvicorn, pywebview, etc)...")
        deps = ["fastapi", "uvicorn", "pymupdf", "pypdf", "python-docx", "pytesseract", "pdf2image", "Pillow", "openpyxl", "pyinstaller", "pywebview", "pythonnet"]
        subprocess.check_call([sys.executable, "-m", "pip", "install", *deps])
        
        # Executa o build
        print("Executando o PyInstaller (isso pode levar um minuto)...")
        subprocess.check_call(command)
        
        print("\nPronto! Executavel criado com sucesso.")
        print("Localizacao: multi_files_search/dist/MultiFileSearch.exe")
        print("\nProximo passo: Faca o upload desse arquivo para as 'Releases' do seu GitHub.")
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Erro durante a criação: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n⚠️ Ocorreu um erro inesperado: {e}")
        sys.exit(1)

if __name__ == "__main__":
    build()
