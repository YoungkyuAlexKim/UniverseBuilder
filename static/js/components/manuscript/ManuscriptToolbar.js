/**
 * 집필 탭의 상단 툴바 기능을 담당하는 컴포넌트입니다.
 * 불러오기, 내보내기, 전체 삭제, 합치기, 분할 등 상단 툴바 기능 담당.
 */

export class ManuscriptToolbar {
    constructor(container, app) {
        this.container = container;
        this.app = app;
        this.eventManager = app.eventManager;
        this._isInitialized = false;

        this._setupEventListeners();
    }

    /**
     * 툴바를 렌더링합니다.
     * @param {Object} projectData - 프로젝트 데이터
     */
    render(projectData) {
        if (!this._isInitialized) {
            // 기존 HTML 구조를 사용하므로 별도 렌더링 필요 없음
            this._isInitialized = true;
        }

        this._updateButtonStates(projectData);
    }

    /**
     * 툴바 HTML을 렌더링합니다.
     * @private
     */


    /**
     * 이벤트 리스너를 설정합니다.
     * @private
     */
    _setupEventListeners() {
        // 이벤트 위임 사용
        this.container.addEventListener('click', (e) => {
            this._handleToolbarClick(e);
        });

        // BlockList 컴포넌트로부터의 이벤트 수신
        document.addEventListener('selectionChanged', (e) => {
            this._handleSelectionChanged(e.detail);
        });
    }

    /**
     * 툴바 클릭 이벤트를 처리합니다.
     * @param {Event} e - 클릭 이벤트
     * @private
     */
    _handleToolbarClick(e) {
        const target = e.target;
        const button = target.closest('button');

        if (!button) return;

        const buttonId = button.id;

        switch (buttonId) {
            case 'manuscript-import-btn':
                this._handleImport();
                break;

            case 'manuscript-export-btn':
                this._handleExport();
                break;

            case 'manuscript-clear-btn':
                this._handleClear();
                break;

            case 'manuscript-merge-btn':
                this._handleMerge();
                break;

            case 'manuscript-split-btn':
                this._handleSplit();
                break;
        }
    }

    /**
     * 불러오기 버튼 클릭을 처리합니다.
     * @private
     */
    _handleImport() {
        if (!this.app.manuscriptController || !this.app.manuscriptController.handleImportManuscript) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        const currentProject = this.app.stateManager.getState().currentProject;
        if (!currentProject) {
            alert('프로젝트가 로드되지 않았습니다.');
            return;
        }

        const mainScenario = currentProject.scenarios && currentProject.scenarios[0];
        this.app.manuscriptController.handleImportManuscript(currentProject.id, mainScenario?.id);
    }

    /**
     * 내보내기 버튼 클릭을 처리합니다.
     * @private
     */
    _handleExport() {
        if (!this.app.manuscriptController || !this.app.manuscriptController.handleExportToScenario) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        const currentProject = this.app.stateManager.getState().currentProject;
        if (!currentProject) {
            alert('프로젝트가 로드되지 않았습니다.');
            return;
        }

        this.app.manuscriptController.handleExportToScenario(currentProject.id);
    }

    /**
     * 전체 삭제 버튼 클릭을 처리합니다.
     * @private
     */
    _handleClear() {
        if (!this.app.manuscriptController || !this.app.manuscriptController.handleClearManuscript) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        const currentProject = this.app.stateManager.getState().currentProject;
        if (!currentProject) {
            alert('프로젝트가 로드되지 않았습니다.');
            return;
        }

        this.app.manuscriptController.handleClearManuscript(currentProject.id);
    }

    /**
     * 합치기 버튼 클릭을 처리합니다.
     * @private
     */
    _handleMerge() {
        if (!this.app.manuscriptController || !this.app.manuscriptController.handleMergeManuscriptBlocks) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        const currentProject = this.app.stateManager.getState().currentProject;
        if (!currentProject) {
            alert('프로젝트가 로드되지 않았습니다.');
            return;
        }

        // 선택된 블록 ID들을 수집
        const selectedBlockIds = this._getSelectedBlockIds();

        if (selectedBlockIds.length < 2) {
            alert('합칠 블록을 2개 이상 선택해주세요.');
            return;
        }

        this.app.manuscriptController.handleMergeManuscriptBlocks(currentProject.id, selectedBlockIds);
    }

