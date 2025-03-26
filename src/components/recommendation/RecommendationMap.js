import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  IconButton, 
  Tooltip,
  Fade,
  useTheme,
  useMediaQuery,
  Button,
  CircularProgress
} from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import PlaceIcon from '@mui/icons-material/Place';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * 추천 장소를 지도에 표시하는 컴포넌트
 */
const RecommendationMap = ({ places, userLocation, onPlaceSelect, loading }) => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [infoWindow, setInfoWindow] = useState(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [markerListeners, setMarkerListeners] = useState([]);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // API 키를 환경 변수에서 가져오기
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  const initializeMap = useCallback(() => {
    // 구글 맵이 로드되었는지 확인
    if (!window.google || !window.google.maps) {
      console.warn('Google Maps API is not loaded yet');
      return;
    }

    // 지도 생성
    const mapOptions = {
      zoom: 14,
      center: userLocation 
        ? { lat: userLocation.latitude, lng: userLocation.longitude } 
        : { lat: 37.5665, lng: 126.9780 }, // 서울 시청
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    };

    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const newMap = new window.google.maps.Map(mapElement, mapOptions);
    setMap(newMap);

    // 정보 창 생성
    const newInfoWindow = new window.google.maps.InfoWindow();
    setInfoWindow(newInfoWindow);

    // 지도 바운드 객체 생성
    const newBounds = new window.google.maps.LatLngBounds();
    setBounds(newBounds);

    setMapInitialized(true);
  }, [userLocation]);

  // 지도 초기화
  useEffect(() => {
    if (window.google && window.google.maps && !mapInitialized) {
      initializeMap();
    } else if (!window.googleMapsLoaded) {
      // Google Maps API 로드
      window.googleMapsLoaded = true;
      
      const handleScriptError = () => {
        console.error('Google Maps API 로드 실패');
        setMapLoadError(true);
      };
      
      const script = document.createElement('script');
      // 환경 변수에서 API 키 가져오기
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = handleScriptError;
      document.head.appendChild(script);
      
      // 스크립트 로드 타임아웃 설정 (10초)
      const timeoutId = setTimeout(() => {
        if (!window.google || !window.google.maps) {
          handleScriptError();
        }
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [initializeMap, mapInitialized, apiKey]);

  // 마커 생성 및 업데이트
  useEffect(() => {
    if (!map || !places || !bounds) return;
    
    // 이전 마커 리스너 정리
    markerListeners.forEach(listener => {
      if (listener && typeof listener === 'function') {
        window.google.maps.event.removeListener(listener);
      }
    });
    setMarkerListeners([]);

    // 기존 마커 제거
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    // 새 마커 생성
    const newMarkers = [];
    const newListeners = [];
    
    places.forEach(place => {
      if (!place.location) return;

      // 마커 스타일
      const matchScore = place.matchScore || 5;
      const scaleFactor = 0.8 + (matchScore / 10) * 0.4; // 점수에 따라 0.8-1.2 사이의 크기 조정
      
      // 마커 위치
      const position = {
        lat: place.location.latitude,
        lng: place.location.longitude
      };

      // 마커 생성
      const marker = new window.google.maps.Marker({
        position,
        map,
        title: place.name,
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10 * scaleFactor,
          fillColor: theme.palette.primary.main,
          fillOpacity: 0.7,
          strokeWeight: 2,
          strokeColor: theme.palette.primary.dark,
        },
        zIndex: Math.floor(matchScore * 10)
      });

      // 마커 클릭 이벤트
      const clickListener = marker.addListener('click', () => {
        if (infoWindow) {
          // 정보 창 내용
          const content = `
            <div style="padding: 8px; max-width: 200px;">
              <h3 style="margin: 0 0 8px; font-size: 16px;">${place.name}</h3>
              <p style="margin: 0 0 4px; font-size: 13px; color: #666;">
                ${place.category ? getCategoryLabel(place.category) : ''}
              </p>
              <p style="margin: 0; font-size: 13px;">
                ${place.primaryReason || ''}
              </p>
              <div style="margin-top: 8px; text-align: center;">
                <a href="#" id="view-details-${place.id}" style="
                  display: inline-block;
                  padding: 4px 8px;
                  background-color: ${theme.palette.primary.main};
                  color: white;
                  text-decoration: none;
                  border-radius: 4px;
                  font-size: 13px;
                ">상세 보기</a>
              </div>
            </div>
          `;

          infoWindow.setContent(content);
          infoWindow.open(map, marker);

          // 상세 보기 버튼 클릭 이벤트
          setTimeout(() => {
            const detailButton = document.getElementById(`view-details-${place.id}`);
            if (detailButton) {
              detailButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (onPlaceSelect) onPlaceSelect(place.id);
              });
            }
          }, 10);
        }
      });
      
      // 리스너 참조 저장
      newListeners.push(clickListener);
      
      // 마커 위치를 바운드에 추가
      bounds.extend(position);
      
      // 마커 배열에 추가
      newMarkers.push(marker);
    });
    
    setMarkers(newMarkers);
    setMarkerListeners(newListeners);

    // 사용자 위치 마커 추가
    if (userLocation) {
      const userPosition = {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      };

      const userMarker = new window.google.maps.Marker({
        position: userPosition,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: theme.palette.secondary.main,
          fillOpacity: 0.9,
          strokeWeight: 2,
          strokeColor: theme.palette.secondary.dark,
        },
        zIndex: 1000,
        title: '내 위치'
      });

      bounds.extend(userPosition);
      setMarkers(prevMarkers => [...prevMarkers, userMarker]);
    }

    // 모든 마커가 보이도록 지도 중심 및 줌 조정
    if (newMarkers.length > 0) {
      map.fitBounds(bounds);
      
      // 줌 레벨 제한 (너무 가까이 확대되는 것 방지)
      const listener = window.google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 16) {
          map.setZoom(16);
        }
        window.google.maps.event.removeListener(listener);
      });
    } else if (userLocation) {
      // 장소가 없는 경우 사용자 위치 중심
      map.setCenter({
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
      map.setZoom(14);
    }
    
    // 컴포넌트 언마운트 시 정리 함수
    return () => {
      newListeners.forEach(listener => {
        if (listener && typeof listener === 'function') {
          window.google.maps.event.removeListener(listener);
        }
      });
    };
  }, [map, places, bounds, infoWindow, userLocation, theme, onPlaceSelect, markers, markerListeners]);

  // 카테고리 레이블 반환
  const getCategoryLabel = (category) => {
    const categories = {
      cafe: '카페',
      restaurant: '식당',
      culture: '문화공간',
      bookstore_cafe: '북카페',
      bar: '바/펍',
      art_cafe: '아트카페',
      traditional_teahouse: '전통찻집'
    };
    
    return categories[category] || category;
  };

  // 현재 위치로 지도 중심 이동
  const centerOnUserLocation = () => {
    if (!map || !userLocation) return;
    
    map.setCenter({
      lat: userLocation.latitude,
      lng: userLocation.longitude
    });
    map.setZoom(15);
  };

  // 모든 마커가 보이도록 지도 조정
  const showAllMarkers = () => {
    if (!map || !bounds || markers.length === 0) return;
    
    map.fitBounds(bounds);
  };
  
  // 지도 다시 로드
  const handleReloadMap = () => {
    setMapLoadError(false);
    
    // 이전 스크립트 제거
    const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
    scripts.forEach(script => script.remove());
    
    // 전역 변수 초기화
    window.googleMapsLoaded = false;
    
    // 지도 초기화 상태 리셋
    setMapInitialized(false);
    
    // 스크립트 다시 로드
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    script.onerror = () => setMapLoadError(true);
    document.head.appendChild(script);
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: isMobile ? '300px' : '500px' }}>
      {/* 지도 로드 오류 표시 */}
      {mapLoadError && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backgroundColor: '#f5f5f5',
            zIndex: 5
          }}
        >
          <ErrorIcon sx={{ fontSize: 40, color: 'error.main', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" paragraph>
            지도를 로드할 수 없습니다. 다시 시도해주세요.
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleReloadMap}
            sx={{ mt: 2 }}
          >
            다시 로드
          </Button>
        </Box>
      )}
      
      {/* 장소 없음 표시 */}
      {!mapLoadError && (!places || places.length === 0) && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backgroundColor: '#f5f5f5',
            zIndex: 5
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={40} color="primary" sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                지도를 로딩중입니다...
              </Typography>
            </>
          ) : (
            <>
              <LocationOffIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                표시할 장소가 없습니다
              </Typography>
            </>
          )}
        </Box>
      )}
      
      <div id="map" style={{ width: '100%', height: '100%' }} />
      
      {/* 컨트롤 버튼 */}
      <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
        <Tooltip title="내 위치로 이동" arrow TransitionComponent={Fade}>
          <span> {/* 비활성화된 버튼에 대한 Tooltip이 작동하도록 span으로 감싸기 */}
            <IconButton 
              onClick={centerOnUserLocation}
              sx={{ 
                backgroundColor: 'background.paper',
                boxShadow: 1,
                mb: 1,
                '&:hover': { backgroundColor: 'background.default' },
                '&.Mui-disabled': { backgroundColor: 'rgba(255, 255, 255, 0.7)' }
              }}
              disabled={!userLocation}
            >
              <CenterFocusStrongIcon />
            </IconButton>
          </span>
        </Tooltip>
        
        <Tooltip title="모든 장소 보기" arrow TransitionComponent={Fade}>
          <span> {/* 비활성화된 버튼에 대한 Tooltip이 작동하도록 span으로 감싸기 */}
            <IconButton 
              onClick={showAllMarkers}
              sx={{ 
                backgroundColor: 'background.paper',
                boxShadow: 1,
                '&:hover': { backgroundColor: 'background.default' },
                '&.Mui-disabled': { backgroundColor: 'rgba(255, 255, 255, 0.7)' }
              }}
              disabled={!places || places.length === 0}
            >
              <PlaceIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      
      {/* 범례 */}
      <Paper 
        elevation={2}
        sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: 16, 
          padding: 1,
          display: 'flex',
          alignItems: 'center',
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)'
        }}
      >
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: theme.palette.secondary.main,
            border: `2px solid ${theme.palette.secondary.dark}`,
            mr: 1
          }}
        />
        <Typography variant="caption" sx={{ mr: 2 }}>내 위치</Typography>
        
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
            border: `2px solid ${theme.palette.primary.dark}`,
            mr: 1
          }}
        />
        <Typography variant="caption">추천 장소</Typography>
      </Paper>
    </Box>
  );
};

export default RecommendationMap;
