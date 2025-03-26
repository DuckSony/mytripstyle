// src/contexts/SearchContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import searchService from '../services/searchService';

// 상수 정의
const DEBOUNCE_DELAY = 300; // 디바운스 딜레이(ms)
const SEARCH_CACHE_TTL = 30 * 60 * 1000; // 캐시 유효 시간 (30분)
const MAX_RECENT_SEARCHES = 10; // 최근 검색어 최대 개수

// 로컬 스토리지 키 설정
const LOCAL_STORAGE_KEYS = {
  SEARCH_HISTORY: 'myTripStyle_searchHistory',
  SEARCH_CACHE: 'myTripStyle_searchCache',
};

// 개발 모드에서만 로깅
const logDebug = (message, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SearchContext] ${message}`, data || '');
  }
};

// 컨텍스트의 기본값 정의
const defaultContextValue = {
  searchQuery: '',
  searchResults: [],
  searchHistory: [],
  recentSearches: [],
  loading: false,
  error: null,
  setSearchQuery: () => {},
  performSearch: () => {},
  clearSearchHistory: () => {},
  removeFromHistory: () => {},
  showSearchResults: false,
  setShowSearchResults: () => {},
  parseSearchQueryFromURL: () => {}
};

// 컨텍스트 생성 - 기본값 제공
const SearchContext = createContext(defaultContextValue);

// 컨텍스트 사용을 위한 안전한 훅 - 수정된 부분
export const useSearch = () => {
  try {
    const context = useContext(SearchContext);
    
    // 명시적으로 context가 null 또는 undefined인 경우 확인
    if (context === null || context === undefined) {
      console.warn('SearchContext가 제공되지 않았습니다. SearchProvider가 상위 컴포넌트에 존재하는지 확인하세요.');
      return defaultContextValue;
    }
    
    return context;
  } catch (error) {
    console.error('useSearch 훅 사용 중 오류:', error);
    return defaultContextValue;
  }
};

// 검색 결과 캐싱 유틸리티 함수
const getSearchCache = () => {
  try {
    const cache = localStorage.getItem(LOCAL_STORAGE_KEYS.SEARCH_CACHE);
    return cache ? JSON.parse(cache) : {};
  } catch (error) {
    logDebug('캐시 불러오기 실패', error);
    return {};
  }
};

// 검색 결과를 캐시에 저장
const saveSearchCache = (searchTerm, results) => {
  try {
    const cache = getSearchCache();
    cache[searchTerm] = {
      results,
      timestamp: Date.now()
    };
    
    // 캐시 크기 제한 (최대 20개)
    const cacheEntries = Object.entries(cache);
    if (cacheEntries.length > 20) {
      // 가장 오래된 항목부터 삭제
      const sortedEntries = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const newCache = {};
      sortedEntries.slice(cacheEntries.length - 20).forEach(([key, value]) => {
        newCache[key] = value;
      });
      localStorage.setItem(LOCAL_STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(newCache));
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(cache));
    }
  } catch (error) {
    logDebug('캐시 저장 실패', error);
  }
};

// 프로바이더 컴포넌트
export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQueryState] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // 디바운스 타이머 ref
  const debounceTimerRef = useRef(null);
  // 현재 진행 중인 검색 요청 취소 함수
  const abortControllerRef = useRef(null);
  // URL 매개변수 이전 값 추적
  const prevURLParamsRef = useRef('');
  
  // 검색 기록 로컬 스토리지에서 로드
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEYS.SEARCH_HISTORY);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setSearchHistory(parsedHistory);
          logDebug(`검색 기록 ${parsedHistory.length}개 로드됨`);
        }
      }
    } catch (e) {
      console.error('검색 기록 로드 중 오류:', e);
    }
  }, []);

  // 로컬 스토리지에 검색 기록 저장하는 함수 (배치 처리 최적화)
  const saveSearchHistory = useCallback((history) => {
    try {
      // 전체 배열 대신 stringified 데이터 크기 확인
      const historyStr = JSON.stringify(history);
      
      // 너무 큰 경우 최근 10개만 유지
      if (historyStr.length > 10000) {
        const reducedHistory = history.slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(LOCAL_STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(reducedHistory));
        logDebug(`크기 제한으로 검색 기록 ${reducedHistory.length}개만 저장됨`);
        return;
      }
      
      localStorage.setItem(LOCAL_STORAGE_KEYS.SEARCH_HISTORY, historyStr);
      logDebug(`검색 기록 ${history.length}개 저장됨`);
    } catch (e) {
      console.error('검색 기록 저장 중 오류:', e);
    }
  }, []);

  // 검색 기록 업데이트 함수
  const updateSearchHistory = useCallback((query) => {
    if (!query.trim()) return;
    
    setSearchHistory(prevHistory => {
      const normalizedQuery = query.trim();
      const newHistory = [
        normalizedQuery,
        ...prevHistory.filter(item => item !== normalizedQuery)
      ].slice(0, MAX_RECENT_SEARCHES);
      
      // 배치 처리를 위해 setTimeout 사용
      setTimeout(() => {
        saveSearchHistory(newHistory);
      }, 0);
      
      return newHistory;
    });
  }, [saveSearchHistory]);

  // 메모이제이션된 검색 실행 함수
  const performSearch = useCallback(async (query) => {
    if (!query || !query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // 이전 타이머 및 요청 정리
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 새로운 AbortController 생성
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    const normalizedQuery = query.trim();
    
    logDebug(`검색 실행: "${normalizedQuery}"`);
    
    try {
      // 캐시된 결과 확인
      const cache = getSearchCache();
      const cachedData = cache[normalizedQuery];
      
      // 유효한 캐시가 있는지 확인
      if (cachedData && (Date.now() - cachedData.timestamp < SEARCH_CACHE_TTL)) {
        logDebug(`캐시된 결과 사용: "${normalizedQuery}"`);
        setSearchResults(cachedData.results);
        setLoading(false);
        setShowSearchResults(true);
        
        // 검색 기록에 추가 (중복 제거 및 최대 10개 유지)
        updateSearchHistory(normalizedQuery);
        return;
      }
      
      // 실제 검색 수행
      const searchResult = await searchService.searchPlaces(normalizedQuery, {
        signal: abortControllerRef.current.signal
      });
      
      if (searchResult.success) {
        setSearchResults(searchResult.data);
        logDebug(`검색 결과 ${searchResult.data.length}개 반환됨`);
        
        // 결과 캐싱
        saveSearchCache(normalizedQuery, searchResult.data);
        
        // 검색 기록 업데이트
        updateSearchHistory(normalizedQuery);
      } else {
        throw new Error(searchResult.error || '검색 중 오류가 발생했습니다.');
      }
    } catch (err) {
      // AbortError는 정상적인 취소이므로 오류로 처리하지 않음
      if (err.name !== 'AbortError') {
        console.error('검색 중 오류:', err);
        setError(err.message || '검색 중 오류가 발생했습니다.');
      }
    } finally {
      // 현재 요청이 취소되지 않은 경우에만 로딩 상태 변경
      if (abortControllerRef.current) {
        setLoading(false);
        setShowSearchResults(true);
        abortControllerRef.current = null;
      }
    }
  }, [updateSearchHistory]);

  // 입력값에 대한 디바운스 처리
  const setSearchQuery = useCallback((newQuery) => {
    // 기존 디바운스 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 입력 값 즉시 업데이트
    setSearchQueryState(newQuery);
    
    // 진행 중인 검색 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // 빈 검색어는 결과 초기화
    if (!newQuery || newQuery.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    // 디바운스 타이머 설정 - 지정된 시간 후 검색 실행
    debounceTimerRef.current = setTimeout(() => {
      performSearch(newQuery);
    }, DEBOUNCE_DELAY);
    
    logDebug(`검색어 변경 및 디바운스 타이머 설정: "${newQuery}"`);
  }, [performSearch]);

  // 검색 기록 삭제
  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SEARCH_HISTORY);
    logDebug('검색 기록 전체 삭제됨');
  }, []);

  // 단일 검색 기록 삭제
  const removeFromHistory = useCallback((query) => {
    setSearchHistory(prevHistory => {
      const newHistory = prevHistory.filter(item => item !== query);
      saveSearchHistory(newHistory);
      logDebug(`검색 기록에서 "${query}" 삭제됨`);
      return newHistory;
    });
  }, [saveSearchHistory]);

  // URL 매개변수에서 검색어 파싱 (최적화)
  const parseSearchQueryFromURL = useCallback(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('q') || '';
      
      // 이전 URL 파라미터와 동일한지 확인
      const currentURLParams = urlParams.toString();
      if (currentURLParams === prevURLParamsRef.current) {
        return; // 변경 없음, 불필요한 검색 방지
      }
      
      // 현재 URL 파라미터 저장
      prevURLParamsRef.current = currentURLParams;
      
      if (queryParam.trim() !== '') {
        setSearchQueryState(queryParam);
        performSearch(queryParam);
        logDebug(`URL 매개변수에서 검색어 파싱: "${queryParam}"`);
      }
    }
  }, [performSearch]);

  // 컴포넌트 마운트 시 URL 매개변수 확인
  useEffect(() => {
    parseSearchQueryFromURL();
    
    // URL 변경 감지 및 정리
    const handleURLChange = () => {
      parseSearchQueryFromURL();
    };
    
    window.addEventListener('popstate', handleURLChange);
    return () => {
      window.removeEventListener('popstate', handleURLChange);
      // 타이머 정리
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // 요청 정리
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [parseSearchQueryFromURL]);

  // 메모이제이션된 컨텍스트 값
  const contextValue = useMemo(() => ({
    searchQuery,
    searchResults,
    searchHistory,
    recentSearches: searchHistory, // 호환성을 위해 유지
    loading,
    error,
    setSearchQuery,
    performSearch,
    clearSearchHistory,
    removeFromHistory,
    showSearchResults,
    setShowSearchResults,
    parseSearchQueryFromURL
  }), [
    searchQuery,
    searchResults,
    searchHistory,
    loading,
    error,
    setSearchQuery,
    performSearch,
    clearSearchHistory,
    removeFromHistory,
    showSearchResults,
    setShowSearchResults,
    parseSearchQueryFromURL
  ]);

  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  );
};

export default SearchContext;
