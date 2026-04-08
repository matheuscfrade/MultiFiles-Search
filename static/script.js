document.addEventListener('DOMContentLoaded', () => {
    const btnSearch = document.getElementById('btn-search');
    const directoryInput = document.getElementById('directory');
    const termsInput = document.getElementById('terms');

    const progressArea = document.getElementById('progress-area');
    const progressBar = document.getElementById('progress-bar');
    const percentText = document.getElementById('percent');
    const statusMsg = document.getElementById('status-msg');
    const statFiles = document.getElementById('stat-files');
    const statFound = document.getElementById('stat-found');

    const resultsArea = document.getElementById('results-area');
    const resultsBody = document.getElementById('results-body');
    const btnExport = document.getElementById('btn-export');
    const btnExportZip = document.getElementById('btn-export-zip');

    // Session Elements
    const btnSaveSession = document.getElementById('btn-save-session');
    const btnLoadSession = document.getElementById('btn-load-session');
    const inputLoadSession = document.getElementById('input-load-session');

    // Modal Elements
    const modalExtract = document.getElementById('modal-extract');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSaveRange = document.getElementById('btn-save-range');
    const btnDiscard = document.getElementById('btn-discard');
    const pdfPreview = document.getElementById('pdf-preview');
    const modalDocInfo = document.getElementById('modal-doc-info');
    const modalAssunto = document.getElementById('modal-assunto');
    const pageRangeInput = document.getElementById('page-range');

    // Error Elements
    const errorInfo = document.getElementById('error-info');
    const errorCount = document.getElementById('error-count');
    const btnShowErrors = document.getElementById('btn-show-errors');
    const modalErrors = document.getElementById('modal-errors');
    const btnCloseErrors = document.getElementById('btn-close-errors');
    const errorList = document.getElementById('error-list');
    const checkAll = document.getElementById('check-all');

    // Web Mode specific
    const badgeMode = document.getElementById('badge-mode');
    const localDirGroup = document.getElementById('local-dir-group');
    const webDirGroup = document.getElementById('web-dir-group');
    const btnPickFolder = document.getElementById('btn-pick-folder');
    const webDirectoryInput = document.getElementById('web-directory');
    const folderNameDisplay = document.getElementById('folder-name');
    const ocrWebGroup = document.getElementById('ocr-web-group');
    const ocrWebToggle = document.getElementById('ocr-web-toggle');

    let pollInterval = null;
    let currentResults = [];
    let activeResultIndex = null;
    let isWebMode = false;
    let webFiles = [];

    // Detect Mode
    function detectMode() {
        const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
        if (!isLocal) {
            enableWebMode();
        }
    }

    function enableWebMode() {
        isWebMode = true;
        badgeMode.classList.remove('hidden');
        localDirGroup.classList.add('hidden');
        webDirGroup.classList.remove('hidden');
        ocrWebGroup.classList.remove('hidden');
    }

    detectMode();

    btnPickFolder.onclick = () => webDirectoryInput.click();
    webDirectoryInput.onchange = (e) => {
        webFiles = Array.from(e.target.files);
        folderNameDisplay.innerText = webFiles.length > 0 ? `${webFiles.length} arquivos selecionados` : '';
        if (currentResults.length > 0) {
            relinkWebFiles();
            renderResults(currentResults);
        }
    };

    function relinkWebFiles() {
        if (!isWebMode || webFiles.length === 0) return;
        
        let relinkedCount = 0;
        currentResults.forEach(res => {
            // Se já tem um fileObject válido (instância de File), pula
            if (res.fileObject instanceof File) return;

            // Tenta encontrar o arquivo pelo caminho ou nome
            const match = webFiles.find(f => 
                (f.webkitRelativePath === res.caminho) || 
                (f.name === res.arquivo && f.size === res.fileSize) || // fallback se o caminho mudar
                (f.name === res.arquivo)
            );

            if (match) {
                res.fileObject = match;
                relinkedCount++;
            }
        });
        console.log(`Relinked ${relinkedCount} files.`);
    }

    async function checkActiveSearch() {
        if (isWebMode) return;
        try {
            const response = await fetch('/api/status');
            const state = await response.json();
            if (state.is_running) {
                progressArea.classList.remove('hidden');
                btnSearch.disabled = true;
                btnSearch.querySelector('.loader-inline').classList.remove('hidden');
                startPolling();
            }
        } catch (err) { console.error(err); }
    }
    checkActiveSearch();

    btnSearch.addEventListener('click', async () => {
        const terms = termsInput.value.split(',').map(t => t.trim()).filter(t => t);
        if (terms.length === 0) return alert('Informe os termos de busca.');

        if (isWebMode) {
            if (webFiles.length === 0) return alert('Selecione uma pasta.');
            runWebSearch(terms);
        } else {
            let directory = directoryInput.value.trim().replace(/^["']|["']$/g, '');
            if (!directory) return alert('Informe o diretório.');
            
            btnSearch.disabled = true;
            btnSearch.querySelector('.loader-inline').classList.remove('hidden');
            progressArea.classList.remove('hidden');
            resultsArea.classList.add('hidden');
            progressBar.style.width = '0%';
            percentText.innerText = '0%';
            statusMsg.innerText = 'Iniciando...';
            checkAll.checked = false;

            try {
                const resp = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ directory, terms })
                });
                
                if (!resp.ok) {
                    const errData = await resp.json();
                    throw new Error(errData.error || 'Erro desconhecido no servidor.');
                }

                startPolling();
            } catch (err) { alert('Erro ao iniciar busca: ' + err.message); resetSearchButton(); }
        }
    });

    // --- BROWSER-SIDE SEARCH ENGINE ---
    async function runWebSearch(terms) {
        btnSearch.disabled = true;
        btnSearch.querySelector('.loader-inline').classList.remove('hidden');
        progressArea.classList.remove('hidden');
        resultsArea.classList.add('hidden');
        progressBar.style.width = '0%';
        percentText.innerText = '0%';
        statusMsg.innerText = 'Preparando arquivos...';
        checkAll.checked = false;

        const useOCR = ocrWebToggle.checked;
        const extensions = ['.pdf', '.docx', '.txt'];
        const filesToProcess = webFiles.filter(f => extensions.some(ext => f.name.toLowerCase().endsWith(ext)));
        
        const total = filesToProcess.length;
        let processed = 0;
        let found = 0;
        let failed = [];
        let results = [];

        statFiles.innerText = `0 / ${total}`;
        statFound.innerText = '0';

        async function normalizar(text) {
            return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        }

        for (const file of filesToProcess) {
            statusMsg.innerText = `Processando: ${file.name}`;
            try {
                const textPages = await extractText(file, useOCR);
                const normTerms = await Promise.all(terms.map(t => normalizar(t)));
                
                textPages.forEach(p => {
                    const normContent = p.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                    terms.forEach((termo, idx) => {
                        if (normContent.includes(normTerms[idx])) {
                            results.push({
                                arquivo: file.name,
                                caminho: file.webkitRelativePath || file.name,
                                pagina: p.pagina,
                                termo: termo,
                                assunto: "",
                                fileObject: file, 
                                fileSize: file.size // Guardamos o tamanho para ajudar no relink depois
                            });
                        }
                    });
                });
            } catch (err) {
                failed.push({ nome: file.name, erro: err.message, caminho: file.webkitRelativePath });
            }

            processed++;
            found = results.length;
            const prog = Math.round((processed / total) * 100);
            progressBar.style.width = `${prog}%`;
            percentText.innerText = `${prog}%`;
            statFiles.innerText = `${processed} / ${total}`;
            statFound.innerText = found;

            if (failed.length > 0) {
                errorInfo.classList.remove('hidden');
                errorCount.innerText = failed.length;
                renderErrorList(failed);
            }
        }

        statusMsg.innerText = 'Busca concluída!';
        currentResults = results.map(r => ({ ...r, selected: true, manual_notes: "", page_range: "" }));
        renderUIWithResults();
        resetSearchButton();
    }

    async function extractText(file, useOCR) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') return extractPDF(file, useOCR);
        if (ext === 'docx') return extractDOCX(file);
        if (ext === 'txt') return extractTXT(file);
        return [];
    }

    async function extractTXT(file) {
        const text = await file.text();
        return [{ pagina: 1, text: text }];
    }

    async function extractDOCX(file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return [{ pagina: 1, text: result.value }];
    }

    async function extractPDF(file, useOCR) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            let text = content.items.map(item => item.str).join(' ');

            if (text.trim().length < 50 && useOCR) {
                // Tentar OCR na página
                text = await runOCR(page);
            }

            pages.push({ pagina: i, text: text });
        }
        return pages;
    }

    async function runOCR(page) {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const imageData = canvas.toDataURL('image/png');
        
        const { data: { text } } = await Tesseract.recognize(imageData, 'por', {
            logger: m => console.log(m)
        });
        return text;
    }

    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/status');
                if (!response.ok) throw new Error('Falha na comunicação com o servidor.');
                
                const state = await response.json();
                
                // Validação básica do objeto de estado
                if (state.progress === undefined) return;

                progressBar.style.width = `${state.progress}%`;
                percentText.innerText = `${state.progress}%`;
                statFiles.innerText = `${state.processed} / ${state.total}`;
                statFound.innerText = state.found;
                statusMsg.innerText = state.is_running ? 'Processando arquivos...' : 'Concluído!';

                if (state.failed_files && state.failed_files.length > 0) {
                    errorInfo.classList.remove('hidden');
                    errorCount.innerText = state.failed_files.length;
                    renderErrorList(state.failed_files);
                } else {
                    errorInfo.classList.add('hidden');
                }

                if (!state.is_running && state.progress >= 100) {
                    clearInterval(pollInterval);
                    fetchResults();
                    resetSearchButton();
                }
            } catch (err) {
                console.error("Erro no polling:", err);
            }
        }, 1000);
    }

    function renderErrorList(failedFiles) {
        errorList.innerHTML = '';
        failedFiles.forEach(err => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${err.nome}</strong><span>${err.erro}</span><div class="path-sub">${err.caminho}</div>`;
            errorList.appendChild(li);
        });
    }

    btnShowErrors.onclick = (e) => { e.preventDefault(); modalErrors.classList.remove('hidden'); };
    btnCloseErrors.onclick = () => modalErrors.classList.add('hidden');

    async function fetchResults() {
        const response = await fetch('/api/results');
        const data = await response.json();
        currentResults = data.map(r => ({ ...r, selected: true, manual_notes: "", page_range: "" }));
        renderUIWithResults();
    }

    function renderUIWithResults() {
        renderResults(currentResults);
        checkAll.checked = currentResults.every(r => r.selected);
        resultsArea.classList.remove('hidden');
        resultsArea.scrollIntoView({ behavior: 'smooth' });
    }

    function renderResults(results) {
        resultsBody.innerHTML = '';
        results.forEach((res, index) => {
            const row = document.createElement('tr');
            if (!res.selected) row.style.opacity = "0.4";

            row.innerHTML = `
                <td class="check-cell"><input type="checkbox" class="row-check" data-index="${index}" ${res.selected ? 'checked' : ''}></td>
                <td>
                    <a href="#" class="extract-trigger file-link">${res.arquivo}</a>
                    <div class="path-sub">Página ${res.pagina} <span class="range-info" style="color: var(--primary); font-weight: bold;">${res.page_range ? '[Págs: ' + res.page_range + ']' : ''}</span></div>
                </td>
                <td><span class="term-badge">${res.termo}</span></td>
                <td><div class="editable-cell" style="cursor: pointer" data-index="${index}">${res.manual_notes || '<span style="color:rgba(255,255,255,0.3)">[Clique para editar]</span>'}</div></td>
                <td style="text-align: center; vertical-align: middle;">
                    <button class="btn-download-row" title="Baixar Apenas Este Recorte" style="background: none; border: none; cursor: pointer; font-size: 1.5rem; transition: transform 0.2s;">📥</button>
                </td>
            `;

            row.querySelector('.extract-trigger').onclick = (e) => { e.preventDefault(); openModal(index); };
            row.querySelector('.editable-cell').onclick = () => openModal(index);
            row.querySelector('.btn-download-row').onclick = (e) => downloadSingleSlice(index, e.target);
            row.querySelector('.row-check').onchange = (e) => {
                currentResults[index].selected = e.target.checked;
                renderResults(currentResults);
                updateCheckAllStatus();
            };
            resultsBody.appendChild(row);
        });
    }

    function openModal(index) {
        activeResultIndex = index;
        const res = currentResults[index];
        modalDocInfo.innerText = `Documento: ${res.arquivo}`;
        modalAssunto.value = res.manual_notes;
        pageRangeInput.value = res.page_range || res.pagina;

        const isFileValid = res.fileObject instanceof File || res.fileObject instanceof Blob;

        if (isWebMode && isFileValid) {
            const fileUrl = URL.createObjectURL(res.fileObject);
            pdfPreview.src = `${fileUrl}#page=${res.pagina}`;
        } else if (!isWebMode) {
            pdfPreview.src = `/api/view?path=${encodeURIComponent(res.caminho)}#page=${res.pagina}`;
        } else {
            // Se for Web Mode mas não tiver o arquivo físico
            pdfPreview.src = "";
            alert("Arquivo físico não encontrado. Por favor, selecione a pasta novamente usando o botão 'Escolher Pasta'.");
        }
        
        modalExtract.classList.remove('hidden');
        modalAssunto.focus();
    }

    btnCloseModal.onclick = () => { modalExtract.classList.add('hidden'); pdfPreview.src = ""; };

    btnSaveRange.onclick = () => {
        if (activeResultIndex !== null) {
            currentResults[activeResultIndex].selected = true;
            currentResults[activeResultIndex].page_range = pageRangeInput.value.trim();
            currentResults[activeResultIndex].manual_notes = modalAssunto.value.trim();
            renderResults(currentResults);
            modalExtract.classList.add('hidden');
        }
    };

    async function downloadSingleSlice(index, btnIndicator) {
        const res = currentResults[index];
        const rangeText = res.page_range || res.pagina;
        const nome_final = res.manual_notes || `${res.arquivo.replace(/\.[^/.]+$/, "")}_Pag_${res.pagina}`;

        btnIndicator.disabled = true;
        const origText = btnIndicator.innerText;
        btnIndicator.innerText = '⏳';

        try {
            const isFileValid = res.fileObject instanceof File || res.fileObject instanceof Blob;

            if (isWebMode && isFileValid) {
                const originalBytes = await res.fileObject.arrayBuffer();
                const pdfDoc = await PDFLib.PDFDocument.load(originalBytes);
                const newPdf = await PDFLib.PDFDocument.create();

                let range_raw = rangeText.toString();
                let pageIndices = [];

                for (const part of range_raw.replace(/ /g, "").split(",")) {
                    if (part.includes("-")) {
                        let [start, end] = part.split("-").map(Number);
                        for (let i = start; i <= end; i++) pageIndices.push(i - 1);
                    } else if (part) {
                        pageIndices.push(Number(part) - 1);
                    }
                }

                pageIndices = pageIndices.filter(idx => idx >= 0 && idx < pdfDoc.getPageCount());
                if (pageIndices.length > 0) {
                    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
                    copiedPages.forEach(page => newPdf.addPage(page));
                    const pdfBytes = await newPdf.save();
                    
                    const blob = new Blob([pdfBytes], { type: "application/pdf" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `${nome_final}.pdf`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                } else {
                    alert("Intervalo de páginas inválido.");
                }
            } else {
                const resp = await fetch('/api/pdf/slice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caminho: res.caminho, range: rangeText, nome_final: nome_final })
                });
                
                if (!resp.ok) {
                    const errorData = await resp.json();
                    throw new Error(errorData.error || 'Falha ao processar no backend.');
                }
                
                const data = await resp.json();
                const link = document.createElement('a');
                link.href = `data:application/pdf;base64,${data.content}`;
                link.download = data.filename;
                link.click();
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao baixar arquivo recortado: ' + err.message);
        } finally {
            btnIndicator.disabled = false;
            btnIndicator.innerText = origText;
        }
    }

    btnDiscard.onclick = () => {
        if (activeResultIndex !== null) {
            currentResults[activeResultIndex].selected = false;
            renderResults(currentResults);
            modalExtract.classList.add('hidden');
            pdfPreview.src = "";
        }
    };

    checkAll.onchange = (e) => {
        currentResults.forEach(r => r.selected = e.target.checked);
        renderResults(currentResults);
    };

    function updateCheckAllStatus() {
        const allChecked = currentResults.every(r => r.selected);
        checkAll.checked = allChecked;
        checkAll.indeterminate = currentResults.some(r => r.selected) && !allChecked;
    }

    function resetSearchButton() {
        btnSearch.disabled = false;
        btnSearch.querySelector('.loader-inline').classList.add('hidden');
    }

    // SESSION LOGIC
    btnSaveSession.addEventListener('click', () => {
        if (currentResults.length === 0) return alert('Não há dados para salvar.');
        const dataStr = JSON.stringify(currentResults, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `sessao_busca_${new Date().toISOString().slice(0, 10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    btnLoadSession.addEventListener('click', () => inputLoadSession.click());

    inputLoadSession.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loadedData = JSON.parse(event.target.result);
                if (!Array.isArray(loadedData)) throw new Error('Formato inválido.');
                
                // Limpeza e normalização dos dados carregados
                const currentDir = directoryInput.value.trim().replace(/^["']|["']$/g, '');

                currentResults = loadedData.map(r => {
                    // Se o fileObject veio como um objeto vazio do JSON, removemos
                    if (r.fileObject && !(r.fileObject instanceof File)) {
                        delete r.fileObject;
                    }

                    // Lógica de Rebase Inteligente para Modo Local
                    if (!isWebMode && currentDir) {
                        const normalizedRoot = currentDir.replace(/[\\/]$/, '');
                        const isAbsolute = r.caminho.match(/^([a-zA-Z]:\\|\/)/);
                        
                        let finalPath = r.caminho;

                        if (!isAbsolute) {
                            // Era um caminho relativo (vindo da Web)
                            let relPath = r.caminho.replace(/\//g, '\\');
                            
                            // Detecção de Redundância (Overlap)
                            const rootParts = normalizedRoot.split(/[\\/]/);
                            const lastRootFolder = rootParts[rootParts.length - 1];
                            
                            if (lastRootFolder && relPath.toLowerCase().startsWith(lastRootFolder.toLowerCase() + '\\')) {
                                relPath = relPath.substring(lastRootFolder.length + 1);
                            }
                            
                            finalPath = normalizedRoot + (relPath.startsWith('\\') ? '' : '\\') + relPath;
                        } else if (!r.caminho.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
                            // Era um caminho absoluto mas de outro lugar, tenta re-vincular
                            finalPath = normalizedRoot + '\\' + r.arquivo;
                        }
                        
                        r.caminho = finalPath;
                    }

                    return {
                        ...r,
                        selected: r.selected !== undefined ? r.selected : true,
                        manual_notes: r.manual_notes || "",
                        page_range: r.page_range || ""
                    };
                });

                if (isWebMode) {
                    relinkWebFiles();
                }

                renderUIWithResults();
                alert('Sessão carregada com sucesso!' + (isWebMode && webFiles.length === 0 ? ' Lembre-se de selecionar a pasta para abrir os arquivos.' : ''));
            } catch (err) { 
                console.error(err);
                alert('Erro ao carregar arquivo de sessão.'); 
            }
        };
        reader.readAsText(file);
    });

    async function handleExport(url, btn) {
        const selected = currentResults.filter(r => r.selected);
        if (selected.length === 0) return alert('Selecione um item.');
        
        if (isWebMode) {
            if (url.includes('export_selected')) {
                return exportWebXLSX(selected, btn);
            } else {
                return exportWebZIP(selected, btn);
            }
        }

        const originalText = btn.innerText;
        btn.disabled = true; btn.innerText = 'Processando...';
        try {
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: selected }) });
            const data = await resp.json();
            if (data.content) {
                const link = document.createElement('a');
                link.href = `data:application/octet-stream;base64,${data.content}`;
                link.download = data.filename; link.click();
            }
        } catch (err) { alert('Erro.'); }
        finally { btn.disabled = false; btn.innerText = originalText; }
    }

    async function exportWebXLSX(results, btn) {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Documento", "Caminho", "Página", "Termo", "Assunto"],
            ...results.map(r => [r.arquivo, r.caminho, r.pagina, r.termo, r.manual_notes || ""])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        
        XLSX.writeFile(wb, `relatorio_${new Date().getTime()}.xlsx`);
    }

    async function exportWebZIP(results, btn) {
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Gerando ZIP (Aguarde)...';

        try {
            const zip = new JSZip();
            const docsFolder = zip.folder("Documentos");

            // Planilha Geral
            const wb = XLSX.utils.book_new();
            const wsData = [
                ["Documento Extraído", "Arquivo Original", "Página Original", "Termo", "Assunto"],
                ...results.map(r => {
                    const nome_final = r.manual_notes || `${r.arquivo.replace(/\.[^/.]+$/, "")}_Pag_${r.pagina}`;
                    return [nome_final, r.arquivo, r.pagina, r.termo, r.manual_notes || ""];
                })
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Relatório");
            const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            zip.file("Relatorio_Geral.xlsx", excelBuffer);

            // PDFs
            for (const r of results) {
                if (!r.fileObject || !r.fileObject.name.toLowerCase().endsWith('.pdf')) continue;
                
                const nome_final = r.manual_notes || `${r.arquivo.replace(/\.[^/.]+$/, "")}_Pag_${r.pagina}`;
                
                try {
                    const originalBytes = await r.fileObject.arrayBuffer();
                    const pdfDoc = await PDFLib.PDFDocument.load(originalBytes);
                    const newPdf = await PDFLib.PDFDocument.create();

                    let range_raw = (r.page_range || r.pagina).toString().trim();
                    let pageIndices = [];

                    for (const part of range_raw.replace(/ /g, "").split(",")) {
                        if (part.includes("-")) {
                            let [start, end] = part.split("-").map(Number);
                            for (let i = start; i <= end; i++) pageIndices.push(i - 1);
                        } else if (part) {
                            pageIndices.push(Number(part) - 1);
                        }
                    }

                    // Filtra índices válidos
                    pageIndices = pageIndices.filter(idx => idx >= 0 && idx < pdfDoc.getPageCount());

                    if (pageIndices.length > 0) {
                        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
                        copiedPages.forEach(page => newPdf.addPage(page));
                        
                        const pdfBytes = await newPdf.save();
                        docsFolder.file(`${nome_final}.pdf`, pdfBytes);
                    }
                } catch (e) {
                    console.error("Erro ao fatiar PDF Web:", e);
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `pacote_${new Date().getTime()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
        } catch (err) {
            alert('Erro ao gerar ZIP offline. Tente novamente.');
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }

    btnExport.onclick = () => handleExport('/api/export_selected', btnExport);
    btnExportZip.onclick = () => handleExport('/api/pdf/zip_all', btnExportZip);
});
