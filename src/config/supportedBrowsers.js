// src/config/supportedBrowsers.js

/**
 * 지원하는 브라우저 및 최소 버전 정보
 * 
 * 이 파일은 MyTripStyle 애플리케이션이 공식적으로 지원하는 브라우저 목록과
 * 각 브라우저의 최소 지원 버전을 정의합니다.
 */

/**
 * 브라우저별 최소 지원 버전
 * 
 * 값이 false인 경우 해당 브라우저는 지원되지 않음을 의미합니다.
 * 값이 숫자인 경우 해당 브라우저의 최소 지원 버전을 의미합니다.
 */
export const MINIMUM_BROWSER_VERSIONS = {
    // 데스크톱 브라우저
    chrome: 90,       // Chrome 90 이상
    firefox: 88,      // Firefox 88 이상
    safari: 14,       // Safari 14 이상
    edge: 90,         // Edge(Chromium) 90 이상
    opera: 76,        // Opera 76 이상
    ie: false,        // Internet Explorer 지원 안함
    
    // 모바일 브라우저
    'chrome-android': 90,   // Android Chrome 90 이상
    'firefox-android': 88,  // Android Firefox 88 이상
    'safari-ios': 14,       // iOS Safari 14 이상
    samsung: 15,            // Samsung Internet 15 이상
    'edge-android': 90,     // Android Edge 90 이상
    'opera-android': 63,    // Android Opera 63 이상
  };
  
  /**
   * 추천 브라우저 목록
   */
  export const RECOMMENDED_BROWSERS = [
    {
      name: 'chrome',
      displayName: 'Google Chrome',
      icon: 'chrome',
      downloadUrl: 'https://www.google.com/chrome/',
      platforms: ['windows', 'macos', 'linux', 'android', 'ios']
    },
    {
      name: 'firefox',
      displayName: 'Mozilla Firefox',
      icon: 'firefox',
      downloadUrl: 'https://www.mozilla.org/firefox/new/',
      platforms: ['windows', 'macos', 'linux', 'android', 'ios']
    },
    {
      name: 'edge',
      displayName: 'Microsoft Edge',
      icon: 'edge',
      downloadUrl: 'https://www.microsoft.com/edge',
      platforms: ['windows', 'macos', 'android', 'ios']
    },
    {
      name: 'safari',
      displayName: 'Apple Safari',
      icon: 'safari',
      downloadUrl: 'https://support.apple.com/downloads/safari',
      platforms: ['macos', 'ios']
    },
    {
      name: 'opera',
      displayName: 'Opera',
      icon: 'opera',
      downloadUrl: 'https://www.opera.com/download',
      platforms: ['windows', 'macos', 'linux', 'android', 'ios']
    }
  ];
  
  /**
   * 특정 브라우저에 대한 정보 가져오기
   * @param {string} browserName - 브라우저 이름
   * @returns {Object|null} 브라우저 정보 또는 null (찾을 수 없는 경우)
   */
  export function getBrowserInfo(browserName) {
    return RECOMMENDED_BROWSERS.find(browser => browser.name === browserName) || null;
  }
  
  /**
   * 브라우저 버전 비교 함수
   * @param {string} name - 브라우저 이름
   * @param {number|string} version - 브라우저 버전
   * @returns {boolean} 지원 여부
   */
  export function isSupportedBrowserVersion(name, version) {
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
    
    // 지원 정보가 없는 브라우저일 경우 모바일 버전 확인
    if (typeof MINIMUM_BROWSER_VERSIONS[name] === 'undefined') {
      // 모바일 버전이 있는지 확인 (예: 'chrome-android')
      const mobileName = `${name}-android`;
      const iosName = `${name}-ios`;
      
      if (typeof MINIMUM_BROWSER_VERSIONS[mobileName] !== 'undefined') {
        return versionNum >= MINIMUM_BROWSER_VERSIONS[mobileName];
      }
      
      if (typeof MINIMUM_BROWSER_VERSIONS[iosName] !== 'undefined') {
        return versionNum >= MINIMUM_BROWSER_VERSIONS[iosName];
      }
      
      // 알 수 없는 브라우저는 기본적으로 지원하지 않는 것으로 간주
      return false;
    }
    
    // 최소 지원 버전 확인
    const minVersion = MINIMUM_BROWSER_VERSIONS[name] || 0;
    return versionNum >= minVersion;
  }
  
  /**
   * 특정 OS에서 사용 가능한 브라우저 목록 가져오기
   * @param {string} osName - OS 이름 (windows, macos, linux, android, ios)
   * @returns {Array} 사용 가능한 브라우저 목록
   */
  export function getAvailableBrowsersForOS(osName) {
    return RECOMMENDED_BROWSERS.filter(browser => 
      browser.platforms.includes(osName)
    );
  }
  
  /**
   * 사용자 브라우저에 맞는 다운로드 URL 생성
   * @param {string} browserName - 브라우저 이름
   * @param {string} osName - 운영체제 이름
   * @returns {string} 다운로드 URL
   */
  export function getBrowserDownloadUrl(browserName, osName) {
    const browser = getBrowserInfo(browserName);
    
    if (!browser) {
      // 기본값으로 Chrome 반환
      return 'https://www.google.com/chrome/';
    }
    
    // 운영체제별 특별 URL이 있는 경우
    if (osName === 'android' && browserName === 'chrome') {
      return 'https://play.google.com/store/apps/details?id=com.android.chrome';
    }
    
    if (osName === 'ios' && browserName === 'chrome') {
      return 'https://apps.apple.com/app/google-chrome/id535886823';
    }
    
    return browser.downloadUrl;
  }
  
  /**
   * 브라우저별 알려진 호환성 이슈 목록
   */
  export const KNOWN_COMPATIBILITY_ISSUES = {
    safari: [
      {
        feature: 'flexbox',
        versions: ['13', '14'],
        description: 'Flexbox gap 속성이 지원되지 않습니다.',
        workaround: 'margin을 사용하여 간격을 설정하세요.'
      },
      {
        feature: 'backdrop-filter',
        versions: ['13'],
        description: '일부 backdrop-filter 효과가 제대로 작동하지 않을 수 있습니다.',
        workaround: '대체 스타일을 사용하세요.'
      }
    ],
    firefox: [
      {
        feature: 'backdrop-filter',
        versions: ['88', '89'],
        description: 'backdrop-filter 속성이 기본적으로 비활성화되어 있습니다.',
        workaround: 'about:config에서 layout.css.backdrop-filter.enabled를 true로 설정하세요.'
      }
    ],
    'safari-ios': [
      {
        feature: 'position: fixed',
        versions: ['13', '14', '15'],
        description: '가상 키보드가 열릴 때 fixed 위치가 올바르게 작동하지 않습니다.',
        workaround: '대체 레이아웃 전략을 사용하세요.'
      },
      {
        feature: '100vh',
        versions: ['13', '14', '15'],
        description: '100vh 높이가 주소 표시줄을 포함하여 계산됩니다.',
        workaround: 'window.innerHeight를 사용하여 JavaScript로 높이를 설정하세요.'
      }
    ],
    ie: [
      {
        feature: 'all',
        versions: ['all'],
        description: 'Internet Explorer는 더 이상 지원되지 않습니다.',
        workaround: 'Microsoft Edge, Chrome 또는 Firefox를 사용하세요.'
      }
    ]
  };
  
  /**
   * 브라우저 및 버전에 대한 알려진 호환성 이슈 가져오기
   * @param {string} browserName - 브라우저 이름
   * @param {string|number} version - 브라우저 버전
   * @returns {Array} 알려진 호환성 이슈 목록
   */
  export function getKnownIssuesForBrowser(browserName, version) {
    // 버전을 문자열로 변환
    const versionStr = String(version);
    const issues = [];
    
    // 브라우저에 대한 알려진 이슈 확인
    const browserIssues = KNOWN_COMPATIBILITY_ISSUES[browserName] || [];
    
    // 모바일 버전도 확인 (예: 'safari-ios')
    const mobileIssues = KNOWN_COMPATIBILITY_ISSUES[`${browserName}-android`] || 
                         KNOWN_COMPATIBILITY_ISSUES[`${browserName}-ios`] || [];
    
    // 모든 이슈 확인
    [...browserIssues, ...mobileIssues].forEach(issue => {
      // 모든 버전에 영향을 미치는 이슈
      if (issue.versions.includes('all')) {
        issues.push(issue);
        return;
      }
      
      // 특정 버전에 영향을 미치는 이슈
      const versionNum = parseFloat(versionStr);
      const affectsVersion = issue.versions.some(v => {
        // 버전 범위 (예: '13-15')
        if (v.includes('-')) {
          const [min, max] = v.split('-').map(parseFloat);
          return versionNum >= min && versionNum <= max;
        }
        // 단일 버전
        return parseFloat(v) === versionNum;
      });
      
      if (affectsVersion) {
        issues.push(issue);
      }
    });
    
    return issues;
  }
  
  /**
   * 특정 브라우저에 대한 권장 설정 가져오기
   * @param {string} browserName - 브라우저 이름
   * @param {string|number} version - 브라우저 버전
   * @returns {Object} 권장 설정
   */
  export function getRecommendedSettings(browserName, version) {
    // 기본 설정
    const settings = {
      reducedAnimations: false,
      highContrastMode: false,
      increasedTextSize: false,
      useWebPImages: true,
      useCacheAPI: true,
      useServiceWorker: true
    };
    
    // IE는 전체 기능 사용 불가
    if (browserName === 'ie') {
      return {
        ...settings,
        useWebPImages: false,
        useCacheAPI: false,
        useServiceWorker: false
      };
    }
    
    // 레거시 Edge (비 Chromium)
    if (browserName === 'edge-legacy') {
      return {
        ...settings,
        useWebPImages: false
      };
    }
    
    // Safari 13 이하
    if (browserName === 'safari' && parseFloat(version) <= 13) {
      return {
        ...settings,
        useWebPImages: false
      };
    }
    
    // 구형 브라우저는 애니메이션 줄이기
    if ((browserName === 'chrome' && parseFloat(version) < 85) ||
        (browserName === 'firefox' && parseFloat(version) < 80) ||
        (browserName === 'safari' && parseFloat(version) < 14) ||
        (browserName === 'edge' && parseFloat(version) < 85)) {
      settings.reducedAnimations = true;
    }
    
    return settings;
  }
  
  // 기본 내보내기
  const supportedBrowsers = {
    MINIMUM_BROWSER_VERSIONS,
    RECOMMENDED_BROWSERS,
    KNOWN_COMPATIBILITY_ISSUES,
    getBrowserInfo,
    isSupportedBrowserVersion,
    getAvailableBrowsersForOS,
    getBrowserDownloadUrl,
    getKnownIssuesForBrowser,
    getRecommendedSettings
  };
  
  export default supportedBrowsers;
