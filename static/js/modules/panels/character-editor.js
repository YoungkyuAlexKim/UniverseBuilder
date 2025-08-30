// FILE: character-editor.js
/**
 * 캐릭터 편집 패널의 생성 및 관리 로직을 담당하는 모듈
 */

import * as api from '../api.js';
import * as ui from '../ui.js';
import { showAiDiffModal, closeModal } from '../modals.js';

// DOM Elements
const cardDetailsModal = document.getElementById('card-details-modal');

// App 인스턴스를 저장할 변수
let app;

/**
 * 캐릭터 편집 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeCharacterEditor(appInstance) {
    app = appInstance;
}

/**
 * AI를 사용하여 캐릭터를 편집하는 패널을 표시합니다.
 * @param {Event} event - 클릭 이벤트
 * @param {string} projectId - 프로젝트 ID
 * @param {string} cardId - 편집할 캐릭터 ID
 */
export function handleEditCardAI(event, projectId, cardId) {
    const existingPanel = document.querySelector('.ai-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    let originalCard = null;
    for (const group of project.groups) {
        const foundCard = group.cards.find(c => c.id === cardId);
        if (foundCard) {
            originalCard = { ...foundCard, group_id: group.id };
            break;
        }
    }
    if (!originalCard) { alert('원본 카드 데이터를 찾을 수 없습니다.'); return; }

    const panel = document.createElement('div');
    panel.className = 'ai-edit-panel';

    let characterCheckboxes = '';
    project.groups.forEach(group => {
        characterCheckboxes += `<fieldset><legend>${group.name}</legend>`;
        group.cards.forEach(card => {
            characterCheckboxes += `<label><input type="checkbox" name="selected_cards" value="${card.id}" ${card.id === cardId ? 'checked disabled' : ''}>${card.name}</label>`;
        });
        characterCheckboxes += `</fieldset>`;
    });

    panel.innerHTML = `
        <article>
            <header style="display: flex; justify-content: space-between; align-items: center;"><hgroup style="margin-bottom: 0;"><h3><i data-lucide="wand-sparkles"></i>AI 수정 옵션</h3><p>수정 방향과 참고할 정보를 선택하세요.</p></hgroup><a href="#close" aria-label="Close" class="close"></a></header>
            <form id="ai-edit-form" style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 80px);">
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                    <label for="prompt_text"><strong>요청사항 (프롬프트)</strong></label>
                    <textarea id="prompt_text" name="prompt_text" placeholder="예: 이 캐릭터의 성격을 열혈한 성격으로 바꿔줘." required rows="3"></textarea>
                    <strong>참고할 캐릭터 선택</strong>
                    <div class="checkbox-container">${characterCheckboxes}</div>
                    <fieldset><legend><strong>세계관 설정 반영 강도</strong></legend><div class="grid" style="grid-template-columns: 1fr 1fr;"><label><input type="radio" name="worldview-level" value="none" checked> 최소</label><label><input type="radio" name="worldview-level" value="low"> 낮음</label><label><input type="radio" name="worldview-level" value="medium"> 중간</label><label><input type="radio" name="worldview-level" value="high"> 높음</label></div></fieldset>
                    <fieldset><label for="edit_related_characters"><input type="checkbox" id="edit_related_characters" name="edit_related_characters"><strong>선택한 연관 캐릭터 함께 수정하기</strong><small>(체크 해제 시, 참고만 하고 수정하지 않습니다)</small></label></fieldset>
                </div>
                <footer style="flex-shrink: 0;"><button type="submit" id="submit-ai-edit"><i data-lucide="lightbulb"></i>수정 제안 받기</button></footer>
            </form>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        cardDetailsModal.classList.add('shifted');
        lucide.createIcons();
    }, 10);

    const closePanel = () => {
        panel.classList.remove('active');
        cardDetailsModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };

    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    panel.querySelector('#ai-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.currentTarget.querySelector('#submit-ai-edit');
        submitButton.setAttribute('aria-busy', 'true');
        const formData = new FormData(e.currentTarget);
        const selectedCards = Array.from(panel.querySelectorAll('input[name="selected_cards"]:checked')).map(cb => cb.value);

        try {
            const requestBody = {
                prompt_text: formData.get('prompt_text'),
                model_name: document.getElementById('ai-model-select').value,
                selected_card_ids: selectedCards,
                worldview_level: formData.get('worldview-level'),
                edit_related_characters: formData.get('edit_related_characters') === 'on'
            };
            const aiResult = await api.fetchAiCharacterEdit(projectId, cardId, requestBody);

            closePanel();
            showAiDiffModal(projectId, originalCard, aiResult, 'character');

        } catch (error) {
            console.error('AI 수정 제안 생성 실패:', error);
            alert(error.message);
        } finally {
            submitButton.setAttribute('aria-busy', 'false');
        }
    });
}

/**
 * 캐릭터를 수동으로 편집하는 패널을 표시합니다.
 * @param {Event} event - 클릭 이벤트
 * @param {string} projectId - 프로젝트 ID
 * @param {string} cardId - 편집할 캐릭터 ID
 */
export function handleManualEditCard(event, projectId, cardId) {
    event.preventDefault();
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    let originalCard = null;
    for (const group of project.groups) {
        const foundCard = group.cards.find(c => c.id === cardId);
        if (foundCard) {
            originalCard = { ...foundCard, group_id: group.id };
            break;
        }
    }
    if (!originalCard) { alert('원본 카드 데이터를 찾을 수 없습니다.'); return; }

    const panel = document.createElement('div');
    panel.className = 'manual-edit-panel';

    panel.innerHTML = `
        <article>
            <header style="display: flex; justify-content: space-between; align-items: center;">
                <hgroup style="margin-bottom: 0;">
                    <h3><i data-lucide="pencil"></i>캐릭터 정보 수동 편집</h3>
                    <p>${originalCard.name}의 정보를 직접 수정합니다.</p>
                </hgroup>
                <a href="#close" aria-label="Close" class="close"></a>
            </header>
            <form id="manual-edit-form" style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 80px);">
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1.2rem; overflow-y: auto; padding-right: 1rem;">
                    <label for="manual-edit-name"><strong>이름</strong></label>
                    <input type="text" id="manual-edit-name" name="name" value="${originalCard.name || ''}" required>

                    <label for="manual-edit-description"><strong>설명</strong></label>
                    <textarea id="manual-edit-description" name="description" rows="4">${originalCard.description || ''}</textarea>

                    ${ui.createDynamicInputGroupHTML('personality', '성격', originalCard.personality)}
                    ${ui.createDynamicInputGroupHTML('abilities', '능력', originalCard.abilities)}
                    ${ui.createDynamicInputGroupHTML('goal', '목표', originalCard.goal)}
                    ${ui.createDynamicInputGroupHTML('quote', '대표 대사', originalCard.quote)}

                    <label for="manual-edit-story"><strong>등장 서사</strong></label>
                    <textarea id="manual-edit-story" name="introduction_story" rows="5">${originalCard.introduction_story || ''}</textarea>
                </div>
                <footer style="flex-shrink: 0;">
                    <button type="submit" id="submit-manual-edit"><i data-lucide="save"></i>변경사항 저장</button>
                </footer>
            </form>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        cardDetailsModal.classList.add('shifted');
        lucide.createIcons();
    }, 10);

    const closePanel = () => {
        panel.classList.remove('active');
        cardDetailsModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };

    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    panel.querySelectorAll('.add-dynamic-input-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const field = e.target.dataset.field;
            const container = panel.querySelector(`#dynamic-input-container-${field}`);
            const newIndex = container.children.length;
            ui.addDynamicInputField(container, field, '', newIndex);
        });
    });

    panel.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-dynamic-input-btn')) {
            e.target.closest('.dynamic-input-wrapper').remove();
        }
    });

    panel.querySelector('#manual-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const submitButton = form.querySelector('#submit-manual-edit');
        submitButton.setAttribute('aria-busy', 'true');

        const getDynamicFieldValues = (form, fieldName) => {
            const elements = form.elements[fieldName];
            if (!elements) return [];
            const elementsArray = elements.length !== undefined ? Array.from(elements) : [elements];
            return elementsArray.map(input => input.value).filter(Boolean);
        };

        const updatedCardData = {
            id: cardId,
            name: form.elements.name.value,
            description: form.elements.description.value,
            introduction_story: form.elements.introduction_story.value,
            personality: getDynamicFieldValues(form, 'personality'),
            abilities: getDynamicFieldValues(form, 'abilities'),
            goal: getDynamicFieldValues(form, 'goal'),
            quote: getDynamicFieldValues(form, 'quote')
        };

        try {
            await api.updateCard(projectId, cardId, updatedCardData);
            alert('캐릭터 정보가 성공적으로 업데이트되었습니다.');
            closePanel();
            closeModal(); // [수정] app.modals를 통해 호출
            // [수정] stateManager를 통해 상태 갱신 요청
            await app.stateManager.refreshCurrentProject();

        } catch (error) {
            console.error('수동 편집 저장 실패:', error);
            alert(`저장에 실패했습니다: ${error.message}`);
        } finally {
            submitButton.setAttribute('aria-busy', 'false');
        }
    });
}
