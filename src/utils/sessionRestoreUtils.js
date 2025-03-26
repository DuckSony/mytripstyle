// src/utils/sessionRestoreUtils.js

import {
    getCurrentSessionId,
    generateSessionId,
    loadCurrentSessionData,
    saveSessionData
  } from '../services/persistenceService';
  
  // 세션 복원 관련 상수
  const SESSION_RESTORE_KEY = 'session_restore_state';
  const NAVIGATION_STATE_KEY = 'navigation_state';
  const SCROLL_POSITIONS_KEY = 'scroll_positions';
  const UI_STATE_KEY = 'ui_state';
  const FORM_DATA_KEY = 'form_data';
  
  // 세션 만료 시간 (2시간)
  const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;
  
  // 마지막으로 저장된 경로
  let lastSavedPath = null;
  
  // 세션 복원 상태
  let isRestoreInProgress = false;

  /**
 * 현재 세션 상태 저장
 * @param {Object} sessionState - 저장할 세션 상태
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export const saveSessionState = async (sessionState) => {
    if (!sessionState) {
      console.error('저장할 세션 상태가 필요합니다.');
      return false;
    }
    
    try {
      // 세션 ID 확인 또는 생성
      const sessionId = getCurrentSessionId() || generateSessionId();
      
      // 저장할 상태 데이터 준비
      const stateToSave = {
        ...sessionState,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString()
      };
      
      // 로컬 스토리지에 저장
      localStorage.setItem(SESSION_RESTORE_KEY, JSON.stringify({
        sessionId,
        data: stateToSave
      }));
      
      // 세션 데이터 업데이트
      const currentSessionData = loadCurrentSessionData() || {};
      const updatedSessionData = {
        ...currentSessionData,
        id: sessionId,
        restoreState: stateToSave
      };
      
      await saveSessionData(updatedSessionData);
      
      return true;
    } catch (error) {
      console.error('세션 상태 저장 오류:', error);
      
      // 로컬 스토리지만 사용하여 재시도
      try {
        const sessionId = getCurrentSessionId() || generateSessionId();
        
        const stateToSave = {
          ...sessionState,
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString()
        };
        
        localStorage.setItem(SESSION_RESTORE_KEY, JSON.stringify({
          sessionId,
          data: stateToSave,
          _fallback: true
        }));
        
        return true;
      } catch (fallbackError) {
        console.error('로컬 스토리지 폴백 오류:', fallbackError);
        return false;
      }
    }
  };
  
  /**
   * 저장된 세션 상태 불러오기
   * @returns {Promise<Object|null>} 불러온 세션 상태 또는 null
   */
  export const loadSessionState = async () => {
    try {
      // 복원 진행 중 표시
      isRestoreInProgress = true;
      
      // 로컬 스토리지에서 세션 상태 확인
      const sessionRestoreData = localStorage.getItem(SESSION_RESTORE_KEY);
      
      if (!sessionRestoreData) {
        isRestoreInProgress = false;
        return null;
      }
      
      try {
        const { sessionId, data } = JSON.parse(sessionRestoreData);
        
        // 유효성 및 만료 여부 확인
        if (!data || !sessionId) {
          localStorage.removeItem(SESSION_RESTORE_KEY);
          isRestoreInProgress = false;
          return null;
        }
        
        // 만료 확인
        if (data.expiresAt && new Date() > new Date(data.expiresAt)) {
          console.log('세션 상태가 만료되었습니다.');
          localStorage.removeItem(SESSION_RESTORE_KEY);
          isRestoreInProgress = false;
          return null;
        }
        
        // 현재 세션 ID와 비교
        const currentSessionId = getCurrentSessionId();
        if (currentSessionId && currentSessionId !== sessionId) {
          console.log('다른 세션에서의 상태입니다.');
          // 다른 세션의 상태도 복원 가능하게 함
        }
        
        // 세션 데이터에서 추가 정보 가져오기
        try {
          const sessionData = loadCurrentSessionData();
          
          // 세션 데이터에 추가 상태 정보가 있으면 병합
          if (sessionData && sessionData.restoreState && sessionData.id === sessionId) {
            data._fromSessionData = true;
          }
        } catch (sessionDataError) {
          console.warn('세션 데이터 로드 오류:', sessionDataError);
        }
        
        isRestoreInProgress = false;
        return data;
      } catch (parseError) {
        console.error('세션 상태 파싱 오류:', parseError);
        localStorage.removeItem(SESSION_RESTORE_KEY);
        isRestoreInProgress = false;
        return null;
      }
    } catch (error) {
      console.error('세션 상태 불러오기 오류:', error);
      isRestoreInProgress = false;
      return null;
    }
  };
  
  /**
   * 세션 복원 프로세스 완료 후 정리
   * @returns {Promise<boolean>} 정리 성공 여부
   */
  export const completeSessionRestore = async () => {
    try {
      // 복원 완료 후 상태 삭제
      localStorage.removeItem(SESSION_RESTORE_KEY);
      
      // 세션 데이터에서 복원 상태 정보 제거
      const sessionData = loadCurrentSessionData();
      
      if (sessionData) {
        // restoreState 필드만 제거
        const { restoreState, ...restSessionData } = sessionData;
        
        // 업데이트된 세션 데이터 저장
        await saveSessionData({
          ...restSessionData,
          lastRestoreCompleted: new Date().toISOString()
        });
      }
      
      return true;
    } catch (error) {
      console.error('세션 복원 완료 처리 오류:', error);
      return false;
    } finally {
      // 복원 진행 상태 초기화
      isRestoreInProgress = false;
    }
  };
  
  /**
   * 세션 복원 프로세스가 진행 중인지 확인
   * @returns {boolean} 복원 진행 중 여부
   */
  export const isRestoringSession = () => {
    return isRestoreInProgress;
  };

  /**
 * 내비게이션 상태 저장
 * @param {Object} routeState - 현재 라우트 상태
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export const saveNavigationState = async (routeState) => {
    if (!routeState) {
      return false;
    }
    
    try {
      // 경로가 변경된 경우에만 저장
      if (routeState.path === lastSavedPath) {
        return true;
      }
      
      lastSavedPath = routeState.path;
      
      // 세션 상태 불러오기 또는 초기화
      const currentState = await loadSessionState() || {};
      
      // 내비게이션 상태 업데이트
      const updatedState = {
        ...currentState,
        [NAVIGATION_STATE_KEY]: {
          path: routeState.path,
          params: routeState.params || {},
          query: routeState.query || {},
          timestamp: new Date().toISOString()
        }
      };
      
      return await saveSessionState(updatedState);
    } catch (error) {
      console.error('내비게이션 상태 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 스크롤 위치 저장
   * @param {string} routePath - 현재 라우트 경로
   * @param {number} scrollTop - 스크롤 위치
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  export const saveScrollPosition = async (routePath, scrollTop) => {
    if (!routePath) {
      return false;
    }
    
    try {
      // 세션 상태 불러오기 또는 초기화
      const currentState = await loadSessionState() || {};
      
      // 스크롤 위치 정보 초기화 또는 가져오기
      const scrollPositions = currentState[SCROLL_POSITIONS_KEY] || {};
      
      // 스크롤 위치 업데이트
      const updatedScrollPositions = {
        ...scrollPositions,
        [routePath]: {
          position: scrollTop,
          timestamp: new Date().toISOString()
        }
      };
      
      // 세션 상태 업데이트
      const updatedState = {
        ...currentState,
        [SCROLL_POSITIONS_KEY]: updatedScrollPositions
      };
      
      return await saveSessionState(updatedState);
    } catch (error) {
      console.error('스크롤 위치 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 저장된 스크롤 위치 가져오기
   * @param {string} routePath - 라우트 경로
   * @returns {Promise<number|null>} 스크롤 위치 또는 null
   */
  export const getScrollPosition = async (routePath) => {
    if (!routePath) {
      return null;
    }
    
    try {
      // 세션 상태 불러오기
      const sessionState = await loadSessionState();
      
      if (!sessionState || !sessionState[SCROLL_POSITIONS_KEY]) {
        return null;
      }
      
      const scrollData = sessionState[SCROLL_POSITIONS_KEY][routePath];
      
      if (!scrollData) {
        return null;
      }
      
      return scrollData.position;
    } catch (error) {
      console.error('스크롤 위치 불러오기 오류:', error);
      return null;
    }
  };
  
  /**
   * UI 상태 저장
   * @param {string} componentId - 컴포넌트 ID
   * @param {Object} uiState - UI 상태
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  export const saveUIState = async (componentId, uiState) => {
    if (!componentId || !uiState) {
      return false;
    }
    
    try {
      // 세션 상태 불러오기 또는 초기화
      const currentState = await loadSessionState() || {};
      
      // UI 상태 초기화 또는 가져오기
      const uiStates = currentState[UI_STATE_KEY] || {};
      
      // UI 상태 업데이트
      const updatedUIStates = {
        ...uiStates,
        [componentId]: {
          ...uiState,
          timestamp: new Date().toISOString()
        }
      };
      
      // 세션 상태 업데이트
      const updatedState = {
        ...currentState,
        [UI_STATE_KEY]: updatedUIStates
      };
      
      return await saveSessionState(updatedState);
    } catch (error) {
      console.error('UI 상태 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * UI 상태 불러오기
   * @param {string} componentId - 컴포넌트 ID
   * @returns {Promise<Object|null>} UI 상태 또는 null
   */
  export const getUIState = async (componentId) => {
    if (!componentId) {
      return null;
    }
    
    try {
      // 세션 상태 불러오기
      const sessionState = await loadSessionState();
      
      if (!sessionState || !sessionState[UI_STATE_KEY]) {
        return null;
      }
      
      return sessionState[UI_STATE_KEY][componentId] || null;
    } catch (error) {
      console.error('UI 상태 불러오기 오류:', error);
      return null;
    }
  };
  
  /**
   * 양식 데이터 저장
   * @param {string} formId - 양식 ID
   * @param {Object} formData - 양식 데이터
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  export const saveFormData = async (formId, formData) => {
    if (!formId) {
      return false;
    }
    
    try {
      // 세션 상태 불러오기 또는 초기화
      const currentState = await loadSessionState() || {};
      
      // 양식 데이터 초기화 또는 가져오기
      const formsData = currentState[FORM_DATA_KEY] || {};
      
      // 양식 데이터 업데이트
      const updatedFormsData = {
        ...formsData,
        [formId]: {
          data: formData,
          timestamp: new Date().toISOString()
        }
      };
      
      // 세션 상태 업데이트
      const updatedState = {
        ...currentState,
        [FORM_DATA_KEY]: updatedFormsData
      };
      
      return await saveSessionState(updatedState);
    } catch (error) {
      console.error('양식 데이터 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 양식 데이터 불러오기
   * @param {string} formId - 양식 ID
   * @returns {Promise<Object|null>} 양식 데이터 또는 null
   */
  export const getFormData = async (formId) => {
    if (!formId) {
      return null;
    }
    
    try {
      // 세션 상태 불러오기
      const sessionState = await loadSessionState();
      
      if (!sessionState || !sessionState[FORM_DATA_KEY]) {
        return null;
      }
      
      const formEntry = sessionState[FORM_DATA_KEY][formId];
      
      if (!formEntry) {
        return null;
      }
      
      return formEntry.data;
    } catch (error) {
      console.error('양식 데이터 불러오기 오류:', error);
      return null;
    }
  };

  /**
 * 세션 상태의 무결성 검증
 * @param {Object} sessionState - 검증할 세션 상태
 * @returns {Promise<Object>} 검증 결과
 */
