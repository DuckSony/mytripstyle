// src/components/animation/PageTransitionsManager.js
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  prefersReducedMotion, 
  isMobileDevice, 
  detectDevicePerformance 
} from '../../utils/animationUtils';

// 경로별 전환 설정 정의 - 모바일/데스크톱에 따라 다른 전환 효과 정의
const routeTransitionMap = {
  // 홈 페이지
  '/': {
    default: 'fade',
    mobile: 'fade',
    desktop: 'fade',
    from: {
      '/place': 'scaleDown',
      '/recommendations': 'slideDown',
      '/login': 'fade',
      '/register': 'fade'
    }
  },
  
  // 장소 상세 페이지 (와일드카드)
  'place': {
    default: 'scale',
    mobile: 'slideUp',
    desktop: 'scale',
    from: {
      '/': 'scale',
      '/recommendations': 'slideLeft',
      '/saved-places': 'slideLeft'
    }
  },
  
  // 추천 페이지
  '/recommendations': {
    default: 'slideUp',
    mobile: 'slideUp',
    desktop: 'slideUp',
    from: {
      '/': 'slideUp'
    }
  },
  
  // 저장된 장소 페이지
  '/saved-places': {
    default: 'slide',
    mobile: 'slideLeft',
    desktop: 'slide',
    from: {
      '/': 'slideLeft',
      '/recommendations': 'slideLeft'
    }
  },
  
  // 방문 기록 페이지
  '/visit-history': {
    default: 'slide',
    mobile: 'slideLeft',
    desktop: 'slide'
  },
  
  // 검색 페이지
  '/search': {
    default: 'fade',
    mobile: 'slideUp',
    desktop: 'fade'
  },
  
  // 프로필 페이지
  '/profile': {
    default: 'slide',
    mobile: 'slideLeft',
    desktop: 'slide'
  },
  
  // 설정 페이지
  '/settings': {
    default: 'slide',
    mobile: 'slideLeft',
    desktop: 'slide'
  },
  
  // 로그인 페이지
  '/login': {
    default: 'fade',
    mobile: 'slideUp',
    desktop: 'fade'
  },
  
  // 회원가입 페이지
  '/register': {
    default: 'fade',
    mobile: 'slideUp',
    desktop: 'fade'
  }
};

// 페이지 전환 컨텍스트 생성
const PageTransitionContext = createContext({
  previousPath: null,
  currentPath: '/',
  transitionName: 'fade',
  setTransitionName: () => {},
  getTransitionForRoute: () => 'fade',
  applyCustomTransition: () => {}
});

/**
 * 페이지 간 전환 애니메이션을 관리하는 컨텍스트 제공자
 * - 디바이스 성능 및 모바일 상태에 따른 맞춤형 전환 제공
 * - 경로 기반 지능형 전환 결정
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - 자식 컴포넌트
 */
export const PageTransitionProvider = ({ children }) => {
  const location = useLocation();
  const [previousPath, setPreviousPath] = useState(null);
  const [transitionName, setTransitionName] = useState('fade');
  const [customTransition, setCustomTransition] = useState(null);
  
  // 디바이스 정보 확인
  const isMobile = isMobileDevice();
  const isReducedMotion = prefersReducedMotion;
  const devicePerformance = detectDevicePerformance();
  
  // 경로 변경 시 이전 경로 기록
  useEffect(() => {
    setPreviousPath(prevPath => {
      if (prevPath !== location.pathname) {
        return location.pathname; // 현재 경로가 다음에는 이전 경로가 됨
      }
      return prevPath;
    });
  }, [location.pathname]);
  
  // 저성능 기기 또는 모션 감소 설정 시 애니메이션 단순화
  useEffect(() => {
    if (isReducedMotion || devicePerformance === 'low') {
      setTransitionName('fade');
    }
  }, [isReducedMotion, devicePerformance]);

  // 경로 기반 전환 유형 결정 - 경로 패턴 매칭 포함
  const getTransitionForRoute = useCallback((path) => {
    // 커스텀 전환이 지정된 경우 우선 사용
    if (customTransition) {
      const transition = customTransition;
      setCustomTransition(null); // 한 번 사용 후 초기화
      return transition;
    }
    
    // 모션 감소 설정이나 저성능 기기의 경우 항상 fade
    if (isReducedMotion || devicePerformance === 'low') {
      return 'fade';
    }
    
    // 정확한 경로 매칭
    if (routeTransitionMap[path]) {
      // 이전 경로 기반 전환이 정의된 경우
      if (previousPath && routeTransitionMap[path].from && routeTransitionMap[path].from[previousPath]) {
        return routeTransitionMap[path].from[previousPath];
      }
      
      // 디바이스 타입에 따른 전환
      return isMobile 
        ? routeTransitionMap[path].mobile 
        : routeTransitionMap[path].default;
    }
    
    // 와일드카드 매칭 (예: /place/:id)
    if (path.startsWith('/place/')) {
      const placeConfig = routeTransitionMap['place'];
      
      // 이전 경로 기반 전환
      if (previousPath && placeConfig.from) {
        for (const [fromPath, effect] of Object.entries(placeConfig.from)) {
          if (previousPath.startsWith(fromPath)) {
            return effect;
          }
        }
      }
      
      // 디바이스 타입에 따른 기본 전환
      return isMobile ? placeConfig.mobile : placeConfig.default;
    }
    
    // 다른 경로 패턴 매칭
    for (const [routePattern, config] of Object.entries(routeTransitionMap)) {
      if (routePattern !== '/' && path.startsWith(routePattern)) {
        // 디바이스 타입에 따른 전환
        return isMobile ? config.mobile : config.default;
      }
    }
    
    // 기본값: 페이드
    return 'fade';
  }, [previousPath, isMobile, isReducedMotion, devicePerformance, customTransition]);
  
  // 특정 페이지 전환에 커스텀 애니메이션을 적용하기 위한 함수
  const applyCustomTransition = useCallback((transitionType) => {
    setCustomTransition(transitionType);
  }, []);

  const value = {
    previousPath,
    currentPath: location.pathname,
    transitionName,
    setTransitionName,
    getTransitionForRoute,
    applyCustomTransition
  };

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
    </PageTransitionContext.Provider>
  );
};

// 컨텍스트를 사용하기 위한 훅
export const usePageTransition = () => useContext(PageTransitionContext);

export default PageTransitionProvider;
