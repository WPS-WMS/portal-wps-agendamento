#!/usr/bin/env python3
"""
Script de migração para adicionar a coluna plant_id à tabela user
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(__file__))

from src.main import app

def migrate_add_plant_id_to_user():
    """Adiciona a coluna plant_id à tabela user"""
    with app.app_context():
        database_path = os.path.join(
            os.path.dirname(__file__), 
            'src', 
            'database', 
            'app.db'
        )
        
        if not os.path.exists(database_path):
            print(f"Banco de dados não encontrado em: {database_path}")
            print("O banco será criado automaticamente na próxima inicialização.")
            return
        
        print(f"Conectando ao banco de dados: {database_path}")
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()
        
        try:
            # Verificar se a coluna já existe
            cursor.execute("PRAGMA table_info(user)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'plant_id' in columns:
                print("[OK] A coluna 'plant_id' já existe na tabela user.")
                return
            
            print("Adicionando coluna 'plant_id' à tabela user...")
            
            # Adicionar a coluna
            cursor.execute("""
                ALTER TABLE user 
                ADD COLUMN plant_id INTEGER
            """)
            
            # Adicionar foreign key constraint (SQLite não suporta ADD CONSTRAINT, então apenas adicionamos a coluna)
            # A constraint será aplicada quando o modelo for recriado
            
            conn.commit()
            print("[OK] Coluna 'plant_id' adicionada com sucesso!")
            
        except sqlite3.Error as e:
            print(f"[ERRO] Erro ao adicionar coluna: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

if __name__ == '__main__':
    print("=== MIGRAÇÃO: Adicionar coluna plant_id à tabela user ===\n")
    migrate_add_plant_id_to_user()
    print("\n=== MIGRAÇÃO CONCLUÍDA ===")

