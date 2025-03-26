/**
 * 추천 관련 유틸리티 함수 모음
 */

// 메모이제이션을 위한 캐시 (함수 내 사용)
const memoizationCache = new Map();

// 필터 적용 함수
const applyFilters = async (places, filters, isNearby = false, weatherData = null) => {
  if (!places || !Array.isArray(places)) return [];
  if (!filters) return places;
  
  // 캐시 키 생성 (필터와 isNearby 기반)
  const weatherCondition = weatherData ? weatherData.weather.main : 'unknown';
  const cacheKey = JSON.stringify({ filters, isNearby, weatherCondition });
  
  // 이전에 계산한 결과가 있는지 확인
  const cachedResult = memoizationCache.get(cacheKey);
  if (cachedResult && cachedResult.places === places) {
    return cachedResult.result;
  }
  
  let filteredPlaces = [...places];
  
  // 카테고리 필터
  if (filters.category && filters.category !== 'all') {
    filteredPlaces = filteredPlaces.filter(place => 
      place.category === filters.category
    );
  }
  
  // 거리 필터 (내 주변 추천일 경우에만)
  if (isNearby && filters.distance && filters.distance !== 'all') {
    let maxDistance = 5000; // 기본값 5km
    
    if (filters.distance === 'near') maxDistance = 1000; // 1km
    else if (filters.distance === 'medium') maxDistance = 3000; // 3km
    else if (filters.distance === 'far') maxDistance = 5000; // 5km
    else if (!isNaN(parseFloat(filters.distance))) {
      // 거리가 숫자로 직접 지정된 경우
      maxDistance = parseFloat(filters.distance);
    }
    
    filteredPlaces = filteredPlaces.filter(place => 
      place.distance <= maxDistance
    );
  }
  
  // 평점 필터
  if (filters.rating && filters.rating !== 'all') {
    const minRating = parseFloat(filters.rating);
    filteredPlaces = filteredPlaces.filter(place => {
      const rating = place.averageRating?.overall || 0;
      return rating >= minRating;
    });
  }
  
  // MBTI 매칭 필터
  if (filters.mbtiMatch && filters.mbtiMatch !== 'all') {
    let minMatchScore = 0;
    
    if (filters.mbtiMatch === 'high') minMatchScore = 8;
    else if (filters.mbtiMatch === 'medium') minMatchScore = 5;
    
    filteredPlaces = filteredPlaces.filter(place => {
      if (!place.matchDetails || !place.matchDetails.mbtiScore) return true;
      return place.matchDetails.mbtiScore >= minMatchScore;
    });
  }
  
  // 가격대 필터
  if (filters.priceLevel && filters.priceLevel !== 'all') {
    const targetPriceLevel = parseInt(filters.priceLevel, 10);
    filteredPlaces = filteredPlaces.filter(place => {
      const priceLevel = place.priceLevel || 0;
      return priceLevel === targetPriceLevel;
    });
  }
  
  // 감정 상태 필터 (추가됨)
  if (filters.mood && filters.mood !== 'all') {
    filteredPlaces = filteredPlaces.filter(place => {
      // 감정 매칭 점수가 7 이상인 장소만 필터링
      return (place.moodMatchScore?.[filters.mood] || 0) >= 7;
    });
  }
  
  // 특별 기능 필터 (추가됨)
  if (filters.features && filters.features.length > 0) {
    filteredPlaces = filteredPlaces.filter(place => {
      // 모든 선택된 특별 기능을 포함하는 장소만 필터링
      return filters.features.every(feature => 
        place.specialFeatures?.includes(feature)
      );
    });
  }
  
  // 날씨 기반 필터링 추가
  if (filters.weather && filters.weather !== 'all' && weatherData && process.env.REACT_APP_FEATURE_WEATHER_API === 'true') {
    try {
      // 날씨 서비스 동적 로드
      const { calculateWeatherScore } = await import('../services/weatherService');
      
      filteredPlaces = filteredPlaces.filter(place => {
        const weatherScore = calculateWeatherScore(place, weatherData);
        return weatherScore >= 7; // 날씨 적합도 7 이상만 포함
      });
    } catch (error) {
      console.error('날씨 필터링 적용 실패:', error);
    }
  }
  
  // 필터 결과 캐싱
  memoizationCache.set(cacheKey, {
    places,
    result: filteredPlaces
  });
  
  // 캐시 크기 제한 (100개)
  if (memoizationCache.size > 100) {
    // 가장 오래된 항목 제거 (첫 번째 항목)
    const firstKey = memoizationCache.keys().next().value;
    memoizationCache.delete(firstKey);
  }
  
  return filteredPlaces;
};

// 정렬 적용 함수
const sortPlaces = (places, sortBy = 'recommendation') => {
  if (!places || !Array.isArray(places)) return [];
  
  // 캐시 키 생성
  const cacheKey = `sort_${sortBy}`;
  
  // 이전에 계산한 결과가 있는지 확인
  const cachedResult = memoizationCache.get(cacheKey);
  if (cachedResult && cachedResult.places === places) {
    return cachedResult.result;
  }
  
  const sortedPlaces = [...places];
  
  switch (sortBy) {
    case 'recommendation':
      // 기본 추천 점수 기준 정렬 (높은 순)
      sortedPlaces.sort((a, b) => 
        (b.matchScore || 0) - (a.matchScore || 0)
      );
      break;
    
    case 'distance':
      // 거리순 정렬 (가까운 순)
      sortedPlaces.sort((a, b) => {
        const distanceA = typeof a.distance === 'string' 
          ? parseFloat(a.distance) 
          : (a.distance || Infinity);
        const distanceB = typeof b.distance === 'string' 
          ? parseFloat(b.distance) 
          : (b.distance || Infinity);
        return distanceA - distanceB;
      });
      break;
    
    case 'rating':
      // 평점순 정렬 (높은 순)
      sortedPlaces.sort((a, b) => {
        const ratingA = a.averageRating?.overall || 0;
        const ratingB = b.averageRating?.overall || 0;
        return ratingB - ratingA;
      });
      break;
    
    case 'mbtiMatch':
      // MBTI 적합도순 정렬 (높은 순)
      sortedPlaces.sort((a, b) => {
        const mbtiScoreA = a.matchDetails?.mbtiScore || 0;
        const mbtiScoreB = b.matchDetails?.mbtiScore || 0;
        return mbtiScoreB - mbtiScoreA;
      });
      break;
    
    case 'recent':
      // 최신순 정렬 (최근 추가 순)
      sortedPlaces.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      break;
    
    case 'popular':
      // 인기순 정렬 (방문자 수 또는 리뷰 수 기준)
      sortedPlaces.sort((a, b) => {
        const popularityA = a.reviewCount || 0;
        const popularityB = b.reviewCount || 0;
        return popularityB - popularityA;
      });
      break;
      
    case 'priceAsc':
      // 가격 오름차순 (저렴한 순)
      sortedPlaces.sort((a, b) => {
        const priceA = a.priceLevel || 0;
        const priceB = b.priceLevel || 0;
        return priceA - priceB;
      });
      break;
      
    case 'priceDesc':
      // 가격 내림차순 (비싼 순)
      sortedPlaces.sort((a, b) => {
        const priceA = a.priceLevel || 0;
        const priceB = b.priceLevel || 0;
        return priceB - priceA;
      });
      break;
    
    case 'weather':
      // 날씨 적합도 정렬 (높은 순)
      sortedPlaces.sort((a, b) => {
        const weatherScoreA = a.weatherScore || 5;
        const weatherScoreB = b.weatherScore || 5;
        return weatherScoreB - weatherScoreA;
      });
      break;
    
    default:
      // 기본은 추천 점수 기준
      sortedPlaces.sort((a, b) => 
        (b.matchScore || 0) - (a.matchScore || 0)
      );
      break;
  }
  
  // 정렬 결과 캐싱
  memoizationCache.set(cacheKey, {
    places,
    result: sortedPlaces
  });
  
  return sortedPlaces;
};

