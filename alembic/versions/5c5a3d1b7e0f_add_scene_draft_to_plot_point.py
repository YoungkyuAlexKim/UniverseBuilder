"""Add scene_draft to plot_point

Revision ID: 5c5a3d1b7e0f
Revises: 4a7c8b2f1e9d
Create Date: 2025-08-26 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c5a3d1b7e0f'
down_revision: Union[str, Sequence[str], None] = '4a7c8b2f1e9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('plot_points', sa.Column('scene_draft', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('plot_points', 'scene_draft')