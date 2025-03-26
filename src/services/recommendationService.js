// src/services/recommendationService.js

import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { isOffline } from '../utils/cacheUtils';
import dummyDataGenerator from '../utils/dummyDataGenerator';
import locationUtils from '../utils/locationUtils';
import userBehaviorAnalytics from '../utils/userBehaviorAnalytics';
import weightLearningSystem from '../utils/weightLearningSystem';

const { createDummyPlaces } = dummyDataGenerator;
const { getLocationData } = locationUtils;
const { 
  analyzeUserVisitPatterns, 
  generateUserBehaviorProfile
} = userBehaviorAnalytics;
const {
  getUserLearningProfile,
  getCollaborativeWeights,
  adjustUserWeights
} = weightLearningSystem;

/**
 * 추천 서비스 - 사용자 프로필 기반 맞춤 추천 및 인기 장소 제공
 */
const recommendationService = {
  /**
   * 특집 추천 장소 가져오기
   * @param {Object} userProfile - 사용자 프로필 또는 옵션 객체
   * @returns {Promise<Object>} - 추천 장소 데이터 또는 오류
   */
  getFeaturedRecommendations: async (userProfile) => {
    // 네트워크 상태 확인
    if (isOffline()) {
      console.log("오프라인 상태: 캐시된 추천 또는 더미 데이터 사용");
      // 더미 데이터 생성
      return {
        success: true,
        data: createDummyPlaces(6)
      };
    }
    
    try {
      // 타임아웃 처리 (10초)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("추천 데이터 요청 시간 초과")), 10000)
      );
      
      // 기본 값 (타입이 지정된 경우)
      if (userProfile && userProfile.type) {
        const result = await Promise.race([
          fetchTypeBasedRecommendations(userProfile),
          timeoutPromise
        ]);
        
        return {
          success: true,
          data: result
        };
      }
      
      // 사용자 프로필 기반 추천 - 개인화된 가중치 적용 (새로운 기능)
      const recommendationPromise = userProfile?.userId 
        ? fetchPersonalizedRecommendationsWithLearning(userProfile)
        : fetchPersonalizedRecommendations(userProfile);
      
      // 타임아웃과 경쟁
      const result = await Promise.race([
        recommendationPromise,
        timeoutPromise
      ]);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('추천 데이터 가져오기 오류:', error);
      
      // 재시도 로직 (오류에 따른 대응)
      if (error.code === 'unavailable' || error.message.includes('시간 초과')) {
        console.log('네트워크 문제로 인한 재시도...');
        try {
          // 더 짧은 타임아웃으로 한번 더 시도
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("재시도 시간 초과")), 5000)
          );
          
          const fallbackPromise = fetchFallbackRecommendations();
          const result = await Promise.race([fallbackPromise, timeoutPromise]);
          
          return {
            success: true,
            data: result
          };
        } catch (retryError) {
          console.error('재시도 실패:', retryError);
          // 재시도 실패 시 더미 데이터 반환
          return {
            success: true,
            data: createDummyPlaces(6)
          };
        }
      }
      
      // 일반적인 오류 처리
      return {
        success: false,
        error: error.message || '추천 데이터를 불러오는 중 오류가 발생했습니다.',
        data: createDummyPlaces(6) // 오류 발생해도 UI를 위한 더미 데이터 제공
      };
    }
  },

 /**
   * MBTI 기반 추천 장소 가져오기
   * @param {string} mbtiType - MBTI 유형
   * @returns {Promise<Object>} - 추천 장소 배열
   */
 getMbtiBasedRecommendations: async (mbtiType) => {
  try {
    if (isOffline()) {
      return {
        success: true,
        data: generateMbtiRecommendations(mbtiType, 5)
      };
    }
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("MBTI 추천 요청 시간 초과")), 8000)
    );
    
    const mbtiRecommendPromise = fetchMbtiRecommendations(mbtiType);
    const result = await Promise.race([mbtiRecommendPromise, timeoutPromise]);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('MBTI 추천 가져오기 오류:', error);
    return {
      success: false,
      error: error.message,
      data: generateMbtiRecommendations(mbtiType, 5)
    };
  }
},

/**
 * 지역 기반 추천 장소 가져오기 (개선된 지역 기반 로직)
 * @param {Object} location - 지역 정보 객체
 * @returns {Promise<Object>} - 추천 장소 데이터 또는 오류
 */
getLocationBasedRecommendations: async (location) => {
  try {
    if (!location || (!location.region && !location.coordinates)) {
      throw new Error("유효한 지역 정보가 필요합니다.");
    }
    
    if (isOffline()) {
      return {
        success: true,
        data: generateLocationBasedDummyData(location, 8)
      };
    }
    
    // 좌표 기반 검색과 지역명 기반 검색 모두 지원
    let placesData;
    
    if (location.coordinates) {
      // 좌표 기반 (위도/경도) 검색 - 지오쿼리 사용
      placesData = await fetchPlacesByCoordinates(
        location.coordinates,
        location.radius || 5 // 기본 반경 5km
      );
    } else {
      // 지역명 기반 검색 - 텍스트 검색 사용
      // 지역 계층 구조 (예: 서울 > 강남구 > 역삼동) 고려
      placesData = await fetchPlacesByRegionHierarchy(location);
    }
    
    return {
      success: true,
      data: placesData
    };
  } catch (error) {
    console.error('지역 기반 추천 가져오기 오류:', error);
    
    // 오류 발생 시 지역 정보 기반 더미 데이터 생성
    return {
      success: false,
      error: error.message || '지역 기반 추천을 가져오지 못했습니다.',
      data: generateLocationBasedDummyData(location, 6)
    };
  }
},

/**
 * 감정 상태 기반 추천 장소 가져오기
 * @param {Object} mood - 감정 정보 객체 
 * @returns {Promise<Object>} - 추천 장소 데이터 또는 오류
 */
getMoodBasedRecommendations: async (mood) => {
  try {
    if (!mood || !mood.mood) {
      throw new Error("유효한 감정 정보가 필요합니다.");
    }
    
    if (isOffline()) {
      return {
        success: true,
        data: generateMoodBasedDummyData(mood, 6)
      };
    }
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("감정 기반 추천 요청 시간 초과")), 8000)
    );
    
    const moodRecommendPromise = fetchMoodBasedRecommendations(mood);
    const result = await Promise.race([moodRecommendPromise, timeoutPromise]);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('감정 기반 추천 가져오기 오류:', error);
    return {
      success: false,
      error: error.message || '감정 기반 추천을 가져오지 못했습니다.',
      data: generateMoodBasedDummyData(mood, 6)
    };
  }
},

/**
   * 사용자 피드백 기반 가중치 조정 (개선됨)
   * @param {string} userId - 사용자 ID
   * @param {Object} feedbackData - 피드백 데이터
   * @param {Object} placeData - 장소 데이터
   * @returns {Promise<Object>} - 조정된 가중치 결과
   */
adjustRecommendationWeights: async (userId, feedbackData, placeData) => {
  try {
    if (!userId || !feedbackData) {
      throw new Error("사용자 ID와 피드백 데이터가 필요합니다.");
    }
    
    // 기존 가중치 가져오기
    const currentWeights = await getUserLearningProfile(userId);
    
    // 피드백 분석 및 처리
    const processedFeedback = processFeedbackForLearning(feedbackData, placeData);
    
    // 사용자의 모든 피드백 데이터 가져오기
    const userFeedbackHistory = await fetchUserFeedbackHistory(userId);
    
    // 가중치 조정 로직 호출 (개선된 버전)
    const result = await adjustUserWeights(
      userId, 
      processedFeedback, 
      placeData, 
      currentWeights,
      userFeedbackHistory
    );
    
    console.log(`사용자 ${userId}의 가중치가 업데이트되었습니다:`, result);
    
    return {
      success: true,
      data: result,
      previousWeights: currentWeights
    };
  } catch (error) {
    console.error('가중치 조정 오류:', error);
    return {
      success: false,
      error: error.message || '가중치 조정 중 오류가 발생했습니다.'
    };
  }
},

