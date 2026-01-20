import os
import sys
import logging
from datetime import datetime
from urllib.parse import quote_plus, urlparse, urlunparse

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from src.models.user import db
from src.models.company import Company
from src.models.supplier import Supplier
from src.models.appointment import Appointment
from src.models.schedule_config import ScheduleConfig
from src.models.default_schedule import DefaultSchedule
from src.models.system_config import SystemConfig
from src.models.plant import Plant
from src.models.operating_hours import OperatingHours
from src.models.permission import Permission
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.admin import admin_bp
from src.routes.supplier import supplier_bp
from src.routes.plant import plant_bp

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Criar aplicação Flask
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# SECRET_KEY: usar variável de ambiente em produção, fallback apenas para desenvolvimento
SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    # Apenas para desenvolvimento local - NUNCA usar em produção
    SECRET_KEY = 'asdf#FGSgvasgf$5$WGT'
    if os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production':
        raise ValueError("SECRET_KEY deve ser definida via variável de ambiente em produção!")
    logger.warning("⚠️ SECRET_KEY usando valor padrão de desenvolvimento. Defina SECRET_KEY como variável de ambiente em produção!")

app.config['SECRET_KEY'] = SECRET_KEY

# Habilitar CORS para permitir requisições do frontend
# IMPORTANTE: Em produção, substituir "*" por origens específicas
allowed_origins = os.environ.get('CORS_ORIGINS', '*')
if allowed_origins != '*':
    allowed_origins = [origin.strip() for origin in allowed_origins.split(',')]

CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

# ============================================================================
# CONFIGURAÇÃO DE BANCO DE DADOS - PostgreSQL
# ============================================================================
# Esta seção configura a conexão com o banco de dados PostgreSQL.
# A variável DATABASE_URL é OBRIGATÓRIA e deve ser fornecida via variável de ambiente.
# Em produção (Railway), configure em: Railway → Variables → DATABASE_URL
# ============================================================================

logger.info("=" * 80)
logger.info("🔍 INICIANDO CONFIGURAÇÃO DO BANCO DE DADOS")
logger.info("=" * 80)

# Ler DATABASE_URL da variável de ambiente - ÚNICA FONTE DE CONFIGURAÇÃO
# DEBUG: Verificar TODAS as variáveis de ambiente relacionadas
logger.info("=" * 80)
logger.info("🔍 DEBUG: Verificando variáveis de ambiente...")
logger.info("=" * 80)

# Listar todas as variáveis que começam com DATABASE ou POSTGRES
env_vars_db = {k: v for k, v in os.environ.items() if 'DATABASE' in k.upper() or 'POSTGRES' in k.upper()}
if env_vars_db:
    logger.info("Variáveis de ambiente relacionadas a banco encontradas:")
    for key, value in env_vars_db.items():
        # Mostrar valor parcialmente (sem senha completa)
        if 'PASSWORD' in key.upper() or 'URL' in key.upper():
            display_value = value[:30] + "..." if len(value) > 30 else value
            logger.info(f"  {key} = {display_value} (tamanho: {len(value)} chars)")
        else:
            logger.info(f"  {key} = {value}")
else:
    logger.warning("⚠️ Nenhuma variável de ambiente relacionada a banco encontrada!")

# Verificar especificamente DATABASE_URL
DATABASE_URL = os.environ.get("DATABASE_URL")

logger.info("-" * 80)
logger.info(f"Lendo DATABASE_URL especificamente...")
logger.info(f"  os.environ.get('DATABASE_URL'): {'DEFINIDO' if DATABASE_URL else 'NÃO DEFINIDO'}")
logger.info(f"  Tipo: {type(DATABASE_URL)}")
if DATABASE_URL:
    logger.info(f"  Tamanho da string: {len(DATABASE_URL)} caracteres")
    logger.info(f"  Primeiros 50 chars: {DATABASE_URL[:50]}...")
    logger.info(f"  Últimos 30 chars: ...{DATABASE_URL[-30:]}")
    logger.info(f"  É string vazia? {DATABASE_URL == ''}")
    logger.info(f"  Após strip(): '{DATABASE_URL.strip()}' (tamanho: {len(DATABASE_URL.strip())})")
else:
    logger.error("  ❌ DATABASE_URL está None ou não existe!")
    logger.error("  Verifique se a variável está configurada em Railway → Variables")
    logger.error("  Nome deve ser exatamente: DATABASE_URL (maiúsculas)")
    
logger.info("=" * 80)

