"""
Funções utilitárias compartilhadas para o backend
"""
import secrets
import string


def generate_temp_password(length=8):
    """
    Gera uma senha temporária aleatória
    
    Args:
        length (int): Tamanho da senha (padrão: 8)
    
    Returns:
        str: Senha temporária gerada
    """
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))

