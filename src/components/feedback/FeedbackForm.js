import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import EditIcon from '@mui/icons-material/Edit';
import RelevanceRating from './RelevanceRating';
import { useFeedback } from '../../contexts/FeedbackContext';
import { getUserFeedbackForPlace } from '../../services/feedbackService';
import { useUser } from '../../contexts/UserContext';

/**
 * 장소에 대한 피드백 입력 폼 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.placeId - 피드백을 남길 장소 ID
 * @param {string} props.placeName - 장소 이름
 * @param {function} props.onFeedbackSubmitted - 피드백 제출 후 콜백 함수
 */
const FeedbackForm = ({ placeId, placeName, onFeedbackSubmitted }) => {

  const { currentUser } = useUser();
  const { feedbackStatus, submitFeedback, updateUserFeedback, resetFeedbackStatus } = useFeedback();
  const [relevanceRating, setRelevanceRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [previousFeedback, setPreviousFeedback] = useState(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 사전 정의된 태그 목록을 useMemo로 래핑하여 재렌더링 방지
  const availableTags = useMemo(() => [
    { id: 'accurate_mbti', label: 'MBTI 성향에 맞음' },
    { id: 'accurate_interests', label: '관심사에 맞음' },
    { id: 'accurate_talents', label: '재능 활용 가능' },
    { id: 'accurate_mood', label: '감정 상태에 적합' },
    { id: 'inaccurate_recommendation', label: '추천이 맞지 않음' },
    { id: 'good_atmosphere', label: '분위기가 좋음' },
    { id: 'good_value', label: '가격 대비 만족' },
    { id: 'too_crowded', label: '너무 혼잡함' },
    { id: 'would_visit_again', label: '다시 방문하고 싶음' },
    { id: 'not_as_expected', label: '기대와 달랐음' }
  ], []);
  
  // 이전에 남긴 피드백 로드
  useEffect(() => {
    const loadPreviousFeedback = async () => {
      if (!currentUser || !currentUser.uid || !placeId) return;
      
      setLoadingPrevious(true);
      try {
        const feedback = await getUserFeedbackForPlace(placeId, currentUser.uid);
        if (feedback) {
          setPreviousFeedback(feedback);
          
          // 편집 모드가 아닐 때만 이전 피드백으로 폼 초기화
          if (!isEditing) {
            // 이전 피드백의 태그를 ID로 변환하여 설정
            const tagIds = feedback.tags ? feedback.tags.map(tagLabel => {
              const tag = availableTags.find(t => t.label === tagLabel);
              return tag ? tag.id : tagLabel;
            }) : [];
            
            setSelectedTags(tagIds);
          }
        }
      } catch (error) {
        console.error('이전 피드백 로드 오류:', error);
      } finally {
        setLoadingPrevious(false);
      }
    };

    loadPreviousFeedback();
  }, [currentUser, placeId, isEditing, availableTags]);

  // 피드백 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (relevanceRating === 0) {
      alert('추천 적합도를 선택해주세요');
      return;
    }

    const tagLabels = selectedTags.map(tagId => {
      const tag = availableTags.find(t => t.id === tagId);
      return tag ? tag.label : tagId;
    });

    const feedbackData = {
      relevanceRating,
      comment,
      tags: tagLabels
    };

    let success;
    
    if (isEditing && previousFeedback && previousFeedback.id) {
      // 피드백 수정
      success = await updateUserFeedback(placeId, previousFeedback.id, feedbackData);
    } else {
      // 새로운 피드백 제출
      success = await submitFeedback(placeId, feedbackData);
    }
    
    if (success && onFeedbackSubmitted) {
      // 상위 컴포넌트에 알림
      onFeedbackSubmitted();
      
      // 폼 초기화
      if (!isEditing) {
        setRelevanceRating(0);
        setComment('');
        setSelectedTags([]);
      }
      
      // 편집 모드 종료
      setIsEditing(false);
    }
  };

  // 태그 토글 핸들러
  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // 편집 모드 시작
  const handleStartEditing = () => {
    if (previousFeedback) {
      setRelevanceRating(previousFeedback.relevanceRating || 0);
      setComment(previousFeedback.comment || '');
      
      // 이전 피드백의 태그를 ID로 변환하여 설정
      const tagIds = previousFeedback.tags ? previousFeedback.tags.map(tagLabel => {
        const tag = availableTags.find(t => t.label === tagLabel);
        return tag ? tag.id : tagLabel;
      }) : [];
      
      setSelectedTags(tagIds);
      setIsEditing(true);
    }
  };

  // 편집 취소
  const handleCancelEditing = () => {
    setIsEditing(false);
    setRelevanceRating(0);
    setComment('');
    setSelectedTags([]);
  };

  // 이전 피드백이 있을 경우 표시
  if (loadingPrevious) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // 이전 피드백이 있고 편집 모드가 아닌 경우 표시
  if (previousFeedback && !isEditing) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ThumbUpIcon color="success" sx={{ mr: 1 }} />
            <Typography variant="h6">이미 피드백을 남겼어요</Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleStartEditing}
          >
            수정하기
          </Button>
        </Box>
        
        <RelevanceRating 
          value={previousFeedback.relevanceRating} 
          readOnly={true} 
        />
        
        {previousFeedback.comment && (
          <Typography variant="body1" sx={{ my: 1 }}>
            &quot;{previousFeedback.comment}&quot;
          </Typography>
        )}
        
        {previousFeedback.tags && previousFeedback.tags.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {previousFeedback.tags.map((tag, index) => (
              <Chip 
                key={index} 
                label={tag} 
                variant="outlined" 
                color="primary" 
                size="small" 
                sx={{ mr: 1, mb: 1 }} 
              />
            ))}
          </Box>
        )}
      </Paper>
    );
  }

  // 새 피드백 작성 또는 편집 모드인 경우 폼 표시
  return (
    <Paper 
      component="form" 
      onSubmit={handleSubmit} 
      elevation={2} 
      sx={{ p: 3, mb: 3 }}
    >
      <Typography variant="h6" component="h3" gutterBottom>
        {isEditing ? `${placeName} 피드백 수정` : `${placeName}에 대한 피드백`}
      </Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* 알림 메시지 */}
      <Collapse in={!!feedbackStatus.error || feedbackStatus.success}>
        {feedbackStatus.error && (
          <Alert 
            severity="error"
            action={
              <IconButton
                size="small"
                onClick={resetFeedbackStatus}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ mb: 2 }}
          >
            {feedbackStatus.error}
          </Alert>
        )}
        
        {feedbackStatus.success && (
          <Alert 
            severity="success"
            action={
              <IconButton
                size="small"
                onClick={resetFeedbackStatus}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ mb: 2 }}
          >
            {isEditing ? '피드백이 성공적으로 수정되었습니다!' : '피드백이 성공적으로 저장되었습니다!'}
          </Alert>
        )}
      </Collapse>
      
      {/* 적합도 평가 */}
      <RelevanceRating 
        value={relevanceRating} 
        onChange={setRelevanceRating} 
      />
      
      {/* 태그 선택 */}
      <Box sx={{ my: 2 }}>
        <Typography 
          variant="subtitle2" 
          color="text.secondary" 
          gutterBottom
        >
          이 장소에 대한 태그 선택 (선택사항)
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {availableTags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.label}
              onClick={() => handleTagToggle(tag.id)}
              color={selectedTags.includes(tag.id) ? "primary" : "default"}
              variant={selectedTags.includes(tag.id) ? "filled" : "outlined"}
              sx={{ mb: 1 }}
            />
          ))}
        </Box>
      </Box>
      
      {/* 코멘트 입력 */}
      <TextField
        fullWidth
        label="추가 의견 (선택사항)"
        multiline
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        variant="outlined"
        margin="normal"
      />
      
      {/* 제출 버튼 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
        {isEditing && (
          <Button
            type="button"
            variant="outlined"
            onClick={handleCancelEditing}
          >
            취소
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={feedbackStatus.loading || relevanceRating === 0}
          endIcon={feedbackStatus.loading ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {isEditing ? '피드백 수정' : '피드백 보내기'}
        </Button>
      </Box>
    </Paper>
  );
};

export default FeedbackForm;
