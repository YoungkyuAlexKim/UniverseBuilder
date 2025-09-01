/**
 * AI 시나리오 초안 모달 컴포넌트
 * AI 시나리오 초안 생성 모달을 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let app; // App 인스턴스를 저장할 변수

/**
 * 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeAiScenarioDraftModal(appInstance) {
    app = appInstance;
}

/**
 * AI 시나리오 초안 생성 모달을 엽니다.
 * @param {object} projectData - 프로젝트 데이터
 * @param {number} scenarioId - 시나리오 ID
 */
export function openAiScenarioDraftModal(projectData, scenarioId) {
    const modal = document.getElementById('ai-scenario-draft-modal');
    const form = document.getElementById('ai-scenario-draft-form');
    const charactersContainer = document.getElementById('scenario-characters-container');
    const modalBackdrop = document.getElementById('modal-backdrop');

    const slider = form.querySelector('#plot-point-count');
    const sliderValueDisplay = form.querySelector('#plot-point-count-value');

    slider.addEventListener('input', () => {
        sliderValueDisplay.textContent = slider.value;
    });

    const allCharacters = projectData.groups.flatMap(g => g.cards);
    if (allCharacters.length > 0) {
        charactersContainer.innerHTML = allCharacters.map(char => `
            <label>
                <input type="checkbox" name="character_ids" value="${char.id}">
                ${char.name}
            </label>
        `).join('');
    } else {
        charactersContainer.innerHTML = '<p>이 프로젝트에는 캐릭터가 없습니다.</p>';
    }

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    const newSlider = newForm.querySelector('#plot-point-count');
    const newSliderValueDisplay = newForm.querySelector('#plot-point-count-value');
    newSlider.addEventListener('input', () => {
        newSliderValueDisplay.textContent = newSlider.value;
    });
    newSliderValueDisplay.textContent = newSlider.value;


    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        app.call('scenario', 'handleAiDraftGeneration', e, projectData.id, scenarioId);
    });

    const closeButton = modal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            app.modals.closeModal();
        });
    }

    modal.classList.add('active');
    modalBackdrop.classList.add('active');
}
