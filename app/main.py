from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from .routers import projects, generators
from . import database 

app = FastAPI()

# 정적 파일들을 서빙하되, 모든 응답에 캐시 비활성화 헤더를 추가하는 미들웨어를 사용합니다.
# 이렇게 하면 개별 라우팅 없이 '/static' 경로의 모든 파일을 처리하면서도 캐시를 막을 수 있습니다.
@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    # '/static/' 경로로 요청되는 파일에 대해서만 캐시 비활성화 헤더를 추가합니다.
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# '/static' 경로를 static 폴더에 연결합니다.
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return FileResponse('static/index.html')

# -------------------------------------------

@app.on_event("startup")
def on_startup():
    """앱이 시작될 때 필요한 초기화 작업을 수행합니다."""
    # 데이터베이스 마이그레이션 및 파일 확인 로직은 이제 필요 없으므로 삭제합니다.
    database.init_db()
    print("데이터베이스 설정이 완료되었습니다.")

app.include_router(projects.router)
app.include_router(generators.router)