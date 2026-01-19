# 📋 Arquivos Necessários para Teste Local

Este documento lista os arquivos que **DEVEM SER MANTIDOS** no repositório GitHub para que quem baixar o projeto consiga testá-lo localmente.

## ✅ Arquivos OBRIGATÓRIOS

### 📁 Backend (portal_wps_backend/)

**Código Fonte:**
- ✅ `src/` - Todo o código-fonte do backend
- ✅ `requirements.txt` - Dependências Python

**Scripts Essenciais:**
- ✅ `init_data.py` - **ESSENCIAL!** Cria dados de teste (usuários, fornecedores, plantas, agendamentos)
  - Este script deve ser mantido pois é necessário para inicializar o banco com dados de teste

**Documentação:**
- ✅ Não há documentação técnica específica no diretório backend - toda documentação está em `docs/`

### 📁 Frontend (portal_wps_frontend/)

**Código Fonte:**
- ✅ `src/` - Todo o código-fonte do frontend
- ✅ `package.json` - Dependências Node.js
- ✅ `vite.config.js` - Configuração do Vite
- ✅ `index.html` - Página HTML principal
- ✅ Arquivos de configuração do Tailwind/Eslint (se houver)

### 📁 Raiz do Projeto

**Scripts de Inicialização:**
- ✅ `iniciar_backend.ps1` - Script para iniciar backend (Windows)
- ✅ `iniciar_frontend.ps1` - Script para iniciar frontend (Windows)
- ✅ `iniciar_servidores.ps1` - Script para iniciar ambos (Windows)

**Documentação:**
- ✅ `README.md` - Documentação principal do projeto
- ✅ `docs/` - Toda a documentação em `docs/`

**Configuração:**
- ✅ `.gitignore` - Arquivos a serem ignorados pelo Git

## ❌ Arquivos que NÃO DEVEM SER COMMITADOS (já no .gitignore)

### Scripts Temporários
Os seguintes tipos de arquivos **NÃO devem ser commitados** (já estão configurados no `.gitignore`):

- ❌ `test_*.py` - Scripts de teste/diagnóstico manual
  - Existem localmente para diagnóstico, mas estão no `.gitignore`
  - Exemplos: `test_api_response.py`, `test_login.py`, `test_my_permissions_api.py`, `test_plant_permissions.py`
  
- ❌ `check_*.py` - Scripts de verificação de dados (já foram removidos)

- ❌ `migrate_*.py` - Scripts de migração históricos (já foram removidos)

- ❌ `fix_*.py` - Scripts de correção temporária (já foram removidos)

- ❌ `create_*.py` - Scripts de criação manual (exceto `init_data.py`, que é necessário)

- ❌ `delete_*.py` - **PERIGOSOS!** Scripts que deletam dados (já foram removidos)

- ❌ `update_*.py` - Scripts de atualização manual (já foram removidos)

- ❌ `*.sqbpro` - Arquivos de projeto do DB Browser for SQLite

- ❌ `migrations/` - Pasta vazia (projeto não usa Flask-Migrate)

### Nota sobre Arquivos Locais
Os arquivos `test_*.py` podem existir localmente para diagnóstico, mas estão configurados no `.gitignore` para **não serem commitados** no repositório GitHub.

## 🔧 Como Testar Localmente

### 1. Instalar Dependências

**Backend:**
```bash
cd portal_wps_backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

**Frontend:**
```bash
cd portal_wps_frontend
npm install
```

### 2. Inicializar Banco de Dados com Dados de Teste

```bash
cd portal_wps_backend
python init_data.py
```

Este script cria:
- 2 empresas de teste (WPS Agendamento e WPS 2)
- 3 usuários admin (admin@wps.com, admin2@wps.com, admin3@wps.com) - senha: `admin123`
- 2 fornecedores com usuários
- 2 plantas com usuários
- 3 agendamentos de teste

### 3. Iniciar Servidores

**Windows (PowerShell):**
```powershell
.\iniciar_servidores.ps1
```

**Ou manualmente:**
```bash
# Terminal 1 - Backend
cd portal_wps_backend
venv\Scripts\activate
python src/main.py

# Terminal 2 - Frontend
cd portal_wps_frontend
npm run dev
```

### 4. Acessar o Sistema

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

**Login de Teste:**
- Email: `admin@wps.com`
- Senha: `admin123`

## 📝 Credenciais de Teste (após init_data.py)

### Administradores
- `admin@wps.com` / `admin123` (Empresa: WPS Agendamento)
- `admin2@wps.com` / `admin123` (Empresa: WPS Agendamento)
- `admin3@wps.com` / `admin123` (Empresa: WPS 2)

### Fornecedores
- `fornecedor1@abc.com` / `fornecedor123`
- `fornecedor2@xyz.com` / `fornecedor123`

### Plantas
- `portaria.central@wps.com` / `portaria123`
- `portaria.norte@wps.com` / `portaria123`

## ⚠️ Importante

1. **init_data.py** é **ESSENCIAL** - sem ele, não há dados para testar. Este arquivo **DEVE ser commitado** no GitHub.

2. **Banco de dados** (`app.db`) é criado automaticamente na primeira execução do backend. Está no `.gitignore` e **não deve ser commitado**.

3. **Scripts temporários** (`test_*.py`, `check_*.py`, `migrate_*.py`, etc.) estão configurados no `.gitignore` para **não serem commitados**.

4. **Ambiente virtual** (`venv/`) está no `.gitignore` e **não deve ser commitado**. Cada desenvolvedor deve criar seu próprio ambiente virtual.

5. **Arquivos de cache** (`__pycache__/`, `node_modules/`) estão no `.gitignore` e são gerados automaticamente.

6. **Scripts de migração** já foram executados e removidos do projeto - o sistema agora usa `db.create_all()` diretamente.
