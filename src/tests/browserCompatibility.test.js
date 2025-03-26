// src/tests/browserCompatibility.test.js

/**
 * 브라우저 호환성 테스트 모듈
 * 
 * 이 테스트 모듈은 다양한 브라우저 환경에서 앱의 핵심 기능이
 * 올바르게 작동하는지 확인하기 위한 테스트를 제공합니다.
 */

import { 
    detectBrowser, 
    detectDevice,  // 이 줄이 추가되어야 함
    isFeatureSupported,
    getBrowserPerformanceGrade 
  } from '../utils/browserDetection';
  
  import {
    MINIMUM_BROWSER_VERSIONS,
    isSupportedBrowserVersion,
    getKnownIssuesForBrowser
  } from '../config/supportedBrowsers';
  
  import {
    createCrossBrowserStyles,
    createFlexStyles,
    createBackdropFilterStyles
  } from '../styles/crossBrowserStyles';
  
  // 테스트 유틸리티
  const mockUserAgent = (userAgent) => {
    const originalUserAgent = window.navigator.userAgent;
    
    // Navigator userAgent를 모킹하는 함수
    Object.defineProperty(window.navigator, 'userAgent', {
      get: () => userAgent,
      configurable: true
    });
    
    // 원래 값으로 복원하는 함수 반환
    return () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        get: () => originalUserAgent,
        configurable: true
      });
    };
  };
  
  // 브라우저별 유저 에이전트 문자열
  const USER_AGENTS = {
    chrome: {
      '90': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
      '80': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36'
    },
    firefox: {
      '88': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0',
      '75': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:75.0) Gecko/20100101 Firefox/75.0'
    },
    safari: {
      '14': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
      '13': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Safari/605.1.15'
    },
    edge: {
      '90': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.72 Safari/537.36 Edg/90.0.818.42',
      '80': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36 Edg/80.0.361.69'
    },
    ie: {
      '11': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'
    },
    mobile: {
      'android': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
      'ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    }
  };
  
  // 모킹 헬퍼: CSS.supports 메서드
  const mockCssSupports = (supportedFeatures = {}) => {
    const originalSupports = window.CSS?.supports;
    
    if (!window.CSS) {
      window.CSS = {};
    }
    
    window.CSS.supports = (prop, value) => {
      if (value) {
        const key = `${prop}: ${value}`;
        return supportedFeatures[key] ?? false;
      }
      // prop이 전체 선언인 경우
      return supportedFeatures[prop] ?? false;
    };
    
    // 원래 값으로 복원하는 함수 반환
    return () => {
      if (originalSupports) {
        window.CSS.supports = originalSupports;
      } else {
        delete window.CSS.supports;
      }
    };
  };
  
  // 테스트 그룹: 브라우저 감지
  describe('Browser Detection', () => {
    beforeEach(() => {
      // 각 테스트 전에 캐시 초기화
      jest.resetModules();
    });
    
    test('Chrome 브라우저를 정확히 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.chrome['90']);
      
      const browser = detectBrowser(true); // 캐시 우회
      
      expect(browser.name).toBe('chrome');
      expect(browser.versionNumber).toBe(90);
      expect(browser.isSupported).toBe(true);
      
      restoreUA();
    });
    
    test('Firefox 브라우저를 정확히 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.firefox['88']);
      
      const browser = detectBrowser(true);
      
      expect(browser.name).toBe('firefox');
      expect(browser.versionNumber).toBe(88);
      expect(browser.isSupported).toBe(true);
      
      restoreUA();
    });
    
    test('Safari 브라우저를 정확히 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.safari['14']);
      
      const browser = detectBrowser(true);
      
      expect(browser.name).toBe('safari');
      expect(browser.versionNumber).toBe(14);
      expect(browser.isSupported).toBe(true);
      
      restoreUA();
    });
    
    test('Edge 브라우저를 정확히 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.edge['90']);
      
      const browser = detectBrowser(true);
      
      expect(browser.name).toBe('edge');
      expect(browser.versionNumber).toBe(90);
      expect(browser.isSupported).toBe(true);
      
      restoreUA();
    });
    
    test('IE 브라우저를 정확히 감지하고 지원되지 않음을 표시', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.ie['11']);
      
      const browser = detectBrowser(true);
      
      expect(browser.name).toBe('ie');
      expect(browser.isSupported).toBe(false);
      expect(browser.isDeprecated).toBe(true);
      
      restoreUA();
    });
    
    test('지원되지 않는 버전의 브라우저 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.chrome['80']);
      
      const browser = detectBrowser(true);
      
      // Chrome 80은 최소 지원 버전 90보다 낮음
      expect(browser.name).toBe('chrome');
      expect(browser.versionNumber).toBe(80);
      expect(browser.isSupported).toBe(false);
      
      restoreUA();
    });
    
    test('iOS 모바일 기기 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.mobile['ios']);
      
      const browser = detectBrowser(true);
      const device = detectDevice(true);
      
      expect(browser.os.name).toBe('ios');
      expect(device.isMobile).toBe(true);
      expect(device.type).toBe('mobile');
      
      restoreUA();
    });
    
    test('Android 모바일 기기 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.mobile['android']);
      
      const browser = detectBrowser(true);
      const device = detectDevice(true);
      
      expect(browser.os.name).toBe('android');
      expect(device.isMobile).toBe(true);
      expect(device.type).toBe('mobile');
      
      restoreUA();
    });
  });
  
  // 테스트 그룹: 기능 지원 확인
  describe('Feature Support Detection', () => {
    test('CSS Grid 지원 감지', () => {
      const restoreSupports = mockCssSupports({
        'display: grid': true
      });
      
      expect(isFeatureSupported('grid')).toBe(true);
      
      restoreSupports();
    });
    
    test('CSS Flexbox 지원 감지', () => {
      const restoreSupports = mockCssSupports({
        'display: flex': true
      });
      
      expect(isFeatureSupported('flexbox')).toBe(true);
      
      restoreSupports();
    });
    
    test('백드롭 필터 지원 감지', () => {
      const restoreSupports = mockCssSupports({
        'backdrop-filter: blur(5px)': true
      });
      
      expect(isFeatureSupported('backdrop-filter')).toBe(true);
      
      restoreSupports();
    });
    
    test('LocalStorage 지원 감지', () => {
      // LocalStorage는 브라우저 환경에서 이미 사용 가능하므로 모킹 불필요
      expect(isFeatureSupported('localstorage')).toBe(true);
    });
  });
  
  // 테스트 그룹: 브라우저 성능 평가
  describe('Browser Performance Grading', () => {
    beforeEach(() => {
      // 각 테스트 전에 캐시 초기화
      jest.resetModules();
    });
    
    test('고성능 브라우저 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.chrome['90']);
      
      // 고성능 환경 시뮬레이션
      Object.defineProperty(window.navigator, 'hardwareConcurrency', {
        value: 8,
        configurable: true
      });
      
      Object.defineProperty(window.navigator, 'deviceMemory', {
        value: 8,
        configurable: true
      });
      
      const performanceGrade = getBrowserPerformanceGrade(true);
      
      expect(performanceGrade).toBe('high');
      
      restoreUA();
    });
    
    test('저성능 브라우저 감지', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.mobile['android']);
      
      // 저성능 환경 시뮬레이션
      Object.defineProperty(window.navigator, 'hardwareConcurrency', {
        value: 2,
        configurable: true
      });
      
      Object.defineProperty(window.navigator, 'deviceMemory', {
        value: 1,
        configurable: true
      });
      
      const performanceGrade = getBrowserPerformanceGrade(true);
      
      expect(performanceGrade).toBe('low');
      
      restoreUA();
    });
  });
  
  // 테스트 그룹: 지원되는 브라우저 검증
  describe('Supported Browsers Configuration', () => {
    test('Chrome 최소 버전 확인', () => {
      expect(MINIMUM_BROWSER_VERSIONS.chrome).toBe(90);
    });
    
    test('Firefox 최소 버전 확인', () => {
      expect(MINIMUM_BROWSER_VERSIONS.firefox).toBe(88);
    });
    
    test('Safari 최소 버전 확인', () => {
      expect(MINIMUM_BROWSER_VERSIONS.safari).toBe(14);
    });
    
    test('Edge 최소 버전 확인', () => {
      expect(MINIMUM_BROWSER_VERSIONS.edge).toBe(90);
    });
    
    test('IE는 지원되지 않음', () => {
      expect(MINIMUM_BROWSER_VERSIONS.ie).toBe(false);
    });
    
    test('최소 지원 버전 이상 확인', () => {
      expect(isSupportedBrowserVersion('chrome', 90)).toBe(true);
      expect(isSupportedBrowserVersion('chrome', 91)).toBe(true);
    });
    
    test('최소 지원 버전 미만 확인', () => {
      expect(isSupportedBrowserVersion('chrome', 89)).toBe(false);
      expect(isSupportedBrowserVersion('firefox', 87)).toBe(false);
    });
  });
  
  // 테스트 그룹: 크로스 브라우저 스타일 생성
  describe('Cross Browser Styles Generation', () => {
    test('Flexbox 스타일 생성', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.chrome['90']);
      
      const flexStyles = createFlexStyles({
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      });
      
      expect(flexStyles.display).toBe('flex');
      expect(flexStyles.flexDirection).toBe('column');
      expect(flexStyles.justifyContent).toBe('center');
      expect(flexStyles.alignItems).toBe('center');
      
      restoreUA();
    });
    
    test('IE용 레거시 Flexbox 스타일 생성', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.ie['11']);
      
      const flexStyles = createFlexStyles({
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      });
      
      expect(flexStyles.display).toBe('-ms-flexbox');
      expect(flexStyles['-ms-flex-direction']).toBe('column');
      
      restoreUA();
    });
    
    test('백드롭 필터 스타일 생성', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.chrome['90']);
      const restoreSupports = mockCssSupports({
        'backdrop-filter: blur(5px)': true
      });
      
      const backdropStyles = createBackdropFilterStyles(10);
      
      expect(backdropStyles['backdrop-filter']).toBe('blur(10px)');
      
      restoreUA();
      restoreSupports();
    });
    
    test('백드롭 필터 미지원 브라우저용 대체 스타일 생성', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.ie['11']);
      const restoreSupports = mockCssSupports({
        'backdrop-filter: blur(5px)': false
      });
      
      const backdropStyles = createBackdropFilterStyles(10);
      
      // 백드롭 필터 대신 배경색 사용
      expect(backdropStyles['backdrop-filter']).toBeUndefined();
      expect(backdropStyles['background-color']).toBeDefined();
      
      restoreUA();
      restoreSupports();
    });
  });
  
  // 테스트 그룹: 알려진 브라우저 이슈
  describe('Known Browser Issues', () => {
    test('Safari flexbox gap 이슈 확인', () => {
      const issues = getKnownIssuesForBrowser('safari', 13);
      
      const flexGapIssue = issues.find(issue => issue.feature === 'flexbox');
      expect(flexGapIssue).toBeDefined();
    });
    
    test('iOS Safari 100vh 이슈 확인', () => {
      const issues = getKnownIssuesForBrowser('safari-ios', 14);
      
      const viewportIssue = issues.find(issue => issue.feature === '100vh');
      expect(viewportIssue).toBeDefined();
    });
    
    test('Firefox의 backdrop-filter 이슈 확인', () => {
      const issues = getKnownIssuesForBrowser('firefox', 88);
      
      const backdropIssue = issues.find(issue => issue.feature === 'backdrop-filter');
      expect(backdropIssue).toBeDefined();
    });
  });
  
  // 테스트 그룹: CSS 프리픽스 생성
  describe('CSS Vendor Prefix Generation', () => {
    test('Chrome용 프리픽스 처리', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.chrome['90']);
      
      const styles = createCrossBrowserStyles({
        transform: 'translateX(100px)',
        userSelect: 'none'
      });
      
      expect(styles.transform).toBe('translateX(100px)');
      expect(styles.WebkitUserSelect).toBe('none');
      expect(styles.userSelect).toBe('none');
      
      restoreUA();
    });
    
    test('Firefox용 프리픽스 처리', () => {
      const restoreUA = mockUserAgent(USER_AGENTS.firefox['88']);
      
      const styles = createCrossBrowserStyles({
        transform: 'translateX(100px)',
        userSelect: 'none'
      });
      
      expect(styles.transform).toBe('translateX(100px)');
      expect(styles.MozUserSelect).toBe('none');
      expect(styles.userSelect).toBe('none');
      
      restoreUA();
    });
  });
