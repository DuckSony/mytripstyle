// src/App.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Box, Button } from '@mui/material';
import { SearchProvider } from './contexts/SearchContext'; 
import { useReducedMotion, AnimatePresence, motion } from 'framer-motion';
import { PageTransitionProvider } from './components/animation/PageTransitionsManager';
import DataInitializer from './components/common/DataInitializer';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/layout/Layout';
import { ContentLoader, FullPageLoader, MinimalLoader } from './components/common/LoadingFallback';
import PerformanceMonitor from './components/performance/PerformanceMonitor';
import { enableDebugTools } from './utils/optimizationUtils';
import ErrorBoundary from './components/common/ErrorBoundary';
import PlaceDetails from './pages/PlaceDetails';
import { trackScreenView } from './services/analyticsService';
import UpdateNotification from './components/common/UpdateNotification';

// 지연 로딩으로 변경된 페이지 컴포넌트들
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const SavedPlaces = lazy(() => import('./pages/SavedPlaces'));
const VisitHistory = lazy(() => import('./pages/VisitHistory'));
const Settings = lazy(() => import('./pages/Settings'));
const Search = lazy(() => import('./pages/Search'));

// 오프라인 페이지 컴포넌트 (간단해서 지연 로딩 불필요)
const Offline = () => (
  <Box 
    sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: 'calc(100vh - 112px)',
      p: 2,
      textAlign: 'center'
    }}
  >
    <h2>오프라인 상태입니다</h2>
    <p>인터넷 연결을 확인해주세요. 일부 기능은 오프라인에서도 사용할 수 있습니다.</p>
    <Button 
      variant="contained" 
      color="primary" 
      sx={{ mt: 2 }}
      onClick={() => window.location.href = '/'}
    >
      홈으로 돌아가기
    </Button>
  </Box>
);
 
// 개발 환경에서 디버그 도구 활성화
if (process.env.NODE_ENV === 'development') {
  enableDebugTools('MyTripStyle');
}

// 애니메이션 라우트 컴포넌트
const AnimatedRoutes = () => {
  const location = useLocation();
  const { currentUser } = useAuth(); // 인증 정보 가져오기
  const preferReducedMotion = useReducedMotion(); // 사용자 접근성 설정 확인
  
  // 화면 이동 추적
  useEffect(() => {
    const pageName = location.pathname.split('/')[1] || 'home';
    trackScreenView(pageName);
  }, [location]);
  
  // 모션 감소 설정에 따라 애니메이션 적용 여부 결정
  const motionProps = preferReducedMotion 
    ? {} // 모션 감소 선호 시 애니메이션 없음
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 }
      };
  
  // 각 페이지에 맞는 로딩 컴포넌트 선택
  const getLoadingComponent = (pageName) => {
    switch (pageName) {
      case 'home':
        return <ContentLoader message="홈 콘텐츠를 불러오는 중..." />;
      case 'recommendations':
        return <ContentLoader message="추천 항목을 불러오는 중..." />;
      case 'savedPlaces':
        return <ContentLoader message="저장된 장소를 불러오는 중..." />;
      case 'placeDetails':
        return <ContentLoader message="장소 정보를 불러오는 중..." />;
      case 'login':
      case 'register':
        return <MinimalLoader />;
      default:
        return <ContentLoader />;
    }
  };

  // Suspense를 사용한 지연 로딩 처리
  const PageWithSuspense = ({ element, pageName }) => (
    <ErrorBoundary>
      <Suspense fallback={getLoadingComponent(pageName)}>
        <motion.div {...motionProps}>
          {element}
        </motion.div>
      </Suspense>
    </ErrorBoundary>
  );
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <PageWithSuspense element={<Home />} pageName="home" />
        } />
        
        <Route path="/login" element={
          currentUser ? <Navigate to="/" /> : 
          <PageWithSuspense element={<Login />} pageName="login" />
        } />
        
        <Route path="/register" element={
          currentUser ? <Navigate to="/" /> : 
          <PageWithSuspense element={<Register />} pageName="register" />
        } />
        
        <Route path="/profile" element={
          currentUser ? 
            <PageWithSuspense element={<Profile />} pageName="profile" /> : 
            <Navigate to="/login" />
        } />
        
        <Route path="/recommendations" element={
          currentUser ? 
            <PageWithSuspense element={<Recommendations />} pageName="recommendations" /> : 
            <Navigate to="/login" />
        } />
        
        <Route path="/saved-places" element={
          currentUser ? 
            <PageWithSuspense element={<SavedPlaces />} pageName="savedPlaces" /> : 
            <Navigate to="/login" />
        } />
        
        {/* PlaceDetails 라우트 수정 - 다양한 형식의 placeId 지원 */}
        <Route path="/place/:placeId" element={
          currentUser ? (
            <ErrorBoundary>
              <PlaceDetails />
            </ErrorBoundary>
          ) : <Navigate to="/login" />
        } />
        
        <Route path="/visit-history" element={
          currentUser ? 
            <PageWithSuspense element={<VisitHistory />} pageName="visitHistory" /> : 
            <Navigate to="/login" />
        } />
        
        <Route path="/search" element={
          currentUser ? 
            <PageWithSuspense element={<Search />} pageName="search" /> : 
            <Navigate to="/login" />
        } />
        
        <Route path="/settings" element={
          currentUser ? 
            <PageWithSuspense element={<Settings />} pageName="settings" /> : 
            <Navigate to="/login" />
        } />
        
        <Route path="/offline" element={
          <PageWithSuspense element={<Offline />} pageName="offline" />
        } />
        
        <Route path="*" element={
          <div>페이지를 찾을 수 없습니다.</div>
        } />
      </Routes>
    </AnimatePresence>
  );
};

// App.js의 주요 부분
function App() {
  const { loading: authLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);
 
  // 네트워크 상태 모니터링 - 디바운스 적용
  useEffect(() => {
    let timeoutId;
    
    const handleOnline = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsOnline(true);
      }, 300);
    };
    
    const handleOffline = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsOnline(false);
      }, 300);
    };
 
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
 
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timeoutId);
    };
  }, []);

  // 서비스 워커 업데이트 감지
  useEffect(() => {
    const handleUpdateFound = (event) => {
      console.log('새 버전 발견:', event.detail);
      setUpdateAvailable(true);
      setSwRegistration(event.detail.registration);
    };

    window.addEventListener('pwa-update-available', handleUpdateFound);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateFound);
    };
  }, []);

  // 인증 초기화 중일 때 로딩 화면 표시
  if (authLoading) {
    return <FullPageLoader message="앱을 초기화하는 중..." />;
  }

  return (
    <Router>
      {/* 모든 컴포넌트에 검색 기능이 필요할 수 있으므로 최상위에 위치 */}
      <SearchProvider>
        {/* 알림 시스템 제공자 추가 */}
        <NotificationProvider>
          <DataInitializer>
            <PageTransitionProvider>
              <Layout isOffline={!isOnline}>
                <AnimatedRoutes />
                {updateAvailable && <UpdateNotification registration={swRegistration} />}
              </Layout>
            </PageTransitionProvider>
          </DataInitializer>
        </NotificationProvider>
        
        {/* 성능 모니터링 컴포넌트 (개발 환경에서만 렌더링) */}
        {process.env.NODE_ENV === 'development' && (
          <PerformanceMonitor position="bottom-right" />
        )}
      </SearchProvider>
    </Router>
  );
}

export default App;
