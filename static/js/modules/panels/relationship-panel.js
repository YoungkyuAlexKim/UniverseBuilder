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
export function showRelationshipPanel(projectId, currentCard) {
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    const allCharacters = project.groups.flatMap(g => g.cards);
    const otherCharacters = allCharacters.filter(c => c.id !== currentCard.id);
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
                <div id="relationship-graph" style="height: 400px; border: 1px solid #30363d; border-radius: 6px; background-color: #0d1117;"></div>

                <form id="relationship-form" class="relationship-form">
                    <input type="hidden" name="relationship_id" value="">
                    <fieldset id="relationship-fieldset">
                        <legend><strong><i data-lucide="plus-circle"></i>새 관계 추가 / 수정</strong></legend>
                        <div class="grid">
                            <label for="target-character-select">
                                대상
                                <select id="target-character-select" name="target_character_id" required>
                                    <option value="" disabled selected>캐릭터 선택...</option>
                                    ${otherCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                            </label>
                            <label for="relationship-type">
                                관계 유형
                                <input type="text" id="relationship-type" name="type" placeholder="예: 동맹, 적대, 스승..." required>
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
                        <button type="button" id="clear-form-btn" class="secondary outline" style="width: auto;"><i data-lucide="rotate-ccw"></i>초기화</button>
                    </div>
                </form>

                <div>
                    <h4><strong><i data-lucide="list"></i>현재 관계 목록</strong></h4>
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


    const activeRelationships = relationships.filter(r =>
        r.source_character_id === currentCard.id || r.target_character_id === currentCard.id
    );

    const relatedCharacterIds = new Set([currentCard.id]);
    activeRelationships.forEach(r => {
        relatedCharacterIds.add(r.source_character_id);
        relatedCharacterIds.add(r.target_character_id);
    });

    const nodes = new vis.DataSet(
        Array.from(relatedCharacterIds).map(charId => {
            const character = allCharacters.find(c => c.id === charId);
            return {
                id: character.id,
                label: character.name,
                shape: 'box',
                color: character.id === currentCard.id ? '#F59E0B' : '#58a6ff',
                font: { color: '#ffffff' },
                margin: 10,
                shapeProperties: {
                    borderRadius: 6
                }
            };
        })
    );

    const relationshipPairs = new Map();
    activeRelationships.forEach(r => {
        const ids = [r.source_character_id, r.target_character_id].sort();
        const key = ids.join('-');
        if (!relationshipPairs.has(key)) {
            relationshipPairs.set(key, []);
        }
        relationshipPairs.get(key).push(r);
    });

    const edges = new vis.DataSet(activeRelationships.map(r => {
        const ids = [r.source_character_id, r.target_character_id].sort();
        const key = ids.join('-');
        const pair = relationshipPairs.get(key);

        const edgeObject = {
            id: r.id,
            from: r.source_character_id,
            to: r.target_character_id,
            label: r.type,
            title: r.description || r.type,
            arrows: 'to',
            color: getRelationshipColor(r.type),
        };

        if (pair && pair.length > 1) {
            const curveDirection = r.source_character_id === ids[0] ? 'curvedCCW' : 'curvedCW';
            edgeObject.smooth = {
                type: curveDirection,
                roundness: 0.35
            };
        }

        return edgeObject;
    }));

    const container = panel.querySelector('#relationship-graph');
    const data = { nodes, edges };

    const options = {
        layout: { hierarchical: false },
        edges: {
            color: { inherit: false },
            smooth: {
                enabled: true,
                type: "dynamic"
            }
        },
        physics: {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
                springLength: 200,
                avoidOverlap: 0.3
            },
            stabilization: {
                iterations: 200
            }
        },
        interaction: {
            hover: true,
            dragNodes: true,
            dragView: true,
            zoomView: true
        },
        nodes: {
            font: {
                size: 14,
                face: 'sans-serif'
            },
            borderWidth: 1,
        }
    };
    const network = new vis.Network(container, data, options);

    network.on("stabilized", function (params) {
        network.setOptions( { physics: false } );
    });

    const form = panel.querySelector('#relationship-form');
    const listContainer = panel.querySelector('#relationship-list-container');
    const aiSuggestBtn = panel.querySelector('#ai-suggest-rel-btn');
    const aiFieldset = panel.querySelector('#ai-suggestion-fieldset');

    const renderRelationshipList = () => {
        if (activeRelationships.length === 0) {
            listContainer.innerHTML = '<p>아직 설정된 관계가 없습니다.</p>';
            return;
        }

        listContainer.innerHTML = activeRelationships.map(r => {
            const sourceName = allCharacters.find(c => c.id === r.source_character_id)?.name || '알 수 없음';
            const targetName = allCharacters.find(c => c.id === r.target_character_id)?.name || '알 수 없음';
            const descriptionHTML = r.description ? `<p>${r.description}</p>` : '<p>세부 설명 없음</p>';

            return `
                <div class="relationship-card">
                    <div class="relationship-card-header">
                        <h6><strong>${sourceName}</strong> → <strong>${targetName}</strong> : ${r.type}</h6>
                        <div class="relationship-card-header-buttons">
                            <button class="secondary outline edit-rel-btn icon-only" data-id="${r.id}" title="수정"><i data-lucide="edit-3"></i></button>
                            <button class="secondary outline delete-rel-btn icon-only" data-id="${r.id}" title="삭제"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                    <div class="relationship-card-body">
                        ${descriptionHTML}
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    };

    const clearForm = () => {
        form.reset();
        form.elements.relationship_id.value = '';
        form.elements.target_character_id.disabled = false;
        tendencyLabel.textContent = '중립';
    };

    const fillFormWithRelationship = (rel) => {
        if (!rel) return;
        form.elements.relationship_id.value = rel.id;

        const targetId = rel.source_character_id === currentCard.id
            ? rel.target_character_id
            : rel.source_character_id;

        form.elements.target_character_id.value = targetId;
        form.elements.target_character_id.disabled = true;
        form.elements.type.value = rel.type;
        form.elements.description.value = rel.description || '';
        form.scrollIntoView({ behavior: 'smooth' });
    }

    panel.querySelector('#clear-form-btn').addEventListener('click', clearForm);

    aiSuggestBtn.addEventListener('click', async () => {
        const targetCharacterId = form.elements.target_character_id.value;
        if (!targetCharacterId) {
            alert('먼저 대상 캐릭터를 선택해주세요.');
            return;
        }

        aiSuggestBtn.setAttribute('aria-busy', 'true');
        aiFieldset.disabled = true;

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
            aiFieldset.disabled = false;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.setAttribute('aria-busy', 'true');

        const relationshipId = form.elements.relationship_id.value;
        const targetId = form.elements.target_character_id.value;

        const relationshipData = {
            source_character_id: currentCard.id,
            target_character_id: targetId,
            type: form.elements.type.value.trim(),
            description: form.elements.description.value.trim()
        };

        try {
            if (relationshipId) {
                const updateData = { type: relationshipData.type, description: relationshipData.description };
                await api.updateRelationship(projectId, relationshipId, updateData);
                alert('관계가 성공적으로 수정되었습니다.');
            } else {
                await api.createRelationship(projectId, relationshipData);
                alert('새로운 관계가 생성되었습니다.');
            }
            clearForm();
            closePanel();
            // [수정] stateManager를 통해 상태 갱신 요청
            await app.stateManager.refreshCurrentProject();
        } catch (error) {
            console.error('관계 저장 실패:', error);
            alert(`오류: ${error.message}`);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
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
            const relToEdit = relationships.find(r => r.id === relationshipId);
            fillFormWithRelationship(relToEdit);
        }
    });

    network.on('click', function(params) {
        if (params.edges.length > 0) {
            const clickedEdgeId = params.edges[0];
            const relationship = relationships.find(r => r.id === clickedEdgeId);
            fillFormWithRelationship(relationship);
        }
    });

    renderRelationshipList();
}
