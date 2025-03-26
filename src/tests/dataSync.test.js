import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { DataSyncProvider, useDataSync } from '../contexts/DataSyncContext';
import { AuthProvider } from '../contexts/AuthContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import * as syncService from '../services/syncService';
import testUtils from '../utils/testUtils';

// 모의 (mock) 함수 생성
jest.mock('../services/syncService');
jest.mock('../contexts/AuthContext', () => ({
  ...jest.requireActual('../contexts/AuthContext'),
  useAuth: jest.fn()
}));
jest.mock('../contexts/NetworkContext', () => ({
  ...jest.requireActual('../contexts/NetworkContext'),
  useNetwork: jest.fn()
}));

// 테스트 래퍼 컴포넌트
const TestComponent = () => {
  const dataSyncContext = useDataSync();
  return (
    <div>
      <div data-testid="sync-status">
        {dataSyncContext.isSyncing ? 'Syncing' : 'Not Syncing'}
      </div>
      <div data-testid="pending-changes">
        {dataSyncContext.pendingChanges}
      </div>
      <div data-testid="last-sync-time">
        {dataSyncContext.lastSyncTime || 'Never'}
      </div>
      <button 
        data-testid="sync-button"
        onClick={dataSyncContext.startSync}
      >
        Sync
      </button>
    </div>
  );
};

// 테스트 래퍼
const renderWithProviders = (ui, { authValue = {}, networkValue = {} } = {}) => {
  return render(
    <AuthProvider value={authValue}>
      <NetworkProvider value={networkValue}>
        <DataSyncProvider>
          {ui}
        </DataSyncProvider>
      </NetworkProvider>
    </AuthProvider>
  );
};

