// src/components/recommendation/RecommendationCard.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent, CardMedia, Typography, Box, Chip, Rating, 
         IconButton, CardActionArea, Snackbar, Alert, CircularProgress, Tooltip, Skeleton } from '@mui/material';
import { Favorite as FavoriteIcon, FavoriteBorder as FavoriteBorderIcon,
         LocationOn as LocationIcon, AccessTime as AccessTimeIcon,
         SignalWifiConnectedNoInternet4 as OfflineIcon, Person as PersonIcon,
         BrokenImage as BrokenImageIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSavedPlaces } from '../../contexts/SavedPlacesContext';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

// 모바일 디바이스 확인 - 컴포넌트 렌더링마다 재평가되지 않도록 상수로 선언
const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// 디바이스 성능 감지 함수
const detectDevicePerformance = () => {
  const memory = navigator.deviceMemory;
  const concurrency = navigator.hardwareConcurrency;
  
  if (memory && memory <= 4) return 'low';
  if (concurrency && concurrency <= 4) return 'low';
  
  return 'high';
};

// 애니메이션 프리셋 - 성능 수준에 따라 다른 애니메이션 제공
const getAnimationPresets = (performanceLevel, prefersReducedMotion) => {
  // 저사양 기기 또는 접근성 설정에 따른 간소화된 애니메이션
  if (performanceLevel === 'low' || prefersReducedMotion) {
    return {
      hoverEffect: {},
      tapEffect: {},
      cardVariants: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } }
      },
      saveAnimation: null
    };
  }
  
  // 고사양 기기용 풍부한 애니메이션
  return {
    hoverEffect: { scale: 1.02, y: -5 },
    tapEffect: { scale: 0.98 },
    cardVariants: {
      hidden: { opacity: 0, y: 15 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: { 
          duration: 0.4,
          ease: "easeOut" 
        }
      }
    },
    saveAnimation: {
      scale: [1, 1.2, 1],
      transition: { duration: 0.4, type: "tween" }
    }
  };
};

// 카테고리별 색상 정의
const categoryColors = {
  cafe: '#8d6e63',      // 브라운
  healing: '#26a69a',   // 청록색
  restaurant: '#ff7043', // 오렌지
  activity: '#ffca28',  // 앰버
  culture: '#5c6bc0',   // 인디고
  nature: '#66bb6a',    // 초록
  default: '#78909c'    // 기본 블루그레이
};

// 카테고리 한글명
const categoryNames = {
  cafe: '카페',
  healing: '힐링',
  restaurant: '식당',
  activity: '활동',
  culture: '문화',
  nature: '자연',
  default: '기타'
};

// 평점 포맷팅 함수 - 안정적인 방식으로 개선
const getFormattedRating = (rating, defaultValue = 0) => {
  // 평점이 없는 경우 기본값 반환
  if (rating === undefined || rating === null) return defaultValue;
  
  // 숫자인 경우 그대로 반환
  if (typeof rating === 'number') {
    return parseFloat(rating.toFixed(1));
  }
  
  // 객체인 경우 overall 속성 사용
  if (typeof rating === 'object' && rating.overall !== undefined) {
    return parseFloat(rating.overall.toFixed(1));
  }
  
  // 문자열인 경우 숫자로 변환 시도
  if (typeof rating === 'string') {
    const parsed = parseFloat(rating);
    if (!isNaN(parsed)) {
      return parseFloat(parsed.toFixed(1));
    }
  }
  
  // 변환 실패 시 기본값 반환
  return defaultValue;
};

// ID 정규화 함수
const getNormalizedId = (place) => {
  if (!place) return null;
  const id = place.id || place.placeId;
  return id ? String(id) : null;
};

// 이미지 로딩 상태 추적을 위한 메모리 캐시
const imageLoadingCache = new Map();

