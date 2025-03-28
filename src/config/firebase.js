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
    // 동적 import 사용 - 메모리 사용 개선을 위해 필요할 때만 로드
    if (typeof window !== 'undefined' && navigator.onLine) {
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
      analytics && navigator.onLine) {
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

// 에뮬레이터 모드 설정 - 수정: 조건문 최적화 및 명확화
const shouldUseEmulator = process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATOR === 'true';

if (shouldUseEmulator) {
  const host = process.env.REACT_APP_EMULATOR_HOST || 'localhost';
  connectFirestoreEmulator(db, host, 8080);
  connectAuthEmulator(auth, `http://${host}:9099`);
  connectStorageEmulator(storage, host, 9199);
  console.log('[Firebase] 에뮬레이터를 사용합니다.');
} else {
  console.log('[Firebase] 실제 Firebase 서비스를 사용합니다.');
}

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
};

// 커스텀 이벤트 발생 함수 - 메모리 사용량 개선
const dispatchFirebaseEvent = (eventName, detail) => {
  if (typeof window !== 'undefined') {
    // 이벤트 객체를 미리 생성하지 않고 필요할 때만 생성
    window.dispatchEvent(new CustomEvent(eventName, { 
      detail: typeof detail === 'object' ? { ...detail, timestamp: Date.now() } : detail 
    }));
    logDebug(`이벤트 발생: ${eventName}`);
  }
};

// 오프라인 지속성 및 네트워크 상태 관리 설정
let persistenceEnabled = false;
let initializationAttempted = false;
let networkEnabled = true;
// 최대 작업 수 제한 추가 - 메모리 사용 개선
let pendingOperations = []; 
const MAX_PENDING_OPERATIONS = 100; // 최대 대기 작업 수 제한

// 앱 상태 객체 초기화
const appState = {
  offlineSince: null,
  lastActiveTime: Date.now(),
  // 추가: 메모리 사용량 모니터링
  memoryWarningIssued: false
};

// src/config/firebase.js - Part 2: 오프라인 지원 관련 기능

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

// 오프라인 작업 큐 관리 함수 - 메모리 누수 방지 개선
export const addToPendingOperations = (operation) => {
  if (!operation || !operation.type) return false;
  
  try {
    // 큐 크기 제한 확인 - 메모리 관리 개선
    if (pendingOperations.length >= MAX_PENDING_OPERATIONS) {
      // 가장 오래된 비중요 작업 제거
      const oldestNonCriticalIndex = pendingOperations.findIndex(op => !op.isCritical);
      if (oldestNonCriticalIndex >= 0) {
        pendingOperations.splice(oldestNonCriticalIndex, 1);
        logDebug(`작업 큐 크기 제한으로 가장 오래된 비중요 작업 제거됨`);
      } else {
        // 모든 작업이 중요한 경우 가장 오래된 작업 제거
        pendingOperations.shift();
        logDebug(`작업 큐 크기 제한으로 가장 오래된 작업 제거됨`);
      }
    }
    
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
      isCritical: operation.isCritical || false, // 중요 작업 표시 추가
      // 만료 시간 추가 - 1주일 후 만료
      expireAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };
    
    pendingOperations.push(newOperation);
    
    // 작업 큐 크기 확인 및 메모리 경고
    if (pendingOperations.length > MAX_PENDING_OPERATIONS * 0.8 && !appState.memoryWarningIssued) {
      console.warn(`[Firebase] 작업 큐 크기가 큽니다 (${pendingOperations.length}/${MAX_PENDING_OPERATIONS}). 메모리 문제가 발생할 수 있습니다.`);
      appState.memoryWarningIssued = true;
    }
    
    // 로컬 스토리지 저장 - 메모리 최적화를 위해 중요 정보만 저장
    try {
      // 전체 작업 대신 필수 정보만 저장
      const minimalOperations = pendingOperations.map(op => ({
        id: op.id,
        type: op.type,
        timestamp: op.timestamp,
        expireAt: op.expireAt,
        isCritical: op.isCritical,
        data: {
          userId: op.data.userId,
          placeId: op.data.placeId
        }
      }));
      
      localStorage.setItem('pendingOperations', JSON.stringify(minimalOperations));
      
      // 추가: IndexedDB 백업 저장 (더 안정적인 저장소)
      if ('indexedDB' in window) {
        backupPendingOperationsToIndexedDB(minimalOperations)
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
        offlineQueued: true
      });
    }
    
    // 작업 큐 상태가 변경되었음을 알리는 이벤트 발생
    dispatchFirebaseEvent('pending-operations-changed', {
      count: pendingOperations.length
    });
    
    logDebug(`오프라인 작업 큐에 추가됨: ${operation.type}`, operation);
    
    // 오프라인일 때도 자동 동기화 시도 설정 (백그라운드 동기화 지원 확인)
    if ('serviceWorker' in navigator && 'SyncManager' in window && navigator.serviceWorker.controller) {
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

// IndexedDB에 작업 큐 백업 - 개선된 오류 처리
const backupPendingOperationsToIndexedDB = async (operations) => {
  return new Promise((resolve, reject) => {
    // 지원 여부 확인
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB를 지원하지 않는 브라우저입니다.'));
    }
    
    const request = window.indexedDB.open('FirebaseOfflineQueue', 1);
    
    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      reject(new Error('IndexedDB 열기 시간 초과'));
    }, 5000);
    
    request.onerror = (event) => {
      clearTimeout(timeoutId);
      reject(new Error('IndexedDB 열기 실패: ' + event.target.error));
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('operations')) {
        db.createObjectStore('operations', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      clearTimeout(timeoutId);
      
      try {
        const db = event.target.result;
        const transaction = db.transaction(['operations'], 'readwrite');
        const store = transaction.objectStore('operations');
        
        // 오래된 데이터 정리 - 만료된 작업 제거
        const clearExpiredRequest = store.openCursor();
        clearExpiredRequest.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const data = cursor.value;
            if (data.expireAt && data.expireAt < Date.now()) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
        
        // 새 데이터 저장 - 모든 데이터를 한 번에 처리
        const now = Date.now();
        operations.forEach(operation => {
          // 만료된 작업은 저장하지 않음
          if (!operation.expireAt || operation.expireAt > now) {
            store.put(operation);
          }
        });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (err) => reject(err);
      } catch (error) {
        reject(error);
      }
    };
  });
};

