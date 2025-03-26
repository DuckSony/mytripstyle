// src/pages/SavedPlaces.js
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSavedPlaces } from '../contexts/SavedPlacesContext';
import { useAuth } from '../contexts/AuthContext';
import RecommendationCard from '../components/recommendation/RecommendationCard';
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  Paper,
  Chip,
  InputAdornment,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  Fade,
  Button,
  Snackbar,
  Alert,
  Badge,
  Tooltip,
  useMediaQuery,
  useTheme,
  alpha,
  List,
  Card,
  CardActionArea,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItemIcon,
  ListItemText,
  Stack
} from '@mui/material';
import { 
  Favorite as FavoriteIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
  SyncProblem as SyncProblemIcon,
  DeleteOutline as DeleteIcon,
  Restaurant as RestaurantIcon,
  LocalCafe as CafeIcon,
  Museum as CultureIcon,
  Park as NatureIcon,
  DirectionsRun as ActivityIcon,
  Spa as HealingIcon,
  FolderSpecial as DefaultIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Category as CategoryIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';

// 애니메이션과 제스처 관련 라이브러리
import { motion, LayoutGroup } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

// 컴포넌트 및 유틸리티
import InfiniteScroll from '../components/common/InfiniteScroll';
import PullToRefresh from '../components/common/PullToRefresh';
// startPerformanceMeasure 대신 measurePerformance 사용
import { measurePerformance } from '../utils/optimizationUtils';

// 애니메이션 설정
const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.4 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

// 카테고리 색상 매핑
const categoryColors = {
  'cafe': '#8d6e63', // 브라운
  'restaurant': '#ff7043', // 오렌지
  'culture': '#5c6bc0', // 인디고
  'nature': '#66bb6a', // 그린
  'activity': '#ffca28', // 앰버
  'healing': '#26a69a', // 청록색
  'default': '#78909c' // 기본 블루그레이
};

// 카테고리 한글명 매핑
const categoryNames = {
  'cafe': '카페 & 음료점',
  'restaurant': '식당 & 음식점',
  'culture': '문화 & 예술 공간',
  'nature': '자연 & 야외 공간',
  'activity': '활동 & 체험 장소',
  'healing': '휴식 & 힐링 장소',
  'default': '기타'
};

// 카테고리 아이콘 매핑
const categoryIcons = {
  'cafe': <CafeIcon />,
  'restaurant': <RestaurantIcon />,
  'culture': <CultureIcon />,
  'nature': <NatureIcon />,
  'activity': <ActivityIcon />,
  'healing': <HealingIcon />,
  'default': <DefaultIcon />
};

// 사용자 정의 EmptyState 컴포넌트
const EmptyState = ({ 
  icon, 
  title, 
  description, 
  actionButtons = [],
  animationVariants = null
}) => {
  return (
    <motion.div
      initial={animationVariants?.hidden || { opacity: 0 }}
      animate={animationVariants?.visible || { opacity: 1 }}
      exit={animationVariants?.exit || { opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center'
        }}
      >
        {icon && (
          <Box sx={{ mb: 3, color: 'text.secondary' }}>
            {icon}
          </Box>
        )}
        
        {title && (
          <Typography variant="h5" component="h2" gutterBottom>
            {title}
          </Typography>
        )}
        
        {description && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
            {description}
          </Typography>
        )}
        
        {actionButtons.length > 0 && (
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {actionButtons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant || "outlined"}
                color={button.color || "primary"}
                size={button.size || "medium"}
                startIcon={button.icon}
                onClick={button.onClick}
                disabled={button.disabled}
              >
                {button.label}
              </Button>
            ))}
          </Stack>
        )}
      </Box>
    </motion.div>
  );
};

// 유틸리티 함수: 평점 포맷
const getFormattedRating = (rating) => {
  if (rating === undefined || rating === null) return null;
  const numRating = Number(rating);
  if (isNaN(numRating)) return null;
  return numRating.toFixed(1);
};

