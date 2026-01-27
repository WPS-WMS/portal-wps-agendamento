from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, time, date
import logging
from src.models.user import User, db
from src.models.appointment import Appointment
from src.models.supplier import Supplier
from src.models.operating_hours import OperatingHours
from src.routes.auth import token_required
from src.utils.permissions import permission_required, has_permission
from src.utils.helpers import generate_appointment_number

logger = logging.getLogger(__name__)

supplier_bp = Blueprint('supplier', __name__)

# Horários disponíveis para agendamento (8h às 17h, de hora em hora)
AVAILABLE_HOURS = [
    time(8, 0), time(9, 0), time(10, 0), time(11, 0),
    time(12, 0), time(13, 0), time(14, 0), time(15, 0),
    time(16, 0), time(17, 0)
]

def get_plant_operating_hours_message(plant_id, appointment_date):
    """
    Busca os horários de funcionamento da planta para uma data específica
    e retorna uma mensagem formatada com os horários disponíveis.
    
    Args:
        plant_id: ID da planta
        appointment_date: Data do agendamento (date object)
    
    Returns:
        str: Mensagem formatada com os horários de funcionamento da planta
    """
    try:
        # Determinar tipo de dia (weekday, weekend)
        python_weekday = appointment_date.weekday()  # 0=Segunda, 6=Domingo
        if python_weekday == 6:  # Domingo
            db_day_of_week = 0
        else:
            db_day_of_week = python_weekday + 1  # 1=Segunda, ..., 6=Sábado
        
        is_weekend = db_day_of_week == 0 or db_day_of_week == 6  # Domingo ou Sábado
        
        # Buscar configuração específica da planta
        if plant_id:
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
                start_str = operating_hours_config.operating_start.strftime('%H:%M')
                end_str = operating_hours_config.operating_end.strftime('%H:%M')
                return f'Horários disponíveis: {start_str} às {end_str}'
        
        # Se não encontrou configuração específica, retornar mensagem padrão
        return 'Horários disponíveis: 08:00 às 17:00'
    except Exception as e:
        logger.error(f"Erro ao buscar horários de funcionamento da planta: {str(e)}", exc_info=True)
        return 'Horários disponíveis: 08:00 às 17:00'

