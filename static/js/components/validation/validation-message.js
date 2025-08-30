/**
 * 유효성 검사 메시지 컴포넌트
 * 실시간으로 입력 필드의 유효성을 검사하고 시각적 피드백을 제공하는 모듈
 */

let eventManager;
let isInitialized = false;

/**
 * 모듈을 초기화합니다.
 * @param {EventListenerManager} eventManagerInstance - 이벤트 관리자 인스턴스
 */
export function initializeValidationMessage(eventManagerInstance) {
    if (eventManagerInstance) {
        eventManager = eventManagerInstance;
        isInitialized = true;
    }
}

/**
 * 모듈이 초기화되었는지 확인합니다.
 * @returns {boolean} 초기화 상태
 */
export function isValidationMessageReady() {
    return isInitialized;
}

/**
 * 입력 필드에 대한 유효성 검사 메시지를 생성하고 표시합니다.
 * @param {HTMLElement} field - 검증할 입력 필드
 * @param {string} message - 표시할 메시지
 * @param {string} type - 메시지 타입 ('success', 'error', 'warning', 'info')
 * @param {number} duration - 메시지 표시 시간 (밀리초, 0이면 영구 표시)
 */
export function showValidationMessage(field, message, type = 'error', duration = 0) {
    // 기존 메시지가 있다면 제거
    removeValidationMessage(field);

    // 메시지 컨테이너 생성
    const messageContainer = document.createElement('div');
    messageContainer.className = `validation-message validation-${type}`;
    messageContainer.setAttribute('data-field-id', field.id || field.name);

    // 아이콘과 메시지 추가
    const icon = getValidationIcon(type);
    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    messageContainer.appendChild(icon);
    messageContainer.appendChild(textSpan);

    // 필드 스타일 업데이트
    updateFieldValidationState(field, type);

    // 메시지를 필드 아래에 삽입
    insertMessageAfterField(field, messageContainer);

    // 애니메이션 효과
    requestAnimationFrame(() => {
        messageContainer.classList.add('show');
    });

    // 자동 제거 타이머 (지정된 경우)
    if (duration > 0) {
        setTimeout(() => {
            hideValidationMessage(field);
        }, duration);
    }

    return messageContainer;
}

/**
 * 입력 필드의 유효성 검사 메시지를 숨깁니다.
 * @param {HTMLElement} field - 메시지를 숨길 필드
 */
export function hideValidationMessage(field) {
    const messageContainer = getValidationMessageContainer(field);
    if (messageContainer) {
        messageContainer.classList.remove('show');
        messageContainer.classList.add('hide');

        // 애니메이션 완료 후 제거
        setTimeout(() => {
            removeValidationMessage(field);
        }, 300); // CSS transition 시간과 맞춤
    }
}

/**
 * 입력 필드의 유효성 검사 메시지를 완전히 제거합니다.
 * @param {HTMLElement} field - 메시지를 제거할 필드
 */
export function removeValidationMessage(field) {
    const messageContainer = getValidationMessageContainer(field);
    if (messageContainer) {
        messageContainer.remove();
        clearFieldValidationState(field);
    }
}

/**
 * 입력 필드의 유효성 검사 상태를 업데이트합니다.
 * @param {HTMLElement} field - 상태를 업데이트할 필드
 * @param {string} type - 유효성 타입
 */
function updateFieldValidationState(field, type) {
    // 기존 유효성 클래스 제거
    field.classList.remove('field-valid', 'field-invalid', 'field-warning');

    // 새로운 유효성 클래스 추가
    if (type === 'success') {
        field.classList.add('field-valid');
    } else if (type === 'error') {
        field.classList.add('field-invalid');
    } else if (type === 'warning') {
        field.classList.add('field-warning');
    }
}

/**
 * 입력 필드의 유효성 검사 상태를 초기화합니다.
 * @param {HTMLElement} field - 상태를 초기화할 필드
 */
function clearFieldValidationState(field) {
    field.classList.remove('field-valid', 'field-invalid', 'field-warning');
}

/**
 * 메시지를 필드 아래에 삽입합니다.
 * @param {HTMLElement} field - 대상 필드
 * @param {HTMLElement} messageContainer - 메시지 컨테이너
 */
function insertMessageAfterField(field, messageContainer) {
    const fieldContainer = field.closest('.field-container, .input-group, .form-group') || field.parentElement;

    // 필드 컨테이너 다음에 메시지 삽입
    if (fieldContainer && fieldContainer.nextSibling) {
        fieldContainer.parentElement.insertBefore(messageContainer, fieldContainer.nextSibling);
    } else if (fieldContainer) {
        fieldContainer.appendChild(messageContainer);
    } else {
        field.insertAdjacentElement('afterend', messageContainer);
    }
}

/**
 * 필드의 유효성 검사 메시지 컨테이너를 가져옵니다.
 * @param {HTMLElement} field - 대상 필드
 * @returns {HTMLElement|null} 메시지 컨테이너 또는 null
 */
