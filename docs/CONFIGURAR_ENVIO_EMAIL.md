# Configuração de Envio de E-mail para Recuperação de Senha

## Visão Geral

O sistema de recuperação de senha requer a configuração de um serviço de e-mail para enviar links de redefinição. O **Railway não envia e-mails diretamente** - você precisa configurar um serviço de e-mail externo.

## Opções de Serviços de E-mail

### 1. Mailgun
- **Plano gratuito**: 5.000 e-mails/mês
- **Documentação**: https://documentation.mailgun.com/
- **Como configurar**:
  1. Criar conta em https://www.mailgun.com
  2. Obter credenciais SMTP
  3. Adicionar variáveis de ambiente no Railway:
     - `SMTP_HOST=smtp.mailgun.org`
     - `SMTP_PORT=587`
     - `SMTP_USER=<seu-usuario-mailgun>`
     - `SMTP_PASSWORD=<sua-senha-mailgun>`
     - `SMTP_FROM_EMAIL=noreply@seudominio.com`


### 2. SMTP Próprio (Outlook)
- **Outlook**: Requer "App Password" (não funciona com senha normal)
- **Como configurar Outlook**:
  1. Ativar verificação em 2 etapas na sua conta Microsoft
  2. Gerar "App Password" em https://account.microsoft.com/security/app-passwords
  3. Adicionar variáveis de ambiente no Railway:
     - `SMTP_HOST=smtp-mail.outlook.com`
     - `SMTP_PORT=587`
     - `SMTP_USER=seu-email@outlook.com` (ou @hotmail.com, @live.com)
     - `SMTP_PASSWORD=<app-password-gerado>`
     - `SMTP_FROM_EMAIL=seu-email@outlook.com`

## Variáveis de Ambiente Necessárias

Adicione estas variáveis no Railway (Settings → Variables):

# Configurações SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=sua-api-key-aqui
SMTP_FROM_EMAIL=noreply@seudominio.com
SMTP_FROM_NAME=Portal WPS Agendamento

# URL do frontend (para links de recuperação)
FRONTEND_URL=https://cargoflow.app.br

# Tempo de expiração do token (em minutos, padrão: 60)
RESET_TOKEN_EXPIRY=60
```

## Como Adicionar Variáveis no Railway

1. Acesse seu projeto no Railway: https://railway.app
2. Clique no serviço do backend
3. Vá em **Variables** (Variáveis)
4. Clique em **+ New Variable**
5. Adicione cada variável uma por uma
6. Clique em **Deploy** para aplicar as mudanças

## Fluxo de Recuperação de Senha

### Como Funciona

1. **Usuário solicita recuperação:**
   - Acessa a tela de login
   - Clica em "Esqueci minha senha"
   - Digite o e-mail cadastrado
   - Sistema envia e-mail com link de recuperação

2. **E-mail recebido:**
   - O usuário recebe um e-mail com um link no formato:
     ```
     https://cargoflow.app.br/reset-password?token=XXXXX
     ```
   - O token é único e expira em 60 minutos (configurável via `RESET_TOKEN_EXPIRY`)

3. **Redefinição de senha:**
   - Usuário clica no link do e-mail
   - É redirecionado para a tela de redefinição de senha
   - Sistema verifica se o token é válido
   - Se válido, permite definir nova senha
   - Se inválido/expirado, mostra mensagem de erro

4. **Conclusão:**
   - Após redefinir com sucesso, usuário é redirecionado para login
   - Pode fazer login com a nova senha

## Testando a Configuração

Após configurar as variáveis:

1. Acesse a tela de login
2. Clique em "Esqueci minha senha"
3. Digite um e-mail cadastrado
4. Verifique se o e-mail foi recebido (pode levar alguns minutos)
5. Clique no link no e-mail para redefinir a senha
6. Digite a nova senha (mínimo 6 caracteres)
7. Confirme a nova senha
8. Após sucesso, faça login com a nova senha

## Troubleshooting

### E-mail não está sendo enviado
- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique os logs do Railway para erros
- Confirme que o serviço de e-mail está ativo
- Verifique se o e-mail de remetente está verificado (para AWS SES)

### Erro "Authentication failed"
- Verifique se as credenciais SMTP estão corretas
- Para Outlook, certifique-se de usar "App Password", não a senha normal
- Para SendGrid, use `apikey` como usuário e a API Key como senha

### E-mails indo para spam
- Configure SPF e DKIM no seu domínio
- Use um domínio verificado (não @gmail.com ou @outlook.com)
- Adicione o domínio do remetente aos registros DNS

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite credenciais de e-mail no código
- Use sempre variáveis de ambiente
- Rotacione senhas/API keys regularmente
- Use HTTPS para o frontend (já configurado no Firebase)
