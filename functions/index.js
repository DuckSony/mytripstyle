/**
 * Firebase Cloud Functions
 * 
 * 이 파일은 MyTripStyle 애플리케이션의 Cloud Functions 진입점입니다.
 * API 프록시, 보안 함수, 데이터 처리 함수 등을 정의하고 내보냅니다.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Firebase 초기화
admin.initializeApp();

// Firestore 및 Storage 참조
const db = admin.firestore();
const storage = admin.storage();

// 리전 설정 (한국 기준 가까운 리전 사용)
const region = 'asia-northeast3'; // 서울 리전

// 인증 확인 헬퍼 함수
function assertAuthenticated(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '이 기능을 사용하려면 로그인이 필요합니다.'
    );
  }
  return context.auth.uid;
}

// 관리자 확인 헬퍼 함수
async function assertAdmin(context) {
  const uid = assertAuthenticated(context);
  
  const adminDoc = await admin.firestore()
    .collection('admins')
    .doc(uid)
    .get();
    
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      '관리자 권한이 필요한 기능입니다.'
    );
  }
  
  return uid;
}

/**
 * 사용자 프로필 생성 시 기본 데이터 설정
 */
exports.createUserProfile = functions.region(region).auth.user().onCreate(async (user) => {
  try {
    const { uid, email, displayName } = user;
    
    // 기본 사용자 프로필 생성
    await db.collection('users').doc(uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      interests: [],
      talents: [],
      preferredLocations: [],
      isProfileComplete: false
    });
    
    console.log(`Created profile for user: ${uid}`);
    return null;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return null;
  }
});

/**
 * 사용자 계정 삭제 시 관련 데이터 정리
 */
exports.cleanupUserData = functions.region(region).auth.user().onDelete(async (user) => {
  try {
    const { uid } = user;
    const batch = db.batch();
    
    // 사용자 프로필 삭제
    batch.delete(db.collection('users').doc(uid));
    
    // 사용자의 저장된 장소 쿼리
    const savedPlacesSnapshot = await db.collection('users').doc(uid)
      .collection('savedPlaces').get();
    
    // 저장된 장소 문서 삭제
    savedPlacesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 사용자의 방문 기록 쿼리
    const visitHistorySnapshot = await db.collection('users').doc(uid)
      .collection('visitHistory').get();
    
    // 방문 기록 문서 삭제
    visitHistorySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 사용자의 리뷰 쿼리
    const reviewsQuery = await db.collectionGroup('reviews')
      .where('userId', '==', uid).get();
    
    // 리뷰 문서 삭제
    reviewsQuery.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 일괄 작업 실행
    await batch.commit();
    
    // 스토리지에서 사용자 이미지 삭제
    const profileImagePath = `users/${uid}/profile.jpg`;
    try {
      await storage.bucket().file(profileImagePath).delete();
    } catch (storageError) {
      // 파일이 없을 수 있으므로 오류 무시
      console.log(`No profile image found for user: ${uid}`);
    }
    
    console.log(`Cleaned up data for user: ${uid}`);
    return null;
  } catch (error) {
    console.error('Error cleaning up user data:', error);
    return null;
  }
});

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
    await db.collection('apiUsage').add({
      userId: uid,
      function: 'nearbyPlaces',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      parameters: {
        lat: data.location.latitude,
        lng: data.location.longitude,
        radius: data.radius || 1000,
        type: data.type || ''
      }
    });
    
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
    // 사용량 로깅
    await db.collection('apiUsage').add({
      userId: uid,
      function: 'placeDetails',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      parameters: {
        placeId: data.placeId,
        fields: data.fields || 'basic'
      }
    });
    
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
    await db.collection('apiUsage').add({
      userId: uid,
      function: 'searchPlaces',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      parameters: {
        query: data.query,
        location: data.location || null,
        radius: data.radius || 5000
      }
    });
    
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

/**
 * 추천 알고리즘 실행 함수
 */
exports.getRecommendations = functions.region(region).https.onCall(async (data, context) => {
  // 인증 확인
  const uid = assertAuthenticated(context);
  
  try {
    // 사용자 프로필 가져오기
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        '사용자 프로필을 찾을 수 없습니다.'
      );
    }
    
    const userData = userDoc.data();
    
    // 필수 프로필 데이터 확인
    if (!userData.mbti) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'MBTI 정보가 필요합니다. 프로필을 완성해주세요.'
      );
    }
    
    // 사용량 로깅
    await db.collection('apiUsage').add({
      userId: uid,
      function: 'getRecommendations',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      parameters: {
        location: data.location || null,
        currentMood: data.currentMood || null
      }
    });
    
    // 추천 알고리즘 실행
    // 실제 추천 알고리즘은 여기에 구현
    // MBTI, 관심사, 재능, 감정 상태 등을 고려한 추천 로직
    
    // 임시 구현 (실제 프로덕션에서는 더 복잡한 알고리즘 사용)
    let recommendationQuery = db.collection('places');
    
    // MBTI 기반 필터링 (places 컬렉션에 mbtiMatchScore 필드 가정)
    recommendationQuery = recommendationQuery.where(`mbtiMatchScore.${userData.mbti}`, '>=', 6);
    
    // 위치 기반 필터링 (필요시)
    if (data.location && data.radius) {
      // Firestore는 지리적 쿼리에 제한이 있어 실제로는 GeoFirestore 또는 별도 로직 필요
      // 여기서는 단순화를 위해 기본 쿼리만 사용
    }
    
    // 쿼리 실행
    const placesSnapshot = await recommendationQuery.limit(20).get();
    
    // 결과 변환
    const recommendations = placesSnapshot.docs.map(doc => {
      const place = doc.data();
      
      // 추천 이유 계산
      const recommendationReasons = {
        mbti: calculateMbtiReason(userData.mbti, place),
        interests: calculateInterestsReason(userData.interests, place),
        talents: calculateTalentsReason(userData.talents, place),
        mood: calculateMoodReason(data.currentMood, place)
      };
      
      return {
        id: doc.id,
        name: place.name,
        location: place.location,
        category: place.category,
        rating: place.rating,
        mbtiScore: place.mbtiMatchScore[userData.mbti],
        recommendationReasons,
        // 기타 필요한 정보
      };
    });
    
    return { recommendations };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw new functions.https.HttpsError(
      'internal',
      '추천을 생성하는 중 오류가 발생했습니다.',
      error.message
    );
  }
});

