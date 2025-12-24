#!/usr/bin/env python3
"""
Script de migração para adicionar a coluna motivo_reagendamento à tabela appointment
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(__file__))

from src.main import app

def migrate_add_motivo_reagendamento():
    """Adiciona a coluna motivo_reagendamento à tabela appointment"""
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
            cursor.execute("PRAGMA table_info(appointment)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'motivo_reagendamento' in columns:
                print("[OK] A coluna 'motivo_reagendamento' ja existe na tabela appointment.")
                return
            
            print("Adicionando coluna 'motivo_reagendamento' a tabela appointment...")
            
            # Adicionar a coluna
            cursor.execute("""
                ALTER TABLE appointment 
                ADD COLUMN motivo_reagendamento VARCHAR(500)
            """)
            
            conn.commit()
            print("[OK] Coluna 'motivo_reagendamento' adicionada com sucesso!")
            
        except sqlite3.Error as e:
            print(f"[ERRO] Erro ao adicionar coluna: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

if __name__ == '__main__':
    print("=== MIGRAÇÃO: Adicionar motivo_reagendamento ===\n")
    migrate_add_motivo_reagendamento()
    print("\n=== MIGRAÇÃO CONCLUÍDA ===")

