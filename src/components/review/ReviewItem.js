/**
 * src/components/review/ReviewItem.js
 * 개별 리뷰 아이템 컴포넌트
 */

import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Rating, 
  Chip, 
  Avatar, 
  IconButton,
  Menu,
  MenuItem,
  Grid,
  CardMedia,
  Paper
} from '@mui/material';
import { 
  ThumbUp as ThumbUpIcon,
  ThumbUpOutlined as ThumbUpOutlinedIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Report as ReportIcon,
  Person as PersonIcon
} from '@mui/icons-material';

// MBTI 유형별 색상
const mbtiColors = {
  'ENFJ': '#4E79A7', 'ENFP': '#F28E2B', 'ENTJ': '#E15759', 'ENTP': '#76B7B2',
  'ESFJ': '#59A14F', 'ESFP': '#EDC948', 'ESTJ': '#B07AA1', 'ESTP': '#FF9DA7',
  'INFJ': '#9C755F', 'INFP': '#BAB0AC', 'INTJ': '#8CD17D', 'INTP': '#D4A6C8',
  'ISFJ': '#86BCB6', 'ISFP': '#F1CE63', 'ISTJ': '#D37295', 'ISTP': '#A0CBE8'
};

/**
 * 리뷰 아이템 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {Object} props.review - 리뷰 데이터
 * @param {boolean} props.isMine - 내 리뷰인지 여부
 * @param {function} props.onEdit - 리뷰 수정 핸들러 (선택적)
 * @param {function} props.onDelete - 리뷰 삭제 핸들러 (선택적)
 * @param {function} props.onReport - 리뷰 신고 핸들러 (선택적)
 * @param {function} props.onLike - 좋아요 핸들러 (선택적)
 */
const ReviewItem = ({ 
  review, 
  isMine = false, 
  onEdit, 
  onDelete, 
  onReport,
  onLike 
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [liked, setLiked] = useState(false);
  
  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleEdit = () => {
    handleMenuClose();
    if (onEdit) onEdit(review);
  };
  
  const handleDelete = () => {
    handleMenuClose();
    if (onDelete) onDelete(review.id);
  };
  
  const handleReport = () => {
    handleMenuClose();
    if (onReport) onReport(review.id);
  };
  
  const handleLike = () => {
    setLiked(!liked);
    if (onLike) onLike(review.id, !liked);
  };
  
  // 날짜 형식 변환
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    } catch (e) {
      return dateStr;
    }
  };
  
  return (
    <Paper
      elevation={0}
      variant={isMine ? "outlined" : "elevation"}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: isMine ? 'primary.50' : 'background.paper',
        border: isMine ? '1px solid' : 'none',
        borderColor: isMine ? 'primary.200' : 'transparent',
      }}
    >
      {/* 리뷰 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            sx={{
              bgcolor: review.userMbti ? mbtiColors[review.userMbti] || 'primary.main' : 'primary.main',
              width: 40,
              height: 40,
              mr: 1
            }}
          >
            {review.userName?.[0] || <PersonIcon />}
          </Avatar>
          
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {review.userName || '익명'}
              </Typography>
              {isMine && (
                <Chip
                  label="내 리뷰"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {review.userMbti && (
                <Chip
                  label={review.userMbti}
                  size="small"
                  sx={{
                    mr: 1,
                    bgcolor: mbtiColors[review.userMbti] || 'primary.main',
                    color: 'white',
                    height: 20,
                    fontSize: '0.7rem'
                  }}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDate(review.createdAt)}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Rating value={review.rating} precision={0.5} readOnly size="small" />
          
          <IconButton 
            aria-label="리뷰 메뉴" 
            size="small" 
            onClick={handleMenuClick}
            sx={{ ml: 0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            {isMine ? (
              <>
                <MenuItem onClick={handleEdit} dense>
                  <EditIcon fontSize="small" sx={{ mr: 1 }} />
                  수정하기
                </MenuItem>
                <MenuItem onClick={handleDelete} dense>
                  <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                  삭제하기
                </MenuItem>
              </>
            ) : (
              <MenuItem onClick={handleReport} dense>
                <ReportIcon fontSize="small" sx={{ mr: 1 }} />
                신고하기
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Box>
      
      {/* 리뷰 내용 */}
      <Typography variant="body1" sx={{ my: 1, whiteSpace: 'pre-line' }}>
        {review.content}
      </Typography>
      
      {/* 리뷰 이미지 (있는 경우) */}
      {review.photos && review.photos.length > 0 && (
        <Grid container spacing={1} sx={{ mt: 1, mb: 2 }}>
          {review.photos.map((photo, index) => (
            <Grid item key={index} xs={4} sm={3} md={2}>
              <CardMedia
                component="img"
                image={photo}
                alt={`리뷰 이미지 ${index + 1}`}
                sx={{ 
                  height: 80, 
                  borderRadius: 1,
                  objectFit: 'cover'
                }}
              />
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* 태그 및 좋아요 */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center',
        justifyContent: 'space-between',
        mt: 2
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {review.tags && review.tags.map((tag) => (
            <Chip 
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{ height: 24 }}
            />
          ))}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            aria-label="좋아요" 
            size="small"
            onClick={handleLike}
            color={liked ? "primary" : "default"}
          >
            {liked ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {liked ? review.likeCount + 1 : review.likeCount || 0}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default ReviewItem;
