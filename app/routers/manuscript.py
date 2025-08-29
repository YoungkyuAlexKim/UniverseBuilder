from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import time

from .. import database
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel, ManuscriptBlock as ManuscriptBlockModel
from .projects import get_project_if_accessible

# --- Pydantic 데이터 모델 ---

class ManuscriptBlock(BaseModel):
    id: str
    project_id: str
    title: str
    content: Optional[str] = None
    ordering: int

    class Config:
        from_attributes = True

class ManuscriptBlockUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class ManuscriptBlockOrderUpdateRequest(BaseModel):
    block_ids: List[str]


# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects/{project_id}/manuscript",
    tags=["Manuscript"]
)

# --- API 엔드포인트 ---
@router.get("/blocks", response_model=List[ManuscriptBlock])
def get_manuscript_blocks(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    특정 프로젝트에 속한 모든 집필 블록을 순서대로 정렬하여 반환합니다.
    """
    blocks = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.project_id == project.id
    ).order_by(ManuscriptBlockModel.ordering).all()
    return blocks

@router.post("/import", response_model=List[ManuscriptBlock])
def import_plot_points_to_manuscript(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    시나리오의 모든 플롯 포인트를 집필 블록으로 복사합니다.
    기존 집필 블록이 있다면 모두 삭제된 후 진행됩니다.
    """
    # 1. 기존 ManuscriptBlock 삭제
    db.query(ManuscriptBlockModel).filter(ManuscriptBlockModel.project_id == project.id).delete()

    # 2. 프로젝트의 첫 번째 시나리오와 그에 속한 플롯 포인트들을 가져옴
    scenario = db.query(ScenarioModel).filter(ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="시나리오를 찾을 수 없습니다.")

    plot_points = db.query(PlotPointModel).filter(PlotPointModel.scenario_id == scenario.id).order_by(PlotPointModel.ordering).all()

    # 3. 플롯 포인트를 기반으로 새로운 ManuscriptBlock 생성
    new_blocks = []
    for plot in plot_points:
        new_block = ManuscriptBlockModel(
            id=f"ms-block-{int(time.time() * 1000)}_{plot.ordering}",
            project_id=project.id,
            title=plot.title,
            content=plot.scene_draft or f"({plot.content})", # scene_draft가 없으면 content를 괄호에 넣어 사용
            ordering=plot.ordering
        )
        new_blocks.append(new_block)

    db.add_all(new_blocks)
    db.commit()

    # 4. 생성된 블록들을 다시 조회하여 반환
    return db.query(ManuscriptBlockModel).filter(ManuscriptBlockModel.project_id == project.id).order_by(ManuscriptBlockModel.ordering).all()

@router.delete("/blocks", status_code=204)
def clear_manuscript_blocks(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    특정 프로젝트에 속한 모든 집필 블록을 삭제합니다.
    """
    db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.project_id == project.id
    ).delete()
    db.commit()
    return None

@router.put("/blocks/{block_id}", response_model=ManuscriptBlock)
def update_manuscript_block(
    block_id: str,
    update_data: ManuscriptBlockUpdateRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    특정 집필 블록의 제목 또는 내용을 수정합니다.
    """
    block = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id == block_id,
        ManuscriptBlockModel.project_id == project.id
    ).first()

    if not block:
        raise HTTPException(status_code=404, detail="수정할 블록을 찾을 수 없습니다.")

    if update_data.title is not None:
        block.title = update_data.title
    if update_data.content is not None:
        block.content = update_data.content

    db.commit()
    db.refresh(block)
    return block

@router.put("/blocks/order")
def update_manuscript_block_order(
    update_request: ManuscriptBlockOrderUpdateRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    집필 블록들의 순서를 업데이트합니다.
    """
    for index, block_id in enumerate(update_request.block_ids):
        db.query(ManuscriptBlockModel).filter(
            ManuscriptBlockModel.id == block_id,
            ManuscriptBlockModel.project_id == project.id
        ).update({"ordering": index})
    db.commit()
    return {"message": "블록 순서가 성공적으로 업데이트되었습니다."}