# 🔍 Multi-File Search & Document Extractor (V6)

> Ferramenta para busca em massa e extração inteligente de atos administrativos em PDFs, Word e Texto.

Esta ferramenta foi desenvolvida para simplificar o trabalho de quem precisa vasculhar centenas de arquivos, identificar termos específicos (como nomes de pessoas, números de processos, etc) e gerar recortes organizados e renomeados para relatórios.

---

## 🌟 Principais Funcionalidades

- **Busca Inteligente**: Pesquisa insensível a maiúsculas e acentos (busca por "João" encontra "JOAO").
- **Visualizador Integrado**: Veja o documento original exatamente na página onde o termo foi encontrado sem sair da ferramenta.
- **Recorte Cirúrgico de PDF**: Escolha o intervalo de páginas (ex: 5-8) e extraia apenas a parte que interessa.
- **Renomeação Automática**: O documento recortado é salvo com o nome que você der na coluna "Assunto".
- **Gestão de Sessão**: Salve o seu progresso em um arquivo `.json` e retome o trabalho em outro dia.
- **Exportação Master (ZIP)**: Gere um pacote completo contendo o Relatório Excel + Todos os PDFs recortados e renomeados.
- **OCR Integrado**: Reconhecimento de texto em arquivos digitalizados (escaneados).

---

## 🛠️ Pré-requisitos

Para rodar a ferramenta no seu computador, você precisará de:

1. **Python 3.10 ou superior**: [Download aqui](https://www.python.org/downloads/)
2. **Tesseract OCR (Opcional)**:
   > [!NOTE]
   > O Tesseract **não é obrigatório**. A ferramenta funciona perfeitamente para PDFs digitais (selecionáveis), arquivos Word e TXT sem ele. O Tesseract só é necessário para ler **PDFs escaneados** (fotos). 
   
   Se desejar suporte a PDFs escaneados, siga estes passos exatos:

   ### 📥 Passo 1: Download
   - Baixe o instalador aqui: [**Tesseract Windows 64-bit Installer**](https://github.com/UB-Mannheim/tesseract/wiki).

   ### 🔨 Passo 2: Instalação (Atenção aos Detalhes)
   1. **Tela Inicial (Idioma)**: Selecione **English** (como você viu, não há Português nesta tela inicial, mas isso é apenas o idioma do instalador).
   2. **Componentes**: Avance até a tela **"Choose Components"**.
   3. **Idiomas Extras**: Procure por **"Additional language data (download)"** e clique no sinal de **[+]**.
   4. **Marque "Portuguese"**: Role a lista e marque a caixa **Portuguese**. Isso é essencial para o robô ler acentos e cedilha.
   5. **Conclua**: O caminho padrão será `C:\Program Files\Tesseract-OCR`.

   ### 🛠️ Passo 3: Configuração das Variáveis de Ambiente (PATH)
   1. No menu iniciar, digite **"Variáveis de ambiente"** e clique em "Editar as variáveis de ambiente do sistema".
   2. Clique no botão **"Variáveis de Ambiente..."**.
   3. Em **"Variáveis do Sistema"**, procure a linha **Path**, selecione-a e clique em **Editar**.
   4. Clique em **Novo** e cole o caminho: `C:\Program Files\Tesseract-OCR`.
   5. Clique em OK em todas as janelas.

   ### 💡 Plano B (Se você já instalou e não marcou Português)
   Se a ferramenta der erro de "idioma por não encontrado", não precisa reinstalar:
   1. Baixe este arquivo: [**por.traineddata**](https://github.com/tesseract-ocr/tessdata/raw/main/por.traineddata).
   2. Cole ele dentro da pasta: `C:\Program Files\Tesseract-OCR\tessdata`.

   ### ✅ Como testar?
   Abra o terminal (CMD) e digite: `tesseract --list-langs`. Se aparecer **por** na lista, está perfeito!

---

## 🎁 Instalador Desktop (.exe) - Windows

Para uma experiência profissional e sem necessidade de instalar o Python:

1. **Download**: Vá até a seção [**Releases**](https://github.com/matheuscfrade/MultiFiles-Search/releases) deste repositório.
2. **Baixe o Instalador**: Procure pelo arquivo `Setup_MultiFilesSearch.exe`.
3. **Instalação**: 
   - Execute o instalador e siga os passos.
   - **OCR (Importante)**: Durante o setup, você será questionado se deseja instalar o **Tesseract OCR**. Se você precisa ler PDFs digitalizados (fotos), aceite e, no instalador do Tesseract, lembre-se de marcar a opção **Portuguese** na lista de idiomas.
4. **Execução**:
   - Use o atalho criado na sua **Área de Trabalho**.
   - O app abrirá em uma janela própria de computador, sem janelas de terminal ou abas de navegador.

> [!TIP]
> O instalador agora cuida de configurar tudo para você, incluindo as variáveis de ambiente necessárias para o OCR funcionar.

---

## 🚀 Como Rodar via Código (Desenvolvedor)

1. **Baixe o Código**:
   Clone o repositório: `git clone https://github.com/matheuscfrade/MultiFiles-Search.git`

2. **Abra o Terminal**:
   Navegue até a pasta da ferramenta.

3. **Inicie a Aplicação**:
   Abra o terminal na pasta do projeto e use o comando correspondente ao seu sistema:
   ```bash
   # Opção 1: Padrão (Geral)
   python app.py

   # Opção 2: Recomendado para Windows
   py app.py

   # Opção 3: Recomendado para Linux ou Mac
   python3 app.py
   ```
   > **Nota:** Na primeira vez que rodar, o sistema verificará e instalará todas as bibliotecas necessárias automaticamente. Aguarde alguns segundos.

4. **Acesso Automático**:
   O navegador abrirá sozinho em `http://127.0.0.1:8000`. Se não abrir, basta copiar e colar este link no Chrome ou Edge.

---

## 📂 Fluxo de Trabalho Recomendado

1. **Buscar**: Informe a pasta raiz e os termos de busca.
2. **Analisar**: Clique no nome do arquivo para abrir a pré-visualização.
3. **Identificar**: Preencha o "Assunto" (será o nome do arquivo final).
4. **Recortar**: Se necessário, ajuste o intervalo de páginas no modal.
5. **Salvar Sessão**: Se o volume for alto, salve o progresso para continuar depois.
6. **Exportar**: Clique em "Baixar Tudo (ZIP)" para receber seu pacote de documentos prontos.

---

## 🤝 Contribuição e Melhorias

Este é um projeto aberto! Se você tiver sugestões de melhorias, correções de bugs ou novas funcionalidades:

1. **Apresente Propostas**: Abra uma [**Issue**](https://github.com/matheuscfrade/MultiFiles-Search/issues) descrevendo sua ideia.
2. **Contribua com Código**: Faça um **Fork** do projeto e envie um **Pull Request**.

---

## 📄 Licença
Distribuído sob a licença MIT. Sinta-se livre para usar e modificar.

---
**Desenvolvido por [Matheus Costa Frade](https://github.com/matheuscfrade)**
