/* eslint-disable no-restricted-globals */
/* eslint-env serviceworker */

// 캐시 이름 및 버전 정의
const DYNAMIC_CACHE = 'mytripstyle-dynamic-v1';
const APP_SHELL_CACHE = 'mytripstyle-appshell-v1';
const DATA_CACHE = 'mytripstyle-data-v1';

// 오프라인 페이지
const OFFLINE_PAGE = '/offline.html';

// 기본 캐싱할 자원 리스트 (앱 셸)
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/static/media/logo.png',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/maskable_icon.png'
];

// API 요청 패턴
const API_PATTERNS = [
  /^https:\/\/firestore\.googleapis\.com/,
  /^https:\/\/firebase\.googleapis\.com/,
  /^https:\/\/storage\.googleapis\.com/
];

// 항상 네트워크 우선으로 처리할 요청 패턴
const NETWORK_FIRST_PATTERNS = [
  /\/api\/recommendations/,
  /\/api\/places/,
  /\/place\//
];

// 캐시 우선으로 처리할 요청 패턴
const CACHE_FIRST_PATTERNS = [
  /\.(?:js|css|png|jpg|jpeg|svg|gif|ico|woff2|woff|ttf)$/
];

// 서비스 워커 설치 시 실행
addEventListener('install', event => {
  console.log('[Service Worker] Installing Service Worker...');
  
  // waitUntil()은 프로미스가 완료될 때까지 설치 단계를 연장
  event.waitUntil(
    // 정적 자원을 캐시에 저장
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching app shell and static assets');
        // 오프라인 페이지 반드시 캐시
        cache.add(OFFLINE_PAGE);
        // 정적 자원 캐싱
        return cache.addAll(APP_SHELL_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting on install');
        // 새 서비스 워커가 즉시 활성화되도록 skipWaiting 수행
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] Error during cache setup:', err);
      })
  );
});

// 서비스 워커 활성화 시 실행
addEventListener('activate', event => {
  console.log('[Service Worker] Activating Service Worker...');
  
  // 기존 캐시 정리
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 현재 버전의 캐시가 아니면 삭제
            if (
              cacheName !== APP_SHELL_CACHE && 
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== DATA_CACHE
            ) {
              console.log('[Service Worker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        // 현재 열려있는 페이지에 대해 컨트롤 획득
        return clients.claim();
      })
      .catch(err => {
        console.error('[Service Worker] Error during activation:', err);
      })
  );
});

// 네트워크 요청 가로채기
addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // 같은 도메인의 요청만 처리 (CORS 이슈 방지)
  // API 요청은 API_PATTERNS에 정의된 패턴과 일치하는 경우에만 처리
  const isAPIRequest = API_PATTERNS.some(pattern => pattern.test(event.request.url));
  
  // 같은 도메인 요청 또는 허용된 API 요청만 처리
  if (requestUrl.origin === location.origin || isAPIRequest) {
    // 네비게이션 요청 처리 (HTML 페이지 요청)
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .catch(() => {
            // 네트워크 오류 시 오프라인 페이지 제공
            return caches.match(OFFLINE_PAGE);
          })
      );
      return;
    }
    
    // API 또는 동적 데이터 요청인 경우
    if (isAPIRequest || NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(event.request.url))) {
      // 네트워크 우선 전략 적용
      event.respondWith(networkFirstStrategy(event.request));
    } 
    // 정적 자산 요청인 경우
    else if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(event.request.url))) {
      // 캐시 우선 전략 적용
      event.respondWith(cacheFirstStrategy(event.request));
    }
    // 기타 요청인 경우 (HTML 페이지 등)
    else {
      // 스테일-와일-리밸리데이트 전략 적용
      event.respondWith(staleWhileRevalidateStrategy(event.request));
    }
  }
});

// 네트워크 우선 전략 (Network First)
async function networkFirstStrategy(request) {
  try {
    // 네트워크 요청 시도
    const networkResponse = await fetch(request);
    
    // 네트워크 성공 시 응답을 캐시에 저장
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DATA_CACHE);
      // 복제본을 저장 (응답은 스트림이라 한 번만 사용 가능)
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (err) {
    // 네트워크 실패 시 캐시에서 검색
    console.log('[Service Worker] Network request failed, getting from cache');
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // API 요청이고 캐시에 없는 경우, 오프라인 데이터로 응답
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'offline',
          message: '오프라인 상태입니다. 저장된 데이터만 이용할 수 있습니다.'
        }),
        { 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // HTML 요청이고 캐시에 없는 경우 오프라인 페이지 반환
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match(OFFLINE_PAGE);
    }
    
    // 기타 모든 실패의 경우 404 응답
    return new Response('Resource not found', { status: 404 });
  }
}

