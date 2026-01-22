from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from src.models.user import User, db
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# SECRET_KEY: usar a mesma do main.py (via variável de ambiente em produção)
import os
SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET_KEY') or 'asdf#FGSgvasgf$5$WGT'

@auth_bp.route('/login', methods=['POST'])
def login():
    """Endpoint de login que retorna JWT token"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Email e senha são obrigatórios'}), 400
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email e senha são obrigatórios'}), 400
        
        email = data.get('email')
        # Nota: email agora é único por company, mas para login precisamos buscar em todas as companies
        # Isso é seguro porque o email+company_id é único, então ainda há isolamento
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # Não expor informações sobre usuários existentes (segurança)
            return jsonify({'error': 'Credenciais inválidas'}), 401
        
        if not user.check_password(data['password']):
            # Não expor se a senha está incorreta (segurança)
            return jsonify({'error': 'Credenciais inválidas'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Usuário inativo'}), 403
        
        # Gerar JWT token
        payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.role,
            'supplier_id': user.supplier_id,
            'plant_id': user.plant_id,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'token': token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        # Não logar detalhes de erro em produção (segurança)
        logger.error("Erro no login", exc_info=False)
        return jsonify({'error': 'Erro ao processar login. Tente novamente.'}), 500

@auth_bp.route('/verify', methods=['GET'])
def verify_token():
    """Verifica se o token JWT é válido"""
    try:
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        # Remove 'Bearer ' do início do token se presente
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        
        user = User.query.get(payload['user_id'])
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 401
        
        return jsonify({
            'valid': True,
            'user': user.to_dict()
        }), 200
        
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expirado'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Token inválido'}), 401
    except Exception as e:
        logger.error("Erro ao verificar token", exc_info=True)
        return jsonify({'error': 'Erro ao verificar token'}), 500

def token_required(f):
    """Decorator para proteger rotas que requerem autenticação"""
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(payload['user_id'])
            
            if not current_user:
                return jsonify({'error': 'Usuário não encontrado'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        except Exception as e:
            logger.error(f"Erro ao validar token: {str(e)}", exc_info=True)
            return jsonify({'error': 'Erro ao validar autenticação'}), 500
        
        return f(current_user, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

def admin_required(f):
    """Decorator para proteger rotas que requerem privilégios de admin"""
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(payload['user_id'])
            
            if not current_user:
                return jsonify({'error': 'Usuário não encontrado'}), 401
            
            if current_user.role != 'admin':
                return jsonify({'error': 'Acesso negado. Privilégios de administrador necessários'}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        except Exception as e:
            logger.error(f"Erro ao validar token admin: {str(e)}", exc_info=True)
            return jsonify({'error': 'Erro ao validar autenticação'}), 500
        
        return f(current_user, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

def plant_required(f):
    """Decorator para proteger rotas que requerem privilégios de planta"""
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(payload['user_id'])
            
            if not current_user:
                return jsonify({'error': 'Usuário não encontrado'}), 401
            
            if current_user.role != 'plant':
                return jsonify({'error': 'Acesso negado. Privilégios de planta necessários'}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        except Exception as e:
            logger.error(f"Erro ao validar token plant: {str(e)}", exc_info=True)
            return jsonify({'error': 'Erro ao validar autenticação'}), 500
        
        return f(current_user, *args, **kwargs)
    
    decorated.__name__ = f.__name__
    return decorated

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Endpoint para solicitar recuperação de senha (RN03)"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        data = request.get_json()
        
        if not data or not data.get('email'):
            # RN03 - Sempre retornar mensagem genérica
            return jsonify({
                'message': 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.'
            }), 200
        
        email = data['email']
        user = User.query.filter_by(email=email).first()
        
        # RN03 - Mesmo que o usuário não exista, retornar sucesso
        # Isso evita enumerar emails válidos no sistema
        if user:
            # Aqui você implementaria:
            # 1. Gerar token de recuperação com expiração (30-60min)
            # 2. Salvar token no banco de dados
            # 3. Enviar email com link de recuperação
            # 
            # Por enquanto, não implementado envio de email
            pass
        
        # RN03 - Sempre mesma mensagem, não informar se email existe
        return jsonify({
            'message': 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.'
        }), 200
        
    except Exception as e:
        # Mesmo em caso de erro, não expor detalhes
        logger.error(f"Erro em forgot_password: {e}")
        return jsonify({
            'message': 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.'
        }), 200
