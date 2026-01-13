import os
import sys
import logging
from datetime import datetime

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from src.models.user import db
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
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# Habilitar CORS para permitir requisições do frontend
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configurar banco de dados
database_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
database_dir = os.path.dirname(database_path)

# Criar diretório do banco de dados se não existir
if not os.path.exists(database_dir):
    os.makedirs(database_dir)
    logger.info(f"Diretório do banco de dados criado: {database_dir}")

app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{database_path}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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
    logger.error(f"Erro interno do servidor: {error}")
    return jsonify({'error': 'Erro interno do servidor'}), 500


if __name__ == '__main__':
    try:
        import warnings
        # Suprimir aviso do Werkzeug sobre servidor de desenvolvimento
        warnings.filterwarnings('ignore', message='.*development server.*')
        
        # Configurar logging do Werkzeug para não mostrar avisos
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
        
        logger.info("Iniciando servidor Cargo Flow Backend...")
        logger.info("Servidor rodará em http://0.0.0.0:5000")
        logger.info("API disponível em http://localhost:5000/api")
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        logger.info("Servidor interrompido pelo usuário")
    except Exception as e:
        logger.error(f"Erro ao iniciar servidor: {e}")
        raise
