import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Box, Card, CardContent, CardActionArea, Chip, Stack, Skeleton } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import StarIcon from '@mui/icons-material/Star';
import WarningIcon from '@mui/icons-material/Warning';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  limit
} from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { isOffline } from '../../utils/indexedDBUtils';

/**
 * 최근 활동(저장된 장소, 방문한 장소, 리뷰를 작성한 장소) 요약 컴포넌트
 * 개선사항:
 * - 비동기 데이터 요청 오류 처리 강화
 * - 데이터가 없을 때 사용자 친화적인 메시지 제공
 * - Promise 체인 최적화 및 오류 격리
 * - 로컬 캐싱 추가
 */
function RecentActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

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

  // 활동 유형에 따른 아이콘 매핑
  const getActivityIcon = (type) => {
    switch (type) {
      case 'saved':
        return <BookmarkIcon fontSize="small" sx={{ color: '#2196F3' }} />;
      case 'visited':
        return <LocationOnIcon fontSize="small" sx={{ color: '#4CAF50' }} />;
      case 'review':
        return <StarIcon fontSize="small" sx={{ color: '#FFC107' }} />;
      default:
        return null;
    }
  };

  // 장소 상세 페이지로 이동
  const handleActivityClick = (placeId) => {
    navigate(`/place/${placeId}`);
  };

  // 로컬 스토리지에서 캐시된 활동 가져오기
  const getCachedActivities = () => {
    if (!currentUser) return null;
    
    try {
      const cacheKey = `recentActivities_${currentUser.uid}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      return null;
    } catch (error) {
      console.warn("캐시 데이터 접근 오류:", error);
      return null;
    }
  };

  // 활동 데이터 캐싱
  const cacheActivities = (activitiesData) => {
    if (!currentUser || !activitiesData) return;
    
    try {
      const cacheKey = `recentActivities_${currentUser.uid}`;
      localStorage.setItem(cacheKey, JSON.stringify(activitiesData));
      
      // 캐시 만료 시간 설정 (24시간)
      const expiry = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem(`${cacheKey}_expiry`, expiry.toString());
    } catch (error) {
      console.warn("활동 데이터 캐싱 실패:", error);
    }
  };

  // 저장된 장소 처리 함수
  const processSavedPlaces = async (snapshot) => {
    if (!currentUser || snapshot.empty) return [];
    
    const result = [];
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        // 장소 정보 가져오기
        const placeDoc = await getDocs(query(
          collection(db, 'places'),
          where('id', '==', data.placeId),
          limit(1)
        ));
        
        if (!placeDoc.empty) {
          const placeData = placeDoc.docs[0].data();
          result.push({
            id: doc.id,
            placeId: data.placeId,
            placeName: placeData.name,
            placeCategory: placeData.category,
            placeRegion: placeData.subRegion || placeData.region,
            thumbnailUrl: placeData.photos?.[0] || '',
            type: 'saved',
            timestamp: data.savedAt?.toDate() || new Date(),
            activityText: '저장한 장소'
          });
        }
      } catch (error) {
        console.error(`저장 장소 처리 오류 (ID: ${doc.id}):`, error);
        // 개별 항목 오류를 격리하여 다른 항목 처리 계속
      }
    }
    
    return result;
  };

  // 방문한 장소 처리 함수
  const processVisitedPlaces = async (snapshot) => {
    if (!currentUser || snapshot.empty) return [];
    
    const result = [];
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        // 장소 정보 가져오기
        const placeDoc = await getDocs(query(
          collection(db, 'places'),
          where('id', '==', data.placeId),
          limit(1)
        ));
        
        if (!placeDoc.empty) {
          const placeData = placeDoc.docs[0].data();
          result.push({
            id: doc.id,
            placeId: data.placeId,
            placeName: placeData.name,
            placeCategory: placeData.category,
            placeRegion: placeData.subRegion || placeData.region,
            thumbnailUrl: placeData.photos?.[0] || '',
            type: 'visited',
            timestamp: data.visitDate?.toDate() || new Date(),
            activityText: '방문한 장소'
          });
        }
      } catch (error) {
        console.error(`방문 장소 처리 오류 (ID: ${doc.id}):`, error);
        // 개별 항목 오류를 격리하여 다른 항목 처리 계속
      }
    }
    
    return result;
  };

  // 리뷰 처리 함수
  const processReviews = async (snapshot) => {
    if (!currentUser || snapshot.empty) return [];
    
    const result = [];
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        // 장소 정보 가져오기
        const placeDoc = await getDocs(query(
          collection(db, 'places'),
          where('id', '==', data.placeId),
          limit(1)
        ));
        
        if (!placeDoc.empty) {
          const placeData = placeDoc.docs[0].data();
          result.push({
            id: doc.id,
            placeId: data.placeId,
            placeName: placeData.name,
            placeCategory: placeData.category,
            placeRegion: placeData.subRegion || placeData.region,
            thumbnailUrl: placeData.photos?.[0] || '',
            type: 'review',
            timestamp: data.createdAt?.toDate() || new Date(),
            rating: data.rating,
            activityText: `${data.rating}점 평가`
          });
        }
      } catch (error) {
        console.error(`리뷰 처리 오류 (ID: ${doc.id}):`, error);
        // 개별 항목 오류를 격리하여 다른 항목 처리 계속
      }
    }
    
    return result;
  };

  // 데이터 로딩 함수
  const fetchRecentActivities = useCallback(async (isRefreshing = false) => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // 오프라인 상태 확인
      if (isOffline()) {
        console.log("오프라인 상태: 캐시된 활동 데이터 사용");
        
        const cachedData = getCachedActivities();
        if (cachedData && cachedData.length > 0) {
          setActivities(cachedData);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        
        // 캐시가 없는 경우 사용자에게 알림
        setError("오프라인 상태이며 캐시된 데이터가 없습니다.");
        setActivities([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // 로컬 캐시 먼저 확인 (빠른 UI 표시)
      const cachedActivities = getCachedActivities();
      if (cachedActivities && cachedActivities.length > 0 && !isRefreshing) {
        setActivities(cachedActivities);
        // 로딩 상태 유지하며 백그라운드에서 새로운 데이터 가져오기
      }
      
      // 저장된 장소 가져오기 쿼리
      const savedPlacesQuery = query(
        collection(db, 'savedPlaces'),
        where('userId', '==', currentUser.uid),
        orderBy('savedAt', 'desc'),
        limit(3)
      );
      
      // 방문한 장소 가져오기 쿼리
      const visitedPlacesQuery = query(
        collection(db, 'visitedPlaces'),
        where('userId', '==', currentUser.uid),
        orderBy('visitDate', 'desc'),
        limit(3)
      );
      
      // 리뷰를 작성한 장소 가져오기 쿼리
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(3)
      );
      
      // Promise.all 대신 각 요청을 독립적으로 처리하여 부분 실패 허용
      let combinedActivities = [];
      
      try {
        // 저장된 장소 가져오기 시도
        const savedSnapshot = await getDocs(savedPlacesQuery);
        const savedPlaces = await processSavedPlaces(savedSnapshot);
        combinedActivities = [...combinedActivities, ...savedPlaces];
      } catch (savedError) {
        console.error("저장된 장소 가져오기 오류:", savedError);
      }
      
      try {
        // 방문한 장소 가져오기 시도
        const visitedSnapshot = await getDocs(visitedPlacesQuery);
        const visitedPlaces = await processVisitedPlaces(visitedSnapshot);
        combinedActivities = [...combinedActivities, ...visitedPlaces];
      } catch (visitedError) {
        console.error("방문한 장소 가져오기 오류:", visitedError);
      }
      
      try {
        // 리뷰 가져오기 시도
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviews = await processReviews(reviewsSnapshot);
        combinedActivities = [...combinedActivities, ...reviews];
      } catch (reviewsError) {
        console.error("리뷰 가져오기 오류:", reviewsError);
      }
      
      // 결과가 있으면 설정, 없으면 빈 배열 유지
      if (combinedActivities.length > 0) {
        // 최신순으로 정렬
        const sortedActivities = combinedActivities.sort((a, b) => b.timestamp - a.timestamp);
        
        // 최대 5개까지만 보여주기
        const limitedActivities = sortedActivities.slice(0, 5);
        
        setActivities(limitedActivities);
        
        // 로컬 캐싱 추가
        cacheActivities(limitedActivities);
      } else {
        setActivities([]);
      }
      
      // 자동 재시도 카운터 리셋
      setRetryCount(0);
      
    } catch (error) {
      console.error('최근 활동 가져오기 오류:', error);
      setError(error.message || '활동 내역을 불러오는 중 오류가 발생했습니다.');
      
      // 첫 번째 오류면 자동 재시도
      if (retryCount === 0) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          console.log("활동 데이터 자동 재시도...");
          fetchRecentActivities(isRefreshing);
        }, 3000); // 3초 후 재시도
      } else {
        // 캐시된 데이터가 있으면 그대로 유지
        const cachedData = getCachedActivities();
        if (cachedData && cachedData.length > 0) {
          setActivities(cachedData);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, retryCount]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchRecentActivities();
    
    // 네트워크 상태 변경 감지 (온라인으로 변경 시 새로고침)
    const handleOnline = () => {
      console.log("네트워크 연결 복구, 활동 데이터 새로고침");
      fetchRecentActivities(true);
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchRecentActivities]);
  
  // 새로고침 핸들러
  const handleRefresh = () => {
    if (refreshing || loading) return; // 이미 로딩 중이면 무시
    fetchRecentActivities(true);
  };

  // 활동이 없는 경우 표시할 내용
  if (!loading && !refreshing && activities.length === 0) {
    return (
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            최근 활동
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            size="small"
            onClick={handleRefresh}
            disabled={loading || refreshing || !currentUser}
            sx={{ fontSize: '0.8rem' }}
          >
            새로고침
          </Button>
        </Box>
        
        <Card sx={{ backgroundColor: '#f9f9f9' }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
              <WarningIcon sx={{ color: 'text.secondary', mb: 1, fontSize: 40 }} />
              <Typography variant="body1" color="text.secondary" align="center">
                {currentUser 
                  ? '아직 활동 내역이 없습니다.'
                  : '로그인이 필요합니다.'}
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                {currentUser 
                  ? (
                    error 
                      ? error 
                      : '장소를 저장하거나 방문해보세요!'
                  )
                  : '로그인하면 최근 활동 내역을 확인할 수 있습니다.'}
              </Typography>
              {error && currentUser && (
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
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          최근 활동
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          size="small"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          sx={{ fontSize: '0.8rem' }}
        >
          새로고침
        </Button>
      </Box>
      
      {loading && !refreshing && !activities.length ? (
        // 로딩 중 스켈레톤 UI (초기 로딩 시에만)
        Array.from({ length: 3 }).map((_, index) => (
          <Card sx={{ mb: 1.5 }} key={`skeleton-${index}`}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
              <Skeleton variant="rectangular" width={40} height={40} sx={{ mr: 2, borderRadius: 1 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton width="60%" height={24} />
                <Skeleton width="40%" height={18} />
              </Box>
            </CardContent>
          </Card>
        ))
      ) : (
        // 최근 활동 목록
        <>
          {activities.map((activity) => (
            <Card sx={{ mb: 1.5 }} key={`${activity.type}-${activity.id}`}>
              <CardActionArea onClick={() => handleActivityClick(activity.placeId)}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                  {getActivityIcon(activity.type)}
                  <Box sx={{ ml: 1.5, flexGrow: 1 }}>
                    <Typography variant="body1" noWrap>
                      {activity.placeName}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <Chip 
                        label={getCategoryStyle(activity.placeCategory).label} 
                        size="small" 
                        sx={{ 
                          backgroundColor: `${getCategoryStyle(activity.placeCategory).color}15`, 
                          color: getCategoryStyle(activity.placeCategory).color,
                          height: '20px',
                          fontSize: '0.7rem'
                        }} 
                      />
                      <Typography variant="caption" color="text.secondary">
                        {activity.placeRegion}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                        {activity.activityText}
                        {activity.type === 'review' && ` · ${activity.rating}`}
                      </Typography>
                    </Stack>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
          {refreshing && (
            // 새로고침 시 로딩 표시
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Skeleton variant="rectangular" width={100} height={6} sx={{ borderRadius: 3 }} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default RecentActivities;
