// src/utils/indexedDBUtils.js

/**
 * IndexedDB 유틸리티 - 로컬 데이터 캐싱 및 오프라인 지원을 위한 함수들
 */

// IndexedDB 기본 설정
const DB_NAME = 'myTripStyleDB';
const DB_VERSION = 1;

// 스토어 이름 정의
export const STORES = {
  PLACES: 'places',
  SAVED_PLACES: 'savedPlaces',
  USER_PROFILES: 'userProfiles',
  VISIT_HISTORY: 'visitHistory',
  PLANNED_VISITS: 'plannedVisits',
  FEEDBACKS: 'feedbacks',
  RECOMMENDATIONS: 'recommendations',
  SYNC_QUEUE: 'syncQueue',
  REVIEWS: 'reviews' // 리뷰 전용 스토어 추가
};

// 오프라인 상태 확인 유틸리티 함수
export const isOffline = () => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

/**
 * IndexedDB 연결 및 스토어 생성
 * @returns {Promise<IDBDatabase>} 데이터베이스 인스턴스
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.error('이 브라우저는 IndexedDB를 지원하지 않습니다.');
      reject(new Error('IndexedDB not supported'));
      return;
    }
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('IndexedDB 연결 중 오류 발생:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    // 데이터베이스가 처음 생성되거나 버전이 업데이트될 때 실행
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 장소 정보 스토어
      if (!db.objectStoreNames.contains(STORES.PLACES)) {
        const placesStore = db.createObjectStore(STORES.PLACES, { keyPath: 'id' });
        placesStore.createIndex('category', 'category', { unique: false });
        placesStore.createIndex('region', 'region', { unique: false });
        placesStore.createIndex('subRegion', 'subRegion', { unique: false });
        placesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 저장된 장소 스토어
      if (!db.objectStoreNames.contains(STORES.SAVED_PLACES)) {
        const savedPlacesStore = db.createObjectStore(STORES.SAVED_PLACES, { keyPath: 'id' });
        savedPlacesStore.createIndex('userId', 'userId', { unique: false });
        savedPlacesStore.createIndex('placeId', 'placeId', { unique: false });
        savedPlacesStore.createIndex('savedAt', 'savedAt', { unique: false });
      }
      
      // 사용자 프로필 스토어
      if (!db.objectStoreNames.contains(STORES.USER_PROFILES)) {
        db.createObjectStore(STORES.USER_PROFILES, { keyPath: 'userId' });
      }
      
      // 방문 기록 스토어
      if (!db.objectStoreNames.contains(STORES.VISIT_HISTORY)) {
        const visitHistoryStore = db.createObjectStore(STORES.VISIT_HISTORY, { keyPath: 'id' });
        visitHistoryStore.createIndex('userId', 'userId', { unique: false });
        visitHistoryStore.createIndex('placeId', 'placeId', { unique: false });
        visitHistoryStore.createIndex('visitedAt', 'visitedAt', { unique: false });
        visitHistoryStore.createIndex('status', 'status', { unique: false });
      }
      
      // 방문 계획 스토어
      if (!db.objectStoreNames.contains(STORES.PLANNED_VISITS)) {
        const plannedVisitsStore = db.createObjectStore(STORES.PLANNED_VISITS, { keyPath: 'id' });
        plannedVisitsStore.createIndex('userId', 'userId', { unique: false });
        plannedVisitsStore.createIndex('placeId', 'placeId', { unique: false });
        plannedVisitsStore.createIndex('visitDate', 'visitDate', { unique: false });
      }
      
      // 피드백 스토어
      if (!db.objectStoreNames.contains(STORES.FEEDBACKS)) {
        const feedbacksStore = db.createObjectStore(STORES.FEEDBACKS, { keyPath: 'id' });
        feedbacksStore.createIndex('userId', 'userId', { unique: false });
        feedbacksStore.createIndex('placeId', 'placeId', { unique: false });
        feedbacksStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 추천 캐시 스토어
      if (!db.objectStoreNames.contains(STORES.RECOMMENDATIONS)) {
        const recommendationsStore = db.createObjectStore(STORES.RECOMMENDATIONS, { keyPath: 'cacheKey' });
        recommendationsStore.createIndex('userId', 'userId', { unique: false });
        recommendationsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 동기화 대기열 스토어
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncQueueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncQueueStore.createIndex('userId', 'userId', { unique: false });
        syncQueueStore.createIndex('operationType', 'operationType', { unique: false });
        syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncQueueStore.createIndex('status', 'status', { unique: false });
      }
      
      // 리뷰 전용 스토어 추가
      if (!db.objectStoreNames.contains(STORES.REVIEWS)) {
        const reviewsStore = db.createObjectStore(STORES.REVIEWS, { keyPath: 'id' });
        reviewsStore.createIndex('userId', 'userId', { unique: false });
        reviewsStore.createIndex('placeId', 'placeId', { unique: false });
        reviewsStore.createIndex('createdAt', 'createdAt', { unique: false });
        reviewsStore.createIndex('status', 'status', { unique: false });
        reviewsStore.createIndex('rating', 'rating', { unique: false });
      }
    };
  });
};

/**
 * 데이터베이스에 아이템 추가 또는 업데이트
 * @param {string} storeName - 스토어 이름
 * @param {Object} item - 저장할 아이템
 * @returns {Promise<string|number>} 저장된 아이템의 ID
 */
export const saveItem = async (storeName, item) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // 아이템에 타임스탬프 추가 (없는 경우)
      if (!item.timestamp) {
        item.timestamp = new Date().toISOString();
      }
      
      // 오프라인 상태일 때 동기화 상태 추가
      if (isOffline() && !item.offlineSaved) {
        item.offlineSaved = true;
        item.pendingSync = true;
      }
      
      const request = store.put(item);
      
      request.onsuccess = (event) => {
        const id = event.target.result;
        resolve(id || item.id);
      };
      
      request.onerror = (event) => {
        console.error(`${storeName} 스토어에 아이템 저장 중 오류:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어에 아이템 저장 중 오류:`, error);
    
    // 오프라인 상태에서 로컬 스토리지 폴백 사용
    if (isOffline()) {
      try {
        const localKey = `idb_fallback_${storeName}_${item.id || Date.now()}`;
        const itemWithMeta = {
          ...item,
          _storeName: storeName,
          _timestamp: new Date().toISOString(),
          _offlineSaved: true,
          _pendingSync: true
        };
        localStorage.setItem(localKey, JSON.stringify(itemWithMeta));
        return item.id || localKey.split('_').pop();
      } catch (localError) {
        console.warn('로컬 스토리지 폴백 저장 오류:', localError);
      }
    }
    
    throw error;
  }
};

/**
 * 데이터베이스에서 아이템 삭제
 * @param {string} storeName - 스토어 이름
 * @param {string|number} id - 삭제할 아이템의 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export const deleteItem = async (storeName, id) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error(`${storeName} 스토어에서 아이템 삭제 중 오류:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어에서 아이템 삭제 중 오류:`, error);
    
    // 오프라인 상태에서 삭제 작업 기록
    if (isOffline()) {
      try {
        // 삭제 작업 등록
        await addToSyncQueue(
          'unknown', // 사용자 ID는 나중에 확인
          'delete',
          storeName,
          { id },
          id
        );
        
        // localStorage에서 관련 폴백 데이터 삭제
        Object.keys(localStorage).forEach(key => {
          if (key === `idb_fallback_${storeName}_${id}` || key.endsWith(`_${id}`)) {
            localStorage.removeItem(key);
          }
        });
        
        return true;
      } catch (syncError) {
        console.warn('오프라인 삭제 작업 등록 오류:', syncError);
      }
    }
    
    throw error;
  }
};

/**
 * ID로 항목 가져오기
 * @param {string} storeName - 스토어 이름
 * @param {string|number} id - 아이템 ID
 * @returns {Promise<Object|null>} 찾은 아이템 또는 null
 */
