# Guia de Instalação - Portal WPS

## Instalação Rápida

### 1. Pré-requisitos
- Python 3.11+
- Node.js 18+ (e npm ou pnpm)
- Git (opcional, apenas para clonar repositório)

### 2. Clonagem e Configuração

```bash
# Clonar o repositório (se aplicável)
# Ou copiar as pastas portal_wps_backend e portal_wps_frontend
```

### 3. Configuração do Backend

```bash
cd portal_wps_backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

**Banco de Dados:**
- O banco de dados SQLite é criado automaticamente na primeira execução em `src/database/app.db`
- O script `init_data.py` é **opcional** e serve apenas para popular o banco com dados de teste
- Para criar dados de teste, execute: `python init_data.py` (apaga todos os dados existentes e recria)

### 4. Configuração do Frontend

```bash
cd portal_wps_frontend
npm install  # ou pnpm install
```

### 5. Iniciar os Servidores

#### Opção 1: Scripts PowerShell (Windows)

**Iniciar ambos os servidores:**
```powershell
.\iniciar_servidores.ps1
```

**Iniciar separadamente:**
```powershell
.\iniciar_backend.ps1   # Backend na porta 5000
.\iniciar_frontend.ps1  # Frontend na porta 5173
```

#### Opção 2: Manual (Windows/Linux/Mac)

**Terminal 1 - Backend:**
```bash
cd portal_wps_backend
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows
python src/main.py
# Servidor rodará em http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd portal_wps_frontend
npm run dev  # ou pnpm run dev
# Aplicação rodará em http://localhost:5173 (porta padrão do Vite)
```

### 6. Acesso ao Sistema

Abra o navegador em: **http://localhost:5173**

## Credenciais de Teste

> **Nota:** As credenciais abaixo são válidas apenas se o banco de dados foi inicializado com `init_data.py`. Caso contrário, é necessário criar usuários através da interface administrativa.

### Administrador
- **Email**: admin@wps.com
- **Senha**: admin123

### Fornecedores
- **Fornecedor 1**: fornecedor1@abc.com / fornecedor123
- **Fornecedor 2**: fornecedor2@xyz.com / fornecedor123

### Plantas
- **Planta Central**: portaria.central@wps.com / portaria123
- **Planta Norte**: portaria.norte@wps.com / portaria123

## Funcionalidades Principais

### Como Administrador:
1. **Gerenciar Fornecedores**: Botão "Fornecedores" → "Novo Fornecedor"
2. **Gerenciar Plantas**: Botão "Plantas" → "Nova Planta"
3. **Visualizar Agendamentos**: Aba "Agendamentos" → Navegação diária
4. **Check-in/Check-out**: Botões nos agendamentos do dia
5. **Editar Agendamentos**: Botão de edição em cada agendamento
6. **Filtros**: Cards de estatísticas funcionam como filtros por status
7. **Gerenciar Usuários**: Botão "Usuários" → Criar/editar usuários
8. **Perfis de Acesso**: Configurar permissões por perfil (admin/supplier/plant)

### Como Fornecedor:
1. **Ver Agendamentos**: Calendário diário com navegação
2. **Criar Agendamento**: Botão "Novo Agendamento" (selecionar planta obrigatório)
3. **Editar Agendamento**: Botão de edição nos próprios agendamentos
4. **Excluir Agendamento**: Botão de exclusão (apenas status 'scheduled' ou 'rescheduled')
5. **Reagendar**: Ao alterar data/horário, sistema exige motivo obrigatório

### Como Planta:
1. **Ver Agendamentos Recebidos**: Calendário diário com agendamentos da planta
2. **Check-in**: Marcar chegada do veículo
3. **Check-out**: Marcar saída após descarga
4. **Visualizar Fornecedores**: Lista de fornecedores que agendam na planta
5. **Configurar Horários**: Configurar horários de funcionamento e capacidade máxima

## Estrutura de Arquivos

```
portal-wps-agendamento/
├── portal_wps_backend/          # API Flask
│   ├── src/
│   │   ├── models/              # Modelos do banco de dados
│   │   ├── routes/              # Rotas da API
│   │   ├── utils/               # Utilitários
│   │   ├── database/            # Banco de dados SQLite (criado automaticamente)
│   │   │   └── app.db          # Arquivo do banco de dados
│   │   └── main.py             # Aplicação principal
│   ├── venv/                   # Ambiente virtual Python (criar)
│   ├── requirements.txt        # Dependências Python
│   └── init_data.py            # Script opcional de dados iniciais (não versionado)
├── portal_wps_frontend/        # Interface React
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   ├── hooks/              # React Hooks customizados
│   │   ├── lib/                # Utilitários e API
│   │   └── App.jsx             # Componente principal
│   └── package.json            # Dependências Node.js
├── docs/                       # Documentação do projeto
│   ├── GUIA_INSTALACAO.md     # Este arquivo
│   ├── DOCUMENTACAO_PORTAL_WPS.md  # Documentação completa
│   └── README.md               # README da documentação
├── iniciar_servidores.ps1      # Script PowerShell para iniciar ambos os servidores
├── iniciar_backend.ps1         # Script PowerShell para iniciar backend
├── iniciar_frontend.ps1        # Script PowerShell para iniciar frontend
└── README.md                   # README principal
```

## Configuração do Sistema

### Portas Padrão
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:5173
- **API Base**: `/api`

### Banco de Dados
- **Localização**: `portal_wps_backend/src/database/app.db`
- **Tipo**: SQLite
- **Criação**: Automática na primeira execução do `main.py`
- **Dados de Teste**: Execute `python init_data.py` no diretório `portal_wps_backend` (opcional)

## Solução de Problemas

### Backend não inicia
- Verificar se Python 3.11+ está instalado: `python --version`
- Ativar ambiente virtual: `source venv/bin/activate` (Linux/Mac) ou `venv\Scripts\activate` (Windows)
- Instalar dependências: `pip install -r requirements.txt`
- Verificar se a porta 5000 está disponível
- Verificar logs do terminal para mensagens de erro

### Frontend não carrega
- Verificar se Node.js 18+ está instalado: `node --version`
- Instalar dependências: `npm install` ou `pnpm install`
- Verificar se backend está rodando na porta 5000
- Verificar se a porta 5173 está disponível
- Verificar console do navegador para erros

### Erro de conexão API
- Confirmar que backend está em http://localhost:5000
- Verificar configuração de proxy no `vite.config.js` (deve apontar para `http://localhost:5000`)
- Verificar se CORS está habilitado no backend
- Verificar console do navegador para mensagens de erro de rede

