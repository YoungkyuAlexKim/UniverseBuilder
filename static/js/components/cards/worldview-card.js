/**
 * 세계관 카드 컴포넌트
 * 세계관 관련 카드 생성 함수들을 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let app; // App 인스턴스를 저장할 변수

/**
 * 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeWorldviewCard(appInstance) {
    app = appInstance;
}

/**
 * 기본 세계관 카드 엘리먼트를 생성합니다.
 * @param {object} card - 카드 데이터
 * @param {number} projectId - 프로젝트 ID
 * @param {number} groupId - 그룹 ID
 * @returns {HTMLElement} 생성된 카드 엘리먼트
 */
export function createWorldviewCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `<strong>${card.title || '제목 없는 카드'}</strong>`;
    cardEl.addEventListener('click', () => app.modals.openWorldviewCardModal(card, projectId, groupId));
    return cardEl;
}

/**
 * 향상된 세계관 카드 엘리먼트를 생성합니다.
 * @param {object} card - 카드 데이터
 * @param {number} projectId - 프로젝트 ID
 * @param {number} groupId - 그룹 ID
 * @returns {HTMLElement} 생성된 향상된 카드 엘리먼트
 */
export function createEnhancedWorldviewCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'worldview-card';
    cardEl.dataset.cardId = card.id;

    // 내용 미리보기 (200자 제한)
    const contentPreview = card.content ?
        (card.content.length > 200 ? card.content.substring(0, 200) + '...' : card.content)
        : '설정 내용이 없습니다.';

    cardEl.innerHTML = `
        <div class="worldview-card-header">
            <h4 class="worldview-card-title">${card.title || '제목 없는 설정'}</h4>
            <div class="worldview-card-actions">
                <button class="secondary outline worldview-edit-btn">✏️</button>
            </div>
        </div>
        <div class="worldview-card-content">
            <p class="worldview-card-preview">${contentPreview}</p>
        </div>
    `;

    cardEl.addEventListener('click', (e) => {
        // 편집 버튼 클릭이 아닐 때만 모달 열기
        if (!e.target.closest('.worldview-edit-btn')) {
            app.modals.openWorldviewCardModal(card, projectId, groupId);
        }
    });

    // 편집 버튼 이벤트
    const editBtn = cardEl.querySelector('.worldview-edit-btn');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        app.modals.openWorldviewCardModal(card, projectId, groupId);
    });

    return cardEl;
}
