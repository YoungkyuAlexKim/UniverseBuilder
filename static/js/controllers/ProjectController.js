/**
 * 프로젝트 관리 관련 컨트롤러
 * 프로젝트의 생성, 선택, 수정, 삭제 기능을 담당합니다.
 */
import * as api from '../modules/api.js';
import { showToast, showFieldValidation, validateFormBeforeSubmit, ValidationRules, ErrorHandlers } from '../components/validation/validation-utils.js';
import { removeValidationMessage } from '../components/validation/validation-message.js';

// showToast 함수를 직접 사용하기 위한 import
import { showToast as directShowToast } from '../components/validation/validation-utils.js';
import { getSampleProjectList, getSampleProject, getSampleProjectMeta } from '../samples/sample-project-data.js';

export class ProjectController {
    constructor(app) {
        this.app = app;
        this.stateManager = app.stateManager;
        this.eventManager = app.eventManager;
    }

    /**
     * 새 프로젝트를 생성합니다.
     */
    async handleCreateProject(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.querySelector('input[name="name"]');
        const button = form.querySelector('button');
        const projectName = input.value.trim();

        // 유효성 검사
        if (!projectName) {
            showFieldValidation(input, '프로젝트 이름을 입력해주세요.', false);
            input.focus();
            return;
        }

        // 프로젝트 이름 유효성 검증
        const validation = ValidationRules.minLength(1, '프로젝트 이름')(projectName, input);
        if (!validation.isValid) {
            showFieldValidation(input, validation.message, false);
            input.focus();
            return;
        }

        button.setAttribute('aria-busy', 'true');
        button.disabled = true;

        try {
            await this.stateManager.createProject(projectName, null); // 비밀번호는 나중에 설정하도록 간소화
            showToast('프로젝트가 성공적으로 생성되었습니다!', 'success');
            input.value = '';
        } catch (error) {
            ErrorHandlers.showError(error, '프로젝트 생성 실패');
        } finally {
            button.setAttribute('aria-busy', 'false');
            button.disabled = false;
        }
    }

    /**
     * 프로젝트를 선택하고 비밀번호를 확인합니다.
     */
    async handleSelectProject(projectId) {
        try {
            const status = await api.checkPasswordStatus(projectId);
            const storedPassword = sessionStorage.getItem(`project-password-${projectId}`);

            if (status.requires_password && !storedPassword) {
                // 커스텀 비밀번호 입력 모달 표시
                this.showPasswordInputModal(projectId, async (password) => {
                    try {
                        // 비밀번호 입력 성공 콜백
                        await this.handleSelectProject(projectId);
                        showToast('프로젝트가 성공적으로 열렸습니다!', 'success');
                    } catch (error) {
                        ErrorHandlers.showError(error, '프로젝트 열기 실패');
                    }
                });
                return;
            }

            if (!status.requires_password) {
                // TODO: 비밀번호 설정 확인 모달로 교체
                showToast('이 프로젝트에는 비밀번호가 설정되어 있지 않습니다.', 'info');
            }

            // 프로젝트 로딩 시작 표시
            this.app.panels.showProjectLoadingOverlay();

            await this.stateManager.selectProject(projectId);

            // 성공 메시지는 콜백에서 처리하므로 여기서는 제거

        } catch (error) {
            ErrorHandlers.showError(error, '프로젝트 열기 실패');
        } finally {
            // 에러 발생 시에도 로딩 오버레이 숨기기
            this.app.panels.hideProjectLoadingOverlay();
        }
    }

    /**
     * 프로젝트 이름을 수정합니다.
     */
    async handleUpdateProject(event) {
        event.stopPropagation();
        const { projectId, currentName } = event.currentTarget.dataset;

        // TODO: 커스텀 이름 입력 모달로 교체
        showToast('프로젝트 이름 수정 기능은 현재 개선 중입니다.', 'info');

        // 임시로 간단한 구현
        const newName = prompt("새로운 프로젝트 이름을 입력하세요:", currentName);

        if (newName && newName.trim() && newName.trim() !== currentName) {
            event.currentTarget.setAttribute('aria-busy', 'true');
            event.currentTarget.disabled = true;

            try {
                await this.stateManager.updateProject(projectId, newName.trim());
                showToast('프로젝트 이름이 수정되었습니다.', 'success');
            } catch (error) {
                ErrorHandlers.showError(error, '프로젝트 이름 수정 실패');
            } finally {
                event.currentTarget.setAttribute('aria-busy', 'false');
                event.currentTarget.disabled = false;
            }
        }
    }

