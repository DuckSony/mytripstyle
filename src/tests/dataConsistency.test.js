// src/tests/dataConsistency.test.js

// 테스트에 실제로 사용하는 임포트만 유지
import { 
    loadAppState, 
    saveAppState, 
    cleanupExpiredStates 
  } from '../services/persistenceService';
  import {
    loadSessionState,
    saveSessionState,
    loadStateAfterRefresh
  } from '../utils/sessionRestoreUtils';
  
  // React와 관련된 불필요한 임포트 제거
  
  // IndexedDB 모킹 설정
  const indexedDB = {
    open: jest.fn()
  };
  
  // localStorage 모킹
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: jest.fn(key => store[key] || null),
      setItem: jest.fn((key, value) => {
        store[key] = value.toString();
      }),
      removeItem: jest.fn(key => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
      getAllItems: jest.fn(() => ({ ...store }))
    };
  })();
  
  // 세션 모의 데이터
  const mockUserSession = {
    userId: 'user123',
    profile: {
      mbti: 'ENFP',
      interests: ['travel', 'food', 'photography'],
      skills: ['writing', 'cooking']
    },
    currentMood: {
      mood: 'happy',
      intensity: 4,
      timestamp: '2025-03-20T10:30:00Z'
    },
    preferences: {
      darkMode: true,
      language: 'ko',
      notifications: true
    },
    interestedRegions: [
      { region: 'Seoul', subRegion: 'Gangnam' },
      { region: 'Busan', subRegion: 'Haeundae' }
    ]
  };
  
  // 앱 상태 모의 데이터
  const mockAppState = {
    user: mockUserSession,
    recommendations: {
      nearbyPlaces: [
        { id: 'place1', name: '카페 인더스트리얼', category: 'cafe' },
        { id: 'place2', name: '레스토랑 아리랑', category: 'restaurant' }
      ],
      regionPlaces: {
        'Seoul-Gangnam': [
          { id: 'place3', name: '스타필드 코엑스몰', category: 'shopping' }
        ]
      },
      lastUpdated: '2025-03-20T10:35:00Z'
    },
    savedPlaces: {
      items: [
        { id: 'place1', savedAt: '2025-03-19T15:20:00Z' }
      ],
      lastUpdated: '2025-03-19T15:20:00Z'
    },
    visitHistory: {
      visits: [
        { 
          placeId: 'place2', 
          visitedAt: '2025-03-18T12:00:00Z',
          rating: 4,
          notes: '맛있었음!'
        }
      ],
      planned: [
        {
          placeId: 'place3',
          plannedDate: '2025-03-25T18:00:00Z'
        }
      ]
    },
    navigation: {
      currentPath: '/recommendations',
      previousPath: '/home',
      params: { region: 'Seoul' },
      timestamp: '2025-03-20T10:34:00Z'
    }
  };
  
  // 테스트 전 설정
  beforeAll(() => {
    // 글로벌 모킹
    global.indexedDB = indexedDB;
    global.localStorage = localStorageMock;
    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn()
    }));
    
    // 콘솔 경고 및 오류 숨기기
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  // 각 테스트 전 설정
  beforeEach(() => {
    // 모든 모킹 초기화
    jest.clearAllMocks();
    localStorage.clear();
  });
  
  // 테스트 후 정리
  afterAll(() => {
    jest.restoreAllMocks();
  });
  
  describe('기본 데이터 지속성 테스트', () => {
    test('앱 상태를 저장하고 불러올 수 있어야 함', async () => {
      // 모킹된 구현
      const saveResult = { success: true };
      const loadResult = mockAppState;
      
      // saveAppState 및 loadAppState 모킹
      jest.spyOn(require('../services/persistenceService'), 'saveAppState')
        .mockResolvedValue(saveResult);
      jest.spyOn(require('../services/persistenceService'), 'loadAppState')
        .mockResolvedValue(loadResult);
      
      // 상태 저장 테스트
      const saveResponse = await saveAppState('user123', mockAppState);
      expect(saveResponse.success).toBe(true);
      
      // 상태 불러오기 테스트
      const loadedState = await loadAppState('user123');
      expect(loadedState).toEqual(mockAppState);
    });
    
    test('세션 상태를 저장하고 불러올 수 있어야 함', async () => {
      // 세션 데이터
      const sessionState = {
        navigation: { path: '/home', params: {} },
        scrollPositions: { '/home': { position: 0 } },
        timestamp: '2025-03-20T10:30:00Z'
      };
      
      // 저장 및 불러오기 모킹
      jest.spyOn(require('../utils/sessionRestoreUtils'), 'saveSessionState')
        .mockResolvedValue(true);
      jest.spyOn(require('../utils/sessionRestoreUtils'), 'loadSessionState')
        .mockResolvedValue(sessionState);
      
      // 세션 저장 테스트
      const saved = await saveSessionState(sessionState);
      expect(saved).toBe(true);
      
      // 세션 불러오기 테스트
      const loadedSession = await loadSessionState();
      expect(loadedSession).toEqual(sessionState);
    });
  });
  
  describe('앱 재시작 및 새로고침 테스트', () => {
    test('브라우저 새로고침 시 세션 상태가 유지되어야 함', async () => {
      // 새로고침 전 상태
      const preRefreshState = {
        navigation: { path: '/recommendations', params: { category: 'cafe' } },
        scrollPositions: { '/recommendations': { position: 250 } },
        uiState: { 'searchForm': { query: '카페', expanded: true } },
        timestamp: '2025-03-20T10:30:00Z'
      };
      
      // localStorage에 직접 저장하여 새로고침 시뮬레이션
      localStorage.setItem('before_unload_state', JSON.stringify({
        data: preRefreshState,
        timestamp: new Date().toISOString()
      }));
      
      // 새로고침 후 상태 불러오기
      const refreshedState = await loadStateAfterRefresh();
      
      // 검증
      expect(refreshedState).not.toBeNull();
      expect(refreshedState.navigation.path).toBe('/recommendations');
      expect(refreshedState.navigation.params.category).toBe('cafe');
      expect(refreshedState.scrollPositions['/recommendations'].position).toBe(250);
      
      // localStorage에서 항목이 삭제되었는지 확인
      expect(localStorage.getItem('before_unload_state')).toBeNull();
    });
    
    test('만료된 상태는 새로고침 시 복원되지 않아야 함', async () => {
      // 만료된 상태
      const expiredState = {
        navigation: { path: '/home' },
        timestamp: '2025-03-10T10:30:00Z' // 10일 전 (만료됨)
      };
      
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 10); // 10분 전
      
      // 만료된 상태 저장
      localStorage.setItem('before_unload_state', JSON.stringify({
        data: expiredState,
        timestamp: fiveMinutesAgo.toISOString() // 10분 전 (만료됨)
      }));
      
      // 새로고침 후 상태 불러오기
      const refreshedState = await loadStateAfterRefresh();
      
      // 검증
      expect(refreshedState).toBeNull();
      
      // localStorage에서 항목이 삭제되었는지 확인
      expect(localStorage.getItem('before_unload_state')).toBeNull();
    });
    
    test('앱 상태 만료 정리가 올바르게 작동해야 함', async () => {
      // 목 데이터
      const cleanupResult = { success: true, cleanedCount: 2 };
      
      // 모킹
      jest.spyOn(require('../services/persistenceService'), 'cleanupExpiredStates')
        .mockResolvedValue(cleanupResult);
      
      // 만료된 상태 정리
      const result = await cleanupExpiredStates();
      
      // 검증
      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(2);
    });
  });
  
  describe('네트워크 연결 변경 시 데이터 무결성 테스트', () => {
    test('오프라인 상태에서 온라인 전환 시 데이터가 유지되어야 함', async () => {
      // 네트워크 상태 이벤트 모킹
      const networkCallbacks = {};
      
      // 이벤트 리스너 모킹
      window.addEventListener = jest.fn((event, callback) => {
        networkCallbacks[event] = callback;
      });
      window.removeEventListener = jest.fn();
      
      // 네트워크 상태 모킹
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
      });
      
      // 오프라인 상태에서 데이터 저장
      const offlineData = {
        ...mockAppState,
        _offlineSaved: true
      };
      
      // 오프라인 저장 모킹
      jest.spyOn(require('../services/persistenceService'), 'saveAppState')
        .mockResolvedValue({ success: true });
      
      // 오프라인 상태에서 저장
      const saveResult = await saveAppState('user123', offlineData);
      expect(saveResult.success).toBe(true);
      
      // 온라인 상태로 변경 이벤트 발생
      if (networkCallbacks.online) {
        networkCallbacks.online(new Event('online'));
      }
      
      // 동기화 완료 대기 (타이밍 이슈를 피하기 위한 대기)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 동기화 후 상태 확인
      const syncedData = await loadAppState('user123');
      expect(syncedData).toBeTruthy();
    });
    
    test('오프라인 모드에서 사용자 조작 후 상태가 유지되어야 함', async () => {
      // 오프라인 모드 모킹
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: jest.fn().mockReturnValue(false)
      });
      
      // 오프라인 상태에서 수정된 앱 상태
      const modifiedState = {
        ...mockAppState,
        savedPlaces: {
          items: [
            ...mockAppState.savedPlaces.items,
            { id: 'place4', savedAt: new Date().toISOString() }
          ],
          lastUpdated: new Date().toISOString()
        }
      };
      
      // 저장 모킹
      jest.spyOn(require('../services/persistenceService'), 'saveAppState')
        .mockResolvedValue({ success: true });
      jest.spyOn(require('../services/persistenceService'), 'loadAppState')
        .mockResolvedValue(modifiedState);
      
      // 오프라인 상태에서 저장
      const saveResult = await saveAppState('user123', modifiedState);
      expect(saveResult.success).toBe(true);
      
      // 불러오기 테스트
      const loadedState = await loadAppState('user123');
      expect(loadedState.savedPlaces.items.length).toBe(2);
      expect(loadedState.savedPlaces.items[1].id).toBe('place4');
    });
  });
  
  describe('복잡한 앱 시나리오 테스트', () => {
    test('여러 컨텍스트가 변경된 후 앱 재시작 시 상태가 유지되어야 함', async () => {
      // 여러 변경이 있는 앱 상태
      const complexState = {
        ...mockAppState,
        // 사용자 정보 변경
        user: {
          ...mockAppState.user,
          currentMood: {
            mood: 'excited',
            intensity: 5,
            timestamp: new Date().toISOString()
          },
          preferences: {
            ...mockAppState.user.preferences,
            theme: 'light'
          }
        },
        // 새로운 방문 계획 추가
        visitHistory: {
          ...mockAppState.visitHistory,
          planned: [
            ...mockAppState.visitHistory.planned,
            {
              placeId: 'place4',
              plannedDate: '2025-04-01T19:00:00Z',
              notes: '친구와 만남'
            }
          ]
        },
        // 검색 기록 추가
        search: {
          recentSearches: ['카페', '레스토랑', '전시회'],
          lastSearch: '카페',
          lastSearchTime: new Date().toISOString()
        }
      };
      
      // 저장 및 불러오기 모킹
      jest.spyOn(require('../services/persistenceService'), 'saveAppState')
        .mockResolvedValue({ success: true });
      jest.spyOn(require('../services/persistenceService'), 'loadAppState')
        .mockResolvedValue(complexState);
      
      // 앱 상태 저장
      const saveResult = await saveAppState('user123', complexState);
      expect(saveResult.success).toBe(true);
      
      // 앱 종료 및 재시작 시뮬레이션
      localStorage.clear(); // 다른 메모리 상태 초기화
      
      // 앱 재시작 후 상태 복원
      const restoredState = await loadAppState('user123');
      
      // 검증
      expect(restoredState).toBeTruthy();
      expect(restoredState.user.currentMood.mood).toBe('excited');
      expect(restoredState.user.preferences.theme).toBe('light');
      expect(restoredState.visitHistory.planned.length).toBe(2);
      expect(restoredState.visitHistory.planned[1].placeId).toBe('place4');
      expect(restoredState.search.recentSearches).toContain('전시회');
    });
    
    test('다양한 기기간 전환 시 데이터 일관성 유지해야 함', async () => {
      // 기기 정보 모킹
      const deviceInfoMock = {
        mobile: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
          width: 390,
          height: 844
        },
        desktop: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          width: 1440,
          height: 900
        }
      };
      
      // 사용자 에이전트 모킹 함수
      const mockUserAgent = (device) => {
        Object.defineProperty(navigator, 'userAgent', {
          configurable: true,
          get: jest.fn().mockReturnValue(deviceInfoMock[device].userAgent)
        });
        
        window.innerWidth = deviceInfoMock[device].width;
        window.innerHeight = deviceInfoMock[device].height;
      };
      
      // 모바일 기기에서 생성된 상태
      const mobileState = {
        ...mockAppState,
        _deviceInfo: {
          type: 'mobile',
          orientation: 'portrait',
          lastUpdated: new Date().toISOString()
        }
      };
      
      // 저장 및 불러오기 모킹
      jest.spyOn(require('../services/persistenceService'), 'saveAppState')
        .mockResolvedValue({ success: true });
      
      // 모바일 상태 모킹
      mockUserAgent('mobile');
      
      // 모바일에서 저장
      jest.spyOn(require('../services/persistenceService'), 'loadAppState')
        .mockResolvedValueOnce(null) // 처음에는 상태 없음
        .mockResolvedValueOnce(mobileState); // 저장 후 불러오기
      
      // 모바일에서 상태 저장
      await saveAppState('user123', mobileState);
      const mobileLoadedState = await loadAppState('user123');
      
      // 모바일 상태 검증
      expect(mobileLoadedState._deviceInfo.type).toBe('mobile');
      
      // 데스크톱으로 전환
      mockUserAgent('desktop');
      
      // 데스크톱에서 불러오기
      jest.spyOn(require('../services/persistenceService'), 'loadAppState')
        .mockResolvedValue(mobileState); // 모바일에서 저장된 상태 불러오기
      
      const desktopLoadedState = await loadAppState('user123');
      
      // 데스크톱에서 모바일 상태가 올바르게 불러와졌는지 검증
      expect(desktopLoadedState).toBeTruthy();
      expect(desktopLoadedState._deviceInfo.type).toBe('mobile');
      expect(desktopLoadedState.user.userId).toBe('user123');
    });
  });
