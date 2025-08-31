/**
 * 집필 관리 관련 컨트롤러
 * 원고 블록의 불러오기, 삭제, 저장, 순서 변경, AI 수정 기능을 담당합니다.
 */
import * as api from '../modules/api.js';
import * as modals from '../modules/modals.js';

export class ManuscriptController {
    constructor(app) {
        this.app = app;
        this.stateManager = app.stateManager;
        this.eventManager = app.eventManager;
        this.modals = app.modals;
    }

    /**
     * 시나리오 플롯을 집필 탭으로 불러옵니다.
     */
    async handleImportManuscript(projectId, scenarioId) {
        if (!confirm("정말로 시나리오 플롯을 불러오시겠습니까?\n현재 집필 탭에 작성된 모든 내용이 삭제되고, 시나리오의 플롯 포인트로 덮어씌워집니다.")) return;

        const button = document.getElementById('manuscript-import-btn');
        if (button) button.setAttribute('aria-busy', 'true');

        try {
            await api.importManuscriptFromScenario(projectId);
            alert('시나리오 플롯을 성공적으로 불러왔습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('플롯 불러오기 실패:', error);
            alert(error.message);
        } finally {
            const newButton = document.getElementById('manuscript-import-btn');
            if (newButton) newButton.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * 집필 탭의 모든 내용을 삭제합니다.
     */
    async handleClearManuscript(projectId) {
        if (!confirm("정말로 집필 탭의 모든 내용을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

        const button = document.getElementById('manuscript-clear-btn');
        if (button) button.setAttribute('aria-busy', 'true');

        try {
            await api.clearManuscriptBlocks(projectId);
            alert('모든 집필 내용이 삭제되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('전체 삭제 실패:', error);
            alert(error.message);
        } finally {
            const newButton = document.getElementById('manuscript-clear-btn');
            if (newButton) newButton.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * 원고 블록을 저장합니다.
     */
    async handleSaveManuscriptBlock(projectId, blockId) {
        const titleInput = document.getElementById('manuscript-block-title');
        const contentTextarea = document.getElementById('manuscript-block-content');
        const saveButton = document.getElementById('manuscript-save-btn');

        if (!blockId || !titleInput || !contentTextarea || !saveButton) return;

        saveButton.setAttribute('aria-busy', 'true');
        const updateData = {
            title: titleInput.value,
            content: contentTextarea.value
        };

        try {
            await api.updateManuscriptBlock(projectId, blockId, updateData);
            // 저장 성공 시 시각적 피드백
            saveButton.textContent = '저장 완료!';
            setTimeout(() => { saveButton.textContent = '저장'; }, 1500);

            await this.stateManager.refreshCurrentProject();

        } catch (error) {
            console.error('원고 블록 저장 실패:', error);
            alert(error.message);
        } finally {
            saveButton.setAttribute('aria-busy', 'false');
        }
    }
    
    /**
     * 원고 블록 순서를 업데이트합니다.
     */
    async handleUpdateManuscriptOrder(projectId, blockIds) {
        try {
            await api.updateManuscriptBlockOrder(projectId, blockIds);
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('원고 순서 변경 실패:', error);
            alert('원고 순서 변경에 실패했습니다. 페이지를 새로고침합니다.');
            window.location.reload();
        }
    }

    /**
     * 원고 AI 수정 모달을 엽니다.
     */
    openManuscriptAIModal() {
        const modal = document.getElementById('manuscript-ai-edit-modal');
        const backdrop = document.getElementById('modal-backdrop');
        const saveButton = document.getElementById('manuscript-save-btn');
        const currentBlockId = saveButton.getAttribute('data-current-block-id');

        if (!currentBlockId) {
            alert('먼저 수정할 원고 블록을 선택해주세요.');
            return;
        }

        const originalContentEl = document.getElementById('manuscript-ai-original');
        const suggestionEl = document.getElementById('manuscript-ai-suggestion');
        const promptEl = document.getElementById('manuscript-ai-user-prompt');
        const generateBtn = document.getElementById('manuscript-ai-generate-btn');
        const acceptBtn = document.getElementById('manuscript-ai-accept-btn');
        const rejectBtn = document.getElementById('manuscript-ai-reject-btn');
        
        // 모달 초기화
        originalContentEl.value = document.getElementById('manuscript-block-content').value;
        suggestionEl.value = '결과가 여기에 표시됩니다...';
        promptEl.value = '';
        acceptBtn.style.display = 'none';

        this.loadManuscriptModalContext();
        
        // 이벤트 리스너 설정
        generateBtn.onclick = () => this.executeManuscriptEdit(currentBlockId);
        acceptBtn.onclick = () => this.applyManuscriptEdit();
        rejectBtn.onclick = () => modals.closeModal();
        modal.querySelector('.close').onclick = (e) => { e.preventDefault(); modals.closeModal(); };

        modal.classList.add('active');
        backdrop.classList.add('active');
    }
    
    /**
     * 원고 AI 수정 모달에 컨텍스트 정보를 로드합니다.
     */
    loadManuscriptModalContext() {
        const { currentProject } = this.stateManager.getState();
        const charactersContainer = document.getElementById('manuscript-ai-characters-container');
        const worldviewContainer = document.getElementById('manuscript-ai-worldview-cards-container');

        // 캐릭터 목록 로드
        let charactersHTML = '';
        currentProject.groups.forEach(group => {
            if (group.cards && group.cards.length > 0) {
                charactersHTML += `<fieldset><legend>${group.name}</legend>`;
                charactersHTML += group.cards.map(card => `<label><input type="checkbox" name="ms-ai-char" value="${card.id}">${card.name}</label>`).join('');
                charactersHTML += `</fieldset>`;
            }
        });
        charactersContainer.innerHTML = charactersHTML || '<small>캐릭터가 없습니다.</small>';

        // 세계관 카드 목록 로드
        let worldviewHTML = '';
        currentProject.worldview_groups.forEach(group => {
            if (group.worldview_cards && group.worldview_cards.length > 0) {
                worldviewHTML += `<fieldset><legend>${group.name}</legend>`;
                worldviewHTML += group.worldview_cards.map(card => `<label><input type="checkbox" name="ms-ai-wv" value="${card.id}">${card.title}</label>`).join('');
                worldviewHTML += `</fieldset>`;
            }
        });
        worldviewContainer.innerHTML = worldviewHTML || '<small>서브 설정이 없습니다.</small>';
    }

    /**
     * 원고 AI 수정을 실행합니다.
     */
    async executeManuscriptEdit(blockId) {
        const promptEl = document.getElementById('manuscript-ai-user-prompt');
        const userPrompt = promptEl.value.trim();
        
        if (!userPrompt) {
            alert('AI에게 요청할 내용을 입력해주세요.');
            return;
        }

        const generateBtn = document.getElementById('manuscript-ai-generate-btn');
        const suggestionEl = document.getElementById('manuscript-ai-suggestion');
        const acceptBtn = document.getElementById('manuscript-ai-accept-btn');
        
        generateBtn.setAttribute('aria-busy', 'true');
        suggestionEl.value = "AI가 원고를 수정하고 있습니다...";

        try {
            const projectId = this.stateManager.getState().currentProject.id;
            const requestBody = {
                user_edit_request: userPrompt,
                style_guide_id: document.getElementById('manuscript-ai-style-guide').value,
                model_name: document.getElementById('ai-model-select').value,
                character_ids: Array.from(document.querySelectorAll('input[name="ms-ai-char"]:checked')).map(cb => cb.value),
                worldview_card_ids: Array.from(document.querySelectorAll('input[name="ms-ai-wv"]:checked')).map(cb => cb.value),
            };

            const result = await api.editManuscriptBlockWithAi(projectId, blockId, requestBody);
            suggestionEl.value = result.edited_content;
            acceptBtn.style.display = 'inline-block';

        } catch (error) {
            suggestionEl.value = `오류 발생: ${error.message}`;
        } finally {
            generateBtn.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * AI 수정 제안을 적용합니다.
     */
    applyManuscriptEdit() {
        const suggestion = document.getElementById('manuscript-ai-suggestion').value;
        const mainEditor = document.getElementById('manuscript-block-content');
        mainEditor.value = suggestion;
        
        // 변경된 내용을 저장
        const projectId = this.stateManager.getState().currentProject.id;
        const blockId = document.getElementById('manuscript-save-btn').getAttribute('data-current-block-id');
        this.handleSaveManuscriptBlock(projectId, blockId);

        modals.closeModal();
        alert('AI의 제안이 적용 및 저장되었습니다.');
    }
    
    /**
     * 부분 AI 수정 모달을 엽니다.
     */
    /**
     * 선택된 블록들을 합칩니다.
     */
    async handleMergeManuscriptBlocks(projectId, blockIds) {
        if (blockIds.length < 2) {
            alert('합칠 블록을 2개 이상 선택해주세요.');
            return;
        }

        const newTitle = prompt('합쳐진 블록의 제목을 입력하세요:', '');
        if (newTitle === null) return; // 취소

        try {
            await api.mergeManuscriptBlocks(projectId, {
                block_ids: blockIds,
                new_title: newTitle || undefined
            });
            alert('블록들이 성공적으로 합쳐졌습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('블록 합치기 실패:', error);
            alert(error.message);
        }
    }

    /**
     * 선택된 블록을 분할합니다.
     */
    async handleSplitManuscriptBlock(projectId, blockId, splitPosition) {
        if (!blockId) {
            alert('분할할 블록을 선택해주세요.');
            return;
        }

        const firstPartTitle = prompt('첫 번째 부분의 제목을 입력하세요:', '');
        if (firstPartTitle === null) return; // 취소

        const secondPartTitle = prompt('두 번째 부분의 제목을 입력하세요:', '');
        if (secondPartTitle === null) return; // 취소

        try {
            const requestBody = {
                split_position: splitPosition
            };

            if (firstPartTitle && firstPartTitle.trim()) {
                requestBody.first_part_title = firstPartTitle.trim();
            }

            if (secondPartTitle && secondPartTitle.trim()) {
                requestBody.second_part_title = secondPartTitle.trim();
            }

            console.log('Split request:', { blockId, splitPosition, firstPartTitle, secondPartTitle, requestBody });

            await api.splitManuscriptBlock(projectId, blockId, requestBody);
            alert('블록이 성공적으로 분할되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('블록 분할 실패:', error);
            console.error('Error details:', error.response || error);
            alert(`블록 분할 실패: ${error.message || '알 수 없는 오류'}`);
        }
    }

    /**
     * 선택된 블록을 삭제합니다.
     */
    async handleDeleteManuscriptBlock(projectId, blockId) {
        if (!confirm('정말로 이 블록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        try {
            await api.deleteManuscriptBlock(projectId, blockId);
            alert('블록이 성공적으로 삭제되었습니다.');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('블록 삭제 실패:', error);
            alert(error.message);
        }
    }

    /**
     * 집필 탭의 블록들을 시나리오 탭으로 내보냅니다.
     */
    async handleExportToScenario(projectId) {
        try {
            const requestBody = {};

            // 현재 집필 블록 수 확인
            const currentProject = this.stateManager.getState().currentProject;
            const blockCount = currentProject?.manuscript_blocks?.length || 0;

            // AI 제한 경고
            if (blockCount > 50) {
                const confirmed = confirm(
                    `현재 집필 블록이 ${blockCount}개로, AI 권장 제한(50개)을 초과했습니다.\n\n` +
                    `이대로 내보내면:\n` +
                    `- AI 전체 플롯 수정 기능 사용이 제한될 수 있습니다\n` +
                    `- AI 초안 생성 시 50개로 제한됩니다\n\n` +
                    `계속 진행하시겠습니까?`
                );
                if (!confirmed) return;

                requestBody.max_plots = blockCount;
            }

            // 시나리오 탭의 기존 플롯 수 확인 및 확인 요청
            try {
                const scenario = currentProject.scenarios?.[0]; // 첫 번째 시나리오
                if (scenario && scenario.plot_points) {
                    const existingPlotCount = scenario.plot_points.length;

                    if (existingPlotCount > 0) {
                        const confirmOverwrite = confirm(
                            `⚠️ 시나리오 탭에 이미 ${existingPlotCount}개의 플롯이 있습니다.\n\n` +
                            `내보내기를 진행하면 기존 플롯들이 모두 삭제되고,\n` +
                            `집필 블록 ${blockCount}개로 교체됩니다.\n\n` +
                            `정말 진행하시겠습니까?`
                        );
                        if (!confirmOverwrite) return;

                        requestBody.confirm_overwrite = true;
                    }
                }
            } catch (error) {
                console.warn('시나리오 플롯 수 확인 실패:', error);
                // 기존 플롯 확인에 실패해도 계속 진행 (안전하게)
            }

            const result = await api.exportManuscriptToScenario(projectId, requestBody);

            let successMessage = `집필 블록 ${blockCount}개가 시나리오 탭으로 내보내기 완료되었습니다!`;
            if (blockCount > 50) {
                successMessage += `\n\n⚠️ AI 제한 고려: 초과된 ${blockCount - 50}개 블록은 AI 기능에서 제한될 수 있습니다.`;
            }

            alert(successMessage);
            await this.stateManager.refreshCurrentProject();

        } catch (error) {
            console.error('시나리오 내보내기 실패:', error);

            // 백엔드에서 덮어쓰기 확인이 필요한 경우
            if (error.message && error.message.includes('덮어쓰기를 진행하려면 확인이 필요합니다')) {
                const confirmOverwrite = confirm(
                    '시나리오 탭에 기존 플롯이 있어 덮어쓰기 확인이 필요합니다.\n\n' +
                    '정말 기존 플롯을 모두 삭제하고 내보내시겠습니까?'
                );

                if (confirmOverwrite) {
                    // 확인과 함께 재시도
                    const requestBody = { confirm_overwrite: true };
                    try {
                        await api.exportManuscriptToScenario(projectId, requestBody);
                        alert('집필 블록들이 시나리오 탭으로 내보내기 완료되었습니다!');
                        await this.stateManager.refreshCurrentProject();
                    } catch (retryError) {
                        alert(`재시도 실패: ${retryError.message || '알 수 없는 오류'}`);
                    }
                }
                return;
            }

            alert(`시나리오 내보내기 실패: ${error.message || '알 수 없는 오류'}`);
        }
    }

    /**
     * 캐릭터 추출을 실행합니다.
     */
    async extractCharactersFromBlock(blockId, textContent) {
        const charactersList = document.getElementById('related-characters-list');
        const updateBtn = document.getElementById('update-characters-btn');

        // 로딩 상태 표시
        charactersList.innerHTML = `
            <div class="character-loading">
                <small>캐릭터 정보를 분석하는 중...</small>
            </div>
        `;

        if (updateBtn) {
            updateBtn.setAttribute('aria-busy', 'true');
        }

        try {
            const projectId = this.stateManager.getState().currentProject.id;
            const result = await api.extractCharactersFromManuscript(projectId, blockId, { text_content: textContent });

            // 결과 표시
            this.displayCharacterResults(result.characters, result.unidentified_entities);

        } catch (error) {
            console.error('캐릭터 추출 실패:', error);
            charactersList.innerHTML = `
                <div class="character-loading">
                    <small style="color: var(--pico-form-element-invalid-active-border-color);">
                        캐릭터 분석 중 오류가 발생했습니다.
                    </small>
                </div>
            `;
        } finally {
            if (updateBtn) {
                updateBtn.setAttribute('aria-busy', 'false');
            }
        }
    }

    /**
     * 캐릭터 추출 결과를 화면에 표시합니다.
     */
    displayCharacterResults(characters, unidentifiedEntities) {
        const charactersList = document.getElementById('related-characters-list');

        if (!characters || characters.length === 0) {
            charactersList.innerHTML = `
                <div class="character-loading">
                    <small>이 텍스트에서 특정 캐릭터를 찾을 수 없습니다.</small>
                </div>
            `;
            return;
        }

        const characterItems = characters.map(character => {
            const confidencePercent = Math.round(character.confidence * 100);
            const avatarLetter = character.name.charAt(0).toUpperCase();

            return `
                <div class="character-item">
                    <div class="character-avatar">${avatarLetter}</div>
                    <div class="character-info">
                        <div class="character-name">${character.name}</div>
                        <span class="character-role">${this.getRoleDisplayText(character.role)}</span>
                    </div>
                    <div class="character-confidence">${confidencePercent}%</div>
                </div>
            `;
        }).join('');

        // 미확인 개체들도 표시 (있는 경우)
        let unidentifiedItems = '';
        if (unidentifiedEntities && unidentifiedEntities.length > 0) {
            unidentifiedItems = unidentifiedEntities.map(entity => `
                <div class="character-item" style="opacity: 0.7;">
                    <div class="character-avatar" style="background: var(--pico-muted-border-color);">?</div>
                    <div class="character-info">
                        <div class="character-name">${entity.name}</div>
                        <span class="character-role">미확인</span>
                    </div>
                    <div class="character-confidence">?</div>
                </div>
            `).join('');
        }

        charactersList.innerHTML = characterItems + unidentifiedItems;
    }

    /**
     * 역할 텍스트를 한글로 변환합니다.
     */
    getRoleDisplayText(role) {
        const roleMap = {
            '주인공': '주인공',
            'main': '주인공',
            '조연': '조연',
            'supporting': '조연',
            '단역': '단역',
            'minor': '단역'
        };
        return roleMap[role] || role;
    }

    openPartialRefineModal(selectedText, surroundingContext) {
        const modal = document.getElementById('partial-refine-modal');
        const backdrop = document.getElementById('modal-backdrop');
        const suggestionsContainer = document.getElementById('partial-refine-suggestions-container');
        const generateBtn = document.getElementById('partial-refine-generate-btn');
        const cancelBtn = document.getElementById('partial-refine-cancel-btn');
        const userPromptInput = document.getElementById('partial-refine-user-prompt');
        const styleGuideSelect = document.getElementById('partial-refine-style-guide');
        const contentTextarea = document.getElementById('manuscript-block-content');
        const { selectionStart, selectionEnd } = contentTextarea;

        // 모달 초기화
        userPromptInput.value = '';
        styleGuideSelect.value = '';
        suggestionsContainer.innerHTML = '<p>AI 제안을 생성하려면 아래 \'AI 제안 생성\' 버튼을 누르세요.</p>';

        const executeRefine = async () => {
            generateBtn.setAttribute('aria-busy', 'true');
            suggestionsContainer.innerHTML = '<p aria-busy="true">AI 제안을 생성 중입니다...</p>';

            try {
                const projectId = this.stateManager.getState().currentProject.id;
                const blockId = document.getElementById('manuscript-save-btn').getAttribute('data-current-block-id');
                
                const requestBody = {
                    selected_text: selectedText,
                    surrounding_context: surroundingContext,
                    user_prompt: userPromptInput.value.trim(),
                    style_guide_id: styleGuideSelect.value,
                    model_name: document.getElementById('ai-model-select').value
                };

                const result = await api.refinePartialManuscript(projectId, blockId, requestBody);
                
                if (result.suggestions && result.suggestions.length > 0) {
                    suggestionsContainer.innerHTML = result.suggestions.map((suggestion, index) => `
                        <article class="suggestion-card" data-suggestion="${suggestion}" style="cursor: pointer; margin-bottom: 0.5rem;">
                            <p>${suggestion}</p>
                        </article>
                    `).join('');
                } else {
                    suggestionsContainer.innerHTML = '<p>AI가 제안을 생성하지 못했습니다. 다시 시도해주세요.</p>';
                }

            } catch (error) {
                suggestionsContainer.innerHTML = `<p style="color: var(--pico-form-element-invalid-active-border-color);">오류: ${error.message}</p>`;
            } finally {
                generateBtn.setAttribute('aria-busy', 'false');
            }
        };

        // 제안 카드 클릭 이벤트 (이벤트 위임 사용)
        const suggestionClickHandler = (e) => {
            const card = e.target.closest('.suggestion-card');
            if (card) {
                const suggestionText = card.dataset.suggestion;
                
                // 텍스트 교체
                const originalText = contentTextarea.value;
                const newText = originalText.substring(0, selectionStart) + suggestionText + originalText.substring(selectionEnd);
                contentTextarea.value = newText;
                
                // 변경사항 즉시 저장
                const projectId = this.stateManager.getState().currentProject.id;
                const blockId = document.getElementById('manuscript-save-btn').getAttribute('data-current-block-id');
                this.handleSaveManuscriptBlock(projectId, blockId);

                closeModal();
            }
        };
        suggestionsContainer.addEventListener('click', suggestionClickHandler);

        const closeModal = () => {
            modal.classList.remove('active');
            backdrop.classList.remove('active');
            // 이벤트 리스너 정리
            suggestionsContainer.removeEventListener('click', suggestionClickHandler);
            generateBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        
        generateBtn.onclick = executeRefine;
        cancelBtn.onclick = closeModal;
        modal.querySelector('.close').onclick = (e) => { e.preventDefault(); closeModal(); };

        modal.classList.add('active');
        backdrop.classList.add('active');
    }
}
