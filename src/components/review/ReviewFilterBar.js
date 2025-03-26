// src/components/review/ReviewFilterBar.js
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  FormControl, 
  MenuItem, 
  Select, 
  InputLabel,
  Rating, 
  Button,
  Drawer,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  useMediaQuery
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Close as CloseIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// MBTI 소분류 - 컴포넌트 외부로 이동하여 재렌더링 방지
const MBTI_CATEGORIES = {
  'analysts': ['INTJ', 'INTP', 'ENTJ', 'ENTP'],
  'diplomats': ['INFJ', 'INFP', 'ENFJ', 'ENFP'],
  'sentinels': ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'],
  'explorers': ['ISTP', 'ISFP', 'ESTP', 'ESFP']
};

// MBTI 분류 한글명 - 컴포넌트 외부로 이동
const MBTI_CATEGORY_NAMES = {
  'analysts': '분석가형',
  'diplomats': '외교관형',
  'sentinels': '관리자형',
  'explorers': '탐험가형'
};

// 리뷰 필터 바 컴포넌트
const ReviewFilterBar = ({ filters, onFilterChange, onResetFilters }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 모바일 필터 드로어 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // 현재 적용된 필터 개수 - useMemo로 메모이제이션
  const activeFilterCount = useMemo(() => {
    return [
      filters.mbti, 
      filters.rating > 0, 
      filters.hasRecommendation
    ].filter(Boolean).length;
  }, [filters.mbti, filters.rating, filters.hasRecommendation]);
  
  // MBTI 필터 변경 핸들러 - useCallback으로 메모이제이션
  const handleMbtiChange = useCallback((event) => {
    onFilterChange({ mbti: event.target.value });
  }, [onFilterChange]);
  
  // 평점 필터 변경 핸들러 - useCallback으로 메모이제이션
  const handleRatingChange = useCallback((event, newValue) => {
    onFilterChange({ rating: newValue });
  }, [onFilterChange]);
  
  // AI 추천 평가 필터 변경 핸들러 - useCallback으로 메모이제이션
  const handleRecommendationChange = useCallback((event) => {
    onFilterChange({ hasRecommendation: event.target.checked });
  }, [onFilterChange]);
  
  // 드로어 열기 - useCallback으로 메모이제이션
  const handleOpenDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);
  
  // 드로어 닫기 - useCallback으로 메모이제이션
  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);
  
  // MBTI 메뉴 아이템 - useMemo로 메모이제이션
  const mbtiMenuItems = useMemo(() => {
    return (
      <>
        <MenuItem value="">전체</MenuItem>
        <Divider />
        
        {/* MBTI 그룹별 메뉴 아이템 */}
        {Object.entries(MBTI_CATEGORIES).map(([category, types]) => (
          <React.Fragment key={category}>
            <Typography 
              variant="caption" 
              sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}
            >
              {MBTI_CATEGORY_NAMES[category]}
            </Typography>
            {types.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
            {category !== 'explorers' && <Divider />}
          </React.Fragment>
        ))}
      </>
    );
  }, []);
  
  // 데스크톱 필터 바 - useMemo로 메모이제이션
  const filterBar = useMemo(() => (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center',
        gap: 2
      }}
    >
      {/* MBTI 필터 */}
      <FormControl size="small" sx={{ minWidth: 120, flexGrow: { xs: 1, md: 0 } }}>
        <InputLabel id="mbti-filter-label">MBTI</InputLabel>
        <Select
          labelId="mbti-filter-label"
          value={filters.mbti}
          label="MBTI"
          onChange={handleMbtiChange}
        >
          {mbtiMenuItems}
        </Select>
      </FormControl>
      
      {/* 평점 필터 */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
        <Typography variant="body2" sx={{ mr: 1, minWidth: 80 }}>
          최소 평점:
        </Typography>
        <Rating
          value={filters.rating}
          onChange={handleRatingChange}
          precision={0.5}
          size="medium"
        />
      </Box>
      
      {/* AI 추천 평가 필터 */}
      <FormControlLabel
        control={
          <Switch 
            checked={filters.hasRecommendation}
            onChange={handleRecommendationChange}
            color="primary"
          />
        }
        label="AI 추천 평가 있는 리뷰만"
        sx={{ ml: 0 }}
      />
      
      {/* 필터 초기화 버튼 */}
      {activeFilterCount > 0 && (
        <Button 
          startIcon={<RestartAltIcon />}
          onClick={onResetFilters}
          size="small"
          sx={{ ml: 'auto' }}
        >
          초기화
        </Button>
      )}
    </Paper>
  ), [filters, activeFilterCount, handleMbtiChange, handleRatingChange, handleRecommendationChange, onResetFilters, mbtiMenuItems]);
  
  // 모바일 필터 버튼 - useMemo로 메모이제이션
  const mobileFilterButton = useMemo(() => (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        {filters.mbti && (
          <Chip 
            label={`MBTI: ${filters.mbti}`} 
            onDelete={() => onFilterChange({ mbti: '' })}
            size="small"
          />
        )}
        
        {filters.rating > 0 && (
          <Chip 
            label={`${filters.rating}점 이상`} 
            onDelete={() => onFilterChange({ rating: 0 })}
            size="small"
          />
        )}
        
        {filters.hasRecommendation && (
          <Chip 
            label="AI 추천 평가"
            onDelete={() => onFilterChange({ hasRecommendation: false })}
            size="small"
          />
        )}
      </Box>
      
      <Button 
        startIcon={<FilterListIcon />}
        variant="outlined"
        onClick={handleOpenDrawer}
        endIcon={activeFilterCount > 0 ? <Chip label={activeFilterCount} size="small" /> : null}
      >
        필터
      </Button>
    </Box>
  ), [filters, activeFilterCount, handleOpenDrawer, onFilterChange]);
  
  // 모바일 필터 드로어 내용 - useMemo로 메모이제이션
  const drawerContent = useMemo(() => (
    <Box sx={{ width: 300, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">리뷰 필터링</Typography>
        <IconButton onClick={handleCloseDrawer}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      {/* MBTI 필터 */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="mbti-filter-mobile-label">MBTI 유형</InputLabel>
        <Select
          labelId="mbti-filter-mobile-label"
          value={filters.mbti}
          label="MBTI 유형"
          onChange={handleMbtiChange}
        >
          {mbtiMenuItems}
        </Select>
      </FormControl>
      
      {/* 평점 필터 */}
      <Typography variant="subtitle1" gutterBottom>
        최소 평점
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Rating
          value={filters.rating}
          onChange={handleRatingChange}
          precision={0.5}
          size="large"
        />
        <Typography variant="body2" sx={{ ml: 1 }}>
          {filters.rating > 0 ? `${filters.rating}점 이상` : '전체'}
        </Typography>
      </Box>
      
      {/* AI 추천 평가 필터 */}
      <FormControlLabel
        control={
          <Switch 
            checked={filters.hasRecommendation}
            onChange={handleRecommendationChange}
            color="primary"
          />
        }
        label="AI 추천 평가 있는 리뷰만"
      />
      
      <Divider sx={{ my: 3 }} />
      
      {/* 버튼 그룹 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          onClick={onResetFilters}
          startIcon={<RestartAltIcon />}
        >
          초기화
        </Button>
        
        <Button
          variant="contained"
          onClick={handleCloseDrawer}
        >
          적용하기
        </Button>
      </Box>
    </Box>
  ), [filters, handleMbtiChange, handleRatingChange, handleRecommendationChange, handleCloseDrawer, onResetFilters, mbtiMenuItems]);
  
  return (
    <>
      {isMobile ? mobileFilterButton : filterBar}
      
      {/* 모바일 필터 드로어 */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

// React.memo를 사용하여 컴포넌트 메모이제이션
export default React.memo(ReviewFilterBar, (prevProps, nextProps) => {
  // 최적화를 위한 커스텀 비교 함수
  // filters 객체의 각 속성이 동일하면 리렌더링 방지
  return (
    prevProps.filters.mbti === nextProps.filters.mbti &&
    prevProps.filters.rating === nextProps.filters.rating &&
    prevProps.filters.hasRecommendation === nextProps.filters.hasRecommendation
  );
});
