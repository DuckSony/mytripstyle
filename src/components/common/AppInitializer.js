// src/components/common/AppInitializer.js
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';

const AppInitializer = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isProfileComplete, loading: userLoading } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 인증 및 사용자 데이터 로딩 완료 후
    if (!authLoading && !userLoading) {
      const pathname = location.pathname;
      const publicRoutes = ['/', '/login', '/register'];
      
      // 로그인되어 있으나 프로필이 완성되지 않은 경우
      if (isAuthenticated && !isProfileComplete && !pathname.includes('/profile')) {
        if (!publicRoutes.includes(pathname)) {
          navigate('/profile', { state: { from: location, needsCompletion: true } });
        }
      }
      
      // 로그인되어 있지 않은 경우
      if (!isAuthenticated && !publicRoutes.includes(pathname)) {
        navigate('/login', { state: { from: location } });
      }
    }
  }, [isAuthenticated, isProfileComplete, authLoading, userLoading, location, navigate]);

  // 이 컴포넌트는 UI를 렌더링하지 않고 라우팅 로직만 처리합니다
  return null;
};

export default AppInitializer;
