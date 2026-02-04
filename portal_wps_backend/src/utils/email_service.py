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

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


class EmailService:
    """Serviço para envio de e-mails. Usa SendGrid API se SENDGRID_API_KEY estiver definida; senão SMTP."""

    def __init__(self):
        self.sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        self.smtp_host = os.environ.get('SMTP_HOST')
        self.smtp_port = int(os.environ.get('SMTP_PORT', 587))
        self.smtp_user = os.environ.get('SMTP_USER')
        self.smtp_password = os.environ.get('SMTP_PASSWORD')

        self._use_sendgrid = bool(self.sendgrid_api_key)
        self._use_smtp = not self._use_sendgrid and all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password
        ])

        if self._use_sendgrid:
            self.from_email = os.environ.get('SENDGRID_FROM_EMAIL') or os.environ.get('SMTP_FROM_EMAIL') or 'noreply@portalwps.com'
            self.from_name = os.environ.get('SENDGRID_FROM_NAME') or os.environ.get('SMTP_FROM_NAME') or 'Portal WPS Agendamento'
        else:
            self.from_email = os.environ.get('SMTP_FROM_EMAIL') or os.environ.get('SENDGRID_FROM_EMAIL') or 'noreply@portalwps.com'
            self.from_name = os.environ.get('SMTP_FROM_NAME') or os.environ.get('SENDGRID_FROM_NAME') or 'Portal WPS Agendamento'

        self.frontend_url = os.environ.get('FRONTEND_URL', 'https://portal-agendamentos-cargoflow.web.app')
        self.is_configured = self._use_sendgrid or self._use_smtp

        if self._use_sendgrid:
            logger.info(f"E-mail configurado via SendGrid API. From: {self.from_name} <{self.from_email}>")
        elif self._use_smtp:
            logger.info(f"E-mail configurado via SMTP. From: {self.from_email}")
        else:
            logger.warning("Serviço de e-mail não configurado. Defina SENDGRID_API_KEY ou SMTP_* nas variáveis do serviço no Railway.")

    def _send_via_sendgrid(self, to_email, subject, html_body, text_body=None):
        """Envia e-mail via SendGrid API (HTTPS)."""
        try:
            content = [{"type": "text/html", "value": html_body}]
            if text_body:
                content.insert(0, {"type": "text/plain", "value": text_body})
            payload_data = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.from_email, "name": self.from_name},
                "subject": subject,
                "content": content,
            }

            payload = json.dumps(payload_data).encode("utf-8")
            req = urllib.request.Request(
                SENDGRID_API_URL,
                data=payload,
                headers={
                    "Authorization": f"Bearer {self.sendgrid_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                if 200 <= resp.getcode() < 300:
                    return True
                body = resp.read().decode("utf-8")
                logger.error(f"SendGrid API retornou {resp.getcode()}: {body}")
                return False
        except urllib.error.HTTPError as e:
            try:
                error_body = e.read().decode("utf-8") if e.fp else ""
            except Exception:
                error_body = ""
            logger.error(f"SendGrid HTTP Error {e.code}: {e.reason}. Resposta: {error_body}")
            return False
        except urllib.error.URLError as e:
            logger.error(f"SendGrid: Erro de rede: {type(e).__name__}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"SendGrid: Erro ao enviar e-mail: {type(e).__name__}: {str(e)}", exc_info=True)
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
        """Envia um e-mail (SendGrid API ou SMTP)."""
        if not self.is_configured:
            logger.error("E-mail não configurado: SENDGRID_API_KEY ou SMTP_* ausentes.")
            return False
        try:
            if self._use_sendgrid:
                return self._send_via_sendgrid(to_email, subject, html_body, text_body)
            return self._send_via_smtp(to_email, subject, html_body, text_body)
        except Exception as e:
            logger.error(f"Erro ao enviar e-mail para {to_email}: {type(e).__name__}: {str(e)}", exc_info=True)
            return False

    def send_password_reset_email(self, to_email, reset_token):
        """Envia e-mail de recuperação de senha."""
        reset_url = f"{self.frontend_url}/reset-password?token={reset_token}"

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
