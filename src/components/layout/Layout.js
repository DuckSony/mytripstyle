// src/components/layout/Layout.js
import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Container,
  useMediaQuery,
  useTheme,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  SwipeableDrawer,
  Slide,
  Snackbar, 
  Alert, 
  Switch,
  Chip // 추가: Chip 컴포넌트
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  ExploreOutlined as ExploreIcon,
  FavoriteBorder as FavoriteIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  InstallMobile as InstallIcon,
  WifiOff as WifiOffIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  BrightnessLow as BrightnessLowIcon, 
  Sync as SyncIcon,
  Storage as StorageIcon,
  NewReleases as NewReleasesIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  SignalWifiStatusbar4Bar as WifiIcon,
  SignalCellular4Bar as CellularIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import NotificationBadge from '../notifications/NotificationBadge';
import NotificationCenter from '../notifications/NotificationCenter';

// framer-motion 관련 import 최적화
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// 오프라인 관련 컨텍스트 및 유틸리티 주석 처리
// import { useOfflineStatus } from '../../contexts/OfflineContext';
// import { usePwaInstall } from '../../contexts/PwaInstallContext'; 
// import { isInstalledAsPWA } from '../../utils/serviceWorkerRegistration';
// import offlineManager from '../../services/offlineManager';

// 메뉴 항목 정의 - 컴포넌트 외부에 상수로 정의하여 재렌더링 방지
const MENU_ITEMS = [
  { text: '홈', icon: <HomeIcon />, path: '/' },
  { text: '추천', icon: <ExploreIcon />, path: '/recommendations' },
  { text: '저장한 장소', icon: <FavoriteIcon />, path: '/saved-places' },
  { text: '방문 계획/기록', icon: <HistoryIcon />, path: '/visit-history' },
  { text: '검색', icon: <SearchIcon />, path: '/search' },
  { text: '설정', icon: <SettingsIcon />, path: '/settings' },
];

// 서비스 워커가 활성화되었는지 확인 (필요시 사용)
const isServiceWorkerActive = async () => {
  if (!('serviceWorker' in navigator)) return false;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    return !!registration.active;
  } catch {
    return false;
  }
};

// 네트워크 연결 상태에 따른 색상 (필요시 사용)
const getNetworkStatusColor = (isOffline, connectionQuality) => {
  if (isOffline) return 'warning.main';
  if (!connectionQuality) return 'success.main';
  
  if (connectionQuality?.quality === 'poor') return 'warning.main';
  if (connectionQuality?.quality === 'fair') return 'info.main';
  return 'success.main';
};

// 네트워크 유형 아이콘 선택 (필요시 사용)
const getNetworkTypeIcon = (connectionType) => {
  if (connectionType === 'wifi') return <WifiIcon fontSize="small" />;
  if (connectionType === 'cellular') return <CellularIcon fontSize="small" />;
  return null;
};

// 성능 최적화를 위한 메모이제이션된 내부 컴포넌트들
const MemoizedBottomNav = memo(function MemoizedBottomNav({ 
  value, onChange, isMobile, isOffline 
}) {
  // 모바일이 아닌 경우 렌더링하지 않음 - 빠른 리턴으로 성능 최적화
  if (!isMobile) return null;
  
  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 10,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        // will-change 추가로 하드웨어 가속 활성화
        willChange: 'transform',
        // 오프라인 상태일 때 약간 어둡게 처리
        opacity: isOffline ? 0.9 : 1,
        transition: 'opacity 0.3s ease'
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={onChange}
        showLabels
        sx={{
          height: 'var(--bottom-nav-height, 56px)',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            py: 1,
            px: 0.5
          }
        }}
      >
        <BottomNavigationAction 
          label="홈" 
          icon={<HomeIcon />} 
          className="touch-element"
        />
        <BottomNavigationAction 
          label="추천" 
          icon={<ExploreIcon />} 
          className="touch-element"
        />
        <BottomNavigationAction 
          label="저장" 
          icon={<FavoriteIcon />} 
          className="touch-element"
        />
        <BottomNavigationAction 
          label="방문" 
          icon={<HistoryIcon />} 
          className="touch-element"
        />
        <BottomNavigationAction 
          label="검색" 
          icon={<SearchIcon />} 
          className="touch-element"
        />
      </BottomNavigation>
    </Paper>
  );
});

