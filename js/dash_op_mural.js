// =========================================================
// MÓDULO 2: MURAL DE AVISOS E CHECK-LIST DE FROTA
// =========================================================

window.abrirImagemGlobalOperacional = function(src) {
    let modal = document.getElementById('modal-imagem-global');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-imagem-global';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 999999; justify-content: center; align-items: center; backdrop-filter: blur(5px);';
        modal.onclick = function(e) { if(e.target.id === 'modal-imagem-global') modal.style.display = 'none'; };
        
        modal.innerHTML = `
            <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; justify-content: center; align-items: center;">
                <button onclick="document.getElementById('modal-imagem-global').style.display='none'" style="position: absolute; top: -15px; right: -15px; background: rgba(239, 68, 68, 0.9); border: 2px solid white; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; z-index: 100000; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: 0.2s;" onmouseover="this.style.background='#ef4444'" onmouseout="this.style.background='rgba(239, 68, 68, 0.9)'"><i class="fas fa-times"></i></button>
                <img id="img-modal-src-global" src="" style="max-width: 90vw; max-height: 85vh; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); object-fit: contain;">
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('img-modal-src-global').src = src;
    modal.style.display = 'flex';
};

window.muralSetorKey = 'mural_operacional';
window.muralSetorData = [];

window.formatarDataMural = function(dataIso) {
    if(!dataIso) return ''; const [ano, mes, dia] = dataIso.split('-'); return `${dia}/${mes}/${ano}`;
};

window.carregarMuralSetor = async function() {
    try {
        const db = window.getGlobalDB(); 
        if(!db) return;
        
        const { data } = await db.from('configuracoes').select('valor').eq('chave', window.muralSetorKey).limit(1);
        if (data && data.length > 0 && data[0].valor) {
            window.muralSetorData = JSON.parse(data[0].valor);
        } else {
            window.muralSetorData = [];
        }
        window.renderizarMuralSetor();
    } catch(e) { console.error("Erro ao carregar mural do setor:", e); }
};

window.renderizarMuralSetor = function() {
    const container = document.getElementById('lista-mural-setor');
    if(!container) return;
    if(window.muralSetorData.length === 0) {
        container.innerHTML = '<div class="text-slate-400 text-center py-3 text-sm">Nenhuma informação ou aviso no momento.</div>';
        return;
    }
    
    container.innerHTML = window.muralSetorData.map(item => {
        const imgHtml = item.imagem ? `<div class="mt-3"><img src="${item.imagem}" class="rounded-lg border border-slate-600 max-h-48 object-contain shadow-md" alt="Imagem Anexa" onclick="window.abrirImagemGlobalOperacional('${item.imagem}')" style="cursor: pointer; transition: 0.3s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"></div>` : '';
        return `
        <div class="flex items-start justify-between bg-slate-900/40 p-3 rounded-lg border-l-4 border-sky-400 border-t border-r border-b border-slate-700/50">
            <div class="flex-1">
                <div class="mb-1">
                    <span class="text-slate-400 text-xs font-bold mr-2"><i class="fas fa-calendar-day"></i> ${window.formatarDataMural(item.data)}</span>
                    <span class="text-white text-sm font-medium">${item.texto}</span>
                </div>
                ${imgHtml}
            </div>
            <button class="bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md transition-colors ml-3 mt-1" onclick="window.concluirMuralSetor(${item.id})" title="Concluir / Retirar">
                <i class="fas fa-check"></i>
            </button>
        </div>
        `;
    }).join('');
};

window.addMuralSetor = async function() {
    const dt = document.getElementById('data-mural-setor').value;
    const txt = document.getElementById('txt-mural-setor').value.trim();
    const imgInput = document.getElementById('img-mural-setor');

    if(!dt || !txt) { alert("Preencha a data e o texto para adicionar ao mural!"); return; }
    
    const finalizarAdicao = async (imagemBase64) => {
        window.muralSetorData.unshift({ id: Date.now(), data: dt, texto: txt, imagem: imagemBase64 });
        document.getElementById('txt-mural-setor').value = '';
        document.getElementById('lbl-nome-arquivo').innerText = '';
        if(imgInput) imgInput.value = '';
        
        window.renderizarMuralSetor();
        await window.salvarMuralSetor();
    };

    if (imgInput && imgInput.files && imgInput.files[0]) {
        const file = imgInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) { finalizarAdicao(e.target.result); };
        reader.readAsDataURL(file); 
    } else {
        finalizarAdicao(null);
    }
};

window.concluirMuralSetor = async function(id) {
    if(!confirm("Concluir e retirar este aviso do mural?")) return;
    window.muralSetorData = window.muralSetorData.filter(i => i.id !== id);
    window.renderizarMuralSetor();
    await window.salvarMuralSetor();
};

window.salvarMuralSetor = async function() {
    const msg = document.getElementById('msg-mural-setor');
    if(msg) { msg.className = 'text-xs font-bold text-slate-400'; msg.innerText = 'Salvando...'; }
    
    try {
        const db = window.getGlobalDB();
        await db.from('configuracoes').upsert([{ chave: window.muralSetorKey, valor: JSON.stringify(window.muralSetorData) }], { onConflict: 'chave' });
        
        if(msg) { 
            msg.className = 'text-xs font-bold text-emerald-400'; 
            msg.innerText = 'Salvo com sucesso!';
            setTimeout(() => msg.innerText='', 3000);
        }
    } catch(e) {
        if(msg) { msg.className = 'text-xs font-bold text-rose-500'; msg.innerText = 'Erro ao salvar!'; }
    }
};

window.frotaPendenciasData = [];

window.carregarFrotaSupabase = async function() {
    try {
        const db = window.getGlobalDB(); 
        const { data, error } = await db.from('frota_pendencias').select('*').order('data_criacao', { ascending: false });
        if (error) throw error;
        window.frotaPendenciasData = data || [];
        window.renderizarTabelaFrota();
    } catch (e) { console.error("Erro ao carregar frota:", e); }
};

window.toggleStatusSupabase = async function(id, campo, valorAtual) {
    try {
        const db = window.getGlobalDB();
        const { error } = await db.from('frota_pendencias').update({ [campo]: !valorAtual }).eq('id', id);
        if (error) throw error;
        window.carregarFrotaSupabase();
    } catch (e) { console.error("Erro ao atualizar status:", e); }
};

window.renderizarTabelaFrota = function() {
    const tbody = document.getElementById('lista-caminhoes-pendentes');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(window.frotaPendenciasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-slate-500">Nenhuma frota com pendência cadastrada.</td></tr>';
        return;
    }

    window.frotaPendenciasData.forEach(cam => {
        const getIcon = (status, campo) => status 
            ? `<i class="fas fa-check-circle text-emerald-400 text-lg cursor-pointer hover:scale-110 transition-transform" onclick="window.toggleStatusSupabase(${cam.id}, '${campo}', true)"></i>` 
            : `<i class="fas fa-times-circle text-rose-500 text-lg cursor-pointer hover:scale-110 transition-transform" onclick="window.toggleStatusSupabase(${cam.id}, '${campo}', false)"></i>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 bg-slate-900/40 text-white">${cam.placa}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.crlve, 'crlve')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.crono, 'crono')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.antt, 'antt')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.aet_fed, 'aet_fed')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.aet_est, 'aet_est')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.apr, 'apr')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.floresta, 'floresta')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.estrada, 'estrada')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.hosp, 'hosp')}</td>
            <td class="px-2 py-3 text-center">${getIcon(cam.eletromecanica, 'eletromecanica')}</td>
        `;
        tbody.appendChild(tr);
    });
};