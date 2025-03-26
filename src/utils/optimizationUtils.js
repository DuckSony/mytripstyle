// src/utils/optimizationUtils.js
/**
 * 성능 최적화 및 모니터링을 위한 유틸리티
 * PerformanceMonitor 컴포넌트와 함께 사용
 */

// 모니터링 상태
let isMonitoring = false;

// 모니터링 데이터 저장소
const performanceData = {
  measures: {
    renders: [],
    interactions: [],
    networkRequests: []
  },
  marks: [],
  observers: {},
  startTime: 0
};

// 이벤트 구독자 목록
const subscribers = [];

/**
 * 성능 모니터링 시작
 */
export const startPerformanceMonitoring = () => {
  if (isMonitoring) return;
  
  // 모니터링 상태 초기화
  performanceData.measures = {
    renders: [],
    interactions: [],
    networkRequests: []
  };
  performanceData.marks = [];
  performanceData.startTime = Date.now();
  
  console.log('[성능] 모니터링 시작');
  
  // 모니터링 설정
  setupPerformanceObservers();
  patchReactComponentLifecycles();
  
  isMonitoring = true;
};

/**
 * 성능 모니터링 중지
 */
export const stopPerformanceMonitoring = () => {
  if (!isMonitoring) return;
  
  console.log('[성능] 모니터링 중지');
  
  // 옵저버 정리
  for (const key in performanceData.observers) {
    if (performanceData.observers[key]) {
      try {
        performanceData.observers[key].disconnect();
      } catch (e) {
        console.error(`[성능] 옵저버 정리 중 오류 (${key}):`, e);
      }
    }
  }
  
  // React 패치 정리
  restoreReactPatches();
  
  isMonitoring = false;
};

/**
 * 성능 관찰자 설정
 */
const setupPerformanceObservers = () => {
  // 브라우저가 PerformanceObserver를 지원하는지 확인
  if (!window.PerformanceObserver) {
    console.warn('[성능] PerformanceObserver가 지원되지 않습니다.');
    return;
  }
  
  try {
    // 렌더링 지연 측정을 위한 옵저버
    const paintObserver = new PerformanceObserver((entries) => {
      entries.getEntries().forEach(entry => {
        // 첫 콘텐츠풀 페인트(FCP) 또는 첫 페인트(FP) 이벤트
        if (entry.name === 'first-contentful-paint' || entry.name === 'first-paint') {
          const event = {
            type: 'measure',
            category: 'renders', 
            label: entry.name === 'first-contentful-paint' ? 'First Contentful Paint' : 'First Paint',
            duration: entry.startTime,
            timestamp: Date.now(),
            level: entry.startTime < 1000 ? 'good' : (entry.startTime < 3000 ? 'warning' : 'critical')
          };
          
          performanceData.measures.renders.push(event);
          notifySubscribers(event);
        }
      });
    });
    
    // 오래 실행되는 작업 측정을 위한 옵저버
    const longTaskObserver = new PerformanceObserver((entries) => {
      entries.getEntries().forEach(entry => {
        const event = {
          type: 'measure',
          category: 'interactions',
          label: 'Long Task',
          duration: entry.duration,
          timestamp: Date.now(),
          level: entry.duration < 50 ? 'good' : (entry.duration < 100 ? 'warning' : 'critical')
        };
        
        performanceData.measures.interactions.push(event);
        notifySubscribers(event);
      });
    });
    
    // 리소스 로딩 측정을 위한 옵저버
    const resourceObserver = new PerformanceObserver((entries) => {
      entries.getEntries().forEach(entry => {
        // 너무 많은 이벤트를 생성하지 않도록 필터링
        if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
          const event = {
            type: 'measure',
            category: 'networkRequests',
            label: `${entry.initiatorType}: ${entry.name.split('/').pop()}`,
            duration: entry.duration,
            timestamp: Date.now(),
            level: entry.duration < 200 ? 'good' : (entry.duration < 1000 ? 'warning' : 'critical')
          };
          
          performanceData.measures.networkRequests.push(event);
          notifySubscribers(event);
        }
      });
    });
    
    // 옵저버 등록
    try {
      paintObserver.observe({ type: 'paint', buffered: true });
      performanceData.observers.paint = paintObserver;
    } catch (e) {
      console.warn('[성능] paint 옵저버 등록 실패:', e);
    }
    
    try {
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      performanceData.observers.longtask = longTaskObserver;
    } catch (e) {
      console.warn('[성능] longtask 옵저버 등록 실패:', e);
    }
    
    try {
      resourceObserver.observe({ type: 'resource', buffered: true });
      performanceData.observers.resource = resourceObserver;
    } catch (e) {
      console.warn('[성능] resource 옵저버 등록 실패:', e);
    }
  } catch (error) {
    console.error('[성능] 옵저버 설정 중 오류:', error);
  }
};

