#!/bin/bash

# 이 스크립트의 어떤 명령어라도 실패하면 즉시 중단합니다.
set -e

# Render의 데이터베이스 URL이 제대로 설정되었는지 로그에 출력하여 확인합니다.
echo "DATABASE_URL is: $DATABASE_URL"

# alembic.ini의 설정 대신, 환경 변수의 DATABASE_URL을 직접 사용하여 데이터베이스를 업그레이드합니다.
# 이렇게 하면 설정 파일을 읽는 과정의 모든 잠재적 오류를 회피할 수 있습니다.
alembic -x sqlalchemy.url=$DATABASE_URL upgrade head

# 위의 alembic 명령이 성공적으로 완료되었을 경우에만 아래 uvicorn 서버가 실행됩니다.
echo "Database migration successful. Starting server..."
uvicorn app.main:app --host 0.0.0.0 --port $PORT