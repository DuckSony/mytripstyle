/**
 * weightLearningSystem.js
 * 
 * 사용자 피드백 및 행동 패턴을 기반으로 추천 가중치를 학습하고 조정하는 시스템
 * 개인화된 추천을 위한 점진적 가중치 조정 알고리즘을 구현합니다.
 */

import { db } from '../config/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { getDefaultWeights } from './userBehaviorAnalytics';
import { 
  getUserPreferences, 
  saveUserPreferences, 
  addWeightAdjustmentHistory 
} from '../services/userPreferencesService';
import { 
  getCachedRecommendations, 
  cacheRecommendations
} from '../services/cacheService';

// 학습 파라미터 상수
const DEFAULT_LEARNING_RATE = 0.05;    // 기본 학습률
const MAX_LEARNING_RATE = 0.15;        // 최대 학습률
const MIN_LEARNING_RATE = 0.01;        // 최소 학습률
const CONFIDENCE_THRESHOLD = 5;        // 신뢰도 임계값 (데이터 포인트 수)
const HIGH_CONFIDENCE_THRESHOLD = 20;  // 높은 신뢰도 임계값
const CACHE_TTL = 24 * 60 * 60 * 1000; // 캐시 유효 기간 (24시간)

/**
 * 사용자별 학습 프로필을 가져오는 함수
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 학습 프로필 데이터
 */
export const getUserLearningProfile = async (userId) => {
  if (!userId) {
    throw new Error('사용자 ID가 필요합니다');
  }
  
  try {
    // 캐시 확인
    const cacheKey = `learning_profile_${userId}`;
    const cachedProfile = getCachedRecommendations(cacheKey);
    
    if (cachedProfile) {
      return cachedProfile;
    }
    
    // 사용자 선호도 서비스에서 데이터 가져오기
    const preferences = await getUserPreferences(userId);
    
    const profile = {
      weights: preferences.weights || getDefaultWeights(),
      learningRate: preferences.learningRate || DEFAULT_LEARNING_RATE,
      confidence: preferences.confidence || 0,
      history: preferences.history || [],
      lastUpdated: preferences.lastUpdated || new Date()
    };
    
    // 프로필 캐싱
    cacheRecommendations(cacheKey, profile, CACHE_TTL);
    
    return profile;
  } catch (error) {
    console.error('학습 프로필 가져오기 오류:', error);
    // 오류 발생 시 기본값 반환
    return {
      weights: getDefaultWeights(),
      learningRate: DEFAULT_LEARNING_RATE,
      confidence: 0,
      history: [],
      lastUpdated: new Date(),
      error: error.message
    };
  }
};

/**
 * 학습 프로필을 저장하는 함수
 * @param {string} userId - 사용자 ID
 * @param {Object} learningProfile - 학습 프로필 데이터
 * @returns {Promise<Object>} - 저장 결과
 */
export const saveUserLearningProfile = async (userId, learningProfile) => {
  if (!userId || !learningProfile || !learningProfile.weights) {
    throw new Error('유효한 사용자 ID와 학습 프로필이 필요합니다');
  }
  
  try {
    // 사용자 선호도 서비스에 저장
    const result = await saveUserPreferences(userId, {
      weights: learningProfile.weights,
      learningRate: learningProfile.learningRate || DEFAULT_LEARNING_RATE,
      confidence: learningProfile.confidence || 0,
      history: learningProfile.history || []
    });
    
    // 캐시 업데이트
    const cacheKey = `learning_profile_${userId}`;
    cacheRecommendations(cacheKey, {
      weights: learningProfile.weights,
      learningRate: learningProfile.learningRate || DEFAULT_LEARNING_RATE,
      confidence: learningProfile.confidence || 0,
      history: learningProfile.history || [],
      lastUpdated: new Date()
    }, CACHE_TTL);
    
    return { 
      success: result.success,
      data: {
        weights: learningProfile.weights,
        learningRate: learningProfile.learningRate || DEFAULT_LEARNING_RATE,
        confidence: learningProfile.confidence || 0,
        lastUpdated: result.lastUpdated || new Date()
      }
    };
  } catch (error) {
    console.error('학습 프로필 저장 오류:', error);
    return { 
      success: false, 
      error: error.message
    };
  }
};

/**
 * 피드백 데이터 기반 조정 방향 계산
 * @param {Object} feedbackData - 피드백 데이터
 * @param {Object} placeData - 장소 데이터 (선택적)
 * @returns {Object} - 각 가중치 요소의 조정 방향
 */
