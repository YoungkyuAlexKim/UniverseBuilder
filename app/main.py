from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from .routers import projects, generators
from . import database 

# Alembic 라이브러리에서 필요한 부분을 직접 가져옵니다.
from alembic.config import Config
from alembic import command

app = FastAPI()

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return FileResponse('static/index.html')

# -------------------------------------------

@app.on_event("startup")
def on_startup():
    """
    앱이 시작될 때 데이터베이스 마이그레이션을 실행합니다.
    """
    print("Application startup: Running database migrations...")
    try:
        # Alembic 설정 파일을 로드합니다.
        alembic_cfg = Config("alembic.ini")
        
        # Render 환경 변수가 존재하면, alembic 설정의 DB URL을 덮어씁니다.
        # 이렇게 하면 로컬과 서버 환경 모두를 지원할 수 있습니다.
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            alembic_cfg.set_main_option("sqlalchemy.url", db_url)

        # 데이터베이스를 최신 버전으로 업그레이드합니다.
        command.upgrade(alembic_cfg, "head")
        print("Database migrations completed successfully.")
    except Exception as e:
        print(f"Error during database migration: {e}")


app.include_router(projects.router)
app.include_router(generators.router)