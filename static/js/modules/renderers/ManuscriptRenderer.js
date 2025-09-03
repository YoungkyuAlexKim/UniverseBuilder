/**
 * 집필 탭의 전체 UI 구조를 렌더링하고, 각 하위 컴포넌트를 초기화하는 책임을 가집니다.
 * 기존 ui.js의 renderManuscriptTab 함수를 대체합니다.
 */

export class ManuscriptRenderer {
    constructor(container, eventManager, app) {
        this.container = container;
        this.eventManager = eventManager;
        this.app = app;
        this.components = {};

        // 컴포넌트 초기화 지연 (render 시점에 초기화)
        this._isInitialized = false;
    }

    /**
     * 집필 탭의 전체 UI를 렌더링합니다.
     * @param {Object} projectData - 프로젝트 데이터
     */
    async render(projectData) {
        console.log('ManuscriptRenderer: Render called', projectData);
        // 기본 HTML 구조 렌더링 (단 한 번만)
        if (!this._isInitialized) {
            console.log('ManuscriptRenderer: Initializing components');
            this._renderBasicStructure();
            await this._initializeComponents();
            this._isInitialized = true;
        }

        // 각 컴포넌트에 데이터 전달하여 렌더링 위임
        this._renderComponents(projectData);
    }

    /**
     * 기본 HTML 구조를 렌더링합니다.
     * @private
     */
    _renderBasicStructure() {
        // 기존 HTML 구조를 유지하되 필요한 경우에만 수정
        const existingLayout = this.container.querySelector('.manuscript-layout');
        if (!existingLayout) {
            this.container.innerHTML = `
                <div class="manuscript-layout">
                    <aside class="manuscript-hierarchy-panel">
                        <header>
                            <h5>개요</h5>
                            <div class="manuscript-actions">
                                <div class="button-row">
                                    <button id="manuscript-import-btn" class="secondary outline" title="시나리오 탭에서 플롯을 불러와 집필을 시작합니다"><i data-lucide="download"></i><span>불러오기</span></button>
                                    <button id="manuscript-export-btn" class="secondary outline" title="집필 내용을 시나리오 탭으로 내보냅니다"><i data-lucide="upload"></i><span>내보내기</span></button>
                                </div>
                                <div class="button-row">
                                    <button id="manuscript-clear-btn" class="secondary outline" title="모든 집필 블록을 삭제합니다"><i data-lucide="trash-2"></i><span>전체 삭제</span></button>
                                    <button id="manuscript-merge-btn" class="secondary outline" title="선택된 블록들을 하나로 합칩니다" disabled><i data-lucide="combine"></i><span>합치기</span></button>
                                    <button id="manuscript-split-btn" class="secondary outline" title="현재 블록을 둘로 분할합니다" disabled><i data-lucide="split"></i><span>분할</span></button>
                                </div>
                            </div>
                        </header>
                        <ul id="manuscript-block-list" class="block-list">
                            <li class="empty-message">작업할 내용이 없습니다. '불러오기'를 눌러 시작하세요.</li>
                        </ul>
                    </aside>

                    <main class="manuscript-editor-panel">
                        <div id="editor-toolbar">
                            <input type="text" id="manuscript-block-title" placeholder="블록 제목을 입력하세요...">
                            <button id="manuscript-save-btn">저장</button>
                            <button id="manuscript-ai-edit-btn" class="secondary" disabled><i data-lucide="file-text"></i>AI로 수정</button>
                            <button id="manuscript-partial-refine-btn" class="secondary" disabled><i data-lucide="quote"></i>부분 다듬기</button>
                        </div>
                        <div id="editor-info-bar" style="padding: 0.5rem 1rem; font-size: 0.8rem; color: var(--pico-muted-color); background: var(--pico-secondary-background); border-bottom: 1px solid var(--pico-border-color);">
                            <span>글자 수: <strong id="char-count-display">0</strong></span> |
                            <span>단어 수: <strong id="word-count-display">0</strong></span>
                        </div>
                        <textarea id="manuscript-block-content" placeholder="이곳에 원고를 작성하세요..."></textarea>
                    </main>

                    <aside class="manuscript-context-panel">
                        <header>
                            <h5>작품 도구</h5>
                        </header>

                        <!-- 캐릭터 정보 섹션 -->
                        <div class="context-section character-section" id="character-info-section">
                            <div class="section-header">
                                <h6><i data-lucide="users"></i>등장 캐릭터</h6>
                                <button id="update-characters-btn" class="secondary outline small" title="캐릭터 정보 갱신">
                                    <i data-lucide="refresh-cw"></i>
                                </button>
                            </div>
                            <div id="related-characters-list" class="characters-list">
                                <div class="character-loading">
                                    <small>편집할 블록을 선택하세요.</small>
                                </div>
                            </div>
                        </div>

                        <!-- AI 피드백 섹션 -->
                        <div class="context-section feedback-section" id="feedback-section">
                            <div class="section-header">
                                <h6><i data-lucide="message-square"></i>AI 피드백</h6>
                                <button id="request-feedback-btn" class="secondary outline small" title="AI에게 피드백을 요청합니다">
                                    <i data-lucide="message-square"></i>피드백 받기
                                </button>
                            </div>
                            <div id="feedback-content" class="feedback-content">
                                <div class="feedback-loading">
                                    <small>편집할 블록을 선택하세요.</small>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            `;
        }
    }

