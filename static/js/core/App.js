import { StateManager } from './StateManager.js';
import { EventListenerManager } from './EventListenerManager.js';
import * as ui from '../modules/ui.js';
import * as modals from '../modules/modals.js';
import * as panels from '../modules/panels.js';
import * as api from '../modules/api.js';

// 개별 패널 모듈들을 import
import { showCharacterGeneratorUI } from '../modules/panels/character-generator.js';
import { showRelationshipPanel } from '../modules/panels/relationship-panel.js';
import { handleEditCardAI, handleManualEditCard } from '../modules/panels/character-editor.js';
import { handleEditWorldviewCardAI } from '../modules/panels/worldview-editor.js';

// [신규] 공통 AI 모달 import
import * as commonAiModal from '../modules/common-ai-modal.js';

/**
 * 애플리케이션의 메인 컨트롤러 클래스.
 * 모든 모듈을 초기화하고, 상태 변경을 감지하며, 이벤트에 따라 각 모듈의 동작을 조율합니다.
 */
export class App {
    constructor() {
        this.stateManager = new StateManager();
        this.eventManager = new EventListenerManager();
        this.panels = {
            showCharacterGeneratorUI,
            showRelationshipPanel,
            handleEditCardAI,
            handleManualEditCard,
            handleEditWorldviewCardAI
        };
        this.modals = { ...modals };
        this.initializeModules();
        this.bindEventListeners();
        this.stateManager.loadProjects();
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
        document.getElementById('create-project-form').addEventListener('submit', (e) => this.handleCreateProject(e));
        
        document.querySelector('.project-list').addEventListener('click', (e) => {
             if (e.target.matches('.project-name-span')) {
                this.handleSelectProject(e.target.dataset.id);
            } else if (e.target.matches('.update-project-btn')) {
                this.handleUpdateProject(e);
            } else if (e.target.matches('.delete-project-btn')) {
                this.handleDeleteProject(e);
            }
        });

        document.querySelector('#project-detail-view nav ul').addEventListener('click', (e) => {
            if(e.target.matches('.tab-link')) {
                e.preventDefault();
                ui.activateTab(e.target.dataset.tab);
            }
        });

        // [수정] 중복되는 전역 이벤트 리스너를 삭제하여 버그를 해결합니다.
        // document.addEventListener('click', (e) => { ... });
    }
    
    /**
     * 현재 상태(state)를 기반으로 전체 UI를 다시 렌더링합니다.
     * @param {object} state - StateManager가 관리하는 현재 애플리케이션 상태
     */
    renderUI(state) {
        ui.renderProjectList(state.projects);
        if (state.currentProject) {
            ui.renderProjectDetail(state.currentProject);
        } else {
            ui.showWelcomeView();
        }
    }

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

    async handleCreateGroup(event, projectId) {
        event.preventDefault();
        const form = event.currentTarget;
        const groupName = form.elements.name.value.trim();
        if (!groupName) {
            alert('그룹 이름을 입력해주세요.');
            return;
        }
        form.querySelector('button').setAttribute('aria-busy', 'true');
        try {
            await this.stateManager.createGroup(projectId, groupName);
            alert('그룹이 성공적으로 생성되었습니다.');
            form.reset();
        } catch (error) {
            console.error('그룹 생성 실패:', error);
            alert(error.message);
        } finally {
            form.querySelector('button').setAttribute('aria-busy', 'false');
        }
    }

    async handleDeleteGroup(projectId, groupId, groupName) {
        if (confirm(`정말로 '${groupName}' 그룹을 삭제하시겠습니까?\n모든 카드도 함께 삭제됩니다.`)) {
            try {
                await this.stateManager.deleteGroup(projectId, groupId);
                alert('그룹이 삭제되었습니다.');
            } catch (error) {
                console.error('그룹 삭제 실패:', error);
                alert(error.message);
            }
        }
    }

    async handleDeleteCard(projectId, groupId, cardId) {
        if (!confirm("정말로 이 카드를 삭제하시겠습니까?")) return;
        try {
            await this.stateManager.deleteCard(projectId, groupId, cardId);
            alert('카드가 삭제되었습니다.');
        } catch (error) {
            console.error('카드 삭제 실패:', error);
            alert(error.message);
        }
    }

