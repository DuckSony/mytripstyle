// src/components/location/LocationPermission.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Button, Dialog, DialogTitle, DialogContent, 
  DialogContentText, DialogActions, Box, Typography,
  Alert, Snackbar, CircularProgress
} from '@mui/material';
import { MyLocation, GpsOff, Refresh } from '@mui/icons-material';
import locationService from '../../services/locationService';

/**
 * 위치 권한 요청 및 관리 컴포넌트
 * 
 * @param {Object} props
 * @param {Function} props.onLocationGranted - 위치 권한 허용 시 콜백 (location 객체 전달)
 * @param {Function} props.onLocationDenied - 위치 권한 거부 시 콜백 (error 객체 전달)
 * @param {Boolean} props.requirePermission - 위치 권한이 필수인지 여부 (기본값: false)
 * @param {Boolean} props.autoRequest - 컴포넌트 마운트 시 자동으로 권한 요청 (기본값: true)
 * @param {String} props.buttonText - 권한 요청 버튼 텍스트
 * @param {Boolean} props.showDialog - 권한 요청 대화상자 표시 여부 (기본값: true)
 * @param {String} props.buttonVariant - 버튼 변형 (기본값: 'contained')
 * @param {String} props.buttonColor - 버튼 색상 (기본값: 'primary')
 * @param {String} props.buttonSize - 버튼 크기 (기본값: 'medium')
 */
const LocationPermission = ({
  onLocationGranted,
  onLocationDenied,
  requirePermission = false,
  autoRequest = true,
  buttonText = "위치 권한 허용하기",
  showDialog = true,
  buttonVariant = 'contained',
  buttonColor = 'primary',
  buttonSize = 'medium'
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionState, setPermissionState] = useState('initial'); // 'initial', 'granted', 'denied', 'unavailable', 'prompt'
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 위치 권한 상태 확인 - useCallback으로 메모이제이션
  const checkPermissionState = useCallback(async () => {
    try {
      const result = await locationService.checkLocationPermissionState();
      if (result.success) {
        setPermissionState(result.state);
      } else {
        console.error("Error checking permission state:", result.error);
        setPermissionState('unknown');
      }
    } catch (error) {
      console.error("Error in checkPermissionState:", error);
      setPermissionState('unknown');
    }
  }, []);
  
  // 위치 정보 요청 함수 - useCallback으로 메모이제이션
  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      const result = await locationService.getUserLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
      
      if (result.success) {
        setPermissionState('granted');
        setDialogOpen(false);
        setLoading(false);
        
        if (onLocationGranted) {
          onLocationGranted(result.data);
        }
        
        // 캐시에서 가져온 경우 안내
        if (result.fromCache) {
          setSnackbarMessage('이전에 저장된 위치 정보를 사용합니다. 정확한 위치를 원하면 새로고침하세요.');
          setSnackbarOpen(true);
        }
      } else {
        throw new Error(result.error || '위치 정보를 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setLoading(false);
      
      // 권한 거부 감지
      if (error.code === 1) { // PERMISSION_DENIED
        setPermissionState('denied');
      } else {
        setPermissionState('unavailable');
      }
      
      setDialogOpen(false);
      
      let errorMessage = '위치 정보를 가져오는데 실패했습니다.';
      if (error.code) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '현재 위치 정보를 사용할 수 없습니다.';
            break;
          case error.TIMEOUT:
            errorMessage = '위치 정보를 가져오는데 시간이 너무 오래 걸립니다.';
            break;
          default:
            errorMessage = '위치 정보를 가져오는데 실패했습니다.';
        }
      }
      
      setSnackbarMessage(errorMessage);
      setSnackbarOpen(true);
      
      if (onLocationDenied) {
        onLocationDenied(error);
      }
    }
  }, [onLocationGranted, onLocationDenied]);
  
  // 위치 권한 확인 및 요청 - useCallback으로 메모이제이션
  const checkAndRequestPermission = useCallback(() => {
    if (!locationService.isLocationAvailable()) {
      setSnackbarMessage('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
      setSnackbarOpen(true);
      setPermissionState('unavailable');
      
      if (onLocationDenied) {
        onLocationDenied(new Error('Geolocation not supported'));
      }
      return;
    }
    
    if (showDialog && permissionState === 'prompt') {
      setDialogOpen(true);
    } else {
      requestLocation();
    }
  }, [onLocationDenied, permissionState, showDialog, requestLocation]);
  
  useEffect(() => {
    // 초기 권한 상태 확인
    checkPermissionState();
    
    // 자동 요청이 활성화되어 있고 위치 권한이 필요한 경우
    if (autoRequest && requirePermission) {
      checkAndRequestPermission();
    }
  }, [autoRequest, requirePermission, checkAndRequestPermission, checkPermissionState]);
  
  // 권한 요청 다이얼로그 닫기
  const handleDialogClose = () => {
    setDialogOpen(false);
    
    if (requirePermission) {
      if (onLocationDenied) {
        onLocationDenied(new Error('User canceled location permission dialog'));
      }
    }
  };
  
  // 권한 요청 수락 처리
  const handleAccept = () => {
    setDialogOpen(false);
    requestLocation();
  };
  
  // 스낵바 닫기
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  return (
    <>
      {/* 위치 권한 요청 버튼 */}
      {permissionState !== 'granted' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <Button
            variant={buttonVariant}
            color={permissionState === 'denied' ? "warning" : buttonColor}
            startIcon={loading ? undefined : permissionState === 'denied' ? <GpsOff /> : <MyLocation />}
            onClick={checkAndRequestPermission}
            size={buttonSize}
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ mr: 1 }} />
            ) : null}
            {buttonText}
          </Button>
        </Box>
      )}
      
      {/* 위치 권한 상태 표시 */}
      {permissionState === 'denied' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            위치 권한이 거부되었습니다. 내 주변 추천을 보려면 브라우저 설정에서 위치 권한을 허용해주세요.
          </Typography>
        </Alert>
      )}
      
      {/* 권한 혹은 위치 정보 새로고침 버튼 (이미 권한은 있으나 오류 발생 시) */}
      {permissionState === 'granted' && !onLocationGranted && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Refresh />}
            onClick={requestLocation}
            size="small"
          >
            위치 정보 새로고침
          </Button>
        </Box>
      )}
      
      {/* 위치 권한 요청 다이얼로그 */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        aria-labelledby="location-permission-dialog-title"
      >
        <DialogTitle id="location-permission-dialog-title">
          위치 정보 사용 권한
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            현재 위치 기반으로 맞춤 장소를 추천해드리기 위해 위치 정보 사용 권한이 필요합니다.
            권한을 허용하시면 현재 위치 주변의 추천 장소를 제공해드립니다.
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              ※ 위치 정보는 추천 목적으로만 사용되며, 서버에 저장되지 않습니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="inherit">
            취소
          </Button>
          <Button onClick={handleAccept} color="primary" autoFocus>
            허용하기
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 에러 메시지 스낵바 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity="warning" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LocationPermission;
