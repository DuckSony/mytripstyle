/**
 * src/components/place/ImageGallery.js
 * 장소 상세 페이지의 이미지 갤러리 컴포넌트
 * 모바일 최적화 및 애니메이션 효과 강화
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types'; // 추가된 import
import { 
  Box, 
  IconButton, 
  Dialog, 
  DialogContent,
  Grid,
  Paper,
  Fade,
  Typography,
  Skeleton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { 
  ArrowBackIos as ArrowBackIosIcon,
  ArrowForwardIos as ArrowForwardIosIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Share as ShareIcon,
  BrokenImage as BrokenImageIcon // 추가: 이미지 로드 오류 아이콘
} from '@mui/icons-material';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay, Zoom as SwiperZoom } from 'swiper/modules';
// Swiper CSS 파일 임포트
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/zoom';
import { motion, AnimatePresence } from 'framer-motion'; // framer-motion 추가
import { prefersReducedMotion } from '../../utils/animationUtils';

// WebP 지원 여부 확인 (한 번만 계산)
const supportsWebP = (() => {
  try {
    if (typeof window === 'undefined') return false;
    
    const elem = document.createElement('canvas');
    if (elem.getContext && elem.getContext('2d')) {
      // WebP를 지원하는지 확인
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  } catch (err) {
    return false;
  }
})();

// 최적화된 이미지 URL 생성 함수
const getOptimizedImageUrl = (url, width = 800, height = 600) => {
  if (!url) {
    return '/assets/images/default-place.jpg';
  }
  
  // 기본 이미지 URL 확인
  if (url.includes('placeholder.com') || url.includes('default-place')) {
    return '/assets/images/default-place.jpg';
  }
  
  // 외부 URL인 경우
  if (url.startsWith('http') || url.startsWith('https')) {
    // Firebase Storage URL인 경우 최적화 매개변수 추가
    if (url.includes('firebasestorage.googleapis.com')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}width=${width}&height=${height}`;
    }
    return url;
  }
  
  // 로컬 이미지인 경우 (웹서버에서 이미지 최적화 지원 가정)
  if (url.startsWith('/')) {
    const extension = url.split('.').pop().toLowerCase();
    const basePath = url.substring(0, url.lastIndexOf('.'));
    
    // WebP 지원 시 변환
    if (supportsWebP && ['jpg', 'jpeg', 'png'].includes(extension)) {
      return `${basePath}_${width}x${height}.webp`;
    }
    
    // 원본 형식 유지하며 리사이징
    return `${basePath}_${width}x${height}.${extension}`;
  }
  
  return url;
};

// 이미지 로딩 상태 추적을 위한 메모리 캐시
const imageLoadingCache = new Map();

// 이미지 전역 캐싱 함수
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

// 서비스 워커 통신 - 이미지 캐싱 요청
const requestImageCaching = (urls) => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }
  
  navigator.serviceWorker.controller.postMessage({
    type: 'CACHE_IMAGES',
    payload: { urls }
  });
};

/**
 * 이미지 갤러리 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {Array} props.images - 이미지 URL 배열
 * @param {string} props.placeName - 장소 이름
 * @param {number} props.initialIndex - 초기 선택 이미지 인덱스
 * @param {number} props.height - 갤러리 높이 (기본값: 300px)
 * @param {boolean} props.showThumbnails - 썸네일 표시 여부
 * @param {function} props.onImageChange - 이미지 변경 시 콜백
 */
