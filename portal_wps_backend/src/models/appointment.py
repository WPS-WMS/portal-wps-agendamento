from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    appointment_number = db.Column(db.String(50), unique=True, nullable=True)  # Número único do agendamento
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time, nullable=False)
    time_end = db.Column(db.Time, nullable=True)  # Horário final (opcional para compatibilidade com agendamentos antigos)
    purchase_order = db.Column(db.String(100), nullable=False)
    truck_plate = db.Column(db.String(20), nullable=False)
    driver_name = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='scheduled', nullable=False)  # scheduled, checked_in, checked_out, rescheduled
    motivo_reagendamento = db.Column(db.String(500), nullable=True)  # Motivo do reagendamento
    check_in_time = db.Column(db.DateTime, nullable=True)
    check_out_time = db.Column(db.DateTime, nullable=True)
    
    # Chave estrangeira para Supplier
    supplier_id = db.Column(db.Integer, db.ForeignKey('supplier.id'), nullable=False)
    
    # Chave estrangeira para Plant (opcional - pode ser NULL para compatibilidade com agendamentos antigos)
    plant_id = db.Column(db.Integer, db.ForeignKey('plants.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Appointment {self.purchase_order} - {self.date} {self.time}>'

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_number': self.appointment_number,
            'date': self.date.isoformat() if self.date else None,
            'time': self.time.isoformat() if self.time else None,
            'time_end': self.time_end.isoformat() if self.time_end else None,
            'purchase_order': self.purchase_order,
            'truck_plate': self.truck_plate,
            'driver_name': self.driver_name,
            'status': self.status,
            'motivo_reagendamento': self.motivo_reagendamento,
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'check_out_time': self.check_out_time.isoformat() if self.check_out_time else None,
            'supplier_id': self.supplier_id,
            'plant_id': self.plant_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_time_slots(self):
        """Retorna lista de horários (slots de 1 hora) ocupados por este agendamento"""
        from datetime import timedelta
        
        slots = []
        start_time = datetime.combine(self.date, self.time)
        
        # Se não tem time_end, ocupa apenas o horário inicial (compatibilidade com agendamentos antigos)
        if not self.time_end:
            return [self.time]
        
        end_time = datetime.combine(self.date, self.time_end)
        current = start_time
        
        # Gerar slots de 1 hora dentro do intervalo
        while current < end_time:
            slots.append(current.time())
            current += timedelta(hours=1)
        
        return slots

    def generate_erp_payload(self):
        """Gera o payload JSON para integração com ERP"""
        # Buscar supplier se não estiver carregado
        supplier = None
        try:
            supplier = self.supplier
        except:
            # Se o supplier não estiver carregado, buscar explicitamente
            from src.models.supplier import Supplier
            supplier = Supplier.query.get(self.supplier_id)
        
        return {
            'appointment_id': self.id,
            'supplier_cnpj': supplier.cnpj if supplier else None,
            'supplier_name': supplier.description if supplier else None,
            'purchase_order': self.purchase_order,
            'truck_plate': self.truck_plate,
            'driver_name': self.driver_name,
            'scheduled_date': self.date.isoformat() if self.date else None,
            'scheduled_time': self.time.isoformat() if self.time else None,
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'check_out_time': self.check_out_time.isoformat() if self.check_out_time else None,
            'status': self.status,
            'timestamp': datetime.utcnow().isoformat()
        }
