/**
 * 동적 HTML 생성 및 화면 렌더링 관련 함수를 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let showCharacterGeneratorUI, handleCreateGroup, handleDeleteGroup, setupSortable, openCardModal, handleSaveWorldview, handleAiGenerateNewWorldview, handleAiEditWorldview, handleCreateWorldviewGroup, handleDeleteWorldviewGroup, openWorldviewCardModal, handleSaveScenario, handleCreatePlotPoint;

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
    handleSaveScenario = handlers.handleSaveScenario;
    handleCreatePlotPoint = handlers.handleCreatePlotPoint;
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

export function renderScenarioTab(projectData) {
    const container = document.getElementById('tab-content-scenario');
    const mainScenario = projectData.scenarios && projectData.scenarios[0];
    if (!mainScenario) {
        container.innerHTML = '<p>시나리오 데이터를 불러오지 못했습니다.</p>';
        return;
    }

    let plotPointsHTML = '';
    if (mainScenario.plot_points && mainScenario.plot_points.length > 0) {
        plotPointsHTML = mainScenario.plot_points.map(plot => `
            <article class="plot-point-item" data-plot-id="${plot.id}" style="padding: 1rem; border: 1px solid var(--pico-muted-border-color); border-radius: 6px; margin-bottom: 1rem;">
                <h6>${plot.ordering + 1}. ${plot.title}</h6>
                <p style="margin:0;">${plot.content || '세부 내용 없음'}</p>
            </article>
        `).join('');
    } else {
        plotPointsHTML = '<p>아직 작성된 플롯이 없습니다.</p>';
    }

    container.innerHTML = `
        <article>
            <hgroup>
                <h4>메인 스토리 로드맵</h4>
                <p>이야기의 전체적인 흐름을 설계하고 AI와 함께 플롯을 발전시켜 보세요.</p>
            </hgroup>
            <form id="scenario-details-form">
                <div class="grid">
                    <label for="scenario-title">
                        시나리오 제목
                        <input type="text" id="scenario-title" name="title" value="${mainScenario.title || ''}" placeholder="시나리오의 제목">
                    </label>
                    <label for="scenario-themes">
                        핵심 테마 (쉼표로 구분)
                        <input type="text" id="scenario-themes" name="themes" value="${(mainScenario.themes || []).join(', ')}" placeholder="예: 복수, 희생, 구원">
                    </label>
                </div>
                <label for="scenario-summary">한 줄 요약</label>
                <textarea id="scenario-summary" name="summary" rows="2" placeholder="이 이야기의 핵심 내용을 한두 문장으로 요약합니다.">${mainScenario.summary || ''}</textarea>
                <button type="submit" style="width: auto;">시나리오 정보 저장</button>
            </form>
        </article>
        <hr>
        <div id="plot-points-container">
            <h4>플롯 포인트</h4>
            <div id="plot-list">
                ${plotPointsHTML}
            </div>
            
            <form id="add-plot-point-form" style="margin-top: 1.5rem; border-top: 1px solid var(--pico-muted-border-color); padding-top: 1.5rem;">
                <label for="new-plot-title"><strong>새 플롯 추가</strong></label>
                <input type="text" id="new-plot-title" name="title" placeholder="플롯 제목 (예: 주인공의 각성)" required>
                <textarea name="content" rows="3" placeholder="세부 내용 (선택 사항)"></textarea>
                <button type="submit" style="width: auto;">+ 플롯 추가</button>
            </form>

            <button id="ai-draft-btn" class="contrast" style="margin-top: 1.5rem;">✨ AI로 전체 스토리 초안 생성</button>
        </div>
    `;

    const scenarioForm = document.getElementById('scenario-details-form');
    scenarioForm.addEventListener('submit', (e) => {
        handleSaveScenario(e, projectData.id, mainScenario.id);
    });

    const addPlotForm = document.getElementById('add-plot-point-form');
    addPlotForm.addEventListener('submit', (e) => {
        handleCreatePlotPoint(e, projectData.id, mainScenario.id);
    });
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