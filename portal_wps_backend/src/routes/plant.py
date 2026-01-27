from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, time, date
from src.models.user import User, db
from src.models.appointment import Appointment
from src.models.plant import Plant
from src.routes.auth import token_required, plant_required
from src.utils.permissions import permission_required
from src.utils.helpers import generate_appointment_number
import logging

logger = logging.getLogger(__name__)

plant_bp = Blueprint('plant', __name__)

@plant_bp.route('/appointments', methods=['GET'])
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
        
        
        result = []
        for apt in appointments:
            apt_dict = apt.to_dict()
            # Buscar informações do fornecedor
            # Validar que o fornecedor pertence à mesma company
            if apt.supplier_id:
                from src.models.supplier import Supplier
                supplier = Supplier.query.filter_by(
                    id=apt.supplier_id,
                    is_deleted=False,
                    company_id=current_user.company_id
                ).first()
                if supplier:
                    apt_dict['supplier'] = supplier.to_dict()
            result.append(apt_dict)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar agendamentos da planta: {str(e)}")
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
        
        # Verificar se o fornecedor existe e pertence à mesma company
        from src.models.supplier import Supplier
        supplier = Supplier.query.filter_by(
            id=data['supplier_id'],
            company_id=current_user.company_id
        ).first()
        if not supplier:
            return jsonify({'error': 'Fornecedor não encontrado ou não pertence ao seu domínio'}), 404
        
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
                # Multi-tenant: filtrar por company_id
                query = Appointment.query.filter(
                    Appointment.date == appointment_date,
                    Appointment.plant_id == current_user.plant_id,
                    Appointment.company_id == current_user.company_id
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
        
        # Gerar número único do agendamento
        appointment_number = generate_appointment_number(appointment_date)
        
        # Criar agendamento (plant_id preenchido automaticamente com a planta do usuário)
        appointment = Appointment(
            appointment_number=appointment_number,
            date=appointment_date,
            time=appointment_time,
            time_end=appointment_time_end,
            purchase_order=data['purchase_order'],
            truck_plate=data['truck_plate'],
            driver_name=data['driver_name'],
            supplier_id=data['supplier_id'],
            plant_id=current_user.plant_id,  # Preenchido automaticamente com a planta do usuário
            company_id=current_user.company_id
        )
        
        db.session.add(appointment)
        db.session.commit()
        
        return jsonify({
            'message': 'Agendamento criado com sucesso',
            'appointment': appointment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao criar agendamento: {str(e)}")
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
            # Verificar se o usuário tem permissão para reagendar
            from src.utils.permissions import has_permission
            if not has_permission('reschedule', 'editor', current_user):
                return jsonify({
                    'error': 'Você não tem permissão para reagendar agendamentos. Apenas usuários com perfil Editor podem reagendar.',
                    'permission_required': 'reschedule',
                    'permission_level': 'editor'
                }), 403
            
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
            # Verificar se o fornecedor existe, está ativo e pertence à mesma company
            supplier = Supplier.query.filter_by(
                id=data['supplier_id'],
                is_deleted=False,
                company_id=current_user.company_id
            ).first()
            if not supplier:
                return jsonify({'error': 'Fornecedor não encontrado ou não pertence ao seu domínio'}), 404
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
        logger.error(f"Erro ao atualizar agendamento: {str(e)}")
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
        logger.error(f"Erro ao excluir agendamento: {str(e)}")
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
        
        # Verificar se a data do agendamento é a data atual (apenas para perfis de planta e fornecedor)
        today = date.today()
        if appointment.date != today:
            return jsonify({'error': 'Check-in só pode ser realizado na data do agendamento'}), 400
        
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
def get_suppliers(current_user):
    """Lista fornecedores ativos da mesma company da planta
    
    IMPORTANTE: Plantas sempre precisam visualizar fornecedores para criar agendamentos,
    então esta rota não usa @permission_required para garantir acesso mesmo sem permissão configurada.
    A verificação de permissão é feita internamente, mas não bloqueia o acesso se não estiver configurada.
    
    Multi-tenant: Filtra apenas fornecedores da mesma company da planta.
    """
    try:
        
        if current_user.role != 'plant':
            logger.warning(f"[get_suppliers] Acesso negado - role incorreto: {current_user.role}")
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        # Verificar permissão, mas não bloquear se não estiver configurada
        # Plantas sempre precisam visualizar fornecedores para criar agendamentos
        from src.utils.permissions import has_permission
        from src.models.permission import Permission
        
        # Multi-tenant: usar company_id do usuário
        permission_type = Permission.get_permission(current_user.role, 'view_suppliers', current_user.company_id)
        has_view_permission = has_permission('view_suppliers', 'viewer', current_user)
        
        
        # Se a permissão estiver configurada como 'none', ainda permitir acesso
        # pois plantas precisam visualizar fornecedores para criar agendamentos
        # Esta é uma regra de negócio especial para esta funcionalidade
        if permission_type == 'none':
            logger.info(f"[get_suppliers] Permissão não configurada (none), mas permitindo acesso para plantas (regra de negócio)")
        
        from src.models.supplier import Supplier
        from sqlalchemy import and_
        
        # Filtrar apenas fornecedores da mesma company da planta
        suppliers = Supplier.query.filter(
            and_(
                Supplier.is_deleted == False,
                Supplier.company_id == current_user.company_id
            )
        ).all()
        logger.info(f"[get_suppliers] Usuário {current_user.id} (company_id: {current_user.company_id}) - Encontrados {len(suppliers)} fornecedores")
        
        result = [supplier.to_dict() for supplier in suppliers]
        logger.info(f"[get_suppliers] Retornando {len(result)} fornecedores")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"[get_suppliers] Erro: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/plants', methods=['GET'])
@permission_required('view_plants', 'viewer')
def get_plants(current_user):
    """Lista plantas - para usuários de planta, retorna apenas a própria planta"""
    try:
        logger.info(f"[get_plants] Chamado por usuário {current_user.id} (role: {current_user.role}, plant_id: {current_user.plant_id})")
        
        if current_user.role != 'plant':
            logger.warning(f"[get_plants] Acesso negado - role incorreto: {current_user.role}")
            return jsonify({'error': 'Acesso negado. Apenas plantas podem acessar'}), 403
        
        if not current_user.plant_id:
            logger.error(f"[get_plants] Usuário {current_user.id} não possui plant_id")
            return jsonify({'error': 'Usuário não está vinculado a uma planta'}), 400
        
        # Para usuários de planta, retornar apenas a própria planta
        plant = Plant.query.get(current_user.plant_id)
        if not plant:
            logger.error(f"[get_plants] Planta {current_user.plant_id} não encontrada")
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        plant_dict = plant.to_dict()
        # Garantir que CNPJ sempre esteja presente
        if 'cnpj' not in plant_dict or plant_dict['cnpj'] is None:
            plant_dict['cnpj'] = getattr(plant, 'cnpj', '') or ''
        
        logger.info(f"[get_plants] Retornando planta {plant.id} ({plant.name})")
        return jsonify([plant_dict]), 200
        
    except Exception as e:
        logger.error(f"[get_plants] Erro: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@plant_bp.route('/system-config/max-capacity', methods=['GET'])
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

