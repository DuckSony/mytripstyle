/**
 * API 호출 속도 제한 유틸리티
 * 
 * 이 모듈은 API 호출 횟수를 제한하고 관리하는 기능을 제공합니다.
 * 디바운싱, 스로틀링, 재시도 로직 등을 구현하여 API 사용량을 최적화합니다.
 */

// API 제한 설정
const DEFAULT_SETTINGS = {
    // 일반 API 요청 - 분당 최대 30회
    default: {
      maxRequestsPerMinute: 30,
      maxRequestsPerHour: 500,
      retryLimit: 3,
      retryDelay: 1000, // 1초
    },
    // 지도 API 요청 - 분당 최대 10회 (비용 절감)
    maps: {
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      retryLimit: 2,
      retryDelay: 2000, // 2초
    },
    // 장소 검색 API - 분당 최대 5회 (비용 높음)
    places: {
      maxRequestsPerMinute: 5,
      maxRequestsPerHour: 50,
      retryLimit: 2,
      retryDelay: 3000, // 3초
    }
  };
  
  // API 사용량 추적 저장소
  const apiUsage = {
    // 분당 요청 추적
    minuteCounters: {
      default: { count: 0, resetTime: Date.now() + 60000 },
      maps: { count: 0, resetTime: Date.now() + 60000 },
      places: { count: 0, resetTime: Date.now() + 60000 }
    },
    // 시간당 요청 추적
    hourCounters: {
      default: { count: 0, resetTime: Date.now() + 3600000 },
      maps: { count: 0, resetTime: Date.now() + 3600000 },
      places: { count: 0, resetTime: Date.now() + 3600000 }
    },
    // 제한 초과 이벤트 리스너
    limitExceededListeners: []
  };

  /**
 * API 호출 카운터 업데이트 및 제한 확인
 * @param {string} apiType API 타입 ('default', 'maps', 'places')
 * @returns {boolean} API 호출 가능 여부
 */
