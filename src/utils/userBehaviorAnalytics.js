/**
 * userBehaviorAnalytics.js
 * 
 * 사용자 행동 패턴을 분석하여 추천 시스템에 활용하는 유틸리티 함수 모음
 * 방문 이력, 피드백, 검색 패턴 등을 분석하여 사용자 선호도 프로필을 구축합니다.
 */

import { formatDistanceToNow, differenceInDays, format, isWithinInterval, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';

// 메모이제이션을 위한 캐시
const analyticsCacheMap = new Map();

/**
 * 방문 이력에서 시간 패턴을 추출하는 함수
 * @param {Array} visitHistory - 사용자 방문 이력 배열
 * @returns {Object} 시간대별, 요일별 방문 패턴
 */
export const extractTimePatterns = (visitHistory) => {
    if (!visitHistory || !Array.isArray(visitHistory) || visitHistory.length === 0) {
      return {
        timeOfDay: {},
        dayOfWeek: {},
        recency: 'none',
        frequency: 'low'
      };
    }
  
    const cacheKey = `time_patterns_${visitHistory.map(v => v.placeId).join('_')}`;
    if (analyticsCacheMap.has(cacheKey)) {
      return analyticsCacheMap.get(cacheKey);
    }
  
    // 시간대 카운트 (0-23시)
    const hourCounts = Array(24).fill(0);
    
    // 요일 카운트 (0: 일요일, 6: 토요일)
    const dayOfWeekCounts = Array(7).fill(0);
    
    // 월별 카운트
    const monthCounts = Array(12).fill(0);
    
    // 유효한 방문 데이터만 필터링
    const validVisits = visitHistory.filter(visit => 
      visit && visit.visitDate && new Date(visit.visitDate).toString() !== 'Invalid Date'
    );
    
    validVisits.forEach(visit => {
      const visitDate = new Date(visit.visitDate);
      const hour = visitDate.getHours();
      const day = visitDate.getDay();
      const month = visitDate.getMonth();
      
      hourCounts[hour]++;
      dayOfWeekCounts[day]++;
      monthCounts[month]++;
    });
    
    // 시간대 그룹화 (아침, 점심, 저녁, 밤)
    const timeOfDayGroups = {
      morning: hourCounts.slice(5, 11).reduce((sum, count) => sum + count, 0),    // 5-10시
      afternoon: hourCounts.slice(11, 17).reduce((sum, count) => sum + count, 0), // 11-16시
      evening: hourCounts.slice(17, 22).reduce((sum, count) => sum + count, 0),   // 17-21시
      night: hourCounts.slice(22, 24).reduce((sum, count) => sum + count, 0) + 
             hourCounts.slice(0, 5).reduce((sum, count) => sum + count, 0)        // 22-4시
    };
    
    // 요일 그룹화 (주중, 주말)
    const dayOfWeekGroups = {
      weekdays: dayOfWeekCounts.slice(1, 6).reduce((sum, count) => sum + count, 0), // 월-금
      weekend: dayOfWeekCounts[0] + dayOfWeekCounts[6]                             // 토, 일
    };
    
    // 가장 방문이 많은 시간대와 요일 찾기
    const favoriteTimeOfDay = Object.entries(timeOfDayGroups)
      .reduce((max, [time, count]) => count > max.count ? {time, count} : max, {time: '', count: 0})
      .time;
      
    const favoriteDayGroup = dayOfWeekGroups.weekdays > dayOfWeekGroups.weekend ? 'weekdays' : 'weekend';
    
    // 최근 방문 패턴 분석
    const now = new Date();
    const mostRecentVisit = new Date(Math.max(...validVisits.map(v => new Date(v.visitDate).getTime())));
    const daysSinceLastVisit = differenceInDays(now, mostRecentVisit);
    
    let recency;
    if (daysSinceLastVisit <= 7) {
      recency = 'recent'; // 최근 1주일 이내
    } else if (daysSinceLastVisit <= 30) {
      recency = 'moderate'; // 최근 1개월 이내
    } else {
      recency = 'old'; // 1개월 이상 전
    }
    
    // 방문 빈도 분석
    const visitCount = validVisits.length;
    let frequency;
    
    if (visitCount >= 10) {
      frequency = 'high'; // 높은 빈도
    } else if (visitCount >= 5) {
      frequency = 'medium'; // 중간 빈도
    } else {
      frequency = 'low'; // 낮은 빈도
    }
    
    const result = {
      timeOfDay: {
        counts: timeOfDayGroups,
        favorite: favoriteTimeOfDay
      },
      dayOfWeek: {
        counts: dayOfWeekGroups,
        favorite: favoriteDayGroup
      },
      hourDistribution: hourCounts,
      dayDistribution: dayOfWeekCounts,
      recency,
      frequency,
      totalVisits: validVisits.length
    };
    
    analyticsCacheMap.set(cacheKey, result);
    return result;
  };

  /**
 * 방문 이력에서 장소 카테고리 패턴을 추출하는 함수
 * @param {Array} visitHistory - 사용자 방문 이력 배열
 * @param {Array} placeDetails - 장소 상세 정보 배열 (선택적)
 * @returns {Object} 카테고리별 선호도 및 패턴
 */
export const extractCategoryPatterns = (visitHistory, placeDetails = []) => {
    if (!visitHistory || !Array.isArray(visitHistory) || visitHistory.length === 0) {
      return {
        categories: {},
        favoriteCategory: null,
        subCategories: {},
        favoriteSubCategory: null,
        diversity: 'low'
      };
    }
  
    const cacheKey = `category_patterns_${visitHistory.map(v => v.placeId).join('_')}`;
    if (analyticsCacheMap.has(cacheKey)) {
      return analyticsCacheMap.get(cacheKey);
    }
    
    // 카테고리 카운트
    const categoryCounts = {};
    
    // 서브 카테고리 카운트
    const subCategoryCounts = {};
    
    // 장소 태그 카운트
    const tagCounts = {};
    
    // 방문한 플레이스 ID 목록
    const visitedPlaceIds = new Set(visitHistory.map(visit => visit.placeId));
    
    // 유효한 장소 상세 정보만 필터링
    const relevantPlaceDetails = placeDetails.filter(place => 
      place && place.id && visitedPlaceIds.has(place.id)
    );
    
    // 방문 기록과 장소 상세 정보를 연결
    const enrichedVisits = visitHistory.map(visit => {
      const placeDetail = relevantPlaceDetails.find(p => p.id === visit.placeId) || {};
      
      return {
        ...visit,
        category: placeDetail.category || visit.category || 'unknown',
        subCategory: placeDetail.subCategory || visit.subCategory || 'unknown',
        tags: placeDetail.interestTags || placeDetail.specialFeatures || visit.tags || []
      };
    });
    
    // 카테고리 및 서브 카테고리 카운트
    enrichedVisits.forEach(visit => {
      // 카테고리 카운트
      categoryCounts[visit.category] = (categoryCounts[visit.category] || 0) + 1;
      
      // 서브 카테고리 카운트
      subCategoryCounts[visit.subCategory] = (subCategoryCounts[visit.subCategory] || 0) + 1;
      
      // 태그 카운트
      if (Array.isArray(visit.tags)) {
        visit.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    // 가장 방문이 많은 카테고리와 서브 카테고리 찾기
    const favoriteCategory = Object.entries(categoryCounts)
      .reduce((max, [category, count]) => count > max.count ? {category, count} : max, {category: null, count: 0})
      .category;
      
    const favoriteSubCategory = Object.entries(subCategoryCounts)
      .reduce((max, [subCategory, count]) => count > max.count ? {subCategory, count} : max, {subCategory: null, count: 0})
      .subCategory;
    
    // 카테고리 다양성 계산
    const totalVisits = enrichedVisits.length;
    const uniqueCategories = Object.keys(categoryCounts).length;
    
    let diversity;
    if (uniqueCategories >= 5) {
      diversity = 'high'; // 높은 다양성
    } else if (uniqueCategories >= 3) {
      diversity = 'medium'; // 중간 다양성
    } else {
      diversity = 'low'; // 낮은 다양성
    }
    
    // 상위 태그 추출
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: Math.round((count / totalVisits) * 100)
      }));
    
    const result = {
      categories: categoryCounts,
      favoriteCategory,
      categoryDistribution: Object.entries(categoryCounts).map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / totalVisits) * 100)
      })),
      subCategories: subCategoryCounts,
      favoriteSubCategory,
      topTags,
      diversity,
      uniqueCategoriesCount: uniqueCategories
    };
    
    analyticsCacheMap.set(cacheKey, result);
    return result;
  };

  /**
 * 재방문 패턴을 분석하는 함수
 * @param {Array} visitHistory - 사용자 방문 이력 배열
 * @returns {Object} 재방문 관련 패턴 및 통계
 */
