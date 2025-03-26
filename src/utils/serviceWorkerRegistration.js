// src/utils/serviceWorkerRegistration.js

/**
 * 서비스 워커 등록 및 관리를 위한 유틸리티
 * 모바일 환경과 오프라인 지원을 위해 최적화됨
 */

// 상수 정의 - 아래쪽에서 참조할 전역 설정
const CONFIG = {
  // 서비스 워커 URL - 환경 변수 기반으로 구성
  SERVICE_WORKER_URL: `${process.env.PUBLIC_URL || ''}/service-worker.js`,
  
  // 서비스 워커 등록 기본 옵션
  DEFAULT_OPTIONS: {
    timeout: 10000,      // 등록 시간 제한 (10초)
    immediate: false,    // 기본적으로 지연 등록 사용
    checkInterval: 3600000, // 업데이트 확인 간격 (1시간)
    cacheFirst: true,    // 캐시 우선 전략 사용
    debug: false,        // 디버그 로깅 비활성화
    skipWaiting: true,   // 대기 중인 워커 즉시 활성화
    promptForUpdate: true // 업데이트 확인 시 사용자에게 알림
  },
  
  // 디바운스 및 쓰로틀링 설정
  DEBOUNCE: {
    SHORT: 300,  // 짧은 지연 (300ms)
    MEDIUM: 1000, // 중간 지연 (1초)
    LONG: 3000   // 긴 지연 (3초)
  },
  
  // 푸시 알림 관련 설정
  PUSH_NOTIFICATION: {
    PUBLIC_VAPID_KEY: process.env.REACT_APP_PUBLIC_VAPID_KEY || '', // VAPID 공개 키
    PERMISSION_DENIED: 'denied',
    PERMISSION_GRANTED: 'granted',
    PERMISSION_PROMPT: 'prompt'
  }
};

// 로컬호스트 환경 확인
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' || // IPv6 localhost
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  ) // IPv4 localhost
);

// 서비스 워커가 사용 가능한지 확인
const isServiceWorkerSupported = 'serviceWorker' in navigator && 'PushManager' in window;

// 등록 상태를 추적하기 위한 상태 변수
let registrationInProgress = false;
let cachedRegistration = null;
let updateCheckInProgress = false;
let lastUpdateCheckTime = 0;

// 확인된 서비스 워커 상태 캐싱
let cachedStatus = null;
let statusCacheTime = 0;

// 푸시 알림 구독 캐싱
let cachedPushSubscription = null;

// 성능 측정을 위한 마커 생성 (개발 환경에서만)
const createPerformanceMarker = (name, data = {}) => {
  if (process.env.NODE_ENV === 'development' && window.performance && window.performance.mark) {
    try {
      window.performance.mark(`sw:${name}`, { detail: data });
    } catch (err) {
      // 오류 무시 - 비필수 기능
    }
  }
};

// 디버그 로깅 유틸리티
const logDebug = (message, data = null, force = false) => {
  if ((process.env.NODE_ENV === 'development' || force) && navigator.serviceWorker) {
    const logPrefix = '[SW Registration]';
    
    if (data) {
      console.log(`${logPrefix} ${message}`, data);
    } else {
      console.log(`${logPrefix} ${message}`);
    }
  }
};

// 가용한 최적의 타이밍 함수 선택 (브라우저 호환성)
const getNonBlockingTimeout = (callback, delay) => {
  // requestIdleCallback 지원 확인
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: delay });
  }
  
  // setTimeout 폴백
  return setTimeout(callback, delay);
};

// 타이밍 함수 정리
const clearNonBlockingTimeout = (id) => {
  if (typeof window !== 'undefined') {
    if ('cancelIdleCallback' in window && typeof id === 'number') {
      window.cancelIdleCallback(id);
    } else {
      clearTimeout(id);
    }
  }
};

/**
 * 서비스 워커를 등록합니다. (최적화 버전)
 * @param {Object} config - 설정 옵션
 * @param {Function} config.onSuccess - 등록 성공 시 호출될 콜백
 * @param {Function} config.onUpdate - 업데이트 발견 시 호출될 콜백
 * @param {number} config.timeout - 등록 시간 제한 (밀리초)
 * @param {boolean} config.immediate - 즉시 등록 여부
 * @param {boolean} config.forceRegister - 개발 환경에서도 강제 등록
 * @returns {Promise<ServiceWorkerRegistration|null>} 서비스 워커 등록 객체 또는 null
 */
export function register(config = {}) {
  createPerformanceMarker('register:start');
  
  // 이미 진행 중인 경우 캐시된 등록 정보 반환
  if (registrationInProgress && cachedRegistration) {
    logDebug('등록이 이미 진행 중입니다. 캐시된 등록 정보 반환');
    return Promise.resolve(cachedRegistration);
  }

  // 기본 설정과 사용자 설정 병합
  const options = {
    ...CONFIG.DEFAULT_OPTIONS,
    ...config
  };

  // 서비스 워커 지원 확인
  if (!isServiceWorkerSupported) {
    logDebug('이 브라우저는 서비스 워커를 지원하지 않습니다.');
    return Promise.resolve(null);
  }
  
  // 프로덕션 환경이거나 강제 등록이 설정된 경우에만 등록
  const shouldRegister = process.env.NODE_ENV === 'production' || options.forceRegister;
  
  if (!shouldRegister) {
    logDebug('개발 환경에서는 서비스 워커가 기본적으로 비활성화되어 있습니다. 강제 등록을 위해 forceRegister: true 옵션을 사용하세요.');
    return Promise.resolve(null);
  }
  
  // 즉시 등록 또는 지연 등록
  if (options.immediate) {
    logDebug('즉시 등록 시작');
    return performRegistration(options);
  } else {
    logDebug('지연 등록 스케줄링');
    return scheduleRegistration(options);
  }
}

/**
 * 지연된 서비스 워커 등록을 스케줄링합니다.
 * 앱 로드 후 유휴 시간에 실행되도록 최적화되었습니다.
 * 
 * @param {Object} options - 등록 옵션
 * @returns {Promise<ServiceWorkerRegistration|null>} 서비스 워커 등록 객체 또는 null
 */
