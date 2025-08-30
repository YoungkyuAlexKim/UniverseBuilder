/**
 * 동적 입력 필드 컴포넌트
 * 동적 입력 필드 생성 및 관리를 담당하는 모듈
 */

/**
 * 동적 입력 필드 그룹의 HTML을 생성합니다.
 * @param {string} field - 필드 이름
 * @param {string} label - 라벨 텍스트
 * @param {Array} values - 초기 값들의 배열
 * @returns {string} 생성된 HTML 문자열
 */
export function createDynamicInputGroupHTML(field, label, values = []) {
    let inputsHTML = (Array.isArray(values) ? values : [values].filter(Boolean))
        .map((value, index) => `
            <div class="dynamic-input-wrapper">
                <input type="text" name="${field}" value="${value || ''}" data-index="${index}">
                <button type="button" class="secondary outline remove-dynamic-input-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✕</button>
            </div>
        `).join('');

    return `
        <div>
            <strong>${label}</strong>
            <div id="dynamic-input-container-${field}" class="dynamic-input-container">${inputsHTML}</div>
            <button type="button" class="secondary outline add-dynamic-input-btn" data-field="${field}" style="margin-top: 0.5rem; width: 100%;">+ ${label} 추가</button>
        </div>
    `;
}

/**
 * 동적 입력 필드를 추가합니다.
 * @param {HTMLElement} container - 입력 필드를 추가할 컨테이너
 * @param {string} field - 필드 이름
 * @param {string} value - 초기 값
 * @param {number} index - 필드 인덱스
 */
export function addDynamicInputField(container, field, value = '', index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-input-wrapper';
    wrapper.innerHTML = `
        <input type="text" name="${field}" value="${value}" data-index="${index}">
        <button type="button" class="secondary outline remove-dynamic-input-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✕</button>
    `;
    container.appendChild(wrapper);
}
