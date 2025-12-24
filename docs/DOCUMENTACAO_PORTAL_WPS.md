# Portal WPS - Sistema de Agendamento de Carga

**Desenvolvido por:** Manus AI  
**Data:** 29 de Setembro de 2025  
**Versão:** 1.0.0

## Visão Geral

O **Portal WPS** é um sistema completo de agendamento logístico desenvolvido para facilitar a gestão de cargas entre fornecedores e clientes. O sistema oferece duas visões distintas: uma para administradores (clientes) e outra para fornecedores, proporcionando controle total sobre o processo de agendamento, check-in e check-out de veículos.

## Arquitetura do Sistema

### Tecnologias Utilizadas

| Componente | Tecnologia | Versão |
|------------|------------|---------|
| **Backend** | Flask (Python) | 3.11.0 |
| **Frontend** | React + Vite | 18.x |
| **Banco de Dados** | SQLite | 3.x |
| **Autenticação** | JWT (JSON Web Tokens) | - |
| **UI Framework** | Tailwind CSS + shadcn/ui | - |
| **Ícones** | Lucide React | - |

### Estrutura do Projeto

```
portal-wps-agendamento/
├── portal_wps_backend/          # Aplicação Flask
│   ├── src/
│   │   ├── main.py             # Aplicação principal
│   │   ├── models/             # Modelos de dados
│   │   │   ├── user.py         # Modelo de usuário
│   │   │   ├── supplier.py     # Modelo de fornecedor
│   │   │   ├── appointment.py  # Modelo de agendamento
│   │   │   ├── plant.py        # Modelo de planta
│   │   │   ├── system_config.py # Configurações do sistema
│   │   │   ├── schedule_config.py # Configurações de horários
│   │   │   └── default_schedule.py # Horários padrão
│   │   ├── routes/             # Rotas da API
│   │   │   ├── auth.py         # Autenticação
│   │   │   ├── admin.py        # Rotas administrativas
│   │   │   ├── supplier.py     # Rotas do fornecedor
│   │   │   └── user.py         # Rotas de usuário
│   │   ├── utils/              # Utilitários
│   │   │   └── helpers.py      # Funções auxiliares
│   │   └── database/           # Banco de dados SQLite
│   │       └── app.db          # Arquivo do banco
│   ├── venv/                   # Ambiente virtual Python
│   ├── requirements.txt        # Dependências Python
│   └── init_data.py           # Script de dados iniciais
└── portal_wps_frontend/         # Aplicação React
    ├── src/
    │   ├── components/         # Componentes React
    │   │   └── ui/             # Componentes UI (shadcn/ui)
    │   ├── lib/                # Utilitários e API
    │   │   ├── api.js          # Cliente API
    │   │   ├── utils.js        # Funções utilitárias
    │   │   ├── constants.js   # Constantes do sistema
    │   │   └── formatters.js  # Formatadores de dados
    │   ├── hooks/              # React Hooks customizados
    │   └── App.jsx             # Componente principal
    └── package.json            # Dependências Node.js
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

#### Integração ERP
Quando um check-in é realizado, o sistema gera automaticamente um **payload JSON** para integração com sistemas ERP externos:

```json
{
  "appointment_id": 1,
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
- **Validação de disponibilidade**: Verificação automática de horários disponíveis
- **Reagendamento**: Sistema de reagendamento com motivo obrigatório ao alterar data/horário

#### Campos do Agendamento
- **Data**: Seleção de data (formato DD/MM/AAAA com máscara)
- **Horário Inicial**: Seleção de horário (formato HH:mm, intervalos de 30 minutos)
- **Horário Final**: Seleção de horário final (formato HH:mm, intervalos de 30 minutos)
- **Pedido de Compra**: Número do PO (obrigatório)
- **Placa do Caminhão**: Identificação do veículo (obrigatório)
- **Nome do Motorista**: Responsável pela entrega (obrigatório)
- **Motivo do Reagendamento**: Campo obrigatório quando data/horário são alterados

## API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/login` | Autenticação de usuário |
| POST | `/api/forgot-password` | Recuperação de senha (mensagem genérica) |

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

### Fornecedor
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/supplier/appointments` | Listar agendamentos próprios |
| POST | `/api/supplier/appointments` | Criar agendamento |
| PUT | `/api/supplier/appointments/{id}` | Editar agendamento próprio |
| DELETE | `/api/supplier/appointments/{id}` | Cancelar agendamento |

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
  "name": String,  # Nome da planta
  "code": String,  # Código ou identificador
  "email": String,  # E-mail
  "phone": String,  # Telefone (opcional)
  "is_active": Boolean,  # Status ativo/inativo
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
  "supplier_id": Integer,
  "date": Date,
  "time": Time,  # Horário inicial
  "time_end": Time,  # Horário final (nullable, para intervalos)
  "purchase_order": String,
  "truck_plate": String,
  "driver_name": String,
  "status": String,  # "scheduled", "checked_in", "checked_out", "rescheduled", "cancelled"
  "motivo_reagendamento": String,  # Motivo do reagendamento (nullable)
  "check_in_time": DateTime,  # Timestamp do check-in
  "check_out_time": DateTime,  # Timestamp do check-out
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
4. Preenche dados do agendamento (data, horário inicial, horário final, PO, placa, motorista)
5. Sistema valida disponibilidade e capacidade máxima
6. Sistema salva agendamento

### 4. Reagendamento (Fornecedor/Administrador)
1. Usuário edita agendamento existente
2. Altera data ou horário (inicial/final)
3. Sistema detecta alteração e exige motivo obrigatório
4. Modal de motivo é exibida
5. Usuário preenche motivo do reagendamento
6. Sistema salva com status "rescheduled" e motivo anexado

### 5. Processo de Check-in/Check-out (Administrador)
1. Administrador visualiza agendamentos do dia
2. Quando veículo chega, clica em "Check-in"
3. Sistema valida status (deve ser "scheduled" ou "rescheduled")
4. Sistema gera payload para ERP
5. Status muda para "checked_in"
6. Após descarga, clica em "Check-out"
7. Status muda para "checked_out"
8. Agendamento é marcado como finalizado

## Segurança

### Autenticação e Autorização
- **JWT Tokens**: Autenticação stateless e segura
- **Controle de acesso**: Fornecedores só acessam próprios dados
- **Validação de entrada**: Sanitização de todos os inputs
- **Senhas criptografadas**: Hash bcrypt para senhas

### Validações
- **CNPJ**: Validação de formato e dígitos verificadores
- **Email**: Validação de formato RFC 5322
- **Datas**: Validação de formato e consistência
- **Horários**: Verificação de disponibilidade

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

### Backend (Flask)
```bash
cd portal_wps_backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python src/main.py
```

### Frontend (React)
```bash
cd portal_wps_frontend
pnpm install
pnpm run dev
```

### Configuração
- **Backend**: Porta 5000 (http://localhost:5000)
- **Frontend**: Porta 5173 (http://localhost:5173) - Vite padrão
- **Banco**: SQLite (`src/database/app.db`)
- **API Base**: `/api`

## Dados de Teste

### Usuário Administrador
- **Email**: admin@wps.com
- **Senha**: admin123

### Fornecedores Pré-cadastrados
1. **Fornecedor ABC Ltda**
   - Email: fornecedor1@abc.com
   - Senha: fornecedor123

2. **Transportadora XYZ S.A.**
   - Email: fornecedor2@xyz.com
   - Senha: fornecedor123

## Funcionalidades Implementadas Recentemente

### Sistema de Reagendamento
- **Detecção automática**: Sistema detecta alterações em data/horário
- **Motivo obrigatório**: Modal exige motivo ao reagendar
- **Status automático**: Status muda para "rescheduled" automaticamente
- **Histórico**: Motivo é armazenado e exibido no agendamento

### Gestão de Plantas
- **Cadastro completo**: Sistema de cadastro de plantas com dados completos
- **Usuários vinculados**: Criação automática de usuários para plantas
- **Gerenciamento**: Ativação/desativação de plantas

### Melhorias de UI/UX
- **Visão diária**: Dashboard e agenda trabalham com visão diária
- **Filtros interativos**: Cards de estatísticas funcionam como filtros
- **Inputs customizados**: TimeInput e DateInput com máscaras e validações
- **Modais**: Formulários convertidos para modais (melhor UX)

## Melhorias Futuras

### Funcionalidades Planejadas
- **Notificações**: Sistema de alertas por email/SMS
- **Relatórios**: Dashboards analíticos e exportação
- **Mobile App**: Aplicativo nativo para fornecedores
- **Integração**: APIs para sistemas de terceiros
- **Auditoria**: Log completo de ações do sistema
- **Configuração de Horários por Planta**: Horários de funcionamento específicos por planta

### Otimizações Técnicas
- **Cache**: Redis para performance
- **Banco**: PostgreSQL para produção
- **Deploy**: Containerização com Docker
- **Monitoramento**: Logs estruturados e métricas
- **Backup**: Estratégia de backup automatizado

## Suporte e Manutenção

### Logs do Sistema
O sistema registra todas as operações importantes:
- Autenticações e tentativas de login
- Criação e modificação de agendamentos
- Check-ins e check-outs realizados
- Erros e exceções do sistema

### Monitoramento
- **Performance**: Tempo de resposta das APIs
- **Disponibilidade**: Uptime do sistema
- **Uso**: Estatísticas de utilização
- **Erros**: Tracking de bugs e falhas

## Conclusão

O **Portal WPS** representa uma solução completa e moderna para gestão de agendamentos logísticos. Com sua arquitetura robusta, interface intuitiva e funcionalidades abrangentes, o sistema atende plenamente aos requisitos de controle de carga, oferecendo:

- **Eficiência operacional** através da automação de processos
- **Controle total** sobre agendamentos e movimentação de veículos
- **Integração seamless** com sistemas ERP existentes
- **Experiência de usuário** otimizada para diferentes perfis
- **Segurança** e confiabilidade em todas as operações

O sistema está pronto para uso em ambiente de produção e pode ser facilmente expandido conforme as necessidades futuras da organização.

---

**Desenvolvido com excelência pela Manus AI**  
*Transformando ideias em soluções tecnológicas de alta qualidade*
