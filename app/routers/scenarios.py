from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import time
import json
import os
import asyncio
from pydantic import BaseModel
from typing import List, Optional

# --- Gemini AI 관련 임포트 ---
import google.generativeai as genai
from google.generativeai.types import GenerationConfig, HarmCategory, HarmBlockThreshold
from google.api_core import exceptions as google_exceptions

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel, Card as CardModel, Worldview as WorldviewModel
from .projects import get_project_if_accessible
# [신규] 프롬프트 설정을 불러오기 위한 임포트
from ..config import ai_prompts

# --- Gemini API 설정 ---
AVAILABLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


# --- Pydantic 데이터 모델 ---

class PlotPointBase(BaseModel):
    title: str
    content: Optional[str] = None
    scene_draft: Optional[str] = None

class PlotPoint(PlotPointBase):
    id: str
    scenario_id: str
    ordering: int
    scene_draft: Optional[str] = None

    class Config:
        from_attributes = True

class ScenarioBase(BaseModel):
    title: str
    summary: Optional[str] = None
    themes: Optional[List[str]] = None
    synopsis: Optional[str] = None

class Scenario(ScenarioBase):
    id: str
    project_id: str
    plot_points: List[PlotPoint] = []

    class Config:
        from_attributes = True

class GenerateDraftRequest(BaseModel):
    character_ids: List[str]
    plot_point_count: int = 10
    model_name: Optional[str] = None

class AIEditPlotPointRequest(BaseModel):
    user_prompt: str
    character_ids: List[str]
    model_name: Optional[str] = None

class GenerateSceneRequest(BaseModel):
    output_format: str
    character_ids: Optional[List[str]] = None
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
    scenario.synopsis = scenario_data.synopsis
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

    world_data = {"logline": "", "genre": "", "rules": []}
    if project.worldview and project.worldview.content:
        try:
            world_data = json.loads(project.worldview.content)
        except json.JSONDecodeError:
            pass

    worldview_rules_context = f"### 이 세계의 절대 규칙\n- " + "\n- ".join(world_data.get("rules", [])) if world_data.get("rules") else ""
    story_genre_context = f"### 이야기 장르 및 분위기\n{world_data.get('genre', '정의되지 않음')}"
    
    selected_characters = db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()

    themes_list = json.loads(scenario.themes) if scenario.themes and scenario.themes != "[]" else []
    scenario_themes = f"### 핵심 테마\n{', '.join(themes_list)}" if themes_list else ""
    characters_context = "### 주요 등장인물\n" + "\n".join([f"- {c.name}: {c.description}" for c in selected_characters])
    story_concept = f"### 이야기 핵심 컨셉\n{scenario.summary}" if scenario.summary and scenario.summary.strip() else ""
    synopsis_context = f"### 시놉시스 / 전체 줄거리\n{scenario.synopsis}" if scenario.synopsis and scenario.synopsis.strip() else ""

    chosen_model = request.model_name or AVAILABLE_MODELS[0]
    model = genai.GenerativeModel(chosen_model)

    prompt = ai_prompts.scenario_draft.format(
        worldview_rules_context=worldview_rules_context,
        story_genre_context=story_genre_context,
        scenario_themes=scenario_themes,
        characters_context=characters_context,
        story_concept=story_concept,
        prologue_context=synopsis_context, # prologue_context is a legacy name
        plot_point_count=request.plot_point_count
    )
    
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        
        response = None
        max_retries = 3
        delay = 1.0
        for attempt in range(max_retries):
            try:
                response = await model.generate_content_async(
                    prompt, 
                    generation_config=generation_config,
                    safety_settings=safety_settings
                )
                break
            except (google_exceptions.InternalServerError, google_exceptions.ServiceUnavailable) as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)
                    delay *= 2
                else:
                    raise e

        if response is None:
            raise HTTPException(status_code=500, detail="AI 모델 호출에 실패했습니다.")

        if not response.parts:
            finish_reason_name = "UNKNOWN"
            if response.candidates and response.candidates[0].finish_reason:
                finish_reason_name = response.candidates[0].finish_reason.name
            if finish_reason_name == "SAFETY":
                raise HTTPException(status_code=400, detail="AI 생성 내용이 안전 필터에 의해 차단되었습니다.")
            else:
                 raise HTTPException(status_code=500, detail=f"AI로부터 유효한 응답을 받지 못했습니다. (종료 사유: {finish_reason_name})")

        try:
            cleaned_response_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
            ai_result = json.loads(cleaned_response_text)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail=f"AI가 유효하지 않은 응답을 반환했습니다: {response.text[:100]}")

        if not ai_result.get("plot_points"):
            raise HTTPException(status_code=400, detail="AI가 컨텍스트를 처리하지 못했습니다.")

        db.query(PlotPointModel).filter(PlotPointModel.scenario_id == scenario_id).delete()
        db.commit()

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
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"AI 플롯 생성 중 서버 오류 발생: {e}")


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
    plot_point.scene_draft = plot_point_data.scene_draft

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