export const analyzeRevisitBehavior = (visitHistory) => {
    if (!visitHistory || !Array.isArray(visitHistory) || visitHistory.length === 0) {
      return {
        revisitRate: 0,
        favoritePlace: null,
        revisitPattern: 'none'
      };
    }
  
    const cacheKey = `revisit_${visitHistory.map(v => v.placeId).join('_')}`;
    if (analyticsCacheMap.has(cacheKey)) {
      return analyticsCacheMap.get(cacheKey);
    }
    
    // 장소별 방문 횟수
    const placeVisitCounts = {};
    
    // 장소별 방문 날짜
    const placeVisitDates = {};
    
    visitHistory.forEach(visit => {
      if (!visit.placeId) return;
      
      // 방문 횟수 카운트
      placeVisitCounts[visit.placeId] = (placeVisitCounts[visit.placeId] || 0) + 1;
      
      // 방문 날짜 기록
      if (!placeVisitDates[visit.placeId]) {
        placeVisitDates[visit.placeId] = [];
      }
      
      if (visit.visitDate) {
        placeVisitDates[visit.placeId].push(new Date(visit.visitDate));
      }
    });
    
    // 재방문한 장소 수
    const revisitedPlaces = Object.entries(placeVisitCounts)
      .filter(([_, count]) => count > 1)
      .map(([placeId, count]) => ({
        placeId,
        visitCount: count,
        intervalStats: calculateVisitIntervals(placeVisitDates[placeId] || [])
      }));
    
    // 총 방문한 고유 장소 수
    const uniquePlacesCount = Object.keys(placeVisitCounts).length;
    
    // 재방문율 (재방문한 장소 수 / 총 방문한 고유 장소 수)
    const revisitRate = uniquePlacesCount > 0 
      ? revisitedPlaces.length / uniquePlacesCount 
      : 0;
    
    // 가장 자주 방문한 장소
    const mostVisitedPlace = Object.entries(placeVisitCounts)
      .reduce((max, [placeId, count]) => count > max.count ? {placeId, count} : max, {placeId: null, count: 0});
    
    // 재방문 패턴 분석
    let revisitPattern = 'none';
    if (revisitRate > 0.5) {
      revisitPattern = 'high'; // 높은 재방문율
    } else if (revisitRate > 0.2) {
      revisitPattern = 'medium'; // 중간 재방문율
    } else if (revisitRate > 0) {
      revisitPattern = 'low'; // 낮은 재방문율
    }
    
    // 방문 간격 분석 통계
    let averageRevisitInterval = 0;
    let intervalPattern = 'irregular';
    
    if (revisitedPlaces.length > 0) {
      // 모든 재방문 장소의 평균 간격 계산
      const totalIntervals = revisitedPlaces.reduce((sum, place) => {
        return sum + (place.intervalStats.averageInterval || 0);
      }, 0);
      
      averageRevisitInterval = totalIntervals / revisitedPlaces.length;
      
      // 간격의 일관성 판단
      const consistencyScores = revisitedPlaces.map(place => place.intervalStats.consistencyScore || 0);
      const avgConsistency = consistencyScores.length > 0 
        ? consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length
        : 0;
      
      if (avgConsistency > 0.7) {
        intervalPattern = 'regular'; // 규칙적인 방문 간격
      } else if (avgConsistency > 0.4) {
        intervalPattern = 'semi-regular'; // 준-규칙적인 방문 간격
      }
    }
    
    const result = {
      revisitRate: parseFloat(revisitRate.toFixed(2)),
      revisitedPlacesCount: revisitedPlaces.length,
      uniquePlacesCount,
      favoritePlace: mostVisitedPlace.placeId,
      favoriteVisitCount: mostVisitedPlace.count,
      revisitPattern,
      averageRevisitInterval: Math.round(averageRevisitInterval),
      intervalPattern,
      revisitedPlaces: revisitedPlaces.map(place => ({
        placeId: place.placeId,
        visitCount: place.visitCount,
        averageInterval: place.intervalStats.averageInterval,
        consistencyScore: place.intervalStats.consistencyScore
      }))
    };
    
    analyticsCacheMap.set(cacheKey, result);
    return result;
  };
  
  /**
   * 방문 간격 통계를 계산하는 함수
   * @param {Array} dates - 방문 날짜 배열
   * @returns {Object} 간격 통계
   */
  const calculateVisitIntervals = (dates) => {
    if (!dates || dates.length < 2) {
      return { 
        averageInterval: 0, 
        consistencyScore: 0,
        intervals: []
      };
    }
    
    // 날짜 정렬
    const sortedDates = [...dates].sort((a, b) => a - b);
    
    // 방문 간격 계산 (일 단위)
    const intervals = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = differenceInDays(sortedDates[i], sortedDates[i-1]);
      intervals.push(daysDiff);
    }
    
    // 평균 간격
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // 표준 편차 계산
    const variance = intervals.reduce((sum, interval) => {
      const diff = interval - averageInterval;
      return sum + (diff * diff);
    }, 0) / intervals.length;
    
    const stdDev = Math.sqrt(variance);
    
    // 일관성 점수 계산 (표준편차를 평균으로 나눈 값의 역수)
    const coeffVar = averageInterval > 0 ? stdDev / averageInterval : 0;
    const consistencyScore = coeffVar > 0 ? 1 / (1 + coeffVar) : 0;
    
    return {
      averageInterval: Math.round(averageInterval),
      stdDev: Math.round(stdDev * 10) / 10,
      consistencyScore: parseFloat(consistencyScore.toFixed(2)),
      intervals
    };
  };

  /**
 * 사용자 방문 패턴을 종합적으로 분석하는 함수
 * @param {Array} visitHistory - 사용자 방문 이력 배열
 * @param {Array} placeDetails - 장소 상세 정보 배열 (선택적)
 * @returns {Object} 종합 방문 패턴 분석 결과
 */