function scheduleRegistration(options) {
  return new Promise((resolve) => {
    createPerformanceMarker('scheduleRegistration:start');
    
    // 높은 우선순위 작업들이 완료된 후 등록
    const delay = options.delay || CONFIG.DEBOUNCE.MEDIUM;
    
    const registerWhenIdle = () => {
      logDebug('유휴 시간에 등록 수행');
      
      // 우선 순위 낮은 실행 스케줄링
      const timeoutId = getNonBlockingTimeout(() => {
        performRegistration(options).then(resolve);
      }, delay);
      
      // 60초 안전 타임아웃 설정 (브라우저 슬립/일시 중지 대비)
      setTimeout(() => {
        clearNonBlockingTimeout(timeoutId);
        performRegistration(options).then(resolve);
      }, 60000);
    };

    // 페이지 로드 완료 후 또는 즉시 실행
    if (document.readyState === 'complete') {
      registerWhenIdle();
    } else {
      // 이벤트 리스너 등록 및 자동 정리
      window.addEventListener('load', registerWhenIdle, { once: true });
    }
    
    createPerformanceMarker('scheduleRegistration:end');
  });
}

/**
 * 서비스 워커 등록을 수행합니다. (최적화 버전)
 * 오류 처리 및 재시도 로직이 포함되어 있습니다.
 * 
 * @param {Object} options - 설정 옵션
 * @returns {Promise<ServiceWorkerRegistration|null>} 서비스 워커 등록 객체 또는 null
 */
async function performRegistration(options) {
  createPerformanceMarker('performRegistration:start');
  
  if (registrationInProgress) {
    logDebug('이미 등록 진행 중');
    return cachedRegistration;
  }

  registrationInProgress = true;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  
  const tryRegistration = async () => {
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('서비스 워커 등록 시간 초과')), options.timeout);
    });

    try {
      logDebug(`서비스 워커 등록 시도 (${retryCount+1}/${MAX_RETRIES+1})`);
      
      // 서비스 워커 등록 시도 (타임아웃 적용)
      const registration = await Promise.race([
        navigator.serviceWorker.register(CONFIG.SERVICE_WORKER_URL, {
          scope: '/'
        }),
        timeoutPromise
      ]);

      logDebug('서비스 워커가 성공적으로 등록되었습니다:', CONFIG.SERVICE_WORKER_URL);
      cachedRegistration = registration;
      
      // 업데이트 확인 및 상태 변경 이벤트 처리
      setupUpdateHandler(registration, options);
      
      // 네트워크 상태 변경 핸들러 설정
      setupNetworkStatusHandler(registration);
      
      createPerformanceMarker('performRegistration:success');
      return registration;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        // 재시도
        retryCount++;
        logDebug(`등록 실패, ${CONFIG.DEBOUNCE.LONG}ms 후 재시도`, error);
        await new Promise(resolve => setTimeout(resolve, CONFIG.DEBOUNCE.LONG));
        return tryRegistration();
      }
      
      console.error('서비스 워커 등록 중 오류 발생:', error);
      createPerformanceMarker('performRegistration:error', { error: error.message });
      return null;
    }
  };
  
  try {
    return await tryRegistration();
  } finally {
    // 일정 시간 후 등록 상태 초기화 (중복 등록 방지를 위한 임시 상태)
    setTimeout(() => {
      registrationInProgress = false;
    }, 30000);
    
    createPerformanceMarker('performRegistration:end');
  }
}

/**
 * 서비스 워커 업데이트 핸들러 설정
 * 새 버전 감지 및 알림 처리를 담당합니다.
 * 
 * @param {ServiceWorkerRegistration} registration - 서비스 워커 등록 객체
 * @param {Object} options - 설정 옵션
 */
function setupUpdateHandler(registration, options) {
  createPerformanceMarker('setupUpdateHandler:start');
  
  // 업데이트 확인 및 상태 변경 이벤트 처리
  registration.onupdatefound = () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.onstatechange = () => {
      if (installingWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // 이미 기존 서비스 워커가 있고, 새 버전이 설치된 경우
          logDebug('새 버전의 서비스 워커가 설치되었습니다.');
          createPerformanceMarker('newWorkerInstalled');
          
          // 업데이트 콜백 호출 (비동기적으로 처리)
          if (options.onUpdate) {
            setTimeout(() => {
              try {
                options.onUpdate(registration);
              } catch (error) {
                console.error('onUpdate 콜백 처리 중 오류:', error);
              }
            }, 0);
          }
        } else {
          // 처음 설치된 경우
          logDebug('콘텐츠가 오프라인 사용을 위해 캐시되었습니다.');
          createPerformanceMarker('firstInstall');
          
          // 성공 콜백 호출 (비동기적으로 처리)
          if (options.onSuccess) {
            setTimeout(() => {
              try {
                options.onSuccess(registration);
              } catch (error) {
                console.error('onSuccess 콜백 처리 중 오류:', error);
              }
            }, 0);
          }
        }
      }
    };
  };
  
  // 1시간 간격으로 자동 업데이트 확인 (옵션 활성화된 경우)
  if (options.autoCheck) {
    const checkIntervalMs = options.checkInterval || CONFIG.DEFAULT_OPTIONS.checkInterval;
    
    // 주기적으로 업데이트 확인
    const intervalId = setInterval(() => {
      checkForUpdates(registration, { quietCheck: true })
        .catch(err => logDebug("자동 업데이트 확인 중 오류", err));
    }, checkIntervalMs);
    
    // 등록 객체에 인터벌 ID 저장 (나중에 정리하기 위해)
    registration._updateCheckInterval = intervalId;
  }
  
  createPerformanceMarker('setupUpdateHandler:end');
}

/**
 * 네트워크 상태 변경 시 서비스 워커에 통지
 * 
 * @param {ServiceWorkerRegistration} registration - 서비스 워커 등록 객체
 */
