"""
Utilitários para verificação de permissões granulares
"""
from functools import wraps
from flask import request, jsonify
import jwt
from src.models.user import User
from src.models.permission import Permission

SECRET_KEY = 'asdf#FGSgvasgf$5$WGT'  # Mesma chave do auth.py

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

def has_permission(function_id, required_permission='editor', current_user=None):
    """
    Verifica se o usuário atual tem a permissão necessária para uma funcionalidade
    
    REGRA DE NEGÓCIO:
    - Admin sempre tem acesso completo (bypass de todas as verificações)
    - Editor (permission_type='editor') tem EXATAMENTE os mesmos privilégios que Admin
      dentro da funcionalidade configurada (acesso completo: criar, editar, excluir, etc.)
    - Viewer (permission_type='viewer') pode apenas visualizar (sem ações)
    - None (permission_type='none') não tem acesso (bloqueado)
    
    Args:
        function_id: ID da funcionalidade (ex: 'create_appointment')
        required_permission: Tipo de permissão necessário ('editor', 'viewer', 'none')
        current_user: Usuário atual (opcional, será obtido do token se não fornecido)
    
    Returns:
        bool: True se o usuário tem permissão, False caso contrário
    """
    if current_user is None:
        current_user = get_current_user_from_token()
    
    if not current_user:
        return False
    
    if not current_user.is_active:
        return False
    
    # REGRA DE NEGÓCIO: Admin sempre tem acesso completo (bypass)
    if current_user.role == 'admin':
        return True
    
    # Buscar permissão configurada para o role do usuário
    permission_type = Permission.get_permission(current_user.role, function_id)
    
    # Log para debug
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Verificando permissão: function_id={function_id}, role={current_user.role}, permission_type={permission_type}, required={required_permission}")
    
    # REGRA DE NEGÓCIO: Hierarquia de permissões
    # Editor (nível 2) = Admin dentro da funcionalidade (acesso completo)
    # Viewer (nível 1) = apenas visualização
    # None (nível 0) = sem acesso
    permission_hierarchy = {
        'none': 0,
        'viewer': 1,
        'editor': 2  # Editor tem nível máximo (equivalente a Admin)
    }
    
    user_permission_level = permission_hierarchy.get(permission_type, 0)
    # Se required_permission não estiver na hierarquia, usar 'editor' (nível 2) como padrão máximo
    required_permission_level = permission_hierarchy.get(required_permission, 2)
    
    # REGRA DE NEGÓCIO: Editor (nível 2) sempre tem acesso se o nível requerido for <= 2
    # Isso garante que Editor tem os mesmos privilégios que Admin
    has_access = user_permission_level >= required_permission_level
    logger.info(f"Resultado: user_level={user_permission_level}, required_level={required_permission_level}, has_access={has_access}")
    
    return has_access

def permission_required(function_id, required_permission='editor'):
    """
    Decorator para proteger rotas com verificação de permissões granulares
    
    Args:
        function_id: ID da funcionalidade
        required_permission: Tipo de permissão necessário
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            current_user = get_current_user_from_token()
            
            if not current_user:
                return jsonify({'error': 'Token não fornecido ou inválido'}), 401
            
            if not current_user.is_active:
                return jsonify({'error': 'Usuário inativo'}), 403
            
            # Admin sempre tem acesso completo
            if current_user.role == 'admin':
                return f(current_user, *args, **kwargs)
            
            # Verificar permissão específica
            # Passar current_user para evitar buscar do token novamente
            if not has_permission(function_id, required_permission, current_user):
                logger.warning(f"Acesso negado para {current_user.email} ({current_user.role}) na funcionalidade {function_id} (requer: {required_permission})")
                # Buscar permissão atual para debug
                permission_type = Permission.get_permission(current_user.role, function_id)
                logger.warning(f"Permissão atual do usuário: {permission_type}")
                return jsonify({
                    'error': 'Acesso negado. Permissão insuficiente para esta ação',
                    'function_id': function_id,
                    'required_permission': required_permission,
                    'user_permission': permission_type
                }), 403
            
            return f(current_user, *args, **kwargs)
        
        decorated.__name__ = f.__name__
        return decorated
    return decorator

def can_access_resource(user, resource_owner_id=None, resource_owner_field='supplier_id'):
    """
    Verifica se o usuário pode acessar um recurso específico
    
    Args:
        user: Objeto User
        resource_owner_id: ID do proprietário do recurso
        resource_owner_field: Campo que identifica o proprietário ('supplier_id' ou 'plant_id')
    
    Returns:
        bool: True se o usuário pode acessar o recurso
    """
    if user.role == 'admin':
        return True
    
    permission_type = Permission.get_permission(user.role, 'view_appointments')  # Exemplo
    
    if permission_type == 'editor':
        return True
    elif permission_type == 'viewer':
        return True
    
    return False

