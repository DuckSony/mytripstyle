// src/services/offlineManager.js

import { 
  STORES, 
  getPendingSyncItems, 
  updateSyncQueueItemStatus,
  addToSyncQueue,
  clearStore,
  storeExists,
  initializeStores
} from '../utils/indexedDBUtils';

import networkUtils from '../utils/networkUtils';
import { isInstalledAsPWA } from '../utils/serviceWorkerRegistration';
import { cacheUtils } from '../utils/cacheUtils';

// 재시도 최대 횟수
const MAX_RETRY_COUNT = 5;

// 동기화 대기 간격 (밀리초) - 비활성 시간에 따라 조정
const SYNC_INTERVAL_ACTIVE = 60 * 1000; // 활성 모드: 1분
const SYNC_INTERVAL_BACKGROUND = 5 * 60 * 1000; // 백그라운드 모드: 5분
const SYNC_INTERVAL_INACTIVE = 30 * 60 * 1000; // 비활성 모드: 30분

// 백오프 지연 기본값 (밀리초)
const INITIAL_BACKOFF_DELAY = 2000; // 첫 재시도: 2초
const MAX_BACKOFF_DELAY = 60 * 1000; // 최대 지연: 1분

// 오프라인 임계값 (밀리초) - 이 시간 동안 오프라인 상태면 저전력 모드로 전환
const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5분

// 옵션 기본값
const DEFAULT_OPTIONS = {
  debug: process.env.NODE_ENV === 'development', // 개발 환경에서만 디버그 활성화
  maxRetryCount: MAX_RETRY_COUNT,
  syncInterval: SYNC_INTERVAL_ACTIVE,
  initialBackoffDelay: INITIAL_BACKOFF_DELAY,
  enablePushNotification: true, // 푸시 알림 활성화 (새 옵션)
  adaptiveSyncInterval: true, // 적응형 동기화 간격 사용 (새 옵션)
  lowPowerMode: false, // 저전력 모드 (배터리 절약) (새 옵션)
  prioritizeWifi: true, // Wi-Fi 환경에서 우선 동기화 (새 옵션)
  requireServiceWorker: false, // 서비스 워커 필수 여부 (새 옵션)
  autoInstallServiceWorker: false // 서비스 워커 자동 설치 (새 옵션)
};

// 동기화 상태
let syncInProgress = false;
// 동기화 폴링 타이머
let syncTimer = null;
// 네트워크 모니터링 해제 함수
let networkMonitorCleanup = null;
// 이벤트 리스너
const eventListeners = {
  onSyncStart: [],
  onSyncComplete: [],
  onSyncError: [],
  onOnline: [],
  onOffline: [],
  onLowPowerModeChange: [], // 추가: 저전력 모드 변경 리스너
  onAppStateChange: [] // 추가: 앱 상태 변경 리스너
};

// 앱 상태 추적
let appState = {
  isActive: true, // 앱이 현재 활성 상태인지 (foreground)
  isBackground: false, // 앱이 백그라운드 상태인지
  isVisible: true, // 앱이 사용자에게 보이는지
  lastActiveTime: Date.now(), // 마지막 활성 시간
  lastSyncTime: 0, // 마지막 동기화 시간
  offlineSince: null, // 오프라인 상태가 시작된 시간
  lowPowerMode: false, // 저전력 모드 활성화 여부
  isPWA: false, // PWA로 설치되었는지 여부
  serviceWorkerActive: false // 서비스 워커가 활성화되었는지 여부
};

// 적응형 동기화 설정 (새로 추가)
let adaptiveConfig = {
  currentSyncInterval: SYNC_INTERVAL_ACTIVE,
  failureCount: 0,
  successCount: 0,
  lastNetworkType: null,
  batteryLevel: null,
  isCharging: null,
  dataUsage: {
    total: 0,
    lastReset: Date.now()
  }
};

// 로그 유틸리티 함수
const log = (message, data = null, level = 'info') => {
  if (!DEFAULT_OPTIONS.debug && level !== 'error') return;
  
  const prefix = '[OfflineManager]';
  const timestamp = new Date().toISOString();
  const formattedMessage = `${prefix} ${timestamp} (${level}): ${message}`;
  
  switch (level) {
    case 'error':
      console.error(formattedMessage, data);
      break;
    case 'warn':
      console.warn(formattedMessage, data);
      break;
    case 'debug':
      console.debug(formattedMessage, data);
      break;
    case 'info':
    default:
      console.log(formattedMessage, data);
  }
};

/**
 * 오프라인 관리자 초기화 (개선됨)
 * 
 * @param {Object} options - 초기화 옵션
 * @param {Function} options.onOnline - 온라인 상태로 변경 시 콜백
 * @param {Function} options.onOffline - 오프라인 상태로 변경 시 콜백
 * @param {Function} options.onSyncStart - 동기화 시작 시 콜백
 * @param {Function} options.onSyncComplete - 동기화 완료 시 콜백
 * @param {Function} options.onSyncError - 동기화 오류 시 콜백
 * @param {Function} options.onLowPowerModeChange - 저전력 모드 변경 시 콜백 (추가)
 * @param {Function} options.onAppStateChange - 앱 상태 변경 시 콜백 (추가)
 * @param {boolean} options.debug - 디버그 활성화 여부
 * @param {number} options.syncInterval - 동기화 간격 (밀리초)
 * @param {boolean} options.adaptiveSyncInterval - 적응형 동기화 간격 사용 여부 (추가)
 * @param {boolean} options.lowPowerMode - 저전력 모드 사용 여부 (추가)
 * @param {boolean} options.prioritizeWifi - Wi-Fi 우선 동기화 여부 (추가)
 * @param {boolean} options.enablePushNotification - 푸시 알림 활성화 여부 (추가)
 * @param {boolean} options.requireServiceWorker - 서비스 워커 필수 여부 (추가)
 * @param {boolean} options.autoInstallServiceWorker - 서비스 워커 자동 설치 (추가)
 * @returns {Object} 오프라인 관리자 인스턴스
 */
export function initOfflineManager(options = {}) {
  // 기존 네트워크 모니터링 해제
  if (networkMonitorCleanup) {
    networkMonitorCleanup();
  }
  
  // 옵션 통합 (기본값으로 설정되지 않은 옵션만 할당)
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // 디버그 모드 설정
  DEFAULT_OPTIONS.debug = mergedOptions.debug;
  
  // 저전력 모드 설정
  appState.lowPowerMode = mergedOptions.lowPowerMode;
  
  log(`오프라인 관리자 초기화`, mergedOptions);
  
  // IndexedDB 초기화
  initializeDatabase();
  
  // PWA 상태 확인
  checkPWAStatus();
  
  // 이벤트 리스너 등록
  registerEventListeners(mergedOptions);
  
  // 배터리 상태 모니터링 (지원하는 경우)
  setupBatteryMonitoring();
  
  // 서비스 워커 상태 확인 및 활성화
  checkServiceWorkerStatus(mergedOptions.requireServiceWorker, mergedOptions.autoInstallServiceWorker)
    .then(isActive => {
      appState.serviceWorkerActive = isActive;
      
      // 서비스 워커 활성화 상태에 따른 처리
      if (isActive) {
        log('서비스 워커가 활성화되어 있습니다.', { isActive });
        // 서비스 워커 메시지 리스너 설정
        setupServiceWorkerMessageHandler();
      } else if (mergedOptions.requireServiceWorker) {
        log('서비스 워커가 필요하지만 활성화되지 않았습니다.', null, 'warn');
      }
    })
    .catch(err => {
      log('서비스 워커 상태 확인 중 오류:', err, 'error');
    });
  
  // 네트워크 상태 모니터링 시작
  networkMonitorCleanup = setupNetworkMonitoring(mergedOptions);
  
  // 앱 가시성 변경 모니터링 (탭 전환, 백그라운드/포그라운드)
  setupVisibilityMonitoring();
  
  // 동기화 간격 설정
  adaptiveConfig.currentSyncInterval = mergedOptions.syncInterval;
  
  // 초기 동기화 시작 (적절한 시점에)
  if (navigator.onLine) {
    if (mergedOptions.adaptiveSyncInterval) {
      // 네트워크 유형에 따라 최적의 동기화 간격 결정
      adaptSyncInterval();
    }
    
    // 초기 동기화 요청 (지연 시작)
    setTimeout(() => {
      startSync();
    }, 2000);
  }
  
  // 인스턴스 반환
  return {
    startSync,
    stopSync,
    isOffline,
    queueSyncTask,
    clearSyncQueue,
    getSyncStatus,
    addEventListener,
    removeEventListener,
    testConnection,
    // 추가 메서드
    enableLowPowerMode: (enable) => toggleLowPowerMode(enable),
    getCacheInfo: getCacheInfo,
    forceSync: () => startSync({ force: true }),
    getPendingTasksCount: getPendingTasksCount
  };
}

