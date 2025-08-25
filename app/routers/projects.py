from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
import time
import json
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from passlib.context import CryptContext

# --- SQLAlchemy 모델과 DB 세션 함수 임포트 ---
from .. import database
from ..database import Project as ProjectModel, Group as GroupModel, Card as CardModel, Worldview as WorldviewModel, WorldviewGroup as WorldviewGroupModel, WorldviewCard as WorldviewCardModel, Relationship as RelationshipModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel

# --- 비밀번호 해싱 설정 ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- Pydantic 데이터 모델 ---

class PlotPoint(BaseModel):
    id: str
    scenario_id: str
    title: str
    content: Optional[str] = None
    ordering: int
    class Config:
        from_attributes = True

class Scenario(BaseModel):
    id: str
    project_id: str
    title: str
    summary: Optional[str] = None
    themes: Optional[List[str]] = None
    synopsis: Optional[str] = None
    plot_points: List[PlotPoint] = []
    class Config:
        from_attributes = True

class Relationship(BaseModel):
    id: str
    project_id: str
    source_character_id: str
    target_character_id: str
    type: str
    description: Optional[str] = None
    class Config:
        from_attributes = True

class WorldviewCard(BaseModel):
    id: str
    group_id: str
    title: str
    content: str
    ordering: int
    class Config:
        from_attributes = True

class WorldviewGroup(BaseModel):
    id: str
    project_id: str
    name: str
    worldview_cards: List[WorldviewCard] = []
    class Config:
        from_attributes = True

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
        from_attributes = True

class Group(BaseModel):
    id: str
    project_id: str
    name: str
    cards: List[Card]
    class Config:
        from_attributes = True

class Worldview(BaseModel):
    logline: Optional[str] = ""
    genre: Optional[str] = ""
    rules: Optional[List[str]] = Field(default_factory=list)

    class Config:
        from_attributes = True
        
class Project(BaseModel):
    id: str
    name: str
    groups: List[Group]
    worldview: Optional[Worldview] = None
    worldview_groups: List[WorldviewGroup] = []
    relationships: List[Relationship] = []
    scenarios: List[Scenario] = []
    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    projects: List[Project]

class CreateProjectRequest(BaseModel):
    name: str
    password: Optional[str] = None

class UpdateProjectRequest(BaseModel):
    name: str

class CreateGroupRequest(BaseModel):
    name: str
    
class WorldviewUpdateRequest(Worldview):
    pass

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

class ProjectPasswordRequest(BaseModel):
    password: str

# --- 라우터 생성 ---
router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Projects & Groups"]
)

# --- 유틸리티 및 의존성 함수 ---

