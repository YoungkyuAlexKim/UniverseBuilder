// FILE: relationship-panel.js
/**
 * 관계도 패널의 생성 및 관리 로직을 담당하는 모듈
 */

import * as api from '../api.js';

// DOM Elements
const cardDetailsModal = document.getElementById('card-details-modal');

// App 인스턴스를 저장할 변수
let app;

/**
 * 관계도 패널 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeRelationshipPanel(appInstance) {
    app = appInstance;
}

/**
 * 관계 유형에 따른 색상을 반환합니다.
 * @param {string} type - 관계 유형
 * @returns {string} 색상 코드
 */
function getRelationshipColor(type) {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('적대') || lowerType.includes('라이벌') || lowerType.includes('증오')) {
        return '#d9534f';
    }
    if (lowerType.includes('우호') || lowerType.includes('동료') || lowerType.includes('조력')) {
        return '#5cb85c';
    }
    if (lowerType.includes('연인') || lowerType.includes('사랑') || lowerType.includes('애정')) {
        return '#f0ad4e';
    }
    if (lowerType.includes('가족') || lowerType.includes('형제') || lowerType.includes('자매')) {
        return '#5bc0de';
    }
    return '#999999';
}

/**
 * 관계도 패널을 표시합니다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} currentCard - 현재 선택된 캐릭터
 */