/**
 * IndexedDB 초기화 (추가됨)
 * 필요한 객체 스토어를 생성하거나 이미 존재하는지 확인합니다.
 */
async function initializeDatabase() {
  try {
    // 필요한 모든 스토어가 있는지 확인
    const storesExist = await storeExists(Object.values(STORES));
    
    if (!storesExist) {
      log('IndexedDB 스토어 초기화 중...', { stores: Object.values(STORES) });
      await initializeStores();
    }
    
    log('IndexedDB 초기화 완료');
  } catch (error) {
    log('IndexedDB 초기화 오류:', error, 'error');
  }
}

/**
 * PWA 상태 확인 (추가됨)
 */
function checkPWAStatus() {
  appState.isPWA = isInstalledAsPWA();
  
  if (appState.isPWA) {
    log('PWA로 설치된 앱을 실행 중입니다.');
    
    // PWA 설치 시 로컬 저장소 확인
    try {
      // 첫 실행 여부 확인
      const isFirstRun = localStorage.getItem('pwaFirstRun') !== 'false';
      if (isFirstRun) {
        log('PWA 첫 실행');
        localStorage.setItem('pwaFirstRun', 'false');
        localStorage.setItem('pwaFirstRunDate', new Date().toISOString());
        
        // 이벤트 발생
        dispatchEvent('pwa-first-run', { timestamp: Date.now() });
      }
    } catch (e) {
      // localStorage 오류 무시
    }
  }
}

/**
 * 이벤트 리스너 등록 (개선됨)
 * 
 * @param {Object} options - 옵션
 */
function registerEventListeners(options) {
  // 이벤트 리스너 초기화
  eventListeners.onOnline = [];
  eventListeners.onOffline = [];
  eventListeners.onSyncStart = [];
  eventListeners.onSyncComplete = [];
  eventListeners.onSyncError = [];
  eventListeners.onLowPowerModeChange = [];
  eventListeners.onAppStateChange = [];
  
  // 제공된 리스너 등록
  if (options.onOnline) eventListeners.onOnline.push(options.onOnline);
  if (options.onOffline) eventListeners.onOffline.push(options.onOffline);
  if (options.onSyncStart) eventListeners.onSyncStart.push(options.onSyncStart);
  if (options.onSyncComplete) eventListeners.onSyncComplete.push(options.onSyncComplete);
  if (options.onSyncError) eventListeners.onSyncError.push(options.onSyncError);
  if (options.onLowPowerModeChange) eventListeners.onLowPowerModeChange.push(options.onLowPowerModeChange);
  if (options.onAppStateChange) eventListeners.onAppStateChange.push(options.onAppStateChange);
}

/**
 * 이벤트 리스너 추가
 * 
 * @param {string} eventName - 이벤트 이름
 * @param {Function} callback - 콜백 함수
 */
export function addEventListener(eventName, callback) {
  if (!eventListeners[eventName]) {
    eventListeners[eventName] = [];
  }
  
  eventListeners[eventName].push(callback);
}

/**
 * 이벤트 리스너 제거
 * 
 * @param {string} eventName - 이벤트 이름
 * @param {Function} callback - 콜백 함수
 */
export function removeEventListener(eventName, callback) {
  if (!eventListeners[eventName]) {
    return;
  }
  
  eventListeners[eventName] = eventListeners[eventName].filter(
    listener => listener !== callback
  );
}

/**
 * 이벤트 발생
 * 
 * @param {string} eventName - 이벤트 이름
 * @param {Object} data - 이벤트 데이터
 */
function dispatchEvent(eventName, data = {}) {
  if (!eventListeners[eventName]) {
    return;
  }
  
  eventListeners[eventName].forEach(listener => {
    try {
      listener(data);
    } catch (err) {
      log(`${eventName} 이벤트 리스너 오류:`, err, 'error');
    }
  });
  
  // 커스텀 이벤트로도 발생
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`offlinemanager-${eventName}`, {
      detail: data
    }));
  }
}

/**
 * 네트워크 상태 모니터링 설정 (개선됨)
 * 
 * @param {Object} options - 옵션
 * @returns {Function} 모니터링 정리 함수
 */
