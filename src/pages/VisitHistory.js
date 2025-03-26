// src/pages/VisitHistory.js - 애니메이션 버그 수정 및 성능 측정 함수 수정 버전
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardMedia,
  Button,
  IconButton,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  Badge
} from '@mui/material';
import { 
  History as HistoryIcon,
  CalendarMonth as CalendarIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSavedPlaces } from '../contexts/SavedPlacesContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
// startPerformanceMeasure 대신 measurePerformance 함수 사용
import { measurePerformance } from '../utils/optimizationUtils';

// 새로 추가된 임포트
import PullToRefresh from '../components/common/PullToRefresh';
import InfiniteScroll from '../components/common/InfiniteScroll';
// framer-motion 임포트 추가
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, slideInVariants, hoverEffect } from '../utils/animationUtils';

// 탭 패널 컴포넌트 - 애니메이션 추가
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`visit-tabpanel-${index}`}
      aria-labelledby={`visit-tab-${index}`}
      {...other}
    >
      <AnimatePresence mode="wait">
        {value === index && (
          <motion.div
            key={`tab-panel-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ p: 3 }}>
              {children}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 방문 계획 아이템 컴포넌트 - 애니메이션 추가
const PlannedVisitItem = ({ visit, onComplete, onEdit, onDelete, index }) => {
  const navigate = useNavigate();
  // visit.visitDate가 있는지 확인 후 날짜 계산
  const daysUntil = visit.visitDate ? 
    Math.ceil((new Date(visit.visitDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
  
  // 애니메이션 변수 추가
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: {
        delay: index * 0.05,
        type: 'spring',
        stiffness: 260,
        damping: 20
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      transition: { duration: 0.2 } 
    }
  };
  
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={hoverEffect}
      layoutId={`planned-visit-${visit.id}`}
    >
      <Card sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
          <motion.div whileHover={{ scale: 1.05 }}>
            <CardMedia
              component="img"
              sx={{ 
                width: { xs: '100%', sm: 120 }, 
                height: { xs: 140, sm: 120 },
                objectFit: 'cover'
              }}
              image={visit.place?.photos?.[0] || '/placeholder-image.jpg'}
              alt={visit.place?.name || '장소 이미지'}
            />
          </motion.div>
          <CardContent sx={{ flex: '1 0 auto', position: 'relative' }}>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              component="div" 
              onClick={() => navigate(`/place/${visit.place?.id || visit.placeId}`)} 
              sx={{ cursor: 'pointer' }}
            >
              {visit.place?.name || '알 수 없는 장소'}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <motion.div
                whileHover={{ scale: 1.2, rotate: 10 }}
                style={{ display: 'inline-flex', marginRight: 8 }}
              >
                <CalendarIcon fontSize="small" color="primary" />
              </motion.div>
              <Typography variant="body2" color="text.secondary">
                {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : '날짜 정보 없음'} 
                {daysUntil > 0 ? 
                  ` (${daysUntil === 1 ? '내일' : `${daysUntil}일 후`})` : 
                  daysUntil === 0 ? ' (오늘)' : ' (지남)'
                }
              </Typography>
            </Box>
            
            {visit.note && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {visit.note}
                </Typography>
              </motion.div>
            )}
            
            <Box sx={{ display: 'flex', mt: 1, gap: 1 }}>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<CheckCircleIcon />}
                  onClick={() => onComplete(visit.id)}
                  color="success"
                >
                  방문 완료
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <IconButton size="small" onClick={() => onEdit(visit)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 10 }} 
                whileTap={{ scale: 0.9 }}
              >
                <IconButton size="small" onClick={() => onDelete(visit.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </motion.div>
            </Box>
          </CardContent>
        </Box>
      </Card>
    </motion.div>
  );
};

// 방문 기록 아이템 컴포넌트 - 애니메이션 추가
const VisitHistoryItem = ({ visit, onReview, index }) => {
  const navigate = useNavigate();
  
  // 안전하게 날짜 변환
  const formatDate = (dateStr) => {
    try {
      if (!dateStr) return '날짜 정보 없음';
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return '날짜 정보 없음';
      }
      
      // 현지화된 날짜 문자열
      const localDateStr = date.toLocaleDateString();
      
      // 상대적 시간 (예: '3일 전')
      try {
        const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: ko });
        return `${localDateStr} (${relativeTime})`;
      } catch (formatError) {
        console.error('상대 시간 변환 오류:', formatError);
        return localDateStr; // 포맷팅 실패 시 날짜만 표시
      }
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return '날짜 정보 없음';
    }
  };
  
  // 애니메이션 변수 추가
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: {
        delay: index * 0.05,
        type: 'spring',
        stiffness: 260,
        damping: 20
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      transition: { duration: 0.2 } 
    }
  };
  
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={hoverEffect}
      layoutId={`history-visit-${visit.id}`}
    >
      <Card sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
          <motion.div whileHover={{ scale: 1.05 }}>
            <CardMedia
              component="img"
              sx={{ 
                width: { xs: '100%', sm: 120 }, 
                height: { xs: 140, sm: 120 },
                objectFit: 'cover'
              }}
              image={visit.place?.photos?.[0] || '/placeholder-image.jpg'}
              alt={visit.place?.name || '장소 이미지'}
            />
          </motion.div>
          <CardContent sx={{ flex: '1 0 auto' }}>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              component="div" 
              onClick={() => navigate(`/place/${visit.placeId}`)} 
              sx={{ cursor: 'pointer' }}
            >
              {visit.place?.name || '알 수 없는 장소'}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <motion.div
                whileHover={{ scale: 1.2, rotate: -10 }}
                style={{ display: 'inline-flex', marginRight: 8 }}
              >
                <HistoryIcon fontSize="small" color="action" />
              </motion.div>
              <Typography variant="body2" color="text.secondary">
                {visit.visitDate ? formatDate(visit.visitDate) : '날짜 정보 없음'}
              </Typography>
            </Box>
            
            {visit.rating > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Rating value={visit.rating} readOnly size="small" />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {visit.rating}/5
                  </Typography>
                </Box>
              </motion.div>
            )}
            
            {visit.review && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {visit.review.length > 100 ? `${visit.review.substring(0, 100)}...` : visit.review}
                </Typography>
              </motion.div>
            )}
            
            {!visit.review && !visit.rating && (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<AddIcon />}
                  onClick={() => onReview(visit)}
                  sx={{ mt: 1 }}
                >
                  리뷰 작성
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Box>
      </Card>
    </motion.div>
  );
};

const VisitHistory = () => {
  const [tabValue, setTabValue] = useState(0);
  const { 
    plannedVisits, 
    visitHistory, 
    loading, 
    error,
    completePlannedVisit, 
    updatePlannedVisit, 
    deletePlannedVisit, 
    addReview,
    refreshData
  } = useSavedPlaces();
  const { isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [currentVisit, setCurrentVisit] = useState(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);
  
  // 페이지네이션 관련 상태 추가
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePlannedItems, setHasMorePlannedItems] = useState(false);
  const [hasMoreHistoryItems, setHasMoreHistoryItems] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 5; // 페이지당 아이템 수

  // 정렬된 방문 계획 및 기록 (메모이제이션)
  const sortedPlannedVisits = useMemo(() => {
    if (!Array.isArray(plannedVisits)) return [];
    
    // 성능 측정 시작 마크
    const startMark = `sort-planned-visits-start-${Date.now()}`;
    const endMark = `sort-planned-visits-end-${Date.now()}`;
    performance.mark(startMark);
    
    // 날짜 기준 정렬 (가까운 날짜 순)
    const sorted = [...plannedVisits].sort((a, b) => {
      try {
        const dateA = a.visitDate ? new Date(a.visitDate) : new Date(9999, 11, 31);
        const dateB = b.visitDate ? new Date(b.visitDate) : new Date(9999, 11, 31);
        return dateA - dateB;
      } catch (error) {
        console.error('방문 계획 정렬 오류:', error);
        return 0;
      }
    });
    
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('방문 계획 정렬', startMark, endMark, 'interactions');
    
    return sorted;
  }, [plannedVisits]);
  
  const sortedVisitHistory = useMemo(() => {
    if (!Array.isArray(visitHistory)) return [];
    
    // 성능 측정 시작 마크
    const startMark = `sort-visit-history-start-${Date.now()}`;
    const endMark = `sort-visit-history-end-${Date.now()}`;
    performance.mark(startMark);
    
    // 날짜 기준 정렬 (최신 순)
    const sorted = [...visitHistory].sort((a, b) => {
      try {
        const dateA = a.visitedAt ? new Date(a.visitedAt) : 
                  a.visitDate ? new Date(a.visitDate) : new Date(0);
        const dateB = b.visitedAt ? new Date(b.visitedAt) : 
                  b.visitDate ? new Date(b.visitDate) : new Date(0);
        return dateB - dateA; // 최신 방문 먼저 (내림차순)
      } catch (error) {
        console.error('방문 기록 정렬 오류:', error);
        return 0;
      }
    });
    
    // 성능 측정 종료
    performance.mark(endMark);
    measurePerformance('방문 기록 정렬', startMark, endMark, 'interactions');
    
    return sorted;
  }, [visitHistory]);
  
  // 페이지네이션된 아이템 (메모이제이션)
  const plannedItemsInfo = useMemo(() => {
    const endIndex = currentPage * PAGE_SIZE;
    const items = sortedPlannedVisits.slice(0, endIndex);
    
    // 더 로드할 아이템이 있는지 확인
    setHasMorePlannedItems(endIndex < sortedPlannedVisits.length);
    
    return items;
  }, [sortedPlannedVisits, currentPage, PAGE_SIZE]);

  const historyItemsInfo = useMemo(() => {
    const endIndex = currentPage * PAGE_SIZE;
    const items = sortedVisitHistory.slice(0, endIndex);
    
    // 더 로드할 아이템이 있는지 확인
    setHasMoreHistoryItems(endIndex < sortedVisitHistory.length);
    
    return items;
  }, [sortedVisitHistory, currentPage, PAGE_SIZE]);

  // 수동 새로고침 핸들러
  const handleManualRefresh = useCallback(async () => {
    if (!isAuthenticated || !currentUser) {
      console.log("VisitHistory - 인증되지 않은 사용자, 새로고침 불가");
      setSnackbar({
        open: true,
        message: '로그인이 필요합니다.',
        severity: 'warning'
      });
      return;
    }

    if (isRefreshing) return; // 중복 실행 방지
    
    // 성능 측정 시작 마크
    const startMark = `refreshData-start-${Date.now()}`;
    const endMark = `refreshData-end-${Date.now()}`;
    performance.mark(startMark);
    
    setIsRefreshing(true);
    console.log("VisitHistory - 데이터 새로고침 시작");
    
    try {
      await refreshData();
      
      // 페이지네이션 초기화
      setCurrentPage(1);
      
      setSnackbar({
        open: true,
        message: '방문 계획 및 기록이 새로고침되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error("VisitHistory - 데이터 새로고침 오류:", err);
      setSnackbar({
        open: true,
        message: `새로고침 실패: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setIsRefreshing(false);
      
      // 성능 측정 종료
      performance.mark(endMark);
      measurePerformance('방문 데이터 새로고침', startMark, endMark, 'interactions');
    }
  }, [isAuthenticated, currentUser, isRefreshing, refreshData]);
  
  // 더 많은 아이템 로드 함수 (탭에 따라 다른 함수 호출)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    
    // 성능 측정 시작 마크
    const startMark = tabValue === 0 ? 
      `load-more-planned-start-${Date.now()}` : 
      `load-more-history-start-${Date.now()}`;
    const endMark = tabValue === 0 ? 
      `load-more-planned-end-${Date.now()}` : 
      `load-more-history-end-${Date.now()}`;
    performance.mark(startMark);
    
    try {
      setLoadingMore(true);
      
      // 페이지 증가
      setCurrentPage(prev => prev + 1);
      
      // 실제 API에서는 여기서 추가 데이터를 가져올 수 있음
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error('더 많은 항목 로드 오류:', error);
    } finally {
      setLoadingMore(false);
      
      // 성능 측정 종료
      performance.mark(endMark);
      measurePerformance(
        tabValue === 0 ? '계획 항목 추가 로드' : '기록 항목 추가 로드', 
        startMark, 
        endMark,
        'interactions'
      );
    }
  }, [tabValue, loadingMore]);
  
  // 인증 상태 확인 및 리디렉션
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      // 로그인 페이지로 리디렉션
      navigate('/login?redirect=/visits', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);
  
  // 데이터 초기화 확인
  useEffect(() => {
    // 로딩이 끝났고, 데이터가 아직 초기화되지 않았으며, 사용자가 로그인되어 있을 때
    if (!loading && !dataInitialized && isAuthenticated && currentUser) {
      console.log('VisitHistory 컴포넌트 - 데이터 초기화 확인');
      
      // plannedVisits와 visitHistory가 배열이 아니거나 undefined인 경우
      if (!Array.isArray(plannedVisits) || !Array.isArray(visitHistory)) {
        console.warn('방문 데이터가 올바르게 로드되지 않았습니다:', {
          plannedVisits,
          visitHistory
        });
        
        // 데이터 새로고침
        handleManualRefresh();
      } else {
        console.log('방문 데이터가 올바르게 로드됨:', {
          plannedVisitsCount: plannedVisits.length,
          visitHistoryCount: visitHistory.length
        });
      }
      
      setDataInitialized(true);
      setCurrentPage(1); // 페이지 초기화
    }
  }, [loading, dataInitialized, isAuthenticated, currentUser, plannedVisits, visitHistory, handleManualRefresh]);
  
  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setCurrentPage(1); // 탭 변경 시 페이지 초기화
  };

  // 방문 완료 핸들러
  const handleCompleteVisit = async (visitId) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await completePlannedVisit(visitId);
      setSnackbar({
        open: true,
        message: '방문이 완료되었습니다. 리뷰를 작성해보세요!',
        severity: 'success'
      });
    } catch (error) {
      console.error('방문 완료 처리 오류:', error);
      setSnackbar({
        open: true,
        message: `방문 완료 처리 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 방문 계획 편집 핸들러
  const handleEditVisit = (visit) => {
    setCurrentVisit(visit);
    setVisitDate(visit.visitDate || '');
    setVisitNote(visit.note || '');
    setEditDialogOpen(true);
  };
  
  // 방문 계획 삭제 핸들러
  const handleDeleteVisit = async (visitId) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await deletePlannedVisit(visitId);
      setSnackbar({
        open: true,
        message: '방문 계획이 삭제되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('방문 계획 삭제 오류:', error);
      setSnackbar({
        open: true,
        message: `방문 계획 삭제 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 방문 계획 업데이트 핸들러
  const handleUpdateVisit = async () => {
    if (!currentVisit || isProcessing) return;
    
    setIsProcessing(true);
    try {
      await updatePlannedVisit(currentVisit.id, { 
        visitDate,
        note: visitNote 
      });
      
      setEditDialogOpen(false);
      setSnackbar({
        open: true,
        message: '방문 계획이 업데이트되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('방문 계획 업데이트 오류:', error);
      setSnackbar({
        open: true,
        message: `방문 계획 업데이트 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 리뷰 작성 다이얼로그 열기 핸들러
  const handleOpenReviewDialog = (visit) => {
    setCurrentVisit(visit);
    // 이미 있는 리뷰와 평점 로드 (초기화)
    setReviewRating(visit.rating || 0);
    setReviewText(visit.review || '');
    setReviewDialogOpen(true);
  };
  
  // 리뷰 텍스트 변경 핸들러 - 새로 추가
  const handleReviewTextChange = (e) => {
    const newText = e.target.value || '';
    console.log(`리뷰 텍스트 업데이트: [${newText}], 길이: ${newText.length}`);
    setReviewText(newText);
  };
  
  // 리뷰 저장 핸들러 - 수정된 버전
  const handleSaveReview = async () => {
    if (!currentVisit || isProcessing) return;
    
    // 평점 체크 (필수)
    if (reviewRating === 0) {
      setSnackbar({
        open: true,
        message: '평점을 선택해주세요.',
        severity: 'warning'
      });
      return;
    }
    
    setIsProcessing(true);
    console.log(`리뷰 저장 시작 - 방문 ID: ${currentVisit.id}`);
    console.log(`저장할 리뷰 데이터: 평점=${reviewRating}, 내용=${reviewText}`);
    
    try {
      // 리뷰 데이터 형식 확인
      const reviewData = {
        rating: reviewRating,
        review: reviewText || '' // 빈 문자열을 기본값으로 설정
      };
      
      // 콘솔에 전송되는 데이터 로깅
      console.log('전송 데이터:', JSON.stringify(reviewData));
      
      // addReview 함수 호출
      await addReview(currentVisit.id, reviewData);
      
      // 다이얼로그 닫기
      setReviewDialogOpen(false);
      
      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: '리뷰가 성공적으로 저장되었습니다!',
        severity: 'success'
      });
    } catch (error) {
      console.error('리뷰 저장 오류:', error);
      setSnackbar({
        open: true,
        message: `리뷰 저장 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 스낵바 닫기 핸들러
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // 로딩 애니메이션
  const loadingVariants = {
    animate: {
      scale: [1, 1.1, 1],
      rotate: [0, 0, 180, 180, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // 로딩 중 표시
  if (loading && !dataInitialized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flexDirection: 'column' }}>
        <motion.div
          animate="animate"
          variants={loadingVariants}
        >
          <CircularProgress size={60} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Typography variant="h6" sx={{ mt: 2 }}>방문 정보를 불러오는 중...</Typography>
        </motion.div>
      </Box>
    );
  }
  
  // 로그인 필요 안내
  if (!isAuthenticated && !loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20
              }}
            >
              <HistoryIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            </motion.div>
            <Typography variant="h5" gutterBottom>
              로그인이 필요합니다
            </Typography>
            <Typography variant="body1" paragraph>
              방문 계획과 기록을 보려면 로그인해주세요.
            </Typography>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant="contained" 
                onClick={() => navigate('/login?redirect=/visits')}
                sx={{ mt: 2 }}
              >
                로그인 페이지로 이동
              </Button>
            </motion.div>
          </Paper>
        </motion.div>
      </Container>
    );
  }

  return (
    <PullToRefresh 
      onRefresh={handleManualRefresh}
      disabled={!isAuthenticated || !currentUser || isRefreshing}
      pullText="당겨서 새로고침"
      releaseText="놓아서 새로고침"
      refreshingText="새로고침 중..."
    >
      <Container maxWidth="md" sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
            방문 계획 및 기록
          </Typography>
        </motion.div>

        {/* 오류 메시지 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          </motion.div>
        )}
        
        {/* 탭 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Paper sx={{ mb: 3, overflow: 'hidden', borderRadius: 2 }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                label={
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <CalendarIcon sx={{ mr: 1 }} />
                    <Box component="span">
                      방문 계획 
                      <Badge 
                        badgeContent={sortedPlannedVisits.length} 
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </motion.div>
                }
                id="visit-tab-0"
                aria-controls="visit-tabpanel-0"
              />
              <Tab 
                label={
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <HistoryIcon sx={{ mr: 1 }} />
                    <Box component="span">
                      방문 기록
                      <Badge 
                        badgeContent={sortedVisitHistory.length} 
                        color="secondary"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </motion.div>
                }
                id="visit-tab-1"
                aria-controls="visit-tabpanel-1"
              />
            </Tabs>
            
            {/* 방문 계획 탭 */}
            <TabPanel value={tabValue} index={0}>
              {plannedItemsInfo.length === 0 ? (
                <motion.div
                  variants={slideInVariants('up')}
                  initial="hidden"
                  animate="visible"
                >
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    {/* 애니메이션 버그 수정: 복잡한 애니메이션을 분리 */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1
                      }}
                      transition={{ 
                        duration: 1,
                        type: "spring",
                        stiffness: 100
                      }}
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 10, 0] }}
                        transition={{
                          duration: 1,
                          type: "keyframes",
                          ease: "easeInOut",
                          times: [0, 0.25, 0.5, 0.75, 1]
                        }}
                      >
                        <CalendarIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      </motion.div>
                    </motion.div>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      방문 계획이 없습니다
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      장소 상세 페이지에서 방문 계획을 추가할 수 있습니다.
                    </Typography>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button 
                        variant="outlined" 
                        onClick={() => navigate('/recommendations')}
                        sx={{ mt: 2 }}
                      >
                        장소 추천 보기
                      </Button>
                    </motion.div>
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <InfiniteScroll
                    loadMore={handleLoadMore}
                    hasMore={hasMorePlannedItems}
                    loading={loadingMore}
                    loadingText="더 많은 방문 계획 불러오는 중..."
                    endMessage="모든 방문 계획을 불러왔습니다."
                    threshold={200}
                  >
                    {plannedItemsInfo.map((visit, index) => (
                      <PlannedVisitItem 
                        key={visit.id}
                        visit={visit}
                        onComplete={handleCompleteVisit}
                        onEdit={handleEditVisit}
                        onDelete={handleDeleteVisit}
                        index={index}
                      />
                    ))}
                  </InfiniteScroll>
                </motion.div>
              )}
            </TabPanel>
            
            {/* 방문 기록 탭 */}
            <TabPanel value={tabValue} index={1}>
              {historyItemsInfo.length === 0 ? (
                <motion.div
                  variants={slideInVariants('up')}
                  initial="hidden"
                  animate="visible"
                >
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    {/* 애니메이션 버그 수정: 복잡한 애니메이션을 분리 */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1
                      }}
                      transition={{ 
                        duration: 1,
                        type: "spring",
                        stiffness: 100
                      }}
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 10, 0] }}
                        transition={{
                          duration: 1,
                          type: "keyframes",
                          ease: "easeInOut",
                          times: [0, 0.25, 0.5, 0.75, 1]
                        }}
                      >
                        <HistoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      </motion.div>
                    </motion.div>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      방문 기록이 없습니다
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      방문 계획을 완료하거나, 장소 상세 페이지에서 바로 방문 기록을 추가할 수 있습니다.
                    </Typography>
                  </Box>
                </motion.div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <InfiniteScroll
                    loadMore={handleLoadMore}
                    hasMore={hasMoreHistoryItems}
                    loading={loadingMore}
                    loadingText="더 많은 방문 기록 불러오는 중..."
                    endMessage="모든 방문 기록을 불러왔습니다."
                    threshold={200}
                  >
                    {historyItemsInfo.map((visit, index) => (
                      <VisitHistoryItem 
                        key={visit.id}
                        visit={visit}
                        onReview={handleOpenReviewDialog}
                        index={index}
                      />
                    ))}
                  </InfiniteScroll>
                </motion.div>
              )}
            </TabPanel>
          </Paper>
        </motion.div>

        {/* 방문 계획 편집 다이얼로그 */}
        <AnimatePresence>
          {editDialogOpen && (
            <Dialog 
              open={editDialogOpen} 
              onClose={() => setEditDialogOpen(false)}
              TransitionComponent={motion.div}
              PaperComponent={(props) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: 'spring', duration: 0.4 }}
                >
                  <Paper {...props} />
                </motion.div>
              )}
            >
              <DialogTitle>방문 계획 수정</DialogTitle>
              <DialogContent>
                <TextField
                  label="방문 예정일"
                  type="date"
                  fullWidth
                  margin="normal"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
                <TextField
                  label="메모"
                  multiline
                  rows={3}
                  fullWidth
                  margin="normal"
                  value={visitNote}
                  onChange={(e) => setVisitNote(e.target.value)}
                  placeholder="방문에 관한 메모를 남겨보세요"
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    onClick={handleUpdateVisit}
                    variant="contained"
                    disabled={isProcessing}
                  >
                    {isProcessing ? '저장 중...' : '저장'}
                  </Button>
                </motion.div>
              </DialogActions>
            </Dialog>
          )}
        </AnimatePresence>
        
        {/* 리뷰 작성 다이얼로그 - 수정된 부분 */}
        <AnimatePresence>
          {reviewDialogOpen && (
            <Dialog 
              open={reviewDialogOpen} 
              onClose={() => !isProcessing && setReviewDialogOpen(false)}
              TransitionComponent={motion.div}
              PaperComponent={(props) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: 'spring', duration: 0.4 }}
                >
                  <Paper {...props} />
                </motion.div>
              )}
            >
              <DialogTitle>
                {currentVisit?.place?.name || '장소'} 리뷰 작성
              </DialogTitle>
              <DialogContent>
                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    평점
                  </Typography>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                  >
                    <Rating
                      name="rating"
                      value={reviewRating}
                      onChange={(event, newValue) => {
                        setReviewRating(newValue);
                      }}
                      precision={0.5}
                      size="large"
                    />
                  </motion.div>
                </Box>
                <TextField
                  label="리뷰 내용"
                  multiline
                  rows={4}
                  fullWidth
                  margin="normal"
                  // 참조 대신 직접 onInput 이벤트에 handleReviewTextChange 함수 연결
                  onInput={handleReviewTextChange}
                  placeholder="이 장소에 대한 리뷰를 작성해주세요"
                />
                
            
              </DialogContent>
              <DialogActions>
                <Button 
                  onClick={() => setReviewDialogOpen(false)}
                  disabled={isProcessing}
                >
                  취소
                </Button>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    onClick={handleSaveReview}
                    variant="contained"
                    color="primary"
                    disabled={isProcessing || reviewRating === 0}
                  >
                    {isProcessing ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                        저장 중...
                      </Box>
                    ) : '리뷰 저장'}
                  </Button>
                </motion.div>
              </DialogActions>
            </Dialog>
          )}
        </AnimatePresence>

        {/* 스낵바 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          TransitionComponent={(props) => (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 15 }}
              {...props}
            />
          )}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity} 
            sx={{ width: '100%' }}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </PullToRefresh>
  );
};

export default VisitHistory;
