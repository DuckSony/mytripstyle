// src/components/common/DataInitializer.js
import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import firebaseServices from '../../config/firebase';

const DataInitializer = ({ children }) => {
  const { currentUser } = useAuth();
  const userContext = useUser(); // useUser 컨텍스트 전체를 가져옴
  
  // 앱 초기화 관리
  useEffect(() => {
    // Firebase 초기화
    firebaseServices.setupOfflineSupport().then(status => {
      console.log('Firebase 오프라인 지원 초기화:', status.success ? '성공' : '실패');
    });
    
    // 페이지 새로고침 감지 및 처리
    const handlePageShow = (e) => {
      if (e.persisted && currentUser) {
        console.log('페이지 복원됨, 프로필 데이터 새로고침...');
        
        // loadUserProfile 함수가 있는지 확인하고 호출
        if (userContext && typeof userContext.loadUserProfile === 'function') {
          userContext.loadUserProfile(currentUser.uid);
        } else {
          console.warn('loadUserProfile 함수를 찾을 수 없습니다.');
        }
      }
    };
    
    // 네트워크 재연결 시 데이터 새로고침
    const handleOnline = () => {
      if (currentUser) {
        console.log('네트워크 연결 복원, 프로필 데이터 새로고침...');
        // 약간의 지연 후 프로필 다시 로드
        setTimeout(() => {
          // loadUserProfile 함수가 있는지 확인하고 호출
          if (userContext && typeof userContext.loadUserProfile === 'function') {
            userContext.loadUserProfile(currentUser.uid);
          } else {
            console.warn('loadUserProfile 함수를 찾을 수 없습니다.');
          }
        }, 1000);
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser, userContext]); // userContext를 의존성 배열에 추가
  
  return <>{children}</>;
};

export default DataInitializer;
