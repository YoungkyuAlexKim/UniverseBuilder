from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
import time
import json
import os

# AI 유틸리티 임포트
from ..utils.ai_utils import call_ai_model
from google.generativeai.types import GenerationConfig

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database # <--- 오류 수정을 위해 이 줄을 추가했습니다.
from ..database import Project as ProjectModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel, ManuscriptBlock as ManuscriptBlockModel, Card as CardModel, Group as GroupModel, WorldviewCard as WorldviewCardModel, Relationship as RelationshipModel
from .scenarios import PlotPoint
from .projects import get_project_if_accessible
from ..config import ai_prompts # 프롬프트 설정을 불러옵니다.

# --- 모델 설정 ---
AVAILABLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"]

# --- 유틸리티 함수 ---
# --- 스타일 가이드 관리 시스템 ---

def get_available_style_guides() -> List[dict]:
    """사용 가능한 모든 스타일 가이드를 스캔하여 반환"""
    style_guides = []
    style_guide_dir = "app/style_guides"

    if not os.path.exists(style_guide_dir):
        return style_guides

    try:
        for filename in os.listdir(style_guide_dir):
            if filename.endswith('.txt'):
                file_path = os.path.join(style_guide_dir, filename)
                style_guide_id = filename[:-4]  # .txt 확장자 제거

                # 파일 메타데이터 추출 시도
                metadata = extract_style_guide_metadata(file_path)

                style_guides.append({
                    "id": style_guide_id,
                    "filename": filename,
                    "title": metadata.get("title", style_guide_id.replace("_", " ").title()),
                    "description": metadata.get("description", ""),
                    "category": metadata.get("category", "기본"),
                    "language": metadata.get("language", "ko"),
                    "created_at": metadata.get("created_at", ""),
                    "updated_at": metadata.get("updated_at", ""),
                    "file_size": os.path.getsize(file_path)
                })

        # 제목 기준으로 정렬
        style_guides.sort(key=lambda x: x["title"])
        return style_guides

    except Exception as e:
        print(f"스타일 가이드 스캔 중 오류: {e}")
        return []

def extract_style_guide_metadata(file_path: str) -> dict:
    """스타일 가이드 파일에서 메타데이터 추출"""
    metadata = {}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # 파일 상단의 메타데이터 파싱 (주석 형식)
        for line in lines[:10]:  # 상단 10줄만 확인
            line = line.strip()
            if line.startswith("# TITLE:"):
                metadata["title"] = line[8:].strip()
            elif line.startswith("# DESCRIPTION:"):
                metadata["description"] = line[14:].strip()
            elif line.startswith("# CATEGORY:"):
                metadata["category"] = line[11:].strip()
            elif line.startswith("# LANGUAGE:"):
                metadata["language"] = line[11:].strip()
            elif line.startswith("# CREATED:"):
                metadata["created_at"] = line[10:].strip()
            elif line.startswith("# UPDATED:"):
                metadata["updated_at"] = line[10:].strip()

        # 파일 수정 시간으로 기본 메타데이터 설정
        if not metadata.get("updated_at"):
            import time
            mtime = os.path.getmtime(file_path)
            metadata["updated_at"] = time.strftime("%Y-%m-%d", time.localtime(mtime))

    except Exception as e:
        print(f"메타데이터 추출 중 오류: {e}")

    return metadata

def get_style_guide_content(style_guide_id: str) -> str:
    """스타일 가이드 내용 불러오기 (하위 호환성 유지)"""
    if not style_guide_id:
        return ""

    # 보안 체크
    if ".." in style_guide_id or "/" in style_guide_id or "\\" in style_guide_id:
        return ""

    file_path = f"app/style_guides/{style_guide_id}.txt"
    if not os.path.exists(file_path):
        return ""

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            full_content = f.read()

        # 메타데이터 라인 제거 (AI 프롬프트에 포함되지 않도록)
        lines = full_content.split('\n')
        content_lines = []
        for line in lines:
            if not line.strip().startswith('# ') or not any(keyword in line.upper() for keyword in ['TITLE:', 'DESCRIPTION:', 'CATEGORY:', 'LANGUAGE:', 'CREATED:', 'UPDATED:']):
                content_lines.append(line)

        clean_content = '\n'.join(content_lines).strip()
        return f"\n\n### 반드시 준수해야 할 문체 가이드라인\n{clean_content}\n"
    except Exception as e:
        print(f"스타일 가이드 불러오기 중 오류: {e}")
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

