// src/components/common/PullToRefresh.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { RefreshRounded as RefreshIcon } from '@mui/icons-material';

/**
 * 당겨서 새로고침 컴포넌트 - 개선 버전
 * 
 * 주요 개선 사항:
 * 1. 성능 최적화 (애니메이션 프레임, 이벤트 수신 최적화)
 * 2. 접근성 향상
 * 3. 상태 관리 개선
 * 4. 시각적 피드백 향상
 * 5. 오류 처리 강화
 * 6. 기기 호환성 개선
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - 감싸질 컨텐츠
 * @param {Function} props.onRefresh - 새로고침 실행 함수 (Promise 반환 필요)
 * @param {number} props.pullThreshold - 새로고침 실행 임계값 (픽셀)
 * @param {boolean} props.disabled - 비활성화 여부
 * @param {string} props.pullText - 당길 때 표시할 텍스트
 * @param {string} props.releaseText - 놓을 때 표시할 텍스트
 * @param {string} props.refreshingText - 새로고침 중 표시할 텍스트
 * @param {string} props.completedText - 새로고침 완료 시 표시할 텍스트
 * @param {Object} props.containerProps - 컨테이너에 전달할 추가 props
 * @param {string} props.backgroundColor - 배경색
 * @param {Function} props.onStateChange - 상태 변경 핸들러
 * @param {number} props.minPullDuration - 최소 당김 지속 시간 (밀리초)
 * @returns {JSX.Element}
 */
