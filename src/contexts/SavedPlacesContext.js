// src/contexts/SavedPlacesContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { 
  db, 
  doc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  setDoc,
  getDoc,
  fetchSavedPlacesDirectly
} from '../config/firebase';
import { 
  STORES, 
  saveItem, 
  deleteItem,
  getItemsByIndex,
  clearStore
} from '../utils/indexedDBUtils';

// 로컬 스토리지 키 설정
const LOCAL_STORAGE_KEYS = {
  SAVED_PLACES: 'myTripStyle_savedPlaces',
  PLANNED_VISITS: 'myTripStyle_plannedVisits',
  VISIT_HISTORY: 'myTripStyle_visitHistory',
  LAST_SYNC: 'myTripStyle_lastSync',
  SAVED_PLACES_CACHE: 'savedPlacesCache',
  OFFLINE_OPERATIONS: 'myTripStyle_offlineOperations' // 오프라인 작업 추적 키 추가
};

// Context 생성
const SavedPlacesContext = createContext();

// Context 사용을 위한 커스텀 훅
export const useSavedPlaces = () => {
  const context = useContext(SavedPlacesContext);
  if (!context) {
    throw new Error('useSavedPlaces는 SavedPlacesProvider 내부에서 사용해야 합니다');
  }
  return context;
};

