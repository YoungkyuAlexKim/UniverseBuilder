/**
 * 중앙의 원고 제목, 내용 편집기, 저장 및 AI 수정 버튼 기능을 담당하는 컴포넌트입니다.
 */

export class EditorPanel {
    constructor(container, app) {
        this.container = container;
        this.app = app;
        this.eventManager = app.eventManager;
        this._currentBlockId = null;
        this._isInitialized = false;

        if (this.container) {
            this._setupEventListeners();
        } else {
            console.warn('EditorPanel: 컨테이너가 없습니다');
        }
    }

    /**
     * 편집기 패널을 렌더링합니다.
     * @param {Object} projectData - 프로젝트 데이터
     */
    render(projectData) {
        if (!this._isInitialized) {
            // 기존 HTML 구조를 사용하므로 별도 렌더링 필요 없음
            this._isInitialized = true;
        }

        // 초기 상태 설정 (에디터 비활성화)
        this._clearEditor();
    }

    /**
     * 이벤트 리스너를 설정합니다.
     * @private
     */
    _setupEventListeners() {
        // 이벤트 위임 사용
        this.container.addEventListener('click', (e) => {
            this._handleEditorClick(e);
        });

        this.container.addEventListener('input', (e) => {
            this._handleEditorInput(e);
        });

        // BlockList 컴포넌트로부터 블록 선택 이벤트 수신
        document.addEventListener('blockSelected', (e) => {
            this._handleBlockSelected(e.detail);
        });

        // 텍스트 선택 감지
        document.addEventListener('selectionchange', (e) => {
            this._handleSelectionChange(e);
        });
    }

    /**
     * 편집기 클릭 이벤트를 처리합니다.
     * @param {Event} e - 클릭 이벤트
     * @private
     */
    _handleEditorClick(e) {
        const target = e.target;
        const button = target.closest('button');

        if (!button) return;

        const buttonId = button.id;

        switch (buttonId) {
            case 'manuscript-save-btn':
                this._handleSave();
                break;

            case 'manuscript-ai-edit-btn':
                this._handleAiEdit();
                break;

            case 'manuscript-partial-refine-btn':
                this._handlePartialRefine();
                break;
        }
    }

    /**
     * 편집기 입력 이벤트를 처리합니다.
     * @param {Event} e - 입력 이벤트
     * @private
     */
    _handleEditorInput(e) {
        const target = e.target;

        if (target.id === 'manuscript-block-content') {
            this._updateStats();
        }
    }

    /**
     * 블록 선택 이벤트를 처리합니다.
     * @param {Object} detail - 이벤트 세부 정보
     * @private
     */
    _handleBlockSelected(detail) {
        const blockId = detail.blockId;
        this._loadBlockContent(blockId);
    }

    /**
     * 텍스트 선택 변경을 처리합니다.
     * @param {Event} e - 선택 변경 이벤트
     * @private
     */
    _handleSelectionChange(e) {
        const activeElement = document.activeElement;
        const contentTextarea = this.container.querySelector('#manuscript-block-content');

        if (activeElement === contentTextarea) {
            this._updatePartialRefineButtonState();
        }
    }

    /**
     * 블록 콘텐츠를 로드합니다.
     * @param {string} blockId - 블록 ID
     * @private
     */
    async _loadBlockContent(blockId) {
        try {
            const currentProject = this.app.stateManager.getState().currentProject;
            const block = currentProject?.manuscript_blocks?.find(b => b.id === blockId);

            if (!block) {
                console.error('블록을 찾을 수 없습니다:', blockId);
                return;
            }

            const titleInput = this.container.querySelector('#manuscript-block-title');
            const contentTextarea = this.container.querySelector('#manuscript-block-content');
            const saveButton = this.container.querySelector('#manuscript-save-btn');

            // 콘텐츠 설정
            titleInput.value = block.title || '';
            contentTextarea.value = block.content || '';
            contentTextarea.defaultValue = block.content || '';

            // 상태 업데이트
            titleInput.disabled = false;
            contentTextarea.disabled = false;
            saveButton.disabled = false;
            saveButton.setAttribute('data-current-block-id', blockId);

            this._currentBlockId = blockId;

            // 통계 업데이트
            this._updateStats();

            // AI 수정 버튼 활성화
            const aiEditButton = this.container.querySelector('#manuscript-ai-edit-btn');
            if (aiEditButton) {
                aiEditButton.disabled = false;
            }

            // 부분 다듬기 버튼 상태 업데이트
            this._updatePartialRefineButtonState();

        } catch (error) {
            console.error('블록 콘텐츠 로드 실패:', error);
        }
    }

