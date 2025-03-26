// src/components/performance/PerformanceMonitor.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  startPerformanceMonitoring,
  stopPerformanceMonitoring,
  subscribeToPerformanceEvents,
  getPerformanceData,
  collectPerformanceMetrics
} from '../../utils/optimizationUtils';

// 테마 상수
const THEME = {
  good: '#4caf50',     // 녹색 (좋음)
  warning: '#ff9800',  // 주황색 (경고)
  critical: '#f44336', // 빨간색 (심각)
  bg: 'rgba(0, 0, 0, 0.8)',
  text: '#ffffff',
  border: '#333333'
};

/**
 * 성능 모니터링 컴포넌트
 * 앱의 성능 지표를 실시간으로 모니터링하고 시각화합니다.
 * 개발 모드에서만 활성화됩니다.
 */
const PerformanceMonitor = ({ visible = true, position = 'bottom-right' }) => {
  // 상태 관리
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [performanceData, setPerformanceData] = useState({
    renders: [],
    interactions: [],
    networkRequests: []
  });
  const [coreMetrics, setCoreMetrics] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'renders', 'interactions', 'network'
  const [selectedTab, setSelectedTab] = useState('events'); // 'events', 'firebase', 'lighthouse'
  const [firebaseStats, setFirebaseStats] = useState(null);
  const [lighthouseData, setLighthouseData] = useState(null);
  const [isLighthouseLoading, setIsLighthouseLoading] = useState(false);
  
  // 개발 환경에서만 활성화하기 위한 상태
  const [isDev] = useState(process.env.NODE_ENV === 'development');
  
  // 위치 계산
  const positionStyles = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '10px' },
    'bottom-left': { bottom: '10px', left: '10px' },
    'bottom-right': { bottom: '10px', right: '10px' }
  };
  const positionStyle = positionStyles[position] || positionStyles['bottom-right'];
  
  // 참조
  const unsubscribeRef = useRef(null);
  const timerRef = useRef(null);
  const firebaseMonitoringRef = useRef(null);

 // 성능 이벤트 핸들러
 const handlePerformanceEvent = useCallback((event) => {
  setLastEvent(event);
  
  if (event.type === 'measure') {
    setPerformanceData(prev => {
      const category = event.category;
      const newData = { ...prev };
      
      // 최대 100개까지만 저장 (메모리 관리)
      if (newData[category] && newData[category].length >= 100) {
        newData[category] = [...newData[category].slice(-99), event];
      } else if (newData[category]) {
        newData[category] = [...newData[category], event];
      }
      
      return newData;
    });
  }
}, []);

// Firebase 요청 모니터링 시작
const startFirebaseMonitoring = useCallback(() => {
  try {
    // Firebase 모니터링 라이브러리 동적 로드
    import('../../utils/firebaseMonitor')
      .then(module => {
        if (module.startMonitoring) {
          const { startMonitoring, subscribeToStats } = module;
          startMonitoring();
          
          // Firebase 통계 구독
          const unsubscribe = subscribeToStats((stats) => {
            setFirebaseStats(stats);
          });
          
          firebaseMonitoringRef.current = unsubscribe;
        } else {
          console.warn('Firebase 모니터링 라이브러리를 찾을 수 없습니다.');
        }
      })
      .catch(err => {
        console.error('Firebase 모니터링 모듈 로드 실패:', err);
      });
  } catch (error) {
    console.error('Firebase 모니터링 초기화 오류:', error);
  }
}, []);

// Firebase 요청 모니터링 중지
const stopFirebaseMonitoring = useCallback(() => {
  try {
    // 구독 해제
    if (firebaseMonitoringRef.current) {
      firebaseMonitoringRef.current();
      firebaseMonitoringRef.current = null;
    }
    
    // 모니터링 중지
    import('../../utils/firebaseMonitor')
      .then(module => {
        if (module.stopMonitoring) {
          module.stopMonitoring();
        }
      })
      .catch(console.error);
  } catch (error) {
    console.error('Firebase 모니터링 중지 오류:', error);
  }
}, []);