export const calculateAdjustmentDirection = (feedbackData, placeData = null) => {
  // 기본 조정 방향 (기본값은 중립)
  const direction = {
    mbti: 0,
    interests: 0,
    talents: 0,
    mood: 0,
    location: 0
  };
  
  // 피드백이 없으면 조정 없음
  if (!feedbackData || !feedbackData.relevanceRating) {
    return direction;
  }
  
  // 평점을 -1에서 1 사이의 값으로 변환 (3이 중립)
  // 1-2: 매우 부정적, 3: 중립, 4-5: 긍정적
  const normalizedRating = (feedbackData.relevanceRating - 3) / 2;
  
  // 평점이 중립이면 조정 없음
  if (Math.abs(normalizedRating) < 0.1) {
    return direction;
  }
  
  // 특정 태그에 따른 조정 (feedbackData.tags 활용)
  const tags = feedbackData.tags || [];
  
  // 태그 기반 가중치 타입 영향도 계산
  let mbtiEmphasis = 0;
  let interestsEmphasis = 0;
  let talentsEmphasis = 0;
  let moodEmphasis = 0;
  let locationEmphasis = 0;
  
  // 태그 키워드에 따른 영향도 계산
  tags.forEach(tag => {
    const tagLower = tag.toLowerCase();
    
    // MBTI 관련 태그
    if (tagLower.includes('mbti') || 
        tagLower.includes('성격') || 
        tagLower.includes('성향') ||
        tagLower.includes('introvert') || 
        tagLower.includes('extrovert')) {
      mbtiEmphasis += 1;
    }
    
    // 관심사 관련 태그
    if (tagLower.includes('관심') || 
        tagLower.includes('취향') || 
        tagLower.includes('취미') ||
        tagLower.includes('interest')) {
      interestsEmphasis += 1;
    }
    
    // 재능 관련 태그
    if (tagLower.includes('재능') || 
        tagLower.includes('talent') || 
        tagLower.includes('skill') ||
        tagLower.includes('특기')) {
      talentsEmphasis += 1;
    }
    
    // 감정 관련 태그
    if (tagLower.includes('감정') || 
        tagLower.includes('기분') || 
        tagLower.includes('mood') ||
        tagLower.includes('feel')) {
      moodEmphasis += 1;
    }
    
    // 위치 관련 태그
    if (tagLower.includes('위치') || 
        tagLower.includes('장소') || 
        tagLower.includes('지역') ||
        tagLower.includes('거리') ||
        tagLower.includes('location')) {
      locationEmphasis += 1;
    }
  });
  
  // 장소 데이터가 있는 경우 추가 분석
  if (placeData) {
    // 장소에 MBTI 추천 특성이 있는 경우
    if (placeData.recommendedFor && placeData.recommendedFor.mbti) {
      mbtiEmphasis += 0.5;
    }
    
    // 장소에 특정 관심사 태그가 있는 경우
    if (placeData.tags && Array.isArray(placeData.tags)) {
      const interestTags = placeData.tags.filter(tag => 
        tag.toLowerCase().includes('관심') || 
        tag.toLowerCase().includes('취미')
      );
      interestsEmphasis += interestTags.length * 0.3;
    }
    
    // 위치 정보가 중요한 장소인 경우
    if (placeData.distance !== undefined) {
      locationEmphasis += 0.5;
    }
    
    // 감정 기반 장소인 경우
    if (placeData.moodMatchScore) {
      moodEmphasis += 0.5;
    }
  }
  
  // 기본 영향도 설정 (태그가 없는 경우)
  const totalEmphasis = mbtiEmphasis + interestsEmphasis + talentsEmphasis + moodEmphasis + locationEmphasis;
  
  if (totalEmphasis === 0) {
    // 기본 균등 영향도 (모든 요소에 동일한 영향)
    mbtiEmphasis = 0.2;
    interestsEmphasis = 0.2;
    talentsEmphasis = 0.2;
    moodEmphasis = 0.2;
    locationEmphasis = 0.2;
  } else {
    // 태그 기반 영향도 정규화
    const sum = totalEmphasis;
    mbtiEmphasis = mbtiEmphasis / sum;
    interestsEmphasis = interestsEmphasis / sum;
    talentsEmphasis = talentsEmphasis / sum;
    moodEmphasis = moodEmphasis / sum;
    locationEmphasis = locationEmphasis / sum;
  }
  
  // 최종 조정 방향 계산 (평점 x 영향도)
  direction.mbti = normalizedRating * mbtiEmphasis;
  direction.interests = normalizedRating * interestsEmphasis;
  direction.talents = normalizedRating * talentsEmphasis;
  direction.mood = normalizedRating * moodEmphasis;
  direction.location = normalizedRating * locationEmphasis;
  
  return direction;
};

/**
 * 피드백에 따라 사용자별 가중치 조정
 * @param {string} userId - 사용자 ID
 * @param {Object} feedbackData - 피드백 데이터
 * @param {Object} placeData - 장소 데이터
 * @param {Object} currentWeights - 현재 가중치 (없으면 서버에서 가져옴)
 * @returns {Promise<Object>} - 조정된 가중치
 */
