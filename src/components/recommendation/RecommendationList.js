// src/components/recommendation/RecommendationList.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Typography, Box, Grid, Paper, 
  Chip, FormControl, InputLabel, 
  Select, MenuItem, IconButton,
  Badge, Tooltip, useMediaQuery,
  useTheme, Collapse, Button
} from '@mui/material';
import { 
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  TuneOutlined as TuneIcon,
  ArrowUpward as ArrowUpwardIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import RecommendationCard from './RecommendationCard';
import PlaceCardSkeleton from './PlaceCardSkeleton';
// framer-motion 추가
import { motion, AnimatePresence } from 'framer-motion';
import { 
  containerVariants, 
  slideInVariants, 
  prefersReducedMotion,
  getOptimizedAnimation,
  responsiveAnimationSettings 
} from '../../utils/animationUtils';

// 모바일 기기 감지
const isMobile = typeof window !== 'undefined' 
  ? /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
  : false;

  /**
 * 추천 목록 컴포넌트 - 모바일 최적화 및 애니메이션 개선 버전
 * 
 * @param {Object} props
 * @param {Array} props.places - 추천 장소 목록
 * @param {Object} props.userProfile - 사용자 프로필
 * @param {String} props.title - 제목
 * @param {Boolean} props.loading - 로딩 상태
 * @param {Boolean} props.isNearby - 내 주변 추천 여부
 * @param {Object} props.filters - 필터 상태
 * @param {Function} props.onFilterChange - 필터 변경 핸들러
 * @param {Boolean} props.expandable - 섹션 확장/축소 가능 여부
 * @param {Boolean} props.initialExpanded - 초기 확장 상태
 * @param {Function} props.onRefresh - 새로고침 핸들러 (선택적)
 * @param {Boolean} props.showRefreshButton - 새로고침 버튼 표시 여부
 */
const RecommendationList = ({ 
  places = [], 
  userProfile, 
  title, 
  loading = false, 
  isNearby = false,
  filters = { category: 'all', distance: 'all', rating: 'all' },
  onFilterChange,
  expandable = false,
  initialExpanded = true,
  onRefresh,
  showRefreshButton = false
}) => {
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletView = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // 애니메이션 최적화 설정
  const animationSettings = getOptimizedAnimation();
  const useSimpleAnimations = prefersReducedMotion || !animationSettings.enableGestures;
  
  // 화면 크기에 따른 애니메이션 조정
  const getResponsiveAnimationConfig = () => {
    if (isMobileView) return responsiveAnimationSettings.mobile;
    if (isTabletView) return responsiveAnimationSettings.tablet;
    return responsiveAnimationSettings.desktop;
  };
  
  const animConfig = getResponsiveAnimationConfig();
  
  // 리스트 참조
  const listRef = useRef(null);
  
  // 스크롤 이벤트 처리
  useEffect(() => {
    const handleScroll = () => {
      const position = window.pageYOffset;
      setShowScrollTop(position > 300);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // 맨 위로 스크롤 핸들러
  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: useSimpleAnimations ? 'auto' : 'smooth'
    });
  };
  
  // 필터 변경 핸들러
  const handleFilterChange = useCallback((filterType, value) => {
    if (onFilterChange) {
      onFilterChange(filterType, value);
    }
  }, [onFilterChange]);
  
  // 확장/축소 토글
  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);
  
  // 필터 토글 버튼 핸들러
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
    
    // 필터 표시 시 진동 피드백 (모바일)
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(20);
    }
  }, []);
  
  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    
    setRefreshing(true);
    
    // 햅틱 피드백 (모바일)
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(30);
    }
    
    try {
      await onRefresh();
    } finally {
      // 애니메이션 완료 후 상태 변경
      setTimeout(() => {
        setRefreshing(false);
      }, 800);
    }
  }, [onRefresh, refreshing]);

  // 필터 UI 렌더링 - 모바일 최적화
  const renderFilterUI = () => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ 
        opacity: 1, 
        height: 'auto',
        transition: { 
          duration: isMobileView ? 0.25 : 0.3,
          ease: 'easeInOut'
        }
      }}
      exit={{ 
        opacity: 0, 
        height: 0,
        transition: { 
          duration: isMobileView ? 0.2 : 0.25,
          ease: 'easeInOut'
        }
      }}
    >
      <Paper 
        sx={{ 
          p: isMobileView ? 1.5 : 2, 
          mb: 2,
          borderRadius: isMobileView ? '12px' : '8px',
          boxShadow: isMobileView ? 2 : 1
        }}
        elevation={isMobileView ? 2 : 1}
      >
        <Grid container spacing={isMobileView ? 1.5 : 2}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size={isMobileView ? "medium" : "small"}>
              <InputLabel>카테고리</InputLabel>
              <Select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                label="카테고리"
                sx={isMobileView ? {
                  '.MuiSelect-select': {
                    paddingTop: '12px', 
                    paddingBottom: '12px'
                  }
                } : {}}
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="cafe">카페</MenuItem>
                <MenuItem value="restaurant">식당</MenuItem>
                <MenuItem value="culture">문화 공간</MenuItem>
                <MenuItem value="bookstore_cafe">북카페</MenuItem>
                <MenuItem value="bar">바/펍</MenuItem>
                <MenuItem value="art_cafe">아트 카페</MenuItem>
                <MenuItem value="traditional_teahouse">전통 찻집</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size={isMobileView ? "medium" : "small"}>
              <InputLabel>거리</InputLabel>
              <Select
                value={filters.distance}
                onChange={(e) => handleFilterChange('distance', e.target.value)}
                label="거리"
                disabled={!isNearby}
                sx={isMobileView ? {
                  '.MuiSelect-select': {
                    paddingTop: '12px', 
                    paddingBottom: '12px'
                  }
                } : {}}
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="1000">1km 이내</MenuItem>
                <MenuItem value="3000">3km 이내</MenuItem>
                <MenuItem value="5000">5km 이내</MenuItem>
                <MenuItem value="10000">10km 이내</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size={isMobileView ? "medium" : "small"}>
              <InputLabel>평점</InputLabel>
              <Select
                value={filters.rating}
                onChange={(e) => handleFilterChange('rating', e.target.value)}
                label="평점"
                sx={isMobileView ? {
                  '.MuiSelect-select': {
                    paddingTop: '12px', 
                    paddingBottom: '12px'
                  }
                } : {}}
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="3">3점 이상</MenuItem>
                <MenuItem value="4">4점 이상</MenuItem>
                <MenuItem value="4.5">4.5점 이상</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* 필터 적용 확인 버튼 (모바일용) */}
          {isMobileView && (
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  size="small" 
                  color="primary" 
                  onClick={toggleFilters}
                  startIcon={<CheckIcon />}
                  variant="outlined"
                >
                  필터 적용
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
    </motion.div>
  );
  
  // 섹션 헤더 렌더링 - 모바일 최적화
  const renderSectionHeader = () => (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      mb: 2,
      borderBottom: expandable ? 1 : 0,
      borderColor: 'divider',
      pb: expandable ? 1 : 0,
      flexWrap: isMobileView ? 'wrap' : 'nowrap'
    }}>
      <Box 
        display="flex" 
        alignItems="center"
        sx={{ 
          width: isMobileView ? '100%' : 'auto',
          justifyContent: isMobileView ? 'space-between' : 'flex-start',
          mb: isMobileView ? 1 : 0
        }}
      >
        <Box display="flex" alignItems="center">
          <Typography 
            variant={isMobileView ? "subtitle1" : "h6"} 
            component="h2"
            sx={{ fontWeight: 'bold' }}
          >
            {title}
          </Typography>
          <Chip 
            label={places.length} 
            size="small" 
            color="primary"
            sx={{ 
              ml: 1, 
              height: isMobileView ? 22 : 20, 
              minWidth: isMobileView ? 22 : 20,
              fontSize: isMobileView ? '0.7rem' : '0.65rem'
            }}
          />
        </Box>
        
        {expandable && (
          <motion.div 
            whileHover={useSimpleAnimations ? {} : { scale: 1.1 }} 
            whileTap={useSimpleAnimations ? {} : { scale: 0.95 }}
          >
            <IconButton 
              onClick={toggleExpanded}
              size="small"
              sx={{ ml: 1 }}
              color="primary"
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </motion.div>
        )}
      </Box>
      
      <Box 
        sx={{ 
          display: 'flex',
          alignItems: 'center',
          width: isMobileView ? '100%' : 'auto',
          justifyContent: isMobileView ? 'flex-end' : 'flex-start',
        }}
      >
        {/* 새로고침 버튼 */}
        {showRefreshButton && onRefresh && (
          <motion.div 
            whileHover={useSimpleAnimations ? {} : { scale: 1.1 }} 
            whileTap={useSimpleAnimations ? {} : { scale: 0.95 }}
            animate={refreshing ? { rotate: 360 } : {}}
            transition={refreshing ? { 
              repeat: Infinity, 
              duration: 1, 
              ease: 'linear' 
            } : {}}
          >
            <Tooltip title="새로고침">
              <IconButton 
                onClick={handleRefresh}
                color="primary"
                size={isMobileView ? "medium" : "small"}
                disabled={refreshing}
                sx={{ mr: 1 }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </motion.div>
        )}
        
        {/* 필터 버튼 */}
        <motion.div 
          whileHover={useSimpleAnimations ? {} : { scale: 1.1 }} 
          whileTap={useSimpleAnimations ? {} : { scale: 0.95 }}
        >
          <Badge
            color="secondary"
            variant="dot"
            invisible={
              filters.category === 'all' && 
              filters.distance === 'all' && 
              filters.rating === 'all'
            }
          >
            <Tooltip title={showFilters ? "필터 닫기" : "필터 열기"}>
              <IconButton 
                onClick={toggleFilters}
                color={showFilters ? "primary" : "default"}
                aria-label={showFilters ? "필터 닫기" : "필터 열기"}
                size={isMobileView ? "medium" : "small"}
              >
                {isMobileView ? <TuneIcon /> : <FilterListIcon />}
              </IconButton>
            </Tooltip>
          </Badge>
        </motion.div>
      </Box>
    </Box>
  );
  
  // 로딩 UI 렌더링 - 애니메이션 및 반응형 개선
  const renderLoadingUI = () => (
    <Grid container spacing={isMobileView ? 2 : 3}>
      {Array.from(new Array(isMobileView ? 4 : 6)).map((_, index) => (
        <Grid 
          item 
          xs={12} 
          sm={6} 
          md={4} 
          key={index}
          sx={{ opacity: 1 - (index * 0.1) }} // 페이드 효과
        >
          <PlaceCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
  
  // 빈 상태 UI 렌더링 - 애니메이션 개선
  const renderEmptyUI = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper 
        elevation={1} 
        sx={{ 
          textAlign: 'center', 
          py: 4, 
          px: 2,
          borderRadius: '16px',
          backgroundColor: 'background.paper',
          border: '1px dashed',
          borderColor: 'divider'
        }}
      >
        <Typography 
          variant={isMobileView ? "subtitle1" : "h6"} 
          color="text.secondary" 
          gutterBottom
          sx={{ fontWeight: 'medium' }}
        >
          맞춤 추천 장소가 없습니다.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isNearby ? 
            '다른 위치로 이동하거나 필터 설정을 변경해보세요.' : 
            '다른 지역을 선택하거나 필터 설정을 변경해보세요.'}
        </Typography>
        
        {/* 모바일 환경에서 필터 변경 버튼 추가 */}
        {isMobileView && (
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={toggleFilters}
            startIcon={<TuneIcon />}
            sx={{ mt: 2 }}
          >
            필터 변경하기
          </Button>
        )}
      </Paper>
    </motion.div>
  );
  
  // 추천 목록 렌더링 - 모션 및 반응형 개선
  const renderPlaceGrid = () => {
    // 화면 크기별 스태거 지연 조정
    const staggerDelay = animConfig.staggerDelay || 0.08;
    
    // 화면 크기에 맞는 컨테이너 변형
    const responsiveContainerVariants = {
      ...containerVariants,
      visible: {
        ...containerVariants.visible,
        transition: {
          ...containerVariants.visible.transition,
          staggerChildren: staggerDelay
        }
      }
    };
    
    return (
      <motion.div
        variants={responsiveContainerVariants}
        initial="hidden"
        animate="visible"
        exit={{ opacity: 0 }}
        ref={listRef}
      >
        <Grid container spacing={isMobileView ? 2 : 3}>
          {places.map((place, index) => (
            <Grid item xs={12} sm={6} md={4} key={place.id || index}>
              <RecommendationCard 
                place={place} 
                userProfile={userProfile} 
                isNearby={isNearby} 
                index={index}
              />
            </Grid>
          ))}
        </Grid>
      </motion.div>
    );
  };

  // 맨 위로 스크롤 버튼 - 모바일 최적화
  const renderScrollTopButton = () => (
    <Collapse in={showScrollTop} timeout={300}>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        whileHover={useSimpleAnimations ? {} : { scale: 1.1 }}
        whileTap={useSimpleAnimations ? {} : { scale: 0.9 }}
        style={{
          position: 'fixed',
          bottom: isMobileView ? 80 : 24, // 모바일의 경우 네비게이션 바 위에 위치
          right: 24,
          zIndex: 10
        }}
      >
        <Tooltip title="맨 위로">
          <IconButton
            color="primary"
            aria-label="맨 위로 스크롤"
            onClick={handleScrollToTop}
            sx={{
              bgcolor: 'background.paper',
              boxShadow: 3,
              '&:hover': {
                bgcolor: 'background.paper',
              }
            }}
            size={isMobileView ? "medium" : "large"}
          >
            <ArrowUpwardIcon />
          </IconButton>
        </Tooltip>
      </motion.div>
    </Collapse>
  );
  
  if (!expandable || expanded) {
    return (
      <Box sx={{ mb: 5 }}>
        {renderSectionHeader()}
        
        <AnimatePresence>
          {showFilters && renderFilterUI()}
        </AnimatePresence>
        
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: isMobileView ? 0.2 : 0.3 }}
            >
              {renderLoadingUI()}
            </motion.div>
          ) : places.length > 0 ? (
            <motion.div
              key="content"
              variants={slideInVariants('up', isMobileView ? 10 : 20)}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              {renderPlaceGrid()}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {renderEmptyUI()}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 맨 위로 스크롤 버튼 */}
        {renderScrollTopButton()}
      </Box>
    );
  } else {
    return renderSectionHeader();
  }
};

export default RecommendationList;
