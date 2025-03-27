// src/config/firebase.js - Part 1: 초기화 및 기본 설정
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  GeoPoint, 
  enableIndexedDbPersistence, 
  disableNetwork, 
  enableNetwork,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  updateDoc,
  limit,
  startAfter,
  endBefore,
  runTransaction,
  writeBatch
} from 'firebase/firestore';

// 환경별 설정 파일
const firebaseConfig = {
  development: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
  },
  staging: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
  },
  production: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
  }
};

// 현재 환경 가져오기
const env = process.env.REACT_APP_ENV || 'development';
const config = firebaseConfig[env];

// 로그 및 에러 추적 유틸리티 함수
const logDebug = (message, data) => {
  if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_VERBOSE_LOGGING === 'true') {
    console.log(`[Firebase] ${message}`, data || '');
  }
};

// 초기화 로그
logDebug(`Firebase ${env} 환경으로 초기화 중...`);

// 가중치 기본값 가져오기 함수
export const getDefaultWeights = () => {
  return {
    mbti: 0.35,
    interests: 0.25,
    talents: 0.15, 
    mood: 0.15,
    location: 0.10
  };
};

// Firebase 초기화
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Analytics 및 Performance 통합 (프로덕션/스테이징 환경에서만)
let analytics = null;
let performance = null;

if (env !== 'development' && typeof window !== 'undefined') {
  try {
    import('firebase/analytics').then((module) => {
      analytics = module.getAnalytics(app);
      logDebug('Firebase Analytics 초기화 완료');
    }).catch(err => {
      console.warn('Firebase Analytics 로드 실패:', err);
    });

    // 성능 모니터링 초기화 (선택적)
    if (process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING === 'true') {
      import('firebase/performance').then((module) => {
        performance = module.getPerformance(app);
        logDebug('Firebase Performance 초기화 완료');
      }).catch(err => {
        console.warn('Firebase Performance 로드 실패:', err);
      });
    }
  } catch (err) {
    console.warn('Firebase 모니터링 서비스 초기화 실패:', err);
  }
}

// 에러 추적 함수
const logError = (error, context = {}) => {
  console.error(`[Firebase] 오류:`, error, context);
  
  // 에러 모니터링 서비스로 전송 (프로덕션/스테이징 환경에서만)
  if ((env === 'production' || env === 'staging') && 
      process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true' && 
      analytics) {
    try {
      import('firebase/analytics').then((module) => {
        module.logEvent(analytics, 'exception', {
          description: error.message || 'Unknown error',
          fatal: context.fatal || false,
          env: env,
          componentName: context.componentName || 'firebase',
          userId: context.userId || null,
          timestamp: Date.now()
        });
      }).catch(e => console.warn('에러 이벤트 로깅 실패:', e));
    } catch (e) {
      console.warn('에러 추적 실패:', e);
    }
  }
};

// 수정된 코드: 에뮬레이터 모드 강제 비활성화
//if (false) { // process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATOR === 'true' 
//  const host = process.env.REACT_APP_EMULATOR_HOST || 'localhost';
//  connectFirestoreEmulator(db, host, 8080);
//  connectAuthEmulator(auth, `http://${host}:9099`);
//  connectStorageEmulator(storage, host, 9199);
//  console.log('[Firebase] 에뮬레이터를 사용합니다.');
//} else {
  console.log('[Firebase] 실제 Firebase 서비스를 사용합니다.');
//}

// 이벤트 버스 - 컴포넌트간 통신을 위한 이벤트 관리
export const firebaseEvents = {
  ONLINE_STATUS_CHANGED: 'firebase-online-status-changed',
  PERSISTENCE_STATUS_CHANGED: 'firebase-persistence-status-changed',
  DATA_SYNC_COMPLETED: 'firebase-data-sync-completed',
  SYNC_ERROR: 'firebase-sync-error',  
  OPERATION_COMPLETED: 'firebase-operation-completed', 
  NETWORK_RETRY_STARTED: 'firebase-network-retry-started', 
  NETWORK_RETRY_SUCCESS: 'firebase-network-retry-success', 
  NETWORK_RETRY_FAILED: 'firebase-network-retry-failed', 
  REVIEW_UPDATED: 'firebase-review-updated', 
  REVIEW_SYNC_STARTED: 'firebase-review-sync-started', 
  REVIEW_SYNC_COMPLETED: 'firebase-review-sync-completed'
  // 푸시 알림 관련 이벤트 제거 (오류 원인)
};

