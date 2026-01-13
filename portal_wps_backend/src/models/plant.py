from src.models.user import db
from datetime import datetime

class Plant(db.Model):
    """Modelo para representar uma planta (local físico de entrega/coleta)"""
    __tablename__ = 'plants'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)  # Nome da planta
    code = db.Column(db.String(50), nullable=True)  # Código ou identificador (opcional)
    cnpj = db.Column(db.String(18), nullable=False)  # CNPJ (obrigatório)
    email = db.Column(db.String(120), nullable=True)  # E-mail
    phone = db.Column(db.String(20), nullable=True)  # Telefone (opcional)
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Status ativo/inativo
    max_capacity = db.Column(db.Integer, default=1, nullable=False)  # Capacidade máxima de recebimentos por horário
    
    # Informações de localização
    cep = db.Column(db.String(10), nullable=True)  # CEP
    street = db.Column(db.String(200), nullable=True)  # Rua
    number = db.Column(db.String(20), nullable=True)  # Número
    neighborhood = db.Column(db.String(100), nullable=True)  # Bairro
    reference = db.Column(db.String(200), nullable=True)  # Referência (opcional)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Plant {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'cnpj': self.cnpj if self.cnpj else '',  # Garantir que sempre retorne string, nunca None
            'email': self.email,
            'phone': self.phone,
            'is_active': self.is_active,
            'max_capacity': self.max_capacity,
            'cep': self.cep,
            'street': self.street,
            'number': self.number,
            'neighborhood': self.neighborhood,
            'reference': self.reference,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

