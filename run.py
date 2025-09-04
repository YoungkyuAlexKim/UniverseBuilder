# 파일명: run.py
import sys
import os
import uvicorn
import webbrowser
from alembic.config import Config
from alembic import command

# --- [수정] PyInstaller 경로 설정 ---
if getattr(sys, 'frozen', False):
    # .exe로 실행된 경우, BASE_DIR은 임시 폴더(_MEIPASS)입니다.
    BASE_DIR = sys._MEIPASS
    # 데이터베이스 파일이 .exe 파일과 같은 폴더에 생성되도록 경로 설정
    db_path = os.path.join(os.path.dirname(sys.executable), "scenario_builder.db")
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
else:
    # 일반 파이썬 환경에서 실행된 경우
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# [수정] Alembic 설정 파일의 경로를 올바르게 수정합니다.
ALEMBIC_INI_PATH = os.path.join(BASE_DIR, 'alembic.ini')

# 이제 경로 설정이 끝났으므로, app 모듈을 가져옵니다.
from app.main import app

def run_migrations():
    """데이터베이스를 최신 상태로 업그레이드합니다."""
    try:
        print("="*50)
        print("1. 데이터베이스 마이그레이션을 확인하고 적용합니다...")
        alembic_cfg = Config(ALEMBIC_INI_PATH)
        # [수정] alembic 스크립트 위치 경로를 올바르게 수정합니다.
        alembic_cfg.set_main_option('script_location', os.path.join(BASE_DIR, 'alembic'))
        command.upgrade(alembic_cfg, "head")
        print("✔️ 데이터베이스가 최신 상태입니다.")
    except Exception as e:
        print(f"⚠️ 데이터베이스 마이그레이션 중 정보 메시지 (무시 가능): {e}")

if __name__ == "__main__":
    run_migrations()

    print("\n2. 웹 브라우저를 엽니다...")
    webbrowser.open("http://127.0.0.1:8000")
    print("✔️ http://127.0.0.1:8000 주소로 접속합니다.")

    print("\n3. Universe Builder 서버를 시작합니다...")
    print("   서버 주소: http://127.0.0.1:8000")
    print("   (종료하려면 이 터미널 창을 닫으세요)")
    print("="*50)

    # 포터블 환경에서 서버 실행 시 추가 로깅
    if getattr(sys, 'frozen', False):
        print("📱 포터블 모드로 실행 중입니다.")
        print(f"📂 실행 파일 위치: {sys.executable}")
        print(f"📂 임시 폴더: {sys._MEIPASS}")

    print("🚀 서버 시작을 시도합니다...")
    try:
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    except Exception as e:
        print(f"❌ 서버 시작 실패: {e}")
        print("💡 다른 프로그램이 포트 8000을 사용하고 있을 수 있습니다.")
        input("계속하려면 Enter 키를 누르세요...")