from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, time
from sqlalchemy import func, or_, and_
from sqlalchemy.exc import IntegrityError
from src.models.user import User, db
from src.models.supplier import Supplier
from src.models.appointment import Appointment
from src.models.plant import Plant
from src.routes.auth import admin_required
from src.utils.helpers import generate_temp_password, generate_appointment_number
from src.utils.permissions import permission_required
import logging

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__)

def user_belongs_to_admin_domain(user, admin_user):
    """
    Verifica se um usuário pertence ao domínio do admin atual.
    
    Regras (Multi-tenant):
    - Usuários devem pertencer à mesma company do admin
    - Admins: apenas o próprio usuário OU usuários admin da mesma company
    - Fornecedores: usuários associados a fornecedores da mesma company
    - Plantas: usuários associados a plantas da mesma company
    
    Args:
        user: Usuário a ser verificado
        admin_user: Admin atual logado
    
    Returns:
        bool: True se o usuário pertence ao domínio do admin
    """
    # Multi-tenant: verificar se pertence à mesma company
    if user.company_id != admin_user.company_id:
        return False
    
    # Admins: apenas o próprio usuário OU usuários admin da mesma company
    if user.role == 'admin':
        # O próprio usuário sempre pertence ao seu domínio
        if user.id == admin_user.id:
            return True
        # Ou se foi criado por este admin (e já validamos que é da mesma company)
        if user.created_by_admin_id == admin_user.id:
            return True
        return False
    
    # Fornecedores: verificar se o fornecedor pertence à mesma company
    if user.role == 'supplier' and user.supplier_id:
        supplier = Supplier.query.get(user.supplier_id)
        if supplier and supplier.company_id == admin_user.company_id:
            return True
    
    # Plantas: verificar se a planta pertence à mesma company
    if user.role == 'plant' and user.plant_id:
        plant = Plant.query.get(user.plant_id)
        if plant and plant.company_id == admin_user.company_id:
            return True
    
    return False

def get_time_slots_in_range(start_time, end_time):
    """Gera lista de slots de 1 hora dentro de um intervalo"""
    slots = []
    current = datetime.combine(datetime.today().date(), start_time)
    end = datetime.combine(datetime.today().date(), end_time)
    
    while current < end:
        slots.append(current.time())
        current += timedelta(hours=1)
    
    return slots

