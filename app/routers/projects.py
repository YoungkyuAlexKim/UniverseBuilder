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
from ..database import Project as ProjectModel, Group as GroupModel, Card as CardModel, Worldview as WorldviewModel, WorldviewGroup as WorldviewGroupModel, WorldviewCard as WorldviewCardModel, Relationship as RelationshipModel, RelationshipPhase as RelationshipPhaseModel, Scenario as ScenarioModel, PlotPoint as PlotPointModel

# --- 비밀번호 해싱 설정 ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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

class PlotPoint(BaseModel):
    id: str
    scenario_id: str
    title: str
    content: Optional[str] = None
    ordering: int
    scene_draft: Optional[str] = None
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
    phase_order: int = 1  # [추가] 관계 변화 단계
    class Config:
        from_attributes = True

class RelationshipPhase(BaseModel):
    id: str
    relationship_id: str
    phase_order: int
    type: str
    description: Optional[str] = None
    trigger_description: Optional[str] = None
    source_to_target_address: Optional[str] = None
    source_to_target_tone: Optional[str] = None
    target_to_source_address: Optional[str] = None
    target_to_source_tone: Optional[str] = None
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
    manuscript_blocks: List[ManuscriptBlock] = []
    class Config:
        from_attributes = True

class ProjectListItem(BaseModel):
    id: str
    name: str
    has_password: bool
    groups_count: int = 0
    scenarios_count: int = 0
    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    projects: List[ProjectListItem]

class DetailedProjectListResponse(BaseModel):
    projects: List[Project]

class CreateProjectRequest(BaseModel):
    name: str
    password: Optional[str] = None

class CreateSampleProjectRequest(BaseModel):
    sample_id: str
    custom_name: Optional[str] = None
    sample_data: Optional[dict] = None  # 프론트엔드에서 샘플 데이터를 직접 보낼 수 있도록

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
    phase_order: int = 1  # [추가] 관계 변화 단계 (기본값: 1)

class UpdateRelationshipRequest(BaseModel):
    type: str
    description: Optional[str] = None
    phase_order: Optional[int] = None  # [추가] 관계 변화 단계 (선택적)

class CreateRelationshipPhaseRequest(BaseModel):
    relationship_id: str
    phase_order: int
    type: str
    description: Optional[str] = None
    trigger_description: Optional[str] = None
    source_to_target_address: Optional[str] = None
    source_to_target_tone: Optional[str] = None
    target_to_source_address: Optional[str] = None
    target_to_source_tone: Optional[str] = None

