from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import time
import json
import os
from pydantic import BaseModel
from typing import List, Optional

# --- Gemini AI 관련 임포트 ---
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel, Card as CardModel, Worldview as WorldviewModel
from .projects import get_project_if_accessible

# --- Gemini API 설정 ---
AVAILABLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"]
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


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

# [수정] AI 초안 생성을 위한 요청 모델에 plot_point_count 추가
class GenerateDraftRequest(BaseModel):
    character_ids: List[str]
    plot_point_count: int = 10  # 기본값 10으로 설정
    model_name: Optional[str] = None

class AIEditPlotPointRequest(BaseModel):
    user_prompt: str
    character_ids: List[str]
    model_name: Optional[str] = None


# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects/{project_id}/scenarios",
    tags=["Scenarios"]
)

# --- 유틸리티 함수 ---
def parse_scenario_fields(scenario_obj):
    if scenario_obj.themes and isinstance(scenario_obj.themes, str):
        try:
            scenario_obj.themes = json.loads(scenario_obj.themes)
        except json.JSONDecodeError:
            scenario_obj.themes = [theme.strip() for theme in scenario_obj.themes.split(',') if theme.strip()]
    elif not scenario_obj.themes:
        scenario_obj.themes = []

    if scenario_obj.plot_points:
        scenario_obj.plot_points.sort(key=lambda x: (x.ordering is None, x.ordering))

    return scenario_obj

# --- API 엔드포인트 ---

