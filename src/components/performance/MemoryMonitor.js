// src/components/performance/MemoryMonitor.js

import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Tooltip } from '@mui/material';
import MemoryIcon from '@mui/icons-material/Memory';

// 메모리 사용량 모니터링 컴포넌트
const MemoryMonitor = ({ showDetails = false, interval = 5000 }) => {
  const [memoryInfo, setMemoryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const getMemoryInfo = () => {
      setLoading(true);
      
      if (!performance || !performance.memory) {
        setMemoryInfo({
          error: true,
          message: 'performance.memory API가 지원되지 않습니다.'
        });
        setLoading(false);
        return;
      }
      
      try {
        const { 
          jsHeapSizeLimit,
          totalJSHeapSize,
          usedJSHeapSize
        } = performance.memory;
        
        setMemoryInfo({
          jsHeapSizeLimit: formatBytes(jsHeapSizeLimit),
          totalJSHeapSize: formatBytes(totalJSHeapSize),
          usedJSHeapSize: formatBytes(usedJSHeapSize),
          usagePercent: Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100),
          timestamp: Date.now()
        });
      } catch (error) {
        setMemoryInfo({
          error: true,
          message: error.message
        });
      }
      
      setLoading(false);
    };
    
    // 즉시 실행
    getMemoryInfo();
    
    // 주기적 업데이트
    const timerId = setInterval(getMemoryInfo, interval);
    
    return () => clearInterval(timerId);
  }, [interval]);
  
  // 바이트 형식 변환 함수
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  if (loading) {
    return (
      <Box display="flex" alignItems="center">
        <CircularProgress size={16} sx={{ mr: 1 }} />
        <Typography variant="body2">메모리 정보 로드 중...</Typography>
      </Box>
    );
  }
  
  if (memoryInfo?.error) {
    return (
      <Typography color="error" variant="body2">
        {memoryInfo.message || '메모리 정보를 가져올 수 없습니다'}
      </Typography>
    );
  }
  
  // 메모리 사용량 UI
  return (
    <Paper elevation={1} sx={{ p: 1, borderRadius: 1 }}>
      <Box display="flex" alignItems="center">
        <MemoryIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="body2">
          메모리 사용량: {memoryInfo?.usagePercent}%
        </Typography>
        
        {showDetails && (
          <Tooltip title={`총 힙 크기: ${memoryInfo?.totalJSHeapSize}\n한도: ${memoryInfo?.jsHeapSizeLimit}`}>
            <Typography variant="caption" sx={{ ml: 1 }}>
              ({memoryInfo?.usedJSHeapSize})
            </Typography>
          </Tooltip>
        )}
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" display="block">
            사용 중: {memoryInfo?.usedJSHeapSize}
          </Typography>
          <Typography variant="caption" display="block">
            할당됨: {memoryInfo?.totalJSHeapSize}
          </Typography>
          <Typography variant="caption" display="block">
            최대: {memoryInfo?.jsHeapSizeLimit}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default MemoryMonitor;