class MergeManuscriptBlocksRequest(BaseModel):
    block_ids: List[str]
    new_title: Optional[str] = None

class SplitManuscriptBlockRequest(BaseModel):
    split_position: int
    first_part_title: Optional[str] = None
    second_part_title: Optional[str] = None

class ExportToScenarioRequest(BaseModel):
    confirm_overwrite: bool = False  # 덮어쓰기 확인
    max_plots: Optional[int] = 50  # AI 제한 고려한 최대 플롯 수

class ExtractCharactersRequest(BaseModel):
    text_content: str

class CharacterInfo(BaseModel):
    id: str
    name: str
    role: str
    confidence: float
    context: str

class UnidentifiedEntity(BaseModel):
    name: str
    context: str

class CharacterExtractionResult(BaseModel):
    characters: List[CharacterInfo]
    unidentified_entities: List[UnidentifiedEntity]

class GenerateFeedbackRequest(BaseModel):
    text_content: str

class ImprovementItem(BaseModel):
    priority: str  # "high", "medium", "low"
    category: str  # "문장", "캐릭터", "플롯", "몰입도", "세계관"
    issue: str
    suggestion: str

class ExpertFeedbackResult(BaseModel):
    overall_score: int  # 1-10
    strengths: List[str]
    improvements: List[ImprovementItem]
    writing_tips: List[str]
    encouragement: str

# --- Pydantic 모델 ---
class StyleGuideInfo(BaseModel):
    id: str
    filename: str
    title: str
    description: str
    category: str
    language: str
    created_at: str
    updated_at: str
    file_size: int

# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects/{project_id}/manuscript",
    tags=["Manuscript"]
)

