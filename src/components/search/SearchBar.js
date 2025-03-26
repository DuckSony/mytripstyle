// src/components/search/SearchBar.js
import React, { useState, useRef, useEffect } from 'react';
import { 
  TextField, 
  InputAdornment, 
  IconButton, 
  Paper,
  Box,
  ClickAwayListener,
  Typography
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Clear as ClearIcon,
  History as HistoryIcon 
} from '@mui/icons-material';
import Autocomplete from './Autocomplete';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../../contexts/SearchContext';

const SearchBar = ({ 
  fullWidth = false, 
  placeholder = "검색", 
  showRecentSearches = false,
  // 외부 검색 관련 props
  externalSearchQuery,
  onExternalSearchChange,
  onExternalSearch,
  externalRecentSearches = []
}) => {
  const navigate = useNavigate();
  
  // SearchContext 사용 - 안전한 기본값 제공
  // useSearch()가 undefined를 반환할 때도 안전하게 처리
  const searchContext = useSearch();
  const {
    searchQuery: contextSearchQuery = '',
    setSearchQuery: contextSetSearchQuery = () => {},
    performSearch: contextPerformSearch = () => {},
    recentSearches: contextRecentSearches = []
  } = searchContext || {
    searchQuery: '',
    setSearchQuery: () => {},
    performSearch: () => {},
    recentSearches: []
  };

  // 로컬 상태 - 외부 props 또는 context로 초기화
  const [inputValue, setInputValue] = useState(externalSearchQuery !== undefined ? externalSearchQuery : contextSearchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState(null);
  const searchBarRef = useRef(null);

  // 외부 검색어나 context 검색어 변경 시 inputValue 동기화
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setInputValue(externalSearchQuery);
    } else if (contextSearchQuery) {
      setInputValue(contextSearchQuery);
    }
  }, [externalSearchQuery, contextSearchQuery]);

  // 최근 검색어 가져오기 - 에러 처리 개선
  const getRecentSearches = () => {
    try {
      // 외부에서 제공된 최근 검색어가 있으면 사용
      if (Array.isArray(externalRecentSearches) && externalRecentSearches.length > 0) {
        return externalRecentSearches;
      }
      
      // Context에서 제공된 최근 검색어가 있으면 사용
      if (Array.isArray(contextRecentSearches) && contextRecentSearches.length > 0) {
        return contextRecentSearches;
      }
      
      // 아니면 로컬 스토리지에서 가져오기
      const storedSearches = localStorage.getItem('myTripStyle_searchHistory');
      if (!storedSearches) return [];
      
      const parsedSearches = JSON.parse(storedSearches);
      if (!Array.isArray(parsedSearches)) return [];
      
      return parsedSearches;
    } catch (e) {
      console.error('검색 기록 로드 오류:', e);
      return [];
    }
  };
  
  // 검색어 저장 - 최소 길이 체크 및 트림 추가
  const saveSearch = (query) => {
    if (!query || typeof query !== 'string') return;
    
    // 검색어 정제
    const trimmedQuery = query.trim();
    
    // 검색어 유효성 검사 (2자 이상)
    if (trimmedQuery.length < 2) return;
    
    try {
      const searches = getRecentSearches();
      // 중복 제거 및 최신 항목을 맨 앞으로
      const updatedSearches = [
        trimmedQuery,
        ...searches.filter(s => s.toLowerCase() !== trimmedQuery.toLowerCase())
      ].slice(0, 10); // 최대 10개 유지
      
      localStorage.setItem('myTripStyle_searchHistory', JSON.stringify(updatedSearches));
    } catch (e) {
      console.error('검색어 저장 오류:', e);
      // 저장 실패해도 사용자 경험에 영향 없음
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    
    // 에러 상태 초기화
    if (error) setError(null);
    
    // context 업데이트
    contextSetSearchQuery(value);
    
    // 외부 변경 핸들러가 있으면 호출
    if (onExternalSearchChange) {
      onExternalSearchChange(value);
    }
    
    // 입력값이 비어있으면 제안 숨기기
    if (value.trim() === '') {
      setShowSuggestions(false);
    } else if (showRecentSearches) {
      setShowSuggestions(true);
    }
  };
  
  const handleClear = () => {
    setInputValue('');
    
    // 에러 상태 초기화
    if (error) setError(null);
    
    // context 업데이트
    contextSetSearchQuery('');
    
    // 외부 변경 핸들러가 있으면 호출
    if (onExternalSearchChange) {
      onExternalSearchChange('');
    }
    
    setShowSuggestions(false);
  };
  
  const handleSearch = (e) => {
    e && e.preventDefault();
    
    // 검색어 정제
    const trimmedQuery = inputValue ? inputValue.trim() : '';
    
    // 검색어 유효성 검사
    if (!trimmedQuery) {
      return;
    }
    
    // 검색어 길이 검증 (최소 2자)
    if (trimmedQuery.length < 2) {
      setError('검색어는 최소 2자 이상 입력해주세요.');
      return;
    }
    
    // Context로 검색 수행
    contextPerformSearch(trimmedQuery);
    
    // 외부 검색 핸들러가 있으면 호출
    if (onExternalSearch) {
      onExternalSearch(trimmedQuery);
    } else {
      // 로컬에 검색어 저장
      saveSearch(trimmedQuery);
    }
    
    setShowSuggestions(false);
    
    // 검색 페이지로 이동
    if (window.location.pathname !== '/search') {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }
  };

  const handleKeyPress = (e) => {
    // 에러 상태 초기화
    if (error) setError(null);
    
    if (e.key === 'Enter') {
      handleSearch(e);
    } else if (e.key === 'Escape') {
      // ESC 키 처리
      setShowSuggestions(false);
      if (document.activeElement === searchBarRef.current?.querySelector('input')) {
        document.activeElement.blur();
      }
    }
  };
  
  const handleFocus = () => {
    if (showRecentSearches && inputValue && inputValue.trim() !== '') {
      setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    
    // context 업데이트
    contextSetSearchQuery(suggestion);
    
    // 외부 변경 핸들러가 있으면 호출
    if (onExternalSearchChange) {
      onExternalSearchChange(suggestion);
    }
    
    // Context로 검색 수행
    contextPerformSearch(suggestion);
    
    // 외부 검색 핸들러가 있으면 호출
    if (onExternalSearch) {
      onExternalSearch(suggestion);
    } else {
      // 로컬에 검색어 저장
      saveSearch(suggestion);
    }
    
    setShowSuggestions(false);
    
    // 검색 페이지로 이동
    if (window.location.pathname !== '/search') {
      navigate(`/search?q=${encodeURIComponent(suggestion)}`);
    }
  };

  // 최근 검색어에서 현재 입력과 일치하는 부분만 필터링
  const recentSearches = getRecentSearches();
  const filteredSuggestions = inputValue
    ? recentSearches.filter(item => 
        item.toLowerCase().includes(inputValue.toLowerCase())
      )
    : [];

  return (
    <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
      <Box ref={searchBarRef} sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
        <Paper 
          component="form" 
          onSubmit={handleSearch}
          sx={{ 
            p: '2px 4px', 
            display: 'flex', 
            alignItems: 'center',
            width: fullWidth ? '100%' : 300,
            borderRadius: 2,
            boxShadow: 2,
            border: error ? '1px solid #f44336' : 'none' // 에러 시 빨간 테두리
          }}
        >
          <IconButton type="submit" sx={{ p: '10px' }}>
            <SearchIcon />
          </IconButton>
          
          <TextField
            fullWidth
            variant="standard"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onFocus={handleFocus}
            InputProps={{
              disableUnderline: true,
              endAdornment: inputValue ? (
                <InputAdornment position="end">
                  <IconButton onClick={handleClear} edge="end">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
            sx={{ ml: 1, flex: 1 }}
          />
        </Paper>
        
        {/* 에러 메시지 표시 */}
        {error && (
          <Typography 
            variant="caption" 
            color="error"
            sx={{ 
              display: 'block', 
              mt: 0.5, 
              ml: 1 
            }}
          >
            {error}
          </Typography>
        )}
        
        {/* 자동완성 제안 목록 */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <Autocomplete
            suggestions={filteredSuggestions}
            onSelect={handleSuggestionClick}
          />
        )}
        
        {/* 최근 검색어가 없고, 제안을 표시해야 하는 경우 안내 메시지 */}
        {showSuggestions && filteredSuggestions.length === 0 && inputValue && inputValue.trim() !== '' && (
          <Paper
            sx={{
              position: 'absolute',
              width: '100%',
              mt: 0.5,
              borderRadius: 1,
              boxShadow: 2,
              zIndex: 10,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 1
            }}
          >
            <HistoryIcon color="disabled" />
            <Typography variant="body2" color="text.secondary">
              일치하는 최근 검색어가 없습니다.
            </Typography>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
};

export default SearchBar;