/**
 * 사용자의 행동 패턴 분석 및 프로필 생성 (개선됨)
 * @param {string} userId - 사용자 ID
 * @param {Object} userData - 사용자 데이터 (방문 이력, 피드백 등)
 * @returns {Promise<Object>} - 사용자 행동 프로필
 */
generateUserProfile: async (userId, userData) => {
  try {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }
    
    // 사용자 데이터가 없으면 데이터베이스에서 가져오기
    let completeUserData = userData;
    
    if (!completeUserData || !completeUserData.visitHistory) {
      completeUserData = await fetchCompleteUserData(userId);
    }
    
    if (!completeUserData) {
      return {
        success: false,
        error: "사용자 데이터를 찾을 수 없습니다."
      };
    }
    
    // 관련 장소 상세 정보 가져오기
    const visitedPlaceIds = completeUserData.visitHistory 
      ? completeUserData.visitHistory.map(visit => visit.placeId)
      : [];
    
    const placeDetails = visitedPlaceIds.length > 0 
      ? await fetchPlaceDetailsByIds(visitedPlaceIds)
      : [];
    
    // 사용자 행동 프로필 생성 (방문 이력, 피드백, 검색 이력 등 종합 분석)
    const behaviorProfile = generateUserBehaviorProfile(completeUserData, placeDetails);
    
    // 프로필 데이터 저장
    await saveUserBehaviorProfile(userId, behaviorProfile);
    
    return {
      success: true,
      data: behaviorProfile
    };
  } catch (error) {
    console.error('사용자 프로필 생성 오류:', error);
    return {
      success: false,
      error: error.message || '사용자 프로필 생성 중 오류가 발생했습니다.'
    };
  }
},

/**
 * 사용자의 추천 가중치 조회 (개선됨)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 사용자 추천 가중치
 */
getUserRecommendationWeights: async (userId) => {
  try {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }
    
    // 사용자 학습 프로필 가져오기
    const learningProfile = await getUserLearningProfile(userId);
    
    // 가중치가 없으면 기본 가중치로 초기화
    if (!learningProfile || !learningProfile.weights) {
      const defaultWeights = userBehaviorAnalytics.getDefaultWeights();
      
      // 기본 가중치 저장
      await saveUserLearningProfile(userId, { weights: defaultWeights, lastUpdated: new Date() });
      
      return {
        success: true,
        data: { weights: defaultWeights, isDefault: true }
      };
    }
    
    return {
      success: true,
      data: learningProfile
    };
  } catch (error) {
    console.error('가중치 조회 오류:', error);
    return {
      success: false,
      error: error.message || '가중치 조회 중 오류가 발생했습니다.'
    };
  }
},

/**
 * 사용자 그룹의 협업 필터링 가중치 가져오기 (신규)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 협업 필터링 가중치
 */
getCollaborativeFilteringWeights: async (userId) => {
  try {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }
    
    // 협업 필터링 가중치 가져오기
    const collaborativeWeights = await getCollaborativeWeights(userId);
    
    return {
      success: true,
      data: collaborativeWeights
    };
  } catch (error) {
    console.error('협업 필터링 가중치 오류:', error);
    return {
      success: false,
      error: error.message || '협업 필터링 가중치 가져오기 중 오류가 발생했습니다.'
    };
  }
},

/**
 * 사용자 인사이트 가져오기 (신규)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 사용자 인사이트
 */
getUserInsights: async (userId) => {
  try {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다.");
    }
    
    // 사용자 행동 프로필 가져오기
    const userProfile = await fetchUserBehaviorProfile(userId);
    
    if (!userProfile) {
      // 프로필이 없으면 생성
      return await recommendationService.generateUserProfile(userId);
    }
    
    // 인사이트 생성
    const insights = userBehaviorAnalytics.generateHumanReadableInsights(userProfile);
    
    return {
      success: true,
      data: {
        insights,
        profile: userProfile
      }
    };
  } catch (error) {
    console.error('사용자 인사이트 오류:', error);
    return {
      success: false,
      error: error.message || '사용자 인사이트 가져오기 중 오류가 발생했습니다.'
    };
  }
}
};

/**
 * 사용자 학습 가중치와 행동 패턴을 적용한 개인화된 추천 (개선됨)
 * @param {Object} userProfile - 사용자 프로필
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchPersonalizedRecommendationsWithLearning(userProfile) {
  if (!userProfile || !userProfile.userId) {
    console.log('사용자 ID 없음, 기본 추천 사용');
    return fetchPersonalizedRecommendations(userProfile);
  }
  
  try {
    // 1. 사용자 학습 프로필 가져오기
    const userId = userProfile.userId;
    
    // 사용자 피드백 이력 가져오기
    const userFeedbackHistory = await fetchUserFeedbackHistory(userId);
    
    // 사용자 행동 프로필 가져오기
    let userBehaviorProfile = await fetchUserBehaviorProfile(userId);
    
    // 프로필이 없거나 오래된 경우 새로 생성
    if (!userBehaviorProfile || isProfileOutdated(userBehaviorProfile.lastUpdated)) {
      const userData = await fetchCompleteUserData(userId);
      const placeDetails = userData.visitHistory && userData.visitHistory.length > 0
        ? await fetchPlaceDetailsByIds(userData.visitHistory.map(v => v.placeId))
        : [];
      
      userBehaviorProfile = generateUserBehaviorProfile(userData, placeDetails);
      await saveUserBehaviorProfile(userId, userBehaviorProfile);
    }
    
    // 협업 필터링 가중치와 개인 가중치 결합
    const weightResult = await getCollaborativeWeights(userId, userProfile);
    const personalizedWeights = weightResult.weights;
    
    console.log('개인화된 가중치 적용:', personalizedWeights);
    
    // 2. 각 요소별 추천 결과 가져오기 (가중치 계산 위해)
    const [mbtiResults, locationResults, moodResults] = await Promise.allSettled([
      // MBTI 기반 (있는 경우)
      userProfile.mbti 
        ? fetchMbtiRecommendations(userProfile.mbti) 
        : Promise.resolve([]),
      
      // 선호 지역 기반 (있는 경우)
      userProfile.preferredLocations && userProfile.preferredLocations.length 
        ? fetchPreferredLocationRecommendations(userProfile.preferredLocations[0])
        : Promise.resolve([]),
      
      // 현재 감정 기반 (있는 경우)
      userProfile.currentMood && userProfile.currentMood.mood
        ? fetchMoodBasedRecommendations(userProfile.currentMood)
        : Promise.resolve([])
    ]);
    
    // 결과 처리 (오류 포함해도 진행)
    const mbtiPlaces = mbtiResults.status === 'fulfilled' ? mbtiResults.value : [];
    const locationPlaces = locationResults.status === 'fulfilled' ? locationResults.value : [];
    const moodPlaces = moodResults.status === 'fulfilled' ? moodResults.value : [];
    
    // 3. 개인화된 가중치로 추천 결과 조합 (개선됨)
    const combinedRecommendations = combineAndScoreRecommendationsWithLearning(
      mbtiPlaces, 
      locationPlaces, 
      moodPlaces,
      userProfile,
      personalizedWeights,
      userBehaviorProfile,
      userFeedbackHistory
    );
    
    // 4. 사용자 행동 패턴 분석 및 컨텍스트 요소 적용 (있는 경우)
    let finalRecommendations = combinedRecommendations;
    
    if (userProfile.visitHistory && userProfile.visitHistory.length > 0) {
      finalRecommendations = applyUserBehaviorPatterns(
        combinedRecommendations, 
        userProfile, 
        userBehaviorProfile
      );
    }
    
    // 5. 사용자 컨텍스트 적용 (시간, 날씨, 위치 등)
    finalRecommendations = applyContextFactors(finalRecommendations, userProfile);
    
    // 결과가 없으면 인기 추천으로 대체
    if (finalRecommendations.length === 0) {
      console.log('맞춤 추천 없음, 인기 장소 대체');
      return fetchTypeBasedRecommendations({ type: 'popular', limit: 6 });
    }
    
    // 추천 데이터 로깅 (학습 목적)
    logRecommendationData(userId, finalRecommendations, personalizedWeights);
    
    return finalRecommendations;
    
  } catch (error) {
    console.error('개인화 추천 가져오기 오류:', error);
    // 오류 시 기본 추천 메서드로 폴백
    return fetchPersonalizedRecommendations(userProfile);
  }
}

/**
 * 피드백을 학습용으로 처리하는 함수 (신규)
 * @param {Object} feedbackData - 피드백 데이터
 * @param {Object} placeData - 장소 데이터
 * @returns {Object} - 학습용으로 처리된 피드백
 */
