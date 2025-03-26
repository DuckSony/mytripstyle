/**
 * API 호출 결과 캐싱 유틸리티
 * 
 * 이 모듈은 API 호출 결과를 로컬 스토리지에 캐싱하여 불필요한 네트워크 요청을 줄입니다.
 * 캐시 만료 시간, 캐시 키 생성, 캐싱된 데이터 관리 기능을 제공합니다.
 */

import { Env } from './envValidator';

// 캐시 접두사 - 다른 로컬 스토리지 항목과 구분
const CACHE_PREFIX = 'mytripstyle_api_cache_';

// 기본 캐시 만료 시간 (초)
const DEFAULT_CACHE_TTL = Env.cache.ttl || 86400; // 기본값 1일

// 캐시 저장소 인터페이스 (기본값: localStorage)
let storageInterface = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
  clear: () => {
    // CACHE_PREFIX로 시작하는 항목만 삭제
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
};

/**
 * API 호출 파라미터에서 캐시 키 생성
 * @param {string} endpoint API 엔드포인트
 * @param {Object} params API 파라미터
 * @returns {string} 캐시 키
 */
export function generateCacheKey(endpoint, params = {}) {
    // 정렬된 파라미터 문자열 생성 (일관된 결과를 위해)
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    
    // 엔드포인트와 파라미터를 결합하여 캐시 키 생성
    return `${CACHE_PREFIX}${endpoint}${sortedParams ? `_${sortedParams}` : ''}`;
  }
  
  /**
   * 캐시가 유효한지 확인
   * @param {Object} cachedData 캐시된 데이터 객체
   * @param {number} ttl 캐시 유효 시간(초)
   * @returns {boolean} 캐시 유효 여부
   */
  export function isCacheValid(cachedData, ttl = DEFAULT_CACHE_TTL) {
    if (!cachedData || !cachedData.timestamp) {
      return false;
    }
    
    const now = Date.now();
    const maxAge = ttl * 1000; // 초를 밀리초로 변환
    
    return (now - cachedData.timestamp) < maxAge;
  }

  /**
 * 캐시에서 데이터 가져오기
 * @param {string} cacheKey 캐시 키
 * @param {number} ttl 캐시 유효 시간(초)
 * @returns {Object|null} 캐시된 데이터 또는 null
 */
export function getFromCache(cacheKey, ttl = DEFAULT_CACHE_TTL) {
    try {
      const cachedItem = storageInterface.getItem(cacheKey);
      
      if (!cachedItem) {
        return null;
      }
      
      const cachedData = JSON.parse(cachedItem);
      
      if (isCacheValid(cachedData, ttl)) {
        return cachedData.data;
      }
      
      // 캐시가 만료된 경우 제거
      storageInterface.removeItem(cacheKey);
      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }
  
  /**
   * 데이터를 캐시에 저장
   * @param {string} cacheKey 캐시 키
   * @param {*} data 저장할 데이터
   * @returns {boolean} 저장 성공 여부
   */
  export function saveToCache(cacheKey, data) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      
      storageInterface.setItem(cacheKey, JSON.stringify(cacheItem));
      return true;
    } catch (error) {
      console.error('Error saving to cache:', error);
      
      // 스토리지 용량 초과 시 캐시 정리 시도
      if (error.name === 'QuotaExceededError') {
        clearCache();
        
        try {
          // 다시 저장 시도
          const cacheItem = {
            data,
            timestamp: Date.now()
          };
          storageInterface.setItem(cacheKey, JSON.stringify(cacheItem));
          return true;
        } catch (retryError) {
          console.error('Failed to save to cache after clearing:', retryError);
          return false;
        }
      }
      
      return false;
    }
  }

  /**
 * 특정 캐시 항목 삭제
 * @param {string} cacheKey 삭제할 캐시 키
 */
export function removeFromCache(cacheKey) {
    storageInterface.removeItem(cacheKey);
  }
  
  /**
   * 모든 API 캐시 삭제
   */
  export function clearCache() {
    storageInterface.clear();
  }
  
  /**
   * 만료된 캐시 항목 정리
   * @param {number} ttl 캐시 유효 시간(초)
   */
  export function cleanExpiredCache(ttl = DEFAULT_CACHE_TTL) {
    const maxAge = ttl * 1000; // 초를 밀리초로 변환
    const now = Date.now();
    
    try {
      // localStorage의 모든 키 순회
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_PREFIX))
        .forEach(key => {
          try {
            const cachedItem = JSON.parse(localStorage.getItem(key));
            
            // 만료된 항목 삭제
            if (cachedItem && cachedItem.timestamp && (now - cachedItem.timestamp) >= maxAge) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // 파싱 오류가 발생한 항목 삭제
            localStorage.removeItem(key);
          }
        });
    } catch (error) {
      console.error('Error cleaning expired cache:', error);
    }
  }

  /**
 * API 호출 결과를 캐싱하는 함수
 * @param {Function} apiCallFn API 호출 함수
 * @param {string} endpoint API 엔드포인트
 * @param {Object} params API 파라미터
 * @param {Object} options 캐싱 옵션
 * @returns {Promise<*>} API 응답 데이터
 */
export async function cachedApiCall(apiCallFn, endpoint, params = {}, options = {}) {
    const { 
      ttl = DEFAULT_CACHE_TTL, 
      bypassCache = false,
      updateCache = true
    } = options;
    
    const cacheKey = generateCacheKey(endpoint, params);
    
    // 캐시 사용하지 않는 경우 바로 API 호출
    if (bypassCache) {
      const data = await apiCallFn(params);
      
      // 캐시 업데이트 옵션이 켜져 있으면 결과 저장
      if (updateCache) {
        saveToCache(cacheKey, data);
      }
      
      return data;
    }
    
    // 캐시 확인
    const cachedData = getFromCache(cacheKey, ttl);
    
    if (cachedData) {
      return cachedData;
    }
    
    // 캐시에 없으면 API 호출
    const data = await apiCallFn(params);
    
    // 결과 캐싱
    saveToCache(cacheKey, data);
    
    return data;
  }
  
  /**
   * 테스트용 캐시 스토리지 변경 (기본값은 localStorage)
   * @param {Object} customStorage 커스텀 스토리지 인터페이스
   */
  export function setCustomStorage(customStorage) {
    if (customStorage && 
        typeof customStorage.getItem === 'function' && 
        typeof customStorage.setItem === 'function' && 
        typeof customStorage.removeItem === 'function' && 
        typeof customStorage.clear === 'function') {
      storageInterface = customStorage;
    } else {
      throw new Error('Invalid storage interface. Must implement getItem, setItem, removeItem, and clear methods.');
    }
  }
  
  // React Hook 형태의 캐싱 API 호출
  export function useCachedApiCall() {
    // React Hook 구현은 이 모듈의 범위를 벗어납니다.
    // 필요한 경우 React 관련 모듈에 구현하세요.
  }
  
  // 기본 내보내기
  export default {
    cachedApiCall,
    getFromCache,
    saveToCache,
    removeFromCache,
    clearCache,
    cleanExpiredCache,
    generateCacheKey,
    isCacheValid
  };
