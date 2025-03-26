// src/utils/browserDetection.js

/**
 * 브라우저 감지 및 기능 호환성 테스트 유틸리티
 * 
 * 이 모듈은 다음 기능을 제공합니다:
 * 1. 현재 브라우저 및 버전 감지
 * 2. 기기 유형 감지 (모바일, 태블릿, 데스크톱)
 * 3. 특정 브라우저 기능 지원 여부 확인
 * 4. 브라우저 호환성 경고 및 제안 기능
 * 5. 성능 관련 측정 및 최적화 힌트
 */

// 브라우저 정보 캐싱 (불필요한 중복 계산 방지)
let cachedBrowserInfo = null;
let cachedDeviceInfo = null;
let cachedFeatureSupport = {};
let cachedPerformanceGrade = null;

// 최소 지원 브라우저 버전 (src/config/supportedBrowsers.js에서 import 하는 것이 이상적이나,
// 순환 참조 방지를 위해 여기에도 정의)
const MINIMUM_BROWSER_VERSIONS = {
  chrome: 90,
  firefox: 88,
  safari: 14,
  edge: 90,
  opera: 76,
  samsung: 15,
  ie: false // 지원하지 않음
};

// 모바일 브라우저 UA 패턴
const MOBILE_BROWSER_PATTERNS = [
  /Android/i,
  /webOS/i,
  /iPhone/i,
  /iPad/i,
  /iPod/i,
  /BlackBerry/i,
  /Windows Phone/i,
  /Samsung/i,
  /Mobile/i
];

// 태블릿 패턴 (태블릿만의 고유한 특징을 가진 패턴)
const TABLET_PATTERNS = [
  /iPad/i,
  /Android(?!.*Mobile)/i,
  /Tablet/i
];

/**
 * 현재 브라우저 정보 감지
 * @param {boolean} [bypassCache=false] - 캐시를 우회하고 다시 계산할지 여부
 * @returns {Object} 브라우저 이름, 버전, 엔진 등 정보
 */