const SavedPlaces = () => {
  // 테마 및 반응형 설정
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    
  // 페이지 성능 측정 시작
  // 성능 측정 시작 마크
  const startRenderMark = `savedPlaces-render-start-${Date.now()}`;
  const endRenderMark = `savedPlaces-render-end-${Date.now()}`;
  performance.mark(startRenderMark);
  
  // 컴포넌트 언마운트 시 성능 측정 종료 함수 정의
  const endRenderMeasure = () => {
    performance.mark(endRenderMark);
    measurePerformance('SavedPlaces 렌더링', startRenderMark, endRenderMark, 'renders');
  };
  
  // 컨텍스트에서 저장된 장소 데이터 가져오기
  const { 
    savedPlaces, 
    loading, 
    error, 
    refreshData,
    syncSavedPlaces, 
    resetDataState,
    deleteSavedPlace
  } = useSavedPlaces();
  
  const { isAuthenticated, currentUser } = useAuth();
  
  // 참조 생성 - 스크롤 위치 및 애니메이션 제어용
  const listContainerRef = useRef(null);
  const headerRef = useRef(null);
  const searchInputRef = useRef(null);
  
  // 기본 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [sortBy, setSortBy] = useState('date'); // 'date', 'name', 'rating'
  const [viewMode, setViewMode] = useState(isMobile ? 'grid' : 'group'); // 'grid', 'list', 'group'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // 무한 스크롤을 위한 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // 애니메이션 관련 상태
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [loadedItems, setLoadedItems] = useState([]);
  
  // 한 페이지에 표시할 아이템 수
  const PAGE_SIZE = 9; // 3x3 그리드
  
  // 모달 상태
  const sortOpen = Boolean(sortAnchorEl);
  const moreMenuOpen = Boolean(moreMenuAnchorEl);
  const dataLoadAttempted = useRef(false); // 데이터 로드 시도 여부 추적
  
  // Intersection Observer를 사용하여 요소의 가시성 감지
  const [categoryHeaderRef] = useInView({
    threshold: 0,
    triggerOnce: false
  });

 // 카테고리 색상 가져오기
 const getCategoryColor = useCallback((category) => {
  return categoryColors[category] || categoryColors.default;
}, []);

// 카테고리 아이콘 가져오기
const getCategoryIcon = useCallback((category) => {
  return categoryIcons[category] || categoryIcons.default;
}, []);

// 필터링된 장소 목록 - 검색어 및 카테고리별 필터링
const filteredPlaces = useMemo(() => {
  if (!savedPlaces || !Array.isArray(savedPlaces)) return [];
  
  // 성능 측정 시작
  const startFilterMark = `places-filter-start-${Date.now()}`;
  const endFilterMark = `places-filter-end-${Date.now()}`;
  performance.mark(startFilterMark);
  
  console.log("SavedPlaces - Filtering places");
  
  // 검색어 및 카테고리 필터링
  let filtered = [...savedPlaces];
  
  // 검색어 필터링
  if (searchTerm.trim()) {
    const searchTermLower = searchTerm.trim().toLowerCase();
    filtered = filtered.filter(place => {
      if (!place) return false;
      
      // 이름, 설명, 카테고리, 주소 등 검색
      return (
        (place.name && place.name.toLowerCase().includes(searchTermLower)) ||
        (place.description && place.description.toLowerCase().includes(searchTermLower)) ||
        (place.category && categoryNames[place.category] && 
         categoryNames[place.category].toLowerCase().includes(searchTermLower)) ||
        (place.address && place.address.toLowerCase().includes(searchTermLower)) ||
        (place.region && place.region.toLowerCase().includes(searchTermLower)) ||
        (place.subRegion && place.subRegion.toLowerCase().includes(searchTermLower))
      );
    });
  }
  
  // 카테고리 필터링
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(place => 
      place && place.category === selectedCategory
    );
  }
  
  // 정렬 적용
  if (sortBy === 'date') {
    // 날짜 기준 내림차순 (최신순)
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      if (!a.timestamp) return 1; // timestamp 없으면 맨 뒤로
      if (!b.timestamp) return -1;
      return b.timestamp - a.timestamp;
    });
  } else if (sortBy === 'name') {
    // 이름 기준 오름차순
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      if (!a.name) return 1; // 이름 없으면 맨 뒤로
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });
  } else if (sortBy === 'rating') {
    // 평점 기준 내림차순
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      const ratingA = a.averageRating || 0;
      const ratingB = b.averageRating || 0;
      return ratingB - ratingA;
    });
  }
  
  // 성능 측정 종료
  performance.mark(endFilterMark);
  measurePerformance('장소 필터링', startFilterMark, endFilterMark, 'interactions');
  
  return filtered;
}, [savedPlaces, searchTerm, selectedCategory, sortBy]);

// 현재 페이지에 표시할 장소 목록
const paginatedPlaces = useMemo(() => {
  return filteredPlaces.slice(0, currentPage * PAGE_SIZE);
}, [filteredPlaces, currentPage, PAGE_SIZE]);

// 애니메이션을 적용할 현재 표시할 장소 목록
const visiblePlaces = useMemo(() => {
  if (!animationEnabled) return paginatedPlaces;
  
  // 로드된 ID 목록에 있는 항목만 표시
  return paginatedPlaces.filter(place => 
    loadedItems.includes(place.id)
  );
}, [paginatedPlaces, loadedItems, animationEnabled]);

// 카테고리별 그룹화된 장소 목록 - 성능 측정 추가
const groupedPlaces = useMemo(() => {
  // 성능 측정 시작
  const startGroupMark = `places-group-start-${Date.now()}`;
  const endGroupMark = `places-group-end-${Date.now()}`;
  performance.mark(startGroupMark);
  
  console.log("SavedPlaces - Grouping filtered places");
  if (!filteredPlaces.length) {
    performance.mark(endGroupMark);
    measurePerformance('장소 그룹화', startGroupMark, endGroupMark, 'interactions');
    return {};
  }
  
  const result = filteredPlaces.reduce((groups, place) => {
    if (!place) return groups;
    const category = place.category || 'default';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(place);
    return groups;
  }, {});
  
  // 성능 측정 종료
  performance.mark(endGroupMark);
  measurePerformance('장소 그룹화', startGroupMark, endGroupMark, 'interactions');
  
  return result;
}, [filteredPlaces]);

// 그룹 순서 결정 - 카테고리 순으로 정렬
const groupOrder = useMemo(() => {
  const order = Object.keys(groupedPlaces);
  // 카테고리 이름 기준 정렬
  return order.sort((a, b) => {
    return (categoryNames[a] || a).localeCompare(categoryNames[b] || b);
  });
}, [groupedPlaces]);

