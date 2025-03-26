// src/components/recommendation/PlaceCard.js
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types'; // PropTypes 임포트 추가
import { useNavigate } from 'react-router-dom';
import { useSavedPlaces } from '../../contexts/SavedPlacesContext';
import { useInView } from 'react-intersection-observer'; // 추가: Intersection Observer
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Rating,
  IconButton,
  Skeleton,
  Tooltip,
  Fade,
  Zoom,
  Badge
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  LocationOn as LocationIcon,
  AccessTime as AccessTimeIcon,
  Star as StarIcon,
  InfoOutlined as InfoIcon,
  Share as ShareIcon,
  BrokenImage as BrokenImageIcon // 추가: 이미지 로드 실패 아이콘
} from '@mui/icons-material';
import { formatDistance } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';

// 이미지 로드 캐시 (컴포넌트 외부에 선언하여 앱 전체에서 공유)
const imageLoadCache = new Map();

// WebP 지원 여부 확인 (한 번만 계산)
const supportsWebP = (() => {
  if (typeof window === 'undefined') return false;
  
  const elem = document.createElement('canvas');
  if (elem.getContext && elem.getContext('2d')) {
    // WebP를 지원하는지 확인
    return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
})();

// 카테고리 색상 및 이름 맵핑
const categoryColors = {
  'cafe': '#8d6e63',
  'restaurant': '#ff7043',
  'culture': '#5c6bc0',
  'nature': '#66bb6a',
  'activity': '#ffca28',
  'healing': '#26a69a',
  'default': '#78909c'
};

// 카테고리 한글명 매핑
const categoryNames = {
  'cafe': '카페',
  'restaurant': '식당',
  'culture': '문화',
  'nature': '자연',
  'activity': '활동',
  'healing': '힐링',
  'default': '기타'
};

// ID 정규화 유틸리티 함수 - 성능 최적화: 함수 로직 단순화
const getNormalizedPlaceId = (place) => {
  if (!place) return null;
  if (typeof place === 'string') return place;
  
  const id = place.id || place.placeId;
  return id ? String(id) : null;
};

// 웹 최적화된 이미지 URL 생성 함수 추가
const getOptimizedImageUrl = (url, width = 320, height = 160) => {
  if (!url) return '/assets/images/default-place.jpg';
  
  // 이미 최적화된 이미지 URL인 경우
  if (url.includes('_optimized') || url.includes('width=')) return url;
  
  // 외부 URL인 경우 크기 매개변수 추가
  if (url.startsWith('http') || url.startsWith('https')) {
    // Firebase Storage URL인 경우
    if (url.includes('firebasestorage.googleapis.com')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}width=${width}&height=${height}`;
    }
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
  
  // 로컬 이미지의 경우 (웹서버에서 이미지 리사이징 지원 가정)
  if (url.startsWith('/')) {
    const extension = url.split('.').pop().toLowerCase();
    const basePath = url.substring(0, url.lastIndexOf('.'));
    
    // WebP 지원 시 해당 형식 사용
    if (supportsWebP && ['jpg', 'jpeg', 'png'].includes(extension)) {
      return `${basePath}_${width}x${height}.webp`;
    }
    
    // WebP 미지원 시 원본 형식 유지하며 리사이징
    return `${basePath}_${width}x${height}.${extension}`;
  }
  
  return url;
};

// 성능 최적화: 디바이스 성능 감지 함수
const detectDevicePerformance = () => {
  // 저사양 기기 감지 로직
  const memory = navigator.deviceMemory;
  const concurrency = navigator.hardwareConcurrency;
  
  if (memory && memory <= 4) return 'low';
  if (concurrency && concurrency <= 4) return 'low';
  
  return 'high';
};

// 서비스 워커 통신 - 이미지 캐싱 요청
const requestImageCaching = (urls) => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data && event.data.type === 'CACHE_IMAGES_DONE') {
        resolve();
      }
    };
    
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_IMAGES',
      payload: { urls }
    }, [messageChannel.port2]);
    
    // 응답이 없는 경우를 대비해 타임아웃 설정
    setTimeout(resolve, 1000);
  });
};

// 이미지 사전 로드 함수
const preloadImage = (src) => {
  // 이미 캐시에 있으면 재사용
  if (imageLoadCache.has(src)) {
    return Promise.resolve(imageLoadCache.get(src));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageLoadCache.set(src, { success: true, image: img });
      resolve(img);
    };
    img.onerror = (error) => {
      imageLoadCache.set(src, { success: false, error });
      reject(error);
    };
    img.src = src;
  });
};

// 애니메이션 변수 - 성능 수준에 따라 조정
const getAnimationVariants = (index, performanceLevel, prefersReducedMotion) => {
  // 저사양 기기 또는 접근성 설정에 따른 간소화된 애니메이션
  if (performanceLevel === 'low' || prefersReducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
      save: { scale: 1 },
      unsave: { scale: 1 }
    };
  }
  
  // 고사양 기기용 풍부한 애니메이션
  return {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.4,
        delay: Math.min(index * 0.05, 0.3), // 지연 시간 제한
        ease: "easeOut" 
      }
    },
    save: {
      scale: [1, 1.05, 1],
      transition: { duration: 0.4 }
    },
    unsave: {
      scale: [1, 0.98, 1],
      transition: { duration: 0.3 }
    }
  };
};

// 이미지 크기 계산 함수
const getImageDimensions = (isMobile) => {
  // 모바일 환경에서는 더 작은 이미지 사용
  if (isMobile) {
    return {
      width: typeof window !== 'undefined' && window.innerWidth < 400 ? 300 : 400,
      height: typeof window !== 'undefined' && window.innerWidth < 400 ? 150 : 200
    };
  }
  
  // 데스크톱 환경
  if (typeof window === 'undefined') return { width: 320, height: 160 };
  
  const screenWidth = window.innerWidth;
  if (screenWidth > 1920) return { width: 500, height: 250 };
  if (screenWidth > 1280) return { width: 400, height: 200 };
  return { width: 320, height: 160 };
};

// PlaceCard 컴포넌트 - React.memo로 감싸 불필요한 리렌더링 방지
const PlaceCard = React.memo(({ place, isNearby = true, index = 0 }) => {
  const navigate = useNavigate();
  // SavedPlacesContext에서 필요한 함수만 가져오기
  const { toggleSave, isSaved, refreshData } = useSavedPlaces();
  
  // Intersection Observer 설정
  const [ref, inView] = useInView({
    triggerOnce: false, // 지속적으로 관찰
    rootMargin: '100px 0px', // 뷰포트에서 100px 미리 로드
    threshold: 0.1 // 10% 이상 보이면 로드
  });
  
  // 성능 최적화: 장치 성능 및 접근성 설정 확인
  const devicePerformance = useMemo(() => detectDevicePerformance(), []);
  const prefersReducedMotion = useMemo(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, 
  []);
  
  // 컴포넌트 외부에서 일반 변수로 정의
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 이미지 관련 상태
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imageVisible, setImageVisible] = useState(false);
  const imageRetryCount = useRef(0);

  // 그리고 animationSettings에서 참조
  const animationSettings = useMemo(() => ({
    enableAnimations: devicePerformance !== 'low' && !prefersReducedMotion,
    enableGestures: devicePerformance !== 'low' && isMobile && !prefersReducedMotion
  }), [devicePerformance, prefersReducedMotion, isMobile]);
  
  // 이미지 크기 계산
  const dimensions = useMemo(() => getImageDimensions(isMobile), [isMobile]);
  
  // 컴포넌트 상태 - 최적화: 상태 그룹화로 리렌더링 최소화
  const [uiState, setUiState] = useState({
    saved: false,
    loading: true,
    hover: false,
    saveLoading: false,
    saveError: null,
    cardAnimation: 'idle',
    shareOpen: false
  });
  
  // 마운트 상태 추적을 위한 ref 추가
  const isMounted = useRef(true);
  // 저장 상태 체크 타이머 관리
  const savedCheckTimerRef = useRef(null);
  // 장소 객체 참조
  const placeRef = useRef(place);
  // 카드 요소 참조 (제스처용)
  const cardRef = useRef(null);
  
  // 정규화된 ID 추출 (일관성 있게 동일한 ID 사용) - 메모이제이션 추가
  const placeId = useMemo(() => getNormalizedPlaceId(place), [place]);
  
  // 최적화된 이미지 URL 계산
  const thumbnailUrl = useMemo(() => {
    const imageSource = place.photos && place.photos.length > 0 ? 
      place.photos[0] : '/assets/images/default-place.jpg';
    
    return getOptimizedImageUrl(imageSource, dimensions.width, dimensions.height);
  }, [place.photos, dimensions.width, dimensions.height]);
  
  // 이미지 URL 배열 생성 (캐싱용)
  const imageUrls = useMemo(() => {
    const urls = [];
    
    // 메인 이미지
    if (place.photos && place.photos.length > 0) {
      urls.push(place.photos[0]);
    }
    
    // 기본 이미지도 캐싱
    urls.push('/assets/images/default-place.jpg');
    
    return urls.filter(Boolean).map(url => 
      getOptimizedImageUrl(url, dimensions.width, dimensions.height)
    );
  }, [place.photos, dimensions.width, dimensions.height]);
  
  // 애니메이션 변수 - 메모이제이션으로 최적화
  const cardVariants = useMemo(() => 
    getAnimationVariants(index, devicePerformance, prefersReducedMotion),
  [index, devicePerformance, prefersReducedMotion]);
  
  // 성능 최적화: 상태 업데이트 함수 통합
  const updateUiState = useCallback((updates) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  // place 객체가 변경되면 ref 업데이트
  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  // 애니메이션 관련 함수들 - useCallback으로 최적화
  const startSaveAnimation = useCallback(() => {
    if (!animationSettings.enableAnimations) return;
    
    updateUiState({ cardAnimation: 'save' });
    setTimeout(() => updateUiState({ cardAnimation: 'idle' }), 500);
  }, [animationSettings.enableAnimations, updateUiState]);
  
  const startUnsaveAnimation = useCallback(() => {
    if (!animationSettings.enableAnimations) return;
    
    updateUiState({ cardAnimation: 'unsave' });
    setTimeout(() => updateUiState({ cardAnimation: 'idle' }), 500);
  }, [animationSettings.enableAnimations, updateUiState]);
  
  // 이미지 사전 로드 함수
  const loadImage = useCallback((src) => {
    // 이미 캐시에 있으면 상태 업데이트
    if (imageLoadCache.has(src)) {
      const cachedResult = imageLoadCache.get(src);
      if (cachedResult.success) {
        setImgLoaded(true);
        updateUiState({ loading: false });
      } else {
        setImgError(true);
        updateUiState({ loading: false });
      }
      return Promise.resolve(cachedResult);
    }
    
    // 캐시에 없으면 로드
    return preloadImage(src)
      .then(img => {
        if (isMounted.current) {
          setImgLoaded(true);
          updateUiState({ loading: false });
          imageRetryCount.current = 0;
        }
        return img;
      })
      .catch(error => {
        console.warn('이미지 로드 실패:', src, error);
        
        if (!isMounted.current) return;
        
        // 재시도 로직
        if (imageRetryCount.current < 2) {
          imageRetryCount.current++;
          
          // 기본 이미지로 재시도
          const fallbackUrl = '/assets/images/default-place.jpg';
          return loadImage(fallbackUrl);
        } else {
          setImgError(true);
          updateUiState({ loading: false });
          throw error;
        }
      });
  }, [updateUiState]);
  
  // 이미지 로드 완료 핸들러
  const handleImageLoad = useCallback(() => {
    if (isMounted.current) {
      setImgLoaded(true);
      updateUiState({ loading: false });
      
      // 이미지 로드 후 캐싱 요청
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        requestImageCaching([thumbnailUrl]);
      }
    }
  }, [thumbnailUrl, updateUiState]);
  
  // 이미지 오류 핸들러
  const handleImageError = useCallback((e) => {
    if (!isMounted.current) return;
    
    console.warn('이미지 로드 실패:', e.target.src);
    
    // 재시도가 가능한 경우
    if (imageRetryCount.current < 2) {
      imageRetryCount.current++;
      
      // 기본 이미지로 대체 시도
      setTimeout(() => {
        if (e.target && isMounted.current) {
          e.target.onerror = null; // 재귀 오류 방지
          e.target.src = '/assets/images/default-place.jpg';
        }
      }, 500);
    } else {
      // 최대 재시도 횟수 초과
      setImgError(true);
      updateUiState({ loading: false });
    }
  }, [updateUiState]);
  
  // 뷰포트에 들어오면 이미지 표시
  useEffect(() => {
    if (inView && !imgLoaded && !imgError) {
      // 약간의 지연으로 순차적 로딩 효과 (첫 3개는 바로 로드)
      const delay = index < 3 ? 0 : Math.min(index * 100, 500);
      
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setImageVisible(true);
          // 이미지 로드 시작
          loadImage(thumbnailUrl)
            .catch(err => console.warn('이미지 로드 오류:', err));
        }
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [inView, index, imgLoaded, imgError, loadImage, thumbnailUrl]);
  
  // 컴포넌트 마운트/언마운트 관리
  useEffect(() => {
    isMounted.current = true;
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      isMounted.current = false;
      
      // 타이머 값을 정리 함수 내에서 직접 사용
      if (savedCheckTimerRef.current) {
        clearTimeout(savedCheckTimerRef.current);
        savedCheckTimerRef.current = null;
      }
    };
  }, []);

  // 저장 상태 확인 - 최적화된 useEffect
  useEffect(() => {
    if (!placeId) {
      return;
    }
    
    // 상태 확인 함수
    const checkSavedStatus = async () => {
      try {
        if (uiState.saveLoading) return; // 이미 로딩 중이면 중복 요청 방지
        
        updateUiState({ saveLoading: true });
        
        // localStorage에서 먼저 체크 (빠른 초기 상태 표시)
        try {
          const savedPlacesCache = localStorage.getItem('savedPlacesCache');
          if (savedPlacesCache) {
            const savedPlacesMap = JSON.parse(savedPlacesCache);
            if (savedPlacesMap[placeId]) {
              if (isMounted.current) {
                updateUiState({ saved: true, saveLoading: false });
              }
            }
          }
        } catch (storageError) {
          console.warn('localStorage 접근 오류:', storageError);
        }
        
        // 오프라인 상태에서는 서버 요청 스킵
        if (!navigator.onLine) {
          updateUiState({ saveLoading: false });
          return;
        }
        
        // 서버에서 저장 상태 확인 (정규화된 ID 사용)
        try {
          const status = await isSaved(placeId);
          
          if (isMounted.current) {
            updateUiState({ 
              saved: status, 
              saveError: null,
              saveLoading: false
            });
            
            // localStorage에 상태 캐싱 (새로고침 간 유지)
            try {
              const savedPlacesCache = localStorage.getItem('savedPlacesCache') || '{}';
              const savedPlacesMap = JSON.parse(savedPlacesCache);
              
              if (status) {
                // 저장된 경우 캐시에 추가
                savedPlacesMap[placeId] = {
                  timestamp: new Date().getTime()
                };
              } else {
                // 저장 해제된 경우 캐시에서 제거
                delete savedPlacesMap[placeId];
              }
              
              localStorage.setItem('savedPlacesCache', JSON.stringify(savedPlacesMap));
            } catch (storageError) {
              console.warn('localStorage에 저장 상태 캐싱 실패:', storageError);
            }
          }
        } catch (error) {
          if (isMounted.current) {
            updateUiState({ 
              saveError: "저장 상태 확인 중 오류가 발생했습니다.",
              saveLoading: false
            });
          }
        }
      } catch (outerError) {
        if (isMounted.current) {
          updateUiState({ 
            saveLoading: false,
            saveError: "처리 중 오류가 발생했습니다. 다시 시도해 주세요."
          });
        }
      }
    };
    
    // 디바운스 적용 - 불필요한 API 호출 방지
    if (savedCheckTimerRef.current) {
      clearTimeout(savedCheckTimerRef.current);
    }
    
    savedCheckTimerRef.current = setTimeout(checkSavedStatus, 100);
    
    return () => {
      if (savedCheckTimerRef.current) {
        clearTimeout(savedCheckTimerRef.current);
      }
    };
  }, [placeId, isSaved, uiState.saveLoading, updateUiState]);
  
  // 네트워크 상태 변경 모니터링 - 최적화
  useEffect(() => {
    const handleOnline = () => {
      if (!placeId || !isMounted.current) return;
      
      // 저장 상태 재확인 - 불필요한 상태 업데이트 방지
      updateUiState({ saveLoading: true });
      
      // 디바운스 적용
      if (savedCheckTimerRef.current) {
        clearTimeout(savedCheckTimerRef.current);
      }
      
      savedCheckTimerRef.current = setTimeout(async () => {
        try {
          const status = await isSaved(placeId);
          
          if (isMounted.current) {
            updateUiState({ 
              saved: status, 
              saveError: null,
              saveLoading: false
            });
            
            // localStorage 업데이트
            try {
              const savedPlacesCache = localStorage.getItem('savedPlacesCache') || '{}';
              const savedPlacesMap = JSON.parse(savedPlacesCache);
              
              if (status) {
                savedPlacesMap[placeId] = {
                  timestamp: new Date().getTime()
                };
              } else {
                delete savedPlacesMap[placeId];
              }
              
              localStorage.setItem('savedPlacesCache', JSON.stringify(savedPlacesMap));
            } catch (storageError) {
              console.warn('localStorage 업데이트 실패:', storageError);
            }
          }
        } catch (error) {
          if (isMounted.current) {
            updateUiState({
              saveLoading: false,
              saveError: "저장 상태 확인 중 오류가 발생했습니다."
            });
          }
        }
      }, 300);
    };
    
    // 오프라인 상태 처리
    const handleOffline = () => {
      // 오프라인 상태에서 이미지 처리
      if (inView && !imgLoaded && !imgError) {
        // 오프라인이면서 이미지 로드 중이면 로딩 완료 처리
        setImgError(true); // 오류 표시
        updateUiState({ loading: false });
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [placeId, isSaved, updateUiState, inView, imgLoaded, imgError]);

  // 저장 토글 핸들러 - 애니메이션 및 햅틱 피드백 추가
  const handleToggleSave = useCallback(async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!placeId) {
      updateUiState({ saveError: "유효한 장소 정보가 없습니다" });
      return;
    }
    
    if (uiState.saveLoading) {
      return; // 중복 요청 방지
    }
    
    updateUiState({ 
      saveLoading: true,
      saveError: null
    });
    
    try {
      // 네트워크 상태 확인
      if (!navigator.onLine) {
        updateUiState({
          saveLoading: false,
          saveError: "오프라인 상태입니다. 온라인 상태에서 시도해주세요."
        });
        return;
      }
      
      // 햅틱 피드백 (지원되는 브라우저에서만)
      if (navigator.vibrate && isMobile) {
        navigator.vibrate(50); // 짧은 진동
      }
      
      // 낙관적 UI 업데이트 (즉시 시각적 피드백 제공)
      const newStatus = !uiState.saved;
      updateUiState({ saved: newStatus });
      
      // 적절한 애니메이션 시작
      if (newStatus) {
        startSaveAnimation();
      } else {
        startUnsaveAnimation();
      }
      
      // 정규화된 ID로 저장 토글
      const serverStatus = await toggleSave(placeId);
      
      // 저장 상태 변경 후 데이터 갱신 (선택적)
      if (typeof refreshData === 'function') {
        setTimeout(() => {
          refreshData().catch(err => console.warn('데이터 갱신 실패:', err));
        }, 300);
      }
      
      // 서버 응답과 로컬 상태가 다를 경우 동기화
      if (isMounted.current && serverStatus !== newStatus) {
        updateUiState({ saved: serverStatus });
      }
      
      // localStorage 업데이트
      try {
        const savedPlacesCache = localStorage.getItem('savedPlacesCache') || '{}';
        const savedPlacesMap = JSON.parse(savedPlacesCache);
        
        if (serverStatus) {
          // 저장된 경우 캐시에 추가
          savedPlacesMap[placeId] = {
            timestamp: new Date().getTime()
          };
        } else {
          // 저장 해제된 경우 캐시에서 제거
          delete savedPlacesMap[placeId];
        }
        
        localStorage.setItem('savedPlacesCache', JSON.stringify(savedPlacesMap));
      } catch (storageError) {
        console.warn('localStorage에 저장 상태 업데이트 실패:', storageError);
      }
    } catch (error) {
      console.error(`장소 ${placeId} 저장 토글 중 오류:`, error);
      
      if (isMounted.current) {
        // 실패 시 상태 복원
        updateUiState({
          saved: !uiState.saved, // 원래 상태로 되돌림
          saveError: error.message || "저장 상태 변경 중 오류가 발생했습니다."
        });
      }
    } finally {
      if (isMounted.current) {
        updateUiState({ saveLoading: false });
      }
    }
  }, [placeId, uiState.saveLoading, uiState.saved, toggleSave, startSaveAnimation, startUnsaveAnimation, updateUiState, isMobile, refreshData]);

  // 카드 클릭 핸들러 - 최적화
  const handleCardClick = useCallback(() => {
    if (!placeId) {
      return;
    }
    
    // 햅틱 피드백 (모바일 기기에서만)
    if (navigator.vibrate && isMobile) {
      navigator.vibrate(30); // 아주 짧은 진동
    }
    
    // 클릭 전 이미지 미리 로딩 요청
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      requestImageCaching(imageUrls);
    }
    
    // 장소 상세 페이지로 이동 시 정규화된 ID 사용
    navigate(`/place/${placeId}`);
  }, [navigate, placeId, isMobile, imageUrls]);
  
  // 스와이프 제스처 핸들러 - 조건부 생성으로 최적화
  const swipeHandlers = useMemo(() => {
    // 성능 최적화: 제스처가 비활성화되었거나 모바일이 아닌 경우 빈 객체 반환
    if (!animationSettings.enableGestures) {
      return {};
    }
    
    return {
      onSwipeLeft: () => {
        // 왼쪽으로 스와이프 - 공유 기능 등 추가 기능 활성화
        if (isMobile) {
          updateUiState({ shareOpen: true });
          
          // 자동으로 숨기기
          setTimeout(() => {
            if (isMounted.current) {
              updateUiState({ shareOpen: false });
            }
          }, 3000);
        }
      },
      onSwipeRight: () => {
        // 오른쪽으로 스와이프 - 저장 토글
        if (isMobile && !uiState.saveLoading) {
          handleToggleSave();
        }
      }
    };
  }, [animationSettings.enableGestures, isMobile, uiState.saveLoading, handleToggleSave, updateUiState]);

 // 카테고리 색상 가져오기 - 메모이제이션 개선
 const getCategoryColor = useMemo(() => {
  const category = placeRef.current?.category;
  return categoryColors[category] || categoryColors.default;
}, []);

// 카테고리 이름 가져오기 - 메모이제이션 추가
const getCategoryName = useMemo(() => {
  const category = placeRef.current?.category;
  return categoryNames[category] || categoryNames.default;
}, []);

// 저장된 날짜 포맷팅 (있을 경우) - 메모이제이션 추가
const getSavedDateText = useMemo(() => {
  const savedAt = placeRef.current?.savedAt;
  if (!savedAt) return null;
  
  try {
    const savedDate = savedAt instanceof Date 
      ? savedAt 
      : new Date(savedAt);
    
    return `${formatDistance(savedDate, new Date(), { addSuffix: true, locale: ko })} 저장`;
  } catch (error) {
    return null;
  }
}, []);

// 공유 핸들러 - 최적화
const handleShare = useCallback((e) => {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  
  if (!placeId) return;
  
  // 웹 공유 API 지원 확인
  if (navigator.share) {
    navigator.share({
      title: place.name,
      text: `${place.name}을(를) 확인해보세요!`,
      url: `${window.location.origin}/place/${placeId}`
    })
    .catch((error) => console.log('공유 실패:', error));
  } else {
    // 웹 공유 API를 지원하지 않는 경우 클립보드에 복사
    const shareUrl = `${window.location.origin}/place/${placeId}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        alert('링크가 클립보드에 복사되었습니다');
      })
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
      });
  }
  
  // 공유 메뉴 닫기
  updateUiState({ shareOpen: false });
}, [place.name, placeId, updateUiState]);

