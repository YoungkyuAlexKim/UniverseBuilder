import { App } from './core/App.js';

// App 인스턴스를 생성하여 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    // 애플리케이션 초기화
    new App();

    // 사이드바 리사이즈 기능 초기화
    initResizableSidebar();
    
    // AI 모델 토글 카드 기능 초기화
    initAiModelToggle();
});

/**
 * 사이드바 리사이즈 기능을 초기화합니다.
 */
function initResizableSidebar() {
    const resizer = document.getElementById('resizer');
    const root = document.documentElement;
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopResizing);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 600) newWidth = 600;
        root.style.setProperty('--sidebar-width', newWidth + 'px');
    }

    function stopResizing() {
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopResizing);
    }
}

/**
 * AI 모델 토글 카드 기능을 초기화합니다.
 */
function initAiModelToggle() {
    const modelCards = document.querySelectorAll('.model-card');
    const hiddenSelect = document.getElementById('ai-model-select');
    
    if (!modelCards.length || !hiddenSelect) {
        return;
    }
    
    modelCards.forEach(card => {
        card.addEventListener('click', () => {
            // 모든 카드에서 active 클래스 제거
            modelCards.forEach(c => c.classList.remove('active'));
            
            // 클릭된 카드에 active 클래스 추가
            card.classList.add('active');
            
            // 숨겨진 select 값 업데이트 (기존 JS 코드와의 호환성을 위해)
            const modelValue = card.dataset.value;
            if (modelValue) {
                hiddenSelect.value = modelValue;
                
                // change 이벤트 발생 (다른 코드에서 이벤트를 리슨하고 있을 수 있음)
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
    
    // 초기 상태: active 카드와 select 값 동기화
    const activeCard = document.querySelector('.model-card.active');
    if (activeCard && activeCard.dataset.value) {
        hiddenSelect.value = activeCard.dataset.value;
    }
}

// 리팩토링 완료: 모든 비즈니스 로직은 App.js와 StateManager로 이동됨
