// =========================================================
// ARQUIVO: js/operacional/op_calculos.js
// MÓDULO: CÁLCULOS E GERAÇÃO DO PAINEL
// =========================================================

window.atualizarElementoTempo = function(idElemento, mediaReal, metaData) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    
    const strReal = window.formatarHorasMinutos(mediaReal);
    const strMeta = window.formatarHorasMinutos(metaData);
    
    let corClasse = "text-white";
    let icone = "";

    if (metaData > 0) {
        let minutosReais = Math.round((mediaReal || 0) * 60);
        let minutosMeta = Math.round((metaData || 0) * 60);

        if (minutosReais > minutosMeta) {
            corClasse = "text-rose-500";
            icone = `<i class="fas fa-exclamation-circle text-2xl text-rose-500 shadow-sm rounded-full bg-rose-500/10 p-1"></i>`;
        } else {
            corClasse = "text-emerald-400";
            icone = `<i class="fas fa-check-circle text-2xl text-emerald-400 shadow-sm rounded-full bg-emerald-500/10 p-1"></i>`;
        }
    }

    el.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
            <span class="text-[38px] font-black leading-none m-0 ${corClasse} drop-shadow-md">${strReal}</span>
            ${icone}
        </div>
        <div class="w-full mt-auto pt-3 border-t border-slate-700/50 flex justify-between items-center">
            <p class="text-[11px] text-slate-400 font-bold uppercase tracking-widest m-0">Padrão</p>
            <span class="text-[13px] font-black text-white">${strMeta}</span>
        </div>
    `;
};

window.calcStats = function(dataArr) {
    const viagens = dataArr.length;
    // Puxa o volume já tratado livre do bug do milhar
    const vol = dataArr.reduce((s,d) => s + window.toNumberOp(window.getCampoOp(d, ['volumeReal', 'pesoLiquido'])), 0);
    const medVol = viagens > 0 ? vol / viagens : 0;

    const validCiclos = dataArr.filter(d => d.cicloHoras > 0);
    const somaCiclos = validCiclos.reduce((s,d) => s + d.cicloHoras, 0);
    const medCiclo = validCiclos.length > 0 ? somaCiclos / validCiclos.length : 0;

    const validFilaCpo = dataArr.filter(d => d.filaCampoHoras > 0);
    const medFilaCpo = validFilaCpo.length > 0 ? validFilaCpo.reduce((s,d) => s + d.filaCampoHoras, 0) / validFilaCpo.length : 0;

    const validCarreg = dataArr.filter(d => d.tempoCarregamentoHoras > 0);
    const medCarreg = validCarreg.length > 0 ? validCarreg.reduce((s,d) => s + d.tempoCarregamentoHoras, 0) / validCarreg.length : 0;

    const validFilaFab = dataArr.filter(d => d.filaFabricaHoras > 0);
    const medFilaFab = validFilaFab.length > 0 ? validFilaFab.reduce((s,d) => s + d.filaFabricaHoras, 0) / validFilaFab.length : 0;

    const medAsfalto = viagens > 0 ? dataArr.reduce((s, d) => s + window.toNumberOp(d.distanciaAsfalto), 0) / viagens : 0;
    const medTerra = viagens > 0 ? dataArr.reduce((s, d) => s + window.toNumberOp(d.distanciaTerra), 0) / viagens : 0;
    
    const validRpv = dataArr.filter(d => d.rpv !== null && window.toNumberOp(d.rpv) > 0);
    const medRpv = validRpv.length > 0 ? validRpv.reduce((s, d) => s + window.toNumberOp(d.rpv), 0) / validRpv.length : 0;

    return { volTotal: vol, medVol, medCiclo, medFilaCpo, medCarreg, medFilaFab, medAsfalto, medTerra, medRpv };
};

// MOTOR PRINCIPAL
window.atualizarPainelOperacional = function() {
    const dataRef = document.getElementById('opDatePicker') ? document.getElementById('opDatePicker').value : null;
    const filterMesOp = document.getElementById('filterMesOp');
    const mesRef = filterMesOp ? filterMesOp.value : 'ALL';
    const filterTransp = document.getElementById('filterTransportadora');
    const activeT = filterTransp ? filterTransp.value : 'ALL';

    const filteredGlobal = window.fullHistoricoDataOp.filter(d => {
        const parsed = window.parseDateTime(d.dataDaBaseExcel);
        if(!parsed) return false;

        const mTransp = activeT === 'ALL' || d.transportadora === activeT;

        if (mesRef !== 'ALL') {
            const p = d.dataDaBaseExcel.split('/');
            if(p.length >= 3) {
                  let y = p[2]; if(y.length === 2) y = "20"+y;
                  if(`${p[1]}/${y}` !== mesRef) return false;
            } else return false;
        } else {
            if(window.activeQuickFilterOp === 'ALL' && !dataRef) return mTransp;
        }

        if (mesRef === 'ALL') {
            parsed.setHours(0,0,0,0); 
            const hj = new Date(); hj.setHours(0,0,0,0);
            
            if (window.activeQuickFilterOp === 'DATE' && dataRef) {
                const dr = new Date(dataRef + "T00:00:00"); dr.setHours(0,0,0,0);
                return parsed.getTime() === dr.getTime() && mTransp;
            }
            const diff = Math.round((hj - parsed)/86400000);
            
            if (window.activeQuickFilterOp === 'D-1') return diff === 1 && mTransp;
            if (window.activeQuickFilterOp === 'D-2') return diff === 2 && mTransp;
            if (window.activeQuickFilterOp === 'D-3') return diff >= 1 && diff <= 3 && mTransp;
            if (window.activeQuickFilterOp === 'D-7') return diff >= 1 && diff <= 7 && mTransp;
            if (window.activeQuickFilterOp === 'D-30') return diff >= 1 && diff <= 30 && mTransp;
            
            if (window.activeQuickFilterOp === 'SEM') {
                const inicioSemana = new Date(hj); inicioSemana.setDate(hj.getDate() - hj.getDay());
                return (parsed >= inicioSemana && parsed <= hj) && mTransp;
            }
        }
        return mesRef !== 'ALL' && mTransp;
    });

    let cardsData = filteredGlobal;
    const opStatusFetch = document.getElementById('opStatusFetch');

    if (activeT === 'ALL') {
        cardsData = filteredGlobal.filter(d => window.isSerranaTransp(d));
        if (opStatusFetch) opStatusFetch.innerHTML = `<i class="fas fa-database text-sky-500 mr-1"></i> Geral: ${filteredGlobal.length} Viagens | Frota Própria: ${cardsData.length} Viagens`;
    } else {
        if (opStatusFetch) opStatusFetch.innerHTML = `<i class="fas fa-truck text-sky-500 mr-1"></i> ${activeT}: ${filteredGlobal.length} Viagens`;
    }

    const totalViagens = cardsData.length;
    const elTotalViagens = document.getElementById('totalViagens');
    const elMetaTexto = document.getElementById('metaViagensText');
    const elIconeMeta = document.getElementById('iconeMetaViagens');

    if (elTotalViagens) {
        elTotalViagens.innerText = totalViagens;
        elTotalViagens.className = "text-[32px] font-extrabold leading-none m-0 text-white transition-all"; 
    }
    
    window.metaViagensCalculada = 0;
    let diasConsideradosCalc = 1;

    // === CÁLCULO EXATO DE META E DISPONIBILIDADE BASEADO NA MANUTENÇÃO ===
    if (elMetaTexto && window.frotasParaMeta && window.osParaMeta) {
        
        const frotasAtivas = window.frotasParaMeta.filter(f => f.status === 'Ativo' && f.categoria && f.categoria.toUpperCase() === 'TRITREM');
        
        let dataInicioCalc = new Date(); dataInicioCalc.setHours(0,0,0,0);
        let dataFimCalc = new Date(); dataFimCalc.setHours(23,59,59,999);
        const hjCalc = new Date(); hjCalc.setHours(0,0,0,0);

        if (mesRef !== 'ALL') {
            const p = mesRef.split('/');
            let ano = parseInt(p[1]); if(ano < 100) ano += 2000;
            let mes = parseInt(p[0]) - 1;
            dataInicioCalc = new Date(ano, mes, 1, 0,0,0);
            dataFimCalc = new Date(ano, mes + 1, 0, 23,59,59,999);
            if (dataInicioCalc.getFullYear() === hjCalc.getFullYear() && dataInicioCalc.getMonth() === hjCalc.getMonth()) {
                dataFimCalc = new Date(); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999);
            }
            diasConsideradosCalc = Math.max(1, Math.ceil((dataFimCalc - dataInicioCalc) / (1000 * 60 * 60 * 24)));
        } else {
            if (window.activeQuickFilterOp === 'DATE' && dataRef) {
                dataInicioCalc = new Date(dataRef + "T00:00:00"); dataFimCalc = new Date(dataRef + "T23:59:59"); diasConsideradosCalc = 1;
            } else if (window.activeQuickFilterOp === 'D-1') {
                dataInicioCalc.setDate(hjCalc.getDate() - 1); dataFimCalc = new Date(dataInicioCalc); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 1;
            } else if (window.activeQuickFilterOp === 'D-2') {
                dataInicioCalc.setDate(hjCalc.getDate() - 2); dataFimCalc = new Date(dataInicioCalc); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 1;
            } else if (window.activeQuickFilterOp === 'D-3') {
                dataInicioCalc.setDate(hjCalc.getDate() - 3); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 3;
            } else if (window.activeQuickFilterOp === 'D-7') {
                dataInicioCalc.setDate(hjCalc.getDate() - 7); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 7;
            } else if (window.activeQuickFilterOp === 'D-30') {
                dataInicioCalc.setDate(hjCalc.getDate() - 30); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = 30;
            } else if (window.activeQuickFilterOp === 'SEM') {
                dataInicioCalc.setDate(hjCalc.getDate() - hjCalc.getDay()); dataFimCalc = new Date(hjCalc); dataFimCalc.setDate(hjCalc.getDate() - 1); dataFimCalc.setHours(23,59,59,999); diasConsideradosCalc = Math.max(1, hjCalc.getDay());
            } else {
                if (filteredGlobal.length > 0) {
                    const datasSort = filteredGlobal.map(d => window.parseDateTime(d.dataDaBaseExcel)).filter(Boolean).sort((a,b) => a-b);
                    if (datasSort.length > 0) {
                        dataInicioCalc = datasSort[0]; dataFimCalc = datasSort[datasSort.length - 1]; dataFimCalc.setHours(23,59,59,999);
                        diasConsideradosCalc = Math.max(1, Math.ceil((dataFimCalc - dataInicioCalc) / (1000 * 60 * 60 * 24)));
                    }
                }
            }
        }

        window.diasConsideradosGlobais = diasConsideradosCalc;

        let inicioPeriodo = new Date(dataInicioCalc);
        inicioPeriodo.setHours(0, 0, 0, 0);

        let fimDia = new Date(inicioPeriodo);
        fimDia.setDate(fimDia.getDate() + 1); 

        let agora = new Date();
        let isHoje = inicioPeriodo.toDateString() === agora.toDateString();

        let fimParaCalculo = isHoje ? agora : fimDia;
        let msTotalPeriodo = fimParaCalculo.getTime() - inicioPeriodo.getTime();
        if (msTotalPeriodo <= 0) msTotalPeriodo = 86400000;

        let totalMsExistenciaPeriodo = 0;
        let somaDispNoDiaMs = 0;
        let metaTotalViagens = 0;

        let totalFrotaBase = frotasAtivas.length > 0 ? frotasAtivas.length : ((window.metasGlobaisObj && window.metasGlobaisObj.tamanho_frota) ? window.metasGlobaisObj.tamanho_frota : 0);

        if (frotasAtivas.length > 0) {
            frotasAtivas.forEach(frota => {
                let frotaInicioStr = frota.data_inicial ? frota.data_inicial.split('T')[0] : '2026-04-01';
                let parts = frotaInicioStr.split('-');
                let dtEntradaVeiculo = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);

                let overlapDispInicio = dtEntradaVeiculo > inicioPeriodo ? dtEntradaVeiculo : inicioPeriodo;
                let tempoDisp = fimParaCalculo.getTime() - overlapDispInicio.getTime();
                if (tempoDisp < 0) tempoDisp = 0;

                const placaFrotaNorm = (frota.cavalo || frota.placa || frota.placa_cavalo || '').trim().toUpperCase().replace(/-/g, '');
                let manutencaoCavalo = 0;

                if (placaFrotaNorm && tempoDisp > 0 && window.osParaMeta && window.osParaMeta.length > 0) {
                    const todasOSCavalo = window.osParaMeta.filter(o => {
                        let isOSInativa = (o.inativa === 1 || o.inativa === '1' || o.inativa === true);
                        if (isOSInativa) return false;
                        const status = o.status ? o.status.trim().toUpperCase() : '';
                        if (status === 'CANCELADA' || status === 'AGENDADA') return false;
                        if (o.tipo && o.tipo.toUpperCase() === 'CAVALO DISPONÍVEL S/ CARRETA') return false;
                        const placaOS = (o.placa || o.placa_cavalo || o.veiculo || o.cavalo || '').trim().toUpperCase().replace(/-/g, '');
                        return placaOS === placaFrotaNorm;
                    });
                    
                    todasOSCavalo.forEach(os => {
                        let dtAbertura = os.data_abertura ? window.corrigirDataSupabaseLocal(os.data_abertura) : null;
                        let dtInicioM = os.data_inicio_manutencao ? window.corrigirDataSupabaseLocal(os.data_inicio_manutencao) : null;
                        let osInicio = dtAbertura || dtInicioM; 
                        if (!osInicio) return;
                        
                        let osFim = os.data_conclusao ? window.corrigirDataSupabaseLocal(os.data_conclusao) : agora;
                        
                        let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                        const overlapInicio = inicioValido > inicioPeriodo ? inicioValido : inicioPeriodo;
                        const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;
                        
                        if (overlapInicio < overlapFim) {
                            manutencaoCavalo += (overlapFim.getTime() - overlapInicio.getTime());
                        }
                    });
                }

                let dispNoDiaMs = tempoDisp - manutencaoCavalo;
                if (dispNoDiaMs < 0) dispNoDiaMs = 0;

                somaDispNoDiaMs += dispNoDiaMs;
                totalMsExistenciaPeriodo += tempoDisp;

                let metaVeiculo = frota.meta ? parseFloat(frota.meta) : 0;
                let proporcaoPeriodo = dispNoDiaMs / (24 * 60 * 60 * 1000); 
                metaTotalViagens += (metaVeiculo * proporcaoPeriodo);
            });
        } else if (totalFrotaBase > 0) {
            totalMsExistenciaPeriodo = totalFrotaBase * msTotalPeriodo;
            somaDispNoDiaMs = totalMsExistenciaPeriodo;
        }

        window.metaViagensCalculada = Math.round(metaTotalViagens);

        let percentDM = totalMsExistenciaPeriodo > 0 ? (somaDispNoDiaMs / totalMsExistenciaPeriodo) * 100 : 0;
        if (percentDM > 100) percentDM = 100;
        let corDm = percentDM >= 90 ? 'text-emerald-400' : (percentDM >= 80 ? 'text-amber-400' : 'text-rose-400');
        
        let mediaVeiculosDisp = totalMsExistenciaPeriodo > 0 ? (somaDispNoDiaMs / msTotalPeriodo) : 0;
        let mediaVeiculosDispStr = Math.round(mediaVeiculosDisp).toString();

        if (activeT === 'ALL' || activeT.toUpperCase().includes('SERRANALOG')) {
            let atingiuMeta = totalViagens >= window.metaViagensCalculada;
            let corMetaStr = atingiuMeta ? 'text-emerald-400' : 'text-rose-500';

            elMetaTexto.innerHTML = `
                <span class="${corDm} font-bold text-[12px]" title="Disponibilidade Mecânica Real e Média de Veículos Disponíveis">DM: ${percentDM.toFixed(2)}% (${mediaVeiculosDispStr})</span> 
                <span class="text-slate-600 mx-[6px]">|</span> 
                <span class="${corMetaStr} font-bold text-[12px]" title="Meta ajustada pela DM">META: ${window.metaViagensCalculada}</span>
            `;
            elMetaTexto.classList.remove('hidden');
            elMetaTexto.className = "mt-auto pt-3 border-t border-slate-700/50 flex items-center uppercase tracking-wider block whitespace-nowrap overflow-hidden text-ellipsis";
            
            if (window.metaViagensCalculada > 0) {
                if (atingiuMeta) {
                    if(elTotalViagens) elTotalViagens.className = "text-[32px] font-extrabold leading-none m-0 text-emerald-400 drop-shadow-md transition-all";
                    if(elIconeMeta) elIconeMeta.innerHTML = '<i class="fas fa-check-circle text-emerald-400 text-[22px] drop-shadow-md" title="Meta Atingida"></i>';
                } else {
                    if(elTotalViagens) elTotalViagens.className = "text-[32px] font-extrabold leading-none m-0 text-rose-500 drop-shadow-md transition-all";
                    if(elIconeMeta) elIconeMeta.innerHTML = '<i class="fas fa-exclamation-circle text-rose-500 text-[22px] drop-shadow-md" title="Abaixo da Meta"></i>';
                }
            } else { if(elIconeMeta) elIconeMeta.innerHTML = ''; }
        } else { elMetaTexto.classList.add('hidden'); if(elIconeMeta) elIconeMeta.innerHTML = ''; }
    } else { if(elMetaTexto) elMetaTexto.classList.add('hidden'); if(elIconeMeta) elIconeMeta.innerHTML = ''; }

    // === CÁLCULOS PRINCIPAIS RPV / PBTC COM FORMATAÇÃO BLINDADA ===

    const totalPesoKg = cardsData.reduce((s, x) => s + window.toNumberOp(x.peso_na_entrada), 0);
    const mediaPbtc = totalViagens > 0 ? (totalPesoKg / 1000) / totalViagens : 0;
    
    const validRpv = cardsData.filter(d => d.rpv !== null && window.toNumberOp(d.rpv) > 0);
    const mediaRPV = validRpv.length > 0 ? validRpv.reduce((sum, r) => sum + window.toNumberOp(r.rpv), 0) / validRpv.length : 0;

    const dataC1Rpv = cardsData.filter(d => window.getFrenteDaViagem(d) === 'C1' && window.isSerranaTransp(d));
    const dataC2Rpv = cardsData.filter(d => window.getFrenteDaViagem(d) === 'C2' && window.isSerranaTransp(d));

    const validRpvC1 = dataC1Rpv.filter(d => d.rpv !== null && window.toNumberOp(d.rpv) > 0);
    const mediaRpvC1 = validRpvC1.length > 0 ? validRpvC1.reduce((sum, r) => sum + window.toNumberOp(r.rpv), 0) / validRpvC1.length : 0;

    const validRpvC2 = dataC2Rpv.filter(d => d.rpv !== null && window.toNumberOp(d.rpv) > 0);
    const mediaRpvC2 = validRpvC2.length > 0 ? validRpvC2.reduce((sum, r) => sum + window.toNumberOp(r.rpv), 0) / validRpvC2.length : 0;

    let reqPbtc = 74.0;
    if (mediaRPV <= 700 && mediaRPV > 0) reqPbtc = 71.0;
    else if (mediaRPV > 700 && mediaRPV < 800) reqPbtc = 73.0;
    else reqPbtc = 74.0;

    let slaAtendido = (mediaPbtc >= reqPbtc);

    const elRpv = document.getElementById('mediaRPV');
    if (elRpv) {
        let rpvC1Str = mediaRpvC1 > 0 ? mediaRpvC1.toLocaleString('pt-PT', {maximumFractionDigits: 2}) : "0";
        let rpvC2Str = mediaRpvC2 > 0 ? mediaRpvC2.toLocaleString('pt-PT', {maximumFractionDigits: 2}) : "0";
        
        let displayHtml = `<div class="flex flex-col text-[18px] leading-tight justify-center mr-2">
                               <span>F5: ${rpvC1Str}</span>
                               <span>F6: ${rpvC2Str}</span>
                           </div>`;
                           
        const pSub = elRpv.parentElement.nextElementSibling; 

        if (mediaRPV > 0) {
            if (slaAtendido) {
                elRpv.className = "flex items-center font-extrabold text-emerald-400 m-0 transition-all drop-shadow-md";
                elRpv.innerHTML = `${displayHtml} <i class="fas fa-check-circle text-[28px]" title="SLA Atendido (PBTC >= ${reqPbtc}t)"></i>`;
                if(pSub && pSub.tagName === 'P') {
                    pSub.innerText = `SLA OK (Alvo PBTC: ${reqPbtc}t)`;
                    pSub.className = "text-[11px] font-bold mt-1 m-0 text-emerald-500";
                }
            } else {
                elRpv.className = "flex items-center font-extrabold text-rose-500 m-0 transition-all drop-shadow-md";
                elRpv.innerHTML = `${displayHtml} <i class="fas fa-exclamation-circle text-[28px]" title="SLA Não Atendido (Faltou PBTC >= ${reqPbtc}t)"></i>`;
                if(pSub && pSub.tagName === 'P') {
                    pSub.innerText = `SLA PENDENTE (Falta PBTC: ${reqPbtc}t)`;
                    pSub.className = "text-[11px] font-bold mt-1 m-0 text-rose-500";
                }
            }
        } else {
            elRpv.className = "flex items-center font-extrabold text-white m-0 transition-all";
            elRpv.innerHTML = displayHtml;
            if(pSub && pSub.tagName === 'P') {
                pSub.innerText = "kg / m³";
                pSub.className = "text-[10px] font-bold text-white mt-1 m-0";
            }
        }
    }

    let pbtcCor = "text-white", pbtcIcone = "";
    if (mediaPbtc > 0) {
        if (mediaPbtc < reqPbtc) { 
            pbtcCor = "text-rose-500"; 
            pbtcIcone = `<i class="fas fa-exclamation-circle text-rose-500 text-xl ml-2" title="Abaixo da Meta SLA (${reqPbtc}t)"></i>`; 
        }
        else if (mediaPbtc >= reqPbtc && mediaPbtc <= 77.7) { 
            pbtcCor = "text-emerald-400"; 
            pbtcIcone = `<i class="fas fa-check-circle text-emerald-400 text-xl ml-2" title="Dentro do SLA (${reqPbtc}t)"></i>`; 
        }
        else if (mediaPbtc > 77.7) { 
            pbtcCor = "text-amber-500"; 
            pbtcIcone = '<i class="fas fa-exclamation-triangle text-amber-500 text-xl ml-2" title="Acima da Tolerância Legal"></i>'; 
        }
    }
    const elPbtc = document.getElementById('totalPesoLiq');
    if (elPbtc) elPbtc.innerHTML = `<span class="${pbtcCor}">${mediaPbtc.toLocaleString('pt-PT', {maximumFractionDigits:1})} t</span>${pbtcIcone}`;

    // === CÁLCULO DE VOLUMES E DISTÂNCIAS ===

    const totalVol = cardsData.reduce((s,x) => s + window.toNumberOp(window.getCampoOp(x, ['volumeReal', 'pesoLiquido'])), 0);
    const mediaVol = totalViagens > 0 ? (totalVol / totalViagens) : 0;
    
    let elMediaVol = document.getElementById('mediaVolumeViagem');
    let metaCaixaText = document.getElementById('metaVolMediaText');
    let iconeCaixa = document.getElementById('iconeMetaVolMedia');
    
    if (elMediaVol) elMediaVol.innerText = mediaVol.toLocaleString('pt-PT', {maximumFractionDigits:1}) + ' m³';
    
    let metaCaixaFinal = window.metaCaixaMedia > 0 ? window.metaCaixaMedia : 48;
    
    if (metaCaixaFinal > 0) {
        if(metaCaixaText) {
            let diffCaixa = metaCaixaFinal - mediaVol;
            let txtFaltaCaixa = diffCaixa > 0 ? ` | Faltam: <b class="text-rose-400">${diffCaixa.toLocaleString('pt-PT', {maximumFractionDigits:1})}</b>` : ` | <b class="text-emerald-400">Batida!</b>`;
            metaCaixaText.innerHTML = `<span class="text-white">Meta: <b>${metaCaixaFinal} m³</b>${txtFaltaCaixa}</span>`;
            metaCaixaText.classList.remove('hidden');
        }
        if (elMediaVol) {
            if (mediaVol >= metaCaixaFinal) {
                elMediaVol.className = "text-[32px] font-extrabold leading-none m-0 text-emerald-400 drop-shadow-md transition-all";
                if(iconeCaixa) iconeCaixa.innerHTML = '<i class="fas fa-check-circle text-emerald-400 text-[22px] drop-shadow-md"></i>';
            } else {
                elMediaVol.className = "text-[32px] font-extrabold leading-none m-0 text-rose-500 drop-shadow-md transition-all";
                if(iconeCaixa) iconeCaixa.innerHTML = '<i class="fas fa-exclamation-circle text-rose-500 text-[22px] drop-shadow-md"></i>';
            }
        }
    }

    let elTotalVol = document.getElementById('totalVolumeReal');
    let metaVolTotalText = document.getElementById('metaVolTotalText');
    let iconeVolTotal = document.getElementById('iconeMetaVolTotal');
    
    if(elTotalVol) elTotalVol.innerText = totalVol.toLocaleString('pt-PT', {maximumFractionDigits:1}) + ' m³';
    
    let metaVolumeCalculada = 0;
    if (window.metaVolumeDiario > 0) { metaVolumeCalculada = window.metaVolumeDiario * diasConsideradosCalc; } 
    else if (window.metaViagensCalculada > 0) { metaVolumeCalculada = window.metaViagensCalculada * metaCaixaFinal; } 
    else { metaVolumeCalculada = (50 * 2 * diasConsideradosCalc) * metaCaixaFinal; }

    if (metaVolumeCalculada > 0) {
        if(metaVolTotalText) {
            let faltamVol = metaVolumeCalculada - totalVol;
            let txtFaltamVol = faltamVol > 0 ? ` | Faltam: <b class="text-rose-400">${faltamVol.toLocaleString('pt-PT', {maximumFractionDigits:1})}</b>` : ` | <b class="text-emerald-400">Batida!</b>`;
            metaVolTotalText.innerHTML = `<span class="text-white">Meta: <b>${metaVolumeCalculada.toLocaleString('pt-PT')} m³</b>${txtFaltamVol}</span>`;
            metaVolTotalText.classList.remove('hidden');
        }
        if (elTotalVol) {
            if (totalVol >= metaVolumeCalculada) {
                elTotalVol.className = "text-[32px] font-extrabold leading-none m-0 text-emerald-400 drop-shadow-md transition-all";
                if(iconeVolTotal) iconeVolTotal.innerHTML = '<i class="fas fa-check-circle text-emerald-400 text-[22px] drop-shadow-md"></i>';
            } else {
                elTotalVol.className = "text-[32px] font-extrabold leading-none m-0 text-rose-500 drop-shadow-md transition-all";
                if(iconeVolTotal) iconeVolTotal.innerHTML = '<i class="fas fa-exclamation-circle text-rose-500 text-[22px] drop-shadow-md"></i>';
            }
        }
    }

    const mediaAsfalto = totalViagens > 0 ? cardsData.reduce((s, r) => s + window.toNumberOp(r.distanciaAsfalto), 0) / totalViagens : 0;
    const mediaTerra = totalViagens > 0 ? cardsData.reduce((s, r) => s + window.toNumberOp(r.distanciaTerra), 0) / totalViagens : 0;
    const mediaDistTotal = mediaAsfalto + mediaTerra;

    if(document.getElementById('mediaDistancia')) document.getElementById('mediaDistancia').innerText = mediaDistTotal.toLocaleString('pt-PT', {maximumFractionDigits:2}) + ' km';
    if(document.getElementById('mediaAsfalto')) document.getElementById('mediaAsfalto').innerText = mediaAsfalto.toLocaleString('pt-PT', {maximumFractionDigits:2});
    if(document.getElementById('mediaTerra')) document.getElementById('mediaTerra').innerText = mediaTerra.toLocaleString('pt-PT', {maximumFractionDigits:2});

    const validCycles = cardsData.filter(d => d.cicloHoras > 0);
    const mediaCiclo = validCycles.length > 0 ? validCycles.reduce((s, d) => s + d.cicloHoras, 0) / validCycles.length : 0;

    const validFilaCampo = cardsData.filter(d => d.filaCampoHoras > 0);
    const mediaFilaCampo = validFilaCampo.length > 0 ? validFilaCampo.reduce((s, d) => s + d.filaCampoHoras, 0) / validFilaCampo.length : 0;

    const validTempoCarregamento = cardsData.filter(d => d.tempoCarregamentoHoras > 0);
    const mediaTempoCarregamento = validTempoCarregamento.length > 0 ? validTempoCarregamento.reduce((s, d) => s + d.tempoCarregamentoHoras, 0) / validTempoCarregamento.length : 0;

    const validFilaFabrica = cardsData.filter(d => d.filaFabricaHoras > 0);
    const mediaFilaFabrica = validFilaFabrica.length > 0 ? validFilaFabrica.reduce((s, d) => s + d.filaFabricaHoras, 0) / validFilaFabrica.length : 0;

    window.atualizarElementoTempo('cicloMedio', mediaCiclo, window.metaCicloDecimal);
    window.atualizarElementoTempo('filaCampo', mediaFilaCampo, window.metaFilaCampoDecimal);
    window.atualizarElementoTempo('tempoCarregamento', mediaTempoCarregamento, window.metaCargaDecimal);
    window.atualizarElementoTempo('filaFabrica', mediaFilaFabrica, window.metaFilaFabricaDecimal);

    // === GERAÇÃO DA TABELA COMPARATIVO POR CENÁRIOS ===
    const tbodyComp = document.getElementById('comparativoBody');
    if (tbodyComp) {
        
        const dataC1 = filteredGlobal.filter(d => window.getFrenteDaViagem(d) === 'C1' && window.isSerranaTransp(d));
        const dataC2 = filteredGlobal.filter(d => window.getFrenteDaViagem(d) === 'C2' && window.isSerranaTransp(d));
        const dataASN = filteredGlobal.filter(d => ['C1','C2'].includes(window.getFrenteDaViagem(d)) && !window.isSerranaTransp(d));
        const dataC3 = filteredGlobal.filter(d => window.getFrenteDaViagem(d) === 'C3' && window.isSerranaTransp(d));
        const dataC4 = filteredGlobal.filter(d => window.getFrenteDaViagem(d) === 'C4' && window.isSerranaTransp(d));
        
        const dataGlobalExato = [...new Set([...dataC1, ...dataC2, ...dataASN, ...dataC3, ...dataC4])];

        const stC1 = window.calcStats(dataC1), 
              stC2 = window.calcStats(dataC2), 
              stASN = window.calcStats(dataASN),
              stC3 = window.calcStats(dataC3), 
              stC4 = window.calcStats(dataC4), 
              stGlobal = window.calcStats(dataGlobalExato);

        tbodyComp.innerHTML = `
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-[13px]"><i class="fas fa-route text-slate-400 w-5"></i> Viagens Realizadas</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right text-emerald-400">${dataC1.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right text-emerald-400">${dataC2.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right text-purple-400">${dataASN.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right text-amber-400">${dataC3.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right text-indigo-400">${dataC4.length}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${dataGlobalExato.length}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-[13px]"><i class="fas fa-box-open text-indigo-400 w-5"></i> Caixa de Carga Média</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC1.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC2.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stASN.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC3.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC4.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stGlobal.medVol.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-white text-[13px]"><i class="fas fa-cubes text-cyan-400 w-5"></i> Volume Total</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC1.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC2.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stASN.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC3.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC4.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stGlobal.volTotal.toLocaleString('pt-PT',{maximumFractionDigits:1})} m³</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700/50">
                <td class="px-6 py-4 font-bold text-slate-300 text-[12px] uppercase tracking-wider"><i class="fas fa-weight-hanging text-rose-400 w-5"></i> RPV Médio</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC1.medRpv.toLocaleString('pt-PT',{maximumFractionDigits:2})}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC2.medRpv.toLocaleString('pt-PT',{maximumFractionDigits:2})}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stASN.medRpv.toLocaleString('pt-PT',{maximumFractionDigits:2})}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC3.medRpv.toLocaleString('pt-PT',{maximumFractionDigits:2})}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stC4.medRpv.toLocaleString('pt-PT',{maximumFractionDigits:2})}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${stGlobal.medRpv.toLocaleString('pt-PT',{maximumFractionDigits:2})}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700/50">
                <td class="px-6 py-4 font-bold text-slate-300 text-[12px] uppercase tracking-wider"><i class="fas fa-stopwatch text-blue-400 w-5"></i> Ciclo Médio Total</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC1.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC2.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stASN.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC3.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC4.medCiclo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stGlobal.medCiclo)}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-300 text-[12px] uppercase tracking-wider"><i class="fas fa-hourglass-half text-amber-500 w-5"></i> Espera Média Campo</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC1.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC2.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stASN.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC3.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stC4.medFilaCpo)}</td>
                <td class="px-6 py-4 font-mono text-white text-[16px] font-bold text-right">${window.formatarHorasMinutos(stGlobal.medFilaCpo)}</td>
            </tr>
            <tr class="hover:bg-slate-800/30 transition-colors border-t border-slate-700">
                <td class="px-6 py-4 font-bold text-slate-300 text-[12px] uppercase tracking-wider"><i class="fas fa-road text-slate-400 w-5"></i> Dist. Média (Asfalto/Terra)</td>
                <td class="px-6 py-4 font-mono text-white text-[14px] font-bold text-right"><span class="text-sky-300" title="Asfalto">Asf: ${stC1.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span><br><span class="text-amber-400" title="Terra">Ter: ${stC1.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span></td>
                <td class="px-6 py-4 font-mono text-white text-[14px] font-bold text-right"><span class="text-sky-300" title="Asfalto">Asf: ${stC2.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span><br><span class="text-amber-400" title="Terra">Ter: ${stC2.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span></td>
                <td class="px-6 py-4 font-mono text-white text-[14px] font-bold text-right"><span class="text-sky-300" title="Asfalto">Asf: ${stASN.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span><br><span class="text-amber-400" title="Terra">Ter: ${stASN.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span></td>
                <td class="px-6 py-4 font-mono text-white text-[14px] font-bold text-right"><span class="text-sky-300" title="Asfalto">Asf: ${stC3.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span><br><span class="text-amber-400" title="Terra">Ter: ${stC3.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span></td>
                <td class="px-6 py-4 font-mono text-white text-[14px] font-bold text-right"><span class="text-sky-300" title="Asfalto">Asf: ${stC4.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span><br><span class="text-amber-400" title="Terra">Ter: ${stC4.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span></td>
                <td class="px-6 py-4 font-mono text-white text-[14px] font-bold text-right"><span class="text-sky-300" title="Asfalto">Asf: ${stGlobal.medAsfalto.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span><br><span class="text-amber-400" title="Terra">Ter: ${stGlobal.medTerra.toLocaleString('pt-PT',{minimumFractionDigits:1, maximumFractionDigits:1})}</span></td>
            </tr>
        `;
    }

    if (window.atualizarGraficosOperacionais) {
        window.atualizarGraficosOperacionais(cardsData, filteredGlobal);
    }
};