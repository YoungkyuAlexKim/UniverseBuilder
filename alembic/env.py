import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# 프로젝트의 app 폴더를 파이썬 경로에 추가합니다.
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# 우리 프로젝트의 데이터베이스 모델과, 핵심 'engine' 객체를 가져옵니다.
from app.database import Base, engine as app_engine

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 우리 프로젝트의 모델 메타데이터를 사용하도록 설정합니다.
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    # 로컬 SQLite URL을 직접 사용합니다.
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
    """Run migrations in 'online' mode."""
    # app/database.py 에서 가져온 engine 객체를 직접 사용합니다.
    # 이렇게 하면 Render 환경과 로컬 환경을 자동으로 처리할 수 있습니다.
    connectable = app_engine

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