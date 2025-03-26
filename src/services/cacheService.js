// src/services/cacheService.js

import { 
  STORES,
  saveItem,
  getItemById,
  getItemsByIndex,
  deleteItem,
  clearStore,
  saveBulkItems
} from '../utils/indexedDBUtils';

// 네트워크 상태 확인 함수 추가
const isOffline = () => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

// 캐시 키 생성을 위한 유틸리티 함수
const generateCacheKey = (prefix, ...parts) => {
  return `${prefix}_${parts.filter(Boolean).join('_')}`;
};

// 캐시 만료 시간 (기본값: 1시간)
const DEFAULT_CACHE_EXPIRY = 60 * 60 * 1000; // 1시간

// 오프라인 모드일 때 캐시 만료 시간 연장 (1일)
const OFFLINE_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간

// 캐시 만료 시간 계산 함수
const calculateExpiryTime = (duration = DEFAULT_CACHE_EXPIRY) => {
  // 오프라인 상태일 때는 만료 시간을 더 길게 설정
  if (isOffline()) {
    return new Date(Date.now() + OFFLINE_CACHE_EXPIRY);
  }
  return new Date(Date.now() + duration);
};

// 캐시 만료 확인 함수
const isCacheExpired = (expiryDate) => {
  if (!expiryDate) return true;
  
  // 오프라인 상태일 때는 만료 시간을 연장
  if (isOffline()) {
    // 기존 만료 시간에 12시간 추가
    const adjustedExpiry = new Date(new Date(expiryDate).getTime() + (12 * 60 * 60 * 1000));
    return new Date() > adjustedExpiry;
  }
  
  return new Date() > new Date(expiryDate);
};

// 추천 데이터 캐싱 (현재 위치 기반)
const cacheRecommendations = async (userId, location, userProfile, places, filters = {}) => {
  if (!userId || !places || !Array.isArray(places)) return false;
  
  try {
    // 위치 좌표를 문자열로 변환 (캐시 키용)
    const locationStr = location 
      ? `${location.latitude.toFixed(4)}_${location.longitude.toFixed(4)}`
      : 'default';
    
    // 현재 MBTI와 감정 상태 추출 (캐시 키용)
    const mbti = userProfile?.mbti || 'unknown';
    const mood = userProfile?.currentMood?.mood || 'default';
    
    // 필터 문자열 생성
    const filterStr = filters ? Object.entries(filters).map(([k, v]) => `${k}:${v}`).join(',') : '';
    
    // 캐시 키 생성
    const cacheKey = generateCacheKey('nearby', userId, locationStr, mbti, mood, filterStr);
    
    // 캐시 데이터 생성
    const cacheData = {
      cacheKey,
      userId,
      location: {
        latitude: location?.latitude,
        longitude: location?.longitude
      },
      userProfileState: {
        mbti,
        mood
      },
      filters,
      data: places,
      timestamp: new Date().toISOString(),
      expiresAt: calculateExpiryTime(30 * 60 * 1000).toISOString() // 30분 후 만료
    };
    
    // IndexedDB에 저장
    await saveItem(STORES.RECOMMENDATIONS, cacheData);
    
    // 장소 데이터도 함께 저장
    await saveBulkItems(STORES.PLACES, places);
    
    // 오프라인 사용을 위한 로컬 스토리지 백업 (요약 데이터)
    try {
      // 전체 데이터는 크기가 클 수 있으므로 중요 정보만 저장
      const essentialData = {
        cacheKey,
        timestamp: cacheData.timestamp,
        expiresAt: cacheData.expiresAt,
        count: places.length,
        // 최대 3개의 장소만 요약 정보로 저장
        samplePlaces: places.slice(0, 3).map(place => ({
          id: place.id,
          name: place.name,
          category: place.category,
          thumbnail: place.thumbnail
        }))
      };
      
      localStorage.setItem(`rec_summary_${cacheKey}`, JSON.stringify(essentialData));
    } catch (localError) {
      console.warn('추천 데이터 로컬 저장소 백업 실패:', localError);
    }
    
    return true;
  } catch (error) {
    console.error('추천 데이터 캐싱 오류:', error);
    
    // IndexedDB 실패 시 로컬스토리지에 최소한의 데이터 저장 시도
    if (isOffline()) {
      try {
        const minimalCache = {
          userId,
          timestamp: new Date().toISOString(),
          placesCount: places.length,
          firstPlaceId: places[0]?.id
        };
        localStorage.setItem(`minimal_rec_${userId}`, JSON.stringify(minimalCache));
      } catch (localError) {
        console.warn('최소 데이터 캐싱 실패:', localError);
      }
    }
    
    return false;
  }
};

