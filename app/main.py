from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# --- [수정] PyInstaller 경로 설정 ---
if getattr(sys, 'frozen', False):
    # .exe로 실행된 경우, BASE_DIR은 임시 폴더(_MEIPASS)입니다.
    BASE_DIR = sys._MEIPASS
else:
    # 일반 파이썬 환경에서 실행된 경우, __file__은 app/main.py이므로 상위 폴더로 이동합니다.
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# [수정] static 파일들의 경로를 올바르게 수정합니다.
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# --- 절대 경로 import 유지 ---
from app.routers import projects, generators, scenarios, manuscript
from app.routers.manuscript import style_guide_router

app = FastAPI()

# CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 오리진 허용 (개발용)
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메소드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

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