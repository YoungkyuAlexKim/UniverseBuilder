/**
 * 캐릭터 카드 컴포넌트
 * 캐릭터 관련 카드 생성 함수들을 담당하는 모듈
 */

// 이 함수들은 main.js에서 필요한 함수들을 파라미터로 받아와 사용합니다.
let app; // App 인스턴스를 저장할 변수

/**
 * 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeCharacterCard(appInstance) {
    app = appInstance;
}

/**
 * 기본 캐릭터 카드 엘리먼트를 생성합니다.
 * @param {object} card - 카드 데이터
 * @param {number} projectId - 프로젝트 ID
 * @param {number} groupId - 그룹 ID
 * @returns {HTMLElement} 생성된 카드 엘리먼트
 */
export function createCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `<strong>${card.name || '이름 없는 카드'}</strong>`;
    cardEl.addEventListener('click', () => {
        const cardData = { ...card, group_id: groupId };
        app.modals.openCardModal(cardData, projectId);
    });
    return cardEl;
}

/**
 * 향상된 캐릭터 카드 엘리먼트를 생성합니다.
 * @param {object} card - 카드 데이터
 * @param {number} projectId - 프로젝트 ID
 * @param {number} groupId - 그룹 ID
 * @returns {HTMLElement} 생성된 향상된 카드 엘리먼트
 */
export function createEnhancedCardElement(card, projectId, groupId) {
    const cardEl = document.createElement('article');
    cardEl.className = 'character-card';
    cardEl.dataset.cardId = card.id;

    // 설명 미리보기 (80자 제한)
    const descriptionPreview = card.description ?
        (card.description.length > 80 ? card.description.substring(0, 80) + '...' : card.description)
        : '설명이 없습니다';

    // 핵심 태그들만 (최대 2개씩)
    const personalityTags = Array.isArray(card.personality) ? card.personality.slice(0, 2) : [];
    const abilityTags = Array.isArray(card.abilities) ? card.abilities.slice(0, 2) : [];

    // 태그 HTML - 성격을 우선적으로 표시
    const allTags = [...personalityTags.map(trait => ({type: 'personality', text: trait})),
                     ...abilityTags.map(ability => ({type: 'ability', text: ability}))];
    const displayTags = allTags.slice(0, 3); // 최대 3개만

    const tagsHTML = displayTags.map(tag =>
        `<span class="character-tag ${tag.type}-tag">${tag.text}</span>`
    ).join('');

    cardEl.innerHTML = `
        <div class="character-card-header">
            <h4 class="character-card-name">${card.name || '이름 없는 캐릭터'}</h4>
            <div class="character-card-actions">
                <button class="secondary outline character-edit-btn">✏️</button>
            </div>
        </div>
        <div class="character-card-content">
            <p class="character-description">${descriptionPreview}</p>
            ${tagsHTML ? `<div class="character-tags-container">${tagsHTML}</div>` : ''}
        </div>
    `;

    cardEl.addEventListener('click', (e) => {
        // 편집 버튼 클릭이 아닐 때만 모달 열기
        if (!e.target.closest('.character-edit-btn')) {
            const cardData = { ...card, group_id: groupId };
            app.modals.openCardModal(cardData, projectId);
        }
    });

    // 편집 버튼 이벤트
    const editBtn = cardEl.querySelector('.character-edit-btn');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardData = { ...card, group_id: groupId };
        app.modals.openCardModal(cardData, projectId);
    });

    return cardEl;
}
