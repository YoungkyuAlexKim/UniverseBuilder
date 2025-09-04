import { App } from './core/App.js';
import { initializeValidationMessage, isValidationMessageReady } from './components/validation/validation-message.js';
import { initializeValidationUtils, isValidationUtilsReady, ValidationHelpers } from './components/validation/validation-utils.js';
import * as api from './modules/api.js';

// App 인스턴스를 생성하여 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    // 애플리케이션 초기화
    const app = new App();

    // 전역 객체에 app 인스턴스 할당 (다른 모듈에서 접근할 수 있도록)
    window.app = app;

    // 유효성 검사 컴포넌트 초기화 - 이벤트 기반
    if (app && app.eventManager) {
        try {
            initializeValidationMessage(app.eventManager);
            initializeValidationUtils(app, app.eventManager);

            // 초기화가 성공했는지 확인
            if (isValidationMessageReady() && isValidationUtilsReady()) {
                setupRealTimeValidation(app);
            }
        } catch (error) {
            console.warn('유효성 검사 컴포넌트 초기화 실패:', error);
            // 유효성 검사 없이 앱은 계속 실행됨
        }
    }

    // 사이드바 리사이즈 기능 초기화
    initResizableSidebar();

    // AI 모델 토글 카드 기능 초기화
    initAiModelToggle();

    // 스타일 가이드 선택 요소 초기화
    initializeStyleGuides();

    // 사용자 API 키 관리 초기화
    initializeUserApiKey();

    // 디버깅 함수들을 전역 객체에 추가 (개발자 콘솔에서 쉽게 접근 가능)
    window.debugApiKey = {
        lastUsed: debugLastApiKeyInfo,
        currentUser: debugCurrentUserApiKey,
        validateFormat: isValidApiKeyFormat
    };

    // 개발자용 힌트 출력
    console.log('🔧 [디버그] API 키 디버깅 함수들:');
    console.log('  - debugApiKey.lastUsed(): 마지막으로 사용된 API 키 정보');
    console.log('  - debugApiKey.currentUser(): 현재 저장된 사용자 키 상태');
    console.log('  - debugApiKey.validateFormat(key): 키 형식 검증');
});

/**
 * 사이드바 리사이즈 기능을 초기화합니다.
 */
function initResizableSidebar() {
    const resizer = document.getElementById('resizer');
    const root = document.documentElement;
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopResizing);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 600) newWidth = 600;
        root.style.setProperty('--sidebar-width', newWidth + 'px');
    }

    function stopResizing() {
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopResizing);
    }
}

/**
 * AI 모델 토글 카드 기능을 초기화합니다.
 */