/**
 * React 컴포넌트 라이프사이클 패치
 * 이 함수는 실제 프로덕션 코드에서는 주의해서 사용해야 합니다.
 */
const patchReactComponentLifecycles = () => {
  // 개발용 함수로, 실제 프로덕션에서는 필요에 따라 구현
  console.log('[성능] React 컴포넌트 라이프사이클 성능 모니터링은 실제 구현 필요');
};

/**
 * React 패치 복원
 */
const restoreReactPatches = () => {
  // 개발용 함수로, 실제 프로덕션에서는 필요에 따라 구현
  console.log('[성능] React 패치 복원은 실제 구현 필요');
};

/**
 * 구독자에게 이벤트 알림
 * 
 * @param {Object} event - 성능 이벤트 객체
 */
const notifySubscribers = (event) => {
  subscribers.forEach(callback => {
    try {
      callback(event);
    } catch (error) {
      console.error('[성능] 구독자 알림 중 오류:', error);
    }
  });
};

/**
 * 성능 이벤트 구독
 * 
 * @param {Function} callback - 이벤트 발생 시 호출할 콜백 함수
 * @returns {Function} 구독 취소 함수
 */
export const subscribeToPerformanceEvents = (callback) => {
  if (typeof callback !== 'function') {
    throw new Error('구독 콜백은 함수여야 합니다.');
  }
  
  subscribers.push(callback);
  
  // 구독 취소 함수 반환
  return () => {
    const index = subscribers.indexOf(callback);
    if (index !== -1) {
      subscribers.splice(index, 1);
    }
  };
};

/**
 * 성능 데이터 가져오기
 * 
 * @returns {Object} 수집된 성능 데이터
 */
export const getPerformanceData = () => {
  return performanceData.measures;
};

/**
 * 성능 표시 추가
 * 
 * @param {string} name - 표시 이름
 */