    /**
     * 저장 버튼 클릭을 처리합니다.
     * @private
     */
    _handleSave() {
        if (!this._currentBlockId) {
            alert('저장할 블록이 선택되지 않았습니다.');
            return;
        }

        if (!this.app.manuscriptController || !this.app.manuscriptController.handleSaveManuscriptBlock) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        const currentProject = this.app.stateManager.getState().currentProject;
        if (!currentProject) {
            alert('프로젝트가 로드되지 않았습니다.');
            return;
        }

        this.app.manuscriptController.handleSaveManuscriptBlock(currentProject.id, this._currentBlockId);
    }

    /**
     * AI 수정 버튼 클릭을 처리합니다.
     * @private
     */
    _handleAiEdit() {
        if (!this.app.manuscriptController || !this.app.manuscriptController.openManuscriptAIModal) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        this.app.manuscriptController.openManuscriptAIModal();
    }

    /**
     * 부분 다듬기 버튼 클릭을 처리합니다.
     * @private
     */
    _handlePartialRefine() {
        const contentTextarea = this.container.querySelector('#manuscript-block-content');
        if (!contentTextarea) return;

        const { selectionStart, selectionEnd, value } = contentTextarea;
        const selectedText = value.substring(selectionStart, selectionEnd);

        if (!selectedText.trim()) {
            alert('다듬을 텍스트를 선택해주세요.');
            return;
        }

        // 주변 문맥 찾기 (간단한 방식: 앞뒤 100자)
        const precedingText = value.substring(Math.max(0, selectionStart - 100), selectionStart);
        const followingText = value.substring(selectionEnd, Math.min(value.length, selectionEnd + 100));
        const surroundingContext = `${precedingText}[...선택 부분...]${followingText}`;

        if (!this.app.manuscriptController || !this.app.manuscriptController.openPartialRefineModal) {
            console.error('ManuscriptController가 초기화되지 않았습니다.');
            return;
        }

        this.app.manuscriptController.openPartialRefineModal(selectedText, surroundingContext);
    }

    /**
     * 통계를 업데이트합니다.
     * @private
     */
    _updateStats() {
        const contentTextarea = this.container.querySelector('#manuscript-block-content');
        const charCountDisplay = this.container.querySelector('#char-count-display');
        const wordCountDisplay = this.container.querySelector('#word-count-display');

        if (!contentTextarea || !charCountDisplay || !wordCountDisplay) return;

        const content = contentTextarea.value;
        const charCount = content.length;
        const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;

        charCountDisplay.textContent = charCount;
        wordCountDisplay.textContent = wordCount;
    }

    /**
     * 부분 다듬기 버튼 상태를 업데이트합니다.
     * @private
     */
    _updatePartialRefineButtonState() {
        const contentTextarea = this.container.querySelector('#manuscript-block-content');
        const partialRefineButton = this.container.querySelector('#manuscript-partial-refine-btn');

        if (!contentTextarea || !partialRefineButton) return;

        const { selectionStart, selectionEnd } = contentTextarea;
        const hasSelection = selectionStart !== selectionEnd;

        partialRefineButton.disabled = !hasSelection;
    }

    /**
     * 편집기를 초기화합니다.
     * @private
     */
    _clearEditor() {
        const titleInput = this.container.querySelector('#manuscript-block-title');
        const contentTextarea = this.container.querySelector('#manuscript-block-content');
        const saveButton = this.container.querySelector('#manuscript-save-btn');
        const aiEditButton = this.container.querySelector('#manuscript-ai-edit-btn');
        const partialRefineButton = this.container.querySelector('#manuscript-partial-refine-btn');
        const charCountDisplay = this.container.querySelector('#char-count-display');
        const wordCountDisplay = this.container.querySelector('#word-count-display');

        // 값 초기화
        if (titleInput) {
            titleInput.value = '';
            titleInput.disabled = true;
        }

        if (contentTextarea) {
            contentTextarea.value = '';
            contentTextarea.disabled = true;
        }

        // 버튼 비활성화
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.removeAttribute('data-current-block-id');
        }

        if (aiEditButton) {
            aiEditButton.disabled = true;
        }

        if (partialRefineButton) {
            partialRefineButton.disabled = true;
        }

        // 통계 초기화
        if (charCountDisplay) charCountDisplay.textContent = '0';
        if (wordCountDisplay) wordCountDisplay.textContent = '0';

        this._currentBlockId = null;
    }

    /**
     * 컴포넌트를 정리합니다.
     */
    destroy() {
        // 컨테이너 초기화
        if (this.container) {
            this.container.innerHTML = '';
        }

        this._currentBlockId = null;
        this._isInitialized = false;
    }
}
