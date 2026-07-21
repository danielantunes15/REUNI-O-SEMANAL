// =================================================================
// ARQUIVO: js/dash_manutencao_core.js
// RESPONSABILIDADE: Filtros Globais, Pátio, KPIs e Inicialização
// =================================================================
console.log('[Dash Core] Inicializando dash_manutencao_core.js');

window.filtroGlobalAtual = 'd1';

window.setFiltroGlobal = function(tipo, el) {
    console.log(`[Dash Core] setFiltroGlobal alterado para: ${tipo}`);
    window.filtroGlobalAtual = tipo;
    
    const botoes = document.querySelectorAll('#botoesFiltroGlobal .btn-filter-periodo');
    botoes.forEach(b => b.classList.remove('active'));
    
    if(el && el.tagName === 'BUTTON') { el.classList.add('active'); }

    if (tipo !== 'data_especifica') {
        const dEsp = document.getElementById('filtroDataGlobalEspecifica');
        if(dEsp) dEsp.value = '';
    }
    if (tipo !== 'mes_especifico') {
        const mEsp = document.getElementById('filtroMesGlobalEspecifico');
        if(mEsp) mEsp.value = '';
    }

    if(typeof window.dispararFiltrosGlobais === 'function') {
        window.dispararFiltrosGlobais();
    } else {
        console.warn('[Dash Core] window.dispararFiltrosGlobais não encontrada!');
    }
};

window.getDatasFiltroGlobal = function() {
    let inicio = new Date();
    let fim = new Date();
    const tipo = window.filtroGlobalAtual;

    inicio.setHours(0,0,0,0);
    fim.setHours(23,59,59,999);

    if (tipo === 'd1') {
        inicio.setDate(inicio.getDate() - 1); fim.setDate(fim.getDate() - 1);
    } else if (tipo === 'd2') {
        inicio.setDate(inicio.getDate() - 2); fim.setDate(fim.getDate() - 2);
    } else if (tipo === 'd3') {
        inicio.setDate(inicio.getDate() - 3); fim.setDate(fim.getDate() - 3);
    } else if (tipo === 'd7') {
        inicio.setDate(inicio.getDate() - 7); fim.setDate(fim.getDate() - 7);
    } else if (tipo === 'data_especifica') {
        const val = document.getElementById('filtroDataGlobalEspecifica')?.value;
        if(val) {
            const [y, m, d] = val.split('-');
            inicio = new Date(y, m-1, d, 0, 0, 0);
            fim = new Date(y, m-1, d, 23, 59, 59, 999);
        }
    } else if (tipo === 'mes_especifico') {
        const val = document.getElementById('filtroMesGlobalEspecifico')?.value;
        if(val) {
            const [y, m] = val.split('-');
            inicio = new Date(y, m-1, 1, 0, 0, 0);
            fim = new Date(y, m, 0, 23, 59, 59, 999);
        }
    }
    console.log(`[Dash Core] getDatasFiltroGlobal gerou datas: Inicio=${inicio.toISOString()}, Fim=${fim.toISOString()}`);
    return { inicio, fim, valorBruto: tipo };
};

