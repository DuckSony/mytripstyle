// src/theme.js
import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { 
  prefersReducedMotion, 
  isMobileDevice, 
  // isTabletDevice 제거 (사용하지 않음)
  getDeviceAdjustedDuration,
  detectDevicePerformance,
  triggerHapticFeedback
} from './utils/animationUtils';

// 커스텀 색상 정의
const primary = {
  main: '#5271FF', // 주 브랜드 색상
  light: '#8AA1FF',
  dark: '#3446BD',
  contrastText: '#FFFFFF',
};

const secondary = {
  main: '#FF5C8D', // 보조 브랜드 색상
  light: '#FF8FB0',
  dark: '#CF456C',
  contrastText: '#FFFFFF',
};

// 성능 기반 애니메이션 설정
const performanceSettings = {
  // 각 성능 수준별 설정
  high: {
    enableHoverEffects: true,
    enableAdvancedAnimations: true,
    enableParallaxEffects: true,
    enableComplexShadows: true,
    enableBackgroundEffects: true,
    transitionMultiplier: 1.0
  },
  medium: {
    enableHoverEffects: true,
    enableAdvancedAnimations: true,
    enableParallaxEffects: false,
    enableComplexShadows: false,
    enableBackgroundEffects: false,
    transitionMultiplier: 0.85
  },
  low: {
    enableHoverEffects: !isMobileDevice(),
    enableAdvancedAnimations: false,
    enableParallaxEffects: false,
    enableComplexShadows: false,
    enableBackgroundEffects: false,
    transitionMultiplier: 0.7
  }
};

// 현재 기기 성능 수준 감지
const devicePerformance = detectDevicePerformance();
const currentPerformance = prefersReducedMotion 
  ? performanceSettings.low 
  : performanceSettings[devicePerformance] || performanceSettings.medium;

// 애니메이션 지속 시간 정의 - 성능 최적화 적용
const transitions = {
  shortest: getDeviceAdjustedDuration(150) * currentPerformance.transitionMultiplier,
  shorter: getDeviceAdjustedDuration(200) * currentPerformance.transitionMultiplier,
  short: getDeviceAdjustedDuration(250) * currentPerformance.transitionMultiplier,
  standard: getDeviceAdjustedDuration(300) * currentPerformance.transitionMultiplier,
  complex: getDeviceAdjustedDuration(375) * currentPerformance.transitionMultiplier,
  enteringScreen: getDeviceAdjustedDuration(225) * currentPerformance.transitionMultiplier,
  leavingScreen: getDeviceAdjustedDuration(195) * currentPerformance.transitionMultiplier,
};

// 향상된 애니메이션 이징 함수
const enhancedEasing = {
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
  
  // 저성능 기기용 단순화된 이징
  simple: 'ease-out'
};

// 성능 최적화된 전환 생성 함수
const createOptimizedTransition = (props = ['all'], options = {}) => {
  const {
    duration = transitions.standard,
    easing = devicePerformance === 'low' ? enhancedEasing.simple : enhancedEasing.easeInOut,
    delay = 0,
    reduceMotion = prefersReducedMotion
  } = options;
  
  // 모션 감소가 활성화된 경우 간소화된 전환 설정
  if (reduceMotion) {
    return (Array.isArray(props) ? props : [props])
      .map((prop) => `${prop} ${Math.min(150, duration * 0.5)}ms linear ${delay}ms`)
      .join(',');
  }
  
  // 저성능 기기는 더 간단한 전환 사용
  if (devicePerformance === 'low' && !reduceMotion) {
    return (Array.isArray(props) ? props : [props])
      .map((prop) => `${prop} ${Math.min(duration * 0.7, 200)}ms ${enhancedEasing.simple} ${delay}ms`)
      .join(',');
  }
  
  // 일반 기기는 최적화된 전환 사용
  return (Array.isArray(props) ? props : [props])
    .map((prop) => `${prop} ${duration}ms ${easing} ${delay}ms`)
    .join(',');
};

