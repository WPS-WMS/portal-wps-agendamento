from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from src.models.user import User, db
from src.models.password_reset_token import PasswordResetToken
from src.utils.email_service import EmailService
import logging
import os

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# SECRET_KEY: usar a mesma do main.py (via variável de ambiente em produção)
SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET_KEY') or 'asdf#FGSgvasgf$5$WGT'

# Inicializar serviço de e-mail
email_service = EmailService()

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
        if user and user.is_active:
            try:
                # Obter tempo de expiração (padrão: 60 minutos)
                expiry_minutes = int(os.environ.get('RESET_TOKEN_EXPIRY', 60))
                
                # Criar token de recuperação
                reset_token = PasswordResetToken.create_token(user.id, expiry_minutes)
                
                # Enviar e-mail com link de recuperação
                email_sent = email_service.send_password_reset_email(user.email, reset_token.token)
                
                if not email_sent:
                    logger.warning(f"Falha ao enviar e-mail de recuperação para {user.email}")
                    # Não expor erro ao usuário por segurança
                
            except Exception as e:
                logger.error(f"Erro ao processar recuperação de senha para {email}: {str(e)}")
                # Não expor erro ao usuário por segurança
        
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

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Endpoint para redefinir senha usando token"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        token = data.get('token')
        new_password = data.get('password')
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 400
        
        if not new_password:
            return jsonify({'error': 'Nova senha não fornecida'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'A senha deve ter no mínimo 6 caracteres'}), 400
        
        # Buscar token válido
        reset_token = PasswordResetToken.find_valid_token(token)
        
        if not reset_token:
            return jsonify({'error': 'Token inválido ou expirado'}), 400
        
        # Atualizar senha do usuário
        user = reset_token.user
        user.set_password(new_password)
        
        # Marcar token como usado
        reset_token.mark_as_used()
        
        db.session.commit()
        
        logger.info(f"Senha redefinida com sucesso para usuário {user.email}")
        
        return jsonify({
            'message': 'Senha redefinida com sucesso. Você já pode fazer login com a nova senha.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao redefinir senha: {str(e)}")
        return jsonify({'error': 'Erro ao redefinir senha. Tente novamente.'}), 500

@auth_bp.route('/verify-reset-token', methods=['POST'])
def verify_reset_token():
    """Verifica se um token de recuperação é válido"""
    try:
        data = request.get_json()
        
        if not data or not data.get('token'):
            return jsonify({'valid': False}), 400
        
        token = data['token']
        reset_token = PasswordResetToken.find_valid_token(token)
        
        if reset_token:
            return jsonify({'valid': True}), 200
        else:
            return jsonify({'valid': False}), 200
        
    except Exception as e:
        logger.error(f"Erro ao verificar token: {str(e)}")
        return jsonify({'valid': False}), 200
