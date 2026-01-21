# Modelagem do Banco de Dados - Portal WPS

**Sistema:** Portal WPS - Sistema de Agendamento de Carga  
**Banco de Dados:** PostgreSQL  
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

O banco de dados do Portal WPS utiliza **PostgreSQL** e é composto por **10 tabelas principais** que gerenciam usuários, fornecedores, plantas, agendamentos, permissões, horários de funcionamento e configurações do sistema.

### Arquitetura Multi-Tenant

O sistema implementa **multi-tenancy** através da tabela `company`, garantindo isolamento completo de dados por empresa. Todas as tabelas principais possuem o campo `company_id` que isola os dados por empresa, permitindo que múltiplas empresas utilizem o mesmo banco de dados sem interferência entre si.

### Tabelas Principais

| Tabela | Descrição | Multi-Tenant |
|--------|-----------|--------------|
| `company` | Empresas (multi-tenant - raiz da hierarquia) | N/A |
| `users` | Usuários do sistema (admin, supplier, plant) | ✅ `company_id` obrigatório |
| `supplier` | Fornecedores cadastrados | ✅ `company_id` obrigatório |
| `plants` | Plantas (locais físicos de entrega) | ✅ `company_id` obrigatório |
| `appointment` | Agendamentos de carga | ✅ `company_id` obrigatório |
| `permissions` | Permissões granulares por role e funcionalidade | ✅ `company_id` obrigatório |
| `operating_hours` | Horários de funcionamento (global ou por planta) | ✅ `company_id` obrigatório |
| `default_schedules` | Configurações de horários padrão (bloqueios semanais) | ❌ Tabela independente |
| `schedule_configs` | Configurações de horários por data específica | ❌ Tabela independente |
| `system_configs` | Configurações gerais do sistema | ✅ `company_id` opcional (NULL = global) |

---

## Diagrama de Entidade-Relacionamento

```
┌─────────────────────┐
│      COMPANY        │
│─────────────────────│
│ PK id               │
│    name             │
│    cnpj (UNIQUE)    │
│    is_active        │
│    created_at       │
│    updated_at       │
└─────────────────────┘
         │
         │ 1:N (Multi-tenant)
         │
         │
┌─────────────────────┐
│       USER          │
│─────────────────────│
│ PK id               │
│    email            │
│    password_hash    │
│    role             │
│    is_active        │
│ FK company_id ──────┼──┐
│ FK supplier_id ─────┼──┼──┐
│ FK plant_id ────────┼──┼──┼──┐
│ FK created_by_admin_id │  │  │  │
│    created_at       │  │  │  │
│    updated_at       │  │  │  │
└─────────────────────┘  │  │  │  │
                         │  │  │  │
                         │  │  │  │
┌─────────────────────┐  │  │  │  │
│      SUPPLIER       │  │  │  │  │
│─────────────────────│  │  │  │  │
│ PK id               │◄─┘  │  │  │
│    cnpj             │     │  │  │
│    description      │     │  │  │
│    is_active        │     │  │  │
│    is_deleted       │     │  │  │
│ FK company_id ──────┼─────┼──┘  │
│ FK created_by_admin_id   │     │
│    created_at       │     │     │
│    updated_at       │     │     │
└─────────────────────┘     │     │
                            │     │
                            │     │
┌─────────────────────┐     │     │
│       PLANTS        │     │     │
│─────────────────────│     │     │
│ PK id               │◄────┘     │
│    name             │           │
│    code             │           │
│    cnpj             │           │
│    email            │           │
│    phone            │           │
│    is_active        │           │
│    max_capacity     │           │
│    cep              │           │
│    street           │           │
│    number           │           │
│    neighborhood     │           │
│    reference        │           │
│ FK company_id ──────┼───────────┘
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
│ FK company_id ──────┼──┐
│ FK supplier_id ─────┼──┼──┐
│ FK plant_id ────────┼──┼──┼──┐
│    created_at       │  │  │  │
│    updated_at       │  │  │  │
└─────────────────────┘  │  │  │  │
                         │  │  │  │
                         │  │  │  │ 1:N
                         │  │  │  │
                         │  │  │  └─── SUPPLIER
                         │  │  │
                         │  │  │ 1:N
                         │  │  │
                         │  │  └─── PLANTS
                         │  │
                         │  │ 1:N (Multi-tenant)
                         │  │
                         │  └─── COMPANY
                         │
                         │ 1:N (Multi-tenant)
                         │
                         └─── COMPANY

┌─────────────────────┐
│    PERMISSIONS      │
│─────────────────────│
│ PK id               │
│ FK company_id ──────┼──┐
│    role             │  │
│    function_id      │  │
│    permission_type  │  │
│    created_at       │  │
│    updated_at       │  │
│                     │  │
│ UNIQUE (company_id, │  │
│         role,       │  │
│         function_id)│  │
└─────────────────────┘  │
                         │
                         │ 1:N (Multi-tenant)
                         │
                         └─── COMPANY

┌─────────────────────┐
│  OPERATING_HOURS    │
│─────────────────────│
│ PK id               │
│ FK company_id ──────┼──┐
│ FK plant_id ────────┼──┼──┐
│    schedule_type    │  │  │
│    day_of_week      │  │  │
│    operating_start  │  │  │
│    operating_end    │  │  │
│    is_active        │  │  │
│    created_at       │  │  │
│    updated_at       │  │  │
└─────────────────────┘  │  │
                         │  │
                         │  │ N:1
                         │  │
                         │  └─── PLANTS
                         │
                         │ 1:N (Multi-tenant)
                         │
                         └─── COMPANY

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
│    key              │
│    value            │
│    description      │
│ FK company_id ──────┼──┐
│    created_at       │  │
│    updated_at       │  │
│                     │  │
│ UNIQUE (key,        │  │
│         company_id) │  │
└─────────────────────┘  │
                         │
                         │ N:1 (Multi-tenant)
                         │ (company_id NULL = global)
                         │
                         └─── COMPANY (nullable)
```