// 애니메이션 커스텀 속성 - 성능 수준에 따라 조정
const animation = {
  pageTransition: {
    duration: transitions.standard,
    easing: enhancedEasing.fastOutSlowIn
  },
  cardHover: {
    duration: transitions.short,
    easing: currentPerformance.enableAdvancedAnimations ? enhancedEasing.bounce : enhancedEasing.easeOut
  },
  buttonClick: {
    duration: transitions.shorter,
    easing: enhancedEasing.sharp,
    enableHaptic: isMobileDevice() // 모바일에서만 햅틱 피드백 활성화
  },
  listItem: {
    duration: transitions.shortest,
    easing: enhancedEasing.swiftOut
  },
  tabSwitch: {
    duration: transitions.short,
    easing: enhancedEasing.smooth
  },
  drawerOpen: {
    duration: transitions.standard,
    easing: enhancedEasing.easeOut
  },
  modalEntry: {
    duration: transitions.standard,
    easing: currentPerformance.enableAdvancedAnimations ? enhancedEasing.bounce : enhancedEasing.easeOut
  },
  loadingIndicator: {
    duration: 1500, // 로딩 애니메이션은 더 길게
    easing: 'ease-in-out' // 간단한 이징
  }
};

// 터치 상호작용 설정 - 햅틱 피드백 통합
const touchInteraction = {
  // 터치 리플 효과가 더 빠르게 진행되도록 설정
  tapHighlightTransparent: true,
  // 모바일에서 탭 상호작용 개선 설정
  interaction: {
    touchRippleIntensity: isMobileDevice() ? 0.7 : 1, // 모바일에서는 더 약한 리플 효과
    touchRippleTransitionDuration: isMobileDevice() ? 300 : 550, // 모바일에서는 더 빠른 리플
    hapticFeedback: {
      enabled: isMobileDevice() && !prefersReducedMotion,
      onButtonPress: 'light',
      onLongPress: 'medium',
      onError: 'error'
    }
  }
};