// 위치 기반 추천 데이터 가져오기
const getCachedRecommendations = async (userId, location, userProfile, filters = {}) => {
  if (!userId) return null;
  
  // 변수 선언을 try 블록 밖으로 이동
  let locationStr, mbti, mood, filterStr, cacheKey;
  
  try {
    // 위치 문자열 생성
    locationStr = location 
      ? `${location.latitude.toFixed(4)}_${location.longitude.toFixed(4)}`
      : 'default';
    
    // 현재 MBTI와 감정 상태 추출
    mbti = userProfile?.mbti || 'unknown';
    mood = userProfile?.currentMood?.mood || 'default';
    
    // 필터 문자열 생성
    filterStr = filters ? Object.entries(filters).map(([k, v]) => `${k}:${v}`).join(',') : '';
    
    // 캐시 키 생성
    cacheKey = generateCacheKey('nearby', userId, locationStr, mbti, mood, filterStr);
    

    
    // IndexedDB에서 가져오기
    const cacheData = await getItemById(STORES.RECOMMENDATIONS, cacheKey);
    
    if (!cacheData) {
      // IndexedDB에 없는 경우 로컬 스토리지 확인 (오프라인 상태일 때)
      if (isOffline()) {
        console.log('오프라인 상태에서 로컬 스토리지에서 추천 데이터 확인');
        const localCache = localStorage.getItem(`rec_summary_${cacheKey}`);
        
        if (localCache) {
          const summaryData = JSON.parse(localCache);
          console.log('추천 요약 데이터 발견:', summaryData);
          
          // 오프라인 상태에서는 만료된 캐시도 사용 (이후 업데이트)
          if (isOffline() || !isCacheExpired(summaryData.expiresAt)) {
            return summaryData.samplePlaces || [];
          }
        }
      }
      
      return null;
    }
    
    // 만료 여부 확인
    if (isCacheExpired(cacheData.expiresAt) && !isOffline()) {
      // 캐시 데이터가 만료됨 (오프라인 상태가 아닐 때만 삭제)
      await deleteItem(STORES.RECOMMENDATIONS, cacheKey);
      return null;
    }
    
    return cacheData.data;
  } catch (error) {
    console.error('캐시된 추천 데이터 가져오기 오류:', error);
    
    // 오프라인 상태에서 IndexedDB 접근 실패 시 로컬 스토리지 시도
    if (isOffline()) {
      try {
        // 위치 문자열 생성
        const locationStr = location 
          ? `${location.latitude.toFixed(4)}_${location.longitude.toFixed(4)}`
          : 'default';
        
        // 캐시 키 생성
        const cacheKey = generateCacheKey('nearby', userId, locationStr, mbti, mood, filterStr);
        const localCache = localStorage.getItem(`rec_summary_${cacheKey}`);
        
        if (localCache) {
          const summaryData = JSON.parse(localCache);
          return summaryData.samplePlaces || [];
        }
        
        // 최소한의 백업 데이터 확인
        const minimalCache = localStorage.getItem(`minimal_rec_${userId}`);
        if (minimalCache) {
          return [{ id: 'offline_data', name: '오프라인 데이터', offline: true }];
        }
      } catch (localError) {
        console.warn('로컬 추천 데이터 접근 실패:', localError);
      }
    }
    
    return null;
  }
};

