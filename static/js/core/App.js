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
        // 이벤트 처리 상태 관리
        this.eventProcessingFlags = {
            projectDelete: false,
            projectUpdate: false,
            projectSelect: false,
            settingUpListeners: false
        };

        this.stateManager = new StateManager();
        this.eventManager = new EventListenerManager();
        this.ui = ui; // ui 모듈을 App 인스턴스의 속성으로 설정
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

        // DOM이 완전히 로드된 후 초기 이벤트 리스너 설정
        const initializeEventListeners = () => {
            if (!this.eventProcessingFlags.settingUpListeners) {
                setTimeout(() => this.setupProjectListEventListeners(), 100);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeEventListeners);
        } else {
            initializeEventListeners();
        }
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

        // 프로젝트 리스트 렌더링 후 이벤트 리스너 재설정 (더 안정적인 타이밍)
        requestAnimationFrame(() => {
            setTimeout(() => this.setupProjectListEventListeners(), 50);
        });
    }

    /**
     * 프로젝트 리스트의 각 버튼에 개별 이벤트 리스너를 등록합니다.
     */
    setupProjectListEventListeners() {
        // 이벤트 처리 중이면 대기
        if (this.eventProcessingFlags.settingUpListeners) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Event listener setup already in progress, skipping');
            }
            return;
        }

        this.eventProcessingFlags.settingUpListeners = true;

        try {
            // 기존 이벤트 리스너들 정리
            this.cleanupProjectListEventListeners();

                    // 프로젝트 이름 클릭 이벤트 (mousedown + click)
        const projectNameSpans = document.querySelectorAll('.project-name-span:not([data-event-registered])');
        projectNameSpans.forEach(span => {
            span.addEventListener('mousedown', this.handleProjectNameMouseDown.bind(this), { passive: false });
            span.addEventListener('click', this.handleProjectNameClick.bind(this), { passive: false });
            span.setAttribute('data-event-registered', 'true');

            if (window.location.hostname === 'localhost') {
                console.log('📝 Registered unified listeners for project:', span.dataset.id);
            }
        });

        // 프로젝트 수정 버튼 이벤트 (mousedown + click)
        const updateButtons = document.querySelectorAll('.update-project-btn:not([data-event-registered])');
        updateButtons.forEach(btn => {
            btn.addEventListener('mousedown', this.handleProjectUpdateMouseDown.bind(this), { passive: false });
            btn.addEventListener('click', this.handleProjectUpdateClick.bind(this), { passive: false });
            btn.setAttribute('data-event-registered', 'true');

            if (window.location.hostname === 'localhost') {
                console.log('✏️ Registered unified listeners for update button:', btn.dataset.projectId);
            }
        });

        // 프로젝트 삭제 버튼 이벤트 (mousedown + click)
        const deleteButtons = document.querySelectorAll('.delete-project-btn:not([data-event-registered])');
        deleteButtons.forEach(btn => {
            btn.addEventListener('mousedown', this.handleProjectDeleteMouseDown.bind(this), { passive: false });
            btn.addEventListener('click', this.handleProjectDeleteClick.bind(this), { passive: false });
            btn.setAttribute('data-event-registered', 'true');

            if (window.location.hostname === 'localhost') {
                console.log('🗑️ Registered unified listeners for delete button:', btn.dataset.projectId);
            }
        });

            if (window.location.hostname === 'localhost') {
                console.log(`🎯 Total event listeners registered: ${projectNameSpans.length + updateButtons.length + deleteButtons.length}`);
            }
        } finally {
            this.eventProcessingFlags.settingUpListeners = false;
        }
    }

    /**
     * 프로젝트 리스트 이벤트 리스너들을 정리합니다.
     */
    cleanupProjectListEventListeners() {
        // 기존 이벤트 리스너들을 명시적으로 제거 (mousedown + click)
        const projectNameSpans = document.querySelectorAll('.project-name-span[data-event-registered]');
        projectNameSpans.forEach(span => {
            span.removeEventListener('mousedown', this.handleProjectNameMouseDown);
            span.removeEventListener('click', this.handleProjectNameClick);
            span.removeAttribute('data-event-registered');
        });

        const updateButtons = document.querySelectorAll('.update-project-btn[data-event-registered]');
        updateButtons.forEach(btn => {
            btn.removeEventListener('mousedown', this.handleProjectUpdateMouseDown);
            btn.removeEventListener('click', this.handleProjectUpdateClick);
            btn.removeAttribute('data-event-registered');
        });

        const deleteButtons = document.querySelectorAll('.delete-project-btn[data-event-registered]');
        deleteButtons.forEach(btn => {
            btn.removeEventListener('mousedown', this.handleProjectDeleteMouseDown);
            btn.removeEventListener('click', this.handleProjectDeleteClick);
            btn.removeAttribute('data-event-registered');
        });

        if (window.location.hostname === 'localhost') {
            console.log('🧹 Cleaned up project list event listeners');
        }
    }

    /**
     * 프로젝트 이름 통합 핸들러 (mousedown + click)
     */
    handleProjectNameMouseDown(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('👆 Project name mousedown - starting selection');
        }

        // 이미 처리 중이면 무시
        if (this.eventProcessingFlags.projectSelect) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project select already in progress, ignoring');
            }
            return;
        }

        this.handleProjectSelect(target);
    }

    /**
     * 프로젝트 이름 통합 핸들러 (mousedown + click)
     */
    handleProjectNameClick(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('📂 Project name click - starting selection');
        }

        // 이미 처리 중이면 무시
        if (this.eventProcessingFlags.projectSelect) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project select already in progress, ignoring');
            }
            return;
        }

        this.handleProjectSelect(target);
    }

    /**
     * 프로젝트 선택 처리 (공통 로직)
     */
    async handleProjectSelect(target) {
        const projectId = target.dataset.id;

        if (!projectId) {
            console.error('Missing project ID');
            return;
        }

        this.eventProcessingFlags.projectSelect = true;

        try {
            // 즉각적인 시각적 피드백
            target.style.backgroundColor = 'var(--bg-elevated)';
            target.style.transform = 'scale(0.98)';

            if (window.location.hostname === 'localhost') {
                console.log('🔄 Starting project selection for:', projectId);
            }

            await this.call('project', 'handleSelectProject', projectId);

            if (window.location.hostname === 'localhost') {
                console.log('✅ Project selection completed');
            }

        } catch (error) {
            console.error('Project selection failed:', error);
        } finally {
            this.eventProcessingFlags.projectSelect = false;
            // 시각적 피드백 복원
            target.style.transform = '';
            setTimeout(() => {
                target.style.backgroundColor = '';
            }, 150);
        }
    }

    /**
     * 프로젝트 수정 버튼 통합 핸들러 (mousedown + click)
     */
    handleProjectUpdateMouseDown(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('👆 Update button mousedown - starting update');
        }

        // 이미 처리 중이면 무시
        if (this.eventProcessingFlags.projectUpdate) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project update already in progress, ignoring');
            }
            return;
        }

        this.handleProjectUpdate(target);
    }

    /**
     * 프로젝트 수정 버튼 통합 핸들러 (mousedown + click)
     */
    handleProjectUpdateClick(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('✏️ Update button click - starting update');
        }

        // 이미 처리 중이면 무시
        if (this.eventProcessingFlags.projectUpdate) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project update already in progress, ignoring');
            }
            return;
        }

        this.handleProjectUpdate(target);
    }

    /**
     * 프로젝트 수정 처리 (공통 로직) - 커스텀 모달 사용
     */
    async handleProjectUpdate(target) {
        const projectId = target.dataset.projectId;
        const currentName = target.dataset.currentName;

        if (!projectId || !currentName) {
            console.error('Missing project data for update:', { projectId, currentName });
            return;
        }

        // 이미 처리 중이면 즉시 리턴 (더 강력한 보호)
        if (this.eventProcessingFlags.projectUpdate) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project update already in progress, returning early');
            }
            return;
        }

        // 플래그를 즉시 설정하여 다른 이벤트 차단
        this.eventProcessingFlags.projectUpdate = true;

        try {
            // 즉각적인 시각적 피드백
            target.style.transform = 'scale(0.9)';
            target.style.backgroundColor = 'var(--accent-blue-dark)';
            target.style.opacity = '0.6';
            target.style.pointerEvents = 'none';

            if (window.location.hostname === 'localhost') {
                console.log('🔄 Starting project update for:', currentName);
            }

            // 커스텀 모달로 사용자 입력 받기
            const newName = await this.showCustomNameModal(currentName);

            if (newName && newName.trim() && newName.trim() !== currentName) {
                if (window.location.hostname === 'localhost') {
                    console.log('✅ User provided new name:', newName.trim());
                }

                await this.call('project', 'handleUpdateProject', {
                    currentTarget: { dataset: { projectId, currentName } },
                    newName: newName.trim()
                });

                if (window.location.hostname === 'localhost') {
                    console.log('✅ Project update completed successfully');
                }
            } else {
                if (window.location.hostname === 'localhost') {
                    console.log('❌ User cancelled or provided same name');
                }
            }

        } catch (error) {
            console.error('Project update failed:', error);
        } finally {
            this.eventProcessingFlags.projectUpdate = false;
            // 시각적 피드백 복원
            target.style.transform = '';
            target.style.backgroundColor = '';
            target.style.opacity = '1';
            target.style.pointerEvents = 'auto';
        }
    }

    /**
     * 커스텀 이름 입력 모달을 표시하는 메서드
     */
    showCustomNameModal(currentName) {
        return new Promise((resolve) => {
            // 기존 모달이 있다면 제거
            const existingModal = document.getElementById('custom-name-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // 모달 HTML 생성
            const modalHTML = `
                <div id="custom-name-modal" class="modal-container active" style="z-index: 10000;">
                    <article style="max-width: 400px;">
                        <header>
                            <h3><i data-lucide="edit-3"></i>프로젝트 이름 수정</h3>
                            <button class="close" aria-label="닫기" id="name-modal-close">×</button>
                        </header>
                        <div style="padding: 1rem;">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                                새 프로젝트 이름을 입력해주세요.
                            </p>
                            <label for="custom-project-name">
                                프로젝트 이름
                                <input type="text" id="custom-project-name" value="${currentName}"
                                       style="width: 100%; margin-top: 0.5rem;" autocomplete="off">
                            </label>
                        </div>
                        <footer style="display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem; border-top: 1px solid var(--border-primary);">
                            <button class="secondary" id="name-modal-cancel">취소</button>
                            <button class="primary" id="name-modal-confirm">수정</button>
                        </footer>
                    </article>
                </div>
            `;

            // 모달을 body에 추가
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const modal = document.getElementById('custom-name-modal');
            const input = document.getElementById('custom-project-name');
            const confirmBtn = document.getElementById('name-modal-confirm');
            const cancelBtn = document.getElementById('name-modal-cancel');
            const closeBtn = document.getElementById('name-modal-close');

            // 입력 필드에 포커스
            setTimeout(() => {
                input.focus();
                input.select(); // 기존 텍스트 선택
            }, 100);

            // 이벤트 핸들러
            const closeModal = (result = null) => {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.remove();
                    resolve(result);
                }, 300);
            };

            // 확인 버튼
            confirmBtn.addEventListener('click', () => {
                const newName = input.value.trim();
                closeModal(newName || null);
            });

            // 취소 버튼
            cancelBtn.addEventListener('click', () => {
                closeModal(null);
            });

            // 닫기 버튼
            closeBtn.addEventListener('click', () => {
                closeModal(null);
            });

            // Enter 키 처리
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    closeModal(null);
                }
            });

            // 모달 외부 클릭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(null);
                }
            });

            // ESC 키
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal(null);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            // Lucide 아이콘 생성
            if (window.lucide) {
                window.lucide.createIcons();
            }
        });
    }

    /**
     * 프로젝트 삭제 버튼 통합 핸들러 (mousedown + click)
     */
    handleProjectDeleteMouseDown(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('👆 Delete button mousedown - starting delete process');
        }

        // 이미 처리 중이면 무시
        if (this.eventProcessingFlags.projectDelete) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project delete already in progress, ignoring');
            }
            return;
        }

        this.handleProjectDelete(target);
    }

    /**
     * 프로젝트 삭제 버튼 통합 핸들러 (mousedown + click)
     */
    handleProjectDeleteClick(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('🗑️ Delete button click - starting delete process');
        }

        // 이미 처리 중이면 무시
        if (this.eventProcessingFlags.projectDelete) {
            if (window.location.hostname === 'localhost') {
                console.log('⚠️ Project delete already in progress, ignoring');
            }
            return;
        }

        this.handleProjectDelete(target);
    }

    /**
     * 프로젝트 삭제 처리 (공통 로직)
     */
    async handleProjectDelete(target) {
        const projectId = target.dataset.projectId;
        const projectName = target.dataset.projectName;

        if (!projectId || !projectName) {
            console.error('Missing project data:', { projectId, projectName });
            return;
        }

        this.eventProcessingFlags.projectDelete = true;

        try {
            // 즉각적인 시각적 피드백
            target.style.transform = 'scale(0.9)';
            target.style.backgroundColor = 'var(--accent-red)';
            target.style.opacity = '0.6';
            target.style.pointerEvents = 'none';

            if (window.location.hostname === 'localhost') {
                console.log('🔄 Starting delete confirmation for:', projectName);
            }

            // 삭제 확인 대화상자 (동기적으로 처리)
            const confirmed = confirm(`정말로 '${projectName}' 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);

            if (confirmed) {
                if (window.location.hostname === 'localhost') {
                    console.log('✅ User confirmed deletion, proceeding...');
                }

                await this.call('project', 'handleDeleteProject', {
                    currentTarget: { dataset: { projectId, projectName } }
                });

                // 삭제 성공 시 리스트 즉시 갱신
                if (window.location.hostname === 'localhost') {
                    console.log('✅ Project deleted successfully, refreshing list');
                }
                await this.stateManager.loadProjects();

            } else {
                if (window.location.hostname === 'localhost') {
                    console.log('❌ User cancelled deletion');
                }
                // 취소 시 버튼 상태 즉시 복원
                target.style.transform = '';
                target.style.backgroundColor = '';
                target.style.opacity = '1';
                target.style.pointerEvents = 'auto';
            }

        } catch (error) {
            console.error('Project delete failed:', error);
            // 실패 시 버튼 상태 복원
            target.style.transform = '';
            target.style.backgroundColor = '';
            target.style.opacity = '1';
            target.style.pointerEvents = 'auto';
        } finally {
            this.eventProcessingFlags.projectDelete = false;
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
