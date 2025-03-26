// src/components/common/UpdateNotification.js
import React from 'react';
import { Alert, Button, Snackbar } from '@mui/material';

/**
 * 앱 업데이트 알림 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {ServiceWorkerRegistration} props.registration - 서비스 워커 등록 객체
 */
const UpdateNotification = ({ registration }) => {
  const [open, setOpen] = React.useState(true);

  const handleClose = () => {
    setOpen(false);
  };

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      // 새 서비스 워커에게 skipWaiting 메시지 전송
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // 페이지 새로고침
    window.location.reload();
  };

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert 
        severity="info" 
        onClose={handleClose}
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={handleUpdate}
          >
            지금 업데이트
          </Button>
        }
      >
        새 버전이 사용 가능합니다. 업데이트하시겠습니까?
      </Alert>
    </Snackbar>
  );
};

export default UpdateNotification;
