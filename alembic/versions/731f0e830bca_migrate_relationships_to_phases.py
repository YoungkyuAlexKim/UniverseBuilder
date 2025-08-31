"""Migrate existing relationships to relationship phases

Revision ID: 731f0e830bca
Revises: 20d4a2db30f9
Create Date: 2024-01-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '731f0e830bca'
down_revision: Union[str, Sequence[str], None] = '20d4a2db30f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema and migrate data."""

    # 기존 Relationship 데이터를 RelationshipPhase로 마이그레이션
    # 각 관계의 phase_order=1 데이터를 Phase 1로 변환

    # 1. 기존 관계 데이터를 Phase 1로 변환하여 삽입
    op.execute("""
        INSERT INTO relationship_phases (
            id,
            relationship_id,
            phase_order,
            type,
            description,
            trigger_description
        )
        SELECT
            'phase-' || id || '-1',  -- 고유 ID 생성
            id,                     -- 관계 ID
            COALESCE(phase_order, 1), -- 단계 번호 (기본값 1)
            type,                   -- 관계 유형
            description,            -- 관계 설명
            '기본 관계 (자동 마이그레이션)'  -- 트리거 설명
        FROM relationships
        WHERE id IS NOT NULL
    """)

    # 2. 마이그레이션 완료 로그 (선택적)
    # 이 쿼리는 실제 데이터 변환을 수행하지 않고 확인용
    op.execute("""
        SELECT COUNT(*) as migrated_count FROM relationship_phases
    """)


def downgrade() -> None:
    """Downgrade schema and revert data migration."""

    # 마이그레이션된 데이터를 제거
    # 주의: 이 작업은 실제 데이터를 삭제하므로 신중하게 사용
    op.execute("""
        DELETE FROM relationship_phases
        WHERE trigger_description = '기본 관계 (자동 마이그레이션)'
    """)

    # 참고: RelationshipPhase 테이블 자체는 제거하지 않음
    # (향후 새로운 데이터가 추가될 수 있으므로)