// 성능 최적화: 모션 감소 선호에 따른 애니메이션 설정
const accessibleVariants = prefersReducedMotion ? {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
} : cardVariants;

const hoverEffect = useMemo(() => {
  return !animationSettings.enableAnimations ? {} : { scale: 1.02, y: -5 };
}, [animationSettings.enableAnimations]);

const tapEffect = useMemo(() => {
  return !animationSettings.enableAnimations ? {} : { scale: 0.98 };
}, [animationSettings.enableAnimations]);

return (
  <motion.div
    ref={ref} // Intersection Observer 연결
    initial="hidden"
    animate="visible"
    variants={accessibleVariants}
    whileHover={hoverEffect}
    whileTap={tapEffect}
    {...(animationSettings.enableGestures ? swipeHandlers : {})}
    style={{ height: '100%' }}
    cardRef={cardRef}
  >
    <Card 
      elevation={uiState.hover ? 4 : 1} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        // 터치 디바이스에서 터치 응답성 개선
        WebkitTapHighlightColor: 'transparent',
        // 모바일 환경에서 터치 힌트
        '&:active': isMobile ? {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          transform: 'scale(0.98)',
          transition: 'transform 0.1s, background-color 0.1s'
        } : {}
      }}
      onMouseEnter={() => !isMobile && updateUiState({ hover: true })}
      onMouseLeave={() => !isMobile && updateUiState({ hover: false })}
    >
      <CardActionArea onClick={handleCardClick} sx={{ flexGrow: 1 }}>
        {/* 카테고리 라벨 - 조건부 애니메이션 적용 */}
        <Zoom in={!uiState.loading} timeout={animationSettings.enableAnimations ? 300 : 0}>
          <Chip
            label={getCategoryName}
            size="small"
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 2,
              backgroundColor: getCategoryColor,
              color: 'white',
              fontWeight: 'bold',
              // 모바일 환경에서 더 큰 터치 영역
              ...(isMobile ? {
                height: 28,
                fontSize: '0.75rem',
                '& .MuiChip-label': {
                  padding: '0 10px'
                }
              } : {})
            }}
          />
        </Zoom>
        
        {/* 저장 버튼 - 조건부 애니메이션으로 최적화 */}
        <Zoom in={!uiState.loading} timeout={animationSettings.enableAnimations ? 300 : 0}>
          <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
            <motion.div
              animate={uiState.saved && animationSettings.enableAnimations ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              <Tooltip title={uiState.saved ? "저장됨" : "저장하기"}>
                <IconButton
                  size="small"
                  onClick={handleToggleSave}
                  disabled={uiState.saveLoading || !navigator.onLine}
                  aria-label={uiState.saved ? "저장됨" : "저장하기"}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    },
                    // 모바일 환경에서 더 큰 터치 영역
                    ...(isMobile ? {
                      padding: '8px',
                    } : {})
                  }}
                >
                  {uiState.saved ? (
                    <FavoriteIcon color="error" />
                  ) : (
                    <FavoriteBorderIcon />
                  )}
                </IconButton>
              </Tooltip>
            </motion.div>
          </Box>
        </Zoom>

        {/* 이미지 영역 - 최적화된 지연 로딩 */}
        <Box sx={{ position: 'relative', height: 160, overflow: 'hidden' }}>
            {/* 스켈레톤 로딩 UI - 개선된 애니메이션 */}
            {(!imgLoaded || uiState.loading) && !imgError && (
              <Skeleton 
                variant="rectangular" 
                width="100%" 
                height="100%" 
                animation={animationSettings.enableAnimations ? "wave" : false}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  '&::after': animationSettings.enableAnimations ? {
                    background: 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.04), transparent)'
                  } : {}
                }}
              />
            )}
            
            {/* 이미지 로드 오류 시 폴백 UI */}
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
                <BrokenImageIcon color="disabled" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  이미지를 불러올 수 없습니다
                </Typography>
              </Box>
            )}
            
            {/* 실제 이미지 - 조건부 렌더링 & 지연 로딩 적용 */}
            {(inView || imageVisible) && !imgError && (
              <CardMedia
                component="img"
                height="160"
                image={thumbnailUrl}
                alt={place.name}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="lazy" // 네이티브 지연 로딩
                fetchpriority={index < 6 ? "high" : "auto"} // 우선순위 지정
                decoding="async" // 비동기 디코딩
                sx={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: uiState.loading ? 'none' : 'block',
                  opacity: uiState.loading ? 0 : 1,
                  transition: animationSettings.enableAnimations 
                    ? 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out' 
                    : 'none',
                  ...(uiState.hover && !isMobile && animationSettings.enableAnimations 
                    ? { transform: 'scale(1.05)' } 
                    : {}),
                  willChange: animationSettings.enableAnimations 
                    ? 'transform, opacity' 
                    : 'auto'
                }}
              />
            )}
          </Box>

          {/* 콘텐츠 섹션 - 조건부 애니메이션으로 최적화 */}
          <Fade in={!uiState.loading} timeout={animationSettings.enableAnimations ? 500 : 0}>
            <CardContent sx={{ flexGrow: 1, p: 2 }}>
              <Typography 
                variant="h6" 
                component="h2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1, 
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  // 모바일 환경에서 더 큰 폰트
                  ...(isMobile ? {
                    fontSize: '1.1rem'
                  } : {})
                }}
              >
                {place.name}
              </Typography>
              
              {/* 평점 */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Rating 
                  value={
                    place.averageRating?.overall || 
                    (typeof place.averageRating === 'number' ? place.averageRating : 0)
                  }
                  precision={0.5} 
                  size={isMobile ? "medium" : "small"} 
                  readOnly 
                  emptyIcon={<StarIcon style={{ opacity: 0.3 }} fontSize="inherit" />}
                />
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ ml: 0.5 }}
                >
                  {place.averageRating?.overall 
                    ? place.averageRating.overall.toFixed(1) 
                    : typeof place.averageRating === 'number'
                      ? place.averageRating.toFixed(1)
                      : '-'}
                </Typography>
              </Box>
              
              {/* 위치 정보 */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {place.subRegion || place.region || '위치 정보 없음'}
                </Typography>
              </Box>
              
              {/* 거리 또는 저장 날짜 */}
              {(isNearby && place.distance) || place.savedAt ? (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccessTimeIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />

                  <Typography variant="body2" color="text.secondary">
                    {isNearby && place.distance 
                      ? typeof place.distance === 'number'
                        ? place.distance < 1000
                          ? `${Math.round(place.distance)}m`
                          : `${(place.distance / 1000).toFixed(1)}km`
                        : place.formattedDistance || place.distance
                      : getSavedDateText}
                  </Typography>
                </Box>
              ) : null}
              
              {/* 태그 - 조건부 애니메이션 적용 */}
              {place.specialFeatures && place.specialFeatures.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {place.specialFeatures.slice(0, 3).map((tag, tagIndex) => (
                    <motion.div
                      key={tag}
                      initial={animationSettings.enableAnimations ? { opacity: 0, y: 10 } : { opacity: 1 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={animationSettings.enableAnimations ? {
                        delay: 0.1 + tagIndex * 0.1,
                        duration: 0.3
                      } : { duration: 0 }}
                    >
                      <Chip 
                        label={tag} 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.7rem',
                          height: 24,
                          // 모바일 환경에서 더 큰 터치 영역
                          ...(isMobile ? {
                            height: 28,
                            fontSize: '0.75rem'
                          } : {})
                        }}
                      />
                    </motion.div>
                  ))}
                </Box>
              )}

              {/* 추천 이유 - 조건부 애니메이션 적용 */}
              {place.matchScore && (
                <motion.div
                  initial={animationSettings.enableAnimations ? { opacity: 0, y: 10 } : { opacity: 1 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={animationSettings.enableAnimations ? { delay: 0.3, duration: 0.3 } : { duration: 0 }}
                >
                  <Box 
                    sx={{ 
                      mt: 1.5, 
                      p: 1, 
                      backgroundColor: `${getCategoryColor}20`,
                      borderRadius: 1
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                      {place.primaryReason || '맞춤 장소'}
                    </Typography>
                  </Box>
                </motion.div>
              )}
              
              {/* 저장 오류 표시 - 조건부 렌더링으로 최적화 */}
              {uiState.saveError && (
                <motion.div
                  initial={animationSettings.enableAnimations ? { opacity: 0, scale: 0.9 } : { opacity: 1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: animationSettings.enableAnimations ? 0.3 : 0 }}
                >
                  <Box 
                    sx={{ 
                      mt: 1.5, 
                      p: 1, 
                      backgroundColor: 'error.light',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <InfoIcon fontSize="small" sx={{ mr: 0.5, color: 'error.main' }} />
                    <Typography variant="caption" color="error.main">
                      {uiState.saveError}
                    </Typography>
                  </Box>
                </motion.div>
              )}
              
              {/* 오프라인 상태 표시 - 네트워크 상태에 따라 조건부 렌더링 */}
              {!navigator.onLine && (
                <motion.div
                  initial={animationSettings.enableAnimations ? { opacity: 0, y: 5 } : { opacity: 1 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: animationSettings.enableAnimations ? 0.3 : 0 }}
                >
                  <Box 
                    sx={{ 
                      mt: 1.5, 
                      p: 1, 
                      backgroundColor: 'warning.light',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <InfoIcon fontSize="small" sx={{ mr: 0.5, color: 'warning.main' }} />
                    <Typography variant="caption" color="warning.main">
                      오프라인 상태: 저장 기능은 온라인 상태에서만 가능합니다
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </CardContent>
          </Fade>
        </CardActionArea>
        
        {/* 공유 버튼 (모바일 스와이프 액션으로 나타남) - 조건부 렌더링으로 최적화 */}
        {isMobile && (
          <Fade in={uiState.shareOpen} timeout={animationSettings.enableAnimations ? 300 : 0}>
            <Box 
              sx={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                zIndex: 3
              }}
            >
              <motion.div
                initial={animationSettings.enableAnimations ? { scale: 0.8, opacity: 0 } : { opacity: 1 }}
                animate={{ 
                  scale: uiState.shareOpen ? 1 : 0.8, 
                  opacity: uiState.shareOpen ? 1 : 0 
                }}
                transition={{ duration: animationSettings.enableAnimations ? 0.2 : 0 }}
              >
                <Tooltip title="공유하기">
                  <IconButton
                    color="primary"
                    sx={{
                      backgroundColor: 'white',
                      boxShadow: 2,
                      '&:hover': {
                        backgroundColor: 'white',
                        boxShadow: 3
                      }
                    }}
                    onClick={handleShare}
                    size="medium"
                    aria-label="공유하기"
                  >
                    <ShareIcon />
                  </IconButton>
                </Tooltip>
              </motion.div>
            </Box>
          </Fade>
        )}
        
        {/* 저장됨 뱃지 애니메이션 - 조건부 애니메이션 적용 */}
        {uiState.saved && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: uiState.cardAnimation === 'save' && animationSettings.enableAnimations ? [0, 1.2, 1] : 1,
              opacity: 1
            }}
            transition={{ duration: animationSettings.enableAnimations ? 0.4 : 0 }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              pointerEvents: 'none'
            }}
          >
            <Badge
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: 'error.main',
                  color: 'white',
                  right: 48,
                  top: 13,
                  padding: '0 4px',
                }
              }}
              badgeContent="저장됨"
            />
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
});

// PropTypes 추가로 타입 안전성 개선
PlaceCard.propTypes = {
  place: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    placeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string.isRequired,
    photos: PropTypes.arrayOf(PropTypes.string),
    category: PropTypes.string,
    averageRating: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.shape({
        overall: PropTypes.number
      })
    ]),
    region: PropTypes.string,
    subRegion: PropTypes.string,
    distance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    formattedDistance: PropTypes.string,
    savedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    specialFeatures: PropTypes.arrayOf(PropTypes.string),
    matchScore: PropTypes.number,
    primaryReason: PropTypes.string
  }).isRequired,
  isNearby: PropTypes.bool,
  index: PropTypes.number
};

// displayName 설정 추가
PlaceCard.displayName = 'PlaceCard';

export default PlaceCard;