class UpdateRelationshipPhaseRequest(BaseModel):
    phase_order: Optional[int] = None
    type: Optional[str] = None
    description: Optional[str] = None
    trigger_description: Optional[str] = None
    source_to_target_address: Optional[str] = None
    source_to_target_tone: Optional[str] = None
    target_to_source_address: Optional[str] = None
    target_to_source_tone: Optional[str] = None

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
    # manuscript_blocks 처리 로직 추가 (글자 수 계산 포함)
    manuscript_blocks_list = []
    for mb in project_orm.manuscript_blocks:
        block_dict = mb.__dict__
        if mb.content is not None:
            if mb.char_count is None:
                block_dict['char_count'] = len(mb.content)
            if mb.word_count is None:
                block_dict['word_count'] = len(mb.content.split()) if mb.content else 0
        else: # content가 없는 경우 0으로 처리
            if mb.char_count is None:
                block_dict['char_count'] = 0
            if mb.word_count is None:
                block_dict['word_count'] = 0
        manuscript_blocks_list.append(block_dict)

    project_dict = {
        "id": project_orm.id,
        "name": project_orm.name,
        "groups": [],
        "worldview_groups": [],
        "relationships": [rel.__dict__ for rel in project_orm.relationships],
        "scenarios": [],
        "manuscript_blocks": sorted(manuscript_blocks_list, key=lambda mb: mb.get("ordering", 0))
    }

    for group_orm in project_orm.groups:
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
                # JSON 타입이므로 이미 파싱된 상태, 빈 리스트 처리만 필요
                if not isinstance(field_value, list) and field_value is not None:
                    card_dict[field] = []
            group_dict["cards"].append(card_dict)
        project_dict["groups"].append(group_dict)

    for wv_group_orm in project_orm.worldview_groups:
        wv_group_dict = wv_group_orm.__dict__
        wv_group_dict["worldview_cards"] = sorted([c.__dict__ for c in wv_group_orm.worldview_cards], key=lambda c: (c["ordering"] is None, c["ordering"]))
        project_dict["worldview_groups"].append(wv_group_dict)

    for scenario_orm in project_orm.scenarios:
        scenario_dict = {
            "id": scenario_orm.id,
            "project_id": scenario_orm.project_id,
            "title": scenario_orm.title,
            "summary": scenario_orm.summary,
            "synopsis": getattr(scenario_orm, 'synopsis', ''),
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

@router.get("/list", response_model=ProjectListResponse)
def get_projects_list(db: Session = Depends(database.get_db)):
    """
    간단한 프로젝트 리스트만 반환 (빠른 로딩용)
    """
    projects_from_db = db.query(ProjectModel).options(
        # 최소한의 관계 데이터만 로드
        joinedload(ProjectModel.groups),
        joinedload(ProjectModel.scenarios)
    ).order_by(ProjectModel.name).all()

    response_projects = []
    for project in projects_from_db:
        response_projects.append(ProjectListItem(
            id=project.id,
            name=project.name,
            has_password=bool(project.hashed_password),
            groups_count=len(project.groups),
            scenarios_count=len(project.scenarios)
        ))

    return {"projects": response_projects}

@router.get("", response_model=DetailedProjectListResponse)
def get_projects(db: Session = Depends(database.get_db)):
    projects_from_db = db.query(ProjectModel).options(
        joinedload(ProjectModel.groups).joinedload(GroupModel.cards),
        joinedload(ProjectModel.worldview),
        joinedload(ProjectModel.worldview_groups).joinedload(WorldviewGroupModel.worldview_cards),
        joinedload(ProjectModel.relationships),
        joinedload(ProjectModel.scenarios).joinedload(ScenarioModel.plot_points),
        joinedload(ProjectModel.manuscript_blocks) # 이 줄 추가
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
    synopsis="" # 'prologue'를 'synopsis'로 변경
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

@router.post("/create-from-sample", response_model=Project)
def create_sample_project(sample_request: CreateSampleProjectRequest, db: Session = Depends(database.get_db)):
    """
    샘플 데이터를 기반으로 프로젝트를 생성합니다.
    프론트엔드에서 샘플 데이터를 받아서 처리합니다.
    """
    timestamp = int(time.time() * 1000)
    new_project_id = f"project-sample-{timestamp}"

    # 샘플 프로젝트 이름 설정
    project_name = sample_request.custom_name or "샘플 프로젝트"

    new_project = ProjectModel(id=new_project_id, name=project_name)

    # 프론트엔드에서 보낸 샘플 데이터 사용
    sample_data = sample_request.sample_data
    if not sample_data:
        raise HTTPException(status_code=400, detail="샘플 데이터가 제공되지 않았습니다.")

    groups_to_create = []
    cards_to_create = []
    # [수정] 관계도, 플롯 포인트, 세계관 그룹/카드 리스트 초기화
    relationships_to_create = []
    plot_points_to_create = []
    worldview_groups_to_create = []
    worldview_cards_to_create = []
    card_id_map = {} # 샘플 ID를 실제 DB ID로 매핑

    # 그룹 및 카드 생성
    if "groups" in sample_data:
        for group_data in sample_data["groups"]:
            group_id = f"group-{timestamp}-{len(groups_to_create)}"
            group = GroupModel(id=group_id, project_id=new_project_id, name=group_data["name"])
            groups_to_create.append(group)

            if "cards" in group_data:
                for card_idx, card_data in enumerate(group_data["cards"]):
                    original_card_id = card_data.get("id", card_data["name"]) # 샘플 데이터에 id가 없으면 이름으로 대체
                    new_card_id = f"card-{timestamp}-{len(cards_to_create)}"
                    card_id_map[original_card_id] = new_card_id # ID 매핑 정보 저장
                    card = CardModel(
                        id=new_card_id,
                        group_id=group_id,
                        name=card_data["name"],
                        description=card_data["description"],
                        goal=json.dumps(card_data.get("goal", [])),
                        personality=json.dumps(card_data.get("personality", [])),
                        abilities=json.dumps(card_data.get("abilities", [])),
                        quote=json.dumps(card_data.get("quote", [])),
                        introduction_story=card_data.get("introduction_story", ""),
                        ordering=card_idx
                    )
                    cards_to_create.append(card)

    # [수정] 관계도 생성
    if "relationships" in sample_data:
        for rel_data in sample_data["relationships"]:
            source_id = card_id_map.get(rel_data["source_character_id"])
            target_id = card_id_map.get(rel_data["target_character_id"])

            if source_id and target_id: # ID가 모두 매핑된 경우에만 관계 생성
                relationship = RelationshipModel(
                    id=f"rel-{timestamp}-{len(relationships_to_create)}",
                    project_id=new_project_id,
                    source_character_id=source_id,
                    target_character_id=target_id,
                    type=rel_data["type"],
                    description=rel_data.get("description", ""),
                    phase_order=rel_data.get("phase_order", 1)
                )
                relationships_to_create.append(relationship)

    # 세계관 그룹 및 카드 생성
    if "worldview_groups" in sample_data:
        for wv_group_data in sample_data["worldview_groups"]:
            wv_group_id = f"wv-group-{timestamp}-{len(worldview_groups_to_create)}"
            wv_group = WorldviewGroupModel(id=wv_group_id, project_id=new_project_id, name=wv_group_data["name"])
            worldview_groups_to_create.append(wv_group)

            if "worldview_cards" in wv_group_data:
                for card_idx, wv_card_data in enumerate(wv_group_data["worldview_cards"]):
                    wv_card_id = f"wv-card-{timestamp}-{len(worldview_cards_to_create)}"
                    wv_card = WorldviewCardModel(
                        id=wv_card_id,
                        group_id=wv_group_id,
                        title=wv_card_data["title"],
                        content=wv_card_data["content"],
                        ordering=card_idx
                    )
                    worldview_cards_to_create.append(wv_card)

    # 세계관 생성
    worldview_content = json.dumps(sample_data.get("worldview", {"logline": "", "genre": "", "rules": []}))
    worldview = WorldviewModel(project_id=new_project_id, content=worldview_content)

    # 시나리오 생성 (첫 번째 시나리오만 사용)
    scenarios_data = sample_data.get("scenarios", [])
    if scenarios_data:
        scenario_data = scenarios_data[0]
        scenario = ScenarioModel(
            id=f"scen-{timestamp}",
            project_id=new_project_id,
            title=scenario_data.get("title", "메인 스토리"),
            summary=scenario_data.get("summary", ""),
            synopsis=scenario_data.get("synopsis", "")
        )

        # 플롯 포인트 생성
        if "plot_points" in scenario_data:
            for plot_data in scenario_data["plot_points"]:
                plot_id = f"plot-{timestamp}-{plot_data['ordering']}"
                plot_point = PlotPointModel(
                    id=plot_id,
                    scenario_id=scenario.id,
                    title=plot_data["title"],
                    content=plot_data["content"],
                    ordering=plot_data["ordering"]
                )
                plot_points_to_create.append(plot_point)
    else:
        # 기본 시나리오 생성
        scenario = ScenarioModel(
            id=f"scen-{timestamp}",
            project_id=new_project_id,
            title="메인 스토리",
            summary="샘플 프로젝트의 메인 스토리",
            synopsis=""
        )

    # DB에 모든 데이터 추가
    db.add(new_project)
    db.add(worldview)
    db.add(scenario)

    for group in groups_to_create:
        db.add(group)
    for card in cards_to_create:
        db.add(card)
    # [수정] 관계도, 세계관 그룹/카드, 플롯 포인트 추가
    for rel in relationships_to_create:
        db.add(rel)
    for wv_group in worldview_groups_to_create:
        db.add(wv_group)
    for wv_card in worldview_cards_to_create:
        db.add(wv_card)
    for plot_point in plot_points_to_create:
        db.add(plot_point)

    db.commit()
    db.refresh(new_project)

    # 생성된 프로젝트 조회 및 반환
    created_project_orm = db.query(ProjectModel).options(
        joinedload(ProjectModel.groups).joinedload(GroupModel.cards),
        joinedload(ProjectModel.worldview),
        joinedload(ProjectModel.worldview_groups).joinedload(WorldviewGroupModel.worldview_cards),
        joinedload(ProjectModel.scenarios).joinedload(ScenarioModel.plot_points),
        joinedload(ProjectModel.relationships) # [수정] 관계도 정보도 함께 로드
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
            # JSON 타입이므로 직접 할당
            setattr(card, key, value)
        elif key != 'id':
            setattr(card, key, value)
    
    db.commit()
    db.refresh(card)
    
    card_dict = card.__dict__
    for field in ['quote', 'personality', 'abilities', 'goal']:
        field_value = getattr(card, field, None)
        # JSON 타입이므로 이미 파싱된 상태
        if field_value is None:
            card_dict[field] = []
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

    # 삭제할 카드가 속한 그룹 ID 저장
    group_id = card.group_id

    # 삭제 수행 및 세션에 반영 (아직 커밋하지 않음)
    db.delete(card)
    db.flush()

    # 같은 그룹의 남은 카드들의 순서 재정렬
    remaining_cards = db.query(WorldviewCardModel).filter(
        WorldviewCardModel.group_id == group_id
    ).order_by(WorldviewCardModel.ordering).all()

    for index, card in enumerate(remaining_cards):
        card.ordering = index

    # 삭제와 순서 변경을 하나의 트랜잭션으로 커밋
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
        description=request.description,
        phase_order=request.phase_order  # [추가] 관계 변화 단계
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
    if request.phase_order is not None:  # [추가] phase_order가 제공된 경우에만 업데이트
        rel.phase_order = request.phase_order
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

# --- 관계 변화 단계 (RelationshipPhase) ---

@router.post("/{project_id}/relationships/{relationship_id}/phases", response_model=RelationshipPhase)
def create_relationship_phase(relationship_id: str, request: CreateRelationshipPhaseRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    # 관계가 해당 프로젝트에 속하는지 확인
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="관계를 찾을 수 없습니다.")

    new_phase_id = f"phase-{int(time.time() * 1000)}"
    new_phase = RelationshipPhaseModel(
        id=new_phase_id,
        relationship_id=relationship_id,
        phase_order=request.phase_order,
        type=request.type,
        description=request.description,
        trigger_description=request.trigger_description,
        source_to_target_address=request.source_to_target_address,
        source_to_target_tone=request.source_to_target_tone,
        target_to_source_address=request.target_to_source_address,
        target_to_source_tone=request.target_to_source_tone
    )
    db.add(new_phase)
    db.commit()
    db.refresh(new_phase)
    return new_phase

@router.get("/{project_id}/relationships/{relationship_id}/phases", response_model=List[RelationshipPhase])
def get_relationship_phases(relationship_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    # 관계가 해당 프로젝트에 속하는지 확인
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="관계를 찾을 수 없습니다.")

    phases = db.query(RelationshipPhaseModel).filter(RelationshipPhaseModel.relationship_id == relationship_id).order_by(RelationshipPhaseModel.phase_order).all()
    return phases

@router.put("/{project_id}/relationships/{relationship_id}/phases/{phase_id}", response_model=RelationshipPhase)
def update_relationship_phase(relationship_id: str, phase_id: str, request: UpdateRelationshipPhaseRequest, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    # 관계가 해당 프로젝트에 속하는지 확인
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="관계를 찾을 수 없습니다.")

    phase = db.query(RelationshipPhaseModel).filter(RelationshipPhaseModel.id == phase_id, RelationshipPhaseModel.relationship_id == relationship_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="관계 단계를 찾을 수 없습니다.")

    # 요청된 필드들만 업데이트
    if request.phase_order is not None:
        phase.phase_order = request.phase_order
    if request.type is not None:
        phase.type = request.type
    if request.description is not None:
        phase.description = request.description
    if request.trigger_description is not None:
        phase.trigger_description = request.trigger_description
    if request.source_to_target_address is not None:
        phase.source_to_target_address = request.source_to_target_address
    if request.source_to_target_tone is not None:
        phase.source_to_target_tone = request.source_to_target_tone
    if request.target_to_source_address is not None:
        phase.target_to_source_address = request.target_to_source_address
    if request.target_to_source_tone is not None:
        phase.target_to_source_tone = request.target_to_source_tone

    db.commit()
    db.refresh(phase)
    return phase

@router.delete("/{project_id}/relationships/{relationship_id}/phases/{phase_id}")
def delete_relationship_phase(relationship_id: str, phase_id: str, project: ProjectModel = Depends(get_project_if_accessible), db: Session = Depends(database.get_db)):
    # 관계가 해당 프로젝트에 속하는지 확인
    rel = db.query(RelationshipModel).filter(RelationshipModel.id == relationship_id, RelationshipModel.project_id == project.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="관계를 찾을 수 없습니다.")

    phase = db.query(RelationshipPhaseModel).filter(RelationshipPhaseModel.id == phase_id, RelationshipPhaseModel.relationship_id == relationship_id).first()
    if not phase:
        raise HTTPException(status_code=404, detail="관계 단계를 찾을 수 없습니다.")

    db.delete(phase)
    db.commit()
    return {"message": "관계 단계가 삭제되었습니다."}