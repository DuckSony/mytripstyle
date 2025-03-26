// src/utils/storageUtils.js

/**
 * 로컬 스토리지 및 세션 스토리지 관련 유틸리티 함수
 */

// 스토리지 키 접두사 (네임스페이스 분리)
const STORAGE_KEY_PREFIX = 'dailytrip_';

/**
 * 로컬 스토리지에 데이터 저장
 * @param {string} key - 저장 키
 * @param {any} data - 저장할 데이터
 * @returns {boolean} - 저장 성공 여부
 */
export const setLocalStorage = (key, data) => {
  try {
    const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
    
    // null이나 undefined는 제외
    if (data === null || data === undefined) {
      localStorage.removeItem(prefixedKey);
      return true;
    }
    
    // 데이터 직렬화
    const serializedData = JSON.stringify(data);
    localStorage.setItem(prefixedKey, serializedData);
    return true;
  } catch (error) {
    console.error('Storage: 로컬 스토리지 저장 오류', error);
    
    // 스토리지 용량 초과 가능성이 있음
    if (error instanceof DOMException && (
      // Firefox
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      // Chrome
      error.name === 'QuotaExceededError' ||
      // Safari
      error.name === 'QUOTA_EXCEEDED_ERR'
    )) {
      console.warn('Storage: 로컬 스토리지 용량 초과, 오래된 항목 정리 시도');
      // 오래된 항목 정리 시도
      clearOldItems();
      
      // 다시 저장 시도
      try {
        const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
        const serializedData = JSON.stringify(data);
        localStorage.setItem(prefixedKey, serializedData);
        return true;
      } catch (retryError) {
        console.error('Storage: 정리 후에도 저장 실패', retryError);
        return false;
      }
    }
    
    return false;
  }
};

/**
 * 로컬 스토리지에서 데이터 조회
 * @param {string} key - 저장 키
 * @param {any} defaultValue - 데이터가 없을 경우 기본값
 * @returns {any} - 조회된 데이터 또는 기본값
 */
export const getLocalStorage = (key, defaultValue = null) => {
  try {
    const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
    const serializedData = localStorage.getItem(prefixedKey);
    
    // 데이터가 없으면 기본값 반환
    if (serializedData === null) {
      return defaultValue;
    }
    
    // 데이터 역직렬화
    return JSON.parse(serializedData);
  } catch (error) {
    console.error('Storage: 로컬 스토리지 조회 오류', error);
    return defaultValue;
  }
};

/**
 * 로컬 스토리지에서 데이터 삭제
 * @param {string} key - 삭제할 키
 * @returns {boolean} - 삭제 성공 여부
 */
export const removeLocalStorage = (key) => {
  try {
    const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
    return true;
  } catch (error) {
    console.error('Storage: 로컬 스토리지 삭제 오류', error);
    return false;
  }
};

/**
 * 세션 스토리지에 데이터 저장
 * @param {string} key - 저장 키
 * @param {any} data - 저장할 데이터
 * @returns {boolean} - 저장 성공 여부
 */
export const setSessionStorage = (key, data) => {
  try {
    const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
    
    // null이나 undefined는 제외
    if (data === null || data === undefined) {
      sessionStorage.removeItem(prefixedKey);
      return true;
    }
    
    // 데이터 직렬화
    const serializedData = JSON.stringify(data);
    sessionStorage.setItem(prefixedKey, serializedData);
    return true;
  } catch (error) {
    console.error('Storage: 세션 스토리지 저장 오류', error);
    return false;
  }
};

/**
 * 세션 스토리지에서 데이터 조회
 * @param {string} key - 저장 키
 * @param {any} defaultValue - 데이터가 없을 경우 기본값
 * @returns {any} - 조회된 데이터 또는 기본값
 */
export const getSessionStorage = (key, defaultValue = null) => {
  try {
    const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
    const serializedData = sessionStorage.getItem(prefixedKey);
    
    // 데이터가 없으면 기본값 반환
    if (serializedData === null) {
      return defaultValue;
    }
    
    // 데이터 역직렬화
    return JSON.parse(serializedData);
  } catch (error) {
    console.error('Storage: 세션 스토리지 조회 오류', error);
    return defaultValue;
  }
};

/**
 * 세션 스토리지에서 데이터 삭제
 * @param {string} key - 삭제할 키
 * @returns {boolean} - 삭제 성공 여부
 */
export const removeSessionStorage = (key) => {
  try {
    const prefixedKey = `${STORAGE_KEY_PREFIX}${key}`;
    sessionStorage.removeItem(prefixedKey);
    return true;
  } catch (error) {
    console.error('Storage: 세션 스토리지 삭제 오류', error);
    return false;
  }
};

/**
 * 애플리케이션 관련 로컬 스토리지 항목 모두 삭제
 * @returns {number} - 삭제된 항목 수
 */
