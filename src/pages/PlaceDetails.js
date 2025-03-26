// src/pages/PlaceDetails.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Box, Typography, Button, Divider, 
  IconButton, Card, CardContent, Tab, Tabs, Paper,
  Alert, Fade, Slide, Zoom, Grow, Collapse
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
// firebase.js로부터 직접 함수 임포트
import { getPlaceDetails, generateDummyPlace } from '../config/firebase';
import { useUser } from '../contexts/UserContext';
import { useSavedPlaces } from '../contexts/SavedPlacesContext';

// 컴포넌트 임포트
import ImageGallery from '../components/place/ImageGallery';
import PlaceInfo from '../components/place/PlaceInfo';
import ActionButtons from '../components/place/ActionButtons';
import RecommendationReasons from '../components/place/RecommendationReasons';
import PlaceDetailsSkeleton from '../components/recommendation/PlaceDetailsSkeleton';
import ReviewList from '../components/review/ReviewList';
import FeedbackForm from '../components/feedback/FeedbackForm';

/**
 * 장소 상세 페이지 컴포넌트
 * 개선된 오류 처리, 더미 데이터, 로딩 상태 처리 추가
 */
const PlaceDetails = () => {
  // URL 파라미터에서 placeId 추출 (하이픈 형식도 처리)
  const { placeId: encodedPlaceId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useUser();
  const { isSaved } = useSavedPlaces();

  // placeId 정규화 및 참조 설정
  const placeId = useRef(null);
  
  // placeId 정규화 함수
  const normalizePlaceId = useCallback((id) => {
    if (!id) return null;
    
    // 하이픈으로 구분된 형식 처리 (place-activity-5-1742765749367)
    const parts = id.split('-');
    if (parts.length > 1) {
      // 마지막 부분이 숫자인지 확인
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        return lastPart;
      }
    }
    
    // 숫자 패턴 추출
    const numericMatches = id.match(/(\d+)$/);
    if (numericMatches && numericMatches[1]) {
      return numericMatches[1];
    }
    
    // 그 외에는 원본 ID 사용
    return id;
  }, []);

  // 초기 placeId 설정
  useEffect(() => {
    if (encodedPlaceId && !placeId.current) {
      const normalizedId = normalizePlaceId(encodedPlaceId);
      placeId.current = normalizedId;
      console.log(`정규화된 placeId: ${normalizedId} (원본: ${encodedPlaceId})`);
    }
  }, [encodedPlaceId, normalizePlaceId]);

  // 상태 관리
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saveBtnLoading, setSaveBtnLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadRetryCount, setLoadRetryCount] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [feedbackUpdated, setFeedbackUpdated] = useState(false);
  
  // 애니메이션 상태
  const [pageLoaded, setPageLoaded] = useState(false);
  const [tabContentVisible, setTabContentVisible] = useState(true);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [infoLoaded, setInfoLoaded] = useState(false);
  const [actionsLoaded, setActionsLoaded] = useState(false);
  const tabContentRef = useRef(null);

  // 더미 데이터 설정 함수
  const setDummyData = useCallback(() => {
    if (!placeId.current) return;
    
    console.log(`더미 데이터 생성 중 (placeId: ${placeId.current})`);
    
    // generateDummyPlace 함수 호출 방식 수정
    const dummyData = generateDummyPlace(placeId.current, {
      name: `테스트 장소 ${placeId.current.substring(0, 5)}`,
      description: '테스트 장소입니다. 현재 데이터를 로드할 수 없어 임시 데이터를 표시합니다.',
      category: 'cafe',
      subCategory: '북카페',
      region: '서울',
      subRegion: '강남/서초'
    });
    
    // 더미 데이터 설정
    setPlace(dummyData);
    document.title = `${dummyData.name} | MyTripStyle`;
    console.log("더미 데이터 설정 완료:", dummyData);
    
    // 애니메이션 적용
    setTimeout(() => setPageLoaded(true), 100);
    setTimeout(() => setGalleryLoaded(true), 300);
    setTimeout(() => setInfoLoaded(true), 600);
    setTimeout(() => setActionsLoaded(true), 900);
  }, []);

  // 로딩 타임아웃 처리
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log("로딩 타임아웃 발생, 대체 데이터 표시");
        setLoadingTimeout(true);
      }
    }, 10000);
    
    return () => clearTimeout(timeoutId);
  }, [loading]);

  // 타임아웃 발생 시 더미 데이터 사용
  useEffect(() => {
    if (loadingTimeout && loading) {
      console.log("타임아웃으로 인한 대체 데이터 생성");
      setDummyData();
      setLoading(false);
    }
  }, [loadingTimeout, loading, setDummyData]);

 // 장소 데이터 불러오기 함수
 const loadPlaceData = useCallback(async () => {
  if (!placeId.current) {
    console.error("URL에서 유효한 placeId를 추출할 수 없습니다");
    setError('장소 ID가 제공되지 않았습니다.');
    setLoading(false);
    return;
  }
  
  try {
    setLoading(true);
    
    // 애니메이션 상태 초기화
    setPageLoaded(false);
    setGalleryLoaded(false);
    setInfoLoaded(false);
    setActionsLoaded(false);
    
    console.log(`장소 정보 요청 시작 (ID: ${placeId.current})`);
    
    // getPlaceDetails 함수 호출 및 결과 처리 방식 수정
    const result = await getPlaceDetails(placeId.current, {
      useCache: true,
      timeout: 15000,
      defaultCategory: 'cafe'
    });
    
    console.log("장소 데이터 응답:", result);
    
    if (result.success && result.data) {
      // 장소 데이터를 찾았는지 확인
      if (result.data.isDummy && result.data.notFound) {
        console.warn("요청한 장소를 찾을 수 없습니다");
        setError(`요청하신 장소 ID(${placeId.current})에 해당하는 정보를 찾을 수 없습니다.`);
        setLoading(false);
        return;
      }
      
      // 정상 데이터 처리
      console.log("장소 데이터 로드 성공:", result.data);
      setPlace(result.data);
      setError(null);
      
      // 문서 제목 업데이트
      document.title = `${result.data.name} | MyTripStyle`;
      
      // 애니메이션 시작
      setTimeout(() => setPageLoaded(true), 100);
      setTimeout(() => setGalleryLoaded(true), 300);
      setTimeout(() => setInfoLoaded(true), 600);
      setTimeout(() => setActionsLoaded(true), 900);
    } else {
      // 오류 처리
      console.error("장소 정보를 가져오지 못했습니다:", result.error || "알 수 없는 오류");
      setError(result.error || '장소 정보를 불러오는 중 오류가 발생했습니다.');
    }
  } catch (err) {
    console.error('장소 상세정보 가져오기 오류:', err);
    setError(err.message || '장소 정보를 불러오는 중 오류가 발생했습니다.');
    
    // 자동 재시도 (최대 1회)
    if (loadRetryCount < 1) {
      console.log(`데이터 로드 자동 재시도 (${loadRetryCount + 1})...`);
      setLoadRetryCount(prev => prev + 1);
      
      setTimeout(() => {
        loadPlaceData();
      }, 2000);
      return;
    }
  } finally {
    setLoading(false);
  }
}, [placeId, loadRetryCount]);

