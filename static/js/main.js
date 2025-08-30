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

    // 스타일 가이드 선택 요소 초기화
    initializeStyleGuides();
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

/**
 * 스타일 가이드 선택 요소들을 초기화합니다.
 */
async function initializeStyleGuides() {
    try {
        // DOM 요소들이 로드될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));

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

        console.log('스타일 가이드 초기화 완료');
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
    console.log('폴백 스타일 가이드 초기화 시작');

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

    console.log(`폴백 스타일 가이드 초기화 완료: ${fallbackOptions.length}개 옵션 추가`);
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

        console.log(`${styleGuides.length}개의 스타일 가이드를 로드했습니다.`);
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

// 리팩토링 완료: 모든 비즈니스 로직은 App.js와 StateManager로 이동됨
