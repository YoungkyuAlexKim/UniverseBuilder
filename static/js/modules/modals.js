// FILE: modals.js

/**
 * 모든 모달 창의 생성, 표시, 소멸 로직을 담당하는 모듈
 */
import * as api from './api.js';
import { EventListenerManager } from '../core/EventListenerManager.js';

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
const plotPointsDiffModal = document.getElementById('plot-points-diff-modal');
const manuscriptAiEditModal = document.getElementById('manuscript-ai-edit-modal'); // [수정] 새 모달 변수 추가


// App 인스턴스를 저장할 변수
let app;

// EventListenerManager 인스턴스
const eventManager = new EventListenerManager();

/**
 * 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeModals(appInstance) {
    app = appInstance;
}

export function closeModal() {
    // [수정] 닫을 모달 목록에 manuscriptAiEditModal 추가
    [cardDetailsModal, worldviewCardModal, diffModal, modalBackdrop, aiScenarioDraftModal, plotPointEditModal, refineConceptModal, refineWorldviewRuleModal, commonAiModal, plotPointsDiffModal, manuscriptAiEditModal].forEach(el => {
        if (el) {
            el.classList.remove('active');
            // 모달 관련 이벤트 리스너 모두 제거
            eventManager.removeAllEventListeners(el);
        }
    });

    // AI 애니메이션 아이콘 컨테이너 정리
    const iconContainers = [
        'manuscript-ai-writing-icon-container',
        'common-ai-writing-icon-container',
        'ai-writing-icon-container'
    ];
    iconContainers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
    });
    cardDetailsModal.classList.remove('shifted');
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) {
        eventManager.removeAllEventListeners(existingPanel);
        existingPanel.remove();
    }

    // ESC 키 이벤트 리스너 제거
    eventManager.removeEventListener(document, 'keydown', handleEscKey);
}

function handleEscKey(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

/**
 * [수정] AI가 수정한 전체 플롯 포인트를 비교하는 모달을 엽니다.
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
    
    // [수정] 제안된 플롯 렌더링 시, 변경된 항목에 체크박스 추가
    suggestionContainer.innerHTML = suggestedPlots.map((plot, index) => {
        const originalPlot = originalPlots[index];
        const isModified = !originalPlot || originalPlot.title !== plot.title || originalPlot.content !== plot.content;
        const hasSceneDraft = originalPlot && originalPlot.scene_draft && originalPlot.scene_draft.trim().length > 0;
        
        const checkboxHTML = (isModified && hasSceneDraft) ? `
            <div class="clear-draft-checkbox">
                <label>
                    <input type="checkbox" name="clear_draft" value="${plot.id}" checked>
                    <small><i data-lucide="eraser"></i>기존 장면 초안 삭제</small>
                </label>
            </div>
        ` : '';

        return `
            <article class="plot-point-item ${isModified ? 'modified' : ''}" data-index="${index}" data-plot-id="${plot.id}">
                <div class="plot-item-header">
                    <h6>${index + 1}. ${plot.title}</h6>
                    ${checkboxHTML}
                </div>
                <p>${plot.content || '세부 내용 없음'}</p>
            </article>
        `;
    }).join('');
    
    // 기존 이벤트 리스너 모두 제거
    eventManager.removeAllEventListeners(acceptBtn);
    eventManager.removeAllEventListeners(rejectBtn);

    // 새로운 이벤트 핸들러 등록
    eventManager.addEventListener(acceptBtn, 'click', () => {
        const draftsToClear = Array.from(suggestionContainer.querySelectorAll('input[name="clear_draft"]:checked'))
            .map(cb => cb.value);

        onAcceptCallback(suggestedPlots, draftsToClear);
    });

    eventManager.addEventListener(rejectBtn, 'click', () => closeModal());

    const closeButton = plotPointsDiffModal.querySelector('.close');
    if (closeButton) {
        eventManager.removeAllEventListeners(closeButton);
        eventManager.addEventListener(closeButton, 'click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    plotPointsDiffModal.classList.add('active');
    modalBackdrop.classList.add('active');
    lucide.createIcons();
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
            <div class="character-modal-actions">
                <button class="secondary outline" id="show-relationship-btn"><i data-lucide="network"></i>관계도 보기</button>
            </div>

            <div class="character-modal-section">
                <h4 class="character-modal-section-title">기본 정보</h4>
                <div class="character-modal-description" id="modal-desc">${card.description || '캐릭터 설명이 없습니다.'}</div>
                <div class="character-highlight-controls">
                    <button class="secondary outline highlight-btn" data-field="description"><i data-lucide="highlighter"></i>이름 하이라이팅</button>
                    <div class="highlight-actions" id="highlight-actions-description" style="display: none;">
                        <button class="secondary outline save-highlight-btn" data-field="description"><i data-lucide="save"></i>저장</button>
                        <button class="secondary outline cancel-highlight-btn" data-field="description"><i data-lucide="undo-2"></i>취소</button>
                    </div>
                </div>
            </div>

            ${(card.personality && card.personality.length > 0) || (card.abilities && card.abilities.length > 0) ? `
                <div class="character-modal-section">
                    <h4 class="character-modal-section-title">특성</h4>
                    <div class="character-modal-tags-container">
                        ${createTagsHTML(card.personality, 'personality-tag')}
                        ${createTagsHTML(card.abilities, 'ability-tag')}
                    </div>
                </div>
            ` : ''}

            ${card.goal && card.goal.length > 0 ? `
                <div class="character-modal-section">
                    <h4 class="character-modal-section-title">목표</h4>
                    <div class="character-modal-goals">
                        ${Array.isArray(card.goal) ? card.goal.map(g => `<div class="character-goal-item">${g}</div>`).join('') : `<div class="character-goal-item">${card.goal}</div>`}
                    </div>
                </div>
            ` : ''}

            ${card.quote && card.quote.length > 0 ? `
                <div class="character-modal-section">
                    <h4 class="character-modal-section-title">대표 대사</h4>
                    <div class="character-modal-quotes">
                        ${createQuotesHTML(card.quote)}
                    </div>
                </div>
            ` : ''}

            ${card.introduction_story ? `
                <div class="character-modal-section character-modal-story-section">
                    <h4 class="character-modal-section-title">등장 서사</h4>
                    <div class="character-modal-story" id="modal-story">${card.introduction_story}</div>
                    <div class="character-highlight-controls">
                        <button class="secondary outline highlight-btn" data-field="introduction_story"><i data-lucide="highlighter"></i>이름 하이라이팅</button>
                        <div class="highlight-actions" id="highlight-actions-introduction_story" style="display: none;">
                            <button class="secondary outline save-highlight-btn" data-field="introduction_story"><i data-lucide="save"></i>저장</button>
                            <button class="secondary outline cancel-highlight-btn" data-field="description"><i data-lucide="undo-2"></i>취소</button>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    contentEl.querySelector('#show-relationship-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await app.panels.showRelationshipPanel(projectId, card);
    });

    const footerEl = document.getElementById('modal-card-footer');
    footerEl.innerHTML = `
        <button id="modal-manual-edit-btn"><i data-lucide="pencil"></i>수동으로 수정</button>
        <button class="secondary" id="modal-edit-ai-btn"><i data-lucide="sparkles"></i>AI로 수정</button>
        <button class="secondary outline" id="modal-delete-btn"><i data-lucide="trash-2"></i>삭제</button>
    `;

    // 기존 이벤트 리스너들 제거
    eventManager.removeAllEventListeners(footerEl);
    eventManager.removeAllEventListeners(contentEl);

    // 새로운 이벤트 핸들러들 등록
    const manualEditBtn = footerEl.querySelector('#modal-manual-edit-btn');
    const editAiBtn = footerEl.querySelector('#modal-edit-ai-btn');
    const deleteBtn = footerEl.querySelector('#modal-delete-btn');

    if (manualEditBtn) {
        eventManager.addEventListener(manualEditBtn, 'click', (e) => app.panels.handleManualEditCard(e, projectId, card.id));
    }
    if (editAiBtn) {
        eventManager.addEventListener(editAiBtn, 'click', (e) => app.panels.handleEditCardAI(e, projectId, card.id));
    }
    if (deleteBtn) {
        eventManager.addEventListener(deleteBtn, 'click', (e) => {
            closeModal();
            app.call('character', 'handleDeleteCard', projectId, card.group_id, card.id);
        });
    }

    contentEl.querySelectorAll('.highlight-btn').forEach(button => {
        eventManager.addEventListener(button, 'click', (e) => handleHighlightClick(e, projectId, card.id));
    });

    const closeButton = cardDetailsModal.querySelector('.close');
    if (closeButton) {
        eventManager.removeAllEventListeners(closeButton);
        eventManager.addEventListener(closeButton, 'click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    // 모달 백드롭 이벤트
    eventManager.removeAllEventListeners(modalBackdrop);
    eventManager.addEventListener(modalBackdrop, 'click', () => {
        closeModal();
    });

    // ESC 키 이벤트 리스너 등록
    eventManager.addEventListener(document, 'keydown', handleEscKey);

    cardDetailsModal.classList.add('active');
    modalBackdrop.classList.add('active');
    lucide.createIcons();
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
            <button id="wv-save-btn" type="submit"><i data-lucide="save"></i>저장</button>
            <button id="wv-ai-edit-btn" class="secondary"><i data-lucide="sparkles"></i>AI로 수정</button>
        </div>
        <button id="wv-delete-btn" class="secondary outline" style="margin-top: 0.5rem;"><i data-lucide="trash-2"></i>삭제</button>
    `;
    form.appendChild(footer);

    // 기존 이벤트 리스너들 제거
    eventManager.removeAllEventListeners(footer);

    // 새로운 이벤트 핸들러들 등록
    const aiEditBtn = footer.querySelector('#wv-ai-edit-btn');
    const deleteBtn = footer.querySelector('#wv-delete-btn');

    if (aiEditBtn) {
        eventManager.addEventListener(aiEditBtn, 'click', async (e) => {
            e.preventDefault();
            await app.panels.handleEditWorldviewCardAI(card, projectId);
        });
    }
    if (deleteBtn) {
        eventManager.addEventListener(deleteBtn, 'click', async (e) => {
            e.preventDefault();
            await app.call('worldview', 'handleDeleteWorldviewCard', projectId, card.id);
        });
    }

    const closeButton = worldviewCardModal.querySelector('.close');
    if (closeButton) {
        eventManager.removeAllEventListeners(closeButton);
        eventManager.addEventListener(closeButton, 'click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    // ESC 키 이벤트 리스너 등록
    eventManager.addEventListener(document, 'keydown', handleEscKey);

    worldviewCardModal.classList.add('active');
    modalBackdrop.classList.add('active');
    lucide.createIcons();

    // 폼 이벤트 리스너 관리
    if (form.onsubmit) {
        // 기존 onsubmit 제거 (EventListenerManager로는 처리하기 어려움)
        form.onsubmit = null;
    }

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
    const closeBtn = diffModal.querySelector('.close');

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
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    newRejectBtn.onclick = () => {
        console.log('반려 버튼 클릭됨 - 모달 닫기');
        diffModal.classList.remove('active');
        modalBackdrop.classList.remove('active');
    };

    newCloseBtn.onclick = (e) => {
        console.log('X 버튼 클릭됨 - 모달 닫기');
        e.preventDefault();
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
    lucide.createIcons();
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
        lucide.createIcons();

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
    newSaveBtn.addEventListener('click', () => app.call('scenario', 'handleUpdatePlotPoint', form, projectId, scenarioId));

    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => app.call('scenario', 'handleDeletePlotPoint', plotPoint.id, projectId, scenarioId));

    const newAiSceneBtn = aiSceneBtn.cloneNode(true);
    aiSceneBtn.parentNode.replaceChild(newAiSceneBtn, aiSceneBtn);
    newAiSceneBtn.addEventListener('click', () => app.call('scenario', 'handleAiSceneGeneration', plotPoint.id, projectId, scenarioId));

    const newAiEditBtn = aiEditBtn.cloneNode(true);
    aiEditBtn.parentNode.replaceChild(newAiEditBtn, aiEditBtn);
    newAiEditBtn.addEventListener('click', () => app.call('scenario', 'handleAiSceneEdit', plotPoint.id, projectId, scenarioId));
    
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
    lucide.createIcons();
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

    // X 버튼 이벤트 리스너 추가
    const closeBtn = refineConceptModal.querySelector('.close');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = (e) => {
            console.log('AI 컨셉 다듬기 X 버튼 클릭됨');
            e.preventDefault();
            closeModal();
        };
    }

    refineConceptModal.classList.add('active');
    modalBackdrop.classList.add('active');
    lucide.createIcons();
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

    // X 버튼 이벤트 리스너 추가
    const closeBtn = refineWorldviewRuleModal.querySelector('.close');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = (e) => {
            console.log('AI 핵심 설정 다듬기 X 버튼 클릭됨');
            e.preventDefault();
            closeModal();
        };
    }

    refineWorldviewRuleModal.classList.add('active');
    modalBackdrop.classList.add('active');
    lucide.createIcons();
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
                <div style="margin-bottom: 0.5rem; padding: 0.25rem; border: 1px solid var(--pico-muted-border-color); border-radius: 4px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" name="selected_characters" value="${character.id}" ${isMainCharacter ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <div style="flex-grow: 1;">
                            <strong>${character.name}</strong>
                            <div style="font-size: 0.8rem; color: var(--pico-muted-color); margin-top: 0.2rem;">
                                ${character.description ? character.description.substring(0, 80) + (character.description.length > 80 ? '...' : '') : '설명 없음'}
                            </div>
                        </div>
                    </label>
                    <button type="button" class="character-relations-btn secondary outline" data-character-id="${character.id}" data-character-name="${character.name}" style="margin-left: 0.5rem; font-size: 0.8rem; padding: 0.2rem 0.4rem;">
                        <i data-lucide="link"></i> 관계
                    </button>
                </div>
                `;
            });
        }
    });
    
    if (charactersHTML) {
        characterContainer.innerHTML = charactersHTML;

        // [Phase 3+] 관계 선택 버튼 이벤트 리스너 추가
        setupCharacterRelationsButtons(projectId);
    } else {
        characterContainer.innerHTML = '<p>등록된 캐릭터가 없습니다.</p>';
    }
}

/**
 * [Phase 3+] 캐릭터 관계 선택 버튼 이벤트 설정
 */
