"""
AI 유틸리티 모듈 - Google Gemini AI 호출 및 응답 처리

이 모듈은 모든 AI 관련 호출을 중앙화하여 관리하며,
다음과 같은 기능을 제공합니다:

- 스트리밍/비스트리밍 응답 지원
- 자동 재시도 로직
- 세부화된 오류 처리
- JSON/텍스트 응답 자동 처리
- 로깅 및 모니터링
"""

import os
import sys
import json
import time
import logging
from typing import Union, Dict, Any, Optional, AsyncGenerator
from contextlib import asynccontextmanager

import google.generativeai as genai
from google.generativeai.types import GenerationConfig, HarmCategory, HarmBlockThreshold
from google.api_core import exceptions as google_exceptions
from fastapi import HTTPException
from dotenv import load_dotenv

from ..error_responses import create_error_response, ErrorCodes

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 환경변수 로드
load_dotenv()

# 기본 안전 설정
DEFAULT_SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

# API 키 설정은 call_ai_model 함수 내에서 동적으로 수행됨

# 디버깅용: 마지막으로 사용된 API 키 정보 저장
last_used_api_key_info = None


async def call_ai_model(
    prompt: str,
    model_name: str,
    generation_config: Optional[GenerationConfig] = None,
    safety_settings: Optional[Dict[HarmCategory, HarmBlockThreshold]] = None,
    response_format: str = "auto",
    stream: bool = False,
    max_retries: int = 3,
    retry_delay: float = 1.0,
    user_api_key: Optional[str] = None,
) -> Union[Dict[str, Any], str, AsyncGenerator[str, None]]:
    """
    Google Gemini API를 호출하고 응답을 파싱하는 중앙 유틸리티 함수.

    Args:
        prompt: AI 모델에 전달할 전체 프롬프트.
        model_name: 사용할 AI 모델 이름.
        generation_config: 응답 형식 등을 지정하는 설정 객체.
        safety_settings: 안전 필터 설정 (기본값 사용 시 None).
        response_format: 응답 형식 ("json", "text", "auto").
        stream: 스트리밍 응답 여부.
        max_retries: 최대 재시도 횟수.
        retry_delay: 재시도 간격 (초).
        user_api_key: 사용자 제공 API 키 (선택사항).

    Returns:
        스트리밍 모드: AsyncGenerator[str, None]
        비스트리밍 모드: dict (JSON) 또는 str (텍스트)

    Raises:
        HTTPException: API 키 부재, 모델 호출 실패, 응답 파싱 실패 등 오류 발생 시.
    """
    start_time = time.time()

    # 사용할 API 키 결정 (사용자 키 우선, 없으면 서버 기본 키로 폴백)
    default_api_key = os.getenv("GOOGLE_API_KEY")

    # PyInstaller 포터블 환경에서는 추가 경로에서 .env 파일 검색
    if not default_api_key and getattr(sys, 'frozen', False):
        try:
            # 포터블 환경에서 .env 파일이 실행 파일과 같은 디렉토리에 있을 수 있음
            import sys
            app_dir = os.path.dirname(sys.executable)
            env_path = os.path.join(app_dir, '.env')
            if os.path.exists(env_path):
                from dotenv import load_dotenv
                load_dotenv(env_path)
                default_api_key = os.getenv("GOOGLE_API_KEY")
                logger.info(f"포터블 환경에서 .env 파일 로드 성공: {env_path}")
        except Exception as e:
            logger.warning(f"포터블 환경 .env 파일 로드 실패: {e}")

    # 사용자 키 검증 및 정리
    if user_api_key and isinstance(user_api_key, str):
        user_api_key = user_api_key.strip()

        # 사용자 키의 기본적인 유효성 검증
        if user_api_key and not user_api_key.startswith('AIza'):
            logger.warning(f"사용자 제공 API 키 형식이 올바르지 않습니다: {user_api_key[:10]}...")
            # 형식이 잘못된 키는 무시하고 서버 기본 키 사용
            user_api_key = None

        # 사용자 키의 길이 검증 (Google AI API 키는 일반적으로 39자 이상)
        if user_api_key and len(user_api_key) < 39:
            logger.warning(f"사용자 제공 API 키 길이가 너무 짧습니다: {len(user_api_key)}자")
            # 길이가 잘못된 키는 무시하고 서버 기본 키 사용
            user_api_key = None

    # 사용할 API 키 결정
    api_key_to_use = user_api_key or default_api_key

    # 사용자 키 사용 여부 로깅
    if user_api_key and api_key_to_use == user_api_key:
        logger.info("사용자 제공 API 키를 사용합니다.")
    elif default_api_key:
        logger.info("서버 기본 API 키를 사용합니다.")
    else:
        logger.warning("사용 가능한 API 키가 없습니다.")

    # API 키 검증
    if not api_key_to_use:
        logger.error("사용 가능한 AI API 키가 없습니다. 사용자 키와 서버 기본 키 모두 설정되지 않았습니다.")
        error_response = create_error_response(
            error_code=ErrorCodes.AI_API_KEY_MISSING,
            message="사용 가능한 AI API 키가 없습니다.",
            user_message="AI 기능을 사용할 수 없습니다. API 키를 입력하거나 시스템 관리자에게 문의해주세요."
        )
        raise HTTPException(status_code=500, detail=error_response.model_dump())

    # 결정된 API 키로 Gemini 설정
    try:
        genai.configure(api_key=api_key_to_use)

        # 디버깅용: 마지막으로 사용된 API 키 정보 로깅
        key_type = "사용자 키" if (user_api_key and api_key_to_use == user_api_key) else "서버 키"
        masked_key = api_key_to_use[:10] + "..." + api_key_to_use[-4:] if len(api_key_to_use) > 14 else api_key_to_use

        logger.info(f"🎯 [디버그] AI 호출 - 사용된 키: {key_type} | 키 미리보기: {masked_key} | 키 길이: {len(api_key_to_use)}자")
        logger.info(f"API 키 설정 완료 - 키 길이: {len(api_key_to_use)}자")

        # 전역 변수에 마지막 사용 키 정보 저장 (디버깅용)
        global last_used_api_key_info
        last_used_api_key_info = {
            "key_type": key_type,
            "masked_key": masked_key,
            "full_length": len(api_key_to_use),
            "timestamp": time.time(),
            "model": model_name,
            "has_user_key": bool(user_api_key),
            "has_server_key": bool(default_api_key)
        }

    except Exception as e:
        logger.error(f"API 키 설정 실패: {e}")
        error_response = create_error_response(
            error_code=ErrorCodes.AI_API_KEY_MISSING,
            message="AI API 키 설정에 실패했습니다.",
            user_message="API 키가 유효하지 않습니다. 키를 확인하고 다시 시도해주세요."
        )
        raise HTTPException(status_code=400, detail=error_response.model_dump())

    # 안전 설정 적용
    final_safety_settings = safety_settings or DEFAULT_SAFETY_SETTINGS

    # 로깅: 호출 시작
    logger.info(f"AI 호출 시작 - 모델: {model_name}, 스트리밍: {stream}, 프롬프트 길이: {len(prompt)}")

    try:
        model = genai.GenerativeModel(model_name)

        # 스트리밍 모드 처리
        if stream:
            return _handle_streaming_response(
                model=model,
                prompt=prompt,
                generation_config=generation_config,
                safety_settings=final_safety_settings,
                start_time=start_time
            )

        # 비스트리밍 모드: 재시도 로직 적용
        for attempt in range(max_retries):
            try:
                response = await model.generate_content_async(
                    prompt,
                    generation_config=generation_config,
                    safety_settings=final_safety_settings
                )

                # 응답 검증
                result = _process_response(response, response_format)

                # 로깅: 성공
                duration = time.time() - start_time
                logger.info(f"AI 호출 성공 - 모델: {model_name}, 처리시간: {duration:.2f}s")
                return result

            except (google_exceptions.InternalServerError, google_exceptions.ServiceUnavailable) as e:
                if attempt < max_retries - 1:
                    logger.warning(f"AI 서비스 일시적 오류 (시도 {attempt + 1}/{max_retries}): {e}")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # 지수 백오프
                else:
                    logger.error(f"AI 서비스 오류로 인한 호출 실패: {e}")
                    error_response = create_error_response(
                        error_code=ErrorCodes.AI_GENERATION_FAILED,
                        message="AI 서비스가 일시적으로 불안정합니다.",
                        user_message="잠시 후 다시 시도해주세요."
                    )
                    raise HTTPException(status_code=503, detail=error_response.model_dump())

    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"AI 호출 실패 - 모델: {model_name}, 처리시간: {duration:.2f}s, 오류: {e}")
        error_response = create_error_response(
            error_code=ErrorCodes.AI_GENERATION_FAILED,
            message=f"AI 모델 호출 중 예상치 못한 오류 발생: {e}",
            user_message="AI 호출 중 오류가 발생했습니다. 다시 시도해주세요."
        )
        raise HTTPException(status_code=500, detail=error_response.model_dump())