---

## Tabelas do Sistema

### 1. Tabela: `company`

**Descrição:** Armazena as empresas (multi-tenant - raiz da hierarquia). Todas as outras tabelas são isoladas por `company_id`.

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único da empresa |
| `name` | VARCHAR(200) | NOT NULL | Nome da empresa |
| `cnpj` | VARCHAR(18) | UNIQUE, NOT NULL | CNPJ da empresa (chave única) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/inativo da empresa |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `cnpj`

**Relacionamentos:**
- 1:N com `users` (uma empresa pode ter múltiplos usuários)
- 1:N com `supplier` (uma empresa pode ter múltiplos fornecedores)
- 1:N com `plants` (uma empresa pode ter múltiplas plantas)
- 1:N com `appointment` (uma empresa pode ter múltiplos agendamentos)
- 1:N com `permissions` (uma empresa pode ter múltiplas permissões configuradas)
- 1:N com `operating_hours` (uma empresa pode ter múltiplos horários configurados)
- 1:N com `system_configs` (uma empresa pode ter múltiplas configurações, ou NULL para global)

---

### 2. Tabela: `users`

**Descrição:** Armazena os usuários do sistema com diferentes perfis (administrador, fornecedor, planta).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único do usuário |
| `email` | VARCHAR(120) | NOT NULL | Email do usuário (único por company) |
| `password_hash` | VARCHAR(255) | NOT NULL | Hash da senha (bcrypt) |
| `role` | VARCHAR(20) | NOT NULL | Perfil do usuário: 'admin', 'supplier' ou 'plant' |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/bloqueado do usuário |
| `company_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência à empresa (multi-tenant - obrigatório) |
| `supplier_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência ao fornecedor (apenas para role='supplier') |
| `plant_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à planta (apenas para role='plant') |
| `created_by_admin_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência ao admin que criou este usuário (para rastreamento) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `(email, company_id)` - Constraint composta para garantir email único por empresa
- FOREIGN KEY: `company_id` → `company.id`
- FOREIGN KEY: `supplier_id` → `supplier.id`
- FOREIGN KEY: `plant_id` → `plants.id`
- FOREIGN KEY: `created_by_admin_id` → `users.id`

