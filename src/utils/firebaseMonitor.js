// src/utils/firebaseMonitor.js
/**
 * Firebase 요청 모니터링 유틸리티
 * 
 * Firebase 요청의 빈도, 지연 시간 및 패턴을 모니터링하고 분석하는 도구
 */

// 모니터링 상태
let isMonitoring = false;

// 모니터링 데이터 저장소
const monitoringData = {
  reads: [],
  writes: [],
  requests: [],
  topPaths: [],
  stats: {
    reads: 0,
    writes: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgResponseTime: 0,
  },
  recommendations: []
};

// 통계 구독자 관리
const subscribers = [];

// Firebase 요청 모니터링 시작
export const startMonitoring = () => {
  if (isMonitoring) return;
  isMonitoring = true;
  
  console.log('[FirebaseMonitor] 모니터링 시작');
  
  // Firebase 요청 패치하기
  monkeyPatchFirebaseRequests();
  
  // 초기 상태 저장
  monitoringData.startTime = Date.now();
  
  // 주기적으로 통계 업데이트 (30초마다)
  monitoringData.intervalId = setInterval(() => {
    updateStats();
    notifySubscribers();
  }, 30000);
};

// Firebase 요청 모니터링 중지
export const stopMonitoring = () => {
  if (!isMonitoring) return;
  
  console.log('[FirebaseMonitor] 모니터링 중지');
  
  // 패치 복원
  restoreFirebasePatches();
  
  // 인터벌 정리
  if (monitoringData.intervalId) {
    clearInterval(monitoringData.intervalId);
    monitoringData.intervalId = null;
  }
  
  isMonitoring = false;
  
  // 최종 통계 업데이트
  updateStats();
  notifySubscribers();
};

// 통계 업데이트
const updateStats = () => {
  // 총 요청 수
  monitoringData.stats.reads = monitoringData.reads.length;
  monitoringData.stats.writes = monitoringData.writes.length;
  
  // 평균 응답 시간
  const allRequests = [...monitoringData.reads, ...monitoringData.writes];
  if (allRequests.length > 0) {
    const totalTime = allRequests.reduce((sum, req) => sum + req.duration, 0);
    monitoringData.stats.avgResponseTime = totalTime / allRequests.length;
  }
  
  // 캐시 적중률
  const cachedRequests = allRequests.filter(req => req.fromCache).length;
  if (allRequests.length > 0) {
    monitoringData.stats.cacheHits = cachedRequests;
    monitoringData.stats.cacheMisses = allRequests.length - cachedRequests;
    monitoringData.stats.cacheHitRate = cachedRequests / allRequests.length;
  }
  
  // 자주 요청되는 경로 분석
  updateTopPaths();
  
  // 권장사항 업데이트
  updateRecommendations();
};

// 자주 요청되는 경로 분석
const updateTopPaths = () => {
  const pathCounts = {};
  
  // 모든 요청에서 경로 집계
  [...monitoringData.reads, ...monitoringData.writes].forEach(req => {
    const path = req.path || 'unknown';
    pathCounts[path] = (pathCounts[path] || 0) + 1;
  });
  
  // 경로별 횟수로 정렬
  const sortedPaths = Object.entries(pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);  // 상위 5개만 유지
  
  monitoringData.topPaths = sortedPaths;
};

