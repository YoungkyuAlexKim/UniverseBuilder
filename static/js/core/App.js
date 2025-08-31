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
        this.projectController = new ProjectController(this);
        this.characterController = new CharacterController(this);
        this.worldviewController = new WorldviewController(this);
        this.scenarioController = new ScenarioController(this);
        this.manuscriptController = new ManuscriptController(this);
        this.characterGenerationController = new CharacterGenerationController(this);
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
            this.projectController.handleCreateProject(e));
        
        // 프로젝트 리스트 이벤트 (위임)
        document.querySelector('.project-list').addEventListener('click', (e) => {
             if (e.target.matches('.project-name-span')) {
                this.projectController.handleSelectProject(e.target.dataset.id);
            } else if (e.target.matches('.update-project-btn')) {
                this.projectController.handleUpdateProject(e);
            } else if (e.target.matches('.delete-project-btn')) {
                this.projectController.handleDeleteProject(e);
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

    // --- 컨트롤러 메소드 위임 ---

    // 캐릭터 관련
    async handleCreateGroup(event, projectId) {
        return this.characterController.handleCreateGroup(event, projectId);
    }

    async handleDeleteGroup(projectId, groupId, groupName) {
        return this.characterController.handleDeleteGroup(projectId, groupId, groupName);
    }

    async handleDeleteCard(projectId, groupId, cardId) {
        return this.characterController.handleDeleteCard(projectId, groupId, cardId);
    }

    setupSortable(lists, projectId, type) {
        return this.characterController.setupSortable(lists, projectId, type);
    }

    // 세계관 관련
    async handleSaveWorldview(projectId) {
        return this.worldviewController.handleSaveWorldview(projectId);
    }

    async handleCreateWorldviewGroup(event, projectId) {
        return this.worldviewController.handleCreateWorldviewGroup(event, projectId);
    }

    async handleDeleteWorldviewGroup(event, projectId) {
        return this.worldviewController.handleDeleteWorldviewGroup(event, projectId);
    }

    async handleDeleteWorldviewCard(projectId, cardId) {
        return this.worldviewController.handleDeleteWorldviewCard(projectId, cardId);
    }

    async handleRefineWorldviewRule(event, projectId, inputField) {
        return this.worldviewController.handleRefineWorldviewRule(event, projectId, inputField);
    }

    // 시나리오 관련
    async handleSaveScenario(event, projectId, scenarioId) {
        return this.scenarioController.handleSaveScenario(event, projectId, scenarioId);
    }

    async handleCreatePlotPoint(event, projectId, scenarioId) {
        return this.scenarioController.handleCreatePlotPoint(event, projectId, scenarioId);
    }

    async handleAiDraftGeneration(event, projectId, scenarioId) {
        return this.scenarioController.handleAiDraftGeneration(event, projectId, scenarioId);
    }

    async handleAiEditPlots() {
        return this.scenarioController.handleAiEditPlots();
    }

    async handleUpdatePlotPoint(form, projectId, scenarioId) {
        return this.scenarioController.handleUpdatePlotPoint(form, projectId, scenarioId);
    }

    async handleDeletePlotPoint(plotPointId, projectId, scenarioId) {
        return this.scenarioController.handleDeletePlotPoint(plotPointId, projectId, scenarioId);
    }

    async handleDeleteAllPlotPoints(projectId, scenarioId) {
        return this.scenarioController.handleDeleteAllPlotPoints(projectId, scenarioId);
    }

    async handleAiSceneGeneration(plotPointId, projectId, scenarioId) {
        return this.scenarioController.handleAiSceneGeneration(plotPointId, projectId, scenarioId);
    }

    async handleAiSceneEdit(plotPointId, projectId, scenarioId) {
        return this.scenarioController.handleAiSceneEdit(plotPointId, projectId, scenarioId);
    }

    async handleAiEditPlotPoint(plotPoint, projectId, scenarioId) {
        return this.scenarioController.handleAiEditPlotPoint(plotPoint, projectId, scenarioId);
    }

    async handleRefineConcept() {
        return this.scenarioController.handleRefineConcept();
    }

    async handleEnhanceSynopsis() {
        return this.scenarioController.handleEnhanceSynopsis();
    }

    // 집필 관련
    async handleImportManuscript(projectId, scenarioId) {
        return this.manuscriptController.handleImportManuscript(projectId, scenarioId);
    }

    async handleClearManuscript(projectId) {
        return this.manuscriptController.handleClearManuscript(projectId);
    }

    async handleSaveManuscriptBlock(projectId, blockId) {
        return this.manuscriptController.handleSaveManuscriptBlock(projectId, blockId);
    }

    async handleUpdateManuscriptOrder(projectId, blockIds) {
        return this.manuscriptController.handleUpdateManuscriptOrder(projectId, blockIds);
    }

    openManuscriptAIModal() {
        return this.manuscriptController.openManuscriptAIModal();
    }

    openPartialRefineModal(selectedText, surroundingContext) {
        return this.manuscriptController.openPartialRefineModal(selectedText, surroundingContext);
    }

    async handleMergeManuscriptBlocks(projectId, blockIds) {
        return this.manuscriptController.handleMergeManuscriptBlocks(projectId, blockIds);
    }

    async handleSplitManuscriptBlock(projectId, blockId, splitPosition) {
        return this.manuscriptController.handleSplitManuscriptBlock(projectId, blockId, splitPosition);
    }

    async handleDeleteManuscriptBlock(projectId, blockId) {
        return this.manuscriptController.handleDeleteManuscriptBlock(projectId, blockId);
    }

    async handleExportToScenario(projectId, mode) {
        return this.manuscriptController.handleExportToScenario(projectId, mode);
    }

    // 캐릭터 생성 관련
    openCharacterGenerationModal(projectId) {
        return this.characterGenerationController.openCharacterGenerationModal(projectId);
    }

    formatCharacterForDisplay(characterData) {
        return this.characterGenerationController.formatCharacterForDisplay(characterData);
    }
}
