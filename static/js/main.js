import * as api from './modules/api.js';
import * as ui from './modules/ui.js';
import * as modals from './modules/modals.js';
import * as panels from './modules/panels.js';

let lastGeneratedCard = null;
let projects = [];

document.addEventListener('DOMContentLoaded', () => {
    const mainHandlers = {
        getProjects: () => projects,
        getLastGeneratedCard: () => lastGeneratedCard,
        setLastGeneratedCard: (card) => { lastGeneratedCard = card; },
        showProjectDetails,
        handleCreateGroup,
        handleDeleteGroup,
        setupSortable,
        handleSaveWorldview,
        handleAiGenerateNewWorldview,
        handleAiEditWorldview,
        handleCreateWorldviewGroup,
        handleDeleteWorldviewGroup,
        handleDeleteCard,
        handleDeleteWorldviewCard,
        handleManualEditCard: panels.handleManualEditCard,
        handleEditCardAI: panels.handleEditCardAI,
        handleEditWorldviewCardAI: panels.handleEditWorldviewCardAI,
        openCardModal: modals.openCardModal,
        openWorldviewCardModal: modals.openWorldviewCardModal,
        showCharacterGeneratorUI: panels.showCharacterGeneratorUI,
        showRelationshipPanel: panels.showRelationshipPanel,
    };

    ui.initializeUI(mainHandlers);
    modals.initializeModals(mainHandlers);
    panels.initializePanels(mainHandlers);

    loadProjects();
    setupProjectCreation();
    initResizableSidebar();

    document.querySelectorAll('.modal-container, #modal-backdrop').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.close') || e.target === el) {
                e.preventDefault();
                modals.closeModal();
            }
        });
    });
});

// ... (이하 나머지 코드는 이전 버전과 동일합니다) ...

// -------------------------
// 초기화 및 전역 상태 관리
// -------------------------

function initResizableSidebar() {
    const resizer = document.getElementById('resizer');
    const root = document.documentElement;
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopResizing);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 600) newWidth = 600;
        root.style.setProperty('--sidebar-width', newWidth + 'px');
    }

    function stopResizing() {
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopResizing);
    }
}

function setupProjectCreation() {
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProject);
}

// -------------------------
// 이벤트 핸들러 (데이터 로직)
// -------------------------