# [수정] SQLAlchemy ORM 객체를 Pydantic 응답 모델로 변환하는 중앙 집중식 함수 (오류 수정)
def convert_project_orm_to_pydantic(project_orm: ProjectModel) -> Project:
    project_dict = {
        "id": project_orm.id,
        "name": project_orm.name,
        "groups": [],
        "worldview_groups": [],
        "relationships": [rel.__dict__ for rel in project_orm.relationships],
        "scenarios": []
    }

    for group_orm in project_orm.groups:
        # [오류 수정] 누락되었던 project_id 필드 추가
        group_dict = {
            "id": group_orm.id, 
            "project_id": group_orm.project_id, 
            "name": group_orm.name, 
            "cards": []
        }
        sorted_cards = sorted(group_orm.cards, key=lambda c: (c.ordering is None, c.ordering))
        for card_orm in sorted_cards:
            card_dict = card_orm.__dict__
            for field in ['quote', 'personality', 'abilities', 'goal']:
                field_value = getattr(card_orm, field, None)
                if field_value and isinstance(field_value, str):
                    try:
                        card_dict[field] = json.loads(field_value)
                    except json.JSONDecodeError:
                        card_dict[field] = [s.strip() for s in field_value.split(',')]
                elif not isinstance(field_value, list):
                    card_dict[field] = []
            group_dict["cards"].append(card_dict)
        project_dict["groups"].append(group_dict)

    for wv_group_orm in project_orm.worldview_groups:
        wv_group_dict = wv_group_orm.__dict__
        wv_group_dict["worldview_cards"] = sorted([c.__dict__ for c in wv_group_orm.worldview_cards], key=lambda c: (c["ordering"] is None, c["ordering"]))
        project_dict["worldview_groups"].append(wv_group_dict)

    for scenario_orm in project_orm.scenarios:
        # [수정] synopsis 필드를 안전하게 처리
        scenario_dict = {
            "id": scenario_orm.id,
            "project_id": scenario_orm.project_id,
            "title": scenario_orm.title,
            "summary": scenario_orm.summary,
            "synopsis": getattr(scenario_orm, 'synopsis', ''),  # synopsis 필드 안전 처리
        }
        
        themes_value = getattr(scenario_orm, 'themes', None)
        if themes_value and isinstance(themes_value, str):
            try:
                scenario_dict['themes'] = json.loads(themes_value)
            except json.JSONDecodeError:
                scenario_dict['themes'] = [s.strip() for s in themes_value.split(',')]
        elif not isinstance(themes_value, list):
            scenario_dict['themes'] = []
        scenario_dict["plot_points"] = sorted([p.__dict__ for p in scenario_orm.plot_points], key=lambda p: (p["ordering"] is None, p["ordering"]))
        project_dict["scenarios"].append(scenario_dict)

    default_worldview = {"logline": "", "genre": "", "rules": []}
    parsed_worldview_data = default_worldview
    if project_orm.worldview and project_orm.worldview.content:
        try:
            parsed_worldview_data = json.loads(project_orm.worldview.content)
        except (json.JSONDecodeError, TypeError):
            if isinstance(project_orm.worldview.content, str):
                 parsed_worldview_data["logline"] = project_orm.worldview.content
    project_dict["worldview"] = parsed_worldview_data

    return Project.model_validate(project_dict)

