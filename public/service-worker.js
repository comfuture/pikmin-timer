importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyAf784SLE9SP8rgmBOvPY1Y7nW_GMwMNAw",
    authDomain: "cube-timer-927ef.firebaseapp.com",
    projectId: "cube-timer-927ef",
    storageBucket: "cube-timer-927ef.firebasestorage.app",
    messagingSenderId: "648110249193",
    appId: "1:648110249193:web:9dc39ebab6af56dfce0c78",
    measurementId: "G-JZD388FHEZ"
};

const fb = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
let token = null;
messaging.getToken(messaging, { vapidKey: 'BAK5VZaNTmajMt_ob4UO1JKcVm6yhhNZvWDZ1OiNkfS8lE2yaomrhnOue9sQgbMKdGk3e_oVUM3cr_-8vfMZXSI' })
    .then((currentToken) => {
        if (currentToken) {
            console.log('Token:', currentToken);
            token = currentToken;
        }
    })
    .catch((err) => {
        console.log('Error getting token:', err);
    }
    );

messaging.onBackgroundMessage((payload) => {
    console.log('Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

const CACHE_NAME = 'pikmin-bloom-timer-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// 서비스 워커 설치
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// 서비스 워커 활성화 - 이전 캐시 삭제
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

// 타이머 관리
let timers = [];

// 메시지 처리
self.addEventListener('message', event => {
    const data = event.data;

    switch (data.action) {
        case 'ADD_TIMER':
            timers.push(data.timer);
            scheduleNotification(data.timer);
            break;

        case 'REMOVE_TIMER':
            timers = timers.filter(timer => timer.id !== data.id);
            break;

        case 'SYNC_TIMERS':
            timers = data.timers;
            timers.forEach(timer => scheduleNotification(timer));
            break;
    }
});

// 알림 스케줄링
function scheduleNotification(timer) {
    const now = Date.now();
    const delay = timer.endTime - now;

    if (delay <= 0) return;

    setTimeout(() => {
        showNotification(timer);

        // 클라이언트에 타이머 완료 알림
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    action: 'TIMER_COMPLETE',
                    timerId: timer.id
                });
            });
        });

    }, delay);
}

// 알림 표시
function showNotification(timer) {
    self.registration.showNotification('피크민블룸 버섯 타이머', {
        body: '버섯이 파괴되었습니다!',
        icon: 'icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            timerId: timer.id,
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'open',
                title: '앱 열기'
            },
            {
                action: 'close',
                title: '닫기'
            }
        ],
        requireInteraction: true
    });
}

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'open') {
        // 앱 열기
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(clients => {
                // 열려있는 창이 있으면 포커스
                for (const client of clients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // 없으면 새 창 열기
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/');
                }
            })
        );
    }
});

// 주기적으로 타이머 상태 확인
setInterval(() => {
    const now = Date.now();
    timers = timers.filter(timer => timer.endTime > now);
}, 60000);