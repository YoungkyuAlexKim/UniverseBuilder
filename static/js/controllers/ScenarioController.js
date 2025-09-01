/**
 * 시나리오 및 플롯 관리 관련 컨트롤러
 * 시나리오 정보, 플롯 포인트, AI 기능들을 담당합니다.
 */
import * as api from '../modules/api.js';
import { showToast, showFieldValidation, validateFormBeforeSubmit, ValidationRules, ErrorHandlers } from '../components/validation/validation-utils.js';
import * as commonAiModal from '../modules/common-ai-modal.js';

export class ScenarioController {
    constructor(app) {
        this.app = app;
        this.stateManager = app.stateManager;
        this.eventManager = app.eventManager;
        this.modals = app.modals;
    }

    /**
     * 시나리오 정보를 저장합니다.
     */
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
            showToast('시나리오 정보가 성공적으로 저장되었습니다.', 'success');
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            ErrorHandlers.showError(error, '시나리오 저장 실패');
        } finally {
            const newButton = document.querySelector('#scenario-details-form button[type="submit"]');
            if (newButton) {
                newButton.setAttribute('aria-busy', 'false');
            }
        }
    }

    /**
     * 새 플롯 포인트를 생성합니다.
     */
    async handleCreatePlotPoint(event, projectId, scenarioId) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');

        const plotData = {
            title: form.elements.title.value,
            content: form.elements.content.value
        };

        if (!plotData.title) {
            const titleField = form.elements.title;
            showFieldValidation(titleField, '플롯 제목을 입력해주세요.', false);
            titleField.focus();
            return;
        }

        button.setAttribute('aria-busy', 'true');
        
        try {
            await api.createPlotPoint(projectId, scenarioId, plotData);
            showToast('플롯 포인트가 성공적으로 추가되었습니다.', 'success');
            form.reset();
            await this.stateManager.refreshCurrentProject();
        } catch (error) {
            ErrorHandlers.showError(error, '플롯 포인트 생성 실패');
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * AI를 이용해 시나리오 초안을 생성합니다.
     */
    async handleAiDraftGeneration(event, projectId, scenarioId) {
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const selectedCharacterIds = Array.from(form.querySelectorAll('input[name="character_ids"]:checked')).map(cb => cb.value);
        const plotPointCount = parseInt(form.elements.plot_point_count.value, 10);
        const styleGuideSelect = document.getElementById('draft-style-guide-select');

        if (selectedCharacterIds.length === 0) {
            showToast('주요 등장인물을 1명 이상 선택해주세요.', 'warning');
            return;
        }

        if (!plotPointCount || plotPointCount < 5 || plotPointCount > 50) {
            showToast('플롯 개수는 5에서 50 사이의 숫자여야 합니다.', 'warning');
            return;
        }

        button.setAttribute('aria-busy', 'true');
        
        try {
            const requestBody = {
                character_ids: selectedCharacterIds,
                plot_point_count: plotPointCount,
                model_name: document.getElementById('ai-model-select').value,
                style_guide_id: styleGuideSelect.value
            };

            await api.generateAiScenarioDraft(projectId, scenarioId, requestBody);
            showToast('AI가 새로운 스토리 초안을 성공적으로 생성했습니다!', 'success');

            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();

        } catch (error) {
            ErrorHandlers.showError(error, 'AI 시나리오 초안 생성 실패');
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * AI를 이용해 전체 플롯 포인트를 수정합니다.
     */
    async handleAiEditPlots() {
        const { currentProject } = this.stateManager.getState();

        if (!currentProject || !currentProject.scenarios || currentProject.scenarios.length === 0) {
            showToast('현재 활성화된 시나리오가 없습니다.', 'warning');
            return;
        }

        const mainScenario = currentProject.scenarios[0];
        if (!mainScenario.plot_points || mainScenario.plot_points.length === 0) {
            showToast('수정할 플롯이 없습니다. 먼저 AI로 초안을 생성해주세요.', 'info');
            return;
        }

        // [신규] AI 제한 사전 검증
        if (mainScenario.plot_points.length > 50) {
            this.showAiLimitGuidanceModal(mainScenario.plot_points.length);
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
            
            const onAccept = async (suggestedPlots, draftsToClear = []) => {
                const acceptBtn = document.getElementById('plot-points-diff-accept-btn');
                acceptBtn.setAttribute('aria-busy', 'true');
                
                try {
                    const updatePromises = suggestedPlots.map((plot, index) => {
                        const originalPlot = mainScenario.plot_points[index];
                        const plotData = {
                            title: plot.title,
                            content: plot.content,
                            scene_draft: draftsToClear.includes(originalPlot.id) ? null : originalPlot.scene_draft
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
     * AI 제한 안내 모달을 표시합니다.
     */
    showAiLimitGuidanceModal(plotCount) {
        const modal = document.getElementById('ai-limit-guidance-modal');
        const backdrop = document.getElementById('modal-backdrop');
        const currentPlotCountEl = document.getElementById('current-plot-count');

        // 플롯 개수 표시
        if (currentPlotCountEl) {
            currentPlotCountEl.textContent = plotCount;
        }

        // 모달 이벤트 핸들러
        const handleOrganizeManuscript = () => {
            closeModal();
            // 집필 탭으로 이동
            const manuscriptTab = document.querySelector('a[data-tab="manuscript"]');
            if (manuscriptTab) {
                manuscriptTab.click();
                showToast('집필 탭에서 플롯을 정리한 후 다시 시도해주세요.', 'info');
            }
        };

        const handlePartialEdit = () => {
            closeModal();
            this.enablePartialSelectionMode();
        };

        const handleCancel = () => {
            closeModal();
        };

        const closeModal = () => {
            modal.classList.remove('active');
            backdrop.classList.remove('active');
            // 이벤트 리스너 제거
            document.getElementById('solution-organize-manuscript').removeEventListener('click', handleOrganizeManuscript);
            document.getElementById('solution-partial-edit').removeEventListener('click', handlePartialEdit);
            document.getElementById('ai-limit-modal-cancel-btn').removeEventListener('click', handleCancel);
            modal.querySelector('.close').removeEventListener('click', handleCancel);
        };

        // 이벤트 리스너 설정
        document.getElementById('solution-organize-manuscript').addEventListener('click', handleOrganizeManuscript);
        document.getElementById('solution-partial-edit').addEventListener('click', handlePartialEdit);
        document.getElementById('ai-limit-modal-cancel-btn').addEventListener('click', handleCancel);
        modal.querySelector('.close').addEventListener('click', handleCancel);

        // 모달 표시
        modal.classList.add('active');
        backdrop.classList.add('active');
    }

    /**
     * 부분 선택 모드를 활성화합니다.
     */
    enablePartialSelectionMode() {
        // 체크박스 표시
        const checkboxes = document.querySelectorAll('.plot-select-checkbox');
        checkboxes.forEach(cb => cb.style.display = 'inline-block');

        // 선택 수정 버튼 표시
        const selectEditBtn = document.getElementById('ai-edit-selected-btn');
        if (selectEditBtn) {
            selectEditBtn.style.display = 'inline-block';
            selectEditBtn.addEventListener('click', () => this.handleAiEditSelectedPlots());
        }

        // 전체 수정 버튼 숨기기
        const fullEditBtn = document.getElementById('ai-edit-plots-btn');
        if (fullEditBtn) {
            fullEditBtn.style.display = 'none';
        }

        showToast('수정할 플롯을 선택해주세요. (최대 50개)', 'info');

        // 선택 취소 버튼 추가
        this.addCancelSelectionButton();

        // 체크박스 이벤트 리스너
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => this.updateSelectedCount());
        });
    }

    /**
     * 선택 취소 버튼을 추가합니다.
     */
    addCancelSelectionButton() {
        const buttonGroup = document.querySelector('.plot-buttons-group');
        if (!buttonGroup) return;

        // 기존 취소 버튼이 있으면 제거
        const existingCancelBtn = document.getElementById('cancel-selection-btn');
        if (existingCancelBtn) {
            existingCancelBtn.remove();
        }

        // 새 취소 버튼 추가
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-selection-btn';
        cancelBtn.className = 'secondary outline';
        cancelBtn.innerHTML = '<i data-lucide="x"></i>선택 취소';
        cancelBtn.style.marginLeft = 'auto';

        cancelBtn.addEventListener('click', () => this.cancelPartialSelectionMode());

        buttonGroup.appendChild(cancelBtn);

        // 아이콘 렌더링
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * 부분 선택 모드를 취소합니다.
     */
    cancelPartialSelectionMode() {
        // 체크박스 숨기기
        const checkboxes = document.querySelectorAll('.plot-select-checkbox');
        checkboxes.forEach(cb => {
            cb.style.display = 'none';
            cb.checked = false;
        });

        // 버튼 상태 복원
        const selectEditBtn = document.getElementById('ai-edit-selected-btn');
        const fullEditBtn = document.getElementById('ai-edit-plots-btn');

        if (selectEditBtn) {
            selectEditBtn.style.display = 'none';
        }
        if (fullEditBtn) {
            fullEditBtn.style.display = 'inline-block';
        }

        // 취소 버튼 제거
        const cancelBtn = document.getElementById('cancel-selection-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }

        showToast('선택 모드가 취소되었습니다.', 'info');
    }

    /**
     * 선택된 플롯 개수를 업데이트합니다.
     */
    updateSelectedCount() {
        const selectedCount = document.querySelectorAll('.plot-select-checkbox:checked').length;
        const selectEditBtn = document.getElementById('ai-edit-selected-btn');

        if (selectEditBtn) {
            if (selectedCount > 0 && selectedCount <= 50) {
                selectEditBtn.textContent = `선택한 플롯 수정 (${selectedCount}개)`;
                selectEditBtn.disabled = false;
            } else if (selectedCount > 50) {
                selectEditBtn.textContent = `너무 많이 선택됨 (${selectedCount}개)`;
                selectEditBtn.disabled = true;
            } else {
                selectEditBtn.textContent = '선택한 플롯 수정';
                selectEditBtn.disabled = true;
            }
        }
    }

    /**
     * 선택된 플롯들을 AI로 수정합니다.
     */
    async handleAiEditSelectedPlots() {
        const selectedCheckboxes = document.querySelectorAll('.plot-select-checkbox:checked');
        const selectedCount = selectedCheckboxes.length;

        if (selectedCount === 0) {
            showToast('수정할 플롯을 선택해주세요.', 'warning');
            return;
        }

        if (selectedCount > 50) {
            showToast('최대 50개까지 선택할 수 있습니다.', 'error');
            return;
        }

        const { currentProject } = this.stateManager.getState();
        const mainScenario = currentProject.scenarios[0];

        const userPrompt = prompt(`선택한 ${selectedCount}개의 플롯을 어떻게 수정하고 싶으신가요?\n\n예시:\n- 이 플롯들의 긴장감을 높여줘\n- 더 희망적인 결말로 바꿔줘\n- 캐릭터 관계를 더 명확히 해줘`);

        if (!userPrompt || !userPrompt.trim()) {
            return;
        }

        const button = document.getElementById('ai-edit-selected-btn');
        button.setAttribute('aria-busy', 'true');

        try {
            // 선택된 플롯 ID들 추출
            const selectedPlotIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.plotId);

            // 선택된 플롯들만 필터링
            const selectedPlots = mainScenario.plot_points.filter(plot => selectedPlotIds.includes(plot.id));

            // 임시로 선택된 플롯들로 시나리오 교체해서 API 호출
            const tempScenario = { ...mainScenario, plot_points: selectedPlots };

            const requestBody = {
                user_prompt: userPrompt,
                model_name: document.getElementById('ai-model-select').value,
                selected_plot_ids: selectedPlotIds
            };

            // API 호출 (선택된 플롯들만)
            const result = await api.editAllPlotPointsWithAi(currentProject.id, mainScenario.id, requestBody);

            // 선택된 플롯들의 순서에 맞게 결과 적용
            const updatePromises = selectedPlots.map((plot, index) => {
                const updatedPlot = result.plot_points[index];
                if (updatedPlot) {
                    const plotData = {
                        title: updatedPlot.title,
                        content: updatedPlot.content
                    };
                    return api.updatePlotPoint(currentProject.id, mainScenario.id, plot.id, plotData);
                }
            }).filter(Boolean);

            await Promise.all(updatePromises);

            showToast(`선택된 ${selectedCount}개 플롯이 성공적으로 수정되었습니다!`, 'success');

            // 선택 모드 자동 취소
            this.cancelPartialSelectionMode();

            // UI 새로고침
            await this.stateManager.refreshCurrentProject();

        } catch (error) {
            console.error('선택 플롯 수정 실패:', error);
            alert(`선택 플롯 수정 실패: ${error.message || '알 수 없는 오류'}`);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * 플롯 포인트를 수정합니다.
     */
    async handleUpdatePlotPoint(form, projectId, scenarioId) {
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
            showToast('플롯 포인트가 성공적으로 저장되었습니다.', 'success');
            this.modals.closeModal();
            await this.stateManager.refreshCurrentProject();
        } catch(error) {
            ErrorHandlers.showError(error, '플롯 포인트 저장 실패');
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * 플롯 포인트를 삭제합니다.
     */
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

    /**
     * 모든 플롯 포인트를 삭제합니다.
     */
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

    /**
     * AI를 이용해 장면을 생성합니다.
     */
    async handleAiSceneGeneration(plotPointId, projectId, scenarioId) {
        const button = document.getElementById('plot-point-ai-scene-btn');
        const formatSelect = document.getElementById('scene-format-select');
        const sceneDraftTextarea = document.getElementById('plot-point-scene-draft');
        const wordCountSlider = document.getElementById('word-count-slider');
        const styleGuideSelect = document.getElementById('style-guide-select');

        const selectedCharacterIds = Array.from(document.querySelectorAll('#plot-point-character-selection input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        const wordCountOptions = ['short', 'medium', 'long'];
        const wordCount = wordCountOptions[parseInt(wordCountSlider.value)];

        // [Phase 3+] 캐릭터별 선택된 관계 수집
        const selectedRelationshipIds = this.getSelectedCharacterRelations();

        const requestBody = {
            output_format: formatSelect.value,
            character_ids: selectedCharacterIds,
            model_name: document.getElementById('ai-model-select').value,
            word_count: wordCount,
            style_guide_id: styleGuideSelect.value,
            include_relationships: selectedRelationshipIds.length > 0, // [Phase 3+] 선택된 관계가 있으면 true
            relationship_ids: selectedRelationshipIds.length > 0 ? selectedRelationshipIds : null // [Phase 3+] 선택된 관계 ID들
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

    /**
     * [Phase 3+] 캐릭터별 선택된 관계들을 수집하여 반환
     */
    getSelectedCharacterRelations() {
        const selectedRelations = [];

        // 로컬 스토리지에서 모든 캐릭터의 선택된 관계 수집
        const keys = Object.keys(localStorage).filter(key => key.startsWith('selected_relations_'));

        keys.forEach(key => {
            const relations = localStorage.getItem(key);
            if (relations) {
                try {
                    const relationIds = JSON.parse(relations);
                    selectedRelations.push(...relationIds);
                } catch (error) {
                    console.error('관계 데이터 파싱 오류:', error);
                }
            }
        });

        // 중복 제거 후 반환
        return [...new Set(selectedRelations)];
    }



    /**
     * AI를 이용해 장면을 수정합니다.
     */
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
        const styleGuideSelect = document.getElementById('style-guide-select');

        const selectedCharacterIds = Array.from(document.querySelectorAll('#plot-point-character-selection input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        const wordCountOptions = ['short', 'medium', 'long'];
        const wordCount = wordCountOptions[parseInt(wordCountSlider.value)];

        const requestBody = {
            user_edit_request: userEditRequest,
            output_format: formatSelect.value,
            character_ids: selectedCharacterIds,
            model_name: document.getElementById('ai-model-select').value,
            word_count: wordCount,
            style_guide_id: styleGuideSelect.value
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
            sceneDraftTextarea.value = originalValue;
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    }

    /**
     * AI를 이용해 개별 플롯 포인트를 수정합니다.
     */
    async handleAiEditPlotPoint(plotPoint, projectId, scenarioId) {
        const config = {
            title: '✨ AI 플롯 요약 수정',
            originalLabel: '현재 플롯 내용',
            originalContent: plotPoint.content || '내용 없음',
            presets: [
                { text: '📝 더 구체적으로 묘사', prompt: '이 내용을 더 구체적이고 생생하게 묘사해줘.' },
                { text: '🔥 긴장감 고조', prompt: '이 부분의 긴장감을 더 높여줘.' },
                { text: '🤫 복선 추가', prompt: '다음 사건을 암시하는 복선을 자연스럽게 추가해줘.' }
            ],
            placeholder: '어떻게 수정하고 싶으신가요? (예: 주인공이 더 극적으로 승리하는 장면으로 바꿔줘)',
            showCharacters: true,
            showWorldviewCards: true,
            showGroupSelection: false,
            projectId: projectId,
            onExecute: async (characterIds, worldviewCardIds, userPrompt) => {
                const requestBody = {
                    user_prompt: userPrompt,
                    character_ids: characterIds,
                    // 참고: 현재 백엔드는 worldview_card_ids를 받지 않지만, 향후 확장을 위해 전달
                    model_name: document.getElementById('ai-model-select').value
                };
                // API는 수정된 플롯 객체를 반환해야 함
                return await api.editPlotPointWithAi(projectId, scenarioId, plotPoint.id, requestBody);
            },
            onApply: async (result) => {
                showToast('AI의 제안이 성공적으로 적용되었습니다!', 'success');
                await this.stateManager.refreshCurrentProject();
            }
        };
    
        commonAiModal.openCommonAiModal(config);
    }

    /**
     * AI를 이용해 컨셉을 다듬습니다.
     */
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

    /**
     * AI를 이용해 시놉시스를 구체화합니다.
     */
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

    /**
     * 시놉시스 구체화 모달을 엽니다.
     */
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

    /**
     * 시놉시스 모달에 캐릭터 목록을 렌더링합니다.
     */
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

    /**
     * 시놉시스 모달에 세계관 카드 목록을 렌더링합니다.
     */
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

    /**
     * 시놉시스 구체화를 실행합니다.
     */
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

    /**
     * 시놉시스 구체화 제안을 적용합니다.
     */
    applySynopsisEnhancement() {
        const enhancedSynopsis = document.getElementById('enhance-synopsis-suggestion').textContent;
        const synopsisTextarea = document.getElementById('scenario-synopsis');
        
        synopsisTextarea.value = enhancedSynopsis;
        alert('AI의 제안이 적용되었습니다! "시나리오 정보 저장" 버튼을 눌러 변경사항을 최종 저장하세요.');
        this.closeSynopsisModal();
    }

    /**
     * 시놉시스 모달을 닫습니다.
     */
    closeSynopsisModal() {
        document.getElementById('enhance-synopsis-modal').style.display = 'none';
        document.getElementById('modal-backdrop').style.display = 'none';
        
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
}
