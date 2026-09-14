// =========================================================
// ARQUIVO: js/operacional/op_main.js
// MÓDULO: INICIALIZAÇÃO, UI E EXPORTAÇÃO
// =========================================================

window.op_chartDataLabelsPlugin = {
    id: 'customDataLabels',
    afterDatasetsDraw: (chart) => {
        const { ctx } = chart;
        ctx.save();
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, index) => {
                const dataVal = dataset.data[index];
                if (dataVal > 0) {
                    ctx.fillText(dataVal.toLocaleString('pt-BR', {maximumFractionDigits: 0}), bar.x, bar.y - 4);
                }
            });
        });
        ctx.restore();
    }
};

window.setQuickFilterOpUI = function(qf) {
    window.activeQuickFilterOp = qf;
    const btnQFs = document.querySelectorAll('.btn-op-qf');
    btnQFs.forEach(b => {
        if(b.getAttribute('data-op-qf') === qf) {
            b.classList.add('active', 'border-sky-500/50', 'text-sky-400', 'bg-sky-900/30');
            b.classList.remove('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
        } else {
            b.classList.remove('active', 'border-sky-500/50', 'text-sky-400', 'bg-sky-900/30');
            b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
        }
    });
};

window.setupOperacionalFilters = function() {
    const btnQFs = document.querySelectorAll('.btn-op-qf');
    const datePicker = document.getElementById('opDatePicker');
    const filterMesOp = document.getElementById('filterMesOp');
    const filterTransp = document.getElementById('filterTransportadora');
    
    btnQFs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            window.setQuickFilterOpUI(e.currentTarget.getAttribute('data-op-qf'));
            if(datePicker) datePicker.value = '';
            if(filterMesOp) filterMesOp.value = 'ALL';
            if (typeof window.atualizarPainelOperacional === 'function') window.atualizarPainelOperacional();
        });
    });

    if(datePicker) {
        datePicker.addEventListener('change', () => {
            if(datePicker.value) {
                window.setQuickFilterOpUI('DATE');
                if(filterMesOp) filterMesOp.value = 'ALL';
                if (typeof window.atualizarPainelOperacional === 'function') window.atualizarPainelOperacional();
            }
        });
    }

    if(filterMesOp) {
        filterMesOp.addEventListener('change', () => {
            if(filterMesOp.value !== 'ALL') {
                window.setQuickFilterOpUI('ALL');
                if(datePicker) datePicker.value = '';
            }
            if (typeof window.atualizarPainelOperacional === 'function') window.atualizarPainelOperacional();
        });
    }

    if(filterTransp) {
        filterTransp.addEventListener('change', () => {
            if (typeof window.atualizarPainelOperacional === 'function') window.atualizarPainelOperacional();
        });
    }
};

window.initNovoDashboardOperacional = async function() {
    if(typeof Chart === 'undefined') {
        setTimeout(window.initNovoDashboardOperacional, 50);
        return; 
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    window.setupOperacionalFilters();
    window.setQuickFilterOpUI('D-1'); 
    
    if (typeof window.carregarConfigGruasOp === 'function') await window.carregarConfigGruasOp();
    if (typeof window.carregarMetasGlobais === 'function') await window.carregarMetasGlobais();

    if (typeof window.loadManutencaoDataForMeta === 'function') {
        window.loadManutencaoDataForMeta().finally(() => {
            if (typeof window.loadOperacionalData === 'function') window.loadOperacionalData();
        });
    }
    
    if(document.getElementById('data-mural-setor')) {
        document.getElementById('data-mural-setor').value = new Date().toISOString().split('T')[0];
    }
    if (typeof window.carregarMuralSetor === 'function') window.carregarMuralSetor();
    if (typeof window.carregarFrotaSupabase === 'function') window.carregarFrotaSupabase();
};

window.exportarParaExcelOp = function() {
    if (!window.fullHistoricoDataOp || window.fullHistoricoDataOp.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(window.fullHistoricoDataOp);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base");
    XLSX.writeFile(wb, "Base_Operacional.xlsx");
};