function setupNetworkMonitoring(options) {
  let lastNetworkStatusTime = Date.now();
  let debounceTimeout = null;
  
  // 디바운스 함수
  const debounce = (callback, delay) => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(callback, delay);
  };
  
  // 온라인 상태 변경 핸들러
  const handleOnline = () => {
    // 너무 빈번한 변경 방지 (300ms 이내)
    if (Date.now() - lastNetworkStatusTime < 300) {
      return;
    }
    
    lastNetworkStatusTime = Date.now();
    
    // 디바운스 적용 (너무 빠른 온라인/오프라인 전환 방지)
    debounce(() => {
      log('네트워크 연결 감지됨');
      
      // 오프라인 시간 추적 종료
      appState.offlineSince = null;
      
      // 네트워크 연결 유형 확인
      const connectionInfo = getConnectionInfo();
      adaptiveConfig.lastNetworkType = connectionInfo.type;
      
      // 동기화 간격 조정 (있는 경우)
      if (options.adaptiveSyncInterval) {
        adaptSyncInterval();
      }
      
      // 모든 온라인 이벤트 리스너 호출
      dispatchEvent('onOnline', { 
        timestamp: Date.now(),
        connectionInfo
      });
      
      // 동기화 작업 시작 (오프라인에서 온라인으로 전환 시에만)
      startSync({ transitionToOnline: true });
    }, 300);
  };
  
  // 오프라인 상태 변경 핸들러
  const handleOffline = () => {
    // 너무 빈번한 변경 방지 (300ms 이내)
    if (Date.now() - lastNetworkStatusTime < 300) {
      return;
    }
    
    lastNetworkStatusTime = Date.now();
    
    // 디바운스 적용
    debounce(() => {
      log('네트워크 연결 끊김');
      
      // 오프라인 시작 시간 기록
      appState.offlineSince = Date.now();
      
      // 모든 오프라인 이벤트 리스너 호출
      dispatchEvent('onOffline', { timestamp: Date.now() });
      
      // 동기화 작업 중단
      stopSync();
    }, 300);
  };
  
  // 네트워크 품질 변화 핸들러 (추가)
  const handleConnectionChange = () => {
    try {
      if (navigator.connection) {
        const connectionInfo = getConnectionInfo();
        
        // 네트워크 유형 변경 감지
        if (adaptiveConfig.lastNetworkType !== connectionInfo.type) {
          log('네트워크 연결 유형 변경:', {
            oldType: adaptiveConfig.lastNetworkType,
            newType: connectionInfo.type,
            connectionInfo
          });
          
          adaptiveConfig.lastNetworkType = connectionInfo.type;
          
          // 동기화 간격 조정 (있는 경우)
          if (options.adaptiveSyncInterval) {
            adaptSyncInterval();
          }
          
          // Wi-Fi 우선 모드에서 Wi-Fi로 전환됐을 때 동기화 시작
          if (options.prioritizeWifi && connectionInfo.type === 'wifi' && navigator.onLine) {
            log('Wi-Fi 연결 감지됨, 동기화 시작');
            startSync({ lowPriority: false });
          }
          
          // 이벤트 발생
          dispatchEvent('network-quality-change', {
            connectionInfo,
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      log('네트워크 품질 변화 처리 오류:', err, 'error');
    }
  };
  
  // 초기 네트워크 상태 확인
  if (navigator.onLine) {
    setTimeout(() => {
      handleOnline();
    }, 0);
  } else {
    setTimeout(() => {
      handleOffline();
    }, 0);
  }
  
  // 이벤트 리스너 등록
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // 네트워크 품질 변화 감지 (지원하는 브라우저만)
  if (navigator.connection) {
    navigator.connection.addEventListener('change', handleConnectionChange);
  }
  
  // 정리 함수 반환
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    
    if (navigator.connection) {
      navigator.connection.removeEventListener('change', handleConnectionChange);
    }
    
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  };
}

/**
 * 배터리 상태 모니터링 설정 (추가됨)
 */
function setupBatteryMonitoring() {
  // 배터리 API 지원 확인
  if (!('getBattery' in navigator)) {
    log('배터리 API가 지원되지 않습니다.');
    return;
  }
  
  navigator.getBattery().then(battery => {
    // 초기 배터리 상태 저장
    adaptiveConfig.batteryLevel = battery.level;
    adaptiveConfig.isCharging = battery.charging;
    
    log('배터리 상태:', {
      level: battery.level * 100 + '%',
      charging: battery.charging
    });
    
    // 자동 저전력 모드 설정 (배터리 레벨 15% 이하 && 충전 중이 아님)
    if (battery.level <= 0.15 && !battery.charging) {
      log('배터리 부족, 저전력 모드 활성화', { level: battery.level * 100 + '%' });
      toggleLowPowerMode(true);
    }
    
    // 배터리 레벨 변화 감지
    battery.addEventListener('levelchange', () => {
      adaptiveConfig.batteryLevel = battery.level;
      
      log('배터리 레벨 변경:', { level: battery.level * 100 + '%' });
      
      // 저전력 모드 자동 전환 (15% 이하)
      if (battery.level <= 0.15 && !battery.charging && !appState.lowPowerMode) {
        log('배터리 부족, 저전력 모드 활성화', { level: battery.level * 100 + '%' });
        toggleLowPowerMode(true);
      }
      // 배터리 충분 (30% 이상)
      else if (battery.level >= 0.3 && !battery.charging && appState.lowPowerMode) {
        log('배터리 충분, 저전력 모드 비활성화', { level: battery.level * 100 + '%' });
        toggleLowPowerMode(false);
      }
    });
    
    // 충전 상태 변화 감지
    battery.addEventListener('chargingchange', () => {
      adaptiveConfig.isCharging = battery.charging;
      
      log('충전 상태 변경:', { charging: battery.charging });
      
      // 충전 중이면 저전력 모드 해제 (선택적)
      if (battery.charging && appState.lowPowerMode) {
        log('충전 중, 저전력 모드 비활성화');
        toggleLowPowerMode(false);
      }
      
      // 충전 시작 시 동기화 주기 조정
      if (battery.charging) {
        // 동기화 주기 정상화
        adaptSyncInterval();
        
        // 동기화 시작 (충전 시작 시에는 중요도 높음)
        if (navigator.onLine) {
          startSync({ lowPriority: false });
        }
      }
    });
  }).catch(err => {
    log('배터리 상태 모니터링 오류:', err, 'warn');
  });
}

/**
 * 앱 가시성 변경 모니터링 설정 (추가됨)
 */
function setupVisibilityMonitoring() {
  if (typeof document === 'undefined') return;
  
  const handleVisibilityChange = () => {
    const isVisible = document.visibilityState === 'visible';
    const previousState = { ...appState };
    
    // 상태 업데이트
    appState.isVisible = isVisible;
    appState.isActive = isVisible;
    appState.isBackground = !isVisible;
    
    if (isVisible) {
      // 활성 상태로 전환
      appState.lastActiveTime = Date.now();
      
      log('앱이 활성화 상태로 전환됨');
      
      // 앱 상태 변경 이벤트 발생
      dispatchEvent('onAppStateChange', {
        isActive: true,
        isBackground: false,
        isVisible: true,
        previousState,
        timestamp: Date.now()
      });
      
      // 네트워크 연결 확인 및 동기화 시작
      if (navigator.onLine) {
        // 일정 시간 이상 비활성 상태였다면, 새로고침 필요
        const inactiveTime = Date.now() - appState.lastActiveTime;
        if (inactiveTime > 60000) {
          log('장시간 비활성 후 앱 활성화, 동기화 시작');
          startSync();
        }
      }
    } else {
      // 백그라운드 상태로 전환
      log('앱이 백그라운드 상태로 전환됨');
      
      // 앱 상태 변경 이벤트 발생
      dispatchEvent('onAppStateChange', {
        isActive: false,
        isBackground: true,
        isVisible: false,
        previousState,
        timestamp: Date.now()
      });
      
      // 동기화 간격 조정 (백그라운드 모드)
      adaptiveConfig.currentSyncInterval = SYNC_INTERVAL_BACKGROUND;
      
      // 백그라운드 동기화 등록 (서비스 워커 지원 시)
      registerBackgroundSync();
    }
  };
  
  // 초기 상태 설정
  appState.isVisible = document.visibilityState === 'visible';
  appState.isActive = appState.isVisible;
  appState.isBackground = !appState.isVisible;
  appState.lastActiveTime = Date.now();
  
  // 이벤트 리스너 등록
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // 페이지 종료 시 처리
  window.addEventListener('beforeunload', () => {
    // 서비스 워커가 있으면 백그라운드 동기화 등록
    registerBackgroundSync();
  });
}

/**
 * 백그라운드 동기화 등록 (추가됨)
 * 
 * @param {string} [syncTag='offline-sync'] - 동기화 태그
 * @returns {Promise<boolean>} 등록 성공 여부
 */
async function registerBackgroundSync(syncTag = 'offline-sync') {
  // 서비스 워커 및 SyncManager 지원 확인
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    return false;
  }
  
  try {
    // 대기 중인 작업이 있는지 확인
    const pendingCount = await getPendingTasksCount();
    if (pendingCount === 0) {
      log('대기 중인 작업이 없어 백그라운드 동기화를 등록하지 않습니다.');
      return false;
    }
    
    // 서비스 워커 준비 확인
    const registration = await navigator.serviceWorker.ready;
    
    // 백그라운드 동기화 등록
    await registration.sync.register(syncTag);
    
    log('백그라운드 동기화 등록 완료:', { syncTag, pendingCount });
    return true;
  } catch (error) {
    log('백그라운드 동기화 등록 오류:', error, 'error');
    return false;
  }
}

/**
 * 서비스 워커 메시지 핸들러 설정 (추가됨)
 */
function setupServiceWorkerMessageHandler() {
  if (!('serviceWorker' in navigator)) return;
  
  // 메시지 이벤트 리스너
  const handleMessage = async (event) => {
    if (!event.data || !event.data.type) return;
    
    const { type, payload } = event.data;
    
    switch (type) {
      case 'SYNC_COMPLETED':
        // 백그라운드 동기화 완료
        log('서비스 워커로부터 동기화 완료 메시지 수신:', payload);
        
        // 동기화 상태 업데이트
        syncInProgress = false;
        appState.lastSyncTime = Date.now();
        
        // 이벤트 발생
        dispatchEvent('onSyncComplete', {
          fromServiceWorker: true,
          ...payload,
          timestamp: Date.now()
        });
        break;
        
      case 'SYNC_ERROR':
        // 백그라운드 동기화 오류
        log('서비스 워커로부터 동기화 오류 메시지 수신:', payload, 'error');
        
        // 동기화 상태 업데이트
        syncInProgress = false;
        
        // 이벤트 발생
        dispatchEvent('onSyncError', {
          fromServiceWorker: true,
          ...payload,
          timestamp: Date.now()
        });
        break;
        
      case 'PENDING_TASKS_COUNT':
        // 대기 중인 작업 개수 업데이트
        log('서비스 워커로부터 대기 중인 작업 개수 수신:', payload);
        break;
        
      case 'NETWORK_STATUS_CHANGE':
        // 네트워크 상태 변경 (서비스 워커가 감지)
        log('서비스 워커로부터 네트워크 상태 변경 수신:', payload);
        
        // 이미 적절한 이벤트 발생 중이므로 추가 작업 불필요
        break;
        
      case 'APP_UPDATE_AVAILABLE':
        // 앱 업데이트 가능
        log('서비스 워커로부터 앱 업데이트 가능 메시지 수신:', payload);
        
        // 이벤트 발생
        dispatchEvent('app-update-available', {
          ...payload,
          timestamp: Date.now()
        });
        break;
    }
  };
  
  // 현재 서비스 워커부터 메시지 수신 설정
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', handleMessage);
  }
  
  // 서비스 워커 제어 변경 감지
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (navigator.serviceWorker.controller) {
      // 새 컨트롤러에 메시지 리스너 설정
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }
  });
}

