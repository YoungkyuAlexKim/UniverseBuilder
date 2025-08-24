/**
 * 동적 HTML 생성 및 화면 렌더링 관련 함수를 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let showCharacterGeneratorUI, handleCreateGroup, handleDeleteGroup, setupSortable, openCardModal, openPlotPointEditModal, handleSaveWorldview, handleCreateWorldviewGroup, handleDeleteWorldviewGroup, openWorldviewCardModal, handleSaveScenario, handleCreatePlotPoint, handleAiDraftGeneration, handleRefineConcept, handleRefineWorldviewRule;

export function initializeUI(handlers) {
    showCharacterGeneratorUI = handlers.showCharacterGeneratorUI;
    handleCreateGroup = handlers.handleCreateGroup;
    handleDeleteGroup = handlers.handleDeleteGroup;
    setupSortable = handlers.setupSortable;
    openCardModal = handlers.openCardModal;
    openPlotPointEditModal = handlers.openPlotPointEditModal;
    handleSaveWorldview = handlers.handleSaveWorldview;
    handleCreateWorldviewGroup = handlers.handleCreateWorldviewGroup;
    handleDeleteWorldviewGroup = handlers.handleDeleteWorldviewGroup;
    openWorldviewCardModal = handlers.openWorldviewCardModal;
    handleSaveScenario = handlers.handleSaveScenario;
    handleCreatePlotPoint = handlers.handleCreatePlotPoint;
    handleAiDraftGeneration = handlers.handleAiDraftGeneration;
    handleRefineConcept = handlers.handleRefineConcept;
    handleRefineWorldviewRule = handlers.handleRefineWorldviewRule;
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

// [오류 수정] 이벤트 리스너 유실 문제를 해결하기 위해 로직 순서 변경
export function renderWorldviewTab(projectData) {
    const worldview = projectData.worldview || { logline: '', genre: '', rules: [] };
    
    const form = document.getElementById('worldview-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    const loglineInput = newForm.querySelector('#worldview-logline');
    const genreInput = newForm.querySelector('#worldview-genre');
    const rulesContainer = newForm.querySelector('#worldview-rules-container');
    const addRuleBtn = newForm.querySelector('#add-worldview-rule-btn');

    loglineInput.value = worldview.logline || '';
    genreInput.value = worldview.genre || '';
    rulesContainer.innerHTML = '';

    if (worldview.rules && worldview.rules.length > 0) {
        worldview.rules.forEach(ruleText => {
            addWorldviewRuleInput(ruleText, projectData.id, rulesContainer);
        });
    } else {
        addWorldviewRuleInput('', projectData.id, rulesContainer);
        addWorldviewRuleInput('', projectData.id, rulesContainer);
        addWorldviewRuleInput('', projectData.id, rulesContainer);
    }

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveWorldview(projectData.id);
    });
    
    addRuleBtn.addEventListener('click', () => addWorldviewRuleInput('', projectData.id, rulesContainer));

    // --- 서브 설정 카드 렌더링 로직 ---
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

// [오류 수정] 함수가 컨테이너를 인자로 받도록 수정
function addWorldviewRuleInput(value = '', projectId, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-input-wrapper';
    wrapper.innerHTML = `
        <input type="text" name="rules" placeholder="세계관의 핵심 전제, 설정, 규칙..." value="${value}">
        <button type="button" class="secondary outline refine-rule-btn" style="padding: 0.2rem 0.6rem; font-size: 0.8rem; line-height: 1;">✨</button>
        <button type="button" class="secondary outline remove-dynamic-input-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✕</button>
    `;
    container.appendChild(wrapper);

    const inputField = wrapper.querySelector('input[name="rules"]');

    wrapper.querySelector('.remove-dynamic-input-btn').addEventListener('click', () => {
        wrapper.remove();
    });

    wrapper.querySelector('.refine-rule-btn').addEventListener('click', (e) => {
        handleRefineWorldviewRule(e, projectId, inputField);
    });
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

    const form = container.querySelector('#scenario-details-form');
    form.elements.summary.value = mainScenario.summary || '';
    form.elements.prologue.value = mainScenario.prologue || '';
    form.elements.title.value = mainScenario.title || '';
    form.elements.themes.value = (mainScenario.themes || []).join(', ');

    let plotPointsHTML = '';
    if (mainScenario.plot_points && mainScenario.plot_points.length > 0) {
        plotPointsHTML = mainScenario.plot_points.map(plot => {
            const plotDataString = JSON.stringify(plot);
            const escapedPlotDataString = plotDataString.replace(/'/g, '&#39;');

            return `
            <button class="plot-point-item" data-plot-point='${escapedPlotDataString}' style="display:block; width:100%; text-align:left; margin-bottom: 1rem; padding:0;">
                <article style="margin:0;">
                    <h6>${plot.ordering + 1}. ${plot.title}</h6>
                    <p style="margin:0;">${plot.content || '세부 내용 없음'}</p>
                </article>
            </button>
        `}).join('');
    } else {
        plotPointsHTML = '<p>아직 작성된 플롯이 없습니다.</p>';
    }
    container.querySelector('#plot-list').innerHTML = plotPointsHTML;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', (e) => {
        handleSaveScenario(e, projectData.id, mainScenario.id);
    });

    const addPlotForm = container.querySelector('#add-plot-point-form');
    const newAddPlotForm = addPlotForm.cloneNode(true);
    addPlotForm.parentNode.replaceChild(newAddPlotForm, addPlotForm);
    newAddPlotForm.addEventListener('submit', (e) => {
        handleCreatePlotPoint(e, projectData.id, mainScenario.id);
    });

    const setupButtonListener = (id, handler) => {
        const button = container.querySelector(`#${id}`);
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', handler);
    };

    setupButtonListener('ai-draft-btn', () => openAiScenarioDraftModal(projectData, mainScenario.id));
    setupButtonListener('refine-concept-btn', () => handleRefineConcept());

    const plotList = container.querySelector('#plot-list');
    const newPlotList = plotList.cloneNode(true);
    plotList.parentNode.replaceChild(newPlotList, plotList);
    newPlotList.addEventListener('click', (e) => {
        const plotItem = e.target.closest('.plot-point-item');
        if (plotItem) {
            const plotData = JSON.parse(plotItem.dataset.plotPoint);
            openPlotPointEditModal(plotData, projectData.id, mainScenario.id);
        }
    });
}

function openAiScenarioDraftModal(projectData, scenarioId) {
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
        handleAiDraftGeneration(e, projectData.id, scenarioId);
    });

    modal.classList.add('active');
    modalBackdrop.classList.add('active');
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
