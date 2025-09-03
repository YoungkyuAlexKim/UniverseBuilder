import { EventEmitter } from './EventEmitter.js';
import * as api from '../modules/api.js';

/**
 * 애플리케이션의 전역 상태를 중앙에서 관리하는 클래스.
 * 모든 데이터 CRUD 작업은 이 클래스를 통해 이루어져야 합니다.
 * 상태가 변경되면 'stateChanged' 이벤트를 발생시켜 다른 모듈에 알립니다.
 */
export class StateManager extends EventEmitter {
    constructor() {
        super();
        this.state = {
            projects: [],
            currentProject: null,
            isLoading: false,
            loadingStates: {
                projectsLoading: false,
                projectCreating: false,
                projectLoading: false,
                aiGenerating: false,
                scenarioGenerating: false,
                worldviewGenerating: false,
                characterGenerating: false,
                savingData: false
            },
        };
    }

    /**
     * 현재 상태 객체의 복사본을 반환합니다.
     * @returns {object} The current state.
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 애플리케이션의 상태를 업데이트하고, 변경 사항을 알립니다.
     * @param {object} newState - 업데이트할 새로운 상태 조각
     */
    _setState(newState) {
        this.state = { ...this.state, ...newState };
        this.emit('stateChanged', this.state);
    }

    /**
     * 특정 로딩 상태를 설정합니다.
     * @param {string} key - 로딩 상태 키
     * @param {boolean} isLoading - 로딩 중인지 여부
     */
    setLoadingState(key, isLoading) {
        this._setState({
            loadingStates: {
                ...this.state.loadingStates,
                [key]: isLoading
            }
        });
    }

    /**
     * 특정 로딩 상태를 확인합니다.
     * @param {string} key - 로딩 상태 키
     * @returns {boolean} 해당 로딩 상태
     */
    isLoadingState(key) {
        return this.state.loadingStates[key] || false;
    }

    /**
     * 전체 로딩 상태를 확인합니다.
     * @returns {boolean} 어떤 작업이라도 로딩 중인지 여부
     */
    isAnyLoading() {
        return Object.values(this.state.loadingStates).some(loading => loading);
    }

    /**
     * API를 호출하여 프로젝트 목록을 불러오고 상태를 업데이트합니다.
     * 간단한 리스트를 먼저 로드하고 상세 데이터는 백그라운드에서 로드합니다.
     */
    async loadProjects() {
        this.setLoadingState('projectsLoading', true);
        try {
            // 1. 간단한 프로젝트 리스트 먼저 로드
            const data = await api.fetchProjectsList();

            // 각 프로젝트에 상세 데이터 로드 상태 플래그 추가
            const projectsWithStatus = data.projects.map(project => ({
                ...project,
                isDetailLoaded: false,
                // 상세 데이터가 로드될 때까지 빈 객체로 초기화
                groups: [],
                worldview: null,
                worldview_groups: [],
                relationships: [],
                scenarios: [],
                manuscript_blocks: []
            }));

            this._setState({ projects: projectsWithStatus });

            // 2. 상세 데이터는 백그라운드에서 로드
            this.loadProjectDetailsInBackground(data.projects);

            // 프로젝트 목록 로드 완료 이벤트 발생
            this.emit('projects:loaded', projectsWithStatus);

        } catch (error) {
            console.error('Error loading projects:', error);
            this.emit('error', '프로젝트 목록을 불러오는 데 실패했습니다.');
            this._setState({ projects: [] });
        } finally {
            this.setLoadingState('projectsLoading', false);
        }
    }

    /**
     * 각 프로젝트의 상세 데이터를 백그라운드에서 로드합니다.
     * @param {Array} projects - 간단한 프로젝트 리스트
     */
    async loadProjectDetailsInBackground(projects) {
        for (const project of projects) {
            try {
                // 비밀번호가 설정된 프로젝트는 백그라운드에서 로드하지 않음
                // 사용자가 직접 선택할 때 비밀번호 입력 과정을 거치도록 함
                if (project.has_password) {
                    continue;
                }

                const details = await api.fetchProjectDetails(project.id);

                // 기존 프로젝트를 상세 데이터로 업데이트
                const updatedProjects = this.state.projects.map(p => {
                    if (p.id === project.id) {
                        return {
                            ...details,
                            isDetailLoaded: true
                        };
                    }
                    return p;
                });

                this._setState({ projects: updatedProjects });

            } catch (error) {
                // 403 에러는 비밀번호가 필요한 프로젝트이므로 무시하고 진행
                if (error.message && error.message.includes('403')) {
                } else {
                    console.warn(`Failed to load details for project ${project.id}:`, error);
                }
                // 상세 데이터 로드 실패 시에도 리스트는 유지
            }
        }
    }