export const adjustUserWeights = async (userId, feedbackData, placeData, currentWeights = null) => {
  try {
    // 현재 가중치 가져오기 (전달되지 않은 경우)
    let learningProfile;
    if (!currentWeights) {
      learningProfile = await getUserLearningProfile(userId);
    } else {
      // 전달된 가중치 사용
      learningProfile = {
        weights: currentWeights,
        learningRate: DEFAULT_LEARNING_RATE,
        confidence: 0,
        history: []
      };
    }
    
    // 피드백 효과 없음
    if (!feedbackData || !feedbackData.relevanceRating) {
      return { weights: learningProfile.weights, unchanged: true };
    }
    
    // 학습률 및 가중치
    const weights = learningProfile.weights;
    let learningRate = learningProfile.learningRate || DEFAULT_LEARNING_RATE;
    let confidence = learningProfile.confidence || 0;
    
    // 기존 히스토리에 새 데이터 포인트 추가
    const history = Array.isArray(learningProfile.history) ? [...learningProfile.history] : [];
    history.push({
      timestamp: new Date(),
      placeId: placeData?.id || feedbackData.placeId,
      rating: feedbackData.relevanceRating,
      tags: feedbackData.tags || []
    });
    
    // 히스토리 크기 제한 (최근 50개)
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    // 신뢰도 업데이트
    confidence = Math.min(100, confidence + 1);
    
    // 학습률 동적 조정
    if (confidence < CONFIDENCE_THRESHOLD) {
      // 낮은 신뢰도: 높은 학습률 (빠른 초기 학습)
      learningRate = MAX_LEARNING_RATE;
    } else if (confidence > HIGH_CONFIDENCE_THRESHOLD) {
      // 높은 신뢰도: 낮은 학습률 (안정적 유지)
      learningRate = MIN_LEARNING_RATE;
    } else {
      // 중간 신뢰도: 점진적 감소
      const ratio = (confidence - CONFIDENCE_THRESHOLD) / 
                    (HIGH_CONFIDENCE_THRESHOLD - CONFIDENCE_THRESHOLD);
      learningRate = MAX_LEARNING_RATE - ratio * (MAX_LEARNING_RATE - MIN_LEARNING_RATE);
    }
    
    // 최근 피드백에 더 많은 가중치 부여
    // 최근 5개 피드백의 평균 점수 계산
    const recentFeedbacks = history.slice(-5);
    let recentAverageRating = 0;
    
    if (recentFeedbacks.length > 0) {
      recentAverageRating = recentFeedbacks.reduce((sum, feedback) => 
        sum + (feedback.rating || 3), 0) / recentFeedbacks.length;
    }
    
    // 최근 평균이 현재 피드백과 크게 다른 경우 학습률 조정
    const ratingDiff = Math.abs(recentAverageRating - feedbackData.relevanceRating);
    if (ratingDiff > 1.5 && recentFeedbacks.length >= 3) {
      // 일관성 없는 피드백은 학습률 감소
      learningRate *= 0.8;
    }
    
    // 피드백 데이터 기반 조정 방향 계산
    const adjustmentDirection = calculateAdjustmentDirection(feedbackData, placeData);
    
    // 가중치 업데이트
    const updatedWeights = {};
    Object.keys(weights).forEach(key => {
      updatedWeights[key] = weights[key] + 
        learningRate * adjustmentDirection[key];
    });
    
    // 가중치 정규화 (합이 1이 되도록)
    const normalizedWeights = normalizeWeights(updatedWeights);
    
    // 학습 프로필 업데이트
    const updatedProfile = {
      weights: normalizedWeights,
      learningRate,
      confidence,
      history
    };
    
    // 저장
    await saveUserLearningProfile(userId, updatedProfile);
    
    // 가중치 조정 이력 추가
    await addWeightAdjustmentHistory(userId, feedbackData, adjustmentDirection);
    
    return {
      weights: normalizedWeights,
      learningRate,
      confidence,
      adjustments: adjustmentDirection
    };
  } catch (error) {
    console.error('가중치 조정 오류:', error);
    return { 
      weights: currentWeights || getDefaultWeights(),
      error: error.message
    };
  }
};

/**
 * 가중치 합이 1이 되도록 정규화
 * @param {Object} weights - 정규화할 가중치
 * @returns {Object} - 정규화된 가중치
 */
export const normalizeWeights = (weights) => {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  
  if (Math.abs(sum - 1) < 0.001) return weights; // 이미 정규화됨
  if (sum === 0) return getDefaultWeights(); // 합이 0이면 기본값 반환
  
  const normalized = {};
  Object.keys(weights).forEach(key => {
    normalized[key] = parseFloat((weights[key] / sum).toFixed(4));
  });
  
  return normalized;
};