export const analyzeUserVisitPatterns = (visitHistory, placeDetails = []) => {
    if (!visitHistory || !Array.isArray(visitHistory)) {
      return {
        timePatterns: extractTimePatterns([]),
        categoryPatterns: extractCategoryPatterns([], []),
        revisitPatterns: analyzeRevisitBehavior([]),
        userType: 'new',
        dominantPatterns: {}
      };
    }
  
    const cacheKey = `visit_patterns_${visitHistory.map(v => v.placeId).join('_')}`;
    if (analyticsCacheMap.has(cacheKey)) {
      return analyticsCacheMap.get(cacheKey);
    }
    
    // 각 패턴 분석 실행
    const timePatterns = extractTimePatterns(visitHistory);
    const categoryPatterns = extractCategoryPatterns(visitHistory, placeDetails);
    const revisitPatterns = analyzeRevisitBehavior(visitHistory);
    
    // 사용자 유형 분류
    let userType = 'new';
    
    if (visitHistory.length >= 10) {
      if (revisitPatterns.revisitRate > 0.5) {
        userType = 'loyal'; // 충성도 높은 사용자 (재방문율 높음)
      } else if (categoryPatterns.diversity === 'high') {
        userType = 'explorer'; // 다양한 장소 탐색 사용자
      } else {
        userType = 'focused'; // 특정 카테고리 집중 사용자
      }
    } else if (visitHistory.length >= 3) {
      userType = 'emerging'; // 데이터 쌓이는 중인 사용자
    }
    
    // 주요 패턴 추출
    const dominantPatterns = extractDominantPatterns(timePatterns, categoryPatterns, revisitPatterns);
    
    const result = {
      timePatterns,
      categoryPatterns,
      revisitPatterns,
      userType,
      dominantPatterns,
      activityLevel: determineActivityLevel(visitHistory)
    };
    
    analyticsCacheMap.set(cacheKey, result);
    return result;
  };

  /**
 * 주요 패턴을 추출하는 함수
 * @param {Object} timePatterns - 시간 패턴 분석 결과
 * @param {Object} categoryPatterns - 카테고리 패턴 분석 결과
 * @param {Object} revisitPatterns - 재방문 패턴 분석 결과
 * @returns {Object} 주요 패턴
 */
export const extractDominantPatterns = (timePatterns, categoryPatterns, revisitPatterns) => {
    // 시간 패턴 요약
    const timePreference = timePatterns.timeOfDay?.favorite || 'unknown';
    const dayPreference = timePatterns.dayOfWeek?.favorite || 'unknown';
    
    // 카테고리 패턴 요약
    const categoryPreference = categoryPatterns.favoriteCategory || 'unknown';
    const diversityLevel = categoryPatterns.diversity || 'low';
    
    // 재방문 패턴 요약
    const loyaltyLevel = revisitPatterns.revisitPattern || 'none';
    const intervalType = revisitPatterns.intervalPattern || 'irregular';
    
    // 종합 사용자 성향
    const userPersona = determineUserPersona(timePatterns, categoryPatterns, revisitPatterns);
    
    return {
      timePreference,
      dayPreference,
      categoryPreference,
      diversityLevel,
      loyaltyLevel,
      intervalType,
      userPersona
    };
  };
  
  /**
   * 사용자 활동 수준을 결정하는 함수
   * @param {Array} visitHistory - 사용자 방문 이력 배열
   * @returns {string} 활동 수준
   */
  const determineActivityLevel = (visitHistory) => {
    if (!visitHistory || !Array.isArray(visitHistory)) {
      return 'inactive';
    }
    
    // 유효한 방문만 필터링
    const validVisits = visitHistory.filter(visit => 
      visit && visit.visitDate && new Date(visit.visitDate).toString() !== 'Invalid Date'
    );
    
    if (validVisits.length === 0) {
      return 'inactive';
    }
    
    // 최근 방문 날짜
    const now = new Date();
    const mostRecentVisit = new Date(Math.max(...validVisits.map(v => new Date(v.visitDate).getTime())));
    const daysSinceLastVisit = differenceInDays(now, mostRecentVisit);
    
    // 최근 1개월 내 방문 횟수
    const recentVisits = validVisits.filter(visit => {
      const visitDate = new Date(visit.visitDate);
      return differenceInDays(now, visitDate) <= 30;
    }).length;
    
    if (daysSinceLastVisit <= 7 && recentVisits >= 5) {
      return 'very_active'; // 매우 활발함
    } else if (daysSinceLastVisit <= 14 && recentVisits >= 3) {
      return 'active'; // 활발함
    } else if (daysSinceLastVisit <= 30) {
      return 'moderate'; // 보통
    } else if (daysSinceLastVisit <= 90) {
      return 'occasional'; // 간헐적
    } else {
      return 'inactive'; // 비활성
    }
  };
  
  /**
   * 사용자 성향을 결정하는 함수
   * @param {Object} timePatterns - 시간 패턴 분석 결과
   * @param {Object} categoryPatterns - 카테고리 패턴 분석 결과
   * @param {Object} revisitPatterns - 재방문 패턴 분석 결과
   * @returns {string} 사용자 성향
   */
  const determineUserPersona = (timePatterns, categoryPatterns, revisitPatterns) => {
    // 다양한 패턴 요소 결합하여 성향 결정
    
    // 선호 카테고리 기반 성향
    const category = categoryPatterns.favoriteCategory || '';
    
    // 카테고리 다양성
    const diversity = categoryPatterns.diversity || 'low';
    
    // 충성도
    const loyalty = revisitPatterns.revisitPattern || 'none';
    
    // 시간대 선호
    const timePreference = timePatterns.timeOfDay?.favorite || '';
    
    // 활동 빈도
    const frequency = timePatterns.frequency || 'low';
    
    // 성향 조합
    if (diversity === 'high' && frequency === 'high') {
      return 'enthusiastic_explorer'; // 열정적 탐험가
    } else if (loyalty === 'high' && diversity === 'low') {
      return 'loyal_regular'; // 충성 고객
    } else if (timePreference === 'morning' && category === 'cafe') {
      return 'morning_cafe_goer'; // 아침 카페 방문객
    } else if (timePreference === 'evening' && 
              (category === 'restaurant' || category === 'bar')) {
      return 'evening_diner'; // 저녁 식사 선호
    } else if (timePatterns.dayOfWeek?.favorite === 'weekend' && 
              frequency === 'medium') {
      return 'weekend_leisure_seeker'; // 주말 여가 추구자
    } else if (diversity === 'medium' && frequency === 'medium') {
      return 'balanced_visitor'; // 균형 잡힌 방문자
    } else if (frequency === 'low') {
      return 'occasional_visitor'; // 가끔 방문자
    }
    
    return 'general_user'; // 일반 사용자
  };

  /**
 * 사용자 피드백 패턴을 분석하는 함수
 * @param {Array} feedbacks - 사용자 피드백 배열
 * @returns {Object} 피드백 패턴 분석 결과
 */
