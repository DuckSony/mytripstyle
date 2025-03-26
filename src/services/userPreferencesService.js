/**
 * userPreferencesService.js
 * 
 * 사용자 선호도 및 학습 데이터를 관리하는 서비스
 * Firebase와 연동하여 사용자별 가중치, 행동 패턴, 선호도 정보를 저장하고 로드합니다.
 */

import { db, serverTimestamp } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getDefaultWeights } from '../utils/userBehaviorAnalytics';

// 캐싱을 위한 메모리 저장소
const userPreferencesCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30분 캐시 유효 기간

/**
 * 사용자 학습 프로필 및 선호도 정보 가져오기
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} - 학습 프로필 데이터
 */
export const getUserPreferences = async (userId) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다');
    }
    
    // 캐시 확인
    const cacheKey = `user_preferences_${userId}`;
    const cachedData = userPreferencesCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
      console.log(`[UserPreferences] ${userId} 사용자 캐시 데이터 사용`);
      return cachedData.data;
    }
    
    try {
      // Firestore에서 사용자 선호도 정보 가져오기
      const preferencesRef = doc(db, 'userPreferences', userId);
      const preferencesDoc = await getDoc(preferencesRef);
      
      // 기본 값 설정
      const defaultPreferences = {
        weights: getDefaultWeights(),
        learningRate: 0.05,
        confidence: 0,
        history: [],
        contextPreferences: {
          timeImportance: 0.5,
          weatherImportance: 0.3,
          moodImportance: 0.7,
          travelDistance: 5 // km
        },
        algorithmVersion: 'standard', // 'standard', 'enhanced', 'advanced'
        lastUpdated: new Date()
      };
      
      let preferences;
      
      if (preferencesDoc.exists()) {
        // 문서가 존재하면 데이터 변환 및 기본값 병합
        const data = preferencesDoc.data();
        
        // 날짜 필드 변환
        const lastUpdated = data.lastUpdated?.toDate?.() || new Date();
        
        preferences = {
          ...defaultPreferences,
          ...data,
          lastUpdated
        };
        
        // 필수 필드 검증
        if (!preferences.weights) {
          preferences.weights = defaultPreferences.weights;
        }
        
        // 사용자 행동 패턴 데이터 가져오기
        const behaviorPatternsRef = doc(db, 'userBehaviorPatterns', userId);
        const behaviorDoc = await getDoc(behaviorPatternsRef);
        
        if (behaviorDoc.exists()) {
          preferences.behaviorPatterns = behaviorDoc.data();
        }
      } else {
        // 문서가 없으면 기본 데이터 생성
        preferences = { ...defaultPreferences };
        
        // 기본 선호도 저장 (필요시)
        await setDoc(preferencesRef, {
          weights: preferences.weights,
          learningRate: preferences.learningRate,
          contextPreferences: preferences.contextPreferences,
          algorithmVersion: preferences.algorithmVersion,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
      
      // 캐시에 저장
      userPreferencesCache.set(cacheKey, {
        data: preferences,
        timestamp: Date.now()
      });
      
      return preferences;
    } catch (error) {
      console.error('[UserPreferences] 선호도 정보 가져오기 오류:', error);
      
      // 오류 발생 시 기본값 반환
      return {
        weights: getDefaultWeights(),
        learningRate: 0.05,
        confidence: 0,
        history: [],
        lastUpdated: new Date(),
        error: error.message
      };
    }
  };

  /**
 * 사용자 학습 프로필 저장
 * @param {string} userId - 사용자 ID
 * @param {Object} learningProfile - 학습 프로필 데이터
 * @returns {Promise<Object>} - 저장 결과
 */
export const saveUserPreferences = async (userId, preferences) => {
    if (!userId || !preferences) {
      throw new Error('유효한 사용자 ID와 선호도 정보가 필요합니다');
    }
    
    try {
      const preferencesRef = doc(db, 'userPreferences', userId);
      
      // Firebase에 저장할 데이터 준비
      const profileData = {
        weights: preferences.weights || getDefaultWeights(),
        learningRate: preferences.learningRate || 0.05,
        confidence: preferences.confidence || 0,
        contextPreferences: preferences.contextPreferences || {},
        history: Array.isArray(preferences.history) ? 
          preferences.history.slice(-20) : [], // 최근 20개 히스토리만 저장
        lastUpdated: serverTimestamp()
      };
      
      // 선택적 필드 추가
      if (preferences.algorithmVersion) {
        profileData.algorithmVersion = preferences.algorithmVersion;
      }
      
      // 문서 업데이트
      await updateDoc(preferencesRef, profileData);
      
      // 행동 패턴 데이터가 있으면 별도 저장
      if (preferences.behaviorPatterns) {
        const behaviorRef = doc(db, 'userBehaviorPatterns', userId);
        await setDoc(behaviorRef, {
          ...preferences.behaviorPatterns,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      // 캐시 업데이트
      const cacheKey = `user_preferences_${userId}`;
      userPreferencesCache.set(cacheKey, {
        data: {
          ...preferences,
          lastUpdated: new Date()
        },
        timestamp: Date.now()
      });
      
      return { 
        success: true,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('[UserPreferences] 선호도 정보 저장 오류:', error);
      return { 
        success: false, 
        error: error.message
      };
    }
  };
  
  /**
   * 가중치 학습 이력 추가
   * @param {string} userId - 사용자 ID
   * @param {Object} feedbackData - 피드백 데이터
   * @param {Object} adjustments - 조정된 가중치 정보
   * @returns {Promise<Object>} - 결과
   */
  export const addWeightAdjustmentHistory = async (userId, feedbackData, adjustments) => {
    if (!userId || !feedbackData || !adjustments) {
      return { success: false, error: '필요한 데이터가 누락되었습니다' };
    }
    
    try {
      // 가중치 조정 이력 추가
      const historyRef = collection(db, 'weightAdjustmentHistory');
      await setDoc(doc(historyRef), {
        userId,
        placeId: feedbackData.placeId,
        rating: feedbackData.relevanceRating,
        tags: feedbackData.tags || [],
        adjustments: {
          mbti: adjustments.mbti || 0,
          interests: adjustments.interests || 0,
          talents: adjustments.talents || 0,
          mood: adjustments.mood || 0,
          location: adjustments.location || 0
        },
        timestamp: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('[UserPreferences] 가중치 조정 이력 추가 오류:', error);
      return { success: false, error: error.message };
    }
  };

  /**
 * 사용자 학습 이력 가져오기
 * @param {string} userId - 사용자 ID
 * @param {number} maxItems - 가져올 최대 항목 수
 * @returns {Promise<Array>} - 학습 이력 배열
 */
export const getLearningHistory = async (userId, maxItems = 30) => {
    if (!userId) {
      return { success: false, error: '사용자 ID가 필요합니다' };
    }
    
    try {
      const historyQuery = query(
        collection(db, 'weightAdjustmentHistory'),
        where('userId', '==', userId)
      );
      
      if (maxItems > 0) {
        // 여기서 limit 사용이 필요하다면 import해서 사용
        // (현재는 클라이언트 측에서 처리)
      }
      
      const snapshot = await getDocs(historyQuery);
      
      if (snapshot.empty) {
        return { success: true, data: [] };
      }
      
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // 타임스탬프 변환
        return {
          ...data,
          timestamp: data.timestamp?.toDate?.() || new Date()
        };
      }).sort((a, b) => b.timestamp - a.timestamp).slice(0, maxItems);
      
      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error('[UserPreferences] 학습 이력 가져오기 오류:', error);
      return { success: false, error: error.message, data: [] };
    }
  };
  
  /**
   * 추천 알고리즘 버전 설정
   * @param {string} userId - 사용자 ID
   * @param {string} version - 알고리즘 버전 ('standard', 'enhanced', 'advanced')
   * @returns {Promise<Object>} - 결과
   */
  export const setAlgorithmVersion = async (userId, version) => {
    if (!userId || !version) {
      return { success: false, error: '필요한 데이터가 누락되었습니다' };
    }
    
    try {
      // 지원되는 버전인지 확인
      const supportedVersions = ['standard', 'enhanced', 'advanced'];
      if (!supportedVersions.includes(version)) {
        return { 
          success: false, 
          error: `지원되지 않는 알고리즘 버전입니다. 지원 버전: ${supportedVersions.join(', ')}` 
        };
      }
      
      const preferencesRef = doc(db, 'userPreferences', userId);
      await updateDoc(preferencesRef, {
        algorithmVersion: version,
        lastUpdated: serverTimestamp()
      });
      
      // 캐시 무효화
      const cacheKey = `user_preferences_${userId}`;
      userPreferencesCache.delete(cacheKey);
      
      return { success: true, version };
    } catch (error) {
      console.error('[UserPreferences] 알고리즘 버전 설정 오류:', error);
      return { success: false, error: error.message };
    }
  };

  /**
 * 컨텍스트 선호도 설정
 * @param {string} userId - 사용자 ID
 * @param {Object} contextPreferences - 컨텍스트 선호도 설정
 * @returns {Promise<Object>} - 결과
 */
export const updateContextPreferences = async (userId, contextPreferences) => {
    if (!userId || !contextPreferences) {
      return { success: false, error: '필요한 데이터가 누락되었습니다' };
    }
    
    try {
      const preferencesRef = doc(db, 'userPreferences', userId);
      await updateDoc(preferencesRef, {
        contextPreferences,
        lastUpdated: serverTimestamp()
      });
      
      // 캐시 무효화
      const cacheKey = `user_preferences_${userId}`;
      userPreferencesCache.delete(cacheKey);
      
      return { success: true };
    } catch (error) {
      console.error('[UserPreferences] 컨텍스트 선호도 설정 오류:', error);
      return { success: false, error: error.message };
    }
  };
  
  /**
   * 캐시 무효화
   * @param {string} userId - 사용자 ID (특정 사용자만 무효화)
   */
  export const invalidateCache = (userId = null) => {
    if (userId) {
      // 특정 사용자의 캐시만 무효화
      const cacheKey = `user_preferences_${userId}`;
      userPreferencesCache.delete(cacheKey);
    } else {
      // 모든 캐시 무효화
      userPreferencesCache.clear();
    }
  };

  /**
 * 여러 사용자의 선호도 일괄 가져오기 (관리자 도구용)
 * @param {Array} userIds - 사용자 ID 배열
 * @returns {Promise<Object>} - 사용자별 선호도 데이터
 */
export const getBulkUserPreferences = async (userIds) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { success: false, error: '유효한 사용자 ID 배열이 필요합니다' };
    }
    
    try {
      // 배치 크기 제한 (Firestore 'in' 쿼리는 최대 10개 항목)
      const batchSize = 10;
      const results = {};
      
      // 배치 처리
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        const preferencesQuery = query(
          collection(db, 'userPreferences'),
          where('__name__', 'in', batch)
        );
        
        const snapshot = await getDocs(preferencesQuery);
        
        snapshot.forEach(doc => {
          results[doc.id] = {
            ...doc.data(),
            lastUpdated: doc.data().lastUpdated?.toDate?.() || new Date()
          };
        });
      }
      
      return {
        success: true,
        data: results,
        count: Object.keys(results).length
      };
    } catch (error) {
      console.error('[UserPreferences] 일괄 선호도 가져오기 오류:', error);
      return { success: false, error: error.message };
    }
  };
  
  // 모듈로 내보내기
  const userPreferencesService = {
    getUserPreferences,
    saveUserPreferences,
    addWeightAdjustmentHistory,
    getLearningHistory,
    setAlgorithmVersion,
    updateContextPreferences,
    invalidateCache,
    getBulkUserPreferences
  };
  
  export default userPreferencesService;
