from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import os
import time
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Group as GroupModel, Card as CardModel, Worldview as WorldviewModel, WorldviewCard as WorldviewCardModel, Relationship as RelationshipModel
from ..config import ai_models

# --- Pydantic 모델 ---
class GenerateRequest(BaseModel):
    keywords: str
    character_ids: Optional[List[str]] = None
    worldview_level: Optional[str] = 'none'
    model_name: Optional[str] = None
    worldview_card_ids: Optional[List[str]] = None

class NewWorldviewRequest(BaseModel):
    keywords: str
    model_name: Optional[str] = None

class EditWorldviewRequest(BaseModel):
    keywords: str
    existing_content: str
    model_name: Optional[str] = None

class CharacterCard(BaseModel):
    name: str
    description: str
    goal: List[str]
    personality: List[str]
    abilities: List[str]
    quote: List[str]
    introduction_story: str

class AIEditRequest(BaseModel):
    prompt_text: str
    model_name: Optional[str] = None
    selected_card_ids: Optional[List[str]] = None
    selected_group_ids: Optional[List[str]] = None
    worldview_level: Optional[str] = 'none'
    edit_related_characters: bool = False

class AIEditWorldviewRequest(BaseModel):
    prompt_text: str
    model_name: Optional[str] = None
    selected_card_ids: Optional[List[str]] = None
    worldview_level: Optional[str] = 'none'
    edit_related_cards: bool = False

class MoveCardRequest(BaseModel):
    target_group_id: str
    source_group_id: str

class UpdateCardOrderRequest(BaseModel):
    card_ids: List[str]

class HighlightNamesRequest(BaseModel):
    field_name: str
    text_content: str

class SuggestRelationshipRequest(BaseModel):
    source_character_id: str
    target_character_id: str
    tendency: Optional[int] = 0
    keyword: Optional[str] = None

class RefineConceptRequest(BaseModel):
    existing_concept: str
    project_id: str
    model_name: Optional[str] = None

# [신규] 세계관 핵심 설정 다듬기 요청 모델
class RefineWorldviewRuleRequest(BaseModel):
    existing_rule: str
    project_id: str
    model_name: Optional[str] = None

# [신규] 시놉시스 구체화 요청 모델
class EnhanceSynopsisRequest(BaseModel):
    existing_synopsis: str
    user_prompt: str
    project_id: str
    model_name: Optional[str] = None
    selected_character_ids: Optional[List[str]] = None
    selected_worldview_card_ids: Optional[List[str]] = None

# --- 설정 및 유틸리티 임포트 ---
from ..config import ai_models, ai_prompts
from ..error_responses import create_ai_error_response, ErrorCodes

# --- 라우터 및 설정 ---
router = APIRouter(
    prefix="/api/v1",
    tags=["Generators & Cards"]
)

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# --- 유틸리티 함수 ---
def parse_card_fields(card_obj):
    for field in ['quote', 'personality', 'abilities', 'goal']:
        field_value = getattr(card_obj, field, None)
        if field_value and isinstance(field_value, str):
            try:
                setattr(card_obj, field, json.loads(field_value))
            except json.JSONDecodeError:
                setattr(card_obj, field, [s.strip() for s in field_value.split(',') if s.strip()])
        elif field_value is None:
             setattr(card_obj, field, [])
    return card_obj

# --- API 엔드포인트 ---

@router.post("/generate/worldview/new")
async def generate_new_worldview(request: NewWorldviewRequest):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )
    try:
        chosen_model = request.model_name or ai_models.available[0]
        model = genai.GenerativeModel(chosen_model)
        prompt = ai_prompts.worldview_new.format(keywords=request.keywords)
        response = await model.generate_content_async(prompt)
        cleaned_response = response.text.strip().replace("```", "")
        return {"worldview_text": cleaned_response}
    except Exception as e:
        error_response = create_ai_error_response(
            operation="worldview",
            original_error=e,
            ai_response=response.text if 'response' in locals() and hasattr(response, 'text') else None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )


