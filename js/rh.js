// ARQUIVO: js/rh.js
if (!window.supabaseClientGlobal && typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
    window.supabaseClientGlobal = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
}
const _supa = window.supabaseClientGlobal;

// Trava de segurança: impede de salvar valores zerados antes da tela carregar o que já tem no banco
window.rhCarregado = false;

window.salvarDadosRH = async function(msgId = 'msg-rh-1', isSilent = false) {
    if (!window.rhCarregado && !isSilent) {
        alert("Aguarde os dados carregarem antes de salvar.");
        return;
    }

    const msg = document.getElementById(msgId);
    if (msg && !isSilent) {
        msg.style.color = 'var(--text-dim)';
        msg.innerText = "Salvando alterações...";
    }
    
    // Pegamos todos os valores da tela
    const dados = {
        headcount: parseInt(document.getElementById('input-headcount')?.value || 0),
        atestados: parseInt(document.getElementById('input-atestados')?.value || 0),
        afastamentos: parseInt(document.getElementById('input-afastamentos')?.value || 0),
        admissoes: parseInt(document.getElementById('input-admissoes')?.value || 0),
        integracoes: parseInt(document.getElementById('input-integracoes')?.value || 0),
        sgt: parseInt(document.getElementById('input-sgt')?.value || 0),
        
        mural_avisos: JSON.stringify(window.listasRH.avisos_rh || []),
        mural_liberacoes: JSON.stringify(window.listasRH.liberacoes_rh || []),
        
        mural_aniversariantes: null, // Deixamos NULO pois agora usamos a tabela própria "rh_aniversariantes"
        mural_calendario: document.getElementById('input-calendario-rh')?.value || null
    };
    
    try {
        if (!_supa) throw new Error("Conexão falhou.");
        
        // Busca a ÚLTIMA linha que já existe no seu banco de dados
        const { data: linhas } = await _supa.from('rh_indicadores').select('id').order('id', { ascending: false }).limit(1);
        
        let erroBanco = null;

        if (linhas && linhas.length > 0) {
            const { error } = await _supa.from('rh_indicadores').update(dados).eq('id', linhas[0].id);
            erroBanco = error;
        } else {
            dados.data_registro = new Date().toISOString().split('T')[0];
            const { error } = await _supa.from('rh_indicadores').insert([dados]);
            erroBanco = error;
        }
        
        if (erroBanco) {
            if (msg && !isSilent) { msg.style.color = 'var(--vermelho)'; msg.innerText = "ERRO: " + erroBanco.message; }
            return;
        }
        
        if (msg && !isSilent) {
            msg.style.color = 'var(--verde)';
            msg.innerText = "Dados atualizados com sucesso!";
            setTimeout(() => msg.innerText = "", 3000);
        }
    } catch (err) {
        console.error("Erro ao salvar:", err);
        if (msg && !isSilent) { msg.style.color = 'var(--vermelho)'; msg.innerText = "Erro ao salvar!"; }
    }
}

