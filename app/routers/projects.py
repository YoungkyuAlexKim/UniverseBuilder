from fastapi import APIRouter, HTTPException
import time
import json # JSON 처리를 위해 추가
from pydantic import BaseModel
from typing import List, Optional
from .. import database

# --- Pydantic 데이터 모델 ---

class Relationship(BaseModel):
    id: str
    project_id: str
    source_character_id: str
    target_character_id: str
    type: str
    description: Optional[str] = None

class WorldviewCard(BaseModel):
    id: str
    group_id: str
    title: str
    content: str
    ordering: int

class WorldviewGroup(BaseModel):
    id: str
    project_id: str
    name: str
    worldview_cards: List[WorldviewCard] = []

class Card(BaseModel):
    id: str
    group_id: str
    name: str
    description: Optional[str] = None
    goal: Optional[List[str]] = None 
    personality: Optional[List[str]] = None
    abilities: Optional[List[str]] = None
    quote: Optional[List[str]] = None
    introduction_story: Optional[str] = None
    ordering: Optional[int] = None

class Group(BaseModel):
    id: str
    project_id: str
    name: str
    cards: List[Card]

class Worldview(BaseModel):
    content: Optional[str] = ''

class Project(BaseModel):
    id: str
    name: str
    groups: List[Group]
    worldview: Worldview
    worldview_groups: List[WorldviewGroup] = []
    relationships: List[Relationship] = [] 

class CreateProjectRequest(BaseModel):
    name: str

class UpdateProjectRequest(BaseModel):
    name: str

class CreateGroupRequest(BaseModel):
    name: str

class WorldviewUpdateRequest(BaseModel):
    content: str

class WorldviewCardCreateUpdateRequest(BaseModel):
    title: str
    content: str

class UpdateCardOrderRequest(BaseModel):
    card_ids: List[str]

class MoveCardRequest(BaseModel):
    source_group_id: str
    target_group_id: str

class UpdateCardRequest(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[List[str]] = None
    personality: Optional[List[str]] = None
    abilities: Optional[List[str]] = None
    quote: Optional[List[str]] = None
    introduction_story: Optional[str] = None

class UpdateWorldviewCardRequest(BaseModel):
    id: str
    title: Optional[str] = None
    content: Optional[str] = None

class CreateRelationshipRequest(BaseModel):
    source_character_id: str
    target_character_id: str
    type: str
    description: Optional[str] = None

class UpdateRelationshipRequest(BaseModel):
    type: str
    description: Optional[str] = None

# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Projects & Groups"]
)

def _get_full_project_data(project_id: str, conn):
    """프로젝트 전체 데이터를 조회하는 헬퍼 함수"""
    project = conn.execute('SELECT * FROM projects WHERE id = ?', (project_id,)).fetchone()
    if not project:
        return None

    project_dict = dict(project)
    
    worldview = conn.execute('SELECT content FROM worldviews WHERE project_id = ?', (project_id,)).fetchone()
    project_dict['worldview'] = dict(worldview) if worldview else {'content': ''}

    groups_from_db = conn.execute("SELECT * FROM groups WHERE project_id = ? ORDER BY CASE WHEN name = '미분류' THEN 1 ELSE 0 END, name", (project_id,)).fetchall()
    groups_list = []
    for group in groups_from_db:
        group_dict = dict(group)
        cards_from_db = conn.execute('SELECT * FROM cards WHERE group_id = ? ORDER BY ordering', (group['id'],)).fetchall()
        
        cards_list = []
        for card_row in cards_from_db:
            card_dict = dict(card_row)
            
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
            
            cards_list.append(card_dict)
            
        group_dict['cards'] = cards_list
        groups_list.append(group_dict)
    project_dict['groups'] = groups_list

    wv_groups_from_db = conn.execute('SELECT * FROM worldview_groups WHERE project_id = ? ORDER BY name', (project_id,)).fetchall()
    wv_groups_list = []
    for group in wv_groups_from_db:
        group_dict = dict(group)
        cards_from_db = conn.execute('SELECT * FROM worldview_cards WHERE group_id = ? ORDER BY ordering', (group['id'],)).fetchall()
        group_dict['worldview_cards'] = [dict(card) for card in cards_from_db]
        wv_groups_list.append(group_dict)
    project_dict['worldview_groups'] = wv_groups_list
        
    relationships_from_db = conn.execute('SELECT * FROM relationships WHERE project_id = ?', (project_id,)).fetchall()
    project_dict['relationships'] = [dict(row) for row in relationships_from_db]

    return project_dict

