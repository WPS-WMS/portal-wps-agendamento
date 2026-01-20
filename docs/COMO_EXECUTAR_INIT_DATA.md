# 🚀 Como Executar init_data.py para Criar Usuários

## 📋 O Que o Script Faz

O script `init_data.py` cria dados de teste no banco de dados:

- ✅ **2 Empresas** (WPS Agendamento e WPS 2)
- ✅ **3 Usuários Admin** (admin@wps.com, admin2@wps.com, admin3@wps.com)
- ✅ **2 Fornecedores** com usuários
- ✅ **2 Plantas** com usuários
- ✅ **3 Agendamentos** de teste
- ✅ **Permissões padrão** para cada empresa

---

## 🖥️ Executar Localmente (Desenvolvimento)

### Pré-requisitos

1. **PostgreSQL rodando localmente** ou **DATABASE_URL** configurada para Supabase
2. **DATABASE_URL** configurada como variável de ambiente

### Passo 1: Configurar DATABASE_URL

**Windows PowerShell:**
```powershell
$env:DATABASE_URL='postgresql://postgres:senha@localhost:5432/portal_wps'
```

**Linux/Mac:**
```bash
export DATABASE_URL='postgresql://postgres:senha@localhost:5432/portal_wps'
```

**Ou usar Supabase:**
```powershell
$env:DATABASE_URL='postgresql://postgres:Portal$$2026$$Wps@db.zykxlauzctueysvjhppk.supabase.co:5432/postgres'
```

### Passo 2: Executar o Script

```bash
cd portal_wps_backend
python init_data.py
```

**Ou com python3:**
```bash
cd portal_wps_backend
python3 init_data.py
```

### Passo 3: Verificar Resultado

O script vai mostrar:
```
Criando empresa de teste...
Criando permissoes padrao para WPS Agendamento...
Criando usuários administradores...
...
=== DADOS DE TESTE CRIADOS ===

Usuário Administrador 1:
Email: admin@wps.com
Senha: admin123
...
```

---

## ☁️ Executar no Railway (Produção)

### Opção 1: Via Railway CLI (Recomendado)

1. **Instalar Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login no Railway:**
   ```bash
   railway login
   ```

3. **Conectar ao projeto:**
   ```bash
   railway link
   ```

4. **Executar o script:**
   ```bash
   railway run python portal_wps_backend/init_data.py
   ```

### Opção 2: Via SSH/Console do Railway

1. Acesse: Railway → Seu Projeto → **"Deployments"**
2. Clique no deployment mais recente
3. Vá em **"View Logs"** → **"Shell"** ou **"Console"**
4. Execute:
   ```bash
   python portal_wps_backend/init_data.py
   ```

### Opção 3: Criar Comando Customizado no Railway

1. Railway → Seu Projeto → **"Settings"**
2. Vá em **"Deploy"**
3. Em **"Custom Start Command"**, adicione temporariamente:
   ```bash
   python portal_wps_backend/init_data.py && python portal_wps_backend/src/main.py
   ```
4. Faça deploy (vai executar o init e depois iniciar o servidor)
5. **Depois remova** o comando customizado

---

## ⚠️ Importante

### ⚠️ O Script Limpa o Banco!

O script executa `db.drop_all()` antes de criar os dados, ou seja:
- **Apaga TODOS os dados existentes**
- **Recria todas as tabelas**
- **Cria dados de teste**

**Use apenas em:**
- ✅ Ambiente de desenvolvimento
- ✅ Ambiente de teste/staging
- ✅ Primeira inicialização em produção

**NÃO use em produção com dados reais!**

---

## 📝 Usuários Criados

### Empresa: WPS Agendamento

**Administradores:**
- Email: `admin@wps.com` | Senha: `admin123`
- Email: `admin2@wps.com` | Senha: `admin123`

**Fornecedores:**
- Email: `fornecedor1@abc.com` | Senha: `fornecedor123`
- Email: `fornecedor2@xyz.com` | Senha: `fornecedor123`

**Plantas:**
- Email: `portaria.central@wps.com` | Senha: `portaria123`
- Email: `portaria.norte@wps.com` | Senha: `portaria123`

### Empresa: WPS 2

**Administrador:**
- Email: `admin3@wps.com` | Senha: `admin123`

---

## 🔧 Troubleshooting

### Erro: "DATABASE_URL não está definida"

**Solução:**
- Configure `DATABASE_URL` como variável de ambiente antes de executar

### Erro: "connection refused"

**Solução:**
- Verifique se o PostgreSQL está rodando (localmente)
- Ou verifique se a `DATABASE_URL` está correta (Supabase)

### Erro: "ModuleNotFoundError"

**Solução:**
- Instale as dependências: `pip install -r portal_wps_backend/requirements.txt`
- Execute de dentro da pasta `portal_wps_backend`

---

## ✅ Verificar se Funcionou

Após executar, você pode:

1. **Testar login via API:**
   ```bash
   curl -X POST https://seu-backend.railway.app/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@wps.com","password":"admin123"}'
   ```

2. **Ou testar no frontend:**
   - Acesse o frontend
   - Faça login com `admin@wps.com` / `admin123`

---

**Execute o script e os usuários serão criados!** 🚀