// 관심 지역 추천 데이터 캐싱
const cacheRegionRecommendations = async (userId, region, userProfile, places, filters = {}) => {
  if (!userId || !region || !places || !Array.isArray(places)) return false;
  
  try {
    // 지역 정보 추출
const regionKey = region.subRegion || region.region;
if (!regionKey) return null;

// 현재 MBTI와 감정 상태 추출
const mbti = userProfile?.mbti || 'unknown';
const mood = userProfile?.currentMood?.mood || 'default';

// 필터 문자열 생성
const filterStr = filters ? Object.entries(filters).map(([k, v]) => `${k}:${v}`).join(',') : '';
    
    // 캐시 키 생성
    const cacheKey = generateCacheKey('region', userId, regionKey, mbti, mood, filterStr);
    
    // 캐시 데이터 생성
    const cacheData = {
      cacheKey,
      userId,
      region: regionKey,
      userProfileState: {
        mbti,
        mood
      },
      filters,
      data: places,
      timestamp: new Date().toISOString(),
      expiresAt: calculateExpiryTime(60 * 60 * 1000).toISOString() // 1시간 후 만료
    };
    
    // IndexedDB에 저장
    await saveItem(STORES.RECOMMENDATIONS, cacheData);
    
    // 장소 데이터도 함께 저장
    await saveBulkItems(STORES.PLACES, places);
    
    // 오프라인 백업
    try {
      // 요약 데이터만 로컬 스토리지에 저장
      const essentialData = {
        cacheKey,
        timestamp: cacheData.timestamp,
        expiresAt: cacheData.expiresAt,
        count: places.length,
        region: regionKey,
        samplePlaces: places.slice(0, 3).map(place => ({
          id: place.id,
          name: place.name,
          category: place.category,
          thumbnail: place.thumbnail
        }))
      };
      
      localStorage.setItem(`reg_summary_${cacheKey}`, JSON.stringify(essentialData));
    } catch (localError) {
      console.warn('지역 추천 데이터 로컬 저장소 백업 실패:', localError);
    }
    
    return true;
  } catch (error) {
    console.error('지역 추천 데이터 캐싱 오류:', error);
    
    // 오프라인 상태에서는 최소한의 데이터 저장 시도
    if (isOffline()) {
      try {
        const minimalCache = {
          userId,
          region: region.subRegion || region.region,
          timestamp: new Date().toISOString(),
          placesCount: places.length
        };
        localStorage.setItem(`minimal_region_${userId}_${region.subRegion || region.region}`, JSON.stringify(minimalCache));
      } catch (localError) {
        console.warn('지역 최소 데이터 캐싱 실패:', localError);
      }
    }
    
    return false;
  }
};