# Validação 1: DATABASE_URL deve existir
if not DATABASE_URL:
    is_production = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT')
    
    error_msg = (
        "\n" + "=" * 80 + "\n"
        "❌ ERRO CRÍTICO: DATABASE_URL não está definida!\n\n"
        "A variável DATABASE_URL é OBRIGATÓRIA e deve ser configurada.\n\n"
    )
    
    if is_production:
        error_msg += (
            "📍 Você está em PRODUÇÃO (Railway).\n"
            "Configure a variável DATABASE_URL em:\n"
            "  Railway → Seu Projeto → Variables → + New Variable\n\n"
            "Nome: DATABASE_URL\n"
            "Valor: postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres\n\n"
            "Formato esperado: postgresql://user:password@host:port/database\n"
        )
    else:
        error_msg += (
            "📍 Você está em DESENVOLVIMENTO.\n"
            "Configure DATABASE_URL como variável de ambiente:\n\n"
            "Windows PowerShell:\n"
            "  $env:DATABASE_URL='postgresql://postgres:senha@localhost:5432/portal_wps'\n\n"
            "Linux/Mac:\n"
            "  export DATABASE_URL='postgresql://postgres:senha@localhost:5432/portal_wps'\n\n"
        )
    
    error_msg += "=" * 80
    
    logger.error(error_msg)
    raise ValueError(error_msg)

# Validação 2: DATABASE_URL não pode estar vazia
DATABASE_URL = DATABASE_URL.strip()
if not DATABASE_URL:
    error_msg = "❌ ERRO: DATABASE_URL está vazia (apenas espaços em branco)!"
    logger.error(error_msg)
    raise ValueError(error_msg)

logger.info(f"✅ DATABASE_URL encontrada: {DATABASE_URL[:50]}...")

# Processar e validar DATABASE_URL
try:
    # Converter postgresql:// para postgresql+psycopg2:// se necessário
    original_url = DATABASE_URL
    if DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
        logger.info("✅ Formato convertido: postgresql:// → postgresql+psycopg2://")
    
    # Parsear URL para validação e processamento
    parsed = urlparse(DATABASE_URL)
    
    # Validação 3: Verificar componentes essenciais
    if not parsed.scheme:
        raise ValueError("DATABASE_URL não contém scheme (postgresql:// ou postgresql+psycopg2://)")
    if not parsed.hostname:
        raise ValueError("DATABASE_URL não contém hostname")
    if not parsed.path or parsed.path == '/':
        raise ValueError("DATABASE_URL não contém nome do banco de dados")
    
    # Validação 4: Em produção, não permitir localhost
    is_production = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT')
    if is_production and parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
        error_msg = (
            f"❌ ERRO CRÍTICO: DATABASE_URL aponta para localhost em PRODUÇÃO!\n"
            f"Host detectado: {parsed.hostname}\n"
            f"Isso não é permitido em produção. Use um banco remoto (ex: Supabase)."
        )
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Codificar caracteres especiais na senha se necessário
    if parsed.password and any(char in parsed.password for char in ['$', '[', ']', '@', ':', '/', '?', '#']):
        encoded_password = quote_plus(parsed.password)
        if encoded_password != parsed.password:
            netloc = f"{parsed.username}:{encoded_password}@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            DATABASE_URL = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
            logger.info("✅ Senha codificada automaticamente (caracteres especiais detectados)")
    
    # Log da URL final (sem senha) para debug
    port_display = parsed.port if parsed.port else "5432"
    safe_url = f"{parsed.scheme}://{parsed.username}:***@{parsed.hostname}:{port_display}{parsed.path}"
    logger.info(f"✅ URL de conexão processada: {safe_url}")
    logger.info(f"   Host: {parsed.hostname}")
    logger.info(f"   Porta: {parsed.port or '5432'}")
    logger.info(f"   Database: {parsed.path.lstrip('/')}")
    
except Exception as e:
    error_msg = f"❌ ERRO ao processar DATABASE_URL: {e}\nURL fornecida: {DATABASE_URL[:50]}..."
    logger.error(error_msg)
    raise ValueError(error_msg) from e

logger.info("=" * 80)
logger.info("✅ CONFIGURAÇÃO DO BANCO DE DADOS VALIDADA COM SUCESSO")
logger.info("=" * 80)

# Configurar SQLAlchemy com DATABASE_URL processada
# Esta é a ÚNICA configuração de banco de dados - não há outras
logger.info("Configurando SQLAlchemy...")
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configurações otimizadas para ambiente cloud (Railway + Supabase)
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,  # Verifica conexão antes de usar (evita conexões quebradas)
    'pool_recycle': 300,     # Recicla conexões a cada 5 minutos
    'pool_size': 5,          # Tamanho do pool de conexões
    'max_overflow': 10,      # Máximo de conexões extras
    'connect_args': {
        'connect_timeout': 10,      # Timeout de conexão: 10 segundos
        'sslmode': 'require',       # SSL obrigatório (Supabase requer)
        'application_name': 'portal_wps_backend'  # Identificação da aplicação
    }
}

