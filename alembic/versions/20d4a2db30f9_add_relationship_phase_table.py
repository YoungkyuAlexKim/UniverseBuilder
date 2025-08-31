"""Add RelationshipPhase table for relationship timeline system

Revision ID: 20d4a2db30f9
Revises: 989db4cb1e1f
Create Date: 2024-01-15 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20d4a2db30f9'
down_revision: Union[str, Sequence[str], None] = '989db4cb1e1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # RelationshipPhase 테이블 생성
    op.create_table('relationship_phases',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('relationship_id', sa.String(), nullable=False),
        sa.Column('phase_order', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('trigger_description', sa.Text(), nullable=True),
        sa.Column('source_to_target_address', sa.String(), nullable=True),
        sa.Column('source_to_target_tone', sa.Text(), nullable=True),
        sa.Column('target_to_source_address', sa.String(), nullable=True),
        sa.Column('target_to_source_tone', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['relationship_id'], ['relationships.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    # 인덱스 생성
    op.create_index(op.f('ix_relationship_phases_relationship_id'), 'relationship_phases', ['relationship_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # 인덱스 제거
    op.drop_index(op.f('ix_relationship_phases_relationship_id'), table_name='relationship_phases')
    # 테이블 제거
    op.drop_table('relationship_phases')
