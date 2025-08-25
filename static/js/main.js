import { App } from './core/App.js';

// App 인스턴스를 생성하여 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    // 애플리케이션 초기화
    new App();

    // 사이드바 리사이즈 기능 초기화
    initResizableSidebar();
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

// 리팩토링 완료: 모든 비즈니스 로직은 App.js와 StateManager로 이동됨
