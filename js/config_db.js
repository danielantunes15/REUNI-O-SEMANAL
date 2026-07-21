// js/config_db.js

// 1. Credenciais do Banco de Dados Único (Centralizado)
const SUPABASE_CONFIG = {
    url: 'https://eufqcuyzfvomnoaplhgj.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZnFjdXl6ZnZvbW5vYXBsaGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTA2NzMsImV4cCI6MjA5ODk2NjY3M30.VyJkfzTIru5GS0bkQowWHUGoglBGipTRcXGDCTH8jxk'
};

// 2. Inicialização Centralizada do Banco de Dados
// Verifica se a biblioteca do Supabase foi carregada no index.html
if (typeof supabase !== 'undefined') {
    // Cria a conexão uma única vez
    window.supabaseClientGlobal = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    
    // Opcional: Criar um atalho mais curto e fácil de usar nos outros arquivos
    window.db = window.supabaseClientGlobal; 
    
    console.log("✅ Conexão com o banco de dados centralizada com sucesso!");
} else {
    console.error("❌ Erro: Biblioteca do Supabase não encontrada. Verifique o import no index.html.");
}

// 3. Função utilitária para garantir que o banco está acessível (opcional)
window.getDbClient = function() {
    return window.supabaseClientGlobal;
};