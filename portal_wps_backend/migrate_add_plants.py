#!/usr/bin/env python3
"""
Script de migração para criar a tabela plants
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(__file__))

from src.main import app

def migrate_add_plants():
    """Cria a tabela plants"""
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
            # Verificar se a tabela já existe
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='plants'")
            table_exists = cursor.fetchone() is not None
            
            if table_exists:
                print("[OK] A tabela 'plants' já existe no banco de dados.")
                return
            
            print("Criando tabela 'plants'...")
            
            # Criar a tabela
            cursor.execute("""
                CREATE TABLE plants (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL,
                    code VARCHAR(50),
                    email VARCHAR(120),
                    phone VARCHAR(20),
                    cep VARCHAR(10),
                    street VARCHAR(200),
                    number VARCHAR(20),
                    neighborhood VARCHAR(100),
                    reference VARCHAR(200),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """)
            
            conn.commit()
            print("[OK] Tabela 'plants' criada com sucesso!")
            
        except sqlite3.Error as e:
            print(f"[ERRO] Erro ao criar tabela: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

if __name__ == '__main__':
    print("=== MIGRAÇÃO: Criar tabela plants ===\n")
    migrate_add_plants()
    print("\n=== MIGRAÇÃO CONCLUÍDA ===")

