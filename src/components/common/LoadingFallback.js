// src/components/common/LoadingFallback.js
import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Fade, useTheme } from '@mui/material';
import { useMediaQuery } from '@mui/material';

/**
 * 지연 로딩(Lazy Loading)을 위한 최적화된 로딩 컴포넌트
 * Suspense fallback으로 사용됩니다.
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.message - 로딩 메시지 (기본값: "로딩 중...")
 * @param {string} props.type - 로딩 유형 ('full', 'contained', 'minimal' 중 하나)
 * @param {number} props.delay - 로딩 표시 지연 시간(ms)
 * @param {number} props.minDisplayTime - 최소 표시 시간(ms)
 */
const LoadingFallback = ({ 
  message = "로딩 중...",
  type = "contained", 
  delay = 300,
  minDisplayTime = 500
}) => {
  const [visible, setVisible] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 지연 표시 및 최소 표시 시간 적용
  useEffect(() => {
    let delayTimer;
    let cleanupTimer;
    
    // 일정 시간 후에만 로딩 UI 표시 (빠른 로딩 시 깜빡임 방지)
    delayTimer = setTimeout(() => {
      setVisible(true);
      setStartTime(Date.now());
    }, delay);

    // 컴포넌트 언마운트 시 정리
    return () => {
      clearTimeout(delayTimer);
      
      // minDisplayTime이 지나지 않은 경우, 남은 시간만큼 대기 후 해제
      if (startTime > 0) {
        const displayTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minDisplayTime - displayTime);
        
        if (remainingTime > 0 && cleanupTimer) {
          clearTimeout(cleanupTimer);
        }
      }
    };
  }, [delay, minDisplayTime, startTime]);

  // 로딩 유형에 따른 스타일 설정
  const getContainerStyle = () => {
    switch (type) {
      case 'full':
        return {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: theme.zIndex.modal,
          bgcolor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        };
      case 'contained':
        return {
          width: '100%',
          height: isMobile ? '50vh' : '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        };
      case 'minimal':
      default:
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          minHeight: '100px'
        };
    }
  };

  // 스켈레톤 효과를 사용하는 최적화된 로딩 인디케이터
  return (
    <Fade in={visible} timeout={300}>
      <Box sx={getContainerStyle()}>
        <CircularProgress
          size={type === 'minimal' ? 24 : 40}
          thickness={4}
          color="primary"
          sx={{ 
            opacity: 0.8,
            mb: type !== 'minimal' ? 2 : 0
          }}
        />
        
        {type !== 'minimal' && (
          <Typography
            variant={isMobile ? "body2" : "body1"}
            color="text.secondary"
            sx={{
              mt: 1,
              fontWeight: 500,
              textAlign: 'center',
              animation: 'pulse 1.5s infinite ease-in-out',
              '@keyframes pulse': {
                '0%': { opacity: 0.6 },
                '50%': { opacity: 1 },
                '100%': { opacity: 0.6 }
              }
            }}
          >
            {message}
          </Typography>
        )}
        
        {/* 네트워크 상태 메시지 (오래 걸릴 때만 표시) */}
        {type === 'full' && (
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: '10%', 
              left: 0, 
              right: 0, 
              textAlign: 'center',
              opacity: 0, // 기본적으로 숨김
              animation: 'fadeIn 1s forwards',
              animationDelay: '3s', // 3초 후에 표시
              '@keyframes fadeIn': {
                to: { opacity: 0.7 }
              }
            }}
          >
            <Typography variant="caption" color="text.secondary">
              데이터를 불러오는 중입니다. 잠시만 기다려주세요.
            </Typography>
          </Box>
        )}
      </Box>
    </Fade>
  );
};

/**
 * 로딩 유형별 사전 구성 컴포넌트들
 */
export const FullPageLoader = (props) => (
  <LoadingFallback type="full" {...props} />
);

export const ContentLoader = (props) => (
  <LoadingFallback type="contained" {...props} />
);

export const MinimalLoader = (props) => (
  <LoadingFallback type="minimal" {...props} />
);

export default LoadingFallback;
