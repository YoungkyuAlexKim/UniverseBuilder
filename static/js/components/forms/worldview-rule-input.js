/**
 * 세계관 규칙 입력 필드 컴포넌트
 * 세계관 규칙 입력 필드 생성 및 관리를 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let app; // App 인스턴스를 저장할 변수
let eventManager; // EventListenerManager 인스턴스

/**
 * 모듈을 초기화하고 App 및 EventManager 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 * @param {EventListenerManager} eventManagerInstance - 이벤트 관리자 인스턴스
 */
export function initializeWorldviewRuleInput(appInstance, eventManagerInstance) {
    app = appInstance;
    eventManager = eventManagerInstance;
}

/**
 * 세계관 규칙 입력 필드를 추가합니다.
 * @param {string} value - 초기 값
 * @param {number} projectId - 프로젝트 ID
 * @param {HTMLElement} container - 입력 필드를 추가할 컨테이너
 */
export function addWorldviewRuleInput(value = '', projectId, container) {
    console.log('🔧 [디버그] addWorldviewRuleInput 함수 호출됨');
    console.log('🔧 [디버그] value:', value);
    console.log('🔧 [디버그] projectId:', projectId);
    console.log('🔧 [디버그] container:', container);
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-input-wrapper';
    wrapper.innerHTML = `
        <textarea name="rules" placeholder="세계관의 핵심 전제, 설정, 규칙..." rows="1" style="resize: vertical; min-height: 2.5rem; overflow: hidden;">${value}</textarea>
        <button type="button" class="secondary outline refine-rule-btn icon-only" title="AI로 문장 다듬기"><i data-lucide="wand-sparkles"></i></button>
        <button type="button" class="secondary outline remove-dynamic-input-btn icon-only" title="삭제"><i data-lucide="x"></i></button>
    `;
    container.appendChild(wrapper);
    lucide.createIcons();

    const inputField = wrapper.querySelector('textarea[name="rules"]');

    function adjustHeight() {
        inputField.style.height = 'auto';
        const computedStyle = window.getComputedStyle(inputField);
        const paddingTop = parseInt(computedStyle.paddingTop);
        const paddingBottom = parseInt(computedStyle.paddingBottom);
        const borderTop = parseInt(computedStyle.borderTopWidth);
        const borderBottom = parseInt(computedStyle.borderBottomWidth);

        const extraHeight = paddingTop + paddingBottom + borderTop + borderBottom + 8;
        const newHeight = Math.max(60, inputField.scrollHeight + extraHeight);

        inputField.style.height = newHeight + 'px';
    }

    adjustHeight();

    inputField.addEventListener('input', adjustHeight);
    inputField.addEventListener('change', adjustHeight);

    // 삭제 버튼에도 강화된 이벤트 리스너 적용
    const removeBtn = wrapper.querySelector('.remove-dynamic-input-btn');
    console.log('🔧 [디버그] remove-dynamic-input-btn 요소:', removeBtn);

    if (!removeBtn) {
        console.error('❌ [디버그] remove-dynamic-input-btn 요소를 찾을 수 없습니다!');
        return wrapper;
    }

    // 여러 이벤트 타입으로 리스너 등록 (삭제 버튼용)
    ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach(eventType => {
        removeBtn.addEventListener(eventType, (e) => {
            console.log(`🔧 [디버그] 삭제 버튼 ${eventType} 이벤트 발생!`);

            // 기본 동작 방지
            e.preventDefault();
            e.stopPropagation();

            console.log('🔧 [디버그] 삭제 이벤트 객체:', e);
            console.log('🔧 [디버그] 삭제 이벤트 타겟:', e.target);
            console.log('🔧 [디버그] 삭제 이벤트 현재 타겟:', e.currentTarget);

            // 버튼 상태 확인
            console.log('🔧 [디버그] 삭제 버튼 disabled:', removeBtn.disabled);
            console.log('🔧 [디버그] 삭제 버튼 pointer-events:', window.getComputedStyle(removeBtn).pointerEvents);
            console.log('🔧 [디버그] 삭제 버튼 display:', window.getComputedStyle(removeBtn).display);
            console.log('🔧 [디버그] 삭제 버튼 visibility:', window.getComputedStyle(removeBtn).visibility);

            if (removeBtn.disabled) {
                console.log('⚠️ [디버그] 삭제 버튼이 disabled 상태입니다.');
                return;
            }

            // 요소 삭제 실행
            console.log('🗑️ [디버그] 요소 삭제 실행');
            wrapper.remove();
            console.log('✅ [디버그] 요소 삭제 완료');

        }, { passive: false });
    });

    // 버튼 요소를 찾고 이벤트 리스너를 여러 방식으로 등록
    const refineBtn = wrapper.querySelector('.refine-rule-btn');
    console.log('🔧 [디버그] refine-rule-btn 요소:', refineBtn);

    if (!refineBtn) {
        console.error('❌ [디버그] refine-rule-btn 요소를 찾을 수 없습니다!');
        return wrapper;
    }

    // 여러 이벤트 타입으로 리스너 등록 (클릭 이벤트 강화)
    ['click', 'mousedown', 'mouseup', 'pointerdown'].forEach(eventType => {
        refineBtn.addEventListener(eventType, async (e) => {
            console.log(`🔧 [디버그] ${eventType} 이벤트 발생!`);

            // 기본 동작 방지
            e.preventDefault();
            e.stopPropagation();

            console.log('🔧 [디버그] 이벤트 객체:', e);
            console.log('🔧 [디버그] 이벤트 타겟:', e.target);
            console.log('🔧 [디버그] 이벤트 현재 타겟:', e.currentTarget);
            console.log('🔧 [디버그] app 객체:', window.app);
            console.log('🔧 [디버그] projectId:', projectId);
            console.log('🔧 [디버그] inputField:', inputField);
            console.log('🔧 [디버그] inputField.value:', inputField?.value);

            // 버튼 상태 확인
            console.log('🔧 [디버그] 버튼 disabled:', refineBtn.disabled);
            console.log('🔧 [디버그] 버튼 pointer-events:', window.getComputedStyle(refineBtn).pointerEvents);
            console.log('🔧 [디버그] 버튼 display:', window.getComputedStyle(refineBtn).display);
            console.log('🔧 [디버그] 버튼 visibility:', window.getComputedStyle(refineBtn).visibility);

            if (!window.app) {
                console.error('❌ [디버그] app 객체가 존재하지 않습니다.');
                alert('앱이 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
                return;
            }

            if (refineBtn.disabled) {
                console.log('⚠️ [디버그] 버튼이 disabled 상태입니다.');
                return;
            }

            // 컨트롤러 직접 호출
            try {
                const controller = window.app.controllers?.worldview;
                if (controller && typeof controller.handleRefineWorldviewRule === 'function') {
                    console.log('✅ [디버그] 컨트롤러 메소드 발견, 호출 시도');

                    // 버튼을 임시로 비활성화하여 중복 클릭 방지
                    refineBtn.disabled = true;
                    refineBtn.style.opacity = '0.6';

                    await controller.handleRefineWorldviewRule(e, projectId, inputField);
                    console.log('✅ [디버그] 컨트롤러 메소드 호출 완료');

                    // 버튼 다시 활성화
                    setTimeout(() => {
                        refineBtn.disabled = false;
                        refineBtn.style.opacity = '1';
                    }, 1000);

                } else {
                    console.error('❌ [디버그] worldview 컨트롤러 또는 handleRefineWorldviewRule 메소드를 찾을 수 없습니다.');
                    console.log('❌ [디버그] controller:', controller);
                    console.log('❌ [디버그] controller.handleRefineWorldviewRule:', controller?.handleRefineWorldviewRule);
                    alert('세계관 컨트롤러를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
                }
            } catch (error) {
                console.error('❌ [디버그] 컨트롤러 호출 중 오류:', error);

                // 에러 발생 시에도 버튼 다시 활성화
                refineBtn.disabled = false;
                refineBtn.style.opacity = '1';

                alert(`세계관 규칙 수정 중 오류가 발생했습니다: ${error.message}`);
            }
        }, { passive: false });
    });
}
