// src/services/persistenceService.js

import { saveItem, getItemById, getAllItems, STORES } from '../utils/indexedDBUtils';
import { isOffline } from '../utils/indexedDBUtils';

// 상태 저장 키 접두사
const STATE_KEY_PREFIX = 'app_state_';

// 세션 관련 상수
const SESSION_ID_KEY = 'current_session_id';
const SESSION_DATA_KEY = 'session_data';
const SESSION_TIMESTAMP_KEY = 'session_last_updated';

// 최대 세션 기록 수
const MAX_SESSION_HISTORY = 10;

// 상태 만료 시간 (24시간)
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// 자동 저장 간격 (30초)
const AUTO_SAVE_INTERVAL = 30 * 1000;

// 저장해야 할 컨텍스트 목록
const CONTEXTS_TO_PERSIST = [
  'user',
  'recommendations',
  'savedPlaces',
  'visitHistory',
  'search'
];

// 현재 자동 저장 타이머 ID
let autoSaveTimerId = null;

// 페이지 언로드 이벤트 리스너가 등록되었는지 확인하는 플래그
let unloadListenerRegistered = false;

/**
 * 앱 상태를 저장하는 함수
 * @param {string} stateKey - 상태 식별 키
 * @param {Object} stateData - 저장할 상태 데이터
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export const saveAppState = async (stateKey, stateData) => {
    if (!stateKey || !stateData) {
      console.error('상태 키와 데이터가 필요합니다.');
      return false;
    }
  
    try {
      const timestamp = new Date().toISOString();
      
      // 저장할 데이터에 타임스탬프 추가
      const stateWithMeta = {
        ...stateData,
        updatedAt: timestamp,
        expiresAt: new Date(Date.now() + STATE_EXPIRY_MS).toISOString()
      };
      
      // IndexedDB에 상태 저장
      const fullKey = `${STATE_KEY_PREFIX}${stateKey}`;
      await saveItem(STORES.USER_PROFILES, {
        id: fullKey,
        data: stateWithMeta,
        timestamp
      });
      
      // 로컬 스토리지에도 저장 (백업용)
      try {
        localStorage.setItem(fullKey, JSON.stringify({
          data: stateWithMeta,
          timestamp
        }));
      } catch (localStorageError) {
        // 로컬 스토리지 저장 실패는 치명적이지 않음
        console.warn('로컬 스토리지에 상태 저장 실패:', localStorageError);
      }
      
      return true;
    } catch (error) {
      console.error('앱 상태 저장 오류:', error);
      
      // IndexedDB 저장 실패 시 로컬 스토리지만 사용
      if (isOffline()) {
        try {
          const timestamp = new Date().toISOString();
          const stateWithMeta = {
            ...stateData,
            updatedAt: timestamp,
            expiresAt: new Date(Date.now() + STATE_EXPIRY_MS).toISOString()
          };
          
          const fullKey = `${STATE_KEY_PREFIX}${stateKey}`;
          localStorage.setItem(fullKey, JSON.stringify({
            data: stateWithMeta,
            timestamp,
            _fallback: true
          }));
          
          return true;
        } catch (localStorageError) {
          console.error('로컬 스토리지 폴백 저장 실패:', localStorageError);
        }
      }
      
      return false;
    }
  };
  
  /**
   * 저장된 앱 상태를 불러오는 함수
   * @param {string} stateKey - 상태 식별 키
   * @returns {Promise<Object|null>} 불러온 상태 데이터 또는 null
   */
  export const loadAppState = async (stateKey) => {
    if (!stateKey) {
      console.error('상태 키가 필요합니다.');
      return null;
    }
    
    try {
      const fullKey = `${STATE_KEY_PREFIX}${stateKey}`;
      
      // IndexedDB에서 상태 불러오기
      const storedState = await getItemById(STORES.USER_PROFILES, fullKey);
      
      if (storedState && storedState.data) {
        // 만료 여부 확인
        if (storedState.data.expiresAt && new Date() > new Date(storedState.data.expiresAt)) {
          console.log(`상태 만료됨: ${stateKey}`);
          return null;
        }
        
        return storedState.data;
      }
      
      // IndexedDB에 없는 경우 로컬 스토리지 확인
      const localState = localStorage.getItem(fullKey);
      if (localState) {
        try {
          const parsedState = JSON.parse(localState);
          
          // 만료 여부 확인
          if (parsedState.data && parsedState.data.expiresAt && new Date() > new Date(parsedState.data.expiresAt)) {
            console.log(`로컬 스토리지 상태 만료됨: ${stateKey}`);
            localStorage.removeItem(fullKey);
            return null;
          }
          
          return parsedState.data;
        } catch (parseError) {
          console.warn('로컬 스토리지 상태 파싱 오류:', parseError);
          localStorage.removeItem(fullKey);
        }
      }
      
      return null;
    } catch (error) {
      console.error('앱 상태 불러오기 오류:', error);
      
      // 오류 발생 시 로컬 스토리지만 시도
      try {
        const fullKey = `${STATE_KEY_PREFIX}${stateKey}`;
        const localState = localStorage.getItem(fullKey);
        
        if (localState) {
          const parsedState = JSON.parse(localState);
          
          // 만료 여부 확인
          if (parsedState.data && parsedState.data.expiresAt && new Date() > new Date(parsedState.data.expiresAt)) {
            localStorage.removeItem(fullKey);
            return null;
          }
          
          return parsedState.data;
        }
      } catch (localStorageError) {
        console.error('로컬 스토리지 상태 불러오기 오류:', localStorageError);
      }
      
      return null;
    }
  };

  /**
 * 전체 앱 상태를 저장
 * @param {Object} appContext - 앱 컨텍스트 객체 (여러 컨텍스트 포함)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export const saveFullAppState = async (appContext, userId) => {
    if (!appContext || !userId) {
      console.error('앱 컨텍스트와 사용자 ID가 필요합니다.');
      return false;
    }
    
    try {
      const timestamp = new Date().toISOString();
      
      // 저장할 컨텍스트만 추출
      const stateToPersist = {};
      
      CONTEXTS_TO_PERSIST.forEach(contextKey => {
        if (appContext[contextKey] && typeof appContext[contextKey] === 'object') {
          // 컨텍스트 객체의 상태만 저장 (함수 제외)
          const contextState = {};
          
          Object.keys(appContext[contextKey]).forEach(key => {
            const value = appContext[contextKey][key];
            if (key !== 'dispatch' && typeof value !== 'function') {
              contextState[key] = value;
            }
          });
          
          stateToPersist[contextKey] = contextState;
        }
      });
      
      // 세션 정보 추가
      const sessionId = getCurrentSessionId() || generateSessionId();
      stateToPersist._session = {
        id: sessionId,
        timestamp,
        userId
      };
      
      // 앱 상태 저장
      const stateKey = `user_${userId}`;
      const result = await saveAppState(stateKey, stateToPersist);
      
      // 저장 성공 시 세션 ID 업데이트
      if (result) {
        localStorage.setItem(SESSION_ID_KEY, sessionId);
        localStorage.setItem(SESSION_TIMESTAMP_KEY, timestamp);
      }
      
      return result;
    } catch (error) {
      console.error('전체 앱 상태 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 저장된 앱 상태를 불러옴
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object|null>} 불러온 앱 상태 또는 null
   */
  export const loadFullAppState = async (userId) => {
    if (!userId) {
      console.error('사용자 ID가 필요합니다.');
      return null;
    }
    
    try {
      const stateKey = `user_${userId}`;
      const savedState = await loadAppState(stateKey);
      
      if (!savedState) {
        return null;
      }
      
      // 세션 정보 업데이트
      if (savedState._session) {
        localStorage.setItem(SESSION_ID_KEY, savedState._session.id);
        localStorage.setItem(SESSION_TIMESTAMP_KEY, savedState._session.timestamp);
      }
      
      return savedState;
    } catch (error) {
      console.error('앱 상태 불러오기 오류:', error);
      return null;
    }
  };
  
  /**
   * 특정 컨텍스트의 상태만 저장
   * @param {string} contextName - 컨텍스트 이름
   * @param {Object} contextState - 저장할 컨텍스트 상태
   * @param {string} userId - 사용자 ID
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  export const saveContextState = async (contextName, contextState, userId) => {
    if (!contextName || !contextState || !userId) {
      console.error('컨텍스트 이름, 상태 및 사용자 ID가 필요합니다.');
      return false;
    }
    
    if (!CONTEXTS_TO_PERSIST.includes(contextName)) {
      console.warn(`컨텍스트 '${contextName}'는 지속성을 위해 등록되지 않았습니다.`);
    }
    
    try {
      // 기존 상태 불러오기
      const stateKey = `user_${userId}`;
      const existingState = await loadAppState(stateKey) || {};
      
      // 새 컨텍스트 상태로 업데이트
      const contextDataToSave = {};
      
      // 함수가 아닌 값만 저장
      Object.keys(contextState).forEach(key => {
        if (key !== 'dispatch' && typeof contextState[key] !== 'function') {
          contextDataToSave[key] = contextState[key];
        }
      });
      
      const updatedState = {
        ...existingState,
        [contextName]: contextDataToSave,
        _lastUpdated: new Date().toISOString()
      };
      
      return await saveAppState(stateKey, updatedState);
    } catch (error) {
      console.error(`컨텍스트 '${contextName}' 상태 저장 오류:`, error);
      return false;
    }
  };
  
  /**
   * 특정 컨텍스트의 상태 불러오기
   * @param {string} contextName - 컨텍스트 이름
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object|null>} 불러온 컨텍스트 상태 또는 null
   */
  export const loadContextState = async (contextName, userId) => {
    if (!contextName || !userId) {
      console.error('컨텍스트 이름과 사용자 ID가 필요합니다.');
      return null;
    }
    
    try {
      const stateKey = `user_${userId}`;
      const savedState = await loadAppState(stateKey);
      
      if (!savedState || !savedState[contextName]) {
        return null;
      }
      
      return savedState[contextName];
    } catch (error) {
      console.error(`컨텍스트 '${contextName}' 상태 불러오기 오류:`, error);
      return null;
    }
  };

  /**
 * 현재 세션 ID 가져오기
 * @returns {string|null} 현재 세션 ID 또는 null
 */
