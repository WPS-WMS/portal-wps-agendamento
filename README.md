# Portal WPS - Sistema de Agendamento

Sistema de agendamento para gestão de entregas entre fornecedores e plantas.

## Estrutura do Projeto

```
portal-wps-agendamento/
├── portal_wps_backend/     # Backend Flask (Python)
│   ├── src/
│   │   ├── main.py         # Ponto de entrada da aplicação
│   │   ├── models/         # Modelos SQLAlchemy
│   │   ├── routes/         # Rotas da API
│   │   └── utils/          # Utilitários
│   └── requirements.txt    # Dependências Python
│
└── portal_wps_frontend/    # Frontend React (Vite)
    ├── src/
    │   ├── components/     # Componentes React
    │   ├── services/       # Serviços de API
    │   └── App.jsx         # Componente principal
    └── package.json        # Dependências Node.js
```

## Tecnologias

### Backend
- **Flask** 3.1.1 - Framework web Python
- **SQLAlchemy** 2.0.41 - ORM para banco de dados
- **PyJWT** 2.10.1 - Autenticação JWT
- **Flask-CORS** 6.0.0 - CORS para requisições cross-origin

### Frontend
- **React** - Biblioteca JavaScript
- **Vite** - Build tool e dev server
- **Axios** - Cliente HTTP

## Perfis de Usuário

1. **Administrador** - Acesso completo ao sistema
2. **Fornecedor** - Pode criar e gerenciar seus agendamentos
3. **Planta** - Pode visualizar e gerenciar agendamentos recebidos

## Funcionalidades Principais

- ✅ Autenticação e autorização por perfis
- ✅ Gestão de agendamentos (criar, editar, excluir, reagendar)
- ✅ Check-in e Check-out de agendamentos
- ✅ Gestão de fornecedores e plantas
- ✅ Configuração de horários de funcionamento
- ✅ Sistema de permissões granulares por funcionalidade
- ✅ Bloqueios de horários (semanal e por data específica)

## Como Executar

### Backend
```bash
cd portal_wps_backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python src/main.py
```

### Frontend
```bash
cd portal_wps_frontend
npm install
npm run dev
```

## Configuração de Segurança

⚠️ **IMPORTANTE**: Antes de fazer deploy em produção:

1. Configure a variável de ambiente `SECRET_KEY` com uma chave segura
2. Altere `SECRET_KEY` hardcoded em `src/routes/auth.py` e `src/utils/permissions.py`
3. Configure CORS adequadamente para seu domínio
4. Use um servidor WSGI de produção (Gunicorn, uWSGI) ao invés do servidor de desenvolvimento do Flask

## Banco de Dados

O sistema utiliza **PostgreSQL** como banco de dados. A conexão é configurada através de variáveis de ambiente:

### Configuração via DATABASE_URL (recomendado)
```bash
export DATABASE_URL="postgresql://usuario:senha@host:5432/portal_wps"
```

### Configuração via variáveis individuais
```bash
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="sua_senha"
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
export POSTGRES_DB="portal_wps"
```

Para mais detalhes, consulte `docs/GUIA_INSTALACAO.md`.

## Documentação Adicional

- `docs/MODELAGEM_BANCO_DE_DADOS.md` - Modelagem completa do banco de dados

## Notas para Manus IA

- O sistema utiliza autenticação JWT
- As rotas protegidas usam decorators: `@token_required`, `@admin_required`, `@plant_required`
- Permissões são verificadas através do módulo `src/utils/permissions.py`
- O frontend faz proxy das requisições através do Vite (configurado em `vite.config.js`)
