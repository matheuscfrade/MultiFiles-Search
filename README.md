# 🔍 Multi-Files Search & Document Extractor (v1.0.0)

> O canivete suíço definitivo para busca de termos, fatiamento de PDFs e extração de relatórios. Transforme horas de busca manual em segundos de processamento inteligente.

---

## 🚀 Como Acessar

A ferramenta foi projetada para ser universal, funcionando tanto na nuvem quanto no seu ambiente local:

### 🌍 Versão Web (Recomendado)
Acesse agora sem instalar nada: [**multi-files-search.web.app**](https://multi-files-search.web.app)
- **Privacidade Total**: Seus arquivos **não** saem do seu computador. O processamento é feito 100% no seu navegador (Client-Side).
- **Sem Instalação**: Basta abrir o link no Chrome ou Edge e começar.

### 💻 Versão Local (Desenvolvedores)
Para rodar diretamente via terminal Python:
1. Clone o repositório.
2. Certifique-se de ter o Python 3.10+ instalado.
3. Execute: `py app.py`.
4. O sistema abrirá automaticamente no seu navegador em `http://127.0.0.1:8000`.

---

## 📘 Manual do Usuário

Este guia cobre todas as funcionalidades do painel principal para que você extraia o máximo da ferramenta.

### 1. Preparando a Busca
- **Escolher Pasta (Web)**: Clique no botão central "Escolher Pasta" e selecione o diretório onde estão seus arquivos. Confirme a permissão de leitura do navegador.
- **Diretório Raiz (Local)**: Cole o caminho da pasta diretamente no campo de texto (ex: `C:\Documentos\2024`).
- **Termos de Busca**: Digite as palavras ou frases que deseja encontrar, separadas por vírgula (ex: `Contrato, Portaria, Nomeação`).
- **Habilitar OCR**: Marque esta opção caso seus PDFs sejam imagens (scans). 
  - *Dica*: No Modo Web, o OCR usa Tesseract.js e processa página por página. No Modo Local, requer o Tesseract instalado no Windows.

### 2. Gerenciando Resultados
Ao clicar em **"Iniciar Varredura"**, o sistema listará cada ocorrência encontrada na tabela inferior.

#### Componentes da Tabela:
- **Checkbox (Quadrado)**: Selecione ou desmarque itens para a exportação final em massa.
- **Arquivo / Página**: Clique no nome do arquivo para abrir o visualizador lateral.
- **Termo**: Identifica qual palavra foi encontrada naquela página específica.
- **Assunto (Campo Editável)**: Clique no texto "Clique para editar" para renomear aquele recorte. Esse nome será usado para nomear o arquivo PDF extraído no futuro.
- **Botão de Download Rápido (📥)**: Clica e baixa instantaneamente apenas as páginas desse resultado já fatiadas, sem precisar gerar o pacote ZIP completo.

### 3. Fatiamento Cirúrgico (Preview)
Ao clicar em um resultado, o **Modal de Preparação** se abre:
- **Visualizador de PDF**: Veja a página exata onde o termo foi achado no lado esquerdo.
- **Páginas para Extrair (Intervalo)**: O campo vem preenchido com a página do termo, mas você pode mudar para intervalos como `1, 3-5, 10`. O sistema respeitará essa ordem ao criar o novo PDF.
- **Salvar e Manter**: Salva suas alterações de assunto e intervalo no banco de dados temporário da sessão.

### 4. Exportação das Extrações
Quando terminar suas marcações, use os botões de ação final:
- **Exportar XLSX**: Gera uma planilha Excel perfeita com todos os metadados, caminhos e assuntos editados.
- **Baixar Tudo (ZIP)**: O "Grand Finale". Gera um arquivo comprimido contendo:
  1. Uma pasta `Documentos` com todos os PDFs fatiados e renomeados conforme seus "Assuntos".
  2. O Relatório Geral em Excel sincronizado com os arquivos.

---

## 🛠️ Tecnologias Utilizadas
- **Backend**: FastAPI (Uvicorn / Python).
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript ES6.
- **Engines de Bio**: 
  - `SheetJS` (Manipulação de Planilhas).
  - `PDF-Lib` (Fatiamento de documentos no Browser).
  - `JSZip` (Empacotamento ZIP Client-Side).
  - `Tesseract.js` (OCR no Navegador).

---

## 📄 Licença
Distribuído sob a licença MIT. 

**Desenvolvido por [Matheus Costa Frade](https://github.com/matheuscfrade)**
