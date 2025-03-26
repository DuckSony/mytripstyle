// src/contexts/UserContext.js
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
 doc, 
 getDoc, 
 setDoc, 
 collection, 
 query, 
 where, 
 getDocs, 
 addDoc, 
 updateDoc, 
 deleteDoc, 
 serverTimestamp, 
 orderBy 
} from 'firebase/firestore';
import { isOffline } from '../utils/indexedDBUtils'; // 오프라인 상태 확인 유틸리티 추가

// Context 생성
const UserContext = createContext();

// Context Hook
export const useUser = () => {
 const context = useContext(UserContext);
 if (context === undefined) {
   throw new Error('useUser must be used within a UserProvider');
 }
 return context;
};

// Provider 컴포넌트
export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [visitedPlaces, setVisitedPlaces] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  // 네트워크 상태 추적 추가
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastOnline: new Date().toISOString(),
    reconnected: false
  });
  // 오프라인 작업 큐 추가
  const [offlineQueue, setOfflineQueue] = useState([]);
  
  // 기본 프로필 생성 함수 추가
  const createDefaultProfile = () => ({
    mbti: '',
    interests: ['여행', '카페', '맛집'],
    customInterests: [],
    talents: ['사진촬영'],
    preferredLocations: [{ region: '서울', subRegion: '강남/서초' }],
    currentMood: { mood: '평온함', intensity: 3 },
    createdAt: new Date().toISOString()
  });
  
  // 프로필 완성 여부 확인
  const checkProfileComplete = useCallback((profile) => {
    if (!profile) {
      setIsProfileComplete(false);
      return;
    }
    
    // 필수 필드가 있는지 확인 - 유연하게 조정
    const isComplete = 
      (profile.mbti || '') && 
      (profile.interests && profile.interests.length > 0) && 
      (profile.talents && profile.talents.length > 0) && 
      (profile.preferredLocations && profile.preferredLocations.length > 0);
    
    setIsProfileComplete(isComplete);
    console.log("프로필 완성 여부:", isComplete, profile);
  }, []);

  // 사용자 프로필 로드 함수
  const loadUserProfile = useCallback(async (userId) => {
    try {
      console.log("loadUserProfile 실행:", userId);
      setLoading(true);
      
      // 먼저 localStorage에서 캐시된 데이터 로드하여 즉시 표시
      const cachedProfile = localStorage.getItem(`userProfile_${userId}`);
      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile);
          // 사용자 경험을 위한 빠른 초기 상태 설정
          setUserProfile(parsedProfile);
          checkProfileComplete(parsedProfile);
        } catch (e) {
          console.warn("캐시 데이터 파싱 오류:", e);
        }
      }
      
      // 오프라인 상태 확인 추가
      if (isOffline()) {
        console.log("오프라인 상태: 캐시된 프로필 사용");
        // 캐시된 프로필이 없으면 기본 프로필 생성
        if (!cachedProfile) {
          const defaultProfile = createDefaultProfile();
          setUserProfile(defaultProfile);
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(defaultProfile));
          checkProfileComplete(defaultProfile);
        }
        setLoading(false);
        return;
      }
      
      // Firebase에서 최신 데이터 가져오기
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const profileData = userDoc.data();
          console.log("Firestore에서 로드된 사용자 프로필:", profileData);
          
          // 중요: preferredLocations과 preferredCategories 데이터 처리 개선
          let locationData = [];
          
          // Firebase에 preferredLocations가 있으면 우선 사용
          if (Array.isArray(profileData.preferredLocations) && profileData.preferredLocations.length > 0) {
            locationData = [...profileData.preferredLocations];
          } 
          // 없으면 preferredCategories를 확인
          else if (Array.isArray(profileData.preferredCategories) && profileData.preferredCategories.length > 0) {
            locationData = [...profileData.preferredCategories];
          }
          
          // preferredRegions가 문자열 배열인 경우 객체 배열로 변환
          if (Array.isArray(profileData.preferredRegions) && profileData.preferredRegions.length > 0 && 
              typeof profileData.preferredRegions[0] === 'string') {
            try {
              // regionOptions 데이터를 직접 가져오지 못하므로 regionId만 객체로 변환
              const convertedLocations = profileData.preferredRegions.map(regionId => {
                // 간단한 지역 추출 (예: seoul_gangnam -> { region: '서울', subRegion: '강남' })
                let region, subRegion;
                
                if (regionId.includes('_')) {
                  const [mainRegion, subPart] = regionId.split('_');
                  region = mainRegion === 'seoul' ? '서울' : 
                          mainRegion === 'gyeonggi' ? '경기도' : 
                          mainRegion === 'incheon' ? '인천' : mainRegion;
                  subRegion = subPart;  // 더 세부적인 변환이 필요할 수 있음
                } else {
                  region = regionId;
                  subRegion = null;
                }
                
                return { region, subRegion, id: regionId };
              });
              
              // 데이터 저장
              locationData = convertedLocations;
              
              // Firestore에 업데이트
              if (convertedLocations.length > 0) {
                try {
                  await updateDoc(doc(db, 'users', userId), {
                    preferredLocations: convertedLocations
                  });
                  console.log("preferredRegions를 preferredLocations로 변환하여 저장됨");
                } catch (updateError) {
                  console.warn("preferredRegions 업데이트 실패 (오프라인 상태일 수 있음):", updateError);
                }
              }
            } catch (conversionError) {
              console.warn("preferredRegions 변환 오류:", conversionError);
            }
          }
          
          // 데이터 복제 및 필드 누락 방지
          const processedData = {
            ...profileData,
            mbti: profileData.mbti || '',
            interests: Array.isArray(profileData.interests) ? [...profileData.interests] : [],
            customInterests: Array.isArray(profileData.customInterests) ? [...profileData.customInterests] : [],
            talents: Array.isArray(profileData.talents) ? [...profileData.talents] : [],
            // 중요: 관심 지역 데이터 결합/복제
            preferredLocations: locationData.length > 0 ? locationData : [{ region: '서울', subRegion: '강남/서초' }],
            // Firebase에도 저장해서 다음 번에는 preferredLocations 필드가 있도록 함
            photoURL: profileData.photoURL || auth.currentUser?.photoURL || null,
            name: profileData.name || auth.currentUser?.displayName || '',
            email: profileData.email || auth.currentUser?.email || '',
          };
          
          // 중요: 관심 지역 데이터가 빈 배열인 경우 Firebase 업데이트 안 함
          if (locationData.length > 0 && !profileData.preferredLocations) {
            try {
              // Firebase에 preferredLocations 필드 추가
              await updateDoc(doc(db, 'users', userId), {
                preferredLocations: locationData
              });
              console.log("preferredLocations 필드 자동 추가됨");
            } catch (updateError) {
              console.warn("preferredLocations 필드 업데이트 실패:", updateError);
            }
          }
          
          setUserProfile(processedData);
          
          // 로컬 스토리지 업데이트
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(processedData));
          sessionStorage.setItem(`userProfile_${userId}`, JSON.stringify(processedData));
          
          checkProfileComplete(processedData);
          console.log("최종 처리된 프로필 데이터:", processedData);
        } else {
          console.log("사용자 프로필이 Firestore에 존재하지 않음");
          
          // 초기 프로필 생성 - 기본값 추가
          const initialProfile = createDefaultProfile();
          
          try {
            await setDoc(doc(db, 'users', userId), initialProfile);
          } catch (setError) {
            console.warn("초기 프로필 저장 실패 (오프라인 상태일 수 있음):", setError);
          }
          
          setUserProfile(initialProfile);
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(initialProfile));
          sessionStorage.setItem(`userProfile_${userId}`, JSON.stringify(initialProfile));
          checkProfileComplete(initialProfile);
        }
      } catch (firebaseError) {
        console.warn("Firebase 데이터 로드 실패 (오프라인 상태일 수 있음):", firebaseError);
        // 이미 캐시된 데이터가 설정되어 있으므로 오류 무시
        // 캐시된 데이터가 없으면 기본 프로필 생성
        if (!cachedProfile) {
          const defaultProfile = createDefaultProfile();
          setUserProfile(defaultProfile);
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(defaultProfile));
          checkProfileComplete(defaultProfile);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // 오류 발생 시 기본 프로필 생성하여 앱 작동 보장
      const defaultProfile = createDefaultProfile();
      setUserProfile(defaultProfile);
      localStorage.setItem(`userProfile_${userId}`, JSON.stringify(defaultProfile));
      checkProfileComplete(defaultProfile);
    } finally {
      setLoading(false);
    }
  }, [checkProfileComplete]);

  // 임시 사용자 프로필 로드 (로그인 없이 사용 시)
  const loadTempUserProfile = useCallback(() => {
    console.log("loadTempUserProfile 실행");
    const tempUserId = 'tempUser';
    const cachedProfile = localStorage.getItem(`userProfile_${tempUserId}`);
    
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      console.log("임시 사용자 프로필 로드:", parsedProfile);
      setUserProfile(parsedProfile);
      checkProfileComplete(parsedProfile);
    } else {
      console.log("임시 사용자 프로필 없음, 초기화");
      // 임시 프로필 초기화 - 기본값 적용
      const initialProfile = createDefaultProfile();
      
      localStorage.setItem(`userProfile_${tempUserId}`, JSON.stringify(initialProfile));
      setUserProfile(initialProfile);
      checkProfileComplete(initialProfile);
    }
  }, [checkProfileComplete]);
  
  // 피드백 동기화 함수 (오프라인 큐 처리용)
  const processFeedbackItem = useCallback(async (feedbackData) => {
    if (!currentUser) return false;
    
    try {
      const { placeId, rating, comment, existingFeedbackId } = feedbackData;
      
      // 서버 데이터 준비
      const serverFeedbackData = {
        userId: currentUser.uid,
        placeId,
        rating,
        comment,
        timestamp: serverTimestamp(),
        syncedAt: serverTimestamp(),
        syncSource: 'offlineQueue'
      };
      
      if (existingFeedbackId && !existingFeedbackId.startsWith('local_')) {
        // 기존 피드백 업데이트
        await updateDoc(doc(db, 'feedbacks', existingFeedbackId), {
          rating,
          comment,
          timestamp: serverTimestamp(),
          syncedAt: serverTimestamp(),
          syncSource: 'offlineQueue'
        });
        
        console.log("피드백 업데이트 동기화 성공:", existingFeedbackId);
        
        // 로컬 데이터 업데이트
        const updatedFeedbacks = feedbacks.map(f => 
          f.id === existingFeedbackId 
            ? { ...f, rating, comment, _synced: true }
            : f
        );
        
        setFeedbacks(updatedFeedbacks);
        localStorage.setItem(`feedbacks_${currentUser.uid}`, JSON.stringify(updatedFeedbacks));
      } else {
        // 새 피드백 추가
        const docRef = await addDoc(collection(db, 'feedbacks'), serverFeedbackData);
        console.log("새 피드백 추가 동기화 성공:", docRef.id);
        
        // 로컬 데이터 업데이트 - 기존에 같은 placeId를 가진 로컬 항목을 새 ID로 업데이트
        const updatedFeedbacks = feedbacks.map(f => 
          (f.placeId === placeId && f.id.startsWith('local_'))
            ? { ...f, id: docRef.id, _synced: true }
            : f
        );
        
        setFeedbacks(updatedFeedbacks);
        localStorage.setItem(`feedbacks_${currentUser.uid}`, JSON.stringify(updatedFeedbacks));
      }
      
      return true;
    } catch (error) {
      console.error("피드백 동기화 실패:", error);
      throw error; // 상위 레벨에서 재시도 처리할 수 있도록 오류 전파
    }
  }, [currentUser, feedbacks]);

  // 저장 장소 동기화 함수 (오프라인 큐 처리용)
  const syncSavedPlace = useCallback(async (saveData) => {
    if (!currentUser) return false;
    
    try {
      const { placeId, placeData } = saveData;
      
      // 서버 데이터 준비
      const serverSaveData = {
        userId: currentUser.uid,
        placeId,
        placeData,
        savedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
        syncSource: 'offlineQueue'
      };
      
      // Firestore에 저장
      const docRef = await addDoc(collection(db, 'savedPlaces'), serverSaveData);
      console.log("저장 장소 동기화 성공:", docRef.id);
      
      // 로컬 데이터 업데이트
      const updatedSaves = savedPlaces.map(save => 
        (save.placeId === placeId && save.id.startsWith('local_')) 
          ? { ...save, id: docRef.id, _synced: true }
          : save
      );
      
      setSavedPlaces(updatedSaves);
      localStorage.setItem(`savedPlaces_${currentUser.uid}`, JSON.stringify(updatedSaves));
      
      return true;
    } catch (error) {
      console.error("저장 장소 동기화 실패:", error);
      throw error; // 상위 레벨에서 재시도 처리할 수 있도록 오류 전파
    }
  }, [currentUser, savedPlaces]);
  
  // 방문 기록 동기화 함수 (오프라인 큐 처리용)
  const syncVisitedPlace = useCallback(async (visitData) => {
    if (!currentUser) return false;
    
    try {
      const { placeId, placeData, visitDate } = visitData;
      
      // 서버에 저장할 데이터 준비
      const serverVisitData = {
        userId: currentUser.uid,
        placeId,
        visitDate,
        placeData,
        createdAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
        syncSource: 'offlineQueue'
      };
      
      // Firestore에 저장
      const docRef = await addDoc(collection(db, 'visitedPlaces'), serverVisitData);
      console.log("방문 기록 동기화 성공:", docRef.id);
      
      // 저장 성공 후 로컬 데이터 업데이트
      const updatedVisits = visitedPlaces.map(visit => 
        (visit.placeId === placeId && visit.visitDate === visitDate) 
          ? { ...visit, id: docRef.id, _synced: true }
          : visit
      );
      
      setVisitedPlaces(updatedVisits);
      localStorage.setItem(`visitedPlaces_${currentUser.uid}`, JSON.stringify(updatedVisits));
      
      return true;
    } catch (error) {
      console.error("방문 기록 동기화 실패:", error);
      throw error; // 상위 레벨에서 재시도 처리할 수 있도록 오류 전파
    }
  }, [currentUser, visitedPlaces]);

  // 프로필 업데이트
  const updateUserProfile = useCallback(async (profileData, merge = true) => {
    try {
      console.log("updateUserProfile 실행:", profileData, "merge:", merge);
      // 디버깅 로그 추가
      console.log("preferredLocations 업데이트 데이터:", profileData.preferredLocations);
      
      if (!currentUser) {
        console.log("사용자 인증 없음, 로컬 스토리지에만 저장");
        // 사용자 인증이 없는 경우, 임시로 localStorage에만 저장
        const tempUserId = 'tempUser';
        const existingData = localStorage.getItem(`userProfile_${tempUserId}`);
        const updatedData = merge && existingData
          ? { ...JSON.parse(existingData), ...profileData }
          : profileData;
        
        // 필수 데이터 누락 시 기본값 보장
        if (!updatedData.interests || updatedData.interests.length === 0) {
          updatedData.interests = ['여행', '카페', '맛집'];
        }
        if (!updatedData.talents || updatedData.talents.length === 0) {
          updatedData.talents = ['사진촬영'];
        }
        if (!updatedData.preferredLocations || updatedData.preferredLocations.length === 0) {
          updatedData.preferredLocations = [{ region: '서울', subRegion: '강남/서초' }];
        }
        
        localStorage.setItem(`userProfile_${tempUserId}`, JSON.stringify(updatedData));
        setUserProfile(updatedData);
        checkProfileComplete(updatedData);
        return { success: true };
      }
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태에서 프로필 업데이트:", profileData);
        
        // 로컬 데이터 업데이트
        const updatedData = merge && userProfile
          ? { ...userProfile, ...profileData }
          : profileData;
        
        // 필수 데이터 누락 시 기본값 보장
        if (!updatedData.interests || updatedData.interests.length === 0) {
          updatedData.interests = ['여행', '카페', '맛집'];
        }
        if (!updatedData.talents || updatedData.talents.length === 0) {
          updatedData.talents = ['사진촬영'];
        }
        if (!updatedData.preferredLocations || updatedData.preferredLocations.length === 0) {
          updatedData.preferredLocations = [{ region: '서울', subRegion: '강남/서초' }];
        }
        
        // 로컬 스토리지 업데이트
        const userId = currentUser.uid;
        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedData));
        sessionStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedData));
        
        // 상태 업데이트
        setUserProfile(updatedData);
        checkProfileComplete(updatedData);
        
        // 오프라인 큐에 추가
        setOfflineQueue(prev => [...prev, {
          type: 'updateProfile',
          data: profileData,
          merge,
          timestamp: new Date().toISOString()
        }]);
        
        return { 
          success: true, 
          offline: true,
          message: '프로필이 로컬에 저장되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
        };
      }
      
      // Firestore에 저장
      const userId = currentUser.uid;
      console.log("Firestore에 저장 중:", userId, profileData);
      
      if (merge) {
        await setDoc(doc(db, 'users', userId), profileData, { merge: true });
      } else {
        await setDoc(doc(db, 'users', userId), profileData);
      }
      
      // 로컬 데이터 업데이트
      const updatedData = merge && userProfile
        ? { ...userProfile, ...profileData }
        : profileData;
      
      // 필수 데이터 누락 시 기본값 보장
      if (!updatedData.interests || updatedData.interests.length === 0) {
        updatedData.interests = ['여행', '카페', '맛집'];
      }
      if (!updatedData.talents || updatedData.talents.length === 0) {
        updatedData.talents = ['사진촬영'];
      }
      if (!updatedData.preferredLocations || updatedData.preferredLocations.length === 0) {
        updatedData.preferredLocations = [{ region: '서울', subRegion: '강남/서초' }];
      }
      
      console.log("업데이트된 프로필 데이터:", updatedData);
      localStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedData));
      sessionStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedData));
      setUserProfile(updatedData);
      checkProfileComplete(updatedData);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // 네트워크 오류인 경우 오프라인 큐에 추가
      if (!navigator.onLine || error.code === 'unavailable' || error.message?.includes('network')) {
        console.log("네트워크 오류로 인해 오프라인 모드로 프로필 업데이트");
        
        // 로컬 데이터 업데이트
        const updatedData = merge && userProfile
          ? { ...userProfile, ...profileData }
          : profileData;
        
        // 필수 데이터 누락 시 기본값 보장
        if (!updatedData.interests || updatedData.interests.length === 0) {
          updatedData.interests = ['여행', '카페', '맛집'];
        }
        if (!updatedData.talents || updatedData.talents.length === 0) {
          updatedData.talents = ['사진촬영'];
        }
        if (!updatedData.preferredLocations || updatedData.preferredLocations.length === 0) {
          updatedData.preferredLocations = [{ region: '서울', subRegion: '강남/서초' }];
        }
        
        if (currentUser) {
          const userId = currentUser.uid;
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedData));
          sessionStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedData));
        } else {
          const tempUserId = 'tempUser';
          localStorage.setItem(`userProfile_${tempUserId}`, JSON.stringify(updatedData));
        }
        
        // 상태 업데이트
        setUserProfile(updatedData);
        checkProfileComplete(updatedData);
        
        // 오프라인 큐에 추가
        setOfflineQueue(prev => [...prev, {
          type: 'updateProfile',
          data: profileData,
          merge,
          timestamp: new Date().toISOString()
        }]);
        
        return { 
          success: true, 
          offline: true,
          message: '네트워크 오류: 프로필이 로컬에 저장되었습니다. 연결 복구 시 서버에 반영됩니다.'
        };
      }
      
      return { success: false, error };
    }
  }, [currentUser, userProfile, checkProfileComplete]);
  
  // 감정 상태 업데이트
  const updateMood = useCallback(async (mood, intensity = 3) => {
    const moodData = {
      currentMood: {
        mood,
        intensity,
        timestamp: new Date().toISOString()
      }
    };
    return updateUserProfile(moodData);
  }, [updateUserProfile]);

  // 오프라인 큐 처리 함수
  const processOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || !currentUser || !networkStatus.isOnline) return;
    
    console.log(`오프라인 큐 처리 시작: ${offlineQueue.length}개 작업`);
    const queue = [...offlineQueue];
    setOfflineQueue([]); // 큐 초기화
    
    for (const item of queue) {
      try {
        console.log(`오프라인 작업 처리: ${item.type}`, item);
        
        switch (item.type) {
          case 'addFeedback':
            await processFeedbackItem(item.data);
            break;
          case 'updateProfile':
            await updateUserProfile(item.data, true);
            break;
          case 'addVisit':
            await syncVisitedPlace(item.data);
            break;
          case 'savePlace':
            await syncSavedPlace(item.data);
            break;
          default:
            console.warn(`알 수 없는 오프라인 작업 유형: ${item.type}`);
        }
      } catch (error) {
        console.error(`오프라인 작업 처리 실패 (${item.type}):`, error);
        
        // 실패한 작업 다시 큐에 추가 (최대 재시도 횟수 확인)
        const retryCount = (item.retryCount || 0) + 1;
        if (retryCount <= 3) { // 최대 3번 재시도
          setOfflineQueue(prev => [...prev, {...item, retryCount}]);
        } else {
          console.warn(`최대 재시도 횟수 초과 (${item.type}):`, item);
        }
      }
    }
  }, [offlineQueue, currentUser, networkStatus.isOnline, processFeedbackItem, syncVisitedPlace, syncSavedPlace, updateUserProfile]);
 
  // 네트워크 상태 감지
  useEffect(() => {
    const handleOnline = () => {
      console.log("네트워크 연결 복구됨");
      setNetworkStatus(prev => ({
        isOnline: true,
        lastOnline: new Date().toISOString(),
        reconnected: prev.isOnline === false // 연결이 복구된 경우에만 true
      }));
    };

       
    const handleOffline = () => {
      console.log("네트워크 연결 끊김");
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false
      }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // 네트워크 재연결 시 오프라인 큐 처리
  useEffect(() => {
    if (networkStatus.reconnected && offlineQueue.length > 0 && currentUser) {
      console.log("네트워크 재연결: 오프라인 큐 처리 시작", offlineQueue.length);
      processOfflineQueue();
    }
  }, [networkStatus.reconnected, offlineQueue.length, currentUser, processOfflineQueue]);
  
  // 방문 이력 로드 함수
  const loadVisitedPlaces = useCallback(async () => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 로컬 스토리지에서 확인
      const cachedVisits = localStorage.getItem(`visitedPlaces_${userId}`);
      if (cachedVisits) {
        setVisitedPlaces(JSON.parse(cachedVisits));
      }
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태: 캐시된 방문 기록 사용");
        return;
      }
      
      // 로그인한 경우 Firestore에서 가져오기
      if (currentUser) {
        try {
          const visitsQuery = query(
            collection(db, 'visitedPlaces'),
            where('userId', '==', userId),
            orderBy('visitDate', 'desc')
          );
          
          const snapshot = await getDocs(visitsQuery);
          const visitsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setVisitedPlaces(visitsData);
          localStorage.setItem(`visitedPlaces_${userId}`, JSON.stringify(visitsData));
        } catch (firebaseError) {
          console.warn("Firebase 방문 기록 로드 실패 (오프라인 상태일 수 있음):", firebaseError);
        }
      }
    } catch (error) {
      console.error('Error loading visited places:', error);
      
      // 오류 발생 시 빈 배열로 초기화하고 계속 진행
      setVisitedPlaces([]);
    }
  }, [currentUser]);

  // 피드백 데이터 로드 함수
  const loadFeedbacks = useCallback(async () => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 로컬 스토리지에서 확인
      const cachedFeedbacks = localStorage.getItem(`feedbacks_${userId}`);
      if (cachedFeedbacks) {
        setFeedbacks(JSON.parse(cachedFeedbacks));
      }
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태: 캐시된 피드백 데이터 사용");
        return;
      }
      
      // 로그인한 경우 Firestore에서 가져오기
      if (currentUser) {
        try {
          const feedbackQuery = query(
            collection(db, 'feedbacks'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
          );
          
          const snapshot = await getDocs(feedbackQuery);
          const feedbacksData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setFeedbacks(feedbacksData);
          localStorage.setItem(`feedbacks_${userId}`, JSON.stringify(feedbacksData));
        } catch (firebaseError) {
          console.warn("Firebase 피드백 로드 실패 (오프라인 상태일 수 있음):", firebaseError);
        }
      }
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      
      // 오류 발생 시 빈 배열로 초기화하고 계속 진행
      setFeedbacks([]);
    }
  }, [currentUser]);

  // 저장된 장소 로드 함수
  const loadSavedPlaces = useCallback(async () => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 로컬 스토리지에서 확인
      const cachedSaved = localStorage.getItem(`savedPlaces_${userId}`);
      if (cachedSaved) {
        setSavedPlaces(JSON.parse(cachedSaved));
      }
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태: 캐시된 저장 장소 사용");
        return;
      }

      // 로그인한 경우 Firestore에서 가져오기
      if (currentUser) {
        try {
          const savedQuery = query(
            collection(db, 'savedPlaces'),
            where('userId', '==', userId),
            orderBy('savedAt', 'desc')
          );
          
          const snapshot = await getDocs(savedQuery);
          const savedData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setSavedPlaces(savedData);
          localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(savedData));
        } catch (firebaseError) {
          console.warn("Firebase 저장 장소 로드 실패 (오프라인 상태일 수 있음):", firebaseError);
        }
      }
    } catch (error) {
      console.error('Error loading saved places:', error);
      
      // 오류 발생 시 빈 배열로 초기화하고 계속 진행
      setSavedPlaces([]);
    }
  }, [currentUser]);

  // 방문 기록 추가 함수
  const addVisitedPlace = useCallback(async (placeId, placeData = {}, visitDate = new Date().toISOString()) => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      const visitData = {
        userId,
        placeId,
        visitDate,
        placeData,
        createdAt: serverTimestamp()
      };
      
      // 로컬 스토리지 업데이트
      const updatedVisits = [
        { ...visitData, id: `local_${Date.now()}` },
        ...visitedPlaces
      ];
      setVisitedPlaces(updatedVisits);
      localStorage.setItem(`visitedPlaces_${userId}`, JSON.stringify(updatedVisits));
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태에서 방문 기록 추가:", placeId);
        
        // 오프라인 큐에 추가
        setOfflineQueue(prev => [...prev, {
          type: 'addVisit',
          data: {
            placeId,
            placeData,
            visitDate
          },
          timestamp: new Date().toISOString()
        }]);
        
        return { 
          success: true, 
          data: visitData, 
          offline: true,
          message: '방문 기록이 로컬에 저장되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
        };
      }
      
      // 로그인한 경우 Firestore에도 저장
      if (currentUser) {
        try {
          const docRef = await addDoc(collection(db, 'visitedPlaces'), visitData);
          // 로컬 데이터에 ID 업데이트
          const updatedWithId = updatedVisits.map((visit, index) => 
            index === 0 ? { ...visit, id: docRef.id } : visit
          );
          setVisitedPlaces(updatedWithId);
          localStorage.setItem(`visitedPlaces_${userId}`, JSON.stringify(updatedWithId));
          
          return { success: true, data: { id: docRef.id, ...visitData } };
        } catch (firebaseError) {
          console.warn("Firebase 방문 기록 저장 실패 (오프라인 상태일 수 있음):", firebaseError);
          
          // 오프라인 큐에 추가
          setOfflineQueue(prev => [...prev, {
            type: 'addVisit',
            data: {
              placeId,
              placeData,
              visitDate
            },
            timestamp: new Date().toISOString()
          }]);
          
          return { 
            success: true, 
            data: visitData, 
            offline: true,
            message: '네트워크 오류: 방문 기록이 로컬에 저장되었습니다. 연결 복구 시 서버에 반영됩니다.'
          };
        }
      }
      
      return { success: true, data: visitData };
    } catch (error) {
      console.error('Error adding visited place:', error);
      return { success: false, error };
    }
  }, [currentUser, visitedPlaces]);

  // 방문 기록 삭제 함수
  const removeVisitedPlace = useCallback(async (visitId) => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 로컬 스토리지에서 삭제
      const updatedVisits = visitedPlaces.filter(visit => visit.id !== visitId);
      setVisitedPlaces(updatedVisits);
      localStorage.setItem(`visitedPlaces_${userId}`, JSON.stringify(updatedVisits));
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태에서 방문 기록 삭제:", visitId);
        
        // 로컬 상태에서만 삭제되도록 하고, 서버 동기화 작업은 등록하지 않음
        // (대신 삭제 작업은 로컬 삭제만 수행하고, 서버에 있는 항목은 그대로 유지)
        
        return { 
          success: true, 
          offline: true,
          message: '방문 기록이 로컬에서 삭제되었습니다.'
        };
      }
      
      // 로그인한 경우 Firestore에서도 삭제
      if (currentUser && !visitId.startsWith('local_')) {
        try {
          await deleteDoc(doc(db, 'visitedPlaces', visitId));
        } catch (firebaseError) {
          console.warn("Firebase 방문 기록 삭제 실패 (오프라인 상태일 수 있음):", firebaseError);
          
          // 오프라인이면 나중에 동기화할 항목 목록에 추가
          if (isOffline()) {
            // ID가 로컬 ID가 아니면(Firebase ID), 삭제 작업 등록
            if (!visitId.startsWith('local_')) {
              // 삭제 작업은 별도 큐에 보관 (다른 작업보다 우선 순위가 낮음)
              localStorage.setItem(`delete_visit_${visitId}`, JSON.stringify({
                id: visitId,
                timestamp: new Date().toISOString()
              }));
            }
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error removing visited place:', error);
      return { success: false, error };
    }
  }, [currentUser, visitedPlaces]);

  // 피드백 추가 함수
  const addFeedback = useCallback(async (placeId, rating, comment = '') => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 이미 있는 피드백인지 확인
      const existingFeedback = feedbacks.find(f => f.placeId === placeId);
      
      const feedbackData = {
        userId,
        placeId,
        rating,
        comment,
        timestamp: new Date().toISOString()
      };
      
      let updatedFeedbacks;
      
      // 네트워크 상태 확인 추가
      if (!navigator.onLine) {
        console.log("오프라인 상태에서 피드백 추가/수정:", placeId);
        
        if (existingFeedback) {
          // 기존 피드백 업데이트 (로컬)
          updatedFeedbacks = feedbacks.map(f => 
            f.placeId === placeId ? { ...f, ...feedbackData } : f
          );
        } else {
          // 새 피드백 추가 (로컬)
          const newFeedback = { 
            ...feedbackData, 
            id: `local_${Date.now()}` 
          };
          updatedFeedbacks = [newFeedback, ...feedbacks];
        }
        
        // 상태 및 로컬 스토리지 업데이트
        setFeedbacks(updatedFeedbacks);
        localStorage.setItem(`feedbacks_${userId}`, JSON.stringify(updatedFeedbacks));
        
        // 오프라인 큐에 추가
        setOfflineQueue(prev => [...prev, {
          type: 'addFeedback',
          data: {
            placeId,
            rating,
            comment,
            existingFeedbackId: existingFeedback?.id
          },
          timestamp: new Date().toISOString()
        }]);
        
        return { 
          success: true, 
          data: existingFeedback ? { ...feedbackData, id: existingFeedback.id } : { ...feedbackData, id: `local_${Date.now()}` },
          offline: true,
          message: '오프라인 상태입니다. 리뷰가 로컬에 저장되었으며, 네트워크 연결 시 서버에 반영됩니다.'
        };
      }
      
      if (existingFeedback) {
        // 기존 피드백 업데이트
        updatedFeedbacks = feedbacks.map(f => 
          f.placeId === placeId ? { ...f, ...feedbackData } : f
        );
        
        // 오프라인 상태 확인 
        if (isOffline()) {
          console.log("오프라인 상태에서 피드백 업데이트:", placeId);
          
          setFeedbacks(updatedFeedbacks);
          localStorage.setItem(`feedbacks_${userId}`, JSON.stringify(updatedFeedbacks));
          
          // 오프라인 큐에 추가
          setOfflineQueue(prev => [...prev, {
            type: 'addFeedback',
            data: {
              placeId,
              rating,
              comment,
              existingFeedbackId: existingFeedback.id
            },
            timestamp: new Date().toISOString()
          }]);
          
          return { 
            success: true, 
            data: { ...feedbackData, id: existingFeedback.id },
            offline: true,
            message: '피드백이 로컬에 저장되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
          };
        }
        
        // Firestore 업데이트 (로그인한 경우)
        if (currentUser && existingFeedback.id && !existingFeedback.id.startsWith('local_')) {
          try {
            await updateDoc(doc(db, 'feedbacks', existingFeedback.id), {
              rating,
              comment,
              timestamp: serverTimestamp()
            });
            
            feedbackData.id = existingFeedback.id;
          } catch (firebaseError) {
            console.warn("Firebase 피드백 업데이트 실패 (오프라인 상태일 수 있음):", firebaseError);
            
            // 오프라인 큐에 추가
            setOfflineQueue(prev => [...prev, {
              type: 'addFeedback',
              data: {
                placeId,
                rating,
                comment,
                existingFeedbackId: existingFeedback.id
              },
              timestamp: new Date().toISOString()
            }]);
            
            return { 
              success: true, 
              data: { ...feedbackData, id: existingFeedback.id },
              offline: true,
              message: '네트워크 오류: 피드백이 로컬에 저장되었습니다. 연결 복구 시 서버에 반영됩니다.'
            };
          }
        }
      } else {
        // 새 피드백 추가
        const newFeedback = { 
          ...feedbackData, 
          id: `local_${Date.now()}` 
        };
        
        updatedFeedbacks = [newFeedback, ...feedbacks];
        
        // 오프라인 상태 확인
        if (isOffline()) {
          console.log("오프라인 상태에서 새 피드백 추가:", placeId);
          
          setFeedbacks(updatedFeedbacks);
          localStorage.setItem(`feedbacks_${userId}`, JSON.stringify(updatedFeedbacks));
          
          // 오프라인 큐에 추가
          setOfflineQueue(prev => [...prev, {
            type: 'addFeedback',
            data: {
              placeId,
              rating,
              comment
            },
            timestamp: new Date().toISOString()
          }]);
          
          return { 
            success: true, 
            data: newFeedback,
            offline: true,
            message: '피드백이 로컬에 저장되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
          };
        }
        
        // Firestore에 추가 (로그인한 경우)
        if (currentUser) {
          try {
            const docRef = await addDoc(collection(db, 'feedbacks'), {
              ...feedbackData,
              timestamp: serverTimestamp()
            });
            
            // id 업데이트
            newFeedback.id = docRef.id;
            updatedFeedbacks = [
              { ...newFeedback, id: docRef.id },
              ...feedbacks
            ];
          } catch (firebaseError) {
            console.warn("Firebase 피드백 추가 실패 (오프라인 상태일 수 있음):", firebaseError);
            
            // 오프라인 큐에 추가
            setOfflineQueue(prev => [...prev, {
              type: 'addFeedback',
              data: {
                placeId,
                rating,
                comment
              },
              timestamp: new Date().toISOString()
            }]);
            
            return { 
              success: true, 
              data: newFeedback,
              offline: true,
              message: '네트워크 오류: 피드백이 로컬에 저장되었습니다. 연결 복구 시 서버에 반영됩니다.'
            };
          }
        }
        
        feedbackData.id = newFeedback.id;
      }
      
      // 상태 및 로컬 스토리지 업데이트
      setFeedbacks(updatedFeedbacks);
      localStorage.setItem(`feedbacks_${userId}`, JSON.stringify(updatedFeedbacks));
      
      return { success: true, data: feedbackData };
    } catch (error) {
      console.error('Error adding feedback:', error);
      return { success: false, error };
    }
  }, [currentUser, feedbacks]);

  // 피드백 삭제 함수
  const removeFeedback = useCallback(async (feedbackId) => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 로컬 스토리지에서 삭제
      const updatedFeedbacks = feedbacks.filter(f => f.id !== feedbackId);
      setFeedbacks(updatedFeedbacks);
      localStorage.setItem(`feedbacks_${userId}`, JSON.stringify(updatedFeedbacks));
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태에서 피드백 삭제:", feedbackId);
        
        // 로컬 상태에서만 삭제되도록 하고, 서버 동기화 작업은 등록하지 않음
        return { 
          success: true, 
          offline: true,
          message: '피드백이 로컬에서 삭제되었습니다.'
        };
      }
      
      // 로그인한 경우 Firestore에서도 삭제
      if (currentUser && !feedbackId.startsWith('local_')) {
        try {
          await deleteDoc(doc(db, 'feedbacks', feedbackId));
        } catch (firebaseError) {
          console.warn("Firebase 피드백 삭제 실패 (오프라인 상태일 수 있음):", firebaseError);
          
          // 오프라인이면 나중에 동기화할 항목 목록에 추가
          if (isOffline()) {
            // ID가 로컬 ID가 아니면(Firebase ID), 삭제 작업 등록
            if (!feedbackId.startsWith('local_')) {
              // 삭제 작업은 별도 큐에 보관
              localStorage.setItem(`delete_feedback_${feedbackId}`, JSON.stringify({
                id: feedbackId,
                timestamp: new Date().toISOString()
              }));
            }
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error removing feedback:', error);
      return { success: false, error };
    }
  }, [currentUser, feedbacks]);

  // 장소 저장 함수
  const savePlace = useCallback(async (placeId, placeData = {}) => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 이미 저장된 장소인지 확인
      const existingSave = savedPlaces.find(s => s.placeId === placeId);
      if (existingSave) {
        return { success: true, data: existingSave, alreadySaved: true };
      }
      
      const saveData = {
        userId,
        placeId,
        placeData,
        savedAt: new Date().toISOString()
      };
      
      // 로컬에 임시 ID 부여
      const newSave = { 
        ...saveData, 
        id: `local_${Date.now()}` 
      };
      
      // 상태 업데이트
      const updatedSaves = [newSave, ...savedPlaces];
      setSavedPlaces(updatedSaves);
      localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(updatedSaves));
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태에서 장소 저장:", placeId);
        
        // 오프라인 큐에 추가
        setOfflineQueue(prev => [...prev, {
          type: 'savePlace',
          data: {
            placeId,
            placeData
          },
          timestamp: new Date().toISOString()
        }]);
        
        return { 
          success: true, 
          data: newSave,
          offline: true,
          message: '장소가 로컬에 저장되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
        };
      }
      
      // 로그인한 경우 Firestore에도 저장
      if (currentUser) {
        try {
          const docRef = await addDoc(collection(db, 'savedPlaces'), {
            ...saveData,
            savedAt: serverTimestamp()
          });
          
          // ID 업데이트
          const updatedWithId = updatedSaves.map((save, index) => 
            index === 0 ? { ...save, id: docRef.id } : save
          );
          setSavedPlaces(updatedWithId);
          localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(updatedWithId));
          
          return { success: true, data: { id: docRef.id, ...saveData } };
        } catch (firebaseError) {
          console.warn("Firebase 장소 저장 실패 (오프라인 상태일 수 있음):", firebaseError);
          
          // 오프라인 큐에 추가
          setOfflineQueue(prev => [...prev, {
            type: 'savePlace',
            data: {
              placeId,
              placeData
            },
            timestamp: new Date().toISOString()
          }]);
          
          return { 
            success: true, 
            data: newSave,
            offline: true,
            message: '네트워크 오류: 장소가 로컬에 저장되었습니다. 연결 복구 시 서버에 반영됩니다.'
          };
        }
      }
      
      return { success: true, data: newSave };
    } catch (error) {
      console.error('Error saving place:', error);
      return { success: false, error };
    }
  }, [currentUser, savedPlaces]);

  // 저장 취소 함수
  const unsavePlace = useCallback(async (placeId) => {
    try {
      const userId = currentUser?.uid || 'tempUser';
      
      // 해당 장소를 찾음
      const placeToRemove = savedPlaces.find(s => s.placeId === placeId);
      if (!placeToRemove) {
        return { success: false, error: 'Place not found in saved places' };
      }
      
      // 로컬 스토리지에서 삭제
      const updatedSaves = savedPlaces.filter(s => s.placeId !== placeId);
      setSavedPlaces(updatedSaves);
      localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(updatedSaves));
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태에서 장소 저장 취소:", placeId);
        
        // 로컬 상태에서만 삭제되도록 하고, 서버 동기화 작업은 등록하지 않음
        return { 
          success: true, 
          offline: true,
          message: '저장된 장소가 로컬에서 삭제되었습니다.'
        };
      }
      
      // 로그인한 경우 Firestore에서도 삭제
      if (currentUser && !placeToRemove.id.startsWith('local_')) {
        try {
          await deleteDoc(doc(db, 'savedPlaces', placeToRemove.id));
        } catch (firebaseError) {
          console.warn("Firebase 저장 장소 삭제 실패 (오프라인 상태일 수 있음):", firebaseError);
          
          // 오프라인이면 나중에 동기화할 항목 목록에 추가
          if (isOffline()) {
            // ID가 로컬 ID가 아니면(Firebase ID), 삭제 작업 등록
            if (!placeToRemove.id.startsWith('local_')) {
              // 삭제 작업은 별도 큐에 보관
              localStorage.setItem(`delete_saved_place_${placeToRemove.id}`, JSON.stringify({
                id: placeToRemove.id,
                placeId: placeId,
                timestamp: new Date().toISOString()
              }));
            }
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error removing saved place:', error);
      return { success: false, error };
    }
  }, [currentUser, savedPlaces]);

  // 장소가 저장되었는지 확인
  const isPlaceSaved = useCallback((placeId) => {
    return savedPlaces.some(place => place.placeId === placeId);
  }, [savedPlaces]);

  // 장소 피드백 확인
  const getPlaceFeedback = useCallback((placeId) => {
    return feedbacks.find(feedback => feedback.placeId === placeId);
  }, [feedbacks]);

  // // 인증 상태 변경 시 실행
  useEffect(() => {
    console.log("UserContext useEffect 실행");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("인증 상태 변경:", user ? `사용자 ID: ${user.uid}` : "로그인 안 됨");
      setCurrentUser(user);
      setLoading(true);
      
      if (user) {
        Promise.all([
          loadUserProfile(user.uid),
          loadVisitedPlaces(),
          loadFeedbacks(),
          loadSavedPlaces()
        ]).finally(() => {
          setLoading(false);
        });
      } else {
        // 로그인 없이 사용하는 경우 임시 데이터 불러오기
        Promise.all([
          loadTempUserProfile(),
          loadVisitedPlaces(),
          loadFeedbacks(),
          loadSavedPlaces()
        ]).finally(() => {
          setLoading(false);
        });
      }
    });
    
    return () => unsubscribe();
  }, [loadUserProfile, loadTempUserProfile, loadVisitedPlaces, loadFeedbacks, loadSavedPlaces]);

  // 오프라인 작업 관리를 위한 커스텀 hook 생성
  const useOfflineManager = useCallback(() => {
    // 오프라인 큐 길이 확인
    const queueLength = offlineQueue.length;
    
    // 수동 동기화 요청
    const requestSync = async () => {
      if (networkStatus.isOnline && queueLength > 0) {
        return await processOfflineQueue();
      }
      return {
        success: false,
        message: networkStatus.isOnline 
          ? "동기화할 작업이 없습니다." 
          : "오프라인 상태에서는 동기화할 수 없습니다."
      };
    };
    
    return {
      queueLength,
      isOnline: networkStatus.isOnline,
      requestSync,
      lastOnline: networkStatus.lastOnline
    };
  }, [networkStatus.isOnline, networkStatus.lastOnline, offlineQueue.length, processOfflineQueue]);

  const value = {
    currentUser,
    userProfile,
    loading,
    isProfileComplete,
    visitedPlaces,
    feedbacks,
    savedPlaces,
    updateUserProfile,
    updateMood,
    addVisitedPlace,
    removeVisitedPlace,
    addFeedback,
    removeFeedback,
    savePlace,
    unsavePlace,
    isPlaceSaved,
    getPlaceFeedback,
    // 오프라인 관련 기능 추가
    isOnline: networkStatus.isOnline,
    offlineManager: useOfflineManager(),
    offlineQueue: offlineQueue.length
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// 기본 export를 변경
export default UserContext;
