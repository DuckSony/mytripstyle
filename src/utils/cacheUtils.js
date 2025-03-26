// src/utils/cacheUtils.js

/**
 * 캐시 유틸리티 - 오프라인 모드 및 로컬 데이터 캐싱을 위한 유틸리티 함수
 * PWA 지원 및 오프라인 경험 최적화를 위해 확장되었습니다.
 */

/**
 * 오프라인 상태 확인 (개선됨)
 * NetworkInformation API를 사용하여 더 정확한 상태 확인
 * 
 * @returns {boolean} 오프라인 상태 여부
 */
export const isOffline = () => {
  // 네트워크 정보 API 사용 (지원하는 브라우저만)
  if (navigator.connection) {
    // 매우 느린 연결(slow-2g)도 실질적으로 오프라인으로 간주
    if (navigator.connection.effectiveType === 'slow-2g' && 
        navigator.connection.downlink < 0.05) {
      return true;
    }
    
    // 데이터 절약 모드도 확인
    if (navigator.connection.saveData) {
      // 데이터 절약 모드에서는 제한된 온라인 모드로 간주
      // 하지만 완전한 오프라인은 아님
    }
  }
  
  // 기본 온라인 상태 확인
  return !navigator.onLine;
};

/**
 * 네트워크 연결 품질 확인
 * 
 * @returns {Object} 연결 품질 정보
 */
export const getConnectionQuality = () => {
  // 기본값 설정
  const defaultQuality = {
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: null,
    rtt: null,
    saveData: false,
    quality: 'normal'
  };
  
  // 네트워크 정보 API 지원 확인
  if (!navigator.connection) {
    return {
      ...defaultQuality,
      online: navigator.onLine
    };
  }
  
  // 연결 품질 판단
  let quality = 'normal';
  
  if (navigator.connection.effectiveType === 'slow-2g' || 
      navigator.connection.effectiveType === '2g') {
    quality = 'poor';
  } else if (navigator.connection.effectiveType === '3g') {
    quality = 'fair';
  } else if (navigator.connection.effectiveType === '4g') {
    quality = 'good';
  }
  
  // 데이터 절약 모드면 품질 다운그레이드
  if (navigator.connection.saveData) {
    if (quality === 'good') quality = 'fair';
    else if (quality === 'fair') quality = 'poor';
  }
  
  return {
    type: navigator.connection.type || defaultQuality.type,
    effectiveType: navigator.connection.effectiveType || defaultQuality.effectiveType,
    downlink: navigator.connection.downlink || defaultQuality.downlink,
    rtt: navigator.connection.rtt || defaultQuality.rtt,
    saveData: navigator.connection.saveData || defaultQuality.saveData,
    quality,
    online: navigator.onLine
  };
};

/**
 * 로컬 스토리지에서 캐시된 데이터 가져오기 (개선됨)
 * IndexedDB를 우선적으로 시도하고, 실패하면 localStorage로 폴백
 * 
 * @param {string} key - 캐시 키
 * @returns {Promise<any>} - 캐시된 데이터 또는 null
 */
