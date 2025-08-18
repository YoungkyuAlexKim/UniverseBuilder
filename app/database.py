import sqlite3
import json
import os # 이 줄을 추가하세요

DATABASE_NAME = "scenario_builder.db"
# Render의 영구 디스크 경로를 기본으로 사용하고, 없으면 현재 폴더에 생성
# 이렇게 하면 로컬 테스트와 배포 환경 모두에서 잘 작동합니다.
DATA_DIR = os.environ.get("RENDER_DISK_PATH", ".")
DATABASE_NAME = os.path.join(DATA_DIR, "scenario_builder.db")
def get_db_connection():
    """데이터베이스 연결을 생성하고 반환합니다."""
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """데이터베이스 테이블을 초기화하고, 모든 테이블이 존재하는지 확인 및 생성합니다."""
    conn = get_db_connection()
    
    # 각 테이블에 대해 'IF NOT EXISTS'를 사용하여 안전하게 생성
    conn.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            goal TEXT,
            personality TEXT,
            abilities TEXT,
            quote TEXT,
            introduction_story TEXT,
            ordering INTEGER,
            FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS worldviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL UNIQUE,
            content TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')
    
    conn.execute('''
        CREATE TABLE IF NOT EXISTS worldview_groups (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS worldview_cards (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            title TEXT,
            content TEXT,
            ordering INTEGER,
            FOREIGN KEY (group_id) REFERENCES worldview_groups (id) ON DELETE CASCADE
        )
    ''')

    # [신규] 캐릭터 관계도 테이블 생성
    conn.execute('''
        CREATE TABLE IF NOT EXISTS relationships (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            source_character_id TEXT NOT NULL,
            target_character_id TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
            FOREIGN KEY (source_character_id) REFERENCES cards (id) ON DELETE CASCADE,
            FOREIGN KEY (target_character_id) REFERENCES cards (id) ON DELETE CASCADE
        )
    ''')


    # "미분류" 그룹 자동 추가 로직 (기존과 동일)
    projects = conn.execute('SELECT * FROM projects').fetchall()
    for project in projects:
        default_group = conn.execute('SELECT id FROM groups WHERE project_id = ? AND name = ?', (project['id'], '미분류')).fetchone()
        if not default_group:
            uncategorized_group_id = f"group-uncategorized-{project['id'].split('-')[1]}"
            conn.execute('INSERT INTO groups (id, project_id, name) VALUES (?, ?, ?)',
                         (uncategorized_group_id, project['id'], '미분류'))

    conn.commit()
    conn.close()

def migrate_json_to_db():
    """기존 projects.json 데이터를 DB로 옮깁니다."""
    try:
        with open('projects.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        return 

    conn = get_db_connection()
    
    for project_data in data.get("projects", []):
        conn.execute('INSERT OR IGNORE INTO projects (id, name) VALUES (?, ?)',
                     (project_data['id'], project_data['name']))
        
        for group_data in project_data.get("groups", []):
            conn.execute('INSERT OR IGNORE INTO groups (id, project_id, name) VALUES (?, ?, ?)',
                         (group_data['id'], project_data['id'], group_data['name']))
            
            for card_data in group_data.get("cards", []):
                conn.execute('''
                    INSERT OR IGNORE INTO cards (id, group_id, name, description, goal, personality, abilities, quote, introduction_story)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    card_data.get('id'), group_data.get('id'), card_data.get('name'), card_data.get('description'),
                    card_data.get('goal'), card_data.get('personality'), card_data.get('abilities'),
                    card_data.get('quote'), card_data.get('introduction_story')
                ))

    conn.commit()
    conn.close()
    print("JSON 데이터의 데이터베이스 마이그레이션이 완료되었습니다.")