export async function showRelationshipPanel(projectId, currentCard) {
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
    let project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    // 프로젝트 상세 데이터가 로드되지 않았으면 로드 대기
    if (!project.isDetailLoaded) {
        try {
            // 현재 프로젝트 설정을 변경하지 않고 목록에서만 상세 데이터 로드
            const loadSuccess = await app.stateManager.loadProjectDetailsInList(projectId);

            if (!loadSuccess) {
                console.error('프로젝트 상세 데이터 로드 실패 - loadProjectDetailsInList가 false 반환');
                alert('프로젝트 데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
                return;
            }

            // 다시 프로젝트 데이터 가져오기
            const updatedState = app.stateManager.getState();
            project = updatedState.projects.find(p => p.id === projectId);

            if (!project) {
                console.error('업데이트 후에도 프로젝트를 찾을 수 없음');
                alert('프로젝트를 찾을 수 없습니다.');
                return;
            }
        } catch (error) {
            console.error('프로젝트 상세 데이터 로드 중 예외 발생:', error);
            alert('프로젝트 데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
            return;
        }
    }

    const allCharacters = project.groups ? project.groups.flatMap(g => g.cards || []) : [];

    const otherCharacters = allCharacters.filter(c => c.id !== currentCard.id);

    // 다른 캐릭터가 없으면 경고
    if (otherCharacters.length === 0) {
        console.warn('No other characters found! This might be the issue.');
        if (allCharacters.length === 0) {
            console.warn('No characters at all in the project!');
        }
    }

    const relationships = project.relationships || [];

    const panel = document.createElement('div');
    panel.className = 'relationship-panel';
    panel.innerHTML = `
        <article style="height: 100%; display: flex; flex-direction: column;">
            <header style="display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <hgroup style="margin-bottom: 0;">
                    <h3><strong>${currentCard.name}</strong>의 관계도</h3>
                </hgroup>
                <a href="#close" aria-label="Close" class="close"></a>
            </header>

                        <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                <!-- 통합된 관계 편집 폼 (상단 배치) -->
                <div id="relationship-form-container" class="relationship-form-container">
                    <div class="form-header">
                        <a href="#close" aria-label="Close" class="close" id="form-close-btn"></a>
                    </div>
                    <form id="relationship-form" class="relationship-form">
                    <input type="hidden" name="relationship_id" value="">
                    <fieldset id="relationship-fieldset">
                        <legend><strong><i data-lucide="plus-circle"></i>새 관계 추가 / 수정</strong></legend>
                        <div class="grid">
                            <label for="target-character-select">
                                    대상 캐릭터
                                <select id="target-character-select" name="target_character_id" required>
                                    <option value="" disabled selected>캐릭터 선택...</option>
                                </select>
                            </label>
                            <label for="relationship-type">
                                관계 유형
                                <input type="text" id="relationship-type" name="type" placeholder="예: 동맹, 적대, 스승..." required>
                            </label>
                            <label for="relationship-phase">
                                관계 변화 단계
                                <input type="number" id="relationship-phase" name="phase_order" min="1" value="1" placeholder="1" required>
                            </label>
                        </div>
                        <label for="relationship-desc">설명</label>
                        <textarea id="relationship-desc" name="description" rows="3" placeholder="관계에 대한 세부 설명..."></textarea>
                    </fieldset>

                    <fieldset id="ai-suggestion-fieldset">
                        <legend><strong><i data-lucide="sparkles"></i>AI 추천 옵션</strong></legend>
                        <label for="relationship-keyword">
                            세부 키워드 (선택)
                            <input type="text" id="relationship-keyword" name="keyword" placeholder="예: 애증, 비즈니스 파트너, 오래된 우정...">
                        </label>
                        <label for="relationship-tendency">
                            추천 방향성: <span id="tendency-label">중립</span>
                            <input type="range" id="relationship-tendency" name="tendency" min="-2" max="2" value="0" step="1">
                        </label>
                        <button type="button" id="ai-suggest-rel-btn" class="secondary" style="margin-top: 0.5rem; width: 100%;"><i data-lucide="lightbulb"></i>AI로 관계 추천받기</button>
                    </fieldset>

                                            <div class="grid">
                            <button type="submit"><i data-lucide="save"></i>관계 저장</button>
                            <button type="button" id="cancel-form-btn" class="secondary outline" style="width: auto;"><i data-lucide="x"></i>취소</button>
                        </div>
                    </form>
                </div>

                <!-- 관계 카드 목록 -->
                <div style="flex: 1; min-height: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4><strong><i data-lucide="list"></i>현재 관계 목록</strong></h4>
                        <button type="button" id="add-relationship-btn" class="secondary" style="width: auto;">
                            <i data-lucide="plus"></i>새 관계 추가
                        </button>
                    </div>
                    <div id="relationship-list-container"></div>
                </div>
            </div>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        cardDetailsModal.classList.add('shifted');
        lucide.createIcons();
    }, 10);

    const closePanel = () => {
        panel.classList.remove('active');
        cardDetailsModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };

    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    const activeRelationships = relationships.filter(r =>
        r.source_character_id === currentCard.id || r.target_character_id === currentCard.id
    );

    const relatedCharacterIds = new Set([currentCard.id]);
    activeRelationships.forEach(r => {
        relatedCharacterIds.add(r.source_character_id);
        relatedCharacterIds.add(r.target_character_id);
    });







    const addRelationshipBtn = panel.querySelector('#add-relationship-btn');
    const listContainer = panel.querySelector('#relationship-list-container');

    const renderRelationshipList = () => {
        if (activeRelationships.length === 0) {
            listContainer.innerHTML = '<p>아직 설정된 관계가 없습니다.</p>';
            return;
        }

        // [Phase 5] 관계들을 캐릭터 쌍별로 그룹화하여 표시
        const groupedRelationships = groupRelationshipsByCharacterPair(activeRelationships, currentCard.id);

        listContainer.innerHTML = `
            <div class="relationship-grid">
                ${Object.values(groupedRelationships).map(group => {
                    const sourceChar = allCharacters.find(c => c.id === group.sourceId);
                    const targetChar = allCharacters.find(c => c.id === group.targetId);
                    const sourceName = sourceChar ? sourceChar.name : '알 수 없음';
                    const targetName = targetChar ? targetChar.name : '알 수 없음';

                    return generateGroupedRelationshipCard(group, sourceName, targetName, allCharacters, currentCard);
                }).join('')}
            </div>
        `;
        lucide.createIcons();

        // [Phase 5] 그룹화된 관계 카드의 단계 전환 이벤트 설정
        setupPhaseSwitcherEvents();
    };

    // 폼 토글 함수
    const toggleRelationshipForm = (show = true, relationshipData = null) => {
        const formContainer = panel.querySelector('#relationship-form-container');
        const form = panel.querySelector('#relationship-form');

        if (show) {
            // 아이콘 먼저 렌더링
            lucide.createIcons();

            // 약간의 지연 후 애니메이션 시작 (아이콘 렌더링 완료 대기)
            setTimeout(() => {
                formContainer.classList.add('active');

                // 폼이 상단에 있으므로 패널 상단으로 스크롤
                setTimeout(() => {
                    panel.scrollTo({ top: 0, behavior: 'smooth' });
                }, 300); // CSS transition 시간과 동일
            }, 10);

            // 폼 초기화
            form.reset();
            form.elements.relationship_id.value = relationshipData ? relationshipData.id : '';
            form.elements.phase_order.value = '1';

            if (relationshipData) {
                // 수정 모드
                const targetId = relationshipData.source_character_id === currentCard.id
                    ? relationshipData.target_character_id
                    : relationshipData.source_character_id;

        form.elements.target_character_id.value = targetId;
        form.elements.target_character_id.disabled = true;
                form.elements.type.value = relationshipData.type || '';
                form.elements.description.value = relationshipData.description || '';
                form.elements.phase_order.value = relationshipData.phase_order || 1;

                // 범례 업데이트
                const legend = form.querySelector('legend');
                legend.innerHTML = '<strong><i data-lucide="edit-3"></i>관계 수정</strong>';
            } else {
                // 추가 모드
                form.elements.target_character_id.disabled = false;

                // 범례 업데이트
                const legend = form.querySelector('legend');
                legend.innerHTML = '<strong><i data-lucide="plus-circle"></i>새 관계 추가</strong>';
            }
        } else {
            // 폼 숨김
            formContainer.classList.remove('active');
        }
    };

    // [+ 새 관계 추가] 버튼 이벤트
    addRelationshipBtn.addEventListener('click', () => {
        toggleRelationshipForm(true);
    });

    // 폼 이벤트 리스너들
    const form = panel.querySelector('#relationship-form');
    const cancelBtn = panel.querySelector('#cancel-form-btn');
    const closeBtn = panel.querySelector('#form-close-btn');
    const aiSuggestBtn = panel.querySelector('#ai-suggest-rel-btn');

    // 취소 버튼과 X 버튼 이벤트
    const closeForm = (e) => {
        e.preventDefault();
        toggleRelationshipForm(false);
    };

    cancelBtn.addEventListener('click', closeForm);
    closeBtn.addEventListener('click', closeForm);

    // AI 추천 버튼 이벤트
    aiSuggestBtn.addEventListener('click', async () => {
        const targetCharacterId = form.elements.target_character_id.value;
        if (!targetCharacterId) {
            alert('먼저 대상 캐릭터를 선택해주세요.');
            return;
        }

        aiSuggestBtn.setAttribute('aria-busy', 'true');

        try {
            const tendency = parseInt(form.elements.tendency.value, 10);
            const keyword = form.elements.keyword.value.trim();
            const suggestion = await api.suggestRelationship(projectId, currentCard.id, targetCharacterId, tendency, keyword);
            form.elements.type.value = suggestion.type || '';
            form.elements.description.value = suggestion.description || '';
        } catch (error) {
            console.error('AI 관계 추천 실패:', error);
            alert(`AI 추천을 받는 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            aiSuggestBtn.setAttribute('aria-busy', 'false');
        }
    });

    // 폼 제출 이벤트
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saveBtn = form.querySelector('button[type="submit"]');
        saveBtn.setAttribute('aria-busy', 'true');

        const relationshipId = form.elements.relationship_id.value;
        const targetId = form.elements.target_character_id.value;

        const relationshipData = {
            source_character_id: currentCard.id,
            target_character_id: targetId,
            type: form.elements.type.value.trim(),
            description: form.elements.description.value.trim(),
            phase_order: parseInt(form.elements.phase_order.value, 10)
        };

        try {
            if (relationshipId) {
                const updateData = {
                    type: relationshipData.type,
                    description: relationshipData.description,
                    phase_order: relationshipData.phase_order
                };
                await api.updateRelationship(projectId, relationshipId, updateData);
                alert('관계가 성공적으로 수정되었습니다.');
            } else {
                await api.createRelationship(projectId, relationshipData);
                alert('새로운 관계가 생성되었습니다.');
            }

            // 폼 숨기고 목록 갱신
            toggleRelationshipForm(false);
            await app.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('관계 저장 실패:', error);
            alert(`오류: ${error.message}`);
        } finally {
            saveBtn.setAttribute('aria-busy', 'false');
        }
    });

    // 슬라이더 이벤트 설정
    const tendencySlider = panel.querySelector('#relationship-tendency');
    const tendencyLabel = panel.querySelector('#tendency-label');
    const tendencyMap = {
        '-2': '많이 비우호',
        '-1': '비우호',
        '0': '중립',
        '1': '우호',
        '2': '많이 우호'
    };
    tendencySlider.addEventListener('input', () => {
        tendencyLabel.textContent = tendencyMap[tendencySlider.value];
    });



    listContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.matches('.delete-rel-btn')) {
            const relationshipId = target.dataset.id;
            if (confirm("정말로 이 관계를 삭제하시겠습니까?")) {
                try {
                    await api.deleteRelationship(projectId, relationshipId);
                    alert('관계가 삭제되었습니다.');
                    closePanel();
                    // [수정] stateManager를 통해 상태 갱신 요청
                    await app.stateManager.refreshCurrentProject();
                } catch (error) {
                    console.error('관계 삭제 실패:', error);
                    alert(`오류: ${error.message}`);
                }
            }
        }

        if (target.matches('.edit-rel-btn')) {
            const relationshipId = target.dataset.id;
            // [Phase 5] 그룹화된 카드에서 현재 표시중인 관계 찾기
            const card = target.closest('.relationship-card-compact, .relationship-card-grouped');
            let relToEdit = relationships.find(r => r.id === relationshipId);

            // 그룹화된 카드인 경우 현재 표시중인 단계의 관계 찾기
            if (card && card.classList.contains('relationship-card-grouped')) {
                // phase-indicator 요소를 찾기 위해 더 넓은 범위에서 검색
                const phaseIndicator = card.querySelector('.phase-indicator');
                if (phaseIndicator) {
                    const currentPhase = phaseIndicator.textContent.split(' / ')[0];
                    const phaseData = card.querySelector(`.phase-data[data-phase="${currentPhase}"]`);
                    if (phaseData) {
                        const currentRelId = phaseData.dataset.id;
                        relToEdit = relationships.find(r => r.id === currentRelId);
                    }
                }
            }

            if (relToEdit) {
                toggleRelationshipForm(true, relToEdit);
            }
        }
    });

    renderRelationshipList();
}