// Lighthouse 점수 측정
const measureLighthouseScores = useCallback(async () => {
  try {
    setIsLighthouseLoading(true);
    
    // Lighthouse 측정 유틸리티 동적 로드
    const { measureLighthousePerformance } = await import('../../utils/performanceUtils');
    const data = await measureLighthousePerformance();
    
    setLighthouseData(data);
  } catch (error) {
    console.error('Lighthouse 점수 측정 오류:', error);
  } finally {
    setIsLighthouseLoading(false);
  }
}, []);

// 모니터링 시작
const startMonitoring = useCallback(async () => {
  startPerformanceMonitoring();
  setIsActive(true);
  
  // 성능 이벤트 구독
  if (unsubscribeRef.current) {
    unsubscribeRef.current();
  }
  
  unsubscribeRef.current = subscribeToPerformanceEvents(handlePerformanceEvent);
  
  // Firebase 모니터링 시작
  startFirebaseMonitoring();
  
  // Core Metrics 수집
  try {
    const metrics = await collectPerformanceMetrics();
    setCoreMetrics(metrics);
  } catch (error) {
    console.error('Core Metrics 수집 중 오류:', error);
  }
  
  // 주기적으로 Core Metrics 갱신
  timerRef.current = setInterval(async () => {
    try {
      const metrics = await collectPerformanceMetrics();
      setCoreMetrics(metrics);
    } catch (error) {
      console.error('Core Metrics 갱신 중 오류:', error);
    }
  }, 10000); // 10초마다 갱신
}, [handlePerformanceEvent, startFirebaseMonitoring]);

// 모니터링 중지
const stopMonitoring = useCallback(() => {
  stopPerformanceMonitoring();
  setIsActive(false);
  
  // 성능 이벤트 구독 해제
  if (unsubscribeRef.current) {
    unsubscribeRef.current();
    unsubscribeRef.current = null;
  }
  
  // Firebase 모니터링 중지
  stopFirebaseMonitoring();
  
  // 타이머 정리
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
  
  // 최종 데이터 가져오기
  setPerformanceData(getPerformanceData());
}, [stopFirebaseMonitoring]);

// 확장/축소 토글
const toggleExpand = useCallback(() => {
  setIsExpanded(prev => !prev);
}, []);

// 모니터링 토글
const toggleMonitoring = useCallback(() => {
  if (isActive) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
}, [isActive, startMonitoring, stopMonitoring]);

// 필터 변경
const changeFilter = useCallback((newFilter) => {
  setFilter(newFilter);
}, []);

// 탭 변경
const changeTab = useCallback((newTab) => {
  setSelectedTab(newTab);
  
  // Lighthouse 탭으로 전환 시 데이터 로드
  if (newTab === 'lighthouse' && !lighthouseData && !isLighthouseLoading) {
    measureLighthouseScores();
  }
}, [lighthouseData, isLighthouseLoading, measureLighthouseScores]);

// 데이터 초기화
const clearData = useCallback(() => {
  setPerformanceData({
    renders: [],
    interactions: [],
    networkRequests: []
  });
  setLastEvent(null);
}, []);

// 컴포넌트 마운트 시
useEffect(() => {
  // 개발 환경에서만 실행
  if (!isDev) return;
  
  // 초기 Core Metrics 수집
  collectPerformanceMetrics().then(metrics => {
    setCoreMetrics(metrics);
  }).catch(error => {
    console.error('초기 Core Metrics 수집 중 오류:', error);
  });
  
  return () => {
    // 컴포넌트 언마운트 시 정리
    if (isActive) {
      stopMonitoring();
    }
  };
}, [isDev, isActive, stopMonitoring]);

