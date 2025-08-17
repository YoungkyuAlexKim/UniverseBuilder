# FILE: generators.py

from fastapi import APIRouter, HTTPException
import json
import os
import time
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List
from .. import database # app 폴더의 database.py를 import 합니다.

# 사용 가능한 AI 모델 목록
AVAILABLE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"]

load_dotenv()

# Google Gemini API 설정
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("경고: GOOGLE_API_KEY 환경 변수를 찾을 수 없습니다. AI 기능이 작동하지 않습니다.")
else:
    genai.configure(api_key=api_key)

# --- Pydantic 데이터 모델 ---
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
    goal: str
    personality: str
    abilities: str
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

# [수정] AI 관계 추천 요청 모델
class SuggestRelationshipRequest(BaseModel):
    source_character_id: str
    target_character_id: str
    tendency: Optional[int] = 0
    keyword: Optional[str] = None


# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1",
    tags=["Generators & Cards"]
)

@router.post("/generate/worldview/new")
async def generate_new_worldview(request: NewWorldviewRequest):
    """(신규) 키워드 기반으로 새로운 세계관을 생성합니다."""
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    try:
        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        if chosen_model not in AVAILABLE_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"잘못된 모델 이름입니다. 다음 중에서 선택해주세요: {', '.join(AVAILABLE_MODELS)}"
            )
        model = genai.GenerativeModel(chosen_model)

        prompt = f"""당신은 상상력이 매우 풍부한 세계관 기획 전문가입니다.
사용자가 제공한 '핵심 키워드'를 바탕으로, 독창적이고 흥미로운 가상의의 세계관의 기본 설정을 구체적으로 작성해주세요.

**매우 중요한 규칙:**
1.  아래 '출력 항목 예시'는 **어떤 내용을 채워야 하는지에 대한 안내일 뿐, 예시 단어를 그대로 사용하는것은 권장하지 않습니다.** 당신만의 고유한 이름과 설정을 창조해주세요.
2.  결과는 반드시 '출력 항목 예시'에 명시된 5가지 항목(세계의 이름과 분위기, 핵심 설정, 주요 역사, 지배 세력, 주요 갈등)을 모두 포함해야 합니다.
3.  다른 어떤 설명도 추가하지 말고, 생성된 세계관 설정 텍스트 본문만 응답해야 합니다.

---
[핵심 키워드]
"{request.keywords}"
---
[출력 항목 예시 (이 단어들을 쓰지 마세요!)]
- **세계의 이름과 전반적인 분위기:** (예: 잿빛 하늘의 제국, 아르카디아)
- **핵심 설정과 독특한 시스템:** (예: 마법이 증기기관으로 대체된 시대)
- **주요 역사적 사건:** (예: 대마법 전쟁, 신들의 침묵)
- **지배적인 종족 또는 세력:** (예: 고대 용족의 후예들, 기계 신을 숭배하는 교단)
- **현재 시대의 주요 갈등 요소:** (예: 고갈되어 가는 마나 자원을 둘러싼 대립)
---

[출력]
(당신이 창조한 새로운 세계관 설정)
"""
        response = await model.generate_content_async(prompt)
        cleaned_response = response.text.strip().replace("```", "")
        return {"worldview_text": cleaned_response}
    except Exception as e:
        print(f"AI 신규 세계관 생성 오류: {e}")
        raise HTTPException(status_code=500, detail=f"AI 신규 세계관 생성에 실패했습니다. 오류: {e}")


