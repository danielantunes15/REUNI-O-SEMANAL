// =================================================================
// ARQUIVO: os_painel.js
// COM LOGS DE DEPURAÇÃO (DEBUG) E ACESSO CENTRALIZADO AO SUPABASE
// =================================================================
console.log('[OS Painel] Inicializando os_painel.js e instanciando o Supabase centralizado...');

// Removidas as credenciais daqui! Utilizando conexão global do config_db.js
const supabaseManutencao = window.supabaseClientGlobal;

window.ordensServico = [];
window.frotasManutencao = [];
window.estadoFiltroGlobal = { tipo: 'MES_ATUAL', mesAno: '' };

window.carregarDadosManutencao = async function() {
    console.log('[OS Painel] INICIANDO REQUISIÇÃO SUPABASE -> carregarDadosManutencao()');
    try {
        // Order by id desc para pegar as O.S mais NOVAS e limit extendido
        const { data: osData, error: osError } = await supabaseManutencao
            .from('ordens_servico')
            .select('*')
            .order('id', { ascending: false })
            .limit(5000);

        if (osError) {
            console.error('[OS Painel ERRO] Banco ordens_servico retornou erro:', osError);
            window.ordensServico = [];
        } else {
            console.log(`[OS Painel SUCESSO] ${osData?.length || 0} ordens de serviço carregadas!`);
            window.ordensServico = osData || [];
        }

        const { data: frotaData, error: frotaError } = await supabaseManutencao
            .from('frotas_manutencao')
            .select('*')
            .order('cavalo', { ascending: true });
            
        if (frotaError) {
            console.error('[OS Painel ERRO] Banco frotas_manutencao retornou erro:', frotaError);
            window.frotasManutencao = [];
        } else {
            console.log(`[OS Painel SUCESSO] ${frotaData?.length || 0} frotas carregadas!`);
            window.frotasManutencao = frotaData || [];
        }
    } catch (error) { 
        console.error("[OS Painel ERRO CRÍTICO] Falha severa ao carregar dados da manutenção:", error); 
    }
};

window.preencherFiltroMesGlobal = function() {
    const select = document.getElementById('filtroMesGlobal');
    if (!select) {
        console.warn('[OS Painel] Div id="filtroMesGlobal" não encontrada. O Select de mês será ignorado.');
        return;
    }
    if (!window.ordensServico || !window.frotasManutencao) return;

    // Garantir filtro seguro para case-insensitive e trim (espaços extras)
    let cavalosValidos = window.frotasManutencao
        .filter(f => (f.status || '').toUpperCase() === 'ATIVO' && (f.categoria || '').toUpperCase() === 'TRITREM')
        .map(f => (f.cavalo || '').trim());

    const mesesDisponiveis = new Set();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    window.ordensServico.forEach(os => {
        const placaOs = (os.placa || '').trim();
        if (!placaOs || !cavalosValidos.includes(placaOs)) return; 
        
        if (os.data_abertura && os.status !== 'Agendada') {
            let dataStr = os.data_abertura;
            if (!dataStr.includes('T')) dataStr += 'T00:00:00';
            const data = new Date(dataStr.replace('Z', '').replace('+00:00', ''));
            if (!isNaN(data.getTime())) {
                const ano = data.getFullYear();
                const mes = String(data.getMonth() + 1).padStart(2, '0');
                mesesDisponiveis.add(`${ano}-${mes}`);
            }
        }
    });

    mesesDisponiveis.add(mesAtualKey); 
    const mesesOrdenados = Array.from(mesesDisponiveis).sort((a, b) => b.localeCompare(a)); 
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    let html = '<option value="ATUAL">MÊS ATUAL</option>';
    mesesOrdenados.forEach(chave => {
        if (chave !== mesAtualKey) {
            const [ano, mes] = chave.split('-');
            const nomeMes = nomesMeses[parseInt(mes) - 1];
            html += `<option value="${chave}">${nomeMes}/${ano.slice(2)}</option>`;
        }
    });
    select.innerHTML = html;
};

