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
    """앱이 시작될 때 필요한 초기화 작업을 수행합니다."""
    # init_db()는 더 이상 필요하지 않습니다. Alembic이 모든 것을 관리합니다.
    # database.init_db()
    print("데이터베이스 설정은 Alembic이 관리합니다.")

app.include_router(projects.router)
app.include_router(generators.router)