@router.post("/generate/worldview/edit")
async def edit_existing_worldview(request: EditWorldviewRequest):
    """(수정) 기존 세계관 내용과 요청사항을 바탕으로 설정을 수정/확장합니다."""
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    try:
        chosen_model = request.model_name or AVAILABLE_MODELS
        if chosen_model not in AVAILABLE_MODELS:
            raise HTTPException(
                status_code=400,
                detail=f"잘못된 모델 이름입니다. 다음 중에서 선택해주세요: {', '.join(AVAILABLE_MODELS)}"
            )
        model = genai.GenerativeModel(chosen_model)
        
        prompt = f"""당신은 세계관 설정의 일관성을 유지하는 전문 편집자입니다.
아래에 제공된 '기존 세계관 설정'을 바탕으로, 사용자의 '요청사항'을 반영하여 설정을 수정하거나 확장하는 임무를 받았습니다.

**매우 중요한 규칙:**
1.  **'기존 세계관 설정'의 구조, 문체, 핵심 용어 등을 반드시 유지해야 합니다.** 이는 이야기의 근간이므로, 절대 무시해서는 안 됩니다.
2.  사용자의 '요청사항'은 기존 설정에 자연스럽게 녹아들도록 추가하거나, 기존 내용의 일부를 논리적으로 수정하는 방식으로 반영해야 합니다.
3.  만약 요청사항이 비어 있거나 "살을 붙여줘" 또는 "더 자세하게"와 같이 추상적이라면, 기존 설정의 각 항목을 더 구체적인 예시와 상세한 묘사로 채워 넣어 전체적인 깊이를 더해야 합니다.
4.  최종 결과물은 **완성된 전체 세계관 텍스트**여야 합니다. 추가된 부분만 응답해서는 안 됩니다.

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
        print(f"AI 세계관 수정 오류: {e}")
        raise HTTPException(status_code=500, detail=f"AI 세계관 수정에 실패했습니다. 오류: {e}")


@router.post("/projects/{project_id}/generate/character")
async def generate_character(project_id: str, request: GenerateRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    conn = database.get_db_connection()
    try:
        worldview_cards_context_prompt = ""
        if request.worldview_card_ids:
            try:
                placeholders = ','.join('?' for _ in request.worldview_card_ids)
                query = f'SELECT title, content FROM worldview_cards WHERE id IN ({placeholders})'
                cards_from_db = conn.execute(query, request.worldview_card_ids).fetchall()
                if cards_from_db:
                    card_info = [f"- {card['title']}: {card['content']}" for card in cards_from_db]
                    worldview_cards_context_prompt = "\n**참고할 서브 설정 카드 정보:**\n" + "\n".join(card_info)
            except Exception as e:
                print(f"서브 설정 컨텍스트 생성 중 DB 오류: {e}")

        character_context_prompt = ""
        if request.character_ids:
            try:
                placeholders = ','.join('?' for _ in request.character_ids)
                query = f'SELECT name, description FROM cards WHERE id IN ({placeholders})'
                existing_cards = conn.execute(query, request.character_ids).fetchall()
                if existing_cards:
                    character_info = [f"- 이름: {card['name']}, 설명: {card['description']}" for card in existing_cards]
                    character_context_prompt = "\n**참고할 기존 캐릭터 정보:**\n" + "\n".join(character_info)
            except Exception as e:
                print(f"캐릭터 컨텍스트 생성 중 DB 오류: {e}")

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
        if chosen_model not in AVAILABLE_MODELS:
            raise HTTPException(status_code=400, detail=f"잘못된 모델 이름입니다: {', '.join(AVAILABLE_MODELS)}")
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
  "goal": "캐릭터의 목표 또는 동기 (순수 텍스트)",
  "personality": "성격 키워드 (순수 텍스트)",
  "abilities": "보유 기술 또는 능력 (순수 텍스트)",
  "quote": ["캐릭터를 대표하는 대사 1", "캐릭터를 대표하는 대사 2", "캐릭터를 대표하는 대사 3", "캐릭터를 대표하는 대사 4", "캐릭터를 대표하는 대사 5"],
  "introduction_story": "등장 서사 (순수 텍스트)."
}}
"""
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        character_data = json.loads(response.text)

        return character_data
    except Exception as e:
        error_detail = f"AI 캐릭터 생성에 실패했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        print(f"AI 생성 오류: {e}")
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        conn.close()


