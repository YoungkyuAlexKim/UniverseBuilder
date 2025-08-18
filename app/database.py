import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import sqlite3 # 기존 연결 함수를 위해 남겨둡니다.

# Render PostgreSQL 접속 주소를 환경 변수에서 가져옵니다.
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres"):
    # 배포 환경 (PostgreSQL)
    engine = create_engine(DATABASE_URL)
else:
    # 로컬 환경 (SQLite)
    # 로컬 테스트를 위해 기존 SQLite 연결 방식을 유지합니다.
    DATA_DIR = "."
    DATABASE_NAME = os.path.join(DATA_DIR, "scenario_builder.db")
    engine = create_engine(f"sqlite:///{DATABASE_NAME}")

# SQLAlchemy 설정 (지금은 이 코드가 정확히 무엇인지는 몰라도 괜찮습니다)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 데이터베이스 연결을 위한 함수 (FastAPI에서 사용)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 기존 코드와의 호환성을 위해 남겨두는 함수
# 중요: 이 방식은 점차 SQLAlchemy 방식으로 바꿔나가야 합니다.
def get_db_connection():
    conn = sqlite3.connect("scenario_builder.db")
    conn.row_factory = sqlite3.Row
    return conn

# 데이터베이스 테이블 초기화 함수 (수정 필요)
def init_db():
    # 이 부분은 SQLAlchemy 모델을 정의한 후에 다시 만들어야 합니다.
    # 지금은 배포를 위해 임시로 비워두거나 pass를 사용합니다.
    pass