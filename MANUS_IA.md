# Documentação para Manus IA

Este documento fornece informações essenciais sobre o projeto Portal WPS para facilitar a compreensão e manutenção pelo Manus IA.

## Visão Geral

Sistema de agendamento web para gestão de entregas entre fornecedores e plantas industriais. Desenvolvido com Flask (backend) e React (frontend).

## Arquitetura

### Backend (Flask)
- **Localização**: `portal_wps_backend/src/`
- **Ponto de entrada**: `main.py`
- **Banco de dados**: SQLite (`src/database/app.db`)
- **Porta padrão**: 5000

### Frontend (React + Vite)
- **Localização**: `portal_wps_frontend/src/`
- **Ponto de entrada**: `main.jsx`
- **Porta padrão**: 5173
- **Proxy**: Configurado em `vite.config.js` para redirecionar `/api/*` para `http://localhost:5000`

## Estrutura de Rotas

### Autenticação (`/api/login`)
- POST `/api/login` - Login e obtenção de token JWT

### Admin (`/api/admin/*`)
- Requer decorator `@admin_required`
- Gestão completa de fornecedores, plantas, usuários e agendamentos

### Fornecedor (`/api/supplier/*`)
- Requer decorator `@token_required` e `role='supplier'`
- Visualização e gestão de agendamentos próprios

### Planta (`/api/plant/*`)
- Requer decorator `@token_required` e `role='plant'`
- Visualização e gestão de agendamentos recebidos

## Modelos Principais

### User
- Campos: `id`, `email`, `password_hash`, `role`, `supplier_id`, `plant_id`, `is_active`
- Roles: `'admin'`, `'supplier'`, `'plant'`

### Appointment
- Campos: `id`, `date`, `time`, `time_end`, `status`, `supplier_id`, `plant_id`, `motivo_reagendamento`
- Status possíveis: `'scheduled'`, `'rescheduled'`, `'checked_in'`, `'checked_out'`

### Supplier
- Campos: `id`, `cnpj`, `description`, `is_active`, `is_deleted`

### Plant
- Campos: `id`, `name`, `code`, `cnpj`, `email`, `max_capacity`, `is_active`

## Sistema de Permissões

O sistema utiliza permissões granulares por funcionalidade:
- **Editor**: Mesmos privilégios do Admin na funcionalidade
- **Visualizador**: Apenas leitura
- **Sem acesso**: Bloqueio completo

Verificação através de `src/utils/permissions.py` com decorator `@permission_required`.

## Segurança

### Autenticação
- JWT tokens com expiração de 24 horas
- SECRET_KEY atual: `'asdf#FGSgvasgf$5$WGT'` (⚠️ Alterar em produção)

### Logs
- Logs sensíveis (emails, CNPJs completos) foram removidos
- Logs operacionais mantidos para debugging

### CORS
- Configurado para aceitar requisições do frontend
- Em produção, configurar origens específicas

## Comandos Úteis

### Iniciar Backend
```bash
cd portal_wps_backend
python src/main.py
```

### Iniciar Frontend
```bash
cd portal_wps_frontend
npm run dev
```

### Instalar Dependências Backend
```bash
cd portal_wps_backend
pip install -r requirements.txt
```

### Instalar Dependências Frontend
```bash
cd portal_wps_frontend
npm install
```

## Pontos de Atenção

1. **SECRET_KEY**: Está hardcoded em múltiplos arquivos. Em produção, usar variáveis de ambiente.

2. **Banco de Dados**: SQLite por padrão. Para produção, considerar PostgreSQL ou MySQL.

3. **Servidor de Desenvolvimento**: Flask usa servidor de desenvolvimento. Em produção, usar Gunicorn ou uWSGI.

4. **Logs**: Aviso do Werkzeug foi suprimido, mas ainda está em modo debug. Desabilitar em produção.

5. **CORS**: Configurado para aceitar todas as origens (`*`). Restringir em produção.

## Fluxos Principais

### Login
1. Usuário envia email e senha
2. Backend valida credenciais
3. Gera token JWT com informações do usuário
4. Retorna token e dados do usuário

### Criação de Agendamento
1. Fornecedor seleciona planta e data/horário
2. Sistema valida horários de funcionamento
3. Sistema valida capacidade máxima
4. Cria agendamento com status `'scheduled'`

### Reagendamento
1. Fornecedor altera data/horário
2. Sistema exige motivo do reagendamento
3. Status muda para `'rescheduled'`
4. Motivo é salvo no campo `motivo_reagendamento`

### Check-in/Check-out
1. Planta realiza check-in → status `'checked_in'`
2. Planta realiza check-out → status `'checked_out'`
3. Agendamentos finalizados não podem ser editados/excluídos

## Arquivos Importantes

- `portal_wps_backend/src/main.py` - Configuração principal do Flask
- `portal_wps_backend/src/routes/auth.py` - Autenticação e JWT
- `portal_wps_backend/src/utils/permissions.py` - Sistema de permissões
- `portal_wps_frontend/src/services/api.js` - Cliente HTTP do frontend
- `docs/MODELAGEM_BANCO_DE_DADOS.md` - Modelagem completa do banco
