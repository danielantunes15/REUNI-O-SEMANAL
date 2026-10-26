// =================================================================
// ARQUIVO: js/dash_manutencao_graficos.js
// RESPONSABILIDADE: Gráficos Echarts, Tabelas de Relatórios, Ranking
// =================================================================
console.log('[Dash Graficos] Inicializando dash_manutencao_graficos.js');

window.renderizarGraficoStatusFrotaHorario = function() {
    try {
        console.log('[Dash Graficos] Iniciando renderizarGraficoStatusFrotaHorario');
        if (!window.frotasManutencao || window.frotasManutencao.length === 0) return;

        let frotasValidas = window.frotasManutencao.filter(f => (f.status || '').toUpperCase() === 'ATIVO' && f.categoria && f.categoria.toUpperCase() === 'TRITREM');
        if (frotasValidas.length === 0) return;
        
        const agora = new Date();
        let dataBase = new Date(); 
        let ehHoje = true;

        const datasGlobais = typeof window.getDatasFiltroGlobal === 'function' ? window.getDatasFiltroGlobal() : null;
        const inputData = document.getElementById('filtroDataEspecificaHoraria');

        if (datasGlobais && inputData && (!inputData.value || window.ultimoFiltroGlobalHorario !== window.filtroGlobalAtual)) {
            dataBase = new Date(datasGlobais.inicio);
            window.ultimoFiltroGlobalHorario = window.filtroGlobalAtual;
            
            const mesStr = String(dataBase.getMonth() + 1).padStart(2, '0');
            const diaStr = String(dataBase.getDate()).padStart(2, '0');
            inputData.value = `${dataBase.getFullYear()}-${mesStr}-${diaStr}`;
        } else if (inputData && inputData.value) {
            const partesData = inputData.value.split('-');
            if(partesData.length === 3) {
                dataBase = new Date(partesData[0], partesData[1] - 1, partesData[2]);
            }
        }
        
        ehHoje = (dataBase.getDate() === agora.getDate() && dataBase.getMonth() === agora.getMonth() && dataBase.getFullYear() === agora.getFullYear());
        
        const labelsX = [], dadosBarraAtivos = [], dadosBarraManut = [], dadosBarraSOS = [];
        let horaLimite = ehHoje ? agora.getHours() : 23;

        for (let i = 0; i <= horaLimite; i++) {
            const inicioHora = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), i, 0, 0, 0);
            const fimHora = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), i, 59, 59, 999);
            
            let qtdFrotaAtivaHora = 0, qtdEmManutencao = 0, qtdEmSOS = 0;
            
            frotasValidas.forEach(frota => {
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial.split('T')[0] : '2026-04-01';
                let parts = frotaInicioStr.split('-');
                let dtEntradaVeiculo = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);

                if (dtEntradaVeiculo > fimHora) return; 
                qtdFrotaAtivaHora++;
                
                let teveManutencaoComum = false, teveSOS = false;
                const placaFrotaNorm = (frota.cavalo || frota.placa || frota.placa_cavalo || '').trim().toUpperCase().replace(/-/g, '');

                const todasOSCavalo = window.ordensServico.filter(o => {
                    let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
                    if (isOSInativa) return false;
                    const placaOS = (o.placa || o.placa_cavalo || o.veiculo || o.cavalo || '').trim().toUpperCase().replace(/-/g, '');
                    return placaOS === placaFrotaNorm && o.tipo !== 'Cavalo Disponível S/ Carreta' && o.status !== 'Agendada' && o.status !== 'Cancelada';
                });
                
                todasOSCavalo.forEach(os => {
                    let dtAbertura = os.data_abertura ? window.tratarFusoDB(os.data_abertura) : null;
                    let dtInicioM = os.data_inicio_manutencao ? window.tratarFusoDB(os.data_inicio_manutencao) : null;
                    let osInicio = dtAbertura || dtInicioM;
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.tratarFusoDB(os.data_conclusao) : agora;
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > inicioHora ? inicioValido : inicioHora;
                    const overlapFim = osFim < fimHora ? osFim : fimHora;

                    if (overlapInicio < overlapFim) {
                        const tipoOS = (os.tipo || os.tipo_manutencao || '').toUpperCase();
                        const descOS = (os.descricao || os.observacoes || os.problema || '').toUpperCase();
                        const prioridadeOS = (os.prioridade || '').toUpperCase();

                        if (tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') || descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') || prioridadeOS.includes('EMERGÊNCIA')) {
                            teveSOS = true;
                        } else { teveManutencaoComum = true; }
                    }
                });
                if (teveSOS) { qtdEmSOS++; } else if (teveManutencaoComum) { qtdEmManutencao++; }
            });
            let qtdAtivos = qtdFrotaAtivaHora - qtdEmManutencao - qtdEmSOS;
            if (qtdAtivos < 0) qtdAtivos = 0;
            
            labelsX.push(`${String(i).padStart(2,'0')}:00`);
            dadosBarraAtivos.push(qtdAtivos); dadosBarraManut.push(qtdEmManutencao); dadosBarraSOS.push(qtdEmSOS);
        }

        let inicioDia = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), 0, 0, 0, 0);
        let fimDia = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), 23, 59, 59, 999);
        
        let msTotalDia = 24 * 60 * 60 * 1000;
        let fimParaCalculo = ehHoje ? agora : fimDia;
        if (ehHoje) {
            msTotalDia = agora - inicioDia;
            if (msTotalDia <= 0) msTotalDia = 1;
        }
        
        let totalMsDisponivelDia = 0, msManutencaoDia = 0, msSOSDia = 0;
        let totalManutDia = 0, totalSOSDia = 0;

        frotasValidas.forEach(frota => {
            let frotaInicioStr = frota.data_inicial ? frota.data_inicial.split('T')[0] : '2026-04-01';
            let parts = frotaInicioStr.split('-');
            let dtEntradaVeiculo = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);
            
            let overlapDispInicio = dtEntradaVeiculo > inicioDia ? dtEntradaVeiculo : inicioDia;
            let tempoDisp = 0;
            if (overlapDispInicio < fimParaCalculo) {
                tempoDisp = (fimParaCalculo - overlapDispInicio);
                totalMsDisponivelDia += tempoDisp;
            }

            const placaFrotaNorm = (frota.cavalo || frota.placa || frota.placa_cavalo || '').trim().toUpperCase().replace(/-/g, '');

            const todasOSCavalo = window.ordensServico.filter(o => {
                let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
                if (isOSInativa) return false;
                const placaOS = (o.placa || o.placa_cavalo || o.veiculo || o.cavalo || '').trim().toUpperCase().replace(/-/g, '');
                return placaOS === placaFrotaNorm && o.status !== 'Agendada' && o.status !== 'Cancelada' && o.tipo !== 'Cavalo Disponível S/ Carreta';
            });
            
            let intervalosManut = [];
            let intervalosSOS = [];

            todasOSCavalo.forEach(os => {
                let dtAbertura = os.data_abertura ? window.tratarFusoDB(os.data_abertura) : null;
                let dtInicioM = os.data_inicio_manutencao ? window.tratarFusoDB(os.data_inicio_manutencao) : null;
                let osInicio = dtAbertura || dtInicioM; 
                if (!osInicio) return;
                
                let osFim = os.data_conclusao ? window.tratarFusoDB(os.data_conclusao) : agora;
                
                let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                const overlapInicio = inicioValido > inicioDia ? inicioValido : inicioDia;
                const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;
                
                if (overlapInicio < overlapFim) { 
                    const tipoOS = (os.tipo || os.tipo_manutencao || '').toUpperCase();
                    const descOS = (os.descricao || os.observacoes || os.problema || '').toUpperCase();
                    const prioridadeOS = (os.prioridade || '').toUpperCase();
                    
                    if (tipoOS.includes('S.O.S') || tipoOS.includes('SOS') || tipoOS.includes('SOCORRO') || descOS.includes('S.O.S') || descOS.includes('SOS') || descOS.includes('SOCORRO') || prioridadeOS.includes('EMERGÊNCIA')) {
                        intervalosSOS.push([overlapInicio.getTime(), overlapFim.getTime()]);
                        totalSOSDia++;
                    } else { 
                        intervalosManut.push([overlapInicio.getTime(), overlapFim.getTime()]);
                        totalManutDia++;
                    }
                }
            });

            let tempoGastoManut = 0;
            if (intervalosManut.length > 0) {
                intervalosManut.sort((a,b) => a[0] - b[0]);
                let merged = [intervalosManut[0]];
                for (let i = 1; i < intervalosManut.length; i++) {
                    let last = merged[merged.length - 1];
                    let current = intervalosManut[i];
                    if (current[0] <= last[1]) last[1] = Math.max(last[1], current[1]);
                    else merged.push(current);
                }
                merged.forEach(iv => tempoGastoManut += (iv[1] - iv[0]));
            }

            let tempoGastoSOS = 0;
            if (intervalosSOS.length > 0) {
                intervalosSOS.sort((a,b) => a[0] - b[0]);
                let merged = [intervalosSOS[0]];
                for (let i = 1; i < intervalosSOS.length; i++) {
                    let last = merged[merged.length - 1];
                    let current = intervalosSOS[i];
                    if (current[0] <= last[1]) last[1] = Math.max(last[1], current[1]);
                    else merged.push(current);
                }
                merged.forEach(iv => tempoGastoSOS += (iv[1] - iv[0]));
            }

            msManutencaoDia += tempoGastoManut;
            msSOSDia += tempoGastoSOS;
        });

        let dispNoDiaMs = totalMsDisponivelDia - msManutencaoDia - msSOSDia;
        if (dispNoDiaMs < 0) dispNoDiaMs = 0;
        
        let kpiAtivosInt = totalMsDisponivelDia > 0 ? Math.round(dispNoDiaMs / msTotalDia) : 0;
        let kpiManutInt = totalManutDia; 
        let kpiSOSInt = totalSOSDia;     

        const elAvgAtivosInt = document.getElementById('avgAtivosInterno');
        const elAvgManutInt = document.getElementById('avgManutInterno');
        const elAvgSOSInt = document.getElementById('avgSOSInterno');

        if(elAvgAtivosInt) elAvgAtivosInt.innerText = kpiAtivosInt;
        
        if(elAvgManutInt) {
            elAvgManutInt.innerText = kpiManutInt;
            try {
                let lbl = elAvgManutInt.parentElement.previousElementSibling;
                if(lbl) lbl.innerText = 'TOTAL MANUTENÇÃO';
                let un = elAvgManutInt.nextElementSibling;
                if(un) un.innerText = 'ordens';
            } catch(e) {}
        }
        
        if(elAvgSOSInt) {
            elAvgSOSInt.innerText = kpiSOSInt;
            try {
                let lbl = elAvgSOSInt.parentElement.previousElementSibling;
                if(lbl) lbl.innerText = 'TOTAL S.O.S';
                let un = elAvgSOSInt.nextElementSibling;
                if(un) un.innerText = 'ordens';
            } catch(e) {}
        }

        if (typeof echarts === 'undefined') {
            console.error('[Dash Graficos ERRO] Biblioteca Echarts não encontrada!');
            return;
        }
        const chartDomBarras = document.getElementById('graficoStatusFrotaHorario');
        if (!chartDomBarras) {
            console.error('[Dash Graficos ERRO] Div id="graficoStatusFrotaHorario" não encontrada no HTML!');
            return;
        }

        let myChartBarras = echarts.getInstanceByDom(chartDomBarras);
        if (!myChartBarras) myChartBarras = echarts.init(chartDomBarras);
        const optionBarras = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['Disponível', 'Manutenção', 'SOS'], textStyle: { color: '#ffffff', fontWeight: 'bold' }, top: 0 },
            grid: { top: '15%', left: '3%', right: '3%', bottom: '5%', containLabel: true },
            xAxis: { type: 'category', data: labelsX, axisLabel: { color: '#ffffff', fontWeight: 'bold' } },
            yAxis: { type: 'value', name: 'Quantidade', nameTextStyle: { color: '#ffffff', fontWeight: 'bold' }, axisLabel: { color: '#ffffff' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
            series: [
                { name: 'Disponível', type: 'bar', itemStyle: { color: '#10b981' }, data: dadosBarraAtivos, label: { show: true, position: 'top', color: '#10b981', fontWeight: 'bold' } },
                { name: 'Manutenção', type: 'bar', itemStyle: { color: '#f59e0b' }, data: dadosBarraManut, label: { show: true, position: 'top', color: '#f59e0b', fontWeight: 'bold' } },
                { name: 'SOS', type: 'bar', itemStyle: { color: '#ef4444' }, data: dadosBarraSOS, label: { show: true, position: 'top', color: '#ef4444', fontWeight: 'bold' } }
            ]
        };
        myChartBarras.setOption(optionBarras);
        window.addEventListener('resize', () => myChartBarras.resize());
        console.log('[Dash Graficos] Gráfico Horário renderizado com sucesso.');
    } catch(e) { console.error("[Dash Graficos ERRO CRÍTICO] na DM Status Frota Horário:", e); }
};