export const getItemById = async (storeName, id) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.get(id);
      
      request.onsuccess = (event) => {
        const item = event.target.result;
        // 오프라인 표시 추가
        if (item && isOffline()) {
          item._offlineMode = true;
        }
        resolve(item || null);
      };
      
      request.onerror = (event) => {
        console.error(`${storeName} 스토어에서 아이템 조회 중 오류:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어에서 아이템 조회 중 오류:`, error);
    
    // 오프라인 상태에서 로컬 스토리지 폴백 확인
    if (isOffline()) {
      try {
        const localKey = `idb_fallback_${storeName}_${id}`;
        const localData = localStorage.getItem(localKey);
        
        if (localData) {
          const item = JSON.parse(localData);
          return {
            ...item,
            _fromLocalStorage: true,
            _offlineMode: true
          };
        }
        
        // 다른 키 패턴으로도 검색
        const alternativeKey = Object.keys(localStorage).find(key => 
          key.startsWith(`idb_fallback_${storeName}_`) && 
          key.endsWith(`_${id}`)
        );
        
        if (alternativeKey) {
          const alternativeData = localStorage.getItem(alternativeKey);
          if (alternativeData) {
            const item = JSON.parse(alternativeData);
            return {
              ...item,
              _fromLocalStorage: true,
              _offlineMode: true
            };
          }
        }
      } catch (localError) {
        console.warn('로컬 스토리지 폴백 조회 오류:', localError);
      }
    }
    
    throw error;
  }
};

/**
 * 인덱스를 사용하여 항목 검색
 * @param {string} storeName - 스토어 이름
 * @param {string} indexName - 인덱스 이름
 * @param {any} value - 검색할 값
 * @returns {Promise<Array>} 검색 결과 배열
 */
export const getItemsByIndex = async (storeName, indexName, value) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      // 인덱스가 없는 경우 처리
      if (!store.indexNames.contains(indexName)) {
        console.warn(`인덱스 없음: ${indexName}. 전체 아이템을 가져와 필터링합니다.`);
        
        const allRequest = store.getAll();
        
        allRequest.onsuccess = (event) => {
          const allItems = event.target.result || [];
          // 필드 값으로 필터링
          const filtered = value !== undefined
            ? allItems.filter(item => item[indexName] === value)
            : allItems;
            
          // 오프라인 표시 추가
          if (isOffline()) {
            filtered.forEach(item => item._offlineMode = true);
          }
          
          resolve(filtered);
        };
        
        allRequest.onerror = (event) => {
          console.error(`${storeName} 스토어의 모든 아이템 조회 중 오류:`, event.target.error);
          reject(event.target.error);
        };
        
        return;
      }
      
      const index = store.index(indexName);
      let request;
      
      if (value !== undefined) {
        request = index.getAll(value);
      } else {
        request = index.getAll();
      }
      
      request.onsuccess = (event) => {
        const items = event.target.result || [];
        // 오프라인 표시 추가
        if (isOffline()) {
          items.forEach(item => item._offlineMode = true);
        }
        resolve(items);
      };
      
      request.onerror = (event) => {
        console.error(`${storeName} 스토어의 ${indexName} 인덱스로 검색 중 오류:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어의 ${indexName} 인덱스로 검색 중 오류:`, error);
    
    // 오프라인 상태에서 로컬 스토리지 폴백 검색
    if (isOffline()) {
      try {
        const results = [];
        
        // localStorage에서 해당 스토어 관련 항목 검색
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`idb_fallback_${storeName}_`)) {
            try {
              const item = JSON.parse(localStorage.getItem(key));
              
              // 인덱스 기준 필터링
              if (value === undefined || item[indexName] === value) {
                results.push({
                  ...item,
                  _fromLocalStorage: true,
                  _offlineMode: true
                });
              }
            } catch (parseError) {
              // 파싱 오류 무시
            }
          }
        });
        
        return results;
      } catch (localError) {
        console.warn('로컬 스토리지 폴백 검색 오류:', localError);
        return [];
      }
    }
    
    throw error;
  }
};

/**
 * 모든 아이템 가져오기
 * @param {string} storeName - 스토어 이름
 * @returns {Promise<Array>} 아이템 배열
 */
export const getAllItems = async (storeName) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const items = event.target.result || [];
        // 오프라인 표시 추가
        if (isOffline()) {
          items.forEach(item => item._offlineMode = true);
        }
        resolve(items);
      };
      
      request.onerror = (event) => {
        console.error(`${storeName} 스토어의 모든 아이템 조회 중 오류:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어의 모든 아이템 조회 중 오류:`, error);
    
    // 오프라인 상태에서 로컬 스토리지 폴백 검색
    if (isOffline()) {
      try {
        const results = [];
        const prefix = `idb_fallback_${storeName}_`;
        
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(prefix)) {
            try {
              const item = JSON.parse(localStorage.getItem(key));
              results.push({
                ...item,
                _fromLocalStorage: true,
                _offlineMode: true
              });
            } catch (parseError) {
              // 파싱 오류 무시
            }
          }
        });
        
        return results;
      } catch (localError) {
        console.warn('로컬 스토리지 폴백 검색 오류:', localError);
        return [];
      }
    }
    
    throw error;
  }
};

/**
 * 스토어에 여러 항목 일괄 저장
 * @param {string} storeName - 스토어 이름
 * @param {Array} items - 저장할 항목 배열
 * @returns {Promise<boolean>} 성공 여부
 */
