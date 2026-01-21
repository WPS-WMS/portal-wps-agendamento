# Portal WPS - Sistema de Agendamento de Carga

**Desenvolvido por:** Manus AI  
**Data:** Janeiro de 2026  
**Versão:** 1.0.0

## Visão Geral

O **Portal WPS** é um sistema completo de agendamento logístico desenvolvido para facilitar a gestão de cargas entre fornecedores e clientes. O sistema oferece três visões distintas: uma para administradores (clientes), outra para fornecedores e uma para plantas, proporcionando controle total sobre o processo de agendamento, check-in e check-out de veículos.

## Arquitetura do Sistema

### Tecnologias Utilizadas

| Componente | Tecnologia | Versão |
|------------|------------|---------|
| **Backend** | Flask (Python) | 3.1.1 |
| **Python** | Python | 3.11+ |
| **Frontend** | React + Vite | 18.2.0 / 6.3.5 |
| **Banco de Dados** | PostgreSQL | 12+ |
| **Autenticação** | JWT (JSON Web Tokens) | PyJWT 2.10.1 |
| **UI Framework** | Tailwind CSS + shadcn/ui | 4.1.7 |
| **Ícones** | Lucide React | 0.510.0 |

### Estrutura do Projeto

```
portal-wps-agendamento/
├── portal_wps_backend/          # Aplicação Flask
│   ├── src/
│   │   ├── main.py             # Aplicação principal (cria banco automaticamente)
│   │   ├── models/             # Modelos de dados (estrutura do banco)
│   │   │   ├── user.py         # Modelo de usuário (tabela users)
│   │   │   ├── company.py      # Modelo de empresa (tabela company) - Multi-tenant
│   │   │   ├── supplier.py     # Modelo de fornecedor (tabela supplier)
│   │   │   ├── appointment.py  # Modelo de agendamento (tabela appointments)
│   │   │   ├── plant.py        # Modelo de planta (tabela plants)
│   │   │   ├── system_config.py # Configurações do sistema (tabela system_config)
│   │   │   ├── schedule_config.py # Configurações de horários (tabela schedule_configs)
│   │   │   ├── default_schedule.py # Horários padrão (tabela default_schedules)
│   │   │   ├── operating_hours.py # Horários de funcionamento (tabela operating_hours)
│   │   │   └── permission.py   # Modelo de permissões (tabela permissions)
│   │   ├── routes/             # Rotas da API
│   │   │   ├── auth.py         # Autenticação (JWT)
│   │   │   ├── admin.py        # Rotas administrativas
│   │   │   ├── supplier.py     # Rotas do fornecedor
│   │   │   ├── plant.py        # Rotas da planta
│   │   │   └── user.py         # Rotas de usuário
│   │   ├── utils/              # Utilitários
│   │   │   ├── helpers.py      # Funções auxiliares
│   │   │   ├── permissions.py  # Sistema de permissões granulares
│   │   │   ├── company_filter.py # Filtro multi-tenant por company_id
│   │   │   └── operating_hours_validator.py # Validação de horários
│   │   └── database/           # (Não usado mais - sistema usa PostgreSQL)
│   │       └── app.db          # (Legado - apenas para migração)
│   ├── venv/                   # Ambiente virtual Python (criar)
│   ├── requirements.txt        # Dependências Python
│   ├── init_data.py           # Script opcional de dados iniciais (dados de teste)
│   └── .env.example           # Template de variáveis de ambiente
├── portal_wps_frontend/         # Aplicação React
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   │   ├── ui/             # Componentes UI (shadcn/ui)
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── SupplierDashboard.jsx
│   │   │   ├── PlantDashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Header.jsx
│   │   │   └── ...             # Outros componentes
│   │   ├── hooks/              # React Hooks customizados
│   │   │   ├── useAuth.js
│   │   │   ├── usePermissions.js
│   │   │   └── use-mobile.js
│   │   ├── lib/                # Utilitários e API
│   │   │   └── api.js          # Cliente API
│   │   └── App.jsx             # Componente principal
│   └── package.json            # Dependências Node.js
├── docs/                        # Documentação do projeto
│   ├── GUIA_INSTALACAO.md      # Guia de instalação
│   ├── DOCUMENTACAO_PORTAL_WPS.md # Este arquivo
│   ├── SEGURANCA.md            # Guia de segurança e configuração
│   ├── MODELAGEM_BANCO_DE_DADOS.md # Modelagem do banco de dados
│   ├── MULTI_TENANT_IMPLEMENTATION.md # Implementação multi-tenant
│   └── README.md               # README da documentação
├── iniciar_servidores.ps1      # Script PowerShell para iniciar ambos os servidores
├── iniciar_backend.ps1         # Script PowerShell para iniciar backend
├── iniciar_frontend.ps1        # Script PowerShell para iniciar frontend
└── README.md                   # README principal
```