window.aplicarFiltroRapido = function(tipo, btn) {
    console.log(`[OS Painel] Filtro Rapido Acionado: ${tipo}`);
    window.estadoFiltroGlobal.tipo = tipo;
    document.querySelectorAll('.btn-qf-global').forEach(b => {
        b.classList.remove('active'); b.style.background = 'transparent'; b.style.color = '#94a3b8';
    });
    if(btn) { btn.classList.add('active'); btn.style.background = '#3b82f6'; btn.style.color = 'white'; }
    
    const selectMes = document.getElementById('filtroMesGlobal');
    if(selectMes) selectMes.value = 'ATUAL';
    window.dispararFiltrosGlobais();
};

window.aplicarFiltroMesGlobal = function() {
    const select = document.getElementById('filtroMesGlobal');
    const valor = select.value;
    console.log(`[OS Painel] Filtro Mês Acionado: ${valor}`);
    document.querySelectorAll('.btn-qf-global').forEach(b => {
        b.classList.remove('active'); b.style.background = 'transparent'; b.style.color = '#94a3b8';
    });

    if (valor === 'ATUAL') {
        window.estadoFiltroGlobal.tipo = 'MES_ATUAL';
        window.estadoFiltroGlobal.mesAno = '';
        const btnMesAtual = document.querySelector('.btn-qf-global[data-qf="MES_ATUAL"]');
        if (btnMesAtual) { btnMesAtual.classList.add('active'); btnMesAtual.style.background = '#3b82f6'; btnMesAtual.style.color = 'white'; }
    } else {
        window.estadoFiltroGlobal.tipo = 'MES_ESPECIFICO';
        window.estadoFiltroGlobal.mesAno = valor;
    }
    window.dispararFiltrosGlobais();
};

window.getDatasFiltroGlobal_OSPanel = function() {
    console.warn('[OS Painel ATENÇÃO] A função getDatasFiltroGlobal do painel de OS foi chamada. Cuidado para não conflitar com o core.');
    const hoje = new Date();
    let inicio = new Date(hoje);
    let fim = new Date(hoje);
    fim.setHours(23, 59, 59, 999);

    if (window.estadoFiltroGlobal.tipo === 'D-1') {
        inicio.setDate(hoje.getDate() - 1); inicio.setHours(0, 0, 0, 0);
        fim = new Date(hoje); fim.setDate(hoje.getDate() - 1); fim.setHours(23, 59, 59, 999);
    } else if (window.estadoFiltroGlobal.tipo === 'D-2') {
        inicio.setDate(hoje.getDate() - 2); inicio.setHours(0, 0, 0, 0);
        fim = new Date(hoje); fim.setDate(hoje.getDate() - 2); fim.setHours(23, 59, 59, 999);
    } else if (window.estadoFiltroGlobal.tipo === 'D-3') {
        inicio.setDate(hoje.getDate() - 3); inicio.setHours(0, 0, 0, 0);
        fim = new Date(hoje); fim.setDate(hoje.getDate() - 1); fim.setHours(23, 59, 59, 999);
    } else if (window.estadoFiltroGlobal.tipo === 'D-7') {
        inicio.setDate(hoje.getDate() - 7); inicio.setHours(0, 0, 0, 0);
        fim = new Date(hoje); fim.setDate(hoje.getDate() - 1); fim.setHours(23, 59, 59, 999);
    } else if (window.estadoFiltroGlobal.tipo === 'D-30') {
        inicio.setDate(hoje.getDate() - 30); inicio.setHours(0, 0, 0, 0);
        fim = new Date(hoje); fim.setDate(hoje.getDate() - 1); fim.setHours(23, 59, 59, 999);
    } else if (window.estadoFiltroGlobal.tipo === 'MES_ESPECIFICO' && window.estadoFiltroGlobal.mesAno) {
        const [ano, mes] = window.estadoFiltroGlobal.mesAno.split('-');
        inicio = new Date(parseInt(ano), parseInt(mes) - 1, 1, 0, 0, 0);
        fim = new Date(parseInt(ano), parseInt(mes), 0, 23, 59, 59, 999);
        if (inicio.getFullYear() === hoje.getFullYear() && inicio.getMonth() === hoje.getMonth()) {
            fim = new Date(hoje); fim.setHours(23, 59, 59, 999); 
        }
    } else {
        inicio.setDate(1); inicio.setHours(0, 0, 0, 0); 
    }
    return { inicio: inicio, fim: fim, valorBruto: window.estadoFiltroGlobal.tipo };
};