    /**
     * 프로젝트를 삭제합니다.
     */
    async handleDeleteProject(event) {
        event.stopPropagation();
        const { projectId, projectName } = event.currentTarget.dataset;

        // TODO: 커스텀 확인 모달로 교체
        if (confirm(`정말로 '${projectName}' 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            event.currentTarget.setAttribute('aria-busy', 'true');
            event.currentTarget.disabled = true;

            try {
                await this.stateManager.deleteProject(projectId);
                showToast('프로젝트가 삭제되었습니다.', 'success');
            } catch (error) {
                ErrorHandlers.showError(error, '프로젝트 삭제 실패');
                event.currentTarget.setAttribute('aria-busy', 'false');
                event.currentTarget.disabled = false;
            }
        }
    }

    /**
     * 새 프로젝트 생성 모달을 표시합니다.
     */
    showCreateProjectModal() {
        console.log('🔧 ProjectController: showCreateProjectModal() 호출됨');

        // 기존 모달이 있다면 제거
        const existingModal = document.getElementById('create-project-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 HTML 생성
        const modalHTML = `
            <div id="create-project-modal" class="modal-container active">
                <article style="max-width: 500px;">
                    <header>
                        <h3><i data-lucide="folder-plus"></i> 새 프로젝트 생성</h3>
                        <button class="close" aria-label="닫기">×</button>
                    </header>
                    <form id="create-project-modal-form" action="javascript:void(0)">
                        <p style="margin-bottom: 1.5rem; color: var(--pico-muted-color);">
                            새로운 스토리를 시작해보세요. 프로젝트 이름만 입력하면 됩니다.
                        </p>

                        <label for="new-project-name">
                            프로젝트 이름 *
                            <input type="text" id="new-project-name" name="name" required
                                   placeholder="예: 나의 첫 번째 소설" autocomplete="off"
                                   style="width: 100%;">
                        </label>

                        <label for="new-project-description">
                            프로젝트 설명 (선택사항)
                            <textarea id="new-project-description" name="description" rows="3"
                                      placeholder="프로젝트에 대한 간단한 설명을 입력하세요..."
                                      style="width: 100%; resize: vertical;"></textarea>
                        </label>

                        <label for="new-project-genre">
                            장르 (선택사항)
                            <select id="new-project-genre" name="genre" style="width: 100%;">
                                <option value="">장르 선택...</option>
                                <option value="판타지">판타지</option>
                                <option value="SF">SF</option>
                                <option value="로맨스">로맨스</option>
                                <option value="스릴러">스릴러</option>
                                <option value="미스터리">미스터리</option>
                                <option value="드라마">드라마</option>
                                <option value="코미디">코미디</option>
                                <option value="호러">호러</option>
                                <option value="무협">무협</option>
                                <option value="역사">역사</option>
                                <option value="기타">기타</option>
                            </select>
                        </label>

                        <footer style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-primary);">
                            <button type="button" class="secondary close-btn">취소</button>
                            <button type="submit" class="contrast">프로젝트 생성</button>
                        </footer>
                    </form>
                </article>
            </div>
        `;

        // 모달을 body에 추가
        console.log('📦 ProjectController: 모달 HTML 추가 시도');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('📦 ProjectController: 모달 HTML 추가 완료');

        const modal = document.getElementById('create-project-modal');
        const form = document.getElementById('create-project-modal-form');
        const nameInput = document.getElementById('new-project-name');

        console.log('🔍 ProjectController: DOM 요소 검색 결과:');
        console.log('🔍 ProjectController: modal:', modal);
        console.log('🔍 ProjectController: form:', form);
        console.log('🔍 ProjectController: nameInput:', nameInput);

        // this 컨텍스트를 유지하기 위해 app 변수 저장
        const app = this.app;

        // 모달 닫기 함수
        const closeModal = () => {
            modal.classList.remove('active');
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

        // 폼 제출 처리 (this 컨텍스트 문제 해결)
        const self = this; // this를 변수에 저장
        const handleSubmit = async function(e) {
            console.log('📝 ProjectController: 폼 제출 이벤트 발생');
            console.log('📝 ProjectController: window.app 존재:', !!window.app);
            console.log('📝 ProjectController: window.app.ui 존재:', !!(window.app && window.app.ui));
            console.log('📝 ProjectController: self 존재:', !!self);
            console.log('📝 ProjectController: self.app 존재:', !!(self && self.app));
            console.log('📝 ProjectController: self.app.stateManager 존재:', !!(self && self.app && self.app.stateManager));

            e.preventDefault();
            e.stopPropagation();
            console.log('📝 ProjectController: preventDefault 및 stopPropagation 완료');

            const formData = new FormData(form);
            const projectName = formData.get('name').trim();
            const description = formData.get('description').trim();
            const genre = formData.get('genre');

            console.log('📋 ProjectController: 폼 데이터 -', { projectName, description, genre });

            if (!projectName) {
                console.log('⚠️ ProjectController: 프로젝트 이름이 비어있음');
                // 직접 showToast 사용
                console.log('프로젝트 이름을 입력해주세요.');
                nameInput.focus();
                return;
            }

            try {
                console.log('🚀 ProjectController: StateManager.createProject 호출');
                // 프로젝트 생성
                if (window.app && window.app.stateManager) {
                    await window.app.stateManager.createProject(projectName, null, { description, genre });
                } else {
                    // window.app이 없는 경우, 직접 StateManager 사용
                    console.log('⚠️ ProjectController: window.app을 찾을 수 없음, 직접 StateManager 사용');
                    await self.app.stateManager.createProject(projectName, null, { description, genre });
                }

                // 성공 메시지
                console.log('✅ 프로젝트가 성공적으로 생성되었습니다!');
                directShowToast('프로젝트가 성공적으로 생성되었습니다!', 'success');

                // 모달 닫기
                closeModal();

            } catch (error) {
                console.error('프로젝트 생성 실패:', error);
                // 에러 메시지
                console.error('❌ 프로젝트 생성에 실패했습니다.');
                directShowToast('프로젝트 생성에 실패했습니다.', 'error');
            }
        }.bind(this);

        console.log('🎧 ProjectController: 폼 제출 이벤트 리스너 등록 시도');
        console.log('🎧 ProjectController: 폼 요소:', form);
        console.log('🎧 ProjectController: handleSubmit 함수:', typeof handleSubmit);

        form.addEventListener('submit', handleSubmit);
        console.log('✅ ProjectController: 폼 제출 이벤트 리스너 등록 완료');

        // 추가: 버튼 클릭 이벤트도 직접 등록 (backup)
        const submitButton = form.querySelector('button[type="submit"]');
        console.log('🔍 ProjectController: submitButton 검색 결과:', submitButton);
        console.log('🔍 ProjectController: submitButton 타입:', submitButton?.tagName);
        console.log('🔍 ProjectController: submitButton 텍스트:', submitButton?.textContent);

        if (submitButton) {
            console.log('🎯 ProjectController: 제출 버튼 찾음, 클릭 이벤트 리스너 추가');

            // 버튼 텍스트 강제 설정 (충돌 방지)
            submitButton.textContent = '프로젝트 생성';
            console.log('🎯 ProjectController: 버튼 텍스트 설정 완료:', submitButton.textContent);

            // 이벤트 리스너 등록 전 확인
            console.log('🎯 ProjectController: 이벤트 리스너 등록 준비 완료');

            submitButton.addEventListener('click', (e) => {
                console.log('🔘 ProjectController: 제출 버튼 클릭됨');
                console.log('🔘 ProjectController: 클릭 이벤트 객체:', e);
                console.log('🔘 ProjectController: 클릭 이벤트 타겟:', e.target);
                console.log('🔘 ProjectController: 이벤트 타입:', e.type);
                console.log('🔘 ProjectController: 이벤트 버블링:', e.bubbles);
                console.log('🔘 ProjectController: 이벤트 취소 가능:', e.cancelable);
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 ProjectController: preventDefault 및 stopPropagation 완료');

                // 폼 제출 이벤트 강제 발생
                console.log('🔘 ProjectController: 폼 제출 이벤트 강제 발생 시도');
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
                console.log('🔘 ProjectController: 폼 제출 이벤트 강제 발생 완료');
            });

            console.log('✅ ProjectController: 버튼 클릭 이벤트 리스너 등록 완료');
        } else {
            console.log('❌ ProjectController: 제출 버튼을 찾을 수 없음');

            // 폼 내 모든 버튼 확인
            const allButtons = form.querySelectorAll('button');
            console.log('🔍 ProjectController: 폼 내 모든 버튼들:', allButtons);
            allButtons.forEach((btn, index) => {
                console.log(`🔍 ProjectController: 버튼 ${index}:`, btn, '텍스트:', btn.textContent, '타입:', btn.type);
            });
        }

        // 입력 시 유효성 메시지 제거
        nameInput.addEventListener('input', () => {
            removeValidationMessage(nameInput);
        });

        // 모달 표시 후 입력 필드에 포커스
        setTimeout(() => {
            nameInput.focus();
        }, 100);

        // Lucide 아이콘 생성
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 샘플 프로젝트 둘러보기 버튼 클릭 처리
     * 이제 샘플 선택 모달을 표시합니다.
     */
    handleLoadSampleProject() {
        console.log('🔧 ProjectController: 샘플 프로젝트 둘러보기 버튼 클릭됨');
        this.showSampleProjectModal();
    }

    /**
     * 비밀번호 입력 모달을 표시합니다.
     * @param {number} projectId - 프로젝트 ID
     * @param {Function} onSuccess - 성공 콜백 함수
     */
    showPasswordInputModal(projectId, onSuccess) {
        // 기존 모달이 있다면 제거
        const existingModal = document.getElementById('password-input-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 모달 HTML 생성
        const modalHTML = `
            <div id="password-input-modal" class="modal-container active">
                <article style="max-width: 400px;">
                    <header>
                        <h3>🔒 프로젝트 비밀번호 입력</h3>
                        <button class="close" aria-label="닫기">×</button>
                    </header>
                    <form id="password-input-form">
                        <p style="margin-bottom: 1.5rem; color: var(--text-muted);">
                            이 프로젝트를 열기 위해 비밀번호를 입력해주세요.
                        </p>
                        <label for="project-password">
                            비밀번호
                            <input type="password" id="project-password" name="password" required
                                   placeholder="비밀번호를 입력하세요" autocomplete="current-password"
                                   style="width: 100%;">
                        </label>
                        <footer style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-primary);">
                            <button type="button" class="secondary close-btn">취소</button>
                            <button type="submit" class="contrast">확인</button>
                        </footer>
                    </form>
                </article>
            </div>
        `;

        // 모달을 body에 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('password-input-modal');
        const form = document.getElementById('password-input-form');
        const passwordInput = document.getElementById('project-password');

        // 모달 닫기 함수
        const closeModal = () => {
            modal.classList.remove('active');
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

            const password = passwordInput.value.trim();

            if (!password) {
                showFieldValidation(passwordInput, '비밀번호를 입력해주세요.', false);
                passwordInput.focus();
                return;
            }

            try {
                // 비밀번호 검증
                await api.verifyPassword(projectId, password);

                // 성공 시 세션에 저장
                sessionStorage.setItem(`project-password-${projectId}`, password);

                // 모달 닫기
                closeModal();

                // 성공 콜백 실행
                if (onSuccess) {
                    onSuccess(password);
                }

            } catch (error) {
                showFieldValidation(passwordInput, '비밀번호가 올바르지 않습니다.', false);
                passwordInput.focus();
                passwordInput.select();
            }
        });

        // 입력 시 유효성 메시지 제거
        passwordInput.addEventListener('input', () => {
            removeValidationMessage(passwordInput);
        });

        // 모달 표시 후 입력 필드에 포커스
        setTimeout(() => {
            passwordInput.focus();
        }, 100);
    }

    /**
     * 샘플 프로젝트 선택 모달을 표시합니다.
     */
    showSampleProjectModal() {
        console.log('🔧 ProjectController: showSampleProjectModal() 호출됨');
        const existingModal = document.getElementById('sample-project-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const sampleProjects = getSampleProjectList();

        const modalHTML = `
            <div id="sample-project-modal" class="modal-container active">
                <article style="max-width: 800px;">
                    <header>
                        <h3><i data-lucide="sparkles"></i> 샘플 프로젝트 둘러보기</h3>
                        <button class="close" aria-label="닫기">×</button>
                    </header>
                    <div class="sample-project-grid">
                        ${sampleProjects.map(sample => `
                            <div class="sample-project-card" data-sample-id="${sample.id}" style="border-left: 4px solid ${sample.color};">
                                <div class="sample-project-header">
                                    <div class="sample-project-icon" style="background-color: ${sample.color}20;">
                                        <i data-lucide="${sample.icon}"></i>
                                    </div>
                                    <div class="sample-project-info">
                                        <h4>${sample.name}</h4>
                                        <span class="sample-project-genre">${sample.genre}</span>
                                    </div>
                                </div>
                                <p class="sample-project-description">${sample.description}</p>
                                <button class="sample-project-select-btn" data-sample-id="${sample.id}">
                                    <i data-lucide="play-circle"></i>
                                    이 프로젝트로 시작하기
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <footer style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-primary);">
                        <button class="secondary close-btn">취소</button>
                    </footer>
                </article>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('sample-project-modal');

        const closeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };

        modal.querySelectorAll('.close, .close-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', escHandler);

        // 샘플 프로젝트 선택 이벤트 리스너
        modal.querySelectorAll('.sample-project-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleId = e.currentTarget.dataset.sampleId;
                this.handleSampleProjectSelect(sampleId);
                closeModal();
            });
        });

        // 카드 클릭 이벤트 리스너
        modal.querySelectorAll('.sample-project-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 버튼이 클릭된 경우는 무시 (버튼 이벤트가 처리됨)
                if (e.target.closest('.sample-project-select-btn')) return;

                const sampleId = card.dataset.sampleId;
                this.handleSampleProjectSelect(sampleId);
                closeModal();
            });
        });

        // Lucide 아이콘 초기화
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 선택된 샘플 프로젝트를 로드합니다.
     */
    async handleSampleProjectSelect(sampleId) {
        try {
            console.log(`🔧 ProjectController: 샘플 프로젝트 선택됨 - ${sampleId}`);
            this.app.stateManager.setLoadingState('projectCreating', true);

            const sampleData = getSampleProject(sampleId);
            if (!sampleData) {
                throw new Error(`샘플 프로젝트 데이터를 찾을 수 없습니다: ${sampleId}`);
            }

            // 샘플 메타데이터 가져오기
            const sampleMeta = getSampleProjectMeta(sampleId);
            if (!sampleMeta) {
                throw new Error(`샘플 메타데이터를 찾을 수 없습니다: ${sampleId}`);
            }

            // API 호출하여 샘플 프로젝트 생성
            const response = await fetch('/api/v1/projects/create-from-sample', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sample_id: sampleId,
                    custom_name: sampleMeta.name,
                    sample_data: sampleData
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`샘플 프로젝트 생성 실패: ${response.status} - ${errorData}`);
            }

            const newProject = await response.json();
            console.log('✅ 샘플 프로젝트 생성 성공:', newProject);

            // 프로젝트 목록 새로고침
            await this.app.stateManager.loadProjects();

            // 성공 메시지 표시
            directShowToast(`"${newProject.name}" 샘플 프로젝트가 생성되었습니다!`, 'success');

            // 프로젝트 선택
            await this.handleSelectProject(newProject.id);

        } catch (error) {
            console.error('샘플 프로젝트 로딩 실패:', error);
            directShowToast(`샘플 프로젝트 로딩에 실패했습니다: ${error.message}`, 'error');
        } finally {
            this.app.stateManager.setLoadingState('projectCreating', false);
        }
    }
}
