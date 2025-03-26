// src/components/notifications/NotificationItem.js
import React, { useCallback, useMemo } from 'react';
import { 
  ListItem, 
  ListItemText, 
  ListItemAvatar, 
  Avatar, 
  Typography, 
  IconButton, 
  Box, 
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  useTheme
} from '@mui/material';
import { 
  Info as InfoIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  DeleteOutline as DeleteIcon,
  MoreVert as MoreVertIcon,
  DoneAll as DoneAllIcon,
  AccessTime as TimeIcon,
  Place as PlaceIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// 알림 타입별 아이콘 및 색상 설정
const getNotificationTypeConfig = (type) => {
  switch (type) {
    case 'info':
      return { icon: <InfoIcon />, color: 'info.main' };
    case 'success':
      return { icon: <CheckIcon />, color: 'success.main' };
    case 'warning':
      return { icon: <WarningIcon />, color: 'warning.main' };
    case 'error':
      return { icon: <ErrorIcon />, color: 'error.main' };
    case 'place_recommend':
      return { icon: <PlaceIcon />, color: 'primary.main' };
    case 'visit_reminder':
      return { icon: <TimeIcon />, color: 'secondary.main' };
    case 'system':
      return { icon: <NotificationIcon />, color: 'grey.700' };
    default:
      return { icon: <NotificationIcon />, color: 'grey.700' };
  }
};

// 알림 아이템 컴포넌트
const NotificationItem = ({ notification, onClose }) => {
    const { 
      markAsRead, 
      removeNotification 
    } = useNotification();
    const navigate = useNavigate();
    const theme = useTheme();
    
    // 메뉴 상태 관리
    const [menuAnchorEl, setMenuAnchorEl] = React.useState(null);
    const isMenuOpen = Boolean(menuAnchorEl);
    
    // 알림 타입 설정 가져오기
    const typeConfig = useMemo(() => 
      getNotificationTypeConfig(notification.type),
      [notification.type]
    );
    
    // 메뉴 열기
    const handleMenuOpen = useCallback((event) => {
      event.stopPropagation();
      setMenuAnchorEl(event.currentTarget);
    }, []);
    
    // 메뉴 닫기
    const handleMenuClose = useCallback((event) => {
      if (event) event.stopPropagation();
      setMenuAnchorEl(null);
    }, []);
    
    // 알림 읽음 처리
    const handleMarkAsRead = useCallback((event) => {
      if (event) event.stopPropagation();
      markAsRead(notification.id);
      handleMenuClose();
    }, [markAsRead, notification.id, handleMenuClose]);
    
    // 알림 삭제
    const handleDelete = useCallback((event) => {
      if (event) event.stopPropagation();
      removeNotification(notification.id);
      handleMenuClose();
    }, [removeNotification, notification.id, handleMenuClose]);

    // 알림 클릭 처리
  const handleClick = useCallback(() => {
    // 읽지 않은 알림일 경우 읽음으로 표시
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // 링크가 있는 경우 해당 페이지로 이동
    if (notification.link) {
      navigate(notification.link);
      if (onClose) onClose();
    }
  }, [notification, markAsRead, navigate, onClose]);
  
  // 알림 시간 표시 (몇 분 전, 몇 시간 전 등)
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(notification.timestamp), {
        addSuffix: true,
        locale: ko
      });
    } catch (error) {
      return '알 수 없는 시간';
    }
  }, [notification.timestamp]);
  
  return (
    <>
      <ListItem
        alignItems="flex-start"
        sx={{
          bgcolor: notification.read ? 'transparent' : 'action.hover',
          borderLeft: notification.read ? 'none' : `4px solid ${theme.palette[typeConfig.color.split('.')[0]][typeConfig.color.split('.')[1] || 'main']}`,
          py: 1.5,
          px: notification.read ? 2 : 1.6,
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': {
            bgcolor: 'action.selected',
          }
        }}
        onClick={handleClick}
        secondaryAction={
          <IconButton
            edge="end"
            size="small"
            onClick={handleMenuOpen}
            aria-label="알림 옵션"
            aria-controls={isMenuOpen ? 'notification-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={isMenuOpen ? 'true' : undefined}
          >
            <MoreVertIcon />
          </IconButton>
        }
      >
        <ListItemAvatar>
          <Avatar 
            sx={{ 
              bgcolor: typeConfig.color,
              width: 36,
              height: 36
            }}
          >
            {typeConfig.icon}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ pr: 2, display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Typography
                variant="subtitle2"
                component="span"
                sx={{ fontWeight: notification.read ? 'normal' : 'medium' }}
                noWrap
              >
                {notification.title}
              </Typography>
              {!notification.read && (
                <Chip
                  label="NEW"
                  size="small"
                  color="primary"
                  sx={{ 
                    ml: 1, 
                    height: 20, 
                    fontSize: '0.65rem',
                    fontWeight: 'bold'
                  }}
                />
              )}
            </Box>
          }
          secondary={
            <>
              <Typography
                variant="body2"
                component="span"
                color="text.primary"
                sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    display: '-webkit-box'  // 하나의 display 속성만 유지
                  }}
              >
                {notification.message}
              </Typography>
              <Typography 
                variant="caption" 
                component="div"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {timeAgo}
              </Typography>
            </>
          }
        />
      </ListItem>
      <Divider variant="inset" component="li" />
      
      {/* 알림 옵션 메뉴 */}
      <Menu
        id="notification-menu"
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: { 
              minWidth: 160,
              boxShadow: theme.shadows[2]
            }
          }
        }}
      >
        {!notification.read && (
          <MenuItem onClick={handleMarkAsRead}>
            <ListItemIcon>
              <DoneAllIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>읽음으로 표시</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>삭제</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default NotificationItem;