@supplier_bp.route('/appointments', methods=['GET'])
@permission_required('view_appointments', 'viewer')
def get_supplier_appointments(current_user):
    """Retorna agendamentos do fornecedor para uma semana específica"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        # Validar que o usuário está vinculado a um fornecedor
        if not current_user.supplier_id:
            return jsonify({'error': 'Usuário não está vinculado a um fornecedor'}), 400
        
        week_start = request.args.get('week')
        
        if not week_start:
            return jsonify({'error': 'Parâmetro week é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            start_date = datetime.strptime(week_start, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        end_date = start_date + timedelta(days=6)
        
        # Tentar obter plant_id de diferentes formas
        plant_id_raw = request.args.get('plant_id')
        plant_id = None
        
        if plant_id_raw is not None:
            try:
                # Tentar converter para int
                if isinstance(plant_id_raw, str):
                    plant_id = int(plant_id_raw)
                else:
                    plant_id = int(plant_id_raw)
            except (ValueError, TypeError):
                plant_id = None
        
        # Buscar apenas agendamentos do próprio fornecedor
        query = Appointment.query.filter(
            Appointment.supplier_id == current_user.supplier_id,
            Appointment.date >= start_date,
            Appointment.date <= end_date
        )
        
        # Filtrar por planta se fornecido
        # IMPORTANTE: Incluir agendamentos sem plant_id (NULL) para compatibilidade com agendamentos antigos
        if plant_id is not None:
            from sqlalchemy import or_
            # Incluir agendamentos da planta selecionada OU agendamentos sem plant_id (NULL)
            # Isso permite que agendamentos antigos sejam exibidos mesmo quando uma planta está selecionada
            query = query.filter(
                or_(
                    Appointment.plant_id == plant_id,
                    Appointment.plant_id.is_(None)
                )
            )
        
        appointments = query.order_by(Appointment.date, Appointment.time).all()
        
        # Converter para dicionário
        result = []
        for appointment in appointments:
            appointment_dict = appointment.to_dict()
            # Buscar informações do fornecedor usando o relacionamento ou query direta
            supplier = None
            try:
                # Tentar usar o relacionamento primeiro (mais eficiente)
                supplier = appointment.supplier
            except:
                # Se o relacionamento não estiver carregado, buscar explicitamente
                # Validar que o fornecedor pertence à mesma company
                if appointment.supplier_id:
                    supplier = Supplier.query.filter_by(
                        id=appointment.supplier_id,
                        is_deleted=False,
                        company_id=current_user.company_id
                    ).first()
            
            if supplier:
                appointment_dict['supplier'] = supplier.to_dict()
                logger.info(f"Supplier adicionado ao appointment {appointment.id}: {supplier.description} (ID: {supplier.id})")
            else:
                logger.warning(f"Supplier não encontrado para appointment {appointment.id} com supplier_id {appointment.supplier_id}")
            
            appointment_dict['is_own'] = True  # Todos são do próprio fornecedor
            appointment_dict['can_edit'] = appointment.status == 'scheduled'
            result.append(appointment_dict)
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/available-slots', methods=['GET'])
@token_required
def get_available_slots(current_user):
    """Retorna horários disponíveis para agendamento em uma data específica"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        date_str = request.args.get('date')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        # Verificar se a data não é no passado
        if target_date < datetime.now().date():
            return jsonify({'error': 'Não é possível agendar para datas passadas'}), 400
        
        # Buscar agendamentos existentes para a data (todos os fornecedores)
        existing_appointments = Appointment.query.filter(
            Appointment.date == target_date
        ).all()
        
        # Criar lista de horários ocupados
        occupied_times = [app.time for app in existing_appointments]
        
        # Filtrar horários disponíveis
        available_slots = []
        for hour in AVAILABLE_HOURS:
            if hour not in occupied_times:
                available_slots.append(hour.strftime('%H:%M'))
        
        return jsonify({
            'date': date_str,
            'available_slots': available_slots,
            'occupied_slots': [t.strftime('%H:%M') for t in occupied_times]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/available-times', methods=['GET'])
@token_required
def get_available_times(current_user):
    """Retorna horários disponíveis para agendamento (formato compatível com admin)"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        date_str = request.args.get('date')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        # Buscar agendamentos existentes para a data
        existing_appointments = Appointment.query.filter(
            Appointment.date == target_date
        ).all()
        
        # Criar lista de horários ocupados
        occupied_times = {app.time.strftime('%H:%M') for app in existing_appointments}
        
        # IMPORTANTE: Fornecedores não têm configuração de horário de funcionamento
        # Apenas plantas têm essa configuração
        # Permitir todos os horários (24h) para fornecedores
        
        # Criar lista de horários disponíveis no formato esperado
        available_times = []
        for hour in AVAILABLE_HOURS:
            time_str = hour.strftime('%H:%M')
            
            # Para fornecedores, sempre permitir (24h)
            is_in_operating_hours = True
            
            is_available = (time_str not in occupied_times) and is_in_operating_hours
            
            reason = None
            if time_str in occupied_times:
                reason = 'Horário ocupado'
            elif not is_in_operating_hours:
                reason = 'Fora do horário de funcionamento'
            
            available_times.append({
                'time': time_str,
                'is_available': is_available,
                'reason': reason,
                'has_appointment': time_str in occupied_times
            })
        
        return jsonify(available_times), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/appointments', methods=['POST'])
@permission_required('create_appointment', 'editor')
def create_appointment(current_user):
    """Cria um novo agendamento para o fornecedor"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        data = request.get_json()
        
        if not data or not all(k in data for k in ['date', 'time', 'time_end', 'purchase_order', 'truck_plate', 'driver_name']):
            return jsonify({'error': 'Todos os campos são obrigatórios: date, time, time_end, purchase_order, truck_plate, driver_name'}), 400
        
        # Validar se time_end não está vazio
        if not data.get('time_end') or not data['time_end'].strip():
            return jsonify({'error': 'O horário final é obrigatório'}), 400
        
        try:
            appointment_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            appointment_time = datetime.strptime(data['time'], '%H:%M').time()
            appointment_time_end = datetime.strptime(data['time_end'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Formato de data/hora inválido. Use YYYY-MM-DD para data e HH:MM para hora'}), 400
        
        # Validar intervalo de horário
        if appointment_time_end <= appointment_time:
            return jsonify({'error': 'O horário final deve ser maior que o horário inicial'}), 400
        
        # Verificar se a data não é no passado
        if appointment_date < datetime.now().date():
            return jsonify({'error': 'Não é possível agendar para datas passadas'}), 400
        
        # Validar plant_id (obrigatório para fornecedores)
        plant_id = data.get('plant_id')
        if not plant_id:
            return jsonify({'error': 'Planta de entrega é obrigatória'}), 400
        
        # Verificar se a planta existe, está ativa e pertence à mesma company
        from src.models.plant import Plant
        plant = Plant.query.filter_by(
            id=plant_id, 
            is_active=True,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada, inativa ou não pertence ao seu domínio'}), 404
        
        # Validar horários de funcionamento da planta (validação específica da planta)
        # Esta validação já retorna mensagens específicas com os horários corretos da planta
        from src.utils.operating_hours_validator import validate_operating_hours
        is_valid, error_msg = validate_operating_hours(plant_id, appointment_date, appointment_time, appointment_time_end)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Verificar capacidade máxima por horário da planta
        # Usar capacidade máxima da planta (padrão: 1 se não configurado)
        max_capacity = plant.max_capacity if plant.max_capacity else 1
        
        # Validar capacidade para todos os slots do intervalo
        # IMPORTANTE: Validar slots de 1 hora (não 30 minutos) para manter compatibilidade
        # Um agendamento de 30 minutos ocupa o slot de 1 hora correspondente
        from sqlalchemy import or_, and_
        from datetime import timedelta
        
        if appointment_time_end:
            # Agendamento com intervalo - validar todos os slots de 1 hora
            slots = []
            current = datetime.combine(appointment_date, appointment_time)
            end = datetime.combine(appointment_date, appointment_time_end)
            
            # Arredondar para baixo para o horário de 1 hora mais próximo
            # Exemplo: 08:30 -> 08:00, 09:15 -> 09:00
            start_hour = time(current.hour, 0)
            current = datetime.combine(appointment_date, start_hour)
            
            while current < end:
                slot_hour = current.time()
                slots.append(slot_hour)
                current += timedelta(hours=1)
            
            for slot in slots:
                # Contar agendamentos que ocupam este slot para esta planta
                # Multi-tenant: filtrar por company_id
                count = Appointment.query.filter(
                    Appointment.date == appointment_date,
                    Appointment.plant_id == plant_id,
                    Appointment.company_id == current_user.company_id
                ).filter(
                    or_(
                        # Agendamento antigo que começa neste slot
                        and_(
                            Appointment.time == slot,
                            Appointment.time_end.is_(None)
                        ),
                        # Agendamento com intervalo que inclui este slot
                        and_(
                            Appointment.time <= slot,
                            Appointment.time_end.isnot(None),
                            Appointment.time_end > slot
                        )
                    )
                ).count()
                
                if count >= max_capacity:
                    slot_str = slot.strftime('%H:%M') if slot else 'desconhecido'
                    return jsonify({
                        'error': f'Capacidade máxima de {max_capacity} agendamento(s) por horário foi atingida no horário {slot_str}. Por favor, escolha outro intervalo.'
                    }), 400
        else:
            # Agendamento antigo (apenas horário único) - manter compatibilidade
            # Contar todos os agendamentos que ocupam este horário específico para esta planta:
            # 1. Agendamentos antigos (sem time_end) que começam neste horário
            # 2. Agendamentos com intervalo que incluem este horário
            # Multi-tenant: filtrar por company_id
            total_count = Appointment.query.filter(
                Appointment.date == appointment_date,
                Appointment.plant_id == plant_id,
                Appointment.company_id == current_user.company_id
            ).filter(
                or_(
                    # Agendamento antigo que começa neste horário
                    and_(
                        Appointment.time == appointment_time,
                        Appointment.time_end.is_(None)
                    ),
                    # Agendamento com intervalo que inclui este horário
                    and_(
                        Appointment.time <= appointment_time,
                        Appointment.time_end.isnot(None),
                        Appointment.time_end > appointment_time
                    )
                )
            ).count()
            
            if total_count >= max_capacity:
                return jsonify({
                    'error': f'Capacidade máxima de {max_capacity} agendamento(s) por horário foi atingida. Por favor, escolha outro horário.'
                }), 400
        
        # Gerar número único do agendamento
        appointment_number = generate_appointment_number(appointment_date)
        logger.info(f"Gerado número de agendamento: {appointment_number} para data {appointment_date}")
        
        # Criar agendamento
        appointment = Appointment(
            appointment_number=appointment_number,
            date=appointment_date,
            time=appointment_time,
            time_end=appointment_time_end,
            purchase_order=data['purchase_order'],
            truck_plate=data['truck_plate'],
            driver_name=data['driver_name'],
            supplier_id=current_user.supplier_id,
            plant_id=plant_id,
            company_id=current_user.company_id
        )
        
        db.session.add(appointment)
        db.session.commit()
        
        # Log para verificar se o número foi salvo
        logger.info(f"Agendamento criado com ID {appointment.id}, número: {appointment.appointment_number}")
        
        return jsonify({
            'message': 'Agendamento criado com sucesso',
            'appointment': appointment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@permission_required('edit_appointment', 'editor')
def update_supplier_appointment(current_user, appointment_id):
    """Atualiza um agendamento do fornecedor"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        appointment = Appointment.query.filter(
            Appointment.id == appointment_id,
            Appointment.supplier_id == current_user.supplier_id
        ).first()
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # Verificar se o agendamento pode ser editado
        if appointment.status != 'scheduled' and appointment.status != 'rescheduled':
            return jsonify({'error': f'Agendamento não pode ser editado. Status atual: {appointment.status}'}), 400
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Armazenar valores originais para detectar reagendamento
        original_date = appointment.date
        original_time = appointment.time
        original_time_end = appointment.time_end
        
        # Detectar se houve mudança de data ou horário
        date_changed = False
        time_changed = False
        
        # Atualizar campos permitidos
        if 'date' in data:
            try:
                new_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
                if new_date < datetime.now().date():
                    return jsonify({'error': 'Não é possível agendar para datas passadas'}), 400
                if new_date != original_date:
                    date_changed = True
                appointment.date = new_date
            except ValueError:
                return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        if 'time' in data:
            try:
                new_time = datetime.strptime(data['time'], '%H:%M').time()
                if new_time != original_time:
                    time_changed = True
                appointment.time = new_time
            except ValueError:
                return jsonify({'error': 'Formato de hora inválido. Use HH:MM'}), 400
        
        # Atualizar time_end (obrigatório)
        if 'time_end' in data:
            if not data['time_end'] or not data['time_end'].strip():
                return jsonify({'error': 'O horário final é obrigatório'}), 400
            
            try:
                new_time_end = datetime.strptime(data['time_end'], '%H:%M').time()
                
                # Validar que time_end > time
                if new_time_end <= appointment.time:
                    return jsonify({'error': 'O horário final deve ser maior que o horário inicial'}), 400
                
                if new_time_end != original_time_end:
                    time_changed = True
                appointment.time_end = new_time_end
            except ValueError:
                return jsonify({'error': 'Formato de hora final inválido. Use HH:MM'}), 400
        else:
            # Se time_end não foi fornecido, garantir que existe
            if not appointment.time_end:
                return jsonify({'error': 'O horário final é obrigatório'}), 400
        
        # Verificar se houve reagendamento (mudança de data ou horário)
        is_rescheduling = date_changed or time_changed
        
        # Se houve reagendamento, verificar permissão específica de reagendamento
        if is_rescheduling:
            # Verificar se o usuário tem permissão para reagendar
            if not has_permission('reschedule', 'editor', current_user):
                return jsonify({
                    'error': 'Você não tem permissão para reagendar agendamentos. Apenas usuários com perfil Editor podem reagendar.',
                    'permission_required': 'reschedule',
                    'permission_level': 'editor'
                }), 403
            
            # Se houve reagendamento, exigir motivo
            if 'motivo_reagendamento' not in data or not data.get('motivo_reagendamento', '').strip():
                return jsonify({
                    'error': 'Motivo do reagendamento é obrigatório quando há alteração de data ou horário',
                    'requires_reschedule_reason': True
                }), 400
            
            # Aplicar status rescheduled e salvar motivo
            appointment.status = 'rescheduled'
            appointment.motivo_reagendamento = data['motivo_reagendamento'].strip()
        
        # Validar horários de funcionamento se data, time ou time_end foram alterados
        if is_rescheduling:
            # IMPORTANTE: Usar appointment.plant_id (planta do agendamento) para validar
            # Apenas plantas têm configuração de horário de funcionamento
            plant_id_to_validate = appointment.plant_id
            if plant_id_to_validate:
                from src.utils.operating_hours_validator import validate_operating_hours
                is_valid, error_msg = validate_operating_hours(plant_id_to_validate, appointment.date, appointment.time, appointment.time_end)
                if not is_valid:
                    return jsonify({'error': error_msg}), 400
        
        # Validar capacidade máxima se data, time ou time_end foram alterados
        if is_rescheduling:
            # Obter plant_id do agendamento (obrigatório)
            if not appointment.plant_id:
                return jsonify({'error': 'Agendamento sem planta associada. Não é possível validar capacidade.'}), 400
            
            # Buscar a planta e obter sua capacidade máxima
            # Validar que a planta pertence à mesma company
            from src.models.plant import Plant
            plant = Plant.query.filter_by(
                id=appointment.plant_id,
                company_id=current_user.company_id
            ).first()
            if not plant:
                return jsonify({'error': 'Planta não encontrada ou não pertence ao seu domínio'}), 404
            
            # Usar capacidade máxima da planta (padrão: 1 se não configurado)
            max_capacity = plant.max_capacity if plant.max_capacity else 1
            
            # Validar capacidade para todos os slots do intervalo
            from sqlalchemy import or_, and_
            slots = []
            current = datetime.combine(appointment.date, appointment.time)
            end = datetime.combine(appointment.date, appointment.time_end)
            
            while current < end:
                slots.append(current.time())
                current += timedelta(hours=1)
            
            for slot in slots:
                # Contar agendamentos que ocupam este slot para esta planta
                count = Appointment.query.filter(
                    Appointment.date == appointment.date,
                    Appointment.plant_id == appointment.plant_id
                ).filter(
                    Appointment.id != appointment_id
                ).filter(
                    or_(
                        # Agendamento antigo que começa neste slot
                        and_(
                            Appointment.time == slot,
                            Appointment.time_end.is_(None)
                        ),
                        # Agendamento com intervalo que inclui este slot
                        and_(
                            Appointment.time <= slot,
                            Appointment.time_end.isnot(None),
                            Appointment.time_end > slot
                        )
                    )
                ).count()
                
                if count >= max_capacity:
                    slot_str = slot.strftime('%H:%M') if slot else 'desconhecido'
                    return jsonify({
                        'error': f'Capacidade máxima de {max_capacity} agendamento(s) por horário foi atingida no horário {slot_str}. Por favor, escolha outro intervalo.'
                    }), 400
        
        if 'purchase_order' in data:
            appointment.purchase_order = data['purchase_order'].strip()
        
        if 'truck_plate' in data:
            appointment.truck_plate = data['truck_plate'].strip().upper()
        
        if 'driver_name' in data:
            appointment.driver_name = data['driver_name'].strip()
        
        appointment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Agendamento atualizado com sucesso',
            'appointment': appointment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@permission_required('delete_appointment', 'editor')
def delete_supplier_appointment(current_user, appointment_id):
    """Remove um agendamento do fornecedor"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        appointment = Appointment.query.filter(
            Appointment.id == appointment_id,
            Appointment.supplier_id == current_user.supplier_id
        ).first()
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # Normalizar o status para comparação (remover espaços, converter para minúsculas e remover caracteres especiais)
        appointment_status_raw = appointment.status
        appointment_status = str(appointment_status_raw).strip().lower() if appointment_status_raw else ''
        # Remover qualquer caractere especial ou espaço extra
        appointment_status = ''.join(c for c in appointment_status if c.isalnum() or c == '_')
        
        # Verificar se o agendamento pode ser removido
        # Permitir excluir agendamentos com status 'scheduled' ou 'rescheduled'
        # Não permitir excluir agendamentos que já fizeram check-in ou check-out
        allowed_statuses = ['scheduled', 'rescheduled']
        
        if appointment_status == 'checked_in':
            return jsonify({'error': 'Não é possível excluir agendamento que já fez check-in'}), 400
        
        if appointment_status == 'checked_out':
            return jsonify({'error': 'Não é possível excluir agendamento que já foi finalizado'}), 400
        
        # Verificar se o status permite exclusão (scheduled ou rescheduled)
        if appointment_status not in allowed_statuses:
            return jsonify({'error': f'Agendamento não pode ser removido. Status atual: {appointment_status_raw}'}), 400
        db.session.delete(appointment)
        db.session.commit()
        return jsonify({'message': 'Agendamento removido com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao excluir agendamento {appointment_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/suppliers', methods=['GET'])
@permission_required('view_suppliers', 'viewer')
def get_suppliers(current_user):
    """Retorna apenas o próprio fornecedor do usuário"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        if not current_user.supplier_id:
            logger.error(f"[get_suppliers] Usuário {current_user.id} não possui supplier_id")
            return jsonify({'error': 'Usuário não está vinculado a um fornecedor'}), 400
        
        # Fornecedor só pode ver seu próprio cadastro
        supplier = Supplier.query.get(current_user.supplier_id)
        if not supplier:
            logger.error(f"[get_suppliers] Fornecedor {current_user.supplier_id} não encontrado")
            return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        supplier_dict = supplier.to_dict()
        return jsonify([supplier_dict]), 200
        
    except Exception as e:
        logger.error(f"[get_suppliers] Erro: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# IMPORTANTE: Rotas mais específicas devem vir ANTES das rotas mais genéricas
# A rota /plants/<int:plant_id>/max-capacity deve vir ANTES de /plants
@supplier_bp.route('/plants/<int:plant_id>/schedule-config', methods=['GET'])
@token_required
def get_plant_schedule_config(current_user, plant_id):
    """Retorna as configurações de horário de funcionamento e bloqueios de uma planta para uma data específica"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        from src.models.plant import Plant
        from src.models.schedule_config import ScheduleConfig
        from src.models.default_schedule import DefaultSchedule
        
        # Verificar se a planta existe, está ativa e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id, 
            is_active=True,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada, inativa ou não pertence ao seu domínio'}), 404
        
        # Obter data do parâmetro (opcional, se não fornecido, retorna apenas horários de funcionamento)
        date_str = request.args.get('date')
        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        # Buscar horários de funcionamento da planta
        operating_hours = []
        if target_date:
            # Determinar tipo de dia (weekday, weekend)
            python_weekday = target_date.weekday()  # 0=Segunda, 6=Domingo
            if python_weekday == 6:  # Domingo
                db_day_of_week = 0
            else:
                db_day_of_week = python_weekday + 1  # 1=Segunda, ..., 6=Sábado
            
            is_weekend = db_day_of_week == 0 or db_day_of_week == 6
            
            if is_weekend:
                config = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekend',
                    day_of_week=db_day_of_week,
                    is_active=True
                ).first()
            else:
                config = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekdays',
                    day_of_week=None,
                    is_active=True
                ).first()
            
            if config:
                operating_hours.append({
                    'schedule_type': config.schedule_type,
                    'day_of_week': config.day_of_week,
                    'operating_start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'operating_end': config.operating_end.strftime('%H:%M') if config.operating_end else None,
                    'is_active': config.is_active
                })
        else:
            # Se não há data específica, retornar todas as configurações de horário de funcionamento da planta
            all_configs = OperatingHours.query.filter_by(plant_id=plant_id, is_active=True).all()
            for config in all_configs:
                operating_hours.append({
                    'schedule_type': config.schedule_type,
                    'day_of_week': config.day_of_week,
                    'operating_start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'operating_end': config.operating_end.strftime('%H:%M') if config.operating_end else None,
                    'is_active': config.is_active
                })
        
        # Buscar horários bloqueados para a data específica (se fornecida)
        # Multi-tenant: Configurações são aplicadas apenas para a planta selecionada da mesma company
        blocked_times = []
        if target_date:
            # Multi-tenant: Buscar configurações específicas da data apenas para esta planta da mesma company
            # (a planta já foi validada anteriormente na rota que pertence à company do fornecedor)
            schedule_configs = ScheduleConfig.query.filter_by(
                date=target_date,
                plant_id=plant_id
            ).all()
            for config in schedule_configs:
                if not config.is_available:
                    blocked_times.append({
                        'time': config.time.strftime('%H:%M') if config.time else None,
                        'reason': config.reason
                    })
            
            # Multi-tenant: Buscar configurações padrão apenas para esta planta da mesma company
            day_of_week = target_date.weekday()  # 0=Segunda, 6=Domingo
            if day_of_week == 6:
                day_of_week = 0  # Domingo = 0
            
            # Filtrar configurações apenas para a planta específica (plant_id obrigatório)
            default_configs = DefaultSchedule.query.filter(
                DefaultSchedule.plant_id == plant_id,
                ((DefaultSchedule.day_of_week == day_of_week) | 
                 (DefaultSchedule.day_of_week.is_(None)))
            ).all()
            
            for config in default_configs:
                if not config.is_available:
                    blocked_times.append({
                        'time': config.time.strftime('%H:%M') if config.time else None,
                        'reason': config.reason
                    })
        
        return jsonify({
            'plant_id': plant.id,
            'plant_name': plant.name,
            'date': target_date.isoformat() if target_date else None,
            'operating_hours': operating_hours,
            'blocked_times': blocked_times,
            'max_capacity': plant.max_capacity if plant.max_capacity and plant.max_capacity > 0 else 1
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar configurações da planta {plant_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/plants/<int:plant_id>/time-slots', methods=['GET'])
@token_required
def get_plant_time_slots(current_user, plant_id):
    """Retorna slots de 30 minutos com disponibilidade para uma planta e data específica"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        # Verificar se a data não é no passado
        if target_date < datetime.now().date():
            return jsonify({'error': 'Não é possível agendar para datas passadas'}), 400
        
        # Buscar planta
        from src.models.plant import Plant
        plant = Plant.query.filter_by(
            id=plant_id,
            is_active=True,
            company_id=current_user.company_id
        ).first()
        
        if not plant:
            return jsonify({'error': 'Planta não encontrada, inativa ou não pertence ao seu domínio'}), 404
        
        max_capacity = plant.max_capacity if plant.max_capacity else 1
        
        # Buscar horários de funcionamento da planta
        from src.utils.operating_hours_validator import validate_operating_hours
        python_weekday = target_date.weekday()
        if python_weekday == 6:  # Domingo
            db_day_of_week = 0
        else:
            db_day_of_week = python_weekday + 1
        
        is_weekend = db_day_of_week == 0 or db_day_of_week == 6
        operating_hours_day = 6 if db_day_of_week == 0 else 5 if is_weekend else None
        
        operating_hours_config = None
        if is_weekend:
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
        
        # Se não encontrou configuração, usar padrão 08:00-17:00
        if not operating_hours_config:
            from datetime import time as time_class
            start_time = time_class(8, 0)
            end_time = time_class(17, 0)
        else:
            start_time = operating_hours_config.operating_start
            end_time = operating_hours_config.operating_end
        
        # OTIMIZAÇÃO: Buscar todos os agendamentos do dia de uma vez em vez de fazer query por slot
        from sqlalchemy import or_, and_
        all_appointments = Appointment.query.filter(
            Appointment.date == target_date,
            Appointment.plant_id == plant_id,
            Appointment.company_id == current_user.company_id
        ).all()
        
        # Gerar slots de 30 minutos dentro do horário de funcionamento
        # IMPORTANTE: Não incluir o último slot se for igual ao horário final
        # Exemplo: se funcionamento é 08:00-17:00, último slot é 16:30 (não 17:00)
        slots = []
        current_time = datetime.combine(target_date, start_time)
        end_datetime = datetime.combine(target_date, end_time)
        
        while current_time < end_datetime:
            slot_time = current_time.time()
            slot_str = slot_time.strftime('%H:%M')
            
            # Não incluir slot se for igual ou maior que o horário final
            if slot_time >= end_time:
                break
            
            # Calcular início e fim do slot de 30 minutos
            slot_start_minutes = slot_time.hour * 60 + slot_time.minute
            slot_end_minutes = (slot_start_minutes + 30) % (24 * 60)
            
            # Contar agendamentos que se sobrepõem a este slot em memória
            count = 0
            for apt in all_appointments:
                apt_start = apt.time
                apt_start_minutes = apt_start.hour * 60 + apt_start.minute
                
                # Se não tem time_end, assumir duração de 1 hora
                if apt.time_end is None:
                    apt_end_minutes = (apt_start_minutes + 60) % (24 * 60)
                else:
                    apt_end = apt.time_end
                    apt_end_minutes = apt_end.hour * 60 + apt_end.minute
                
                # Verificar sobreposição: start < slot_end && slot_start < end
                # Converter para minutos para facilitar comparação
                slot_start_mins = slot_start_minutes
                slot_end_mins = slot_end_minutes
                
                # Tratar casos onde o slot ou agendamento cruza meia-noite
                if slot_end_mins < slot_start_mins:  # Slot cruza meia-noite
                    slot_end_mins += 24 * 60
                
                if apt_end_minutes < apt_start_minutes:  # Agendamento cruza meia-noite
                    apt_end_minutes += 24 * 60
                
                # Verificar sobreposição
                if apt_start_minutes < slot_end_mins and slot_start_mins < apt_end_minutes:
                    count += 1
            
            is_available = count < max_capacity
            
            slots.append({
                'time': slot_str,
                'is_available': is_available,
                'capacity_used': count,
                'capacity_max': max_capacity
            })
            
            current_time += timedelta(minutes=30)
        
        return jsonify({
            'date': date_str,
            'plant_id': plant_id,
            'operating_hours': {
                'start': start_time.strftime('%H:%M'),
                'end': end_time.strftime('%H:%M')
            },
            'slots': slots
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar slots de tempo: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/plants/<int:plant_id>/max-capacity', methods=['GET'])
@token_required
def get_plant_max_capacity(current_user, plant_id):
    """Retorna a capacidade máxima de recebimentos por horário de uma planta específica"""
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        from src.models.plant import Plant
        
        # Verificar se a planta existe, está ativa e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id, 
            is_active=True,
            company_id=current_user.company_id
        ).first()
        
        if not plant:
            return jsonify({'error': 'Planta não encontrada, inativa ou não pertence ao seu domínio'}), 404
        
        # Garantir que max_capacity sempre tenha um valor válido
        max_capacity = plant.max_capacity if plant.max_capacity and plant.max_capacity > 0 else 1
        
        return jsonify({
            'plant_id': plant.id,
            'plant_name': plant.name,
            'max_capacity': max_capacity
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar capacidade da planta {plant_id} para fornecedor: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/plants', methods=['GET'])
@token_required
def get_plants(current_user):
    """Lista plantas (ativas e inativas) da mesma company do fornecedor
    
    IMPORTANTE: Fornecedores sempre precisam visualizar plantas para criar agendamentos,
    então esta rota não usa @permission_required para garantir acesso mesmo sem permissão configurada.
    A verificação de permissão é feita internamente, mas não bloqueia o acesso se não estiver configurada.
    
    REGRA DE NEGÓCIO: Retorna TODAS as plantas (ativas e inativas) para que fornecedores possam:
    - Visualizar plantas inativas
    - Reativar plantas inativas (se tiverem permissão)
    - A validação de plantas ativas é feita no momento de criar agendamentos
    
    Multi-tenant: Filtra apenas plantas da mesma company do fornecedor.
    """
    try:
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem acessar'}), 403
        
        from src.models.plant import Plant
        from sqlalchemy import and_
        
        # Filtrar apenas plantas da mesma company do fornecedor
        # IMPORTANTE: Retornar TODAS as plantas (ativas e inativas) para que fornecedores possam visualizar e reativar plantas inativas
        # A validação de plantas ativas será feita no momento de criar agendamentos
        plants = Plant.query.filter(
            Plant.company_id == current_user.company_id
        ).order_by(Plant.name).all()
        
        logger.info(f"[get_plants] Fornecedor {current_user.id} (company_id: {current_user.company_id}) - Encontradas {len(plants)} plantas (ativas e inativas)")
        
        result = []
        for plant in plants:
            plant_dict = plant.to_dict()
            # Garantir que CNPJ sempre esteja presente
            if 'cnpj' not in plant_dict or plant_dict['cnpj'] is None:
                plant_dict['cnpj'] = getattr(plant, 'cnpj', '') or ''
            result.append(plant_dict)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"[get_plants] Erro: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/appointments/<int:appointment_id>/check-in', methods=['POST'])
@permission_required('check_in', 'editor')
def check_in_appointment(current_user, appointment_id):
    """Realiza check-in de um agendamento"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem fazer check-in'}), 403
        
        if not current_user.supplier_id:
            return jsonify({'error': 'Usuário não está vinculado a um fornecedor'}), 400
        
        appointment = Appointment.query.get_or_404(appointment_id)
        
        # Verificar se o agendamento pertence ao fornecedor
        if appointment.supplier_id != current_user.supplier_id:
            return jsonify({'error': 'Agendamento não pertence a este fornecedor'}), 403
        
        # Verificar se a data do agendamento é a data atual (apenas para perfis de planta e fornecedor)
        today = date.today()
        if appointment.date != today:
            return jsonify({'error': 'Check-in só pode ser realizado na data do agendamento'}), 400
        
        # Permitir check-in apenas para agendamentos agendados ou reagendados
        if appointment.status not in ['scheduled', 'rescheduled']:
            error_msg = f'Agendamento não pode receber check-in. Status atual: {appointment.status}'
            return jsonify({'error': error_msg}), 400
        
        # Realizar check-in
        appointment.status = 'checked_in'
        appointment.check_in_time = datetime.utcnow()
        
        db.session.commit()
        
        # Recarregar o appointment para garantir que está sincronizado
        db.session.refresh(appointment)
        
        # Gerar payload para integração ERP (com tratamento de erro)
        try:
            erp_payload = appointment.generate_erp_payload()
        except Exception as erp_error:
            logger.error(f"Erro ao gerar payload ERP: {str(erp_error)}")
            # Se houver erro ao gerar payload, retornar payload vazio mas não falhar o check-in
            erp_payload = {
                'appointment_id': appointment.id,
                'error': 'Erro ao gerar payload completo',
                'message': str(erp_error)
            }
        
        return jsonify({
            'message': 'Check-in realizado com sucesso',
            'appointment': appointment.to_dict(),
            'erp_payload': erp_payload
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao realizar check-in: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@supplier_bp.route('/appointments/<int:appointment_id>/check-out', methods=['POST'])
@permission_required('check_out', 'editor')
def check_out_appointment(current_user, appointment_id):
    """Realiza check-out de um agendamento"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        if current_user.role != 'supplier':
            return jsonify({'error': 'Acesso negado. Apenas fornecedores podem fazer check-out'}), 403
        
        if not current_user.supplier_id:
            return jsonify({'error': 'Usuário não está vinculado a um fornecedor'}), 400
        
        appointment = Appointment.query.get_or_404(appointment_id)
        
        # Verificar se o agendamento pertence ao fornecedor
        if appointment.supplier_id != current_user.supplier_id:
            return jsonify({'error': 'Agendamento não pertence a este fornecedor'}), 403
        
        # Verificar se a data do agendamento é a data atual (apenas para perfis de planta e fornecedor)
        today = date.today()
        if appointment.date != today:
            return jsonify({'error': 'Check-out só pode ser realizado na data do agendamento'}), 400
        
        # Verificar se já está com check-out
        if appointment.status == 'checked_out':
            return jsonify({'error': 'Agendamento já foi finalizado'}), 400
        
        # Verificar se tem check-in
        if appointment.status != 'checked_in':
            return jsonify({'error': 'É necessário realizar check-in antes do check-out'}), 400
        
        # Realizar check-out
        appointment.status = 'checked_out'
        appointment.check_out_time = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Check-out realizado com sucesso',
            'appointment': appointment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erro ao realizar check-out: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