const PullToRefresh = ({
  children,
  onRefresh,
  pullThreshold = 80,
  disabled = false,
  pullText = "당겨서 새로고침",
  releaseText = "놓아서 새로고침",
  refreshingText = "새로고침 중...",
  completedText = "새로고침 완료",
  containerProps = {},
  backgroundColor,
  onStateChange,
  minPullDuration = 300,
  ...rest
}) => {
  // 테마 사용
  const theme = useTheme();
  
  // 컴포넌트 상태
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);
  
  // 참조
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const initialScrollTop = useRef(0);
  const animationFrameId = useRef(null);
  const preventTouchEnd = useRef(false);
  const pullStartTime = useRef(0);
  const refreshPromise = useRef(null);
  const mountedRef = useRef(true);
  
  // 로깅 함수
  const logDebug = (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PullToRefresh] ${message}`, data || '');
    }
  };
  
  // 상태 변경 알림
  const notifyStateChange = useCallback((newState) => {
    if (onStateChange && typeof onStateChange === 'function') {
      onStateChange(newState);
    }
  }, [onStateChange]);

  // 터치 시작 이벤트 처리
  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    
    // 멀티터치 방지
    if (e.touches.length !== 1) return;
    
    // 터치 시작 위치 저장
    touchStartY.current = e.touches[0].clientY;
    
    // 현재 스크롤 위치 저장
    initialScrollTop.current = containerRef.current?.scrollTop || 0;
    
    // 드래그 상태 설정
    setIsDragging(true);
    preventTouchEnd.current = false;
    
    // 당김 시작 시간 기록
    pullStartTime.current = Date.now();
    
    // 오류 상태 초기화
    setError(null);
    
    // 완료 상태 초기화
    if (completed) {
      setCompleted(false);
    }
    
    // 상태 변경 알림
    notifyStateChange('pull-start');
    
    logDebug('터치 시작');
  }, [disabled, refreshing, completed, notifyStateChange]);
  
  // 터치 이동 이벤트 처리
  const handleTouchMove = useCallback((e) => {
    if (disabled || refreshing || !isDragging) return;
    
    // 멀티터치 방지
    if (e.touches.length !== 1) return;
    
    // 현재 터치 위치
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    // 위로 스크롤 중이거나, 이미 최상단이 아닌 경우 무시
    if (deltaY < 0 || (containerRef.current?.scrollTop > 0)) {
      setPullDistance(0);
      return;
    }
    
    if (initialScrollTop.current === 0) {
      // 브라우저 기본 동작 방지
      if (deltaY > 10 && e.cancelable) {
        e.preventDefault();
        preventTouchEnd.current = true;
      }
      
      // 저항 계수 적용 (당길수록 점점 더 어려워짐)
      const resistance = 0.4;
      const newPullDistance = Math.min(deltaY * resistance, pullThreshold * 1.5);
      
      // 애니메이션 프레임 사용하여 성능 최적화
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      animationFrameId.current = requestAnimationFrame(() => {
        if (mountedRef.current) {
          setPullDistance(newPullDistance);
          
          // 임계값에 도달했을 때 상태 변경 알림
          if (newPullDistance >= pullThreshold && 
              !preventTouchEnd.current) {
            notifyStateChange('pull-threshold-reached');
            preventTouchEnd.current = true;
          } else if (newPullDistance > 0) {
            notifyStateChange('pulling');
          }
        }
      });
    }
  }, [disabled, refreshing, isDragging, pullThreshold, notifyStateChange]);
  
  // 터치 종료 이벤트 처리
  const handleTouchEnd = useCallback(async () => {
    if (disabled || refreshing || !isDragging) return;
    
    // 드래그 상태 종료
    setIsDragging(false);
    
    // 당김 지속 시간 계산
    const pullDuration = Date.now() - pullStartTime.current;
    
    logDebug('터치 종료', { 
      pullDistance, 
      pullThreshold, 
      pullDuration,
      minPullDuration 
    });
    
    // 최소 당김 지속 시간 계산
    const remainingTime = Math.max(0, minPullDuration - pullDuration);
    
    // 애니메이션 프레임 취소
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    // 임계값 이상 당겼을 때 새로고침 실행
    if (pullDistance >= pullThreshold) {
      // 상태 변경 알림
      notifyStateChange('release-to-refresh');
      
      // 로딩 시작
      setRefreshing(true);
      
      try {
        // 만약 최소 당김 지속 시간이 충족되지 않았다면 지연
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        // 새로고침 콜백 실행
        if (onRefresh) {
          refreshPromise.current = onRefresh();
          
          // Promise인 경우 완료 대기
          if (refreshPromise.current && 
              typeof refreshPromise.current.then === 'function') {
            await refreshPromise.current;
          }
          
          refreshPromise.current = null;
        }
        
        // 완료 상태로 설정 (성공)
        if (mountedRef.current) {
          setCompleted(true);
          notifyStateChange('refresh-success');
          
          // 잠시 후 완료 상태 초기화
          setTimeout(() => {
            if (mountedRef.current) {
              setCompleted(false);
            }
          }, 1500);
        }
      } catch (err) {
        logDebug('새로고침 중 오류 발생', err);
        
        if (mountedRef.current) {
          setError(err.message || '새로고침 중 오류가 발생했습니다.');
          notifyStateChange('refresh-error');
        }
      } finally {
        // 완료 후 상태 초기화 (약간의 딜레이로 시각적 피드백 제공)
        setTimeout(() => {
          if (mountedRef.current) {
            setRefreshing(false);
            setPullDistance(0);
          }
        }, 300);
      }
    } else {
      // 임계값 미만일 경우 즉시 초기화
      setPullDistance(0);
      notifyStateChange('pull-cancelled');
    }
  }, [
    disabled, refreshing, isDragging, pullDistance, 
    pullThreshold, minPullDuration, onRefresh, notifyStateChange
  ]);

  // 컴포넌트 마운트/언마운트 처리
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      
      // 애니메이션 프레임 정리
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      // 진행 중인 새로고침 작업 참조 제거
      refreshPromise.current = null;
    };
  }, []);
  
  // 비활성화 상태 변경 감지
  useEffect(() => {
    if (disabled && (pullDistance > 0 || refreshing)) {
      // 비활성화 시 모든 상태 초기화
      setPullDistance(0);
      
      if (refreshing) {
        setTimeout(() => {
          if (mountedRef.current) {
            setRefreshing(false);
          }
        }, 300);
      }
    }
  }, [disabled, pullDistance, refreshing]);
  
  // 브라우저 호환성을 위한 터치 이벤트 처리
  const touchEvents = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd
  };
  
  // 마우스 이벤트로 터치 이벤트 에뮬레이션 (데스크톱 브라우저 지원)
  const mouseEvents = {};
  
  // 일부 데스크톱 브라우저에서는 마우스 이벤트 에뮬레이션 제공 (선택적)
  if (process.env.NODE_ENV === 'development' && !disabled) {
    mouseEvents.onMouseDown = (e) => {
      handleTouchStart({
        touches: [{ clientY: e.clientY }]
      });
    };
    
    mouseEvents.onMouseMove = (e) => {
      if (isDragging) {
        handleTouchMove({
          touches: [{ clientY: e.clientY }],
          cancelable: true,
          preventDefault: () => {}
        });
      }
    };
    
    mouseEvents.onMouseUp = handleTouchEnd;
    mouseEvents.onMouseLeave = handleTouchEnd;
  }
  
  // 완료 비율 및 색상 계산
  const ratio = Math.min(pullDistance / pullThreshold, 1);
  const rotationDegrees = refreshing ? 0 : ratio * 360;
  const progressColor = ratio >= 1 
    ? theme.palette.primary.main 
    : theme.palette.text.secondary;
  
  // 상태에 따른 텍스트 결정
  const statusText = refreshing 
    ? refreshingText 
    : completed 
      ? completedText
      : error 
        ? error
        : (pullDistance >= pullThreshold ? releaseText : pullText);
  
  // 배경색 설정
  const bgColor = backgroundColor || alpha(theme.palette.background.paper, 0.8);
  
  // 새로고침 아이콘 색상
  const iconColor = error 
    ? theme.palette.error.main 
    : completed 
      ? theme.palette.success.main 
      : progressColor;
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
        height: '100%',
        ...(containerProps.sx || {})
      }}
      role="region"
      aria-live="polite"
      {...touchEvents}
      {...mouseEvents}
      {...containerProps}
      {...rest}
    >
      {/* 당김 인디케이터 영역 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${pullDistance}px`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          transition: pullDistance >= pullThreshold || refreshing 
            ? 'none' 
            : 'height 0.2s ease',
          bgcolor: bgColor
        }}
        role="status"
        aria-hidden={pullDistance <= 0}
      >
        {/* 새로고침 아이콘 및 로딩 표시 */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: Math.min(1, ratio * 1.5),
            transform: `translateY(${Math.min(pullDistance / 2, 20)}px)`
          }}
        >
          {refreshing ? (
            <CircularProgress 
              size={24 + (pullDistance / 10)} 
              color="primary" 
            />
          ) : (
            <RefreshIcon
              sx={{
                fontSize: 24 + (pullDistance / 10),
                transform: `rotate(${rotationDegrees}deg)`,
                transition: pullDistance >= pullThreshold ? 'none' : 'transform 0.2s ease',
                color: iconColor
              }}
            />
          )}
          
          {/* 상태 텍스트 */}
          <Typography 
            variant="caption" 
            sx={{ 
              mt: 1, 
              color: error 
                ? theme.palette.error.main 
                : completed 
                  ? theme.palette.success.main 
                  : theme.palette.text.secondary,
              fontWeight: completed || error ? 'bold' : 'normal',
              userSelect: 'none'
            }}
          >
            {statusText}
          </Typography>
        </Box>
      </Box>
      
      {/* 컨텐츠 영역 */}
      <Box 
        sx={{ 
          transform: `translateY(${refreshing ? pullThreshold / 2 : pullDistance}px)`,
          transition: (!isDragging && !refreshing) ? 'transform 0.2s ease' : 'none',
          height: '100%',
          willChange: isDragging ? 'transform' : 'auto' // 성능 최적화
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;