export const analyzeFeedbackPatterns = (feedbacks) => {
    if (!feedbacks || !Array.isArray(feedbacks) || feedbacks.length === 0) {
      return {
        averageRating: 0,
        ratingDistribution: {},
        positiveRatio: 0,
        criticalRatio: 0,
        feedbackFrequency: 'none',
        topPositiveTags: [],
        topNegativeTags: [],
        feedbackStyle: 'none'
      };
    }
  
    const cacheKey = `feedback_patterns_${feedbacks.map(f => f.id).join('_')}`;
    if (analyticsCacheMap.has(cacheKey)) {
      return analyticsCacheMap.get(cacheKey);
    }
    
    // 평점 분포
    const ratingCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    
    // 태그 카운트 (긍정/부정 구분)
    const positiveTags = {};
    const negativeTags = {};
    
    // 피드백 길이 분포
    const commentLengths = [];
    
    feedbacks.forEach(feedback => {
      // 평점 카운트
      const rating = feedback.relevanceRating || 3;
      ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
      
      // 태그 카운트
      if (Array.isArray(feedback.tags)) {
        feedback.tags.forEach(tag => {
          if (rating >= 4) {
            // 긍정 피드백 태그
            positiveTags[tag] = (positiveTags[tag] || 0) + 1;
          } else if (rating <= 2) {
            // 부정 피드백 태그
            negativeTags[tag] = (negativeTags[tag] || 0) + 1;
          }
        });
      }
      
      // 코멘트 길이
      if (feedback.comment) {
        commentLengths.push(feedback.comment.length);
      }
    });
    
    // 총 피드백 수
    const totalFeedbacks = feedbacks.length;
    
    // 평균 평점
    const totalRatingSum = Object.entries(ratingCounts)
      .reduce((sum, [rating, count]) => sum + (parseInt(rating) * count), 0);
    const averageRating = totalRatingSum / totalFeedbacks;
    
    // 긍정/부정 비율
    const positiveCount = (ratingCounts[4] || 0) + (ratingCounts[5] || 0);
    const negativeCount = (ratingCounts[1] || 0) + (ratingCounts[2] || 0);
    const positiveRatio = positiveCount / totalFeedbacks;
    const criticalRatio = negativeCount / totalFeedbacks;
    
    // 상위 태그 추출
    const topPositiveTags = Object.entries(positiveTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: Math.round((count / Math.max(1, positiveCount)) * 100)
      }));
      
    const topNegativeTags = Object.entries(negativeTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: Math.round((count / Math.max(1, negativeCount)) * 100)
      }));
    
    // 피드백 빈도 결정
    let feedbackFrequency = 'none';
    if (totalFeedbacks >= 10) {
      feedbackFrequency = 'high';
    } else if (totalFeedbacks >= 5) {
      feedbackFrequency = 'medium';
    } else if (totalFeedbacks > 0) {
      feedbackFrequency = 'low';
    }
    
    // 피드백 스타일 결정
    let feedbackStyle = 'none';
    const avgCommentLength = commentLengths.length > 0 
      ? commentLengths.reduce((sum, length) => sum + length, 0) / commentLengths.length
      : 0;
    
    if (commentLengths.length / totalFeedbacks > 0.7) {
      if (avgCommentLength > 100) {
        feedbackStyle = 'detailed';
      } else if (avgCommentLength > 30) {
        feedbackStyle = 'descriptive';
      } else {
        feedbackStyle = 'concise';
      }
    } else if (commentLengths.length / totalFeedbacks > 0.3) {
      feedbackStyle = 'occasional';
    } else {
      feedbackStyle = 'rating_only';
    }
    
    const result = {
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingDistribution: ratingCounts,
      ratingDistributionPercentage: Object.entries(ratingCounts).reduce((obj, [rating, count]) => {
        obj[rating] = Math.round((count / totalFeedbacks) * 100);
        return obj;
      }, {}),
      positiveRatio: parseFloat(positiveRatio.toFixed(2)),
      criticalRatio: parseFloat(criticalRatio.toFixed(2)),
      feedbackFrequency,
      topPositiveTags,
      topNegativeTags,
      feedbackStyle,
      averageCommentLength: Math.round(avgCommentLength),
      commentCount: commentLengths.length,
      totalFeedbacks
    };
    
    analyticsCacheMap.set(cacheKey, result);
    return result;
  };

  /**
 * 사용자 검색 패턴을 분석하는 함수
 * @param {Array} searchHistory - 사용자 검색 이력 배열
 * @returns {Object} 검색 패턴 분석 결과
 */