// 메모이제이션 캐시 정리 함수
const clearMemoizationCache = () => {
  memoizationCache.clear();
};

// 주요 추천 이유 생성 함수 (OpenAI 통합)
async function generatePrimaryReason(matchDetails, userProfile, place) {
  const maxScoreCategory = Object.entries(matchDetails)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // AI 추천 이유 생성 기능이 활성화되어 있는지 확인
  const useAiRecommendations = process.env.REACT_APP_FEATURE_AI_RECOMMENDATIONS === 'true';
  
  if (useAiRecommendations && place) {
    try {
      let aiReason = null;
      
      // 각 카테고리별 AI 추천 이유 생성
      switch (maxScoreCategory) {
        case 'mbtiScore':
          if (userProfile.mbti) {
            // openaiService에서 MBTI 기반 추천 이유 가져오기
            const { generateMbtiBasedRecommendation } = await import('../services/openaiService');
            aiReason = await generateMbtiBasedRecommendation(userProfile.mbti, place);
          }
          break;
        case 'interestScore':
          if (userProfile.interests && userProfile.interests.length > 0) {
            // openaiService에서 관심사 기반 추천 이유 가져오기
            const { generateInterestBasedRecommendation } = await import('../services/openaiService');
            aiReason = await generateInterestBasedRecommendation(
              [...(userProfile.interests || []), ...(userProfile.customInterests || [])],
              place
            );
          }
          break;
        case 'moodScore':
          if (userProfile.currentMood && userProfile.currentMood.mood) {
            // openaiService에서 감정 기반 추천 이유 가져오기
            const { generateMoodBasedRecommendation } = await import('../services/openaiService');
            aiReason = await generateMoodBasedRecommendation(userProfile.currentMood.mood, place);
          }
          break;
      }
      
      // AI 추천 이유가 있으면 반환
      if (aiReason) {
        return aiReason;
      }
    } catch (error) {
      console.error('AI 추천 이유 생성 실패:', error);
      // 오류 발생 시 기본 추천 이유로 폴백
    }
  }
  
  // 기본 추천 이유 (AI 추천 실패 또는 비활성화 시)
  switch (maxScoreCategory) {
    case 'mbtiScore':
      return "MBTI 성향에 잘 맞는 장소";
    case 'interestScore':
      return "관심사와 관련된 장소";
    case 'talentScore':
      return "재능을 활용할 수 있는 장소";
    case 'moodScore':
      return "현재 감정 상태에 적합한 장소";
    case 'locationScore':
      return "선호하는 지역 내 위치";
    default:
      return "종합적으로 추천하는 장소";
  }
}