---

### 3. Tabela: `supplier`

**Descrição:** Armazena os fornecedores cadastrados no sistema (isolados por empresa).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único do fornecedor |
| `cnpj` | VARCHAR(18) | NOT NULL | CNPJ do fornecedor (único por company) |
| `description` | VARCHAR(200) | NOT NULL | Nome/descrição do fornecedor |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/bloqueado |
| `is_deleted` | BOOLEAN | NOT NULL, DEFAULT FALSE | Flag de soft delete |
| `company_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência à empresa (multi-tenant - obrigatório) |
| `created_by_admin_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência ao admin que criou o fornecedor |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `(cnpj, company_id)` - Constraint composta para garantir CNPJ único por empresa
- FOREIGN KEY: `company_id` → `company.id`
- FOREIGN KEY: `created_by_admin_id` → `users.id`

**Relacionamentos:**
- 1:N com `users` (um fornecedor pode ter múltiplos usuários)
- 1:N com `appointment` (um fornecedor pode ter múltiplos agendamentos)

---

### 4. Tabela: `plants`

**Descrição:** Armazena as plantas (locais físicos de entrega/coleta) isoladas por empresa.

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
| `company_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência à empresa (multi-tenant - obrigatório) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `company_id` → `company.id`

**Relacionamentos:**
- 1:N com `users` (uma planta pode ter múltiplos usuários)
- 1:N com `appointment` (uma planta pode ter múltiplos agendamentos)
- 1:N com `operating_hours` (uma planta pode ter múltiplos horários de funcionamento)

---

### 5. Tabela: `appointment`

**Descrição:** Armazena os agendamentos de carga entre fornecedores e plantas (isolados por empresa).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único do agendamento |
| `appointment_number` | VARCHAR(50) | NULLABLE | Número único do agendamento (único por company, formato: AG-YYYYMMDD-XXXX) |
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
| `company_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência à empresa (multi-tenant - obrigatório) |
| `supplier_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência ao fornecedor |
| `plant_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à planta (pode ser NULL para compatibilidade) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `(appointment_number, company_id)` - Constraint composta para garantir número único por empresa
- FOREIGN KEY: `company_id` → `company.id`
- FOREIGN KEY: `supplier_id` → `supplier.id`
- FOREIGN KEY: `plant_id` → `plants.id`

**Relacionamentos:**
- N:1 com `supplier` (múltiplos agendamentos pertencem a um fornecedor)
- N:1 com `plants` (múltiplos agendamentos pertencem a uma planta)

---

### 6. Tabela: `permissions`

**Descrição:** Armazena as permissões granulares por role e funcionalidade (isoladas por empresa).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único da permissão |
| `company_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência à empresa (multi-tenant - obrigatório) |
| `role` | VARCHAR(20) | NOT NULL | Perfil: 'admin', 'supplier' ou 'plant' |
| `function_id` | VARCHAR(100) | NOT NULL | ID da funcionalidade (ex: 'create_appointment') |
| `permission_type` | VARCHAR(20) | NOT NULL | Tipo: 'editor', 'viewer' ou 'none' |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `(company_id, role, function_id)` - Constraint composta para garantir unicidade por empresa
- FOREIGN KEY: `company_id` → `company.id`

**Observações:**
- Cada combinação de `company_id`, `role` e `function_id` é única
- Permissões são isoladas por empresa (multi-tenant)

---

### 7. Tabela: `operating_hours`

**Descrição:** Armazena os horários de funcionamento específicos por planta e empresa (multi-tenant).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único |
| `company_id` | INTEGER | FOREIGN KEY, NOT NULL | Referência à empresa (multi-tenant - obrigatório) |
| `plant_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à planta (pode ser NULL para configuração global da empresa) |
| `schedule_type` | VARCHAR(20) | NOT NULL | Tipo: 'weekdays', 'weekend', 'holiday' |
| `day_of_week` | INTEGER | NULLABLE | Dia da semana (5=Sábado, 6=Domingo) ou NULL |
| `operating_start` | TIME | NOT NULL | Horário de início do funcionamento |
| `operating_end` | TIME | NOT NULL | Horário de término do funcionamento |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status ativo/inativo |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `company_id` → `company.id`
- FOREIGN KEY: `plant_id` → `plants.id`