function getValidationMessageContainer(field) {
    const fieldId = field.id || field.name;
    return document.querySelector(`.validation-message[data-field-id="${fieldId}"]`);
}

/**
 * 유효성 타입에 따른 아이콘을 반환합니다.
 * @param {string} type - 유효성 타입
 * @returns {HTMLElement} 아이콘 요소
 */
function getValidationIcon(type) {
    const icon = document.createElement('span');
    icon.className = 'validation-icon';

    switch (type) {
        case 'success':
            icon.innerHTML = '✓';
            icon.classList.add('success-icon');
            break;
        case 'error':
            icon.innerHTML = '✕';
            icon.classList.add('error-icon');
            break;
        case 'warning':
            icon.innerHTML = '⚠';
            icon.classList.add('warning-icon');
            break;
        case 'info':
        default:
            icon.innerHTML = 'ℹ';
            icon.classList.add('info-icon');
            break;
    }

    return icon;
}

/**
 * 입력 필드에 실시간 유효성 검사를 추가합니다.
 * @param {HTMLElement} field - 검증할 입력 필드
 * @param {Function} validator - 검증 함수 (필드 값, 필드를 매개변수로 받음)
 * @param {Object} options - 옵션 객체
 */
export function addRealTimeValidation(field, validator, options = {}) {
    const {
        validateOnBlur = true,
        validateOnInput = true,
        validateOnChange = true,
        debounceMs = 300
    } = options;

    let debounceTimer;

    // 입력 이벤트 핸들러
    const handleInput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            runValidation(field, validator);
        }, debounceMs);
    };

    // 변경 이벤트 핸들러
    const handleChange = () => {
        runValidation(field, validator);
    };

    // 포커스 아웃 이벤트 핸들러
    const handleBlur = () => {
        runValidation(field, validator);
    };

    // 이벤트 리스너 등록
    if (validateOnInput) {
        if (eventManager && isInitialized) {
            eventManager.addEventListener(field, 'input', handleInput);
        } else {
            field.addEventListener('input', handleInput);
        }
    }

    if (validateOnChange) {
        if (eventManager && isInitialized) {
            eventManager.addEventListener(field, 'change', handleChange);
        } else {
            field.addEventListener('change', handleChange);
        }
    }

    if (validateOnBlur) {
        if (eventManager && isInitialized) {
            eventManager.addEventListener(field, 'blur', handleBlur);
        } else {
            field.addEventListener('blur', handleBlur);
        }
    }
}

/**
 * 유효성 검사를 실행합니다.
 * @param {HTMLElement} field - 검증할 필드
 * @param {Function} validator - 검증 함수
 */
function runValidation(field, validator) {
    try {
        const result = validator(field.value, field);

        if (result.isValid) {
            if (result.message) {
                showValidationMessage(field, result.message, 'success');
            } else {
                removeValidationMessage(field);
            }
        } else {
            showValidationMessage(field, result.message || '유효하지 않은 값입니다.', 'error');
        }
    } catch (error) {
        console.error('유효성 검사 중 오류 발생:', error);
        showValidationMessage(field, '유효성 검사 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 폼 전체의 유효성을 검사합니다.
 * @param {HTMLElement} form - 검증할 폼 요소
 * @param {Array} fieldValidators - 필드 검증 규칙 배열
 * @returns {boolean} 전체 폼이 유효한지 여부
 */
export function validateForm(form, fieldValidators) {
    let isFormValid = true;
    const results = [];

    fieldValidators.forEach(({ field, validator, required = false }) => {
        const fieldElement = typeof field === 'string' ? form.querySelector(field) : field;

        if (!fieldElement) {
            console.warn('유효성 검사할 필드를 찾을 수 없습니다:', field);
            return;
        }

        // 필수 입력 검증
        if (required && (!fieldElement.value || fieldElement.value.trim() === '')) {
            showValidationMessage(fieldElement, '필수 입력 항목입니다.', 'error');
            isFormValid = false;
            results.push({ field: fieldElement, isValid: false, message: '필수 입력 항목입니다.' });
            return;
        }

        // 값이 있는 경우에만 추가 검증 실행
        if (fieldElement.value && fieldElement.value.trim() !== '') {
            try {
                const result = validator(fieldElement.value, fieldElement);

                if (!result.isValid) {
                    showValidationMessage(fieldElement, result.message, 'error');
                    isFormValid = false;
                } else if (result.message) {
                    showValidationMessage(fieldElement, result.message, 'success');
                }

                results.push(result);
            } catch (error) {
                console.error('필드 유효성 검사 중 오류 발생:', error);
                showValidationMessage(fieldElement, '유효성 검사 중 오류가 발생했습니다.', 'error');
                isFormValid = false;
                results.push({ field: fieldElement, isValid: false, message: '유효성 검사 중 오류가 발생했습니다.' });
            }
        } else if (!required) {
            // 선택적 필드이고 값이 없는 경우 메시지 제거
            removeValidationMessage(fieldElement);
            results.push({ field: fieldElement, isValid: true });
        }
    });

    return { isValid: isFormValid, results };
}