// 카테고리 통계 - 각 카테고리별 장소 개수
const categoryStats = useMemo(() => {
  if (!savedPlaces || !Array.isArray(savedPlaces)) return {};
  
  const stats = { all: savedPlaces.length };
  
  savedPlaces.forEach(place => {
    if (!place) return;
    const category = place.category || 'default';
    if (!stats[category]) {
      stats[category] = 0;
    }
    stats[category]++;
  });
  
  return stats;
}, [savedPlaces]);

// 사용 가능한 카테고리 목록 - 통계에서 사용된 카테고리만 포함
const categories = useMemo(() => {
  const cats = ['all', ...Object.keys(categoryStats).filter(cat => cat !== 'all')];
  // default 카테고리는 항상 마지막에 표시
  if (cats.includes('default')) {
    const index = cats.indexOf('default');
    cats.splice(index, 1);
    cats.push('default');
  }
  return cats;
}, [categoryStats]);

// 성능 최적화를 위한 애니메이션 활성화 상태 확인
useEffect(() => {
  // 첫 로딩 후 5초 후에 프레임 레이트 체크
  const timer = setTimeout(() => {
    let lastTime = performance.now();
    let frames = 0;
    let totalDelta = 0;
    
    const checkFrame = (now) => {
      frames++;
      const delta = now - lastTime;
      totalDelta += delta;
      lastTime = now;
      
      if (frames >= 10) {
        const avgFPS = 1000 / (totalDelta / frames);
        // 30fps 이하면 애니메이션 비활성화
        if (avgFPS < 30) {
          console.log('Low FPS detected, disabling animations');
          setAnimationEnabled(false);
        }
        return;
      }
      
      requestAnimationFrame(checkFrame);
    };
    
    requestAnimationFrame(checkFrame);
  }, 5000);
  
  return () => clearTimeout(timer);
}, []);

// paginatedPlaces가 업데이트된 후 loadedItems 초기화 로직 추가
useEffect(() => {
  if (paginatedPlaces.length > 0 && loadedItems.length === 0) {
    console.log("SavedPlaces - 데이터 로드 후 loadedItems 초기화");
    
    // 페이지에 표시할 모든 장소의 ID를 loadedItems에 추가
    const allPlaceIds = paginatedPlaces.map(place => place.id || place.placeId);
    
    // 애니메이션 효과를 위해 점진적으로 추가
    if (animationEnabled) {
      // 첫 번째 아이템은 즉시 추가
      setLoadedItems([allPlaceIds[0]]);
      
      // 나머지 아이템은 약간의 지연 후 추가
      for (let i = 1; i < allPlaceIds.length; i++) {
        setTimeout(() => {
          setLoadedItems(prev => [...prev, allPlaceIds[i]]);
        }, i * 50); // 각 아이템마다 50ms 지연
      }
    } else {
      // 애니메이션 없이 한번에 모든 아이템 추가
      setLoadedItems(allPlaceIds);
    }
  }
}, [paginatedPlaces, loadedItems.length, animationEnabled]);

// 초기 렌더링이 끝난 후 측정 완료
useEffect(() => {
  return () => endRenderMeasure();
}, []);