export const markPerformance = (name) => {
  if (!isMonitoring) return;
  
  try {
    performance.mark(name);
    
    performanceData.marks.push({
      name,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`[성능] 표시 추가 오류 (${name}):`, error);
  }
};

/**
 * 두 표시 간의 성능 측정
 * 
 * @param {string} name - 측정 이름
 * @param {string} startMark - 시작 표시 이름
 * @param {string} endMark - 끝 표시 이름
 * @param {string} category - 측정 카테고리 (renders, interactions, networkRequests)
 */
export const measurePerformance = (name, startMark, endMark, category = 'interactions') => {
  if (!isMonitoring) return;
  
  try {
    // 측정 생성
    performance.measure(name, startMark, endMark);
    
    // 측정 결과 가져오기
    const measures = performance.getEntriesByName(name, 'measure');
    if (measures.length > 0) {
      const duration = measures[0].duration;
      
      // 성능 수준 결정
      let level = 'good';
      if (category === 'renders') {
        level = duration < 16 ? 'good' : (duration < 50 ? 'warning' : 'critical');
      } else if (category === 'interactions') {
        level = duration < 100 ? 'good' : (duration < 300 ? 'warning' : 'critical');
      } else if (category === 'networkRequests') {
        level = duration < 200 ? 'good' : (duration < 1000 ? 'warning' : 'critical');
      }
      
      // 이벤트 생성
      const event = {
        type: 'measure',
        category,
        label: name,
        duration,
        timestamp: Date.now(),
        level
      };
      
      // 카테고리별 저장
      if (performanceData.measures[category]) {
        performanceData.measures[category].push(event);
        
        // 최대 100개까지만 저장
        if (performanceData.measures[category].length > 100) {
          performanceData.measures[category] = performanceData.measures[category].slice(-100);
        }
      }
      
      // 구독자에게 알림
      notifySubscribers(event);
    }
  } catch (error) {
    console.error(`[성능] 측정 오류 (${name}):`, error);
  }
};

/**
 * 컴포넌트 렌더링 성능 측정
 * 
 * @param {string} componentName - 컴포넌트 이름
 * @param {Function} renderFunction - 렌더링 함수
 * @returns {any} 렌더링 함수의 반환값
 */
export const measureComponentRender = (componentName, renderFunction) => {
  if (!isMonitoring || typeof renderFunction !== 'function') {
    return renderFunction();
  }
  
  try {
    const startMark = `${componentName}_render_start`;
    const endMark = `${componentName}_render_end`;
    
    // 렌더 시작 표시
    markPerformance(startMark);
    
    // 컴포넌트 렌더링
    const result = renderFunction();
    
    // 렌더 종료 표시
    markPerformance(endMark);
    
    // 측정
    measurePerformance(`${componentName} render`, startMark, endMark, 'renders');
    
    return result;
  } catch (error) {
    console.error(`[성능] 컴포넌트 렌더링 측정 오류 (${componentName}):`, error);
    return renderFunction();
  }
};

/**
 * 이벤트 핸들러 성능 측정 래퍼 함수
 * 
 * @param {string} name - 이벤트 이름
 * @param {Function} handler - 이벤트 핸들러 함수
 * @returns {Function} 래핑된 이벤트 핸들러
 */
export const measureEvent = (name, handler) => {
  if (!isMonitoring || typeof handler !== 'function') {
    return handler;
  }
  
  return function(...args) {
    const startMark = `${name}_start`;
    const endMark = `${name}_end`;
    
    // 이벤트 시작 표시
    markPerformance(startMark);
    
    // 핸들러 실행
    const result = handler.apply(this, args);
    
    // Promise 반환 여부 확인 및 비동기 처리
    if (result && typeof result.then === 'function') {
      return result.then((value) => {
        // 이벤트 종료 표시
        markPerformance(endMark);
        
        // 측정
        measurePerformance(`${name} event`, startMark, endMark, 'interactions');
        
        return value;
      }).catch((error) => {
        // 이벤트 종료 표시 (오류 발생 시에도)
        markPerformance(endMark);
        
        // 측정
        measurePerformance(`${name} event (error)`, startMark, endMark, 'interactions');
        
        throw error;
      });
    }
    
    // 이벤트 종료 표시
    markPerformance(endMark);
    
    // 측정
    measurePerformance(`${name} event`, startMark, endMark, 'interactions');
    
    return result;
  };
};

/**
 * 네트워크 요청 성능 측정 래퍼 함수
 * 
 * @param {string} name - 요청 이름
 * @param {Function} requestFunction - 요청 함수 (fetch 또는 axios 등)
 * @returns {Promise} 요청 결과 Promise
 */
export const measureNetworkRequest = async (name, requestFunction) => {
  if (!isMonitoring || typeof requestFunction !== 'function') {
    return requestFunction();
  }
  
  try {
    const startMark = `${name}_request_start`;
    const endMark = `${name}_request_end`;
    
    // 요청 시작 표시
    markPerformance(startMark);
    
    // 요청 실행
    try {
      const result = await requestFunction();
      
      // 요청 종료 표시
      markPerformance(endMark);
      
      // 측정
      measurePerformance(`${name} request`, startMark, endMark, 'networkRequests');
      
      return result;
    } catch (error) {
      // 요청 종료 표시 (오류 발생 시에도)
      markPerformance(endMark);
      
      // 측정
      measurePerformance(`${name} request (error)`, startMark, endMark, 'networkRequests');
      
      throw error;
    }
  } catch (error) {
    console.error(`[성능] 네트워크 요청 측정 오류 (${name}):`, error);
    return requestFunction();
  }
};

/**
 * Core Web Vitals 및 기타 성능 지표 수집
 * 
 * @returns {Promise<Object>} 성능 지표 객체
 */
export const collectPerformanceMetrics = async () => {
  // PerformanceObserver API가 없으면 빈 객체 반환
  if (!window.PerformanceObserver) {
    return {};
  }
  
  try {
    // 메모리 사용량 수집
    let memory = null;
    if (window.performance && window.performance.memory) {
      const memoryInfo = window.performance.memory;
      memory = {
        used: Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024)), // MB
        total: Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024)), // MB
        percentage: Math.round((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100)
      };
    }
    
    // 리소스 사용량 수집
    let resources = null;
    if (window.performance && window.performance.getEntriesByType) {
      const resourceEntries = window.performance.getEntriesByType('resource');
      
      // 리소스 유형별 분류
      const types = {};
      let totalSize = 0;
      
      resourceEntries.forEach(entry => {
        // 리소스 유형 집계
        const type = entry.initiatorType || 'other';
        types[type] = (types[type] || 0) + 1;
        
        // 크기 집계 (transferSize가 더 정확하지만 일부 브라우저에서 지원하지 않음)
        totalSize += entry.transferSize || entry.encodedBodySize || 0;
      });
      
      resources = {
        count: resourceEntries.length,
        totalSize,
        types
      };
    }
    
    // 페인트 타이밍 수집
    let paint = null;
    if (window.performance && window.performance.getEntriesByType) {
      const paintEntries = window.performance.getEntriesByType('paint');
      
      paint = {};
      paintEntries.forEach(entry => {
        if (entry.name === 'first-paint') {
          paint.firstPaint = entry;
        } else if (entry.name === 'first-contentful-paint') {
          paint.firstContentfulPaint = entry;
        }
      });
    }
    
    // Largest Contentful Paint 수집
    // 참고: LCP는 PerformanceObserver를 통해서만 접근 가능
    let largestContentfulPaint = null;
    if (window.PerformanceObserver) {
      const lcpEntries = window.__lcpEntry; // 별도 코드에서 설정해야 함
      if (lcpEntries) {
        largestContentfulPaint = lcpEntries;
      }
    }
    
    // 내비게이션 타이밍 수집
    let navigation = null;
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      
      navigation = {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoadedTime: timing.domContentLoadedEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        redirectTime: timing.redirectEnd - timing.redirectStart,
        dnsLookupTime: timing.domainLookupEnd - timing.domainLookupStart,
        connectTime: timing.connectEnd - timing.connectStart,
        requestTime: timing.responseStart - timing.requestStart,
        responseTime: timing.responseEnd - timing.responseStart,
        domProcessingTime: timing.domComplete - timing.domLoading
      };
    }
    
    return {
      memory,
      resources,
      paint,
      largestContentfulPaint,
      navigation,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[성능] 지표 수집 오류:', error);
    return {};
  }
};