function initAiModelToggle() {
    const modelCards = document.querySelectorAll('.model-card');
    const hiddenSelect = document.getElementById('ai-model-select');
    
    if (!modelCards.length || !hiddenSelect) {
        return;
    }
    
    modelCards.forEach(card => {
        card.addEventListener('click', () => {
            // 모든 카드에서 active 클래스 제거
            modelCards.forEach(c => c.classList.remove('active'));
            
            // 클릭된 카드에 active 클래스 추가
            card.classList.add('active');
            
            // 숨겨진 select 값 업데이트 (기존 JS 코드와의 호환성을 위해)
            const modelValue = card.dataset.value;
            if (modelValue) {
                hiddenSelect.value = modelValue;
                
                // change 이벤트 발생 (다른 코드에서 이벤트를 리슨하고 있을 수 있음)
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
    
    // 초기 상태: active 카드와 select 값 동기화
    const activeCard = document.querySelector('.model-card.active');
    if (activeCard && activeCard.dataset.value) {
        hiddenSelect.value = activeCard.dataset.value;
    }
}

/**
 * 실시간 유효성 검사를 설정합니다.
 * @param {App} app - 애플리케이션 인스턴스
 */
function setupRealTimeValidation(app) {
    // 유효성 검사 컴포넌트가 준비되지 않은 경우 중단
    if (!isValidationMessageReady() || !isValidationUtilsReady()) {
        console.warn('유효성 검사 컴포넌트가 준비되지 않아 실시간 검증을 설정할 수 없습니다.');
        return;
    }

    try {
        // 프로젝트 생성 폼에 실시간 검증 추가
        const projectForm = document.getElementById('new-project-form');
        if (projectForm) {
            const projectNameInput = projectForm.querySelector('input[name="name"]');
            if (projectNameInput) {
                ValidationHelpers.setupProjectNameValidation(projectNameInput);
            }
        }

        // 시나리오 폼에 실시간 검증 추가 - 이벤트 기반
        try {
            const scenarioForm = document.getElementById('scenario-details-form');
            if (scenarioForm) {
                const titleInput = scenarioForm.querySelector('#scenario-title');
                if (titleInput) {
                    ValidationHelpers.setupScenarioTitleValidation(titleInput);
                }
            }

            // 플롯 포인트 생성 폼에 실시간 검증 추가
            const plotForm = document.getElementById('add-plot-point-form');
            if (plotForm) {
                const plotTitleInput = plotForm.querySelector('input[name="title"]');
                if (plotTitleInput) {
                    ValidationHelpers.setupPlotTitleValidation(plotTitleInput);
                }
            }
        } catch (error) {
            console.warn('실시간 검증 설정 중 오류:', error);
        }
    } catch (error) {
        console.warn('실시간 검증 초기화 중 오류:', error);
    }
}

/**
 * 스타일 가이드 선택 요소들을 초기화합니다.
 */
async function initializeStyleGuides() {
    try {
        // DOM 요소들이 로드될 때까지 대기 - 이벤트 기반으로 변경됨

        // 스타일 가이드 선택 요소들을 동적으로 채움
        await populateStyleGuideSelects();

        // 스타일 가이드 변경 이벤트 리스너 추가
        const styleGuideSelects = [
            'draft-style-guide-select',
            'style-guide-select',
            'manuscript-ai-style-guide',
            'partial-refine-style-guide'
        ];

        styleGuideSelects.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                selectElement.addEventListener('change', (event) => {
                    const selectedValue = event.target.value;
                    const infoElementId = `${selectId}-info`;

                    // 선택된 스타일 가이드 정보를 표시
                    updateStyleGuideInfo(selectedValue, infoElementId);
                });

                // 초기 선택값에 대한 정보 표시
                if (selectElement.value) {
                    const infoElementId = `${selectId}-info`;
                    updateStyleGuideInfo(selectElement.value, infoElementId);
                }
            }
        });
    } catch (error) {
        console.warn('스타일 가이드 초기화 실패:', error);
        // 실패 시 폴백으로 수동 초기화 시도
        fallbackInitializeStyleGuides();
    }
}

/**
 * 스타일 가이드 초기화 실패 시 폴백 함수
 * 실제 존재하는 파일들을 기반으로 동적으로 옵션 생성
 */
function fallbackInitializeStyleGuides() {

    const styleGuideSelects = [
        'draft-style-guide-select',
        'style-guide-select',
        'manuscript-ai-style-guide',
        'partial-refine-style-guide'
    ];

    // 실제 존재하는 스타일 가이드 파일들
    // TODO: 향후 서버 API를 통해 동적으로 가져올 수 있도록 개선 가능
    const existingStyleGuides = [
        {
            id: 'COMIC_REACTION_KR_01_F',
            title: '현실주의 코미디 스타일',
            category: '코미디'
        },
        {
            id: 'COMIC_REACTION_KR_01',
            title: '냉소적 코미디 스타일',
            category: '코미디'
        }
    ];

    // 동적으로 옵션 생성
    const fallbackOptions = existingStyleGuides.map(sg => ({
        value: sg.id,
        text: `${sg.title} (${sg.category})`
    }));

    styleGuideSelects.forEach(selectId => {
        const selectElement = document.getElementById(selectId);
        if (selectElement && selectElement.options.length <= 1) {
            fallbackOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                selectElement.appendChild(option);
            });
        }
    });
}

/**
 * 스타일 가이드 선택 요소들을 동적으로 채웁니다.
 */
