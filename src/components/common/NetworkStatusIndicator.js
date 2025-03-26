import React, { useState, useEffect } from 'react';
import { useNetwork } from '../../contexts/NetworkContext';
import { Box, IconButton, Badge, Tooltip, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, ListItemIcon, Divider, LinearProgress, Chip } from '@mui/material';
import { 
  Wifi as WifiIcon, 
  WifiOff as WifiOffIcon, 
  SignalCellular4Bar as SignalStrongIcon,
  SignalCellular1Bar as SignalWeakIcon,
  SignalCellularConnectedNoInternet0Bar as NoInternetIcon,
  Speed as SpeedIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 네트워크 상태를 표시하는 인디케이터 컴포넌트
 * 현재 연결 상태, 유형 및 품질을 시각적으로 표시합니다.
 */
const NetworkStatusIndicator = ({ 
  variant = 'default', // 'default', 'minimal', 'detailed'
  showDialog = true,
  size = 'medium', // 'small', 'medium', 'large'
  onStatusChange = null
}) => {
  const { 
    isOnline, 
    connectionType, 
    lastChanged, 
    connectionHistory, 
    attemptReconnect,
    isReconnecting
  } = useNetwork();
  
  // 대화상자 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // 상태 변경 시 콜백 호출
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange({
        isOnline,
        connectionType,
        lastChanged
      });
    }
  }, [isOnline, connectionType, lastChanged, onStatusChange]);
  
  // 대화상자 열기/닫기 핸들러
  const handleOpenDialog = () => setDialogOpen(true);
  const handleCloseDialog = () => setDialogOpen(false);
  
  // 연결 테스트 핸들러
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    
    try {
      // 네트워크 연결 테스트
      await attemptReconnect();
      
      // 테스트 완료 후 결과 업데이트
      setTestResult({
        success: isOnline,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setTestingConnection(false);
    }
  };
  
  // 연결 유형별 아이콘 및 텍스트 가져오기
  const getConnectionInfo = () => {
    // 오프라인 상태
    if (!isOnline) {
      return {
        icon: <WifiOffIcon />,
        label: '오프라인',
        color: 'error'
      };
    }
    
    // 연결 유형에 따른 정보
    switch (connectionType) {
      case 'wifi':
        return {
          icon: <WifiIcon />,
          label: 'Wi-Fi',
          color: 'success'
        };
      case 'cellular':
      case '4g':
        return {
          icon: <SignalStrongIcon />,
          label: '모바일 데이터',
          color: 'success'
        };
      case '3g':
      case '2g':
        return {
          icon: <SignalWeakIcon />,
          label: '저속 모바일 데이터',
          color: 'warning'
        };
      case 'none':
        return {
          icon: <NoInternetIcon />,
          label: '연결 없음',
          color: 'error'
        };
      default:
        return {
          icon: <WifiIcon />,
          label: '알 수 없는 연결',
          color: 'info'
        };
    }
  };

  // 네트워크 정보 대화상자 내용
  const renderDialog = () => {
    if (!showDialog) return null;
    
    const { label, color } = getConnectionInfo();
    
    return (
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          네트워크 상태 정보
          {isReconnecting && (
            <LinearProgress 
              color={color} 
              sx={{ mt: 1 }}
            />
          )}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Chip 
              label={isOnline ? '온라인' : '오프라인'} 
              color={isOnline ? 'success' : 'error'} 
              icon={isOnline ? <CheckIcon /> : <WarningIcon />}
              sx={{ mr: 1, mb: 1 }}
            />
            <Chip 
              label={label} 
              color={color} 
              variant="outlined"
              sx={{ mr: 1, mb: 1 }}
            />
            {lastChanged && (
              <Chip 
                label={`최종 변경: ${formatDistanceToNow(new Date(lastChanged), { addSuffix: true, locale: ko })}`} 
                variant="outlined"
                size="small"
                sx={{ mb: 1 }}
              />
            )}
          </Box>
          
          <List>
            <ListItem>
              <ListItemIcon>
                <SpeedIcon />
              </ListItemIcon>
              <ListItemText 
                primary="연결 상태" 
                secondary={
                  isReconnecting 
                    ? '연결 확인 중...' 
                    : (isOnline ? `온라인 (${label})` : '오프라인')
                } 
              />
            </ListItem>
            
            <Divider variant="inset" component="li" />
            
            <ListItem>
              <ListItemIcon>
                <HistoryIcon />
              </ListItemIcon>
              <ListItemText 
                primary="최근 상태 변경" 
                secondary={
                  lastChanged 
                    ? `${format(new Date(lastChanged), 'yyyy년 MM월 dd일 HH:mm:ss', { locale: ko })} (${formatDistanceToNow(new Date(lastChanged), { addSuffix: true, locale: ko })})`
                    : '변경 없음'
                } 
              />
            </ListItem>
            
            {testResult && (
              <>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon>
                    {testResult.success ? <CheckIcon color="success" /> : <WarningIcon color="error" />}
                  </ListItemIcon>
                  <ListItemText 
                    primary="연결 테스트 결과" 
                    secondary={
                      testResult.success 
                        ? '연결 성공' 
                        : `연결 실패: ${testResult.error || '알 수 없는 오류'}`
                    } 
                  />
                </ListItem>
              </>
            )}
          </List>
          
          {connectionHistory.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                연결 상태 이력
              </Typography>
              <List dense>
                {connectionHistory.slice(0, 5).map((item, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {item.status === 'online' ? <CheckIcon color="success" /> : <WifiOffIcon color="error" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.status === 'online' ? '온라인' : '오프라인'} 
                      secondary={format(new Date(item.timestamp), 'yyyy년 MM월 dd일 HH:mm:ss', { locale: ko })} 
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleTestConnection} 
            disabled={testingConnection}
            startIcon={<RefreshIcon />}
          >
            연결 테스트
          </Button>
          <Button onClick={handleCloseDialog}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // 컴포넌트 정보 가져오기
  const { icon, label, color } = getConnectionInfo();
  
  // 미니멀 변형 렌더링
  if (variant === 'minimal') {
    return (
      <>
        <Tooltip title={`네트워크 상태: ${label}`}>
          <IconButton 
            size={size} 
            color={color}
            onClick={showDialog ? handleOpenDialog : undefined}
          >
            {isReconnecting ? (
              <Badge variant="dot" color="warning">
                {icon}
              </Badge>
            ) : icon}
          </IconButton>
        </Tooltip>
        
        {renderDialog()}
      </>
    );
  }
  
  // 상세 변형 렌더링
  if (variant === 'detailed') {
    return (
      <>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            p: 1,
            border: 1,
            borderRadius: 1,
            borderColor: `${color}.main`,
            bgcolor: `${color}.50`,
            '&:hover': {
              bgcolor: `${color}.100`,
              cursor: showDialog ? 'pointer' : 'default'
            }
          }}
          onClick={showDialog ? handleOpenDialog : undefined}
        >
          {icon}
          <Box sx={{ ml: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {label}
            </Typography>
            {lastChanged && (
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(new Date(lastChanged), { addSuffix: true, locale: ko })}
              </Typography>
            )}
          </Box>
          {isReconnecting && (
            <LinearProgress 
              color={color} 
              sx={{ 
                width: 40, 
                ml: 1,
                height: 4,
                borderRadius: 2 
              }}
            />
          )}
        </Box>
        
        {renderDialog()}
      </>
    );
  }
  
  // 기본 변형 렌더링 (default)
  return (
    <>
      <Tooltip title={`네트워크 상태: ${label}`}>
        <Chip
          icon={icon}
          label={label}
          color={color}
          size={size === 'small' ? 'small' : 'medium'}
          variant={isReconnecting ? 'outlined' : 'filled'}
          onClick={showDialog ? handleOpenDialog : undefined}
          sx={{ 
            '&:hover': {
              boxShadow: showDialog ? 1 : 0
            }
          }}
        />
      </Tooltip>
      
      {renderDialog()}
    </>
  );
};

export default NetworkStatusIndicator;
