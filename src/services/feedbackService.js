import { db } from '../config/firebase';
import { serverTimestamp, arrayUnion } from 'firebase/firestore';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getCachedFeedbacks, cacheFeedbacks } from './cacheService';
import saveService from './saveService';

/**
 * 사용자의 장소 피드백을 저장하는 함수
 * @param {string} userId - 사용자 ID
 * @param {string} placeId - 장소 ID
 * @param {Object} feedbackData - 피드백 데이터
 * @param {number} feedbackData.relevanceRating - 적합도 평가 (1-5)
 * @param {string} feedbackData.comment - 텍스트 피드백 (선택적)
 * @param {Array<string>} feedbackData.tags - 선택한 태그들 (선택적)
 * @returns {Promise} - 피드백 저장 결과
 */
export const saveFeedback = async (userId, placeId, feedbackData) => {
  try {
    // 입력값 검증
    if (!userId || !placeId) {
      throw new Error('유효하지 않은 사용자 ID 또는 장소 ID');
    }
    
    if (!feedbackData || typeof feedbackData !== 'object') {
      throw new Error('유효하지 않은 피드백 데이터');
    }
    
    // 필수 데이터 확인
    if (typeof feedbackData.relevanceRating !== 'number' || 
        feedbackData.relevanceRating < 1 || 
        feedbackData.relevanceRating > 5) {
      throw new Error('적합도 평가는 1-5 사이의 숫자여야 합니다');
    }

    // 피드백 문서 생성
    const feedbackRef = db.collection('feedback').doc();
    
    await feedbackRef.set({
      userId,
      placeId,
      relevanceRating: feedbackData.relevanceRating,
      comment: feedbackData.comment || '',
      tags: feedbackData.tags || [],
      timestamp: serverTimestamp()
    });

    // 낮은 평가 (1-2점)인 경우 userPreferences에 해당 장소를 낮은 매칭으로 기록
    if (feedbackData.relevanceRating <= 2) {
      const userPrefRef = db.collection('userPreferences').doc(userId);
      
      // userPreferences 문서가 없는 경우 생성
      await userPrefRef.set(
        {
          negativeMatches: arrayUnion(placeId),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    // 장소 문서에 평균 평점 업데이트 로직
    await updatePlaceRating(placeId, userId, feedbackData.relevanceRating);
    
    // 피드백 캐시 무효화
    clearUserFeedbackCache(userId);
    
    return {
      success: true,
      data: {
        id: feedbackRef.id,
        ...feedbackData,
        userId,
        placeId
      }
    };
  } catch (error) {
    console.error('피드백 저장 오류:', error);
    return {
      success: false,
      error: error.message || '피드백 저장 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 장소 피드백을 업데이트하는 함수
 * @param {string} userId - 사용자 ID
 * @param {string} placeId - 장소 ID
 * @param {string} feedbackId - 피드백 ID
 * @param {Object} feedbackData - 피드백 데이터
 * @param {number} feedbackData.relevanceRating - 적합도 평가 (1-5)
 * @param {string} feedbackData.comment - 텍스트 피드백 (선택적)
 * @param {Array<string>} feedbackData.tags - 선택한 태그들 (선택적)
 * @returns {Promise} - 피드백 업데이트 결과
 */
export const updateFeedback = async (userId, placeId, feedbackId, feedbackData) => {
  try {
    // 입력 검증
    if (!userId || !placeId || !feedbackId) {
      throw new Error('유효하지 않은 사용자 ID, 장소 ID 또는 피드백 ID');
    }
    
    // 기존 피드백 조회
    const existingFeedbackResult = await getUserFeedbackForPlace(placeId, userId);
    const existingFeedback = existingFeedbackResult?.data;
    const oldRating = existingFeedback?.relevanceRating || 0;
    const newRating = feedbackData.relevanceRating || 0;
    
    // Firebase에 피드백 업데이트
    const feedbackRef = doc(db, 'feedback', feedbackId);
    
    // 피드백 문서가 존재하는지 확인
    const feedbackDoc = await getDoc(feedbackRef);
    if (!feedbackDoc.exists()) {
      throw new Error('피드백을 찾을 수 없습니다');
    }
    
    // 권한 검증 - 자신의 피드백만 수정 가능
    const existingData = feedbackDoc.data();
    if (existingData.userId !== userId) {
      throw new Error('이 피드백을 수정할 권한이 없습니다');
    }
    
    // 업데이트 데이터 준비
    const updateData = {
      relevanceRating: feedbackData.relevanceRating,
      comment: feedbackData.comment || '',
      tags: feedbackData.tags || [],
      updatedAt: serverTimestamp()
    };
    
    // Firestore 업데이트
    await updateDoc(feedbackRef, updateData);
    
    // 평점이 변경된 경우 장소 평점 업데이트
    if (oldRating !== newRating) {
      await saveService.updatePlaceRatingOnChange(placeId, userId, oldRating, newRating);
    }
    
    // 성공 응답
    return {
      success: true,
      data: {
        id: feedbackId,
        ...feedbackData,
        updatedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Error updating feedback:', error);
    return {
      success: false,
      error: error.message || '피드백 업데이트 중 오류가 발생했습니다'
    };
  }
};

/**
 * 특정 장소에 대한 특정 사용자의 피드백을 조회하는 함수
 * @param {string} placeId - 장소 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} - 피드백 데이터 또는 null
 */
export const getUserFeedbackForPlace = async (placeId, userId) => {
  try {
    // 입력값 검증
    if (!placeId || !userId) {
      console.warn('피드백 조회: 유효하지 않은 장소 ID 또는 사용자 ID');
      return {
        success: false,
        error: '유효하지 않은 장소 ID 또는 사용자 ID',
        data: null
      };
    }
    
    // 캐시 확인
    const cacheKey = `user_feedback_${userId}_${placeId}`;
    const cachedFeedback = getCachedFeedbacks(cacheKey);
    if (cachedFeedback) {
      return {
        success: true,
        data: cachedFeedback,
        fromCache: true
      };
    }
    
    const q = query(
      collection(db, 'feedback'),
      where('placeId', '==', placeId),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        success: true,
        data: null
      };
    }
    
    const doc = querySnapshot.docs[0];
    const feedback = {
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    };
    
    // 결과 캐싱
    cacheFeedbacks(cacheKey, feedback);
    
    return {
      success: true,
      data: feedback
    };
  } catch (error) {
    console.error('피드백 조회 오류:', error);
    return {
      success: false,
      error: error.message || '피드백 조회 중 오류가 발생했습니다.',
      data: null
    };
  }
};

/**
 * 특정 사용자의 모든 피드백을 조회하는 함수
 * @param {string} userId - 사용자 ID
 * @param {Object} options - 옵션 (limit, useCache 등)
 * @returns {Promise<Array>} - 피드백 목록
 */
export const getFeedbacksByUser = async (userId, options = {}) => {
  try {
    if (!userId) {
      console.warn('사용자 피드백 조회: 유효하지 않은 사용자 ID');
      return {
        success: false,
        error: '유효하지 않은 사용자 ID',
        data: []
      };
    }
    
    const maxResults = options.limit || 100;
    const useCache = options.useCache !== false;
    
    // 캐시 확인
    const cacheKey = `all_feedbacks_${userId}_${maxResults}`;
    if (useCache) {
      const cachedFeedbacks = getCachedFeedbacks(cacheKey);
      if (cachedFeedbacks) {
        return {
          success: true,
          data: cachedFeedbacks,
          fromCache: true
        };
      }
    }
    
    const q = query(
      collection(db, 'feedback'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        success: true,
        data: []
      };
    }
    
    const feedbacks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));
    
    // 결과 캐싱
    if (useCache) {
      cacheFeedbacks(cacheKey, feedbacks);
    }
    
    return {
      success: true,
      data: feedbacks
    };
  } catch (error) {
    console.error('사용자 피드백 조회 오류:', error);
    return {
      success: false,
      error: error.message || '사용자 피드백 조회 중 오류가 발생했습니다.',
      data: []
    };
  }
};

/**
 * 특정 장소에 대한 모든 피드백을 조회하는 함수
 * @param {string} placeId - 장소 ID
 * @param {Object} options - 옵션 (limit, useCache 등)
 * @returns {Promise<Array>} - 피드백 목록
 */
export const getFeedbacksByPlace = async (placeId, options = {}) => {
  try {
    if (!placeId) {
      console.warn('장소 피드백 조회: 유효하지 않은 장소 ID');
      return {
        success: false,
        error: '유효하지 않은 장소 ID',
        data: []
      };
    }
    
    const maxResults = options.limit || 50;
    const useCache = options.useCache !== false;
    
    // 캐시 확인
    const cacheKey = `place_feedbacks_${placeId}_${maxResults}`;
    if (useCache) {
      const cachedFeedbacks = getCachedFeedbacks(cacheKey);
      if (cachedFeedbacks) {
        return {
          success: true,
          data: cachedFeedbacks,
          fromCache: true
        };
      }
    }
    
    const q = query(
      collection(db, 'feedback'),
      where('placeId', '==', placeId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        success: true,
        data: []
      };
    }
    
    const feedbacks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));
    
    // 결과 캐싱
    if (useCache) {
      cacheFeedbacks(cacheKey, feedbacks);
    }
    
    return {
      success: true,
      data: feedbacks
    };
  } catch (error) {
    console.error('장소 피드백 조회 오류:', error);
    return {
      success: false,
      error: error.message || '장소 피드백 조회 중 오류가 발생했습니다.',
      data: []
    };
  }
};

/**
 * 피드백 기반 학습 데이터 집계 및 분석
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 학습 데이터 및 분석 결과
 */
export const analyzeFeedbackData = async (userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        error: '유효하지 않은 사용자 ID',
        data: { hasData: false }
      };
    }
    
    // 사용자의 모든 피드백 조회
    const feedbackResult = await getFeedbacksByUser(userId, { limit: 100 });
    
    if (!feedbackResult.success || !feedbackResult.data || feedbackResult.data.length === 0) {
      return {
        success: true,
        data: {
          hasData: false,
          message: '분석할 피드백 데이터가 충분하지 않습니다.'
        }
      };
    }
    
    const feedbacks = feedbackResult.data;
    
    // 카테고리별 선호도
    const categoryPreferences = {};
    // 태그별 빈도
    const tagFrequency = {};
    // 평점 분포
    const ratingDistribution = {};
    // 시간대별 피드백 패턴
    const timePatterns = {};
    
    // 피드백 분석
    for (const feedback of feedbacks) {
      // 피드백에 해당하는 장소 정보 필요
      const placeInfo = await getPlaceBasicInfo(feedback.placeId);
      
      if (placeInfo) {
        // 카테고리별 선호도
        const category = placeInfo.category || 'unknown';
        if (!categoryPreferences[category]) {
          categoryPreferences[category] = {
            count: 0,
            totalRating: 0,
            avgRating: 0
          };
        }
        categoryPreferences[category].count++;
        categoryPreferences[category].totalRating += feedback.relevanceRating || 0;
        categoryPreferences[category].avgRating = 
          categoryPreferences[category].totalRating / categoryPreferences[category].count;
      }
      
      // 태그 빈도 분석
      if (feedback.tags && Array.isArray(feedback.tags)) {
        feedback.tags.forEach(tag => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        });
      }
      
      // 평점 분포
      const rating = feedback.relevanceRating || 0;
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      
      // 시간대별 패턴
      if (feedback.timestamp) {
        const hour = new Date(feedback.timestamp).getHours();
        const timeGroup = Math.floor(hour / 6); // 0-5, 6-11, 12-17, 18-23
        const timeLabels = ['새벽', '오전', '오후', '저녁'];
        const timeLabel = timeLabels[timeGroup];
        
        timePatterns[timeLabel] = (timePatterns[timeLabel] || 0) + 1;
      }
    }
    
    // 분석 결과
    const analysisResult = {
      feedbackCount: feedbacks.length,
      categoryPreferences,
      tagFrequency,
      ratingDistribution,
      timePatterns,
      topTags: Object.entries(tagFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count })),
      favoriteCategories: Object.entries(categoryPreferences)
        .sort((a, b) => b[1].avgRating - a[1].avgRating)
        .slice(0, 3)
        .map(([category, data]) => ({ 
          category, 
          avgRating: data.avgRating, 
          count: data.count 
        })),
      preferredTimeOfDay: Object.entries(timePatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([time, count]) => ({ time, count }))
    };
    
    return {
      success: true,
      data: {
        hasData: true,
        analysis: analysisResult
      }
    };
  } catch (error) {
    console.error('피드백 분석 오류:', error);
    return {
      success: false,
      error: error.message || '피드백 데이터 분석 중 오류가 발생했습니다.',
      data: {
        hasData: false
      }
    };
  }
};

