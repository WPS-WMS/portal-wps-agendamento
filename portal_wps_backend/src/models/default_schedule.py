from src.models.user import db
from datetime import datetime, time

class DefaultSchedule(db.Model):
    __tablename__ = 'default_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.Integer, db.ForeignKey('plants.id'), nullable=True)  # Planta específica (NULL = todas as plantas)
    day_of_week = db.Column(db.Integer, nullable=True)  # 0=Domingo, 1=Segunda, ..., 6=Sábado (NULL = todos os dias)
    time = db.Column(db.Time, nullable=False)  # Horário específico
    is_available = db.Column(db.Boolean, default=True, nullable=False)  # Se está disponível
    reason = db.Column(db.String(200))  # Motivo da indisponibilidade
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'plant_id': self.plant_id,
            'day_of_week': self.day_of_week,
            'day_name': self.get_day_name(),
            'time': self.time.strftime('%H:%M:%S') if self.time else None,
            'is_available': self.is_available,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_day_name(self):
        if self.day_of_week is None:
            return "Todos os dias"
        
        days = {
            0: "Domingo",
            1: "Segunda-feira", 
            2: "Terça-feira",
            3: "Quarta-feira",
            4: "Quinta-feira",
            5: "Sexta-feira",
            6: "Sábado"
        }
        return days.get(self.day_of_week, "Desconhecido")
