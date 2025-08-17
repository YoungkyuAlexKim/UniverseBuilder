@echo off
rem --- 가상환경 활성화 ---
echo Activating virtual environment...
call .\venv\Scripts\activate

rem --- FastAPI 서버 실행 ---
echo.
echo Starting FastAPI server at http://127.0.0.1:8000
echo Press CTRL+C to stop the server.
echo.
uvicorn app.main:app --reload