## Funcionalidades Principais

### 1. Sistema de Autenticação

O sistema utiliza **JWT (JSON Web Tokens)** para autenticação segura, diferenciando entre três tipos de usuários:

- **Administrador**: Acesso completo ao sistema
- **Fornecedor**: Acesso restrito aos próprios agendamentos
- **Planta**: Acesso restrito (usuários vinculados a plantas)

**Funcionalidades de Segurança:**
- Recuperação de senha com mensagens genéricas (prevenção de enumeração)
- Validação de campos obrigatórios
- Mensagens de erro genéricas para não expor informações sensíveis
- Senhas criptografadas com hash bcrypt

### 2. Visão Administrador

#### Gestão de Fornecedores
- **Cadastro automático**: Criação simultânea de fornecedor e usuário de acesso
- **Validação de CNPJ**: Formatação e validação automática
- **Geração de senha temporária**: Sistema seguro de primeira autenticação
- **Listagem completa**: Visualização de todos os fornecedores cadastrados
- **Gerenciamento**: Ativação/desativação de fornecedores
- **Tela dedicada**: Acesso via botão "Fornecedores" na aba Configurações

#### Gestão de Plantas
- **Cadastro de plantas**: Criação de plantas (locais físicos) com dados completos
- **Campos obrigatórios**: Nome, Código e E-mail
- **Campos opcionais**: Telefone e endereço completo (CEP, rua, número, bairro, referência)
- **Geração automática de usuário**: Criação de usuário vinculado à planta
- **Gerenciamento**: Ativação/desativação de plantas
- **Tela dedicada**: Acesso via botão "Plantas" na aba Configurações

#### Gestão de Agendamentos
- **Visualização diária**: Interface calendário com navegação por dias (visão diária)
- **Estatísticas em tempo real**: Contadores de agendamentos por status do dia selecionado
- **Filtros interativos**: Cards de estatísticas funcionam como filtros por status
- **Edição de agendamentos**: Modificação de dados pelos administradores
- **Sistema de check-in/check-out**: Controle de entrada e saída de veículos
- **Reagendamento**: Sistema de reagendamento com motivo obrigatório
- **Validação de capacidade**: Verificação de capacidade máxima por horário
- **Filtro por planta**: Visualização de agendamentos por planta específica

#### Configuração de Horários
- **Horários Padrão**: Configuração de horários padrão de funcionamento
- **Bloqueio Semanal**: Bloqueio de horários específicos por dia da semana
- **Bloqueio por Data**: Bloqueio de horários em datas específicas
- **Horários por Planta**: Configuração de horários específicos por planta
- **Validação Automática**: Sistema valida horários ao criar/editar agendamentos

#### Gestão de Usuários
- **Criação de usuários**: Cadastro de novos usuários com diferentes perfis
- **Edição de usuários**: Modificação de dados de usuários existentes
- **Gerenciamento de permissões**: Controle de acesso por funcionalidade
- **Redefinição de senha**: Sistema de redefinição de senha por administradores

#### Integração ERP
Quando um check-in é realizado, o sistema gera automaticamente um **payload JSON** para integração com sistemas ERP externos:

```json
{
  "appointment_id": 1,
  "appointment_number": "AG-20260114-0001",
  "supplier_cnpj": "12.345.678/0001-90",
  "supplier_name": "Fornecedor ABC Ltda",
  "purchase_order": "PO-2025-001",
  "truck_plate": "ABC-1234",
  "driver_name": "João Silva",
  "scheduled_date": "2025-09-29",
  "scheduled_time": "09:00:00",
  "check_in_time": "2025-09-29T15:04:07.192193",
  "check_out_time": null,
  "status": "checked_in",
  "timestamp": "2025-09-29T15:04:07.199018"
}
```

### 3. Visão Fornecedor