window.preencherMesesDMDiaria = function() {
    const select = document.getElementById('filtroMesEvolucaoDMDiaria');
    if (!select || !window.ordensServico) return;

    let cavalosValidos = [];
    if (window.frotasManutencao) {
        cavalosValidos = window.frotasManutencao
            .filter(f => (f.status || '').toUpperCase() === 'ATIVO' && f.categoria && f.categoria.toUpperCase() === 'TRITREM')
            .map(f => (f.cavalo || '').trim().toUpperCase().replace(/-/g, ''));
    }

    const mesesDisponiveis = new Set();
    const hoje = new Date();
    const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    window.ordensServico.forEach(os => {
        let isOSInativa = (os.inativa === 1 || os.inativa === '1' || os.inativa === true);
        if (isOSInativa) return;
        
        const placaOs = (os.placa || os.placa_cavalo || os.veiculo || os.cavalo || '').trim().toUpperCase().replace(/-/g, '');
        if (!placaOs || !cavalosValidos.includes(placaOs)) return;
        
        if (os.data_abertura && os.status !== 'Agendada' && os.status !== 'Cancelada' && os.tipo !== 'Cavalo Disponível S/ Carreta') {
            const data = window.tratarFusoDB(os.data_abertura);
            if (data && !isNaN(data.getTime())) {
                const ano = data.getFullYear();
                const mes = String(data.getMonth() + 1).padStart(2, '0');
                mesesDisponiveis.add(`${ano}-${mes}`);
            }
        }
    });

    mesesDisponiveis.add(mesAtualKey); 
    const mesesOrdenados = Array.from(mesesDisponiveis).sort((a, b) => b.localeCompare(a)); 
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const optionsAtuais = Array.from(select.options).map(o => o.value).join(',');
    const novasOptions = mesesOrdenados.join(',');

    if (optionsAtuais !== novasOptions) {
        let html = '';
        mesesOrdenados.forEach(chave => {
            const [ano, mes] = chave.split('-');
            const nomeMes = nomesMeses[parseInt(mes) - 1];
            html += `<option value="${chave}" ${chave === mesAtualKey ? 'selected' : ''}>${nomeMes}/${ano.slice(2)}</option>`;
        });
        
        const valAnterior = select.value;
        select.innerHTML = html;
        if (valAnterior && mesesOrdenados.includes(valAnterior)) select.value = valAnterior;
    }
};