// 디버그 로그 헬퍼 함수
const logDebug = (message, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SavedPlacesContext] ${message}`, data || '');
  }
};

// 중복 요청 방지를 위한 락 메커니즘 개선
class Lock {
  constructor() {
    this.locked = false;
    this.queue = [];
    this.lockTime = null; // 락 획득 시간 추적
    this.lockTimeout = 10000; // 락 타임아웃 기본값 (10초)
  }

  async acquire(timeoutMs = 5000) {
    // 이미 락을 보유한 경우 확인
    if (this.locked) {
      // 락이 너무 오래 지속된 경우 자동 해제 (데드락 방지)
      if (this.lockTime && (Date.now() - this.lockTime > this.lockTimeout)) {
        console.warn(`[Lock] 데드락 감지: ${this.lockTimeout}ms 이상 락이 유지됨. 자동 해제합니다.`);
        this.release();
        this.locked = true;
        this.lockTime = Date.now();
        return true;
      }
      
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      });

      const acquirePromise = new Promise((resolve) => {
        this.queue.push(resolve);
      });

      return Promise.race([acquirePromise, timeoutPromise]);
    }

    this.locked = true;
    this.lockTime = Date.now(); // 락 획득 시간 기록
    return true;
  }

  release() {
    this.lockTime = null; // 락 시간 초기화
    
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next(true);
    } else {
      this.locked = false;
    }
  }
  
  // 락 상태 강제 초기화 (비상용)
  reset() {
    this.locked = false;
    this.queue = [];
    this.lockTime = null;
    console.warn('[Lock] 락 상태가 강제로 초기화되었습니다.');
  }
}

// 네트워크 상태 확인 유틸리티 함수
const checkNetworkStatus = () => {
  return {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    // 60초 이상 오프라인 상태인지 확인
    longOffline: false // 실제 구현에서는 오프라인 시작 시간 추적 필요
  };
}; 

// Provider 컴포넌트
export const SavedPlacesProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [plannedVisits, setPlannedVisits] = useState([]);
  const [visitHistory, setVisitHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingOperations, setPendingOperations] = useState([]); // 대기 중인 작업 목록
  
  // 락 메커니즘 사용
  const operationLock = useRef(new Lock());
  
  // 초기 데이터 로드 여부 추적
  const initialDataLoaded = useRef(false);
  
  // 마운트 상태 추적
  const isMounted = useRef(true);
  
  // 네트워크 상태 추적 개선
  const networkStatus = useRef({
    online: navigator.onLine,
    lastOnlineTime: navigator.onLine ? Date.now() : null,
    lastOfflineTime: navigator.onLine ? null : Date.now(),
    reconnecting: false
  });
  
  // 유저 ID 메모이제이션
  const userId = useMemo(() => currentUser?.uid || null, [currentUser]);
  
  // 네트워크 상태 추적
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 오프라인 작업 수 추적
  const [pendingOperationsCount, setPendingOperationsCount] = useState(0);
  
  // 데이터 로드 상태 추적
  const dataLoadingState = useRef({
    savedPlaces: false,
    plannedVisits: false,
    visitHistory: false
  });

  // 로컬 데이터 저장 함수 개선
  const saveLocalData = useCallback((key, data) => {
    if (!isMounted.current) return false;
    
    try {
      if (data === undefined || data === null) {
        console.error(`${key} 저장 실패: 유효하지 않은 데이터`);
        return false;
      }
      
      localStorage.setItem(key, JSON.stringify(data));
      logDebug(`로컬 데이터 저장 완료: ${key}`);
      return true;
    } catch (error) {
      console.error(`${key} 로컬 스토리지 저장 오류:`, error);
      // 스토리지 용량 초과 시 대체 전략
      if (error.name === 'QuotaExceededError') {
        try {
          // 오래된 데이터 정리 후 재시도
          const oldKeys = Object.values(LOCAL_STORAGE_KEYS);
          let clearedSpace = false;
          
          for (const oldKey of oldKeys) {
            if (oldKey !== key && localStorage.getItem(oldKey)) {
              localStorage.removeItem(oldKey);
              clearedSpace = true;
            }
          }
          
          if (clearedSpace) {
            localStorage.setItem(key, JSON.stringify(data));
            logDebug(`스토리지 정리 후 ${key} 저장 성공`);
            return true;
          }
        } catch (retryError) {
          console.error(`스토리지 정리 후 재시도 실패:`, retryError);
        }
      }
      return false;
    }
  }, []);

  // 캐시 업데이트 함수 개선
  const updatePlaceCache = useCallback((placeId, isSavedStatus) => {
    if (!placeId) return false;
    
    try {
      let cacheData = {};
      const existingCache = localStorage.getItem(LOCAL_STORAGE_KEYS.SAVED_PLACES_CACHE);
      if (existingCache) {
        try {
          cacheData = JSON.parse(existingCache);
        } catch (parseError) {
          console.warn('캐시 파싱 오류, 새 객체 생성:', parseError);
          cacheData = {}; // 캐시 초기화
        }
      }
      
      // 최대 캐시 항목 수 제한 (성능 최적화)
      const MAX_CACHE_ITEMS = 100;
      
      if (isSavedStatus) {
        // 저장된 항목 수가 제한에 도달한 경우 가장 오래된 항목 제거
        const cacheEntries = Object.entries(cacheData);
        if (cacheEntries.length >= MAX_CACHE_ITEMS) {
          // 타임스탬프 기준으로 정렬
          cacheEntries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
          // 가장 오래된 항목 제거
          delete cacheData[cacheEntries[0][0]];
        }
        
        cacheData[placeId] = {
          timestamp: Date.now(),
          saved: true,
          userId
        };
      } else {
        delete cacheData[placeId];
      }
      
      localStorage.setItem(LOCAL_STORAGE_KEYS.SAVED_PLACES_CACHE, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.error(`장소 ${placeId} 캐시 업데이트 오류:`, error);
      return false;
    }
  }, [userId]);
  
  // IndexedDB 저장 상태 업데이트 개선
  const updateIndexedDBSavedState = useCallback(async (placeObj, isSavedStatus) => {
    if (!placeObj || !userId) return false;
    
    const placeId = placeObj.id || placeObj.placeId;
    if (!placeId) return false;
    
    try {
      if (isSavedStatus) {
        // 저장 상태
        const savedItemData = {
          ...placeObj,
          id: placeId,
          placeId: placeId,
          userId,
          savedAt: new Date(),
          lastUpdated: new Date() // 마지막 업데이트 시간 추가
        };
        
        await saveItem(STORES.SAVED_PLACES, savedItemData);
        return true;
      } else {
        // 삭제 상태
        await deleteItem(STORES.SAVED_PLACES, placeId);
        return true;
      }
    } catch (error) {
      console.error(`IndexedDB 저장 상태 업데이트 오류 (${placeId}):`, error);
      return false;
    }
  }, [userId]);

  // 오프라인 작업 저장 함수 개선
  const saveOfflineOperation = useCallback((operationType, data) => {
    try {
      const storageKey = `offlineOperations_${userId || 'anonymous'}`;
      let existingOps = [];
      
      try {
        const existingOpsString = localStorage.getItem(storageKey);
        if (existingOpsString) {
          existingOps = JSON.parse(existingOpsString);
          if (!Array.isArray(existingOps)) existingOps = [];
        }
      } catch (parseError) {
        console.warn('기존 오프라인 작업 파싱 오류:', parseError);
        existingOps = [];
      }
      
      // 중복 작업 확인 및 대체
      const isDuplicate = existingOps.some((op, index) => {
        if (op.type === operationType && 
            op.data.placeId === data.placeId && 
            op.data.visitId === data.visitId) {
          // 기존 작업 업데이트
          existingOps[index] = {
            id: op.id, // 기존 ID 유지
            type: operationType,
            data,
            timestamp: Date.now()
          };
          return true;
        }
        return false;
      });
      
      if (!isDuplicate) {
        const newOperation = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: operationType,
          data,
          timestamp: Date.now()
        };
        
        existingOps.push(newOperation);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(existingOps));
      
      // 대기 중인 작업 수 업데이트
      if (isMounted.current) {
        setPendingOperationsCount(existingOps.length);
        setPendingOperations(existingOps);
      }
      
      return true;
    } catch (error) {
      console.error('오프라인 작업 저장 오류:', error);
      return false;
    }
  }, [userId]);

  // IndexedDB 데이터 로드 개선
  const loadIndexedDBData = useCallback(async () => {
    if (!userId) return { success: false, message: '사용자 ID가 없습니다' };
    
    try {
      dataLoadingState.current.savedPlaces = true;
      
      // 1. 저장된 장소 로드
      const cachedPlaces = await getItemsByIndex(STORES.SAVED_PLACES, 'userId', userId);
      
      if (cachedPlaces && cachedPlaces.length > 0) {
        logDebug(`IndexedDB에서 ${cachedPlaces.length}개 저장된 장소 로드됨`);
        
        const normalizedPlaces = cachedPlaces
          .filter(place => place && (place.id || place.placeId))
          .map(place => ({
            ...place,
            id: place.id || place.placeId,
            placeId: place.placeId || place.id
          }))
          .sort((a, b) => {
            const aDate = a.savedAt instanceof Date ? a.savedAt : new Date(a.savedAt || 0);
            const bDate = b.savedAt instanceof Date ? b.savedAt : new Date(b.savedAt || 0);
            return bDate - aDate;
          });
        
        if (isMounted.current) {
          setSavedPlaces(normalizedPlaces);
          
          // 로컬 스토리지에도 저장
          saveLocalData(LOCAL_STORAGE_KEYS.SAVED_PLACES, normalizedPlaces);
          saveLocalData(`savedPlaces_${userId}`, normalizedPlaces);
        }
        
        dataLoadingState.current.savedPlaces = false;
        return { success: true, count: normalizedPlaces.length };
      }
      
      // 2. 방문 계획/기록 로드 (추가됨)
      try {
        // 방문 계획 로드
        dataLoadingState.current.plannedVisits = true;
        const cachedPlannedVisits = await getItemsByIndex(STORES.PLANNED_VISITS, 'userId', userId);
        if (cachedPlannedVisits && cachedPlannedVisits.length > 0) {
          const normalizedVisits = cachedPlannedVisits
            .filter(visit => visit && visit.id)
            .map(visit => ({
              ...visit,
              visitDate: visit.visitDate instanceof Date ? 
                visit.visitDate : 
                (visit.visitDate ? new Date(visit.visitDate) : null)
            }))
            .sort((a, b) => {
              const dateA = a.visitDate || new Date(9999, 11, 31);
              const dateB = b.visitDate || new Date(9999, 11, 31);
              return dateA - dateB;
            });
            
          if (isMounted.current) {
            setPlannedVisits(normalizedVisits);
            saveLocalData(LOCAL_STORAGE_KEYS.PLANNED_VISITS, normalizedVisits);
          }
        }
        dataLoadingState.current.plannedVisits = false;
        
        // 방문 기록 로드
        dataLoadingState.current.visitHistory = true;
        const cachedVisitHistory = await getItemsByIndex(STORES.VISIT_HISTORY, 'userId', userId);
        if (cachedVisitHistory && cachedVisitHistory.length > 0) {
          const normalizedHistory = cachedVisitHistory
            .filter(visit => visit && visit.id)
            .map(visit => ({
              ...visit,
              visitDate: visit.visitDate instanceof Date ? 
                visit.visitDate : 
                (visit.visitDate ? new Date(visit.visitDate) : null),
              visitedAt: visit.visitedAt instanceof Date ? 
                visit.visitedAt : 
                (visit.visitedAt ? new Date(visit.visitedAt) : null)
            }))
            .sort((a, b) => {
              const dateA = a.visitedAt || a.visitDate || new Date(0);
              const dateB = b.visitedAt || b.visitDate || new Date(0);
              return dateB - dateA;
            });
            
          if (isMounted.current) {
            setVisitHistory(normalizedHistory);
            saveLocalData(LOCAL_STORAGE_KEYS.VISIT_HISTORY, normalizedHistory);
          }
        }
        dataLoadingState.current.visitHistory = false;
      } catch (visitError) {
        console.error('방문 계획/기록 로드 오류:', visitError);
      }
      
      dataLoadingState.current.savedPlaces = false;
      return { success: true, count: 0, message: '데이터가 없습니다' };
    } catch (error) {
      console.error('IndexedDB에서 데이터 로드 중 오류:', error);
      
      Object.keys(dataLoadingState.current).forEach(key => {
        dataLoadingState.current[key] = false;
      });
      
      return { 
        success: false, 
        error: error.message, 
        message: 'IndexedDB에서 데이터를 로드하는 중 오류가 발생했습니다.' 
      };
    }
  }, [userId, saveLocalData]);

  // 저장 상태 확인 함수 - useCallback으로 메모이제이션하여 의존성 문제 해결
  const checkIfSaved = useCallback((placeIdOrObj) => {
    if (!placeIdOrObj) return false;
    
    let placeId;
    if (typeof placeIdOrObj === 'string') {
      placeId = placeIdOrObj;
    } else if (typeof placeIdOrObj === 'object') {
      placeId = placeIdOrObj.id || placeIdOrObj.placeId;
    }
    
    if (!placeId) return false;
    
    // 로컬 캐시 확인 개선
    try {
      const savedPlacesCache = localStorage.getItem(LOCAL_STORAGE_KEYS.SAVED_PLACES_CACHE);
      if (savedPlacesCache) {
        const cacheData = JSON.parse(savedPlacesCache);
        if (cacheData[placeId] && cacheData[placeId].saved && cacheData[placeId].userId === userId) {
          return true;
        }
      }
      
      // 사용자별 저장 캐시 확인
      const userCacheKey = `savedPlaces_${userId}`;
      const userCache = localStorage.getItem(userCacheKey);
      if (userCache) {
        try {
          const userData = JSON.parse(userCache);
          if (Array.isArray(userData)) {
            const found = userData.some(place => 
              place && (place.id === placeId || place.placeId === placeId)
            );
            if (found) return true;
          }
        } catch (e) {
          // 파싱 오류 무시
        }
      }
    } catch (cacheError) {
      // 캐시 확인 실패 시 무시
      console.warn('캐시 확인 중 오류:', cacheError);
    }
    
    // savedPlaces 배열에서 확인
    if (savedPlaces && Array.isArray(savedPlaces)) {
      return savedPlaces.some(place => {
        if (!place) return false;
        const savedId = place.id || place.placeId;
        return savedId === placeId;
      });
    }
    
    return false;
  }, [savedPlaces, userId]); // savedPlaces와 userId 의존성으로 추가

  // 메모이제이션된 isSaved 함수 
  const isSaved = useCallback(checkIfSaved, [checkIfSaved]);

  // 장소 저장 토글 함수 개선
  const toggleSavePlace = useCallback(async (placeIdOrObj) => {
    if (!isAuthenticated || !userId) {
      return Promise.reject(new Error('로그인이 필요합니다.'));
    }
    
    // 락 획득 시도
    const lockAcquired = await operationLock.current.acquire(5000);
    if (!lockAcquired) {
      return Promise.reject(new Error('이전 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.'));
    }

    try {
      // ID 및 장소 객체 추출
      let placeId, placeObj;
      
      if (typeof placeIdOrObj === 'string') {
        placeId = placeIdOrObj;
        placeObj = savedPlaces.find(p => (p.id === placeId || p.placeId === placeId));
        if (!placeObj) {
          placeObj = { id: placeId, placeId: placeId, name: `장소 ${placeId.substring(0, 5)}` };
        }
      } else if (typeof placeIdOrObj === 'object') {
        placeObj = { ...placeIdOrObj };
        placeId = placeObj.id || placeObj.placeId;
        
        placeObj.id = placeId;
        placeObj.placeId = placeId;
      } else {
        operationLock.current.release();
        return Promise.reject(new Error('유효하지 않은 매개변수 형식입니다.'));
      }
      
      if (!placeId) {
        operationLock.current.release();
        return Promise.reject(new Error('유효한 장소 ID가 없습니다.'));
      }
      
      // 중요: 직접 저장 상태 확인
      const currentStatus = checkIfSaved(placeId);
      
      // 새로운 상태는 현재 상태의 반대
      const newStatus = !currentStatus;
      
      // 낙관적 UI 업데이트
      let updatedPlaces;
      if (newStatus) {
        // 저장하는 경우 - 현재 시간으로 저장 시간 기록
        const now = new Date();
        updatedPlaces = [
          { 
            ...placeObj,
            id: placeId,
            placeId: placeId,
            savedAt: now,
            userId,
            lastUpdated: now // 마지막 업데이트 시간 추가
          },
          ...savedPlaces.filter(p => p && p.id !== placeId && p.placeId !== placeId)
        ];
      } else {
        // 저장 취소하는 경우 - 해당 항목 필터링
        updatedPlaces = savedPlaces.filter(p => {
          if (!p) return false;
          const normalizedId = p.id || p.placeId;
          return normalizedId !== placeId;
        });
      }
      
      // 즉시 UI 업데이트 (비동기 작업 전에 실행)
      if (isMounted.current) {
        setSavedPlaces(updatedPlaces);
        
        // 로컬 스토리지 및 캐시 업데이트
        saveLocalData(LOCAL_STORAGE_KEYS.SAVED_PLACES, updatedPlaces);
        saveLocalData(`savedPlaces_${userId}`, updatedPlaces);
        updatePlaceCache(placeId, newStatus);
      }
      
      // IndexedDB 업데이트
      updateIndexedDBSavedState(placeObj, newStatus)
        .catch(err => console.warn('IndexedDB 업데이트 실패:', err));
      
      // 오프라인 상태 처리
      if (!isOnline) {
        saveOfflineOperation('toggleSave', { 
          placeId, 
          isSaved: newStatus, 
          timestamp: Date.now() 
        });
        operationLock.current.release();
        return Promise.resolve(newStatus);
      }

      // Firebase 작업 처리
      try {
        if (!newStatus) {
          // Firebase에서 삭제
          const savedId = `${userId}_${placeId}`;
          const savedRef = doc(db, 'savedPlaces', savedId);
          
          const docSnap = await getDoc(savedRef);
          
          if (docSnap.exists()) {
            await deleteDoc(savedRef);
            logDebug(`장소 ${placeId} 저장 취소 완료 (Firebase)`);
          } else {
            // 쿼리로 검색
            const savedCollectionRef = collection(db, 'savedPlaces');
            const q = query(
              savedCollectionRef, 
              where('userId', '==', userId),
              where('placeId', '==', placeId)
            );
            
            try {
              const querySnapshot = await getDocs(q);
            
              if (!querySnapshot.empty) {
                // 모든 문서 삭제
                const deletePromises = querySnapshot.docs.map(docToDelete => 
                  deleteDoc(doc(db, 'savedPlaces', docToDelete.id))
                );
                
                await Promise.all(deletePromises);
                logDebug(`장소 ${placeId} 저장 취소 완료 (Firebase 쿼리)`);
              }
            } catch (queryError) {
              console.error('쿼리 실행 중 오류:', queryError);
              // 쿼리 오류 시에도 UI 상태는 유지 (낙관적 업데이트)
            }
          }
        } else {
          // Firebase에 저장
          const savedId = `${userId}_${placeId}`;
          const savedRef = doc(db, 'savedPlaces', savedId);
          
          const savedData = {
            userId,
            placeId,
            savedAt: serverTimestamp(),
            lastUpdated: serverTimestamp(), // 마지막 업데이트 시간 추가
            deviceInfo: {  // 디바이스 정보 추가
              platform: navigator.platform || 'unknown',
              userAgent: navigator.userAgent ? navigator.userAgent.substring(0, 100) : 'unknown',
              online: navigator.onLine
            }
          };
          
          await setDoc(savedRef, savedData);
          logDebug(`장소 ${placeId} 저장 완료 (Firebase)`);
        }
        
        // 마지막 동기화 시간 업데이트
        const syncTime = new Date().toISOString();
        if (isMounted.current) {
          setLastSyncTime(syncTime);
        }
        saveLocalData(LOCAL_STORAGE_KEYS.LAST_SYNC, syncTime);
        
        operationLock.current.release();
        return newStatus;
      } catch (firebaseError) {
        console.error('Firebase 저장 처리 오류:', firebaseError);
        
        // 오류 발생 시 오프라인 작업으로 저장하여 나중에 처리
        saveOfflineOperation('toggleSave', { 
          placeId, 
          isSaved: newStatus, 
          errorTime: Date.now(),
          errorType: firebaseError.code || 'unknown',
          errorMsg: firebaseError.message || 'Firebase 저장 실패'
        });
        
        // 오류가 있어도 UI 상태는 유지 (낙관적 업데이트)
        operationLock.current.release();
        return newStatus;
      }
    } catch (error) {
      console.error('저장 토글 오류:', error);
      if (isMounted.current) {
        setError(error.message || '장소 저장/취소 중 오류가 발생했습니다.');
      }
      
      operationLock.current.release();
      return Promise.reject(error);
    }
  }, [
    isAuthenticated, 
    userId, 
    savedPlaces, 
    saveLocalData, 
    updatePlaceCache, 
    updateIndexedDBSavedState, 
    isOnline, 
    saveOfflineOperation,
    checkIfSaved
  ]);

  // 오프라인 작업 처리 개선
  const processOfflineOperations = useCallback(async () => {
    if (!isOnline || !isAuthenticated || !userId) {
      return { success: false, reason: 'offline_or_not_authenticated' };
    }
    
    // 오프라인 작업 처리 중 락 획득
    const lockAcquired = await operationLock.current.acquire(8000);
    if (!lockAcquired) {
      return { success: false, reason: 'lock_timeout' };
    }
    
    try {
      const storageKey = `offlineOperations_${userId}`;
      const opsString = localStorage.getItem(storageKey);
      
      if (!opsString) {
        operationLock.current.release();
        return { success: true, processed: 0 };
      }
      
      let operations = [];
     try {
       operations = JSON.parse(opsString);
       if (!Array.isArray(operations) || operations.length === 0) {
         operationLock.current.release();
         return { success: true, processed: 0 };
       }
     } catch (parseError) {
       console.error('오프라인 작업 파싱 오류:', parseError);
       localStorage.removeItem(storageKey); // 손상된 데이터 제거
       operationLock.current.release();
       return { success: false, reason: 'parse_error', error: parseError.message };
     }
     
     logDebug(`${operations.length}개의 오프라인 작업 처리 시작`);
     
     // 처리된 작업 ID 추적
     const processedIds = [];
     const failedOps = [];
     let successCount = 0;
     
     // 작업 처리 우선순위 결정: toggleSave > updateVisit > addReview
     const prioritizedOps = [...operations].sort((a, b) => {
       const typePriority = {
         'toggleSave': 0,
         'updateVisit': 1,
         'addReview': 2,
         'default': 999
       };
       
       const aP = typePriority[a.type] ?? typePriority.default;
       const bP = typePriority[b.type] ?? typePriority.default;
       return aP - bP;
     });
     
     // 동기적으로 각 작업 처리 (순서 중요!)
     for (const op of prioritizedOps) {
       try {
         if (op.type === 'toggleSave') {
           const { placeId, isSaved: shouldBeSaved } = op.data;
           
           // 현재 상태와 원하는 상태가 다른 경우에만 처리
           const currentlySaved = checkIfSaved(placeId);
           if (currentlySaved !== shouldBeSaved) {
             logDebug(`오프라인 작업 실행: 장소 ${placeId} 저장 상태 ${shouldBeSaved}로 변경`);
             
             // Firebase에 직접 업데이트
             if (shouldBeSaved) {
               // 저장
               const savedId = `${userId}_${placeId}`;
               const savedRef = doc(db, 'savedPlaces', savedId);
               
               await setDoc(savedRef, {
                 userId,
                 placeId,
                 savedAt: serverTimestamp(),
                 lastUpdated: serverTimestamp(),
                 fromOfflineQueue: true,
                 queuedAt: op.timestamp
               });
             } else {
               // 삭제
               const savedId = `${userId}_${placeId}`;
               const savedRef = doc(db, 'savedPlaces', savedId);
               
               const docSnap = await getDoc(savedRef);
               
               if (docSnap.exists()) {
                 await deleteDoc(savedRef);
               } else {
                 // 쿼리로 검색 후 삭제
                 const savedCollectionRef = collection(db, 'savedPlaces');
                 const q = query(
                   savedCollectionRef, 
                   where('userId', '==', userId),
                   where('placeId', '==', placeId)
                 );
                 
                 const querySnapshot = await getDocs(q);
               
                 if (!querySnapshot.empty) {
                   await deleteDoc(doc(db, 'savedPlaces', querySnapshot.docs[0].id));
                 }
               }
             }
             
             // 작업 처리 완료로 표시
             processedIds.push(op.id);
             successCount++;
           } else {
             // 이미 원하는 상태인 경우 (성공으로 간주)
             processedIds.push(op.id);
             successCount++;
           }
         } else if (op.type === 'updateVisit' || op.type === 'addReview') {
           // 방문 계획 업데이트 및 리뷰 작성 로직 구현
           // 방문 계획 업데이트 처리
           if (op.type === 'updateVisit' && op.data && op.data.visitId) {
             logDebug(`오프라인 작업 실행: 방문 계획 ${op.data.visitId} 업데이트`);
             
             try {
               // 방문 계획 문서 참조
               const visitRef = doc(db, 'plannedVisits', op.data.visitId);
               
               // 업데이트할 데이터
               const updateData = {
                 lastUpdated: serverTimestamp(),
                 fromOfflineQueue: true
               };
               
               // 방문 날짜 추가
               if (op.data.visitDate) {
                 updateData.visitDate = op.data.visitDate;
               }
               
               // 메모 추가
               if (op.data.note !== undefined) {
                 updateData.note = op.data.note;
               }
               
               // Firebase에 업데이트
               await setDoc(visitRef, updateData, { merge: true });
               
               processedIds.push(op.id);
               successCount++;
             } catch (visitError) {
               console.error('방문 계획 업데이트 처리 오류:', visitError);
               failedOps.push({...op, error: visitError.message});
             }
           }
           
           // 리뷰 작성 처리
           else if (op.type === 'addReview' && op.data && op.data.visitId) {
             logDebug(`오프라인 작업 실행: 방문 ${op.data.visitId}에 리뷰 추가`);
             
             try {
               // 방문 기록 문서 참조
               const visitRef = doc(db, 'visitHistory', op.data.visitId);
               
               // 업데이트할 데이터
               const reviewData = {
                 lastUpdated: serverTimestamp(),
                 fromOfflineQueue: true
               };
               
               // 별점 추가
               if (op.data.rating !== undefined) {
                 reviewData.rating = op.data.rating;
               }
               
               // 리뷰 텍스트 추가
               if (op.data.review !== undefined) {
                 reviewData.review = op.data.review;
               }
               
               // Firebase에 업데이트
               await setDoc(visitRef, reviewData, { merge: true });
               
               processedIds.push(op.id);
               successCount++;
             } catch (reviewError) {
               console.error('리뷰 추가 처리 오류:', reviewError);
               failedOps.push({...op, error: reviewError.message});
             }
           }
           
           // 인식할 수 없는 작업 유형이지만 성공으로 처리
           else {
             console.warn('인식할 수 없는 작업 유형:', op.type, op.data);
             processedIds.push(op.id);
           }
         } else {
           // 인식할 수 없는 작업 유형 (성공으로 간주하고 제거)
           console.warn('인식할 수 없는 작업 유형:', op.type);
           processedIds.push(op.id);
         }
       } catch (opError) {
         console.error(`오프라인 작업 처리 실패 (ID: ${op.id}):`, opError);
         failedOps.push({...op, error: opError.message});
       }
     }
     
     // 처리된 작업 제거 및 실패한 작업 보존
     const remainingOps = operations.filter(op => !processedIds.includes(op.id));
     
     // 재시도 카운터 추적을 위해 실패한 작업 업데이트
     failedOps.forEach(failedOp => {
       const existingOp = remainingOps.find(op => op.id === failedOp.id);
       if (existingOp) {
         // 재시도 카운터 증가
         existingOp.retryCount = (existingOp.retryCount || 0) + 1;
         existingOp.lastError = failedOp.error;
         existingOp.lastErrorTime = Date.now();
       } else {
         // 실패한 작업에 재시도 카운터 추가
         failedOp.retryCount = 1;
         failedOp.lastErrorTime = Date.now();
         remainingOps.push(failedOp);
       }
     });
     
     // 남은 작업이 있으면 다시 저장
     if (remainingOps.length > 0) {
       localStorage.setItem(storageKey, JSON.stringify(remainingOps));
     } else {
       localStorage.removeItem(storageKey);
     }
     
     // 대기 중인 작업 수 업데이트
     if (isMounted.current) {
       setPendingOperationsCount(remainingOps.length);
       setPendingOperations(remainingOps);
     }
     
     logDebug(`오프라인 작업 처리 완료: ${successCount}개 성공, ${failedOps.length}개 실패, ${remainingOps.length}개 남음`);
     
     operationLock.current.release();
     return { 
       success: true, 
       processed: successCount, 
       failed: failedOps.length, 
       remaining: remainingOps.length 
     };
   } catch (error) {
     console.error('오프라인 작업 처리 전체 오류:', error);
     operationLock.current.release();
     return { 
       success: false, 
       reason: 'general_error', 
       error: error.message 
     };
   }
 }, [
   isOnline, 
   isAuthenticated, 
   userId, 
   checkIfSaved
 ]);

 // 방문 계획 추가 함수 개선
 const addPlannedVisit = useCallback(async (placeId, visitDate, note = '') => {
  if (!isAuthenticated || !userId) {
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  if (!placeId) {
    return Promise.reject(new Error('유효한 장소 ID가 없습니다.'));
  }
  
  // 락 획득
  const lockAcquired = await operationLock.current.acquire(3000);
  if (!lockAcquired) {
    return Promise.reject(new Error('이미 다른 작업이 처리 중입니다.'));
  }
  
  try {
    // 방문 계획 ID 생성 (구현 개선)
    const visitId = `visit_${userId}_${placeId}_${Date.now()}`;
    
    // 유효한 날짜 확인
    let validDate = null;
    if (visitDate) {
      try {
        validDate = visitDate instanceof Date ? 
          visitDate : 
          new Date(visitDate);
        
        // 유효한 날짜인지 확인
        if (isNaN(validDate.getTime())) {
          validDate = new Date(); // 기본값으로 현재 시간 사용
        }
      } catch (dateError) {
        console.warn('날짜 변환 오류, 현재 시간 사용:', dateError);
        validDate = new Date();
      }
    } else {
      validDate = new Date(); // 기본값으로 현재 시간 사용
    }
    
    // 방문 계획 데이터 구성
    const visitData = {
      id: visitId,
      placeId,
      userId,
      visitDate: validDate,
      note: note || '',
      status: 'planned',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 낙관적 UI 업데이트
    const updatedPlannedVisits = [
      visitData,
      ...plannedVisits.filter(v => v && v.id)
    ];
    
    // 정렬 (날짜 기준)
    updatedPlannedVisits.sort((a, b) => {
      const dateA = a.visitDate || new Date(9999, 11, 31);
      const dateB = b.visitDate || new Date(9999, 11, 31);
      return dateA - dateB;
    });
    
    if (isMounted.current) {
      setPlannedVisits(updatedPlannedVisits);
      
      // 로컬 스토리지 업데이트
      saveLocalData(LOCAL_STORAGE_KEYS.PLANNED_VISITS, updatedPlannedVisits);
    }
    
    // IndexedDB에 저장
    try {
      await saveItem(STORES.PLANNED_VISITS, visitData);
    } catch (dbError) {
      console.warn('IndexedDB 저장 실패:', dbError);
    }
    
    // 오프라인 상태 처리
    if (!isOnline) {
      saveOfflineOperation('addPlannedVisit', { visitId, placeId, visitDate: validDate, note });
      operationLock.current.release();
      return Promise.resolve(visitId);
    }
    
    // Firebase에 저장
    try {
      const visitRef = doc(db, 'plannedVisits', visitId);
      
      await setDoc(visitRef, {
        placeId,
        userId,
        visitDate: validDate,
        note: note || '',
        status: 'planned',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // 자동으로 장소 저장 (아직 저장되지 않은 경우)
      if (!checkIfSaved(placeId)) {
        // 별도 락 획득 없이 직접 Firebase에 저장
        try {
          const savedId = `${userId}_${placeId}`;
          const savedRef = doc(db, 'savedPlaces', savedId);
          
          await setDoc(savedRef, {
            userId,
            placeId,
            savedAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            savedFromVisitPlan: true
          });
          
          // 저장 상태 업데이트 (낙관적 UI 업데이트)
          const placeObj = { id: placeId, placeId };
          const now = new Date();
          
          const updatedSavedPlaces = [
            { 
              ...placeObj,
              id: placeId,
              placeId: placeId,
              savedAt: now,
              userId,
              lastUpdated: now,
              savedFromVisitPlan: true
            },
            ...savedPlaces.filter(p => p && p.id !== placeId && p.placeId !== placeId)
          ];
          
          if (isMounted.current) {
            setSavedPlaces(updatedSavedPlaces);
            
            // 로컬 스토리지 및 캐시 업데이트
            saveLocalData(LOCAL_STORAGE_KEYS.SAVED_PLACES, updatedSavedPlaces);
            saveLocalData(`savedPlaces_${userId}`, updatedSavedPlaces);
            updatePlaceCache(placeId, true);
          }
          
          // IndexedDB 업데이트
          updateIndexedDBSavedState(placeObj, true)
            .catch(err => console.warn('IndexedDB 업데이트 실패:', err));
        } catch (saveError) {
          console.warn('방문 계획 추가 시 장소 자동 저장 실패:', saveError);
          // 방문 계획 추가 자체에는 영향 없음
        }
      }
      
      operationLock.current.release();
      return Promise.resolve(visitId);
    } catch (firebaseError) {
      console.error('Firebase 방문 계획 저장 오류:', firebaseError);
      
      // 오류 발생 시 오프라인 작업으로 저장
      saveOfflineOperation('addPlannedVisit', { 
        visitId, 
        placeId, 
        visitDate: validDate,
        note,
        errorTime: Date.now(),
        errorType: firebaseError.code || 'unknown'
      });
      
      operationLock.current.release();
      return Promise.resolve(visitId); // 낙관적 UI 업데이트로 성공 반환
    }
  } catch (error) {
    console.error('방문 계획 추가 오류:', error);
    operationLock.current.release();
    return Promise.reject(error);
  }
}, [
  isAuthenticated, 
  userId, 
  isOnline, 
  plannedVisits, 
  savedPlaces,
  saveLocalData, 
  updatePlaceCache, 
  updateIndexedDBSavedState,
  saveOfflineOperation,
  checkIfSaved
]);

// 방문 완료 처리 함수 개선
const completePlannedVisit = useCallback(async (visitId) => {
  if (!isAuthenticated || !userId) {
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  if (!visitId) {
    return Promise.reject(new Error('유효한 방문 ID가 없습니다.'));
  }
  
  // 락 획득
  const lockAcquired = await operationLock.current.acquire(3000);
  if (!lockAcquired) {
    return Promise.reject(new Error('이미 다른 작업이 처리 중입니다.'));
  }
  
  try {
    // 해당 방문 계획 찾기
    const visit = plannedVisits.find(v => v && v.id === visitId);
    
    if (!visit) {
      operationLock.current.release();
      return Promise.reject(new Error('해당 방문 계획을 찾을 수 없습니다.'));
    }
    
    // 방문 기록 데이터 구성
    const visitedAt = new Date();
    const historyData = {
      id: visitId, // 동일한 ID 사용
      placeId: visit.placeId,
      userId,
      visitDate: visit.visitDate,
      visitedAt, // 실제 방문 완료 시간
      note: visit.note || '',
      status: 'completed',
      createdAt: visit.createdAt || new Date(),
      updatedAt: visitedAt,
      place: visit.place // 장소 정보 유지
    };
    
    // 낙관적 UI 업데이트
    // 1. 방문 계획에서 제거
    const updatedPlannedVisits = plannedVisits.filter(v => v && v.id !== visitId);
    // 2. 방문 기록에 추가
    const updatedVisitHistory = [
      historyData,
      ...visitHistory.filter(v => v && v.id !== visitId)
    ];
    
    // 방문 기록 정렬 (방문 시간 기준, 최신순)
    updatedVisitHistory.sort((a, b) => {
      const dateA = a.visitedAt || a.updatedAt || new Date(0);
      const dateB = b.visitedAt || b.updatedAt || new Date(0);
      return dateB - dateA;
    });
    
    if (isMounted.current) {
      setPlannedVisits(updatedPlannedVisits);
      setVisitHistory(updatedVisitHistory);
      
      // 로컬 스토리지 업데이트
      saveLocalData(LOCAL_STORAGE_KEYS.PLANNED_VISITS, updatedPlannedVisits);
      saveLocalData(LOCAL_STORAGE_KEYS.VISIT_HISTORY, updatedVisitHistory);
    }
    
    // IndexedDB 업데이트
    try {
      // 방문 계획에서 제거
      await deleteItem(STORES.PLANNED_VISITS, visitId);
      // 방문 기록에 추가
      await saveItem(STORES.VISIT_HISTORY, historyData);
    } catch (dbError) {
      console.warn('IndexedDB 업데이트 실패:', dbError);
    }
    
    // 오프라인 상태 처리
    if (!isOnline) {
      saveOfflineOperation('completePlannedVisit', { 
        visitId, 
        placeId: visit.placeId,
        visitedAt
      });
      operationLock.current.release();
      return Promise.resolve(true);
    }
    
    // Firebase 업데이트
    try {
      // 트랜잭션으로 처리하는 것이 좋지만, 여기서는 간단히 구현
      // 1. 방문 계획에서 삭제
      const visitRef = doc(db, 'plannedVisits', visitId);
      await deleteDoc(visitRef);
      
      // 2. 방문 기록에 추가
      const historyRef = doc(db, 'visitHistory', visitId);
      await setDoc(historyRef, {
        placeId: visit.placeId,
        userId,
        visitDate: visit.visitDate || null,
        visitedAt,
        note: visit.note || '',
        status: 'completed',
        createdAt: visit.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      operationLock.current.release();
      return Promise.resolve(true);
    } catch (firebaseError) {
      console.error('Firebase 방문 완료 처리 오류:', firebaseError);
      
      // 오류 발생 시 오프라인 작업으로 저장
      saveOfflineOperation('completePlannedVisit', { 
        visitId, 
        placeId: visit.placeId,
        visitedAt,
        errorTime: Date.now(),
        errorType: firebaseError.code || 'unknown'
      });
      
      operationLock.current.release();
      return Promise.resolve(true); // 낙관적 UI 업데이트로 성공 반환
    }
  } catch (error) {
    console.error('방문 완료 처리 오류:', error);
    operationLock.current.release();
    return Promise.reject(error);
  }
}, [
  isAuthenticated, 
  userId, 
  isOnline,
  plannedVisits, 
  visitHistory,
  saveLocalData,
  saveOfflineOperation
]);

// 리뷰 추가 함수 개선
const addReview = useCallback(async (visitId, reviewData) => {
  if (!isAuthenticated || !userId) {
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  if (!visitId) {
    return Promise.reject(new Error('유효한 방문 ID가 없습니다.'));
  }
  
  // 리뷰 데이터 유효성 검사 개선
  if (!reviewData) {
    return Promise.reject(new Error('리뷰 데이터가 없습니다.'));
  }
  
  // 평점은 필수값 검증
  if (reviewData.rating === undefined || reviewData.rating === null || 
      isNaN(Number(reviewData.rating)) || Number(reviewData.rating) <= 0) {
    return Promise.reject(new Error('유효한 평점이 필요합니다. (1-5 사이)'));
  }
  
  // 입력 로깅 (디버깅 목적)
  console.log(`[SavedPlacesContext] 리뷰 추가 시작 - ID: ${visitId}`);
  console.log(`[SavedPlacesContext] 리뷰 데이터:`, JSON.stringify({
    rating: reviewData.rating,
    review: reviewData.review || '',
    reviewLength: (reviewData.review || '').length
  }));
  
  // 락 획득
  const lockAcquired = await operationLock.current.acquire(3000);
  if (!lockAcquired) {
    return Promise.reject(new Error('이미 다른 작업이 처리 중입니다.'));
  }
  
  try {
    // 해당 방문 기록 찾기
    const visit = visitHistory.find(v => v && v.id === visitId);
    
    if (!visit) {
      console.error(`[SavedPlacesContext] 방문 기록을 찾을 수 없음: ${visitId}`);
      operationLock.current.release();
      return Promise.reject(new Error('해당 방문 기록을 찾을 수 없습니다.'));
    }
    
    // 평점 타입 정규화
    const normalizedRating = Number(reviewData.rating);
    
    // 리뷰 텍스트 정규화 (undefined나 null인 경우 빈 문자열로)
    const normalizedReview = reviewData.review != null ? String(reviewData.review) : '';
    
    // 업데이트된 방문 기록 데이터
    const updatedVisit = {
      ...visit,
      rating: normalizedRating,
      review: normalizedReview,
      hasReview: true,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log(`[SavedPlacesContext] 정규화된 리뷰 저장: 평점=${normalizedRating}, 내용 길이=${normalizedReview.length}`);
    
    // 낙관적 UI 업데이트
    const updatedVisitHistory = visitHistory.map(v => 
      v && v.id === visitId ? updatedVisit : v
    );
    
    if (isMounted.current) {
      setVisitHistory(updatedVisitHistory);
      
      // 로컬 스토리지 업데이트
      saveLocalData(LOCAL_STORAGE_KEYS.VISIT_HISTORY, updatedVisitHistory);
    }
    
    // IndexedDB 업데이트
    try {
      await saveItem(STORES.VISIT_HISTORY, updatedVisit);
    } catch (dbError) {
      console.warn('IndexedDB 리뷰 저장 실패:', dbError);
    }
    
    // 오프라인 상태 처리
    if (!isOnline) {
      saveOfflineOperation('addReview', { 
        visitId,
        placeId: visit.placeId,
        rating: normalizedRating,
        review: normalizedReview,
        reviewedAt: new Date()
      });
      operationLock.current.release();
      return Promise.resolve(true);
    }
    
    // Firebase 업데이트
    try {
      console.log('[SavedPlacesContext] Firebase에 리뷰 저장 시작');
      const historyRef = doc(db, 'visitHistory', visitId);
      
      // 기존 문서 확인
      const docSnap = await getDoc(historyRef);
      
      // Firebase에 업데이트할 데이터
      const firestoreData = {
        rating: normalizedRating,
        review: normalizedReview,
        hasReview: true,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      if (docSnap.exists()) {
        // 기존 문서 업데이트
        await setDoc(historyRef, firestoreData, { merge: true });
        console.log('[SavedPlacesContext] Firebase 기존 문서 업데이트 완료');
      } else {
        
          // 새 문서 생성 (방문 기록이 없는 경우)
          await setDoc(historyRef, {
            placeId: visit.placeId,
            userId,
            visitDate: visit.visitDate || null,
            visitedAt: visit.visitedAt || new Date(),
            note: visit.note || '',
            rating: normalizedRating,
            review: normalizedReview,
            hasReview: true,
            status: 'completed',
            reviewedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log('[SavedPlacesContext] Firebase 새 문서 생성 완료');
        }
        
        // 장소 문서에도 리뷰 정보 업데이트 (별도 컬렉션)
        try {
          const reviewId = `review_${userId}_${visit.placeId}_${Date.now()}`;
          const placeReviewRef = doc(db, 'placeReviews', reviewId);
          
          await setDoc(placeReviewRef, {
            placeId: visit.placeId,
            userId,
            visitId,
            rating: normalizedRating,
            review: normalizedReview,
            visitDate: visit.visitedAt || visit.visitDate || null,
            createdAt: serverTimestamp()
          });
          console.log('[SavedPlacesContext] 장소 리뷰 컬렉션에 리뷰 추가 완료');
        } catch (placeReviewError) {
          console.warn('[SavedPlacesContext] 장소 리뷰 추가 실패:', placeReviewError);
          // 개별 리뷰 추가 실패는 전체 작업 실패로 처리하지 않음
        }
        
        console.log('[SavedPlacesContext] 리뷰 저장 완료');
        operationLock.current.release();
        return Promise.resolve(true);
      } catch (firebaseError) {
        console.error('[SavedPlacesContext] Firebase 리뷰 저장 오류:', firebaseError);
        
        // 오류 발생 시 오프라인 작업으로 저장
        saveOfflineOperation('addReview', { 
          visitId,
          placeId: visit.placeId,
          rating: normalizedRating,
          review: normalizedReview,
          reviewedAt: new Date(),
          errorTime: Date.now(),
          errorType: firebaseError.code || 'unknown'
        });
        
        operationLock.current.release();
        return Promise.resolve(true); // 낙관적 UI 업데이트로 성공 반환
      }
    } catch (error) {
      console.error('[SavedPlacesContext] 리뷰 추가 오류:', error);
      operationLock.current.release();
      return Promise.reject(error);
    }
  }, [
    isAuthenticated, 
    userId, 
    isOnline,
    visitHistory,
    saveLocalData,
    saveOfflineOperation
  ]);

  // 방문 계획 업데이트 함수 개선
 const updatePlannedVisit = useCallback(async (visitId, updateData) => {
  if (!isAuthenticated || !userId) {
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  if (!visitId) {
    return Promise.reject(new Error('유효한 방문 ID가 없습니다.'));
  }
  
  // 락 획득
  const lockAcquired = await operationLock.current.acquire(3000);
  if (!lockAcquired) {
    return Promise.reject(new Error('이미 다른 작업이 처리 중입니다.'));
  }
  
  try {
    // 해당 방문 계획 찾기
    const visit = plannedVisits.find(v => v && v.id === visitId);
    
    if (!visit) {
      operationLock.current.release();
      return Promise.reject(new Error('해당 방문 계획을 찾을 수 없습니다.'));
    }
    
    // 날짜 정규화
    let visitDate = visit.visitDate;
    if (updateData.visitDate) {
      try {
        visitDate = updateData.visitDate instanceof Date ? 
          updateData.visitDate : 
          new Date(updateData.visitDate);
        
        // 유효한 날짜인지 확인
        if (isNaN(visitDate.getTime())) {
         visitDate = visit.visitDate || new Date(); // 기존 값 유지 또는 현재 시간
       }
     } catch (dateError) {
       console.warn('날짜 변환 오류, 기존 값 유지:', dateError);
       visitDate = visit.visitDate || new Date();
     }
   }
   
   // 업데이트된 방문 계획 데이터
   const updatedVisit = {
     ...visit,
     visitDate,
     note: updateData.note !== undefined ? updateData.note : visit.note,
     updatedAt: new Date()
   };
   
   // 낙관적 UI 업데이트
   const updatedPlannedVisits = plannedVisits.map(v => 
     v && v.id === visitId ? updatedVisit : v
   );
   
   // 정렬 (날짜 기준)
   updatedPlannedVisits.sort((a, b) => {
     const dateA = a.visitDate || new Date(9999, 11, 31);
     const dateB = b.visitDate || new Date(9999, 11, 31);
     return dateA - dateB;
   });
   
   if (isMounted.current) {
     setPlannedVisits(updatedPlannedVisits);
     
     // 로컬 스토리지 업데이트
     saveLocalData(LOCAL_STORAGE_KEYS.PLANNED_VISITS, updatedPlannedVisits);
   }
   
   // IndexedDB 업데이트
   try {
     await saveItem(STORES.PLANNED_VISITS, updatedVisit);
   } catch (dbError) {
     console.warn('IndexedDB 업데이트 실패:', dbError);
   }
   
   // 오프라인 상태 처리
   if (!isOnline) {
     saveOfflineOperation('updateVisit', { 
       visitId,
       visitDate,
       note: updatedVisit.note
     });
     operationLock.current.release();
     return Promise.resolve(true);
   }
   
   // Firebase 업데이트
   try {
     const visitRef = doc(db, 'plannedVisits', visitId);
     
     await setDoc(visitRef, {
       visitDate,
       note: updatedVisit.note,
       updatedAt: serverTimestamp()
     }, { merge: true });
     
     operationLock.current.release();
     return Promise.resolve(true);
   } catch (firebaseError) {
     console.error('Firebase 방문 계획 업데이트 오류:', firebaseError);
     
     // 오류 발생 시 오프라인 작업으로 저장
     saveOfflineOperation('updateVisit', { 
       visitId,
       visitDate,
       note: updatedVisit.note,
       errorTime: Date.now(),
       errorType: firebaseError.code || 'unknown'
     });
     
     operationLock.current.release();
     return Promise.resolve(true); // 낙관적 UI 업데이트로 성공 반환
   }
 } catch (error) {
   console.error('방문 계획 업데이트 오류:', error);
   operationLock.current.release();
   return Promise.reject(error);
 }
}, [
 isAuthenticated, 
 userId, 
 isOnline,
 plannedVisits,
 saveLocalData,
 saveOfflineOperation
]);

// 방문 계획 삭제 함수 개선
const deletePlannedVisit = useCallback(async (visitId) => {
 if (!isAuthenticated || !userId) {
   return Promise.reject(new Error('로그인이 필요합니다.'));
 }
 
 if (!visitId) {
   return Promise.reject(new Error('유효한 방문 ID가 없습니다.'));
 }
 
 // 락 획득
 const lockAcquired = await operationLock.current.acquire(3000);
 if (!lockAcquired) {
   return Promise.reject(new Error('이미 다른 작업이 처리 중입니다.'));
 }
 
 try {
   // 해당 방문 계획 찾기
   const visit = plannedVisits.find(v => v && v.id === visitId);
   
   if (!visit) {
     operationLock.current.release();
     return Promise.reject(new Error('해당 방문 계획을 찾을 수 없습니다.'));
   }
   
   // 낙관적 UI 업데이트
   const updatedPlannedVisits = plannedVisits.filter(v => v && v.id !== visitId);
   
   if (isMounted.current) {
     setPlannedVisits(updatedPlannedVisits);
     
     // 로컬 스토리지 업데이트
     saveLocalData(LOCAL_STORAGE_KEYS.PLANNED_VISITS, updatedPlannedVisits);
   }
   
   // IndexedDB 업데이트
   try {
     await deleteItem(STORES.PLANNED_VISITS, visitId);
   } catch (dbError) {
     console.warn('IndexedDB 삭제 실패:', dbError);
   }
   
   // 오프라인 상태 처리
   if (!isOnline) {
     saveOfflineOperation('deleteVisit', { visitId, placeId: visit.placeId });
     operationLock.current.release();
     return Promise.resolve(true);
   }
   
   // Firebase 업데이트
   try {
     const visitRef = doc(db, 'plannedVisits', visitId);
     await deleteDoc(visitRef);
     
     operationLock.current.release();
     return Promise.resolve(true);
   } catch (firebaseError) {
     console.error('Firebase 방문 계획 삭제 오류:', firebaseError);
     
     // 오류 발생 시 오프라인 작업으로 저장
     saveOfflineOperation('deleteVisit', { 
       visitId, 
       placeId: visit.placeId,
       errorTime: Date.now(),
       errorType: firebaseError.code || 'unknown'
     });
     
     operationLock.current.release();
     return Promise.resolve(true); // 낙관적 UI 업데이트로 성공 반환
   }
 } catch (error) {
   console.error('방문 계획 삭제 오류:', error);
   operationLock.current.release();
   return Promise.reject(error);
 }
}, [
 isAuthenticated, 
 userId, 
 isOnline,
 plannedVisits,
 saveLocalData,
 saveOfflineOperation
]);

// 장소 삭제 기능
const deleteSavedPlace = useCallback(async (placeId) => {
  if (!isAuthenticated || !userId) {
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  if (!placeId) {
    return Promise.reject(new Error('유효한 장소 ID가 없습니다.'));
  }
  
  // 저장된 상태면 토글해서 삭제
  if (checkIfSaved(placeId)) {
    return toggleSavePlace(placeId);
  }
  
  // 이미 저장되지 않은 상태면 성공으로 간주
  return Promise.resolve(false);
}, [isAuthenticated, userId, toggleSavePlace, checkIfSaved]);

// 데이터 상태 리셋 - 개선된 버전
const resetDataState = useCallback(() => {
  if (isMounted.current) {
    setSavedPlaces([]);
    setPlannedVisits([]);
    setVisitHistory([]);
    setError(null);
    setLastSyncTime(null);
    setPendingOperationsCount(0);
    setPendingOperations([]);
  }
  initialDataLoaded.current = false;
  
  // 락 초기화 (데드락 방지)
  operationLock.current.reset();
  
  // 로컬 스토리지에서도 삭제
  try {
    Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    if (userId) {
      localStorage.removeItem(`savedPlaces_${userId}`);
      localStorage.removeItem(`offlineOperations_${userId}`);
    }
    
    // IndexedDB 데이터도 정리
    if (userId) {
      Promise.all([
        clearStore(STORES.SAVED_PLACES),
        clearStore(STORES.VISIT_HISTORY),
        clearStore(STORES.PLANNED_VISITS)
      ]).catch(err => console.warn('IndexedDB 정리 중 일부 오류 발생', err));
    }
    
    return true;
  } catch (error) {
    console.error('데이터 리셋 중 오류:', error);
    return false;
  }
}, [userId]);

// 저장된 장소 새로고침 - 개선된 버전
const refreshData = useCallback(async () => {
  if (!isAuthenticated || !userId) {
    setLoading(false);
    setError('로그인이 필요합니다.');
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  // 락 획득 시도
  const lockAcquired = await operationLock.current.acquire(8000);
  if (!lockAcquired) {
    return Promise.reject(new Error('이미 데이터를 새로고침하는 중입니다.'));
  }
  
  if (isMounted.current) {
    setLoading(true);
    setError(null);
  }
  
  try {
    // IndexedDB 데이터 로드
    const loadedFromCache = await loadIndexedDBData();
    
    // 오프라인 상태 확인
    if (!isOnline) {
      if (isMounted.current) {
        setLoading(false);
      }
      operationLock.current.release();
      
      // 캐시된 데이터를 가져왔으면 성공으로 간주
      if (loadedFromCache.success) {
        return loadedFromCache;
      } else {
        throw new Error('오프라인 상태에서 캐시된 데이터를 찾을 수 없습니다.');
      }
    }
    
    // Firebase에서 직접 저장된 장소 가져오기 (변경된 부분)
    const result = await fetchSavedPlacesDirectly(userId, { useCache: true, timeout: 15000 });
    
    if (!isMounted.current) {
      operationLock.current.release();
      return false;
    }
    
    if (result.success && Array.isArray(result.data)) {
      // ID 일관성 보장
      const normalizedPlaces = result.data.map(place => ({
        ...place,
        id: place.id || place.placeId,
        placeId: place.placeId || place.id
      }));
      
      // 상태 업데이트
      if (isMounted.current) {
        setSavedPlaces(normalizedPlaces);
        setError(null);
      }
      
      // 로컬 스토리지 및 캐시 업데이트
      saveLocalData(LOCAL_STORAGE_KEYS.SAVED_PLACES, normalizedPlaces);
      saveLocalData(`savedPlaces_${userId}`, normalizedPlaces);
      
      // IndexedDB 캐싱
      try {
        // 기존 데이터 클리어 (충돌 방지)
        await clearStore(STORES.SAVED_PLACES);
        
        // 새 데이터 저장
        for (const place of normalizedPlaces) {
          await saveItem(STORES.SAVED_PLACES, place);
        }
      } catch (dbError) {
        console.warn('IndexedDB 업데이트 실패:', dbError);
      }
      
      // Firebase에서 방문 계획 및 기록 데이터도 가져오기
      try {
        // 방문 계획 가져오기
        const plannedRef = collection(db, 'plannedVisits');
        const plannedQuery = query(plannedRef, where('userId', '==', userId));
        const plannedSnapshot = await getDocs(plannedQuery);
        
        if (!plannedSnapshot.empty) {
          const plannedData = plannedSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              placeId: data.placeId,
              userId: data.userId,
              visitDate: data.visitDate?.toDate() || null,
              note: data.note || '',
              status: data.status || 'planned',
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date()
            };
          });
          
          // 날짜 기준 정렬
          plannedData.sort((a, b) => {
            const dateA = a.visitDate || new Date(9999, 11, 31);
            const dateB = b.visitDate || new Date(9999, 11, 31);
            return dateA - dateB;
          });
          
          if (isMounted.current) {
            setPlannedVisits(plannedData);
          }
          
          // 로컬 스토리지에 저장
          saveLocalData(LOCAL_STORAGE_KEYS.PLANNED_VISITS, plannedData);
          
          // IndexedDB에 저장
          try {
            // 기존 데이터 클리어
            await clearStore(STORES.PLANNED_VISITS);
            
            // 새 데이터 저장
            for (const visit of plannedData) {
              await saveItem(STORES.PLANNED_VISITS, visit);
            }
          } catch (dbError) {
            console.warn('IndexedDB 방문 계획 업데이트 실패:', dbError);
          }
        }
        
        // 방문 기록 가져오기
        const historyRef = collection(db, 'visitHistory');
        const historyQuery = query(historyRef, where('userId', '==', userId));
        const historySnapshot = await getDocs(historyQuery);
        
        if (!historySnapshot.empty) {
          const historyData = historySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              placeId: data.placeId,
              userId: data.userId,
              visitDate: data.visitDate?.toDate() || null,
              visitedAt: data.visitedAt?.toDate() || null,
              note: data.note || '',
              rating: data.rating || 0,
              review: data.review || '',
              hasReview: data.hasReview || false,
              reviewedAt: data.reviewedAt?.toDate() || null,
              status: data.status || 'completed',
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date()
            };
          });
          
          // 방문 시간 기준 정렬 (최신순)
          historyData.sort((a, b) => {
            const dateA = a.visitedAt || a.updatedAt || new Date(0);
            const dateB = b.visitedAt || b.updatedAt || new Date(0);
            return dateB - dateA;
          });
          
          if (isMounted.current) {
            setVisitHistory(historyData);
          }
          
          // 로컬 스토리지에 저장
          saveLocalData(LOCAL_STORAGE_KEYS.VISIT_HISTORY, historyData);
          
          // IndexedDB에 저장
          try {
            // 기존 데이터 클리어
            await clearStore(STORES.VISIT_HISTORY);
            
            // 새 데이터 저장
            for (const visit of historyData) {
              await saveItem(STORES.VISIT_HISTORY, visit);
            }
          } catch (dbError) {
            console.warn('IndexedDB 방문 기록 업데이트 실패:', dbError);
          }
        }
      } catch (fetchError) {
        console.error('방문 데이터 가져오기 오류:', fetchError);
      }
      
      // 마지막 동기화 시간 업데이트
      const syncTime = new Date().toISOString();
      if (isMounted.current) {
        setLastSyncTime(syncTime);
      }
      saveLocalData(LOCAL_STORAGE_KEYS.LAST_SYNC, syncTime);
      
      // 초기 데이터 로드 완료 표시
      initialDataLoaded.current = true;
      
      if (isMounted.current) {
        setLoading(false);
      }
      operationLock.current.release();
      
      // 오프라인 작업 처리 시도
      processOfflineOperations().catch(err => 
        console.warn('오프라인 작업 처리 오류:', err)
      );
      
      return {
        success: true,
        savedPlaces: normalizedPlaces.length,
        plannedVisits: plannedVisits.length,
        visitHistory: visitHistory.length
      };
    } else {
      throw new Error(result.error || '데이터를 로드하는 데 실패했습니다.');
    }
  } catch (err) {
    console.error('데이터 새로고침 오류:', err);
    if (isMounted.current) {
      setError(err.message || '데이터를 로드하는 중 오류가 발생했습니다.');
      setLoading(false);
    }
    operationLock.current.release();
    return Promise.reject(err);
  }
}, [
  isAuthenticated, 
  userId, 
  isOnline,
  loadIndexedDBData,
  saveLocalData,
  processOfflineOperations,
  plannedVisits.length,
  visitHistory.length
]);

// Firebase 동기화 함수 - 개선된 버전
const syncSavedPlaces = useCallback(async (force = false) => {
  if (!isAuthenticated || !userId) {
    return Promise.reject(new Error('로그인이 필요합니다.'));
  }
  
  // 동시 요청 방지
  if (!force) {
    const lockAcquired = await operationLock.current.acquire(3000);
    if (!lockAcquired) {
      return Promise.reject(new Error('이미 동기화 중입니다. 잠시 후 다시 시도해주세요.'));
    }
  } else {
    operationLock.current = new Lock();
    await operationLock.current.acquire();
  }
  
  try {
    // 오프라인 상태 확인
    if (!isOnline) {
      operationLock.current.release();
      return Promise.reject(new Error('오프라인 상태에서는 동기화할 수 없습니다.'));
    }
    
    // 오프라인 작업 큐 처리
    const offlineResult = await processOfflineOperations();
    
    // 데이터 새로고침
    const refreshResult = await refreshData();
    
    operationLock.current.release();
    
    return { 
      success: true, 
      offlineOperationsProcessed: offlineResult.processed || 0,
      offlineOperationsFailed: offlineResult.failed || 0,
      savedPlacesCount: savedPlaces.length,
      plannedVisitsCount: plannedVisits.length,
      visitHistoryCount: visitHistory.length
    };
  } catch (error) {
    console.error('동기화 오류:', error);
    operationLock.current.release();
    return Promise.reject(error);
  }
}, [
  isAuthenticated, 
  userId, 
  isOnline, 
  processOfflineOperations, 
  refreshData, 
  savedPlaces.length,
  plannedVisits.length,
  visitHistory.length
]);

// 네트워크 상태 변경 감지
useEffect(() => {
  const handleOnline = () => {
    logDebug('온라인 상태로 변경 감지');
    setIsOnline(true);
    networkStatus.current.online = true;
    networkStatus.current.lastOnlineTime = Date.now();
    
    // 네트워크 연결 복구 시 필요한 작업
    if (!networkStatus.current.reconnecting) {
      networkStatus.current.reconnecting = true;
      
      // 오프라인 작업 큐 처리 (비동기)
      setTimeout(() => {
        processOfflineOperations()
          .then(result => {
            if (result.processed > 0) {
              logDebug(`오프라인 작업 ${result.processed}개 처리 완료`);
            }
            
            networkStatus.current.reconnecting = false;
          })
          .catch(err => {
            console.warn('오프라인 작업 처리 오류:', err);
            networkStatus.current.reconnecting = false;
          });
      }, 2000); // 연결 안정화를 위해 지연 시간 추가
    }
  };
  
  const handleOffline = () => {
    logDebug('오프라인 상태로 변경 감지');
    setIsOnline(false);
    networkStatus.current.online = false;
    networkStatus.current.lastOfflineTime = Date.now();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, [processOfflineOperations]);

// 컴포넌트 마운트/언마운트 처리
useEffect(() => {
  isMounted.current = true;
  logDebug('SavedPlacesProvider 마운트');
  
  // 언마운트 시 정리
  return () => {
    isMounted.current = false;
    logDebug('SavedPlacesProvider 언마운트');
  };
}, []);

// 초기 로드 시 로컬 스토리지에서 데이터 가져오기
useEffect(() => {
  const loadLocalData = () => {
    if (!isMounted.current) return;
    
    try {
      // 저장된 장소 데이터 로드
      try {
        const savedPlacesData = localStorage.getItem(LOCAL_STORAGE_KEYS.SAVED_PLACES);
        if (savedPlacesData) {
          const parsedData = JSON.parse(savedPlacesData);
          const validPlaces = Array.isArray(parsedData) ? 
            parsedData.filter(place => place && (place.id || place.placeId)) : [];
          
          if (validPlaces.length > 0 && isMounted.current) {
            setSavedPlaces(validPlaces);
            logDebug(`로컬 스토리지에서 ${validPlaces.length}개 장소 로드됨`);
          }
        }
        
        // 사용자 특정 캐시 확인
        if (userId) {
          const userSpecificData = localStorage.getItem(`savedPlaces_${userId}`);
          if (userSpecificData) {
            const parsedData = JSON.parse(userSpecificData);
            if (Array.isArray(parsedData) && parsedData.length > 0 && isMounted.current) {
              setSavedPlaces(parsedData);
              logDebug(`사용자 전용 캐시에서 ${parsedData.length}개 장소 로드됨`);
            }
          }
        }
      } catch (parseError) {
        console.error("저장된 장소 데이터 파싱 오류:", parseError);
      }
      
      // 방문 계획 데이터 로드
      try {
        const plannedVisitsData = localStorage.getItem(LOCAL_STORAGE_KEYS.PLANNED_VISITS);
        if (plannedVisitsData && isMounted.current) {
          const parsedData = JSON.parse(plannedVisitsData);
          const validVisits = Array.isArray(parsedData) ?
            parsedData.filter(visit => visit && visit.id) : [];
            
          setPlannedVisits(validVisits);
          logDebug(`로컬 스토리지에서 ${validVisits.length}개 방문 계획 로드됨`);
        }
      } catch (parseError) {
        console.error("계획된 방문 데이터 파싱 오류:", parseError);
        if (isMounted.current) {
          setPlannedVisits([]);
        }
      }
      
      // 방문 기록 데이터 로드
      try {
        const visitHistoryData = localStorage.getItem(LOCAL_STORAGE_KEYS.VISIT_HISTORY);
        if (visitHistoryData && isMounted.current) {
          const parsedData = JSON.parse(visitHistoryData);
          const validHistory = Array.isArray(parsedData) ?
            parsedData.filter(visit => visit && visit.id) : [];
            
          setVisitHistory(validHistory);
          logDebug(`로컬 스토리지에서 ${validHistory.length}개 방문 기록 로드됨`);
        } else if (isMounted.current) {
          setVisitHistory([]);
        }
      } catch (parseError) {
        console.error("방문 기록 데이터 파싱 오류:", parseError);
        if (isMounted.current) {
          setVisitHistory([]);
        }
      }
      
      // 마지막 동기화 시간 로드
      try {
        const lastSyncData = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_SYNC);
        if (lastSyncData && isMounted.current) {
          setLastSyncTime(JSON.parse(lastSyncData));
        }
      } catch (parseError) {
        console.error("마지막 동기화 시간 파싱 오류:", parseError);
        if (isMounted.current) {
          setLastSyncTime(null);
        }
      }
      
      // 대기 중인 오프라인 작업 개수 로드
      try {
        if (userId) {
          const offlineOpsData = localStorage.getItem(`offlineOperations_${userId}`);
          if (offlineOpsData) {
            const parsedOps = JSON.parse(offlineOpsData);
            if (Array.isArray(parsedOps) && isMounted.current) {
              setPendingOperationsCount(parsedOps.length);
              setPendingOperations(parsedOps);
              logDebug(`${parsedOps.length}개의 대기 중인 오프라인 작업 로드됨`);
            }
          }
        }
      } catch (parseError) {
        console.error("오프라인 작업 데이터 파싱 오류:", parseError);
      }
    } catch (error) {
      console.error('로컬 스토리지 데이터 로드 오류:', error);
    }
  };
  
  // 단 한 번만 실행
  loadLocalData();
}, [userId]);

// 사용자 인증 상태 변경 시 데이터 로드
useEffect(() => {
  const loadUserData = async () => {
    // 인증 상태 확인
    if (isAuthenticated && userId) {
      // 이미 로드했으면 중복 실행 방지
      if (initialDataLoaded.current) {
        return;
      }
      
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }
      
      try {
        // 네트워크 상태 확인
        if (!isOnline) {
          await loadIndexedDBData();
          if (isMounted.current) {
            setLoading(false);
          }
          return;
        }
        
        // 데이터 로드
        await refreshData();
        initialDataLoaded.current = true;
      } catch (err) {
        console.error('사용자 데이터 로드 오류:', err);
        if (isMounted.current) {
          setError(err.message || '데이터를 로드하는 중 오류가 발생했습니다.');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    } else {
      // 로그아웃 또는 인증 안된 상태면 상태 초기화
      if (isMounted.current) {
        setSavedPlaces([]);
        setPlannedVisits([]);
        setVisitHistory([]);
        setLoading(false);
      }
      initialDataLoaded.current = false;
    }
  };
  
  // 지연 로드 시작 - 앱 초기화 후 실행하기 위해
  setTimeout(loadUserData, 500);
  
}, [isAuthenticated, userId, refreshData, loadIndexedDBData, isOnline]);

// 네트워크 상태 변경 감지 - 온라인 되었을 때 동기화
useEffect(() => {
  if (isOnline) {
    // 로그인된 상태이면 오프라인 작업 처리
    if (isAuthenticated && userId) {
      // 이미 작업 중이 아닌 경우에만 처리
      if (!networkStatus.current.reconnecting) {
        networkStatus.current.reconnecting = true;
        
        // 약간의 지연 후 처리 (연결 안정화 시간)
        setTimeout(() => {
          processOfflineOperations()
            .then(result => {
              if (result.processed > 0) {
                logDebug(`온라인 상태 변경 후 ${result.processed}개 오프라인 작업 처리 완료`);
               }
               networkStatus.current.reconnecting = false;
             })
             .catch(err => {
               console.warn('온라인 상태 변경 후 오프라인 작업 처리 오류:', err);
               networkStatus.current.reconnecting = false;
             });
         }, 2000);
       }
     }
   }
 }, [isOnline, isAuthenticated, userId, processOfflineOperations]);

 // 오프라인 작업 주기적 처리 (백그라운드)
 useEffect(() => {
   let intervalId = null;
   
   // 30초마다 오프라인 작업 처리 시도 (온라인 상태 및 로그인된 경우에만)
   if (isOnline && isAuthenticated && userId && pendingOperationsCount > 0) {
     intervalId = setInterval(() => {
       // 이미 처리 중인 경우 건너뛰기
       if (networkStatus.current.reconnecting) return;
       
       // 오프라인 작업이 있을 때만 처리
       if (pendingOperationsCount > 0) {
         logDebug(`${pendingOperationsCount}개의 대기 중 작업 백그라운드 처리 시도`);
         
         // 백그라운드 처리 시작
         networkStatus.current.reconnecting = true;
         
         processOfflineOperations()
           .then(result => {
             if (result.processed > 0) {
               logDebug(`백그라운드에서 ${result.processed}개 오프라인 작업 처리 완료`);
             }
             networkStatus.current.reconnecting = false;
           })
           .catch(err => {
             console.warn('백그라운드 오프라인 작업 처리 오류:', err);
             networkStatus.current.reconnecting = false;
           });
       }
     }, 30000); // 30초마다 실행
   }
   
   return () => {
     if (intervalId) {
       clearInterval(intervalId);
     }
   };
 }, [isOnline, isAuthenticated, userId, pendingOperationsCount, processOfflineOperations]);

 // Context Provider 값 설정
 const contextValue = useMemo(() => ({
  savedPlaces,
  plannedVisits,
  visitHistory,
  loading,
  error,
  lastSyncTime,
  isOffline: !isOnline,
  hasPendingOperations: pendingOperationsCount > 0,
  pendingOperationsCount,
  
  // 장소 관련 함수
  refreshData,
  toggleSavePlace,
  isSaved,
  deleteSavedPlace,
  toggleSave: toggleSavePlace, // 별칭
  
  // 방문 계획 관련 함수
  addPlannedVisit,
  updatePlannedVisit,
  deletePlannedVisit,
  completePlannedVisit,
  
  // 리뷰 관련 함수
  addReview,
  
  // 상태 관리 함수
  resetDataState,
  syncSavedPlaces
}), [
  savedPlaces,
  plannedVisits,
  visitHistory,
  loading,
  error,
  lastSyncTime,
  isOnline,
  pendingOperationsCount,
  refreshData,
  toggleSavePlace,
  isSaved,
  resetDataState,
  syncSavedPlaces,
  deleteSavedPlace,
  addPlannedVisit,
  updatePlannedVisit,
  deletePlannedVisit,
  completePlannedVisit,
  addReview
]);

return (
  <SavedPlacesContext.Provider value={contextValue}>
    {children}
  </SavedPlacesContext.Provider>
);
};

export default SavedPlacesContext.Provider;