#### Gestão de Agendamentos Próprios
- **Visualização diária**: Calendário com agendamentos do fornecedor (visão diária)
- **Criação de agendamentos**: Formulário completo para novos agendamentos
- **Edição de agendamentos**: Modificação de agendamentos existentes
- **Exclusão de agendamentos**: Cancelamento de agendamentos próprios (apenas status 'scheduled' ou 'rescheduled')
- **Validação de disponibilidade**: Verificação automática de horários disponíveis
- **Validação de capacidade**: Verificação de capacidade máxima por horário
- **Reagendamento**: Sistema de reagendamento com motivo obrigatório ao alterar data/horário
- **Seleção de planta**: Escolha da planta de destino ao criar agendamento

#### Campos do Agendamento
- **Data**: Seleção de data (formato DD/MM/AAAA com máscara)
- **Planta**: Seleção da planta de destino (obrigatório)
- **Horário Inicial**: Seleção de horário (formato HH:mm, intervalos de 30 minutos)
- **Horário Final**: Seleção de horário final (formato HH:mm, intervalos de 30 minutos)
- **Pedido de Compra**: Número do PO (obrigatório)
- **Placa do Caminhão**: Identificação do veículo (obrigatório)
- **Nome do Motorista**: Responsável pela entrega (obrigatório)
- **Motivo do Reagendamento**: Campo obrigatório quando data/horário são alterados

### 4. Visão Planta

#### Gestão de Agendamentos Recebidos
- **Visualização diária**: Calendário com agendamentos recebidos pela planta (visão diária)
- **Check-in/Check-out**: Controle de entrada e saída de veículos
- **Visualização de detalhes**: Informações completas do fornecedor e agendamento
- **Filtros**: Visualização por status (scheduled, checked_in, checked_out, rescheduled)

#### Funcionalidades Específicas
- **Check-in**: Marcação de chegada do veículo (gera payload para ERP)
- **Check-out**: Marcação de saída após descarga completa
- **Visualização de fornecedores**: Lista de fornecedores que agendam na planta
- **Configuração de capacidade**: Visualização e configuração da capacidade máxima por horário
- **Horários de funcionamento**: Visualização dos horários configurados para a planta

### 5. Sistema de Permissões Granulares

O sistema implementa um controle de acesso granular por funcionalidade através do módulo de **Perfis de Acesso**:

#### Tipos de Permissão
- **Editor**: Mesmos privilégios do Administrador na funcionalidade específica
- **Visualizador**: Apenas visualização (sem criar, editar ou excluir)
- **Sem acesso**: Bloqueio completo da funcionalidade

#### Funcionalidades Configuráveis
- **Agendamentos**: Criar, visualizar, editar, excluir, check-in, check-out, reagendar
- **Fornecedores**: Criar, visualizar, editar, inativar, excluir
- **Plantas**: Criar, visualizar, editar, inativar, excluir, configurar horários
- **Configurações de Horários**: Horário padrão, bloqueio semanal, bloqueio por data

#### Regras de Negócio
- Permissões são configuradas por perfil (Fornecedor ou Planta)
- Alterações não salvas são perdidas ao sair da tela
- Apenas Administradores podem configurar permissões
- Permissões são aplicadas tanto no frontend quanto no backend

## API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/login` | Autenticação de usuário |
| POST | `/api/forgot-password` | Recuperação de senha (mensagem genérica) |
| GET | `/api/verify` | Verificação de token JWT |

### Administrador
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/suppliers` | Listar fornecedores |
| POST | `/api/admin/suppliers` | Criar fornecedor |
| PUT | `/api/admin/suppliers/{id}` | Atualizar fornecedor |
| DELETE | `/api/admin/suppliers/{id}` | Desativar fornecedor (soft delete) |
| GET | `/api/admin/plants` | Listar plantas |
| POST | `/api/admin/plants` | Criar planta |
| PUT | `/api/admin/plants/{id}` | Atualizar planta |
| DELETE | `/api/admin/plants/{id}` | Desativar planta (soft delete) |
| GET | `/api/admin/appointments` | Listar agendamentos (por data) |
| POST | `/api/admin/appointments` | Criar agendamento |
| PUT | `/api/admin/appointments/{id}` | Editar agendamento |
| DELETE | `/api/admin/appointments/{id}` | Excluir agendamento |
| POST | `/api/admin/appointments/{id}/check-in` | Realizar check-in |
| POST | `/api/admin/appointments/{id}/check-out` | Realizar check-out |
| GET | `/api/admin/system-config/max-capacity` | Obter capacidade máxima por horário |
| POST | `/api/admin/system-config/max-capacity` | Atualizar capacidade máxima por horário |
| GET | `/api/admin/users` | Listar usuários |
| POST | `/api/admin/users` | Criar usuário |
| PUT | `/api/admin/users/{id}` | Atualizar usuário |
| DELETE | `/api/admin/users/{id}` | Excluir usuário |
| POST | `/api/admin/users/{id}/reset-password` | Redefinir senha de usuário |
| GET | `/api/admin/permissions` | Obter permissões configuradas |
| POST | `/api/admin/permissions` | Salvar configurações de permissões |
| GET | `/api/admin/operating-hours` | Obter horários de funcionamento |
| POST | `/api/admin/operating-hours` | Configurar horários de funcionamento |

### Fornecedor
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/supplier/appointments` | Listar agendamentos próprios |
| POST | `/api/supplier/appointments` | Criar agendamento |
| PUT | `/api/supplier/appointments/{id}` | Editar agendamento próprio |
| DELETE | `/api/supplier/appointments/{id}` | Cancelar agendamento |
| GET | `/api/supplier/available-slots` | Listar horários disponíveis |
| GET | `/api/supplier/plants` | Listar plantas disponíveis |
| GET | `/api/supplier/plants/{id}/capacity` | Obter capacidade de uma planta |
| POST | `/api/supplier/appointments/{id}/check-in` | Realizar check-in (se permitido) |
| POST | `/api/supplier/appointments/{id}/check-out` | Realizar check-out (se permitido) |

