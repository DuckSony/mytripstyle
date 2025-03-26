// src/pages/Recommendations.js (Part 1: Imports & Setup)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Tabs, 
  Tab, 
  Alert,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Fab,
  Zoom,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  useMediaQuery,
  useTheme,
  Snackbar,
  CircularProgress,
  Chip,
  Fade,
  Badge
} from '@mui/material';

// 아이콘
import ViewListIcon from '@mui/icons-material/ViewList';
import MapIcon from '@mui/icons-material/Map';
import MoodIcon from '@mui/icons-material/Mood';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CachedIcon from '@mui/icons-material/Cached';
import TuneIcon from '@mui/icons-material/Tune';
import LocationOnIcon from '@mui/icons-material/LocationOn';
//import FilterListIcon from '@mui/icons-material/FilterList';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SpeedIcon from '@mui/icons-material/Speed';

// 컨텍스트 및 서비스
import { useUser } from '../contexts/UserContext';
import locationService from '../services/locationService';
import { getNearbyRecommendations, getRegionRecommendations } from '../services/recommendationService';
import recommendationUtils from '../utils/recommendationUtils';
import { createDummyPlaces } from '../utils/dummyDataGenerator';
import { getFeedbacksByUser } from '../services/feedbackService';
import { clearCacheByType } from '../services/cacheService';
// startPerformanceMeasure 대신 measurePerformance 사용
import { measurePerformance } from '../utils/optimizationUtils';

// 컴포넌트
import RecommendationList from '../components/recommendation/RecommendationList';
import LocationPermission from '../components/location/LocationPermission';
import LocationStatus from '../components/location/LocationStatus';
import RecommendationMap from '../components/recommendation/RecommendationMap';
import EnhancedFilters from '../components/recommendation/EnhancedFilters';
import PullToRefresh from '../components/common/PullToRefresh';

// framer-motion
import { motion, AnimatePresence } from 'framer-motion';

// 애니메이션 변수 정의
const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const slideUpVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
  exit: { 
    y: 20, 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const scaleVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  }
};

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
      duration: 0.3
    }
  }
};