// 최종 추천 생성 함수 (다양성, 방문 이력, 피드백 반영)
const generateFinalRecommendations = async (
  scoredPlaces, 
  userProfile, 
  visitedPlaces = [], 
  feedbacks = [], 
  options = {}
) => {
  if (!scoredPlaces || !Array.isArray(scoredPlaces)) return [];
  
  const {
    includeVisitStatus = true,        // 방문 상태 포함 여부
    maxRecommendations = 20,          // 최대 추천 수
    categoryDiversityFactor = 0.7,    // 카테고리 다양성 비율
    regionDiversityFactor = 0.5,      // 지역 다양성 비율
    avoidRecentlyVisited = true,      // 최근 방문 장소 회피
    recentVisitWindow = 7 * 24 * 60 * 60 * 1000, // 최근 방문 기간 (7일)
    includeFeedbackScores = true,     // 피드백 점수 포함 여부
    includeAiRecommendations = false, // AI 추천 이유 포함 여부
    weatherData = null                // 날씨 데이터
  } = options;
  
  // 캐시 키 생성
  const cacheKeyParams = {
    userProfileId: userProfile?.userId || 'anonymous',
    visitedCount: visitedPlaces.length,
    feedbacksCount: feedbacks.length,
    weatherCondition: weatherData ? weatherData.weather.main : 'unknown',
    options
  };
  const cacheKey = `finalRecs_${JSON.stringify(cacheKeyParams)}`;
  
  // 이전에 계산한 결과가 있는지 확인
  const cachedResult = memoizationCache.get(cacheKey);
  if (cachedResult && cachedResult.places === scoredPlaces) {
    return cachedResult.result;
  }
  
  // 카테고리별 그룹핑
  const categoryGroups = {};
  scoredPlaces.forEach(place => {
    const category = place.category || 'other';
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(place);
  });
  
  // 지역별 그룹핑
  const regionGroups = {};
  scoredPlaces.forEach(place => {
    const region = place.subRegion || place.region || 'other';
    if (!regionGroups[region]) {
      regionGroups[region] = [];
    }
    regionGroups[region].push(place);
  });
  
  // 각 카테고리에서 최고 점수 장소 선정 (다양성 확보)
  let diverseRecommendations = [];
  
  // 1. 각 카테고리에서 상위 점수 장소 선택
  Object.entries(categoryGroups).forEach(([category, places]) => {
    const sortedPlaces = places.sort((a, b) => b.matchScore - a.matchScore);
    const topPlaces = sortedPlaces.slice(0, Math.max(1, Math.floor(maxRecommendations * categoryDiversityFactor / Object.keys(categoryGroups).length)));
    diverseRecommendations = [...diverseRecommendations, ...topPlaces];
  });
  
  // 2. 각 지역에서도 최소 1개 이상 포함 (지역 다양성 강화)
  if (regionDiversityFactor > 0) {
    Object.entries(regionGroups).forEach(([region, places]) => {
      // 이미 선택된 장소 제외한 목록에서 상위 1개 선택
      const remainingPlaces = places.filter(place => 
        !diverseRecommendations.some(selected => selected.id === place.id)
      );
      
      if (remainingPlaces.length > 0) {
        const sortedPlaces = remainingPlaces.sort((a, b) => b.matchScore - a.matchScore);
        const topPlace = sortedPlaces[0];
        diverseRecommendations.push(topPlace);
      }
    });
  }
  
  // 3. 점수 기반 추가 장소 선택
  const remainingCount = maxRecommendations - diverseRecommendations.length;
  if (remainingCount > 0) {
    // 이미 선택된 장소 제외한 나머지 중에서 가장 점수가 높은 장소들
    const remainingPlaces = scoredPlaces.filter(place => 
      !diverseRecommendations.some(selected => selected.id === place.id)
    );
    
    const additionalPlaces = remainingPlaces
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, remainingCount);
    
    diverseRecommendations = [...diverseRecommendations, ...additionalPlaces];
  }
  
  // 방문 상태 정보 추가
  if (includeVisitStatus && visitedPlaces.length > 0) {
    diverseRecommendations = diverseRecommendations.map(place => {
      const visitInfo = visitedPlaces.find(visit => visit.placeId === place.id);
      
      if (visitInfo) {
        return {
          ...place,
          visited: true,
          visitDate: visitInfo.visitDate,
          visitStatus: visitInfo.status || 'completed',
          rating: visitInfo.rating
        };
      }
      return place;
    });
    
    // 최근 방문한 장소 피하기 (옵션)
    if (avoidRecentlyVisited) {
      const now = new Date().getTime();
      diverseRecommendations = diverseRecommendations.map(place => {
        if (place.visited && place.visitDate) {
          const visitTime = new Date(place.visitDate).getTime();
          if (now - visitTime < recentVisitWindow) {
            // 최근 방문한 경우 점수 감소
            return {
              ...place,
              matchScore: place.matchScore * 0.7,
              recentlyVisited: true
            };
          }
        }
        return place;
      });
    }
  }
  
  // 피드백 기반 점수 조정
  if (includeFeedbackScores && feedbacks.length > 0) {
    diverseRecommendations = adjustForUserFeedback(diverseRecommendations, feedbacks);
  }
  
  // 날씨 데이터 기반 점수 조정
  if (weatherData && process.env.REACT_APP_FEATURE_WEATHER_API === 'true') {
    try {
      // 날씨 서비스 동적 로드
      const { calculateWeatherScore } = await import('../services/weatherService');
      
      // 날씨 점수 기반 조정
      diverseRecommendations = diverseRecommendations.map(place => {
        const weatherScore = calculateWeatherScore(place, weatherData);
        const weatherAdjustment = (weatherScore - 5) / 10; // -0.5 ~ 0.5 범위의 조정값
        
        return {
          ...place,
          matchScore: place.matchScore * (1 + weatherAdjustment),
          weatherScore,
          weatherAdjusted: true
        };
      });
    } catch (error) {
      console.error('날씨 기반 추천 조정 실패:', error);
    }
  }
  
  // AI 추천 이유 생성 (필요한 경우)
  if (includeAiRecommendations && process.env.REACT_APP_FEATURE_AI_RECOMMENDATIONS === 'true') {
    try {
      // 상위 3개 장소에 대해서만 AI 추천 이유 생성
      const topPlaces = diverseRecommendations.slice(0, 3);
      
      // 병렬로 처리하여 성능 최적화
      await Promise.all(topPlaces.map(async (place) => {
        const index = diverseRecommendations.findIndex(p => p.id === place.id);
        if (index !== -1) {
          const primaryReason = await generatePrimaryReason(
            place.matchDetails || {},
            userProfile,
            place
          );
          diverseRecommendations[index].primaryReason = primaryReason;
        }
      }));
    } catch (error) {
      console.error('AI 추천 이유 생성 실패:', error);
    }
  }
  
  // 최종 정렬 (조정된 점수 기준)
  diverseRecommendations.sort((a, b) => b.matchScore - a.matchScore);
  
  // 결과 캐싱
  memoizationCache.set(cacheKey, {
    places: scoredPlaces,
    result: diverseRecommendations
  });
  
  return diverseRecommendations;
};

// 사용자 피드백 기반 추천 점수 조정
const adjustForUserFeedback = (recommendations, feedbacks) => {
  if (!recommendations || !feedbacks || feedbacks.length === 0) {
    return recommendations;
  }
  
  // 캐시 키 생성
  const cacheKey = `feedback_adjust_${feedbacks.map(f => f.id).join('_')}`;
  
  // 이전에 계산한 결과가 있는지 확인
  const cachedResult = memoizationCache.get(cacheKey);
  if (cachedResult && cachedResult.recommendations === recommendations) {
    return cachedResult.result;
  }
  
  // 피드백 데이터를 장소별로 그룹화
  const feedbackByPlace = {};
  feedbacks.forEach(feedback => {
    if (feedback.placeId) {
      if (!feedbackByPlace[feedback.placeId]) {
        feedbackByPlace[feedback.placeId] = [];
      }
      feedbackByPlace[feedback.placeId].push(feedback);
    }
  });
  
  // 카테고리별 평균 평가 점수 분석
  const categoryScores = {};
  const moodScores = {};
  
  // 장소 태그에 따른 점수 분석
  feedbacks.forEach(feedback => {
    if (feedback.placeId && feedback.relevanceRating) {
      // 해당 장소 찾기
      const place = recommendations.find(p => p.id === feedback.placeId);
      if (place) {
        const category = place.category || 'other';
        
        // 카테고리별 점수 누적
        if (!categoryScores[category]) {
          categoryScores[category] = {
            total: 0,
            count: 0
          };
        }
        categoryScores[category].total += feedback.relevanceRating;
        categoryScores[category].count++;
        
        // 태그 기반 감정 상태 점수 누적
        if (feedback.tags && place.moodMatchScore) {
          Object.keys(place.moodMatchScore).forEach(mood => {
            if (!moodScores[mood]) {
              moodScores[mood] = {
                total: 0,
                count: 0
              };
            }
            moodScores[mood].total += feedback.relevanceRating;
            moodScores[mood].count++;
          });
        }
      }
    }
  });
  
  // 카테고리별 평균 점수 계산
  const categoryAvgScores = {};
  Object.entries(categoryScores).forEach(([category, data]) => {
    if (data.count > 0) {
      categoryAvgScores[category] = data.total / data.count;
    }
  });
  
  // 감정 상태별 평균 점수 계산
  const moodAvgScores = {};
  Object.entries(moodScores).forEach(([mood, data]) => {
    if (data.count > 0) {
      moodAvgScores[mood] = data.total / data.count;
    }
  });
  
  // 각 추천 장소의 점수 조정
  const adjustedRecommendations = recommendations.map(place => {
    let adjustmentFactor = 1.0; // 기본값 (조정 없음)
    let adjustmentSource = '';
    
    // 직접적인 장소 피드백이 있는 경우
    const placeFeedbacks = feedbackByPlace[place.id];
    if (placeFeedbacks && placeFeedbacks.length > 0) {
      // 가장 최근 피드백 사용
      const latestFeedback = placeFeedbacks.sort((a, b) => 
        new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      )[0];
      
      // 적합도 평가에 따른 조정 (1-5 -> 0.8-1.2)
      if (latestFeedback.relevanceRating) {
        adjustmentFactor = 0.8 + (latestFeedback.relevanceRating - 1) * 0.1;
        adjustmentSource = 'direct_feedback';
      }
      
      // 태그 기반 조정 (예: "MBTI 성향에 맞음" 태그가 있으면 MBTI 가중치 증가)
      if (latestFeedback.tags) {
        if (latestFeedback.tags.includes('MBTI 성향에 맞음')) {
          adjustmentFactor *= 1.1; // 10% 증가
        }
        if (latestFeedback.tags.includes('추천이 맞지 않음')) {
          adjustmentFactor *= 0.8; // 20% 감소
        }
      }
    } else {
      // 직접적인 피드백이 없는 경우, 카테고리 및 감정 기반 간접 조정
      const category = place.category || 'other';
      
      // 카테고리 기반 조정
      if (categoryAvgScores[category]) {
        // 평균 3점을 기준으로 조정 (3점 -> 1.0, 5점 -> 1.2, 1점 -> 0.8)
        const categoryAdjustment = 0.8 + (categoryAvgScores[category] - 1) * 0.1;
        adjustmentFactor *= categoryAdjustment;
        adjustmentSource = 'category_feedback';
      }
      
      // 감정 상태 기반 조정 (현재 감정과 일치하는 경우)
      if (place.moodMatchScore && Object.keys(moodAvgScores).length > 0) {
        let highestMoodScore = 0;
        let highestMood = '';

      // 가장 높은 감정 점수 찾기
      Object.entries(place.moodMatchScore).forEach(([mood, score]) => {
        if (score > highestMoodScore) {
          highestMoodScore = score;
          highestMood = mood;
        }
      });
      
      // 해당 감정에 대한 피드백 점수가 있으면 조정
      if (highestMood && moodAvgScores[highestMood]) {
        // 평균 3점을 기준으로 조정 (3점 -> 1.0, 5점 -> 1.1, 1점 -> 0.9)
        // 감정은 카테고리보다 영향력이 적게 조정
        const moodAdjustment = 0.9 + (moodAvgScores[highestMood] - 1) * 0.05;
        adjustmentFactor *= moodAdjustment;
        adjustmentSource = adjustmentSource 
          ? `${adjustmentSource}_and_mood` 
          : 'mood_feedback';
      }
    }
  }
  
  return {
    ...place,
    matchScore: place.matchScore * adjustmentFactor,
    feedbackAdjusted: true,
    feedbackAdjustmentFactor: adjustmentFactor,
    feedbackAdjustmentSource: adjustmentSource
  };
});

// 결과 캐싱
memoizationCache.set(cacheKey, {
  recommendations,
  result: adjustedRecommendations
});

return adjustedRecommendations;
};

