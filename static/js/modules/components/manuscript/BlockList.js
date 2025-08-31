/**
 * 원고 블록 목록을 렌더링하고, 각 블록의 선택, 드래그앤드롭, 드롭다운 메뉴 이벤트를 처리합니다.
 * Sortable.js 초기화 로직도 이 컴포넌트가 담당합니다.
 */

export class BlockList {
    constructor(container, app) {
        this.container = container;
        this.app = app;
        this.eventManager = app.eventManager;
        this._sortableInstance = null;
        this._isInitialized = false;

        if (this.container) {
            this._setupEventListeners();
        } else {
            console.warn('BlockList: 컨테이너가 없습니다');
        }
    }

    /**
     * 블록 목록을 렌더링합니다.
     * @param {Array} blocks - 원고 블록 배열
     */
    render(blocks) {
        if (!this._isInitialized) {
            this._initializeSortable();
            this._isInitialized = true;
        }

        // 기존 블록 리스트를 찾아서 업데이트
        const blockList = this.container.querySelector('#manuscript-block-list');

        if (blockList) {
            const html = blocks.length > 0
                ? blocks.map(block => this._createBlockItemHTML(block)).join('')
                : '<li class="empty-message">작업할 내용이 없습니다. \'불러오기\'를 눌러 시작하세요.</li>';

            blockList.innerHTML = html;

            // Sortable 재초기화
            this._initializeSortable();
        } else {
            console.error('BlockList: #manuscript-block-list 요소를 찾을 수 없습니다');
        }

        // Lucide 아이콘 생성
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    /**
     * 개별 블록 아이템의 HTML을 생성합니다.
     * @param {Object} block - 블록 데이터
     * @returns {string} HTML 문자열
     * @private
     */
    _createBlockItemHTML(block) {
        return `
            <li class="block-item" data-block-id="${block.id}">
                <div class="block-item-content">
                    <input type="checkbox" class="block-checkbox" data-block-id="${block.id}">
                    <span class="block-title">
                        <i data-lucide="file-text"></i>
                        ${block.ordering + 1}. ${block.title || '제목 없음'}
                    </span>
                    <button class="block-action-btn" data-block-id="${block.id}" title="추가 액션">
                        ⋮
                    </button>
                </div>

                <!-- 드롭다운 메뉴 -->
                <div class="block-dropdown" data-block-id="${block.id}" style="display: none;">
                    <button class="dropdown-item import-from-scenario" data-action="import" data-block-id="${block.id}">
                        <i data-lucide="download"></i>
                        <span>시나리오에서 불러오기</span>
                    </button>
                    <button class="dropdown-item export-to-scenario" data-action="export" data-block-id="${block.id}">
                        <i data-lucide="upload"></i>
                        <span>시나리오로 내보내기</span>
                    </button>
                    <button class="dropdown-item delete-block" data-action="delete" data-block-id="${block.id}">
                        <i data-lucide="trash-2"></i>
                        <span>블록 삭제</span>
                    </button>
                </div>
            </li>
        `;
    }

    /**
     * 이벤트 리스너를 설정합니다.
     * @private
     */
    _setupEventListeners() {
        // 이벤트 위임 사용: 컨테이너에 한 번만 이벤트 리스너 등록
        this.container.addEventListener('click', (e) => {
            this._handleContainerClick(e);
        });

        // 드롭다운 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.block-action-btn') && !e.target.closest('.block-dropdown')) {
                this._closeAllDropdowns();
            }
        });
    }

    /**
     * 컨테이너 클릭 이벤트를 처리합니다.
     * @param {Event} e - 클릭 이벤트
     * @private
     */
    _handleContainerClick(e) {
        const target = e.target;

        // 체크박스 클릭
        if (target.type === 'checkbox' && target.classList.contains('block-checkbox')) {
            this._handleCheckboxChange(target);
            return;
        }

        // 블록 제목 클릭 (선택)
        if (target.closest('.block-title') && !target.closest('.block-action-btn')) {
            const blockItem = target.closest('.block-item');
            if (blockItem) {
                this._handleBlockSelection(blockItem);
            }
            return;
        }

        // 액션 버튼 클릭
        if (target.closest('.block-action-btn')) {
            const button = target.closest('.block-action-btn');
            this._handleActionButtonClick(button, e);
            return;
        }

        // 드롭다운 아이템 클릭
        if (target.closest('.dropdown-item')) {
            const item = target.closest('.dropdown-item');
            this._handleDropdownItemClick(item, e);
            return;
        }
    }

    /**
     * 체크박스 상태 변경을 처리합니다.
     * @param {HTMLInputElement} checkbox - 체크박스 요소
     * @private
     */
    _handleCheckboxChange(checkbox) {
        this._updateMergeButtonState();
        // 추가 로직이 필요하다면 여기서 처리
    }

    /**
     * 블록 선택을 처리합니다.
     * @param {HTMLElement} blockItem - 블록 아이템 요소
     * @private
     */
    _handleBlockSelection(blockItem) {
        // 다른 블록들의 선택 해제
        this.container.querySelectorAll('.block-item').forEach(item => {
            item.classList.remove('selected');
        });

        // 현재 블록 선택
        blockItem.classList.add('selected');

        const blockId = blockItem.dataset.blockId;

        // ManuscriptController를 통해 블록 선택 이벤트 발생
        if (this.app.manuscriptController && this.app.manuscriptController.handleBlockSelection) {
            this.app.manuscriptController.handleBlockSelection(blockId);
        }

        // 기존 방식과의 호환성을 위해 이벤트 발생
        const event = new CustomEvent('blockSelected', {
            detail: { blockId },
            bubbles: true
        });
        this.container.dispatchEvent(event);
    }

    /**
     * 액션 버튼 클릭을 처리합니다.
     * @param {HTMLElement} button - 액션 버튼
     * @param {Event} e - 클릭 이벤트
     * @private
     */
    _handleActionButtonClick(button, e) {
        e.stopPropagation();

        const blockId = button.dataset.blockId;
        const dropdown = this.container.querySelector(`.block-dropdown[data-block-id="${blockId}"]`);

        if (dropdown) {
            // 다른 드롭다운 메뉴 닫기
            this._closeAllDropdowns();

            // 현재 드롭다운 토글
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';

            // 드롭다운 위치 조정
            if (dropdown.style.display === 'block') {
                this._positionDropdown(dropdown, button);
            }
        }
    }

    /**
     * 드롭다운 아이템 클릭을 처리합니다.
     * @param {HTMLElement} item - 드롭다운 아이템
     * @param {Event} e - 클릭 이벤트
     * @private
     */
    _handleDropdownItemClick(item, e) {
        e.stopPropagation();

        const action = item.dataset.action;
        const blockId = item.dataset.blockId;

        // 드롭다운 닫기
        this._closeAllDropdowns();

        // 액션에 따라 처리
        switch (action) {
            case 'import':
                if (this.app.manuscriptController && this.app.manuscriptController.importBlockFromScenario) {
                    this.app.manuscriptController.importBlockFromScenario(
                        this.app.stateManager.getState().currentProject.id,
                        blockId
                    );
                }
                break;

            case 'export':
                if (this.app.manuscriptController && this.app.manuscriptController.exportBlockToScenario) {
                    this.app.manuscriptController.exportBlockToScenario(
                        this.app.stateManager.getState().currentProject.id,
                        blockId
                    );
                }
                break;

            case 'delete':
                if (this.app.manuscriptController && this.app.manuscriptController.handleDeleteManuscriptBlock) {
                    this.app.manuscriptController.handleDeleteManuscriptBlock(
                        this.app.stateManager.getState().currentProject.id,
                        blockId
                    );
                }
                break;
        }
    }

    /**
     * 드롭다운 위치를 조정합니다.
     * @param {HTMLElement} dropdown - 드롭다운 요소
     * @param {HTMLElement} button - 액션 버튼
     * @private
     */
    _positionDropdown(dropdown, button) {
        const rect = button.getBoundingClientRect();
        const dropdownWidth = 200; // 드롭다운 너비
        const viewportWidth = window.innerWidth;

        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 4}px`;
        dropdown.style.width = `${dropdownWidth}px`;

        // 우측 공간이 부족하면 좌측으로 배치
        if (rect.right + dropdownWidth > viewportWidth) {
            dropdown.style.left = `${rect.left - dropdownWidth + rect.width}px`;
        } else {
            dropdown.style.left = `${rect.left}px`;
        }

        dropdown.style.zIndex = '1000';
    }

    /**
     * 모든 드롭다운 메뉴를 닫습니다.
     * @private
     */
    _closeAllDropdowns() {
        this.container.querySelectorAll('.block-dropdown').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }

    /**
     * 합치기 버튼 상태를 업데이트합니다.
     * @private
     */
    _updateMergeButtonState() {
        const checkedBoxes = this.container.querySelectorAll('.block-checkbox:checked');
        const hasMultipleSelection = checkedBoxes.length >= 2;

        // Toolbar 컴포넌트에 이벤트 발생
        const event = new CustomEvent('selectionChanged', {
            detail: { hasMultipleSelection },
            bubbles: true
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Sortable을 초기화합니다.
     * @private
     */
    _initializeSortable() {
        const blockList = this.container.querySelector('#manuscript-block-list');

        if (!blockList || blockList.children.length === 0) return;

        // 기존 Sortable 인스턴스 정리
        if (this._sortableInstance) {
            this._sortableInstance.destroy();
        }

        // 새로운 Sortable 인스턴스 생성
        if (window.Sortable) {
            this._sortableInstance = new window.Sortable(blockList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                handle: '.block-title', // 제목 부분만 드래그 핸들로 사용
                filter: '.block-checkbox', // 체크박스는 드래그 대상에서 제외
                onEnd: (evt) => {
                    const blockIds = Array.from(evt.target.children)
                        .filter(li => li.dataset.blockId) // 유효한 li만
                        .map(li => li.dataset.blockId);

                    // 순서 변경 처리
                    if (this.app.manuscriptController && this.app.manuscriptController.handleUpdateManuscriptOrder) {
                        const projectId = this.app.stateManager.getState().currentProject.id;
                        this.app.manuscriptController.handleUpdateManuscriptOrder(projectId, blockIds);
                    }
                }
            });
        }
    }

    /**
     * 컴포넌트를 정리합니다.
     */
    destroy() {
        // Sortable 인스턴스 정리
        if (this._sortableInstance) {
            this._sortableInstance.destroy();
            this._sortableInstance = null;
        }

        // 컨테이너 초기화
        if (this.container) {
            this.container.innerHTML = '';
        }

        this._isInitialized = false;
    }
}
