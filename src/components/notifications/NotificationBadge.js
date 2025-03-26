// src/components/notifications/NotificationBadge.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Badge, 
  IconButton, 
  Tooltip, 
  useTheme, 
  useMediaQuery 
} from '@mui/material';
import { 
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon
} from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';

// 알림 배지 컴포넌트
const NotificationBadge = () => {
  const { 
    unreadCount, 
    toggleNotificationCenter, 
    isNotificationCenterOpen, 
  } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const preferReducedMotion = useReducedMotion();
  
  // 배지 강조 상태 (새 알림이 왔을 때 잠시 강조)
  const [emphasize, setEmphasize] = useState(false);
  
  // 이전 알림 개수 추적
  const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);

  // 알림 개수가 증가했을 때 강조 효과 적용
  useEffect(() => {
    if (unreadCount > prevUnreadCount) {
      setEmphasize(true);
      
      // 3초 후 강조 효과 해제
      const timer = setTimeout(() => {
        setEmphasize(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    setPrevUnreadCount(unreadCount);
  }, [unreadCount, prevUnreadCount]);
  
  // 알림 센터 토글
  const handleToggleNotifications = useCallback(() => {
    toggleNotificationCenter();
  }, [toggleNotificationCenter]);
  
  // 배지 색상 설정
  const badgeColor = useMemo(() => {
    return emphasize ? 'secondary' : 'error';
  }, [emphasize]);
  
  // 펄스 애니메이션 (접근성 설정 고려)
  const pulseAnimation = useMemo(() => {
    if (preferReducedMotion || !emphasize) {
      return {};
    }
    
    return {
      animate: {
        scale: [1, 1.2, 1],
        transition: {
          duration: 0.5,
          repeat: 2,
          repeatType: "reverse"
        }
      }
    };
  }, [emphasize, preferReducedMotion]);

  return (
    <Tooltip title="알림">
      <IconButton
        color={isNotificationCenterOpen ? 'primary' : 'default'}
        onClick={handleToggleNotifications}
        size={isMobile ? 'medium' : 'large'}
        sx={{ 
          position: 'relative',
          color: isNotificationCenterOpen 
            ? theme.palette.primary.main 
            : (emphasize ? theme.palette.secondary.main : undefined)
        }}
        className="btn-tap"
      >
        <AnimatePresence>
          <motion.div {...pulseAnimation}>
            <Badge
              badgeContent={unreadCount}
              color={badgeColor}
              overlap="circular"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: isMobile ? '0.6rem' : '0.7rem',
                  height: isMobile ? 16 : 18,
                  minWidth: isMobile ? 16 : 18,
                  ...(emphasize && {
                    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`
                  })
                }
              }}
            >
              {emphasize ? (
                <NotificationsActiveIcon fontSize={isMobile ? 'medium' : 'large'} />
              ) : (
                <NotificationsIcon fontSize={isMobile ? 'medium' : 'large'} />
              )}
            </Badge>
          </motion.div>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
};

export default NotificationBadge;