# 스타일 가이드 전용 라우터 (프로젝트 ID 불필요)
style_guide_router = APIRouter(
    prefix="/api/v1/style-guides",
    tags=["Style Guides"]
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
    user_api_key: Optional[str] = Header(None, alias="X-User-API-Key"),
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    block_to_edit = db.query(ManuscriptBlockModel).filter(ManuscriptBlockModel.id == block_id).first()
    if not block_to_edit:
        raise HTTPException(status_code=404, detail="수정할 원고 블록을 찾을 수 없습니다.")

    # 컨텍스트 구성 로직은 그대로 유지
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
            rel_descs = []

            for r in relationships:
                # 현재 관계의 Phase 정보 가져오기 (가장 최신 단계)
                from ..database import RelationshipPhase as RelationshipPhaseModel
                latest_phase = db.query(RelationshipPhaseModel).filter(
                    RelationshipPhaseModel.relationship_id == r.id
                ).order_by(RelationshipPhaseModel.phase_order.desc()).first()

                source_name = char_map.get(r.source_character_id, '알 수 없음')
                target_name = char_map.get(r.target_character_id, '알 수 없음')

                # 기본 관계 정보
                desc = f"- {source_name} → {target_name}: {r.type}"
                if r.description:
                    desc += f" ({r.description})"

                # Phase 정보가 있으면 추가
                if latest_phase:
                    desc += f"\n  └ 단계 {latest_phase.phase_order}: {latest_phase.type}"
                    if latest_phase.trigger_description:
                        desc += f" (계기: {latest_phase.trigger_description})"
                    if latest_phase.source_to_target_address or latest_phase.source_to_target_tone:
                        desc += f"\n    └ {source_name}의 말투/호칭: {latest_phase.source_to_target_tone or ''}"
                        if latest_phase.source_to_target_address:
                            desc += f" (호칭: {latest_phase.source_to_target_address})"
                    if latest_phase.target_to_source_address or latest_phase.target_to_source_tone:
                        desc += f"\n    └ {target_name}의 말투/호칭: {latest_phase.target_to_source_tone or ''}"
                        if latest_phase.target_to_source_address:
                            desc += f" (호칭: {latest_phase.target_to_source_address})"

                rel_descs.append(desc)
            relationships_context = "\n\n**[캐릭터 간 관계]**\n" + "\n".join(rel_descs)

    style_guide_context = get_style_guide_content(request.style_guide_id)

    chosen_model = request.model_name or AVAILABLE_MODELS[0]

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

    # call_ai_model을 사용하여 AI 호출 (텍스트 응답)
    edited_content = await call_ai_model(
        prompt=prompt,
        model_name=chosen_model,
        response_format="text",
        user_api_key=user_api_key
    )

    return {"edited_content": edited_content}

@router.post("/blocks/{block_id}/refine-partial")
async def refine_partial_manuscript_block(
    block_id: str, # block_id는 현재 사용되지 않지만, 향후 특정 블록 컨텍스트를 위해 유지합니다.
    request: ManuscriptBlockPartialRefineRequest,
    user_api_key: Optional[str] = Header(None, alias="X-User-API-Key"),
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    선택된 텍스트의 일부를 AI를 통해 다듬고 여러 제안을 반환합니다.
    """
    style_guide_context = get_style_guide_content(request.style_guide_id)

    prompt = ai_prompts.manuscript_partial_refine.format(
        style_guide_context=style_guide_context,
        surrounding_context=request.surrounding_context,
        selected_text=request.selected_text,
        user_prompt=request.user_prompt or "문장을 더 자연스럽고 세련되게 다듬어줘." # 기본 프롬프트
    )

    # call_ai_model을 사용하여 AI 호출 (JSON 응답 기대)
    chosen_model = request.model_name or AVAILABLE_MODELS[0]
    generation_config = GenerationConfig(response_mime_type="application/json")
    suggestions = await call_ai_model(
        prompt=prompt,
        model_name=chosen_model,
        generation_config=generation_config,
        response_format="json",
        user_api_key=user_api_key
    )

    return suggestions

@router.post("/blocks/merge", response_model=ManuscriptBlock)
def merge_manuscript_blocks(
    request: MergeManuscriptBlocksRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    여러 집필 블록들을 하나로 합칩니다.
    """
    if len(request.block_ids) < 2:
        raise HTTPException(status_code=400, detail="합칠 블록을 2개 이상 선택해주세요.")

    # 선택된 블록들을 가져옵니다.
    blocks = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id.in_(request.block_ids),
        ManuscriptBlockModel.project_id == project.id
    ).order_by(ManuscriptBlockModel.ordering).all()

    if len(blocks) != len(request.block_ids):
        raise HTTPException(status_code=404, detail="일부 블록을 찾을 수 없습니다.")

    # 합칠 내용들을 결합합니다.
    merged_content = "\n\n".join([block.content or "" for block in blocks])
    merged_title = request.new_title or f"{blocks[0].title} 외 {len(blocks)-1}개"

    # 새로운 블록을 생성합니다.
    new_block = ManuscriptBlockModel(
        id=f"ms-block-{int(time.time() * 1000)}_{blocks[0].ordering}",
        project_id=project.id,
        title=merged_title,
        content=merged_content,
        ordering=blocks[0].ordering,
        char_count=len(merged_content),
        word_count=len(merged_content.split()) if merged_content else 0
    )

    # 기존 블록들을 삭제합니다.
    for block in blocks:
        db.delete(block)

    # 새로운 블록을 추가합니다.
    db.add(new_block)

    # 남은 블록들의 순서를 재정렬합니다.
    remaining_blocks = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.project_id == project.id
    ).order_by(ManuscriptBlockModel.ordering).all()

    for i, block in enumerate(remaining_blocks):
        block.ordering = i

    db.commit()
    db.refresh(new_block)
    return new_block