// 커스텀 이벤트 발생 함수
const dispatchFirebaseEvent = (eventName, detail) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    logDebug(`이벤트 발생: ${eventName}`, detail);
  }
};

// 오프라인 지속성 및 네트워크 상태 관리 설정
let persistenceEnabled = false;
let initializationAttempted = false;
let networkEnabled = true;
let pendingOperations = []; // 오프라인 상태에서 대기 중인 작업 큐

// 오프라인 상태 확인 유틸리티 함수
export const isOffline = () => {
  // 네트워크 정보 API가 있으면 더 정확한 정보 제공
  if (navigator.connection && navigator.connection.effectiveType === 'slow-2g') {
    // 매우 느린 연결도 오프라인으로 간주
    return true;
  }
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

// 연결 상태 세부 정보 가져오기
export const getConnectionInfo = () => {
  if (typeof navigator === 'undefined' || !navigator.connection) {
    return {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: null,
      rtt: null,
      saveData: false
    };
  }

  return {
    online: navigator.onLine,
    type: navigator.connection.type || 'unknown',
    effectiveType: navigator.connection.effectiveType || 'unknown',
    downlink: navigator.connection.downlink || null,
    rtt: navigator.connection.rtt || null,
    saveData: navigator.connection.saveData || false
  };
};

// 오프라인 작업 큐 관리 함수
export const addToPendingOperations = (operation) => {
  if (!operation || !operation.type) return false;
  
  try {
    // 기존 ID가 있으면 유지
    const operationId = operation.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // 중복 작업 확인 (같은 장소, 같은 사용자, 같은 타입의 최근 작업이 있는지)
    const isDuplicate = pendingOperations.some(op => 
      op.type === operation.type && 
      op.data.placeId === operation.data.placeId &&
      op.data.userId === operation.data.userId &&
      // 최근 10초 이내의 작업만 중복으로 간주
      (Date.now() - op.timestamp < 10000)
    );
    
    if (isDuplicate) {
      logDebug(`중복된 작업 무시: ${operation.type} (${operation.data.placeId})`);
      return false;
    }
    
    const newOperation = {
      ...operation,
      timestamp: Date.now(),
      id: operationId,
      retryCount: operation.retryCount || 0,
      isCritical: operation.isCritical || false // 중요 작업 표시 추가
    };
    
    pendingOperations.push(newOperation);
    
    // 로컬 스토리지에도 저장
    try {
      localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
      
      // 추가: IndexedDB 백업 저장 (더 안정적인 저장소)
      if ('indexedDB' in window) {
        backupPendingOperationsToIndexedDB(pendingOperations)
          .catch(err => console.warn('[Firebase] IndexedDB 백업 실패:', err));
      }
    } catch (storageError) {
      console.warn('[Firebase] 로컬 스토리지에 작업 큐 저장 실패:', storageError);
    }
    
    // 타입별로 이벤트 발생
    if (operation.type.includes('review')) {
      dispatchFirebaseEvent(firebaseEvents.REVIEW_UPDATED, {
        type: operation.type,
        placeId: operation.data.placeId,
        userId: operation.data.userId,
        offlineQueued: true,
        timestamp: Date.now()
      });
    }
    
    // 작업 큐 상태가 변경되었음을 알리는 이벤트 발생
    dispatchFirebaseEvent('pending-operations-changed', {
      count: pendingOperations.length,
      operations: pendingOperations.map(op => ({
        id: op.id,
        type: op.type,
        timestamp: op.timestamp
      }))
    });
    
    logDebug(`오프라인 작업 큐에 추가됨: ${operation.type}`, operation);
    
    // 오프라인일 때도 자동 동기화 시도 설정 (백그라운드 동기화 지원 확인)
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then(registration => {
          registration.sync.register('firebase-sync')
            .catch(err => console.warn('백그라운드 동기화 등록 실패:', err));
        })
        .catch(err => console.warn('서비스 워커 준비 실패:', err));
    }
    
    return true;
  } catch (error) {
    console.error('[Firebase] 작업 큐에 추가 실패:', error);
    return false;
  }
};

// IndexedDB에 작업 큐 백업
const backupPendingOperationsToIndexedDB = async (operations) => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('FirebaseOfflineQueue', 1);
    
    request.onerror = () => reject(new Error('IndexedDB 열기 실패'));
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('operations')) {
        db.createObjectStore('operations', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');
      
      // 기존 데이터 삭제
      store.clear();
      
      // 새 데이터 저장
      operations.forEach(operation => {
        store.add(operation);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (err) => reject(err);
    };
  });
};