function setupNetworkStatusHandler(registration) {
  // 온라인/오프라인 상태 변경 핸들러
  const updateNetworkStatus = () => {
    try {
      if (registration.active) {
        registration.active.postMessage({
          type: 'NETWORK_STATUS_CHANGE',
          payload: { 
            online: navigator.onLine,
            timestamp: Date.now()
          }
        });
        logDebug(`네트워크 상태 변경 통지: ${navigator.onLine ? '온라인' : '오프라인'}`);
      }
    } catch (error) {
      // 오류 무시 - 비필수 기능
    }
  };
  
  // 초기 상태 알림
  updateNetworkStatus();
  
  // 이벤트 리스너 등록
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  
  // 정리 함수 등록
  if (!registration._cleanupFunctions) {
    registration._cleanupFunctions = [];
  }
  
  registration._cleanupFunctions.push(() => {
    window.removeEventListener('online', updateNetworkStatus);
    window.removeEventListener('offline', updateNetworkStatus);
  });
}

/**
 * 서비스 워커가 새 버전으로 업데이트되었을 때 호출할 함수입니다. (최적화 버전)
 * 캐싱 및 쓰로틀링 기능이 포함되어 있습니다.
 * 
 * @param {ServiceWorkerRegistration} [registration] - 서비스 워커 등록 객체
 * @param {Object} [options] - 옵션 객체
 * @param {boolean} [options.force=false] - 강제 업데이트 여부
 * @param {boolean} [options.quietCheck=false] - 조용한 모드(로깅 감소)
 * @param {number} [options.timeout=8000] - 타임아웃 시간(ms)
 * @returns {Promise<boolean>} 업데이트 확인 성공 여부
 */
export async function checkForUpdates(registration, options = {}) {
  createPerformanceMarker('checkForUpdates:start');
  
  // 중복 호출 방지
  if (updateCheckInProgress) {
    logDebug('업데이트 확인이 이미 진행 중입니다.');
    return false;
  }
  
  // 옵션 정규화
  const opts = {
    force: false,
    quietCheck: false,
    timeout: 8000,
    ...options
  };
  
  try {
    updateCheckInProgress = true;
    
    // 등록 정보 가져오기
    if (!registration) {
      try {
        registration = await getRegistration({ timeout: opts.timeout / 2 });
      } catch (err) {
        logDebug('등록 정보를 가져오는 중 오류 발생', err, !opts.quietCheck);
        return false;
      }
      
      if (!registration) {
        logDebug('활성화된 서비스 워커가 없습니다.', null, !opts.quietCheck);
        return false;
      }
    }
    
    // 쓰로틀링: 마지막 확인으로부터 10분이 경과하지 않은 경우 건너뛰기
    const now = Date.now();
    if (!opts.force && now - lastUpdateCheckTime < 10 * 60 * 1000) {
      logDebug('최근에 이미 업데이트를 확인했습니다. 강제 확인하려면 force 옵션을 사용하세요.', 
        { lastCheck: new Date(lastUpdateCheckTime).toISOString() }, 
        !opts.quietCheck
      );
      return false;
    }
    
    // 마지막 업데이트 확인 시간 기록
    lastUpdateCheckTime = now;
    
    // 업데이트 확인 전 네트워크 연결 확인
    if (!navigator.onLine) {
      logDebug('오프라인 상태에서는 업데이트를 확인할 수 없습니다.', null, !opts.quietCheck);
      return false;
    }
    
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('업데이트 확인 시간 초과')), opts.timeout);
    });
    
    // 업데이트 확인 요청
    logDebug('서비스 워커 업데이트 확인 중...', null, !opts.quietCheck);
    await Promise.race([registration.update(), timeoutPromise]);
    
    logDebug('서비스 워커 업데이트 확인 완료', null, !opts.quietCheck);
    createPerformanceMarker('checkForUpdates:success');
    return true;
  } catch (error) {
    // AbortError 오류는 무시(사용자가 페이지를 나간 경우)
    if (error.name === 'AbortError') {
      logDebug('업데이트 확인이 취소되었습니다.', null, !opts.quietCheck);
      return false;
    }
    
    console.error('서비스 워커 업데이트 확인 중 오류 발생:', error);
    createPerformanceMarker('checkForUpdates:error', { error: error.message });
    return false;
  } finally {
    updateCheckInProgress = false;
    createPerformanceMarker('checkForUpdates:end');
  }
}

/**
 * 서비스 워커 강제 활성화 (최적화 버전)
 * 새 버전 서비스 워커가 waiting 상태일 때 즉시 활성화합니다.
 * 재시도 로직과 사용자 알림 기능이 개선되었습니다.
 * 
 * @param {Object} [options] - 옵션 객체
 * @param {boolean} [options.autoReload=false] - 활성화 후 자동으로 페이지 새로고침 여부
 * @param {boolean} [options.promptReload=true] - 활성화 후 사용자에게 새로고침 확인 여부
 * @param {number} [options.maxWaitTime=15000] - 최대 대기 시간(ms)
 * @returns {Promise<boolean>} 활성화 성공 여부
 */
