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

// Handlers from main.js
let handleManualEditCard, handleEditCardAI, handleDeleteCard, handleEditWorldviewCardAI, handleDeleteWorldviewCard, showProjectDetails, showRelationshipPanel;

// Public Functions
export function initializeModals(handlers) {
    handleManualEditCard = handlers.handleManualEditCard;
    handleEditCardAI = handlers.handleEditCardAI;
    handleDeleteCard = handlers.handleDeleteCard;
    handleEditWorldviewCardAI = handlers.handleEditWorldviewCardAI;
    handleDeleteWorldviewCard = handlers.handleDeleteWorldviewCard;
    showProjectDetails = handlers.showProjectDetails;
    showRelationshipPanel = handlers.showRelationshipPanel; // [신규] 관계도 패널 핸들러 추가
}

export function closeModal() {
    [cardDetailsModal, worldviewCardModal, diffModal, modalBackdrop].forEach(el => el.classList.remove('active'));
    cardDetailsModal.classList.remove('shifted');
    // [수정] 관계도 패널도 닫히도록 클래스 추가
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
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
        <!-- [신규] 관계도 보기 버튼 추가 -->
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

    // [신규] 관계도 보기 버튼 이벤트 리스너 추가
    contentEl.querySelector('#show-relationship-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showRelationshipPanel(projectId, card);
    });

    const footerEl = document.getElementById('modal-card-footer');
    footerEl.innerHTML = `
        <button id="modal-manual-edit-btn">수동으로 수정</button>
        <button class="secondary" id="modal-edit-ai-btn">AI로 수정</button>
        <button class="secondary outline" id="modal-delete-btn">삭제</button>
    `;

    footerEl.querySelector('#modal-manual-edit-btn').addEventListener('click', (e) => handleManualEditCard(e, projectId, card.id));
    footerEl.querySelector('#modal-edit-ai-btn').addEventListener('click', (e) => handleEditCardAI(e, projectId, card.id));
    footerEl.querySelector('#modal-delete-btn').addEventListener('click', (e) => {
        closeModal();
        handleDeleteCard(e, projectId, card.group_id, card.id);
    });
    
    contentEl.querySelectorAll('.highlight-btn').forEach(button => {
        button.addEventListener('click', (e) => handleHighlightClick(e, projectId, card.id));
    });

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
        handleEditWorldviewCardAI(card, projectId);
    });
    footer.querySelector('#wv-delete-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await handleDeleteWorldviewCard(projectId, card.id);
    });

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
            await showProjectDetails(projectId);
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
            await showProjectDetails(projectId);
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

        showProjectDetails(projectId);

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