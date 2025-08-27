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
const refineWorldviewRuleModal = document.getElementById('refine-worldview-rule-modal');
const commonAiModal = document.getElementById('common-ai-modal');
// [신규] 플롯 포인트 비교 모달을 위한 DOM 요소 추가
const plotPointsDiffModal = document.getElementById('plot-points-diff-modal');


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
    [cardDetailsModal, worldviewCardModal, diffModal, modalBackdrop, aiScenarioDraftModal, plotPointEditModal, refineConceptModal, refineWorldviewRuleModal, commonAiModal, plotPointsDiffModal].forEach(el => {
        if (el) el.classList.remove('active');
    });
    cardDetailsModal.classList.remove('shifted');
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    
    document.removeEventListener('keydown', handleEscKey);
}

function handleEscKey(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

/**
 * [신규] AI가 수정한 전체 플롯 포인트를 비교하는 모달을 엽니다.
 * @param {Array} originalPlots - 원본 플롯 포인트 배열
 * @param {Array} suggestedPlots - AI가 제안한 플롯 포인트 배열
 * @param {Function} onAcceptCallback - '적용' 버튼 클릭 시 실행될 콜백 함수
 */
export function openPlotPointsDiffModal(originalPlots, suggestedPlots, onAcceptCallback) {
    const originalContainer = document.getElementById('plot-points-diff-original');
    const suggestionContainer = document.getElementById('plot-points-diff-suggestion');
    const acceptBtn = document.getElementById('plot-points-diff-accept-btn');
    const rejectBtn = document.getElementById('plot-points-diff-reject-btn');

    const renderPlots = (plots) => {
        return plots.map((plot, index) => `
            <article class="plot-point-item" data-index="${index}">
                <h6>${index + 1}. ${plot.title}</h6>
                <p>${plot.content || '세부 내용 없음'}</p>
            </article>
        `).join('');
    };
    
    originalContainer.innerHTML = renderPlots(originalPlots);
    suggestionContainer.innerHTML = renderPlots(suggestedPlots);

    // 변경된 부분 하이라이트
    suggestedPlots.forEach((plot, index) => {
        const originalPlot = originalPlots[index];
        if (!originalPlot || originalPlot.title !== plot.title || originalPlot.content !== plot.content) {
            const suggestedArticle = suggestionContainer.querySelector(`article[data-index="${index}"]`);
            if (suggestedArticle) {
                suggestedArticle.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                suggestedArticle.style.border = '1px solid rgba(245, 158, 11, 0.5)';
            }
        }
    });
    
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
    newAcceptBtn.addEventListener('click', () => onAcceptCallback(suggestedPlots));

    const newRejectBtn = rejectBtn.cloneNode(true);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
    newRejectBtn.addEventListener('click', () => closeModal());

    const closeButton = plotPointsDiffModal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    plotPointsDiffModal.classList.add('active');
    modalBackdrop.classList.add('active');
}


export function openCardModal(card, projectId) {
    if (!card) return;
    document.getElementById('modal-card-name').innerHTML = card.name || '이름 없는 캐릭터';
    const contentEl = document.getElementById('modal-card-content');

    // 태그 HTML 생성 함수
    const createTagsHTML = (items, tagClass) => {
        if (!items || items.length === 0) return '';
        const itemsArray = Array.isArray(items) ? items : [items];
        return itemsArray.map(item => `<span class="character-modal-tag ${tagClass}">${item}</span>`).join('');
    };

    // 대사 HTML 생성 함수
    const createQuotesHTML = (quotes) => {
        if (!quotes || quotes.length === 0) return '';
        const quotesArray = Array.isArray(quotes) ? quotes : [quotes];
        return quotesArray.map(quote => `<div class="character-quote-item">"${quote}"</div>`).join('');
    };

    contentEl.innerHTML = `
        <div class="character-modal-layout">
            <!-- 상단 액션 버튼 -->
            <div class="character-modal-actions">
                <button class="secondary outline" id="show-relationship-btn">📊 관계도 보기</button>
            </div>

            <!-- 기본 정보 섹션 -->
            <div class="character-modal-section">
                <h4 class="character-modal-section-title">기본 정보</h4>
                <div class="character-modal-description" id="modal-desc">${card.description || '캐릭터 설명이 없습니다.'}</div>
                <div class="character-highlight-controls">
                    <button class="secondary outline highlight-btn" data-field="description">✨ 이름 하이라이팅</button>
                    <div class="highlight-actions" id="highlight-actions-description" style="display: none;">
                        <button class="secondary outline save-highlight-btn" data-field="description">💾 저장</button>
                        <button class="secondary outline cancel-highlight-btn" data-field="description">↩️ 취소</button>
                    </div>
                </div>
            </div>

            <!-- 특성 태그 섹션 -->
            ${(card.personality && card.personality.length > 0) || (card.abilities && card.abilities.length > 0) ? `
                <div class="character-modal-section">
                    <h4 class="character-modal-section-title">특성</h4>
                    <div class="character-modal-tags-container">
                        ${createTagsHTML(card.personality, 'personality-tag')}
                        ${createTagsHTML(card.abilities, 'ability-tag')}
                    </div>
                </div>
            ` : ''}

            <!-- 목표 섹션 -->
            ${card.goal && card.goal.length > 0 ? `
                <div class="character-modal-section">
                    <h4 class="character-modal-section-title">목표</h4>
                    <div class="character-modal-goals">
                        ${Array.isArray(card.goal) ? card.goal.map(g => `<div class="character-goal-item">${g}</div>`).join('') : `<div class="character-goal-item">${card.goal}</div>`}
                    </div>
                </div>
            ` : ''}

            <!-- 대표 대사 섹션 -->
            ${card.quote && card.quote.length > 0 ? `
                <div class="character-modal-section">
                    <h4 class="character-modal-section-title">대표 대사</h4>
                    <div class="character-modal-quotes">
                        ${createQuotesHTML(card.quote)}
                    </div>
                </div>
            ` : ''}

            <!-- 등장 서사 섹션 -->
            ${card.introduction_story ? `
                <div class="character-modal-section character-modal-story-section">
                    <h4 class="character-modal-section-title">등장 서사</h4>
                    <div class="character-modal-story" id="modal-story">${card.introduction_story}</div>
                    <div class="character-highlight-controls">
                        <button class="secondary outline highlight-btn" data-field="introduction_story">✨ 이름 하이라이팅</button>
                        <div class="highlight-actions" id="highlight-actions-introduction_story" style="display: none;">
                            <button class="secondary outline save-highlight-btn" data-field="introduction_story">💾 저장</button>
                            <button class="secondary outline cancel-highlight-btn" data-field="introduction_story">↩️ 취소</button>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
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
        app.handleDeleteCard(projectId, card.group_id, card.id);
    });
    
    contentEl.querySelectorAll('.highlight-btn').forEach(button => {
        button.addEventListener('click', (e) => handleHighlightClick(e, projectId, card.id));
    });

    const closeButton = cardDetailsModal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    modalBackdrop.onclick = null;
    modalBackdrop.onclick = () => {
        closeModal();
    };

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
        app.panels.handleEditWorldviewCardAI(card, projectId);
    });
    footer.querySelector('#wv-delete-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await app.handleDeleteWorldviewCard(projectId, card.id);
    });

    const closeButton = worldviewCardModal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

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
    const modalArticle = plotPointEditModal.querySelector('article');
    const form = document.getElementById('plot-point-edit-form');
    form.reset();
    form.elements.plot_point_id.value = plotPoint.id;
    form.elements.title.value = plotPoint.title || '';
    form.elements.content.value = plotPoint.content || '';
    form.elements.scene_draft.value = plotPoint.scene_draft || '';
    
    const saveBtn = document.getElementById('plot-point-save-btn');
    const deleteBtn = document.getElementById('plot-point-delete-btn');
    const aiSceneBtn = document.getElementById('plot-point-ai-scene-btn');
    const aiEditBtn = document.getElementById('plot-point-ai-edit-btn');
    
    // 이벤트 리스너를 안전하게 다시 연결하기 위해 cloneNode 사용
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', () => app.handleUpdatePlotPoint(form, projectId, scenarioId));
    
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => app.handleDeletePlotPoint(plotPoint.id, projectId, scenarioId));

    const newAiSceneBtn = aiSceneBtn.cloneNode(true);
    aiSceneBtn.parentNode.replaceChild(newAiSceneBtn, aiSceneBtn);
    newAiSceneBtn.addEventListener('click', () => app.handleAiSceneGeneration(plotPoint.id, projectId, scenarioId));
    
    const newAiEditBtn = aiEditBtn.cloneNode(true);
    aiEditBtn.parentNode.replaceChild(newAiEditBtn, aiEditBtn);
    newAiEditBtn.addEventListener('click', () => app.handleAiSceneEdit(plotPoint.id, projectId, scenarioId));
    
    // 글자 수 슬라이더 이벤트 리스너 설정
    const wordCountSlider = document.getElementById('word-count-slider');
    const wordCountLabel = document.getElementById('word-count-label');
    if (wordCountSlider && wordCountLabel) {
        const updateWordCountLabel = () => {
            const labels = ['짧게 (약 1000자)', '중간 (약 2000자)', '길게 (약 3000자)'];
            wordCountLabel.textContent = labels[parseInt(wordCountSlider.value)];
        };
        
        const newSlider = wordCountSlider.cloneNode(true);
        wordCountSlider.parentNode.replaceChild(newSlider, wordCountSlider);
        newSlider.addEventListener('input', updateWordCountLabel);
        updateWordCountLabel(); // 초기값 설정
    }
    
    // 캐릭터 선택 UI 설정
    setupCharacterSelection(projectId);
    
    // 전체 선택/해제 버튼 이벤트 리스너
    const selectAllBtn = document.getElementById('select-all-characters');
    const deselectAllBtn = document.getElementById('deselect-all-characters');
    if (selectAllBtn && deselectAllBtn) {
        const newSelectAllBtn = selectAllBtn.cloneNode(true);
        const newDeselectAllBtn = deselectAllBtn.cloneNode(true);
        selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);
        deselectAllBtn.parentNode.replaceChild(newDeselectAllBtn, deselectAllBtn);
        
        newSelectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#plot-point-character-selection input[type="checkbox"]')
                .forEach(checkbox => checkbox.checked = true);
        });
        
        newDeselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#plot-point-character-selection input[type="checkbox"]')
                .forEach(checkbox => checkbox.checked = false);
        });
    }
    
    // 모달 닫기 이벤트 리스너
    const closeButton = plotPointEditModal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    modalBackdrop.onclick = null;
    modalBackdrop.onclick = () => {
        closeModal();
    };

    document.addEventListener('keydown', handleEscKey);

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

