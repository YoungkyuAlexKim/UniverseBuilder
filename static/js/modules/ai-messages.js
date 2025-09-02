/**
 * AI 애니메이션에서 사용되는 위트 있는 메시지들을 관리하는 모듈
 * 메시지 추가, 수정, 삭제가 용이하도록 별도 모듈로 분리
 */

/**
 * AI 타이핑 애니메이션에 사용되는 메시지와 아이콘 조합들
 * 각 메시지는 { icon: "lucide-icon-name", text: "메시지 내용" } 형태
 */
export const aiWritingMessages = [
    // 🎨 창작 활동 관련 메시지들
    { icon: "star", text: "최고급 뉘앙스를 공수하는 중..." },
    { icon: "user-check", text: "캐릭터에게 빙의해보는 중..." },
    { icon: "wrench", text: "플롯의 구멍을 몰래 메우는 중..." },
    { icon: "brain-circuit", text: "작가님의 필력을 훔...아니, 학습하는 중..." },
    { icon: "blender", text: "영감을 한 스푼, 마감을 두 스푼 넣는 중..." },
    { icon: "users", text: "뇌세포들과 격렬하게 토론 중..." },
    { icon: "tv", text: "막장 드라마 정주행하며 아이디어 찾는 중..." },
    { icon: "brick", text: "클리셰를 부수고 다시 조립하는 중..." },
    { icon: "sparkles", text: "알고리즘의 신에게 기도하는 중..." },
    { icon: "bot", text: "데우스 엑스 마키나를 잠시 빌리는 중..." },
    { icon: "lightbulb", text: "복선을 어디다 숨길지 고민하는 중..." },
    { icon: "battery-charging", text: "창의력 배터리 110% 충전 완료!" },
    { icon: "coffee", text: "잠시 커피 한 잔... 아니, 냉각수 한 잔..." },
    { icon: "award", text: "작품에 '개연성'이라는 양념을 추가하는 중..." },
    { icon: "book-open", text: "엔딩을 먼저 보고 오는 중..." },
    { icon: "feather", text: "퇴고 요정들을 소환하는 중..." },
    { icon: "keyboard", text: "키보드 워리어의 영혼을 불태우는 중..." },
    { icon: "moon", text: "작가님의 마감을 위해 밤샘 근무 중..." },
    { icon: "pen", text: "필력을 갈고닦는 중..." },
    { icon: "type", text: "문장들을 예쁘게 다듬는 중..." },
    { icon: "edit", text: "문장을 예술적으로 재배열하는 중..." },
    { icon: "layers", text: "스토리 레이어를 하나씩 쌓아올리는 중..." },
    { icon: "scissors", text: "불필요한 부분을 과감하게 잘라내는 중..." },
    { icon: "copy", text: "명장면들을 복사해서 붙여넣는 중..." },
    { icon: "rotate-ccw", text: "아이디어를 180도로 뒤집어보는 중..." },
    { icon: "zoom-in", text: "디테일을 확대해서 살펴보는 중..." },
    { icon: "zoom-out", text: "큰 그림을 보며 균형을 맞추는 중..." },
    { icon: "shuffle", text: "플롯 조각들을 섞어서 새로운 조합을 만드는 중..." },
    { icon: "repeat", text: "좋은 아이디어를 반복해서 발전시키는 중..." },
    { icon: "maximize", text: "감동을 극대화하는 중..." },
    { icon: "minimize", text: "불필요한 부분을 최소화하는 중..." },
    { icon: "move", text: "스토리 조각들을 최적의 위치로 옮기는 중..." },
    { icon: "corner-down-right", text: "세부 사항을 하나씩 정리하는 중..." },
    { icon: "check-circle", text: "완성도를 체크하며 다듬는 중..." },
    { icon: "x", text: "문제가 되는 부분을 찾아서 수정하는 중..." },

    // ⚡ 기술/생산 관련 메시지들
    { icon: "zap", text: "번개처럼 영감이 떠오르는 중..." },
    { icon: "atom", text: "창의력의 원자를 분열시키는 중..." },
    { icon: "dna", text: "스토리의 DNA를 설계하는 중..." },
    { icon: "cpu", text: "프로세서를 가동하며 연산하는 중..." },
    { icon: "hard-drive", text: "메모리를 정리하며 저장하는 중..." },
    { icon: "wifi", text: "창의력 네트워크에 연결하는 중..." },
    { icon: "battery", text: "아이디어 배터리를 충전하는 중..." },
    { icon: "plug", text: "영감의 플러그를 연결하는 중..." },
    { icon: "microscope", text: "세부 사항을 확대해서 보는 중..." },
    { icon: "telescope", text: "큰 그림을 내다보는 중..." },
    { icon: "server", text: "데이터 서버에서 영감을 다운로드하는 중..." },
    { icon: "database", text: "아이디어 데이터베이스를 검색하는 중..." },
    { icon: "cloud", text: "창의력을 클라우드에 백업하는 중..." },
    { icon: "cloud", text: "새로운 아이디어를 다운로드하는 중..." },
    { icon: "settings", text: "창작 엔진을 튜닝하는 중..." },
    { icon: "tool", text: "작문 도구들을 점검하는 중..." },
    { icon: "wrench", text: "스토리 기계를 조정하는 중..." },
    { icon: "cog", text: "플롯 기어를 맞추는 중..." },
    { icon: "monitor", text: "창작 모니터링 중..." },
    { icon: "printer", text: "아이디어를 출력하는 중..." },
    { icon: "smartphone", text: "모바일 영감을 충전하는 중..." },
    { icon: "laptop", text: "랩톱에 창작력을 불어넣는 중..." },
    { icon: "mouse", text: "마우스로 섬세하게 조작하는 중..." },
    { icon: "keyboard", text: "키보드로 문장을 입력하는 중..." },
    { icon: "headphones", text: "집중력을 높이는 음악을 듣는 중..." },

    // 🎨 예술/창작 관련 메시지들
    { icon: "palette", text: "색감과 분위기를 조율하는 중..." },
    { icon: "camera", text: "감독처럼 각도를 계산하는 중..." },
    { icon: "theater", text: "연극 무대를 꾸미는 중..." },
    { icon: "music", text: "BGM을 상상하며 장면을 연출하는 중..." },
    { icon: "microphone", text: "대사 톤을 맞춰보는 중..." },
    { icon: "book-heart", text: "감동 포인트를 전략적으로 배치하는 중..." },
    { icon: "heart", text: "독자의 심장을 두근거리게 만드는 중..." },
    { icon: "eye", text: "시각적 묘사를 섬세하게 다듬는 중..." },
    { icon: "sun", text: "빛과 그림자를 계산하는 중..." },
    { icon: "cloud", text: "분위기를 맞춰보는 중..." },
    { icon: "wind", text: "장면의 리듬을 조율하는 중..." },
    { icon: "film", text: "장면을 영화처럼 촬영하는 중..." },
    { icon: "video", text: "비주얼을 상상하며 연출하는 중..." },
    { icon: "image", text: "이미지를 생생하게 그려내는 중..." },
    { icon: "brush", text: "붓으로 문장을 칠하는 중..." },
    { icon: "paintbrush", text: "페인트로 감정을 표현하는 중..." },
    { icon: "droplets", text: "감정의 물감을 섞는 중..." },
    { icon: "spray-can", text: "아이디어를 분사하는 중..." },
    { icon: "eraser", text: "불필요한 부분을 지우는 중..." },
    { icon: "highlighter", text: "중요한 부분을 강조하는 중..." },
    { icon: "underline", text: "핵심 라인을 그리는 중..." },
    { icon: "bold", text: "강조할 부분을 두껍게 만드는 중..." },
    { icon: "italic", text: "세련된 느낌을 더하는 중..." },
    { icon: "align-left", text: "문장을 왼쪽으로 정렬하는 중..." },
    { icon: "align-center", text: "중심을 맞추는 중..." },
    { icon: "align-right", text: "균형을 맞추는 중..." },
    { icon: "columns", text: "구조를 기둥처럼 세우는 중..." },

    // 🗺️ 전략/탐험 관련 메시지들
    { icon: "compass", text: "스토리의 방향을 잡는 중..." },
    { icon: "map", text: "플롯 지도를 그리고 있는 중..." },
    { icon: "sword", text: "갈등의 날을 벼리는 중..." },
    { icon: "shield", text: "캐릭터의 방어력을 강화하는 중..." },
    { icon: "target", text: "감정의 목표물을 조준하는 중..." },
    { icon: "bullseye", text: "완벽한 타이밍을 계산하는 중..." },
    { icon: "puzzle", text: "퍼즐 조각들을 맞추는 중..." },
    { icon: "gamepad", text: "게임처럼 플롯을 설계하는 중..." },
    { icon: "dice-6", text: "운명의 주사위를 굴리는 중..." },
    { icon: "clover", text: "행운의 네잎클로버를 찾는 중..." },
    { icon: "treasure", text: "보물 같은 아이디어를 찾는 중..." },
    { icon: "key", text: "스토리의 핵심 열쇠를 찾는 중..." },
    { icon: "lock", text: "플롯의 잠금을 해제하는 중..." },
    { icon: "unlock", text: "새로운 가능성을 여는 중..." },
    { icon: "anchor", text: "스토리의 닻을 내리는 중..." },
    { icon: "sailboat", text: "이야기의 바다를 항해하는 중..." },
    { icon: "mountain", text: "등반할 만한 도전을 찾는 중..." },
    { icon: "flag", text: "목표 지점을 설정하는 중..." },
    { icon: "crosshair", text: "정밀하게 조준하는 중..." },
    { icon: "scope", text: "미래를 내다보는 중..." },
    { icon: "binoculars", text: "먼저 도착한 결말을 엿보는 중..." },
    { icon: "search", text: "완벽한 해결책을 찾는 중..." },
    { icon: "filter", text: "필요한 것만 걸러내는 중..." },
    { icon: "funnel", text: "아이디어를 집중시키는 중..." },
    { icon: "bar-chart", text: "스토리의 균형을 분석하는 중..." },
    { icon: "pie-chart", text: "구성 요소의 비율을 맞추는 중..." },
    { icon: "trending-up", text: "긴장감을 상승시키는 중..." },
    { icon: "trending-down", text: "감정을 안정시키는 중..." },

    // 🧙‍♂️ 판타지/마법 관련 메시지들
    { icon: "wand", text: "마법의 지팡이로 창작하는 중..." },
    { icon: "magic-wand", text: "요술 방망이로 영감을 불러오는 중..." },
    { icon: "ghost", text: "유령 같은 아이디어를 붙잡는 중..." },
    { icon: "alien", text: "외계인 같은 상상력을 발휘하는 중..." },
    { icon: "robot", text: "로봇처럼 정확하게 계산하는 중..." },
    { icon: "gem", text: "수정구에 미래를 비추는 중..." },
    { icon: "skull", text: "어둠의 비밀을 캐는 중..." },
    { icon: "skull", text: "해골의 기억을 더듬는 중..." },
    { icon: "refresh-ccw", text: "죽은 아이디어를 되살리는 중..." },
    { icon: "droplet", text: "피처럼 진한 영감을 빨아들이는 중..." },
    { icon: "star", text: "마녀의 주문을 외우는 중..." },
    { icon: "castle", text: "성처럼 웅장한 플롯을 짓는 중..." },
    { icon: "dragon", text: "용 같은 에너지를 불어넣는 중..." },
    { icon: "fairy", text: "요정의 마법을 걸어주는 중..." },
    { icon: "star", text: "유니콘의 상상을 불러오는 중..." },
    { icon: "waves", text: "인어처럼 매혹적인 문장을 만드는 중..." },
    { icon: "leaf", text: "엘프처럼 섬세하게 다듬는 중..." },
    { icon: "hammer", text: "드워프처럼 튼튼하게 쌓아올리는 중..." },
    { icon: "user", text: "마법사처럼 현명하게 결정하는 중..." },
    { icon: "flask", text: "마법의 물약을 섞는 중..." },
    { icon: "file-text", text: "고대 두루마리를 펼치는 중..." },
    { icon: "door-open", text: "고대의 문을 여는 중..." },

    // 🏆 성취/승리 관련 메시지들
    { icon: "flame", text: "열정을 불태우며 창작하는 중..." },
    { icon: "crown", text: "마스터피스를 탄생시키는 중..." },
    { icon: "gem", text: "보석 같은 문장을 갈고닦는 중..." },
    { icon: "trophy", text: "작품의 승리를 기원하는 중..." },
    { icon: "rocket", text: "스토리를 우주로 쏘아올리는 중..." },
    { icon: "medal", text: "금메달급 문장을 만드는 중..." },
    { icon: "star", text: "별처럼 빛나는 아이디어를 찾는 중..." },
    { icon: "hand", text: "완벽에 엄지손가락을 치켜세우는 중..." },
    { icon: "square-check", text: "모든 체크박스를 채우는 중..." },
    { icon: "award", text: "상받을 만한 작품을 만드는 중..." },
    { icon: "party", text: "축하할 만한 순간을 기다리는 중..." },
    { icon: "confetti", text: "완성의 폭죽을 터뜨리는 중..." },
    { icon: "fireworks", text: "불꽃놀이 같은 클라이맥스를 준비하는 중..." },
    { icon: "champagne", text: "샴페인을 터뜨릴 만한 작품을 만드는 중..." },
    { icon: "gift", text: "독자들에게 선물을 준비하는 중..." },
    { icon: "ribbon", text: "리본으로 예쁘게 포장하는 중..." },
    { icon: "badge", text: "품질 인증 마크를 받는 중..." },
    { icon: "verified", text: "검증된 명작을 만드는 중..." },
    { icon: "shield", text: "완벽한 방어력을 갖춘 작품을 만드는 중..." },
    { icon: "hand", text: "모든 사람이 박수를 보낼 작품을 만드는 중..." },
    { icon: "handshake", text: "독자와의 감동적인 악수를 준비하는 중..." },
    { icon: "hand-heart", text: "마음을 움직이는 작품을 만드는 중..." }
];