/**
 * 서비스 워커 상태 확인
 * 
 * @param {boolean} requireServiceWorker - 서비스 워커 필수 여부
 * @param {boolean} autoInstall - 자동 설치 여부
 * @returns {Promise<boolean>} 서비스 워커 활성화 여부
 */
async function checkServiceWorkerStatus(requireServiceWorker = false, autoInstall = false) {
  if (!('serviceWorker' in navigator)) {
    if (requireServiceWorker) {
      log('서비스 워커가 지원되지 않지만 필수로 설정됨', null, 'warn');
    }
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    if (registration && registration.active) {
      log('서비스 워커가 활성화되어 있습니다.', { scope: registration.scope });
      return true;
    } else if (autoInstall) {
      log('서비스 워커가 활성화되어 있지 않습니다. 자동 설치 시도 중...');
      
      try {
        // 서비스 워커 등록 시도
        const newRegistration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        
        log('서비스 워커 등록 성공', { scope: newRegistration.scope });
        return true;
      } catch (installError) {
        log('서비스 워커 설치 오류:', installError, 'error');
        return false;
      }
    }
    
    log('서비스 워커가 활성화되어 있지 않습니다.');
    return false;
  } catch (error) {
    log('서비스 워커 상태 확인 중 오류:', error, 'error');
    return false;
  }
}

/**
 * 네트워크 연결 테스트
 * 
 * @param {string} testUrl - 테스트할 URL
 * @param {number} timeout - 타임아웃 (ms)
 * @returns {Promise<Object>} 테스트 결과
 */
export async function testConnection(testUrl = '/api/ping', timeout = 5000) {
  return networkUtils.testConnection(testUrl, timeout);
}

/**
 * 오프라인 상태 확인
 * 
 * @returns {boolean} 오프라인 여부
 */
export function isOffline() {
  return !networkUtils.isOnline();
}

/**
 * 네트워크 연결 정보 가져오기 (추가됨)
 * 
 * @returns {Object} 연결 정보
 */
function getConnectionInfo() {
  return {
    online: networkUtils.isOnline(),
    type: networkUtils.getConnectionType(),
    speed: networkUtils.getConnectionSpeed(),
    effectiveType: networkUtils.getEffectiveConnectionType(),
    saveData: networkUtils.isSaveDataEnabled(),
    timestamp: Date.now()
  };
}

/**
 * 저전력 모드 토글 (추가됨)
 * 
 * @param {boolean} enable - 활성화 여부
 * @returns {boolean} 현재 저전력 모드 상태
 */
function toggleLowPowerMode(enable) {
  const previousState = appState.lowPowerMode;
  appState.lowPowerMode = enable;
  
  if (previousState !== enable) {
    log(`저전력 모드 ${enable ? '활성화' : '비활성화'}`);
    
    // 저전력 모드에 따라 동기화 간격 조정
    if (enable) {
      // 저전력 모드에서는 동기화 간격을 더 길게 설정
      adaptiveConfig.currentSyncInterval = SYNC_INTERVAL_INACTIVE;
      
      // 동기화 타이머 재설정
      resetSyncTimer();
    } else {
      // 일반 모드로 돌아오면 동기화 간격 초기화
      adaptSyncInterval();
      
      // 온라인 상태에서 동기화 재개
      if (navigator.onLine) {
        startSync();
      }
    }
    
    // 이벤트 발생
    dispatchEvent('onLowPowerModeChange', {
      enabled: enable,
      previousState,
      timestamp: Date.now()
    });
  }
  
  return appState.lowPowerMode;
}

/**
 * 오프라인 이력에 따른 적응형 동기화 간격 조정 (추가됨)
 */
function adaptSyncInterval() {
  // 기본 간격 설정
  let newInterval = SYNC_INTERVAL_ACTIVE;
  
  // 1. 앱 상태에 따른 조정
  if (appState.isBackground) {
    newInterval = SYNC_INTERVAL_BACKGROUND;
  } else if (!appState.isActive) {
    newInterval = SYNC_INTERVAL_INACTIVE;
  }
  
  // 2. 배터리 상태에 따른 조정
  if (adaptiveConfig.batteryLevel !== null) {
    // 배터리 부족 (충전 중이 아닐 때)
    if (adaptiveConfig.batteryLevel < 0.2 && !adaptiveConfig.isCharging) {
      newInterval = Math.max(newInterval, SYNC_INTERVAL_INACTIVE);
    }
  }
  
  // 3. 네트워크 상태에 따른 조정
  const connectionInfo = getConnectionInfo();
  if (connectionInfo.type === 'cellular') {
    // 셀룰러 연결에서는 간격 확장
    if (connectionInfo.effectiveType === '3g') {
      newInterval = Math.max(newInterval, SYNC_INTERVAL_BACKGROUND);
    } else if (connectionInfo.effectiveType === '2g' || connectionInfo.effectiveType === 'slow-2g') {
      newInterval = Math.max(newInterval, SYNC_INTERVAL_INACTIVE);
    }
  }
  
  // 4. 데이터 절약 모드에 따른 조정
  if (connectionInfo.saveData) {
    newInterval = Math.max(newInterval, SYNC_INTERVAL_BACKGROUND);
  }
  
  // 5. 저전력 모드에 따른 조정
  if (appState.lowPowerMode) {
    newInterval = Math.max(newInterval, SYNC_INTERVAL_INACTIVE);
  }
  
  // 간격 변경이 있을 때만 타이머 재설정
  if (adaptiveConfig.currentSyncInterval !== newInterval) {
    log(`동기화 간격 조정: ${adaptiveConfig.currentSyncInterval / 1000}초 -> ${newInterval / 1000}초`, {
      isBackground: appState.isBackground,
      batteryLevel: adaptiveConfig.batteryLevel,
      networkType: connectionInfo.type,
      effectiveType: connectionInfo.effectiveType,
      saveData: connectionInfo.saveData,
      lowPowerMode: appState.lowPowerMode
    });
    
    adaptiveConfig.currentSyncInterval = newInterval;
    resetSyncTimer();
  }
}

/**
 * 동기화 작업 시작
 * 
 * @param {Object} options - 동기화 옵션
 * @param {boolean} options.force - 강제 동기화 여부
 * @param {boolean} options.transitionToOnline - 오프라인에서 온라인으로 전환된 경우
 * @param {boolean} options.lowPriority - 낮은 우선순위로 동기화
 * @returns {Promise<boolean>} 성공 여부
 */
