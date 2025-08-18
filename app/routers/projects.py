from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import time
import json
from pydantic import BaseModel
from typing import List, Optional

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Group as GroupModel, Card as CardModel, Worldview as WorldviewModel, WorldviewGroup as WorldviewGroupModel, WorldviewCard as WorldviewCardModel, Relationship as RelationshipModel

# --- Pydantic 데이터 모델 (기존과 동일) ---
class Relationship(BaseModel):
    id: str
    project_id: str
    source_character_id: str
    target_character_id: str
    type: str
    description: Optional[str] = None
    class Config:
        orm_mode = True

class WorldviewCard(BaseModel):
    id: str
    group_id: str
    title: str
    content: str
    ordering: int
    class Config:
        orm_mode = True

class WorldviewGroup(BaseModel):
    id: str
    project_id: str
    name: str
    worldview_cards: List[WorldviewCard] = []
    class Config:
        orm_mode = True

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
    class Config:
        orm_mode = True

class Group(BaseModel):
    id: str
    project_id: str
    name: str
    cards: List[Card]
    class Config:
        orm_mode = True

class Worldview(BaseModel):
    content: Optional[str] = ''
    class Config:
        orm_mode = True

class Project(BaseModel):
    id: str
    name: str
    groups: List[Group]
    worldview: Optional[Worldview] = None
    worldview_groups: List[WorldviewGroup] = []
    relationships: List[Relationship] = []
    class Config:
        orm_mode = True

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

# --- 유틸리티 함수 ---
def parse_card_fields(card_obj):
    """DB에서 가져온 Card 객체의 JSON 문자열 필드를 리스트로 변환"""
    for field in ['quote', 'personality', 'abilities', 'goal']:
        field_value = getattr(card_obj, field)
        if field_value and isinstance(field_value, str):
            try:
                setattr(card_obj, field, json.loads(field_value))
            except json.JSONDecodeError:
                setattr(card_obj, field, [s.strip() for s in field_value.split(',')])
    return card_obj

# --- API 엔드포인트 ---

@router.get("", response_model=dict)
def get_projects(db: Session = Depends(database.get_db)):
    projects_from_db = db.query(ProjectModel).order_by(ProjectModel.name).all()
    for p in projects_from_db:
        if p.worldview is None:
             p.worldview = WorldviewModel(content='')
        for group in p.groups:
            group.cards.sort(key=lambda x: (x.ordering is None, x.ordering))
            for card in group.cards:
                parse_card_fields(card)
        for wv_group in p.worldview_groups:
            wv_group.worldview_cards.sort(key=lambda x: (x.ordering is None, x.ordering))

    return {"projects": projects_from_db}

@router.get("/{project_id}", response_model=Project)
def get_project_details(project_id: str, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.worldview is None:
        project.worldview = WorldviewModel(content='')
    for group in project.groups:
        group.cards.sort(key=lambda x: (x.ordering is None, x.ordering))
        for card in group.cards:
            parse_card_fields(card)
    for wv_group in project.worldview_groups:
        wv_group.worldview_cards.sort(key=lambda x: (x.ordering is None, x.ordering))
    return project

@router.post("", response_model=Project)
def create_project(project_request: CreateProjectRequest, db: Session = Depends(database.get_db)):
    timestamp = int(time.time() * 1000)
    new_project_id = f"project-{timestamp}"
    
    new_project = ProjectModel(id=new_project_id, name=project_request.name)
    
    uncategorized_group = GroupModel(
        id=f"group-uncategorized-{timestamp}",
        project_id=new_project_id,
        name='미분류'
    )
    
    db.add(new_project)
    db.add(uncategorized_group)
    db.commit()
    db.refresh(new_project)
    
    # 관계형 데이터 로드를 위해 다시 조회
    created_project = db.query(ProjectModel).filter(ProjectModel.id == new_project_id).first()
    if created_project.worldview is None:
        created_project.worldview = WorldviewModel(content='')
        
    return created_project

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="삭제할 프로젝트를 찾을 수 없습니다.")
    db.delete(project)
    db.commit()
    return {"message": "프로젝트가 성공적으로 삭제되었습니다."}