@router.get("", response_model=dict)
def get_projects():
    conn = database.get_db_connection()
    projects_from_db = conn.execute('SELECT * FROM projects ORDER BY name').fetchall()
    projects_list = [_get_full_project_data(p['id'], conn) for p in projects_from_db]
    conn.close()
    return {"projects": projects_list}

@router.get("/{project_id}", response_model=Project)
def get_project_details(project_id: str):
    conn = database.get_db_connection()
    project_data = _get_full_project_data(project_id, conn)
    conn.close()
    if not project_data:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    return project_data

@router.post("", response_model=Project)
def create_project(project_request: CreateProjectRequest):
    conn = database.get_db_connection()
    timestamp = int(time.time() * 1000)
    new_project_id = f"project-{timestamp}"
    uncategorized_group_id = f"group-uncategorized-{timestamp}"
    try:
        conn.execute('INSERT INTO projects (id, name) VALUES (?, ?)', (new_project_id, project_request.name))
        conn.execute('INSERT INTO groups (id, project_id, name) VALUES (?, ?, ?)', (uncategorized_group_id, new_project_id, '미분류'))
        conn.commit()
    except Exception as e:
        conn.rollback(); conn.close()
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    
    conn.close()
    project_details = get_project_details(new_project_id)
    return project_details


@router.delete("/{project_id}")
def delete_project(project_id: str):
    conn = database.get_db_connection()
    cursor = conn.execute('DELETE FROM projects WHERE id = ?', (project_id,))
    conn.commit()
    conn.close()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="삭제할 프로젝트를 찾을 수 없습니다.")
    return {"message": "프로젝트가 성공적으로 삭제되었습니다."}

@router.put("/{project_id}")
def update_project(project_id: str, project_request: UpdateProjectRequest):
    conn = database.get_db_connection()
    cursor = conn.execute('UPDATE projects SET name = ? WHERE id = ?', (project_request.name, project_id))
    conn.commit()
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="수정할 프로젝트를 찾을 수 없습니다.")
    updated_project = conn.execute('SELECT * FROM projects WHERE id = ?', (project_id,)).fetchone()
    conn.close()
    return {"message": "프로젝트 이름이 성공적으로 수정되었습니다.", "project": dict(updated_project)}

# --- 캐릭터 그룹 & 카드 ---
@router.post("/{project_id}/groups")
def create_group(project_id: str, group_request: CreateGroupRequest):
    conn = database.get_db_connection()
    if not conn.execute('SELECT id FROM projects WHERE id = ?', (project_id,)).fetchone():
        conn.close(); raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    new_group_id = f"group-{int(time.time() * 1000)}"
    try:
        conn.execute('INSERT INTO groups (id, project_id, name) VALUES (?, ?, ?)', (new_group_id, project_id, group_request.name))
        conn.commit()
        new_group = conn.execute('SELECT * FROM groups WHERE id = ?', (new_group_id,)).fetchone()
    except Exception as e:
        conn.rollback(); conn.close(); raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    conn.close()
    return {"message": "그룹이 성공적으로 생성되었습니다.", "group": {**dict(new_group), "cards": []}}

@router.delete("/{project_id}/groups/{group_id}")
def delete_group(project_id: str, group_id: str):
    conn = database.get_db_connection()
    group_to_delete = conn.execute('SELECT name FROM groups WHERE id = ?', (group_id,)).fetchone()
    if group_to_delete and group_to_delete['name'] == '미분류':
        conn.close(); raise HTTPException(status_code=400, detail="'미분류' 그룹은 삭제할 수 없습니다.")
    cursor = conn.execute('DELETE FROM groups WHERE id = ? AND project_id = ?', (group_id, project_id))
    conn.commit()
    conn.close()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="삭제할 그룹을 찾을 수 없습니다.")
    return {"message": "그룹이 성공적으로 삭제되었습니다."}


# --- 메인 세계관 ---
@router.put("/{project_id}/worldview")
def update_worldview(project_id: str, request: WorldviewUpdateRequest):
    conn = database.get_db_connection()
    if not conn.execute('SELECT id FROM projects WHERE id = ?', (project_id,)).fetchone():
        conn.close(); raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    try:
        conn.execute('INSERT INTO worldviews (project_id, content) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET content = excluded.content', (project_id, request.content))
        conn.commit()
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    finally:
        conn.close()
    return {"message": "세계관 설정이 성공적으로 저장되었습니다."}