/**
 * [Phase 5] 관계들을 캐릭터 쌍별로 그룹화 (관계 방향 고려)
 */
function groupRelationshipsByCharacterPair(relationships, currentCharacterId) {
    const groups = {};

    relationships.forEach(relationship => {
        // [수정] 관계 방향을 고려하여 그룹화
        // A→B와 B→A는 서로 다른 관계로 취급
        const sourceId = relationship.source_character_id;
        const targetId = relationship.target_character_id;

        // 그룹 키 생성 (source-target 방향 유지)
        const pairKey = `${sourceId}-${targetId}`;

        if (!groups[pairKey]) {
            groups[pairKey] = {
                sourceId: sourceId,
                targetId: targetId,
                relationships: []
            };
        }

        groups[pairKey].relationships.push(relationship);
    });

    // 각 그룹의 관계들을 phase_order로 정렬
    Object.values(groups).forEach(group => {
        group.relationships.sort((a, b) => (a.phase_order || 1) - (b.phase_order || 1));
    });

    return groups;
}

/**
 * [Phase 5] 그룹화된 관계 카드 HTML 생성
 */
function generateGroupedRelationshipCard(group, sourceName, targetName, allCharacters, currentCard) {
    const relationships = group.relationships;
    const currentRelationship = relationships[0]; // 기본적으로 첫 번째 관계 표시
    const totalPhases = relationships.length;

    // 간결한 설명 표시
    const shortDescription = currentRelationship.description
        ? (currentRelationship.description.length > 60 ? currentRelationship.description.substring(0, 60) + '...' : currentRelationship.description)
        : '설명 없음';

    return `
        <div class="relationship-card-grouped" data-group-key="${[group.sourceId, group.targetId].sort().join('-')}">
            <div class="relationship-card-header">
                <div class="character-names">
                    <span class="source-name">${sourceName}</span>
                    <span class="arrow">↔</span>
                    <span class="target-name">${targetName}</span>
                </div>
            </div>

            <div class="relationship-card-content">
                <div class="relationship-type" data-phase="1">${currentRelationship.type}</div>
                <div class="relationship-description" data-phase="1">${shortDescription}</div>
                <div class="phase-badge">단계 1</div>
            </div>

            <div class="relationship-card-footer">
                <div class="phase-navigation">
                    <button class="phase-nav-btn prev-btn" ${totalPhases <= 1 ? 'disabled' : ''} title="이전 단계">
                        <i data-lucide="chevron-left"></i>
                    </button>
                    <span class="phase-indicator">1 / ${totalPhases}</span>
                    <button class="phase-nav-btn next-btn" ${totalPhases <= 1 ? 'disabled' : ''} title="다음 단계">
                        <i data-lucide="chevron-right"></i>
                    </button>
                </div>

                <div class="relationship-actions">
                    <button class="edit-rel-btn icon-only" data-id="${currentRelationship.id}" title="수정">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="delete-rel-btn icon-only" data-id="${currentRelationship.id}" title="삭제">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>

            <!-- 숨겨진 관계 데이터 -->
            <div class="relationship-data" style="display: none;">
                ${relationships.map((rel, index) => `
                    <div class="phase-data"
                         data-phase="${index + 1}"
                         data-id="${rel.id}"
                         data-type="${rel.type}"
                         data-description="${rel.description || '설명 없음'}"
                         data-phase-order="${rel.phase_order || 1}">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * [Phase 5] 단계 전환 이벤트 설정
 */
function setupPhaseSwitcherEvents() {
    // 이벤트 위임을 사용해서 동적으로 생성되는 요소들도 처리
    document.addEventListener('click', (e) => {
        const target = e.target;

        // 이전 단계 버튼
        if (target.classList.contains('prev-btn') || target.closest('.prev-btn')) {
            e.stopPropagation();
            const card = target.closest('.relationship-card-grouped');
            if (card) switchRelationshipPhase(card, -1);
        }

        // 다음 단계 버튼
        if (target.classList.contains('next-btn') || target.closest('.next-btn')) {
            e.stopPropagation();
            const card = target.closest('.relationship-card-grouped');
            if (card) switchRelationshipPhase(card, 1);
        }
    });
}

/**
 * [Phase 5] 관계 단계 전환
 */
function switchRelationshipPhase(card, direction) {
    const phaseIndicator = card.querySelector('.phase-indicator');
    const currentText = phaseIndicator.textContent;
    const [current, total] = currentText.split(' / ').map(Number);

    let newPhase = current + direction;

    // 범위 체크
    if (newPhase < 1) newPhase = total;
    if (newPhase > total) newPhase = 1;

    // UI 업데이트
    updateRelationshipCardPhase(card, newPhase, total);

    // 액션 버튼 업데이트 (현재 단계의 관계 ID로)
    const phaseData = card.querySelector(`.phase-data[data-phase="${newPhase}"]`);
    if (phaseData) {
        const relationshipId = phaseData.dataset.id;
        const actionButtons = card.querySelectorAll('.relationship-actions button');
        actionButtons.forEach(btn => {
            btn.dataset.id = relationshipId;
        });
    }
}

/**
 * [Phase 5] 관계 카드의 단계별 내용 업데이트
 */
function updateRelationshipCardPhase(card, phaseNumber, totalPhases) {
    // 단계 표시기 업데이트
    const phaseIndicator = card.querySelector('.phase-indicator');
    phaseIndicator.textContent = `${phaseNumber} / ${totalPhases}`;

    // 관계 데이터 가져오기
    const phaseData = card.querySelector(`.phase-data[data-phase="${phaseNumber}"]`);
    if (!phaseData) return;

    const type = phaseData.dataset.type;
    const description = phaseData.dataset.description;
    const phaseOrder = phaseData.dataset.phaseOrder;

    // 간결한 설명 표시
    const shortDescription = description.length > 60
        ? description.substring(0, 60) + '...'
        : description;

    // 내용 업데이트
    const typeElement = card.querySelector('.relationship-card-content .relationship-type');
    const descElement = card.querySelector('.relationship-card-content .relationship-description');
    const badgeElement = card.querySelector('.relationship-card-content .phase-badge');

    // 업데이트 중 클래스 추가 (애니메이션용)
    card.classList.add('updating');

    // 내용 변경
    if (typeElement) typeElement.textContent = type;
    if (descElement) descElement.textContent = shortDescription;
    if (badgeElement) badgeElement.textContent = `단계 ${phaseOrder}`;

    // 애니메이션이 끝난 후 클래스 제거
    setTimeout(() => {
        card.classList.remove('updating');
    }, 400);
}