// 오프라인 작업 큐에서 작업 제거
export const removeFromPendingOperations = (operationId) => {
  if (!operationId) return false;
  
  try {
    const initialLength = pendingOperations.length;
    pendingOperations = pendingOperations.filter(op => op.id !== operationId);
    
    if (pendingOperations.length < initialLength) {
      // 로컬 스토리지 업데이트
      try {
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
        
        // IndexedDB 백업 업데이트
        if ('indexedDB' in window) {
          backupPendingOperationsToIndexedDB(pendingOperations)
            .catch(err => console.warn('[Firebase] IndexedDB 백업 업데이트 실패:', err));
        }
        
        // 작업 큐 상태가 변경되었음을 알리는 이벤트 발생
        dispatchFirebaseEvent('pending-operations-changed', {
          count: pendingOperations.length,
          operations: pendingOperations.map(op => ({
            id: op.id,
            type: op.type,
            timestamp: op.timestamp
          }))
        });
      } catch (storageError) {
        console.warn('[Firebase] 로컬 스토리지에 작업 큐 저장 실패:', storageError);
      }
      
      logDebug(`작업 큐에서 ${operationId} 제거됨`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Firebase] 작업 큐에서 제거 실패:', error);
    return false;
  }
};

// 대기 중인 작업 개수 확인
export const getPendingOperationsCount = (type = null) => {
  if (type) {
    return pendingOperations.filter(op => op.type === type).length;
  }
  return pendingOperations.length;
};

// checkPersistenceAndRetry 함수
export const checkPersistenceAndRetry = async (maxAttempts = 3) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const currentAttempt = ++attempts; // 현재 시도 횟수를 별도 변수에 저장
    
    // 이미 활성화되었거나 시도된 경우 건너뛰기
    if (persistenceEnabled || initializationAttempted) {
      return { 
        success: persistenceEnabled, 
        attempted: true, 
        attempts: currentAttempt 
      };
    }
    
    // 시도 간에 지연 (재시도)
    if (currentAttempt > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt));
    }
    
    // 오프라인 지원 설정 시도
    const result = await setupOfflineSupport();
    
    // 성공하면 즉시 반환
    if (result.success) {
      return { ...result, attempts: currentAttempt }; // 안전하게 현재 시도 횟수 사용
    }
  }
  
  // 모든 시도 후에도 실패
  return { 
    success: false, 
    attempted: true, 
    attempts,
    maxExceeded: true
  };
};

// 오프라인 지속성 활성화 함수 - 오류 처리 강화
const setupOfflineSupport = async () => {
  // 이미 성공적으로 활성화되었거나 시도 중인 경우 건너뛰기
  if (persistenceEnabled || initializationAttempted) {
    return { success: persistenceEnabled, attempted: true };
  }
  
  initializationAttempted = true;
  
  try {
    // 오프라인 지속성 활성화 전 상태 저장
    const initialState = {
      networkEnabled: networkEnabled,
      onLine: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectionInfo: getConnectionInfo()
    };
    
    logDebug('오프라인 지속성 활성화 시도 중...', initialState);
    
    await enableIndexedDbPersistence(db, {
      synchronizeTabs: true // 여러 탭 간 동기화 활성화
    });
    
    logDebug('오프라인 지속성 활성화 성공');
    persistenceEnabled = true;
    
    // 대기 중인 작업 로드
    await loadPendingOperations();
    
    // 이벤트 발생
    dispatchFirebaseEvent(firebaseEvents.PERSISTENCE_STATUS_CHANGED, { 
      enabled: true,
      timestamp: Date.now() 
    });
    
    return { success: true, attempted: true };
  } catch (error) {
    console.error('[Firebase] 오프라인 지속성 활성화 오류:', error);
    
    let errorInfo = { 
      code: error.code, 
      message: error.message,
      timestamp: Date.now()
    };
    
    if (error.code === 'failed-precondition') {
      errorInfo.reason = 'multiple-tabs';
      console.warn('[Firebase] 여러 탭이 열려 있습니다. 한 번에 하나의 탭에서만 지속성을 활성화할 수 있습니다.');
    } else if (error.code === 'unimplemented') {
      errorInfo.reason = 'browser-unsupported';
      console.warn('[Firebase] 현재 브라우저는 오프라인 지속성을 지원하지 않습니다.');
    } else if (error.code === 'storage-unavailable') {
      errorInfo.reason = 'storage-unavailable';
      console.warn('[Firebase] 스토리지 접근이 불가능합니다. 프라이빗 브라우징 모드인지 확인하세요.');
    } else {
      errorInfo.reason = 'unknown';
    }
    
    // 실패 이벤트 발생
    dispatchFirebaseEvent(firebaseEvents.PERSISTENCE_STATUS_CHANGED, {
      enabled: false, 
      error: errorInfo
    });
    
    // IndexedDB 사용 불가능한 경우에도 앱 사용은 가능하도록 처리
    // 대기 중인 작업 로드 시도
    await loadPendingOperations();
    
    return { success: false, attempted: true, error: errorInfo };
  }
};

