/**
 * src/components/place/ActionButtons.js
 * 장소 상세 페이지의 액션 버튼 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import { useSavedPlaces } from '../../contexts/SavedPlacesContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Box, 
  Button, 
  Snackbar, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Slide
} from '@mui/material';
import { 
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Share as ShareIcon,
  CalendarMonth as CalendarMonthIcon,
  Directions as DirectionsIcon,
  ContentCopy as ContentCopyIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon
} from '@mui/icons-material';

/**
 * 액션 버튼 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.placeId - 장소 ID
 * @param {string} props.placeName - 장소 이름
 * @param {string} props.placeUrl - 장소 URL
 * @param {boolean} props.initialSaved - 초기 저장 상태
 * @param {boolean} props.isLoading - 로딩 상태
 * @param {Object} props.user - 사용자 객체 (로그인 상태 확인용)
 */
const ActionButtons = ({ 
  placeId, 
  placeName, 
  placeUrl,
  initialSaved = false,
  isLoading: externalLoading = false,
  user
}) => {
  const { toggleSave, isSaved, addPlannedVisit } = useSavedPlaces();
  const { isAuthenticated, currentUser } = useAuth();
  const [savedState, setSavedState] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(externalLoading);
  
  // 상태 관리
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [visitDate, setVisitDate] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [shareMenuAnchorEl, setShareMenuAnchorEl] = useState(null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  
  // 컴포넌트 마운트 시 저장 상태 확인
  useEffect(() => {
    const checkSavedStatus = async () => {
      try {
        setIsLoading(true);
        // 로그인 상태인 경우에만 저장 상태 확인
        if (isAuthenticated && currentUser) {
          const saved = await isSaved(placeId);
          console.log(`ActionButtons - Checked save status for placeId: ${placeId}, Result: ${saved}`);
          setSavedState(saved);
        } else {
          setSavedState(false);
        }
      } catch (err) {
        console.error("Error checking saved status:", err);
        setSavedState(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (placeId) {  // placeId가 존재할 때만 실행
      checkSavedStatus();
    }
  }, [placeId, isSaved, isAuthenticated, currentUser]);

  // 스낵바 닫기 핸들러
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };
  
  // 스낵바 표시 함수
  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  
  // 로그인 확인 함수
  const checkAuthentication = () => {
    if (!isAuthenticated || !currentUser) {
      setLoginDialogOpen(true);
      return false;
    }
    return true;
  };
  
  // 저장 토글 핸들러
  const handleSaveToggle = async () => {
    // 로그인 확인
    if (!checkAuthentication()) return;
    
    try {
      setIsLoading(true);
      console.log(`ActionButtons - Toggling save for placeId: ${placeId}, Current state: ${savedState}`);
      const newSavedState = await toggleSave(placeId);
      console.log(`ActionButtons - New saved state: ${newSavedState}`);
      setSavedState(newSavedState);
      showSnackbar(newSavedState ? '장소가 저장되었습니다.' : '장소 저장이 취소되었습니다.');
      return newSavedState;
    } catch (err) {
      console.error('저장 처리 중 오류:', err);
      showSnackbar('저장 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 방문 계획 다이얼로그 열기 핸들러
  const handleOpenPlanDialog = () => {
    // 로그인 확인
    if (!checkAuthentication()) return;
    
    // 오늘 날짜를 기본으로 설정
    const today = new Date();
    setVisitDate(today.toISOString().split('T')[0]);
    setPlanDialogOpen(true);
  };
  
  // 방문 계획 다이얼로그 닫기 핸들러
  const handleClosePlanDialog = () => {
    setPlanDialogOpen(false);
    setVisitNote('');
  };
  
  // 방문 계획 저장 핸들러
  const handleSavePlan = async () => {
    if (!visitDate) {
      showSnackbar('방문 날짜를 선택해주세요.', 'warning');
      return;
    }
    
    try {
      setIsLoading(true);
      const visitId = await addPlannedVisit(placeId, new Date(visitDate), visitNote);
      console.log(`ActionButtons - Plan visit saved with id: ${visitId}`);
      showSnackbar('방문 계획이 저장되었습니다.');
      handleClosePlanDialog();
    } catch (error) {
      console.error('방문 계획 저장 중 오류:', error);
      showSnackbar('방문 계획 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 공유 메뉴 열기 핸들러
  const handleOpenShareMenu = (event) => {
    setShareMenuAnchorEl(event.currentTarget);
  };
  
  // 공유 메뉴 닫기 핸들러
  const handleCloseShareMenu = () => {
    setShareMenuAnchorEl(null);
  };
  
  // URL 복사 핸들러
  const handleCopyUrl = () => {
    const urlToCopy = placeUrl || window.location.href;
    
    navigator.clipboard.writeText(urlToCopy)
      .then(() => {
        showSnackbar('URL이 클립보드에 복사되었습니다.');
      })
      .catch((error) => {
        console.error('URL 복사 실패:', error);
        showSnackbar('URL 복사에 실패했습니다.', 'error');
      });
    
    handleCloseShareMenu();
  };
  
  // 소셜 미디어 공유 핸들러
  const handleShareSocial = (platform) => {
    const url = encodeURIComponent(placeUrl || window.location.href);
    const title = encodeURIComponent(`MyTripStyle에서 추천하는 장소: ${placeName}`);
    let shareUrl = '';
    
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${title}%20${url}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${title}&body=${url}`;
        break;
      default:
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
    
    handleCloseShareMenu();
  };
  
  // 네이티브 공유 API 사용 핸들러
  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `MyTripStyle에서 추천하는 장소: ${placeName}`,
        text: `MyTripStyle이 추천하는 ${placeName}을(를) 확인해보세요!`,
        url: placeUrl || window.location.href,
      })
      .catch((error) => console.log('공유 중 오류:', error));
    } else {
      handleOpenShareMenu(document.getElementById('share-button'));
    }
  };
  
  // 길찾기 핸들러
  const handleGetDirections = () => {
    // 네이티브 지도 앱으로 연결 (모바일에서 작동)
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(placeName)}`, '_blank');
  };

  // 로그인 다이얼로그 닫기 핸들러
  const handleCloseLoginDialog = () => {
    setLoginDialogOpen(false);
  };

  // 로그인 페이지로 이동
  const handleGoToLogin = () => {
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {/* 저장 버튼 */}
        <Button 
          variant="contained" 
          color={savedState ? "secondary" : "primary"}
          startIcon={savedState ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          onClick={handleSaveToggle}
          disabled={isLoading}
          sx={{ 
            flex: 1,
            transition: 'all 0.3s',
            position: 'relative',
            overflow: 'hidden',
            '&::after': savedState ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)',
              animation: 'ripple 1s linear',
            } : {},
            '@keyframes ripple': {
              '0%': {
                transform: 'scale(0)',
                opacity: 1,
              },
              '100%': {
                transform: 'scale(2.5)',
                opacity: 0,
              },
            },
          }}
        >
          {savedState ? '저장됨' : '저장하기'}
        </Button>
        
        {/* 방문 계획 버튼 */}
        <Button 
          variant="outlined"
          startIcon={<CalendarMonthIcon />}
          onClick={handleOpenPlanDialog}
          disabled={isLoading}
          sx={{ flex: 1 }}
        >
          방문 계획
        </Button>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        {/* 길찾기 버튼 */}
        <Button 
          variant="outlined"
          color="info"
          startIcon={<DirectionsIcon />}
          onClick={handleGetDirections}
          sx={{ flex: 1 }}
        >
          길찾기
        </Button>
        
        {/* 공유 버튼 */}
        <Button 
          id="share-button"
          variant="outlined"
          color="secondary"
          startIcon={<ShareIcon />}
          onClick={navigator.share ? handleNativeShare : handleOpenShareMenu}
          sx={{ flex: 1 }}
        >
          공유하기
        </Button>
      </Box>
      
      {/* 스낵바 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={Slide}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      {/* 방문 계획 다이얼로그 */}
      <Dialog
        open={planDialogOpen}
        onClose={handleClosePlanDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>방문 계획 저장</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {placeName}에 방문할 날짜를 선택해주세요.
          </DialogContentText>
          
          {/* 날짜 선택 - 실제 구현 시 DatePicker 컴포넌트 사용 */}
          <TextField
            label="방문 날짜"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            margin="normal"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
          />
          
          <TextField
            label="메모"
            multiline
            rows={3}
            fullWidth
            margin="normal"
            value={visitNote}
            onChange={(e) => setVisitNote(e.target.value)}
            placeholder="방문 계획에 대한 메모를 남겨보세요."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePlanDialog}>취소</Button>
          <Button 
            variant="contained" 
            onClick={handleSavePlan}
            color="primary"
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 로그인 필요 다이얼로그 */}
      <Dialog
        open={loginDialogOpen}
        onClose={handleCloseLoginDialog}
        aria-labelledby="login-dialog-title"
      >
        <DialogTitle id="login-dialog-title">로그인 필요</DialogTitle>
        <DialogContent>
          <DialogContentText>
            이 기능을 사용하려면 로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLoginDialog}>취소</Button>
          <Button onClick={handleGoToLogin} variant="contained" color="primary">
            로그인 하기
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 공유 메뉴 */}
      <Menu
        anchorEl={shareMenuAnchorEl}
        open={Boolean(shareMenuAnchorEl)}
        onClose={handleCloseShareMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <MenuItem onClick={handleCopyUrl}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>URL 복사</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => handleShareSocial('facebook')}>
          <ListItemIcon>
            <FacebookIcon fontSize="small" sx={{ color: '#1877F2' }} />
          </ListItemIcon>
          <ListItemText>Facebook</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleShareSocial('twitter')}>
          <ListItemIcon>
            <TwitterIcon fontSize="small" sx={{ color: '#1DA1F2' }} />
          </ListItemIcon>
          <ListItemText>Twitter</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleShareSocial('whatsapp')}>
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />
          </ListItemIcon>
          <ListItemText>WhatsApp</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => handleShareSocial('email')}>
          <ListItemIcon>
            <EmailIcon fontSize="small" sx={{ color: '#D44638' }} />
          </ListItemIcon>
          <ListItemText>Email</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ActionButtons;