// 관심 지역 추천 데이터 가져오기
const getCachedRegionRecommendations = async (userId, region, userProfile, filters = {}) => {
  if (!userId || !region) return null;
  
  // 변수 선언을 try 블록 밖으로 이동
  let regionKey, mbti, mood, filterStr, cacheKey;
  
  try {
    // 지역 정보 추출
    regionKey = region.subRegion || region.region;
    if (!regionKey) return null;
    
    // 현재 MBTI와 감정 상태 추출
    mbti = userProfile?.mbti || 'unknown';
    mood = userProfile?.currentMood?.mood || 'default';
    
    // 필터 문자열 생성
    filterStr = filters ? Object.entries(filters).map(([k, v]) => `${k}:${v}`).join(',') : '';
    
    // 캐시 키 생성
    cacheKey = generateCacheKey('region', userId, regionKey, mbti, mood, filterStr);
    
    
    
       
    // IndexedDB에서 가져오기
    const cacheData = await getItemById(STORES.RECOMMENDATIONS, cacheKey);
    
    if (!cacheData) {
      // IndexedDB에 없는 경우 로컬 스토리지 확인 (오프라인 상태일 때)
      if (isOffline()) {
        console.log('오프라인 상태에서 로컬 스토리지에서 지역 추천 데이터 확인');
        const localCache = localStorage.getItem(`reg_summary_${cacheKey}`);
        
        if (localCache) {
          const summaryData = JSON.parse(localCache);
          console.log('지역 추천 요약 데이터 발견:', summaryData);
          
          // 오프라인 상태에서는 만료된 캐시도 사용
          if (isOffline() || !isCacheExpired(summaryData.expiresAt)) {
            return summaryData.samplePlaces || [];
          }
        }
      }
      
      return null;
    }
    
    // 만료 여부 확인
    if (isCacheExpired(cacheData.expiresAt) && !isOffline()) {
      // 캐시 데이터가 만료됨 (오프라인 상태가 아닐 때만 삭제)
      await deleteItem(STORES.RECOMMENDATIONS, cacheKey);
      return null;
    }
    
    return cacheData.data;
  } catch (error) {
    console.error('캐시된 지역 추천 데이터 가져오기 오류:', error);
    
    // 오프라인 상태에서 IndexedDB 접근 실패 시
    if (isOffline()) {
      try {
        // 캐시 키 생성
        const cacheKey = generateCacheKey('region', userId, regionKey, mbti, mood, filterStr);
        const localCache = localStorage.getItem(`reg_summary_${cacheKey}`);
        
        if (localCache) {
          const summaryData = JSON.parse(localCache);
          return summaryData.samplePlaces || [];
        }
        
        // 최소한의 백업 데이터 확인
        const minimalCache = localStorage.getItem(`minimal_region_${userId}_${regionKey}`);
        if (minimalCache) {
          return [{ id: 'offline_data', name: '오프라인 데이터', offline: true }];
        }
      } catch (localError) {
        console.warn('로컬 지역 추천 데이터 접근 실패:', localError);
      }
    }
    
    return null;
  }
};

// 장소 세부 정보 캐싱
const cachePlaceDetails = async (placeId, placeData) => {
  if (!placeId || !placeData) return false;
  
  try {
    // 장소 데이터에 ID가 없는 경우 추가
    const placeWithId = {
      ...placeData,
      id: placeId,
      // 중복 ID 필드 처리를 위해 placeId도 설정
      placeId: placeId,
      timestamp: new Date().toISOString(),
      // 만료 시간 추가
      expiresAt: calculateExpiryTime(2 * 60 * 60 * 1000).toISOString() // 2시간 후 만료
    };
    
    // IndexedDB에 저장
    await saveItem(STORES.PLACES, placeWithId);
    
    // 오프라인 백업 - 중요 데이터만 추출하여 로컬 저장소에 저장
    try {
      const essentialData = {
        id: placeId,
        name: placeData.name,
        category: placeData.category,
        description: placeData.description?.substring(0, 100), // 설명 100자로 제한
        thumbnail: placeData.thumbnail || placeData.photos?.[0],
        region: placeData.region,
        subRegion: placeData.subRegion,
        timestamp: new Date().toISOString(),
        expiresAt: calculateExpiryTime(2 * 60 * 60 * 1000).toISOString()
      };
      
      localStorage.setItem(`place_summary_${placeId}`, JSON.stringify(essentialData));
    } catch (localError) {
      console.warn('장소 세부 정보 로컬 저장소 백업 실패:', localError);
    }
    
    return true;
  } catch (error) {
    console.error('장소 세부 정보 캐싱 오류:', error);
    
    // 오프라인 상태에서 최소한의 데이터 저장
    if (isOffline()) {
      try {
        const minimalData = {
          id: placeId,
          name: placeData.name,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`minimal_place_${placeId}`, JSON.stringify(minimalData));
      } catch (localError) {
        console.warn('장소 최소 데이터 캐싱 실패:', localError);
      }
    }
    
    return false;
  }
};

