import { act } from 'react-dom/test-utils';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import * as indexedDBUtils from './indexedDBUtils';

/**
 * 데이터 동기화 테스트를 위한 유틸리티 함수 모음
 */

// 테스트를 위한 대기 함수
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// React 컴포넌트 테스트 시 상태 업데이트 대기
export const waitForStateUpdate = async (ms = 0) => {
  await act(async () => {
    await wait(ms);
  });
};

// IndexedDB 데이터베이스 초기화
export const setupTestDB = async () => {
  try {
    // 테스트용 DB 이름
    const TEST_DB_NAME = 'mytripstyle-test-db';
    
    // 기존 테스트 DB 삭제
    if (window.indexedDB.databases) {
      const databases = await window.indexedDB.databases();
      const testDB = databases.find(db => db.name === TEST_DB_NAME);
      if (testDB) {
        await window.indexedDB.deleteDatabase(TEST_DB_NAME);
      }
    }
    
    // 테스트용 DB 스토어 생성
    await indexedDBUtils.initializeDB(TEST_DB_NAME, [
      'places',
      'savedPlaces',
      'reviews',
      'userPreferences',
      'pendingChanges',
      'syncLog',
      'appState'
    ]);
    
    return TEST_DB_NAME;
  } catch (error) {
    console.error('Failed to setup test DB:', error);
    throw error;
  }
};

// 테스트용 Firebase 문서 생성
export const createTestDocument = async (collectionName, data) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        isTestData: true // 테스트 문서 표시
      });
      
      return {
        id: docRef.id,
        ...data
      };
    } catch (error) {
      console.error(`Failed to create test document in ${collectionName}:`, error);
      throw error;
    }
  };
  
  // 테스트용 문서 삭제
  export const cleanupTestDocuments = async (collectionName) => {
    try {
      const q = query(
        collection(db, collectionName),
        where('isTestData', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(document => 
        deleteDoc(doc(db, collectionName, document.id))
      );
      
      await Promise.all(deletePromises);
      
      return deletePromises.length;
    } catch (error) {
      console.error(`Failed to cleanup test documents in ${collectionName}:`, error);
      throw error;
    }
  };

  // 네트워크 연결 시뮬레이션
export const simulateNetwork = (isOnline) => {
    // 원래 상태 저장
    const originalOnline = window.navigator.onLine;
    
    // navigator.onLine 속성 수정 (테스트용)
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: isOnline,
      writable: true
    });
    
    // 네트워크 이벤트 발생
    if (isOnline) {
      window.dispatchEvent(new Event('online'));
    } else {
      window.dispatchEvent(new Event('offline'));
    }
    
    // 정리 함수 반환
    return () => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: originalOnline,
        writable: true
      });
    };
  };
  
  // UI 동기화 테스트를 위한 가짜 데이터 추가
  export const addFakeDataToIndexedDB = async (storeName, items) => {
    if (!Array.isArray(items)) {
      items = [items];
    }
    
    try {
      for (const item of items) {
        await indexedDBUtils.addItem(storeName, {
          ...item,
          id: item.id || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          isTestData: true
        });
      }
      
      return items.length;
    } catch (error) {
      console.error(`Failed to add fake data to ${storeName}:`, error);
      throw error;
    }
  };

  // IndexedDB 스토어에서 데이터 검증
export const verifyDataInIndexedDB = async (storeName, expectedCount, filterFn = null) => {
    try {
      const items = await indexedDBUtils.getAllItems(storeName);
      
      const filteredItems = filterFn ? items.filter(filterFn) : items;
      
      return {
        success: filteredItems.length === expectedCount,
        expected: expectedCount,
        actual: filteredItems.length,
        items: filteredItems
      };
    } catch (error) {
      console.error(`Failed to verify data in ${storeName}:`, error);
      throw error;
    }
  };
  
  // 데이터 동기화 지연 시간 테스트 (성능 측정)
  export const measureSyncTime = async (syncFunction) => {
    const startTime = performance.now();
    
    try {
      const result = await syncFunction();
      const endTime = performance.now();
      
      return {
        success: true,
        result,
        executionTime: endTime - startTime,
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        error,
        executionTime: endTime - startTime,
      };
    }
  };
  
  // 테스트 실행 전후 모든 IndexedDB 스토어 정리
  export const cleanupAllTestData = async () => {
    const stores = [
      'places',
      'savedPlaces',
      'reviews',
      'userPreferences',
      'pendingChanges',
      'syncLog',
      'appState'
    ];
    
    // IndexedDB 정리
    for (const store of stores) {
      await indexedDBUtils.clearStore(store);
    }
    
    // Firebase 정리
    const collections = [
      'places',
      'savedPlaces',
      'reviews',
      'userPreferences'
    ];
    
    for (const collection of collections) {
      await cleanupTestDocuments(collection);
    }
    
    return true;
  };
  
  // 객체를 변수에 먼저 할당
const testUtils = {
    wait,
    waitForStateUpdate,
    setupTestDB,
    createTestDocument,
    cleanupTestDocuments,
    simulateNetwork,
    addFakeDataToIndexedDB,
    verifyDataInIndexedDB,
    measureSyncTime,
    cleanupAllTestData
  };
  
  // 그 후 변수를 export
  export default testUtils;