**Relacionamentos:**
- N:1 com `company` (múltiplos horários pertencem a uma empresa)
- N:1 com `plants` (múltiplos horários podem pertencer a uma planta, ou NULL para configuração global da empresa)

---

### 8. Tabela: `default_schedules`

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

### 9. Tabela: `schedule_configs`

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

### 10. Tabela: `system_configs`

**Descrição:** Armazena configurações gerais do sistema (chave-valor) por empresa ou global (multi-tenant).

| Coluna | Tipo | Constraints | Descrição |
|--------|------|-------------|-----------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Identificador único |
| `key` | VARCHAR(100) | NOT NULL | Chave da configuração (ex: 'max_capacity_per_slot') |
| `value` | VARCHAR(255) | NOT NULL | Valor da configuração (armazenado como string) |
| `description` | VARCHAR(500) | NULLABLE | Descrição da configuração |
| `company_id` | INTEGER | FOREIGN KEY, NULLABLE | Referência à empresa (NULL = configuração global, específico = configuração da empresa) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Data de última atualização |

**Índices:**
- PRIMARY KEY: `id`
- UNIQUE: `(key, company_id)` - Constraint composta para garantir chave única por empresa (ou global se NULL)
- FOREIGN KEY: `company_id` → `company.id`

**Observações:**
- Multi-tenant: `company_id` pode ser NULL (configuração global) ou específico de uma empresa
- Configurações específicas da empresa têm prioridade sobre configurações globais
- Usado para configurações como capacidade máxima por horário

---

## Relacionamentos

### Cardinalidades

#### 1. `company` ↔ `user` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplos usuários associados (multi-tenant)
- **Foreign Key:** `user.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (users)
- **Nullable:** `user.company_id` é NOT NULL (obrigatório)

#### 2. `company` ↔ `supplier` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplos fornecedores (multi-tenant)
- **Foreign Key:** `supplier.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (suppliers)
- **Nullable:** `supplier.company_id` é NOT NULL (obrigatório)

#### 3. `company` ↔ `plants` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplas plantas (multi-tenant)
- **Foreign Key:** `plants.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (plants)
- **Nullable:** `plants.company_id` é NOT NULL (obrigatório)

#### 4. `company` ↔ `appointment` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplos agendamentos (multi-tenant)
- **Foreign Key:** `appointment.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (appointments)
- **Nullable:** `appointment.company_id` é NOT NULL (obrigatório)

#### 5. `company` ↔ `permissions` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplas permissões configuradas (multi-tenant)
- **Foreign Key:** `permissions.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (permissions)
- **Nullable:** `permissions.company_id` é NOT NULL (obrigatório)

#### 6. `company` ↔ `operating_hours` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplos horários configurados (multi-tenant)
- **Foreign Key:** `operating_hours.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (operating_hours)
- **Nullable:** `operating_hours.company_id` é NOT NULL (obrigatório)

#### 7. `company` ↔ `system_configs` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma empresa pode ter múltiplas configurações, ou configurações globais (NULL)
- **Foreign Key:** `system_configs.company_id` → `company.id`
- **Cardinalidade:** 1 (company) : N (system_configs)
- **Nullable:** `system_configs.company_id` pode ser NULL (configuração global)

#### 8. `supplier` ↔ `user` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Um fornecedor pode ter múltiplos usuários associados
- **Foreign Key:** `user.supplier_id` → `supplier.id`
- **Cardinalidade:** 1 (supplier) : N (users)
- **Nullable:** `user.supplier_id` pode ser NULL (apenas para role='supplier')

