import { StateManager } from './StateManager.js';
import { EventListenerManager } from './EventListenerManager.js';
import * as ui from '../modules/ui.js';
import * as modals from '../modules/modals.js';
import * as panels from '../modules/panels.js';

// 개별 패널 모듈들을 import
import { showCharacterGeneratorUI } from '../modules/panels/character-generator.js';
import { showRelationshipPanel } from '../modules/panels/relationship-panel.js';
import { showRelationshipTimelinePanel, initializeRelationshipTimelinePanel } from '../modules/panels/relationship-timeline-panel.js';  // [추가] 타임라인 패널
import { handleEditCardAI, handleManualEditCard } from '../modules/panels/character-editor.js';
import { handleEditWorldviewCardAI } from '../modules/panels/worldview-editor.js';

// 공통 AI 모달 import
import * as commonAiModal from '../modules/common-ai-modal.js';

// 컨트롤러들을 import
import { ProjectController } from '../controllers/ProjectController.js';
import { CharacterController } from '../controllers/CharacterController.js';
import { WorldviewController } from '../controllers/WorldviewController.js';
import { ScenarioController } from '../controllers/ScenarioController.js';
import { ManuscriptController } from '../controllers/ManuscriptController.js';
import { CharacterGenerationController } from '../controllers/CharacterGenerationController.js';

/**
 * 애플리케이션의 메인 컨트롤러 클래스.
 * 모든 모듈을 초기화하고, 상태 변경을 감지하며, 이벤트에 따라 각 컨트롤러의 동작을 조율합니다.
 */
export class App {
    constructor() {
        this.stateManager = new StateManager();
        this.eventManager = new EventListenerManager();
        this.panels = {
            showCharacterGeneratorUI,
            showRelationshipPanel,
            showRelationshipTimelinePanel,  // [추가] 관계 타임라인 패널
            handleEditCardAI,
            handleManualEditCard,
            handleEditWorldviewCardAI,
            showProjectLoadingOverlay: () => ui.showProjectLoadingOverlay(),
            hideProjectLoadingOverlay: () => ui.hideProjectLoadingOverlay()
        };
        this.modals = { ...modals };
        
        // 컨트롤러들 초기화
        this.initializeControllers();
        this.initializeModules();
        this.bindEventListeners();
        this.stateManager.loadProjects();
    }

    /**
     * 각 기능별 컨트롤러들을 초기화합니다.
     */
    initializeControllers() {
        this.controllers = {
            project: new ProjectController(this),
            character: new CharacterController(this),
            worldview: new WorldviewController(this),
            scenario: new ScenarioController(this),
            manuscript: new ManuscriptController(this),
            characterGeneration: new CharacterGenerationController(this)
        };
    }

    /**
     * 애플리케이션에서 사용하는 모든 모듈을 초기화합니다.
     */
    initializeModules() {
        ui.initializeUI(this);
        modals.initializeModals(this);
        panels.initializePanels(this);
        commonAiModal.initializeCommonAiModal(this);
    }

    /**
     * StateManager와 DOM의 이벤트를 구독하고, 해당 이벤트가 발생했을 때 수행할 동작을 정의합니다.
     */
    bindEventListeners() {
        this.stateManager.on('stateChanged', (state) => this.renderUI(state));
        this.stateManager.on('error', (errorMessage) => alert(errorMessage));
        
        // 프로젝트 생성 폼
        document.getElementById('create-project-form').addEventListener('submit', (e) =>
            this.call('project', 'handleCreateProject', e));

        // 프로젝트 리스트 이벤트 (위임)
        document.querySelector('.project-list').addEventListener('click', (e) => {
            const target = e.target.closest('button, span');
            if (!target) return;

            if (target.matches('.project-name-span')) {
                this.call('project', 'handleSelectProject', target.dataset.id);
            } else if (target.matches('.update-project-btn')) {
                // 안전하게 이벤트 객체 생성
                const eventData = {
                    stopPropagation: () => e.stopPropagation(),
                    preventDefault: () => e.preventDefault(),
                    currentTarget: target,
                    target: e.target,
                    type: e.type
                };
                this.call('project', 'handleUpdateProject', eventData);
            } else if (target.matches('.delete-project-btn')) {
                // 안전하게 이벤트 객체 생성
                const eventData = {
                    stopPropagation: () => e.stopPropagation(),
                    preventDefault: () => e.preventDefault(),
                    currentTarget: target,
                    target: e.target,
                    type: e.type
                };
                this.call('project', 'handleDeleteProject', eventData);
            }
        });

        // 탭 네비게이션
        document.querySelector('#project-detail-view nav ul').addEventListener('click', (e) => {
            if(e.target.matches('.tab-link')) {
                e.preventDefault();
                ui.activateTab(e.target.dataset.tab);
            }
        });
    }
    
    /**
     * 현재 상태(state)를 기반으로 전체 UI를 다시 렌더링합니다.
     * @param {object} state - StateManager가 관리하는 현재 애플리케이션 상태
     */
    renderUI(state) {
        ui.renderProjectList(state.projects);
        if (state.currentProject) {
            ui.renderProjectDetail(state.currentProject);
            // 프로젝트 상세 렌더링 완료 이벤트 발생
            this.stateManager.emit('project:rendered', state.currentProject);
        } else {
            ui.showWelcomeView();
        }
    }

    /**
     * 지정된 컨트롤러의 메서드를 동적으로 호출합니다.
     * @param {string} controllerName - 호출할 컨트롤러의 이름 (예: 'character', 'project')
     * @param {string} methodName - 호출할 메서드의 이름
     * @param {...any} args - 메서드에 전달할 인자들
     */
    call(controllerName, methodName, ...args) {
        const controller = this.controllers[controllerName];
        if (controller && typeof controller[methodName] === 'function') {
            return controller[methodName](...args);
        } else {
            console.error(`${controllerName} 컨트롤러의 ${methodName} 메서드를 찾을 수 없습니다.`);
        }
    }
}
