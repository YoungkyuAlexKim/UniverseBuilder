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

# --- Gemini API 설정 ---
AVAILABLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
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
    synopsis: Optional[str] = None # [변경] synopsis 필드

class Scenario(ScenarioBase):
    id: str
    project_id: str
    plot_points: List[PlotPoint] = []

    class Config:
        orm_mode = True

class GenerateDraftRequest(BaseModel):
    character_ids: List[str]
    plot_point_count: int = 10
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
    scenario.synopsis = scenario_data.synopsis # [변경] synopsis 저장 로직
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

    # [수정] 구조화된 세계관 데이터 파싱
    worldview_data = {"logline": "", "genre": "", "rules": []}
    if project.worldview and project.worldview.content:
        try:
            worldview_data = json.loads(project.worldview.content)
        except json.JSONDecodeError:
            pass # 파싱 실패 시 기본값 사용

    worldview_rules_context = f"### 이 세계의 절대 규칙\n- " + "\n- ".join(worldview_data.get("rules", [])) if worldview_data.get("rules") else ""
    story_genre_context = f"### 이야기 장르 및 분위기\n{worldview_data.get('genre', '정의되지 않음')}"
    
    selected_characters = db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()

    themes_list = json.loads(scenario.themes) if scenario.themes and scenario.themes != "[]" else []
    scenario_themes = f"### 핵심 테마\n{', '.join(themes_list)}" if themes_list else ""
    characters_context = "### 주요 등장인물\n" + "\n".join([f"- {c.name}: {c.description}" for c in selected_characters])
    story_concept = f"### 이야기 핵심 컨셉\n{scenario.summary}" if scenario.summary and scenario.summary.strip() else ""
    synopsis_context = f"### 시놉시스 / 전체 줄거리\n{scenario.synopsis}" if scenario.synopsis and scenario.synopsis.strip() else ""

    chosen_model = request.model_name or AVAILABLE_MODELS[0]
    model = genai.GenerativeModel(chosen_model)

    # [업그레이드] Flash 모델 활용한 풍성하고 맛깔나는 플롯 생성 프롬프트
    prompt = f"""[SYSTEM INSTRUCTION]
당신은 독자를 사로잡는 매력적인 스토리를 창조하는 베테랑 소설가입니다.
주어진 세계관과 캐릭터들을 바탕으로, 독자가 다음 페이지를 넘기고 싶어지는 흥미진진한 플롯을 설계해주세요.

[WORLD & CHARACTER CONTEXT]
{worldview_rules_context}
{story_genre_context}
{scenario_themes}
{characters_context}
{story_concept}
{synopsis_context}
---

[CREATIVE MISSION]
위의 모든 요소를 유기적으로 결합하여, **{request.plot_point_count}개의 플롯 포인트**로 구성된 몰입도 높은 스토리 아웃라인을 창조하세요.

**🎯 핵심 창작 원칙:**
1. **감정적 몰입**: 각 플롯 포인트는 독자의 감정을 자극하고 몰입하게 만들어야 합니다
2. **생생한 장면성**: 독자가 마치 영화를 보듯 상황을 상상할 수 있도록 구체적이고 감각적으로 묘사하세요
3. **캐릭터 중심**: 단순한 사건 나열이 아닌, 캐릭터의 감정 변화와 성장이 드러나야 합니다
4. **긴장감과 리듬**: 갈등의 고조-완화-재고조 패턴으로 독자를 끝까지 붙잡아야 합니다
5. **복선과 반전**: 자연스럽게 떡밥을 심고, 예상을 뒤엎는 반전을 준비하세요

**📝 플롯 포인트 작성 가이드:**
- **제목**: 해당 장면의 핵심 감정이나 전환점을 함축하는 드라마틱한 표현 (예: "배신의 진실", "운명적 만남", "마지막 선택")
- **내용**: 
  • 구체적인 상황과 배경 묘사
  • 캐릭터들의 감정과 내적 갈등
  • 중요한 대화나 행동의 순간
  • 다음 플롯으로 이어지는 자연스러운 연결고리
  • 독자의 호기심을 자극하는 요소

**🎨 스타일 가이드:**
- 생동감 있는 표현과 적절한 은유 사용
- 캐릭터의 개성이 드러나는 구체적 묘사
- 긴박함과 여유로움의 적절한 배치
- 독자가 감정이입할 수 있는 인간적 디테일 포함

**JSON 스키마:**
{{
  "plot_points": [
    {{
      "title": "드라마틱하고 함축적인 장면 제목",
      "content": "생생하고 감정적으로 몰입도 높은 장면 묘사 (상황, 캐릭터 감정, 갈등, 전개 요소 포함)"
    }}
  ]
}}

---
[FINAL OUTPUT INSTRUCTION]
반드시 유효한 JSON 형식으로만 응답하세요. 다른 설명이나 텍스트는 절대 포함하지 마세요.
"""
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
            raise HTTPException(status_code=500, detail="AI 모델 호출에 실패했습니다. (최대 재시도 횟수 초과)")

        if not response.parts:
            finish_reason_name = "UNKNOWN"
            if response.candidates and response.candidates[0].finish_reason:
                finish_reason_name = response.candidates[0].finish_reason.name

            if finish_reason_name == "SAFETY":
                raise HTTPException(
                    status_code=400,
                    detail="AI가 생성한 내용이 안전 필터에 의해 차단되었습니다. 컨셉이나 테마에 갈등 요소가 너무 직접적으로 묘사되었을 수 있습니다. 내용을 조금 수정 후 다시 시도해 주세요."
                )
            else:
                 raise HTTPException(
                    status_code=500,
                    detail=f"AI로부터 유효한 응답을 받지 못했습니다. (종료 사유: {finish_reason_name})"
                )

        try:
            cleaned_response_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
            ai_result = json.loads(cleaned_response_text)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail=f"AI가 유효하지 않은 응답을 반환했습니다. 잠시 후 다시 시도하거나 다른 모델을 선택해 주세요. (응답: {response.text[:100]})")

        if not ai_result.get("plot_points"):
            raise HTTPException(status_code=400, detail="AI가 컨텍스트를 처리하지 못했습니다. 컨셉이나 테마를 조금 더 구체적으로 작성한 후 다시 시도해 주세요.")

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
        if isinstance(e, HTTPException):
            raise e
        
        error_detail = f"AI 플롯 생성 중 서버 오류 발생: {e}"
        if 'response' in locals() and response:
            try:
                feedback = response.prompt_feedback
                error_detail += f" | Prompt Feedback: {feedback}"
            except Exception:
                error_detail += " | (AI 응답 객체에서 추가 정보를 가져오는 데 실패)"
        
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
    # [변경] 시놉시스 컨텍스트 추가
    synopsis_context = f"[시놉시스 / 전체 줄거리]\n{scenario.synopsis}" if scenario.synopsis and scenario.synopsis.strip() else ""


    # [업그레이드] 맛깔나는 플롯 포인트 편집을 위한 창의적 프롬프트
    prompt = f"""당신은 독자의 마음을 사로잡는 스토리텔링의 달인입니다.
전체 이야기의 흐름과 분위기를 완벽히 이해하고, 한 장면 한 장면을 더욱 생생하고 몰입도 높게 다듬는 전문가입니다.

아래 스토리의 맥락을 파악하고, 지정된 플롯 포인트를 사용자의 요청에 따라 더욱 매력적으로 개선해주세요.

**📖 스토리 전체 맥락**
{story_concept}
{synopsis_context}

**👥 핵심 인물들**
{characters_context}

**🎬 전체 스토리 흐름**
{full_story_context}

---
**🎯 수정 대상 장면**
현재 제목: "{plot_point_to_edit.title}"
현재 내용: "{plot_point_to_edit.content}"

**✨ 사용자 개선 요청**
"{request.user_prompt}"

---
**🎨 창작 가이드라인**
1. **감정의 깊이**: 단순한 사건 전개가 아닌, 캐릭터의 내적 변화와 감정을 생동감 있게 표현하세요
2. **장면의 생생함**: 독자가 그 순간을 생생히 상상할 수 있도록 구체적이고 감각적으로 묘사하세요
3. **스토리 연결성**: 전후 맥락과 자연스럽게 어우러지면서도 이 장면만의 독특함을 살려주세요
4. **드라마틱 임팩트**: 독자의 호기심과 몰입도를 높이는 긴장감과 매력 포인트를 강화하세요
5. **캐릭터 일관성**: 등장인물들의 개성과 성격이 일관되게 반영되도록 하세요

**📝 결과물 요구사항**
- **제목**: 해당 장면의 핵심 감정이나 드라마를 함축하는 매력적인 표현
- **내용**: 생생하고 몰입감 있는 장면 묘사 (상황, 감정, 갈등, 분위기 포함)

**JSON 스키마:**
{{
  "title": "개선된 드라마틱한 장면 제목",
  "content": "더욱 생생하고 매력적으로 개선된 장면 묘사"
}}

반드시 유효한 JSON 형식으로만 응답하세요."""
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