async function loadProjects() {
    const projectList = document.querySelector('.project-list');
    try {
        const data = await api.fetchProjects();
        projects = data.projects;
        projectList.innerHTML = '';
        if (projects.length === 0) {
            projectList.innerHTML = '<li>생성된 프로젝트가 없습니다.</li>';
        } else {
            projects.forEach(project => {
                const li = document.createElement('li');
                const projectNameSpan = document.createElement('span');
                projectNameSpan.textContent = project.name;
                projectNameSpan.title = project.name;
                projectNameSpan.dataset.id = project.id;
                projectNameSpan.addEventListener('click', () => showProjectDetails(project.id));

                const buttonGroup = document.createElement('div');
                const updateBtn = document.createElement('button');
                updateBtn.textContent = '수정';
                updateBtn.classList.add('secondary', 'outline');
                updateBtn.style.cssText = 'padding: 0.1rem 0.4rem; font-size: 0.75rem; margin-right: 0.5rem;';
                updateBtn.dataset.projectId = project.id;
                updateBtn.dataset.currentName = project.name;
                updateBtn.addEventListener('click', handleUpdateProject);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '삭제';
                deleteBtn.classList.add('secondary', 'outline');
                deleteBtn.style.cssText = 'padding: 0.1rem 0.4rem; font-size: 0.75rem;';
                deleteBtn.dataset.projectId = project.id;
                deleteBtn.dataset.projectName = project.name;
                deleteBtn.addEventListener('click', handleDeleteProject);

                li.appendChild(projectNameSpan);
                buttonGroup.appendChild(updateBtn);
                buttonGroup.appendChild(deleteBtn);
                li.appendChild(buttonGroup);

                projectList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        projectList.innerHTML = `<li><span style="color: var(--pico-color-red-500);">로드 실패</span></li>`;
    }
}

// [수정] 비밀번호 확인 및 설정 로직 추가
async function showProjectDetails(projectId) {
    try {
        // 1. 비밀번호 필요 여부 확인
        const status = await api.checkPasswordStatus(projectId);
        const storedPassword = sessionStorage.getItem(`project-password-${projectId}`);

        // 2. 비밀번호가 필요한데, 세션에 저장된 비밀번호가 없을 경우
        if (status.requires_password && !storedPassword) {
            const password = prompt("이 프로젝트의 비밀번호를 입력하세요:");
            if (!password) return; // 사용자가 입력을 취소하면 아무것도 하지 않음

            try {
                await api.verifyPassword(projectId, password);
                // 인증 성공 시 sessionStorage에 비밀번호 저장
                sessionStorage.setItem(`project-password-${projectId}`, password);
            } catch (error) {
                alert("비밀번호가 틀렸습니다.");
                return; // 인증 실패 시 함수 종료
            }
        }

        // 3. (레거시 프로젝트) 비밀번호가 없으면 설정 유도
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
        
        // --- 이하 비밀번호 인증 후 기존 로직 수행 ---

        document.querySelectorAll('.sidebar li.active').forEach(i => i.classList.remove('active'));
        document.querySelector(`.project-list span[data-id="${projectId}"]`)?.closest('li').classList.add('active');

        document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
        const detailView = document.getElementById('project-detail-view');
        detailView.classList.add('active');

        const tabContainer = detailView.querySelector('nav ul');
        const newTabContainer = tabContainer.cloneNode(true);
        tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
        newTabContainer.querySelectorAll('.tab-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = link.dataset.tab;
                newTabContainer.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                detailView.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(`tab-content-${tabId}`).classList.add('active');
            });
        });

        if (!newTabContainer.querySelector('.tab-link.active')) {
            newTabContainer.querySelector('.tab-link[data-tab="characters"]').classList.add('active');
            detailView.querySelector('#tab-content-characters').classList.add('active');
        }

        document.getElementById('card-list-container').innerHTML = '<p aria-busy="true">캐릭터 목록을 불러오는 중...</p>';
        document.getElementById('worldview-card-list-container').innerHTML = '<p aria-busy="true">세계관 카드 목록을 불러오는 중...</p>';

        const projectData = await api.fetchProjectDetails(projectId);
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex > -1) {
            projects[projectIndex] = projectData;
        } else {
            projects.push(projectData);
        }

        document.getElementById('project-title-display').textContent = projectData.name;
        document.getElementById('project-title-display').dataset.currentProjectId = projectId;

        ui.renderCharacterTab(projectData);
        ui.renderWorldviewTab(projectData);

    } catch (error) {
        console.error('Error loading project details:', error);
        document.getElementById('card-list-container').innerHTML = `<p style="color: var(--pico-color-red-500);">정보 로딩 실패: ${error.message}</p>`;
    }
}

function setupSortable(lists, projectId, type) {
    lists.forEach(list => {
        new Sortable(list, {
            group: `shared-${type}-cards`,
            animation: 150,
            ghostClass: 'pico-color-azure-200',
            onEnd: async function (evt) {
                const cardId = evt.item.dataset.cardId;
                const fromGroupId = evt.from.dataset.groupId;
                const toGroupId = evt.to.dataset.groupId;

                try {
                    const isCharacter = type === 'character';

                    if (fromGroupId !== toGroupId) {
                        isCharacter ? await api.moveCard(projectId, cardId, fromGroupId, toGroupId) : await api.moveWorldviewCard(projectId, cardId, fromGroupId, toGroupId);
                    }

                    const updateOrder = async (groupId, listEl) => {
                        const cardIds = Array.from(listEl.children).map(c => c.dataset.cardId).filter(Boolean);
                        if(cardIds.length === 0 && listEl.innerHTML.includes('카드가 없습니다')) return;
                        isCharacter ? await api.updateCardOrder(projectId, groupId, cardIds) : await api.updateWorldviewCardOrder(projectId, groupId, cardIds);
                    };

                    await updateOrder(toGroupId, evt.to);
                    if (fromGroupId !== toGroupId) await updateOrder(fromGroupId, evt.from);
                    
                    if (evt.from.children.length === 0) evt.from.innerHTML = '<p><small>카드가 없습니다.</small></p>';
                    if (evt.to.querySelector('p')) {
                        evt.to.innerHTML = '';
                        evt.to.appendChild(evt.item);
                    }
                    
                    await showProjectDetails(projectId);
                } catch (error) {
                    console.error('드래그앤드롭 처리 실패:', error);
                    alert(error.message);
                    await showProjectDetails(projectId);
                }
            }
        });
    });
}

