// FILE: panels.js

/**
 * AI 수정, 수동 편집, 관계도 패널의 생성 및 관리 로직을 담당하는 모듈
 */
import * as api from './api.js';
import * as ui from './ui.js';
import { showAiDiffModal, closeModal } from './modals.js';

// DOM Elements
const cardDetailsModal = document.getElementById('card-details-modal');
const worldviewCardModal = document.getElementById('worldview-card-modal');

// Handlers from main.js
let getProjects, showProjectDetails, getLastGeneratedCard, setLastGeneratedCard;

export function initializePanels(handlers) {
    getProjects = handlers.getProjects;
    showProjectDetails = handlers.showProjectDetails;
    getLastGeneratedCard = handlers.getLastGeneratedCard;
    setLastGeneratedCard = handlers.setLastGeneratedCard;
}

export function showCharacterGeneratorUI(projectId, container) {
    const existingGenerator = container.querySelector('#character-generator-inline');
    if (existingGenerator) return;

    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const generatorContainer = document.createElement('article');
    generatorContainer.id = 'character-generator-inline';
    generatorContainer.style.marginTop = '2rem';

    const characterCheckboxesHTML = project.groups.map(group => {
        const cardsHTML = (group.cards && group.cards.length > 0)
            ? group.cards.map(card => `
                <label>
                    <input type="checkbox" name="context-character" value="${card.id}">
                    ${card.name}
                </label>
            `).join('')
            : '<small>없음</small>';
        
        return `<fieldset><legend>${group.name}</legend>${cardsHTML}</fieldset>`;
    }).join('');

    const worldviewCardsCheckboxesHTML = (project.worldview_groups || []).map(group => `
        <fieldset>
            <legend>${group.name}</legend>
            ${(group.worldview_cards || []).map(card => `
                <label>
                    <input type="checkbox" name="context-worldview-card" value="${card.id}">
                    ${card.title}
                </label>
            `).join('')}
        </fieldset>
    `).join('');

    const saveGroupOptionsHTML = project.groups.map(group => `<option value="${group.id}">${group.name}</option>`).join('');

    generatorContainer.innerHTML = `
        <header style="display: flex; justify-content: space-between; align-items: center;">
            <hgroup style="margin-bottom: 0;"><h4>새 인물 AI 생성</h4><h6>현재 프로젝트의 맥락을 사용하여 새로운 인물을 생성합니다.</h6></hgroup>
            <a href="#close" aria-label="Close" class="close"></a>
        </header>
        <div class="grid"><label for="character-keywords">키워드<input type="text" id="character-keywords" placeholder="예: 몰락한 왕국의 마지막 기사" autocomplete="off"></label></div>
        <fieldset><legend>세계관 설정 반영 강도</legend>
            <label><input type="radio" name="worldview-level" value="none" checked> 최소</label>
            <label><input type="radio" name="worldview-level" value="low"> 낮음</label>
            <label><input type="radio" name="worldview-level" value="medium"> 중간</label>
            <label><input type="radio" name="worldview-level" value="high"> 높음</label>
        </fieldset>
        <details>
            <summary>고급 컨텍스트 선택</summary>
            <div class="grid">
                <div>
                  <fieldset><legend><strong>참고할 캐릭터 선택</strong></legend></fieldset>
                  <div class="checkbox-container">${characterCheckboxesHTML || '<small>없음</small>'}</div>
                </div>
                <div>
                  <fieldset><legend>참고할 서브 설정</legend></fieldset>
                  <div class="checkbox-container">${worldviewCardsCheckboxesHTML || '<small>없음</small>'}</div>
                </div>
            </div>
        </details>
        <button id="generate-character-btn" style="margin-top: 1rem;">생성하기</button>
        <div id="character-result-card" class="card" style="display: none; margin-top: 1rem;">
            <article>
                <header><strong id="char-card-name"></strong></header>
                <p id="char-card-desc"></p>
                <p><strong class="label">성격:</strong> <span id="char-card-personality"></span></p>
                <p><strong class="label">능력:</strong> <span id="char-card-abilities"></span></p>
                <p><strong class="label">목표:</strong> <span id="char-card-goal"></span></p>
                <div id="char-card-quote-container"></div>
                <hr><p><strong class="label">등장 서사:</strong></p><p id="char-card-story"></p>
                <footer>
                    <div class="grid">
                        <select id="save-to-group-select" required><option value="" disabled selected>저장할 그룹 선택...</option>${saveGroupOptionsHTML}</select>
                        <div></div>
                    </div>
                    <div class="grid">
                        <button id="reroll-character-btn" class="secondary">다시 생성 (Reroll)</button>
                        <button id="save-character-btn">이 프로젝트에 저장</button>
                    </div>
                </footer>
            </article>
        </div>
    `;

    container.appendChild(generatorContainer);

    const generateBtn = generatorContainer.querySelector('#generate-character-btn');
    const rerollBtn = generatorContainer.querySelector('#reroll-character-btn');
    const saveBtn = generatorContainer.querySelector('#save-character-btn');
    const closeBtn = generatorContainer.querySelector('.close');

    generateBtn.addEventListener('click', () => handleGenerateClick(projectId, generatorContainer));
    rerollBtn.addEventListener('click', () => handleGenerateClick(projectId, generatorContainer));
    saveBtn.addEventListener('click', () => handleSaveClick(projectId, generatorContainer));

    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        generatorContainer.remove();
    });
}