@router.post("/generate/worldview/edit")
async def edit_existing_worldview(request: EditWorldviewRequest):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )
    try:
        chosen_model = request.model_name or ai_models.available[0]
        model = genai.GenerativeModel(chosen_model)
        prompt = ai_prompts.worldview_edit.format(
            existing_content=request.existing_content,
            keywords=request.keywords
        )
        response = await model.generate_content_async(prompt)
        cleaned_response = response.text.strip().replace("```", "")
        return {"worldview_text": cleaned_response}
    except Exception as e:
        error_response = create_ai_error_response(
            operation="worldview",
            original_error=e,
            ai_response=response.text if 'response' in locals() and hasattr(response, 'text') else None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )


@router.post("/projects/{project_id}/generate/character")
async def generate_character(project_id: str, request: GenerateRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    worldview_data = {"logline": "", "genre": "", "rules": []}
    if project.worldview and project.worldview.content:
        try:
            worldview_data = json.loads(project.worldview.content)
        except json.JSONDecodeError:
            pass

    worldview_context_prompt = ""
    base_worldview_prompt = ""
    genre_prompt = f"\n- 장르 및 분위기: {worldview_data.get('genre') or '미설정'}"
    rules_prompt = "\n- 이 세계의 핵심 설정:\n  - " + "\n  - ".join(worldview_data.get("rules", [])) if worldview_data.get("rules") else ""
    
    if genre_prompt or rules_prompt:
        base_worldview_prompt = f"\n**참고할 메인 세계관 설정:**{genre_prompt}{rules_prompt}"

    level_instruction = ""
    if request.worldview_level == 'high':
        level_instruction = "\n- 캐릭터의 모든 설정은 메인 세계관의 장르, 핵심 설정과 깊고 직접적으로 연결되어야 합니다."
    elif request.worldview_level == 'medium':
        level_instruction = "\n- 캐릭터는 메인 세계관의 사회, 문화적 배경에 자연스럽게 녹아들어야 합니다."
    elif request.worldview_level == 'low':
        level_instruction = "\n- 캐릭터의 개인적인 서사 중심으로 서술하되, 세계관의 큰 흐름과는 무관하게 설정해주세요."
    else: # none
        level_instruction = "\n- 세계관의 고유 설정(지명, 특정 사건 등)은 언급하지 말고, 장르와 분위기만 참고하세요."
    
    if base_worldview_prompt:
        worldview_context_prompt = base_worldview_prompt + level_instruction

    worldview_cards_context_prompt = ""
    if request.worldview_card_ids:
        cards_from_db = db.query(WorldviewCardModel).filter(WorldviewCardModel.id.in_(request.worldview_card_ids)).all()
        if cards_from_db:
            card_info = [f"- {card.title}: {card.content}" for card in cards_from_db]
            worldview_cards_context_prompt = "\n**참고할 서브 설정 카드 정보:**\n" + "\n".join(card_info)

    character_context_prompt = ""
    if request.character_ids:
        existing_cards = db.query(CardModel).filter(CardModel.id.in_(request.character_ids)).all()
        if existing_cards:
            character_info = [f"- 이름: {card.name}, 설명: {card.description}" for card in existing_cards]
            character_context_prompt = "\n**참고할 기존 캐릭터 정보:**\n" + "\n".join(character_info)

    chosen_model = request.model_name or ai_models.available[0]
    model = genai.GenerativeModel(chosen_model)

    prompt = ai_prompts.character_generation.format(
        worldview_context=worldview_context_prompt,
        worldview_cards_context=worldview_cards_context_prompt,
        character_context=character_context_prompt,
        keywords=request.keywords
    )
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        character_data = json.loads(response.text)
        return character_data
    except Exception as e:
        error_response = create_ai_error_response(
            operation="character",
            original_error=e,
            ai_response=response.text if 'response' in locals() and hasattr(response, 'text') else None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

# [신규] 스트리밍 응답을 위한 엔드포인트들
@router.post("/generate/character/stream")
async def generate_character_stream(request: GenerateRequest):
    """스트리밍 방식으로 캐릭터를 생성합니다."""
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    chosen_model = request.model_name or ai_models.available[0]
    model = genai.GenerativeModel(chosen_model)

    prompt = ai_prompts.character_generation.format(
        worldview_context="",
        worldview_cards_context="",
        character_context="",
        keywords=request.keywords
    )

    def generate():
        try:
            generation_config = GenerationConfig(response_mime_type="application/json")
            response = model.generate_content_async(prompt, generation_config=generation_config, stream=True)

            # 스트리밍 응답 처리
            for chunk in response:
                if chunk.text:
                    yield f"data: {chunk.text}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            error_response = create_ai_error_response(
                operation="character",
                original_error=e,
                ai_response=None
            )
            yield f"data: {error_response.model_dump_json()}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/projects/{project_id}/groups/{group_id}/cards")