// 추천 관련 통계 계산
const calculateRecommendationStats = (places) => {
if (!places || !Array.isArray(places)) return {};

// 캐시 키 생성
const cacheKey = `stats_${places.length}`;

// 이전에 계산한 결과가 있는지 확인
const cachedResult = memoizationCache.get(cacheKey);
if (cachedResult && cachedResult.places === places) {
  return cachedResult.result;
}

// 카테고리 통계
const categoryCount = places.reduce((acc, place) => {
  const category = place.category || 'other';
  acc[category] = (acc[category] || 0) + 1;
  return acc;
}, {});

// 지역 통계
const regionCount = places.reduce((acc, place) => {
  const region = place.subRegion || place.region || 'other';
  acc[region] = (acc[region] || 0) + 1;
  return acc;
}, {});

// 평점 분포
const ratingDistribution = places.reduce((acc, place) => {
  const rating = Math.floor(place.averageRating?.overall || 0);
  if (rating > 0) {
    acc[rating] = (acc[rating] || 0) + 1;
  }
  return acc;
}, {});

// MBTI 매칭 점수 분포
const mbtiScoreDistribution = places.reduce((acc, place) => {
  const mbtiScore = Math.floor(place.matchDetails?.mbtiScore || 0);
  if (mbtiScore > 0) {
    acc[mbtiScore] = (acc[mbtiScore] || 0) + 1;
  }
  return acc;
}, {});

// 거리 분포 (내 주변 장소만)
const distanceDistribution = places.reduce((acc, place) => {
  if (place.distance) {
    if (place.distance <= 1000) acc['1km'] = (acc['1km'] || 0) + 1;
    else if (place.distance <= 3000) acc['3km'] = (acc['3km'] || 0) + 1;
    else if (place.distance <= 5000) acc['5km'] = (acc['5km'] || 0) + 1;
    else acc['5km+'] = (acc['5km+'] || 0) + 1;
  }
  return acc;
}, {});

// 가격 수준 분포
const priceLevelDistribution = places.reduce((acc, place) => {
  const priceLevel = place.priceLevel || 0;
  acc[priceLevel] = (acc[priceLevel] || 0) + 1;
  return acc;
}, {});

// 감정 매칭 점수 상위 장소
const moodTopMatches = {};
const moods = ['기쁨', '스트레스', '피곤함', '설렘', '평온함'];

moods.forEach(mood => {
  const topMatches = [...places]
    .sort((a, b) => (b.moodMatchScore?.[mood] || 0) - (a.moodMatchScore?.[mood] || 0))
    .slice(0, 3)
    .map(place => ({
      id: place.id,
      name: place.name,
      score: place.moodMatchScore?.[mood] || 0
    }));
  
  if (topMatches.length > 0) {
    moodTopMatches[mood] = topMatches;
  }
});

// 날씨 적합도 분포 (추가됨)
const weatherScoreDistribution = places.reduce((acc, place) => {
  if (place.weatherScore) {
    const weatherScoreRange = Math.floor(place.weatherScore);
    acc[weatherScoreRange] = (acc[weatherScoreRange] || 0) + 1;
  }
  return acc;
}, {});

const stats = {
  totalCount: places.length,
  categoryCount,
  regionCount,
  ratingDistribution,
  mbtiScoreDistribution,
  distanceDistribution,
  priceLevelDistribution,
  moodTopMatches,
  weatherScoreDistribution // 추가됨
};

// 결과 캐싱
memoizationCache.set(cacheKey, {
  places,
  result: stats
});

return stats;
};

/**
 * 장소 목록에서 피드백 캡처 및 학습 데이터 생성 (개선됨)
 * @param {Array} placesWithFeedback - 사용자 피드백이 있는 장소 목록
 * @param {string} mbtiType - 사용자 MBTI 유형
 * @returns {Object} - 학습 데이터 및 통계
 */