async def _handle_streaming_response(
    model: genai.GenerativeModel,
    prompt: str,
    generation_config: Optional[GenerationConfig],
    safety_settings: Dict[HarmCategory, HarmBlockThreshold],
    start_time: float
) -> AsyncGenerator[str, None]:
    """
    스트리밍 응답을 처리하는 내부 함수.
    """
    try:
        response = await model.generate_content_async(
            prompt,
            generation_config=generation_config,
            safety_settings=safety_settings,
            stream=True
        )

        chunk_count = 0
        total_chars = 0

        async for chunk in response:
            if chunk.text:
                chunk_count += 1
                total_chars += len(chunk.text)
                yield f"data: {chunk.text}\n\n"

        # 스트리밍 완료 신호
        yield "data: [DONE]\n\n"

        # 로깅: 스트리밍 완료
        duration = time.time() - start_time
        logger.info(f"AI 스트리밍 완료 - 처리시간: {duration:.2f}s")
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"AI 스트리밍 실패 - 처리시간: {duration:.2f}s, 오류: {e}")
        error_response = create_error_response(
            error_code=ErrorCodes.AI_GENERATION_FAILED,
            message=f"AI 스트리밍 중 오류 발생: {e}",
            user_message="AI 스트리밍 중 오류가 발생했습니다."
        )
        yield f"data: {error_response.model_dump_json()}\n\n"