### Planta
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/plant/appointments` | Listar agendamentos recebidos pela planta |
| POST | `/api/plant/appointments` | Criar agendamento (se permitido) |
| PUT | `/api/plant/appointments/{id}` | Editar agendamento (se permitido) |
| DELETE | `/api/plant/appointments/{id}` | Excluir agendamento (se permitido) |
| POST | `/api/plant/appointments/{id}/check-in` | Realizar check-in |
| POST | `/api/plant/appointments/{id}/check-out` | Realizar check-out |
| GET | `/api/plant/profile` | Obter perfil da planta |
| GET | `/api/plant/operating-hours` | Obter horários de funcionamento |
| GET | `/api/plant/suppliers` | Listar fornecedores que agendam na planta |
| GET | `/api/plant/plants` | Listar plantas (própria) |
| GET | `/api/plant/system-config/max-capacity` | Obter capacidade máxima |
| POST | `/api/plant/system-config/max-capacity` | Configurar capacidade máxima |

### Usuário
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/profile` | Obter perfil do usuário autenticado |
| PUT | `/api/profile` | Atualizar perfil (incluindo senha) |

## Modelo de Dados

### Usuário (User)
```python
{
  "id": Integer,
  "email": String,
  "password_hash": String,
  "role": String,  # "admin", "supplier" ou "plant"
  "is_active": Boolean,  # Status ativo/bloqueado
  "supplier_id": Integer,  # Referência ao fornecedor (nullable)
  "plant_id": Integer,  # Referência à planta (nullable)
  "created_at": DateTime,
  "updated_at": DateTime
}
```

### Fornecedor (Supplier)
```python
{
  "id": Integer,
  "cnpj": String,
  "description": String,
  "is_active": Boolean,  # Status ativo/bloqueado
  "is_deleted": Boolean,  # Soft delete
  "created_at": DateTime,
  "updated_at": DateTime
}
```

### Planta (Plant)
```python
{
  "id": Integer,
  "name": String,  # Nome da planta (obrigatório)
  "code": String,  # Código ou identificador (opcional)
  "cnpj": String,  # CNPJ (obrigatório)
  "email": String,  # E-mail (opcional)
  "phone": String,  # Telefone (opcional)
  "is_active": Boolean,  # Status ativo/inativo
  "max_capacity": Integer,  # Capacidade máxima de recebimentos por horário (padrão: 1)
  "cep": String,  # CEP (opcional)
  "street": String,  # Rua (opcional)
  "number": String,  # Número (opcional)
  "neighborhood": String,  # Bairro (opcional)
  "reference": String,  # Referência (opcional)
  "created_at": DateTime,
  "updated_at": DateTime
}
```

