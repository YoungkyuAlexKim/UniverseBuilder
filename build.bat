@echo off
rem --- [수정] 터미널 인코딩을 UTF-8로 설정하여 깨진 글자 방지 ---
chcp 65001

echo =================================================
echo  Scenario Universe Builder - Portable Build Tool
echo =================================================
echo.

rem --- 가상환경 활성화 ---
echo [1/4] 가상환경을 활성화합니다...
call .\\venv\\Scripts\\activate
if %errorlevel% neq 0 (
    echo ❌ 가상환경 활성화에 실패했습니다. venv 폴더가 있는지 확인하세요.
    pause
    exit /b
)
echo ✔️ 가상환경이 활성화되었습니다.
echo.

rem --- PyInstaller 설치 확인 ---
echo [2/4] PyInstaller 설치를 확인합니다...
pip show pyinstaller > nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ PyInstaller가 설치되어 있지 않습니다. 지금 설치합니다...
    pip install pyinstaller
    if %errorlevel% neq 0 (
        echo ❌ PyInstaller 설치에 실패했습니다.
        pause
        exit /b
    )
)
echo ✔️ PyInstaller가 준비되었습니다.
echo.

rem --- 빌드 시작 ---
echo [3/4] PyInstaller를 사용하여 빌드를 시작합니다...
echo ⏳ 이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려주세요.
echo.

rem --- [수정] 시작 스크립트를 run.py로 변경하고 --noconsole 옵션 제거 ---
pyinstaller --name "UniverseBuilder" ^
            --onefile ^
            --add-data "static;static" ^
            --add-data "alembic;alembic" ^
            --add-data "alembic.ini;." ^
            --add-data "app;app" ^
            --hidden-import "passlib.handlers.bcrypt" ^
            --hidden-import "uvicorn.logging" ^
            --hidden-import "uvicorn.loops" ^
            --hidden-import "uvicorn.protocols" ^
            run.py

if %errorlevel% neq 0 (
    echo ❌ 빌드 중 오류가 발생했습니다.
    pause
    exit /b
)
echo.

rem --- 빌드 완료 및 정리 ---
echo [4/4] 빌드가 완료되었습니다!
echo.
echo ✨ 'dist' 폴더에서 'UniverseBuilder.exe' 파일을 확인하세요.
echo.
echo 🧹 불필요한 빌드 파일을 정리합니다...
rmdir /s /q build
del UniverseBuilder.spec
echo ✔️ 정리 완료!
echo.
echo 이 창은 이제 닫으셔도 됩니다.
pause