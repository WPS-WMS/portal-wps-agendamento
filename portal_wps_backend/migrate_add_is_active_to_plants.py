#!/usr/bin/env python3
"""
Script de migração para adicionar a coluna is_active à tabela plants (se não existir)
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(__file__))

from src.main import app

def migrate_add_is_active_to_plants():
    """Adiciona a coluna is_active à tabela plants se não existir"""
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
            cursor.execute("PRAGMA table_info(plants)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'is_active' in columns:
                print("[OK] A coluna 'is_active' já existe na tabela plants.")
                # Atualizar registros existentes para ter is_active = True
                cursor.execute("UPDATE plants SET is_active = 1 WHERE is_active IS NULL")
                conn.commit()
                print("[OK] Registros existentes atualizados com is_active = True")
                return
            
            print("Adicionando coluna 'is_active' à tabela plants...")
            
            # Adicionar a coluna com valor padrão True
            cursor.execute("""
                ALTER TABLE plants 
                ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1
            """)
            
            conn.commit()
            print("[OK] Coluna 'is_active' adicionada com sucesso!")
            
        except sqlite3.Error as e:
            print(f"[ERRO] Erro ao adicionar coluna: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

if __name__ == '__main__':
    print("=== MIGRAÇÃO: Adicionar coluna is_active à tabela plants ===\n")
    migrate_add_is_active_to_plants()
    print("\n=== MIGRAÇÃO CONCLUÍDA ===")