export async function startSync(options = {}) {
  // 이미 동기화 중이면 중복 실행 방지
  if (syncInProgress) {
    log('동기화가 이미 진행 중입니다.');
    return false;
  }
  
  // 옵션 정규화
  const opts = {
    force: false,
    transitionToOnline: false,
    lowPriority: false, // 리소스 사용을 줄이기 위한 저우선순위 동기화
    ...options
  };
  
  // 오프라인 상태면 동기화 중단
  if (isOffline()) {
    log('오프라인 상태입니다. 동기화를 진행할 수 없습니다.');
    return false;
  }
  
  // 저전력 모드에서는 필수 작업만 동기화
  if (appState.lowPowerMode && !opts.force && !opts.transitionToOnline) {
    log('저전력 모드에서는 필수 동기화만 수행합니다.');
    // 대기 중인 중요 작업이 있는지 확인
    const criticalTasks = await getCriticalTasksCount();
    if (criticalTasks === 0) {
      log('저전력 모드에서 중요 작업이 없어 동기화를 건너뜁니다.');
      return false;
    }
  }
  
  // 백그라운드 상태에서 저우선순위 동기화는 건너뛰기
  if (appState.isBackground && opts.lowPriority && !opts.force) {
    log('백그라운드 상태에서 저우선순위 동기화를 건너뜁니다.');
    return false;
  }
  
  // Wi-Fi 우선 모드에서 모바일 네트워크 연결 시 제한
  const connectionInfo = getConnectionInfo();
  if (DEFAULT_OPTIONS.prioritizeWifi && 
      connectionInfo.type !== 'wifi' && 
      !opts.force && 
      !opts.transitionToOnline) {
    log('Wi-Fi 우선 모드에서 모바일 네트워크 연결로 동기화 제한', connectionInfo);
    
    // 중요 작업이 있는지 확인
    const criticalTasks = await getCriticalTasksCount();
    if (criticalTasks === 0) {
      log('Wi-Fi 우선 모드에서 중요 작업이 없어 동기화를 건너뜁니다.');
      return false;
    }
  }
  
  // 동기화 상태 업데이트
  syncInProgress = true;
  
  // 동기화 시작 이벤트 발생
  dispatchEvent('onSyncStart', {
    timestamp: Date.now(),
    connectionInfo,
    options: opts
  });
  
  try {
    // 대기 중인 동기화 작업 가져오기
    const pendingTasks = await getPendingSyncItems();
    
    if (pendingTasks.length === 0) {
      log('동기화할 항목이 없습니다.');
      syncInProgress = false;
      
      // 동기화 완료 이벤트 발생
      dispatchEvent('onSyncComplete', {
        successCount: 0,
        failureCount: 0,
        timestamp: Date.now()
      });
      
      // 다음 동기화 예약
      scheduleSyncIfNeeded();
      
      return true;
    }
    
    log(`${pendingTasks.length}개의 항목을 동기화합니다.`);
    
    // 우선순위에 따라 작업 정렬 (중요 작업 먼저)
    const prioritizedTasks = prioritizeTasks(pendingTasks);
    
    // 저전력 모드 또는 저우선순위 동기화에서는 작업 수 제한
    let tasksToProcess = prioritizedTasks;
    if ((appState.lowPowerMode || opts.lowPriority) && !opts.force) {
      // 최대 5개 작업으로 제한
      tasksToProcess = prioritizedTasks.slice(0, 5);
      log('제한된 작업 처리:', { total: prioritizedTasks.length, processing: tasksToProcess.length });
    }
    
    // 동기화 작업 실행
    const results = await processTasks(tasksToProcess);
    
    // 결과 분석
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value).length;
    
    log(`동기화 완료: ${succeeded}개 성공, ${failed}개 실패`);
    
    // 동기화 상태 업데이트
    syncInProgress = false;
    appState.lastSyncTime = Date.now();
    
    // 성공/실패 카운터 업데이트
    if (succeeded > 0) {
      adaptiveConfig.successCount++;
      adaptiveConfig.failureCount = 0; // 성공 시 실패 카운터 리셋
    } else if (failed > 0) {
      adaptiveConfig.failureCount++;
      adaptiveConfig.successCount = 0; // 실패 시 성공 카운터 리셋
    }
    
    // 동기화 완료 이벤트 발생
    dispatchEvent('onSyncComplete', {
      successCount: succeeded,
      failureCount: failed,
      remainingCount: (pendingTasks.length - succeeded),
      timestamp: Date.now()
    });
    
    // 실패 횟수에 따라 동기화 주기 조정
    if (adaptiveConfig.failureCount > 2) {
      // 연속 실패 시 동기화 주기 확장
      adaptiveConfig.currentSyncInterval = Math.min(
        adaptiveConfig.currentSyncInterval * 1.5,
        SYNC_INTERVAL_INACTIVE
      );
      log('연속 실패로 동기화 주기 확장:', { interval: adaptiveConfig.currentSyncInterval });
    }
    
    // 다음 동기화 예약
    scheduleSyncIfNeeded();
    
    return true;
  } catch (error) {
    log('동기화 중 오류 발생:', error, 'error');
    
    // 동기화 상태 업데이트
    syncInProgress = false;
    
    // 실패 카운터 증가
    adaptiveConfig.failureCount++;
    adaptiveConfig.successCount = 0;
    
    // 동기화 오류 이벤트 발생
    dispatchEvent('onSyncError', {
      error: error.message,
      timestamp: Date.now()
    });
    
    // 오류 발생 시 백오프 지연으로 다음 동기화 예약
    scheduleSyncWithBackoff();
    
    return false;
  }
}

/**
 * 작업 우선순위 지정 (추가됨)
 * 
 * @param {Array} tasks - 작업 목록
 * @returns {Array} 우선순위가 적용된 작업 목록
 */