const captureFeedbackPatterns = (placesWithFeedback, mbtiType) => {
  if (!placesWithFeedback || !Array.isArray(placesWithFeedback) || placesWithFeedback.length === 0) {
    return { patterns: {}, stats: {} };
  }
  
  // 피드백 패턴 추출
  const patterns = {
    categoryPreferences: {},   // 카테고리별 선호도
    mbtiScoreThreshold: 0,     // MBTI 매칭 임계값
    moodPreferences: {},       // 감정 상태별 선호도
    interestWeights: {},       // 관심사 가중치
    talentWeights: {},         // 재능 가중치
    pricePreferences: {},      // 가격 선호도
    regionPreferences: {},     // 지역 선호도
    featurePreferences: {},    // 특별 기능 선호도
    timeOfDayPreferences: {},  // 시간대 선호도 (새로 추가)
    seasonalPreferences: {},   // 계절별 선호도 (새로 추가)
    contextualFactors: {},     // 컨텍스트 요소 선호도 (새로 추가)
    weatherPreferences: {}     // 날씨 조건 선호도 (새로 추가)
  };
  
  // 카테고리별 평균 평가 계산
  const categoryFeedbacks = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.category) {
      if (!categoryFeedbacks[place.category]) {
        categoryFeedbacks[place.category] = {
          total: 0,
          count: 0
        };
      }
      categoryFeedbacks[place.category].total += place.feedback.relevanceRating || 3;
      categoryFeedbacks[place.category].count++;
    }
  });
  
  // 카테고리 선호도 계산
  Object.entries(categoryFeedbacks).forEach(([category, data]) => {
    if (data.count > 0) {
      patterns.categoryPreferences[category] = data.total / data.count;
    }
  });
  
  // MBTI 점수 선호도 분석
  const mbtiScores = placesWithFeedback
    .filter(place => place.feedback && place.feedback.relevanceRating >= 4)
    .map(place => place.matchDetails?.mbtiScore || 0);
  
  if (mbtiScores.length > 0) {
    // 높은 평가를 받은 장소들의 MBTI 점수 평균
    patterns.mbtiScoreThreshold = mbtiScores.reduce((sum, score) => sum + score, 0) / mbtiScores.length;
  }
  
  // 감정 상태별 선호도 분석
  const moodPreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.moodMatchScore) {
      Object.entries(place.moodMatchScore).forEach(([mood, score]) => {
        if (!moodPreferences[mood]) {
          moodPreferences[mood] = {
            total: 0,
            count: 0
          };
        }
        moodPreferences[mood].total += place.feedback.relevanceRating || 3;
        moodPreferences[mood].count++;
      });
    }
  });
  
  // 감정 선호도 계산
  Object.entries(moodPreferences).forEach(([mood, data]) => {
    if (data.count > 0) {
      patterns.moodPreferences[mood] = data.total / data.count;
    }
  });
  
  // 가격 선호도 분석
  const pricePreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.priceLevel !== undefined) {
      if (!pricePreferences[place.priceLevel]) {
        pricePreferences[place.priceLevel] = {
          total: 0,
          count: 0
        };
      }
      pricePreferences[place.priceLevel].total += place.feedback.relevanceRating || 3;
      pricePreferences[place.priceLevel].count++;
    }
  });
  
  // 가격 선호도 계산
  Object.entries(pricePreferences).forEach(([price, data]) => {
    if (data.count > 0) {
      patterns.pricePreferences[price] = data.total / data.count;
    }
  });
  
  // 지역 선호도 분석 (새로 추가)
  const regionPreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.region) {
      const region = place.region;
      if (!regionPreferences[region]) {
        regionPreferences[region] = {
          total: 0,
          count: 0
        };
      }
      regionPreferences[region].total += place.feedback.relevanceRating || 3;
      regionPreferences[region].count++;
    }
  });
  
  // 지역 선호도 계산
  Object.entries(regionPreferences).forEach(([region, data]) => {
    if (data.count > 0) {
      patterns.regionPreferences[region] = data.total / data.count;
    }
  });
  
  // 시간대 선호도 분석 (새로 추가)
  const timeOfDayPreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.feedback.visitTime) {
      const hour = new Date(place.feedback.visitTime).getHours();
      let timeOfDay = '';
      
      if (hour >= 6 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
      else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
      else timeOfDay = 'night';
      
      if (!timeOfDayPreferences[timeOfDay]) {
        timeOfDayPreferences[timeOfDay] = {
          total: 0,
          count: 0
        };
      }
      timeOfDayPreferences[timeOfDay].total += place.feedback.relevanceRating || 3;
      timeOfDayPreferences[timeOfDay].count++;
    }
  });
  
  // 시간대 선호도 계산
  Object.entries(timeOfDayPreferences).forEach(([timeOfDay, data]) => {
    if (data.count > 0) {
      patterns.timeOfDayPreferences[timeOfDay] = data.total / data.count;
    }
  });
  
  // 특별 기능 선호도 분석 (새로 추가)
  const featurePreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.specialFeatures && Array.isArray(place.specialFeatures)) {
      place.specialFeatures.forEach(feature => {
        if (!featurePreferences[feature]) {
          featurePreferences[feature] = {
            total: 0,
            count: 0
          };
        }
        featurePreferences[feature].total += place.feedback.relevanceRating || 3;
        featurePreferences[feature].count++;
      });
    }
  });
  
  // 특별 기능 선호도 계산
  Object.entries(featurePreferences).forEach(([feature, data]) => {
    if (data.count > 0) {
      patterns.featurePreferences[feature] = data.total / data.count;
    }
  });
  
  // 계절별 선호도 분석 (새로 추가)
  const seasonalPreferences = {
    spring: { total: 0, count: 0 },
    summer: { total: 0, count: 0 },
    autumn: { total: 0, count: 0 },
    winter: { total: 0, count: 0 }
  };
  
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.feedback.visitTime) {
      const month = new Date(place.feedback.visitTime).getMonth(); // 0-11
      let season = '';
      
      if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 7) season = 'summer'; 
      else if (month >= 8 && month <= 10) season = 'autumn';
      else season = 'winter';
      
      seasonalPreferences[season].total += place.feedback.relevanceRating || 3;
      seasonalPreferences[season].count++;
    }
  });
  
  // 계절별 선호도 계산
  Object.entries(seasonalPreferences).forEach(([season, data]) => {
    if (data.count > 0) {
      patterns.seasonalPreferences[season] = data.total / data.count;
    }
  });
  
  // 날씨 선호도 분석 (새로 추가)
  const weatherPreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.feedback.weatherCondition) {
      const weather = place.feedback.weatherCondition;
      
      if (!weatherPreferences[weather]) {
        weatherPreferences[weather] = {
          total: 0,
          count: 0
        };
      }
      
      weatherPreferences[weather].total += place.feedback.relevanceRating || 3;
      weatherPreferences[weather].count++;
    }
  });
  
  // 날씨 선호도 계산
  Object.entries(weatherPreferences).forEach(([weather, data]) => {
    if (data.count > 0) {
      patterns.weatherPreferences[weather] = data.total / data.count;
    }
  });
  
  // 컨텍스트 요소 선호도 분석 (날씨, 혼잡도 등) (새로 추가)
  const contextualPreferences = {};
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.feedback.contextFactors) {
      Object.entries(place.feedback.contextFactors).forEach(([factor, value]) => {
        if (!contextualPreferences[factor]) {
          contextualPreferences[factor] = {};
        }
        
        if (!contextualPreferences[factor][value]) {
          contextualPreferences[factor][value] = {
            total: 0,
            count: 0
          };
        }
        
        contextualPreferences[factor][value].total += place.feedback.relevanceRating || 3;
        contextualPreferences[factor][value].count++;
      });
    }
  });
  
  // 컨텍스트 요소 선호도 계산
  Object.entries(contextualPreferences).forEach(([factor, values]) => {
    patterns.contextualFactors[factor] = {};
    
    Object.entries(values).forEach(([value, data]) => {
      if (data.count > 0) {
        patterns.contextualFactors[factor][value] = data.total / data.count;
      }
    });
  });
  
  // 통계 정보 계산
  const stats = {
    totalFeedbacks: placesWithFeedback.length,
    averageRating: placesWithFeedback.reduce((sum, place) => 
      sum + (place.feedback?.relevanceRating || 0), 0) / placesWithFeedback.length,
    categoryDistribution: Object.keys(patterns.categoryPreferences).reduce((obj, category) => {
      obj[category] = categoryFeedbacks[category].count;
      return obj;
    }, {}),
    mbtiType,
    recommendationQuality: placesWithFeedback.filter(
      place => place.feedback && place.feedback.relevanceRating >= 4
    ).length / placesWithFeedback.length,
    feedbackRecency: calculateFeedbackRecency(placesWithFeedback) // 새로 추가
  };
  
  return {
    patterns,
    stats
  };
};