// 추천 이유 계산 함수들 (실제 구현은 더 복잡함)
function calculateMbtiReason(userMbti, place) {
  // MBTI 기반 추천 이유 계산
  const mbtiScore = place.mbtiMatchScore?.[userMbti] || 0;
  
  if (mbtiScore >= 8) {
    return `${userMbti} 성향에 매우 적합한 장소입니다.`;
  } else if (mbtiScore >= 6) {
    return `${userMbti} 성향에 잘 맞는 장소입니다.`;
  } else {
    return `${userMbti} 성향에 부분적으로 맞는 장소입니다.`;
  }
}

function calculateInterestsReason(userInterests, place) {
  // 관심사 기반 추천 이유 계산
  const matchingInterests = userInterests.filter(interest => 
    place.interestTags?.includes(interest)
  );
  
  if (matchingInterests.length > 0) {
    return `${matchingInterests.join(', ')} 관심사와 관련된 장소입니다.`;
  } else {
    return '다양한 관심사를 충족할 수 있는 장소입니다.';
  }
}

function calculateTalentsReason(userTalents, place) {
  // 재능 기반 추천 이유 계산
  const matchingTalents = userTalents.filter(talent => 
    place.talentTags?.includes(talent)
  );
  
  if (matchingTalents.length > 0) {
    return `${matchingTalents.join(', ')} 재능을 활용할 수 있는 장소입니다.`;
  } else {
    return '새로운 경험을 제공하는 장소입니다.';
  }
}

function calculateMoodReason(currentMood, place) {
  // 감정 상태 기반 추천 이유 계산
  if (!currentMood || !place.moodMatchScore) {
    return '다양한 감정 상태에 적합한 장소입니다.';
  }
  
  const moodScore = place.moodMatchScore[currentMood] || 0;
  
  if (moodScore >= 8) {
    return `현재 ${currentMood} 감정 상태에 매우 적합한 장소입니다.`;
  } else if (moodScore >= 6) {
    return `현재 ${currentMood} 감정 상태에 잘 맞는 장소입니다.`;
  } else {
    return `다양한 감정 상태에 적응할 수 있는 장소입니다.`;
  }
}

/**
 * 예약된 작업: 사용량 통계 생성 (매일 자정)
 */
exports.dailyApiUsageStats = functions.region(region)
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const endTime = new Date();
      endTime.setHours(0, 0, 0, 0);
      
      // 어제의 API 사용량 쿼리
      const apiUsageSnapshot = await db.collection('apiUsage')
        .where('timestamp', '>=', yesterday)
        .where('timestamp', '<', endTime)
        .get();
      
      // 함수별 사용량 집계
      const functionCounts = {};
      const userCounts = {};
      
      apiUsageSnapshot.forEach(doc => {
        const usage = doc.data();
        
        // 함수별 카운트
        functionCounts[usage.function] = (functionCounts[usage.function] || 0) + 1;
        
        // 사용자별 카운트
        userCounts[usage.userId] = (userCounts[usage.userId] || 0) + 1;
      });
      
      // 가장 많이 사용한 상위 사용자 목록
      const topUsers = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));
      
      // 통계 저장
      await db.collection('apiUsageStats').add({
        date: yesterday,
        totalCalls: apiUsageSnapshot.size,
        functionCounts,
        topUsers,
        generatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Generated API usage stats for ${yesterday.toDateString()}`);
      return null;
    } catch (error) {
      console.error('Error generating API usage stats:', error);
      return null;
    }
  });

/**
 * 관리자 전용: 장소 데이터 일괄 업데이트
 */
exports.updatePlacesData = functions.region(region).https.onCall(async (data, context) => {
  // 관리자 권한 확인
  await assertAdmin(context);
  
  // 데이터 유효성 검사
  if (!data.updates || !Array.isArray(data.updates)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '유효한 업데이트 데이터가 필요합니다.'
    );
  }
  
  try {
    // 일괄 처리 작업 생성
    const batch = db.batch();
    let updateCount = 0;
    
    // 각 업데이트 처리
    for (const update of data.updates) {
      if (!update.id || !update.data) continue;
      
      const placeRef = db.collection('places').doc(update.id);
      batch.update(placeRef, {
        ...update.data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid
      });
      
      updateCount++;
      
      // Firestore 일괄 작업 제한 (최대 500개)
      if (updateCount >= 500) {
        break;
      }
    }
    
    // 일괄 작업 실행
    await batch.commit();
    
    return { 
      success: true, 
      updatedCount: updateCount,
      message: `${updateCount}개의 장소 데이터가 업데이트되었습니다.`
    };
  } catch (error) {
    console.error('Error updating places data:', error);
    throw new functions.https.HttpsError(
      'internal',
      '장소 데이터 업데이트 중 오류가 발생했습니다.',
      error.message
    );
  }
});

/**
 * 날씨 API 프록시 함수 (선택적 기능)
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
    // 사용량 로깅
    await db.collection('apiUsage').add({
      userId: uid,
      function: 'getWeather',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      parameters: {
        lat: data.location.latitude,
        lng: data.location.longitude
      }
    });
    
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
