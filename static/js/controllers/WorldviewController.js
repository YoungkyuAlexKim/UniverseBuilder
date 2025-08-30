/**
 * 세계관 관리 관련 컨트롤러
 * 메인 세계관, 서브 설정 그룹, 세계관 카드의 관리를 담당합니다.
 */
import * as api from '../modules/api.js';

export class WorldviewController {
    constructor(app) {
        this.app = app;
        this.stateManager = app.stateManager;
        this.eventManager = app.eventManager;
        this.modals = app.modals;
    }

    /**
     * 메인 세계관 설정을 저장합니다.
     */
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

    /**
     * 새 세계관 그룹을 생성합니다.
     */
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

    /**
     * 세계관 그룹을 삭제합니다.
     */
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

    /**
     * 세계관 카드를 삭제합니다.
     */
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

    /**
     * AI를 이용해 세계관 설정을 다듬습니다.
     */
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
}