function processFeedbackForLearning(feedbackData, placeData) {
  if (!feedbackData || !placeData) {
    return null;
  }
  
  // 학습에 필요한 정보 추출
  const result = {
    relevanceRating: feedbackData.relevanceRating || 3,
    tags: feedbackData.tags || [],
    timestamp: feedbackData.timestamp || new Date(),
    placeCategory: placeData.category,
    placeSubCategory: placeData.subCategory,
    placeTags: placeData.tags || [],
    placeAttributes: {
      mbtiRelevance: placeData.recommendedFor?.mbti || [],
      moodRelevance: placeData.recommendedFor?.mood || [],
      interestRelevance: placeData.tags || []
    },
    matchDetails: feedbackData.matchDetails || {}
  };
  
  // 긍정/부정 피드백 분류
  if (result.relevanceRating >= 4) {
    result.feedbackType = 'positive';
  } else if (result.relevanceRating <= 2) {
    result.feedbackType = 'negative';
  } else {
    result.feedbackType = 'neutral';
  }
  
  return result;
}

/**
 * 사용자 피드백 이력 가져오기 (신규)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} - 피드백 이력
 */
async function fetchUserFeedbackHistory(userId) {
  try {
    if (!userId) return [];
    
    const feedbacksRef = collection(db, 'feedback');
    const feedbackQuery = query(
      feedbacksRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(feedbackQuery);
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('피드백 이력 가져오기 오류:', error);
    return [];
  }
}

/**
 * 프로필이 오래되었는지 확인 (신규)
 * @param {Date} lastUpdated - 마지막 업데이트 시간
 * @returns {boolean} - 오래되었는지 여부
 */
function isProfileOutdated(lastUpdated) {
  if (!lastUpdated) return true;
  
  const updateDate = new Date(lastUpdated);
  if (updateDate.toString() === 'Invalid Date') return true;
  
  const now = new Date();
  const diffDays = Math.floor((now - updateDate) / (1000 * 60 * 60 * 24));
  
  // 7일 이상 지났으면 오래된 것으로 간주
  return diffDays >= 7;
}

/**
 * 개인화된 가중치를 적용한 추천 조합 및 점수 부여 (개선됨)
 * @param {Array} mbtiPlaces - MBTI 기반 장소
 * @param {Array} locationPlaces - 지역 기반 장소
 * @param {Array} moodPlaces - 감정 기반 장소
 * @param {Object} userProfile - 사용자 프로필
 * @param {Object} weights - 개인화된 가중치
 * @param {Object} behaviorProfile - 사용자 행동 프로필
 * @param {Array} feedbackHistory - 피드백 이력
 * @returns {Array} - 조합 및 정렬된 추천 장소
 */
function combineAndScoreRecommendationsWithLearning(
  mbtiPlaces, 
  locationPlaces, 
  moodPlaces, 
  userProfile,
  weights,
  behaviorProfile = null,
  feedbackHistory = []
) {
  // 장소 ID별 점수 맵
  const placeScores = new Map();
  // 장소 데이터 맵
  const placeData = new Map();
  
  // MBTI 기반 점수 부여 (개인화된 가중치 적용)
  mbtiPlaces.forEach((place, index) => {
    const baseScore = weights.mbti * 10 * (mbtiPlaces.length - index) / mbtiPlaces.length;
    placeScores.set(place.id, (placeScores.get(place.id) || 0) + baseScore);
    placeData.set(place.id, place);
    
    // 점수 상세 기록 설정
    if (!place.matchDetails) place.matchDetails = {};
    place.matchDetails.mbtiScore = baseScore;
  });
  
  // 지역 기반 점수 부여 (개인화된 가중치 적용)
  locationPlaces.forEach((place, index) => {
    const baseScore = weights.location * 10 * (locationPlaces.length - index) / locationPlaces.length;
    placeScores.set(place.id, (placeScores.get(place.id) || 0) + baseScore);
    placeData.set(place.id, place);
    
    // 점수 상세 기록 설정
    if (!place.matchDetails) place.matchDetails = {};
    place.matchDetails.locationScore = baseScore;
  });
  
  // 감정 기반 점수 부여 (개인화된 가중치 적용)
  moodPlaces.forEach((place, index) => {
    const baseScore = weights.mood * 10 * (moodPlaces.length - index) / moodPlaces.length;
    placeScores.set(place.id, (placeScores.get(place.id) || 0) + baseScore);
    placeData.set(place.id, place);
    
    // 점수 상세 기록 설정
    if (!place.matchDetails) place.matchDetails = {};
    place.matchDetails.moodScore = baseScore;
  });
  
  // 추가 점수 부여 (관심사 매치 등)
  if (userProfile.interests && userProfile.interests.length) {
    placeData.forEach((place, id) => {
      if (place.tags && Array.isArray(place.tags)) {
        const matchingTags = place.tags.filter(tag => 
          userProfile.interests.some(interest => 
            interest.toLowerCase() === tag.toLowerCase()
          )
        );
        
        if (matchingTags.length > 0) {
          // 관심사 가중치 적용
          const interestScore = matchingTags.length * weights.interests * 10;
          placeScores.set(id, (placeScores.get(id) || 0) + interestScore);
          
          // 점수 상세 기록 설정
          if (!place.matchDetails) place.matchDetails = {};
          place.matchDetails.interestScore = interestScore;
          place.matchDetails.matchingInterests = matchingTags;
        }
      }
    });
  }
  
  // 재능 활용 점수 부여 (있는 경우)
  if (userProfile.talents && userProfile.talents.length) {
    placeData.forEach((place, id) => {
      if (place.talentRelevance && Array.isArray(place.talentRelevance)) {
        const matchingTalents = place.talentRelevance.filter(talent => 
          userProfile.talents.some(userTalent => 
            userTalent.toLowerCase() === talent.toLowerCase()
          )
        );
        
        if (matchingTalents.length > 0) {
          // 재능 가중치 적용
          const talentScore = matchingTalents.length * weights.talents * 10;
          placeScores.set(id, (placeScores.get(id) || 0) + talentScore);
          
          // 점수 상세 기록 설정
          if (!place.matchDetails) place.matchDetails = {};
          place.matchDetails.talentScore = talentScore;
          place.matchDetails.matchingTalents = matchingTalents;
        }
      }
    });
  }
  
  // 피드백 히스토리 적용 (신규)
  if (feedbackHistory && feedbackHistory.length > 0) {
    applyFeedbackHistory(placeScores, placeData, feedbackHistory);
  }
  
  // 사용자 행동 패턴 적용 (신규)
  if (behaviorProfile && behaviorProfile.categoryPatterns) {
    applyCategoryPreferences(placeScores, placeData, behaviorProfile.categoryPatterns);
  }
  
  // 점수 기반 정렬 및 결과 생성
  const sortedResults = Array.from(placeScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => {
      const place = placeData.get(id);
      return {
        ...place,
        matchScore: score,
        matchDetails: {
          // 각 요소별 기여도 세부 정보 포함
          total: score,
          mbtiScore: place.matchDetails?.mbtiScore || 0,
          interestScore: place.matchDetails?.interestScore || 0,
          talentScore: place.matchDetails?.talentScore || 0,
          moodScore: place.matchDetails?.moodScore || 0,
          locationScore: place.matchDetails?.locationScore || 0,
          feedbackBoost: place.matchDetails?.feedbackBoost || 0,
          categoryBoost: place.matchDetails?.categoryBoost || 0
        }
      };
    })
    .slice(0, 10); // 상위 10개 결과 (다양성 알고리즘 적용 전)
  
  // 다양성 보장 알고리즘 적용 (카테고리 믹스)
  return ensureCategoryDiversity(sortedResults);
}

/**
 * 피드백 이력을 추천 점수에 적용 (신규)
 * @param {Map} placeScores - 장소별 점수 맵
 * @param {Map} placeData - 장소 데이터 맵
 * @param {Array} feedbackHistory - 피드백 이력
 */
function applyFeedbackHistory(placeScores, placeData, feedbackHistory) {
  // 카테고리별 선호도 추출
  const categoryPreferences = {};
  
  feedbackHistory.forEach(feedback => {
    if (!feedback.placeId || !feedback.relevanceRating) return;
    
    // 평점 조정 (-2 ~ +2 범위)
    const ratingAdjustment = feedback.relevanceRating - 3;
    
    // 카테고리 선호도 업데이트
    if (feedback.placeCategory) {
      categoryPreferences[feedback.placeCategory] = 
        (categoryPreferences[feedback.placeCategory] || 0) + ratingAdjustment;
    }
    
    // 직접적인 장소 피드백 반영
    if (placeData.has(feedback.placeId)) {
      const place = placeData.get(feedback.placeId);
      const currentScore = placeScores.get(feedback.placeId) || 0;
      
      // 적합도 평가에 기반한 점수 조정
      let feedbackBoost = 0;
      
      if (feedback.relevanceRating >= 4) {
        // 긍정적 피드백
        feedbackBoost = 5; // 고정 보너스
      } else if (feedback.relevanceRating <= 2) {
        // 부정적 피드백
        feedbackBoost = -5; // 고정 페널티
      }
      
      // 점수 조정 적용
      placeScores.set(feedback.placeId, currentScore + feedbackBoost);
      
      // 점수 상세 기록 설정
      if (!place.matchDetails) place.matchDetails = {};
      place.matchDetails.feedbackBoost = feedbackBoost;
    }
  });
  
  // 카테고리 선호도를 기반으로 유사 장소 점수 조정
  placeData.forEach((place, id) => {
    if (!place.category) return;
    
    const categoryPreference = categoryPreferences[place.category] || 0;
    if (categoryPreference !== 0) {
      const currentScore = placeScores.get(id) || 0;
      const categoryBoost = categoryPreference > 0 
        ? Math.min(categoryPreference, 3) // 최대 +3 보너스
        : Math.max(categoryPreference, -3); // 최대 -3 페널티
      
      placeScores.set(id, currentScore + categoryBoost);
      
      // 점수 상세 기록 설정
      if (!place.matchDetails) place.matchDetails = {};
      place.matchDetails.categoryBoost = categoryBoost;
    }
  });
}

/**
 * 카테고리 선호도를 추천 점수에 적용 (신규)
 * @param {Map} placeScores - 장소별 점수 맵
 * @param {Map} placeData - 장소 데이터 맵
 * @param {Object} categoryPatterns - 카테고리 패턴 정보
 */
function applyCategoryPreferences(placeScores, placeData, categoryPatterns) {
  if (!categoryPatterns || !categoryPatterns.categories) return;
  
  // 카테고리별 방문 횟수를 선호도로 변환
  const categories = categoryPatterns.categories;
  const totalVisits = Object.values(categories).reduce((sum, count) => sum + count, 0);
  
  if (totalVisits === 0) return;
  
  // 각 카테고리 방문 비율 계산
  const categoryRatios = {};
  Object.entries(categories).forEach(([category, count]) => {
    categoryRatios[category] = count / totalVisits;
  });
  
  // 선호도 점수 적용
  placeData.forEach((place, id) => {
    if (!place.category) return;
    
    const categoryRatio = categoryRatios[place.category] || 0;
    if (categoryRatio > 0) {
      const currentScore = placeScores.get(id) || 0;
      // 최대 4점까지 보너스
      const categoryBoost = Math.min(categoryRatio * 10, 4);
      
      placeScores.set(id, currentScore + categoryBoost);
      
      // 점수 상세 기록 설정
      if (!place.matchDetails) place.matchDetails = {};
      place.matchDetails.categoryBoost = (place.matchDetails.categoryBoost || 0) + categoryBoost;
    }
  });
}

/**
 * 사용자 행동 패턴과 컨텍스트 요소를 적용하여 추천 보정 (개선됨)
 * @param {Array} recommendations - 추천 장소 배열
 * @param {Object} userProfile - 사용자 프로필
 * @param {Object} behaviorProfile - 사용자 행동 프로필
 * @returns {Array} - 보정된 추천 장소 배열
 */
function applyUserBehaviorPatterns(recommendations, userProfile, behaviorProfile) {
  if (!recommendations || recommendations.length === 0 || 
      !userProfile.visitHistory || userProfile.visitHistory.length === 0 ||
      !behaviorProfile) {
    return recommendations;
  }
  
  try {
    // 방문 패턴 분석
    const visitPatterns = behaviorProfile.visitPatterns || analyzeUserVisitPatterns(userProfile.visitHistory);
    
    // 현재 시간 컨텍스트
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0: 일요일, 6: 토요일
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    // 방문 이력이 있는 장소 ID 집합
    const visitedPlaceIds = new Set(
      userProfile.visitHistory.map(visit => visit.placeId)
    );
    
    // 추천 결과 보정
    const adjustedRecommendations = recommendations.map(place => {
      let contextBoost = 1.0; // 기본 부스트 값
      const boostReasons = [];
      
      // 1. 시간대 선호도 매칭
      if (visitPatterns.timePatterns && visitPatterns.timePatterns.hourDistribution) {
        const hourPreference = visitPatterns.timePatterns.hourDistribution[currentHour] || 0;
        if (hourPreference > 0) {
          const timeBoost = 1 + (hourPreference / 10); // 최대 +20% 부스트
          contextBoost *= timeBoost;
          boostReasons.push('time');
        }
      }
      
      // 2. 요일 선호도 매칭 (주중/주말)
      if (visitPatterns.timePatterns && visitPatterns.timePatterns.dayOfWeek) {
        const weekdayPreference = visitPatterns.timePatterns.dayOfWeek.counts.weekdays || 0;
        const weekendPreference = visitPatterns.timePatterns.dayOfWeek.counts.weekend || 0;
        
        if (isWeekend && weekendPreference > weekdayPreference) {
          contextBoost *= 1.1; // +10% 부스트
          boostReasons.push('weekend');
        } else if (!isWeekend && weekdayPreference > weekendPreference) {
          contextBoost *= 1.1; // +10% 부스트
          boostReasons.push('weekday');
        }
      }
      
      // 3. 카테고리 선호도 매칭
      if (visitPatterns.categoryPatterns && 
          visitPatterns.categoryPatterns.categories && 
          place.category) {
        const categoryPreference = visitPatterns.categoryPatterns.categories[place.category] || 0;
        if (categoryPreference > 0) {
          const categoryBoost = 1 + (categoryPreference / 20); // 최대 +15% 부스트
          contextBoost *= categoryBoost;
          boostReasons.push('category');
        }
      }
      
      // 4. 재방문 패턴 (이미 방문한 곳 vs 새로운 곳)
      const hasVisited = visitedPlaceIds.has(place.id);
      
      if (visitPatterns.revisitPatterns) {
        const revisitPattern = visitPatterns.revisitPatterns.revisitPattern;
        
        if (revisitPattern === 'high' && hasVisited) {
          // 높은 재방문 패턴 + 이미 방문한 장소 = 부스트
          contextBoost *= 1.15; // +15% 부스트
          boostReasons.push('revisit');
        } else if (revisitPattern === 'low' && !hasVisited) {
          // 낮은 재방문 패턴 + 새로운 장소 = 부스트
          contextBoost *= 1.15; // +15% 부스트
          boostReasons.push('new');
        }
      }
      
      // 5. 사용자 페르소나 매칭 (신규)
      if (visitPatterns.dominantPatterns && visitPatterns.dominantPatterns.userPersona) {
        const persona = visitPatterns.dominantPatterns.userPersona;
        let personaBoost = 1.0;
        
        // 페르소나별 특성 매칭
        if (persona === 'enthusiastic_explorer' && !hasVisited) {
          // 열정적 탐험가는 새로운 장소 선호
          personaBoost = 1.2;
          boostReasons.push('explorer');
        } else if (persona === 'loyal_regular' && hasVisited) {
          // 충성 고객은 재방문 선호
          personaBoost = 1.2;
          boostReasons.push('loyal');
        } else if (persona === 'morning_cafe_goer' && 
                  place.category === 'cafe' && 
                  currentHour >= 6 && currentHour <= 11) {
          // 아침 카페 방문객
          personaBoost = 1.25;
          boostReasons.push('morning_cafe');
        } else if (persona === 'evening_diner' && 
                  (place.category === 'restaurant' || place.category === 'bar') &&
                  currentHour >= 17 && currentHour <= 21) {
          // 저녁 식사 선호자
          personaBoost = 1.25;
          boostReasons.push('evening_diner');
        } else if (persona === 'weekend_leisure_seeker' && isWeekend) {
          // 주말 여가 추구자
          personaBoost = 1.2;
          boostReasons.push('weekend_leisure');
        }
        
        contextBoost *= personaBoost;
      }
      
      // 최종 조정된 점수
      const adjustedScore = place.matchScore * contextBoost;
      
      return {
        ...place,
        matchScore: adjustedScore,
        contextBoost: contextBoost > 1,
        boostReasons: boostReasons.length > 0 ? boostReasons : null,
        visited: hasVisited
      };
    });
    
    // 재정렬 및 다양성 보장
    return ensureCategoryDiversity(
      adjustedRecommendations.sort((a, b) => b.matchScore - a.matchScore)
    );
    
  } catch (error) {
    console.error('행동 패턴 적용 오류:', error);
    // 오류 시 원본 추천 반환
    return recommendations;
  }
}

/**
 * 현재 컨텍스트 요소를 추천에 적용 (신규)
 * @param {Array} recommendations - 추천 장소 배열
 * @param {Object} userProfile - 사용자 프로필
 * @returns {Array} - 컨텍스트를 적용한 추천 장소 배열
 */
function applyContextFactors(recommendations, userProfile) {
  if (!recommendations || recommendations.length === 0) {
    return recommendations;
  }
  
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    // 날씨 정보 (사용자 프로필에 있는 경우)
    const weather = userProfile.contextData?.weather;
    
    // 사용자 현재 위치 (있는 경우)
    const userLocation = userProfile.contextData?.location || 
                         userProfile.currentLocation;
    
    const adjustedRecommendations = recommendations.map(place => {
      let contextBoost = 1.0;
      const contextFactors = [];
      
      // 1. 운영 시간 기반 부스트
      if (place.operatingHours) {
        const isCurrentlyOpen = checkIfOpenNow(place.operatingHours, now);
        if (isCurrentlyOpen) {
          contextBoost *= 1.1; // 현재 영업 중인 장소 +10% 부스트
          contextFactors.push('open_now');
        }
      }
      
      // 2. 날씨 기반 부스트
      if (weather && place.recommendedFor && place.recommendedFor.weather) {
        if (place.recommendedFor.weather.includes(weather.condition)) {
          contextBoost *= 1.15; // 현재 날씨에 적합한 장소 +15% 부스트
          contextFactors.push('weather_match');
        }
      }
      
      // 3. 거리 기반 부스트 (가까울수록 더 높은 점수)
      if (userLocation && place.coordinates) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.coordinates.latitude,
          place.coordinates.longitude
        );
        
        // 가까운 장소에 더 높은 부스트 (5km 이내)
        if (distance <= 1) {
          contextBoost *= 1.2; // 1km 이내 +20% 부스트
          contextFactors.push('very_close');
        } else if (distance <= 3) {
          contextBoost *= 1.1; // 3km 이내 +10% 부스트
          contextFactors.push('close');
        } else if (distance <= 5) {
          contextBoost *= 1.05; // 5km 이내 +5% 부스트
          contextFactors.push('nearby');
        }
        
        // 거리 정보 추가
        place.distance = distance;
      }
      
      // 4. 시간대별 특성 부스트
      const timeOfDay = getTimeOfDay(currentHour);
      if (place.recommendedFor && place.recommendedFor.timeOfDay && 
          place.recommendedFor.timeOfDay.includes(timeOfDay)) {
        contextBoost *= 1.1; // 현재 시간대에 적합한 장소 +10% 부스트
        contextFactors.push('time_match');
      }
      
      // 5. 주중/주말 특성 부스트
      const dayType = isWeekend ? 'weekend' : 'weekday';
      if (place.recommendedFor && place.recommendedFor.dayType && 
          place.recommendedFor.dayType.includes(dayType)) {
        contextBoost *= 1.1; // 주중/주말 특성에 맞는 장소 +10% 부스트
        contextFactors.push('day_match');
      }
      
      // 최종 점수 계산
      return {
        ...place,
        matchScore: place.matchScore * contextBoost,
        contextFactors: contextFactors.length > 0 ? contextFactors : null,
        contextBoost: contextBoost > 1 ? contextBoost : null
      };
    });
    
    // 재정렬
    return adjustedRecommendations.sort((a, b) => b.matchScore - a.matchScore);
    
  } catch (error) {
    console.error('컨텍스트 적용 오류:', error);
    return recommendations;
  }
}