### Agendamento (Appointment)
```python
{
  "id": Integer,
  "appointment_number": String,  # Número único do agendamento (formato: AG-YYYYMMDD-XXXX)
  "supplier_id": Integer,  # Fornecedor (obrigatório)
  "plant_id": Integer,  # Planta de destino (obrigatório)
  "date": Date,  # Data do agendamento
  "time": Time,  # Horário inicial
  "time_end": Time,  # Horário final (opcional para compatibilidade)
  "purchase_order": String,  # Número do PO (obrigatório)
  "truck_plate": String,  # Placa do caminhão (obrigatório)
  "driver_name": String,  # Nome do motorista (obrigatório)
  "status": String,  # "scheduled", "checked_in", "checked_out", "rescheduled", "cancelled"
  "motivo_reagendamento": String,  # Motivo do reagendamento (nullable, obrigatório ao reagendar)
  "check_in_time": DateTime,  # Timestamp do check-in (nullable)
  "check_out_time": DateTime,  # Timestamp do check-out (nullable)
  "created_at": DateTime,
  "updated_at": DateTime
}
```

### Permissão (Permission)
```python
{
  "id": Integer,
  "role": String,  # "admin", "supplier" ou "plant"
  "function_id": String,  # ID da funcionalidade (ex: "create_appointment")
  "permission_type": String,  # "editor", "viewer", "none"
  "created_at": DateTime,
  "updated_at": DateTime
}
```

### Horários de Funcionamento (OperatingHours)
```python
{
  "id": Integer,
  "plant_id": Integer,  # ID da planta (nullable para horários globais)
  "day_of_week": Integer,  # 0=Domingo, 1=Segunda, ..., 6=Sábado (nullable para todos os dias)
  "start_time": Time,  # Horário de início
  "end_time": Time,  # Horário de término
  "created_at": DateTime,
  "updated_at": DateTime
}
```

## Fluxo de Trabalho

### 1. Cadastro de Fornecedor (Administrador)
1. Administrador acessa aba "Configurações" → Botão "Fornecedores"
2. Clica em "Novo Fornecedor" (abre modal)
3. Preenche CNPJ, descrição e email
4. Sistema cria fornecedor e usuário automaticamente
5. Senha temporária é gerada e exibida na tela de sucesso

### 2. Cadastro de Planta (Administrador)
1. Administrador acessa aba "Configurações" → Botão "Plantas"
2. Clica em "Nova Planta" (abre modal)
3. Preenche nome, código e email (obrigatórios)
4. Opcionalmente preenche telefone e endereço completo
5. Sistema cria planta e usuário automaticamente
6. Senha temporária é gerada e exibida na tela de sucesso

### 3. Criação de Agendamento (Fornecedor)
1. Fornecedor faz login no sistema
2. Visualiza calendário diário
3. Clica em "Novo Agendamento"
4. Seleciona a planta de destino
5. Preenche dados do agendamento (data, horário inicial, horário final, PO, placa, motorista)
6. Sistema valida disponibilidade e capacidade máxima da planta selecionada
7. Sistema valida horários de funcionamento da planta
8. Sistema gera número único do agendamento (formato: AG-YYYYMMDD-XXXX)
9. Sistema salva agendamento com status "scheduled"

### 4. Reagendamento (Fornecedor/Administrador)
1. Usuário edita agendamento existente
2. Altera data ou horário (inicial/final)
3. Sistema detecta alteração e exige motivo obrigatório
4. Modal de motivo é exibida
5. Usuário preenche motivo do reagendamento
6. Sistema salva com status "rescheduled" e motivo anexado

### 5. Processo de Check-in/Check-out (Administrador/Planta)
1. Administrador ou usuário da Planta visualiza agendamentos do dia
2. Quando veículo chega, clica em "Check-in"
3. Sistema valida status (deve ser "scheduled" ou "rescheduled")
4. Sistema gera payload JSON para integração com ERP
5. Status muda para "checked_in"
6. Timestamp de check-in é registrado
7. Após descarga completa, clica em "Check-out"
8. Status muda para "checked_out"
9. Timestamp de check-out é registrado
10. Agendamento é marcado como finalizado (não pode mais ser editado ou excluído)

## Segurança

### Autenticação e Autorização
- **JWT Tokens**: Autenticação stateless e segura
- **Controle de acesso**: Fornecedores só acessam próprios dados
- **Validação de entrada**: Sanitização de todos os inputs
- **Senhas criptografadas**: Hash bcrypt para senhas
- **Permissões granulares**: Sistema de permissões por funcionalidade
- **Multi-tenant**: Isolamento completo de dados por company_id

### Configurações de Segurança

#### Variáveis de Ambiente Obrigatórias (Produção)
- **SECRET_KEY** ou **JWT_SECRET_KEY**: Chave secreta para JWT (OBRIGATÓRIO em produção)
  - Mínimo 32 caracteres, gerar com `python -c "import secrets; print(secrets.token_urlsafe(32))"`
  - O sistema bloqueia inicialização se não definida em produção
  
