// src/components/performance/RenderingMonitor.js

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, LinearProgress, Tooltip } from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';

// 렌더링 성능 모니터링 컴포넌트
const RenderingMonitor = ({ componentName, threshold = 16 }) => {
  const [renderTime, setRenderTime] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [isPoor, setIsPoor] = useState(false);
  const startTimeRef = useRef(0);
  
  useEffect(() => {
    // 컴포넌트 마운트 시간 측정 시작
    startTimeRef.current = performance.now();
    
    return () => {
      // 컴포넌트 언마운트 시간 측정
      const endTime = performance.now();
      const duration = endTime - startTimeRef.current;
      console.log(`${componentName} 마운트-언마운트 주기: ${duration.toFixed(2)}ms`);
    };
  }, [componentName]);
  
  useEffect(() => {
    // 렌더링 시간 측정
    const endTime = performance.now();
    const duration = endTime - startTimeRef.current;
    
    setRenderTime(prev => {
      // 첫 번째 렌더링이 아닌 경우 평균 계산
      if (renderCount > 0) {
        return (prev * renderCount + duration) / (renderCount + 1);
      }
      return duration;
    });
    
    setRenderCount(prev => prev + 1);
    
    // 렌더링 품질 판단 (16ms = 60fps)
    setIsPoor(duration > threshold);
    
    // 다음 렌더링 시간 측정 준비
    startTimeRef.current = performance.now();
  });
  
  // 성능 상태 색상
  const getColor = () => {
    if (renderTime < threshold / 2) return 'success.main';
    if (renderTime < threshold) return 'warning.main';
    return 'error.main';
  };
  
  // 품질 텍스트
  const getQualityText = () => {
    if (renderTime < threshold / 2) return '좋음';
    if (renderTime < threshold) return '보통';
    return '나쁨';
  };
  
  return (
    <Paper elevation={1} sx={{ p: 1, borderRadius: 1 }}>
      <Box display="flex" alignItems="center">
        <SpeedIcon sx={{ color: getColor(), mr: 1 }} />
        <Typography variant="body2">
          {componentName || '컴포넌트'} 렌더링
        </Typography>
        <Tooltip title={`평균 렌더링 시간: ${renderTime.toFixed(2)}ms\n렌더링 횟수: ${renderCount}`}>
          <Typography 
            variant="caption" 
            sx={{ ml: 1, color: getColor() }}
          >
            ({getQualityText()})
          </Typography>
        </Tooltip>
      </Box>
      
      <Box mt={1}>
        <LinearProgress 
          variant="determinate" 
          value={Math.min((renderTime / threshold) * 100, 100)} 
          color={isPoor ? "error" : "primary"}
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          {renderTime.toFixed(2)}ms / {renderCount}회
        </Typography>
      </Box>
    </Paper>
  );
};

export default RenderingMonitor;