/**
 * 가중치 조정 이력 분석
 * @param {Array} history - 가중치 조정 이력
 * @returns {Object} - 이력 분석 결과
 */
export const analyzeWeightHistory = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      averageRating: 0,
      volatility: 0,
      trend: 'neutral',
      recentTrend: 'neutral',
      dataPoints: 0
    };
  }
  
  // 시간순 정렬
  const sortedHistory = [...history].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  // 평균 평점
  const ratings = sortedHistory.map(h => h.rating || 3);
  const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  
  // 변동성 (표준편차)
  const variance = ratings.reduce((sum, r) => {
    const diff = r - averageRating;
    return sum + (diff * diff);
  }, 0) / ratings.length;
  const volatility = Math.sqrt(variance);
  
  // 전체 추세
  const firstRatings = sortedHistory.slice(0, Math.min(5, Math.floor(sortedHistory.length / 3)))
    .map(h => h.rating || 3);
  const lastRatings = sortedHistory.slice(-Math.min(5, Math.floor(sortedHistory.length / 3)))
    .map(h => h.rating || 3);
  
  const firstAvg = firstRatings.reduce((sum, r) => sum + r, 0) / firstRatings.length;
  const lastAvg = lastRatings.reduce((sum, r) => sum + r, 0) / lastRatings.length;
  
  let trend = 'neutral';
  if (lastAvg - firstAvg > 0.5) trend = 'improving';
  else if (firstAvg - lastAvg > 0.5) trend = 'declining';
  
  // 최근 추세 (최근 5개 포인트)
  const recentPoints = sortedHistory.slice(-5);
  let recentTrend = 'neutral';
  
  if (recentPoints.length >= 3) {
    const recentRatings = recentPoints.map(h => h.rating || 3);
    let improving = 0;
    let declining = 0;
    
    for (let i = 1; i < recentRatings.length; i++) {
      if (recentRatings[i] > recentRatings[i-1]) improving++;
      else if (recentRatings[i] < recentRatings[i-1]) declining++;
    }
    
    if (improving > declining && improving >= 2) recentTrend = 'improving';
    else if (declining > improving && declining >= 2) recentTrend = 'declining';
  }
  
  // 범주별 태그 빈도 분석
  const tagFrequencies = {};
  sortedHistory.forEach(item => {
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach(tag => {
        tagFrequencies[tag] = (tagFrequencies[tag] || 0) + 1;
      });
    }
  });
  
  // 상위 태그 추출
  const topTags = Object.entries(tagFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  
  return {
    averageRating: parseFloat(averageRating.toFixed(2)),
    volatility: parseFloat(volatility.toFixed(2)),
    trend,
    recentTrend,
    dataPoints: history.length,
    topTags
  };
};

/**
 * 두 집합의 Jaccard 유사도 계산
 * @param {Array} set1 - 첫 번째 집합
 * @param {Array} set2 - 두 번째 집합
 * @returns {number} - 유사도 (0-1)
 */
const calculateJaccardSimilarity = (set1, set2) => {
  if (!Array.isArray(set1) || !Array.isArray(set2) || 
      set1.length === 0 || set2.length === 0) return 0;
  
  // 대소문자 구분 없이 비교하기 위해 소문자로 변환
  const normalizedSet1 = set1.map(item => typeof item === 'string' ? item.toLowerCase() : item);
  const normalizedSet2 = set2.map(item => typeof item === 'string' ? item.toLowerCase() : item);
  
  // 교집합 크기
  const intersection = normalizedSet1.filter(item => 
    normalizedSet2.some(element => {
      if (typeof item === 'string' && typeof element === 'string') {
        return item === element || item.includes(element) || element.includes(item);
      }
      return item === element;
    })
  ).length;
  
  // 합집합 크기
  const union = new Set([...normalizedSet1, ...normalizedSet2]).size;
  
  return intersection / union;
};

/**
 * 유사한 사용자 찾기
 * @param {string} targetUserId - 대상 사용자 ID
 * @param {Object} targetUserProfile - 대상 사용자 프로필
 * @param {number} limit - 결과 제한 수
 * @returns {Promise<Array>} - 유사 사용자 목록
 */