export const getCachedData = async (key) => {
  try {
    // 먼저 IndexedDB 시도
    const indexedDBData = await getFromIndexedDB(key);
    if (indexedDBData !== null) {
      return indexedDBData;
    }
    
    // IndexedDB 실패 시 localStorage 시도
    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;
    
    const parsedData = JSON.parse(cachedData);
    const expiryTime = localStorage.getItem(`${key}_expiry`);
    
    // 만료 시간 확인 (오프라인일 경우 만료 무시)
    if (expiryTime && !isOffline()) {
      const isExpired = Date.now() > parseInt(expiryTime, 10);
      if (isExpired) {
        // 만료된 데이터 삭제
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_expiry`);
        return null;
      }
    }
    
    return parsedData;
  } catch (error) {
    console.warn('캐시 데이터 접근 오류:', error);
    return null;
  }
};

/**
 * 데이터를 로컬 스토리지와 IndexedDB에 캐싱 (개선됨)
 * 
 * @param {string} key - 캐시 키
 * @param {any} data - 캐싱할 데이터
 * @param {number} expiryTime - 캐시 만료 시간 (밀리초)
 * @param {Object} options - 추가 옵션
 * @param {boolean} options.prioritize - 우선 처리 대상 여부
 * @param {boolean} options.skipIndexedDB - IndexedDB 저장 건너뛰기
 * @returns {Promise<boolean>} - 성공 여부
 */
export const setCachedData = async (key, data, expiryTime = 3600000, options = {}) => {
  const { prioritize = false, skipIndexedDB = false } = options;
  
  try {
    // 기본 LocalStorage 저장
    localStorage.setItem(key, JSON.stringify(data));
    const expiry = Date.now() + expiryTime;
    localStorage.setItem(`${key}_expiry`, expiry.toString());
    
    // 우선 처리 대상이면 만료 시간 연장
    if (prioritize) {
      localStorage.setItem(`${key}_priority`, 'true');
    }
    
    // IndexedDB 저장
    if (!skipIndexedDB && 'indexedDB' in window) {
      try {
        await saveToIndexedDB(key, data, expiry, prioritize);
      } catch (indexedDBError) {
        console.warn('IndexedDB 저장 오류 (무시됨):', indexedDBError);
      }
    }
    
    // 서비스 워커에 캐시 업데이트 알림
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_UPDATED',
        payload: { 
          key, 
          timestamp: Date.now(), 
          expiry,
          size: JSON.stringify(data).length
        }
      });
    }
    
    return true;
  } catch (error) {
    console.warn('캐시 저장 오류:', error);
    
    // localStorage 실패 시 IndexedDB만 시도
    if (!skipIndexedDB && 'indexedDB' in window) {
      try {
        const expiry = Date.now() + expiryTime;
        await saveToIndexedDB(key, data, expiry, prioritize);
        return true;
      } catch (indexedDBError) {
        console.warn('IndexedDB 폴백 저장 오류:', indexedDBError);
      }
    }
    
    return false;
  }
};

/**
 * 캐시 데이터 삭제 (개선됨)
 * 
 * @param {string} key - 캐시 키
 * @returns {Promise<boolean>} - 성공 여부
 */
export const clearCachedData = async (key) => {
  try {
    // LocalStorage에서 삭제
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_expiry`);
    localStorage.removeItem(`${key}_priority`);
    
    // IndexedDB에서도 삭제
    if ('indexedDB' in window) {
      try {
        await removeFromIndexedDB(key);
      } catch (indexedDBError) {
        console.warn('IndexedDB 삭제 오류 (무시됨):', indexedDBError);
      }
    }
    
    // 서비스 워커에 캐시 삭제 알림
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_REMOVED',
        payload: { 
          key, 
          timestamp: Date.now()
        }
      });
    }
    
    return true;
  } catch (error) {
    console.warn('캐시 삭제 오류:', error);
    return false;
  }
};

/**
 * IndexedDB에 데이터 저장 (추가됨)
 * 
 * @param {string} key - 캐시 키
 * @param {any} data - 저장할 데이터
 * @param {number} expiry - 만료 시간 (타임스탬프)
 * @param {boolean} isPriority - 우선 처리 대상 여부
 * @returns {Promise<boolean>} - 성공 여부
 */
const saveToIndexedDB = (key, data, expiry, isPriority = false) => {
  return new Promise((resolve, reject) => {
    // IndexedDB 열기
    const request = indexedDB.open('MyTripStyleCache', 1);
    
    // 객체 스토어 생성 (최초 1회)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 캐시 데이터용 객체 스토어 생성
      if (!db.objectStoreNames.contains('cacheData')) {
        const store = db.createObjectStore('cacheData', { keyPath: 'key' });
        store.createIndex('expiry', 'expiry', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
      }
    };
    
    request.onerror = () => {
      reject(new Error('IndexedDB 열기 실패'));
    };
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        const transaction = db.transaction(['cacheData'], 'readwrite');
        const store = transaction.objectStore('cacheData');
        
        // 데이터 저장
        const storeRequest = store.put({
          key,
          data,
          expiry,
          priority: isPriority ? 1 : 0,
          timestamp: Date.now()
        });
        
        storeRequest.onsuccess = () => resolve(true);
        storeRequest.onerror = () => reject(new Error('IndexedDB 저장 실패'));
        
        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        reject(error);
      }
    };
  });
};

