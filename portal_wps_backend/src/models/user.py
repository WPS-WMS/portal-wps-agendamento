from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    """Modelo para representar um usuário do sistema"""
    __tablename__ = 'users'  # Evita conflito com palavra reservada 'user' em PostgreSQL
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)  # Removido unique=True - será único por company
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'admin', 'supplier' ou 'plant'
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Status ativo/bloqueado
    
    # Multi-tenant: company_id obrigatório
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    
    # Chave estrangeira para Supplier (apenas para usuários fornecedores)
    supplier_id = db.Column(db.Integer, db.ForeignKey('supplier.id'), nullable=True)
    # Chave estrangeira para Plant (apenas para usuários de plantas)
    plant_id = db.Column(db.Integer, db.ForeignKey('plants.id'), nullable=True)
    # Admin que criou este usuário (para rastrear qual admin criou qual usuário admin)
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraint único: email deve ser único por company
    __table_args__ = (db.UniqueConstraint('email', 'company_id', name='uq_user_email_company'),)

    def __repr__(self):
        return f'<User {self.email}>'

    def set_password(self, password):
        """Define a senha do usuário com hash"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifica se a senha está correta"""
        if not self.password_hash:
            return False
        try:
            return check_password_hash(self.password_hash, password)
        except ValueError as e:
            # Se o hash estiver em formato inválido, retornar False
            # Isso pode acontecer se o password_hash estiver vazio ou corrompido
            return False

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'company_id': self.company_id,
            'supplier_id': self.supplier_id,
            'plant_id': self.plant_id,
            'created_by_admin_id': self.created_by_admin_id,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