export async function forceActivateServiceWorker(options = {}) {
  createPerformanceMarker('forceActivate:start');
  
  // 옵션 정규화
  const opts = {
    autoReload: false,
    promptReload: true,
    maxWaitTime: 15000,
    ...options
  };
  
  try {
    // 등록 정보 가져오기
    const registration = await getRegistration();
    if (!registration) {
      logDebug('활성화된 서비스 워커가 없습니다.');
      return false;
    }

    // 대기 중인 새 서비스 워커 확인
    if (!registration.waiting) {
      logDebug('대기 중인 서비스 워커가 없습니다.');
      return false;
    }
    
    logDebug('대기 중인 서비스 워커 활성화 시도');
    
    // 활성화 상태 추적 변수
    let activated = false;
    
    // 컨트롤러 변경 모니터링
    const controllerChangePromise = new Promise((resolve) => {
      // 활성화 타임아웃 설정
      const activationTimeout = setTimeout(() => {
        if (!activated) {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          logDebug('서비스 워커 활성화 시간 초과');
          resolve(false);
        }
      }, opts.maxWaitTime);
      
      // 컨트롤러 변경 이벤트 핸들러
      const onControllerChange = () => {
        clearTimeout(activationTimeout);
        activated = true;
        logDebug('새 서비스 워커가 활성화되었습니다.');
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        resolve(true);
      };
      
      // 이벤트 리스너 등록
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    });

    // 대기 중인 워커에게 skipWaiting 메시지 전송
    registration.waiting.postMessage({ 
      type: 'SKIP_WAITING', 
      payload: { timestamp: Date.now() } 
    });
    
    // 활성화 대기
    const success = await controllerChangePromise;
    
    // 활성화 성공 여부에 따른 처리
    if (success) {
      createPerformanceMarker('forceActivate:success');
      
      // 자동 또는 확인 후 페이지 새로고침
      if (opts.autoReload === true) {
        // 자동 새로고침
        window.location.reload();
      } else if (opts.promptReload !== false) {
        // 사용자 확인 후 새로고침 (기본값)
        if (window.confirm('새 버전이 준비되었습니다. 페이지를 새로고침할까요?')) {
          window.location.reload();
        }
      }
    } else {
      createPerformanceMarker('forceActivate:timeout');
    }
    
    return success;
  } catch (error) {
    console.error('서비스 워커 업데이트 적용 중 오류 발생:', error);
    createPerformanceMarker('forceActivate:error', { error: error.message });
    return false;
  } finally {
    createPerformanceMarker('forceActivate:end');
  }
}

/**
 * 서비스 워커 등록 취소 (최적화 버전)
 * 중복 호출 방지 및 타임아웃 추가, 정리 함수 호출을 포함합니다.
 * 
 * @param {Object} [options] - 옵션 객체
 * @param {number} [options.timeout=5000] - 타임아웃 (밀리초)
 * @param {boolean} [options.clearCache=false] - 캐시 데이터 삭제 여부
 * @returns {Promise<boolean>} 등록 취소 성공 여부
 */
export async function unregister(options = {}) {
  createPerformanceMarker('unregister:start');
  
  // 서비스 워커 지원 확인
  if (!isServiceWorkerSupported) {
    return false;
  }
  
  // 옵션 정규화
  const opts = {
    timeout: 5000,
    clearCache: false,
    ...options
  };
  
  // 정적 변수로 진행 중인 작업 추적
  if (window._swUnregisterPromise) {
    return window._swUnregisterPromise;
  }
  
  const unregisterPromise = (async () => {
    try {
      // 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('서비스 워커 등록 취소 시간 초과')), opts.timeout);
      });
      
      // 등록 정보 가져오기
      const registration = await Promise.race([
        getRegistration({ timeout: opts.timeout / 2 }),
        timeoutPromise
      ]);
      
      if (registration) {
        // 정리 함수 호출
        if (registration._cleanupFunctions) {
          for (const cleanup of registration._cleanupFunctions) {
            try {
              if (typeof cleanup === 'function') {
                cleanup();
              }
            } catch (err) {
              // 정리 함수 오류 무시
            }
          }
          registration._cleanupFunctions = [];
        }
        
        // 업데이트 확인 인터벌 정리
        if (registration._updateCheckInterval) {
          clearInterval(registration._updateCheckInterval);
          registration._updateCheckInterval = null;
        }
        
        // 등록 취소 (타임아웃 적용)
        const success = await Promise.race([
          registration.unregister(),
          timeoutPromise
        ]);
        
        // 캐시 삭제 (옵션에 따라)
        if (success && opts.clearCache && 'caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            );
            logDebug('모든 캐시가 삭제되었습니다.');
          } catch (cacheError) {
            console.warn('캐시 삭제 중 오류:', cacheError);
          }
        }
        
        logDebug(success 
          ? '서비스 워커 등록이 취소되었습니다.' 
          : '서비스 워커 등록 취소 실패'
        );
        
        // 상태 캐시 초기화
        cachedStatus = null;
        cachedRegistration = null;
        
        createPerformanceMarker('unregister:' + (success ? 'success' : 'failure'));
        return success;
      }
      
      logDebug('등록된 서비스 워커가 없습니다.');
      return true;
    } catch (error) {
      console.error('서비스 워커 등록 취소 중 오류 발생:', error);
      createPerformanceMarker('unregister:error', { error: error.message });
      return false;
    } finally {
      // 진행 상태 초기화
      setTimeout(() => {
        window._swUnregisterPromise = null;
      }, 1000);
      
      createPerformanceMarker('unregister:end');
    }
  })();
  
  // 진행 중인 작업 저장
  window._swUnregisterPromise = unregisterPromise;
  
  return unregisterPromise;
}

/**
 * 현재 활성화된 서비스 워커 등록 객체 가져오기 (최적화 버전)
 * 오류 처리, 캐싱 및 타임아웃 추가했습니다.
 * 
 * @param {Object} [options] - 옵션 객체
 * @param {number} [options.timeout=3000] - 타임아웃 (밀리초)
 * @param {boolean} [options.bypassCache=false] - 캐시 우회 여부
 * @returns {Promise<ServiceWorkerRegistration|null>} 서비스 워커 등록 객체 또는 null
 */
export async function getRegistration(options = {}) {
  createPerformanceMarker('getRegistration:start');
  
  // 서비스 워커 지원 확인
  if (!isServiceWorkerSupported) {
    return null;
  }
  
  // 옵션 정규화
  const opts = {
    timeout: 3000,
    bypassCache: false,
    ...options
  };
  
  // 캐시 사용 (특별히 우회하도록 지정하지 않은 경우)
  if (!opts.bypassCache && cachedRegistration) {
    return cachedRegistration;
  }
  
  try {
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('서비스 워커 등록 정보 가져오기 시간 초과')), opts.timeout);
    });
    
    // 등록 정보 가져오기 (타임아웃 적용)
    const registration = await Promise.race([
      navigator.serviceWorker.getRegistration(CONFIG.SERVICE_WORKER_URL),
      timeoutPromise
    ]);
    
    // 캐시 업데이트
    if (registration) {
      cachedRegistration = registration;
      
      // 업데이트 확인 시간 동기화
      if (registration._lastUpdateCheck) {
        lastUpdateCheckTime = registration._lastUpdateCheck;
      } else {
        registration._lastUpdateCheck = lastUpdateCheckTime;
      }
    }
    
    createPerformanceMarker('getRegistration:' + (registration ? 'found' : 'notFound'));
    return registration;
  } catch (error) {
    console.error('서비스 워커 등록 정보 가져오기 실패:', error);
    createPerformanceMarker('getRegistration:error', { error: error.message });
    return null;
  } finally {
    createPerformanceMarker('getRegistration:end');
  }
}

