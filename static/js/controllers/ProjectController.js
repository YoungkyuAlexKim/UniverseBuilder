/**
 * 프로젝트 관리 관련 컨트롤러
 * 프로젝트의 생성, 선택, 수정, 삭제 기능을 담당합니다.
 */
import * as api from '../modules/api.js';

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
        
        if (!projectName) { 
            alert('프로젝트 이름을 입력해주세요.'); 
            return; 
        }
        
        const password = prompt("새 프로젝트에 사용할 비밀번호를 입력하세요.\n(입력하지 않으면 비밀번호 없이 생성됩니다)");

        button.setAttribute('aria-busy', 'true');
        button.disabled = true;
        
        await this.stateManager.createProject(projectName, password || null);
        
        input.value = '';
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }

    /**
     * 프로젝트를 선택하고 비밀번호를 확인합니다.
     */
    async handleSelectProject(projectId) {
        try {
            const status = await api.checkPasswordStatus(projectId);
            const storedPassword = sessionStorage.getItem(`project-password-${projectId}`);

            if (status.requires_password && !storedPassword) {
                const password = prompt("이 프로젝트의 비밀번호를 입력하세요:");
                if (!password) return;

                await api.verifyPassword(projectId, password);
                sessionStorage.setItem(`project-password-${projectId}`, password);
            }

            if (!status.requires_password) {
                 if (confirm("이 프로젝트에는 비밀번호가 설정되어 있지 않습니다.\n지금 설정하시겠습니까?")) {
                    const newPassword = prompt("사용할 새 비밀번호를 입력하세요:");
                    if (newPassword) {
                        await api.setPassword(projectId, newPassword);
                        sessionStorage.setItem(`project-password-${projectId}`, newPassword);
                        alert("비밀번호가 성공적으로 설정되었습니다.");
                    }
                 }
            }
            
            this.stateManager.selectProject(projectId);

        } catch (error) {
            alert(`프로젝트를 여는 데 실패했습니다: ${error.message}`);
        }
    }

    /**
     * 프로젝트 이름을 수정합니다.
     */
    async handleUpdateProject(event) {
        event.stopPropagation();
        const { projectId, currentName } = event.currentTarget.dataset;
        const newName = prompt("새로운 프로젝트 이름을 입력하세요:", currentName);
        
        if (newName && newName.trim() && newName.trim() !== currentName) {
            event.currentTarget.setAttribute('aria-busy', 'true');
            event.currentTarget.disabled = true;
            
            try {
                await this.stateManager.updateProject(projectId, newName.trim());
                alert('프로젝트 이름이 수정되었습니다.');
            } catch (error) {
                console.error('프로젝트 이름 수정 실패:', error);
                alert(error.message);
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
        
        if (confirm(`정말로 '${projectName}' 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            event.currentTarget.setAttribute('aria-busy', 'true');
            event.currentTarget.disabled = true;
            
            try {
                await this.stateManager.deleteProject(projectId);
                alert('프로젝트가 삭제되었습니다.');
            } catch (error) {
                console.error('프로젝트 삭제 실패:', error);
                alert(error.message);
                event.currentTarget.setAttribute('aria-busy', 'false');
                event.currentTarget.disabled = false;
            }
        }
    }
}