async function populateStyleGuideSelects() {
    try {
        const styleGuides = await api.getStyleGuides();

        // 모든 스타일 가이드 select 요소들을 찾습니다
        const selectElements = [
            'draft-style-guide-select',
            'style-guide-select',
            'manuscript-ai-style-guide',
            'partial-refine-style-guide'
        ];

        selectElements.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement) {
                // 기존 옵션들을 모두 제거 (첫 번째 옵션 제외)
                while (selectElement.options.length > 1) {
                    selectElement.remove(1);
                }

                // 새로운 스타일 가이드 옵션들을 추가
                styleGuides.forEach(styleGuide => {
                    const option = document.createElement('option');
                    option.value = styleGuide.id;
                    option.textContent = `${styleGuide.title} (${styleGuide.category})`;
                    option.title = styleGuide.description;
                    selectElement.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error('스타일 가이드 로드 실패:', error);

        // 폴백: 기존 하드코딩된 옵션들
        const selectElements = [
            'draft-style-guide-select',
            'style-guide-select',
            'manuscript-ai-style-guide',
            'partial-refine-style-guide'
        ];

        selectElements.forEach(selectId => {
            const selectElement = document.getElementById(selectId);
            if (selectElement && selectElement.options.length <= 1) {
                const fallbackOptions = [
                    { value: 'COMIC_REACTION_KR_01_F', text: '현실주의 코미디 스타일 (코미디)' },
                    { value: 'COMIC_REACTION_KR_01', text: '냉소적 코미디 스타일 (코미디)' }
                ];

                fallbackOptions.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.text;
                    selectElement.appendChild(option);
                });
            }
        });
    }
}

/**
 * 스타일 가이드 정보를 표시하는 요소를 업데이트합니다.
 */
function updateStyleGuideInfo(styleGuideId, infoElementId) {
    const infoElement = document.getElementById(infoElementId);
    if (!infoElement || !styleGuideId) {
        if (infoElement) infoElement.style.display = 'none';
        return;
    }

    // 선택된 스타일 가이드 정보를 표시
    api.getStyleGuideDetail(styleGuideId)
        .then(styleGuide => {
            infoElement.innerHTML = `
                <div style="padding: 0.5rem; background: var(--pico-warning-background-color); border: 1px solid var(--pico-warning-border-color); border-radius: 6px; margin-top: 0.5rem;">
                    <strong>${styleGuide.title}</strong><br>
                    <small style="color: var(--pico-warning-text-color);">
                        ${styleGuide.description}<br>
                        카테고리: ${styleGuide.category} | 언어: ${styleGuide.language}
                    </small>
                </div>
            `;
            infoElement.style.display = 'block';
        })
        .catch(error => {
            console.error('스타일 가이드 정보 로드 실패:', error);
            infoElement.style.display = 'none';
        });
}

/**
 * Google AI API 키 형식을 검증하는 함수
 */
function isValidApiKeyFormat(apiKey) {
    // Google AI API 키는 일반적으로 "AIza"로 시작하며, 길이가 적절해야 함
    const googleApiKeyPattern = /^AIza[0-9A-Za-z_-]{35,}$/;
    return googleApiKeyPattern.test(apiKey);
}

/**
 * 디버깅용: 마지막으로 사용된 API 키 정보를 확인하는 함수
 */
async function debugLastApiKeyInfo() {
    try {
        const response = await fetch('/api/v1/generate/debug/last-api-key');
        const data = await response.json();

        console.group('🎯 [디버그] 마지막 API 키 사용 정보');
        console.log('📊 상태:', data.message || '정보 있음');
        console.log('🔑 키 타입:', data.key_type || 'N/A');
        console.log('👁️ 키 미리보기:', data.masked_key || 'N/A');
        console.log('📏 키 길이:', data.full_length || 'N/A', '자');
        console.log('🤖 모델:', data.model || 'N/A');
        console.log('👤 사용자 키 있음:', data.has_user_key ? '✅' : '❌');
        console.log('🖥️ 서버 키 있음:', data.has_server_key ? '✅' : '❌');
        console.log('⏰ 마지막 사용:', data.readable_timestamp || 'N/A');
        console.log('⏳ 경과 시간:', data.time_since || 'N/A');
        console.groupEnd();

        return data;
    } catch (error) {
        console.error('❌ 디버그 정보 조회 실패:', error);
        return null;
    }
}

/**
 * 디버깅용: 현재 저장된 사용자 API 키 상태 확인
 */
