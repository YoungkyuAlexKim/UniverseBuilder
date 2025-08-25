"""
표준화된 오류 응답을 위한 모듈
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """표준화된 오류 응답 모델"""
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    user_message: Optional[str] = None


class ErrorCodes:
    """표준화된 오류 코드들"""

    # 일반적인 오류들
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"

    # AI 관련 오류들
    AI_API_KEY_MISSING = "AI_API_KEY_MISSING"
    AI_GENERATION_FAILED = "AI_GENERATION_FAILED"
    AI_CHARACTER_GENERATION_FAILED = "AI_CHARACTER_GENERATION_FAILED"
    AI_WORLDVIEW_GENERATION_FAILED = "AI_WORLDVIEW_GENERATION_FAILED"
    AI_SCENARIO_GENERATION_FAILED = "AI_SCENARIO_GENERATION_FAILED"
    AI_EDIT_FAILED = "AI_EDIT_FAILED"
    AI_RESPONSE_PARSING_FAILED = "AI_RESPONSE_PARSING_FAILED"

    # 프로젝트 관련 오류들
    PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND"
    PROJECT_ACCESS_DENIED = "PROJECT_ACCESS_DENIED"
    PROJECT_PASSWORD_REQUIRED = "PROJECT_PASSWORD_REQUIRED"
    PROJECT_PASSWORD_INVALID = "PROJECT_PASSWORD_INVALID"

    # 데이터베이스 관련 오류들
    CARD_NOT_FOUND = "CARD_NOT_FOUND"
    GROUP_NOT_FOUND = "GROUP_NOT_FOUND"
    SCENARIO_NOT_FOUND = "SCENARIO_NOT_FOUND"
    PLOT_POINT_NOT_FOUND = "PLOT_POINT_NOT_FOUND"


def create_error_response(
    error_code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    user_message: Optional[str] = None
) -> ErrorResponse:
    """표준화된 오류 응답을 생성합니다."""
    return ErrorResponse(
        error_code=error_code,
        message=message,
        details=details,
        user_message=user_message or message
    )


def create_ai_error_response(
    operation: str,
    original_error: Exception,
    ai_response: Optional[str] = None
) -> ErrorResponse:
    """AI 관련 오류 응답을 생성합니다."""
    error_code_map = {
        "character": ErrorCodes.AI_CHARACTER_GENERATION_FAILED,
        "worldview": ErrorCodes.AI_WORLDVIEW_GENERATION_FAILED,
        "scenario": ErrorCodes.AI_SCENARIO_GENERATION_FAILED,
        "edit": ErrorCodes.AI_EDIT_FAILED
    }

    error_code = error_code_map.get(operation, ErrorCodes.AI_GENERATION_FAILED)

    details = {
        "operation": operation,
        "original_error": str(original_error),
        "error_type": type(original_error).__name__
    }

    if ai_response:
        details["ai_response_preview"] = ai_response[:200]

    user_message = f"AI {operation} 작업 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."

    return create_error_response(
        error_code=error_code,
        message=f"AI {operation} generation failed",
        details=details,
        user_message=user_message
    )