async function handleGenerateClick(projectId, generatorContainer) {
    const keywordsInput = generatorContainer.querySelector('#character-keywords');
    const resultCard = generatorContainer.querySelector('#character-result-card');
    const generateBtn = generatorContainer.querySelector('#generate-character-btn');
    const rerollBtn = generatorContainer.querySelector('#reroll-character-btn');
    const keywords = keywordsInput.value;

    if (!keywords) { alert('키워드를 입력해주세요.'); return; }

    generateBtn.setAttribute('aria-busy', 'true');
    rerollBtn.setAttribute('aria-busy', 'true');
    resultCard.style.display = 'none';

    try {
        const projects = getProjects();
        const project = projects.find(p => p.id === projectId);
        const worldviewContext = project.worldview?.content || null;

        const selectedCharacterIds = Array.from(generatorContainer.querySelectorAll('input[name="context-character"]:checked')).map(cb => cb.value);
        const selectedWorldviewCardIds = Array.from(generatorContainer.querySelectorAll('input[name="context-worldview-card"]:checked')).map(cb => cb.value);
        const worldviewLevel = generatorContainer.querySelector('input[name="worldview-level"]:checked')?.value || 'none';

        const requestBody = {
            keywords: keywords,
            character_ids: selectedCharacterIds.length > 0 ? selectedCharacterIds : null,
            worldview_context: worldviewContext,
            worldview_level: worldviewLevel,
            model_name: document.getElementById('ai-model-select').value,
            worldview_card_ids: selectedWorldviewCardIds.length > 0 ? selectedWorldviewCardIds : null,
        };

        const characterData = await api.generateCharacter(projectId, requestBody);
        setLastGeneratedCard(characterData);

        generatorContainer.querySelector('#char-card-name').innerHTML = characterData.name;
        generatorContainer.querySelector('#char-card-desc').innerHTML = characterData.description;
        generatorContainer.querySelector('#char-card-personality').innerHTML = characterData.personality;
        generatorContainer.querySelector('#char-card-abilities').innerHTML = characterData.abilities;
        generatorContainer.querySelector('#char-card-goal').innerHTML = characterData.goal;

        const quoteContainer = generatorContainer.querySelector('#char-card-quote-container');
        let quotesHTML = '';
        if (Array.isArray(characterData.quote) && characterData.quote.length > 0) {
            quotesHTML = `
                <p><strong class="label">대표 대사:</strong></p>
                <ul>
                    ${characterData.quote.map(q => `<li>“${q}”</li>`).join('')}
                </ul>
            `;
        }
        quoteContainer.innerHTML = quotesHTML;

        generatorContainer.querySelector('#char-card-story').innerHTML = characterData.introduction_story;

        resultCard.style.display = 'block';

    } catch (error) {
        console.error('캐릭터 생성 실패:', error);
        alert(`캐릭터 생성에 실패했습니다: ${error.message}`);
    } finally {
        generateBtn.setAttribute('aria-busy', 'false');
        rerollBtn.setAttribute('aria-busy', 'false');
    }
}

