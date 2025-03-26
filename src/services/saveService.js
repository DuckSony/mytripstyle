// src/services/saveService.js 
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where,
  addDoc, // addDoc이 여기에 정의되어 있어야 함
  GeoPoint,
  updateDoc
} from '../config/firebase';

import { 
  STORES,
  saveItem,
  deleteItem,
  getItemById,
  getItemsByIndex,
  clearStore
} from '../utils/indexedDBUtils';

// 디버깅 로그 함수
const logDebug = (message, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[saveService] ${message}`, data || '');
  }
};

// 오류 로그 함수
const logError = (message, error) => {
  console.error(`[saveService] ${message}:`, error);
  return error;
};

// 오프라인 상태 확인 유틸리티 함수 추가
const isOffline = () => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

// 오프라인 작업 큐에 항목 추가 유틸리티 함수 추가
const addToOfflineQueue = async (operation, data) => {
  try {
    // 기존 오프라인 작업 큐 가져오기
    const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
    
    // 새 작업 추가
    queue.push({
      operation,
      data,
      timestamp: Date.now(),
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    // 저장
    localStorage.setItem('saveOperationsQueue', JSON.stringify(queue));
    logDebug(`오프라인 작업 큐에 ${operation} 추가됨`);
    return true;
  } catch (error) {
    logError('오프라인 큐 저장 오류:', error);
    return false;
  }
};

// ID 정규화 함수 (복수 ID 필드 일관성 보장)
const normalizeIds = (data, id) => {
  if (!data || !id) return data;
  
  return {
    ...data,
    id,
    placeId: id // 항상 두 필드 모두 포함
  };
};

// IndexedDB에서 항목 삭제
const removeFromIndexedDB = async (storeName, id) => {
  try {
    logDebug(`IndexedDB에서 ${storeName} 항목 삭제 시작: ${id}`);
    return await deleteItem(storeName, id);
  } catch (error) {
    logError(`IndexedDB에서 항목 삭제 중 오류 (${storeName}/${id})`, error);
    return false;
  }
};

// Firebase 연결 상태 확인
const checkFirebaseConnection = async () => {
  try {
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      logDebug('기기가 오프라인 상태, false 반환');
      return false;
    }
    
    // 간단한 문서 읽기로 연결 확인
    const testRef = doc(db, '_connection_test', 'test');
    await getDoc(testRef);
    return true;
  } catch (error) {
    logDebug('Firebase 연결 확인 실패:', error);
    return false;
  }
};

// 위도/경도를 Firebase GeoPoint로 변환
const toGeoPoint = (location) => {
  if (!location) return null;
  
  // 이미 GeoPoint인 경우
  if (location instanceof GeoPoint) {
    return location;
  }
  
  // 객체 형태인 경우 ({latitude, longitude})
  if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
    return new GeoPoint(
      parseFloat(location.latitude),
      parseFloat(location.longitude)
    );
  }
  
  // 배열 형태인 경우 ([lat, lng])
  if (Array.isArray(location) && location.length >= 2) {
    return new GeoPoint(
      parseFloat(location[0]),
      parseFloat(location[1])
    );
  }
  
  return null;
};

// 거리 계산 함수 (Haversine 공식)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  
  const R = 6371e3; // 지구 반경 (미터)
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 미터 단위 거리
};

// 모든 캐시 레이어 업데이트 유틸리티 함수
const updateAllCaches = async (placeId, userId, isSaved, firestoreData = null) => {
  try {
    // 1. IndexedDB 업데이트
    if (isSaved) {
      // 저장된 경우 - 장소 정보 가져오기 
      let placeData;
      
      try {
        // 기존 IndexedDB에서 먼저 확인
        placeData = await getItemById(STORES.PLACES, placeId);
      } catch (dbError) {
        logDebug(`장소 ${placeId} 기존 데이터 가져오기 실패, 최소 데이터 사용`, dbError);
      }
      
      // 데이터가 없으면 최소한의 정보 생성
      if (!placeData) {
        placeData = {
          id: placeId,
          placeId: placeId,
          name: `장소 ${placeId.substring(0, 5)}`,
          userId,
          savedAt: firestoreData?.savedAt?.toDate() || new Date()
        };
      } else {
        // 기존 데이터에 저장 정보 추가
        placeData = {
          ...placeData,
          id: placeId,
          placeId: placeId,
          userId,
          savedAt: firestoreData?.savedAt?.toDate() || placeData.savedAt || new Date()
        };
      }
      
      // IndexedDB에 저장
      try {
        await saveItem(STORES.SAVED_PLACES, placeData);
        logDebug(`장소 ${placeId} IndexedDB에 저장됨`);
      } catch (saveError) {
        logDebug(`장소 ${placeId} IndexedDB 저장 실패`, saveError);
      }
    } else {
      // 저장되지 않은 경우 - IndexedDB에서 제거
      try {
        await removeFromIndexedDB(STORES.SAVED_PLACES, placeId);
        logDebug(`장소 ${placeId} IndexedDB에서 제거됨`);
      } catch (removeError) {
        logDebug(`장소 ${placeId} IndexedDB 제거 실패`, removeError);
      }
    }
    
    // 2. 로컬 스토리지 캐시 업데이트
    try {
      let cacheData = {};
      const existingCache = localStorage.getItem('savedPlacesCache');
      if (existingCache) {
        try {
          cacheData = JSON.parse(existingCache);
        } catch (parseError) {
          logDebug('캐시 파싱 실패, 새 객체 생성', parseError);
        }
      }
      
      if (isSaved) {
        // 저장 상태인 경우 캐시에 추가
        cacheData[placeId] = {
          timestamp: Date.now(),
          saved: true,
          userId
        };
      } else {
        // 저장 취소 상태인 경우 캐시에서 제거
        delete cacheData[placeId];
      }
      
      localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
      logDebug(`장소 ${placeId} 로컬 캐시 업데이트됨`);
    } catch (cacheError) {
      logDebug('로컬 캐시 업데이트 실패', cacheError);
    }
    
    // 3. 사용자별 캐시 업데이트
    try {
      const savedPlacesKey = `savedPlaces_${userId}`;
      let userCache = [];
      
      try {
        const existingUserCache = localStorage.getItem(savedPlacesKey);
        if (existingUserCache) {
          userCache = JSON.parse(existingUserCache);
          
          if (!Array.isArray(userCache)) {
            userCache = [];
          }
        }
      } catch (parseError) {
        logDebug('사용자 캐시 파싱 실패, 새 배열 생성', parseError);
      }
      
      if (isSaved) {
        // 저장 상태인 경우
        // 이미 있는지 확인
        const existingIndex = userCache.findIndex(place => 
          place && (place.id === placeId || place.placeId === placeId)
        );
        
        if (existingIndex >= 0) {
          // 이미 있으면 savedAt 업데이트
          userCache[existingIndex].savedAt = firestoreData?.savedAt?.toDate() || new Date();
        } else {
          // 없으면 새로 추가 (최소 정보)
          userCache.unshift({
            id: placeId,
            placeId: placeId,
            name: `장소 ${placeId.substring(0, 5)}`,
            userId,
            savedAt: firestoreData?.savedAt?.toDate() || new Date()
          });
        }
      } else {
        // 저장 취소 상태인 경우 해당 장소 제거
        userCache = userCache.filter(place => 
          place && place.id !== placeId && place.placeId !== placeId
        );
      }
      
      localStorage.setItem(savedPlacesKey, JSON.stringify(userCache));
      logDebug(`장소 ${placeId} 사용자 캐시 업데이트됨`);
    } catch (userCacheError) {
      logDebug('사용자 캐시 업데이트 실패', userCacheError);
    }
    
    return true;
  } catch (error) {
    logError('모든 캐시 업데이트 중 오류', error);
    return false;
  }
};

// 더미 장소 데이터 생성 함수
const generateDummyPlace = (placeId) => {
  return {
    id: placeId,
    placeId: placeId, // 항상 두 필드 모두 포함
    name: `장소 ${placeId.slice(0, 5)}`,
    description: '테스트 장소입니다.',
    location: { latitude: 37.5642135, longitude: 127.0016985 },
    region: '서울',
    subRegion: '강남/서초',
    category: 'cafe',
    subCategory: '북카페',
    photos: ['/api/placeholder/400/300'],
    thumbnail: '/api/placeholder/200/200',
    mbtiMatchScore: {
      'ENFJ': 8, 'INFJ': 7, 'ENFP': 9, 'INFP': 8,
      'ENTJ': 6, 'INTJ': 7, 'ENTP': 8, 'INTP': 7,
      'ESFJ': 7, 'ISFJ': 6, 'ESFP': 8, 'ISFP': 7,
      'ESTJ': 5, 'ISTJ': 6, 'ESTP': 7, 'ISTP': 6
    },
    interestTags: ['여행', '음식', '카페'],
    talentRelevance: ['사진촬영', '글쓰기'],
    moodMatchScore: {
      '기쁨': 8, '스트레스': 4, '피곤함': 6, '설렘': 9, '평온함': 7
    },
    specialFeatures: ['인스타스팟', '조용한', '데이트'],
    averageRating: 4.5,
    reviewCount: Math.floor(Math.random() * 20) + 5,
    priceLevel: 2,
    operatingHours: {
      monday: '09:00~22:00',
      tuesday: '09:00~22:00',
      wednesday: '09:00~22:00',
      thursday: '09:00~22:00',
      friday: '09:00~22:00',
      saturday: '10:00~22:00',
      sunday: '10:00~22:00'
    },
    contactInfo: {
      phone: '02-123-4567',
      website: 'https://example.com'
    }
  };
};

// 장소 상세 정보 가져오기 - 캐싱 및 오류 처리 개선
const getPlaceDetails = async (placeId) => {
  if (!placeId) {
    logDebug('getPlaceDetails: 유효하지 않은 장소 ID');
    return {
      success: false,
      error: '유효하지 않은 장소 ID입니다.'
    };
  }
  
  try {
    logDebug(`장소 상세 정보 가져오기: ${placeId}`);
    
    // 1. 먼저 IndexedDB에서 확인
    try {
      const cachedPlace = await getItemById(STORES.PLACES, placeId);
      if (cachedPlace) {
        logDebug(`장소 ${placeId} 상세 정보 IndexedDB에서 찾음`);
        
        // ID 일관성 확보
        const normalizedData = normalizeIds(cachedPlace, placeId);
        
        return {
          success: true,
          data: normalizedData,
          fromCache: true
        };
      }
    } catch (dbError) {
      logDebug('IndexedDB에서 장소 상세 정보 가져오기 실패', dbError);
    }
    
    // 2. 로컬 스토리지에서 확인
    try {
      const localCachedPlace = localStorage.getItem(`place_${placeId}`);
      if (localCachedPlace) {
        const placeData = JSON.parse(localCachedPlace);
        logDebug(`장소 ${placeId} 상세 정보 로컬 스토리지에서 찾음`);
        
        // ID 일관성 확보
        const normalizedData = normalizeIds(placeData, placeId);
        
        // IndexedDB에도 캐싱
        try {
          await saveItem(STORES.PLACES, normalizedData);
        } catch (cacheErr) {
          logDebug(`IndexedDB 캐싱 실패: ${placeId}`, cacheErr);
        }
        
        return {
          success: true,
          data: normalizedData,
          fromCache: true
        };
      }
    } catch (storageError) {
      logDebug('로컬 스토리지에서 장소 상세 정보 가져오기 실패', storageError);
    }
    
    // 3. Firebase에서 조회
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태 감지, 더미 데이터 반환');
      const dummyData = generateDummyPlace(placeId);
      
      // 캐싱
      try {
        await saveItem(STORES.PLACES, dummyData);
        localStorage.setItem(`place_${placeId}`, JSON.stringify(dummyData));
      } catch (cacheErr) {
        logDebug(`더미 데이터 캐싱 실패: ${placeId}`, cacheErr);
      }
      
      return {
        success: true,
        data: dummyData,
        isDummy: true,
        offline: true
      };
    }
    
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('데이터 요청 시간 초과')), 10000)
    );
    
    // Firebase에서 조회
    const placeRef = doc(db, 'places', placeId);
    
    let docSnap;
    try {
      docSnap = await Promise.race([getDoc(placeRef), timeoutPromise]);
    } catch (timeoutError) {
      logDebug('Firebase 요청 시간 초과, 더미 데이터 반환', timeoutError);
      const dummyData = generateDummyPlace(placeId);
      
      return {
        success: true,
        data: dummyData,
        isDummy: true,
        timedOut: true
      };
    }
    
    if (docSnap.exists()) {
      logDebug(`장소 ${placeId} Firebase에서 찾음`);
      
      // ID 일관성 보장
      const placeData = docSnap.data();
      const normalizedData = normalizeIds(placeData, placeId);
      
      // 캐싱
      try {
        await saveItem(STORES.PLACES, normalizedData);
        localStorage.setItem(`place_${placeId}`, JSON.stringify(normalizedData));
      } catch (cacheErr) {
        logDebug(`장소 ${placeId} 캐싱 실패`, cacheErr);
      }
      
      return {
        success: true,
        data: normalizedData
      };
    } else {
      // 장소가 존재하지 않으면 더미 데이터 반환 (개발 중 사용)
      logDebug(`장소 ${placeId} Firebase에서 찾지 못함, 더미 데이터 반환`);
      const dummyData = generateDummyPlace(placeId);
      
      // 더미 데이터도 캐싱
      try {
        await saveItem(STORES.PLACES, dummyData);
        localStorage.setItem(`place_${placeId}`, JSON.stringify(dummyData));
      } catch (cacheErr) {
        logDebug(`더미 데이터 캐싱 실패: ${placeId}`, cacheErr);
      }
      
      return {
        success: true,
        data: dummyData,
        isDummy: true
      };
    }
  } catch (error) {
    logError(`장소 ${placeId} 상세 정보 가져오기 오류`, error);
    
    // 오류 발생 시 IndexedDB에서 다시 시도
    try {
      const errorCachedPlace = await getItemById(STORES.PLACES, placeId);
      if (errorCachedPlace) {
        logDebug(`Firebase 오류 후 IndexedDB에서 장소 ${placeId} 발견`);
        
        // ID 일관성 확보
        const normalizedData = normalizeIds(errorCachedPlace, placeId);
        
        return {
          success: true,
          data: normalizedData,
          fromCache: true,
          afterError: true
        };
      }
    } catch (dbError) {
      logDebug('Firebase 오류 후 IndexedDB 접근 실패', dbError);
    }

    // 로컬 스토리지에서 시도
    try {
      const errorLocalCachedPlace = localStorage.getItem(`place_${placeId}`);
      if (errorLocalCachedPlace) {
        const placeData = JSON.parse(errorLocalCachedPlace);
        logDebug(`Firebase 오류 후 로컬 스토리지에서 장소 ${placeId} 발견`);
        
        return {
          success: true,
          data: normalizeIds(placeData, placeId),
          fromCache: true,
          afterError: true
        };
      }
    } catch (storageError) {
      logDebug('Firebase 오류 후 로컬 스토리지 접근 실패', storageError);
    }
    
    // 오류 발생 및 캐시에 없는 경우 더미 데이터 반환
    const dummyData = generateDummyPlace(placeId);
    return {
      success: false,
      error: error.message,
      data: dummyData, // 폴백 데이터 제공
      isDummy: true
    };
  }
};

// 장소 저장 - 데이터 무결성 및 오류 처리 개선
const savePlace = async (userId, placeId) => {
  if (!userId || !placeId) {
    return Promise.reject(new Error('유효하지 않은 사용자 ID 또는 장소 ID입니다.'));
  }
  
  try {
    logDebug(`장소 저장 시작: ${placeId} (사용자: ${userId})`);
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      logDebug('오프라인 상태 감지, 로컬에만 저장');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('save', { userId, placeId });
      
      // 로컬 캐시 업데이트 (낙관적 업데이트)
      await updateAllCaches(placeId, userId, true);
      
      return {
        success: true,
        message: '장소가 오프라인 상태에서 저장되었습니다. 네트워크 연결 시 자동으로 서버에 반영됩니다.',
        offline: true
      };
    }
    
    // 복합 ID 생성 (사용자와 장소를 조합) - 일관된 형식 사용
    const savedId = `${userId}_${placeId}`;
    const savedRef = doc(db, 'savedPlaces', savedId);
    
    // 이미 저장되어 있는지 확인
    const existingDoc = await getDoc(savedRef);
    if (existingDoc.exists()) {
      logDebug(`장소 ${placeId}는 이미 저장되어 있습니다.`);
      return {
        success: true,
        alreadySaved: true,
        message: '이미 저장된 장소입니다.'
      };
    }
    
    // 저장 정보 기록
    await setDoc(savedRef, {
      userId,
      placeId,
      savedAt: serverTimestamp()
    });
    
    // IndexedDB에도 저장 (캐싱)
    try {
      // 먼저 장소 정보 가져오기
      let placeData = await getItemById(STORES.PLACES, placeId);
      
      // 장소 정보가 없으면 최소한의 정보라도 저장
      if (!placeData) {
        placeData = {
          id: placeId,
          placeId: placeId,
          name: `장소 ${placeId.substring(0, 5)}`,
          savedAt: new Date(),
          userId
        };
      } else {
        // 기존 정보에 저장 정보 추가
        placeData = {
          ...placeData,
          id: placeId,
          placeId: placeId,
          savedAt: new Date(),
          userId
        };
      }
      
      await saveItem(STORES.SAVED_PLACES, placeData);
      logDebug(`장소 ${placeId} IndexedDB에 저장됨`);
      
      // 로컬 스토리지 캐시 업데이트
      try {
        let cacheData = {};
        const existingCache = localStorage.getItem('savedPlacesCache');
        if (existingCache) {
          cacheData = JSON.parse(existingCache);
        }
        
        cacheData[placeId] = {
          timestamp: Date.now(),
          saved: true,
          userId
        };
        
        localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
      } catch (cacheError) {
        logDebug('캐시 업데이트 오류', cacheError);
      }
    } catch (dbError) {
      logError(`장소 ${placeId} IndexedDB 저장 실패`, dbError);
      // 계속 진행 (IndexedDB 저장 실패는 치명적이지 않음)
    }
    
    logDebug(`장소 ${placeId} 저장 완료`);
    return {
      success: true,
      id: savedId,
      placeId,
      message: '장소가 저장되었습니다.'
    };
  } catch (error) {
    const errorMsg = `장소 ${placeId} 저장 중 오류`;
    logError(errorMsg, error);
    
    // 네트워크 오류 확인 및 로컬 처리 추가
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류 감지, 로컬에만 저장');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('save', { userId, placeId });
      
      // 로컬 캐시 업데이트 (낙관적 업데이트)
      await updateAllCaches(placeId, userId, true);
      
      return {
        success: true,
        message: '네트워크 오류로 인해 장소가 로컬에 저장되었습니다. 네트워크 연결 시 자동으로 서버에 반영됩니다.',
        offline: true
      };
    }
    
    return Promise.reject(new Error(errorMsg));
  }
};

// 장소 저장 취소 - 안정성 및 캐시 관리 개선
const unsavePlace = async (userId, placeId) => {
  if (!userId || !placeId) {
    return Promise.reject(new Error('유효하지 않은 사용자 ID 또는 장소 ID입니다.'));
  }
  
  try {
    logDebug(`장소 저장 취소 시작: ${placeId} (사용자: ${userId})`);
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      logDebug('오프라인 상태 감지, 로컬에서만 제거');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('unsave', { userId, placeId });
      
      // 로컬 캐시 업데이트 (낙관적 업데이트)
      await updateAllCaches(placeId, userId, false);
      
      return {
        success: true,
        message: '장소가 오프라인 상태에서 저장 취소되었습니다. 네트워크 연결 시 자동으로 서버에 반영됩니다.',
        offline: true
      };
    }
    
    // 복합 ID 사용
    const savedId = `${userId}_${placeId}`;
    const savedRef = doc(db, 'savedPlaces', savedId);
    
    // 저장 상태 확인
    const docSnap = await getDoc(savedRef);
    
    if (!docSnap.exists()) {
      // 복합 ID로 찾지 못했을 경우 쿼리로 시도
      logDebug(`복합 ID ${savedId}로 찾지 못함, 쿼리로 시도`);
      
      const savedPlacesRef = collection(db, 'savedPlaces');
      const q = query(
        savedPlacesRef,
        where('userId', '==', userId),
        where('placeId', '==', placeId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        logDebug(`장소 ${placeId}는 이미 저장되어 있지 않습니다.`);
        
        // IndexedDB에서도 제거 (일관성 유지)
        await removeFromIndexedDB(STORES.SAVED_PLACES, placeId);
        
        // 로컬 스토리지 캐시 업데이트
        try {
          let cacheData = {};
          const existingCache = localStorage.getItem('savedPlacesCache');
          if (existingCache) {
            cacheData = JSON.parse(existingCache);
            delete cacheData[placeId];
            localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
          }
        } catch (cacheError) {
          logDebug('캐시 업데이트 오류', cacheError);
        }
        
        return {
          success: true,
          notSaved: true,
          message: '저장되지 않은 장소입니다.'
        };
      }
      
      // 첫 번째 일치하는 문서 삭제
      const firstDoc = querySnapshot.docs[0];
      await deleteDoc(doc(db, 'savedPlaces', firstDoc.id));
      logDebug(`장소 ${placeId} 삭제됨 (문서 ID: ${firstDoc.id})`);
    } else {
      // 복합 ID로 찾은 경우 해당 문서 삭제
      await deleteDoc(savedRef);
      logDebug(`장소 ${placeId} 삭제됨 (복합 ID: ${savedId})`);
    }
    
    // IndexedDB에서도 삭제
    await removeFromIndexedDB(STORES.SAVED_PLACES, placeId);
    
    // 로컬 스토리지 캐시 업데이트
    try {
      let cacheData = {};
      const existingCache = localStorage.getItem('savedPlacesCache');
      if (existingCache) {
        cacheData = JSON.parse(existingCache);
        delete cacheData[placeId];
        localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
      }
    } catch (cacheError) {
      logDebug('캐시 업데이트 오류', cacheError);
    }
    
    logDebug(`장소 ${placeId} 저장 취소 완료`);
    return {
      success: true,
      message: '장소가 저장 목록에서 제거되었습니다.'
    };
  } catch (error) {
    const errorMsg = `장소 ${placeId} 저장 취소 중 오류`;
    logError(errorMsg, error);
    
    // 네트워크 오류 확인 및 로컬 처리 추가
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류 감지, 로컬에서만 제거');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('unsave', { userId, placeId });
      
      // 로컬 캐시 업데이트 (낙관적 업데이트)
      await updateAllCaches(placeId, userId, false);
      
      return {
        success: true,
        message: '네트워크 오류로 인해 장소가 로컬에서만 제거되었습니다. 네트워크 연결 시 자동으로 서버에 반영됩니다.',
        offline: true
      };
    }
    
    return Promise.reject(new Error(errorMsg));
  }
};

// 장소가 저장되었는지 확인 - 성능 및 신뢰성 개선
const checkIfPlaceSaved = async (userId, placeId) => {
  if (!userId || !placeId) {
    logDebug('checkIfPlaceSaved: 유효하지 않은 사용자 ID 또는 장소 ID');
    return false;
  }
  
  try {
    logDebug(`장소 저장 여부 확인: ${placeId} (사용자: ${userId})`);
    
    // 1. 빠른 응답을 위해 로컬 캐시 먼저 확인
    try {
      const savedPlacesCache = localStorage.getItem('savedPlacesCache');
      if (savedPlacesCache) {
        const cacheData = JSON.parse(savedPlacesCache);
        if (cacheData[placeId] && cacheData[placeId].userId === userId) {
          logDebug(`장소 ${placeId} 캐시에서 저장됨 확인`);
          return true;
        }
      }
    } catch (cacheError) {
      logDebug('로컬 스토리지 캐시 접근 오류, 계속 진행', cacheError);
    }
    
    // 2. 사용자별 전용 캐시 확인
    try {
      const savedPlacesData = localStorage.getItem(`savedPlaces_${userId}`);
      if (savedPlacesData) {
        const parsedData = JSON.parse(savedPlacesData);
        if (Array.isArray(parsedData)) {
          // 장소 ID로 검색
          const found = parsedData.some(place => 
            place && (place.id === placeId || place.placeId === placeId)
          );
          
          if (found) {
            logDebug(`장소 ${placeId} 사용자 전용 캐시에서 저장됨 확인`);
            
            // 로컬 캐시 업데이트 (백그라운드)
            try {
              let cacheData = {};
              const existingCache = localStorage.getItem('savedPlacesCache');
              if (existingCache) {
                cacheData = JSON.parse(existingCache);
              }
              
              cacheData[placeId] = {
                timestamp: Date.now(),
                saved: true,
                userId
              };
              
              localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
            } catch (updateError) {
              // 실패해도 무시 (UI에 영향 없음)
            }
            
            return true;
          }
        }
      }
    } catch (localError) {
      logDebug('사용자 전용 캐시 접근 오류, 계속 진행', localError);
    }
    
    // 3. IndexedDB에서 확인
    try {
      const cachedPlace = await getItemById(STORES.SAVED_PLACES, placeId);
      if (cachedPlace && cachedPlace.userId === userId) {
        logDebug(`장소 ${placeId} IndexedDB에서 저장됨 확인`);
        
        // 로컬 캐시 업데이트 (백그라운드)
        try {
          let cacheData = {};
          const existingCache = localStorage.getItem('savedPlacesCache');
          if (existingCache) {
            cacheData = JSON.parse(existingCache);
          }
          
          cacheData[placeId] = {
            timestamp: Date.now(),
            saved: true,
            userId
          };
          
          localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
        } catch (updateError) {
          // 실패해도 무시
        }
        
        return true;
      }
    } catch (dbError) {
      logDebug('IndexedDB 확인 실패, 계속 진행', dbError);
    }
    
    // 오프라인 작업 큐 확인 (최신 작업 반영)
    try {
      const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
      
      // 해당 장소에 대한 가장 최근 작업 찾기
      const relevantOps = queue.filter(op => 
        op.data.placeId === placeId && op.data.userId === userId
      ).sort((a, b) => b.timestamp - a.timestamp);
      
      if (relevantOps.length > 0) {
        // 가장 최근 작업 가져오기
        const latestOp = relevantOps[0];
        
        // 최신 작업이 저장이면 true, 취소면 false
        if (latestOp.operation === 'save') {
          logDebug(`장소 ${placeId} 오프라인 큐에서 저장됨 확인`);
          return true;
        } else if (latestOp.operation === 'unsave') {
          logDebug(`장소 ${placeId} 오프라인 큐에서 저장취소됨 확인`);
          return false;
        }
      }
    } catch (queueError) {
      logDebug('오프라인 큐 확인 실패, 계속 진행', queueError);
    }
    
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태, 캐시에 없으면 저장되지 않은 것으로 판단');
      return false;
    }
    
    // 4. Firebase에서 확인 (온라인 상태일 때만)
    // 복합 ID 형식으로 먼저 확인 (효율적)
    const savedId = `${userId}_${placeId}`;
    const savedRef = doc(db, 'savedPlaces', savedId);
    
    // 타임아웃 설정 (3초)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('문서 요청 시간 초과')), 3000)
    );
    
    let docSnap;
    try {
      docSnap = await Promise.race([getDoc(savedRef), timeoutPromise]);
      
      if (docSnap.exists()) {
        logDebug(`장소 ${placeId} Firebase에서 저장됨 확인 (복합 ID)`);
        
        // 캐시 업데이트 (백그라운드)
        updateAllCaches(placeId, userId, true, docSnap.data()).catch(err => 
          logDebug('백그라운드 캐시 업데이트 실패', err)
        );
        
        return true;
      }
    } catch (timeoutError) {
      logDebug('Firebase 문서 요청 시간 초과, 다른 방법 시도', timeoutError);
      // 시간 초과 시 쿼리로 시도
    }

    // 5. 복합 ID로 찾지 못했을 경우 쿼리로 시도
    try {
      const savedPlacesRef = collection(db, 'savedPlaces');
      const q = query(
        savedPlacesRef,
        where('userId', '==', userId),
        where('placeId', '==', placeId)
      );
      
      // 쿼리 타임아웃 설정 (4초)
      const queryTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('쿼리 요청 시간 초과')), 4000)
      );
      
      let querySnapshot;
      try {
        querySnapshot = await Promise.race([getDocs(q), queryTimeoutPromise]);
        const isSaved = !querySnapshot.empty;
        
        logDebug(`장소 ${placeId} Firebase 저장 상태 (쿼리): ${isSaved}`);
        
        // 저장되어 있다면 로컬 캐시 업데이트 (백그라운드)
        if (isSaved) {
          const firstDoc = querySnapshot.docs[0];
          
          updateAllCaches(placeId, userId, true, firstDoc?.data()).catch(err => 
            logDebug('백그라운드 캐시 업데이트 실패', err)
          );
        }
        
        return isSaved;
      } catch (queryTimeoutError) {
        logDebug('Firebase 쿼리 요청 시간 초과, 최종적으로 false 반환', queryTimeoutError);
        return false;
      }
    } catch (queryError) {
      logDebug('Firebase 쿼리 오류', queryError);
      return false;
    }
  } catch (error) {
    logError('장소 저장 여부 확인 중 오류', error);
    return false;
  }
};

// 장소 저장/저장 취소 토글 함수 - 통합 인터페이스
const toggleSave = async (userId, placeIdOrObj) => {
  if (!userId) {
    return Promise.reject(new Error('유효하지 않은 사용자 ID입니다.'));
  }
  
  // ID 및 장소 객체 추출
  let placeId, placeObj;
  
  if (typeof placeIdOrObj === 'string') {
    placeId = placeIdOrObj;
    placeObj = null;
  } else if (typeof placeIdOrObj === 'object' && placeIdOrObj !== null) {
    placeObj = placeIdOrObj;
    placeId = placeObj.id || placeObj.placeId;
  } else {
    return Promise.reject(new Error('유효하지 않은 장소 ID 또는 객체입니다.'));
  }
  
  if (!placeId) {
    return Promise.reject(new Error('유효한 장소 ID가 없습니다.'));
  }
  
  try {
    logDebug(`장소 저장 토글 시작: ${placeId} (사용자: ${userId})`);
    
    // 현재 저장 상태 확인
    const isCurrentlySaved = await checkIfPlaceSaved(userId, placeId);
    logDebug(`현재 저장 상태: ${isCurrentlySaved}`);
    
    // 저장 토글 (저장 → 취소 또는 취소 → 저장)
    let result;
    
    if (isCurrentlySaved) {
      // 저장 취소 (삭제)
      result = await unsavePlace(userId, placeId);
    } else {
      // 저장
      if (placeObj) {
        // 장소 객체가 있으면 저장 시도
        // IndexedDB에 미리 저장 (낙관적 업데이트)
        try {
          const normalizedPlace = {
            ...placeObj,
            id: placeId,
            placeId: placeId,
            userId,
            savedAt: new Date()
          };
          
          await saveItem(STORES.SAVED_PLACES, normalizedPlace);
        } catch (cacheError) {
          logDebug('장소 객체 선제 캐싱 실패', cacheError);
        }
      }
      
      // Firebase에 저장
      result = await savePlace(userId, placeId);
    }
    
    // 토글 이후 모든 캐시 동기화
    await updateAllCaches(placeId, userId, !isCurrentlySaved);
    
    logDebug(`장소 ${placeId} 토글 완료: ${!isCurrentlySaved ? '저장됨' : '저장 취소됨'}`);
    
    return {
      success: true,
      saved: !isCurrentlySaved,
      message: !isCurrentlySaved ? '장소가 저장되었습니다.' : '장소가 저장 목록에서 제거되었습니다.',
      placeId,
      result
    };
  } catch (error) {
    logError(`장소 ${placeId} 토글 중 오류`, error);
    
    // 네트워크 오류 확인 및 처리 추가
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류 감지, 오프라인에서 토글 처리');
      
      // 현재 저장 상태 로컬에서 다시 확인
      const isCurrentlySaved = await checkIfPlaceSaved(userId, placeId);
      
      if (isCurrentlySaved) {
        // 오프라인 작업 큐에 추가 (unsave)
        await addToOfflineQueue('unsave', { userId, placeId });
        
        // 로컬 캐시 업데이트
        await updateAllCaches(placeId, userId, false);
        
        return {
          success: true,
          saved: false,
          message: '장소가 오프라인 상태에서 저장 취소되었습니다. 네트워크 연결 시 자동으로 반영됩니다.',
          offline: true
        };
      } else {
        // 오프라인 작업 큐에 추가 (save)
        await addToOfflineQueue('save', { userId, placeId });
        
        // 장소 객체 저장 처리
        if (placeObj) {
          try {
            const normalizedPlace = {
              ...placeObj,
              id: placeId,
              placeId: placeId,
              userId,
              savedAt: new Date()
            };
            
            await saveItem(STORES.SAVED_PLACES, normalizedPlace);
          } catch (cacheError) {
            logDebug('장소 객체 선제 캐싱 실패', cacheError);
          }
        }
        
        // 로컬 캐시 업데이트
        await updateAllCaches(placeId, userId, true);
        
        return {
          success: true,
          saved: true,
          message: '장소가 오프라인 상태에서 저장되었습니다. 네트워크 연결 시 자동으로 반영됩니다.',
          offline: true
        };
      }
    }
    
    return Promise.reject(error);
  }
};

// 저장된 장소 목록 가져오기 - 캐싱 및 폴백 처리 개선
const getSavedPlaces = async (userId) => {
  try {
    if (!userId) {
      logDebug('getSavedPlaces: 유효하지 않은 사용자 ID');
      return [];
    }
    
    logDebug(`저장된 장소 목록 가져오기: 사용자 ${userId}`);
    
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태 감지, IndexedDB에서 저장된 장소 로드');
      try {
        const cachedPlaces = await getItemsByIndex(STORES.SAVED_PLACES, 'userId', userId);
        if (cachedPlaces && cachedPlaces.length > 0) {
          logDebug(`IndexedDB에서 ${cachedPlaces.length}개 저장된 장소 로드됨`);
          
          // ID 일관성 확보 및 저장 시간 기준 정렬
          const normalizedPlaces = cachedPlaces
            .map(place => normalizeIds(place, place.id || place.placeId))
            .sort((a, b) => {
              const dateA = a.savedAt instanceof Date ? a.savedAt : new Date(a.savedAt || 0);
              const dateB = b.savedAt instanceof Date ? b.savedAt : new Date(b.savedAt || 0);
              return dateB - dateA;
            });
          
          // 오프라인 작업 큐 반영 (최신 변경사항 적용)
          try {
            const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
            
            // 저장 작업 -> 목록에 추가
            const saveOps = queue
              .filter(op => op.operation === 'save' && op.data.userId === userId)
              .sort((a, b) => b.timestamp - a.timestamp);
            
            // 저장 취소 작업 -> 목록에서 제거할 ID
            const unsaveIds = queue
              .filter(op => op.operation === 'unsave' && op.data.userId === userId)
              .map(op => op.data.placeId);
            
            // 저장 취소된 장소 제거
            let processedPlaces = normalizedPlaces.filter(place => 
              !unsaveIds.includes(place.id) && !unsaveIds.includes(place.placeId)
            );
            
            // 새로 저장된 장소 추가 (중복 제거)
            for (const op of saveOps) {
              const placeId = op.data.placeId;
              
              // 이미 목록에 있는지 확인
              const exists = processedPlaces.some(place => 
                place.id === placeId || place.placeId === placeId
              );
              
              if (!exists) {
                // 기존 IndexedDB에서 장소 정보 가져오기 시도
                let placeData = null;
                try {
                  placeData = await getItemById(STORES.PLACES, placeId);
                } catch (dbErr) {
                  // 무시
                }
                
                if (!placeData) {
                  // 최소 데이터로 생성
                  placeData = {
                    id: placeId,
                    placeId: placeId,
                    name: `장소 ${placeId.substring(0, 5)}`,
                    userId,
                    savedAt: new Date(op.timestamp),
                    offlineSaved: true
                  };
                }
                
                // 목록 앞에 추가
                processedPlaces.unshift(placeData);
              }
            }
            
            // 결과 반환
            return processedPlaces;
          } catch (queueError) {
            logDebug('오프라인 큐 처리 오류, 기본 캐시 사용', queueError);
            return normalizedPlaces;
          }
        }
      } catch (dbError) {
        logDebug('IndexedDB에서 저장된 장소 로드 실패', dbError);
      }
      
      // IndexedDB에서 로드 실패하면 로컬 스토리지 시도
      try {
        // 개선: 전용 캐시키 사용
        const savedPlacesData = localStorage.getItem(`savedPlaces_${userId}`);
        if (savedPlacesData) {
          const parsedData = JSON.parse(savedPlacesData);
          logDebug(`로컬 스토리지에서 ${parsedData.length}개 저장된 장소 로드됨`);
          
          // 오프라인 작업 큐 반영 (최신 변경사항 적용)
          try {
            const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
            
            // 저장 취소 작업 -> 목록에서 제거할 ID
            const unsaveIds = queue
              .filter(op => op.operation === 'unsave' && op.data.userId === userId)
              .map(op => op.data.placeId);
            
            // 저장 작업 -> 목록에 추가할 ID
            const saveOps = queue
              .filter(op => op.operation === 'save' && op.data.userId === userId)
              .sort((a, b) => b.timestamp - a.timestamp);
            
            // 저장 취소된 장소 제거
            let processedPlaces = parsedData.filter(place => 
              !unsaveIds.includes(place.id) && !unsaveIds.includes(place.placeId)
            );
            
            // 새로 저장된 장소 추가
            for (const op of saveOps) {
              const placeId = op.data.placeId;
              
              // 이미 목록에 있는지 확인
              const exists = processedPlaces.some(place => 
                place.id === placeId || place.placeId === placeId
              );
              
              if (!exists) {
                // 최소 데이터로 생성
                const placeData = {
                  id: placeId,
                  placeId: placeId,
                  name: `장소 ${placeId.substring(0, 5)}`,
                  userId,
                  savedAt: new Date(op.timestamp).toISOString(),
                  offlineSaved: true
                };
                
                // 목록 앞에 추가
                processedPlaces.unshift(placeData);
              }
            }
            
            return processedPlaces;
          } catch (queueError) {
            logDebug('오프라인 큐 처리 오류, 기본 캐시 사용', queueError);
            return parsedData;
          }
        }
        
        // 기존 키도 확인
        const legacyData = localStorage.getItem('myTripStyle_savedPlaces');
        if (legacyData) {
          const parsedLegacyData = JSON.parse(legacyData);
          const userPlaces = Array.isArray(parsedLegacyData) ? 
            parsedLegacyData.filter(place => place && place.userId === userId) : [];
          
          logDebug(`기존 캐시에서 ${userPlaces.length}개 저장 장소 찾음`);
          return userPlaces;
        }
      } catch (localError) {
        logDebug('로컬 스토리지 접근 오류', localError);
      }
      
      return []; // 오프라인이고 로컬 데이터도 없으면 빈 배열 반환
    }
    
    // Firebase에서 조회 - 타임아웃 처리 추가
    const savedRef = collection(db, 'savedPlaces');
    const q = query(
      savedRef, 
      where('userId', '==', userId)
    );
    
    // 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('데이터 요청 시간 초과')), 10000)
    );
    
    let querySnapshot;
    try {
      querySnapshot = await Promise.race([getDocs(q), timeoutPromise]);
    } catch (timeoutError) {
      logDebug('Firebase 요청 시간 초과, 캐시된 데이터 사용', timeoutError);
      // 시간 초과 시 IndexedDB에서 시도
      try {
        const cachedPlaces = await getItemsByIndex(STORES.SAVED_PLACES, 'userId', userId);
        if (cachedPlaces && cachedPlaces.length > 0) {
          return cachedPlaces.map(place => normalizeIds(place, place.id || place.placeId));
        }
      } catch (dbError) {
        logDebug('IndexedDB 폴백 실패', dbError);
      }
      
      // 로컬 스토리지에서 시도
      try {
        const savedPlacesData = localStorage.getItem(`savedPlaces_${userId}`);
        if (savedPlacesData) {
          return JSON.parse(savedPlacesData);
        }
      } catch (localError) {
        logDebug('로컬 스토리지 폴백 실패', localError);
      }
      
      return [];
    }
    
    if (querySnapshot.empty) {
      logDebug(`사용자 ${userId}의 저장된 장소 없음`);
      return [];
    }
    
    logDebug(`Firebase에서 ${querySnapshot.size}개 저장된 장소 레코드 발견`);
    
    // 저장된 장소 ID 및 저장 정보 추출
    const savedPlaceIds = [];
    const savedPlacesInfo = {};
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data && data.placeId) {
        const placeId = data.placeId;
        savedPlaceIds.push(placeId);
        
        // 저장 정보 기록 (타임스탬프 처리)
        savedPlacesInfo[placeId] = {
          savedAt: data.savedAt?.toDate() || new Date(),
          userId: data.userId,
          docId: doc.id
        };
      }
    });
    
    if (savedPlaceIds.length === 0) {
      logDebug('유효한 장소 ID가 없음');
      return [];
    }
    
    logDebug(`${savedPlaceIds.length}개 저장된 장소 ID 발견`);
    
    // 모든 장소 정보를 병렬로 가져오기
    const savedPlaces = [];
    const placesPromises = savedPlaceIds.map(async placeId => {
      try {
        const placeResult = await getPlaceDetails(placeId);
        
        if (placeResult.success) {
          console.log("Found place data:", placeResult.data);
          const placeData = placeResult.data;
          const savedInfo = savedPlacesInfo[placeId] || {};
          
          // 장소 정보와 저장 정보 병합
          const combinedData = {
            ...placeData,
            id: placeId, // 항상 id 필드 보장
            placeId: placeId, // 항상 placeId 필드 보장
            userId, // 사용자 ID 추가
            savedAt: savedInfo.savedAt || new Date(),
            savedDocId: savedInfo.docId // Firebase 문서 ID 추가
          };
          
          savedPlaces.push(combinedData);
          
          // IndexedDB에 저장 (캐싱)
          try {
            await saveItem(STORES.SAVED_PLACES, combinedData);
          } catch (cacheErr) {
            logDebug(`장소 ${placeId} IndexedDB 캐싱 실패`, cacheErr);
          }
        } else if (placeResult.data) {
          // 성공하지 않았지만 데이터가 있는 경우 (더미 데이터 등)
          const savedInfo = savedPlacesInfo[placeId] || {};
          const combinedData = {
            ...placeResult.data,
            id: placeId,
            placeId: placeId,
            userId,
            savedAt: savedInfo.savedAt || new Date(),
            savedDocId: savedInfo.docId
          };
          
          savedPlaces.push(combinedData);
          
          // 불완전한 데이터라도 캐싱
          try {
            await saveItem(STORES.SAVED_PLACES, combinedData);
          } catch (cacheErr) {
            logDebug(`장소 ${placeId} IndexedDB 캐싱 실패`, cacheErr);
          }
        } else {
          logDebug(`장소 ${placeId} 상세 정보 가져오기 실패`);
        }
      } catch (placeError) {
        logError(`장소 ${placeId} 상세 정보 처리 오류`, placeError);
      }
    });

    // 모든 장소 정보 가져오기 완료 대기 (최대 15초 설정)
    try {
      await Promise.race([
        Promise.all(placesPromises),
        new Promise(resolve => setTimeout(resolve, 15000))
      ]);
    } catch (promiseError) {
      logDebug('장소 정보 가져오기 중 오류 발생', promiseError);
      // 오류가 발생해도 계속 진행
    }
    
    // 저장 날짜순으로 정렬 (최신순)
    savedPlaces.sort((a, b) => {
      const dateA = a.savedAt instanceof Date ? a.savedAt : new Date(a.savedAt || 0);
      const dateB = b.savedAt instanceof Date ? b.savedAt : new Date(b.savedAt || 0);
      return dateB - dateA;
    });
    
    logDebug(`${savedPlaces.length}개 저장된 장소 처리 완료`);
    
    // 로컬 캐시 업데이트
    try {
      // 전용 캐시키에 저장
      localStorage.setItem(`savedPlaces_${userId}`, JSON.stringify(savedPlaces));
      
      // 로컬 스토리지 캐시 업데이트
      let cacheData = {};
      const existingCache = localStorage.getItem('savedPlacesCache');
      if (existingCache) {
        try {
          cacheData = JSON.parse(existingCache);
        } catch (parseError) {
          cacheData = {};
        }
      }
      
      // 저장된 장소 정보를 캐시에 추가
      savedPlaces.forEach(place => {
        if (place && place.id) {
          cacheData[place.id] = {
            timestamp: Date.now(),
            saved: true,
            userId
          };
        }
      });
      
      localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
    } catch (cacheError) {
      logDebug('캐시 업데이트 실패', cacheError);
    }
    
    return savedPlaces;
  } catch (error) {
    logError('저장된 장소 가져오기 오류', error);
    
    // 오류 발생 시 IndexedDB에서 데이터 로드 시도
    try {
      logDebug('Firebase 오류 후 IndexedDB에서 데이터 로드 시도');
      const cachedPlaces = await getItemsByIndex(STORES.SAVED_PLACES, 'userId', userId);
      if (cachedPlaces && cachedPlaces.length > 0) {
        logDebug(`IndexedDB에서 ${cachedPlaces.length}개 저장된 장소 로드됨 (오류 후 폴백)`);
        
        // ID 일관성 확보 및 저장 시간 기준 정렬
        const normalizedPlaces = cachedPlaces
          .map(place => normalizeIds(place, place.id || place.placeId))
          .sort((a, b) => {
            const dateA = a.savedAt instanceof Date ? a.savedAt : new Date(a.savedAt || 0);
            const dateB = b.savedAt instanceof Date ? b.savedAt : new Date(b.savedAt || 0);
            return dateB - dateA;
          });
        
        return normalizedPlaces;
      }
    } catch (dbError) {
      logDebug('IndexedDB 폴백 로드 실패', dbError);
    }
    
    // IndexedDB에서도 실패하면 로컬 스토리지 시도
    try {
      // 전용 캐시키 확인
      const savedPlacesData = localStorage.getItem(`savedPlaces_${userId}`);
      if (savedPlacesData) {
        const parsedData = JSON.parse(savedPlacesData);
        logDebug(`로컬 스토리지에서 ${parsedData.length}개 저장된 장소 로드됨 (오류 후 폴백)`);
        return parsedData;
      }
      
      // 기존 키도 확인
      const legacyData = localStorage.getItem('myTripStyle_savedPlaces');
      if (legacyData) {
        const parsedLegacyData = JSON.parse(legacyData);
        const userPlaces = parsedLegacyData.filter(place => place && place.userId === userId);
        
        logDebug(`기존 키에서 ${userPlaces.length}개 저장된 장소 로드됨 (오류 후 폴백)`);
        return userPlaces;
      }
    } catch (localError) {
      logDebug('로컬 스토리지 폴백 로드 실패', localError);
    }
    
    return [];
  }
};

// 카테고리별 저장된 장소 가져오기 - 성능 및 필터링 개선
const getSavedPlacesByCategory = async (userId, category) => {
  if (!userId) {
    logDebug('getSavedPlacesByCategory: 유효하지 않은 사용자 ID');
    return [];
  }
  
  try {
    logDebug(`카테고리별 저장된 장소 가져오기: 사용자 ${userId}, 카테고리 ${category}`);
    
    // 먼저 모든 저장된 장소 가져오기
    const savedPlaces = await getSavedPlaces(userId);
    
    // 카테고리로 필터링
    if (category === 'all') {
      return savedPlaces;
    }
    
    const filteredPlaces = savedPlaces.filter(place => {
      if (!place) return false;
      
      // 대소문자를 구분하지 않고 카테고리 비교
      const placeCategory = (place.category || '').toLowerCase();
      const targetCategory = category.toLowerCase();
      
      return placeCategory === targetCategory ||
             // 서브카테고리도 확인
             (place.subCategory && place.subCategory.toLowerCase() === targetCategory);
    });
    
    logDebug(`카테고리 ${category}에서 ${filteredPlaces.length}개 장소 필터링됨 (총 ${savedPlaces.length}개 중)`);
    
    return filteredPlaces;
  } catch (error) {
    logError(`카테고리 ${category}별 저장된 장소 가져오기 오류`, error);
    return [];
  }
};

// 저장된 장소 필터링 - 다양한 필터링 옵션 추가
const filterSavedPlaces = (places, filterOptions = {}) => {
  if (!places || !places.length) return [];
  if (!filterOptions || Object.keys(filterOptions).length === 0) return places;
  
  logDebug('저장된 장소 필터링 시작', { count: places.length, filterOptions });
  
  let filtered = [...places].filter(place => place != null); // null/undefined 항목 제거
  
  // 카테고리 필터링
  if (filterOptions.category && filterOptions.category !== 'all') {
    filtered = filtered.filter(place => {
      if (!place) return false;
      
      const placeCategory = (place.category || '').toLowerCase();
      const targetCategory = filterOptions.category.toLowerCase();
      
      return placeCategory === targetCategory ||
             (place.subCategory && place.subCategory.toLowerCase() === targetCategory);
    });
  }
  
  // 검색어 필터링
  if (filterOptions.searchTerm) {
    const searchTerm = filterOptions.searchTerm.toLowerCase();
    
    filtered = filtered.filter(place => {
      if (!place) return false;
      
      return (place.name && place.name.toLowerCase().includes(searchTerm)) || 
             (place.description && place.description.toLowerCase().includes(searchTerm)) ||
             (place.region && place.region.toLowerCase().includes(searchTerm)) ||
             (place.subRegion && place.subRegion.toLowerCase().includes(searchTerm));
    });
  }
  
  // 지역 필터링
  if (filterOptions.region) {
    filtered = filtered.filter(place => {
      if (!place) return false;
      
      const placeRegion = (place.region || '').toLowerCase();
      const targetRegion = filterOptions.region.toLowerCase();
      
      return placeRegion === targetRegion;
    });
  }
  
  logDebug(`필터링 후 ${filtered.length}개 장소 남음`);
  return filtered;
};

// 저장된 장소 정렬 - 다양한 정렬 옵션 추가
const sortSavedPlaces = (places, sortBy = 'date', sortDirection = 'desc') => {
  if (!places || !places.length) return [];
  
  logDebug(`저장된 장소 정렬 시작: ${sortBy} 기준, ${sortDirection} 방향`, { count: places.length });
  
  const sorted = [...places].filter(place => place != null); // null/undefined 항목 제거
  
  // 오름차순/내림차순 결정
  const direction = sortDirection === 'asc' ? 1 : -1;
  
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => {
        if (!a.name) return direction;
        if (!b.name) return -direction;
        return direction * a.name.localeCompare(b.name);
      });
      break;
      
    case 'rating':
      sorted.sort((a, b) => {
        const ratingA = a.averageRating || 0;
        const ratingB = b.averageRating || 0;
        return direction * (ratingB - ratingA);
      });
      break;
      
    case 'distance':
      sorted.sort((a, b) => {
        const distanceA = a.distance || Infinity;
        const distanceB = b.distance || Infinity;
        return direction * (distanceA - distanceB);
      });
      break;
      
    case 'date':
    default:
      sorted.sort((a, b) => {
        const dateA = a.savedAt instanceof Date ? a.savedAt : new Date(a.savedAt || 0);
        const dateB = b.savedAt instanceof Date ? b.savedAt : new Date(b.savedAt || 0);
        return direction * (dateB - dateA);
      });
      break;
  }
      
  logDebug(`정렬 완료`);
  return sorted;
};

// 위치 기반 필터링을 위한 거리 계산 및 정보 추가
const addDistanceToPlaces = (places, currentLocation) => {
  if (!places || !Array.isArray(places) || !currentLocation) {
    return places;
  }
  
  try {
    logDebug('장소에 거리 정보 추가 시작', { 
      placesCount: places.length,
      location: currentLocation
    });
    
    // 현재 위치 추출
    let currentLat, currentLng;
    
    if (typeof currentLocation === 'object' && 'latitude' in currentLocation && 'longitude' in currentLocation) {
      currentLat = parseFloat(currentLocation.latitude);
      currentLng = parseFloat(currentLocation.longitude);
    } else if (Array.isArray(currentLocation) && currentLocation.length >= 2) {
      currentLat = parseFloat(currentLocation[0]);
      currentLng = parseFloat(currentLocation[1]);
    } else {
      logDebug('유효하지 않은 위치 형식:', currentLocation);
      return places;
    }
    
    // 거리 계산 및 추가
    const placesWithDistance = places.map(place => {
      if (!place) return place;
      
      try {
        let placeLat, placeLng;
        
        // 다양한 위치 형식 지원
        if (place.location) {
          if (typeof place.location === 'object') {
            if ('latitude' in place.location && 'longitude' in place.location) {
              placeLat = parseFloat(place.location.latitude);
              placeLng = parseFloat(place.location.longitude);
            } else if ('_lat' in place.location && '_long' in place.location) {
              // GeoPoint 형식
              placeLat = parseFloat(place.location._lat);
              placeLng = parseFloat(place.location._long);
            }
          } else if (Array.isArray(place.location) && place.location.length >= 2) {
            placeLat = parseFloat(place.location[0]);
            placeLng = parseFloat(place.location[1]);
          }
        } else if ('latitude' in place && 'longitude' in place) {
          // 직접 좌표가 있는 경우
          placeLat = parseFloat(place.latitude);
          placeLng = parseFloat(place.longitude);
        }
        
        // 위치 정보가 없거나, 좌표가 수치가 아닌 경우
        if (isNaN(placeLat) || isNaN(placeLng)) {
          return {
            ...place,
            distance: null,
            distanceKm: null,
            hasLocation: false
          };
        }
        
        // 거리 계산 (미터 단위)
        const distance = calculateDistance(
          currentLat, currentLng,
          placeLat, placeLng
        );
        
        return {
          ...place,
          distance: distance,
          distanceKm: Math.round(distance / 100) / 10, // km 단위 (소수점 한 자리)
          hasLocation: true
        };
      } catch (distanceError) {
        logDebug(`장소 ${place.id || place.placeId} 거리 계산 오류:`, distanceError);
        return {
          ...place,
          distance: null,
          distanceKm: null,
          distanceError: true
        };
      }
    });
    
    logDebug(`${placesWithDistance.length}개 장소에 거리 정보 추가 완료`);
    
    return placesWithDistance;
  } catch (error) {
    logError('거리 계산 중 오류', error);
    return places;
  }
};

// 위치 기반 필터링 - 거리 제한 필터
const filterPlacesByDistance = (places, maxDistance = 5000) => {
  if (!places || !Array.isArray(places)) {
    return places;
  }
  
  try {
    logDebug(`거리 기반 필터링 시작 (최대 거리: ${maxDistance}m)`, { places: places.length });
    
    const filtered = places.filter(place => {
      if (!place) return false;
      
      // distance 필드가 있고 최대 거리 이내인 경우만 포함
      return place.distance !== null && place.distance <= maxDistance;
    });
    
    logDebug(`거리 필터링 후 ${filtered.length}개 장소 남음`);
    
    return filtered;
  } catch (error) {
    logError('거리 기반 필터링 중 오류', error);
    return places;
  }
};

// 저장 캐시 초기화
const clearSavedCache = async (userId, placeId = null) => {
  try {
    if (placeId) {
      logDebug(`저장 캐시 초기화: 장소 ${placeId}`);
      
      // 특정 장소만 캐시에서 제거
      try {
        // 1. 저장된 장소 캐시에서 제거
        const savedPlacesCache = localStorage.getItem('savedPlacesCache');
        if (savedPlacesCache) {
          const cacheData = JSON.parse(savedPlacesCache);
          if (cacheData[placeId]) {
            delete cacheData[placeId];
            localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
          }
        }
        
        // 2. 장소 상세 정보 캐시에서 제거
        localStorage.removeItem(`place_${placeId}`);
        
        // 3. IndexedDB에서 해당 장소 제거
        await removeFromIndexedDB(STORES.SAVED_PLACES, placeId);
        logDebug(`장소 ${placeId} IndexedDB에서 제거됨`);
      } catch (singleCacheError) {
        logDebug('캐시 단일 항목 제거 실패', singleCacheError);
      }
    } else {
      logDebug(`저장 캐시 초기화: 사용자 ${userId}의 모든 캐시`);
      
      // 사용자의 모든 캐시 초기화
      try {
        // 1. 저장된 장소 캐시에서 제거
        const savedPlacesCache = localStorage.getItem('savedPlacesCache');
        if (savedPlacesCache) {
          const cacheData = JSON.parse(savedPlacesCache);
          
          // 현재 사용자의 항목만 제거
          const updatedCache = {};
          Object.entries(cacheData).forEach(([key, value]) => {
            if (value.userId !== userId) {
              updatedCache[key] = value;
            }
          });
          
          localStorage.setItem('savedPlacesCache', JSON.stringify(updatedCache));
        }
        
        // 2. 저장된 장소 데이터 초기화
        localStorage.removeItem(`savedPlaces_${userId}`);
        
        // 3. IndexedDB 스토어 전체 초기화 (clearStore 함수 사용)
        await clearStore(STORES.SAVED_PLACES);
        logDebug('IndexedDB 저장된 장소 스토어가 초기화되었습니다.');
      } catch (cacheError) {
        logDebug('전체 캐시 초기화 실패', cacheError);
      }
    }
    
    return true;
  } catch (error) {
    logError('저장 캐시 초기화 오류', error);
    return false;
  }
};

// 오프라인 작업 큐 동기화 - 새 함수 추가
const syncOfflineSaveOperations = async (userId) => {
  try {
    // 온라인 상태가 아니면 동기화 불가
    if (isOffline()) {
      logDebug('syncOfflineSaveOperations: 오프라인 상태, 동기화 불가');
      return { 
        success: false, 
        message: '오프라인 상태입니다. 네트워크 연결 시 동기화됩니다.',
        offline: true
      };
    }
    
    if (!userId) {
      return { 
        success: false, 
        message: '사용자 ID가 필요합니다.',
        error: '유효하지 않은 사용자 ID'
      };
    }
    
    const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
    
    // 현재 사용자의 작업만 필터링
    const userQueue = queue.filter(op => op.data.userId === userId);
    
    if (userQueue.length === 0) {
      logDebug('동기화할 오프라인 작업이 없습니다.');
      return { success: true, processed: 0 };
    }
    
    logDebug(`사용자 ${userId}의 오프라인 작업 ${userQueue.length}개 동기화 시작`);
    
    let processed = 0;
    let failed = 0;
    const failedOps = [];
    
    // 작업 유형별로 처리
    for (const op of userQueue) {
      try {
        switch (op.operation) {
          case 'save': {
            // 장소 저장
            const saveResult = await savePlace(op.data.userId, op.data.placeId);
            if (saveResult.success || saveResult.alreadySaved) {
              processed++;
              // 작업 큐에서 제거
              queue.splice(queue.findIndex(item => item.id === op.id), 1);
            } else {
              failedOps.push({ ...op, error: saveResult.error || "저장 실패" });
              failed++;
            }
            break;
          }
          
          case 'unsave': {
            // 장소 저장 취소
            const unsaveResult = await unsavePlace(op.data.userId, op.data.placeId);
            if (unsaveResult.success || unsaveResult.notSaved) {
              processed++;
              // 작업 큐에서 제거
              queue.splice(queue.findIndex(item => item.id === op.id), 1);
            } else {
              failedOps.push({ ...op, error: unsaveResult.error || "저장 취소 실패" });
              failed++;
            }
            break;
          }
            
          default:
            logDebug(`알 수 없는 작업 유형: ${op.operation}`);
            failedOps.push({ ...op, error: '알 수 없는 작업 유형' });
            failed++;
        }
      } catch (opError) {
        logError(`작업 처리 중 오류 (${op.operation}):`, opError);
        failedOps.push({ ...op, error: opError.message });
        failed++;
      }
    }
    
    // 실패한 작업만 큐에 남김
    if (failedOps.length === 0) {
      localStorage.setItem('saveOperationsQueue', JSON.stringify(
        queue.filter(op => op.data.userId !== userId)
      ));
    } else {
      // 성공한 작업은 제거하고 실패한 작업은 유지
      const updatedQueue = queue.filter(item => {
        // 다른 사용자의 작업은 유지
        if (item.data.userId !== userId) return true;
        
        // 현재 사용자의 작업 중 실패한 것만 유지
        return failedOps.some(op => op.id === item.id);
      });
      
      localStorage.setItem('saveOperationsQueue', JSON.stringify(updatedQueue));
    }
    
    logDebug(`오프라인 작업 동기화 완료: ${processed}개 성공, ${failed}개 실패`);
    
    // 동기화 후 저장된 장소 목록 새로고침
    if (processed > 0) {
      try {
        const refreshedPlaces = await getSavedPlaces(userId);
        logDebug(`${refreshedPlaces.length}개 저장된 장소 새로고침 완료`);
      } catch (refreshError) {
        logDebug('저장된 장소 새로고침 오류', refreshError);
      }
    }
    
    return {
      success: true,
      processed,
      failed,
      failedOps: failedOps.length > 0 ? failedOps : null
    };
  } catch (error) {
    logError('오프라인 작업 동기화 오류:', error);
    return { 
      success: false, 
      error: error.message,
      message: '오프라인 작업 동기화 중 오류가 발생했습니다.'
    };
  }
};

// 오프라인 작업 큐의 작업 수를 반환하는 함수
const getPendingOfflineOperationsCount = (userId = null) => {
  try {
    const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
    
    if (userId) {
      // 특정 사용자의 작업만 계산
      return queue.filter(op => op.data.userId === userId).length;
    }
    
    return queue.length;
  } catch (error) {
    logError('오프라인 작업 큐 확인 오류:', error);
    return 0;
  }
};

// 장소 리뷰 업데이트 함수 (새로 추가)
const updatePlaceReview = async (userId, placeId, reviewData) => {
  try {
    // 입력값 디버깅
    logDebug('updatePlaceReview: 원본 입력값', { placeId, userId, reviewData });
    
    // 입력 유효성 검사
    if (!userId || !placeId) {
      return { success: false, error: '유효하지 않은 사용자 ID 또는 장소 ID입니다.' };
    }
    
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태에서 리뷰 업데이트 시도');
      
      // 오프라인 작업 큐에 추가
      const offlineReviewData = {
        ...reviewData,
        userId,
        placeId,
        updatedAt: new Date().toISOString()
      };
      
      await addToOfflineQueue('updateReview', offlineReviewData);
      
      // 로컬 캐시 업데이트
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        localStorage.setItem(reviewKey, JSON.stringify(offlineReviewData));
      } catch (cacheError) {
        logDebug('로컬 리뷰 캐시 업데이트 오류', cacheError);
      }
      
      return {
        success: true,
        message: '리뷰가 오프라인 상태에서 업데이트되었습니다. 네트워크 연결 시 서버에 반영됩니다.',
        offline: true,
        data: offlineReviewData
      };
    }
    
    // 복합 ID 생성 (사용자와 장소를 조합) - 일관된 형식 사용
    const reviewId = `review_${userId}_${placeId}`;
    const reviewRef = doc(db, 'reviews', reviewId);
    
    // 이미 리뷰가 존재하는지 확인
    const existingDoc = await getDoc(reviewRef);
    
    // 리뷰 데이터 준비
    const now = serverTimestamp();
    const reviewPayload = {
      userId,
      placeId,
      ...reviewData,
      updatedAt: now
    };
    
    if (existingDoc.exists()) {
      // 기존 리뷰 업데이트
      await updateDoc(reviewRef, reviewPayload);
      logDebug(`장소 ${placeId} 리뷰 업데이트 완료`);
      
      // 기존 평점 확인하여 장소 평점 업데이트
      const oldData = existingDoc.data();
      
      if (oldData.rating !== reviewData.rating) {
        try {
          await updatePlaceReviewStatsOnEdit(placeId, oldData.rating || 0, reviewData.rating || 0);
        } catch (statsError) {
          logDebug('평점 통계 업데이트 오류', statsError);
        }
      }
    } else {
      // 새 리뷰 생성
      reviewPayload.createdAt = now;
      await setDoc(reviewRef, reviewPayload);
      logDebug(`장소 ${placeId} 새 리뷰 작성 완료`);
      
      // 새 리뷰 평점 업데이트
      try {
        await updatePlaceReviewStats(placeId, reviewData.rating || 0);
      } catch (statsError) {
        logDebug('평점 통계 업데이트 오류', statsError);
      }
    }
    
    // 캐싱
    try {
      const reviewKey = `review_${userId}_${placeId}`;
      const cachedData = {
        ...reviewPayload,
        id: reviewId,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(reviewKey, JSON.stringify(cachedData));
    } catch (cacheError) {
      logDebug('로컬 리뷰 캐시 업데이트 오류', cacheError);
    }
    
    // 오프라인 큐에서 이 리뷰 관련 작업 제거
    try {
      const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
      const filteredQueue = queue.filter(op => 
        !(op.operation === 'updateReview' && op.data.placeId === placeId && op.data.userId === userId)
      );
      localStorage.setItem('saveOperationsQueue', JSON.stringify(filteredQueue));
    } catch (queueError) {
      logDebug('오프라인 큐 업데이트 오류', queueError);
    }
    
    return {
      success: true,
      id: reviewId,
      message: existingDoc.exists() ? '리뷰가 업데이트되었습니다.' : '리뷰가 작성되었습니다.'
    };
  } catch (error) {
    logError('리뷰 업데이트 중 오류', error);
    
    // 네트워크 오류 확인 및 처리
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류로 인한 오프라인 저장');
      
      // 오프라인 작업 큐에 추가
      const offlineReviewData = {
        ...reviewData,
        userId,
        placeId,
        updatedAt: new Date().toISOString()
      };
      
      await addToOfflineQueue('updateReview', offlineReviewData);
      
      // 로컬 캐시 업데이트
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        localStorage.setItem(reviewKey, JSON.stringify(offlineReviewData));
      } catch (cacheError) {
        logDebug('로컬 리뷰 캐시 업데이트 오류', cacheError);
      }
      
      return {
        success: true,
        message: '네트워크 오류로 인해 리뷰가 로컬에 저장되었습니다. 네트워크 연결 시 자동으로 반영됩니다.',
        offline: true,
        data: offlineReviewData
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 장소의 사용자 리뷰 가져오기 함수
const getPlaceReview = async (userId, placeId) => {
  try {
    if (!userId || !placeId) {
      return { success: false, message: '유효하지 않은 사용자 ID 또는 장소 ID' };
    }
    
    logDebug(`장소 리뷰 조회: ${placeId} (사용자: ${userId})`);
    
    // 캐시에서 먼저 확인
    const reviewKey = `review_${userId}_${placeId}`;
    try {
      const cachedReview = localStorage.getItem(reviewKey);
      if (cachedReview) {
        logDebug('로컬 캐시에서 리뷰 발견');
        return {
          success: true,
          data: JSON.parse(cachedReview),
          fromCache: true
        };
      }
    } catch (cacheError) {
      logDebug('리뷰 캐시 조회 오류', cacheError);
    }
    
    // 오프라인 작업 큐 확인
    try {
      const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
      const relevantOps = queue.filter(op => 
        op.operation === 'updateReview' && 
        op.data.placeId === placeId && 
        op.data.userId === userId
      );
      
      if (relevantOps.length > 0) {
        // 최신 작업 찾기
        const latestOp = relevantOps.sort((a, b) => b.timestamp - a.timestamp)[0];
        
        logDebug('오프라인 큐에서 리뷰 발견');
        return {
          success: true,
          data: latestOp.data,
          fromOfflineQueue: true
        };
      }
    } catch (queueError) {
      logDebug('오프라인 큐 확인 오류', queueError);
    }
    
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태에서 리뷰 조회');
      return {
        success: true,
        data: null,
        offline: true,
        message: '오프라인 상태에서 리뷰를 찾을 수 없습니다.'
      };
    }
    
    // Firebase에서 조회
    const reviewId = `review_${userId}_${placeId}`;
    const reviewRef = doc(db, 'reviews', reviewId);
    
    const reviewDoc = await getDoc(reviewRef);
    if (reviewDoc.exists()) {
      const reviewData = reviewDoc.data();
      
      // 결과 변환 및 캐싱
      const processedData = {
        ...reviewData,
        id: reviewId,
        updatedAt: reviewData.updatedAt?.toDate?.() || reviewData.updatedAt,
        createdAt: reviewData.createdAt?.toDate?.() || reviewData.createdAt
      };
      
      // 캐싱
      try {
        localStorage.setItem(reviewKey, JSON.stringify(processedData));
      } catch (cacheError) {
        logDebug('리뷰 캐시 저장 오류', cacheError);
      }
      
      return {
        success: true,
        data: processedData
      };
    }
    
    // 복합 ID로 찾지 못한 경우 쿼리로 시도
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('userId', '==', userId),
      where('placeId', '==', placeId)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const reviewDoc = querySnapshot.docs[0];
      const reviewData = reviewDoc.data();
      
      // 결과 변환 및 캐싱
      const processedData = {
        ...reviewData,
        id: reviewDoc.id,
        updatedAt: reviewData.updatedAt?.toDate?.() || reviewData.updatedAt,
        createdAt: reviewData.createdAt?.toDate?.() || reviewData.createdAt
      };
      
      // 캐싱
      try {
        localStorage.setItem(reviewKey, JSON.stringify(processedData));
      } catch (cacheError) {
        logDebug('리뷰 캐시 저장 오류', cacheError);
      }
      
      return {
        success: true,
        data: processedData
      };
    }
    
    // 리뷰가 없는 경우
    return {
      success: true,
      data: null
    };
  } catch (error) {
    logError('리뷰 조회 중 오류', error);
    
    // 네트워크 오류 확인 및 처리
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류로 인한 로컬 캐시 사용 시도');
      
      // 로컬 캐시 확인
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        const cachedReview = localStorage.getItem(reviewKey);
        if (cachedReview) {
          return {
            success: true,
            data: JSON.parse(cachedReview),
            fromCache: true,
            offline: true
          };
        }
      } catch (cacheError) {
        logDebug('리뷰 캐시 조회 오류', cacheError);
      }
      
      return {
        success: false,
        error: '네트워크 오류로 인해 리뷰를 가져올 수 없습니다.',
        offline: true
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 리뷰 삭제 함수
const deleteReview = async (userId, placeId) => {
  try {
    if (!userId || !placeId) {
      return { success: false, error: '유효하지 않은 사용자 ID 또는 장소 ID입니다.' };
    }
    
    logDebug(`리뷰 삭제 시도: ${placeId} (사용자: ${userId})`);
    
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태에서 리뷰 삭제 시도');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('deleteReview', { userId, placeId });
      
      // 로컬 캐시에서 제거
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        localStorage.removeItem(reviewKey);
      } catch (cacheError) {
        logDebug('로컬 리뷰 캐시 제거 오류', cacheError);
      }
      
      return {
        success: true,
        message: '리뷰가 오프라인 상태에서 삭제되었습니다. 네트워크 연결 시 서버에 반영됩니다.',
        offline: true
      };
    }
    
    // 복합 ID로 리뷰 가져오기
    const reviewId = `review_${userId}_${placeId}`;
    const reviewRef = doc(db, 'reviews', reviewId);
    
    // 리뷰 존재 확인 및 삭제
    const reviewDoc = await getDoc(reviewRef);
    if (reviewDoc.exists()) {
      const reviewData = reviewDoc.data();
      
      // 리뷰 삭제
      await deleteDoc(reviewRef);
      
      // 장소 평점 업데이트
      try {
        await updatePlaceReviewStatsOnDelete(placeId, reviewData.rating || 0);
      } catch (statsError) {
        logDebug('평점 통계 업데이트 오류', statsError);
      }
      
      // 로컬 캐시에서 제거
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        localStorage.removeItem(reviewKey);
        
        // 오프라인 큐에서 관련 작업 제거
        const queue = JSON.parse(localStorage.getItem('saveOperationsQueue') || '[]');
        const filteredQueue = queue.filter(op => 
          !(op.data.placeId === placeId && op.data.userId === userId)
        );
        localStorage.setItem('saveOperationsQueue', JSON.stringify(filteredQueue));
      } catch (cacheError) {
        logDebug('로컬 리뷰 캐시 제거 오류', cacheError);
      }
      
      return {
        success: true,
        message: '리뷰가 삭제되었습니다.'
      };
    }
    
    // 복합 ID로 찾지 못한 경우 쿼리로 시도
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('userId', '==', userId),
      where('placeId', '==', placeId)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const reviewDoc = querySnapshot.docs[0];
      const reviewData = reviewDoc.data();
      
      // 리뷰 삭제
      await deleteDoc(doc(db, 'reviews', reviewDoc.id));
      
      // 장소 평점 업데이트
      try {
        await updatePlaceReviewStatsOnDelete(placeId, reviewData.rating || 0);
      } catch (statsError) {
        logDebug('평점 통계 업데이트 오류', statsError);
      }
      
      // 로컬 캐시에서 제거
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        localStorage.removeItem(reviewKey);
      } catch (cacheError) {
        logDebug('로컬 리뷰 캐시 제거 오류', cacheError);
      }
      
      return {
        success: true,
        message: '리뷰가 삭제되었습니다.'
      };
    }
    
    // 리뷰가 없는 경우
    return {
      success: false,
      message: '삭제할 리뷰가 없습니다.'
    };
  } catch (error) {
    logError('리뷰 삭제 중 오류', error);
    
    // 네트워크 오류 확인 및 처리
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류로 인한 오프라인 처리');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('deleteReview', { userId, placeId });
      
      // 로컬 캐시에서 제거
      try {
        const reviewKey = `review_${userId}_${placeId}`;
        localStorage.removeItem(reviewKey);
      } catch (cacheError) {
        logDebug('로컬 리뷰 캐시 제거 오류', cacheError);
      }
      
      return {
        success: true,
        message: '네트워크 오류로 인해 리뷰가 로컬에서 삭제되었습니다. 네트워크 연결 시 서버에 반영됩니다.',
        offline: true
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 장소 방문 계획 추가 함수
const addPlannedVisit = async (userId, placeId, visitDate, notes = '') => {
  try {
    if (!userId || !placeId) {
      return { success: false, error: '유효하지 않은 사용자 ID 또는 장소 ID입니다.' };
    }
    
    logDebug(`방문 계획 추가: ${placeId} (사용자: ${userId}, 날짜: ${visitDate})`);
    
    // 오프라인 상태 확인
    if (isOffline()) {
      logDebug('오프라인 상태에서 방문 계획 추가');
      
      // 날짜 정규화
      const normalizedDate = visitDate instanceof Date ? 
        visitDate.toISOString() : new Date(visitDate).toISOString();
      
      // 오프라인 작업 큐에 추가
      const visitData = {
        userId,
        placeId,
        visitDate: normalizedDate,
        notes,
        status: 'planned',
        createdAt: new Date().toISOString()
      };
      
      await addToOfflineQueue('addVisit', visitData);
      
      // 로컬 캐시에 저장
      try {
        const visitKey = `visit_${userId}_${placeId}`;
        localStorage.setItem(visitKey, JSON.stringify(visitData));
        
        // 방문 계획 목록에도 추가
        const visitsKey = `visits_${userId}`;
        let visits = [];
        
        try {
          const existingVisits = localStorage.getItem(visitsKey);
          if (existingVisits) {
            visits = JSON.parse(existingVisits);
          }
        } catch (parseError) {
          logDebug('방문 목록 파싱 오류', parseError);
        }
        
        // 중복 제거
        visits = visits.filter(v => v.placeId !== placeId);
        
        // 새 방문 계획 추가
        visits.unshift(visitData);
        
        localStorage.setItem(visitsKey, JSON.stringify(visits));
      } catch (cacheError) {
        logDebug('로컬 방문 계획 캐시 오류', cacheError);
      }
      
      return {
        success: true,
        message: '방문 계획이 오프라인 상태에서 저장되었습니다. 네트워크 연결 시 자동으로 반영됩니다.',
        offline: true,
        data: visitData
      };
    }
    
    // 날짜 정규화
    const visitDateObj = visitDate instanceof Date ? 
      visitDate : new Date(visitDate);
    
    // 이미 등록된 방문 계획이 있는지 확인
    const visitsRef = collection(db, 'plannedVisits');
    const q = query(
      visitsRef,
      where('userId', '==', userId),
      where('placeId', '==', placeId),
      where('status', '==', 'planned')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // 기존 방문 계획 업데이트
      const visitDoc = querySnapshot.docs[0];
      
      await updateDoc(doc(db, 'plannedVisits', visitDoc.id), {
        visitDate: visitDateObj,
        notes,
        updatedAt: serverTimestamp()
      });
      
      const updatedVisit = {
        id: visitDoc.id,
        userId,
        placeId,
        visitDate: visitDateObj.toISOString(),
        notes,
        status: 'planned',
        updatedAt: new Date().toISOString()
      };
      
      // 로컬 캐시 업데이트
      try {
        const visitKey = `visit_${userId}_${placeId}`;
        localStorage.setItem(visitKey, JSON.stringify(updatedVisit));
      } catch (cacheError) {
        logDebug('로컬 방문 계획 캐시 업데이트 오류', cacheError);
      }
      
      return {
        success: true,
        message: '방문 계획이 업데이트되었습니다.',
        id: visitDoc.id,
        data: updatedVisit
      };
    } else {
      // 새 방문 계획 추가
      const visitData = {
        userId,
        placeId,
        visitDate: visitDateObj,
        notes,
        status: 'planned',
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(visitsRef, visitData);
      
      const createdVisit = {
        id: docRef.id,
        userId,
        placeId,
        visitDate: visitDateObj.toISOString(),
        notes,
        status: 'planned',
        createdAt: new Date().toISOString()
      };
      
      // 로컬 캐시 업데이트
      try {
        const visitKey = `visit_${userId}_${placeId}`;
        localStorage.setItem(visitKey, JSON.stringify(createdVisit));
      } catch (cacheError) {
        logDebug('로컬 방문 계획 캐시 저장 오류', cacheError);
      }
      
      return {
        success: true,
        message: '방문 계획이 저장되었습니다.',
        id: docRef.id,
        data: createdVisit
      };
    }
  } catch (error) {
    logError('방문 계획 추가 중 오류', error);
    
    // 네트워크 오류 확인 및 처리
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      logDebug('네트워크 오류로 인한 오프라인 처리');
      
      // 날짜 정규화
      const normalizedDate = visitDate instanceof Date ? 
        visitDate.toISOString() : new Date(visitDate).toISOString();
      
      // 오프라인 작업 큐에 추가
      const visitData = {
        userId,
        placeId,
        visitDate: normalizedDate,
        notes,
        status: 'planned',
        createdAt: new Date().toISOString()
      };
      
      await addToOfflineQueue('addVisit', visitData);
      
      // 로컬 캐시에 저장
      try {
        const visitKey = `visit_${userId}_${placeId}`;
        localStorage.setItem(visitKey, JSON.stringify(visitData));
      } catch (cacheError) {
        logDebug('로컬 방문 계획 캐시 오류', cacheError);
      }
      
      return {
        success: true,
        message: '네트워크 오류로 인해 방문 계획이 로컬에 저장되었습니다. 네트워크 연결 시 자동으로 반영됩니다.',
        offline: true,
        data: visitData
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 장소 평점 통계 업데이트 함수
const updatePlaceReviewStats = async (placeId, rating) => {
  // 리뷰 서비스에서 구현된 함수 호출 또는 간단한 구현
  console.log(`장소 ${placeId}의 평점 ${rating} 업데이트 필요`);
  
  try {
    // 장소의 현재 리뷰 통계 가져오기
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) {
      logDebug(`장소 ${placeId}가 존재하지 않아 평점 업데이트 불가`);
      return false;
    }
    
    const placeData = placeDoc.data();
    const currentReviewCount = placeData.reviewCount || 0;
    const currentRating = placeData.averageRating || 0;
    
    // 새 리뷰 추가 시 평점 계산
    const newReviewCount = currentReviewCount + 1;
    const newAverageRating = ((currentRating * currentReviewCount) + rating) / newReviewCount;
    
    // 통계 업데이트
    await updateDoc(placeRef, {
      reviewCount: newReviewCount,
      averageRating: parseFloat(newAverageRating.toFixed(1))
    });
    
    return true;
  } catch (error) {
    logError(`장소 평점 업데이트 오류 (${placeId})`, error);
    return false;
  }
};

const updatePlaceReviewStatsOnEdit = async (placeId, oldRating, newRating) => {
  // 리뷰 서비스에서 구현된 함수 호출 또는 간단한 구현
  console.log(`장소 ${placeId}의 평점 ${oldRating}에서 ${newRating}으로 수정 필요`);
  
  try {
    // 장소의 현재 리뷰 통계 가져오기
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) {
      logDebug(`장소 ${placeId}가 존재하지 않아 평점 업데이트 불가`);
      return false;
    }
    
    const placeData = placeDoc.data();
    const reviewCount = placeData.reviewCount || 0;
    const currentRating = placeData.averageRating || 0;
    
    // 평점이 같으면 업데이트 불필요
    if (oldRating === newRating) return true;
    
    // 리뷰 수가 0인 경우 기본값 설정
    if (reviewCount === 0) {
      await updateDoc(placeRef, {
        reviewCount: 1,
        averageRating: newRating
      });
      return true;
    }
    
    // 새 평균 계산: (총합 - 이전 평점 + 새 평점) / 리뷰 수
    const totalRating = currentRating * reviewCount;
    const newTotalRating = totalRating - oldRating + newRating;
    const newAverageRating = newTotalRating / reviewCount;
    
    // 통계 업데이트
    await updateDoc(placeRef, {
      averageRating: parseFloat(newAverageRating.toFixed(1))
    });
    
    return true;
  } catch (error) {
    logError(`장소 평점 수정 업데이트 오류 (${placeId})`, error);
    return false;
  }
};

const updatePlaceReviewStatsOnDelete = async (placeId, rating) => {
  // 리뷰 서비스에서 구현된 함수 호출 또는 간단한 구현
  console.log(`장소 ${placeId}의 평점 ${rating} 삭제 필요`);
  
  try {
    // 장소의 현재 리뷰 통계 가져오기
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) {
      logDebug(`장소 ${placeId}가 존재하지 않아 평점 업데이트 불가`);
      return false;
    }
    
    const placeData = placeDoc.data();
    const currentReviewCount = placeData.reviewCount || 0;
    const currentRating = placeData.averageRating || 0;
    
    // 리뷰가 하나만 있는 경우
    if (currentReviewCount <= 1) {
      await updateDoc(placeRef, {
        reviewCount: 0,
        averageRating: 0
      });
      return true;
    }
    
    // 새 리뷰 수 및 평점 계산
    const newReviewCount = currentReviewCount - 1;
    const totalRating = currentRating * currentReviewCount;
    const newTotalRating = totalRating - rating;
    const newAverageRating = newTotalRating / newReviewCount;
    
    // 통계 업데이트
    await updateDoc(placeRef, {
      reviewCount: newReviewCount,
      averageRating: parseFloat(newAverageRating.toFixed(1))
    });
    
    return true;
  } catch (error) {
    logError(`장소 평점 삭제 업데이트 오류 (${placeId})`, error);
    return false;
  }
};

// Firestore 함수 배치 내보내기
export {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  updateDoc,
  GeoPoint
};

// 유틸리티 함수 내보내기
export const saveUtils = {
  isOffline,
  checkFirebaseConnection,
  updateAllCaches,
  generateDummyPlace,
  calculateDistance,
  toGeoPoint
};

// 기본 객체로 내보내기
const saveService = {
  db,
  getPlaceDetails,
  checkFirebaseConnection,
  savePlace,
  unsavePlace,
  checkIfPlaceSaved,
  toggleSave,
  getSavedPlaces,
  getSavedPlacesByCategory,
  filterSavedPlaces,
  sortSavedPlaces,
  addDistanceToPlaces,
  filterPlacesByDistance,
  removeFromIndexedDB,
  clearSavedCache,
  
  // 리뷰 관련 함수 추가
  updatePlaceReview,
  getPlaceReview,
  deleteReview,
  
  // 방문 계획 관련 함수 추가
  addPlannedVisit,
  
  // 오프라인 동기화 관련 함수 추가
  syncOfflineSaveOperations,
  getPendingOfflineOperationsCount,
  
  // 함수 이름의 일관성을 위해 기존 함수 포함
  updatePlaceRatingOnChange: updatePlaceReviewStatsOnEdit,
  
  // 더미 데이터 생성 함수
  generateDummyPlace
};

export default saveService;