// 캐시 우선 전략 (Cache First)
async function cacheFirstStrategy(request) {
  // 먼저 캐시에서 확인
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // 캐시에 없으면 네트워크에서 가져오기
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      // 복제본을 저장 (응답은 스트림이라 한 번만 사용 가능)
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (err) {
    // 정적 자산이고 응답이 없는 경우 오프라인 페이지 반환
    console.error('[Service Worker] Error fetching resource:', err);
    
    // HTML 요청이면 오프라인 페이지 반환
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match(OFFLINE_PAGE);
    }
    
    // 기타 요청은 404 응답
    return new Response('Resource not found', { status: 404 });
  }
}

// 스테일-와일-리밸리데이트 전략 (Stale While Revalidate)
async function staleWhileRevalidateStrategy(request) {
  // 캐시 확인
  const cachedResponse = await caches.match(request);
  
  // 캐시 업데이트 시도 (백그라운드에서)
  const networkResponsePromise = fetch(request)
    .then(async response => {
      if (response && response.status === 200) {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(err => {
      console.error('[Service Worker] Error in stale-while-revalidate strategy:', err);
      // 오류 시 null 반환
      return null;
    });
  
  // 캐시된 응답이 있으면 즉시 반환
  if (cachedResponse) {
    // 백그라운드에서 캐시 업데이트 계속 진행
    return cachedResponse;
  }
  
  // 캐시된 응답이 없으면 네트워크 응답 대기
  const networkResponse = await networkResponsePromise;
  
  if (networkResponse) {
    return networkResponse;
  }
  
  // 모든 것이 실패하면 오프라인 페이지 제공
  if (request.headers.get('accept')?.includes('text/html')) {
    return caches.match(OFFLINE_PAGE);
  }
  
  // 기타 요청은 404 응답
  return new Response('Resource not found', { status: 404 });
}

// 백그라운드 동기화 처리
addEventListener('sync', event => {
  console.log('[Service Worker] Background Syncing', event.tag);
  
  if (event.tag === 'sync-saved-places') {
    event.waitUntil(syncSavedPlaces());
  } else if (event.tag === 'sync-feedbacks') {
    event.waitUntil(syncFeedbacks());
  } else if (event.tag === 'sync-visits') {
    event.waitUntil(syncVisits());
  }
});

// 저장된 장소 동기화
async function syncSavedPlaces() {
  try {
    // IndexedDB에서 동기화 대기 중인 저장된 장소 데이터 가져오기
    const syncQueueData = await getSyncQueueData('savedPlaces');
    
    if (!syncQueueData || syncQueueData.length === 0) {
      console.log('[Service Worker] No saved places to sync');
      return;
    }
    
    // 서버에 데이터 전송
    console.log('[Service Worker] Syncing saved places data');
    
    // 동기화 요청
    const response = await fetch('/api/sync/saved-places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(syncQueueData)
    });
    
    if (response.ok) {
      // 동기화 성공 시 대기열에서 항목 제거
      await clearSyncQueue('savedPlaces');
      console.log('[Service Worker] Sync completed for saved places');
    } else {
      throw new Error('Failed to sync saved places data');
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed for saved places:', error);
    // 다음 동기화 기회에 재시도
  }
}

// 피드백 동기화
async function syncFeedbacks() {
  // syncSavedPlaces와 유사한 패턴으로 구현
  console.log('[Service Worker] Syncing feedbacks data');
  
  try {
    const syncQueueData = await getSyncQueueData('feedbacks');
    
    if (!syncQueueData || syncQueueData.length === 0) {
      console.log('[Service Worker] No feedbacks to sync');
      return;
    }
    
    const response = await fetch('/api/sync/feedbacks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(syncQueueData)
    });
    
    if (response.ok) {
      await clearSyncQueue('feedbacks');
      console.log('[Service Worker] Sync completed for feedbacks');
    } else {
      throw new Error('Failed to sync feedbacks data');
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed for feedbacks:', error);
  }
}

// 방문 기록 동기화
async function syncVisits() {
  // syncSavedPlaces와 유사한 패턴으로 구현
  console.log('[Service Worker] Syncing visits data');
  
  try {
    const syncQueueData = await getSyncQueueData('visits');
    
    if (!syncQueueData || syncQueueData.length === 0) {
      console.log('[Service Worker] No visits to sync');
      return;
    }
    
    const response = await fetch('/api/sync/visits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(syncQueueData)
    });
    
    if (response.ok) {
      await clearSyncQueue('visits');
      console.log('[Service Worker] Sync completed for visits');
    } else {
      throw new Error('Failed to sync visits data');
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed for visits:', error);
  }
}

// 동기화 큐에서 데이터 가져오기
async function getSyncQueueData(type) {
  // 클라이언트에게 메시지를 보내 IndexedDB 데이터 요청
  try {
    const allClients = await clients.matchAll();
    
    if (allClients.length > 0) {
      // 첫 번째 클라이언트에 메시지 전송
      const client = allClients[0];
      // 메시지를 전송하고 응답 대기
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        
        // 응답 수신 채널 설정
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.error) {
            console.error('[Service Worker] Error getting sync data:', event.data.error);
            resolve([]);
          } else {
            resolve(event.data || []);
          }
        };
        
        // 클라이언트에 메시지 전송
        client.postMessage({
          type: 'GET_SYNC_DATA',
          dataType: type
        }, [messageChannel.port2]);
      });
    }
    return [];
  } catch (error) {
    console.error('[Service Worker] Error requesting sync data:', error);
    return [];
  }
}

