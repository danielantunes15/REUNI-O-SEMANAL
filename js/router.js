const moduleCache = {};

async function loadModuleContent(setorId, submenuId) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    
    // Mostrar loading
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <span>Carregando...</span>
        </div>
    `;
    
    // Atualizar título
    const setor = menuConfig.find(s => s.id === setorId);
    const submenu = setor?.submenus.find(s => s.id === submenuId);
    
    if (setor) {
        document.getElementById('setor-title').textContent = setor.nome;
        document.getElementById('setor-subtitle').textContent = submenu?.nome || 'Dashboard';
    }
    
    try {
        // Tentar carregar do cache
        let html = moduleCache[`${setorId}_${submenuId}`];
        
        if (!html) {
            // Simular carregamento de módulo (em produção, seria fetch)
            html = await getModuleTemplate(setorId, submenuId);
            moduleCache[`${setorId}_${submenuId}`] = html;
        }
        
        container.innerHTML = html;
        
        // Inicializar scripts específicos do módulo
        if (window[`init_${setorId}_${submenuId}`]) {
            window[`init_${setorId}_${submenuId}`]();
        }
        
    } catch (error) {
        console.error('Erro ao carregar módulo:', error);
        container.innerHTML = `
            <div class="error" style="text-align: center; padding: 3rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--accent-danger);"></i>
                <h3>Erro ao carregar conteúdo</h3>
                <p>Tente novamente mais tarde.</p>
            </div>
        `;
    }
}

async function getModuleTemplate(setorId, submenuId) {
    // Templates simulados para cada módulo
    const templates = {
        rh_indicadores: getRhIndicadoresTemplate(),
        rh_funcionarios: getRhFuncionariosTemplate(),
        rh_treinamentos: getRhTreinamentosTemplate(),
        op_producao: getOpProducaoTemplate(),
        op_eficiencia: getOpEficienciaTemplate(),
        op_entregas: getOpEntregasTemplate(),
        man_ordens: getManOrdensTemplate(),
        man_preventiva: getManPreventivaTemplate(),
        man_equipamentos: getManEquipamentosTemplate(),
        ssma_indicadores: getSsmaIndicadoresTemplate(),
        ssma_treinamentos: getSsmaTreinamentosTemplate(),
        ssma_auditorias: getSsmaAuditoriasTemplate(),
        cons_resumo: getConsResumoTemplate(),
        cons_metas: getConsMetasTemplate(),
        cons_acoes: getConsAcoesTemplate(),
        conf_geral: getConfGeralTemplate(),
        conf_usuarios: getConfUsuariosTemplate(),
        conf_setores: getConfSetoresTemplate(),
        conf_backup: getConfBackupTemplate()
    };
    
    return templates[`${setorId}_${submenuId}`] || getDefaultTemplate();
}

function getDefaultTemplate() {
    return `
        <div style="text-align: center; padding: 3rem;">
            <i class="fas fa-chart-line" style="font-size: 3rem; color: var(--accent-primary);"></i>
            <h2>Módulo em desenvolvimento</h2>
            <p>Conteúdo será implementado em breve.</p>
        </div>
    `;
}