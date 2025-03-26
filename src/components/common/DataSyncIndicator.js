import React, { useState, useEffect } from 'react';
import { useDataSync } from '../../contexts/DataSyncContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Box, IconButton, Badge, Tooltip, Typography, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Sync as SyncIcon, CloudOff as CloudOffIcon, WarningAmber as WarningIcon, Info as InfoIcon } from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 데이터 동기화 상태를 표시하는 인디케이터 컴포넌트
 * 동기화 상태, 마지막 동기화 시간, 보류 중인 변경사항 수를 표시하고
 * 수동 동기화 트리거 버튼을 제공합니다.
 */
const DataSyncIndicator = () => {
  const { 
    isSyncing, 
    lastSyncTime, 
    pendingChanges, 
    syncErrors, 
    syncProgress, 
    startSync, 
    hasPendingChanges 
  } = useDataSync();
  
  const { isOnline } = useNetwork();
  
  // 대화상자 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastSyncTimeDisplay, setLastSyncTimeDisplay] = useState('동기화 안됨');
  
  // 마지막 동기화 시간 포맷팅
  useEffect(() => {
    if (lastSyncTime) {
      const syncDate = new Date(lastSyncTime);
      const timeAgo = formatDistanceToNow(syncDate, { addSuffix: true, locale: ko });
      setLastSyncTimeDisplay(timeAgo);
    } else {
      setLastSyncTimeDisplay('동기화 안됨');
    }
  }, [lastSyncTime]);
  
  // 대화상자 열기/닫기 핸들러
  const handleOpenDialog = () => setDialogOpen(true);
  const handleCloseDialog = () => setDialogOpen(false);
  
  // 수동 동기화 시작
  const handleSync = () => {
    startSync();
    handleCloseDialog();
  };

  // 상태에 따른 아이콘 및 툴팁 결정
  const getStatusIcon = () => {
    // 오프라인 상태
    if (!isOnline) {
      return {
        icon: <CloudOffIcon color="disabled" />,
        tooltip: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.',
        color: 'default'
      };
    }
    
    // 동기화 오류 있음
    if (syncErrors.length > 0) {
      return {
        icon: <WarningIcon color="error" />,
        tooltip: '동기화 중 오류가 발생했습니다.',
        color: 'error'
      };
    }
    
    // 동기화 중
    if (isSyncing) {
      return {
        icon: <SyncIcon color="primary" className="rotating" />,
        tooltip: '데이터를 동기화 중입니다...',
        color: 'primary'
      };
    }
    
    // 보류 중인 변경사항 있음
    if (hasPendingChanges) {
      return {
        icon: <Badge badgeContent={pendingChanges} color="warning"><SyncIcon color="action" /></Badge>,
        tooltip: `${pendingChanges}개의 변경사항 동기화 대기 중`,
        color: 'warning'
      };
    }
    
    // 정상 상태
    return {
      icon: <SyncIcon color="success" />,
      tooltip: `마지막 동기화: ${lastSyncTimeDisplay}`,
      color: 'success'
    };
  };
  
  const { icon, tooltip, color } = getStatusIcon();

  // 동기화 정보 대화상자 내용
  const renderSyncDialog = () => (
    <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
      <DialogTitle>
        데이터 동기화 상태
        {isSyncing && (
          <LinearProgress 
            variant="determinate" 
            value={syncProgress} 
            sx={{ mt: 1 }}
          />
        )}
      </DialogTitle>
      
      <DialogContent>
        <List>
          <ListItem>
            <ListItemText 
              primary="동기화 상태" 
              secondary={isSyncing ? '동기화 중...' : '대기 중'} 
            />
          </ListItem>
          
          <Divider />
          
          <ListItem>
            <ListItemText 
              primary="네트워크 상태" 
              secondary={isOnline ? '온라인' : '오프라인'} 
            />
          </ListItem>
          
          <Divider />
          
          <ListItem>
            <ListItemText 
              primary="마지막 동기화" 
              secondary={
                lastSyncTime 
                  ? `${format(new Date(lastSyncTime), 'yyyy년 MM월 dd일 HH:mm:ss', { locale: ko })} (${lastSyncTimeDisplay})`
                  : '동기화 기록 없음'
              } 
            />
          </ListItem>
          
          <Divider />
          
          <ListItem>
            <ListItemText 
              primary="대기 중인 변경사항" 
              secondary={pendingChanges > 0 ? `${pendingChanges}개` : '없음'} 
            />
          </ListItem>
          
          {syncErrors.length > 0 && (
            <>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="동기화 오류" 
                  secondary={
                    <Box sx={{ color: 'error.main' }}>
                      {syncErrors.map((error, index) => (
                        <Typography key={index} variant="body2" component="div">
                          • {error}
                        </Typography>
                      ))}
                    </Box>
                  } 
                />
              </ListItem>
            </>
          )}
        </List>
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={handleSync} 
          color="primary" 
          disabled={isSyncing || !isOnline}
        >
          지금 동기화
        </Button>
        <Button onClick={handleCloseDialog}>닫기</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {/* 동기화 진행률 표시 */}
      {isSyncing && (
        <Box sx={{ width: '100%', maxWidth: 100, mr: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={syncProgress} 
            color={color}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </Box>
      )}
      
      {/* 정보 버튼 */}
      <Tooltip title="동기화 정보">
        <IconButton 
          size="small" 
          onClick={handleOpenDialog}
          sx={{ mr: 1 }}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      {/* 동기화 상태 아이콘 */}
      <Tooltip title={tooltip}>
        <IconButton 
          size="small" 
          onClick={handleSync} 
          disabled={isSyncing || !isOnline}
        >
          {icon}
        </IconButton>
      </Tooltip>
      
      {/* 동기화 정보 대화상자 */}
      {renderSyncDialog()}
      
      {/* 회전 애니메이션 스타일 */}
      <style jsx="true">{`
        .rotating {
          animation: rotate 1.5s linear infinite;
        }
        
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  );
};

export default DataSyncIndicator;
