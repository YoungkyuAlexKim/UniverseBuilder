/**
 * 우측 '작품 도구' 패널의 렌더링 및 관련 기능을 담당하는 컴포넌트입니다.
 * 등장 캐릭터, AI 피드백 등의 기능 담당.
 */

export class ContextPanel {
    constructor(container, app) {
        this.container = container;
        this.app = app;
        this.eventManager = app.eventManager;
        this._currentBlockId = null;
        this._isInitialized = false;

        this._setupEventListeners();
    }

    /**
     * 컨텍스트 패널을 렌더링합니다.
     * @param {Object} projectData - 프로젝트 데이터
     */
    render(projectData) {
        if (!this._isInitialized) {
            // 기존 HTML 구조를 사용하므로 별도 렌더링 필요 없음
            this._isInitialized = true;
        }

        // 초기 상태 설정
        this._clearContextPanel();
    }

    /**
     * 컨텍스트 패널 HTML을 렌더링합니다.
     * @private
     */


    /**
     * 이벤트 리스너를 설정합니다.
     * @private
     */
    _setupEventListeners() {
        // 이벤트 위임 사용
        this.container.addEventListener('click', (e) => {
            this._handleContextClick(e);
        });

        // BlockList 컴포넌트로부터 블록 선택 이벤트 수신
        document.addEventListener('blockSelected', (e) => {
            this._handleBlockSelected(e.detail);
        });
    }

    /**
     * 컨텍스트 패널 클릭 이벤트를 처리합니다.
     * @param {Event} e - 클릭 이벤트
     * @private
     */
    _handleContextClick(e) {
        const target = e.target;
        const button = target.closest('button');

        if (!button) return;

        const buttonId = button.id;

        switch (buttonId) {
            case 'update-characters-btn':
                this._handleUpdateCharacters();
                break;

            case 'request-feedback-btn':
                this._handleRequestFeedback();
                break;
        }
    }

    /**
     * 블록 선택 이벤트를 처리합니다.
     * @param {Object} detail - 이벤트 세부 정보
     * @private
     */
    _handleBlockSelected(detail) {
        const blockId = detail.blockId;
        this._currentBlockId = blockId;
        this._updateContextForBlock(blockId);
    }

    /**
     * 캐릭터 갱신 버튼 클릭을 처리합니다.
     * @private
     */
    _handleUpdateCharacters() {
        if (!this._currentBlockId) {
            alert('먼저 블록을 선택해주세요.');
            return;
        }

        // 컨트롤러 존재 확인 및 메서드 호출

        // EditorPanel에서 콘텐츠 가져오기
        const contentTextarea = document.querySelector('#manuscript-block-content');
        if (!contentTextarea) {
            alert('편집기 콘텐츠를 찾을 수 없습니다.');
            return;
        }

        const textContent = contentTextarea.value.trim();
        if (!textContent) {
            alert('캐릭터를 분석할 내용이 없습니다.');
            return;
        }

        this.app.call('manuscript', 'extractCharactersFromBlock', this._currentBlockId, textContent);
    }

    /**
     * AI 피드백 요청 버튼 클릭을 처리합니다.
     * @private
     */
    _handleRequestFeedback() {
        if (!this._currentBlockId) {
            alert('먼저 블록을 선택해주세요.');
            return;
        }

        // 컨트롤러 존재 확인 및 메서드 호출

        // EditorPanel에서 콘텐츠 가져오기
        const contentTextarea = document.querySelector('#manuscript-block-content');
        if (!contentTextarea) {
            alert('편집기 콘텐츠를 찾을 수 없습니다.');
            return;
        }

        const textContent = contentTextarea.value.trim();
        if (!textContent) {
            alert('피드백을 받을 내용이 없습니다.');
            return;
        }

        this.app.call('manuscript', 'requestExpertFeedback', this._currentBlockId, textContent);
    }

    /**
     * 블록 선택 시 컨텍스트 패널을 업데이트합니다.
     * @param {string} blockId - 블록 ID
     * @private
     */
    _updateContextForBlock(blockId) {
        const characterSection = this.container.querySelector('#character-info-section');
        const feedbackSection = this.container.querySelector('#feedback-section');

        // 캐릭터 섹션 초기화
        if (characterSection) {
            const charactersList = characterSection.querySelector('#related-characters-list');
            if (charactersList) {
                charactersList.innerHTML = `
                    <div class="character-loading">
                        <small>편집할 블록을 선택했습니다. 캐릭터 정보를 분석하려면 갱신 버튼을 클릭하세요.</small>
                    </div>
                `;
            }
        }

        // 피드백 섹션 초기화
        if (feedbackSection) {
            const feedbackContent = feedbackSection.querySelector('#feedback-content');
            if (feedbackContent) {
                feedbackContent.innerHTML = `
                    <div class="feedback-loading">
                        <small>편집할 블록을 선택했습니다. AI 피드백을 받으려면 버튼을 클릭하세요.</small>
                    </div>
                `;
            }
        }
    }

