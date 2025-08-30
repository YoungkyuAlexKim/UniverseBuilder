import { App } from './core/App.js';
import { initializeValidationMessage, isValidationMessageReady } from './components/validation/validation-message.js';
import { initializeValidationUtils, isValidationUtilsReady, ValidationHelpers } from './components/validation/validation-utils.js';

// App 인스턴스를 생성하여 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    // 애플리케이션 초기화
    const app = new App();

    // 유효성 검사 컴포넌트 초기화 (안전하게 초기화)
    setTimeout(() => {
        try {
            // eventManager가 준비되었는지 확인 후 초기화
            if (app && app.eventManager) {
                initializeValidationMessage(app.eventManager);
                initializeValidationUtils(app, app.eventManager);

                // 초기화가 성공했는지 확인
                if (isValidationMessageReady() && isValidationUtilsReady()) {
                    setupRealTimeValidation(app);
                }
            }
        } catch (error) {
            console.warn('유효성 검사 컴포넌트 초기화 실패:', error);
            // 유효성 검사 없이 앱은 계속 실행됨
        }
    }, 500); // 앱이 완전히 초기화될 시간을 줌

    // 사이드바 리사이즈 기능 초기화
    initResizableSidebar();

    // AI 모델 토글 카드 기능 초기화
    initAiModelToggle();
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

        // 시나리오 폼에 실시간 검증 추가 (DOM이 준비된 후)
        setTimeout(() => {
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
        }, 1000); // DOM이 완전히 로드될 때까지 대기
    } catch (error) {
        console.warn('실시간 검증 초기화 중 오류:', error);
    }
}

// 리팩토링 완료: 모든 비즈니스 로직은 App.js와 StateManager로 이동됨