@router.post("/blocks/{block_id}/split", response_model=List[ManuscriptBlock])
def split_manuscript_block(
    block_id: str,
    request: SplitManuscriptBlockRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    하나의 집필 블록을 지정된 위치에서 둘로 나눕니다.
    """
    print(f"DEBUG: Split request - block_id: {block_id}, split_position: {request.split_position}, first_title: {request.first_part_title}, second_title: {request.second_part_title}")

    try:
        block = db.query(ManuscriptBlockModel).filter(
            ManuscriptBlockModel.id == block_id,
            ManuscriptBlockModel.project_id == project.id
        ).first()

        if not block:
            raise HTTPException(status_code=404, detail="나눌 블록을 찾을 수 없습니다.")

        if not block.content:
            raise HTTPException(status_code=400, detail="블록에 내용이 없습니다.")

        if request.split_position <= 0:
            raise HTTPException(status_code=400, detail="분할 위치는 1 이상이어야 합니다.")

        if request.split_position >= len(block.content):
            raise HTTPException(status_code=400, detail="분할 위치가 콘텐츠 길이를 초과합니다.")

        # 콘텐츠를 분할합니다.
        first_part_content = block.content[:request.split_position].strip()
        second_part_content = block.content[request.split_position:].strip()

        if not first_part_content and not second_part_content:
            raise HTTPException(status_code=400, detail="분할 결과 두 부분 중 하나는 내용이 있어야 합니다.")

        # 제목을 설정합니다.
        first_part_title = request.first_part_title or f"{block.title} (1부)"
        second_part_title = request.second_part_title or f"{block.title} (2부)"

        # 첫 번째 블록을 업데이트합니다.
        block.title = first_part_title
        block.content = first_part_content
        block.char_count = len(first_part_content)
        block.word_count = len(first_part_content.split()) if first_part_content else 0

        # 두 번째 블록을 생성합니다.
        second_block = ManuscriptBlockModel(
            id=f"ms-block-{int(time.time() * 1000)}_{block.ordering}_part2",
            project_id=project.id,
            title=second_part_title,
            content=second_part_content,
            ordering=block.ordering + 1,  # 임시 ordering (나중에 재정렬됨)
            char_count=len(second_part_content),
            word_count=len(second_part_content.split()) if second_part_content else 0
        )

        # 두 번째 블록을 추가합니다.
        db.add(second_block)
        db.flush()  # 모든 변경사항을 세션에 반영하지만 아직 커밋하지 않음

        # 전체 블록들의 순서를 완전 재정렬 (0부터 시작)
        all_blocks = db.query(ManuscriptBlockModel).filter(
            ManuscriptBlockModel.project_id == project.id
        ).order_by(ManuscriptBlockModel.ordering).all()

        for index, block_item in enumerate(all_blocks):
            block_item.ordering = index

        # 모든 변경사항을 하나의 트랜잭션으로 커밋
        db.commit()
        db.refresh(block)
        db.refresh(second_block)

        return [block, second_block]

    except HTTPException:
        raise
    except Exception as e:
        # 예상치 못한 에러에 대한 디버깅 정보 추가
        raise HTTPException(
            status_code=500,
            detail=f"블록 분할 중 오류 발생: {str(e)}. block_id: {block_id}, split_position: {getattr(request, 'split_position', 'N/A')}"
        )

@router.post("/export-to-scenario", response_model=List[PlotPoint])
def export_manuscript_to_scenario(
    request: ExportToScenarioRequest,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    집필 탭의 블록들을 시나리오 탭의 플롯 포인트로 내보냅니다.
    """
    # 프로젝트의 시나리오 가져오기
    scenario = db.query(ScenarioModel).filter(ScenarioModel.project_id == project.id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="시나리오를 찾을 수 없습니다.")

    # 집필 블록들 가져오기
    manuscript_blocks = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.project_id == project.id
    ).order_by(ManuscriptBlockModel.ordering).all()

    if not manuscript_blocks:
        raise HTTPException(status_code=400, detail="내보낼 집필 블록이 없습니다.")

    # AI 제한 고려한 스마트 처리
    max_allowed_plots = min(request.max_plots or 50, 50)  # AI 제한은 최대 50개
    if len(manuscript_blocks) > max_allowed_plots:
        # 초과된 블록들은 경고하지만 계속 진행
        print(f"WARNING: 집필 블록 수({len(manuscript_blocks)})가 AI 권장 제한({max_allowed_plots})을 초과했습니다.")

    # 기존 플롯 수 확인 (확인창 표시용)
    existing_count = db.query(func.count(PlotPointModel.id)).filter(
        PlotPointModel.scenario_id == scenario.id
    ).scalar()

    # 기존 플롯이 있는 경우 덮어쓰기 확인 필요
    if existing_count > 0 and not request.confirm_overwrite:
        raise HTTPException(
            status_code=400,
            detail=f"시나리오 탭에 이미 {existing_count}개의 플롯이 있습니다. 덮어쓰기를 진행하려면 확인이 필요합니다."
        )

    updated_plot_points = []

    # 기존 플롯 포인트 모두 삭제 후 새로 생성 (덮어쓰기 모드)
    db.query(PlotPointModel).filter(PlotPointModel.scenario_id == scenario.id).delete()

    for i, block in enumerate(manuscript_blocks):
        plot_point = PlotPointModel(
            id=f"plot-{int(time.time() * 1000)}_{i}",
            scenario_id=scenario.id,
            title=block.title,
            content=block.content or "",
            scene_draft=block.content or "",
            ordering=i
        )
        db.add(plot_point)
        updated_plot_points.append(plot_point)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"데이터베이스 저장 중 오류 발생: {str(e)}")

    # 결과 반환 (Pydantic 모델로 변환)
    try:
        result = [PlotPoint.from_orm(plot) for plot in updated_plot_points]
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"응답 데이터 변환 중 오류 발생: {str(e)}")