// 사용자 인증 및 초기 데이터 로드
useEffect(() => {
  if (isAuthenticated && currentUser && !dataLoadAttempted.current) {
    // 성능 측정 시작
    const startInitMark = `savedPlaces-init-start-${Date.now()}`;
    const endInitMark = `savedPlaces-init-end-${Date.now()}`;
    performance.mark(startInitMark);
    
    console.log("SavedPlaces - 인증된 사용자, 초기 데이터 로드 시작");
    
    // 데이터 로드 시도 표시
    dataLoadAttempted.current = true;
    
    // 잠시 지연 후 데이터 로드 (UI 렌더링 후)
    setTimeout(() => {
      handleManualRefresh();
      
      // 성능 측정 종료
      performance.mark(endInitMark);
      measurePerformance('SavedPlaces 초기화', startInitMark, endInitMark, 'interactions');
    }, 1000);
  }
}, [isAuthenticated, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

// 뷰 모드 변경 시 애니메이션 재설정
useEffect(() => {
  // 뷰 모드 변경 시 로드된 아이템 초기화 (애니메이션 재적용)
  setLoadedItems([]);
  setTimeout(() => {
    // 이미 로드된 아이템 표시
    const idsToLoad = filteredPlaces.slice(0, PAGE_SIZE * currentPage).map(place => place.id);
    setLoadedItems(idsToLoad);
  }, 100);
}, [viewMode, filteredPlaces, PAGE_SIZE, currentPage]);

// 스낵바 닫기 핸들러
const handleCloseSnackbar = () => {
  setSnackbar({ ...snackbar, open: false });
};

// 검색어 변경 핸들러
const handleSearchChange = (event) => {
  setSearchTerm(event.target.value);
  setCurrentPage(1); // 검색어 변경 시 페이지 초기화
  setLoadedItems([]); // 애니메이션 재설정
};

// 검색어 클리어 핸들러
const handleClearSearch = () => {
  setSearchTerm('');
  setCurrentPage(1); // 검색어 초기화 시 페이지 초기화
  setLoadedItems([]); // 애니메이션 재설정
  
  // 검색 입력란에 포커스
  if (searchInputRef.current) {
    searchInputRef.current.focus();
  }
};

// 검색 입력란 키 이벤트 핸들러
const handleSearchKeyDown = (event) => {
  if (event.key === 'Escape') {
    handleClearSearch();
  }
};

// 카테고리 탭 변경 핸들러 - 애니메이션 추가
const handleCategoryChange = (event, newValue) => {
  // 성능 측정 시작
  const startCategoryChangeMark = `category-change-start-${Date.now()}`;
  const endCategoryChangeMark = `category-change-end-${Date.now()}`;
  performance.mark(startCategoryChangeMark);
  
  setSelectedCategory(newValue);
  setCurrentPage(1); // 카테고리 변경 시 페이지 초기화
  setLoadedItems([]); // 애니메이션 재설정
  
  // 카테고리 변경 시 스크롤 맨 위로
  setTimeout(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, 100);
  
  // 성능 측정 종료
  performance.mark(endCategoryChangeMark);
  measurePerformance('카테고리 변경', startCategoryChangeMark, endCategoryChangeMark, 'interactions');
};

// 정렬 메뉴 열기
const handleSortClick = (event) => {
  setSortAnchorEl(event.currentTarget);
};

// 정렬 메뉴 닫기
const handleSortClose = () => {
  setSortAnchorEl(null);
};

// 정렬 옵션 선택 - 애니메이션 추가
const handleSortSelect = (option) => {
  // 성능 측정 시작
  const startSortMark = `sort-apply-start-${Date.now()}`;
  const endSortMark = `sort-apply-end-${Date.now()}`;
  performance.mark(startSortMark);
  
  setSortBy(option);
  setCurrentPage(1); // 정렬 변경 시 페이지 초기화
  setLoadedItems([]); // 애니메이션 재설정
  handleSortClose();
  
  // 정렬 변경 알림
  setSnackbar({
    open: true,
    message: option === 'date' ? '최근 저장순으로 정렬됨' : 
             option === 'name' ? '이름순으로 정렬됨' : 
             '평점순으로 정렬됨',
    severity: 'info'
  });
  
  // 성능 측정 종료
  performance.mark(endSortMark);
  measurePerformance('정렬 적용', startSortMark, endSortMark, 'interactions');
};

// 뷰 모드 변경 핸들러
const handleViewModeChange = (mode) => {
  if (mode === viewMode) return;
  
  setViewMode(mode);
  setCurrentPage(1); // 뷰 모드 변경 시 페이지 초기화
  
  // 뷰 모드 변경 시 애니메이션 효과 추가
  setLoadedItems([]);
  
  // 뷰 모드 변경 알림
  setSnackbar({
    open: true,
    message: mode === 'grid' ? '그리드 보기로 전환' : 
             mode === 'list' ? '리스트 보기로 전환' : 
             '카테고리 그룹 보기로 전환',
    severity: 'info'
  });
  
  // 자동으로 알림 닫기
  setTimeout(() => {
    setSnackbar(prev => ({...prev, open: false}));
  }, 2000);
};

// 수동 데이터 새로고침 핸들러 (전체 데이터 리로드) - 성능 측정 추가
const handleManualRefresh = async () => {
  if (!isAuthenticated || !currentUser) {
    console.log("SavedPlaces - 인증되지 않은 사용자, 새로고침 불가");
    setSnackbar({
      open: true,
      message: '로그인이 필요합니다.',
      severity: 'warning'
    });
    return;
  }

  if (isRefreshing) return; // 중복 실행 방지
  
  // 성능 측정 시작
  const startRefreshMark = `data-refresh-start-${Date.now()}`;
  const endRefreshMark = `data-refresh-end-${Date.now()}`;
  performance.mark(startRefreshMark);
  
  setIsRefreshing(true);
  setSnackbar({
    open: true,
    message: '저장된 장소 목록을 새로고침 중입니다...',
    severity: 'info'
  });
  console.log("SavedPlaces - 수동 데이터 새로고침 시작");
  
  try {
    // 타임아웃 설정으로 무한 대기 방지
    const refreshPromise = refreshData();
    
    // Promise.race 사용하지 않고 최대 시간만 설정
    const timeoutId = setTimeout(() => {
      if (isRefreshing) {
        console.log("SavedPlaces - 데이터 새로고침 시간 초과");
        setSnackbar({
          open: true,
          message: '데이터 새로고침 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.',
          severity: 'warning'
        });
        setIsRefreshing(false);
        
        // 성능 측정 종료 (시간 초과 시)
        performance.mark(endRefreshMark);
        measurePerformance('데이터 새로고침 (시간 초과)', startRefreshMark, endRefreshMark, 'interactions');
      }
    }, 15000);
    
    try {
      await refreshPromise;
      clearTimeout(timeoutId);

     // 페이지 초기화
     setCurrentPage(1);
     setHasMoreItems(true);
     
     // 중요: loadedItems 초기화
     setLoadedItems([]); // 애니메이션 재설정
     
     setSnackbar({
       open: true,
       message: '저장된 장소 목록이 업데이트되었습니다.',
       severity: 'success'
     });
   } catch (error) {
     console.error("SavedPlaces - 데이터 새로고침 오류:", error);
     setSnackbar({
       open: true,
       message: '데이터 새로고침 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'),
       severity: 'error'
     });
   }
 } finally {
   setIsRefreshing(false);
   
   // 성능 측정 종료
   performance.mark(endRefreshMark);
   measurePerformance('데이터 새로고침', startRefreshMark, endRefreshMark, 'interactions');
 }
};

// 강제 동기화 함수
const handleForceSyncData = async () => {
 if (!isAuthenticated || !currentUser) {
   setSnackbar({
     open: true,
     message: '로그인이 필요합니다.',
     severity: 'warning'
   });
   return;
 }
 
 if (isRefreshing) return; // 중복 실행 방지
 
 setIsRefreshing(true);
 setSnackbar({
   open: true,
   message: '서버와 데이터 동기화 중...',
   severity: 'info'
 });
 
 try {
   await syncSavedPlaces();
   
   // 동기화 후 데이터 새로고침 (UI 업데이트)
   setLoadedItems([]); // 애니메이션 재설정
   
   setSnackbar({
     open: true,
     message: '데이터 동기화가 완료되었습니다.',
     severity: 'success'
   });
 } catch (error) {
   console.error("SavedPlaces - 데이터 동기화 오류:", error);
   setSnackbar({
     open: true,
     message: '데이터 동기화 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'),
     severity: 'error'
   });
 } finally {
   setIsRefreshing(false);
 }
};