/**
 * 특정 장소의 평점을 업데이트하는 함수
 * @param {string} placeId - 장소 ID
 * @param {string} userId - 사용자 ID
 * @param {number} rating - 새 평점
 * @returns {Promise} - 업데이트 결과
 */
const updatePlaceRating = async (placeId, userId, rating) => {
  try {
    // 트랜잭션을 사용하여 평균 평점 업데이트
    return await db.runTransaction(async (transaction) => {
      const placeRef = db.collection('places').doc(placeId);
      const placeDoc = await transaction.get(placeRef);
      
      if (!placeDoc.exists) {
        throw new Error('해당 장소가 존재하지 않습니다');
      }
      
      const placeData = placeDoc.data();
      const userMbti = await getUserMbti(userId);
      
      // 현재 평균 평점과 리뷰 수 가져오기
      const currentRating = placeData.averageRating?.overall || 0;
      const currentCount = placeData.reviewCount || 0;
      
      // 새 평균 평점 계산
      const newCount = currentCount + 1;
      const newRating = (currentRating * currentCount + rating) / newCount;
      
      // 업데이트할 데이터
      const updateData = {
        'averageRating.overall': newRating,
        reviewCount: newCount,
      };
      
      // MBTI별 평점도 업데이트
      if (userMbti) {
        const mbtiRatingKey = `averageRating.byMbtiType.${userMbti}`;
        const currentMbtiRating = placeData.averageRating?.byMbtiType?.[userMbti] || 0;
        const currentMbtiCount = placeData.mbtiReviewCount?.[userMbti] || 0;
        
        const newMbtiCount = currentMbtiCount + 1;
        const newMbtiRating = (currentMbtiRating * currentMbtiCount + rating) / newMbtiCount;
        
        updateData[mbtiRatingKey] = newMbtiRating;
        updateData[`mbtiReviewCount.${userMbti}`] = newMbtiCount;
      }
      
      // 트랜잭션으로 업데이트
      transaction.update(placeRef, updateData);
    });
  } catch (error) {
    console.error('평점 업데이트 오류:', error);
    // 이 오류가 발생해도 피드백 저장은 완료
    console.warn('평점 업데이트 실패했지만 피드백은 저장됨');
  }
};

