// src/utils/networkUtils.js

/**
 * 네트워크 상태 및 연결 관련 유틸리티 함수
 */

// 현재 네트워크 상태 확인
export const isOnline = () => {
    return navigator.onLine;
  };
  
  // 네트워크 연결 상태 모니터링
  export const monitorNetwork = (onOnline, onOffline) => {
    const handleOnline = () => {
      console.log('네트워크: 온라인 상태로 변경됨');
      if (onOnline) onOnline();
    };
    
    const handleOffline = () => {
      console.log('네트워크: 오프라인 상태로 변경됨');
      if (onOffline) onOffline();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 이벤트 리스너 해제 함수 반환
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };
  
  // 연결 유형 확인 (가능한 경우)
  export const getConnectionType = () => {
    if (!navigator.onLine) {
      return 'none';
    }
    
    if (navigator.connection) {
      const { effectiveType, type } = navigator.connection;
      
      if (type) {
        return type; // wifi, cellular, none, unknown
      } else if (effectiveType) {
        return effectiveType; // 4g, 3g, 2g, slow-2g
      }
    }
    
    return 'unknown';
  };
  
  // 네트워크 속도 정보 가져오기
  export const getConnectionSpeed = () => {
    if (navigator.connection && navigator.connection.downlink) {
      return {
        downlink: navigator.connection.downlink, // Mbps
        rtt: navigator.connection.rtt, // ms (Round Trip Time)
        saveData: navigator.connection.saveData || false // 데이터 절약 모드
      };
    }
    
    return null;
  };
  
  // 타임아웃이 있는 Fetch
  export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('요청 시간 초과');
      }
      throw error;
    }
  };
  
  // 네트워크 연결 테스트
  export const testConnection = async (testUrl = '/api/ping', timeout = 5000) => {
    try {
      const startTime = performance.now();
      const response = await fetchWithTimeout(testUrl, {
        method: 'HEAD',
        cache: 'no-cache'
      }, timeout);
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      return {
        online: response.ok,
        latency,
        status: response.status
      };
    } catch (error) {
      return {
        online: false,
        latency: null,
        error: error.message
      };
    }
  };
  
  // 네트워크 오류 메시지 확인
  const containsNetworkErrorMessage = (text, networkErrorMessages) => {
    return networkErrorMessages.some(msg => text.includes(msg));
  };
  
  // 네트워크 오류 감지
  export const isNetworkError = (error) => {
    const networkErrorMessages = [
      'Network Error',
      'Failed to fetch',
      'NetworkError',
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_CONNECTION_ABORTED',
      'net::ERR_CONNECTION_FAILED',
      'net::ERR_NAME_NOT_RESOLVED',
      '요청 시간 초과'
    ];
    
    if (error.name === 'AbortError') {
      return true;
    }
    
    if (!error.message) {
      return false;
    }
    
    return containsNetworkErrorMessage(error.message, networkErrorMessages) || 
           containsNetworkErrorMessage(error.toString(), networkErrorMessages);
  };
  
  // 오프라인 대체 API 생성
  export const createOfflineFallback = (originalAPI, fallbackData) => {
    return async (...args) => {
      if (!navigator.onLine) {
        console.log('오프라인 상태: 대체 데이터 사용');
        
        if (typeof fallbackData === 'function') {
          return fallbackData(...args);
        }
        
        return fallbackData;
      }
      
      try {
        return await originalAPI(...args);
      } catch (error) {
        if (isNetworkError(error)) {
          console.log('네트워크 오류: 대체 데이터 사용');
          
          if (typeof fallbackData === 'function') {
            return fallbackData(...args);
          }
          
          return fallbackData;
        }
        
        throw error;
      }
    };
  };
  
  // 대기 함수
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // 지정된 지연 시간으로 재시도 수행 함수
  const performRetryWithDelay = async (fn, retries, maxRetries, initialDelay, multiplier, onRetry, shouldRetry) => {
    let currentDelay = initialDelay;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`재시도 중... (${attempt}/${maxRetries})`);
        }
        
        return await fn();
      } catch (error) {
        // 최대 시도 횟수 도달 또는 재시도 조건 미충족
        if (attempt >= maxRetries || !shouldRetry(error)) {
          throw error;
        }
        
        // 재시도 콜백 호출
        if (onRetry) {
          onRetry(attempt + 1, error, currentDelay);
        }
        
        // 대기 후 재시도
        await wait(currentDelay);
        
        // 다음 대기 시간 업데이트
        currentDelay = currentDelay * multiplier;
      }
    }
  };
  
  // 네트워크 재시도 전략
  export const withRetry = async (fn, options = {}) => {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      multiplier = 2,
      onRetry = null,
      shouldRetry = isNetworkError
    } = options;
    
    return performRetryWithDelay(
      fn, 
      0, 
      maxRetries, 
      retryDelay, 
      multiplier, 
      onRetry, 
      shouldRetry
    );
  };
  
  // 네트워크 상태에 따른 UI 상태 추적
  export const trackNetworkState = (updateUI) => {
    let currentState = {
      isOnline: navigator.onLine,
      connectionType: getConnectionType(),
      lastChanged: new Date().toISOString()
    };
    
    if (updateUI) {
      updateUI(currentState);
    }
    
    return monitorNetwork(
      // 온라인 전환 시
      () => {
        currentState = {
          isOnline: true,
          connectionType: getConnectionType(),
          lastChanged: new Date().toISOString()
        };
        
        if (updateUI) {
          updateUI(currentState);
        }
      },
      // 오프라인 전환 시
      () => {
        currentState = {
          isOnline: false,
          connectionType: 'none',
          lastChanged: new Date().toISOString()
        };
        
        if (updateUI) {
          updateUI(currentState);
        }
      }
    );
  };
  
  // 객체 먼저 생성 후 내보내기
  const networkUtils = {
    isOnline,
    monitorNetwork,
    getConnectionType,
    getConnectionSpeed,
    fetchWithTimeout,
    testConnection,
    isNetworkError,
    createOfflineFallback,
    withRetry,
    trackNetworkState
  };
  
  export default networkUtils;
