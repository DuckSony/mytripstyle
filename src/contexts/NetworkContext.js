import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 네트워크 상태 컨텍스트
const NetworkContext = createContext();

// 네트워크 상태 사용 훅
export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

// NetworkProvider 컴포넌트
export const NetworkProvider = ({ children }) => {
    // 현재 네트워크 상태
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    // 네트워크 유형 (wifi, cellular, unknown)
    const [connectionType, setConnectionType] = useState('unknown');
    // 마지막 상태 변경 시간
    const [lastChanged, setLastChanged] = useState(null);
    // 연결 상태 이력
    const [connectionHistory, setConnectionHistory] = useState([]);
    // 연결 다시 시도 중 상태
    const [isReconnecting, setIsReconnecting] = useState(false);
  
    // 네트워크 상태 변경 이벤트 핸들러
    const handleOnline = useCallback(() => {
      const timestamp = new Date().toISOString();
      setIsOnline(true);
      setLastChanged(timestamp);
      setConnectionHistory(prev => [
        { status: 'online', timestamp },
        ...prev.slice(0, 19)  // 최대 20개 이력 유지
      ]);
      setIsReconnecting(false);
    }, []);
  
    const handleOffline = useCallback(() => {
      const timestamp = new Date().toISOString();
      setIsOnline(false);
      setLastChanged(timestamp);
      setConnectionHistory(prev => [
        { status: 'offline', timestamp },
        ...prev.slice(0, 19)
      ]);
    }, []);

    // 연결 유형 감지
  const detectConnectionType = useCallback(() => {
    if (!navigator.onLine) {
      setConnectionType('none');
      return;
    }

    // NetworkInformation API 지원 확인
    if (navigator.connection) {
      const { effectiveType, type } = navigator.connection;
      
      if (type) {
        setConnectionType(type); // wifi, cellular, none, unknown
      } else if (effectiveType) {
        // 4g, 3g, 2g, slow-2g
        setConnectionType(effectiveType);
      }
    } else {
      // API를 지원하지 않는 브라우저에서는 단순히 온라인/오프라인만 감지
      setConnectionType(navigator.onLine ? 'unknown' : 'none');
    }
  }, []);

  // 수동 재연결 시도
  const attemptReconnect = useCallback(() => {
    if (isOnline) return; // 이미 온라인 상태면 무시
    
    setIsReconnecting(true);
    
    // 네트워크 요청을 통해 연결 확인
    fetch('/api/ping', { 
      method: 'HEAD',
      cache: 'no-cache',
      timeout: 5000 
    })
      .then(() => {
        // 성공하면 온라인 상태로 설정
        if (!navigator.onLine) {
          // 브라우저가 아직 오프라인으로 인식하는 경우 강제로 이벤트 발생
          window.dispatchEvent(new Event('online'));
        } else {
          handleOnline();
        }
      })
      .catch(() => {
        // 실패하면 오프라인 상태 유지
        setIsReconnecting(false);
      });
  }, [isOnline, handleOnline]);

  // 네트워크 상태 변경 이벤트 리스너 등록
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 연결 유형 초기 감지
    detectConnectionType();
    
    // NetworkInformation API가 지원되는 경우 변경 이벤트 리스너 등록
    if (navigator.connection) {
      navigator.connection.addEventListener('change', detectConnectionType);
    }
    
    // 초기 상태를 이력에 추가
    setConnectionHistory([
      { status: navigator.onLine ? 'online' : 'offline', timestamp: new Date().toISOString() }
    ]);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', detectConnectionType);
      }
    };
  }, [handleOnline, handleOffline, detectConnectionType]);

  // 주기적인 상태 감지 (브라우저 이벤트가 놓칠 수 있는 상황 대비)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const currentOnline = navigator.onLine;
      
      // 상태 불일치 감지 (브라우저 상태와 컨텍스트 상태가 다른 경우)
      if (currentOnline !== isOnline) {
        if (currentOnline) {
          handleOnline();
        } else {
          handleOffline();
        }
      }
      
      // 연결 유형 업데이트
      detectConnectionType();
    }, 30000); // 30초마다 확인
    
    return () => clearInterval(checkInterval);
  }, [isOnline, handleOnline, handleOffline, detectConnectionType]);

  // 컨텍스트 값
  const value = {
    isOnline,
    connectionType,
    lastChanged,
    connectionHistory,
    isReconnecting,
    attemptReconnect
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext;
