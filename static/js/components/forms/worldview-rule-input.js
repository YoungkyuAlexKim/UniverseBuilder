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

    wrapper.querySelector('.remove-dynamic-input-btn').addEventListener('click', () => {
        wrapper.remove();
    });

    wrapper.querySelector('.refine-rule-btn').addEventListener('click', (e) => {
        app.handleRefineWorldviewRule(e, projectId, inputField);
    });
}
