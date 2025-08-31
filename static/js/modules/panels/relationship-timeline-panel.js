// FILE: relationship-timeline-panel.js
/**
 * 관계 타임라인 패널의 생성 및 관리 로직을 담당하는 모듈
 * 기존 relationship-panel.js와 별개로 새로운 타임라인 기반 UI를 제공
 */

import * as api from '../api.js';

// DOM Elements
const cardDetailsModal = document.getElementById('card-details-modal');

// App 인스턴스를 저장할 변수
let app;

/**
 * 관계 타임라인 패널 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeRelationshipTimelinePanel(appInstance) {
    app = appInstance;
}

/**
 * 관계 타임라인 패널을 표시합니다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} currentCard - 현재 선택된 캐릭터
 * @param {string} relationshipId - 관계 ID (선택적)
 */
export async function showRelationshipTimelinePanel(projectId, currentCard, relationshipId = null) {
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel, .relationship-timeline-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    // StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
    let project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    // 프로젝트 상세 데이터가 로드되지 않았으면 로드 대기
    if (!project.isDetailLoaded) {
        try {
            const loadSuccess = await app.stateManager.loadProjectDetailsInList(projectId);
            if (!loadSuccess) {
                console.error('프로젝트 상세 데이터 로드 실패');
                alert('프로젝트 데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
                return;
            }
            const updatedState = app.stateManager.getState();
            project = updatedState.projects.find(p => p.id === projectId);
        } catch (error) {
            console.error('프로젝트 상세 데이터 로드 중 예외 발생:', error);
            alert('프로젝트 데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
            return;
        }
    }

    const allCharacters = project.groups ? project.groups.flatMap(g => g.cards || []) : [];
    const otherCharacters = allCharacters.filter(c => c.id !== currentCard.id);

    const panel = document.createElement('div');
    panel.className = 'relationship-timeline-panel';

    // 특정 관계가 선택된 경우와 그렇지 않은 경우에 따라 다른 UI 표시
    if (relationshipId) {
        await showRelationshipTimelineDetail(projectId, currentCard, relationshipId, panel, allCharacters);
    } else {
        await showRelationshipTimelineList(projectId, currentCard, panel, allCharacters, otherCharacters);
    }

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
}

/**
 * 관계 목록을 보여주는 타임라인 패널
 */
async function showRelationshipTimelineList(projectId, currentCard, panel, allCharacters, otherCharacters) {
    const relationships = project.relationships || [];

    panel.innerHTML = `
        <article style="height: 100%; display: flex; flex-direction: column;">
            <header style="display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <hgroup style="margin-bottom: 0;">
                    <h3><strong>${currentCard.name}</strong>의 관계 타임라인</h3>
                    <p style="margin: 0; font-size: 0.9em; color: var(--text-secondary);">시간의 흐름에 따른 관계 변화를 관리하세요</p>
                </hgroup>
                <a href="#close" aria-label="Close" class="close"></a>
            </header>

            <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                <div class="timeline-container">
                    ${relationships.length === 0
                        ? '<div class="empty-state"><p>아직 설정된 관계가 없습니다.<br>새로운 관계를 추가해보세요.</p></div>'
                        : `
                            <div class="relationship-grid">
                                ${await generateRelationshipTimelineGrid(relationships, allCharacters, currentCard)}
                            </div>
                        `
                    }
                </div>

                <div class="timeline-actions">
                    <button type="button" id="add-relationship-btn" class="primary">
                        <i data-lucide="plus"></i>새 관계 추가
                    </button>
                </div>
            </div>
        </article>
    `;

    // 이벤트 리스너 설정
    setupTimelineListEvents(panel, projectId, currentCard, allCharacters);
}

/**
 * 관계 타임라인 목록 HTML 생성
 */
async function generateRelationshipTimelineList(relationships, allCharacters, currentCard) {
    // [Phase 5] 관계들을 그룹화하여 표시 (관계 방향 고려)
    const groupedRelationships = groupRelationshipsByCharacterPair(relationships, currentCard.id);
    let html = '';

    for (const group of Object.values(groupedRelationships)) {
        const sourceChar = allCharacters.find(c => c.id === group.sourceId);
        const targetChar = allCharacters.find(c => c.id === group.targetId);
        const sourceName = sourceChar ? sourceChar.name : '알 수 없음';
        const targetName = targetChar ? targetChar.name : '알 수 없음';

        // 대표 관계 (첫 번째 관계)
        const representativeRelationship = group.relationships[0];

        html += `
            <div class="timeline-relationship-card" data-relationship-id="${representativeRelationship.id}">
                <div class="relationship-header">
                    <div class="character-info">
                        <strong>${sourceName}</strong> → <strong>${targetName}</strong>
                    </div>
                    <div class="relationship-current-phase">
                        단계: ${representativeRelationship.phase_order || 1} / ${group.relationships.length}
                    </div>
                </div>

                <div class="timeline-phases">
                    ${await generateGroupedPhaseTimeline(group, allCharacters)}
                </div>

                <div class="relationship-actions">
                    <button class="secondary outline view-timeline-btn" data-relationship-id="${representativeRelationship.id}">
                        <i data-lucide="timeline"></i>타임라인 보기
                    </button>
                    <button class="secondary outline edit-relationship-btn" data-relationship-id="${representativeRelationship.id}">
                        <i data-lucide="edit-3"></i>관계 편집
                    </button>
                </div>
            </div>
        `;
    }

    return html;
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
 * [Phase 5] 그룹화된 관계의 단계 타임라인 생성
 */
async function generateGroupedPhaseTimeline(group, allCharacters) {
    let phasesHTML = '';

    for (const relationship of group.relationships) {
        const phases = await api.getRelationshipPhases(relationship.id);

        if (phases.length === 0) {
            phasesHTML += '<div class="phase-empty">단계 정보가 없습니다.</div>';
        } else {
            // 각 관계의 단계들을 표시
            phasesHTML += `<div class="relationship-phase-group">
                <div class="phase-group-header">단계 ${relationship.phase_order || 1}: ${relationship.type}</div>
                <div class="phase-group-content">
                    ${generatePhaseTimeline(phases)}
                </div>
            </div>`;
        }
    }

    return phasesHTML || '<div class="phase-empty">단계 정보가 없습니다.</div>';
}

/**
 * [Phase 4] 관계 목록 그리드 HTML 생성
 */
async function generateRelationshipTimelineGrid(relationships, allCharacters, currentCard) {
    let html = '';

    for (const relationship of relationships) {
        const otherCharacter = allCharacters.find(c => c.id === (relationship.source_character_id === currentCard.id ? relationship.target_character_id : relationship.source_character_id));
        if (!otherCharacter) continue;

        // 관계 단계들 가져오기
        const phases = await api.getRelationshipPhases(relationship.id);

        // 간결한 설명 표시
        const shortDescription = relationship.description
            ? (relationship.description.length > 60 ? relationship.description.substring(0, 60) + '...' : relationship.description)
            : '설명 없음';

        html += `
            <div class="relationship-card-compact" data-relationship-id="${relationship.id}">
                <div class="relationship-card-header">
                    <div class="character-names">
                        <span class="source-name">${currentCard.name}</span>
                        <span class="arrow">↔</span>
                        <span class="target-name">${otherCharacter.name}</span>
                    </div>
                    <span class="phase-badge">단계 ${relationship.phase_order || 1}</span>
                </div>
                <div class="relationship-type">${relationship.type}</div>
                <div class="relationship-description">${shortDescription}</div>
                <div class="phase-count">총 ${phases.length}단계</div>
                <div class="relationship-actions">
                    <button class="secondary outline view-timeline-btn icon-only" data-relationship-id="${relationship.id}" title="타임라인 보기">
                        <i data-lucide="timeline"></i>
                    </button>
                    <button class="secondary outline edit-relationship-btn icon-only" data-relationship-id="${relationship.id}" title="관계 편집">
                        <i data-lucide="edit-3"></i>
                    </button>
                </div>
            </div>
        `;
    }

    return html;
}

/**
 * 관계 단계 타임라인 HTML 생성
 */
function generatePhaseTimeline(phases) {
    return phases.map(phase => `
        <div class="phase-item" data-phase-id="${phase.id}">
            <div class="phase-header">
                <span class="phase-number">${phase.phase_order}</span>
                <span class="phase-type">${phase.type}</span>
            </div>
            ${phase.description ? `<div class="phase-description">${phase.description}</div>` : ''}
            ${phase.trigger_description ? `<div class="phase-trigger">계기: ${phase.trigger_description}</div>` : ''}
        </div>
    `).join('');
}

/**
 * 타임라인 목록 이벤트 설정
 */
function setupTimelineListEvents(panel, projectId, currentCard, allCharacters) {
    // 새 관계 추가 버튼
    panel.querySelector('#add-relationship-btn')?.addEventListener('click', () => {
        // 간단한 관계 생성 폼 표시
        showRelationshipCreationForm(panel, projectId, currentCard, allCharacters);
    });

    // 타임라인 보기 버튼들
    panel.querySelectorAll('.view-timeline-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const relationshipId = e.currentTarget.dataset.relationshipId;
            showRelationshipTimelinePanel(projectId, currentCard, relationshipId);
        });
    });

    // 관계 편집 버튼들
    panel.querySelectorAll('.edit-relationship-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const relationshipId = e.currentTarget.dataset.relationshipId;
            // 기존 관계 편집 기능 (나중에 구현)
            alert('관계 편집 기능은 곧 추가될 예정입니다.');
        });
    });
}

