// src/pages/Home.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Button,
  Divider,
  useMediaQuery,
  CircularProgress,
  Fade,
  Zoom,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  TravelExplore as ExploreIcon,
  Favorite as FavoriteIcon,
  History as HistoryIcon,
  LocationOn as LocationIcon,
  InsertEmoticon as EmoticonIcon,
  AccountCircle as AccountIcon,
  Search as SearchIcon,
  ArrowDownward as ArrowDownwardIcon,
  TravelExplore as TravelIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  // 추가 아이콘은 주석 처리
  // InstallMobile as InstallIcon,
  // Notifications as NotificationsIcon,
  // NewReleases as NewReleasesIcon,
  // SyncProblem as SyncProblemIcon
} from '@mui/icons-material';

// 컨텍스트 및 서비스
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import recommendationService from '../services/recommendationService';
import { isOffline, getCachedData, setCachedData } from '../utils/cacheUtils';
// 오프라인/PWA 관련 컨텍스트 주석 처리
// import { usePwaInstall } from '../contexts/PwaInstallContext';
// import { useOfflineStatus } from '../contexts/OfflineContext';
// import { useNotifications } from '../contexts/NotificationContext';
import { useNotification } from '../contexts/NotificationContext';

// 컴포넌트
import RecentActivities from '../components/home/RecentActivities';
import RecommendationSection from '../components/home/RecommendationSection';
import QuickActions from '../components/home/QuickActions';
import SearchBar from '../components/search/SearchBar';
import SkeletonPlaceCard from '../components/ui/SkeletonPlaceCard';
// 오프라인/PWA 관련 컴포넌트 주석 처리
// import OfflineBanner from '../components/common/OfflineBanner';
// import InstallPrompt from '../components/pwa/InstallPrompt';
// import PushPermissionRequest from '../components/pwa/PushPermissionRequest';
// import UpdateNotification from '../components/pwa/UpdateNotification';

// framer-motion 추가
import { motion, useReducedMotion } from 'framer-motion';

// PWA 설치 감지 유틸리티 추가 - 주석 처리
// import { isInstalledAsPWA } from '../utils/serviceWorkerRegistration';

// 애니메이션 변수 정의
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      when: "beforeChildren",
      staggerChildren: 0.3,
      duration: 0.5
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6 }
  }
};

const pulseVariants = {
  initial: { scale: 1 },
  pulse: { 
    scale: [1, 1.05, 1],
    transition: { 
      duration: 1.5, 
      repeat: Infinity,
      repeatType: "loop"
    }
  }
};

