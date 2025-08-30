/**
 * 프로젝트 관리 관련 컨트롤러
 * 프로젝트의 생성, 선택, 수정, 삭제 기능을 담당합니다.
 */
import * as api from '../modules/api.js';
import { showToast, showFieldValidation, validateFormBeforeSubmit, ValidationRules, ErrorHandlers } from '../components/validation/validation-utils.js';
import { removeValidationMessage } from '../components/validation/validation-message.js';

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
}
