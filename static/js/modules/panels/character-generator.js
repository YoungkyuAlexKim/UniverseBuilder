// FILE: character-generator.js
/**
 * 캐릭터 생성 패널의 생성 및 관리 로직을 담당하는 모듈
 */

import * as api from '../api.js';

// App 인스턴스를 저장할 변수
let app;

/**
 * 캐릭터 생성 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeCharacterGenerator(appInstance) {
    app = appInstance;
}

/**
 * 캐릭터 생성 UI를 표시합니다.
 * @param {string} projectId - 프로젝트 ID
 * @param {HTMLElement} container - UI를 표시할 컨테이너
 */
export function showCharacterGeneratorUI(projectId, container) {
    const existingGenerator = container.querySelector('#character-generator-inline');
    if (existingGenerator) return;

    // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
    const { projects } = app.stateManager.getState();
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

/**
 * 스트리밍 중 실시간으로 텍스트를 표시합니다.
 * @param {HTMLElement} generatorContainer - 생성기 컨테이너
 * @param {string} currentText - 현재까지 생성된 텍스트
 */
function updateStreamingDisplay(generatorContainer, currentText) {
    const resultCard = generatorContainer.querySelector('#character-result-card');
    resultCard.style.display = 'block';

    // 타이핑 효과를 위한 커서 표시
    const typingText = currentText + '<span class="typing-cursor">|</span>';

    generatorContainer.querySelector('#char-card-name').innerHTML = typingText;
    generatorContainer.querySelector('#char-card-desc').innerHTML = typingText;
    generatorContainer.querySelector('#char-card-personality').innerHTML = typingText;
    generatorContainer.querySelector('#char-card-abilities').innerHTML = typingText;
    generatorContainer.querySelector('#char-card-goal').innerHTML = typingText;
    generatorContainer.querySelector('#char-card-story').innerHTML = typingText;
}

/**
 * 완성된 캐릭터 데이터를 표시합니다.
 * @param {HTMLElement} generatorContainer - 생성기 컨테이너
 * @param {Object} characterData - 캐릭터 데이터
 */
function updateCharacterDisplay(generatorContainer, characterData) {
    // 커서 제거하고 최종 데이터 표시
    generatorContainer.querySelector('#char-card-name').innerHTML = characterData.name || '';
    generatorContainer.querySelector('#char-card-desc').innerHTML = characterData.description || '';
    generatorContainer.querySelector('#char-card-personality').innerHTML = characterData.personality || '';
    generatorContainer.querySelector('#char-card-abilities').innerHTML = characterData.abilities || '';
    generatorContainer.querySelector('#char-card-goal').innerHTML = characterData.goal || '';

    const quoteContainer = generatorContainer.querySelector('#char-card-quote-container');
    let quotesHTML = '';
    if (Array.isArray(characterData.quote) && characterData.quote.length > 0) {
        quotesHTML = `
            <p><strong class="label">대표 대사:</strong></p>
            <ul>
                ${characterData.quote.map(q => `<li>"${q}"</li>`).join('')}
            </ul>
        `;
    }
    quoteContainer.innerHTML = quotesHTML;

    generatorContainer.querySelector('#char-card-story').innerHTML = characterData.introduction_story || '';
}

/**
 * 캐릭터 생성 버튼 클릭 핸들러
 */
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
        // [수정] StateManager를 통해 현재 프로젝트 상태를 가져옴
        const { projects } = app.stateManager.getState();
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

        // 스트리밍 방식으로 캐릭터 생성
        let characterData = {};
        let currentField = '';

        await api.generateCharacterStream(
            requestBody,
            (chunk) => {
                // 실시간으로 텍스트를 표시
                if (typeof chunk === 'string') {
                    // 부분적인 텍스트 청크 처리
                    currentField += chunk;
                    updateStreamingDisplay(generatorContainer, currentField);
                } else if (typeof chunk === 'object') {
                    // 완성된 JSON 객체
                    characterData = chunk;
                    updateCharacterDisplay(generatorContainer, characterData);
                }
            },
            () => {
                // 생성 완료
                app.stateManager.setLastGeneratedCard(characterData);
                resultCard.style.display = 'block';
            },
            (error) => {
                console.error('스트리밍 캐릭터 생성 실패:', error);
                alert(`캐릭터 생성에 실패했습니다: ${error.message}`);
            }
        );

    } catch (error) {
        console.error('캐릭터 생성 실패:', error);
        alert(`캐릭터 생성에 실패했습니다: ${error.message}`);
    } finally {
        generateBtn.setAttribute('aria-busy', 'false');
        rerollBtn.setAttribute('aria-busy', 'false');
    }
}

/**
 * 캐릭터 저장 버튼 클릭 핸들러
 */
async function handleSaveClick(projectId, generatorContainer) {
    const saveGroupSelect = generatorContainer.querySelector('#save-to-group-select');
    const saveBtn = generatorContainer.querySelector('#save-character-btn');
    const selectedGroupId = saveGroupSelect.value;
    const lastGeneratedCard = app.stateManager.getLastGeneratedCard();

    if (!selectedGroupId) { alert('저장할 그룹을 선택해주세요.'); return; }
    if (!lastGeneratedCard) { alert('먼저 캐릭터를 생성해주세요.'); return; }

    saveBtn.setAttribute('aria-busy', 'true');

    try {
        await api.saveCard(projectId, selectedGroupId, lastGeneratedCard);
        alert('캐릭터 카드가 성공적으로 저장되었습니다!');
        generatorContainer.remove();
        // [수정] stateManager를 통해 상태 갱신 요청
        await app.stateManager.refreshCurrentProject();

    } catch (error) {
        console.error('카드 저장 실패:', error);
        alert(error.message);
    } finally {
        saveBtn.setAttribute('aria-busy', 'false');
    }
}