    setupSortable(lists, projectId, type) {
        lists.forEach(list => {
            new Sortable(list, {
                group: `shared-${type}-cards`,
                animation: 150,
                ghostClass: 'pico-color-azure-200',
                onEnd: async (evt) => {
                    const cardId = evt.item.dataset.cardId;
                    const fromGroupId = evt.from.dataset.groupId;
                    const toGroupId = evt.to.dataset.groupId;

                    try {
                        const isCharacter = type === 'character';

                        if (fromGroupId !== toGroupId) {
                            if (isCharacter) {
                                await api.moveCard(projectId, cardId, fromGroupId, toGroupId);
                            } else {
                                await api.moveWorldviewCard(projectId, cardId, fromGroupId, toGroupId);
                            }
                        }

                        const updateOrder = async (groupId, listEl) => {
                            const cardIds = Array.from(listEl.children)
                                .map(c => c.dataset.cardId)
                                .filter(Boolean);

                            if (cardIds.length === 0 && listEl.innerHTML.includes('카드가 없습니다')) return;

                            if (isCharacter) {
                                await api.updateCardOrder(projectId, groupId, cardIds);
                            } else {
                                await api.updateWorldviewCardOrder(projectId, groupId, cardIds);
                            }
                        };

                        await updateOrder(toGroupId, evt.to);
                        if (fromGroupId !== toGroupId) {
                            await updateOrder(fromGroupId, evt.from);
                        }

                        if (evt.from.children.length === 0) {
                            evt.from.innerHTML = '<p><small>카드가 없습니다.</small></p>';
                        }
                        if (evt.to.querySelector('p')) {
                            evt.to.innerHTML = '';
                            evt.to.appendChild(evt.item);
                        }

                        await this.stateManager.refreshCurrentProject();

                    } catch (error) {
                        console.error('드래그앤드롭 처리 실패:', error);
                        alert(error.message);
                        await this.stateManager.refreshCurrentProject();
                    }
                }
            });
        });
    }

