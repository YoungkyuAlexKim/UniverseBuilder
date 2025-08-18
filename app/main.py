from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from .routers import projects, generators
from . import database 

# 삭제: from alembic.config import Config
# 삭제: from alembic import command

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

# 삭제: @app.on_event("startup") 부터 끝까지 모두 삭제

app.include_router(projects.router)
app.include_router(generators.router)