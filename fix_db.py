# versions 폴더의 가장 최신 버전 ID를 수정하는 스크립트, 응급처치용, 버전 번호 수정 후 실행
# 항상 실행하기전에 ai에게 최신버전이 뭔지 물어보고 실행

import sqlite3

DB_NAME = "scenario_builder.db"
CORRECT_VERSION = "5c5a3d1b7e0f" # versions 폴더의 가장 최신 버전 ID

print(f"데이터베이스 '{DB_NAME}'의 Alembic 버전을 수정합니다.")

try:
    # 데이터베이스 연결
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # 현재 버전 확인
    cursor.execute("SELECT version_num FROM alembic_version")
    current_version = cursor.fetchone()[0]
    print(f" -> 현재 기록된 버전: {current_version}")

    # 버전 번호 업데이트
    cursor.execute("UPDATE alembic_version SET version_num = ?", (CORRECT_VERSION,))
    conn.commit()

    # 수정된 버전 확인
    cursor.execute("SELECT version_num FROM alembic_version")
    updated_version = cursor.fetchone()[0]
    print(f" -> 수정된 버전: {updated_version}")

    if updated_version == CORRECT_VERSION:
        print("\n성공적으로 버전을 수정했습니다!")
    else:
        print("\n오류: 버전이 올바르게 수정되지 않았습니다.")

except Exception as e:
    print(f"\n오류 발생: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
        print("데이터베이스 연결을 닫았습니다.")