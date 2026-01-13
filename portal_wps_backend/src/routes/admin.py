from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, time
from src.models.user import User, db
from src.models.supplier import Supplier
from src.models.appointment import Appointment
from src.models.plant import Plant
from src.routes.auth import admin_required
from src.utils.helpers import generate_temp_password
import logging

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__)

def get_time_slots_in_range(start_time, end_time):
    """Gera lista de slots de 1 hora dentro de um intervalo"""
    slots = []
    current = datetime.combine(datetime.today().date(), start_time)
    end = datetime.combine(datetime.today().date(), end_time)
    
    while current < end:
        slots.append(current.time())
        current += timedelta(hours=1)
    
    return slots

def validate_time_range_capacity(date, start_time, end_time, max_capacity, plant_id=None, exclude_appointment_id=None):
    """
    Valida se todos os slots de 1 hora dentro do intervalo respeitam a capacidade máxima.
    Retorna (is_valid, conflicting_slot) onde:
    - is_valid: True se todos os slots estão disponíveis
    - conflicting_slot: horário que está indisponível (None se todos estão disponíveis)
    - plant_id: ID da planta para filtrar agendamentos (obrigatório)
    """
    from sqlalchemy import or_, and_
    
    if plant_id is None:
        raise ValueError("plant_id é obrigatório para validação de capacidade")
    
    slots = get_time_slots_in_range(start_time, end_time)
    
    for slot in slots:
        # Contar agendamentos que ocupam este slot para a planta específica
        # Um agendamento ocupa um slot se:
        # 1. É um agendamento antigo (sem time_end) e time == slot
        # 2. É um agendamento com intervalo e o slot está dentro do intervalo
        
        query = Appointment.query.filter(
            Appointment.date == date,
            Appointment.plant_id == plant_id
        ).filter(
            or_(
                # Agendamento antigo (sem time_end) que começa neste slot
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
        )
        
        if exclude_appointment_id:
            query = query.filter(Appointment.id != exclude_appointment_id)
        
        if query.count() >= max_capacity:
            return False, slot
    
    return True, None

@admin_bp.route('/suppliers', methods=['GET'])
@admin_required
def get_suppliers(current_user):
    """Lista todos os fornecedores ativos"""
    try:
        suppliers = Supplier.query.filter_by(is_deleted=False).all()
        return jsonify([supplier.to_dict() for supplier in suppliers]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/suppliers', methods=['POST'])
@admin_required
def create_supplier(current_user):
    """Cria um novo fornecedor e seu usuário de acesso"""
    try:
        data = request.get_json()
        
        if not data or not all(k in data for k in ['cnpj', 'description', 'email']):
            return jsonify({'error': 'CNPJ, descrição e email são obrigatórios'}), 400
        
        # Verificar se CNPJ já existe
        existing_supplier = Supplier.query.filter_by(cnpj=data['cnpj']).first()
        if existing_supplier:
            return jsonify({'error': 'CNPJ já cadastrado'}), 400
        
        # Verificar se email já existe
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            return jsonify({'error': 'Email já cadastrado'}), 400
        
        # Criar fornecedor
        supplier = Supplier(
            cnpj=data['cnpj'],
            description=data['description']
        )
        db.session.add(supplier)
        db.session.flush()  # Para obter o ID do supplier
        
        # Gerar senha temporária
        temp_password = generate_temp_password()
        
        # Criar usuário para o fornecedor
        user = User(
            email=data['email'],
            role='supplier',
            supplier_id=supplier.id
        )
        user.set_password(temp_password)
        db.session.add(user)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Fornecedor criado com sucesso',
            'supplier': supplier.to_dict(),
            'user': user.to_dict(),
            'temp_password': temp_password
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/appointments', methods=['GET', 'POST'])
@admin_required
def manage_appointments(current_user):
    """Gerencia agendamentos: GET para listar, POST para criar"""
    
    # GET - Retorna agendamentos para uma semana específica ou dia específico
    if request.method == 'GET':
        try:
            week_start = request.args.get('week')
            date_str = request.args.get('date')  # Para visualização diária
            
            logger.info(f"Parâmetros recebidos - week: {week_start}, date: {date_str}, plant_id: {request.args.get('plant_id')}")
            
            # Priorizar date sobre week se ambos estiverem presentes (visualização diária tem prioridade)
            # Se tem date, usar date (visualização diária)
            if date_str:
                try:
                    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
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
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Erro ao converter plant_id '{plant_id_raw}': {e}")
                            plant_id = None
                    
                    logger.info(f"Buscando agendamentos para data: {target_date}, planta: {plant_id} (raw: {plant_id_raw})")
                    
                    query = Appointment.query.filter(
                        Appointment.date == target_date
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
                        logger.info(f"Filtrado por planta: {plant_id} (incluindo agendamentos sem plant_id para compatibilidade)")
                    else:
                        logger.info("Nenhum filtro de planta aplicado - retornando todos os agendamentos do dia")
                    
                    appointments = query.order_by(Appointment.date, Appointment.time).all()
                    
                    logger.info(f"Encontrados {len(appointments)} agendamentos para data {target_date}")
                    if len(appointments) > 0:
                        logger.info(f"Primeiros agendamentos: {[{'id': a.id, 'date': str(a.date), 'status': a.status, 'plant_id': a.plant_id} for a in appointments[:3]]}")
                    
                    # Serializar agendamentos com tratamento de erro
                    result = []
                    for appointment in appointments:
                        try:
                            result.append(appointment.to_dict())
                        except Exception as e:
                            logger.error(f"Erro ao serializar agendamento {appointment.id}: {e}")
                            # Retornar dados básicos mesmo com erro
                            result.append({
                                'id': appointment.id,
                                'date': appointment.date.isoformat() if appointment.date else None,
                                'time': appointment.time.isoformat() if appointment.time else None,
                                'time_end': appointment.time_end.isoformat() if appointment.time_end else None,
                                'purchase_order': appointment.purchase_order,
                                'truck_plate': appointment.truck_plate,
                                'driver_name': appointment.driver_name,
                                'status': appointment.status,
                                'supplier_id': appointment.supplier_id,
                                'plant_id': appointment.plant_id,
                                'error': 'Erro ao carregar dados completos'
                            })
                    
                    logger.info(f"Retornando {len(result)} agendamentos serializados")
                    return jsonify(result), 200
                except ValueError as e:
                    logger.error(f"Erro ao processar data: {e}")
                    return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
            
            # Visualização semanal (compatibilidade)
            if not week_start:
                logger.warning("Nenhum parâmetro date ou week fornecido")
                return jsonify({'error': 'Parâmetro week ou date é obrigatório (formato: YYYY-MM-DD)'}), 400
            
            try:
                start_date = datetime.strptime(week_start, '%Y-%m-%d').date()
                logger.info(f"Buscando agendamentos para semana começando em: {start_date}")
            except ValueError:
                return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
            
            end_date = start_date + timedelta(days=6)
            
            appointments = Appointment.query.filter(
                Appointment.date >= start_date,
                Appointment.date <= end_date
            ).order_by(Appointment.date, Appointment.time).all()
            
            logger.info(f"Encontrados {len(appointments)} agendamentos para a semana")
            
            # Serializar agendamentos com tratamento de erro
            result = []
            for appointment in appointments:
                try:
                    result.append(appointment.to_dict())
                except Exception as e:
                    logger.error(f"Erro ao serializar agendamento {appointment.id}: {e}")
                    # Retornar dados básicos mesmo com erro
                    result.append({
                        'id': appointment.id,
                        'date': appointment.date.isoformat() if appointment.date else None,
                        'time': appointment.time.isoformat() if appointment.time else None,
                        'time_end': appointment.time_end.isoformat() if appointment.time_end else None,
                        'purchase_order': appointment.purchase_order,
                        'truck_plate': appointment.truck_plate,
                        'driver_name': appointment.driver_name,
                        'status': appointment.status,
                        'supplier_id': appointment.supplier_id,
                        'error': 'Erro ao carregar dados completos'
                    })
            
            return jsonify(result), 200
            
        except Exception as e:
            logger.error(f"Erro ao buscar agendamentos: {e}", exc_info=True)
            return jsonify({'error': str(e)}), 500
    
    # POST - Cria um novo agendamento
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            # Validar campos obrigatórios
            required_fields = ['date', 'time', 'time_end', 'purchase_order', 'truck_plate', 'driver_name', 'supplier_id']
            if not data or not all(k in data for k in required_fields):
                return jsonify({'error': 'Todos os campos são obrigatórios: date, time, time_end, purchase_order, truck_plate, driver_name, supplier_id'}), 400
            
            # Validar se time_end não está vazio
            if not data.get('time_end') or not data['time_end'].strip():
                return jsonify({'error': 'O horário final é obrigatório'}), 400
            
            # Validar formatos de data e hora
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
            supplier = Supplier.query.get(data['supplier_id'])
            if not supplier:
                return jsonify({'error': 'Fornecedor não encontrado'}), 404
            
            if not supplier.is_active:
                return jsonify({'error': 'Fornecedor inativo'}), 400
            
            # Validar horários de funcionamento da planta (se plant_id foi fornecido)
            plant_id = data.get('plant_id')
            if not plant_id:
                return jsonify({'error': 'plant_id é obrigatório para criar agendamento'}), 400
            
            from src.utils.operating_hours_validator import validate_operating_hours
            is_valid, error_msg = validate_operating_hours(plant_id, appointment_date, appointment_time, appointment_time_end)
            if not is_valid:
                return jsonify({'error': error_msg}), 400
            
            # Verificar se a planta existe e obter sua capacidade máxima
            from src.models.plant import Plant
            plant = Plant.query.get(plant_id)
            if not plant:
                return jsonify({'error': 'Planta não encontrada'}), 404
            
            # Usar capacidade máxima da planta (padrão: 1 se não configurado)
            max_capacity = plant.max_capacity if plant.max_capacity else 1
            
            # Validar capacidade para todos os slots do intervalo
            if appointment_time_end:
                # Agendamento com intervalo
                is_valid, conflicting_slot = validate_time_range_capacity(
                    appointment_date, 
                    appointment_time, 
                    appointment_time_end, 
                    max_capacity,
                    plant_id
                )
                
                if not is_valid:
                    slot_str = conflicting_slot.strftime('%H:%M') if conflicting_slot else 'desconhecido'
                    return jsonify({
                        'error': f'Capacidade máxima de {max_capacity} agendamento(s) por horário foi atingida no horário {slot_str}. Por favor, escolha outro intervalo.'
                    }), 409
            else:
                # Agendamento antigo (apenas horário único) - manter compatibilidade
                from sqlalchemy import and_, or_
                
                # Contar todos os agendamentos que ocupam este horário específico para esta planta:
                # 1. Agendamentos antigos (sem time_end) que começam neste horário
                # 2. Agendamentos com intervalo que incluem este horário
                total_count = Appointment.query.filter(
                    Appointment.date == appointment_date,
                    Appointment.plant_id == plant_id
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
                    }), 409
            
            # Criar agendamento
            appointment = Appointment(
                date=appointment_date,
                time=appointment_time,
                time_end=appointment_time_end,
                purchase_order=data['purchase_order'].strip(),
                truck_plate=data['truck_plate'].strip().upper(),
                driver_name=data['driver_name'].strip(),
                supplier_id=data['supplier_id'],
                plant_id=data.get('plant_id'),  # Opcional para admin
                status='scheduled'
            )
            
            db.session.add(appointment)
            db.session.commit()
            
            return jsonify({
                'message': 'Agendamento criado com sucesso',
                'appointment': appointment.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@admin_bp.route('/appointments/<int:appointment_id>/check-in', methods=['POST'])
@admin_required
def check_in_appointment(current_user, appointment_id):
    """Realiza check-in de um agendamento"""
    try:
        appointment = Appointment.query.get(appointment_id)
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        logger.info(f"Check-in solicitado para appointment {appointment_id}. Status atual: {appointment.status}")
        
        # Permitir check-in apenas para agendamentos agendados ou reagendados
        if appointment.status not in ['scheduled', 'rescheduled']:
            error_msg = f'Agendamento não pode receber check-in. Status atual: {appointment.status}'
            logger.warning(f"Check-in negado: {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        appointment.status = 'checked_in'
        appointment.check_in_time = datetime.utcnow()
        
        db.session.commit()
        logger.info(f"Check-in realizado com sucesso para appointment {appointment_id}. Novo status: {appointment.status}")
        
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
        logger.error(f"Erro ao realizar check-in: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/appointments/<int:appointment_id>/check-out', methods=['POST'])
@admin_required
def check_out_appointment(current_user, appointment_id):
    """Realiza check-out de um agendamento"""
    try:
        appointment = Appointment.query.get(appointment_id)
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        if appointment.status != 'checked_in':
            return jsonify({'error': f'Agendamento deve estar em check-in para fazer check-out. Status atual: {appointment.status}'}), 400
        
        appointment.status = 'checked_out'
        appointment.check_out_time = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Check-out realizado com sucesso',
            'appointment': appointment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@admin_required
def update_appointment(current_user, appointment_id):
    """Atualiza um agendamento existente"""
    try:
        appointment = Appointment.query.get(appointment_id)
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Log completo dos dados recebidos
        logger.info(f"=== INÍCIO ATUALIZAÇÃO APPOINTMENT {appointment_id} ===")
        logger.info(f"Dados recebidos: {data}")
        logger.info(f"Chaves presentes: {list(data.keys())}")
        logger.info(f"motivo_reagendamento presente: {'motivo_reagendamento' in data}")
        if 'motivo_reagendamento' in data:
            logger.info(f"Valor do motivo_reagendamento: '{data.get('motivo_reagendamento')}'")
        
        # Armazenar valores originais para validação
        original_date = appointment.date
        original_time = appointment.time
        original_time_end = appointment.time_end
        
        logger.info(f"Valores originais - Data: {original_date}, Time: {original_time}, Time_end: {original_time_end}")
        
        # Detectar se houve mudança de data ou horário
        date_changed = False
        time_changed = False
        
        # Atualizar campos permitidos
        if 'date' in data:
            try:
                new_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
                if new_date < datetime.now().date():
                    return jsonify({'error': 'Não é possível agendar para datas passadas'}), 400
                logger.info(f"Comparando datas - Original: {original_date} ({type(original_date)}), Nova: {new_date} ({type(new_date)})")
                if new_date != original_date:
                    date_changed = True
                    logger.info(f"Data alterada detectada: {original_date} -> {new_date}")
                appointment.date = new_date
            except ValueError:
                return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        if 'time' in data:
            try:
                # Aceitar tanto HH:MM quanto HH:MM:SS
                time_str = data['time']
                if len(time_str) == 5:  # HH:MM
                    new_time = datetime.strptime(time_str, '%H:%M').time()
                elif len(time_str) == 8:  # HH:MM:SS
                    new_time = datetime.strptime(time_str, '%H:%M:%S').time()
                else:
                    raise ValueError("Formato inválido")
                
                logger.info(f"Comparando horários - Original: {original_time} ({type(original_time)}), Novo: {new_time} ({type(new_time)})")
                if new_time != original_time:
                    time_changed = True
                    logger.info(f"Horário alterado detectado: {original_time} -> {new_time}")
                appointment.time = new_time
            except ValueError:
                return jsonify({'error': 'Formato de hora inválido. Use HH:MM ou HH:MM:SS'}), 400
        
        # Atualizar time_end (obrigatório)
        if 'time_end' in data:
            if not data['time_end'] or not data['time_end'].strip():
                return jsonify({'error': 'O horário final é obrigatório'}), 400
            
            try:
                time_end_str = data['time_end']
                if len(time_end_str) == 5:  # HH:MM
                    new_time_end = datetime.strptime(time_end_str, '%H:%M').time()
                elif len(time_end_str) == 8:  # HH:MM:SS
                    new_time_end = datetime.strptime(time_end_str, '%H:%M:%S').time()
                else:
                    raise ValueError("Formato inválido")
                
                # Validar que time_end > time
                if new_time_end <= appointment.time:
                    return jsonify({'error': 'O horário final deve ser maior que o horário inicial'}), 400
                
                logger.info(f"Comparando horários finais - Original: {original_time_end} ({type(original_time_end)}), Novo: {new_time_end} ({type(new_time_end)})")
                if new_time_end != original_time_end:
                    time_changed = True
                    logger.info(f"Horário final alterado detectado: {original_time_end} -> {new_time_end}")
                appointment.time_end = new_time_end
            except ValueError:
                return jsonify({'error': 'Formato de hora final inválido. Use HH:MM ou HH:MM:SS'}), 400
        else:
            # Se time_end não foi fornecido, garantir que existe
            if not appointment.time_end:
                return jsonify({'error': 'O horário final é obrigatório'}), 400
        
        # Verificar se houve reagendamento (mudança de data ou horário)
        # Também verificar se o motivo foi enviado (indica que o frontend detectou mudança)
        has_motivo_in_data = 'motivo_reagendamento' in data and data.get('motivo_reagendamento', '').strip()
        is_rescheduling = date_changed or time_changed or has_motivo_in_data
        
        logger.info(f"Reagendamento detectado? date_changed={date_changed}, time_changed={time_changed}, has_motivo={has_motivo_in_data}, is_rescheduling={is_rescheduling}")
        logger.info(f"Dados recebidos - motivo_reagendamento presente: {'motivo_reagendamento' in data}, valor: {data.get('motivo_reagendamento', 'NÃO ENVIADO')}")
        
        # Se houve reagendamento (mudança detectada OU motivo enviado), exigir motivo e aplicar status
        if is_rescheduling:
            motivo = data.get('motivo_reagendamento', '').strip() if 'motivo_reagendamento' in data else ''
            logger.info(f"Motivo recebido: '{motivo}' (tipo: {type(motivo)}, vazio: {not motivo})")
            
            if not motivo:
                return jsonify({
                    'error': 'Motivo do reagendamento é obrigatório quando há alteração de data ou horário',
                    'requires_reschedule_reason': True
                }), 400
            
            # Aplicar status rescheduled e salvar motivo ANTES de qualquer outra atualização
            logger.info(f"=== APLICANDO STATUS RESCHEDULED ===")
            logger.info(f"Status anterior: {appointment.status}")
            logger.info(f"Motivo a ser salvo: '{motivo}'")
            appointment.status = 'rescheduled'
            appointment.motivo_reagendamento = motivo
            logger.info(f"Status após atribuição: {appointment.status}")
            logger.info(f"Motivo após atribuição: {appointment.motivo_reagendamento}")
            logger.info(f"Verificação direta - appointment.status == 'rescheduled': {appointment.status == 'rescheduled'}")
        
        # Validar horários de funcionamento se data, time ou time_end foram alterados
        if is_rescheduling:
            # IMPORTANTE: Usar appointment.plant_id (planta do agendamento) para validar
            plant_id_to_validate = appointment.plant_id
            if not plant_id_to_validate:
                logger.warning(f"Agendamento {appointment_id} não possui plant_id. Pulando validação de horário de funcionamento.")
            else:
                logger.info(f"Validando horários de funcionamento para reagendamento: plant_id={plant_id_to_validate}, date={appointment.date}, time={appointment.time}, time_end={appointment.time_end}")
                from src.utils.operating_hours_validator import validate_operating_hours
                is_valid, error_msg = validate_operating_hours(plant_id_to_validate, appointment.date, appointment.time, appointment.time_end)
                if not is_valid:
                    logger.warning(f"Validação de horário de funcionamento falhou para plant_id={plant_id_to_validate}: {error_msg}")
                    return jsonify({'error': error_msg}), 400
        
        # Validar capacidade máxima se data, time ou time_end foram alterados
        if is_rescheduling:
            # Obter plant_id do agendamento (obrigatório)
            if not appointment.plant_id:
                return jsonify({'error': 'Agendamento sem planta associada. Não é possível validar capacidade.'}), 400
            
            # Buscar a planta e obter sua capacidade máxima
            from src.models.plant import Plant
            plant = Plant.query.get(appointment.plant_id)
            if not plant:
                return jsonify({'error': 'Planta não encontrada'}), 404
            
            # Usar capacidade máxima da planta (padrão: 1 se não configurado)
            max_capacity = plant.max_capacity if plant.max_capacity else 1
            
            # Validar capacidade para todos os slots do intervalo
            is_valid, conflicting_slot = validate_time_range_capacity(
                appointment.date, 
                appointment.time, 
                appointment.time_end, 
                max_capacity,
                plant_id=appointment.plant_id,
                exclude_appointment_id=appointment_id
            )
            
            if not is_valid:
                slot_str = conflicting_slot.strftime('%H:%M') if conflicting_slot else 'desconhecido'
                return jsonify({
                    'error': f'Capacidade máxima de {max_capacity} agendamento(s) por horário foi atingida no horário {slot_str}. Por favor, escolha outro intervalo.'
                }), 409
        
        if 'purchase_order' in data:
            appointment.purchase_order = data['purchase_order'].strip()
        
        if 'truck_plate' in data:
            appointment.truck_plate = data['truck_plate'].strip().upper()
        
        if 'driver_name' in data:
            appointment.driver_name = data['driver_name'].strip()
        
        # Atualizar motivo_reagendamento apenas se não foi definido acima (para reagendamentos)
        if 'motivo_reagendamento' in data and not is_rescheduling:
            # Se não houve reagendamento, não atualizar o motivo (mantém o anterior se existir)
            pass
        
        if 'supplier_id' in data:
            # Verificar se o fornecedor existe e está ativo
            supplier = Supplier.query.get(data['supplier_id'])
            if not supplier:
                return jsonify({'error': 'Fornecedor não encontrado'}), 404
            if not supplier.is_active:
                return jsonify({'error': 'Fornecedor inativo'}), 400
            appointment.supplier_id = data['supplier_id']
        
        appointment.updated_at = datetime.utcnow()
        
        # Log final antes do commit
        logger.info(f"=== ANTES DO COMMIT ===")
        logger.info(f"Status: {appointment.status}, Motivo: {appointment.motivo_reagendamento}")
        logger.info(f"is_rescheduling: {is_rescheduling}")
        logger.info(f"motivo_reagendamento presente nos dados: {'motivo_reagendamento' in data}")
        
        # FORÇAR aplicação do status se é reagendamento
        if is_rescheduling:
            logger.info(f"FORÇANDO aplicação do status 'rescheduled'")
            appointment.status = 'rescheduled'
            if 'motivo_reagendamento' in data and data.get('motivo_reagendamento', '').strip():
                appointment.motivo_reagendamento = data['motivo_reagendamento'].strip()
            logger.info(f"Status após forçar: {appointment.status}, Motivo: {appointment.motivo_reagendamento}")
        
        db.session.commit()
        
        # Recarregar o objeto do banco para garantir que temos os dados atualizados
        db.session.refresh(appointment)
        
        # Log após commit para confirmar
        logger.info(f"=== APÓS COMMIT ===")
        logger.info(f"Status no banco: {appointment.status}, Motivo: {appointment.motivo_reagendamento}")
        
        # Criar dicionário de resposta FORÇANDO status e motivo corretos
        appointment_dict = appointment.to_dict()
        if is_rescheduling:
            logger.info(f"FORÇANDO status e motivo na resposta")
            appointment_dict['status'] = 'rescheduled'
            if 'motivo_reagendamento' in data and data.get('motivo_reagendamento', '').strip():
                appointment_dict['motivo_reagendamento'] = data['motivo_reagendamento'].strip()
            logger.info(f"Resposta final - Status: {appointment_dict['status']}, Motivo: {appointment_dict.get('motivo_reagendamento', 'NÃO DEFINIDO')}")
        
        logger.info(f"=== FIM ATUALIZAÇÃO APPOINTMENT {appointment_id} ===")
        
        return jsonify({
            'message': 'Agendamento atualizado com sucesso',
            'appointment': appointment_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/suppliers/<int:supplier_id>', methods=['PUT'])
@admin_required
def update_supplier(current_user, supplier_id):
    """Atualiza dados de um fornecedor"""
    try:
        supplier = Supplier.query.get(supplier_id)
        
        if not supplier:
            return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Atualizar campos permitidos
        if 'description' in data:
            supplier.description = data['description']
        
        if 'is_active' in data:
            supplier.is_active = data['is_active']
        
        supplier.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Fornecedor atualizado com sucesso',
            'supplier': supplier.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/suppliers/<int:supplier_id>', methods=['DELETE'])
@admin_required
def delete_supplier(current_user, supplier_id):
    """Soft delete de um fornecedor"""
    try:
        supplier = Supplier.query.get(supplier_id)
        
        if not supplier:
            return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        # Verificar se há agendamentos ativos
        active_appointments = Appointment.query.filter_by(
            supplier_id=supplier_id
        ).filter(
            Appointment.status.in_(['scheduled', 'checked_in'])
        ).count()
        
        if active_appointments > 0:
            return jsonify({'error': 'Não é possível excluir fornecedor com agendamentos ativos'}), 400
        
        # Soft delete
        supplier.is_deleted = True
        supplier.is_active = False
        supplier.updated_at = datetime.utcnow()
        
        # Desativar usuários do fornecedor
        User.query.filter_by(supplier_id=supplier_id).update({'is_active': False})
        
        db.session.commit()
        
        return jsonify({'message': 'Fornecedor excluído com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@admin_required
def delete_appointment(current_user, appointment_id):
    """Exclui um agendamento"""
    try:
        appointment = Appointment.query.get(appointment_id)
        
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado'}), 404
        
        # Verificar se pode ser excluído
        if appointment.status == 'checked_in':
            return jsonify({'error': 'Não é possível excluir agendamento que já fez check-in'}), 400
        
        db.session.delete(appointment)
        db.session.commit()
        
        return jsonify({'message': 'Agendamento excluído com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/schedule-config', methods=['GET'])
@admin_required
def get_schedule_config(current_user):
    """Retorna configurações de horários para uma data específica"""
    try:
        from src.models.schedule_config import ScheduleConfig
        
        date_str = request.args.get('date')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        configs = ScheduleConfig.query.filter_by(date=target_date).all()
        
        return jsonify([config.to_dict() for config in configs]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/schedule-config', methods=['POST'])
@admin_required
def create_schedule_config(current_user):
    """Cria ou atualiza configuração de horário"""
    try:
        from src.models.schedule_config import ScheduleConfig
        
        data = request.get_json()
        
        if not data or not all(k in data for k in ['date', 'time', 'is_available']):
            return jsonify({'error': 'Data, horário e disponibilidade são obrigatórios'}), 400
        
        try:
            target_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            target_time = datetime.strptime(data['time'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Formato de data/hora inválido'}), 400
        
        # Verificar se já existe configuração para esta data/hora
        existing_config = ScheduleConfig.query.filter_by(
            date=target_date,
            time=target_time
        ).first()
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Salvando configuração: date={target_date}, time={target_time}, is_available={data['is_available']}")
        
        # Criar ou atualizar registro (tanto para bloquear quanto para desbloquear)
        # Isso permite marcar explicitamente que o horário foi configurado
        if existing_config:
            # Atualizar existente
            logger.info(f"Atualizando configuração existente: id={existing_config.id}, is_available: {existing_config.is_available} -> {data['is_available']}")
            existing_config.is_available = data['is_available']
            existing_config.reason = data.get('reason', '') if not data['is_available'] else ''
            existing_config.updated_at = datetime.utcnow()
            config = existing_config
        else:
            # Criar novo
            logger.info(f"Criando nova configuração: is_available={data['is_available']}")
            config = ScheduleConfig(
                date=target_date,
                time=target_time,
                is_available=data['is_available'],
                reason=data.get('reason', '') if not data['is_available'] else ''
            )
            db.session.add(config)
        
        db.session.commit()
        logger.info(f"Configuração salva: id={config.id}, is_available={config.is_available}")
        
        return jsonify({
            'message': 'Configuração salva com sucesso',
            'config': config.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/available-times', methods=['GET'])
@admin_required
def get_available_times(current_user):
    """Retorna horários disponíveis para uma data específica"""
    try:
        from src.models.schedule_config import ScheduleConfig
        from src.models.default_schedule import DefaultSchedule
        
        date_str = request.args.get('date')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD'}), 400
        
        # Horários de 00:00 até 23:00 (intervalos de 1 hora)
        default_times = []
        for hour in range(0, 24):
            default_times.append(f"{hour:02d}:00")
        
        # Buscar configurações específicas para esta data
        configs = ScheduleConfig.query.filter_by(date=target_date).all()
        config_dict = {config.time.strftime('%H:%M'): config for config in configs}
        
        # Buscar configurações padrão
        day_of_week = target_date.weekday() + 1  # Converter para 1=Segunda, 7=Domingo
        if day_of_week == 7:
            day_of_week = 0  # Domingo = 0
        
        default_configs = DefaultSchedule.query.filter(
            (DefaultSchedule.day_of_week == day_of_week) | 
            (DefaultSchedule.day_of_week.is_(None))
        ).all()
        default_config_dict = {config.time.strftime('%H:%M'): config for config in default_configs}
        
        # Buscar horários de funcionamento
        from src.models.operating_hours import OperatingHours
        operating_hours_config = None
        
        # Determinar tipo de dia (weekday, weekend, holiday)
        is_weekend = day_of_week == 0 or day_of_week == 6  # Domingo ou Sábado
        
        if is_weekend:
            # Buscar configuração de fim de semana para o dia específico
            operating_hours_config = OperatingHours.query.filter_by(
                schedule_type='weekend',
                day_of_week=day_of_week,
                is_active=True
            ).first()
        else:
            # Buscar configuração de dias úteis
            operating_hours_config = OperatingHours.query.filter_by(
                schedule_type='weekdays',
                day_of_week=None,
                is_active=True
            ).first()
        
        # Buscar agendamentos existentes para esta data
        existing_appointments = Appointment.query.filter_by(date=target_date).all()
        occupied_times = {apt.time.strftime('%H:%M') for apt in existing_appointments}
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Carregando horários para {target_date}: {len(configs)} configurações específicas encontradas")
        
        available_times = []
        for time_str in default_times:
            specific_config = config_dict.get(time_str)
            default_config = default_config_dict.get(time_str)
            
            # Verificar se está dentro do horário de funcionamento
            # Se não houver configuração de horário de funcionamento, permite todos (24h)
            is_in_operating_hours = True
            if operating_hours_config:
                is_in_operating_hours = operating_hours_config.is_time_in_range(time_str)
            
            # Prioridade: configuração específica > configuração padrão > horário de funcionamento > disponível se não ocupado
            if specific_config:
                # Configuração específica tem prioridade absoluta - ignora horário de funcionamento
                # Se está desbloqueado explicitamente, deve estar disponível independente do horário de funcionamento
                is_available = specific_config.is_available
                reason = None
                if not specific_config.is_available:
                    reason = specific_config.reason
                config_type = "específica"
                logger.debug(f"  {time_str}: específica, is_available={is_available}, reason={reason}")
            elif default_config:
                # Configuração padrão respeita horário de funcionamento
                is_available = default_config.is_available and is_in_operating_hours
                reason = None
                if not default_config.is_available:
                    reason = default_config.reason
                elif not is_in_operating_hours:
                    reason = "Fora do horário de funcionamento"
                config_type = "padrão"
            else:
                # Verificar se está ocupado e dentro do horário de funcionamento
                is_available = (time_str not in occupied_times) and is_in_operating_hours
                reason = None
                if time_str in occupied_times:
                    reason = "Horário ocupado"
                elif not is_in_operating_hours:
                    reason = "Fora do horário de funcionamento"
                config_type = "automática"
            
            available_times.append({
                'time': time_str,
                'is_available': is_available,
                'reason': reason,
                'has_appointment': time_str in occupied_times,
                'config_type': config_type
            })
        
        return jsonify(available_times), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/default-schedule', methods=['GET'])
@admin_required
def get_default_schedule(current_user):
    """Retorna configurações padrão de horários"""
    try:
        from src.models.default_schedule import DefaultSchedule
        
        configs = DefaultSchedule.query.all()
        
        return jsonify([config.to_dict() for config in configs]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/default-schedule', methods=['POST'])
@admin_required
def create_default_schedule(current_user):
    """Cria configuração padrão de horário"""
    try:
        from src.models.default_schedule import DefaultSchedule
        
        data = request.get_json()
        
        if not data or not all(k in data for k in ['time', 'is_available']):
            return jsonify({'error': 'Horário e disponibilidade são obrigatórios'}), 400
        
        try:
            target_time = datetime.strptime(data['time'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Formato de hora inválido'}), 400
        
        day_of_week = data.get('day_of_week')  # None = todos os dias
        
        # Verificar se já existe configuração para este horário/dia
        existing_config = DefaultSchedule.query.filter_by(
            day_of_week=day_of_week,
            time=target_time
        ).first()
        
        if existing_config:
            # Atualizar existente
            existing_config.is_available = data['is_available']
            existing_config.reason = data.get('reason', '')
            existing_config.updated_at = datetime.utcnow()
            config = existing_config
        else:
            # Criar novo
            config = DefaultSchedule(
                day_of_week=day_of_week,
                time=target_time,
                is_available=data['is_available'],
                reason=data.get('reason', '')
            )
            db.session.add(config)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Configuração padrão salva com sucesso',
            'config': config.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/default-schedule/<int:config_id>', methods=['DELETE'])
@admin_required
def delete_default_schedule(current_user, config_id):
    """Remove configuração padrão de horário"""
    try:
        from src.models.default_schedule import DefaultSchedule
        
        config = DefaultSchedule.query.get(config_id)
        
        if not config:
            return jsonify({'error': 'Configuração não encontrada'}), 404
        
        db.session.delete(config)
        db.session.commit()
        
        return jsonify({'message': 'Configuração removida com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Rotas antigas (deprecated - mantidas para compatibilidade)
@admin_bp.route('/system-config/max-capacity', methods=['GET'])
@admin_required
def get_max_capacity(current_user):
    """DEPRECATED: Retorna a configuração global de capacidade máxima por horário (mantida para compatibilidade)"""
    try:
        from src.models.system_config import SystemConfig
        
        config = SystemConfig.query.filter_by(key='max_capacity_per_slot').first()
        
        if config:
            return jsonify({
                'max_capacity': int(config.value),
                'config': config.to_dict(),
                'deprecated': True,
                'message': 'Esta rota está depreciada. Use /plants/<plant_id>/max-capacity'
            }), 200
        else:
            return jsonify({
                'max_capacity': 1,
                'config': None,
                'deprecated': True,
                'message': 'Esta rota está depreciada. Use /plants/<plant_id>/max-capacity'
            }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/system-config/max-capacity', methods=['POST'])
@admin_required
def set_max_capacity(current_user):
    """DEPRECATED: Define a configuração global de capacidade máxima por horário (mantida para compatibilidade)"""
    return jsonify({
        'error': 'Esta rota está depreciada. Use /plants/<plant_id>/max-capacity para configurar capacidade por planta',
        'deprecated': True
    }), 410

# ==================== ROTAS DE PLANTAS ====================

# Rotas específicas devem vir ANTES das rotas genéricas
@admin_bp.route('/plants/<int:plant_id>/max-capacity', methods=['GET'])
@admin_required
def get_plant_max_capacity(current_user, plant_id):
    """Retorna a configuração de capacidade máxima por horário de uma planta"""
    try:
        from src.models.plant import Plant
        
        plant = Plant.query.get(plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        return jsonify({
            'max_capacity': plant.max_capacity if plant.max_capacity else 1,
            'plant_id': plant.id,
            'plant_name': plant.name
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants/<int:plant_id>/max-capacity', methods=['POST'])
@admin_required
def set_plant_max_capacity(current_user, plant_id):
    """Define a configuração de capacidade máxima por horário de uma planta"""
    try:
        from src.models.plant import Plant
        
        plant = Plant.query.get(plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        if 'max_capacity' not in data:
            return jsonify({'error': 'Campo max_capacity é obrigatório'}), 400
        
        try:
            max_capacity = int(data['max_capacity'])
        except (ValueError, TypeError) as e:
            return jsonify({'error': 'max_capacity deve ser um número inteiro'}), 400
        
        if max_capacity < 1:
            return jsonify({'error': 'Capacidade máxima deve ser no mínimo 1'}), 400
        
        # Atualizar capacidade da planta
        plant.max_capacity = max_capacity
        plant.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Capacidade máxima da planta atualizada com sucesso',
            'max_capacity': max_capacity,
            'plant_id': plant.id,
            'plant_name': plant.name
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar max_capacity da planta: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants', methods=['GET'])
@admin_required
def get_plants(current_user):
    """Lista todas as plantas"""
    try:
        from src.models.plant import Plant
        
        plants = Plant.query.order_by(Plant.name).all()
        result = []
        for plant in plants:
            # Verificar se o objeto plant tem o atributo cnpj
            try:
                cnpj_value = getattr(plant, 'cnpj', None)
                logger.info(f"Planta {plant.id} ({plant.name}) - CNPJ presente no objeto")
            except Exception as e:
                logger.error(f"Erro ao acessar CNPJ da planta {plant.id}: {str(e)}")
                cnpj_value = None
            
            plant_dict = plant.to_dict()
            # Garantir que CNPJ sempre esteja presente (mesmo que seja None ou string vazia)
            if 'cnpj' not in plant_dict:
                logger.warning(f"CNPJ não encontrado no dict da planta {plant.id}, adicionando campo vazio")
                plant_dict['cnpj'] = cnpj_value if cnpj_value else ''
            elif plant_dict['cnpj'] is None:
                plant_dict['cnpj'] = ''
            
            # Log detalhado para debug
            logger.info(f"Planta {plant.id} ({plant.name}) - CNPJ processado com sucesso")
            result.append(plant_dict)
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar plantas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants', methods=['POST'])
@admin_required
def create_plant(current_user):
    """Cria uma nova planta e seu usuário de acesso"""
    try:
        from src.models.plant import Plant
        
        data = request.get_json()
        
        # Log para debug
        logger.info(f"Dados recebidos para criar planta: {data}")
        
        if not data:
            logger.error("Dados vazios recebidos")
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        if not data.get('name'):
            logger.error("Nome não fornecido")
            return jsonify({'error': 'Nome da planta é obrigatório'}), 400
        
        if not data.get('code'):
            logger.error("Código não fornecido")
            return jsonify({'error': 'Código da planta é obrigatório'}), 400
        
        cnpj = data.get('cnpj', '').strip() if data.get('cnpj') else ''
        logger.info(f"CNPJ recebido (tipo: {type(cnpj)}, tamanho: {len(cnpj) if cnpj else 0})")
        if not cnpj:
            logger.error("CNPJ não fornecido ou vazio")
            return jsonify({'error': 'CNPJ da planta é obrigatório'}), 400
        
        if not data.get('email'):
            logger.error("Email não fornecido")
            return jsonify({'error': 'E-mail da planta é obrigatório'}), 400
        
        # Verificar se já existe planta com mesmo nome
        existing = Plant.query.filter_by(name=data['name']).first()
        if existing:
            return jsonify({
                'error': 'Já existe uma planta cadastrada com este nome',
                'field': 'name',
                'message': f'O nome "{data["name"]}" já está em uso por outra planta. Por favor, escolha um nome diferente.'
            }), 400
        
        # Verificar se já existe planta com mesmo código
        existing_code = Plant.query.filter_by(code=data['code']).first()
        if existing_code:
            return jsonify({
                'error': 'Já existe uma planta cadastrada com este código',
                'field': 'code',
                'message': f'O código "{data["code"]}" já está em uso por outra planta. Por favor, escolha um código diferente.'
            }), 400
        
        # Verificar se já existe planta com o mesmo CNPJ
        existing_cnpj = Plant.query.filter_by(cnpj=cnpj).first()
        if existing_cnpj:
            return jsonify({
                'error': 'CNPJ já cadastrado',
                'field': 'cnpj',
                'message': f'O CNPJ "{cnpj}" já está cadastrado para a planta "{existing_cnpj.name}". Por favor, verifique o CNPJ informado.'
            }), 400
        
        # Verificar se email já existe
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            # Se o usuário existe e está ativo OU tem uma planta associada ativa, não permitir
            if existing_user.is_active:
                if existing_user.plant_id:
                    existing_plant = Plant.query.get(existing_user.plant_id)
                    if existing_plant and existing_plant.is_active:
                        return jsonify({
                            'error': 'E-mail já cadastrado e em uso',
                            'field': 'email',
                            'message': f'O e-mail "{data["email"]}" já está cadastrado e em uso pela planta "{existing_plant.name}". Por favor, escolha um e-mail diferente.'
                        }), 400
                else:
                    return jsonify({
                        'error': 'E-mail já cadastrado e em uso',
                        'field': 'email',
                        'message': f'O e-mail "{data["email"]}" já está cadastrado no sistema. Por favor, escolha um e-mail diferente.'
                    }), 400
            # Se o usuário existe mas está inativo, podemos reutilizar
            # Mas primeiro vamos deletar o usuário antigo para evitar conflitos
            logger.info("Usuário inativo encontrado, removendo para permitir recriação")
            db.session.delete(existing_user)
            db.session.flush()  # Aplicar a deleção antes de criar o novo
        
        # Criar planta
        logger.info("Criando nova planta")
        plant = Plant(
            name=data['name'],
            code=data['code'],
            cnpj=cnpj,  # Usar a variável já validada
            email=data['email'],
            phone=data.get('phone'),
            cep=data.get('cep'),
            street=data.get('street'),
            number=data.get('number'),
            neighborhood=data.get('neighborhood'),
            reference=data.get('reference'),
            is_active=data.get('is_active', True)  # Padrão: ativa
        )
        db.session.add(plant)
        db.session.flush()  # Para obter o ID da planta
        logger.info(f"Planta criada com ID {plant.id}")
        
        # Gerar senha temporária
        temp_password = generate_temp_password()
        
        # Criar usuário para a planta
        user = User(
            email=data['email'],
            role='plant',
            plant_id=plant.id
        )
        user.set_password(temp_password)
        db.session.add(user)
        
        db.session.commit()
        
        # Log para verificar o que está sendo retornado
        plant_dict = plant.to_dict()
        logger.info(f"Planta criada e retornada com sucesso - ID: {plant.id}")
        
        return jsonify({
            'message': 'Planta criada com sucesso',
            'plant': plant_dict,
            'user': user.to_dict(),
            'temp_password': temp_password
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao criar planta: {str(e)}", exc_info=True)
        # Verificar se é erro de integridade (duplicata) - fallback caso as validações anteriores não tenham capturado
        if 'UNIQUE constraint' in str(e) or 'IntegrityError' in str(type(e).__name__):
            if 'name' in str(e).lower():
                return jsonify({
                    'error': 'Já existe uma planta cadastrada com este nome',
                    'field': 'name',
                    'message': 'Este nome já está em uso por outra planta. Por favor, escolha um nome diferente.'
                }), 400
            elif 'code' in str(e).lower():
                return jsonify({
                    'error': 'Já existe uma planta cadastrada com este código',
                    'field': 'code',
                    'message': 'Este código já está em uso por outra planta. Por favor, escolha um código diferente.'
                }), 400
            elif 'cnpj' in str(e).lower():
                return jsonify({
                    'error': 'CNPJ já cadastrado',
                    'field': 'cnpj',
                    'message': 'Este CNPJ já está cadastrado no sistema. Por favor, verifique o CNPJ informado.'
                }), 400
            elif 'email' in str(e).lower():
                return jsonify({
                    'error': 'E-mail já cadastrado',
                    'field': 'email',
                    'message': 'Este e-mail já está cadastrado no sistema. Por favor, escolha um e-mail diferente.'
                }), 400
        return jsonify({'error': f'Erro ao criar planta: {str(e)}'}), 500

@admin_bp.route('/plants/<int:plant_id>', methods=['PUT'])
@admin_required
def update_plant(current_user, plant_id):
    """Atualiza uma planta existente"""
    try:
        from src.models.plant import Plant
        
        plant = Plant.query.get(plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        data = request.get_json()
        
        if 'name' in data and data['name']:
            # Verificar se outro nome já existe
            existing = Plant.query.filter_by(name=data['name']).filter(Plant.id != plant_id).first()
            if existing:
                return jsonify({'error': 'Já existe uma planta com este nome'}), 400
            plant.name = data['name']
        
        if 'code' in data and data['code']:
            # Verificar se outro código já existe
            existing_code = Plant.query.filter_by(code=data['code']).filter(Plant.id != plant_id).first()
            if existing_code:
                return jsonify({'error': 'Já existe uma planta com este código'}), 400
            plant.code = data['code']
        
        if 'email' in data:
            plant.email = data['email']
        
        if 'cnpj' in data:
            if not data['cnpj']:
                return jsonify({'error': 'CNPJ é obrigatório'}), 400
            plant.cnpj = data['cnpj']
        
        if 'phone' in data:
            plant.phone = data['phone']
        
        if 'cep' in data:
            plant.cep = data['cep']
        
        if 'street' in data:
            plant.street = data['street']
        
        if 'number' in data:
            plant.number = data['number']
        
        if 'neighborhood' in data:
            plant.neighborhood = data['neighborhood']
        
        if 'reference' in data:
            plant.reference = data['reference']
        
        if 'is_active' in data:
            plant.is_active = data['is_active']
            # Desativar usuários da planta se a planta for desativada
            if not data['is_active']:
                User.query.filter_by(plant_id=plant_id).update({'is_active': False})
        
        plant.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Planta atualizada com sucesso',
            'plant': plant.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants/<int:plant_id>', methods=['DELETE'])
@admin_required
def delete_plant(current_user, plant_id):
    """Deleta uma planta"""
    try:
        from src.models.plant import Plant
        
        plant = Plant.query.get(plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        db.session.delete(plant)
        db.session.commit()
        
        return jsonify({'message': 'Planta deletada com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/operating-hours', methods=['GET'])
@admin_required
def get_operating_hours(current_user):
    """Retorna horários de funcionamento configurados"""
    try:
        from src.models.operating_hours import OperatingHours
        
        # Obter plant_id da query string (opcional)
        plant_id = request.args.get('plant_id', type=int)
        
        # Filtrar por plant_id se fornecido, senão buscar configurações globais (plant_id=None)
        query = OperatingHours.query.filter_by(is_active=True)
        if plant_id is not None:
            query = query.filter_by(plant_id=plant_id)
        else:
            query = query.filter_by(plant_id=None)  # Configurações globais
        
        configs = query.all()
        
        # Organizar por tipo
        result = {
            'weekdays': {'enabled': False, 'operating_start': None, 'operating_end': None},
            'weekend': {'enabled': False, 'days': [], 'operating_start': None, 'operating_end': None},
            'holiday': {'enabled': False, 'operating_start': None, 'operating_end': None}
        }
        
        for config in configs:
            if config.schedule_type == 'weekdays':
                result['weekdays'] = {
                    'enabled': True,
                    'operating_start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'operating_end': config.operating_end.strftime('%H:%M') if config.operating_end else None
                }
            elif config.schedule_type == 'weekend':
                result['weekend']['enabled'] = True
                if config.day_of_week is not None:
                    day_key = 'SATURDAY' if config.day_of_week == 5 else 'SUNDAY'
                    if day_key not in result['weekend']['days']:
                        result['weekend']['days'].append(day_key)
                if config.operating_start:
                    result['weekend']['operating_start'] = config.operating_start.strftime('%H:%M')
                if config.operating_end:
                    result['weekend']['operating_end'] = config.operating_end.strftime('%H:%M')
            elif config.schedule_type == 'holiday':
                result['holiday'] = {
                    'enabled': True,
                    'operating_start': config.operating_start.strftime('%H:%M') if config.operating_start else None,
                    'operating_end': config.operating_end.strftime('%H:%M') if config.operating_end else None
                }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/operating-hours', methods=['POST'])
@admin_required
def save_operating_hours(current_user):
    """Salva horários de funcionamento"""
    try:
        from src.models.operating_hours import OperatingHours
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"=== SALVANDO HORÁRIOS DE FUNCIONAMENTO ===")
        logger.info(f"Dados recebidos: {data}")
        
        # Obter plant_id do body (opcional)
        plant_id = data.get('plant_id', None)
        if plant_id is not None:
            plant_id = int(plant_id)
            logger.info(f"Salvando configurações para planta ID: {plant_id}")
        else:
            logger.info("Salvando configurações globais (plant_id=None)")
        
        # Desativar todas as configurações existentes da mesma planta (ou globais)
        query = OperatingHours.query
        if plant_id is not None:
            query = query.filter_by(plant_id=plant_id)
        else:
            query = query.filter_by(plant_id=None)
        
        existing_configs = query.all()
        logger.info(f"Desativando {len(existing_configs)} configurações existentes")
        for config in existing_configs:
            config.is_active = False
        
        # Salvar Dias Úteis
        if data.get('weekdays', {}).get('enabled'):
            weekdays = data['weekdays']
            operating_start = weekdays.get('operating_start')
            operating_end = weekdays.get('operating_end')
            
            logger.info(f"Dias úteis habilitados - Start: {operating_start}, End: {operating_end}")
            
            # Se não houver horários, não salvar (será considerado 24h)
            # Verificar se são strings não vazias
            if operating_start and operating_end and operating_start.strip() and operating_end.strip():
                try:
                    start_time = datetime.strptime(operating_start, '%H:%M').time()
                    end_time = datetime.strptime(operating_end, '%H:%M').time()
                    
                    # Verificar se já existe
                    existing = OperatingHours.query.filter_by(
                        plant_id=plant_id,
                        schedule_type='weekdays',
                        day_of_week=None
                    ).first()
                    
                    if existing:
                        existing.operating_start = start_time
                        existing.operating_end = end_time
                        existing.is_active = True
                    else:
                        new_config = OperatingHours(
                            plant_id=plant_id,
                            schedule_type='weekdays',
                            day_of_week=None,
                            operating_start=start_time,
                            operating_end=end_time,
                            is_active=True
                        )
                        db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para dias úteis'}), 400
        
        # Salvar Finais de Semana
        if data.get('weekend', {}).get('enabled'):
            weekend = data['weekend']
            days = weekend.get('days', [])
            operating_start = weekend.get('operating_start')
            operating_end = weekend.get('operating_end')
            
            if operating_start and operating_end:
                try:
                    start_time = datetime.strptime(operating_start, '%H:%M').time()
                    end_time = datetime.strptime(operating_end, '%H:%M').time()
                    
                    # Mapear dias
                    day_map = {'SATURDAY': 5, 'SUNDAY': 6}
                    
                    for day_name in days:
                        day_of_week = day_map.get(day_name)
                        if day_of_week is not None:
                            existing = OperatingHours.query.filter_by(
                                plant_id=plant_id,
                                schedule_type='weekend',
                                day_of_week=day_of_week
                            ).first()
                            
                            if existing:
                                existing.operating_start = start_time
                                existing.operating_end = end_time
                                existing.is_active = True
                            else:
                                new_config = OperatingHours(
                                    plant_id=plant_id,
                                    schedule_type='weekend',
                                    day_of_week=day_of_week,
                                    operating_start=start_time,
                                    operating_end=end_time,
                                    is_active=True
                                )
                                db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para finais de semana'}), 400
        
        # Salvar Feriados
        if data.get('holiday', {}).get('enabled'):
            holiday = data['holiday']
            operating_start = holiday.get('operating_start')
            operating_end = holiday.get('operating_end')
            
            if operating_start and operating_end and operating_start.strip() and operating_end.strip():
                try:
                    start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                    end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                    
                    existing = OperatingHours.query.filter_by(
                        plant_id=plant_id,
                        schedule_type='holiday',
                        day_of_week=None
                    ).first()
                    
                    if existing:
                        existing.operating_start = start_time
                        existing.operating_end = end_time
                        existing.is_active = True
                    else:
                        new_config = OperatingHours(
                            plant_id=plant_id,
                            schedule_type='holiday',
                            day_of_week=None,
                            operating_start=start_time,
                            operating_end=end_time,
                            is_active=True
                        )
                        db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para feriados'}), 400
        
        db.session.commit()
        return jsonify({'message': 'Horários de funcionamento salvos com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ==================== ROTAS DE USUÁRIOS ====================

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users(current_user):
    """Lista todos os usuários do sistema"""
    try:
        users = User.query.all()
        result = []
        
        for user in users:
            user_dict = user.to_dict()
            
            # Adicionar informações do fornecedor associado (se houver)
            if user.supplier_id:
                supplier = Supplier.query.get(user.supplier_id)
                if supplier:
                    user_dict['supplier'] = {
                        'id': supplier.id,
                        'description': supplier.description,
                        'cnpj': supplier.cnpj
                    }
            
            # Adicionar informações da planta associada (se houver)
            if user.plant_id:
                plant = Plant.query.get(user.plant_id)
                if plant:
                    user_dict['plant'] = {
                        'id': plant.id,
                        'name': plant.name,
                        'code': plant.code
                    }
            
            result.append(user_dict)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar usuários: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user(current_user):
    """Cria um novo usuário"""
    try:
        data = request.get_json()
        
        if not data or not all(k in data for k in ['email', 'role']):
            return jsonify({'error': 'Email e role são obrigatórios'}), 400
        
        # Validar role
        valid_roles = ['admin', 'supplier', 'plant']
        if data['role'] not in valid_roles:
            return jsonify({'error': f'Role inválido. Deve ser um de: {", ".join(valid_roles)}'}), 400
        
        # Verificar se email já existe
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            return jsonify({'error': 'Email já cadastrado'}), 400
        
        # Validar associações baseadas no role
        if data['role'] == 'supplier':
            if not data.get('supplier_id'):
                return jsonify({'error': 'supplier_id é obrigatório para usuários do tipo fornecedor'}), 400
            supplier = Supplier.query.get(data['supplier_id'])
            if not supplier:
                return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        if data['role'] == 'plant':
            if not data.get('plant_id'):
                return jsonify({'error': 'plant_id é obrigatório para usuários do tipo planta'}), 400
            plant = Plant.query.get(data['plant_id'])
            if not plant:
                return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Gerar senha temporária se não fornecida
        password = data.get('password') or generate_temp_password()
        
        # Criar usuário
        user = User(
            email=data['email'],
            role=data['role'],
            supplier_id=data.get('supplier_id'),
            plant_id=data.get('plant_id'),
            is_active=data.get('is_active', True)
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Usuário criado com sucesso',
            'user': user.to_dict(),
            'temp_password': password if not data.get('password') else None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao criar usuário: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(current_user, user_id):
    """Atualiza um usuário"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json()
        
        # Atualizar email (se fornecido e diferente)
        if 'email' in data and data['email'] != user.email:
            existing_user = User.query.filter_by(email=data['email']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email já cadastrado'}), 400
            user.email = data['email']
        
        # Atualizar role (se fornecido)
        if 'role' in data:
            valid_roles = ['admin', 'supplier', 'plant']
            if data['role'] not in valid_roles:
                return jsonify({'error': f'Role inválido. Deve ser um de: {", ".join(valid_roles)}'}), 400
            user.role = data['role']
        
        # Atualizar status (se fornecido)
        if 'is_active' in data:
            user.is_active = data['is_active']
        
        # Atualizar associações (se fornecido)
        if 'supplier_id' in data:
            user.supplier_id = data['supplier_id']
        if 'plant_id' in data:
            user.plant_id = data['plant_id']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Usuário atualizado com sucesso',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao atualizar usuário: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(current_user, user_id):
    """Deleta permanentemente um usuário"""
    try:
        logger.info(f"Tentando excluir usuário ID: {user_id}")
        user = User.query.get(user_id)
        if not user:
            logger.warning(f"Usuário ID {user_id} não encontrado")
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Não permitir deletar o próprio usuário
        if user.id == current_user.id:
            logger.warning("Tentativa de excluir próprio usuário")
            return jsonify({'error': 'Você não pode deletar seu próprio usuário'}), 400
        
        # Verificar se há agendamentos vinculados ao fornecedor do usuário
        # (agendamentos são vinculados ao supplier, não diretamente ao user)
        from src.models.appointment import Appointment
        appointments_count = 0
        if user.supplier_id:
            appointments_count = Appointment.query.filter_by(supplier_id=user.supplier_id).count()
            logger.info(f"Usuário tem {appointments_count} agendamentos vinculados ao fornecedor")
        
        if appointments_count > 0:
            logger.warning(f"Não é possível excluir usuário com {appointments_count} agendamentos")
            return jsonify({
                'error': f'Não é possível excluir usuário vinculado a um fornecedor com {appointments_count} agendamento(s). Desative o usuário ao invés de excluí-lo.'
            }), 400
        
        # Hard delete: remover permanentemente do banco
        # Guardar ID para log (não expor email)
        user_id_to_delete = user.id
        
        logger.info(f"Executando exclusão permanente do usuário {user_email} (ID: {user_id_to_delete})")
        
        try:
            # Remover o usuário da sessão
            db.session.delete(user)
            
            # Fazer flush para garantir que a operação seja executada
            db.session.flush()
            
            # Commit da transação
            db.session.commit()
            
            logger.info(f"Commit realizado com sucesso para usuário {user_email} (ID: {user_id_to_delete})")
            
        except Exception as commit_error:
            db.session.rollback()
            logger.error(f"Erro ao fazer commit da exclusão: {str(commit_error)}", exc_info=True)
            raise commit_error
        
        logger.info(f"Usuário ID {user_id_to_delete} excluído permanentemente com sucesso")
        
        return jsonify({'message': 'Usuário excluído permanentemente com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        error_msg = str(e)
        logger.error(f"Erro ao deletar usuário ID {user_id}: {error_msg}", exc_info=True)
        return jsonify({'error': f'Erro ao excluir usuário: {error_msg}'}), 500

@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(current_user, user_id):
    """Redefine a senha de um usuário"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        data = request.get_json()
        new_password = data.get('password') or generate_temp_password()
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({
            'message': 'Senha redefinida com sucesso',
            'temp_password': new_password if not data.get('password') else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao redefinir senha: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# ==================== ROTAS DE PERMISSÕES ====================

@admin_bp.route('/permissions', methods=['GET'])
@admin_required
def get_permissions(current_user):
    """Retorna todas as permissões configuradas"""
    try:
        from src.models.permission import Permission
        
        permissions = Permission.get_all_permissions()
        return jsonify(permissions), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar permissões: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/permissions/my-permissions', methods=['GET'])
def get_my_permissions():
    """Retorna as permissões do usuário atual baseadas no seu role"""
    try:
        import jwt
        from src.models.permission import Permission
        from src.routes.auth import SECRET_KEY as AUTH_SECRET_KEY
        
        # Verificar token manualmente
        token = request.headers.get('Authorization')
        if not token or not token.startswith('Bearer '):
            return jsonify({'error': 'Token não fornecido'}), 401
        
        token = token.split(' ')[1]
        try:
            decoded = jwt.decode(token, AUTH_SECRET_KEY, algorithms=['HS256'])
            user_id = decoded.get('user_id')
            current_user = User.query.get(user_id)
            if not current_user or not current_user.is_active:
                return jsonify({'error': 'Usuário inválido ou inativo'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        
        # Obter todas as permissões
        all_permissions = Permission.get_all_permissions()
        
        # Filtrar apenas as permissões relevantes para o role do usuário
        user_role = current_user.role
        if user_role == 'admin':
            # Admin tem acesso a todas as permissões
            return jsonify(all_permissions), 200
        
        # Para não-admin, retornar todas as permissões mas apenas com o role do usuário
        # Isso mantém a estrutura esperada pelo frontend: { function_id: { role: permission_type } }
        filtered_permissions = {}
        logger.info(f"Total de permissões no banco: {len(all_permissions)}")
        logger.info(f"Buscando permissões para role: {user_role}")
        
        for function_id, roles in all_permissions.items():
            if user_role in roles:
                filtered_permissions[function_id] = {
                    user_role: roles[user_role]
                }
            # Se não há permissão configurada, não incluir (frontend usará padrão)
        
        logger.info(f"Permissões filtradas para role {user_role}: Total de funções: {len(filtered_permissions)}")
        if len(filtered_permissions) < 29:
            logger.warning(f"⚠️ ATENÇÃO: Apenas {len(filtered_permissions)} permissões encontradas! Esperado: 29")
            logger.warning(f"Todas as permissões filtradas: {filtered_permissions}")
            logger.warning(f"Chaves das permissões filtradas: {list(filtered_permissions.keys())}")
            # Verificar quais permissões estão faltando
            expected_functions = [
                'create_appointment', 'view_appointments', 'edit_appointment', 'delete_appointment',
                'check_in', 'check_out', 'reschedule', 'create_supplier', 'view_suppliers',
                'edit_supplier', 'inactivate_supplier', 'delete_supplier', 'create_plant',
                'view_plants', 'edit_plant', 'inactivate_plant', 'delete_plant',
                'configure_plant_hours', 'configure_default_hours', 'configure_weekly_block',
                'configure_date_block', 'view_available_hours', 'configure_max_capacity',
                'view_statistics', 'manage_users', 'view_profile', 'edit_profile',
                'change_password', 'configure_notifications'
            ]
            missing = [f for f in expected_functions if f not in filtered_permissions]
            if missing:
                logger.warning(f"Permissões faltando: {missing}")
        else:
            logger.info(f"Primeiras 5 permissões: {dict(list(filtered_permissions.items())[:5])}")
        
        # Log detalhado antes de retornar
        logger.info(f"🔍 Retornando {len(filtered_permissions)} permissões para role {user_role}")
        logger.info(f"Chaves das permissões: {list(filtered_permissions.keys())}")
        
        # Criar resposta JSON
        response_data = filtered_permissions
        response = jsonify(response_data)
        
        # Log do tamanho da resposta
        import json as json_module
        response_str = json_module.dumps(response_data)
        logger.info(f"Tamanho da resposta JSON: {len(response_str)} bytes")
        logger.info(f"Primeiros 500 caracteres da resposta: {response_str[:500]}")
        
        return response, 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar permissões do usuário: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/permissions', methods=['POST'])
@admin_required
def save_permissions(current_user):
    """Salva as permissões configuradas
    Body: { function_id: { role: permission_type } }
    """
    try:
        from src.models.permission import Permission
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Validar estrutura
        for function_id, roles in data.items():
            if not isinstance(roles, dict):
                return jsonify({'error': f'Estrutura inválida para função {function_id}'}), 400
            
            for role, permission_type in roles.items():
                if role not in ['admin', 'supplier', 'plant']:
                    return jsonify({'error': f'Role inválido: {role}'}), 400
                
                if permission_type not in ['editor', 'viewer', 'none']:
                    return jsonify({'error': f'Tipo de permissão inválido: {permission_type}'}), 400
        
        # Salvar permissões
        Permission.bulk_update_permissions(data)
        
        return jsonify({
            'message': 'Permissões salvas com sucesso',
            'permissions': Permission.get_all_permissions()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar permissões: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/permissions/check', methods=['POST'])
@admin_required
def check_permission(current_user):
    """Verifica se um role tem permissão para uma funcionalidade"""
    try:
        from src.models.permission import Permission
        
        data = request.get_json()
        
        if not data or 'role' not in data or 'function_id' not in data:
            return jsonify({'error': 'role e function_id são obrigatórios'}), 400
        
        permission_type = Permission.get_permission(data['role'], data['function_id'])
        
        return jsonify({
            'role': data['role'],
            'function_id': data['function_id'],
            'permission_type': permission_type,
            'has_access': permission_type != 'none'
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao verificar permissão: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
