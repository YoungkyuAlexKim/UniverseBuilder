import { StateManager } from './StateManager.js';
import { EventListenerManager } from './EventListenerManager.js';
import * as ui from '../modules/ui.js';
import * as modals from '../modules/modals.js';
import * as panels from '../modules/panels.js';
import * as api from '../modules/api.js';

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

        // 프로젝트 설정 버튼 이벤트 (mousedown + click)
        const settingsButtons = document.querySelectorAll('.settings-project-btn:not([data-event-registered])');
        settingsButtons.forEach(btn => {
            btn.addEventListener('mousedown', this.handleProjectSettingsMouseDown.bind(this), { passive: false });
            btn.addEventListener('click', this.handleProjectSettingsClick.bind(this), { passive: false });
            btn.setAttribute('data-event-registered', 'true');

            if (window.location.hostname === 'localhost') {
                console.log('⚙️ Registered unified listeners for settings button:', btn.dataset.projectId);
            }
        });

            if (window.location.hostname === 'localhost') {
                console.log(`🎯 Total event listeners registered: ${projectNameSpans.length + settingsButtons.length}`);
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

        const settingsButtons = document.querySelectorAll('.settings-project-btn[data-event-registered]');
        settingsButtons.forEach(btn => {
            btn.removeEventListener('mousedown', this.handleProjectSettingsMouseDown);
            btn.removeEventListener('click', this.handleProjectSettingsClick);
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
     * 프로젝트 설정 버튼 통합 핸들러 (mousedown + click)
     */
    handleProjectSettingsMouseDown(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('👆 Settings button mousedown - opening settings modal');
        }

        this.handleProjectSettings(target);
    }

    /**
     * 프로젝트 설정 버튼 통합 핸들러 (mousedown + click)
     */
    handleProjectSettingsClick(e) {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget;

        if (window.location.hostname === 'localhost') {
            console.log('⚙️ Settings button click - opening settings modal');
        }

        this.handleProjectSettings(target);
    }

    /**
     * 프로젝트 설정 처리 (공통 로직) - 설정 모달 표시
     */
    async handleProjectSettings(target) {
        const projectId = target.dataset.projectId;
        const projectName = target.dataset.projectName;
        const createdAt = target.dataset.createdAt;

        if (!projectId || !projectName) {
            console.error('Missing project data for settings:', { projectId, projectName });
            return;
        }

        try {
            // 즉각적인 시각적 피드백
            target.style.transform = 'scale(0.9)';
            target.style.backgroundColor = 'var(--accent-blue-dark)';
            target.style.opacity = '0.6';
            target.style.pointerEvents = 'none';

            if (window.location.hostname === 'localhost') {
                console.log('🔄 Opening settings modal for:', projectName);
            }

            // 프로젝트 설정 모달 표시
            this.showProjectSettingsModal(projectId, projectName, createdAt);

        } catch (error) {
            console.error('Project settings failed:', error);
        } finally {
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
     * 프로젝트 설정 모달을 표시합니다.
     * @param {string} projectId - 프로젝트 ID
     * @param {string} projectName - 프로젝트 이름
     * @param {string} createdAt - 생성일 (선택사항)
     */
    showProjectSettingsModal(projectId, projectName, createdAt = '') {
        // 기존 모달이 있다면 제거
        const existingModal = document.getElementById('project-settings-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 HTML 생성
        const modalHTML = `
            <div id="project-settings-modal" class="modal-container active">
                <article style="max-width: 500px;">
                    <header>
                        <a href="#close" aria-label="Close" class="close"></a>
                        <h3><i data-lucide="settings"></i>프로젝트 설정</h3>
                    </header>
                    <div class="project-settings-content">
                        <div class="project-info-section">
                            <h4>프로젝트 정보</h4>
                            <div class="project-info-display">
                                <p><strong>이름:</strong> <span id="settings-project-name">${projectName}</span></p>
                                <p><strong>생성일:</strong> <span id="settings-project-created">${createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : '정보 없음'}</span></p>
                            </div>
                        </div>

                        <hr>

                        <div class="settings-actions">
                            <button id="settings-rename-btn" class="secondary outline full-width" data-project-id="${projectId}" data-current-name="${projectName}">
                                <i data-lucide="edit-3"></i>
                                프로젝트 이름 변경
                            </button>

                            <button id="settings-password-btn" class="secondary outline full-width" data-project-id="${projectId}">
                                <i data-lucide="lock"></i>
                                비밀번호 설정/변경
                            </button>

                            <button id="settings-delete-btn" class="secondary outline full-width danger" data-project-id="${projectId}" data-project-name="${projectName}">
                                <i data-lucide="trash-2"></i>
                                프로젝트 삭제
                            </button>
                        </div>
                    </div>
                </article>
            </div>
        `;

        // 모달을 body에 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('project-settings-modal');
        const backdrop = document.getElementById('modal-backdrop');

        // 모달 닫기 함수
        const closeModal = () => {
            modal.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        // 이벤트 리스너 설정
        modal.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // 설정 버튼들 이벤트 리스너
        document.getElementById('settings-rename-btn').addEventListener('click', (e) => {
            closeModal();
            this.showProjectRenameModal(projectId, projectName);
        });

        document.getElementById('settings-password-btn').addEventListener('click', (e) => {
            closeModal();
            this.showProjectPasswordModal(projectId);
        });

        document.getElementById('settings-delete-btn').addEventListener('click', (e) => {
            closeModal();
            this.showProjectDeleteConfirmModal(projectId, projectName);
        });

        // 모달 표시
        if (backdrop) backdrop.classList.add('active');

        // Lucide 아이콘 생성
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 프로젝트 이름 변경 모달을 표시합니다.
     * @param {string} projectId - 프로젝트 ID
     * @param {string} currentName - 현재 프로젝트 이름
     */
    showProjectRenameModal(projectId, currentName) {
        // 기존 모달이 있다면 제거
        const existingModal = document.getElementById('project-rename-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 HTML 생성
        const modalHTML = `
            <div id="project-rename-modal" class="modal-container active">
                <article style="max-width: 400px;">
                    <header>
                        <a href="#close" aria-label="Close" class="close"></a>
                        <h3><i data-lucide="edit-3"></i>프로젝트 이름 변경</h3>
                    </header>
                    <form id="project-rename-form">
                        <label for="rename-project-name">
                            새 프로젝트 이름
                            <input type="text" id="rename-project-name" name="name" required
                                   value="${currentName}" autocomplete="off">
                        </label>
                        <footer>
                            <button type="button" class="secondary close-btn">취소</button>
                            <button type="submit" class="primary">이름 변경</button>
                        </footer>
                    </form>
                </article>
            </div>
        `;

        // 모달을 body에 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('project-rename-modal');
        const form = document.getElementById('project-rename-form');
        const input = document.getElementById('rename-project-name');
        const backdrop = document.getElementById('modal-backdrop');

        // 모달 닫기 함수
        const closeModal = () => {
            modal.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        // 이벤트 리스너 설정
        modal.querySelectorAll('.close, .close-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // 폼 제출 처리
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newName = input.value.trim();

            if (!newName) {
                alert('프로젝트 이름을 입력해주세요.');
                input.focus();
            return;
        }

            if (newName === currentName) {
                alert('새 이름이 현재 이름과 같습니다.');
                input.focus();
            return;
        }

            try {
                await this.call('project', 'handleUpdateProject', {
                    currentTarget: { dataset: { projectId, currentName } },
                    newName: newName
                });

                closeModal();

            } catch (error) {
                console.error('이름 변경 실패:', error);
                alert('프로젝트 이름 변경에 실패했습니다.');
            }
        });

        // 모달 표시 후 입력 필드에 포커스
        setTimeout(() => {
            input.focus();
            input.select(); // 기존 텍스트 선택
        }, 100);

        // Lucide 아이콘 생성
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 프로젝트 비밀번호 설정 모달을 표시합니다.
     * @param {string} projectId - 프로젝트 ID
     */
    async showProjectPasswordModal(projectId) {
        // 기존 모달이 있다면 제거
        const existingModal = document.getElementById('project-password-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 현재 비밀번호 상태 확인
        let hasPassword = false;
        let passwordCheckError = false;

        try {
            const status = await api.checkPasswordStatus(projectId);
            hasPassword = status.requires_password;
            console.log('비밀번호 상태 확인 성공:', hasPassword);
        } catch (error) {
            console.warn('비밀번호 상태 확인 실패:', error);
            passwordCheckError = true;

            // 세션에 비밀번호가 저장되어 있다면 비밀번호가 설정되어 있다고 가정
            const storedPassword = sessionStorage.getItem(`project-password-${projectId}`);
            if (storedPassword) {
                hasPassword = true;
                console.log('세션에 비밀번호가 있어 설정된 것으로 간주');
            }
        }

        // 모달 HTML 생성 (동적으로 이전 비밀번호 필드 포함 여부 결정)
        const currentPasswordField = hasPassword ? `
        <label for="project-current-password">
            현재 비밀번호
            <input type="password" id="project-current-password" name="currentPassword" required
                   placeholder="현재 비밀번호를 입력하세요" autocomplete="current-password">
        </label>` : '';

        const modalTitle = hasPassword ? '프로젝트 비밀번호 변경' : '프로젝트 비밀번호 설정';
        const submitButtonText = hasPassword ? '비밀번호 변경' : '비밀번호 설정';
        const description = hasPassword
            ? '비밀번호를 변경하려면 현재 비밀번호를 입력한 후 새 비밀번호를 설정해주세요.'
            : '프로젝트에 비밀번호를 설정하면 다른 사람이 접근할 수 없게 됩니다.';

        console.log('비밀번호 모달 설정:', {
            hasPassword,
            passwordCheckError,
            modalTitle,
            currentPasswordField: !!currentPasswordField.trim()
        });

        const modalHTML = `
            <div id="project-password-modal" class="modal-container active">
                <article style="max-width: 400px;">
                    <header>
                        <a href="#close" aria-label="Close" class="close"></a>
                        <h3><i data-lucide="lock"></i>${modalTitle}</h3>
                    </header>
                    <form id="project-password-form">
                        <p style="margin-bottom: 1rem; color: var(--pico-muted-color);">
                            ${description}
                        </p>
                        ${currentPasswordField}
                        <label for="project-new-password">
                            새 비밀번호
                            <input type="password" id="project-new-password" name="password" required
                                   placeholder="새 비밀번호를 입력하세요" autocomplete="new-password">
                        </label>
                        <label for="project-confirm-password">
                            비밀번호 확인
                            <input type="password" id="project-confirm-password" name="confirmPassword" required
                                   placeholder="비밀번호를 다시 입력하세요" autocomplete="new-password">
                        </label>
                        <footer>
                            <button type="button" class="secondary close-btn">취소</button>
                            <button type="submit" class="primary">${submitButtonText}</button>
                        </footer>
                    </form>
                </article>
            </div>
        `;

        // 모달을 body에 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('project-password-modal');
        const form = document.getElementById('project-password-form');
        const currentPasswordInput = document.getElementById('project-current-password');
        const passwordInput = document.getElementById('project-new-password');
        const confirmInput = document.getElementById('project-confirm-password');
        const backdrop = document.getElementById('modal-backdrop');

        // 모달 닫기 함수
        const closeModal = () => {
            modal.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        // 이벤트 리스너 설정
        modal.querySelectorAll('.close, .close-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // ESC 키로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // 폼 제출 처리
        form.addEventListener('submit', async (e) => {
        e.preventDefault();

            const currentPassword = currentPasswordInput ? currentPasswordInput.value.trim() : null;
            const newPassword = passwordInput.value.trim();
            const confirmPassword = confirmInput.value.trim();

            // 유효성 검사
            if (hasPassword && !currentPassword) {
                alert('현재 비밀번호를 입력해주세요.');
                if (currentPasswordInput) currentPasswordInput.focus();
            return;
        }

            if (!newPassword) {
                alert('새 비밀번호를 입력해주세요.');
                passwordInput.focus();
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('새 비밀번호가 일치하지 않습니다.');
                confirmInput.focus();
                confirmInput.select();
            return;
        }

            if (hasPassword && currentPassword === newPassword) {
                alert('새 비밀번호가 현재 비밀번호와 같습니다.');
                passwordInput.focus();
                passwordInput.select();
            return;
        }

            try {
                // 현재 비밀번호가 있는 경우 먼저 검증
                if (hasPassword) {
                    console.log('현재 비밀번호 검증 시작');
                    await api.verifyPassword(projectId, currentPassword);
                    console.log('현재 비밀번호 검증 성공');
                }

                // 비밀번호 설정/변경 API 호출
                console.log('비밀번호 설정/변경 API 호출 시작:', { projectId, hasPassword });
                await api.setPassword(projectId, newPassword);
                console.log('비밀번호 설정/변경 API 호출 성공');

                // 세션에 새 비밀번호 저장
                sessionStorage.setItem(`project-password-${projectId}`, newPassword);
                console.log('새 비밀번호 세션에 저장됨');

                const successMessage = hasPassword ? '비밀번호가 성공적으로 변경되었습니다.' : '비밀번호가 성공적으로 설정되었습니다.';
                alert(successMessage);
                closeModal();

            } catch (error) {
                console.error('비밀번호 설정/변경 실패:', error);

                // 더 자세한 에러 메시지 처리
                let errorMessage = '비밀번호 설정/변경에 실패했습니다.';

                if (error.message) {
                    if (error.message.includes('비밀번호') || error.message.includes('password')) {
                        errorMessage = '현재 비밀번호가 올바르지 않습니다.';
                        if (currentPasswordInput) currentPasswordInput.focus();
                    } else if (error.message.includes('network') || error.message.includes('fetch')) {
                        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
                    } else if (error.message.includes('500') || error.message.includes('server')) {
                        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
                    } else {
                        errorMessage = `오류: ${error.message}`;
                    }
                }

                alert(errorMessage);
            }
        });

        // 모달 표시 후 첫 입력 필드에 포커스
        setTimeout(() => {
            console.log('모달 표시 후 DOM 요소 확인:');
            console.log('currentPasswordInput:', currentPasswordInput);
            console.log('passwordInput:', passwordInput);
            console.log('confirmInput:', confirmInput);

            if (currentPasswordInput && hasPassword) {
                console.log('현재 비밀번호 필드에 포커스');
                currentPasswordInput.focus();
            } else {
                console.log('새 비밀번호 필드에 포커스');
                passwordInput.focus();
            }
        }, 100);

        // Lucide 아이콘 생성
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 프로젝트 삭제 확인 모달을 표시합니다.
     * @param {string} projectId - 프로젝트 ID
     * @param {string} projectName - 프로젝트 이름
     */
    async showProjectDeleteConfirmModal(projectId, projectName) {
        // 기존 모달이 있다면 제거
        const existingModal = document.getElementById('project-delete-confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        let hasPassword = false;
        try {
            const status = await api.checkPasswordStatus(projectId);
            hasPassword = status.requires_password;
        } catch (error) {
            console.error('비밀번호 상태 확인 실패:', error);
            ui.showToast('프로젝트 상태를 확인하는 데 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
            return;
        }

        const passwordInputHTML = hasPassword ? `
            <label for="delete-password-input">
                프로젝트 비밀번호 입력
                <input type="password" id="delete-password-input" name="password" placeholder="프로젝트 비밀번호를 입력하세요" autocomplete="current-password">
            </label>
        ` : `
            <input type="hidden" id="delete-password-input" value="">
            <p style="font-size: 0.9rem; color: var(--pico-muted-color);">
                이 프로젝트에는 비밀번호가 설정되어 있지 않습니다.
            </p>
        `;

        const instructionText = hasPassword
            ? '삭제를 진행하려면 아래 정보를 모두 입력해주세요:'
            : '삭제를 진행하려면 아래에 프로젝트 이름을 정확히 입력해주세요.';

        const modalHTML = `
            <div id="project-delete-confirm-modal" class="modal-container active">
                <article style="max-width: 450px;">
                    <header>
                        <a href="#close" aria-label="Close" class="close"></a>
                        <h3><i data-lucide="alert-triangle"></i>프로젝트 삭제 확인</h3>
                    </header>
                    <div style="padding: 1rem;">
                        <div style="background: var(--pico-warning-background-color); border: 1px solid var(--pico-warning-border-color); border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
                            <h4 style="color: var(--pico-warning-text-color); margin-top: 0;"><i data-lucide="alert-triangle"></i>주의</h4>
                            <p style="margin-bottom: 0; color: var(--pico-warning-text-color);">
                                <strong>"${projectName}"</strong> 프로젝트를 삭제하시겠습니까?<br>
                                이 작업은 되돌릴 수 없습니다.
                            </p>
                        </div>
                        <p style="margin-bottom: 1rem;">${instructionText}</p>
                        <div style="display: grid; gap: 1rem;">
                            <label for="delete-confirm-input">
                                프로젝트 이름 입력
                                <input type="text" id="delete-confirm-input" placeholder="프로젝트 이름을 입력하세요" autocomplete="off">
                            </label>
                            ${passwordInputHTML}
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: var(--pico-secondary-background); border-radius: 4px; font-size: 0.9rem; color: var(--pico-muted-color);">
                            <strong>💡 안전을 위해:</strong><br>
                            • 프로젝트 이름${hasPassword ? '과 비밀번호를 모두' : '을'} 입력해야 삭제가 진행됩니다
                        </div>
                    </div>
                    <footer>
                        <button type="button" class="secondary close-btn">취소</button>
                        <button type="button" id="confirm-delete-btn" class="danger">삭제하기</button>
                    </footer>
                </article>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('project-delete-confirm-modal');
        const confirmInput = document.getElementById('delete-confirm-input');
        const passwordInput = document.getElementById('delete-password-input');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const backdrop = document.getElementById('modal-backdrop');

        const closeModal = () => {
            modal.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelectorAll('.close, .close-btn').forEach(btn => btn.addEventListener('click', closeModal));
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        const escHandler = e => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // --- 수정 시작: 삭제 확인 버튼 로직 완성 ---
        confirmBtn.addEventListener('click', async () => {
            const inputValue = confirmInput.value.trim();
            const passwordValue = passwordInput.value.trim();

            if (inputValue !== projectName) {
                alert('프로젝트 이름이 일치하지 않습니다.');
                confirmInput.focus();
                return;
            }

            try {
                // 비밀번호가 설정된 경우에만 비밀번호 검증
                if (hasPassword) {
                    if (!passwordValue) {
                        alert('프로젝트 비밀번호를 입력해주세요.');
                        passwordInput.focus();
                        return;
                    }
                    await api.verifyPassword(projectId, passwordValue);
                }

                // 모든 검증 통과 후 삭제 컨트롤러 호출
                await this.call('project', 'handleDeleteProject', {
                    currentTarget: { dataset: { projectId, projectName } }
                });

                closeModal();

            } catch (error) {
                console.error('프로젝트 삭제 실패:', error);
                let errorMessage = '프로젝트 삭제에 실패했습니다.';
                if (error.message && error.message.includes('비밀번호')) {
                    errorMessage = '비밀번호가 올바르지 않습니다.';
                    if (passwordInput) passwordInput.focus();
                }
                alert(errorMessage);
            }
        });
        // --- 수정 끝 ---

        setTimeout(() => { confirmInput.focus(); }, 100);

        if (window.lucide) {
            window.lucide.createIcons();
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
