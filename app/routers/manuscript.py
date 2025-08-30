from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import time
import json
import os

# Gemini AI 관련 임포트
import google.generativeai as genai
from google.generativeai.types import GenerationConfig, HarmCategory, HarmBlockThreshold

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database # <--- 오류 수정을 위해 이 줄을 추가했습니다.
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel, ManuscriptBlock as ManuscriptBlockModel, Card as CardModel, WorldviewCard as WorldviewCardModel, Relationship as RelationshipModel
from .projects import get_project_if_accessible
from ..config import ai_prompts # 프롬프트 설정을 불러옵니다.

# --- Gemini API 설정 ---
AVAILABLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# --- 유틸리티 함수 ---
def get_style_guide_content(style_guide_id: str) -> str:
    if not style_guide_id:
        return ""
    if ".." in style_guide_id or "/" in style_guide_id or "\\" in style_guide_id:
        return ""
    file_path = f"app/style_guides/{style_guide_id}.txt"
    if not os.path.exists(file_path):
        return ""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            full_content = f.read()
        return f"\n\n### 반드시 준수해야 할 문체 가이드라인\n{full_content}\n"
    except Exception:
        return ""

def _get_surrounding_plot_context(current_plot_index: int, all_plot_points: List[PlotPointModel]) -> str:
    surrounding_plots_summary = []
    start_index = max(0, current_plot_index - 3)
    end_index = min(len(all_plot_points), current_plot_index + 4)
    for i in range(start_index, end_index):
        if i == current_plot_index:
            continue
        plot = all_plot_points[i]
        position = "이전" if i < current_plot_index else "다음"
        surrounding_plots_summary.append(f"- ({position}) {plot.ordering + 1}. {plot.title}: {plot.content or '요약 없음'}")
    
    if not surrounding_plots_summary:
        return "### 참고할 주변 플롯 정보가 없습니다."
    return "### 주변 플롯 요약 (전체 흐름 참고용)\n" + "\n".join(surrounding_plots_summary)


# --- Pydantic 데이터 모델 ---

class ManuscriptBlock(BaseModel):
    id: str
    project_id: str
    title: str
    content: Optional[str] = None
    ordering: int
    word_count: Optional[int] = 0
    char_count: Optional[int] = 0

    class Config:
        from_attributes = True

class ManuscriptBlockUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class ManuscriptBlockOrderUpdateRequest(BaseModel):
    block_ids: List[str]

class ManuscriptBlockAIEditRequest(BaseModel):
    user_edit_request: str
    style_guide_id: Optional[str] = None
    model_name: Optional[str] = None
    character_ids: Optional[List[str]] = None
    worldview_card_ids: Optional[List[str]] = None