// 데이터 상태 초기화 (디버깅용)
const handleResetDataState = () => {
 if (window.confirm('데이터 상태를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
   resetDataState();
   setSnackbar({
     open: true,
     message: '데이터 상태가 초기화되었습니다.',
     severity: 'info'
   });
 }
};

// 무한 스크롤 처리 함수
const loadMore = useCallback(async () => {
  if (loadingMore || !hasMoreItems) return;
  
  // 성능 측정 시작
  const startLoadMoreMark = `load-more-start-${Date.now()}`;
  const endLoadMoreMark = `load-more-end-${Date.now()}`;
  performance.mark(startLoadMoreMark);
  
  setLoadingMore(true);
  
  // 실제 API 호출이나 데이터 페칭 없이 단순히 페이지 번호만 증가
  try {
    // 지연 효과 (UI 표시 목적)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 다음 페이지 위치 계산
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    
    // 애니메이션을 위한 점진적 표시
    const currentIds = loadedItems;
    const newIds = filteredPlaces
      .slice((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE)
      .map(place => place.id);
    
    // 점진적으로 새 아이템 추가 (애니메이션 효과)
    if (animationEnabled) {
      for (let i = 0; i < newIds.length; i++) {
        setTimeout(() => {
          setLoadedItems(prev => [...prev, newIds[i]]);
        }, i * 50);
      }
    } else {
      // 성능 최적화 모드에서는 한 번에 추가
      setLoadedItems([...currentIds, ...newIds]);
    }
    
    // 더 불러올 항목이 있는지 확인
    if (filteredPlaces.length <= nextPage * PAGE_SIZE) {
      setHasMoreItems(false);
    }
    
  } catch (error) {
    console.error('데이터 로드 오류:', error);
  } finally {
    setLoadingMore(false);
    
    // 성능 측정 종료
    performance.mark(endLoadMoreMark);
    measurePerformance('추가 데이터 로드', startLoadMoreMark, endLoadMoreMark, 'interactions');
  }
}, [loadingMore, hasMoreItems, currentPage, filteredPlaces, loadedItems, PAGE_SIZE, animationEnabled]);

// 더보기 메뉴 열기
const handleMoreMenuOpen = (event, place) => {
  setMoreMenuAnchorEl(event.currentTarget);
  setSelectedPlace(place);
};

// 더보기 메뉴 닫기
const handleMoreMenuClose = () => {
  setMoreMenuAnchorEl(null);
};

// 장소 삭제 확인 대화상자 열기
const handleDeleteConfirmOpen = () => {
  handleMoreMenuClose();
  setDeleteConfirmOpen(true);
};

// 장소 삭제 확인 대화상자 닫기
const handleDeleteConfirmClose = () => {
  setDeleteConfirmOpen(false);
  setSelectedPlace(null);
};

// 장소 삭제 실행
const handleDeleteSavedPlace = async () => {
  if (!selectedPlace) return;
  
  try {
    const placeId = selectedPlace.id || selectedPlace.placeId;
    
    if (!placeId) {
      console.error('장소 ID가 없습니다:', selectedPlace);
      setSnackbar({
        open: true,
        message: '유효한 장소 ID가 없습니다.',
        severity: 'error'
      });
      return;
    }
    
    // 서버에서 삭제 실행 - deleteSavedPlace 함수 호출
    await deleteSavedPlace(placeId);
    
    // loadedItems 배열에서 제거
    setLoadedItems(prev => prev.filter(id => id !== placeId));
    
    // UI 업데이트를 위한 필터링된 장소 목록에서도 제거
    // 참고: filteredPlaces는 useMemo로 계산되므로 여기서 직접 수정할 수 없음
    // savedPlaces 배열이 deleteSavedPlace 함수에서 이미 업데이트되었으므로
    // filteredPlaces도 자동으로 업데이트됨
    
    setSnackbar({
      open: true,
      message: `${selectedPlace.name} 장소가 삭제되었습니다.`,
      severity: 'success'
    });
  } catch (error) {
    console.error('장소 삭제 오류:', error);
    setSnackbar({
      open: true,
      message: '장소 삭제 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'),
      severity: 'error'
    });
  } finally {
    handleDeleteConfirmClose(); // 삭제 확인 대화 상자 닫기
  }
};

// 헤더 렌더링 함수 - 검색, 필터, 정렬 컨트롤 포함
const renderHeader = () => (
  <Box ref={headerRef}>
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Paper 
        elevation={2} 
        sx={{ 
          p: { xs: 2, md: 3 }, 
          mb: 3,
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 배경 패턴 효과 */}
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            background: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
            zIndex: 0
          }}
        />
        
        {/* 검색 입력 필드 */}
        <Grid container spacing={2} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="저장한 장소 검색..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              variant="outlined"
              size="small"
              inputRef={searchInputRef}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <motion.div whileTap={{ scale: 0.9 }}>
                      <IconButton size="small" onClick={handleClearSearch}>
                        <ClearIcon />
                      </IconButton>
                    </motion.div>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  transition: 'all 0.3s',
                  '&:hover': {
                    boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.05)'
                  },
                  '&.Mui-focused': {
                    boxShadow: '0 0 0 2px rgba(63, 81, 181, 0.2)'
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Chip 
                icon={<FilterListIcon />}
                label={`${filteredPlaces.length}개 장소`}
                variant="outlined"
                color="primary"
                sx={{ 
                  height: 32,
                  borderRadius: 2,
                  pl: 0.5
                }}
              />
            </motion.div>
          </Grid>
          <Grid item xs={6} md={3} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Chip
                icon={<SortIcon />}
                label={sortBy === 'date' ? '최근 저장순' : sortBy === 'name' ? '이름순' : '평점순'}
                variant="outlined"
                color="secondary"
                onClick={handleSortClick}
                sx={{ 
                  cursor: 'pointer', 
                  height: 32,
                  borderRadius: 2,
                  pl: 0.5
                }}
              />
            </motion.div>
            <Menu
              anchorEl={sortAnchorEl}
              open={sortOpen}
              onClose={handleSortClose}
              TransitionComponent={Fade}
              elevation={2}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              PaperProps={{
                sx: {
                  borderRadius: 2,
                  mt: 0.5
                }
              }}
            >
              <MenuItem onClick={() => handleSortSelect('date')} selected={sortBy === 'date'}>
                최근 저장순
              </MenuItem>
              <MenuItem onClick={() => handleSortSelect('name')} selected={sortBy === 'name'}>
                이름순
              </MenuItem>
              <MenuItem onClick={() => handleSortSelect('rating')} selected={sortBy === 'rating'}>
                평점순
              </MenuItem>
            </Menu>
          </Grid>
        </Grid>
        
        {/* 뷰 모드 전환 버튼 */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <IconButton 
                size="small" 
                color={viewMode === 'grid' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('grid')}
                sx={{ 
                  p: 1, 
                  bgcolor: viewMode === 'grid' ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                  borderRadius: 1
                }}
              >
                <Tooltip title="그리드 보기">
                  <GridViewIcon fontSize="small" />
                </Tooltip>
              </IconButton>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <IconButton 
                size="small" 
                color={viewMode === 'list' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('list')}
                sx={{ 
                  p: 1, 
                  bgcolor: viewMode === 'list' ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                  borderRadius: 1
                }}
              >
                <Tooltip title="리스트 보기">
                  <ViewListIcon fontSize="small" />
                </Tooltip>
              </IconButton>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <IconButton 
                size="small" 
                color={viewMode === 'group' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('group')}
                sx={{ 
                  p: 1, 
                  bgcolor: viewMode === 'group' ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                  borderRadius: 1
                }}
              >
                <Tooltip title="카테고리 그룹 보기">
                  <CategoryIcon fontSize="small" />
                </Tooltip>
              </IconButton>
            </motion.div>
          </Box>
          
          {isAuthenticated && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  startIcon={<SyncProblemIcon />}
                  onClick={handleForceSyncData}
                  disabled={isRefreshing}
                >
                  동기화
                </Button>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? '새로고침 중...' : '새로고침'}
                </Button>
              </motion.div>
            </Box>
          )}
        </Box>
      </Paper>
    </motion.div>
  </Box>
);