describe('DataSync Tests', () => {
    // 각 테스트 전에 실행할 설정
    beforeEach(() => {
      // 모의 함수 초기화
      jest.clearAllMocks();
      
      // 기본 Auth 모의 값 설정
      require('../contexts/AuthContext').useAuth.mockReturnValue({
        user: { uid: 'test-user-id' },
        isAuthenticated: true
      });
      
      // 기본 Network 모의 값 설정
      require('../contexts/NetworkContext').useNetwork.mockReturnValue({
        isOnline: true
      });
      
      // syncService 모의 함수 설정
      syncService.pushChanges.mockResolvedValue({ success: true, itemCount: 0 });
      syncService.pullChanges.mockResolvedValue({ 
        success: true, 
        lastSyncTime: '2025-03-20T12:00:00Z',
        counts: { savedPlaces: 5, reviews: 3, userPreferences: 1, places: 20 }
      });
      
      // IndexedDB 테스트 셋업
      return testUtils.setupTestDB();
    });
    
    // 각 테스트 후에 실행할 정리
    afterEach(async () => {
      await testUtils.cleanupAllTestData();
    });
    
    // 모든 테스트 후 정리
    afterAll(() => {
      jest.restoreAllMocks();
    });

    test('초기 상태가 올바르게 설정됨', () => {
        renderWithProviders(<TestComponent />);
        
        expect(screen.getByTestId('sync-status')).toHaveTextContent('Not Syncing');
        expect(screen.getByTestId('pending-changes')).toHaveTextContent('0');
        expect(screen.getByTestId('last-sync-time')).toHaveTextContent('Never');
      });
      
      test('사용자가 인증되지 않으면 동기화가 시작되지 않음', async () => {
        // 인증되지 않은 사용자로 설정
        require('../contexts/AuthContext').useAuth.mockReturnValue({
          user: null,
          isAuthenticated: false
        });
        
        renderWithProviders(<TestComponent />);
        
        // 동기화 버튼 클릭
        act(() => {
          screen.getByTestId('sync-button').click();
        });
        
        // 동기화 함수가 호출되지 않아야 함
        await waitFor(() => {
            expect(syncService.pushChanges).not.toHaveBeenCalled();
          });
          await waitFor(() => {
            expect(syncService.pullChanges).not.toHaveBeenCalled();
          });
      });
      
      test('오프라인 상태에서 동기화가 시작되지 않음', async () => {
        // 오프라인 상태로 설정
        require('../contexts/NetworkContext').useNetwork.mockReturnValue({
          isOnline: false
        });
        
        renderWithProviders(<TestComponent />);
        
        // 동기화 버튼 클릭
        act(() => {
          screen.getByTestId('sync-button').click();
        });
        
        // 동기화 함수가 호출되지 않아야 함
        await waitFor(() => {
            expect(syncService.pushChanges).not.toHaveBeenCalled();
          });
          await waitFor(() => {
            expect(syncService.pullChanges).not.toHaveBeenCalled();
          });
      });
      
      test('동기화 버튼 클릭 시 동기화 프로세스 시작', async () => {
        renderWithProviders(<TestComponent />);
        
        // 동기화 버튼 클릭
        act(() => {
          screen.getByTestId('sync-button').click();
        });
        
        // 동기화 중 상태 확인
        expect(screen.getByTestId('sync-status')).toHaveTextContent('Syncing');
        
        // 동기화 완료 후 상태 확인
        await waitFor(() => {
            expect(screen.getByTestId('sync-status')).toHaveTextContent('Not Syncing');
          });
          await waitFor(() => {
            expect(screen.getByTestId('last-sync-time')).toHaveTextContent('2025-03-20');
          });
          await waitFor(() => {
            expect(syncService.pullChanges).toHaveBeenCalledWith('test-user-id', expect.any(Function));
          });
      });

      test('동기화 큐에 항목을 추가하고 처리', async () => {
        // 동기화 큐에 항목이 있는 것으로 모의 설정
        syncService.pushChanges.mockImplementation(async (queue, progressCallback) => {
          // 진행 상황 콜백 시뮬레이션
          progressCallback(0.5);
          await testUtils.wait(10);
          progressCallback(1.0);
          
          return { success: true, itemCount: queue.length };
        });
        
        const TestWithQueue = () => {
          const { addToSyncQueue, startSync, pendingChanges } = useDataSync();
          
          React.useEffect(() => {
            // 테스트용 항목 추가
            addToSyncQueue({
              collection: 'savedPlaces',
              action: 'create',
              data: { name: 'Test Place', rating: 4.5 },
              id: 'test-id-1'
            });
            
            addToSyncQueue({
              collection: 'reviews',
              action: 'update',
              data: { content: 'Updated review' },
              id: 'test-id-2'
            });
          }, [addToSyncQueue]);
          
          return (
            <div>
              <div data-testid="pending-count">{pendingChanges}</div>
              <button data-testid="start-sync" onClick={startSync}>Sync</button>
            </div>
          );
        };
        
        renderWithProviders(<TestWithQueue />);
        
        // 큐에 항목이 추가되었는지 확인
        await waitFor(() => {
          expect(screen.getByTestId('pending-count')).toHaveTextContent('2');
        });
        
        // 동기화 시작
        act(() => {
          screen.getByTestId('start-sync').click();
        });
        
        // 동기화 완료 확인
        await waitFor(() => {
          expect(syncService.pushChanges).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({ id: 'test-id-1' }),
              expect.objectContaining({ id: 'test-id-2' })
            ]),
            expect.any(Function)
          );
        });
      });
      
      test('동기화 오류 처리', async () => {
        // 동기화 오류 모의 설정
        syncService.pullChanges.mockRejectedValue(new Error('Network error'));
        
        renderWithProviders(<TestComponent />);

        
        // 동기화 시작
        act(() => {
          screen.getByTestId('sync-button').click();
        });
        
        // 동기화 실패 확인
        await waitFor(() => {
            expect(screen.getByTestId('sync-status')).toHaveTextContent('Not Syncing');
          });
          // 마지막 동기화 시간이 업데이트되지 않았는지 확인
          await waitFor(() => {
            expect(screen.getByTestId('last-sync-time')).toHaveTextContent('Never');
          });
      });
      
      test('네트워크 연결 복원 시 자동 동기화', async () => {
        // 오프라인 상태로 시작
        require('../contexts/NetworkContext').useNetwork.mockReturnValue({
          isOnline: false
        });
        
        const TestWithAutoSync = () => {
          const { addToSyncQueue, hasPendingChanges } = useDataSync();
          
          React.useEffect(() => {
            // 테스트용 항목 추가
            addToSyncQueue({
              collection: 'reviews',
              action: 'create',
              data: { content: 'New review' },
              id: 'test-id-3'
            });
          }, [addToSyncQueue]);
          
          return (
            <div data-testid="has-pending">{hasPendingChanges ? 'Yes' : 'No'}</div>
          );
        };
        
        renderWithProviders(<TestWithAutoSync />);
        
        // 큐에 항목이 추가되었는지 확인
        await waitFor(() => {
          expect(screen.getByTestId('has-pending')).toHaveTextContent('Yes');
        });
        
        // 온라인 상태로 변경
        act(() => {
          require('../contexts/NetworkContext').useNetwork.mockReturnValue({
            isOnline: true
          });
          // 네트워크 상태 변경 이벤트 발생
          window.dispatchEvent(new Event('online'));
        });
        
        // 자동 동기화 확인
        await waitFor(() => {
          expect(syncService.pushChanges).toHaveBeenCalled();
        });
      });
    });


