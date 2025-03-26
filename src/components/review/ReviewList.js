// src/components/review/ReviewList.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Divider, 
  Rating, 
  Avatar, 
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
  Collapse,
  Fade,
  Snackbar
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSavedPlaces } from '../../contexts/SavedPlacesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import EditIcon from '@mui/icons-material/Edit';
import WifiOffIcon from '@mui/icons-material/WifiOff';

/**
 * 리뷰 목록 컴포넌트
 * 
 * @param {Object} props
 * @param {string} props.placeId - 장소 ID
 * @param {string} props.placeName - 장소 이름
 * @param {function} props.onReviewUpdate - 리뷰 업데이트 시 호출할 콜백 함수
 */
const ReviewList = ({ placeId, placeName, onReviewUpdate }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const { visitHistory, loading: historyLoading } = useSavedPlaces();
  const { getFeedbackForPlace, submitFeedback, updateUserFeedback } = useFeedback();
  
  const [reviews, setReviews] = useState([]);
  const [userVisit, setUserVisit] = useState(null);
  const [userFeedback, setUserFeedback] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [error, setError] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkErrorOpen, setNetworkErrorOpen] = useState(false);
  const [localSavedOpen, setLocalSavedOpen] = useState(false);

  // 사전 정의된 태그 목록
  const availableTags = React.useMemo(() => [
    { id: 'accurate_recommendation', label: '추천이 정확함' },
    { id: 'good_atmosphere', label: '분위기가 좋음' },
    { id: 'good_value', label: '가격 대비 만족' },
    { id: 'too_crowded', label: '너무 혼잡함' },
    { id: 'would_visit_again', label: '다시 방문하고 싶음' },
    { id: 'not_as_expected', label: '기대와 달랐음' },
    { id: 'worth_visit', label: '방문할 가치 있음' },
    { id: 'good_service', label: '서비스가 좋음' }
  ], []);

  // 사용자 피드백 로드
  const loadUserFeedback = useCallback(async () => {
    if (!isAuthenticated || !currentUser || !placeId) return;
    
    setFeedbackLoading(true);
    try {
      const result = await getFeedbackForPlace(placeId);
      if (result && result.success && result.data) {
        setUserFeedback(result.data);
        
        // 폼 초기화에 사용할 데이터 설정
        setRating(result.data.relevanceRating || 0);
        setReviewText(result.data.comment || '');
        
        // 피드백의 태그를 ID로 변환하여 설정
        if (result.data.tags && result.data.tags.length > 0) {
          const tagIds = result.data.tags.map(tagLabel => {
            const tag = availableTags.find(t => t.label === tagLabel);
            return tag ? tag.id : null;
          }).filter(id => id !== null);
          
          setSelectedTags(tagIds);
        }
      } else {
        setUserFeedback(null);
      }
    } catch (err) {
      console.error("Error loading user feedback:", err);
      
      // 오프라인 상태에서 로컬 저장된 데이터 확인
      if (!navigator.onLine) {
        const pendingReviewStr = localStorage.getItem(`pendingReview_${placeId}`);
        if (pendingReviewStr) {
          try {
            const pendingReview = JSON.parse(pendingReviewStr);
            setUserFeedback({
              ...pendingReview,
              offline: true
            });
          } catch (parseErr) {
            console.error("로컬 저장 데이터 파싱 오류:", parseErr);
          }
        }
      }
    } finally {
      setFeedbackLoading(false);
    }
  }, [isAuthenticated, currentUser, placeId, getFeedbackForPlace, availableTags]);

  // 오프라인 저장 데이터 동기화 함수
  const syncOfflineData = useCallback(async () => {
    try {
      const pendingReviewStr = localStorage.getItem(`pendingReview_${placeId}`);
      if (!pendingReviewStr) return;
      
      const pendingReview = JSON.parse(pendingReviewStr);
      console.log('오프라인 데이터 동기화 시도:', pendingReview);
      
      if (pendingReview.feedbackId) {
        // 수정된 리뷰 동기화
        await updateUserFeedback(placeId, pendingReview.feedbackId, {
          relevanceRating: pendingReview.rating,
          comment: pendingReview.comment,
          tags: pendingReview.tags
        });
      } else {
        // 새 리뷰 동기화
        await submitFeedback(placeId, {
          relevanceRating: pendingReview.rating,
          comment: pendingReview.comment,
          tags: pendingReview.tags
        });
      }
      
      // 동기화 성공 시 로컬 데이터 삭제
      localStorage.removeItem(`pendingReview_${placeId}`);
      
      // 피드백 데이터 리로드
      await loadUserFeedback();
      
      // 상위 컴포넌트에 알림
      if (onReviewUpdate) {
        onReviewUpdate();
      }
      
      setLocalSavedOpen(true);
    } catch (err) {
      console.error('오프라인 데이터 동기화 오류:', err);
    }
  }, [placeId, updateUserFeedback, submitFeedback, loadUserFeedback, onReviewUpdate]);

  // 네트워크 상태 감지 이벤트 리스너
  useEffect(() => {
    const handleOnlineStatus = () => {
      console.log('네트워크 상태 변경:', navigator.onLine ? '온라인' : '오프라인');
      setIsOnline(navigator.onLine);
      
      // 오프라인에서 온라인으로 전환된 경우, 로컬 저장 데이터 동기화 시도
      if (navigator.onLine && localStorage.getItem(`pendingReview_${placeId}`)) {
        syncOfflineData();
      }
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [placeId, syncOfflineData]);

  // 리뷰 데이터 가져오기
  useEffect(() => {
    const loadReviews = async () => {
      setLoading(true);
      try {
        // 임시 데이터 설정 - 실제 구현 시 API 호출로 대체
        const mockReviews = [];
        // TODO: 실제 리뷰 데이터 가져오기
        setReviews(mockReviews);
      } catch (err) {
        console.error("Error loading reviews:", err);
        setError("리뷰를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    
    loadReviews();
  }, [placeId]);
  
  // 유저 방문 기록 확인
  useEffect(() => {
    if (isAuthenticated && currentUser && visitHistory.length > 0) {
      try {
        // 현재 장소의 방문 기록 찾기
        const visits = visitHistory.filter(visit => visit.placeId === placeId);
        
        if (visits.length > 0) {
          // 가장 최근 방문을 사용자 방문으로 설정
          const latestVisit = [...visits].sort((a, b) => 
            new Date(b.visitDate) - new Date(a.visitDate)
          )[0];
          
          setUserVisit(latestVisit);
        }
      } catch (err) {
        console.error("Error finding user visit:", err);
        setError("방문 기록을 불러오는 중 오류가 발생했습니다.");
      }
    }
    
    // 사용자 피드백 로드
    loadUserFeedback();
  }, [isAuthenticated, currentUser, placeId, visitHistory, loadUserFeedback]);

  // 리뷰 작성 폼 열기 핸들러
  const handleOpenForm = () => {
    // 로그인 확인
    if (!checkAuthentication()) return;
    
    if (userVisit || userFeedback) {
      // 기존 피드백이 있으면 해당 데이터로 폼 초기화
      if (userFeedback) {
        setRating(userFeedback.relevanceRating || 0);
        setReviewText(userFeedback.comment || '');
        
        // 피드백의 태그를 ID로 변환하여 설정
        if (userFeedback.tags && userFeedback.tags.length > 0) {
          const tagIds = userFeedback.tags.map(tagLabel => {
            const tag = availableTags.find(t => t.label === tagLabel);
            return tag ? tag.id : null;
          }).filter(id => id !== null);
          
          setSelectedTags(tagIds);
        } else {
          setSelectedTags([]);
        }
      } else {
        // 방문 기록만 있는 경우 기본값으로 초기화
        setRating(userVisit.rating || 0);
        setReviewText(userVisit.review || '');
        setSelectedTags([]);
      }
      
      setFormOpen(true);
    }
  };

  // 인증 확인 함수
  const checkAuthentication = () => {
    if (!isAuthenticated || !currentUser) {
      setError("로그인이 필요한 기능입니다.");
      return false;
    }
    return true;
  };

  // 리뷰 작성 폼 닫기 핸들러
  const handleCloseForm = () => {
    setFormOpen(false);
    setError(null); // 에러 메시지 초기화
  };

  // 태그 토글 핸들러
  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // 리뷰 작성 제출
  const handleSubmitReview = async () => {
    if ((!userVisit && !userFeedback) || !rating) return;
    
    setReviewSubmitting(true);
    setError(null);
    
    try {
      // 네트워크 상태 확인
      if (!navigator.onLine) {
        console.log("오프라인 상태에서 리뷰 저장");
        
        // 태그 레이블 변환
        const tagLabels = selectedTags.map(tagId => {
          const tag = availableTags.find(t => t.id === tagId);
          return tag ? tag.label : tagId;
        });
        
        // 로컬 저장소에 리뷰 데이터 저장
        const offlineReviewData = {
          placeId,
          rating,
          comment: reviewText,
          tags: tagLabels,
          timestamp: new Date().toISOString(),
          feedbackId: userFeedback?.id // 기존 피드백 ID (수정인 경우)
        };
        
        localStorage.setItem(`pendingReview_${placeId}`, JSON.stringify(offlineReviewData));
        
        // 모달 닫기 및 성공 메시지 표시
        handleCloseForm();
        setNetworkErrorOpen(true);
        
        // 로컬 피드백 객체 업데이트 (UI 표시용)
        const localFeedback = {
          relevanceRating: rating,
          comment: reviewText,
          tags: tagLabels,
          offline: true,
          id: userFeedback?.id || `local_${Date.now()}`
        };
        
        setUserFeedback(localFeedback);
        
        // 상위 컴포넌트에 알림
        if (onReviewUpdate) {
          onReviewUpdate();
        }
        
        setReviewSubmitting(false);
        return;
      }
      
      // 태그 레이블 변환
      const tagLabels = selectedTags.map(tagId => {
        const tag = availableTags.find(t => t.id === tagId);
        return tag ? tag.label : tagId;
      });
      
      const feedbackData = {
        relevanceRating: rating,
        comment: reviewText,
        tags: tagLabels
      };
      
      console.log("Submitting review data:", feedbackData);
      
      let success = false;
      
      if (userFeedback) {
        // 기존 피드백 업데이트
        console.log("Updating existing feedback:", userFeedback.id);
        success = await updateUserFeedback(placeId, userFeedback.id, feedbackData);
        console.log("Update result:", success);
      } else if (userVisit) {
        // 새 피드백 제출
        console.log("Submitting new feedback");
        success = await submitFeedback(placeId, feedbackData);
        console.log("Submit result:", success);
      }
      
      if (success) {
        setUpdateSuccess(true);
        handleCloseForm();
        
        // 피드백 데이터 리로드
        await loadUserFeedback();
        
        // 상위 컴포넌트에 알림
        if (onReviewUpdate) {
          onReviewUpdate();
        }
        
        // 5초 후 성공 메시지 숨기기
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 5000);
      } else {
        setError("리뷰 저장에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      
      if (!navigator.onLine) {
        setError("네트워크 연결이 없습니다. 연결 상태를 확인해주세요.");
        setNetworkErrorOpen(true);
      } else {
        setError(err.message || "리뷰 작성 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  // 사용자 방문 섹션 렌더링
  const renderUserSection = () => {
    if (!isAuthenticated || !currentUser) {
      return (
        <Alert severity="info" sx={{ mb: 3 }}>
          로그인하고 방문 인증을 하면 리뷰를 작성할 수 있습니다.
        </Alert>
      );
    }
    
    if (feedbackLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    
    if (!userVisit && !userFeedback) {
      return (
        <Alert severity="info" sx={{ mb: 3 }}>
          이 장소를 방문하고 인증하면 리뷰를 작성할 수 있습니다.
        </Alert>
      );
    }
    
    // 사용자 피드백이 있는 경우 피드백 보여주기
    if (userFeedback) {
      return (
        <Fade in={true}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="medium">
                    내 리뷰
                    {userFeedback.offline && (
                      <Chip 
                        icon={<WifiOffIcon />}
                        label="오프라인 저장됨" 
                        size="small" 
                        color="warning" 
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {userFeedback.timestamp ? (
                      formatDistanceToNow(new Date(userFeedback.timestamp), {
                        addSuffix: true,
                        locale: ko
                      })
                    ) : '날짜 정보 없음'}
                  </Typography>
                </Box>
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={handleOpenForm}
                  startIcon={<EditIcon />}
                  disabled={reviewSubmitting}
                >
                  리뷰 수정하기
                </Button>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Rating value={userFeedback.relevanceRating || 0} readOnly precision={0.5} />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {(userFeedback.relevanceRating || 0).toFixed(1)}
                  </Typography>
                </Box>
                
                {userFeedback.comment && (
                  <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                    {userFeedback.comment}
                  </Typography>
                )}
                
                {userFeedback.tags && userFeedback.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {userFeedback.tags.map((tag, idx) => (
                      <Chip 
                        key={idx} 
                        label={tag} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Fade>
      );
    }
    
    // 방문 기록만 있는 경우
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="medium">
                내 방문
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userVisit.visitDate ? (
                  new Date(userVisit.visitDate).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                ) : '날짜 정보 없음'}
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              color="primary"
              onClick={handleOpenForm}
              disabled={reviewSubmitting}
            >
              {userVisit.review ? '리뷰 수정하기' : '리뷰 작성하기'}
            </Button>
          </Box>
          
          {userVisit.rating > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">내 평가</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Rating value={userVisit.rating} readOnly precision={0.5} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {userVisit.rating.toFixed(1)}
                </Typography>
              </Box>
              {userVisit.review && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {userVisit.review}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // 리뷰 목록 렌더링
  const renderReviews = () => {
    // 실제 리뷰 기능이 구현되면 이 부분을 수정하세요
    if (reviews.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" color="text.secondary">
            아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!
          </Typography>
        </Box>
      );
    }
    
    return reviews.map((review, index) => (
      <Box key={review.id || index} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', mb: 1 }}>
          <Avatar alt={review.userName} src={review.userAvatar} />
          <Box sx={{ ml: 2 }}>
            <Typography variant="subtitle2">
              {review.userName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {review.timestamp && formatDistanceToNow(new Date(review.timestamp), { 
                addSuffix: true,
                locale: ko
              })}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Rating value={review.rating} readOnly precision={0.5} size="small" />
          <Typography variant="body2" sx={{ ml: 1 }}>
            {review.rating.toFixed(1)}
          </Typography>
        </Box>
        
        <Typography variant="body2">
          {review.content}
        </Typography>
        
        {index < reviews.length - 1 && <Divider sx={{ my: 2 }} />}
      </Box>
    ));
  };

  if (historyLoading && loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'medium' }}>
        리뷰
      </Typography>
      
      {/* 네트워크 상태 알림 */}
      {!isOnline && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WifiOffIcon />}>
          오프라인 상태입니다. 네트워크 연결이 복구되면 저장된 리뷰가 자동으로 동기화됩니다.
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Collapse in={updateSuccess}>
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setUpdateSuccess(false)}
        >
          리뷰가 성공적으로 업데이트되었습니다.
        </Alert>
      </Collapse>
      
      {renderUserSection()}
      
      {renderReviews()}
      
      {/* 리뷰 작성 다이얼로그 */}
      <Dialog 
        open={formOpen} 
        onClose={handleCloseForm}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {userFeedback ? '리뷰 수정' : '리뷰 작성'}
          {!isOnline && (
            <Chip 
              icon={<WifiOffIcon />}
              label="오프라인 모드" 
              color="warning" 
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {!isOnline && (
            <Alert severity="info" sx={{ mb: 2 }}>
              오프라인 상태에서는 리뷰가 기기에 임시 저장됩니다. 네트워크 연결이 복구되면 자동으로 서버에 업로드됩니다.
            </Alert>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            {placeName}
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              평점
            </Typography>
            <Rating
              value={rating}
              onChange={(e, newValue) => setRating(newValue)}
              precision={0.5}
              size="large"
            />
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              태그 선택 (선택사항)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {availableTags.map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.label}
                  onClick={() => handleTagToggle(tag.id)}
                  color={selectedTags.includes(tag.id) ? "primary" : "default"}
                  variant={selectedTags.includes(tag.id) ? "filled" : "outlined"}
                  sx={{ mb: 1, mr: 1 }}
                />
              ))}
            </Box>
          </Box>
          
          <TextField
            label="리뷰 내용"
            multiline
            rows={4}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            fullWidth
            variant="outlined"
            placeholder="방문 경험을 자유롭게 작성해주세요."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>취소</Button>
          <Button 
            onClick={handleSubmitReview} 
            color="primary" 
            variant="contained"
            disabled={!rating || reviewSubmitting}
          >
            {reviewSubmitting ? "처리 중..." : (userFeedback ? "수정" : "저장")}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 오프라인 저장 알림 스낵바 */}
      <Snackbar
        open={networkErrorOpen}
        autoHideDuration={6000}
        onClose={() => setNetworkErrorOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNetworkErrorOpen(false)} 
          severity="warning" 
          sx={{ width: '100%' }}
          icon={<WifiOffIcon />}
        >
          오프라인 상태입니다. 리뷰가 기기에 저장되었으며 네트워크 연결 시 자동으로 업로드됩니다.
        </Alert>
      </Snackbar>

      {/* 로컬 데이터 동기화 알림 */}
      <Snackbar
        open={localSavedOpen}
        autoHideDuration={4000}
        onClose={() => setLocalSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setLocalSavedOpen(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          오프라인에서 저장된 리뷰가 서버에 성공적으로 동기화되었습니다.
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReviewList;
