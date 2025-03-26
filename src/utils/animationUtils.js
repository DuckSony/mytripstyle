// src/utils/animationUtils.js

/**
 * 애니메이션 관련 유틸리티 함수와 프리셋 모음
 * 모바일 최적화, 제스처 지원, 성능 감지 기능 포함
 * 2025년 3월 업데이트: 성능 최적화 및 통합 시스템 구축
 */

// ----- 기기 및 환경 감지 유틸리티 ----- //

// 접근성 관련 - 사용자가 애니메이션 감소 설정을 선호하는지 확인
export const prefersReducedMotion = typeof window !== 'undefined' 
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
  : false;

// 모바일 장치 감지
export const isMobileDevice = () => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(max-width: 600px)').matches || 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  return false;
};

// 태블릿 장치 감지
export const isTabletDevice = () => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(min-width: 601px) and (max-width: 960px)').matches;
  }
  return false;
};

// 고성능 모드인지 감지 (60fps 지원)
export const isHighPerformanceDevice = () => {
  // 모션 감소 선호 설정이 있으면 고성능 모드 비활성화
  if (prefersReducedMotion) return false;
  
  // 저사양 모바일 기기는 고성능 모드 비활성화
  if (isMobileDevice() && (
    // 저사양 모바일 감지 로직
    (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4) ||
    /low|medium/i.test(navigator.connection?.effectiveType || '')
  )) {
    return false;
  }
  
  return true;
};

// 애니메이션 설정 캐시 (성능 최적화)
const animationConfigCache = {
  lastUpdate: Date.now(),
  settings: {},
};

// ----- 성능 감지 및 최적화 유틸리티 ----- //

// 장치 성능 감지 함수 (향상된 버전)
export const detectDevicePerformance = () => {
  try {
    // 캐시된 결과가 있으면 반환 (5분 캐시)
    const now = Date.now();
    const cachedResult = animationConfigCache.devicePerformance;
    
    if (cachedResult && now - animationConfigCache.lastUpdate < 300000) {
      return cachedResult;
    }
    
    // 모션 감소 설정이 활성화된 경우 항상 'low' 반환
    if (prefersReducedMotion) {
      const result = 'low';
      animationConfigCache.devicePerformance = result;
      return result;
    }
    
    // 기기 정보 수집
    const memory = navigator?.deviceMemory || 4; // 기본값 4GB
    const isMobile = isMobileDevice();
    const isTablet = isTabletDevice();
    const connection = navigator?.connection;
    const connectionType = connection?.effectiveType || 'unknown';
    
    // 저사양 기기 감지
    if (
      memory <= 2 || 
      connectionType === 'slow-2g' || 
      connectionType === '2g' ||
      (isMobile && window.innerWidth < 360)
    ) {
      const result = 'low';
      animationConfigCache.devicePerformance = result;
      return result;
    } 
    
    // 중간 사양 기기 감지
    if (
      memory <= 4 || 
      connectionType === '3g' || 
      isMobile || 
      isTablet
    ) {
      const result = 'medium';
      animationConfigCache.devicePerformance = result;
      return result;
    }
    
    // 기본값은 'high'
    const result = 'high';
    animationConfigCache.devicePerformance = result;
    return result;
  } catch (error) {
    console.warn('성능 감지 중 오류 발생:', error);
    return 'medium'; // 오류 시 기본값
  }
};

// 성능 측정 유틸리티
export const startPerformanceMeasure = (id) => {
  // development 모드에서만 성능 측정
  if (process.env.NODE_ENV !== 'development') {
    return () => {};
  }
  
  const start = performance.now();
  
  return () => {
    const end = performance.now();
    const duration = end - start;
    console.log(`⚡ ${id}: ${duration.toFixed(2)}ms`);
    
    // 느린 작업 경고 (100ms 이상)
    if (duration > 100) {
      console.warn(`⚠️ 느린 작업 감지: ${id} (${duration.toFixed(2)}ms)`);
    }
  };
};

