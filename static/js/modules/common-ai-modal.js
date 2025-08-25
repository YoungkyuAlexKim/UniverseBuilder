// FILE: common-ai-modal.js
/**
 * 모든 AI 기능에서 재사용 가능한 공통 컨텍스트 선택 모달 컴포넌트
 */

import * as api from './api.js';
import { closeModal as closeAllModals } from './modals.js';

// DOM Elements
const modal = document.getElementById('common-ai-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const titleElement = document.getElementById('common-ai-modal-title');
const originalLabelElement = document.getElementById('common-ai-original-label');
const originalElement = document.getElementById('common-ai-original');
const suggestionElement = document.getElementById('common-ai-suggestion');
const presetsContainer = document.getElementById('common-ai-presets');
const userPromptElement = document.getElementById('common-ai-user-prompt');
const charactersContainer = document.getElementById('common-ai-characters-container');
const worldviewCardsContainer = document.getElementById('common-ai-worldview-cards-container');
const groupSelectionSection = document.getElementById('common-ai-group-selection');
const groupSelect = document.getElementById('common-ai-group-select');
const rejectBtn = document.getElementById('common-ai-reject-btn');
const generateBtn = document.getElementById('common-ai-generate-btn');
const acceptBtn = document.getElementById('common-ai-accept-btn');

// App 인스턴스를 저장할 변수
let app;
let currentConfig = null;

/**
 * 공통 AI 모달 모듈을 초기화합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializeCommonAiModal(appInstance) {
    app = appInstance;
    
    // 모달 이벤트 리스너 설정
    setupEventListeners();
}

/**
 * 공통 AI 모달을 엽니다.
 * @param {Object} config - 모달 설정 객체
 * @param {string} config.title - 모달 제목
 * @param {string} config.originalLabel - 현재 내용 라벨
 * @param {string} config.originalContent - 현재 내용 텍스트
 * @param {Array} config.presets - 프리셋 버튼 배열 [{text: "버튼텍스트", prompt: "프롬프트"}]
 * @param {string} config.placeholder - 사용자 입력 placeholder
 * @param {boolean} config.showCharacters - 캐릭터 선택 표시 여부
 * @param {boolean} config.showWorldviewCards - 세계관 카드 선택 표시 여부
 * @param {boolean} config.showGroupSelection - 그룹 선택 표시 여부
 * @param {string} config.projectId - 프로젝트 ID
 * @param {Function} config.onExecute - AI 실행 콜백 (selectedCharacterIds, selectedWorldviewCardIds, userPrompt) => Promise
 * @param {Function} config.onApply - 적용 콜백 (result, selectedGroupId) => Promise
 */
export function openCommonAiModal(config) {
    currentConfig = config;
    
    // 모달 설정
    titleElement.textContent = config.title;
    originalLabelElement.textContent = config.originalLabel;
    originalElement.textContent = config.originalContent;
    suggestionElement.textContent = '결과가 여기에 표시됩니다...';
    userPromptElement.placeholder = config.placeholder || '어떻게 수정하고 싶으신지 자유롭게 설명해주세요...';
    
    // 프리셋 버튼 생성
    setupPresetButtons(config.presets || []);
    
    // 컨텍스트 선택 섹션 표시/숨김
    const detailsElement = modal.querySelector('details');
    if (config.showCharacters || config.showWorldviewCards) {
        detailsElement.style.display = 'block';
        
        // 캐릭터 목록 로딩
        if (config.showCharacters) {
            loadCharacters(config.projectId);
        } else {
            charactersContainer.parentElement.style.display = 'none';
        }
        
        // 세계관 카드 목록 로딩  
        if (config.showWorldviewCards) {
            loadWorldviewCards(config.projectId);
        } else {
            worldviewCardsContainer.parentElement.style.display = 'none';
        }
    } else {
        detailsElement.style.display = 'none';
    }

    // 그룹 선택 섹션 표시/숨김
    if (config.showGroupSelection) {
        groupSelectionSection.style.display = 'block';
        loadGroups(config.projectId);
    } else {
        groupSelectionSection.style.display = 'none';
    }
    
    // 버튼 상태 초기화
    generateBtn.textContent = 'AI 실행';
    acceptBtn.style.display = 'none';
    userPromptElement.value = '';
    
    // X 버튼 이벤트 리스너 추가
    const closeButton = modal.querySelector('.close');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }
    
    // 모달 배경 클릭으로 닫기
    modalBackdrop.onclick = null;
    modalBackdrop.onclick = () => closeModal();
    
    // ESC 키로 닫기
    document.addEventListener('keydown', handleEscKey);
    
    // 모달 표시
    modal.classList.add('active');
    modalBackdrop.classList.add('active');
}

/**
 * 모달을 닫습니다.
 */
export function closeModal() {
    closeAllModals(); // 기존 모달 시스템과 통합
    currentConfig = null;
}

/**
 * ESC 키 처리
 */
