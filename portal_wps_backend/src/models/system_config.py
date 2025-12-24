from src.models.user import db
from datetime import datetime

class SystemConfig(db.Model):
    __tablename__ = 'system_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)  # Ex: 'max_capacity_per_slot'
    value = db.Column(db.String(255), nullable=False)  # Valor como string (será convertido conforme necessário)
    description = db.Column(db.String(500))  # Descrição da configuração
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def get_value(key, default=None):
        """Retorna o valor de uma configuração ou o valor padrão"""
        config = SystemConfig.query.filter_by(key=key).first()
        if config:
            return config.value
        return default
    
    @staticmethod
    def set_value(key, value, description=None):
        """Define ou atualiza o valor de uma configuração"""
        config = SystemConfig.query.filter_by(key=key).first()
        if config:
            config.value = str(value)
            if description:
                config.description = description
            config.updated_at = datetime.utcnow()
        else:
            config = SystemConfig(
                key=key,
                value=str(value),
                description=description
            )
            db.session.add(config)
        db.session.commit()
        return config