/**
 * 메시지 배열에서 랜덤하게 섞인 복사본을 반환합니다.
 * @returns {Array} 섞인 메시지 배열
 */
export function getShuffledMessages() {
    return [...aiWritingMessages].sort(() => 0.5 - Math.random());
}

/**
 * 특정 카테고리의 메시지만 필터링해서 반환합니다.
 * @param {string} category - 카테고리 ('creative', 'tech', 'art', 'strategy', 'fantasy', 'achievement')
 * @returns {Array} 필터링된 메시지 배열
 */
export function getMessagesByCategory(category) {
    const categoryMap = {
        creative: ['star', 'user-check', 'wrench', 'brain-circuit', 'blender', 'users', 'tv', 'brick', 'sparkles', 'bot', 'lightbulb', 'battery-charging', 'coffee', 'award', 'book-open', 'feather', 'keyboard', 'moon', 'pen', 'type', 'edit', 'layers', 'scissors', 'copy', 'rotate-ccw', 'zoom-in', 'zoom-out', 'shuffle', 'repeat', 'maximize', 'minimize', 'move', 'corner-down-right', 'check-circle', 'x'],
        tech: ['zap', 'atom', 'dna', 'cpu', 'hard-drive', 'wifi', 'battery', 'plug', 'microscope', 'telescope', 'server', 'database', 'cloud', 'cloud', 'settings', 'tool', 'wrench', 'cog', 'monitor', 'printer', 'smartphone', 'laptop', 'mouse', 'keyboard', 'headphones'],
        art: ['palette', 'camera', 'theater', 'music', 'microphone', 'book-heart', 'heart', 'eye', 'sun', 'cloud', 'wind', 'film', 'video', 'image', 'brush', 'paintbrush', 'droplets', 'spray-can', 'eraser', 'highlighter', 'underline', 'bold', 'italic', 'align-left', 'align-center', 'align-right', 'columns'],
        strategy: ['compass', 'map', 'sword', 'shield', 'target', 'bullseye', 'puzzle', 'gamepad', 'dice-6', 'clover', 'treasure', 'key', 'lock', 'unlock', 'anchor', 'sailboat', 'mountain', 'flag', 'crosshair', 'scope', 'binoculars', 'search', 'filter', 'funnel', 'bar-chart', 'pie-chart', 'trending-up', 'trending-down'],
        fantasy: ['wand', 'magic-wand', 'ghost', 'alien', 'robot', 'gem', 'skull', 'skull', 'refresh-ccw', 'droplet', 'star', 'castle', 'dragon', 'fairy', 'star', 'waves', 'leaf', 'hammer', 'user', 'flask', 'file-text', 'door-open'],
        achievement: ['flame', 'crown', 'gem', 'trophy', 'rocket', 'medal', 'star', 'hand', 'square-check', 'award', 'party', 'confetti', 'fireworks', 'champagne', 'gift', 'ribbon', 'badge', 'verified', 'shield', 'hand', 'handshake', 'hand-heart']
    };

    const icons = categoryMap[category] || [];
    return aiWritingMessages.filter(msg => icons.includes(msg.icon));
}

