"""
Utilitário para validar horários de funcionamento das plantas
"""
from datetime import datetime, timedelta
from src.models.operating_hours import OperatingHours
from src.models.default_schedule import DefaultSchedule
from src.models.schedule_config import ScheduleConfig
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
                # CORREÇÃO: Para weekend, OperatingHours usa day_of_week: 5=Sábado, 6=Domingo
                # Mas db_day_of_week para Domingo é 0 e para Sábado é 6
                # Precisamos converter: Domingo (db_day_of_week=0) -> OperatingHours.day_of_week=6
                #                      Sábado (db_day_of_week=6) -> OperatingHours.day_of_week=5
                operating_hours_day = 6 if db_day_of_week == 0 else 5  # Domingo=6, Sábado=5
                
                operating_hours_config = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekend',
                    day_of_week=operating_hours_day,
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
        
        # Se é final de semana e não encontrou configuração ativa, verificar se há configuração inativa
        # IMPORTANTE: Se não há configuração de final de semana (nem ativa nem inativa), BLOQUEAR por padrão
        # Mensagens específicas por dia: Sábado ou Domingo
        if is_weekend and not operating_hours_config:
            if plant_id:
                # Converter day_of_week para formato do OperatingHours
                operating_hours_day = 6 if db_day_of_week == 0 else 5  # Domingo=6, Sábado=5
                day_name_pt = 'Domingo' if db_day_of_week == 0 else 'Sábado'
                
                # Verificar se existe configuração inativa específica da planta para este dia
                inactive_config_plant = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekend',
                    day_of_week=operating_hours_day,
                    is_active=False
                ).first()
                
                # Se há configuração inativa específica da planta, bloquear com mensagem específica do dia
                if inactive_config_plant:
                    error_msg = f'Agendamentos não são permitidos aos {day_name_pt}s para esta planta (horários de {day_name_pt} desativados).'
                    logger.warning(f"❌ [VALIDATE] Bloqueando agendamento em {day_name_pt} - configuração específica da planta existe mas está inativa")
                    return (False, error_msg)
                
                # CORREÇÃO: Se não há configuração de final de semana (nem ativa nem inativa), BLOQUEAR por padrão
                # Mensagem específica por dia
                error_msg = f'Agendamentos não são permitidos aos {day_name_pt}s para esta planta (horários de {day_name_pt} não configurados).'
                logger.warning(f"❌ [VALIDATE] Bloqueando agendamento em {day_name_pt} - nenhuma configuração encontrada (padrão: BLOQUEAR)")
                return (False, error_msg)
            
            # Se plant_id é None, não há planta para validar - permitir (fail-open)
            logger.info(f"Nenhuma configuração de weekend encontrada e plant_id é None. Permitindo 24h (fail-open).")
            return (True, None)
        
        # Se não encontrou configuração específica da planta, permitir 24h (padrão)
        if not operating_hours_config:
            if plant_id:
                logger.info(f"Nenhuma configuração específica encontrada para plant_id={plant_id}. Permitindo 24h (padrão quando não configurado).")
            else:
                logger.info(f"Nenhuma configuração encontrada. Permitindo 24h (padrão).")
            return (True, None)
        
        logger.info(f"✅ [VALIDATE] Usando configuração: {operating_hours_config.operating_start} às {operating_hours_config.operating_end} (plant_id={operating_hours_config.plant_id}, schedule_type={operating_hours_config.schedule_type})")
        
        # Validar horário inicial e final
        time_str = appointment_time.strftime('%H:%M')
        time_end_str = appointment_time_end.strftime('%H:%M')
        start_time_str = operating_hours_config.operating_start.strftime('%H:%M')
        end_time_str = operating_hours_config.operating_end.strftime('%H:%M')
        
        # Converter para minutos para comparação
        def time_to_minutes(time_obj):
            return time_obj.hour * 60 + time_obj.minute
        
        start_minutes = time_to_minutes(operating_hours_config.operating_start)
        end_minutes = time_to_minutes(operating_hours_config.operating_end)
        appointment_start_minutes = time_to_minutes(appointment_time)
        appointment_end_minutes = time_to_minutes(appointment_time_end)
        
        logger.info(f"🔍 [VALIDATE] Validando horário inicial {time_str} ({appointment_start_minutes} min) e final {time_end_str} ({appointment_end_minutes} min) contra range {start_time_str} ({start_minutes} min) - {end_time_str} ({end_minutes} min)")
        
        # Validar horário inicial: deve estar >= start_time e < end_time (não pode ser igual ou maior que end_time)
        if appointment_start_minutes < start_minutes or appointment_start_minutes >= end_minutes:
            error_msg = f'O horário inicial {time_str} está fora do horário de funcionamento configurado ({start_time_str} às {end_time_str}). Por favor, escolha um horário dentro deste intervalo.'
            logger.error(f"❌ [VALIDATE] Validação FALHOU - horário inicial {time_str} fora do range {start_time_str}-{end_time_str} (plant_id={plant_id})")
            return (False, error_msg)
        else:
            logger.info(f"✅ [VALIDATE] Horário inicial {time_str} válido")
        
        # Validar horário final: deve estar >= start_time e <= end_time (pode ser igual ao end_time)
        if appointment_end_minutes < start_minutes or appointment_end_minutes > end_minutes:
            error_msg = f'O horário final {time_end_str} está fora do horário de funcionamento configurado ({start_time_str} às {end_time_str}). Por favor, escolha um horário dentro deste intervalo.'
            logger.warning(f"Validação falhou - horário final {time_end_str} fora do range {start_time_str}-{end_time_str}")
            return (False, error_msg)
        else:
            logger.info(f"✅ [VALIDATE] Horário final {time_end_str} válido (pode ser igual ao horário final de funcionamento)")
        
        # Validar todos os slots intermediários também
        # Os slots intermediários devem estar dentro do intervalo (>= start_time e < end_time)
        current = datetime.combine(appointment_date, appointment_time)
        end = datetime.combine(appointment_date, appointment_time_end)
        
        while current < end:
            slot_time = current.time()
            slot_time_str = slot_time.strftime('%H:%M')
            slot_minutes = time_to_minutes(slot_time)
            
            # Slots intermediários devem estar >= start_time e < end_time (não podem ser iguais ao end_time)
            if slot_minutes < start_minutes or slot_minutes >= end_minutes:
                error_msg = f'O intervalo de agendamento contém horários ({slot_time_str}) fora do horário de funcionamento configurado ({start_time_str} às {end_time_str}). Por favor, escolha um intervalo completamente dentro deste horário.'
                logger.warning(f"Validação falhou - slot intermediário {slot_time_str} fora do range {start_time_str}-{end_time_str}")
                return (False, error_msg)
            
            current += timedelta(hours=1)
        
        logger.info(f"Validação passou - todos os horários estão dentro do intervalo {start_time_str}-{end_time_str}")
        
        # VALIDAR BLOQUEIOS: Verificar se há bloqueios semanais (DefaultSchedule) ou de data específica (ScheduleConfig)
        # Multi-tenant: buscar company_id da planta para garantir isolamento
        from src.models.plant import Plant
        plant = Plant.query.get(plant_id) if plant_id else None
        company_id = plant.company_id if plant else None
        
        if not company_id:
            logger.warning(f"Planta {plant_id} não encontrada ou sem company_id. Pulando validação de bloqueios.")
        else:
            # 1. Verificar bloqueios de data específica (ScheduleConfig) - maior prioridade
            # LÓGICA: Um horário está bloqueado se o agendamento COMEÇAR DENTRO dele
            # Se o agendamento começar EXATAMENTE no horário final do bloqueio, é permitido
            logger.info(f"🔍 [VALIDATE] Verificando bloqueios de data específica para plant_id={plant_id}, data={appointment_date}")
            
            # Buscar todos os bloqueios desta data para esta planta
            all_blocks = ScheduleConfig.query.filter_by(
                plant_id=plant_id,
                date=appointment_date,
                is_available=False
            ).all()
            
            # Converter appointment_time para minutos
            appointment_start_minutes = appointment_time.hour * 60 + appointment_time.minute
            
            for block in all_blocks:
                block_time_minutes = block.time.hour * 60 + block.time.minute
                block_time_str = block.time.strftime('%H:%M')
                
                # Bloquear apenas se o agendamento começar DENTRO do bloqueio (não igual ao horário do bloqueio)
                # Exemplo: bloqueio em 12:00 bloqueia agendamentos de 12:00 a 13:00
                # Mas permite agendamento começando em 13:00 (horário final)
                if block_time_minutes <= appointment_start_minutes < block_time_minutes + 60:
                    error_msg = f'O horário {block_time_str} do dia {appointment_date.strftime("%d/%m/%Y")} está bloqueado. Motivo: {block.reason or "Bloqueio de data específica"}'
                    logger.warning(f"❌ [VALIDATE] Bloqueio de data específica detectado: {block_time_str} em {appointment_date} bloqueia agendamento em {appointment_time.strftime('%H:%M')} - {block.reason}")
                    return (False, error_msg)
            
            # 2. Verificar bloqueios semanais (DefaultSchedule) - segunda prioridade
            # LÓGICA: Um horário está bloqueado se o agendamento COMEÇAR DENTRO dele
            # Se o agendamento começar EXATAMENTE no horário final do bloqueio, é permitido
            logger.info(f"🔍 [VALIDATE] Verificando bloqueios semanais para plant_id={plant_id}, weekday={db_day_of_week}")
            
            # Buscar todos os bloqueios semanais para este dia/planta
            from sqlalchemy import or_, and_
            all_weekly_blocks = DefaultSchedule.query.filter(
                and_(
                    DefaultSchedule.plant_id == plant_id,
                    or_(
                        DefaultSchedule.day_of_week == db_day_of_week,
                        DefaultSchedule.day_of_week.is_(None)
                    ),
                    DefaultSchedule.is_available == False
                )
            ).all()
            
            # Converter appointment_time para minutos
            appointment_start_minutes = appointment_time.hour * 60 + appointment_time.minute
            day_name = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][db_day_of_week if db_day_of_week > 0 else 0]
            
            for block in all_weekly_blocks:
                block_time_minutes = block.time.hour * 60 + block.time.minute
                block_time_str = block.time.strftime('%H:%M')
                
                # LÓGICA: Um bloqueio em X bloqueia agendamentos começando de X até X+59 minutos
                # Mas NÃO bloqueia agendamentos começando em X+1 hora (mesma lógica dos horários de funcionamento)
                # Exemplo: bloqueio em 12:00 bloqueia agendamentos começando de 12:00 a 12:59
                # Mas permite agendamento começando em 13:00 (horário final do intervalo)
                # IMPORTANTE: Se o bloqueio é de 12:00 até 13:00, há bloqueios em 12:00 e 13:00
                # Mas um agendamento começando em 13:00 deve ser permitido (horário final)
                
                # Verificar se o agendamento começa DENTRO do intervalo do bloqueio
                # LÓGICA: Se começa exatamente no horário de um bloqueio, verificar se há bloqueio no horário anterior
                # Se houver, significa que este é o horário final de um intervalo, então PERMITIR
                # Se não houver, bloquear normalmente
                if block_time_minutes <= appointment_start_minutes < block_time_minutes + 60:
                    # Agendamento começa dentro do intervalo do bloqueio
                    
                    # Se começa exatamente no horário do bloqueio, verificar se é o horário final de um intervalo
                    if appointment_start_minutes == block_time_minutes:
                        # Verificar se há bloqueio no horário anterior (isso indicaria que este é o final de um intervalo)
                        prev_hour_time = block.time.hour - 1
                        if prev_hour_time < 0:
                            prev_hour_time = 23
                        
                        from datetime import time as time_class
                        prev_hour_block = DefaultSchedule.query.filter(
                            and_(
                                DefaultSchedule.plant_id == plant_id,
                                or_(
                                    DefaultSchedule.day_of_week == db_day_of_week,
                                    DefaultSchedule.day_of_week.is_(None)
                                ),
                                DefaultSchedule.time == time_class(prev_hour_time, 0),
                                DefaultSchedule.is_available == False
                            )
                        ).first()
                        
                        # Se há bloqueio no horário anterior, este é o horário final do intervalo - PERMITIR
                        if prev_hour_block:
                            logger.info(f"✅ [VALIDATE] Agendamento em {appointment_time.strftime('%H:%M')} permitido - horário final do bloqueio (bloqueio anterior em {(prev_hour_time):02d}:00)")
                            continue  # Este bloqueio não bloqueia porque é o final de um intervalo
                    
                    # Caso contrário, bloquear
                    error_msg = f'O horário {block_time_str} de {day_name} está bloqueado semanalmente. Motivo: {block.reason or "Bloqueio semanal"}'
                    logger.warning(f"❌ [VALIDATE] Bloqueio semanal detectado: {block_time_str} em {day_name} bloqueia agendamento em {appointment_time.strftime('%H:%M')} - {block.reason}")
                    return (False, error_msg)
        
        logger.info(f"✅ [VALIDATE] Validação completa passou - nenhum bloqueio detectado")
        return (True, None)
        
    except Exception as e:
        logger.error(f"Erro ao validar horários de funcionamento: {str(e)}", exc_info=True)
        # Em caso de erro, permitir o agendamento (fail-open para não bloquear o sistema)
        return (True, None)