// 카테고리 탭 렌더링 함수
const renderCategoryTabs = () => (
  categories.length > 1 && (
    <Box ref={categoryHeaderRef}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }} elevation={2}>
          <Tabs 
            value={selectedCategory}
            onChange={handleCategoryChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ 
              mb: 1,
              '& .MuiTab-root': {
                minWidth: isMobile ? 70 : 80,
                py: 1.5,
                transition: 'all 0.3s ease'
              },
              '& .Mui-selected': {
                fontWeight: 'bold'
              }
            }}
          >
            {categories.map(category => {
              const count = categoryStats[category] || 0;
              
              return (
                <Tab 
                  key={category} 
                  value={category} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {category !== 'all' && 
                        <Box component="span" sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
                          {getCategoryIcon(category)}
                        </Box>
                      }
                      <Box component="span">
                        {category === 'all' ? '전체' : categoryNames[category] || category}
                      </Box>
                      <Chip 
                        size="small" 
                        label={count} 
                        sx={{ 
                          ml: 0.5, 
                          height: 18, 
                          fontSize: '0.7rem',
                          bgcolor: category === 'all' ? 'primary.main' : getCategoryColor(category),
                          color: 'white'
                        }} 
                      />
                    </Box>
                  }
                  sx={{
                    color: category !== 'all' ? getCategoryColor(category) : 'inherit',
                    '&.Mui-selected': {
                      color: category !== 'all' ? getCategoryColor(category) : 'primary.main',
                      fontWeight: 'bold'
                    }
                  }}
                />
              );
            })}
          </Tabs>
        </Paper>
      </motion.div>
    </Box>
  )
);