# --- 세계관 서브-그룹 및 카드 API ---
@router.post("/{project_id}/worldview_groups")
def create_worldview_group(project_id: str, group_request: CreateGroupRequest):
    conn = database.get_db_connection()
    if not conn.execute('SELECT id FROM projects WHERE id = ?', (project_id,)).fetchone():
        conn.close(); raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    new_group_id = f"wv-group-{int(time.time() * 1000)}"
    try:
        conn.execute('INSERT INTO worldview_groups (id, project_id, name) VALUES (?, ?, ?)', (new_group_id, project_id, group_request.name))
        conn.commit()
        new_group = conn.execute('SELECT * FROM worldview_groups WHERE id = ?', (new_group_id,)).fetchone()
    except Exception as e:
        conn.rollback(); conn.close(); raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    conn.close()
    return {"message": "세계관 그룹이 생성되었습니다.", "group": {**dict(new_group), "worldview_cards": []}}

@router.delete("/{project_id}/worldview_groups/{group_id}")
def delete_worldview_group(project_id: str, group_id: str):
    conn = database.get_db_connection()
    cursor = conn.execute('DELETE FROM worldview_groups WHERE id = ? AND project_id = ?', (group_id, project_id))
    conn.commit()
    conn.close()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="삭제할 그룹을 찾을 수 없습니다.")
    return {"message": "세계관 그룹이 삭제되었습니다."}

@router.post("/{project_id}/worldview_groups/{group_id}/cards")
def create_worldview_card(project_id: str, group_id: str, card_request: WorldviewCardCreateUpdateRequest):
    conn = database.get_db_connection()
    if not conn.execute('SELECT id FROM worldview_groups WHERE id = ? AND project_id = ?', (group_id, project_id)).fetchone():
        conn.close(); raise HTTPException(status_code=404, detail="상위 그룹을 찾을 수 없습니다.")
    new_card_id = f"wv-card-{int(time.time() * 1000)}"
    try:
        card_count = conn.execute('SELECT COUNT(id) as card_count FROM worldview_cards WHERE group_id = ?', (group_id,)).fetchone()['card_count']
        conn.execute('INSERT INTO worldview_cards (id, group_id, title, content, ordering) VALUES (?, ?, ?, ?, ?)',(new_card_id, group_id, card_request.title, card_request.content, card_count))
        conn.commit()
        new_card = conn.execute('SELECT * FROM worldview_cards WHERE id = ?', (new_card_id,)).fetchone()
    except Exception as e:
        conn.rollback(); conn.close(); raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    conn.close()
    return {"message": "세계관 카드가 생성되었습니다.", "card": dict(new_card)}

@router.put("/{project_id}/worldview_cards/{card_id}")
def update_worldview_card(project_id: str, card_id: str, card_request: WorldviewCardCreateUpdateRequest):
    conn = database.get_db_connection()
    try:
        cursor = conn.execute('UPDATE worldview_cards SET title = ?, content = ? WHERE id = ?', (card_request.title, card_request.content, card_id))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    finally:
        conn.close()
    return {"message": "세계관 카드가 수정되었습니다."}