/**
 * 피드백 최신성 계산 함수 (새로 추가)
 * @param {Array} placesWithFeedback - 피드백이 있는 장소 목록
 * @returns {Object} - 피드백 최신성 정보
 */
const calculateFeedbackRecency = (placesWithFeedback) => {
  if (!placesWithFeedback || placesWithFeedback.length === 0) {
    return { recent: 0, moderate: 0, old: 0 };
  }
  
  const now = new Date();
  const oneWeekAgo = new Date(now - (7 * 24 * 60 * 60 * 1000));
  const oneMonthAgo = new Date(now - (30 * 24 * 60 * 60 * 1000));
  
  let recent = 0;  // 1주일 이내
  let moderate = 0; // 1주일~1개월
  let old = 0;     // 1개월 이상
  
  placesWithFeedback.forEach(place => {
    if (place.feedback && place.feedback.timestamp) {
      const feedbackDate = new Date(place.feedback.timestamp);
      
      if (feedbackDate >= oneWeekAgo) {
        recent++;
      } else if (feedbackDate >= oneMonthAgo) {
        moderate++;
      } else {
        old++;
      }
    } else {
      old++; // 날짜 정보가 없으면 오래된 것으로 간주
    }
  });
  
  return {
    recent,
    moderate,
    old,
    recentRatio: recent / placesWithFeedback.length,
    moderateRatio: moderate / placesWithFeedback.length,
    oldRatio: old / placesWithFeedback.length
  };
};

/**
 * 다수 사용자의 유사 패턴 분석 및 추천 파라미터 조정 (개선됨)
 * @param {Object} userPatterns - 현재 사용자의 피드백 패턴
 * @param {Array} similarUsersPatterns - 유사 사용자들의 피드백 패턴
 * @param {Object} options - 추가 옵션 (가중치 설정 등)
 * @returns {Object} - 조정된 파라미터 (가중치 등)
 */