    /**
     * 특정 프로젝트의 상세 정보를 불러와 현재 프로젝트로 설정합니다.
     * @param {string} projectId - 불러올 프로젝트의 ID
     */
    async selectProject(projectId) {
        if (this.state.currentProject && this.state.currentProject.id === projectId) {
            return;
        }

        this.setLoadingState('projectLoading', true);
        try {
            // 비밀번호 확인 로직은 UI 레이어에서 처리 후, 성공 시 이 메소드를 호출하는 것이 더 적합합니다.
            // 여기서는 성공적으로 인증되었다고 가정합니다.
            const projectDetails = await api.fetchProjectDetails(projectId);
            this._setState({ currentProject: projectDetails });
        } catch (error) {
            console.error('Error loading project details:', error);
            this.emit('error', '프로젝트 상세 정보를 불러오는 데 실패했습니다.');
            throw error; // 에러를 다시 던져서 호출한 곳에서 처리할 수 있도록 함
        } finally {
            this.setLoadingState('projectLoading', false);
        }
    }
    
    /**
     * 현재 프로젝트 데이터를 최신 상태로 리프레시합니다.
     */
    async refreshCurrentProject() {
        if (!this.state.currentProject) return;
        
        this._setState({ isLoading: true });
        try {
            const refreshedProject = await api.fetchProjectDetails(this.state.currentProject.id);
            
            // 전체 프로젝트 목록에서도 해당 프로젝트를 업데이트합니다.
            const updatedProjects = this.state.projects.map(p =>
                p.id === refreshedProject.id ? refreshedProject : p
            );
            
            this._setState({ 
                projects: updatedProjects,
                currentProject: refreshedProject, 
                isLoading: false 
            });

        } catch (error) {
            console.error('Error refreshing project:', error);
            this._setState({ isLoading: false });
            this.emit('error', '프로젝트를 새로고침하는 데 실패했습니다.');
        }
    }

    // 여기에 카드 추가/삭제, 그룹 생성/삭제 등 상태를 변경하는 다른 모든 API 호출 및 상태 업데이트 로직이 추가될 것입니다.
    // 예시:
    /**
     * 새로운 프로젝트를 생성합니다.
     * @param {string} name - 새 프로젝트의 이름
     * @param {string|null} password - 새 프로젝트의 비밀번호
     */
    async createProject(name, password, additionalData = {}) {
        this.setLoadingState('projectCreating', true);
        try {
            console.log('🔄 StateManager: 프로젝트 생성 시작 -', name);
            // 프로젝트 생성
            const newProject = await api.createProject(name, password);
            console.log('✅ StateManager: API 호출 성공 -', newProject);

            // 프로젝트 목록에 새 프로젝트 추가 (임시로 추가)
            const currentProjects = [...this.state.projects];
            const newProjectItem = {
                id: newProject.id,
                name: newProject.name,
                has_password: !!password,
                groups_count: 1, // 기본 그룹이 하나 있음
                scenarios_count: 1, // 기본 시나리오가 하나 있음
                isDetailLoaded: false,
                groups: [],
                worldview: null,
                worldview_groups: [],
                relationships: [],
                scenarios: [],
                manuscript_blocks: []
            };

            // 목록 앞에 새 프로젝트 추가
            this._setState({
                projects: [newProjectItem, ...currentProjects]
            });

            // 프로젝트 목록 로드 완료 이벤트 발생
            this.emit('projects:loaded', [newProjectItem, ...currentProjects]);

            // 백그라운드에서 전체 목록 다시 로드 (안전하게)
            setTimeout(() => {
                this.loadProjects().catch(err => {
                    console.warn('프로젝트 목록 재로드 실패:', err);
                });
            }, 1000);

        } catch (error) {
            console.error('Error creating project:', error);
            this.emit('error', '프로젝트 생성에 실패했습니다.');
        } finally {
            this.setLoadingState('projectCreating', false);
        }
    }