export const getCurrentSessionId = () => {
    try {
      return localStorage.getItem(SESSION_ID_KEY);
    } catch (error) {
      console.warn('세션 ID 가져오기 오류:', error);
      return null;
    }
  };
  
  /**
   * 새 세션 ID 생성
   * @returns {string} 생성된 세션 ID
   */
  export const generateSessionId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `session_${timestamp}_${random}`;
  };
  
  /**
   * 세션 데이터 저장
   * @param {Object} sessionData - 저장할 세션 데이터
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  export const saveSessionData = async (sessionData) => {
    if (!sessionData) {
      console.error('세션 데이터가 필요합니다.');
      return false;
    }
    
    try {
      const sessionId = getCurrentSessionId() || generateSessionId();
      const timestamp = new Date().toISOString();
      
      // 세션 메타데이터 추가
      const dataToSave = {
        ...sessionData,
        id: sessionId,
        timestamp,
        updatedAt: timestamp
      };
      
      // 세션 히스토리 가져오기
      const sessionHistoryString = localStorage.getItem(SESSION_DATA_KEY);
      let sessionHistory = [];
      
      if (sessionHistoryString) {
        try {
          sessionHistory = JSON.parse(sessionHistoryString);
          if (!Array.isArray(sessionHistory)) {
            sessionHistory = [];
          }
        } catch (parseError) {
          console.warn('세션 히스토리 파싱 오류, 새로 초기화합니다:', parseError);
        }
      }
      
      // 현재 세션 데이터 찾기
      const existingSessionIndex = sessionHistory.findIndex(s => s.id === sessionId);
      
      if (existingSessionIndex >= 0) {
        // 기존 세션 업데이트
        sessionHistory[existingSessionIndex] = dataToSave;
      } else {
        // 새 세션 추가
        sessionHistory.push(dataToSave);
        
        // 최대 개수 유지
        if (sessionHistory.length > MAX_SESSION_HISTORY) {
          sessionHistory = sessionHistory.slice(-MAX_SESSION_HISTORY);
        }
      }
      
      // 세션 히스토리 저장
      localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(sessionHistory));
      localStorage.setItem(SESSION_ID_KEY, sessionId);
      localStorage.setItem(SESSION_TIMESTAMP_KEY, timestamp);
      
      return true;
    } catch (error) {
      console.error('세션 데이터 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 현재 세션 데이터 불러오기
   * @returns {Object|null} 현재 세션 데이터 또는 null
   */
  export const loadCurrentSessionData = () => {
    try {
      const sessionId = getCurrentSessionId();
      
      if (!sessionId) {
        return null;
      }
      
      const sessionHistoryString = localStorage.getItem(SESSION_DATA_KEY);
      
      if (!sessionHistoryString) {
        return null;
      }
      
      const sessionHistory = JSON.parse(sessionHistoryString);
      
      if (!Array.isArray(sessionHistory)) {
        return null;
      }
      
      return sessionHistory.find(session => session.id === sessionId) || null;
    } catch (error) {
      console.error('현재 세션 데이터 불러오기 오류:', error);
      return null;
    }
  };
  
  /**
   * 세션 종료 처리
   * @param {boolean} clearData - 세션 데이터 삭제 여부
   * @returns {boolean} 성공 여부
   */
  export const endSession = (clearData = false) => {
    try {
      if (clearData) {
        localStorage.removeItem(SESSION_ID_KEY);
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);
        localStorage.removeItem(SESSION_DATA_KEY);
      } else {
        // 세션은 종료하지만 데이터는 유지
        localStorage.removeItem(SESSION_ID_KEY);
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);
      }
      
      return true;
    } catch (error) {
      console.error('세션 종료 오류:', error);
      return false;
    }
  };

  /**
 * 자동 저장 시작
 * @param {Object} appContext - 앱 컨텍스트 객체
 * @param {string} userId - 사용자 ID
 * @returns {boolean} 성공 여부
 */
