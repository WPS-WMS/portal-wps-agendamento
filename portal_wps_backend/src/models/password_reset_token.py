from datetime import datetime, timedelta
import secrets
from src.models.user import db

class PasswordResetToken(db.Model):
    """Modelo para armazenar tokens de recuperação de senha"""
    __tablename__ = 'password_reset_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(255), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relacionamento com User
    user = db.relationship('User', backref='password_reset_tokens')
    
    def __repr__(self):
        return f'<PasswordResetToken {self.token[:10]}...>'
    
    @staticmethod
    def generate_token():
        """Gera um token seguro para recuperação de senha"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_token(user_id, expiry_minutes=60):
        """Cria um novo token de recuperação de senha"""
        # Invalidar tokens anteriores não utilizados do mesmo usuário
        PasswordResetToken.query.filter_by(
            user_id=user_id,
            used=False
        ).update({'used': True})
        
        token = PasswordResetToken.generate_token()
        expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        
        reset_token = PasswordResetToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        
        db.session.add(reset_token)
        db.session.commit()
        
        return reset_token
    
    def is_valid(self):
        """Verifica se o token é válido (não usado e não expirado)"""
        if self.used:
            return False
        if datetime.utcnow() > self.expires_at:
            return False
        return True
    
    def mark_as_used(self):
        """Marca o token como usado"""
        self.used = True
        db.session.commit()
    
    @staticmethod
    def find_valid_token(token):
        """Encontra um token válido"""
        reset_token = PasswordResetToken.query.filter_by(token=token).first()
        if not reset_token:
            return None
        if not reset_token.is_valid():
            return None
        return reset_token
