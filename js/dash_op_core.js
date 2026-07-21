// =========================================================
// MÓDULO 3: NÚCLEO, FILTROS E CÁLCULOS (OPERACIONAL)
// =========================================================

// --- GERENCIADOR UNIFICADO DE BANCO DE DADOS ---
// Unifica as chamadas antigas para usar o banco global inicializado no config_db.js
window.supabaseClientLocal = window.supabaseClientGlobal;
window.supabaseClientMan = window.supabaseClientGlobal;

window.getGlobalDB = function() {
    return window.supabaseClientGlobal;
};
// --------------------------------------------------

// Sincronizador de Data do Banco (Garante que a contagem de horas da O.S seja idêntica ao Indicadores)
window.corrigirDataSupabaseLocal = function(dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    if (!str.includes('T')) str = str.replace(' ', 'T');
    const partes = str.split('T');
    if (partes.length === 2) {
        const horaStr = partes[1];
        if (!horaStr.includes('Z') && !horaStr.includes('+') && !horaStr.includes('-')) {
            str += 'Z';
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

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

window.fullHistoricoDataOp = [];
window.activeQuickFilterOp = 'ALL';
window.diasConsideradosGlobais = 1;
window.chartCarregamento = null;
window.chartTransporte = null;

// ARRAYS PADRÕES (Serão substituídos pelo Banco de Dados)
window.frentesNomes = {
    C1: 'C1: Serrana - Fr. 05',
    C2: 'C2: Serrana - Fr. 06',
    C3: 'C3: Reflorestar',
    C4: 'C4: JSL'
};
window.serranaFrente05Loaders = [];
window.serranaFrente06Loaders = [];
window.serranaLoaders = [];
window.reflorestarLoaders = [];
window.jslLoaders = [];

// =========================================================================
// O BUSCADOR DINÂMICO DE GRUAS NO SUPABASE (TABELA config_gruas)
// =========================================================================
window.carregarConfigGruas = async function() {
    try {
        const { data, error } = await window.supabaseClientLocal.from('config_gruas').select('*');
        if (!error && data && data.length > 0) {
            let c1 = [], c2 = [], c3 = [], c4 = [];
            
            data.forEach(row => {
                let ord = row.ordem ? row.ordem.toUpperCase().trim() : '';
                
                if (row.codigos) {
                    const codigos = row.codigos.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
                    if (ord === 'C1') c1.push(...codigos);
                    else if (ord === 'C2') c2.push(...codigos);
                    else if (ord === 'C3') c3.push(...codigos);
                    else if (ord === 'C4') c4.push(...codigos);
                }
                
                if (row.frente && ord) {
                    window.frentesNomes[ord] = `${ord}: ${row.frente}`;
                }
            });

            if (c1.length > 0) window.serranaFrente05Loaders = c1;
            if (c2.length > 0) window.serranaFrente06Loaders = c2;
            if (c3.length > 0) window.reflorestarLoaders = c3;
            if (c4.length > 0) window.jslLoaders = c4;
            
            window.serranaLoaders = [...window.serranaFrente05Loaders, ...window.serranaFrente06Loaders];
            console.log("✅ Configuração de gruas dinâmica carregada com sucesso da tabela config_gruas!");
            
            const thC1 = document.getElementById('th_c1'); if(thC1) thC1.innerHTML = `<i class="fas fa-star mr-1"></i> ${window.frentesNomes['C1']}`;
            const thC2 = document.getElementById('th_c2'); if(thC2) thC2.innerHTML = `<i class="fas fa-star mr-1"></i> ${window.frentesNomes['C2']}`;
            const thC3 = document.getElementById('th_c3'); if(thC3) thC3.innerHTML = `<i class="fas fa-tree mr-1"></i> ${window.frentesNomes['C3']}`;
            const thC4 = document.getElementById('th_c4'); if(thC4) thC4.innerHTML = `<i class="fas fa-leaf mr-1"></i> ${window.frentesNomes['C4']}`;
        }
    } catch (e) {
        console.error("Erro ao carregar tabela config_gruas:", e);
    }
};

// --- VARIÁVEIS PARA AS METAS DINÂMICAS ---
window.metaCaixaMedia = 0;
window.metaVolumeDiario = 0;
window.metaViagensCalculada = 0;

window.metaCicloDecimal = 10.083; // Padrão 10h 05m
window.metaFilaCampoDecimal = 1.333; // Padrão 1h 20m
window.metaCargaDecimal = 0.5; // Padrão 30m
window.metaFilaFabricaDecimal = 0.5; // Padrão 30m

window.parseMetaTempo = function(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        if (val.includes(':')) {
            let p = val.split(':');
            let h = parseInt(p[0], 10) || 0;
            let m = parseInt(p[1], 10) || 0;
            return h + (m / 60);
        }
        let num = parseFloat(val);
        if (!isNaN(num)) return num;
    }
    return null;
};

// =========================================================================
// O VARREDOR UNIVERSAL DE METAS
// =========================================================================
window.carregarMetasGlobais = async function() {
    try {
        const dbs = [ window.supabaseClientLocal, window.supabaseClientMan, window.getGlobalDB() ];
        let metasEncontradas = false;

        for (let db of dbs) {
            if (!db) continue;
            try {
                const { data, error } = await db.from('metas_globais').select('*').limit(1);
                if (!error && data && data.length > 0) {
                    const m = data[0];
                    if (m.cx_prog !== undefined && m.cx_prog !== null) window.metaCaixaMedia = parseFloat(m.cx_prog);
                    if (m.vol_prog !== undefined && m.vol_prog !== null) window.metaVolumeDiario = parseFloat(m.vol_prog);

                    let ciclo = window.parseMetaTempo(m.meta_ciclo) ?? window.parseMetaTempo(m.cfg_meta_ciclo);
                    if (ciclo !== null) window.metaCicloDecimal = ciclo;

                    let filaC = window.parseMetaTempo(m.meta_fila_campo) ?? window.parseMetaTempo(m.cfg_meta_fila_campo);
                    if (filaC !== null) window.metaFilaCampoDecimal = filaC;

                    let carga = window.parseMetaTempo(m.meta_carga) ?? window.parseMetaTempo(m.cfg_meta_carga) ?? window.parseMetaTempo(m.meta_carregamento);
                    if (carga !== null) window.metaCargaDecimal = carga;

                    let filaF = window.parseMetaTempo(m.meta_fila_fabrica) ?? window.parseMetaTempo(m.cfg_meta_fila_fabrica);
                    if (filaF !== null) window.metaFilaFabricaDecimal = filaF;
                    
                    console.log("✅ Metas extraídas com sucesso do banco:", db.supabaseUrl);
                    metasEncontradas = true;
                    break;
                }
            } catch (e) { }
        }

        if (!metasEncontradas) {
            for (let db of dbs) {
                if (!db) continue;
                try {
                    const { data, error } = await db.from('configuracoes').select('*').in('chave', ['cfg_cx_prog', 'cfg_vol_prog', 'cfg_meta_ciclo', 'cfg_meta_fila_campo', 'cfg_meta_carga', 'cfg_meta_fila_fabrica']);
                    if (!error && data && data.length > 0) {
                        data.forEach(item => {
                            if (item.chave === 'cfg_cx_prog' && item.valor) window.metaCaixaMedia = parseFloat(item.valor);
                            if (item.chave === 'cfg_vol_prog' && item.valor) window.metaVolumeDiario = parseFloat(item.valor);
                            let v = window.parseMetaTempo(item.valor);
                            if (item.chave === 'cfg_meta_ciclo' && v !== null) window.metaCicloDecimal = v;
                            if (item.chave === 'cfg_meta_fila_campo' && v !== null) window.metaFilaCampoDecimal = v;
                            if (item.chave === 'cfg_meta_carga' && v !== null) window.metaCargaDecimal = v;
                            if (item.chave === 'cfg_meta_fila_fabrica' && v !== null) window.metaFilaFabricaDecimal = v;
                        });
                        console.log("✅ Metas recuperadas de 'configuracoes' do Banco:", db.supabaseUrl);
                        break;
                    }
                } catch (e) {}
            }
        }
    } catch (e) { console.error("Erro geral na busca de metas:", e); }
};

window.normalizarCiclos = function(dataArr) {
    const pMap = new Map();
    dataArr.forEach(d => {
        if (d.cicloHorasOriginal === undefined) { d.cicloHorasOriginal = d.cicloHoras; }
        if (d.cicloHorasOriginal > 0 && d.cicloHorasOriginal <= 12) { 
            const pl = d.placa || 'N/A';
            if (!pMap.has(pl)) pMap.set(pl, { ciclos: 0, count: 0 });
            pMap.get(pl).ciclos += d.cicloHorasOriginal;
            pMap.get(pl).count++;
        }
    });
    
    const frotas = Array.from(pMap.values()).map(x => x.ciclos / x.count).sort((a, b) => a - b).slice(0, 20);
    if (frotas.length === 0) return;
    const mediaMenores = frotas.reduce((a, b) => a + b, 0) / frotas.length;
    
    dataArr.forEach(d => {
        if (d.cicloHorasOriginal > 12) { d.cicloHoras = mediaMenores; } 
        else { d.cicloHoras = d.cicloHorasOriginal; }
    });
};

// =========================================================
// SISTEMA BLINDADO DE IDENTIFICAÇÃO DE GRUAS E TRANSPORTADORA
// =========================================================
window.checkLoader = function(d, loaderArray, prefix = '') {
    let colunasPrioritarias = [];
    let outrasColunas = [];

    for (let key in d) {
        let keyUpper = key.toUpperCase();
        let val = d[key];
        if (val && typeof val === 'string') {
            let vClean = val.trim().toUpperCase().replace(/\s+/g, '');
            if (!vClean || vClean === '-' || vClean === 'N/A' || vClean === '0') continue;

            if (keyUpper.includes('GRUA') || keyUpper.includes('CARREG') || keyUpper.includes('EQUIP') || keyUpper.includes('FRENTE')) {
                colunasPrioritarias.push(vClean);
            } else {
                outrasColunas.push(vClean);
            }
        }
    }

    let valoresParaChecar = colunasPrioritarias.length > 0 ? colunasPrioritarias : outrasColunas;

    for (let v of valoresParaChecar) {
        for (let code of loaderArray) {
            let codeClean = code.replace(/\s+/g, '');
            if (v === codeClean || v.includes(codeClean)) {
                return true;
            }
        }

        if (prefix) {
            if (prefix === 'GSR') {
                if (v.startsWith('GSR') || v.includes('GSR0')) return true;
                if (v.includes('GRB0015') || v.includes('GRB0022')) return true; 
            } 
            else if (prefix === 'GRB') {
                if (v.startsWith('GRB') || v.includes('GRB0')) {
                    if (v.includes('0015') || v.includes('0022')) continue; 
                    return true;
                }
            } 
            else if (prefix === 'GSL') {
                if (v.startsWith('GSL') || v.includes('GSL0')) return true;
            }
        }
    }

    return false;
};

window.isSerranaTransp = function(d) {
    let valTransp = String(d.transportadora || d['Nome da Transportadora'] || d.nomeTransportadora || '').toUpperCase().replace(/\s+/g, '');
    if (valTransp.includes('SERRANALOG') || valTransp.includes('SERRANA')) return true;

    for (let key in d) {
        if (d[key] && typeof d[key] === 'string') {
            let val = d[key].toUpperCase().replace(/\s+/g, '');
            if (val.includes('SERRANALOG') || val.includes('SERRANATRANSPORTES')) {
                return true;
            }
        }
    }
    return false;
};

window.setupOperacionalFilters = function() {
    const btnQFs = document.querySelectorAll('.btn-op-qf');
    const datePicker = document.getElementById('opDatePicker');
    const filterMesOp = document.getElementById('filterMesOp');
    const filterTransp = document.getElementById('filterTransportadora');
    
    btnQFs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            window.activeQuickFilterOp = e.currentTarget.getAttribute('data-op-qf');
            btnQFs.forEach(b => {
                if(b.getAttribute('data-op-qf') === window.activeQuickFilterOp) {
                    b.classList.add('active', 'border-sky-500/50', 'text-sky-400', 'bg-sky-900/30');
                    b.classList.remove('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                } else {
                    b.classList.remove('active', 'border-sky-500/50', 'text-sky-400', 'bg-sky-900/30');
                    b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                }
            });
            if(datePicker) datePicker.value = '';
            if(filterMesOp) filterMesOp.value = 'ALL';
            window.atualizarPainelOperacional();
        });
    });

    if(datePicker) {
        datePicker.addEventListener('change', () => {
            if(datePicker.value) {
                window.activeQuickFilterOp = 'DATE';
                btnQFs.forEach(b => {
                    b.classList.remove('active', 'border-sky-500/50', 'text-sky-400', 'bg-sky-900/30');
                    b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                });
                if(filterMesOp) filterMesOp.value = 'ALL';
                window.atualizarPainelOperacional();
            }
        });
    }

    if(filterMesOp) {
        filterMesOp.addEventListener('change', () => {
            if(filterMesOp.value !== 'ALL') {
                window.activeQuickFilterOp = 'ALL';
                btnQFs.forEach(b => {
                    b.classList.remove('active', 'border-sky-500/50', 'text-sky-400', 'bg-sky-900/30');
                    b.classList.add('border-transparent', 'text-slate-400', 'hover:bg-slate-700/50');
                });
                if(datePicker) datePicker.value = '';
            }
            window.atualizarPainelOperacional();
        });
    }

    if(filterTransp) {
        filterTransp.addEventListener('change', () => {
            window.atualizarPainelOperacional();
        });
    }
};