export function updateRefineWorldviewRuleSuggestion(suggestedRule, onAcceptCallback) {
    document.getElementById('refine-rule-suggestion').textContent = suggestedRule;

    const acceptBtn = document.getElementById('refine-rule-accept-btn');
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);

    newAcceptBtn.addEventListener('click', () => {
        onAcceptCallback(suggestedRule);
    });
}

function setupCharacterSelection(projectId) {
    const characterContainer = document.getElementById('plot-point-character-selection');
    if (!characterContainer) return;
    
    const currentProject = app.stateManager.getState().currentProject;
    if (!currentProject || !currentProject.groups) {
        characterContainer.innerHTML = '<p>캐릭터 정보를 불러올 수 없습니다.</p>';
        return;
    }
    
    let charactersHTML = '';
    let characterCount = 0;
    
    currentProject.groups.forEach(group => {
        if (group.cards && group.cards.length > 0) {
            group.cards.forEach(character => {
                characterCount++;
                const isMainCharacter = characterCount <= 3; // 처음 3명을 주요 캐릭터로 간주하여 기본 선택
                charactersHTML += `
                <label style="display: flex; align-items: center; margin-bottom: 0.5rem; padding: 0.25rem; border: 1px solid var(--pico-muted-border-color); border-radius: 4px; cursor: pointer;">
                    <input type="checkbox" name="selected_characters" value="${character.id}" ${isMainCharacter ? 'checked' : ''} style="margin-right: 0.5rem;">
                    <div>
                        <strong>${character.name}</strong>
                        <div style="font-size: 0.8rem; color: var(--pico-muted-color); margin-top: 0.2rem;">
                            ${character.description ? character.description.substring(0, 80) + (character.description.length > 80 ? '...' : '') : '설명 없음'}
                        </div>
                    </div>
                </label>
                `;
            });
        }
    });
    
    if (charactersHTML) {
        characterContainer.innerHTML = charactersHTML;
    } else {
        characterContainer.innerHTML = '<p>등록된 캐릭터가 없습니다.</p>';
    }
}