/**
 * 평점 변경 시 장소의 평균 평점을 업데이트하는 함수
 * @param {string} placeId - 장소 ID
 * @param {string} userId - 사용자 ID
 * @param {number} oldRating - 기존 평점
 * @param {number} newRating - 새 평점
 * @returns {Promise} - 업데이트 결과
 */
const updatePlaceRatingOnChange = async (placeId, userId, oldRating, newRating) => {
  try {
    // 트랜잭션을 사용하여 평균 평점 업데이트
    return await db.runTransaction(async (transaction) => {
      const placeRef = db.collection('places').doc(placeId);
      const placeDoc = await transaction.get(placeRef);
      
      if (!placeDoc.exists) {
        throw new Error('해당 장소가 존재하지 않습니다');
      }
      
      const placeData = placeDoc.data();
      const userMbti = await getUserMbti(userId);
      
      // 현재 평균 평점과 리뷰 수 가져오기
      const currentRating = placeData.averageRating?.overall || 0;
      const currentCount = placeData.reviewCount || 0;
      
      if (currentCount <= 0) {
        console.warn('장소에 리뷰가 없지만 업데이트 요청됨');
        return;
      }
      
      // 새 평균 평점 계산 (기존 평점 제외, 새 평점 포함)
      const totalPoints = currentRating * currentCount;
      const newTotalPoints = totalPoints - oldRating + newRating;
      const updatedRating = newTotalPoints / currentCount; // newRating에서 변수명 변경
      
      // 업데이트할 데이터
      const updateData = {
        'averageRating.overall': updatedRating // newRating에서 updatedRating으로 변경
      };
      
      // MBTI별 평점도 업데이트
      if (userMbti) {
        const mbtiRatingKey = `averageRating.byMbtiType.${userMbti}`;
        const currentMbtiRating = placeData.averageRating?.byMbtiType?.[userMbti] || 0;
        const currentMbtiCount = placeData.mbtiReviewCount?.[userMbti] || 0;
        
        if (currentMbtiCount > 0) {
          const mbtiTotalPoints = currentMbtiRating * currentMbtiCount;
          const newMbtiTotalPoints = mbtiTotalPoints - oldRating + newRating;
          const newMbtiRating = newMbtiTotalPoints / currentMbtiCount;
          
          updateData[mbtiRatingKey] = newMbtiRating;
        }
      }
      
      // 트랜잭션으로 업데이트
      transaction.update(placeRef, updateData);
    });
  } catch (error) {
    console.error('평점 변경 업데이트 오류:', error);
    // 이 오류가 발생해도 피드백 업데이트는 완료
    console.warn('평점 변경 업데이트 실패했지만 피드백은 업데이트됨');
  }
};

