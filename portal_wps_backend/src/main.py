import os
import sys
import logging
from datetime import datetime

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

# Configurar banco de dados (PostgreSQL por padrão)
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    pg_user = os.environ.get("POSTGRES_USER", "postgres")
    pg_password = os.environ.get("POSTGRES_PASSWORD", "")
    pg_host = os.environ.get("POSTGRES_HOST", "localhost")
    pg_port = os.environ.get("POSTGRES_PORT", "5432")
    pg_db = os.environ.get("POSTGRES_DB", "portal_wps")

    is_production = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENVIRONMENT') == 'production'
    if not pg_password and is_production:
        raise ValueError("POSTGRES_PASSWORD deve ser definida em produção para conexão segura ao PostgreSQL.")
    if not pg_password:
        logger.warning("⚠️ POSTGRES_PASSWORD não definido; conectando sem senha (apenas recomendado em desenvolvimento).")

    # Monta a URL no formato postgresql+psycopg2://user:pass@host:port/db
    auth_part = f"{pg_user}:{pg_password}@" if pg_password else f"{pg_user}@"
    DATABASE_URL = f"postgresql+psycopg2://{auth_part}{pg_host}:{pg_port}/{pg_db}"
    logger.info(f"SQLALCHEMY_DATABASE_URI montada via variáveis individuais: {DATABASE_URL}")
else:
    logger.info("SQLALCHEMY_DATABASE_URI definida via DATABASE_URL.")

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Pre-ping evita conexões quebradas em provedores cloud/serverless
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}

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
