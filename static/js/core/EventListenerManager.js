/**
 * 이벤트 리스너 관리를 위한 클래스
 * 메모리 누수를 방지하고 체계적인 이벤트 관리를 제공합니다.
 */
export class EventListenerManager {
    constructor() {
        this.listeners = new Map(); // element -> [eventType, handler, options] 배열
        this.delegatedListeners = new Map(); // selector -> [eventType, handler, options] 배열
    }

    /**
     * 요소에 이벤트 리스너를 추가하고 추적합니다.
     * @param {Element} element - 대상 요소
     * @param {string} eventType - 이벤트 타입 (e.g., 'click')
     * @param {Function} handler - 이벤트 핸들러
     * @param {Object} options - 이벤트 옵션
     */
    addEventListener(element, eventType, handler, options = {}) {
        if (!element || !eventType || !handler) {
            console.warn('EventListenerManager: 유효하지 않은 매개변수', { element, eventType, handler });
            return;
        }

        const key = this._getElementKey(element);
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }

        // 중복 추가 방지
        const existingListener = this.listeners.get(key).find(
            listener => listener.eventType === eventType && listener.handler === handler
        );

        if (!existingListener) {
            element.addEventListener(eventType, handler, options);
            this.listeners.get(key).push({
                eventType,
                handler,
                options,
                element // 참조 유지
            });
        }
    }

    /**
     * 요소에서 특정 이벤트 리스너를 제거합니다.
     * @param {Element} element - 대상 요소
     * @param {string} eventType - 이벤트 타입
     * @param {Function} handler - 이벤트 핸들러
     */
    removeEventListener(element, eventType, handler) {
        if (!element || !eventType || !handler) return;

        const key = this._getElementKey(element);
        const elementListeners = this.listeners.get(key);

        if (elementListeners) {
            const listenerIndex = elementListeners.findIndex(
                listener => listener.eventType === eventType && listener.handler === handler
            );

            if (listenerIndex !== -1) {
                element.removeEventListener(eventType, handler);
                elementListeners.splice(listenerIndex, 1);

                if (elementListeners.length === 0) {
                    this.listeners.delete(key);
                }
            }
        }
    }

    /**
     * 요소에서 모든 이벤트 리스너를 제거합니다.
     * @param {Element} element - 대상 요소
     */
    removeAllEventListeners(element) {
        if (!element) return;

        const key = this._getElementKey(element);
        const elementListeners = this.listeners.get(key);

        if (elementListeners) {
            // 모든 이벤트 리스너 제거
            elementListeners.forEach(({ eventType, handler }) => {
                element.removeEventListener(eventType, handler);
            });

            this.listeners.delete(key);
        }
    }

    /**
     * 컨테이너 내의 모든 요소에서 이벤트 리스너를 제거합니다.
     * @param {Element} container - 컨테이너 요소
     */
    removeAllEventListenersInContainer(container) {
        if (!container) return;

        // 현재 추적 중인 모든 리스너를 확인
        for (const [key, listeners] of this.listeners.entries()) {
            const element = listeners[0]?.element; // 첫 번째 리스너의 요소 참조 사용
            if (element && container.contains(element)) {
                this.removeAllEventListeners(element);
            }
        }
    }

    /**
     * 요소의 고유 키를 생성합니다.
     * @private
     */
    _getElementKey(element) {
        // 요소의 고유 식별자를 생성
        if (element.id) {
            return `id-${element.id}`;
        } else if (element.className) {
            return `class-${element.className}`;
        } else {
            // fallback: 요소 타입과 타임스탬프
            return `element-${element.tagName}-${Date.now()}`;
        }
    }

    /**
     * 안전하게 DOM을 교체하면서 이벤트 리스너를 정리합니다.
     * @param {Element} container - 컨테이너 요소
     * @param {string} newHtml - 새로운 HTML 내용
     * @param {Function} setupCallback - 새로운 요소에 이벤트 리스너를 설정하는 콜백
     */
    replaceContentSafely(container, newHtml, setupCallback = null) {
        if (!container) return;

        // 기존 이벤트 리스너 모두 제거
        this.removeAllEventListenersInContainer(container);

        // 내용 교체
        container.innerHTML = newHtml;

        // 새로운 이벤트 리스너 설정
        if (setupCallback && typeof setupCallback === 'function') {
            setupCallback(container);
        }
    }

    /**
     * 모든 이벤트 리스너를 정리합니다.
     */
    cleanup() {
        for (const [key, listeners] of this.listeners.entries()) {
            listeners.forEach(({ element, eventType, handler }) => {
                if (element && element.removeEventListener) {
                    element.removeEventListener(eventType, handler);
                }
            });
        }
        this.listeners.clear();
        this.delegatedListeners.clear();
    }
}