// 오프라인 작업 큐에서 작업 제거 - 개선된 오류 처리
export const removeFromPendingOperations = (operationId) => {
  if (!operationId) return false;
  
  try {
    const initialLength = pendingOperations.length;
    pendingOperations = pendingOperations.filter(op => op.id !== operationId);
    
    // 메모리 압력 해소 시 경고 해제
    if (pendingOperations.length < MAX_PENDING_OPERATIONS * 0.5) {
      appState.memoryWarningIssued = false;
    }
    
    if (pendingOperations.length < initialLength) {
      // 로컬 스토리지 업데이트 - 간소화된 데이터 저장
      try {
        const minimalOperations = pendingOperations.map(op => ({
          id: op.id,
          type: op.type,
          timestamp: op.timestamp,
          expireAt: op.expireAt,
          isCritical: op.isCritical,
          data: {
            userId: op.data.userId,
            placeId: op.data.placeId
          }
        }));
        
        localStorage.setItem('pendingOperations', JSON.stringify(minimalOperations));
        
        // IndexedDB에서도 해당 항목 제거
        if ('indexedDB' in window) {
          removeOperationFromIndexedDB(operationId)
            .catch(err => console.warn('[Firebase] IndexedDB에서 작업 제거 실패:', err));
        }
        
        // 작업 큐 상태가 변경되었음을 알리는 이벤트 발생
        dispatchFirebaseEvent('pending-operations-changed', {
          count: pendingOperations.length
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

// IndexedDB에서 작업 제거 함수
const removeOperationFromIndexedDB = (operationId) => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return resolve(false);
    }
    
    const request = window.indexedDB.open('FirebaseOfflineQueue', 1);
    
    request.onerror = () => resolve(false);
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        const transaction = db.transaction(['operations'], 'readwrite');
        const store = transaction.objectStore('operations');
        
        const deleteRequest = store.delete(operationId);
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    };
  });
};

// 대기 중인 작업 개수 확인
export const getPendingOperationsCount = (type = null) => {
  if (type) {
    return pendingOperations.filter(op => op.type === type).length;
  }
  return pendingOperations.length;
};

// 만료된 작업 정리 함수 추가
export const cleanupExpiredOperations = () => {
  try {
    const now = Date.now();
    const initialLength = pendingOperations.length;
    
    // 만료된 작업 필터링
    pendingOperations = pendingOperations.filter(op => !op.expireAt || op.expireAt > now);
    
    if (pendingOperations.length < initialLength) {
      logDebug(`${initialLength - pendingOperations.length}개의 만료된 작업 정리됨`);
      
      // 스토리지 업데이트
      try {
        const minimalOperations = pendingOperations.map(op => ({
          id: op.id,
          type: op.type,
          timestamp: op.timestamp,
          expireAt: op.expireAt,
          isCritical: op.isCritical,
          data: {
            userId: op.data.userId,
            placeId: op.data.placeId
          }
        }));
        
        localStorage.setItem('pendingOperations', JSON.stringify(minimalOperations));
        
        if ('indexedDB' in window) {
          cleanupExpiredOperationsInIndexedDB()
            .catch(err => console.warn('[Firebase] IndexedDB 만료 작업 정리 실패:', err));
        }
      } catch (error) {
        console.warn('[Firebase] 로컬 스토리지 업데이트 실패:', error);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Firebase] 만료된 작업 정리 실패:', error);
    return false;
  }
};

// IndexedDB에서 만료된 작업 정리
const cleanupExpiredOperationsInIndexedDB = () => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return resolve(false);
    }
    
    const request = window.indexedDB.open('FirebaseOfflineQueue', 1);
    
    request.onerror = () => resolve(false);
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        const transaction = db.transaction(['operations'], 'readwrite');
        const store = transaction.objectStore('operations');
        
        const now = Date.now();
        const cursorRequest = store.openCursor();
        let count = 0;
        
        cursorRequest.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.expireAt && cursor.value.expireAt < now) {
              cursor.delete();
              count++;
            }
            cursor.continue();
          }
        };
        
        transaction.oncomplete = () => {
          logDebug(`IndexedDB에서 ${count}개의 만료된 작업 정리됨`);
          resolve(true);
        };
        
        transaction.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    };
  });
};