// 로컬 스토리지에서 대기 중인 작업 로드
const loadPendingOperations = async () => {
  try {
    const storedOperations = localStorage.getItem('pendingOperations');
    const loadedOperations = storedOperations ? JSON.parse(storedOperations) : [];
    
    logDebug(`${loadedOperations.length}개의 대기 중인 작업 로드됨`);
    
    // 오래된 작업 정리 (30일 이상 지난 작업)
    const now = Date.now();
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30일
    
    const oldOps = loadedOperations.filter(op => now - op.timestamp > MAX_AGE);
    if (oldOps.length > 0) {
      logDebug(`${oldOps.length}개의 오래된 작업 정리됨`);
      pendingOperations = loadedOperations.filter(op => now - op.timestamp <= MAX_AGE);
      
      // 저장소 업데이트
      try {
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
      } catch (storageError) {
        console.warn('[Firebase] 로컬 스토리지에 작업 큐 저장 실패:', storageError);
      }
    } else {
      pendingOperations = loadedOperations;
    }
    
    return loadedOperations;
  } catch (error) {
    console.warn('[Firebase] 대기 중인 작업 로드 실패:', error);
    pendingOperations = [];
    return [];
  }
};

// 네트워크 상태 모니터링 - 연결 감시 및 재연결 시도
export const setupNetworkMonitoring = () => {
  let lastNetworkStatusTime = Date.now();
  
  // 온라인 상태 변경 핸들러
  const handleOnline = async () => {
    // 너무 빈번한 변경 방지
    if (Date.now() - lastNetworkStatusTime < 300) {
      return;
    }
    
    lastNetworkStatusTime = Date.now();
    
    // 네트워크 재연결 시 처리
    try {
      logDebug('네트워크 연결 감지됨');
      
      // 오프라인 시간 추적 종료
      appState.offlineSince = null;
      
      // 네트워크 활성화
      if (!networkEnabled) {
        await enableNetwork(db);
        networkEnabled = true;
        
        dispatchFirebaseEvent(firebaseEvents.ONLINE_STATUS_CHANGED, { 
          online: true,
          timestamp: Date.now()
        });
      }
      
      // 대기 중인 작업이 있으면 처리
      if (pendingOperations.length > 0) {
        logDebug(`${pendingOperations.length}개의 대기 중인 작업 처리 시작`);
        try {
          // 작업 처리 함수 호출 (실제 구현 필요)
        } catch (syncError) {
          console.error('[Firebase] 동기화 오류:', syncError);
        }
      }
    } catch (error) {
      console.error('[Firebase] 네트워크 상태 변경 처리 오류:', error);
    }
  };
  
  // 오프라인 상태 변경 핸들러
  const handleOffline = async () => {
    // 너무 빈번한 변경 방지
    if (Date.now() - lastNetworkStatusTime < 300) {
      return;
    }
    
    lastNetworkStatusTime = Date.now();
    
    try {
      logDebug('네트워크 연결 끊김');
      
      // 오프라인 시작 시간 기록
      appState.offlineSince = Date.now();
      
      // 네트워크 비활성화
      if (networkEnabled) {
        await disableNetwork(db);
        networkEnabled = false;
        
        dispatchFirebaseEvent(firebaseEvents.ONLINE_STATUS_CHANGED, { 
          online: false,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[Firebase] 네트워크 비활성화 오류:', error);
    }
  };
  
  // 초기 네트워크 상태 설정
  if (typeof navigator !== 'undefined') {
    if (navigator.onLine) {
      setTimeout(() => {
        handleOnline();
      }, 100);
    } else {
      setTimeout(() => {
        handleOffline();
      }, 100);
    }
  }
  
  // 이벤트 리스너 등록
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 정리 함수 반환
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
  
  return () => {}; // 기본 정리 함수
};

// 앱 상태 객체 초기화
const appState = {
  offlineSince: null,
  lastActiveTime: Date.now()
};

// 장소 상세 정보 가져오기 함수
export const getPlaceDetails = async (placeId, options = {}) => {
  if (!placeId) {
    return { 
      success: false, 
      error: 'placeId가 없습니다.', 
      data: null 
    };
  }
  
  const { useCache = true, timeout = 10000, defaultCategory = 'default' } = options;
  
  try {
    // 타임아웃 프로미스 생성
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('장소 정보 요청 시간 초과')), timeout);
    });
    
    // 캐시 확인 (오프라인 또는 캐시 사용 옵션이 켜져 있을 때)
    if ((isOffline() || useCache) && typeof localStorage !== 'undefined') {
      try {
        const cachedData = localStorage.getItem(`place_${placeId}`);
        if (cachedData) {
          const placeData = JSON.parse(cachedData);
          logDebug(`캐시에서 장소 ${placeId} 데이터 로드됨`);
          
          // 캐시된 데이터가 있어도 오프라인이 아니면 백그라운드에서 최신 데이터 가져오기
          if (!isOffline()) {
            fetchAndUpdatePlaceCache(placeId).catch(() => {
              logDebug(`백그라운드 장소 데이터 업데이트 실패: ${placeId}`);
            });
          }
          
          return { 
            success: true, 
            data: placeData, 
            fromCache: true 
          };
        }
      } catch (cacheError) {
        console.warn(`[Firebase] 장소 캐시 읽기 오류: ${placeId}`, cacheError);
      }
    }
    
    // 오프라인 상태면서 캐시가 없을 때 더미 데이터 반환
    if (isOffline()) {
      logDebug(`오프라인 상태에서 더미 장소 데이터 생성: ${placeId}`);
      const dummyData = generateDummyPlace(placeId, {
        category: defaultCategory, 
        offlineGenerated: true,
        notFound: false
      });
      
      return { 
        success: true, 
        data: dummyData, 
        fromCache: false,
        isDummy: true
      };
    }
    
    // 파이어베이스에서 데이터 가져오기 (타임아웃 적용)
    const fetchPromise = async () => {
      const docRef = doc(db, 'places', placeId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const placeData = { id: docSnap.id, ...docSnap.data() };
        
        // 데이터 캐싱
        if (typeof localStorage !== 'undefined' && useCache) {
          try {
            localStorage.setItem(`place_${placeId}`, JSON.stringify(placeData));
            logDebug(`장소 ${placeId} 데이터 캐시됨`);
          } catch (cacheError) {
            console.warn(`[Firebase] 장소 캐시 저장 오류: ${placeId}`, cacheError);
          }
        }
        
        return { 
          success: true, 
          data: placeData, 
          fromCache: false 
        };
      } else {
        logDebug(`장소 ${placeId}를 찾을 수 없음`);
        
        // 장소를 찾을 수 없을 때 더미 데이터 생성 (notFound 플래그 설정)
        const notFoundDummy = generateDummyPlace(placeId, {
          category: defaultCategory,
          offlineGenerated: false,
          notFound: true
        });
        
        return { 
          success: true, 
          data: notFoundDummy, 
          isDummy: true,
          notFound: true 
        };
      }
    };
    
    // 타임아웃과 경쟁
    return await Promise.race([fetchPromise(), timeoutPromise]);
    
  } catch (error) {
    console.error(`[Firebase] 장소 상세 정보 가져오기 오류: ${placeId}`, error);
    
    // 오류 발생 시 더미 데이터 생성
    const errorDummy = generateDummyPlace(placeId, {
      category: defaultCategory,
      errorGenerated: true,
      errorMessage: error.message
    });
    
    return { 
      success: false, 
      error: error.message, 
      data: errorDummy,
      isDummy: true 
    };
  }
};

