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
    # 데이터베이스 종류(dialect) 확인
    bind = op.get_bind()
    dialect = bind.dialect.name

    # PostgreSQL의 경우 외래 키 제약조건을 먼저 제거해야 함
    if dialect == 'postgresql':
        op.drop_constraint('relationships_source_character_id_fkey', 'relationships', type_='foreignkey')
        op.drop_constraint('relationships_target_character_id_fkey', 'relationships', type_='foreignkey')

    # 1. 임시 테이블 생성
    op.create_table('cards_temp',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('group_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('goal', sa.JSON(), nullable=True),
        sa.Column('personality', sa.JSON(), nullable=True),
        sa.Column('abilities', sa.JSON(), nullable=True),
        sa.Column('quote', sa.JSON(), nullable=True),
        sa.Column('introduction_story', sa.Text(), nullable=True),
        sa.Column('ordering', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], )
    )

    # 2. 기존 데이터를 JSON으로 변환하여 복사
    # PostgreSQL과 SQLite의 문법이 다르므로 분기 처리
    if dialect == 'postgresql':
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
    else: # SQLite
        op.execute("""
            INSERT INTO cards_temp (id, group_id, name, description, goal, personality, abilities, quote, introduction_story, ordering)
            SELECT
                id,
                group_id,
                name,
                description,
                CASE WHEN goal IS NULL OR goal = '' THEN NULL ELSE goal END,
                CASE WHEN personality IS NULL OR personality = '' THEN NULL ELSE personality END,
                CASE WHEN abilities IS NULL OR abilities = '' THEN NULL ELSE abilities END,
                CASE WHEN quote IS NULL OR quote = '' THEN NULL ELSE quote END,
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

    # PostgreSQL의 경우 외래 키 제약조건을 다시 생성
    if dialect == 'postgresql':
        op.create_foreign_key('relationships_source_character_id_fkey', 'relationships', 'cards', ['source_character_id'], ['id'])
        op.create_foreign_key('relationships_target_character_id_fkey', 'relationships', 'cards', ['target_character_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.drop_constraint('relationships_source_character_id_fkey', 'relationships', type_='foreignkey')
        op.drop_constraint('relationships_target_character_id_fkey', 'relationships', type_='foreignkey')

    # 1. 임시 테이블 생성 (TEXT 타입으로)
    op.create_table('cards_temp',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('group_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('goal', sa.Text(), nullable=True),
        sa.Column('personality', sa.Text(), nullable=True),
        sa.Column('abilities', sa.Text(), nullable=True),
        sa.Column('quote', sa.Text(), nullable=True),
        sa.Column('introduction_story', sa.Text(), nullable=True),
        sa.Column('ordering', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], )
    )

    # 2. 기존 데이터를 TEXT로 변환하여 복사
    op.execute("""
        INSERT INTO cards_temp (id, group_id, name, description, goal, personality, abilities, quote, introduction_story, ordering)
        SELECT
            id,
            group_id,
            name,
            description,
            CAST(goal AS TEXT),
            CAST(personality AS TEXT),
            CAST(abilities AS TEXT),
            CAST(quote AS TEXT),
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

    if dialect == 'postgresql':
        op.create_foreign_key('relationships_source_character_id_fkey', 'relationships', 'cards', ['source_character_id'], ['id'])
        op.create_foreign_key('relationships_target_character_id_fkey', 'relationships', 'cards', ['target_character_id'], ['id'])