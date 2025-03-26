import React from 'react';
import { Box, Typography, Rating, Tooltip } from '@mui/material';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import styled from '@emotion/styled';

// 스타일링된 아이콘 컴포넌트
const StyledRating = styled(Rating)({
  '& .MuiRating-iconFilled': {
    color: '#2E7D32', // 채워진 아이콘 색상 (초록색)
  },
  '& .MuiRating-iconHover': {
    color: '#43A047', // 호버 시 아이콘 색상
  },
});

/**
 * 추천 적합도 평가 컴포넌트
 * 1-5 점으로 추천이 사용자에게 얼마나 적합했는지 평가
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {number} props.value - 현재 평가 값 (1-5)
 * @param {function} props.onChange - 값 변경 시 호출할 함수
 * @param {boolean} props.readOnly - 읽기 전용 모드 여부
 * @param {string} props.size - 아이콘 크기 (small, medium, large)
 * @param {string} props.title - 평가 제목 텍스트 (선택적)
 */
const RelevanceRating = ({ 
  value, 
  onChange, 
  readOnly = false, 
  size = 'medium',
  title = '이 추천이 얼마나 적합했나요?' 
}) => {

 // 평가 레이블 (툴팁으로 표시)
 const labels = {
  1: '전혀 맞지 않아요',
  2: '별로 맞지 않아요',
  3: '보통이에요',
  4: '잘 맞아요',
  5: '매우 잘 맞아요',
};

// 현재 레이블 가져오기
const getLabelText = (value) => {
  return labels[value] || '';
};

// 평가 값 변경 핸들러
const handleChange = (event, newValue) => {
  if (onChange) {
    onChange(newValue);
  }
};

return (
  <Box sx={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    my: 2 
  }}>
    {title && (
      <Typography 
        variant="subtitle1" 
        color="text.secondary" 
        gutterBottom
        sx={{ fontWeight: 500 }}
      >
        {title}
      </Typography>
    )}
    
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center' 
    }}>
      <Tooltip title={getLabelText(value) || ''} placement="top">
        <StyledRating
          name="relevance-rating"
          value={value}
          onChange={handleChange}
          getLabelText={getLabelText}
          precision={1}
          icon={<ThumbUpAltIcon fontSize="inherit" />}
          emptyIcon={<ThumbUpOffAltIcon fontSize="inherit" />}
          readOnly={readOnly}
          size={size}
          max={5}
        />
      </Tooltip>
      
      {value > 0 && (
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ ml: 1 }}
        >
          {getLabelText(value)}
        </Typography>
      )}
    </Box>
  </Box>
);
};

export default RelevanceRating;
