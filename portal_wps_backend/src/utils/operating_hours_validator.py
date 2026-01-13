"""
Utilitário para validar horários de funcionamento das plantas
"""
from datetime import datetime, timedelta
from src.models.operating_hours import OperatingHours
from src.models.user import db
import logging

logger = logging.getLogger(__name__)

def validate_operating_hours(plant_id, appointment_date, appointment_time, appointment_time_end):
    """
    Valida se os horários do agendamento estão dentro do horário de funcionamento da planta.
    
    Args:
        plant_id: ID da planta (pode ser None para configuração global)
        appointment_date: Data do agendamento (date object)
        appointment_date: Horário inicial do agendamento (time object)
        appointment_time_end: Horário final do agendamento (time object)
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    try:
        # Determinar tipo de dia (weekday, weekend)
        python_weekday = appointment_date.weekday()  # 0=Segunda, 6=Domingo
        if python_weekday == 6:  # Domingo
            db_day_of_week = 0
        else:
            db_day_of_week = python_weekday + 1  # 1=Segunda, ..., 6=Sábado
        
        is_weekend = db_day_of_week == 0 or db_day_of_week == 6  # Domingo ou Sábado
        
        logger.info(f"🔍 [VALIDATE] Iniciando validação - plant_id={plant_id}, data={appointment_date}, weekday={db_day_of_week}, is_weekend={is_weekend}")
        
        operating_hours_config = None
        
        # Buscar configuração específica da planta primeiro
        if plant_id:
            logger.info(f"🔍 [VALIDATE] Buscando configuração específica da planta {plant_id} para schedule_type={'weekend' if is_weekend else 'weekdays'}")
            if is_weekend:
                operating_hours_config = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekend',
                    day_of_week=db_day_of_week,
                    is_active=True
                ).first()
            else:
                operating_hours_config = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekdays',
                    day_of_week=None,
                    is_active=True
                ).first()
            
            if operating_hours_config:
                logger.info(f"✅ [VALIDATE] Configuração específica encontrada: {operating_hours_config.operating_start} às {operating_hours_config.operating_end} (plant_id={operating_hours_config.plant_id})")
            else:
                logger.warning(f"⚠️ [VALIDATE] Nenhuma configuração específica encontrada para plant_id={plant_id}")
                
                # Listar todas as configurações desta planta para debug
                all_configs = OperatingHours.query.filter_by(plant_id=plant_id).all()
                logger.info(f"🔍 [VALIDATE] Todas as configurações da planta {plant_id}: {[(c.id, c.schedule_type, c.day_of_week, c.operating_start, c.operating_end, c.is_active) for c in all_configs]}")
        else:
            logger.warning(f"⚠️ [VALIDATE] plant_id é None - não há planta para validar")
        
        # IMPORTANTE: Não buscar configuração global quando há plant_id
        # Apenas plantas têm configuração de horário de funcionamento
        # Se não encontrou configuração específica da planta, permitir 24h (padrão)
        
        # Se é final de semana e não encontrou configuração ativa, verificar se há configuração inativa
        # IMPORTANTE: Apenas verificar configuração específica da planta (não global)
        if is_weekend and not operating_hours_config:
            if plant_id:
                # Verificar se existe configuração inativa específica da planta
                inactive_config_plant = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekend',
                    day_of_week=db_day_of_week,
                    is_active=False
                ).first()
                
                # Se há configuração inativa específica da planta, bloquear
                if inactive_config_plant:
                    error_msg = 'Agendamentos não são permitidos em finais de semana para esta planta.'
                    logger.warning(f"Bloqueando agendamento em final de semana - configuração específica da planta existe mas está inativa")
                    return (False, error_msg)
            
            # Se não há configuração (nem ativa nem inativa), permitir 24h
            logger.info(f"Nenhuma configuração de weekend encontrada para plant_id={plant_id}. Permitindo 24h (padrão).")
            return (True, None)
        
        # Se não encontrou configuração específica da planta, permitir 24h (padrão)
        if not operating_hours_config:
            if plant_id:
                logger.info(f"Nenhuma configuração específica encontrada para plant_id={plant_id}. Permitindo 24h (padrão quando não configurado).")
            else:
                logger.info(f"Nenhuma configuração encontrada. Permitindo 24h (padrão).")
            return (True, None)
        
        logger.info(f"✅ [VALIDATE] Usando configuração: {operating_hours_config.operating_start} às {operating_hours_config.operating_end} (plant_id={operating_hours_config.plant_id}, schedule_type={operating_hours_config.schedule_type})")
        
        # Validar horário inicial
        time_str = appointment_time.strftime('%H:%M')
        start_time_str = operating_hours_config.operating_start.strftime('%H:%M')
        end_time_str = operating_hours_config.operating_end.strftime('%H:%M')
        
        logger.info(f"🔍 [VALIDATE] Validando horário inicial {time_str} contra range {start_time_str}-{end_time_str}")
        is_start_valid = operating_hours_config.is_time_in_range(time_str)
        
        if not is_start_valid:
            error_msg = f'O horário inicial {time_str} está fora do horário de funcionamento configurado ({start_time_str} às {end_time_str}). Por favor, escolha um horário dentro deste intervalo.'
            logger.error(f"❌ [VALIDATE] Validação FALHOU - horário inicial {time_str} fora do range {start_time_str}-{end_time_str} (plant_id={plant_id})")
            return (False, error_msg)
        else:
            logger.info(f"✅ [VALIDATE] Horário inicial {time_str} válido")
        
        # Validar horário final
        time_end_str = appointment_time_end.strftime('%H:%M')
        is_end_valid = operating_hours_config.is_time_in_range(time_end_str)
        
        if not is_end_valid:
            error_msg = f'O horário final {time_end_str} está fora do horário de funcionamento configurado ({start_time_str} às {end_time_str}). Por favor, escolha um horário dentro deste intervalo.'
            logger.warning(f"Validação falhou - horário final {time_end_str} fora do range {start_time_str}-{end_time_str}")
            return (False, error_msg)
        
        # Validar todos os slots intermediários também
        current = datetime.combine(appointment_date, appointment_time)
        end = datetime.combine(appointment_date, appointment_time_end)
        
        while current < end:
            slot_time_str = current.time().strftime('%H:%M')
            is_slot_valid = operating_hours_config.is_time_in_range(slot_time_str)
            
            if not is_slot_valid:
                error_msg = f'O intervalo de agendamento contém horários ({slot_time_str}) fora do horário de funcionamento configurado ({start_time_str} às {end_time_str}). Por favor, escolha um intervalo completamente dentro deste horário.'
                logger.warning(f"Validação falhou - slot intermediário {slot_time_str} fora do range {start_time_str}-{end_time_str}")
                return (False, error_msg)
            
            current += timedelta(hours=1)
        
        logger.info(f"Validação passou - todos os horários estão dentro do intervalo {start_time_str}-{end_time_str}")
        return (True, None)
        
    except Exception as e:
        logger.error(f"Erro ao validar horários de funcionamento: {str(e)}", exc_info=True)
        # Em caso de erro, permitir o agendamento (fail-open para não bloquear o sistema)
        return (True, None)