// 장소 데이터 백그라운드 업데이트 헬퍼 함수
const fetchAndUpdatePlaceCache = async (placeId) => {
  if (!placeId) return false;
  
  try {
    const docRef = doc(db, 'places', placeId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const placeData = { id: docSnap.id, ...docSnap.data() };
      localStorage.setItem(`place_${placeId}`, JSON.stringify(placeData));
      logDebug(`장소 ${placeId} 캐시 백그라운드 업데이트 완료`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[Firebase] 장소 백그라운드 업데이트 오류: ${placeId}`, error);
    return false;
  }
};

// 저장된 장소 직접 가져오기 함수
export const fetchSavedPlacesDirectly = async (userId, options = {}) => {
  if (!userId) {
    return { 
      success: false, 
      error: 'userId가 없습니다.', 
      data: [] 
    };
  }
  
  const { useCache = true, timeout = 15000 } = options;
  
  try {
    // 오프라인이거나 캐시 사용 옵션이 켜져 있을 때 캐시 확인
    if ((isOffline() || useCache) && typeof localStorage !== 'undefined') {
      try {
        const cachedData = localStorage.getItem(`savedPlaces_${userId}`);
        if (cachedData) {
          const savedPlaces = JSON.parse(cachedData);
          logDebug(`캐시에서 저장된 장소 데이터 로드됨 (${savedPlaces.length}개)`);
          
          // 캐시된 데이터가 있어도 오프라인이 아니면 백그라운드에서 최신 데이터 가져오기
          if (!isOffline()) {
            fetchAndUpdateSavedPlacesCache(userId).catch(() => {
              logDebug(`백그라운드 저장된 장소 데이터 업데이트 실패`);
            });
          }
          
          return { 
            success: true, 
            data: savedPlaces, 
            fromCache: true 
          };
        }
      } catch (cacheError) {
        console.warn(`[Firebase] 저장된 장소 캐시 읽기 오류:`, cacheError);
      }
    }
    
    // 오프라인 상태면서 캐시가 없을 때 빈 배열 반환
    if (isOffline()) {
      logDebug(`오프라인 상태로 저장된 장소 빈 배열 반환`);
      return { 
        success: true, 
        data: [], 
        fromCache: false,
        isOffline: true
      };
    }
    
    // 타임아웃 프로미스 생성
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('저장된 장소 요청 시간 초과')), timeout);
    });
    
    // 파이어베이스에서 데이터 가져오기 (타임아웃 적용)
    const fetchPromise = async () => {
      // 저장된 장소 ID 형식: userId_placeId
      const savedPlacesRef = collection(db, 'savedPlaces');
      const q = query(savedPlacesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        logDebug(`저장된 장소가 없습니다 (userId: ${userId})`);
        return { 
          success: true, 
          data: [], 
          fromCache: false 
        };
      }
      
      // 결과 처리
      const savedPlaces = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        // ID 및 placeId 정규화
        const id = doc.id;
        let placeId = data.placeId;
        
        // 복합 ID에서 placeId 추출 (userId_placeId 형식)
        if (id.includes('_') && id.startsWith(userId)) {
          const splitId = id.split('_');
          if (splitId.length > 1) {
            placeId = splitId.slice(1).join('_'); // userId 이후의 모든 부분을 placeId로
          }
        }
        
        return {
          id,
          userId: data.userId,
          placeId: placeId,
          savedAt: data.savedAt ? data.savedAt.toDate().toISOString() : new Date().toISOString(),
          lastUpdated: data.lastUpdated ? data.lastUpdated.toDate().toISOString() : new Date().toISOString(),
          placeData: data.placeData || {}
        };
      });
      
      // 타임스탬프 기준 내림차순 정렬 (최신순)
      savedPlaces.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      
      // 데이터 캐싱
      if (typeof localStorage !== 'undefined' && useCache) {
        try {
          localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(savedPlaces));
          logDebug(`저장된 장소 데이터 캐시됨 (${savedPlaces.length}개)`);
        } catch (cacheError) {
          console.warn(`[Firebase] 저장된 장소 캐시 저장 오류:`, cacheError);
        }
      }
      
      return { 
        success: true, 
        data: savedPlaces, 
        fromCache: false 
      };
    };
    
    // 타임아웃과 경쟁
    return await Promise.race([fetchPromise(), timeoutPromise]);
    
  } catch (error) {
    console.error(`[Firebase] 저장된 장소 가져오기 오류:`, error);
    return { 
      success: false, 
      error: error.message, 
      data: [] 
    };
  }
};

// 저장된 장소 데이터 백그라운드 업데이트 헬퍼 함수
const fetchAndUpdateSavedPlacesCache = async (userId) => {
  if (!userId) return false;
  
  try {
    const savedPlacesRef = collection(db, 'savedPlaces');
    const q = query(savedPlacesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return false;
    
    const savedPlaces = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      savedAt: doc.data().savedAt ? doc.data().savedAt.toDate().toISOString() : new Date().toISOString()
    }));
    
    if (savedPlaces.length > 0) {
      localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(savedPlaces));
      logDebug(`저장된 장소 캐시 백그라운드 업데이트 완료 (${savedPlaces.length}개)`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[Firebase] 저장된 장소 백그라운드 업데이트 오류:`, error);
    return false;
  }
};

// 더미 장소 데이터 생성 함수
export const generateDummyPlace = (placeId, options = {}) => {
  const id = placeId || `place_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  logDebug(`더미 장소 데이터 생성 (ID: ${id})`, options);
  
  // 더미 이미지 배열 생성 - 옵션에 따라 다양한 이미지 생성
  const dummyImages = [
    '/assets/images/default-place.jpg',
    '/assets/images/default-place.jpg',
    '/assets/images/default-place.jpg'
  ];
  
  // 기본 위치 (서울)
  const defaultLocation = { latitude: 37.5642135, longitude: 127.0016985 };
  
  // 지역 옵션에 따른 위치 설정
  let locationData = defaultLocation;
  if (options.region) {
    if (options.region === '부산') {
      locationData = { latitude: 35.1795543, longitude: 129.0756416 };
    } else if (options.region === '제주') {
      locationData = { latitude: 33.4996213, longitude: 126.5311884 };
    }
  }
  
  // 기본 카테고리 관련 태그 생성
  const getDefaultTags = (category) => {
    switch(category) {
      case 'cafe':
        return ['커피', '디저트', '카페'];
      case 'restaurant':
        return ['맛집', '식당', '음식'];
      case 'attraction':
        return ['관광', '여행', '명소'];
      default:
        return ['여행', '장소', '추천'];
    }
  };
  
  // 기본 이름 생성
  const defaultName = options.name || `장소 ${id.slice(-5)}`;
  
  // 오프라인 생성 시 현재 시간 추가
  const isOfflineGenerated = options.offlineGenerated || !navigator.onLine;
  const offlineTimestamp = isOfflineGenerated ? new Date().toISOString() : null;
  
  return {
    id: id,
    placeId: id,
    name: defaultName,
    description: options.description || '테스트용 더미 장소입니다. 현재 데이터를 로드할 수 없어 더미 데이터를 표시합니다.',
    location: locationData,
    region: options.region || '서울',
    subRegion: options.subRegion || '강남/서초',
    category: options.category || 'cafe',
    subCategory: options.subCategory || '카페',
    photos: options.photos || dummyImages,
    thumbnail: options.thumbnail || dummyImages[0],
    // MBTI 매칭 점수 - 옵션에 따라 설정
    mbtiMatchScore: options.mbtiMatchScore || {
      'ENFJ': 8, 'INFJ': 7, 'ENFP': 9, 'INFP': 8,
      'ENTJ': 6, 'INTJ': 7, 'ENTP': 8, 'INTP': 7,
      'ESFJ': 7, 'ISFJ': 6, 'ESFP': 8, 'ISFP': 7,
      'ESTJ': 5, 'ISTJ': 6, 'ESTP': 7, 'ISTP': 6
    },
    interestTags: options.interestTags || getDefaultTags(options.category || 'cafe'),
    talentRelevance: options.talentRelevance || ['사진촬영', '글쓰기'],
    moodMatchScore: options.moodMatchScore || {
      '기쁨': 8, '스트레스': 4, '피곤함': 6, '설렘': 9, '평온함': 7
    },
    specialFeatures: options.specialFeatures || ['인스타스팟', '조용한', '데이트'],
    averageRating: options.averageRating || {
      overall: 4.5,
      byMbtiType: {
        'ENFP': 4.7,
        'INFJ': 4.5
      }
    },
    reviewCount: options.reviewCount || Math.floor(Math.random() * 20) + 5,
    priceLevel: options.priceLevel || 2,
    isDummy: true,
    offlineGenerated: isOfflineGenerated,
    offlineTimestamp: offlineTimestamp,
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: options.updatedAt || new Date().toISOString()
  };
};

// Firebase 연결 확인 함수
export const checkFirebaseConnection = async (timeoutMs = 5000) => {
  try {
    if (!navigator.onLine) {
      return { connected: false, reason: 'offline' };
    }
    
    const testPromise = new Promise((resolve, reject) => {
      const testConnection = async () => {
        try {
          const testQuery = query(collection(db, 'places'), limit(1));
          await getDocs(testQuery); // 변수 할당 없이 직접 호출
          resolve({ connected: true, timestamp: Date.now() });
        } catch (error) {
          reject(error);
        }
      };
      
      testConnection();
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
    });
    
    return await Promise.race([testPromise, timeoutPromise]);
  } catch (error) {
    return { 
      connected: false, 
      reason: 'error', 
      error: error.message,
      timestamp: Date.now()
    };
  }
};

// 수동 동기화 트리거 함수
export const triggerSync = async () => {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' };
  }
  
  try {
    // 실제 동기화 함수 구현 (앞서 정의한 함수들 활용)
    return { success: true };
  } catch (error) {
    console.error('[Firebase] 수동 동기화 오류:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// 최근 조회한 장소 가져오기
export const getRecentlyViewedPlaces = (userId, limit = 5) => {
  if (!userId || typeof localStorage === 'undefined') return [];
  
  try {
    const key = `recentlyViewed_${userId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    return JSON.parse(stored).slice(0, limit);
  } catch (error) {
    console.warn('[Firebase] 최근 조회 장소 가져오기 오류:', error);
    return [];
  }
};

// 최근 조회한 장소 추가
export const addRecentlyViewedPlace = (userId, place) => {
  if (!userId || !place || !place.id || typeof localStorage === 'undefined') return false;
  
  try {
    const key = `recentlyViewed_${userId}`;
    const stored = localStorage.getItem(key);
    let places = stored ? JSON.parse(stored) : [];
    
    // 중복 제거 (이미 있으면 제거하고 맨 앞으로 추가)
    places = places.filter(p => p.id !== place.id);
    
    // 최소한의 데이터만 저장 (용량 최적화)
    const minimalPlace = {
      id: place.id,
      name: place.name,
      category: place.category,
      thumbnail: place.thumbnail || place.photos?.[0],
      region: place.region,
      timestamp: new Date().toISOString()
    };
    
    // 맨 앞에 추가
    places.unshift(minimalPlace);
    
    // 최대 20개만 유지 (스토리지 공간 최적화)
    if (places.length > 20) {
      places = places.slice(0, 20);
    }
    
    localStorage.setItem(key, JSON.stringify(places));
    return true;
  } catch (error) {
    console.warn('[Firebase] 최근 조회 장소 추가 오류:', error);
    return false;
  }
};

// Firebase 초기화 시 네트워크 상태 모니터링 시작
if (typeof window !== 'undefined') {
  // 네트워크 모니터링 시작
  const cleanup = setupNetworkMonitoring();
  
  // 정리 함수 저장
  window._firebaseNetworkCleanup = cleanup;
  
  // 오프라인 지원 설정 - 지연 실행으로 초기 로딩 성능 영향 최소화
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      setupOfflineSupport().catch(err => {
        console.warn('[Firebase] 오프라인 지원 설정 오류:', err);
      });
    });
  } else {
    setTimeout(() => {
      setupOfflineSupport().catch(err => {
        console.warn('[Firebase] 오프라인 지원 설정 오류:', err);
      });
    }, 3000);
  }
}

// 기본 객체로 내보내기
const firebaseServices = {
  db,
  auth,
  storage,
  analytics,
  performance,
  env,
  getPlaceDetails,
  checkFirebaseConnection,
  fetchSavedPlacesDirectly,
  
  // 대기 중인 작업 관리
  addToPendingOperations,
  removeFromPendingOperations,
  getPendingOperationsCount,
  
  // 최근 조회 장소 관련 함수
  getRecentlyViewedPlaces,
  addRecentlyViewedPlace,
  
  // 빠른 접근을 위한 유틸리티 함수
  setupOfflineSupport,
  getConnectionInfo,
  isOffline,
  generateDummyPlace,
  triggerSync,
  
  // 로깅 및 에러 추적
  logDebug,
  logError
};

// 개별 요소도 내보내기
export {
  db,
  auth,
  storage,
  analytics,
  performance,
  env,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  updateDoc,
  limit,
  startAfter,
  endBefore,
  runTransaction,
  writeBatch,
  GeoPoint,
  logDebug,
  logError
};

export default firebaseServices;
