"""Add phase_order to relationships

Revision ID: 989db4cb1e1f
Revises: eb3feabd6c5c
Create Date: 2024-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '989db4cb1e1f'
down_revision: Union[str, Sequence[str], None] = 'eb3feabd6c5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # phase_order 컬럼 추가 (기본값 1)
    op.add_column('relationships', sa.Column('phase_order', sa.Integer(), nullable=False, default=1))


def downgrade() -> None:
    """Downgrade schema."""
    # phase_order 컬럼 제거
    op.drop_column('relationships', 'phase_order')
