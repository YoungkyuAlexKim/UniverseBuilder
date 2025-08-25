// FILE: modals.js

/**
 * 모든 모달 창의 생성, 표시, 소멸 로직을 담당하는 모듈
 */
import * as api from './api.js';

// DOM Elements
const cardDetailsModal = document.getElementById('card-details-modal');
const worldviewCardModal = document.getElementById('worldview-card-modal');
const diffModal = document.getElementById('ai-diff-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const aiScenarioDraftModal = document.getElementById('ai-scenario-draft-modal');
const plotPointEditModal = document.getElementById('plot-point-edit-modal');
const refineConceptModal = document.getElementById('refine-concept-modal'); 
const refineWorldviewRuleModal = document.getElementById('refine-worldview-rule-modal'); // [신규] 모달 요소 추가
const commonAiModal = document.getElementById('common-ai-modal'); // [신규] 공통 AI 모달 추가

// App 인스턴스를 저장할 변수
let app;

/**
 * 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeModals(appInstance) {
    app = appInstance;
}

export function closeModal() {
    // [개선] 닫을 모달 목록에 공통 AI 모달 추가
    [cardDetailsModal, worldviewCardModal, diffModal, modalBackdrop, aiScenarioDraftModal, plotPointEditModal, refineConceptModal, refineWorldviewRuleModal, commonAiModal].forEach(el => el.classList.remove('active'));
    cardDetailsModal.classList.remove('shifted');
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    
    // [수정] ESC 키 이벤트 리스너 제거
    document.removeEventListener('keydown', handleEscKey);
}

// [신규] ESC 키 처리 함수
function handleEscKey(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

export function openCardModal(card, projectId) {
    if (!card) return;
    document.getElementById('modal-card-name').innerHTML = card.name || '이름 없는 카드';
    const contentEl = document.getElementById('modal-card-content');

    const createListHTML = (title, items) => {
        if (!items || items.length === 0) return '';
        const listItems = Array.isArray(items) ? items : [items];
        return `
            <p><strong class="label">${title}:</strong></p>
            <ul>
                ${listItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
        `;
    };

    contentEl.innerHTML = `
        <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--pico-muted-border-color); padding-bottom: 1rem;">
            <button class="secondary outline" id="show-relationship-btn">📊 관계도 보기</button>
        </div>

        <div id="modal-desc">${card.description || ''}</div>
        <div style="margin-top: 0.5rem; min-height: 30px;">
            <button class="secondary outline highlight-btn" data-field="description" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">✨ 이름 하이라이팅</button>
            <div class="highlight-actions" id="highlight-actions-description" style="display: none; gap: 0.5rem;">
                <button class="secondary outline save-highlight-btn" data-field="description" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">💾 저장</button>
                <button class="secondary outline cancel-highlight-btn" data-field="description" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">↩️ 취소</button>
            </div>
        </div>

        ${createListHTML('성격', card.personality)}
        ${createListHTML('능력', card.abilities)}
        ${createListHTML('목표', card.goal)}
        ${createListHTML('대표 대사', card.quote)}
        
        ${card.introduction_story ? `
            <hr>
            <p><strong class="label">등장 서사:</strong></p>
            <div id="modal-story">${card.introduction_story}</div>
            <div style="margin-top: 0.5rem; min-height: 30px;">
                <button class="secondary outline highlight-btn" data-field="introduction_story" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">✨ 이름 하이라이팅</button>
                <div class="highlight-actions" id="highlight-actions-introduction_story" style="display: none; gap: 0.5rem;">
                    <button class="secondary outline save-highlight-btn" data-field="introduction_story" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">💾 저장</button>
                    <button class="secondary outline cancel-highlight-btn" data-field="introduction_story" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">↩️ 취소</button>
                </div>
            </div>
        ` : ''}
    `;

    contentEl.querySelector('#show-relationship-btn').addEventListener('click', (e) => {
        e.preventDefault();
        app.panels.showRelationshipPanel(projectId, card);
    });

    const footerEl = document.getElementById('modal-card-footer');
    footerEl.innerHTML = `
        <button id="modal-manual-edit-btn">수동으로 수정</button>
        <button class="secondary" id="modal-edit-ai-btn">AI로 수정</button>
        <button class="secondary outline" id="modal-delete-btn">삭제</button>
    `;

    footerEl.querySelector('#modal-manual-edit-btn').addEventListener('click', (e) => app.panels.handleManualEditCard(e, projectId, card.id));
    footerEl.querySelector('#modal-edit-ai-btn').addEventListener('click', (e) => app.panels.handleEditCardAI(e, projectId, card.id));
    footerEl.querySelector('#modal-delete-btn').addEventListener('click', (e) => {
        closeModal();
        // [수정] app.handleDeleteCard 호출
        app.handleDeleteCard(projectId, card.group_id, card.id);
    });
    
    contentEl.querySelectorAll('.highlight-btn').forEach(button => {
        button.addEventListener('click', (e) => handleHighlightClick(e, projectId, card.id));
    });

    // [수정] X 버튼 클릭 이벤트 리스너 추가
    const closeButton = cardDetailsModal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    // [수정] 모달 배경 클릭 이벤트 리스너 추가 (기존 이벤트 제거 후 추가)
    modalBackdrop.onclick = null; // 기존 이벤트 제거
    modalBackdrop.onclick = () => {
        closeModal();
    };

    // [수정] ESC 키 이벤트 리스너 추가
    document.addEventListener('keydown', handleEscKey);

    cardDetailsModal.classList.add('active');
    modalBackdrop.classList.add('active');
}

export function openWorldviewCardModal(card, projectId, groupId) {
    const form = document.getElementById('worldview-card-form');
    form.reset();
    form.dataset.cardId = card ? card.id : '';
    form.dataset.projectId = projectId;
    form.dataset.groupId = groupId;

    document.getElementById('worldview-modal-card-title').value = card?.title || '';
    document.getElementById('worldview-modal-card-content').value = card?.content || '';

    const existingFooter = form.querySelector('footer');
    if (existingFooter) existingFooter.remove();
    const existingButton = form.querySelector('button[type="submit"]');
    if(existingButton) existingButton.remove();

    const footer = document.createElement('footer');
    footer.innerHTML = `
        <div class="grid">
            <button id="wv-save-btn" type="submit">저장</button>
            <button id="wv-ai-edit-btn" class="secondary">AI로 수정</button>
        </div>
        <button id="wv-delete-btn" class="secondary outline" style="margin-top: 0.5rem;">삭제</button>
    `;
    form.appendChild(footer);

    footer.querySelector('#wv-ai-edit-btn').addEventListener('click', (e) => {
        e.preventDefault();
        // [수정] app.panels.handleEditWorldviewCardAI 호출
        app.panels.handleEditWorldviewCardAI(card, projectId);
    });
    footer.querySelector('#wv-delete-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        // [수정] app.handleDeleteWorldviewCard 호출
        await app.handleDeleteWorldviewCard(projectId, card.id);
    });

    // [수정] X 버튼 클릭 이벤트 리스너 추가 (세계관 카드 모달)
    const closeButton = worldviewCardModal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    // [수정] ESC 키 이벤트 리스너 추가
    document.addEventListener('keydown', handleEscKey);

    worldviewCardModal.classList.add('active');
    modalBackdrop.classList.add('active');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const button = footer.querySelector('#wv-save-btn');
        button.setAttribute('aria-busy', 'true');
        const cardId = form.dataset.cardId;
        const cardData = {
            title: form.elements.title.value,
            content: form.elements.content.value
        };

        try {
            await api.saveWorldviewCard(projectId, groupId, cardData, cardId);
            alert('설정 카드가 저장되었습니다.');
            closeModal();
            // [수정] stateManager를 통해 상태 갱신 요청
            await app.stateManager.refreshCurrentProject();
        } catch (error) {
            alert(error.message);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    };
}

export function showAiDiffModal(projectId, originalCard, aiResult, cardType) {
    const originalContainer = document.getElementById('ai-diff-original');
    const suggestionContainer = document.getElementById('ai-diff-suggestion');
    const acceptBtn = document.getElementById('ai-diff-accept-btn');
    const rejectBtn = document.getElementById('ai-diff-reject-btn');

    const suggestedCard = aiResult.updated_cards.find(c => c.id === originalCard.id);
    if (!suggestedCard) {
        alert("AI 응답에서 수정된 카드 정보를 찾을 수 없습니다.");
        return;
    }

    const fieldsToCompare = cardType === 'character' 
        ? ['name', 'description', 'personality', 'abilities', 'goal', 'quote', 'introduction_story']
        : ['title', 'content'];

    let originalHtml = '';
    let suggestionHtml = '';

    fieldsToCompare.forEach(field => {
        const originalValue = originalCard[field] || '';
        const suggestedValue = suggestedCard[field] || '';
        const originalText = Array.isArray(originalValue) ? originalValue.join('\n') : originalValue;
        const suggestedText = Array.isArray(suggestedValue) ? suggestedValue.join('\n') : suggestedValue;
        
        originalHtml += `<h6>${field}</h6><p>${originalText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
        suggestionHtml += `<h6>${field}</h6><div>${createDiffHtml(originalText, suggestedText)}</div>`;
    });
    
    originalContainer.innerHTML = originalHtml;
    suggestionContainer.innerHTML = suggestionHtml;
    
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
    const newRejectBtn = rejectBtn.cloneNode(true);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);

    newRejectBtn.onclick = () => {
        diffModal.classList.remove('active');
        modalBackdrop.classList.remove('active');
    };

    newAcceptBtn.onclick = async () => {
        newAcceptBtn.setAttribute('aria-busy', 'true');
        try {
            await api.applyAiSuggestion(projectId, aiResult.updated_cards, cardType);
            alert('AI의 수정 제안이 성공적으로 적용되었습니다!');
            diffModal.classList.remove('active');
            closeModal();
            // [수정] stateManager를 통해 상태 갱신 요청
            await app.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error("최종 적용 실패:", error);
            alert(error.message);
        } finally {
            newAcceptBtn.setAttribute('aria-busy', 'false');
        }
    };

    diffModal.classList.add('active');
    modalBackdrop.classList.add('active');
}

function createDiffHtml(text1, text2) {
    const tagMap = {};
    let placeholderIndex = 0;

    const textToCompare1 = text1.replace(/<span class="[^"]*">[^<]+<\/span>|<strong>[^<]+<\/strong>/g, (match) => {
        const placeholder = `__TAG_${placeholderIndex}__`;
        tagMap[placeholder] = match;
        placeholderIndex++;
        return placeholder;
    });

    const textToCompare2 = text2.replace(/<span class="[^"]*">[^<]+<\/span>|<strong>[^<]+<\/strong>/g, (match) => {
        const placeholder = `__TAG_${placeholderIndex}__`;
        tagMap[placeholder] = match;
        placeholderIndex++;
        return placeholder;
    });

    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(textToCompare1, textToCompare2);
    dmp.diff_cleanupSemantic(diff);
    
    let html = dmp.diff_prettyHtml(diff);

    html = html.replace(/__TAG_\d+__/g, (placeholder) => {
        return tagMap[placeholder] || placeholder;
    });

    return html;
}

async function handleHighlightClick(event, projectId, cardId) {
    const button = event.currentTarget;
    const fieldName = button.dataset.field;
    
    const textContainer = fieldName === 'description'
        ? document.getElementById('modal-desc')
        : document.getElementById('modal-story');

    if (!textContainer) return;
    
    const originalContent = textContainer.innerHTML;
    const textContent = textContainer.textContent;
    if (!textContent.trim()) {
        alert("하이라이팅할 텍스트가 없습니다.");
        return;
    }

    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    try {
        const result = await api.highlightCharacterNames(projectId, cardId, fieldName, textContent);
        textContainer.innerHTML = result.highlighted_text;
        
        toggleHighlightActions(fieldName, true, { projectId, cardId, originalContent });

    } catch (error) {
        console.error('이름 하이라이팅 실패:', error);
        alert(`이름 하이라이팅 중 오류가 발생했습니다: ${error.message}`);
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}

function toggleHighlightActions(fieldName, showActions, params = {}) {
    const highlightBtn = document.querySelector(`.highlight-btn[data-field="${fieldName}"]`);
    const actionsContainer = document.getElementById(`highlight-actions-${fieldName}`);
    
    if (showActions) {
        highlightBtn.style.display = 'none';
        actionsContainer.style.display = 'flex';

        const saveBtn = actionsContainer.querySelector('.save-highlight-btn');
        const cancelBtn = actionsContainer.querySelector('.cancel-highlight-btn');

        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', () => handleSaveHighlight(params.projectId, params.cardId, fieldName));

        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => handleCancelHighlight(fieldName, params.originalContent));
        
    } else {
        highlightBtn.style.display = 'inline-block';
        highlightBtn.setAttribute('aria-busy', 'false');
        highlightBtn.disabled = false;
        actionsContainer.style.display = 'none';
    }
}

async function handleSaveHighlight(projectId, cardId, fieldName) {
    const textContainer = fieldName === 'description'
        ? document.getElementById('modal-desc')
        : document.getElementById('modal-story');
    
    const saveBtn = document.querySelector(`.save-highlight-btn[data-field="${fieldName}"]`);
    saveBtn.setAttribute('aria-busy', 'true');
    
    const newContent = textContainer.innerHTML;
    const updateData = { id: cardId };
    updateData[fieldName] = newContent;

    try {
        await api.updateCard(projectId, cardId, updateData);
        alert('변경사항이 성공적으로 저장되었습니다.');
        toggleHighlightActions(fieldName, false);

        // [수정] stateManager를 통해 상태 갱신 요청
        app.stateManager.refreshCurrentProject();

    } catch (error) {
        console.error('하이라이트 저장 실패:', error);
        alert(`저장에 실패했습니다: ${error.message}`);
        saveBtn.setAttribute('aria-busy', 'false');
    }
}

function handleCancelHighlight(fieldName, originalContent) {
    const textContainer = fieldName === 'description'
        ? document.getElementById('modal-desc')
        : document.getElementById('modal-story');
    
    textContainer.innerHTML = originalContent;
    toggleHighlightActions(fieldName, false);
}

export function openPlotPointEditModal(plotPoint, projectId, scenarioId) {
    const form = document.getElementById('plot-point-edit-form');
    form.reset();
    form.elements.plot_point_id.value = plotPoint.id;
    form.elements.title.value = plotPoint.title || '';
    form.elements.content.value = plotPoint.content || '';
    
    const saveBtn = document.getElementById('plot-point-save-btn');
    const deleteBtn = document.getElementById('plot-point-delete-btn');
    const aiEditBtn = document.getElementById('plot-point-ai-edit-btn');
    
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    // [수정] app.handleUpdatePlotPoint 호출
    newSaveBtn.addEventListener('click', () => app.handleUpdatePlotPoint(form, projectId, scenarioId));
    
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    // [수정] app.handleDeletePlotPoint 호출
    newDeleteBtn.addEventListener('click', () => app.handleDeletePlotPoint(plotPoint.id, projectId, scenarioId));

    const newAiEditBtn = aiEditBtn.cloneNode(true);
    aiEditBtn.parentNode.replaceChild(newAiEditBtn, aiEditBtn);
    // [수정] app.handleAiEditPlotPoint 호출
    newAiEditBtn.addEventListener('click', () => app.handleAiEditPlotPoint(plotPoint, projectId, scenarioId));
    
    plotPointEditModal.classList.add('active');
    modalBackdrop.classList.add('active');
}

export function openRefineConceptModal(originalConcept, suggestedConcept, onAcceptCallback, onRerollCallback) {
    document.getElementById('refine-concept-original').textContent = originalConcept;
    updateRefineConceptSuggestion(suggestedConcept, onAcceptCallback);

    const rejectBtn = document.getElementById('refine-concept-reject-btn');
    const rerollBtn = document.getElementById('refine-concept-reroll-btn');

    const newRejectBtn = rejectBtn.cloneNode(true);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
    newRejectBtn.addEventListener('click', () => closeModal());

    const newRerollBtn = rerollBtn.cloneNode(true);
    rerollBtn.parentNode.replaceChild(newRerollBtn, rerollBtn);
    newRerollBtn.addEventListener('click', () => onRerollCallback());
    
    refineConceptModal.classList.add('active');
    modalBackdrop.classList.add('active');
}

export function updateRefineConceptSuggestion(suggestedConcept, onAcceptCallback) {
    document.getElementById('refine-concept-suggestion').textContent = suggestedConcept;

    const acceptBtn = document.getElementById('refine-concept-accept-btn');
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);

    newAcceptBtn.addEventListener('click', () => {
        onAcceptCallback(suggestedConcept);
    });
}

// [신규] 세계관 핵심 설정 다듬기 모달 열기 함수
export function openRefineWorldviewRuleModal(originalRule, suggestedRule, onAcceptCallback, onRerollCallback) {
    document.getElementById('refine-rule-original').textContent = originalRule;
    updateRefineWorldviewRuleSuggestion(suggestedRule, onAcceptCallback);

    const rejectBtn = document.getElementById('refine-rule-reject-btn');
    const rerollBtn = document.getElementById('refine-rule-reroll-btn');

    const newRejectBtn = rejectBtn.cloneNode(true);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
    newRejectBtn.addEventListener('click', () => closeModal());

    const newRerollBtn = rerollBtn.cloneNode(true);
    rerollBtn.parentNode.replaceChild(newRerollBtn, rerollBtn);
    newRerollBtn.addEventListener('click', () => onRerollCallback());
    
    refineWorldviewRuleModal.classList.add('active');
    modalBackdrop.classList.add('active');
}

// [신규] 세계관 핵심 설정 다듬기 모달 제안 내용 업데이트 함수
export function updateRefineWorldviewRuleSuggestion(suggestedRule, onAcceptCallback) {
    document.getElementById('refine-rule-suggestion').textContent = suggestedRule;

    const acceptBtn = document.getElementById('refine-rule-accept-btn');
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);

    newAcceptBtn.addEventListener('click', () => {
        onAcceptCallback(suggestedRule);
    });
}
