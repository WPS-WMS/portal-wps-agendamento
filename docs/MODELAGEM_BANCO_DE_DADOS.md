# Modelagem do Banco de Dados - Portal WPS

**Sistema:** Portal WPS - Sistema de Agendamento de Carga  
**Banco de Dados:** SQLite  
**Data:** Janeiro de 2026  
**Versão:** 1.0.0

## Índice

1. [Visão Geral](#visão-geral)
2. [Diagrama de Entidade-Relacionamento](#diagrama-de-entidade-relacionamento)
3. [Tabelas do Sistema](#tabelas-do-sistema)
4. [Relacionamentos](#relacionamentos)
5. [Índices e Constraints](#índices-e-constraints)

---

## Visão Geral

O banco de dados do Portal WPS utiliza SQLite e é composto por **9 tabelas principais** que gerenciam usuários, fornecedores, plantas, agendamentos, permissões, horários de funcionamento e configurações do sistema.

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `user` | Usuários do sistema (admin, supplier, plant) |
| `supplier` | Fornecedores cadastrados |
| `plants` | Plantas (locais físicos de entrega) |
| `appointment` | Agendamentos de carga |
| `permissions` | Permissões granulares por role e funcionalidade |
| `operating_hours` | Horários de funcionamento (global ou por planta) |
| `default_schedules` | Configurações de horários padrão (bloqueios semanais) |
| `schedule_configs` | Configurações de horários por data específica |
| `system_configs` | Configurações gerais do sistema |

---

## Diagrama de Entidade-Relacionamento

```
┌─────────────────────┐
│       USER          │
│─────────────────────│
│ PK id               │
│    email (UNIQUE)   │
│    password_hash    │
│    role             │
│    is_active        │
│ FK supplier_id ─────┼──┐
│ FK plant_id ────────┼──┼──┐
│    created_at       │  │  │
│    updated_at       │  │  │
└─────────────────────┘  │  │
                         │  │
                         │  │
┌─────────────────────┐  │  │
│      SUPPLIER       │  │  │
│─────────────────────│  │  │
│ PK id               │◄─┘  │
│    cnpj (UNIQUE)    │     │
│    description      │     │
│    is_active        │     │
│    is_deleted       │     │
│    created_at       │     │
│    updated_at       │     │
└─────────────────────┘     │
                            │
                            │
┌─────────────────────┐     │
│       PLANTS        │     │
│─────────────────────│     │
│ PK id               │◄────┘
│    name             │
│    code             │
│    cnpj             │
│    email            │
│    phone            │
│    is_active        │
│    max_capacity     │
│    cep              │
│    street           │
│    number           │
│    neighborhood     │
│    reference        │
│    created_at       │
│    updated_at       │
└─────────────────────┘
         │
         │ 1:N
         │
         │
┌─────────────────────┐
│    APPOINTMENT      │
│─────────────────────│
│ PK id               │
│    appointment_number│
│         (UNIQUE)    │
│    date             │
│    time             │
│    time_end         │
│    purchase_order   │
│    truck_plate      │
│    driver_name      │
│    status           │
│    motivo_reagendamento│
│    check_in_time    │
│    check_out_time   │
│ FK supplier_id ─────┼──┐
│ FK plant_id ────────┼──┼──┐
│    created_at       │  │  │
│    updated_at       │  │  │
└─────────────────────┘  │  │
                         │  │
                         │  │
                         │  │ 1:N
                         │  │
                         │  └─── SUPPLIER
                         │
                         │ 1:N
                         │
                         └─── PLANTS

┌─────────────────────┐
│    PERMISSIONS      │
│─────────────────────│
│ PK id               │
│    role             │
│    function_id      │
│    permission_type  │
│    created_at       │
│    updated_at       │
│                     │
│ UNIQUE (role,       │
│         function_id)│
└─────────────────────┘

┌─────────────────────┐
│  OPERATING_HOURS    │
│─────────────────────│
│ PK id               │
│ FK plant_id ────────┼──┐
│    schedule_type    │  │
│    day_of_week      │  │
│    operating_start  │  │
│    operating_end    │  │
│    is_active        │  │
│    created_at       │  │
│    updated_at       │  │
│                     │  │
│ UNIQUE (plant_id,   │  │
│         schedule_type,│  │
│         day_of_week)│  │
└─────────────────────┘  │
                         │
                         │ N:1
                         │
                         └─── PLANTS

┌─────────────────────┐
│ DEFAULT_SCHEDULES   │
│─────────────────────│
│ PK id               │
│    day_of_week      │
│    time             │
│    is_available     │
│    reason           │
│    created_at       │
│    updated_at       │
└─────────────────────┘

┌─────────────────────┐
│ SCHEDULE_CONFIGS    │
│─────────────────────│
│ PK id               │
│    date             │
│    time             │
│    is_available     │
│    reason           │
│    created_at       │
│    updated_at       │
└─────────────────────┘

┌─────────────────────┐
│  SYSTEM_CONFIGS     │
│─────────────────────│
│ PK id               │
│    key (UNIQUE)     │
│    value            │
│    description      │
│    created_at       │
│    updated_at       │
└─────────────────────┘
```

---

## Tabelas do Sistema

### 1. Tabela: `user`

**Descrição:** Armazena os usuários do sistema com diferentes perfis (administrador, fornecedor, planta).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único do usuário |
| `email` | VARCHAR(120) | UNIQUE, NOT NULL | Email do usuário (chave única) |
| `password_hash` | VARCHAR(255) | NOT NULL | Hash da senha (bcrypt) |
| `role` | VARCHAR(20) | NOT NULL | Perfil do usuário: 'admin', 'supplier' ou 'plant' |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/bloqueado do usuário |
| `supplier_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência ao fornecedor (apenas para role='supplier') |
| `plant_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à planta (apenas para role='plant') |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `email`
- FOREIGN KEY: `supplier_id` → `supplier.id`
- FOREIGN KEY: `plant_id` → `plants.id`

---

### 2. Tabela: `supplier`

**Descrição:** Armazena os fornecedores cadastrados no sistema.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único do fornecedor |
| `cnpj` | VARCHAR(18) | UNIQUE, NOT NULL | CNPJ do fornecedor (chave única) |
| `description` | VARCHAR(200) | NOT NULL | Nome/descrição do fornecedor |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/bloqueado |
| `is_deleted` | BOOLEAN | NOT NULL, DEFAULT FALSE | Flag de soft delete |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `cnpj`

**Relacionamentos:**
- 1:N com `user` (um fornecedor pode ter múltiplos usuários)
- 1:N com `appointment` (um fornecedor pode ter múltiplos agendamentos)

---

### 3. Tabela: `plants`

**Descrição:** Armazena as plantas (locais físicos de entrega/coleta).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único da planta |
| `name` | VARCHAR(200) | NOT NULL | Nome da planta |
| `code` | VARCHAR(50) | NULLABLE | Código ou identificador da planta |
| `cnpj` | VARCHAR(18) | NOT NULL | CNPJ da planta |
| `email` | VARCHAR(120) | NULLABLE | Email de contato |
| `phone` | VARCHAR(20) | NULLABLE | Telefone de contato |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/inativo |
| `max_capacity` | INTEGER | NOT NULL, DEFAULT 1 | Capacidade máxima de agendamentos por horário |
| `cep` | VARCHAR(10) | NULLABLE | CEP do endereço |
| `street` | VARCHAR(200) | NULLABLE | Rua do endereço |
| `number` | VARCHAR(20) | NULLABLE | Número do endereço |
| `neighborhood` | VARCHAR(100) | NULLABLE | Bairro do endereço |
| `reference` | VARCHAR(200) | NULLABLE | Ponto de referência |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`

**Relacionamentos:**
- 1:N com `user` (uma planta pode ter múltiplos usuários)
- 1:N com `appointment` (uma planta pode ter múltiplos agendamentos)
- 1:N com `operating_hours` (uma planta pode ter múltiplos horários de funcionamento)

---

### 4. Tabela: `appointment`

**Descrição:** Armazena os agendamentos de carga entre fornecedores e plantas.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único do agendamento |
| `appointment_number` | VARCHAR(50) | UNIQUE, NULLABLE | Número único do agendamento (formato: AG-YYYYMMDD-XXXX) |
| `date` | DATE | NOT NULL | Data do agendamento |
| `time` | TIME | NOT NULL | Horário inicial do agendamento |
| `time_end` | TIME | NULLABLE | Horário final do agendamento (opcional) |
| `purchase_order` | VARCHAR(100) | NOT NULL | Número do pedido de compra (PO) |
| `truck_plate` | VARCHAR(20) | NOT NULL | Placa do caminhão |
| `driver_name` | VARCHAR(100) | NOT NULL | Nome do motorista |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'scheduled' | Status: 'scheduled', 'checked_in', 'checked_out', 'rescheduled', 'cancelled' |
| `motivo_reagendamento` | VARCHAR(500) | NULLABLE | Motivo do reagendamento (obrigatório ao reagendar) |
| `check_in_time` | DATETIME | NULLABLE | Timestamp do check-in |
| `check_out_time` | DATETIME | NULLABLE | Timestamp do check-out |
| `supplier_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência ao fornecedor |
| `plant_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à planta (pode ser NULL para compatibilidade) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `appointment_number`
- FOREIGN KEY: `supplier_id` → `supplier.id`
- FOREIGN KEY: `plant_id` → `plants.id`

**Relacionamentos:**
- N:1 com `supplier` (múltiplos agendamentos pertencem a um fornecedor)
- N:1 com `plants` (múltiplos agendamentos pertencem a uma planta)

---

### 5. Tabela: `permissions`

**Descrição:** Armazena as permissões granulares por role e funcionalidade.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único da permissão |
| `role` | VARCHAR(20) | NOT NULL | Perfil: 'admin', 'supplier' ou 'plant' |
| `function_id` | VARCHAR(100) | NOT NULL | ID da funcionalidade (ex: 'create_appointment') |
| `permission_type` | VARCHAR(20) | NOT NULL | Tipo: 'editor', 'viewer' ou 'none' |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `(role, function_id)` - Constraint composta para garantir unicidade

**Observações:**
- Não há relacionamentos com outras tabelas (tabela independente)
- Cada combinação de `role` e `function_id` é única

---

### 6. Tabela: `operating_hours`

**Descrição:** Armazena os horários de funcionamento (globais ou específicos por planta).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único |
| `plant_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à planta (NULL = configuração global) |
| `schedule_type` | VARCHAR(20) | NOT NULL | Tipo: 'weekdays', 'weekend', 'holiday' |
| `day_of_week` | INTEGER | NULLABLE | Dia da semana (5=Sábado, 6=Domingo) ou NULL |
| `operating_start` | TIME | NOT NULL | Horário de início do funcionamento |
| `operating_end` | TIME | NOT NULL | Horário de término do funcionamento |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/inativo |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `plant_id` → `plants.id`
- UNIQUE: `(plant_id, schedule_type, day_of_week)` - Constraint composta

**Relacionamentos:**
- N:1 com `plants` (múltiplos horários podem pertencer a uma planta, ou NULL para globais)

---

### 7. Tabela: `default_schedules`

**Descrição:** Armazena configurações de horários padrão (bloqueios semanais).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único |
| `day_of_week` | INTEGER | NULLABLE | Dia da semana: 0=Domingo, 1=Segunda, ..., 6=Sábado (NULL = todos os dias) |
| `time` | TIME | NOT NULL | Horário específico |
| `is_available` | BOOLEAN | NOT NULL, DEFAULT TRUE | Se está disponível para agendamento |
| `reason` | VARCHAR(200) | NULLABLE | Motivo da indisponibilidade |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`

**Observações:**
- Tabela independente (sem relacionamentos com outras tabelas)
- Usada para configurações globais de bloqueio de horários

---

### 8. Tabela: `schedule_configs`

**Descrição:** Armazena configurações de horários por data específica (bloqueios pontuais).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único |
| `date` | DATE | NOT NULL | Data específica |
| `time` | TIME | NOT NULL | Horário específico |
| `is_available` | BOOLEAN | NOT NULL, DEFAULT TRUE | Se está disponível para agendamento |
| `reason` | VARCHAR(200) | NULLABLE | Motivo da indisponibilidade (ex: "Intervalo de almoço") |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`

**Observações:**
- Tabela independente (sem relacionamentos com outras tabelas)
- Usada para bloqueios pontuais em datas específicas

---

### 9. Tabela: `system_configs`

**Descrição:** Armazena configurações gerais do sistema (chave-valor).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único |
| `key` | VARCHAR(100) | UNIQUE, NOT NULL | Chave da configuração (ex: 'max_capacity_per_slot') |
| `value` | VARCHAR(255) | NOT NULL | Valor da configuração (armazenado como string) |
| `description` | VARCHAR(500) | NULLABLE | Descrição da configuração |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `key`

**Observações:**
- Tabela independente (sem relacionamentos com outras tabelas)
- Usada para configurações globais do sistema

---

## Relacionamentos

### Cardinalidades

#### 1. `supplier` ↔ `user` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Um fornecedor pode ter múltiplos usuários associados
- **Foreign Key:** `user.supplier_id` → `supplier.id`
- **Cardinalidade:** 1 (supplier) : N (users)
- **Nullable:** `user.supplier_id` pode ser NULL (apenas para role='supplier')

#### 2. `plants` ↔ `user` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma planta pode ter múltiplos usuários associados
- **Foreign Key:** `user.plant_id` → `plants.id`
- **Cardinalidade:** 1 (plant) : N (users)
- **Nullable:** `user.plant_id` pode ser NULL (apenas para role='plant')

#### 3. `supplier` ↔ `appointment` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Um fornecedor pode ter múltiplos agendamentos
- **Foreign Key:** `appointment.supplier_id` → `supplier.id`
- **Cardinalidade:** 1 (supplier) : N (appointments)
- **Nullable:** `appointment.supplier_id` é NOT NULL

#### 4. `plants` ↔ `appointment` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma planta pode receber múltiplos agendamentos
- **Foreign Key:** `appointment.plant_id` → `plants.id`
- **Cardinalidade:** 1 (plant) : N (appointments)
- **Nullable:** `appointment.plant_id` pode ser NULL (compatibilidade com dados antigos)

#### 5. `plants` ↔ `operating_hours` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma planta pode ter múltiplos horários de funcionamento configurados
- **Foreign Key:** `operating_hours.plant_id` → `plants.id`
- **Cardinalidade:** 1 (plant) : N (operating_hours)
- **Nullable:** `operating_hours.plant_id` pode ser NULL (configuração global)

### Diagrama de Relacionamentos Simplificado

```
SUPPLIER (1) ────────< (N) USER
              │
              │ (1)
              │
              └───────────< (N) APPOINTMENT

PLANTS (1) ─────────< (N) USER
          │
          │ (1)
          │
          ├───────────< (N) APPOINTMENT
          │
          └───────────< (N) OPERATING_HOURS

PERMISSIONS (tabela independente)
DEFAULT_SCHEDULES (tabela independente)
SCHEDULE_CONFIGS (tabela independente)
SYSTEM_CONFIGS (tabela independente)
```

---

## Índices e Constraints

### Primary Keys (PK)

| Tabela | Coluna | Tipo |
|--------|--------|------|
| `user` | `id` | INTEGER AUTO INCREMENT |
| `supplier` | `id` | INTEGER AUTO INCREMENT |
| `plants` | `id` | INTEGER AUTO INCREMENT |
| `appointment` | `id` | INTEGER AUTO INCREMENT |
| `permissions` | `id` | INTEGER AUTO INCREMENT |
| `operating_hours` | `id` | INTEGER AUTO INCREMENT |
| `default_schedules` | `id` | INTEGER AUTO INCREMENT |
| `schedule_configs` | `id` | INTEGER AUTO INCREMENT |
| `system_configs` | `id` | INTEGER AUTO INCREMENT |

### Foreign Keys (FK)

| Tabela | Coluna FK | Tabela Referenciada | Coluna Referenciada | ON DELETE | ON UPDATE |
|--------|-----------|---------------------|---------------------|-----------|-----------|
| `user` | `supplier_id` | `supplier` | `id` | RESTRICT | CASCADE |
| `user` | `plant_id` | `plants` | `id` | RESTRICT | CASCADE |
| `appointment` | `supplier_id` | `supplier` | `id` | RESTRICT | CASCADE |
| `appointment` | `plant_id` | `plants` | `id` | RESTRICT | CASCADE |
| `operating_hours` | `plant_id` | `plants` | `id` | RESTRICT | CASCADE |

### Unique Constraints

| Tabela | Constraint | Colunas |
|--------|------------|---------|
| `user` | UNIQUE | `email` |
| `supplier` | UNIQUE | `cnpj` |
| `appointment` | UNIQUE | `appointment_number` |
| `permissions` | UNIQUE | `(role, function_id)` |
| `operating_hours` | UNIQUE | `(plant_id, schedule_type, day_of_week)` |
| `system_configs` | UNIQUE | `key` |

### Not Null Constraints

| Tabela | Colunas NOT NULL |
|--------|------------------|
| `user` | `id`, `email`, `password_hash`, `role`, `is_active` |
| `supplier` | `id`, `cnpj`, `description`, `is_active`, `is_deleted` |
| `plants` | `id`, `name`, `cnpj`, `is_active`, `max_capacity` |
| `appointment` | `id`, `date`, `time`, `purchase_order`, `truck_plate`, `driver_name`, `status`, `supplier_id` |
| `permissions` | `id`, `role`, `function_id`, `permission_type` |
| `operating_hours` | `id`, `schedule_type`, `operating_start`, `operating_end`, `is_active` |
| `default_schedules` | `id`, `time`, `is_available` |
| `schedule_configs` | `id`, `date`, `time`, `is_available` |
| `system_configs` | `id`, `key`, `value` |

---

## Observações Importantes

### Soft Delete
- A tabela `supplier` utiliza soft delete através do campo `is_deleted` (não há exclusão física)

### Campos NULL
- `user.supplier_id`: NULL para usuários admin e plant
- `user.plant_id`: NULL para usuários admin e supplier
- `appointment.plant_id`: NULL permitido para compatibilidade com agendamentos antigos
- `appointment.time_end`: NULL permitido para compatibilidade com agendamentos antigos
- `operating_hours.plant_id`: NULL indica configuração global

### Valores Padrão
- `user.is_active`: TRUE
- `supplier.is_active`: TRUE
- `supplier.is_deleted`: FALSE
- `plants.is_active`: TRUE
- `plants.max_capacity`: 1
- `appointment.status`: 'scheduled'
- `permissions.permission_type`: 'none' (padrão quando não configurado)
- `operating_hours.is_active`: TRUE
- `default_schedules.is_available`: TRUE
- `schedule_configs.is_available`: TRUE

### Validações de Negócio
1. **Email único:** Cada usuário deve ter um email único no sistema
2. **CNPJ único:** Cada fornecedor deve ter um CNPJ único
3. **Appointment Number único:** Cada agendamento deve ter um número único (formato: AG-YYYYMMDD-XXXX)
4. **Permissões únicas:** Cada combinação de role e function_id deve ser única
5. **Horários únicos:** Cada combinação de plant_id, schedule_type e day_of_week deve ser única em `operating_hours`
6. **Configuração única:** Cada chave deve ser única em `system_configs`

---

**Documento gerado automaticamente a partir dos modelos SQLAlchemy**  
**Última atualização:** Janeiro de 2026
