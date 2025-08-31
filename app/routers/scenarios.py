from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import time
import json
import os
import asyncio
import re # [신규] 정규 표현식 모듈 추가
from pydantic import BaseModel
from typing import List, Optional

# --- Gemini AI 관련 임포트 ---
import google.generativeai as genai
from google.generativeai.types import GenerationConfig, HarmCategory, HarmBlockThreshold
from google.api_core import exceptions as google_exceptions

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel, Card as CardModel, Worldview as WorldviewModel, Relationship as RelationshipModel, Group as GroupModel
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
    style_guide_id: Optional[str] = None # [신규] 스타일 가이드 ID 필드 추가

class AIEditPlotPointRequest(BaseModel):
    user_prompt: str
    character_ids: List[str]
    model_name: Optional[str] = None

class AIEditPlotsRequest(BaseModel):
    user_prompt: str
    model_name: Optional[str] = None
    selected_plot_ids: Optional[List[str]] = None  # 선택된 플롯 ID들 (선택적)

class GenerateSceneRequest(BaseModel):
    output_format: str
    character_ids: Optional[List[str]] = None
    model_name: Optional[str] = None
    word_count: Optional[str] = "medium"
    style_guide_id: Optional[str] = None # [신규] 스타일 가이드 ID 필드 추가

class EditSceneRequest(BaseModel):
    user_edit_request: str
    output_format: str
    character_ids: Optional[List[str]] = None
    model_name: Optional[str] = None
    word_count: Optional[str] = "medium"
    style_guide_id: Optional[str] = None # [신규] 스타일 가이드 ID 필드 추가


# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects/{project_id}/scenarios",
    tags=["Scenarios"]
)

# --- [신규] 스타일 가이드 처리 유틸리티 함수 ---
def get_style_guide_content(style_guide_id: str, task_type: str) -> str:
    """
    스타일 가이드 파일을 읽고, 작업 유형(task_type)에 따라 내용을 필터링하여 반환합니다.
    - task_type: 'macro' (플롯 생성용), 'micro' (장면 묘사용)
    """
    if not style_guide_id:
        return ""

    # 보안을 위해 파일 이름에 디렉토리 경로 문자가 없는지 확인
    if ".." in style_guide_id or "/" in style_guide_id or "\\" in style_guide_id:
        return ""

    file_path = f"app/style_guides/{style_guide_id}.txt"
    if not os.path.exists(file_path):
        return ""

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            full_content = f.read()

        if task_type == 'macro':
            # 거시적(플롯) 작업에는 '서사 및 전개론'과 '작가의 습관' 부분만 추출
            # '플롯 전개 형식'이 '서사 및 전개론' 섹션에 포함될 것을 가정
            sections_to_extract = [
                r"IV\.\s*서사\s*및\s*전개론",
                r"VI\.\s*종합:\s*작가의\s*고유\s*습관"
            ]
            extracted_parts = []
            
            for section_pattern in sections_to_extract:
                # 정규 표현식을 사용하여 섹션 제목을 찾음
                match = re.search(f"({section_pattern}.*?)(?=\n[IVX]+\.|\Z)", full_content, re.DOTALL)
                if match:
                    extracted_parts.append(match.group(1).strip())
            
            if not extracted_parts:
                return ""
            
            macro_context = "\n\n---\n\n".join(extracted_parts)
            return f"\n\n### 참고할 문체 가이드 (거시적 전개 방식)\n{macro_context}\n"

        elif task_type == 'micro':
            # 미시적(장면) 작업에는 가이드라인 전체를 제공
            return f"\n\n### 반드시 준수해야 할 문체 가이드라인\n{full_content}\n"
            
        return ""
    except Exception:
        # 파일 읽기 오류 발생 시 빈 문자열 반환
        return ""


# --- 기존 유틸리티 함수 ---
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

