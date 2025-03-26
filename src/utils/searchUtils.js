// src/utils/searchUtils.js

/**
 * 검색어를 정규화 (공백 제거, 소문자 변환)
 * @param {string} term - 검색어
 * @returns {string} - 정규화된 검색어
 */
export const normalizeSearchTerm = (term) => {
    if (!term) return '';
    return term.trim().toLowerCase();
  };
  
  /**
   * 검색어 하이라이트 처리
   * @param {string} text - 원본 텍스트
   * @param {string} searchTerm - 하이라이트할 검색어
   * @returns {Array} - JSX 요소 배열
   */
  export const highlightSearchTerm = (text, searchTerm) => {
    if (!text || !searchTerm) return text;
    
    const normalizedText = text.toLowerCase();
    const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
    
    if (!normalizedSearchTerm || !normalizedText.includes(normalizedSearchTerm)) {
      return text;
    }
    
    const parts = text.split(new RegExp(`(${normalizedSearchTerm})`, 'gi'));
    
    return parts.map((part, idx) => 
      part.toLowerCase() === normalizedSearchTerm 
        ? <mark key={idx} style={{backgroundColor: 'rgba(255, 222, 0, 0.4)', padding: 0}}>{part}</mark> 
        : part
    );
  };
  
  /**
   * 검색 결과의 미리보기 텍스트 생성
   * @param {string} text - 원본 텍스트
   * @param {string} searchTerm - 검색어
   * @param {number} maxLength - 최대 길이
   * @returns {string} - 미리보기 텍스트
   */
  export const generatePreviewText = (text, searchTerm, maxLength = 100) => {
    if (!text) return '';
    
    const normalizedText = text.toLowerCase();
    const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
    
    // 검색어가 포함된 위치 찾기
    const index = normalizedText.indexOf(normalizedSearchTerm);
    
    // 검색어가 없는 경우 처음부터 자르기
    if (index === -1) {
      return text.length > maxLength 
        ? `${text.substring(0, maxLength)}...` 
        : text;
    }
    
    // 검색어 위치 기준으로 앞뒤 문맥 추출
    const contextSize = Math.floor((maxLength - normalizedSearchTerm.length) / 2);
    let start = Math.max(0, index - contextSize);
    let end = Math.min(text.length, index + normalizedSearchTerm.length + contextSize);
    
    // 단어 경계로 조정
    while (start > 0 && text[start] !== ' ' && text[start] !== '.') {
      start--;
    }
    
    while (end < text.length && text[end] !== ' ' && text[end] !== '.') {
      end++;
    }
    
    // 미리보기 텍스트 생성
    let preview = text.substring(start, end);
    
    // 시작/끝 표시
    if (start > 0) preview = `...${preview}`;
    if (end < text.length) preview = `${preview}...`;
    
    return preview;
  };
  
  /**
   * 검색 필터 상태 처리 (URL 쿼리 파라미터로 변환)
   * @param {Object} filters - 필터 객체
   * @returns {string} - URL 쿼리 문자열
   */
  export const filtersToQueryString = (filters) => {
    if (!filters || typeof filters !== 'object') return '';
    
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        // 객체 타입 처리
        if (typeof value === 'object') {
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, value);
        }
      }
    });
    
    return params.toString();
  };
  
  /**
   * URL 쿼리 문자열을 필터 객체로 변환
   * @param {string} queryString - URL 쿼리 문자열
   * @returns {Object} - 필터 객체
   */
  export const queryStringToFilters = (queryString) => {
    const params = new URLSearchParams(queryString);
    const filters = {};
    
    for (const [key, value] of params.entries()) {
      // JSON 객체 처리 시도
      try {
        filters[key] = JSON.parse(value);
      } catch (e) {
        filters[key] = value;
      }
    }
    
    return filters;
  };
  
  /**
   * 검색 결과 정렬 함수
   * @param {Array} results - 검색 결과 배열
   * @param {string} sortBy - 정렬 기준
   * @returns {Array} - 정렬된 검색 결과
   */
  export const sortSearchResults = (results, sortBy = 'relevance') => {
    if (!results || !Array.isArray(results)) return [];
    
    const sortedResults = [...results];
    
    switch (sortBy) {
      case 'relevance':
        return sortedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      case 'rating':
        return sortedResults.sort((a, b) => (b.averageRating?.overall || 0) - (a.averageRating?.overall || 0));
      case 'name':
        return sortedResults.sort((a, b) => a.name.localeCompare(b.name));
      case 'distance':
        return sortedResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      default:
        return sortedResults;
    }
  };
  
  /**
   * 검색 결과 필터링 함수
   * @param {Array} results - 검색 결과 배열
   * @param {Object} filters - 필터 객체
   * @returns {Array} - 필터링된 검색 결과
   */
  export const filterSearchResults = (results, filters) => {
    if (!results || !Array.isArray(results)) return [];
    if (!filters || typeof filters !== 'object') return results;
    
    return results.filter(place => {
      // 카테고리 필터
      if (filters.category && place.category !== filters.category) {
        return false;
      }
      
      // MBTI 필터
      if (filters.mbtiType && place.mbtiMatchScore && 
          place.mbtiMatchScore[filters.mbtiType] < (filters.mbtiMinScore || 6)) {
        return false;
      }
      
      // 지역 필터
      if (filters.region) {
        if (filters.region.subRegion && place.subRegion !== filters.region.subRegion) {
          return false;
        } else if (filters.region.region && !filters.region.subRegion && 
                  place.region !== filters.region.region) {
          return false;
        }
      }
      
      // 평점 필터
      if (filters.minRating && (!place.averageRating || 
          place.averageRating.overall < filters.minRating)) {
        return false;
      }
      
      // 태그 필터
      if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
        const hasMatchingTag = place.interestTags && 
          place.interestTags.some(tag => filters.tags.includes(tag));
        if (!hasMatchingTag) return false;
      }
      
      return true;
    });
  };
  
  /**
   * 로컬 스토리지에 최근 검색어 저장
   * @param {string} searchTerm - 검색어
   * @param {number} maxItems - 최대 저장 개수
   */
  export const saveSearchToLocalStorage = (searchTerm, maxItems = 10) => {
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
      return;
    }
    
    try {
      const normalizedTerm = normalizeSearchTerm(searchTerm);
      
      // 기존 검색어 가져오기
      const existingSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      
      // 중복 제거
      const newSearches = existingSearches.filter(term => term !== normalizedTerm);
      
      // 새 검색어 추가
      newSearches.unshift(normalizedTerm);
      
      // 최대 개수로 제한
      const limitedSearches = newSearches.slice(0, maxItems);
      
      // 저장
      localStorage.setItem('recentSearches', JSON.stringify(limitedSearches));
    } catch (error) {
      console.error('Error saving search to localStorage:', error);
    }
  };
  
  /**
   * 로컬 스토리지에서 최근 검색어 가져오기
   * @param {number} limit - 가져올 검색어 수
   * @returns {Array} - 최근 검색어 배열
   */
  export const getSearchesFromLocalStorage = (limit = 10) => {
    try {
      const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      return searches.slice(0, limit);
    } catch (error) {
      console.error('Error getting searches from localStorage:', error);
      return [];
    }
  };
  
  /**
   * 로컬 스토리지에서 특정 검색어 삭제
   * @param {string} searchTerm - 삭제할 검색어
   * @returns {boolean} - 삭제 성공 여부
   */
  export const removeSearchFromLocalStorage = (searchTerm) => {
    try {
      const normalizedTerm = normalizeSearchTerm(searchTerm);
      const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      
      const newSearches = searches.filter(term => term !== normalizedTerm);
      
      localStorage.setItem('recentSearches', JSON.stringify(newSearches));
      return true;
    } catch (error) {
      console.error('Error removing search from localStorage:', error);
      return false;
    }
  };
  
  /**
   * 로컬 스토리지에서 모든 검색어 삭제
   * @returns {boolean} - 삭제 성공 여부
   */
  export const clearSearchesFromLocalStorage = () => {
    try {
      localStorage.removeItem('recentSearches');
      return true;
    } catch (error) {
      console.error('Error clearing searches from localStorage:', error);
      return false;
    }
  };
  
  const searchUtils = {
    normalizeSearchTerm,
    highlightSearchTerm,
    generatePreviewText,
    filtersToQueryString,
    queryStringToFilters,
    sortSearchResults,
    filterSearchResults,
    saveSearchToLocalStorage,
    getSearchesFromLocalStorage,
    removeSearchFromLocalStorage,
    clearSearchesFromLocalStorage
  };

  export default searchUtils;