const ImageGallery = ({ 
  images = [], 
  placeName = '',
  initialIndex = 0,
  height = 300,
  showThumbnails = true,
  onImageChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 기본 상태들
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  
  // 추가된 상태들 (최적화용)
  const [imagesLoaded, setImagesLoaded] = useState([]);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showShareButton, setShowShareButton] = useState(false);
  const [errorImages, setErrorImages] = useState([]);
  const [controlsTimeout, setControlsTimeout] = useState(null);
  
  // 마운트 상태 추적
  const isMounted = useRef(true);
  
  // 애니메이션 설정
  const simpleAnimations = prefersReducedMotion;
  
  // Swiper 인스턴스 참조
  const mainSwiperRef = useRef(null);
  const fullscreenSwiperRef = useRef(null);
  const touchStartRef = useRef(null);
  const touchStartTimeRef = useRef(null);
  
  // 최적화된 이미지 배열 (WebP 변환 및 리사이징)
  const optimizedImages = useMemo(() => {
    // 이미지가 없는 경우 기본 이미지 표시
    const defaultImage = "/assets/images/default-place.jpg";
    
    if (!images || images.length === 0) {
      return [defaultImage];
    }
    
    // 이미지 URL 최적화
    return images.map(url => {
      // 모바일에서는 더 작은 이미지 사용
      const imageWidth = isMobile ? 800 : 1200;
      const imageHeight = isMobile ? 600 : 900;
      
      return getOptimizedImageUrl(url, imageWidth, imageHeight);
    });
  }, [images, isMobile]);
  
  // 이미지 캐싱 요청
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      requestImageCaching(optimizedImages);
    }
  }, [optimizedImages]);
  
  // 초기 이미지 로드 상태 설정
  useEffect(() => {
    if (isMounted.current) {
      setImagesLoaded(new Array(optimizedImages.length).fill(false));
      setErrorImages(new Array(optimizedImages.length).fill(false));
    }
    
    return () => {
      // 컨트롤 타임아웃 정리
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [optimizedImages.length, controlsTimeout]);
  
  // 컴포넌트 마운트/언마운트 처리
  useEffect(() => {
    isMounted.current = true;
    
    // 웹 공유 API 지원 여부 확인
    setShowShareButton(navigator.share !== undefined);
    
    return () => {
      isMounted.current = false;
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  // 이미지 로드 완료 핸들러
  const handleImageLoad = useCallback((index) => {
    if (!isMounted.current) return;
    
    const newLoadedState = [...imagesLoaded];
    newLoadedState[index] = true;
    setImagesLoaded(newLoadedState);
    
    // 이미지 로드 후 다음 이미지 미리 로드 (첫 번째 이미지 로드 후에만)
    if (index === currentIndex && optimizedImages.length > currentIndex + 1) {
      const nextImageUrl = optimizedImages[currentIndex + 1];
      preloadImage(nextImageUrl).catch(() => {/* 오류 무시 */});
    }
  }, [imagesLoaded, currentIndex, optimizedImages]);
  
  // 이미지 로드 오류 핸들러
  const handleImageError = useCallback((index) => {
    if (!isMounted.current) return;
    
    const newErrorState = [...errorImages];
    newErrorState[index] = true;
    setErrorImages(newErrorState);
    
    // 로드 상태 업데이트 (오류지만 로드 시도는 완료됨)
    const newLoadedState = [...imagesLoaded];
    newLoadedState[index] = true;
    setImagesLoaded(newLoadedState);
    
    console.warn(`이미지 로드 실패: ${optimizedImages[index]}`);
  }, [errorImages, imagesLoaded, optimizedImages]);
  
  // 이미지 변경 핸들러
  const handleImageChange = useCallback((index) => {
    if (!isMounted.current) return;
    
    setCurrentIndex(index);
    
    // 다음 이미지 미리 로드
    if (optimizedImages.length > index + 1) {
      const nextImageUrl = optimizedImages[index + 1];
      preloadImage(nextImageUrl).catch(() => {/* 오류 무시 */});
    }
    
    // 콜백 호출
    if (onImageChange) {
      onImageChange(index);
    }
  }, [optimizedImages, onImageChange]);
  
  // 이전 이미지 핸들러
  const handlePrevImage = useCallback((e) => {
    if (e) e.stopPropagation();
    
    if (mainSwiperRef.current && mainSwiperRef.current.swiper) {
      mainSwiperRef.current.swiper.slidePrev();
    } else {
      const newIndex = (currentIndex - 1 + optimizedImages.length) % optimizedImages.length;
      handleImageChange(newIndex);
    }
  }, [currentIndex, optimizedImages.length, handleImageChange]);

  // 다음 이미지 핸들러
  const handleNextImage = useCallback((e) => {
    if (e) e.stopPropagation();
    
    if (mainSwiperRef.current && mainSwiperRef.current.swiper) {
      mainSwiperRef.current.swiper.slideNext();
    } else {
      const newIndex = (currentIndex + 1) % optimizedImages.length;
      handleImageChange(newIndex);
    }
  }, [currentIndex, optimizedImages.length, handleImageChange]);

  // 컨트롤 토글 핸들러
  const handleToggleControls = useCallback(() => {
    if (!isMounted.current) return;
    
    setControlsVisible(prev => !prev);
    
    // 이전 타임아웃 제거
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    
    // 컨트롤이 표시되는 경우 자동 숨김 타이머 설정
    if (!controlsVisible) {
      const newTimeout = setTimeout(() => {
        if (isMounted.current) {
          setControlsVisible(false);
        }
      }, 5000);
      setControlsTimeout(newTimeout);
    }
  }, [controlsVisible, controlsTimeout]);
  
  // 터치 이벤트 시작 핸들러
  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    };
    touchStartTimeRef.current = Date.now();
  }, []);
  
  // 터치 이벤트 종료 핸들러
  const handleTouchEnd = useCallback((e) => {
    if (!touchStartRef.current) return;
    
    const touchEnd = { 
      x: e.changedTouches[0].clientX, 
      y: e.changedTouches[0].clientY 
    };
    
    const diffX = touchEnd.x - touchStartRef.current.x;
    const diffY = touchEnd.y - touchStartRef.current.y;
    const touchDuration = Date.now() - touchStartTimeRef.current;
    
    // 수평 스와이프가 수직 스와이프보다 크고, 빠른 스와이프인 경우
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50 && touchDuration < 300) {
      if (diffX > 0) {
        handlePrevImage();
      } else {
        handleNextImage();
      }
    }
    
    // 탭으로 간주할 수 있는 짧은 터치
    if (Math.abs(diffX) < 5 && Math.abs(diffY) < 5 && touchDuration < 200) {
      handleToggleControls();
    }
    
    touchStartRef.current = null;
  }, [handlePrevImage, handleNextImage, handleToggleControls]);
  
  // 전체화면 모드 토글 핸들러
  const handleToggleFullscreen = useCallback((e) => {
    if (e) e.stopPropagation();
    
    // 햅틱 피드백 (지원되는 기기에서만)
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(30); // 짧은 진동
    }
    
    setFullscreenIndex(currentIndex);
    setFullscreenOpen(!fullscreenOpen);
    
    // 줌 레벨 초기화
    setZoomLevel(1);
    
    // 컨트롤 타임아웃 제거 및 재설정
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    
    // 전체화면 모드에서 컨트롤 표시 및 자동 숨김
    setControlsVisible(true);
    const newTimeout = setTimeout(() => {
      if (isMounted.current) {
        setControlsVisible(false);
      }
    }, 3000);
    setControlsTimeout(newTimeout);
  }, [currentIndex, fullscreenOpen, isMobile, controlsTimeout]);
  
  // 전체화면 모드 닫기 핸들러
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenOpen(false);
    setZoomLevel(1);
    
    // 컨트롤 타임아웃 제거
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
  }, [controlsTimeout]);
  
  // 썸네일 클릭 핸들러
  const handleThumbnailClick = useCallback((index) => {
    if (mainSwiperRef.current && mainSwiperRef.current.swiper) {
      mainSwiperRef.current.swiper.slideTo(index);
    } else {
      handleImageChange(index);
    }
    
    // 햅틱 피드백 (지원되는 기기에서만)
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(20); // 매우 짧은 진동
    }
  }, [handleImageChange, isMobile]);
  
  // 확대/축소 핸들러
  const handleZoom = useCallback((increase) => {
    setZoomLevel(prevZoom => {
      if (increase) {
        return Math.min(prevZoom + 0.5, 3); // 최대 3배까지 확대
      } else {
        return Math.max(prevZoom - 0.5, 1); // 최소 1배
      }
    });
  }, []);
  
  // 공유 핸들러
  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    
    try {
      await navigator.share({
        title: placeName || '장소 이미지',
        text: `${placeName || '장소'} 이미지를 확인해보세요!`,
        url: optimizedImages[currentIndex]
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.log('공유 오류:', error);
      }
    }
  }, [placeName, optimizedImages, currentIndex]);

  return (
    <>
      {/* 메인 이미지 갤러리 - 애니메이션 및 모바일 제스처 지원 개선 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: simpleAnimations ? 0.2 : 0.4 }}
      >
        <Box 
          sx={{ 
            position: 'relative', 
            height: height, 
            overflow: 'hidden',
            borderRadius: 2,
            mb: showThumbnails ? 1 : 2,
            boxShadow: 2,
            '&:hover .gallery-controls': {
              opacity: 1
            },
            // 모바일에서는 터치 이벤트를 위한 제스처 영역 설정
            ...(isMobile && {
              touchAction: 'pan-y'
            })
          }}
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
        >
          {/* 스켈레톤 로딩 */}
          {!imagesLoaded[currentIndex] && (
            <Skeleton 
              variant="rectangular" 
              width="100%" 
              height="100%" 
              animation="wave"
              sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                zIndex: 1,
                borderRadius: 2
              }}
            />
          )}
          
          {optimizedImages.length > 1 ? (
            <Swiper
              ref={mainSwiperRef}
              modules={[Navigation, Pagination, Autoplay]}
              spaceBetween={0}
              slidesPerView={1}
              navigation={{
                prevEl: '.swiper-button-prev',
                nextEl: '.swiper-button-next',
                enabled: !isMobile, // 모바일에서는 기본 내비게이션 비활성화
              }}
              pagination={{ 
                clickable: true,
                dynamicBullets: isMobile, // 모바일에서 동적 불릿 사용
                dynamicMainBullets: 3 
              }}
              autoplay={isMobile ? false : { delay: 5000, disableOnInteraction: true }}
              loop={true}
              onSlideChange={(swiper) => handleImageChange(swiper.realIndex)}
              initialSlide={currentIndex}
              style={{ height: '100%' }}
              // 모바일에서는 더 부드러운 스와이프
              speed={isMobile ? 400 : 300}
              threshold={isMobile ? 10 : 20}
              resistanceRatio={isMobile ? 0.85 : 0.75}
              // 메모리 관리를 위한 캐싱 설정
              preloadImages={false}
              updateOnImagesReady={true}
              lazy={{
                loadPrevNext: true,
                loadPrevNextAmount: 2
              }}
            >
              {optimizedImages.map((image, index) => (
                <SwiperSlide key={index} style={{ height: '100%' }}>
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: imagesLoaded[index] ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ height: '100%' }}
                    >
                      {errorImages[index] ? (
                        // 이미지 로드 오류 시 표시
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.default'
                          }}
                        >
                          <BrokenImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            이미지를 불러올 수 없습니다
                          </Typography>
                        </Box>
                      ) : (
                        // 정상 이미지
                        <img 
                          src={image}
                          alt={`${placeName || '장소'} 이미지 ${index + 1}`}
                          onError={() => handleImageError(index)}
                          onLoad={() => handleImageLoad(index)}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            cursor: 'pointer',
                            opacity: imagesLoaded[index] ? 1 : 0,
                            transition: 'opacity 0.3s ease'
                          }}
                          onClick={handleToggleFullscreen}
                          loading={index === currentIndex || index === currentIndex + 1 ? "eager" : "lazy"}
                          fetchPriority={index === currentIndex ? "high" : "auto"}
                          decoding="async"
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </SwiperSlide>
              ))}
              {!isMobile && (
                <>
                  <div className="swiper-button-prev" style={{ color: 'white' }}></div>
                  <div className="swiper-button-next" style={{ color: 'white' }}></div>
                </>
              )}
            </Swiper>
          ) : (
            /* 단일 이미지인 경우 */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: imagesLoaded[0] ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              style={{ height: '100%' }}
            >
              {errorImages[0] ? (
                // 이미지 로드 오류 시 표시
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default'
                  }}
                >
                  <BrokenImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    이미지를 불러올 수 없습니다
                  </Typography>
                </Box>
              ) : (
                // 정상 이미지
                <img 
                  src={optimizedImages[0]}
                  alt={placeName || '장소 이미지'}
                  onError={() => handleImageError(0)}
                  onLoad={() => handleImageLoad(0)}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    cursor: 'pointer',
                    opacity: imagesLoaded[0] ? 1 : 0,
                    transition: 'opacity 0.3s ease'
                  }}
                  onClick={handleToggleFullscreen}
                  fetchPriority="high"

                />
              )}
            </motion.div>
          )}

          {/* 갤러리 컨트롤 - 모바일에서 탭하면 표시/숨김 */}
          <Fade in={!isMobile || controlsVisible} timeout={300}>
            <Box
              className="gallery-controls"
              sx={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: !isMobile || controlsVisible ? 1 : 0,
                transition: 'opacity 0.3s',
                zIndex: 2,
                px: isMobile ? 0.5 : 1,
                background: controlsVisible ? 'linear-gradient(to right, rgba(0,0,0,0.2), transparent, rgba(0,0,0,0.2))' : 'transparent',
                // 모바일에서는 5초 후 자동으로 컨트롤 숨김
                ...(isMobile && controlsVisible && {
                  animation: 'fadeOut 5s forwards',
                  '@keyframes fadeOut': {
                    '0%': { opacity: 1 },
                    '80%': { opacity: 1 },
                    '100%': { opacity: 0 }
                  }
                })
              }}
              onClick={isMobile ? handleToggleControls : undefined}
            >
              {optimizedImages.length > 1 && (
                <>
                  <motion.div
                    whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                    whileTap={simpleAnimations ? {} : { scale: 0.9 }}
                  >
                    <IconButton
                      onClick={handlePrevImage}
                      sx={{ 
                        bgcolor: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.5)',
                        },
                        // 모바일에서는 더 큰 버튼
                        ...(isMobile && {
                          width: 40,
                          height: 40
                        })
                      }}
                      aria-label="이전 이미지"
                    >
                      <ArrowBackIosIcon fontSize={isMobile ? "medium" : "small"} />
                    </IconButton>
                  </motion.div>
                  
                  <motion.div
                    whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                    whileTap={simpleAnimations ? {} : { scale: 0.9 }}
                  >
                    <IconButton
                      onClick={handleNextImage}
                      sx={{ 
                        bgcolor: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.5)',
                        },
                        // 모바일에서는 더 큰 버튼
                        ...(isMobile && {
                          width: 40,
                          height: 40
                        })
                      }}
                      aria-label="다음 이미지"
                    >
                      <ArrowForwardIosIcon fontSize={isMobile ? "medium" : "small"} />
                    </IconButton>
                  </motion.div>
                </>
              )}
            </Box>
          </Fade>
          
          {/* 이미지 인덱스 및 전체화면 버튼 - 모바일 최적화 */}
          <Fade in={!isMobile || controlsVisible} timeout={300}>
            <Box
              sx={{ 
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                zIndex: 2,
                opacity: !isMobile || controlsVisible ? 1 : 0,
                transition: 'opacity 0.3s'
              }}
            >
              {optimizedImages.length > 1 && (
                <Box
                  sx={{ 
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: isMobile ? '0.8rem' : '0.75rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {currentIndex + 1} / {optimizedImages.length}
                </Box>
              )}
              
              {/* 공유 버튼 (웹 공유 API 지원 기기에서만) */}
              {showShareButton && (
                <motion.div
                  whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                  whileTap={simpleAnimations ? {} : { scale: 0.9 }}
                >
                  <IconButton
                    onClick={handleShare}
                    size={isMobile ? "medium" : "small"}
                    sx={{ 
                      bgcolor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.8)',
                      }
                    }}
                    aria-label="이미지 공유"
                  >
                    <ShareIcon fontSize="small" />
                  </IconButton>
                </motion.div>
              )}
              
              <motion.div
                whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                whileTap={simpleAnimations ? {} : { scale: 0.9 }}
              >
                <IconButton
                  onClick={handleToggleFullscreen}
                  size={isMobile ? "medium" : "small"}
                  sx={{ 
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.8)',
                    }
                  }}
                  aria-label="전체화면 보기"
                >
                  <FullscreenIcon fontSize="small" />
                </IconButton>
              </motion.div>
            </Box>
          </Fade>
        </Box>
      </motion.div>
      
      {/* 썸네일 목록 - 모바일 최적화 및 애니메이션 */}
      {showThumbnails && optimizedImages.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: simpleAnimations ? 0.2 : 0.4, delay: 0.2 }}
        >
          <Box sx={{ mb: 2, overflow: 'auto', px: 0.5 }}>
            <Grid container spacing={1}>
              {optimizedImages.map((image, index) => (
                <Grid 
                  item 
                  key={index} 
                  xs={isMobile ? 3 : 2} 
                  sm={1.5} 
                  md={1}
                >
                  <motion.div
                    whileHover={simpleAnimations ? {} : { scale: 1.05 }}
                    whileTap={simpleAnimations ? {} : { scale: 0.95 }}
                  >
                    <Paper
                      elevation={currentIndex === index ? 3 : 1}
                      sx={{ 
                        p: 0.3,
                        cursor: 'pointer',
                        border: currentIndex === index ? '2px solid' : '2px solid transparent',
                        borderColor: currentIndex === index ? 'primary.main' : 'transparent',
                        borderRadius: 1,
                        transition: 'all 0.2s',
                        // 현재 선택된 썸네일 강조 효과
                        transform: currentIndex === index ? 'scale(1.05)' : 'scale(1)',
                        // 모바일에서 더 큰 터치 영역
                        ...(isMobile && {
                          padding: '4px'
                        })
                      }}
                      onClick={() => handleThumbnailClick(index)}
                    >
                      {errorImages[index] ? (
                        // 썸네일 오류 시 표시할 컨텐츠
                        <Box 
                          sx={{ 
                            width: '100%', 
                            height: isMobile ? 50 : 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'action.hover',
                            borderRadius: 1
                          }}
                        >
                          <BrokenImageIcon 
                            fontSize="small" 
                            sx={{ color: 'text.secondary' }} 
                          />
                        </Box>
                      ) : (
                        // 정상 썸네일 이미지
                        <img 
                          src={image}
                          alt={`썸네일 ${index + 1}`}
                          onError={() => handleImageError(index)}
                          onLoad={() => handleImageLoad(index)}
                          style={{ 
                            width: '100%', 
                            height: isMobile ? 50 : 40,
                            objectFit: 'cover',
                            borderRadius: 2,
                            opacity: imagesLoaded[index] ? 1 : 0.6,
                            transition: 'opacity 0.3s ease'
                          }}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Box>
        </motion.div>
      )}

      {/* 전체화면 모드 다이얼로그 - 모바일 최적화 및 제스처 지원 */}
      <Dialog
        open={fullscreenOpen}
        onClose={handleCloseFullscreen}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile} // 모바일에서는 전체화면으로 표시
        TransitionComponent={Fade}
        transitionDuration={simpleAnimations ? 200 : 400}
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: 'black',
            // 모바일에서는 스와이프로 닫을 수 있게 함
            ...(isMobile && {
              overscrollBehavior: 'contain',
              touchAction: 'pan-y'
            })
          }
        }}
      >
        <DialogContent 
          sx={{ 
            p: 0, 
            position: 'relative', 
            height: isMobile ? '100vh' : '80vh',
            overflow: 'hidden'
          }}
        >
          {/* 전체화면 모드 컨트롤 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              p: 1,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
              opacity: !isMobile || controlsVisible ? 1 : 0,
              transition: 'opacity 0.3s ease'
            }}
            onClick={isMobile ? handleToggleControls : undefined}
          >
            <Box display="flex" alignItems="center">
              <motion.div
                whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                whileTap={simpleAnimations ? {} : { scale: 0.9 }}
              >
                <IconButton
                  onClick={handleCloseFullscreen}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.4)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.6)',
                    }
                  }}
                  aria-label="닫기"
                  size={isMobile ? "medium" : "small"}
                >
                  <CloseIcon />
                </IconButton>
              </motion.div>
              
              {placeName && (
                <Typography 
                  variant={isMobile ? "body1" : "body2"} 
                  color="white" 
                  sx={{ ml: 2 }}
                >
                  {placeName}
                </Typography>
              )}
            </Box>
            
            <Box display="flex" gap={1}>
              {/* 확대/축소 버튼 */}
              <motion.div
                whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                whileTap={simpleAnimations ? {} : { scale: 0.9 }}
              >
                <IconButton
                  onClick={() => handleZoom(false)}
                  disabled={zoomLevel <= 1}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.4)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.6)',
                    },
                    opacity: zoomLevel <= 1 ? 0.5 : 1
                  }}
                  aria-label="축소"
                  size={isMobile ? "medium" : "small"}
                >
                  <ZoomOutIcon />
                </IconButton>
              </motion.div>
              
              <motion.div
                whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                whileTap={simpleAnimations ? {} : { scale: 0.9 }}
              >
                <IconButton
                  onClick={() => handleZoom(true)}
                  disabled={zoomLevel >= 3}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.4)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.6)',
                    },
                    opacity: zoomLevel >= 3 ? 0.5 : 1
                  }}
                  aria-label="확대"
                  size={isMobile ? "medium" : "small"}
                >
                  <ZoomInIcon />
                </IconButton>
              </motion.div>
              
              {/* 공유 버튼 (지원되는 기기에서만) */}
              {showShareButton && (
                <motion.div
                  whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                  whileTap={simpleAnimations ? {} : { scale: 0.9 }}
                >
                  <IconButton
                    onClick={handleShare}
                    sx={{ 
                      color: 'white',
                      bgcolor: 'rgba(0,0,0,0.4)',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.6)',
                      }
                    }}
                    aria-label="공유"
                    size={isMobile ? "medium" : "small"}
                  >
                    <ShareIcon />
                  </IconButton>
                </motion.div>
              )}
              
              {/* 전체화면 종료 버튼 */}
              <motion.div
                whileHover={simpleAnimations ? {} : { scale: 1.1 }}
                whileTap={simpleAnimations ? {} : { scale: 0.9 }}
              >
                <IconButton
                  onClick={handleCloseFullscreen}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.4)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.6)',
                    }
                  }}
                  aria-label="전체화면 종료"
                  size={isMobile ? "medium" : "small"}
                >
                  <FullscreenExitIcon />
                </IconButton>
              </motion.div>
            </Box>
          </Box>
          
          {/* 전체화면 Swiper - 줌 지원 추가 */}
          <Swiper
            ref={fullscreenSwiperRef}
            modules={[Navigation, Pagination, SwiperZoom]}
            spaceBetween={0}
            slidesPerView={1}
            navigation={{
              enabled: !isMobile // 모바일에서는 제스처만 사용
            }}
            pagination={{ 
              clickable: true,
              dynamicBullets: isMobile,
              dynamicMainBullets: 5
            }}
            initialSlide={fullscreenIndex}
            style={{ height: '100%' }}
            zoom={{ maxRatio: 3, toggle: true }}
            onSlideChange={(swiper) => {
              setFullscreenIndex(swiper.activeIndex);
              setZoomLevel(1); // 슬라이드 변경 시 줌 초기화
            }}
            onClick={isMobile ? handleToggleControls : undefined}
            // 모바일에서 더 부드러운 스와이프
            speed={isMobile ? 300 : 400}
            resistanceRatio={isMobile ? 0.85 : 0.75}
            // 메모리 관리를 위한 캐싱 설정
            preloadImages={false}
            updateOnImagesReady={true}
            lazy={{
              loadPrevNext: true,
              loadPrevNextAmount: 2
            }}
          >
            {optimizedImages.map((image, index) => (
              <SwiperSlide key={index} style={{ height: '100%' }}>
                <Box
                  className="swiper-zoom-container"
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: 'black',
                    // 줌 레벨에 따른 스타일 - SwiperZoom 사용하지 않는 경우
                    ...(zoomLevel > 1 && {
                      overflow: 'scroll',
                      touchAction: 'pan-x pan-y'
                    })
                  }}
                >
                  {errorImages[index] ? (
                    // 이미지 로드 오류 시 표시
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 4,
                        color: 'white'
                      }}
                    >
                      <BrokenImageIcon sx={{ fontSize: 64, mb: 2 }} />
                      <Typography variant="h6">
                        이미지를 불러올 수 없습니다
                      </Typography>
                    </Box>
                  ) : (
                    // 정상 이미지
                    <motion.div
                      animate={{
                        scale: zoomLevel
                      }}
                      transition={{
                        type: 'spring',
                        damping: 20,
                        stiffness: 100
                      }}
                      style={{
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                      drag={zoomLevel > 1}
                      dragConstraints={{
                        left: -100 * (zoomLevel - 1),
                        right: 100 * (zoomLevel - 1),
                        top: -100 * (zoomLevel - 1),
                        bottom: 100 * (zoomLevel - 1)
                      }}
                      dragElastic={0.1}
                    >
                      <img 
                        src={image}
                        alt={`${placeName || '장소'} 이미지 ${index + 1}`}
                        onError={() => handleImageError(index)}
                        onLoad={() => handleImageLoad(index)}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%', 
                          objectFit: 'contain'
                        }}
                        loading={index === fullscreenIndex ? "eager" : "lazy"}
                        fetchPriority={index === fullscreenIndex ? "high" : "auto"}

                      />
                    </motion.div>
                  )}
                </Box>
              </SwiperSlide>
            ))}
          </Swiper>
          
          {/* 이미지 인덱스 표시 */}
          <Box
            sx={{ 
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              zIndex: 10,
              opacity: controlsVisible || !isMobile ? 1 : 0,
              transition: 'opacity 0.3s ease'
            }}
          >
            <Box
              sx={{ 
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                px: 2,
                py: 0.5,
                borderRadius: 16,
                fontSize: isMobile ? '0.9rem' : '0.8rem',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {fullscreenIndex + 1} / {optimizedImages.length}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

// PropTypes 추가로 타입 안전성 향상
ImageGallery.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string),
  placeName: PropTypes.string,
  initialIndex: PropTypes.number,
  height: PropTypes.number,
  showThumbnails: PropTypes.bool,
  onImageChange: PropTypes.func
};

export default ImageGallery;