function prioritizeTasks(tasks) {
  return [...tasks].sort((a, b) => {
    // 1. 중요도: 중요 작업 우선
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    
    // 2. 재시도 횟수: 재시도 횟수가 적은 것 우선
    if ((a.retryCount || 0) < (b.retryCount || 0)) return -1;
    if ((a.retryCount || 0) > (b.retryCount || 0)) return 1;
    
    // 3. 타임스탬프: 오래된 작업 우선
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}

/**
 * 작업 처리 (개선됨)
 * 
 * @param {Array} tasks - 처리할 작업 목록
 * @returns {Promise<Array>} 처리 결과
 */
async function processTasks(tasks) {
  // 네트워크 연결 상태 확인
  if (!navigator.onLine) {
    return tasks.map(() => ({ 
      status: 'rejected', 
      reason: new Error('네트워크 연결이 없습니다.') 
    }));
  }
  
  // 병렬 처리 설정
  const connectionInfo = getConnectionInfo();
  const maxParallel = determineMaxParallelTasks(connectionInfo);
  
  log(`작업 처리 시작 (${tasks.length}개, 최대 병렬 처리: ${maxParallel}개)`, connectionInfo);
  
  // 배치 처리 함수
  const processBatch = async (batch) => {
    return Promise.allSettled(batch.map(task => processTask(task)));
  };
  
  // 결과 저장 배열
  const results = [];
  
  // 배치 단위로 처리 (네트워크 부하 분산)
  for (let i = 0; i < tasks.length; i += maxParallel) {
    const batch = tasks.slice(i, i + maxParallel);
    const batchResults = await processBatch(batch);
    results.push(...batchResults);
    
    // 배치 간 잠시 대기 (너무 많은 동시 요청 방지)
    if (i + maxParallel < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return results;
}

/**
 * 네트워크 상태에 따른 최대 병렬 작업 수 결정 (추가됨)
 * 
 * @param {Object} connectionInfo - 네트워크 연결 정보
 * @returns {number} 최대 병렬 작업 수
 */
function determineMaxParallelTasks(connectionInfo) {
  // 기본값
  let maxParallel = 3;
  
  // 네트워크 유형에 따라 조정
  if (connectionInfo.type === 'wifi') {
    maxParallel = 5;
  } else if (connectionInfo.type === 'cellular') {
    // 모바일 네트워크는 효과적인 유형에 따라 세분화
    if (connectionInfo.effectiveType === '4g') {
      maxParallel = 3;
    } else if (connectionInfo.effectiveType === '3g') {
      maxParallel = 2;
    } else {
      maxParallel = 1; // 2g 또는 slow-2g
    }
  }
  
  // 저전력 모드에서는 병렬 작업 수 제한
  if (appState.lowPowerMode) {
    maxParallel = Math.min(maxParallel, 2);
  }
  
  // 데이터 절약 모드에서는 병렬 작업 수 제한
  if (connectionInfo.saveData) {
    maxParallel = Math.min(maxParallel, 2);
  }
  
  return maxParallel;
}

/**
 * 단일 작업 처리 (개선됨)
 * 
 * @param {Object} task - 처리할 작업
 * @returns {Promise<boolean>} 성공 여부
 */
async function processTask(task) {
  try {
    log(`작업 처리 중: ${task.operationType}`, { id: task.id, retryCount: task.retryCount });
    
    // 작업 시작 시간 기록 (성능 측정용)
    const startTime = Date.now();
    
    // 재시도 횟수 초과 검사
    if ((task.retryCount || 0) >= DEFAULT_OPTIONS.maxRetryCount) {
      log(`최대 재시도 횟수 초과: ${task.id}`, task, 'warn');
      
      // 실패로 표시하고 오류 상태 업데이트
      await updateSyncQueueItemStatus(task.id, 'error', {
        errorMessage: '최대 재시도 횟수 초과',
        retryCount: task.retryCount,
        lastAttempt: new Date().toISOString()
      });
      
      return false;
    }
    
    // 작업 유형에 따라 처리 (기존 함수 구현 활용)
    let success = false;
    
    switch (task.operationType) {
      case 'add':
        success = await handleAddOperation(task);
        break;
      case 'update':
        success = await handleUpdateOperation(task);
        break;
      case 'delete':
        success = await handleDeleteOperation(task);
        break;
      default:
        log(`알 수 없는 작업 유형: ${task.operationType}`, task, 'warn');
        success = false;
        break;
    }
    
    // 작업 처리 시간 계산
    const processingTime = Date.now() - startTime;
    
    // 데이터 사용량 추적 (대략적으로)
    const dataSize = JSON.stringify(task).length;
    adaptiveConfig.dataUsage.total += dataSize;
    
    // 성공 시 작업 완료 상태로 업데이트
    if (success) {
      await updateSyncQueueItemStatus(task.id, 'success', {
        completedAt: new Date().toISOString(),
        processingTime,
        dataSize
      });
      
      log(`작업 ${task.id} 성공 (${processingTime}ms)`);
      return true;
    } else {
      // 실패 시 재시도 횟수 증가
      const newRetryCount = (task.retryCount || 0) + 1;
      await updateSyncQueueItemStatus(task.id, 'error', {
        errorMessage: '동기화 실패',
        retryCount: newRetryCount,
        lastAttempt: new Date().toISOString(),
        processingTime
      });
      
      log(`작업 ${task.id} 실패, 재시도 예정 (${newRetryCount}/${DEFAULT_OPTIONS.maxRetryCount})`, null, 'warn');
      return false;
    }
  } catch (error) {
    log(`작업 ${task.id} 처리 중 오류:`, error, 'error');
    
    // 오류 발생 시 상태 업데이트
    try {
      const newRetryCount = (task.retryCount || 0) + 1;
      await updateSyncQueueItemStatus(task.id, 'error', {
        errorMessage: error.message,
        retryCount: newRetryCount,
        lastAttempt: new Date().toISOString()
      });
    } catch (updateError) {
      log('작업 상태 업데이트 중 오류:', updateError, 'error');
    }
    
    return false;
  }
}

/**
 * 동기화 작업 중지
 */
export function stopSync() {
  // 동기화 타이머가 있으면 제거
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  
  // 동기화 중이면 강제 종료
  if (syncInProgress) {
    syncInProgress = false;
    log('동기화가 중지되었습니다.');
  }
}

/**
 * 동기화 타이머 재설정
 */
function resetSyncTimer() {
  // 기존 타이머 제거
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  
  // 새 타이머 설정
  if (navigator.onLine) {
    log(`다음 동기화 예약: ${adaptiveConfig.currentSyncInterval / 1000}초 후`);
    syncTimer = setInterval(() => startSync({ lowPriority: true }), adaptiveConfig.currentSyncInterval);
  }
}

/**
 * 필요한 경우 다음 동기화 예약
 */
function scheduleSyncIfNeeded() {
  // 기존 타이머 체크
  if (!syncTimer && navigator.onLine) {
    resetSyncTimer();
  }
}

/**
 * 백오프 지연으로 다음 동기화 예약
 */
function scheduleSyncWithBackoff() {
  // 기존 타이머 제거
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  
  // 실패 횟수에 따른 지수 백오프 계산
  const failureCount = Math.min(adaptiveConfig.failureCount, 5);
  const backoffDelay = Math.min(
    INITIAL_BACKOFF_DELAY * Math.pow(2, failureCount - 1),
    MAX_BACKOFF_DELAY
  );
  
  log(`백오프 지연으로 다음 동기화 예약: ${backoffDelay / 1000}초 후 (실패 횟수: ${failureCount})`);
  
  // 일회성 타이머로 재시도
  setTimeout(() => {
    if (navigator.onLine) {
      startSync();
    }
  }, backoffDelay);
}

/**
 * 데이터 추가 작업 처리
 * 
 * @param {Object} task - 동기화 작업 정보
 * @returns {Promise<boolean>} 성공 여부
 */
async function handleAddOperation(task) {
  try {
    log(`추가 작업 처리: ${task.storeName}`, task);
    
    // 저장된 장소 추가
    if (task.storeName === STORES.SAVED_PLACES) {
      return await syncSavedPlace(task.data, 'add');
    }
    // 피드백 추가
    else if (task.storeName === STORES.FEEDBACKS) {
      return await syncFeedback(task.data, 'add');
    }
    // 방문 기록 추가
    else if (task.storeName === STORES.VISIT_HISTORY || task.storeName === STORES.PLANNED_VISITS) {
      return await syncVisit(task.data, 'add', task.storeName);
    }
    // 푸시 알림 토큰 업데이트 (추가)
    else if (task.storeName === STORES.PUSH_TOKENS) {
      return await syncPushToken(task.data, 'add');
    }
    // 사용자 설정 업데이트 (추가)
    else if (task.storeName === STORES.USER_SETTINGS) {
      return await syncUserSettings(task.data, 'add');
    }
    
    log(`지원되지 않는 스토어: ${task.storeName}`, null, 'warn');
    return false;
  } catch (error) {
    log(`추가 작업 처리 실패 (${task.storeName}):`, error, 'error');
    throw error; // 상위 레벨에서 재시도 처리할 수 있도록 오류 전파
  }
}

/**
 * 데이터 업데이트 작업 처리
 * 
 * @param {Object} task - 동기화 작업 정보
 * @returns {Promise<boolean>} 성공 여부
 */
async function handleUpdateOperation(task) {
  try {
    log(`업데이트 작업 처리: ${task.storeName}`, task);
    
    // 저장된 장소 업데이트
    if (task.storeName === STORES.SAVED_PLACES) {
      return await syncSavedPlace(task.data, 'update');
    }
    // 피드백 업데이트
    else if (task.storeName === STORES.FEEDBACKS) {
      return await syncFeedback(task.data, 'update');
    }
    // 방문 기록 업데이트
    else if (task.storeName === STORES.VISIT_HISTORY || task.storeName === STORES.PLANNED_VISITS) {
      return await syncVisit(task.data, 'update', task.storeName);
    }
    // 푸시 알림 토큰 업데이트 (추가)
    else if (task.storeName === STORES.PUSH_TOKENS) {
      return await syncPushToken(task.data, 'update');
    }
    // 사용자 설정 업데이트 (추가)
    else if (task.storeName === STORES.USER_SETTINGS) {
      return await syncUserSettings(task.data, 'update');
    }
    
    log(`지원되지 않는 스토어: ${task.storeName}`, null, 'warn');
    return false;
  } catch (error) {
    log(`업데이트 작업 처리 실패 (${task.storeName}):`, error, 'error');
    throw error; // 상위 레벨에서 재시도 처리할 수 있도록 오류 전파
  }
}

/**
 * 데이터 삭제 작업 처리
 * 
 * @param {Object} task - 동기화 작업 정보
 * @returns {Promise<boolean>} 성공 여부
 */
async function handleDeleteOperation(task) {
  try {
    log(`삭제 작업 처리: ${task.storeName}`, task);
    
    // 저장된 장소 삭제
    if (task.storeName === STORES.SAVED_PLACES) {
      return await syncSavedPlace(task.data, 'delete');
    }
    // 피드백 삭제
    else if (task.storeName === STORES.FEEDBACKS) {
      return await syncFeedback(task.data, 'delete');
    }
    // 방문 기록 삭제
    else if (task.storeName === STORES.VISIT_HISTORY || task.storeName === STORES.PLANNED_VISITS) {
      return await syncVisit(task.data, 'delete', task.storeName);
    }
    // 푸시 알림 토큰 삭제 (추가)
    else if (task.storeName === STORES.PUSH_TOKENS) {
      return await syncPushToken(task.data, 'delete');
    }
    // 사용자 설정 삭제 (추가)
    else if (task.storeName === STORES.USER_SETTINGS) {
      return await syncUserSettings(task.data, 'delete');
    }
    
    log(`지원되지 않는 스토어: ${task.storeName}`, null, 'warn');
    return false;
  } catch (error) {
    log(`삭제 작업 처리 실패 (${task.storeName}):`, error, 'error');
    throw error; // 상위 레벨에서 재시도 처리할 수 있도록 오류 전파
  }
}

/**
 * 푸시 알림 토큰 동기화 (추가됨)
 * 
 * @param {Object} data - 토큰 데이터
 * @param {string} operation - 작업 유형 (add, update, delete)
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncPushToken(data, operation) {
  try {
    log(`푸시 알림 토큰 동기화: ${operation}`, data);
    
    // 토큰 데이터 검증
    if (!data.userId || !data.token) {
      throw new Error('유효하지 않은 푸시 토큰 데이터');
    }
    
    // API 요청 함수
    const apiRequest = async () => {
      // 작업 유형에 따라 엔드포인트 및 메서드 설정
      let url = '/api/push-tokens';
      let method = 'POST';
      
      if (operation === 'update') {
        url = `/api/push-tokens/${data.userId}`;
        method = 'PUT';
      } else if (operation === 'delete') {
        url = `/api/push-tokens/${data.userId}`;
        method = 'DELETE';
      }
      
      // API 요청
      const response = await networkUtils.fetchWithTimeout(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: operation === 'delete' ? undefined : JSON.stringify(data)
        },
        10000 // 10초 타임아웃
      );
      
      // 응답 확인
      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
      }
      
      return true;
    };
    
    // 재시도 전략 적용
    return await networkUtils.withRetry(apiRequest, {
      maxRetries: 3,
      retryDelay: 2000,
      onRetry: (retryCount) => {
        log(`푸시 토큰 동기화 재시도 (${retryCount}/3)...`);
      }
    });
  } catch (error) {
    log('푸시 토큰 동기화 오류:', error, 'error');
    return false;
  }
}

/**
 * 사용자 설정 동기화 (추가됨)
 * 
 * @param {Object} data - 설정 데이터
 * @param {string} operation - 작업 유형 (add, update, delete)
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncUserSettings(data, operation) {
  try {
    log(`사용자 설정 동기화: ${operation}`, data);
    
    // 데이터 검증
    if (!data.userId) {
      throw new Error('유효하지 않은 사용자 설정 데이터');
    }
    
    // API 요청 함수
    const apiRequest = async () => {
      // 작업 유형에 따라 엔드포인트 및 메서드 설정
      let url = '/api/user-settings';
      let method = 'POST';
      
      if (operation === 'update') {
        url = `/api/user-settings/${data.userId}`;
        method = 'PUT';
      } else if (operation === 'delete') {
        url = `/api/user-settings/${data.userId}`;
        method = 'DELETE';
      }
      
      // API 요청
      const response = await networkUtils.fetchWithTimeout(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: operation === 'delete' ? undefined : JSON.stringify(data)
        },
        10000 // 10초 타임아웃
      );
      
      // 응답 확인
      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
      }
      
      return true;
    };
    
    // 재시도 전략 적용
    return await networkUtils.withRetry(apiRequest, {
      maxRetries: 3,
      retryDelay: 2000,
      onRetry: (retryCount) => {
        log(`사용자 설정 동기화 재시도 (${retryCount}/3)...`);
      }
    });
  } catch (error) {
    log('사용자 설정 동기화 오류:', error, 'error');
    return false;
  }
}

/**
 * 저장된 장소 동기화
 * 
 * @param {Object} data - 장소 데이터
 * @param {string} operation - 작업 유형 (add, update, delete)
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncSavedPlace(data, operation) {
  try {
    log(`저장된 장소 동기화: ${operation}`, data);
    
    // 여기에서 실제 API 호출 구현
    // 예시 코드만 제공 (실제 구현 필요)
    
    switch (operation) {
      case 'add':
        // 저장 API 호출
        // await firebase.savePlace(data.userId, data.placeId);
        log(`장소 저장 API 호출 (userId: ${data.userId}, placeId: ${data.placeId})`);
        break;
      case 'update':
        // 업데이트 API 호출
        // await firebase.updateSavedPlace(data.id, data);
        log(`장소 업데이트 API 호출 (id: ${data.id})`);
        break;
      case 'delete':
        // 삭제 API 호출
        // await firebase.unsavePlace(data.userId, data.placeId);
        log(`장소 삭제 API 호출 (userId: ${data.userId}, placeId: ${data.placeId})`);
        break;
    }
    
    // 성공 반환 (실제로는 API 응답에 따라 성공 여부 결정)
    return true;
  } catch (error) {
    log('저장된 장소 동기화 오류:', error, 'error');
    return false;
  }
}

/**
 * 피드백 동기화
 * 
 * @param {Object} data - 피드백 데이터
 * @param {string} operation - 작업 유형 (add, update, delete)
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncFeedback(data, operation) {
  try {
    log(`피드백 동기화: ${operation}`, data);
    
    // 여기에서 실제 API 호출 구현
    // 예시 코드만 제공 (실제 구현 필요)
    
    switch (operation) {
      case 'add':
        // 피드백 추가 API 호출
        // await firebase.addFeedback(data);
        log(`피드백 추가 API 호출 (userId: ${data.userId}, placeId: ${data.placeId})`);
        break;
      case 'update':
        // 피드백 업데이트 API 호출
        // await firebase.updateFeedback(data.id, data);
        log(`피드백 업데이트 API 호출 (id: ${data.id})`);
        break;
      case 'delete':
        // 피드백 삭제 API 호출
        // await firebase.deleteFeedback(data.id);
        log(`피드백 삭제 API 호출 (id: ${data.id})`);
        break;
    }
    
    // 성공 반환 (실제로는 API 응답에 따라 성공 여부 결정)
    return true;
  } catch (error) {
    log('피드백 동기화 오류:', error, 'error');
    return false;
  }
}

/**
 * 방문 기록/계획 동기화
 * 
 * @param {Object} data - 방문 데이터
 * @param {string} operation - 작업 유형 (add, update, delete)
 * @param {string} storeName - 스토어 이름 (VISIT_HISTORY 또는 PLANNED_VISITS)
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncVisit(data, operation, storeName) {
  try {
    log(`방문 ${storeName === STORES.VISIT_HISTORY ? '기록' : '계획'} 동기화: ${operation}`, data);
    
    // 여기에서 실제 API 호출 구현
    // 예시 코드만 제공 (실제 구현 필요)
    
    if (storeName === STORES.VISIT_HISTORY) {
      switch (operation) {
        case 'add':
          // 방문 기록 추가 API 호출
          // await firebase.addVisitHistory(data);
          log(`방문 기록 추가 API 호출 (userId: ${data.userId}, placeId: ${data.placeId})`);
          break;
        case 'update':
          // 방문 기록 업데이트 API 호출
          // await firebase.updateVisitHistory(data.id, data);
          log(`방문 기록 업데이트 API 호출 (id: ${data.id})`);
          break;
        case 'delete':
          // 방문 기록 삭제 API 호출
          // await firebase.deleteVisitHistory(data.id);
          log(`방문 기록 삭제 API 호출 (id: ${data.id})`);
          break;
      }
    } else if (storeName === STORES.PLANNED_VISITS) {
      switch (operation) {
        case 'add':
          // 방문 계획 추가 API 호출
          // await firebase.addPlannedVisit(data);
          log(`방문 계획 추가 API 호출 (userId: ${data.userId}, placeId: ${data.placeId})`);
          break;
        case 'update':
          // 방문 계획 업데이트 API 호출
          // await firebase.updatePlannedVisit(data.id, data);
          log(`방문 계획 업데이트 API 호출 (id: ${data.id})`);
          break;
        case 'delete':
          // 방문 계획 삭제 API 호출
          // await firebase.deletePlannedVisit(data.id);
          log(`방문 계획 삭제 API 호출 (id: ${data.id})`);
          break;
      }
    }
    
    // 성공 반환 (실제로는 API 응답에 따라 성공 여부 결정)
    return true;
  } catch (error) {
    log('방문 동기화 오류:', error, 'error');
    return false;
  }
}

/**
 * 동기화 작업 대기열에 추가
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} operationType - 작업 유형 (add, update, delete)
 * @param {string} storeName - 스토어 이름
 * @param {Object} data - 데이터
 * @param {Object} options - 옵션
 * @param {boolean} options.isCritical - 중요 작업 여부
 * @param {number} options.priority - 우선순위 (1-10, 높을수록 우선)
 * @returns {Promise<string|boolean>} 작업 ID 또는 false
 */
export async function queueSyncTask(userId, operationType, storeName, data, options = {}) {
  try {
    if (!userId) {
      log('사용자 ID가 필요합니다', null, 'error');
      return false;
    }
    
    // 옵션 정규화
    const opts = {
      isCritical: false,
      priority: 5,
      ...options
    };
    
    const taskId = await addToSyncQueue(userId, operationType, storeName, data, {
      isCritical: opts.isCritical,
      priority: opts.priority
    });
    
    // 온라인 상태이고 동기화가 진행 중이 아니면 즉시 동기화 시작
    if (!isOffline() && !syncInProgress) {
      // 다음 동기화 예약 (느린 네트워크에서도 UI 응답성 유지를 위해 약간 지연)
      setTimeout(() => {
        startSync();
      }, 300);
    }
    
    return taskId;
  } catch (error) {
    log('동기화 작업 추가 오류:', error, 'error');
    return false;
  }
}

/**
 * 동기화 대기열 초기화
 * 
 * @param {string} storeName - 스토어 이름 (선택적)
 * @param {Object} options - 옵션
 * @param {boolean} options.preserveCritical - 중요 작업 보존 여부
 * @returns {Promise<boolean>} 성공 여부
 */
export async function clearSyncQueue(storeName = null, options = {}) {
  try {
    const { preserveCritical = true } = options;
    
    if (storeName) {
      // 특정 스토어의 작업만 삭제
      const tasks = await getPendingSyncItems();
      const tasksToDelete = tasks.filter(task => {
        // 중요 작업 보존 옵션이 켜져 있으면 중요하지 않은 작업만 삭제
        if (preserveCritical && task.isCritical) {
          return false;
        }
        return task.storeName === storeName;
      });
      
      for (const task of tasksToDelete) {
        await updateSyncQueueItemStatus(task.id, 'cancelled');
      }
      
      log(`${tasksToDelete.length}개 작업 삭제됨 (스토어: ${storeName}, 중요 작업 보존: ${preserveCritical})`);
      return true;
    } else {
      // 모든 작업 삭제 (중요 작업 보존 옵션 적용)
      if (preserveCritical) {
        const tasks = await getPendingSyncItems();
        const criticalTasks = tasks.filter(task => task.isCritical);
        const nonCriticalTasks = tasks.filter(task => !task.isCritical);
        
        // 중요하지 않은 작업만 삭제
        await clearStore(STORES.SYNC_QUEUE);
        
        // 중요 작업 다시 추가
        for (const task of criticalTasks) {
          await addToSyncQueue(
            task.userId,
            task.operationType,
            task.storeName,
            task.data,
            { isCritical: true, priority: task.priority || 5 }
          );
        }
        
        log(`${nonCriticalTasks.length}개 일반 작업 삭제됨, ${criticalTasks.length}개 중요 작업 유지됨`);
      } else {
        // 모든 작업 삭제
        await clearStore(STORES.SYNC_QUEUE);
        log('모든 동기화 작업 삭제됨');
      }
      
      return true;
    }
  } catch (error) {
    log('동기화 대기열 초기화 오류:', error, 'error');
    return false;
  }
}

/**
 * 대기 중인 작업 개수 가져오기
 * 
 * @param {string} storeName - 스토어 이름 (선택적)
 * @returns {Promise<number>} 작업 개수
 */
async function getPendingTasksCount(storeName = null) {
  try {
    const tasks = await getPendingSyncItems();
    
    if (storeName) {
      return tasks.filter(task => task.storeName === storeName).length;
    }
    
    return tasks.length;
  } catch (error) {
    log('대기 중인 작업 개수 가져오기 오류:', error, 'error');
    return 0;
  }
}

/**
 * 중요 작업 개수 가져오기
 * 
 * @returns {Promise<number>} 중요 작업 개수
 */
async function getCriticalTasksCount() {
  try {
    const tasks = await getPendingSyncItems();
    return tasks.filter(task => task.isCritical).length;
  } catch (error) {
    log('중요 작업 개수 가져오기 오류:', error, 'error');
    return 0;
  }
}

/**
 * 캐시 정보 가져오기
 * 
 * @returns {Promise<Object>} 캐시 정보
 */
async function getCacheInfo() {
  try {
    // 캐시 스토리지 정보 수집
    const cacheInfo = {
      syncQueue: {
        count: 0,
        critical: 0
      },
      localStorage: {
        size: 0,
        items: 0
      },
      indexedDB: {
        size: 0,
        items: 0
      },
      cacheStorage: {
        size: 0,
        items: 0
      }
    };
    
    // 동기화 큐 정보
    try {
      const tasks = await getPendingSyncItems();
      cacheInfo.syncQueue.count = tasks.length;
      cacheInfo.syncQueue.critical = tasks.filter(task => task.isCritical).length;
    } catch (err) {
      log('동기화 큐 정보 가져오기 오류:', err, 'warn');
    }
    
    // 로컬 스토리지 정보
    try {
      cacheInfo.localStorage.items = localStorage.length;
      
      // 로컬 스토리지 크기 예상 (대략적)
      let size = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        size += (key.length + value.length) * 2; // UTF-16 인코딩 (2바이트)
      }
      cacheInfo.localStorage.size = size;
    } catch (err) {
      log('로컬 스토리지 정보 가져오기 오류:', err, 'warn');
    }
    
    // IndexedDB 정보 (지원되는 경우)
    if ('indexedDB' in window) {
      try {
        // 캐시 유틸리티 사용
        const stats = await cacheUtils.getCacheStats();
        cacheInfo.indexedDB = stats.indexedDB;
      } catch (err) {
        log('IndexedDB 정보 가져오기 오류:', err, 'warn');
      }
    }
    
    // Cache Storage API 정보 (지원되는 경우)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        cacheInfo.cacheStorage.items = cacheNames.length;
        
        // 크기 예상 (현재 정확한 크기 측정 불가)
        // 실제 값을 가져올 수 없으므로 -1로 표시
        cacheInfo.cacheStorage.size = -1;
      } catch (err) {
        log('Cache Storage 정보 가져오기 오류:', err, 'warn');
      }
    }
    
    return cacheInfo;
  } catch (error) {
    log('캐시 정보 가져오기 오류:', error, 'error');
    return {
      syncQueue: { count: 0, critical: 0 },
      localStorage: { size: 0, items: 0 },
      indexedDB: { size: 0, items: 0 },
      cacheStorage: { size: 0, items: 0 }
    };
  }
}

/**
 * 동기화 상태 가져오기
 * 
 * @returns {Object} 동기화 상태 정보
 */
export function getSyncStatus() {
  return {
    inProgress: syncInProgress,
    isOffline: isOffline(),
    syncTimerActive: !!syncTimer,
    connectionType: networkUtils.getConnectionType(),
    pendingTasksCount: null, // 비동기로 가져와야 함
    lastSyncTime: appState.lastSyncTime,
    lowPowerMode: appState.lowPowerMode,
    appState: {
      isActive: appState.isActive,
      isBackground: appState.isBackground,
      isPWA: appState.isPWA,
      serviceWorkerActive: appState.serviceWorkerActive
    },
    networkStatus: {
      online: networkUtils.isOnline(),
      connectionType: networkUtils.getConnectionType(),
      connectionSpeed: networkUtils.getConnectionSpeed(),
      effectiveType: networkUtils.getEffectiveConnectionType(),
      saveData: networkUtils.isSaveDataEnabled()
    },
    adaptiveConfig: {
      currentSyncInterval: adaptiveConfig.currentSyncInterval,
      batteryLevel: adaptiveConfig.batteryLevel,
      isCharging: adaptiveConfig.isCharging
    }
  };
}

// 모듈 내보내기
const offlineManager = {
  initOfflineManager,
  startSync,
  stopSync,
  queueSyncTask,
  clearSyncQueue,
  getSyncStatus,
  isOffline,
  addEventListener,
  removeEventListener,
  testConnection,
  // 추가 메서드
  enableLowPowerMode: (enable) => toggleLowPowerMode(enable),
  getCacheInfo,
  forceSync: () => startSync({ force: true }),
  getPendingTasksCount,
  // 사용자 친화적인 별칭
  triggerSync: () => startSync({ force: true }),
  pauseSync: stopSync,
  addSyncTask: queueSyncTask,
  clearAllTasks: () => clearSyncQueue(null, { preserveCritical: false }),
  checkNetworkConnection: testConnection
};

export default offlineManager;