# --- 스타일 가이드 API 엔드포인트 ---
@style_guide_router.get("/", response_model=List[StyleGuideInfo])
def get_style_guides():
    """사용 가능한 모든 스타일 가이드 목록을 반환"""
    return get_available_style_guides()

@style_guide_router.get("/{style_guide_id}")
def get_style_guide_detail(style_guide_id: str):
    """특정 스타일 가이드의 상세 정보와 내용을 반환"""
    style_guides = get_available_style_guides()
    style_guide = next((sg for sg in style_guides if sg["id"] == style_guide_id), None)

    if not style_guide:
        raise HTTPException(status_code=404, detail="스타일 가이드를 찾을 수 없습니다.")

    content = get_style_guide_content(style_guide_id)
    if not content:
        raise HTTPException(status_code=500, detail="스타일 가이드 내용을 불러올 수 없습니다.")

    return {
        **style_guide,
        "content": content
    }

@style_guide_router.get("/{style_guide_id}/content")
def get_style_guide_content_only(style_guide_id: str):
    """스타일 가이드 내용만 반환 (AI 프롬프트용)"""
    content = get_style_guide_content(style_guide_id)
    if not content:
        raise HTTPException(status_code=404, detail="스타일 가이드를 찾을 수 없습니다.")
    return {"content": content}