/**
 * 서비스 워커 상태 확인 (최적화 버전)
 * 캐싱 및 비동기 처리 개선했습니다.
 * 
 * @param {Object} [options] - 옵션 객체
 * @param {number} [options.timeout=3000] - 타임아웃 (밀리초)
 * @param {boolean} [options.detailed=false] - 상세 정보 반환 여부
 * @param {boolean} [options.bypassCache=false] - 캐시 우회 여부
 * @returns {Promise<Object>} 서비스 워커 상태 정보
 */
export async function getServiceWorkerStatus(options = {}) {
  createPerformanceMarker('getStatus:start');
  
  // 옵션 정규화
  const opts = {
    timeout: 3000,
    detailed: false,
    bypassCache: false,
    ...options
  };
  
  // 캐시된 상태 확인 (캐시 활성화된 경우)
  if (!opts.bypassCache && cachedStatus && Date.now() - statusCacheTime < 10000) {
    return cachedStatus;
  }
  
  // 지원하지 않는 경우 빠른 응답
  if (!isServiceWorkerSupported) {
    const status = {
      supported: false,
      active: false,
      registration: null,
      version: null,
      controller: null
    };
    
    // 캐시 업데이트
    cachedStatus = status;
    statusCacheTime = Date.now();
    
    return status;
  }

  try {
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('상태 확인 시간 초과')), opts.timeout);
    });
    
    // 등록 정보 가져오기 (타임아웃 적용)
    const registration = await Promise.race([
      getRegistration({ timeout: opts.timeout, bypassCache: opts.bypassCache }),
      timeoutPromise
    ]);
    
    // 기본 상태 정보
    const baseStatus = {
      supported: true,
      active: !!registration && !!navigator.serviceWorker.controller,
      controller: navigator.serviceWorker.controller
    };
    
    // 상세 정보가 필요한 경우에만 추가 정보 제공
    let status;
    if (opts.detailed) {
      // 버전 정보 추출
      let version = null;
      if (registration?.active?.scriptURL) {
        // 쿼리 매개변수에서 버전 추출 시도 (예: ?v=1.2.3)
        try {
          const scriptURL = new URL(registration.active.scriptURL);
          version = scriptURL.searchParams.get('v') || scriptURL.searchParams.get('version');
          
          // 버전 정보가 없으면 타임스탬프 사용
          if (!version) {
            const cacheBustParam = scriptURL.searchParams.get('_') || scriptURL.searchParams.get('t');
            if (cacheBustParam) {
              version = `timestamp:${cacheBustParam}`;
            }
          }
          
          // 최후의 수단으로 전체 URL 사용
          if (!version) {
            version = registration.active.scriptURL;
          }
        } catch (e) {
          version = registration?.active?.scriptURL;
        }
      }
      
      status = {
        ...baseStatus,
        registration: registration,
        scriptURL: registration?.active?.scriptURL,
        version,
        waiting: !!registration?.waiting,
        installing: !!registration?.installing,
        pendingUpdate: !!registration?.waiting,
        lastUpdateCheck: lastUpdateCheckTime > 0 ? new Date(lastUpdateCheckTime).toISOString() : null,
        scope: registration?.scope,
        clientsCount: registration?._clientsCount,
        pushEnabled: !!(registration && await canSubscribeToPush()),
        pushSubscription: registration ? await getPushSubscription(registration) : null
      };
    } else {
      status = baseStatus;
    }
    
    // 캐시 업데이트
    cachedStatus = status;
    statusCacheTime = Date.now();
    
    createPerformanceMarker('getStatus:success');
    return status;
  } catch (error) {
    console.error('서비스 워커 상태 확인 중 오류 발생:', error);
    createPerformanceMarker('getStatus:error', { error: error.message });
    
    // 오류 발생 시 기본 정보만 반환
    return {
      supported: true,
      active: false,
      error: error.message
    };
  } finally {
    createPerformanceMarker('getStatus:end');
  }
}

/**
 * 오프라인 상태 확인
 * 속도와 정확성을 위해 최적화되었습니다.
 * 
 * @returns {boolean} 오프라인 상태 여부
 */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * 네트워크 상태 모니터링 (최적화 버전)
 * 디바운싱 및 이벤트 관리 개선했습니다.
 * 
 * @param {Function} onOnline - 온라인 상태로 변경 시 콜백
 * @param {Function} onOffline - 오프라인 상태로 변경 시 콜백
 * @param {Object} [options] - 옵션 객체
 * @param {number} [options.debounceTime=300] - 디바운스 시간 (밀리초)
 * @param {boolean} [options.notifyServiceWorker=true] - 서비스 워커에 상태 변경 알림 여부
 * @returns {Function} 이벤트 리스너 제거 함수
 */