// 이미지 캐싱을 위한 IntersectionObserver 옵션
const observerOptions = {
  rootMargin: '100px', // 화면에 표시되기 100px 전에 미리 로드
  threshold: 0.1 // 10% 이상 보이면 로드 시작
};

// WebP 지원 여부 확인 (한 번만 계산)
const supportsWebp = (() => {
  if (typeof window === 'undefined') return false;
  
  const elem = document.createElement('canvas');
  if (elem.getContext && elem.getContext('2d')) {
    // WebP를 지원하는지 확인
    return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
})();

// 로컬 이미지 경로 확인 및 최적화된 이미지 URL 생성 함수
const getImageUrl = (url, width = 400, height = 300) => {
  // URL이 없는 경우 기본 이미지 반환
  if (!url) {
    return '/assets/images/default-place.jpg';
  }
  
  // 이미 최적화된 이미지 경로인 경우 그대로 사용
  if (url.includes('_optimized')) {
    return url;
  }
  
  // 원격 URL인 경우 로컬 정적 이미지로 변환
  if (url.includes('placeholder.com') || url.includes('via.placeholder.com')) {
    return '/assets/images/default-place.jpg';
  }
  
  // API placeholder 경로인 경우 로컬 이미지 사용
  if (url.startsWith('/api/placeholder')) {
    return '/assets/images/default-place.jpg';
  }
  
  // 로컬 이미지 경로인 경우
  if (url.startsWith('/assets/')) {
    // 이미지 확장자 확인 (최적화 여부에 따라 WebP 사용)
    const extension = url.split('.').pop().toLowerCase();
    
    if (supportsWebp && ['jpg', 'jpeg', 'png'].includes(extension)) {
      // WebP 지원 시 최적화된 WebP 버전 사용 (파일명 변경)
      const basePath = url.substring(0, url.lastIndexOf('.'));
      return `${basePath}_optimized_${width}x${height}.webp`;
    }
    
    // WebP 지원하지 않거나 다른 확장자의 경우 원본 크기 최적화 버전 사용
    const basePath = url.substring(0, url.lastIndexOf('.'));
    return `${basePath}_optimized_${width}x${height}.${extension}`;
  }
  
  // 외부 URL 검증
  try {
    new URL(url);
    
    // 이미지 CDN이나 서비스 URL인 경우 크기 매개변수 추가
    if (url.includes('firebasestorage.googleapis.com') || 
        url.includes('storage.googleapis.com')) {
      // Firebase Storage URL에 크기 매개변수 추가
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}width=${width}&height=${height}`;
    }
    
    return url; // 유효한 URL
  } catch (e) {
    // 유효하지 않은 URL은 기본 이미지로 대체
    return '/assets/images/default-place.jpg';
  }
};

// 이미지 미리 로드 함수 (최적화)
const preloadImage = (src) => {
  // 이미 로드 중이거나 로드된 이미지는 다시 로드하지 않음
  if (imageLoadingCache.has(src)) {
    return imageLoadingCache.get(src);
  }
  
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageLoadingCache.set(src, { loaded: true, error: false });
      resolve(img);
    };
    img.onerror = () => {
      imageLoadingCache.set(src, { loaded: true, error: true });
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
  
  // 캐시에 로딩 상태 저장
  imageLoadingCache.set(src, { loaded: false, error: false, promise });
  
  return promise;
};

// 컴포넌트 정의
const RecommendationCardBase = ({ 
  place, 
  isNearby = false, 
  index = 0,
  showCategory = true,
  elevation = 1,
  onClick 
}) => {
  const navigate = useNavigate();
  const { toggleSave, isSaved, refreshData } = useSavedPlaces();
  
  // Intersection Observer로 뷰포트 내 가시성 감지
  const [ref, inView] = useInView(observerOptions);
  
  // 이미지 로딩 상태 추적
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imageRetryCount = useRef(0);
  
  // 장소 ID 메모이제이션
  const placeId = useMemo(() => getNormalizedId(place), [place]);
  
  // 성능 및 접근성 설정 확인
  const devicePerformance = useMemo(() => detectDevicePerformance(), []);
  const prefersReducedMotion = useMemo(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, 
  []);
  
  // 애니메이션 및 UI 설정
  const animationPresets = useMemo(() => 
    getAnimationPresets(devicePerformance, prefersReducedMotion),
  [devicePerformance, prefersReducedMotion]);
  
  // 애니메이션 활성화 여부
  const enableAnimations = useMemo(() => 
    devicePerformance !== 'low' && !prefersReducedMotion,
  [devicePerformance, prefersReducedMotion]);
  
  // 통합된 UI 상태 관리
  const [uiState, setUiState] = useState({
    saved: false,
    loading: true, 
    saveLoading: false,
    saveError: null,
    notificationOpen: false,
    notificationMessage: '',
    notificationSeverity: 'info',
    hover: false
  });
  
  // 마운트 상태 추적 및 타이머 관리용 ref
  const isMounted = useRef(true);
  const requestId = useRef(0);
  const debounceTimerRef = useRef(null);
  
  // 최적화된 이미지 URL 계산 (리사이즈 및 WebP 변환)
  const thumbnailUrl = useMemo(() => {
    // 기본 표시 이미지 (썸네일 또는 첫 번째 사진)
    const imageSource = place.thumbnail || 
      (place.photos && place.photos.length > 0 ? place.photos[0] : 
      place.photo);
    
    // 모바일 기기에서는 더 작은 이미지 사용
    const imageWidth = isMobile ? 300 : 400;
    const imageHeight = isMobile ? 225 : 300;
    
    return getImageUrl(imageSource, imageWidth, imageHeight);
  }, [place]);

  // 상태 업데이트 함수 통합
  const updateUiState = useCallback((updates) => {
    if (isMounted.current) {
      setUiState(prev => ({ ...prev, ...updates }));
    }
  }, []);
  
  // 알림 표시 함수
  const showNotification = useCallback((message, severity = 'info') => {
    updateUiState({
      notificationOpen: true,
      notificationMessage: message,
      notificationSeverity: severity
    });
    
    // 3초 후 자동 닫기
    setTimeout(() => {
      if (isMounted.current) {
        updateUiState({ notificationOpen: false });
      }
    }, 3000);
  }, [updateUiState]);

  // 컴포넌트 마운트/언마운트 처리
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      
      // 디바운스 타이머 정리
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  // 이미지 지연 로딩 처리
  useEffect(() => {
    // 뷰포트에 들어왔을 때만 이미지 로딩
    if (inView && !imgLoaded && !imgError) {
      // 이미지 로딩 중 UI 상태 표시
      updateUiState({ loading: true });
      
      // 이미지 사전 로드
      preloadImage(thumbnailUrl)
        .then(() => {
          if (isMounted.current) {
            setImgLoaded(true);
            updateUiState({ loading: false });
            imageRetryCount.current = 0; // 성공하면 재시도 카운터 리셋
          }
        })
        .catch(() => {
          if (isMounted.current) {
            // 이미지 로드 실패 시 재시도 (최대 2회)
            if (imageRetryCount.current < 2) {
              imageRetryCount.current += 1;
              
              // 재시도 간격을 두고 다시 로드 시도
              setTimeout(() => {
                if (isMounted.current) {
                  // 강제로 캐시 무효화를 위한 쿼리 파라미터 추가
                  const retryUrl = `${thumbnailUrl}${thumbnailUrl.includes('?') ? '&' : '?'}_retry=${Date.now()}`;
                  preloadImage(retryUrl);
                }
              }, 1500);
            } else {
              // 최대 재시도 횟수 초과 시 오류 상태 설정
              setImgError(true);
              updateUiState({ loading: false });
            }
          }
        });
    }
  }, [inView, thumbnailUrl, imgLoaded, imgError, updateUiState]);

 // 저장 상태 확인 - 최적화
 useEffect(() => {
  if (!placeId) return;
  
  const checkSavedStatus = async () => {
    try {
      // 이미 처리 중이면 중복 요청 방지
      if (uiState.saveLoading) return;
      
      // 요청 ID 증가
      const currentRequestId = ++requestId.current;
      
      // 로컬 캐시부터 확인 (빠른 응답)
      try {
        const savedPlacesCache = localStorage.getItem('savedPlacesCache');
        if (savedPlacesCache) {
          const cacheData = JSON.parse(savedPlacesCache);
          if (cacheData[placeId]) {
            if (isMounted.current) {
              updateUiState({ saved: true });
              return; // 캐시에서 확인된 경우 즉시 반환
            }
          }
        }
      } catch (e) {
        console.warn('로컬 스토리지 접근 오류:', e);
      }
      
      // 오프라인이면 캐시에 없는 경우 현재 상태 유지
      if (!navigator.onLine) return;
      
      // 컨텍스트를 통해 저장 상태 확인 (비동기)
      updateUiState({ saveLoading: true });
      
      try {
        const status = await isSaved(placeId);
        
        // 요청이 최신인지 확인 (이전 요청 무시)
        if (isMounted.current && currentRequestId === requestId.current) {
          updateUiState({ 
            saved: status,
            saveLoading: false,
            saveError: null
          });
          
          // 저장 상태 캐싱
          try {
            const savedPlacesCache = localStorage.getItem('savedPlacesCache') || '{}';
            const savedPlacesMap = JSON.parse(savedPlacesCache);
            
            if (status) {
              savedPlacesMap[placeId] = { timestamp: Date.now() };
            } else {
              delete savedPlacesMap[placeId];
            }
            
            localStorage.setItem('savedPlacesCache', JSON.stringify(savedPlacesMap));
          } catch (e) {
            console.warn('캐시 저장 오류:', e);
          }
        }
      } catch (error) {
        console.error('저장 상태 확인 오류:', error);
        if (isMounted.current && currentRequestId === requestId.current) {
          updateUiState({ 
            saveLoading: false,
            saveError: '저장 상태 확인 중 오류가 발생했습니다'
          });
        }
      }
    } catch (error) {
      console.error('저장 상태 확인 중 예외 발생:', error);
      if (isMounted.current) {
        updateUiState({ saveLoading: false });
      }
    }
  };
  
  // 디바운스 적용
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }
  
  debounceTimerRef.current = setTimeout(checkSavedStatus, 100);
  
  return () => {
    const timerToClean = debounceTimerRef.current;
    if (timerToClean) {
      clearTimeout(timerToClean);
    }
  };
}, [placeId, isSaved, uiState.saveLoading, updateUiState]);

// 네트워크 상태 변경 감지
useEffect(() => {
  let localTimerId = null;

  const handleOnline = () => {
    if (!placeId || !isMounted.current) return;
    
    // 기존 타이머 제거
    if (localTimerId) {
      clearTimeout(localTimerId);
    }
    
    // 새 타이머 생성 및 로컬 변수에 저장
    localTimerId = setTimeout(() => {
      if (isMounted.current) {
        const currentRequestId = ++requestId.current;
        
        isSaved(placeId).then(status => {
          if (isMounted.current && currentRequestId === requestId.current) {
            updateUiState({ saved: status });
            
            // 저장 상태 캐싱
            try {
              const savedPlacesCache = localStorage.getItem('savedPlacesCache') || '{}';
              const savedPlacesMap = JSON.parse(savedPlacesCache);
              
              if (status) {
                savedPlacesMap[placeId] = { timestamp: Date.now() };
              } else {
                delete savedPlacesMap[placeId];
              }
              
              localStorage.setItem('savedPlacesCache', JSON.stringify(savedPlacesMap));
            } catch (e) {
              console.warn('캐시 저장 오류:', e);
            }
          }
        }).catch(err => console.error('온라인 상태에서 저장 상태 확인 오류:', err));
      }
    }, 1000);
  };
  
  window.addEventListener('online', handleOnline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    
    // 로컬 변수를 사용하여 타이머 정리
    if (localTimerId) {
      clearTimeout(localTimerId);
    }
  };
}, [placeId, isSaved, updateUiState]);

// 페이지 가시성 변경 감지
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && placeId && isMounted.current) {
      // 디바운스 적용
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      const timerId = setTimeout(async () => {
        try {
          if (isMounted.current) {
            const status = await isSaved(placeId);
            updateUiState({ saved: status });
          }
        } catch (error) {
          console.warn('가시성 변경 시 저장 상태 확인 오류:', error);
        }
      }, 300);
      
      // 타이머 참조 저장
      debounceTimerRef.current = timerId;
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    // 타이머 정리
    const timerToClean = debounceTimerRef.current;
    if (timerToClean) {
      clearTimeout(timerToClean);
    }
  };
}, [placeId, isSaved, updateUiState]);

// 스낵바 닫기 핸들러
const handleCloseSnackbar = useCallback(() => {
  updateUiState({ notificationOpen: false });
}, [updateUiState]);

// 카드 클릭 핸들러 - URL 생성 로직 개선
const handleCardClick = useCallback(() => {
  // 커스텀 onClick 처리가 있으면 사용
  if (onClick && typeof onClick === 'function') {
    onClick(place);
    return;
  }
  
  // 기본 동작: 장소 상세 페이지로 이동
  if (placeId) {
    // 햅틱 피드백 (모바일)
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(30);
    }
    
    // 수정: 숫자 ID만 사용하고 URL 경로 개선
    navigate(`/place/${placeId}`);
    
    console.log(`장소 페이지로 이동: /place/${placeId}`);
  }
}, [navigate, onClick, place, placeId]);

// 저장 토글 - 최적화 및 성능 처리 수정
const handleToggleSave = useCallback(async (e) => {
  // 이벤트 전파 중지
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // 이미 처리 중이면 중복 요청 방지
  if (uiState.saveLoading || !isMounted.current) return;
  
  if (!placeId) {
    showNotification('유효한 장소 ID가 없습니다.', 'error');
    return;
  }
  
  try {
    updateUiState({ saveLoading: true });
    
    // 오프라인 체크
    if (!navigator.onLine) {
      showNotification('오프라인 상태입니다. 온라인 상태에서 다시 시도해주세요.', 'warning');
      updateUiState({ saveLoading: false });
      return;
    }
    
    // 햅틱 피드백
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(50);
    }
    
    // 현재 저장 상태 확인
    const currentStatus = await isSaved(placeId);
    
    // 새로운 상태는 현재 상태의 반대
    const newStatus = !currentStatus;
    
    // 먼저 UI 상태를 업데이트 (낙관적 업데이트)
    updateUiState({ saved: newStatus });
    
    // 콘솔에 로그 추가
    console.log(`장소 ${placeId} 저장 상태 변경: ${currentStatus} -> ${newStatus}`);
    
    try {
      // 저장/취소 작업 수행
      await toggleSave(place || placeId);
      
      // SavedPlacesContext 상태 갱신
      if (typeof refreshData === 'function') {
        setTimeout(() => {
          refreshData().catch(err => 
            console.warn('데이터 갱신 실패:', err)
          );
        }, 300);
      }
      
      // 로컬 캐시 업데이트
      try {
        let cacheData = {};
        const existingCache = localStorage.getItem('savedPlacesCache');
        if (existingCache) {
          cacheData = JSON.parse(existingCache);
        }
        
        if (newStatus) {
          // 저장 시 캐시에 추가
          cacheData[placeId] = {
            timestamp: Date.now(),
            saved: true
          };
        } else {
          // 저장 취소 시 캐시에서 제거
          delete cacheData[placeId];
        }
        
        localStorage.setItem('savedPlacesCache', JSON.stringify(cacheData));
      } catch (cacheError) {
        console.warn('캐시 업데이트 실패:', cacheError);
      }
      
      // 성공 메시지
      showNotification(
        newStatus ? '장소가 저장되었습니다.' : '장소가 저장 목록에서 제거되었습니다.',
        'success'
      );
    } catch (error) {
      console.error('저장 토글 오류:', error);
      
      // 실패 시 UI 롤백
      updateUiState({ saved: currentStatus });
      
      // 오류 메시지
      showNotification(
        error.message || '저장 처리 중 오류가 발생했습니다.',
        'error'
      );
    } finally {
      if (isMounted.current) {
        updateUiState({ saveLoading: false });
      }
    }
  } catch (error) {
    console.error('저장 처리 오류:', error);
    
    showNotification('저장 상태 확인 중 오류가 발생했습니다.', 'error');
    updateUiState({ saveLoading: false });
  }
}, [
  placeId, uiState.saveLoading, isSaved, toggleSave, 
  place, refreshData, updateUiState, showNotification
]);

// 데이터 없을 경우 처리
if (!place) return null;
  
// 카테고리 색상 설정
const categoryColor = categoryColors[place.category] || categoryColors.default;
const categoryName = categoryNames[place.category] || place.category || '기타';

// 별점 계산 - 안정적인 방식으로 수정
const rating = getFormattedRating(place.averageRating);

return (
  <motion.div
    ref={ref} // Intersection Observer 연결
    initial="hidden"
    animate="visible"
    variants={animationPresets.cardVariants}
    whileHover={enableAnimations ? animationPresets.hoverEffect : {}}
    whileTap={enableAnimations ? animationPresets.tapEffect : {}}
    style={{ height: '100%' }}
  >
    <Card 
      elevation={elevation} 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        position: 'relative',
        transition: 'box-shadow 0.3s ease',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
    >
      <CardActionArea 
        onClick={handleCardClick}
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch',
          height: '100%',
          '& .MuiCardActionArea-focusHighlight': {
            opacity: 0.05
          }
        }}
      >
        {/* 이미지 컨테이너 */}
        <Box
          sx={{
            position: 'relative',
            paddingTop: '75%', // 4:3 비율 유지
            backgroundColor: 'grey.100',
            overflow: 'hidden'
          }}
        >
          {/* 스켈레톤 UI */}
          {(!imgLoaded || uiState.loading) && !imgError && (
            <Skeleton 
              variant="rectangular" 
              animation="wave"
              sx={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'grey.200'
              }}
            />
          )}
          
          {/* 이미지 로딩 오류 시 폴백 UI */}
          {imgError && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'grey.100'
              }}
            >
              <BrokenImageIcon 
                color="disabled" 
                sx={{ fontSize: 40, mb: 1 }} 
              />
              <Typography variant="caption" color="text.secondary">
                이미지를 불러올 수 없습니다
              </Typography>
            </Box>
          )}
          
          {/* 실제 이미지 - 지연 로딩 적용 */}
          {inView && (
            <CardMedia
              component="img"
              image={thumbnailUrl}
              alt={place.name || '장소 이미지'}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imgLoaded && !uiState.loading ? 1 : 0,
                transition: 'opacity 0.3s ease',
                // 웹킷 하드웨어 가속 활성화
                transform: 'translateZ(0)',
                willChange: 'opacity'
              }}
              onLoad={() => {
                // 이미지 로드 완료 처리
                setImgLoaded(true);
                updateUiState({ loading: false });
              }}
              onError={() => {
                // 이미지 로드 실패 처리
                if (isMounted.current) {
                  if (imageRetryCount.current < 2) {
                    // 오류 시 재시도
                    imageRetryCount.current += 1;
                    
                    // 기본 이미지로 대체 시도
                    const fallbackUrl = '/assets/images/default-place.jpg';
                    
                    setTimeout(() => {
                      if (isMounted.current) {
                        const imgElement = new Image();
                        imgElement.src = fallbackUrl;
                        imgElement.onload = () => {
                          if (isMounted.current) {
                            // 이미지 DOM 요소 직접 업데이트
                            const cardMediaElement = document.querySelector(
                              `[alt="${place.name || '장소 이미지'}"]`
                            );
                            if (cardMediaElement) {
                              cardMediaElement.src = fallbackUrl;
                              setImgLoaded(true);
                              updateUiState({ loading: false });
                            } else {
                              setImgError(true);
                            }
                          }
                        };
                        imgElement.onerror = () => {
                          if (isMounted.current) {
                            setImgError(true);
                            updateUiState({ loading: false });
                          }
                        };
                      }
                    }, 500);
                  } else {
                    // 최대 재시도 횟수 초과 시 오류 상태로 전환
                    setImgError(true);
                    updateUiState({ loading: false });
                  }
                }
              }}
              // 네이티브 지연 로딩도 추가 적용
              loading="lazy"
            />
          )}
          
          {/* 카테고리 표시 */}
          {showCategory && (
            <Chip
              label={categoryName}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: categoryColor,
                color: 'white',
                fontWeight: 'medium',
                fontSize: '0.75rem',
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            />
          )}
          
          {/* 거리 정보 또는 지역 표시 */}
          {(place.distance || isNearby || place.region) && (
            <Chip
              icon={<LocationIcon sx={{ fontSize: '0.9rem', color: 'white' }} />}
              label={
                place.distance ? 
                  (typeof place.distance === 'number' ? 
                    `${place.distance >= 1000 ? 
                        `${(place.distance / 1000).toFixed(1)}km` : 
                        `${place.distance.toFixed(0)}m`
                      }` : 
                    place.distance
                  ) : 
                  (place.region || '서울')
              }
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                fontWeight: 'medium',
                fontSize: '0.7rem',
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
            />
          )}
          
          {/* 오프라인 표시 */}
          {!navigator.onLine && (
            <Tooltip title="오프라인 모드">
              <Chip
                icon={<OfflineIcon sx={{ fontSize: '0.9rem', color: 'warning.contrastText' }} />}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'warning.main',
                  color: 'warning.contrastText',
                  fontWeight: 'medium',
                  fontSize: '0.7rem',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease'
                }}
              />
            </Tooltip>
          )}
        </Box>
        
        {/* 카드 내용 */}
        <CardContent 
          sx={{ 
            flexGrow: 1, 
            p: { xs: 1.5, sm: 2 },
            pt: { xs: 1.5, sm: 2 },
            pb: '8px !important', // MUI 오버라이드
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 장소명 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
            <Typography 
              variant="h6" 
              component="h3" 
              sx={{ 
                fontSize: { xs: '0.95rem', sm: '1rem' },
                fontWeight: 'bold',
                lineHeight: 1.2,
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {place.name}
            </Typography>
          </Box>
          
          {/* 평점 */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 0.5,
              mt: 'auto'
            }}
          >
            <Rating 
              value={rating} 
              precision={0.5} 
              size="small" 
              readOnly 
              sx={{ mr: 1, color: 'primary.main' }}
            />
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: '0.8rem'
              }}
            >
              {place.averageRating ? rating : '평점 없음'}
              
              {place.averageRating && place.mbtiRating && (
                <Tooltip title={`${place.mbtiUserType || '비슷한 MBTI'} 사용자 평점`}>
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                    <PersonIcon sx={{ fontSize: '0.9rem', mr: 0.3 }} />
                    {typeof place.mbtiRating === 'number' ? 
                      place.mbtiRating.toFixed(1) : 
                      place.mbtiRating
                    }
                  </Box>
                </Tooltip>
              )}
            </Typography>
          </Box>
          
          {/* 추천 이유 */}
          {place.recommendationReason && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                mt: 0.5,
                mb: 1,
                fontSize: '0.8rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3
              }}
            >
              {place.recommendationReason}
            </Typography>
          )}
          
          {/* 특성 태그 */}
          {place.specialFeatures && place.specialFeatures.length > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 0.5,
                mt: 0.5
              }}
            >
              {place.specialFeatures.slice(0, 3).map((feature, idx) => (
                <Chip
                  key={`${feature}-${idx}`}
                  label={feature}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem',
                    backgroundColor: 'grey.100'
                  }}
                />
              ))}
            </Box>
          )}
          
          {/* 시간 정보 (선택적) */}
          {place.operatingHours && (
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                mt: 0.5, 
                display: 'flex', 
                alignItems: 'center',
                fontSize: '0.75rem'
              }}
            >
              <AccessTimeIcon sx={{ fontSize: '0.9rem', mr: 0.5 }} />
              {place.operatingHours}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
      
      {/* 저장 버튼 */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 8, 
          right: 8,
          zIndex: 1
        }}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={uiState.saved && animationPresets.saveAnimation ? animationPresets.saveAnimation : undefined}
        >
          <IconButton
            size="small"
            onClick={handleToggleSave}
            disabled={uiState.saveLoading}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(2px)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.9)',
              },
              color: uiState.saved ? 'secondary.main' : 'grey.400',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease, color 0.2s ease',
              width: { xs: 32, sm: 36 },
              height: { xs: 32, sm: 36 }
            }}
            aria-label={uiState.saved ? "저장 취소" : "저장"}
          >
            {uiState.saveLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : uiState.saved ? (
              <FavoriteIcon />
            ) : (
              <FavoriteBorderIcon />
            )}
          </IconButton>
        </motion.div>
      </Box>
      
      {/* 알림 스낵바 */}
      <Snackbar
        open={uiState.notificationOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={uiState.notificationSeverity} 
          sx={{ width: '100%' }}
        >
          {uiState.notificationMessage}
        </Alert>
      </Snackbar>
    </Card>
  </motion.div>
);
};

// PropTypes 정의
RecommendationCardBase.propTypes = {
  place: PropTypes.object.isRequired,
  isNearby: PropTypes.bool,
  index: PropTypes.number,
  showCategory: PropTypes.bool,
  elevation: PropTypes.number,
  onClick: PropTypes.func
};

// 불필요한 리렌더링 방지를 위한 메모이제이션
const RecommendationCard = React.memo(RecommendationCardBase, (prevProps, nextProps) => {
  // 객체 깊은 비교 대신 필요한 속성만 비교하여 성능 최적화
  
  // place 객체 내 중요 필드 비교
  const prevPlace = prevProps.place || {};
  const nextPlace = nextProps.place || {};
  
  // ID 비교
  const prevId = getNormalizedId(prevPlace);
  const nextId = getNormalizedId(nextPlace);
  if (prevId !== nextId) return false;
  
  // 저장 상태가 변경되면 리렌더링
  if (prevProps.isNearby !== nextProps.isNearby) return false;
  
  // 필수 속성만 비교
  const essentialProps = [
    'name', 'thumbnail', 'photo', 'category', 
    'distance', 'region', 'averageRating', 'mbtiRating'
  ];
  
  for (const prop of essentialProps) {
    if (JSON.stringify(prevPlace[prop]) !== JSON.stringify(nextPlace[prop])) {
      return false;
    }
  }
  
  // 사진 배열이 변경되었는지 확인
  if (prevPlace.photos?.[0] !== nextPlace.photos?.[0]) {
    return false;
  }
  
  // 다른 props 비교
  if (prevProps.showCategory !== nextProps.showCategory ||
      prevProps.elevation !== nextProps.elevation ||
      prevProps.onClick !== nextProps.onClick) {
    return false;
  }
  
  // 모든 중요 속성이 동일하면 리렌더링 방지
  return true;
});

export default RecommendationCard;
