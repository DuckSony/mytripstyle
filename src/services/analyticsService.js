// src/services/analyticsService.js의 상단에 추가
import { analytics } from '../config/firebase';
import { logEvent, setUserProperties, setUserId, setAnalyticsCollectionEnabled } from 'firebase/analytics';

// 환경 변수에서 설정 가져오기
const isAnalyticsEnabled = process.env.REACT_APP_ENABLE_ANALYTICS === 'true';
const env = process.env.REACT_APP_ENV || 'development';

/**
 * Firebase Analytics 초기화 함수
 * @returns {boolean} 초기화 성공 여부
 */
export const initializeAnalytics = () => {
  if (!isAnalyticsEnabled) {
    console.log('[Analytics] 분석 기능이 비활성화되어 있습니다.');
    return false;
  }
  
  try {
    if (!analytics) {
      console.warn('[Analytics] Firebase Analytics가 초기화되지 않았습니다.');
      return false;
    }
    
    // 개발 환경에서는 기본적으로 비활성화
    if (env === 'development') {
      setAnalyticsCollectionEnabled(analytics, false);
      console.log('[Analytics] 개발 환경에서 분석 수집이 비활성화되었습니다.');
    } else {
      setAnalyticsCollectionEnabled(analytics, true);
      console.log('[Analytics] 분석 수집이 활성화되었습니다.');
    }
    
    return true;
  } catch (error) {
    console.error('[Analytics] 초기화 오류:', error);
    return false;
  }
};

/**
 * 이벤트 추적 함수
 * @param {string} eventName - 이벤트 이름
 * @param {Object} params - 이벤트 매개변수
 * @returns {boolean} - 이벤트 추적 성공 여부
 */
export const trackEvent = (eventName, params = {}) => {
  if (!isAnalyticsEnabled || !analytics) {
    // 개발 모드에서는 콘솔에 출력
    if (env === 'development') {
      console.log(`[Analytics] 이벤트 추적: ${eventName}`, params);
    }
    return false;
  }

  try {
    // 환경 정보 추가
    const enhancedParams = {
      ...params,
      app_env: env,
      timestamp: Date.now()
    };

    // Firebase Analytics 이벤트 로깅
    logEvent(analytics, eventName, enhancedParams);
    return true;
  } catch (error) {
    console.error('[Analytics] 이벤트 추적 오류:', error);
    return false;
  }
};

/**
 * 사용자 속성 설정
 * @param {Object} properties - 사용자 속성
 */
export const setUserProps = (properties) => {
  if (!isAnalyticsEnabled || !analytics) return false;

  try {
    setUserProperties(analytics, properties);
    return true;
  } catch (error) {
    console.error('[Analytics] 사용자 속성 설정 오류:', error);
    return false;
  }
};

/**
 * 사용자 ID 설정
 * @param {string} uid - 사용자 ID
 */
export const setUser = (uid) => {
  if (!isAnalyticsEnabled || !analytics || !uid) return false;

  try {
    setUserId(analytics, uid);
    return true;
  } catch (error) {
    console.error('[Analytics] 사용자 ID 설정 오류:', error);
    return false;
  }
};

/**
 * 분석 수집 상태 설정
 * @param {boolean} enabled - 수집 활성화 여부
 */
export const setAnalyticsEnabled = (enabled) => {
  if (!analytics) return false;

  try {
    setAnalyticsCollectionEnabled(analytics, enabled);
    return true;
  } catch (error) {
    console.error('[Analytics] 수집 상태 설정 오류:', error);
    return false;
  }
};

// 화면 조회 이벤트
export const trackScreenView = (screenName, screenClass = '') => {
  return trackEvent('screen_view', {
    screen_name: screenName,
    screen_class: screenClass
  });
};

// 장소 조회 이벤트
export const trackPlaceView = (placeId, placeName, category) => {
  return trackEvent('place_view', {
    place_id: placeId,
    place_name: placeName,
    category
  });
};

// 장소 저장 이벤트
export const trackPlaceSave = (placeId, placeName, isSaved) => {
  return trackEvent(isSaved ? 'place_save' : 'place_unsave', {
    place_id: placeId,
    place_name: placeName
  });
};

// 추천 클릭 이벤트
export const trackRecommendationClick = (placeId, matchScore, recommendationType) => {
  return trackEvent('recommendation_click', {
    place_id: placeId,
    match_score: matchScore,
    recommendation_type: recommendationType
  });
};

// 검색 이벤트
export const trackSearch = (query, resultCount) => {
  return trackEvent('search', {
    query,
    result_count: resultCount
  });
};

// 피드백 제출 이벤트
export const trackFeedbackSubmit = (placeId, relevanceRating) => {
  return trackEvent('feedback_submit', {
    place_id: placeId,
    relevance_rating: relevanceRating
  });
};

// 프로필 업데이트 이벤트
export const trackProfileUpdate = (mbtiType, interestCount, talentCount, regionCount) => {
  return trackEvent('profile_update', {
    mbti_type: mbtiType,
    interest_count: interestCount,
    talent_count: talentCount,
    region_count: regionCount
  });
};

// 오류 이벤트
export const trackError = (errorCode, errorMessage, componentName) => {
  return trackEvent('app_error', {
    error_code: errorCode,
    error_message: errorMessage,
    component: componentName
  });
};

// 날씨 API 사용 이벤트
export const trackWeatherApiUse = (latitude, longitude, success) => {
  return trackEvent('weather_api_use', {
    latitude: Math.round(latitude * 100) / 100, // 소수점 2자리로 반올림하여 위치 정보 보호
    longitude: Math.round(longitude * 100) / 100,
    success
  });
};

// 오프라인 모드 이벤트
export const trackOfflineMode = (duration) => {
  return trackEvent('offline_mode', {
    duration_seconds: Math.floor(duration / 1000)
  });
};

// AI 추천 이벤트
export const trackAiRecommendation = (recommendationType, successRate) => {
  return trackEvent('ai_recommendation', {
    recommendation_type: recommendationType,
    success_rate: successRate
  });
};

export default {
  trackEvent,
  setUserProps,
  setUser,
  setAnalyticsEnabled,
  trackScreenView,
  trackPlaceView,
  trackPlaceSave,
  trackRecommendationClick,
  trackSearch,
  trackFeedbackSubmit,
  trackProfileUpdate,
  trackError,
  trackWeatherApiUse,
  trackOfflineMode,
  trackAiRecommendation
};