export const analyzeSearchPatterns = (searchHistory) => {
    if (!searchHistory || !Array.isArray(searchHistory) || searchHistory.length === 0) {
      return {
        topSearchTerms: [],
        topSearchCategories: [],
        searchFrequency: 'none',
        searchToVisitRate: 0,
        searchStyle: 'none'
      };
    }
  
    const cacheKey = `search_patterns_${searchHistory.map(s => s.id || s.term).join('_')}`;
    if (analyticsCacheMap.has(cacheKey)) {
      return analyticsCacheMap.get(cacheKey);
    }
    
    // 검색어 카운트
    const termCounts = {};
    
    // 검색 카테고리 카운트
    const categoryCounts = {};
    
    // 검색 결과 클릭 정보
    let totalSearches = 0;
    let searchesWithClicks = 0;
    
    // 검색 시간 정보
    const searchTimes = [];
    
    searchHistory.forEach(search => {
      totalSearches++;
      
      // 검색어 카운트
      if (search.term) {
        const term = search.term.toLowerCase().trim();
        if (term) {
          termCounts[term] = (termCounts[term] || 0) + 1;
        }
      }
      
      // 카테고리 카운트
      if (search.category) {
        categoryCounts[search.category] = (categoryCounts[search.category] || 0) + 1;
      }
      
      // 클릭 여부
      if (search.resultClicks && search.resultClicks > 0) {
        searchesWithClicks++;
      }
      
      // 검색 시간
      if (search.timestamp) {
        searchTimes.push(new Date(search.timestamp));
      }
    });
    
    // 검색 결과 클릭률
    const clickThroughRate = searchesWithClicks / Math.max(1, totalSearches);
    
    // 상위 검색어 추출
    const topSearchTerms = Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({
        term,
        count,
        percentage: Math.round((count / totalSearches) * 100)
      }));
      
    // 상위 검색 카테고리 추출
    const topSearchCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / totalSearches) * 100)
      }));
    
    // 검색 빈도 결정
    let searchFrequency = 'none';
    if (searchTimes.length >= 2) {
      // 일 평균 검색 횟수 계산
      const firstSearch = new Date(Math.min(...searchTimes.map(d => d.getTime())));
      const lastSearch = new Date(Math.max(...searchTimes.map(d => d.getTime())));
      const daysDiff = Math.max(1, differenceInDays(lastSearch, firstSearch));
      const dailySearchRate = searchHistory.length / daysDiff;
      
      if (dailySearchRate >= 3) {
        searchFrequency = 'high';
      } else if (dailySearchRate >= 1) {
        searchFrequency = 'medium';
      } else {
        searchFrequency = 'low';
      }
    } else if (searchHistory.length > 0) {
      searchFrequency = 'one_time';
    }
    
    // 검색 스타일 결정
    let searchStyle = 'general';
    
    // 카테고리 검색 비율
    const categorySearchRatio = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0) / totalSearches;
    
    // 키워드 다양성
    const keywordDiversity = Object.keys(termCounts).length / totalSearches;
    
    if (categorySearchRatio > 0.7) {
      searchStyle = 'category_focused';
    } else if (keywordDiversity < 0.3) {
      searchStyle = 'repetitive';
    } else if (Object.keys(termCounts).length > 10 && clickThroughRate > 0.7) {
      searchStyle = 'exploratory';
    } else if (Object.keys(termCounts).length <= 3 && searchHistory.length > 5) {
      searchStyle = 'specific';
    }
    
    const result = {
      topSearchTerms,
      topSearchCategories,
      searchFrequency,
      clickThroughRate: parseFloat(clickThroughRate.toFixed(2)),
      searchToVisitRate: parseFloat(clickThroughRate.toFixed(2)),
      searchStyle,
      keywordDiversity: parseFloat(keywordDiversity.toFixed(2)),
      categorySearchRatio: parseFloat(categorySearchRatio.toFixed(2)),
      totalSearches
    };
    
    analyticsCacheMap.set(cacheKey, result);
    return result;
  };

  /**
 * 사용자의 종합 행동 프로필을 생성하는 함수
 * @param {Object} userData - 사용자 데이터
 * @param {Array} userData.visitHistory - 방문 이력
 * @param {Array} userData.feedbacks - 피드백 데이터
 * @param {Array} userData.searchHistory - 검색 이력
 * @param {Array} placeDetails - 장소 상세 정보 (선택적)
 * @returns {Object} 종합 사용자 행동 프로필
 */
export const generateUserBehaviorProfile = (userData, placeDetails = []) => {
    if (!userData) {
      return {
        userType: 'new',
        visitPatterns: {},
        feedbackPatterns: {},
        searchPatterns: {},
        personalizedWeights: getDefaultWeights(),
        lastUpdated: new Date()
      };
    }
  
    const { visitHistory = [], feedbacks = [], searchHistory = [] } = userData;
    
    // 각 패턴 분석 실행
    const visitPatterns = analyzeUserVisitPatterns(visitHistory, placeDetails);
    const feedbackPatterns = analyzeFeedbackPatterns(feedbacks);
    const searchPatterns = analyzeSearchPatterns(searchHistory);
    
    // 추천 가중치 계산
    const personalizedWeights = calculatePersonalizedWeights(
      visitPatterns,
      feedbackPatterns,
      searchPatterns
    );
    
    // 사용자 활동 점수 계산
    const activityScore = calculateActivityScore(
      visitPatterns, 
      feedbackPatterns, 
      searchPatterns
    );
    
    return {
      userType: visitPatterns.userType,
      visitPatterns,
      feedbackPatterns,
      searchPatterns,
      personalizedWeights,
      activityScore,
      lastUpdated: new Date()
    };
  };
  
  /**
   * 활동 점수를 계산하는 함수
   * @param {Object} visitPatterns - 방문 패턴 분석 결과
   * @param {Object} feedbackPatterns - 피드백 패턴 분석 결과
   * @param {Object} searchPatterns - 검색 패턴 분석 결과
   * @returns {number} 활동 점수 (0-100)
   */
  const calculateActivityScore = (visitPatterns, feedbackPatterns, searchPatterns) => {
    // 방문 기록 기반 점수 (50%)
    let visitScore = 0;
    if (visitPatterns.activityLevel === 'very_active') {
      visitScore = 50;
    } else if (visitPatterns.activityLevel === 'active') {
      visitScore = 40;
    } else if (visitPatterns.activityLevel === 'moderate') {
      visitScore = 30;
    } else if (visitPatterns.activityLevel === 'occasional') {
      visitScore = 20;
    } else if (visitPatterns.timePatterns && visitPatterns.timePatterns.totalVisits > 0) {
      visitScore = 10;
    }
    
    // 피드백 기록 기반 점수 (30%)
    let feedbackScore = 0;
    if (feedbackPatterns.feedbackFrequency === 'high') {
      feedbackScore = 30;
    } else if (feedbackPatterns.feedbackFrequency === 'medium') {
      feedbackScore = 20;
    } else if (feedbackPatterns.feedbackFrequency === 'low') {
      feedbackScore = 10;
    }
    
    // 검색 기록 기반 점수 (20%)
    let searchScore = 0;
    if (searchPatterns.searchFrequency === 'high') {
      searchScore = 20;
    } else if (searchPatterns.searchFrequency === 'medium') {
      searchScore = 15;
    } else if (searchPatterns.searchFrequency === 'low') {
      searchScore = 10;
    } else if (searchPatterns.searchFrequency === 'one_time') {
      searchScore = 5;
    }
    
    // 총점
    return Math.min(100, visitScore + feedbackScore + searchScore);
  };

  /**
 * 기본 가중치 값을 반환하는 함수
 * @returns {Object} 기본 가중치 값
 */