def validate_time_range_capacity(date, start_time, end_time, max_capacity, plant_id=None, company_id=None, exclude_appointment_id=None):
    """
    Valida se todos os slots de 1 hora dentro do intervalo respeitam a capacidade máxima.
    Retorna (is_valid, conflicting_slot) onde:
    - is_valid: True se todos os slots estão disponíveis
    - conflicting_slot: horário que está indisponível (None se todos estão disponíveis)
    - plant_id: ID da planta para filtrar agendamentos (obrigatório)
    - company_id: ID da company para isolamento multi-tenant (obrigatório)
    """
    from sqlalchemy import or_, and_
    
    if plant_id is None:
        raise ValueError("plant_id é obrigatório para validação de capacidade")
    
    if company_id is None:
        raise ValueError("company_id é obrigatório para validação de capacidade (multi-tenant)")
    
    slots = get_time_slots_in_range(start_time, end_time)
    
    for slot in slots:
        # Contar agendamentos que ocupam este slot para a planta específica
        # Um agendamento ocupa um slot se:
        # 1. É um agendamento antigo (sem time_end) e time == slot
        # 2. É um agendamento com intervalo e o slot está dentro do intervalo
        
        query = Appointment.query.filter(
            Appointment.date == date,
            Appointment.plant_id == plant_id,
            Appointment.company_id == company_id
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
@permission_required('view_suppliers', 'viewer')
def get_suppliers(current_user):
    """Lista todos os fornecedores ativos criados pelo admin logado"""
    try:
        # Filtrar apenas fornecedores da mesma company do admin atual
        from sqlalchemy import and_
        
        # Log para debug: verificar todos os fornecedores da company
        all_suppliers_in_company = Supplier.query.filter(
            Supplier.company_id == current_user.company_id
        ).all()
        logger.info(f"[get_suppliers] Total de fornecedores na company {current_user.company_id}: {len(all_suppliers_in_company)}")
        for s in all_suppliers_in_company:
            logger.debug(f"[get_suppliers] Fornecedor {s.id} ({s.description}) - is_deleted: {s.is_deleted}, is_active: {s.is_active}, company_id: {s.company_id}")
        
        suppliers = Supplier.query.filter(
            and_(
                Supplier.is_deleted == False,
                Supplier.company_id == current_user.company_id
            )
        ).all()
        
        logger.info(f"[get_suppliers] Admin {current_user.id} (role: {current_user.role}) - Retornando {len(suppliers)} fornecedores (filtrados)")
        for supplier in suppliers:
            logger.debug(f"[get_suppliers] Fornecedor {supplier.id} ({supplier.description}) - created_by_admin_id: {supplier.created_by_admin_id}")
        
        return jsonify([supplier.to_dict() for supplier in suppliers]), 200
    except Exception as e:
        logger.error(f"[get_suppliers] Erro ao buscar fornecedores: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/suppliers', methods=['POST'])
@permission_required('create_supplier', 'editor')
def create_supplier(current_user):
    """Cria um novo fornecedor e seu usuário de acesso"""
    try:
        data = request.get_json()
        
        if not data or not all(k in data for k in ['cnpj', 'description', 'email']):
            return jsonify({'error': 'CNPJ, descrição e email são obrigatórios'}), 400
        
        # Verificar se CNPJ já existe na mesma company
        existing_supplier = Supplier.query.filter_by(
            cnpj=data['cnpj'],
            company_id=current_user.company_id
        ).first()
        if existing_supplier:
            return jsonify({'error': 'CNPJ já cadastrado nesta empresa'}), 400
        
        # Verificar se nome (description) já existe na mesma company
        existing_supplier_by_name = Supplier.query.filter_by(
            description=data['description'].strip(),
            company_id=current_user.company_id,
            is_deleted=False
        ).first()
        if existing_supplier_by_name:
            return jsonify({'error': 'Já existe um fornecedor com este nome nesta empresa'}), 400
        
        # Verificar se email já existe na mesma company
        existing_user = User.query.filter_by(
            email=data['email'],
            company_id=current_user.company_id
        ).first()
        if existing_user:
            return jsonify({'error': 'Email já cadastrado nesta empresa'}), 400
        
        # Criar fornecedor associado à mesma company do admin
        supplier = Supplier(
            cnpj=data['cnpj'],
            description=data['description'],
            company_id=current_user.company_id,
            created_by_admin_id=current_user.id
        )
        db.session.add(supplier)
        db.session.flush()  # Para obter o ID do supplier
        
        # Log para debug (sem dados sensíveis)
        logger.info(f"[create_supplier] Fornecedor criado - ID: {supplier.id}, Company ID: {supplier.company_id}, is_active: {supplier.is_active}")
        
        # Gerar senha temporária
        temp_password = generate_temp_password()
        
        # Criar usuário para o fornecedor
        user = User(
            email=data['email'],
            role='supplier',
            company_id=current_user.company_id,
            supplier_id=supplier.id
        )
        user.set_password(temp_password)
        db.session.add(user)
        
        db.session.commit()
        
        # Log após commit para verificar se os valores foram salvos corretamente
        logger.info(f"[create_supplier] Fornecedor salvo após commit - ID: {supplier.id}, is_deleted: {supplier.is_deleted}, is_active: {supplier.is_active}, company_id: {supplier.company_id}")
        
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
                    
                    # Base: agendamentos da mesma company do admin atual
                    query = Appointment.query.filter(
                        Appointment.date == target_date,
                        Appointment.company_id == current_user.company_id
                    )
                    
                    # Filtrar por planta se fornecido
                    if plant_id is not None:
                        # Verificar se a planta pertence à mesma company
                        plant = Plant.query.filter_by(
                            id=plant_id,
                            company_id=current_user.company_id
                        ).first()
                        if plant:
                            # Incluir apenas agendamentos desta planta
                            query = query.filter(Appointment.plant_id == plant_id)
                        else:
                            # Planta não pertence a esta company, retornar vazio
                            query = query.filter(Appointment.plant_id == -1)  # Filtro impossível
                        logger.info(f"Filtrado por planta: {plant_id} (company {current_user.company_id})")
                    else:
                        # Já está filtrado por company_id, não precisa de join adicional
                        logger.info("Nenhum filtro de planta aplicado - retornando agendamentos da company")
                    
                    appointments = query.order_by(Appointment.date, Appointment.time).all()
                    
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
                                'appointment_number': appointment.appointment_number,
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
            
            # Filtrar apenas agendamentos da mesma company do admin atual
            appointments = Appointment.query.filter(
                Appointment.date >= start_date,
                Appointment.date <= end_date,
                Appointment.company_id == current_user.company_id
            ).order_by(Appointment.date, Appointment.time).all()
            
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
                        'appointment_number': appointment.appointment_number,
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
            
            # Verificar se o fornecedor existe e pertence à mesma company
            supplier = Supplier.query.filter_by(
                id=data['supplier_id'],
                company_id=current_user.company_id
            ).first()
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
            
            # Verificar se a planta existe e pertence à mesma company
            plant = Plant.query.filter_by(
                id=plant_id,
                company_id=current_user.company_id
            ).first()
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
                    plant_id,
                    current_user.company_id
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
                    }), 409
            
            # Gerar número único do agendamento
            appointment_number = generate_appointment_number(appointment_date)
            
            # Criar agendamento
            appointment = Appointment(
                appointment_number=appointment_number,
                date=appointment_date,
                time=appointment_time,
                time_end=appointment_time_end,
                purchase_order=data['purchase_order'].strip(),
                truck_plate=data['truck_plate'].strip().upper(),
                driver_name=data['driver_name'].strip(),
                company_id=current_user.company_id,
                supplier_id=data['supplier_id'],
                plant_id=data.get('plant_id'),  # Opcional para admin
                status='scheduled'
            )
            
            db.session.add(appointment)
            db.session.commit()
            
            appointment_dict = appointment.to_dict()
            
            return jsonify({
                'message': 'Agendamento criado com sucesso',
                'appointment': appointment_dict
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
        
        # Verificar se o agendamento pertence ao domínio do admin
        # Verificar se o agendamento pertence à mesma company
        if appointment.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Este agendamento não pertence ao seu domínio'}), 403
        
        # Permitir check-in apenas para agendamentos agendados ou reagendados
        if appointment.status not in ['scheduled', 'rescheduled']:
            error_msg = f'Agendamento não pode receber check-in. Status atual: {appointment.status}'
            return jsonify({'error': error_msg}), 400
        
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
        
        # Verificar se o agendamento pertence ao domínio do admin
        # Verificar se o agendamento pertence à mesma company
        if appointment.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Este agendamento não pertence ao seu domínio'}), 403
        
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
        
        # Verificar se o agendamento pertence ao domínio do admin
        # Verificar se o agendamento pertence à mesma company
        if appointment.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Este agendamento não pertence ao seu domínio'}), 403
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        
        # Armazenar valores originais para validação
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
                # Aceitar tanto HH:MM quanto HH:MM:SS
                time_str = data['time']
                if len(time_str) == 5:  # HH:MM
                    new_time = datetime.strptime(time_str, '%H:%M').time()
                elif len(time_str) == 8:  # HH:MM:SS
                    new_time = datetime.strptime(time_str, '%H:%M:%S').time()
                else:
                    raise ValueError("Formato inválido")
                
                if new_time != original_time:
                    time_changed = True
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
                
                if new_time_end != original_time_end:
                    time_changed = True
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
        
        # Se houve reagendamento (mudança detectada OU motivo enviado), exigir motivo e aplicar status
        if is_rescheduling:
            motivo = data.get('motivo_reagendamento', '').strip() if 'motivo_reagendamento' in data else ''
            
            if not motivo:
                return jsonify({
                    'error': 'Motivo do reagendamento é obrigatório quando há alteração de data ou horário',
                    'requires_reschedule_reason': True
                }), 400
            
            # Aplicar status rescheduled e salvar motivo ANTES de qualquer outra atualização
            appointment.status = 'rescheduled'
            appointment.motivo_reagendamento = motivo
        
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
                company_id=current_user.company_id,
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
            # Verificar se o fornecedor existe, foi criado por este admin e está ativo
            supplier = Supplier.query.get(data['supplier_id'])
            if not supplier:
                return jsonify({'error': 'Fornecedor não encontrado'}), 404
            if supplier.company_id != current_user.company_id:
                return jsonify({'error': 'Acesso negado. Este fornecedor não pertence ao seu domínio'}), 403
            if not supplier.is_active:
                return jsonify({'error': 'Fornecedor inativo'}), 400
            appointment.supplier_id = data['supplier_id']
        
        appointment.updated_at = datetime.utcnow()
        
        # FORÇAR aplicação do status se é reagendamento
        if is_rescheduling:
            appointment.status = 'rescheduled'
            if 'motivo_reagendamento' in data and data.get('motivo_reagendamento', '').strip():
                appointment.motivo_reagendamento = data['motivo_reagendamento'].strip()
        
        db.session.commit()
        
        # Recarregar o objeto do banco para garantir que temos os dados atualizados
        db.session.refresh(appointment)
        
        # Criar dicionário de resposta FORÇANDO status e motivo corretos
        appointment_dict = appointment.to_dict()
        if is_rescheduling:
            appointment_dict['status'] = 'rescheduled'
            if 'motivo_reagendamento' in data and data.get('motivo_reagendamento', '').strip():
                appointment_dict['motivo_reagendamento'] = data['motivo_reagendamento'].strip()
        
        return jsonify({
            'message': 'Agendamento atualizado com sucesso',
            'appointment': appointment_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/suppliers/<int:supplier_id>', methods=['PUT'])
@permission_required('edit_supplier', 'viewer')
def update_supplier(current_user, supplier_id):
    """Atualiza dados de um fornecedor"""
    try:
        supplier = Supplier.query.get(supplier_id)

        if not supplier:
            return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        # Verificar se o fornecedor pertence à mesma company
        if supplier.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Este fornecedor não pertence ao seu domínio'}), 403
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Verificar se está tentando alterar o is_active (inativar/ativar)
        # Se está alterando o status, verificar permissão específica de inativar/ativar (igual ao update_plant)
        if 'is_active' in data:
            from src.utils.permissions import has_permission
            if not has_permission('inactivate_supplier', 'editor', current_user):
                return jsonify({
                    'error': 'Você não tem permissão para inativar/ativar fornecedores. Apenas usuários com perfil Editor podem realizar esta ação.',
                    'permission_required': 'inactivate_supplier',
                    'permission_level': 'editor'
                }), 403
        
        # Verificar se está tentando editar description
        # Apenas usuários com permissão 'editor' podem editar campos
        if 'description' in data:
            from src.utils.permissions import has_permission
            if not has_permission('edit_supplier', 'editor', current_user):
                return jsonify({
                    'error': 'Você não tem permissão para editar fornecedores. Apenas usuários com perfil Editor podem realizar esta ação.',
                    'permission_required': 'edit_supplier',
                    'permission_level': 'editor'
                }), 403
            
            # Verificar se o novo nome já existe em outro fornecedor na mesma company
            new_description = data['description'].strip()
            from sqlalchemy import and_
            existing_supplier_by_name = Supplier.query.filter(
                and_(
                    Supplier.description == new_description,
                    Supplier.company_id == current_user.company_id,
                    Supplier.id != supplier_id,
                    Supplier.is_deleted == False
                )
            ).first()
            if existing_supplier_by_name:
                return jsonify({'error': 'Já existe um fornecedor com este nome nesta empresa'}), 400
            
            supplier.description = new_description
        
        if 'is_active' in data:
            old_status = bool(supplier.is_active)  # Garantir que seja boolean
            new_status = bool(data['is_active'])  # Garantir que seja boolean
            supplier.is_active = new_status
            
            # Desativar usuários do fornecedor se o fornecedor for desativado
            # Reativar usuários quando o fornecedor for reativado
            # IMPORTANTE: Sempre atualizar usuários quando is_active mudar, independente do perfil do usuário
            if old_status != new_status:  # Apenas atualizar se o status realmente mudou
                logger.info(f"[update_supplier] Status do fornecedor {supplier_id} mudou de {old_status} para {new_status} (usuário: {current_user.id}, role: {current_user.role})")
                
                # Buscar usuários do fornecedor da mesma company para garantir isolamento multi-tenant
                # Usar filter() ao invés de filter_by() para múltiplas condições
                from sqlalchemy import and_
                users_query = User.query.filter(
                    and_(
                        User.supplier_id == supplier_id,
                        User.company_id == current_user.company_id
                    )
                )
                
                # Contar quantos usuários serão afetados antes de atualizar
                users_count = users_query.count()
                logger.info(f"[update_supplier] Encontrados {users_count} usuário(s) vinculado(s) ao fornecedor {supplier_id} na company {current_user.company_id}")
                
                if not new_status:
                    # Inativar usuários quando o fornecedor for inativado
                    users_updated = users_query.update({'is_active': False}, synchronize_session=False)
                    logger.info(f"[update_supplier] Fornecedor {supplier_id} inativado por usuário {current_user.id} (role: {current_user.role}). {users_updated} usuário(s) inativado(s) de {users_count} encontrado(s)")
                else:
                    # Reativar usuários quando o fornecedor for reativado
                    users_updated = users_query.update({'is_active': True}, synchronize_session=False)
                    logger.info(f"[update_supplier] Fornecedor {supplier_id} reativado por usuário {current_user.id} (role: {current_user.role}). {users_updated} usuário(s) reativado(s) de {users_count} encontrado(s)")
                
                if users_updated == 0 and users_count > 0:
                    logger.warning(f"[update_supplier] ATENÇÃO: Nenhum usuário foi atualizado, mas {users_count} usuário(s) foram encontrado(s)!")
                elif users_updated == 0:
                    logger.info(f"[update_supplier] Nenhum usuário encontrado vinculado ao fornecedor {supplier_id}")
                
                # Forçar flush para garantir que a atualização seja aplicada antes do commit
                db.session.flush()
            else:
                logger.info(f"[update_supplier] Status do fornecedor {supplier_id} não mudou (mantido como {old_status})")
        
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
@permission_required('delete_supplier', 'editor')
def delete_supplier(current_user, supplier_id):
    """Soft delete de um fornecedor"""
    try:
        supplier = Supplier.query.get(supplier_id)

        if not supplier:
            return jsonify({'error': 'Fornecedor não encontrado'}), 404
        
        # Verificar se o fornecedor pertence à mesma company
        if supplier.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Este fornecedor não pertence ao seu domínio'}), 403
        
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
        
        # Buscar e excluir todos os usuários associados ao fornecedor
        users_to_delete = User.query.filter_by(supplier_id=supplier_id).all()
        for user in users_to_delete:
            db.session.delete(user)
        
        db.session.commit()
        
        return jsonify({'message': 'Fornecedor e usuários associados excluídos com sucesso'}), 200
        
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
        
        # Verificar se o agendamento pertence ao domínio do admin
        # Verificar se o agendamento pertence à mesma company
        if appointment.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Este agendamento não pertence ao seu domínio'}), 403
        
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
@permission_required('configure_plant_hours', 'viewer')
def get_schedule_config(current_user):
    """Retorna configurações de horários para uma data específica"""
    try:
        from src.models.schedule_config import ScheduleConfig
        
        date_str = request.args.get('date')
        plant_id_str = request.args.get('plant_id')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        if not plant_id_str:
            return jsonify({'error': 'Parâmetro plant_id é obrigatório'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            plant_id = int(plant_id_str)
        except ValueError:
            return jsonify({'error': 'Formato de data ou plant_id inválido'}), 400
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        configs = ScheduleConfig.query.filter_by(
            date=target_date,
            plant_id=plant_id
        ).all()
        
        return jsonify([config.to_dict() for config in configs]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/schedule-config', methods=['POST'])
@permission_required('configure_date_block', 'editor')
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
        
        # Obter plant_id (obrigatório quando configurando para uma planta específica)
        plant_id = data.get('plant_id')
        if plant_id is None:
            return jsonify({'error': 'plant_id é obrigatório'}), 400
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Verificar se já existe configuração para esta data/hora/planta
        existing_config = ScheduleConfig.query.filter_by(
            date=target_date,
            time=target_time,
            plant_id=plant_id
        ).first()
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Salvando configuração: plant_id={plant_id}, date={target_date}, time={target_time}, is_available={data['is_available']}")
        
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
                plant_id=plant_id,
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
@permission_required('configure_plant_hours', 'viewer')
def get_available_times(current_user):
    """Retorna horários disponíveis para uma data específica"""
    try:
        from src.models.schedule_config import ScheduleConfig
        from src.models.default_schedule import DefaultSchedule
        
        date_str = request.args.get('date')
        plant_id_str = request.args.get('plant_id')
        
        if not date_str:
            return jsonify({'error': 'Parâmetro date é obrigatório (formato: YYYY-MM-DD)'}), 400
        
        if not plant_id_str:
            return jsonify({'error': 'Parâmetro plant_id é obrigatório'}), 400
        
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            plant_id = int(plant_id_str)
        except ValueError:
            return jsonify({'error': 'Formato de data ou plant_id inválido'}), 400
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Horários de 00:00 até 23:00 (intervalos de 1 hora)
        default_times = []
        for hour in range(0, 24):
            default_times.append(f"{hour:02d}:00")
        
        # Multi-tenant: Buscar configurações específicas apenas para esta planta da mesma company
        # (a validação de que a planta pertence à company já foi feita acima nas linhas 1100-1106)
        # Buscar configurações específicas para esta data e planta
        configs = ScheduleConfig.query.filter_by(
            date=target_date,
            plant_id=plant_id
        ).all()
        config_dict = {}
        for config in configs:
            if config.time:
                config_dict[config.time.strftime('%H:%M')] = config
        
        # Buscar configurações padrão para esta planta
        # Converter weekday do Python (0=Segunda, 6=Domingo) para formato do DB (0=Domingo, 1=Segunda, ..., 6=Sábado)
        python_weekday = target_date.weekday()  # 0=Segunda, 6=Domingo
        if python_weekday == 6:  # Domingo
            day_of_week = 0
        else:
            day_of_week = python_weekday + 1  # 1=Segunda, ..., 6=Sábado
        
        # Multi-tenant: Buscar configurações padrão apenas para esta planta da mesma company
        # (a validação de que a planta pertence à company já foi feita acima nas linhas 1100-1106)
        # Como plant_id é obrigatório e já validado, as configurações estão isoladas por planta/company
        default_configs = DefaultSchedule.query.filter(
            and_(
                DefaultSchedule.plant_id == plant_id,
                or_(
                    DefaultSchedule.day_of_week == day_of_week,
                    DefaultSchedule.day_of_week.is_(None)
                )
            )
        ).all()
        default_config_dict = {}
        for config in default_configs:
            if config.time:
                default_config_dict[config.time.strftime('%H:%M')] = config
        
        # Buscar horários de funcionamento
        from src.models.operating_hours import OperatingHours
        operating_hours_config = None
        
        # Determinar tipo de dia (weekday, weekend, holiday)
        is_weekend = day_of_week == 0 or day_of_week == 6  # Domingo ou Sábado
        
        # Multi-tenant: sempre filtrar por company_id
        # Prioridade: configuração específica da planta > configuração global (plant_id=None)
        if is_weekend:
            # Buscar configuração de fim de semana para o dia específico
            # Primeiro tentar configuração específica da planta
            operating_hours_config = OperatingHours.query.filter_by(
                plant_id=plant_id,
                schedule_type='weekend',
                day_of_week=day_of_week,
                is_active=True,
                company_id=current_user.company_id
            ).first()
            
            # Se não encontrar, buscar configuração global
            if not operating_hours_config:
                operating_hours_config = OperatingHours.query.filter_by(
                    plant_id=None,
                    schedule_type='weekend',
                    day_of_week=day_of_week,
                    is_active=True,
                    company_id=current_user.company_id
                ).first()
        else:
            # Buscar configuração de dias úteis
            # Primeiro tentar configuração específica da planta
            operating_hours_config = OperatingHours.query.filter_by(
                plant_id=plant_id,
                schedule_type='weekdays',
                day_of_week=None,
                is_active=True,
                company_id=current_user.company_id
            ).first()
            
            # Se não encontrar, buscar configuração global
            if not operating_hours_config:
                operating_hours_config = OperatingHours.query.filter_by(
                    plant_id=None,
                    schedule_type='weekdays',
                    day_of_week=None,
                    is_active=True,
                    company_id=current_user.company_id
                ).first()
        
        # Buscar agendamentos existentes para esta data e planta
        existing_appointments = Appointment.query.filter_by(
            date=target_date,
            plant_id=plant_id,
            company_id=current_user.company_id
        ).all()
        occupied_times = set()
        for apt in existing_appointments:
            if apt.time:
                occupied_times.add(apt.time.strftime('%H:%M'))
        
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
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Erro em get_available_times: {str(e)}\n{error_trace}")
        return jsonify({'error': str(e), 'traceback': error_trace}), 500

@admin_bp.route('/default-schedule', methods=['GET'])
@permission_required('configure_plant_hours', 'viewer')
def get_default_schedule(current_user):
    """Retorna configurações padrão de horários"""
    try:
        from src.models.default_schedule import DefaultSchedule
        
        plant_id_str = request.args.get('plant_id')
        if not plant_id_str:
            return jsonify({'error': 'Parâmetro plant_id é obrigatório'}), 400
        
        try:
            plant_id = int(plant_id_str)
        except ValueError:
            return jsonify({'error': 'Formato de plant_id inválido'}), 400
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Buscar configurações apenas para esta planta
        configs = DefaultSchedule.query.filter_by(plant_id=plant_id).all()
        
        return jsonify([config.to_dict() for config in configs]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants/<int:plant_id>/default-schedule', methods=['GET'])
@permission_required('configure_plant_hours', 'viewer')
def get_default_schedule_by_plant(current_user, plant_id):
    """Retorna configurações padrão de horários para uma planta específica
    Rota alternativa que aceita plant_id no path ao invés de query parameter
    """
    try:
        from src.models.default_schedule import DefaultSchedule
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Buscar configurações apenas para esta planta
        configs = DefaultSchedule.query.filter_by(plant_id=plant_id).all()
        
        return jsonify([config.to_dict() for config in configs]), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/default-schedule', methods=['POST'])
@permission_required('configure_default_hours', 'editor')
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
        
        # Obter plant_id (obrigatório quando configurando para uma planta específica)
        plant_id = data.get('plant_id')
        if plant_id is None:
            return jsonify({'error': 'plant_id é obrigatório'}), 400
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Verificar se já existe configuração para este horário/dia/planta
        existing_config = DefaultSchedule.query.filter_by(
            day_of_week=day_of_week,
            time=target_time,
            plant_id=plant_id
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
                plant_id=plant_id,
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
@permission_required('configure_default_hours', 'editor')
def delete_default_schedule(current_user, config_id):
    """Remove configuração padrão de horário"""
    try:
        from src.models.default_schedule import DefaultSchedule
        
        config = DefaultSchedule.query.get(config_id)
        
        if not config:
            return jsonify({'error': 'Configuração não encontrada'}), 404
        
        # Validar se a configuração pertence a uma planta da mesma company
        if config.plant_id:
            plant = Plant.query.filter_by(
                id=config.plant_id,
                company_id=current_user.company_id
            ).first()
            if not plant:
                return jsonify({'error': 'Configuração não encontrada ou não pertence ao seu domínio'}), 404
        
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
@permission_required('edit_plant', 'editor')
def get_plant_max_capacity(current_user, plant_id):
    """Retorna a configuração de capacidade máxima por horário de uma planta
    Multi-tenant: retorna apenas se a planta pertencer à company do admin
    """
    try:
        from src.models.plant import Plant
        
        # Multi-tenant: verificar se a planta pertence à company do admin
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        
        if not plant:
            return jsonify({'error': 'Planta não encontrada ou não pertence ao seu domínio'}), 404
        
        return jsonify({
            'max_capacity': plant.max_capacity if plant.max_capacity else 1,
            'plant_id': plant.id,
            'plant_name': plant.name
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants/<int:plant_id>/max-capacity', methods=['POST', 'PUT'])
@permission_required('edit_plant', 'editor')
def set_plant_max_capacity(current_user, plant_id):
    """Define a configuração de capacidade máxima por horário de uma planta
    Multi-tenant: atualiza apenas se a planta pertencer à company do admin
    """
    try:
        from src.models.plant import Plant
        
        # Multi-tenant: verificar se a planta pertence à company do admin
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        
        if not plant:
            return jsonify({'error': 'Planta não encontrada ou não pertence ao seu domínio'}), 404
        
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
@permission_required('view_plants', 'viewer')
def get_plants(current_user):
    """Lista todas as plantas criadas pelo admin logado"""
    try:
        from src.models.plant import Plant
        from sqlalchemy import and_
        
        # Filtrar apenas plantas da mesma company do admin atual
        plants = Plant.query.filter(
            Plant.company_id == current_user.company_id
        ).order_by(Plant.name).all()
        
        logger.info(f"[get_plants] Admin {current_user.id} (role: {current_user.role}) - Retornando {len(plants)} plantas")
        for plant in plants:
            logger.debug(f"[get_plants] Planta {plant.id} ({plant.name}) - created_by_admin_id: {plant.created_by_admin_id}")
        
        result = []
        for plant in plants:
            # Verificar se o objeto plant tem o atributo cnpj
            try:
                cnpj_value = getattr(plant, 'cnpj', None)
            except Exception as e:
                logger.error(f"Erro ao acessar CNPJ da planta {plant.id}")
                cnpj_value = None
            
            plant_dict = plant.to_dict()
            # Garantir que CNPJ sempre esteja presente (mesmo que seja None ou string vazia)
            if 'cnpj' not in plant_dict:
                plant_dict['cnpj'] = cnpj_value if cnpj_value else ''
            elif plant_dict['cnpj'] is None:
                plant_dict['cnpj'] = ''
            result.append(plant_dict)
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar plantas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants', methods=['POST'])
@permission_required('create_plant', 'editor')
def create_plant(current_user):
    """Cria uma nova planta e seu usuário de acesso"""
    try:
        from src.models.plant import Plant
        
        data = request.get_json()
        
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
        if not cnpj:
            return jsonify({'error': 'CNPJ da planta é obrigatório'}), 400
        
        if not data.get('email'):
            logger.error("Email não fornecido")
            return jsonify({'error': 'E-mail da planta é obrigatório'}), 400
        
        # Verificar se já existe planta com mesmo nome na mesma company
        existing = Plant.query.filter_by(
            name=data['name'],
            company_id=current_user.company_id
        ).first()
        if existing:
            return jsonify({
                'error': 'Já existe uma planta cadastrada com este nome',
                'field': 'name',
                'message': f'O nome "{data["name"]}" já está em uso por outra planta. Por favor, escolha um nome diferente.'
            }), 400
        
        # Verificar se já existe planta com mesmo código na mesma company
        existing_code = Plant.query.filter_by(
            code=data['code'],
            company_id=current_user.company_id
        ).first()
        if existing_code:
            return jsonify({
                'error': 'Já existe uma planta cadastrada com este código',
                'field': 'code',
                'message': f'O código "{data["code"]}" já está em uso por outra planta. Por favor, escolha um código diferente.'
            }), 400
        
        # Verificar se já existe planta com o mesmo CNPJ na mesma company
        existing_cnpj = Plant.query.filter_by(
            cnpj=cnpj,
            company_id=current_user.company_id
        ).first()
        if existing_cnpj:
            return jsonify({
                'error': 'CNPJ já cadastrado',
                'field': 'cnpj',
                'message': f'O CNPJ "{cnpj}" já está cadastrado para a planta "{existing_cnpj.name}". Por favor, verifique o CNPJ informado.'
            }), 400
        
        # Verificar se email já existe na mesma company
        existing_user = User.query.filter_by(
            email=data['email'],
            company_id=current_user.company_id
        ).first()
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
        
        # Criar planta associada à mesma company do admin
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
            is_active=data.get('is_active', True),  # Padrão: ativa
            company_id=current_user.company_id,
            created_by_admin_id=current_user.id
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
            company_id=current_user.company_id,
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

# IMPORTANTE: Rotas específicas (/plants/<id>/resource) devem vir ANTES das rotas genéricas (/plants/<id>)
# para garantir que o Flask resolva corretamente as rotas mais específicas
@admin_bp.route('/plants/<int:plant_id>/operating-hours', methods=['GET'])
@permission_required('configure_plant_hours', 'viewer')
def get_operating_hours_by_plant(current_user, plant_id):
    """Retorna horários de funcionamento configurados para uma planta específica
    Rota alternativa que aceita plant_id no path ao invés de query parameter
    """
    try:
        from src.models.operating_hours import OperatingHours
        
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Filtrar por plant_id e company_id
        # Multi-tenant: filtrar por company_id
        query = OperatingHours.query.filter_by(
            is_active=True,
            company_id=current_user.company_id,
            plant_id=plant_id
        )
        
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

@admin_bp.route('/plants/<int:plant_id>', methods=['PUT'])
@permission_required('edit_plant', 'viewer')
def update_plant(current_user, plant_id):
    """Atualiza uma planta existente"""
    try:
        from src.models.plant import Plant
        
        plant = Plant.query.get(plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Verificar se a planta pertence à mesma company
        if plant.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Esta planta não pertence ao seu domínio'}), 403

        # IMPORTANTE: Rotas específicas (/plants/<id>/resource) devem vir ANTES das rotas genéricas (/plants/<id>)
        # Esta rota será definida logo após update_plant para manter a organização

        data = request.get_json()

        # Verificar se está tentando alterar o is_active (inativar/ativar)
        # Se está alterando o status, verificar permissão específica de inativar/ativar
        if 'is_active' in data:
            from src.utils.permissions import has_permission
            if not has_permission('inactivate_plant', 'editor', current_user):
                return jsonify({
                    'error': 'Você não tem permissão para inativar/ativar plantas. Apenas usuários com perfil Editor podem realizar esta ação.',
                    'permission_required': 'inactivate_plant',
                    'permission_level': 'editor'
                }), 403
        
        # Verificar se está tentando editar campos (apenas usuários com permissão 'editor' podem editar)
        has_edit_permission = has_permission('edit_plant', 'editor', current_user)
        if not has_edit_permission and any(key in data for key in ['name', 'code', 'email', 'cnpj', 'phone', 'cep', 'street', 'number', 'neighborhood', 'reference']):
            return jsonify({
                'error': 'Você não tem permissão para editar plantas. Apenas usuários com perfil Editor podem realizar esta ação.',
                'permission_required': 'edit_plant',
                'permission_level': 'editor'
            }), 403
        
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
            # Reativar usuários da planta se a planta for reativada
            if not data['is_active']:
                User.query.filter_by(plant_id=plant_id).update({'is_active': False})
            else:
                # Reativar usuários quando a planta for reativada
                User.query.filter_by(plant_id=plant_id).update({'is_active': True})
        
        plant.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Planta atualizada com sucesso',
            'plant': plant.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants/<int:plant_id>/operating-hours', methods=['POST'])
@permission_required('configure_plant_hours', 'editor')
def save_operating_hours_by_plant(current_user, plant_id):
    """Salva horários de funcionamento para uma planta específica
    Rota alternativa que aceita plant_id no path ao invés de body
    """
    try:
        # Validar se a planta existe e pertence à mesma company
        plant = Plant.query.filter_by(
            id=plant_id,
            company_id=current_user.company_id
        ).first()
        if not plant:
            return jsonify({'error': 'Planta não encontrada ou não pertence ao seu domínio'}), 404
        
        # Obter dados do body
        raw_data = request.get_json()
        if not raw_data:
            raw_data = {}
        
        # O frontend pode enviar os dados de duas formas:
        # 1. Diretamente: { weekdays: {...}, weekend: {...}, holiday: {...} }
        # 2. Envolto em default_schedule: { default_schedule: { weekdays: {...}, weekend: {...}, holiday: {...} } }
        # Extrair os dados corretamente
        if 'default_schedule' in raw_data:
            data = raw_data['default_schedule']
        else:
            data = raw_data
        
        # Adicionar plant_id ao data para garantir consistência
        data['plant_id'] = plant_id
        
        # Chamar a função save_operating_hours com os dados atualizados
        # Como não podemos importar facilmente, vamos usar a lógica inline
        from src.models.operating_hours import OperatingHours
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Salvando horários para planta ID {plant_id} (via path): {data}")
        
        # Desativar todas as configurações existentes desta planta
        # Multi-tenant: filtrar por company_id
        query = OperatingHours.query.filter_by(
            company_id=current_user.company_id,
            plant_id=plant_id
        )
        
        existing_configs = query.all()
        logger.info(f"Desativando {len(existing_configs)} configurações existentes")
        for config in existing_configs:
            config.is_active = False
        
        # Salvar Dias Úteis
        weekdays_data = data.get('weekdays', {})
        if weekdays_data:
            # Se enabled for False, desativar configurações existentes
            if not weekdays_data.get('enabled'):
                existing_weekdays = OperatingHours.query.filter_by(
                    plant_id=plant_id,
                    schedule_type='weekdays',
                    day_of_week=None,
                    company_id=current_user.company_id
                ).all()
                for config in existing_weekdays:
                    config.is_active = False
            elif weekdays_data.get('enabled'):
                weekdays = weekdays_data
                operating_start = weekdays.get('operating_start')
                operating_end = weekdays.get('operating_end')
                
                if (operating_start and operating_end and 
                    isinstance(operating_start, str) and isinstance(operating_end, str) and
                    operating_start.strip() and operating_end.strip()):
                    try:
                        start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                        end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                        
                        existing = OperatingHours.query.filter_by(
                            plant_id=plant_id,
                            schedule_type='weekdays',
                            day_of_week=None,
                            company_id=current_user.company_id
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
                                is_active=True,
                                company_id=current_user.company_id
                            )
                            db.session.add(new_config)
                    except ValueError:
                        return jsonify({'error': 'Formato de horário inválido para dias úteis'}), 400
        
        # Salvar Finais de Semana
        weekend_data = data.get('weekend', {})
        if weekend_data and weekend_data.get('enabled'):
            weekend = weekend_data
            days = weekend.get('days', [])
            operating_start = weekend.get('operating_start')
            operating_end = weekend.get('operating_end')
            
            if (operating_start and operating_end and 
                isinstance(operating_start, str) and isinstance(operating_end, str) and
                operating_start.strip() and operating_end.strip()):
                try:
                    start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                    end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                    
                    day_map = {'SATURDAY': 5, 'SUNDAY': 6}
                    
                    for day_name in days:
                        day_of_week = day_map.get(day_name)
                        if day_of_week is not None:
                            existing = OperatingHours.query.filter_by(
                                plant_id=plant_id,
                                schedule_type='weekend',
                                day_of_week=day_of_week,
                                company_id=current_user.company_id
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
                                    is_active=True,
                                    company_id=current_user.company_id
                                )
                                db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para finais de semana'}), 400
        
        # Salvar Feriados
        holiday_data = data.get('holiday', {})
        if holiday_data and holiday_data.get('enabled'):
            holiday = holiday_data
            operating_start = holiday.get('operating_start')
            operating_end = holiday.get('operating_end')
            
            if (operating_start and operating_end and 
                isinstance(operating_start, str) and isinstance(operating_end, str) and
                operating_start.strip() and operating_end.strip()):
                try:
                    start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                    end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                    
                    existing = OperatingHours.query.filter_by(
                        plant_id=plant_id,
                        schedule_type='holiday',
                        day_of_week=None,
                        company_id=current_user.company_id
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
                            is_active=True,
                            company_id=current_user.company_id
                        )
                        db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para feriados'}), 400
        
        db.session.commit()
        logger.info(f"Horários de funcionamento salvos com sucesso para planta ID {plant_id}")
        
        return jsonify({
            'message': 'Horários de funcionamento salvos com sucesso',
            'plant_id': plant_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar horários para planta ID {plant_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plants/<int:plant_id>', methods=['DELETE'])
@permission_required('delete_plant', 'editor')
def delete_plant(current_user, plant_id):
    """Deleta uma planta, exclui usuário com mesmo email e inativa outros usuários vinculados"""
    try:
        from src.models.plant import Plant
        
        plant = Plant.query.get(plant_id)
        if not plant:
            return jsonify({'error': 'Planta não encontrada'}), 404
        
        # Verificar se a planta pertence à mesma company
        if plant.company_id != current_user.company_id:
            return jsonify({'error': 'Acesso negado. Esta planta não pertence ao seu domínio'}), 403

        # Buscar usuário com mesmo email da planta (independente de plant_id)
        user_to_delete = None
        if plant.email:
            plant_email_clean = plant.email.strip().lower()
            
            # Buscar usuário com email correspondente (case-insensitive)
            users_with_email = User.query.filter(User.email.isnot(None)).all()
            
            for user in users_with_email:
                user_email_clean = user.email.strip().lower() if user.email else None
                if user_email_clean == plant_email_clean:
                    user_to_delete = user
                    break
        
        # Buscar TODOS os usuários vinculados à planta pelo plant_id
        # IMPORTANTE: Precisamos remover o vínculo de TODOS antes de deletar a planta
        users_linked_to_plant = User.query.filter_by(plant_id=plant_id).all()
        
        # Separar usuários para inativação (excluir o que já será deletado da lista)
        users_to_inactivate = []
        for user in users_linked_to_plant:
            # Não incluir o usuário que será excluído
            if user_to_delete and user.id == user_to_delete.id:
                continue
            users_to_inactivate.append(user)
        
        # IMPORTANTE: Remover o vínculo plant_id de TODOS os usuários vinculados ANTES de deletar a planta
        # Isso evita erro de foreign key constraint
        for user in users_linked_to_plant:
            # Não remover vínculo do usuário que será deletado (será deletado junto)
            if user_to_delete and user.id == user_to_delete.id:
                continue
            user.plant_id = None  # Remover vínculo com a planta
        
        # Fazer flush para garantir que as alterações sejam aplicadas antes de deletar
        db.session.flush()
        
        # Excluir o usuário com mesmo email da planta
        if user_to_delete:
            db.session.delete(user_to_delete)
            db.session.flush()  # Flush após deletar usuário
        
        # Inativar os outros usuários vinculados à planta
        for user in users_to_inactivate:
            user.is_active = False
        
        # Agora podemos deletar a planta com segurança (todos os vínculos foram removidos)
        db.session.delete(plant)
        db.session.commit()
        
        deleted_count = 1 if user_to_delete else 0
        inactivated_count = len(users_to_inactivate)
        
        message = f'Planta deletada com sucesso'
        if deleted_count > 0:
            message += f'. {deleted_count} usuário(s) excluído(s)'
        if inactivated_count > 0:
            message += f'. {inactivated_count} usuário(s) inativado(s)'
        
        return jsonify({'message': message}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao deletar planta ID {plant_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/operating-hours', methods=['GET'])
@permission_required('configure_plant_hours', 'viewer')
def get_operating_hours(current_user):
    """Retorna horários de funcionamento configurados"""
    try:
        from src.models.operating_hours import OperatingHours
        
        # Obter plant_id da query string (opcional)
        plant_id = request.args.get('plant_id', type=int)
        
        # Filtrar por plant_id se fornecido, senão buscar configurações globais (plant_id=None)
        # Multi-tenant: filtrar por company_id
        query = OperatingHours.query.filter_by(
            is_active=True,
            company_id=current_user.company_id
        )
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
@permission_required('configure_plant_hours', 'editor')
def save_operating_hours(current_user):
    """Salva horários de funcionamento"""
    try:
        from src.models.operating_hours import OperatingHours
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Dados recebidos para salvar horários: {data}")
        
        # Obter plant_id do body (opcional)
        plant_id = data.get('plant_id', None)
        if plant_id is not None and plant_id != '' and str(plant_id).lower() != 'null':
            try:
                plant_id = int(plant_id)
                logger.info(f"Salvando configurações para planta ID: {plant_id}")
                
                # Validar se a planta existe e pertence à mesma company
                plant = Plant.query.filter_by(
                    id=plant_id,
                    company_id=current_user.company_id
                ).first()
                if not plant:
                    return jsonify({'error': 'Planta não encontrada ou não pertence ao seu domínio'}), 404
            except (ValueError, TypeError):
                logger.warning(f"Valor inválido para plant_id: {plant_id}, tratando como None")
                plant_id = None
        else:
            plant_id = None
            logger.info("Salvando configurações globais (plant_id=None)")
        
        # Desativar todas as configurações existentes da mesma planta (ou globais)
        # Multi-tenant: filtrar por company_id
        query = OperatingHours.query.filter_by(company_id=current_user.company_id)
        if plant_id is not None:
            query = query.filter_by(plant_id=plant_id)
        else:
            query = query.filter_by(plant_id=None)
        
        existing_configs = query.all()
        logger.info(f"Desativando {len(existing_configs)} configurações existentes")
        for config in existing_configs:
            config.is_active = False
        
        # Salvar Dias Úteis
        weekdays_data = data.get('weekdays', {})
        if weekdays_data and weekdays_data.get('enabled'):
            weekdays = weekdays_data
            operating_start = weekdays.get('operating_start')
            operating_end = weekdays.get('operating_end')
            
            logger.info(f"Dias úteis habilitados - Start: {operating_start} (tipo: {type(operating_start)}), End: {operating_end} (tipo: {type(operating_end)})")
            
            # Se não houver horários, não salvar (será considerado 24h)
            # Verificar se são strings não vazias
            if (operating_start and operating_end and 
                isinstance(operating_start, str) and isinstance(operating_end, str) and
                operating_start.strip() and operating_end.strip()):
                try:
                    start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                    end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                    logger.info(f"Horários parseados - Start: {start_time}, End: {end_time}")
                    
                    # Verificar se já existe (multi-tenant: filtrar por company_id)
                    existing = OperatingHours.query.filter_by(
                        plant_id=plant_id,
                        schedule_type='weekdays',
                        day_of_week=None,
                        company_id=current_user.company_id
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
                            is_active=True,
                            company_id=current_user.company_id
                        )
                        db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para dias úteis'}), 400
        
        # Salvar Finais de Semana
        weekend_data = data.get('weekend', {})
        if weekend_data and weekend_data.get('enabled'):
            weekend = weekend_data
            days = weekend.get('days', [])
            operating_start = weekend.get('operating_start')
            operating_end = weekend.get('operating_end')
            
            logger.info(f"Finais de semana habilitados - Start: {operating_start}, End: {operating_end}, Days: {days}")
            
            # Verificar se são strings não vazias
            if (operating_start and operating_end and 
                isinstance(operating_start, str) and isinstance(operating_end, str) and
                operating_start.strip() and operating_end.strip()):
                try:
                    start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                    end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                    
                    # Mapear dias
                    day_map = {'SATURDAY': 5, 'SUNDAY': 6}
                    
                    for day_name in days:
                        day_of_week = day_map.get(day_name)
                        if day_of_week is not None:
                            # Multi-tenant: filtrar por company_id
                            existing = OperatingHours.query.filter_by(
                                plant_id=plant_id,
                                schedule_type='weekend',
                                day_of_week=day_of_week,
                                company_id=current_user.company_id
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
                                    is_active=True,
                                    company_id=current_user.company_id
                                )
                                db.session.add(new_config)
                except ValueError:
                    return jsonify({'error': 'Formato de horário inválido para finais de semana'}), 400
        
        # Salvar Feriados
        holiday_data = data.get('holiday', {})
        if holiday_data and holiday_data.get('enabled'):
            holiday = holiday_data
            operating_start = holiday.get('operating_start')
            operating_end = holiday.get('operating_end')
            
            logger.info(f"Feriados habilitados - Start: {operating_start}, End: {operating_end}")
            
            if (operating_start and operating_end and 
                isinstance(operating_start, str) and isinstance(operating_end, str) and
                operating_start.strip() and operating_end.strip()):
                try:
                    start_time = datetime.strptime(operating_start.strip(), '%H:%M').time()
                    end_time = datetime.strptime(operating_end.strip(), '%H:%M').time()
                    
                    # Multi-tenant: filtrar por company_id
                    existing = OperatingHours.query.filter_by(
                        plant_id=plant_id,
                        schedule_type='holiday',
                        day_of_week=None,
                        company_id=current_user.company_id
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
                            is_active=True,
                            company_id=current_user.company_id
                        )
                        db.session.add(new_config)
                except ValueError as e:
                    logger.error(f"Erro ao processar horários de feriados: {e}")
                    return jsonify({'error': 'Formato de horário inválido para feriados'}), 400
        
        try:
            db.session.commit()
            logger.info("Horários de funcionamento salvos com sucesso")
            return jsonify({'message': 'Horários de funcionamento salvos com sucesso'}), 200
        except IntegrityError as integrity_error:
            db.session.rollback()
            logger.error(f"Erro de integridade ao salvar horários: {integrity_error}", exc_info=True)
            return jsonify({'error': 'Erro ao salvar: conflito com configuração existente. Tente novamente.'}), 400
        except Exception as commit_error:
            logger.error(f"Erro ao fazer commit: {commit_error}", exc_info=True)
            db.session.rollback()
            raise
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar horários de funcionamento: {str(e)}", exc_info=True)
        import traceback
        logger.error(f"Traceback completo: {traceback.format_exc()}")
        return jsonify({'error': f'Erro ao salvar horários: {str(e)}'}), 500

# ==================== ROTAS DE USUÁRIOS ====================

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users(current_user):
    """Lista apenas os usuários do domínio do admin logado"""
    try:
        # Buscar todos os usuários e filtrar pelo domínio do admin
        all_users = User.query.all()
        filtered_users = []
        
        for user in all_users:
            # Verificar se o usuário pertence ao domínio do admin atual
            if user_belongs_to_admin_domain(user, current_user):
                filtered_users.append(user)
        
        result = []
        
        for user in filtered_users:
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
            if supplier.company_id != current_user.company_id:
                return jsonify({'error': 'Acesso negado. Este fornecedor não pertence ao seu domínio'}), 403
        
        if data['role'] == 'plant':
            if not data.get('plant_id'):
                return jsonify({'error': 'plant_id é obrigatório para usuários do tipo planta'}), 400
            plant = Plant.query.get(data['plant_id'])
            if not plant:
                return jsonify({'error': 'Planta não encontrada'}), 404
            if plant.company_id != current_user.company_id:
                return jsonify({'error': 'Acesso negado. Esta planta não pertence ao seu domínio'}), 403
        
        # Gerar senha temporária se não fornecida
        password = data.get('password') or generate_temp_password()
        
        # Criar usuário
        # IMPORTANTE: Definir company_id e created_by_admin_id
        user = User(
            email=data['email'],
            role=data['role'],
            company_id=current_user.company_id,  # Multi-tenant: mesma company do admin
            supplier_id=data.get('supplier_id'),
            plant_id=data.get('plant_id'),
            created_by_admin_id=current_user.id,  # Rastrear qual admin criou este usuário
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
        
        # Verificar se o usuário pertence ao domínio do admin atual
        if not user_belongs_to_admin_domain(user, current_user):
            return jsonify({'error': 'Acesso negado. Este usuário não pertence ao seu domínio'}), 403
        
        data = request.get_json()
        
        # Atualizar email (se fornecido e diferente)
        if 'email' in data and data['email'] != user.email:
            existing_user = User.query.filter_by(
                email=data['email'],
                company_id=current_user.company_id
            ).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email já cadastrado nesta empresa'}), 400
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
        
        # Limpar associações baseadas no role ANTES de atualizar novas associações
        # Se o role mudou para admin, limpar todas as associações
        if 'role' in data and data['role'] == 'admin':
            user.supplier_id = None
            user.plant_id = None
        # Se o role mudou para supplier, limpar associação com planta
        elif 'role' in data and data['role'] == 'supplier':
            user.plant_id = None
        # Se o role mudou para plant, limpar associação com fornecedor
        elif 'role' in data and data['role'] == 'plant':
            user.supplier_id = None
        
        # Atualizar associações (se fornecido)
        # Permite passar None/null para limpar associações
        if 'supplier_id' in data:
            supplier_id = data['supplier_id']
            if supplier_id is not None:
                # Validar se o fornecedor existe
                supplier = Supplier.query.get(supplier_id)
                if not supplier:
                    return jsonify({'error': 'Fornecedor não encontrado'}), 404
                if not supplier.is_active:
                    return jsonify({'error': 'Fornecedor inativo'}), 400
                # Verificar se o fornecedor pertence ao admin atual
                if supplier.company_id != current_user.company_id:
                    return jsonify({'error': 'Acesso negado. Este fornecedor não pertence ao seu domínio'}), 403
            user.supplier_id = supplier_id
        
        if 'plant_id' in data:
            plant_id = data['plant_id']
            if plant_id is not None:
                # Validar se a planta existe
                from src.models.plant import Plant
                plant = Plant.query.get(plant_id)
                if not plant:
                    return jsonify({'error': 'Planta não encontrada'}), 404
                if not plant.is_active:
                    return jsonify({'error': 'Planta inativa'}), 400
                # Verificar se a planta pertence ao admin atual
                if plant.company_id != current_user.company_id:
                    return jsonify({'error': 'Acesso negado. Esta planta não pertence ao seu domínio'}), 403
            user.plant_id = plant_id
        
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
        user = User.query.get(user_id)
        if not user:
            logger.warning(f"Usuário ID {user_id} não encontrado")
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Verificar se o usuário pertence ao domínio do admin atual
        if not user_belongs_to_admin_domain(user, current_user):
            return jsonify({'error': 'Acesso negado. Este usuário não pertence ao seu domínio'}), 403
        
        user_id_to_delete = user.id
        
        # Não permitir deletar o próprio usuário
        if user.id == current_user.id:
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
        try:
            user_role = getattr(user, 'role', 'unknown')
            user_plant_id = getattr(user, 'plant_id', None)
            user_supplier_id = getattr(user, 'supplier_id', None)
        except:
            user_role = 'unknown'
            user_plant_id = None
            user_supplier_id = None
        
        try:
            # Verificar se a planta/supplier ainda existe antes de deletar
            # Se não existir, limpar a referência para evitar erro de constraint
            needs_cleanup = False
            
            if user_plant_id:
                try:
                    plant_exists = Plant.query.get(user_plant_id)
                    if not plant_exists:
                        logger.warning(f"Planta ID {user_plant_id} não existe mais. Limpando referência antes de excluir usuário.")
                        user.plant_id = None
                        needs_cleanup = True
                except Exception as e:
                    logger.warning(f"Erro ao verificar planta ID {user_plant_id}: {str(e)}. Limpando referência.")
                    user.plant_id = None
                    needs_cleanup = True
            
            if user_supplier_id:
                try:
                    supplier_exists = Supplier.query.get(user_supplier_id)
                    if not supplier_exists:
                        logger.warning(f"Fornecedor ID {user_supplier_id} não existe mais. Limpando referência antes de excluir usuário.")
                        user.supplier_id = None
                        needs_cleanup = True
                except Exception as e:
                    logger.warning(f"Erro ao verificar fornecedor ID {user_supplier_id}: {str(e)}. Limpando referência.")
                    user.supplier_id = None
                    needs_cleanup = True
            
            # Se limpamos referências, fazer flush uma vez antes de deletar
            if needs_cleanup:
                db.session.flush()
            
            # Remover o usuário da sessão
            db.session.delete(user)
            
            # Commit da transação (flush é feito automaticamente antes do commit)
            db.session.commit()
            
        except Exception as commit_error:
            db.session.rollback()
            error_type = type(commit_error).__name__
            error_message = str(commit_error)
            logger.error(f"Erro ao fazer commit da exclusão do usuário ID {user_id_to_delete} (Tipo: {error_type}): {error_message}", exc_info=True)
            
            # Verificar se é erro de constraint de chave estrangeira
            if 'foreign key' in error_message.lower() or 'constraint' in error_message.lower() or 'integrity' in error_message.lower():
                return jsonify({
                    'error': 'Não é possível excluir o usuário devido a referências no banco de dados. Tente desativar o usuário ao invés de excluí-lo.'
                }), 400
            
            # Re-raise para ser capturado pelo handler externo
            raise commit_error
        
        logger.info(f"Usuário ID {user_id_to_delete} excluído permanentemente com sucesso")
        
        return jsonify({'message': 'Usuário excluído permanentemente com sucesso'}), 200
        
    except Exception as e:
        db.session.rollback()
        error_type = type(e).__name__
        error_msg = str(e)
        
        logger.error(f"Erro ao deletar usuário ID {user_id} (Tipo: {error_type}): {error_msg}", exc_info=True)
        
        # Retornar mensagem de erro mais amigável
        error_lower = error_msg.lower()
        if 'foreign key' in error_lower or 'constraint' in error_lower or 'integrity' in error_lower:
            return jsonify({
                'error': 'Não é possível excluir o usuário devido a referências no banco de dados. Tente desativar o usuário ao invés de excluí-lo.'
            }), 400
        
        # Retornar mensagem genérica mas informativa
        return jsonify({
            'error': f'Erro ao excluir usuário: {error_msg}',
            'error_type': error_type
        }), 500

@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(current_user, user_id):
    """Redefine a senha de um usuário"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Verificar se o usuário pertence ao domínio do admin atual
        if not user_belongs_to_admin_domain(user, current_user):
            return jsonify({'error': 'Acesso negado. Este usuário não pertence ao seu domínio'}), 403
        
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
    """Retorna todas as permissões configuradas da company do admin atual
    Multi-tenant: retorna apenas permissões da company do usuário
    """
    try:
        from src.models.permission import Permission
        
        # Multi-tenant: retornar apenas permissões da company do admin
        permissions = Permission.get_all_permissions(current_user.company_id)
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
        
        # Multi-tenant: Obter todas as permissões da company do usuário
        all_permissions = Permission.get_all_permissions(current_user.company_id)
        
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
                'configure_date_block', 'configure_max_capacity',
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
        
        # Validar estrutura e log para debug
        valid_roles = ['admin', 'supplier', 'plant']
        valid_permission_types = ['editor', 'viewer', 'none']
        
        logger.info(f"Recebendo permissões para salvar: {data}")
        
        # Validar estrutura
        for function_id, roles in data.items():
            if not isinstance(roles, dict):
                logger.error(f"Estrutura inválida para função {function_id}: {type(roles)}")
                return jsonify({'error': f'Estrutura inválida para função {function_id}. Esperado dict, recebido {type(roles).__name__}'}), 400
            
            for role, permission_type in roles.items():
                # Validar role
                if role not in valid_roles:
                    logger.error(f"Role inválido detectado: '{role}' para função '{function_id}'. Roles válidos: {valid_roles}")
                    return jsonify({
                        'error': f'Role inválido: "{role}" para função "{function_id}". Roles válidos: {", ".join(valid_roles)}'
                    }), 400
                
                # Validar tipo de permissão
                if permission_type not in valid_permission_types:
                    logger.error(f"Tipo de permissão inválido: '{permission_type}' para função '{function_id}', role '{role}'")
                    return jsonify({
                        'error': f'Tipo de permissão inválido: "{permission_type}" para função "{function_id}", role "{role}". Tipos válidos: {", ".join(valid_permission_types)}'
                    }), 400
        
        logger.info(f"Validação passou. Salvando {len(data)} funções com permissões para company {current_user.company_id}")
        
        # Multi-tenant: Salvar permissões apenas para a company do admin atual
        Permission.bulk_update_permissions(data, current_user.company_id)
        
        return jsonify({
            'message': 'Permissões salvas com sucesso',
            'permissions': Permission.get_all_permissions(current_user.company_id)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar permissões: {str(e)}", exc_info=True)
        return jsonify({'error': f'Erro ao salvar permissões: {str(e)}'}), 500

@admin_bp.route('/permissions/check', methods=['POST'])
@admin_required
def check_permission(current_user):
    """Verifica se um role tem permissão para uma funcionalidade
    Multi-tenant: verifica permissões apenas da company do admin atual
    """
    try:
        from src.models.permission import Permission
        
        data = request.get_json()
        
        if not data or 'role' not in data or 'function_id' not in data:
            return jsonify({'error': 'role e function_id são obrigatórios'}), 400
        
        # Multi-tenant: usar company_id do admin atual
        permission_type = Permission.get_permission(data['role'], data['function_id'], current_user.company_id)
        
        return jsonify({
            'role': data['role'],
            'function_id': data['function_id'],
            'permission_type': permission_type,
            'has_access': permission_type != 'none'
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao verificar permissão: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/permissions/debug', methods=['GET'])
@permission_required('create_supplier', 'editor')
def debug_permissions(current_user):
    """Endpoint de debug para verificar permissões do usuário atual"""
    try:
        from src.models.permission import Permission
        from src.utils.permissions import has_permission
        
        # Multi-tenant: Buscar todas as permissões do role do usuário da mesma company
        all_perms = Permission.query.filter_by(
            company_id=current_user.company_id,
            role=current_user.role
        ).all()
        permissions_dict = {p.function_id: p.permission_type for p in all_perms}
        
        # Verificar permissão específica
        create_supplier_permission = Permission.get_permission(current_user.role, 'create_supplier', current_user.company_id)
        has_create_permission = has_permission('create_supplier', 'editor', current_user)
        
        return jsonify({
            'user': {
                'id': current_user.id,
                'email': current_user.email,
                'role': current_user.role,
                'is_active': current_user.is_active
            },
            'permissions': permissions_dict,
            'create_supplier': {
                'permission_type': create_supplier_permission,
                'has_permission': has_create_permission,
                'required': 'editor'
            },
            'total_permissions': len(permissions_dict)
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao debugar permissões: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