#### 9. `plants` ↔ `user` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma planta pode ter múltiplos usuários associados
- **Foreign Key:** `user.plant_id` → `plants.id`
- **Cardinalidade:** 1 (plant) : N (users)
- **Nullable:** `user.plant_id` pode ser NULL (apenas para role='plant')

#### 10. `supplier` ↔ `appointment` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Um fornecedor pode ter múltiplos agendamentos
- **Foreign Key:** `appointment.supplier_id` → `supplier.id`
- **Cardinalidade:** 1 (supplier) : N (appointments)
- **Nullable:** `appointment.supplier_id` é NOT NULL

#### 11. `plants` ↔ `appointment` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma planta pode receber múltiplos agendamentos
- **Foreign Key:** `appointment.plant_id` → `plants.id`
- **Cardinalidade:** 1 (plant) : N (appointments)
- **Nullable:** `appointment.plant_id` pode ser NULL (compatibilidade com dados antigos)

#### 12. `plants` ↔ `operating_hours` (1:N)
- **Tipo:** Um-para-Muitos
- **Descrição:** Uma planta pode ter múltiplos horários de funcionamento configurados
- **Foreign Key:** `operating_hours.plant_id` → `plants.id`
- **Cardinalidade:** 1 (plant) : N (operating_hours)
- **Nullable:** `operating_hours.plant_id` pode ser NULL (configuração global)

### Diagrama de Relacionamentos Simplificado