export function monitorNetworkStatus(onOnline, onOffline, options = {}) {
  createPerformanceMarker('monitorNetwork:start');
  
  // 옵션 정규화
  const opts = {
    debounceTime: CONFIG.DEBOUNCE.SHORT,
    notifyServiceWorker: true,
    ...options
  };
  
  // 디바운스 구현을 위한 타이머 변수
  let onlineTimer = null;
  let offlineTimer = null;
  
  // 온라인 상태 변경 핸들러
  const handleOnline = () => {
    // 오프라인 타이머 취소
    if (offlineTimer) {
      clearTimeout(offlineTimer);
      offlineTimer = null;
    }
    
    // 이미 온라인 타이머가 있는 경우 재설정
    if (onlineTimer) {
      clearTimeout(onlineTimer);
    }
    
    // 디바운스 적용
    onlineTimer = setTimeout(() => {
      logDebug('네트워크 연결됨');
      
      // 콜백 처리 (오류 처리 포함)
      if (onOnline) {
        try {
          onOnline();
        } catch (error) {
          console.error('온라인 콜백 처리 중 오류:', error);
        }
      }
      
      // 서비스 워커에 온라인 상태 알림 (옵션에 따라)
      if (opts.notifyServiceWorker) {
        notifyServiceWorkerOfNetworkChange(true)
          .catch(err => console.warn('서비스 워커 알림 실패:', err));
      }
    }, opts.debounceTime);
  };
  
  // 오프라인 상태 변경 핸들러
  const handleOffline = () => {
    // 온라인 타이머 취소
    if (onlineTimer) {
      clearTimeout(onlineTimer);
      onlineTimer = null;
    }
    
    // 이미 오프라인 타이머가 있는 경우 재설정
    if (offlineTimer) {
      clearTimeout(offlineTimer);
    }
    
    // 디바운스 적용
    offlineTimer = setTimeout(() => {
      logDebug('네트워크 연결 끊김');
      
      // 콜백 처리 (오류 처리 포함)
      if (onOffline) {
        try {
          onOffline();
        } catch (error) {
          console.error('오프라인 콜백 처리 중 오류:', error);
        }
      }
      
      // 서비스 워커에 오프라인 상태 알림 (옵션에 따라)
      if (opts.notifyServiceWorker) {
        notifyServiceWorkerOfNetworkChange(false)
          .catch(err => console.warn('서비스 워커 알림 실패:', err));
      }
    }, opts.debounceTime);
  };
  
  // 이벤트 리스너 등록
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // 현재 상태 확인 및 초기 콜백 실행 (비동기적으로 처리)
  setTimeout(() => {
    const isCurrentlyOnline = navigator.onLine;
    if (isCurrentlyOnline && onOnline) {
      try {
        onOnline();
      } catch (error) {
        console.error('초기 온라인 콜백 처리 중 오류:', error);
      }
    } else if (!isCurrentlyOnline && onOffline) {
      try {
        onOffline();
      } catch (error) {
        console.error('초기 오프라인 콜백 처리 중 오류:', error);
      }
    }
  }, 0);
  
  // 이벤트 리스너 제거 함수 반환
  createPerformanceMarker('monitorNetwork:end');
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    
    // 타이머 정리
    if (onlineTimer) {
      clearTimeout(onlineTimer);
    }
    if (offlineTimer) {
      clearTimeout(offlineTimer);
    }
  };
}

/**
 * 서비스 워커에 네트워크 상태 변경 알림 (최적화 버전)
 * 비동기 처리 및 오류 처리 개선했습니다.
 * 
 * @param {boolean} isOnline - 온라인 상태 여부
 * @param {Object} [options] - 옵션 객체
 * @param {number} [options.timeout=500] - 타임아웃 (밀리초)
 * @returns {Promise<void>}
 */
async function notifyServiceWorkerOfNetworkChange(isOnline, options = {}) {
  createPerformanceMarker('notifyServiceWorker:start', { isOnline });
  
  // 옵션 정규화
  const opts = {
    timeout: 500,
    ...options
  };
  
  // 서비스 워커를 지원하지 않는 경우 빠른 반환
  if (!isServiceWorkerSupported) {
    return;
  }
  
  try {
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('등록 정보 가져오기 시간 초과')), opts.timeout);
    });
    
    // 등록 정보 가져오기 (타임아웃 적용)
    const registration = await Promise.race([
      getRegistration({ timeout: opts.timeout, bypassCache: false }),
      timeoutPromise
    ]);
    
    if (registration && registration.active) {
      // 활성 서비스 워커에 메시지 전송
      registration.active.postMessage({
        type: 'NETWORK_STATUS',
        payload: {
          isOnline,
          timestamp: Date.now()
        }
      });
      
      logDebug(`서비스 워커에 네트워크 상태 변경 알림: ${isOnline ? '온라인' : '오프라인'}`);
      createPerformanceMarker('notifyServiceWorker:success');
    }
  } catch (error) {
    // 타임아웃 오류는 정보 메시지로만 기록
    if (error.message.includes('시간 초과')) {
      logDebug('서비스 워커 알림 시간 초과 (무시됨)');
    } else {
      console.debug('서비스 워커에 네트워크 상태 알림 중 오류 발생 (무시됨):', error);
    }
    
    createPerformanceMarker('notifyServiceWorker:error', { error: error.message });
  } finally {
    createPerformanceMarker('notifyServiceWorker:end');
  }
}

/**
 * 애플리케이션이 PWA로 설치되었는지 확인
 * 
 * @returns {boolean} PWA로 설치되었는지 여부
 */
export function isInstalledAsPWA() {
  // display-mode 미디어 쿼리 확인
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // iOS에서 Safari와 스탠드얼론 웹앱 구분
  if (navigator.standalone === true) {
    return true;
  }
  
  // Android/Chrome 앱 내 표시 확인
  if (window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches) {
    return true;
  }
  
  // localStorage 확인 (설치 후 페이지 새로고침 케이스 처리)
  if (typeof localStorage !== 'undefined' && localStorage.getItem('isPWAInstalled') === 'true') {
    return true;
  }
  
  return false;
}

/**
 * 브라우저가 푸시 알림 구독을 지원하는지 확인
 * 
 * @returns {Promise<boolean>} 푸시 알림 지원 여부
 */
export async function canSubscribeToPush() {
  if (!isServiceWorkerSupported) {
    return false;
  }
  
  try {
    // 알림 권한 확인
    const permission = await checkNotificationPermission();
    if (permission !== CONFIG.PUSH_NOTIFICATION.PERMISSION_GRANTED) {
      return false;
    }
    
    // 서비스 워커 등록 확인
    const registration = await getRegistration();
    if (!registration) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('푸시 구독 지원 확인 중 오류:', error);
    return false;
  }
}