function checkAndUpdateLimits(apiType = 'default') {
    const type = DEFAULT_SETTINGS[apiType] ? apiType : 'default';
    const settings = DEFAULT_SETTINGS[type];
    const now = Date.now();
    
    // 분당 카운터 리셋 (필요시)
    if (now >= apiUsage.minuteCounters[type].resetTime) {
      apiUsage.minuteCounters[type] = {
        count: 0,
        resetTime: now + 60000
      };
    }
    
    // 시간당 카운터 리셋 (필요시)
    if (now >= apiUsage.hourCounters[type].resetTime) {
      apiUsage.hourCounters[type] = {
        count: 0,
        resetTime: now + 3600000
      };
    }
    
    // 분당 제한 확인
    if (apiUsage.minuteCounters[type].count >= settings.maxRequestsPerMinute) {
      notifyLimitExceeded(type, 'minute');
      return false;
    }
    
    // 시간당 제한 확인
    if (apiUsage.hourCounters[type].count >= settings.maxRequestsPerHour) {
      notifyLimitExceeded(type, 'hour');
      return false;
    }
    
    // 카운터 증가
    apiUsage.minuteCounters[type].count++;
    apiUsage.hourCounters[type].count++;
    
    return true;
  }
  
  /**
   * 제한 초과 알림 발송
   * @param {string} apiType API 타입
   * @param {string} limitType 제한 타입 ('minute' 또는 'hour')
   */
  function notifyLimitExceeded(apiType, limitType) {
    const event = {
      type: apiType,
      limitType,
      timestamp: Date.now(),
      message: `API rate limit exceeded for ${apiType} (${limitType})`
    };
    
    // 콘솔 경고
    console.warn(event.message);
    
    // 등록된 리스너에게 알림
    apiUsage.limitExceededListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in limit exceeded listener:', error);
      }
    });
  }

  /**
 * 디바운스 함수 - 여러 번 호출되는 함수를 지정된 시간이 지난 후 한 번만 실행
 * @param {Function} func 실행할 함수
 * @param {number} wait 대기 시간 (밀리초)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * 스로틀 함수 - 함수가 일정 시간 간격으로만 실행되도록 제한
   * @param {Function} func 실행할 함수
   * @param {number} limit 실행 간격 (밀리초)
   * @returns {Function} 스로틀된 함수
   */
  export function throttle(func, limit = 300) {
    let inThrottle;
    
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
 * API 호출 함수를 속도 제한이 적용된 함수로 래핑
 * @param {Function} apiCallFn API 호출 함수
 * @param {string} apiType API 타입
 * @returns {Function} 속도 제한이 적용된 함수
 */
export function limitApiCall(apiCallFn, apiType = 'default') {
    return async function limitedApiCall(...args) {
      if (!checkAndUpdateLimits(apiType)) {
        const type = DEFAULT_SETTINGS[apiType] ? apiType : 'default';
        const settings = DEFAULT_SETTINGS[type];
        
        // 분당 제한 도달 시 대기 시간 계산
        const minuteWaitTime = Math.max(0, apiUsage.minuteCounters[type].resetTime - Date.now());
        
        // 시간당 제한 도달 시 대기 시간 계산
        const hourWaitTime = Math.max(0, apiUsage.hourCounters[type].resetTime - Date.now());
        
        // 필요한 대기 시간
        const waitTime = Math.min(minuteWaitTime, hourWaitTime);
        
        throw new Error(`API rate limit reached for ${apiType}. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
      }
      
      try {
        return await apiCallFn(...args);
      } catch (error) {
        // API 호출 오류 기록
        console.error(`API call error (${apiType}):`, error);
        throw error;
      }
    };
  }
  
  /**
   * 재시도 로직이 포함된 API 호출 함수
   * @param {Function} apiCallFn API 호출 함수
   * @param {string} apiType API 타입
   * @param {Object} retryOptions 재시도 옵션
   * @returns {Promise<*>} API 호출 결과
   */
  export async function callWithRetry(apiCallFn, apiType = 'default', retryOptions = {}) {
    const type = DEFAULT_SETTINGS[apiType] ? apiType : 'default';
    const settings = DEFAULT_SETTINGS[type];
    
    const options = {
      retryLimit: retryOptions.retryLimit || settings.retryLimit,
      retryDelay: retryOptions.retryDelay || settings.retryDelay,
      retryMultiplier: retryOptions.retryMultiplier || 2 // 지수 백오프 승수
    };
    
    let lastError;
    let delay = options.retryDelay;
    
    // 재시도 시도
    for (let attempt = 0; attempt <= options.retryLimit; attempt++) {
      try {
        // 첫 시도가 아닌 경우 지연
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          // 지수 백오프 적용
          delay *= options.retryMultiplier;
        }
        
        // API 호출 시도
        return await limitApiCall(apiCallFn, apiType)();
      } catch (error) {
        lastError = error;
        
        // 재시도 불가능한 오류인 경우 즉시 실패
        if (isNonRetryableError(error)) {
          throw error;
        }
        
        // 마지막 시도였으면 오류 throw
        if (attempt === options.retryLimit) {
          throw new Error(`API call failed after ${options.retryLimit + 1} attempts: ${error.message}`);
        }
        
        // 재시도 로깅
        console.warn(`API call attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
      }
    }
    
    // 이 코드에 도달할 수 없지만, 타입 안전성을 위해 추가
    throw lastError;
  }
  
  /**
   * 재시도 불가능한 오류인지 확인
   * @param {Error} error 확인할 오류
   * @returns {boolean} 재시도 불가능 여부
   */
  function isNonRetryableError(error) {
    // 권한 부족, 인증 오류 등은 재시도해도 해결되지 않음
    if (error.status === 401 || error.status === 403) {
      return true;
    }
    
    // API 키 관련 오류
    if (error.message && (
      error.message.includes('API key') ||
      error.message.includes('authentication') ||
      error.message.includes('permission')
    )) {
      return true;
    }
    
    // 잘못된 요청 오류
    if (error.status === 400 || error.status === 404) {
      return true;
    }
    
    return false;
  }

  /**
 * API 제한 초과 이벤트 리스너 등록
 * @param {Function} listener 리스너 함수
 */
export function addLimitExceededListener(listener) {
    if (typeof listener === 'function' && !apiUsage.limitExceededListeners.includes(listener)) {
      apiUsage.limitExceededListeners.push(listener);
    }
  }
  
  /**
   * API 제한 초과 이벤트 리스너 제거
   * @param {Function} listener 제거할 리스너 함수
   */
  export function removeLimitExceededListener(listener) {
    const index = apiUsage.limitExceededListeners.indexOf(listener);
    if (index !== -1) {
      apiUsage.limitExceededListeners.splice(index, 1);
    }
  }
  
  /**
   * 현재 API 사용량 통계 가져오기
   * @returns {Object} API 사용량 통계
   */
  export function getApiUsageStats() {
    return {
      minute: {
        default: { ...apiUsage.minuteCounters.default },
        maps: { ...apiUsage.minuteCounters.maps },
        places: { ...apiUsage.minuteCounters.places }
      },
      hour: {
        default: { ...apiUsage.hourCounters.default },
        maps: { ...apiUsage.hourCounters.maps },
        places: { ...apiUsage.hourCounters.places }
      },
      limits: DEFAULT_SETTINGS
    };
  }
  
  /**
   * API 타입별 제한 설정 업데이트
   * @param {string} apiType API 타입
   * @param {Object} settings 업데이트할 설정
   */
  export function updateApiLimits(apiType, settings) {
    if (!DEFAULT_SETTINGS[apiType]) {
      throw new Error(`Unknown API type: ${apiType}`);
    }
    
    DEFAULT_SETTINGS[apiType] = {
      ...DEFAULT_SETTINGS[apiType],
      ...settings
    };
  }
  
  // 기본 내보내기
  export default {
    limitApiCall,
    callWithRetry,
    debounce,
    throttle,
    addLimitExceededListener,
    removeLimitExceededListener,
    getApiUsageStats,
    updateApiLimits
  };

  
