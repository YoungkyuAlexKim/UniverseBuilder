import os
import json
from sqlalchemy import create_engine, Column, String, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.declarative import declarative_base
import sqlite3

# --- SQLAlchemy 설정 ---

# Render PostgreSQL 접속 주소를 환경 변수에서 가져옵니다.
DATABASE_URL = os.environ.get("DATABASE_URL")

# 이 engine 객체를 Alembic이 사용하게 됩니다.
engine = None

if DATABASE_URL and "postgres" in DATABASE_URL:
    # 배포 환경 (PostgreSQL)
    engine = create_engine(DATABASE_URL)
else:
    # 로컬 환경 (SQLite)
    DATABASE_NAME = "scenario_builder.db"
    engine = create_engine(f"sqlite:///{DATABASE_NAME}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- SQLAlchemy 모델 정의 (테이블 스키마) ---

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True) 

    groups = relationship("Group", back_populates="project", cascade="all, delete-orphan")
    worldview = relationship("Worldview", uselist=False, back_populates="project", cascade="all, delete-orphan")
    worldview_groups = relationship("WorldviewGroup", back_populates="project", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="project", cascade="all, delete-orphan")
    scenarios = relationship("Scenario", back_populates="project", cascade="all, delete-orphan")
    manuscript_blocks = relationship("ManuscriptBlock", back_populates="project", cascade="all, delete-orphan")

class Group(Base):
    __tablename__ = "groups"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    project = relationship("Project", back_populates="groups")
    cards = relationship("Card", back_populates="group", cascade="all, delete-orphan")

class Card(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    goal = Column(JSON)  # JSON 데이터로 저장
    personality = Column(JSON)  # JSON 데이터로 저장
    abilities = Column(JSON)  # JSON 데이터로 저장
    quote = Column(JSON)  # JSON 데이터로 저장
    introduction_story = Column(Text)
    ordering = Column(Integer)
    group = relationship("Group", back_populates="cards")

class Worldview(Base):
    __tablename__ = "worldviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    # [역할 재정의] 이 content 컬럼은 이제부터 구조화된 JSON 문자열을 저장합니다.
    # 예: { "logline": "...", "genre": "...", "rules": ["...", "..."] }
    content = Column(Text)
    project = relationship("Project", back_populates="worldview")

class WorldviewGroup(Base):
    __tablename__ = "worldview_groups"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    project = relationship("Project", back_populates="worldview_groups")
    worldview_cards = relationship("WorldviewCard", back_populates="group", cascade="all, delete-orphan")

class WorldviewCard(Base):
    __tablename__ = "worldview_cards"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("worldview_groups.id"), nullable=False, index=True)
    title = Column(String)
    content = Column(Text)
    ordering = Column(Integer)
    group = relationship("WorldviewGroup", back_populates="worldview_cards")

class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    source_character_id = Column(String, ForeignKey("cards.id"), nullable=False, index=True)
    target_character_id = Column(String, ForeignKey("cards.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    description = Column(Text)
    phase_order = Column(Integer, nullable=False, default=1)  # [추가] 관계 변화 단계 (1부터 시작)
    project = relationship("Project", back_populates="relationships")
    phases = relationship("RelationshipPhase", back_populates="relationship", cascade="all, delete-orphan")  # [추가] 관계 변화 단계들

class RelationshipPhase(Base):
    __tablename__ = "relationship_phases"
    id = Column(String, primary_key=True, index=True)
    relationship_id = Column(String, ForeignKey("relationships.id"), nullable=False, index=True)
    phase_order = Column(Integer, nullable=False)  # 단계 순서 (1, 2, 3...)
    type = Column(String, nullable=False)  # 관계를 한두 단어로 요약한 키워드
    description = Column(Text)  # 해당 단계에서의 관계에 대한 상세 서술
    trigger_description = Column(Text)  # [핵심] 이 PHASE로 변화하게 된 계기(사건)를 작가가 직접 서술

    # 호칭/말투 필드 (모두 Nullable)
    source_to_target_address = Column(String)  # A가 B를 부르는 호칭
    source_to_target_tone = Column(Text)  # A가 B에게 말하는 말투와 그 예시
    target_to_source_address = Column(String)  # B가 A를 부르는 호칭
    target_to_source_tone = Column(Text)  # B가 A에게 말하는 말투와 그 예시

    relationship = relationship("Relationship", back_populates="phases")

class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="메인 시나리오")
    summary = Column(Text)
    themes = Column(Text) # JSON list of strings e.g., '["복수", "희생"]'
    synopsis = Column(Text) # [변경] 시놉시스 / 전체 줄거리 컬럼
    project = relationship("Project", back_populates="scenarios")
    plot_points = relationship("PlotPoint", back_populates="scenario", cascade="all, delete-orphan")

class PlotPoint(Base):
    __tablename__ = "plot_points"
    id = Column(String, primary_key=True, index=True)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    content = Column(Text)
    ordering = Column(Integer, nullable=False)
    scene_draft = Column(Text, nullable=True) # [신규] 장면 초안을 저장할 컬럼
    scenario = relationship("Scenario", back_populates="plot_points")

class ManuscriptBlock(Base):
    __tablename__ = "manuscript_blocks"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text)
    ordering = Column(Integer, nullable=False)
    word_count = Column(Integer, nullable=True, default=0)
    char_count = Column(Integer, nullable=True, default=0)
    project = relationship("Project", back_populates="manuscript_blocks")

# --- 데이터베이스 연결 및 초기화 함수 ---

def init_db():
    """
    SQLAlchemy 모델을 기반으로 데이터베이스에 모든 테이블을 생성합니다.
    """
    Base.metadata.create_all(bind=engine)

# FastAPI의 Depends에서 사용될 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
# 기존 sqlite3 연결 방식과의 호환성을 위해 남겨두지만, 점차 get_db()로 전환해야 합니다.
def get_db_connection():
    # 로컬에서는 계속 SQLite를 사용할 수 있도록 합니다.
    if DATABASE_URL and DATABASE_URL.startswith("postgres"):
        # 배포 환경에서는 이 함수가 호출되면 안되지만, 비상용으로 남겨둡니다.
        # 실제로는 SQLAlchemy 세션을 사용해야 합니다.
        raise NotImplementedError("PostgreSQL environment should use SQLAlchemy sessions via get_db().")
    else:
        conn = sqlite3.connect("scenario_builder.db")
        conn.row_factory = sqlite3.Row
        return conn