export function detectBrowser(bypassCache = false) {
  // 캐시된 정보가 있고, 캐시를 우회하지 않는 경우 캐시된 정보 반환
  if (cachedBrowserInfo && !bypassCache) {
    return cachedBrowserInfo;
  }
  
  const ua = navigator.userAgent;
  let browserName = 'unknown';
  let browserVersion = 'unknown';
  let engineName = 'unknown';
  let engineVersion = 'unknown';
  let osName = 'unknown';
  let osVersion = 'unknown';
  
  // 브라우저 및 엔진 감지
  
  // Chrome
  if (/Chrome/.test(ua) && !/Chromium|Edge|Edg|OPR|SamsungBrowser/.test(ua)) {
    browserName = 'chrome';
    const match = ua.match(/Chrome\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // Firefox
  else if (/Firefox/.test(ua)) {
    browserName = 'firefox';
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // Safari
  else if (/Safari/.test(ua) && !/Chrome|Chromium|Edge|Edg|OPR|SamsungBrowser/.test(ua)) {
    browserName = 'safari';
    const match = ua.match(/Version\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // Edge (Chromium based)
  else if (/Edg/.test(ua)) {
    browserName = 'edge';
    const match = ua.match(/Edg\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // Legacy Edge
  else if (/Edge/.test(ua)) {
    browserName = 'edge-legacy';
    const match = ua.match(/Edge\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // Opera
  else if (/OPR/.test(ua)) {
    browserName = 'opera';
    const match = ua.match(/OPR\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // Samsung Browser
  else if (/SamsungBrowser/.test(ua)) {
    browserName = 'samsung';
    const match = ua.match(/SamsungBrowser\/(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  // IE
  else if (/Trident|MSIE/.test(ua)) {
    browserName = 'ie';
    const match = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/);
    browserVersion = match ? parseFloat(match[1]) : 'unknown';
  }
  
  // 렌더링 엔진 감지
  if (/WebKit/i.test(ua)) {
    engineName = 'webkit';
    const match = ua.match(/WebKit\/(\d+\.\d+)/i);
    engineVersion = match ? match[1] : 'unknown';
  } else if (/Gecko/i.test(ua) && !/Trident|MSIE/.test(ua)) {
    engineName = 'gecko';
    const match = ua.match(/rv:(\d+\.\d+)/);
    engineVersion = match ? match[1] : 'unknown';
  } else if (/Trident/i.test(ua)) {
    engineName = 'trident';
    const match = ua.match(/Trident\/(\d+\.\d+)/i);
    engineVersion = match ? match[1] : 'unknown';
  }
  
  // OS 감지
  if (/Windows/.test(ua)) {
    osName = 'windows';
    const match = ua.match(/Windows NT (\d+\.\d+)/);
    osVersion = match ? match[1] : 'unknown';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    osName = 'macos';
    const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  } else if (/Android/.test(ua)) {
    osName = 'android';
    const match = ua.match(/Android (\d+\.\d+)/);
    osVersion = match ? match[1] : 'unknown';
  } else if (/iOS|iPhone|iPad|iPod/.test(ua)) {
    osName = 'ios';
    const match = ua.match(/OS (\d+[._]\d+[._]?\d*)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  } else if (/Linux/.test(ua)) {
    osName = 'linux';
  }
  
  // 결과 캐싱 및 반환
  cachedBrowserInfo = {
    name: browserName,
    version: browserVersion,
    versionNumber: typeof browserVersion === 'string' ? 
      parseFloat(browserVersion) : browserVersion,
    engine: {
      name: engineName,
      version: engineVersion
    },
    os: {
      name: osName,
      version: osVersion
    },
    userAgent: ua,
    language: navigator.language || navigator.userLanguage || 'unknown',
    isSupported: isSupported(browserName, browserVersion),
    isDeprecated: isDeprecated(browserName, browserVersion)
  };
  
  return cachedBrowserInfo;
}

/**
 * 기기 유형 감지 (모바일, 태블릿, 데스크톱)
 * @param {boolean} [bypassCache=false] - 캐시를 우회하고 다시 계산할지 여부
 * @returns {Object} 기기 유형 정보
 */
export function detectDevice(bypassCache = false) {
  // 캐시된 정보가 있고, 캐시를 우회하지 않는 경우 캐시된 정보 반환
  if (cachedDeviceInfo && !bypassCache) {
    return cachedDeviceInfo;
  }
  
  const ua = navigator.userAgent;
  
  // 화면 크기 정보
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const screenRatio = Math.max(screenWidth, screenHeight) / Math.min(screenWidth, screenHeight);
  
  // 화면 픽셀 밀도
  const pixelRatio = window.devicePixelRatio || 1;
  
  // 터치 지원 여부
  const hasTouch = 'ontouchstart' in window || 
                  navigator.maxTouchPoints > 0 || 
                  navigator.msMaxTouchPoints > 0;
  
  // 모바일 여부 체크
  const isMobile = MOBILE_BROWSER_PATTERNS.some(pattern => pattern.test(ua));
  
  // 태블릿 여부 체크 (화면 비율과 크기도 고려)
  const isTabletByUA = TABLET_PATTERNS.some(pattern => pattern.test(ua));
  const isTabletBySize = !isTabletByUA && screenRatio < 1.8 && 
                        Math.max(screenWidth, screenHeight) >= 768;
  const isTablet = isTabletByUA || isTabletBySize;
  
  // 모바일이 아니고 태블릿도 아니면 데스크톱
  const isDesktop = !isMobile || (isMobile && isTablet);
  
  // 하이브리드 앱 내에서 실행 중인지 체크
  const isInWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua) ||
                     /Android.*Version\/[0-9].[0-9].*Chrome\/[0-9]*.0.0.0.*Mobile/i.test(ua);
  
  // PWA로 설치되어 실행 중인지 확인
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true;
  
  // 결과 캐싱 및 반환
  cachedDeviceInfo = {
    type: isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop'),
    isMobile: isMobile && !isTablet,
    isTablet,
    isDesktop,
    hasTouch,
    screen: {
      width: screenWidth,
      height: screenHeight,
      ratio: screenRatio,
      orientation: screenWidth > screenHeight ? 'landscape' : 'portrait',
      pixelRatio
    },
    isStandalone,
    isInWebView,
    // 간단한 기기 그룹 카테고리
    category: getDeviceCategory(screenWidth, screenHeight, pixelRatio)
  };
  
  return cachedDeviceInfo;
}

/**
 * 화면 크기 및 픽셀 밀도를 기반으로 기기 카테고리 추정
 * @param {number} width - 화면 너비
 * @param {number} height - 화면 높이
 * @param {number} pixelRatio - 픽셀 밀도
 * @returns {string} 기기 카테고리
 */
function getDeviceCategory(width, height, pixelRatio) {
  const screenSize = Math.sqrt(width * width + height * height);
  
  if (screenSize < 400) return 'small-phone';
  if (screenSize < 700) return 'phone';
  if (screenSize < 1000) return 'tablet';
  if (screenSize < 1600) return 'laptop';
  return 'desktop';
}

/**
 * 브라우저가 지원되는지 확인
 * @param {string} name - 브라우저 이름
 * @param {number|string} version - 브라우저 버전
 * @returns {boolean} 지원 여부
 */
function isSupported(name, version) {
  // 버전이 unknown이면 보수적으로 지원되지 않는 것으로 간주
  if (version === 'unknown') {
    return false;
  }
  
  // 문자열 버전을 숫자로 변환
  const versionNum = typeof version === 'string' ? 
    parseFloat(version) : version;
  
  // 지원하지 않는 브라우저인 경우
  if (MINIMUM_BROWSER_VERSIONS[name] === false) {
    return false;
  }
  
  // 최소 지원 버전 확인
  const minVersion = MINIMUM_BROWSER_VERSIONS[name] || 0;
  return versionNum >= minVersion;
}

/**
 * 브라우저가 더 이상 사용되지 않는지 확인
 * @param {string} name - 브라우저 이름
 * @param {number|string} version - 브라우저 버전
 * @returns {boolean} 더 이상 사용되지 않는지 여부
 */
function isDeprecated(name, version) {
  // IE는 항상 더 이상 사용되지 않음
  if (name === 'ie') {
    return true;
  }
  
  // 버전이 unknown이면 보수적으로 더 이상 사용되지 않는 것으로 간주
  if (version === 'unknown') {
    return true;
  }
  
  // 문자열 버전을 숫자로 변환
  const versionNum = typeof version === 'string' ? 
    parseFloat(version) : version;
  
  // 버전 기반 감지, 향후 확장 가능
  switch (name) {
    case 'chrome':
      return versionNum < 80;
    case 'firefox':
      return versionNum < 78;
    case 'safari':
      return versionNum < 13;
    case 'edge':
      return versionNum < 80;
    case 'opera':
      return versionNum < 60;
    default:
      return false;
  }
}

/**
 * 특정 브라우저 기능 지원 여부 확인
 * @param {string} feature - 확인할 기능
 * @param {boolean} [bypassCache=false] - 캐시를 우회하고 다시 확인할지 여부
 * @returns {boolean} 지원 여부
 */
export function isFeatureSupported(feature, bypassCache = false) {
  // 캐시된 정보가 있고, 캐시를 우회하지 않는 경우 캐시된 정보 반환
  if (feature in cachedFeatureSupport && !bypassCache) {
    return cachedFeatureSupport[feature];
  }
  
  let isSupported = false;
  
  switch (feature) {
    case 'serviceworker':
      isSupported = 'serviceWorker' in navigator;
      break;
    case 'webp':
      // WebP 지원 여부는 비동기적으로 확인해야 하므로, 여기서는 간단하게 처리
      isSupported = checkWebPSupport();
      break;
    case 'webgl':
      isSupported = checkWebGLSupport();
      break;
    case 'webgl2':
      isSupported = checkWebGL2Support();
      break;
    case 'indexeddb':
      isSupported = 'indexedDB' in window;
      break;
    case 'localstorage':
      isSupported = 'localStorage' in window;
      break;
    case 'sessionstorage':
      isSupported = 'sessionStorage' in window;
      break;
    case 'webanimation':
      isSupported = 'animate' in document.createElement('div');
      break;
    case 'webrtc':
      isSupported = 'RTCPeerConnection' in window;
      break;
    case 'websocket':
      isSupported = 'WebSocket' in window;
      break;
    case 'fetch':
      isSupported = 'fetch' in window;
      break;
    case 'xhr2':
      isSupported = 'XMLHttpRequest' in window && 'withCredentials' in new XMLHttpRequest();
      break;
    case 'geolocation':
      isSupported = 'geolocation' in navigator;
      break;
    case 'history':
      isSupported = 'history' in window && 'pushState' in window.history;
      break;
    case 'canvas':
      isSupported = !!document.createElement('canvas').getContext;
      break;
    case 'webworker':
      isSupported = 'Worker' in window;
      break;
    case 'sharedworker':
      isSupported = 'SharedWorker' in window;
      break;
    case 'vibration':
      isSupported = 'vibrate' in navigator;
      break;
    case 'pointer-events':
      isSupported = window.CSS && CSS.supports && CSS.supports('pointer-events', 'auto');
      break;
    case 'grid':
      isSupported = window.CSS && CSS.supports && CSS.supports('display', 'grid');
      break;
    case 'flexbox':
      isSupported = window.CSS && CSS.supports && CSS.supports('display', 'flex');
      break;
    case 'css-variables':
      isSupported = window.CSS && CSS.supports && CSS.supports('--custom-prop', 'value');
      break;
    case 'intersection-observer':
      isSupported = 'IntersectionObserver' in window;
      break;
    case 'mutation-observer':
      isSupported = 'MutationObserver' in window;
      break;
    case 'resize-observer':
      isSupported = 'ResizeObserver' in window;
      break;
    case 'requestidlecallback':
      isSupported = 'requestIdleCallback' in window;
      break;
    case 'requestanimationframe':
      isSupported = 'requestAnimationFrame' in window;
      break;
    case 'webcomponents':
      isSupported = 'customElements' in window;
      break;
    case 'shadowdom':
      isSupported = !!HTMLElement.prototype.attachShadow;
      break;
    case 'touch':
      isSupported = 'ontouchstart' in window || 
                    navigator.maxTouchPoints > 0 || 
                    navigator.msMaxTouchPoints > 0;
      break;
    case 'hover':
      isSupported = window.matchMedia('(hover: hover)').matches;
      break;
    case 'orientation':
      isSupported = 'orientation' in window || 'orientationchange' in window;
      break;
    case 'push-api':
      isSupported = 'PushManager' in window;
      break;
    case 'notification':
      isSupported = 'Notification' in window;
      break;
    case 'cors':
      isSupported = 'XMLHttpRequest' in window && 
                    'withCredentials' in new XMLHttpRequest();
      break;
    case 'css-supports':
      isSupported = window.CSS && CSS.supports && typeof CSS.supports === 'function';
      break;
    default:
      console.warn(`Unknown feature: ${feature}`);
      isSupported = false;
  }
  
  // 결과 캐싱
  cachedFeatureSupport[feature] = isSupported;
  
  return isSupported;
}

/**
 * WebP 이미지 형식 지원 여부 확인
 * @returns {boolean} WebP 지원 여부
 */
function checkWebPSupport() {
  if (!('createImageBitmap' in window) || !('Image' in window)) {
    return false;
  }
  
  try {
    // Chrome 및 Opera에서는 이미 지원하는 것으로 알려져 있음
    const isChromiumBased = /Chrome|Opera/i.test(navigator.userAgent);
    if (isChromiumBased) {
      return true;
    }
    
    // 기타 브라우저에서는 간단한 감지
    return document.createElement('canvas')
      .toDataURL('image/webp')
      .indexOf('data:image/webp') === 0;
  } catch (e) {
    return false;
  }
}

/**
 * WebGL 지원 여부 확인
 * @returns {boolean} WebGL 지원 여부
 */
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && 
              (canvas.getContext('webgl') || 
               canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/**
 * WebGL 2 지원 여부 확인
 * @returns {boolean} WebGL 2 지원 여부
 */
function checkWebGL2Support() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && 
              canvas.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

/**
 * 브라우저의 성능 등급 평가 (high, medium, low)
 * @param {boolean} [bypassCache=false] - 캐시를 우회하고 다시 계산할지 여부
 * @returns {string} 성능 등급 (high, medium, low)
 */
export function getBrowserPerformanceGrade(bypassCache = false) {
  if (cachedPerformanceGrade && !bypassCache) {
    return cachedPerformanceGrade;
  }
  
  // 하드웨어 정보 수집
  let hardwareScore = 0;
  
  // 멀티 코어 지원 및 코어 수 확인
  if (navigator.hardwareConcurrency) {
    const cores = navigator.hardwareConcurrency;
    if (cores >= 8) hardwareScore += 3;
    else if (cores >= 4) hardwareScore += 2;
    else if (cores >= 2) hardwareScore += 1;
  }
  
  // 메모리 확인 (메모리 정보가 있는 경우에만)
  if (navigator.deviceMemory) {
    const memory = navigator.deviceMemory;
    if (memory >= 8) hardwareScore += 3;
    else if (memory >= 4) hardwareScore += 2;
    else if (memory >= 2) hardwareScore += 1;
  }
  
  // 화면 해상도 및 픽셀 밀도 확인
  const pixelCount = window.screen.width * window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  
  if (pixelCount > 2000000) hardwareScore += 1; // 200만 픽셀 이상 (FHD+)
  if (pixelRatio > 2) hardwareScore -= 1; // 고해상도 화면은 렌더링 부담이 큼
  
  // 브라우저 버전 기반 점수
  let browserScore = 0;
  const browser = detectBrowser();
  const device = detectDevice();
  
  // 최신 브라우저 점수 할당
  if ((browser.name === 'chrome' && browser.versionNumber >= 90) ||
      (browser.name === 'firefox' && browser.versionNumber >= 88) ||
      (browser.name === 'safari' && browser.versionNumber >= 14) ||
      (browser.name === 'edge' && browser.versionNumber >= 90)) {
    browserScore += 2;
  } else if (browser.isSupported) {
    browserScore += 1;
  } else {
    browserScore -= 2;
  }
  
  // 핵심 성능 기능 지원 여부 확인
  let featuresScore = 0;
  
  // 주요 성능 관련 API 확인
  if (isFeatureSupported('webworker')) featuresScore += 1;
  if (isFeatureSupported('requestanimationframe')) featuresScore += 1;
  if (isFeatureSupported('requestidlecallback')) featuresScore += 1;
  if (isFeatureSupported('indexeddb')) featuresScore += 1;
  
  // 모바일 장치 페널티 (일반적으로 모바일이 성능이 더 낮음)
  const devicePenalty = device.isMobile ? -2 : (device.isTablet ? -1 : 0);
  
  // 총점 계산 (범위: -5 ~ 15)
  const totalScore = hardwareScore + browserScore + featuresScore + devicePenalty;
  
  // 성능 등급 결정
  let performanceGrade;
  if (totalScore >= 5) {
    performanceGrade = 'high';
  } else if (totalScore >= 0) {
    performanceGrade = 'medium';
  } else {
    performanceGrade = 'low';
  }
  
  // 결과 캐싱
  cachedPerformanceGrade = performanceGrade;
  
  return performanceGrade;
}

/**
 * 브라우저 및 기기 호환성 진단 보고서 생성
 * @returns {Object} 종합 진단 보고서
 */
export function generateCompatibilityReport() {
  // 브라우저 및 기기 정보 가져오기
  const browser = detectBrowser();
  const device = detectDevice();
  const performanceGrade = getBrowserPerformanceGrade();
  
  // 핵심 기능 지원 여부 확인
  const coreFeatures = {
    serviceworker: isFeatureSupported('serviceworker'),
    indexeddb: isFeatureSupported('indexeddb'),
    localstorage: isFeatureSupported('localstorage'),
    fetch: isFeatureSupported('fetch'),
    canvas: isFeatureSupported('canvas'),
    webworker: isFeatureSupported('webworker')
  };
  
  // 부가 기능 지원 여부 확인
  const enhancedFeatures = {
    webp: isFeatureSupported('webp'),
    webgl: isFeatureSupported('webgl'),
    intersectionObserver: isFeatureSupported('intersection-observer'),
    webanimation: isFeatureSupported('webanimation'),
    cssGrid: isFeatureSupported('grid'),
    flexbox: isFeatureSupported('flexbox'),
    cssVariables: isFeatureSupported('css-variables')
  };
  
  // 모바일 전용 기능 지원 여부 확인 (모바일 기기인 경우)
  const mobileFeatures = device.isMobile || device.isTablet ? {
    touch: isFeatureSupported('touch'),
    orientation: isFeatureSupported('orientation'),
    vibration: isFeatureSupported('vibration'),
    hover: isFeatureSupported('hover')
  } : null;
  
  // 성능 관련 기능 지원 여부 확인
  const performanceFeatures = {
    requestidlecallback: isFeatureSupported('requestidlecallback'),
    requestanimationframe: isFeatureSupported('requestanimationframe'),
    webgl2: isFeatureSupported('webgl2'),
    sharedworker: isFeatureSupported('sharedworker')
  };
  
  // 전체 지원 여부 결정
  const hasAllCoreFeatures = Object.values(coreFeatures).every(Boolean);
  
  // 문제 및 제안 사항 목록
  const issues = [];
  const suggestions = [];
  
  // 브라우저 관련 문제 및 제안
  if (!browser.isSupported) {
    issues.push({
      severity: 'high',
      message: `현재 브라우저(${browser.name} ${browser.version})는 지원되지 않습니다. 최소 요구 버전: ${MINIMUM_BROWSER_VERSIONS[browser.name] || 'N/A'}`
    });
    
    suggestions.push({
      type: 'browser',
      message: '최신 브라우저로 업그레이드하세요. Chrome, Firefox, Safari 또는 Edge의 최신 버전을 권장합니다.'
    });
  } else if (browser.isDeprecated) {
    issues.push({
      severity: 'medium',
      message: `현재 브라우저 버전(${browser.name} ${browser.version})은 오래되었습니다.`
    });
    
    suggestions.push({
      type: 'browser',
      message: '브라우저를 최신 버전으로 업데이트하세요.'
    });
  }
  
  // 핵심 기능 관련 문제 및 제안
  for (const [feature, supported] of Object.entries(coreFeatures)) {
    if (!supported) {
      issues.push({
        severity: 'high',
        message: `필수 기능 '${feature}'이(가) 지원되지 않습니다.`
      });
      
      switch (feature) {
        case 'serviceworker':
          suggestions.push({
            type: 'feature',
            message: '서비스 워커를 지원하는 최신 브라우저를 사용하세요.'
          });
          break;
        case 'indexeddb':
        case 'localstorage':
          suggestions.push({
            type: 'feature',
            message: '로컬 데이터 저장을 지원하는 최신 브라우저를 사용하세요.'
          });
          break;
        case 'fetch':
          suggestions.push({
            type: 'feature',
            message: 'Fetch API를 지원하는 최신 브라우저를 사용하세요.'
          });
          break;
        default:
          suggestions.push({
            type: 'feature',
            message: `'${feature}' 기능을 지원하는 최신 브라우저를 사용하세요.`
          });
      }
    }
  }
  
  // 성능 관련 문제 및 제안
  if (performanceGrade === 'low') {
    issues.push({
      severity: 'medium',
      message: '기기 성능이 낮습니다. 일부 고급 기능이 원활하게 작동하지 않을 수 있습니다.'
    });
    
    suggestions.push({
      type: 'performance',
      message: '배경 애니메이션 및 효과 줄이기 설정을 활성화하는 것이 좋습니다.'
    });
  }
  
  // 브라우저 내에서 실행되는 경우 추가 제안
  if (device.isInWebView) {
    issues.push({
      severity: 'low',
      message: '앱 내 웹뷰에서 실행 중입니다. 일부 기능이 제한될 수 있습니다.'
    });
  }
  
  // 종합 보고서 생성 및 반환
  return {
    summary: {
      browser: {
        name: browser.name,
        version: browser.version,
        isSupported: browser.isSupported,
        isDeprecated: browser.isDeprecated,
        engine: browser.engine.name
      },
      device: {
        type: device.type,
        isMobile: device.isMobile,
        isTablet: device.isTablet,
        isDesktop: device.isDesktop,
        isInWebView: device.isInWebView,
        isStandalone: device.isStandalone
      },
      performance: {
        grade: performanceGrade,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown'
      },
      compatibility: {
        isFullyCompatible: hasAllCoreFeatures && browser.isSupported,
        hasCoreFeatures: hasAllCoreFeatures,
        score: hasAllCoreFeatures ? (browser.isSupported ? 100 : 75) : 50
      }
    },
    features: {
      core: coreFeatures,
      enhanced: enhancedFeatures,
      mobile: mobileFeatures,
      performance: performanceFeatures
    },
    issues,
    suggestions
  };
}

/**
 * 브라우저 경고 메시지 생성
 * @returns {Object|null} 경고 메시지 또는 null (경고 없음)
 */
export function getBrowserWarning() {
  const browser = detectBrowser();
  
  // 지원되지 않는 브라우저인 경우
  if (!browser.isSupported) {
    return {
      type: 'unsupported',
      severity: 'high',
      message: `현재 브라우저(${browser.name} ${browser.version})는 본 웹사이트에 완전히 호환되지 않습니다. 최신 Chrome, Firefox, Safari 또는 Edge를 사용하시는 것이 좋습니다.`,
      action: 'upgrade'
    };
  }
  
  // 더 이상 사용되지 않는 브라우저인 경우
  if (browser.isDeprecated) {
    return {
      type: 'deprecated',
      severity: 'medium',
      message: `사용 중인 브라우저 버전(${browser.name} ${browser.version})은 오래되었습니다. 최신 버전으로 업데이트하시는 것이 좋습니다.`,
      action: 'update'
    };
  }
  
  // 핵심 기능이 지원되지 않는 경우
  if (!isFeatureSupported('serviceworker') || 
      !isFeatureSupported('indexeddb') || 
      !isFeatureSupported('localstorage')) {
    return {
      type: 'missing-feature',
      severity: 'medium',
      message: '현재 브라우저에서는 일부 중요 기능이 지원되지 않습니다. 이로 인해 일부 기능이 제한될 수 있습니다.',
      action: 'inform'
    };
  }
  
  // Internet Explorer인 경우 (특별 처리)
  if (browser.name === 'ie') {
    return {
      type: 'deprecated',
      severity: 'high',
      message: 'Internet Explorer는 더 이상 지원되지 않습니다. Microsoft Edge, Chrome 또는 Firefox와 같은 최신 브라우저를 사용하세요.',
      action: 'upgrade'
    };
  }
  
  // 경고 없음
  return null;
}

/**
 * PWA 설치 가능 여부 확인
 * @returns {boolean} PWA 설치 가능 여부
 */
export function canInstallPWA() {
  const device = detectDevice();
  
  // 이미 독립 실행형으로 실행 중인 경우
  if (device.isStandalone) {
    return false;
  }
  
  // 서비스 워커 지원 확인
  if (!isFeatureSupported('serviceworker')) {
    return false;
  }
  
  // iOS의 경우 Safari에서만 PWA 설치 가능
  const browser = detectBrowser();
  if (device.os && device.os.name === 'ios' && browser.name !== 'safari') {
    return false;
  }
  
  return true;
}

/**
 * URL 기본 매개변수 제안 (적절한 utm_source 등)
 * @returns {Object} 추천 URL 매개변수
 */
export function getSuggestedURLParams() {
  const browser = detectBrowser();
  const device = detectDevice();
  
  return {
    utm_source: browser.name,
    utm_medium: device.type,
    utm_campaign: 'browser_detection',
    browser: browser.name,
    version: browser.version,
    device: device.type,
    is_standalone: device.isStandalone ? '1' : '0'
  };
}

/**
 * 웹 애플리케이션의 성능 최적화를 위한 제안 생성
 * @returns {Object} 성능 최적화 제안
 */
export function getPerformanceOptimizationSuggestions() {
  const device = detectDevice();
  const performanceGrade = getBrowserPerformanceGrade();
  const browser = detectBrowser();
  
  // 성능 등급별 최적화 제안
  const commonSuggestions = [
    { id: 'lazy-loading', name: '이미지 및 컴포넌트 지연 로딩' },
    { id: 'code-splitting', name: '코드 분할 및 필요한 경우에만 로드' }
  ];
  
  const mediumSuggestions = [
    { id: 'reduce-animations', name: '애니메이션 횟수 및 복잡도 줄이기' },
    { id: 'optimize-images', name: '이미지 최적화 (WebP 사용 등)' }
  ];
  
  const lowSuggestions = [
    { id: 'minimal-mode', name: '최소 모드 활성화 (애니메이션 없음)' },
    { id: 'reduce-effects', name: '시각적 효과 줄이기' },
    { id: 'reduce-data', name: '데이터 사용량 최소화' }
  ];
  
  // 특정 브라우저를 위한 제안
  const browserSpecificSuggestions = [];
  
  if (browser.name === 'safari') {
    browserSpecificSuggestions.push({
      id: 'safari-flexbox',
      name: 'Safari의 Flexbox 이슈 해결을 위한 대체 스타일 사용'
    });
  }
  
  // 특정 기기를 위한 제안
  const deviceSpecificSuggestions = [];
  
  if (device.isMobile) {
    deviceSpecificSuggestions.push(
      { id: 'touch-optimization', name: '터치 대상 크기 최적화' },
      { id: 'mobile-data', name: '모바일 데이터 사용량 고려' }
    );
  }
  
  // 성능 등급에 따른 제안 생성
  let suggestions = [...commonSuggestions];
  
  if (performanceGrade === 'medium') {
    suggestions = [...suggestions, ...mediumSuggestions];
  } else if (performanceGrade === 'low') {
    suggestions = [...suggestions, ...mediumSuggestions, ...lowSuggestions];
  }
  
  // 브라우저 및 기기 특정 제안 추가
  suggestions = [
    ...suggestions,
    ...browserSpecificSuggestions,
    ...deviceSpecificSuggestions
  ];
  
  return {
    performanceGrade,
    browserName: browser.name,
    browserVersion: browser.version,
    deviceType: device.type,
    isHighPerformance: performanceGrade === 'high',
    isMobile: device.isMobile,
    suggestions,
    recommendReducedAnimations: performanceGrade === 'low',
    recommendReducedQuality: performanceGrade === 'low',
    recommendLazyLoading: true
  };
}

/**
 * 브라우저가 특정 JavaScript 기능을 지원하는지 확인
 * @param {string} feature - 확인할 JavaScript 기능
 * @returns {boolean} 지원 여부
 */
export function isJSFeatureSupported(feature) {
  // ECMAScript 버전 특징
  const esFeatures = {
    'es6-arrow-functions': () => {
      try {
        // 화살표 함수 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('() => {}');
        return true;
      } catch (e) {
        return false;
      }
    },
    'es6-template-literals': () => {
      try {
        // 템플릿 리터럴 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('`test`');
        return true;
      } catch (e) {
        return false;
      }
    },
    'es6-let-const': () => {
      try {
        // let, const 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('let a = 1; const b = 2;');
        return true;
      } catch (e) {
        return false;
      }
    },
    'es6-destructuring': () => {
      try {
        // 구조 분해 할당 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('const { a } = { a: 1 }; const [b] = [1];');
        return true;
      } catch (e) {
        return false;
      }
    },
    'es6-spread': () => {
      try {
        // 스프레드 연산자 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('const a = { ...{} }; const b = [...[]];');
        return true;
      } catch (e) {
        return false;
      }
    },
    'es6-promise': () => {
      return typeof Promise !== 'undefined';
    },
    'es8-async-await': () => {
      try {
        // async/await 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('async function test() { await Promise.resolve(); }');
        return true;
      } catch (e) {
        return false;
      }
    },
    'es11-nullish-coalescing': () => {
      try {
        // 널 병합 연산자 지원 확인
        // eslint-disable-next-line no-new-func
        new Function('const a = null ?? "default"');
        return true;
      } catch (e) {
        return false;
      }
    }
  };
  
  // 특정 기능 확인
  if (feature in esFeatures) {
    return esFeatures[feature]();
  }
  
  // 알 수 없는 기능
  console.warn(`Unknown JavaScript feature: ${feature}`);
  return false;
}

/**
 * 사용자 브라우저 정보 표시를 위한 HTML 생성
 * @returns {string} HTML 문자열
 */
export function generateBrowserInfoHTML() {
  const browser = detectBrowser();
  const device = detectDevice();
  const performanceGrade = getBrowserPerformanceGrade();
  
  return `
    <div class="browser-info">
      <div class="browser-info-header">
        <h3>브라우저 정보</h3>
        <span class="browser-compatibility-badge ${browser.isSupported ? 'supported' : 'unsupported'}">
          ${browser.isSupported ? '호환됨' : '호환되지 않음'}
        </span>
      </div>
      
      <div class="browser-info-content">
        <div class="browser-info-item">
          <strong>브라우저:</strong> ${browser.name} ${browser.version}
        </div>
        <div class="browser-info-item">
          <strong>엔진:</strong> ${browser.engine.name} ${browser.engine.version}
        </div>
        <div class="browser-info-item">
          <strong>OS:</strong> ${browser.os.name} ${browser.os.version}
        </div>
        <div class="browser-info-item">
          <strong>기기 유형:</strong> ${device.type}
        </div>
        <div class="browser-info-item">
          <strong>성능 등급:</strong> 
          <span class="performance-grade ${performanceGrade}">
            ${performanceGrade === 'high' ? '높음' : (performanceGrade === 'medium' ? '중간' : '낮음')}
          </span>
        </div>
      </div>
      
      ${browser.isSupported ? '' : `
      <div class="browser-warning">
        <p>현재 브라우저는 일부 기능을 지원하지 않을 수 있습니다.</p>
        <p>최상의 경험을 위해 최신 버전의 Chrome, Firefox, Safari 또는 Edge를 사용하세요.</p>
      </div>
      `}
    </div>
  `;
}

/**
 * 브라우저 호환성 경고 배너 생성
 * @param {string} targetElementId - 경고 배너를 추가할 요소의 ID
 */
export function showBrowserWarningBanner(targetElementId) {
  const warning = getBrowserWarning();
  
  // 경고가 없는 경우 아무것도 표시하지 않음
  if (!warning) {
    return;
  }
  
  // 대상 요소 가져오기
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) {
    console.error(`Element with ID "${targetElementId}" not found.`);
    return;
  }
  
  // 경고 배너 DOM 요소 생성
  const bannerElement = document.createElement('div');
  bannerElement.className = `browser-warning-banner ${warning.severity}`;
  
  // 배너 내용 설정
  bannerElement.innerHTML = `
    <div class="browser-warning-message">
      <span class="browser-warning-icon">⚠️</span>
      <span class="browser-warning-text">${warning.message}</span>
    </div>
    <div class="browser-warning-actions">
      ${warning.action === 'upgrade' || warning.action === 'update' ? 
        `<button class="browser-upgrade-button">${warning.action === 'upgrade' ? '브라우저 업그레이드' : '브라우저 업데이트'}</button>` : 
        ''}
      <button class="browser-dismiss-button">닫기</button>
    </div>
  `;
  
  // 버튼 이벤트 리스너 추가
  bannerElement.querySelector('.browser-dismiss-button').addEventListener('click', () => {
    bannerElement.remove();
    
    // 사용자 선택을 로컬 스토리지에 저장 (24시간 동안 같은 경고 표시하지 않음)
    try {
      localStorage.setItem('browser-warning-dismissed', Date.now().toString());
    } catch (e) {
      console.warn('로컬 스토리지에 접근할 수 없습니다:', e);
    }
  });
  
  // 업그레이드/업데이트 버튼이 있는 경우
  const upgradeButton = bannerElement.querySelector('.browser-upgrade-button');
  if (upgradeButton) {
    upgradeButton.addEventListener('click', () => {
      // 브라우저별 다운로드 페이지로 이동
      const browser = detectBrowser();
      let downloadUrl = 'https://www.google.com/chrome/';
      
      switch (browser.name) {
        case 'firefox':
          downloadUrl = 'https://www.mozilla.org/firefox/new/';
          break;
        case 'safari':
          downloadUrl = 'https://support.apple.com/downloads/safari';
          break;
        case 'edge':
          downloadUrl = 'https://www.microsoft.com/edge';
          break;
        case 'opera':
          downloadUrl = 'https://www.opera.com/download';
          break;
        case 'ie':
          downloadUrl = 'https://www.microsoft.com/edge';
          break;
        default:
          downloadUrl = 'https://www.google.com/chrome/';
          break;
      }
      
      window.open(downloadUrl, '_blank');
    });
  }
  
  // 대상 요소에 배너 추가
  targetElement.prepend(bannerElement);
}

// 모듈 내보내기 - 모든 공개 함수
const browserDetection = {
  detectBrowser,
  detectDevice,
  isFeatureSupported,
  getBrowserPerformanceGrade,
  generateCompatibilityReport,
  getBrowserWarning,
  canInstallPWA,
  getSuggestedURLParams,
  getPerformanceOptimizationSuggestions,
  isJSFeatureSupported,
  generateBrowserInfoHTML,
  showBrowserWarningBanner
};

export default browserDetection;
