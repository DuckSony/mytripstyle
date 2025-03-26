// src/components/common/InfiniteScroll.js
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import PropTypes from 'prop-types';
// throttle 함수 가져오기 수정
import { throttle } from '../../utils/optimizationUtils';

/**
 * 무한 스크롤 컴포넌트 - 개선 버전
 * 
 * 성능 및 UX 개선 포인트:
 * 1. 스크롤 이벤트 스로틀링 적용
 * 2. 스크롤 위치 복원 기능 강화
 * 3. 오류 처리 및 재시도 매커니즘 추가
 * 4. 로딩 UI 및 피드백 개선
 * 5. 접근성 기능 강화
 * 6. 메모리 누수 방지
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - 스크롤될 내용
 * @param {Function} props.loadMore - 추가 데이터를 로드하는 함수
 * @param {boolean} props.hasMore - 더 로드할 데이터가 있는지 여부
 * @param {boolean} props.loading - 로딩 중 여부 
 * @param {React.ReactNode|string} props.loadingComponent - 커스텀 로딩 컴포넌트
 * @param {string} props.loadingText - 로딩 중 표시할 텍스트
 * @param {React.ReactNode|string} props.endMessage - 더 이상 데이터가 없을 때 표시할 메시지
 * @param {number} props.threshold - 스크롤 감지 임계값 (픽셀)
 * @param {Object} props.scrollableTarget - 스크롤 가능한 대상 요소 참조
 * @param {Function} props.onScroll - 스크롤 이벤트 핸들러
 * @param {boolean} props.preserveScrollPosition - 스크롤 위치 보존 여부
 * @param {boolean} props.pullToRefreshEnabled - 당겨서 새로고침 활성화 여부
 * @param {Object} props.sx - 추가 스타일 속성
 * @param {number} props.throttleWait - 스로틀 대기 시간 (밀리초)
 * @param {boolean} props.showRetry - 로드 실패 시 재시도 버튼 표시 여부
 * @param {Function} props.onRetry - 재시도 버튼 클릭 핸들러
 * @param {boolean} props.disabled - 비활성화 여부
 * @returns {JSX.Element}
 */
