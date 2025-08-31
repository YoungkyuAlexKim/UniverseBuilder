/**
 * 유효성 검사 유틸리티 함수들
 * 기존 alert() 기반 피드백을 UI 기반 실시간 피드백으로 대체하는 함수들
 */

import { showValidationMessage, hideValidationMessage, removeValidationMessage, validateForm, addRealTimeValidation } from './validation-message.js';

let app; // App 인스턴스
let eventManager; // EventListenerManager 인스턴스
let isInitialized = false;

/**
 * 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 * @param {EventListenerManager} eventManagerInstance - 이벤트 관리자 인스턴스
 */
export function initializeValidationUtils(appInstance, eventManagerInstance) {
    if (appInstance && eventManagerInstance) {
        app = appInstance;
        eventManager = eventManagerInstance;
        isInitialized = true;
    }
}

/**
 * 모듈이 초기화되었는지 확인합니다.
 * @returns {boolean} 초기화 상태
 */
export function isValidationUtilsReady() {
    return isInitialized;
}

/**
 * 토스트 메시지를 표시합니다 (일반적인 성공/오류 메시지용)
 * @param {string} message - 표시할 메시지
 * @param {string} type - 메시지 타입 ('success', 'error', 'warning', 'info')
 * @param {number} duration - 표시 시간 (밀리초)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // 초기화되지 않은 경우 조용히 무시
    if (!isInitialized) {
        return null;
    }

    // 토스트 컨테이너 생성 또는 가져오기
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // 토스트 메시지 생성
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = getToastIcon(type);
    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(textSpan);

    // 토스트 컨테이너에 추가
    toastContainer.appendChild(toast);

    // 애니메이션 효과
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 자동 제거
    setTimeout(() => {
        hideToast(toast);
    }, duration);

    return toast;
}

/**
 * 토스트 메시지를 숨깁니다.
 * @param {HTMLElement} toast - 숨길 토스트 요소
 */
function hideToast(toast) {
    toast.classList.add('hide');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 300);
}

/**
 * 토스트 아이콘을 가져옵니다.
 * @param {string} type - 메시지 타입
 * @returns {HTMLElement} 아이콘 요소
 */
function getToastIcon(type) {
    const icon = document.createElement('span');
    icon.className = 'toast-icon';

    switch (type) {
        case 'success':
            icon.innerHTML = '✓';
            break;
        case 'error':
            icon.innerHTML = '✕';
            break;
        case 'warning':
            icon.innerHTML = '⚠';
            break;
        case 'info':
        default:
            icon.innerHTML = 'ℹ';
            break;
    }

    return icon;
}

/**
 * 필드별 유효성 검사 결과를 표시합니다.
 * @param {HTMLElement} field - 검증할 필드
 * @param {string} message - 검증 메시지
 * @param {boolean} isValid - 유효성 여부
 */
export function showFieldValidation(field, message, isValid) {
    if (isValid) {
        if (message) {
            showValidationMessage(field, message, 'success');
        } else {
            removeValidationMessage(field);
        }
    } else {
        showValidationMessage(field, message, 'error');
    }
}

/**
 * 폼 제출 전 전체 유효성을 검사합니다.
 * @param {HTMLFormElement} form - 검증할 폼
 * @param {Array} validationRules - 검증 규칙 배열
 * @returns {boolean} 폼이 유효한지 여부
 */
