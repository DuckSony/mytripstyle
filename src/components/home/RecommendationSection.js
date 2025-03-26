import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  CardMedia, 
  CardActionArea, 
  Chip, 
  Rating, 
  Stack, 
  Skeleton,
  Button,
  IconButton,
  Alert,
  Snackbar
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import WarningIcon from '@mui/icons-material/Warning';
import { useUser } from '../../contexts/UserContext';
import firebaseAPI from '../../config/firebase';
import { getCachedRecommendations } from '../../services/cacheService';
import { isOffline } from '../../utils/indexedDBUtils';

/**
 * 사용자 맞춤형 추천 섹션 컴포넌트
 */
function RecommendationSection() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showError, setShowError] = useState(false);
  const { userProfile, isProfileComplete } = useUser();
  const navigate = useNavigate();

  // 폴백 추천 데이터 생성 함수
  const generateFallbackRecommendations = useCallback(() => {
    // 더미 데이터 생성
    const categories = ['cafe', 'restaurant', 'culture', 'bookstore_cafe', 'bar', 'art_cafe'];
    const regions = ['강남/서초', '홍대/합정', '이태원/경리단길', '성수동', '연남동', '을지로/종로'];
    
    return Array.from({ length: 6 }, (_, index) => ({
      id: `fallback_${index}`,
      name: `추천 장소 ${index + 1}`,
      category: categories[index % categories.length],
      subRegion: regions[index % regions.length],
      region: '서울',
      averageRating: { overall: (Math.random() * 2 + 3).toFixed(1) },
      photos: [`https://via.placeholder.com/300x200?text=Place+${index + 1}`],
      recommendationType: 'fallback',
      recommendationReason: '오프라인 추천',
      isFallback: true
    }));
  }, []);

  // 추천 데이터 가져오기
  const fetchRecommendations = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing && loading) return; // 이미 로딩 중이면 중복 요청 방지
    
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // 기본 추천 데이터 가져오기 함수
      const fetchBasicRecommendations = async () => {
        try {
          // 인기 장소나 에디터 추천 등의 기본 데이터 요청
          const response = await firebaseAPI.getFeaturedRecommendations({
            type: 'popular',
            limit: 6
          });
          
          if (response.success) {
            return response.data.map(place => ({
              ...place,
              recommendationType: 'popular',
              recommendationReason: '인기 장소'
            }));
          }
          
          // 실패 시 더미 데이터 반환
          return generateFallbackRecommendations();
        } catch (e) {
          console.warn("기본 추천 데이터 가져오기 실패:", e);
          return generateFallbackRecommendations();
        }
      };
      
      // 사용자 프로필 없을 때 대체 로직 추가
      if (!userProfile) {
        console.log("사용자 프로필 없음, 기본 추천 사용");
        // 기본 추천 데이터 (인기 장소나 에디터 추천 등)
        const basicRecommendations = await fetchBasicRecommendations();
        setRecommendations(basicRecommendations);
        return;
      }
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태: 캐시된 추천 또는 기본 추천 사용");
        
        // 캐시에서 데이터 확인
        try {
          const userId = userProfile.userId || 'anonymous';
          const cachedData = await getCachedRecommendations(userId);
          
          if (cachedData && cachedData.length > 0) {
            console.log("캐시된 추천 데이터 사용");
            setRecommendations(cachedData);
            return;
          }
        } catch (cacheError) {
          console.warn("캐시 데이터 접근 오류:", cacheError);
        }
        
        // 캐시 없으면 기본 추천
        const fallbackData = generateFallbackRecommendations();
        setRecommendations(fallbackData);
        return;
      }
      
      // 현재 위치 가져오기 (브라우저 위치 API 사용)
      const getCurrentPosition = () => {
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
          }
          
          // 위치 요청 타임아웃 설정
          const timeout = setTimeout(() => {
            reject(new Error('위치 요청 시간 초과'));
          }, 5000);
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeout);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
            },
            (error) => {
              clearTimeout(timeout);
              console.warn('Error getting location:', error.message);
              // 기본 위치 (서울)
              resolve({
                latitude: 37.5665,
                longitude: 126.9780
              });
            },
            { timeout: 5000, maximumAge: 10 * 60 * 1000 } // 10분 캐시, 5초 타임아웃
          );
        });
      };
      
      let currentLocation;
      try {
        currentLocation = await getCurrentPosition();
      } catch (locationError) {
        console.warn("위치 정보 가져오기 실패:", locationError);
        // 기본 위치 사용
        currentLocation = {
          latitude: 37.5665,
          longitude: 126.9780
        };
      }
      
      // 관심사 기반 추천 가져오기
      let interestsRecommendations = [];
      try {
        interestsRecommendations = await firebaseAPI.findPlacesByInterests(
          [...(userProfile.interests || []), ...(userProfile.customInterests || [])].filter(Boolean),
          3
        );
      } catch (interestsError) {
        console.warn("관심사 기반 추천 가져오기 실패:", interestsError);
      }
      
      // 위치 기반 추천 가져오기
      let nearbyResult = { success: false, data: [] };
      try {
        nearbyResult = await firebaseAPI.getNearbyRecommendations(
          userProfile, 
          currentLocation, 
          5000, // 5km 반경
          {
            useCache: true,
            timeout: 8000 // 8초 타임아웃
          }
        );
      } catch (nearbyError) {
        console.warn("근처 추천 가져오기 실패:", nearbyError);
      }
      
      // 카테고리별 인기 장소 가져오기
      const categories = ['cafe', 'restaurant', 'culture', 'bookstore_cafe', 'bar'];
      let topCategoryPlaces = {};
      try {
        topCategoryPlaces = await firebaseAPI.findTopRatedPlacesByCategory(categories, 2);
      } catch (categoryError) {
        console.warn("카테고리별 인기 장소 가져오기 실패:", categoryError);
        // 빈 객체로 초기화
        topCategoryPlaces = categories.reduce((acc, category) => {
          acc[category] = [];
          return acc;
        }, {});
      }
      
      // 모든 추천 데이터 결합 및 다양성 확보
      let combinedRecommendations = [];
      
      // 1. 관심사 기반 추천 (최대 2개)
      if (interestsRecommendations.length > 0) {
        combinedRecommendations = combinedRecommendations.concat(
          interestsRecommendations.slice(0, 2).map(place => ({
            ...place,
            recommendationType: 'interests',
            recommendationReason: `${place.matchingInterests?.[0] || '관심사'} 기반`
          }))
        );
      }
      
      // 2. MBTI 기반 추천 (최대 2개)
      const allRecommendations = nearbyResult.success ? nearbyResult.data : [];
      if (allRecommendations.length > 0) {
        const mbtiRecommendations = allRecommendations
          .filter(place => 
            place.matchDetails && 
            place.matchDetails.mbtiScore >= 7 && 
            !combinedRecommendations.some(r => r.id === place.id)
          )
          .slice(0, 2)
          .map(place => ({
            ...place,
            recommendationType: 'mbti',
            recommendationReason: `${userProfile.mbti || 'MBTI'} 성향 맞춤`
          }));
        
        combinedRecommendations = combinedRecommendations.concat(mbtiRecommendations);
      }
      
      // 3. 카테고리별 인기 장소 (최대 1개씩, 총 최대 3개)
      const popularPlaces = [];
      Object.entries(topCategoryPlaces).forEach(([category, places]) => {
        if (places.length > 0 && popularPlaces.length < 3) {
          // 이미 추가된 장소는 제외
          const placeToAdd = places.find(place => 
            !combinedRecommendations.some(r => r.id === place.id) && 
            !popularPlaces.some(p => p.id === place.id)
          );
          
          if (placeToAdd) {
            popularPlaces.push({
              ...placeToAdd,
              recommendationType: 'popular',
              recommendationReason: '인기 장소'
            });
          }
        }
      });
      
      combinedRecommendations = combinedRecommendations.concat(popularPlaces);
      
      // 추천이 부족한 경우 기본 추천으로 보충
      if (combinedRecommendations.length < 4) {
        console.log("추천 데이터 부족, 기본 추천으로 보충");
        const basicRecommendations = await fetchBasicRecommendations();
        
        // 이미 추가된 장소 ID 추출
        const existingIds = combinedRecommendations.map(place => place.id);
        
        // 중복 없는 기본 추천 필터링
        const additionalRecommendations = basicRecommendations
          .filter(place => !existingIds.includes(place.id))
          .slice(0, 6 - combinedRecommendations.length);
          
        combinedRecommendations = combinedRecommendations.concat(additionalRecommendations);
      }
      
      // 최대 6개 추천으로 제한
      setRecommendations(combinedRecommendations.slice(0, 6));
      setRetryCount(0); // 성공 시 재시도 카운터 리셋
      
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError(error.message || '추천 데이터를 가져오는 데 문제가 발생했습니다.');
      setShowError(true);
      
      // 첫 번째 오류면 자동 재시도
      if (retryCount === 0) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          console.log("추천 데이터 자동 재시도...");
          fetchRecommendations(isRefreshing);
        }, 3000); // 3초 후 재시도
      } else {
        // 재시도 실패했을 경우 폴백 데이터 사용
        console.log("재시도 실패, 폴백 데이터 사용");
        const fallbackData = generateFallbackRecommendations();
        setRecommendations(fallbackData);
      }
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, retryCount, loading, generateFallbackRecommendations]);

  // 컴포넌트 마운트 시 추천 데이터 가져오기
  useEffect(() => {
    fetchRecommendations();
    
    // 네트워크 상태 변경 감지 (온라인으로 변경 시 새로고침)
    const handleOnline = () => {
      console.log("네트워크 연결 복구, 데이터 새로고침");
      fetchRecommendations(true);
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchRecommendations]);

  // 새로고침 핸들러
  const handleRefresh = () => {
    if (refreshing || loading) return; // 이미 로딩 중이면 무시
    fetchRecommendations(true);
  };

  // 더 보기 핸들러
  const handleSeeMore = () => {
    navigate('/recommendations');
  };

  // 장소 클릭 핸들러
  const handlePlaceClick = (placeId) => {
    navigate(`/place/${placeId}`);
  };

  // 오류 알림 닫기 핸들러
  const handleCloseError = () => {
    setShowError(false);
  };

  // 장소 카테고리에 따른 아이콘 및 색상 매핑
  const getCategoryStyle = (category) => {
    const categoryStyles = {
      cafe: { color: '#7E57C2', label: '카페' },
      restaurant: { color: '#F44336', label: '식당' },
      culture: { color: '#2196F3', label: '문화공간' },
      bookstore_cafe: { color: '#4CAF50', label: '북카페' },
      bar: { color: '#FF9800', label: '바/펍' },
      art_cafe: { color: '#9C27B0', label: '아트카페' },
      traditional_teahouse: { color: '#795548', label: '전통찻집' }
    };
    
    return categoryStyles[category] || { color: '#9E9E9E', label: '기타' };
  };

  // 추천 이유에 따른 색상 매핑
  const getRecommendationStyle = (type) => {
    const recommendationStyles = {
      interests: { color: '#4CAF50', backgroundColor: '#4CAF5015' },
      mbti: { color: '#2196F3', backgroundColor: '#2196F315' },
      popular: { color: '#FF9800', backgroundColor: '#FF980015' },
      fallback: { color: '#9E9E9E', backgroundColor: '#9E9E9E15' }
    };
    
    return recommendationStyles[type] || { color: '#9E9E9E', backgroundColor: '#9E9E9E15' };
  };

  // 추천이 없는 경우 표시할 내용
  if (!loading && !refreshing && recommendations.length === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            맞춤 추천
          </Typography>
          <IconButton 
            onClick={handleRefresh} 
            size="small"
            disabled={!userProfile}
            sx={{ color: 'primary.main' }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
        
        <Card sx={{ backgroundColor: '#f9f9f9' }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
              <WarningIcon sx={{ color: 'text.secondary', mb: 1, fontSize: 40 }} />
              <Typography variant="body1" color="text.secondary" align="center">
                추천을 불러올 수 없습니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                {!isProfileComplete 
                  ? "프로필을 완성하고 맞춤형 추천을 받아보세요!" 
                  : "네트워크 연결을 확인하고 다시 시도해 주세요."}
              </Typography>
              {error && (
                <Typography variant="caption" color="error" align="center" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              )}
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                onClick={handleRefresh}
                sx={{ mt: 2 }}
                startIcon={<RefreshIcon />}
                disabled={loading || refreshing}
              >
                다시 시도
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">
          맞춤 추천
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={handleRefresh} 
            size="small"
            disabled={loading || refreshing}
            sx={{ color: 'primary.main', mr: 1 }}
          >
            <RefreshIcon />
          </IconButton>
          <Button 
            onClick={handleSeeMore}
            endIcon={<NavigateNextIcon />}
            sx={{ fontSize: '0.8rem' }}
          >
            더보기
          </Button>
        </Box>
      </Box>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        {loading || refreshing ? (
          // 로딩 중 스켈레톤 UI
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={`skeleton-${index}`}>
              <Skeleton variant="rectangular" height={120} />
              <CardContent sx={{ p: 1.5 }}>
                <Skeleton width="70%" height={24} />
                <Skeleton width="40%" height={20} sx={{ mt: 1 }} />
                <Skeleton width="60%" height={20} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          ))
        ) : (
          // 추천 장소 카드
          recommendations.map((place) => (
            <Card 
              key={place.id} 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                ...(place.isFallback ? { border: '1px dashed #ccc' } : {})
              }}
            >
              <CardActionArea onClick={() => handlePlaceClick(place.id)}>
                <CardMedia
                  component="img"
                  height="120"
                  image={place.photos?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'}
                  alt={place.name}
                />
                <CardContent sx={{ p: 1.5, flex: 1 }}>
                  <Typography variant="body1" component="div" noWrap fontWeight="medium">
                    {place.name}
                  </Typography>
                  
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip 
                      label={getCategoryStyle(place.category).label} 
                      size="small" 
                      sx={{ 
                        backgroundColor: `${getCategoryStyle(place.category).color}15`, 
                        color: getCategoryStyle(place.category).color,
                        height: '20px',
                        fontSize: '0.7rem'
                      }} 
                    />
                    <Typography variant="caption" color="text.secondary">
                      {place.subRegion || place.region}
                    </Typography>
                  </Stack>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Rating 
                        value={place.averageRating?.overall || 0} 
                        size="small" 
                        precision={0.1} 
                        readOnly 
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        ({place.averageRating?.overall?.toFixed(1) || 'N/A'})
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Chip 
                    label={place.recommendationReason} 
                    size="small" 
                    sx={{ 
                      mt: 1,
                      backgroundColor: getRecommendationStyle(place.recommendationType).backgroundColor, 
                      color: getRecommendationStyle(place.recommendationType).color,
                      height: '20px',
                      fontSize: '0.7rem'
                    }} 
                  />
                </CardContent>
              </CardActionArea>
            </Card>
          ))
        )}
      </Box>
      
      {/* 오류 알림 */}
      <Snackbar 
        open={showError} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error || '추천을 불러오는 중 오류가 발생했습니다.'}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default RecommendationSection;