export const startAutoSave = (appContext, userId) => {
    if (!appContext || !userId) {
      console.error('앱 컨텍스트와 사용자 ID가 필요합니다.');
      return false;
    }
    
    // 이미 실행 중인 타이머 정리
    if (autoSaveTimerId) {
      clearInterval(autoSaveTimerId);
    }
    
    // 페이지 언로드 이벤트 리스너 등록
    if (!unloadListenerRegistered && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        saveFullAppState(appContext, userId);
      });
      
      unloadListenerRegistered = true;
    }
    
    // 자동 저장 타이머 시작
    autoSaveTimerId = setInterval(() => {
      saveFullAppState(appContext, userId);
    }, AUTO_SAVE_INTERVAL);
    
    return true;
  };
  
  /**
   * 자동 저장 중지
   * @returns {boolean} 성공 여부
   */
  export const stopAutoSave = () => {
    if (autoSaveTimerId) {
      clearInterval(autoSaveTimerId);
      autoSaveTimerId = null;
      return true;
    }
    
    return false;
  };
  
  /**
   * 앱 시작 시 상태 복원
   * @param {Object} appContext - 앱 컨텍스트 객체
   * @param {string} userId - 사용자 ID
   * @param {function} onStateRestored - 상태 복원 후 콜백
   * @returns {Promise<boolean>} 복원 성공 여부
   */
  export const restoreAppOnStartup = async (appContext, userId, onStateRestored) => {
    if (!appContext || !userId) {
      console.error('앱 컨텍스트와 사용자 ID가 필요합니다.');
      return false;
    }
    
    try {
      console.log('앱 상태 복원 시작...');
      
      // 저장된 상태 불러오기
      const savedState = await loadFullAppState(userId);
      
      if (!savedState) {
        console.log('저장된 상태가 없습니다.');
        return false;
      }
      
      console.log('저장된 상태 불러옴:', Object.keys(savedState));
      
      // 복원할 컨텍스트 처리
      const restoredContexts = [];
      
      for (const contextName of CONTEXTS_TO_PERSIST) {
        if (savedState[contextName] && appContext[contextName]) {
          // 컨텍스트에 restore 함수가 있으면 호출
          if (appContext[contextName].restore && typeof appContext[contextName].restore === 'function') {
            appContext[contextName].restore(savedState[contextName]);
            restoredContexts.push(contextName);
          }
          // 아니면 setState 함수 찾아서 호출
          else if (appContext[contextName].setState && typeof appContext[contextName].setState === 'function') {
            appContext[contextName].setState(savedState[contextName]);
            restoredContexts.push(contextName);
          }
        }
      }
      
      console.log('복원된 컨텍스트:', restoredContexts);
      
      // 자동 저장 시작
      startAutoSave(appContext, userId);
      
      // 콜백 실행
      if (onStateRestored && typeof onStateRestored === 'function') {
        onStateRestored(savedState, restoredContexts);
      }
      
      return true;
    } catch (error) {
      console.error('앱 상태 복원 오류:', error);
      return false;
    }
  };

 /**
 * 만료된 상태 데이터 정리
 * @returns {Promise<Object>} 정리 결과
 */