@router.put("/{project_id}/worldview_cards/{card_id}/move")
def move_worldview_card(project_id: str, card_id: str, request: MoveCardRequest):
    conn = database.get_db_connection()
    try:
        card_check = conn.execute('''
            SELECT wc.id FROM worldview_cards wc
            JOIN worldview_groups wg ON wc.group_id = wg.id
            WHERE wc.id = ? AND wg.project_id = ?
        ''', (card_id, project_id)).fetchone()

        if not card_check:
            raise HTTPException(status_code=404, detail="이동할 카드를 찾을 수 없거나 권한이 없습니다.")

        conn.execute('UPDATE worldview_cards SET group_id = ? WHERE id = ?', (request.target_group_id, card_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    finally:
        conn.close()
    return {"message": "세계관 카드가 성공적으로 이동되었습니다."}


@router.delete("/{project_id}/worldview_cards/{card_id}")
def delete_worldview_card(project_id: str, card_id: str):
    conn = database.get_db_connection()
    try:
        cursor = conn.execute('DELETE FROM worldview_cards WHERE id = ?', (card_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="삭제할 카드를 찾을 수 없습니다.")
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    finally:
        conn.close()
    return {"message": "세계관 카드가 삭제되었습니다."}


@router.put("/{project_id}/worldview_groups/{group_id}/cards/order")
def update_worldview_card_order(project_id: str, group_id: str, request: UpdateCardOrderRequest):
    conn = database.get_db_connection()
    try:
        for index, card_id in enumerate(request.card_ids):
            conn.execute('UPDATE worldview_cards SET ordering = ? WHERE id = ? AND group_id = ?', (index, card_id, group_id))
        conn.commit()
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=500, detail=f"DB 오류: {e}")
    finally:
        conn.close()
    return {"message": "카드 순서가 성공적으로 업데이트되었습니다."}

@router.put("/{project_id}/cards/{card_id}")
def update_card(project_id: str, card_id: str, card_data: UpdateCardRequest):
    conn = database.get_db_connection()
    
    update_dict = card_data.dict(exclude_unset=True)
    
    if 'id' in update_dict:
        del update_dict['id']
        
    for field in ['quote', 'personality', 'abilities', 'goal']:
        if field in update_dict and update_dict[field] is not None:
            update_dict[field] = json.dumps(update_dict[field], ensure_ascii=False)

    if not update_dict:
        raise HTTPException(status_code=400, detail="수정할 데이터가 없습니다.")

    set_clauses = [f"{key} = ?" for key in update_dict.keys()]
    values = list(update_dict.values())
    values.append(card_id)

    try:
        check_cursor = conn.execute('''
            SELECT 1 FROM cards c
            JOIN groups g ON c.group_id = g.id
            WHERE c.id = ? AND g.project_id = ?
        ''', (card_id, project_id))

        if check_cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="해당 프로젝트에서 카드를 찾을 수 없거나 권한이 없습니다.")

        cursor = conn.execute(f"UPDATE cards SET {', '.join(set_clauses)} WHERE id = ?", tuple(values))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")
        conn.commit()
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    finally:
        conn.close()

    return {"message": "카드가 성공적으로 업데이트되었습니다."}

@router.put("/{project_id}/worldview_cards/{card_id}/details")
def update_worldview_card_details(project_id: str, card_id: str, card_data: UpdateWorldviewCardRequest):
    conn = database.get_db_connection()
    
    update_dict = card_data.dict(exclude_unset=True)
    if 'id' in update_dict:
        del update_dict['id']

    if not update_dict:
        raise HTTPException(status_code=400, detail="수정할 데이터가 없습니다.")

    set_clauses = [f"{key} = ?" for key in update_dict.keys()]
    values = list(update_dict.values())
    values.append(card_id)

    try:
        check_cursor = conn.execute('''
            SELECT 1 FROM worldview_cards wc
            JOIN worldview_groups wg ON wc.group_id = wg.id
            WHERE wc.id = ? AND wg.project_id = ?
        ''', (card_id, project_id))
        
        if check_cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="해당 프로젝트에서 카드를 찾을 수 없거나 권한이 없습니다.")

        cursor = conn.execute(f"UPDATE worldview_cards SET {', '.join(set_clauses)} WHERE id = ?", tuple(values))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")
        conn.commit()
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    finally:
        conn.close()

    return {"message": "세계관 카드가 성공적으로 업데이트되었습니다."}


# --- [신규] 캐릭터 관계도 ---
@router.post("/{project_id}/relationships", response_model=Relationship)
def create_relationship(project_id: str, request: CreateRelationshipRequest):
    """새로운 캐릭터 관계를 생성합니다."""
    conn = database.get_db_connection()
    if not conn.execute('SELECT id FROM projects WHERE id = ?', (project_id,)).fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    
    new_relationship_id = f"rel-{int(time.time() * 1000)}"
    try:
        conn.execute('''
            INSERT INTO relationships (id, project_id, source_character_id, target_character_id, type, description)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (new_relationship_id, project_id, request.source_character_id, request.target_character_id, request.type, request.description))
        conn.commit()
        new_relationship = conn.execute('SELECT * FROM relationships WHERE id = ?', (new_relationship_id,)).fetchone()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    
    conn.close()
    return dict(new_relationship)

@router.put("/{project_id}/relationships/{relationship_id}", response_model=Relationship)
def update_relationship(project_id: str, relationship_id: str, request: UpdateRelationshipRequest):
    """기존 캐릭터 관계를 수정합니다."""
    conn = database.get_db_connection()
    try:
        cursor = conn.execute(
            'UPDATE relationships SET type = ?, description = ? WHERE id = ? AND project_id = ?',
            (request.type, request.description, relationship_id, project_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="수정할 관계를 찾을 수 없거나 권한이 없습니다.")
        
        updated_relationship = conn.execute('SELECT * FROM relationships WHERE id = ?', (relationship_id,)).fetchone()
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    finally:
        conn.close()
        
    return dict(updated_relationship)

@router.delete("/{project_id}/relationships/{relationship_id}")
def delete_relationship(project_id: str, relationship_id: str):
    """캐릭터 관계를 삭제합니다."""
    conn = database.get_db_connection()
    try:
        cursor = conn.execute('DELETE FROM relationships WHERE id = ? AND project_id = ?', (relationship_id, project_id))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="삭제할 관계를 찾을 수 없거나 권한이 없습니다.")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {e}")
    finally:
        conn.close()
        
    return {"message": "관계가 성공적으로 삭제되었습니다."}