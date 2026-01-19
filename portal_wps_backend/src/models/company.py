from src.models.user import db
from datetime import datetime

class Company(db.Model):
    """Modelo para representar uma empresa (multi-tenant)"""
    __tablename__ = 'company'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)  # Nome da empresa
    cnpj = db.Column(db.String(18), unique=True, nullable=False)  # CNPJ único
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Status ativo/inativo
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    users = db.relationship('User', backref='company', lazy=True)
    suppliers = db.relationship('Supplier', backref='company', lazy=True)
    plants = db.relationship('Plant', backref='company', lazy=True)
    appointments = db.relationship('Appointment', backref='company', lazy=True)
    operating_hours = db.relationship('OperatingHours', backref='company', lazy=True)
    system_configs = db.relationship('SystemConfig', backref='company', lazy=True)
    
    def __repr__(self):
        return f'<Company {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'cnpj': self.cnpj,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