/**
 * 사용자에게 알림 허용 요청
 * 
 * @returns {Promise<string>} 알림 권한 상태 (granted, denied, default)
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('알림 권한 요청 중 오류:', error);
    return 'error';
  }
}

/**
 * 현재 알림 권한 상태 확인
 * 
 * @returns {Promise<string>} 알림 권한 상태 (granted, denied, default)
 */
export async function checkNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  
  return Notification.permission;
}

/**
 * 푸시 알림 구독하기
 * 
 * @param {Object} [options] - 구독 옵션
 * @param {boolean} [options.userVisibleOnly=true] - 사용자에게 표시되는 알림만 보내기
 * @param {string} [options.applicationServerKey] - VAPID 공개 키 (Base64-encoded)
 * @returns {Promise<PushSubscription|null>} 구독 정보 또는 null
 */
export async function subscribeToPushNotifications(options = {}) {
  if (!isServiceWorkerSupported) {
    console.error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
    return null;
  }
  
  try {
    // 알림 권한 확인
    const permission = await checkNotificationPermission();
    if (permission !== CONFIG.PUSH_NOTIFICATION.PERMISSION_GRANTED) {
      const requestedPermission = await requestNotificationPermission();
      if (requestedPermission !== CONFIG.PUSH_NOTIFICATION.PERMISSION_GRANTED) {
        console.log('알림 권한이 거부되었습니다.');
        return null;
      }
    }
    
    // 서비스 워커 등록 확인
    const registration = await getRegistration();
    if (!registration) {
      console.error('푸시 구독을 위한 서비스 워커 등록이 없습니다.');
      return null;
    }
    
    // 기존 구독 확인
    const existingSubscription = await getPushSubscription(registration);
    if (existingSubscription) {
      console.log('이미 푸시 알림을 구독 중입니다.');
      return existingSubscription;
    }
    
    // VAPID 키 확인
    const applicationServerKey = options.applicationServerKey || 
                                CONFIG.PUSH_NOTIFICATION.PUBLIC_VAPID_KEY;
    
    if (!applicationServerKey) {
      console.error('푸시 구독을 위한 애플리케이션 서버 키가 필요합니다.');
      return null;
    }
    
    // 구독 옵션 생성
    const convertedKey = urlBase64ToUint8Array(applicationServerKey);
    const subscribeOptions = {
      userVisibleOnly: options.userVisibleOnly !== false,
      applicationServerKey: convertedKey
    };
    
    // 구독 생성
    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('푸시 알림 구독 성공:', subscription);
    
    // 캐시 업데이트
    cachedPushSubscription = subscription;
    
    return subscription;
  } catch (error) {
    console.error('푸시 알림 구독 중 오류:', error);
    return null;
  }
}

/**
 * 푸시 알림 구독 취소
 * 
 * @returns {Promise<boolean>} 구독 취소 성공 여부
 */
export async function unsubscribeFromPushNotifications() {
  if (!isServiceWorkerSupported) {
    return false;
  }
  
  try {
    // 서비스 워커 등록 확인
    const registration = await getRegistration();
    if (!registration) {
      return false;
    }
    
    // 기존 구독 확인
    const subscription = await getPushSubscription(registration);
    if (!subscription) {
      console.log('푸시 알림 구독 정보가 없습니다.');
      return true;
    }
    
    // 구독 취소
    const result = await subscription.unsubscribe();
    console.log('푸시 알림 구독 취소 성공:', result);
    
    // 캐시 초기화
    cachedPushSubscription = null;
    
    return result;
  } catch (error) {
    console.error('푸시 알림 구독 취소 중 오류:', error);
    return false;
  }
}

/**
 * 현재 푸시 알림 구독 정보 가져오기
 * 
 * @param {ServiceWorkerRegistration} [registration] - 서비스 워커 등록 객체
 * @returns {Promise<PushSubscription|null>} 구독 정보 또는 null
 */
export async function getPushSubscription(registration = null) {
  // 캐시된 구독 정보가 있으면 사용
  if (cachedPushSubscription) {
    return cachedPushSubscription;
  }
  
  if (!isServiceWorkerSupported) {
    return null;
  }
  
  try {
    // 등록 정보 없으면 가져오기
    if (!registration) {
      registration = await getRegistration();
      if (!registration) {
        return null;
      }
    }
    
    // 구독 정보 가져오기
    const subscription = await registration.pushManager.getSubscription();
    cachedPushSubscription = subscription;
    
    return subscription;
  } catch (error) {
    console.error('푸시 알림 구독 정보 가져오기 중 오류:', error);
    return null;
  }
}

/**
 * URL Base64 문자열을 Uint8Array로 변환 (VAPID 키 처리용)
 * 
 * @param {string} base64String - Base64 인코딩된 문자열
 * @returns {Uint8Array} 변환된 배열
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

/**
 * 서비스 워커에게 테스트 푸시 알림 전송 요청
 * 
 * @param {Object} [options] - 알림 옵션
 * @param {string} [options.title='테스트 알림'] - 알림 제목
 * @param {string} [options.body='이것은 테스트 알림입니다.'] - 알림 내용
 * @param {string} [options.icon='/icons/icon-192x192.png'] - 알림 아이콘
 * @param {string} [options.tag='test-notification'] - 알림 태그
 * @returns {Promise<boolean>} 알림 전송 성공 여부
 */
export async function sendTestNotification(options = {}) {
  if (!isServiceWorkerSupported) {
    return false;
  }
  
  try {
    // 서비스 워커 등록 확인
    const registration = await getRegistration();
    if (!registration || !registration.active) {
      return false;
    }
    
    // 알림 옵션 설정
    const notificationOptions = {
      title: options.title || '테스트 알림',
      body: options.body || '이것은 테스트 알림입니다.',
      icon: options.icon || '/icons/icon-192x192.png',
      tag: options.tag || 'test-notification',
      timestamp: Date.now()
    };
    
    // 서비스 워커에 메시지 전송
    registration.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: notificationOptions
    });
    
    return true;
  } catch (error) {
    console.error('테스트 알림 전송 중 오류:', error);
    return false;
  }
}

