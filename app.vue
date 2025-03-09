<script setup lang="ts">
// 타이머 인터페이스 정의
interface Timer {
  id: string;
  endTime: number;
  initialDuration: number;
  remaining: number;
  createdAt: number;
}

// 상태 관리
const timers = ref<Timer[]>([]);
const timeInput = ref<string>('');
const timerUpdateInterval = ref<number | null>(null);

// 서비스 워커 등록
function registerServiceWorker(): void {
  if (globalThis.navigator?.serviceWorker != null) {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        console.log('Service Worker 등록 성공:', registration);
      })
      .catch(error => {
        console.error('Service Worker 등록 실패:', error);
      });

    // 서비스 워커로부터 메시지 받기
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data.action === 'TIMER_COMPLETE') {
        loadTimers();
      }
    });
  }
}

// 알림 권한 요청
async function requestNotificationPermission(): Promise<void> {
  if (!('Notification' in globalThis)) {
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

// 시간 파싱 함수
function parseTimeInput(input: string): number {
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
function addTimer(): void {
  const totalSeconds = parseTimeInput(timeInput.value);

  if (totalSeconds <= 0) {
    alert('올바른 시간 형식을 입력해주세요.');
    return;
  }

  const now = new Date();
  const endTime = new Date(now.getTime() + totalSeconds * 1000);

  const timer: Timer = {
    id: Date.now().toString(),
    endTime: endTime.getTime(),
    initialDuration: totalSeconds,
    remaining: totalSeconds,
    createdAt: now.getTime()
  };

  timers.value.push(timer);
  saveTimers();

  // 서비스 워커에 타이머 등록
  globalThis.navigator.serviceWorker?.controller?.postMessage({
    action: 'ADD_TIMER',
    timer: timer
  });

  // 입력 필드 초기화
  timeInput.value = '';
}

// 타이머 제거 함수
function removeTimer(id: string): void {
  timers.value = timers.value.filter(timer => timer.id !== id);
  saveTimers();

  // 서비스 워커에 타이머 제거 알림
  globalThis.navigator.serviceWorker?.controller?.postMessage({
    action: 'REMOVE_TIMER',
    id: id
  });
}

// 타이머 저장 함수
function saveTimers(): void {
  localStorage.setItem('pikminBloomTimers', JSON.stringify(timers.value));
}

// 타이머 불러오기 함수
function loadTimers(): void {
  const savedTimers = localStorage.getItem('pikminBloomTimers');
  if (savedTimers) {
    const loadedTimers = JSON.parse(savedTimers) as Timer[];

    // 만료된 타이머 제거
    const now = Date.now();
    timers.value = loadedTimers.filter(timer => timer.endTime > now);

    // 타이머 정렬
    timers.value.sort((a, b) => a.endTime - b.endTime);

    saveTimers();
  }
}

// 시간 형식 변환 함수 (초 -> HH:MM:SS)
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)}`;
}

// 숫자 앞에 0 채우기 함수
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

// 타이머 업데이트 시작 함수
function startTimerUpdates(): void {
  timerUpdateInterval.value = window.setInterval(() => {
    updateTimers();
  }, 1000) as unknown as number;
}

// 타이머 업데이트 함수
function updateTimers(): void {
  const now = Date.now();
  let needSave = false;

  timers.value.forEach(timer => {
    const remaining = Math.max(0, Math.floor((timer.endTime - now) / 1000));

    if (remaining === 0 && timer.remaining > 0) {
      // 타이머 종료 시 알림
      // showNotification(timer);
      needSave = true;
    }

    timer.remaining = remaining;
  });

  // 만료된 타이머 필터링
  const expiredTimers = timers.value.filter(timer => timer.remaining <= 0);
  if (expiredTimers.length > 0) {
    timers.value = timers.value.filter(timer => timer.remaining > 0);
    needSave = true;
  }

  if (needSave) {
    saveTimers();
  }
}

// 알림 표시 함수
function showNotification(timer: Timer): void {
  if (Notification.permission === 'granted') {
    // 브라우저 내부에서도 알림
    const notification = new Notification('피크민블룸 버섯 타이머', {
      body: '버섯이 파괴되었습니다!',
      icon: 'mushroom-icon.png'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

// 엔터 키로 타이머 추가
function handleKeypress(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    addTimer();
  }
}

// 컴포넌트 마운트 시 초기화
onMounted(() => {
  registerServiceWorker();
  requestNotificationPermission();
  loadTimers();
  startTimerUpdates();
});

// 컴포넌트 언마운트 시 타이머 정리
onUnmounted(() => {
  if (timerUpdateInterval.value) {
    clearInterval(timerUpdateInterval.value);
  }
});
</script>

<template>
  <div class="container">
    <h1>피크민블룸 버섯 타이머</h1>

    <div class="input-area">
      <div class="time-input-wrapper">
        <label for="time-input">시간 입력:</label>
        <input type="text" id="time-input" v-model="timeInput" @keypress="handleKeypress"
          placeholder="예: 1:30:00, 1시간 30분, 1h 30m">
        <div class="input-hint">
          <p>입력 예시:</p>
          <ul>
            <li>1:30:45 (시:분:초)</li>
            <li>1시간 30분 (한국어)</li>
            <li>1h 30m 45s (영어)</li>
          </ul>
        </div>
      </div>

      <button @click="addTimer">추가</button>
    </div>

    <div class="timers-container">
      <h2>현재 타이머</h2>
      <ul class="timers-list">
        <li v-if="timers.length === 0" class="empty-message">
          등록된 타이머가 없습니다.
        </li>
        <li v-else v-for="timer in timers" :key="timer.id" class="timer-item">
          <div class="timer-info">
            <span class="timer-time">{{ formatTime(timer.remaining) }}</span>
            <span class="timer-end-time">
              종료: {{ new Date(timer.endTime).toLocaleTimeString() }}
            </span>
          </div>
          <button class="remove-timer" @click="() => removeTimer(timer.id)">제거</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style>
body {
  font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #4a6141;
}

.input-area {
  background-color: white;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.time-input-wrapper {
  position: relative;
}

#time-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  box-sizing: border-box;
}

.input-hint {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 5px;
  padding: 10px;
  margin-top: 10px;
  font-size: 14px;
}

.input-hint p {
  margin: 0 0 5px;
  font-weight: bold;
}

.input-hint ul {
  margin: 0;
  padding-left: 20px;
}

button {
  background-color: #4a6141;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #5a7151;
}

.timers-container {
  background-color: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

h2 {
  margin-top: 0;
  color: #4a6141;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.timers-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-message {
  text-align: center;
  color: #888;
  padding: 20px;
}

.timer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
}

.timer-item:last-child {
  border-bottom: none;
}

.timer-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.timer-time {
  font-size: 24px;
  font-weight: bold;
}

.timer-end-time {
  font-size: 14px;
  color: #666;
}

.remove-timer {
  background-color: #d9534f;
  padding: 8px 12px;
  font-size: 14px;
}

.remove-timer:hover {
  background-color: #c9302c;
}

@media (min-width: 600px) {
  .input-area {
    flex-direction: row;
    align-items: flex-end;
  }

  .time-input-wrapper {
    flex-grow: 1;
  }

  button {
    align-self: flex-end;
  }
}
</style>
