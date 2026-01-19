# Guia de Segurança - Portal WPS

Este documento descreve as práticas de segurança implementadas e recomendações para o Portal WPS.

## ⚠️ Questões Críticas de Segurança

### 1. SECRET_KEY (CRÍTICO)

**Status:** ⚠️ Requer ação imediata em produção

**Problema:** O sistema usa uma SECRET_KEY padrão (`asdf#FGSgvasgf$5$WGT`) em desenvolvimento. **NUNCA use esta chave em produção!**

**Solução:**
1. Defina a variável de ambiente `SECRET_KEY` ou `JWT_SECRET_KEY` antes de iniciar o servidor
2. Use uma chave aleatória forte (mínimo 32 caracteres)
3. Em produção, o sistema irá lançar um erro se a SECRET_KEY não estiver definida

**Como gerar uma chave segura:**
```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL
openssl rand -base64 32
```

**Configuração:**
```bash
# Linux/Mac
export SECRET_KEY="sua-chave-secreta-aqui"
export FLASK_ENV="production"

# Windows PowerShell
$env:SECRET_KEY="sua-chave-secreta-aqui"
$env:FLASK_ENV="production"

# Windows CMD
set SECRET_KEY=sua-chave-secreta-aqui
set FLASK_ENV=production
```

### 2. CORS (Configuração de Origem)

**Status:** ⚠️ Configurar em produção

**Problema:** Atualmente configurado para aceitar requisições de qualquer origem (`*`)

**Solução:**
Em produção, defina `CORS_ORIGINS` com as origens específicas do seu frontend:

```bash
export CORS_ORIGINS="https://portal.example.com,https://www.example.com"
```

### 3. Debug Mode

**Status:** ✅ Corrigido

**Ação:** O sistema agora detecta automaticamente o ambiente e desabilita debug em produção.

Certifique-se de definir:
```bash
export FLASK_ENV="production"
# ou
export ENVIRONMENT="production"
```

### 4. Logs

**Status:** ✅ Melhorado

**Mudanças:**
- Logs de erro no login não expõem mais stack traces em produção
- Logs de permissões reduzidos em produção
- Informações sensíveis não são logadas

**Recomendação:** Revise periodicamente os logs para garantir que informações sensíveis não estejam sendo expostas.

### 5. Armazenamento de Tokens

**Status:** ⚠️ Considerar melhorias

**Atual:** Tokens JWT são armazenados no `localStorage` do navegador

**Riscos:**
- Vulnerável a XSS (Cross-Site Scripting)
- Acessível via JavaScript

**Recomendações Futuras:**
- Considerar usar `httpOnly` cookies (requer ajustes no backend)
- Implementar Content Security Policy (CSP)
- Validar e sanitizar todas as entradas do usuário

## 🔒 Boas Práticas Implementadas

### Autenticação
- ✅ JWT tokens com expiração (24 horas)
- ✅ Verificação de token em todas as rotas protegidas
- ✅ Mensagens de erro genéricas para não expor informações
- ✅ Proteção contra enumeração de emails no forgot-password

### Autorização
- ✅ Sistema de permissões granulares
- ✅ Isolamento multi-tenant por company_id
- ✅ Validação de permissões em todas as rotas sensíveis

### SQL Injection
- ✅ Uso de SQLAlchemy ORM (protege contra SQL injection)
- ✅ Validação de parâmetros antes de usar em queries

### CORS
- ✅ Configurável via variável de ambiente
- ✅ Bloqueio padrão de requisições não autorizadas (em produção)

## 📋 Checklist de Deploy em Produção

Antes de fazer deploy em produção, verifique:

- [ ] `SECRET_KEY` definida como variável de ambiente (OBRIGATÓRIO)
- [ ] `FLASK_ENV` ou `ENVIRONMENT` definido como `production`
- [ ] `DEBUG` desabilitado (False ou não definido)
- [ ] `CORS_ORIGINS` configurado com origens específicas
- [ ] Banco de dados com permissões adequadas
- [ ] HTTPS habilitado (usar proxy reverso como Nginx)
- [ ] Firewall configurado
- [ ] Backups do banco de dados configurados
- [ ] Logs sendo monitorados
- [ ] Aplicação rodando como usuário não-root

## 🛡️ Recomendações Adicionais

### Rate Limiting
Considerar implementar rate limiting para proteger contra:
- Brute force attacks no login
- DDoS attacks
- Abuso de API

Biblioteca recomendada: `flask-limiter`

### HTTPS
**OBRIGATÓRIO em produção!** Use um proxy reverso (Nginx, Apache) com SSL/TLS.

### Headers de Segurança
Configure headers HTTP de segurança:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

### Monitoramento
- Configure alertas para tentativas de login falhadas
- Monitore logs de erro
- Use ferramentas de monitoramento (Sentry, LogRocket, etc.)

### Backup e Recuperação
- Faça backups regulares do banco de dados
- Teste o processo de recuperação
- Mantenha backups criptografados

## 📞 Contato

Em caso de vulnerabilidades de segurança, entre em contato com a equipe de desenvolvimento.
