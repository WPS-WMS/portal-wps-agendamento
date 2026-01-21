from src.models.user import db
from datetime import datetime
from sqlalchemy import UniqueConstraint

class Permission(db.Model):
    """Modelo para armazenar permissões granulares por role e funcionalidade (multi-tenant)"""
    __tablename__ = 'permissions'
    
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)  # Multi-tenant: isolamento por company
    role = db.Column(db.String(20), nullable=False)  # 'admin', 'supplier', 'plant'
    function_id = db.Column(db.String(100), nullable=False)  # ID da funcionalidade (ex: 'create_appointment')
    permission_type = db.Column(db.String(20), nullable=False)  # 'editor', 'viewer', 'none'
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('company_id', 'role', 'function_id', name='uq_company_role_function'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'company_id': self.company_id,
            'role': self.role,
            'function_id': self.function_id,
            'permission_type': self.permission_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def get_permission(role, function_id, company_id):
        """Retorna a permissão de um role para uma funcionalidade na company especificada
        Multi-tenant: isola permissões por company
        
        REGRA DE NEGÓCIO: Quando não há permissão configurada explicitamente,
        retorna 'editor' como padrão para permitir acesso completo (compatível com
        o comportamento esperado de "todas as funcionalidades liberadas por padrão")
        """
        permission = Permission.query.filter_by(
            company_id=company_id,
            role=role,
            function_id=function_id
        ).first()
        if permission:
            return permission.permission_type
        
        # REGRA DE NEGÓCIO: Editor é o padrão quando não há permissão configurada
        # Isso garante que todas as funcionalidades vêm liberadas por padrão
        # Admin sempre tem acesso completo (bypass), então não precisa de permissão
        if role == 'admin':
            return 'editor'  # Admin sempre tem acesso completo
        
        # Para supplier e plant, retornar 'editor' como padrão quando não configurado
        return 'editor'
    
    @staticmethod
    def set_permission(role, function_id, permission_type, company_id):
        """Define ou atualiza uma permissão para uma company específica
        Multi-tenant: isola permissões por company
        """
        permission = Permission.query.filter_by(
            company_id=company_id,
            role=role,
            function_id=function_id
        ).first()
        if permission:
            permission.permission_type = permission_type
            permission.updated_at = datetime.utcnow()
        else:
            permission = Permission(
                company_id=company_id,
                role=role,
                function_id=function_id,
                permission_type=permission_type
            )
            db.session.add(permission)
        db.session.commit()
        return permission
    
    @staticmethod
    def get_all_permissions(company_id):
        """Retorna todas as permissões de uma company organizadas por role e function_id
        Multi-tenant: retorna apenas permissões da company especificada
        """
        permissions = Permission.query.filter_by(company_id=company_id).all()
        result = {}
        for perm in permissions:
            if perm.function_id not in result:
                result[perm.function_id] = {}
            result[perm.function_id][perm.role] = perm.permission_type
        return result
    
    @staticmethod
    def bulk_update_permissions(permissions_dict, company_id):
        """Atualiza múltiplas permissões de uma vez para uma company específica
        Multi-tenant: isola permissões por company
        permissions_dict: { function_id: { role: permission_type } }
        """
        for function_id, roles in permissions_dict.items():
            for role, permission_type in roles.items():
                Permission.set_permission(role, function_id, permission_type, company_id)