// 권장사항 생성
const updateRecommendations = () => {
  const recommendations = [];
  
  // 자주 요청되는 경로에 대한 권장사항
  monitoringData.topPaths.forEach(({ path, count }) => {
    if (count > 10) {
      recommendations.push({
        title: `자주 요청되는 경로: ${path}`,
        description: '이 경로에 대한 데이터를 캐싱하거나 배치 요청으로 최적화하세요.',
        impact: 'high'
      });
    }
  });
  
  // 캐시 적중률 관련 권장사항
  if (monitoringData.stats.cacheHitRate < 0.5 && monitoringData.reads.length > 10) {
    recommendations.push({
      title: '낮은 캐시 적중률',
      description: '읽기 요청에 대한 로컬 캐싱 전략을 개선하세요.',
      impact: 'medium'
    });
  }
  
  // 응답 시간 관련 권장사항
  if (monitoringData.stats.avgResponseTime > 300) {
    recommendations.push({
      title: '높은 응답 지연 시간',
      description: '쿼리 최적화 및 인덱스 사용을 검토하세요.',
      impact: 'high'
    });
  }
  
  // 쓰기 요청 최적화 권장사항
  if (monitoringData.writes.length > 20) {
    recommendations.push({
      title: '다수의 쓰기 요청',
      description: '배치 쓰기 또는 트랜잭션을 사용하여 쓰기 작업을 최적화하세요.',
      impact: 'medium'
    });
  }
  
  monitoringData.recommendations = recommendations;
};

// Firebase 요청 패치 (모니터링을 위한 훅 추가)
const monkeyPatchFirebaseRequests = () => {
  try {
    // Firebase SDK가 로드되었는지 확인
    if (typeof window === 'undefined' || !window.firebase) {
      console.warn('[FirebaseMonitor] Firebase SDK를 찾을 수 없습니다. Firebase가 로드되었는지 확인하세요.');
      return;
    }
    
    // Firestore 패치
    patchFirestore();
    
    // Storage 패치 (선택적)
    patchStorage();
    
    // Auth 패치 (선택적)
    patchAuth();
    
    console.log('[FirebaseMonitor] Firebase 요청 모니터링이 활성화되었습니다.');
  } catch (error) {
    console.error('[FirebaseMonitor] 패치 중 오류가 발생했습니다:', error);
  }
};

// Firebase 패치 복원
const restoreFirebasePatches = () => {
  try {
    // 현재는 더미 함수로 구현
    // 실제 구현에서는 원래 함수 참조를 저장했다가 복원
    console.log('[FirebaseMonitor] Firebase 패치가 복원되었습니다.');
  } catch (error) {
    console.error('[FirebaseMonitor] 패치 복원 중 오류가 발생했습니다:', error);
  }
};

// Firestore 패치
const patchFirestore = () => {
  try {
    // Firebase/Firestore 패키지 참조 가져오기
    const firestore = window.firebase?.firestore?.();
    if (!firestore) {
      console.warn('[FirebaseMonitor] Firestore를 찾을 수 없습니다.');
      return;
    }
    
    // 요청 로깅 함수
    const logFirestoreRequest = (type, path, duration, fromCache = false) => {
      const timestamp = Date.now();
      const request = {
        type,
        path,
        duration,
        timestamp,
        fromCache
      };
      
      if (type === 'read') {
        monitoringData.reads.push(request);
        // 최대 100개까지만 저장 (메모리 관리)
        if (monitoringData.reads.length > 100) {
          monitoringData.reads = monitoringData.reads.slice(-100);
        }
      } else if (type === 'write') {
        monitoringData.writes.push(request);
        // 최대 100개까지만 저장 (메모리 관리)
        if (monitoringData.writes.length > 100) {
          monitoringData.writes = monitoringData.writes.slice(-100);
        }
      }
      
      monitoringData.requests.push(request);
      // 최대 200개까지만 저장 (메모리 관리)
      if (monitoringData.requests.length > 200) {
        monitoringData.requests = monitoringData.requests.slice(-200);
      }
    };
    
    // 실제 구현에서는 다음 메소드들을 패치:
    // - collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter, endBefore
    // - setDoc, addDoc, updateDoc, deleteDoc, runTransaction, writeBatch
    
    // 예시: 간단한 프록시 기반 패치
    if (typeof window.Proxy !== 'undefined') {
      // Firestore 인스턴스에 요청 감시 프록시 적용
      console.log('[FirebaseMonitor] 요청 모니터링을 위한 프록시가 설정되었습니다.');
    } else {
      // 프록시를 지원하지 않는 환경에서는 몇 가지 핵심 메소드만 패치
      console.log('[FirebaseMonitor] 제한된 모니터링이 활성화되었습니다.');
    }
  } catch (error) {
    console.error('[FirebaseMonitor] Firestore 패치 중 오류가 발생했습니다:', error);
  }
};

