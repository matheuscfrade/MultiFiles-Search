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

    let pollInterval = null;
    let currentResults = [];
    let activeResultIndex = null;
    const checkAll = document.getElementById('check-all');

    async function checkActiveSearch() {
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
        let directory = directoryInput.value.trim().replace(/^["']|["']$/g, '');
        const terms = termsInput.value.split(',').map(t => t.trim()).filter(t => t);
        if (!directory || terms.length === 0) return alert('Informe o diretório e termos.');

        btnSearch.disabled = true;
        btnSearch.querySelector('.loader-inline').classList.remove('hidden');
        progressArea.classList.remove('hidden');
        resultsArea.classList.add('hidden');
        progressBar.style.width = '0%';
        percentText.innerText = '0%';
        statusMsg.innerText = 'Iniciando...';
        checkAll.checked = false;

        try {
            await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory, terms })
            });
            startPolling();
        } catch (err) { alert('Erro.'); resetSearchButton(); }
    });

    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
            const response = await fetch('/api/status');
            const state = await response.json();
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
            `;

            row.querySelector('.extract-trigger').onclick = (e) => { e.preventDefault(); openModal(index); };
            row.querySelector('.editable-cell').onclick = () => openModal(index);
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
        pdfPreview.src = `/api/view?path=${encodeURIComponent(res.caminho)}#page=${res.pagina}`;
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
                currentResults = loadedData;
                renderUIWithResults();
                alert('Sessão carregada com sucesso!');
            } catch (err) { alert('Erro ao carregar arquivo de sessão.'); }
        };
        reader.readAsText(file);
    });

    async function handleExport(url, btn) {
        const selected = currentResults.filter(r => r.selected);
        if (selected.length === 0) return alert('Selecione um item.');
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

    btnExport.onclick = () => handleExport('/api/export_selected', btnExport);
    btnExportZip.onclick = () => handleExport('/api/pdf/zip_all', btnExportZip);
});