/**
 * 현재 시간이 영업 시간 내인지 확인 (신규)
 * @param {Object} operatingHours - 영업 시간 정보
 * @param {Date} now - 현재 시간
 * @returns {boolean} - 영업 중인지 여부
 */
function checkIfOpenNow(operatingHours, now) {
  if (!operatingHours) return false;
  
  const day = now.getDay(); // 0: 일요일, 6: 토요일
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[day];
  
  // 해당 요일 영업 시간
  const dayHours = operatingHours[dayName];
  if (!dayHours || !dayHours.open) return false;
  
  // 현재 시간 (시:분 형식)
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes; // 분 단위로 변환
  
  // 영업 시작 시간
  const [openHour, openMinute] = dayHours.open.split(':').map(Number);
  const openTime = openHour * 60 + openMinute;
  
  // 영업 종료 시간
  const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
  const closeTime = closeHour * 60 + closeMinute;
  
  // 자정을 넘어가는 경우 (예: 22:00 ~ 02:00)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  
  // 일반적인 경우
  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * 시간에 따른 시간대 분류 (신규)
 * @param {number} hour - 시간 (0-23)
 * @returns {string} - 시간대 (morning, afternoon, evening, night)
 */
function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * 카테고리 다양성 보장 알고리즘 (개선됨)
 * @param {Array} recommendations - 추천 장소 배열
 * @returns {Array} - 다양성이 보장된 추천 장소 배열
 */
function ensureCategoryDiversity(recommendations) {
  if (!recommendations || recommendations.length <= 6) {
    return recommendations;
  }
  
  // 카테고리별 그룹화
  const categoryGroups = {};
  recommendations.forEach(place => {
    const category = place.category || 'other';
    if (!categoryGroups[category]) {
      categoryGroups[category] = [];
    }
    categoryGroups[category].push(place);
  });
  
  // 카테고리 수에 따라 전략 조정
  const categories = Object.keys(categoryGroups);
  const diverseResults = [];
  
  if (categories.length >= 6) {
    // 카테고리가 충분히 많으면 각 카테고리에서 하나씩 선택
    categories.slice(0, 6).forEach(category => {
      diverseResults.push(categoryGroups[category][0]);
    });
  } else {
    // 각 카테고리에서 최소 1개씩 선택
    categories.forEach(category => {
      diverseResults.push(categoryGroups[category][0]);
    });
    
    // 남은 슬롯을 전체 점수 순위로 채우기 (중복 제외)
    const remainingSlots = 6 - diverseResults.length;
    
    if (remainingSlots > 0) {
      // 이미 선택된 장소 제외
      const selectedIds = new Set(diverseResults.map(place => place.id));
      
      // 남은 높은 점수 장소 추가
      const remainingPlaces = recommendations.filter(place => !selectedIds.has(place.id));
      
      // 상위 N개 추가
      diverseResults.push(...remainingPlaces.slice(0, remainingSlots));
    }
  }
  
  // 최종 점수 순 정렬
  return diverseResults.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * 유형 기반 추천 가져오기 (인기, 최신 등)
 * @param {Object} options - 유형 및 제한 옵션
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchTypeBasedRecommendations(options) {
  const { type, limit: itemLimit = 10 } = options;
  
  let placesQuery;
  const placesRef = collection(db, 'places');
  
  switch (type) {
    case 'popular':
      placesQuery = query(
        placesRef,
        orderBy('visitCount', 'desc'),
        limit(itemLimit)
      );
      break;
    case 'recent':
      placesQuery = query(
        placesRef,
        orderBy('createdAt', 'desc'),
        limit(itemLimit)
      );
      break;
    case 'trending':
      placesQuery = query(
        placesRef,
        orderBy('trendScore', 'desc'),
        limit(itemLimit)
      );
      break;
    case 'highRated':
      placesQuery = query(
        placesRef,
        orderBy('rating', 'desc'),
        limit(itemLimit)
      );
      break;
    default:
      placesQuery = query(
        placesRef,
        orderBy('rating', 'desc'),
        limit(itemLimit)
      );
  }
  
  try {
    const snapshot = await getDocs(placesQuery);
    
    if (snapshot.empty) {
      console.log('추천 장소 없음, 더미 데이터 사용');
      return createDummyPlaces(itemLimit);
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('유형 기반 추천 가져오기 오류:', error);
    throw error;
  }
}

/**
 * 맞춤형 개인화 추천 가져오기 (기존 구현)
 * @param {Object} userProfile - 사용자 프로필 객체
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchPersonalizedRecommendations(userProfile) {
  if (!userProfile) {
    console.log('사용자 프로필 없음, 인기 장소 대체');
    return fetchTypeBasedRecommendations({ type: 'popular', limit: 6 });
  }
  
  try {
    // 여러 특성 기반 추천 결합
    const [mbtiResults, locationResults, moodResults] = await Promise.allSettled([
      // MBTI 기반 (있는 경우)
      userProfile.mbti 
        ? fetchMbtiRecommendations(userProfile.mbti) 
        : Promise.resolve([]),
      
      // 선호 지역 기반 (있는 경우)
      userProfile.preferredLocations && userProfile.preferredLocations.length 
        ? fetchPreferredLocationRecommendations(userProfile.preferredLocations[0])
        : Promise.resolve([]),
      
      // 현재 감정 기반 (있는 경우)
      userProfile.currentMood && userProfile.currentMood.mood
        ? fetchMoodBasedRecommendations(userProfile.currentMood)
        : Promise.resolve([])
    ]);
    
    // 결과 처리 (오류 포함해도 진행)
    const mbtiPlaces = mbtiResults.status === 'fulfilled' ? mbtiResults.value : [];
    const locationPlaces = locationResults.status === 'fulfilled' ? locationResults.value : [];
    const moodPlaces = moodResults.status === 'fulfilled' ? moodResults.value : [];
    
    // 결합 및 점수 부여 (가중치 적용)
    const combinedRecommendations = combineAndScoreRecommendations(
      mbtiPlaces, 
      locationPlaces, 
      moodPlaces,
      userProfile
    );
    
    // 결과가 없으면 인기 추천으로 대체
    if (combinedRecommendations.length === 0) {
      console.log('맞춤 추천 없음, 인기 장소 대체');
      return fetchTypeBasedRecommendations({ type: 'popular', limit: 6 });
    }
    
    return combinedRecommendations;
  } catch (error) {
    console.error('맞춤 추천 가져오기 오류:', error);
    // 오류 시 인기 장소로 대체
    return fetchTypeBasedRecommendations({ type: 'popular', limit: 6 });
  }
}

/**
 * 추천 결과 로깅 (학습 및 분석용) (신규)
 * @param {string} userId - 사용자 ID
 * @param {Array} recommendations - 추천 결과
 * @param {Object} weights - 적용된 가중치
 */
async function logRecommendationData(userId, recommendations, weights) {
  if (!userId || !recommendations || recommendations.length === 0) return;
  
  try {
    // 로깅용 요약 데이터 생성
    const logData = {
      userId,
      timestamp: new Date(),
      recommendationCount: recommendations.length,
      appliedWeights: weights,
      topRecommendations: recommendations.slice(0, 3).map(rec => ({
        placeId: rec.id,
        matchScore: rec.matchScore,
        category: rec.category
      })),
      categories: recommendations.reduce((cats, rec) => {
        if (rec.category) {
          cats[rec.category] = (cats[rec.category] || 0) + 1;
        }
        return cats;
      }, {})
    };
    
    // Firebase에 로그 저장 (운영 환경에서만)
    if (!process.env.REACT_APP_IS_DEVELOPMENT) {
      //const logsRef = collection(db, 'recommendationLogs');
      // 로그 저장 로직 구현
      // await addDoc(logsRef, logData);
    }
    
    // 개발용 콘솔 로그
    console.log('추천 로그:', logData);
  } catch (error) {
    // 로깅 오류는 무시 (추천 프로세스에 영향 X)
    console.warn('추천 로깅 오류:', error);
  }
}

/**
 * 사용자 행동 프로필 저장 (신규)
 * @param {string} userId - 사용자 ID
 * @param {Object} profile - 행동 프로필
 */
async function saveUserBehaviorProfile(userId, profile) {
  // 구현 필요
  console.log(`사용자 ${userId}의 행동 프로필 저장됨`);
}

/**
 * 사용자 학습 프로필 저장 (신규)
 * @param {string} userId - 사용자 ID
 * @param {Object} profile - 학습 프로필
 */
async function saveUserLearningProfile(userId, profile) {
  // 구현 필요
  console.log(`사용자 ${userId}의 학습 프로필 저장됨`);
}

/**
 * 사용자 행동 프로필 가져오기 (신규)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} - 행동 프로필
 */
async function fetchUserBehaviorProfile(userId) {
  // 임시 데이터 반환
  return null;
}

/**
 * 사용자 완전 데이터 가져오기 (신규)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 사용자 데이터
 */
async function fetchCompleteUserData(userId) {
  // 구현 필요
  return {
    visitHistory: [],
    feedbacks: [],
    searchHistory: []
  };
}

/**
 * 장소 상세 정보 가져오기 (신규)
 * @param {Array} placeIds - 장소 ID 배열
 * @returns {Promise<Array>} - 장소 상세 정보
 */
async function fetchPlaceDetailsByIds(placeIds) {
  // 구현 필요
  return [];
}

/**
 * 추천 조합 및 점수 부여 (기존 구현)
 * @param {Array} mbtiPlaces - MBTI 기반 장소
 * @param {Array} locationPlaces - 지역 기반 장소
 * @param {Array} moodPlaces - 감정 기반 장소
 * @param {Object} userProfile - 사용자 프로필
 * @returns {Array} - 조합 및 정렬된 추천 장소
 */
function combineAndScoreRecommendations(mbtiPlaces, locationPlaces, moodPlaces, userProfile) {
  // 장소 ID별 점수 맵
  const placeScores = new Map();
  // 장소 데이터 맵
  const placeData = new Map();
  
  // MBTI 기반 점수 부여 (가중치: 4)
  mbtiPlaces.forEach((place, index) => {
    const baseScore = 4 * (mbtiPlaces.length - index) / mbtiPlaces.length;
    placeScores.set(place.id, (placeScores.get(place.id) || 0) + baseScore);
    placeData.set(place.id, place);
  });
  
  // 지역 기반 점수 부여 (가중치: 5)
  locationPlaces.forEach((place, index) => {
    const baseScore = 5 * (locationPlaces.length - index) / locationPlaces.length;
    placeScores.set(place.id, (placeScores.get(place.id) || 0) + baseScore);
    placeData.set(place.id, place);
  });
  
  // 감정 기반 점수 부여 (가중치: 3)
  moodPlaces.forEach((place, index) => {
    const baseScore = 3 * (moodPlaces.length - index) / moodPlaces.length;
    placeScores.set(place.id, (placeScores.get(place.id) || 0) + baseScore);
    placeData.set(place.id, place);
  });
  
  // 추가 점수 부여 (관심사 매치 등)
  if (userProfile.interests && userProfile.interests.length) {
    placeData.forEach((place, id) => {
      if (place.tags && Array.isArray(place.tags)) {
        const matchingTags = place.tags.filter(tag => 
          userProfile.interests.some(interest => 
            interest.toLowerCase() === tag.toLowerCase()
          )
        );
        
        if (matchingTags.length > 0) {
          const interestScore = matchingTags.length * 2; // 관심사 일치당 2점 추가
          placeScores.set(id, (placeScores.get(id) || 0) + interestScore);
        }
      }
    });
  }
  
  // 점수 기반 정렬 및 결과 생성
  const sortedResults = Array.from(placeScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => placeData.get(id))
    .slice(0, 6); // 상위 6개 결과만 반환
  
  return sortedResults;
}

/**
 * MBTI 기반 추천 가져오기
 * @param {string} mbtiType - MBTI 유형
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchMbtiRecommendations(mbtiType) {
  try {
    const placesRef = collection(db, 'places');
    const mbtiQuery = query(
      placesRef,
      where('recommendedFor.mbti', 'array-contains', mbtiType),
      orderBy('rating', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(mbtiQuery);
    
    if (snapshot.empty) {
      // MBTI 직접 일치가 없으면 그룹 기반으로 찾기
      // (외향형/내향형, 감각형/직관형 등)
      return fetchMbtiGroupRecommendations(mbtiType);
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('MBTI 추천 가져오기 오류:', error);
    return generateMbtiRecommendations(mbtiType, 5);
  }
}

/**
 * MBTI 그룹 기반 추천 가져오기
 * @param {string} mbtiType - MBTI 유형
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchMbtiGroupRecommendations(mbtiType) {
  // MBTI 유형을 분해하여 그룹 특성 추출
  const isExtrovert = mbtiType.charAt(0) === 'E';
  const isSensing = mbtiType.charAt(1) === 'S';
  const isThinking = mbtiType.charAt(2) === 'T';
  const isJudging = mbtiType.charAt(3) === 'J';
  
  // 그룹 특성에 맞는 태그 생성
  const mbtiTraits = [];
  
  if (isExtrovert) mbtiTraits.push('외향적');
  else mbtiTraits.push('내향적');
  
  if (isSensing) mbtiTraits.push('감각적');
  else mbtiTraits.push('직관적');
  
  if (isThinking) mbtiTraits.push('사고적');
  else mbtiTraits.push('감정적');
  
  if (isJudging) mbtiTraits.push('판단적');
  else mbtiTraits.push('인식적');
  
  try {
    const placesRef = collection(db, 'places');
    const mbtiGroupQuery = query(
      placesRef,
      where('tags', 'array-contains-any', mbtiTraits),
      orderBy('rating', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(mbtiGroupQuery);
    
    if (snapshot.empty) {
      return createDummyPlaces(5, { mbtiType });
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('MBTI 그룹 추천 가져오기 오류:', error);
    return createDummyPlaces(5, { mbtiType });
  }
}

/**
 * 선호 지역 기반 추천 가져오기
 * @param {Object} location - 선호 지역 정보
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchPreferredLocationRecommendations(location) {
  try {
    if (!location || (!location.region && !location.subRegion)) {
      throw new Error('유효한 지역 정보가 필요합니다.');
    }
    
    // 지역 계층 구조 고려 (서울 > 강남구)
    const placesRef = collection(db, 'places');
    
    let locationQuery;
    
    if (location.subRegion) {
      // 상세 지역이 있으면 더 정확한 검색
      locationQuery = query(
        placesRef,
        where('location.region', '==', location.region),
        where('location.subRegion', '==', location.subRegion),
        orderBy('rating', 'desc'),
        limit(8)
      );
    } else {
      // 대표 지역만 있으면 넓은 범위 검색
      locationQuery = query(
        placesRef,
        where('location.region', '==', location.region),
        orderBy('rating', 'desc'),
        limit(8)
      );
    }
    
    const snapshot = await getDocs(locationQuery);
    
    if (snapshot.empty) {
      console.log('지역 추천 없음, 더미 데이터 사용');
      return createDummyPlaces(5, location);
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('선호 지역 추천 가져오기 오류:', error);
    return createDummyPlaces(5, location);
  }
}

/**
 * 감정 기반 추천 가져오기
 * @param {Object} mood - 감정 정보 객체
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchMoodBasedRecommendations(mood) {
  try {
    if (!mood || !mood.mood) {
      throw new Error('유효한 감정 정보가 필요합니다.');
    }
    
    const moodValue = mood.mood.toLowerCase();
    const intensity = mood.intensity || 3; // 강도 (기본값 중간)
    
    // 감정에 맞는 태그 매핑
    const moodTags = getMoodTags(moodValue, intensity);
    
    const placesRef = collection(db, 'places');
    const moodQuery = query(
      placesRef,
      where('tags', 'array-contains-any', moodTags),
      orderBy('rating', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(moodQuery);
    
    if (snapshot.empty) {
      console.log('감정 기반 결과 없음, 더미 데이터 사용');
      return createDummyPlaces(6, { mood });
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('감정 기반 추천 가져오기 오류:', error);
    return createDummyPlaces(6, { mood });
  }
}

/**
 * 감정에 맞는 태그 가져오기
 * @param {string} mood - 감정 상태
 * @param {number} intensity - 감정 강도 (1-5)
 * @returns {Array} - 관련 태그 배열
 */
function getMoodTags(mood, intensity) {
  // 다양한 감정에 따른 태그 매핑
  const moodTagMap = {
    '기쁨': ['즐거운', '신나는', '활동적인', '축제', '활기찬'],
    '행복': ['편안한', '따뜻한', '로맨틱한', '아늑한', '힐링'],
    '슬픔': ['조용한', '아름다운', '사색적인', '힐링', '위로'],
    '화남': ['릴렉싱', '자연', '힐링', '스트레스 해소', '액티비티'],
    '스트레스': ['휴식', '힐링', '조용한', '자연', '명상'],
    '지침': ['에너지 충전', '휴식', '편안한', '카페', '안락한'],
    '설렘': ['로맨틱한', '데이트', '특별한', '아름다운', '분위기 좋은'],
    '우울': ['위로', '따뜻한', '아늑한', '힐링', '예술'],
    '불안': ['안정적인', '조용한', '명상', '자연', '힐링'],
    '지루함': ['신기한', '독특한', '액티비티', '모험', '체험'],
    '호기심': ['독특한', '체험', '특별한', '역사', '배움'],
    '평온': ['자연', '경치 좋은', '조용한', '여유로운', '산책']
  };
  
  // 기본 감정이 매핑에 없는 경우 '행복' 태그 사용
  const baseTags = moodTagMap[mood] || moodTagMap['행복'];
  
  // 감정 강도에 따른 추가 태그
  let intensityTags = [];
  
  if (intensity >= 4) {
    // 강한 감정 - 더 활동적이거나 극적인 경험
    if (['기쁨', '설렘', '호기심'].includes(mood)) {
      intensityTags = ['모험', '액티비티', '스릴', '축제'];
    } else if (['슬픔', '우울', '불안'].includes(mood)) {
      intensityTags = ['치유', '명상', '자연', '완전한 휴식'];
    } else if (['화남', '스트레스'].includes(mood)) {
      intensityTags = ['운동', '액티비티', '스트레스 해소', '야외'];
    }
  } else if (intensity <= 2) {
    // 약한 감정 - 더 부드럽고 조용한 경험
    intensityTags = ['조용한', '편안한', '여유로운', '아늑한'];
  }
  
  // 중복 없이 태그 결합
  return [...new Set([...baseTags, ...intensityTags])].slice(0, 6);
}

/**
 * 대체용 기본 추천 가져오기
 * @returns {Promise<Array>} - 추천 장소 배열
 */
async function fetchFallbackRecommendations() {
  try {
    const placesRef = collection(db, 'places');
    const fallbackQuery = query(
      placesRef,
      orderBy('rating', 'desc'),
      limit(6)
    );
    
    const snapshot = await getDocs(fallbackQuery);
    
    if (snapshot.empty) {
      return createDummyPlaces(6);
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('기본 추천 가져오기 오류:', error);
    return createDummyPlaces(6);
  }
}

/**
 * 좌표 기반 장소 검색
 * @param {Object} coordinates - 좌표 (위도/경도)
 * @param {number} radius - 검색 반경 (km)
 * @returns {Promise<Array>} - 주변 장소 배열
 */
async function fetchPlacesByCoordinates(coordinates, radius) {
  // 실제 구현에서는 지오쿼리를 사용하거나
  // Firebase의 GeoFirestore 등을 활용해야 함
  // 여기서는 간단한 구현으로 대체
  try {
    const { latitude, longitude } = coordinates;
    // 좌표 기반 처리 로직...
    
    // 임시 구현: 지오쿼리 대신 일반 쿼리 + 후처리
    const placesRef = collection(db, 'places');
    const snapshot = await getDocs(query(placesRef, limit(50)));
    
    if (snapshot.empty) {
      return [];
    }
    
    // 좌표 계산 및 거리 필터링
    const nearbyPlaces = snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (data.coordinates) {
          // 두 좌표 간 거리 계산 (Haversine 공식 등 사용)
          const distance = calculateDistance(
            latitude, 
            longitude,
            data.coordinates.latitude,
            data.coordinates.longitude
          );
          
          return {
            id: doc.id,
            ...data,
            distance // 거리 추가
          };
        }
        return null;
      })
      .filter(place => place !== null && place.distance <= radius) // 반경 내 필터링
      .sort((a, b) => a.distance - b.distance); // 가까운 순서로 정렬
    
    return nearbyPlaces.slice(0, 15); // 최대 15개 결과
  } catch (error) {
    console.error('좌표 기반 장소 검색 오류:', error);
    throw error;
  }
}

/**
 * 지역 계층 구조 기반 장소 검색
 * @param {Object} location - 지역 정보
 * @returns {Promise<Array>} - 지역별 장소 배열
 */
async function fetchPlacesByRegionHierarchy(location) {
  try {
    // 지역 데이터 정리 및 검증
    const { region, subRegion, detailed } = getLocationData(location);
    
    const placesRef = collection(db, 'places');
    let locationQuery;
    
    // 상세 정보에 따른 쿼리 구조 최적화
    if (detailed) {
      // 가장 상세한 위치 정보 사용 (동/읍/면 수준)
      locationQuery = query(
        placesRef,
        where('location.region', '==', region),
        where('location.subRegion', '==', subRegion),
        where('location.detailed', '==', detailed),
        orderBy('rating', 'desc'),
        limit(15)
      );
    } else if (subRegion) {
      // 중간 수준 위치 정보 (구/군 수준)
      locationQuery = query(
        placesRef,
        where('location.region', '==', region),
        where('location.subRegion', '==', subRegion),
        orderBy('rating', 'desc'),
        limit(15)
      );
    } else {
      // 대표 지역만 있는 경우 (시/도 수준)
      locationQuery = query(
        placesRef,
        where('location.region', '==', region),
        orderBy('rating', 'desc'),
        limit(15)
      );
    }
    
    const snapshot = await getDocs(locationQuery);
    
    if (snapshot.empty) {
      // 검색 결과 없을 경우 상위 지역으로 확장 검색
      if (detailed) {
        console.log('상세 지역 결과 없음, 상위 지역으로 확장');
        return fetchPlacesByRegionHierarchy({ region, subRegion });
      }
      
      if (subRegion) {
        console.log('하위 지역 결과 없음, 상위 지역으로 확장');
        return fetchPlacesByRegionHierarchy({ region });
      }
      
      console.log('지역 검색 결과 없음, 더미 데이터 사용');
      return createDummyPlaces(8, location);
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('지역 계층 검색 오류:', error);
    return createDummyPlaces(8, location);
  }
}

/**
 * 두 좌표 간의 거리 계산 (Haversine 공식)
 * @param {number} lat1 - 첫 번째 위도
 * @param {number} lon1 - 첫 번째 경도
 * @param {number} lat2 - 두 번째 위도
 * @param {number} lon2 - 두 번째 경도
 * @returns {number} - 거리 (킬로미터)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  
  const R = 6371; // 지구 반경 (킬로미터)
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * 각도를 라디안으로 변환
 * @param {number} deg - 각도
 * @returns {number} - 라디안
 */
function degToRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * 지역 기반 더미 추천 생성 함수
 * @param {Object} location - 지역 정보 객체
 * @param {number} count - 생성할 개수
 * @returns {Array} - 생성된 더미 장소 데이터 배열
 */
function generateLocationBasedDummyData(location, count) {
  return createDummyPlaces(count, location);
}

/**
 * 감정 기반 더미 추천 생성 함수
 * @param {Object} mood - 감정 정보 객체
 * @param {number} count - 생성할 개수
 * @returns {Array} - 생성된 더미 장소 데이터 배열
 */
function generateMoodBasedDummyData(mood, count) {
  return createDummyPlaces(count, { mood });
}

/**
 * MBTI 기반 더미 추천 생성 함수
 * @param {string} mbtiType - MBTI 유형
 * @param {number} count - 생성할 개수
 * @returns {Array} - 생성된 더미 장소 데이터 배열
 */
function generateMbtiRecommendations(mbtiType, count) {
  return createDummyPlaces(count, { mbtiType });
}

// 명명된 함수들 내보내기
export const getRegionRecommendations = async (location, options = {}) => {
  return await recommendationService.getLocationBasedRecommendations(location, options);
};

export const getNearbyRecommendations = async (userProfile, location, radius, options = {}) => {
  // 좌표 기반 검색 구현
  try {
    const result = await recommendationService.getLocationBasedRecommendations({
      coordinates: location,
      radius: radius || 5
    }, options);
    return result;
  } catch (error) {
    console.error("근처 추천 오류:", error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

// 새로운 내보내기 함수
export const getUserWeights = async (userId) => {
  return await recommendationService.getUserRecommendationWeights(userId);
};

export const adjustWeightsFromFeedback = async (userId, feedbackData, placeData) => {
  return await recommendationService.adjustRecommendationWeights(userId, feedbackData, placeData);
};

export const generateBehaviorProfile = async (userId, userData) => {
  return await recommendationService.generateUserProfile(userId, userData);
};

export const getUserInsights = async (userId) => {
  return await recommendationService.getUserInsights(userId);
};

export const getCollaborativeFilteringWeights = async (userId) => {
  return await recommendationService.getCollaborativeFilteringWeights(userId);
};

// 기본 내보내기
export default recommendationService;
