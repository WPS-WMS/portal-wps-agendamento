from src.models.user import db
from datetime import datetime

class SystemConfig(db.Model):
    __tablename__ = 'system_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), nullable=False)  # Removido unique=True - será único por company (ou global)
    value = db.Column(db.String(255), nullable=False)  # Valor como string (será convertido conforme necessário)
    description = db.Column(db.String(500))  # Descrição da configuração
    
    # Multi-tenant: company_id pode ser NULL (configuração global) ou específico de uma company
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraint único: key deve ser único por company (ou global se company_id for NULL)
    __table_args__ = (db.UniqueConstraint('key', 'company_id', name='uq_system_config_key_company'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'company_id': self.company_id,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def get_value(key, company_id=None, default=None):
        """Retorna o valor de uma configuração ou o valor padrão
        Se company_id for fornecido, busca configuração específica da empresa.
        Se não encontrar, busca configuração global (company_id=NULL).
        """
        # Primeiro tenta buscar configuração específica da company
        if company_id is not None:
            config = SystemConfig.query.filter_by(key=key, company_id=company_id).first()
            if config:
                return config.value
        
        # Se não encontrou específica, busca global
        config = SystemConfig.query.filter_by(key=key, company_id=None).first()
        if config:
            return config.value
        
        return default
    
    @staticmethod
    def set_value(key, value, company_id=None, description=None):
        """Define ou atualiza o valor de uma configuração
        Se company_id for fornecido, cria/atualiza configuração específica da empresa.
        Se company_id for None, cria/atualiza configuração global.
        """
        config = SystemConfig.query.filter_by(key=key, company_id=company_id).first()
        if config:
            config.value = str(value)
            if description:
                config.description = description
            config.updated_at = datetime.utcnow()
        else:
            config = SystemConfig(
                key=key,
                value=str(value),
                company_id=company_id,
                description=description
            )
            db.session.add(config)
        db.session.commit()
        return config