// 장소 세부 정보 가져오기
const getCachedPlaceDetails = async (placeId) => {
  if (!placeId) return null;
  
  try {
    // IndexedDB에서 가져오기
    const placeData = await getItemById(STORES.PLACES, placeId);
    
    if (!placeData) {
      // IndexedDB에 없는 경우 로컬 스토리지 확인 (오프라인 상태일 때)
      if (isOffline()) {
        console.log('오프라인 상태에서 로컬 스토리지에서 장소 데이터 확인');
        const localCache = localStorage.getItem(`place_summary_${placeId}`);
        
        if (localCache) {
          const summaryData = JSON.parse(localCache);
          console.log('장소 요약 데이터 발견:', summaryData);
          
          // 오프라인 모드에서는 만료 검사 없이 반환
          return {
            ...summaryData,
            _fromLocalStorage: true,
            _limited: true
          };
        }
        
        // 최소한의 백업 데이터 확인
        const minimalCache = localStorage.getItem(`minimal_place_${placeId}`);
        if (minimalCache) {
          const minData = JSON.parse(minimalCache);
          return {
            ...minData,
            _fromLocalStorage: true,
            _minimal: true,
            description: '오프라인 모드에서 제한된 데이터입니다.'
          };
        }
      }
      
      return null;
    }
    
    // 만료 여부 확인 (장소 데이터는 오프라인 상태에서도 만료 검사)
    if (placeData.expiresAt && isCacheExpired(placeData.expiresAt) && !isOffline()) {
      // 오프라인 상태가 아닐 때만 삭제
      await deleteItem(STORES.PLACES, placeId);
      return null;
    }
    
    return placeData;
  } catch (error) {
    console.error('캐시된 장소 세부 정보 가져오기 오류:', error);
    
    // 오프라인 상태에서 IndexedDB 접근 실패 시 로컬 스토리지 시도
    if (isOffline()) {
      try {
        const localCache = localStorage.getItem(`place_summary_${placeId}`);
        if (localCache) {
          return {
            ...JSON.parse(localCache),
            _fromLocalStorage: true,
            _fallback: true
          };
        }
      } catch (localError) {
        console.warn('로컬 장소 데이터 접근 실패:', localError);
      }
    }
    
    return null;
  }
};

// 피드백 캐싱
const cacheFeedbacks = async (cacheKey, feedbacksData) => {
  if (!cacheKey || !feedbacksData) return false;
  
  try {
    // 캐시 데이터 생성
    const cacheData = {
      cacheKey,
      data: feedbacksData,
      timestamp: new Date().toISOString(),
      expiresAt: calculateExpiryTime(24 * 60 * 60 * 1000).toISOString() // 24시간 후 만료
    };
    
    // localStorage에 저장 (호환성 유지)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(feedbacksData));
    } catch (e) {
      console.warn('localStorage에 피드백 캐싱 실패:', e);
    }
    
    // IndexedDB에 저장
    const storeItem = {
      id: cacheKey,
      ...cacheData
    };
    
    await saveItem(STORES.FEEDBACKS, storeItem);
    
    return true;
  } catch (error) {
    console.error('피드백 캐싱 오류:', error);
    
    // IndexedDB 실패 시 로컬 스토리지만 사용
    try {
      localStorage.setItem(cacheKey, JSON.stringify(feedbacksData));
      return true;
    } catch (localError) {
      console.warn('피드백 로컬 저장 실패:', localError);
    }
    
    return false;
  }
};

// 피드백 가져오기
const getCachedFeedbacks = async (cacheKey) => {
  if (!cacheKey) return null;
  
  try {
    // IndexedDB에서 먼저 시도
    try {
      const cacheData = await getItemById(STORES.FEEDBACKS, cacheKey);
      
      if (cacheData) {
        // 만료 확인 (오프라인 상태가 아닐 때만)
        if (!isOffline() && isCacheExpired(cacheData.expiresAt)) {
          await deleteItem(STORES.FEEDBACKS, cacheKey);
          return null;
        }
        
        return cacheData.data;
      }
    } catch (e) {
      console.warn('IndexedDB에서 피드백 가져오기 실패:', e);
    }
    
    // IndexedDB에서 실패한 경우 localStorage 시도 (폴백)
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        // localStorage에는 만료 시간이 없으므로 항상 반환
        const parsedData = JSON.parse(cachedData);
        
        // 오프라인 상태라면 만료 시간 없이 사용
        if (isOffline()) {
          return parsedData;
        }
        
        // 온라인 상태에서는 기본 1일(24시간) 만료 적용
        const oneDay = 24 * 60 * 60 * 1000;
        const itemTimestamp = parsedData.timestamp ? 
          new Date(parsedData.timestamp).getTime() : 
          Date.now() - oneDay;
          
        if (Date.now() - itemTimestamp < oneDay) {
          return parsedData;
        } else {
          // 만료된 데이터 제거
          localStorage.removeItem(cacheKey);
          return null;
        }
      }
      
      return null;
    } catch (e) {
      console.warn('localStorage에서 피드백 가져오기 실패:', e);
      return null;
    }
  } catch (error) {
    console.error('캐시된 피드백 가져오기 오류:', error);
    return null;
  }
};