# 프로젝트 접근 권한을 확인하는 의존성 함수
def get_project_if_accessible(
    project_id: str,
    x_project_password: Optional[str] = Header(None, alias="X-Project-Password"),
    db: Session = Depends(database.get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    
    if project.hashed_password:
        if not x_project_password or not pwd_context.verify(x_project_password, project.hashed_password):
            raise HTTPException(status_code=403, detail="비밀번호가 틀렸거나 제공되지 않았습니다.")
    
    return project


# --- API 엔드포인트 ---

@router.get("", response_model=ProjectListResponse)
def get_projects(db: Session = Depends(database.get_db)):
    projects_from_db = db.query(ProjectModel).options(
        joinedload(ProjectModel.groups).joinedload(GroupModel.cards),
        joinedload(ProjectModel.worldview),
        joinedload(ProjectModel.worldview_groups).joinedload(WorldviewGroupModel.worldview_cards),
        joinedload(ProjectModel.relationships),
        joinedload(ProjectModel.scenarios).joinedload(ScenarioModel.plot_points)
    ).order_by(ProjectModel.name).all()

    response_projects = [convert_project_orm_to_pydantic(p) for p in projects_from_db]

    return {"projects": response_projects}

@router.get("/{project_id}/status")
def get_project_status(project_id: str, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    return {"requires_password": bool(project.hashed_password)}

@router.post("/{project_id}/verify")
def verify_password(project_id: str, request: ProjectPasswordRequest, db: Session = Depends(database.get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if not project.hashed_password:
        return {"message": "이 프로젝트는 비밀번호가 설정되어 있지 않습니다."}
    if not pwd_context.verify(request.password, project.hashed_password):
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")
    return {"message": "인증 성공"}

@router.put("/{project_id}/password")
def set_or_change_password(request: ProjectPasswordRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    project.hashed_password = pwd_context.hash(request.password)
    db.commit()
    return {"message": "비밀번호가 성공적으로 설정/변경되었습니다."}

@router.get("/{project_id}", response_model=Project)
def get_project_details(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    if not project.scenarios:
        new_scenario = ScenarioModel(
            id=f"scen-{int(time.time() * 1000)}",
            project_id=project.id,
            title="메인 시나리오",
            synopsis=""
        )
        db.add(new_scenario)
        db.commit()
        db.refresh(project)

    return convert_project_orm_to_pydantic(project)

@router.post("", response_model=Project)
def create_project(project_request: CreateProjectRequest, db: Session = Depends(database.get_db)):
    timestamp = int(time.time() * 1000)
    new_project_id = f"project-{timestamp}"
    
    hashed_password = None
    if project_request.password:
        hashed_password = pwd_context.hash(project_request.password)
        
    new_project = ProjectModel(id=new_project_id, name=project_request.name, hashed_password=hashed_password)
    
    uncategorized_group = GroupModel(id=f"group-uncategorized-{timestamp}", project_id=new_project_id, name='미분류')
    
    default_worldview_content = json.dumps({"logline": "", "genre": "", "rules": []})
    default_worldview = WorldviewModel(project_id=new_project_id, content=default_worldview_content)
    
    default_scenario = ScenarioModel(
        id=f"scen-{timestamp}",
        project_id=new_project_id,
        title="메인 시나리오",
        prologue=""
    )
    
    db.add(new_project)
    db.add(uncategorized_group)
    db.add(default_worldview)
    db.add(default_scenario)
    db.commit()
    db.refresh(new_project)
    
    created_project_orm = db.query(ProjectModel).options(
        joinedload(ProjectModel.groups).joinedload(GroupModel.cards),
        joinedload(ProjectModel.worldview),
        joinedload(ProjectModel.scenarios).joinedload(ScenarioModel.plot_points)
    ).filter(ProjectModel.id == new_project_id).first()
    
    return convert_project_orm_to_pydantic(created_project_orm)

@router.delete("/{project_id}")
def delete_project(project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    db.delete(project)
    db.commit()
    return {"message": "프로젝트가 성공적으로 삭제되었습니다."}

@router.put("/{project_id}")
def update_project(project_request: UpdateProjectRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    project.name = project_request.name
    db.commit()
    db.refresh(project)
    return {"message": "프로젝트 이름이 성공적으로 수정되었습니다.", "project": project}

# --- 캐릭터 그룹 & 카드 ---
@router.post("/{project_id}/groups", response_model=Group)
def create_group(group_request: CreateGroupRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    new_group_id = f"group-{int(time.time() * 1000)}"
    new_group = GroupModel(id=new_group_id, project_id=project.id, name=group_request.name)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.delete("/{project_id}/groups/{group_id}")
def delete_group(group_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    group = db.query(GroupModel).filter(GroupModel.id == group_id, GroupModel.project_id == project.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="삭제할 그룹을 찾을 수 없습니다.")
    if group.name == '미분류':
        raise HTTPException(status_code=400, detail="'미분류' 그룹은 삭제할 수 없습니다.")
    db.delete(group)
    db.commit()
    return {"message": "그룹이 성공적으로 삭제되었습니다."}

# --- 메인 세계관 ---
@router.put("/{project_id}/worldview", response_model=Worldview)
def update_worldview(request: WorldviewUpdateRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    worldview = db.query(WorldviewModel).filter(WorldviewModel.project_id == project.id).first()
    
    new_content_json = request.model_dump_json()

    if worldview:
        worldview.content = new_content_json
    else:
        worldview = WorldviewModel(project_id=project.id, content=new_content_json)
        db.add(worldview)
        
    db.commit()
    db.refresh(worldview)
    
    return Worldview.model_validate_json(worldview.content)

# --- 이하 엔드포인트들은 변경 없음 ---

@router.post("/{project_id}/worldview_groups", response_model=WorldviewGroup)
def create_worldview_group(group_request: CreateGroupRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    new_group_id = f"wv-group-{int(time.time() * 1000)}"
    new_group = WorldviewGroupModel(id=new_group_id, project_id=project.id, name=group_request.name)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@router.delete("/{project_id}/worldview_groups/{group_id}")
def delete_worldview_group(group_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    group = db.query(WorldviewGroupModel).filter(WorldviewGroupModel.id == group_id, WorldviewGroupModel.project_id == project.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="삭제할 그룹을 찾을 수 없습니다.")
    db.delete(group)
    db.commit()
    return {"message": "세계관 그룹이 삭제되었습니다."}

@router.post("/{project_id}/worldview_groups/{group_id}/cards", response_model=WorldviewCard)
def create_worldview_card(group_id: str, card_request: WorldviewCardCreateUpdateRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    group = db.query(WorldviewGroupModel).filter(WorldviewGroupModel.id == group_id, WorldviewGroupModel.project_id == project.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="상위 그룹을 찾을 수 없습니다.")
    new_card_id = f"wv-card-{int(time.time() * 1000)}"
    card_count = len(group.worldview_cards)
    new_card = WorldviewCardModel(id=new_card_id, group_id=group_id, title=card_request.title, content=card_request.content, ordering=card_count)
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card

@router.put("/{project_id}/cards/{card_id}", response_model=Card)
def update_card(card_id: str, card_data: UpdateCardRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    card = db.query(CardModel).join(GroupModel).filter(CardModel.id == card_id, GroupModel.project_id == project.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="해당 프로젝트에서 카드를 찾을 수 없거나 권한이 없습니다.")

    update_data = card_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key in ['quote', 'personality', 'abilities', 'goal'] and value is not None:
            setattr(card, key, json.dumps(value, ensure_ascii=False))
        elif key != 'id':
            setattr(card, key, value)
    
    db.commit()
    db.refresh(card)
    
    card_dict = card.__dict__
    for field in ['quote', 'personality', 'abilities', 'goal']:
        field_value = getattr(card, field, None)
        if field_value and isinstance(field_value, str):
            try:
                card_dict[field] = json.loads(field_value)
            except json.JSONDecodeError:
                card_dict[field] = [s.strip() for s in field_value.split(',')]
        elif not isinstance(field_value, list):
            card_dict[field] = []
            
    return Card.model_validate(card_dict)

@router.put("/{project_id}/worldview_cards/{card_id}", response_model=WorldviewCard)
def update_worldview_card(card_id: str, card_request: WorldviewCardCreateUpdateRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    card = db.query(WorldviewCardModel).join(WorldviewGroupModel).filter(WorldviewCardModel.id == card_id, WorldviewGroupModel.project_id == project.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="수정할 카드를 찾을 수 없습니다.")
    card.title = card_request.title
    card.content = card_request.content
    db.commit()
    db.refresh(card)
    return card

@router.put("/{project_id}/worldview_cards/{card_id}/details", response_model=WorldviewCard)
def update_worldview_card_details(card_id: str, card_data: UpdateWorldviewCardRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    card = db.query(WorldviewCardModel).join(WorldviewGroupModel).filter(WorldviewCardModel.id == card_id, WorldviewGroupModel.project_id == project.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="해당 프로젝트에서 카드를 찾을 수 없거나 권한이 없습니다.")
    
    update_data = card_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key != 'id':
            setattr(card, key, value)
            
    db.commit()
    db.refresh(card)
    return card

@router.delete("/{project_id}/worldview_cards/{card_id}")
def delete_worldview_card(card_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    card = db.query(WorldviewCardModel).join(WorldviewGroupModel).filter(WorldviewCardModel.id == card_id, WorldviewGroupModel.project_id == project.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="삭제할 카드를 찾을 수 없습니다.")
    db.delete(card)
    db.commit()
    return {"message": "세계관 카드가 삭제되었습니다."}

@router.put("/{project_id}/worldview_groups/{group_id}/cards/order")
def update_worldview_card_order(group_id: str, request: UpdateCardOrderRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    group = db.query(WorldviewGroupModel).filter(WorldviewGroupModel.id == group_id, WorldviewGroupModel.project_id == project.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다.")
    for index, card_id in enumerate(request.card_ids):
        db.query(WorldviewCardModel).filter(WorldviewCardModel.id == card_id).update({"ordering": index})
    db.commit()
    return {"message": "카드 순서가 성공적으로 업데이트되었습니다."}

# --- 관계도 ---
@router.post("/{project_id}/relationships", response_model=Relationship)
def create_relationship(request: CreateRelationshipRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    new_rel_id = f"rel-{int(time.time() * 1000)}"
    new_rel = RelationshipModel(
        id=new_rel_id,
        project_id=project.id,
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
def update_relationship(relationship_id: str, request: UpdateRelationshipRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="수정할 관계를 찾을 수 없습니다.")
    rel.type = request.type
    rel.description = request.description
    db.commit()
    db.refresh(rel)
    return rel

@router.delete("/{project_id}/relationships/{relationship_id}")
def delete_relationship(relationship_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="삭제할 관계를 찾을 수 없습니다.")
    db.delete(rel)
    db.commit()
    return {"message": "관계가 성공적으로 삭제되었습니다."}
