// src/services/weatherService.js

import { db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// 환경 변수
const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const WEATHER_API_URL = process.env.REACT_APP_WEATHER_API_ENDPOINT || 'https://api.openweathermap.org/data/2.5/weather';
const CACHE_DURATION = parseInt(process.env.REACT_APP_CACHE_DURATION || '3600000'); // 기본 1시간
const isEnabled = process.env.REACT_APP_FEATURE_WEATHER_API === 'true';

/**
 * 현재 위치의 날씨 정보 조회
 * @param {number} latitude - 위도
 * @param {number} longitude - 경도
 * @returns {Promise<Object|null>} 날씨 정보 객체 또는 null
 */
export const getCurrentWeather = async (latitude, longitude) => {
  if (!isEnabled || !WEATHER_API_KEY) {
    console.warn('[Weather] API 키가 없거나 기능이 비활성화되었습니다.');
    return null;
  }

  try {
    // 위치를 소수점 두 자리로 반올림하여 캐시 키 생성 (프라이버시 향상)
    const roundedLat = Math.round(latitude * 100) / 100;
    const roundedLon = Math.round(longitude * 100) / 100;
    const cacheKey = `weather_${roundedLat}_${roundedLon}`;
    
    // 캐시 확인
    const cacheRef = doc(db, 'weatherCache', cacheKey);
    const cacheSnapshot = await getDoc(cacheRef);
    
    const now = new Date();
    if (cacheSnapshot.exists()) {
      const cachedData = cacheSnapshot.data();
      const cacheTime = cachedData.timestamp.toDate();
      
      // 캐시가 유효한지 확인 (1시간 이내)
      if ((now - cacheTime) < CACHE_DURATION) {
        console.log('[Weather] 캐시에서 날씨 정보 로드');
        return cachedData.weatherData;
      }
    }
    
    // API 호출
    const response = await fetch(
      `${WEATHER_API_URL}?lat=${latitude}&lon=${longitude}&units=metric&lang=kr&appid=${WEATHER_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`날씨 API 오류: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 필요한 데이터만 추출
    const weatherData = {
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      weather: {
        id: data.weather[0].id,
        main: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon
      },
      wind: {
        speed: data.wind.speed,
        deg: data.wind.deg
      },
      clouds: data.clouds.all,
      rain: data.rain ? data.rain['1h'] : 0,
      snow: data.snow ? data.snow['1h'] : 0,
      timestamp: now
    };
    
    // 캐시에 저장
    await setDoc(cacheRef, {
      weatherData,
      timestamp: now,
      location: {
        latitude: roundedLat,
        longitude: roundedLon
      }
    });
    
    return weatherData;
  } catch (error) {
    console.error('[Weather] 날씨 정보 가져오기 실패:', error);
    return null;
  }
};

/**
 * 날씨 상태를 한글로 변환
 * @param {string} weatherMain - 날씨 상태 (영문)
 * @returns {string} 한글 날씨 상태
 */
export const translateWeatherCondition = (weatherMain) => {
  const translations = {
    'Clear': '맑음',
    'Clouds': '구름',
    'Drizzle': '이슬비',
    'Rain': '비',
    'Thunderstorm': '천둥번개',
    'Snow': '눈',
    'Mist': '안개',
    'Smoke': '연무',
    'Haze': '실안개',
    'Dust': '먼지',
    'Fog': '안개',
    'Sand': '모래',
    'Ash': '화산재',
    'Squall': '돌풍',
    'Tornado': '토네이도'
  };
  
  return translations[weatherMain] || weatherMain;
};

/**
 * 날씨 아이콘 URL 가져오기
 * @param {string} iconCode - 날씨 아이콘 코드
 * @returns {string} 아이콘 URL
 */
export const getWeatherIconUrl = (iconCode) => {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};

/**
 * 장소의 날씨 적합도 점수 계산
 * @param {Object} place - 장소 정보
 * @param {Object} weatherData - 날씨 정보
 * @returns {number} 적합도 점수 (1-10)
 */
export const calculateWeatherScore = (place, weatherData) => {
  if (!weatherData || !place) {
    return 5; // 기본값
  }
  
  // 장소에 날씨 적합도 정보가 없는 경우
  if (!place.weatherCompatibility) {
    // 기본 적합도 계산
    return calculateDefaultWeatherScore(place, weatherData);
  }
  
  // 날씨 상태에 따른 점수 할당
  let weatherType = 'neutral';
  const weatherId = weatherData.weather.id;
  
  // 맑음 (800: 맑음, 801: 구름 조금)
  if (weatherId === 800 || weatherId === 801) {
    weatherType = 'sunny';
  }
  // 흐림 (802-804: 구름 많음 ~ 흐림)
  else if (weatherId >= 802 && weatherId <= 804) {
    weatherType = 'cloudy';
  }
  // 비 (300-321: 이슬비, 500-531: 비)
  else if ((weatherId >= 300 && weatherId <= 321) || (weatherId >= 500 && weatherId <= 531)) {
    weatherType = 'rainy';
  }
  // 눈 (600-622: 눈)
  else if (weatherId >= 600 && weatherId <= 622) {
    weatherType = 'snowy';
  }
  // 폭풍, 안개, 기타 (나머지)
  else {
    weatherType = 'extreme';
  }
  
  // 장소의 날씨 적합도 점수 가져오기
  return place.weatherCompatibility[weatherType] || 5;
};

/**
 * 기본 날씨 적합도 점수 계산
 * @param {Object} place - 장소 정보
 * @param {Object} weatherData - 날씨 정보
 * @returns {number} 적합도 점수 (1-10)
 */
const calculateDefaultWeatherScore = (place, weatherData) => {
  let score = 5; // 기본 점수
  const weatherId = weatherData.weather.id;
  const temperature = weatherData.temperature;
  const isOutdoor = place.category === 'park' || 
                    place.category === 'attraction' || 
                    place.specialFeatures?.includes('야외');
  const isIndoor = place.category === 'cafe' || 
                   place.category === 'restaurant' || 
                   place.category === 'shopping' || 
                   place.specialFeatures?.includes('실내');
  
  // 야외 장소인 경우
  if (isOutdoor) {
    // 맑은 날씨는 야외에 좋음
    if (weatherId === 800) {
      score += 3;
    } 
    // 구름 약간은 야외에도 좋음
    else if (weatherId === 801) {
      score += 2;
    }
    // 구름 많음은 보통
    else if (weatherId >= 802 && weatherId <= 803) {
      score += 0;
    }
    // 비, 눈, 폭풍 등은 야외에 안 좋음
    else if (weatherId >= 300) {
      score -= 3;
    }
    
    // 온도 기반 점수 조정
    if (temperature > 10 && temperature < 28) {
      score += 1; // 적당한 온도
    } else if (temperature <= 0 || temperature >= 35) {
      score -= 2; // 극단적인 온도
    }
  }
  // 실내 장소인 경우
  else if (isIndoor) {
    // 날씨가 좋지 않을 때 실내가 선호됨
    if (weatherId >= 300) {
      score += 2;
    }
    // 극단적인 온도에서도 실내가 선호됨
    if (temperature <= 0 || temperature >= 30) {
      score += 2;
    }
  }
  
  // 특별 기능 기반 점수 조정
  if (place.specialFeatures) {
    // 비 오는 날 분위기 좋은 장소
    if (place.specialFeatures.includes('우천시 분위기') && 
        (weatherId >= 300 && weatherId <= 531)) {
      score += 3;
    }
    // 눈 오는 날 분위기 좋은 장소
    if (place.specialFeatures.includes('눈 오는 날 분위기') && 
        (weatherId >= 600 && weatherId <= 622)) {
      score += 3;
    }
    // 야외 테라스가 있는 장소는 맑은 날 더 좋음
    if (place.specialFeatures.includes('야외 테라스') && weatherId === 800) {
      score += 2;
    }
  }
  
  // 최종 점수 범위 조정 (1-10)
  return Math.max(1, Math.min(10, score));
};

/**
 * 날씨 기반 추천 문구 생성
 * @param {Object} place - 장소 정보
 * @param {Object} weatherData - 날씨 정보
 * @returns {string|null} 추천 문구 또는 null
 */
export const getWeatherRecommendationText = (place, weatherData) => {
  if (!weatherData || !place) {
    return null;
  }
  
  const weatherId = weatherData.weather.id;
  const temperature = weatherData.temperature;
  const weatherDesc = translateWeatherCondition(weatherData.weather.main);
  
  // 맑은 날씨 (800: 맑음, 801: 구름 조금)
  if (weatherId === 800 || weatherId === 801) {
    if (place.category === 'cafe' && place.specialFeatures?.includes('야외 테라스')) {
      return `오늘같이 ${weatherDesc} 날씨에 테라스에서 시간을 보내기 좋은 장소입니다.`;
    } else if (place.category === 'park' || place.category === 'nature') {
      return `화창한 오늘, 야외 활동하기 좋은 날씨에 추천하는 장소입니다.`;
    }
  } 
  // 흐린 날씨 (802-804: 구름 많음 ~ 흐림)
  else if (weatherId >= 802 && weatherId <= 804) {
    if (place.specialFeatures?.includes('분위기 좋은')) {
      return `흐린 날씨에도 아늑한 분위기를 즐길 수 있는 장소입니다.`;
    }
  } 
  // 비 (300-321: 이슬비, 500-531: 비)
  else if ((weatherId >= 300 && weatherId <= 321) || (weatherId >= 500 && weatherId <= 531)) {
    if (place.specialFeatures?.includes('우천시 실내')) {
      return `비 오는 날에도 편안하게 즐길 수 있는 실내 장소입니다.`;
    } else if (place.specialFeatures?.includes('우천시 분위기')) {
      return `비 오는 날 특별한 분위기를 느낄 수 있는 장소입니다.`;
    }
  } 
  // 눈 (600-622: 눈)
  else if (weatherId >= 600 && weatherId <= 622) {
    if (place.specialFeatures?.includes('눈 오는 날 분위기')) {
      return `눈 내리는 날 특별한 분위기를 느낄 수 있는 장소입니다.`;
    }
  }
  
  // 온도별 추천 문구
  if (temperature < 5) {
    if (place.specialFeatures?.includes('따뜻한 음료')) {
      return `추운 날씨에 따뜻한 음료를 즐길 수 있는 좋은 장소입니다.`;
    }
    return `추운 날씨에 따뜻함을 느낄 수 있는 장소입니다.`;
  } else if (temperature >= 5 && temperature < 15) {
    return `선선한 날씨에 적합한 장소입니다.`;
  } else if (temperature >= 15 && temperature < 25) {
    return `쾌적한 날씨에 방문하기 좋은 장소입니다.`;
  } else {
    if (place.specialFeatures?.includes('시원한')) {
      return `더운 날씨에 시원함을 느낄 수 있는 장소입니다.`;
    }
    return `따뜻한 날씨에 방문하기 좋은 장소입니다.`;
  }
};

export default {
    getCurrentWeather,
    translateWeatherCondition,
    getWeatherIconUrl,
    calculateWeatherScore,
    getWeatherRecommendationText
  };