logger.info("✅ SQLAlchemy configurado com sucesso")
logger.info(f"   URI configurada: {safe_url}")

# Inicializar banco de dados
# Esta é a ÚNICA inicialização - db.init_app() cria o engine do SQLAlchemy
logger.info("=" * 80)
logger.info("🔌 INICIALIZANDO CONEXÃO COM BANCO DE DADOS")
logger.info("=" * 80)

try:
    logger.info("Inicializando SQLAlchemy...")
    db.init_app(app)
    logger.info("✅ SQLAlchemy inicializado")
    
    logger.info("Testando conexão com banco de dados...")
    with app.app_context():
        # Teste de conexão antes de criar tabelas
        db.session.execute(db.text('SELECT 1'))
        logger.info("✅ Conexão com banco de dados estabelecida com sucesso")
        
        logger.info("Criando/verificando tabelas...")
        db.create_all()
        logger.info("✅ Tabelas verificadas/criadas com sucesso")
    
    logger.info("=" * 80)
    logger.info("✅ BANCO DE DADOS INICIALIZADO COM SUCESSO")
    logger.info("=" * 80)
    
except Exception as e:
    logger.error("=" * 80)
    logger.error("❌ ERRO AO INICIALIZAR BANCO DE DADOS")
    logger.error("=" * 80)
    logger.error(f"Tipo do erro: {type(e).__name__}")
    logger.error(f"Mensagem: {str(e)}")
    
    import traceback
    logger.error(f"\nTraceback completo:\n{traceback.format_exc()}")
    
    # Diagnóstico específico para erros de conexão
    error_str = str(e).lower()
    error_type_str = str(type(e)).lower()
    
    logger.error("\n" + "=" * 80)
    logger.error("🔍 DIAGNÓSTICO DETALHADO DO ERRO")
    logger.error("=" * 80)
    
    # Mostrar informações da URL (sem senha)
    try:
        parsed_diag = urlparse(DATABASE_URL)
        logger.error(f"Host tentado: {parsed_diag.hostname}")
        logger.error(f"Porta tentada: {parsed_diag.port or '5432'}")
        logger.error(f"Database tentado: {parsed_diag.path.lstrip('/')}")
        logger.error(f"Usuário: {parsed_diag.username}")
        logger.error(f"Senha configurada: {'SIM' if parsed_diag.password else 'NÃO'}")
    except:
        logger.error(f"URL completa (primeiros 80 chars): {DATABASE_URL[:80]}...")
    
    if 'operationalerror' in error_str or 'operationalerror' in error_type_str or 'connection' in error_str:
        logger.error("\n" + "=" * 80)
        logger.error("🔍 ERRO DE CONEXÃO COM BANCO DE DADOS")
        logger.error("=" * 80)
        logger.error("O erro indica problema ao conectar com o PostgreSQL.")
        logger.error(f"\nMensagem completa do erro:")
        logger.error(f"   {str(e)}")
        
        logger.error("\n" + "-" * 80)
        logger.error("CHECKLIST DE VERIFICAÇÃO:")
        logger.error("-" * 80)
        logger.error("1. ✅ DATABASE_URL está configurada no Railway → Variables?")
        logger.error("2. ✅ A URL está no formato correto?")
        logger.error("   Formato esperado: postgresql://user:password@host:port/database")
        logger.error("3. ✅ A senha está correta? (sem colchetes [])")
        logger.error("4. ✅ O host está acessível do Railway?")
        logger.error("5. ✅ O firewall do Supabase permite conexões do Railway?")
        logger.error("   → Verifique em Supabase → Settings → Database → Network Restrictions")
        logger.error("6. ✅ O banco de dados existe no Supabase?")
        logger.error("7. ✅ Está usando Direct connection ou Session Pooler?")
        logger.error("   → Se IPv4, use Session Pooler (porta 6543)")
        
        # Verificar se é erro de SSL
        if 'ssl' in error_str or 'certificate' in error_str:
            logger.error("\n⚠️ ERRO RELACIONADO A SSL:")
            logger.error("   O Supabase requer SSL. Verifique se 'sslmode: require' está configurado.")
        
        # Verificar se é erro de autenticação
        if 'password' in error_str or 'authentication' in error_str:
            logger.error("\n⚠️ ERRO DE AUTENTICAÇÃO:")
            logger.error("   A senha pode estar incorreta ou com caracteres especiais não codificados.")
            logger.error("   Verifique a senha no Supabase → Settings → Database")
        
        # Verificar se é erro de host não encontrado
        if 'could not resolve' in error_str or 'name or service not known' in error_str:
            logger.error("\n⚠️ ERRO DE RESOLUÇÃO DE HOST:")
            logger.error("   O hostname não pode ser resolvido.")
            logger.error("   Verifique se o hostname está correto na URL.")
        
        logger.error("\n" + "=" * 80)
        logger.error("💡 SOLUÇÕES SUGERIDAS:")
        logger.error("=" * 80)
        logger.error("1. Verifique os logs acima para ver qual host está sendo usado")
        logger.error("2. Teste a conexão manualmente:")
        logger.error("   psql 'postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres'")
        logger.error("3. Se usar IPv4, mude para Session Pooler no Supabase")
        logger.error("4. Verifique Network Restrictions no Supabase")
        logger.error("=" * 80)
    else:
        logger.error(f"\nTipo de erro não relacionado a conexão: {type(e).__name__}")
        logger.error(f"Mensagem: {str(e)}")
    
    logger.error("\nDATABASE_URL atual (primeiros 80 chars, sem senha):")
    try:
        parsed_display = urlparse(DATABASE_URL)
        safe_display = f"{parsed_display.scheme}://{parsed_display.username}:***@{parsed_display.hostname}:{parsed_display.port or '5432'}{parsed_display.path}"
        logger.error(f"   {safe_display}")
    except:
        logger.error(f"   {DATABASE_URL[:80]}...")
    logger.error("=" * 80)
    
    raise

