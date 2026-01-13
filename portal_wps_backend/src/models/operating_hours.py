from src.models.user import db
from datetime import datetime, time
from sqlalchemy import UniqueConstraint, ForeignKey
from sqlalchemy.orm import relationship

class OperatingHours(db.Model):
    __tablename__ = 'operating_hours'
    
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.Integer, ForeignKey('plants.id'), nullable=True)  # NULL = configuração global
    schedule_type = db.Column(db.String(20), nullable=False)  # 'weekdays', 'weekend', 'holiday'
    day_of_week = db.Column(db.Integer, nullable=True)  # Para weekend: 5=Sábado, 6=Domingo
    operating_start = db.Column(db.Time, nullable=False)  # Horário de funcionamento inicial
    operating_end = db.Column(db.Time, nullable=False)  # Horário de funcionamento final
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamento com Plant
    plant = relationship('Plant', backref='operating_hours')
    
    __table_args__ = (
        UniqueConstraint('plant_id', 'schedule_type', 'day_of_week', name='uq_operating_hours_plant_type_day'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'plant_id': self.plant_id,
            'schedule_type': self.schedule_type,
            'day_of_week': self.day_of_week,
            'day_name': self.get_day_name(),
            'operating_start': self.operating_start.strftime('%H:%M:%S') if self.operating_start else None,
            'operating_end': self.operating_end.strftime('%H:%M:%S') if self.operating_end else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_day_name(self):
        if self.day_of_week is None:
            return None
        
        days = {
            5: "Sábado",
            6: "Domingo"
        }
        return days.get(self.day_of_week, None)
    
    def is_time_in_range(self, time_str):
        """Verifica se um horário está dentro do intervalo de funcionamento"""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.operating_start or not self.operating_end:
            logger.warning(f"Configuração incompleta: start={self.operating_start}, end={self.operating_end}")
            return False
        
        try:
            # Converter time_str (HH:MM) para minutos
            parts = time_str.split(':')
            if len(parts) != 2:
                logger.warning(f"Formato de horário inválido: {time_str}")
                return False
                
            hour = int(parts[0])
            minute = int(parts[1])
            
            # Validar valores
            if hour < 0 or hour > 23 or minute < 0 or minute > 59:
                logger.warning(f"Valores de horário inválidos: {hour}:{minute}")
                return False
            
            time_minutes = hour * 60 + minute
            
            # Converter operating_start e operating_end para minutos
            start_minutes = self.operating_start.hour * 60 + self.operating_start.minute
            end_minutes = self.operating_end.hour * 60 + self.operating_end.minute
            
            # Validar se está dentro do intervalo
            # Exemplo: 10:00 às 16:00 inclui 10:00, 11:00, ..., 15:00, mas não 16:00 (pois é o fim)
            is_valid = start_minutes <= time_minutes < end_minutes
            
            logger.info(f"  Validando {time_str} ({time_minutes} min) no range {self.operating_start.strftime('%H:%M')} ({start_minutes} min) - {self.operating_end.strftime('%H:%M')} ({end_minutes} min): {'VÁLIDO' if is_valid else 'INVÁLIDO'}")
            
            return is_valid
        except Exception as e:
            logger.error(f"Erro ao validar horário {time_str}: {e}", exc_info=True)
            return False