export function validateFormBeforeSubmit(form, validationRules) {
    // 기존 유효성 메시지 제거
    form.querySelectorAll('.validation-message').forEach(msg => msg.remove());

    const result = validateForm(form, validationRules);

    if (!result.isValid) {
        // 첫 번째 오류 필드에 포커스
        const firstInvalidField = result.results.find(r => !r.isValid)?.field;
        if (firstInvalidField) {
            firstInvalidField.focus();
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        showToast('입력 내용을 확인해주세요.', 'warning', 4000);
    }

    return result.isValid;
}

/**
 * 공통 검증 규칙들
 */
export const ValidationRules = {
    /**
     * 필수 입력 검증
     * @param {string} fieldName - 필드 표시 이름
     * @returns {Function} 검증 함수
     */
    required: (fieldName) => (value, field) => ({
        isValid: value && value.trim().length > 0,
        message: `${fieldName}은(는) 필수 입력 항목입니다.`
    }),

    /**
     * 최소 길이 검증
     * @param {number} minLength - 최소 길이
     * @param {string} fieldName - 필드 표시 이름
     * @returns {Function} 검증 함수
     */
    minLength: (minLength, fieldName) => (value, field) => ({
        isValid: !value || value.length >= minLength,
        message: `${fieldName}은(는) 최소 ${minLength}자 이상 입력해야 합니다.`
    }),

    /**
     * 최대 길이 검증
     * @param {number} maxLength - 최대 길이
     * @param {string} fieldName - 필드 표시 이름
     * @returns {Function} 검증 함수
     */
    maxLength: (maxLength, fieldName) => (value, field) => ({
        isValid: !value || value.length <= maxLength,
        message: `${fieldName}은(는) 최대 ${maxLength}자까지 입력할 수 있습니다.`
    }),

    /**
     * 범위 검증 (숫자)
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @param {string} fieldName - 필드 표시 이름
     * @returns {Function} 검증 함수
     */
    range: (min, max, fieldName) => (value, field) => {
        const num = parseFloat(value);
        return {
            isValid: isNaN(num) || (num >= min && num <= max),
            message: `${fieldName}은(는) ${min}에서 ${max} 사이의 값이어야 합니다.`
        };
    },

    /**
     * 이메일 형식 검증
     * @returns {Function} 검증 함수
     */
    email: () => (value, field) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
            isValid: !value || emailRegex.test(value),
            message: '올바른 이메일 형식을 입력해주세요.'
        };
    },

    /**
     * URL 형식 검증
     * @returns {Function} 검증 함수
     */
    url: () => (value, field) => {
        try {
            if (!value) return { isValid: true };
            new URL(value);
            return { isValid: true };
        } catch {
            return { isValid: false, message: '올바른 URL 형식을 입력해주세요.' };
        }
    },

    /**
     * 사용자 정의 패턴 검증
     * @param {RegExp} pattern - 검증 패턴
     * @param {string} message - 오류 메시지
     * @returns {Function} 검증 함수
     */
    pattern: (pattern, message) => (value, field) => ({
        isValid: !value || pattern.test(value),
        message: message
    }),

    /**
     * 체크박스 그룹 검증 (최소 선택 개수)
     * @param {number} minSelected - 최소 선택 개수
     * @param {string} fieldName - 필드 표시 이름
     * @returns {Function} 검증 함수
     */
    minSelected: (minSelected, fieldName) => (value, field) => {
        // 체크박스 그룹의 경우 value 대신 checked 상태 확인
        const groupName = field.name;
        const checkedBoxes = document.querySelectorAll(`input[name="${groupName}"]:checked`);
        return {
            isValid: checkedBoxes.length >= minSelected,
            message: `${fieldName}은(는) 최소 ${minSelected}개 이상 선택해야 합니다.`
        };
    }
};

/**
 * 실시간 유효성 검사를 쉽게 설정할 수 있는 헬퍼 함수들
 */
export const ValidationHelpers = {
    /**
     * 프로젝트 이름 검증 설정
     * @param {HTMLElement} field - 프로젝트 이름 입력 필드
     */
    setupProjectNameValidation: (field) => {
        addRealTimeValidation(field, ValidationRules.required('프로젝트 이름'), {
            validateOnBlur: true,
            validateOnInput: true,
            debounceMs: 500
        });
    },

    /**
     * 시나리오 제목 검증 설정
     * @param {HTMLElement} field - 시나리오 제목 입력 필드
     */
    setupScenarioTitleValidation: (field) => {
        addRealTimeValidation(field, ValidationRules.required('시나리오 제목'), {
            validateOnBlur: true,
            validateOnInput: true,
            debounceMs: 300
        });
    },

    /**
     * 숫자 범위 검증 설정
     * @param {HTMLElement} field - 숫자 입력 필드
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @param {string} fieldName - 필드 표시 이름
     */
    setupNumberRangeValidation: (field, min, max, fieldName) => {
        addRealTimeValidation(field, ValidationRules.range(min, max, fieldName), {
            validateOnBlur: true,
            validateOnInput: true,
            debounceMs: 300
        });
    },

    /**
     * 플롯 제목 검증 설정
     * @param {HTMLElement} field - 플롯 제목 입력 필드
     */
    setupPlotTitleValidation: (field) => {
        addRealTimeValidation(field, ValidationRules.required('플롯 제목'), {
            validateOnBlur: true,
            validateOnInput: false // 실시간 검증 비활성화 (성능 최적화)
        });
    }
};

/**
 * 에러 처리 헬퍼 함수들
 */
export const ErrorHandlers = {
    /**
     * API 에러를 사용자 친화적인 메시지로 변환
     * @param {Error} error - API 에러
     * @returns {string} 사용자 친화적인 에러 메시지
     */
    getUserFriendlyErrorMessage: (error) => {
        if (error.message.includes('Network')) {
            return '네트워크 연결을 확인해주세요.';
        }
        if (error.message.includes('401')) {
            return '인증 정보가 유효하지 않습니다. 다시 로그인해주세요.';
        }
        if (error.message.includes('403')) {
            return '접근 권한이 없습니다.';
        }
        if (error.message.includes('404')) {
            return '요청한 리소스를 찾을 수 없습니다.';
        }
        if (error.message.includes('500')) {
            return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }

        return error.message || '알 수 없는 오류가 발생했습니다.';
    },

    /**
     * 에러를 UI에 표시
     * @param {Error} error - 표시할 에러
     * @param {string} context - 에러 발생 컨텍스트
     */
    showError: (error, context = '') => {
        const message = ErrorHandlers.getUserFriendlyErrorMessage(error);
        console.error(`${context}:`, error);
        showToast(message, 'error', 5000);
    },

    /**
     * 성공 메시지를 표시
     * @param {string} message - 성공 메시지
     */
    showSuccess: (message) => {
        showToast(message, 'success', 3000);
    }
};
