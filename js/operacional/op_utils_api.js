// =========================================================
// ARQUIVO: js/operacional/op_utils_api.js
// MÓDULO: NÚCLEO, UTILITÁRIOS E INTEGRAÇÃO DE DADOS
// =========================================================

window.supabaseClientLocal = window.supabaseClientGlobal;
window.supabaseClientMan = window.supabaseClientGlobal;

window.getGlobalDB = function() {
    return window.supabaseClientGlobal;
};

// VARIAVEIS GLOBAIS
window.fullHistoricoDataOp = [];
window.activeQuickFilterOp = 'D-1'; 
window.diasConsideradosGlobais = 1;
window.chartCarregamento = null;
window.chartTransporte = null;

window.gruasCacheMap = new Map();
window.frentesNomes = {
    C1: 'C1: Serrana - Fr. 05',
    C2: 'C2: Serrana - Fr. 06',
    C3: 'C3: Reflorestar',
    C4: 'C4: JSL'
};

window.metaCaixaMedia = 0;
window.metaVolumeDiario = 0;
window.metaViagensCalculada = 0;
window.metaCicloDecimal = 10.083; 
window.metaFilaCampoDecimal = 1.333; 
window.metaCargaDecimal = 0.5; 
window.metaFilaFabricaDecimal = 0.5; 

// =========================================================
// FUNÇÕES UTILITÁRIAS (CORREÇÃO DE BUGS DE NÚMEROS/DATAS)
// =========================================================

window.corrigirDataSupabaseLocal = function(dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    if (str.includes('T')) {
        str = str.split('.')[0].split('+')[0].split('Z')[0]; 
    } else {
        str = str.replace(' ', 'T').split('.')[0].split('+')[0].split('Z')[0];
    }
    const d = new Date(str); 
    return isNaN(d.getTime()) ? null : d;
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

// FIX: Blindagem contra o erro de formatação de volume do Excel ("1.234,50" ou "48.5")
window.toNumberOp = function(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).replace('R$', '').trim();
    
    if (str.includes('.') && str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.'); // Formato brasileiro 1.234,50
    } else if (str.includes(',')) {
        str = str.replace(',', '.'); // Apenas virgula 48,5
    }
    // Se tiver apenas ponto (48.5), já está no formato correto para parseFloat
    
    let num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

window.getCampoOp = function(obj, possiveisNomes) {
    if (!obj) return '';
    const chavesReais = Object.keys(obj);
    for (let nomeProcurado of possiveisNomes) {
        const chaveEncontrada = chavesReais.find(k => k.toLowerCase() === nomeProcurado.toLowerCase());
        if (chaveEncontrada && obj[chaveEncontrada] !== null && obj[chaveEncontrada] !== undefined) {
            return obj[chaveEncontrada];
        }
    }
    return '';
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

// =========================================================
// REGRAS DE NEGÓCIO E FILTRAGEM DE FRENTES
// =========================================================

window.getFrenteDaViagem = function(d) {
    const gruaRaw = String(window.getCampoOp(d, ['grua', 'equipamento', 'maquina', 'cod_grua', 'codigo_grua'])).trim().toUpperCase().replace(/[-\s]/g, '');
    
    // 1. Tenta mapear diretamente pela grua (Banco de Dados)
    if (window.gruasCacheMap && window.gruasCacheMap.has(gruaRaw)) {
        return window.gruasCacheMap.get(gruaRaw).ordem; // 'C1', 'C2', 'C3', 'C4'
    }

    // 2. Fallback: Lê as colunas para associar como no Produção-Frota (Fazenda/UP)
    const upRaw = String(window.getCampoOp(d, ['up', 'fazenda', 'horto'])).trim().toUpperCase();
    const frenteRaw = String(window.getCampoOp(d, ['frente'])).trim().toUpperCase();
    const txtInfo = `${frenteRaw} ${upRaw} ${gruaRaw}`;

    if (txtInfo.includes('FRENTE 5') || txtInfo.includes('ALCOBAÇA') || txtInfo.includes('ALCOBACA')) return 'C1';
    if (txtInfo.includes('FRENTE 6') || txtInfo.includes('PORTELA')) return 'C2';
    if (txtInfo.includes('REFLORESTAR') || gruaRaw.startsWith('GRB')) return 'C3';
    if (txtInfo.includes('JSL') || gruaRaw.startsWith('GSL')) return 'C4';
    if (gruaRaw.startsWith('GSR')) return 'C1'; 

    return 'OUTROS';
};

window.isSerranaTransp = function(d) {
    let valTransp = String(window.getCampoOp(d, ['transportadora', 'Nome da Transportadora', 'nomeTransportadora', 'transportador', 'empresa_transporte'])).toUpperCase().replace(/\s+/g, '');
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

// =========================================================
// CONEXÃO COM BANCO DE DADOS (SUPABASE)
// =========================================================

window.carregarConfigGruasOp = async function() {
    try {
        const { data, error } = await window.supabaseClientLocal.from('config_gruas').select('*');
        if (!error && data && data.length > 0) {
            data.forEach(row => {
                let ord = row.ordem ? row.ordem.toUpperCase().trim() : '';
                if (row.codigos) {
                    row.codigos.split(',').forEach(c => {
                        const cod = c.trim().toUpperCase().replace(/[-\s]/g, '');
                        if(cod) window.gruasCacheMap.set(cod, { ordem: ord, frente: row.frente });
                    });
                }
                if (row.frente && ord) { window.frentesNomes[ord] = `${ord}: ${row.frente}`; }
            });
            const thC1 = document.getElementById('th_c1'); if(thC1) thC1.innerHTML = `<i class="fas fa-star mr-1"></i> ${window.frentesNomes['C1'] || 'Frente 05'}`;
            const thC2 = document.getElementById('th_c2'); if(thC2) thC2.innerHTML = `<i class="fas fa-star mr-1"></i> ${window.frentesNomes['C2'] || 'Frente 06'}`;
            const thC3 = document.getElementById('th_c3'); if(thC3) thC3.innerHTML = `<i class="fas fa-tree mr-1"></i> ${window.frentesNomes['C3'] || 'Reflorestar'}`;
            const thC4 = document.getElementById('th_c4'); if(thC4) thC4.innerHTML = `<i class="fas fa-leaf mr-1"></i> ${window.frentesNomes['C4'] || 'JSL'}`;
        }
    } catch (e) { console.error("Erro ao carregar tabela config_gruas:", e); }
};

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
                        break;
                    }
                } catch (e) {}
            }
        }
    } catch (e) { console.error("Erro geral na busca de metas:", e); }
};