```
COMPANY (1) ────────────< (N) USER
          │
          │ (1)
          │
          ├───────────< (N) SUPPLIER
          │                  │
          │                  │ (1)
          │                  │
          │                  └───< (N) APPOINTMENT
          │
          ├───────────< (N) PLANTS
          │                  │
          │                  │ (1)
          │                  │
          │                  ├───< (N) USER
          │                  │
          │                  ├───< (N) APPOINTMENT
          │                  │
          │                  └───< (N) OPERATING_HOURS
          │
          ├───────────< (N) APPOINTMENT
          │
          ├───────────< (N) PERMISSIONS
          │
          ├───────────< (N) OPERATING_HOURS
          │
          └───────────< (N) SYSTEM_CONFIGS
                        (company_id NULL = global)

DEFAULT_SCHEDULES (tabela independente - não multi-tenant)
SCHEDULE_CONFIGS (tabela independente - não multi-tenant)
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
| `user` | `company_id` | `company` | `id` | RESTRICT | CASCADE |
| `user` | `supplier_id` | `supplier` | `id` | RESTRICT | CASCADE |
| `user` | `plant_id` | `plants` | `id` | RESTRICT | CASCADE |
| `user` | `created_by_admin_id` | `user` | `id` | RESTRICT | CASCADE |
| `supplier` | `company_id` | `company` | `id` | RESTRICT | CASCADE |
| `supplier` | `created_by_admin_id` | `user` | `id` | RESTRICT | CASCADE |
| `plants` | `company_id` | `company` | `id` | RESTRICT | CASCADE |
| `appointment` | `company_id` | `company` | `id` | RESTRICT | CASCADE |
| `appointment` | `supplier_id` | `supplier` | `id` | RESTRICT | CASCADE |
| `appointment` | `plant_id` | `plants` | `id` | RESTRICT | CASCADE |
| `permissions` | `company_id` | `company` | `id` | RESTRICT | CASCADE |
| `operating_hours` | `company_id` | `company` | `id` | RESTRICT | CASCADE |
| `operating_hours` | `plant_id` | `plants` | `id` | RESTRICT | CASCADE |
| `system_configs` | `company_id` | `company` | `id` | RESTRICT | CASCADE |

### Unique Constraints

| Tabela | Constraint | Colunas | Descrição |
|--------|------------|---------|-----------|
| `company` | UNIQUE | `cnpj` | CNPJ único por sistema |
| `user` | UNIQUE | `(email, company_id)` | Email único por empresa (multi-tenant) |
| `supplier` | UNIQUE | `(cnpj, company_id)` | CNPJ único por empresa (multi-tenant) |
| `appointment` | UNIQUE | `(appointment_number, company_id)` | Número de agendamento único por empresa (multi-tenant) |
| `permissions` | UNIQUE | `(company_id, role, function_id)` | Permissão única por empresa, role e função (multi-tenant) |
| `system_configs` | UNIQUE | `(key, company_id)` | Configuração única por chave e empresa (multi-tenant, NULL = global) |

### Not Null Constraints

| Tabela | Colunas NOT NULL |
|--------|------------------|
| `company` | `id`, `name`, `cnpj`, `is_active` |
| `user` | `id`, `email`, `password_hash`, `role`, `is_active`, `company_id` |
| `supplier` | `id`, `cnpj`, `description`, `is_active`, `is_deleted`, `company_id` |
| `plants` | `id`, `name`, `cnpj`, `is_active`, `max_capacity`, `company_id` |
| `appointment` | `id`, `date`, `time`, `purchase_order`, `truck_plate`, `driver_name`, `status`, `supplier_id`, `company_id` |
| `permissions` | `id`, `company_id`, `role`, `function_id`, `permission_type` |
| `operating_hours` | `id`, `company_id`, `schedule_type`, `operating_start`, `operating_end`, `is_active` |
| `default_schedules` | `id`, `time`, `is_available` |
| `schedule_configs` | `id`, `date`, `time`, `is_available` |
| `system_configs` | `id`, `key`, `value` |

---

## Observações Importantes

### Soft Delete
- A tabela `supplier` utiliza soft delete através do campo `is_deleted` (não há exclusão física)

### Campos NULL
- **Multi-tenant (obrigatórios):** `company_id` é NOT NULL em todas as tabelas principais, exceto:
  - `system_configs.company_id`: NULL indica configuração global (não específica de uma empresa)
- `user.supplier_id`: NULL para usuários admin e plant
- `user.plant_id`: NULL para usuários admin e supplier
- `user.created_by_admin_id`: NULL se não foi criado por um admin
- `supplier.created_by_admin_id`: NULL se não foi criado por um admin
- `appointment.plant_id`: NULL permitido para compatibilidade com agendamentos antigos
- `appointment.time_end`: NULL permitido para compatibilidade com agendamentos antigos
- `operating_hours.plant_id`: NULL indica configuração global da empresa (não específica de uma planta)

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

#### Multi-Tenancy
1. **Isolamento por empresa:** Todas as tabelas principais (exceto `default_schedules` e `schedule_configs`) são isoladas por `company_id`
2. **Email único por empresa:** Cada usuário deve ter um email único dentro da mesma empresa (diferentes empresas podem ter o mesmo email)
3. **CNPJ único por empresa:** Cada fornecedor deve ter um CNPJ único dentro da mesma empresa
4. **Appointment Number único por empresa:** Cada agendamento deve ter um número único dentro da mesma empresa (formato: AG-YYYYMMDD-XXXX)
5. **Permissões únicas por empresa:** Cada combinação de role e function_id deve ser única dentro da mesma empresa
6. **Configurações por empresa ou global:** `system_configs` pode ter `company_id` NULL (global) ou específico de uma empresa (específica tem prioridade)

#### Outras Validações
7. **Horários por empresa:** `operating_hours` pertence a uma empresa e pode ser global da empresa (`plant_id` NULL) ou específico de uma planta
8. **Rastreamento de criação:** Campos `created_by_admin_id` rastreiam qual admin criou usuários e fornecedores

---

## Nota sobre Criação Automática do Banco

O banco de dados é criado **automaticamente** na primeira execução do `main.py`:
- A estrutura completa está definida nos modelos em `src/models/` (não no `main.py`)
- O `main.py` importa todos os modelos e chama `db.create_all()` para criar todas as tabelas
- Não é necessário criar o banco manualmente ou executar scripts de migração

---

**Documento gerado a partir dos modelos SQLAlchemy**  
**Última atualização:** Janeiro de 2026  
**Versão:** 1.0.0 (Multi-tenant)