function setupCharacterRelationsButtons(projectId) {
    const relationsButtons = document.querySelectorAll('.character-relations-btn');

    relationsButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const characterId = button.dataset.characterId;
            const characterName = button.dataset.characterName;
            showCharacterRelationsPopup(characterId, characterName, projectId);
        });
    });
}

/**
 * [Phase 3+] 캐릭터 관계 선택 팝업 표시
 */
function showCharacterRelationsPopup(characterId, characterName, projectId) {
    // 기존 팝업이 있으면 제거
    const existingPopup = document.querySelector('.character-relations-popup');
    if (existingPopup) existingPopup.remove();

    // 팝업 생성
    const popup = document.createElement('div');
    popup.className = 'character-relations-popup';
    popup.innerHTML = `
        <div class="popup-overlay">
            <div class="popup-content">
                <div class="popup-header">
                    <h4><i data-lucide="link"></i> ${characterName}의 관계 선택</h4>
                    <button type="button" class="popup-close-btn">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="popup-body">
                    <div class="relations-loading">
                        <p>관계 정보를 불러오는 중...</p>
                    </div>
                    <div class="relations-list" style="display: none;"></div>
                </div>
                <div class="popup-footer">
                    <button type="button" class="popup-select-all-btn secondary outline">전체 선택</button>
                    <button type="button" class="popup-deselect-all-btn secondary outline">전체 해제</button>
                    <button type="button" class="popup-confirm-btn primary">선택 완료</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    lucide.createIcons();

    // 이벤트 리스너 설정
    setupRelationsPopupEvents(popup, characterId, characterName, projectId);

    // 관계 목록 로드
    loadCharacterRelations(popup, characterId, characterName, projectId);
}

/**
 * [Phase 3+] 관계 팝업 이벤트 설정
 */
function setupRelationsPopupEvents(popup, characterId, characterName, projectId) {
    // 닫기 버튼
    const closeBtn = popup.querySelector('.popup-close-btn');
    const overlay = popup.querySelector('.popup-overlay');

    const closePopup = () => popup.remove();

    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closePopup();
            document.removeEventListener('keydown', escHandler);
        }
    });

    // 전체 선택/해제 버튼
    const selectAllBtn = popup.querySelector('.popup-select-all-btn');
    const deselectAllBtn = popup.querySelector('.popup-deselect-all-btn');
    const confirmBtn = popup.querySelector('.popup-confirm-btn');

    selectAllBtn.addEventListener('click', () => {
        const checkboxes = popup.querySelectorAll('.relation-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
    });

    deselectAllBtn.addEventListener('click', () => {
        const checkboxes = popup.querySelectorAll('.relation-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
    });

    // 선택 완료 버튼
    confirmBtn.addEventListener('click', () => {
        const selectedRelations = Array.from(popup.querySelectorAll('.relation-checkbox:checked'))
            .map(cb => cb.value);

        // 선택된 관계들을 전역 변수에 저장 (나중에 AI 생성 시 사용)
        saveSelectedCharacterRelations(characterId, selectedRelations);

        // 팝업 닫기
        closePopup();

        // 선택 완료 피드백
        showSelectionFeedback(characterName, selectedRelations.length);
    });
}

/**
 * [Phase 3+] 캐릭터 관계 목록 로드
 */
async function loadCharacterRelations(popup, characterId, characterName, projectId) {
    const loadingDiv = popup.querySelector('.relations-loading');
    const relationsListDiv = popup.querySelector('.relations-list');

    try {
        // 프로젝트의 모든 관계를 가져옴
        const project = await api.getProjectDetails(projectId);
        const allRelationships = project.relationships || [];

        // 해당 캐릭터와 관련된 관계만 필터링
        const characterRelationships = allRelationships.filter(rel =>
            rel.source_character_id === characterId || rel.target_character_id === characterId
        );

        if (characterRelationships.length === 0) {
            loadingDiv.innerHTML = '<p>설정된 관계가 없습니다.</p>';
            return;
        }

        // 캐릭터 이름 맵 생성
        const characterMap = {};
        project.groups?.forEach(group => {
            group.cards?.forEach(card => {
                characterMap[card.id] = card.name;
            });
        });

        // 관계 목록 HTML 생성
        let relationsHTML = '<div style="max-height: 300px; overflow-y: auto;">';
        characterRelationships.forEach(relationship => {
            const otherCharacterId = relationship.source_character_id === characterId
                ? relationship.target_character_id
                : relationship.source_character_id;
            const otherCharacterName = characterMap[otherCharacterId] || '알 수 없음';
            const phaseDisplay = relationship.phase_order ? ` (단계 ${relationship.phase_order})` : '';

            // 이미 선택된 관계인지 확인
            const isSelected = isRelationSelected(characterId, relationship.id);

            relationsHTML += `
                <label style="display: block; margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid var(--pico-muted-border-color); border-radius: 4px; cursor: pointer;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" class="relation-checkbox" value="${relationship.id}" ${isSelected ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <div style="flex-grow: 1;">
                            <strong>${characterName} ↔ ${otherCharacterName}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                                ${relationship.type}${phaseDisplay}
                            </div>
                            ${relationship.description ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${relationship.description}</div>` : ''}
                        </div>
                    </div>
                </label>
            `;
        });
        relationsHTML += '</div>';

        // 로딩 표시 숨기고 관계 목록 표시
        loadingDiv.style.display = 'none';
        relationsListDiv.style.display = 'block';
        relationsListDiv.innerHTML = relationsHTML;

    } catch (error) {
        console.error('관계 목록 로드 실패:', error);
        loadingDiv.innerHTML = '<p>관계 정보를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

/**
 * [Phase 3+] 선택된 캐릭터 관계 저장
 */
function saveSelectedCharacterRelations(characterId, relationIds) {
    // 로컬 스토리지에 선택된 관계 저장 (임시 저장)
    const key = `selected_relations_${characterId}`;
    if (relationIds.length > 0) {
        localStorage.setItem(key, JSON.stringify(relationIds));
    } else {
        localStorage.removeItem(key);
    }

    // 선택된 관계들을 모아서 전역 변수에 저장
    updateGlobalSelectedRelations();
}

/**
 * [Phase 3+] 캐릭터 관계 선택 여부 확인
 */
function isRelationSelected(characterId, relationId) {
    const key = `selected_relations_${characterId}`;
    const selected = localStorage.getItem(key);
    if (!selected) return false;

    const selectedIds = JSON.parse(selected);
    return selectedIds.includes(relationId);
}

/**
 * [Phase 3+] 전역 선택된 관계 업데이트
 */
function updateGlobalSelectedRelations() {
    const selectedRelations = [];

    // 모든 캐릭터의 선택된 관계를 수집
    const keys = Object.keys(localStorage).filter(key => key.startsWith('selected_relations_'));
    keys.forEach(key => {
        const relations = localStorage.getItem(key);
        if (relations) {
            const relationIds = JSON.parse(relations);
            selectedRelations.push(...relationIds);
        }
    });

    // 중복 제거
    const uniqueRelations = [...new Set(selectedRelations)];

    // 전역 변수에 저장 (ScenarioController에서 사용)
    window.selectedCharacterRelations = uniqueRelations;

    console.log('선택된 관계들:', uniqueRelations);
}

/**
 * [Phase 3+] 선택 완료 피드백 표시
 */
function showSelectionFeedback(characterName, count) {
    // 간단한 토스트 메시지 표시 (CSS로 꾸밀 수 있음)
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--pico-primary-background);
        color: var(--pico-primary);
        padding: 0.75rem 1rem;
        border-radius: 4px;
        border: 1px solid var(--pico-primary-border);
        z-index: 1000;
        font-size: 0.9rem;
    `;

    if (count > 0) {
        toast.textContent = `${characterName}: ${count}개의 관계 선택됨`;
    } else {
        toast.textContent = `${characterName}: 관계 선택 해제됨`;
    }

    document.body.appendChild(toast);

    // 3초 후 자동 제거
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
