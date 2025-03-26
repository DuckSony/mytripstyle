// src/components/search/SearchFilters.js
import React from 'react';
import { Box, Chip, FormControl, InputLabel, MenuItem, Select, Slider, Typography } from '@mui/material';
import { useUser } from '../../contexts/UserContext';

const SearchFilters = ({ activeFilters, onFilterChange }) => {
  const { userProfile } = useUser();
  
  // 카테고리 옵션
  const categories = [
    { value: 'cafe', label: '카페' },
    { value: 'restaurant', label: '음식점' },
    { value: 'culture', label: '문화/예술' },
    { value: 'nature', label: '자연/야외' },
    { value: 'activity', label: '활동/체험' },
    { value: 'healing', label: '휴식/힐링' }
  ];
  
  // 평점 변경 핸들러
  const handleRatingChange = (event, newValue) => {
    onFilterChange('rating', newValue);
  };
  
  // 카테고리 변경 핸들러
  const handleCategoryChange = (event) => {
    onFilterChange('category', event.target.value);
  };
  
  // 필터 칩 삭제 핸들러
  const handleDeleteFilter = (filterType) => {
    switch (filterType) {
      case 'category':
        onFilterChange('category', []);
        break;
      case 'rating':
        onFilterChange('rating', null);
        break;
      default:
        break;
    }
  };
  
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mr: 1 }}>
          활성 필터:
        </Typography>
        
        {activeFilters.category && activeFilters.category.length > 0 && (
          <Chip 
            label={`카테고리: ${categories.find(c => c.value === activeFilters.category[0])?.label || activeFilters.category[0]}`}
            onDelete={() => handleDeleteFilter('category')}
            variant="outlined"
            color="primary"
            size="small"
          />
        )}
        
        {activeFilters.rating && (
          <Chip 
            label={`최소 평점: ${activeFilters.rating}`}
            onDelete={() => handleDeleteFilter('rating')}
            variant="outlined"
            color="primary"
            size="small"
          />
        )}
        
        {userProfile?.mbti && (
          <Chip 
            label={`MBTI: ${userProfile.mbti}`}
            variant="outlined"
            color="secondary"
            size="small"
          />
        )}
      </Box>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {/* 카테고리 필터 */}
        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel id="category-filter-label">카테고리</InputLabel>
          <Select
            labelId="category-filter-label"
            id="category-filter"
            value={activeFilters.category || []}
            onChange={handleCategoryChange}
            label="카테고리"
            multiple
          >
            {categories.map((category) => (
              <MenuItem key={category.value} value={category.value}>
                {category.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {/* 평점 필터 */}
        <Box sx={{ width: 200 }}>
          <Typography variant="body2" gutterBottom>
            최소 평점: {activeFilters.rating || "전체"}
          </Typography>
          <Slider
            value={activeFilters.rating || 0}
            onChange={handleRatingChange}
            step={1}
            marks
            min={0}
            max={5}
            valueLabelDisplay="auto"
          />
        </Box>
      </Box>
    </Box>
  );
};

export default SearchFilters;
