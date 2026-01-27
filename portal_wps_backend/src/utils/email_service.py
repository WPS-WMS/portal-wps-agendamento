import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

logger = logging.getLogger(__name__)

class EmailService:
    """Serviço para envio de e-mails"""
    
    def __init__(self):
        self.smtp_host = os.environ.get('SMTP_HOST')
        self.smtp_port = int(os.environ.get('SMTP_PORT', 587))
        self.smtp_user = os.environ.get('SMTP_USER')
        self.smtp_password = os.environ.get('SMTP_PASSWORD')
        self.from_email = os.environ.get('SMTP_FROM_EMAIL', 'noreply@portalwps.com')
        self.from_name = os.environ.get('SMTP_FROM_NAME', 'Portal WPS Agendamento')
        self.frontend_url = os.environ.get('FRONTEND_URL', 'https://portal-agendamentos-cargoflow.web.app')
        
        # Verificar se está configurado
        self.is_configured = all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password
        ])
        
        if not self.is_configured:
            logger.warning("⚠️ Serviço de e-mail não configurado. Configure as variáveis SMTP_* no Railway.")
    
    def send_email(self, to_email, subject, html_body, text_body=None):
        """Envia um e-mail"""
        if not self.is_configured:
            logger.error(f"Tentativa de enviar e-mail para {to_email}, mas SMTP não está configurado")
            return False
        
        try:
            # Criar mensagem
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = formataddr((self.from_name, self.from_email))
            msg['To'] = to_email
            
            # Adicionar corpo do e-mail
            if text_body:
                part1 = MIMEText(text_body, 'plain', 'utf-8')
                msg.attach(part1)
            
            part2 = MIMEText(html_body, 'html', 'utf-8')
            msg.attach(part2)
            
            # Conectar e enviar
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info("E-mail enviado com sucesso")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao enviar e-mail para {to_email}: {str(e)}")
            return False
    
    def send_password_reset_email(self, to_email, reset_token):
        """Envia e-mail de recuperação de senha"""
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