    /**
     * 각 컴포넌트를 초기화합니다.
     * @private
     */
    async _initializeComponents() {
        // 동적 import로 컴포넌트 로드 (필요 시점에만 로드)
        await this._loadComponents();
    }

    /**
     * 컴포넌트들을 동적으로 로드합니다.
     * @private
     */
    async _loadComponents() {
        try {
            // 컴포넌트들을 병렬로 로드
            const [
                { ManuscriptToolbar },
                { BlockList },
                { EditorPanel },
                { ContextPanel }
            ] = await Promise.all([
                import('../components/manuscript/ManuscriptToolbar.js'),
                import('../components/manuscript/BlockList.js'),
                import('../components/manuscript/EditorPanel.js'),
                import('../components/manuscript/ContextPanel.js')
            ]);

            // 컴포넌트 인스턴스 생성
            this.components.toolbar = new ManuscriptToolbar(
                this.container.querySelector('aside.manuscript-hierarchy-panel'),
                this.app
            );

            this.components.blockList = new BlockList(
                this.container.querySelector('aside.manuscript-hierarchy-panel'),
                this.app
            );

            this.components.editorPanel = new EditorPanel(
                this.container.querySelector('main.manuscript-editor-panel'),
                this.app
            );

            this.components.contextPanel = new ContextPanel(
                this.container.querySelector('aside.manuscript-context-panel'),
                this.app
            );

        } catch (error) {
            console.error('컴포넌트 로드 실패:', error);
            this._renderErrorState(error);
        }
    }

    /**
     * 각 컴포넌트에 데이터를 전달하여 렌더링을 위임합니다.
     * @param {Object} projectData - 프로젝트 데이터
     * @private
     */
    _renderComponents(projectData) {
        if (!this._isInitialized) return;

        try {
            // 각 컴포넌트에 렌더링 위임
            if (this.components.toolbar) {
                this.components.toolbar.render(projectData);
            }

            if (this.components.blockList) {
                const blocks = projectData.manuscript_blocks || [];
                this.components.blockList.render(blocks);
            }

            if (this.components.editorPanel) {
                this.components.editorPanel.render(projectData);
            }

            if (this.components.contextPanel) {
                this.components.contextPanel.render(projectData);
            }

            // Lucide 아이콘 재생성
            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }

        } catch (error) {
            console.error('컴포넌트 렌더링 실패:', error);
            this._renderErrorState(error);
        }
    }

    /**
     * 에러 상태를 렌더링합니다.
     * @param {Error} error - 발생한 에러
     * @private
     */
    _renderErrorState(error) {
        this.container.innerHTML = `
            <div class="manuscript-error-state">
                <article>
                    <header>
                        <h3>⚠️ 집필 탭 로드 오류</h3>
                    </header>
                    <p>집필 탭을 로드하는 중 오류가 발생했습니다.</p>
                    <details>
                        <summary>기술적 세부사항</summary>
                        <pre>${error.message}</pre>
                    </details>
                    <footer>
                        <button onclick="window.location.reload()">페이지 새로고침</button>
                    </footer>
                </article>
            </div>
        `;
    }

    /**
     * 컴포넌트를 제거하고 정리합니다.
     */
    destroy() {
        // 각 컴포넌트의 destroy 메서드 호출
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });

        // 컨테이너 초기화
        if (this.container) {
            this.container.innerHTML = '';
        }

        this.components = {};
        this._isInitialized = false;
    }

    /**
     * 특정 컴포넌트를 다시 렌더링합니다.
     * @param {string} componentName - 컴포넌트 이름
     * @param {*} data - 렌더링 데이터
     */
    updateComponent(componentName, data) {
        if (!this._isInitialized) return;

        const component = this.components[componentName];
        if (component && typeof component.render === 'function') {
            component.render(data);
        }
    }
}