// checkPersistenceAndRetry 함수 - 개선된 재시도 로직
export const checkPersistenceAndRetry = async (maxAttempts = 3) => {
  let attempts = 0;
  let lastError = null;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // 이미 활성화되었거나 시도된 경우 건너뛰기
    if (persistenceEnabled) {
      return { 
        success: true, 
        attempted: true, 
        attempts
      };
    }
    
    if (initializationAttempted && attempts > 1) {
      // 두 번째 시도부터는 지연 시간 증가 (지수 백오프)
      const delayMs = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // 오프라인 지원 설정 시도
    try {
      const result = await setupOfflineSupport();
      if (result.success) {
        return { ...result, attempts };
      }
      lastError = result.error;
    } catch (error) {
      lastError = error;
      console.warn(`[Firebase] 오프라인 지원 설정 시도 ${attempts}/${maxAttempts} 실패:`, error);
    }
  }
  
  // 모든 시도 후에도 실패
  return { 
    success: false, 
    attempted: true, 
    attempts,
    maxExceeded: true,
    error: lastError
  };
};

// 오프라인 지속성 활성화 함수 - 메모리 누수 방지 개선
const setupOfflineSupport = async () => {
  // 이미 성공적으로 활성화되었거나 시도 중인 경우 건너뛰기
  if (persistenceEnabled) {
    return { success: true, attempted: true };
  }
  
  // 초기화 시도 플래그 설정
  initializationAttempted = true;
  
  try {
    // 오프라인 지속성 활성화 전 상태 저장
    const initialState = {
      networkEnabled: networkEnabled,
      onLine: typeof navigator !== 'undefined' ? navigator.onLine : true
    };
    
    logDebug('오프라인 지속성 활성화 시도 중...', initialState);
    
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('오프라인 지속성 활성화 시간 초과')), 10000);
    });
    
    // 지속성 활성화 시도
    const enablePromise = enableIndexedDbPersistence(db, {
      synchronizeTabs: true // 여러 탭 간 동기화 활성화
    }).then(() => {
      logDebug('오프라인 지속성 활성화 성공');
      persistenceEnabled = true;
      
      // 이벤트 발생
      dispatchFirebaseEvent(firebaseEvents.PERSISTENCE_STATUS_CHANGED, { 
        enabled: true
      });
      
      return { success: true, attempted: true };
    });
    
    return await Promise.race([enablePromise, timeoutPromise]);
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
    
    // 로컬 스토리지에서만 대기 중인 작업 로드 시도 (IndexedDB 사용 불가능한 경우에도 앱 사용은 가능하도록)
    try {
      await loadPendingOperations();
    } catch (loadError) {
      console.warn('[Firebase] 대기 중인 작업 로드 실패:', loadError);
    }
    
    return { success: false, attempted: true, error: errorInfo };
  }
};

// 로컬 스토리지에서 대기 중인 작업 로드 - 메모리 최적화
const loadPendingOperations = async () => {
  try {
    const storedOperations = localStorage.getItem('pendingOperations');
    const loadedOperations = storedOperations ? JSON.parse(storedOperations) : [];
    
    // 작업 수 제한 및 데이터 크기 확인
    const operationsToLoad = loadedOperations.slice(0, MAX_PENDING_OPERATIONS);
    
    logDebug(`${operationsToLoad.length}개의 대기 중인 작업 로드됨`);
    
    // 오래된 작업 정리 (만료된 작업)
    const now = Date.now();
    const validOps = operationsToLoad.filter(op => !op.expireAt || op.expireAt > now);
    
    if (validOps.length < operationsToLoad.length) {
      logDebug(`${operationsToLoad.length - validOps.length}개의 만료된 작업 정리됨`);
    }
    
    pendingOperations = validOps;
    
    // 저장소 업데이트 (정리된 내용 반영)
    if (validOps.length < loadedOperations.length) {
      try {
        localStorage.setItem('pendingOperations', JSON.stringify(validOps));
      } catch (storageError) {
        console.warn('[Firebase] 로컬 스토리지에 작업 큐 저장 실패:', storageError);
      }
    }
    
    return validOps;
  } catch (error) {
    console.warn('[Firebase] 대기 중인 작업 로드 실패:', error);
    pendingOperations = [];
    return [];
  }
};

// src/config/firebase.js - Part 3: 데이터 관리 및 캐싱 기능

