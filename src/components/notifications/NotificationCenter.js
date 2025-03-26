// src/components/notifications/NotificationCenter.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Drawer, 
  Box, 
  Typography, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText,
  Button,
  Badge,
  Menu,
  MenuItem,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterList as FilterIcon,
  Done as DoneIcon,
  Refresh as RefreshIcon,
  NotificationsOff as NotificationsOffIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';
import NotificationItem from './NotificationItem';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

// 알림 필터 옵션
const FILTER_OPTIONS = {
  ALL: 'all',
  UNREAD: 'unread',
  TODAY: 'today',
  SYSTEM: 'system',
  VISIT: 'visit'
};

// 알림 센터 컴포넌트
const NotificationCenter = () => {
    const { 
      notifications, 
      unreadCount, 
      loading, 
      error, 
      isNotificationCenterOpen, 
      toggleNotificationCenter, 
      markAllRead, 
      fetchNotifications 
    } = useNotification();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const preferReducedMotion = useReducedMotion();
    
    // 상태 관리
    const [filter, setFilter] = useState(FILTER_OPTIONS.ALL);
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
  
  // 모바일에서 뒤로가기 시 알림 센터 닫기
  useEffect(() => {
    const handlePopState = () => {
      if (isNotificationCenterOpen && isMobile) {
        toggleNotificationCenter(false);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isNotificationCenterOpen, toggleNotificationCenter, isMobile]);

  // 알림 센터 열릴 때 모바일에서 history 상태 추가
  useEffect(() => {
    if (isNotificationCenterOpen && isMobile) {
      window.history.pushState({ notificationCenter: true }, '');
    }
  }, [isNotificationCenterOpen, isMobile]);

  // 필터 변경 처리
  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
    setMenuAnchorEl(null);
  }, []);

  // 메뉴 열기/닫기
  const handleMenuOpen = useCallback((event) => {
    setMenuAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  // 탭 변경 처리
  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
    
    // 탭에 따른 필터 변경
    switch (newValue) {
      case 0:
        setFilter(FILTER_OPTIONS.ALL);
        break;
      case 1:
        setFilter(FILTER_OPTIONS.UNREAD);
        break;
      case 2:
        setFilter(FILTER_OPTIONS.VISIT);
        break;
      case 3:
        setFilter(FILTER_OPTIONS.SYSTEM);
        break;
      default:
        setFilter(FILTER_OPTIONS.ALL);
    }
  }, []);

  // 새로고침
  const handleRefresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 모두 읽음으로 표시
  const handleMarkAllRead = useCallback(() => {
    markAllRead();
  }, [markAllRead]);

  // 알림 센터 닫기
  const handleClose = useCallback(() => {
    toggleNotificationCenter(false);
  }, [toggleNotificationCenter]);

  // 필터링된 알림 목록
  const filteredNotifications = useMemo(() => {
    if (!notifications.length) return [];
    
    return notifications.filter(notification => {
      const notificationDate = new Date(notification.timestamp);
      
      switch (filter) {
        case FILTER_OPTIONS.UNREAD:
          return !notification.read;
        case FILTER_OPTIONS.TODAY:
          return isToday(notificationDate);
        case FILTER_OPTIONS.SYSTEM:
          return notification.type === 'system';
        case FILTER_OPTIONS.VISIT:
          return notification.type === 'visit_reminder';
        case FILTER_OPTIONS.ALL:
        default:
          return true;
      }
    });
  }, [notifications, filter]);

  // 날짜별로 알림 그룹화
  const groupedNotifications = useMemo(() => {
    if (!filteredNotifications.length) return {};
    
    return filteredNotifications.reduce((groups, notification) => {
      const date = new Date(notification.timestamp);
      let groupKey;
      
      if (isToday(date)) {
        groupKey = '오늘';
      } else if (isYesterday(date)) {
        groupKey = '어제';
      } else if (isThisWeek(date)) {
        groupKey = '이번 주';
      } else if (isThisMonth(date)) {
        groupKey = '이번 달';
      } else {
        groupKey = format(date, 'yyyy년 M월', { locale: ko });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(notification);
      return groups;
    }, {});
  }, [filteredNotifications]);

  // 그룹화된 알림 키 (날짜 카테고리)
  const groupKeys = useMemo(() => {
    return Object.keys(groupedNotifications);
  }, [groupedNotifications]);

  // 애니메이션 설정
  const drawerVariants = useMemo(() => {
    // 접근성 설정에 따라 애니메이션 조정
    if (preferReducedMotion) {
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.1 } },
        exit: { opacity: 0, transition: { duration: 0.1 } }
      };
    }
    
    return {
      hidden: isMobile ? { x: '100%' } : { x: '30%', opacity: 0 },
      visible: { 
        x: 0, 
        opacity: 1,
        transition: { 
          type: 'spring', 
          stiffness: 300, 
          damping: 30,
          duration: 0.3
        }
      },
      exit: {
        x: isMobile ? '100%' : '30%', 
        opacity: isMobile ? 1 : 0,
        transition: { 
          duration: 0.2
        }
      }
    };
  }, [isMobile, preferReducedMotion]);

  return (
    <AnimatePresence>
      {isNotificationCenterOpen && (
        <Drawer
          anchor={isMobile ? 'right' : 'left'}
          open={isNotificationCenterOpen}
          onClose={handleClose}
          variant="temporary"
          ModalProps={{
            keepMounted: false,
          }}
          PaperProps={{
            component: motion.div,
            variants: drawerVariants,
            initial: "hidden",
            animate: "visible",
            exit: "exit",
            sx: {
              width: isMobile ? '100%' : 360,
              maxWidth: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
        >
          {/* 헤더 */}
          <Box 
            sx={{ 
              p: 2, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              borderBottom: `1px solid ${theme.palette.divider}`
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isMobile && (
                <IconButton edge="start" onClick={handleClose} sx={{ mr: 1 }}>
                  <ArrowBackIcon />
                </IconButton>
              )}
              <Typography variant="h6" component="div">
                알림 센터
              </Typography>
              {unreadCount > 0 && (
                <Badge 
                  badgeContent={unreadCount} 
                  color="error" 
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
            
            <Box>
              <Tooltip title="새로고침">
                <IconButton 
                  onClick={handleRefresh}
                  disabled={loading}
                  className="btn-tap"
                >
                  {loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )}
                </IconButton>
              </Tooltip>
              
              <Tooltip title="필터">
                <IconButton 
                  onClick={handleMenuOpen}
                  className="btn-tap"
                >
                  <FilterIcon />
                </IconButton>
              </Tooltip>
              
              {!isMobile && (
                <Tooltip title="닫기">
                  <IconButton 
                    onClick={handleClose}
                    edge="end"
                    className="btn-tap"
                  >
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
          
          {/* 탭 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ px: 1 }}
            >
              <Tab label="전체" />
              <Tab 
                label={
                  <Badge 
                    badgeContent={unreadCount} 
                    color="error"
                    sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 14, minWidth: 14 } }}
                  >
                    읽지 않음
                  </Badge>
                } 
              />
              <Tab label="방문 알림" />
              <Tab label="시스템" />
            </Tabs>
          </Box>
          
          {/* 액션 버튼 */}
          {unreadCount > 0 && (
            <Box 
              sx={{ 
                p: 1, 
                display: 'flex', 
                justifyContent: 'center',
                borderBottom: `1px solid ${theme.palette.divider}`
              }}
            >
              <Button 
                startIcon={<DoneIcon />} 
                onClick={handleMarkAllRead}
                color="primary"
                size="small"
                className="btn-tap"
                variant="outlined"
                fullWidth
                sx={{ borderRadius: 20 }}
              >
                모두 읽음으로 표시
              </Button>
            </Box>
          )}

          {/* 알림 목록 */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && !filteredNotifications.length ? (
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  height: '100%', 
                  p: 3 
                }}
              >
                <CircularProgress />
              </Box>
            ) : error ? (
              <Box 
                sx={{ 
                  p: 3, 
                  textAlign: 'center', 
                  color: 'text.secondary' 
                }}
              >
                <Typography variant="body2" gutterBottom color="error">
                  알림을 불러오는 중 오류가 발생했습니다.
                </Typography>
                <Button 
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  size="small"
                  sx={{ mt: 1 }}
                  className="btn-tap"
                >
                  다시 시도
                </Button>
              </Box>
            ) : filteredNotifications.length === 0 ? (
              <Box 
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center', 
                  alignItems: 'center',
                  height: '100%', 
                  p: 3 
                }}
              >
                <NotificationsOffIcon 
                  sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} 
                />
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  {filter === FILTER_OPTIONS.ALL 
                    ? '알림이 없습니다' 
                    : '일치하는 알림이 없습니다'}
                </Typography>
                {filter !== FILTER_OPTIONS.ALL && (
                  <Button 
                    onClick={() => setFilter(FILTER_OPTIONS.ALL)}
                    size="small"
                    sx={{ mt: 1 }}
                    className="btn-tap"
                  >
                    모든 알림 보기
                  </Button>
                )}
              </Box>
            ) : (
              <List disablePadding>
                <AnimatePresence initial={false}>
                  {groupKeys.map(groupKey => (
                    <React.Fragment key={groupKey}>
                      <ListItem 
                        sx={{ 
                          backgroundColor: theme.palette.action.hover,
                          px: 2,
                          py: 0.5,
                        }}
                      >
                        <ListItemText 
                          primary={groupKey} 
                          primaryTypographyProps={{ 
                            variant: 'caption', 
                            color: 'text.secondary',
                            fontWeight: 'medium' 
                          }}
                        />
                      </ListItem>
                      
                      {groupedNotifications[groupKey].map(notification => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ 
                            duration: preferReducedMotion ? 0.1 : 0.2 
                          }}
                          layout={!preferReducedMotion}
                        >
                          <NotificationItem 
                            notification={notification} 
                            onClose={handleClose}
                          />
                        </motion.div>
                      ))}
                    </React.Fragment>
                  ))}
                </AnimatePresence>
              </List>
            )}
          </Box>
          
          {/* 필터 메뉴 */}
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem 
              onClick={() => handleFilterChange(FILTER_OPTIONS.ALL)}
              selected={filter === FILTER_OPTIONS.ALL}
            >
              모든 알림
            </MenuItem>
            <MenuItem 
              onClick={() => handleFilterChange(FILTER_OPTIONS.UNREAD)}
              selected={filter === FILTER_OPTIONS.UNREAD}
            >
              <Badge 
                badgeContent={unreadCount} 
                color="error"
                sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 14, minWidth: 14 } }}
              >
                읽지 않은 알림
              </Badge>
            </MenuItem>
            <MenuItem 
              onClick={() => handleFilterChange(FILTER_OPTIONS.TODAY)}
              selected={filter === FILTER_OPTIONS.TODAY}
            >
              오늘
            </MenuItem>
            <MenuItem 
              onClick={() => handleFilterChange(FILTER_OPTIONS.VISIT)}
              selected={filter === FILTER_OPTIONS.VISIT}
            >
              방문 알림
            </MenuItem>
            <MenuItem 
              onClick={() => handleFilterChange(FILTER_OPTIONS.SYSTEM)}
              selected={filter === FILTER_OPTIONS.SYSTEM}
            >
              시스템 알림
            </MenuItem>
          </Menu>
        </Drawer>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;
