// src/components/routing/AnimatedRoutes.js
import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AnimatePresence } from 'framer-motion';
import { usePageTransition } from '../animation/PageTransitionsManager';
import { Box, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';

// 지연 로딩된 페이지 컴포넌트들
const Home = React.lazy(() => import('../../pages/Home'));
const Login = React.lazy(() => import('../../pages/Login'));
const Register = React.lazy(() => import('../../pages/Register'));
const Profile = React.lazy(() => import('../../pages/Profile'));
const Recommendations = React.lazy(() => import('../../pages/Recommendations'));
const SavedPlaces = React.lazy(() => import('../../pages/SavedPlaces'));
const PlaceDetails = React.lazy(() => import('../../pages/PlaceDetails'));
const VisitHistory = React.lazy(() => import('../../pages/VisitHistory'));
const Settings = React.lazy(() => import('../../pages/Settings'));
const Search = React.lazy(() => import('../../pages/Search'));

// 오프라인 페이지 컴포넌트
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
  </Box>
);

// 로딩 컴포넌트
const LoadingFallback = () => (
  <Box 
    sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      width: '100%'
    }}
  >
    <CircularProgress />
  </Box>
);

// 애니메이션 전환을 지원하는 페이지 래퍼
const AnimatedPage = ({ children, transition = 'fade' }) => {
  // framer-motion에서 제공하는 화면 애니메이션 축소 설정 확인
  const { preferReducedMotion } = usePageTransition();
  
  // 접근성 설정에 따라 애니메이션 적용 여부 결정
  const variants = preferReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0 },
        animate: { 
          opacity: 1,
          transition: { duration: 0.3 }
        },
        exit: { 
          opacity: 0,
          transition: { duration: 0.2 }
        }
      };
    
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
    >
      {children}
    </motion.div>
  );
};

// Suspense와 애니메이션을 함께 사용하는 페이지 래퍼
const PageWithTransition = ({ element, transition }) => (
  <AnimatedPage transition={transition}>
    <Suspense fallback={<LoadingFallback />}>
      {element}
    </Suspense>
  </AnimatedPage>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const { getTransitionForRoute } = usePageTransition();
  
  // PrivateRoute 래퍼 컴포넌트
  const PrivateWrapper = ({ children }) => {
    return currentUser ? children : <Navigate to="/login" />;
  };
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <PageWithTransition 
            element={<Home />} 
            transition={getTransitionForRoute('/')}
          />
        } />
        
        <Route path="/login" element={
          currentUser ? <Navigate to="/" /> : 
          <PageWithTransition 
            element={<Login />} 
            transition={getTransitionForRoute('/login')}
          />
        } />
        
        <Route path="/register" element={
          currentUser ? <Navigate to="/" /> : 
          <PageWithTransition 
            element={<Register />} 
            transition={getTransitionForRoute('/register')}
          />
        } />
        
        <Route path="/profile" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<Profile />} 
              transition={getTransitionForRoute('/profile')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/recommendations" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<Recommendations />} 
              transition={getTransitionForRoute('/recommendations')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/saved-places" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<SavedPlaces />} 
              transition={getTransitionForRoute('/saved-places')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/place/:placeId" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<PlaceDetails />} 
              transition={getTransitionForRoute('/place/:placeId')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/visit-history" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<VisitHistory />} 
              transition={getTransitionForRoute('/visit-history')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/search" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<Search />} 
              transition={getTransitionForRoute('/search')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/settings" element={
          <PrivateWrapper>
            <PageWithTransition 
              element={<Settings />} 
              transition={getTransitionForRoute('/settings')}
            />
          </PrivateWrapper>
        } />
        
        <Route path="/offline" element={
          <PageWithTransition 
            element={<Offline />} 
            transition="fade"
          />
        } />
        
        <Route path="*" element={
          <PageWithTransition 
            element={<div>페이지를 찾을 수 없습니다.</div>} 
            transition="fade"
          />
        } />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;