window.carregarDadosRH = async function() {
    if (!_supa) return;
    
    try {
        // 1. CARREGA OS INDICADORES BÁSICOS
        const { data: indData, error } = await _supa
            .from('rh_indicadores')
            .select('*')
            .order('id', { ascending: false })
            .limit(1);
        
        if (!error && indData && indData.length > 0) {
            const data = indData[0];
            
            // Preenche os campos
            if(document.getElementById('input-headcount')) document.getElementById('input-headcount').value = data.headcount || 0;
            if(document.getElementById('input-atestados')) document.getElementById('input-atestados').value = data.atestados || 0;
            if(document.getElementById('input-afastamentos')) document.getElementById('input-afastamentos').value = data.afastamentos || 0;
            if(document.getElementById('input-admissoes')) document.getElementById('input-admissoes').value = data.admissoes || 0;
            if(document.getElementById('input-integracoes')) document.getElementById('input-integracoes').value = data.integracoes || 0;
            if(document.getElementById('input-sgt')) document.getElementById('input-sgt').value = data.sgt || 0;
            
            if(document.getElementById('input-calendario-rh')) document.getElementById('input-calendario-rh').value = data.mural_calendario || '';

            // Atualiza Murais
            if (window.listasRH) {
                try {
                    window.listasRH.avisos_rh = JSON.parse(data.mural_avisos || '[]');
                    window.listasRH.liberacoes_rh = JSON.parse(data.mural_liberacoes || '[]');
                    if(typeof window.renderizarListaMuralRH === 'function') {
                        window.renderizarListaMuralRH('avisos_rh');
                        window.renderizarListaMuralRH('liberacoes_rh');
                    }
                } catch(e) { console.error("Erro parse listas", e); }
            }
            
            // Atualiza Dashboard Principal
            const setTxt = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val || 0; };
            setTxt('val-headcount', data.headcount);
            setTxt('val-atestados', data.atestados);
            setTxt('val-afastamentos', data.afastamentos);
            setTxt('val-admissoes', data.admissoes);
            setTxt('val-integracoes', data.integracoes);
            setTxt('val-sgt', data.sgt);
            
            if(typeof window.renderizarListaApresentacaoRH === 'function') {
                window.renderizarListaApresentacaoRH('mural-avisos-rh', data.mural_avisos, 'var(--amarelo)');
                window.renderizarListaApresentacaoRH('mural-liberacoes-rh', data.mural_liberacoes, '#0ea5e9');
            }
            if(typeof window.gerarCalendarioVisual === 'function') window.gerarCalendarioVisual(data.mural_calendario || '');
        }

        // 2. CARREGA AS VAGAS
        const { data: vagas } = await _supa.from('rh_vagas').select('*').eq('status', 'Aberta').order('data_criacao', { ascending: false });
        let totalVagas = 0;
        if (vagas) {
            vagas.forEach(v => totalVagas += parseInt(v.quantidade || 0));
            const tbodyDash = document.getElementById('tabela-vagas-dash');
            if (tbodyDash) tbodyDash.innerHTML = vagas.map(v => `<tr style="background: rgba(255,255,255,0.02);"><td style="color: white; font-weight: bold; border-bottom: 1px solid var(--border); padding: 12px;">${v.cargo}</td><td style="color: var(--text-dim); border-bottom: 1px solid var(--border); padding: 12px;"><i class="fas fa-building"></i> ${v.setor}</td><td style="text-align: center; border-bottom: 1px solid var(--border); padding: 12px;"><span class="badge bg-amarelo">${v.quantidade} Vaga(s)</span></td></tr>`).join('');
            
            const tbodyLanc = document.getElementById('tabela-vagas-lancamento');
            if (tbodyLanc) tbodyLanc.innerHTML = vagas.map(v => `<tr style="background: rgba(255,255,255,0.02);"><td style="color: white; font-weight: bold; border-bottom: 1px solid var(--border); padding: 12px;">${v.cargo}</td><td style="color: var(--text-dim); border-bottom: 1px solid var(--border); padding: 12px;">${v.setor}</td><td style="color: var(--amarelo); text-align: center; border-bottom: 1px solid var(--border); padding: 12px;">${v.quantidade}</td><td style="text-align: right; border-bottom: 1px solid var(--border); padding: 12px;"><button class="btn-kanban" style="background: var(--verde);" onclick="concluirVaga(${v.id})"><i class="fas fa-check"></i></button></td></tr>`).join('');
        }
        if(document.getElementById('val-vagas')) document.getElementById('val-vagas').innerText = totalVagas;

        // 3. CARREGA OS ANIVERSARIANTES DA NOVA TABELA
        const { data: anivs } = await _supa.from('rh_aniversariantes').select('*').order('dia', { ascending: true });
        if(typeof window.gerarAniversariantesVisual === 'function') window.gerarAniversariantesVisual(anivs || []);
        if(typeof window.renderizarTabelaAniversariantes === 'function') window.renderizarTabelaAniversariantes(anivs || []);

        window.rhCarregado = true;

    } catch (err) { console.error("Erro ao carregar RH:", err); }
}

// Funções de Vagas e Murais
window.adicionarVaga = async function() {
    const cargo = document.getElementById('vaga-cargo').value;
    const setor = document.getElementById('vaga-setor').value;
    const qtd = document.getElementById('vaga-qtd').value;
    if(!cargo || !setor || !qtd) return;
    const { error } = await _supa.from('rh_vagas').insert([{ cargo, setor, quantidade: parseInt(qtd), status: 'Aberta' }]);
    if(!error) { 
        document.getElementById('vaga-cargo').value = '';
        document.getElementById('vaga-setor').value = '';
        document.getElementById('vaga-qtd').value = '';
        window.carregarDadosRH(); 
    }
}

window.concluirVaga = async function(id) {
    if(!confirm("Concluir esta vaga?")) return;
    const { error } = await _supa.from('rh_vagas').update({ status: 'Concluída' }).eq('id', id);
    if (!error) window.carregarDadosRH();
}

window.limparMuralRH = async function(idMural) {
    if(!confirm("Deseja apagar esta lista?")) return;
    const el = document.getElementById(idMural);
    if(el) el.value = '';
    await window.salvarDadosRH('msg-murais-rh', false);
}

// Inicializa
window.carregarDadosRH();