export const cleanupExpiredStates = async () => {
    try {
      let cleanedCount = 0;
      const now = new Date();
      
      // IndexedDB에서 불러오기
      const allStates = await getAllItems(STORES.USER_PROFILES);
      const stateItemsToRemove = [];
      
      for (const stateItem of allStates) {
        if (stateItem.id.startsWith(STATE_KEY_PREFIX) && 
            stateItem.data && stateItem.data.expiresAt && 
            now > new Date(stateItem.data.expiresAt)) {
          stateItemsToRemove.push(stateItem.id);
        }
      }
      
      // IndexedDB에서 만료된 항목 삭제
      for (const stateId of stateItemsToRemove) {
        try {
          await saveItem(STORES.USER_PROFILES, {
            id: stateId,
            _deleted: true,
            deletedAt: new Date().toISOString()
          });
          cleanedCount++;
        } catch (deleteError) {
          console.warn(`상태 항목 삭제 오류 (${stateId}):`, deleteError);
        }
      }
      
      // 로컬 스토리지 정리
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(STATE_KEY_PREFIX)) {
            try {
              const stateData = JSON.parse(localStorage.getItem(key));
              if (stateData.data && stateData.data.expiresAt && 
                  now > new Date(stateData.data.expiresAt)) {
                localStorage.removeItem(key);
                cleanedCount++;
              }
            } catch (parseError) {
              // 파싱 오류가 발생한 항목은 손상된 것으로 간주하고 삭제
              localStorage.removeItem(key);
              cleanedCount++;
            }
          }
        });
      } catch (localStorageError) {
        console.warn('로컬 스토리지 정리 오류:', localStorageError);
      }
      
      return {
        success: true,
        cleanedCount,
        message: `${cleanedCount}개의 만료된 상태 항목이 정리되었습니다.`
      };
    } catch (error) {
      console.error('상태 정리 중 오류:', error);
      return {
        success: false,
        error: error.message,
        cleanedCount: 0
      };
    }
  };
  
  /**
   * 사용자 데이터 완전 삭제
   * @param {string} userId - 사용자 ID
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  export const purgeUserData = async (userId) => {
    if (!userId) {
      console.error('사용자 ID가 필요합니다.');
      return false;
    }
    
    try {
      // 저장된 상태 삭제
      const stateKey = `user_${userId}`;
      const fullKey = `${STATE_KEY_PREFIX}${stateKey}`;
      
      await saveItem(STORES.USER_PROFILES, {
        id: fullKey,
        _deleted: true,
        deletedAt: new Date().toISOString()
      });
      
      // 로컬 스토리지에서 삭제
      localStorage.removeItem(fullKey);
      
      // 세션 데이터에서 사용자 관련 세션 제거
      try {
        const sessionHistoryString = localStorage.getItem(SESSION_DATA_KEY);
        
        if (sessionHistoryString) {
          const sessionHistory = JSON.parse(sessionHistoryString);
          
          if (Array.isArray(sessionHistory)) {
            const filteredHistory = sessionHistory.filter(
              session => !session.userId || session.userId !== userId
            );
            
            localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(filteredHistory));
          }
        }
      } catch (sessionError) {
        console.warn('세션 데이터 정리 오류:', sessionError);
      }
      
      // 현재 세션 종료 (사용자가 로그아웃하는 경우)
      const currentSessionData = loadCurrentSessionData();
      if (currentSessionData && currentSessionData.userId === userId) {
        endSession(true);
      }
      
      return true;
    } catch (error) {
      console.error('사용자 데이터 삭제 오류:', error);
      return false;
    }
  };
  
  /**
   * 앱 상태 내보내기
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object|null>} 내보낼 상태 데이터 또는 null
   */
  export const exportAppState = async (userId) => {
    if (!userId) {
      console.error('사용자 ID가 필요합니다.');
      return null;
    }
    
    try {
      const savedState = await loadFullAppState(userId);
      
      if (!savedState) {
        return null;
      }
      
      // 메타데이터 추가
      const exportData = {
        data: savedState,
        metadata: {
          exportedAt: new Date().toISOString(),
          userId,
          version: '1.0'
        }
      };
      
      return exportData;
    } catch (error) {
      console.error('앱 상태 내보내기 오류:', error);
      return null;
    }
  };
  
  /**
   * 앱 상태 가져오기
   * @param {Object} importData - 가져올 상태 데이터
   * @param {string} userId - 사용자 ID
   * @returns {Promise<boolean>} 가져오기 성공 여부
   */
  export const importAppState = async (importData, userId) => {
    if (!importData || !importData.data || !userId) {
      console.error('가져올 데이터와 사용자 ID가 필요합니다.');
      return false;
    }
    
    try {
      // 메타데이터 검증
      if (!importData.metadata || !importData.metadata.version) {
        console.error('유효하지 않은 가져오기 데이터 형식');
        return false;
      }
      
      // 버전 호환성 확인
      if (importData.metadata.version !== '1.0') {
        console.warn(`지원되지 않는 버전: ${importData.metadata.version}`);
        // 추가적인 버전 호환성 처리 로직
      }
      
      // 가져온 데이터에 현재 사용자 ID 적용
      const dataToSave = {
        ...importData.data,
        _imported: true,
        _importedAt: new Date().toISOString()
      };
      
      // 세션 정보 업데이트
      if (dataToSave._session) {
        dataToSave._session.userId = userId;
        dataToSave._session.importedFrom = dataToSave._session.id;
        dataToSave._session.id = generateSessionId();
      }
      
      // 상태 저장
      const stateKey = `user_${userId}`;
      return await saveAppState(stateKey, dataToSave);
    } catch (error) {
      console.error('앱 상태 가져오기 오류:', error);
      return false;
    }
  };
  
  /**
   * 앱 상태 진단 및 상태 보고서 생성
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 상태 진단 보고서
   */
  export const diagnoseAppState = async (userId) => {
    if (!userId) {
      console.error('사용자 ID가 필요합니다.');
      return {
        success: false,
        error: '사용자 ID가 필요합니다.'
      };
    }
    
    try {
      const diagnosis = {
        timestamp: new Date().toISOString(),
        userId,
        localStorage: {
          available: false,
          size: 0,
          items: 0,
          appStateItems: 0
        },
        indexedDB: {
          available: false,
          appStateAvailable: false
        },
        session: {
          active: false,
          id: null,
          lastUpdated: null
        },
        contexts: {}
      };
      
      // 로컬 스토리지 진단
      try {
        const testKey = `test_${Date.now()}`;
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        diagnosis.localStorage.available = true;
        diagnosis.localStorage.items = localStorage.length;
        
        // 로컬 스토리지 사용량 계산
        let totalSize = 0;
        let appStateItemCount = 0;
        
        Object.keys(localStorage).forEach(key => {
          const value = localStorage.getItem(key);
          totalSize += (key.length + value.length) * 2; // UTF-16 문자열은 2바이트
          
          if (key.startsWith(STATE_KEY_PREFIX)) {
            appStateItemCount++;
          }
        });
        
        diagnosis.localStorage.size = Math.round(totalSize / 1024); // KB 단위
        diagnosis.localStorage.appStateItems = appStateItemCount;
      } catch (localStorageError) {
        console.warn('로컬 스토리지 진단 오류:', localStorageError);
      }
      
      // IndexedDB 진단
      try {
        diagnosis.indexedDB.available = typeof window.indexedDB !== 'undefined';
        
        if (diagnosis.indexedDB.available) {
          const stateKey = `user_${userId}`;
          const fullKey = `${STATE_KEY_PREFIX}${stateKey}`;
          const storedState = await getItemById(STORES.USER_PROFILES, fullKey);
          
          diagnosis.indexedDB.appStateAvailable = !!storedState;
          
          if (storedState) {
            diagnosis.indexedDB.lastUpdated = storedState.timestamp;
          }
        }
      } catch (indexedDBError) {
        console.warn('IndexedDB 진단 오류:', indexedDBError);
      }
      
      // 세션 진단
      try {
        const sessionId = getCurrentSessionId();
        const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
        
        diagnosis.session.id = sessionId;
        diagnosis.session.active = !!sessionId;
        diagnosis.session.lastUpdated = sessionTimestamp;
      } catch (sessionError) {
        console.warn('세션 진단 오류:', sessionError);
      }
      
      // 컨텍스트 상태 진단
      const savedState = await loadFullAppState(userId);
      
      if (savedState) {
        for (const contextName of CONTEXTS_TO_PERSIST) {
          diagnosis.contexts[contextName] = {
            available: !!savedState[contextName],
            keys: savedState[contextName] ? Object.keys(savedState[contextName]) : [],
            updatedAt: savedState[contextName]?.updatedAt || null
          };
        }
      }
      
      return {
        success: true,
        diagnosis
      };
    } catch (error) {
      console.error('앱 상태 진단 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  // 내보내기
  export {
    STATE_KEY_PREFIX,
    SESSION_ID_KEY,
    SESSION_DATA_KEY,
    SESSION_TIMESTAMP_KEY,
    CONTEXTS_TO_PERSIST,
    MAX_SESSION_HISTORY,
    STATE_EXPIRY_MS,
    AUTO_SAVE_INTERVAL
  }; 
