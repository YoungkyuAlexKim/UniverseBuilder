/**
 * 동적 HTML 생성 및 화면 렌더링 관련 함수를 담당하는 모듈
 */

// 컴포넌트 모듈들 import
import { createCardElement, createEnhancedCardElement, initializeCharacterCard } from '../components/cards/character-card.js';
import { createWorldviewCardElement, createEnhancedWorldviewCardElement, initializeWorldviewCard } from '../components/cards/worldview-card.js';
import { openAiScenarioDraftModal, initializeAiScenarioDraftModal } from '../components/modals/ai-scenario-draft-modal.js';
import { createDynamicInputGroupHTML, addDynamicInputField } from '../components/forms/dynamic-input.js';
import { addWorldviewRuleInput, initializeWorldviewRuleInput } from '../components/forms/worldview-rule-input.js';
import { getShuffledMessages } from './ai-messages.js';

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

    // 컴포넌트 모듈들 초기화
    initializeCharacterCard(appInstance);
    initializeWorldviewCard(appInstance);
    initializeAiScenarioDraftModal(appInstance);
    initializeWorldviewRuleInput(appInstance, appInstance.eventManager);
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
                    <button class="secondary outline update-project-btn icon-only" data-project-id="${project.id}" data-current-name="${project.name}" title="이름 수정"><i data-lucide="pencil"></i></button>
                    <button class="secondary outline delete-project-btn icon-only" data-project-id="${project.id}" data-project-name="${project.name}" title="프로젝트 삭제"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            projectList.appendChild(li);
        });
    }
    // *** FIX: 프로젝트 목록을 렌더링한 직후 아이콘을 생성하도록 호출합니다. ***
    lucide.createIcons();
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
    // 아이콘 렌더링
    lucide.createIcons();
}

/**
 * 시작 화면(웰컴 뷰)을 표시합니다.
 */
export function showWelcomeView() {
    document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
    document.getElementById('welcome-view').classList.add('active');
}

/**
 * 프로젝트 로딩 오버레이를 표시합니다.
 */