/**
 * 백그라운드 동기화 등록 (네트워크가 없을 때 데이터 동기화를 위한 기능)
 * 
 * @param {string} tag - 동기화 태그
 * @param {Object} [options] - 동기화 옵션
 * @param {number} [options.maxRetries=3] - 최대 재시도 횟수
 * @returns {Promise<boolean>} 등록 성공 여부
 */
export async function registerBackgroundSync(tag, options = {}) {
  if (!isServiceWorkerSupported || !('SyncManager' in window)) {
    console.log('이 브라우저는 백그라운드 동기화를 지원하지 않습니다.');
    return false;
  }
  
  try {
    // 서비스 워커 등록 확인
    const registration = await getRegistration();
    if (!registration) {
      return false;
    }
    
    // 동기화 등록
    await registration.sync.register(tag, options);
    console.log(`백그라운드 동기화 등록 성공: ${tag}`);
    return true;
  } catch (error) {
    console.error('백그라운드 동기화 등록 중 오류:', error);
    return false;
  }
}

/**
 * 백그라운드 동기화 상태 확인
 * 
 * @param {string} tag - 동기화 태그
 * @returns {Promise<boolean>} 해당 태그의 동기화가 등록되어 있는지 여부
 */
export async function isBackgroundSyncRegistered(tag) {
  if (!isServiceWorkerSupported || !('SyncManager' in window)) {
    return false;
  }
  
  try {
    // 서비스 워커 등록 확인
    const registration = await getRegistration();
    if (!registration) {
      return false;
    }
    
    // 동기화 태그 확인
    const tags = await registration.sync.getTags();
    return tags.includes(tag);
  } catch (error) {
    console.error('백그라운드 동기화 상태 확인 중 오류:', error);
    return false;
  }
}

/**
 * 오프라인용 데이터 캐시
 * 
 * @param {string} cacheName - 캐시 이름
 * @param {string} url - 캐시할 URL
 * @param {Object} [options] - 캐시 옵션
 * @param {boolean} [options.force=false] - 기존 캐시 무시하고 강제 갱신
 * @returns {Promise<Response|null>} 캐시된 응답 또는 null
 */
export async function cacheForOffline(cacheName, url, options = {}) {
  if (!('caches' in window)) {
    return null;
  }
  
  try {
    const cache = await caches.open(cacheName);
    
    // 강제 갱신 옵션이 아니면 기존 캐시 확인
    if (!options.force) {
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // 네트워크 요청 보내고 캐시에 저장
    const response = await fetch(url);
    if (response.ok) {
      cache.put(url, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('오프라인 캐싱 중 오류:', error);
    return null;
  }
}

/**
 * PWA 설치 이벤트 감지 및 트래킹
 * 
 * @param {Function} onBeforeInstall - 설치 전 이벤트 콜백
 * @param {Function} onInstallAccepted - 설치 수락 콜백
 * @param {Function} onInstallRejected - 설치 거부 콜백
 * @returns {Function} 이벤트 리스너 제거 함수
 */
export function trackPWAInstallEvents(onBeforeInstall, onInstallAccepted, onInstallRejected) {
  // beforeinstallprompt 이벤트 핸들러
  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault();
    
    if (onBeforeInstall) {
      onBeforeInstall(e);
    }
    
    // 설치 수락/거부 처리
    if (e.userChoice) {
      e.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          logDebug('사용자가 앱 설치를 수락했습니다.');
          
          if (onInstallAccepted) {
            onInstallAccepted();
          }
        } else {
          logDebug('사용자가 앱 설치를 거부했습니다.');
          
          if (onInstallRejected) {
            onInstallRejected();
          }
        }
      });
    }
  };
  
  // appinstalled 이벤트 핸들러
  const handleAppInstalled = (e) => {
    logDebug('앱이 설치되었습니다.', e);
    
    // 설치 완료 시 로컬 스토리지에 표시
    try {
      localStorage.setItem('isPWAInstalled', 'true');
      localStorage.setItem('hasPWALaunched', 'true');
      localStorage.setItem('pwaInstalledAt', Date.now().toString());
    } catch (error) {
      console.warn('로컬 스토리지 접근 오류:', error);
    }
  };
  
  // 이벤트 리스너 등록
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  
  // 정리 함수 반환
  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}

/**
 * 서비스 워커 메시지 전송
 * 
 * @param {string} type - 메시지 유형
 * @param {Object} payload - 메시지 데이터
 * @returns {Promise<boolean>} 메시지 전송 성공 여부
 */
export async function sendMessageToServiceWorker(type, payload = {}) {
  if (!isServiceWorkerSupported) {
    return false;
  }
  
  try {
    const registration = await getRegistration();
    if (!registration || !registration.active) {
      return false;
    }
    
    registration.active.postMessage({
      type,
      payload: {
        ...payload,
        timestamp: Date.now()
      }
    });
    
    return true;
  } catch (error) {
    console.error('서비스 워커에 메시지 전송 중 오류:', error);
    return false;
  }
}

/**
 * 앱 버전 확인 (서비스 워커에서 제공하는 버전 정보)
 * 
 * @returns {Promise<string|null>} 앱 버전 또는 null
 */
export async function getAppVersion() {
  try {
    const status = await getServiceWorkerStatus({ detailed: true });
    return status.version || null;
  } catch (error) {
    console.error('앱 버전 확인 중 오류:', error);
    return null;
  }
}

// 모든 함수 내보내기
const serviceWorkerUtils = {
  register,
  unregister,
  checkForUpdates,
  forceActivateServiceWorker,
  getRegistration,
  getServiceWorkerStatus,
  isOffline,
  monitorNetworkStatus,
  isInstalledAsPWA,
  isLocalhost,
  isServiceWorkerSupported,
  canSubscribeToPush,
  requestNotificationPermission,
  checkNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getPushSubscription,
  sendTestNotification,
  registerBackgroundSync,
  isBackgroundSyncRegistered,
  cacheForOffline,
  trackPWAInstallEvents,
  sendMessageToServiceWorker,
  getAppVersion
};

export default serviceWorkerUtils;