/**
 * 관계 생성 폼 표시
 */
function showRelationshipCreationForm(panel, projectId, currentCard, allCharacters) {
    const otherCharacters = allCharacters.filter(c => c.id !== currentCard.id);

    const formContainer = document.createElement('div');
    formContainer.className = 'relationship-creation-form';
    formContainer.innerHTML = `
        <div class="form-overlay">
            <div class="form-content">
                <h4>새 관계 추가</h4>
                <form id="relationship-create-form">
                    <label>
                        상대 캐릭터
                        <select name="target_character_id" required>
                            <option value="">선택하세요...</option>
                            ${otherCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </label>
                    <label>
                        관계 유형
                        <input type="text" name="type" placeholder="예: 친구, 라이벌, 가족" required>
                    </label>
                    <label>
                        관계 설명
                        <textarea name="description" rows="3" placeholder="관계에 대한 설명을 입력하세요"></textarea>
                    </label>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">취소</button>
                        <button type="submit">관계 추가</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    panel.appendChild(formContainer);

    // 폼 이벤트 설정
    const form = formContainer.querySelector('#relationship-create-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const relationshipData = {
            source_character_id: currentCard.id,
            target_character_id: formData.get('target_character_id'),
            type: formData.get('type'),
            description: formData.get('description'),
            phase_order: 1
        };

        try {
            await api.createRelationship(projectId, relationshipData);
            formContainer.remove();
            // 패널 새로고침
            showRelationshipTimelinePanel(projectId, currentCard);
        } catch (error) {
            alert(`관계 추가 실패: ${error.message}`);
        }
    });

    formContainer.querySelector('.cancel-btn').addEventListener('click', () => {
        formContainer.remove();
    });
}

/**
 * 관계 상세 타임라인 표시
 */
async function showRelationshipTimelineDetail(projectId, currentCard, relationshipId, panel, allCharacters) {
    try {
        // 관계 정보 가져오기
        const relationships = await api.getProjectDetails(projectId).then(data => data.relationships || []);
        const relationship = relationships.find(r => r.id === relationshipId);

        if (!relationship) {
            alert('관계를 찾을 수 없습니다.');
            return;
        }

        const otherCharacter = allCharacters.find(c => c.id === (relationship.source_character_id === currentCard.id ? relationship.target_character_id : relationship.source_character_id));

        // 관계 단계들 가져오기
        const phases = await api.getRelationshipPhases(relationshipId);

        panel.innerHTML = `
            <article style="height: 100%; display: flex; flex-direction: column;">
                <header style="display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <hgroup style="margin-bottom: 0;">
                        <h3><strong>${currentCard.name}</strong> ↔ <strong>${otherCharacter.name}</strong></h3>
                        <p style="margin: 0; font-size: 0.9em; color: var(--text-secondary);">${relationship.type}</p>
                    </hgroup>
                    <a href="#close" aria-label="Close" class="close"></a>
                </header>

                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                    <div class="timeline-detail-container">
                        ${generateDetailedPhaseTimeline(phases)}
                    </div>

                    <div class="timeline-actions">
                        <button type="button" id="add-phase-btn" class="primary">
                            <i data-lucide="plus"></i>새 단계 추가
                        </button>
                        <button type="button" id="back-to-list-btn" class="secondary outline">
                            <i data-lucide="arrow-left"></i>목록으로 돌아가기
                        </button>
                    </div>
                </div>
            </article>
        `;

        // 이벤트 설정
        setupTimelineDetailEvents(panel, projectId, currentCard, relationshipId);

    } catch (error) {
        console.error('관계 타임라인 로드 실패:', error);
        alert('관계 타임라인을 불러오는 중 오류가 발생했습니다.');
    }
}

/**
 * 상세 단계 타임라인 HTML 생성
 */
function generateDetailedPhaseTimeline(phases) {
    if (phases.length === 0) {
        return '<div class="empty-state"><p>아직 관계 단계가 설정되지 않았습니다.<br>첫 번째 단계를 추가해보세요.</p></div>';
    }

    return `
        <div class="detailed-timeline">
            ${phases.map((phase, index) => `
                <div class="timeline-phase-card" data-phase-id="${phase.id}">
                    <div class="phase-header">
                        <div class="phase-number">${phase.phase_order}</div>
                        <div class="phase-title">${phase.type}</div>
                        <div class="phase-actions">
                            <button class="edit-phase-btn" data-phase-id="${phase.id}">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="delete-phase-btn" data-phase-id="${phase.id}">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>

                    <div class="phase-content">
                        ${phase.description ? `<div class="phase-description">${phase.description}</div>` : ''}
                        ${phase.trigger_description ? `<div class="phase-trigger"><strong>변화 계기:</strong> ${phase.trigger_description}</div>` : ''}

                        ${(phase.source_to_target_address || phase.source_to_target_tone || phase.target_to_source_address || phase.target_to_source_tone) ? `
                            <div class="phase-communication">
                                <h5>호칭 및 말투</h5>
                                ${phase.source_to_target_address ? `<div><strong>${currentCard.name}의 호칭:</strong> ${phase.source_to_target_address}</div>` : ''}
                                ${phase.source_to_target_tone ? `<div><strong>${currentCard.name}의 말투:</strong> ${phase.source_to_target_tone}</div>` : ''}
                                ${phase.target_to_source_address ? `<div><strong>상대방 호칭:</strong> ${phase.target_to_source_address}</div>` : ''}
                                ${phase.target_to_source_tone ? `<div><strong>상대방 말투:</strong> ${phase.target_to_source_tone}</div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * 타임라인 상세 이벤트 설정
 */
function setupTimelineDetailEvents(panel, projectId, currentCard, relationshipId) {
    // 새 단계 추가 버튼
    panel.querySelector('#add-phase-btn')?.addEventListener('click', () => {
        showPhaseCreationForm(panel, projectId, relationshipId);
    });

    // 목록으로 돌아가기 버튼
    panel.querySelector('#back-to-list-btn')?.addEventListener('click', () => {
        showRelationshipTimelinePanel(projectId, currentCard);
    });

    // 단계 편집 버튼들
    panel.querySelectorAll('.edit-phase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const phaseId = e.currentTarget.dataset.phaseId;
            // 단계 편집 기능 (나중에 구현)
            alert('단계 편집 기능은 곧 추가될 예정입니다.');
        });
    });

    // 단계 삭제 버튼들
    panel.querySelectorAll('.delete-phase-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const phaseId = e.currentTarget.dataset.phaseId;
            if (confirm('이 관계 단계를 삭제하시겠습니까?')) {
                try {
                    await api.deleteRelationshipPhase(projectId, relationshipId, phaseId);
                    showRelationshipTimelinePanel(projectId, currentCard, relationshipId);
                } catch (error) {
                    alert(`단계 삭제 실패: ${error.message}`);
                }
            }
        });
    });
}

/**
 * 단계 생성 폼 표시
 */
function showPhaseCreationForm(panel, projectId, relationshipId) {
    const formContainer = document.createElement('div');
    formContainer.className = 'phase-creation-form';
    formContainer.innerHTML = `
        <div class="form-overlay">
            <div class="form-content">
                <h4>새 관계 단계 추가</h4>
                <form id="phase-create-form">
                    <label>
                        단계 번호
                        <input type="number" name="phase_order" min="1" value="1" required>
                    </label>
                    <label>
                        관계 유형
                        <input type="text" name="type" placeholder="예: 친구, 라이벌, 가족" required>
                    </label>
                    <label>
                        단계 설명
                        <textarea name="description" rows="3" placeholder="이 단계에서의 관계를 설명하세요" required></textarea>
                    </label>
                    <label>
                        변화 계기
                        <textarea name="trigger_description" rows="2" placeholder="어떤 사건으로 이 단계로 변화했나요?"></textarea>
                    </label>

                    <fieldset>
                        <legend>호칭 및 말투 (선택)</legend>
                        <label>
                            상대방을 부르는 호칭
                            <input type="text" name="source_to_target_address" placeholder="예: '형', '선생님'">
                        </label>
                        <label>
                            상대방에게 말하는 말투
                            <textarea name="source_to_target_tone" rows="2" placeholder="예: 정중하고 예의바른 말투로 이야기한다"></textarea>
                        </label>
                        <label>
                            상대방이 나를 부르는 호칭
                            <input type="text" name="target_to_source_address" placeholder="예: '얘야', '학생'">
                        </label>
                        <label>
                            상대방이 나에게 말하는 말투
                            <textarea name="target_to_source_tone" rows="2" placeholder="예: 친근하고 장난스러운 말투로 이야기한다"></textarea>
                        </label>
                    </fieldset>

                    <div class="form-actions">
                        <button type="button" class="cancel-btn">취소</button>
                        <button type="submit">단계 추가</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    panel.appendChild(formContainer);

    // 폼 이벤트 설정
    const form = formContainer.querySelector('#phase-create-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const phaseData = {
            relationship_id: relationshipId,
            phase_order: parseInt(formData.get('phase_order')),
            type: formData.get('type'),
            description: formData.get('description'),
            trigger_description: formData.get('trigger_description'),
            source_to_target_address: formData.get('source_to_target_address'),
            source_to_target_tone: formData.get('source_to_target_tone'),
            target_to_source_address: formData.get('target_to_source_address'),
            target_to_source_tone: formData.get('target_to_source_tone')
        };

        try {
            await api.createRelationshipPhase(projectId, relationshipId, phaseData);
            formContainer.remove();
            // 현재 타임라인 패널 새로고침
            const currentCard = { id: 'current-card-id' }; // 실제로는 현재 카드 정보를 가져와야 함
            showRelationshipTimelinePanel(projectId, currentCard, relationshipId);
        } catch (error) {
            alert(`단계 추가 실패: ${error.message}`);
        }
    });

    formContainer.querySelector('.cancel-btn').addEventListener('click', () => {
        formContainer.remove();
    });
}
