from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from .routers import projects, generators
from . import database

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
    """앱 시작 시 실행되는 이벤트입니다."""
    # 데이터베이스 관련 로직을 모두 제거합니다.
    # Alembic이 외부에서 모든 것을 관리합니다.
    print("FastAPI application startup")

app.include_router(projects.router)
app.include_router(generators.router)