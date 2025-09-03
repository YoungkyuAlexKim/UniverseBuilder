// FILE: api.js

/**
 * 서버 API와 통신하는 모든 함수를 담당하는 모듈
 */

// Helper function for handling fetch responses
async function handleResponse(response) {

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            console.error('Failed to parse error response as JSON:', e);
            errorData = { detail: response.statusText };
        }
        console.error('API Error:', errorData);
        throw new Error(errorData.detail || `서버 오류: ${response.statusText}`);
    }

    if (response.status === 204) {
        return {};
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        const jsonResponse = await response.json();
        return jsonResponse;
    }
    return {};
}

// API 요청 시 인증 헤더를 생성하는 헬퍼 함수
export function getAuthHeaders(projectId) {
    const headers = { 'Content-Type': 'application/json' };

    // 프로젝트 비밀번호 헤더 추가
    const password = sessionStorage.getItem(`project-password-${projectId}`);
    if (password) {
        headers['X-Project-Password'] = password;
    }

    // 사용자 API 키 헤더 추가 (localStorage에서 가져옴)
    const userApiKey = localStorage.getItem('userApiKey');
    if (userApiKey && userApiKey.trim()) {
        headers['X-User-API-Key'] = userApiKey.trim();

        // 디버깅용: 사용자 키 사용 시 콘솔에 로깅
        const maskedKey = userApiKey.length > 14 ? userApiKey.substring(0, 10) + '...' + userApiKey.substring(userApiKey.length - 4) : userApiKey;
        console.log(`🔑 [디버그] API 요청 - 사용자 키 사용: ${maskedKey} (${userApiKey.length}자)`);
    } else {
        // 서버 키 폴백 시 로깅
        console.log(`🖥️ [디버그] API 요청 - 서버 키 사용 (사용자 키 없음)`);
    }

    return headers;
}

/**
 * 스트리밍 방식으로 AI 캐릭터를 생성합니다.
 * @param {Object} requestData - 생성 요청 데이터
 * @param {Function} onChunk - 각 청크 수신 시 호출될 콜백
 * @param {Function} onComplete - 완료 시 호출될 콜백
 * @param {Function} onError - 오류 시 호출될 콜백
 */
export async function generateCharacterStream(requestData, onChunk, onComplete, onError) {
    try {
        const response = await fetch('/api/v1/generate/character/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || `서버 오류: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                        onComplete();
                        return;
                    }

                    try {
                        const parsedData = JSON.parse(data);
                        onChunk(parsedData);
                    } catch (e) {
                        // JSON이 아닌 경우 텍스트로 처리
                        if (data) {
                            onChunk(data);
                        }
                    }
                }
            }
        }
    } catch (error) {
        onError(error);
    }
}


// -------------------------
// 프로젝트 (Projects)
// -------------------------

export async function fetchProjectsList() {
    const response = await fetch('/api/v1/projects/list');
    return handleResponse(response);
}

export async function fetchProjects() {
    const response = await fetch('/api/v1/projects');
    return handleResponse(response);
}

export async function fetchProjectDetails(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

// Alias for backward compatibility
export const getProjectDetails = fetchProjectDetails;

export async function createProject(projectName, password) {
    const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, password: password })
    });
    return handleResponse(response);
}

export async function deleteProject(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function updateProject(projectId, newName) {
    const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ name: newName.trim() })
    });
    return handleResponse(response);
}

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
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ password })
    });
    return handleResponse(response);
}


// -------------------------
// 캐릭터 그룹 & 카드 (Character Groups & Cards)
// -------------------------

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

export async function saveWorldview(projectId, worldviewData) {
    const response = await fetch(`/api/v1/projects/${projectId}/worldview`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(worldviewData)
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
// 시나리오 (Scenario)
// -------------------------

export async function updateScenario(projectId, scenarioId, scenarioData) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/${scenarioId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(scenarioData)
    });
    return handleResponse(response);
}

export async function createPlotPoint(projectId, scenarioId, plotPointData) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/${scenarioId}/plot_points`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(plotPointData)
    });
    return handleResponse(response);
}

export async function generateAiScenarioDraft(projectId, scenarioId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/${scenarioId}/generate-draft`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

