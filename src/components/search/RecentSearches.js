// src/components/search/RecentSearches.js
import React from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { History as HistoryIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useSearch } from '../../contexts/SearchContext';

const RecentSearches = ({ searches = [] }) => {
  // useSearch 훅 사용 - 안전하게 기본값 처리
  const { 
    setSearchQuery = () => {}, 
    performSearch = () => {}, 
    clearSearchHistory = () => {},
    searchHistory = [],
    recentSearches = []
  } = useSearch() || {};

  // props로 전달받은 searches가 있으면 우선 사용, 없으면 context의 검색 기록 사용
  const searchesToDisplay = searches && searches.length > 0 
    ? searches 
    : recentSearches.length > 0 
      ? recentSearches 
      : searchHistory;

  // 표시할 검색어가 없으면 컴포넌트 렌더링하지 않음
  if (!searchesToDisplay || searchesToDisplay.length === 0) {
    return null;
  }

  const handleSearchClick = (search) => {
    // 검색어가 객체인 경우 (API 응답 등) 처리
    const searchTerm = typeof search === 'object' ? search.term : search;
    setSearchQuery(searchTerm);
    performSearch(searchTerm);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HistoryIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          <Typography variant="subtitle2">최근 검색어</Typography>
        </Box>
        <Button 
          size="small" 
          startIcon={<ClearIcon fontSize="small" />}
          onClick={clearSearchHistory}
        >
          전체 삭제
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {searchesToDisplay.map((search, index) => (
          <Chip
            key={index}
            label={typeof search === 'object' ? search.term : search}
            onClick={() => handleSearchClick(search)}
            variant="outlined"
            size="medium"
          />
        ))}
      </Box>
    </Box>
  );
};

export default RecentSearches;
