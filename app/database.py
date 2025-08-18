import os
import json
from sqlalchemy import create_engine, Column, String, Text, Integer, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.declarative import declarative_base
import sqlite3

# --- SQLAlchemy 설정 ---

# Render PostgreSQL 접속 주소를 환경 변수에서 가져옵니다.
DATABASE_URL = os.environ.get("DATABASE_URL")

# 이 engine 객체를 Alembic이 사용하게 됩니다.
engine = None

if DATABASE_URL and DATABASE_URL.startswith("postgres"):
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

class Group(Base):
    __tablename__ = "groups"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    project = relationship("Project", back_populates="groups")
    cards = relationship("Card", back_populates="group", cascade="all, delete-orphan")

class Card(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    goal = Column(Text)  # JSON 문자열로 저장
    personality = Column(Text)  # JSON 문자열로 저장
    abilities = Column(Text)  # JSON 문자열로 저장
    quote = Column(Text)  # JSON 문자열로 저장
    introduction_story = Column(Text)
    ordering = Column(Integer)
    group = relationship("Group", back_populates="cards")

class Worldview(Base):
    __tablename__ = "worldviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    content = Column(Text)
    project = relationship("Project", back_populates="worldview")

class WorldviewGroup(Base):
    __tablename__ = "worldview_groups"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    project = relationship("Project", back_populates="worldview_groups")
    worldview_cards = relationship("WorldviewCard", back_populates="group", cascade="all, delete-orphan")

class WorldviewCard(Base):
    __tablename__ = "worldview_cards"
    id = Column(String, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("worldview_groups.id"), nullable=False)
    title = Column(String)
    content = Column(Text)
    ordering = Column(Integer)
    group = relationship("WorldviewGroup", back_populates="worldview_cards")

class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    source_character_id = Column(String, ForeignKey("cards.id"), nullable=False)
    target_character_id = Column(String, ForeignKey("cards.id"), nullable=False)
    type = Column(String, nullable=False)
    description = Column(Text)
    project = relationship("Project", back_populates="relationships")


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