import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NetworkProvider, useNetwork } from '../contexts/NetworkContext';
import networkUtils from '../utils/networkUtils';
import offlineManager from '../services/offlineManager';
import * as indexedDBUtils from '../utils/indexedDBUtils';

// 모의 함수 설정
jest.mock('../utils/networkUtils', () => ({
  isOnline: jest.fn(),
  monitorNetwork: jest.fn(),
  getConnectionType: jest.fn(),
  getConnectionSpeed: jest.fn(),
  testConnection: jest.fn(),
  withRetry: jest.fn()
}));

jest.mock('../services/offlineManager', () => ({
  initOfflineManager: jest.fn(),
  startSync: jest.fn(),
  stopSync: jest.fn(),
  isOffline: jest.fn(),
  queueSyncTask: jest.fn(),
  getSyncStatus: jest.fn(),
  testConnection: jest.fn()
}));

jest.mock('../utils/indexedDBUtils', () => ({
  addItem: jest.fn(),
  getItemByKey: jest.fn(),
  getAllItems: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  clearStore: jest.fn()
}));

// 네트워크 상태를 확인하는 테스트 컴포넌트
const TestNetworkComponent = () => {
  const { 
    isOnline, 
    connectionType, 
    lastChanged, 
    isReconnecting, 
    attemptReconnect,
    connectionHistory
  } = useNetwork();
  
  return (
    <div>
      <div data-testid="online-status">
        {isOnline ? 'Online' : 'Offline'}
      </div>
      <div data-testid="connection-type">
        {connectionType}
      </div>
      <div data-testid="last-changed">
        {lastChanged || 'Never'}
      </div>
      <div data-testid="reconnecting">
        {isReconnecting ? 'Reconnecting...' : 'Not reconnecting'}
      </div>
      <div data-testid="history-count">
        {connectionHistory.length}
      </div>
      <button 
        data-testid="reconnect-button"
        onClick={attemptReconnect}
        disabled={isOnline}
      >
        Reconnect
      </button>
    </div>
  );
};