export const clearAppLocalStorage = () => {
  let count = 0;
  
  try {
    // 모든 로컬 스토리지 키 조회
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    
    // 애플리케이션 관련 항목 삭제
    keys.forEach(key => {
      localStorage.removeItem(key);
      count++;
    });
    
    console.log(`Storage: ${count}개 로컬 스토리지 항목 삭제됨`);
    return count;
  } catch (error) {
    console.error('Storage: 로컬 스토리지 전체 삭제 오류', error);
    return count;
  }
};

/**
 * 애플리케이션 관련 세션 스토리지 항목 모두 삭제
 * @returns {number} - 삭제된 항목 수
 */
export const clearAppSessionStorage = () => {
  let count = 0;
  
  try {
    // 모든 세션 스토리지 키 조회
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    
    // 애플리케이션 관련 항목 삭제
    keys.forEach(key => {
      sessionStorage.removeItem(key);
      count++;
    });
    
    console.log(`Storage: ${count}개 세션 스토리지 항목 삭제됨`);
    return count;
  } catch (error) {
    console.error('Storage: 세션 스토리지 전체 삭제 오류', error);
    return count;
  }
};

/**
 * 로컬 스토리지 공간 확보를 위해 오래된 항목 삭제
 * @param {number} threshold - 삭제할 항목 비율 (0.0-1.0)
 * @returns {number} - 삭제된 항목 수
 */
export const clearOldItems = (threshold = 0.3) => {
  try {
    // 앱 관련 로컬 스토리지 항목 수집
    const appItems = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          // 타임스탬프 항목 식별을 위한 값 확인 시도
          const value = localStorage.getItem(key);
          let timestamp = Date.now(); // 기본값
          
          // 값이 JSON인지 확인하고 타임스탬프 찾기 시도
          try {
            const data = JSON.parse(value);
            // 타임스탬프 필드가 있는지 확인
            if (data && (data.timestamp || data.createdAt || data.updatedAt)) {
              timestamp = data.timestamp || data.createdAt || data.updatedAt;
            }
          } catch (e) {
            // JSON 파싱 실패 시 무시
          }
          
          appItems.push({
            key,
            size: value ? value.length : 0,
            timestamp
          });
        } catch (e) {
          // 항목 처리 실패 시 무시하고 계속 진행
        }
      }
    }
    
    // 오래된 순으로 정렬
    appItems.sort((a, b) => a.timestamp - b.timestamp);
    
    // 임계값에 따라 삭제할 항목 수 계산
    const deleteCount = Math.max(1, Math.floor(appItems.length * threshold));
    
    // 가장 오래된 항목부터 삭제
    for (let i = 0; i < deleteCount; i++) {
      if (i < appItems.length) {
        localStorage.removeItem(appItems[i].key);
      }
    }
    
    console.log(`Storage: 가장 오래된 항목 ${deleteCount}개 삭제됨`);
    return deleteCount;
  } catch (error) {
    console.error('Storage: 오래된 항목 삭제 오류', error);
    return 0;
  }
};

/**
 * 로컬 스토리지 사용량 확인
 * @returns {Object} - 사용량 정보 (totalSize, limit, usage 등)
 */
export const getStorageUsage = () => {
  try {
    let totalSize = 0;
    let appSize = 0;
    const appItems = [];
    
    // 전체 로컬 스토리지 항목 확인
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      const size = (key ? key.length : 0) + (value ? value.length : 0);
      
      totalSize += size;
      
      // 앱 관련 항목은 별도 계산
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        appSize += size;
        appItems.push({ key, size });
      }
    }
    
    // 사용량 계산 (바이트 단위)
    const usageInBytes = totalSize * 2; // UTF-16 인코딩 (2바이트/문자)
    const appUsageInBytes = appSize * 2;
    
    // 최대 용량 (브라우저마다 다름, 일반적으로 5-10MB)
    const estimatedLimit = 5 * 1024 * 1024; // 5MB로 가정
    
    return {
      totalItems: localStorage.length,
      appItems: appItems.length,
      totalSize: Math.round(usageInBytes / 1024), // KB
      appSize: Math.round(appUsageInBytes / 1024), // KB
      limit: Math.round(estimatedLimit / 1024), // KB
      usage: Math.round((usageInBytes / estimatedLimit) * 100), // %
      items: appItems.map(item => ({
        key: item.key.replace(STORAGE_KEY_PREFIX, ''),
        size: Math.round((item.size * 2) / 1024 * 10) / 10 // KB (소수점 1자리)
      }))
    };
  } catch (error) {
    console.error('Storage: 사용량 확인 오류', error);
    return {
      error: error.message,
      totalItems: 0,
      appItems: 0,
      totalSize: 0,
      appSize: 0
    };
  }
};

/**
 * 브라우저 로컬 스토리지 지원 여부 확인
 * @returns {boolean} - 지원 여부
 */
export const isStorageAvailable = () => {
  try {
    const test = 'test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// 기본 객체로 내보내기
const storageUtils = {
  setLocalStorage,
  getLocalStorage,
  removeLocalStorage,
  setSessionStorage,
  getSessionStorage,
  removeSessionStorage,
  clearAppLocalStorage,
  clearAppSessionStorage,
  clearOldItems,
  getStorageUsage,
  isStorageAvailable
};

export default storageUtils;
