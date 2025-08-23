from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import time
import json
from pydantic import BaseModel
from typing import List, Optional

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel
from .projects import get_project_if_accessible # 프로젝트 접근 권한 확인 함수 임포트

# --- Pydantic 데이터 모델 ---

class PlotPointBase(BaseModel):
    title: str
    content: Optional[str] = None

class PlotPoint(PlotPointBase):
    id: str
    scenario_id: str
    ordering: int

    class Config:
        orm_mode = True

class ScenarioBase(BaseModel):
    title: str
    summary: Optional[str] = None
    themes: Optional[List[str]] = None

class Scenario(ScenarioBase):
    id: str
    project_id: str
    plot_points: List[PlotPoint] = []

    class Config:
        orm_mode = True

# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects/{project_id}/scenarios",
    tags=["Scenarios"]
)

# --- 유틸리티 함수 ---
def parse_scenario_fields(scenario_obj):
    """DB에서 가져온 Scenario 객체의 JSON 문자열 필드를 리스트로 변환"""
    if scenario_obj.themes and isinstance(scenario_obj.themes, str):
        try:
            scenario_obj.themes = json.loads(scenario_obj.themes)
        except json.JSONDecodeError:
            # 쉼표로 구분된 문자열을 리스트로 변환 (예전 데이터 호환용)
            scenario_obj.themes = [theme.strip() for theme in scenario_obj.themes.split(',') if theme.strip()]
    elif not scenario_obj.themes:
        scenario_obj.themes = []
    
    # plot_points 정렬
    if scenario_obj.plot_points:
        scenario_obj.plot_points.sort(key=lambda x: (x.ordering is None, x.ordering))
        
    return scenario_obj

# --- API 엔드포인트 ---

@router.get("", response_model=List[Scenario])
def get_scenarios_for_project(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    특정 프로젝트에 속한 모든 시나리오를 가져옵니다.
    """
    scenarios = db.query(ScenarioModel).filter(ScenarioModel.project_id == project.id).all()
    return [parse_scenario_fields(s) for s in scenarios]

@router.put("/{scenario_id}", response_model=Scenario)
def update_scenario_details(scenario_id: str, scenario_data: ScenarioBase, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    시나리오의 제목, 요약, 테마 등을 수정합니다.
    """
    scenario = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id, ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="시나리오를 찾을 수 없습니다.")

    scenario.title = scenario_data.title
    scenario.summary = scenario_data.summary
    if scenario_data.themes is not None:
        scenario.themes = json.dumps(scenario_data.themes, ensure_ascii=False)
    
    db.commit()
    db.refresh(scenario)
    return parse_scenario_fields(scenario)

@router.post("/{scenario_id}/generate-draft", response_model=Scenario)
async def generate_scenario_draft_with_ai(scenario_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    AI를 사용하여 시나리오 전체 플롯 초안을 생성합니다.
    """
    # TODO: AI 호출 및 DB 저장 로직 추가
    raise HTTPException(status_code=501, detail="아직 구현되지 않은 기능입니다.")

@router.post("/{scenario_id}/plot_points", response_model=PlotPoint)
def create_plot_point(scenario_id: str, plot_point_data: PlotPointBase, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    시나리오에 새로운 플롯 포인트를 수동으로 추가합니다.
    """
    scenario = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id, ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="상위 시나리오를 찾을 수 없습니다.")

    new_plot_point_id = f"plot-{int(time.time() * 1000)}"
    # ordering은 기존 플롯 개수 + 1
    ordering = len(scenario.plot_points)
    
    new_plot_point = PlotPointModel(
        id=new_plot_point_id,
        scenario_id=scenario_id,
        title=plot_point_data.title,
        content=plot_point_data.content,
        ordering=ordering
    )
    
    db.add(new_plot_point)
    db.commit()
    db.refresh(new_plot_point)
    return new_plot_point

@router.put("/plot_points/{plot_point_id}", response_model=PlotPoint)
def update_plot_point(plot_point_id: str, plot_point_data: PlotPointBase, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    특정 플롯 포인트의 내용을 수정합니다.
    """
    plot_point = db.query(PlotPointModel).join(ScenarioModel).filter(
        PlotPointModel.id == plot_point_id,
        ScenarioModel.project_id == project.id
    ).first()

    if not plot_point:
        raise HTTPException(status_code=404, detail="플롯 포인트를 찾을 수 없거나 권한이 없습니다.")

    plot_point.title = plot_point_data.title
    plot_point.content = plot_point_data.content
    
    db.commit()
    db.refresh(plot_point)
    return plot_point

@router.delete("/plot_points/{plot_point_id}")
def delete_plot_point(plot_point_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    """
    플롯 포인트를 삭제합니다.
    """
    plot_point = db.query(PlotPointModel).join(ScenarioModel).filter(
        PlotPointModel.id == plot_point_id,
        ScenarioModel.project_id == project.id
    ).first()

    if not plot_point:
        raise HTTPException(status_code=404, detail="삭제할 플롯 포인트를 찾을 수 없거나 권한이 없습니다.")
    
    db.delete(plot_point)
    db.commit()
    return {"message": "플롯 포인트가 성공적으로 삭제되었습니다."}