// FILE: worldview-editor.js
/**
 * 세계관 편집 패널의 생성 및 관리 로직을 담당하는 모듈
 */

import * as api from '../api.js';
import { showAiDiffModal } from '../modals.js';

// DOM Elements
const worldviewCardModal = document.getElementById('worldview-card-modal');

// App 인스턴스를 저장할 변수
let app;

/**
 * 세계관 편집 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeWorldviewEditor(appInstance) {
    app = appInstance;
}

/**
 * AI를 사용하여 세계관 카드를 편집하는 패널을 표시합니다.
 * @param {object} card - 편집할 세계관 카드
 * @param {string} projectId - 프로젝트 ID
 */
export function handleEditWorldviewCardAI(card, projectId) {
    if (!card) {
        alert("먼저 카드를 저장해야 AI 수정을 사용할 수 있습니다.");
        return;
    }

    const existingPanel = document.querySelector('.ai-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    let originalCard = null;
    for (const group of project.worldview_groups) {
        const foundCard = group.worldview_cards.find(c => c.id === card.id);
        if (foundCard) {
            originalCard = { ...foundCard, group_id: group.id };
            break;
        }
    }
    if (!originalCard) { alert('원본 설정 카드 데이터를 찾을 수 없습니다.'); return; }

    const panel = document.createElement('div');
    panel.className = 'ai-edit-panel';

    let worldviewCardCheckboxes = '';
    project.worldview_groups.forEach(group => {
        worldviewCardCheckboxes += `<fieldset><legend>${group.name}</legend>`;
        group.worldview_cards.forEach(c => {
            worldviewCardCheckboxes += `<label><input type="checkbox" name="selected_wv_cards" value="${c.id}" ${c.id === card.id ? 'checked disabled' : ''}>${c.title}</label>`;
        });
        worldviewCardCheckboxes += `</fieldset>`;
    });

    panel.innerHTML = `
        <article>
            <header style="display: flex; justify-content: space-between; align-items: center;"><hgroup style="margin-bottom: 0;"><h3><i data-lucide="wand-sparkles"></i>설정 카드 AI 수정</h3><p>수정 방향과 참고할 정보를 선택하세요.</p></hgroup><a href="#close" aria-label="Close" class="close"></a></header>
            <form id="ai-edit-wv-form" style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 80px);">
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                    <label for="prompt_text"><strong>요청사항 (프롬프트)</strong></label>
                    <textarea id="prompt_text" name="prompt_text" placeholder="예: 이 설정을 좀 더 전문적인 톤으로 수정해줘." required rows="3"></textarea>
                    <strong>참고할 다른 설정 카드 선택</strong>
                    <div class="checkbox-container">${worldviewCardCheckboxes}</div>
                    <fieldset><legend><strong>메인 세계관 반영 강도</strong></legend><div class="grid" style="grid-template-columns: 1fr 1fr;"><label><input type="radio" name="worldview-level" value="none" checked> 최소</label><label><input type="radio" name="worldview-level" value="low"> 낮음</label><label><input type="radio" name="worldview-level" value="medium"> 중간</label><label><input type="radio" name="worldview-level" value="high"> 높음</label></div></fieldset>
                    <fieldset><label for="edit_related_cards"><input type="checkbox" id="edit_related_cards" name="edit_related_cards"><strong>선택한 연관 설정 함께 수정하기</strong><small>(체크 해제 시, 참고만 하고 수정하지 않습니다)</small></label></fieldset>
                </div>
                <footer style="flex-shrink: 0;"><button type="submit" id="submit-ai-edit-wv"><i data-lucide="lightbulb"></i>수정 제안 받기</button></footer>
            </form>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        worldviewCardModal.classList.add('shifted');
        lucide.createIcons();
    }, 10);

    const closePanel = () => {
        panel.classList.remove('active');
        worldviewCardModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };

    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    panel.querySelector('#ai-edit-wv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.currentTarget.querySelector('#submit-ai-edit-wv');
        submitButton.setAttribute('aria-busy', 'true');
        const formData = new FormData(e.currentTarget);
        const selectedCards = Array.from(panel.querySelectorAll('input[name="selected_wv_cards"]:checked')).map(cb => cb.value);

        try {
            const requestBody = {
                prompt_text: formData.get('prompt_text'),
                model_name: document.getElementById('ai-model-select').value,
                selected_card_ids: selectedCards,
                worldview_level: formData.get('worldview-level'),
                edit_related_cards: formData.get('edit_related_cards') === 'on'
            };
            const aiResult = await api.fetchAiWorldviewEdit(projectId, card.id, requestBody);
            closePanel();
            showAiDiffModal(projectId, originalCard, aiResult, 'worldview');

        } catch (error) {
            console.error('AI 수정 제안 생성 실패:', error);
            alert(error.message);
        } finally {
            submitButton.setAttribute('aria-busy', 'false');
        }
    });
}
