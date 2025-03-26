import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { saveFeedback, getUserFeedbackForPlace, updateFeedback } from '../services/feedbackService';
import { useUser } from './UserContext';

// 피드백 Context 생성
const FeedbackContext = createContext();

// 피드백 Context 제공자 컴포넌트
export const FeedbackProvider = ({ children }) => {
  const { currentUser } = useUser();
  const [feedbackStatus, setFeedbackStatus] = useState({
    loading: false,
    error: null,
    success: false,
  });
  
  // 피드백 제출 중복 방지를 위한 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 피드백 제출 함수
  const submitFeedback = useCallback(
    async (placeId, feedbackData) => {
      // 이미 제출 중인 경우 중복 실행 방지
      if (isSubmitting) {
        return false;
      }
      
      if (!currentUser || !currentUser.uid) {
        setFeedbackStatus({
          loading: false,
          error: '피드백을 저장하려면 로그인이 필요합니다.',
          success: false,
        });
        return false;
      }

      // 데이터 유효성 검사
      if (!feedbackData || !placeId) {
        setFeedbackStatus({
          loading: false,
          error: '유효하지 않은 피드백 데이터입니다.',
          success: false,
        });
        return false;
      }

      setIsSubmitting(true);
      setFeedbackStatus({ loading: true, error: null, success: false });

      try {
        console.log(`[FeedbackContext] 피드백 저장 시작: 사용자=${currentUser.uid}, 장소=${placeId}`);
        
        // 데이터 정규화
        const normalizedData = {
          ...feedbackData,
          relevanceRating: Number(feedbackData.relevanceRating),
          comment: feedbackData.comment != null ? String(feedbackData.comment) : '',
          tags: Array.isArray(feedbackData.tags) ? feedbackData.tags : [],
          timestamp: new Date()
        };
        
        await saveFeedback(currentUser.uid, placeId, normalizedData);
        
        console.log('[FeedbackContext] 피드백 저장 완료');
        
        setFeedbackStatus({
          loading: false,
          error: null,
          success: true,
        });
        
        // 성공 상태 3초 후 초기화
        setTimeout(() => {
          setFeedbackStatus(prev => ({ ...prev, success: false }));
        }, 3000);
        
        return true;
      } catch (error) {
        console.error('[FeedbackContext] 피드백 저장 오류:', error);
        setFeedbackStatus({
          loading: false,
          error: '피드백을 저장하는 중에 오류가 발생했습니다.',
          success: false,
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentUser, isSubmitting]
  );

  // 피드백 업데이트 함수 (수정)
  const updateUserFeedback = useCallback(
    async (placeId, feedbackId, feedbackData) => {
      // 이미 제출 중인 경우 중복 실행 방지
      if (isSubmitting) {
        return false;
      }
      
      if (!currentUser || !currentUser.uid) {
        setFeedbackStatus({
          loading: false,
          error: '피드백을 업데이트하려면 로그인이 필요합니다.',
          success: false,
        });
        return false;
      }

      // 데이터 유효성 검사
      if (!feedbackData || !placeId || !feedbackId) {
        setFeedbackStatus({
          loading: false,
          error: '유효하지 않은 피드백 데이터입니다.',
          success: false,
        });
        return false;
      }

      setIsSubmitting(true);
      setFeedbackStatus({ loading: true, error: null, success: false });

      try {
        console.log(`[FeedbackContext] 피드백 업데이트 시작: 사용자=${currentUser.uid}, 장소=${placeId}, 피드백ID=${feedbackId}`);
        
        // 데이터 정규화
        const normalizedData = {
          ...feedbackData,
          relevanceRating: Number(feedbackData.relevanceRating),
          comment: feedbackData.comment != null ? String(feedbackData.comment) : '',
          tags: Array.isArray(feedbackData.tags) ? feedbackData.tags : [],
          updatedAt: new Date()
        };
        
        // 피드백 서비스의 업데이트 함수 호출
        await updateFeedback(currentUser.uid, placeId, feedbackId, normalizedData);
        
        console.log('[FeedbackContext] 피드백 업데이트 완료');
        
        setFeedbackStatus({
          loading: false,
          error: null,
          success: true,
        });
        
        // 성공 상태 3초 후 초기화
        setTimeout(() => {
          setFeedbackStatus(prev => ({ ...prev, success: false }));
        }, 3000);
        
        return true;
      } catch (error) {
        console.error('[FeedbackContext] 피드백 업데이트 오류:', error);
        
        // 오프라인 상태 확인 및 처리
        if (!navigator.onLine) {
          setFeedbackStatus({
            loading: false,
            error: '오프라인 상태입니다. 네트워크 연결 시 자동으로 업데이트됩니다.',
            success: false,
          });

          // 오프라인 대기열에 추가
          try {
            const pendingUpdates = JSON.parse(localStorage.getItem('pendingFeedbackUpdates') || '[]');
            // 여기서 normalizedData를 사용하는 대신 직접 객체 생성
            const updateData = {
              type: 'update',
              userId: currentUser.uid,
              placeId,
              feedbackId,
              data: {
                ...feedbackData,
                relevanceRating: Number(feedbackData.relevanceRating),
                comment: feedbackData.comment != null ? String(feedbackData.comment) : '',
                tags: Array.isArray(feedbackData.tags) ? feedbackData.tags : [],
                updatedAt: new Date()
              },
              timestamp: new Date().toISOString()
            };
            pendingUpdates.push(updateData);
            localStorage.setItem('pendingFeedbackUpdates', JSON.stringify(pendingUpdates));
            
            return true; // 대기열에 추가했으므로 UI 측면에서는 성공으로 처리
          } catch (offlineError) {
            console.error('[FeedbackContext] 오프라인 대기열 저장 오류:', offlineError);
          }
        }
        
        setFeedbackStatus({
          loading: false,
          error: '피드백을 업데이트하는 중에 오류가 발생했습니다.',
          success: false,
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentUser, isSubmitting]
  );

  // 피드백 상태 초기화 함수
  const resetFeedbackStatus = useCallback(() => {
    setFeedbackStatus({
      loading: false,
      error: null,
      success: false,
    });
  }, []);

  // 특정 장소에 대한 사용자 피드백 가져오기 함수
  const getFeedbackForPlace = useCallback(async (placeId) => {
    if (!currentUser || !currentUser.uid || !placeId) {
      return null;
    }
    
    try {
      return await getUserFeedbackForPlace(placeId, currentUser.uid);
    } catch (error) {
      console.error('[FeedbackContext] 피드백 조회 오류:', error);
      return null;
    }
  }, [currentUser]);

  // 오프라인 상태에서 온라인으로 전환 시 대기 중인 업데이트 처리
  useEffect(() => {
    const handleOnline = async () => {
      try {
        // 로그인 상태 확인
        if (!currentUser || !currentUser.uid) return;
        
        // 대기 중인 피드백 업데이트 가져오기
        const pendingUpdates = JSON.parse(localStorage.getItem('pendingFeedbackUpdates') || '[]');
        if (pendingUpdates.length === 0) return;
        
        console.log('[FeedbackContext] 오프라인 상태에서 저장된 피드백 업데이트 처리:', pendingUpdates.length);
        
        // 현재 사용자의 대기 중인 작업만 필터링
        const userUpdates = pendingUpdates.filter(update => update.userId === currentUser.uid);
        
        // 각 업데이트 처리
        for (const update of userUpdates) {
          try {
            if (update.type === 'update' && update.data) {
              await updateFeedback(update.userId, update.placeId, update.feedbackId, update.data);
              console.log(`[FeedbackContext] 대기 중이던 피드백 업데이트 성공: ${update.feedbackId}`);
            }
          } catch (error) {
            console.error('[FeedbackContext] 대기 중이던 피드백 업데이트 실패:', error);
          }
        }
        
        // 완료된 작업 제거
        const remainingUpdates = pendingUpdates.filter(
          update => update.userId !== currentUser.uid
        );
        localStorage.setItem('pendingFeedbackUpdates', JSON.stringify(remainingUpdates));
        
      } catch (error) {
        console.error('[FeedbackContext] 온라인 전환 처리 오류:', error);
      }
    };
    
    // 온라인 상태 변화 이벤트 리스너 등록
    window.addEventListener('online', handleOnline);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser]);

  const value = {
    feedbackStatus,
    submitFeedback,
    updateUserFeedback, // 새로 추가된 함수
    resetFeedbackStatus,
    getFeedbackForPlace,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
};

// 피드백 Context 사용을 위한 커스텀 훅
export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

export default FeedbackContext;