window.dispararFiltrosGlobais = function() {
    console.log('[OS Painel] Disparando Filtros Globais...');
    try { if(typeof atualizarKPIsGlobais === 'function') atualizarKPIsGlobais(); } catch(e){ console.error(e); }
    try { if(typeof renderizarGraficoEvolucaoDMDiaria === 'function') renderizarGraficoEvolucaoDMDiaria(); } catch(e){ console.error(e); }
    try { if(typeof renderizarRelatorioGerencialOS === 'function') renderizarRelatorioGerencialOS(); } catch(e){ console.error(e); }
    try { if(typeof renderizarRelatorioTipoServico === 'function') renderizarRelatorioTipoServico(); } catch(e){ console.error(e); }
};

window.renderizarRelatorioGerencialOS = function() {
    let filtroData = (typeof window.getDatasFiltroGlobal_OSPanel === 'function') ? window.getDatasFiltroGlobal_OSPanel() : window.getDatasFiltroGlobal();
    
    let cavalosValidos = [];
    if (window.frotasManutencao) {
        cavalosValidos = window.frotasManutencao
            .filter(f => (f.status || '').toUpperCase() === 'ATIVO' && (f.categoria || '').toUpperCase() === 'TRITREM')
            .map(f => (f.cavalo || '').trim());
    }

    const osManutencao = window.ordensServico.filter(o => {
        const placaOs = (o.placa || '').trim();
        if (!placaOs || !cavalosValidos.includes(placaOs)) return false; 
        if (o.tipo === 'Sinistro') return false;
        if (!o.data_abertura) return false;
        let osInicioStr = o.data_abertura;
        if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
        const d = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
        return d >= filtroData.inicio && d <= filtroData.fim;
    });

    const porCavalo = {};
    osManutencao.forEach(o => { 
        const placaOs = (o.placa || '').trim();
        porCavalo[placaOs] = (porCavalo[placaOs] || 0) + 1; 
    });
    const topCavalos = Object.entries(porCavalo).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const maxCavaloCount = topCavalos.length > 0 ? topCavalos[0][1] : 1;
    let htmlCavalos = '';
    topCavalos.forEach(([placa, qtd], index) => {
        const percent = (qtd / maxCavaloCount) * 100;
        htmlCavalos += `<div style="margin-bottom: 12px;"><div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: #e2e8f0;"><strong>${index + 1}º ${placa}</strong><span>${qtd} O.S.</span></div><div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 12px; overflow: hidden;"><div style="background: #ef4444; width: ${percent}%; height: 100%;"></div></div></div>`;
    });
    const elRkCavalo = document.getElementById('rankingCavalosOS');
    if(elRkCavalo) elRkCavalo.innerHTML = htmlCavalos || '<p style="color:#94a3b8;">Sem dados.</p>';

    const porPrioridade = { 'Urgente': 0, 'Alta': 0, 'Normal': 0, 'Baixa': 0 };
    osManutencao.forEach(o => { 
        const prio = o.prioridade || 'Normal';
        if(porPrioridade[prio] !== undefined) porPrioridade[prio]++; 
    });
    const colorsPri = { 'Urgente': '#ef4444', 'Alta': '#f97316', 'Normal': '#eab308', 'Baixa': '#10b981' };
    
    let htmlPrio = '';
    Object.keys(porPrioridade).forEach(p => {
        const qtd = porPrioridade[p];
        const percent = osManutencao.length > 0 ? (qtd / osManutencao.length) * 100 : 0;
        htmlPrio += `<div style="margin-bottom: 12px;"><div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: #e2e8f0;"><span>Prioridade <strong>${p}</strong></span><span>${qtd} ocorrências</span></div><div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 10px; overflow: hidden;"><div style="background: ${colorsPri[p]}; width: ${percent}%; height: 100%;"></div></div></div>`;
    });
    const elPrio = document.getElementById('graficoPrioridadeOS');
    if(elPrio) elPrio.innerHTML = htmlPrio || '<p style="color:#94a3b8;">Sem dados.</p>';

    if(typeof window.renderizarGraficoOcorrenciasPorTipo === 'function') window.renderizarGraficoOcorrenciasPorTipo();
};