    /**
     * 캐릭터 추출 결과를 화면에 표시합니다.
     * @param {Array} characters - 캐릭터 배열
     * @param {Array} unidentifiedEntities - 미확인 개체 배열
     */
    displayCharacterResults(characters, unidentifiedEntities) {
        const charactersList = this.container.querySelector('#related-characters-list');

        if (!charactersList) return;

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
                        <span class="character-role">${this._getRoleDisplayText(character.role)}</span>
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
     * AI 전문가 피드백 결과를 화면에 표시합니다.
     * @param {Object} feedback - 피드백 데이터
     */
    displayExpertFeedback(feedback) {
        const feedbackContent = this.container.querySelector('#feedback-content');

        if (!feedbackContent) return;

        // 점수별 색상 설정
        const getScoreColor = (score) => {
            if (score >= 8) return '#10b981'; // 초록
            if (score >= 6) return '#f59e0b'; // 노랑
            return '#ef4444'; // 빨강
        };

        const scoreColor = getScoreColor(feedback.overall_score);

        // 개선사항 우선순위별 정렬 및 표시
        const sortedImprovements = feedback.improvements.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        const improvementItems = sortedImprovements.map(improvement => {
            const priorityIcon = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🟢'
            }[improvement.priority];

            return `
                <div class="improvement-item priority-${improvement.priority}">
                    <div class="improvement-header">
                        <span class="priority-badge">${priorityIcon}</span>
                        <span class="category">${improvement.category}</span>
                    </div>
                    <div class="improvement-content">
                        <div class="issue">${improvement.issue}</div>
                        <div class="suggestion">💡 ${improvement.suggestion}</div>
                    </div>
                </div>
            `;
        }).join('');

        feedbackContent.innerHTML = `
            <div class="feedback-result">
                <!-- 점수 표시 -->
                <div class="score-section">
                    <div class="score-display">
                        <span class="score-number" style="color: ${scoreColor}">${feedback.overall_score}</span>
                        <span class="score-label">/10점</span>
                    </div>
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${feedback.overall_score * 10}%; background-color: ${scoreColor}"></div>
                    </div>
                </div>

                <!-- 장점 -->
                ${feedback.strengths.length > 0 ? `
                    <div class="strengths-section">
                        <h6>✨ 잘된 점</h6>
                        <ul>
                            ${feedback.strengths.map(strength => `<li>${strength}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- 개선사항 -->
                ${sortedImprovements.length > 0 ? `
                    <div class="improvements-section">
                        <h6>🔧 개선 제안</h6>
                        ${improvementItems}
                    </div>
                ` : ''}

                <!-- 작문 팁 -->
                ${feedback.writing_tips.length > 0 ? `
                    <div class="tips-section">
                        <h6>💡 작문 팁</h6>
                        <ul>
                            ${feedback.writing_tips.map(tip => `<li>${tip}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- 격려 메시지 -->
                ${feedback.encouragement ? `
                    <div class="encouragement-section">
                        <h6>🌟 격려의 말</h6>
                        <p class="encouragement-text">${feedback.encouragement}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 역할 텍스트를 한글로 변환합니다.
     * @param {string} role - 역할
     * @returns {string} 한글 역할 텍스트
     * @private
     */
    _getRoleDisplayText(role) {
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

    /**
     * 컨텍스트 패널을 초기화합니다.
     * @private
     */
    _clearContextPanel() {
        const charactersList = this.container.querySelector('#related-characters-list');
        const feedbackContent = this.container.querySelector('#feedback-content');

        if (charactersList) {
            charactersList.innerHTML = `
                <div class="character-loading">
                    <small>편집할 블록을 선택하세요.</small>
                </div>
            `;
        }

        if (feedbackContent) {
            feedbackContent.innerHTML = `
                <div class="feedback-loading">
                    <small>편집할 블록을 선택하세요.</small>
                </div>
            `;
        }

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
