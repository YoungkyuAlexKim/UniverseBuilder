/**
 * 동적 HTML 생성 및 화면 렌더링 관련 함수를 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let showCharacterGeneratorUI, handleCreateGroup, handleDeleteGroup, setupSortable, openCardModal, openPlotPointEditModal, handleSaveWorldview, handleCreateWorldviewGroup, handleDeleteWorldviewGroup, openWorldviewCardModal, handleSaveScenario, handleCreatePlotPoint, handleAiDraftGeneration, handleRefineConcept, handleRefineWorldviewRule;
let app; // App 인스턴스를 저장할 변수
let eventManager; // EventListenerManager 인스턴스

/**
 * 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeUI(appInstance) {
    app = appInstance;
    eventManager = appInstance.eventManager;
}

/**
 * 프로젝트 목록을 UI에 렌더링합니다.
 * @param {Array} projects - 표시할 프로젝트 객체의 배열
 */
export function renderProjectList(projects) {
    const projectList = document.querySelector('.project-list');
    projectList.innerHTML = '';
    if (projects.length === 0) {
        projectList.innerHTML = '<li>생성된 프로젝트가 없습니다.</li>';
    } else {
        projects.forEach(project => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="project-name-span" data-id="${project.id}" title="${project.name}">${project.name}</span>
                <div>
                    <button class="secondary outline update-project-btn" data-project-id="${project.id}" data-current-name="${project.name}" style="padding: 0.1rem 0.4rem; font-size: 0.75rem; margin-right: 0.5rem;">수정</button>
                    <button class="secondary outline delete-project-btn" data-project-id="${project.id}" data-project-name="${project.name}" style="padding: 0.1rem 0.4rem; font-size: 0.75rem;">삭제</button>
                </div>
            `;
            projectList.appendChild(li);
        });
    }
}

/**
 * 특정 프로젝트의 상세 내용을 메인 뷰에 렌더링합니다.
 * @param {object} projectData - 표시할 프로젝트의 상세 데이터
 */
export function renderProjectDetail(projectData) {
    document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
    document.getElementById('project-detail-view').classList.add('active');
    
    document.getElementById('project-title-display').textContent = projectData.name;
    document.getElementById('project-title-display').dataset.currentProjectId = projectData.id;

    // 각 탭의 내용을 렌더링
    renderCharacterTab(projectData);
    renderWorldviewTab(projectData);
    renderScenarioTab(projectData);

    // 활성화된 탭이 없다면 캐릭터 탭을 기본으로 활성화
    if (!document.querySelector('.tab-link.active')) {
        activateTab('characters');
    }
}

/**
 * 시작 화면(웰컴 뷰)을 표시합니다.
 */
export function showWelcomeView() {
    document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
    document.getElementById('welcome-view').classList.add('active');
}

/**
 * 지정된 탭을 활성화합니다.
 * @param {string} tabId - 활성화할 탭의 ID ('characters', 'worldview', 'scenario')
 */
export function activateTab(tabId) {
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.tab-link[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-content-${tabId}`).classList.add('active');
    
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        tabsContainer.scrollTop = 0;
    }
}


// --- 각 탭의 세부 렌더링 함수 ---

function renderCharacterTab(projectData) {
    const container = document.getElementById('card-list-container');

    eventManager.replaceContentSafely(container, `<div style="margin-bottom: 1.5rem;"><button id="show-generator-btn">✨ 새 인물 AI 생성</button></div>`, (container) => {
        const generatorBtn = container.querySelector('#show-generator-btn');
        if (generatorBtn) {
            eventManager.addEventListener(generatorBtn, 'click', () => app.openCharacterGenerationModal(projectData.id));
        }
    });

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

    const createGroupForm = document.getElementById('create-group-form');
    if (createGroupForm) {
        eventManager.addEventListener(createGroupForm, 'submit', (e) => app.handleCreateGroup(e, projectData.id));
    }

    container.querySelectorAll('.delete-group-btn').forEach(button => {
        eventManager.addEventListener(button, 'click', (e) => {
            const { groupId, groupName } = e.currentTarget.dataset;
            app.handleDeleteGroup(projectData.id, groupId, groupName);
        });
    });
    
    app.setupSortable(container.querySelectorAll('.cards-list'), projectData.id, 'character');
}

function createCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `<strong>${card.name || '이름 없는 카드'}</strong>`;
    cardEl.addEventListener('click', () => {
        const cardData = { ...card, group_id: groupId };
        app.modals.openCardModal(cardData, projectId);
    });
    return cardEl;
}

function renderWorldviewTab(projectData) {
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
        app.handleSaveWorldview(projectData.id);
    });
    
    addRuleBtn.addEventListener('click', () => addWorldviewRuleInput('', projectData.id, rulesContainer));

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

    document.getElementById('create-wv-group-form')?.addEventListener('submit', (e) => app.handleCreateWorldviewGroup(e, projectData.id));
    container.querySelectorAll('.delete-wv-group-btn').forEach(btn => btn.addEventListener('click', (e) => app.handleDeleteWorldviewGroup(e, projectData.id)));
    container.querySelectorAll('.add-wv-card-btn').forEach(btn => btn.addEventListener('click', (e) => app.modals.openWorldviewCardModal(null, projectData.id, e.currentTarget.dataset.groupId)));
    
    app.setupSortable(container.querySelectorAll('.worldview-cards-list'), projectData.id, 'worldview');
}