    async handleRefineConcept() {
        const conceptTextarea = document.getElementById('scenario-summary');
        const originalConcept = conceptTextarea.value.trim();
        const projectId = document.getElementById('project-title-display').dataset.currentProjectId;

        if (!originalConcept) {
            alert('먼저 다듬을 컨셉을 입력해주세요.');
            return;
        }
        if (!projectId) {
            alert('현재 활성화된 프로젝트를 찾을 수 없습니다.');
            return;
        }

        const button = document.getElementById('refine-concept-btn');
        button.setAttribute('aria-busy', 'true');

        const fetchRefinedConcept = async () => {
            const requestBody = {
                existing_concept: originalConcept,
                project_id: projectId,
                model_name: document.getElementById('ai-model-select').value
            };
            return await api.refineScenarioConcept(requestBody);
        };

        try {
            const result = await fetchRefinedConcept();

            const onAccept = (acceptedConcept) => {
                conceptTextarea.value = acceptedConcept;
                alert('AI의 제안이 적용되었습니다! "시나리오 정보 저장" 버튼을 눌러 변경사항을 최종 저장하세요.');
                this.modals.closeModal();
            };

            const onReroll = async () => {
                const rerollBtn = document.getElementById('refine-concept-reroll-btn');
                rerollBtn.setAttribute('aria-busy', 'true');
                rerollBtn.disabled = true;

                try {
                    const newResult = await fetchRefinedConcept();
                    this.modals.updateRefineConceptSuggestion(newResult.refined_concept, onAccept);
                } catch (error) {
                    alert(`새로운 제안을 가져오는 데 실패했습니다: ${error.message}`);
                    document.getElementById('refine-concept-suggestion').textContent = '오류가 발생했습니다.';
                } finally {
                    rerollBtn.setAttribute('aria-busy', 'false');
                    rerollBtn.disabled = false;
                }
            };

            this.modals.openRefineConceptModal(originalConcept, result.refined_concept, onAccept, onReroll);

        } catch(error) {
            alert(`AI 컨셉 다듬기 실패: ${error.message}`);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleRefineWorldviewRule(event, projectId, inputField) {
        const originalRule = inputField.value.trim();
        if (!originalRule) {
            alert('먼저 다듬을 설정 내용을 입력해주세요.');
            return;
        }

        const button = event.currentTarget;
        button.setAttribute('aria-busy', 'true');

        const fetchRefinedRule = async (rule) => {
            const requestBody = {
                existing_rule: rule,
                project_id: projectId,
                model_name: document.getElementById('ai-model-select').value
            };
            return await api.refineWorldviewRule(requestBody);
        };

        try {
            const result = await fetchRefinedRule(originalRule);

            const onAccept = (acceptedRule) => {
                inputField.value = acceptedRule;
                alert('AI의 제안이 적용되었습니다! "메인 세계관 저장" 버튼을 눌러 변경사항을 최종 저장하세요.');
                this.modals.closeModal();
            };

            const onReroll = async () => {
                const currentRule = document.getElementById('refine-rule-original').textContent;
                const rerollBtn = document.getElementById('refine-rule-reroll-btn');
                rerollBtn.setAttribute('aria-busy', 'true');
                rerollBtn.disabled = true;

                try {
                    const newResult = await fetchRefinedRule(currentRule);
                    this.modals.updateRefineWorldviewRuleSuggestion(newResult.refined_rule, onAccept);
                } catch (error) {
                    alert(`새로운 제안을 가져오는 데 실패했습니다: ${error.message}`);
                    document.getElementById('refine-rule-suggestion').textContent = '오류가 발생했습니다.';
                } finally {
                    rerollBtn.setAttribute('aria-busy', 'false');
                    rerollBtn.disabled = false;
                }
            };

            this.modals.openRefineWorldviewRuleModal(originalRule, result.refined_rule, onAccept, onReroll);

        } catch(error) {
            alert(`AI 설정 다듬기 실패: ${error.message}`);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleSaveWorldview(projectId) {
        const form = document.getElementById('worldview-form');
        const getButton = () => document.getElementById('save-worldview-btn');
        let button = getButton();
        
        if (!button) {
            console.error('세계관 저장 버튼을 찾을 수 없습니다.');
            return;
        }

        const rules = Array.from(form.querySelectorAll('#worldview-rules-container textarea[name="rules"]'))
            .map(textarea => textarea.value.trim())
            .filter(Boolean);

        const worldviewData = {
            logline: form.elements.logline.value.trim(),
            genre: form.elements.genre.value.trim(),
            rules: rules
        };

        button.setAttribute('aria-busy', 'true');
        try {
            await api.saveWorldview(projectId, worldviewData);
            alert('세계관 설정이 성공적으로 저장되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('세계관 저장 실패:', error);
            alert(error.message);
        } finally {
            button = getButton();
            if (button) {
                button.setAttribute('aria-busy', 'false');
            }
        }
    }

    async handleCreateWorldviewGroup(event, projectId) {
        event.preventDefault();
        const form = event.currentTarget;
        const name = form.elements.name.value.trim();
        if (!name) return;

        form.querySelector('button').setAttribute('aria-busy', 'true');
        try {
            await api.createWorldviewGroup(projectId, name);
            alert('설정 그룹이 생성되었습니다.');
            await this.stateManager.refreshCurrentProject();
            form.reset();
        } catch (error) {
            console.error('설정 그룹 생성 실패:', error);
            alert(error.message);
        } finally {
            form.querySelector('button').setAttribute('aria-busy', 'false');
        }
    }

    async handleDeleteWorldviewGroup(event, projectId) {
        event.stopPropagation();
        const { groupId, groupName } = event.currentTarget.dataset;
        if (!confirm(`'${groupName}' 그룹을 삭제하시겠습니까?`)) return;

        event.currentTarget.setAttribute('aria-busy', 'true');
        try {
            await api.deleteWorldviewGroup(projectId, groupId);
            alert('설정 그룹이 삭제되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('설정 그룹 삭제 실패:', error);
            alert(error.message);
        } finally {
            event.currentTarget.setAttribute('aria-busy', 'false');
        }
    }

    async handleDeleteWorldviewCard(projectId, cardId) {
        if (!cardId) {
            alert("먼저 카드를 저장해야 삭제할 수 있습니다.");
            return;
        }
        if (!confirm("정말로 이 설정 카드를 삭제하시겠습니까?")) return;

        try {
            await api.deleteWorldviewCard(projectId, cardId);
            alert('설정 카드가 삭제되었습니다.');
            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('설정 카드 삭제 실패:', error);
            alert(error.message);
        }
    }

    async handleSaveScenario(event, projectId, scenarioId) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        
        const themes = form.elements.themes.value.split(',')
            .map(theme => theme.trim())
            .filter(Boolean);

        const scenarioData = {
            title: form.elements.title.value,
            summary: form.elements.summary.value,
            synopsis: form.elements.synopsis.value,
            themes: themes
        };
        
        if (button) button.setAttribute('aria-busy', 'true');
        
        try {
            await api.updateScenario(projectId, scenarioId, scenarioData);
            alert('시나리오 정보가 성공적으로 저장되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('시나리오 저장 실패:', error);
            alert(error.message);
        } finally {
            // UI가 새로 렌더링된 후이므로, DOM에서 버튼을 다시 찾아야 합니다.
            const newButton = document.querySelector('#scenario-details-form button[type="submit"]');
            if (newButton) {
                newButton.setAttribute('aria-busy', 'false');
            }
        }
    }

    async handleCreatePlotPoint(event, projectId, scenarioId) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');

        const plotData = {
            title: form.elements.title.value,
            content: form.elements.content.value
        };

        if (!plotData.title) {
            alert('플롯 제목을 입력해주세요.');
            return;
        }

        button.setAttribute('aria-busy', 'true');
        try {
            await api.createPlotPoint(projectId, scenarioId, plotData);
            form.reset();
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('플롯 포인트 생성 실패:', error);
            alert(error.message);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleAiDraftGeneration(event, projectId, scenarioId) {
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const selectedCharacterIds = Array.from(form.querySelectorAll('input[name="character_ids"]:checked')).map(cb => cb.value);
        const plotPointCount = parseInt(form.elements.plot_point_count.value, 10);
        const styleGuideSelect = document.getElementById('draft-style-guide-select'); // [신규] 스토리 초안 모달의 스타일 선택 요소 가져오기

        if (selectedCharacterIds.length === 0) {
            alert('주요 등장인물을 1명 이상 선택해주세요.');
            return;
        }

        if (!plotPointCount || plotPointCount < 5 || plotPointCount > 50) {
            alert('플롯 개수는 5에서 50 사이의 숫자여야 합니다.');
            return;
        }

        button.setAttribute('aria-busy', 'true');
        try {
            const requestBody = {
                character_ids: selectedCharacterIds,
                plot_point_count: plotPointCount,
                model_name: document.getElementById('ai-model-select').value,
                style_guide_id: styleGuideSelect.value // [신규] 선택된 스타일 가이드 ID 추가
            };

            await api.generateAiScenarioDraft(projectId, scenarioId, requestBody);
            alert('AI가 새로운 스토리 초안을 성공적으로 생성했습니다!');

            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();

        } catch (error) {
            console.error('AI 시나리오 초안 생성 실패:', error);
            alert(error.message);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * [수정] AI를 이용해 전체 플롯 포인트를 수정하는 전체 워크플로우를 처리합니다.
     */
    async handleAiEditPlots() {
        const { currentProject } = this.stateManager.getState();
        if (!currentProject || !currentProject.scenarios || currentProject.scenarios.length === 0) {
            alert('현재 활성화된 시나리오가 없습니다.');
            return;
        }
        const mainScenario = currentProject.scenarios[0];
        if (!mainScenario.plot_points || mainScenario.plot_points.length === 0) {
            alert('수정할 플롯이 없습니다. 먼저 AI로 초안을 생성해주세요.');
            return;
        }

        const userPrompt = prompt("전체 플롯을 어떤 방향으로 수정하고 싶으신가요?\n\n예시:\n- 후반부 전개를 좀 더 희망적으로 바꿔줘.\n- 20번부터 25번 플롯까지의 긴장감을 더 높여줘.\n- 주인공의 라이벌을 더 일찍 등장시켜줘.");
        if (!userPrompt || !userPrompt.trim()) {
            return;
        }

        const button = document.getElementById('ai-edit-plots-btn');
        button.setAttribute('aria-busy', 'true');

        try {
            const requestBody = {
                user_prompt: userPrompt,
                model_name: document.getElementById('ai-model-select').value
            };
            const result = await api.editAllPlotPointsWithAi(currentProject.id, mainScenario.id, requestBody);
            
            const onAccept = async (suggestedPlots) => {
                const acceptBtn = document.getElementById('plot-points-diff-accept-btn');
                acceptBtn.setAttribute('aria-busy', 'true');
                
                try {
                    // 모든 플롯 포인트를 순차적으로 업데이트합니다.
                    const updatePromises = suggestedPlots.map((plot, index) => {
                        const originalPlot = mainScenario.plot_points[index];
                        const plotData = {
                            title: plot.title,
                            content: plot.content
                        };
                        return api.updatePlotPoint(currentProject.id, mainScenario.id, originalPlot.id, plotData);
                    });

                    await Promise.all(updatePromises);
                    
                    alert('AI의 수정 제안이 성공적으로 적용되었습니다!');
                    this.modals.closeModal();
                    await this.stateManager.refreshCurrentProject();

                } catch (error) {
                    console.error('플롯 포인트 적용 실패:', error);
                    alert(`플롯 적용 중 오류가 발생했습니다: ${error.message}`);
                } finally {
                    // [버그 수정] 작업 성공/실패와 관계없이 스피너를 멈춥니다.
                    acceptBtn.setAttribute('aria-busy', 'false');
                }
            };

            this.modals.openPlotPointsDiffModal(mainScenario.plot_points, result.plot_points, onAccept);

        } catch (error) {
            console.error('AI 전체 플롯 수정 실패:', error);
            alert(error.message);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * [버그 수정] 플롯 포인트를 수정합니다. (stale reference 방지)
     * @param {HTMLFormElement} form - 이벤트 리스너가 참조하던 form (사용하지 않음)
     * @param {string} projectId - 프로젝트 ID
     * @param {string} scenarioId - 시나리오 ID
     */
    async handleUpdatePlotPoint(form, projectId, scenarioId) {
        // stale reference 문제를 피하기 위해 DOM에서 직접 최신 form과 button을 가져옵니다.
        const currentForm = document.getElementById('plot-point-edit-form');
        const button = document.getElementById('plot-point-save-btn');

        if (!currentForm || !button) {
            console.error("플롯 포인트 편집 폼 또는 저장 버튼을 찾을 수 없습니다.");
            return;
        }

        const plotPointId = currentForm.elements.plot_point_id.value;
        const plotData = {
            title: currentForm.elements.title.value,
            content: currentForm.elements.content.value,
            scene_draft: currentForm.elements.scene_draft.value
        };

        button.setAttribute('aria-busy', 'true');
        try {
            await api.updatePlotPoint(projectId, scenarioId, plotPointId, plotData);
            alert('플롯 포인트가 성공적으로 저장되었습니다.');
            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();
        } catch(error) {
            alert(`저장 실패: ${error.message}`);
        } finally {
            // UI가 닫히기 전이므로, 기존 버튼 참조를 사용해도 안전합니다.
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleDeletePlotPoint(plotPointId, projectId, scenarioId) {
        if (!confirm("정말로 이 플롯 포인트를 삭제하시겠습니까?")) return;

        const button = document.getElementById('plot-point-delete-btn');
        button.setAttribute('aria-busy', 'true');
        try {
            await api.deletePlotPoint(projectId, scenarioId, plotPointId);
            alert('플롯 포인트가 삭제되었습니다.');
            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();
        } catch(error) {
            alert(`삭제 실패: ${error.message}`);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleDeleteAllPlotPoints(projectId, scenarioId) {
        if (!confirm("정말로 이 시나리오의 모든 플롯 포인트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

        let button = document.getElementById('delete-all-plots-btn');
        if (button) {
            button.setAttribute('aria-busy', 'true');
        }
        
        try {
            await api.deleteAllPlotPoints(projectId, scenarioId);
            alert('모든 플롯 포인트가 성공적으로 삭제되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch(error) {
            alert(`전체 삭제 실패: ${error.message}`);
        } finally {
            button = document.getElementById('delete-all-plots-btn');
            if (button) {
                button.setAttribute('aria-busy', 'false');
            }
        }
    }

    async handleAiSceneGeneration(plotPointId, projectId, scenarioId) {
        const button = document.getElementById('plot-point-ai-scene-btn');
        const formatSelect = document.getElementById('scene-format-select');
        const sceneDraftTextarea = document.getElementById('plot-point-scene-draft');
        const wordCountSlider = document.getElementById('word-count-slider');
        const styleGuideSelect = document.getElementById('style-guide-select'); // [신규] 스타일 가이드 select 요소 가져오기

        const project = this.stateManager.getState().currentProject;
        
        // 선택된 캐릭터 ID들만 가져오기
        const selectedCharacterIds = Array.from(document.querySelectorAll('#plot-point-character-selection input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        // 글자 수 옵션 매핑
        const wordCountOptions = ['short', 'medium', 'long'];
        const wordCount = wordCountOptions[parseInt(wordCountSlider.value)];

        const requestBody = {
            output_format: formatSelect.value,
            character_ids: selectedCharacterIds,
            model_name: document.getElementById('ai-model-select').value,
            word_count: wordCount,
            style_guide_id: styleGuideSelect.value // [신규] 선택된 스타일 가이드 ID 추가
        };

        button.setAttribute('aria-busy', 'true');
        sceneDraftTextarea.value = "AI가 장면을 생성하고 있습니다...";
        try {
            const result = await api.generateSceneForPlotPoint(projectId, plotPointId, requestBody);
            sceneDraftTextarea.value = result.scene_draft;
            alert('AI 장면 생성이 완료되었습니다. 내용을 확인하고 "변경사항 저장"을 눌러주세요.');
        } catch(error) {
            alert(`AI 장면 생성 실패: ${error.message}`);
            sceneDraftTextarea.value = "오류가 발생했습니다. 다시 시도해주세요.";
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleAiSceneEdit(plotPointId, projectId, scenarioId) {
        const sceneDraftTextarea = document.getElementById('plot-point-scene-draft');
        
        if (!sceneDraftTextarea.value.trim()) {
            alert('수정할 장면 초안이 없습니다. 먼저 "AI로 장면 생성"을 사용해주세요.');
            return;
        }

        const userEditRequest = prompt(
            "장면을 어떻게 수정하고 싶으신가요?\n\n" +
            "예시:\n" +
            "• '분위기를 더 어둡게 바꿔줘'\n" +
            "• '주인공의 대사를 더 단호한 어조로 수정해줘'\n" +
            "• '액션 장면을 더 생생하게 만들어줘'\n" +
            "• '감정 표현을 더 섬세하게 해줘'"
        );
        
        if (!userEditRequest || !userEditRequest.trim()) return;

        const button = document.getElementById('plot-point-ai-edit-btn');
        const formatSelect = document.getElementById('scene-format-select');
        const wordCountSlider = document.getElementById('word-count-slider');
        const styleGuideSelect = document.getElementById('style-guide-select'); // [신규] 스타일 가이드 select 요소 가져오기

        const project = this.stateManager.getState().currentProject;
        
        // 선택된 캐릭터 ID들만 가져오기
        const selectedCharacterIds = Array.from(document.querySelectorAll('#plot-point-character-selection input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        // 글자 수 옵션 매핑
        const wordCountOptions = ['short', 'medium', 'long'];
        const wordCount = wordCountOptions[parseInt(wordCountSlider.value)];

        const requestBody = {
            user_edit_request: userEditRequest,
            output_format: formatSelect.value,
            character_ids: selectedCharacterIds,
            model_name: document.getElementById('ai-model-select').value,
            word_count: wordCount,
            style_guide_id: styleGuideSelect.value // [신규] 선택된 스타일 가이드 ID 추가
        };

        button.setAttribute('aria-busy', 'true');
        const originalValue = sceneDraftTextarea.value;
        sceneDraftTextarea.value = "AI가 장면을 수정하고 있습니다...";
        
        try {
            const result = await api.editSceneForPlotPoint(projectId, plotPointId, requestBody);
            sceneDraftTextarea.value = result.scene_draft;
            alert('AI 장면 수정이 완료되었습니다. 내용을 확인하고 "변경사항 저장"을 눌러주세요.');
        } catch(error) {
            alert(`AI 장면 수정 실패: ${error.message}`);
            sceneDraftTextarea.value = originalValue; // 원래 값으로 복원
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    async handleAiEditPlotPoint(plotPoint, projectId, scenarioId) {
        const userPrompt = prompt("이 플롯의 '내용(요약)'을 어떻게 수정하고 싶으신가요?\n(예: '주인공이 더 극적으로 승리하는 장면으로 바꿔줘')");
        if (!userPrompt) return;

        const project = this.stateManager.getState().projects.find(p => p.id === projectId);
        const allCharacterIds = project.groups.flatMap(g => g.cards.map(c => c.id));
        
        try {
            const requestBody = {
                user_prompt: userPrompt,
                character_ids: allCharacterIds,
                model_name: document.getElementById('ai-model-select').value
            };
            await api.editPlotPointWithAi(projectId, scenarioId, plotPoint.id, requestBody);
            alert('AI가 플롯 요약을 성공적으로 수정했습니다.');
            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();
        } catch(error) {
            alert(`AI 수정 실패: ${error.message}`);
        }
    }

    async handleEnhanceSynopsis() {
        const synopsisTextarea = document.getElementById('scenario-synopsis');
        const originalSynopsis = synopsisTextarea.value.trim();
        const projectId = document.getElementById('project-title-display').dataset.currentProjectId;

        if (!originalSynopsis) {
            alert('먼저 구체화할 시놉시스를 입력해주세요.');
            return;
        }
        if (!projectId) {
            alert('현재 활성화된 프로젝트를 찾을 수 없습니다.');
            return;
        }

        const { projects } = this.stateManager.getState();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            alert('프로젝트 정보를 찾을 수 없습니다.');
            return;
        }

        this.openEnhanceSynopsisModal(originalSynopsis, project);
    }

    openEnhanceSynopsisModal(originalSynopsis, project) {
        const modal = document.getElementById('enhance-synopsis-modal');
        const backdrop = document.getElementById('modal-backdrop');
        
        document.getElementById('enhance-synopsis-original').textContent = originalSynopsis;
        document.getElementById('enhance-synopsis-suggestion').textContent = '결과가 여기에 표시됩니다...';
        
        this.renderSynopsisCharacterList(project);
        this.renderSynopsisWorldviewCardsList(project);
        
        modal.querySelectorAll('.synopsis-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('synopsis-user-prompt').value = btn.dataset.prompt;
            });
        });

        document.getElementById('enhance-synopsis-generate-btn').onclick = () => this.executeEnhanceSynopsis(originalSynopsis, project.id);
        document.getElementById('enhance-synopsis-accept-btn').onclick = () => this.applySynopsisEnhancement();
        document.getElementById('enhance-synopsis-reject-btn').onclick = () => this.closeSynopsisModal();
        
        modal.querySelector('.close').onclick = (e) => {
            e.preventDefault();
            this.closeSynopsisModal();
        };

        backdrop.style.display = 'block';
        modal.style.display = 'block';
    }

    renderSynopsisCharacterList(project) {
        const container = document.getElementById('synopsis-characters-container');
        
        if (!project.groups || project.groups.length === 0) {
            container.innerHTML = '<small>캐릭터가 없습니다.</small>';
            return;
        }

        let charactersHTML = '';
        project.groups.forEach(group => {
            if (group.cards && group.cards.length > 0) {
                const groupHTML = group.cards.map(card => `
                    <label>
                        <input type="checkbox" name="synopsis-character" value="${card.id}">
                        ${card.name}
                    </label>
                `).join('');
                charactersHTML += `<fieldset><legend>${group.name}</legend>${groupHTML}</fieldset>`;
            }
        });

        container.innerHTML = charactersHTML || '<small>캐릭터가 없습니다.</small>';
    }

    renderSynopsisWorldviewCardsList(project) {
        const container = document.getElementById('synopsis-worldview-cards-container');
        
        if (!project.worldview_groups || project.worldview_groups.length === 0) {
            container.innerHTML = '<small>서브 설정이 없습니다.</small>';
            return;
        }

        let cardsHTML = '';
        project.worldview_groups.forEach(group => {
            if (group.worldview_cards && group.worldview_cards.length > 0) {
                const groupHTML = group.worldview_cards.map(card => `
                    <label>
                        <input type="checkbox" name="synopsis-worldview-card" value="${card.id}">
                        ${card.title}
                    </label>
                `).join('');
                cardsHTML += `<fieldset><legend>${group.name}</legend>${groupHTML}</fieldset>`;
            }
        });

        container.innerHTML = cardsHTML || '<small>서브 설정이 없습니다.</small>';
    }

    async executeEnhanceSynopsis(originalSynopsis, projectId) {
        const userPrompt = document.getElementById('synopsis-user-prompt').value.trim();
        const generateBtn = document.getElementById('enhance-synopsis-generate-btn');
        const acceptBtn = document.getElementById('enhance-synopsis-accept-btn');
        const suggestionDiv = document.getElementById('enhance-synopsis-suggestion');

        if (!userPrompt) {
            alert('AI에게 요청할 내용을 입력해주세요.');
            return;
        }

        const selectedCharacterIds = Array.from(document.querySelectorAll('input[name="synopsis-character"]:checked')).map(cb => cb.value);
        const selectedWorldviewCardIds = Array.from(document.querySelectorAll('input[name="synopsis-worldview-card"]:checked')).map(cb => cb.value);

        generateBtn.setAttribute('aria-busy', 'true');
        generateBtn.disabled = true;
        suggestionDiv.textContent = '생성 중...';

        try {
            const requestBody = {
                existing_synopsis: originalSynopsis,
                user_prompt: userPrompt,
                project_id: projectId,
                model_name: document.getElementById('ai-model-select').value,
                selected_character_ids: selectedCharacterIds.length > 0 ? selectedCharacterIds : null,
                selected_worldview_card_ids: selectedWorldviewCardIds.length > 0 ? selectedWorldviewCardIds : null
            };

            const result = await api.enhanceSynopsis(requestBody);
            
            suggestionDiv.textContent = result.enhanced_synopsis;
            acceptBtn.style.display = 'inline-block';

        } catch (error) {
            console.error('시놉시스 구체화 실패:', error);
            suggestionDiv.textContent = `오류가 발생했습니다: ${error.message}`;
        } finally {
            generateBtn.setAttribute('aria-busy', 'false');
            generateBtn.disabled = false;
        }
    }

    applySynopsisEnhancement() {
        const enhancedSynopsis = document.getElementById('enhance-synopsis-suggestion').textContent;
        const synopsisTextarea = document.getElementById('scenario-synopsis');
        
        synopsisTextarea.value = enhancedSynopsis;
        alert('AI의 제안이 적용되었습니다! "시나리오 정보 저장" 버튼을 눌러 변경사항을 최종 저장하세요.');
        this.closeSynopsisModal();
    }

    closeSynopsisModal() {
        document.getElementById('enhance-synopsis-modal').style.display = 'none';
        document.getElementById('modal-backdrop').style.display = 'none';
        
        // 스피너 해제
        const generateBtn = document.getElementById('enhance-synopsis-generate-btn');
        if (generateBtn) {
            generateBtn.setAttribute('aria-busy', 'false');
            generateBtn.disabled = false;
        }
        
        document.getElementById('synopsis-user-prompt').value = '';
        document.querySelectorAll('input[name="synopsis-character"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="synopsis-worldview-card"]').forEach(cb => cb.checked = false);
        document.getElementById('enhance-synopsis-accept-btn').style.display = 'none';
    }

    openCharacterGenerationModal(projectId) {
        const config = {
            title: '✨ AI 캐릭터 생성',
            originalLabel: '참고할 정보',
            originalContent: '현재 프로젝트의 맥락을 바탕으로 새로운 캐릭터를 생성합니다.',
            presets: [
                { text: '🗡️ 전사 계열', prompt: '용맹하고 강인한 전사 타입의 캐릭터를 만들어줘' },
                { text: '🎭 지적인 캐릭터', prompt: '지혜롭고 신중한 지식인 타입의 캐릭터를 만들어줘' },
                { text: '🌟 특별한 능력', prompt: '독특하고 특별한 능력을 가진 캐릭터를 만들어줘' },
                { text: '😈 안타고니스트', prompt: '흥미로운 악역이나 라이벌 캐릭터를 만들어줘' },
                { text: '🤝 조력자', prompt: '주인공을 도와주는 믿음직한 조력자를 만들어줘' },
                { text: '🎲 랜덤 생성', prompt: '프로젝트 맥락에 맞는 흥미로운 캐릭터를 자유롭게 만들어줘' }
            ],
            placeholder: '어떤 캐릭터를 원하시는지 구체적으로 설명해주세요. 예: 몰락한 왕국의 마지막 기사',
            showCharacters: true,
            showWorldviewCards: true,
            showGroupSelection: true,
            projectId: projectId,
            onExecute: (selectedCharacterIds, selectedWorldviewCardIds, userPrompt) => 
                this.executeCharacterGeneration(projectId, selectedCharacterIds, selectedWorldviewCardIds, userPrompt),
            onApply: (result, selectedGroupId) => 
                this.applyCharacterGeneration(projectId, result, selectedGroupId)
        };

        commonAiModal.openCommonAiModal(config);
    }

    async executeCharacterGeneration(projectId, selectedCharacterIds, selectedWorldviewCardIds, userPrompt) {
        const { projects } = this.stateManager.getState();
        const project = projects.find(p => p.id === projectId);
        if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

        const requestBody = {
            keywords: userPrompt,
            character_ids: selectedCharacterIds.length > 0 ? selectedCharacterIds : null,
            worldview_context: project.worldview?.content || null,
            worldview_level: 'medium',
            model_name: document.getElementById('ai-model-select').value,
            worldview_card_ids: selectedWorldviewCardIds.length > 0 ? selectedWorldviewCardIds : null,
        };

        try {
            const result = await api.generateCharacter(projectId, requestBody);
            
            const formattedResult = this.formatCharacterForDisplay(result);
            return formattedResult;
            
        } catch (error) {
            console.error('캐릭터 생성 실패:', error);
            throw new Error(`캐릭터 생성에 실패했습니다: ${error.message}`);
        }
    }

    async applyCharacterGeneration(projectId, result, selectedGroupId) {
        try {
            const lastGeneratedCard = this.stateManager.getLastGeneratedCard();
            if (!lastGeneratedCard) {
                throw new Error('생성된 캐릭터 데이터를 찾을 수 없습니다.');
            }

            await api.saveCard(projectId, selectedGroupId, lastGeneratedCard);
            alert('캐릭터가 성공적으로 저장되었습니다!');
            await this.stateManager.refreshCurrentProject();
            
        } catch (error) {
            console.error('캐릭터 저장 실패:', error);
            throw new Error(`캐릭터 저장에 실패했습니다: ${error.message}`);
        }
    }

    formatCharacterForDisplay(characterData) {
        this.stateManager.setLastGeneratedCard(characterData);
        
        let formatted = `**${characterData.name}**\n\n`;
        formatted += `${characterData.description}\n\n`;
        
        if (characterData.personality && characterData.personality.length > 0) {
            formatted += `**성격:** ${Array.isArray(characterData.personality) ? characterData.personality.join(', ') : characterData.personality}\n\n`;
        }
        
        if (characterData.abilities && characterData.abilities.length > 0) {
            formatted += `**능력:** ${Array.isArray(characterData.abilities) ? characterData.abilities.join(', ') : characterData.abilities}\n\n`;
        }
        
        if (characterData.goal && characterData.goal.length > 0) {
            formatted += `**목표:** ${Array.isArray(characterData.goal) ? characterData.goal.join(', ') : characterData.goal}\n\n`;
        }
        
        if (characterData.quote && characterData.quote.length > 0) {
            formatted += `**대표 대사:**\n`;
            const quotes = Array.isArray(characterData.quote) ? characterData.quote : [characterData.quote];
            quotes.forEach(quote => formatted += `• "${quote}"\n`);
            formatted += '\n';
        }
        
        if (characterData.introduction_story) {
            formatted += `**등장 서사:**\n${characterData.introduction_story}`;
        }
        
        return formatted;
    }
}