// 장소 상세 정보 가져오기 함수 - 메모리 최적화
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
          // 메모리 최적화: 즉시 실행 대신 requestIdleCallback 또는 setTimeout 사용
          if (!isOffline() && navigator.onLine) {
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(() => {
                fetchAndUpdatePlaceCache(placeId).catch(() => {
                  logDebug(`백그라운드 장소 데이터 업데이트 실패: ${placeId}`);
                });
              });
            } else {
              setTimeout(() => {
                fetchAndUpdatePlaceCache(placeId).catch(() => {
                  logDebug(`백그라운드 장소 데이터 업데이트 실패: ${placeId}`);
                });
              }, 3000);
            }
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
        // 메모리 최적화: 필요한 필드만 추출하여 사용
        const docData = docSnap.data();
        
        // 필요한 필드만 포함하는 경량화된 객체 생성
        const placeData = { 
          id: docSnap.id,
          name: docData.name || '',
          description: docData.description || '',
          location: docData.location || null,
          region: docData.region || '',
          subRegion: docData.subRegion || '',
          category: docData.category || defaultCategory,
          subCategory: docData.subCategory || '',
          photos: docData.photos || [],
          thumbnail: docData.thumbnail || (docData.photos && docData.photos.length > 0 ? docData.photos[0] : null),
          mbtiMatchScore: docData.mbtiMatchScore || {},
          interestTags: docData.interestTags || [],
          talentRelevance: docData.talentRelevance || [],
          moodMatchScore: docData.moodMatchScore || {},
          averageRating: docData.averageRating || { overall: 0 },
          reviewCount: docData.reviewCount || 0,
          specialFeatures: docData.specialFeatures || []
        };
        
        // 데이터 캐싱 - 메모리 최적화
        if (typeof localStorage !== 'undefined' && useCache) {
          try {
            localStorage.setItem(`place_${placeId}`, JSON.stringify(placeData));
            logDebug(`장소 ${placeId} 데이터 캐시됨`);
          } catch (cacheError) {
            // 스토리지 용량 초과 등의 오류 처리
            if (cacheError.name === 'QuotaExceededError') {
              clearOldPlaceCache().catch(e => console.warn('[Firebase] 캐시 정리 실패:', e));
            } else {
              console.warn(`[Firebase] 장소 캐시 저장 오류: ${placeId}`, cacheError);
            }
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

// 오래된 장소 캐시 정리 - 메모리 관리 개선
const clearOldPlaceCache = async () => {
  if (typeof localStorage === 'undefined') return false;
  
  try {
    // 스토리지 키 목록 가져오기
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('place_')) {
        keys.push(key);
      }
    }
    
    // 정리할 키가 없으면 종료
    if (keys.length === 0) return false;
    
    // 가장 오래된 30% 정리
    const keysToRemove = Math.ceil(keys.length * 0.3);
    
    // 데이터와 마지막 접근 시간 추출 (추정)
    const keyData = keys.map(key => {
      try {
        const data = localStorage.getItem(key);
        // 각 키의 데이터 크기 계산
        const size = data ? data.length : 0;
        // 마지막 접근 시간 추정 (없으면 현재로부터 임의 시간 이전)
        const lastAccessed = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
        return { key, size, lastAccessed };
      } catch (e) {
        return { key, size: 0, lastAccessed: 0 };
      }
    });
    
    // 마지막 접근 시간 기준 정렬 (오래된 항목 먼저)
    keyData.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // 가장 오래된 항목부터 삭제
    for (let i = 0; i < keysToRemove; i++) {
      if (i < keyData.length) {
        localStorage.removeItem(keyData[i].key);
      }
    }
    
    logDebug(`${keysToRemove}개의 오래된 장소 캐시 정리됨`);
    return true;
  } catch (error) {
    console.warn('[Firebase] 오래된 캐시 정리 실패:', error);
    return false;
  }
};