// 네트워크 상태 변경 이벤트 핸들러
const setupNetworkListeners = () => {
  if (typeof window === 'undefined') return;
  
  const handleOnline = () => {
    console.log('네트워크 연결 복구됨. 캐시 정책 업데이트.');
    // 캐시 정책 복구 - 실제로는 아무것도 할 필요 없음 (다음 접근 시 자동 처리)
  };
  
  const handleOffline = () => {
    console.log('네트워크 연결 끊김. 오프라인 모드로 전환.');
    // 캐시 정책 변경 - 실제로는 아무것도 할 필요 없음 (다음 접근 시 자동 처리)
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // 이미 설정했음을 표시
  window._cacheServiceNetworkListenersSet = true;
};

// 앱 초기화 시 네트워크 리스너 설정
if (typeof window !== 'undefined' && !window._cacheServiceNetworkListenersSet) {
  setupNetworkListeners();
}

// 타입별 캐시 클리어
const clearCacheByType = async (type) => {
  try {
    // 추천 캐시 클리어
    if (type === 'recommendations' || type.startsWith('recommend')) {
      await clearStore(STORES.RECOMMENDATIONS);
      
      // localStorage에서도 추천 캐시 클리어
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('rec_summary_') || key.startsWith('minimal_rec_')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    // 피드백 캐시 클리어
    if (type === 'feedbacks' || type.startsWith('feedback')) {
      await clearStore(STORES.FEEDBACKS);
      
      // localStorage에서도 피드백 캐시 클리어
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('feedback_')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    // 장소 캐시 클리어
    if (type === 'places' || type.startsWith('place')) {
      await clearStore(STORES.PLACES);
      
      // localStorage에서도 장소 캐시 클리어
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('place_summary_') || key.startsWith('minimal_place_')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    // 사용자별 캐시 클리어
    if (type.startsWith('user_')) {
      const userId = type.split('_')[1];
      
      if (userId) {
        // 해당 사용자의 추천 캐시 클리어
        const userRecommendations = await getItemsByIndex(STORES.RECOMMENDATIONS, 'userId', userId);
        for (const item of userRecommendations) {
          await deleteItem(STORES.RECOMMENDATIONS, item.cacheKey);
          
          // 관련 로컬 스토리지 항목도 제거
          localStorage.removeItem(`rec_summary_${item.cacheKey}`);
          localStorage.removeItem(`reg_summary_${item.cacheKey}`);
        }
        
        // 해당 사용자의 피드백 캐시 클리어
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`feedback_${userId}`)) {
            localStorage.removeItem(key);
          }
        });
        
        // 사용자 관련 최소 데이터도 제거
        localStorage.removeItem(`minimal_rec_${userId}`);
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`minimal_region_${userId}`)) {
            localStorage.removeItem(key);
          }
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error('캐시 클리어 오류:', error);
    
    // IndexedDB 실패 시 로컬 스토리지만 클리어 시도
    try {
      if (type === 'recommendations' || type.startsWith('recommend')) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('rec_summary_') || key.startsWith('minimal_rec_')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      if (type === 'feedbacks' || type.startsWith('feedback')) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('feedback_')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      if (type === 'places' || type.startsWith('place')) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('place_summary_') || key.startsWith('minimal_place_')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      return true;
    } catch (localError) {
      console.warn('로컬 스토리지 클리어 실패:', localError);
      return false;
    }
  }
};