export const getDefaultWeights = () => {
    return {
      mbti: 0.35,
      interests: 0.25,
      talents: 0.15,
      mood: 0.15,
      location: 0.10
    };
  };
  
  /**
   * 사용자 행동 패턴 기반으로 개인화된 가중치를 계산하는 함수
   * @param {Object} visitPatterns - 방문 패턴 분석 결과
   * @param {Object} feedbackPatterns - 피드백 패턴 분석 결과
   * @param {Object} searchPatterns - 검색 패턴 분석 결과
   * @returns {Object} 개인화된 가중치
   */
  export const calculatePersonalizedWeights = (
    visitPatterns, 
    feedbackPatterns, 
    searchPatterns
  ) => {
    // 기본 가중치에서 시작
    const defaultWeights = getDefaultWeights();
    
    // 충분한 데이터가 없으면 기본 가중치 반환
    if (!visitPatterns || !feedbackPatterns) {
      return defaultWeights;
    }
    
    // 방문 패턴과 피드백 데이터 없으면 기본 가중치 반환
    const hasVisitData = visitPatterns.timePatterns && 
                        visitPatterns.timePatterns.totalVisits > 0;
    const hasFeedbackData = feedbackPatterns.totalFeedbacks > 0;
    
    if (!hasVisitData && !hasFeedbackData) {
      return defaultWeights;
    }
    
    // 가중치 조정 크기 (얼마나 많은 데이터가 있는지에 따라)
    let adjustmentFactor = 0.05; // 기본 조정 크기 (최대 5% 변경)
    
    if ((hasVisitData && visitPatterns.timePatterns.totalVisits >= 10) || 
        (hasFeedbackData && feedbackPatterns.totalFeedbacks >= 10)) {
      adjustmentFactor = 0.10; // 더 많은 데이터가 있으면 최대 10% 변경
    }
    
    if ((hasVisitData && visitPatterns.timePatterns.totalVisits >= 20) || 
        (hasFeedbackData && feedbackPatterns.totalFeedbacks >= 20)) {
      adjustmentFactor = 0.15; // 매우 많은 데이터가 있으면 최대 15% 변경
    }
    
    // 가중치 조정값 초기화
    const adjustments = {
      mbti: 0,
      interests: 0,
      talents: 0,
      mood: 0,
      location: 0
    };
    
    // 방문 패턴 기반 조정
    if (hasVisitData) {
      // 카테고리 다양성에 따른 조정
      if (visitPatterns.categoryPatterns.diversity === 'high') {
        // 다양한 카테고리 방문 - 관심사 가중치 증가
        adjustments.interests += adjustmentFactor;
      } else if (visitPatterns.categoryPatterns.diversity === 'low') {
        // 특정 카테고리 집중 - MBTI 가중치 증가
        adjustments.mbti += adjustmentFactor;
      }
      
      // 재방문 패턴에 따른 조정
      if (visitPatterns.revisitPatterns.revisitPattern === 'high') {
        // 높은 재방문율 - 위치 가중치 증가
        adjustments.location += adjustmentFactor;
      }
      
      // 방문 주기에 따른 조정
      if (visitPatterns.activityLevel === 'very_active' || 
          visitPatterns.activityLevel === 'active') {
        // 활발한 사용자 - 감정 상태 가중치 증가
        adjustments.mood += adjustmentFactor / 2;
      }
    }
    
    // 피드백 패턴 기반 조정
    if (hasFeedbackData) {
      // 긍정/부정 피드백 비율에 따른 조정
      if (feedbackPatterns.positiveRatio > 0.7) {
        // 매우 긍정적인 피드백 - MBTI 가중치 증가
        adjustments.mbti += adjustmentFactor / 2;
      } else if (feedbackPatterns.criticalRatio > 0.3) {
        // 비판적 피드백 많음 - 관심사 가중치 증가
        adjustments.interests += adjustmentFactor / 2;
      }
      
      // 상세 피드백 스타일에 따른 조정
      if (feedbackPatterns.feedbackStyle === 'detailed' || 
          feedbackPatterns.feedbackStyle === 'descriptive') {
        // 상세한 피드백 제공 - 재능 가중치 증가
        adjustments.talents += adjustmentFactor / 2;
      }
    }
    
    // 검색 패턴 기반 조정
    if (searchPatterns && searchPatterns.totalSearches > 0) {
      // 검색 스타일에 따른 조정
      if (searchPatterns.searchStyle === 'category_focused') {
        // 카테고리 중심 검색 - 관심사 가중치 증가
        adjustments.interests += adjustmentFactor / 2;
      } else if (searchPatterns.searchStyle === 'exploratory') {
        // 탐색적 검색 - 재능 가중치 증가
        adjustments.talents += adjustmentFactor / 2;
      }
      
      // 클릭률에 따른 조정
      if (searchPatterns.clickThroughRate > 0.8) {
        // 높은 클릭률 - MBTI 가중치 약간 증가
        adjustments.mbti += adjustmentFactor / 4;
      }
    }
    
    // 조정값 적용
    const adjustedWeights = { ...defaultWeights };
    for (const key in adjustedWeights) {
      if (Object.prototype.hasOwnProperty.call(adjustedWeights, key)) {
        adjustedWeights[key] += adjustments[key];
      }
    }
    
    // 가중치 합이 1이 되도록 정규화
    const sum = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
    for (const key in adjustedWeights) {
      if (Object.prototype.hasOwnProperty.call(adjustedWeights, key)) {
        adjustedWeights[key] = parseFloat((adjustedWeights[key] / sum).toFixed(4));
      }
    }
    
    return adjustedWeights;
  };

  /**
 * 로컬 캐시를 지우는 함수
 */