const adjustRecommendationParameters = (userPatterns, similarUsersPatterns = [], options = {}) => {
  // 기본 파라미터
  const defaultParams = {
    weights: {
      mbti: 0.35,
      interests: 0.25,
      talents: 0.15,
      mood: 0.15,
      location: 0.10
    },
    thresholds: {
      mbtiScore: 5,
      interestMatch: 0.3,
      talentMatch: 0.3,
      distanceNear: 1000,
      distanceMedium: 3000,
      distanceFar: 5000
    },
    diversityFactor: 0.3,
    personalityFactor: 1.0,
    // 새로운 파라미터 (시간대 및 계절 관련)
    timeFactors: {
      morning: 1.0,
      afternoon: 1.0,
      evening: 1.0,
      night: 1.0
    },
    seasonFactors: {
      spring: 1.0,
      summer: 1.0,
      autumn: 1.0,
      winter: 1.0
    },
    contextFactors: {
      weather: 1.0,
      crowdedness: 1.0,
      dayOfWeek: 1.0
    },
    weatherFactors: {  // 추가된 날씨 요소
      clear: 1.0,
      clouds: 1.0,
      rain: 1.0,
      snow: 1.0,
      extreme: 0.5
    }
  };
  
  // 사용자 피드백이 없으면 기본값 반환
  if (!userPatterns || Object.keys(userPatterns).length === 0) {
    return defaultParams;
  }
  
  // 파라미터 조정
  const adjustedParams = { ...defaultParams };
  
  // 1. MBTI 가중치 조정 (MBTI 점수 임계값에 따라)
  if (userPatterns.mbtiScoreThreshold > 0) {
    // MBTI 점수 임계값이 7 이상이면 MBTI 가중치 증가
    if (userPatterns.mbtiScoreThreshold >= 7) {
      adjustedParams.weights.mbti = Math.min(0.45, defaultParams.weights.mbti * 1.3);
      // 다른 가중치는 비례적으로 감소
      const remainingWeight = 1 - adjustedParams.weights.mbti;
      const weightRatio = remainingWeight / (1 - defaultParams.weights.mbti);
      
      adjustedParams.weights.interests = defaultParams.weights.interests * weightRatio;
      adjustedParams.weights.talents = defaultParams.weights.talents * weightRatio;
      adjustedParams.weights.mood = defaultParams.weights.mood * weightRatio;
      adjustedParams.weights.location = defaultParams.weights.location * weightRatio;
    }
    // MBTI 점수 임계값이 3 이하면 MBTI 가중치 감소
    else if (userPatterns.mbtiScoreThreshold <= 3) {
      adjustedParams.weights.mbti = Math.max(0.25, defaultParams.weights.mbti * 0.7);
      // 다른 가중치는 비례적으로 증가
      const remainingWeight = 1 - adjustedParams.weights.mbti;
      const weightRatio = remainingWeight / (1 - defaultParams.weights.mbti);
      
      adjustedParams.weights.interests = defaultParams.weights.interests * weightRatio;
      adjustedParams.weights.talents = defaultParams.weights.talents * weightRatio;
      adjustedParams.weights.mood = defaultParams.weights.mood * weightRatio;
      adjustedParams.weights.location = defaultParams.weights.location * weightRatio;
    }
  }
  
  // 2. 카테고리 선호도 기반 가중치 조정 (개선됨)
  if (userPatterns.categoryPreferences && Object.keys(userPatterns.categoryPreferences).length > 0) {
    const categoryRatings = Object.values(userPatterns.categoryPreferences);
    const avgCategoryRating = categoryRatings.reduce((sum, rating) => sum + rating, 0) / categoryRatings.length;
    
    // 카테고리 평균 평점이 높으면 관심사 가중치 강화
    if (avgCategoryRating > 4) {
      adjustedParams.weights.interests = Math.min(0.35, adjustedParams.weights.interests * 1.2);
      
      // 균형 조정
      const totalWeight = Object.values(adjustedParams.weights).reduce((sum, weight) => sum + weight, 0);
      const excessWeight = totalWeight - 1;
      
      if (excessWeight > 0.01) {
        // 다른 가중치에서 비례적으로 차감
        const reduceRatio = excessWeight / (totalWeight - adjustedParams.weights.interests);
        
        Object.keys(adjustedParams.weights).forEach(key => {
          if (key !== 'interests') {
            adjustedParams.weights[key] *= (1 - reduceRatio);
          }
        });
      }
    }
  }
  
  // 3. 감정 선호도 기반 가중치 조정 (새로 추가)
  if (userPatterns.moodPreferences && Object.keys(userPatterns.moodPreferences).length > 0) {
    const moodRatings = Object.values(userPatterns.moodPreferences);
    const avgMoodRating = moodRatings.reduce((sum, rating) => sum + rating, 0) / moodRatings.length;
    
    // 감정 평균 평점이 높으면 감정 가중치 강화
    if (avgMoodRating > 4) {
      adjustedParams.weights.mood = Math.min(0.25, adjustedParams.weights.mood * 1.2);
      
      // 균형 조정
      const totalWeight = Object.values(adjustedParams.weights).reduce((sum, weight) => sum + weight, 0);
      const excessWeight = totalWeight - 1;
      
      if (excessWeight > 0.01) {
        // 다른 가중치에서 비례적으로 차감
        const reduceRatio = excessWeight / (totalWeight - adjustedParams.weights.mood);
        
        Object.keys(adjustedParams.weights).forEach(key => {
          if (key !== 'mood') {
            adjustedParams.weights[key] *= (1 - reduceRatio);
          }
        });
      }
    }
  }
  
  // 4. 날씨 선호도 기반 조정 (새로 추가)
  if (userPatterns.weatherPreferences && Object.keys(userPatterns.weatherPreferences).length > 0) {
    Object.entries(userPatterns.weatherPreferences).forEach(([weather, rating]) => {
      if (weather in adjustedParams.weatherFactors) {
        if (rating > 4) {
          // 선호하는 날씨 조건 강화
          adjustedParams.weatherFactors[weather] = 1.2;
        } else if (rating < 3) {
          // 선호하지 않는 날씨 조건 약화
          adjustedParams.weatherFactors[weather] = 0.8;
        }
      }
    });
  }
  
  // 5. 시간대 선호도 기반 조정 (새로 추가)
  if (userPatterns.timeOfDayPreferences && Object.keys(userPatterns.timeOfDayPreferences).length > 0) {
    Object.entries(userPatterns.timeOfDayPreferences).forEach(([timeOfDay, rating]) => {
      if (rating > 3.5) {
        // 높은 평점의 시간대는 가중치 증가
        adjustedParams.timeFactors[timeOfDay] = 1.2;
      } else if (rating < 2.5) {
        // 낮은 평점의 시간대는 가중치 감소
        adjustedParams.timeFactors[timeOfDay] = 0.8;
      }
    });
  }
  
  // 6. 계절 선호도 기반 조정 (새로 추가)
  if (userPatterns.seasonalPreferences && Object.keys(userPatterns.seasonalPreferences).length > 0) {
    Object.entries(userPatterns.seasonalPreferences).forEach(([season, rating]) => {
      if (rating > 3.5) {
        // 높은 평점의 계절은 가중치 증가
        adjustedParams.seasonFactors[season] = 1.2;
      } else if (rating < 2.5) {
        // 낮은 평점의 계절은 가중치 감소
        adjustedParams.seasonFactors[season] = 0.8;
      }
    });
  }
  
  // 7. 유사 사용자 데이터 통합 (가중 평균) (개선됨)
  if (similarUsersPatterns && similarUsersPatterns.length > 0) {
    // 유사 사용자 패턴의 가중 평균 계산
    const similarUsersAvg = {
      weights: { mbti: 0, interests: 0, talents: 0, mood: 0, location: 0 },
      thresholds: { mbtiScore: 0, interestMatch: 0, talentMatch: 0 },
      diversityFactor: 0,
      personalityFactor: 0,
      timeFactors: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      seasonFactors: { spring: 0, summer: 0, autumn: 0, winter: 0 },
      contextFactors: { weather: 0, crowdedness: 0, dayOfWeek: 0 },
      weatherFactors: { clear: 0, clouds: 0, rain: 0, snow: 0, extreme: 0 }
    };
    
    // 유사도 가중치 합계
    const similarityWeightSum = similarUsersPatterns.reduce(
      (sum, pattern) => sum + (pattern.similarity || 1), 0
    );
    
    // 각 파라미터의 가중 평균 계산
    similarUsersPatterns.forEach(pattern => {
      const weight = (pattern.similarity || 1) / similarityWeightSum;
      
      // 가중치 누적
      Object.keys(similarUsersAvg.weights).forEach(key => {
        similarUsersAvg.weights[key] += (pattern.params?.weights?.[key] || defaultParams.weights[key]) * weight;
      });
      
      // 임계값 누적
      Object.keys(similarUsersAvg.thresholds).forEach(key => {
        similarUsersAvg.thresholds[key] += (pattern.params?.thresholds?.[key] || defaultParams.thresholds[key]) * weight;
      });
      
      // 시간 요소 누적
      Object.keys(similarUsersAvg.timeFactors).forEach(key => {
        similarUsersAvg.timeFactors[key] += (pattern.params?.timeFactors?.[key] || defaultParams.timeFactors[key]) * weight;
      });
      
      // 계절 요소 누적
      Object.keys(similarUsersAvg.seasonFactors).forEach(key => {
        similarUsersAvg.seasonFactors[key] += (pattern.params?.seasonFactors?.[key] || defaultParams.seasonFactors[key]) * weight;
      });
      
      // 컨텍스트 요소 누적
      Object.keys(similarUsersAvg.contextFactors).forEach(key => {
        similarUsersAvg.contextFactors[key] += (pattern.params?.contextFactors?.[key] || defaultParams.contextFactors[key]) * weight;
      });
      
      // 날씨 요소 누적
      Object.keys(similarUsersAvg.weatherFactors).forEach(key => {
        similarUsersAvg.weatherFactors[key] += (pattern.params?.weatherFactors?.[key] || defaultParams.weatherFactors[key]) * weight;
      });
      
      // 기타 파라미터 누적
      similarUsersAvg.diversityFactor += (pattern.params?.diversityFactor || defaultParams.diversityFactor) * weight;
      similarUsersAvg.personalityFactor += (pattern.params?.personalityFactor || defaultParams.personalityFactor) * weight;
    });
    
    // 사용자 파라미터와 유사 사용자 파라미터 통합 (70:30 비율)
    const userWeight = options.userWeight || 0.7;
    const similarWeight = options.similarWeight || 0.3;
    
    // 가중치 통합
    Object.keys(adjustedParams.weights).forEach(key => {
      adjustedParams.weights[key] = 
        adjustedParams.weights[key] * userWeight + 
        similarUsersAvg.weights[key] * similarWeight;
    });
    
    // 임계값 통합
    Object.keys(adjustedParams.thresholds).forEach(key => {
      if (key !== 'distanceNear' && key !== 'distanceMedium' && key !== 'distanceFar') {
        adjustedParams.thresholds[key] = 
          adjustedParams.thresholds[key] * userWeight + 
          similarUsersAvg.thresholds[key] * similarWeight;
      }
    });
    
    // 시간 요소 통합
    Object.keys(adjustedParams.timeFactors).forEach(key => {
      adjustedParams.timeFactors[key] = 
        adjustedParams.timeFactors[key] * userWeight + 
        similarUsersAvg.timeFactors[key] * similarWeight;
    });
    
    // 계절 요소 통합
    Object.keys(adjustedParams.seasonFactors).forEach(key => {
      adjustedParams.seasonFactors[key] = 
        adjustedParams.seasonFactors[key] * userWeight + 
        similarUsersAvg.seasonFactors[key] * similarWeight;
    });
    
    // 컨텍스트 요소 통합
    Object.keys(adjustedParams.contextFactors).forEach(key => {
      adjustedParams.contextFactors[key] = 
        adjustedParams.contextFactors[key] * userWeight + 
        similarUsersAvg.contextFactors[key] * similarWeight;
    });
    
    // 날씨 요소 통합
    Object.keys(adjustedParams.weatherFactors).forEach(key => {
      adjustedParams.weatherFactors[key] = 
        adjustedParams.weatherFactors[key] * userWeight + 
        similarUsersAvg.weatherFactors[key] * similarWeight;
    });
    
    // 기타 파라미터 통합
    adjustedParams.diversityFactor = 
      adjustedParams.diversityFactor * userWeight + 
      similarUsersAvg.diversityFactor * similarWeight;
    
    adjustedParams.personalityFactor = 
      adjustedParams.personalityFactor * userWeight + 
      similarUsersAvg.personalityFactor * similarWeight;
  }
  
  // 8. 계절 및 시간대 가중치 최적화 (특정 시점에 해당하는 경우)
  if (options.currentDate) {
    const now = new Date(options.currentDate);
    
    // 현재 시간대에 대한 가중치 강화
    const currentHour = now.getHours();
    let currentTimeOfDay = '';
    
    if (currentHour >= 5 && currentHour < 12) currentTimeOfDay = 'morning';
    else if (currentHour >= 12 && currentHour < 17) currentTimeOfDay = 'afternoon';
    else if (currentHour >= 17 && currentHour < 22) currentTimeOfDay = 'evening';
    else currentTimeOfDay = 'night';
    
    // 현재 시간대 가중치는 이미 높은 경우에만 추가 강화
    if (adjustedParams.timeFactors[currentTimeOfDay] >= 1.0) {
      adjustedParams.timeFactors[currentTimeOfDay] += 0.1;
    }
    
    // 현재 계절에 대한 가중치 강화
    const currentMonth = now.getMonth();
    let currentSeason = '';
    
    if (currentMonth >= 2 && currentMonth <= 4) currentSeason = 'spring';
    else if (currentMonth >= 5 && currentMonth <= 7) currentSeason = 'summer';
    else if (currentMonth >= 8 && currentMonth <= 10) currentSeason = 'autumn';
    else currentSeason = 'winter';
    
    // 현재 계절 가중치는 이미 높은 경우에만 추가 강화
    if (adjustedParams.seasonFactors[currentSeason] >= 1.0) {
      adjustedParams.seasonFactors[currentSeason] += 0.1;
    }
    
    // 현재 날씨에 대한 가중치 강화 (데이터가 있는 경우)
    if (options.currentWeather && options.currentWeather.main) {
      const weatherType = options.currentWeather.main.toLowerCase();
      
      // 날씨 유형 매핑
      let weatherFactor = null;
      if (weatherType === 'clear') weatherFactor = 'clear';
      else if (weatherType === 'clouds') weatherFactor = 'clouds';
      else if (weatherType === 'rain' || weatherType === 'drizzle') weatherFactor = 'rain';
      else if (weatherType === 'snow') weatherFactor = 'snow';
      else weatherFactor = 'extreme';
      
      // 현재 날씨 조건 가중치 강화
      if (weatherFactor && adjustedParams.weatherFactors[weatherFactor]) {
        adjustedParams.weatherFactors[weatherFactor] += 0.1;
      }
    }
  }
  
  // 9. 가중치 합이 1이 되도록 정규화
  const weightSum = Object.values(adjustedParams.weights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(weightSum - 1) > 0.01) {
    Object.keys(adjustedParams.weights).forEach(key => {
      adjustedParams.weights[key] = adjustedParams.weights[key] / weightSum;
    });
  }
  
  // 10. 전체 파라미터 최종 조정 (상호 관계 고려)
  // 다양성 요소 조정 (특정 카테고리/지역 편중 완화)
  if (userPatterns.categoryPreferences) {
    const categoryVariance = calculateVariance(Object.values(userPatterns.categoryPreferences));
    
    // 카테고리 선호도 분산이 작으면 다양성 요소 강화
    if (categoryVariance < 0.5) {
      adjustedParams.diversityFactor = Math.min(0.5, adjustedParams.diversityFactor * 1.2);
    }
  }
  
  // 성격 요소 조정 (MBTI 기반)
  if (options.mbtiType) {
    const mbtiTraits = analyzeMbtiTraits(options.mbtiType);
    
    // 외향형에 대한 파라미터 조정
    if (mbtiTraits.extrovert) {
      adjustedParams.personalityFactor = Math.min(1.2, adjustedParams.personalityFactor * 1.1);
    }
    
    // 직관형에 대한 파라미터 조정
    if (mbtiTraits.intuitive) {
      adjustedParams.diversityFactor = Math.min(0.5, adjustedParams.diversityFactor * 1.1);
    }
  }
  
  return adjustedParams;
};