export const findSimilarUsers = async (targetUserId, targetUserProfile, limit = 5) => {
  if (!targetUserId || !targetUserProfile) {
    throw new Error('유효한 사용자 ID와 프로필이 필요합니다');
  }
  
  try {
    // 캐시 확인
    const cacheKey = `similar_users_${targetUserId}_${limit}`;
    const cachedResults = getCachedRecommendations(cacheKey);
    
    if (cachedResults) {
      return cachedResults;
    }
    
    // 기본 MBTI, 관심사 필요
    if (!targetUserProfile.mbti || !Array.isArray(targetUserProfile.interests)) {
      return { success: false, error: '사용자 프로필 데이터가 불충분합니다', data: [] };
    }
    
    // 유사 사용자 기준 속성
    const { mbti, interests, talents = [] } = targetUserProfile;
    
    // Firestore에서 유사 사용자 검색 
    // (실제 구현에서는 더 복잡한 쿼리 필요)
    const usersRef = collection(db, 'users');
    const userQuery = query(
      usersRef,
      where('mbti', '==', mbti),
      limit(50) // 최대 50명 가져와서 클라이언트에서 추가 필터링
    );
    
    const snapshot = await getDocs(userQuery);
    
    if (snapshot.empty) {
      // 빈 결과 캐싱
      cacheRecommendations(cacheKey, { success: true, data: [] }, CACHE_TTL);
      return { success: true, data: [] };
    }
    
    // 사용자 유사도 계산
    const similarityScores = [];
    
    snapshot.forEach(doc => {
      // 자기 자신 제외
      if (doc.id === targetUserId) return;
      
      const userData = doc.data();
      
      // 관심사 유사도 (Jaccard 유사도)
      const userInterests = Array.isArray(userData.interests) ? userData.interests : [];
      const interestSimilarity = calculateJaccardSimilarity(
        interests, 
        userInterests
      );
      
      // 재능 유사도
      const userTalents = Array.isArray(userData.talents) ? userData.talents : [];
      const talentSimilarity = calculateJaccardSimilarity(
        talents,
        userTalents
      );
      
      // MBTI 유사도 (동일한 유형은 이미 필터링됨)
      const mbtiSimilarity = 1.0;
      
      // 가중치 적용 종합 유사도
      const totalSimilarity = (
        mbtiSimilarity * 0.4 +
        interestSimilarity * 0.4 +
        talentSimilarity * 0.2
      );
      
      // 일정 유사도 이상인 경우만 추가
      if (totalSimilarity > 0.3) {
        similarityScores.push({
          userId: doc.id,
          similarity: parseFloat(totalSimilarity.toFixed(2)),
          mbtiSimilarity,
          interestSimilarity,
          talentSimilarity
        });
      }
    });
    
    // 유사도 기준 정렬
    const sortedUsers = similarityScores.sort((a, b) => b.similarity - a.similarity);
    const result = { 
      success: true,
      data: sortedUsers.slice(0, limit)
    };
    
    // 결과 캐싱
    cacheRecommendations(cacheKey, result, CACHE_TTL);
    
    return result;
  } catch (error) {
    console.error('유사 사용자 검색 오류:', error);
    return { 
      success: false, 
      error: error.message,
      data: []
    };
  }
};

/**
 * 유사 사용자 기반 가중치 추천
 * @param {string} userId - 사용자 ID
 * @param {Object} userProfile - 사용자 프로필
 * @returns {Promise<Object>} - 추천된 가중치
 */
