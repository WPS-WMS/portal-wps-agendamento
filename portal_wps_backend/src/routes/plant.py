from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, time
from src.models.user import User, db
from src.models.appointment import Appointment
from src.models.plant import Plant
from src.routes.auth import token_required, plant_required
from src.utils.permissions import permission_required
import logging

logger = logging.getLogger(__name__)

plant_bp = Blueprint('plant', __name__)

@plant_bp.route('/appointments', methods=['GET'])
@token_required
@permission_required('view_appointments', 'viewer')
def get_plant_appointments(current_user):
    """Retorna agendamentos da planta para uma data específica"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        date_str = request.args.get('date')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        # Buscar agendamentos da planta para a data específica
        # IMPORTANTE: Filtrar apenas agendamentos da planta do usuário
        appointments = Appointment.query.filter(
            Appointment.date == target_date,
            Appointment.plant_id == current_user.plant_id
        ).order_by(Appointment.time).all()
        
        logger.info(f"Buscando agendamentos da planta {current_user.plant_id} para data {target_date}")
        logger.info(f"Encontrados {len(appointments)} agendamentos para a planta {current_user.plant_id}")
        
        result = []
        for apt in appointments:
            apt_dict = apt.to_dict()
            # Buscar informações do fornecedor
            if apt.supplier_id:
                from src.models.supplier import Supplier
                supplier = Supplier.query.get(apt.supplier_id)
                if supplier:
                    apt_dict['supplier'] = supplier.to_dict()
            result.append(apt_dict)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar agendamentos da planta: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/appointments', methods=['POST'])
@permission_required('create_appointment', 'editor')
def create_appointment(current_user):
    """Cria um novo agendamento (para plantas)"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        data = request.get_json()
        
        if not data or not all(k in data for k in ['date', 'time', 'time_end', 'purchase_order', 'truck_plate', 'driver_name', 'supplier_id']):
            return jsonify({'error': 'Todos os campos são obrigatórios: date, time, time_end, purchase_order, truck_plate, driver_name, supplier_id'}), 400
        
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
        
        # Verificar se o fornecedor existe
        from src.models.supplier import Supplier
        supplier = Supplier.query.get(data['supplier_id'])
        if not supplier:
            return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        if not supplier.is_active:
            return jsonify({'error': 'Fornecedor inativo'}), 400
        
        # Verificar se o usuário está vinculado a uma planta
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        # Buscar a planta e obter sua capacidade máxima
        from src.models.plant import Plant
        plant = Plant.query.get(current_user.plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Usar capacidade máxima da planta (padrão: 1 se não configurado)
        max_capacity = plant.max_capacity if plant.max_capacity else 1
        
        # Validar capacidade para todos os slots do intervalo
        from sqlalchemy import or_, and_
        
        if appointment_time_end:
            slots = []
            current = datetime.combine(appointment_date, appointment_time)
            end = datetime.combine(appointment_date, appointment_time_end)
            
            while current < end:
                slots.append(current.time())
                current += timedelta(hours=1)
            
            for slot in slots:
                # Contar agendamentos que ocupam este slot para esta planta
                query = Appointment.query.filter(
                    Appointment.date == appointment_date,
                    Appointment.plant_id == current_user.plant_id
                ).filter(
                    or_(
                        and_(
                            Appointment.time == slot,
                            Appointment.time_end.is_(None)
                        ),
                        and_(
                            Appointment.time <= slot,
                            Appointment.time_end.isnot(None),
                            Appointment.time_end > slot
                        )
                    )
                )
                
                if query.count() >= max_capacity:
                    slot_str = slot.strftime('%H:%M')
                    return jsonify({
                        'error': f'Capacidade máxima de {max_capacity} agendamento(s) por horário foi atingida no horário {slot_str}. Por favor, escolha outro intervalo.'
                    }), 400
        
        # Validar horários de funcionamento da planta
        from src.utils.operating_hours_validator import validate_operating_hours
        is_valid, error_msg = validate_operating_hours(current_user.plant_id, appointment_date, appointment_time, appointment_time_end)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Criar agendamento (plant_id preenchido automaticamente com a planta do usuário)
        appointment = Appointment(
            date=appointment_date,
            time=appointment_time,
            time_end=appointment_time_end,
            purchase_order=data['purchase_order'],
            truck_plate=data['truck_plate'],
            driver_name=data['driver_name'],
            supplier_id=data['supplier_id'],
            plant_id=current_user.plant_id  # Preenchido automaticamente com a planta do usuário
        )
        
        db.session.add(appointment)
        db.session.commit()
        
        return jsonify({
            'message': 'Agendamento criado com sucesso',
            'appointment': appointment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao criar agendamento: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@permission_required('edit_appointment', 'editor')
def update_appointment(current_user, appointment_id):
    """Atualiza um agendamento existente"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        appointment = Appointment.query.get(appointment_id)
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # Verificar se o agendamento pertence à planta do usuário
        if appointment.plant_id != current_user.plant_id:
            return jsonify({'error': 'Agendamento não pertence a esta planta'}), 403
        
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
                time_str = data['time']
                if len(time_str) == 5:
                    new_time = datetime.strptime(time_str, '%H:%M').time()
                elif len(time_str) == 8:
                    new_time = datetime.strptime(time_str, '%H:%M:%S').time()
                else:
                    raise ValueError("Formato inválido")
                
                if new_time != original_time:
                    time_changed = True
                appointment.time = new_time
            except ValueError:
                return jsonify({'error': 'Formato de hora inválido. Use HH:MM ou HH:MM:SS'}), 400
        
        if 'time_end' in data:
            if not data['time_end'] or not data['time_end'].strip():
                return jsonify({'error': 'O horário final é obrigatório'}), 400
            
            try:
                time_end_str = data['time_end']
                if len(time_end_str) == 5:
                    new_time_end = datetime.strptime(time_end_str, '%H:%M').time()
                elif len(time_end_str) == 8:
                    new_time_end = datetime.strptime(time_end_str, '%H:%M:%S').time()
                else:
                    raise ValueError("Formato inválido")
                
                if new_time_end <= appointment.time:
                    return jsonify({'error': 'O horário final deve ser maior que o horário inicial'}), 400
                
                if new_time_end != original_time_end:
                    time_changed = True
                appointment.time_end = new_time_end
            except ValueError:
                return jsonify({'error': 'Formato de hora inválido. Use HH:MM ou HH:MM:SS'}), 400
        
        # Verificar se houve reagendamento
        is_rescheduling = date_changed or time_changed
        
        if is_rescheduling:
            if 'motivo_reagendamento' not in data or not data.get('motivo_reagendamento', '').strip():
                return jsonify({'error': 'Motivo do reagendamento é obrigatório quando há alteração de data ou horário'}), 400
            appointment.status = 'rescheduled'
            appointment.motivo_reagendamento = data['motivo_reagendamento'].strip()
            
            # Validar horários de funcionamento quando há reagendamento
            # IMPORTANTE: Usar appointment.plant_id (planta do agendamento) para validar
            plant_id_to_validate = appointment.plant_id
            if not plant_id_to_validate:
                return jsonify({'error': 'Agendamento não possui planta associada. Não é possível validar horário de funcionamento.'}), 400
            
            logger.info(f"Validando horários de funcionamento para reagendamento: plant_id={plant_id_to_validate}, date={appointment.date}, time={appointment.time}, time_end={appointment.time_end}")
            from src.utils.operating_hours_validator import validate_operating_hours
            is_valid, error_msg = validate_operating_hours(plant_id_to_validate, appointment.date, appointment.time, appointment.time_end)
            if not is_valid:
                logger.warning(f"Validação de horário de funcionamento falhou para plant_id={plant_id_to_validate}: {error_msg}")
                return jsonify({'error': error_msg}), 400
        
        if 'purchase_order' in data:
            appointment.purchase_order = data['purchase_order'].strip()
        
        if 'truck_plate' in data:
            appointment.truck_plate = data['truck_plate'].strip().upper()
        
        if 'driver_name' in data:
            appointment.driver_name = data['driver_name'].strip()
        
        if 'supplier_id' in data:
            from src.models.supplier import Supplier
            supplier = Supplier.query.get(data['supplier_id'])
            if not supplier:
                return jsonify({'error': 'Fornecedor não encontrado'}), 404
            if not supplier.is_active:
                return jsonify({'error': 'Fornecedor inativo'}), 400
            appointment.supplier_id = data['supplier_id']
        
        appointment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Agendamento atualizado com sucesso',
            'appointment': appointment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao atualizar agendamento: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@permission_required('delete_appointment', 'editor')
def delete_appointment(current_user, appointment_id):
    """Exclui um agendamento"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        appointment = Appointment.query.get(appointment_id)
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # Verificar se o agendamento pertence à planta do usuário
        if appointment.plant_id != current_user.plant_id:
            return jsonify({'error': 'Agendamento não pertence a esta planta'}), 403
        
        # Verificar se pode ser excluído
        if appointment.status == 'checked_in':
            return jsonify({'error': 'Não é possível excluir agendamento que já fez check-in'}), 400
        
        if appointment.status == 'checked_out':
            return jsonify({'error': 'Não é possível excluir agendamento que já foi finalizado'}), 400
        
        db.session.delete(appointment)
        db.session.commit()
        
        logger.info(f"Agendamento {appointment_id} excluído com sucesso por planta {current_user.plant_id}")
        return jsonify({'message': 'Agendamento excluído com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao excluir agendamento: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/appointments/<int:appointment_id>/check-in', methods=['POST'])
@permission_required('check_in', 'editor')
def check_in_appointment(current_user, appointment_id):
    """Realiza check-in de um agendamento"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem fazer check-in'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        appointment = Appointment.query.get_or_404(appointment_id)
        
        # Verificar se o agendamento pertence à planta do usuário
        if appointment.plant_id != current_user.plant_id:
            return jsonify({'error': 'Agendamento não pertence a esta planta'}), 403
        
        # Verificar se já está com check-in
        if appointment.status == 'checked_in':
            return jsonify({'error': 'Agendamento já está com check-in realizado'}), 400
        
        # Verificar se já está com check-out
        if appointment.status == 'checked_out':
            return jsonify({'error': 'Agendamento já foi finalizado (check-out realizado)'}), 400
        
        # Realizar check-in
        appointment.status = 'checked_in'
        appointment.check_in_time = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Check-in realizado com sucesso',
            'appointment': appointment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao realizar check-in: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/appointments/<int:appointment_id>/check-out', methods=['POST'])
@permission_required('check_out', 'editor')
def check_out_appointment(current_user, appointment_id):
    """Realiza check-out de um agendamento"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem fazer check-out'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        appointment = Appointment.query.get_or_404(appointment_id)
        
        # Verificar se o agendamento pertence à planta do usuário
        if appointment.plant_id != current_user.plant_id:
            return jsonify({'error': 'Agendamento não pertence a esta planta'}), 403
        
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
        logger.error(f"Erro ao realizar check-out: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/profile', methods=['GET'])
@token_required
def get_plant_profile(current_user):
    """Retorna informações da planta do usuário"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        plant = Plant.query.get(current_user.plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        return jsonify({
            'plant': plant.to_dict(),
            'user': current_user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar perfil da planta: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/operating-hours', methods=['GET'])
@token_required
def get_plant_operating_hours(current_user):
    """Retorna horários de funcionamento da planta"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        from src.models.operating_hours import OperatingHours
        
        # Buscar configurações de horários de funcionamento da planta
        configs = OperatingHours.query.filter_by(
            plant_id=current_user.plant_id,
            is_active=True
        ).all()
        
        result = {
            'weekdays': None,
            'weekend': [],
            'holiday': None
        }
        
        for config in configs:
            if config.schedule_type == 'weekdays':
                result['weekdays'] = {
                    'enabled': True,
                    'start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'end': config.operating_end.strftime('%H:%M') if config.operating_end else None
                }
            elif config.schedule_type == 'weekend':
                result['weekend'].append({
                    'day': config.day_of_week,
                    'start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'end': config.operating_end.strftime('%H:%M') if config.operating_end else None
                })
            elif config.schedule_type == 'holiday':
                result['holiday'] = {
                    'enabled': True,
                    'start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'end': config.operating_end.strftime('%H:%M') if config.operating_end else None
                }
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar horários de funcionamento: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/suppliers', methods=['GET'])
@token_required
@permission_required('view_suppliers', 'viewer')
def get_suppliers(current_user):
    """Lista todos os fornecedores ativos - usuários de planta podem visualizar todos"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        from src.models.supplier import Supplier
        
        # Usuários de planta podem visualizar todos os fornecedores cadastrados
        suppliers = Supplier.query.filter_by(is_deleted=False).all()
        return jsonify([supplier.to_dict() for supplier in suppliers]), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar fornecedores: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/plants', methods=['GET'])
@token_required
@permission_required('view_plants', 'viewer')
def get_plants(current_user):
    """Lista plantas - para usuários de planta, retorna apenas a própria planta"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        if not current_user.plant_id:
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        # Para usuários de planta, retornar apenas a própria planta
        plant = Plant.query.get(current_user.plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        plant_dict = plant.to_dict()
        # Garantir que CNPJ sempre esteja presente
        if 'cnpj' not in plant_dict or plant_dict['cnpj'] is None:
            plant_dict['cnpj'] = getattr(plant, 'cnpj', '') or ''
        
        return jsonify([plant_dict]), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar plantas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/system-config/max-capacity', methods=['GET'])
@token_required
@permission_required('view_system_config', 'viewer')
def get_max_capacity(current_user):
    """Retorna a configuração de capacidade máxima por horário"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        from src.models.system_config import SystemConfig
        
        config = SystemConfig.query.filter_by(key='max_capacity_per_slot').first()
        
        if config:
            return jsonify({
                'max_capacity': int(config.value),
                'config': config.to_dict()
            }), 200
        else:
            # Valor padrão se não existir configuração
            return jsonify({
                'max_capacity': 1,
                'config': None
            }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar max_capacity: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/system-config/max-capacity', methods=['POST'])
@token_required
@permission_required('configure_max_capacity', 'editor')
def set_max_capacity(current_user):
    """Define a configuração de capacidade máxima por horário"""
    try:
        if current_user.role != 'plant':
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        from src.models.system_config import SystemConfig
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        if 'max_capacity' not in data:
            return jsonify({'error': 'Campo max_capacity é obrigatório'}), 400
        
        try:
            max_capacity = int(data['max_capacity'])
        except (ValueError, TypeError):
            return jsonify({'error': 'max_capacity deve ser um número inteiro'}), 400
        
        if max_capacity < 1:
            return jsonify({'error': 'Capacidade máxima deve ser no mínimo 1'}), 400
        
        # Criar ou atualizar configuração
        config = SystemConfig.query.filter_by(key='max_capacity_per_slot').first()
        if config:
            config.value = str(max_capacity)
            config.description = 'Capacidade máxima de agendamentos por horário'
            config.updated_at = datetime.utcnow()
        else:
            config = SystemConfig(
                key='max_capacity_per_slot',
                value=str(max_capacity),
                description='Capacidade máxima de agendamentos por horário'
            )
            db.session.add(config)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Configuração salva com sucesso',
            'max_capacity': max_capacity,
            'config': config.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao salvar max_capacity: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