// [수정] 새 프로젝트 생성 시 비밀번호 입력받도록 수정
async function handleCreateProject(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector('input[name="name"]');
    const button = form.querySelector('button');
    const projectName = input.value.trim();
    if (!projectName) { alert('프로젝트 이름을 입력해주세요.'); return; }
    
    const password = prompt("새 프로젝트에 사용할 비밀번호를 입력하세요.\n(입력하지 않으면 비밀번호 없이 생성됩니다)");

    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    try {
        await api.createProject(projectName, password || null); // 비밀번호가 없으면 null 전달
        alert('새로운 프로젝트가 생성되었습니다!');
        input.value = '';
        await loadProjects();
    } catch (error) {
        console.error('프로젝트 생성 실패:', error);
        alert(error.message);
    } finally {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}

async function handleUpdateProject(event) {
    event.stopPropagation();
    const { projectId, currentName } = event.currentTarget.dataset;
    const newName = prompt("새로운 프로젝트 이름을 입력하세요:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
        event.currentTarget.setAttribute('aria-busy', 'true');
        event.currentTarget.disabled = true;
        try {
            await api.updateProject(projectId, newName);
            alert('프로젝트 이름이 수정되었습니다.');
            await loadProjects();
            const titleDisplay = document.getElementById('project-title-display');
            if(titleDisplay.dataset.currentProjectId === projectId) {
                titleDisplay.textContent = newName.trim();
            }
        } catch (error) {
            console.error('프로젝트 이름 수정 실패:', error);
            alert(error.message);
        } finally {
            event.currentTarget.setAttribute('aria-busy', 'false');
            event.currentTarget.disabled = false;
        }
    }
}

async function handleDeleteProject(event) {
    event.stopPropagation();
    const { projectId, projectName } = event.currentTarget.dataset;
    if (confirm(`정말로 '${projectName}' 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        event.currentTarget.setAttribute('aria-busy', 'true');
        event.currentTarget.disabled = true;
        try {
            await api.deleteProject(projectId);
            alert('프로젝트가 삭제되었습니다.');
            if (document.getElementById('project-title-display').dataset.currentProjectId === projectId) {
                document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
                document.getElementById('welcome-view').classList.add('active');
            }
            await loadProjects();
        } catch (error) {
            console.error('프로젝트 삭제 실패:', error);
            alert(error.message);
            event.currentTarget.setAttribute('aria-busy', 'false');
            event.currentTarget.disabled = false;
        }
    }
}

async function handleCreateGroup(event, projectId) {
    event.preventDefault();
    const form = event.currentTarget;
    const groupName = form.elements.name.value.trim();
    if (!groupName) { alert('그룹 이름을 입력해주세요.'); return; }
    form.querySelector('button').setAttribute('aria-busy', 'true');
    try {
        await api.createGroup(projectId, groupName);
        alert('그룹이 성공적으로 생성되었습니다.');
        await showProjectDetails(projectId);
    } catch (error) {
        console.error('그룹 생성 실패:', error);
        alert(error.message);
    } finally {
        form.querySelector('button').setAttribute('aria-busy', 'false');
        form.reset();
    }
}

async function handleDeleteGroup(event, projectId) {
    event.stopPropagation();
    const { groupId, groupName } = event.currentTarget.dataset;
    if (confirm(`정말로 '${groupName}' 그룹을 삭제하시겠습니까?\n모든 카드도 함께 삭제됩니다.`)) {
        event.currentTarget.setAttribute('aria-busy', 'true');
        try {
            await api.deleteGroup(projectId, groupId);
            alert('그룹이 삭제되었습니다.');
            await showProjectDetails(projectId);
        } catch (error) {
            console.error('그룹 삭제 실패:', error);
            alert(error.message);
        }
    }
}

async function handleDeleteCard(event, projectId, groupId, cardId) {
    if (!confirm("정말로 이 카드를 삭제하시겠습니까?")) return;
    try {
        await api.deleteCard(projectId, groupId, cardId);
        alert('카드가 삭제되었습니다.');
        await showProjectDetails(projectId);
    } catch (error) {
        console.error('카드 삭제 실패:', error);
        alert(error.message);
    }
}

async function handleSaveWorldview(projectId) {
    const content = document.getElementById('worldview-content').value;
    const button = document.getElementById('save-worldview-btn');
    button.setAttribute('aria-busy', 'true');
    try {
        await api.saveWorldview(projectId, content);
        alert('세계관 설정이 성공적으로 저장되었습니다.');
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex > -1) projects[projectIndex].worldview.content = content;
    } catch (error) {
        console.error('세계관 저장 실패:', error);
        alert(error.message);
    } finally {
        button.setAttribute('aria-busy', 'false');
    }
}

async function handleAiGenerateNewWorldview(projectId) {
    const keywords = prompt("새로운 세계관의 핵심 키워드를 입력해주세요.\n예: 사이버펑크, 동양 신화, 인공지능 신");
    if (!keywords) return;

    const button = document.getElementById('ai-generate-new-btn');
    const worldviewContent = document.getElementById('worldview-content');
    button.setAttribute('aria-busy', 'true');
    worldviewContent.value = "AI가 새로운 세계관을 생성하는 중입니다...";
    try {
        const data = await api.generateNewWorldview({
            keywords, model_name: document.getElementById('ai-model-select').value
        });
        worldviewContent.value = data.worldview_text;
        alert('새로운 세계관이 생성되었습니다! "메인 세계관 저장" 버튼을 눌러야 최종 반영됩니다.');
    } catch (error) {
        console.error('AI 세계관 생성 실패:', error);
        alert(error.message);
        worldviewContent.value = "오류가 발생했습니다.";
    } finally {
        button.setAttribute('aria-busy', 'false');
    }
}

async function handleAiEditWorldview(projectId) {
    const existingContent = document.getElementById('worldview-content').value;
    if (!existingContent) { alert('먼저 기존 세계관 내용을 입력하거나 생성해야 합니다.'); return; }
    const keywords = prompt("기존 세계관에 추가하거나 변경하고 싶은 내용을 입력해주세요.\n예: '기계 교단'에 대한 자세한 설명 추가");
    if (!keywords) return;

    const button = document.getElementById('ai-work-on-existing-btn');
    const worldviewContent = document.getElementById('worldview-content');
    button.setAttribute('aria-busy', 'true');
    worldviewContent.value += "\n\nAI가 기존 세계관을 바탕으로 작업 중입니다...";
    try {
        const data = await api.editWorldview({
            keywords, existing_content: existingContent, model_name: document.getElementById('ai-model-select').value
        });
        worldviewContent.value = data.worldview_text;
        alert('세계관 수정이 완료되었습니다! "메인 세계관 저장" 버튼을 눌러야 최종 반영됩니다.');
    } catch (error) {
        console.error('AI 세계관 수정 실패:', error);
        alert(error.message);
        worldviewContent.value = existingContent;
    } finally {
        button.setAttribute('aria-busy', 'false');
    }
}

async function handleCreateWorldviewGroup(event, projectId) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    if (!name) return;
    form.querySelector('button').setAttribute('aria-busy', 'true');
    try {
        await api.createWorldviewGroup(projectId, name);
        alert('설정 그룹이 생성되었습니다.');
        await showProjectDetails(projectId);
    } catch (error) {
        alert(error.message);
    } finally {
        form.querySelector('button').setAttribute('aria-busy', 'false');
        form.reset();
    }
}

async function handleDeleteWorldviewGroup(event, projectId) {
    event.stopPropagation();
    const { groupId, groupName } = event.currentTarget.dataset;
    if (!confirm(`'${groupName}' 그룹을 삭제하시겠습니까?`)) return;
    event.currentTarget.setAttribute('aria-busy', 'true');
    try {
        await api.deleteWorldviewGroup(projectId, groupId);
        alert('설정 그룹이 삭제되었습니다.');
        await showProjectDetails(projectId);
    } catch (error) {
        alert(error.message);
    }
}

async function handleDeleteWorldviewCard(projectId, cardId) {
    if (!cardId) {
        alert("먼저 카드를 저장해야 삭제할 수 있습니다.");
        return;
    }
    if (!confirm("정말로 이 설정 카드를 삭제하시겠습니까?")) return;

    try {
        await api.deleteWorldviewCard(projectId, cardId);
        alert('설정 카드가 삭제되었습니다.');
        modals.closeModal();
        await showProjectDetails(projectId);
    } catch (error) {
        console.error('설정 카드 삭제 실패:', error);
        alert(error.message);
    }
}