@router.post("/plot_points/{plot_point_id}/generate-scene", response_model=PlotPoint)
async def generate_scene_for_plot_point(plot_point_id: str, request: GenerateSceneRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    plot_point = db.query(PlotPointModel).join(ScenarioModel).filter(
        PlotPointModel.id == plot_point_id,
        ScenarioModel.project_id == project.id
    ).first()
    if not plot_point:
        raise HTTPException(status_code=404, detail="플롯 포인트를 찾을 수 없습니다.")

    # --- [신규] 4막 구조(기승전결) 컨텍스트 자동 계산 ---
    scenario = plot_point.scenario
    all_plot_points = sorted(scenario.plot_points, key=lambda p: p.ordering)
    total_plots = len(all_plot_points)
    current_plot_index = plot_point.ordering

    plot_position_context = ""
    plot_pacing_instruction = ""
    
    if total_plots > 0:
        percentage = (current_plot_index + 1) / total_plots
        if percentage <= 0.25:
            plot_position_context = "도입부 (기)"
            plot_pacing_instruction = "등장인물과 배경을 소개하고, 앞으로 전개될 사건의 실마리를 제시하며 독자의 호기심을 자극하세요. 아직 중요한 비밀은 밝히지 마세요."
        elif percentage <= 0.75:
            plot_position_context = "전개 (승)"
            plot_pacing_instruction = "이야기를 발전시키고 심화시키세요. 인물 간의 관계가 깊어지거나 갈등의 씨앗이 뿌려지는 과정을 보여주세요."
        elif percentage <= 0.9: # 75% ~ 90% 구간을 '전'으로 설정
            plot_position_context = "전환 (전)"
            plot_pacing_instruction = "이야기의 흐름을 완전히 바꾸는 예상치 못한 사건이나 반전을 등장시키세요. 이 장면을 통해 독자가 새로운 국면을 맞이하게 만들어야 합니다."
        else: # 90% 이후 구간을 '결'로 설정
            plot_position_context = "결말 (결)"
            plot_pacing_instruction = "지금까지의 모든 사건들을 하나로 묶어 명확한 결론을 내리세요. 인물의 최종적인 변화와 이야기의 주제를 드러내며 마무리하세요."

    # --- AI 컨텍스트 구성 ---
    worldview_data = json.loads(project.worldview.content) if project.worldview and project.worldview.content else {}
    
    character_ids = request.character_ids or []
    characters = db.query(CardModel).filter(CardModel.id.in_(character_ids)).all()
    characters_context = "\n".join([f"- {c.name}: {c.description}" for c in characters])
    character_names = ", ".join([c.name for c in characters]) if characters else "등장인물"

    format_map = {
        "novel": ai_prompts.scene_generation_novel,
        "screenplay": ai_prompts.scene_generation_screenplay,
        "game_dialogue": ai_prompts.scene_generation_game_dialogue
    }
    prompt_template = format_map.get(request.output_format)
    if not prompt_template:
        raise HTTPException(status_code=400, detail="지원하지 않는 출력 형식입니다.")

    prompt = prompt_template.format(
        worldview_genre=worldview_data.get('genre', '알 수 없음'),
        worldview_rules="\n- ".join(worldview_data.get('rules', [])),
        scenario_summary=scenario.summary,
        plot_title=plot_point.title,
        plot_content=plot_point.content,
        characters_context=characters_context,
        character_names=character_names,
        plot_position_context=plot_position_context,
        plot_pacing_instruction=plot_pacing_instruction
    )

    try:
        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        model = genai.GenerativeModel(chosen_model)
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }

        response = await model.generate_content_async(prompt, safety_settings=safety_settings)
        
        generated_text = response.text.strip()
        
        plot_point.scene_draft = generated_text
        db.commit()
        db.refresh(plot_point)

        return plot_point

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"AI 장면 생성 중 오류가 발생했습니다: {e}")


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
    synopsis_context = f"[시놉시스 / 전체 줄거리]\n{scenario.synopsis}" if scenario.synopsis and scenario.synopsis.strip() else ""


    prompt = ai_prompts.plot_point_edit.format(
        story_concept=story_concept,
        prologue_context=synopsis_context,
        characters_context=characters_context,
        full_story_context=full_story_context,
        plot_title=plot_point_to_edit.title,
        plot_content=plot_point_to_edit.content,
        user_prompt=request.user_prompt
    )
    try:
        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        model = genai.GenerativeModel(chosen_model)
        generation_config = GenerationConfig(response_mime_type="application/json")
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        response = await model.generate_content_async(
            prompt, 
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        try:
            cleaned_response_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
            ai_result = json.loads(cleaned_response_text)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail=f"AI가 유효하지 않은 응답을 반환했습니다. (응답: {response.text[:100]})")

        plot_point_to_edit.title = ai_result.get("title", plot_point_to_edit.title)
        plot_point_to_edit.content = ai_result.get("content", plot_point_to_edit.content)
        db.commit()
        db.refresh(plot_point_to_edit)

        return plot_point_to_edit

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        error_detail = f"AI 플롯 수정에 실패했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)
