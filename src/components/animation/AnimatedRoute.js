// src/components/animation/AnimatedRoute.js
import React from 'react';
import { motion } from 'framer-motion';
import { usePageTransition } from './PageTransitionsManager';
import { 
  prefersReducedMotion, 
  isMobileDevice, 
  detectDevicePerformance 
} from '../../utils/animationUtils';

// 각 전환 유형에 따른 애니메이션 설정
const transitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },
  slide: {
    initial: { x: '100vw' },
    animate: { x: 0 },
    exit: { x: '-100vw' },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  slideLeft: {
    initial: { x: '-100vw' },
    animate: { x: 0 },
    exit: { x: '100vw' },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  slideRight: {
    initial: { x: '100vw' },
    animate: { x: 0 },
    exit: { x: '-100vw' },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { type: 'spring', stiffness: 400, damping: 30 }
  },
  scaleDown: {
    initial: { opacity: 0, scale: 1.1 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { type: 'spring', stiffness: 350, damping: 30 }
  },
  flip: {
    initial: { opacity: 0, rotateY: 90 },
    animate: { opacity: 1, rotateY: 0 },
    exit: { opacity: 0, rotateY: -90 },
    transition: { duration: 0.4 }
  },
  slideUp: {
    initial: { y: '100vh' },
    animate: { y: 0 },
    exit: { y: '100vh' },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  slideDown: {
    initial: { y: '-100vh' },
    animate: { y: 0 },
    exit: { y: '-100vh' },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  }
};

// 모바일 최적화 전환 - 더 가벼운 애니메이션
const mobileTransitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },
  slide: {
    initial: { x: '80vw' },
    animate: { x: 0 },
    exit: { x: '-80vw' },
    transition: { type: 'spring', stiffness: 250, damping: 25 }
  },
  slideLeft: {
    initial: { x: '-80vw' },
    animate: { x: 0 },
    exit: { x: '80vw' },
    transition: { type: 'spring', stiffness: 250, damping: 25 }
  },
  slideRight: {
    initial: { x: '80vw' },
    animate: { x: 0 },
    exit: { x: '-80vw' },
    transition: { type: 'spring', stiffness: 250, damping: 25 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { type: 'spring', stiffness: 350, damping: 25 }
  },
  scaleDown: {
    initial: { opacity: 0, scale: 1.05 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  slideUp: {
    initial: { y: '80vh' },
    animate: { y: 0 },
    exit: { y: '80vh' },
    transition: { type: 'spring', stiffness: 250, damping: 25 }
  },
  slideDown: {
    initial: { y: '-80vh' },
    animate: { y: 0 },
    exit: { y: '-80vh' },
    transition: { type: 'spring', stiffness: 250, damping: 25 }
  }
};

// 저성능 기기를 위한 간소화된 전환
const lowPerformanceTransitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 }
  },
  slide: { // 모든 슬라이드 유형은 페이드로 단순화
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 }
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.2 }
  },
  scale: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 }
  }
};

/**
 * 페이지 전환 애니메이션을 제공하는 라우트 래퍼 컴포넌트
 * - PageTransitionsManager와 통합되어 더 스마트한 전환 결정
 * - 디바이스 성능 및 모션 감소 설정에 따른 최적화
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - 애니메이션을 적용할 컴포넌트
 * @param {string} props.transition - 사용할 전환 유형 (선택적)
 * @param {Object} props.customTransition - 사용자 정의 전환 설정 (선택적)
 * @param {boolean} props.layoutId - framer-motion의 layoutId (선택적)
 * @param {Object} props.style - 추가 스타일 (선택적)
 */
const AnimatedRoute = ({ 
  children, 
  transition,
  customTransition,
  layoutId,
  style,
  ...props
}) => {
  // PageTransitionsManager 컨텍스트에서 전환 관련 정보 가져오기
  const { getTransitionForRoute } = usePageTransition();
  
  // 전환 유형 결정 (우선순위: customTransition > props.transition > getTransitionForRoute)
  const transitionType = customTransition 
    ? 'custom' 
    : (transition || getTransitionForRoute(props.path || '/'));
  
  // 디바이스 유형 및 성능 감지
  const isReducedMotion = prefersReducedMotion;
  const isMobile = isMobileDevice();
  const devicePerformance = detectDevicePerformance();
  
  // 성능 기반 애니메이션 결정
  let animationProps;
  
  if (isReducedMotion || devicePerformance === 'low') {
    // 모션 감소 모드 또는 저성능 기기용 간소화된 애니메이션
    const basicType = ['slideLeft', 'slideRight', 'slide'].includes(transitionType) 
      ? 'slide' 
      : (transitionType === 'scaleDown' ? 'scale' : transitionType);
    
    animationProps = lowPerformanceTransitions[basicType] || lowPerformanceTransitions.fade;
  } else if (isMobile) {
    // 모바일 기기용 최적화된 애니메이션
    animationProps = customTransition || mobileTransitions[transitionType] || mobileTransitions.fade;
  } else {
    // 데스크톱 기기용 표준 애니메이션
    animationProps = customTransition || transitions[transitionType] || transitions.fade;
  }
  
  // 디바이스 최적화 props 설정
  const motionProps = {
    ...animationProps,
    style: {
      width: '100%',
      height: '100%',
      // 렌더링 성능 향상을 위한 힌트
      willChange: devicePerformance === 'high' ? 'transform, opacity' : 'auto',
      // 추가 스타일 병합
      ...style
    }
  };
  
  // 레이아웃 ID 설정 (필요 시)
  if (layoutId) {
    motionProps.layoutId = layoutId;
  }

  return (
    <motion.div
      initial={motionProps.initial}
      animate={motionProps.animate}
      exit={motionProps.exit}
      transition={motionProps.transition}
      {...(layoutId ? { layoutId } : {})}
      style={motionProps.style}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedRoute;