// 로딩 상태 렌더링 함수
const renderLoading = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <CircularProgress size={60} thickness={4} />
    <Typography variant="h6" sx={{ mt: 2 }}>
      {isRefreshing ? '데이터 동기화 중...' : '불러오는 중...'}
    </Typography>
  </Box>
);

// 빈 상태 (저장된 장소 없음) 렌더링 함수
const renderEmptyState = () => (
  <EmptyState
    icon={<FavoriteIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
    title={
      searchTerm || selectedCategory !== 'all' ? 
        "검색 결과가 없습니다" : 
        "아직 저장한 장소가 없습니다"
    }
    description={
      searchTerm || selectedCategory !== 'all' ?
        "다른 검색어나 카테고리를 선택해보세요" :
        "마음에 드는 장소를 찾아 하트 아이콘을 눌러 저장해보세요!"
    }
    actionButtons={
      isAuthenticated && !(searchTerm || selectedCategory !== 'all') ? [
        {
          label: "Firebase 동기화",
          icon: <SyncProblemIcon />,
          color: "secondary",
          onClick: handleForceSyncData
        },
        {
          label: "데이터 새로고침",
          icon: <RefreshIcon />,
          color: "primary",
          onClick: handleManualRefresh
        },
        {
          label: "데이터 초기화",
          icon: <RefreshIcon />,
          color: "warning",
          onClick: handleResetDataState
        }
      ] : []
    }
    animationVariants={fadeVariants}
  />
);

// 그리드 모드 렌더링 함수 - 모든 항목을 그리드로 표시
const renderGridMode = () => (
  <Box ref={listContainerRef}>
    <InfiniteScroll
      loadMore={loadMore}
      hasMore={hasMoreItems}
      isLoading={loadingMore}
      loader={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={30} />
        </Box>
      }
      endMessage={
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            모든 저장된 장소를 불러왔습니다
          </Typography>
        </Box>
      }
    >
      <LayoutGroup>
        <Grid container spacing={3}>
          {visiblePlaces.map((place, index) => (
            <Grid item xs={12} sm={6} md={4} key={place.id || `place-${index}`}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <Box sx={{ position: 'relative' }}>
                  <RecommendationCard 
                    place={place} 
                    isNearby={false} 
                    elevation={2}
                  />
                  
                  {/* 더보기 메뉴 버튼 */}
                  <IconButton 
                    size="small"
                    sx={{ 
                      position: 'absolute', 
                      top: 8, 
                      right: 8, 
                      bgcolor: 'rgba(255,255,255,0.8)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.95)'
                      }
                    }}
                    onClick={(e) => handleMoreMenuOpen(e, place)}
                  >
                    <MoreIcon fontSize="small" />
                  </IconButton>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </LayoutGroup>
    </InfiniteScroll>
  </Box>
);

// 리스트 모드 렌더링 함수 - 항목을 리스트로 표시
const renderListMode = () => (
  <Box ref={listContainerRef}>
    <InfiniteScroll
      loadMore={loadMore}
      hasMore={hasMoreItems}
      isLoading={loadingMore}
      loader={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={30} />
        </Box>
      }
      endMessage={
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            모든 저장된 장소를 불러왔습니다
          </Typography>
        </Box>
      }
    >
      <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2 }}>
        {visiblePlaces.map((place, index) => (
          <motion.div
            key={place.id || `place-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            whileHover={{ x: 5, transition: { duration: 0.2 } }}
          >
            <Card 
              sx={{ 
                mb: 2, 
                borderRadius: 2,
                overflow: 'hidden',
                border: `1px solid ${alpha(getCategoryColor(place.category || 'default'), 0.3)}`
              }}
              elevation={1}
            >
              <CardActionArea 
                component="div"
                onClick={() => window.location.href = `/place/${place.id}`}
                sx={{ p: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  {place.thumbnail && (
                    <Box 
                      component="img" 
                      src={place.thumbnail} 
                      alt={place.name}
                      sx={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 1, 
                        objectFit: 'cover', 
                        mr: 2,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" component="div">
                        {place.name}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoreMenuOpen(e, place);
                        }}
                      >
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Chip 
                        size="small" 
                        label={categoryNames[place.category] || place.category || '기타'} 
                        sx={{ 
                          bgcolor: alpha(getCategoryColor(place.category || 'default'), 0.1),
                          color: getCategoryColor(place.category || 'default'),
                          borderColor: alpha(getCategoryColor(place.category || 'default'), 0.3),
                          mr: 1
                        }}
                        variant="outlined"
                        icon={
                          <Box 
                            component="span" 
                            sx={{ 
                              display: 'inherit', 
                              '& > svg': { 
                                fontSize: '1rem',
                                color: getCategoryColor(place.category || 'default')
                              } 
                            }}
                          >
                            {getCategoryIcon(place.category || 'default')}
                          </Box>
                        }
                      />
                      {place.averageRating !== undefined && place.averageRating !== null && (
                        <Chip 
                          size="small" 
                          label={`★ ${getFormattedRating(place.averageRating)}`} 
                          sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.dark }}
                        />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      {place.region} {place.subRegion && `> ${place.subRegion}`}
                    </Typography>
                  </Box>
                </Box>
              </CardActionArea>
            </Card>
          </motion.div>
        ))}
      </List>
    </InfiniteScroll>
  </Box>
);

// 그룹 모드 렌더링 함수 - 카테고리별로 그룹화하여 표시
// Group mode rendering function - group by category
const renderGroupMode = () => (
  <Box ref={listContainerRef}>
    <LayoutGroup>
      {groupOrder.map((category) => (
        category !== 'all' && groupedPlaces[category]?.length > 0 && (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Paper 
              sx={{ 
                mb: 4, 
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative'
              }} 
              elevation={2}
            >
              {/* Category background color marker */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 6,
                  height: '100%',
                  bgcolor: getCategoryColor(category || 'default')
                }}
              />
              
              {/* Category header */}
              <Box 
                sx={{ 
                  p: 2, 
                  pl: 3,
                  backgroundColor: alpha(getCategoryColor(category || 'default'), 0.1),
                  borderBottom: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge
                    color="secondary"
                    badgeContent={groupedPlaces[category].length}
                    max={99}
                    sx={{ mr: 2 }}
                  >
                    <Box sx={{ color: getCategoryColor(category) }}>
                      {getCategoryIcon(category)}
                    </Box>
                  </Badge>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 500 }}>
                    {categoryNames[category] || category}
                  </Typography>
                </Box>
              </Box>
              
              {/* Places list within category */}
              <Box sx={{ p: { xs: 1, md: 2 } }}>
                <Grid container spacing={2}>
                  {groupedPlaces[category]
                    .filter(place => loadedItems.includes(place.id))
                    .map((place, index) => (
                      <Grid item xs={12} sm={6} md={4} key={place.id || `place-${index}`}>
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        >
                          <Box sx={{ position: 'relative' }}>
                            <RecommendationCard 
                              place={place} 
                              isNearby={false}
                              showCategory={false}
                              elevation={1}
                            />
                            
                            {/* More options menu button */}
                            <IconButton 
                              size="small"
                              sx={{ 
                                position: 'absolute', 
                                top: 8, 
                                right: 8, 
                                bgcolor: 'rgba(255,255,255,0.8)',
                                '&:hover': {
                                  bgcolor: 'rgba(255,255,255,0.95)'
                                }
                              }}
                              onClick={(e) => handleMoreMenuOpen(e, place)}
                            >
                              <MoreIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </motion.div>
                      </Grid>
                    ))}
                </Grid>
              </Box>
            </Paper>
          </motion.div>
        )
      ))}
    </LayoutGroup>
  </Box>
);

// 메인 렌더 함수
if (loading || isRefreshing) {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {renderLoading()}
    </Container>
  );
}

return (
  <PullToRefresh onRefresh={handleManualRefresh} disabled={isRefreshing}>
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          저장한 장소
        </Typography>
        
        {/* 에러 표시 */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" size="small" onClick={handleManualRefresh}>
                다시 시도
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        
        {/* 헤더 섹션 */}
        {renderHeader()}
        
        {/* 카테고리 탭 - 해당 조건일 때만 표시 */}
        {renderCategoryTabs()}
        
        {/* 메인 콘텐츠 */}
        {filteredPlaces.length === 0 ? (
          renderEmptyState()
        ) : (
          viewMode === 'grid' ? renderGridMode() :
          viewMode === 'list' ? renderListMode() :
          renderGroupMode()
        )}
        
        {/* 더보기 메뉴 (장소 편집, 삭제 등) */}
        <Menu
          id="more-menu"
          anchorEl={moreMenuAnchorEl}
          open={moreMenuOpen}
          onClose={handleMoreMenuClose}
          TransitionComponent={Fade}
          PaperProps={{
            elevation: 3,
            sx: { borderRadius: 2 }
          }}
        >
          <MenuItem onClick={handleDeleteConfirmOpen}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText primary="삭제하기" />
          </MenuItem>
          <MenuItem onClick={() => { 
            handleMoreMenuClose();
            if (selectedPlace) {
              window.location.href = `/place/${selectedPlace.id}`;
            }
          }}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="상세 정보 보기" />
          </MenuItem>
        </Menu>
        
        {/* 삭제 확인 다이얼로그 */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleDeleteConfirmClose}
          aria-labelledby="delete-confirm-title"
          aria-describedby="delete-confirm-description"
          PaperProps={{
            elevation: 3,
            sx: { borderRadius: 2 }
          }}
        >
          <DialogTitle id="delete-confirm-title">
            저장한 장소 삭제
          </DialogTitle>
          <DialogContent>
            <Typography>
              &apos;{selectedPlace?.name}&apos;을(를) 저장한 장소에서 삭제하시겠습니까?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteConfirmClose} color="primary">
              취소
            </Button>
            <Button onClick={handleDeleteSavedPlace} color="error" variant="contained">
              삭제
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 스낵바 메시지 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ mb: isMobile ? 7 : 0 }} // 모바일에서는 하단 네비바 위에 표시
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity} 
            variant="filled"
            elevation={6}
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </motion.div>
    </Container>
  </PullToRefresh>
);
};

export default SavedPlaces; 
