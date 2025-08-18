import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- 이 아래 코드를 추가해주세요 ---
# Render의 DATABASE_URL 환경 변수를 읽어 alembic.ini의 설정을 덮어씁니다.
database_url = os.environ.get("DATABASE_URL")
if database_url:
    # Render의 postgres 주소는 postgresql로 시작할 수 있으므로 변경해줍니다.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    config.set_main_option("sqlalchemy.url", database_url)
    
# --- 여기까지 추가 ---
# 프로젝트의 app 폴더를 파이썬 경로에 추가합니다.
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# 데이터베이스 모델을 가져옵니다.
from app.database import Base

# Alembic Config 객체
config = context.config

# 로깅 설정
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 모델 메타데이터 설정
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """오프라인 모드 마이그레이션 실행"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드 마이그레이션 실행"""
    # alembic.ini 파일의 설정으로 엔진을 생성합니다.
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()