class ManuscriptBlockPartialRefineRequest(BaseModel):
    selected_text: str
    surrounding_context: str
    user_prompt: Optional[str] = None
    style_guide_id: Optional[str] = None
    model_name: Optional[str] = None

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

    # 이전에 생성되어 count가 NULL인 블록들의 값을 동적으로 계산
    for block in blocks:
        if block.content is not None:
            if block.char_count is None:
                block.char_count = len(block.content)
            if block.word_count is None:
                block.word_count = len(block.content.split()) if block.content else 0
        else: # content가 없는 경우 0으로 처리
            if block.char_count is None:
                block.char_count = 0
            if block.word_count is None:
                block.word_count = 0

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
        content = plot.scene_draft or f"({plot.content})"
        new_block = ManuscriptBlockModel(
            id=f"ms-block-{int(time.time() * 1000)}_{plot.ordering}",
            project_id=project.id,
            title=plot.title,
            content=content,
            ordering=plot.ordering,
            # 글자 수 및 단어 수 계산 로직 추가
            char_count=len(content),
            word_count=len(content.split()) if content else 0
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
        # 글자 수 및 단어 수 계산 로직 추가
        block.char_count = len(update_data.content)
        block.word_count = len(update_data.content.split()) if update_data.content else 0

    db.commit()
    db.refresh(block)
    return block

@router.post("/blocks/{block_id}/edit-with-ai")
async def edit_manuscript_block_with_ai(
    block_id: str,
    request: ManuscriptBlockAIEditRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않았습니다.")

    block_to_edit = db.query(ManuscriptBlockModel).filter(ManuscriptBlockModel.id == block_id).first()
    if not block_to_edit:
        raise HTTPException(status_code=404, detail="수정할 원고 블록을 찾을 수 없습니다.")

    scenario = db.query(ScenarioModel).filter(ScenarioModel.project_id == project.id).first()
    all_plot_points = sorted(scenario.plot_points, key=lambda p: p.ordering) if scenario else []
    
    original_plot = next((p for p in all_plot_points if p.ordering == block_to_edit.ordering), None)
    
    plot_title = original_plot.title if original_plot else "알 수 없음"
    plot_content = original_plot.content if original_plot else "원본 플롯 정보 없음"
    surrounding_context = _get_surrounding_plot_context(block_to_edit.ordering, all_plot_points)
    
    characters_context = ""
    if request.character_ids:
        characters = db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()
        characters_context = "\n".join([f"- {c.name}: {c.description}" for c in characters])

    relationships_context = ""
    if request.character_ids and len(request.character_ids) > 1:
        relationships = db.query(RelationshipModel).filter(
            RelationshipModel.source_character_id.in_(request.character_ids),
            RelationshipModel.target_character_id.in_(request.character_ids)
        ).all()
        if relationships:
            char_map = {c.id: c.name for c in db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()}
            rel_descs = [f"- {char_map.get(r.source_character_id)} → {char_map.get(r.target_character_id)}: {r.type}" for r in relationships]
            relationships_context = "\n\n**[캐릭터 간 관계]**\n" + "\n".join(rel_descs)

    style_guide_context = get_style_guide_content(request.style_guide_id)

    prompt = ai_prompts.manuscript_edit.format(
        style_guide_context=style_guide_context,
        plot_title=plot_title,
        plot_content=plot_content,
        surrounding_context=surrounding_context,
        existing_manuscript_content=block_to_edit.content or "",
        characters_context=characters_context,
        relationships_context=relationships_context,
        user_edit_request=request.user_edit_request
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
        
        return {"edited_content": response.text.strip()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 원고 수정 중 오류 발생: {e}")

@router.post("/blocks/{block_id}/refine-partial")
async def refine_partial_manuscript_block(
    block_id: str, # block_id는 현재 사용되지 않지만, 향후 특정 블록 컨텍스트를 위해 유지합니다.
    request: ManuscriptBlockPartialRefineRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    선택된 텍스트의 일부를 AI를 통해 다듬고 여러 제안을 반환합니다.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않았습니다.")

    style_guide_context = get_style_guide_content(request.style_guide_id)

    prompt = ai_prompts.manuscript_partial_refine.format(
        style_guide_context=style_guide_context,
        surrounding_context=request.surrounding_context,
        selected_text=request.selected_text,
        user_prompt=request.user_prompt or "문장을 더 자연스럽고 세련되게 다듬어줘." # 기본 프롬프트
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
        
        # AI 응답이 비어있는 경우에 대한 예외 처리 추가
        if not response.parts:
            finish_reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
            error_detail = f"AI가 응답을 생성하지 못했습니다. (종료 사유: {finish_reason})"
            if "SAFETY" in str(finish_reason):
                error_detail = "AI 생성 내용이 안전 필터에 의해 차단되었습니다."
            raise HTTPException(status_code=500, detail=error_detail)

        # JSON 파싱 전후의 텍스트를 확인하여 디버깅 용이성 확보
        raw_text = response.text.strip()
        cleaned_text = raw_text.removeprefix("```json").removesuffix("```").strip()
        
        suggestions = json.loads(cleaned_text)
        return suggestions

    except json.JSONDecodeError:
        error_detail = f"AI가 유효하지 않은 JSON 형식으로 응답했습니다. 원본 응답: {raw_text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)
    except Exception as e:
        # 이미 HTTPException인 경우 그대로 전달, 아닌 경우 새로 생성
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"AI 원고 부분 수정 중 오류 발생: {e}")