// 디바이스 타입에 따른 애니메이션 지속 시간 조정
export const getDeviceAdjustedDuration = (duration) => {
  // 모션 감소 설정이 켜져 있으면 매우 짧은 시간으로 설정
  if (prefersReducedMotion) return Math.min(duration * 0.5, 150);
  
  // 성능 수준에 따른 조정
  const devicePerformance = detectDevicePerformance();
  
  switch (devicePerformance) {
    case 'low':
      return Math.min(duration * 0.6, 200);
    case 'medium':
      return duration * 0.8;
    case 'high':
    default:
      return duration;
  }
};

// ----- 애니메이션 설정 및 구성 유틸리티 ----- //

// 성능 수준에 맞는 애니메이션 설정 가져오기
export const getOptimizedAnimation = (options = {}) => {
  try {
    const devicePerformance = detectDevicePerformance();
    const isMobile = isMobileDevice();
    const now = Date.now();
    
    // 캐시 키 생성
    const cacheKey = `${devicePerformance}_${isMobile ? 'mobile' : 'desktop'}_${prefersReducedMotion ? 'reduced' : 'normal'}`;
    
    // 캐시된 설정이 최신인지 확인 (30초마다 새로고침)
    if (animationConfigCache.settings[cacheKey] && now - animationConfigCache.lastUpdate < 30000) {
      return animationConfigCache.settings[cacheKey];
    }
    
    // 기본 설정
    const baseSettings = {
      enableGestures: !prefersReducedMotion && devicePerformance !== 'low',
      enableParallax: !prefersReducedMotion && devicePerformance === 'high' && !isMobile,
      enableAdvancedEffects: !prefersReducedMotion && devicePerformance !== 'low',
      enableHapticFeedback: isMobile,
      useSimpleAnimations: prefersReducedMotion || devicePerformance === 'low',
      
      duration: {
        veryFast: getDeviceAdjustedDuration(150),
        fast: getDeviceAdjustedDuration(200),
        normal: getDeviceAdjustedDuration(300),
        slow: getDeviceAdjustedDuration(500),
        verySlow: getDeviceAdjustedDuration(800)
      },
      
      easing: {
        // 기본 Material UI 이징
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
        
        // 추가 커스텀 이징
        bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        fastOutSlowIn: 'cubic-bezier(0.4, 0, 0.2, 1)',
        swiftOut: 'cubic-bezier(0, 0, 0.2, 1)',
        
        // 모바일 최적화 이징 (더 직접적인 움직임)
        mobileFriendly: 'cubic-bezier(0.25, 0.5, 0.5, 1)',
      },
      
      // 스프링 애니메이션 설정
      spring: devicePerformance === 'low' ? {
        // 저사양 기기용 가벼운 스프링 설정
        gentle: {
          type: 'spring',
          stiffness: 100,
          damping: 15
        },
        responsive: {
          type: 'spring',
          stiffness: 120,
          damping: 12
        }
      } : {
        // 일반 기기용 스프링 설정
        gentle: {
          type: 'spring',
          stiffness: 170,
          damping: 22
        },
        responsive: {
          type: 'spring',
          stiffness: 260,
          damping: 20
        },
        bouncy: {
          type: 'spring',
          stiffness: 300,
          damping: 10
        },
        slow: {
          type: 'spring',
          stiffness: 120,
          damping: 25
        }
      },
      
      // 반응형 설정
      responsive: isMobile ? {
        staggerDelay: 0.03,
        reducedEffects: true,
        simplifiedAnimations: true
      } : isTabletDevice() ? {
        staggerDelay: 0.05,
        reducedEffects: false,
        simplifiedAnimations: false
      } : {
        staggerDelay: 0.08,
        reducedEffects: false,
        simplifiedAnimations: false
      }
    };
    
    // 사용자 옵션으로 기본 설정 확장
    const mergedSettings = {
      ...baseSettings,
      ...options
    };
    
    // 결과 캐싱
    animationConfigCache.settings[cacheKey] = mergedSettings;
    animationConfigCache.lastUpdate = now;
    
    return mergedSettings;
  } catch (error) {
    console.warn('애니메이션 설정 최적화 중 오류:', error);
    
    // 오류 발생 시 안전한 기본값 반환
    return {
      enableGestures: false,
      enableParallax: false,
      enableAdvancedEffects: false,
      useSimpleAnimations: true,
      duration: {
        veryFast: 150,
        fast: 200,
        normal: 300,
        slow: 500,
        verySlow: 800
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    };
  }
};

// ----- Framer Motion 애니메이션 프리셋 ----- //


// 성능 수준에 따른 애니메이션 변형
const getPerformanceVariants = (variants) => {
  const devicePerformance = detectDevicePerformance();
  
  if (prefersReducedMotion || devicePerformance === 'low') {
    // 저성능 기기용 간소화된 변형
    return {
      initial: { opacity: 0 },
      animate: { 
        opacity: 1,
        transition: { duration: 0.2 }
      },
      exit: { 
        opacity: 0,
        transition: { duration: 0.1 }
      }
    };
  }
  
  return variants;
};

// 페이지 전환 애니메이션
export const pageTransitions = {
  fade: getPerformanceVariants({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: getDeviceAdjustedDuration(0.3) }
  }),
  
  slideUp: getPerformanceVariants({
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: isMobileDevice() ? 220 : 300, 
        damping: isMobileDevice() ? 25 : 20 
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: getDeviceAdjustedDuration(0.2) }
    }
  }),
  
  slideLeft: getPerformanceVariants({
    initial: { opacity: 0, x: 20 },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: { 
        type: 'spring', 
        stiffness: isMobileDevice() ? 220 : 300, 
        damping: isMobileDevice() ? 25 : 20 
      }
    },
    exit: { 
      opacity: 0, 
      x: -20,
      transition: { duration: getDeviceAdjustedDuration(0.2) }
    }
  }),
  
  scale: getPerformanceVariants({
    initial: { opacity: 0, scale: 0.95 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: 'spring', 
        stiffness: isMobileDevice() ? 220 : 300, 
        damping: isMobileDevice() ? 25 : 20 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      transition: { duration: getDeviceAdjustedDuration(0.2) }
    }
  })
};

