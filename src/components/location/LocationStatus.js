// src/components/location/LocationStatus.js
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Chip, 
  Tooltip, 
  IconButton,
  Fade
} from '@mui/material';
import { 
  LocationOn, 
  LocationOff, 
  Info,
  Refresh
} from '@mui/icons-material';
// locationService 임포트 제거 (사용되지 않음)

/**
 * 위치 정보 상태 표시 컴포넌트
 * 
 * @param {Object} props
 * @param {Object} props.userLocation - 현재 위치 정보 객체 {latitude, longitude, accuracy}
 * @param {Boolean} props.permissionGranted - 위치 권한 허용 여부
 * @param {Function} props.onRefresh - 위치 정보 새로고침 콜백
 * @param {String} props.variant - 디스플레이 변형 ('compact', 'default', 'detailed')
 */
const LocationStatus = ({ 
  userLocation, 
  permissionGranted = false, 
  onRefresh,
  variant = 'default'
}) => {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [formattedAddress, setFormattedAddress] = useState(null);
  
  // 위치 정보가 변경될 때마다 마지막 업데이트 시간 갱신
  useEffect(() => {
    if (userLocation) {
      setLastUpdate(new Date());
      
      // 좌표를 주소로 변환 (geocoding) - 실제 서비스에서는 구현 필요
      // 여기서는 예시로만 작성
      const getAddressFromCoords = async () => {
        try {
          // 실제로는 Google Maps Geocoding API 등을 사용
          // 예시 코드일 뿐 실제로 작동하지 않음
          const address = `서울시 중구`;
          setFormattedAddress(address);
        } catch (error) {
          console.error("Error getting address:", error);
          setFormattedAddress(null);
        }
      };
      
      getAddressFromCoords();
    }
  }, [userLocation]);
  
  // 경과 시간 포맷팅
  const getElapsedTime = () => {
    if (!lastUpdate) return '알 수 없음';
    
    const now = new Date();
    const elapsed = now - lastUpdate;
    
    if (elapsed < 60000) {
      return '1분 이내';
    } else if (elapsed < 3600000) {
      return `약 ${Math.floor(elapsed / 60000)}분 전`;
    } else if (elapsed < 86400000) {
      return `약 ${Math.floor(elapsed / 3600000)}시간 전`;
    } else {
      return `약 ${Math.floor(elapsed / 86400000)}일 전`;
    }
  };
  
  // 정확도 텍스트 생성
  const getAccuracyText = () => {
    if (!userLocation?.accuracy) return '알 수 없음';
    
    const accuracy = userLocation.accuracy;
    
    if (accuracy < 50) {
      return '높음 (< 50m)';
    } else if (accuracy < 100) {
      return '중간 (< 100m)';
    } else if (accuracy < 500) {
      return '낮음 (< 500m)';
    } else {
      return '매우 낮음 (> 500m)';
    }
  };
  
  // 컴팩트 모드 렌더링
  if (variant === 'compact') {
    return (
      <Chip 
        icon={permissionGranted ? <LocationOn color="primary" /> : <LocationOff color="error" />}
        label={permissionGranted ? (userLocation ? "위치 사용 중" : "위치 찾는 중...") : "위치 사용 안함"}
        color={permissionGranted ? "primary" : "default"}
        variant={permissionGranted ? "filled" : "outlined"}
        size="small"
        onClick={onRefresh}
      />
    );
  }
  
  // 상세 모드 렌더링
  if (variant === 'detailed') {
    return (
      <Box sx={{ 
        border: 1, 
        borderColor: 'divider', 
        borderRadius: 1, 
        p: 2,
        bgcolor: 'background.paper'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {permissionGranted ? (
            <LocationOn color="primary" sx={{ mr: 1 }} />
          ) : (
            <LocationOff color="error" sx={{ mr: 1 }} />
          )}
          <Typography variant="h6">
            {permissionGranted ? "위치 정보 상태" : "위치 정보 사용 불가"}
          </Typography>
          
          {onRefresh && (
            <Tooltip title="위치 정보 새로고침">
              <IconButton 
                size="small" 
                onClick={onRefresh}
                sx={{ ml: 'auto' }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        {permissionGranted && userLocation && (
          <Fade in={!!userLocation}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>좌표:</strong> {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
              </Typography>
              {formattedAddress && (
                <Typography variant="body2" gutterBottom>
                  <strong>주소:</strong> {formattedAddress}
                </Typography>
              )}
              <Typography variant="body2" gutterBottom>
                <strong>정확도:</strong> {getAccuracyText()} ({userLocation.accuracy.toFixed(0)}m)
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>마지막 업데이트:</strong> {getElapsedTime()}
              </Typography>
            </Box>
          </Fade>
        )}
        
        {permissionGranted && !userLocation && (
          <Typography variant="body2" color="text.secondary">
            위치 정보를 가져오는 중입니다...
          </Typography>
        )}
        
        {!permissionGranted && (
          <Typography variant="body2" color="text.secondary">
            위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해주세요.
          </Typography>
        )}
      </Box>
    );
  }
  
  // 기본 모드 렌더링 (default)
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center',
      py: 0.5,
      px: 1,
      border: 1, 
      borderColor: 'divider', 
      borderRadius: 2,
      bgcolor: permissionGranted ? 'action.hover' : 'background.paper'
    }}>
      {permissionGranted ? (
        <LocationOn fontSize="small" color="primary" />
      ) : (
        <LocationOff fontSize="small" color="action" />
      )}
      
      <Typography variant="body2" sx={{ ml: 1 }}>
        {permissionGranted 
          ? (userLocation ? "현재 위치 사용 중" : "위치 정보 로딩 중...")
          : "위치 사용 안함"
        }
      </Typography>
      
      {userLocation && (
        <Tooltip title={`정확도: ${getAccuracyText()}, 마지막 업데이트: ${getElapsedTime()}`}>
          <Info fontSize="small" color="action" sx={{ ml: 1, fontSize: '1rem' }} />
        </Tooltip>
      )}
      
      {onRefresh && (
        <Tooltip title="위치 정보 새로고침">
          <IconButton 
            size="small" 
            onClick={onRefresh}
            sx={{ ml: 'auto', p: 0.5 }}
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default LocationStatus;
