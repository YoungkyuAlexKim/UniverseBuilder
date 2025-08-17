/**
 * 동적 HTML 생성 및 화면 렌더링 관련 함수를 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let showCharacterGeneratorUI, handleCreateGroup, handleDeleteGroup, setupSortable, openCardModal, handleSaveWorldview, handleAiGenerateNewWorldview, handleAiEditWorldview, handleCreateWorldviewGroup, handleDeleteWorldviewGroup, openWorldviewCardModal;

export function initializeUI(handlers) {
    showCharacterGeneratorUI = handlers.showCharacterGeneratorUI;
    handleCreateGroup = handlers.handleCreateGroup;
    handleDeleteGroup = handlers.handleDeleteGroup;
    setupSortable = handlers.setupSortable;
    openCardModal = handlers.openCardModal;
    handleSaveWorldview = handlers.handleSaveWorldview;
    handleAiGenerateNewWorldview = handlers.handleAiGenerateNewWorldview;
    handleAiEditWorldview = handlers.handleAiEditWorldview;
    handleCreateWorldviewGroup = handlers.handleCreateWorldviewGroup;
    handleDeleteWorldviewGroup = handlers.handleDeleteWorldviewGroup;
    openWorldviewCardModal = handlers.openWorldviewCardModal;
}


export function renderCharacterTab(projectData) {
    const container = document.getElementById('card-list-container');
    container.innerHTML = `<div style="margin-bottom: 1.5rem;"><button id="show-generator-btn">✨ 새 인물 AI 생성</button></div>`;
    container.querySelector('#show-generator-btn').addEventListener('click', () => showCharacterGeneratorUI(projectData.id, container));

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'groups-container';
    container.appendChild(groupsContainer);

    (projectData.groups || []).forEach(group => {
        const groupColumn = document.createElement('div');
        groupColumn.className = 'group-column';
        groupColumn.innerHTML = `
            <div class="group-header"><h4>${group.name}</h4>
                ${group.name !== '미분류' ? `<button class="outline secondary delete-group-btn" data-group-id="${group.id}" data-group-name="${group.name}">삭제</button>` : ''}
            </div>
            <div class="cards-list" data-group-id="${group.id}"></div>
        `;
        const cardsListEl = groupColumn.querySelector('.cards-list');
        if (group.cards?.length > 0) {
            group.cards.forEach(card => cardsListEl.appendChild(createCardElement(card, projectData.id, group.id)));
        } else {
            cardsListEl.innerHTML = '<p><small>카드가 없습니다.</small></p>';
        }
        groupsContainer.appendChild(groupColumn);
    });
    
    const addGroupColumn = document.createElement('div');
    addGroupColumn.className = 'group-column';
    addGroupColumn.innerHTML = `<h4>새 그룹 추가</h4><form id="create-group-form" style="margin-top: 1rem;"><input type="text" name="name" placeholder="새 그룹 이름" required autocomplete="off" style="margin-bottom: 0.5rem;"><button type="submit" class="contrast" style="width: 100%;">+ 새 그룹 추가</button></form>`;
    groupsContainer.appendChild(addGroupColumn);

    document.getElementById('create-group-form')?.addEventListener('submit', (e) => handleCreateGroup(e, projectData.id));
    container.querySelectorAll('.delete-group-btn').forEach(button => button.addEventListener('click', (e) => handleDeleteGroup(e, projectData.id)));
    
    setupSortable(container.querySelectorAll('.cards-list'), projectData.id, 'character');
}

function createCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `<strong>${card.name || '이름 없는 카드'}</strong>`;
    cardEl.addEventListener('click', () => {
        const cardData = { ...card, group_id: groupId };
        openCardModal(cardData, projectId);
    });
    return cardEl;
}

export function renderWorldviewTab(projectData) {
    const worldviewContent = document.getElementById('worldview-content');
    worldviewContent.value = projectData.worldview?.content || '';

    const setupButton = (id, handler) => {
        const button = document.getElementById(id);
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', handler);
    };

    setupButton('save-worldview-btn', (e) => {
        e.preventDefault();
        handleSaveWorldview(projectData.id);
    });
    setupButton('ai-generate-new-btn', () => handleAiGenerateNewWorldview(projectData.id));
    setupButton('ai-work-on-existing-btn', () => handleAiEditWorldview(projectData.id));

    const container = document.getElementById('worldview-card-list-container');
    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'groups-container';
    container.innerHTML = ''; 
    container.appendChild(groupsContainer);

    (projectData.worldview_groups || []).forEach(group => {
        const groupColumn = document.createElement('div');
        groupColumn.className = 'group-column';
        groupColumn.innerHTML = `
            <div class="group-header"><h4>${group.name}</h4>
                <button class="outline secondary delete-wv-group-btn" data-group-id="${group.id}" data-group-name="${group.name}">삭제</button>
            </div>
            <div class="cards-list worldview-cards-list" data-group-id="${group.id}"></div>
            <button class="add-wv-card-btn" data-group-id="${group.id}" style="margin-top: 1rem;">+ 새 설정 카드</button>
        `;
        const cardsListEl = groupColumn.querySelector('.cards-list');
        if (group.worldview_cards?.length > 0) {
            group.worldview_cards.forEach(card => cardsListEl.appendChild(createWorldviewCardElement(card, projectData.id, group.id)));
        } else {
            cardsListEl.innerHTML = '<p><small>카드가 없습니다.</small></p>';
        }
        groupsContainer.appendChild(groupColumn);
    });

    const addGroupColumn = document.createElement('div');
    addGroupColumn.className = 'group-column';
    addGroupColumn.innerHTML = `<h4>새 설정 그룹</h4><form id="create-wv-group-form" style="margin-top: 1rem;"><input type="text" name="name" placeholder="새 설정 그룹 이름" required autocomplete="off" style="margin-bottom: 0.5rem;"><button type="submit" class="contrast" style="width: 100%;">+ 새 설정 그룹</button></form>`;
    groupsContainer.appendChild(addGroupColumn);

    document.getElementById('create-wv-group-form')?.addEventListener('submit', (e) => handleCreateWorldviewGroup(e, projectData.id));
    container.querySelectorAll('.delete-wv-group-btn').forEach(btn => btn.addEventListener('click', (e) => handleDeleteWorldviewGroup(e, projectData.id)));
    container.querySelectorAll('.add-wv-card-btn').forEach(btn => btn.addEventListener('click', (e) => openWorldviewCardModal(null, projectData.id, e.currentTarget.dataset.groupId)));
    
    setupSortable(container.querySelectorAll('.worldview-cards-list'), projectData.id, 'worldview');
}

function createWorldviewCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `<strong>${card.title || '제목 없는 카드'}</strong>`;
    cardEl.addEventListener('click', () => openWorldviewCardModal(card, projectId, groupId));
    return cardEl;
}

// 동적 입력 필드 UI 생성 (수동 편집 패널용)
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

export function addDynamicInputField(container, field, value = '', index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-input-wrapper';
    wrapper.innerHTML = `
        <input type="text" name="${field}" value="${value}" data-index="${index}">
        <button type="button" class="secondary outline remove-dynamic-input-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✕</button>
    `;
    container.appendChild(wrapper);
}