// 컴포넌트 애니메이션
export const componentVariants = {
  fadeIn: getPerformanceVariants({
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { duration: getDeviceAdjustedDuration(0.3) }
    }
  }),
  
  slideUp: getPerformanceVariants({
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: isMobileDevice() ? 220 : 300, 
        damping: isMobileDevice() ? 25 : 20 
      }
    }
  }),
  
  popIn: getPerformanceVariants({
    initial: { opacity: 0, scale: 0.8 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: 'spring', 
        stiffness: 280, 
        damping: 20 
      }
    }
  }),
  
  stagger: {
    container: getPerformanceVariants({
      initial: { opacity: 0 },
      animate: { 
        opacity: 1,
        transition: { 
          staggerChildren: isMobileDevice() ? 0.05 : 0.08,
          delayChildren: 0.1
        }
      }
    }),
    
    item: getPerformanceVariants({
      initial: { opacity: 0, y: 10 },
      animate: { 
        opacity: 1, 
        y: 0,
        transition: { 
          type: 'spring', 
          stiffness: 220, 
          damping: 20 
        }
      }
    })
  }
};

// 상호작용 애니메이션
export const interactionVariants = {
  hover: prefersReducedMotion || isMobileDevice()
    ? {} // 모바일 또는 모션 감소 설정 시 호버 효과 비활성화
    : { 
        scale: 1.03, 
        y: -3,
        transition: { 
          type: 'spring', 
          stiffness: 300, 
          damping: 15 
        }
      },
      
  tap: { 
    scale: 0.97,
    transition: { duration: getDeviceAdjustedDuration(0.1) }
  },
  
  press: {
    scale: 0.95,
    transition: { duration: getDeviceAdjustedDuration(0.1) }
  }
};

// 모달 및 다이얼로그 애니메이션
export const modalVariants = getPerformanceVariants({
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30
    }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: 20,
    transition: { duration: 0.2 }
  }
});

