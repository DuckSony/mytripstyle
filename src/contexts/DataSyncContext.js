import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import * as syncService from '../services/syncService';
import { toast } from 'react-toastify';

// 초기 상태 설정
const initialState = {
  isSyncing: false,
  lastSyncTime: null,
  pendingChanges: 0,
  syncErrors: [],
  syncProgress: 0,
};

// 컨텍스트 생성
const DataSyncContext = createContext();

// DataSync 컨텍스트 훅
export const useDataSync = () => {
  const context = useContext(DataSyncContext);
  if (!context) {
    throw new Error('useDataSync must be used within a DataSyncProvider');
  }
  return context;
};

// Provider 컴포넌트
export const DataSyncProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { isOnline } = useNetwork();
    const [syncState, setSyncState] = useState(initialState);
    const [syncQueue, setSyncQueue] = useState([]);
  
    // 동기화 상태 업데이트 함수
    const updateSyncState = useCallback((updates) => {
      setSyncState(prev => ({ ...prev, ...updates }));
    }, []);
  
    // 동기화 큐에 아이템 추가
    const addToSyncQueue = useCallback((item) => {
      setSyncQueue(prev => [...prev, { ...item, timestamp: Date.now() }]);
      updateSyncState({ pendingChanges: syncQueue.length + 1 });
    }, [syncQueue, updateSyncState]);
  
    // 동기화 큐에서 아이템 제거
    const removeFromSyncQueue = useCallback((itemId) => {
      setSyncQueue(prev => prev.filter(item => item.id !== itemId));
      updateSyncState({ pendingChanges: syncQueue.length - 1 });
    }, [syncQueue, updateSyncState]);

   // 데이터 동기화 시작
  const startSync = useCallback(async () => {
    if (!isAuthenticated || !isOnline || syncState.isSyncing) return;
    
    try {
      updateSyncState({ isSyncing: true, syncProgress: 0, syncErrors: [] });
      
      // 서버로 로컬 변경사항 전송
      if (syncQueue.length > 0) {
        await syncService.pushChanges(syncQueue, (progress) => {
          updateSyncState({ syncProgress: progress * 50 }); // 전체 진행도의 절반은 푸시
        });
      }
      
      // 서버에서 최신 데이터 가져오기
      await syncService.pullChanges(user.uid, (progress) => {
        updateSyncState({ syncProgress: 50 + progress * 50 }); // 나머지 절반은 풀
      });
      
      updateSyncState({ 
        isSyncing: false, 
        lastSyncTime: new Date().toISOString(), 
        pendingChanges: 0,
        syncProgress: 100 
      });
      
      setSyncQueue([]);
      
    } catch (error) {
      console.error('Sync failed:', error);
      updateSyncState({ 
        isSyncing: false, 
        syncProgress: 0,
        syncErrors: [...syncState.syncErrors, error.message] 
      });
      toast.error('동기화에 실패했습니다. 다시 시도해주세요.');
    }
  }, [isAuthenticated, isOnline, syncState.isSyncing, syncState.syncErrors, syncQueue, updateSyncState, user]);
  
 // 온라인 상태 변경 시 자동 동기화
 useEffect(() => {
    if (isOnline && syncQueue.length > 0 && isAuthenticated) {
      startSync();
    }
  }, [isOnline, syncQueue.length, isAuthenticated, startSync]);

  // 주기적 동기화 (15분마다)
  useEffect(() => {
    if (!isAuthenticated || !isOnline) return;
    
    const syncInterval = setInterval(() => {
      startSync();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(syncInterval);
  }, [isAuthenticated, isOnline, startSync]);

  // 초기 마운트 시 동기화
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      startSync();
    }
  }, [isAuthenticated, isOnline, startSync]);

  // 컨텍스트 값
  const value = {
    ...syncState,
    startSync,
    addToSyncQueue,
    removeFromSyncQueue,
    hasPendingChanges: syncQueue.length > 0,
  };

  return (
    <DataSyncContext.Provider value={value}>
      {children}
    </DataSyncContext.Provider>
  );
};

export default DataSyncContext; 