def _get_surrounding_plot_context(current_plot_index: int, all_plot_points: List[PlotPointModel]) -> str:
    previous_scene_context = ""
    if current_plot_index > 0:
        previous_plot = all_plot_points[current_plot_index - 1]
        if previous_plot.scene_draft:
            previous_scene_context = f"### 이전 장면 내용 (참고용)\n{previous_plot.scene_draft}\n"

    next_scene_context = ""
    if current_plot_index < len(all_plot_points) - 1:
        next_plot = all_plot_points[current_plot_index + 1]
        if next_plot.scene_draft:
            next_scene_context = f"### 다음 장면 내용 (참고용)\n{next_plot.scene_draft}\n"

    surrounding_plots_summary = []
    start_index_prev = max(0, current_plot_index - 6)
    for i in range(start_index_prev, current_plot_index):
        plot = all_plot_points[i]
        surrounding_plots_summary.append(f"- (이전) {plot.ordering + 1}. {plot.title}: {plot.content or '요약 없음'}")
    
    end_index_next = min(len(all_plot_points), current_plot_index + 7)
    for i in range(current_plot_index + 1, end_index_next):
        plot = all_plot_points[i]
        surrounding_plots_summary.append(f"- (다음) {plot.ordering + 1}. {plot.title}: {plot.content or '요약 없음'}")

    summary_context = ""
    if surrounding_plots_summary:
        summary_context = "### 주변 플롯 요약 (전체 흐름 참고용)\n" + "\n".join(surrounding_plots_summary)

    final_context = f"{previous_scene_context}\n{summary_context}\n{next_scene_context}".strip()
    
    return final_context if final_context else "### 참고할 주변 플롯 정보가 없습니다.\n"


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

    # [수정] 스타일 가이드 컨텍스트를 'macro' 타입으로 가져옴
    style_guide_context = get_style_guide_content(request.style_guide_id, 'macro')

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

    # [수정] 프롬프트에 스타일 가이드 컨텍스트 추가
    prompt = ai_prompts.scenario_draft.format(
        worldview_rules_context=worldview_rules_context,
        story_genre_context=story_genre_context,
        scenario_themes=scenario_themes,
        characters_context=characters_context,
        story_concept=story_concept,
        prologue_context=synopsis_context,
        plot_point_count=request.plot_point_count,
        style_guide_context=style_guide_context # 스타일 가이드 컨텍스트 주입
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

@router.put("/{scenario_id}/edit-plots-with-ai")
async def edit_all_plot_points_with_ai(scenario_id: str, request: AIEditPlotsRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    scenario = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id, ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="시나리오를 찾을 수 없습니다.")
    if not scenario.plot_points:
        raise HTTPException(status_code=400, detail="수정할 플롯 포인트가 없습니다. 먼저 플롯을 생성해주세요.")

    # [신규] AI 제한 확인: 50개 초과시 제한
    if len(scenario.plot_points) > 50:
        raise HTTPException(
            status_code=400,
            detail=f"플롯 포인트가 너무 많습니다 ({len(scenario.plot_points)}개). AI 전체 수정 기능은 최대 50개까지 지원합니다. 집필 탭에서 플롯을 분할하거나 정리한 후 다시 시도해주세요."
        )

    world_data = json.loads(project.worldview.content) if project.worldview and project.worldview.content else {}
    worldview_rules_context = f"### 이 세계의 절대 규칙\n- " + "\n- ".join(world_data.get("rules", [])) if world_data.get("rules") else ""
    story_genre_context = f"### 이야기 장르 및 분위기\n{world_data.get('genre', '정의되지 않음')}"
    themes_list = json.loads(scenario.themes) if scenario.themes and scenario.themes != "[]" else []
    scenario_themes = f"### 핵심 테마\n{', '.join(themes_list)}" if themes_list else ""
    
    all_characters = db.query(CardModel).join(GroupModel).filter(GroupModel.project_id == project.id).all()
    characters_context = "### 주요 등장인물\n" + "\n".join([f"- {c.name}: {c.description}" for c in all_characters])
    story_concept = f"### 이야기 핵심 컨셉\n{scenario.summary}" if scenario.summary and scenario.summary.strip() else ""
    synopsis_context = f"### 시놉시스 / 전체 줄거리\n{scenario.synopsis}" if scenario.synopsis and scenario.synopsis.strip() else ""

    # 선택된 플롯만 처리 (선택적)
    if request.selected_plot_ids:
        sorted_plots = [p for p in sorted(scenario.plot_points, key=lambda p: p.ordering) if p.id in request.selected_plot_ids]
        if not sorted_plots:
            raise HTTPException(status_code=400, detail="선택된 플롯을 찾을 수 없습니다.")
    else:
        sorted_plots = sorted(scenario.plot_points, key=lambda p: p.ordering)

    plot_points_context = "\n".join([f"{i+1}. {p.title}: {p.content or ''}" for i, p in enumerate(sorted_plots)])
    plot_point_count = len(sorted_plots)

    # 선택 모드에서도 50개 제한 적용
    if plot_point_count > 50:
        raise HTTPException(
            status_code=400,
            detail=f"선택된 플롯이 너무 많습니다 ({plot_point_count}개). AI는 최대 50개까지 지원합니다."
        )

    prompt = ai_prompts.plot_points_edit.format(
        worldview_rules_context=worldview_rules_context,
        story_genre_context=story_genre_context,
        scenario_themes=scenario_themes,
        characters_context=characters_context,
        story_concept=story_concept,
        prologue_context=synopsis_context,
        plot_points_context=plot_points_context,
        user_prompt=request.user_prompt,
        plot_point_count=plot_point_count
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

        response = await model.generate_content_async(prompt, generation_config=generation_config, safety_settings=safety_settings)
        
        cleaned_response_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
        ai_result = json.loads(cleaned_response_text)

        if "plot_points" not in ai_result or len(ai_result["plot_points"]) != plot_point_count:
            raise HTTPException(status_code=500, detail=f"AI가 요청된 플롯 개수({plot_point_count}개)와 다른 수({len(ai_result.get('plot_points', []))}개)의 플롯을 반환했습니다.")

        return ai_result

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"AI가 유효하지 않은 JSON 응답을 반환했습니다: {response.text[:200]}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"AI 플롯 수정 중 서버 오류 발생: {e}")


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

@router.delete("/{scenario_id}/plot_points")
def delete_all_plot_points(scenario_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    scenario = db.query(ScenarioModel).filter(ScenarioModel.id == scenario_id, ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="시나리오를 찾을 수 없습니다.")

    num_deleted = db.query(PlotPointModel).filter(PlotPointModel.scenario_id == scenario_id).delete(synchronize_session=False)
    db.commit()
    
    return {"message": f"{num_deleted}개의 플롯 포인트가 성공적으로 삭제되었습니다."}

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

    # 삭제할 플롯 포인트가 속한 시나리오 ID 저장
    scenario_id = plot_point.scenario_id

    # 삭제 수행 및 세션에 반영 (아직 커밋하지 않음)
    db.delete(plot_point)
    db.flush()

    # 같은 시나리오의 남은 플롯 포인트들의 순서 재정렬
    remaining_plot_points = db.query(PlotPointModel).filter(
        PlotPointModel.scenario_id == scenario_id
    ).order_by(PlotPointModel.ordering).all()

    for index, plot_point in enumerate(remaining_plot_points):
        plot_point.ordering = index

    # 삭제와 순서 변경을 하나의 트랜잭션으로 커밋
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

    style_guide_context = get_style_guide_content(request.style_guide_id, 'micro')

    scenario = plot_point.scenario
    all_plot_points = sorted(scenario.plot_points, key=lambda p: p.ordering)
    surrounding_context = _get_surrounding_plot_context(plot_point.ordering, all_plot_points)
    
    # [수정] 문체 일관성을 위한 지침 추가
    if surrounding_context and "이전 장면 내용" in surrounding_context:
        style_guide_context += "\n\n**[문체 일관성 지침]**\n제공된 '이전 장면 내용'의 문체와 톤앤매너를 최대한 일관성 있게 유지하여 현재 장면을 작성해주세요."

    total_plots = len(all_plot_points)
    plot_position_context, plot_pacing_instruction = "", ""
    if total_plots > 0:
        percentage = (plot_point.ordering + 1) / total_plots
        if percentage <= 0.25:
            plot_position_context, plot_pacing_instruction = "도입부 (기)", "등장인물과 배경을 소개하고, 사건의 실마리를 제시하세요."
        elif percentage <= 0.75:
            plot_position_context, plot_pacing_instruction = "전개 (승)", "이야기를 발전시키고 갈등을 심화시키세요."
        elif percentage <= 0.9:
            plot_position_context, plot_pacing_instruction = "전환 (전)", "예상치 못한 반전이나 사건으로 흐름을 바꾸세요."
        else:
            plot_position_context, plot_pacing_instruction = "결말 (결)", "사건을 마무리하고 주제를 드러내세요."
            
    character_ids = request.character_ids or []
    characters = db.query(CardModel).filter(CardModel.id.in_(character_ids)).all()
    characters_context = "\n".join([f"- {c.name}: {c.description}" for c in characters])
    relationships_context = ""
    if len(character_ids) > 1:
        relationships = db.query(RelationshipModel).filter(
            RelationshipModel.source_character_id.in_(character_ids),
            RelationshipModel.target_character_id.in_(character_ids),
            RelationshipModel.project_id == project.id
        ).all()
        if relationships:
            char_name_map = {c.id: c.name for c in characters}
            relationship_descriptions = [f"- {char_name_map.get(r.source_character_id)} → {char_name_map.get(r.target_character_id)}: {r.type} ({r.description or ''})" for r in relationships]
            if relationship_descriptions:
                relationships_context = f"\n\n**[캐릭터 간 관계]**\n" + "\n".join(relationship_descriptions)
    word_count_map = {"short": "약 1000자 내외로 간결하게", "medium": "약 2000자 내외로", "long": "약 3000자 내외로 풍부하게"}
    word_count_instruction = word_count_map.get(request.word_count, word_count_map["medium"])
    format_map = {"novel": ai_prompts.scene_generation_novel, "screenplay": ai_prompts.scene_generation_screenplay, "game_dialogue": ai_prompts.scene_generation_game_dialogue}
    prompt_template = format_map.get(request.output_format)
    if not prompt_template:
        raise HTTPException(status_code=400, detail="지원하지 않는 출력 형식입니다.")
    prompt = prompt_template.format(
        plot_position_context=plot_position_context,
        plot_pacing_instruction=plot_pacing_instruction,
        word_count_instruction=word_count_instruction,
        surrounding_context=surrounding_context,
        plot_title=plot_point.title,
        plot_content=plot_point.content,
        characters_context=characters_context,
        relationships_context=relationships_context,
        style_guide_context=style_guide_context
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
        plot_point.scene_draft = response.text.strip()
        db.commit()
        db.refresh(plot_point)
        return plot_point
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"AI 장면 생성 중 오류 발생: {e}")

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


@router.put("/plot_points/{plot_point_id}/edit-scene", response_model=PlotPoint)
async def edit_scene_with_ai(plot_point_id: str, request: EditSceneRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    plot_point = db.query(PlotPointModel).join(ScenarioModel).filter(
        PlotPointModel.id == plot_point_id,
        ScenarioModel.project_id == project.id
    ).first()
    if not plot_point:
        raise HTTPException(status_code=404, detail="플롯 포인트를 찾을 수 없습니다.")

    if not plot_point.scene_draft:
        raise HTTPException(status_code=400, detail="수정할 장면 초안이 없습니다. 먼저 'AI로 장면 생성'을 사용해주세요.")

    style_guide_context = get_style_guide_content(request.style_guide_id, 'micro')

    scenario = plot_point.scenario
    all_plot_points = sorted(scenario.plot_points, key=lambda p: p.ordering)
    surrounding_context = _get_surrounding_plot_context(plot_point.ordering, all_plot_points)
    
    # [수정] 문체 일관성을 위한 지침 추가
    if surrounding_context and "이전 장면 내용" in surrounding_context:
        style_guide_context += "\n\n**[문체 일관성 지침]**\n제공된 '이전 장면 내용'의 문체와 톤앤매너를 최대한 일관성 있게 유지하여 현재 장면을 작성해주세요."

    total_plots = len(all_plot_points)
    plot_position_context = ""
    if total_plots > 0:
        percentage = (plot_point.ordering + 1) / total_plots
        if percentage <= 0.25:
            plot_position_context = "도입부 (기)"
        elif percentage <= 0.75:
            plot_position_context = "전개 (승)"
        elif percentage <= 0.9:
            plot_position_context = "전환 (전)"
        else:
            plot_position_context = "결말 (결)"
            
    character_ids = request.character_ids or []
    characters = db.query(CardModel).filter(CardModel.id.in_(character_ids)).all()
    characters_context = "\n".join([f"- {c.name}: {c.description}" for c in characters])
    relationships_context = ""
    if len(character_ids) > 1:
        relationships = db.query(RelationshipModel).filter(
            RelationshipModel.source_character_id.in_(character_ids),
            RelationshipModel.target_character_id.in_(character_ids),
            RelationshipModel.project_id == project.id
        ).all()
        if relationships:
            char_name_map = {c.id: c.name for c in characters}
            relationship_descriptions = [f"- {char_name_map.get(r.source_character_id)} → {char_name_map.get(r.target_character_id)}: {r.type} ({r.description or ''})" for r in relationships]
            if relationship_descriptions:
                relationships_context = f"\n\n**[캐릭터 간 관계]**\n" + "\n".join(relationship_descriptions)
    
    word_count_map = {
        "short": "약 1000자 내외의 간결한 분량으로 수정해주세요.",
        "medium": "약 2000자 내외의 적당한 분량으로 수정해주세요.", 
        "long": "약 3000자 내외의 풍부한 분량으로 수정해주세요."
    }
    word_count_instruction = word_count_map.get(request.word_count, word_count_map["medium"])

    prompt = ai_prompts.scene_edit.format(
        existing_scene_draft=plot_point.scene_draft,
        plot_position_context=plot_position_context,
        plot_title=plot_point.title,
        plot_content=plot_point.content,
        output_format=request.output_format,
        word_count_instruction=word_count_instruction,
        surrounding_context=surrounding_context,
        characters_context=characters_context,
        relationships_context=relationships_context,
        user_edit_request=request.user_edit_request,
        style_guide_context=style_guide_context
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
        
        plot_point.scene_draft = response.text.strip()
        db.commit()
        db.refresh(plot_point)

        return plot_point
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"AI 장면 수정 중 오류가 발생했습니다: {e}")