// 만료된 캐시 데이터 정리
const cleanExpiredCache = async () => {
  try {
    let cleanedCount = 0;
    
    // 추천 캐시 정리
    const allRecommendations = await getItemsByIndex(STORES.RECOMMENDATIONS, 'timestamp');
    for (const item of allRecommendations) {
      if (item.expiresAt && isCacheExpired(item.expiresAt) && !isOffline()) {
        await deleteItem(STORES.RECOMMENDATIONS, item.cacheKey);
        
        // 관련 로컬 스토리지 항목도 제거
        localStorage.removeItem(`rec_summary_${item.cacheKey}`);
        localStorage.removeItem(`reg_summary_${item.cacheKey}`);
        
        cleanedCount++;
      }
    }
    
    // 피드백 캐시 정리
    const allFeedbacks = await getItemsByIndex(STORES.FEEDBACKS, 'timestamp');
    for (const item of allFeedbacks) {
      if (item.expiresAt && isCacheExpired(item.expiresAt) && !isOffline()) {
        await deleteItem(STORES.FEEDBACKS, item.id);
        
        // 관련 로컬 스토리지 항목도 제거
        localStorage.removeItem(item.id);
        
        cleanedCount++;
      }
    }
    
    // 장소 캐시 정리 (오래된 데이터만)
    const allPlaces = await getItemsByIndex(STORES.PLACES, 'timestamp');
    for (const item of allPlaces) {
      if (item.expiresAt && isCacheExpired(item.expiresAt) && !isOffline()) {
        await deleteItem(STORES.PLACES, item.id);
        
        // 관련 로컬 스토리지 항목도 제거
        localStorage.removeItem(`place_summary_${item.id}`);
        localStorage.removeItem(`minimal_place_${item.id}`);
        
        cleanedCount++;
      }
    }
    
    console.log(`캐시 정리 완료: ${cleanedCount}개 항목 제거됨`);
    return { success: true, cleanedCount };
  } catch (error) {
    console.error('캐시 정리 오류:', error);
    return { success: false, error: error.message };
  }
};

// 모든 캐시 클리어
const clearAllCache = async () => {
  try {
    // IndexedDB 스토어 클리어
    await clearStore(STORES.RECOMMENDATIONS);
    await clearStore(STORES.FEEDBACKS);
    await clearStore(STORES.PLACES);
    
    // localStorage 캐시 클리어
    // 추천 관련
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('rec_summary_') || 
          key.startsWith('reg_summary_') || 
          key.startsWith('minimal_rec_') || 
          key.startsWith('minimal_region_')) {
        localStorage.removeItem(key);
      }
    });
    
    // 피드백 관련
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('feedback_')) {
        localStorage.removeItem(key);
      }
    });
    
    // 장소 관련
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('place_summary_') || key.startsWith('minimal_place_')) {
        localStorage.removeItem(key);
      }
    });
    
    return true;
  } catch (error) {
    console.error('모든 캐시 클리어 오류:', error);
    
    // IndexedDB 실패 시 localStorage만 클리어 시도
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('rec_summary_') || 
            key.startsWith('reg_summary_') || 
            key.startsWith('minimal_rec_') || 
            key.startsWith('minimal_region_') ||
            key.startsWith('feedback_') ||
            key.startsWith('place_summary_') || 
            key.startsWith('minimal_place_')) {
          localStorage.removeItem(key);
        }
      });
      
      return true;
    } catch (localError) {
      console.warn('로컬 스토리지 클리어 실패:', localError);
      return false;
    }
  }
};