@router.post("/blocks/{block_id}/extract-characters")
async def extract_characters_from_manuscript(
    block_id: str,
    request: ExtractCharactersRequest,
    user_api_key: Optional[str] = Header(None, alias="X-User-API-Key"),
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    집필 블록의 텍스트에서 등장하는 캐릭터들을 AI를 사용하여 추출합니다.
    """
    # 블록 존재 확인
    block = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id == block_id,
        ManuscriptBlockModel.project_id == project.id
    ).first()

    if not block:
        raise HTTPException(status_code=404, detail="블록을 찾을 수 없습니다.")

    if not request.text_content or not request.text_content.strip():
        raise HTTPException(status_code=400, detail="분석할 텍스트 내용이 없습니다.")

    # 프로젝트의 모든 캐릭터 정보 수집 (Group을 통해 연결)
    characters = db.query(CardModel).join(GroupModel).filter(GroupModel.project_id == project.id).all()
    available_characters = "\n".join([
        f"- ID: {c.id}, 이름: {c.name}, 설명: {c.description[:100] if c.description else '설명 없음'}..."
        for c in characters
    ])

    if not available_characters:
        available_characters = "등록된 캐릭터가 없습니다."

    # AI 프롬프트 구성
    prompt = ai_prompts.extract_related_characters.format(
        text_content=request.text_content,
        available_characters=available_characters
    )

    # call_ai_model을 사용하여 AI 호출 (JSON 응답 기대)
    chosen_model = AVAILABLE_MODELS[0]  # 기본 모델 사용
    generation_config = GenerationConfig(response_mime_type="application/json")
    result = await call_ai_model(
        prompt=prompt,
        model_name=chosen_model,
        generation_config=generation_config,
        response_format="json",
        user_api_key=user_api_key
    )

    return CharacterExtractionResult(**result)

@router.post("/blocks/{block_id}/generate-feedback")
async def generate_expert_feedback(
    block_id: str,
    request: GenerateFeedbackRequest,
    user_api_key: Optional[str] = Header(None, alias="X-User-API-Key"),
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    집필 블록의 텍스트에 대한 전문가 수준의 AI 피드백을 생성합니다.
    """
    # 블록 존재 확인
    block = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id == block_id,
        ManuscriptBlockModel.project_id == project.id
    ).first()

    if not block:
        raise HTTPException(status_code=404, detail="블록을 찾을 수 없습니다.")

    if not request.text_content or not request.text_content.strip():
        raise HTTPException(status_code=400, detail="피드백을 받을 텍스트 내용이 없습니다.")

    # 플롯 배경 정보 수집
    scenario = db.query(ScenarioModel).filter(ScenarioModel.project_id == project.id).first()
    plot_context = "플롯 정보가 없습니다."
    other_plots_context = ""

    if scenario:
        # 현재 플롯 정보
        original_plot = db.query(PlotPointModel).filter(
            PlotPointModel.scenario_id == scenario.id,
            PlotPointModel.ordering == block.ordering
        ).first()
        if original_plot:
            plot_context = f"현재 플롯 제목: {original_plot.title}\n현재 플롯 내용: {original_plot.content or '상세 내용 없음'}"

        # 다른 모든 플롯들의 요약 정보 수집
        all_plot_points = db.query(PlotPointModel).filter(
            PlotPointModel.scenario_id == scenario.id
        ).order_by(PlotPointModel.ordering).all()

        other_plots = []
        for plot in all_plot_points:
            if plot.ordering != block.ordering and plot.content:  # 현재 플롯 제외
                position = "이전" if plot.ordering < block.ordering else "다음"
                other_plots.append(f"- ({position}) {plot.ordering + 1}. {plot.title}: {plot.content}")

        if other_plots:
            # AI 토큰 제한 고려한 최적화 (최대 20개 플롯, 6000자 제한)
            MAX_PLOTS = 20
            MAX_CHARS = 6000

            if len(other_plots) > MAX_PLOTS:
                # 현재 플롯 주변의 플롯들을 우선적으로 포함
                current_index = block.ordering
                prioritized_plots = []

                # 현재 플롯 바로 앞뒤 플롯들을 먼저 수집
                for offset in range(1, 11):  # ±10 플롯 범위
                    # 이전 플롯들
                    prev_idx = current_index - offset
                    if prev_idx >= 0 and len(prioritized_plots) < MAX_PLOTS:
                        plot = all_plot_points[prev_idx]
                        if plot.content:
                            prioritized_plots.append(f"- (이전) {prev_idx + 1}. {plot.title}: {plot.content[:200]}...")

                    # 다음 플롯들
                    next_idx = current_index + offset
                    if next_idx < len(all_plot_points) and len(prioritized_plots) < MAX_PLOTS:
                        plot = all_plot_points[next_idx]
                        if plot.content:
                            prioritized_plots.append(f"- (다음) {next_idx + 1}. {plot.title}: {plot.content[:200]}...")

                # 남은 공간이 있다면 처음과 끝의 주요 플롯들 추가
                if len(prioritized_plots) < MAX_PLOTS:
                    for plot in all_plot_points[:3]:  # 시작부 플롯들
                        if plot.ordering != current_index and plot.content and len(prioritized_plots) < MAX_PLOTS:
                            prioritized_plots.append(f"- (초반) {plot.ordering + 1}. {plot.title}: {plot.content[:150]}...")

                    for plot in all_plot_points[-3:]:  # 종료부 플롯들
                        if plot.ordering != current_index and plot.content and len(prioritized_plots) < MAX_PLOTS:
                            prioritized_plots.append(f"- (후반) {plot.ordering + 1}. {plot.title}: {plot.content[:150]}...")

                # 최종 컨텍스트 생성 (문자 수 제한 적용)
                context_text = "\n".join(prioritized_plots)
                if len(context_text) > MAX_CHARS:
                    context_text = context_text[:MAX_CHARS] + "..."

                other_plots_context = f"### 전체 스토리 흐름 (주변 및 주요 플롯 위주, 총 {len(other_plots)}개 중 {len(prioritized_plots)}개 표시)\n{context_text}"
            else:
                # 플롯 수가 적으면 전체 포함하되, 각 플롯 내용은 300자로 제한
                limited_plots = []
                for plot_info in other_plots:
                    if len(plot_info) > 350:  # 제목 포함해서 대략 300자 정도로 제한
                        # "제목: 내용" 형식에서 내용 부분만 자르기
                        colon_idx = plot_info.find(": ")
                        if colon_idx > 0:
                            title_part = plot_info[:colon_idx + 2]
                            content_part = plot_info[colon_idx + 2:][:300] + "..."
                            plot_info = title_part + content_part
                    limited_plots.append(plot_info)

                other_plots_context = "### 전체 스토리 흐름\n" + "\n".join(limited_plots)

    # 캐릭터 정보 수집 (해당 블록에 등장하는 캐릭터들)
    characters = db.query(CardModel).join(GroupModel).filter(GroupModel.project_id == project.id).all()
    character_context = "\n".join([
        f"- {c.name}: {c.description[:100] if c.description else '설명 없음'}"
        for c in characters
    ]) or "등록된 캐릭터가 없습니다."

    # AI 프롬프트 구성
    prompt = ai_prompts.generate_expert_feedback.format(
        text_content=request.text_content,
        plot_context=plot_context,
        other_plots_context=other_plots_context,
        character_context=character_context
    )

    # call_ai_model을 사용하여 AI 호출 (JSON 응답 기대)
    chosen_model = AVAILABLE_MODELS[0]  # 기본 모델 사용
    generation_config = GenerationConfig(response_mime_type="application/json")
    result = await call_ai_model(
        prompt=prompt,
        model_name=chosen_model,
        generation_config=generation_config,
        response_format="json",
        user_api_key=user_api_key
    )

    return ExpertFeedbackResult(**result)