/**
 * 사용자의 MBTI 정보를 가져오는 함수
 * @param {string} userId - 사용자 ID
 * @returns {Promise<string|null>} - MBTI 또는 null
 */
const getUserMbti = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().mbti || null;
    }
    return null;
  } catch (error) {
    console.error('사용자 MBTI 조회 오류:', error);
    return null;
  }
};

/**
 * 장소의 기본 정보만 가져오는 함수 (카테고리, 이름 등)
 * @param {string} placeId - 장소 ID
 * @returns {Promise<Object|null>} - 장소 기본 정보 또는 null
 */
const getPlaceBasicInfo = async (placeId) => {
  try {
    const placeDoc = await db.collection('places').doc(placeId).get();
    if (placeDoc.exists) {
      const placeData = placeDoc.data();
      return {
        id: placeDoc.id,
        name: placeData.name,
        category: placeData.category,
        subCategory: placeData.subCategory,
        region: placeData.region,
        subRegion: placeData.subRegion
      };
    }
    return null;
  } catch (error) {
    console.error('장소 기본 정보 조회 오류:', error);
    return null;
  }
};

/**
 * 사용자 피드백 캐시 무효화
 * @param {string} userId - 사용자 ID
 */
const clearUserFeedbackCache = (userId) => {
  // 캐시 서비스에 구현된 캐시 무효화 함수 필요
  try {
    // userCacheClear 함수가 cacheService에 구현되어 있어야 함
    const cacheService = require('./cacheService');
    if (cacheService && cacheService.clearCacheByType) {
      // 사용자 관련 피드백 캐시 무효화
      cacheService.clearCacheByType(`feedback_${userId}`);
    }
  } catch (error) {
    console.warn('피드백 캐시 무효화 오류:', error);
  }
};

// 기본 객체로 내보내기
const feedbackService = {
  saveFeedback,
  updateFeedback,
  getUserFeedbackForPlace,
  getFeedbacksByUser,
  getFeedbacksByPlace,
  analyzeFeedbackData,
  // Add the previously unused function to exports
  updatePlaceRatingOnChange 
};

export default feedbackService;
