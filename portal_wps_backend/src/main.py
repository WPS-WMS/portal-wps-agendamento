import os
import sys
import logging
from datetime import datetime
from urllib.parse import quote_plus, urlparse, urlunparse

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify, request
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
from src.models.password_reset_token import PasswordResetToken
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.admin import admin_bp
from src.routes.supplier import supplier_bp
from src.routes.plant import plant_bp

# Configurar logging
# Em produção, usar WARNING para reduzir logs desnecessários
log_level = logging.WARNING if (os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production') else logging.INFO
logging.basicConfig(
    level=log_level,
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
# Em produção, aceitar origens específicas do Firebase Hosting e domínio customizado
# Domínios padrão: Firebase Hosting e domínio customizado cargoflow.app.br
default_origins = [
    'https://portal-agendamentos-cargoflow.web.app',
    'https://portal-agendamentos-cargoflow.firebaseapp.com',
    'https://cargoflow.app.br',
    'http://localhost:5173',  # Vite dev server
    'http://localhost:3000',  # Desenvolvimento alternativo
]

# Sempre incluir cargoflow.app.br - domínio crítico para produção
critical_origins = ['https://cargoflow.app.br']

# Permitir adicionar mais origens via variável de ambiente
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
if cors_origins_env and cors_origins_env.strip() != '*':
    # Se CORS_ORIGINS estiver definida e não for '*', usar ela (pode ser uma lista separada por vírgula)
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
    # SEMPRE adicionar domínios críticos e padrão se não estiverem na lista
    for origin in critical_origins + default_origins:
        if origin not in allowed_origins:
            allowed_origins.append(origin)
else:
    # Se não estiver definida ou for '*', usar apenas os domínios padrão (que já incluem cargoflow.app.br)
    allowed_origins = default_origins

# Remover duplicatas mantendo a ordem
seen = set()
allowed_origins = [x for x in allowed_origins if not (x in seen or seen.add(x))]

# Configuração completa de CORS com suporte a credenciais e métodos
CORS(app, 
     resources={r"/api/*": {
         "origins": allowed_origins,
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
         "expose_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600
     }})

logger.info(f"CORS configurado com as seguintes origens permitidas: {', '.join(allowed_origins)}")

# Configurar banco de dados PostgreSQL
DATABASE_URL = os.environ.get("DATABASE_URL")

# Validação: DATABASE_URL é obrigatória
if not DATABASE_URL:
    is_production = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT')
    
    if is_production:
        error_msg = (
            "DATABASE_URL não está definida! Configure em Railway → Variables → DATABASE_URL\n"
            "Formato: postgresql://user:password@host:port/database"
        )
    else:
        error_msg = (
            "DATABASE_URL não está definida! Configure como variável de ambiente.\n"
            "Exemplo: DATABASE_URL=postgresql://postgres:senha@localhost:5432/portal_wps"
        )
    
    logger.error(error_msg)
    raise ValueError(error_msg)

# Validação: DATABASE_URL não pode estar vazia
DATABASE_URL = DATABASE_URL.strip()
if not DATABASE_URL:
    raise ValueError("DATABASE_URL está vazia")

# Processar e validar DATABASE_URL
try:
    # Converter postgresql:// para postgresql+psycopg2:// se necessário
    if DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    # Parsear URL para validação e processamento
    parsed = urlparse(DATABASE_URL)
    
    # Validação: Verificar componentes essenciais
    if not parsed.scheme:
        raise ValueError("DATABASE_URL não contém scheme")
    if not parsed.hostname:
        raise ValueError("DATABASE_URL não contém hostname")
    if not parsed.path or parsed.path == '/':
        raise ValueError("DATABASE_URL não contém nome do banco de dados")
    
    # Validação: Em produção, não permitir localhost
    is_production = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT')
    if is_production and parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
        raise ValueError(f"DATABASE_URL aponta para localhost em produção: {parsed.hostname}")
    
    # Codificar caracteres especiais na senha se necessário
    if parsed.password and any(char in parsed.password for char in ['$', '[', ']', '@', ':', '/', '?', '#']):
        encoded_password = quote_plus(parsed.password)
        if encoded_password != parsed.password:
            netloc = f"{parsed.username}:{encoded_password}@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            DATABASE_URL = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
    
except Exception as e:
    raise ValueError(f"Erro ao processar DATABASE_URL: {e}") from e

# Configurar SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_size': 5,
    'max_overflow': 10,
    'connect_args': {
        'connect_timeout': 10,
        'sslmode': 'require',
        'application_name': 'portal_wps_backend'
    }
}

# Inicializar banco de dados
try:
    db.init_app(app)
    with app.app_context():
        db.create_all()
    logger.info("Banco de dados inicializado com sucesso")
except Exception as e:
    logger.error(f"Erro ao inicializar banco de dados: {e}")
    raise

# Registrar blueprints
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(supplier_bp, url_prefix='/api/supplier')
app.register_blueprint(plant_bp, url_prefix='/api/plant')
logger.info("Blueprints registrados com sucesso")

# Handler manual para requisições OPTIONS (preflight) - garante que CORS funcione
@app.before_request
def handle_preflight():
    """Handler para requisições OPTIONS (preflight)"""
    if request.method == "OPTIONS":
        origin = request.headers.get('Origin')
        if origin in allowed_origins:
            response = jsonify({})
            response.headers.add("Access-Control-Allow-Origin", origin)
            response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With")
            response.headers.add('Access-Control-Allow-Methods', "GET,POST,PUT,DELETE,OPTIONS,PATCH")
            response.headers.add('Access-Control-Allow-Credentials', "true")
            response.headers.add('Access-Control-Max-Age', "3600")
            return response

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
