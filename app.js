// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker 등록 성공:', registration);
            })
            .catch(error => {
                console.error('Service Worker 등록 실패:', error);
            });
    });
}

// 알림 권한 요청
requestNotificationPermission();

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('이 브라우저는 알림 기능을 지원하지 않습니다.');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('알림 권한이 허용되었습니다.');
            }
        } catch (error) {
            console.error('알림 권한 요청 중 오류 발생:', error);
        }
    }
}

// DOM 요소
const timeInputElement = document.getElementById('time-input');
const addTimerButton = document.getElementById('add-timer');
const timersListElement = document.getElementById('timers-list');

// 타이머 배열
let timers = [];

// 페이지 로드 시 저장된 타이머 불러오기
document.addEventListener('DOMContentLoaded', () => {
    loadTimers();
    renderTimers();
    startTimerUpdates();
});

// 타이머 추가 버튼 이벤트 리스너
addTimerButton.addEventListener('click', addTimer);

// 시간 파싱 함수
function parseTimeInput(input) {
    // 입력 문자열을 소문자로 변환하고 앞뒤 공백 제거
    const timeStr = input.trim().toLowerCase();
    
    // 입력이 비어있으면 0 반환
    if (!timeStr) {
        return 0;
    }
    
    // 시:분:초 형식 (1:30:45 또는 1:30)
    const timePattern = /^(\d+):(\d+)(?::(\d+))?$/;
    const timeMatch = timeStr.match(timePattern);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]) || 0;
        const minutes = parseInt(timeMatch[2]) || 0;
        const seconds = parseInt(timeMatch[3]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    // 한국어 시간 형식 (1시간 30분 45초, 30분 45초, 10초 등)
    const korHours = timeStr.match(/(\d+)\s*시간/);
    const korMinutes = timeStr.match(/(\d+)\s*분/);
    const korSeconds = timeStr.match(/(\d+)\s*초/);
    
    if (korHours || korMinutes || korSeconds) {
        const hours = korHours ? parseInt(korHours[1]) : 0;
        const minutes = korMinutes ? parseInt(korMinutes[1]) : 0;
        const seconds = korSeconds ? parseInt(korSeconds[1]) : 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    // 영어 시간 형식 (1h 30m 45s, 30m 45s, 10s 등)
    const engHours = timeStr.match(/(\d+)\s*h(?:our)?s?/);
    const engMinutes = timeStr.match(/(\d+)\s*m(?:in(?:ute)?)?s?/);
    const engSeconds = timeStr.match(/(\d+)\s*s(?:ec(?:ond)?)?s?/);
    
    if (engHours || engMinutes || engSeconds) {
        const hours = engHours ? parseInt(engHours[1]) : 0;
        const minutes = engMinutes ? parseInt(engMinutes[1]) : 0;
        const seconds = engSeconds ? parseInt(engSeconds[1]) : 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    // 숫자만 입력한 경우 (기본 단위: 분)
    if (/^\d+$/.test(timeStr)) {
        return parseInt(timeStr) * 60;
    }
    
    // 파싱할 수 없는 경우 0 반환
    return 0;
}

// 타이머 추가 함수
function addTimer() {
    const timeInput = timeInputElement.value;
    const totalSeconds = parseTimeInput(timeInput);
    
    if (totalSeconds <= 0) {
        alert('올바른 시간 형식을 입력해주세요.');
        return;
    }
    
    const now = new Date();
    const endTime = new Date(now.getTime() + totalSeconds * 1000);
    
    const timer = {
        id: Date.now().toString(),
        endTime: endTime.getTime(),
        initialDuration: totalSeconds,
        remaining: totalSeconds,
        createdAt: now.getTime()
    };
    
    timers.push(timer);
    saveTimers();
    renderTimers();
    
    // 서비스 워커에 타이머 등록
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            action: 'ADD_TIMER',
            timer: timer
        });
    }
    
    // 입력 필드 초기화
    timeInputElement.value = '';
}

// 엔터 키로 타이머 추가 가능하도록
timeInputElement.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addTimer();
    }
});

// 타이머 제거 함수
function removeTimer(id) {
    timers = timers.filter(timer => timer.id !== id);
    saveTimers();
    renderTimers();
    
    // 서비스 워커에 타이머 제거 알림
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            action: 'REMOVE_TIMER',
            id: id
        });
    }
}

// 타이머 저장 함수
function saveTimers() {
    localStorage.setItem('pikminBloomTimers', JSON.stringify(timers));
}

// 타이머 불러오기 함수
function loadTimers() {
    const savedTimers = localStorage.getItem('pikminBloomTimers');
    if (savedTimers) {
        timers = JSON.parse(savedTimers);
        
        // 만료된 타이머 제거
        const now = Date.now();
        timers = timers.filter(timer => timer.endTime > now);
        saveTimers();
    }
}

// 타이머 목록 렌더링 함수
function renderTimers() {
    timersListElement.innerHTML = '';
    
    if (timers.length === 0) {
        timersListElement.innerHTML = '<li class="empty-message">등록된 타이머가 없습니다.</li>';
        return;
    }
    
    timers.sort((a, b) => a.endTime - b.endTime);
    
    timers.forEach(timer => {
        const timerElement = document.createElement('li');
        timerElement.className = 'timer-item';
        
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((timer.endTime - now) / 1000));
        
        const timerInfo = document.createElement('div');
        timerInfo.className = 'timer-info';
        
        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'timer-time';
        timeDisplay.textContent = formatTime(remaining);
        
        const endTimeDisplay = document.createElement('span');
        endTimeDisplay.className = 'timer-end-time';
        endTimeDisplay.textContent = `종료: ${new Date(timer.endTime).toLocaleTimeString()}`;
        
        timerInfo.appendChild(timeDisplay);
        timerInfo.appendChild(endTimeDisplay);
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-timer';
        removeButton.textContent = '제거';
        removeButton.addEventListener('click', () => removeTimer(timer.id));
        
        timerElement.appendChild(timerInfo);
        timerElement.appendChild(removeButton);
        
        timersListElement.appendChild(timerElement);
    });
}

// 시간 형식 변환 함수 (초 -> HH:MM:SS)
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)}`;
}

// 숫자 앞에 0 채우기 함수
function padZero(num) {
    return num.toString().padStart(2, '0');
}

// 타이머 업데이트 시작 함수
function startTimerUpdates() {
    setInterval(() => {
        const now = Date.now();
        let needSave = false;
        
        timers.forEach(timer => {
            const remaining = Math.max(0, Math.floor((timer.endTime - now) / 1000));
            
            if (remaining === 0 && timer.remaining > 0) {
                // 타이머 종료 시 알림
                showNotification(timer);
                needSave = true;
            }
            
            timer.remaining = remaining;
        });
        
        // 만료된 타이머 필터링
        const expiredTimers = timers.filter(timer => timer.remaining <= 0);
        if (expiredTimers.length > 0) {
            timers = timers.filter(timer => timer.remaining > 0);
            needSave = true;
        }
        
        if (needSave) {
            saveTimers();
        }
        
        renderTimers();
    }, 1000);
}

// 알림 표시 함수
function showNotification(timer) {
    if (Notification.permission === 'granted') {
        // 브라우저 내부에서도 알림
        const notification = new Notification('피크민블룸 버섯 타이머', {
            body: '버섯이 재생성되었습니다!',
            icon: 'mushroom-icon.png'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

// 서비스 워커로부터 메시지 받기
navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.action === 'TIMER_COMPLETE') {
        loadTimers();
        renderTimers();
    }
});