function handleEscKey(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

/**
 * 이벤트 리스너를 설정합니다.
 */
function setupEventListeners() {
    // 반려 버튼
    rejectBtn.addEventListener('click', closeModal);
    
    // AI 실행 버튼
    generateBtn.addEventListener('click', handleGenerate);
    
    // 적용 버튼
    acceptBtn.addEventListener('click', handleApply);
}

/**
 * 프리셋 버튼들을 생성합니다.
 */
function setupPresetButtons(presets) {
    presetsContainer.innerHTML = presets.map(preset => 
        `<button type="button" class="common-ai-preset-btn secondary outline" data-prompt="${preset.prompt}">${preset.text}</button>`
    ).join('');
    
    // 프리셋 버튼 이벤트 리스너
    presetsContainer.addEventListener('click', (e) => {
        if (e.target.matches('.common-ai-preset-btn')) {
            const prompt = e.target.dataset.prompt;
            userPromptElement.value = prompt;
        }
    });
}

/**
 * 캐릭터 목록을 로딩합니다.
 */
function loadCharacters(projectId) {
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    
    if (!project || !project.groups) {
        charactersContainer.innerHTML = '<small>캐릭터가 없습니다.</small>';
        return;
    }
    
    let charactersHTML = '';
    project.groups.forEach(group => {
        if (group.cards && group.cards.length > 0) {
            const groupHTML = group.cards.map(card => `
                <label>
                    <input type="checkbox" name="common-ai-character" value="${card.id}">
                    ${card.name}
                </label>
            `).join('');
            
            charactersHTML += `<fieldset><legend>${group.name}</legend>${groupHTML}</fieldset>`;
        }
    });
    
    charactersContainer.innerHTML = charactersHTML || '<small>캐릭터가 없습니다.</small>';
}

/**
 * 세계관 카드 목록을 로딩합니다.
 */
function loadWorldviewCards(projectId) {
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    
    if (!project || !project.worldview_groups) {
        worldviewCardsContainer.innerHTML = '<small>서브 설정이 없습니다.</small>';
        return;
    }
    
    let cardsHTML = '';
    project.worldview_groups.forEach(group => {
        if (group.worldview_cards && group.worldview_cards.length > 0) {
            const groupHTML = group.worldview_cards.map(card => `
                <label>
                    <input type="checkbox" name="common-ai-worldview-card" value="${card.id}">
                    ${card.title}
                </label>
            `).join('');
            
            cardsHTML += `<fieldset><legend>${group.name}</legend>${groupHTML}</fieldset>`;
        }
    });
    
    worldviewCardsContainer.innerHTML = cardsHTML || '<small>서브 설정이 없습니다.</small>';
}

/**
 * AI 실행 버튼 핸들러
 */
async function handleGenerate() {
    const userPrompt = userPromptElement.value.trim();
    if (!userPrompt) {
        alert('AI에게 요청할 내용을 입력해주세요.');
        return;
    }
    
    if (!currentConfig || !currentConfig.onExecute) {
        console.error('AI 실행 콜백이 설정되지 않았습니다.');
        return;
    }
    
    // 선택된 컨텍스트 수집
    const selectedCharacterIds = Array.from(modal.querySelectorAll('input[name="common-ai-character"]:checked')).map(cb => cb.value);
    const selectedWorldviewCardIds = Array.from(modal.querySelectorAll('input[name="common-ai-worldview-card"]:checked')).map(cb => cb.value);
    
    // 버튼 상태 설정
    generateBtn.setAttribute('aria-busy', 'true');
    generateBtn.disabled = true;
    suggestionElement.textContent = '생성 중...';
    
    try {
        const result = await currentConfig.onExecute(selectedCharacterIds, selectedWorldviewCardIds, userPrompt);
        
        // 결과 표시
        suggestionElement.textContent = result;
        acceptBtn.style.display = 'inline-block';
        
    } catch (error) {
        console.error('AI 실행 실패:', error);
        suggestionElement.textContent = `오류가 발생했습니다: ${error.message}`;
    } finally {
        generateBtn.setAttribute('aria-busy', 'false');  
        generateBtn.disabled = false;
    }
}

/**
 * 그룹 목록을 로딩합니다.
 */
function loadGroups(projectId) {
    const { projects } = app.stateManager.getState();
    const project = projects.find(p => p.id === projectId);
    
    if (!project || !project.groups || project.groups.length === 0) {
        groupSelect.innerHTML = '<option value="" disabled>그룹이 없습니다</option>';
        return;
    }
    
    const groupOptions = project.groups.map(group => 
        `<option value="${group.id}">${group.name}</option>`
    ).join('');
    
    groupSelect.innerHTML = '<option value="" disabled selected>그룹을 선택해주세요...</option>' + groupOptions;
}

/**
 * 적용 버튼 핸들러
 */
async function handleApply() {
    if (!currentConfig || !currentConfig.onApply) {
        console.error('적용 콜백이 설정되지 않았습니다.');
        return;
    }
    
    const result = suggestionElement.textContent;
    
    // 그룹 선택이 필요한 경우 검증
    let selectedGroupId = null;
    if (currentConfig.showGroupSelection) {
        selectedGroupId = groupSelect.value;
        if (!selectedGroupId) {
            alert('저장할 그룹을 선택해주세요.');
            return;
        }
    }
    
    acceptBtn.setAttribute('aria-busy', 'true');
    
    try {
        await currentConfig.onApply(result, selectedGroupId);
        closeModal();
    } catch (error) {
        console.error('적용 실패:', error);
        alert(`적용에 실패했습니다: ${error.message}`);
    } finally {
        acceptBtn.setAttribute('aria-busy', 'false');
    }
}
