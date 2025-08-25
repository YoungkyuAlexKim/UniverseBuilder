"""Rename prologue column to synopsis

Revision ID: 4a7c8b2f1e9d
Revises: 3f8b1a9c2e0d
Create Date: 2025-01-27 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a7c8b2f1e9d'
down_revision: Union[str, Sequence[str], None] = '3f8b1a9c2e0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite 호환을 위한 단계별 컬럼 변경
    # 1. 새 컬럼 추가
    op.add_column('scenarios', sa.Column('synopsis', sa.Text(), nullable=True))
    
    # 2. 데이터 복사
    op.execute('UPDATE scenarios SET synopsis = prologue WHERE prologue IS NOT NULL')
    
    # 3. 기존 컬럼 삭제
    op.drop_column('scenarios', 'prologue')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. prologue 컬럼 추가
    op.add_column('scenarios', sa.Column('prologue', sa.Text(), nullable=True))
    
    # 2. 데이터 복사
    op.execute('UPDATE scenarios SET prologue = synopsis WHERE synopsis IS NOT NULL')
    
    # 3. synopsis 컬럼 삭제
    op.drop_column('scenarios', 'synopsis')