// 확장/축소 토글 애니메이션
export const expandVariants = getPerformanceVariants({
  collapsed: { height: 0, opacity: 0, overflow: 'hidden' },
  expanded: { 
    height: 'auto', 
    opacity: 1,
    transition: {
      height: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  }
});

// 자주 사용되는 프리셋 별칭 (간편 액세스용)
export const fadeVariants = componentVariants.fadeIn;
export const slideUpVariants = componentVariants.slideUp;
export const popInVariants = componentVariants.popIn;
export const staggerContainerVariants = componentVariants.stagger.container;
export const staggerItemVariants = componentVariants.stagger.item;
export const hoverEffect = interactionVariants.hover;
export const tapEffect = interactionVariants.tap;
export const pressEffect = interactionVariants.press;

// ----- 스와이프 제스처 및 터치 유틸리티 ----- //

// 스와이프 제스처 핸들러 생성
export const createSwipeHandlers = (options = {}) => {
  // 성능 또는 접근성 문제로 제스처 비활성화
  if (prefersReducedMotion) return {};
  
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.3,
    preventDefaultTouchMove = false
  } = options;
  
  // 저성능 기기에서는 제스처 감지 최적화 (터치 이벤트 간소화)
  const devicePerformance = detectDevicePerformance();
  if (devicePerformance === 'low') {
    // 간소화된 제스처 핸들러 반환
    return {
      onTouchEnd: (e) => {
        const touch = e.changedTouches[0];
        const startTouch = e.target._touchStartPos;
        
        if (!startTouch) return;
        
        const deltaX = touch.clientX - startTouch.x;
        const deltaY = touch.clientY - startTouch.y;
        
        // 수평 스와이프가 수직보다 큰 경우
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // 오른쪽으로 스와이프
          if (deltaX > threshold && onSwipeRight) {
            onSwipeRight(e);
          }
          // 왼쪽으로 스와이프
          else if (deltaX < -threshold && onSwipeLeft) {
            onSwipeLeft(e);
          }
        } 
        // 수직 스와이프가 수평보다 큰 경우
        else {
          // 아래로 스와이프
          if (deltaY > threshold && onSwipeDown) {
            onSwipeDown(e);
          }
          // 위로 스와이프
          else if (deltaY < -threshold && onSwipeUp) {
            onSwipeUp(e);
          }
        }
      },
      onTouchStart: (e) => {
        const touch = e.touches[0];
        // 시작 위치 저장
        e.target._touchStartPos = {
          x: touch.clientX,
          y: touch.clientY
        };
      }
    };
  }
  
  // 일반적인 제스처 핸들러 로직
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let touchStartTime = 0;
  
  const handleTouchStart = (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  };
  
  const handleTouchMove = (e) => {
    if (preventDefaultTouchMove) {
      e.preventDefault();
    }
  };
  
  const handleTouchEnd = (e) => {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const timeElapsed = Date.now() - touchStartTime;
    const velocityX = Math.abs(deltaX) / timeElapsed;
    const velocityY = Math.abs(deltaY) / timeElapsed;
    
    // 수평 스와이프가 수직보다 큰 경우
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 오른쪽으로 스와이프
      if (deltaX > threshold && velocityX > velocityThreshold && onSwipeRight) {
        onSwipeRight(e);
      }
      // 왼쪽으로 스와이프
      else if (deltaX < -threshold && velocityX > velocityThreshold && onSwipeLeft) {
        onSwipeLeft(e);
      }
    } 
    // 수직 스와이프가 수평보다 큰 경우
    else {
      // 아래로 스와이프
      if (deltaY > threshold && velocityY > velocityThreshold && onSwipeDown) {
        onSwipeDown(e);
      }
      // 위로 스와이프
      else if (deltaY < -threshold && velocityY > velocityThreshold && onSwipeUp) {
        onSwipeUp(e);
      }
    }
  };
  
  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

