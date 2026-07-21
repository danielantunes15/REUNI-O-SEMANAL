// =========================================================
// MÓDULO 1: GRÁFICOS, LEADERBOARDS E EXPORTAÇÃO (OPERACIONAL)
// =========================================================

// Função que pega toda a base e filtra SOMENTE pelo mês corrente real e pela transportadora selecionada
function obterDadosMesAtualParaGraficos() {
    if (!window.fullHistoricoDataOp || window.fullHistoricoDataOp.length === 0) return [];
    
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const filterTransp = document.getElementById('filterTransportadora');
    const activeT = filterTransp ? filterTransp.value : 'ALL';

    const dadosMesAtual = window.fullHistoricoDataOp.filter(d => {
        const parsed = window.parseDateTime ? window.parseDateTime(d.dataDaBaseExcel) : null;
        if (!parsed) return false;
        
        // Mantém apenas os dados do mês atual e ano atual
        if (parsed.getMonth() !== mesAtual || parsed.getFullYear() !== anoAtual) {
            return false;
        }

        // Respeita o filtro de Transportadora caso selecionado
        const mTransp = activeT === 'ALL' || d.transportadora === activeT;
        return mTransp;
    });

    // Mantém o mesmo padrão de visualização geral (Geral = Filtro Serrana)
    if (activeT === 'ALL' && typeof window.isSerranaTransp === 'function') {
        return dadosMesAtual.filter(d => window.isSerranaTransp(d));
    }
    return dadosMesAtual;
}

window.renderCarregamentoChart = function(data) {
    const ctxCarreg = document.getElementById('evolucaoCarregamentoChart');
    if(!ctxCarreg) return;

    let existingChart = Chart.getChart("evolucaoCarregamentoChart");
    if (existingChart != undefined) { existingChart.destroy(); }
    if (window.chartCarregamento) window.chartCarregamento.destroy();
    
    // USA OS DADOS FORÇADOS DO MÊS ATUAL, IGNORANDO O ARGUMENTO "data" QUE VEM DO FILTRO
    const dadosMesAtual = obterDadosMesAtualParaGraficos();

    // FILTRO C1 SERRANA: Apenas nossas gruas (GSR) e nossa frota
    const dataC1 = dadosMesAtual.filter(d => {
        if(window.checkLoader && window.serranaLoaders && window.isSerranaTransp) {
            return window.checkLoader(d, window.serranaLoaders, 'GSR') && window.isSerranaTransp(d);
        }
        return true; 
    });

    const dailyMap = new Map();
    dataC1.forEach(d => {
        const dt = d.dataDaBaseExcel;
        if (!dt || dt === 'Desconhecida') return;
        if (!dailyMap.has(dt)) dailyMap.set(dt, 0);
        const vol = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
        dailyMap.set(dt, dailyMap.get(dt) + vol);
    });

    const sortedDates = Array.from(dailyMap.keys()).sort((a, b) => {
        const pA = a.split('/'); const pB = b.split('/');
        return new Date(pA[2], pA[1]-1, pA[0]) - new Date(pB[2], pB[1]-1, pB[0]);
    });
    const displayDates = sortedDates.slice(-30);
    const displayVols = displayDates.map(dt => dailyMap.get(dt));
    
    const ctx = ctxCarreg.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#10b981'); 
    gradient.addColorStop(1, '#047857'); 

    window.chartCarregamento = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayDates.map(d => d.substring(0, 5)), 
            datasets: [{
                label: 'Carregamento (m³)',
                data: displayVols,
                backgroundColor: gradient,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, beginAtZero: true, suggestedMax: Math.max(...displayVols) * 1.2 }, 
                x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' } }
            },
            layout: { padding: { top: 25 } }
        },
        plugins: [window.op_chartDataLabelsPlugin]
    });
};

window.renderTransporteChart = function(data) {
    const ctxTransp = document.getElementById('evolucaoTransporteChart');
    if(!ctxTransp) return;

    let existingChart = Chart.getChart("evolucaoTransporteChart");
    if (existingChart != undefined) { existingChart.destroy(); }
    if (window.chartTransporte) window.chartTransporte.destroy();
    
    // USA OS DADOS FORÇADOS DO MÊS ATUAL, IGNORANDO O ARGUMENTO "data" QUE VEM DO FILTRO
    const dadosMesAtual = obterDadosMesAtualParaGraficos();

    const dailyMap = new Map();
    dadosMesAtual.forEach(d => {
        const dt = d.dataDaBaseExcel;
        if (!dt || dt === 'Desconhecida') return;
        if (!dailyMap.has(dt)) dailyMap.set(dt, 0);
        const vol = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
        dailyMap.set(dt, dailyMap.get(dt) + vol);
    });

    const sortedDates = Array.from(dailyMap.keys()).sort((a, b) => {
        const pA = a.split('/'); const pB = b.split('/');
        return new Date(pA[2], pA[1]-1, pA[0]) - new Date(pB[2], pB[1]-1, pB[0]);
    });
    const displayDates = sortedDates.slice(-30);
    const displayVols = displayDates.map(dt => dailyMap.get(dt));
    
    const ctx = ctxTransp.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#38bdf8'); 
    gradient.addColorStop(1, '#0369a1'); 

    window.chartTransporte = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayDates.map(d => d.substring(0, 5)), 
            datasets: [{
                label: 'Transporte (m³)',
                data: displayVols,
                backgroundColor: gradient,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, beginAtZero: true, suggestedMax: Math.max(...displayVols) * 1.2 }, 
                x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#cbd5e1' } }
            },
            layout: { padding: { top: 25 } }
        },
        plugins: [window.op_chartDataLabelsPlugin]
    });
};