export function showProjectLoadingOverlay() {
    const overlay = document.getElementById('project-loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * 프로젝트 로딩 오버레이를 숨깁니다.
 */
export function hideProjectLoadingOverlay() {
    const overlay = document.getElementById('project-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * 지정된 탭을 활성화합니다.
 * @param {string} tabId - 활성화할 탭의 ID ('characters', 'worldview', 'scenario', 'manuscript')
 */
export function activateTab(tabId) {
    console.log('UI: activateTab called with', tabId);
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const tabLink = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(`tab-content-${tabId}`);

    console.log('UI: tabLink found:', !!tabLink);
    console.log('UI: tabContent found:', !!tabContent);

    if (tabLink) {
        tabLink.classList.add('active');
    }

    if (tabContent) {
        tabContent.classList.add('active');
    }

    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        tabsContainer.scrollTop = 0;
    }

    // 탭이 활성화된 후 렌더링 트리거 - 이벤트 기반
    if (tabId === 'manuscript') {
        console.log('UI: Activating manuscript tab');
        console.log('UI: window.app exists:', !!window.app);
        console.log('UI: window.app.stateManager exists:', !!(window.app && window.app.stateManager));

        // 프로젝트 렌더링 완료 이벤트를 기다림
        if (window.app && window.app.stateManager) {
            const currentProject = window.app.stateManager.getState().currentProject;
            console.log('UI: currentProject exists:', !!currentProject);

            if (currentProject) {
                console.log('UI: Calling manuscript onTabActivated');
                // async 함수로 분리하여 await 사용
                (async () => {
                    try {
                        await window.app.call('manuscript', 'onTabActivated', currentProject);
                        console.log('UI: manuscript onTabActivated completed');
                    } catch (error) {
                        console.error('UI: manuscript onTabActivated failed:', error);
                    }
                })();
            } else {
                console.log('UI: Waiting for project to be rendered');
                // 프로젝트가 아직 로드되지 않은 경우 이벤트를 기다림
                const handleProjectRendered = async (project) => {
                    console.log('UI: Project rendered, calling manuscript onTabActivated');
                    try {
                        await window.app.call('manuscript', 'onTabActivated', project);
                        console.log('UI: manuscript onTabActivated completed after project render');
                    } catch (error) {
                        console.error('UI: manuscript onTabActivated failed after project render:', error);
                    }
                    window.app.stateManager.off('project:rendered', handleProjectRendered);
                };
                window.app.stateManager.on('project:rendered', handleProjectRendered);
            }
        } else {
            console.error('UI: window.app or stateManager not available');
        }
    }
}


// --- 각 탭의 세부 렌더링 함수 ---

function renderCharacterTab(projectData) {
    const container = document.getElementById('card-list-container');

    eventManager.replaceContentSafely(container, `
        <div class="character-tab-header">
            <button id="show-generator-btn" class="contrast"><i data-lucide="user-plus"></i>새 인물 AI 생성</button>
        </div>
    `, (container) => {
        const generatorBtn = container.querySelector('#show-generator-btn');
        if (generatorBtn) {
            eventManager.addEventListener(generatorBtn, 'click', () => app.call('characterGeneration', 'openCharacterGenerationModal', projectData.id));
        }
    });

    // 그룹별 섹션으로 캐릭터들을 표시
    (projectData.groups || []).forEach(group => {
        const groupSection = document.createElement('div');
        groupSection.className = 'character-group-section';
        
        groupSection.innerHTML = `
            <div class="character-group-header">
                <h3><i data-lucide="users"></i>${group.name}</h3>
                <div class="character-group-actions">
                    ${group.name !== '미분류' ? `<button class="outline secondary icon-only delete-group-btn" data-group-id="${group.id}" data-group-name="${group.name}" title="그룹 삭제"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
            </div>
            <div class="character-cards-grid" data-group-id="${group.id}"></div>
        `;

        const cardsGridEl = groupSection.querySelector('.character-cards-grid');
        if (group.cards?.length > 0) {
            group.cards.forEach(card => {
                cardsGridEl.appendChild(createEnhancedCardElement(card, projectData.id, group.id));
            });
        } else {
            cardsGridEl.innerHTML = '<div class="character-empty-state"><p>이 그룹에 캐릭터가 없습니다.</p><small>위의 "새 인물 AI 생성" 버튼을 눌러 캐릭터를 만들어보세요!</small></div>';
        }

        container.appendChild(groupSection);
    });

    // 새 그룹 생성 섹션 추가
    const addGroupSection = document.createElement('div');
    addGroupSection.className = 'character-group-section add-group-section';
    addGroupSection.innerHTML = `
        <div class="character-group-header">
            <h3>+ 새 그룹 만들기</h3>
        </div>
        <form class="add-group-form">
            <input type="text" name="name" placeholder="새 그룹 이름 (예: 주인공들, 조연, 악역)" required autocomplete="off">
            <button type="submit" class="secondary"><i data-lucide="plus"></i>그룹 추가</button>
        </form>
    `;
    
    const addGroupForm = addGroupSection.querySelector('.add-group-form');
    eventManager.addEventListener(addGroupForm, 'submit', (e) => app.call('character', 'handleCreateGroup', e, projectData.id));
    container.appendChild(addGroupSection);

    // 기존 그룹 삭제 이벤트 등록
    container.querySelectorAll('.delete-group-btn').forEach(button => {
        eventManager.addEventListener(button, 'click', (e) => {
            const { groupId, groupName } = e.currentTarget.dataset;
            app.call('character', 'handleDeleteGroup', projectData.id, groupId, groupName);
        });
    });

    app.call('character', 'setupSortable', container.querySelectorAll('.character-cards-grid'), projectData.id, 'character');
}





function renderWorldviewTab(projectData) {
    const worldview = projectData.worldview || { logline: '', genre: '', rules: [] };

    // [수정] 폼 전체를 교체하는 대신, 내용만 업데이트합니다.
    const form = document.getElementById('worldview-form');
    const loglineInput = form.querySelector('#worldview-logline');
    const genreInput = form.querySelector('#worldview-genre');
    const rulesContainer = form.querySelector('#worldview-rules-container');
    const addRuleBtn = form.querySelector('#add-worldview-rule-btn');

    // 기존 이벤트 리스너들을 제거하여 중복 방지
    eventManager.removeAllEventListeners(form);
    eventManager.removeAllEventListeners(addRuleBtn);

    loglineInput.value = worldview.logline || '';
    genreInput.value = worldview.genre || '';
    rulesContainer.innerHTML = ''; // 기존 규칙 필드를 비웁니다.

    if (worldview.rules && worldview.rules.length > 0) {
        worldview.rules.forEach(ruleText => {
            addWorldviewRuleInput(ruleText, projectData.id, rulesContainer);
        });
    } else {
        // 기본 3개의 빈 필드를 생성합니다.
        addWorldviewRuleInput('', projectData.id, rulesContainer);
        addWorldviewRuleInput('', projectData.id, rulesContainer);
        addWorldviewRuleInput('', projectData.id, rulesContainer);
    }

    // [수정] EventManager를 사용하여 이벤트 리스너를 안전하게 (재)설정합니다.
    eventManager.addEventListener(form, 'submit', (e) => {
        e.preventDefault();
        app.call('worldview', 'handleSaveWorldview', projectData.id);
    });

    eventManager.addEventListener(addRuleBtn, 'click', () => addWorldviewRuleInput('', projectData.id, rulesContainer));

    // --- 서브 설정 카드 렌더링 로직 (현대적 그리드 시스템) ---
    const container = document.getElementById('worldview-card-list-container');
    container.innerHTML = ''; 

    // 그룹별로 섹션 생성
    (projectData.worldview_groups || []).forEach(group => {
        const groupSection = document.createElement('div');
        groupSection.className = 'worldview-group-section';
        
        groupSection.innerHTML = `
            <div class="worldview-group-header">
                <h4><i data-lucide="folder"></i>${group.name}</h4>
                <div class="worldview-group-actions">
                    <button class="secondary outline add-wv-card-btn" data-group-id="${group.id}"><i data-lucide="plus"></i>새 카드</button>
                    ${group.name !== '기본 설정' ? `<button class="outline secondary icon-only delete-wv-group-btn" data-group-id="${group.id}" data-group-name="${group.name}" title="그룹 삭제"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
            </div>
            <div class="worldview-cards-grid" data-group-id="${group.id}"></div>
        `;

        const cardsGridEl = groupSection.querySelector('.worldview-cards-grid');
        if (group.worldview_cards?.length > 0) {
            group.worldview_cards.forEach(card => {
                cardsGridEl.appendChild(createEnhancedWorldviewCardElement(card, projectData.id, group.id));
            });
        } else {
            cardsGridEl.innerHTML = '<div class="worldview-empty-state"><p>이 그룹에 설정 카드가 없습니다.</p><small>위의 "+ 새 카드" 버튼을 눌러 세계관 설정을 추가해보세요!</small></div>';
        }

        container.appendChild(groupSection);
    });

    // 새 그룹 추가 섹션
    const addGroupSection = document.createElement('div');
    addGroupSection.className = 'worldview-group-section';
    addGroupSection.innerHTML = `
        <div class="worldview-group-header">
            <h4>+ 새 설정 그룹 만들기</h4>
        </div>
        <form class="add-group-form">
            <input type="text" name="name" placeholder="새 설정 그룹 이름 (예: 마법 시스템, 정치 구조, 지리)" required autocomplete="off">
            <button type="submit" class="secondary"><i data-lucide="plus"></i>그룹 추가</button>
        </form>
    `;
    
    const addGroupForm = addGroupSection.querySelector('.add-group-form');
    eventManager.addEventListener(addGroupForm, 'submit', (e) => app.call('worldview', 'handleCreateWorldviewGroup', e, projectData.id));
    container.appendChild(addGroupSection);

    // 이벤트 등록
    container.querySelectorAll('.delete-wv-group-btn').forEach(btn => {
        eventManager.addEventListener(btn, 'click', (e) => app.call('worldview', 'handleDeleteWorldviewGroup', e, projectData.id));
    });
    container.querySelectorAll('.add-wv-card-btn').forEach(btn => {
        eventManager.addEventListener(btn, 'click', (e) => app.modals.openWorldviewCardModal(null, projectData.id, e.currentTarget.dataset.groupId));
    });
    
    app.call('character', 'setupSortable', container.querySelectorAll('.worldview-cards-grid'), projectData.id, 'worldview');
}







function renderScenarioTab(projectData) {
    const container = document.getElementById('tab-content-scenario');
    const mainScenario = projectData.scenarios && projectData.scenarios[0];

    if (!mainScenario) {
        container.innerHTML = '<p>시나리오 데이터를 불러오지 못했습니다.</p>';
        return;
    }

    const scenarioTabHTML = `
        <article>
            <hgroup>
                <h4>메인 스토리 (사건의 흐름)</h4>
                <p>세계관이라는 무대 위에서 벌어지는 구체적인 '사건'의 흐름을 설계하는 공간입니다.</p>
            </hgroup>
            <form id="scenario-details-form">
                <div class="input-with-button">
                    <label for="scenario-summary">이야기 핵심 컨셉 (Logline)</label>
                    <button type="button" id="refine-concept-btn" class="secondary outline"><i data-lucide="lightbulb"></i>컨셉 다듬기 (AI)</button>
                </div>
                <input type="text" id="scenario-summary" name="summary" placeholder="이 이야기를 한 문장으로 요약합니다. (예: 몰락한 왕국의 기사가 현대로 넘어와 자신의 세계를 구원할 방법을 찾는다.)">
                
                <div class="input-with-button">
                    <label for="scenario-synopsis">시놉시스 / 전체 줄거리 (Synopsis)</label>
                    <button type="button" id="enhance-synopsis-btn" class="secondary outline"><i data-lucide="pen-tool"></i>AI 스토리 구체화</button>
                </div>
                <textarea id="scenario-synopsis" name="synopsis" rows="5" placeholder="이야기의 전체적인 흐름과 구조를 자유롭게 서술합니다. 한 줄 아이디어부터 상세한 줄거리까지, AI와 함께 발전시켜 나갈 수 있습니다."></textarea>

                <div class="grid">
                    <label for="scenario-title">
                        시나리오 제목
                        <input type="text" id="scenario-title" name="title" placeholder="시나리오의 제목">
                    </label>
                    <label for="scenario-themes">
                        핵심 테마 (쉼표로 구분)
                        <input type="text" id="scenario-themes" name="themes" placeholder="예: 복수, 희생, 구원">
                    </label>
                </div>
                
                <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="submit" style="width: auto;">시나리오 정보 저장</button>
                </div>
            </form>
        </article>
        <hr>
        <div id="plot-points-container">
            <div class="plot-points-header">
                <h4>플롯 포인트</h4>
                <div class="plot-buttons-group">
                    <button type="button" id="ai-draft-btn" class="contrast"><i data-lucide="file-plus-2"></i>AI로 전체 스토리 초안 생성</button>
                    <button type="button" id="ai-edit-plots-btn" class="secondary"><i data-lucide="pencil-ruler"></i>AI로 전체 플롯 수정</button>
                    <button type="button" id="ai-edit-selected-btn" class="secondary outline" style="display: none;"><i data-lucide="check-square"></i>선택한 플롯 수정</button>
                    <button id="delete-all-plots-btn" class="secondary outline">전체 삭제</button>
                </div>
            </div>
            <div id="plot-list">
                <!-- Plot points will be rendered here -->
            </div>
            <form id="add-plot-point-form" style="margin-top: 1.5rem; border-top: 1px solid var(--pico-muted-border-color); padding-top: 1.5rem;">
                <label for="new-plot-title"><strong>새 플롯 추가</strong></label>
                <input type="text" id="new-plot-title" name="title" placeholder="플롯 제목 (예: 주인공의 각성)" required>
                <textarea name="content" rows="3" placeholder="세부 내용 (선택 사항)"></textarea>
                <button type="submit" style="width: auto;"><i data-lucide="plus"></i>플롯 추가</button>
            </form>
        </div>
    `;

    eventManager.replaceContentSafely(container, scenarioTabHTML, (newContainer) => {
        const form = newContainer.querySelector('#scenario-details-form');
        form.elements.summary.value = mainScenario.summary || '';
        form.elements.synopsis.value = mainScenario.synopsis || '';
        form.elements.title.value = mainScenario.title || '';
        form.elements.themes.value = (mainScenario.themes || []).join(', ');

        let plotPointsHTML = '';
        if (mainScenario.plot_points && mainScenario.plot_points.length > 0) {
            plotPointsHTML = mainScenario.plot_points.map(plot => {
                const plotDataString = JSON.stringify(plot);
                const escapedPlotDataString = plotDataString.replace(/'/g, '&#39;');
                const hasScene = plot.scene_draft && plot.scene_draft.trim().length > 0;
                const contentPreview = plot.content ? 
                    (plot.content.length > 150 ? plot.content.substring(0, 150) + '...' : plot.content) 
                    : '세부 내용 없음';
                
                return `
                <article class="plot-point-card" data-plot-id="${plot.id}">
                    <div class="plot-card-header">
                        <input type="checkbox" class="plot-select-checkbox" data-plot-id="${plot.id}" style="margin-right: 0.5rem; display: none;">
                        <div class="plot-card-number">${plot.ordering + 1}</div>
                        <h5 class="plot-card-title">${plot.title}</h5>
                        <div class="plot-card-badges">
                            ${hasScene ? '<span class="plot-badge scene-ready">💡 장면</span>' : '<span class="plot-badge no-scene">📝 요약만</span>'}
                        </div>
                    </div>
                    <div class="plot-card-content">
                        <p class="plot-card-summary">${contentPreview}</p>
                        ${hasScene ? `<div class="plot-scene-preview">
                            <small>장면 미리보기:</small>
                            <p>${plot.scene_draft.substring(0, 80)}...</p>
                        </div>` : ''}
                    </div>
                    <div class="plot-card-actions">
                        <button class="secondary outline open-plot-modal-btn" data-plot-point='${escapedPlotDataString}'>
                            <i data-lucide="edit"></i>편집
                        </button>
                        <button class="contrast outline ai-quick-edit-btn" data-plot-point='${escapedPlotDataString}' title="AI로 내용 수정">
                            <i data-lucide="sparkles"></i>AI 수정
                        </button>
                    </div>
                </article>
                `;
            }).join('');
        } else {
            plotPointsHTML = '<p>아직 작성된 플롯이 없습니다.</p>';
        }
        newContainer.querySelector('#plot-list').innerHTML = plotPointsHTML;

        eventManager.addEventListener(form, 'submit', (e) => {
            app.call('scenario', 'handleSaveScenario', e, projectData.id, mainScenario.id);
        });

        const addPlotForm = newContainer.querySelector('#add-plot-point-form');
        eventManager.addEventListener(addPlotForm, 'submit', (e) => {
            app.call('scenario', 'handleCreatePlotPoint', e, projectData.id, mainScenario.id);
        });

        const setupButtonListener = (selector, handler) => {
            const button = newContainer.querySelector(selector);
            if (button) {
                eventManager.addEventListener(button, 'click', handler);
            }
        };

        setupButtonListener('#refine-concept-btn', () => app.call('scenario', 'handleRefineConcept'));
        setupButtonListener('#enhance-synopsis-btn', () => app.call('scenario', 'handleEnhanceSynopsis'));
        setupButtonListener('#ai-draft-btn', () => openAiScenarioDraftModal(projectData, mainScenario.id));
        setupButtonListener('#ai-edit-plots-btn', () => app.call('scenario', 'handleAiEditPlots'));
        setupButtonListener('#ai-edit-selected-btn', () => app.call('scenario', 'handleAiEditSelectedPlots'));
        setupButtonListener('#delete-all-plots-btn', () => app.call('scenario', 'handleDeleteAllPlotPoints', projectData.id, mainScenario.id));

        const plotList = newContainer.querySelector('#plot-list');
        eventManager.addEventListener(plotList, 'click', (e) => {
            const editButton = e.target.closest('.open-plot-modal-btn');
            const aiEditButton = e.target.closest('.ai-quick-edit-btn');

            if (editButton) {
                const plotData = JSON.parse(editButton.dataset.plotPoint);
                app.modals.openPlotPointEditModal(plotData, projectData.id, mainScenario.id);
            } else if (aiEditButton) {
                const plotData = JSON.parse(aiEditButton.dataset.plotPoint);
                app.call('scenario', 'handleAiEditPlotPoint', plotData, projectData.id, mainScenario.id);
            }
        });
    });
}

// 전역 플래그로 중복 실행 방지
const renderedTabs = new Set();

// 스타일 가이드 관련 함수들은 main.js로 이동됨

// [신규] 집필 내보내기 모달
// -------------------------

function openExportModal(projectData) {
    const modal = document.getElementById('manuscript-export-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const confirmBtn = document.getElementById('manuscript-export-confirm-btn');
    const cancelBtn = document.getElementById('manuscript-export-cancel-btn');
    const warningDiv = document.getElementById('export-warning');

    const blockCount = projectData.manuscript_blocks?.length || 0;

    // AI 제한 경고 표시
    if (blockCount > 50) {
        warningDiv.style.display = 'block';
    } else {
        warningDiv.style.display = 'none';
    }

    // 확인 버튼 이벤트
    const confirmHandler = () => {
        app.call('manuscript', 'handleExportToScenario', projectData.id);
        closeModal();
    };

    // 취소 버튼 이벤트
    const cancelHandler = () => {
        closeModal();
    };

    // 모달 닫기 함수
    const closeModal = () => {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        modal.querySelector('.close').removeEventListener('click', cancelHandler);
    };

    // 이벤트 리스너 설정
    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    modal.querySelector('.close').addEventListener('click', cancelHandler);

    // 모달 표시
    modal.classList.add('active');
    backdrop.classList.add('active');
}

// --- 필요한 함수들을 명명된 export로 추가 ---
export { createDynamicInputGroupHTML, addDynamicInputField, addWorldviewRuleInput };

// ui 객체도 함께 export하여 하위 호환성 유지
const ui = {
    createDynamicInputGroupHTML,
    addDynamicInputField,
    addWorldviewRuleInput
};

/**
 * 텍스트 필드에 AI 타이핑 애니메이션과 Lucide 아이콘을 표시합니다.
 * @param {HTMLTextAreaElement} textarea - 애니메이션을 표시할 텍스트 영역
 * @param {HTMLElement} iconContainer - Lucide 아이콘을 표시할 컨테이너
 * @returns {Function} 애니메이션을 중지하는 함수
 */
export function showAiWritingAnimation(textarea, iconContainer) {
    const shuffledMessages = getShuffledMessages();
    let messageIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId;

    const type = () => {
        const currentItem = shuffledMessages[messageIndex];
        const fullMessage = currentItem.text;

        // 아이콘 업데이트
        iconContainer.innerHTML = `<i data-lucide="${currentItem.icon}" style="width: 24px; height: 24px; color: var(--pico-primary);"></i>`;
        if (window.lucide) {
            window.lucide.createIcons();
        }

        if (isDeleting) {
            charIndex--;
        } else {
            charIndex++;
        }

        // textarea나 일반 DOM 요소 모두 지원
        const displayText = fullMessage.substring(0, charIndex) + '█';
        if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
            textarea.value = displayText;
        } else {
            textarea.textContent = displayText;
        }

        if (!isDeleting && charIndex === fullMessage.length) {
            isDeleting = true;
            timeoutId = setTimeout(type, 2000);
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            messageIndex = (messageIndex + 1) % shuffledMessages.length;
            timeoutId = setTimeout(type, 500);
        } else {
            timeoutId = setTimeout(type, isDeleting ? 50 : 100);
        }
    };

    type();

    return () => {
        clearTimeout(timeoutId);
    };
}

// 기본 export
export default ui;