export const clearAnalyticsCache = () => {
    analyticsCacheMap.clear();
  };
  
  /**
   * 특정 사용자의 캐시를 지우는 함수
   * @param {string} userId - 사용자 ID
   */
  export const clearUserAnalyticsCache = (userId) => {
    if (!userId) return;
    
    const keysToRemove = [];
    
    analyticsCacheMap.forEach((_, key) => {
      if (key.includes(userId)) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      analyticsCacheMap.delete(key);
    });
  };
  
  /**
   * 패턴 분석 결과를 사람이 읽기 쉬운 설명으로 변환하는 함수
   * @param {Object} patterns - 패턴 분석 결과
   * @returns {Object} 사람이 읽기 쉬운 설명
   */
  export const generateHumanReadableInsights = (patterns) => {
    if (!patterns) return null;
    
    const { visitPatterns, feedbackPatterns, searchPatterns } = patterns;
    const insights = {};
    
    // 방문 패턴 인사이트
    if (visitPatterns) {
      insights.visit = generateVisitInsights(visitPatterns);
    }
    
    // 피드백 패턴 인사이트
    if (feedbackPatterns) {
      insights.feedback = generateFeedbackInsights(feedbackPatterns);
    }
    
    // 검색 패턴 인사이트
    if (searchPatterns) {
      insights.search = generateSearchInsights(searchPatterns);
    }
    
    // 종합 인사이트
    insights.summary = generateSummaryInsights(patterns);
    
    return insights;
  };
  
  /**
   * 방문 패턴 인사이트 생성
   * @param {Object} visitPatterns - 방문 패턴 분석 결과
   * @returns {Array} 인사이트 문장 배열
   */
  const generateVisitInsights = (visitPatterns) => {
    const insights = [];
    
    if (!visitPatterns || !visitPatterns.timePatterns) {
      return ["아직 충분한 방문 데이터가 없습니다."];
    }
    
    // 방문 빈도
    if (visitPatterns.activityLevel === 'very_active') {
      insights.push("매우 활발하게 장소를 방문하고 있습니다.");
    } else if (visitPatterns.activityLevel === 'active') {
      insights.push("꾸준히 장소를 방문하고 있습니다.");
    } else if (visitPatterns.activityLevel === 'moderate') {
      insights.push("적절한 빈도로 장소를 방문하고 있습니다.");
    } else if (visitPatterns.activityLevel === 'occasional') {
      insights.push("가끔씩 장소를 방문하고 있습니다.");
    } else if (visitPatterns.activityLevel === 'inactive') {
      insights.push("최근에는 장소 방문 활동이 적은 편입니다.");
    }
    
    // 시간대 선호
    if (visitPatterns.timePatterns.timeOfDay && visitPatterns.timePatterns.timeOfDay.favorite) {
      const timePref = visitPatterns.timePatterns.timeOfDay.favorite;
      
      if (timePref === 'morning') {
        insights.push("주로 아침 시간대에 장소를 방문하는 편입니다.");
      } else if (timePref === 'afternoon') {
        insights.push("주로 오후 시간대에 장소를 방문하는 편입니다.");
      } else if (timePref === 'evening') {
        insights.push("주로 저녁 시간대에 장소를 방문하는 편입니다.");
      } else if (timePref === 'night') {
        insights.push("주로 밤 시간대에 장소를 방문하는 편입니다.");
      }
    }
    
    // 요일 선호
    if (visitPatterns.timePatterns.dayOfWeek && visitPatterns.timePatterns.dayOfWeek.favorite) {
      const dayPref = visitPatterns.timePatterns.dayOfWeek.favorite;
      
      if (dayPref === 'weekdays') {
        insights.push("주로 평일에 장소를 방문하는 경향이 있습니다.");
      } else if (dayPref === 'weekend') {
        insights.push("주로 주말에 장소를 방문하는 경향이 있습니다.");
      }
    }
    
    // 카테고리 선호
    if (visitPatterns.categoryPatterns && visitPatterns.categoryPatterns.favoriteCategory) {
      const favCategory = visitPatterns.categoryPatterns.favoriteCategory;
      
      if (favCategory !== 'unknown') {
        insights.push(`'${favCategory}' 카테고리의 장소를 선호하는 것으로 보입니다.`);
      }
    }
    
    // 다양성
    if (visitPatterns.categoryPatterns && visitPatterns.categoryPatterns.diversity) {
      const diversity = visitPatterns.categoryPatterns.diversity;
      
      if (diversity === 'high') {
        insights.push("다양한 유형의 장소를 방문하는 경향이 있습니다.");
      } else if (diversity === 'low') {
        insights.push("몇 가지 특정 유형의 장소를 주로 방문하는 경향이 있습니다.");
      }
    }
    
    // 재방문 패턴
    if (visitPatterns.revisitPatterns && visitPatterns.revisitPatterns.revisitPattern) {
      const revisitPattern = visitPatterns.revisitPatterns.revisitPattern;
      
      if (revisitPattern === 'high') {
        insights.push("같은 장소를 자주 재방문하는 경향이 있습니다.");
      } else if (revisitPattern === 'low') {
        insights.push("새로운 장소를 찾아가는 것을 선호하는 것으로 보입니다.");
      }
    }
    
    return insights;
  };
  
  /**
 * 피드백 패턴 인사이트 생성
 * @param {Object} feedbackPatterns - 피드백 패턴 분석 결과
 * @returns {Array} 인사이트 문장 배열
 */