@router.put("/{project_id}")
def update_project(project_id: str, project_request: UpdateProjectRequest, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="수정할 프로젝트를 찾을 수 없습니다.")
    project.name = project_request.name
    db.commit()
    db.refresh(project)
    return {"message": "프로젝트 이름이 성공적으로 수정되었습니다.", "project": project}

# --- 캐릭터 그룹 & 카드 ---
@router.post("/{project_id}/groups", response_model=Group)
def create_group(project_id: str, group_request: CreateGroupRequest, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
        
    new_group_id = f"group-{int(time.time() * 1000)}"
    new_group = GroupModel(id=new_group_id, project_id=project_id, name=group_request.name)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.delete("/{project_id}/groups/{group_id}")
def delete_group(project_id: str, group_id: str, db: Session = Depends(database.get_db)):
    group = db.query(GroupModel).filter(GroupModel.id == group_id, GroupModel.project_id == project_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="삭제할 그룹을 찾을 수 없습니다.")
    if group.name == '미분류':
        raise HTTPException(status_code=400, detail="'미분류' 그룹은 삭제할 수 없습니다.")
    db.delete(group)
    db.commit()
    return {"message": "그룹이 성공적으로 삭제되었습니다."}

# --- 메인 세계관 ---
@router.put("/{project_id}/worldview", response_model=Worldview)
def update_worldview(project_id: str, request: WorldviewUpdateRequest, db: Session = Depends(database.get_db)):
    worldview = db.query(WorldviewModel).filter(WorldviewModel.project_id == project_id).first()
    if worldview:
        worldview.content = request.content
    else:
        worldview = WorldviewModel(project_id=project_id, content=request.content)
        db.add(worldview)
    db.commit()
    db.refresh(worldview)
    return worldview

# --- 세계관 서브-그룹 및 카드 API ---
@router.post("/{project_id}/worldview_groups", response_model=WorldviewGroup)
def create_worldview_group(project_id: str, group_request: CreateGroupRequest, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    new_group_id = f"wv-group-{int(time.time() * 1000)}"
    new_group = WorldviewGroupModel(id=new_group_id, project_id=project_id, name=group_request.name)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.delete("/{project_id}/worldview_groups/{group_id}")
def delete_worldview_group(project_id: str, group_id: str, db: Session = Depends(database.get_db)):
    group = db.query(WorldviewGroupModel).filter(WorldviewGroupModel.id == group_id, WorldviewGroupModel.project_id == project_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="삭제할 그룹을 찾을 수 없습니다.")
    db.delete(group)
    db.commit()
    return {"message": "세계관 그룹이 삭제되었습니다."}

@router.post("/{project_id}/worldview_groups/{group_id}/cards", response_model=WorldviewCard)
def create_worldview_card(project_id: str, group_id: str, card_request: WorldviewCardCreateUpdateRequest, db: Session = Depends(database.get_db)):
    group = db.query(WorldviewGroupModel).filter(WorldviewGroupModel.id == group_id, WorldviewGroupModel.project_id == project_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="상위 그룹을 찾을 수 없습니다.")
    new_card_id = f"wv-card-{int(time.time() * 1000)}"
    card_count = len(group.worldview_cards)
    new_card = WorldviewCardModel(id=new_card_id, group_id=group_id, title=card_request.title, content=card_request.content, ordering=card_count)
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card

# ... 이하 나머지 API들도 SQLAlchemy 방식으로 수정해야 합니다. ...
# (전체 코드를 제공하기 위해 나머지 함수들도 마저 수정합니다)

@router.put("/{project_id}/cards/{card_id}", response_model=Card)
def update_card(project_id: str, card_id: str, card_data: UpdateCardRequest, db: Session = Depends(database.get_db)):
    card = db.query(CardModel).join(GroupModel).filter(CardModel.id == card_id, GroupModel.project_id == project_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="해당 프로젝트에서 카드를 찾을 수 없거나 권한이 없습니다.")

    update_data = card_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key in ['quote', 'personality', 'abilities', 'goal'] and value is not None:
            setattr(card, key, json.dumps(value, ensure_ascii=False))
        elif key != 'id':
            setattr(card, key, value)
    
    db.commit()
    db.refresh(card)
    return parse_card_fields(card)


# 이하 나머지 함수들도 같은 패턴으로 수정합니다...
@router.put("/{project_id}/worldview_cards/{card_id}", response_model=WorldviewCard)
def update_worldview_card(project_id: str, card_id: str, card_request: WorldviewCardCreateUpdateRequest, db: Session = Depends(database.get_db)):
    card = db.query(WorldviewCardModel).join(WorldviewGroupModel).filter(WorldviewCardModel.id == card_id, WorldviewGroupModel.project_id == project_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")
    card.title = card_request.title
    card.content = card_request.content
    db.commit()
    db.refresh(card)
    return card

@router.put("/{project_id}/worldview_cards/{card_id}/details", response_model=WorldviewCard)
def update_worldview_card_details(project_id: str, card_id: str, card_data: UpdateWorldviewCardRequest, db: Session = Depends(database.get_db)):
    card = db.query(WorldviewCardModel).join(WorldviewGroupModel).filter(WorldviewCardModel.id == card_id, WorldviewGroupModel.project_id == project_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="해당 프로젝트에서 카드를 찾을 수 없거나 권한이 없습니다.")
    
    update_data = card_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if key != 'id':
            setattr(card, key, value)
            
    db.commit()
    db.refresh(card)
    return card

@router.delete("/{project_id}/worldview_cards/{card_id}")
def delete_worldview_card(project_id: str, card_id: str, db: Session = Depends(database.get_db)):
    card = db.query(WorldviewCardModel).join(WorldviewGroupModel).filter(WorldviewCardModel.id == card_id, WorldviewGroupModel.project_id == project_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="삭제할 카드를 찾을 수 없습니다.")
    db.delete(card)
    db.commit()
    return {"message": "세계관 카드가 삭제되었습니다."}

@router.put("/{project_id}/worldview_groups/{group_id}/cards/order")
def update_worldview_card_order(project_id: str, group_id: str, request: UpdateCardOrderRequest, db: Session = Depends(database.get_db)):
    group = db.query(WorldviewGroupModel).filter(WorldviewGroupModel.id == group_id, WorldviewGroupModel.project_id == project_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    for index, card_id in enumerate(request.card_ids):
        db.query(WorldviewCardModel).filter(WorldviewCardModel.id == card_id).update({"ordering": index})
    db.commit()
    return {"message": "카드 순서가 성공적으로 업데이트되었습니다."}

# --- 관계도 ---
@router.post("/{project_id}/relationships", response_model=Relationship)
def create_relationship(project_id: str, request: CreateRelationshipRequest, db: Session = Depends(database.get_db)):
    new_rel_id = f"rel-{int(time.time() * 1000)}"
    new_rel = RelationshipModel(
        id=new_rel_id,
        project_id=project_id,
        source_character_id=request.source_character_id,
        target_character_id=request.target_character_id,
        type=request.type,
        description=request.description
    )
    db.add(new_rel)
    db.commit()
    db.refresh(new_rel)
    return new_rel

@router.put("/{project_id}/relationships/{relationship_id}", response_model=Relationship)
def update_relationship(project_id: str, relationship_id: str, request: UpdateRelationshipRequest, db: Session = Depends(database.get_db)):
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="수정할 관계를 찾을 수 없습니다.")
    rel.type = request.type
    rel.description = request.description
    db.commit()
    db.refresh(rel)
    return rel

@router.delete("/{project_id}/relationships/{relationship_id}")
def delete_relationship(project_id: str, relationship_id: str, db: Session = Depends(database.get_db)):
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="삭제할 관계를 찾을 수 없습니다.")
    db.delete(rel)
    db.commit()
    return {"message": "관계가 성공적으로 삭제되었습니다."}