@router.get("", response_model=List[Scenario])
def get_scenarios_for_project(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    scenarios = db.query(ScenarioModel).filter(ScenarioModel.project_id == project.id).all()
    return [parse_scenario_fields(s) for s in scenarios]

@router.put("/{scenario_id}", response_model=Scenario)
def update_scenario_details(scenario_id: str, scenario_data: ScenarioBase, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
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
async def generate_scenario_draft_with_ai(scenario_id: str, request: GenerateDraftRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    scenario = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id, ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="시나리오를 찾을 수 없습니다.")

    main_worldview = db.query(WorldviewModel).filter(WorldviewModel.project_id == project.id).first()
    selected_characters = db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()

    worldview_context = f"[메인 세계관]\n{main_worldview.content if main_worldview else '정의되지 않음'}"
    themes_list = json.loads(scenario.themes) if scenario.themes and scenario.themes != "[]" else []
    scenario_themes = f"[핵심 테마]\n{', '.join(themes_list)}" if themes_list else ""
    characters_context = "[주요 등장인물]\n" + "\n".join([f"- {c.name}: {c.description}" for c in selected_characters])
    story_concept = f"[이야기 핵심 컨셉]\n{scenario.summary}" if scenario.summary and scenario.summary.strip() else ""

    chosen_model = request.model_name or AVAILABLE_MODELS[0]
    model = genai.GenerativeModel(chosen_model)

    # [수정] 프롬프트에 플롯 포인트 개수 반영
    prompt = f"""당신은 3막 구조에 능숙한 전문 시나리오 작가입니다.
아래에 제공된 모든 정보를 종합하여, 흥미로운 이야기의 흐름을 가진 플롯 포인트 초안을 생성해주세요.

{worldview_context}
{scenario_themes}
{characters_context}
{story_concept}

**매우 중요한 규칙:**
1.  **HTML 태그는 절대 사용하지 말고, 순수한 텍스트로만 응답해야 합니다.**
2.  이야기는 **발단-전개-위기-절정-결말**의 3막 구조를 따라야 합니다.
3.  플롯은 **정확히 {request.plot_point_count}개**의 포인트로 나누어주세요.
4.  결과는 반드시 아래 명시된 JSON 스키마를 따르는 JSON 객체로만 응답해야 합니다.

**출력 JSON 스키마:**
{{
  "plot_points": [
    {{
      "title": "플롯 포인트의 제목",
      "content": "해당 플롯 포인트에서 발생하는 사건에 대한 2~3문장의 구체적인 설명."
    }}
  ]
}}
"""
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        ai_result = json.loads(response.text)

        db.query(PlotPointModel).filter(PlotPointModel.scenario_id == scenario_id).delete()

        new_plot_points = []
        for i, plot_data in enumerate(ai_result.get("plot_points", [])):
            new_plot = PlotPointModel(
                id=f"plot-{int(time.time() * 1000)}_{i}",
                scenario_id=scenario_id,
                title=plot_data.get("title"),
                content=plot_data.get("content"),
                ordering=i
            )
            new_plot_points.append(new_plot)

        db.add_all(new_plot_points)
        db.commit()
        db.refresh(scenario)

        return parse_scenario_fields(scenario)

    except Exception as e:
        db.rollback()
        error_detail = f"AI 플롯 생성에 실패했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/{scenario_id}/plot_points", response_model=PlotPoint)
def create_plot_point(scenario_id: str, plot_point_data: PlotPointBase, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    scenario = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id, ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="상위 시나리오를 찾을 수 없습니다.")

    new_plot_point_id = f"plot-{int(time.time() * 1000)}"
    max_ordering = db.query(func.max(PlotPointModel.ordering)).filter(PlotPointModel.scenario_id == scenario_id).scalar()
    ordering = (max_ordering or -1) + 1

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
    plot_point = db.query(PlotPointModel).join(ScenarioModel).filter(
        PlotPointModel.id == plot_point_id,
        ScenarioModel.project_id == project.id
    ).first()

    if not plot_point:
        raise HTTPException(status_code=404, detail="삭제할 플롯 포인트를 찾을 수 없거나 권한이 없습니다.")

    db.delete(plot_point)
    db.commit()
    return {"message": "플롯 포인트가 성공적으로 삭제되었습니다."}

@router.put("/plot_points/{plot_point_id}/edit-with-ai", response_model=PlotPoint)
async def edit_plot_point_with_ai(plot_point_id: str, request: AIEditPlotPointRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    plot_point_to_edit = db.query(PlotPointModel).join(ScenarioModel).filter(
        PlotPointModel.id == plot_point_id,
        ScenarioModel.project_id == project.id
    ).first()
    if not plot_point_to_edit:
        raise HTTPException(status_code=404, detail="수정할 플롯 포인트를 찾을 수 없습니다.")

    scenario = plot_point_to_edit.scenario
    all_plot_points = sorted(scenario.plot_points, key=lambda p: p.ordering)

    full_story_context = "\n".join([f"{i+1}. {p.title}: {p.content or ''}" for i, p in enumerate(all_plot_points)])
    characters = db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()
    characters_context = "[주요 등장인물]\n" + "\n".join([f"- {c.name}: {c.description}" for c in characters])
    story_concept = f"[이야기 핵심 컨셉]\n{scenario.summary}" if scenario.summary and scenario.summary.strip() else ""

    prompt = f"""당신은 이야기의 전체적인 일관성을 유지하며 특정 부분을 섬세하게 수정하는 전문 스토리 편집자입니다.
아래 제공된 '전체 스토리 흐름'을 참고하여, '수정 대상 플롯 포인트'를 사용자의 '수정 요청사항'에 맞게 수정해주세요.

[이야기 핵심 컨셉]
{story_concept}

[주요 등장인물]
{characters_context}

[전체 스토리 흐름]
{full_story_context}
---
[수정 대상 플롯 포인트]
- 제목: {plot_point_to_edit.title}
- 내용: {plot_point_to_edit.content}

[사용자 수정 요청사항]
"{request.user_prompt}"
---
**매우 중요한 규칙:**
1.  **오직 '수정 대상 플롯 포인트'의 제목과 내용만** 수정해야 합니다.
2.  수정된 내용은 '전체 스토리 흐름'의 맥락과 자연스럽게 연결되어야 합니다.
3.  결과는 반드시 아래 명시된 JSON 스키마 형식으로만 응답해야 합니다.

**출력 JSON 스키마:**
{{
  "title": "새롭게 수정된 플롯 제목",
  "content": "새롭게 수정된 플롯 내용 (2~3 문장)"
}}
"""
    try:
        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        model = genai.GenerativeModel(chosen_model)
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        ai_result = json.loads(response.text)

        plot_point_to_edit.title = ai_result.get("title", plot_point_to_edit.title)
        plot_point_to_edit.content = ai_result.get("content", plot_point_to_edit.content)
        db.commit()
        db.refresh(plot_point_to_edit)

        return plot_point_to_edit

    except Exception as e:
        db.rollback()
        error_detail = f"AI 플롯 수정에 실패했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)