def add_card_to_project(project_id: str, group_id: str, card: CharacterCard, db: Session = Depends(database.get_db)):
    group = db.query(GroupModel).filter(GroupModel.id == group_id, GroupModel.project_id == project_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")

    new_card_id = f"card-{int(time.time() * 1000)}"
    card_count = len(group.cards)
    
    new_card_db = CardModel(
        id=new_card_id,
        group_id=group_id,
        name=card.name,
        description=card.description,
        goal=json.dumps(card.goal, ensure_ascii=False) if card.goal else "[]",
        personality=json.dumps(card.personality, ensure_ascii=False) if card.personality else "[]",
        abilities=json.dumps(card.abilities, ensure_ascii=False) if card.abilities else "[]",
        quote=json.dumps(card.quote, ensure_ascii=False) if card.quote else "[]",
        introduction_story=card.introduction_story,
        ordering=card_count
    )
    
    db.add(new_card_db)
    db.commit()
    db.refresh(new_card_db)
    
    return parse_card_fields(new_card_db)

@router.delete("/projects/{project_id}/groups/{group_id}/cards/{card_id}")
def delete_card_from_project(project_id: str, group_id: str, card_id: str, db: Session = Depends(database.get_db)):
    card_to_delete = db.query(CardModel).filter(CardModel.id == card_id, CardModel.group_id == group_id).join(GroupModel).filter(GroupModel.project_id == project_id).first()

    if not card_to_delete:
        raise HTTPException(status_code=404, detail="삭제할 카드를 찾을 수 없거나 권한이 없습니다.")
    
    db.delete(card_to_delete)
    db.commit()
    return {"message": "카드가 성공적으로 삭제되었습니다."}


@router.put("/projects/{project_id}/cards/{card_id}/edit-with-ai")
async def edit_card_with_ai(project_id: str, card_id: str, request: AIEditRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    
    all_card_ids = set(request.selected_card_ids or [])
    all_card_ids.add(card_id)

    cards_from_db = db.query(CardModel).filter(CardModel.id.in_(list(all_card_ids))).all()
    if not cards_from_db:
         raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")

    edited_card_name = ""
    cards_for_context = []
    for card in cards_from_db:
        parsed_card = parse_card_fields(card)
        cards_for_context.append({
            "id": parsed_card.id,
            "name": parsed_card.name,
            "description": parsed_card.description,
            "goal": parsed_card.goal,
            "personality": parsed_card.personality,
            "abilities": parsed_card.abilities,
            "quote": parsed_card.quote,
            "introduction_story": parsed_card.introduction_story
        })
        if card.id == card_id:
            edited_card_name = card.name
    
    worldview_data = {"logline": "", "genre": "", "rules": []}
    if project.worldview and project.worldview.content:
        try:
            worldview_data = json.loads(project.worldview.content)
        except json.JSONDecodeError:
            pass
            
    worldview_context_for_prompt = {
        "genre": worldview_data.get("genre"),
        "rules": worldview_data.get("rules")
    }

    full_project_context = json.dumps({
        "name": project.name,
        "worldview": worldview_context_for_prompt,
        "cards": cards_for_context
    }, indent=2, ensure_ascii=False)

    editing_instruction = f"""**오직 '{edited_card_name}' 캐릭터만 수정**해야 합니다."""
    if request.edit_related_characters:
        editing_instruction = f"""사용자의 요청에 따라 캐릭터 정보를 수정할 때, **'{edited_card_name}'** 캐릭터를 중심으로 서사를 변경해주세요. 한 캐릭터의 수정이 다른 캐릭터의 서사에 영향을 준다면, 컨텍스트로 제공된 관련된 다른 캐릭터들의 정보도 자연스럽게 수정해야 합니다."""

    chosen_model = request.model_name or ai_models.available[0]
    model = genai.GenerativeModel(chosen_model)

    prompt = f"""당신은 세계관 설정의 일관성을 유지하는 전문 편집자입니다.
아래에 제공되는 '프로젝트 데이터'와 '사용자 요청사항'을 바탕으로 캐릭터 카드 정보를 수정해주세요.
**매우 중요한 규칙:**
1. **HTML 태그는 절대 사용하지 말고, 순수한 텍스트로만 응답해야 합니다.**
2. {editing_instruction}
3. 'quote', 'personality', 'abilities', 'goal' 항목은 반드시 **배열(리스트)** 형태로 반환해야 합니다.
4. 절대로 기존 카드의 'id'는 변경해서는 안 됩니다.
5. 최종 결과는 반드시 아래 명시된 JSON 형식으로만 반환해야 합니다.
---
[프로젝트 데이터 (사용자가 선택한 일부)]
{full_project_context}
---
[사용자 요청사항]
"{request.prompt_text}"
---
[출력 JSON 형식]
{{
  "updated_cards": [
    {{
      "id": "수정된 카드의 id",
      "name": "새로운 이름 (변경 시)",
      "description": "새로운 설명 (순수 텍스트)",
      "goal": ["새로운 목표 1"],
      "personality": ["새로운 성격 키워드 1"],
      "abilities": ["새로운 기술 또는 능력 1"],
      "quote": ["새로운 대사 1"],
      "introduction_story": "새로운 서사 (순수 텍스트)"
    }}
  ]
}}
"""
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        ai_result = json.loads(response.text)
        return ai_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 수정 작업 중 오류가 발생했습니다: {e}")

@router.put("/projects/{project_id}/worldview_cards/{card_id}/edit-with-ai")
async def edit_worldview_card_with_ai(project_id: str, card_id: str, request: AIEditWorldviewRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    
    worldview_data = {"logline": "", "genre": "", "rules": []}
    if project and project.worldview and project.worldview.content:
        try:
            worldview_data = json.loads(project.worldview.content)
        except json.JSONDecodeError:
            pass
    main_worldview_context = f"장르: {worldview_data.get('genre')}, 핵심 설정: {worldview_data.get('rules')}"

    all_card_ids = set(request.selected_card_ids or [])
    all_card_ids.add(card_id)
    
    cards_from_db = db.query(WorldviewCardModel).filter(WorldviewCardModel.id.in_(list(all_card_ids))).all()
    if not cards_from_db:
         raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")

    edited_card_title = ""
    for card in cards_from_db:
        if card.id == card_id:
            edited_card_title = card.title
            break
    
    editing_instruction = f"""**오직 '{edited_card_title}' 설정 카드만 수정**해야 합니다."""
    if request.edit_related_cards:
        editing_instruction = f"""**'{edited_card_title}'** 카드를 중심으로 내용을 변경하고, 관련된 다른 카드의 정보도 자연스럽게 수정해야 합니다."""
    
    chosen_model = request.model_name or ai_models.available[0]
    model = genai.GenerativeModel(chosen_model)

    prompt = f"""당신은 세계관 설정의 일관성을 유지하는 전문 편집자입니다.
아래 정보를 바탕으로 **세계관 설정 카드**의 내용을 수정해주세요.
**매우 중요한 규칙:**
1. {editing_instruction}
2. 절대로 기존 카드의 'id'는 변경해서는 안 됩니다.
3. 최종 결과는 반드시 아래 명시된 JSON 형식으로만 반환해야 합니다.
---
[메인 세계관 정보]
{main_worldview_context}
---
[관련 설정 카드 정보 (JSON)]
{json.dumps([{"id": c.id, "title": c.title, "content": c.content} for c in cards_from_db], indent=2, ensure_ascii=False)}
---
[사용자 요청사항]
"{request.prompt_text}"
---
[출력 JSON 형식]
{{
  "updated_cards": [
    {{
      "id": "수정된 카드의 id",
      "title": "새로운 제목 (변경 시)",
      "content": "새로운 내용 (순수 텍스트)"
    }}
  ]
}}
"""
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        ai_result = json.loads(response.text)
        return ai_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 수정 작업 중 오류가 발생했습니다: {e}")

@router.put("/projects/{project_id}/cards/{card_id}/move")
def move_card(project_id: str, card_id: str, request: MoveCardRequest, db: Session = Depends(database.get_db)):
    card = db.query(CardModel).join(GroupModel).filter(CardModel.id == card_id, GroupModel.project_id == project_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="이동할 카드를 찾을 수 없습니다.")
    card.group_id = request.target_group_id
    db.commit()
    return {"message": "카드가 성공적으로 이동되었습니다."}

@router.put("/projects/{project_id}/groups/{group_id}/cards/order")
def update_card_order(project_id: str, group_id: str, request: UpdateCardOrderRequest, db: Session = Depends(database.get_db)):
    group = db.query(GroupModel).filter(GroupModel.id == group_id, GroupModel.project_id == project_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    for index, card_id in enumerate(request.card_ids):
        db.query(CardModel).filter(CardModel.id == card_id, CardModel.group_id == group_id).update({"ordering": index})
    db.commit()
    return {"message": "카드 순서가 성공적으로 업데이트되었습니다."}

@router.post("/projects/{project_id}/cards/{card_id}/highlight-names")
async def highlight_names_in_text(project_id: str, card_id: str, request: HighlightNamesRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )
    
    protagonist_card = db.query(CardModel).filter(CardModel.id == card_id).first()
    if not protagonist_card:
        raise HTTPException(status_code=404, detail="주인공 카드를 찾을 수 없습니다.")
    protagonist_name = protagonist_card.name

    all_cards_in_project = db.query(CardModel).join(GroupModel).filter(GroupModel.project_id == project_id, CardModel.id != card_id).all()
    other_character_names = list(set([card.name for card in all_cards_in_project]))
    
    model = genai.GenerativeModel(ai_models.available[0])
    
    prompt = f"""당신은 텍스트에서 등장인물 이름을 정확히 찾아내는 AI 편집자입니다.
**매우 중요한 규칙:**
1.  주어진 '원본 텍스트'에서 '본인 이름'과 '타인 이름 목록'에 포함된 모든 이름을 찾으세요.
2.  이름 뒤에 한국어 조사(예: 은, 는, 이, 가)가 붙어 있을 경우, **조사까지 포함하여** 태그를 적용해야 합니다.
3.  찾은 이름들을 아래의 HTML 태그 규칙에 따라 정확하게 감싸주세요.
    -   **본인 이름:** `<span class="protagonist">{protagonist_name}</span>`
    -   **타인 이름:** `<strong>{{other_character_name}}</strong>`
4.  주어진 이름 목록에 없는 단어는 절대로 태그로 감싸서는 안 됩니다.
5.  최종 결과는 HTML 태그가 적용된 전체 텍스트여야 합니다.
---
[본인 이름]
{protagonist_name}
[타인 이름 목록]
{', '.join(other_character_names) if other_character_names else '없음'}
[원본 텍스트]
{request.text_content}
---
[출력 (HTML 태그가 적용된 텍스트)]
"""
    try:
        response = await model.generate_content_async(prompt)
        highlighted_text = response.text.strip()
        return {"highlighted_text": highlighted_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 이름 하이라이팅 처리 중 오류가 발생했습니다: {e}")


@router.post("/projects/{project_id}/relationships/suggest")
async def suggest_relationship(project_id: str, request: SuggestRelationshipRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    char_a = db.query(CardModel).filter(CardModel.id == request.source_character_id).first()
    char_b = db.query(CardModel).filter(CardModel.id == request.target_character_id).first()
    
    if not char_a or not char_b:
        raise HTTPException(status_code=404, detail="하나 이상의 캐릭터 정보를 찾을 수 없습니다.")

    char_a = parse_card_fields(char_a)
    char_b = parse_card_fields(char_b)
    
    existing_relationship = db.query(RelationshipModel).filter(
        RelationshipModel.source_character_id == request.target_character_id,
        RelationshipModel.target_character_id == request.source_character_id
    ).first()

    existing_relationship_context = ""
    if existing_relationship:
        existing_relationship_context = f"""
---
[기존 관계 정보]
참고: 현재 '{char_b.name}'는 '{char_a.name}'를 '{existing_relationship.type}' 관계로 생각하고 있습니다.
(설명: {existing_relationship.description})
이 정보를 바탕으로, '{char_a.name}'가 '{char_b.name}'를 어떻게 생각할지 일관성 있게 작성해주세요.
---
"""
    
    additional_instructions = []
    if request.tendency < 0:
        additional_instructions.append("두 캐릭터의 관계는 '비우호적' (예: 라이벌, 불신)인 방향으로 설정해주세요.")
    elif request.tendency > 0:
        additional_instructions.append("두 캐릭터의 관계는 '우호적' (예: 동료, 친구)인 방향으로 설정해주세요.")

    if request.keyword:
        additional_instructions.append(f"특히, 관계 설정 시 '{request.keyword}' 라는 키워드를 핵심적으로 반영해주세요.")
    
    final_instruction = "\n".join(additional_instructions)
    
    model = genai.GenerativeModel(ai_models.available[0])
    prompt = f"""당신은 두 인물 사이의 관계를 창의적으로 설정하는 스토리 작가입니다.
아래 제공된 두 캐릭터의 프로필과 기존 관계 정보를 자세히 분석하여, 둘 사이에 존재할 법한 가장 흥미롭고 개연성 있는 관계를 추천해주세요.
**매우 중요한 규칙:**
1.  결과는 반드시 아래 명시된 JSON 스키마를 따르는 JSON 객체로만 응답해야 합니다.
2.  'type'에는 관계를 한두 단어로 요약한 키워드를, 'description'에는 그 관계에 대한 2~3문장의 구체적인 설명을 작성해주세요.
3.  **생성되는 관계 설명은 반드시 '캐릭터 A'와 '캐릭터 B' 두 사람 사이의 직접적인 이야기에만 집중해야 합니다.**
4.  {final_instruction}
{existing_relationship_context}
---
[캐릭터 A 프로필 ({char_a.name})]
- 설명: {char_a.description}
- 목표: {', '.join(char_a.goal)}
- 성격: {', '.join(char_a.personality)}
[캐릭터 B 프로필 ({char_b.name})]
- 설명: {char_b.description}
- 목표: {', '.join(char_b.goal)}
- 성격: {', '.join(char_b.personality)}
---
**출력 JSON 스키마:**
{{
  "type": "관계 유형 (예: 숙명의 라이벌)",
  "description": "관계에 대한 구체적인 설명 (2~3 문장)."
}}
"""
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        suggestion = json.loads(response.text)
        return suggestion
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 관계 추천 중 오류가 발생했습니다: {e}")

@router.post("/generate/scenario-concept")
async def refine_scenario_concept(request: RefineConceptRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )
    
    worldview = db.query(WorldviewModel).filter(WorldviewModel.project_id == request.project_id).first()
    worldview_context = ""
    if worldview and worldview.content and worldview.content.strip():
        try:
            worldview_data = json.loads(worldview.content)
            genre = worldview_data.get('genre', '미설정')
            rules = worldview_data.get('rules', [])
            rules_text = "\n- ".join(rules)
            worldview_context = f"""
[참고할 메인 세계관]
- 장르 및 분위기: {genre}
- 핵심 설정:
- {rules_text}
"""
        except json.JSONDecodeError:
            worldview_context = f"\n[참고할 메인 세계관]\n{worldview.content}"


    try:
        chosen_model = request.model_name or ai_models.available[0]
        model = genai.GenerativeModel(chosen_model)
        prompt = f"""당신은 사용자의 아이디어를 존중하며 글을 다듬는 전문 스토리 에디터입니다.
아래 정보를 바탕으로, '기존 컨셉'의 핵심 아이디어와 뉘앙스를 **반드시 유지**하면서, 문장을 더욱 생생하고 구체적으로 다듬어 주세요.
{worldview_context}

**매우 중요한 규칙:**
1.  **세계관 일관성:** 다듬어진 문장은 반드시 '메인 세계관'의 설정과 충돌해서는 안 됩니다.
2.  **핵심 의도와 감성 유지:** 원본 문장이 가진 고유의 감성(예: 희망, 비극, 유머 등)과 핵심 의도를 변경해서는 안 됩니다. 문장을 확장하고 구체화하되, 완전히 다른 이야기로 바꾸지 마세요.
3.  추상적인 표현을 구체적인 상황이나 감정이 드러나도록 풍부하게 만들어 주세요.
4.  최종 결과는 **오직 다듬어진 한두 문장, 혹은 두세 문장의 컨셉 텍스트**여야 합니다. 다른 설명을 붙이지 마세요.

---
[기존 컨셉]
{request.existing_concept}
---
[출력]
(AI가 핵심 뉘앙스와 세계관을 유지하며 다듬은 새로운 컨셉)
"""
        response = await model.generate_content_async(prompt)
        return {"refined_concept": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 컨셉 생성에 실패했습니다. 오류: {e}")

# [신규] 세계관 핵심 설정 다듬기 API 엔드포인트
@router.post("/generate/worldview-rule")
async def refine_worldview_rule(request: RefineWorldviewRuleRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    worldview_context = ""
    if project.worldview and project.worldview.content:
        try:
            worldview_data = json.loads(project.worldview.content)
            genre = worldview_data.get('genre', '미설정')
            # 현재 수정 중인 룰을 제외한 나머지 룰들을 컨텍스트로 제공
            other_rules = [rule for rule in worldview_data.get('rules', []) if rule != request.existing_rule]
            other_rules_text = "\n- ".join(other_rules)
            worldview_context = f"""
[참고할 메인 세계관 정보]
- 장르 및 분위기: {genre}
- 다른 핵심 설정들:
- {other_rules_text}
"""
        except (json.JSONDecodeError, TypeError):
            pass

    try:
        chosen_model = request.model_name or ai_models.available[0]
        model = genai.GenerativeModel(chosen_model)
        prompt = f"""당신은 사용자의 아이디어를 존중하며 문장을 다듬는 전문 에디터입니다.
아래 정보를 바탕으로, '기존 설정 문장'의 핵심 아이디어와 뉘앙스를 **반드시 유지**하면서, 문장을 더욱 흥미롭고 구체적으로 다듬어 주세요.

{worldview_context}

**매우 중요한 규칙:**
1.  **일관성 유지:** 다듬어진 문장은 '메인 세계관 정보'와 충돌해서는 안 됩니다.
2.  **핵심 의도 유지:** 원본 문장이 가진 핵심 의미를 변경하지 마세요. 문장을 확장하고 구체화하되, 완전히 다른 내용으로 바꾸지 마세요.
3.  최종 결과는 **오직 다듬어진 한 문장의 텍스트**여야 합니다. 다른 설명을 붙이지 마세요.

---
[기존 설정 문장]
{request.existing_rule}
---
[출력]
(AI가 핵심 뉘앙스와 세계관을 유지하며 다듬은 새로운 문장)
"""
        response = await model.generate_content_async(prompt)
        return {"refined_rule": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 설정 다듬기에 실패했습니다. 오류: {e}")

# [신규] 시놉시스 구체화 API 엔드포인트
@router.post("/generate/synopsis-enhance")
async def enhance_synopsis_with_ai(request: EnhanceSynopsisRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        error_response = create_ai_error_response(
            operation="setup",
            original_error=Exception("GOOGLE_API_KEY not configured"),
            ai_response=None
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response.model_dump()
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # [수정] 컨텍스트 정보 준비 (선택된 경우에만)
    context_parts = []
    
    # 선택된 캐릭터 정보 추가
    if request.selected_character_ids:
        selected_characters = db.query(CardModel).filter(CardModel.id.in_(request.selected_character_ids)).all()
        if selected_characters:
            char_info = [f"- {card.name}: {card.description[:100]}..." if len(card.description) > 100 else f"- {card.name}: {card.description}" for card in selected_characters]
            context_parts.append(f"[참고할 캐릭터 정보]\n" + "\n".join(char_info))
    
    # 선택된 세계관 카드 정보 추가
    if request.selected_worldview_card_ids:
        selected_cards = db.query(WorldviewCardModel).filter(WorldviewCardModel.id.in_(request.selected_worldview_card_ids)).all()
        if selected_cards:
            card_info = [f"- {card.title}: {card.content[:80]}..." if len(card.content) > 80 else f"- {card.title}: {card.content}" for card in selected_cards]
            context_parts.append(f"[참고할 세계관 설정]\n" + "\n".join(card_info))
    
    # 컨텍스트 문자열 생성
    context_text = "\n\n".join(context_parts) if context_parts else ""

    try:
        chosen_model = request.model_name or ai_models.available[0]
        model = genai.GenerativeModel(chosen_model)
        
        # [복구] 처음 설계했던 풍성하고 상세한 프롬프트 (Flash 모델이므로 안전)
        prompt = f"""당신은 사용자의 창작 의도를 정확히 파악하고 이를 발전시키는 전문 스토리 에디터입니다.
아래 정보를 바탕으로, 사용자의 '요청사항'에 따라 '기존 시놉시스'를 수정하고 발전시켜 주세요.

{context_text}

**매우 중요한 규칙:**
1. **사용자 의도 존중:** 사용자의 요청사항을 최우선으로 하고, 기존 시놉시스의 핵심 아이디어는 유지해주세요.
2. **참고 정보 활용:** 선택된 캐릭터와 설정 정보가 있다면 자연스럽게 반영해주세요.
3. **감성과 톤 유지:** 원본 시놉시스가 가진 고유의 감성(유머, 진지함, 비극성 등)과 문체를 존중해주세요.
4. **완성된 결과물:** 최종 결과는 수정된 시놉시스 텍스트만 출력해야 합니다. 설명이나 부가 내용을 붙이지 마세요.

---
[기존 시놉시스]
{request.existing_synopsis}

[사용자 요청사항]
{request.user_prompt}

---
[출력]
(사용자 요청에 따라 수정/발전된 새로운 시놉시스)"""
        response = await model.generate_content_async(prompt)
        return {"enhanced_synopsis": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 시놉시스 구체화에 실패했습니다. 오류: {e}")