async function handleSaveClick(projectId, generatorContainer) {
    const saveGroupSelect = generatorContainer.querySelector('#save-to-group-select');
    const saveBtn = generatorContainer.querySelector('#save-character-btn');
    const selectedGroupId = saveGroupSelect.value;
    const lastGeneratedCard = getLastGeneratedCard();
    
    if (!selectedGroupId) { alert('저장할 그룹을 선택해주세요.'); return; }
    if (!lastGeneratedCard) { alert('먼저 캐릭터를 생성해주세요.'); return; }

    saveBtn.setAttribute('aria-busy', 'true');

    try {
        await api.saveCard(projectId, selectedGroupId, lastGeneratedCard);
        alert('캐릭터 카드가 성공적으로 저장되었습니다!');
        generatorContainer.remove();
        await showProjectDetails(projectId);

    } catch (error) {
        console.error('카드 저장 실패:', error);
        alert(error.message);
    } finally {
        saveBtn.setAttribute('aria-busy', 'false');
    }
}

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

export function showRelationshipPanel(projectId, currentCard) {
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    const projects = getProjects();
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
                        <legend><strong>새 관계 추가 / 수정</strong></legend>
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
                        <legend><strong>AI 추천 옵션</strong></legend>
                        <label for="relationship-keyword">
                            세부 키워드 (선택)
                            <input type="text" id="relationship-keyword" name="keyword" placeholder="예: 애증, 비즈니스 파트너, 오래된 우정...">
                        </label>
                        <label for="relationship-tendency">
                            추천 방향성: <span id="tendency-label">중립</span>
                            <input type="range" id="relationship-tendency" name="tendency" min="-2" max="2" value="0" step="1">
                        </label>
                        <button type="button" id="ai-suggest-rel-btn" class="secondary" style="margin-top: 0.5rem; width: 100%;">✨ AI로 관계 추천받기</button>
                    </fieldset>
                    
                    <div class="grid">
                        <button type="submit">관계 저장</button>
                        <button type="button" id="clear-form-btn" class="secondary outline" style="width: auto;">초기화</button>
                    </div>
                </form>

                <div>
                    <h4><strong>현재 관계 목록</strong></h4>
                    <div id="relationship-list-container"></div>
                </div>
            </div>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        cardDetailsModal.classList.add('shifted');
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
                            <button class="secondary outline edit-rel-btn" data-id="${r.id}">수정</button>
                            <button class="secondary outline delete-rel-btn" data-id="${r.id}">삭제</button>
                        </div>
                    </div>
                    <div class="relationship-card-body">
                        ${descriptionHTML}
                    </div>
                </div>
            `;
        }).join('');
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
            await showProjectDetails(projectId);
        } catch (error) {
            console.error('관계 저장 실패:', error);
            alert(`오류: ${error.message}`);
        } finally {
            button.setAttribute('aria-busy', 'false');
        }
    });

    listContainer.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.matches('.delete-rel-btn')) {
            const relationshipId = target.dataset.id;
            if (confirm("정말로 이 관계를 삭제하시겠습니까?")) {
                try {
                    await api.deleteRelationship(projectId, relationshipId);
                    alert('관계가 삭제되었습니다.');
                    closePanel();
                    await showProjectDetails(projectId);
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

export function handleEditCardAI(event, projectId, cardId) {
    const existingPanel = document.querySelector('.ai-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }
    
    let originalCard = null;
    for (const group of project.groups) {
        const foundCard = group.cards.find(c => c.id === cardId);
        if (foundCard) {
            originalCard = { ...foundCard, group_id: group.id };
            break;
        }
    }
    if (!originalCard) { alert('원본 카드 데이터를 찾을 수 없습니다.'); return; }
    
    const panel = document.createElement('div');
    panel.className = 'ai-edit-panel';

    let characterCheckboxes = '';
    project.groups.forEach(group => {
        characterCheckboxes += `<fieldset><legend>${group.name}</legend>`;
        group.cards.forEach(card => {
            characterCheckboxes += `<label><input type="checkbox" name="selected_cards" value="${card.id}" ${card.id === cardId ? 'checked disabled' : ''}>${card.name}</label>`;
        });
        characterCheckboxes += `</fieldset>`;
    });

    panel.innerHTML = `
        <article>
            <header style="display: flex; justify-content: space-between; align-items: center;"><hgroup style="margin-bottom: 0;"><h3>AI 수정 옵션</h3><p>수정 방향과 참고할 정보를 선택하세요.</p></hgroup><a href="#close" aria-label="Close" class="close"></a></header>
            <form id="ai-edit-form" style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 80px);">
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                    <label for="prompt_text"><strong>요청사항 (프롬프트)</strong></label>
                    <textarea id="prompt_text" name="prompt_text" placeholder="예: 이 캐릭터의 성격을 열혈한 성격으로 바꿔줘." required rows="3"></textarea>
                    <strong>참고할 캐릭터 선택</strong>
                    <div class="checkbox-container">${characterCheckboxes}</div>
                    <fieldset><legend><strong>세계관 설정 반영 강도</strong></legend><div class="grid" style="grid-template-columns: 1fr 1fr;"><label><input type="radio" name="worldview-level" value="none" checked> 최소</label><label><input type="radio" name="worldview-level" value="low"> 낮음</label><label><input type="radio" name="worldview-level" value="medium"> 중간</label><label><input type="radio" name="worldview-level" value="high"> 높음</label></div></fieldset>
                    <fieldset><label for="edit_related_characters"><input type="checkbox" id="edit_related_characters" name="edit_related_characters"><strong>선택한 연관 캐릭터 함께 수정하기</strong><small>(체크 해제 시, 참고만 하고 수정하지 않습니다)</small></label></fieldset>
                </div>
                <footer style="flex-shrink: 0;"><button type="submit" id="submit-ai-edit">수정 제안 받기</button></footer>
            </form>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        cardDetailsModal.classList.add('shifted');
    }, 10);
    
    const closePanel = () => {
        panel.classList.remove('active');
        cardDetailsModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };
    
    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    panel.querySelector('#ai-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.currentTarget.querySelector('#submit-ai-edit');
        submitButton.setAttribute('aria-busy', 'true');
        const formData = new FormData(e.currentTarget);
        const selectedCards = Array.from(panel.querySelectorAll('input[name="selected_cards"]:checked')).map(cb => cb.value);

        try {
            const requestBody = {
                prompt_text: formData.get('prompt_text'),
                model_name: document.getElementById('ai-model-select').value,
                selected_card_ids: selectedCards,
                worldview_level: formData.get('worldview-level'),
                edit_related_characters: formData.get('edit_related_characters') === 'on'
            };
            const aiResult = await api.fetchAiCharacterEdit(projectId, cardId, requestBody);

            closePanel();
            showAiDiffModal(projectId, originalCard, aiResult, 'character');

        } catch (error) {
            console.error('AI 수정 제안 생성 실패:', error);
            alert(error.message);
        } finally {
            submitButton.setAttribute('aria-busy', 'false');
        }
    });
}