/**
 * IndexedDB에서 데이터 가져오기 (추가됨)
 * 
 * @param {string} key - 캐시 키
 * @returns {Promise<any>} - 저장된 데이터 또는 null
 */
const getFromIndexedDB = (key) => {
  return new Promise((resolve) => {
    // IndexedDB 지원 확인
    if (!('indexedDB' in window)) {
      return resolve(null);
    }
    
    // IndexedDB 열기
    const request = indexedDB.open('MyTripStyleCache', 1);
    
    request.onerror = () => {
      // 오류 시 null 반환 (LocalStorage로 폴백)
      resolve(null);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 객체 스토어 생성 (최초 1회)
      if (!db.objectStoreNames.contains('cacheData')) {
        const store = db.createObjectStore('cacheData', { keyPath: 'key' });
        store.createIndex('expiry', 'expiry', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        
        // 객체 스토어가 없는 경우 null 반환
        if (!db.objectStoreNames.contains('cacheData')) {
          db.close();
          return resolve(null);
        }
        
        const transaction = db.transaction(['cacheData'], 'readonly');
        const store = transaction.objectStore('cacheData');
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          
          // 결과가 없으면 null 반환
          if (!result) {
            db.close();
            return resolve(null);
          }
          
          // 만료 여부 확인 (오프라인 상태에서는 만료된 데이터도 사용)
          if (!isOffline() && result.expiry < Date.now()) {
            // 만료된 데이터 삭제 (비동기적으로)
            const deleteTransaction = db.transaction(['cacheData'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('cacheData');
            deleteStore.delete(key);
            
            db.close();
            return resolve(null);
          }
          
          db.close();
          resolve(result.data);
        };
        
        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (error) {
        console.warn('IndexedDB 읽기 오류:', error);
        resolve(null);
      }
    };
  });
};

/**
 * IndexedDB에서 데이터 삭제 (추가됨)
 * 
 * @param {string} key - 캐시 키
 * @returns {Promise<boolean>} - 성공 여부
 */
const removeFromIndexedDB = (key) => {
  return new Promise((resolve, reject) => {
    // IndexedDB 지원 확인
    if (!('indexedDB' in window)) {
      return resolve(false);
    }
    
    // IndexedDB 열기
    const request = indexedDB.open('MyTripStyleCache', 1);
    
    request.onerror = () => {
      reject(new Error('IndexedDB 열기 실패'));
    };
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        
        // 객체 스토어가 없는 경우 false 반환
        if (!db.objectStoreNames.contains('cacheData')) {
          db.close();
          return resolve(false);
        }
        
        const transaction = db.transaction(['cacheData'], 'readwrite');
        const store = transaction.objectStore('cacheData');
        const deleteRequest = store.delete(key);
        
        deleteRequest.onsuccess = () => {
          db.close();
          resolve(true);
        };
        
        deleteRequest.onerror = () => {
          db.close();
          reject(new Error('IndexedDB 항목 삭제 실패'));
        };
      } catch (error) {
        reject(error);
      }
    };
  });
};

/**
 * 모든 캐시 데이터 삭제 (개선됨)
 * 
 * @param {Object} options - 옵션
 * @param {boolean} options.preservePriority - 우선 처리 대상 보존 여부
 * @param {boolean} options.onlyExpired - 만료된 항목만 삭제 여부
 * @returns {Promise<Object>} - 삭제 결과
 */
export const clearAllCache = async (options = {}) => {
  const { preservePriority = false, onlyExpired = false } = options;
  const now = Date.now();
  const results = { localStorage: 0, indexedDB: 0 };
  
  try {
    // LocalStorage 정리
    const cacheKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.endsWith('_expiry') && !key.endsWith('_priority')) {
        
        // 만료된 항목만 삭제 옵션 처리
        if (onlyExpired) {
          const expiry = localStorage.getItem(`${key}_expiry`);
          if (!expiry || parseInt(expiry, 10) > now) {
            continue; // 만료되지 않은 항목 스킵
          }
        }
        
        // 우선 처리 대상 보존 옵션 처리
        if (preservePriority && localStorage.getItem(`${key}_priority`) === 'true') {
          continue; // 우선 처리 대상 스킵
        }
        
        cacheKeys.push(key);
      }
    }
    
    // LocalStorage 항목 삭제
    cacheKeys.forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_expiry`);
      localStorage.removeItem(`${key}_priority`);
      results.localStorage++;
    });
    
    // IndexedDB 정리
    if ('indexedDB' in window) {
      try {
        results.indexedDB = await clearIndexedDBCache({
          preservePriority,
          onlyExpired
        });
      } catch (indexedDBError) {
        console.warn('IndexedDB 캐시 정리 오류:', indexedDBError);
      }
    }
    
    // 서비스 워커에 캐시 정리 알림
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_CLEARED',
        payload: { 
          preservePriority, 
          onlyExpired,
          results,
          timestamp: now
        }
      });
    }
    
    return { success: true, results };
  } catch (error) {
    console.warn('전체 캐시 삭제 오류:', error);
    return { success: false, error: error.message, results };
  }
};

/**
 * IndexedDB 캐시 데이터 정리 (추가됨)
 * 
 * @param {Object} options - 옵션
 * @param {boolean} options.preservePriority - 우선 처리 대상 보존 여부
 * @param {boolean} options.onlyExpired - 만료된 항목만 삭제 여부
 * @returns {Promise<number>} - 삭제된 항목 수
 */
const clearIndexedDBCache = (options = {}) => {
  const { preservePriority = false, onlyExpired = false } = options;
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    // IndexedDB 열기
    const request = indexedDB.open('MyTripStyleCache', 1);
    
    request.onerror = () => {
      reject(new Error('IndexedDB 열기 실패'));
    };
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        
        // 객체 스토어가 없는 경우 0 반환
        if (!db.objectStoreNames.contains('cacheData')) {
          db.close();
          return resolve(0);
        }
        
        const transaction = db.transaction(['cacheData'], 'readwrite');
        const store = transaction.objectStore('cacheData');
        
        // 만료된 항목만 삭제
        if (onlyExpired) {
          const expiryIndex = store.index('expiry');
          const range = IDBKeyRange.upperBound(now);
          const cursorRequest = expiryIndex.openCursor(range);
          
          let count = 0;
          cursorRequest.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              // 우선 처리 대상 보존 옵션 처리
              if (preservePriority && cursor.value.priority === 1) {
                cursor.continue();
                return;
              }
              
              // 항목 삭제
              cursor.delete();
              count++;
              cursor.continue();
            }
          };
          
          transaction.oncomplete = () => {
            db.close();
            resolve(count);
          };
          
          transaction.onerror = () => {
            db.close();
            reject(new Error('IndexedDB 만료 항목 삭제 실패'));
          };
          
          return;
        }
        
        // 모든 항목 삭제 (우선 처리 대상 제외 가능)
        if (preservePriority) {
          const priorityIndex = store.index('priority');
          const range = IDBKeyRange.only(0); // 우선 처리 대상이 아닌 항목만
          const cursorRequest = priorityIndex.openCursor(range);
          
          let count = 0;
          cursorRequest.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              cursor.delete();
              count++;
              cursor.continue();
            }
          };
          
          transaction.oncomplete = () => {
            db.close();
            resolve(count);
          };
        } else {
          // 모든 항목 삭제 (간단하게)
          const clearRequest = store.clear();
          
          clearRequest.onsuccess = () => {
            db.close();
            resolve(store.count);
          };
          
          clearRequest.onerror = () => {
            db.close();
            reject(new Error('IndexedDB 전체 항목 삭제 실패'));
          };
        }
      } catch (error) {
        reject(error);
      }
    };
  });
};

/**
 * 캐시 사용량 통계 가져오기 (추가됨)
 * 
 * @returns {Promise<Object>} - 캐시 사용량 통계
 */
export const getCacheStats = async () => {
  const stats = {
    localStorage: {
      count: 0,
      size: 0,
      items: []
    },
    indexedDB: {
      count: 0,
      size: 0
    },
    total: {
      count: 0,
      size: 0
    }
  };
  
  try {
    // LocalStorage 통계
    const cacheKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.endsWith('_expiry') && !key.endsWith('_priority')) {
        const value = localStorage.getItem(key);
        const expiry = localStorage.getItem(`${key}_expiry`);
        const priority = localStorage.getItem(`${key}_priority`) === 'true';
        const size = value ? value.length : 0;
        
        stats.localStorage.count++;
        stats.localStorage.size += size;
        stats.localStorage.items.push({
          key,
          size,
          expiry: expiry ? parseInt(expiry, 10) : null,
          priority,
          expired: expiry ? parseInt(expiry, 10) < Date.now() : false
        });
      }
    }
    
    // IndexedDB 통계
    if ('indexedDB' in window) {
      try {
        const dbStats = await getIndexedDBStats();
        stats.indexedDB = dbStats;
      } catch (indexedDBError) {
        console.warn('IndexedDB 통계 가져오기 오류:', indexedDBError);
      }
    }
    
    // 총계 계산
    stats.total.count = stats.localStorage.count + stats.indexedDB.count;
    stats.total.size = stats.localStorage.size + stats.indexedDB.size;
    
    return stats;
  } catch (error) {
    console.warn('캐시 통계 가져오기 오류:', error);
    return stats;
  }
};

/**
 * IndexedDB 캐시 통계 가져오기 (추가됨)
 * 
 * @returns {Promise<Object>} - IndexedDB 캐시 통계
 */
const getIndexedDBStats = () => {
  return new Promise((resolve) => {
    const stats = {
      count: 0,
      size: 0,
      expired: 0,
      priority: 0
    };
    
    // IndexedDB 지원 확인
    if (!('indexedDB' in window)) {
      return resolve(stats);
    }
    
    // IndexedDB 열기
    const request = indexedDB.open('MyTripStyleCache', 1);
    
    request.onerror = () => {
      resolve(stats);
    };
    
    request.onsuccess = (event) => {
      try {
        const db = event.target.result;
        
        // 객체 스토어가 없는 경우 기본 통계 반환
        if (!db.objectStoreNames.contains('cacheData')) {
          db.close();
          return resolve(stats);
        }
        
        const transaction = db.transaction(['cacheData'], 'readonly');
        const store = transaction.objectStore('cacheData');
        const countRequest = store.count();
        
        countRequest.onsuccess = () => {
          stats.count = countRequest.result;
        };
        
        // 모든 항목 순회하며 통계 수집
        const cursorRequest = store.openCursor();
        const now = Date.now();
        
        cursorRequest.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const item = cursor.value;
            // 항목 크기 계산 (대략적으로)
            const itemSize = JSON.stringify(item.data).length;
            stats.size += itemSize;
            
            // 만료 상태 확인
            if (item.expiry < now) {
              stats.expired++;
            }
            
            // 우선 순위 항목 확인
            if (item.priority === 1) {
              stats.priority++;
            }
            
            cursor.continue();
          }
        };
        
        transaction.oncomplete = () => {
          db.close();
          resolve(stats);
        };
      } catch (error) {
        console.warn('IndexedDB 통계 수집 오류:', error);
        resolve(stats);
      }
    };
  });
};

// 캐시 유틸리티 객체로 내보내기
export const cacheUtils = {
  isOffline,
  getConnectionQuality,
  getCachedData,
  setCachedData,
  clearCachedData,
  clearAllCache,
  getCacheStats
};

export default cacheUtils;