@router.post("/projects/{project_id}/groups/{group_id}/cards")
def add_card_to_project(project_id: str, group_id: str, card: CharacterCard):
    conn = database.get_db_connection()
    try:
        group = conn.execute('SELECT id FROM groups WHERE id = ? AND project_id = ?', (group_id, project_id)).fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")

        new_card_id = f"card-{int(time.time() * 1000)}"
        
        cursor = conn.execute('SELECT COUNT(id) as card_count FROM cards WHERE group_id = ?', (group_id,))
        card_count = cursor.fetchone()['card_count']
        
        quote_json = json.dumps(card.quote, ensure_ascii=False) if card.quote else None
        
        conn.execute('''
            INSERT INTO cards (id, group_id, name, description, goal, personality, abilities, quote, introduction_story, ordering)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            new_card_id, group_id, card.name, card.description, card.goal,
            card.personality, card.abilities, quote_json, card.introduction_story,
            card_count
        ))
        
        conn.commit()
        
        new_card_data = dict(conn.execute('SELECT * FROM cards WHERE id = ?', (new_card_id,)).fetchone())
        
        if new_card_data.get('quote'):
            new_card_data['quote'] = json.loads(new_card_data['quote'])
        
        return {"message": "카드가 성공적으로 저장되었습니다.", "card": new_card_data}

    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    finally:
        conn.close()


@router.delete("/projects/{project_id}/groups/{group_id}/cards/{card_id}")
def delete_card_from_project(project_id: str, group_id: str, card_id: str):
    conn = database.get_db_connection()
    card_to_delete = conn.execute('''
        SELECT c.id FROM cards c JOIN groups g ON c.group_id = g.id
        WHERE c.id = ? AND g.id = ? AND g.project_id = ?
    ''', (card_id, group_id, project_id)).fetchone()

    if not card_to_delete:
        conn.close()
        raise HTTPException(status_code=404, detail="삭제할 카드를 찾을 수 없거나 권한이 없습니다.")

    cursor = conn.execute('DELETE FROM cards WHERE id = ?', (card_id,))
    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")

    conn.close()
    return {"message": "카드가 성공적으로 삭제되었습니다."}

@router.put("/projects/{project_id}/cards/{card_id}/edit-with-ai")
async def edit_card_with_ai(project_id: str, card_id: str, request: AIEditRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    conn = database.get_db_connection()
    try:
        project = conn.execute('SELECT * FROM projects WHERE id = ?', (project_id,)).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
        
        project_dict = dict(project)
        worldview = conn.execute('SELECT content FROM worldviews WHERE project_id = ?', (project_id,)).fetchone()
        project_dict['worldview'] = dict(worldview) if worldview else {'content': ''}

        all_card_ids = set(request.selected_card_ids or [])
        all_card_ids.add(card_id)

        groups_list = []
        all_cards = []
        edited_card_name = ""

        if request.selected_group_ids:
            placeholders = ','.join('?' for _ in request.selected_group_ids)
            cards_in_groups = conn.execute(f'SELECT id FROM cards WHERE group_id IN ({placeholders})', request.selected_group_ids).fetchall()
            for card in cards_in_groups:
                all_card_ids.add(card['id'])

        if all_card_ids:
            card_placeholders = ','.join('?' for _ in all_card_ids)
            cards_from_db = conn.execute(f'SELECT * FROM cards WHERE id IN ({card_placeholders})', list(all_card_ids)).fetchall()
            for card in cards_from_db:
                card_dict = dict(card)
                for field in ['quote', 'personality', 'abilities', 'goal']:
                    try:
                        if card_dict.get(field):
                            card_dict[field] = json.loads(card_dict[field])
                    except (json.JSONDecodeError, TypeError):
                        original_value = card_dict.get(field)
                        if isinstance(original_value, str):
                            card_dict[field] = [item.strip() for item in original_value.split(',') if item.strip()]
                        else:
                            card_dict[field] = []
                all_cards.append(card_dict)
                if card_dict['id'] == card_id:
                    edited_card_name = card_dict['name']
        
        card_group_ids = {card['group_id'] for card in all_cards}
        if card_group_ids:
            group_placeholders = ','.join('?' for _ in card_group_ids)
            groups_from_db = conn.execute(f'SELECT * FROM groups WHERE id IN ({group_placeholders})', list(card_group_ids)).fetchall()
            
            group_map = {group['id']: dict(group) for group in groups_from_db}
            for group_id in group_map:
                group_map[group_id]['cards'] = []

            for card in all_cards:
                if card['group_id'] in group_map:
                    group_map[card['group_id']]['cards'].append(card)
            
            groups_list = list(group_map.values())

        project_dict['groups'] = groups_list
        full_project_context = json.dumps(project_dict, indent=2, ensure_ascii=False)

        if request.edit_related_characters:
            editing_instruction = f"""사용자의 요청에 따라 캐릭터 정보를 수정할 때, **'{edited_card_name}'** 캐릭터를 중심으로 서사를 변경해주세요. 한 캐릭터의 수정이 다른 캐릭터의 서사에 영향을 준다면, 컨텍스트로 제공된 관련된 다른 캐릭터들의 정보도 자연스럽게 수정해야 합니다."""
        else:
            editing_instruction = f"""**오직 '{edited_card_name}' 캐릭터만 수정**해야 합니다. 컨텍스트로 제공된 다른 캐릭터 정보는 이야기의 일관성을 위한 **참고 자료로만 활용**하고, 절대로 그들의 설명이나 서사를 수정해서는 안 됩니다."""
        
        worldview_level_instruction = ""
        if project_dict.get('worldview', {}).get('content'):
            if request.worldview_level == 'high':
                worldview_level_instruction = "\n- **세계관 반영(높음):** 수정되는 내용은 세계관의 핵심 갈등 및 설정과 깊게 연관되어야 합니다."
            elif request.worldview_level == 'medium':
                worldview_level_instruction = "\n- **세계관 반영(중간):** 수정되는 내용은 세계관의 사회, 문화적 배경에 자연스럽게 녹아들어야 합니다."
            elif request.worldview_level == 'low':
                worldview_level_instruction = "\n- **세계관 반영(낮음):** 세계관의 큰 흐름과는 무관한, 캐릭터의 개인적인 서사 중심으로 수정해주세요."
            else: 
                worldview_level_instruction = "\n- **세계관 반영(최소):** 세계관의 고유 설정(지명, 인물, 특정 사건)은 언급하지 말고, 장르와 분위기만 참고해주세요."

        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        if chosen_model not in AVAILABLE_MODELS:
            raise HTTPException(status_code=400, detail=f"잘못된 모델 이름입니다. 다음 중에서 선택해주세요: {', '.join(AVAILABLE_MODELS)}")
        model = genai.GenerativeModel(chosen_model)
        
        prompt = f"""당신은 세계관 설정의 일관성을 유지하는 전문 편집자입니다.
아래에 제공되는 '프로젝트 데이터'와 '사용자 요청사항'을 바탕으로 캐릭터 카드 정보를 수정해주세요.

**매우 중요한 규칙:**
1. **HTML 태그는 절대 사용하지 말고, 순수한 텍스트로만 응답해야 합니다.**
2. {editing_instruction}
3. 캐릭터의 핵심 설정(예: 성격, 목표)이 변경되면, 관련된 다른 모든 항목(설명, 대사 등)도 논리적 일관성을 유지하도록 함께 수정해야 합니다.
4. 'quote', 'personality', 'abilities', 'goal' 항목은 반드시 **배열(리스트)** 형태로 반환해야 합니다. 'quote'는 최소 5개 이상이어야 합니다.
5. 절대로 기존 카드의 'id'는 변경해서는 안 됩니다.{worldview_level_instruction}
6. 최종 결과는 반드시 아래 명시된 JSON 형식으로만 반환해야 합니다. 다른 어떤 설명도 추가하지 마세요.

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
      "goal": ["새로운 목표 1", "새로운 목표 2"],
      "personality": ["새로운 성격 키워드 1", "새로운 성격 키워드 2"],
      "abilities": ["새로운 기술 또는 능력 1", "새로운 기술 또는 능력 2"],
      "quote": ["새로운 대사 1", "새로운 대사 2", "새로운 대사 3", "새로운 대사 4", "새로운 대사 5"],
      "introduction_story": "새로운 서사 (순수 텍스트)"
    }}
  ]
}}
"""
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        cleaned_response = response.text.strip().lstrip("```json").rstrip("```")
        ai_result = json.loads(cleaned_response)

        return ai_result

    except Exception as e:
        print(f"AI 수정 작업 오류: {e}")
        error_detail = f"AI 수정 작업 중 오류가 발생했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        conn.close()

@router.put("/projects/{project_id}/worldview_cards/{card_id}/edit-with-ai")
async def edit_worldview_card_with_ai(project_id: str, card_id: str, request: AIEditWorldviewRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    conn = database.get_db_connection()
    try:
        main_worldview_content = conn.execute('SELECT content FROM worldviews WHERE project_id = ?', (project_id,)).fetchone()
        main_worldview_context = main_worldview_content['content'] if main_worldview_content else ""

        all_card_ids = set(request.selected_card_ids or [])
        all_card_ids.add(card_id)
        
        card_placeholders = ','.join('?' for _ in all_card_ids)
        cards_from_db = conn.execute(f'SELECT * FROM worldview_cards WHERE id IN ({card_placeholders})', list(all_card_ids)).fetchall()
        
        if not cards_from_db:
             raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")

        all_cards_dict = {card['id']: dict(card) for card in cards_from_db}
        edited_card_title = all_cards_dict.get(card_id, {}).get('title', '알 수 없는 카드')
        
        editing_instruction = ""
        if request.edit_related_cards:
            editing_instruction = f"""사용자의 요청에 따라 설정 정보를 수정할 때, **'{edited_card_title}'** 카드를 중심으로 내용을 변경해주세요. 한 카드의 수정이 다른 카드의 서사에 영향을 준다면, 컨텍스트로 제공된 관련된 다른 카드의 정보도 자연스럽게 수정해야 합니다."""
        else:
            editing_instruction = f"""**오직 '{edited_card_title}' 설정 카드만 수정**해야 합니다. 컨텍스트로 제공된 다른 카드 정보는 이야기의 일관성을 위한 **참고 자료로만 활용**하고, 절대로 그들의 내용을 수정해서는 안 됩니다."""

        worldview_level_instruction = ""
        if main_worldview_context:
            level = request.worldview_level
            if level == 'high':
                worldview_level_instruction = "\n- **메인 세계관 반영(높음):** 수정 내용은 메인 세계관의 핵심 설정과 직접적으로 연결되어야 합니다."
            elif level == 'medium':
                worldview_level_instruction = "\n- **메인 세계관 반영(중간):** 수정 내용은 메인 세계관의 사회, 문화적 배경에 자연스럽게 녹아들어야 합니다."
            elif level == 'low':
                worldview_level_instruction = "\n- **메인 세계관 반영(낮음):** 캐릭터의 개인 서사처럼, 메인 세계관과 무관한 독립적인 설정으로 만드세요."
            else:
                worldview_level_instruction = "\n- **메인 세계관 반영(최소):** 메인 세계관의 고유 설정(지명, 인물)은 피하고, 장르와 분위기만 참고하세요."

        chosen_model = request.model_name or AVAILABLE_MODELS[0]
        model = genai.GenerativeModel(chosen_model)

        prompt = f"""당신은 세계관 설정의 일관성을 유지하는 전문 편집자입니다.
아래에 제공된 '메인 세계관', '관련 설정 카드', '사용자 요청사항'을 바탕으로 **세계관 설정 카드**의 내용을 수정해주세요.

**매우 중요한 규칙:**
1. {editing_instruction}
2. 카드의 핵심 설정이 변경되면, 제목과 내용이 서로 논리적 일관성을 유지하도록 함께 수정해야 합니다.
3. 절대로 기존 카드의 'id'는 변경해서는 안 됩니다.{worldview_level_instruction}
4. 최종 결과는 반드시 아래 명시된 JSON 형식으로만 반환해야 합니다. 다른 어떤 설명도 추가하지 마세요.

---
[메인 세계관 정보]
{main_worldview_context}
---
[관련 설정 카드 정보 (JSON)]
{json.dumps([dict(c) for c in cards_from_db], indent=2, ensure_ascii=False)}
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
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        ai_result = json.loads(response.text)
        
        return ai_result

    except Exception as e:
        print(f"AI 세계관 카드 수정 작업 오류: {e}")
        error_detail = f"AI 수정 작업 중 오류가 발생했습니다. 오류: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        conn.close()


@router.put("/projects/{project_id}/cards/{card_id}/move")
def move_card(project_id: str, card_id: str, request: MoveCardRequest):
    conn = database.get_db_connection()
    try:
        conn.execute('UPDATE cards SET group_id = ? WHERE id = ?', (request.target_group_id, card_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    finally:
        conn.close()
    return {"message": "카드가 성공적으로 이동되었습니다."}

@router.put("/projects/{project_id}/groups/{group_id}/cards/order")
def update_card_order(project_id: str, group_id: str, request: UpdateCardOrderRequest):
    conn = database.get_db_connection()
    try:
        for index, card_id in enumerate(request.card_ids):
            conn.execute('UPDATE cards SET ordering = ? WHERE id = ? AND group_id = ?', (index, card_id, group_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    finally:
        conn.close()
    return {"message": "카드 순서가 성공적으로 업데이트되었습니다."}


@router.post("/projects/{project_id}/cards/{card_id}/highlight-names")
async def highlight_names_in_text(project_id: str, card_id: str, request: HighlightNamesRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    conn = database.get_db_connection()
    try:
        protagonist_card = conn.execute('SELECT name FROM cards WHERE id = ?', (card_id,)).fetchone()
        if not protagonist_card:
            raise HTTPException(status_code=404, detail="주인공 카드를 찾을 수 없습니다.")
        protagonist_name = protagonist_card['name']

        all_cards_in_project = conn.execute('''
            SELECT c.name FROM cards c
            JOIN groups g ON c.group_id = g.id
            WHERE g.project_id = ? AND c.id != ?
        ''', (project_id, card_id)).fetchall()
        
        other_character_names = list(set([card['name'] for card in all_cards_in_project]))
        
        model = genai.GenerativeModel(AVAILABLE_MODELS[0])
        
        prompt = f"""당신은 텍스트에서 등장인물 이름을 정확히 찾아내는 AI 편집자입니다.

**매우 중요한 규칙:**
1.  주어진 '원본 텍스트'에서 '본인 이름'과 '타인 이름 목록'에 포함된 모든 이름을 찾으세요.
2.  이름 뒤에 한국어 조사(예: 은, 는, 이, 가, 께, 에게, 와, 과)가 붙어 있을 경우, **조사까지 포함하여 하나의 단위로** 태그를 적용해야 합니다.
    -   (좋은 예시) <span class="protagonist">엘라라가</span> 말했다.
    -   (나쁜 예시) <span class="protagonist">엘라라</span>가 말했다.
3.  찾은 이름들을 아래의 HTML 태그 규칙에 따라 정확하게 감싸주세요.
    -   **본인 이름:** `<span class="protagonist">{protagonist_name}</span>`
    -   **타인 이름:** `<strong>{{other_character_name}}</strong>` (프롬프트 예시이므로 이중 중괄호 사용)
4.  주어진 이름 목록에 없는 단어는 절대로 태그로 감싸서는 안 됩니다.
5.  이름이 아닌 다른 텍스트 내용은 절대 수정하지 마세요.
6.  최종 결과는 HTML 태그가 적용된 전체 텍스트여야 합니다. 다른 어떤 설명도 추가하지 마세요.

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

        response = await model.generate_content_async(prompt)
        highlighted_text = response.text.strip()
        
        return {"highlighted_text": highlighted_text}

    except Exception as e:
        print(f"AI 이름 하이라이팅 오류: {e}")
        raise HTTPException(status_code=500, detail=f"AI 이름 하이라이팅 처리 중 오류가 발생했습니다: {e}")
    finally:
        conn.close()

# [수정] AI 관계 추천 API
@router.post("/projects/{project_id}/relationships/suggest")
async def suggest_relationship(project_id: str, request: SuggestRelationshipRequest):
    """두 캐릭터의 정보를 기반으로 AI가 관계를 추천합니다."""
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY가 설정되지 않아 AI 기능을 사용할 수 없습니다.")

    conn = database.get_db_connection()
    try:
        def get_character_details(char_id):
            card = conn.execute('SELECT * FROM cards WHERE id = ?', (char_id,)).fetchone()
            if not card: return None
            card_dict = dict(card)
            for field in ['goal', 'personality', 'abilities', 'quote']:
                try:
                    if card_dict.get(field) and isinstance(card_dict[field], str):
                        card_dict[field] = json.loads(card_dict[field])
                except (json.JSONDecodeError, TypeError):
                    card_dict[field] = [card_dict[field]]
            return card_dict

        char_a = get_character_details(request.source_character_id)
        char_b = get_character_details(request.target_character_id)

        if not char_a or not char_b:
            raise HTTPException(status_code=404, detail="하나 이상의 캐릭터 정보를 찾을 수 없습니다.")

        # [신규] 반대 방향의 기존 관계가 있는지 확인
        existing_relationship = conn.execute(
            'SELECT * FROM relationships WHERE source_character_id = ? AND target_character_id = ?',
            (request.target_character_id, request.source_character_id)
        ).fetchone()

        existing_relationship_context = ""
        if existing_relationship:
            existing_relationship_context = f"""
---
[기존 관계 정보]
참고: 현재 '{char_b.get('name')}'는 '{char_a.get('name')}'를 '{existing_relationship['type']}' 관계로 생각하고 있습니다.
(설명: {existing_relationship['description']})
이 정보를 바탕으로, '{char_a.get('name')}'가 '{char_b.get('name')}'를 어떻게 생각할지 일관성 있게 작성해주세요.
---
"""

        additional_instructions = []
        if request.tendency == -2:
            additional_instructions.append("두 캐릭터의 관계는 '매우 비우호적' (예: 철천지 원수, 서로를 파멸시키려는 경쟁자)이어야 합니다.")
        elif request.tendency == -1:
            additional_instructions.append("두 캐릭터의 관계는 '비우호적' (예: 라이벌, 불신하는 사이)인 방향으로 설정해주세요.")
        elif request.tendency == 1:
            additional_instructions.append("두 캐릭터의 관계는 '우호적' (예: 동료, 친구, 조력자)인 방향으로 설정해주세요.")
        elif request.tendency == 2:
            additional_instructions.append("두 캐릭터의 관계는 '매우 우호적' (예: 연인, 가족, 목숨을 바칠 수 있는 친구)이어야 합니다.")

        if request.keyword:
            additional_instructions.append(f"특히, 관계 설정 시 '{request.keyword}' 라는 키워드를 핵심적으로 반영해주세요.")
        
        final_instruction = "\n".join(additional_instructions)


        model = genai.GenerativeModel(AVAILABLE_MODELS[0])
        prompt = f"""당신은 두 인물 사이의 관계를 창의적으로 설정하는 스토리 작가입니다.
아래 제공된 두 캐릭터의 프로필과 기존 관계 정보를 자세히 분석하여, 둘 사이에 존재할 법한 가장 흥미롭고 개연성 있는 관계를 추천해주세요.

**매우 중요한 규칙:**
1.  결과는 반드시 아래 명시된 JSON 스키마를 따르는 JSON 객체로만 응답해야 합니다.
2.  'type'에는 관계를 한두 단어로 요약한 키워드를, 'description'에는 그 관계에 대한 2~3문장의 구체적인 설명을 작성해주세요.
3.  두 캐릭터의 성격, 목표, 배경 등을 모두 고려하여 깊이 있는 관계를 설정해야 합니다.
4.  **생성되는 관계 설명은 반드시 '캐릭터 A'와 '캐릭터 B' 두 사람 사이의 직접적인 이야기에만 집중해야 합니다. 각 캐릭터의 프로필에 언급된 제3의 인물(예: 시노부, 엘레오노라 등)은 절대 관계 설명에 포함시키지 마세요.**
5.  {final_instruction}
{existing_relationship_context}
---
[캐릭터 A 프로필 ({char_a.get('name')})]
- 설명: {char_a.get('description')}
- 목표: {', '.join(char_a.get('goal') or [])}
- 성격: {', '.join(char_a.get('personality') or [])}
- 등장 서사: {char_a.get('introduction_story')}

[캐릭터 B 프로필 ({char_b.get('name')})]
- 설명: {char_b.get('description')}
- 목표: {', '.join(char_b.get('goal') or [])}
- 성격: {', '.join(char_b.get('personality') or [])}
- 등장 서사: {char_b.get('introduction_story')}
---

**출력 JSON 스키마:**
{{
  "type": "관계 유형 (예: 숙명의 라이벌, 비밀 조력자, 옛 스승과 제자)",
  "description": "관계에 대한 구체적인 설명 (2~3 문장)."
}}
"""
        generation_config = GenerationConfig(response_mime_type="application/json")
        response = await model.generate_content_async(prompt, generation_config=generation_config)
        suggestion = json.loads(response.text)
        return suggestion

    except Exception as e:
        print(f"AI 관계 추천 오류: {e}")
        error_detail = f"AI 관계 추천 중 오류가 발생했습니다: {e}"
        if 'response' in locals() and hasattr(response, 'text'):
            error_detail += f" | AI 응답: {response.text[:200]}"
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        conn.close()