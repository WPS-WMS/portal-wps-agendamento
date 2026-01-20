from flask_sqlalchemy import SQLAlchemy
from src.models.user import db
from datetime import datetime

class Supplier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cnpj = db.Column(db.String(18), nullable=False)  # Removido unique=True - será único por company
    description = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Status ativo/bloqueado
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)  # Soft delete
    
    # Multi-tenant: company_id obrigatório
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Admin que criou o fornecedor
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraint único: cnpj deve ser único por company
    __table_args__ = (db.UniqueConstraint('cnpj', 'company_id', name='uq_supplier_cnpj_company'),)
    
    # Relacionamento com usuários (fornecedores) - especificar explicitamente a foreign key
    users = db.relationship('User', foreign_keys='User.supplier_id', backref='supplier', lazy=True)
    
    # Nota: Relacionamento com admin criador removido para evitar conflitos com múltiplas foreign keys
    # O campo created_by_admin_id pode ser usado diretamente para queries
    
    # Relacionamento com agendamentos
    appointments = db.relationship('Appointment', backref='supplier', lazy=True)

    def __repr__(self):
        return f'<Supplier {self.description}>'

    def to_dict(self):
        return {
            'id': self.id,
            'cnpj': self.cnpj,
            'description': self.description,
            'company_id': self.company_id,
            'is_active': self.is_active,
            'is_deleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
