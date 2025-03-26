// src/components/recommendation/FeedbackButton.js
import React, { useState, useEffect } from 'react';
import {
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  Box,
  Typography,
  TextField,
  Tooltip
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Feedback as FeedbackIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useUser } from '../../contexts/UserContext';

/**
 * 추천 피드백 버튼 컴포넌트
 * @param {Object} props
 * @param {string} props.placeId - 장소 ID
 * @param {string} props.variant - 버튼 스타일 ('icon', 'text', 'simple')
 * @param {function} props.onFeedbackSubmit - 피드백 제출 후 콜백 함수
 */
const FeedbackButton = ({ placeId, variant = 'icon', onFeedbackSubmit = null }) => {
  const { feedbacks, addFeedback } = useUser();
  const [showDialog, setShowDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // 기존 피드백이 있는지 확인
  useEffect(() => {
    if (feedbacks && feedbacks.length > 0) {
      const feedback = feedbacks.find(f => f.placeId === placeId);
      if (feedback) {
        setExistingFeedback(feedback);
        setRating(feedback.rating);
        setComment(feedback.comment || '');
      }
    }
  }, [feedbacks, placeId]);

  // 다이얼로그 열기
  const handleOpenDialog = () => {
    setShowDialog(true);
  };

  // 다이얼로그 닫기
  const handleCloseDialog = () => {
    setShowDialog(false);
    
    // 취소 시 원래 값으로 복원
    if (existingFeedback) {
      setRating(existingFeedback.rating);
      setComment(existingFeedback.comment || '');
    } else {
      setRating(0);
      setComment('');
    }
  };

  // 간단한 피드백 제출 (좋아요/싫어요)
  const handleSimpleFeedback = async (value) => {
    const ratingValue = value === 'like' ? 5 : 1;
    const result = await addFeedback(placeId, ratingValue);
    
    if (result.success) {
      setExistingFeedback(result.data);
      setJustSubmitted(true);
      
      // 3초 후 표시 효과 제거
      setTimeout(() => {
        setJustSubmitted(false);
      }, 3000);
      
      // 콜백 함수 있으면 호출
      if (onFeedbackSubmit) {
        onFeedbackSubmit(result.data);
      }
    }
  };

  // 상세 피드백 제출
  const handleSubmitFeedback = async () => {
    if (rating === 0) return; // 평점 필수
    
    const result = await addFeedback(placeId, rating, comment);
    
    if (result.success) {
      setExistingFeedback(result.data);
      setShowDialog(false);
      setJustSubmitted(true);
      
      // 3초 후 표시 효과 제거
      setTimeout(() => {
        setJustSubmitted(false);
      }, 3000);
      
      // 콜백 함수 있으면 호출
      if (onFeedbackSubmit) {
        onFeedbackSubmit(result.data);
      }
    }
  };

  // 'simple' 형태 렌더링 (좋아요/싫어요 버튼)
  if (variant === 'simple') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {existingFeedback ? (
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
            <CheckIcon fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">피드백 제출됨</Typography>
          </Box>
        ) : (
          <>
            <Tooltip title="도움됨">
              <IconButton 
                color={justSubmitted && rating === 5 ? "success" : "default"}
                onClick={() => handleSimpleFeedback('like')}
                size="small"
              >
                <ThumbUpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="도움안됨">
              <IconButton 
                color={justSubmitted && rating === 1 ? "error" : "default"}
                onClick={() => handleSimpleFeedback('dislike')}
                size="small"
              >
                <ThumbDownIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    );
  }

  // 'text' 형태 렌더링 (텍스트 버튼)
  if (variant === 'text') {
    return (
      <>
        <Button
          startIcon={existingFeedback ? <CheckIcon /> : <FeedbackIcon />}
          variant="outlined"
          color={existingFeedback ? "success" : "primary"}
          size="small"
          onClick={handleOpenDialog}
          sx={{ mt: 1 }}
        >
          {existingFeedback ? "피드백 수정" : "피드백 남기기"}
        </Button>
        
        {/* 피드백 다이얼로그 */}
        <Dialog open={showDialog} onClose={handleCloseDialog}>
          <DialogTitle>이 추천에 대한 피드백</DialogTitle>
          <DialogContent>
            <Box sx={{ my: 2 }}>
              <Typography component="legend">이 추천이 얼마나 도움이 되었나요?</Typography>
              <Rating
                name="feedback-rating"
                value={rating}
                onChange={(event, newValue) => {
                  setRating(newValue);
                }}
                size="large"
              />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="추가 의견 (선택사항)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>취소</Button>
            <Button 
              onClick={handleSubmitFeedback}
              variant="contained"
              disabled={rating === 0}
            >
              제출
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // 기본 'icon' 형태 렌더링 (아이콘 버튼)
  return (
    <>
      <Tooltip title={existingFeedback ? "피드백 수정" : "피드백 남기기"}>
        <IconButton
          color={existingFeedback ? "success" : "default"}
          onClick={handleOpenDialog}
          size="small"
        >
          {existingFeedback ? <CheckIcon /> : <FeedbackIcon />}
        </IconButton>
      </Tooltip>
      
      {/* 피드백 다이얼로그 */}
      <Dialog open={showDialog} onClose={handleCloseDialog}>
        <DialogTitle>이 추천에 대한 피드백</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography component="legend">이 추천이 얼마나 도움이 되었나요?</Typography>
            <Rating
              name="feedback-rating"
              value={rating}
              onChange={(event, newValue) => {
                setRating(newValue);
              }}
              size="large"
            />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="추가 의견 (선택사항)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button 
            onClick={handleSubmitFeedback}
            variant="contained"
            disabled={rating === 0}
          >
            제출
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FeedbackButton;