// 네트워크 상태 변경을 시뮬레이션하는 유틸리티 함수
const simulateNetworkChange = (isOnline) => {
    // 네트워크 유틸리티 모의 함수 설정
    networkUtils.isOnline.mockReturnValue(isOnline);
    
    // offlineManager 모의 함수 설정
    offlineManager.isOffline.mockReturnValue(!isOnline);
    
    // 네트워크 이벤트 발생
    if (isOnline) {
      window.dispatchEvent(new Event('online'));
    } else {
      window.dispatchEvent(new Event('offline'));
    }
  };
  
  // 네트워크 모니터링 모의 설정
  const setupNetworkMonitoring = () => {
    networkUtils.monitorNetwork.mockImplementation((onlineCallback, offlineCallback) => {
      // 이벤트 리스너 등록 모의
      window.addEventListener('online', onlineCallback);
      window.addEventListener('offline', offlineCallback);
      
      // 정리 함수 반환
      return () => {
        window.removeEventListener('online', onlineCallback);
        window.removeEventListener('offline', offlineCallback);
      };
    });
  };
  
  // 네트워크 연결 정보 모의 설정
  const setupConnectionInfo = (type = 'wifi', speed = { downlink: 10, rtt: 50 }) => {
    networkUtils.getConnectionType.mockReturnValue(type);
    networkUtils.getConnectionSpeed.mockReturnValue(speed);
  };
  
  // 테스트 연결 결과 모의 설정
  const setupTestConnection = (result = { online: true, latency: 100, status: 200 }) => {
    networkUtils.testConnection.mockResolvedValue(result);
    offlineManager.testConnection.mockResolvedValue(result);
  };
  
  // 각 테스트 전에 실행할 설정
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 기본적으로 온라인 상태로 시작
    networkUtils.isOnline.mockReturnValue(true);
    offlineManager.isOffline.mockReturnValue(false);
    
    // 네트워크 모니터링 모의 설정
    setupNetworkMonitoring();
    
    // 네트워크 정보 모의 설정
    setupConnectionInfo();
    
    // 테스트 연결 모의 설정
    setupTestConnection();
    
    // 재시도 함수 모의 설정
    networkUtils.withRetry.mockImplementation(async (fn) => await fn());
    
    // IndexedDB 모의 설정
    indexedDBUtils.getAllItems.mockResolvedValue([]);
    indexedDBUtils.getItemByKey.mockResolvedValue(null);
  });
  
  // 테스트 후 정리
  afterEach(() => {
    // 이벤트 리스너 정리
    jest.restoreAllMocks();
  });

  describe('네트워크 상태 감지 테스트', () => {
    test('초기 네트워크 상태가 올바르게 감지됨', () => {
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      expect(screen.getByTestId('connection-type')).toHaveTextContent('wifi');
      expect(screen.getByTestId('reconnect-button')).toBeDisabled();
    });
    
    test('오프라인 상태 변경이 올바르게 감지됨', async () => {
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 초기 상태 확인
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      
      // 네트워크 상태 변경 시뮬레이션 (오프라인으로)
      act(() => {
        simulateNetworkChange(false);
      });
      
      // 상태 변경 확인
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 재연결 버튼 활성화 확인
      expect(screen.getByTestId('reconnect-button')).not.toBeDisabled();
      
      // 연결 유형 변경 확인
      expect(screen.getByTestId('connection-type')).toHaveTextContent('none');
      
      // 이력 업데이트 확인
      expect(screen.getByTestId('history-count')).not.toHaveTextContent('0');
    });
    
    test('온라인 상태 복원이 올바르게 감지됨', async () => {
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 오프라인으로 변경
      act(() => {
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 다시 온라인으로 변경
      act(() => {
        simulateNetworkChange(true);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
      
      // 재연결 버튼 비활성화 확인
      expect(screen.getByTestId('reconnect-button')).toBeDisabled();
      
      // 연결 유형 변경 확인
      expect(screen.getByTestId('connection-type')).toHaveTextContent('wifi');
    });
  });

  describe('네트워크 재연결 시도 테스트', () => {
    test('수동 재연결 시도 기능이 올바르게 작동함', async () => {
      // 재연결 성공 모의 설정
      setupTestConnection({ online: true, latency: 100, status: 200 });
      
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 오프라인으로 변경
      act(() => {
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 재연결 버튼 클릭
      const user = userEvent.setup();
      await user.click(screen.getByTestId('reconnect-button'));
      
      // 재연결 시도 중 상태 확인
      expect(screen.getByTestId('reconnecting')).toHaveTextContent('Reconnecting...');
      
      // 재연결 성공 후 네트워크 상태 변경
      act(() => {
        simulateNetworkChange(true);
      });
      
      // 상태 확인
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
      
      // 재연결 시도 완료 확인
      expect(screen.getByTestId('reconnecting')).toHaveTextContent('Not reconnecting');
    });
    
    test('재연결 시도 실패 시 오프라인 상태 유지', async () => {
      // 재연결 실패 모의 설정
      networkUtils.testConnection.mockResolvedValue({ 
        online: false, 
        latency: null, 
        error: 'Network error' 
      });
      
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 오프라인으로 변경
      act(() => {
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 재연결 버튼 클릭
      const user = userEvent.setup();
      await user.click(screen.getByTestId('reconnect-button'));
      
      // 재연결 시도 중 상태 확인
      expect(screen.getByTestId('reconnecting')).toHaveTextContent('Reconnecting...');
      
      // 상태 확인 (여전히 오프라인)
      await waitFor(() => {
        expect(screen.getByTestId('reconnecting')).toHaveTextContent('Not reconnecting');
      });
      
      expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
    });
  });

  describe('오프라인 관리자 통합 테스트', () => {
    test('오프라인 상태 변경 시 동기화 중지됨', async () => {
      // 오프라인 관리자 초기화 모의 함수 설정
      offlineManager.initOfflineManager.mockImplementation((options) => {
        // 콜백 함수를 저장
        if (options.onOnline) {
          window.addEventListener('online', options.onOnline);
        }
        if (options.onOffline) {
          window.addEventListener('offline', options.onOffline);
        }
        
        return {
          startSync: offlineManager.startSync,
          stopSync: offlineManager.stopSync,
          isOffline: offlineManager.isOffline
        };
      });
      
      // 컴포넌트 렌더링 전에 오프라인 관리자 초기화
      act(() => {
        offlineManager.initOfflineManager({
          onOnline: jest.fn(),
          onOffline: jest.fn()
        });
      });
      
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 초기 상태 확인
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      
      // 네트워크 상태 변경 시뮬레이션 (오프라인으로)
      act(() => {
        simulateNetworkChange(false);
      });
      
      // 상태 변경 확인
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 동기화 중지 함수 호출 확인
      expect(offlineManager.stopSync).toHaveBeenCalled();
    });
    
    test('온라인 상태 복원 시 동기화 시작됨', async () => {
      // 오프라인 관리자 초기화 모의 함수 설정
      offlineManager.initOfflineManager.mockImplementation((options) => {
        // 콜백 함수를 저장
        if (options.onOnline) {
          window.addEventListener('online', options.onOnline);
        }
        if (options.onOffline) {
          window.addEventListener('offline', options.onOffline);
        }
        
        return {
          startSync: offlineManager.startSync,
          stopSync: offlineManager.stopSync,
          isOffline: offlineManager.isOffline
        };
      });
      
      // 컴포넌트 렌더링 전에 오프라인 관리자 초기화
      act(() => {
        offlineManager.initOfflineManager({
          onOnline: jest.fn(),
          onOffline: jest.fn()
        });
      });
      
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 오프라인으로 변경
      act(() => {
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 동기화 중지 함수 호출 확인
      expect(offlineManager.stopSync).toHaveBeenCalled();
      
      // 초기화
      jest.clearAllMocks();
      
      // 다시 온라인으로 변경
      act(() => {
        simulateNetworkChange(true);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
      
      // 동기화 시작 함수 호출 확인
      expect(offlineManager.startSync).toHaveBeenCalled();
    });
  });

  describe('데이터 동기화 및 오프라인 처리 테스트', () => {
    // 오프라인에서 작업 대기열에 추가하는 테스트 컴포넌트
    const TestOfflineQueueComponent = () => {
      const { isOnline } = useNetwork();
      
      const handleAddToQueue = () => {
        const itemData = {
          id: 'test-item-' + Date.now(),
          name: 'Test Item',
          timestamp: new Date().toISOString()
        };
        
        offlineManager.queueSyncTask('test-user', 'add', 'testStore', itemData);
      };
      
      return (
        <div>
          <div data-testid="online-status">
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button 
            data-testid="add-to-queue-button"
            onClick={handleAddToQueue}
          >
            Add to Queue
          </button>
        </div>
      );
    };
    
    test('오프라인 상태에서 작업이 대기열에 추가됨', async () => {
      // 펜딩 아이템 조회 모의 설정
      indexedDBUtils.getAllItems.mockResolvedValue([]);
      
      render(
        <NetworkProvider>
          <TestOfflineQueueComponent />
        </NetworkProvider>
      );
      
      // 오프라인으로 변경
      act(() => {
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 대기열에 아이템 추가
      const user = userEvent.setup();
      await user.click(screen.getByTestId('add-to-queue-button'));
      
      // queueSyncTask 함수 호출 확인
      expect(offlineManager.queueSyncTask).toHaveBeenCalledWith(
        'test-user',
        'add',
        'testStore',
        expect.objectContaining({
          id: expect.stringContaining('test-item-'),
          name: 'Test Item'
        })
      );
      
      // 동기화 시작되지 않음 확인 (오프라인 상태이므로)
      expect(offlineManager.startSync).not.toHaveBeenCalled();
    });
    
    test('온라인 복원 시 대기 중인 작업이 동기화됨', async () => {
      // 펜딩 아이템이 있는 것으로 설정
      const pendingItems = [
        {
          id: 'pending-item-1',
          userId: 'test-user',
          operationType: 'add',
          storeName: 'testStore',
          data: { name: 'Pending Item 1' },
          status: 'pending'
        }
      ];
      
      indexedDBUtils.getAllItems.mockResolvedValue(pendingItems);
      
      // 오프라인 관리자 초기화 모의 함수 설정
      offlineManager.initOfflineManager.mockImplementation((options) => {
        // 콜백 함수를 저장
        if (options.onOnline) {
          window.addEventListener('online', options.onOnline);
        }
        if (options.onOffline) {
          window.addEventListener('offline', options.onOffline);
        }
        
        return {
          startSync: offlineManager.startSync,
          stopSync: offlineManager.stopSync,
          isOffline: offlineManager.isOffline,
          queueSyncTask: offlineManager.queueSyncTask
        };
      });
      
      // 컴포넌트 렌더링 전에 오프라인 관리자 초기화
      act(() => {
        offlineManager.initOfflineManager({
          onOnline: jest.fn(),
          onOffline: jest.fn()
        });
      });
      
      render(
        <NetworkProvider>
          <TestOfflineQueueComponent />
        </NetworkProvider>
      );
      
      // 오프라인으로 변경
      act(() => {
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      // 초기화
      jest.clearAllMocks();
      
      // 대기열에 아이템 추가
      const user = userEvent.setup();
      await user.click(screen.getByTestId('add-to-queue-button'));
      
      // 다시 온라인으로 변경
      act(() => {
        simulateNetworkChange(true);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
      
      // 동기화 시작 함수 호출 확인
      expect(offlineManager.startSync).toHaveBeenCalled();
    });
  });

  describe('연결 품질 변경 테스트', () => {
    // 연결 품질을 표시하는 테스트 컴포넌트
    const TestConnectionQualityComponent = () => {
      const { connectionType, connectionQuality } = useNetwork();
      
      return (
        <div>
          <div data-testid="connection-type">
            {connectionType}
          </div>
          <div data-testid="connection-quality">
            {connectionQuality || 'Unknown'}
          </div>
        </div>
      );
    };
    
    test('연결 유형 변경이 감지됨', async () => {
      render(
        <NetworkProvider>
          <TestConnectionQualityComponent />
        </NetworkProvider>
      );
      
      // 초기 상태 확인
      expect(screen.getByTestId('connection-type')).toHaveTextContent('wifi');
      
      // 연결 유형 변경 (wifi에서 cellular로)
      act(() => {
        networkUtils.getConnectionType.mockReturnValue('cellular');
        
        // Connection 이벤트 시뮬레이션 (Navigator.connection API에 존재할 경우)
        if (navigator.connection) {
          navigator.connection.dispatchEvent(new Event('change'));
        }
      });
      
      // 모의 이벤트 발생 (Connection API가 없을 경우)
      window.dispatchEvent(new Event('online'));
      
      // 상태 변경 확인
      await waitFor(() => {
        expect(screen.getByTestId('connection-type')).toHaveTextContent('cellular');
      });
    });
    
    test('네트워크 감지 API가 없는 환경에서도 정상 작동', async () => {
      // Navigator.connection API가 없는 환경 모의
      const originalConnection = navigator.connection;
      delete navigator.connection;
      
      // 연결 유형과 속도 모의 설정
      networkUtils.getConnectionType.mockReturnValue('unknown');
      networkUtils.getConnectionSpeed.mockReturnValue(null);
      
      render(
        <NetworkProvider>
          <TestConnectionQualityComponent />
        </NetworkProvider>
      );
      
      // 초기 상태 확인
      expect(screen.getByTestId('connection-type')).toHaveTextContent('unknown');
      expect(screen.getByTestId('connection-quality')).toHaveTextContent('Unknown');
      
      // Navigator.connection 복원
      navigator.connection = originalConnection;
    });
  });

  describe('네트워크 중단 복구 테스트', () => {
    test('간헐적인 네트워크 중단 후 자동 재연결', async () => {
      // 연결 이력을 추적하는 배열
      const connectionStates = [];
      
      // 네트워크 모니터링 모의 설정
      networkUtils.monitorNetwork.mockImplementation((onlineCallback, offlineCallback) => {
        // 이벤트 리스너 등록 모의
        window.addEventListener('online', () => {
          connectionStates.push('online');
          onlineCallback();
        });
        
        window.addEventListener('offline', () => {
          connectionStates.push('offline');
          offlineCallback();
        });
        
        // 정리 함수 반환
        return () => {
          window.removeEventListener('online', onlineCallback);
          window.removeEventListener('offline', offlineCallback);
        };
      });
      
      render(
        <NetworkProvider>
          <TestNetworkComponent />
        </NetworkProvider>
      );
      
      // 초기 상태 확인
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      
      // 네트워크 상태 변경 시뮬레이션 (순차적으로 변경)
      act(() => {
        // 오프라인으로 변경
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      act(() => {
        // 온라인으로 변경
        simulateNetworkChange(true);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
      
      act(() => {
        // 다시 오프라인으로 변경
        simulateNetworkChange(false);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
      
      act(() => {
        // 다시 온라인으로 변경
        simulateNetworkChange(true);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      });
      
      // 연결 이력 확인
      expect(connectionStates).toEqual(['offline', 'online', 'offline', 'online']);
      
      // 이력 업데이트 확인
      const historyCount = parseInt(screen.getByTestId('history-count').textContent, 10);
      expect(historyCount).toBeGreaterThanOrEqual(4);
    });
  });
