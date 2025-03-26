/**
 * API 프록시 함수
 * 
 * 이 모듈은 외부 API(Maps, Places, 날씨 등)에 대한 프록시 함수를 제공합니다.
 * API 키를 클라이언트에 노출하지 않고 안전하게 외부 API를 호출할 수 있습니다.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const { assertAuthenticated } = require('./security');

// 리전 설정 (한국 기준 가까운 리전 사용)
const region = 'asia-northeast3'; // 서울 리전

// Firestore 참조
const db = admin.firestore();

/**
 * 맵스 API 프록시 함수 - 주변 장소 검색
 */
exports.nearbyPlaces = functions.region(region).https.onCall(async (data, context) => {
  // 인증 확인
  const uid = assertAuthenticated(context);
  
  // 데이터 유효성 검사
  if (!data.location || 
      typeof data.location.latitude !== 'number' || 
      typeof data.location.longitude !== 'number') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효한 위치 정보가 필요합니다.'
    );
  }
  
  try {
    // 사용량 로깅
    await logApiUsage(uid, 'nearbyPlaces', {
      lat: data.location.latitude,
      lng: data.location.longitude,
      radius: data.radius || 1000,
      type: data.type || ''
    });

/**
 * 날씨 API 프록시 함수
 */
exports.getWeather = functions.region(region).https.onCall(async (data, context) => {
  // 인증 확인
  const uid = assertAuthenticated(context);
  
  // 날씨 API 활성화 여부 확인
  const appConfig = await db.collection('appConfig').doc('features').get();
  const enableWeather = appConfig.exists ? appConfig.data().enableWeather === true : false;
  
  if (!enableWeather) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '날씨 API 기능이 비활성화되어 있습니다.'
    );
  }
  
  // 데이터 유효성 검사
  if (!data.location || 
      typeof data.location.latitude !== 'number' || 
      typeof data.location.longitude !== 'number') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효한 위치 정보가 필요합니다.'
    );
  }
  
  try {
    // 캐시된 응답 확인 (날씨 데이터는 자주 변경되므로 캐시 시간이 짧음)
    const cachedData = await getCachedResponse('getWeather', data);
    if (cachedData && !data.bypassCache) {
      return cachedData;
    }
    
    // 사용량 로깅
    await logApiUsage(uid, 'getWeather', {
      lat: data.location.latitude,
      lng: data.location.longitude
    });
    
    // API 호출 속도 제한 확인
    await checkRateLimit(uid, 'weather');
    
    // 날씨 API 호출 (OpenWeatherMap API 예시)
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat: data.location.latitude,
        lon: data.location.longitude,
        units: 'metric',
        lang: 'kr',
        appid: functions.config().weather.api_key // 환경 변수에서 API 키 가져오기
      }
    });
    
    // 응답 데이터 캐싱 (30분)
    await cacheResponse('getWeather', data, response.data, 30 * 60);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw new functions.https.HttpsError(
      'internal',
      '날씨 정보를 가져오는 중 오류가 발생했습니다.',
      error.message
    );
  }
});

/**
 * 지오코딩 API 프록시 함수 - 주소 검색
 */
exports.geocode = functions.region(region).https.onCall(async (data, context) => {
  // 인증 확인
  const uid = assertAuthenticated(context);
  
  // 데이터 유효성 검사
  if ((!data.address && !data.location) || 
      (data.location && (typeof data.location.latitude !== 'number' || 
                          typeof data.location.longitude !== 'number'))) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효한 주소 또는 위치 정보가 필요합니다.'
    );
  }
  
  try {
    // 캐시된 응답 확인
    const cachedData = await getCachedResponse('geocode', data);
    if (cachedData && !data.bypassCache) {
      return cachedData;
    }
    
    // 사용량 로깅
    await logApiUsage(uid, 'geocode', {
      address: data.address || null,
      location: data.location || null
    });
    
    // API 호출 속도 제한 확인
    await checkRateLimit(uid, 'maps');
    
    let url = 'https://maps.googleapis.com/maps/api/geocode/json';
    let params = {
      key: functions.config().maps.api_key,
      language: 'ko'
    };
    
    // 주소 -> 좌표 (지오코딩)
    if (data.address) {
      params.address = data.address;
    }
    // 좌표 -> 주소 (역지오코딩)
    else if (data.location) {
      params.latlng = `${data.location.latitude},${data.location.longitude}`;
    }
    
    // Google Geocoding API 호출
    const response = await axios.get(url, { params });
    
    // 응답 데이터 캐싱 (1일)
    await cacheResponse('geocode', data, response.data, 24 * 60 * 60);
    
    return response.data;
  } catch (error) {
    console.error('Error with geocoding:', error);
    throw new functions.https.HttpsError(
      'internal',
      '지오코딩 중 오류가 발생했습니다.',
      error.message
    );
  }
});