function debugCurrentUserApiKey() {
    const savedKey = localStorage.getItem('userApiKey');
    const isValidFormat = savedKey ? isValidApiKeyFormat(savedKey) : false;

    console.group('🔍 [디버그] 현재 사용자 API 키 상태');
    console.log('💾 저장된 키:', savedKey ? `${savedKey.substring(0, 10)}...${savedKey.substring(savedKey.length - 4)}` : '없음');
    console.log('✅ 형식 유효성:', isValidFormat ? '유효' : '무효');
    console.log('📏 키 길이:', savedKey ? savedKey.length + '자' : 'N/A');
    console.groupEnd();

    return { savedKey, isValidFormat };
}

/**
 * 사용자 API 키 관리를 초기화합니다.
 */
function initializeUserApiKey() {
    const apiKeyInput = document.getElementById('user-api-key-input');
    if (!apiKeyInput) {
        console.warn('사용자 API 키 입력 필드를 찾을 수 없습니다.');
        return;
    }

    // 페이지 로드 시 localStorage에서 API 키 불러오기
    const savedApiKey = localStorage.getItem('userApiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        // 저장된 키의 유효성 확인 및 UI 업데이트
        if (isValidApiKeyFormat(savedApiKey)) {
            apiKeyInput.classList.add('valid');
        } else {
            apiKeyInput.classList.add('invalid');
            console.warn('저장된 API 키 형식이 올바르지 않습니다.');
        }
    }

    // 입력 이벤트 리스너 추가 (디바운스 적용)
    let debounceTimer;
    apiKeyInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const apiKey = e.target.value.trim();

            // 기본적인 유효성 검증 및 UI 업데이트
            if (apiKey) {
                const isValid = isValidApiKeyFormat(apiKey);
                if (isValid) {
                    apiKeyInput.classList.remove('invalid');
                    apiKeyInput.classList.add('valid');
                    // 유효한 키 저장
                    localStorage.setItem('userApiKey', apiKey);
                    console.log('사용자 API 키가 저장되었습니다.');
                } else {
                    apiKeyInput.classList.remove('valid');
                    apiKeyInput.classList.add('invalid');
                    console.warn('API 키 형식이 올바르지 않습니다. Google AI API 키는 AIza로 시작해야 합니다.');
                    // 유효하지 않은 키는 저장하지 않음
                    return;
                }
            } else {
                // 빈 값일 경우 상태 초기화 및 저장된 키 삭제
                apiKeyInput.classList.remove('valid', 'invalid');
                localStorage.removeItem('userApiKey');
                console.log('사용자 API 키가 삭제되었습니다.');
            }
        }, 500); // 500ms 디바운스
    });

    // 입력 필드에 포커스/블러 이벤트로 사용자 피드백 제공
    apiKeyInput.addEventListener('focus', () => {
        apiKeyInput.placeholder = 'Google AI API 키를 입력하세요 (예: AIza...)';
    });

    apiKeyInput.addEventListener('blur', () => {
        apiKeyInput.placeholder = 'Google AI API 키를 입력하세요...';
    });

    // [추가] API 키가 유효하지 않다는 이벤트를 수신하여 처리합니다.
    document.addEventListener('invalidApiKeyDetected', () => {
        console.warn("잘못된 API 키가 감지되어 자동으로 삭제합니다.");
        const apiKeyInput = document.getElementById('user-api-key-input');
        if (apiKeyInput) {
            apiKeyInput.value = ''; // 입력 필드 비우기
            apiKeyInput.classList.remove('valid', 'invalid');
        }
        localStorage.removeItem('userApiKey'); // 저장된 키 삭제

        // 사용자에게 서버 기본 키로 전환되었음을 알립니다.
        if (window.app && window.app.ui && typeof window.app.ui.showToast === 'function') {
            window.app.ui.showToast('잘못된 API 키가 삭제되었습니다. 이제 서버 기본 키로 AI 기능이 동작합니다.', 'info', 5000);
        } else if (typeof showToast === 'function') {
            showToast('잘못된 API 키가 삭제되었습니다. 이제 서버 기본 키로 AI 기능이 동작합니다.', 'info', 5000);
        } else {
            alert('잘못된 API 키가 삭제되었습니다. 이제 서버 기본 키로 AI 기능이 동작합니다.');
        }
    });
}

// 리팩토링 완료: 모든 비즈니스 로직은 App.js와 StateManager로 이동됨