function addWorldviewRuleInput(value = '', projectId, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-input-wrapper';
    wrapper.innerHTML = `
        <textarea name="rules" placeholder="세계관의 핵심 전제, 설정, 규칙..." rows="1" style="resize: vertical; min-height: 2.5rem; overflow: hidden;">${value}</textarea>
        <button type="button" class="secondary outline refine-rule-btn" style="padding: 0.2rem 0.6rem; font-size: 0.8rem; line-height: 1;">✨</button>
        <button type="button" class="secondary outline remove-dynamic-input-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✕</button>
    `;
    container.appendChild(wrapper);

    const inputField = wrapper.querySelector('textarea[name="rules"]');
    
    function adjustHeight() {
        inputField.style.height = 'auto';
        const computedStyle = window.getComputedStyle(inputField);
        const paddingTop = parseInt(computedStyle.paddingTop);
        const paddingBottom = parseInt(computedStyle.paddingBottom);
        const borderTop = parseInt(computedStyle.borderTopWidth);
        const borderBottom = parseInt(computedStyle.borderBottomWidth);
        
        const extraHeight = paddingTop + paddingBottom + borderTop + borderBottom + 8;
        const newHeight = Math.max(60, inputField.scrollHeight + extraHeight);
        
        inputField.style.height = newHeight + 'px';
    }
    
    adjustHeight();
    
    inputField.addEventListener('input', adjustHeight);
    inputField.addEventListener('change', adjustHeight);

    wrapper.querySelector('.remove-dynamic-input-btn').addEventListener('click', () => {
        wrapper.remove();
    });

    wrapper.querySelector('.refine-rule-btn').addEventListener('click', (e) => {
        app.handleRefineWorldviewRule(e, projectId, inputField);
    });
}


function createWorldviewCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `<strong>${card.title || '제목 없는 카드'}</strong>`;
    cardEl.addEventListener('click', () => app.modals.openWorldviewCardModal(card, projectId, groupId));
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
    form.elements.synopsis.value = mainScenario.synopsis || '';
    form.elements.title.value = mainScenario.title || '';
    form.elements.themes.value = (mainScenario.themes || []).join(', ');

    let plotPointsHTML = '';
    if (mainScenario.plot_points && mainScenario.plot_points.length > 0) {
        plotPointsHTML = mainScenario.plot_points.map(plot => {
            const plotDataString = JSON.stringify(plot);
            const escapedPlotDataString = plotDataString.replace(/'/g, '&#39;');

            return `
            <article class="plot-point-item" style="position: relative; margin-bottom: 1rem; padding: 1rem; border: 1px solid var(--pico-muted-border-color); border-radius: 6px;">
                <button class="secondary outline open-plot-modal-btn" data-plot-point='${escapedPlotDataString}' style="position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.1rem 0.5rem; font-size: 0.75rem;">
                    편집
                </button>
                <h6>${plot.ordering + 1}. ${plot.title}</h6>
                <p style="margin:0; padding-right: 4rem;">${plot.content || '세부 내용 없음'}</p>
            </article>
        `}).join('');
    } else {
        plotPointsHTML = '<p>아직 작성된 플롯이 없습니다.</p>';
    }
    container.querySelector('#plot-list').innerHTML = plotPointsHTML;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', (e) => {
        app.handleSaveScenario(e, projectData.id, mainScenario.id);
    });

    const addPlotForm = container.querySelector('#add-plot-point-form');
    const newAddPlotForm = addPlotForm.cloneNode(true);
    addPlotForm.parentNode.replaceChild(newAddPlotForm, addPlotForm);
    newAddPlotForm.addEventListener('submit', (e) => {
        app.handleCreatePlotPoint(e, projectData.id, mainScenario.id);
    });

    const setupButtonListener = (id, handler) => {
        const button = container.querySelector(`#${id}`);
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', handler);
    };

    setupButtonListener('ai-draft-btn', () => openAiScenarioDraftModal(projectData, mainScenario.id));
    setupButtonListener('refine-concept-btn', () => app.handleRefineConcept());
    
    // [신규] '전체 삭제' 버튼 이벤트 리스너 연결
    const deleteAllPlotsBtn = container.querySelector('#delete-all-plots-btn');
    if (deleteAllPlotsBtn) {
        const newDeleteAllBtn = deleteAllPlotsBtn.cloneNode(true);
        deleteAllPlotsBtn.parentNode.replaceChild(newDeleteAllBtn, deleteAllPlotsBtn);
        newDeleteAllBtn.addEventListener('click', () => app.handleDeleteAllPlotPoints(projectData.id, mainScenario.id));
    }

    const plotList = container.querySelector('#plot-list');
    const newPlotList = plotList.cloneNode(true);
    plotList.parentNode.replaceChild(newPlotList, plotList);
    newPlotList.addEventListener('click', (e) => {
        const editButton = e.target.closest('.open-plot-modal-btn');
        if (editButton) {
            const plotData = JSON.parse(editButton.dataset.plotPoint);
            app.modals.openPlotPointEditModal(plotData, projectData.id, mainScenario.id);
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
        app.handleAiDraftGeneration(e, projectData.id, scenarioId);
    });

    // [버그 수정] 모달 닫기 이벤트 리스너 추가
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