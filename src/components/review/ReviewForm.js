// src/components/review/ReviewForm.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  TextField, 
  Rating, 
  Button, 
  Typography, 
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  FormHelperText,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  Close as CloseIcon,
  Send as SendIcon,
  Favorite as FavoriteIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  WifiOff as WifiOffIcon
} from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';

// 리뷰 태그 목록 - 컴포넌트 외부로 이동하여 재렌더링 방지
const REVIEW_TAGS = {
  atmosphere: ['조용함', '활기참', '로맨틱함', '힙함', '아늑함'],
  value: ['가성비', '가격대비만족', '고급스러움'],
  features: ['인스타감성', '친절한', '청결한', '뷰가좋은', '주차편리'],
  experience: ['재방문의사', '추천해요', '아쉬워요']
};

// 카테고리 한글명 - 객체로 분리
const CATEGORY_NAMES = {
  atmosphere: '분위기',
  value: '가격/가치',
  features: '특징',
  experience: '경험'
};

// 초기 폼 상태 - 상수로 분리
const INITIAL_FORM_STATE = {
  rating: 0,
  content: '',
  selectedTags: [],
  visitDate: new Date(),
  recommendationRating: 0
};

// 리뷰 작성 폼 컴포넌트
const ReviewForm = ({ placeId, placeName, isOpen, onClose, onSubmit, existingReview = null }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 사용자 컨텍스트에서 현재 사용자 정보 가져오기
  const { userProfile } = useUser();

  // 폼 상태 관리 - 하나의 객체로 통합하여 상태 업데이트 최적화
  const [formState, setFormState] = useState({ ...INITIAL_FORM_STATE });
  const { rating, content, selectedTags, visitDate, recommendationRating } = formState;
  
  // 유효성 검사 및 제출 상태
  const [errors, setErrors] = useState({
    content: false,
    rating: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // 네트워크 상태 관리 추가
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSubmittingOffline, setIsSubmittingOffline] = useState(false);
  // 오프라인 저장 및 동기화 알림을 위한 상태 추가
  const [offlineSaveAlert, setOfflineSaveAlert] = useState(false);
  const [syncSuccessAlert, setSyncSuccessAlert] = useState(false);

  // 오프라인 데이터 동기화 함수
  const syncOfflineData = useCallback(async (pendingReviewStr) => {
    try {
      if (!pendingReviewStr) return;
      
      const pendingReview = JSON.parse(pendingReviewStr);
      console.log('오프라인 데이터 동기화 시작:', pendingReview);
      
      // 리뷰 데이터 준비
      const reviewData = {
        rating: pendingReview.rating,
        content: pendingReview.content,
        selectedTags: pendingReview.selectedTags,
        visitDate: new Date(pendingReview.visitDate || new Date()),
        recommendationRating: pendingReview.recommendationRating || 0
      };
      
      // 서버에 제출
      const result = await onSubmit(reviewData);
      console.log('동기화 결과:', result);
      
      if (result && result.success) {
        // 로컬 스토리지에서 제거
        localStorage.removeItem(`pendingReview_${placeId}`);
        
        // 동기화 성공 알림
        setSyncSuccessAlert(true);
        setTimeout(() => setSyncSuccessAlert(false), 5000);
        
        // 폼 상태 업데이트 (필요한 경우)
        if (isOpen) {
          setFormState({
            rating: result.data?.rating || reviewData.rating,
            content: result.data?.content || reviewData.content,
            selectedTags: result.data?.selectedTags || reviewData.selectedTags,
            visitDate: new Date(result.data?.visitDate || reviewData.visitDate),
            recommendationRating: result.data?.recommendationRating || reviewData.recommendationRating
          });
        }
      } else {
        console.error('동기화 실패:', result?.error || '알 수 없는 오류');
      }
    } catch (err) {
      console.error('오프라인 데이터 동기화 오류:', err);
    }
  }, [onSubmit, placeId, isOpen]);

  // 네트워크 상태 변화 감지
  useEffect(() => {
    const handleOnlineStatus = () => {
      const prevOnlineStatus = isOnline;
      const currentOnlineStatus = navigator.onLine;
      
      console.log(`네트워크 상태 변경: ${prevOnlineStatus ? '온라인' : '오프라인'} -> ${currentOnlineStatus ? '온라인' : '오프라인'}`);
      setIsOnline(currentOnlineStatus);
      
      // 오프라인에서 온라인으로 전환된 경우
      if (!prevOnlineStatus && currentOnlineStatus) {
        // 오프라인 상태에서 저장된 리뷰가 있는지 확인
        const pendingReviewStr = localStorage.getItem(`pendingReview_${placeId}`);
        
        if (pendingReviewStr) {
          console.log('오프라인에서 저장된 리뷰 발견, 동기화 시도');
          syncOfflineData(pendingReviewStr);
        }
        
        // 오류 초기화
        if (error && error.includes('오프라인')) {
          setError(null);
        }
      }
    };
    
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [isOnline, error, placeId, syncOfflineData]); // syncOfflineData 의존성 추가

  

  // 리뷰가 존재하는 경우, 폼 상태 초기화
  useEffect(() => {
    if (existingReview) {
      setFormState({
        rating: existingReview.rating || 0,
        content: existingReview.content || '',
        selectedTags: existingReview.tags || [],
        visitDate: existingReview.visitDate ? new Date(existingReview.visitDate) : new Date(),
        recommendationRating: existingReview.recommendationRating || 0
      });
    } else {
      // 새 리뷰 작성시 초기화
      setFormState({ ...INITIAL_FORM_STATE });
    }
    
    // 상태 초기화
    setErrors({
      content: false,
      rating: false
    });
    setError(null);
    setSuccess(false);
    setIsSubmittingOffline(false);
    setOfflineSaveAlert(false);
    
    // 처음 열릴 때 오프라인 상태 확인
    if (isOpen && !navigator.onLine) {
      console.log('폼이 오프라인 상태에서 열림');
    }
  }, [existingReview, isOpen]);

  // 폼 열릴 때 오프라인 저장 데이터 체크
  useEffect(() => {
    if (isOpen && placeId) {
      // 이미 오프라인에서 저장된 리뷰가 있는지 확인
      const pendingReviewStr = localStorage.getItem(`pendingReview_${placeId}`);
      
      if (pendingReviewStr && !existingReview) {
        try {
          console.log('이전에 오프라인 저장된 리뷰 발견');
          const pendingReview = JSON.parse(pendingReviewStr);
          
          // 로컬 저장 데이터로 폼 초기화
          setFormState({
            rating: pendingReview.rating || 0,
            content: pendingReview.content || '',
            selectedTags: pendingReview.selectedTags || [],
            visitDate: pendingReview.visitDate ? new Date(pendingReview.visitDate) : new Date(),
            recommendationRating: pendingReview.recommendationRating || 0
          });
          
          // 알림 표시
          setOfflineSaveAlert(true);
          setTimeout(() => setOfflineSaveAlert(false), 5000);
        } catch (err) {
          console.error('오프라인 저장 데이터 파싱 오류:', err);
        }
      }
    }
  }, [isOpen, placeId, existingReview]);

  // 폼 상태 변경 핸들러 - 객체 업데이트 방식으로 최적화
  const handleFormChange = useCallback((field, value) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 에러 상태 초기화
    if (field === 'content' && value.trim().length >= 10) {
      setErrors(prev => ({ ...prev, content: false }));
    }
    if (field === 'rating' && value > 0) {
      setErrors(prev => ({ ...prev, rating: false }));
    }
    
    // 에러 메시지 초기화
    if (error) {
      setError(null);
    }
  }, [error]);

  // 태그 토글 핸들러
  const handleTagToggle = useCallback((tag) => {
    setFormState(prev => {
      const newSelectedTags = prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : prev.selectedTags.length < 5 
          ? [...prev.selectedTags, tag]
          : prev.selectedTags;
          
      return {
        ...prev,
        selectedTags: newSelectedTags
      };
    });
  }, []);
  
  // 방문 날짜 선택 핸들러 수정 - 미래 날짜 제한
  const handleVisitDateChange = useCallback((dateString) => {
    const newDate = dateString ? new Date(dateString) : new Date();
    
    // 미래 날짜 제한
    const today = new Date();
    if (newDate > today) {
      newDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (newDate > today) {
        // 미래 날짜는 오늘로 설정
        newDate.setTime(today.getTime());
        // 선택적으로 사용자에게 알림
        setError("미래 날짜는 선택할 수 없습니다.");
        setTimeout(() => setError(null), 3000);
      }
    }
    
    handleFormChange('visitDate', newDate);
  }, [handleFormChange]);

  // 오프라인 상태에서 리뷰 저장
  const saveReviewOffline = useCallback(async (reviewData) => {
    try {
      console.log('오프라인 상태에서 리뷰 저장:', reviewData);
      
      // 로컬 스토리지에 리뷰 데이터 저장
      const offlineReviewData = {
        ...reviewData,
        placeId,
        placeName,
        timestamp: new Date().toISOString(),
        existingReviewId: existingReview?.id
      };
      
      localStorage.setItem(`pendingReview_${placeId}`, JSON.stringify(offlineReviewData));
      
      return { success: true, offline: true, data: offlineReviewData };
    } catch (err) {
      console.error('오프라인 리뷰 저장 오류:', err);
      return { success: false, error: '오프라인 저장에 실패했습니다.' };
    }
  }, [placeId, placeName, existingReview]);

  // 폼 제출 핸들러 개선
  const handleSubmit = useCallback(async () => {
    console.log("리뷰 제출 시작");
    console.log("네트워크 상태:", navigator.onLine ? "온라인" : "오프라인");
    
    // 유효성 검사 초기화
    const newErrors = {
      content: false,
      rating: false
    };
    let hasError = false;
    
    // 평점 검사
    if (rating <= 0 || rating > 5 || isNaN(rating)) {
      console.log("평점 오류:", rating);
      newErrors.rating = true;
      hasError = true;
    }

    // 내용 검사 (최소 10자)
    if (!content || content.trim().length < 10) {
      console.log("내용 오류:", content);
      newErrors.content = true;
      hasError = true;
    }
    
    // 에러가 있으면 상태 업데이트 후 중단
    if (hasError) {
      setErrors(newErrors);
      // 평점 오류 메시지 추가
      if (newErrors.rating) {
        setError("평점을 선택해주세요 (1-5)");
      } else if (newErrors.content) {
        setError("리뷰 내용은 최소 10자 이상 작성해주세요");
      }
      return;
    }
  
    // 사용자 정보 확인
    if (!userProfile) {
      setError("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
      return;
    }
  
    // 리뷰 데이터 구성
    const reviewData = {
      placeId,
      rating,
      content: content.trim(),
      selectedTags,
      visitDate: visitDate.toISOString(),
      recommendationRating,
    };
  
    console.log("리뷰 데이터:", reviewData);
    setLoading(true);
    
    try {
      let result;
      
      // 오프라인 상태 처리
      if (!navigator.onLine) {
        console.log("오프라인 상태에서 리뷰 제출");
        setIsSubmittingOffline(true);
        
        // 오프라인 저장 처리
        result = await saveReviewOffline(reviewData);
        
        if (result.success) {
          setSuccess(true);
          setOfflineSaveAlert(true);
          
          // 5초 후 모달 닫기
          setTimeout(() => {
            onClose();
            setSuccess(false);
            setIsSubmittingOffline(false);
            setOfflineSaveAlert(false);
          }, 5000);
        } else {
          setError(result.error || '오프라인 상태에서 리뷰 저장에 실패했습니다.');
          setIsSubmittingOffline(false);
        }
      } else {
        // 온라인 상태 - 제출 함수 호출 (부모 컴포넌트에서 제공)
        console.log("온라인 상태에서 리뷰 제출");
        result = await onSubmit(reviewData);
        console.log("리뷰 제출 결과:", result);
        
        if (result.success) {
          setSuccess(true);
          
          // 5초 후 모달 닫기
          setTimeout(() => {
            onClose();
            setSuccess(false);
          }, 5000);
        } else {
          setError(result.error || '리뷰 저장 중 오류가 발생했습니다.');
        }
      }
    } catch (err) {
      console.error('리뷰 제출 중 상세 오류:', err);
      
      // 네트워크 관련 오류 더 명확하게 처리
      if (!navigator.onLine || err.message?.includes('network') || err.name === 'NetworkError') {
        setError('네트워크 연결이 끊어졌습니다. 계속 진행하면 리뷰가 로컬에 저장됩니다.');
        
        // 자동으로 오프라인 저장 시도
        try {
          const offlineResult = await saveReviewOffline(reviewData);
          if (offlineResult.success) {
            setSuccess(true);
            setOfflineSaveAlert(true);
            
            // 5초 후 오프라인 알림 숨기기
            setTimeout(() => {
              setOfflineSaveAlert(false);
            }, 5000);
          } else {
            setError('리뷰를 로컬에 저장할 수 없습니다. 나중에 다시 시도해주세요.');
          }
        } catch (offlineErr) {
          setError('리뷰를 로컬에 저장할 수 없습니다. 나중에 다시 시도해주세요.');
        }
      } else {
        setError('리뷰 저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
      }
    } finally {
      setLoading(false);
    }
  }, [placeId, rating, content, selectedTags, visitDate, recommendationRating, userProfile, onSubmit, onClose, saveReviewOffline]);

  // 방문 날짜 문자열 변환 - useMemo로 메모이제이션
  const visitDateString = useMemo(() => {
    if (!visitDate) return '';
    return visitDate.toISOString().split('T')[0];
  }, [visitDate]);
  
  // 카테고리별 태그 렌더링 - 메모이제이션
  const renderTagsByCategory = useMemo(() => {
    return Object.entries(REVIEW_TAGS).map(([category, tags]) => (
      <Box key={category} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {CATEGORY_NAMES[category]}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              onClick={() => !loading && handleTagToggle(tag)}
              color={selectedTags.includes(tag) ? "primary" : "default"}
              variant={selectedTags.includes(tag) ? "filled" : "outlined"}
              disabled={loading}
              sx={{
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 1
                }
              }}
            />
          ))}
        </Box>
      </Box>
    ));
  }, [selectedTags, loading, handleTagToggle]);

  // 태그 선택 개수 텍스트 - 메모이제이션
  const tagsCountText = useMemo(() => {
    const count = selectedTags.length;
    if (count === 0) return "태그를 선택해주세요 (최대 5개)";
    return `${count}개 선택됨 (최대 5개)`;
  }, [selectedTags.length]);

  // 오프라인 배너 표시 조건 - 메모이제이션
  const showOfflineBanner = useMemo(() => {
    return !isOnline || isSubmittingOffline;
  }, [isOnline, isSubmittingOffline]);

  return (
    <Dialog 
      open={isOpen} 
      onClose={loading ? null : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ 
        sx: { 
          borderRadius: 2,
          overflow: 'hidden'
        } 
      }}
      // 모바일에서는 전체 화면으로
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white',
        p: isMobile ? 2 : 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6">
            {existingReview ? '리뷰 수정' : '리뷰 작성'}
          </Typography>
          {!isOnline && (
            <Chip 
              icon={<WifiOffIcon />}
              label="오프라인 모드" 
              size="small" 
              color="warning"
              sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)' }}
            />
          )}
        </Box>
        {!loading && (
          <IconButton 
            onClick={onClose} 
            color="inherit" 
            sx={{ minWidth: 'auto', p: 0.5 }}
            aria-label="닫기"
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3, px: isMobile ? 2 : 3 }}>
        {/* 오프라인 상태 알림 */}
        {showOfflineBanner && (
          <Alert 
            severity="warning" 
            icon={<WifiOffIcon />}
            sx={{ mb: 2, borderRadius: 1.5 }}
          >
            {isSubmittingOffline 
              ? "오프라인 상태입니다. 리뷰가 기기에 저장되며, 네트워크 연결 시 자동으로 업로드됩니다."
              : "오프라인 상태입니다. 계속 진행하면 리뷰가 기기에 저장되며, 네트워크 연결 시 자동으로 업로드됩니다."}
          </Alert>
        )}
        
        {/* 오프라인 저장 성공 알림 */}
        {offlineSaveAlert && (
          <Alert 
            severity="info" 
            sx={{ mb: 2, borderRadius: 1.5 }}
            onClose={() => setOfflineSaveAlert(false)}
          >
            리뷰가 기기에 저장되었습니다. 네트워크 연결이 복구되면 자동으로 업로드됩니다.
          </Alert>
        )}
        
        {/* 동기화 성공 알림 */}
        {syncSuccessAlert && (
          <Alert 
            severity="success" 
            sx={{ mb: 2, borderRadius: 1.5 }}
            onClose={() => setSyncSuccessAlert(false)}
          >
            오프라인에서 저장했던 리뷰가 성공적으로 동기화되었습니다.
          </Alert>
        )}
        
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2, borderRadius: 1.5 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }}>
            {isOnline 
              ? "리뷰가 성공적으로 저장되었습니다!"
              : "리뷰가 로컬에 저장되었습니다. 네트워크 연결 시 자동으로 업로드됩니다."}
          </Alert>
        )}
        
        <Typography variant="h6" gutterBottom>
          {placeName}
        </Typography>

        {/* 평점 입력 */}
        <FormControl 
          fullWidth 
          error={errors.rating} 
          component="fieldset" 
          sx={{ mb: 3 }}
        >
          <FormLabel component="legend">평점</FormLabel>
          <Rating
            name="rating"
            value={rating}
            onChange={(event, newValue) => handleFormChange('rating', newValue)}
            precision={0.5}
            size="large"
            disabled={loading}
            sx={{
              fontSize: '2rem',
              '& .MuiRating-iconFilled': {
                color: theme.palette.primary.main,
              },
              '& .MuiRating-iconHover': {
                color: theme.palette.primary.light,
              }
            }}
            emptyIcon={<FavoriteIcon style={{ opacity: 0.4 }} fontSize="inherit" />}
            icon={<FavoriteIcon fontSize="inherit" />}
          />
          {errors.rating && (
            <FormHelperText error>평점을 선택해주세요</FormHelperText>
          )}
        </FormControl>
        
        {/* 방문 날짜 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">방문 날짜</FormLabel>
          <TextField
            fullWidth
            type="date"
            value={visitDateString}
            onChange={(e) => handleVisitDateChange(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            // 오늘 날짜를 최대값으로 설정
            inputProps={{ max: new Date().toISOString().split('T')[0] }}
            disabled={loading}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5
              }
            }}
          />
        </Box>

        {/* 리뷰 내용 */}
        <FormControl 
          fullWidth 
          error={errors.content} 
          sx={{ mb: 3 }}
        >
          <FormLabel component="legend">리뷰 내용</FormLabel>
          <TextField
            multiline
            rows={isMobile ? 3 : 5}
            value={content}
            onChange={(e) => handleFormChange('content', e.target.value)}
            placeholder="이 장소에 대한 경험을 자세히 들려주세요. 어떤 점이 좋았나요? 아쉬운 점은 무엇인가요? (최소 10자 이상)"
            disabled={loading}
            error={errors.content}
            helperText={errors.content ? "리뷰 내용은 최소 10자 이상 작성해주세요" : `${content.length}자 / 최소 10자`}
            fullWidth
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5
              }
            }}
          />
        </FormControl>
        
        {/* 태그 선택 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ mb: 1 }}>
            태그 선택
          </FormLabel>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {tagsCountText}
          </Typography>
          
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
            {renderTagsByCategory}
          </Paper>
        </Box>

        {/* 추천 점수 - AI 추천이 얼마나 적절했는지 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">AI 추천은 어땠나요?</FormLabel>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 0.5, mb: 1 }}>
            이 장소가 당신의 MBTI, 관심사, 취향에 얼마나 적합했나요?
          </Typography>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              p: 2,
              borderRadius: 1.5,
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.100'
            }}
          >
            <EmojiEmotionsIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Rating
              name="recommendation-rating"
              value={recommendationRating}
              onChange={(event, newValue) => handleFormChange('recommendationRating', newValue)}
              disabled={loading}
              size="large"
            />
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, flexDirection: isMobile ? 'column' : 'row' }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          variant="outlined"
          fullWidth={isMobile}
          sx={{ 
            borderRadius: 1.5,
            mb: isMobile ? 1 : 0,
            mr: isMobile ? 0 : 1,
            px: 3
          }}
        >
          취소
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          disabled={loading}
          fullWidth={isMobile}
          sx={{ 
            borderRadius: 1.5,
            px: 3,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4
            }
          }}
        >
          {loading ? (isSubmittingOffline ? '오프라인 저장 중...' : '저장 중...') : (existingReview ? '수정하기' : '등록하기')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// React.memo를 사용하여 컴포넌트 메모이제이션 
export default React.memo(ReviewForm);