    /**
     * 프로젝트를 삭제합니다.
     * @param {string} projectId - 삭제할 프로젝트의 ID
     */
    async deleteProject(projectId) {
        this.setLoadingState('savingData', true);
        try {
            await api.deleteProject(projectId);
            // 현재 프로젝트가 삭제된 경우 클리어
            if (this.state.currentProject && this.state.currentProject.id === projectId) {
                this._setState({
                    currentProject: null,
                    projects: this.state.projects.filter(p => p.id !== projectId)
                });
            } else {
                // 목록에서만 제거
                this._setState({
                    projects: this.state.projects.filter(p => p.id !== projectId)
                });
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            this.emit('error', '프로젝트 삭제에 실패했습니다.');
        } finally {
            this.setLoadingState('savingData', false);
        }
    }

    /**
     * 프로젝트 정보를 수정합니다.
     * @param {string} projectId - 수정할 프로젝트의 ID
     * @param {string} newName - 새로운 프로젝트 이름
     */
    async updateProject(projectId, newName) {
        this._setState({ isLoading: true });
        try {
            await api.updateProject(projectId, newName);

            // 프로젝트 목록에서 해당 프로젝트 업데이트
            const updatedProjects = this.state.projects.map(p =>
                p.id === projectId ? { ...p, name: newName } : p
            );

            // 현재 프로젝트가 수정된 경우에도 업데이트
            const updatedCurrentProject = this.state.currentProject && this.state.currentProject.id === projectId
                ? { ...this.state.currentProject, name: newName }
                : this.state.currentProject;

            this._setState({
                projects: updatedProjects,
                currentProject: updatedCurrentProject,
                isLoading: false
            });
        } catch (error) {
            console.error('Error updating project:', error);
            this._setState({ isLoading: false });
            this.emit('error', '프로젝트 수정에 실패했습니다.');
        }
    }

    /**
     * 그룹을 생성합니다.
     * @param {string} projectId - 프로젝트 ID
     * @param {string} groupName - 생성할 그룹 이름
     */
    async createGroup(projectId, groupName) {
        this._setState({ isLoading: true });
        try {
            await api.createGroup(projectId, groupName);
            await this.refreshCurrentProject();
        } catch (error) {
            console.error('Error creating group:', error);
            this._setState({ isLoading: false });
            this.emit('error', '그룹 생성에 실패했습니다.');
        }
    }

    /**
     * 그룹을 삭제합니다.
     * @param {string} projectId - 프로젝트 ID
     * @param {string} groupId - 삭제할 그룹 ID
     */
    async deleteGroup(projectId, groupId) {
        this._setState({ isLoading: true });
        try {
            await api.deleteGroup(projectId, groupId);
            await this.refreshCurrentProject();
        } catch (error) {
            console.error('Error deleting group:', error);
            this._setState({ isLoading: false });
            this.emit('error', '그룹 삭제에 실패했습니다.');
        }
    }

    /**
     * 카드를 삭제합니다.
     * @param {string} projectId - 프로젝트 ID
     * @param {string} groupId - 그룹 ID
     * @param {string} cardId - 삭제할 카드 ID
     */
    async deleteCard(projectId, groupId, cardId) {
        this._setState({ isLoading: true });
        try {
            await api.deleteCard(projectId, groupId, cardId);
            await this.refreshCurrentProject();
        } catch (error) {
            console.error('Error deleting card:', error);
            this._setState({ isLoading: false });
            this.emit('error', '카드 삭제에 실패했습니다.');
        }
    }

    /**
     * 마지막으로 생성된 카드 정보를 저장합니다.
     * @param {object} card - 생성된 카드 데이터
     */
    setLastGeneratedCard(card) {
        this.lastGeneratedCard = card;
    }

    /**
     * 마지막으로 생성된 카드 정보를 반환합니다.
     * @returns {object|null} 마지막으로 생성된 카드 데이터
     */
    getLastGeneratedCard() {
        return this.lastGeneratedCard || null;
    }

    /**
     * 프로젝트 목록에서 특정 프로젝트의 상세 데이터를 로드합니다.
     * 현재 프로젝트 설정을 변경하지 않고 목록의 프로젝트만 업데이트합니다.
     * @param {string} projectId - 상세 데이터를 로드할 프로젝트의 ID
     */
    async loadProjectDetailsInList(projectId) {
        this.setLoadingState('projectLoading', true);

        try {
            const projectDetails = await api.fetchProjectDetails(projectId);

            // 프로젝트 목록에서 해당 프로젝트를 상세 데이터로 업데이트
            const updatedProjects = this.state.projects.map(p => {
                if (p.id === projectId) {
                    const updatedProject = {
                        ...projectDetails,
                        isDetailLoaded: true
                    };
                    return updatedProject;
                }
                return p;
            });

            this._setState({ projects: updatedProjects });
            this.setLoadingState('projectLoading', false);

            // 프로젝트 로드 완료 이벤트 발생
            this.emit('project:loaded', projectDetails);

            return true; // 성공을 나타내는 값 반환

        } catch (error) {
            console.error('Error loading project details in list:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                response: error.response,
                stack: error.stack
            });

            // 로딩 상태를 확실히 해제
            this.setLoadingState('projectLoading', false);

            this.emit('error', '프로젝트 상세 정보를 불러오는 데 실패했습니다.');
            return false; // 실패를 나타내는 값 반환
        }
    }
}
