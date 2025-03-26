// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

// Context 프로바이더들 - 전역적으로 필요한 것만 여기에 유지
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { SavedPlacesProvider } from './contexts/SavedPlacesContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';

// 분석 및 모니터링 서비스 초기화
import { initializeAnalytics } from './services/analyticsService';
import { initSentry } from './services/errorTracking';

// React 루트 요소 생성
const root = ReactDOM.createRoot(document.getElementById('root'));

// 환경 설정
const isProduction = process.env.REACT_APP_ENV === 'production';
const isStaging = process.env.REACT_APP_ENV === 'staging';
const isDevelopment = !isProduction && !isStaging;

// Sentry 초기화 (프로덕션/스테이징 환경에서만)
if (isProduction || isStaging) {
  initSentry();
}

// Firebase Analytics 초기화
initializeAnalytics();

// PWA 설치 감지 및 설정 (초기 설정)
const setupPwaTracking = () => {
  // 설치 상태 확인
  const isPwaInstalled = 
    window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true ||
    localStorage.getItem('isPWAInstalled') === 'true';
  
  // 설치 상태 저장
  if (isPwaInstalled) {
    try {
      localStorage.setItem('isPWAInstalled', 'true');
      
      // 첫 실행 여부 확인
      const isFirstLaunch = localStorage.getItem('hasPWALaunched') !== 'true';
      if (isFirstLaunch) {
        localStorage.setItem('hasPWALaunched', 'true');
        localStorage.setItem('pwaFirstLaunchedAt', Date.now().toString());
      }
    } catch (e) {
      console.warn('로컬 스토리지 접근 오류:', e);
    }
  }

  // 설치 모드 변경 감지
  const handleDisplayModeChange = (e) => {
    if (e.matches) {
      try {
        localStorage.setItem('isPWAInstalled', 'true');
      } catch (storageError) {
        console.warn('로컬 스토리지 접근 오류:', storageError);
      }
    }
  };

  // 디스플레이 모드 변경 이벤트 리스너 등록
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  mediaQuery.addEventListener('change', handleDisplayModeChange);
};

// 앱 초기화 시 PWA 트래킹 설정
setupPwaTracking();

// 메인 렌더링 로직 - Context 계층 최적화
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <UserProvider>
          <SavedPlacesProvider>
            <FeedbackProvider>
              <App />
            </FeedbackProvider>
          </SavedPlacesProvider>
        </UserProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// PWA 서비스 워커 등록 - 최적화된 접근 방식
const registerServiceWorker = () => {
  // PWA 서비스 워커 등록 옵션
  const swOptions = {
    onSuccess: (registration) => {
      console.log('서비스 워커가 성공적으로 등록되었습니다:', registration);
      
      // 최초 설치 시 캐싱 완료 이벤트 발생
      window.dispatchEvent(new CustomEvent('pwa-installed', { 
        detail: { registration, timestamp: Date.now() } 
      }));
    },
    onUpdate: (registration) => {
      // 새 버전의 서비스 워커가 발견되면 App.js에서 처리
      console.log('새 버전의 서비스 워커가 발견되었습니다:', registration);
      
      // 업데이트 이벤트 발생
      window.dispatchEvent(new CustomEvent('pwa-update-available', { 
        detail: { registration, timestamp: Date.now() } 
      }));
    },
    // 개발 환경에서도 서비스 워커 등록 강제 (필요한 경우만)
    forceRegister: process.env.NODE_ENV === 'development' && 
                  process.env.REACT_APP_FORCE_SW === 'true',
    // 푸시 알림 설정 (VAPID 키 사용)
    applicationServerKey: process.env.REACT_APP_PUBLIC_VAPID_KEY,
    // 성능 최적화를 위한 지연 등록
    immediate: false,
    // 업데이트 주기적 확인
    autoCheck: true,
    checkInterval: 60 * 60 * 1000 // 1시간
  };

  // 서비스 워커 등록을 비동기적으로 처리
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      serviceWorkerRegistration.register(swOptions);
    }, { timeout: 5000 });
  } else {
    // requestIdleCallback을 지원하지 않는 브라우저에서는 타이머 사용
    setTimeout(() => {
      serviceWorkerRegistration.register(swOptions);
    }, 5000);
  }
};

// 네트워크 상태에 따른 서비스 워커 등록 최적화
if (navigator.onLine) {
  // 온라인 상태에서 즉시 등록 시작
  registerServiceWorker();
} else {
  // 오프라인 상태에서는 온라인 상태가 되면 등록
  const handleOnline = () => {
    window.removeEventListener('online', handleOnline);
    registerServiceWorker();
  };
  window.addEventListener('online', handleOnline);
}

// 성능 측정 및 분석 - 실제 필요한 경우만 활성화
if (isDevelopment) {
  reportWebVitals(console.log);
} else {
  // 프로덕션/스테이징 환경에서는 중요 지표만 수집
  reportWebVitals(metric => {
    // 중요 지표만 필터링하여 분석
    if (metric.name === 'FCP' || metric.name === 'LCP' || metric.name === 'CLS') {
      // Firebase Analytics로 성능 지표 전송
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          metric_name: metric.name,
          metric_value: metric.value,
          metric_delta: metric.delta,
          metric_id: metric.id,
        });
      }
    }
  });
}

// PWA 앱 첫 실행 동작 (설치 후 첫 실행 감지)
if (
  localStorage.getItem('isPWAInstalled') === 'true' && 
  localStorage.getItem('hasPWALaunched') === 'true' &&
  !localStorage.getItem('onboardingCompleted')
) {
  // 온보딩 표시 이벤트 발생
  window.dispatchEvent(new CustomEvent('pwa-first-launch', { 
    detail: { timestamp: Date.now() } 
  }));
}
