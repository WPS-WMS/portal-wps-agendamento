#!/usr/bin/env python3
"""
Script para inicializar dados de teste no Cargo Flow
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from src.models.user import User, db
from src.models.company import Company
from src.models.supplier import Supplier
from src.models.plant import Plant
from src.models.appointment import Appointment
from src.models.permission import Permission
from src.main import app
from datetime import datetime, date, time

def create_default_permissions(company_id):
    """Cria permissões padrão (editor) para todos os roles e funcionalidades de uma company"""
    # Lista completa de funcionalidades do sistema
    functions = [
        # Agendamentos
        'create_appointment',
        'view_appointments',
        'edit_appointment',
        'delete_appointment',
        'check_in',
        'check_out',
        'reschedule',
        # Fornecedores
        'create_supplier',
        'view_suppliers',
        'edit_supplier',
        'inactivate_supplier',
        'delete_supplier',
        # Plantas
        'create_plant',
        'view_plants',
        'edit_plant',
        'inactivate_plant',
        'delete_plant',
        'configure_plant_hours',
        # Configurações de Horários
        'configure_default_hours',
        'configure_weekly_block',
        'configure_date_block',
    ]
    
    # Roles do sistema (admin não precisa de permissões, tem acesso total)
    roles = ['supplier', 'plant']
    
    # Criar permissões padrão: editor para tudo
    # Usar bulk_update_permissions para melhor performance
    permissions_dict = {}
    for function_id in functions:
        permissions_dict[function_id] = {}
        for role in roles:
            permissions_dict[function_id][role] = 'editor'
    
    Permission.bulk_update_permissions(permissions_dict, company_id)
    print(f"  Permissoes padrao criadas para company_id={company_id} ({len(functions)} funcoes x {len(roles)} roles = {len(functions) * len(roles)} permissoes)")

def init_test_data():
    """Inicializa dados de teste no banco de dados"""
    with app.app_context():
        # Limpar dados existentes
        db.drop_all()
        db.create_all()
        
        print("Criando empresa de teste...")
        # Criar empresa de teste (multi-tenant)
        company = Company(
            name='WPS Agendamento',
            cnpj='00.000.000/0001-00',
            is_active=True
        )
        db.session.add(company)
        db.session.commit()  # Commit para garantir que a company existe antes de criar permissões
        
        print("Criando permissoes padrao para WPS Agendamento...")
        create_default_permissions(company.id)
        
        print("Criando usuários administradores...")
        # Criar usuário administrador principal
        admin_user = User(
            email='admin@wps.com',
            role='admin',
            is_active=True,
            company_id=company.id
        )
        admin_user.set_password('admin123')
        db.session.add(admin_user)
        
        # Criar segundo usuário administrador (independente)
        admin2_user = User(
            email='admin2@wps.com',
            role='admin',
            is_active=True,
            company_id=company.id
        )
        admin2_user.set_password('admin123')
        db.session.add(admin2_user)
        
        db.session.flush()  # Para obter os IDs dos admins
        
        print("Criando fornecedores de teste...")
        # Criar fornecedores de teste associados ao admin principal
        supplier1 = Supplier(
            cnpj='12.345.678/0001-90',
            description='Fornecedor ABC Ltda',
            company_id=company.id,
            created_by_admin_id=admin_user.id
        )
        db.session.add(supplier1)
        
        supplier2 = Supplier(
            cnpj='98.765.432/0001-10',
            description='Transportadora XYZ S.A.',
            company_id=company.id,
            created_by_admin_id=admin_user.id
        )
        db.session.add(supplier2)
        
        db.session.flush()  # Para obter os IDs
        
        print("Criando usuários fornecedores...")
        # Criar usuários para os fornecedores
        supplier1_user = User(
            email='fornecedor1@abc.com',
            role='supplier',
            company_id=company.id,
            supplier_id=supplier1.id,
            is_active=True
        )
        supplier1_user.set_password('fornecedor123')
        db.session.add(supplier1_user)
        
        supplier2_user = User(
            email='fornecedor2@xyz.com',
            role='supplier',
            company_id=company.id,
            supplier_id=supplier2.id,
            is_active=True
        )
        supplier2_user.set_password('fornecedor123')
        db.session.add(supplier2_user)
        
        print("Criando plantas de teste...")
        # Criar plantas de teste associadas ao admin principal
        plant1 = Plant(
            name='Planta Central',
            code='PLT-001',
            cnpj='11.222.333/0001-44',
            email='portaria.central@wps.com',
            phone='(11) 3333-4444',
            is_active=True,
            company_id=company.id,
            created_by_admin_id=admin_user.id
        )
        db.session.add(plant1)
        
        plant2 = Plant(
            name='Planta Norte',
            code='PLT-002',
            cnpj='22.333.444/0001-55',
            email='portaria.norte@wps.com',
            phone='(11) 4444-5555',
            is_active=True,
            company_id=company.id,
            created_by_admin_id=admin_user.id
        )
        db.session.add(plant2)
        
        db.session.flush()  # Para obter os IDs
        
        print("Criando usuários de plantas...")
        # Criar usuários para as plantas
        plant1_user = User(
            email='portaria.central@wps.com',
            role='plant',
            company_id=company.id,
            plant_id=plant1.id,
            is_active=True
        )
        plant1_user.set_password('portaria123')
        db.session.add(plant1_user)
        
        plant2_user = User(
            email='portaria.norte@wps.com',
            role='plant',
            company_id=company.id,
            plant_id=plant2.id,
            is_active=True
        )
        plant2_user.set_password('portaria123')
        db.session.add(plant2_user)
        
        print("Criando agendamentos de teste...")
        # Criar alguns agendamentos de teste
        today = date.today()
        
        appointment1 = Appointment(
            date=today,
            time=time(9, 0),
            time_end=time(10, 0),  # Agendamento de 1 hora
            purchase_order='PO-2025-001',
            truck_plate='ABC-1234',
            driver_name='João Silva',
            company_id=company.id,
            supplier_id=supplier1.id,
            plant_id=plant1.id
        )
        db.session.add(appointment1)
        
        appointment2 = Appointment(
            date=today,
            time=time(14, 0),
            time_end=time(15, 0),  # Agendamento de 1 hora
            purchase_order='PO-2025-002',
            truck_plate='XYZ-5678',
            driver_name='Maria Santos',
            company_id=company.id,
            supplier_id=supplier2.id,
            plant_id=plant1.id
        )
        db.session.add(appointment2)
        
        # Criar um agendamento com intervalo maior para teste
        appointment3 = Appointment(
            date=today,
            time=time(10, 0),
            time_end=time(12, 0),  # Agendamento de 2 horas
            purchase_order='PO-2025-003',
            truck_plate='DEF-9012',
            driver_name='Pedro Costa',
            company_id=company.id,
            supplier_id=supplier1.id,
            plant_id=plant2.id
        )
        db.session.add(appointment3)
        
        print("Criando segunda empresa de teste (WPS 2)...")
        # Criar segunda empresa de teste (multi-tenant)
        company2 = Company(
            name='WPS 2',
            cnpj='00.000.000/0002-00',
            is_active=True
        )
        db.session.add(company2)
        db.session.commit()  # Commit para garantir que a company existe antes de criar permissões
        
        print("Criando permissoes padrao para WPS 2...")
        create_default_permissions(company2.id)
        
        print("Criando usuário administrador para WPS 2...")
        # Criar usuário administrador para a segunda empresa
        admin3_user = User(
            email='admin3@wps.com',
            role='admin',
            is_active=True,
            company_id=company2.id
        )
        admin3_user.set_password('admin123')
        db.session.add(admin3_user)
        
        db.session.commit()
        
        print("\n=== DADOS DE TESTE CRIADOS ===")
        print("\nUsuário Administrador 1:")
        print("Email: admin@wps.com")
        print("Senha: admin123")
        
        print("\nUsuário Administrador 2 (Independente):")
        print("Email: admin2@wps.com")
        print("Senha: admin123")
        
        print("\n=== EMPRESA WPS 2 ===")
        print("\nUsuário Administrador 3 (WPS 2):")
        print("Email: admin3@wps.com")
        print("Senha: admin123")
        print("Empresa: WPS 2")
        
        print("\n=== EMPRESA WPS AGENDAMENTO ===")
        print("\nFornecedor 1:")
        print("Email: fornecedor1@abc.com")
        print("Senha: fornecedor123")
        print("CNPJ: 12.345.678/0001-90")
        print("Descrição: Fornecedor ABC Ltda")
        
        print("\nFornecedor 2:")
        print("Email: fornecedor2@xyz.com")
        print("Senha: fornecedor123")
        print("CNPJ: 98.765.432/0001-10")
        print("Descrição: Transportadora XYZ S.A.")
        
        print("\nPlanta 1 (Portaria Central):")
        print("Email: portaria.central@wps.com")
        print("Senha: portaria123")
        print("Nome: Planta Central")
        print("Código: PLT-001")
        
        print("\nPlanta 2 (Portaria Norte):")
        print("Email: portaria.norte@wps.com")
        print("Senha: portaria123")
        print("Nome: Planta Norte")
        print("Código: PLT-002")
        
        print(f"\nAgendamentos criados para hoje ({today}):")
        print("- 09:00-10:00 - PO-2025-001 - ABC-1234 - João Silva (Planta Central)")
        print("- 10:00-12:00 - PO-2025-003 - DEF-9012 - Pedro Costa (Planta Norte)")
        print("- 14:00-15:00 - PO-2025-002 - XYZ-5678 - Maria Santos (Planta Central)")
        
        print("\n=== INICIALIZAÇÃO CONCLUÍDA ===")

if __name__ == '__main__':
    init_test_data()