/**
 * 성능 도구를 개발 환경에서 활성화
 */
export const enableDebugTools = (namespace = 'perf') => {
  if (process.env.NODE_ENV !== 'development') return;
  
  // 콘솔에 도구 노출
  window[namespace] = {
    startPerformanceMonitoring,
    stopPerformanceMonitoring,
    getPerformanceData,
    markPerformance,
    measurePerformance,
    collectPerformanceMetrics
  };
  
  console.log(`[성능] 디버그 도구가 활성화되었습니다. window.${namespace} 객체에서 접근할 수 있습니다.`);
};

/**
 * 함수 호출 빈도를 제한하는 throttle 함수
 * 스크롤, 리사이즈 등의 이벤트 핸들러에 유용
 * 
 * @param {Function} func - 제한할 함수
 * @param {number} limit - 최소 함수 호출 간격 (밀리초)
 * @returns {Function} throttle된 함수
 */
export const throttle = (func, limit) => {
  let inThrottle;
  let lastResult;
  
  return function throttled(...args) {
    const context = this;
    
    if (!inThrottle) {
      lastResult = func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
};

/**
 * 성능 측정 시작 (startPerformanceMeasure / endPerformanceMeasure 쌍으로 사용)
 * measurePerformance의 래퍼 함수로, 코드 가독성 향상 목적
 * 
 * @param {string} name - 측정 이름
 * @param {string} category - 측정 카테고리 (renders, interactions, networkRequests)
 * @returns {Object} 측정 종료 함수를 포함한 객체
 */
export const startPerformanceMeasure = (name, category = 'interactions') => {
  if (!isMonitoring) {
    // 모니터링이 비활성화된 경우 noop 함수 반환
    return {
      end: () => {},
      cancel: () => {}
    };
  }
  
  try {
    const startMark = `${name}_start_${Date.now()}`;
    markPerformance(startMark);
    
    return {
      // 성공적으로 종료
      end: () => {
        try {
          const endMark = `${name}_end_${Date.now()}`;
          markPerformance(endMark);
          measurePerformance(name, startMark, endMark, category);
        } catch (error) {
          console.error(`[성능] 측정 종료 오류 (${name}):`, error);
        }
      },
      // 취소 (측정에서 제외)
      cancel: () => {
        try {
          // 측정을 취소해도 마크는 남겨두어 디버깅 용도로 활용 가능
          const cancelMark = `${name}_canceled_${Date.now()}`;
          markPerformance(cancelMark);
        } catch (error) {
          console.error(`[성능] 측정 취소 오류 (${name}):`, error);
        }
      }
    };
  } catch (error) {
    console.error(`[성능] 측정 시작 오류 (${name}):`, error);
    return {
      end: () => {},
      cancel: () => {}
    };
  }
};

// 기본 내보내기
export default {
  startPerformanceMonitoring,
  stopPerformanceMonitoring,
  subscribeToPerformanceEvents,
  getPerformanceData,
  markPerformance,
  measurePerformance,
  measureComponentRender,
  measureEvent,
  measureNetworkRequest,
  collectPerformanceMetrics,
  enableDebugTools,
  throttle,               // 새로 추가
  startPerformanceMeasure // 새로 추가
};
