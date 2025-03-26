import { db } from '../config/firebase';
import { collection, getDocs, doc, query, where, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as indexedDBUtils from '../utils/indexedDBUtils';

// 로컬 DB 스토어 이름 정의
const SYNC_LOG_STORE = 'syncLog';
const PLACES_STORE = 'places';
const SAVED_PLACES_STORE = 'savedPlaces';
const REVIEWS_STORE = 'reviews';
const USER_PREFS_STORE = 'userPreferences';

// 동기화 로그 저장
const saveSyncLog = async (userId, syncType, status, details = {}) => {
  try {
    const logEntry = {
      userId,
      syncType,
      status,
      timestamp: new Date().toISOString(),
      details,
    };
    
    await indexedDBUtils.addItem(SYNC_LOG_STORE, logEntry);
    return logEntry;
  } catch (error) {
    console.error('Failed to save sync log:', error);
    throw error;
  }
};

// 로컬 변경사항을 서버로 푸시
export const pushChanges = async (syncQueue, progressCallback = () => {}) => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      // 동기화 시작 로그
      await saveSyncLog(userId, 'push', 'started');
      
      const batch = writeBatch(db);
      let processedItems = 0;
      
      // 변경사항 처리
      for (const item of syncQueue) {
        const { collection: collectionName, action, data, id } = item;
        
        switch (action) {
          case 'create':
            const createRef = doc(collection(db, collectionName));
            batch.set(createRef, {
              ...data,
              userId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            break;
            
          case 'update':
            const updateRef = doc(db, collectionName, id);
            batch.update(updateRef, {
              ...data,
              updatedAt: serverTimestamp(),
            });
            break;
            
          case 'delete':
            const deleteRef = doc(db, collectionName, id);
            batch.delete(deleteRef);
            break;
            
          default:
            console.warn(`Unknown action '${action}' for item`, item);
        }
        
        processedItems++;
        progressCallback(processedItems / syncQueue.length);
      }
      
      // 배치 커밋
      await batch.commit();
      
      // 동기화 성공 로그
      await saveSyncLog(userId, 'push', 'completed', { itemCount: syncQueue.length });
      
      return { success: true, itemCount: syncQueue.length };
    } catch (error) {
      // 동기화 실패 로그
      await saveSyncLog(userId, 'push', 'failed', { error: error.message });
      console.error('Failed to push changes:', error);
      throw error;
    }
  };

  // 서버에서 최신 데이터 가져오기
export const pullChanges = async (userId, progressCallback = () => {}) => {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      // 동기화 시작 로그
      await saveSyncLog(userId, 'pull', 'started');
      
      // 동기화할 컬렉션 목록
      const collections = [
        { name: 'savedPlaces', store: SAVED_PLACES_STORE },
        { name: 'reviews', store: REVIEWS_STORE },
        { name: 'userPreferences', store: USER_PREFS_STORE },
      ];
      
      let totalProcessed = 0;
      const results = {};
      
      // 각 컬렉션 처리
      for (const [index, { name, store }] of collections.entries()) {
        // 사용자 관련 문서만 쿼리
        const q = query(
          collection(db, name),
          where('userId', '==', userId),
          orderBy('updatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // IndexedDB에 저장
        await indexedDBUtils.clearStore(store);
        for (const item of items) {
          await indexedDBUtils.addItem(store, item);
        }
        
        results[name] = items.length;
        totalProcessed = (index + 1) / collections.length;
        progressCallback(totalProcessed);
      }
      
      // 장소 데이터 가져오기 (모든 사용자에게 공통)
      const placesQuery = query(
        collection(db, 'places'),
        orderBy('updatedAt', 'desc')
      );
      
      const placesSnapshot = await getDocs(placesQuery);
      const places = placesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // 장소 데이터 저장
      await indexedDBUtils.clearStore(PLACES_STORE);
      for (const place of places) {
        await indexedDBUtils.addItem(PLACES_STORE, place);
      }
      
      results.places = places.length;
      
      // 마지막 동기화 타임스탬프 저장
      const lastSyncTime = new Date().toISOString();
      await indexedDBUtils.addItem('appState', { key: 'lastSyncTime', value: lastSyncTime });
      
      // 동기화 성공 로그
      await saveSyncLog(userId, 'pull', 'completed', { counts: results });
      
      return { success: true, lastSyncTime, counts: results };
    } catch (error) {
      // 동기화 실패 로그
      await saveSyncLog(userId, 'pull', 'failed', { error: error.message });
      console.error('Failed to pull changes:', error);
      throw error;
    }
  };

  // 오프라인 동안 생성된 변경사항 검색
export const getPendingChanges = async () => {
    try {
      const pendingChanges = await indexedDBUtils.getAllItems('pendingChanges');
      return pendingChanges;
    } catch (error) {
      console.error('Failed to get pending changes:', error);
      return [];
    }
  };
  
  // 동기화 상태 가져오기
  export const getSyncStatus = async () => {
    try {
      const appState = await indexedDBUtils.getItemByKey('appState', 'lastSyncTime');
      const pendingChanges = await getPendingChanges();
      
      return {
        lastSyncTime: appState?.value || null,
        pendingChangesCount: pendingChanges.length,
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        lastSyncTime: null,
        pendingChangesCount: 0,
      };
    }
  };
  
  // 로컬 변경사항 추가
  export const addPendingChange = async (change) => {
    try {
      const changeWithId = {
        ...change,
        id: change.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      
      await indexedDBUtils.addItem('pendingChanges', changeWithId);
      return changeWithId;
    } catch (error) {
      console.error('Failed to add pending change:', error);
      throw error;
    }
  };
  
  // 해결된 변경사항 제거
  export const removePendingChange = async (changeId) => {
    try {
      await indexedDBUtils.deleteItem('pendingChanges', changeId);
    } catch (error) {
      console.error('Failed to remove pending change:', error);
      throw error;
    }
  };
  
  // 강제 동기화 (모든 로컬 데이터 초기화 후 서버에서 다시 가져오기)
  export const forceSync = async (userId, progressCallback = () => {}) => {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      // 로컬 스토어 초기화
      await indexedDBUtils.clearStore(SAVED_PLACES_STORE);
      await indexedDBUtils.clearStore(REVIEWS_STORE);
      await indexedDBUtils.clearStore(USER_PREFS_STORE);
      await indexedDBUtils.clearStore('pendingChanges');
      
      // 서버에서 새로운 데이터 가져오기
      return await pullChanges(userId, progressCallback);
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  };
  
  // 동기화 로그 가져오기
  export const getSyncLogs = async (limit = 50) => {
    try {
      const logs = await indexedDBUtils.getAllItems(SYNC_LOG_STORE);
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    } catch (error) {
      console.error('Failed to get sync logs:', error);
      return [];
    }
  };