#### Configurações Recomendadas
- **CORS_ORIGINS**: Origens permitidas para CORS (em produção, use origens específicas)
  - Exemplo: `CORS_ORIGINS=https://portal.example.com,https://www.example.com`
- **FLASK_ENV** ou **ENVIRONMENT**: Definir como `production` em produção
- **DEBUG**: Deve ser `False` ou não definido em produção (sistema detecta automaticamente)

> **Importante**: Consulte `docs/SEGURANCA.md` para guia completo de configuração de segurança.

### Proteções Implementadas
- **Debug mode**: Desabilitado automaticamente em produção
- **CORS**: Configurável via variável de ambiente (padrão: `*` apenas em desenvolvimento)
- **Logs seguros**: Redução de logs que expõem informações sensíveis em produção
- **Mensagens genéricas**: Erros de login não expõem se email existe ou não
- **SQL Injection**: Protegido via SQLAlchemy ORM

### Validações
- **CNPJ**: Validação de formato e dígitos verificadores
- **Email**: Validação de formato RFC 5322
- **Datas**: Validação de formato e consistência
- **Horários**: Verificação de disponibilidade e capacidade
- **Campos obrigatórios**: Validação de todos os campos requeridos

## Interface do Usuário

### Design System
O sistema utiliza um design moderno e profissional baseado em:

- **Cores**: Paleta azul corporativa com acentos coloridos
- **Tipografia**: Fonte system-ui para legibilidade
- **Componentes**: shadcn/ui para consistência
- **Responsividade**: Layout adaptável para desktop e mobile
- **Acessibilidade**: Contraste adequado e navegação por teclado

### Componentes Principais
- **Login**: Formulário centralizado com validação e recuperação de senha
- **Dashboard**: Estatísticas diárias e navegação principal
- **Calendário Diário**: Visualização de agendamentos por dia
- **Formulários**: Criação e edição de dados com máscaras e validações
- **Modais**: Confirmações, alertas e formulários (Fornecedores, Plantas)
- **Drawer**: Visualização detalhada de agendamentos (mobile-friendly)
- **Filtros**: Cards de estatísticas funcionam como filtros interativos
- **Componentes de Input**: TimeInput (horários) e DateInput (datas) customizados

## Instalação e Configuração

### Pré-requisitos
- Python 3.11+
- Node.js 18+
- pnpm ou npm
- Git (opcional, apenas para clonar repositório)

### Backend (Flask)

#### Instalação Manual
```bash
cd portal_wps_backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows
pip install -r requirements.txt
python src/main.py
```

#### Scripts PowerShell (Windows)
```powershell
.\iniciar_backend.ps1   # Inicia apenas o backend
```

**Banco de Dados (PostgreSQL):**
- O sistema utiliza **PostgreSQL** como banco de dados
- Configure a conexão através de variáveis de ambiente (DATABASE_URL ou variáveis individuais)
- A estrutura completa do banco está definida nos modelos em `src/models/` (user.py, company.py, supplier.py, plant.py, appointment.py, etc.)
- O `main.py` inicializa o banco chamando `db.create_all()` que cria todas as tabelas baseado nos modelos importados
- **Pré-requisito**: PostgreSQL instalado e banco de dados criado (`CREATE DATABASE portal_wps;`)
- O script `init_data.py` é **opcional** e serve apenas para popular o banco com dados de teste
- Para criar dados de teste, execute: `python init_data.py` no diretório `portal_wps_backend`
- **Atenção**: O script `init_data.py` apaga todos os dados existentes e recria dados de teste
- Para migrar dados de SQLite para PostgreSQL, use: `python migrate_sqlite_to_postgres.py`

### Frontend (React)

#### Instalação Manual
```bash
cd portal_wps_frontend
npm install  # ou pnpm install
npm run dev  # ou pnpm run dev
```

#### Produção (Firebase Hosting)

- Garanta o arquivo `portal_wps_frontend/.env.production` com a URL do backend (Railway).
- **Importante**: neste projeto, o `VITE_API_URL` já deve incluir `/api`.

Exemplo:
```bash
VITE_API_URL=https://web-production-76a65.up.railway.app/api
```

- O Firebase Hosting publica a pasta `portal_wps_frontend/dist` (ver `firebase.json`).
- Se o Firebase servir código fonte (ex: `/src/main.jsx`) em vez do build do Vite, o navegador pode mostrar:
  - **"Uncaught SyntaxError: Unexpected token 'export'"**
  - Solução: `npm run build` e `firebase deploy --only hosting`.