// [신규] 전체 플롯 수정 API 호출 함수
export async function editAllPlotPointsWithAi(projectId, scenarioId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/${scenarioId}/edit-plots-with-ai`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function updatePlotPoint(projectId, scenarioId, plotPointId, plotPointData) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/plot_points/${plotPointId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(plotPointData)
    });
    return handleResponse(response);
}

export async function deletePlotPoint(projectId, scenarioId, plotPointId) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/plot_points/${plotPointId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

// [신규] 모든 플롯 포인트를 삭제하는 API 호출 함수
export async function deleteAllPlotPoints(projectId, scenarioId) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/${scenarioId}/plot_points`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function editPlotPointWithAi(projectId, scenarioId, plotPointId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/plot_points/${plotPointId}/edit-with-ai`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function generateSceneForPlotPoint(projectId, plotPointId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/plot_points/${plotPointId}/generate-scene`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function editSceneForPlotPoint(projectId, plotPointId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/scenarios/plot_points/${plotPointId}/edit-scene`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}


// -------------------------
// AI 생성 및 수정 (AI Generators & Editors)
// -------------------------

export async function generateCharacter(projectId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/generate/character`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody),
    });
    return handleResponse(response);
}

export async function refineScenarioConcept(requestBody) {
    const response = await fetch('/api/v1/generate/scenario-concept', {
       method: 'POST',
       headers: getAuthHeaders(requestBody.project_id),
       body: JSON.stringify(requestBody)
   });
   return handleResponse(response);
}

export async function refineWorldviewRule(requestBody) {
    const response = await fetch('/api/v1/generate/worldview-rule', {
       method: 'POST',
       headers: getAuthHeaders(requestBody.project_id),
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

// 관계 변화 단계 (Relationship Phases)
// -------------------------
// [Phase 2: RelationshipPhase API 함수들]

export async function createRelationshipPhase(projectId, relationshipId, phaseData) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/${relationshipId}/phases`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(phaseData)
    });
    return handleResponse(response);
}

export async function getRelationshipPhases(projectId, relationshipId) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/${relationshipId}/phases`, {
        method: 'GET',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function updateRelationshipPhase(projectId, relationshipId, phaseId, phaseData) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/${relationshipId}/phases/${phaseId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(phaseData)
    });
    return handleResponse(response);
}

export async function deleteRelationshipPhase(projectId, relationshipId, phaseId) {
    const response = await fetch(`/api/v1/projects/${projectId}/relationships/${relationshipId}/phases/${phaseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function enhanceSynopsis(requestBody) {
    const response = await fetch('/api/v1/generate/synopsis-enhance', {
        method: 'POST',
        headers: getAuthHeaders(requestBody.project_id),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

// -------------------------
// 집필 (Manuscript)
// -------------------------

export async function fetchManuscriptBlocks(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks`, {
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}
export async function importManuscriptFromScenario(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/import`, {
        method: 'POST',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function clearManuscriptBlocks(projectId) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function updateManuscriptBlock(projectId, blockId, updateData) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(updateData)
    });
    return handleResponse(response);
}

export async function updateManuscriptBlockOrder(projectId, blockIds) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/order`, {
        method: 'PUT',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify({ block_ids: blockIds })
    });
    return handleResponse(response);
}

export async function editManuscriptBlockWithAi(projectId, blockId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/edit-with-ai`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function refinePartialManuscript(projectId, blockId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/refine-partial`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function mergeManuscriptBlocks(projectId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/merge`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function splitManuscriptBlock(projectId, blockId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/split`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

export async function deleteManuscriptBlock(projectId, blockId) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function exportManuscriptToScenario(projectId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/export-to-scenario`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

// === 스타일 가이드 API ===

export async function getStyleGuides() {
    const response = await fetch('/api/v1/style-guides/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return handleResponse(response);
}

export async function getStyleGuideDetail(styleGuideId) {
    const response = await fetch(`/api/v1/style-guides/${styleGuideId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return handleResponse(response);
}

export async function getStyleGuideContent(styleGuideId) {
    const response = await fetch(`/api/v1/style-guides/${styleGuideId}/content`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return handleResponse(response);
}

// -------------------------
// 캐릭터 추출 (Character Extraction)
// -------------------------

export async function extractCharactersFromManuscript(projectId, blockId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/extract-characters`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}

// -------------------------
// 플롯 불러오기/내보내기 (Plot Import/Export)
// -------------------------

export async function importBlockFromPlot(projectId, blockId, plotId) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/import-from-plot/${plotId}`, {
        method: 'POST',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

export async function exportBlockToPlot(projectId, blockId, plotId) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/export-to-plot/${plotId}`, {
        method: 'POST',
        headers: getAuthHeaders(projectId)
    });
    return handleResponse(response);
}

// -------------------------
// AI 피드백 (AI Feedback)
// -------------------------

export async function generateExpertFeedback(projectId, blockId, requestBody) {
    const response = await fetch(`/api/v1/projects/${projectId}/manuscript/blocks/${blockId}/generate-feedback`, {
        method: 'POST',
        headers: getAuthHeaders(projectId),
        body: JSON.stringify(requestBody)
    });
    return handleResponse(response);
}