### Banco de dados vazio ou sem dados
- **Opção 1**: Executar `python init_data.py` no diretório `portal_wps_backend` (apaga todos os dados e recria dados de teste)
- **Opção 2**: Criar usuários através da interface administrativa (após login como admin)
- Verificar se arquivo `src/database/app.db` foi criado
- **Atenção**: O script `init_data.py` apaga **todos os dados existentes** e recria dados de teste

### Erro de permissões
- Verificar se o usuário tem permissão para criar/editar/excluir conforme configurado em "Perfis de Acesso"
- Apenas Administradores podem acessar a tela de "Perfis de Acesso"
- Verificar logs do backend para mensagens de erro específicas
- Verificar se o usuário está ativo (`is_active = true`)

### Scripts PowerShell não funcionam
- Verificar se está executando no PowerShell (não no CMD)
- Verificar se Python e Node.js estão no PATH
- Executar como Administrador se necessário
- Verificar se há bloqueio de execução de scripts: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

## Scripts Disponíveis

### PowerShell (Windows)

- **`iniciar_servidores.ps1`**: Inicia ambos os servidores (backend e frontend) em janelas separadas
- **`iniciar_backend.ps1`**: Inicia apenas o servidor backend
- **`iniciar_frontend.ps1`**: Inicia apenas o servidor frontend

### Python (Opcional)

- **`init_data.py`**: Script para popular o banco de dados com dados de teste (apaga todos os dados existentes)

## Tecnologias Utilizadas

### Backend
- **Flask** 3.1.1 - Framework web Python
- **SQLAlchemy** 2.0.41 - ORM para banco de dados
- **PyJWT** 2.10.1 - Autenticação JWT
- **Flask-CORS** 6.0.0 - CORS para requisições cross-origin

### Frontend
- **React** 18.2.0 - Biblioteca JavaScript
- **Vite** 6.3.5 - Build tool e dev server
- **Axios** 1.13.2 - Cliente HTTP
- **Tailwind CSS** 4.1.7 - Framework CSS
- **shadcn/ui** - Componentes UI

### Banco de Dados
- **SQLite** 3.x - Banco de dados relacional

## Suporte

Para dúvidas ou problemas:
1. Consultar a documentação completa em `docs/DOCUMENTACAO_PORTAL_WPS.md`
2. Verificar logs do console do navegador (F12)
3. Verificar logs do terminal do backend
4. Verificar se todas as dependências estão instaladas corretamente
5. Contatar suporte técnico se necessário
