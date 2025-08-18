from fastapi import APIRouter, HTTPException, Depends
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

# --- Pydantic 모델 ---
class GenerateRequest(BaseModel):
    keywords: str
    character_ids: Optional[List[str]] = None
    worldview_context: Optional[str] = None
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
    selected_group_ids: Optional[List[str]] = None # 이 필드는 현재 사용되지 않음
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

# --- 라우터 및 설정 ---
router = APIRouter(
    prefix="/api/v1",
    tags=["Generators & Cards"]
)

AVAILABLE_MODELS = ["gemini-1.5-flash", "gemini-pro"]
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# --- 유틸리티 함수 ---
def parse_card_fields(card_obj):
    """DB에서 가져온 Card 객체의 JSON 문자열 필드를 리스트로 변환"""
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
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")
    try:
        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        model = genai.GenerativeModel(chosen_model)
        prompt = f"""당신은 상상력이 매우 풍부한 세계관 기획 전문가입니다.
사용자가 제공한 '핵심 키워드'를 바탕으로, 독창적이고 흥미로운 가상의의 세계관의 기본 설정을 구체적으로 작성해주세요.
**매우 중요한 규칙:**
1.  결과는 반드시 '출력 항목 예시'에 명시된 5가지 항목(세계의 이름과 분위기, 핵심 설정, 주요 역사, 지배 세력, 주요 갈등)을 모두 포함해야 합니다.
2.  다른 어떤 설명도 추가하지 말고, 생성된 세계관 설정 텍스트 본문만 응답해야 합니다.
---
[핵심 키워드]
"{request.keywords}"
---
[출력]
(당신이 창조한 새로운 세계관 설정)
"""
        response = await model.generate_content_async(prompt)
        cleaned_response = response.text.strip().replace("```", "")
        return {"worldview_text": cleaned_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 신규 세계관 생성에 실패했습니다. 오류: {e}")


@router.post("/generate/worldview/edit")
async def edit_existing_worldview(request: EditWorldviewRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")
    try:
        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        model = genai.GenerativeModel(chosen_model)
        prompt = f"""당신은 세계관 설정의 일관성을 유지하는 전문 편집자입니다.
아래에 제공된 '기존 세계관 설정'을 바탕으로, 사용자의 '요청사항'을 반영하여 설정을 수정하거나 확장하는 임무를 받았습니다.
**매우 중요한 규칙:**
1.  **'기존 세계관 설정'의 구조, 문체, 핵심 용어 등을 반드시 유지해야 합니다.**
2.  사용자의 '요청사항'은 기존 설정에 자연스럽게 녹아들도록 추가하거나, 기존 내용의 일부를 논리적으로 수정하는 방식으로 반영해야 합니다.
3.  최종 결과물은 **완성된 전체 세계관 텍스트**여야 합니다. 추가된 부분만 응답해서는 안 됩니다.
---
[기존 세계관 설정]
{request.existing_content}
---
[사용자 요청사항]
"{request.keywords}"
---
[출력]
(수정/확장된 전체 세계관 텍스트)
"""
        response = await model.generate_content_async(prompt)
        cleaned_response = response.text.strip().replace("```", "")
        return {"worldview_text": cleaned_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 세계관 수정에 실패했습니다. 오류: {e}")


@router.post("/projects/{project_id}/generate/character")
async def generate_character(project_id: str, request: GenerateRequest, db: Session = Depends(database.get_db)):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

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

    worldview_context_prompt = ""
    if request.worldview_context:
        base_worldview_prompt = f"\n**참고할 메인 세계관 설정:**\n---\n{request.worldview_context}\n---"
        level_instruction = ""
        if request.worldview_level == 'high':
            level_instruction = "\n- 캐릭터의 모든 설정은 메인 세계관 및 서브 설정과 깊고 직접적으로 연결되어야 합니다."
        elif request.worldview_level == 'medium':
            level_instruction = "\n- 캐릭터는 메인 세계관 및 서브 설정의 사회, 문화적 배경에 자연스럽게 녹아들어야 합니다."
        elif request.worldview_level == 'low':
             level_instruction = "\n- 캐릭터의 개인적인 서사 중심으로 서술하되, 세계관의 큰 흐름과는 무관하게 설정해주세요."
        else: 
            level_instruction = "\n- 세계관의 고유 설정(지명, 특정 사건 등)은 언급하지 말고, 장르와 분위기만 참고하세요."
        worldview_context_prompt = base_worldview_prompt + level_instruction

    chosen_model = request.model_name or AVAILABLE_MODELS[0]
    model = genai.GenerativeModel(chosen_model)

    prompt = f"""당신은 매력적인 스토리를 만드는 세계관 설정 작가입니다.
아래 '정보'와 '지시사항'을 모두 종합적으로 고려하여, 이 세계에 자연스럽게 녹아들 수 있는 새로운 판타지 캐릭터 카드 1개를 생성해 주세요.
{worldview_context_prompt}
{worldview_cards_context_prompt}
{character_context_prompt}
**요청 키워드:** {request.keywords}
**매우 중요한 규칙:**
1.  **HTML 태그는 절대 사용하지 말고, 순수한 텍스트로만 응답해야 합니다.**
2.  결과는 반드시 아래 명시된 JSON 스키마를 따르는 JSON 객체로만 응답해야 합니다. 다른 어떤 텍스트도 포함하지 마세요.
**출력 JSON 스키마:**
{{
  "name": "캐릭터 이름",
  "description": "캐릭터의 외모, 성격, 배경 이야기 (순수 텍스트).",
  "goal": ["캐릭터의 목표 또는 동기 1", "캐릭터의 목표 또는 동기 2"],
  "personality": ["성격 키워드 1", "성격 키워드 2"],
  "abilities": ["보유 기술 또는 능력 1", "보유 기술 또는 능력 2"],
  "quote": ["캐릭터를 대표하는 대사 1", "캐릭터를 대표하는 대사 2", "캐릭터를 대표하는 대사 3", "캐릭터를 대표하는 대사 4", "캐릭터를 대표하는 대사 5"],
  "introduction_story": "등장 서사 (순수 텍스트)."
}}
"""
    try:
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        character_data = json.loads(response.text)
        return character_data
    except Exception as e:
        error_detail = f"AI 캐릭터 생성에 실패했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)

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
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

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
    
    worldview_content = project.worldview.content if project.worldview else ""
    full_project_context = json.dumps({
        "name": project.name,
        "worldview": {"content": worldview_content},
        "cards": cards_for_context
    }, indent=2, ensure_ascii=False)

    editing_instruction = f"""**오직 '{edited_card_name}' 캐릭터만 수정**해야 합니다."""
    if request.edit_related_characters:
        editing_instruction = f"""사용자의 요청에 따라 캐릭터 정보를 수정할 때, **'{edited_card_name}'** 캐릭터를 중심으로 서사를 변경해주세요. 한 캐릭터의 수정이 다른 캐릭터의 서사에 영향을 준다면, 컨텍스트로 제공된 관련된 다른 캐릭터들의 정보도 자연스럽게 수정해야 합니다."""

    chosen_model = request.model_name or AVAILABLE_MODELS[0]
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
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    main_worldview_context = project.worldview.content if project and project.worldview else ""

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
    
    chosen_model = request.model_name or AVAILABLE_MODELS[0]
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
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")
    
    protagonist_card = db.query(CardModel).filter(CardModel.id == card_id).first()
    if not protagonist_card:
        raise HTTPException(status_code=404, detail="주인공 카드를 찾을 수 없습니다.")
    protagonist_name = protagonist_card.name

    all_cards_in_project = db.query(CardModel).join(GroupModel).filter(GroupModel.project_id == project_id, CardModel.id != card_id).all()
    other_character_names = list(set([card.name for card in all_cards_in_project]))
    
    model = genai.GenerativeModel(AVAILABLE_MODELS[0])
    
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
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

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
    
    model = genai.GenerativeModel(AVAILABLE_MODELS[0])
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