// 기본 테마 생성
let theme = createTheme({
  palette: {
    primary,
    secondary,
    background: {
      default: '#F8F9FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
    success: {
      main: '#4CAF50',
      light: '#81C784',
      dark: '#388E3C',
    },
    info: {
      main: '#2196F3',
      light: '#64B5F6',
      dark: '#1976D2',
    },
    warning: {
      main: '#FF9800',
      light: '#FFB74D',
      dark: '#F57C00',
    },
    error: {
      main: '#F44336',
      light: '#E57373',
      dark: '#D32F2F',
    },
  },
  typography: {
    fontFamily: [
      'Pretendard',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    subtitle2: {
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  transitions: {
    // 전환 지속 시간 설정
    duration: transitions,
    // 향상된 이징 설정
    easing: enhancedEasing,
    // 향상된 페이지 전환 애니메이션 설정
    create: createOptimizedTransition,
  },
  // 커스텀 애니메이션 속성 추가
  animation,
  // 향상된 반응형 설정
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  // 터치 인터랙션 설정
  touch: touchInteraction,
  // 성능 설정 포함
  performance: {
    level: devicePerformance,
    settings: currentPerformance,
    isReducedMotion: prefersReducedMotion
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.05)',
    '0px 4px 8px rgba(0, 0, 0, 0.05)',
    '0px 6px 12px rgba(0, 0, 0, 0.08)',
    '0px 8px 16px rgba(0, 0, 0, 0.08)',
    '0px 10px 20px rgba(0, 0, 0, 0.1)',
    '0px 12px 24px rgba(0, 0, 0, 0.1)',
    '0px 14px 28px rgba(0, 0, 0, 0.12)',
    '0px 16px 32px rgba(0, 0, 0, 0.12)',
    '0px 18px 36px rgba(0, 0, 0, 0.14)',
    '0px 20px 40px rgba(0, 0, 0, 0.14)',
    '0px 22px 44px rgba(0, 0, 0, 0.16)',
    '0px 24px 48px rgba(0, 0, 0, 0.16)',
    '0px 26px 52px rgba(0, 0, 0, 0.18)',
    '0px 28px 56px rgba(0, 0, 0, 0.18)',
    '0px 30px 60px rgba(0, 0, 0, 0.2)',
    '0px 32px 64px rgba(0, 0, 0, 0.2)',
    '0px 34px 68px rgba(0, 0, 0, 0.22)',
    '0px 36px 72px rgba(0, 0, 0, 0.22)',
    '0px 38px 76px rgba(0, 0, 0, 0.24)',
    '0px 40px 80px rgba(0, 0, 0, 0.24)',
    '0px 42px 84px rgba(0, 0, 0, 0.26)',
    '0px 44px 88px rgba(0, 0, 0, 0.26)',
    '0px 46px 92px rgba(0, 0, 0, 0.28)',
    '0px 48px 96px rgba(0, 0, 0, 0.28)',
  ],

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          padding: '8px 16px',
          position: 'relative',
          overflow: 'hidden', // 리플 효과 제한을 위해
          '&:hover': {
            boxShadow: currentPerformance.enableComplexShadows ? '0px 4px 8px rgba(0, 0, 0, 0.1)' : 'none',
            transform: (!isMobileDevice() && currentPerformance.enableHoverEffects) ? 'translateY(-2px)' : 'none',
            transition: createOptimizedTransition(
              ['transform', 'box-shadow'], 
              { duration: animation.buttonClick.duration, easing: animation.buttonClick.easing }
            ),
          },
          // 모바일 터치 피드백 개선
          '&:active': {
            transform: 'scale(0.97)',
            transition: 'transform 0.1s',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              pointerEvents: 'none'
            }
          },
          // 접근성을 위한 포커스 스타일
          '&:focus-visible': {
            outline: `2px solid ${primary.main}`,
            outlineOffset: 2,
          },
        },
        contained: {
          '&:hover': {
            boxShadow: currentPerformance.enableComplexShadows 
              ? '0px 6px 12px rgba(0, 0, 0, 0.12)' 
              : '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
          },
        },
        // 모바일용 더 큰 터치 영역
        sizeLarge: {
          [theme => theme.breakpoints.down('sm')]: {
            padding: '12px 20px',
            fontSize: '1rem',
          },
        },
      },
      defaultProps: {
        disableRipple: devicePerformance === 'low', // 저사양 기기에서는 리플 효과 비활성화
        // 버튼 클릭 시 햅틱 피드백 자동 트리거
        onClick: isMobileDevice() && animation.buttonClick.enableHaptic ? 
          () => {
            triggerHapticFeedback('light');
            return true; // 이벤트 처리 계속
          } : undefined
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: currentPerformance.enableComplexShadows
            ? '0px 4px 20px rgba(0, 0, 0, 0.08)'
            : '0px 2px 8px rgba(0, 0, 0, 0.06)',
          transition: createOptimizedTransition(
            ['transform', 'box-shadow'], 
            { duration: animation.cardHover.duration, easing: animation.cardHover.easing }
          ),
          '&:hover': {
            transform: (currentPerformance.enableHoverEffects && !isMobileDevice()) 
              ? 'translateY(-4px)' 
              : 'none',
            boxShadow: currentPerformance.enableComplexShadows
              ? '0px 8px 30px rgba(0, 0, 0, 0.12)'
              : '0px 4px 12px rgba(0, 0, 0, 0.09)',
          },
          // 모바일에서 카드 터치 효과
          '&:active': {
            transform: 'scale(0.98)',
            transition: 'transform 0.1s',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 16,
        },
        // 페이퍼 로딩 애니메이션 추가
        root: {
          '&.MuiPaper-loading': {
            animation: !prefersReducedMotion 
              ? '$pulseAnimation 1.5s ease-in-out infinite'
              : 'none',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          transition: createOptimizedTransition(
            ['transform', 'background-color'], 
            { duration: 200, easing: enhancedEasing.swiftOut }
          ),
          '&:hover': {
            transform: (!isMobileDevice() && currentPerformance.enableHoverEffects) ? 'scale(1.05)' : 'none',
          },
          // 모바일용 더 큰 터치 영역
          [theme => theme.breakpoints.down('sm')]: {
            height: 36,
            fontSize: '0.9rem',
          },
        },
        // 모바일에서 선택가능한 칩 강화
        clickable: {
          '&:active': {
            transform: 'scale(0.95)',
            transition: 'transform 0.1s',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
          transition: createOptimizedTransition(
            ['background-color', 'color', 'transform'], 
            { duration: animation.tabSwitch.duration, easing: animation.tabSwitch.easing }
          ),
          '&.Mui-selected': {
            fontWeight: 600,
            transform: (!isMobileDevice() && currentPerformance.enableHoverEffects) ? 'translateY(-2px)' : 'none',
          },
          // 모바일용 큰 터치 영역
          [theme => theme.breakpoints.down('sm')]: {
            minHeight: 56,
            minWidth: 90,
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: isMobileDevice() ? 72 : 64, // 모바일에서 더 큰 내비게이션 바
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          padding: '8px 0',
          transition: createOptimizedTransition(
            ['transform', 'color'], 
            { duration: 200, easing: enhancedEasing.bounce }
          ),
          '&.Mui-selected': {
            transform: currentPerformance.enableAdvancedAnimations ? 'translateY(-4px)' : 'none',
          },
          // 모바일에서 아이콘 크기 증가
          [theme => theme.breakpoints.down('sm')]: {
            '& .MuiSvgIcon-root': {
              fontSize: '1.5rem',
            },
            '& .MuiTypography-root': {
              fontSize: '0.75rem',
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: currentPerformance.enableComplexShadows
            ? '0px 8px 30px rgba(0, 0, 0, 0.15)'
            : '0px 4px 15px rgba(0, 0, 0, 0.1)',
          // 대화상자 애니메이션
          ...(!prefersReducedMotion && {
            '@keyframes dialogEntrance': {
              '0%': { opacity: 0, transform: 'scale(0.9)' },
              '100%': { opacity: 1, transform: 'scale(1)' }
            },
            animation: '$dialogEntrance 0.3s forwards'
          })
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          // 하단 내비게이션 위에 표시 (모바일 디바이스에 따라 조정)
          bottom: isMobileDevice() ? 80 : 72,
        },
      },
    },
    MuiRating: {
      styleOverrides: {
        iconFilled: {
          color: secondary.main,
        },
        // 모바일용 큰 터치 영역
        root: {
          [theme => theme.breakpoints.down('sm')]: {
            fontSize: '1.5rem',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '0 16px 16px 0',
          // 서랍 애니메이션
          ...(!prefersReducedMotion && {
            '@keyframes drawerSlide': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(0)' }
            },
            animation: '$drawerSlide 0.3s forwards'
          })
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          transition: createOptimizedTransition(
            ['background-color', 'transform'], 
            { duration: animation.listItem.duration, easing: animation.listItem.easing }
          ),
          '&:hover': {
            transform: (!isMobileDevice() && currentPerformance.enableHoverEffects) ? 'translateX(4px)' : 'none',
          },
          // 모바일용 큰 터치 영역
          [theme => theme.breakpoints.down('sm')]: {
            paddingTop: 10,
            paddingBottom: 10,
          },
          // 터치 피드백
          '&:active': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            transform: 'translateX(2px)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: createOptimizedTransition(
            ['transform', 'background-color'], 
            { duration: 200, easing: enhancedEasing.swiftOut }
          ),
          '&:hover': {
            transform: (!isMobileDevice() && currentPerformance.enableHoverEffects) ? 'scale(1.1)' : 'none',
          },
          // 터치 피드백
          '&:active': {
            transform: 'scale(0.9)',
            transition: 'transform 0.1s',
          },
          // 모바일에서 더 큰 터치 영역
          [theme => theme.breakpoints.down('sm')]: {
            padding: 12,
          },
        },
      },
    },
    // 추가 컴포넌트 애니메이션
    MuiCollapse: {
      styleOverrides: {
        root: {
          transition: createOptimizedTransition(['height'], { 
            duration: getDeviceAdjustedDuration(300),
            easing: enhancedEasing.fastOutSlowIn
          }),
        },
      },
    },
    MuiFade: {
      styleOverrides: {
        root: {
          transition: createOptimizedTransition(['opacity'], { 
            duration: getDeviceAdjustedDuration(300),
            easing: enhancedEasing.smooth
          }),
        },
      },
    },
    MuiSlide: {
      styleOverrides: {
        root: {
          transition: createOptimizedTransition(['transform'], { 
            duration: getDeviceAdjustedDuration(350),
            easing: enhancedEasing.fastOutSlowIn
          }),
        },
      },
    },
    MuiGrow: {
      styleOverrides: {
        root: {
          transition: createOptimizedTransition(['transform', 'opacity'], { 
            duration: getDeviceAdjustedDuration(300),
            easing: enhancedEasing.bounce
          }),
        },
      },
    },
    // 모바일 경험 향상을 위한 추가 설정
    MuiSwipeableDrawer: {
      styleOverrides: {
        root: {
          // 스와이프 감도 조정 (모바일에서 더 민감하게)
          '& .MuiDrawer-paper': {
            touchAction: 'none', // 더 나은 터치 처리
            overscrollBehavior: 'contain', // 오버스크롤 방지
          },
        },
      },
    },
    // 터치 피드백 강화
    MuiTouchRipple: {
      styleOverrides: {
        root: {
          // 모바일에서 리플 효과 최적화
          opacity: isMobileDevice() ? 0.6 : 0.4,
          transition: createOptimizedTransition(['opacity'], { 
            duration: isMobileDevice() ? 400 : 550,
            easing: enhancedEasing.easeOut
          }),
        },
      },
    },
  },
});

// 글로벌 키프레임 애니메이션 추가
theme = createTheme(theme, {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '@keyframes pulseAnimation': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.7 },
          '100%': { opacity: 1 },
        },
        '@keyframes fadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        '@keyframes slideUp': {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        '@keyframes slideDown': {
          '0%': { transform: 'translateY(-20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        '@keyframes scaleIn': {
          '0%': { transform: 'scale(0.9)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        '@keyframes bounce': {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-10px)' },
          '60%': { transform: 'translateY(-5px)' },
        },
        '@keyframes shimmer': {
          '0%': {
            backgroundPosition: '-200% 0'
          },
          '100%': {
            backgroundPosition: '200% 0'
          }
        },
        '@keyframes rippleEffect': {
          '0%': {
            transform: 'scale(0)',
            opacity: 0.5
          },
          '100%': {
            transform: 'scale(2)',
            opacity: 0
          }
        },
        // 모바일 및 성능 관련 전역 CSS 추가
        'html': {
          overscrollBehavior: 'none', // 모바일에서 바운스 방지
          touchAction: 'manipulation', // 터치 최적화
          scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth'
        },
        'body': {
          WebkitTapHighlightColor: 'transparent', // 모바일 탭 하이라이트 제거
          WebkitOverflowScrolling: 'touch', // iOS 스크롤 최적화
          // 성능에 따른 전역 애니메이션 최적화
          ...(devicePerformance === 'low' && {
            '& *': {
              animationDuration: '0.3s !important',
              transitionDuration: '0.3s !important',
              scrollBehavior: 'auto !important'
            }
          })
        },
        // 터치 최적화 헬퍼 클래스
        '.touch-optimized': {
          touchAction: 'manipulation',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          // 터치 시 피드백
          '&:active': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            transform: 'scale(0.98)',
            transition: 'transform 0.1s, background-color 0.1s'
          }
        },
        // 로딩 상태 애니메이션 클래스
        '.loading-shimmer': {
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
          backgroundSize: '200% 100%',
          animation: prefersReducedMotion 
            ? 'none'
            : '$shimmer 1.5s infinite linear',
          pointerEvents: 'none'
        },
        // 성능 최적화된 스크롤 영역
        '.optimized-scroll': {
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          msOverflowStyle: 'none', // IE, Edge
          // Chrome, Safari 스크롤바 최적화
          '&::-webkit-scrollbar': {
            width: '4px',
            height: '4px'
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px'
          }
        },
        // 모바일 터치 영역 클래스 (충분한 터치 영역)
        '.touch-target': {
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        // 모션 감소 설정 때 모든 애니메이션 비활성화
        ...(prefersReducedMotion && {
          '*, *::before, *::after': {
            animation: 'none !important',
            transition: 'none !important'
          }
        }),
        // 저사양 기기 디바운싱
        ...(devicePerformance === 'low' && {
          '.debounced-animation': {
            animation: 'none !important'
          }
        })
      },
    },
  },
});

// 헬퍼 함수 추가: 손쉬운 햅틱 피드백 트리거
theme.triggerHaptic = (pattern = 'default') => {
  if (touchInteraction.interaction.hapticFeedback?.enabled) {
    triggerHapticFeedback(pattern);
  }
};

// 폰트 크기 반응형 처리
theme = responsiveFontSizes(theme);

export default theme;