/**
 * 분산 계산 유틸리티 함수 (새로 추가)
 * @param {Array} values - 값 배열
 * @returns {number} - 분산 값
 */
const calculateVariance = (values) => {
  if (!values || values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => {
    const diff = val - mean;
    return diff * diff;
  });
  
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * MBTI 특성 분석 유틸리티 함수 (새로 추가)
 * @param {string} mbtiType - MBTI 유형
 * @returns {Object} - MBTI 특성 정보
 */
const analyzeMbtiTraits = (mbtiType) => {
  if (!mbtiType || typeof mbtiType !== 'string' || mbtiType.length !== 4) {
    return {
      extrovert: false,
      intuitive: false,
      thinking: false,
      judging: false
    };
  }
  
  return {
    extrovert: mbtiType.charAt(0) === 'E',
    intuitive: mbtiType.charAt(1) === 'N',
    thinking: mbtiType.charAt(2) === 'T',
    judging: mbtiType.charAt(3) === 'J'
  };
};

// 객체로 내보내기
const recommendationUtils = {
  applyFilters,
  sortPlaces,
  generateFinalRecommendations,
  adjustForUserFeedback,
  calculateRecommendationStats,
  clearMemoizationCache,
  captureFeedbackPatterns,
  adjustRecommendationParameters,
  calculateVariance,
  analyzeMbtiTraits,
  calculateFeedbackRecency,
  generatePrimaryReason
};

export default recommendationUtils;