window.renderizarGraficoEvolucaoDMDiaria = function() {
    try {
        console.log('[Dash Graficos] Iniciando renderizarGraficoEvolucaoDMDiaria');
        if (!window.frotasManutencao || window.frotasManutencao.length === 0) return;

        let frotasValidas = window.frotasManutencao.filter(f => (f.status || '').toUpperCase() === 'ATIVO' && f.categoria && f.categoria.toUpperCase() === 'TRITREM');
        if (frotasValidas.length === 0) return;
        
        if (typeof window.preencherMesesDMDiaria === 'function') window.preencherMesesDMDiaria();

        const selectMes = document.getElementById('filtroMesEvolucaoDMDiaria');
        let dataInicio, hoje;

        if (selectMes && selectMes.value) {
            const [ano, mes] = selectMes.value.split('-');
            dataInicio = new Date(parseInt(ano), parseInt(mes) - 1, 1, 0, 0, 0);
            hoje = new Date(parseInt(ano), parseInt(mes), 0, 23, 59, 59, 999);
            const agora = new Date();
            if (dataInicio.getFullYear() === agora.getFullYear() && dataInicio.getMonth() === agora.getMonth()) hoje = agora;
        } else {
            const datasFiltro = typeof window.getDatasFiltroGlobal === 'function' ? window.getDatasFiltroGlobal() : { inicio: new Date(), fim: new Date() };
            dataInicio = new Date(datasFiltro.inicio);
            hoje = new Date(datasFiltro.fim);
        }

        const labelsDias = [], dadosDMDiaria = [];
        let atual = new Date(dataInicio);
        
        let sumPercentDM = 0;
        let countDiasDM = 0;

        while (atual <= hoje) {
            const inicioDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 0, 0, 0);
            const fimDia = new Date(atual.getFullYear(), atual.getMonth(), atual.getDate(), 23, 59, 59, 999);
            
            let msTotalDia = 24 * 60 * 60 * 1000;
            let fimParaCalculo = fimDia;
            if (atual.toDateString() === new Date().toDateString()) {
                const agora = new Date();
                msTotalDia = agora - inicioDia;
                fimParaCalculo = agora;
                if (msTotalDia <= 0) msTotalDia = 1;
            }

            if (msTotalDia > 0) {
                let totalMsDisponivelDia = 0, msManutencaoDia = 0;
                let frotaCountCalculada = 0;
                
                frotasValidas.forEach(frota => {
                    let frotaInicioStr = frota.data_inicial ? frota.data_inicial.split('T')[0] : '2026-04-01';
                    let parts = frotaInicioStr.split('-');
                    let dtEntradaVeiculo = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);
                    
                    let overlapDispInicio = dtEntradaVeiculo > inicioDia ? dtEntradaVeiculo : inicioDia;
                    if (overlapDispInicio < fimParaCalculo) {
                        totalMsDisponivelDia += (fimParaCalculo - overlapDispInicio);
                        frotaCountCalculada++;
                    }

                    const placaFrotaNorm = (frota.cavalo || frota.placa || frota.placa_cavalo || '').trim().toUpperCase().replace(/-/g, '');
                    let manutencaoIntervals = [];

                    const todasOSCavalo = window.ordensServico.filter(o => {
                        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
                        if (isOSInativa) return false;
                        const placaOS = (o.placa || o.placa_cavalo || o.veiculo || o.cavalo || '').trim().toUpperCase().replace(/-/g, '');
                        return placaOS === placaFrotaNorm && o.status !== 'Agendada' && o.status !== 'Cancelada' && o.tipo !== 'Cavalo Disponível S/ Carreta';
                    });
                    
                    todasOSCavalo.forEach(os => {
                        let dtAbertura = os.data_abertura ? window.tratarFusoDB(os.data_abertura) : null;
                        let dtInicioM = os.data_inicio_manutencao ? window.tratarFusoDB(os.data_inicio_manutencao) : null;
                        let osInicio = dtAbertura || dtInicioM; 
                        if (!osInicio) return;
                        
                        let osFim = os.data_conclusao ? window.tratarFusoDB(os.data_conclusao) : new Date(); 
                        
                        let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                        const overlapInicio = inicioValido > inicioDia ? inicioValido : inicioDia;
                        const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;
                        
                        if (overlapInicio < overlapFim) { 
                            manutencaoIntervals.push([overlapInicio.getTime(), overlapFim.getTime()]);
                        }
                    });

                    let manutencaoCavalo = 0;
                    if (manutencaoIntervals.length > 0) {
                        manutencaoIntervals.sort((a,b) => a[0] - b[0]);
                        let merged = [manutencaoIntervals[0]];
                        for (let i = 1; i < manutencaoIntervals.length; i++) {
                            let last = merged[merged.length - 1];
                            let current = manutencaoIntervals[i];
                            if (current[0] <= last[1]) last[1] = Math.max(last[1], current[1]);
                            else merged.push(current);
                        }
                        merged.forEach(iv => manutencaoCavalo += (iv[1] - iv[0]));
                    }

                    msManutencaoDia += manutencaoCavalo;
                });

                let dispNoDiaMs = totalMsDisponivelDia - msManutencaoDia;
                if (dispNoDiaMs < 0) dispNoDiaMs = 0;
                
                let percentDM = totalMsDisponivelDia > 0 ? (dispNoDiaMs / totalMsDisponivelDia) * 100 : 100;
                let mediaCavalosDisp = msTotalDia > 0 ? Math.round(dispNoDiaMs / msTotalDia) : 0;
                
                const diaStr = String(atual.getDate()).padStart(2, '0') + '/' + String(atual.getMonth() + 1).padStart(2, '0');
                labelsDias.push(diaStr);
                
                sumPercentDM += percentDM;
                countDiasDM++;

                dadosDMDiaria.push({ value: percentDM.toFixed(2), disp: mediaCavalosDisp, total: frotaCountCalculada });
            }
            atual.setDate(atual.getDate() + 1);
        }

        let mediaDMPeriodo = countDiasDM > 0 ? (sumPercentDM / countDiasDM).toFixed(1) : 0;
        let miniTotalOS = 0, miniConcluidas = 0, miniTempoMs = 0, miniOsComTempo = 0;

        if (window.ordensServico) {
            let cavalosValidos = frotasValidas.map(f => (f.cavalo || f.placa || f.placa_cavalo || '').trim().toUpperCase().replace(/-/g, ''));
            window.ordensServico.forEach(os => {
                let isOSInativa = (os.inativa === 1 || os.inativa === '1' || os.inativa === true);
                if (isOSInativa) return;

                const placaOS = (os.placa || os.placa_cavalo || os.veiculo || os.cavalo || '').trim().toUpperCase().replace(/-/g, '');
                if (!placaOS || !cavalosValidos.includes(placaOS)) return;
                if (os.status === 'Agendada' || os.status === 'Cancelada' || os.tipo === 'Cavalo Disponível S/ Carreta') return;
                
                let dtAbertura = os.data_abertura ? window.tratarFusoDB(os.data_abertura) : null;
                if (!dtAbertura) return;
                
                let dtConclusao = os.data_conclusao ? window.tratarFusoDB(os.data_conclusao) : new Date();
                
                if (dtAbertura <= hoje && dtConclusao >= dataInicio) {
                    miniTotalOS++;
                    const st = (os.status || '').toUpperCase();
                    if (st === 'CONCLUÍDA' || st === 'CONCLUIDA' || st === 'RESOLVIDO') {
                        miniConcluidas++;
                        if (os.data_abertura && os.data_conclusao) {
                            miniTempoMs += (dtConclusao - dtAbertura);
                            miniOsComTempo++;
                        }
                    }
                }
            });
        }

        let miniTempoStr = '0h 0m';
        if (miniOsComTempo > 0) {
            let medMs = miniTempoMs / miniOsComTempo;
            let h = Math.floor(medMs / (1000 * 60 * 60));
            let m = Math.floor((medMs % (1000 * 60 * 60)) / (1000 * 60));
            miniTempoStr = `${h}h ${m}m`;
        }

        const elMiniDM = document.getElementById('kpiMiniDM');
        const elMiniTotalOS = document.getElementById('kpiMiniTotalOS');
        const elMiniConcluidas = document.getElementById('kpiMiniConcluidas');
        const elMiniTempo = document.getElementById('kpiMiniTempo');

        if(elMiniDM) elMiniDM.innerText = mediaDMPeriodo + '%';
        if(elMiniTotalOS) elMiniTotalOS.innerText = miniTotalOS;
        if(elMiniConcluidas) elMiniConcluidas.innerText = miniConcluidas;
        if(elMiniTempo) elMiniTempo.innerText = miniTempoStr;

        if (typeof echarts === 'undefined') return;
        const chartDom = document.getElementById('graficoEvolucaoDMDiaria');
        if (!chartDom) { console.error('[Dash Graficos ERRO] Div id="graficoEvolucaoDMDiaria" não encontrada!'); return; }

        let myChart = echarts.getInstanceByDom(chartDom);
        if (!myChart) myChart = echarts.init(chartDom);
        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: labelsDias, axisLabel: { color: '#ffffff', fontWeight: 'bold' } },
            yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%', color: '#ffffff', fontWeight: 'bold' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
            series: [{
                name: 'Média DM Diária', type: 'line', data: dadosDMDiaria, smooth: true, symbol: 'circle', symbolSize: 8,
                label: { show: true, position: 'top', formatter: (params) => `${params.data.disp}/${params.data.total}\n(${params.data.value}%)`, color: '#ffffff', fontSize: 14, fontWeight: '900', align: 'center', lineHeight: 18, textBorderColor: 'rgba(0, 0, 0, 0.8)', textBorderWidth: 3 },
                itemStyle: { color: '#10b981' }, lineStyle: { width: 4 },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(16, 185, 129, 0.4)' }, { offset: 1, color: 'rgba(16, 185, 129, 0)' }]) }
            }]
        };
        myChart.setOption(option);
        window.removeEventListener('resize', myChart.resize);
        window.addEventListener('resize', () => myChart.resize());
        console.log('[Dash Graficos] Gráfico de Evolução DM Diária renderizado.');

    } catch(e) { console.error("[Dash Graficos ERRO CRÍTICO] na Evolução Diária Geral:", e); }
};