    /**
     * 분할 버튼 클릭을 처리합니다.
     * @private
     */
    _handleSplit() {
        if (!this.app.manuscriptController || !this.app.manuscriptController.handleSplitManuscriptBlock) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        const currentProject = this.app.stateManager.getState().currentProject;
        if (!currentProject) {
            alert('프로젝트가 로드되지 않았습니다.');
            return;
        }

        // 현재 선택된 블록 ID를 가져옴
        const currentBlockId = this._getCurrentBlockId();

        if (!currentBlockId) {
            alert('분할할 블록을 먼저 선택해주세요.');
            return;
        }

        // EditorPanel로부터 커서 위치 정보를 가져옴
        const editorPanel = document.querySelector('.manuscript-editor-container');
        if (!editorPanel) {
            alert('편집기를 찾을 수 없습니다.');
            return;
        }

        // 커서 위치나 선택된 텍스트의 중간 위치 계산
        const contentTextarea = editorPanel.querySelector('#manuscript-block-content');
        if (!contentTextarea) {
            alert('편집기 콘텐츠를 찾을 수 없습니다.');
            return;
        }

        const { selectionStart, selectionEnd, value } = contentTextarea;

        if (!value || value.trim().length === 0) {
            alert('분할할 내용이 없습니다.');
            return;
        }

        // 커서 위치 또는 선택된 텍스트의 중간 위치 사용
        let splitPosition = selectionStart;
        if (selectionStart === selectionEnd) {
            // 텍스트가 선택되지 않은 경우, 커서 위치 사용
            if (selectionStart === 0) {
                splitPosition = Math.floor(value.length / 2); // 중간 지점
            }
        } else {
            // 텍스트가 선택된 경우, 선택 영역의 중간 사용
            splitPosition = Math.floor((selectionStart + selectionEnd) / 2);
        }

        if (splitPosition > 0 && splitPosition < value.length) {
            this.app.manuscriptController.handleSplitManuscriptBlock(currentProject.id, currentBlockId, splitPosition);
        } else {
            alert('분할할 수 있는 위치를 찾을 수 없습니다.');
        }
    }

    /**
     * 선택된 블록 ID들을 가져옵니다.
     * @returns {Array<string>} 선택된 블록 ID 배열
     * @private
     */
    _getSelectedBlockIds() {
        const checkboxes = document.querySelectorAll('.block-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.dataset.blockId);
    }

    /**
     * 현재 선택된 블록 ID를 가져옵니다.
     * @returns {string|null} 현재 블록 ID
     * @private
     */
    _getCurrentBlockId() {
        const saveButton = document.getElementById('manuscript-save-btn');
        return saveButton ? saveButton.getAttribute('data-current-block-id') : null;
    }

    /**
     * 선택 변경 이벤트를 처리합니다.
     * @param {Object} detail - 이벤트 세부 정보
     * @private
     */
    _handleSelectionChanged(detail) {
        const mergeButton = this.container.querySelector('#manuscript-merge-btn');
        if (mergeButton) {
            mergeButton.disabled = !detail.hasMultipleSelection;
        }
    }

    /**
     * 블록 선택 변경에 따라 버튼 상태를 업데이트합니다.
     * @param {string|null} currentBlockId - 현재 선택된 블록 ID
     * @private
     */
    _updateSplitButtonState(currentBlockId) {
        const splitButton = this.container.querySelector('#manuscript-split-btn');
        if (splitButton) {
            splitButton.disabled = !currentBlockId;
        }
    }

    /**
     * 버튼 상태들을 업데이트합니다.
     * @param {Object} projectData - 프로젝트 데이터
     * @private
     */
    _updateButtonStates(projectData) {
        // 현재 블록 ID 확인
        const currentBlockId = this._getCurrentBlockId();
        this._updateSplitButtonState(currentBlockId);

        // 선택된 블록 수 확인
        const selectedBlockIds = this._getSelectedBlockIds();
        const mergeButton = this.container.querySelector('#manuscript-merge-btn');
        if (mergeButton) {
            mergeButton.disabled = selectedBlockIds.length < 2;
        }
    }

    /**
     * 컴포넌트를 정리합니다.
     */
    destroy() {
        // 컨테이너 초기화
        if (this.container) {
            this.container.innerHTML = '';
        }

        this._isInitialized = false;
    }
}