// -------------------------------------------------------------------------
// 유틸리티 함수
// -------------------------------------------------------------------------

/**
 * API 사용량 로깅
 * @param {string} userId 사용자 ID
 * @param {string} functionName 함수 이름
 * @param {Object} parameters 호출 파라미터
 */
async function logApiUsage(userId, functionName, parameters = {}) {
  try {
    await db.collection('apiUsage').add({
      userId,
      function: functionName,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      parameters
    });
  } catch (error) {
    console.error(`Error logging API usage for ${functionName}:`, error);
    // 로깅 실패해도 API 호출은 계속 진행
  }
}

/**
 * API 호출 속도 제한 확인
 * @param {string} userId 사용자 ID
 * @param {string} apiType API 유형 ('maps', 'places', 'weather')
 */
async function checkRateLimit(userId, apiType = 'default') {
  // API 유형별 제한 설정
  const limits = {
    maps: { perMinute: 10, perHour: 100 },
    places: { perMinute: 5, perHour: 50 },
    weather: { perMinute: 10, perHour: 50 },
    default: { perMinute: 30, perHour: 500 }
  };
  
  const limit = limits[apiType] || limits.default;
  const now = admin.firestore.Timestamp.now();
  
  // 1분 전 타임스탬프 계산
  const oneMinuteAgo = new admin.firestore.Timestamp(
    now.seconds - 60,
    now.nanoseconds
  );
  
  // 1시간 전 타임스탬프 계산
  const oneHourAgo = new admin.firestore.Timestamp(
    now.seconds - 3600,
    now.nanoseconds
  );
  
  // 사용자의 분당 API 호출 수 확인
  const minuteQuerySnapshot = await db.collection('apiUsage')
    .where('userId', '==', userId)
    .where('timestamp', '>=', oneMinuteAgo)
    .count()
    .get();
  
  const minuteCount = minuteQuerySnapshot.data().count;
  
  // 분당 제한 초과 시 오류
  if (minuteCount >= limit.perMinute) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `분당 API 호출 한도(${limit.perMinute}회)를 초과했습니다. 잠시 후 다시 시도해주세요.`
    );
  }
  
  // 사용자의 시간당 API 호출 수 확인
  const hourQuerySnapshot = await db.collection('apiUsage')
    .where('userId', '==', userId)
    .where('timestamp', '>=', oneHourAgo)
    .count()
    .get();
  
  const hourCount = hourQuerySnapshot.data().count;
  
  // 시간당 제한 초과 시 오류
  if (hourCount >= limit.perHour) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `시간당 API 호출 한도(${limit.perHour}회)를 초과했습니다. 나중에 다시 시도해주세요.`
    );
  }
}

/**
 * API 응답 캐싱
 * @param {string} functionName 함수 이름
 * @param {Object} params 요청 파라미터
 * @param {Object} data 응답 데이터
 * @param {number} ttl 캐시 유효 시간(초)
 */
async function cacheResponse(functionName, params, data, ttl = 3600) {
  try {
    // 캐시 키 생성 (함수 이름 + 정렬된 파라미터)
    const cacheKey = generateCacheKey(functionName, params);
    
    // 캐시 데이터 저장
    await db.collection('apiCache').doc(cacheKey).set({
      functionName,
      params,
      data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + (ttl * 1000))
    });
  } catch (error) {
    console.error(`Error caching response for ${functionName}:`, error);
    // 캐싱 실패해도 API 응답은 계속 반환
  }
}

/**
 * 캐시된 API 응답 가져오기
 * @param {string} functionName 함수 이름
 * @param {Object} params 요청 파라미터
 * @returns {Object|null} 캐시된 데이터 또는 null
 */
async function getCachedResponse(functionName, params) {
  try {
    // 캐시 키 생성
    const cacheKey = generateCacheKey(functionName, params);
    
    // 캐시 데이터 조회
    const cacheDoc = await db.collection('apiCache').doc(cacheKey).get();
    
    if (!cacheDoc.exists) {
      return null;
    }
    
    const cacheData = cacheDoc.data();
    const now = admin.firestore.Timestamp.now();
    
    // 캐시 만료 확인
    if (cacheData.expiresAt && cacheData.expiresAt.toMillis() < now.toMillis()) {
      // 만료된 캐시 삭제
      await db.collection('apiCache').doc(cacheKey).delete();
      return null;
    }
    
    return cacheData.data;
  } catch (error) {
    console.error(`Error getting cached response for ${functionName}:`, error);
    return null;
  }
}