// 햅틱 피드백 함수 (진동 API 사용)
export const triggerHapticFeedback = (pattern = 'default') => {
  if (!isMobileDevice() || !navigator.vibrate) return false;
  
  // 패턴별 진동 설정
  const patterns = {
    default: [20],
    success: [30],
    warning: [20, 50, 20],
    error: [50, 100, 50],
    light: [10],
    medium: [20],
    heavy: [40]
  };
  
  try {
    navigator.vibrate(patterns[pattern] || patterns.default);
    return true;
  } catch (error) {
    console.warn('햅틱 피드백 실행 중 오류:', error);
    return false;
  }
};

// ----- 애니메이션 지원 유틸리티 ----- //

// 애니메이션을 접근성에 맞게 조정하는 유틸리티
export const getAccessibleAnimationProps = (animationProps) => {
  if (prefersReducedMotion) {
    // 애니메이션 감소 설정이 활성화된 경우 간소화된 애니메이션 제공
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.1 }
    };
  }
  return animationProps;
};

// 애니메이션 지연 생성 유틸리티
export const getStaggeredDelay = (index, baseDelay = 0.03) => {
  const devicePerformance = detectDevicePerformance();
  
  // 성능에 따라 지연 간격 조정
  switch (devicePerformance) {
    case 'low':
      return index * Math.min(baseDelay * 0.5, 0.01); // 최소화
    case 'medium':
      return index * (baseDelay * 0.7);
    default:
      return index * baseDelay;
  }
};

// 슬라이드 인 애니메이션 (방향 지정)
export const slideInVariants = (direction = 'up', distance = 20) => {
  let axis, value;
  
  switch(direction) {
    case 'up':
      axis = 'y';
      value = distance;
      break;
    case 'down':
      axis = 'y';
      value = -distance;
      break;
    case 'left':
      axis = 'x';
      value = distance;
      break;
    case 'right':
      axis = 'x';
      value = -distance;
      break;
    default:
      axis = 'y';
      value = distance;
  }
  
  return getPerformanceVariants({
    hidden: { opacity: 0, [axis]: value },
    visible: {
      opacity: 1,
      [axis]: 0,
      transition: {
        opacity: { duration: getDeviceAdjustedDuration(0.3) },
        [axis]: { type: 'spring', stiffness: 300, damping: 30 }
      }
    }
  });
};

// 페이지 레이아웃 변경 애니메이션
export const layoutTransition = {
  type: 'spring',
  stiffness: prefersReducedMotion ? 100 : 200,
  damping: prefersReducedMotion ? 30 : 25,
  duration: prefersReducedMotion ? 0.1 : undefined
};

// CSS 애니메이션에 대한 지원 감지
export const supportsCSS = (property, value) => {
  if (typeof document === 'undefined') return false;
  
  const element = document.createElement('div');
  
  if (property in element.style) {
    element.style[property] = value;
    return element.style[property] === value;
  }
  
  return false;
};

// 애니메이션 성능 카운터
let animationCount = 0;
const maxConcurrentAnimations = 5; // 동시 애니메이션 제한

export const shouldLimitAnimation = () => {
  if (prefersReducedMotion) return true;
  
  const devicePerformance = detectDevicePerformance();
  if (devicePerformance === 'low' && animationCount >= 2) return true;
  if (devicePerformance === 'medium' && animationCount >= 3) return true;
  return animationCount >= maxConcurrentAnimations;
};

export const registerAnimation = () => {
  animationCount++;
  return () => {
    animationCount = Math.max(0, animationCount - 1);
  };
};

// 최적화된 애니메이션 활성화 여부 확인
export const canUseAnimations = () => {
  if (prefersReducedMotion) return false;
  
  const devicePerformance = detectDevicePerformance();
  return devicePerformance !== 'low';
};

// 기존 containerVariants 추가 (staggerContainerVariants 대신 사용했던 것으로 보임)
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
};

// 다양한 화면 크기에 대한 반응형 애니메이션 설정 추가
export const responsiveAnimationSettings = {
  mobile: {
    staggerDelay: 0.02,
    simpleTransitions: true,
    reduceParallax: true
  },
  tablet: {
    staggerDelay: 0.05,
    simpleTransitions: false,
    reduceParallax: true
  },
  desktop: {
    staggerDelay: 0.08,
    simpleTransitions: false,
    reduceParallax: false
  }
};