export const getCollaborativeWeights = async (userId, userProfile) => {
  try {
    // 캐시 확인
    const cacheKey = `collaborative_weights_${userId}`;
    const cachedWeights = getCachedRecommendations(cacheKey);
    
    if (cachedWeights) {
      return cachedWeights;
    }
    
    // 유사 사용자 찾기
    const similarUsersResult = await findSimilarUsers(userId, userProfile, 10);
    
    if (!similarUsersResult.success || similarUsersResult.data.length === 0) {
      // 유사 사용자 없음, 사용자 개인 가중치 사용
      const profile = await getUserLearningProfile(userId);
      const personalResult = {
        weights: profile.weights,
        source: 'personal'
      };
      
      cacheRecommendations(cacheKey, personalResult, CACHE_TTL);
      return personalResult;
    }
    
    // 상위 5명의 유사 사용자만 활용
    const topSimilarUsers = similarUsersResult.data.slice(0, 5);
    
    // 각 유사 사용자의 학습 프로필 가져오기
    const userProfiles = await Promise.all(
      topSimilarUsers.map(async (user) => {
        try {
          const profile = await getUserLearningProfile(user.userId);
          return {
            ...user,
            weights: profile.weights,
            confidence: profile.confidence || 0
          };
        } catch (error) {
          console.warn(`사용자 ${user.userId} 프로필 로드 실패:`, error);
          return null;
        }
      })
    );
    
    // 유효한 프로필만 필터링
    const validProfiles = userProfiles.filter(profile => 
      profile !== null && profile.weights
    );
    
    if (validProfiles.length === 0) {
      // 유효한 유사 사용자 없음
      const profile = await getUserLearningProfile(userId);
      const fallbackResult = {
        weights: profile.weights,
        source: 'personal'
      };
      
      cacheRecommendations(cacheKey, fallbackResult, CACHE_TTL);
      return fallbackResult;
    }
    
    // 종합 가중치 계산 (유사도 및 신뢰도 고려)
    const combinedWeights = {
      mbti: 0,
      interests: 0,
      talents: 0,
      mood: 0,
      location: 0
    };
    
    // 유사도 및 신뢰도의 가중 합
    let totalWeightFactor = 0;
    
    validProfiles.forEach(profile => {
      // 유사도와 신뢰도를 결합한 가중치 요소
      const weightFactor = profile.similarity * (1 + Math.min(1, profile.confidence / 50));
      totalWeightFactor += weightFactor;
      
      // 가중 평균에 기여
      Object.keys(combinedWeights).forEach(key => {
        combinedWeights[key] += profile.weights[key] * weightFactor;
      });
    });
    
    // 정규화
    if (totalWeightFactor > 0) {
      Object.keys(combinedWeights).forEach(key => {
        combinedWeights[key] /= totalWeightFactor;
      });
    }
    
    // 사용자 개인 가중치 가져오기
    const personalProfile = await getUserLearningProfile(userId);
    
    // 개인 가중치와 협업 가중치 혼합 (7:3 비율)
    const personalRatio = 0.7;
    const collaborativeRatio = 0.3;
    
    const finalWeights = {};
    Object.keys(combinedWeights).forEach(key => {
      finalWeights[key] = (
        personalProfile.weights[key] * personalRatio +
        combinedWeights[key] * collaborativeRatio
      );
    });
    
    // 최종 가중치 정규화
    const normalizedWeights = normalizeWeights(finalWeights);
    
    const collaborativeResult = {
      weights: normalizedWeights,
      personalWeights: personalProfile.weights,
      collaborativeWeights: combinedWeights,
      source: 'collaborative',
      similarUsers: validProfiles.length
    };
    
    // 결과 캐싱
    cacheRecommendations(cacheKey, collaborativeResult, CACHE_TTL / 2); // 협업 가중치는 더 짧은 캐시 기간
    
    return collaborativeResult;
  } catch (error) {
    console.error('협업 가중치 가져오기 오류:', error);
    
    // 오류 시 기본 개인 가중치 사용
    const profile = await getUserLearningProfile(userId);
    return {
      weights: profile.weights,
      source: 'personal',
      error: error.message
    };
  }
};
  
  /**
   * 사용자의 피드백 패턴 분석
   * @param {string} userId - 사용자 ID
   * @param {number} limit - 분석할 피드백 수 제한
   * @returns {Promise<Object>} - 피드백 패턴 분석 결과
   */
  export const analyzeFeedbackPatterns = async (userId, limit = 100) => {
    try {
      if (!userId) {
        throw new Error('사용자 ID가 필요합니다');
      }
      
      // 캐시 확인
      const cacheKey = `feedback_patterns_${userId}_${limit}`;
      const cachedPatterns = getCachedRecommendations(cacheKey);
      
      if (cachedPatterns) {
        return cachedPatterns;
      }
      
      // 피드백 데이터 가져오기
      const feedbacksRef = collection(db, 'feedback');
      const feedbackQuery = query(
        feedbacksRef,
        where('userId', '==', userId),
        limit(limit)
      );
      
      const snapshot = await getDocs(feedbackQuery);
      
      if (snapshot.empty) {
        return {
          success: true,
          patterns: {},
          dataPoints: 0
        };
      }
      
      // 피드백 데이터 수집
      const feedbacks = [];
      snapshot.forEach(doc => {
        feedbacks.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        });
      });
      
      // 카테고리별 선호도 분석
      const categoryPreferences = {};
      // 태그별 빈도 분석
      const tagFrequencies = {};
      // 요일 및 시간대 분석
      const timePatterns = {
        hourDistribution: {},
        dayOfWeek: {
          counts: {
            weekdays: 0, // 월-금
            weekend: 0   // 토-일
          },
          average: {
            weekdays: 0,
            weekend: 0
          }
        }
      };
      
      // 각 피드백에 대한 장소 정보 가져오기
      const placePromises = feedbacks.map(async feedback => {
        if (!feedback.placeId) return null;
        
        try {
          const placeDoc = await getDoc(doc(db, 'places', feedback.placeId));
          if (!placeDoc.exists()) return null;
          
          return {
            id: placeDoc.id,
            ...placeDoc.data()
          };
        } catch (error) {
          console.warn(`장소 정보 가져오기 실패: ${feedback.placeId}`, error);
          return null;
        }
      });
      
      const places = await Promise.all(placePromises);
      
      // 피드백과 장소 정보 결합 및 분석
      feedbacks.forEach((feedback, index) => {
        const place = places[index];
        if (!place) return;
        
        // 카테고리 분석
        const category = place.category || 'unknown';
        if (!categoryPreferences[category]) {
          categoryPreferences[category] = {
            count: 0,
            totalRating: 0,
            avgRating: 0
          };
        }
        
        categoryPreferences[category].count++;
        categoryPreferences[category].totalRating += feedback.relevanceRating || 3;
        categoryPreferences[category].avgRating = 
          categoryPreferences[category].totalRating / categoryPreferences[category].count;
        
        // 태그 분석
        if (feedback.tags && Array.isArray(feedback.tags)) {
          feedback.tags.forEach(tag => {
            tagFrequencies[tag] = (tagFrequencies[tag] || 0) + 1;
          });
        }
        
        // 시간대 분석
        if (feedback.timestamp) {
          const timestamp = new Date(feedback.timestamp);
          const hour = timestamp.getHours();
          const day = timestamp.getDay(); // 0 (일) - 6 (토)
          const isWeekend = day === 0 || day === 6;
          
          // 시간대별 분포
          timePatterns.hourDistribution[hour] = (timePatterns.hourDistribution[hour] || 0) + 1;
          
          // 주중/주말 분포
          if (isWeekend) {
            timePatterns.dayOfWeek.counts.weekend++;
            timePatterns.dayOfWeek.average.weekend += feedback.relevanceRating || 3;
          } else {
            timePatterns.dayOfWeek.counts.weekdays++;
            timePatterns.dayOfWeek.average.weekdays += feedback.relevanceRating || 3;
          }
        }
      });
      
      // 평균 계산
      if (timePatterns.dayOfWeek.counts.weekdays > 0) {
        timePatterns.dayOfWeek.average.weekdays /= timePatterns.dayOfWeek.counts.weekdays;
      }
      
      if (timePatterns.dayOfWeek.counts.weekend > 0) {
        timePatterns.dayOfWeek.average.weekend /= timePatterns.dayOfWeek.counts.weekend;
      }
      
      // 재방문 패턴 분석
      const visitedPlaces = {};
      feedbacks.forEach(feedback => {
        if (feedback.placeId) {
          visitedPlaces[feedback.placeId] = (visitedPlaces[feedback.placeId] || 0) + 1;
        }
      });
      
      const revisitCounts = Object.values(visitedPlaces);
      const totalPlaces = revisitCounts.length;
      const multiplePlaceVisits = revisitCounts.filter(count => count > 1).length;
      const revisitRatio = totalPlaces > 0 ? multiplePlaceVisits / totalPlaces : 0;
      
      // 재방문 패턴 결정
      let revisitPattern = 'neutral';
      if (revisitRatio > 0.3) revisitPattern = 'high';
      else if (revisitRatio < 0.1) revisitPattern = 'low';
      
      // 결과 생성
      const result = {
        success: true,
        patterns: {
          categoryPatterns: {
            categories: categoryPreferences,
            topCategories: Object.entries(categoryPreferences)
              .sort((a, b) => b[1].avgRating - a[1].avgRating)
              .slice(0, 3)
              .map(([category, data]) => ({
                category,
                avgRating: parseFloat(data.avgRating.toFixed(2)),
                count: data.count
              }))
          },
          tagPatterns: {
            tags: tagFrequencies,
            topTags: Object.entries(tagFrequencies)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([tag, count]) => ({ tag, count }))
          },
          timePatterns,
          revisitPatterns: {
            revisitRatio: parseFloat(revisitRatio.toFixed(2)),
            revisitPattern,
            uniquePlaces: totalPlaces,
            revisitedPlaces: multiplePlaceVisits
          }
        },
        dataPoints: feedbacks.length
      };
      
      // 결과 캐싱
      cacheRecommendations(cacheKey, result, CACHE_TTL);
      
      return result;
    } catch (error) {
      console.error('피드백 패턴 분석 오류:', error);
      return {
        success: false,
        error: error.message,
        patterns: {},
        dataPoints: 0
      };
    }
  };
  
  /**
   * 맥락 정보를 고려한 가중치 조정
   * @param {string} userId - 사용자 ID
   * @param {Object} contextData - 현재 맥락 정보 (시간, 위치 등)
   * @param {Object} baseWeights - 기본 가중치
   * @returns {Promise<Object>} - 맥락 조정된 가중치
   */
  export const getContextAwareWeights = async (userId, contextData, baseWeights = null) => {
    try {
      // 기본 가중치가 없으면 가져오기
      const weights = baseWeights || (await getUserLearningProfile(userId)).weights;
      
      // 맥락 정보가 없으면 원래 가중치 반환
      if (!contextData) {
        return { weights, contextApplied: false };
      }
      
      // 조정된 가중치 복사
      const adjustedWeights = { ...weights };
      const adjustmentFactors = {};
      
      // 시간 기반 조정
      if (contextData.time) {
        const hour = new Date(contextData.time).getHours();
        const day = new Date(contextData.time).getDay();
        const isWeekend = (day === 0 || day === 6);
        
        // 사용자 패턴 분석
        const patterns = await analyzeFeedbackPatterns(userId);
        
        if (patterns.success && patterns.dataPoints > 5) {
          const { timePatterns } = patterns.patterns;
          
          // 주중/주말 선호도에 따른 조정
          if (isWeekend && timePatterns.dayOfWeek.average.weekend > timePatterns.dayOfWeek.average.weekdays) {
            // 주말에 피드백이 더 좋았으면 위치 가중치 증가 (사람들이 주말에 더 멀리 이동하는 경향)
            adjustedWeights.location *= 1.2;
            adjustmentFactors.weekend = 1.2;
          } else if (!isWeekend && timePatterns.dayOfWeek.average.weekdays > timePatterns.dayOfWeek.average.weekend) {
            // 주중에 피드백이 더 좋았으면 위치 가중치 감소 (가까운 곳 선호)
            adjustedWeights.location *= 0.9;
            adjustmentFactors.weekday = 0.9;
          }
          
          // 시간대별 선호도
          const hourPreference = timePatterns.hourDistribution[hour] || 0;
          const totalFeedbacks = patterns.dataPoints;
          
          if (hourPreference > 0 && totalFeedbacks > 0) {
            const hourRatio = hourPreference / totalFeedbacks;
            
            // 특정 시간대에 피드백이 많으면 해당 패턴 강화
            if (hourRatio > 0.2) { // 20% 이상의 피드백이 이 시간대
              // 아침(6-10): MBTI/관심사 중요
              if (hour >= 6 && hour <= 10) {
                adjustedWeights.mbti *= 1.1;
                adjustedWeights.interests *= 1.1;
                adjustmentFactors.morning = 1.1;
              }
              // 점심(11-14): 위치 중요
              else if (hour >= 11 && hour <= 14) {
                adjustedWeights.location *= 1.2;
                adjustmentFactors.lunch = 1.2;
              }
              // 저녁(17-22): 기분 중요
              else if (hour >= 17 && hour <= 22) {
                adjustedWeights.mood *= 1.2;
                adjustmentFactors.evening = 1.2;
              }
              // 밤(23-5): 관심사 중요
              else {
                adjustedWeights.interests *= 1.15;
                adjustmentFactors.night = 1.15;
              }
            }
          }
        }
      }
      
      // 위치 기반 조정
      if (contextData.location) {
        // 주변에 장소가 많은 번화가인 경우
        if (contextData.location.densityType === 'high') {
          // 위치 가중치 감소 (더 개인화된 추천 중요)
          adjustedWeights.location *= 0.8;
          adjustedWeights.mbti *= 1.1;
          adjustmentFactors.highDensity = 0.8;
        }
        // 교외 지역인 경우
        else if (contextData.location.densityType === 'low') {
          // 위치 가중치 증가 (가능한 옵션이 적어 거리가 중요)
          adjustedWeights.location *= 1.3;
          adjustmentFactors.lowDensity = 1.3;
        }
      }
      
      // 현재 감정 기반 조정
      if (contextData.mood) {
        const moodValue = contextData.mood.mood;
        const intensity = contextData.mood.intensity || 3;
        
        // 감정 강도가 높은 경우 (4-5)
        if (intensity >= 4) {
          // 긍정적 감정 (기쁨, 설렘 등)
          if (['기쁨', '설렘', '행복'].includes(moodValue)) {
            adjustedWeights.mood *= 1.2;
            adjustmentFactors.positiveMood = 1.2;
          }
          // 부정적 감정 (스트레스, 우울 등)
          else if (['스트레스', '우울', '불안', '화남'].includes(moodValue)) {
            adjustedWeights.mood *= 1.3; // 더 중요하게 반영
            adjustmentFactors.negativeMood = 1.3;
          }
        }
      }
      
      // 가중치 정규화 (합이 1이 되도록)
      const normalizedWeights = normalizeWeights(adjustedWeights);
      
      return {
        weights: normalizedWeights,
        originalWeights: weights,
        contextApplied: true,
        adjustmentFactors
      };
    } catch (error) {
      console.error('맥락 가중치 조정 오류:', error);
      return {
        weights: baseWeights || (await getUserLearningProfile(userId)).weights,
        contextApplied: false,
        error: error.message
      };
    }
  };
  
  // 모듈 내보내기
  const weightLearningSystem = {
    getUserLearningProfile,
    saveUserLearningProfile,
    adjustUserWeights,
    calculateAdjustmentDirection,
    normalizeWeights,
    analyzeWeightHistory,
    findSimilarUsers,
    getCollaborativeWeights,
    analyzeFeedbackPatterns,
    getContextAwareWeights
  };
  
  export default weightLearningSystem; 