export function handleManualEditCard(event, projectId, cardId) {
    event.preventDefault();
    const existingPanel = document.querySelector('.ai-edit-panel, .manual-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    let originalCard = null;
    for (const group of project.groups) {
        const foundCard = group.cards.find(c => c.id === cardId);
        if (foundCard) {
            originalCard = { ...foundCard, group_id: group.id };
            break;
        }
    }
    if (!originalCard) { alert('원본 카드 데이터를 찾을 수 없습니다.'); return; }

    const panel = document.createElement('div');
    panel.className = 'manual-edit-panel';

    panel.innerHTML = `
        <article>
            <header style="display: flex; justify-content: space-between; align-items: center;">
                <hgroup style="margin-bottom: 0;">
                    <h3>캐릭터 정보 수동 편집</h3>
                    <p>${originalCard.name}의 정보를 직접 수정합니다.</p>
                </hgroup>
                <a href="#close" aria-label="Close" class="close"></a>
            </header>
            <form id="manual-edit-form" style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 80px);">
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1.2rem; overflow-y: auto; padding-right: 1rem;">
                    <label for="manual-edit-name"><strong>이름</strong></label>
                    <input type="text" id="manual-edit-name" name="name" value="${originalCard.name || ''}" required>

                    <label for="manual-edit-description"><strong>설명</strong></label>
                    <textarea id="manual-edit-description" name="description" rows="4">${originalCard.description || ''}</textarea>

                    ${ui.createDynamicInputGroupHTML('personality', '성격', originalCard.personality)}
                    ${ui.createDynamicInputGroupHTML('abilities', '능력', originalCard.abilities)}
                    ${ui.createDynamicInputGroupHTML('goal', '목표', originalCard.goal)}
                    ${ui.createDynamicInputGroupHTML('quote', '대표 대사', originalCard.quote)}

                    <label for="manual-edit-story"><strong>등장 서사</strong></label>
                    <textarea id="manual-edit-story" name="introduction_story" rows="5">${originalCard.introduction_story || ''}</textarea>
                </div>
                <footer style="flex-shrink: 0;">
                    <button type="submit" id="submit-manual-edit">변경사항 저장</button>
                </footer>
            </form>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        cardDetailsModal.classList.add('shifted');
    }, 10);

    const closePanel = () => {
        panel.classList.remove('active');
        cardDetailsModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };

    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    panel.querySelectorAll('.add-dynamic-input-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const field = e.target.dataset.field;
            const container = panel.querySelector(`#dynamic-input-container-${field}`);
            const newIndex = container.children.length;
            ui.addDynamicInputField(container, field, '', newIndex);
        });
    });

    panel.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-dynamic-input-btn')) {
            e.target.closest('.dynamic-input-wrapper').remove();
        }
    });

    panel.querySelector('#manual-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const submitButton = form.querySelector('#submit-manual-edit');
        submitButton.setAttribute('aria-busy', 'true');

        const getDynamicFieldValues = (form, fieldName) => {
            const elements = form.elements[fieldName];
            if (!elements) return [];
            const elementsArray = elements.length !== undefined ? Array.from(elements) : [elements];
            return elementsArray.map(input => input.value).filter(Boolean);
        };

        const updatedCardData = {
            id: cardId,
            name: form.elements.name.value,
            description: form.elements.description.value,
            introduction_story: form.elements.introduction_story.value,
            personality: getDynamicFieldValues(form, 'personality'),
            abilities: getDynamicFieldValues(form, 'abilities'),
            goal: getDynamicFieldValues(form, 'goal'),
            quote: getDynamicFieldValues(form, 'quote')
        };

        try {
            await api.updateCard(projectId, cardId, updatedCardData);
            alert('캐릭터 정보가 성공적으로 업데이트되었습니다.');
            closePanel();
            closeModal();
            await showProjectDetails(projectId);

        } catch (error) {
            console.error('수동 편집 저장 실패:', error);
            alert(`저장에 실패했습니다: ${error.message}`);
        } finally {
            submitButton.setAttribute('aria-busy', 'false');
        }
    });
}