/**
 * 새로운 메시지를 추가합니다.
 * @param {string} icon - Lucide 아이콘 이름
 * @param {string} text - 메시지 텍스트
 */
export function addMessage(icon, text) {
    aiWritingMessages.push({ icon, text });
}

/**
 * 메시지를 제거합니다.
 * @param {string} icon - 제거할 아이콘 이름
 * @param {string} text - 제거할 메시지 텍스트
 */
export function removeMessage(icon, text) {
    const index = aiWritingMessages.findIndex(msg => msg.icon === icon && msg.text === text);
    if (index > -1) {
        aiWritingMessages.splice(index, 1);
    }
}

/**
 * 메시지를 수정합니다.
 * @param {string} oldIcon - 기존 아이콘 이름
 * @param {string} oldText - 기존 메시지 텍스트
 * @param {string} newIcon - 새 아이콘 이름
 * @param {string} newText - 새 메시지 텍스트
 */
export function updateMessage(oldIcon, oldText, newIcon, newText) {
    const index = aiWritingMessages.findIndex(msg => msg.icon === oldIcon && msg.text === oldText);
    if (index > -1) {
        aiWritingMessages[index] = { icon: newIcon, text: newText };
    }
}

/**
 * 현재 메시지 개수를 반환합니다.
 * @returns {number} 메시지 개수
 */
export function getMessageCount() {
    return aiWritingMessages.length;
}

/**
 * 특정 아이콘을 사용하는 메시지들을 반환합니다.
 * @param {string} icon - 아이콘 이름
 * @returns {Array} 해당 아이콘을 사용하는 메시지들
 */
export function getMessagesByIcon(icon) {
    return aiWritingMessages.filter(msg => msg.icon === icon);
}