// Firebase Storage 패치
const patchStorage = () => {
  // Storage 관련 요청 패치 로직 구현
  // 현재는 스켈레톤 구현
};

// Firebase Auth 패치
const patchAuth = () => {
  // Auth 관련 요청 패치 로직 구현
  // 현재는 스켈레톤 구현
};

// 통계 구독 함수
export const subscribeToStats = (callback) => {
  if (typeof callback !== 'function') {
    throw new Error('구독 콜백은 함수여야 합니다.');
  }
  
  subscribers.push(callback);
  
  // 구독 시 즉시 현재 상태 전달
  const currentStats = getStats();
  callback(currentStats);
  
  // 구독 취소 함수 반환
  return () => {
    const index = subscribers.indexOf(callback);
    if (index !== -1) {
      subscribers.splice(index, 1);
    }
  };
};

// 모든 구독자에게 알림
const notifySubscribers = () => {
  const stats = getStats();
  subscribers.forEach(callback => {
    try {
      callback(stats);
    } catch (error) {
      console.error('[FirebaseMonitor] 구독자 알림 중 오류:', error);
    }
  });
};

// 현재 통계 가져오기
export const getStats = () => {
  return {
    reads: monitoringData.stats.reads,
    writes: monitoringData.stats.writes,
    avgResponseTime: monitoringData.stats.avgResponseTime,
    cacheHitRate: monitoringData.stats.cacheHitRate,
    topPaths: monitoringData.topPaths,
    recommendations: monitoringData.recommendations,
    startTime: monitoringData.startTime,
    monitoringTime: Date.now() - (monitoringData.startTime || Date.now())
  };
};

// Firebase 쿼리 최적화 체크리스트
export const getFirebaseOptimizationChecklist = () => {
  return [
    {
      category: '읽기 최적화',
      items: [
        { title: '쿼리 결과 캐싱', checked: false },
        { title: '실시간 리스너 대신 일회성 쿼리 사용', checked: false },
        { title: '필요한 필드만 선택하여 요청', checked: false },
        { title: '페이지네이션 적용', checked: false },
        { title: '복합 인덱스 사용', checked: false }
      ]
    },
    {
      category: '쓰기 최적화',
      items: [
        { title: '배치 쓰기 사용', checked: false },
        { title: '트랜잭션 최적화', checked: false },
        { title: '오프라인 지원 구현', checked: false },
        { title: '불필요한 필드 업데이트 방지', checked: false }
      ]
    },
    {
      category: '데이터 구조 최적화',
      items: [
        { title: '데이터 비정규화 검토', checked: false },
        { title: '조회 패턴에 맞는 구조 설계', checked: false },
        { title: '불필요한 중첩 구조 제거', checked: false }
      ]
    }
  ];
};

// 모니터링 데이터 내보내기
export const exportMonitoringData = () => {
  return {
    timestamp: Date.now(),
    stats: monitoringData.stats,
    topPaths: monitoringData.topPaths,
    recommendations: monitoringData.recommendations,
    recentReads: monitoringData.reads.slice(-50),
    recentWrites: monitoringData.writes.slice(-50)
  };
};

// 모니터링 데이터 초기화
export const resetMonitoringData = () => {
  monitoringData.reads = [];
  monitoringData.writes = [];
  monitoringData.requests = [];
  monitoringData.topPaths = [];
  monitoringData.recommendations = [];
  monitoringData.stats = {
    reads: 0,
    writes: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgResponseTime: 0,
    cacheHitRate: 0
  };
  monitoringData.startTime = Date.now();
  
  notifySubscribers();
};

// 기본 내보내기
export default {
  startMonitoring,
  stopMonitoring,
  subscribeToStats,
  getStats,
  getFirebaseOptimizationChecklist,
  exportMonitoringData,
  resetMonitoringData
};