window.loadManutencaoDataForMeta = async function() {
    try {
        const client = window.supabaseClientLocal; 
        const osResp = await client.from('ordens_servico').select('*').neq('status', 'Agendada').order('data_abertura', { ascending: false }).limit(5000);
        let frotasResp = await client.from('frotas_manutencao').select('*').limit(2000);
        
        if (!frotasResp.data || frotasResp.data.length === 0) {
            frotasResp = await client.from('cadastro_frota').select('*').limit(2000);
        }

        if (osResp.data) window.osParaMeta = osResp.data;
        if (frotasResp.data) window.frotasParaMeta = frotasResp.data;
    } catch (e) { console.error("Erro dados manutenção:", e); }
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

window.loadOperacionalData = async function() {
    try {
        let historico = [];
        let from = 0;
        const step = 1000;
        let fetchMore = true;
        
        while (fetchMore) {
            const { data, error } = await window.supabaseClientLocal.from('historico_viagens').select('*').range(from, from + step - 1);
            if (error) break;
            if (data && data.length > 0) { historico = historico.concat(data); from += step; }
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
                filterMesOp.value = 'ALL';
            }
            if(filterTransp) {
                const transps = [...new Set(window.fullHistoricoDataOp.map(d => d.transportadora))].filter(Boolean).sort();
                filterTransp.innerHTML = '<option value="ALL">TODAS AS TRANSPORTADORAS</option>';
                transps.forEach(t => filterTransp.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`));
            }
            if (typeof window.atualizarPainelOperacional === 'function') window.atualizarPainelOperacional();
        }
    } catch(e) { console.error("Erro operacionais:", e); }
};