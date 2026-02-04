import os
import smtplib
import logging
import json
import urllib.request
import urllib.error
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

logger = logging.getLogger(__name__)

# Resend API (HTTPS) funciona no Railway; SMTP (porta 587) costuma ser bloqueado em PaaS
RESEND_API_URL = "https://api.resend.com/emails"


class EmailService:
    """Serviço para envio de e-mails. Usa Resend API se RESEND_API_KEY estiver definida (recomendado no Railway); senão SMTP."""

    def __init__(self):
        self.resend_api_key = os.environ.get('RESEND_API_KEY')
        self.smtp_host = os.environ.get('SMTP_HOST')
        self.smtp_port = int(os.environ.get('SMTP_PORT', 587))
        self.smtp_user = os.environ.get('SMTP_USER')
        self.smtp_password = os.environ.get('SMTP_PASSWORD')
        self.from_email = os.environ.get('SMTP_FROM_EMAIL') or os.environ.get('RESEND_FROM_EMAIL') or 'noreply@portalwps.com'
        self.from_name = os.environ.get('SMTP_FROM_NAME') or os.environ.get('RESEND_FROM_NAME') or 'Portal WPS Agendamento'
        self.frontend_url = os.environ.get('FRONTEND_URL', 'https://portal-agendamentos-cargoflow.web.app')

        self._use_resend = bool(self.resend_api_key)
        self._use_smtp = not self._use_resend and all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password
        ])
        self.is_configured = self._use_resend or self._use_smtp

        if self._use_resend:
            logger.info(f"E-mail configurado via Resend API (HTTPS). From: {self.from_email}, API Key: {self.resend_api_key[:10]}...")
        elif self._use_smtp:
            logger.info("E-mail configurado via SMTP.")
        else:
            logger.warning("Serviço de e-mail não configurado. Defina RESEND_API_KEY (recomendado no Railway) ou SMTP_*.")
    
    def _send_via_resend(self, to_email, subject, html_body):
        """Envia e-mail via Resend API (HTTPS). Funciona no Railway."""
        try:
            # Formato "from": Resend aceita apenas email ou "Nome <email@domain.com>"
            # Por padrão, usar APENAS o email (sem nome) para evitar erro 1010
            # O erro 1010 geralmente ocorre quando há problema com formato ou domínio não verificado
            from_field = self.from_email
            
            # Se RESEND_USE_NAME estiver definido como "true", tentar incluir o nome
            use_name = os.environ.get('RESEND_USE_NAME', 'false').lower() == 'true'
            if use_name and self.from_name and self.from_name.strip():
                # Formato com nome: "Nome <email@domain.com>"
                from_field = f"{self.from_name} <{self.from_email}>"
                logger.info(f"Resend: Usando nome no 'from' (RESEND_USE_NAME=true): {from_field}")
            else:
                logger.info(f"Resend: Usando apenas email no 'from' (sem nome): {from_field}")
            
            payload_data = {
                "from": from_field,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }
            
            logger.info(f"Resend: Enviando e-mail | From: {from_field} | To: {to_email} | Subject: {subject}")
            
            payload = json.dumps(payload_data).encode("utf-8")
            req = urllib.request.Request(
                RESEND_API_URL,
                data=payload,
                headers={
                    "Authorization": f"Bearer {self.resend_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                if 200 <= resp.getcode() < 300:
                    logger.info(f"Resend: E-mail enviado com sucesso para {to_email}")
                    return True
                body = resp.read().decode("utf-8")
                logger.error(f"Resend API retornou {resp.getcode()}: {body}")
                return False
        except urllib.error.HTTPError as e:
            # Captura erros HTTP (403, 401, 1010, etc.) e mostra detalhes
            try:
                error_body = e.read().decode("utf-8") if e.fp else "Sem detalhes"
            except:
                error_body = "Não foi possível ler o corpo da resposta"
            
            error_msg = (
                f"Resend HTTP Error {e.code}: {e.reason}\n"
                f"URL: {RESEND_API_URL}\n"
                f"From: {self.from_name} <{self.from_email}>\n"
                f"To: {to_email}\n"
                f"Resposta: {error_body}\n"
            )
            
            # Mensagens específicas por código de erro
            if e.code == 403:
                error_msg += "Possíveis causas: API Key inválida, domínio não verificado, ou e-mail 'from' não corresponde ao domínio verificado."
            elif e.code == 401:
                error_msg += "Possíveis causas: API Key inválida ou expirada. Verifique RESEND_API_KEY no Railway."
            elif e.code == 1010:
                error_msg += "Erro 1010: Cloudflare bloqueou a requisição (possível problema de DNS ou firewall). Verifique conectividade de rede do Railway."
            else:
                error_msg += f"Erro HTTP {e.code}: Verifique a documentação do Resend ou logs detalhados."
            
            logger.error(error_msg)
            return False
        except urllib.error.URLError as e:
            # Erros de rede/DNS (não HTTP)
            logger.error(
                f"Resend: Erro de rede/URL ao enviar e-mail: {type(e).__name__}: {str(e)}\n"
                f"URL: {RESEND_API_URL}\n"
                f"From: {self.from_name} <{self.from_email}>\n"
                f"To: {to_email}\n"
                f"Possíveis causas: Problema de conectividade, DNS não resolve, ou firewall bloqueando acesso."
            )
            return False
        except Exception as e:
            logger.error(f"Resend: Erro inesperado ao enviar e-mail: {type(e).__name__}: {str(e)}", exc_info=True)
            return False

    def _send_via_smtp(self, to_email, subject, html_body, text_body=None):
        """Envia e-mail via SMTP. Pode falhar no Railway (porta 587 bloqueada)."""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = formataddr((self.from_name, self.from_email))
        msg['To'] = to_email
        if text_body:
            msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        timeout_sec = int(os.environ.get('SMTP_TIMEOUT', 10))
        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=timeout_sec) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
        return True

    def send_email(self, to_email, subject, html_body, text_body=None):
        """Envia um e-mail (Resend API ou SMTP)."""
        if not self.is_configured:
            logger.error("E-mail não configurado (RESEND_API_KEY ou SMTP_* ausentes)")
            return False
        try:
            if self._use_resend:
                return self._send_via_resend(to_email, subject, html_body)
            return self._send_via_smtp(to_email, subject, html_body, text_body)
        except Exception as e:
            logger.error(f"Erro ao enviar e-mail para {to_email}: {type(e).__name__}: {str(e)}", exc_info=True)
            return False
    
    def send_password_reset_email(self, to_email, reset_token):
        """Envia e-mail de recuperação de senha"""
        reset_url = f"{self.frontend_url}/reset-password?token={reset_token}"
        logger.info(f"Enviando e-mail de recuperação para {to_email} | link: {self.frontend_url}/reset-password?token=***")
        
        subject = "Recuperação de Senha - Portal WPS Agendamento"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
                .warning {{ background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Portal WPS Agendamento</h1>
                </div>
                <div class="content">
                    <h2>Recuperação de Senha</h2>
                    <p>Olá,</p>
                    <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
                    <p>Clique no botão abaixo para criar uma nova senha:</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Redefinir Senha</a>
                    </p>
                    <p>Ou copie e cole o link abaixo no seu navegador:</p>
                    <p style="word-break: break-all; color: #2563eb;">{reset_url}</p>
                    <div class="warning">
                        <strong>⚠️ Importante:</strong>
                        <ul>
                            <li>Este link expira em 60 minutos</li>
                            <li>Se você não solicitou esta recuperação, ignore este e-mail</li>
                            <li>Não compartilhe este link com ninguém</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p>Este é um e-mail automático, por favor não responda.</p>
                    <p>© Portal WPS Agendamento</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Recuperação de Senha - Portal WPS Agendamento
        
        Olá,
        
        Recebemos uma solicitação para redefinir a senha da sua conta.
        
        Clique no link abaixo para criar uma nova senha:
        {reset_url}
        
        IMPORTANTE:
        - Este link expira em 60 minutos
        - Se você não solicitou esta recuperação, ignore este e-mail
        - Não compartilhe este link com ninguém
        
        Este é um e-mail automático, por favor não responda.
        © Portal WPS Agendamento
        """
        
        return self.send_email(to_email, subject, html_body, text_body)
