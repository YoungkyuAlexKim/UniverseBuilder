/**
 * 캐릭터 및 그룹 관리 관련 컨트롤러
 * 캐릭터 그룹과 카드의 생성, 삭제, 드래그앤드롭 기능을 담당합니다.
 */
import * as api from '../modules/api.js';
import { showToast, showFieldValidation, ErrorHandlers } from '../components/validation/validation-utils.js';

export class CharacterController {
    constructor(app) {
        this.app = app;
        this.stateManager = app.stateManager;
        this.eventManager = app.eventManager;
    }

    /**
     * 새 캐릭터 그룹을 생성합니다.
     */
    async handleCreateGroup(event, projectId) {
        event.preventDefault();
        const form = event.currentTarget;
        const groupName = form.elements.name.value.trim();
        
                if (!groupName) {
            const nameField = form.elements.name;
            showFieldValidation(nameField, '그룹 이름을 입력해주세요.', false);
            nameField.focus();
            return;
        }
        
        form.querySelector('button').setAttribute('aria-busy', 'true');
        
        try {
            await this.stateManager.createGroup(projectId, groupName);
            showToast('그룹이 성공적으로 생성되었습니다.', 'success');
            form.reset();
        } catch (error) {
            ErrorHandlers.showError(error, '그룹 생성 실패');
        } finally {
            form.querySelector('button').setAttribute('aria-busy', 'false');
        }
    }

    /**
     * 캐릭터 그룹을 삭제합니다.
     */
    async handleDeleteGroup(projectId, groupId, groupName) {
        if (confirm(`정말로 '${groupName}' 그룹을 삭제하시겠습니까?\n모든 카드도 함께 삭제됩니다.`)) {
            try {
                await this.stateManager.deleteGroup(projectId, groupId);
                showToast('그룹이 삭제되었습니다.', 'success');
            } catch (error) {
                ErrorHandlers.showError(error, '그룹 삭제 실패');
            }
        }
    }

    /**
     * 캐릭터 카드를 삭제합니다.
     */
    async handleDeleteCard(projectId, groupId, cardId) {
        if (!confirm("정말로 이 카드를 삭제하시겠습니까?")) return;
        
        try {
            await this.stateManager.deleteCard(projectId, groupId, cardId);
            showToast('카드가 삭제되었습니다.', 'success');
        } catch (error) {
            ErrorHandlers.showError(error, '카드 삭제 실패');
        }
    }

    /**
     * 드래그앤드롭을 위한 Sortable 설정을 초기화합니다.
     */
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
}
