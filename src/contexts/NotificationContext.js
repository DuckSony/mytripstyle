// src/contexts/NotificationContext.js
import React, { createContext, useContext, useEffect, useCallback, useReducer } from 'react';
import { useAuth } from './AuthContext';
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification, 
  subscribeToUserNotifications 
} from '../services/notificationService';

// 알림 타입 상수
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  PLACE_RECOMMEND: 'place_recommend',
  VISIT_REMINDER: 'visit_reminder',
  SYSTEM: 'system'
};

// 초기 상태
const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: true,
  error: null,
  isOpen: false, // 알림 센터 열림 상태
};

// 리듀서 함수 정의
function notificationReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { 
        ...state, 
        notifications: action.payload, 
        unreadCount: action.payload.filter(n => !n.read).length,
        loading: false 
      };
    case 'FETCH_ERROR':
      return { ...state, error: action.payload, loading: false };
      case 'ADD_NOTIFICATION': {
        const updatedNotifications = [action.payload, ...state.notifications];
        return { 
          ...state, 
          notifications: updatedNotifications,
          unreadCount: action.payload.read ? state.unreadCount : state.unreadCount + 1 
        };
      }

    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification => 
          notification.id === action.payload 
            ? { ...notification, read: true } 
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      };
    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification => ({ ...notification, read: true })),
        unreadCount: 0
      };
    case 'DELETE_NOTIFICATION': {
      const filteredNotifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
      const wasUnread = state.notifications.find(n => n.id === action.payload && !n.read);
      return {
        ...state,
        notifications: filteredNotifications,
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    }
    case 'TOGGLE_NOTIFICATION_CENTER':
      return { ...state, isOpen: action.payload };
    default:
      return state;
  }
}

// 컨텍스트 생성
const NotificationContext = createContext();

// 커스텀 훅
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// 프로바이더 컴포넌트
export const NotificationProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  
  // 알림 데이터 가져오기
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    dispatch({ type: 'FETCH_START' });
    try {
      const notifications = await getNotifications();
      dispatch({ type: 'FETCH_SUCCESS', payload: notifications });
    } catch (error) {
      console.error('알림 가져오기 오류:', error);
      dispatch({ type: 'FETCH_ERROR', payload: error.message });
    }
  }, [isAuthenticated]);

  // 실시간 알림 구독
  useEffect(() => {
    let unsubscribe = () => {};

    if (isAuthenticated && currentUser) {
      dispatch({ type: 'FETCH_START' });
      unsubscribe = subscribeToUserNotifications(
        currentUser.uid,
        (notifications) => {
          dispatch({ type: 'FETCH_SUCCESS', payload: notifications });
        },
        (error) => {
          console.error('알림 구독 오류:', error);
          dispatch({ type: 'FETCH_ERROR', payload: error.message });
        }
      );
    }

    return () => {
      unsubscribe();
    };
  }, [currentUser, isAuthenticated]);

  // 알림을 읽음으로 표시
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      dispatch({ type: 'MARK_AS_READ', payload: notificationId });
    } catch (error) {
      console.error('알림 읽음 표시 오류:', error);
    }
  }, []);

  // 모든 알림을 읽음으로 표시
  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      dispatch({ type: 'MARK_ALL_READ' });
    } catch (error) {
      console.error('모든 알림 읽음 표시 오류:', error);
    }
  }, []);

  // 알림 삭제
  const removeNotification = useCallback(async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      dispatch({ type: 'DELETE_NOTIFICATION', payload: notificationId });
    } catch (error) {
      console.error('알림 삭제 오류:', error);
    }
  }, []);

  // 알림 센터 열기/닫기 토글
  const toggleNotificationCenter = useCallback((isOpen = !state.isOpen) => {
    dispatch({ type: 'TOGGLE_NOTIFICATION_CENTER', payload: isOpen });
    // 알림 센터를 열 때 자동으로 알림 가져오기 갱신
    if (isOpen) {
      fetchNotifications();
    }
  }, [state.isOpen, fetchNotifications]);

  // 로컬 알림 추가 (시스템 내부용, Firebase에 저장하지 않음)
  const addLocalNotification = useCallback((notification) => {
    const newNotification = {
      ...notification,
      id: `local-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
    
    // 브라우저 알림 권한이 있으면 표시
    if (Notification.permission === 'granted' && notification.showBrowserNotification) {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico' // 앱 아이콘
      });
      
      // 알림 클릭 시 앱으로 포커스
      browserNotification.onclick = () => {
        window.focus();
        if (notification.link) {
          window.location.href = notification.link;
        }
        markAsRead(newNotification.id);
      };
    }
    
    return newNotification.id;
  }, [markAsRead]);

  // 컨텍스트 값
  const value = {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    isNotificationCenterOpen: state.isOpen,
    markAsRead,
    markAllRead,
    removeNotification,
    toggleNotificationCenter,
    addLocalNotification,
    fetchNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
