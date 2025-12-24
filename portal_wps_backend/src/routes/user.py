from flask import Blueprint, jsonify, request
from src.models.user import User, db
from src.routes.auth import token_required, admin_required
from datetime import datetime

user_bp = Blueprint('user', __name__)

@user_bp.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    """Retorna o perfil do usuário autenticado"""
    try:
        return jsonify({
            'user': current_user.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@user_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    """Atualiza o perfil do usuário autenticado"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Verificar se está tentando alterar senha
        if 'new_password' in data:
            if 'current_password' not in data:
                return jsonify({'error': 'Senha atual é obrigatória para alterar a senha'}), 400
            
            # Verificar se a senha atual está correta
            if not current_user.check_password(data['current_password']):
                return jsonify({'error': 'Senha atual incorreta'}), 401
            
            # Validar nova senha
            new_password = data['new_password']
            if len(new_password) < 6:
                return jsonify({'error': 'A nova senha deve ter no mínimo 6 caracteres'}), 400
            
            # Atualizar senha
            current_user.set_password(new_password)
        
        # Atualizar timestamp
        current_user.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Perfil atualizado com sucesso',
            'user': current_user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
