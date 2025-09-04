"""Change card fields to JSON type

Revision ID: 15208e8d9a4a
Revises: 5665cc4fb703
Create Date: 2025-08-31 19:07:23.021344

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15208e8d9a4a'
down_revision: Union[str, Sequence[str], None] = '5665cc4fb703'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite에서는 ALTER COLUMN을 지원하지 않으므로 수동 마이그레이션 수행
    # 1. 임시 테이블 생성
    op.execute("""
        CREATE TABLE cards_temp (
            id VARCHAR NOT NULL,
            group_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            description TEXT,
            goal JSON,
            personality JSON,
            abilities JSON,
            quote JSON,
            introduction_story TEXT,
            ordering INTEGER,
            PRIMARY KEY (id),
            FOREIGN KEY(group_id) REFERENCES groups (id)
        )
    """)

    # 2. 기존 데이터를 JSON으로 변환하여 복사
    op.execute("""
        INSERT INTO cards_temp (id, group_id, name, description, goal, personality, abilities, quote, introduction_story, ordering)
        SELECT
            id,
            group_id,
            name,
            description,
            CASE WHEN goal IS NULL OR goal = '' THEN NULL ELSE goal::jsonb END,
            CASE WHEN personality IS NULL OR personality = '' THEN NULL ELSE personality::jsonb END,
            CASE WHEN abilities IS NULL OR abilities = '' THEN NULL ELSE abilities::jsonb END,
            CASE WHEN quote IS NULL OR quote = '' THEN NULL ELSE quote::jsonb END,
            introduction_story,
            ordering
        FROM cards
    """)

    # 3. 기존 테이블 삭제
    op.drop_table('cards')

    # 4. 임시 테이블을 원래 이름으로 변경
    op.rename_table('cards_temp', 'cards')

    # 5. 인덱스 재생성
    op.create_index('ix_cards_id', 'cards', ['id'])
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # SQLite에서는 ALTER COLUMN을 지원하지 않으므로 수동 마이그레이션 수행
    # 1. 임시 테이블 생성 (TEXT 타입으로)
    op.execute("""
        CREATE TABLE cards_temp (
            id VARCHAR NOT NULL,
            group_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            description TEXT,
            goal TEXT,
            personality TEXT,
            abilities TEXT,
            quote TEXT,
            introduction_story TEXT,
            ordering INTEGER,
            PRIMARY KEY (id),
            FOREIGN KEY(group_id) REFERENCES groups (id)
        )
    """)

    # 2. 기존 데이터를 TEXT로 변환하여 복사
    op.execute("""
        INSERT INTO cards_temp (id, group_id, name, description, goal, personality, abilities, quote, introduction_story, ordering)
        SELECT
            id,
            group_id,
            name,
            description,
            CASE WHEN goal IS NULL THEN NULL ELSE goal END,
            CASE WHEN personality IS NULL THEN NULL ELSE personality END,
            CASE WHEN abilities IS NULL THEN NULL ELSE abilities END,
            CASE WHEN quote IS NULL THEN NULL ELSE quote END,
            introduction_story,
            ordering
        FROM cards
    """)

    # 3. 기존 테이블 삭제
    op.drop_table('cards')

    # 4. 임시 테이블을 원래 이름으로 변경
    op.rename_table('cards_temp', 'cards')

    # 5. 인덱스 재생성
    op.create_index('ix_cards_id', 'cards', ['id'])
    # ### end Alembic commands ###
