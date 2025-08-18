import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
# [신규] SQLAlchemy의 create_engine을 직접 사용하기 위해 추가합니다.
from sqlalchemy import create_engine

from alembic import context

# [신규] 프로젝트의 app 폴더를 파이썬 경로에 추가합니다.
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# [신규] 우리 프로젝트의 데이터베이스 모델을 가져옵니다.
from app.database import Base, DATABASE_URL as app_db_url, DATABASE_NAME

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# [신규] Render PostgreSQL과 로컬 SQLite를 모두 지원하기 위해
# 데이터베이스 URL을 동적으로 설정합니다.
def get_url():
    # Render 환경 변수가 있으면 그것을 사용
    if app_db_url and app_db_url.startswith("postgres"):
        return app_db_url
    # 그렇지 않으면 로컬 SQLite 경로를 사용
    return f"sqlite:///{DATABASE_NAME}"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # [수정] engine_from_config 대신, get_url() 함수로
    # 데이터베이스 URL을 직접 가져와 엔진을 생성합니다.
    # 이렇게 하면 설정 파일을 찾는 데서 오는 오류를 원천적으로 방지할 수 있습니다.
    connectable = create_engine(get_url())

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