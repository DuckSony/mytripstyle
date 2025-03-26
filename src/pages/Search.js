// src/pages/Search.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Container, Typography, Divider, CircularProgress, Tab, Tabs } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import SearchBar from '../components/search/SearchBar';
import SearchResults from '../components/search/SearchResults';
import RecentSearches from '../components/search/RecentSearches';
import SearchFilters from '../components/search/SearchFilters';
import { useUser } from '../contexts/UserContext';
import { useSearch } from '../contexts/SearchContext';
import { useLocation } from 'react-router-dom';

const Search = () => {
  const location = useLocation();
  const { userProfile } = useUser() || {}; // userProfile이 undefined일 수 있으므로 기본값 설정
  
  // SearchContext 사용 - 안전하게 기본값 처리
  const {
    searchQuery = '',
    setSearchQuery = () => {},
    performSearch = () => {},
    searchResults = [],
    loading = false,
    error = null
  } = useSearch() || {};
  
  // 로컬 상태 관리
  const [tabValue, setTabValue] = useState(0);
  const [activeFilters, setActiveFilters] = useState({
    category: [],
    rating: null
  });

  // URL 파라미터에서 검색어 가져오기
  useEffect(() => {
    const query = new URLSearchParams(location.search).get('q');
    if (query) {
      setSearchQuery(query);
      performSearch(query);
    }
  }, [location.search, setSearchQuery, performSearch]);

  // 필터 변경 핸들러
  const handleFilterChange = (filterType, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // 필터링된 결과 계산
  const getFilteredResults = useCallback(() => {
    if (!searchResults || searchResults.length === 0) return [];
    
    return searchResults.filter(place => {
      // 카테고리 필터
      if (activeFilters.category && activeFilters.category.length > 0 && 
          !activeFilters.category.includes(place.category)) {
        return false;
      }
      
      // 평점 필터
      if (activeFilters.rating && place.averageRating && 
          place.averageRating.overall < activeFilters.rating) {
        return false;
      }
      
      return true;
    });
  }, [searchResults, activeFilters]);

  // useMemo를 사용하여 filteredResults 계산
  const filteredResults = useMemo(() => 
    getFilteredResults() || [], 
    [getFilteredResults]
  );
  
  // 모든 결과, MBTI 맞춤 결과로 탭 구분
  const getMbtiMatchedResults = useCallback(() => {
    if (!userProfile?.mbti) return [];
    
    // getFilteredResults를 직접 호출하여 최신 결과 사용
    const currentResults = getFilteredResults();
    if (!currentResults || currentResults.length === 0) return [];
    
    return currentResults.filter(place => {
      const mbtiScore = place.mbtiMatchScore ? place.mbtiMatchScore[userProfile.mbti] : 0;
      return mbtiScore && mbtiScore >= 6; // 6점 이상인 경우만
    });
  }, [userProfile?.mbti, getFilteredResults]);
  
  // useMemo를 사용하여 mbtiMatchedResults 계산
  const mbtiMatchedResults = useMemo(() => 
    getMbtiMatchedResults() || [], 
    [getMbtiMatchedResults]
  );

  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // 표시할 결과 선택 - 안전하게 처리
  const resultsToShow = useMemo(() => 
    tabValue === 0 ? filteredResults : mbtiMatchedResults, 
    [tabValue, filteredResults, mbtiMatchedResults]
  );

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          검색 <SearchIcon fontSize="medium" sx={{ verticalAlign: 'middle', ml: 1 }} />
        </Typography>
        
        {/* 검색 바 - 수정된 props 전달 */}
        <Box sx={{ my: 3 }}>
          <SearchBar 
            fullWidth 
            placeholder="장소, 카테고리, 지역 검색..." 
            showRecentSearches={true}
            externalSearchQuery={searchQuery}
            onExternalSearchChange={setSearchQuery}
            onExternalSearch={performSearch}
          />
        </Box>
        
        {/* 최근 검색어 */}
        {(!searchQuery || searchQuery.trim() === '') && (
          <Box sx={{ mb: 4 }}>
            <RecentSearches />
          </Box>
        )}
        
        {/* 검색 중 로딩 */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {/* 에러 메시지 */}
        {error && (
          <Box sx={{ my: 4, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}
        
        {/* 검색 결과 */}
        {searchQuery && searchQuery.trim() !== '' && !loading && !error && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                &apos;{searchQuery}&apos; 검색 결과 ({filteredResults.length})
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            {/* 검색 필터 */}
            <Box sx={{ mb: 3 }}>
              <SearchFilters 
                activeFilters={activeFilters} 
                onFilterChange={handleFilterChange}
              />
            </Box>
            
            {/* 결과 탭 - 안전하게 처리 */}
            {userProfile?.mbti && filteredResults.length > 0 && (
              <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  indicatorColor="primary"
                  textColor="primary"
                >
                  <Tab label={`모든 결과 (${filteredResults.length})`} />
                  <Tab label={`${userProfile.mbti || 'MBTI'} 맞춤 (${mbtiMatchedResults.length})`} />
                </Tabs>
              </Box>
            )}
            
            {/* 결과 목록 - 안전하게 처리 */}
            {resultsToShow.length > 0 ? (
              <SearchResults results={resultsToShow} />
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 6,
                  px: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" gutterBottom>
                  검색 결과가 없습니다.
                </Typography>
                <Typography color="text.secondary">
                  다른 키워드나 필터 옵션으로 검색해보세요.
                </Typography>
              </Box>
            )}
          </>
        )}
        
        {/* 검색 팁 */}
        {(!searchQuery || searchQuery.trim() === '') && (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              px: 2,
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <SearchIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h6" gutterBottom>
              검색 팁
            </Typography>
            <Typography color="text.secondary" paragraph>
              장소 이름, 카테고리, 지역, 관심사 등으로 검색해보세요.
            </Typography>
            <Typography color="text.secondary">
              MBTI, 현재 감정 상태, 취향에 맞는 장소를 찾을 수 있습니다.
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Search;