# Registrar blueprints
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(supplier_bp, url_prefix='/api/supplier')
app.register_blueprint(plant_bp, url_prefix='/api/plant')
logger.info("Blueprints registrados com sucesso")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de health check para verificar se o servidor está respondendo"""
    try:
        # Verificar conexão com banco de dados
        with app.app_context():
            db.session.execute(db.text('SELECT 1'))
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'connected',
            'service': 'Cargo Flow Backend'
        }), 200
    except Exception as e:
        logger.error(f"Health check falhou: {e}")
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 503

@app.route('/api', methods=['GET'])
def api_root():
    """Endpoint raiz da API"""
    return jsonify({
        'message': 'Cargo Flow API está funcionando!',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat(),
            'endpoints': {
            'health': '/api/health',
            'auth': '/api/login',
            'admin': '/api/admin/*',
            'supplier': '/api/supplier/*',
            'plant': '/api/plant/*'
        }
    }), 200

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve arquivos estáticos do frontend (se existirem)"""
    # Não capturar rotas da API - elas devem ser tratadas pelos blueprints
    if path.startswith('api/'):
        logger.warning(f"⚠️ Rota catch-all capturou requisição da API: /{path}")
        logger.warning("Isso não deveria acontecer! Verifique se a rota está registrada corretamente.")
        return jsonify({
            'error': 'Rota da API não encontrada',
            'path': f'/{path}',
            'message': 'Verifique se a rota está registrada corretamente no backend.',
            'api_root': '/api',
            'timestamp': datetime.utcnow().isoformat()
        }), 404
    
    static_folder_path = app.static_folder
    
    if static_folder_path is None:
        return jsonify({
            'message': 'Backend API está rodando. Use /api para acessar a API.',
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return jsonify({
                'message': 'Backend API está rodando. Frontend não encontrado.',
                'api_root': '/api',
                'timestamp': datetime.utcnow().isoformat()
            }), 200

@app.errorhandler(404)
def not_found(error):
    """Handler para rotas não encontradas"""
    return jsonify({'error': 'Rota não encontrada'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handler para erros internos do servidor"""
    logger.error("Erro interno do servidor", exc_info=True)
    return jsonify({'error': 'Erro interno do servidor'}), 500


if __name__ == '__main__':
    try:
        import warnings
        # Suprimir aviso do Werkzeug sobre servidor de desenvolvimento
        warnings.filterwarnings('ignore', message='.*development server.*')
        
        # Configurar logging do Werkzeug para não mostrar avisos
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
        
        # Verificar se está em modo produção
        is_production = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production'
        debug_mode = not is_production and os.environ.get('DEBUG', 'False').lower() == 'true'
        
        if is_production and debug_mode:
            logger.warning("⚠️ DEBUG MODE DESABILITADO EM PRODUÇÃO!")
            debug_mode = False
        
        # Porta do Railway ou padrão 5000 para desenvolvimento
        port = int(os.environ.get('PORT', 5000))
        
        logger.info("Iniciando servidor Cargo Flow Backend...")
        logger.info(f"Servidor rodará em http://0.0.0.0:{port}")
        logger.info(f"API disponível em http://localhost:{port}/api")
        logger.info(f"Modo: {'DESENVOLVIMENTO' if debug_mode else 'PRODUÇÃO'}")
        app.run(host='0.0.0.0', port=port, debug=debug_mode, use_reloader=False)
    except KeyboardInterrupt:
        logger.info("Servidor interrompido pelo usuário")
    except Exception as e:
        logger.error(f"Erro ao iniciar servidor: {e}")
        raise
