// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// 개발 환경에서만 로깅하는 유틸리티 함수
const logDebug = (message, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AuthContext] ${message}`, data || '');
  }
};

// 인증 컨텍스트 생성
const AuthContext = createContext();

// 컨텍스트 훅 함수
export const useAuth = () => {
  return useContext(AuthContext);
};

// 서비스 모듈 미리 로드 (지연 로딩 최적화)
let authServicePromise = null;
const getAuthService = () => {
  if (!authServicePromise) {
    authServicePromise = import('../services/authService');
  }
  return authServicePromise;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const previousAuthStateRef = useRef({ userId: null, isAuthenticated: false });
  
  // 프로필 데이터 캐시 TTL 설정 (24시간)
  const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000;

  // 사용자 프로필 캐싱 함수
  const cacheUserProfile = useCallback((userId, profileData) => {
    if (!userId || !profileData) return;
    
    try {
      const cacheData = {
        profile: profileData,
        timestamp: Date.now()
      };
      localStorage.setItem(`auth_profile_${userId}`, JSON.stringify(cacheData));
    } catch (err) {
      // 로컬 스토리지 오류 무시 (앱 기능에 영향 없음)
    }
  }, []);

  // 캐시된 프로필 가져오기
  const getCachedProfile = useCallback((userId) => {
    if (!userId) return null;
    
    try {
      const cacheJson = localStorage.getItem(`auth_profile_${userId}`);
      if (!cacheJson) return null;
      
      const cacheData = JSON.parse(cacheJson);
      // 캐시 유효성 확인
      if (Date.now() - cacheData.timestamp < PROFILE_CACHE_TTL) {
        return cacheData.profile;
      }
    } catch (err) {
      // 캐시 접근 오류 무시
    }
    return null;
  }, [PROFILE_CACHE_TTL]);

  useEffect(() => {
    logDebug("useEffect running");
    
    // 서비스 모듈 미리 로드 (앱 초기화 시)
    getAuthService().catch(err => {
      logDebug("Failed to preload auth service", err);
    });
    
    const auth = getAuth();
    
    // 인증 상태 변경 구독
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        // 이전 상태와 현재 상태 비교
        const prevUserId = previousAuthStateRef.current.userId;
        const prevIsAuthenticated = previousAuthStateRef.current.isAuthenticated;
        const isAuthenticated = !!user;
        const userId = user?.uid;
        
        // 상태 변경이 없는 경우 불필요한 처리 방지
        if (prevIsAuthenticated === isAuthenticated && prevUserId === userId && authInitialized) {
          logDebug("Auth state unchanged, skipping update");
          return;
        }
        
        logDebug("Auth state changed", { 
          prev: prevIsAuthenticated ? `User ID: ${prevUserId}` : "No user",
          current: isAuthenticated ? `User ID: ${userId}` : "No user" 
        });
        
        // 로딩 상태 업데이트 (최소화)
        if (!authInitialized) {
          setLoading(true);
        }
        
        if (user) {
          // 사용자가 로그인한 경우
          const userBasicInfo = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || ''
          };
          
          // 현재 사용자 상태 업데이트
          setCurrentUser(userBasicInfo);
          
          // 캐시된 프로필 확인
          const cachedProfile = getCachedProfile(user.uid);
          if (cachedProfile) {
            logDebug("Using cached profile", { userId: user.uid });
            setUserProfile({...userBasicInfo, ...cachedProfile});
          }
          
          // Firestore에서 최신 프로필 정보 가져오기
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const updatedProfile = {
                ...userBasicInfo,
                mbti: userData.mbti || '',
                interests: userData.interests || [],
                customInterests: userData.customInterests || [],
                talents: userData.talents || [],
                preferredCategories: userData.preferredCategories || [],
                preferredLocations: userData.preferredLocations || [],
                createdAt: userData.createdAt?.toDate() || new Date(),
                lastLoginAt: userData.lastLoginAt?.toDate() || new Date()
              };
              
              setUserProfile(updatedProfile);
              // 프로필 캐싱
              cacheUserProfile(user.uid, updatedProfile);
            } else if (!cachedProfile) {
              // 프로필이 존재하지 않고 캐시도 없는 경우만 기본값 설정
              setUserProfile(userBasicInfo);
            }
            
            // 사용자 변경 감지 (다른 사용자로 로그인)
            if (prevUserId !== userId) {
              logDebug("User changed", { from: prevUserId, to: userId });
              // 사용자 변경 이벤트 발생
              window.dispatchEvent(new CustomEvent('user-changed', {
                detail: { userId: user.uid }
              }));
            }
          } catch (profileError) {
            logDebug("Failed to fetch profile", profileError);
            // 캐시된 프로필이 없는 경우만 기본값 설정
            if (!cachedProfile) {
              setUserProfile(userBasicInfo);
            }
          }
        } else {
          // 로그아웃 상태
          if (prevIsAuthenticated) {
            logDebug("User logged out", { previousUser: prevUserId });
            // 로그아웃 이벤트 발생
            window.dispatchEvent(new CustomEvent('user-logged-out'));
          }
          
          setCurrentUser(null);
          setUserProfile(null);
        }
        
        // 이전 인증 상태 업데이트
        previousAuthStateRef.current = {
          userId: user?.uid,
          isAuthenticated: !!user
        };
      } catch (err) {
        logDebug("Error handling auth state", err);
        setError(err.message);
      } finally {
        setLoading(false);
        setAuthInitialized(true);
      }
    });
    
    // 컴포넌트 언마운트 시 구독 해제
    return unsubscribe;
  }, [authInitialized, cacheUserProfile, getCachedProfile]);

  // 프로필 정보 갱신 함수 - 메모이제이션 적용
  const refreshUserProfile = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedProfile = {
          ...currentUser,
          mbti: userData.mbti || '',
          interests: userData.interests || [],
          customInterests: userData.customInterests || [],
          talents: userData.talents || [],
          preferredCategories: userData.preferredCategories || [],
          preferredLocations: userData.preferredLocations || [],
          createdAt: userData.createdAt?.toDate() || new Date(),
          lastLoginAt: userData.lastLoginAt?.toDate() || new Date()
        };
        
        setUserProfile(updatedProfile);
        // 프로필 캐싱 업데이트
        cacheUserProfile(currentUser.uid, updatedProfile);
      }
    } catch (err) {
      logDebug("Failed to refresh profile", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, cacheUserProfile]);

  // 프로필 정보 업데이트
  const updateProfile = useCallback(async (profileData) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');
    
    try {
      const authService = await getAuthService();
      const result = await authService.updateUserProfile(currentUser.uid, profileData);
      
      if (result.success) {
        // 프로필 업데이트 성공 시 정보 새로고침
        await refreshUserProfile();
        return { success: true };
      } else {
        throw new Error(result.error || '프로필 업데이트 실패');
      }
    } catch (err) {
      logDebug("Failed to update profile", err);
      return { success: false, error: err.message };
    }
  }, [currentUser, refreshUserProfile]);

  // 이메일 로그인
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      const authService = await getAuthService();
      const result = await authService.loginWithEmail(email, password);
      
      return result;
    } catch (err) {
      logDebug("Login error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Google 로그인
  const loginWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const authService = await getAuthService();
      const result = await authService.loginWithGoogle();
      
      return result;
    } catch (err) {
      logDebug("Google login error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // 회원가입
  const register = useCallback(async (email, password, userData) => {
    try {
      setLoading(true);
      const authService = await getAuthService();
      const result = await authService.registerWithEmail(email, password, userData);
      
      return result;
    } catch (err) {
      logDebug("Registration error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      // 로그아웃 전 상태 기록 - 디버깅 목적
      const prevUser = { ...currentUser };
      logDebug("Logging out user", prevUser?.uid);
      
      const authService = await getAuthService();
      const result = await authService.logout();
      
      if (result.success) {
        // 로그아웃 전에 상태 초기화
        setCurrentUser(null);
        setUserProfile(null);
        logDebug("Logout successful");
        return { success: true };
      } else {
        throw new Error(result.error || '로그아웃 실패');
      }
    } catch (err) {
      logDebug("Logout error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // 비밀번호 재설정
  const resetPassword = useCallback(async (email) => {
    try {
      setLoading(true);
      const authService = await getAuthService();
      const result = await authService.resetPassword(email);
      
      return result;
    } catch (err) {
      logDebug("Password reset error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // 이메일 변경
  const changeEmail = useCallback(async (newEmail, password) => {
    try {
      setLoading(true);
      const authService = await getAuthService();
      const result = await authService.changeEmail(newEmail, password);
      
      return result;
    } catch (err) {
      logDebug("Email change error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // 비밀번호 변경
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      const authService = await getAuthService();
      const result = await authService.changePassword(currentPassword, newPassword);
      
      return result;
    } catch (err) {
      logDebug("Password change error", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // 인증 관련 메서드를 메모이제이션하여 불필요한 재생성 방지
  const authMethods = useMemo(() => ({
    login,
    loginWithGoogle,
    register,
    logout,
    resetPassword,
    refreshUserProfile,
    updateProfile,
    changeEmail,
    changePassword
  }), [
    login, loginWithGoogle, register, logout, resetPassword,
    refreshUserProfile, updateProfile, changeEmail, changePassword
  ]);

  // 인증 상태 값을 메모이제이션하여 불필요한 리렌더링 방지
  const authState = useMemo(() => ({
    currentUser,
    userProfile,
    loading,
    error,
    isAuthenticated: !!currentUser,
    authInitialized
  }), [currentUser, userProfile, loading, error, authInitialized]);

  // 제공할 컨텍스트 값
  const value = useMemo(() => ({
    ...authState,
    ...authMethods
  }), [authState, authMethods]);

  // 로딩 상태에 따른 조건부 렌더링
  return (
    <AuthContext.Provider value={value}>
      {authInitialized ? children : <div>인증 초기화 중...</div>}
    </AuthContext.Provider>
  );
};

export default AuthContext;
