from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import sys  # sys 모듈 추가
import uvicorn  # uvicorn 추가
import webbrowser  # webbrowser 추가
from alembic.config import Config  # Alembic Config 추가
from alembic import command  # Alembic command 추가
from .routers import projects, generators, scenarios, manuscript
from .routers.manuscript import style_guide_router

# --- PyInstaller 경로 설정 ---
# 실행 파일(.exe)로 실행될 때와 일반 파이썬 스크립트로 실행될 때의 경로를 구분합니다.
if getattr(sys, 'frozen', False):
    # PyInstaller에 의해 실행된 경우
    BASE_DIR = sys._MEIPASS
else:
    # 일반 파이썬 환경에서 실행된 경우
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# static 파일들의 경로를 설정합니다.
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')
# Alembic 설정 파일의 경로를 설정합니다.
ALEMBIC_INI_PATH = os.path.join(BASE_DIR, '..', 'alembic.ini')


app = FastAPI()

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# 수정된 static 경로를 사용합니다.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    # 수정된 index.html 경로를 사용합니다.
    return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

app.include_router(projects.router)
app.include_router(generators.router)
app.include_router(scenarios.router)
app.include_router(manuscript.router)
app.include_router(style_guide_router)

# --- [신규] 실행 파일로 실행될 때 자동으로 서버를 켜고 브라우저를 여는 부분 ---
if __name__ == "__main__":
    print("=" * 50)
    print("🚀 Universe Builder 서버를 시작합니다...")
    print("=" * 50)

    try:
        # 1. Alembic을 사용하여 데이터베이스를 최신 상태로 업그레이드합니다.
        print("✔️ 데이터베이스 마이그레이션을 확인하고 적용합니다...")
        alembic_cfg = Config(ALEMBIC_INI_PATH)
        # alembic.ini 파일이 있는 디렉토리를 alembic의 script_location으로 설정합니다.
        alembic_cfg.set_main_option('script_location', os.path.join(BASE_DIR, '..', 'alembic'))
        command.upgrade(alembic_cfg, "head")
        print("✔️ 데이터베이스가 최신 상태입니다.")

    except Exception as e:
        print(f"❌ 데이터베이스 마이그레이션 중 오류 발생: {e}")
        print("프로그램을 계속 진행하지만, 데이터베이스 관련 문제가 발생할 수 있습니다.")

    # 2. 웹 브라우저를 엽니다.
    webbrowser.open("http://127.0.0.1:8000")

    # 3. Uvicorn 서버를 실행합니다.
    # Uvicorn이 app 객체를 찾을 수 있도록 'app.main:app' 형식으로 전달합니다.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)