// 동기화 큐 비우기
async function clearSyncQueue(type) {
  try {
    const allClients = await clients.matchAll();
    
    if (allClients.length > 0) {
      // 첫 번째 클라이언트에 메시지 전송
      const client = allClients[0];
      client.postMessage({
        type: 'CLEAR_SYNC_QUEUE',
        dataType: type
      });
    }
  } catch (error) {
    console.error('[Service Worker] Error clearing sync queue:', error);
  }
}

// 서비스 워커 메시지 수신 이벤트
addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type) {
    // skipWaiting 메시지 처리
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    } 
    // 네트워크 상태 변경 메시지 처리
    else if (event.data.type === 'NETWORK_STATUS') {
      if (event.data.isOnline) {
        console.log('[Service Worker] App is back online, syncing data...');
        // 데이터 동기화 트리거
        self.registration.sync.register('sync-saved-places').catch(err => {
          console.error('Cannot register sync task:', err);
        });
        self.registration.sync.register('sync-feedbacks').catch(err => {
          console.error('Cannot register sync task:', err);
        });
        self.registration.sync.register('sync-visits').catch(err => {
          console.error('Cannot register sync task:', err);
        });
      } else {
        console.log('[Service Worker] App is offline, sync will be delayed');
      }
    }
    // 캐시 제어 메시지 처리
    else if (event.data.type === 'CLEAR_CACHES') {
      clearAllCaches();
    }
  }
});

// 모든 캐시 정리
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[Service Worker] All caches cleared');
  } catch (error) {
    console.error('[Service Worker] Error clearing caches:', error);
  }
}

// 푸시 알림 수신 이벤트
addEventListener('push', event => {
  console.log('[Service Worker] Push notification received:', event);
  
  let notification = {
    title: 'MyTripStyle',
    options: {
      body: '새로운 업데이트가 있습니다.',
      icon: '/logo192.png',
      badge: '/logo192.png'
    }
  };
  
  // 푸시 데이터가 있으면 사용
  if (event.data) {
    try {
      const data = event.data.json();
      notification = {
        title: data.title || notification.title,
        options: {
          ...notification.options,
          body: data.message || notification.options.body,
          data: data
        }
      };
    } catch (e) {
      // JSON 파싱 오류 시 텍스트 사용
      notification.options.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notification.title, notification.options)
  );
});

// 푸시 알림 클릭 이벤트
addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received:', event);
  
  event.notification.close();
  
  // 알림 데이터에 URL이 있으면 해당 페이지로 이동
  let url = '/';
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // 이미 열린 창이 있으면 포커스
        for (let client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // 열린 창이 없으면 새 창 열기
        return clients.openWindow(url);
      })
  );
});