window.renderizarGraficoOcorrenciasPorTipo = function() {
    const el = document.getElementById('graficoOcorrenciasTipoBarra');
    if (!el) { return; }

    let filtroData = (typeof window.getDatasFiltroGlobal_OSPanel === 'function') ? window.getDatasFiltroGlobal_OSPanel() : window.getDatasFiltroGlobal();
    
    let cavalosValidos = [];
    if (window.frotasManutencao) {
        cavalosValidos = window.frotasManutencao
            .filter(f => (f.status || '').toUpperCase() === 'ATIVO' && (f.categoria || '').toUpperCase() === 'TRITREM')
            .map(f => (f.cavalo || '').trim());
    }

    const filtradas = window.ordensServico.filter(o => {
        const placaOs = (o.placa || '').trim();
        if (!placaOs || !cavalosValidos.includes(placaOs)) return false; 
        if (o.tipo === 'Sinistro') return false; 
        if (!o.data_abertura) return false;
        let osInicioStr = o.data_abertura;
        if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
        const d = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
        return d >= filtroData.inicio && d <= filtroData.fim;
    });

    const contagem = {};
    filtradas.forEach(o => { const t = o.tipo || 'Não Informado'; contagem[t] = (contagem[t] || 0) + 1; });

    const sorted = Object.entries(contagem).sort((a,b) => b[1] - a[1]);
    const categories = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);

    if (categories.length === 0) {
        el.innerHTML = '<div style="color:#94a3b8; display:flex; justify-content:center; align-items:center; height:100%;">Nenhuma O.S registrada no período.</div>';
        return;
    }

    if (typeof echarts !== 'undefined') {
        el.innerHTML = ''; 
        if (window.chartOcorrenciasTipo) window.chartOcorrenciasTipo.dispose();
        
        window.chartOcorrenciasTipo = echarts.init(el);
        const option = {
            backgroundColor: 'transparent', tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '25%', top: '15%', containLabel: true },
            xAxis: { type: 'category', data: categories, axisLabel: { color: '#94a3b8', rotate: 35, interval: 0, fontSize: 10, fontWeight: 'bold' } },
            yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } } },
            series: [{
                name: 'Ocorrências', type: 'bar', data: data, barWidth: '40%',
                label: { show: true, position: 'top', color: '#fff', fontWeight: 'bold' },
                itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#0ea5e9' }, { offset: 1, color: '#3b82f6' }]), borderRadius: [6, 6, 0, 0] }
            }]
        };
        window.chartOcorrenciasTipo.setOption(option);
        setTimeout(() => window.chartOcorrenciasTipo.resize(), 100);
        window.addEventListener('resize', () => window.chartOcorrenciasTipo.resize());
    }
};

window.exportarRelatorioTipoServicoExcel = function() {
    if (!window.tipoServicoDataExport || window.tipoServicoDataExport.length === 0) { alert("Não há dados para exportar."); return; }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Tipo de Serviço;Quantidade (O.S.);Tempo Médio de Conclusão\n";
    window.tipoServicoDataExport.forEach(item => { csvContent += `"${item.tipo}";${item.quantidade};"${item.tempoMedioStr}"\n`; });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Tipo_Servico_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

window.exportarGraficoPNG = async function(idElemento, nomeArquivo) {
    const chartDiv = document.getElementById(idElemento);
    if (!chartDiv) { console.error(`[Exportar] Div com ID ${idElemento} não encontrada.`); return; }
    const container = chartDiv.closest('.content-panel');
    if (!container) return;
    
    const botoes = container.querySelectorAll('button');
    botoes.forEach(btn => btn.style.display = 'none');

    try {
        const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#0f172a', useCORS: true });
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url; link.download = `${nomeArquivo}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (e) { console.error("Erro ao exportar PNG:", e); } finally {
        botoes.forEach(btn => btn.style.display = '');
    }
};