export function handleEditWorldviewCardAI(card, projectId) {
    if (!card) {
        alert("먼저 카드를 저장해야 AI 수정을 사용할 수 있습니다.");
        return;
    }

    const existingPanel = document.querySelector('.ai-edit-panel, .relationship-panel');
    if (existingPanel) existingPanel.remove();
    document.querySelectorAll('.shifted').forEach(view => view.classList.remove('shifted'));

    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { alert('프로젝트를 찾을 수 없습니다.'); return; }

    let originalCard = null;
    for (const group of project.worldview_groups) {
        const foundCard = group.worldview_cards.find(c => c.id === card.id);
        if (foundCard) {
            originalCard = { ...foundCard, group_id: group.id };
            break;
        }
    }
    if (!originalCard) { alert('원본 설정 카드 데이터를 찾을 수 없습니다.'); return; }

    const panel = document.createElement('div');
    panel.className = 'ai-edit-panel';

    let worldviewCardCheckboxes = '';
    project.worldview_groups.forEach(group => {
        worldviewCardCheckboxes += `<fieldset><legend>${group.name}</legend>`;
        group.worldview_cards.forEach(c => {
            worldviewCardCheckboxes += `<label><input type="checkbox" name="selected_wv_cards" value="${c.id}" ${c.id === card.id ? 'checked disabled' : ''}>${c.title}</label>`;
        });
        worldviewCardCheckboxes += `</fieldset>`;
    });

    panel.innerHTML = `
        <article>
            <header style="display: flex; justify-content: space-between; align-items: center;"><hgroup style="margin-bottom: 0;"><h3>설정 카드 AI 수정</h3><p>수정 방향과 참고할 정보를 선택하세요.</p></hgroup><a href="#close" aria-label="Close" class="close"></a></header>
            <form id="ai-edit-wv-form" style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 80px);">
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; padding-right: 1rem;">
                    <label for="prompt_text"><strong>요청사항 (프롬프트)</strong></label>
                    <textarea id="prompt_text" name="prompt_text" placeholder="예: 이 설정을 좀 더 전문적인 톤으로 수정해줘." required rows="3"></textarea>
                    <strong>참고할 다른 설정 카드 선택</strong>
                    <div class="checkbox-container">${worldviewCardCheckboxes}</div>
                    <fieldset><legend><strong>메인 세계관 반영 강도</strong></legend><div class="grid" style="grid-template-columns: 1fr 1fr;"><label><input type="radio" name="worldview-level" value="none" checked> 최소</label><label><input type="radio" name="worldview-level" value="low"> 낮음</label><label><input type="radio" name="worldview-level" value="medium"> 중간</label><label><input type="radio" name="worldview-level" value="high"> 높음</label></div></fieldset>
                    <fieldset><label for="edit_related_cards"><input type="checkbox" id="edit_related_cards" name="edit_related_cards"><strong>선택한 연관 설정 함께 수정하기</strong><small>(체크 해제 시, 참고만 하고 수정하지 않습니다)</small></label></fieldset>
                </div>
                <footer style="flex-shrink: 0;"><button type="submit" id="submit-ai-edit-wv">수정 제안 받기</button></footer>
            </form>
        </article>
    `;

    document.querySelector('.main-content').appendChild(panel);
    setTimeout(() => {
        panel.classList.add('active');
        worldviewCardModal.classList.add('shifted');
    }, 10);

    const closePanel = () => {
        panel.classList.remove('active');
        worldviewCardModal.classList.remove('shifted');
        setTimeout(() => panel.remove(), 300);
    };

    panel.querySelector('.close').addEventListener('click', (e) => { e.preventDefault(); closePanel(); });

    panel.querySelector('#ai-edit-wv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.currentTarget.querySelector('#submit-ai-edit-wv');
        submitButton.setAttribute('aria-busy', 'true');
        const formData = new FormData(e.currentTarget);
        const selectedCards = Array.from(panel.querySelectorAll('input[name="selected_wv_cards"]:checked')).map(cb => cb.value);

        try {
            const requestBody = {
                prompt_text: formData.get('prompt_text'),
                model_name: document.getElementById('ai-model-select').value,
                selected_card_ids: selectedCards,
                worldview_level: formData.get('worldview-level'),
                edit_related_cards: formData.get('edit_related_cards') === 'on'
            };
            const aiResult = await api.fetchAiWorldviewEdit(projectId, card.id, requestBody);
            closePanel();
            showAiDiffModal(projectId, originalCard, aiResult, 'worldview');

        } catch (error) {
            console.error('AI 수정 제안 생성 실패:', error);
            alert(error.message);
        } finally {
            submitButton.setAttribute('aria-busy', 'false');
        }
    });
}