window.renderizarPatioManutencaoDash = function() {
    const container = document.getElementById('patioManutencaoDashContainer');
    if (!container) {
        console.error('[Dash Core ERRO] DOM: Elemento "patioManutencaoDashContainer" NÃO ENCONTRADO!');
        return;
    }

    if (!window.ordensServico || window.ordensServico.length === 0) {
        console.warn('[Dash Core] Pátio Manutenção: Nenhuma Ordem de Serviço carregada (array vazio).');
        container.innerHTML = '<p style="color:#94a3b8; text-align:center;">Aguardando dados de Ordem de Serviço...</p>';
        return;
    }

    // Prevenção de quebra por case sensitive ou espaços (ex: " Ativo", "ATIVO")
    let cavalosValidos = [];
    if (window.frotasManutencao) {
        cavalosValidos = window.frotasManutencao
            .filter(f => (f.status || '').toUpperCase() === 'ATIVO' && (f.categoria || '').toUpperCase() === 'TRITREM')
            .map(f => (f.cavalo || '').trim());
    }

    const osAtivas = window.ordensServico.filter(o => {
        const placaOs = (o.placa || '').trim();
        if (!placaOs || !cavalosValidos.includes(placaOs)) return false;
        if (o.tipo === 'Sinistro' || o.tipo === 'Cavalo Disponível S/ Carreta') return false;
        
        const st = (o.status || '').toUpperCase();
        return (st === 'AGUARDANDO OFICINA' || st === 'EM MANUTENÇÃO' || st === 'EM MANUTENCAO');
    });

    console.log(`[Dash Core] Pátio Manutenção: ${osAtivas.length} OS ativas encontradas no pátio.`);

    if (osAtivas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #10b981; font-size: 2rem; margin: 0;">PÁTIO VAZIO <i class="fas fa-check-circle"></i></h2>
                <p style="color: #94a3b8; font-size: 1.1rem; margin-top: 10px;">Nenhum veículo aguardando manutenção no momento.</p>
            </div>
        `;
        return;
    }

    osAtivas.sort((a, b) => {
        const pesoPri = { 'Urgente': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };
        const pA = pesoPri[a.prioridade] || 0;
        const pB = pesoPri[b.prioridade] || 0;
        if (pA !== pB) return pB - pA;
        return new Date(a.data_abertura) - new Date(b.data_abertura);
    });

    const agora = new Date();

    container.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">` + osAtivas.map(os => {
        let corPrioridade = '#3b82f6';
        if (os.prioridade === 'Urgente') corPrioridade = '#ef4444';
        else if (os.prioridade === 'Alta') corPrioridade = '#f97316';
        else if (os.prioridade === 'Baixa') corPrioridade = '#10b981';

        let diffHrs = 0, diffMin = 0;
        let entradaHoraStr = '--:--';

        if (os.data_abertura) {
            const inicio = new Date(os.data_abertura.replace('Z', '').replace('+00:00', ''));
            const diffMs = agora - inicio;
            if(diffMs > 0) {
                diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            }
            entradaHoraStr = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        let colorCronometro = '#fff', piscarAnimacao = '';
        if (diffHrs >= 24) { colorCronometro = '#ef4444'; piscarAnimacao = 'animation: piscar 1.5s infinite;'; }
        else if (diffHrs >= 12) { colorCronometro = '#f59e0b'; }

        const placaTrimmed = (os.placa || '').trim();
        const frotaVinculada = (window.frotasManutencao || []).find(f => (f.cavalo || '').trim() === placaTrimmed) || {};
        
        let conjuntosBadge = '';
        if (frotaVinculada.numero_frota && String(frotaVinculada.numero_frota).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(245, 158, 11, 0.5); font-weight: bold; white-space: nowrap;">FR: ${String(frotaVinculada.numero_frota).toUpperCase()}</span>`;
        }
        if (frotaVinculada.go && String(frotaVinculada.go).trim() !== '') {
            conjuntosBadge += `<span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(59, 130, 246, 0.5); font-weight: bold; white-space: nowrap;">GO: ${String(frotaVinculada.go).toUpperCase()}</span>`;
        }
        conjuntosBadge += [frotaVinculada.carreta1, frotaVinculada.carreta2, frotaVinculada.carreta3]
            .filter(Boolean)
            .map(c => `<span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;">${c}</span>`)
            .join('');

        const statusLower = (os.status || '').toLowerCase();
        const textoStatus = (statusLower === 'em manutenção' || statusLower === 'em manutencao') ? 'EM OFICINA' : 'AGUARDANDO ATENDIMENTO';
        const bgStatus = (statusLower === 'em manutenção' || statusLower === 'em manutencao') ? '#1e3a8a' : '#1e293b';
        const borderStatus = (statusLower === 'em manutenção' || statusLower === 'em manutencao') ? '#3b82f6' : '#475569';
        
        const numeroOsFormatado = os.numero_os ? os.numero_os : os.id;

        return `
            <div style="background: ${bgStatus}; border: 2px solid ${borderStatus}; border-radius: 12px; padding: 18px; box-shadow: 0 6px 15px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 2px; font-weight: 600;">O.S. #${numeroOsFormatado} | ${textoStatus}</div>
                        <div style="font-size: 2.2rem; font-weight: 900; color: #fff; line-height: 1.1; letter-spacing: 1px;">${placaTrimmed}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${corPrioridade}; color: #fff; font-weight: bold; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; text-transform: uppercase;">
                            ${os.prioridade || 'NORMAL'}
                        </div>
                    </div>
                </div>
                <div style="margin-bottom: 12px; min-height: 22px; display: flex; gap: 6px; flex-wrap: nowrap; overflow: hidden; align-items: center; width: 100%;">${conjuntosBadge}</div>
                
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; margin-bottom: 15px; flex: 1;">
                    <div style="color: #60a5fa; font-weight: 800; font-size: 0.95rem; margin-bottom: 6px;">${os.tipo || 'Não especificado'}</div>
                    <div style="color: #cbd5e1; font-size: 0.85rem;">Motorista: <strong style="color: #fff;">${os.motorista || '-'}</strong></div>
                    <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${os.problema || os.observacoes || 'Nenhum detalhe'}">
                        Detalhe: ${os.problema || os.observacoes || 'Nenhum detalhe'}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
                    <div style="color: #94a3b8; font-size: 0.85rem;">
                        Entrada: <br><strong style="color: #fff; font-size: 1.1rem;">${entradaHoraStr}</strong>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.7rem; color: #94a3b8; font-weight: bold; letter-spacing: 1px;">TEMPO NO PÁTIO</div>
                        <div style="font-size: 1.8rem; font-weight: 900; color: ${colorCronometro}; font-family: monospace; ${piscarAnimacao}">
                            ${String(diffHrs).padStart(2,'0')}:${String(diffMin).padStart(2,'0')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') + `</div>`;
};

window.atualizarKPIsGlobais = function() {
    try {
        if (!window.ordensServico || !window.frotasManutencao) {
            console.warn('[Dash Core] atualizarKPIsGlobais cancelado: dados não prontos.');
            return;
        }

        let cavalosValidos = window.frotasManutencao
            .filter(f => (f.status || '').toUpperCase() === 'ATIVO' && (f.categoria || '').toUpperCase() === 'TRITREM')
            .map(f => (f.cavalo || '').trim());

        const datas = typeof window.getDatasFiltroGlobal === 'function' ? window.getDatasFiltroGlobal() : { inicio: new Date(), fim: new Date() };
        const inicio = datas.inicio;
        const fim = datas.fim;
        
        let totalOS = 0, abertasOS = 0, concluidasOS = 0, msTotalTempo = 0, osComTempo = 0;
        
        window.ordensServico.forEach(os => {
            const placaOs = (os.placa || '').trim();
            if (!placaOs || !cavalosValidos.includes(placaOs)) return;
            if (os.status === 'Agendada' || os.tipo === 'Cavalo Disponível S/ Carreta') return;
            
            let osInicioStr = os.data_abertura;
            if (!osInicioStr) return;
            if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
            const dtAbertura = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
            let dtConclusao = new Date();
            
            if (os.data_conclusao) {
                let osFimStr = os.data_conclusao;
                if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                dtConclusao = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
            }
            
            if (dtAbertura <= fim && dtConclusao >= inicio) {
                totalOS++;
                const statusUpper = (os.status || '').toUpperCase();
                if (statusUpper === 'CONCLUÍDA' || statusUpper === 'CONCLUIDA' || statusUpper === 'RESOLVIDO') {
                    concluidasOS++;
                    if (dtAbertura && os.data_conclusao) { 
                        msTotalTempo += (dtConclusao - dtAbertura);
                        osComTempo++;
                    }
                } else {
                    abertasOS++;
                }
            }
        });
        
        let taxaConclusao = totalOS > 0 ? ((concluidasOS / totalOS) * 100).toFixed(1) : 0;
        let tempoMedioStr = '0h 0m';
        if (osComTempo > 0) {
            let mediaMs = msTotalTempo / osComTempo;
            let mediaHoras = Math.floor(mediaMs / (1000 * 60 * 60));
            let mediaMinutos = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            tempoMedioStr = `${mediaHoras}h ${mediaMinutos}m`;
        }
        
        console.log(`[Dash Core] KPIs Calculados: Total=${totalOS}, Abertas=${abertasOS}, Concluídas=${concluidasOS}`);

        const elKpiTotal = document.getElementById('kpiTotalOS');
        const elKpiAbertas = document.getElementById('kpiAbertasOS');
        const elKpiConcluidas = document.getElementById('kpiConcluidasOS');
        const elKpiTaxa = document.getElementById('kpiTaxaOS');
        const elKpiTempo = document.getElementById('kpiTempoMedioOS');

        if(elKpiTotal) elKpiTotal.innerText = totalOS;
        if(elKpiAbertas) elKpiAbertas.innerText = abertasOS; 
        if(elKpiConcluidas) elKpiConcluidas.innerText = concluidasOS; 
        if(elKpiTaxa) elKpiTaxa.innerText = taxaConclusao + '%'; 
        if(elKpiTempo) elKpiTempo.innerText = tempoMedioStr; 
        
        let frotasValidas = window.frotasManutencao.filter(f => (f.status || '').toUpperCase() === 'ATIVO' && (f.categoria || '').toUpperCase() === 'TRITREM');
        if (frotasValidas.length === 0) return;
        
        let fimParaCalculo = fim > new Date() ? new Date() : fim;
        let msTotalPeriodo = fimParaCalculo - inicio;
        if (msTotalPeriodo <= 0) msTotalPeriodo = 1;
        
        let msManutencaoComum = 0, msSOS = 0, totalMsDisponivelPeriodo = 0;
        
        frotasValidas.forEach(frota => {
            let frotaInicioStr = frota.data_inicial ? frota.data_inicial : '2026-04-01';
            let dtEntradaVeiculo = new Date(frotaInicioStr + 'T00:00:00');
            const cavaloFrota = (frota.cavalo || '').trim();
            
            let overlapDispInicio = dtEntradaVeiculo > inicio ? dtEntradaVeiculo : inicio;
            if (overlapDispInicio < fimParaCalculo) {
                totalMsDisponivelPeriodo += (fimParaCalculo - overlapDispInicio);
            }
            
            const todasOSCavalo = window.ordensServico.filter(o => (o.placa || '').trim() === cavaloFrota && o.status !== 'Agendada' && o.tipo !== 'Cavalo Disponível S/ Carreta');
            todasOSCavalo.forEach(os => {
                let osInicioStr = os.data_abertura;
                if (!osInicioStr) return;
                if (!osInicioStr.includes('T')) osInicioStr += 'T00:00:00';
                const osInicio = new Date(osInicioStr.replace('Z', '').replace('+00:00', ''));
                
                let osFim = new Date(); 
                if (os.data_conclusao) {
                    let osFimStr = os.data_conclusao;
                    if (!osFimStr.includes('T')) osFimStr += 'T00:00:00';
                    osFim = new Date(osFimStr.replace('Z', '').replace('+00:00', ''));
                }
                
                let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                let overlapInicio = inicioValido > inicio ? inicioValido : inicio;
                const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;
                
                if (overlapInicio < overlapFim) {
                    const tempoParado = overlapFim - overlapInicio;
                    const tipoOS = (os.tipo || '').toUpperCase();
                    const descOS = (os.problema || os.observacoes || '').toUpperCase();
                    const prioridadeOS = (os.prioridade || '').toUpperCase();

                    if (tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') || descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') || prioridadeOS.includes('EMERGÊNCIA')) {
                        msSOS += tempoParado;
                    } else {
                        msManutencaoComum += tempoParado;
                    }
                }
            });
        });
        
        let msManutTotal = msManutencaoComum + msSOS;
        let dispNoPeriodoMs = totalMsDisponivelPeriodo - msManutTotal;
        if (dispNoPeriodoMs < 0) dispNoPeriodoMs = 0;
        
        const mediaAtivosReal = Math.round(dispNoPeriodoMs / msTotalPeriodo);
        const mediaManutReal = Math.round(msManutencaoComum / msTotalPeriodo);
        const mediaSOSReal = Math.round(msSOS / msTotalPeriodo);
        const percentDMReal = totalMsDisponivelPeriodo > 0 ? (dispNoPeriodoMs / totalMsDisponivelPeriodo) * 100 : 100;
        
        const elAvgDM = document.getElementById('avgDM');
        const elAvgAtivos = document.getElementById('avgAtivos');
        const elAvgManut = document.getElementById('avgManut');
        const elAvgSOS = document.getElementById('avgSOS');
        
        if(elAvgDM) elAvgDM.innerText = percentDMReal.toFixed(1) + '%';
        if(elAvgAtivos) elAvgAtivos.innerText = mediaAtivosReal;
        if(elAvgManut) elAvgManut.innerText = mediaManutReal;
        if(elAvgSOS) elAvgSOS.innerText = mediaSOSReal;

    } catch(e) {
        console.error("[Dash Core ERRO CRÍTICO] Erro ao atualizar KPIs Globais:", e);
    }
};

window.initDashManutencao = function() {
    console.log('[Dash Core] Iniciando initDashManutencao...');
    if (!document.getElementById('css-animacao-piscar')) {
        var animacaoCss = document.createElement('style');
        animacaoCss.id = 'css-animacao-piscar';
        animacaoCss.innerHTML = `@keyframes piscar { 0% { opacity: 1; } 50% { opacity: 0.4; color: #fca5a5; } 100% { opacity: 1; } }`;
        document.head.appendChild(animacaoCss);
    }

    if (typeof window.carregarDadosManutencao === 'function') {
        window.carregarDadosManutencao().then(() => {
            setTimeout(() => {
                console.log('[Dash Core] Dados carregados, disparando filtros iniciais.');
                if (typeof window.dispararFiltrosGlobais === 'function') window.dispararFiltrosGlobais();
                if(document.getElementById('data-mural-setor')) {
                    document.getElementById('data-mural-setor').value = new Date().toISOString().split('T')[0];
                }
                if (typeof window.carregarMuralSetor === 'function') window.carregarMuralSetor();
            }, 300);
        });
    } else {
        console.warn('[Dash Core] Função window.carregarDadosManutencao não encontrada! Certifique-se que o painel OS está carregado.');
    }

    if (window.intervaloCronometroPatio) clearInterval(window.intervaloCronometroPatio);
    window.intervaloCronometroPatio = setInterval(() => {
        if (typeof window.renderizarPatioManutencaoDash === 'function') {
            window.renderizarPatioManutencaoDash();
        }
    }, 60000);
};

// Intervalos Globais
setInterval(() => {
    if (typeof window.frotasManutencao === 'undefined' || window.frotasManutencao.length === 0) return;
    
    if (typeof window.preencherMesesDMDiaria === 'function') window.preencherMesesDMDiaria();
    
    const chartDomDiaria = document.getElementById('graficoEvolucaoDMDiaria');
    if (chartDomDiaria && chartDomDiaria.offsetWidth > 0 && !chartDomDiaria.getAttribute('data-rendered')) {
        chartDomDiaria.setAttribute('data-rendered', 'true');
        if (typeof window.renderizarGraficoEvolucaoDMDiaria === 'function') window.renderizarGraficoEvolucaoDMDiaria();
    }
    
    const chartDomBarras = document.getElementById('graficoStatusFrotaHorario');
    if (chartDomBarras && chartDomBarras.offsetWidth > 0 && !chartDomBarras.getAttribute('data-rendered')) {
        chartDomBarras.setAttribute('data-rendered', 'true');
        if (typeof window.renderizarGraficoStatusFrotaHorario === 'function') window.renderizarGraficoStatusFrotaHorario();
    }
    
    const elKpi = document.getElementById('kpiTotalOS');
    if (elKpi && !elKpi.getAttribute('data-rendered')) {
        elKpi.setAttribute('data-rendered', 'true');
        if (typeof window.atualizarKPIsGlobais === 'function') window.atualizarKPIsGlobais();
    }
}, 1000);

setInterval(() => {
    if (typeof window.atualizarKPIsGlobais === 'function') window.atualizarKPIsGlobais();
    const chartDomBarras = document.getElementById('graficoStatusFrotaHorario');
    if (chartDomBarras && chartDomBarras.offsetWidth > 0 && typeof window.renderizarGraficoStatusFrotaHorario === 'function') {
        window.renderizarGraficoStatusFrotaHorario();
    }
}, 60000);