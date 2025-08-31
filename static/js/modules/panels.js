// FILE: panels.js - 메인 패널 모듈 (분리된 패널들을 통합)

/**
 * 모든 패널 모듈들을 통합하여 초기화하는 메인 모듈
 */

// 개별 패널 모듈들을 import
import { initializeCharacterGenerator } from './panels/character-generator.js';
import { initializeRelationshipPanel } from './panels/relationship-panel.js';
import { initializeRelationshipTimelinePanel } from './panels/relationship-timeline-panel.js';  // [추가] 타임라인 패널
import { initializeCharacterEditor } from './panels/character-editor.js';
import { initializeWorldviewEditor } from './panels/worldview-editor.js';

// App 인스턴스를 저장할 변수
let app;

/**
 * 모든 패널 모듈을 초기화하고 App 인스턴스를 저장합니다.
 * @param {App} appInstance - 애플리케이션의 메인 컨트롤러 인스턴스
 */
export function initializePanels(appInstance) {
    app = appInstance;

    // 각 패널 모듈 초기화
    initializeCharacterGenerator(appInstance);
    initializeRelationshipPanel(appInstance);
    initializeRelationshipTimelinePanel(appInstance);  // [추가] 타임라인 패널 초기화
    initializeCharacterEditor(appInstance);
    initializeWorldviewEditor(appInstance);
}

// 개별 패널 모듈들의 함수들을 재export
export { showCharacterGeneratorUI } from './panels/character-generator.js';
export { showRelationshipPanel } from './panels/relationship-panel.js';
export { showRelationshipTimelinePanel } from './panels/relationship-timeline-panel.js';  // [추가] 타임라인 패널
export { handleEditCardAI, handleManualEditCard } from './panels/character-editor.js';
export { handleEditWorldviewCardAI } from './panels/worldview-editor.js';

// 리팩토링 완료: 모든 비즈니스 로직은 개별 모듈로 이동됨