window.renderLeaderboards = function(data, diasConsiderados = 1) {
    const pMap = new Map();
    // O Leaderboard continua obedecendo aos filtros de dia/semana (data) que o usuário escolheu
    data.forEach(d => {
        const pl = d.placa || 'N/A';
        const volNum = parseFloat(String(d.volumeReal).replace(',', '.')) || 0;
        if(!pMap.has(pl)) pMap.set(pl, {p: pl, t: d.transportadora||'-', vol: 0, v: 0, ciclos: 0, cCount: 0});
        
        const o = pMap.get(pl);
        o.vol += volNum; o.v++;
        if(d.cicloHoras > 0) { o.ciclos += d.cicloHoras; o.cCount++; }
    });

    const arr = Array.from(pMap.values());
    
    window.diasConsideradosGlobais = diasConsiderados;
    window.globalTopVol = [...arr].sort((a,b)=>b.vol - a.vol);
    window.globalTopCiclo = [...arr].filter(x=>x.cCount > 0).map(x=>({...x, cMedio: x.ciclos/x.cCount})).sort((a,b)=>a.cMedio - b.cMedio);

    const bVol = document.getElementById('leaderboardBody');
    if(bVol) {
        bVol.innerHTML = '';
        window.globalTopVol.forEach((x,i) => {
            const viagensPorDia = diasConsiderados > 0 ? (x.v / diasConsiderados) : x.v;
            const cumpriuMeta = viagensPorDia >= 2;
            
            const badgeHtml = cumpriuMeta 
                ? `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold" title="${viagensPorDia.toFixed(1)} viagens/dia"><i class="fas fa-check mr-1"></i>SIM</span>`
                : `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold" title="${viagensPorDia.toFixed(1)} viagens/dia"><i class="fas fa-times mr-1"></i>NÃO</span>`;

            const tr = `<tr>
                <td class="px-4 py-3 text-center"><div class="w-6 h-6 rounded-full ${i<3?'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]':'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold">${i+1}</div></td>
                <td class="px-4 py-3 font-bold text-white">${x.p}</td>
                <td class="px-4 py-3 text-slate-400 truncate max-w-[100px]">${x.t}</td>
                <td class="px-4 py-3 text-center text-slate-300">${x.v}</td>
                <td class="px-4 py-3 text-right font-mono text-emerald-400">${x.vol.toLocaleString('pt-PT',{maximumFractionDigits:1})}</td>
                <td class="px-4 py-3 text-center">${badgeHtml}</td>
            </tr>`;
            bVol.insertAdjacentHTML('beforeend', tr);
        });
        
        if (window.globalTopVol.length === 0) {
            bVol.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-500">Nenhum veículo encontrado no período.</td></tr>`;
        }
    }

    const bCiclo = document.getElementById('leaderboardCicloBody');
    if(bCiclo) {
        bCiclo.innerHTML = '';
        window.globalTopCiclo.forEach((x,i) => {
            const tr = `<tr>
                <td class="px-4 py-3 text-center"><div class="w-6 h-6 rounded-full ${i<3?'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)]':'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold">${i+1}</div></td>
                <td class="px-4 py-3 font-bold text-white">${x.p}</td>
                <td class="px-4 py-3 text-slate-400 truncate max-w-[100px]">${x.t}</td>
                <td class="px-4 py-3 text-center text-slate-300">${x.v}</td>
                <td class="px-4 py-3 text-right font-mono text-sky-400">${window.formatarHorasMinutos(x.cMedio)}</td>
            </tr>`;
            bCiclo.insertAdjacentHTML('beforeend', tr);
        });
        
        if (window.globalTopCiclo.length === 0) {
            bCiclo.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-500">Nenhum ciclo encontrado no período.</td></tr>`;
        }
    }
};

window.exportarTopVolume = function() {
    if (!window.globalTopVol || window.globalTopVol.length === 0) {
        alert("Não há dados de Volume para exportar no período selecionado."); return;
    }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Posicao;Placa;Transportadora;Total Viagens;Volume Total;Media Viagens/Dia;Cumpriu Meta\n";

    window.globalTopVol.forEach((x, i) => {
        const viagensPorDia = window.diasConsideradosGlobais > 0 ? (x.v / window.diasConsideradosGlobais) : x.v;
        const cumpriuMeta = viagensPorDia >= 2 ? 'SIM' : 'NAO';
        csvContent += `${i + 1};${x.p};${x.t};${x.v};${x.vol.toString().replace('.', ',')};${viagensPorDia.toFixed(2).replace('.', ',')};${cumpriuMeta}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Relatorio_Volume_Veiculos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportarTopCiclo = function() {
    if (!window.globalTopCiclo || window.globalTopCiclo.length === 0) {
        alert("Não há dados de Ciclos para exportar no período selecionado."); return;
    }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Posicao;Placa;Transportadora;Viagens Realizadas;Ciclo Medio (Decimais)\n";

    window.globalTopCiclo.forEach((x, i) => {
        csvContent += `${i + 1};${x.p};${x.t};${x.v};${x.cMedio.toFixed(2).replace('.', ',')}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Relatorio_Ciclos_Veiculos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// =========================================================
// PONTE DE INTEGRAÇÃO COM O NÚCLEO (CORREÇÃO DE EXIBIÇÃO)
// =========================================================
window.atualizarGraficosOperacionais = function(cardsData, filteredGlobal) {
    if (typeof window.renderCarregamentoChart === 'function') {
        window.renderCarregamentoChart(cardsData);
    }
    if (typeof window.renderTransporteChart === 'function') {
        window.renderTransporteChart(cardsData);
    }
    if (typeof window.renderLeaderboards === 'function') {
        // Envia as datas do filtro escolhido exclusivamente para o Top 10 (Leaderboards)
        window.renderLeaderboards(cardsData, window.diasConsideradosGlobais);
    }
};