export const saveBulkItems = async (storeName, items) => {
  if (!items || items.length === 0) {
    return true;
  }
  
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // 현재 타임스탬프
      const now = new Date().toISOString();
      // 오프라인 상태 여부
      const offline = isOffline();
      
      let successCount = 0;
      let errorCount = 0;
      
      items.forEach(item => {
        // 타임스탬프 추가 (없는 경우)
        if (!item.timestamp) {
          item.timestamp = now;
        }
        
        // 오프라인 상태일 때 동기화 상태 추가
        if (offline && !item.offlineSaved) {
          item.offlineSaved = true;
          item.pendingSync = true;
        }
        
        const request = store.put(item);
        
        request.onsuccess = () => {
          successCount++;
        };
        
        request.onerror = (event) => {
          console.error(`${storeName} 스토어에 항목 일괄 저장 중 오류:`, event.target.error);
          errorCount++;
          
          // 오프라인 상태에서 로컬 스토리지 폴백 저장 시도
          if (offline) {
            try {
              const localKey = `idb_fallback_${storeName}_${item.id || Date.now()}_${successCount + errorCount}`;
              const itemWithMeta = {
                ...item,
                _storeName: storeName,
                _timestamp: now,
                _offlineSaved: true,
                _pendingSync: true
              };
              localStorage.setItem(localKey, JSON.stringify(itemWithMeta));
            } catch (localError) {
              console.warn('로컬 스토리지 폴백 저장 오류:', localError);
            }
          }
        };
      });
      
      transaction.oncomplete = () => {
        db.close();
        
        // 일부 실패한 경우에도 일부 성공으로 처리
        const partialSuccess = successCount > 0;
        console.log(`${storeName} 일괄 저장 결과: ${successCount}개 성공, ${errorCount}개 실패`);
        
        resolve(errorCount === 0 || partialSuccess);
      };
      
      transaction.onerror = (event) => {
        console.error(`${storeName} 스토어 트랜잭션 오류:`, event.target.error);
        
        // 오프라인 상태에서 모든 항목을 로컬 스토리지에 저장 시도
        if (offline) {
          try {
            items.forEach((item, index) => {
              const localKey = `idb_fallback_${storeName}_${item.id || Date.now()}_${index}`;
              const itemWithMeta = {
                ...item,
                _storeName: storeName,
                _timestamp: now,
                _offlineSaved: true,
                _pendingSync: true
              };
              localStorage.setItem(localKey, JSON.stringify(itemWithMeta));
            });
          } catch (localError) {
            console.warn('로컬 스토리지 폴백 저장 오류:', localError);
          }
        }
        
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어에 항목 일괄 저장 중 오류:`, error);
    
    // 오프라인 상태에서 로컬 스토리지 폴백 사용
    if (isOffline()) {
      try {
        const now = new Date().toISOString();
        
        items.forEach((item, index) => {
          const localKey = `idb_fallback_${storeName}_${item.id || Date.now()}_${index}`;
          const itemWithMeta = {
            ...item,
            _storeName: storeName,
            _timestamp: now,
            _offlineSaved: true,
            _pendingSync: true
          };
          localStorage.setItem(localKey, JSON.stringify(itemWithMeta));
        });
        
        return true;
      } catch (localError) {
        console.warn('로컬 스토리지 폴백 저장 오류:', localError);
      }
    }
    
    throw error;
  }
};

/**
 * 스토어의 모든 아이템 삭제 (초기화)
 * @param {string} storeName - 스토어 이름
 * @returns {Promise<boolean>} 성공 여부
 */
export const clearStore = async (storeName) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error(`${storeName} 스토어 초기화 중 오류:`, event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error(`${storeName} 스토어 초기화 중 오류:`, error);
    
    // 오프라인 상태에서는 로컬 스토리지의 관련 항목만 제거
    if (isOffline()) {
      try {
        const prefix = `idb_fallback_${storeName}_`;
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        });
        return true;
      } catch (localError) {
        console.warn('로컬 스토리지 초기화 오류:', localError);
      }
    }
    
    throw error;
  }
};

/**
 * 오프라인 작업을 동기화 대기열에 추가
 * @param {string} userId - 사용자 ID
 * @param {string} operationType - 작업 유형 (add, update, delete)
 * @param {string} storeName - 대상 스토어 이름
 * @param {Object} data - 작업 데이터
 * @param {string} entityId - 엔티티 ID (placeId 등)
 * @returns {Promise<number>} 대기열 항목 ID
 */
export const addToSyncQueue = async (userId, operationType, storeName, data, entityId) => {
  try {
    // 현재 타임스탬프
    const timestamp = new Date().toISOString();
    
    // 작업 항목 구성
    const queueItem = {
      userId,
      operationType,
      storeName,
      data,
      entityId,
      status: 'pending',
      retryCount: 0,
      timestamp,
      lastUpdated: timestamp
    };
    
    // 대기열에 추가
    const itemId = await saveItem(STORES.SYNC_QUEUE, queueItem);
    
    // 로컬 스토리지에도 백업
    try {
      const backupKey = `sync_queue_${operationType}_${storeName}_${entityId || Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify({
        ...queueItem,
        _backupId: backupKey
      }));
    } catch (localError) {
      console.warn('동기화 큐 로컬 백업 오류:', localError);
    }
    
    console.log(`[indexedDBUtils] 동기화 대기열에 작업 추가: ${operationType} ${storeName} ${entityId}`);
    return itemId;
  } catch (error) {
    console.error('[indexedDBUtils] 동기화 대기열 항목 추가 중 오류:', error);
    
    // 오류 발생 시 로컬 스토리지에만 저장 시도
    try {
      const backupKey = `sync_queue_${operationType}_${storeName}_${entityId || Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify({
        userId,
        operationType,
        storeName,
        data,
        entityId,
        status: 'pending',
        retryCount: 0,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        _backupId: backupKey,
        _localOnly: true
      }));
      return backupKey;
    } catch (localError) {
      console.error('로컬 스토리지 백업 실패:', localError);
    }
    
    throw error;
  }
};

/**
 * 오프라인 동기화 대기열 처리
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 처리 결과
 */
export const processSyncQueue = async (userId) => {
  // 사용자 ID 또는 네트워크 연결 확인
  if (!userId || isOffline()) {
    return { success: false, message: '동기화를 수행할 수 없습니다. 네트워크 연결을 확인하세요.', processed: 0 };
  }
  
  try {
    // 처리 중인 상태로 표시
    window._syncInProgress = true;
    
    // 대기 중인 항목 가져오기
    const pendingItems = await getItemsByIndex(
      STORES.SYNC_QUEUE, 
      'status', 
      'pending'
    );
    
    // 현재 사용자의 항목만 필터링
    const userItems = pendingItems.filter(item => item.userId === userId);
    
    if (userItems.length === 0) {
      // 로컬 스토리지에서 백업 항목 확인
      const backupItems = getLocalSyncQueueItems(userId);
      
      if (backupItems.length === 0) {
        window._syncInProgress = false;
        return { success: true, message: '처리할 항목이 없습니다.', processed: 0 };
      }
      
      // 백업 항목을 IndexedDB로 복원 시도
      for (const item of backupItems) {
        try {
          await saveItem(STORES.SYNC_QUEUE, {
            ...item,
            _restored: true,
            lastUpdated: new Date().toISOString()
          });
        } catch (restoreError) {
          console.warn('백업 항목 복원 실패:', restoreError);
        }
      }
      
      // 다시 대기 항목 가져오기
      const restoredItems = await getItemsByIndex(
        STORES.SYNC_QUEUE, 
        'status', 
        'pending'
      );
      
      if (restoredItems.length === 0) {
        window._syncInProgress = false;
        return { success: true, message: '처리할 항목이 없습니다.', processed: 0 };
      }
    }
    
    console.log(`[indexedDBUtils] ${userItems.length}개의 대기 중인 동기화 항목 처리 시작`);
    
    // 처리 결과 추적
    let processed = 0;
    let failed = 0;
    
    // 작업 유형별 처리
    for (const item of userItems) {
      try {
        // 항목 상태 업데이트
        await updateSyncQueueItemStatus(item.id, 'processing');
        
        // 작업 유형에 따른 처리
        let result;
        
        switch (item.operationType) {
          case 'add':
            result = await handleAddOperation(item);
            break;
          case 'update':
            result = await handleUpdateOperation(item);
            break;
          case 'delete':
            result = await handleDeleteOperation(item);
            break;
          default:
            throw new Error(`지원되지 않는 작업 유형: ${item.operationType}`);
        }
        
        // 성공 여부에 따라 항목 상태 업데이트
        if (result.success) {
          await updateSyncQueueItemStatus(item.id, 'completed', {
            completedAt: new Date().toISOString(),
            result: result
          });
          
          // 로컬 스토리지 백업 항목 제거
          try {
            removeLocalSyncQueueItem(item);
          } catch (removeError) {
            console.warn('로컬 백업 항목 제거 실패:', removeError);
          }
          
          processed++;
        } else {
          throw new Error(result.error || '알 수 없는 오류');
        }
      } catch (error) {
        console.error(`[indexedDBUtils] 항목 처리 중 오류 (ID: ${item.id}):`, error);
        
        // 오류 발생 시 재시도 횟수 증가
        const newRetryCount = (item.retryCount || 0) + 1;
        const maxRetryCount = 3; // 최대 재시도 횟수
        
        if (newRetryCount < maxRetryCount) {
          // 재시도 예정
          await updateSyncQueueItemStatus(item.id, 'pending', {
            retryCount: newRetryCount,
            lastError: error.message,
            lastUpdated: new Date().toISOString()
          });
        } else {
          // 최대 재시도 횟수 초과
          await updateSyncQueueItemStatus(item.id, 'failed', {
            retryCount: newRetryCount,
            lastError: error.message,
            failedAt: new Date().toISOString()
          });
        }
        
        failed++;
      }
    }
    
    // 동기화 완료 이벤트 발생
    try {
      const syncCompletedEvent = new CustomEvent('syncCompleted', {
        detail: { processed, failed, timestamp: new Date().toISOString() }
      });
      window.dispatchEvent(syncCompletedEvent);
    } catch (eventError) {
      console.warn('동기화 완료 이벤트 발생 실패:', eventError);
    }
    
    window._syncInProgress = false;
    
    return {
      success: true,
      message: `${processed}개 항목 처리 완료, ${failed}개 항목 실패`,
      processed,
      failed
    };
  } catch (error) {
    console.error('[indexedDBUtils] 동기화 대기열 처리 중 오류:', error);
    window._syncInProgress = false;
    return { success: false, message: error.message, processed: 0 };
  }
};

/**
 * 로컬 스토리지에서 동기화 큐 항목 가져오기
 * @param {string} userId - 사용자 ID
 * @returns {Array} 대기열 항목 배열
 */
const getLocalSyncQueueItems = (userId) => {
  try {
    const items = [];
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sync_queue_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          
          // 현재 사용자의 항목만 필터링
          if (item.userId === userId) {
            items.push(item);
          }
        } catch (parseError) {
          // 파싱 오류 무시
        }
      }
    });
    
    return items;
  } catch (error) {
    console.warn('로컬 동기화 큐 항목 가져오기 오류:', error);
    return [];
  }
};

/**
 * 로컬 스토리지에서 동기화 큐 항목 제거
 * @param {Object} item - 대기열 항목
 */
const removeLocalSyncQueueItem = (item) => {
  try {
    // 백업 ID가 있는 경우
    if (item._backupId) {
      localStorage.removeItem(item._backupId);
      return;
    }
    
    // 백업 ID가 없는 경우 관련 키 패턴으로 검색
    const key = `sync_queue_${item.operationType}_${item.storeName}_${item.entityId}`;
    localStorage.removeItem(key);
    
    // 다른 패턴도 검사
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sync_queue_') && 
          k.includes(item.operationType) && 
          k.includes(item.storeName) && 
          (item.entityId && k.includes(item.entityId))) {
        localStorage.removeItem(k);
      }
    });
  } catch (error) {
    console.warn('로컬 동기화 큐 항목 제거 오류:', error);
  }
};

/**
 * 동기화 대기열 항목 상태 업데이트
 * @param {number} itemId - 대기열 항목 ID
 * @param {string} status - 새 상태 ('pending', 'processing', 'completed', 'failed')
 * @param {Object} metadata - 추가 메타데이터
 * @returns {Promise<boolean>} 성공 여부
 */
export const updateSyncQueueItemStatus = async (itemId, status, metadata = {}) => {
  try {
    // 항목 가져오기
    const item = await getItemById(STORES.SYNC_QUEUE, itemId);
    
    if (!item) {
      throw new Error(`대기열 항목을 찾을 수 없음: ${itemId}`);
    }
    
    // 항목 업데이트
    const updatedItem = {
      ...item,
      status,
      lastUpdated: new Date().toISOString(),
      ...metadata
    };
    
    // 저장
    await saveItem(STORES.SYNC_QUEUE, updatedItem);
    return true;
  } catch (error) {
    console.error(`[indexedDBUtils] 대기열 항목 상태 업데이트 중 오류 (ID: ${itemId}):`, error);
    return false;
  }
};

// 특정 작업 유형에 따른 처리 함수들
async function handleAddOperation(item) {
  // 실제 구현은 Firebase API 호출을 통해 데이터 추가
  // 예시 코드만 제공 (실제 구현은 firebase.js와 연동 필요)
  try {
    const { storeName, entityId } = item;
    console.log(`[indexedDBUtils] ADD 작업 처리: ${storeName} ${entityId}`);
    
    // 네트워크 상태 확인
    if (isOffline()) {
      return { 
        success: false, 
        error: '오프라인 상태에서는 서버 동기화를 할 수 없습니다.',
        offlineOnly: true
      };
    }
    
    switch (storeName) {
      case STORES.SAVED_PLACES:
        // firebase.js에서 해당 함수 호출 (실제 구현에서는 import 필요)
        // await savePlace(item.userId, entityId);
        console.log(`[indexedDBUtils] 저장된 장소 추가 작업 처리: ${entityId}`);
        break;
        
      case STORES.PLANNED_VISITS:
        // 방문 계획 추가
        // await addPlannedVisit(item.userId, entityId, item.data.visitDate, item.data.note);
        console.log(`[indexedDBUtils] 방문 계획 추가 작업 처리: ${entityId}`);
        break;
        
      case STORES.REVIEWS:
        // 리뷰 추가
        // await addReview(item.userId, entityId, item.data);
        console.log(`[indexedDBUtils] 리뷰 추가 작업 처리: ${entityId}`);
        break;
        
      // 다른 스토어에 대한 처리 추가
      case STORES.FEEDBACKS:
        // 피드백 추가
        // await addFeedback(item.userId, entityId, item.data);
        console.log(`[indexedDBUtils] 피드백 추가 작업 처리: ${entityId}`);
        break;
        
      default:
        console.log(`[indexedDBUtils] 지원되지 않는 스토어: ${storeName}`);
        return { 
          success: false, 
          error: `지원되지 않는 스토어: ${storeName}` 
        };
    }
    
    return { success: true };
  } catch (error) {
    // 서버 연결 오류 분석
    if (error.code === 'NETWORK_ERROR' || 
        error.name === 'NetworkError' || 
        error.message?.includes('network') ||
        !navigator.onLine) {
      return { 
        success: false, 
        error: '네트워크 연결 오류. 나중에 다시 시도합니다.', 
        retryLater: true 
      };
    }
    
    return { success: false, error: error.message };
  }
}

async function handleUpdateOperation(item) {
  try {
    const { storeName, entityId } = item;
    console.log(`[indexedDBUtils] UPDATE 작업 처리: ${storeName} ${entityId}`);
    
    // 네트워크 상태 확인
    if (isOffline()) {
      return { 
        success: false, 
        error: '오프라인 상태에서는 서버 동기화를 할 수 없습니다.',
        offlineOnly: true
      };
    }
    
    switch (storeName) {
      case STORES.PLANNED_VISITS:
        // 방문 계획 업데이트
        // await updatePlannedVisit(item.userId, entityId, item.data.visitDate, item.data.note);
        console.log(`[indexedDBUtils] 방문 계획 업데이트 작업 처리: ${entityId}`);
        break;
        
      case STORES.VISIT_HISTORY:
        // 방문 기록 리뷰 추가
        // await addReview(item.userId, entityId, item.data.rating, item.data.review);
        console.log(`[indexedDBUtils] 방문 리뷰 추가 작업 처리: ${entityId}`);
        break;
        
      case STORES.REVIEWS:
        // 리뷰 업데이트
        // await updateReview(entityId, item.data);
        console.log(`[indexedDBUtils] 리뷰 업데이트 작업 처리: ${entityId}`);
        break;
        
      case STORES.FEEDBACKS:
        // 피드백 업데이트
        // await updateFeedback(entityId, item.data);
        console.log(`[indexedDBUtils] 피드백 업데이트 작업 처리: ${entityId}`);
        break;
        
      // 다른 스토어에 대한 처리 추가
        
      default:
        console.log(`[indexedDBUtils] 지원되지 않는 스토어: ${storeName}`);
        return { 
          success: false, 
          error: `지원되지 않는 스토어: ${storeName}` 
        };
    }
    
    return { success: true };
  } catch (error) {
    // 서버 연결 오류 분석
    if (error.code === 'NETWORK_ERROR' || 
        error.name === 'NetworkError' || 
        error.message?.includes('network') ||
        !navigator.onLine) {
      return { 
        success: false, 
        error: '네트워크 연결 오류. 나중에 다시 시도합니다.', 
        retryLater: true 
      };
    }
    
    return { success: false, error: error.message };
  }
}

async function handleDeleteOperation(item) {
  try {
    const { storeName, entityId } = item;
    console.log(`[indexedDBUtils] DELETE 작업 처리: ${storeName} ${entityId}`);
    
    // 네트워크 상태 확인
    if (isOffline()) {
      return { 
        success: false, 
        error: '오프라인 상태에서는 서버 동기화를 할 수 없습니다.',
        offlineOnly: true
      };
    }
    
    switch (storeName) {
      case STORES.SAVED_PLACES:
        // 저장된 장소 삭제
        // await unsavePlace(item.userId, entityId);
        console.log(`[indexedDBUtils] 저장된 장소 삭제 작업 처리: ${entityId}`);
        break;
        
      case STORES.PLANNED_VISITS:
        // 방문 계획 삭제
        // await deletePlannedVisit(item.userId, entityId);
        console.log(`[indexedDBUtils] 방문 계획 삭제 작업 처리: ${entityId}`);
        break;
        
      case STORES.REVIEWS:
        // 리뷰 삭제
        // await deleteReview(entityId);
        console.log(`[indexedDBUtils] 리뷰 삭제 작업 처리: ${entityId}`);
        break;
        
      case STORES.FEEDBACKS:
        // 피드백 삭제
        // await deleteFeedback(entityId);
        console.log(`[indexedDBUtils] 피드백 삭제 작업 처리: ${entityId}`);
        break;
        
      // 다른 스토어에 대한 처리 추가
        
      default:
        console.log(`[indexedDBUtils] 지원되지 않는 스토어: ${storeName}`);
        return { 
          success: false, 
          error: `지원되지 않는 스토어: ${storeName}` 
        };
    }
    
    return { success: true };
  } catch (error) {
    // 서버 연결 오류 분석
    if (error.code === 'NETWORK_ERROR' || 
        error.name === 'NetworkError' || 
        error.message?.includes('network') ||
        !navigator.onLine) {
      return { 
        success: false, 
        error: '네트워크 연결 오류. 나중에 다시 시도합니다.', 
        retryLater: true 
      };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * 사용자별 데이터 초기화
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export const clearUserData = async (userId) => {
  try {
    // 사용자별 저장 스토어 목록
    const userStores = [
      STORES.SAVED_PLACES,
      STORES.VISIT_HISTORY,
      STORES.PLANNED_VISITS,
      STORES.FEEDBACKS,
      STORES.RECOMMENDATIONS,
      STORES.SYNC_QUEUE,
      STORES.REVIEWS
    ];
    
    for (const storeName of userStores) {
      const items = await getItemsByIndex(storeName, 'userId', userId);
      
      const db = await openDatabase();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      for (const item of items) {
        store.delete(item.id);
      }
      
      await new Promise((resolve) => {
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      });
    }
    
    // 사용자 프로필 삭제
    await deleteItem(STORES.USER_PROFILES, userId);
    
    // 로컬 스토리지에서 관련 항목도 삭제
    try {
      Object.keys(localStorage).forEach(key => {
        if ((key.includes(userId) || key.includes('sync_queue_')) && 
            !key.startsWith('app_preferences_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (localError) {
      console.warn('로컬 스토리지 사용자 데이터 삭제 오류:', localError);
    }
    
    return true;
  } catch (error) {
    console.error(`사용자 ${userId}의 데이터 초기화 중 오류:`, error);
    throw error;
  }
};

/**
 * 네트워크 상태 변경 시 동기화 시도
 * @param {string} userId - 사용자 ID
 */
export const setupNetworkSync = (userId) => {
  if (!userId) return; // 사용자 ID가 없으면 동기화 불필요
  
  let syncInProgress = false;
  let lastSyncAttempt = 0;
  const MIN_SYNC_INTERVAL = 60000; // 최소 동기화 간격 (1분)
  
  // 온라인 상태 변경 감지
  const handleOnline = async () => {
    // 이미 동기화 중이거나 마지막 동기화 후 충분한 시간이 지나지 않았으면 무시
    const now = Date.now();
    if (syncInProgress || (now - lastSyncAttempt < MIN_SYNC_INTERVAL)) {
      return;
    }
    
    try {
      console.log('[indexedDBUtils] 네트워크 연결 감지, 동기화 시작');
      syncInProgress = true;
      lastSyncAttempt = now;
      
      // 2초 대기 (네트워크 연결 안정화)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 동기화 실행 - 지연 실행으로 UI 응답성 유지
      setTimeout(async () => {
        const result = await processSyncQueue(userId);
        console.log('[indexedDBUtils] 동기화 결과:', result);
        syncInProgress = false;
      }, 500);
    } catch (error) {
      console.error('[indexedDBUtils] 네트워크 동기화 중 오류:', error);
      syncInProgress = false;
    }
  };
  
  // 이벤트 리스너 등록
  window.addEventListener('online', handleOnline);
  
  // 시작 시 온라인 상태면 동기화 시도
  if (navigator.onLine) {
    setTimeout(handleOnline, 3000);
  }
  
  // 정리 함수 반환
  return () => {
    window.removeEventListener('online', handleOnline);
  };
};

/**
 * 오프라인 작업 추적 및 처리를 위한 동기화 관리자
 */
export class SyncManager {
  constructor(userId) {
    this.userId = userId;
    this.pendingChanges = 0;
    this.isProcessing = false;
    this.syncCleanupFunction = null;
    this.listeners = [];
  }
  
  /**
   * 동기화 관리자 초기화
   */
  initialize() {
    if (!this.userId) {
      console.warn('[SyncManager] 사용자 ID가 제공되지 않음. 동기화 관리자 초기화 건너뜀.');
      return false;
    }
    
    try {
      // 대기 중인 항목 개수 로드
      this.loadPendingCount();
      
      // 네트워크 동기화 설정
      this.syncCleanupFunction = setupNetworkSync(this.userId);
      
      // 로컬 데이터 변경 이벤트 리스너 설정
      this.setupChangeListeners();
      
      // 동기화 이벤트 리스너 등록
      this.registerSyncEventListener();
      
      console.log('[SyncManager] 동기화 관리자 초기화 완료');
      return true;
    } catch (error) {
      console.error('[SyncManager] 초기화 중 오류:', error);
      return false;
    }
  }
  
  /**
   * 대기 중인 변경사항 개수 로드
   */
  async loadPendingCount() {
    try {
      const pendingItems = await getItemsByIndex(
        STORES.SYNC_QUEUE, 
        'status', 
        'pending'
      );
      
      // 현재 사용자의 항목만 필터링
      const userItems = pendingItems.filter(item => item.userId === this.userId);
      this.pendingChanges = userItems.length;
      
      // 로컬 스토리지 항목도 확인
      const localItems = getLocalSyncQueueItems(this.userId);
      this.pendingChanges += localItems.length;
      
      return this.pendingChanges;
    } catch (error) {
      console.error('[SyncManager] 대기 중인 항목 로드 중 오류:', error);
      return 0;
    }
  }
  
  /**
   * 로컬 데이터 변경 이벤트 리스너 설정
   */
  setupChangeListeners() {
    // IndexedDB 변경 사항을 감지하는 이벤트는 없으므로
    // 데이터 변경 함수를 래핑하여 변경 사항 추적
    
    // 예시: localStorage 이벤트로 변경 사항 전파
    window.addEventListener('storage', (event) => {
      if (event.key === 'syncQueueUpdated') {
        this.loadPendingCount();
      }
    });
    
    console.log('[SyncManager] 데이터 변경 리스너 설정 완료');
  }
  
  /**
   * 동기화 이벤트 리스너 등록
   */
  registerSyncEventListener() {
    const handleSyncCompleted = (event) => {
      console.log('[SyncManager] 동기화 완료 이벤트 수신:', event.detail);
      
      // 남은 항목 개수 업데이트
      this.loadPendingCount().then(count => {
        console.log(`[SyncManager] 남은 항목 개수: ${count}`);
        
        // 리스너에게 알림
        this.notifyListeners('syncCompleted', {
          pendingChanges: count,
          processed: event.detail.processed,
          failed: event.detail.failed
        });
      });
    };
    
    window.addEventListener('syncCompleted', handleSyncCompleted);
    
    // 정리 함수 업데이트
    const originalCleanup = this.syncCleanupFunction;
    this.syncCleanupFunction = () => {
      if (originalCleanup) originalCleanup();
      window.removeEventListener('syncCompleted', handleSyncCompleted);
    };
  }
  
  /**
   * 이벤트 리스너 등록
   * @param {function} listener - 이벤트 콜백 함수
   */
  addListener(listener) {
    if (typeof listener === 'function' && !this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
    return this;
  }
  
  /**
   * 이벤트 리스너 제거
   * @param {function} listener - 제거할 리스너
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
    return this;
  }
  
  /**
   * 리스너에게 이벤트 알림
   * @param {string} event - 이벤트 이름
   * @param {Object} data - 이벤트 데이터
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[SyncManager] 리스너 호출 오류:', error);
      }
    });
  }
  
  /**
   * 동기화 처리 실행
   */
  async processSync() {
    if (this.isProcessing || isOffline() || !this.userId) {
      return {
        success: false,
        message: this.isProcessing ? '이미 동기화 처리 중입니다.' : 
                isOffline() ? '오프라인 상태입니다.' : 
                '사용자 ID가 없습니다.',
        processed: 0
      };
    }
    
    try {
      this.isProcessing = true;
      this.notifyListeners('syncStarted', { pendingChanges: this.pendingChanges });
      
      // 동기화 실행
      const result = await processSyncQueue(this.userId);
      
      // 남은 대기 항목 개수 업데이트
      await this.loadPendingCount();
      
      // 로컬 스토리지 이벤트 트리거 (다른 탭에도 알림)
      localStorage.setItem('syncQueueUpdated', Date.now().toString());
      
      this.isProcessing = false;
      
      this.notifyListeners('syncCompleted', {
        pendingChanges: this.pendingChanges,
        processed: result.processed,
        failed: result.failed
      });
      
      return result;
    } catch (error) {
      console.error('[SyncManager] 동기화 처리 중 오류:', error);
      this.isProcessing = false;
      this.notifyListeners('syncError', { error: error.message });
      return {
        success: false,
        message: error.message,
        processed: 0
      };
    }
  }
  
  /**
   * 오프라인 작업 추가
   */
  async addOfflineOperation(operationType, storeName, data, entityId) {
    if (!this.userId) {
      throw new Error('사용자 ID가 없습니다.');
    }
    
    try {
      // 대기열에 작업 추가
      await addToSyncQueue(this.userId, operationType, storeName, data, entityId);
      
      // 대기 중인 항목 개수 증가
      this.pendingChanges++;
      
      // 로컬 스토리지 이벤트 트리거 (다른 탭에도 알림)
      localStorage.setItem('syncQueueUpdated', Date.now().toString());
      
      // 리스너에게 알림
      this.notifyListeners('operationAdded', {
        pendingChanges: this.pendingChanges,
        operationType,
        storeName,
        entityId
      });
      
      // 온라인 상태이면 즉시 동기화 시도
      if (navigator.onLine && !this.isProcessing) {
        // 약간의 지연 후 처리 (여러 연속 작업을 일괄 처리하기 위함)
        setTimeout(() => this.processSync(), 500);
      }
      
      return true;
    } catch (error) {
      console.error('[SyncManager] 오프라인 작업 추가 중 오류:', error);
      this.notifyListeners('operationError', { error: error.message });
      throw error;
    }
  }
  
  /**
   * 정리 작업 수행
   */
  cleanup() {
    if (this.syncCleanupFunction) {
      this.syncCleanupFunction();
      this.syncCleanupFunction = null;
    }
    
    this.listeners = [];
    console.log('[SyncManager] 동기화 관리자 정리 완료');
  }
  
  /**
   * 완료된 항목 정리
   */
  async cleanupCompletedItems(daysToKeep = 7) {
    try {
      // X일 이전에 완료된 항목 가져오기
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();
      
      // 완료 또는 실패한 항목 중 지정 기간보다 오래된 항목 가져오기
      const allItems = await getAllItems(STORES.SYNC_QUEUE);
      const oldItems = allItems.filter(item => 
        (item.status === 'completed' || item.status === 'failed') && 
        (item.completedAt && item.completedAt < cutoffTimestamp)
      );
      
      console.log(`[SyncManager] ${oldItems.length}개의 오래된 항목 정리 시작`);
      
      // 항목 삭제
      for (const item of oldItems) {
        await deleteItem(STORES.SYNC_QUEUE, item.id);
      }
      
      // 로컬 스토리지 정리
      const localCleanupCount = this.cleanupLocalStorageItems(daysToKeep);
      
      return {
        success: true,
        message: `${oldItems.length}개의 오래된 항목이 정리되었습니다. 로컬 스토리지에서 ${localCleanupCount}개 정리됨.`,
        count: oldItems.length,
        localCount: localCleanupCount
      };
    } catch (error) {
      console.error('[SyncManager] 완료된 항목 정리 중 오류:', error);
      return {
        success: false,
        message: error.message,
        count: 0
      };
    }
  }
  
  /**
   * 로컬 스토리지 항목 정리
   * @param {number} daysToKeep - 유지할 일수
   * @returns {number} 정리된 항목 수
   */
  cleanupLocalStorageItems(daysToKeep = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.getTime();
      
      let cleanupCount = 0;
      const syncQueuePrefix = 'sync_queue_';
      const idbFallbackPrefix = 'idb_fallback_';
      
      // 로컬 스토리지 항목 정리
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(syncQueuePrefix) || key.startsWith(idbFallbackPrefix)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            
            // 타임스탬프 확인
            let itemTime = null;
            
            if (item.timestamp) {
              itemTime = new Date(item.timestamp).getTime();
            } else if (item._timestamp) {
              itemTime = new Date(item._timestamp).getTime();
            } else if (item.completedAt) {
              itemTime = new Date(item.completedAt).getTime();
            } else if (item.lastUpdated) {
              itemTime = new Date(item.lastUpdated).getTime();
            }
            
            // 오래된 항목 삭제
            if (itemTime && itemTime < cutoffTimestamp) {
              localStorage.removeItem(key);
              cleanupCount++;
            }
          } catch (parseError) {
            // 파싱 불가한 항목은 항상 삭제
            localStorage.removeItem(key);
            cleanupCount++;
          }
        }
      });
      
      return cleanupCount;
    } catch (error) {
      console.warn('[SyncManager] 로컬 스토리지 정리 오류:', error);
      return 0;
    }
  }
  
  /**
   * 현재 대기 중인 변경사항 개수 반환
   */
  getPendingChangesCount() {
    return this.pendingChanges;
  }
  
  /**
   * 동기화 상태 확인
   */
  getSyncStatus() {
    return {
      pendingChanges: this.pendingChanges,
      isProcessing: this.isProcessing,
      isOnline: navigator.onLine,
      userId: this.userId
    };
  }
}

/**
 * 서비스 워커와 통신하여 캐시된 요청 관리
 */
export const setupServiceWorkerSync = () => {
  if ('serviceWorker' in navigator) {
    // 서비스 워커 메시지 리스너
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_REQUIRED') {
        console.log('[indexedDBUtils] 서비스 워커에서 동기화 요청 수신:', event.data);
        
        // 필요한 처리 로직 - 특정 사용자 ID가 제공되면 해당 사용자 동기화
        if (event.data.userId) {
          processSyncQueue(event.data.userId).then(result => {
            console.log('[indexedDBUtils] 서비스 워커 요청에 의한 동기화 결과:', result);
            
            // 처리 결과를 서비스 워커에 알림
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'SYNC_COMPLETED',
                result,
                timestamp: new Date().toISOString()
              });
            }
          });
        }
      }
    });
    
    // 서비스 워커 상태 확인
    navigator.serviceWorker.ready.then(registration => {
      console.log('[indexedDBUtils] 서비스 워커 준비됨, 백그라운드 동기화 설정');
      
      // 백그라운드 동기화 지원 여부 확인 및 등록
      if ('sync' in registration) {
        // 싱글 동기화 이벤트 등록
        registration.sync.register('data-sync').then(() => {
          console.log('[indexedDBUtils] 백그라운드 동기화 등록 성공');
        }).catch(error => {
          console.warn('[indexedDBUtils] 백그라운드 동기화 등록 실패:', error);
        });
      }
      
      // 주기적인 동기화 등록 (실험적 기능)
      if ('periodicSync' in registration) {
        try {
          // 매일 한 번 동기화 시도
          registration.periodicSync.register('data-sync', {
            minInterval: 24 * 60 * 60 * 1000 // 1일
          }).then(() => {
            console.log('[indexedDBUtils] 주기적 동기화 등록 성공');
          }).catch(error => {
            console.warn('[indexedDBUtils] 주기적 동기화 등록 실패:', error);
          });
        } catch (error) {
          console.warn('[indexedDBUtils] 주기적 동기화 등록 시도 중 오류:', error);
        }
      }
    }).catch(error => {
      console.warn('[indexedDBUtils] 서비스 워커 등록 실패:', error);
    });
    
    return true;
  }
  
  return false;
};

/**
 * 오프라인 상태에서 리뷰 저장
 * @param {Object} reviewData - 리뷰 데이터
 * @returns {Promise<Object>} 결과 객체
 */
export const saveReviewOffline = async (reviewData) => {
  try {
    if (!reviewData.userId || !reviewData.placeId) {
      return { 
        success: false, 
        error: '사용자 ID와 장소 ID가 필요합니다.' 
      };
    }
    
    const now = new Date().toISOString();
    
    // 리뷰 ID 생성 또는 사용
    const reviewId = reviewData.id || `offline_review_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // 리뷰 데이터 준비
    const reviewToSave = {
      ...reviewData,
      id: reviewId,
      timestamp: now,
      createdAt: reviewData.createdAt || now,
      updatedAt: now,
      status: 'pending',
      offlineSaved: true,
      pendingSync: true
    };
    
    // IndexedDB에 저장
    await saveItem(STORES.REVIEWS, reviewToSave);
    
    // 동기화 큐에 추가
    const operation = reviewData.id ? 'update' : 'add';
    await addToSyncQueue(
      reviewData.userId,
      operation,
      STORES.REVIEWS,
      reviewToSave,
      reviewId
    );
    
    // 로컬 스토리지에도 백업
    const backupKey = `offline_review_${reviewId}`;
    localStorage.setItem(backupKey, JSON.stringify(reviewToSave));
    
    return {
      success: true,
      data: reviewToSave,
      message: '리뷰가 오프라인 모드로 저장되었습니다. 네트워크 연결 시 자동으로 서버에 동기화됩니다.',
      id: reviewId,
      offline: true
    };
  } catch (error) {
    console.error('오프라인 리뷰 저장 오류:', error);
    
    // 로컬 스토리지에만 저장 시도
    try {
      const now = new Date().toISOString();
      const reviewId = reviewData.id || `offline_review_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const reviewToSave = {
        ...reviewData,
        id: reviewId,
        timestamp: now,
        createdAt: reviewData.createdAt || now,
        updatedAt: now,
        status: 'pending',
        offlineSaved: true,
        _localOnly: true
      };
      
      const backupKey = `offline_review_${reviewId}`;
      localStorage.setItem(backupKey, JSON.stringify(reviewToSave));
      
      return {
        success: true,
        data: reviewToSave,
        message: '리뷰가 로컬 스토리지에만 저장되었습니다. 네트워크 연결 시 동기화를 시도하세요.',
        id: reviewId,
        offline: true,
        localOnly: true
      };
    } catch (localError) {
      console.error('로컬 스토리지 저장 실패:', localError);
      return {
        success: false,
        error: '오프라인 리뷰 저장에 실패했습니다: ' + error.message
      };
    }
  }
};

/**
 * 사용자의 오프라인 저장된 리뷰 가져오기
 * @param {string} placeId - 장소 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 리뷰 데이터 또는 null
 */
export const getOfflineReview = async (placeId, userId) => {
  try {
    if (!placeId || !userId) return null;
    
    // IndexedDB에서 사용자-장소 조합으로 리뷰 검색
    const reviews = await getItemsByIndex(STORES.REVIEWS, 'userId', userId);
    const matchingReviews = reviews.filter(review => review.placeId === placeId);
    
    if (matchingReviews.length > 0) {
      // 가장 최근 리뷰 반환
      const latestReview = matchingReviews.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || a.timestamp);
        const bTime = new Date(b.updatedAt || b.createdAt || b.timestamp);
        return bTime - aTime;
      })[0];
      
      return {
        success: true,
        data: latestReview,
        offline: true
      };
    }
    
    // IndexedDB에서 찾지 못한 경우 로컬 스토리지 검색
    const backupReview = findLocalStorageReview(placeId, userId);
    if (backupReview) {
      return {
        success: true,
        data: backupReview,
        offline: true,
        fromLocalStorage: true
      };
    }
    
    return {
      success: true,
      data: null
    };
  } catch (error) {
    console.error('오프라인 리뷰 조회 오류:', error);
    
    // IndexedDB 접근 실패 시 로컬 스토리지만 검색
    try {
      const backupReview = findLocalStorageReview(placeId, userId);
      if (backupReview) {
        return {
          success: true,
          data: backupReview,
          offline: true,
          fromLocalStorage: true
        };
      }
    } catch (localError) {
      console.warn('로컬 스토리지 검색 실패:', localError);
    }
    
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * 로컬 스토리지에서 리뷰 찾기
 * @param {string} placeId - 장소 ID
 * @param {string} userId - 사용자 ID
 * @returns {Object|null} 찾은 리뷰 또는 null
 */
const findLocalStorageReview = (placeId, userId) => {
  const matchingReviews = [];
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('offline_review_')) {
      try {
        const review = JSON.parse(localStorage.getItem(key));
        
        if (review.placeId === placeId && review.userId === userId) {
          matchingReviews.push({
            ...review,
            _fromLocalStorage: true
          });
        }
      } catch (parseError) {
        // 파싱 오류 무시
      }
    }
  });
  
  if (matchingReviews.length === 0) return null;
  
  // 가장 최근 리뷰 반환
  return matchingReviews.sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || a.timestamp);
    const bTime = new Date(b.updatedAt || b.createdAt || b.timestamp);
    return bTime - aTime;
  })[0];
};

/**
 * 로컬 스토리지 폴백에서 IndexedDB로 데이터 복원
 * @returns {Promise<Object>} 처리 결과
 */
export const restoreFromLocalStorage = async () => {
  try {
    let restoredCount = 0;
    const errors = [];
    
    // 동기화 큐 항목 복원
    Object.keys(localStorage).forEach(async key => {
      if (key.startsWith('sync_queue_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          await saveItem(STORES.SYNC_QUEUE, {
            ...item,
            _restored: true,
            lastUpdated: new Date().toISOString()
          });
          restoredCount++;
        } catch (error) {
          errors.push({
            key,
            error: error.message,
            type: 'sync_queue'
          });
        }
      }
    });
    
    // 폴백 데이터 복원
    Object.keys(localStorage).forEach(async key => {
      if (key.startsWith('idb_fallback_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          const storeName = item._storeName;
          
          if (storeName && STORES[storeName.toUpperCase()]) {
            delete item._storeName;
            await saveItem(storeName, {
              ...item,
              _restored: true,
              lastUpdated: new Date().toISOString()
            });
            restoredCount++;
          }
        } catch (error) {
          errors.push({
            key,
            error: error.message,
            type: 'fallback'
          });
        }
      }
    });
    
    // 오프라인 리뷰 복원
    Object.keys(localStorage).forEach(async key => {
      if (key.startsWith('offline_review_')) {
        try {
          const review = JSON.parse(localStorage.getItem(key));
          await saveItem(STORES.REVIEWS, {
            ...review,
            _restored: true,
            lastUpdated: new Date().toISOString()
          });
          restoredCount++;
        } catch (error) {
          errors.push({
            key,
            error: error.message,
            type: 'review'
          });
        }
      }
    });
    
    return {
      success: true,
      restoredCount,
      errors: errors.length > 0 ? errors : null,
      message: `${restoredCount}개 항목 복원 완료${errors.length > 0 ? `, ${errors.length}개 오류 발생` : ''}`
    };
  } catch (error) {
    console.error('로컬 스토리지 복원 오류:', error);
    return {
      success: false,
      error: error.message,
      message: '로컬 스토리지에서 데이터 복원 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 오프라인 지원 상태 확인
 * @returns {Object} 오프라인 지원 상태 정보
 */
export const getOfflineSupportStatus = () => {
  try {
    const indexedDBSupported = !!window.indexedDB;
    const localStorageSupported = !!window.localStorage;
    const serviceWorkerSupported = 'serviceWorker' in navigator;
    
    // 동기화 API 지원 여부
    let syncSupported = false;
    let periodicSyncSupported = false;
    
    if (serviceWorkerSupported && navigator.serviceWorker.controller) {
      if ('sync' in window.SyncManager.prototype) {
        syncSupported = true;
      }
      
      if ('periodicSync' in window.SyncManager.prototype) {
        periodicSyncSupported = true;
      }
    }
    
    // 오프라인 저장소 현황
    const syncQueueItems = Object.keys(localStorage).filter(key => 
      key.startsWith('sync_queue_')).length;
      
    const offlineReviews = Object.keys(localStorage).filter(key => 
      key.startsWith('offline_review_')).length;
      
    const fallbackItems = Object.keys(localStorage).filter(key => 
      key.startsWith('idb_fallback_')).length;
    
    return {
      success: true,
      isOnline: navigator.onLine,
      features: {
        indexedDB: indexedDBSupported,
        localStorage: localStorageSupported,
        serviceWorker: serviceWorkerSupported,
        backgroundSync: syncSupported,
        periodicSync: periodicSyncSupported
      },
      storage: {
        syncQueueItems,
        offlineReviews,
        fallbackItems,
        total: syncQueueItems + offlineReviews + fallbackItems
      }
    };
  } catch (error) {
    console.error('오프라인 지원 상태 확인 오류:', error);
    return {
      success: false,
      error: error.message,
      isOnline: navigator.onLine
    };
  }
};

/**
 * 스토어 존재 여부 확인
 * @param {string} storeName - 확인할 스토어 이름
 * @returns {Promise<boolean>} 존재 여부
 */
export const storeExists = async (storeName) => {
  try {
    const db = await openDatabase();
    const exists = db.objectStoreNames.contains(storeName);
    db.close();
    return exists;
  } catch (error) {
    console.error(`${storeName} 스토어 존재 여부 확인 중 오류:`, error);
    return false;
  }
};

/**
 * 초기 스토어 생성 및 확인
 * @returns {Promise<Object>} 결과 객체
 */
export const initializeStores = async () => {
  try {
    const db = await openDatabase();
    db.close();
    
    // 모든 스토어 존재 여부 확인
    const storeChecks = await Promise.all(
      Object.values(STORES).map(async (storeName) => {
        const exists = await storeExists(storeName);
        return { storeName, exists };
      })
    );
    
    const missingStores = storeChecks.filter(check => !check.exists);
    
    return {
      success: true,
      initialized: missingStores.length === 0,
      storeStatus: storeChecks.reduce((acc, check) => {
        acc[check.storeName] = check.exists;
        return acc;
      }, {}),
      missingStores: missingStores.map(s => s.storeName)
    };
  } catch (error) {
    console.error('스토어 초기화 중 오류:', error);
    return {
      success: false,
      error: error.message,
      initialized: false
    };
  }
};

/**
 * 대기 중인 동기화 항목 가져오기
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} 대기 중인 항목 배열
 */
export const getPendingSyncItems = async (userId) => {
  try {
    if (!userId) return [];
    
    // 대기 중인 항목 가져오기
    const pendingItems = await getItemsByIndex(
      STORES.SYNC_QUEUE, 
      'status', 
      'pending'
    );
    
    // 현재 사용자의 항목만 필터링
    const userItems = pendingItems.filter(item => item.userId === userId);
    
    // 로컬 스토리지 항목도 확인
    const localItems = getLocalSyncQueueItems(userId);
    
    // 중복 제거를 위해 ID 기준으로 병합
    const allItems = [...userItems];
    
    localItems.forEach(localItem => {
      // IndexedDB에 없는 항목만 추가
      if (!userItems.some(item => 
        item.entityId === localItem.entityId && 
        item.storeName === localItem.storeName && 
        item.operationType === localItem.operationType)) {
        allItems.push({
          ...localItem,
          _fromLocalStorage: true
        });
      }
    });
    
    return allItems;
  } catch (error) {
    console.error('대기 중인 동기화 항목 조회 중 오류:', error);
    return [];
  }
};

// 추가 유틸리티 및 내보내기
export {
  // 상수
  DB_NAME,
  DB_VERSION,
  
  // 핵심 함수
  openDatabase,
  
  // 유틸리티 함수
  // (이미 모든 함수가 export 되어 있음)
};
