/**
 * 캐릭터 생성 관련 컨트롤러
 * AI 캐릭터 생성, 포맷팅, 저장 기능을 담당합니다.
 */
import * as api from '../modules/api.js';
import * as commonAiModal from '../modules/common-ai-modal.js';

export class CharacterGenerationController {
    constructor(app) {
        this.app = app;
        this.stateManager = app.stateManager;
        this.eventManager = app.eventManager;
    }

    /**
     * 캐릭터 생성 모달을 엽니다.
     */
    openCharacterGenerationModal(projectId) {
        const config = {
            title: '✨ AI 캐릭터 생성',
            originalLabel: '참고할 정보',
            originalContent: '현재 프로젝트의 맥락을 바탕으로 새로운 캐릭터를 생성합니다.',
            presets: [
                { text: '🗡️ 전사 계열', prompt: '용맹하고 강인한 전사 타입의 캐릭터를 만들어줘' },
                { text: '🎭 지적인 캐릭터', prompt: '지혜롭고 신중한 지식인 타입의 캐릭터를 만들어줘' },
                { text: '🌟 특별한 능력', prompt: '독특하고 특별한 능력을 가진 캐릭터를 만들어줘' },
                { text: '😈 안타고니스트', prompt: '흥미로운 악역이나 라이벌 캐릭터를 만들어줘' },
                { text: '🤝 조력자', prompt: '주인공을 도와주는 믿음직한 조력자를 만들어줘' },
                { text: '🎲 랜덤 생성', prompt: '프로젝트 맥락에 맞는 흥미로운 캐릭터를 자유롭게 만들어줘' }
            ],
            placeholder: '어떤 캐릭터를 원하시는지 구체적으로 설명해주세요. 예: 몰락한 왕국의 마지막 기사',
            showCharacters: true,
            showWorldviewCards: true,
            showGroupSelection: true,
            projectId: projectId,
            onExecute: (selectedCharacterIds, selectedWorldviewCardIds, userPrompt) => 
                this.executeCharacterGeneration(projectId, selectedCharacterIds, selectedWorldviewCardIds, userPrompt),
            onApply: (result, selectedGroupId) => 
                this.applyCharacterGeneration(projectId, result, selectedGroupId)
        };

        commonAiModal.openCommonAiModal(config);
    }

    /**
     * 캐릭터 생성을 실행합니다.
     */
    async executeCharacterGeneration(projectId, selectedCharacterIds, selectedWorldviewCardIds, userPrompt) {
        const { projects } = this.stateManager.getState();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

        const requestBody = {
            keywords: userPrompt,
            character_ids: selectedCharacterIds.length > 0 ? selectedCharacterIds : null,
            worldview_context: project.worldview?.content || null,
            worldview_level: 'medium',
            model_name: document.getElementById('ai-model-select').value,
            worldview_card_ids: selectedWorldviewCardIds.length > 0 ? selectedWorldviewCardIds : null,
        };

        try {
            const result = await api.generateCharacter(projectId, requestBody);
            const formattedResult = this.formatCharacterForDisplay(result);
            return formattedResult;
            
        } catch (error) {
            console.error('캐릭터 생성 실패:', error);
            throw new Error(`캐릭터 생성에 실패했습니다: ${error.message}`);
        }
    }

    /**
     * 생성된 캐릭터를 적용합니다.
     */
    async applyCharacterGeneration(projectId, result, selectedGroupId) {
        try {
            const lastGeneratedCard = this.stateManager.getLastGeneratedCard();
            if (!lastGeneratedCard) {
                throw new Error('생성된 캐릭터 데이터를 찾을 수 없습니다.');
            }

            await api.saveCard(projectId, selectedGroupId, lastGeneratedCard);
            alert('캐릭터가 성공적으로 저장되었습니다!');
            await this.stateManager.refreshCurrentProject();
            
        } catch (error) {
            console.error('캐릭터 저장 실패:', error);
            throw new Error(`캐릭터 저장에 실패했습니다: ${error.message}`);
        }
    }

    /**
     * 캐릭터 데이터를 표시용 형식으로 변환합니다.
     */
    formatCharacterForDisplay(characterData) {
        this.stateManager.setLastGeneratedCard(characterData);
        
        let formatted = `**${characterData.name}**\n\n`;
        formatted += `${characterData.description}\n\n`;
        
        if (characterData.personality && characterData.personality.length > 0) {
            formatted += `**성격:** ${Array.isArray(characterData.personality) ? characterData.personality.join(', ') : characterData.personality}\n\n`;
        }
        
        if (characterData.abilities && characterData.abilities.length > 0) {
            formatted += `**능력:** ${Array.isArray(characterData.abilities) ? characterData.abilities.join(', ') : characterData.abilities}\n\n`;
        }
        
        if (characterData.goal && characterData.goal.length > 0) {
            formatted += `**목표:** ${Array.isArray(characterData.goal) ? characterData.goal.join(', ') : characterData.goal}\n\n`;
        }
        
        if (characterData.quote && characterData.quote.length > 0) {
            formatted += `**대표 대사:**\n`;
            const quotes = Array.isArray(characterData.quote) ? characterData.quote : [characterData.quote];
            quotes.forEach(quote => formatted += `• "${quote}"\n`);
            formatted += '\n';
        }
        
        if (characterData.introduction_story) {
            formatted += `**등장 서사:**\n${characterData.introduction_story}`;
        }
        
        return formatted;
    }
}