// 오프라인 상태에서 캐시 사용 가능 여부 확인
const checkOfflineCacheAvailability = () => {
  try {
    // 캐시된 추천 데이터 확인
    const hasRecommendations = Object.keys(localStorage).some(key => 
      key.startsWith('rec_summary_') || key.startsWith('minimal_rec_'));
    
    // 캐시된 장소 데이터 확인
    const hasPlaces = Object.keys(localStorage).some(key => 
      key.startsWith('place_summary_') || key.startsWith('minimal_place_'));
    
    // 캐시된 피드백 데이터 확인
    const hasFeedbacks = Object.keys(localStorage).some(key => 
      key.startsWith('feedback_'));
    
    return {
      success: true,
      hasRecommendations,
      hasPlaces,
      hasFeedbacks,
      hasAnyCache: hasRecommendations || hasPlaces || hasFeedbacks
    };
  } catch (error) {
    console.error('오프라인 캐시 확인 오류:', error);
    return {
      success: false,
      error: error.message,
      hasAnyCache: false
    };
  }
};

// 오프라인 모드에서 장소 검색 (로컬 캐시 내에서)
const searchOfflinePlaces = (query) => {
  try {
    if (!query || query.length < 2) return [];
    
    const searchTerm = query.toLowerCase();
    const results = [];
    
    // 로컬 저장소에서 장소 검색
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('place_summary_') || key.startsWith('minimal_place_')) {
        try {
          const placeData = JSON.parse(localStorage.getItem(key));
          
          // 이름, 설명, 카테고리 등으로 검색
          if (placeData.name?.toLowerCase().includes(searchTerm) || 
              placeData.description?.toLowerCase().includes(searchTerm) ||
              placeData.category?.toLowerCase().includes(searchTerm) ||
              placeData.region?.toLowerCase().includes(searchTerm) ||
              placeData.subRegion?.toLowerCase().includes(searchTerm)) {
            
            results.push({
              ...placeData,
              _fromLocalSearch: true
            });
          }
        } catch (parseError) {
          // 파싱 오류 무시
        }
      }
    });
    
    // 최대 10개 결과 반환
    return results.slice(0, 10);
  } catch (error) {
    console.error('오프라인 장소 검색 오류:', error);
    return [];
  }
};

// 추가 유틸리티 함수
const getCacheStatus = async () => {
  try {
    const recommendations = await getItemsByIndex(STORES.RECOMMENDATIONS, 'timestamp');
    const feedbacks = await getItemsByIndex(STORES.FEEDBACKS, 'timestamp');
    const places = await getItemsByIndex(STORES.PLACES, 'timestamp');
    
    return {
      success: true,
      counts: {
        recommendations: recommendations.length,
        feedbacks: feedbacks.length,
        places: places.length
      },
      localStorageItems: {
        recommendations: Object.keys(localStorage).filter(key => 
          key.startsWith('rec_summary_') || key.startsWith('minimal_rec_')).length,
        places: Object.keys(localStorage).filter(key => 
          key.startsWith('place_summary_') || key.startsWith('minimal_place_')).length,
        feedbacks: Object.keys(localStorage).filter(key => 
          key.startsWith('feedback_')).length
      }
    };
  } catch (error) {
    console.error('캐시 상태 확인 오류:', error);
    
    // IndexedDB 접근 실패 시 로컬 스토리지만 확인
    return {
      success: false,
      error: error.message,
      localStorageItems: {
        recommendations: Object.keys(localStorage).filter(key => 
          key.startsWith('rec_summary_') || key.startsWith('minimal_rec_')).length,
        places: Object.keys(localStorage).filter(key => 
          key.startsWith('place_summary_') || key.startsWith('minimal_place_')).length,
        feedbacks: Object.keys(localStorage).filter(key => 
          key.startsWith('feedback_')).length
      }
    };
  }
};

// 내보내기
export {
  // 메인 캐싱 함수들
  cacheRecommendations,
  getCachedRecommendations,
  cacheRegionRecommendations,
  getCachedRegionRecommendations,
  cachePlaceDetails,
  getCachedPlaceDetails,
  cacheFeedbacks,
  getCachedFeedbacks,
  
  // 캐시 관리 함수들
  clearCacheByType,
  clearAllCache,
  cleanExpiredCache,
  
  // 오프라인 모드 관련 함수들
  isOffline,
  checkOfflineCacheAvailability,
  searchOfflinePlaces,
  
  // 유틸리티 함수
  getCacheStatus
};

