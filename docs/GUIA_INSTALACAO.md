# Guia de Instalação - Portal WPS

## Instalação Rápida

### 1. Pré-requisitos
- Python 3.11+
- Node.js 18+
- Git

### 2. Clonagem e Configuração

```bash
# Clonar os projetos (se estiverem em repositório)
# Ou copiar as pastas portal_wps_backend e portal_wps_frontend

# Configurar Backend
cd portal_wps_backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Inicializar banco de dados
python init_data.py

# Iniciar servidor backend
python src/main.py
# Servidor rodará em http://localhost:5000
```

```bash
# Configurar Frontend (em outro terminal)
cd portal_wps_frontend
pnpm install  # ou npm install

# Iniciar servidor frontend
pnpm run dev  # ou npm run dev
# Aplicação rodará em http://localhost:5173 (porta padrão do Vite)
```

### 3. Acesso ao Sistema

Abra o navegador em: **http://localhost:5173**

## Credenciais de Teste

### Administrador
- **Email**: admin@wps.com
- **Senha**: admin123

### Fornecedores
- **Fornecedor 1**: fornecedor1@abc.com / fornecedor123
- **Fornecedor 2**: fornecedor2@xyz.com / fornecedor123

## Funcionalidades Principais

### Como Administrador:
1. **Gerenciar Fornecedores**: Botão "Fornecedores" → "Novo Fornecedor"
2. **Gerenciar Plantas**: Botão "Plantas" → "Nova Planta"
3. **Visualizar Agendamentos**: Aba "Agendamentos" → Navegação diária
4. **Check-in/Check-out**: Botões nos agendamentos do dia
5. **Editar Agendamentos**: Botão de edição em cada agendamento
6. **Filtros**: Cards de estatísticas funcionam como filtros por status

### Como Fornecedor:
1. **Ver Agendamentos**: Calendário diário com navegação
2. **Criar Agendamento**: Botão "Novo Agendamento"
3. **Editar Agendamento**: Botão de edição nos próprios agendamentos

## Estrutura de Arquivos

```
portal-wps-agendamento/
├── portal_wps_backend/          # API Flask
│   ├── src/
│   │   ├── models/              # Modelos do banco de dados
│   │   ├── routes/              # Rotas da API
│   │   ├── database/            # Banco de dados SQLite
│   │   └── main.py              # Aplicação principal
│   ├── venv/                    # Ambiente virtual Python
│   ├── requirements.txt         # Dependências Python
│   └── init_data.py            # Script de dados iniciais
├── portal_wps_frontend/         # Interface React
│   ├── src/
│   │   ├── components/          # Componentes React
│   │   ├── lib/                 # Utilitários e API
│   │   └── App.jsx              # Componente principal
│   └── package.json            # Dependências Node.js
├── docs/                        # Documentação do projeto
└── README.md                    # README principal
```

## Solução de Problemas

### Backend não inicia
- Verificar se Python 3.11+ está instalado
- Ativar ambiente virtual: `source venv/bin/activate`
- Instalar dependências: `pip install -r requirements.txt`

### Frontend não carrega
- Verificar se Node.js 18+ está instalado
- Instalar dependências: `pnpm install` ou `npm install`
- Verificar se backend está rodando na porta 5000
- Verificar se a porta 5173 está disponível

### Erro de conexão API
- Confirmar que backend está em http://localhost:5000
- Verificar configuração de proxy no `vite.config.js` (deve apontar para porta 5000)
- Verificar se CORS está habilitado no backend

### Banco de dados vazio
- Executar: `python init_data.py` no diretório `portal_wps_backend`
- Verificar se arquivo `src/database/app.db` foi criado
- Se o banco já existir, o script irá limpar e recriar os dados

## Suporte

Para dúvidas ou problemas:
1. Consultar a documentação completa
2. Verificar logs do console do navegador
3. Verificar logs do terminal do backend
4. Contatar suporte técnico se necessário
