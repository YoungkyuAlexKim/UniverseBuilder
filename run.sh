#!/bin/bash

# 데이터베이스를 최신 상태로 업그레이드합니다.
alembic upgrade head

# 마이그레이션이 성공하면, 웹 서버를 시작합니다.
uvicorn app.main:app --host 0.0.0.0 --port $PORT