// 상태 관리를 통합하여 최적화한 Recommendations 컴포넌트
const Recommendations = () => {

  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  //const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // 페이지 크기를 상수로 정의
  const PAGE_SIZE = 10; // 고정된 페이지 크기 값 사용
  
  const { userProfile, user } = useUser();
  
  // 기본 상태 그룹화 및 통합
  const [uiState, setUiState] = useState({
    loading: true,
    refreshing: false,
    error: null,
    activeTab: 0,
    viewMode: 'list',
    showScrollTop: false,
    moodDialogOpen: false,
    showLocationStatus: false,
    showFilters: false,
    snackbarOpen: false,
    snackbarMessage: '',
    currentPage: 1,
    animationEnabled: true,
  });

  // 필터링 상태 통합
  const [filters, setFilters] = useState({
    nearby: {
      category: 'all',
      distance: 'all',
      rating: 'all',
      mbtiMatch: 'all',
      priceLevel: 'all',
      mood: 'all',
      sortBy: 'recommendation'
    },
    region: {
      category: 'all',
      distance: 'all',
      rating: 'all',
      mbtiMatch: 'all',
      priceLevel: 'all',
      mood: 'all',
      sortBy: 'recommendation'
    }
  });
  
  // 데이터 상태 통합
  const [dataState, setDataState] = useState({
    nearbyPlaces: [],
    regionPlaces: {},
    activeRegion: null,
    feedbackData: [],
    useCachedData: true,
    locationPermissionGranted: false,
    userLocation: null,
    hasMoreNearbyItems: true,
    hasMoreRegionItems: true,
    loadingMore: false,
    selectedMood: '',
  });
  
// UI 상태 업데이트 함수 (부분 업데이트)
const updateUiState = useCallback((updates) => {
  setUiState(prev => ({ ...prev, ...updates }));
}, []);

// 필터 업데이트 함수
const updateFilters = useCallback((type, filterType, value) => {
  setFilters(prev => ({
    ...prev,
    [type]: {
      ...prev[type],
      [filterType]: value
    }
  }));
  
  // 필터 변경 시 페이지네이션 상태 초기화
  updateUiState({ currentPage: 1 });
}, [updateUiState]);

// 데이터 상태 업데이트 함수 (부분 업데이트)
const updateDataState = useCallback((updates) => {
  setDataState(prev => ({ ...prev, ...updates }));
}, []);

// 참조 생성
const listContainerRef = useRef(null);
const mapContainerRef = useRef(null);
const filtersRef = useRef(null);

// 위치 감시 ID 저장용 ref
const watchIdRef = useRef(null);

// 애니메이션 성능 체크 (첫 페이지 로드 후 3초 후에 저사양 기기에서는 애니메이션 비활성화)
useEffect(() => {
  const animationTimer = setTimeout(() => {
    // 프레임 레이트 체크
    const checkPerformance = () => {
      let lastTimestamp = performance.now();
      let frameCount = 0;
      let totalDelta = 0;
      
      const measureFrameRate = (timestamp) => {
        frameCount++;
        const delta = timestamp - lastTimestamp;
        totalDelta += delta;
        lastTimestamp = timestamp;
        
        if (frameCount >= 10) {
          const averageDelta = totalDelta / frameCount;
          const estimatedFPS = 1000 / averageDelta;
          
          // 30fps 이하면 애니메이션 비활성화
          if (estimatedFPS < 30) {
            console.log('저사양 기기 감지, 애니메이션 최적화 모드 활성화');
            updateUiState({ animationEnabled: false });
          }
          
          return;
        }
        
        requestAnimationFrame(measureFrameRate);
      };
      
      requestAnimationFrame(measureFrameRate);
    };
    
    checkPerformance();
  }, 3000);
  
  return () => clearTimeout(animationTimer);
}, [updateUiState]);

// 위치 권한 처리 콜백 - 메모이제이션 강화
const handleLocationGranted = useCallback((location) => {
  console.log("Location permission granted:", location);
  
  updateDataState({ 
    locationPermissionGranted: true,
    userLocation: { 
      latitude: location.latitude, 
      longitude: location.longitude,
      accuracy: location.accuracy 
    }
  });
  
  // 내 주변 탭으로 활성화 (이미 내 주변 탭이 아닌 경우)
  if (uiState.activeTab !== 0) {
    updateUiState({ activeTab: 0, error: null });
  } else {
    updateUiState({ error: null });
  }
  
  // 성공 알림
  updateUiState({
    snackbarOpen: true,
    snackbarMessage: '위치 정보를 성공적으로 불러왔습니다.'
  });
  
  setTimeout(() => {
    updateUiState({ snackbarOpen: false });
  }, 2000);
  
}, [uiState.activeTab, updateDataState, updateUiState]);

const handleLocationDenied = useCallback((err) => {
  console.error("Location permission denied or error:", err);
  updateUiState({ 
    error: "위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.",
    loading: false 
  });
  
  // 위치 정보를 가져올 수 없더라도 관심 지역 추천은 표시
  if (userProfile?.preferredLocations?.length > 0) {
    // 관심 지역 탭을 기본으로 활성화
    updateUiState({ activeTab: 1 });
  }
}, [updateUiState, userProfile?.preferredLocations?.length]);

// 위치 정보 새로고침 핸들러 - 의존성 최적화
const handleRefreshLocation = useCallback(async () => {
  try {
    updateUiState({ loading: true });
    const result = await locationService.getUserLocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
    
    if (result.success) {
      handleLocationGranted(result.data);
    } else {
      handleLocationDenied(new Error(result.error));
    }
  } catch (error) {
    handleLocationDenied(error);
  } finally {
    updateUiState({ loading: false });
  }
}, [handleLocationGranted, handleLocationDenied, updateUiState]);

// 관심 지역 추천 로딩 - 메모이제이션 및 의존성 최적화
const loadRegionRecommendations = useCallback(async () => {
  if (!userProfile?.preferredLocations?.length > 0) {
    // 관심 지역이 없는 경우 기본 지역 제공
    if (userProfile) {
      const defaultRegions = {
        '강남/서초': createDummyPlaces(8, { subRegion: '강남/서초' }),
        '홍대/합정': createDummyPlaces(8, { subRegion: '홍대/합정' })
      };
      updateDataState({
        regionPlaces: defaultRegions,
        activeRegion: { subRegion: '강남/서초', region: '서울' }
      });
    }
    return;
  }
  
  try {
    const regionResults = {};
    const firstRegion = userProfile.preferredLocations[0];
    updateDataState({ activeRegion: firstRegion });
    
    // 병렬 처리를 위한 Promise 배열
    const regionPromises = userProfile.preferredLocations.map(async (region) => {
      try {
        const regionKey = region.subRegion || region.region;
        
        const result = await getRegionRecommendations(
          userProfile, 
          region, 
          {
            useCache: dataState.useCachedData,
            userId: user?.uid || 'anonymous',
            filters: filters.region
          }
        );
        
        if (result.success) {
          return {
            regionKey,
            data: result.data,
            fromCache: result.fromCache
          };
        } else {
          // 실패 시 더미 데이터 생성
          return {
            regionKey,
            data: createDummyPlaces(8, region),
            isDummyData: true
          };
        }
      } catch (err) {
        // 오류 발생 시 더미 데이터 생성
        const regionKey = region.subRegion || region.region;
        return {
          regionKey,
          data: createDummyPlaces(8, region),
          isDummyData: true,
          error: err.message
        };
      }
    });
    
    // 모든 지역 데이터 병렬 요청
    const results = await Promise.all(regionPromises);
    
    // 결과 처리
    results.forEach(result => {
      regionResults[result.regionKey] = result.data;
      
      if (result.fromCache) {
        console.log(`${result.regionKey} 지역은 캐시 데이터 사용`);
      } else if (result.isDummyData) {
        console.log(`${result.regionKey} 지역은 더미 데이터 사용`);
      }
    });
    
    updateDataState({ regionPlaces: regionResults });
  } catch (err) {
    console.error("Error loading region recommendations:", err);
    
    // 오류 발생 시 기본 지역에 더미 데이터 설정
    const defaultRegions = {
      '강남/서초': createDummyPlaces(8, { subRegion: '강남/서초' }),
      '홍대/합정': createDummyPlaces(8, { subRegion: '홍대/합정' })
    };
    updateDataState({ 
      regionPlaces: defaultRegions,
      activeRegion: { subRegion: '강남/서초', region: '서울' }
    });
    updateUiState({ error: null });
  }
}, [
  userProfile, 
  user, 
  filters.region, 
  dataState.useCachedData, 
  updateDataState,
  updateUiState
]);

// 모든 데이터 새로고침 핸들러 - 퍼포먼스 최적화
const handleRefreshData = useCallback(async () => {
  try {
    updateUiState({ 
      refreshing: true,
      snackbarMessage: '데이터를 새로고침 중입니다...',
      snackbarOpen: true 
    });
    
    // 캐시 사용 안함 옵션
    updateDataState({ useCachedData: false });
    
    // 추천 관련 캐시 정리 (선택적)
    try {
      clearCacheByType('recommendations');
      clearCacheByType('region_recommendations');
      recommendationUtils.clearMemoizationCache();
    } catch (error) {
      console.warn('캐시 정리 오류:', error);
    }
    
    // 위치 정보 갱신 (내 주변 탭인 경우)
    if (uiState.activeTab === 0) {
      await handleRefreshLocation();
    }
    
    // 관심 지역 데이터 갱신
    await loadRegionRecommendations();
    
    // 페이지네이션 상태 초기화
    updateUiState({ 
      currentPage: 1,
      snackbarMessage: '데이터가 새로고침되었습니다' 
    });
    
    // 잠시 후 캐시 사용 다시 활성화
    setTimeout(() => {
      updateDataState({ useCachedData: true });
    }, 1000);
  } catch (error) {
    console.error('데이터 새로고침 오류:', error);
    updateUiState({ snackbarMessage: '새로고침 중 오류가 발생했습니다' });
  } finally {
    updateUiState({ refreshing: false });
    
    // 알림 자동 닫기
    setTimeout(() => {
      updateUiState({ snackbarOpen: false });
    }, 3000);
  }
}, [
  uiState.activeTab, 
  handleRefreshLocation, 
  loadRegionRecommendations,
  updateUiState,
  updateDataState
]);

// PagedList를 위한 더 많은 아이템 로드 함수
const handleLoadMoreNearbyItems = useCallback(async () => {
  // 시작 마크 생성
  const startMark = `load-more-nearby-items-start-${Date.now()}`;
  const endMark = `load-more-nearby-items-end-${Date.now()}`;
  
  try {
    // 성능 측정 시작
    performance.mark(startMark);
    
    updateDataState({ loadingMore: true });
    
    // 이미 모든 아이템을 로드한 경우
    if (dataState.nearbyPlaces.length <= uiState.currentPage * PAGE_SIZE) {
      updateDataState({ hasMoreNearbyItems: false });
      return;
    }
    
    // 다음 페이지로 이동
    updateUiState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    
    // 스크롤 스무딩 (리스트 컨테이너가 참조되어 있을 때)
    if (listContainerRef.current) {
      const currentHeight = listContainerRef.current.scrollHeight;
      setTimeout(() => {
        const newHeight = listContainerRef.current.scrollHeight;
        const scrollOffset = newHeight - currentHeight;
        if (scrollOffset > 0) {
          window.scrollBy({
            top: scrollOffset / 2,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
    
  } catch (error) {
    console.error('더 많은 아이템 로드 오류:', error);
  } finally {
    updateDataState({ loadingMore: false });
    
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('load-more-nearby-items', startMark, endMark, 'interactions');
  }
}, [
  dataState.nearbyPlaces.length, 
  uiState.currentPage, 
  PAGE_SIZE,
  updateDataState,
  updateUiState
]);

const handleLoadMoreRegionItems = useCallback(async () => {
  // 시작 마크 생성
  const startMark = `load-more-region-items-start-${Date.now()}`;
  const endMark = `load-more-region-items-end-${Date.now()}`;
  
  try {
    // 성능 측정 시작
    performance.mark(startMark);
    
    updateDataState({ loadingMore: true });
    
    if (!dataState.activeRegion) return;
    
    const regionKey = dataState.activeRegion.subRegion || dataState.activeRegion.region;
    const places = dataState.regionPlaces[regionKey] || [];
    
    // 이미 모든 아이템을 로드한 경우
    if (places.length <= uiState.currentPage * PAGE_SIZE) {
      updateDataState({ hasMoreRegionItems: false });
      return;
    }
    
    // 다음 페이지로 이동
    updateUiState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    
    // 스크롤 스무딩 (리스트 컨테이너가 참조되어 있을 때)
    if (listContainerRef.current) {
      const currentHeight = listContainerRef.current.scrollHeight;
      setTimeout(() => {
        const newHeight = listContainerRef.current.scrollHeight;
        const scrollOffset = newHeight - currentHeight;
        if (scrollOffset > 0) {
          window.scrollBy({
            top: scrollOffset / 2,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
    
  } catch (error) {
    console.error('더 많은 지역 아이템 로드 오류:', error);
  } finally {
    updateDataState({ loadingMore: false });
    
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('load-more-region-items', startMark, endMark, 'interactions');
  }
}, [
  dataState.activeRegion, 
  dataState.regionPlaces, 
  uiState.currentPage, 
  PAGE_SIZE,
  updateDataState,
  updateUiState
]);

// 필터 및 정렬 적용 함수 - 메모이제이션 최적화
const getFilteredAndSortedPlaces = useCallback((places, filters, isNearby) => {
  if (!places) return [];
  
  // 시작 마크 생성
  const startMark = `filter-and-sort-places-start-${Date.now()}`;
  const endMark = `filter-and-sort-places-end-${Date.now()}`;
  
  try {
    // 성능 측정 시작
    performance.mark(startMark);
    
    // 필터 적용
    const filteredPlaces = recommendationUtils.applyFilters(places, filters, isNearby);
    
    // 정렬 적용
    const sortedPlaces = recommendationUtils.sortPlaces(filteredPlaces, filters.sortBy);
    
    return sortedPlaces;
  } finally {
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('filter-and-sort-places', startMark, endMark, 'interactions');
  }
}, []);

// 탭 변경 핸들러 - 애니메이션 추가
const handleTabChange = useCallback((event, newValue) => {
  // 이전 값과 동일하면 무시
  if (uiState.activeTab === newValue) return;
  
  // 탭 변경 시 전환 애니메이션 적용
  updateUiState({ 
    activeTab: newValue,
    currentPage: 1, // 탭 변경 시 페이지네이션 상태 초기화
    showFilters: false // 필터 패널 닫기
  });
  
  // 탭 변경 시 스크롤 맨 위로 
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 100);
  
}, [uiState.activeTab, updateUiState]);

// 지역 변경 핸들러 - 애니메이션 추가
const handleRegionChange = useCallback((region) => {
  updateDataState({ activeRegion: region });
  updateUiState({ 
    currentPage: 1, // 지역 변경 시 페이지네이션 상태 초기화
    showFilters: false // 필터 패널 닫기
  });
  
  // 선택된 지역으로 스크롤
  setTimeout(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, 100);
}, [updateDataState, updateUiState]);

// 뷰 모드 변경 핸들러 - 부드러운 전환 효과 추가
const handleViewModeChange = useCallback((event, newMode) => {
  if (newMode !== null && newMode !== uiState.viewMode) {
    updateUiState({ 
      viewMode: newMode,
      showFilters: false // 필터 패널 닫기
    });
    
    // 맵 뷰로 전환 시 맵 컨테이너로 스크롤
    if (newMode === 'map' && mapContainerRef.current) {
      setTimeout(() => {
        mapContainerRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 300);
    }
  }
}, [uiState.viewMode, updateUiState]);

// 필터 토글 핸들러
const handleToggleFilters = useCallback(() => {
  updateUiState(prev => ({ 
    ...prev, 
    showFilters: !prev.showFilters 
  }));
  
  // 필터 패널이 열릴 때 필터 섹션으로 스크롤
  if (!uiState.showFilters && filtersRef.current) {
    setTimeout(() => {
      filtersRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  }
}, [uiState.showFilters, updateUiState]);

// 내 주변 필터 변경 핸들러
const handleNearbyFilterChange = useCallback((filterType, value) => {
  updateFilters('nearby', filterType, value);
}, [updateFilters]);

// 관심 지역 필터 변경 핸들러
const handleRegionFilterChange = useCallback((filterType, value) => {
  updateFilters('region', filterType, value);
}, [updateFilters]);

// 맨 위로 스크롤 핸들러 - 부드러운 스크롤 추가
const handleScrollToTop = useCallback(() => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}, []);

// 감정 상태 관련 아이콘 및 색상 매핑
const moodIcons = {
  '기쁨': <SentimentSatisfiedAltIcon sx={{ color: theme.palette.success.main }} />,
  '스트레스': <SentimentVeryDissatisfiedIcon sx={{ color: theme.palette.error.main }} />,
  '피곤함': <NightsStayIcon sx={{ color: theme.palette.info.dark }} />,
  '설렘': <FavoriteIcon sx={{ color: theme.palette.secondary.main }} />,
  '평온함': <SpeedIcon sx={{ color: theme.palette.primary.main }} />
};

// 감정 상태 다이얼로그 닫기
const handleCloseMoodDialog = useCallback(() => {
  updateUiState({ moodDialogOpen: false });
  updateDataState({ selectedMood: '' });
}, [updateUiState, updateDataState]);

// 감정 상태 선택 처리
const handleMoodChange = useCallback((event) => {
  updateDataState({ selectedMood: event.target.value });
}, [updateDataState]);

// 감정 상태 저장 - 중첩 상태 업데이트 최적화
const handleSaveMood = useCallback(async () => {
  const { selectedMood } = dataState;
  
  if (!selectedMood || !userProfile) return;
  
  try {
    updateUiState({ 
      loading: true,
      snackbarMessage: '감정 상태를 업데이트 중입니다...',
      snackbarOpen: true
    });
    
    // 현재 프로필에 감정 상태 업데이트
    await user.updateUserProfile({
      ...userProfile,
      currentMood: {
        mood: selectedMood,
        timestamp: new Date()
      }
    });
    
    // 감정 상태 기반 필터 적용
    handleNearbyFilterChange('mood', selectedMood);
    handleRegionFilterChange('mood', selectedMood);
    
    // 다이얼로그 닫기
    updateUiState({ moodDialogOpen: false });
    
    // 데이터 새로고침
    if (dataState.locationPermissionGranted && dataState.userLocation) {
      const nearbyResult = await getNearbyRecommendations(
        {
          ...userProfile,
          currentMood: {
            mood: selectedMood,
            timestamp: new Date()
          }
        },
        dataState.userLocation,
        5000,
        { 
          useCache: false, 
          userId: user?.uid || 'anonymous'
        }
      );
      
      if (nearbyResult.success) {
        if (nearbyResult.data.length > 0) {
          updateDataState({ nearbyPlaces: nearbyResult.data });
        } else {
          // 결과가 없는 경우 더미 데이터
          const dummyPlaces = createDummyPlaces(8);
          updateDataState({ nearbyPlaces: dummyPlaces });
        }
      }
    }
    
    if (userProfile?.preferredLocations?.length > 0) {
      await loadRegionRecommendations();
    }
    
    // 감정 변경 확인 메시지
    updateUiState({
      loading: false,
      snackbarMessage: `감정 상태가 '${selectedMood}'(으)로 변경되었습니다`,
      snackbarOpen: true
    });
  } catch (error) {
    console.error('Error updating mood:', error);
    updateUiState({ 
      loading: false,
      snackbarMessage: '감정 상태 업데이트 중 오류가 발생했습니다',
      snackbarOpen: true
    });
  }
  
  // 알림 자동 닫기
  setTimeout(() => {
    updateUiState({ snackbarOpen: false });
  }, 3000);
  
}, [
  dataState, 
  userProfile,
  user,
  handleNearbyFilterChange,
  handleRegionFilterChange,
  loadRegionRecommendations,
  updateUiState,
  updateDataState
]);

// 추천 통계 계산 - useMemo 최적화
const nearbyStats = useMemo(() => {
  return recommendationUtils.calculateRecommendationStats(dataState.nearbyPlaces);
}, [dataState.nearbyPlaces]);

const regionStats = useMemo(() => {
  if (!dataState.activeRegion) return {};
  const regionKey = dataState.activeRegion.subRegion || dataState.activeRegion.region;
  const places = dataState.regionPlaces[regionKey] || [];
  return recommendationUtils.calculateRecommendationStats(places);
}, [dataState.activeRegion, dataState.regionPlaces]);

// 보여줄 장소 목록 - 페이지네이션 적용 및 의존성 최적화
const filteredNearbyPlaces = useMemo(() => {
  // 시작 마크 생성
  const startMark = `filter-nearby-places-start-${Date.now()}`;
  const endMark = `filter-nearby-places-end-${Date.now()}`;
  
  try {
    // 성능 측정 시작
    performance.mark(startMark);
    
    // 필터링된 전체 장소 목록
    const allFiltered = getFilteredAndSortedPlaces(
      dataState.nearbyPlaces, 
      filters.nearby, 
      true
    );
    
    // 무한 스크롤 모드에서는 현재 페이지까지의 아이템을 보여줌
    const paginatedItems = allFiltered.slice(0, uiState.currentPage * PAGE_SIZE);
    
    // 더 로드할 항목이 있는지 확인
    updateDataState({ hasMoreNearbyItems: paginatedItems.length < allFiltered.length });
    
    return paginatedItems;
  } finally {
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('filter-nearby-places', startMark, endMark, 'interactions');
  }
}, [
  dataState.nearbyPlaces, 
  filters.nearby, 
  uiState.currentPage, 
  PAGE_SIZE,
  getFilteredAndSortedPlaces,
  updateDataState
]);

// 현재 활성화된 관심 지역의 장소 목록 - 페이지네이션 및 의존성 최적화
const filteredRegionPlaces = useMemo(() => {
  if (!dataState.activeRegion) return [];
  
  // 시작 마크 생성
  const startMark = `filter-region-places-start-${Date.now()}`;
  const endMark = `filter-region-places-end-${Date.now()}`;
  
  try {
    // 성능 측정 시작
    performance.mark(startMark);
    
    const regionKey = dataState.activeRegion.subRegion || dataState.activeRegion.region;
    
    // 필터링된 전체 장소 목록
    const allFiltered = getFilteredAndSortedPlaces(
      dataState.regionPlaces[regionKey], 
      filters.region, 
      false
    );
    
    // 무한 스크롤 모드에서는 현재 페이지까지의 아이템을 보여줌
    const paginatedItems = allFiltered.slice(0, uiState.currentPage * PAGE_SIZE);
    
    // 더 로드할 항목이 있는지 확인
    updateDataState({ hasMoreRegionItems: paginatedItems.length < allFiltered.length });
    
    return paginatedItems;
  } finally {
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('filter-region-places', startMark, endMark, 'interactions');
  }
}, [
  dataState.activeRegion, 
  dataState.regionPlaces, 
  filters.region, 
  uiState.currentPage, 
  PAGE_SIZE,
  getFilteredAndSortedPlaces,
  updateDataState
]);

// 관심 지역 탭에 표시할 총 장소 수 계산 - 최적화
const calculateTotalRegionPlaces = useCallback(() => {
  return Object.values(dataState.regionPlaces).reduce(
    (total, places) => total + (places?.length || 0), 
    0
  );
}, [dataState.regionPlaces]);

// 스켈레톤 로딩 UI 렌더링 함수 - 메모이제이션
const SkeletonLoader = React.memo(({ userProfile, animationEnabled }) => {
  return (
    <Container sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        맞춤 추천 장소
      </Typography>
      
      {/* 스켈레톤 탭 UI */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={0} aria-label="recommendation tabs">
          <Tab label="내 주변" />
          <Tab label="관심 지역" />
        </Tabs>
      </Box>
      
      {/* 스켈레톤 카드 그리드 */}
      <RecommendationList
        title="추천 장소 로딩 중..."
        loading={true}
        places={[]}
        userProfile={userProfile}
        animation={{ enabled: animationEnabled }}
      />
    </Container>
  );
});

// displayName 설정
SkeletonLoader.displayName = 'SkeletonLoader';

// renderSkeletonLoading 함수 참조
const renderSkeletonLoading = useCallback(() => {
  return <SkeletonLoader 
    userProfile={userProfile} 
    animationEnabled={uiState.animationEnabled} 
  />;
}, [userProfile, uiState.animationEnabled]);

// 컴포넌트 마운트/언마운트 시 위치 감시 시작/종료 - 최적화
useEffect(() => {
  // 위치 감시 시작 함수
  const startLocationWatch = () => {
    if (!dataState.locationPermissionGranted || !locationService.isLocationAvailable()) {
      return;
    }
    
    // 이미 감시 중인 경우 중복 실행 방지
    if (watchIdRef.current) {
      locationService.clearLocationWatch(watchIdRef.current);
    }
    
    // 위치 감시 시작
    watchIdRef.current = locationService.watchLocation(
      // 위치 변경 시 콜백
      (position) => {
        console.log("위치 정보 업데이트:", position.coords);
        updateDataState({
          userLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        });
      },
      // 옵션
      { 
        enableHighAccuracy: true, 
        maximumAge: 60000,
        onError: (error) => {
          console.error("위치 감시 오류:", error);
          // 오류 발생 시 처리 로직 추가
        }
      }
    );
    
    console.log("위치 감시 시작, ID:", watchIdRef.current);
  };
  
  // 위치 감시 종료 함수
  const stopLocationWatch = () => {
    if (watchIdRef.current) {
      console.log("위치 감시 종료, ID:", watchIdRef.current);
      locationService.clearLocationWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };
  
  // 위치 권한 있는 경우 감시 시작
  if (dataState.locationPermissionGranted) {
    startLocationWatch();
  }
  
  // 컴포넌트 언마운트 시 위치 감시 종료
  return stopLocationWatch;
}, [dataState.locationPermissionGranted, updateDataState]);

// 스크롤 이벤트 리스너 - 최적화 (throttle 적용)
useEffect(() => {
  // 스크롤 이벤트 throttle 함수
  const throttleScroll = (callback, delay = 100) => {
    let lastCall = 0;
    return () => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        callback();
      }
    };
  };
  
  const handleScroll = throttleScroll(() => {
    updateUiState({ showScrollTop: window.pageYOffset > 300 });
  });
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, [updateUiState]);

// 사용자 피드백 로드 (한 번만)
useEffect(() => {
  const loadUserFeedback = async () => {
    if (!user?.uid) return;
    
    try {
      const result = await getFeedbacksByUser(user.uid, { useCache: true });
      if (result.success) {
        console.log(`${result.data.length}개의 사용자 피드백 데이터 로드됨`);
        updateDataState({ feedbackData: result.data });
      }
    } catch (error) {
      console.error('사용자 피드백 로드 오류:', error);
    }
  };
  
  loadUserFeedback();
}, [user, updateDataState]);

// 컴포넌트 마운트 시 관심 지역 추천 로드 - 최적화
useEffect(() => {
  const loadRegionData = async () => {
    if (!userProfile) return;
    
    updateUiState({ loading: true, error: null });
    
    // 관심 지역 추천 로드
    await loadRegionRecommendations();
    
    // 라우터 state에서 전달된 파라미터 처리
    if (location.state) {
      // 필터 타입이 전달된 경우 해당 탭 활성화
      if (location.state.filterType === 'nearby') {
        updateUiState({ activeTab: 0 });
      } else if (location.state.filterType === 'region') {
        updateUiState({ activeTab: 1 });
        
        // 특정 지역이 전달된 경우 해당 지역 활성화
        if (location.state.region && userProfile?.preferredLocations) {
          const matchedRegion = userProfile.preferredLocations.find(
            r => r.region === location.state.region || r.subRegion === location.state.region
          );
          
          if (matchedRegion) {
            updateDataState({ activeRegion: matchedRegion });
          }
        }
      }
      
      // 감정 상태 설정 다이얼로그 열기 요청이 있는 경우
      if (location.state.openMoodDialog) {
        updateUiState({ moodDialogOpen: true });
      }
      
      // 감정 상태 필터가 전달된 경우
      if (location.state.mood) {
        // 해당 감정 상태 필터 적용
        updateFilters('nearby', 'mood', location.state.mood);
        updateFilters('region', 'mood', location.state.mood);
      }
    }
    
    // 위치 권한이 없고 관심 지역도 없는 경우 로딩 상태 해제
    if (!dataState.locationPermissionGranted && !userProfile?.preferredLocations?.length) {
      updateUiState({ loading: false });
    }
  };
  
  loadRegionData();
}, [
  userProfile, 
  loadRegionRecommendations, 
  location.state, 
  dataState.locationPermissionGranted, 
  updateUiState,
  updateDataState,
  updateFilters
]);

// 위치 권한 및 위치 정보가 변경될 때 내 주변 추천 로드 - 최적화
useEffect(() => {
  const loadNearbyRecommendations = async () => {
    if (!userProfile) return;
    
    // 로딩 상태 설정 (내 주변 탭이 활성화된 경우에만)
    if (uiState.activeTab === 0) {
      updateUiState({ loading: true, error: null });
    } else {
      updateUiState({ error: null });
    }
    
    try {
      let locationToUse;
      let radiusInMeters = 5000; // 기본 반경 5km
      
      if (dataState.locationPermissionGranted && dataState.userLocation) {
        // 실제 위치 정보 사용
        console.log("실제 위치 정보로 추천 로드:", dataState.userLocation);
        locationToUse = dataState.userLocation;
      } else {
        // 위치 권한이 없는 경우 서울 중심점 사용 (폴백)
        console.log("위치 권한 없음, 서울 중심점 사용");
        locationToUse = { 
          latitude: 37.5665, 
          longitude: 126.9780 // 서울 중심점
        };
        // 폴백 위치는 더 넓은 반경 사용
        radiusInMeters = 10000; // 10km
      }
      
      // 성능 측정 시작
      const startMark = `load-nearby-recommendations-start-${Date.now()}`;
      const endMark = `load-nearby-recommendations-end-${Date.now()}`;
      performance.mark(startMark);
      
      // 추천 가져오기
      const nearbyResult = await getNearbyRecommendations(
        userProfile,
        locationToUse,
        radiusInMeters,
        {
          useCache: dataState.useCachedData,
          userId: user?.uid || 'anonymous',
          filters: filters.nearby
        }
      );
      
      if (nearbyResult.success) {
        console.log(`${nearbyResult.data.length}개의 추천 장소를 가져왔습니다.`);
        
        if (nearbyResult.fromCache) {
          console.log('캐시된 데이터 사용됨');
        }
        
        if (nearbyResult.data.length > 0) {
          // 추천 결과에 사용자 피드백 조정 적용
          if (dataState.feedbackData?.length > 0) {
            const adjustedPlaces = recommendationUtils.adjustForUserFeedback(
              nearbyResult.data, 
              dataState.feedbackData
            );
            
            // 재정렬 (피드백 조정 반영)
            adjustedPlaces.sort((a, b) => b.matchScore - a.matchScore);
            
            updateDataState({
              nearbyPlaces: adjustedPlaces,
              hasMoreNearbyItems: adjustedPlaces.length > PAGE_SIZE
            });
          } else {
            updateDataState({
              nearbyPlaces: nearbyResult.data,
              hasMoreNearbyItems: nearbyResult.data.length > PAGE_SIZE
            });
          }
        } else {
          // 추천 결과가 없는 경우 더미 데이터 생성
          console.log("추천 결과가 없어 더미 데이터를 사용합니다.");
          const dummyPlaces = createDummyPlaces(8);
          updateDataState({
            nearbyPlaces: dummyPlaces,
            hasMoreNearbyItems: false
          });
        }
      } else {
        console.error("Failed to get recommendations:", nearbyResult.error);
        // 오류 발생 시 더미 데이터 설정
        const dummyPlaces = createDummyPlaces(8);
        updateDataState({
          nearbyPlaces: dummyPlaces,
          hasMoreNearbyItems: false
        });
      }
      
      // 성능 측정 종료
      performance.mark(endMark);
      measurePerformance('load-nearby-recommendations', startMark, endMark, 'interactions');
    } catch (err) {
      console.error("Error in loadNearbyRecommendations:", err);
      // 심각한 오류 발생 시에도 더미 데이터 설정
      const dummyPlaces = createDummyPlaces(8);
      updateDataState({
        nearbyPlaces: dummyPlaces,
        hasMoreNearbyItems: false
      });
    } finally {
      updateUiState({ loading: false, currentPage: 1 }); 
    }
  };
  
  // 위치 권한 및 위치 정보가 변경될 때 내 주변 추천 로드
  loadNearbyRecommendations();
}, [
  userProfile,
  dataState.locationPermissionGranted,
  dataState.userLocation,
  dataState.useCachedData,
  dataState.feedbackData,
  uiState.activeTab,
  filters.nearby,
  user,
  PAGE_SIZE,
  updateDataState,
  updateUiState
]);

// 스켈레톤 UI 표시 시에는 PullToRefresh 적용하지 않음
if (uiState.loading) {
  return renderSkeletonLoading();
}

// 에러가 있고 관심 지역이 없을 때 에러 메시지 표시
if (uiState.error && !userProfile?.preferredLocations?.length) {
  return (
    <Container sx={{ my: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Alert severity="error" sx={{ display: 'flex', alignItems: 'center' }}>
          {uiState.error}
          <Button 
            size="small" 
            color="inherit" 
            sx={{ ml: 2 }} 
            onClick={handleRefreshLocation}
          >
            다시 시도
          </Button>
        </Alert>
      </motion.div>
    </Container>
  );
}

// 메인 렌더링 로직 - PullToRefresh 컴포넌트로 감싸기
return (
  <PullToRefresh 
    onRefresh={handleRefreshData}
    disabled={uiState.refreshing}
    containerProps={{ sx: { minHeight: '100vh', position: 'relative' } }}
  >
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Container sx={{ my: 4 }}>

      <Box sx={{ mb: 4 }}>
            <motion.div
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
            >
              <Typography variant="h4" component="h1" gutterBottom>
                맞춤 추천 장소
              </Typography>
            </motion.div>
          </Box>
          
          {uiState.error && (
            <motion.div
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
            >
              <Alert severity="warning" sx={{ mb: 3 }}>
                {uiState.error}
                {userProfile?.preferredLocations?.length > 0 && 
                  " 관심 지역 추천은 이용 가능합니다."}
              </Alert>
            </motion.div>
          )}
          
          {!dataState.locationPermissionGranted && uiState.activeTab === 0 && (
            <motion.div
              variants={scaleVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
            >
              <LocationPermission 
                onLocationGranted={handleLocationGranted}
                onLocationDenied={handleLocationDenied}
                requirePermission={false}
                autoRequest={true}
                buttonText="내 주변 추천을 보려면 위치 권한을 허용해주세요"
                showDialog={true}
                buttonVariant="contained"
                buttonColor="primary"
                buttonSize="medium"
              />
            </motion.div>
          )}
          
          {/* 위치 상태 표시 (선택적으로 표시) */}
          {dataState.locationPermissionGranted && dataState.userLocation && (
            <motion.div
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button 
                  variant="text" 
                  color="primary" 
                  size="small"
                  startIcon={<LocationOnIcon />}
                  onClick={() => updateUiState(prev => ({ 
                    ...prev, 
                    showLocationStatus: !prev.showLocationStatus 
                  }))}
                >
                  {uiState.showLocationStatus ? "위치 상태 숨기기" : "위치 상태 표시"}
                </Button>
              </Box>
              
              <AnimatePresence>
                {uiState.showLocationStatus && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <LocationStatus 
                      userLocation={dataState.userLocation}
                      permissionGranted={dataState.locationPermissionGranted}
                      onRefresh={handleRefreshLocation}
                      variant="detailed"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          
          {/* 상단 컨트롤 영역 */}
          <motion.div
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
          >
            {/* 새로고침 버튼 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<CachedIcon />}
                onClick={handleRefreshData}
                disabled={uiState.refreshing}
                sx={{ mr: 1 }}
              >
                {uiState.refreshing ? (
                  <>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    새로고침 중...
                  </>
                ) : (
                  '데이터 새로고침'
                )}
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<TuneIcon />}
                onClick={handleToggleFilters}
                sx={{ fontWeight: uiState.showFilters ? 'bold' : 'normal' }}
              >
                필터 {uiState.showFilters ? '숨기기' : '보기'}
              </Button>
            </Box>
          </motion.div>

           {/* 탭 UI */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <motion.div
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
            >
              <Tabs 
                value={uiState.activeTab} 
                onChange={handleTabChange}
                variant="fullWidth"
                aria-label="recommendation tabs"
                sx={{
                  '& .MuiTab-root': {
                    fontWeight: 'medium',
                    transition: 'all 0.3s',
                    py: 1.5
                  },
                  '& .Mui-selected': {
                    fontWeight: 'bold'
                  }
                }}
              >
                <Tab 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocationOnIcon sx={{ mr: 0.5, fontSize: 20 }} />
                      <span>내 주변</span>
                      <Chip 
                        label={filteredNearbyPlaces.length} 
                        size="small" 
                        color="primary"
                        sx={{ ml: 1, height: 20, minWidth: 20 }} 
                      />
                    </Box>
                  }
                  id="tab-0"
                  aria-controls="tabpanel-0"
                  disabled={!dataState.nearbyPlaces.length && userProfile?.preferredLocations?.length > 0}
                />
                <Tab 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <FavoriteIcon sx={{ mr: 0.5, fontSize: 20 }} />
                      <span>관심 지역</span>
                      <Chip 
                        label={calculateTotalRegionPlaces()} 
                        size="small" 
                        color="secondary"
                        sx={{ ml: 1, height: 20, minWidth: 20 }} 
                      />
                    </Box>
                  }
                  id="tab-1"
                  aria-controls="tabpanel-1"
                  disabled={Object.keys(dataState.regionPlaces).length === 0}
                />
              </Tabs>
            </motion.div>
          </Box>
          
          {/* 뷰 모드 및 필터 컨트롤 */}
          <motion.div
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.5 }}
          >
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <ToggleButtonGroup
                  value={uiState.viewMode}
                  exclusive
                  onChange={handleViewModeChange}
                  aria-label="view mode"
                  size="small"
                >
                  <ToggleButton value="list" aria-label="list view">
                    <ViewListIcon />
                  </ToggleButton>
                  <ToggleButton value="map" aria-label="map view">
                    <MapIcon />
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {/* 감정 상태 필터 버튼 */}
                <Button
                  startIcon={<MoodIcon />}
                  color="secondary"
                  size="small"
                  onClick={() => updateUiState({ moodDialogOpen: true })}
                  sx={{ ml: 2 }}
                >
                  감정 상태 설정
                </Button>
              </Box>
            </Box>
          </motion.div>

          {/* 필터 패널 */}
          <div ref={filtersRef}>
            <AnimatePresence>
              {uiState.showFilters && (
                <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                    필터 설정
                  </Typography>
                  
                  {uiState.activeTab === 0 ? (
                    <EnhancedFilters
                      filters={filters.nearby}
                      onFilterChange={handleNearbyFilterChange}
                      isNearby={true}
                      stats={nearbyStats}
                      animation={{ enabled: uiState.animationEnabled }}
                    />
                  ) : (
                    <EnhancedFilters
                      filters={filters.region}
                      onFilterChange={handleRegionFilterChange}
                      isNearby={false}
                      stats={regionStats}
                      animation={{ enabled: uiState.animationEnabled }}
                    />
                  )}
                </Paper>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 내 주변 탭 패널 */}
        <div
            role="tabpanel"
            hidden={uiState.activeTab !== 0}
            id="tabpanel-0"
            aria-labelledby="tab-0"
          >
            <AnimatePresence mode="wait">
              {uiState.activeTab === 0 && (
                <motion.div
                  key="nearby-panel"
                  variants={fadeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {uiState.viewMode === 'list' ? (
                    // PagedList 적용 부분 (내 주변)
                    <Box sx={{ mt: 3 }} ref={listContainerRef}>
                      {/* 기존 RecommendationList 컴포넌트 사용 */}
                      <RecommendationList
                        places={filteredNearbyPlaces}
                        userProfile={userProfile}
                        title="내 주변 추천 장소"
                        loading={uiState.loading && uiState.activeTab === 0}
                        isNearby={true}
                        filters={filters.nearby}
                        onFilterChange={handleNearbyFilterChange}
                        animation={{ 
                          enabled: uiState.animationEnabled,
                          stagger: true,
                          fadeIn: true
                        }}
                      />
                      
                      {/* 더보기 버튼 */}
                      <AnimatePresence>
                        {dataState.hasMoreNearbyItems && !uiState.loading && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                              <Button
                                variant="outlined"
                                onClick={handleLoadMoreNearbyItems}
                                disabled={dataState.loadingMore}
                                endIcon={dataState.loadingMore ? null : <KeyboardArrowUpIcon sx={{ transform: 'rotate(90deg)' }} />}
                              >
                                {dataState.loadingMore ? (
                                  <>
                                    <CircularProgress size={16} sx={{ mr: 1 }} />
                                    불러오는 중...
                                  </>
                                ) : (
                                  '더 보기'
                                )}
                              </Button>
                            </Box>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Box>
                  ) : (
                    <Box ref={mapContainerRef}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <Paper elevation={2} sx={{ 
                          p: 2, 
                          mb: 3, 
                          height: isMobile ? '60vh' : '70vh',
                          borderRadius: 2,
                          overflow: 'hidden'
                        }}>
                          <Typography variant="h6" component="h2" gutterBottom>
                            내 주변 추천 장소 지도
                          </Typography>
                          <RecommendationMap 
                            places={filteredNearbyPlaces}
                            userLocation={dataState.userLocation}
                            onPlaceSelect={(placeId) => {
                              if (placeId) {
                                window.location.href = `/place/${placeId}`;
                              }
                            }}
                            loading={uiState.loading}
                            animation={{ enabled: uiState.animationEnabled }}
                          />
                        </Paper>
                      </motion.div>
                    </Box>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 관심 지역 탭 패널 */}
          <div
            role="tabpanel"
            hidden={uiState.activeTab !== 1}
            id="tabpanel-1"
            aria-labelledby="tab-1"
          >
            <AnimatePresence mode="wait">
              {uiState.activeTab === 1 && (
                <motion.div
                  key="region-panel"
                  variants={fadeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {/* 관심 지역 선택 칩 목록 */}
                  {userProfile?.preferredLocations?.length > 0 && (
                    <motion.div
                      variants={staggerContainerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {userProfile.preferredLocations.map((region, index) => {
                          const regionName = region.subRegion || region.region;
                          const isActive = dataState.activeRegion?.subRegion === region.subRegion 
                            && dataState.activeRegion?.region === region.region;
                          
                          return (
                            <motion.div
                              key={index}
                              variants={slideUpVariants}
                              whileHover={{ y: -2, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <Box 
                                onClick={() => handleRegionChange(region)}
                                sx={{
                                  px: 2,
                                  py: 1,
                                  borderRadius: 2,
                                  cursor: 'pointer',
                                  backgroundColor: isActive ? 'primary.main' : 'background.paper',
                                  color: isActive ? 'primary.contrastText' : 'text.primary',
                                  border: 1,
                                  borderColor: isActive ? 'primary.main' : 'divider',
                                  '&:hover': {
                                    backgroundColor: isActive ? 'primary.dark' : 'action.hover',
                                  },
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Typography variant="body2">
                                  {regionName}
                                </Typography>
                                {isActive && (
                                  <Badge
                                    color="secondary"
                                    variant="dot"
                                    sx={{ ml: 1 }}
                                  />
                                )}
                              </Box>
                            </motion.div>
                          );
                        })}
                      </Box>
                    </motion.div>
                  )}
                  
                  {dataState.activeRegion && (
                    uiState.viewMode === 'list' ? (
                      <Box sx={{ mt: 3 }} ref={listContainerRef}>
                        {/* 기존 RecommendationList 컴포넌트 사용 */}
                        <RecommendationList
                          places={filteredRegionPlaces}
                          userProfile={userProfile}
                          title={`${dataState.activeRegion.subRegion || dataState.activeRegion.region} 추천 장소`}
                          loading={uiState.loading && uiState.activeTab === 1}
                          isNearby={false}
                          filters={filters.region}
                          onFilterChange={handleRegionFilterChange}
                          animation={{ 
                            enabled: uiState.animationEnabled,
                            stagger: true,
                            fadeIn: true
                          }}
                        />
                        
                        {/* 더보기 버튼 */}
                        <AnimatePresence>
                          {dataState.hasMoreRegionItems && !uiState.loading && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 20 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                                <Button
                                  variant="outlined"
                                  onClick={handleLoadMoreRegionItems}
                                  disabled={dataState.loadingMore}
                                  endIcon={dataState.loadingMore ? null : <KeyboardArrowUpIcon sx={{ transform: 'rotate(90deg)' }} />}
                                >
                                  {dataState.loadingMore ? (
                                    <>
                                      <CircularProgress size={16} sx={{ mr: 1 }} />
                                      불러오는 중...
                                    </>
                                  ) : (
                                    '더 보기'
                                  )}
                                </Button>
                              </Box>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Box>
                    ) : (
                      <Box ref={mapContainerRef}>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4 }}
                        >
                          <Paper elevation={2} sx={{ 
                            p: 2, 
                            mb: 3, 
                            height: isMobile ? '60vh' : '70vh',
                            borderRadius: 2,
                            overflow: 'hidden'
                          }}>
                            <Typography variant="h6" component="h2" gutterBottom>
                              {dataState.activeRegion.subRegion || dataState.activeRegion.region} 추천 장소 지도
                            </Typography>
                            <RecommendationMap 
                              places={filteredRegionPlaces}
                              userLocation={dataState.activeRegion.coordinates}
                              onPlaceSelect={(placeId) => {
                                if (placeId) {
                                  window.location.href = `/place/${placeId}`;
                                }
                              }}
                              loading={uiState.loading}
                              animation={{ enabled: uiState.animationEnabled }}
                            />
                          </Paper>
                        </motion.div>
                      </Box>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 맨 위로 스크롤 버튼 */}
          <Zoom in={uiState.showScrollTop}>
            <Fab
              color="primary"
              size="small"
              aria-label="scroll back to top"
              onClick={handleScrollToTop}
              sx={{ 
                position: 'fixed', 
                bottom: isMobile ? 70 : 16, 
                right: 16,
                zIndex: 10
              }}
            >
              <KeyboardArrowUpIcon />
            </Fab>
          </Zoom>
          
          {/* 감정 상태 변경 다이얼로그 */}
          <Dialog 
            open={uiState.moodDialogOpen} 
            onClose={handleCloseMoodDialog}
            TransitionComponent={Fade}
            PaperProps={{
              sx: {
                borderRadius: 2,
                maxWidth: 'sm',
                width: '100%'
              }
            }}
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <MoodIcon sx={{ mr: 1 }} />
                감정 상태 변경
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend">현재 감정 상태를 선택해주세요</FormLabel>
                <RadioGroup value={dataState.selectedMood} onChange={handleMoodChange}>
                  {['기쁨', '스트레스', '피곤함', '설렘', '평온함'].map((mood) => (
                    <FormControlLabel 
                      key={mood}
                      value={mood} 
                      control={<Radio />} 
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {moodIcons[mood]}
                          <Typography sx={{ ml: 1 }}>{mood}</Typography>
                        </Box>
                      } 
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseMoodDialog}>취소</Button>
              <Button 
                onClick={handleSaveMood} 
                variant="contained" 
                color="primary"
                disabled={!dataState.selectedMood}
                startIcon={dataState.selectedMood ? moodIcons[dataState.selectedMood] : null}
              >
                적용하기
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* 알림 메시지 스낵바 */}
          <Snackbar
            open={uiState.snackbarOpen}
            autoHideDuration={3000}
            onClose={() => updateUiState({ snackbarOpen: false })}
            message={uiState.snackbarMessage}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ 
              bottom: isMobile ? 56 : 16, // 모바일에서는 하단 네비바 위에 표시
              zIndex: theme.zIndex.snackbar
            }}
          />
        </Container>
      </motion.div>
    </PullToRefresh>
  );
};

export default Recommendations;
