from src.models.user import db
from datetime import datetime

class ScheduleConfig(db.Model):
    __tablename__ = 'schedule_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.Integer, db.ForeignKey('plants.id'), nullable=True)  # Planta específica (NULL = todas as plantas)
    date = db.Column(db.Date, nullable=False)  # Data específica
    time = db.Column(db.Time, nullable=False)  # Horário específico
    is_available = db.Column(db.Boolean, default=True, nullable=False)  # Se está disponível
    reason = db.Column(db.String(200))  # Motivo da indisponibilidade (ex: "Intervalo de almoço")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'plant_id': self.plant_id,
            'date': self.date.isoformat() if self.date else None,
            'time': self.time.strftime('%H:%M:%S') if self.time else None,
            'is_available': self.is_available,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
