// =================================================================
// ARQUIVO: dash_manutencao_mural.js
// RESPONSABILIDADE: Funções do Mural de Recados do Setor
// =================================================================
console.log('[Dash Mural] Inicializando dash_manutencao_mural.js');

window.muralSetorKey = 'mural_manutencao';
window.muralSetorData = [];

window.formatarDataMural = function(dataIso) {
    if(!dataIso) return ''; const [ano, mes, dia] = dataIso.split('-'); return `${dia}/${mes}/${ano}`;
}

window.carregarMuralSetor = async function() {
    console.log('[Dash Mural] Iniciando carregamento do mural...');
    try {
        if (!window.supabaseClientGlobal && typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
            window.supabaseClientGlobal = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        }
        const _supa = window.supabaseClientGlobal;
        if(!_supa) { console.error('[Dash Mural ERRO] Supabase global não configurado para o mural.'); return; }

        const { data, error } = await _supa.from('configuracoes').select('valor').eq('chave', window.muralSetorKey).limit(1);
        if(error) console.error('[Dash Mural ERRO]', error);

        if (data && data.length > 0 && data[0].valor) {
            window.muralSetorData = JSON.parse(data[0].valor);
        } else {
            window.muralSetorData = [];
        }
        window.renderizarMuralSetor();
    } catch(e) { console.error("[Dash Mural ERRO CRÍTICO] ao carregar mural:", e); }
};

window.renderizarMuralSetor = function() {
    const container = document.getElementById('lista-mural-setor');
    if(!container) { console.warn('[Dash Mural] Div id="lista-mural-setor" não encontrada no HTML.'); return; }

    if(window.muralSetorData.length === 0) {
        container.innerHTML = '<div style="color: var(--text-dim); padding: 10px; text-align: center; font-size: 0.9rem;">Nenhuma informação ou aviso no momento.</div>';
        return;
    }
    
    container.innerHTML = window.muralSetorData.map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #8b5cf6;">
            <div style="flex: 1;">
                <span style="color: var(--text-dim); font-size: 0.8rem; font-weight: bold; margin-right: 8px;"><i class="fas fa-calendar-day"></i> ${window.formatarDataMural(item.data)}</span>
                <span style="color: white; font-size: 0.9rem;">${item.texto}</span>
            </div>
            <button class="btn-kanban" style="background: var(--verde); padding: 6px 12px; border: none; border-radius: 4px; color: white; cursor: pointer;" onclick="window.concluirMuralSetor(${item.id})" title="Concluir / Retirar">
                <i class="fas fa-check"></i>
            </button>
        </div>
    `).join('');
};

window.addMuralSetor = async function() {
    const dt = document.getElementById('data-mural-setor').value;
    const txt = document.getElementById('txt-mural-setor').value.trim();
    if(!dt || !txt) { alert("Preencha a data e o texto para adicionar ao mural!"); return; }
    
    window.muralSetorData.push({ id: Date.now(), data: dt, texto: txt });
    document.getElementById('txt-mural-setor').value = '';
    window.renderizarMuralSetor();
    await window.salvarMuralSetor();
};

window.concluirMuralSetor = async function(id) {
    if(!confirm("Concluir e retirar este aviso do mural?")) return;
    window.muralSetorData = window.muralSetorData.filter(i => i.id !== id);
    window.renderizarMuralSetor();
    await window.salvarMuralSetor();
};

window.salvarMuralSetor = async function() {
    const msg = document.getElementById('msg-mural-setor');
    if(msg) { msg.style.color = 'var(--text-dim)'; msg.innerText = 'Salvando...'; }
    
    try {
        if (!window.supabaseClientGlobal && typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
            window.supabaseClientGlobal = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        }
        const _supa = window.supabaseClientGlobal;
        await _supa.from('configuracoes').upsert([{ chave: window.muralSetorKey, valor: JSON.stringify(window.muralSetorData) }], { onConflict: 'chave' });
        
        if(msg) { 
            msg.style.color = 'var(--verde)'; msg.innerText = 'Salvo com sucesso!';
            setTimeout(() => msg.innerText='', 3000);
        }
    } catch(e) {
        if(msg) { msg.style.color = 'var(--vermelho)'; msg.innerText = 'Erro ao salvar!'; }
        console.error('[Dash Mural ERRO] Erro ao salvar Mural:', e);
    }
};