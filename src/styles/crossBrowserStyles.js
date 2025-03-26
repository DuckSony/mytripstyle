// src/styles/crossBrowserStyles.js

/**
 * 크로스 브라우저 호환성을 위한 스타일 유틸리티
 * 
 * 이 모듈은 다양한 브라우저에서 일관된 스타일링을 적용하기 위한
 * 유틸리티 함수와 CSS 규칙을 제공합니다.
 */

import { detectBrowser, detectDevice, isFeatureSupported } from '../utils/browserDetection';

// 브라우저별 프리픽스 매핑
const VENDOR_PREFIXES = {
  chrome: '-webkit-',
  safari: '-webkit-',
  firefox: '-moz-',
  edge: '',  // Chromium 기반 Edge는 프리픽스 불필요
  'edge-legacy': '-ms-',
  opera: '-webkit-',
  ie: '-ms-'
};

// CSS 속성별 필요한 프리픽스 매핑
const PROPERTY_PREFIXES = {
  'user-select': ['-webkit-', '-moz-', '-ms-'],
  'appearance': ['-webkit-', '-moz-'],
  'backdrop-filter': ['-webkit-'],
  'box-shadow': ['-webkit-'],
  'transform': ['-webkit-', '-moz-', '-ms-'],
  'transition': ['-webkit-', '-moz-'],
  'animation': ['-webkit-', '-moz-'],
  'flex': ['-webkit-', '-ms-'],
  'flex-direction': ['-webkit-', '-ms-'],
  'flex-wrap': ['-webkit-', '-ms-'],
  'flex-flow': ['-webkit-', '-ms-'],
  'flex-grow': ['-webkit-', '-ms-'],
  'flex-shrink': ['-webkit-', '-ms-'],
  'flex-basis': ['-webkit-', '-ms-'],
  'justify-content': ['-webkit-', '-ms-'],
  'align-items': ['-webkit-', '-ms-'],
  'align-content': ['-webkit-', '-ms-'],
  'align-self': ['-webkit-', '-ms-'],
  'filter': ['-webkit-'],
  'column-count': ['-webkit-', '-moz-'],
  'column-gap': ['-webkit-', '-moz-'],
  'column-rule': ['-webkit-', '-moz-'],
  'column-width': ['-webkit-', '-moz-'],
  'column-span': ['-webkit-', '-moz-'],
  'hyphens': ['-webkit-', '-moz-', '-ms-'],
  'grid': ['-ms-'],
  'grid-template-columns': ['-ms-'],
  'grid-template-rows': ['-ms-'],
  'grid-column': ['-ms-'],
  'grid-row': ['-ms-'],
  'text-size-adjust': ['-webkit-', '-moz-', '-ms-']
};

// 알려진 브라우저별 버그 및 제한 사항 (버전별)
const BROWSER_BUGS = {
  safari: {
    14: {
      'flex-gap': true,        // Safari 14에서 flex gap 지원 제한
      'backdrop-filter': true, // 일부 backdrop-filter 제한
    },
    13: {
      'flex-gap': true,
      'backdrop-filter': true,
      'sticky-position': true, // position: sticky 이슈
    }
  },
  'safari-ios': {
    14: {
      '100vh': true,          // iOS에서 100vh 뷰포트 이슈
      'fixed-position': true, // 가상 키보드와 fixed position 문제
    },
    13: {
      '100vh': true,
      'fixed-position': true,
    }
  },
  firefox: {
    88: {
      'backdrop-filter': true, // 기본적으로 비활성화됨
    },
    89: {
      'backdrop-filter': true,
    }
  },
  ie: {
    11: {
      'all': true // 모든 현대적 CSS 기능의 제한
    }
  }
};

/**
 * 현재 브라우저에 필요한 벤더 프리픽스 가져오기
 * @returns {string} 벤더 프리픽스 또는 빈 문자열
 */
export function getVendorPrefix() {
  const browser = detectBrowser();
  return VENDOR_PREFIXES[browser.name] || '';
}

/**
 * 속성에 필요한 모든 벤더 프리픽스 CSS 코드 생성
 * @param {string} property - CSS 속성
 * @param {string} value - CSS 값
 * @returns {string} 벤더 프리픽스가 적용된 CSS 문자열
 */
