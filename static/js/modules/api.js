// FILE: api.js

/**
 * 서버 API와 통신하는 모든 함수를 담당하는 모듈
 */

// Helper function for handling fetch responses
async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `서버 오류: ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }
    return {}; 
}

// [신규] API 요청 시 인증 헤더를 생성하는 헬퍼 함수
function getAuthHeaders(projectId) {
    const headers = { 'Content-Type': 'application/json' };
    // sessionStorage에서 현재 프로젝트의 비밀번호를 가져옵니다.
    const password = sessionStorage.getItem(`project-password-${projectId}`);
    if (password) {
        // 백엔드에서 받을 헤더 이름('X-Project-Password')과 일치시킵니다.
        headers['X-Project-Password'] = password;
    }
    return headers;
}


// -------------------------
// 프로젝트 (Projects)
// -------------------------

// 프로젝트 목록 조회는 비밀번호가 필요 없으므로 수정하지 않습니다.
export async function fetchProjects() {
    const response = await fetch('/api/v1/projects');
    return handleResponse(response);
}

// [수정] 프로젝트 상세 정보 조회 시 인증 헤더 추가
export async function fetchProjectDetails(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

// [수정] 프로젝트 생성 시 비밀번호 데이터 추가
export async function createProject(projectName, password) {
    const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, password: password })
    });
    return handleResponse(response);
}

// [수정] 프로젝트 삭제 시 인증 헤더 추가
export async function deleteProject(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

// [수정] 프로젝트 수정 시 인증 헤더 추가
export async function updateProject(projectId, newName) {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ name: newName.trim() })
    });
    return handleResponse(response);
}

// [신규] 비밀번호 관련 API 함수들
export async function checkPasswordStatus(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}/status`);
    return handleResponse(response);
}

export async function verifyPassword(projectId, password) {
    const response = await fetch(`/api/v1/projects/${projectId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    return handleResponse(response);
}

export async function setPassword(projectId, password) {
    const response = await fetch(`/api/v1/projects/${projectId}/password`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId), // 기존 비밀번호가 있다면 인증 후 변경 가능
        body: JSON.stringify({ password })
    });
    return handleResponse(response);
}


// -------------------------
// 캐릭터 그룹 & 카드 (Character Groups & Cards)
// -------------------------

// [수정] 이후 모든 API 호출에 인증 헤더를 추가합니다.
export async function createGroup(projectId, groupName) {
    const response = await fetch(`/api/v1/projects/${projectId}/groups`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ name: groupName })
    });
    return handleResponse(response);
}

export async function deleteGroup(projectId, groupId) {
    const response = await fetch(`/api/v1/projects/${projectId}/groups/${groupId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function saveCard(projectId, groupId, cardData) {
    const response = await fetch(`/api/v1/projects/${projectId}/groups/${groupId}/cards`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(cardData)
    });
    return handleResponse(response);
}

export async function deleteCard(projectId, groupId, cardId) {
    const response = await fetch(`/api/v1/projects/${projectId}/groups/${groupId}/cards/${cardId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function updateCard(projectId, cardId, cardData) {
     const response = await fetch(`/api/v1/projects/${projectId}/cards/${cardId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(cardData)
    });
    return handleResponse(response);
}

export async function moveCard(projectId, cardId, sourceGroupId, targetGroupId) {
    const moveUrl = `/api/v1/projects/${projectId}/cards/${cardId}/move`;
    const response = await fetch(moveUrl, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ source_group_id: sourceGroupId, target_group_id: targetGroupId })
    });
    return handleResponse(response);
}

export async function updateCardOrder(projectId, groupId, cardIds) {
    const orderUrl = `/api/v1/projects/${projectId}/groups/${groupId}/cards/order`;
    const response = await fetch(orderUrl, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ card_ids: cardIds })
    });
    return handleResponse(response);
}

// -------------------------
// 세계관 (Worldview)
// -------------------------

export async function saveWorldview(projectId, content) {
    const response = await fetch(`/api/v1/projects/${projectId}/worldview`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ content: content })
    });
    return handleResponse(response);
}