/**
 * 캐시 키 생성
 * @param {string} functionName 함수 이름
 * @param {Object} params 요청 파라미터
 * @returns {string} 캐시 키
 */
function generateCacheKey(functionName, params) {
  // 민감한 정보 제외
  const sanitizedParams = { ...params };
  delete sanitizedParams.bypassCache;
  
  // 좌표 정보 반올림 (작은 차이로 캐시 미스 방지)
  if (sanitizedParams.location) {
    sanitizedParams.location = {
      latitude: Math.round(sanitizedParams.location.latitude * 1000) / 1000,
      longitude: Math.round(sanitizedParams.location.longitude * 1000) / 1000
    };
  }
  
  // 파라미터를 정렬된 문자열로 변환
  const paramString = Object.entries(sanitizedParams)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|');
  
  // 최종 캐시 키 생성
  return `${functionName}_${paramString}`.replace(/[.#$\/\[\]]/g, '_');
}

// 모듈 내보내기
module.exports = {
  nearbyPlaces,
  placeDetails,
  searchPlaces,
  getWeather,
  geocode
};
    
    // API 호출 속도 제한 확인
    await checkRateLimit(uid, 'maps');
    
    // Google Places API 호출
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location: `${data.location.latitude},${data.location.longitude}`,
        radius: data.radius || 1000,
        type: data.type || '',
        language: 'ko',
        key: functions.config().maps.api_key // 환경 변수에서 API 키 가져오기
      }
    });
    
    // 응답 데이터 캐싱 (선택 사항)
    await cacheResponse('nearbyPlaces', data, response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    throw new functions.https.HttpsError(
      'internal',
      '장소 검색 중 오류가 발생했습니다.',
      error.message
    );
  }
});

/**
 * 맵스 API 프록시 함수 - 장소 상세 정보
 */
exports.placeDetails = functions.region(region).https.onCall(async (data, context) => {
  // 인증 확인
  const uid = assertAuthenticated(context);
  
  // 데이터 유효성 검사
  if (!data.placeId || typeof data.placeId !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효한 장소 ID가 필요합니다.'
    );
  }
  
  try {
    // 캐시된 응답 확인
    const cachedData = await getCachedResponse('placeDetails', data);
    if (cachedData && !data.bypassCache) {
      return cachedData;
    }
    
    // 사용량 로깅
    await logApiUsage(uid, 'placeDetails', {
      placeId: data.placeId,
      fields: data.fields || 'basic'
    });
    
    // API 호출 속도 제한 확인
    await checkRateLimit(uid, 'places');
    
    // 필드 목록 구성
    let fields = 'name,formatted_address,geometry,rating,types,photos,opening_hours';
    if (data.fields === 'full') {
      fields += ',website,formatted_phone_number,reviews,price_level,url';
    }
    
    // Google Places API 호출
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: data.placeId,
        fields,
        language: 'ko',
        key: functions.config().maps.api_key
      }
    });
    
    // 응답 데이터 캐싱 (24시간)
    await cacheResponse('placeDetails', data, response.data, 24 * 60 * 60);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching place details:', error);
    throw new functions.https.HttpsError(
      'internal',
      '장소 상세 정보를 가져오는 중 오류가 발생했습니다.',
      error.message
    );
  }
});

/**
 * 맵스 API 프록시 함수 - 텍스트 검색
 */
exports.searchPlaces = functions.region(region).https.onCall(async (data, context) => {
  // 인증 확인
  const uid = assertAuthenticated(context);
  
  // 데이터 유효성 검사
  if (!data.query || typeof data.query !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '검색어가 필요합니다.'
    );
  }
  
  try {
    // 사용량 로깅
    await logApiUsage(uid, 'searchPlaces', {
      query: data.query,
      location: data.location || null,
      radius: data.radius || 5000
    });
    
    // API 호출 속도 제한 확인
    await checkRateLimit(uid, 'places');
    
    // API 파라미터 구성
    const params = {
      query: data.query,
      language: 'ko',
      key: functions.config().maps.api_key
    };
    
    // 위치 기반 검색인 경우 위치 정보 추가
    if (data.location && 
        typeof data.location.latitude === 'number' && 
        typeof data.location.longitude === 'number') {
      params.location = `${data.location.latitude},${data.location.longitude}`;
      params.radius = data.radius || 5000;
    }
    
    // Google Places API 호출
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params
    });
    
    // 응답 데이터 캐싱 (1시간)
    await cacheResponse('searchPlaces', data, response.data, 60 * 60);
    
    return response.data;
  } catch (error) {
    console.error('Error searching places:', error);
    throw new functions.https.HttpsError(
      'internal',
      '장소 검색 중 오류가 발생했습니다.',
      error.message
    );
  }
});