// 필터링된 데이터 계산
const getFilteredData = useCallback(() => {
  if (filter === 'all') {
    const allEvents = [
      ...(performanceData.renders || []),
      ...(performanceData.interactions || []),
      ...(performanceData.networkRequests || [])
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return allEvents;
  }
  
  const categoryMap = {
    'renders': 'renders',
    'interactions': 'interactions',
    'network': 'networkRequests'
  };
  
  return performanceData[categoryMap[filter] || 'renders'] || [];
}, [filter, performanceData]);

// 개발 환경이 아니거나 visible이 false이면 렌더링하지 않음
if (!isDev || !visible) {
  return null;
}

// 필터링된 데이터 가져오기
const filteredData = getFilteredData();

// 컴포넌트 렌더링
return (
  <div 
    style={{
      position: 'fixed',
      zIndex: 9999,
      ...positionStyle,
      width: isExpanded ? '340px' : '60px',
      backgroundColor: THEME.bg,
      borderRadius: '5px',
      border: `1px solid ${THEME.border}`,
      color: THEME.text,
      fontFamily: 'monospace',
      fontSize: '12px',
      transition: 'all 0.3s ease',
      maxHeight: isExpanded ? '80vh' : '60px',
      overflow: 'hidden',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)'
    }}
  >
    {/* 헤더 */}
    <div 
      style={{ 
        padding: '10px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: isExpanded ? `1px solid ${THEME.border}` : 'none',
        cursor: 'pointer',
        backgroundColor: 'rgba(0, 0, 0, 0.2)'
      }}
      onClick={toggleExpand}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '8px' }}>
          {isActive ? '🟢' : '⚪'}
        </span>
        {isExpanded ? 'Performance Monitor' : ''}
      </div>
      <div>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            toggleMonitoring(); 
          }}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: THEME.text,
            cursor: 'pointer',
            marginRight: '8px',
            fontSize: '14px'
          }}
        >
          {isActive ? '⏹️' : '▶️'}
        </button>
        <span>{isExpanded ? '🔼' : '🔽'}</span>
      </div>
    </div>

    {/* 확장된 콘텐츠 */}
    {isExpanded && (
        <div>
          {/* 탭 네비게이션 */}
          <div style={{ display: 'flex', padding: '5px', borderBottom: `1px solid ${THEME.border}` }}>
            {['events', 'firebase', 'lighthouse', 'memory'].map((tab) => (
              <button
                key={tab}
                onClick={() => changeTab(tab)}
                style={{
                  flex: 1,
                  padding: '5px',
                  backgroundColor: selectedTab === tab ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  color: THEME.text,
                  cursor: 'pointer',
                  fontSize: '11px',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* 이벤트 탭 */}
          {selectedTab === 'events' && (
            <>
              {/* 필터 탭 */}
              <div style={{ display: 'flex', padding: '5px', borderBottom: `1px solid ${THEME.border}` }}>
                {['all', 'renders', 'interactions', 'network'].map((f) => (
                  <button
                    key={f}
                    onClick={() => changeFilter(f)}
                    style={{
                      flex: 1,
                      padding: '5px',
                      backgroundColor: filter === f ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      color: THEME.text,
                      cursor: 'pointer',
                      fontSize: '11px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {f === 'network' ? 'Network' : f}
                  </button>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearData();
                  }}
                  style={{
                    padding: '5px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: THEME.text,
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  🗑️
                </button>
              </div>

              {/* 핵심 성능 지표 (Core Web Vitals) */}
              <div style={{ padding: '10px', borderBottom: `1px solid ${THEME.border}` }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px' }}>Core Web Vitals</h4>
                
                {coreMetrics ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '10px' }}>
                    {/* FCP 부분 */}
                    <div>
                      <div style={{ fontWeight: 'bold' }}>FCP:</div>
                      <div style={{ 
                        color: coreMetrics.paint?.firstContentfulPaint?.startTime < 2000 
                          ? THEME.good 
                          : coreMetrics.paint?.firstContentfulPaint?.startTime < 4000 
                            ? THEME.warning 
                            : THEME.critical 
                      }}>
                        {coreMetrics.paint?.firstContentfulPaint
                          ? `${(coreMetrics.paint.firstContentfulPaint.startTime).toFixed(0)}ms`
                          : 'N/A'}
                      </div>
                    </div>
                    
                    {/* LCP 부분 */}
                    <div>
                      <div style={{ fontWeight: 'bold' }}>LCP:</div>
                      <div style={{ 
                        color: coreMetrics.largestContentfulPaint?.startTime < 2500 
                          ? THEME.good 
                          : coreMetrics.largestContentfulPaint?.startTime < 4000 
                            ? THEME.warning 
                            : THEME.critical 
                      }}>
                        {coreMetrics.largestContentfulPaint
                          ? `${(coreMetrics.largestContentfulPaint.startTime).toFixed(0)}ms`
                          : 'N/A'}
                      </div>
                    </div>
                    
                    {/* 메모리 부분 */}
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Memory:</div>
                      <div>
                        {coreMetrics.memory
                          ? `${coreMetrics.memory.used}/${coreMetrics.memory.total}MB (${coreMetrics.memory.percentage}%)`
                          : 'N/A'}
                      </div>
                    </div>
                    
                    {/* 리소스 부분 */}
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Resources:</div>
                      <div>
                        {coreMetrics.resources
                          ? `${coreMetrics.resources.count} (${(coreMetrics.resources.totalSize / 1024).toFixed(1)}KB)`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    데이터 수집 중...
                  </div>
                )}
              </div>

              {/* 성능 이벤트 목록 */}
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                padding: '5px'
              }}>
                {filteredData.length > 0 ? (
                  filteredData.map((event, index) => (
                    <div 
                      key={`${event.label}-${index}`}
                      style={{ 
                        padding: '5px',
                        borderBottom: `1px solid ${THEME.border}`,
                        fontSize: '10px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.label}
                      </div>
                      <div style={{ 
                        color: event.level === 'good' 
                          ? THEME.good 
                          : event.level === 'warning' 
                            ? THEME.warning 
                            : THEME.critical,
                        marginLeft: '8px',
                        fontWeight: 'bold'
                      }}>
                        {event.duration.toFixed(1)}ms
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ 
                    padding: '10px', 
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '10px'
                  }}>
                    데이터가 없습니다. 모니터링을 시작하세요.
                  </div>
                )}
              </div>

              {/* 성능 그래프 */}
              <div style={{ 
                height: '100px', 
                padding: '10px',
                borderTop: `1px solid ${THEME.border}`
              }}>
                <div style={{ 
                  height: '80px', 
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-around',
                  position: 'relative'
                }}>
                  {/* 기준선 영역 */}
                  <div style={{ 
                    position: 'absolute',
                    bottom: '48px',
                    left: 0,
                    right: 0,
                    borderBottom: `1px dashed ${THEME.good}`,
                    zIndex: 1
                  }}>
                    <span style={{ 
                      position: 'absolute',
                      right: '5px',
                      top: '-15px',
                      fontSize: '8px',
                      color: THEME.good
                    }}>
                      16.7ms (60fps)
                    </span>
                  </div>

                  <div style={{ 
                    position: 'absolute',
                    bottom: '24px',
                    left: 0,
                    right: 0,
                    borderBottom: `1px dashed ${THEME.warning}`,
                    zIndex: 1
                  }}>
                    <span style={{ 
                      position: 'absolute',
                      right: '5px',
                      top: '-15px',
                      fontSize: '8px',
                      color: THEME.warning
                    }}>
                      33.3ms (30fps)
                    </span>
                  </div>

                  {/* 그래프 바 렌더링 */}
                  {filteredData.slice(0, 20).map((event, index) => {
                    // 최대 높이를 80px로 설정, 100ms 이상은 최대 높이로 표시
                    const maxDuration = 100;
                    const height = Math.min(event.duration / maxDuration * 80, 80);
                    
                    return (
                      <div 
                        key={`bar-${index}`}
                        style={{ 
                          width: '5px',
                          height: `${height}px`,
                          backgroundColor: event.level === 'good' 
                            ? THEME.good 
                            : event.level === 'warning' 
                              ? THEME.warning 
                              : THEME.critical,
                          marginRight: '2px'
                        }}
                        title={`${event.label}: ${event.duration.toFixed(1)}ms`}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}

        {/* Firebase 탭 */}
        {selectedTab === 'firebase' && (
            <div style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px' }}>Firebase 요청 모니터링</h4>
              
              {firebaseStats ? (
                <>
                  {/* 요약 정보 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>읽기 요청</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{firebaseStats.reads || 0}</div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>쓰기 요청</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{firebaseStats.writes || 0}</div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>평균 응답 시간</div>
                      <div style={{ fontSize: '14px' }}>
                        {firebaseStats.avgResponseTime?.toFixed(1) || 0}ms
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>캐시 적중률</div>
                      <div style={{ fontSize: '14px' }}>
                        {firebaseStats.cacheHitRate ? `${(firebaseStats.cacheHitRate * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  {/* 경로 요약 */}
                  <div style={{ marginBottom: '15px' }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '11px' }}>자주 요청하는 경로</h5>
                    {firebaseStats.topPaths && firebaseStats.topPaths.length > 0 ? (
                      firebaseStats.topPaths.map((pathData, index) => (
                        <div 
                          key={`path-${index}`}
                          style={{ 
                            padding: '5px',
                            borderBottom: `1px solid ${THEME.border}`,
                            fontSize: '10px',
                            marginBottom: '5px'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              flex: 1
                            }}>
                              {pathData.path}
                            </span>
                            <span style={{ 
                              backgroundColor: pathData.count > 10 ? THEME.warning : 'transparent',
                              padding: '2px 4px',
                              borderRadius: '2px',
                              marginLeft: '5px',
                              fontSize: '9px',
                              fontWeight: 'bold'
                            }}>
                              {pathData.count}회
                            </span>
                          </div>
                          {pathData.count > 10 && (
                            <div style={{ fontSize: '9px', color: THEME.warning, marginTop: '3px' }}>
                              최적화 권장: 요청 수가 많습니다.
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                        요청 데이터가 없습니다.
                      </div>
                    )}
                  </div>
                  
                  {/* 최적화 권장사항 */}
                  <div>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '11px' }}>최적화 권장사항</h5>
                    {firebaseStats.recommendations && firebaseStats.recommendations.length > 0 ? (
                      firebaseStats.recommendations.map((rec, index) => (
                        <div 
                          key={`rec-${index}`}
                          style={{ 
                            padding: '5px',
                            backgroundColor: 'rgba(255, 152, 0, 0.1)',
                            borderLeft: `2px solid ${THEME.warning}`,
                            marginBottom: '5px',
                            fontSize: '9px'
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{rec.title}</div>
                          <div>{rec.description}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                        권장사항이 없습니다.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '10px'
                }}>
                  Firebase 모니터링 데이터 수집 중...
                </div>
              )}
            </div>
          )}

          {/* Lighthouse 탭 */}
          {selectedTab === 'lighthouse' && (
            <div style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: '0', fontSize: '12px' }}>Lighthouse 성능 점수</h4>
                <button
                  onClick={measureLighthouseScores}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: THEME.text,
                    padding: '3px 6px',
                    borderRadius: '3px',
                    fontSize: '9px',
                    cursor: 'pointer'
                  }}
                  disabled={isLighthouseLoading}
                >
                  {isLighthouseLoading ? '측정 중...' : '다시 측정'}
                </button>
              </div>
              
              {isLighthouseLoading ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '10px'
                }}>
                  Lighthouse 측정 중...
                </div>
              ) : lighthouseData ? (
                <>
                  {/* 주요 점수 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '8px',
                    marginBottom: '15px'
                  }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '3px' }}>성능</div>
                      <div style={{ 
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: `3px solid ${
                          lighthouseData.performance >= 90 ? THEME.good : 
                          lighthouseData.performance >= 50 ? THEME.warning : 
                          THEME.critical
                        }`,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {lighthouseData.performance || 0}
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '3px' }}>접근성</div>
                      <div style={{ 
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: `3px solid ${
                          lighthouseData.accessibility >= 90 ? THEME.good : 
                          lighthouseData.accessibility >= 50 ? THEME.warning : 
                          THEME.critical
                        }`,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {lighthouseData.accessibility || 0}
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '3px' }}>모범 사례</div>
                      <div style={{ 
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: `3px solid ${
                          lighthouseData.bestPractices >= 90 ? THEME.good : 
                          lighthouseData.bestPractices >= 50 ? THEME.warning : 
                          THEME.critical
                        }`,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {lighthouseData.bestPractices || 0}
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '3px' }}>SEO</div>
                      <div style={{ 
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: `3px solid ${
                          lighthouseData.seo >= 90 ? THEME.good : 
                          lighthouseData.seo >= 50 ? THEME.warning : 
                          THEME.critical
                        }`,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {lighthouseData.seo || 0}
                      </div>
                    </div>
                  </div>

                  {/* 주요 지표 */}
                  {lighthouseData.metrics && (
                    <div style={{ marginBottom: '15px' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '11px' }}>주요 지표</h5>
                      
                      <div style={{ fontSize: '10px' }}>
                        {/* FCP */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '5px',
                          padding: '3px 0',
                          borderBottom: `1px solid ${THEME.border}`
                        }}>
                          <span>First Contentful Paint</span>
                          <span style={{ 
                            color: lighthouseData.metrics.fcp < 1800 ? THEME.good : 
                                  lighthouseData.metrics.fcp < 3000 ? THEME.warning : 
                                  THEME.critical 
                          }}>
                            {(lighthouseData.metrics.fcp / 1000).toFixed(1)}s
                          </span>
                        </div>
                        
                        {/* LCP */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '5px',
                          padding: '3px 0',
                          borderBottom: `1px solid ${THEME.border}`
                        }}>
                          <span>Largest Contentful Paint</span>
                          <span style={{ 
                            color: lighthouseData.metrics.lcp < 2500 ? THEME.good : 
                                  lighthouseData.metrics.lcp < 4000 ? THEME.warning : 
                                  THEME.critical 
                          }}>
                            {(lighthouseData.metrics.lcp / 1000).toFixed(1)}s
                          </span>
                        </div>
                        
                        {/* TTI */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '5px',
                          padding: '3px 0',
                          borderBottom: `1px solid ${THEME.border}`
                        }}>
                          <span>Time to Interactive</span>
                          <span style={{ 
                            color: lighthouseData.metrics.tti < 3800 ? THEME.good : 
                                  lighthouseData.metrics.tti < 7300 ? THEME.warning : 
                                  THEME.critical 
                          }}>
                            {(lighthouseData.metrics.tti / 1000).toFixed(1)}s
                          </span>
                        </div>
                        
                        {/* CLS */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          marginBottom: '5px',
                          padding: '3px 0',
                          borderBottom: `1px solid ${THEME.border}`
                        }}>
                          <span>Cumulative Layout Shift</span>
                          <span style={{ 
                            color: lighthouseData.metrics.cls < 0.1 ? THEME.good : 
                                  lighthouseData.metrics.cls < 0.25 ? THEME.warning : 
                                  THEME.critical 
                          }}>
                            {lighthouseData.metrics.cls.toFixed(3)}
                          </span>
                        </div>
                        
                        {/* TBT */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '3px 0',
                          borderBottom: `1px solid ${THEME.border}`
                        }}>
                          <span>Total Blocking Time</span>
                          <span style={{ 
                            color: lighthouseData.metrics.tbt < 200 ? THEME.good : 
                                  lighthouseData.metrics.tbt < 600 ? THEME.warning : 
                                  THEME.critical 
                          }}>
                            {lighthouseData.metrics.tbt}ms
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 개선 권장사항 */}
                  {lighthouseData.improvements && lighthouseData.improvements.length > 0 && (
                    <div>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '11px' }}>개선 권장사항</h5>
                      
                      {lighthouseData.improvements.map((improvement, index) => (
                        <div 
                          key={`imp-${index}`}
                          style={{ 
                            padding: '5px',
                            backgroundColor: improvement.impact === 'high' ? 'rgba(244, 67, 54, 0.1)' : 
                                            improvement.impact === 'medium' ? 'rgba(255, 152, 0, 0.1)' : 
                                            'rgba(76, 175, 80, 0.1)',
                            borderLeft: `2px solid ${
                              improvement.impact === 'high' ? THEME.critical : 
                              improvement.impact === 'medium' ? THEME.warning : 
                              THEME.good
                            }`,
                            marginBottom: '5px',
                            fontSize: '9px'
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{improvement.title}</div>
                          <div>{improvement.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '10px'
                }}>
                  아직 측정된 Lighthouse 데이터가 없습니다.<br />
                  &apos;다시 측정&apos; 버튼을 클릭하여 성능을 분석해보세요.
                </div>
              )}
            </div>
          )}

          {/* 메모리 탭 */}
          {selectedTab === 'memory' && (
            <div style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px' }}>메모리 사용량 모니터링</h4>
              
              {coreMetrics && coreMetrics.memory ? (
                <>
                  {/* 요약 정보 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>사용 중인 JS 힙</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{coreMetrics.memory.used}MB</div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>총 할당</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{coreMetrics.memory.total}MB</div>
                    </div>
                    
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      textAlign: 'center',
                      gridColumn: '1 / span 2'
                    }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>사용률</div>
                      <div style={{ 
                        width: '100%',
                        height: '12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        marginTop: '5px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          width: `${coreMetrics.memory.percentage}%`,
                          height: '100%',
                          backgroundColor: coreMetrics.memory.percentage > 80 ? THEME.critical :
                                          coreMetrics.memory.percentage > 50 ? THEME.warning :
                                          THEME.good,
                          borderRadius: '6px'
                        }} />
                        <div style={{ 
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          right: '0',
                          bottom: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          color: '#fff',
                          textShadow: '0 0 2px rgba(0, 0, 0, 0.7)'
                        }}>
                          {coreMetrics.memory.percentage}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 리소스 정보 */}
                  {coreMetrics.resources && (
                    <div style={{ marginBottom: '15px' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '11px' }}>리소스 사용량</h5>
                      
                      <div style={{ 
                        padding: '8px', 
                        backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                        borderRadius: '4px',
                        fontSize: '10px'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginBottom: '5px'
                        }}>
                          <span>총 리소스</span>
                          <span>{coreMetrics.resources.count}개</span>
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginBottom: '5px'
                        }}>
                          <span>총 크기</span>
                          <span>{(coreMetrics.resources.totalSize / 1024).toFixed(1)}KB</span>
                        </div>
                        
                        {coreMetrics.resources.types && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ marginBottom: '5px', fontSize: '9px', fontWeight: 'bold' }}>유형별 분포</div>
                            
                            {Object.entries(coreMetrics.resources.types).map(([type, count]) => (
                              <div 
                                key={type}
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  marginBottom: '3px',
                                  fontSize: '9px'
                                }}
                              >
                                <span>{type}</span>
                                <span>{count}개</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* 메모리 최적화 권장사항 */}
                  <div>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '11px' }}>메모리 최적화 권장사항</h5>
                    
                    <div style={{ fontSize: '9px' }}>
                      <div style={{ 
                        padding: '5px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        marginBottom: '5px'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>메모리 누수 방지</div>
                        <ul style={{ margin: '0', paddingLeft: '15px' }}>
                          <li>컴포넌트 언마운트 시 이벤트 리스너 제거</li>
                          <li>useEffect 클린업 함수 활용</li>
                          <li>타이머 및 인터벌 정리</li>
                        </ul>
                      </div>
                      
                      <div style={{ 
                        padding: '5px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        marginBottom: '5px'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>렌더링 최적화</div>
                        <ul style={{ margin: '0', paddingLeft: '15px' }}>
                          <li>불필요한 리렌더링 방지 (React.memo, useMemo)</li>
                          <li>대형 리스트 가상화</li>
                          <li>이미지 지연 로딩 및 최적화</li>
                        </ul>
                      </div>
                      
                      <div style={{ 
                        padding: '5px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        marginBottom: '5px'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>번들 크기 최적화</div>
                        <ul style={{ margin: '0', paddingLeft: '15px' }}>
                          <li>코드 분할 및 지연 로딩</li>
                          <li>사용하지 않는 코드 제거</li>
                          <li>작은 라이브러리 사용 고려</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '10px'
                }}>
                  메모리 데이터 수집 중...
                </div>
              )}
            </div>
          )}

          {/* 푸터 영역 */}
          <div style={{ 
            padding: '5px 10px',
            borderTop: `1px solid ${THEME.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>
            <div>
              마지막 업데이트: {lastEvent ? new Date(lastEvent.timestamp).toLocaleTimeString() : 'N/A'}
            </div>
            <div>
              {isActive ? '모니터링 중' : '중지됨'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