export const validateSessionState = async (sessionState) => {
    if (!sessionState) {
      return {
        valid: false,
        error: '세션 상태가 없습니다.'
      };
    }
    
    try {
      const validationResult = {
        valid: true,
        warnings: [],
        details: {}
      };
      
      // 타임스탬프 확인
      if (!sessionState.timestamp) {
        validationResult.valid = false;
        validationResult.warnings.push('타임스탬프 누락');
      } else {
        const stateTime = new Date(sessionState.timestamp);
        if (isNaN(stateTime.getTime())) {
          validationResult.valid = false;
          validationResult.warnings.push('유효하지 않은 타임스탬프');
        } else {
          // 24시간 이상 지난 상태 확인
          const now = new Date();
          const hoursDiff = (now - stateTime) / (1000 * 60 * 60);
          
          if (hoursDiff > 24) {
            validationResult.warnings.push(`오래된 상태 (${Math.floor(hoursDiff)}시간 전)`);
          }
        }
      }
      
      // 내비게이션 상태 검증
      if (sessionState[NAVIGATION_STATE_KEY]) {
        const navState = sessionState[NAVIGATION_STATE_KEY];
        validationResult.details.navigation = {
          valid: !!navState.path,
          path: navState.path || null
        };
        
        if (!navState.path) {
          validationResult.warnings.push('유효하지 않은 내비게이션 경로');
        }
      }
      
      // 스크롤 위치 데이터 검증
      if (sessionState[SCROLL_POSITIONS_KEY]) {
        const scrollData = sessionState[SCROLL_POSITIONS_KEY];
        const scrollPaths = Object.keys(scrollData);
        
        validationResult.details.scrollPositions = {
          count: scrollPaths.length,
          paths: scrollPaths
        };
      }
      
      // UI 상태 데이터 검증
      if (sessionState[UI_STATE_KEY]) {
        const uiData = sessionState[UI_STATE_KEY];
        const componentIds = Object.keys(uiData);
        
        validationResult.details.uiState = {
          count: componentIds.length,
          components: componentIds
        };
      }
      
      // 양식 데이터 검증
      if (sessionState[FORM_DATA_KEY]) {
        const formData = sessionState[FORM_DATA_KEY];
        const formIds = Object.keys(formData);
        
        validationResult.details.formData = {
          count: formIds.length,
          forms: formIds
        };
      }
      
      return validationResult;
    } catch (error) {
      console.error('세션 상태 검증 오류:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  };
  
  /**
   * 손상된 세션 데이터 복구 시도
   * @param {Object} corruptedState - 손상된 세션 상태
   * @returns {Promise<Object|null>} 복구된 상태 또는 null
   */
  export const attemptStateRecovery = async (corruptedState) => {
    if (!corruptedState) {
      return null;
    }
    
    try {
      const recoveredState = {};
      const now = new Date().toISOString();
      
      // 타임스탬프 복구
      recoveredState.timestamp = corruptedState.timestamp || now;
      
      // 내비게이션 상태 복구
      if (corruptedState[NAVIGATION_STATE_KEY]) {
        const navState = corruptedState[NAVIGATION_STATE_KEY];
        if (navState.path) {
          recoveredState[NAVIGATION_STATE_KEY] = {
            path: navState.path,
            params: navState.params || {},
            query: navState.query || {},
            timestamp: navState.timestamp || now
          };
        }
      }
      
      // 스크롤 위치 복구
      if (corruptedState[SCROLL_POSITIONS_KEY] && typeof corruptedState[SCROLL_POSITIONS_KEY] === 'object') {
        recoveredState[SCROLL_POSITIONS_KEY] = {};
        
        Object.entries(corruptedState[SCROLL_POSITIONS_KEY]).forEach(([path, data]) => {
          if (path && data && typeof data.position === 'number') {
            recoveredState[SCROLL_POSITIONS_KEY][path] = {
              position: data.position,
              timestamp: data.timestamp || now
            };
          }
        });
      }
      
      // UI 상태 복구
      if (corruptedState[UI_STATE_KEY] && typeof corruptedState[UI_STATE_KEY] === 'object') {
        recoveredState[UI_STATE_KEY] = {};
        
        Object.entries(corruptedState[UI_STATE_KEY]).forEach(([componentId, state]) => {
          if (componentId && state && typeof state === 'object') {
            // 함수와 복잡한 객체 제외
            const cleanState = {};
            
            Object.entries(state).forEach(([key, value]) => {
              if (key !== 'timestamp' && typeof value !== 'function' && (
                typeof value === 'string' || 
                typeof value === 'number' || 
                typeof value === 'boolean' || 
                value === null
              )) {
                cleanState[key] = value;
              }
            });
            
            recoveredState[UI_STATE_KEY][componentId] = {
              ...cleanState,
              timestamp: state.timestamp || now
            };
          }
        });
      }
      
      // 양식 데이터 복구
      if (corruptedState[FORM_DATA_KEY] && typeof corruptedState[FORM_DATA_KEY] === 'object') {
        recoveredState[FORM_DATA_KEY] = {};
        
        Object.entries(corruptedState[FORM_DATA_KEY]).forEach(([formId, entry]) => {
          if (formId && entry && entry.data) {
            recoveredState[FORM_DATA_KEY][formId] = {
              data: entry.data,
              timestamp: entry.timestamp || now
            };
          }
        });
      }
      
      // 복구된 상태에 메타데이터 추가
      recoveredState._recovered = true;
      recoveredState._recoveryTimestamp = now;
      
      return recoveredState;
    } catch (error) {
      console.error('상태 복구 시도 오류:', error);
      return null;
    }
  };
  
  /**
   * 기존 세션 상태 병합
   * @param {Object} currentState - 현재 세션 상태
   * @param {Object} newState - 새 세션 상태
   * @returns {Object} 병합된 상태
   */
  export const mergeSessionStates = (currentState, newState) => {
    if (!currentState) return newState;
    if (!newState) return currentState;
    
    try {
      const mergedState = { ...currentState };
      
      // 타임스탬프 업데이트
      mergedState.timestamp = new Date().toISOString();
      
      // 내비게이션 상태 병합 (최신 우선)
      if (newState[NAVIGATION_STATE_KEY]) {
        mergedState[NAVIGATION_STATE_KEY] = newState[NAVIGATION_STATE_KEY];
      }
      
      // 스크롤 위치 병합
      if (newState[SCROLL_POSITIONS_KEY]) {
        const currentScrollPositions = mergedState[SCROLL_POSITIONS_KEY] || {};
        
        mergedState[SCROLL_POSITIONS_KEY] = {
          ...currentScrollPositions,
          ...newState[SCROLL_POSITIONS_KEY]
        };
      }
      
      // UI 상태 병합
      if (newState[UI_STATE_KEY]) {
        const currentUIState = mergedState[UI_STATE_KEY] || {};
        
        mergedState[UI_STATE_KEY] = {
          ...currentUIState
        };
        
        // 컴포넌트별로 병합
        Object.entries(newState[UI_STATE_KEY]).forEach(([componentId, state]) => {
          mergedState[UI_STATE_KEY][componentId] = {
            ...(currentUIState[componentId] || {}),
            ...state,
            timestamp: state.timestamp // 최신 타임스탬프 사용
          };
        });
      }
      
      // 양식 데이터 병합 (최신 우선)
      if (newState[FORM_DATA_KEY]) {
        const currentFormData = mergedState[FORM_DATA_KEY] || {};
        
        mergedState[FORM_DATA_KEY] = {
          ...currentFormData,
          ...newState[FORM_DATA_KEY]
        };
      }
      
      return mergedState;
    } catch (error) {
      console.error('세션 상태 병합 오류:', error);
      return newState || currentState;
    }
  };

  /**
 * 브라우저 새로고침 전 상태 저장
 * @param {Object} state - 저장할 상태
 * @returns {Promise<boolean>} 성공 여부
 */
export const saveStateBeforeUnload = async (state) => {
    if (!state) return false;
    
    try {
      // 페이지 언로드 전 최소한의 상태만 로컬 스토리지에 저장
      const essentialState = {
        timestamp: new Date().toISOString(),
        navigation: state[NAVIGATION_STATE_KEY],
        // 중요한 UI 상태만 저장
        essentialUI: {}
      };
      
      // UI 상태에서 중요한 항목만 선택
      if (state[UI_STATE_KEY]) {
        const importantComponents = ['searchForm', 'mainFilter', 'userPreferences'];
        
        importantComponents.forEach(componentId => {
          if (state[UI_STATE_KEY][componentId]) {
            essentialState.essentialUI[componentId] = state[UI_STATE_KEY][componentId];
          }
        });
      }
      
      // 로컬 스토리지에 직접 저장 (언로드 중에는 IndexedDB 비동기 작업이 완료되지 않을 수 있음)
      localStorage.setItem(
        'before_unload_state',
        JSON.stringify({
          data: essentialState,
          timestamp: essentialState.timestamp
        })
      );
      
      return true;
    } catch (error) {
      console.error('언로드 전 상태 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 브라우저 새로고침 후 상태 복원
   * @returns {Promise<Object|null>} 복원된 상태 또는 null
   */
  export const loadStateAfterRefresh = async () => {
    try {
      // 언로드 전 저장된 상태 확인
      const beforeUnloadState = localStorage.getItem('before_unload_state');
      
      if (!beforeUnloadState) {
        return null;
      }
      
      try {
        const { data, timestamp } = JSON.parse(beforeUnloadState);
        
        // 타임스탬프 확인 (5분 이내만 유효)
        const stateTime = new Date(timestamp);
        const now = new Date();
        const diffMinutes = (now - stateTime) / (1000 * 60);
        
        if (diffMinutes > 5) {
          console.log('새로고침 상태가 만료되었습니다.');
          localStorage.removeItem('before_unload_state');
          return null;
        }
        
        // 세션 상태와 통합
        const sessionState = await loadSessionState() || {};
        
        // 내비게이션 상태 업데이트
        if (data.navigation) {
          sessionState[NAVIGATION_STATE_KEY] = data.navigation;
        }
        
        // 중요 UI 상태 업데이트
        if (data.essentialUI) {
          const uiState = sessionState[UI_STATE_KEY] || {};
          
          Object.entries(data.essentialUI).forEach(([componentId, state]) => {
            uiState[componentId] = state;
          });
          
          sessionState[UI_STATE_KEY] = uiState;
        }
        
        // 사용 후 삭제
        localStorage.removeItem('before_unload_state');
        
        return sessionState;
      } catch (parseError) {
        console.error('새로고침 상태 파싱 오류:', parseError);
        localStorage.removeItem('before_unload_state');
        return null;
      }
    } catch (error) {
      console.error('새로고침 후 상태 불러오기 오류:', error);
      return null;
    }
  };
  
  /**
   * 브라우저 이벤트 리스너 설정
   * @param {function} saveCurrentState - 현재 상태를 저장하는 함수
   * @returns {function} 이벤트 리스너 정리 함수
   */
  export const setupBrowserEventListeners = (saveCurrentState) => {
    if (typeof window === 'undefined' || typeof saveCurrentState !== 'function') {
      return () => {}; // 정리 함수
    }
    
    // 페이지 가시성 변경 처리
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // 페이지가 백그라운드로 전환될 때 상태 저장
      saveCurrentState();
    }
  };
  
  // beforeunload 이벤트 처리
  const handleBeforeUnload = (event) => {
    // 현재 상태 저장
    const state = saveCurrentState();
    
    // 언로드 전 상태 저장
    saveStateBeforeUnload(state);
  };
  
  // pagehide 이벤트 처리 (iOS 사파리 지원)
  const handlePageHide = (event) => {
    // 현재 상태 저장
    const state = saveCurrentState();
    
    // 언로드 전 상태 저장
    saveStateBeforeUnload(state);
  };
  
  // 이벤트 리스너 등록
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);
  
  // 스토리지 이벤트 리스너 (다른 탭에서의 변경 감지)
  const handleStorageChange = (event) => {
    if (event.key === SESSION_RESTORE_KEY) {
      // 다른 탭에서 세션 상태가 변경됨
      console.log('다른 탭에서 세션 상태 변경 감지');
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  
  // 정리 함수 반환
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('storage', handleStorageChange);
  };
};

/**
 * 브라우저 탭 동기화 지원
 * @param {Object} appState - 앱 상태
 * @returns {Promise<Object>} 통합된 상태
 */
export const syncWithOtherTabs = async (appState) => {
  if (!appState) {
    return null;
  }
  
  try {
    // 브로드캐스트 채널 지원 확인
    if (typeof BroadcastChannel !== 'undefined') {
      // 브로드캐스트 채널 생성
      const syncChannel = new BroadcastChannel('app_state_sync');
      
      // 현재 앱 상태 공유
      syncChannel.postMessage({
        type: 'SYNC_REQUEST',
        timestamp: new Date().toISOString()
      });
      
      // 다른 탭으로부터의 응답 대기
    const responses = await new Promise((resolve) => {
        const receivedStates = [];
        
        // 메시지 리스너
        const messageHandler = (event) => {
        if (event.data && event.data.type === 'SYNC_RESPONSE') {
            receivedStates.push(event.data.state);
        }
        };
        
        syncChannel.addEventListener('message', messageHandler);
        
        // 최대 500ms 동안 응답 대기
        setTimeout(() => {
        syncChannel.removeEventListener('message', messageHandler);
        syncChannel.close();
        resolve(receivedStates);
        }, 500);
    });
      
      // 수신된 상태가 없으면 원래 상태 반환
      if (responses.length === 0) {
        return appState;
      }
      
      // 모든 상태 병합
      let mergedState = { ...appState };
      
      for (const state of responses) {
        mergedState = mergeSessionStates(mergedState, state);
      }
      
      return mergedState;
    } else {
      // 브로드캐스트 채널을 지원하지 않는 브라우저의 경우 로컬 스토리지 사용
      // 여기서는 기존 로컬 스토리지 기반 상태 관리만 사용
      return appState;
    }
  } catch (error) {
    console.error('탭 동기화 오류:', error);
    return appState;
  }
};

/**
 * 세션 자동 저장 설정
 * @param {function} saveStateCallback - 상태 저장 콜백 함수
 * @param {number} intervalMs - 저장 간격 (밀리초)
 * @returns {function} 자동 저장 정지 함수
 */
export const setupAutoSave = (saveStateCallback, intervalMs = 30000) => {
  if (typeof saveStateCallback !== 'function' || typeof window === 'undefined') {
    return () => {};
  }
  
  // 자동 저장 타이머 ID
  let timerId = null;
  
  // 자동 저장 시작
  const startAutoSave = () => {
    if (timerId) {
      clearInterval(timerId);
    }
    
    timerId = setInterval(() => {
      saveStateCallback();
    }, intervalMs);
    
    return () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };
  };
  
  return startAutoSave();
};

// 내보내기
export {
  SESSION_RESTORE_KEY,
  NAVIGATION_STATE_KEY,
  SCROLL_POSITIONS_KEY,
  UI_STATE_KEY,
  FORM_DATA_KEY,
  SESSION_EXPIRY_MS
};