export async function createWorldviewGroup(projectId, groupName) {
    const response = await fetch(`/api/v1/projects/${projectId}/worldview_groups`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ name: groupName })
    });
    return handleResponse(response);
}

export async function deleteWorldviewGroup(projectId, groupId) {
    const response = await fetch(`/api/v1/projects/${projectId}/worldview_groups/${groupId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function saveWorldviewCard(projectId, groupId, cardData, cardId = null) {
    const url = cardId
        ? `/api/v1/projects/${projectId}/worldview_cards/${cardId}`
        : `/api/v1/projects/${projectId}/worldview_groups/${groupId}/cards`;
    const method = cardId ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(cardData)
    });
    return handleResponse(response);
}

export async function deleteWorldviewCard(projectId, cardId) {
    const response = await fetch(`/api/v1/projects/${projectId}/worldview_cards/${cardId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function moveWorldviewCard(projectId, cardId, sourceGroupId, targetGroupId) {
    const moveUrl = `/api/v1/projects/${projectId}/worldview_cards/${cardId}/move`;
    const response = await fetch(moveUrl, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ source_group_id: sourceGroupId, target_group_id: targetGroupId })
    });
    return handleResponse(response);
}

export async function updateWorldviewCardOrder(projectId, groupId, cardIds) {
    const orderUrl = `/api/v1/projects/${projectId}/worldview_groups/${groupId}/cards/order`;
    const response = await fetch(orderUrl, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ card_ids: cardIds })
    });
    return handleResponse(response);
}

// -------------------------
// AI 생성 및 수정 (AI Generators & Editors)
// -------------------------

// AI 관련 기능들도 프로젝트 데이터를 기반으로 하므로 모두 인증 헤더를 추가합니다.
export async function generateCharacter(projectId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/generate/character`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody),
    });
    return handleResponse(response);
}

export async function generateNewWorldview(requestBody) {
    const response = await fetch('/api/v1/generate/worldview/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // 이 API는 프로젝트와 직접적 연관이 없으므로 인증 불필요
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function editWorldview(requestBody) {
     const response = await fetch('/api/v1/generate/worldview/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // 이 API는 프로젝트와 직접적 연관이 없으므로 인증 불필요
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function fetchAiCharacterEdit(projectId, cardId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/cards/${cardId}/edit-with-ai`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function fetchAiWorldviewEdit(projectId, cardId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/worldview_cards/${cardId}/edit-with-ai`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function applyAiSuggestion(projectId, updatedCards, cardType) {
    const updatePromises = updatedCards.map(cardToUpdate => {
        const apiPath = cardType === 'character'
            ? `/api/v1/projects/${projectId}/cards/${cardToUpdate.id}`
            : `/api/v1/projects/${projectId}/worldview_cards/${cardToUpdate.id}/details`;

        return fetch(apiPath, {
            method: 'PUT',
            headers: getAuthHeaders(projectId),
            body: JSON.stringify(cardToUpdate)
        });
    });

    const responses = await Promise.all(updatePromises);
    for (const res of responses) {
        if (!res.ok) {
            throw new Error(`하나 이상의 카드 저장에 실패했습니다: ${await res.text()}`);
        }
    }
    return Promise.resolve();
}

export async function highlightCharacterNames(projectId, cardId, fieldName, textContent) {
    const response = await fetch(`/api/v1/projects/${projectId}/cards/${cardId}/highlight-names`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({
            field_name: fieldName,
            text_content: textContent,
        }),
    });
    return handleResponse(response);
}

// -------------------------
// 캐릭터 관계도 (Character Relationships)
// -------------------------

export async function createRelationship(projectId, relationshipData) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(relationshipData)
    });
    return handleResponse(response);
}

export async function updateRelationship(projectId, relationshipId, relationshipData) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/${relationshipId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(relationshipData)
    });
    return handleResponse(response);
}

export async function deleteRelationship(projectId, relationshipId) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/${relationshipId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function suggestRelationship(projectId, sourceCharacterId, targetCharacterId, tendency, keyword) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/suggest`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({
            source_character_id: sourceCharacterId,
            target_character_id: targetCharacterId,
            tendency: tendency,
            keyword: keyword || null,
        })
    });
    return handleResponse(response);
}