@router.delete("/blocks/{block_id}")
def delete_manuscript_block(
    block_id: str,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    특정 집필 블록을 삭제합니다.
    """
    block = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id == block_id,
        ManuscriptBlockModel.project_id == project.id
    ).first()

    if not block:
        raise HTTPException(status_code=404, detail="삭제할 블록을 찾을 수 없습니다.")

    # 삭제 수행 및 세션에 반영 (아직 커밋하지 않음)
    db.delete(block)
    db.flush()

    # 같은 프로젝트의 남은 블록들의 순서 완전 재정렬 (0부터 시작)
    remaining_blocks = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.project_id == project.id
    ).order_by(ManuscriptBlockModel.ordering).all()

    for index, block in enumerate(remaining_blocks):
        block.ordering = index

    # 삭제와 순서 변경을 하나의 트랜잭션으로 커밋
    db.commit()
    return {"message": "블록이 성공적으로 삭제되었습니다."}

@router.post("/blocks/{block_id}/import-from-plot/{plot_id}")
def import_block_from_plot(
    block_id: str,
    plot_id: str,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    특정 시나리오 플롯의 내용을 집필 블록으로 불러옵니다.
    """
    # 집필 블록 확인
    block = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id == block_id,
        ManuscriptBlockModel.project_id == project.id
    ).first()

    if not block:
        raise HTTPException(status_code=404, detail="집필 블록을 찾을 수 없습니다.")

    # 시나리오 플롯 확인
    plot = db.query(PlotPointModel).filter(
        PlotPointModel.id == plot_id,
        PlotPointModel.scenario_id == project.scenarios[0].id if project.scenarios else None
    ).first()

    if not plot:
        raise HTTPException(status_code=404, detail="시나리오 플롯을 찾을 수 없습니다.")

    # 플롯 내용을 블록으로 복사
    block.title = plot.title
    block.content = plot.scene_draft or plot.content or ""
    block.char_count = len(block.content)
    block.word_count = len(block.content.split()) if block.content else 0

    db.commit()
    db.refresh(block)

    return {"message": "플롯 내용을 성공적으로 불러왔습니다.", "block": block}

@router.post("/blocks/{block_id}/export-to-plot/{plot_id}")
def export_block_to_plot(
    block_id: str,
    plot_id: str,
    project: ProjectModel = Depends(get_project_if_accessible),
    db: Session = Depends(database.get_db)
):
    """
    집필 블록의 내용을 특정 시나리오 플롯으로 내보냅니다.
    """
    # 집필 블록 확인
    block = db.query(ManuscriptBlockModel).filter(
        ManuscriptBlockModel.id == block_id,
        ManuscriptBlockModel.project_id == project.id
    ).first()

    if not block:
        raise HTTPException(status_code=404, detail="집필 블록을 찾을 수 없습니다.")

    # 시나리오 플롯 확인
    plot = db.query(PlotPointModel).filter(
        PlotPointModel.id == plot_id,
        PlotPointModel.scenario_id == project.scenarios[0].id if project.scenarios else None
    ).first()

    if not plot:
        raise HTTPException(status_code=404, detail="시나리오 플롯을 찾을 수 없습니다.")

    # 블록 내용을 플롯으로 복사
    plot.title = block.title
    plot.content = block.content or ""
    plot.scene_draft = block.content or ""

    db.commit()
    db.refresh(plot)

    return {"message": "블록 내용을 성공적으로 내보냈습니다.", "plot": plot}