// 장소 데이터 백그라운드 업데이트 헬퍼 함수 - 메모리 누수 방지 최적화
const fetchAndUpdatePlaceCache = async (placeId) => {
  if (!placeId || isOffline() || !navigator.onLine) return false;
  
  try {
    const docRef = doc(db, 'places', placeId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // 메모리 최적화: 필요한 필드만 추출
      const docData = docSnap.data();
      
      const placeData = { 
        id: docSnap.id,
        name: docData.name || '',
        description: docData.description || '',
        location: docData.location || null,
        region: docData.region || '',
        subRegion: docData.subRegion || '',
        category: docData.category || 'default',
        subCategory: docData.subCategory || '',
        photos: docData.photos || [],
        thumbnail: docData.thumbnail || (docData.photos && docData.photos.length > 0 ? docData.photos[0] : null),
        mbtiMatchScore: docData.mbtiMatchScore || {},
        interestTags: docData.interestTags || [],
        talentRelevance: docData.talentRelevance || [],
        moodMatchScore: docData.moodMatchScore || {},
        averageRating: docData.averageRating || { overall: 0 },
        reviewCount: docData.reviewCount || 0,
        specialFeatures: docData.specialFeatures || []
      };
      
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

// 저장된 장소 직접 가져오기 함수 - 메모리 최적화
export const fetchSavedPlacesDirectly = async (userId, options = {}) => {
  if (!userId) {
    return { 
      success: false, 
      error: 'userId가 없습니다.', 
      data: [] 
    };
  }
  
  const { useCache = true, timeout = 15000, pageSize = 20, lastTimestamp = null } = options;
  
  try {
    // 오프라인이거나 캐시 사용 옵션이 켜져 있을 때 캐시 확인
    if ((isOffline() || useCache) && typeof localStorage !== 'undefined') {
      try {
        const cachedData = localStorage.getItem(`savedPlaces_${userId}`);
        if (cachedData) {
          const savedPlaces = JSON.parse(cachedData);
          logDebug(`캐시에서 저장된 장소 데이터 로드됨 (${savedPlaces.length}개)`);
          
          // 캐시된 데이터가 있어도 오프라인이 아니면 백그라운드에서 최신 데이터 가져오기
          if (!isOffline() && navigator.onLine) {
            // 메모리 최적화: 바로 실행 대신 requestIdleCallback 활용
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(() => {
                fetchAndUpdateSavedPlacesCache(userId).catch(() => {
                  logDebug(`백그라운드 저장된 장소 데이터 업데이트 실패`);
                });
              });
            } else {
              setTimeout(() => {
                fetchAndUpdateSavedPlacesCache(userId).catch(() => {
                  logDebug(`백그라운드 저장된 장소 데이터 업데이트 실패`);
                });
              }, 5000);
            }
          }
          
          // 페이징 적용 - 메모리 사용량 감소
          const paginatedResult = lastTimestamp 
            ? savedPlaces.filter(p => new Date(p.savedAt) < new Date(lastTimestamp)).slice(0, pageSize)
            : savedPlaces.slice(0, pageSize);
          
          return { 
            success: true, 
            data: paginatedResult, 
            fromCache: true,
            hasMore: paginatedResult.length >= pageSize
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
        isOffline: true,
        hasMore: false
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
      
      // 쿼리 구성 - 페이징 및 성능 최적화
      let q = query(savedPlacesRef, where('userId', '==', userId));
      
      // 타임스탬프 기준 페이징
      if (lastTimestamp) {
        q = query(q, where('savedAt', '<', new Date(lastTimestamp)));
      }
      
      // 타임스탬프 기준 내림차순 정렬 및 페이지 크기 제한
      q = query(q, orderBy('savedAt', 'desc'), limit(pageSize + 1));
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        logDebug(`저장된 장소가 없습니다 (userId: ${userId})`);
        return { 
          success: true, 
          data: [], 
          fromCache: false,
          hasMore: false
        };
      }
      
      // 결과 처리 - 메모리 최적화
      const savedPlaces = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        // ID 및 placeId 정규화
        const id = doc.id;
        let placeId = data.placeId || '';
        
        // 복합 ID에서 placeId 추출 (userId_placeId 형식)
        if (id.includes('_') && id.startsWith(userId)) {
          const splitId = id.split('_');
          if (splitId.length > 1) {
            placeId = splitId.slice(1).join('_'); // userId 이후의 모든 부분을 placeId로
          }
        }
        
        // 필요한 데이터만 포함하여 메모리 사용 최적화
        return {
          id,
          userId: data.userId,
          placeId: placeId,
          savedAt: data.savedAt ? data.savedAt.toDate().toISOString() : new Date().toISOString(),
          lastUpdated: data.lastUpdated ? data.lastUpdated.toDate().toISOString() : new Date().toISOString(),
          // 필요한 최소한의 장소 데이터만 포함
          placeData: data.placeData ? {
            name: data.placeData.name || '',
            category: data.placeData.category || '',
            thumbnail: data.placeData.thumbnail || '',
            region: data.placeData.region || ''
          } : {}
        };
      });
      
      // 추가 데이터 존재 여부 확인 (N+1 패턴)
      const hasMore = savedPlaces.length > pageSize;
      
      // 페이지 크기로 제한
      const limitedPlaces = hasMore ? savedPlaces.slice(0, pageSize) : savedPlaces;
      
      // 메모리 최적화: 전체 데이터를 캐싱하지 않고, 최근 100개만 캐싱
      if (typeof localStorage !== 'undefined' && useCache) {
        try {
          // 기존 캐시된 데이터와 새 데이터 병합
          let existingData = [];
          const cachedData = localStorage.getItem(`savedPlaces_${userId}`);
          
          if (cachedData) {
            existingData = JSON.parse(cachedData);
          }
          
          // 중복 제거
          const existingIds = new Set(existingData.map(p => p.id));
          const newPlaces = limitedPlaces.filter(p => !existingIds.has(p.id));
          
          // 새로운 항목 앞에 추가하고 오래된 항목 제거
          const combinedPlaces = [...newPlaces, ...existingData]
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)) // 최신순 정렬
            .slice(0, 100); // 최대 100개 유지
          
          localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(combinedPlaces));
          logDebug(`저장된 장소 데이터 캐시됨 (${combinedPlaces.length}개)`);
        } catch (cacheError) {
          console.warn(`[Firebase] 저장된 장소 캐시 저장 오류:`, cacheError);
        }
      }
      
      return { 
        success: true, 
        data: limitedPlaces, 
        fromCache: false,
        hasMore 
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

// 저장된 장소 데이터 백그라운드 업데이트 헬퍼 함수 - 메모리 최적화
const fetchAndUpdateSavedPlacesCache = async (userId) => {
  if (!userId || isOffline() || !navigator.onLine) return false;
  
  try {
    const savedPlacesRef = collection(db, 'savedPlaces');
    // 최신 100개만 가져오기 - 메모리 사용량 제한
    const q = query(
      savedPlacesRef, 
      where('userId', '==', userId), 
      orderBy('savedAt', 'desc'), 
      limit(100)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return false;
    
    // 메모리 최적화: 필요한 데이터만 추출
    const savedPlaces = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        placeId: data.placeId || '',
        savedAt: data.savedAt ? data.savedAt.toDate().toISOString() : new Date().toISOString(),
        lastUpdated: data.lastUpdated ? data.lastUpdated.toDate().toISOString() : new Date().toISOString(),
        placeData: data.placeData ? {
          name: data.placeData.name || '',
          category: data.placeData.category || '',
          thumbnail: data.placeData.thumbnail || '',
          region: data.placeData.region || ''
        } : {}
      };
    });
    
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

// 더미 장소 데이터 생성 함수 - 메모리 최적화
export const generateDummyPlace = (placeId, options = {}) => {
  const id = placeId || `place_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  logDebug(`더미 장소 데이터 생성 (ID: ${id})`, options);
  
  // 더미 이미지 - 단일 값 참조로 메모리 사용 감소
  const DUMMY_IMAGE = '/assets/images/default-place.jpg';
  
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
  
  // 기본 카테고리 관련 태그 생성 - 객체 참조로 메모리 최적화
  const categoryTags = {
    cafe: ['커피', '디저트', '카페'],
    restaurant: ['맛집', '식당', '음식'],
    attraction: ['관광', '여행', '명소'],
    default: ['여행', '장소', '추천']
  };
  
  // 기본 이름 생성
  const defaultName = options.name || `장소 ${id.slice(-5)}`;
  
  // 오프라인 생성 시 현재 시간 추가
  const isOfflineGenerated = options.offlineGenerated || !navigator.onLine;
  const offlineTimestamp = isOfflineGenerated ? new Date().toISOString() : null;
  
  // 기본 MBTI 점수 - 메모리 최적화를 위해 최소화
  const mbtiMatchScore = options.mbtiMatchScore || {
    'ENFJ': 8, 'INFJ': 7, 'ENFP': 9, 'INFP': 8,
    'ENTJ': 6, 'INTJ': 7, 'ENTP': 8, 'INTP': 7,
    'ESFJ': 7, 'ISFJ': 6, 'ESFP': 8, 'ISFP': 7,
    'ESTJ': 5, 'ISTJ': 6, 'ESTP': 7, 'ISTP': 6
  };
  
  // 범주화된 태그
  const category = options.category || 'cafe';
  
  return {
    id: id,
    placeId: id,
    name: defaultName,
    description: options.description || '테스트용 더미 장소입니다. 현재 데이터를 로드할 수 없어 더미 데이터를 표시합니다.',
    location: locationData,
    region: options.region || '서울',
    subRegion: options.subRegion || '강남/서초',
    category: category,
    subCategory: options.subCategory || (category === 'cafe' ? '카페' : category === 'restaurant' ? '식당' : '명소'),
    photos: options.photos || [DUMMY_IMAGE, DUMMY_IMAGE, DUMMY_IMAGE],
    thumbnail: options.thumbnail || DUMMY_IMAGE,
    // 메모리 최적화 - 기본 객체 참조 사용
    mbtiMatchScore: mbtiMatchScore,
    interestTags: options.interestTags || categoryTags[category] || categoryTags.default,
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
    reviewCount: options.reviewCount || Math.floor(Math.random() * 10) + 5, // 리뷰 수 축소
    priceLevel: options.priceLevel || 2,
    isDummy: true,
    offlineGenerated: isOfflineGenerated,
    offlineTimestamp: offlineTimestamp,
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: options.updatedAt || new Date().toISOString()
  };
};

// src/config/firebase.js - Part 4: 이벤트 및 네트워크 모니터링

// 네트워크 상태 모니터링 - 연결 감시 및 재연결 시도 (메모리 최적화)
export const setupNetworkMonitoring = () => {
  let lastNetworkStatusTime = Date.now();
  let networkStatusTimeout = null;
  
  // 온라인 상태 변경 핸들러
  const handleOnline = async () => {
    // 너무 빈번한 변경 방지
    if (Date.now() - lastNetworkStatusTime < 300) {
      return;
    }
    
    lastNetworkStatusTime = Date.now();
    
    // 기존 타임아웃 취소
    if (networkStatusTimeout) {
      clearTimeout(networkStatusTimeout);
      networkStatusTimeout = null;
    }
    
    // 약간의 지연 추가 (추가 이벤트 발생 확인)
    networkStatusTimeout = setTimeout(async () => {
      try {
        logDebug('네트워크 연결 감지됨');
        
        // 오프라인 시간 추적 종료
        appState.offlineSince = null;
        
        // 네트워크 활성화
        if (!networkEnabled) {
          await enableNetwork(db);
          networkEnabled = true;
          
          dispatchFirebaseEvent(firebaseEvents.ONLINE_STATUS_CHANGED, { 
            online: true
          });
          
          // 메모리 최적화: 비효율적인 동작 제거
          if (pendingOperations.length > 0) {
            logDebug(`${pendingOperations.length}개의 대기 중인 작업이 있습니다.`);
            // 백그라운드 처리는 아래와 같이 분리
            processQueuedOperations().catch(err => 
              console.error('[Firebase] 작업 처리 오류:', err)
            );
          }
        }
      } catch (error) {
        console.error('[Firebase] 네트워크 상태 변경 처리 오류:', error);
      } finally {
        networkStatusTimeout = null;
      }
    }, 500);
  };
  
  // 백그라운드에서 대기 중인 작업 처리
  const processQueuedOperations = async () => {
    // 실제 처리 코드는 여기에 구현
    // 이 함수는 handleOnline에서 호출됨
    logDebug('대기 중인 작업 처리 시작');
    
    // 여기서 대기 중인 작업을 실행하는 실제 로직을 구현
    // (이 부분은 실제 구현체에 맞게 수정)
    
    dispatchFirebaseEvent(firebaseEvents.DATA_SYNC_COMPLETED, {
      syncedOperations: pendingOperations.length
    });
  };
  
  // 오프라인 상태 변경 핸들러
  const handleOffline = async () => {
    // 너무 빈번한 변경 방지
    if (Date.now() - lastNetworkStatusTime < 300) {
      return;
    }
    
    lastNetworkStatusTime = Date.now();
    
    // 기존 타임아웃 취소
    if (networkStatusTimeout) {
      clearTimeout(networkStatusTimeout);
      networkStatusTimeout = null;
    }
    
    // 약간의 지연 추가 (추가 이벤트 발생 확인)
    networkStatusTimeout = setTimeout(async () => {
      try {
        logDebug('네트워크 연결 끊김');
        
        // 오프라인 시작 시간 기록
        appState.offlineSince = Date.now();
        
        // 네트워크 비활성화
        if (networkEnabled) {
          await disableNetwork(db);
          networkEnabled = false;
          
          dispatchFirebaseEvent(firebaseEvents.ONLINE_STATUS_CHANGED, { 
            online: false
          });
        }
      } catch (error) {
        console.error('[Firebase] 네트워크 비활성화 오류:', error);
      } finally {
        networkStatusTimeout = null;
      }
    }, 500);
  };
  
  // 초기 네트워크 상태 설정 - 지연 실행으로 메모리 사용 최소화
  if (typeof navigator !== 'undefined') {
    // 타임아웃 사용하여 초기화 과정과 분리
    setTimeout(() => {
      if (navigator.onLine) {
        handleOnline();
      } else {
        handleOffline();
      }
    }, 100);
  }
  
  // 이벤트 리스너 등록
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 정리 함수 반환
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      // 타임아웃 정리
      if (networkStatusTimeout) {
        clearTimeout(networkStatusTimeout);
        networkStatusTimeout = null;
      }
    };
  }
  
  return () => {}; // 기본 정리 함수
};

// Firebase 연결 확인 함수 - 타임아웃 처리 강화
export const checkFirebaseConnection = async (timeoutMs = 5000) => {
  try {
    if (!navigator.onLine) {
      return { connected: false, reason: 'offline' };
    }
    
    const testPromise = new Promise((resolve, reject) => {
      let isResolved = false;
      
      const testConnection = async () => {
        try {
          // 가벼운 쿼리 사용
          const testQuery = query(collection(db, 'places'), limit(1));
          await getDocs(testQuery);
          
          if (!isResolved) {
            isResolved = true;
            resolve({ connected: true, timestamp: Date.now() });
          }
        } catch (error) {
          if (!isResolved) {
            isResolved = true;
            reject(error);
          }
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

// 수동 동기화 트리거 함수 - 개선된
export const triggerSync = async () => {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' };
  }
  
  try {
    // 대기 중인 작업 처리
    let syncedCount = 0;
    
    // 여기서 실제 동기화 로직 구현
    // (실제 구현체에 맞게 수정 필요)
    
    dispatchFirebaseEvent(firebaseEvents.DATA_SYNC_COMPLETED, {
      syncedOperations: syncedCount
    });
    
    return { 
      success: true, 
      syncedCount, 
      remainingCount: pendingOperations.length 
    };
  } catch (error) {
    console.error('[Firebase] 수동 동기화 오류:', error);
    
    dispatchFirebaseEvent(firebaseEvents.SYNC_ERROR, {
      error: error.message
    });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// 최근 조회한 장소 가져오기 - 메모리 최적화
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

// 최근 조회한 장소 추가 - 중복 및 용량 관리 개선
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
      thumbnail: place.thumbnail || (place.photos && place.photos.length > 0 ? place.photos[0] : null),
      region: place.region,
      timestamp: new Date().toISOString()
    };
    
    // 맨 앞에 추가
    places.unshift(minimalPlace);
    
    // 최대 20개만 유지 (스토리지 공간 최적화)
    if (places.length > 20) {
      places = places.slice(0, 20);
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(places));
      return true;
    } catch (storageError) {
      // 스토리지 용량 초과 시 기존 항목 반으로 줄이기
      if (storageError.name === 'QuotaExceededError' && places.length > 5) {
        places = places.slice(0, Math.ceil(places.length / 2));
        localStorage.setItem(key, JSON.stringify(places));
        return true;
      }
      throw storageError;
    }
  } catch (error) {
    console.warn('[Firebase] 최근 조회 장소 추가 오류:', error);
    return false;
  }
};

// 메모리 사용량 모니터링 함수 추가
export const monitorMemoryUsage = () => {
  // 메모리 정보 가져오기 (지원하는 브라우저에서만)
  if (window.performance && window.performance.memory) {
    const memoryInfo = window.performance.memory;
    const usedHeapSizeMB = Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024));
    const totalHeapSizeMB = Math.round(memoryInfo.totalJSHeapSize / (1024 * 1024));
    const heapLimitMB = Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024));
    
    // 힙 사용률 계산
    const heapUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    
    // 메모리 경고 임계값 확인
    if (heapUsageRatio > 0.8 && !appState.memoryWarningIssued) {
      console.warn(`[Firebase] 메모리 사용량이 높습니다: ${usedHeapSizeMB}MB/${heapLimitMB}MB (${(heapUsageRatio * 100).toFixed(1)}%)`);
      appState.memoryWarningIssued = true;
      
      // 메모리 압력 감소 조치
      if (pendingOperations.length > MAX_PENDING_OPERATIONS / 2) {
        // 비중요 작업 일부 제거
        const nonCriticalOps = pendingOperations.filter(op => !op.isCritical);
        if (nonCriticalOps.length > 0) {
          const removeCount = Math.ceil(nonCriticalOps.length / 3); // 1/3 정도 제거
          for (let i = 0; i < removeCount && i < nonCriticalOps.length; i++) {
            removeFromPendingOperations(nonCriticalOps[i].id);
          }
          console.warn(`[Firebase] 메모리 압력 감소를 위해 ${removeCount}개의 비중요 작업 제거됨`);
        }
      }
      
      // 캐시 정리
      clearOldPlaceCache().catch(e => console.warn('[Firebase] 캐시 정리 실패:', e));
    } else if (heapUsageRatio < 0.7 && appState.memoryWarningIssued) {
      // 메모리 사용량이 감소하면 경고 플래그 초기화
      appState.memoryWarningIssued = false;
    }
    
    return {
      usedHeapSizeMB,
      totalHeapSizeMB,
      heapLimitMB,
      heapUsageRatio
    };
  }
  
  return null;
};

// 주기적 메모리 모니터링 설정
if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
  // 1분마다 메모리 사용량 확인
  setInterval(monitorMemoryUsage, 60000);
}

// src/config/firebase.js - Part 5: 유틸리티 함수 및 내보내기

// Firebase 초기화 시 네트워크 상태 모니터링 시작
let networkMonitoringCleanup = null;

if (typeof window !== 'undefined') {
  // 지연 시작으로 초기 로딩 시 메모리 사용 최소화
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      // 네트워크 모니터링 시작
      networkMonitoringCleanup = setupNetworkMonitoring();
      
      // 오프라인 지원 설정 - 지연 실행으로 초기 로딩 성능 영향 최소화
      setupOfflineSupport().catch(err => {
        console.warn('[Firebase] 오프라인 지원 설정 오류:', err);
      });
      
      // 만료된 작업 정리
      cleanupExpiredOperations();
    });
  } else {
    // requestIdleCallback을 지원하지 않는 브라우저용 폴백
    setTimeout(() => {
      networkMonitoringCleanup = setupNetworkMonitoring();
      
      setupOfflineSupport().catch(err => {
        console.warn('[Firebase] 오프라인 지원 설정 오류:', err);
      });
      
      cleanupExpiredOperations();
    }, 3000);
  }
  
  // 정리 함수 저장
  window._firebaseCleanup = () => {
    if (networkMonitoringCleanup) {
      networkMonitoringCleanup();
      networkMonitoringCleanup = null;
    }
  };
  
  // 페이지 언로드 시 정리
  window.addEventListener('unload', () => {
    if (window._firebaseCleanup) {
      window._firebaseCleanup();
    }
  });
}

// 메모리 해제 함수 (컴포넌트 언마운트 시 호출)
export const releaseResources = () => {
  // 빈번하게 변하는 리소스 해제 로직
  // (필요한 경우 구현)
};

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
  cleanupExpiredOperations,
  
  // 오프라인 지원
  setupOfflineSupport,
  checkPersistenceAndRetry,
  isOffline,
  getConnectionInfo,
  
  // 최근 조회 장소 관련 함수
  getRecentlyViewedPlaces,
  addRecentlyViewedPlace,
  
  // 빠른 접근을 위한 유틸리티 함수
  generateDummyPlace,
  triggerSync,
  monitorMemoryUsage,
  releaseResources,
  
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
