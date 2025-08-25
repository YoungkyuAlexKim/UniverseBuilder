/**
 * Pub/Sub 패턴을 구현한 간단한 이벤트 버스 클래스.
 * 모듈 간의 직접적인 의존성을 줄이고, 이벤트 기반으로 통신할 수 있게 돕습니다.
 */
export class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * 특정 이벤트에 대한 리스너(콜백 함수)를 등록합니다.
     * @param {string} eventName - 구독할 이벤트의 이름
     * @param {Function} listener - 이벤트가 발생했을 때 실행될 콜백 함수
     */
    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    /**
     * 특정 이벤트에 대한 리스너를 해제합니다.
     * @param {string} eventName - 구독을 해제할 이벤트의 이름
     * @param {Function} listenerToRemove - 제거할 콜백 함수
     */
    off(eventName, listenerToRemove) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName] = this.events[eventName].filter(listener => listener !== listenerToRemove);
    }

    /**
     * 특정 이벤트를 발생시킵니다. 해당 이벤트를 구독하는 모든 리스너가 실행됩니다.
     * @param {string} eventName - 발생시킬 이벤트의 이름
     * @param {any} data - 리스너에게 전달할 데이터
     */
    emit(eventName, data) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName].forEach(listener => listener(data));
    }
}
