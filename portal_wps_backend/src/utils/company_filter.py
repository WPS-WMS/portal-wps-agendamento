"""
Utilitário para garantir isolamento multi-tenant por company_id
"""
from functools import wraps
from flask import request, jsonify
import jwt
from src.models.user import User
from src.models.company import Company

# SECRET_KEY: usar variável de ambiente em produção
import os
SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET_KEY') or 'asdf#FGSgvasgf$5$WGT'

def get_current_user_from_token():
    """Extrai o usuário atual do token JWT"""
    token = request.headers.get('Authorization')
    
    if not token:
        return None
    
    try:
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = User.query.get(payload['user_id'])
        
        return current_user
    except:
        return None

def get_current_company_id():
    """Obtém o company_id do usuário atual logado"""
    current_user = get_current_user_from_token()
    if current_user:
        return current_user.company_id
    return None

def filter_by_company(query, model_class, company_id=None):
    """
    Aplica filtro de company_id em uma query
    
    Args:
        query: Query SQLAlchemy
        model_class: Classe do modelo (deve ter atributo company_id)
        company_id: ID da empresa (se None, obtém do usuário atual)
    
    Returns:
        Query filtrada por company_id
    """
    if company_id is None:
        company_id = get_current_company_id()
    
    if company_id is None:
        # Se não há company_id, retornar query vazia para segurança
        return query.filter(False)
    
    # Verificar se o modelo tem company_id
    if hasattr(model_class, 'company_id'):
        return query.filter(model_class.company_id == company_id)
    
    return query

def ensure_company_isolation(model_instance, company_id=None):
    """
    Valida se uma instância de modelo pertence à company do usuário atual
    
    Args:
        model_instance: Instância do modelo
        company_id: ID da empresa (se None, obtém do usuário atual)
    
    Returns:
        bool: True se pertence à company, False caso contrário
    
    Raises:
        ValueError: Se model_instance não tem company_id
    """
    if not hasattr(model_instance, 'company_id'):
        raise ValueError(f"Modelo {type(model_instance).__name__} não possui company_id")
    
    if company_id is None:
        company_id = get_current_company_id()
    
    if company_id is None:
        return False
    
    return model_instance.company_id == company_id

def validate_company_consistency(*models):
    """
    Valida se múltiplos modelos pertencem à mesma company
    
    Args:
        *models: Instâncias de modelos para validar
    
    Returns:
        bool: True se todos pertencem à mesma company, False caso contrário
    """
    if not models:
        return True
    
    company_ids = []
    for model in models:
        if hasattr(model, 'company_id'):
            company_ids.append(model.company_id)
        elif model is None:
            continue
        else:
            raise ValueError(f"Modelo {type(model).__name__} não possui company_id")
    
    # Todos devem ter o mesmo company_id (ou None para alguns casos especiais)
    unique_ids = set(filter(None, company_ids))
    return len(unique_ids) <= 1

def company_required(f):
    """
    Decorator que garante que a função recebe current_user com company_id válido
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        from src.routes.auth import get_current_user_from_token as auth_get_user
        current_user = auth_get_user()
        
        if not current_user:
            return jsonify({'error': 'Token não fornecido ou inválido'}), 401
        
        if not current_user.company_id:
            return jsonify({'error': 'Usuário não está associado a uma empresa'}), 403
        
        return f(*args, **kwargs)
    
    return decorated