// 스켈레톤 로더 컴포넌트
const SkeletonLoader = () => {
  return (
    <Grid container spacing={2}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Grid item xs={12} sm={6} md={4} key={item}>
          <SkeletonPlaceCard />
        </Grid>
      ))}
    </Grid>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const preferReducedMotion = useReducedMotion();
  const { currentUser } = useAuth();
  const { userProfile, isLoading: isUserLoading } = useUser();
  
  // useNotification으로 변경 (useNotifications가 아님)
  const { hasUnreadNotifications } = useNotification();
  
  // PWA 관련 컨텍스트 및 상태 - 임시 처리
  // const { canInstall, installApp } = usePwaInstall();
  // const { isOfflineMode, connectionQuality, getLastOnlineTime } = useOfflineStatus();
  
  // 간단한 대체 변수 정의
  const canInstall = false;
  const isOfflineMode = !navigator.onLine;
  const connectionQuality = null;
  
  const [featuredPlaces, setFeaturedPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState({
    recommendations: false,
    recentActivities: false
  });
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showError, setShowError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollPrompt, setShowScrollPrompt] = useState(true);
  const [dataFetchFailed, setDataFetchFailed] = useState(false);
  
  // PWA 관련 상태 - 간소화
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  
  // 참조 생성
  const searchSectionRef = useRef(null);
  const recommendationSectionRef = useRef(null);

 // PWA 설치 상태 확인 - 간소화
 useEffect(() => {
  // PWA 설치 확인 - 간단한 대체 코드
  const checkPwaStatus = () => {
    // 이미 설치된 상태인지 확인
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true;
    setIsPWAInstalled(isPwa);
  };
  
  checkPwaStatus();
  
  // 이벤트 리스너 (설치 이벤트 감지)
  const handleAppInstalled = () => {
    setIsPWAInstalled(true);
  };
  
  window.addEventListener('appinstalled', handleAppInstalled);
  
  return () => {
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}, []);

// 스크롤 이벤트 처리
useEffect(() => {
  const handleScroll = () => {
    // 스크롤 위치 확인
    const scrollPosition = window.pageYOffset;
    if (scrollPosition > 100) {
      setScrolled(true);
      setShowScrollPrompt(false);
    } else {
      setScrolled(false);
      setShowScrollPrompt(true);
    }
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

// 스크롤 프롬프트 자동 숨김
useEffect(() => {
  if (showScrollPrompt) {
    const timer = setTimeout(() => {
      setShowScrollPrompt(false);
    }, 5000);
    return () => clearTimeout(timer);
  }
}, [showScrollPrompt]);

// 컴포넌트 마운트 시 추천 장소 가져오기
useEffect(() => {
  fetchFeaturedPlaces();
}, []);

// 추천 장소 가져오기 - 개선된 오류 처리 및 캐시 로직
const fetchFeaturedPlaces = useCallback(async (isRefreshing = false) => {
  if (!isRefreshing && isLoading) return; // 이미 로딩 중이면 중복 요청 방지
  
  try {
    setIsLoading(true);
    setSectionLoading(prev => ({ ...prev, recommendations: true }));
    setError(null);
    setDataFetchFailed(false);
    
    // 오프라인 상태 확인 - 개선된 캐시 로직
    if (isOfflineMode) {
      console.log("오프라인 상태: 캐시된 추천 사용");
      
      // 캐시에서 데이터 확인 - getCachedData 함수 사용
      const cachedData = await getCachedData('featuredPlaces');
      
      if (cachedData) {
        console.log("캐시된 추천 데이터 사용");
        setFeaturedPlaces(cachedData);
        setIsLoading(false);
        setSectionLoading(prev => ({ ...prev, recommendations: false }));
        return;
      } else {
        console.log("캐시된 추천 데이터 없음");
        // 캐시 없으면 빈 결과 처리
        setFeaturedPlaces([]);
        setIsLoading(false);
        setSectionLoading(prev => ({ ...prev, recommendations: false }));
        return;
      }
    }
    
    // 네트워크 타임아웃 처리 추가
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("요청 시간 초과")), 10000)
    );
    
    // 사용자 프로필 없을 때 기본 추천
    if (!userProfile) {
      console.log("사용자 프로필 없음, 기본 추천 사용");
      
      try {
        // 타임아웃 처리를 위한 Promise.race 사용
        const response = await Promise.race([
          recommendationService.getFeaturedRecommendations({
            type: 'popular',
            limit: 6
          }),
          timeoutPromise
        ]);
        
        if (response.success) {
          setFeaturedPlaces(response.data);
          // 기본 추천 캐싱 - setCachedData 함수 사용
          await setCachedData('featuredPlaces', response.data, 6 * 60 * 60 * 1000); // 6시간
        } else {
          throw new Error("인기 장소를 가져오지 못했습니다.");
        }
      } catch (error) {
        console.error("기본 추천 가져오기 실패:", error);
        setError("추천 데이터를 가져오지 못했습니다. 나중에 다시 시도해주세요.");
        setShowError(true);
        setDataFetchFailed(true);
        
        // 캐시된 데이터가 있으면 사용
        const cachedData = await getCachedData('featuredPlaces');
        if (cachedData) {
          setFeaturedPlaces(cachedData);
        }
      }
      
      setIsLoading(false);
      setSectionLoading(prev => ({ ...prev, recommendations: false }));
      return;
    }
    
    // 맞춤 추천 가져오기 - 타임아웃 및 오류 처리 개선
    try {
      const response = await Promise.race([
        recommendationService.getFeaturedRecommendations(userProfile),
        timeoutPromise
      ]);
      
      if (response.success) {
        setFeaturedPlaces(response.data);
        // 추천 데이터 캐싱 - setCachedData 함수 사용
        await setCachedData('featuredPlaces', response.data, 2 * 60 * 60 * 1000, {
          prioritize: true // 중요 데이터로 표시 (추가)
        });
        
        // 재시도 카운터 리셋
        setRetryCount(0);
      } else {
        throw new Error(response.error || "추천 데이터를 가져오지 못했습니다.");
      }
    } catch (error) {
      console.error('Error fetching featured places:', error);
      setError(error.message || "추천 장소를 가져오는 중 오류가 발생했습니다.");
      setShowError(true);
      setDataFetchFailed(true);
      
      // 첫 번째 오류면 자동 재시도
      if (retryCount === 0) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          console.log("추천 데이터 자동 재시도...");
          fetchFeaturedPlaces(false);
        }, 3000); // 3초 후 재시도
      } else {
        // 캐시된 데이터가 있으면 사용
        const cachedData = await getCachedData('featuredPlaces');
        if (cachedData) {
          setFeaturedPlaces(cachedData);
        }
      }
    }
  } finally {
    setIsLoading(false);
    setSectionLoading(prev => ({ ...prev, recommendations: false }));
  }
}, [userProfile, retryCount, isLoading, isOfflineMode]);