const InfiniteScroll = ({
  children,
  loadMore,
  hasMore = false,
  loading = false,
  loadingComponent = null,
  loadingText = '로딩 중...',
  endMessage = '더 이상 데이터가 없습니다.',
  threshold = 200,
  scrollableTarget = null,
  onScroll = null,
  preserveScrollPosition = true,
  pullToRefreshEnabled = false,
  sx = {},
  throttleWait = 150,
  showRetry = false,
  onRetry = null,
  disabled = false,
  ...rest
}) => {

// 내부 상태
const [isFetching, setIsFetching] = useState(false);
const [loadError, setLoadError] = useState(false);

// 참조 객체
const scrollRef = useRef(null);
const loadMoreRef = useRef(null);
const prevScrollTop = useRef(0);
const scrollDirection = useRef('down');
const mountedRef = useRef(true);
const lastRequestTime = useRef(0);

// 디버그 로그 함수
const logDebug = (message, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[InfiniteScroll] ${message}`, data || '');
  }
};

// 성능 향상을 위한 최소 요청 간격 (밀리초)
const MIN_REQUEST_INTERVAL = 300;

// 유효한 스크롤 컨테이너 찾기
const getScrollableTarget = useCallback(() => {
  if (scrollableTarget) {
    return scrollableTarget;
  }
  return window;
}, [scrollableTarget]);

// 스크롤 방향 감지
const detectScrollDirection = useCallback((currentScrollTop) => {
  if (currentScrollTop > prevScrollTop.current) {
    scrollDirection.current = 'down';
  } else {
    scrollDirection.current = 'up';
  }
  prevScrollTop.current = currentScrollTop;
}, []);

// 스크롤 위치 저장
const saveScrollPosition = useCallback(() => {
  if (!preserveScrollPosition) return;
  
  try {
    const container = getScrollableTarget();
    const scrollTop = container === window 
      ? window.pageYOffset || document.documentElement.scrollTop
      : container.scrollTop;
    
    prevScrollTop.current = scrollTop;
    
    // 세션 스토리지에도 저장 (새로고침 시 복원용)
    if (typeof window !== 'undefined') {
      const locationKey = window.location.pathname;
      sessionStorage.setItem(`infiniteScroll_${locationKey}`, scrollTop.toString());
    }
  } catch (error) {
    logDebug('스크롤 위치 저장 중 오류:', error);
  }
}, [getScrollableTarget, preserveScrollPosition]);

// 스크롤 위치 복원
const restoreScrollPosition = useCallback(() => {
  if (!preserveScrollPosition) return;
  
  try {
    // 세션 스토리지에서 저장된 위치 가져오기
    if (typeof window !== 'undefined') {
      const locationKey = window.location.pathname;
      const savedPosition = sessionStorage.getItem(`infiniteScroll_${locationKey}`);
      
      if (savedPosition) {
        const scrollTop = parseInt(savedPosition, 10);
        const container = getScrollableTarget();
        
        // 약간의 지연 후 스크롤 위치 복원
        setTimeout(() => {
          if (container === window) {
            window.scrollTo(0, scrollTop);
          } else if (container && container.scrollTop !== undefined) {
            container.scrollTop = scrollTop;
          }
          
          // 이전 스크롤 위치 업데이트
          prevScrollTop.current = scrollTop;
        }, 0);
      }
    }
  } catch (error) {
    logDebug('스크롤 위치 복원 중 오류:', error);
  }
}, [getScrollableTarget, preserveScrollPosition]);

// 데이터 로드 함수
const fetchMoreData = useCallback(async () => {
  if (!hasMore || loading || isFetching || disabled || !loadMore || loadError) return;
  
  // 최소 요청 간격 체크
  const now = Date.now();
  if (now - lastRequestTime.current < MIN_REQUEST_INTERVAL) {
    return;
  }
  
  lastRequestTime.current = now;
  
  if (mountedRef.current) {
    setIsFetching(true);
    setLoadError(false);
  }
  
  try {
    // 로드 함수가 Promise를 반환하는지 확인
    const result = loadMore();
    
    if (result && typeof result.then === 'function') {
      await result;
    }
    
    if (mountedRef.current) {
      setIsFetching(false);
    }
  } catch (error) {
    logDebug('데이터 로드 중 오류 발생:', error);
    
    if (mountedRef.current) {
      setIsFetching(false);
      setLoadError(true);
    }
  }
}, [hasMore, loading, isFetching, disabled, loadMore, loadError]);

// 스크롤 이벤트 핸들러 (최적화 버전)
const handleScroll = useMemo(() => {
  // throttle 함수를 사용해 스크롤 이벤트 최적화
  return throttle(() => {
    if (loading || isFetching || !hasMore || disabled || loadError) return;
    
    try {
      const container = getScrollableTarget();
      const scrollTop = container === window 
        ? window.pageYOffset || document.documentElement.scrollTop
        : container.scrollTop;
      
      // 스크롤 방향 감지 (성능 최적화를 위해 주석 처리)
      detectScrollDirection(scrollTop);
      
      // 위로 스크롤 중이면 무시 (성능 최적화)
      if (scrollDirection.current !== 'down') return;
      
      if (loadMoreRef.current) {
        const loadMoreElement = loadMoreRef.current;
        const elementRect = loadMoreElement.getBoundingClientRect();
        
        // 뷰포트의 높이
        const viewportHeight = container === window 
          ? window.innerHeight || document.documentElement.clientHeight
          : container.clientHeight;
        
        // 요소가 뷰포트 하단에서 threshold 픽셀 이내일 때 데이터 로드
        if (elementRect.top - viewportHeight <= threshold) {
          fetchMoreData();
        }
      }
      
      // 사용자 정의 스크롤 핸들러 호출
      if (onScroll && typeof onScroll === 'function') {
        onScroll({ target: container, scrollTop });
      }
    } catch (error) {
      logDebug('스크롤 이벤트 처리 중 오류:', error);
    }
  }, throttleWait);
}, [
  loading, isFetching, hasMore, disabled, loadError, 
  getScrollableTarget, detectScrollDirection, 
  threshold, fetchMoreData, onScroll, throttleWait
]);

// 재시도 버튼 클릭 핸들러
const handleRetry = useCallback(() => {
  setLoadError(false);
  
  // 사용자 정의 재시도 핸들러가 있으면 호출
  if (onRetry && typeof onRetry === 'function') {
    onRetry();
  } else {
    fetchMoreData();
  }
}, [fetchMoreData, onRetry]);

// 스크롤 이벤트 리스너 설정
useEffect(() => {
  mountedRef.current = true;
  
  const container = getScrollableTarget();
  
  // 스크롤 위치 복원
  restoreScrollPosition();
  
  // 이벤트 리스너 등록
  container.addEventListener('scroll', handleScroll, {
    passive: true // 성능 최적화를 위한 passive 옵션
  });
  
  // 초기 체크 (페이지 로드 시 이미 표시되는 경우)
  setTimeout(() => {
    if (mountedRef.current) {
      handleScroll();
    }
  }, 100);
  
  return () => {
    mountedRef.current = false;
    container.removeEventListener('scroll', handleScroll);
    
    // 언마운트 시 스크롤 위치 저장
    saveScrollPosition();
  };
}, [getScrollableTarget, handleScroll, restoreScrollPosition, saveScrollPosition]);

// 창 크기 변경 이벤트 감지 (반응형 대응)
useEffect(() => {
  const handleResize = throttle(() => {
    if (mountedRef.current) {
      handleScroll();
    }
  }, 100);
  
  window.addEventListener('resize', handleResize, { passive: true });
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, [handleScroll]);

// 온라인 상태 변경 감지
useEffect(() => {
  const handleOnline = () => {
    if (mountedRef.current && loadError) {
      // 오프라인에서 온라인으로 변경될 때 오류 상태 초기화
      setLoadError(false);
      
      // 약간의 지연 후 데이터 로드 재시도
      setTimeout(() => {
        if (mountedRef.current && !loading && !isFetching && hasMore) {
          fetchMoreData();
        }
      }, 1000);
    }
  };
  
  window.addEventListener('online', handleOnline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}, [loading, isFetching, hasMore, loadError, fetchMoreData]);

// 로딩 인디케이터 렌더링
const renderLoader = () => {
  if (loadingComponent) {
    return loadingComponent;
  }
  
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      py: 3
    }}>
      <CircularProgress size={24} thickness={4} />
      {loadingText && (
        <Typography variant="body2" color="text.secondary">
          {loadingText}
        </Typography>
      )}
    </Box>
  );
};

// 오류 메시지 및 재시도 버튼 렌더링
const renderError = () => {
  if (!loadError || !showRetry) return null;
  
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 3,
      gap: 2
    }}>
      <Typography variant="body2" color="error.main">
        데이터를 불러오는 중 문제가 발생했습니다.
      </Typography>
      
      <Button
        variant="outlined"
        color="primary"
        size="small"
        startIcon={<RefreshIcon />}
        onClick={handleRetry}
      >
        다시 시도
      </Button>
    </Box>
  );
};

// 더 이상 데이터가 없을 때 메시지 렌더링
const renderEndMessage = () => {
  if (hasMore || !endMessage) return null;
  
  return (
    <Box sx={{
      textAlign: 'center',
      py: 3
    }}>
      {typeof endMessage === 'string' ? (
        <Typography variant="body2" color="text.secondary">
          {endMessage}
        </Typography>
      ) : (
        endMessage
      )}
    </Box>
  );
};

return (
  <Box 
    ref={scrollRef} 
    sx={{ 
      position: 'relative', 
      scrollBehavior: 'smooth',
      ...sx 
    }} 
    {...rest}
    role="region"
    aria-live="polite"
    aria-label="스크롤 가능한 컨텐츠"
  >
    {/* 메인 컨텐츠 */}
    {children}
    
    {/* 로드 트리거 영역 */}
    <Box
      ref={loadMoreRef}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        py: 2,
        minHeight: '50px'
      }}
      role="status"
      aria-busy={loading || isFetching}
    >
      {/* 로딩 중 UI */}
      {(loading || isFetching) && renderLoader()}
      
      {/* 오류 UI */}
      {renderError()}
      
      {/* 더 이상 데이터가 없을 때 UI */}
      {renderEndMessage()}
    </Box>
  </Box>
);
};

// 프롭 타입 정의
InfiniteScroll.propTypes = {
children: PropTypes.node.isRequired,
loadMore: PropTypes.func.isRequired,
hasMore: PropTypes.bool,
loading: PropTypes.bool,
loadingComponent: PropTypes.node,
loadingText: PropTypes.string,
endMessage: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
threshold: PropTypes.number,
scrollableTarget: PropTypes.object,
onScroll: PropTypes.func,
preserveScrollPosition: PropTypes.bool,
pullToRefreshEnabled: PropTypes.bool,
sx: PropTypes.object,
throttleWait: PropTypes.number,
showRetry: PropTypes.bool,
onRetry: PropTypes.func,
disabled: PropTypes.bool
};

export default InfiniteScroll;