const generateFeedbackInsights = (feedbackPatterns) => {
    const insights = [];
    
    if (!feedbackPatterns || feedbackPatterns.totalFeedbacks === 0) {
      return ["아직 충분한 피드백 데이터가 없습니다."];
    }
    
    // 피드백 경향
    if (feedbackPatterns.positiveRatio > 0.7) {
      insights.push("대체로 방문한 장소에 긍정적인 평가를 하는 편입니다.");
    } else if (feedbackPatterns.criticalRatio > 0.5) {
      insights.push("방문한 장소에 비판적인 평가를 자주 하는 편입니다.");
    } else if (feedbackPatterns.averageRating > 3.5) {
      insights.push("방문한 장소에 대체로 만족하는 경향이 있습니다.");
    } else if (feedbackPatterns.averageRating < 2.5) {
      insights.push("방문한 장소에 대체로 만족하지 않는 경향이 있습니다.");
    }
    
    // 피드백 스타일
    if (feedbackPatterns.feedbackStyle === 'detailed') {
      insights.push("상세하고 꼼꼼한 피드백을 작성하는 편입니다.");
    } else if (feedbackPatterns.feedbackStyle === 'descriptive') {
      insights.push("장소에 대한 의견을 잘 표현하는 편입니다.");
    } else if (feedbackPatterns.feedbackStyle === 'concise') {
      insights.push("간결한 피드백을 선호하는 편입니다.");
    } else if (feedbackPatterns.feedbackStyle === 'rating_only') {
      insights.push("대부분 평점만 남기는 경향이 있습니다.");
    }
    
    // 긍정적인 태그
    if (feedbackPatterns.topPositiveTags && feedbackPatterns.topPositiveTags.length > 0) {
      const topTags = feedbackPatterns.topPositiveTags.slice(0, 2).map(t => t.tag).join(', ');
      insights.push(`특히 '${topTags}'와 같은 특성을 가진 장소에 긍정적입니다.`);
    }
    
    // 부정적인 태그
    if (feedbackPatterns.topNegativeTags && feedbackPatterns.topNegativeTags.length > 0) {
      const topTags = feedbackPatterns.topNegativeTags.slice(0, 2).map(t => t.tag).join(', ');
      insights.push(`'${topTags}'와 같은 특성을 가진 장소에는 덜 만족하는 경향이 있습니다.`);
    }
    
    return insights;
  };
  
  /**
   * 검색 패턴 인사이트 생성
   * @param {Object} searchPatterns - 검색 패턴 분석 결과
   * @returns {Array} 인사이트 문장 배열
   */
  const generateSearchInsights = (searchPatterns) => {
    const insights = [];
    
    if (!searchPatterns || searchPatterns.totalSearches === 0) {
      return ["아직 충분한 검색 데이터가 없습니다."];
    }
    
    // 검색 빈도
    if (searchPatterns.searchFrequency === 'high') {
      insights.push("장소를 매우 활발하게 검색하는 편입니다.");
    } else if (searchPatterns.searchFrequency === 'medium') {
      insights.push("정기적으로 장소를 검색하는 편입니다.");
    } else if (searchPatterns.searchFrequency === 'low') {
      insights.push("가끔씩 장소를 검색하는 편입니다.");
    }
    
    // 검색 스타일
    if (searchPatterns.searchStyle === 'category_focused') {
      insights.push("주로 특정 카테고리를 중심으로 검색하는 경향이 있습니다.");
    } else if (searchPatterns.searchStyle === 'exploratory') {
      insights.push("다양한 키워드로 폭넓게 검색하는 경향이 있습니다.");
    } else if (searchPatterns.searchStyle === 'specific') {
      insights.push("명확한 목적을 가지고 검색하는 경향이 있습니다.");
    } else if (searchPatterns.searchStyle === 'repetitive') {
      insights.push("몇 가지 특정 키워드로 반복적으로 검색하는 경향이 있습니다.");
    }
    
    // 클릭률
    if (searchPatterns.clickThroughRate > 0.8) {
      insights.push("검색 결과에서 관심 있는 장소를 적극적으로 탐색합니다.");
    } else if (searchPatterns.clickThroughRate < 0.3) {
      insights.push("검색 결과를 탐색하는 비율이 낮은 편입니다.");
    }
    
    // 자주 검색하는 카테고리
    if (searchPatterns.topSearchCategories && searchPatterns.topSearchCategories.length > 0) {
      const topCategory = searchPatterns.topSearchCategories[0].category;
      insights.push(`'${topCategory}' 카테고리를 자주 검색합니다.`);
    }
    
    return insights;
  };
  
  /**
   * 종합 인사이트 생성
   * @param {Object} patterns - 전체 패턴 분석 결과
   * @returns {Array} 인사이트 문장 배열
   */
  const generateSummaryInsights = (patterns) => {
    const insights = [];
    
    if (!patterns || (!patterns.visitPatterns && !patterns.feedbackPatterns && !patterns.searchPatterns)) {
      return ["아직 충분한 데이터가 없어 종합적인 인사이트를 제공하기 어렵습니다."];
    }
    
    // 사용자 유형
    if (patterns.userType) {
      if (patterns.userType === 'loyal') {
        insights.push("선호하는 장소에 충성도가 높은 편입니다.");
      } else if (patterns.userType === 'explorer') {
        insights.push("다양한 새로운 장소를 탐색하는 것을 즐깁니다.");
      } else if (patterns.userType === 'focused') {
        insights.push("특정 유형의 장소를 집중적으로 방문하는 편입니다.");
      }
    }
    
    // 선호 카테고리 및 시간대
    if (patterns.visitPatterns && patterns.visitPatterns.dominantPatterns) {
      const domPatterns = patterns.visitPatterns.dominantPatterns;
      
      if (domPatterns.categoryPreference && domPatterns.categoryPreference !== 'unknown') {
        insights.push(`주로 '${domPatterns.categoryPreference}' 카테고리의 장소를 선호합니다.`);
      }
      
      if (domPatterns.timePreference && domPatterns.dayPreference) {
        let timeStr = '';
        if (domPatterns.timePreference === 'morning') timeStr = '아침';
        else if (domPatterns.timePreference === 'afternoon') timeStr = '오후';
        else if (domPatterns.timePreference === 'evening') timeStr = '저녁';
        else if (domPatterns.timePreference === 'night') timeStr = '밤';
        
        let dayStr = '';
        if (domPatterns.dayPreference === 'weekdays') dayStr = '평일';
        else if (domPatterns.dayPreference === 'weekend') dayStr = '주말';
        
        if (timeStr && dayStr) {
          insights.push(`${dayStr} ${timeStr} 시간대에 주로 활동하는 편입니다.`);
        }
      }
    }
    
    // 추천 조정 인사이트
    if (patterns.personalizedWeights) {
      const weights = patterns.personalizedWeights;
      const defaultWeights = getDefaultWeights();
      
      // 가중치 변화가 큰 요소 찾기
      const changes = {};
      for (const key in weights) {
        if (Object.prototype.hasOwnProperty.call(weights, key) && 
            Object.prototype.hasOwnProperty.call(defaultWeights, key)) {
          changes[key] = weights[key] - defaultWeights[key];
        }
      }
      
      // 가장 크게 증가한 요소
      const sortedChanges = Object.entries(changes).sort((a, b) => b[1] - a[1]);
      if (sortedChanges.length > 0 && sortedChanges[0][1] > 0.03) {
        const factor = sortedChanges[0][0];
        let factorStr = '';
        
        if (factor === 'mbti') factorStr = 'MBTI 성향';
        else if (factor === 'interests') factorStr = '관심사';
        else if (factor === 'talents') factorStr = '재능';
        else if (factor === 'mood') factorStr = '감정 상태';
        else if (factor === 'location') factorStr = '위치 정보';
        
        if (factorStr) {
          insights.push(`행동 패턴을 바탕으로 ${factorStr}에 더 중점을 둔 추천을 제공합니다.`);
        }
      }
    }
    
    return insights;
  };

  /**
 * 방문 날짜를 사람이 읽기 쉬운 형식으로 변환하는 함수
 * @param {Date|string} date - 날짜 객체 또는 문자열
 * @returns {string} 사람이 읽기 쉬운 날짜 형식
 */
export const formatVisitDate = (date) => {
    if (!date) return '날짜 정보 없음';
    
    try {
      const visitDate = new Date(date);
      if (visitDate.toString() === 'Invalid Date') return '잘못된 날짜 형식';
      
      // 오늘로부터 얼마나 지났는지 (예: '3일 전', '약 1달 전')
      const relativeTime = formatDistanceToNow(visitDate, { 
        addSuffix: true,
        locale: ko 
      });
      
      // 구체적인 날짜 (예: '2023년 5월 15일')
      const formattedDate = format(visitDate, 'yyyy년 M월 d일', { locale: ko });
      
      return `${formattedDate} (${relativeTime})`;
    } catch (error) {
      console.error('날짜 형식 변환 오류:', error);
      return '날짜 처리 오류';
    }
  };
  
  /**
   * 방문 기간을 기준으로 방문 이력을 필터링하는 함수
   * @param {Array} visitHistory - 방문 이력 배열
   * @param {string} period - 기간 ('week', 'month', 'quarter', 'half_year', 'year', 'all')
   * @returns {Array} 필터링된 방문 이력
   */
  export const filterVisitsByPeriod = (visitHistory, period = 'all') => {
    if (!visitHistory || !Array.isArray(visitHistory)) return [];
    if (period === 'all') return [...visitHistory];
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = addDays(now, -7);
        break;
      case 'month':
        startDate = addDays(now, -30);
        break;
      case 'quarter':
        startDate = addDays(now, -90);
        break;
      case 'half_year':
        startDate = addDays(now, -180);
        break;
      case 'year':
        startDate = addDays(now, -365);
        break;
      default:
        return [...visitHistory];
    }
    
    return visitHistory.filter(visit => {
      if (!visit.visitDate) return false;
      
      const visitDate = new Date(visit.visitDate);
      return isWithinInterval(visitDate, { start: startDate, end: now });
    });
  };

  // 모듈 내보내기
  const userBehaviorAnalytics = {
    analyzeUserVisitPatterns,
    extractTimePatterns,
    extractCategoryPatterns,
    analyzeRevisitBehavior,
    analyzeFeedbackPatterns,
    analyzeSearchPatterns,
    generateUserBehaviorProfile,
    calculatePersonalizedWeights,
    getDefaultWeights,
    generateHumanReadableInsights,
    clearAnalyticsCache,
    clearUserAnalyticsCache,
    filterVisitsByPeriod,
    formatVisitDate
  };
  
  export default userBehaviorAnalytics;