// 성능 최적화를 위한 메모이제이션된 앱바 컴포넌트
const MemoizedAppBar = memo(function MemoizedAppBar({
  showBackButton,
  handleBack,
  toggleDrawer,
  navigate,
  isOffline,
  connectionQuality,
  canInstall,
  handleInstallClick,
  isMobile,
  isSmallScreen,
  handleProfileMenuClick,
  isAuthenticated,
  userProfile,
  getUserAvatar,
  location
}) {
  return (
    <AppBar 
      position="sticky" 
      elevation={1}
      sx={{
        // 더 부드러운 스크롤 애니메이션을 위한 속성
        willChange: 'transform'
      }}
    >
      <Toolbar>
        {/* 뒤로가기 버튼 또는 메뉴 버튼 */}
        {showBackButton ? (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={handleBack}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
        ) : (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        {/* 앱 타이틀 */}
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          MyTripStyle
          
          {/* 네트워크 상태 표시 (오프라인 모드만 표시) */}
          {isOffline && (
            <Tooltip title="오프라인 모드">
              <IconButton 
                size="small" 
                sx={{ ml: 1 }}
              >
                <Badge
                  variant="dot"
                  color="error"
                >
                  <WifiOffIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Typography>
        
        {/* 앱 설치 버튼 - 데스크톱에만 표시 */}
        {canInstall && !isMobile && (
          <Tooltip title="앱 설치하기">
            <IconButton 
              color="inherit" 
              onClick={handleInstallClick}
              size="large"
              edge="end"
              sx={{ mr: 1 }}
            >
              <InstallIcon />
            </IconButton>
          </Tooltip>
        )}
        
        {/* 데스크톱용 네비게이션 메뉴 */}
        {!isMobile && (
          <Box sx={{ display: 'flex' }}>
            {MENU_ITEMS.slice(0, 5).map((item) => (
              <Button 
                key={item.text}
                color="inherit"
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{ 
                  mx: 0.5,
                  fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                  borderBottom: location.pathname === item.path ? '2px solid white' : 'none',
                }}
              >
                {!isSmallScreen && item.text}
              </Button>
            ))}
          </Box>
        )}
        
        {/* 알림 배지 */}
        <NotificationBadge />
        
        {/* 프로필 아이콘 */}
        <IconButton
          color="inherit"
          onClick={handleProfileMenuClick}
          size="large"
          edge="end"
        >
          {isAuthenticated ? (
            <Badge
              color="secondary"
              variant="dot"
              invisible={userProfile?.isProfileComplete !== false}
            >
              {getUserAvatar()}
            </Badge>
          ) : (
            <AccountIcon />
          )}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
});

// 메모이제이션된 내부 컴포넌트: 프로필 메뉴
const ProfileMenu = memo(function ProfileMenu({
  anchorEl,
  open,
  onClose,
  isAuthenticated,
  handleProfileClick,
  handleLoginClick,
  handleLogoutClick
}) {
  // 접근성 최적화 및 성능 향상을 위한 useReducedMotion 추가
  const preferReducedMotion = useReducedMotion();
  
  // 사용자 선호에 따른 애니메이션 조정
  const profileMenuVariants = preferReducedMotion
    ? {
        initial: {}, 
        animate: {},
        exit: {}
      }
    : {
        initial: { opacity: 0, scale: 0.8, y: -20 },
        animate: { 
          opacity: 1, 
          scale: 1, 
          y: 0,
          transition: {
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 1,
            duration: 0.3
          }
        },
        exit: { 
          opacity: 0, 
          scale: 0.8, 
          y: -20,
          transition: {
            duration: 0.2
          }
        }
      };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      PaperProps={{
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
          mt: 1.5
        },
        component: motion.div,
        variants: profileMenuVariants,
        initial: "initial",
        animate: "animate",
        exit: "exit"
      }}
    >
      {isAuthenticated ? (
        <>
          <MenuItem onClick={handleProfileClick}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>프로필</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleLogoutClick}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>로그아웃</ListItemText>
          </MenuItem>
        </>
      ) : (
        <MenuItem onClick={handleLoginClick}>
          <ListItemIcon>
            <LoginIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>로그인</ListItemText>
        </MenuItem>
      )}
    </Menu>
  );
});

// Layout 메인 컴포넌트
const Layout = ({ children, installApp, canInstall, isOffline }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const preferReducedMotion = useReducedMotion();
  
  // 오프라인 관련 컨텍스트 사용 부분 주석 처리
  // const { connectionQuality } = useOfflineStatus();
  
  // 상태 관리 - 최적화를 위해 useRef 활용
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bottomNavValue, setBottomNavValue] = useState(0);
  const [showBackButton, setShowBackButton] = useState(false);
  const [hideAppBar, setHideAppBar] = useState(false);
  const lastScrollTop = useRef(0);
  
  // 스크롤 위치 추적을 위한 디바운스 타이머
  const scrollTimerRef = useRef(null);
  
  // 인증 및 사용자 정보
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { userProfile } = useUser();
  
  // 프로필 메뉴 상태
  const [anchorEl, setAnchorEl] = useState(null);
  const openProfileMenu = Boolean(anchorEl);
  
  // 설치 프롬프트 상태
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // 기본 스낵바 상태 추가
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // 오프라인 상태 관련 변수 임시 구현
  const connectionQuality = null;

  // 스낵바 닫기 핸들러
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // 하단 네비게이션 변경 핸들러 - useCallback으로 최적화
  const handleBottomNavChange = useCallback((event, newValue) => {
    // 같은 탭을 눌렀을 때 스크롤 상단으로 이동
    if (bottomNavValue === newValue) {
      window.scrollTo({ top: 0, behavior: preferReducedMotion ? 'auto' : 'smooth' });
      return;
    }
    
    setBottomNavValue(newValue);
    navigate(MENU_ITEMS[newValue].path);
  }, [bottomNavValue, navigate, preferReducedMotion]);
  
  // 메뉴 토글 핸들러 - 메모이제이션
  const toggleDrawer = useCallback((open) => (event) => {
    if (
      event && 
      event.type === 'keydown' &&
      (event.key === 'Tab' || event.key === 'Shift')
    ) {
      return;
    }
    
    // 모션 감소 선호 사용자를 위한 즉시 전환
    setDrawerOpen(open);
  }, []);
  
  // 뒤로가기 핸들러
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  }, [navigate]);
  
  // 프로필 메뉴 핸들러
  const handleProfileMenuClick = useCallback((event) => {
    setAnchorEl(event.currentTarget);
  }, []);
  
  const handleProfileMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);
  
  const handleProfileClick = useCallback(() => {
    navigate('/profile');
    setAnchorEl(null);
  }, [navigate]);
  
  const handleLoginClick = useCallback(() => {
    navigate('/login');
    setAnchorEl(null);
  }, [navigate]);
  
  const handleLogoutClick = useCallback(async () => {
    try {
      await logout();
      // 홈으로 이동
      navigate('/');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
    setAnchorEl(null);
  }, [logout, navigate]);
  
  // 설치 프롬프트 처리
  const handleInstallClick = useCallback(() => {
    if (canInstall) {
      installApp();
      setShowInstallPrompt(false);
    }
  }, [canInstall, installApp]);

  // 초기 네비게이션 값 설정 - useMemo 대신 useEffect로 경로 변경 시 업데이트
  useEffect(() => {
    setBottomNavValue(getInitialNavValue(location.pathname));
  }, [location.pathname]);

  // 경로에 따른 네비게이션 값 계산
  function getInitialNavValue(path) {
    if (path === '/') return 0;
    if (path === '/recommendations') return 1;
    if (path === '/saved-places') return 2;
    if (path === '/visit-history') return 3;
    if (path === '/search') return 4;
    return 0;
  }
  
  // 스크롤 위치에 따라 헤더 숨기기/표시 처리 - 성능 최적화
  useEffect(() => {
    if (!isMobile) return; // 모바일에서만 적용
    
    const handleScroll = () => {
      // 스크롤 이벤트에 요청 애니메이션 프레임 적용
      if (scrollTimerRef.current) return;
      
      scrollTimerRef.current = requestAnimationFrame(() => {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 상단에 있을 때는 항상 표시
        if (currentScrollTop < 10) {
          setHideAppBar(false);
          lastScrollTop.current = currentScrollTop;
          scrollTimerRef.current = null;
          return;
        }
        
        // 스크롤 방향 감지 - 더 큰 임계값으로 설정하여 불필요한 상태 업데이트 방지
        if (currentScrollTop > lastScrollTop.current + 30) {
          // 아래로 스크롤 - 헤더 숨기기
          setHideAppBar(true);
        } else if (currentScrollTop < lastScrollTop.current - 30) {
          // 위로 스크롤 - 헤더 표시
          setHideAppBar(false);
        }
        
        lastScrollTop.current = currentScrollTop;
        scrollTimerRef.current = null;
      });
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        cancelAnimationFrame(scrollTimerRef.current);
      }
    };
  }, [isMobile]);
  
  // 뒤로 가기 버튼 표시 여부 설정
  useEffect(() => {
    // 뒤로가기 버튼이 필요한 경로 패턴
    const needsBackButton = 
      location.pathname.startsWith('/place/') || 
      location.pathname === '/profile' || 
      location.pathname === '/settings';
    
    setShowBackButton(needsBackButton);
  }, [location.pathname]);

  // 스와이프로 네비게이션 열기/닫기 설정 - 성능 최적화
  const bindDrawerGestures = useDrag(
    ({ down, movement: [mx], cancel, direction: [dx] }) => {
      // 화면 왼쪽 가장자리에서 시작한 오른쪽 스와이프만 처리
      if (dx > 0 && mx > 50 && !drawerOpen) {
        cancel();
        setDrawerOpen(true);
      } else if (dx < 0 && mx < -50 && drawerOpen) {
        cancel();
        setDrawerOpen(false);
      }
    },
    {
      // 스와이프 감지를 위한 설정
      filterTaps: true,
      axis: 'x',
      pointer: { touch: true },
      enabled: isMobile && !preferReducedMotion // 모바일에서만 활성화, 접근성 고려
    }
  );
  
  // 사용자 아바타 가져오기
  const getUserAvatar = useCallback(() => {
    if (isAuthenticated && userProfile?.photoURL) {
      return (
        <Avatar 
          src={userProfile.photoURL} 
          sx={{ width: 32, height: 32 }}
          alt={userProfile?.name || ''}
        />
      );
    } else if (isAuthenticated) {
      return (
        <Avatar 
          sx={{ width: 32, height: 32, bgcolor: 'primary.dark' }}
          alt={userProfile?.name || ''}
        >
          {userProfile?.name?.charAt(0) || <PersonIcon />}
        </Avatar>
      );
    } else {
      return <AccountIcon />;
    }
  }, [isAuthenticated, userProfile]);

  // 애니메이션 설정 - 모션 감소 설정에 따라 조정
  const animConfig = useMemo(() => {
    // 모션 감소 설정이 켜져 있으면 애니메이션 최소화
    if (preferReducedMotion) {
      return {
        duration: 0.1,
        springConfig: {
          stiffness: 100,
          damping: 20,
          mass: 0.5
        },
        fadeConfig: {
          duration: 0.1
        }
      };
    }
    
    // 기본 애니메이션 설정
    return {
      duration: 0.3,
      springConfig: {
        stiffness: 300,
        damping: 30,
        mass: 1
      },
      fadeConfig: {
        duration: 0.3
      }
    };
  }, [preferReducedMotion]);
  
  // 드로어 애니메이션
  const drawerVariants = useMemo(() => ({
    hidden: { x: "-100%" },
    visible: { 
      x: 0,
      transition: {
        type: "spring",
        ...animConfig.springConfig
      }
    }
  }), [animConfig.springConfig]);
  
  // 앱바 슬라이드 애니메이션
  const appBarVariants = useMemo(() => ({
    initial: { y: -60 },
    animate: { 
      y: 0,
      transition: {
        type: "spring",
        ...animConfig.springConfig
      }
    },
    hidden: {
      y: -60,
      transition: {
        type: "spring",
        ...animConfig.springConfig
      }
    }
  }), [animConfig.springConfig]);
  
  // 메뉴 아이템 애니메이션 - 순차적 표시
  const menuItemVariants = useMemo(() => ({
    hidden: { opacity: 0, x: -20 },
    visible: i => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: preferReducedMotion ? 0 : i * 0.05,
        type: "spring",
        ...animConfig.springConfig
      }
    })
  }), [animConfig.springConfig, preferReducedMotion]);
  
  // 설치 프롬프트 애니메이션
  const installPromptVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        type: "spring",
        ...animConfig.springConfig
      }
    },
    exit: { 
      opacity: 0, 
      y: 20,
      transition: {
        duration: animConfig.fadeConfig.duration
      }
    }
  }), [animConfig.springConfig, animConfig.fadeConfig.duration]);

  // 제스처 감지 영역 추가
  return (
    <Box 
      sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      {...(isMobile ? bindDrawerGestures() : {})}
      className="layout-container"
    >
      {/* 앱바 - 모바일에서 스크롤에 따라 숨김/표시 */}
      <Slide appear={false} direction="down" in={!hideAppBar}>
        <motion.div
          initial="initial"
          animate="animate"
          variants={appBarVariants}
        >
          <MemoizedAppBar 
            showBackButton={showBackButton}
            handleBack={handleBack}
            toggleDrawer={toggleDrawer}
            navigate={navigate}
            isOffline={isOffline}
            connectionQuality={connectionQuality}
            canInstall={canInstall}
            handleInstallClick={handleInstallClick}
            isMobile={isMobile}
            isSmallScreen={isSmallScreen}
            handleProfileMenuClick={handleProfileMenuClick}
            isAuthenticated={isAuthenticated}
            userProfile={userProfile}
            getUserAvatar={getUserAvatar}
            location={location}
          />
        </motion.div>
      </Slide>
      
      {/* 사이드 메뉴 드로어 - 애니메이션 적용 */}
      <AnimatePresence>
        {drawerOpen && (
          <SwipeableDrawer
            anchor="left"
            open={drawerOpen}
            onClose={toggleDrawer(false)}
            onOpen={toggleDrawer(true)}
            disableBackdropTransition={false}
            disableDiscovery={!isMobile}
            BackdropProps={{
              invisible: false,
              sx: {
                backdropFilter: preferReducedMotion ? 'none' : 'blur(2px)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)'
              }
            }}
            ModalProps={{
              closeAfterTransition: true,
            }}
            // 성능 최적화: 모바일 환경에서만 스와이프 열기 활성화
            swipeAreaWidth={isMobile ? 20 : 0}
            hysteresis={0.2}
            disableSwipeToOpen={!isMobile}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={drawerVariants}
              transition={{ duration: animConfig.duration }}
              style={{ width: 250 }}
              role="presentation"
              onKeyDown={toggleDrawer(false)}
            >
              {/* 프로필 섹션 추가 */}
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                <Avatar 
                  sx={{ mr: 2, width: 50, height: 50, bgcolor: theme.palette.primary.main }}
                  src={isAuthenticated ? userProfile?.photoURL : undefined}
                >
                  {isAuthenticated ? (
                    userProfile?.name?.charAt(0) || <PersonIcon />
                  ) : (
                    <AccountIcon />
                  )}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1">
                    {isAuthenticated ? userProfile?.name || '프로필' : 'MyTripStyle'}
                  </Typography>
                  {isAuthenticated && (
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 160 }}>
                      {userProfile?.email || currentUser?.email}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Divider />
              
              {/* 로그인/프로필 버튼 추가 */}
              <motion.div
                custom={0}
                variants={menuItemVariants}
                initial="hidden"
                animate="visible"
              >
                {isAuthenticated ? (
                  <ListItem button onClick={handleProfileClick}>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary="프로필 관리" />
                  </ListItem>
                ) : (
                  <ListItem button onClick={handleLoginClick}>
                    <ListItemIcon>
                      <LoginIcon />
                    </ListItemIcon>
                    <ListItemText primary="로그인" />
                  </ListItem>
                )}
              </motion.div>
              <Divider />
              
              {/* PWA 설치 버튼 (설치 가능한 경우에만) */}
              {canInstall && (
                <>
                  <motion.div
                    custom={0.5}
                    variants={menuItemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <ListItem button onClick={handleInstallClick}>
                      <ListItemIcon>
                        <InstallIcon />
                      </ListItemIcon>
                      <ListItemText primary="앱 설치하기" />
                    </ListItem>
                  </motion.div>
                  <Divider />
                </>
              )}
              
              {/* 메뉴 항목 - 애니메이션 적용 */}
              <List>
                {MENU_ITEMS.map((item, idx) => (
                  <motion.div
                    key={item.text}
                    custom={idx + 1}
                    variants={menuItemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <ListItem 
                      button 
                      onClick={() => navigate(item.path)}
                      selected={location.pathname === item.path}
                      className="touch-element btn-tap"
                    >
                      <ListItemIcon 
                        sx={{ 
                          color: location.pathname === item.path ? 'primary.main' : 'inherit' 
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItem>
                  </motion.div>
                ))}
              </List>
              
              {/* 저전력 모드 관련 코드 간소화 */}
              <Box sx={{ px: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  p: 1,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  mt: 1
                }}>
                  <BrightnessLowIcon 
                    fontSize="small"
                    color="action"
                    sx={{ mr: 1 }}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      저전력 모드
                    </Typography>
                  </Box>
                  <Switch
                    size="small"
                    disabled
                  />
                </Box>
              </Box>
              
              {isAuthenticated && (
                <>
                  <Divider />
                  <motion.div
                    custom={MENU_ITEMS.length + 2}
                    variants={menuItemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <ListItem button onClick={handleLogoutClick} className="touch-element btn-tap">
                      <ListItemIcon>
                        <LogoutIcon />
                      </ListItemIcon>
                      <ListItemText primary="로그아웃" />
                    </ListItem>
                  </motion.div>
                </>
              )}
            </motion.div>
          </SwipeableDrawer>
        )}
      </AnimatePresence>
      
      {/* 프로필 메뉴 - 메모이제이션된 컴포넌트 사용 */}
      <AnimatePresence>
        {openProfileMenu && (
          <ProfileMenu
            anchorEl={anchorEl}
            open={openProfileMenu}
            onClose={handleProfileMenuClose}
            isAuthenticated={isAuthenticated}
            handleProfileClick={handleProfileClick}
            handleLoginClick={handleLoginClick}
            handleLogoutClick={handleLogoutClick}
          />
        )}
      </AnimatePresence>
      
      {/* 메인 콘텐츠 */}
      <Box
        sx={{ 
          flex: 1,
          pb: isMobile ? `calc(${theme.spacing(2)} + var(--bottom-nav-height, 56px))` : 2
        }}
        className={isMobile ? "has-bottom-nav" : ""}
      >
        <Container 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            py: 2,
            // 콘텐츠 영역 성능 최적화
            maxWidth: {
              xs: "100%", 
              sm: "540px", 
              md: "720px", 
              lg: "960px", 
              xl: "1140px"
            }
          }}
        >
          {children}
        </Container>
      </Box>
      
      {/* 알림 센터 */}
      <NotificationCenter />
      
      {/* 모바일용 하단 네비게이션 - 메모이제이션된 컴포넌트 사용 */}
      <MemoizedBottomNav 
        value={bottomNavValue} 
        onChange={handleBottomNavChange}
        isMobile={isMobile}
        isOffline={isOffline}
      />
      
      {/* 앱 설치 프롬프트 (모바일에서만 표시) */}
      <AnimatePresence>
        {showInstallPrompt && canInstall && isMobile && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={installPromptVariants}
            style={{
              position: 'fixed',
              bottom: 70, // 하단 네비게이션 바 위에 표시
              left: 16,
              right: 16,
              zIndex: theme.zIndex.snackbar
            }}
          >
            <Paper
              elevation={3}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 2,
                bgcolor: 'primary.light',
                color: 'primary.contrastText'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <InstallIcon sx={{ mr: 1 }} />
                <Typography variant="body2">
                  MyTripStyle을 홈 화면에 추가하세요
                </Typography>
              </Box>
              <Box>
              <Button 
                  size="small" 
                  variant="outlined"
                  color="inherit"
                  onClick={() => setShowInstallPrompt(false)}
                  sx={{ mr: 1 }}
                >
                  나중에
                </Button>
                <Button 
                  size="small" 
                  variant="contained"
                  color="secondary"
                  onClick={handleInstallClick}
                >
                  설치
                </Button>
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 스낵바 알림 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ 
          bottom: isMobile ? 'calc(var(--bottom-nav-height, 56px) + 8px)' : 24 
        }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* 오프라인 상태 표시 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 70 : 4,
            right: 4,
            zIndex: 1000,
            bgcolor: 'rgba(0,0,0,0.6)',
            color: 'white',
            borderRadius: 1,
            p: 0.5,
            fontSize: '0.65rem',
            opacity: 0.7
          }}
        >
          {isOffline ? 'Offline' : 'Online'}
        </Box>
      )}
    </Box>
  );
};

// React.memo로 Layout 컴포넌트 자체를 메모이제이션
export default memo(Layout);