// =========================================================================
// NOVO: RANKING EXCLUSIVO DO MÊS ATUAL COM MODAL DE DETALHES DA PLACA
// =========================================================================
window.renderizarRankingCavalos = function() {
    const container = document.getElementById('rankingCavalosOS');
    if(!container) { console.warn('[Dash Graficos] Div id="rankingCavalosOS" não encontrada.'); return; }

    const os = window.ordensServico || [];
    
    // Força o período para o início e fim do mês vigente (independente do filtro global da tela)
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const contagem = {};

    os.forEach(o => {
        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
        if (isOSInativa) return;
        if (!o.placa) return;
        if (o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
        
        let dtAbertura = o.data_abertura ? window.tratarFusoDB(o.data_abertura) : null;
        if(!dtAbertura) return;
        
        // Verifica se a O.S. está dentro do mês atual
        if(dtAbertura >= inicioMes && dtAbertura <= fimMes) {
            const placaFormatada = String(o.placa).trim().toUpperCase();
            contagem[placaFormatada] = (contagem[placaFormatada] || 0) + 1;
        }
    });

    const top5 = Object.entries(contagem).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    if(top5.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 20px;">Nenhuma ocorrência neste mês vigente.</p>';
        return;
    }

    container.innerHTML = top5.map((item, index) => {
        const placa = item[0], qtd = item[1];
        let cor = index === 0 ? '#ef4444' : index === 1 ? '#f97316' : index === 2 ? '#facc15' : '#3b82f6';
        
        // Transformamos o card em clicável para abrir o modal de histórico
        return `
        <div onclick="abrirModalHistoricoPlaca('${placa}')" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 12px 15px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid ${cor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'" title="Clique para ver todas as O.S. deste veículo no mês">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem; font-weight: bold; color: ${cor};">#${index+1}</span>
                <span style="font-size: 1.1rem; font-weight: bold; color: white;">${placa}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 1.2rem; font-weight: 900; color: white;">${qtd} <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8;">O.S.</span></div>
                <i class="fas fa-search-plus" style="color: ${cor}; opacity: 0.7;"></i>
            </div>
        </div>`;
    }).join('');
};

window.abrirModalHistoricoPlaca = function(placaBusca) {
    const os = window.ordensServico || [];
    
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Filtra todas as O.S deste caminhão no mês atual
    const historicoPlaca = os.filter(o => {
        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
        if (isOSInativa) return false;
        
        const p = String(o.placa || o.placa_cavalo || o.veiculo || o.cavalo || '').trim().toUpperCase();
        if (p !== placaBusca) return false;
        if (o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return false;
        
        let dtAbertura = o.data_abertura ? window.tratarFusoDB(o.data_abertura) : null;
        if(!dtAbertura) return false;
        
        return (dtAbertura >= inicioMes && dtAbertura <= fimMes);
    }).sort((a, b) => window.tratarFusoDB(b.data_abertura) - window.tratarFusoDB(a.data_abertura)); // Mais recentes primeiro

    let htmlTabela = '';
    
    if (historicoPlaca.length === 0) {
        htmlTabela = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum dado encontrado para esta placa no mês atual.</td></tr>';
    } else {
        htmlTabela = historicoPlaca.map(o => {
            let dataStr = '--/--/----';
            if (o.data_abertura) {
                const dt = window.tratarFusoDB(o.data_abertura);
                dataStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')} - ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            }
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1);">
                    <td style="padding: 12px; color: #fff; font-weight: bold; white-space: nowrap;">#${o.numero_os || o.id}</td>
                    <td style="padding: 12px; color: #94a3b8;">${dataStr}</td>
                    <td style="padding: 12px; color: #3b82f6; font-weight: bold;">${o.tipo || 'Não Definido'}</td>
                    <td style="padding: 12px; color: #cbd5e1; font-size: 0.85rem;">${o.problema || o.observacoes || 'Sem descrição.'}</td>
                </tr>
            `;
        }).join('');
    }

    const modalHtml = `
        <div id="modalRankingPlaca" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e293b; border: 1px solid #3b82f6; border-radius: 12px; width: 90%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(59,130,246,0.1); border-radius: 12px 12px 0 0;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-truck-monster" style="color: #3b82f6;"></i> Histórico de O.S. no Mês Atual - <span style="color: #3b82f6; font-weight: 900; font-size: 1.4rem;">${placaBusca}</span>
                    </h3>
                    <button onclick="document.getElementById('modalRankingPlaca').remove()" style="background: transparent; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1;" class="custom-scrollbar">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="background: rgba(0,0,0,0.3);">
                            <tr>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Nº O.S</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Abertura</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Classificação</th>
                                <th style="padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; font-weight: bold;">Descrição do Problema</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlTabela}
                        </tbody>
                    </table>
                </div>
                
            </div>
        </div>
    `;

    // Injeta o modal no body (se já houver um, remove antes)
    const modalAntigo = document.getElementById('modalRankingPlaca');
    if (modalAntigo) modalAntigo.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};


window.renderizarOcorrenciasTipoBarra = function() {
    const container = document.getElementById('graficoOcorrenciasTipoBarra');
    if(!container || typeof echarts === 'undefined') { console.warn('[Dash Graficos] Div id="graficoOcorrenciasTipoBarra" não encontrada ou echarts indisponível.'); return; }

    const os = window.ordensServico || [];
    const { inicio, fim } = window.getDatasFiltroGlobal();
    const contagem = {};

    os.forEach(o => {
        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
        if (isOSInativa) return;
        if (!o.placa) return;
        if (o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;

        let dtAbertura = o.data_abertura ? window.tratarFusoDB(o.data_abertura) : null;
        if(!dtAbertura) return;
        
        if(dtAbertura >= inicio && dtAbertura <= fim) {
            const tipo = o.tipo || 'Outros';
            contagem[tipo] = (contagem[tipo] || 0) + 1;
        }
    });

    const keys = Object.keys(contagem).sort((a,b) => contagem[a] - contagem[b]); 
    const values = keys.map(k => contagem[k]);

    let myChart = echarts.getInstanceByDom(container) || echarts.init(container);
    myChart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: '10%', left: '3%', right: '10%', bottom: '5%', containLabel: true },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'category', data: keys, axisLabel: { color: '#ffffff', width: 120, overflow: 'truncate' } },
        series: [{ name: 'Quantidade', type: 'bar', data: values, itemStyle: { color: '#0ea5e9', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#fff', fontWeight: 'bold' } }]
    });
    window.addEventListener('resize', () => myChart.resize());
};

window.renderizarPrioridadeOS = function() {
    const container = document.getElementById('graficoPrioridadeOS');
    if(!container || typeof echarts === 'undefined') { console.warn('[Dash Graficos] Div id="graficoPrioridadeOS" não encontrada ou echarts indisponível.'); return; }

    const os = window.ordensServico || [];
    const { inicio, fim } = window.getDatasFiltroGlobal();
    const contagem = { 'Urgente': 0, 'Alta': 0, 'Normal': 0, 'Baixa': 0 };

    os.forEach(o => {
        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
        if (isOSInativa) return;
        if (!o.placa || o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
        
        let dtAbertura = o.data_abertura ? window.tratarFusoDB(o.data_abertura) : null;
        if(!dtAbertura) return;
        
        if(dtAbertura >= inicio && dtAbertura <= fim) {
            const pri = o.prioridade || 'Normal';
            if(contagem[pri] !== undefined) contagem[pri]++; else contagem['Normal']++;
        }
    });

    const dataPie = [
        { value: contagem['Urgente'], name: 'Urgente', itemStyle: { color: '#ef4444' } },
        { value: contagem['Alta'], name: 'Alta', itemStyle: { color: '#f97316' } },
        { value: contagem['Normal'], name: 'Normal', itemStyle: { color: '#3b82f6' } },
        { value: contagem['Baixa'], name: 'Baixa', itemStyle: { color: '#10b981' } }
    ].filter(d => d.value > 0);

    let myChart = echarts.getInstanceByDom(container) || echarts.init(container);
    myChart.setOption({
        backgroundColor: 'transparent', tooltip: { trigger: 'item' }, legend: { bottom: '0', textStyle: { color: '#ffffff' } },
        series: [{ name: 'Prioridade', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false, label: { show: false, position: 'center' }, emphasis: { label: { show: true, fontSize: '18', fontWeight: 'bold', color: '#fff' } }, labelLine: { show: false }, data: dataPie }]
    });
    window.addEventListener('resize', () => myChart.resize());
};

window.renderizarRelatorioTipoServico = function() {
    const tbody = document.getElementById('tabelaRelatorioTipoServico');
    if(!tbody) { console.warn('[Dash Graficos] id="tabelaRelatorioTipoServico" não encontrada na tabela.'); return; }

    const os = window.ordensServico || [];
    const { inicio, fim } = window.getDatasFiltroGlobal();
    const resumo = {};

    os.forEach(o => {
        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
        if (isOSInativa) return;
        if (!o.placa || o.status === 'Agendada' || o.status === 'Cancelada' || o.tipo === 'Cavalo Disponível S/ Carreta') return;
        
        let dtAbertura = o.data_abertura ? window.tratarFusoDB(o.data_abertura) : null;
        if(!dtAbertura) return;
        
        if(dtAbertura >= inicio && dtAbertura <= fim) {
            const tipo = o.tipo || 'Outros';
            if(!resumo[tipo]) resumo[tipo] = { count: 0, tempoTotal: 0, countConcluido: 0 };
            resumo[tipo].count++;

            const stUpper = (o.status || '').toUpperCase();
            if (o.data_conclusao && (stUpper === 'CONCLUÍDA' || stUpper === 'CONCLUIDA' || stUpper === 'RESOLVIDO')) {
                let dtConclusao = window.tratarFusoDB(o.data_conclusao);
                resumo[tipo].tempoTotal += (dtConclusao - dtAbertura);
                resumo[tipo].countConcluido++;
            }
        }
    });

    const rows = Object.keys(resumo).sort((a,b) => resumo[b].count - resumo[a].count).map(tipo => {
        const item = resumo[tipo];
        let tempoStr = '-';
        if(item.countConcluido > 0) {
            const mediaMs = item.tempoTotal / item.countConcluido;
            const horas = Math.floor(mediaMs / (1000 * 60 * 60));
            const min = Math.floor((mediaMs % (1000 * 60 * 60)) / (1000 * 60));
            tempoStr = `${horas}h ${min}m`;
        }
        return `
        <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 12px 10px; color: #fff; font-weight: 600;">${tipo}</td>
            <td style="text-align: center; padding: 12px 10px; color: #3b82f6; font-weight: bold; font-size: 1.1rem;">${item.count}</td>
            <td style="text-align: right; padding: 12px 10px; color: #a855f7; font-weight: bold;">${tempoStr}</td>
        </tr>`;
    });

    if(rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #94a3b8;">Nenhum dado no período selecionado.</td></tr>';
    } else { tbody.innerHTML = rows.join(''); }
};