// 네트워크 변경 시 자동 새로고침 (오프라인→온라인)
useEffect(() => {
  // 오프라인에서 온라인으로 전환 시 데이터 새로고침
  if (!isOfflineMode && dataFetchFailed) {
    // 약간의 지연 후 새로고침 (네트워크 안정화를 위해)
    const timer = setTimeout(() => {
      console.log("네트워크 연결 복구, 데이터 새로고침");
      fetchFeaturedPlaces(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }
}, [isOfflineMode, dataFetchFailed, fetchFeaturedPlaces]);

// 업데이트 알림 핸들러 - 간소화
const handleUpdateAvailable = useCallback(() => {
  setShowUpdateDialog(true);
}, []);

// 업데이트 이벤트 리스너
useEffect(() => {
  // 업데이트 이벤트 감지
  const handleUpdateEvent = () => {
    handleUpdateAvailable();
  };
  
  window.addEventListener('pwa-update-available', handleUpdateEvent);
  
  return () => {
    window.removeEventListener('pwa-update-available', handleUpdateEvent);
  };
}, [handleUpdateAvailable]);
  
// 검색 섹션으로 스크롤 핸들러
const scrollToSearch = () => {
  if (searchSectionRef.current) {
    searchSectionRef.current.scrollIntoView({ 
      behavior: preferReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }
};

// 새로고침 핸들러
const handleRefresh = () => {
  if (isLoading) return;
  fetchFeaturedPlaces(true);
};

// 오류 알림 닫기 핸들러
const handleCloseError = () => {
  setShowError(false);
};

// 업데이트 설치 핸들러 (간소화)
const handleUpdateInstall = () => {
  // 서비스 워커에게 업데이트 명령
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SKIP_WAITING'
    });
  }
  
  setShowUpdateDialog(false);
  // 페이지 새로고침은 서비스 워커가 처리
};

// 퀵 액션 정의 - 애니메이션과 인터랙션 강화
const quickActions = [
  {
    icon: <ExploreIcon fontSize="large" />,
    title: '맞춤 추천',
    description: 'MBTI, 관심사, 감정 상태에 맞는 장소를 찾아보세요',
    action: () => navigate('/recommendations'),
    color: theme.palette.primary.main,
    motion: {
      whileHover: { scale: 1.05, y: -5 },
      whileTap: { scale: 0.98 }
    }
  },
  {
    icon: <FavoriteIcon fontSize="large" />,
    title: '저장한 장소',
    description: '나중에 방문하고 싶은 장소들을 확인하세요',
    action: () => navigate('/saved-places'),
    color: theme.palette.secondary.main,
    motion: {
      whileHover: { scale: 1.05, y: -5 },
      whileTap: { scale: 0.98 }
    }
  },
  {
    icon: <HistoryIcon fontSize="large" />,
    title: '방문 기록',
    description: '이전에 방문했던 장소들과 리뷰를 확인하세요',
    action: () => navigate('/visit-history'),
    color: theme.palette.success.main,
    motion: {
      whileHover: { scale: 1.05, y: -5 },
      whileTap: { scale: 0.98 }
    }
  }
];

// 로그인하지 않은 경우 액션 수정
const guestQuickActions = [
  {
    ...quickActions[0],
    action: () => navigate('/login?redirect=/recommendations')
  },
  {
    icon: <AccountIcon fontSize="large" />,
    title: '로그인',
    description: '프로필을 설정하고 맞춤형 추천을 받아보세요',
    action: () => navigate('/login'),
    color: theme.palette.info.main,
    motion: {
      whileHover: { scale: 1.05, y: -5 },
      whileTap: { scale: 0.98 }
    }
  },
  {
    icon: <SearchIcon fontSize="large" />,
    title: '장소 검색',
    description: '다양한 장소와 경험을 검색해보세요',
    action: () => navigate('/search'),
    color: theme.palette.warning.main,
    motion: {
      whileHover: { scale: 1.05, y: -5 },
      whileTap: { scale: 0.98 }
    }
  }
];

return (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={preferReducedMotion ? {} : containerVariants}
  >
    <Container maxWidth="lg">
      {/* 오류 알림 - 개선된 오류 표시 */}
      <Snackbar 
        open={showError} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 6 }}
      >
        <Alert 
          onClose={handleCloseError} 
          severity="error" 
          sx={{ width: '100%' }}
          icon={isOfflineMode ? <WifiOffIcon /> : <ErrorIcon />}
        >
          {error || '오류가 발생했습니다.'}
          {dataFetchFailed && (
            <Button 
              size="small" 
              sx={{ ml: 1 }} 
              onClick={handleRefresh} 
              color="inherit"
            >
              재시도
            </Button>
          )}
        </Alert>
      </Snackbar>
      
      {/* 오프라인 배너 - 간단한 대체 배너 */}
      {isOfflineMode && (
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'warning.light',
            color: 'warning.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 1
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WifiOffIcon sx={{ mr: 1 }} />
            <Typography variant="body2">오프라인 모드입니다. 일부 기능이 제한됩니다.</Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            새로고침
          </Button>
        </Paper>
      )}
      
      {/* 새 앱 버전 알림 */}
      <Dialog
        open={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
        aria-labelledby="update-dialog-title"
      >
        <DialogTitle id="update-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            새 버전 이용 가능
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            MyTripStyle의 새로운 버전을 사용할 수 있습니다. 
            업데이트하면 새로운 기능과 성능 개선을 이용할 수 있습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUpdateDialog(false)}>나중에</Button>
          <Button 
            onClick={handleUpdateInstall} 
            variant="contained" 
            color="primary" 
            autoFocus
          >
            지금 업데이트
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 히어로 섹션 - 애니메이션 추가 */}
      <motion.div variants={preferReducedMotion ? {} : itemVariants}>
        <Box 
          sx={{ 
            textAlign: 'center', 
            py: { xs: 6, md: 8 },
            mb: 2,
            position: 'relative',
            minHeight: '30vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
          >
            <Typography 
              variant={isMobile ? "h4" : "h3"} 
              component="h1" 
              gutterBottom
              sx={{ 
                fontWeight: 'bold',
                color: 'primary.main',
                letterSpacing: 1
              }}
            >
              MyTripStyle
            </Typography>
          </motion.div>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Typography 
              variant="h6" 
              component="h2" 
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              당신만의 스타일로 떠나는 여행
            </Typography>
          </motion.div>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Chip
              icon={<TravelIcon />}
              label={currentUser ? "맞춤 추천 시작하기" : "여행 스타일 탐색하기"}
              color="primary"
              variant="outlined"
              onClick={scrollToSearch}
              sx={{ 
                py: 2.5, 
                px: 1,
                fontSize: '1rem',
                fontWeight: 'medium',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText'
                }
              }}
            />
          </motion.div>
          
          {/* 네트워크 상태 표시 - 간단히 오프라인만 표시 */}
          {isOfflineMode && (
            <Chip
              icon={<WifiOffIcon />}
              label="오프라인 모드"
              color="warning"
              size="small"
              variant="outlined"
              sx={{ mt: 2, opacity: 0.8 }}
            />
          )}
          
          {/* 스크롤 아래로 프롬프트 */}
          <Fade in={showScrollPrompt}>
            <motion.div
              variants={preferReducedMotion ? {} : pulseVariants}
              initial="initial"
              animate="pulse"
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                cursor: 'pointer'
              }}
              onClick={scrollToSearch}
            >
              <ArrowDownwardIcon color="primary" />
            </motion.div>
          </Fade>
        </Box>
      </motion.div>

      {/* 검색 섹션 - 애니메이션 및 레퍼런스 추가 */}
      <motion.div 
          variants={preferReducedMotion ? {} : itemVariants}
          ref={searchSectionRef}
        >
          <Box 
            sx={{ 
              my: 4, 
              p: { xs: 2, md: 3 }, 
              bgcolor: 'background.paper', 
              borderRadius: 2,
              boxShadow: scrolled ? 3 : 1,
              transition: 'box-shadow 0.3s ease-in-out'
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <Typography 
                variant="h6" 
                gutterBottom 
                align="center"
                sx={{ 
                  fontWeight: 'medium',
                  color: 'text.primary'
                }}
              >
                어떤 장소를 찾고 계신가요?
              </Typography>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  mt: 2,
                  width: '100%'
                }}
              >
                <SearchBar 
                  fullWidth={true} 
                  showRecentSearches={true} 
                  placeholder="장소, 카테고리, 지역 검색..."
                  elevation={2}
                  sx={{
                    maxWidth: { xs: '100%', md: '80%' },
                    borderRadius: '24px'
                  }}
                />
              </Box>
            </motion.div>
          </Box>
        </motion.div>

        {/* 빠른 액션 버튼 - 사용자 및 PWA 상태에 따라 다른 액션 표시 */}
        <motion.div variants={preferReducedMotion ? {} : itemVariants}>
          <QuickActions 
            actions={currentUser ? quickActions : guestQuickActions} 
            animation={{
              container: preferReducedMotion ? {} : {
                hidden: { opacity: 0 },
                visible: { 
                  opacity: 1,
                  transition: { 
                    staggerChildren: 0.15,
                    delayChildren: 0.2
                  }
                }
              },
              item: preferReducedMotion ? {} : {
                hidden: { y: 20, opacity: 0 },
                visible: { 
                  y: 0, 
                  opacity: 1,
                  transition: { 
                    type: "spring",
                    stiffness: 300,
                    damping: 24
                  }
                }
              }
            }}
          />
        </motion.div>
        
        {/* 최근 활동 (로그인한 경우만) - 독립적인 로딩 상태 적용 */}
        {currentUser && (
          <motion.div 
            variants={preferReducedMotion ? {} : fadeInVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.4 }}
          >
            <RecentActivities 
              onLoadingChange={(isLoading) => 
                setSectionLoading(prev => ({ ...prev, recentActivities: isLoading }))
              }
            />
          </motion.div>
        )}

        {/* 추천 섹션 - 스켈레톤 로딩 및 에러 UI 개선 */}
        <motion.div 
          variants={preferReducedMotion ? {} : itemVariants}
          ref={recommendationSectionRef}
        >
          <Box sx={{ my: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography 
                variant="h5" 
                component="h2" 
                sx={{ fontWeight: 'medium' }}
              >
                오늘의 추천 장소
              </Typography>
              <Zoom in={featuredPlaces.length > 0 && !sectionLoading.recommendations}>
                <Chip 
                  label={`${featuredPlaces.length}개`} 
                  size="small" 
                  color="primary" 
                  sx={{ ml: 1 }} 
                />
              </Zoom>
              {/* 네트워크 상태 표시 - 간소화 */}
              {!isOfflineMode && !sectionLoading.recommendations && (
                <Chip 
                  label="온라인"
                  size="small"
                  color="default"
                  variant="outlined"
                  sx={{ ml: 1, fontSize: '0.75rem' }}
                />
              )}
              {/* 로딩 중이 아닐 때만 새로고침 버튼 표시 */}
              {!sectionLoading.recommendations && (
                <Button
                  startIcon={<RefreshIcon />}
                  size="small"
                  onClick={handleRefresh}
                  disabled={isLoading || isUserLoading}
                  sx={{ ml: 'auto', fontSize: '0.8rem' }}
                >
                  새로고침
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            {/* 로딩 상태 표시 - 스켈레톤 로더 추가 */}
            {sectionLoading.recommendations || isUserLoading ? (
              <Fade in={true} timeout={500}>
                <Box sx={{ width: '100%' }}>
                  <SkeletonLoader />
                </Box>
              </Fade>
            ) : featuredPlaces.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                py: 6,
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: 1
              }}>
                {isOfflineMode ? (
                  <>
                    <WifiOffIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary" align="center">
                      오프라인 모드에서 추천 정보를 불러올 수 없습니다.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                      네트워크 연결이 복구되면 자동으로 새로고침됩니다.
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" color="text.secondary" align="center">
                      추천 장소를 불러올 수 없습니다.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                      {currentUser 
                        ? "프로필 정보를 더 입력하여 맞춤 추천을 받아보세요." 
                        : "로그인하면 맞춤 추천을 받을 수 있습니다."}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      color="primary" 
                      size="small" 
                      onClick={handleRefresh}
                      sx={{ mt: 2 }}
                      startIcon={<RefreshIcon />}
                    >
                      다시 시도
                    </Button>
                  </>
                )}
              </Box>
            ) : (
              <Fade in={!sectionLoading.recommendations && !isUserLoading} timeout={800}>
                <div>
                  <RecommendationSection 
                    places={featuredPlaces} 
                    animation={{
                      fadeIn: !preferReducedMotion,
                      stagger: !preferReducedMotion,
                      hoverEffect: !preferReducedMotion
                    }}
                    onRefresh={handleRefresh} 
                    isOfflineMode={isOfflineMode}
                  />
                </div>
              </Fade>
            )}
          </Box>
        </motion.div>

        {/* 추가 정보 섹션 - 애니메이션 및 UI 개선 */}
        <motion.div variants={preferReducedMotion ? {} : itemVariants}>
          <Box sx={{ my: 5 }}>
            <Grid container spacing={isTablet ? 4 : 3}>
              <Grid item xs={12} md={6}>
                <motion.div
                  whileHover={preferReducedMotion ? {} : { y: -5, boxShadow: theme.shadows[5] }}
                  transition={{ duration: 0.3 }}
                >
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      p: { xs: 2, md: 3 }, 
                      height: '100%',
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <motion.div 
                      className="paper-background"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.04 }}
                      transition={{ duration: 1 }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'url(/assets/images/mbti_pattern.svg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        zIndex: 0
                      }}
                    />
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        <LocationIcon color="primary" sx={{ verticalAlign: 'middle', mr: 1 }} />
                        MBTI 성향에 맞는 장소
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        당신의 MBTI 성향에 맞는 장소를 찾아보세요. 외향적인 분들에게는
                        활기찬 장소를, 내향적인 분들에게는 조용하고 편안한 공간을 추천해드립니다.
                      </Typography>
                      <motion.div whileHover={{ x: 5 }} whileTap={{ x: 0 }}>
                        <Button 
                          variant="text" 
                          color="primary"
                          onClick={() => navigate('/recommendations')}
                          sx={{ fontWeight: 'medium' }}
                          disabled={isOfflineMode && !currentUser}
                        >
                          맞춤 추천 더 보기
                        </Button>
                      </motion.div>
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
              <Grid item xs={12} md={6}>
                <motion.div
                  whileHover={preferReducedMotion ? {} : { y: -5, boxShadow: theme.shadows[5] }}
                  transition={{ duration: 0.3 }}
                >
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      p: { xs: 2, md: 3 }, 
                      height: '100%',
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <motion.div 
                      className="paper-background"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.04 }}
                      transition={{ duration: 1 }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'url(/assets/images/emotion_pattern.svg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        zIndex: 0
                      }}
                    />
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        <EmoticonIcon color="primary" sx={{ verticalAlign: 'middle', mr: 1 }} />
                        현재 감정에 맞는 경험
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        지금 기분이 어떠신가요? 현재의 감정 상태에 맞는 장소를 추천해드립니다.
                        스트레스 받을 때, 기쁠 때, 설렐 때 각각 다른 특별한 장소를 발견하세요.
                      </Typography>
                      <motion.div whileHover={{ x: 5 }} whileTap={{ x: 0 }}>
                        <Button 
                          variant="text" 
                          color="primary"
                          onClick={() => navigate(currentUser ? '/recommendations' : '/login')}
                          sx={{ fontWeight: 'medium' }}
                          disabled={isOfflineMode && !currentUser}
                        >
                          감정 기반 추천 보기
                        </Button>
                      </motion.div>
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            </Grid>
          </Box>
        </motion.div>

        {/* 오프라인 모드 안내 섹션 - 간소화 */}
        {isOfflineMode && (
          <motion.div variants={preferReducedMotion ? {} : itemVariants}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                my: 3,
                borderRadius: 2,
                bgcolor: 'warning.light',
                color: 'warning.contrastText'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WifiOffIcon sx={{ mr: 1.5 }} />
                <Typography variant="body2">
                  오프라인 모드에서는 일부 기능이 제한됩니다. 저장된 데이터만 표시됩니다.
                </Typography>
              </Box>
            </Paper>
          </motion.div>
        )}

        {/* 네트워크 상태 및 로딩 표시 (모바일 기기에 특화) */}
        {isMobile && (
          <Box 
            sx={{ 
              position: 'fixed', 
              bottom: 16, 
              right: 16,
              zIndex: 1000
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: sectionLoading.recommendations || sectionLoading.recentActivities ? 1 : 0,
                scale: sectionLoading.recommendations || sectionLoading.recentActivities ? 1 : 0
              }}
              transition={{ duration: 0.3 }}
            >
              <Paper 
                elevation={3} 
                sx={{ 
                  borderRadius: '50%', 
                  width: 56, 
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText'
                }}
              >
                <CircularProgress 
                  size={30} 
                  thickness={5} 
                  color="inherit"
                />
              </Paper>
            </motion.div>
          </Box>
        )}
      </Container>
    </motion.div>
  );
};

export default Home;