window.loadManutencaoDataForMeta = async function() {
    try {
        const client = window.supabaseClientLocal; 
        
        // LIMITADO A 5000 COM ORDENAÇÃO E EXCLUSÃO DO STATUS "Agendada" PARA FUNCIONAR IGUAL AO INDICADORES
        const osResp = await client.from('ordens_servico')
            .select('*')
            .neq('status', 'Agendada')
            .order('data_abertura', { ascending: false })
            .limit(5000);

        let frotasResp = await client.from('frotas_manutencao').select('*').limit(2000);
        if (!frotasResp.data || frotasResp.data.length === 0) {
            frotasResp = await client.from('cadastro_frota').select('*').limit(2000);
        }

        if (osResp.data) window.osParaMeta = osResp.data;
        if (frotasResp.data) window.frotasParaMeta = frotasResp.data;
    } catch (e) { console.error("Erro dados manutenção:", e); }
};

window.loadOperacionalData = async function() {
    try {
        let historico = [];
        let from = 0;
        const step = 1000;
        let fetchMore = true;
        
        while (fetchMore) {
            const { data, error } = await window.supabaseClientLocal
                .from('historico_viagens')
                .select('*')
                .range(from, from + step - 1);
                
            if (error) break;
            if (data && data.length > 0) {
                historico = historico.concat(data);
                from += step;
            }
            if (!data || data.length < step) fetchMore = false;
        }
        
        if(historico && historico.length > 0) {
            historico = historico.filter(d => {
                const motorista = String(d.motorista || '').toUpperCase();
                return !motorista.includes('JULIO CESAR ALMEIDA NUNES') && motorista !== '-';
            });
            window.fullHistoricoDataOp = historico.reverse();
            window.normalizarCiclos(window.fullHistoricoDataOp);
        }

        const filterMesOp = document.getElementById('filterMesOp');
        const filterTransp = document.getElementById('filterTransportadora');

        if(window.fullHistoricoDataOp.length > 0) {
            if(filterMesOp) {
                const mesesSet = new Set();
                window.fullHistoricoDataOp.forEach(d => {
                    if(d.dataDaBaseExcel && d.dataDaBaseExcel !== 'Desconhecida') {
                        const p = d.dataDaBaseExcel.split('/');
                        if(p.length >= 3) {
                            let y = p[2]; if(y.length === 2) y = "20"+y;
                            mesesSet.add(`${p[1]}/${y}`);
                        }
                    }
                });
                const allMeses = Array.from(mesesSet).sort((a,b) => {
                      const pA = a.split('/'); const pB = b.split('/');
                      return new Date(pA[1], pA[0]-1, 1) - new Date(pB[1], pB[0]-1, 1);
                });
                const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                
                filterMesOp.innerHTML = '<option value="ALL">Todos os Meses</option>';
                allMeses.forEach(mStr => {
                    const p = mStr.split('/');
                    const mesIdx = parseInt(p[0]) - 1;
                    const nomeMes = monthNames[mesIdx] + '/' + p[1].substring(2);
                    filterMesOp.insertAdjacentHTML('beforeend', `<option value="${mStr}">${nomeMes}</option>`);
                });
                
                const hj = new Date();
                const mesAtualStr = String(hj.getMonth() + 1).padStart(2, '0') + '/' + hj.getFullYear();
                if(allMeses.includes(mesAtualStr)) { filterMesOp.value = mesAtualStr; }
            }
            if(filterTransp) {
                const transps = [...new Set(window.fullHistoricoDataOp.map(d => d.transportadora))].filter(Boolean).sort();
                filterTransp.innerHTML = '<option value="ALL">TODAS AS TRANSPORTADORAS</option>';
                transps.forEach(t => filterTransp.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`));
            }

            window.atualizarPainelOperacional();
        }
    } catch(e) { console.error("Erro operacionais:", e); }
};

window.parseDateTime = function(dateVal) {
    if (!dateVal) return null;
    const str = String(dateVal).trim();
    if (str === 'Desconhecida') return null;

    let baseDate = null;
    if (str.includes('/')) {
        const parts = str.split(' ')[0].split('/');
        if (parts.length >= 3) {
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            baseDate = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
    } else if (str.includes('-')) { baseDate = new Date(str); }

    if (!baseDate || isNaN(baseDate.getTime())) return null;
    baseDate.setHours(0, 0, 0, 0);
    return baseDate;
};

window.formatarHorasMinutos = function(horasDecimais) {
    if (horasDecimais === null || horasDecimais === undefined || isNaN(horasDecimais) || horasDecimais <= 0) return '-';
    let horas = Math.floor(horasDecimais);
    let minutos = Math.round((horasDecimais - horas) * 60);
    if (minutos === 60) { horas += 1; minutos = 0; }
    if (horas === 0 && minutos === 0) return '0m';
    if (horas === 0) return `${minutos}m`;
    if (minutos === 0) return `${horas}h`;
    return `${horas}h ${minutos.toString().padStart(2, '0')}m`;
};

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
    const vol = dataArr.reduce((s,d) => s + (parseFloat(String(d.volumeReal).replace(',','.'))||0), 0);
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

    const medAsfalto = viagens > 0 ? dataArr.reduce((s, d) => s + (d.distanciaAsfalto || 0), 0) / viagens : 0;
    const medTerra = viagens > 0 ? dataArr.reduce((s, d) => s + (d.distanciaTerra || 0), 0) / viagens : 0;

    return { volTotal: vol, medVol, medCiclo, medFilaCpo, medCarreg, medFilaFab, medAsfalto, medTerra };
};

// =========================================================
// ATUALIZAÇÃO PRINCIPAL DO PAINEL OPERACIONAL
// =========================================================
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
    let mediaAtivosReal = 0; 

    // ========================================================================
    // CÁLCULO EXATO DE META E DISPONIBILIDADE BASEADO NA MANUTENÇÃO E VEÍCULOS
    // ========================================================================
    if (elMetaTexto && window.frotasParaMeta && window.osParaMeta) {
        
        // FILTRO DE ATIVOS EXATAMENTE IGUAL AO RELATÓRIO GERENCIAL
        const frotasAtivas = window.frotasParaMeta.filter(f => 
            f.status === 'Ativo' && 
            f.categoria && 
            f.categoria.toUpperCase() === 'TRITREM'
        );
        
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

        let fimParaCalculo = dataFimCalc > new Date() ? new Date() : dataFimCalc;
        let msTotalPeriodo = fimParaCalculo.getTime() - dataInicioCalc.getTime();
        if (msTotalPeriodo <= 0) msTotalPeriodo = 86400000; 

        let totalMetaCalculadaExata = 0;
        let totalDispNoPeriodoMs = 0;

        frotasAtivas.forEach(frota => {
            // DATA BASE EXATA DE ENTRADA DO VEICULO
            let dtEntradaVeiculo = new Date('2026-04-01T00:00:00');
            if(frota.data_inicial) dtEntradaVeiculo = new Date(frota.data_inicial + 'T00:00:00');

            let overlapDispInicio = dtEntradaVeiculo > dataInicioCalc ? dtEntradaVeiculo : dataInicioCalc;
            let totalMsDisponivelVeiculo = 0;
            
            if (overlapDispInicio < fimParaCalculo) {
                totalMsDisponivelVeiculo = (fimParaCalculo.getTime() - overlapDispInicio.getTime());
            }

            if (totalMsDisponivelVeiculo > 0) {
                let msManutVeiculo = 0;
                let placaFrota = frota.placa || frota.cavalo; 
                
                // EXCLUSÃO ESTRITA EXATAMENTE COMO NO RELATÓRIO DE INDICADORES
                const todasOSCavalo = window.osParaMeta.filter(o => {
                    if (o.placa !== placaFrota) return false;
                    if (o.status === 'Agendada') return false;
                    if (o.tipo && o.tipo.toUpperCase() === 'CAVALO DISPONÍVEL S/ CARRETA') return false;
                    return true;
                });
                
                todasOSCavalo.forEach(os => {
                    let osInicio = window.corrigirDataSupabaseLocal(os.data_abertura);
                    if (!osInicio) return;
                    
                    let osFim = os.data_conclusao ? window.corrigirDataSupabaseLocal(os.data_conclusao) : new Date();
                    
                    let inicioValido = osInicio > dtEntradaVeiculo ? osInicio : dtEntradaVeiculo;
                    const overlapInicio = inicioValido > dataInicioCalc ? inicioValido : dataInicioCalc;
                    const overlapFim = osFim < fimParaCalculo ? osFim : fimParaCalculo;
                    
                    if (overlapInicio < overlapFim) {
                        msManutVeiculo += (overlapFim.getTime() - overlapInicio.getTime());
                    }
                });

                let dispVeiculoMs = totalMsDisponivelVeiculo - msManutVeiculo;
                if (dispVeiculoMs < 0) dispVeiculoMs = 0;

                totalDispNoPeriodoMs += dispVeiculoMs;

                let metaDiariaVeiculo = 2; 
                if (frota.meta !== null && frota.meta !== undefined && frota.meta !== '') {
                    let parsedMeta = parseFloat(frota.meta);
                    if (!isNaN(parsedMeta) && parsedMeta > 0) {
                        metaDiariaVeiculo = parsedMeta;
                    }
                }

                let veiculoDiasDisponiveis = dispVeiculoMs / 86400000;
                totalMetaCalculadaExata += (veiculoDiasDisponiveis * metaDiariaVeiculo);
            }
        });

        mediaAtivosReal = Math.round(totalDispNoPeriodoMs / msTotalPeriodo);

        if (activeT === 'ALL' || activeT.toUpperCase().includes('SERRANALOG')) {
            window.metaViagensCalculada = Math.round(totalMetaCalculadaExata);
            
            let viagensFaltantes = window.metaViagensCalculada - totalViagens;
            let textoFalta = viagensFaltantes > 0 ? `| Faltam: <b class="text-rose-400">${viagensFaltantes}</b> viag.` : `| <b class="text-emerald-400">Batida!</b>`;
            
            elMetaTexto.innerHTML = `<span class="text-white drop-shadow-md">Disp: <b>${mediaAtivosReal}</b> (DM) | Meta: <b>${window.metaViagensCalculada}</b> viag. ${textoFalta}</span>`;
            elMetaTexto.classList.remove('hidden');
            
            if (window.metaViagensCalculada > 0) {
                if (totalViagens >= window.metaViagensCalculada) {
                    if(elTotalViagens) elTotalViagens.className = "text-[32px] font-extrabold leading-none m-0 text-emerald-400 drop-shadow-md transition-all";
                    if(elIconeMeta) elIconeMeta.innerHTML = '<i class="fas fa-check-circle text-emerald-400 text-[22px] drop-shadow-md" title="Meta Atingida"></i>';
                } else {
                    if(elTotalViagens) elTotalViagens.className = "text-[32px] font-extrabold leading-none m-0 text-rose-500 drop-shadow-md transition-all";
                    if(elIconeMeta) elIconeMeta.innerHTML = '<i class="fas fa-exclamation-circle text-rose-500 text-[22px] drop-shadow-md" title="Abaixo da Meta"></i>';
                }
            } else { if(elIconeMeta) elIconeMeta.innerHTML = ''; }
        } else { elMetaTexto.classList.add('hidden'); if(elIconeMeta) elIconeMeta.innerHTML = ''; }
    } else { if(elMetaTexto) elMetaTexto.classList.add('hidden'); if(elIconeMeta) elIconeMeta.innerHTML = ''; }

    // ========================================================================
    // CÁLCULOS PRINCIPAIS - RPV E PBTC (COM REGRAS DE SLA DO CONTRATO)
    // ========================================================================

    const totalPesoKg = cardsData.reduce((s, x) => {
        let p = x.peso_na_entrada || 0;
        return s + (parseFloat(String(p).replace(',', '.')) || 0);
    }, 0);
    const mediaPbtc = totalViagens > 0 ? (totalPesoKg / 1000) / totalViagens : 0;
    
    const validRpv = cardsData.filter(d => d.rpv !== null && d.rpv > 0);
    const mediaRPV = validRpv.length > 0 ? validRpv.reduce((sum, r) => sum + r.rpv, 0) / validRpv.length : 0;

    let reqPbtc = 74.0;
    if (mediaRPV <= 700 && mediaRPV > 0) reqPbtc = 71.0;
    else if (mediaRPV > 700 && mediaRPV < 800) reqPbtc = 73.0;
    else reqPbtc = 74.0;

    let slaAtendido = (mediaPbtc >= reqPbtc);

    const elRpv = document.getElementById('mediaRPV');
    if (elRpv) {
        let rpvStr = mediaRPV > 0 ? mediaRPV.toLocaleString('pt-PT', {maximumFractionDigits: 2}) : "0";
        const pSub = elRpv.parentElement.nextElementSibling; 

        if (mediaRPV > 0) {
            if (slaAtendido) {
                elRpv.className = "text-[32px] font-extrabold text-emerald-400 leading-none m-0 transition-all drop-shadow-md";
                elRpv.innerHTML = `${rpvStr} <i class="fas fa-check-circle text-[20px] ml-2" title="SLA Atendido (PBTC >= ${reqPbtc}t)"></i>`;
                if(pSub && pSub.tagName === 'P') {
                    pSub.innerText = `SLA OK (Alvo PBTC: ${reqPbtc}t)`;
                    pSub.className = "text-[11px] font-bold mt-1 m-0 text-emerald-500";
                }
            } else {
                elRpv.className = "text-[32px] font-extrabold text-rose-500 leading-none m-0 transition-all drop-shadow-md";
                elRpv.innerHTML = `${rpvStr} <i class="fas fa-exclamation-circle text-[20px] ml-2" title="SLA Não Atendido (Faltou PBTC >= ${reqPbtc}t)"></i>`;
                if(pSub && pSub.tagName === 'P') {
                    pSub.innerText = `SLA PENDENTE (Falta PBTC: ${reqPbtc}t)`;
                    pSub.className = "text-[11px] font-bold mt-1 m-0 text-rose-500";
                }
            }
        } else {
            elRpv.className = "text-[32px] font-extrabold text-white leading-none m-0 transition-all";
            elRpv.innerText = "0";
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

    // ========================================================================

    const totalVol = cardsData.reduce((s,x)=>s+(parseFloat(String(x.volumeReal).replace(',','.'))||0), 0);
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

    const mediaAsfalto = totalViagens > 0 ? cardsData.reduce((s, r) => s + (r.distanciaAsfalto||0), 0) / totalViagens : 0;
    const mediaTerra = totalViagens > 0 ? cardsData.reduce((s, r) => s + (r.distanciaTerra||0), 0) / totalViagens : 0;
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

    // TABELA COMPARATIVA DE CENÁRIOS COM BLINDAGEM DE GRUAS EXATA
    const tbodyComp = document.getElementById('comparativoBody');
    if (tbodyComp) {
        const dataC1 = filteredGlobal.filter(d => window.checkLoader(d, window.serranaFrente05Loaders) && window.isSerranaTransp(d));
        const dataC2 = filteredGlobal.filter(d => window.checkLoader(d, window.serranaFrente06Loaders) && window.isSerranaTransp(d));
        const dataASN = filteredGlobal.filter(d => window.checkLoader(d, window.serranaLoaders, 'GSR') && !window.isSerranaTransp(d));
        const dataC3 = filteredGlobal.filter(d => window.checkLoader(d, window.reflorestarLoaders, 'GRB') && window.isSerranaTransp(d));
        const dataC4 = filteredGlobal.filter(d => window.checkLoader(d, window.jslLoaders, 'GSL') && window.isSerranaTransp(d));
        
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

// =========================================================
// INICIALIZAÇÃO GERAL DO OPERACIONAL
// =========================================================
window.initNovoDashboardOperacional = async function() {
    if(typeof Chart === 'undefined') {
        setTimeout(window.initNovoDashboardOperacional, 50);
        return; 
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    window.setupOperacionalFilters();
    
    // GATILHO DAS FUNÇÕES DINÂMICAS DO BANCO DE DADOS
    await window.carregarConfigGruas();
    await window.carregarMetasGlobais();

    window.loadManutencaoDataForMeta().finally(() => {
        window.loadOperacionalData();
    });
    
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