#### Scripts PowerShell (Windows)
```powershell
.\iniciar_frontend.ps1  # Inicia apenas o frontend
```

### Iniciar Ambos os Servidores

#### Script PowerShell (Windows)
```powershell
.\iniciar_servidores.ps1  # Inicia backend e frontend em janelas separadas
```

### Configuração

#### Portas Padrão
- **Backend**: Porta 5000 (http://localhost:5000)
- **Frontend**: Porta 5173 (http://localhost:5173) - Vite padrão
- **API Base**: `/api`

#### Banco de Dados
- **Tipo**: PostgreSQL
- **Configuração**: Via variáveis de ambiente (DATABASE_URL ou POSTGRES_*)
- **Criação**: As tabelas são criadas automaticamente na primeira execução do `main.py`
- **Estrutura**: Definida nos modelos em `src/models/` (não no main.py)
- **Inicialização**: O `main.py` importa todos os modelos e chama `db.create_all()` para criar todas as tabelas
- **Pré-requisito**: PostgreSQL instalado e banco criado (`CREATE DATABASE portal_wps;`)

#### Variáveis de Ambiente (Desenvolvimento)
Criar arquivo `.env` no diretório `portal_wps_backend/` baseado em `.env.example`:
```bash
# .env (não commitar no git!)
SECRET_KEY=sua-chave-secreta-para-desenvolvimento
FLASK_ENV=development
DEBUG=True
CORS_ORIGINS=*
```

> **Para Produção**: Consulte `docs/SEGURANCA.md` para configuração completa e obrigatória.

## Dados de Teste

> **Nota:** As credenciais abaixo são válidas apenas se o banco de dados foi inicializado com `init_data.py`. Caso contrário, é necessário criar usuários através da interface administrativa.

### Usuário Administrador
- **Email**: admin@wps.com
- **Senha**: admin123

### Fornecedores Pré-cadastrados
1. **Fornecedor ABC Ltda**
   - Email: fornecedor1@abc.com
   - Senha: fornecedor123
   - CNPJ: 12.345.678/0001-90

2. **Transportadora XYZ S.A.**
   - Email: fornecedor2@xyz.com
   - Senha: fornecedor123
   - CNPJ: 98.765.432/0001-10

### Plantas Pré-cadastradas
1. **Planta Central**
   - Email: portaria.central@wps.com
   - Senha: portaria123
   - Código: PLT-001

2. **Planta Norte**
   - Email: portaria.norte@wps.com
   - Senha: portaria123
   - Código: PLT-002

## Funcionalidades Implementadas Recentemente

### Sistema de Reagendamento
- **Detecção automática**: Sistema detecta alterações em data/horário
- **Motivo obrigatório**: Modal exige motivo ao reagendar
- **Status automático**: Status muda para "rescheduled" automaticamente
- **Histórico**: Motivo é armazenado e exibido no agendamento

### Sistema de Números de Agendamento
- **Geração automática**: Número único gerado automaticamente para cada agendamento
- **Formato**: AG-YYYYMMDD-XXXX (ex: AG-20260114-0001)
- **Sequencial**: Números sequenciais por data
- **Único**: Garantia de unicidade no sistema

### Gestão de Plantas
- **Cadastro completo**: Sistema de cadastro de plantas com dados completos
- **Usuários vinculados**: Criação automática de usuários para plantas
- **Gerenciamento**: Ativação/desativação de plantas

### Melhorias de UI/UX
- **Visão diária**: Dashboard e agenda trabalham com visão diária
- **Filtros interativos**: Cards de estatísticas funcionam como filtros
- **Inputs customizados**: TimeInput e DateInput com máscaras e validações
- **Modais**: Formulários convertidos para modais (melhor UX)
- **Sistema de Permissões**: Interface completa para configuração de permissões por perfil
- **Validações em Tempo Real**: Feedback imediato ao usuário em formulários

## Melhorias Futuras

### Funcionalidades Planejadas
- **Notificações**: Sistema de alertas por email/SMS
- **Relatórios**: Dashboards analíticos e exportação (PDF, Excel, CSV)
- **Mobile App**: Aplicativo nativo para fornecedores
- **Integração**: APIs para sistemas de terceiros
- **Auditoria**: Log completo de ações do sistema (quem, quando, o quê)
- **Configuração de Horários por Planta**: ✅ Implementado - Horários de funcionamento específicos por planta
- **Sistema de Permissões Granulares**: ✅ Implementado - Perfis de Acesso com controle por funcionalidade

### Otimizações Técnicas
- **Cache**: Redis para performance (planejado)
- **Banco**: PostgreSQL já implementado ✅
- **Deploy**: Containerização com Docker (planejado)
- **Monitoramento**: Logs estruturados e métricas (parcialmente implementado)
- **Backup**: Estratégia de backup automatizado (planejado)
- **Rate Limiting**: Proteção contra abuso de API (planejado)
- **HTTPS**: Certificado SSL para produção (obrigatório)

## Suporte e Manutenção

### Logs do Sistema
O sistema registra todas as operações importantes:
- Inicialização do banco de dados
- Autenticações e tentativas de login (sem expor detalhes sensíveis)
- Criação e modificação de agendamentos
- Check-ins e check-outs realizados
- Erros e exceções do sistema

> **Nota de Segurança:** O sistema foi otimizado para remover logs desnecessários que expunham informações sensíveis (emails, CNPJs, senhas, tokens, dados completos de objetos). Em produção, logs são reduzidos e apenas informações críticas para debug e monitoramento são mantidos. Logs detalhados de permissões e operações sensíveis são exibidos apenas em modo desenvolvimento.

### Monitoramento
- **Performance**: Tempo de resposta das APIs
- **Disponibilidade**: Uptime do sistema
- **Uso**: Estatísticas de utilização
- **Erros**: Tracking de bugs e falhas

## Referências

Para mais informações, consulte:
- **Guia de Instalação**: `docs/GUIA_INSTALACAO.md` - Passo a passo de instalação
- **Guia de Segurança**: `docs/SEGURANCA.md` - Configurações de segurança e variáveis de ambiente
- **Modelagem do Banco**: `docs/MODELAGEM_BANCO_DE_DADOS.md` - Estrutura completa do banco
- **Multi-tenant**: `docs/MULTI_TENANT_IMPLEMENTATION.md` - Implementação multi-tenant
- **README Principal**: `README.md`

## Status do Sistema

### ✅ Sistema Pronto e Funcional

O **Portal WPS** está **100% funcional** e pronto para uso em produção, com todas as funcionalidades implementadas e testadas:

- ✅ Sistema de autenticação JWT completo e seguro
- ✅ Gestão completa de fornecedores, plantas e agendamentos
- ✅ Sistema de check-in/check-out integrado
- ✅ Validações de horários e capacidade
- ✅ Sistema de permissões granulares por perfil
- ✅ Multi-tenant com isolamento completo por company_id
- ✅ Interface responsiva e intuitiva
- ✅ Banco de dados criado automaticamente
- ✅ Configurações de segurança implementadas
- ✅ Logs otimizados para não expor informações sensíveis
- ✅ Navegação temporal corrigida (calendário diário)
- ✅ Documentação completa

### Requisitos para Deploy em Produção

Antes de fazer deploy em produção, certifique-se de:

1. **Variável de Ambiente Obrigatória**: Definir `SECRET_KEY` ou `JWT_SECRET_KEY`
2. **CORS**: Configurar `CORS_ORIGINS` com origens específicas
3. **Ambiente**: Definir `FLASK_ENV=production` ou `ENVIRONMENT=production`
4. **HTTPS**: Configurar certificado SSL (usar proxy reverso como Nginx)
5. **Banco de Dados**: Sistema já utiliza PostgreSQL (configurado via variáveis de ambiente)

> Consulte `docs/SEGURANCA.md` para checklist completo de segurança.

## Conclusão

O **Portal WPS** representa uma solução completa e moderna para gestão de agendamentos logísticos. Com sua arquitetura robusta, interface intuitiva e funcionalidades abrangentes, o sistema atende plenamente aos requisitos de controle de carga, oferecendo:

- **Eficiência operacional** através da automação de processos
- **Controle total** sobre agendamentos e movimentação de veículos
- **Integração seamless** com sistemas ERP existentes (payload JSON no check-in)
- **Experiência de usuário** otimizada para diferentes perfis (admin, fornecedor, planta)
- **Segurança** e confiabilidade em todas as operações
- **Multi-tenant** com isolamento completo de dados por empresa
- **Extensibilidade** facilitada pela arquitetura modular

O sistema está **pronto para uso em ambiente de produção** e pode ser facilmente expandido conforme as necessidades futuras da organização.

---

**Desenvolvido com excelência pela Manus AI**  
*Transformando ideias em soluções tecnológicas de alta qualidade*
