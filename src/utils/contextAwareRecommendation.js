/**
 * contextAwareRecommendation.js
 * 
 * 사용자의 컨텍스트 정보를 고려하여 추천을 개선하는 유틸리티 모듈
 * 시간, 날씨, 요일, 현재 감정 상태 등 다양한 컨텍스트 요소를 통합합니다.
 */

/**
 * 컨텍스트 요소를 추천 결과에 적용
 * @param {Array} recommendations - 기본 추천 장소 배열
 * @param {Object} contextData - 컨텍스트 데이터 (시간, 날씨, 감정 등)
 * @returns {Array} - 컨텍스트가 적용된 추천 장소 배열
 */
export const applyContextualFactors = (recommendations, contextData) => {
    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      return [];
    }
    
    if (!contextData) {
      return recommendations;
    }
    
    const { 
      time, 
      weather, 
      userMood, 
      recentActivity,
      dayOfWeek,
      location
    } = contextData;
    
    // 컨텍스트별 보정 계수 계산
    const timeFactors = calculateTimeFactors(time, dayOfWeek);
    const weatherFactors = calculateWeatherFactors(weather);
    const moodFactors = calculateMoodCompatibility(userMood);
    const activityFactors = calculateActivitySequence(recentActivity);
    const locationFactors = calculateLocationRelevance(location);
    
    // 추천 결과에 컨텍스트 보정 적용
    const adjustedRecommendations = recommendations.map(place => {
      // 각 컨텍스트 요소별 호환성 점수 계산
      const timeScore = calculateContextScore(place, timeFactors);
      const weatherScore = calculateContextScore(place, weatherFactors);
      const moodScore = calculateContextScore(place, moodFactors);
      const activityScore = calculateContextScore(place, activityFactors);
      const locationScore = calculateLocationScore(place, locationFactors);
      
      // 종합 컨텍스트 점수 (곱셈 방식으로 중요 요소 강조)
      const contextScore = timeScore * weatherScore * moodScore * 
                          Math.max(0.8, activityScore) * Math.max(0.8, locationScore);
      
      // 컨텍스트 조정 이유 추적
      const boostReasons = [];
      if (timeScore > 1.05) boostReasons.push('time');
      if (weatherScore > 1.05) boostReasons.push('weather');
      if (moodScore > 1.05) boostReasons.push('mood');
      if (activityScore > 1.05) boostReasons.push('activity_sequence');
      if (locationScore > 1.05) boostReasons.push('location');
      
      // 감소 이유 추적
      const reductionReasons = [];
      if (timeScore < 0.95) reductionReasons.push('time');
      if (weatherScore < 0.95) reductionReasons.push('weather');
      if (moodScore < 0.95) reductionReasons.push('mood');
      if (activityScore < 0.95) reductionReasons.push('activity_sequence');
      if (locationScore < 0.95) reductionReasons.push('location');
      
      return {
        ...place,
        matchScore: place.matchScore * contextScore,
        contextScore,
        contextBoost: contextScore > 1,
        contextReduction: contextScore < 1,
        boostReasons: boostReasons.length > 0 ? boostReasons : null,
        reductionReasons: reductionReasons.length > 0 ? reductionReasons : null,
        contextFactors: {
          timeScore,
          weatherScore,
          moodScore,
          activityScore,
          locationScore
        }
      };
    });
    
    // 컨텍스트 점수 기반 재정렬
    return adjustedRecommendations.sort((a, b) => b.matchScore - a.matchScore);
  };
  
  /**
   * 시간 및 요일 기반 컨텍스트 요소 계산
   * @param {Date|string|number} time - 현재 시간
   * @param {number|string} dayOfWeek - 요일 (0-6, 일요일부터 시작)
   * @returns {Object} - 시간 관련 컨텍스트 요소
   */
  export const calculateTimeFactors = (time, dayOfWeek) => {
    // 시간 정보가 없으면 중립적 요소 반환
    if (!time) {
      return { 
        timeOfDay: 'unknown',
        isDayTime: true,
        isWeekend: false,
        factors: {}
      };
    }
    
    // 시간 객체로 변환
    const dateTime = time instanceof Date ? time : new Date(time);
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    
    // 요일 처리
    const day = dayOfWeek !== undefined ? dayOfWeek : dateTime.getDay();
    const isWeekend = day === 0 || day === 6; // 0: 일요일, 6: 토요일
    
    // 시간대 분류
    let timeOfDay;
    if (hours >= 5 && hours < 11) {
      timeOfDay = 'morning';
    } else if (hours >= 11 && hours < 14) {
      timeOfDay = 'lunch';
    } else if (hours >= 14 && hours < 17) {
      timeOfDay = 'afternoon';
    } else if (hours >= 17 && hours < 21) {
      timeOfDay = 'evening';
    } else if (hours >= 21 || hours < 1) {
      timeOfDay = 'night';
    } else {
      timeOfDay = 'late_night';
    }
    
    // 주요 시간 기반 요소
    const isDayTime = hours >= 7 && hours < 19;
    const isDinnerTime = hours >= 18 && hours < 21;
    const isLunchTime = hours >= 11 && hours < 14;
    const isBreakfastTime = hours >= 6 && hours < 10;
    const isPeakHour = (hours >= 11 && hours < 14) || (hours >= 18 && hours < 21);
    
    // 장소 유형별 시간 선호도 요소
    const factors = {
      restaurant: {
        breakfast: isBreakfastTime ? 1.3 : (hours < 6 ? 0.7 : 1.0),
        lunch: isLunchTime ? 1.3 : ((hours >= 14 && hours < 16) ? 0.8 : 1.0),
        dinner: isDinnerTime ? 1.3 : ((hours >= 21 || hours < 5) ? 0.8 : 1.0)
      },
      cafe: {
        morning: (hours >= 8 && hours < 11) ? 1.2 : 1.0,
        afternoon: (hours >= 14 && hours < 17) ? 1.2 : 1.0,
        evening: (hours >= 18 && hours < 21) ? 1.1 : 1.0,
        lateNight: (hours >= 21 || hours < 1) ? (isPeakHour ? 0.9 : 1.1) : 1.0
      },
      bar: {
        daytime: (hours >= 12 && hours < 17) ? 0.8 : 1.0,
        evening: (hours >= 17 && hours < 21) ? 1.2 : 1.0,
        night: (hours >= 21 || hours < 2) ? 1.3 : 0.7
      },
      outdoorActivity: {
        morning: (hours >= 8 && hours < 11) ? 1.2 : 1.0,
        afternoon: (hours >= 12 && hours < 17) ? 1.1 : 1.0,
        evening: (hours >= 17 && hours < 20) ? (isDayTime ? 1.1 : 0.8) : 1.0,
        night: (hours >= 20 || hours < 5) ? 0.7 : 1.0
      },
      indoorActivity: {
        anytime: 1.0,
        badWeather: 1.2, // 날씨 정보와 결합 필요
        night: (hours >= 19 || hours < 6) ? 1.1 : 1.0
      },
      shopping: {
        daytime: (hours >= 10 && hours < 19) ? 1.1 : 1.0,
        evening: (hours >= 19 && hours < 22) ? (isWeekend ? 1.1 : 0.9) : 1.0,
        night: (hours >= 22 || hours < 6) ? 0.7 : 1.0
      },
      tourism: {
        morning: (hours >= 9 && hours < 12) ? 1.2 : 1.0,
        afternoon: (hours >= 12 && hours < 17) ? 1.1 : 1.0,
        evening: (hours >= 17 && hours < 20) ? 0.9 : 1.0,
        night: (hours >= 20 || hours < 7) ? 0.7 : 1.0
      }
    };
    
    // 요일별 추가 요소
    const dayFactors = {
      weekend: isWeekend ? {
        outdoorActivity: 1.2,
        cafe: 1.1,
        restaurant: 1.1,
        bar: 1.2,
        tourism: 1.2,
        shopping: 1.2
      } : {
        outdoorActivity: 1.0,
        cafe: 1.0,
        restaurant: 1.0,
        bar: 1.0,
        tourism: 1.0,
        shopping: 1.0
      },
      weekday: !isWeekend ? {
        workFriendly: (hours >= 9 && hours < 18) ? 1.2 : 1.0,
        quickLunch: (hours >= 11 && hours < 14) ? 1.2 : 1.0,
        afterWork: (hours >= 18 && hours < 21) ? 1.2 : 1.0
      } : {
        workFriendly: 1.0,
        quickLunch: 1.0,
        afterWork: 1.0
      }
    };
    
    return {
      timeOfDay,
      dayOfWeek: day,
      isWeekend,
      isDayTime,
      isPeakHour,
      currentHour: hours,
      currentMinute: minutes,
      factors,
      dayFactors
    };
  };
  
  /**
   * 날씨 기반 컨텍스트 요소 계산
   * @param {Object} weather - 날씨 정보
   * @returns {Object} - 날씨 관련 컨텍스트 요소
   */
  export const calculateWeatherFactors = (weather) => {
    // 날씨 정보가 없으면 중립적 요소 반환
    if (!weather) {
      return { 
        condition: 'unknown',
        isGoodWeather: true,
        factors: {}
      };
    }
    
    const { 
      condition, 
      temperature, 
      rainProbability, 
      humidity, 
      windSpeed,
      uvIndex
    } = weather;
    
    // 날씨 상태 정규화
    let normalizedCondition = 'unknown';
    if (condition) {
      if (/맑음|sunny|clear/i.test(condition)) {
        normalizedCondition = 'sunny';
      } else if (/구름|흐림|cloudy|overcast/i.test(condition)) {
        normalizedCondition = 'cloudy';
      } else if (/비|rain|shower/i.test(condition)) {
        normalizedCondition = 'rainy';
      } else if (/눈|snow/i.test(condition)) {
        normalizedCondition = 'snowy';
      } else if (/안개|fog|mist/i.test(condition)) {
        normalizedCondition = 'foggy';
      } else {
        normalizedCondition = condition.toLowerCase();
      }
    }
    
    // 야외 활동 적합성 평가
    const isRainy = normalizedCondition === 'rainy' || (rainProbability && rainProbability > 50);
    const isSnowy = normalizedCondition === 'snowy';
    const isFoggy = normalizedCondition === 'foggy';
    const isSunny = normalizedCondition === 'sunny';
    const isCloudy = normalizedCondition === 'cloudy';
    
    // 좋은 날씨 여부
    const isGoodWeather = !isRainy && !isSnowy && !isFoggy && 
                         (temperature === undefined || (temperature > 15 && temperature < 30));
    
    // 야외 활동 위험 날씨 (폭우, 폭설, 강풍 등)
    const isDangerousWeather = (isRainy && rainProbability > 80) || 
                              (windSpeed && windSpeed > 20) || 
                              (temperature !== undefined && (temperature > 35 || temperature < 0));
    
    // 장소 유형별 날씨 적합도 요소
    const factors = {
      outdoor: {
        sunny: isSunny ? (temperature && temperature > 30 ? 0.9 : 1.3) : 1.0,
        cloudy: isCloudy ? 1.1 : 1.0,
        rainy: isRainy ? 0.5 : 1.0,
        snowy: isSnowy ? 0.6 : 1.0,
        foggy: isFoggy ? 0.7 : 1.0,
        hot: temperature && temperature > 30 ? 0.8 : 1.0,
        cold: temperature && temperature < 5 ? 0.7 : 1.0,
        goodWeather: isGoodWeather ? 1.3 : 0.9,
        dangerousWeather: isDangerousWeather ? 0.2 : 1.0
      },
      indoor: {
        sunny: isSunny ? 0.9 : 1.0,
        cloudy: isCloudy ? 1.1 : 1.0,
        rainy: isRainy ? 1.3 : 1.0,
        snowy: isSnowy ? 1.3 : 1.0,
        foggy: isFoggy ? 1.2 : 1.0,
        badWeather: !isGoodWeather ? 1.3 : 0.9
      },
      cafe: {
        rainy: isRainy ? 1.2 : 1.0,
        snowy: isSnowy ? 1.1 : 1.0,
        sunny: isSunny ? 1.0 : 1.0,
        hot: temperature && temperature > 30 ? 1.2 : 1.0
      },
      restaurant: {
        allWeather: 1.0 // 식당은 날씨 영향 적음
      },
      viewpoint: {
        sunny: isSunny ? 1.3 : 1.0,
        cloudy: isCloudy ? 0.9 : 1.0,
        rainy: isRainy ? 0.6 : 1.0,
        foggy: isFoggy ? 0.5 : 1.0,
        goodVisibility: isSunny || (isCloudy && rainProbability < 30) ? 1.2 : 0.8
      }
    };
    
    return {
      condition: normalizedCondition,
      isRainy,
      isSnowy,
      isFoggy,
      isSunny,
      isCloudy,
      isGoodWeather,
      isDangerousWeather,
      temperature,
      rainProbability,
      humidity,
      windSpeed,
      uvIndex,
      factors
    };
  };
  
  /**
   * 사용자 감정 상태와 장소 간 호환성 계산
   * @param {Object} userMood - 사용자 감정 상태
   * @returns {Object} - 감정 관련 컨텍스트 요소
   */
  export const calculateMoodCompatibility = (userMood) => {
    // 감정 정보가 없으면 중립적 요소 반환
    if (!userMood || !userMood.mood) {
      return { 
        mood: 'neutral',
        intensity: 3,
        factors: {}
      };
    }
    
    const { mood, intensity = 3 } = userMood;
    
    // 감정 정규화
    let normalizedMood = mood.toLowerCase();
    
    // 강도에 따른 가중치 조정
    const intensityFactor = Math.max(1, intensity / 3);
    
    // 감정별 장소 유형 적합도
    const factors = {
      happy: {
        active: 1.2 * intensityFactor,
        social: 1.2 * intensityFactor,
        outdoors: 1.1,
        entertainment: 1.2,
        quiet: 0.9 / intensityFactor,
        serene: 0.8 / intensityFactor
      },
      sad: {
        quiet: 1.2 * intensityFactor,
        comfort: 1.2,
        natural: 1.1,
        cozy: 1.2,
        loud: 0.7 / intensityFactor,
        crowded: 0.8 / intensityFactor
      },
      stressed: {
        relaxing: 1.3 * intensityFactor,
        quiet: 1.2,
        natural: 1.2,
        serene: 1.2 * intensityFactor,
        loud: 0.6 / intensityFactor,
        crowded: 0.7 / intensityFactor,
        busy: 0.7 / intensityFactor
      },
      excited: {
        entertainment: 1.3 * intensityFactor,
        social: 1.2,
        active: 1.2 * intensityFactor,
        unique: 1.2,
        quiet: 0.8 / intensityFactor,
        serene: 0.7 / intensityFactor
      },
      relaxed: {
        natural: 1.1,
        quiet: 1.1,
        scenic: 1.2,
        comfort: 1.1,
        loud: 0.9,
        crowded: 0.9
      },
      bored: {
        entertainment: 1.3,
        active: 1.2,
        unique: 1.3,
        novel: 1.3,
        educational: 1.1,
        quiet: 0.8,
        routine: 0.7
      },
      tired: {
        relaxing: 1.3,
        comfort: 1.2,
        quiet: 1.1,
        convenience: 1.2,
        active: 0.7,
        crowded: 0.8,
        loud: 0.7
      },
      hungry: {
        restaurant: 1.4,
        cafe: 1.2,
        food: 1.3,
        convenience: 1.2,
        shopping: 0.9
      },
      romantic: {
        intimate: 1.3,
        scenic: 1.2,
        quiet: 1.1,
        cozy: 1.2,
        elegant: 1.2,
        crowded: 0.8,
        loud: 0.7
      }
    };
    
    // 감정에 해당하는 요소가 없으면 기본값 사용
    const moodFactors = factors[normalizedMood] || {
      neutral: 1.0
    };
    
    return {
      mood: normalizedMood,
      intensity,
      intensityFactor,
      factors: moodFactors
    };
  };
  
  /**
   * 최근 활동과의 연계성 평가
   * @param {Object} recentActivity - 최근 방문 활동 정보
   * @returns {Object} - 활동 연계 컨텍스트 요소
   */
  export const calculateActivitySequence = (recentActivity) => {
    // 최근 활동 정보가 없으면 중립적 요소 반환
    if (!recentActivity) {
      return {
        hasRecentActivity: false,
        factors: {}
      };
    }
    
    const { 
      placeType, 
      category, 
      timeElapsed, 
      activityTags 
    } = recentActivity;
    
    // 활동 경과 시간에 따른 연관성 감소
    let timeFactor = 1.0;
    if (timeElapsed) {
      if (timeElapsed < 30) { // 30분 이내
        timeFactor = 1.0;
      } else if (timeElapsed < 60) { // 1시간 이내
        timeFactor = 0.9;
      } else if (timeElapsed < 120) { // 2시간 이내
        timeFactor = 0.7;
      } else if (timeElapsed < 300) { // 5시간 이내
        timeFactor = 0.5;
      } else { // 5시간 이상
        timeFactor = 0.3;
      }
    }
    
    // 활동 시퀀스 패턴
    const sequencePatterns = {
      cafe: {
        restaurant: 1.1,
        shopping: 1.1,
        cafe: 0.7, // 같은 유형 반복 감소
        entertainment: 1.0,
        culture: 1.1
      },
      restaurant: {
        cafe: 1.2, // 식사 후 카페
        bar: 1.2, // 식사 후 술집
        entertainment: 1.1,
        restaurant: 0.7, // 같은 유형 반복 감소
        shopping: 1.0
      },
      shopping: {
        cafe: 1.2,
        restaurant: 1.1,
        shopping: 0.8, // 같은 유형 반복 약간 감소
        entertainment: 1.0,
        bar: 0.9
      },
      entertainment: {
        restaurant: 1.2,
        cafe: 1.1,
        bar: 1.1,
        entertainment: 0.8,
        culture: 0.9
      },
      culture: {
        cafe: 1.2,
        restaurant: 1.1,
        entertainment: 1.0,
        culture: 0.8,
        shopping: 1.0
      },
      outdoor: {
        cafe: 1.3,
        restaurant: 1.2,
        indoor: 1.1,
        outdoor: 0.9
      },
      indoor: {
        outdoor: 1.1,
        cafe: 1.0,
        restaurant: 1.0,
        indoor: 0.9
      },
      bar: {
        restaurant: 0.9,
        entertainment: 1.0,
        bar: 0.7, // 술집 연속 방문 감소
        cafe: 1.1
      }
    };
    
    // 장소 유형별 연계 패턴
    const categoryPattern = sequencePatterns[category] || sequencePatterns[placeType] || {
      neutral: 1.0
    };
    
    // 활동 태그 기반 패턴
    const tagPatterns = {};
    if (Array.isArray(activityTags)) {
      activityTags.forEach(tag => {
        if (tag === 'food') {
          tagPatterns.food = 0.8; // 식사 후 또 식사는 감소
          tagPatterns.dessert = 1.2; // 식사 후 디저트는 증가
          tagPatterns.coffee = 1.2; // 식사 후 커피는 증가
        } else if (tag === 'coffee') {
          tagPatterns.coffee = 0.8; // 커피 후 또 커피는 감소
          tagPatterns.activity = 1.1; // 커피 후 활동은 증가
        } else if (tag === 'active') {
          tagPatterns.relaxing = 1.2; // 활동적 장소 후 휴식 장소는 증가
          tagPatterns.active = 0.9; // 활동적 장소 연속 방문은 약간 감소
        } else if (tag === 'relaxing') {
          tagPatterns.active = 1.1; // 휴식 후 활동은 증가
          tagPatterns.relaxing = 0.9; // 휴식 연속은 약간 감소
        }
      });
    }
    
    return {
      hasRecentActivity: true,
      category: category || placeType,
      timeElapsed,
      timeFactor,
      activityTags: activityTags || [],
      factors: {
        categoryPatterns: categoryPattern,
        tagPatterns
      }
    };
  };
  
  /**
   * 위치 관련 컨텍스트 요소 계산
   * @param {Object} location - 현재 위치 정보
   * @returns {Object} - 위치 관련 컨텍스트 요소
   */
  export const calculateLocationRelevance = (location) => {
    // 위치 정보가 없으면 중립적 요소 반환
    if (!location || (!location.coordinates && !location.region)) {
      return { 
        hasLocation: false,
        factors: {}
      };
    }
    
    const { coordinates, region, subRegion, transportMode } = location;
    
    // 이동 수단에 따른 적정 거리 설정
    let maxDistance = 3000; // 기본 3km
    if (transportMode === 'walking') {
      maxDistance = 1500; // 도보 1.5km
    } else if (transportMode === 'bicycle') {
      maxDistance = 5000; // 자전거 5km
    } else if (transportMode === 'public') {
      maxDistance = 8000; // 대중교통 8km
    } else if (transportMode === 'car') {
      maxDistance = 15000; // 자동차 15km
    }
    
    // 거리 기반 적합도 함수 생성
    const createDistanceFactors = (maxDist) => {
      return {
        veryClose: (distance) => distance <= maxDist * 0.2 ? 1.3 : 1.0,
        close: (distance) => distance <= maxDist * 0.5 ? 1.2 : 1.0,
        medium: (distance) => distance <= maxDist * 0.8 ? 1.1 : 1.0,
        far: (distance) => distance > maxDist ? 0.8 : 1.0,
        veryFar: (distance) => distance > maxDist * 1.5 ? 0.6 : 1.0
      };
    };
    
    const distanceFactors = createDistanceFactors(maxDistance);
    
    // 지역 관련 요소
    const regionFactors = {
      sameRegion: region ? 1.2 : 1.0,
      sameSubRegion: subRegion ? 1.3 : 1.0,
      differentRegion: region ? 0.9 : 1.0
    };
    
    return {
      hasLocation: true,
      coordinates,
      region,
      subRegion,
      transportMode,
      maxDistance,
      factors: {
        distanceFactors,
        regionFactors
      }
    };
  };
  
  /**
   * 특정 장소와 컨텍스트 요소 간의 호환성 점수 계산
   * @param {Object} place - 장소 정보
   * @param {Object} contextFactor - 컨텍스트 요소
   * @returns {number} - 호환성 점수 (0-2, 1이 중립)
   */
  export const calculateContextScore = (place, contextFactor) => {
    if (!place || !contextFactor) return 1.0; // 정보 없으면 중립
    
    // 장소 특성 정보
    const placeType = place.category;
    const placeSubType = place.subCategory;
    const placeTags = Array.isArray(place.tags) ? place.tags : [];
    
    let score = 1.0; // 기본 중립 점수
    
    // 시간 컨텍스트 점수 계산
    if (contextFactor.factors && contextFactor.timeOfDay) {
      // 장소 유형별 시간 요소
      const typeFactors = contextFactor.factors[placeType] || contextFactor.factors.restaurant;
      if (typeFactors) {
        // 시간대별 점수 적용
        Object.entries(typeFactors).forEach(([timeKey, value]) => {
          if (typeof value === 'number') {
            score *= value;
          }
        });
      }
      
      // 요일별 추가 점수
      if (contextFactor.isWeekend && contextFactor.dayFactors && contextFactor.dayFactors.weekend) {
        const weekendFactor = contextFactor.dayFactors.weekend[placeType] || 1.0;
        score *= weekendFactor;
      } else if (!contextFactor.isWeekend && contextFactor.dayFactors && contextFactor.dayFactors.weekday) {
        // 평일 특화 장소 
        const workdayFactors = contextFactor.dayFactors.weekday;
        
        // 업무 친화적 장소 체크
        if (workdayFactors.workFriendly && placeTags.some(tag =>

            ['업무', '스터디', '조용한', '와이파이', 'wifi', '콘센트'].includes(tag))) {
                score *= workdayFactors.workFriendly;
              }
              
              // 점심 특화 장소 체크
              if (workdayFactors.quickLunch && 
                  (placeType === 'restaurant' || placeSubType === 'lunch')) {
                score *= workdayFactors.quickLunch;
              }
              
              // 퇴근 후 장소 체크
              if (workdayFactors.afterWork && 
                  (placeType === 'bar' || placeType === 'restaurant' || 
                   placeTags.some(tag => ['술집', '펍', '와인', '칵테일', '저녁식사'].includes(tag)))) {
                score *= workdayFactors.afterWork;
              }
            }
          }
          
          // 날씨 컨텍스트 점수 계산
          if (contextFactor.factors && (contextFactor.condition || contextFactor.isRainy !== undefined)) {
            // 실내/실외 구분
            const isOutdoor = placeTags.some(tag => 
              ['야외', '옥외', '테라스', '공원', '산책로', '정원'].includes(tag)) || 
              placeType === 'outdoor' || placeSubType === 'outdoor';
            
            const isIndoor = !isOutdoor || placeTags.some(tag => 
              ['실내', '에어컨', '난방'].includes(tag)) || 
              placeType === 'indoor' || placeSubType === 'indoor';
            
            if (isOutdoor && contextFactor.factors.outdoor) {
              // 날씨 조건 체크
              if (contextFactor.isRainy && contextFactor.factors.outdoor.rainy) {
                score *= contextFactor.factors.outdoor.rainy; // 비 오는 날 야외 장소 감소
              }
              
              if (contextFactor.isSunny && contextFactor.factors.outdoor.sunny) {
                score *= contextFactor.factors.outdoor.sunny; // 맑은 날 야외 장소 증가
              }
              
              if (contextFactor.isGoodWeather && contextFactor.factors.outdoor.goodWeather) {
                score *= contextFactor.factors.outdoor.goodWeather; // 좋은 날씨에 야외 장소 증가
              }
              
              if (contextFactor.isDangerousWeather && contextFactor.factors.outdoor.dangerousWeather) {
                score *= contextFactor.factors.outdoor.dangerousWeather; // 위험 날씨에 야외 장소 크게 감소
              }
            }
            
            if (isIndoor && contextFactor.factors.indoor) {
              // 실내 장소 날씨 영향
              if (contextFactor.isRainy && contextFactor.factors.indoor.rainy) {
                score *= contextFactor.factors.indoor.rainy; // 비 오는 날 실내 장소 증가
              }
              
              if (!contextFactor.isGoodWeather && contextFactor.factors.indoor.badWeather) {
                score *= contextFactor.factors.indoor.badWeather; // 나쁜 날씨에 실내 장소 증가
              }
            }
            
            // 특정 장소 유형별 날씨 영향
            if (placeType === 'cafe' && contextFactor.factors.cafe) {
              const cafeFactors = contextFactor.factors.cafe;
              
              if (contextFactor.isRainy && cafeFactors.rainy) {
                score *= cafeFactors.rainy; // 비 오는 날 카페 선호도 증가
              }
              
              if (contextFactor.temperature && contextFactor.temperature > 30 && cafeFactors.hot) {
                score *= cafeFactors.hot; // 더운 날 카페 선호도 증가
              }
            }
            
            // 전망 좋은 장소 날씨 영향
            const isViewpoint = placeTags.some(tag => 
              ['전망', '뷰', '루프탑', '옥상', '파노라마', '야경'].includes(tag)) || 
              placeSubType === 'viewpoint';
            
            if (isViewpoint && contextFactor.factors.viewpoint) {
              const viewFactors = contextFactor.factors.viewpoint;
              
              if (contextFactor.isSunny && viewFactors.sunny) {
                score *= viewFactors.sunny; // 맑은 날 전망 좋은 장소 증가
              }
              
              if (contextFactor.isFoggy && viewFactors.foggy) {
                score *= viewFactors.foggy; // 안개 낀 날 전망 좋은 장소 감소
              }
              
              if ((contextFactor.isSunny || (contextFactor.isCloudy && contextFactor.rainProbability < 30)) && 
                viewFactors.goodVisibility) {
                score *= viewFactors.goodVisibility; // 시야 좋은 날 전망 장소 증가
              }
            }
          }
          
          // 감정 상태 기반 점수 계산
          if (contextFactor.factors && contextFactor.mood) {
            const moodFactors = contextFactor.factors;
            
            // 장소 특성 태그와 감정 요소 매칭
            const placeCharacteristics = {
              active: placeTags.some(tag => 
                ['액티비티', '활동적', '스포츠', '운동', '체험'].includes(tag)),
              quiet: placeTags.some(tag => 
                ['조용한', '고요한', '평화로운', '사색', '명상'].includes(tag)),
              social: placeTags.some(tag => 
                ['사교적', '모임', '단체', '파티', '소셜'].includes(tag)),
              comfort: placeTags.some(tag => 
                ['편안한', '아늑한', '안락한', '소파', '힐링'].includes(tag)),
              scenic: placeTags.some(tag => 
                ['경치', '뷰', '전망', '풍경', '자연', '정원'].includes(tag)),
              unique: placeTags.some(tag => 
                ['독특한', '특별한', '이색', '새로운', '희귀한'].includes(tag)),
              entertainment: placeTags.some(tag => 
                ['엔터테인먼트', '놀이', '게임', '쇼', '공연'].includes(tag)),
              cozy: placeTags.some(tag => 
                ['아늑한', '따뜻한', '포근한', '인티메이트'].includes(tag)),
              loud: placeTags.some(tag => 
                ['시끄러운', '활기찬', '소음', '음악', '라이브'].includes(tag)),
              crowded: placeTags.some(tag => 
                ['붐비는', '혼잡한', '인기', '대기', '줄서는'].includes(tag)),
              convenient: placeTags.some(tag => 
                ['편리한', '접근성', '교통', '주차', '근처'].includes(tag)),
              natural: placeTags.some(tag => 
                ['자연', '공원', '산', '물', '강', '녹지'].includes(tag)),
              food: placeTags.some(tag => 
                ['음식', '식사', '맛집', '레스토랑', '다이닝'].includes(tag)) || 
                placeType === 'restaurant',
              coffee: placeTags.some(tag => 
                ['커피', '카페', '차', '디저트'].includes(tag)) || 
                placeType === 'cafe'
            };
            
            // 각 감정 관련 특성에 따라 점수 조정
            Object.entries(placeCharacteristics).forEach(([trait, has]) => {
              if (has && moodFactors[trait]) {
                score *= moodFactors[trait];
              }
            });
          }
          
          // 활동 연속성 점수 계산
          if (contextFactor.factors && contextFactor.hasRecentActivity) {
            const { categoryPatterns, tagPatterns } = contextFactor.factors;
            
            // 현재 장소 유형에 대한 활동 연속성 점수
            if (categoryPatterns && categoryPatterns[placeType]) {
              score *= categoryPatterns[placeType] * contextFactor.timeFactor;
            }
            
            // 태그 기반 활동 연속성
            if (tagPatterns) {
              Object.entries(tagPatterns).forEach(([tag, factor]) => {
                if (placeTags.some(placeTag => placeTag.includes(tag))) {
                  score *= factor * contextFactor.timeFactor;
                }
              });
            }
          }
          
          // 점수 제한 (너무 극단적인 값 방지)
          return Math.max(0.5, Math.min(2.0, score));
        };
        
        /**
         * 위치 기반 점수 계산 (거리 및 지역 기반)
         * @param {Object} place - 장소 정보
         * @param {Object} locationFactor - 위치 컨텍스트 요소
         * @returns {number} - 위치 기반 점수 (0-2, 1이 중립)
         */
        export const calculateLocationScore = (place, locationFactor) => {
          if (!place || !locationFactor || !locationFactor.hasLocation) return 1.0;
          
          let score = 1.0;
          
          // 거리 기반 점수 계산
          if (locationFactor.coordinates && place.coordinates && 
              typeof place.distance === 'number') {
            const { distanceFactors } = locationFactor.factors;
            
            // 거리별 점수 적용
            if (distanceFactors.veryClose && place.distance <= locationFactor.maxDistance * 0.2) {
              score *= distanceFactors.veryClose(place.distance);
            } else if (distanceFactors.close && place.distance <= locationFactor.maxDistance * 0.5) {
              score *= distanceFactors.close(place.distance);
            } else if (distanceFactors.medium && place.distance <= locationFactor.maxDistance * 0.8) {
              score *= distanceFactors.medium(place.distance);
            } else if (distanceFactors.far && place.distance > locationFactor.maxDistance) {
              score *= distanceFactors.far(place.distance);
            } else if (distanceFactors.veryFar && place.distance > locationFactor.maxDistance * 1.5) {
              score *= distanceFactors.veryFar(place.distance);
            }
          }
          
          // 지역 기반 점수 계산
          if (locationFactor.region && place.location) {
            const { region, subRegion } = locationFactor;
            const placeRegion = place.location.region;
            const placeSubRegion = place.location.subRegion;
            
            const { regionFactors } = locationFactor.factors;
            
            // 동일 지역 체크
            if (placeRegion && placeRegion === region) {
              score *= regionFactors.sameRegion;
              
              // 동일 세부 지역 체크
              if (placeSubRegion && subRegion && placeSubRegion === subRegion) {
                score *= regionFactors.sameSubRegion;
              }
            } else if (placeRegion && placeRegion !== region) {
              score *= regionFactors.differentRegion;
            }
          }
          
          // 점수 제한
          return Math.max(0.5, Math.min(2.0, score));
        };
        
        /**
         * 하루 중 현재 시간대 가져오기
         * @param {Date} [date] - 기준 날짜/시간 (기본값: 현재)
         * @returns {Object} - 시간대 정보
         */
        export const getCurrentTimeContext = (date = new Date()) => {
          return calculateTimeFactors(date);
        };
        
        /**
         * 요일 이름 가져오기 (한글)
         * @param {number} dayOfWeek - 요일 번호 (0: 일요일, 6: 토요일)
         * @returns {string} - 요일 이름
         */
        export const getDayOfWeekName = (dayOfWeek) => {
          const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
          return days[dayOfWeek % 7];
        };
        
        /**
         * 시간대 이름 가져오기 (한글)
         * @param {string} timeOfDay - 시간대 코드
         * @returns {string} - 시간대 이름
         */
        export const getTimeOfDayName = (timeOfDay) => {
          const timeNames = {
            morning: '아침',
            lunch: '점심',
            afternoon: '오후',
            evening: '저녁',
            night: '밤',
            late_night: '심야'
          };
          
          return timeNames[timeOfDay] || timeOfDay;
        };
        
        /**
         * 날씨 상태 이름 가져오기 (한글)
         * @param {string} condition - 날씨 상태 코드
         * @returns {string} - 날씨 상태 이름
         */
        export const getWeatherConditionName = (condition) => {
          const conditionNames = {
            sunny: '맑음',
            cloudy: '흐림',
            rainy: '비',
            snowy: '눈',
            foggy: '안개'
          };
          
          return conditionNames[condition] || condition;
        };
        
        /**
         * 감정 상태 이름 가져오기 (한글)
         * @param {string} mood - 감정 상태 코드
         * @returns {string} - 감정 상태 이름
         */
        export const getMoodName = (mood) => {
          const moodNames = {
            happy: '기쁨',
            sad: '슬픔',
            stressed: '스트레스',
            excited: '설렘',
            relaxed: '평온함',
            bored: '지루함',
            tired: '피곤함',
            hungry: '배고픔',
            romantic: '로맨틱함'
          };
          
          return moodNames[mood] || mood;
        };
        
        /**
         * 컨텍스트 요인 설명 생성
         * @param {Object} place - 장소 정보
         * @param {Object} contextData - 컨텍스트 데이터
         * @returns {Object} - 컨텍스트 요인 설명
         */
        export const generateContextExplanation = (place, contextData) => {
          if (!place || !contextData) return null;
          
          const reasons = [];
          const { 
            time, 
            weather, 
            userMood, 
            recentActivity,
            dayOfWeek,
            location
          } = contextData;
          
          // 시간 컨텍스트 설명
          if (time) {
            const timeContext = calculateTimeFactors(time, dayOfWeek);
            const timeOfDayName = getTimeOfDayName(timeContext.timeOfDay);
            const dayOfWeekName = getDayOfWeekName(timeContext.dayOfWeek);
            
            // 특정 장소 유형과 시간 조합에 따른 설명
            if (place.category === 'cafe' && timeContext.timeOfDay === 'afternoon') {
              reasons.push(`${timeOfDayName} 시간대에 카페를 방문하기 좋은 시간입니다.`);
            } else if (place.category === 'restaurant' && timeContext.timeOfDay === 'lunch') {
              reasons.push(`현재 ${timeOfDayName} 시간대로 식사하기 좋은 시간입니다.`);
            } else if (place.category === 'restaurant' && timeContext.timeOfDay === 'evening') {
              reasons.push(`${timeOfDayName} 식사에 적합한 시간대입니다.`);
            } else if (place.category === 'bar' && (timeContext.timeOfDay === 'evening' || timeContext.timeOfDay === 'night')) {
              reasons.push(`${timeOfDayName} 시간대에 방문하기 좋은 장소입니다.`);
            }
            
            // 요일 관련 설명
            if (timeContext.isWeekend) {
              reasons.push(`${dayOfWeekName}이라 여유롭게 방문하기 좋은 날입니다.`);
            } else if (place.category === 'restaurant' && timeContext.timeOfDay === 'lunch' && !timeContext.isWeekend) {
              reasons.push(`평일 점심 시간대에 방문하기 좋은 장소입니다.`);
            }
          }
          
          // 날씨 컨텍스트 설명
          if (weather) {
            const weatherContext = calculateWeatherFactors(weather);
            
            // 장소 특성 태그
            const isOutdoor = (place.tags && place.tags.some(tag => 
                ['야외', '옥외', '테라스', '공원', '산책로'].includes(tag))) || 
                place.category === 'outdoor';
            
            const isIndoor = !isOutdoor || ((place.tags && place.tags.some(tag => 
                ['실내', '에어컨', '난방'].includes(tag))) || 
                place.category === 'indoor');
            
            // 날씨별 설명
            if (weatherContext.isRainy) {
              if (isIndoor) {
                reasons.push(`비 오는 날씨에 실내에서 즐기기 좋은 장소입니다.`);
              } else if (isOutdoor) {
                reasons.push(`현재 비가 오고 있어 야외 장소 방문은 권장하지 않습니다.`);
              }
            } else if (weatherContext.isSunny) {
              if (isOutdoor) {
                reasons.push(`맑은 날씨에 야외에서 즐기기 좋은 장소입니다.`);
              }
            }
            
            if (weatherContext.temperature !== undefined) {
              if (weatherContext.temperature > 30 && isIndoor && place.category === 'cafe') {
                reasons.push(`더운 날씨에 시원한 카페에서 휴식하기 좋습니다.`);
              } else if (weatherContext.temperature < 5 && isIndoor) {
                reasons.push(`추운 날씨에 따뜻한 실내에서 머물기 좋은 장소입니다.`);
              }
            }
          }
          
          // 감정 컨텍스트 설명
          if (userMood && userMood.mood) {
            const moodContext = calculateMoodCompatibility(userMood);
            const moodName = getMoodName(moodContext.mood);
            
            // 감정별 설명
            if (moodContext.mood === 'happy' || moodContext.mood === 'excited') {
              if (place.tags && place.tags.some(tag => ['활기찬', '신나는', '재미있는'].includes(tag))) {
                reasons.push(`현재 ${moodName} 감정과 잘 어울리는 활기찬 장소입니다.`);
              }
            } else if (moodContext.mood === 'stressed' || moodContext.mood === 'tired') {
              if (place.tags && place.tags.some(tag => ['조용한', '편안한', '힐링'].includes(tag))) {
                reasons.push(`${moodName} 상태에 편안한 휴식을 취하기 좋은 장소입니다.`);
              }
            } else if (moodContext.mood === 'sad') {
              if (place.tags && place.tags.some(tag => ['따뜻한', '아늑한', '위로'].includes(tag))) {
                reasons.push(`${moodName} 감정에 위로가 되는 따뜻한 분위기의 장소입니다.`);
              }
            } else if (moodContext.mood === 'bored') {
              if (place.tags && place.tags.some(tag => ['독특한', '새로운', '체험'].includes(tag))) {
                reasons.push(`${moodName} 감정을 해소할 수 있는 새로운 경험을 제공하는 장소입니다.`);
              }
            } else if (moodContext.mood === 'romantic') {
              if (place.tags && place.tags.some(tag => ['로맨틱', '분위기', '데이트'].includes(tag))) {
                reasons.push(`${moodName} 감정에 어울리는 분위기 좋은 장소입니다.`);
              }
            }
          }
          
          // 최근 활동 관련 설명
          if (recentActivity && recentActivity.placeType) {
            const activityContext = calculateActivitySequence(recentActivity);
            
            if (activityContext.category === 'restaurant' && place.category === 'cafe') {
              reasons.push(`식사 후 디저트나 커피를 즐기기 좋은 장소입니다.`);
            } else if (activityContext.category === 'cafe' && place.category === 'shopping') {
              reasons.push(`카페에서 휴식 후 쇼핑하기 좋은 장소입니다.`);
            } else if (activityContext.category === 'outdoor' && isIndoorPlace(place)) {
              reasons.push(`야외 활동 후 실내에서 휴식하기 좋은 장소입니다.`);
            }
          }
          
          // 위치 관련 설명
          if (location && (location.coordinates || location.region)) {
            const locationContext = calculateLocationRelevance(location);
            
            if (place.distance !== undefined) {
              if (place.distance < locationContext.maxDistance * 0.2) {
                reasons.push(`현재 위치에서 가까운 거리에 있는 장소입니다.`);
              } else if (place.distance > locationContext.maxDistance) {
                reasons.push(`현재 위치에서 다소 먼 거리에 있는 장소입니다.`);
              }
            }
            
            if (location.region && place.location && place.location.region === location.region) {
              if (location.subRegion && place.location.subRegion === location.subRegion) {
                reasons.push(`선호하는 ${place.location.subRegion} 지역 내에 있는 장소입니다.`);
              } else {
                reasons.push(`선호하는 ${place.location.region} 지역 내에 있는 장소입니다.`);
              }
            }
          }
          
          return {
            contextReasons: reasons,
            hasContextExplanation: reasons.length > 0
          };
        };
        
        /**
         * 장소가 실내인지 확인
         * @param {Object} place - 장소 정보
         * @returns {boolean} - 실내 장소 여부
         */
        const isIndoorPlace = (place) => {
          return place.category === 'indoor' || 
            (place.tags && place.tags.some(tag => 
              ['실내', '에어컨', '난방', '카페', '레스토랑', '쇼핑몰'].includes(tag)));
        };
        
        // 모듈 내보내기
        const contextAwareRecommendation = {
          applyContextualFactors,
          calculateTimeFactors,
          calculateWeatherFactors,
          calculateMoodCompatibility,
          calculateActivitySequence,
          calculateLocationRelevance,
          calculateContextScore,
          calculateLocationScore,
          getCurrentTimeContext,
          generateContextExplanation,
          getDayOfWeekName,
          getTimeOfDayName,
          getWeatherConditionName,
          getMoodName
        };
        
        export default contextAwareRecommendation;