export function getPrefixedCSSValue(property, value) {
  // 프리픽스가 필요한 속성인지 확인
  const prefixes = PROPERTY_PREFIXES[property] || [];
  
  // 속성이 프리픽스를 필요로 하지 않으면 일반 CSS 반환
  if (prefixes.length === 0) {
    return `${property}: ${value};`;
  }
  
  // 모든 필요한 프리픽스를 적용한 CSS 생성
  let cssText = prefixes.map(prefix => `${prefix}${property}: ${value};`).join('\n');
  
  // 표준 속성도 추가
  cssText += `\n${property}: ${value};`;
  
  return cssText;
}

/**
 * 지정된 규칙 객체에서 CSS 텍스트 생성
 * @param {Object} rules - CSS 규칙 객체 (속성-값 쌍)
 * @returns {string} 생성된 CSS 텍스트
 */
export function generatePrefixedCSS(rules) {
    let cssText = '';
    
    for (const [property, value] of Object.entries(rules)) {
      cssText += getPrefixedCSSValue(property, value) + '\n';
    }
    
    return cssText;
  }
  
  /**
   * 지정된 키프레임 애니메이션에 대한 프리픽스된 CSS 생성
   * @param {string} name - 애니메이션 이름
   * @param {Object} keyframes - 키프레임 객체
   * @returns {string} 생성된 키프레임 CSS
   */
  export function generatePrefixedKeyframes(name, keyframes) {
    const prefixes = ['-webkit-', '-moz-', ''];
    let cssText = '';
    
    for (const prefix of prefixes) {
      cssText += `@${prefix}keyframes ${name} {\n`;
      
      for (const [position, rules] of Object.entries(keyframes)) {
        cssText += `  ${position} {\n`;
        for (const [property, value] of Object.entries(rules)) {
          cssText += `    ${getPrefixedCSSValue(property, value).replace(/;/g, ';').replace(/\n/g, '\n    ')}\n`;
        }
        cssText += '  }\n';
      }
      
      cssText += '}\n\n';
    }
    
    return cssText;
  }
  
  /**
   * 크로스 브라우저 호환성을 위한 스타일 객체 생성
   * 지정된 스타일에 필요한 모든 벤더 프리픽스 추가
   * @param {Object} styles - 원본 스타일 객체
   * @returns {Object} 벤더 프리픽스가 적용된 스타일 객체
   */
  export function createCrossBrowserStyles(styles) {
    const prefixedStyles = {};
    
    for (const [key, value] of Object.entries(styles)) {
      if (typeof value === 'string') {
        // CSS 문자열 값인 경우, 필요에 따라 프리픽스를 추가하지만 
        // 객체 속성명은 그대로 유지
        prefixedStyles[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        // 중첩된 스타일 객체인 경우 재귀적으로 처리
        prefixedStyles[key] = createCrossBrowserStyles(value);
      } else {
        // 다른 값(숫자, 불리언 등)은 그대로 유지
        prefixedStyles[key] = value;
      }
    }
    
    return prefixedStyles;
  }
  
  /**
   * 지정된 CSS 선택자와 규칙으로 스타일 요소 생성 및 삽입
   * @param {string} selector - CSS 선택자
   * @param {Object} rules - CSS 규칙 객체
   * @param {string} [id] - 스타일 요소 ID (선택적)
   * @returns {HTMLStyleElement} 생성된 스타일 요소
   */
  export function insertCrossCompatibleStyles(selector, rules, id) {
    // 기존 스타일 요소가 있는지 확인
    if (id && document.getElementById(id)) {
      const existingStyle = document.getElementById(id);
      existingStyle.parentNode.removeChild(existingStyle);
    }
    
    // 새 스타일 요소 생성
    const styleElement = document.createElement('style');
    if (id) {
      styleElement.id = id;
    }
    
    // CSS 텍스트 생성
    let cssText = `${selector} {\n`;
    cssText += generatePrefixedCSS(rules);
    cssText += '}\n';
    
    // 스타일 요소에 CSS 추가
    styleElement.textContent = cssText;
    
    // DOM에 스타일 요소 삽입
    document.head.appendChild(styleElement);
    
    return styleElement;
  }

  /**
 * 현재 브라우저에 맞는 flexbox 스타일 생성
 * @param {Object} flexProps - 플렉스 속성 객체
 * @returns {Object} 호환성이 적용된 플렉스 스타일 객체
 */
export function createFlexStyles(flexProps) {
    const browser = detectBrowser();
    const prefixedStyles = {};
    
    // 기본 플렉스 속성 설정
    prefixedStyles.display = 'flex';
    
    // 필요에 따라 레거시 플렉스박스 지원 추가
    if (browser.name === 'ie' || (browser.name === 'safari' && browser.versionNumber < 9)) {
      prefixedStyles.display = '-ms-flexbox'; // IE 10
      
      if (flexProps.flexDirection) {
        if (flexProps.flexDirection === 'column') {
          prefixedStyles['-ms-flex-direction'] = 'column';
          prefixedStyles.flexDirection = 'column';
        } else {
          prefixedStyles['-ms-flex-direction'] = 'row';
          prefixedStyles.flexDirection = 'row';
        }
      }
      
      // flex-wrap 처리
      if (flexProps.flexWrap) {
        prefixedStyles['-ms-flex-wrap'] = flexProps.flexWrap;
        prefixedStyles.flexWrap = flexProps.flexWrap;
      }
      
      // justify-content 처리
      if (flexProps.justifyContent) {
        const value = flexProps.justifyContent;
        let msValue = value;
        
        // IE 10은 다른 값 이름을 사용
        if (value === 'flex-start') msValue = 'start';
        else if (value === 'flex-end') msValue = 'end';
        else if (value === 'space-between') msValue = 'justify';
        else if (value === 'space-around') msValue = 'distribute';
        
        prefixedStyles['-ms-justify-content'] = msValue;
        prefixedStyles.justifyContent = value;
      }
      
      // align-items 처리
      if (flexProps.alignItems) {
        const value = flexProps.alignItems;
        let msValue = value;
        
        if (value === 'flex-start') msValue = 'start';
        else if (value === 'flex-end') msValue = 'end';
        
        prefixedStyles['-ms-align-items'] = msValue;
        prefixedStyles.alignItems = value;
      }
    } else {
      // 모던 브라우저는 표준 속성 사용
      Object.assign(prefixedStyles, flexProps);
    }
    
    return prefixedStyles;
  }
  
  /**
   * 높이 100vh 문제를 해결하는 스타일 생성 (iOS Safari 이슈)
   * @param {string} [fallbackUnit='%'] - 대체 단위
   * @returns {Object} 호환성이 적용된 높이 스타일 객체
   */
  export function createFullHeightStyles(fallbackUnit = '%') {
    const device = detectDevice();
    const browser = detectBrowser();
    const isIOS = device.os && device.os.name === 'ios';
    const isSafari = browser.name === 'safari' || (isIOS && browser.name === 'mobile-safari');
    
    // iOS Safari에서 100vh 문제 해결
    if (isIOS || (isSafari && browser.versionNumber <= 15)) {
      return {
        height: '100%', // 대체 높이
        minHeight: `-webkit-fill-available`, // iOS Safari용 특별 값
        maxHeight: `-webkit-fill-available`,
        // JavaScript로 실제 뷰포트 높이 설정을 위한 지원 추가
        '--vh': `${window.innerHeight * 0.01}px` // CSS 변수로 사용 가능
      };
    }
    
    // 다른 브라우저에서는 표준 100vh 사용
    return {
      height: '100vh',
      minHeight: '100vh'
    };
  }
  
  /**
   * 반응형 폰트 크기 조정을 위한 스타일 생성 (모든 브라우저 지원)
   * @returns {Object} 호환성이 적용된 텍스트 크기 조정 스타일
   */
  export function createResponsiveTextStyles() {
    return {
      '-webkit-text-size-adjust': '100%',
      '-moz-text-size-adjust': '100%',
      '-ms-text-size-adjust': '100%',
      'text-size-adjust': '100%'
    };
  }
  
  /**
   * 부드러운 스크롤 동작을 위한 스타일 생성
   * @param {string} [behavior='smooth'] - 스크롤 동작 ('smooth' 또는 'auto')
   * @returns {Object} 호환성이 적용된 스크롤 동작 스타일
   */
  export function createSmoothScrollStyles(behavior = 'smooth') {
    const browser = detectBrowser();
    
    // IE는 CSS scroll-behavior를 지원하지 않음
    if (browser.name === 'ie') {
      // IE의 경우 JavaScript를 통한 스크롤 구현 필요
      return {};
    }
    
    return {
      'scroll-behavior': behavior
    };
  }
  
  /**
   * 현재 브라우저에 맞는 모달 백드롭 필터 스타일 생성
   * @param {number} [blur=5] - 블러 강도 (픽셀)
   * @returns {Object} 호환성이 적용된 백드롭 필터 스타일
   */
  // createBackdropFilterStyles 함수 내에서 BROWSER_BUGS 활용
export function createBackdropFilterStyles(blur = 5) {
    const browser = detectBrowser();
    const isSupported = isFeatureSupported('css-supports') &&
                        CSS.supports('backdrop-filter', 'blur(5px)');
    
    // BROWSER_BUGS 활용하여 알려진 버그 확인
    const hasBug = browser.name in BROWSER_BUGS && 
                   BROWSER_BUGS[browser.name][browser.versionNumber] && 
                   BROWSER_BUGS[browser.name][browser.versionNumber]['backdrop-filter'];
    
    if (!isSupported || hasBug) {
      // 백드롭 필터 미지원 브라우저용 대체 스타일
      return {
        'background-color': 'rgba(255, 255, 255, 0.8)' // 반투명 배경색으로 대체
      };
    }
  
    const styles = {
      'backdrop-filter': `blur(${blur}px)`
    };
    
    // Safari용 프리픽스 추가
    if (browser.name === 'safari' || browser.name === 'ios-safari') {
      styles['-webkit-backdrop-filter'] = `blur(${blur}px)`;
    }
    
    return styles;
  }
  
  /**
   * 브라우저별 애니메이션 최적화 스타일 생성
   * @returns {Object} 성능 최적화된 애니메이션 스타일
   */
  export function createOptimizedAnimationStyles() {
    const device = detectDevice();
    const performanceGrade = device.performanceGrade || 'medium';
    const isLowPerformance = performanceGrade === 'low';
    
    // 저성능 기기에서 하드웨어 가속 최적화
    if (isLowPerformance || device.isMobile) {
      return {
        'transform': 'translateZ(0)', // 하드웨어 가속 활성화
        'backface-visibility': 'hidden',
        'perspective': '1000px',
        'will-change': 'transform', // 성능 힌트
        'transform-style': 'preserve-3d',
        // 애니메이션 품질 조정
        'image-rendering': 'optimizeSpeed'
      };
    }
    
    // 고성능 기기에서 더 높은 품질의 애니메이션
    return {
      'transform': 'translateZ(0)',
      'backface-visibility': 'hidden',
      'will-change': 'transform, opacity'
    };
  }
  
  /**
   * 반응형 그리드 레이아웃을 위한 크로스 브라우저 스타일 생성
   * @param {number} columns - 열 수
   * @param {string} gap - 간격 (CSS 단위)
   * @returns {Object} 호환성이 적용된 그리드 스타일
   */
  export function createGridStyles(columns, gap) {
    const browser = detectBrowser();
    const ieVersion = (browser.name === 'ie') ? parseInt(browser.version, 10) : null;
    
    // IE 11은 -ms- 프리픽스와 다른 문법을 사용
    if (ieVersion && ieVersion <= 11) {
      return createLegacyGridForIE(columns, gap);
    }
    
    // 모던 브라우저용 표준 그리드
    return {
      display: 'grid',
      'grid-template-columns': `repeat(${columns}, 1fr)`,
      'grid-gap': gap
    };
  }
  
  /**
   * IE 11을 위한 레거시 그리드 스타일 생성
   * @param {number} columns - 열 수
   * @param {string} gap - 간격 (CSS 단위)
   * @returns {Object} IE 호환 그리드 스타일
   */
  function createLegacyGridForIE(columns, gap) {
    // IE용 display 속성 설정 (중복 제거)
    const styles = {
      display: '-ms-grid',
      '-ms-grid-columns': Array(columns).fill('1fr').join(' '),
      'grid-template-columns': `repeat(${columns}, 1fr)`
    };
    
    // IE는 grid-gap을 직접 지원하지 않으므로 대체 스타일 필요
    const parsedGap = {
      value: gap.replace(/[^0-9.]/g, ''),
      unit: gap.replace(/[0-9.]/g, '') || 'px'
    };
    
    // 개발자에게 경고 및 대체 방법 제안
    console.warn(`IE에서는 grid-gap이 직접 지원되지 않습니다. 
    각 그리드 아이템에 margin: ${gap}를 적용하는 것이 좋습니다.`);
    
    // 그리드 갭 값을 styles 객체에 저장 (나중에 JavaScript로 활용 가능)
    styles.gridGapValue = parsedGap.value;
    styles.gridGapUnit = parsedGap.unit;
    
    return styles;
  }
  
  /**
   * 다양한 모바일 브라우저에서 스크롤 문제를 해결하는 스타일 생성
   * @returns {Object} 최적화된 스크롤 스타일
   */
  export function createScrollOptimizationStyles() {
    const device = detectDevice();
    
    if (device.isMobile || device.isTablet) {
      return {
        '-webkit-overflow-scrolling': 'touch', // iOS 스크롤 성능 향상
        'overscroll-behavior': 'contain', // 모바일에서 오버스크롤 동작 제어
        'scroll-behavior': 'smooth',
        // 스크롤 렌더링 성능 최적화
        'will-change': 'scroll-position'
      };
    }
    
    return {
      'overscroll-behavior': 'contain',
      'scroll-behavior': 'smooth'
    };
  }
  
  /**
   * 사파리 CSS 그리드 버그 해결을 위한 스타일 생성
   * - Safari에서는 display: contents가 일부 버전에서 제대로 작동하지 않음
   * @returns {Object} Safari 호환 그리드 스타일
   */
  export function createSafariGridFix() {
    const browser = detectBrowser();
    
    if (browser.name === 'safari' && browser.versionNumber < 14) {
      return {
        // Safari 13 이하에서는 display: contents 문제 해결
        'display': 'block', // 대체 스타일
        '@supports (display: grid)': {
          'display': 'block' // 그리드 지원 브라우저에서도 block 사용
        }
      };
    }
    
    return {
      'display': 'contents'
    };
  }
  
  /**
   * 모든 브라우저에서 일관된 초기화 스타일 생성
   * @returns {Object} 크로스 브라우저 호환 초기화 스타일
   */
  export function createCrossCompatibleResetStyles() {
    return {
      'box-sizing': 'border-box',
      'text-size-adjust': '100%',
      '-webkit-tap-highlight-color': 'rgba(0, 0, 0, 0)',
      // 터치 디바이스 최적화
      'touch-action': 'manipulation',
      // iOS에서 전화번호 자동 감지 비활성화
      'text-decoration': 'none',
      'user-select': 'none',
      '-webkit-touch-callout': 'none',
      // 모던한 텍스트 렌더링
      'text-rendering': 'optimizeLegibility',
      '-webkit-font-smoothing': 'antialiased',
      '-moz-osx-font-smoothing': 'grayscale'
    };
  }
  
  /**
   * 터치 기기에서 탭 상호작용 최적화 스타일 생성
   * @returns {Object} 터치 최적화 스타일
   */
  export function createTouchOptimizationStyles() {
    const device = detectDevice();
    
    if (device.hasTouch) {
      return {
        // 터치 피드백 비활성화
        '-webkit-tap-highlight-color': 'transparent',
        // 터치 상호작용 최적화
        'touch-action': 'manipulation',
        // 터치 타겟 크기 최적화 (최소 44x44px 권장)
        'min-height': '44px',
        'min-width': '44px',
        // 텍스트 선택 방지 (의도하지 않은 선택 방지)
        'user-select': 'none',
        '-webkit-user-select': 'none',
        '-moz-user-select': 'none',
        '-ms-user-select': 'none'
      };
    }
    
    return {};
  }
  
  // 모듈 내보내기
  const crossBrowserStyles = {
    getVendorPrefix,
    getPrefixedCSSValue,
    generatePrefixedCSS,
    generatePrefixedKeyframes,
    createCrossBrowserStyles,
    insertCrossCompatibleStyles,
    createFlexStyles,
    createFullHeightStyles,
    createResponsiveTextStyles,
    createSmoothScrollStyles,
    createBackdropFilterStyles,
    createOptimizedAnimationStyles,
    createGridStyles,
    createScrollOptimizationStyles,
    createSafariGridFix,
    createCrossCompatibleResetStyles,
    createTouchOptimizationStyles
  };
  
  export default crossBrowserStyles;
