"""
Funções utilitárias compartilhadas para o backend
"""
import secrets
import string
from datetime import datetime


def generate_temp_password(length=8):
    """
    Gera uma senha temporária aleatória
    
    Args:
        length (int): Tamanho da senha (padrão: 8)
    
    Returns:
        str: Senha temporária gerada
    """
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))


def generate_appointment_number(appointment_date=None):
    """
    Gera um número único de agendamento no formato AG-YYYYMMDD-XXXX
    onde XXXX é um número sequencial baseado na data
    
    Args:
        appointment_date (date, optional): Data do agendamento. Se None, usa a data atual.
    
    Returns:
        str: Número único do agendamento (ex: AG-20260114-0001)
    """
    from src.models.appointment import Appointment
    from src.models.user import db
    
    # Usar a data do agendamento ou data atual
    if appointment_date:
        date_obj = appointment_date
    else:
        date_obj = datetime.now().date()
    
    date_str = date_obj.strftime('%Y%m%d')
    
    # Buscar o último número usado para esta data
    # Formato: AG-YYYYMMDD-XXXX
    prefix = f"AG-{date_str}-"
    
    # Buscar o maior número sequencial para esta data
    last_appointment = Appointment.query.filter(
        Appointment.appointment_number.like(f"{prefix}%")
    ).order_by(Appointment.appointment_number.desc()).first()
    
    if last_appointment and last_appointment.appointment_number:
        # Extrair o número sequencial do último agendamento
        try:
            last_number_str = last_appointment.appointment_number.split('-')[-1]
            last_number = int(last_number_str)
            next_number = last_number + 1
        except (ValueError, IndexError):
            next_number = 1
    else:
        next_number = 1
    
    # Gerar número no formato AG-YYYYMMDD-XXXX
    appointment_number = f"{prefix}{next_number:04d}"
    
    # Verificar se já existe (proteção contra race conditions)
    while Appointment.query.filter_by(appointment_number=appointment_number).first():
        next_number += 1
        appointment_number = f"{prefix}{next_number:04d}"
    
    return appointment_number