// 초기 로드 실행
useEffect(() => {
  console.log("PlaceDetails 마운트, placeId:", placeId.current);
  loadPlaceData();
  
  // 컴포넌트 언마운트 시 제목 초기화
  return () => {
    document.title = 'MyTripStyle';
  };
}, [loadPlaceData]);

// 저장 상태 확인
useEffect(() => {
  const checkSavedStatus = async () => {
    if (!placeId.current || !currentUser) return;
    
    setSaveBtnLoading(true);
    
    try {
      const savedStatus = await isSaved(placeId.current);
      console.log(`장소 저장 상태 확인 (ID: ${placeId.current}), 결과:`, savedStatus);
      setSaved(savedStatus);
    } catch (err) {
      console.error("저장 상태 확인 오류:", err);
      setSaved(false);
    } finally {
      setSaveBtnLoading(false);
    }
  };
  
  checkSavedStatus();
}, [isSaved, currentUser]);

// 이벤트 핸들러
const handleRetryLoad = () => {
  setLoadRetryCount(0);
  setLoading(true);
  setLoadingTimeout(false);
  loadPlaceData();
};

const handleGoBack = () => {
  setPageLoaded(false);
  setTimeout(() => {
    navigate(-1);
  }, 300);
};

const handleTabChange = (event, newValue) => {
  setTabContentVisible(false);
  
  setTimeout(() => {
    setActiveTab(newValue);
    setTabContentVisible(true);
    
    // 스크롤 위치 조정
    if (tabContentRef.current) {
      tabContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 300);
};

const handleImageChange = (index) => {
  setCurrentImageIndex(index);
};

// 피드백 제출/수정 후 처리
const handleFeedbackSubmitted = useCallback(() => {
  console.log('피드백이 제출되었습니다.');
  setFeedbackUpdated(true);
  
  // 탭을 리뷰 탭으로 전환
  handleTabChange(null, 1);
  
  // 타이머로 상태 초기화
  setTimeout(() => {
    setFeedbackUpdated(false);
  }, 5000);
}, []);

// 로딩 중일 때 스켈레톤 UI 표시
if (loading) {
  return (
    <Fade in={true} timeout={800}>
      <Box>
        <PlaceDetailsSkeleton />
      </Box>
    </Fade>
  );
}

// 오류 발생 시 오류 메시지 표시
if (error && !place) {
  return (
    <Container maxWidth="md">
      <Slide direction="down" in={true} timeout={500}>
        <Box sx={{ my: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton 
            onClick={handleGoBack} 
            sx={{ alignSelf: 'flex-start', mb: 2 }}
            aria-label="뒤로 가기"
          >
            <ArrowBackIcon />
          </IconButton>
          
          <Zoom in={true} timeout={800} style={{ transitionDelay: '300ms' }}>
            <Alert 
              severity="warning" 
              sx={{ width: '100%', mb: 3 }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={handleRetryLoad}
                  startIcon={<RefreshIcon />}
                >
                  다시 시도
                </Button>
              }
            >
              {error}
            </Alert>
          </Zoom>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 300 }}>
            <Button 
              variant="contained" 
              onClick={handleGoBack}
              startIcon={<ArrowBackIcon />}
            >
              뒤로 가기
            </Button>
            
            <Button 
              variant="outlined"
              onClick={setDummyData}
            >
              테스트 데이터로 보기
            </Button>
          </Box>
        </Box>
      </Slide>
    </Container>
  );
}

// 장소 데이터가 없을 때
if (!place) {
  return (
    <Container maxWidth="md">
      <Fade in={true} timeout={800}>
        <Box sx={{ my: 4 }}>
          <IconButton 
            onClick={handleGoBack} 
            sx={{ 
              mb: 2,
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'scale(1.1)',
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          
          <Slide direction="down" in={true} timeout={500}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              장소 정보를 찾을 수 없습니다.
            </Alert>
          </Slide>
          
          <Fade in={true} timeout={1000} style={{ transitionDelay: '300ms' }}>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
              요청하신 장소 ID({placeId.current})에 해당하는 정보를 찾을 수 없습니다.
            </Typography>
          </Fade>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Grow in={true} timeout={800} style={{ transitionDelay: '600ms' }}>
              <Button 
                variant="contained" 
                fullWidth 
                onClick={handleGoBack}
                sx={{ 
                  mt: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: 2
                  }
                }}
              >
                뒤로 가기
              </Button>
            </Grow>
            
            <Grow in={true} timeout={800} style={{ transitionDelay: '800ms' }}>
              <Button 
                variant="outlined"
                fullWidth
                sx={{ 
                  mt: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: 1
                  }
                }}
                onClick={setDummyData}
              >
                테스트 데이터로 보기
              </Button>
            </Grow>
          </Box>
        </Box>
      </Fade>
    </Container>
  );
}

// 로딩이 완료되고 장소 데이터가 있을 때 렌더링
return (
  <Container maxWidth="md">
    <Fade in={pageLoaded} timeout={800}>
      <Box sx={{ position: 'relative', my: 2 }}>
        {/* 뒤로 가기 버튼 */}
        <Zoom in={pageLoaded} timeout={500}>
          <IconButton 
            onClick={handleGoBack} 
            sx={{ 
              position: 'absolute', 
              top: 8, 
              left: 8, 
              bgcolor: 'rgba(255,255,255,0.7)', 
              zIndex: 9,
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.9)',
                transform: 'scale(1.1)'
              }
            }}
            aria-label="뒤로 가기"
          >
            <ArrowBackIcon />
          </IconButton>
        </Zoom>
        
        {/* 테스트 데이터 표시 (개발 환경에서만 표시) */}
        {place.isDummy && process.env.NODE_ENV === 'development' && (
          <Slide direction="down" in={pageLoaded} timeout={500}>
            <Alert severity="info" sx={{ mb: 2 }}>
              현재 테스트 데이터를 표시하고 있습니다.
            </Alert>
          </Slide>
        )}
        
        {/* 피드백 업데이트 알림 */}
        <Collapse in={feedbackUpdated}>
          <Slide direction="down" in={feedbackUpdated} timeout={500}>
            <Alert 
              severity="success" 
              sx={{ mb: 2 }}
              onClose={() => setFeedbackUpdated(false)}
            >
              피드백이 성공적으로 처리되었습니다.
            </Alert>
          </Slide>
        </Collapse>
        
        {/* 이미지 갤러리 */}
        <Fade in={galleryLoaded} timeout={800}>
          <Box>
            <ImageGallery 
              images={place.photos} 
              placeName={place.name}
              initialIndex={currentImageIndex}
              onImageChange={handleImageChange}
              height={360}
              showThumbnails={true}
            />
          </Box>
        </Fade>
        
        {/* 장소 기본 정보 */}
        <Zoom in={infoLoaded} timeout={800} style={{ transitionDelay: '200ms' }}>
          <Box>
            <PlaceInfo 
              place={place}
              mbtiType={userProfile?.mbti}
            />
          </Box>
        </Zoom>
        
        {/* 액션 버튼 */}
        <Slide direction="up" in={actionsLoaded} timeout={500}>
          <Card sx={{ 
            mb: 3, 
            borderRadius: 2, 
            boxShadow: 2,
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: 4,
              transform: 'translateY(-4px)'
            }
          }}>
            <CardContent>
              <ActionButtons 
                placeId={placeId.current}
                placeName={place.name}
                placeUrl={window.location.href}
                initialSaved={saved}
                isLoading={saveBtnLoading}
                user={currentUser}
              />
            </CardContent>
          </Card>
        </Slide>
        
        {/* 탭 메뉴 */}
        <Grow in={pageLoaded} timeout={800} style={{ transitionDelay: '600ms' }}>
          <Paper sx={{ 
            mb: 3, 
            borderRadius: 2, 
            boxShadow: 2,
            overflow: 'hidden'
          }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="fullWidth"
              indicatorColor="primary"
              textColor="primary"
              aria-label="장소 상세 정보 탭"
              sx={{
                '& .MuiTab-root': {
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  },
                  '&.Mui-selected': {
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }
                }
              }}
            >
              <Tab 
                label="추천 이유" 
                sx={{ 
                  transition: 'transform 0.3s', 
                  '&.Mui-selected': { 
                    transform: 'translateY(-2px)' 
                  } 
                }}
              />
              <Tab 
                label="리뷰" 
                sx={{ 
                  transition: 'transform 0.3s', 
                  '&.Mui-selected': { 
                    transform: 'translateY(-2px)' 
                  } 
                }}
              />
              <Tab 
                label="의견 남기기" 
                sx={{ 
                  transition: 'transform 0.3s', 
                  '&.Mui-selected': { 
                    transform: 'translateY(-2px)' 
                  } 
                }}
              />
            </Tabs>
            
            <Divider />
            
            {/* 탭 내용 */}
            <Box sx={{ p: 3 }} ref={tabContentRef}>
              <Collapse in={tabContentVisible} timeout={500}>
                {/* 추천 이유 탭 */}
                {activeTab === 0 && (
                  <Fade in={true} timeout={800}>
                    <div>
                      <RecommendationReasons 
                        place={place} 
                        userProfile={userProfile} 
                      />
                    </div>
                  </Fade>
                )}
                
                {/* 리뷰 탭 */}
                {activeTab === 1 && (
                  <Fade in={true} timeout={800}>
                    <div>
                      <ReviewList 
                        placeId={placeId.current} 
                        placeName={place.name} 
                        onReviewUpdate={() => setFeedbackUpdated(true)}
                      />
                    </div>
                  </Fade>
                )}
                
                {/* 의견 남기기 탭 */}
                {activeTab === 2 && (
                  <Fade in={true} timeout={800}>
                    <Box>
                      <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'medium' }}>
                        이 추천이 도움이 되었나요?
                      </Typography>
                      
                      <FeedbackForm 
                        placeId={placeId.current} 
                        placeName={place.name} 
                        onFeedbackSubmitted={handleFeedbackSubmitted}
                      />
                    </Box>
                  </Fade>
                )}
              </Collapse>
            </Box>
          </Paper>
        </Grow>
        
        {/* 모바일에서 하단 패딩 추가 */}
        <Box sx={{ mb: 4 }} />
      </Box>
    </Fade>
  </Container>
);
};

export default PlaceDetails;