def _process_response(response: Any, response_format: str) -> Union[Dict[str, Any], str]:
    """
    AI 응답을 처리하고 적절한 형식으로 변환하는 내부 함수.
    """
    # 응답 검증
    if not response.parts:
        finish_reason = response.candidates[0].finish_reason.name if response.candidates else "UNKNOWN"
        if "SAFETY" in finish_reason:
            logger.warning(f"AI 응답이 안전 필터에 의해 차단됨: {finish_reason}")
            error_response = create_error_response(
                error_code=ErrorCodes.AI_GENERATION_FAILED,
                message="AI 생성 내용이 안전 필터에 의해 차단되었습니다.",
                user_message="요청하신 내용이 AI의 안전 정책에 위반됩니다."
            )
            raise HTTPException(status_code=400, detail=error_response.model_dump())

        logger.error(f"AI로부터 유효한 응답을 받지 못함: {finish_reason}")
        error_response = create_error_response(
            error_code=ErrorCodes.AI_GENERATION_FAILED,
            message=f"AI로부터 유효한 응답을 받지 못했습니다.",
            details={"finish_reason": finish_reason},
            user_message="AI가 유효한 응답을 생성하지 못했습니다. 다시 시도해주세요."
        )
        raise HTTPException(status_code=500, detail=error_response.model_dump())

    # 응답 텍스트 추출
    raw_text = response.text.strip()

    # 응답 형식에 따른 처리
    if response_format == "json" or (response_format == "auto" and _is_json_response(raw_text)):
        try:
            cleaned_text = raw_text.removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned_text)
        except json.JSONDecodeError as e:
            logger.error(f"AI JSON 응답 파싱 실패: {e}, 원본: {raw_text[:200]}...")
            error_response = create_error_response(
                error_code=ErrorCodes.AI_RESPONSE_PARSING_FAILED,
                message="AI가 유효하지 않은 JSON 형식으로 응답했습니다.",
                details={"raw_response": raw_text[:200]},
                user_message="AI 응답을 처리하는 중 오류가 발생했습니다."
            )
            raise HTTPException(status_code=500, detail=error_response.model_dump())

    # 텍스트 응답
    return raw_text


def _is_json_response(text: str) -> bool:
    """
    응답 텍스트가 JSON 형식인지 판단하는 헬퍼 함수.
    """
    cleaned = text.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        json.loads(cleaned)
        return True
    except json.JSONDecodeError:
        return False


# 비동기 함수를 위한 asyncio 임포트 (필요한 경우)
import asyncio


def get_last_used_api_key_info():
    """
    디버깅용: 마지막으로 사용된 API 키 정보를 반환합니다.
    """
    global last_used_api_key_info

    if last_used_api_key_info is None:
        return {
            "message": "아직 AI 호출이 수행되지 않았습니다.",
            "timestamp": None
        }

    # 시간 정보 가독성 있게 변환
    import datetime
    readable_time = datetime.datetime.fromtimestamp(last_used_api_key_info["timestamp"]).strftime('%Y-%m-%d %H:%M:%S')

    return {
        **last_used_api_key_info,
        "readable_timestamp": readable_time,
        "time_since": f"{time.time() - last_used_api_key_info['timestamp']:.1f}초 전"
    }
