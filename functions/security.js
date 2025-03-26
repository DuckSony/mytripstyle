/**
 * Firebase Cloud Functions 보안 유틸리티
 * 
 * 이 모듈은 Cloud Functions에서 사용되는 인증 및 권한 검증 함수를 제공합니다.
 * 사용자 인증 확인, 관리자 권한 검증, 데이터 유효성 검증 등의 기능을 포함합니다.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Firestore 참조
const db = admin.firestore();

/**
 * 사용자 인증 확인
 * @param {functions.https.CallableContext} context Cloud Functions 호출 컨텍스트
 * @returns {string} 사용자 ID
 * @throws {functions.https.HttpsError} 인증되지 않은 경우 오류 발생
 */
function assertAuthenticated(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '이 기능을 사용하려면 로그인이 필요합니다.'
    );
  }
  return context.auth.uid;
}

/**
 * 관리자 권한 확인
 * @param {functions.https.CallableContext} context Cloud Functions 호출 컨텍스트
 * @returns {Promise<string>} 사용자 ID
 * @throws {functions.https.HttpsError} 관리자가 아닌 경우 오류 발생
 */
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
 * 특정 역할 권한 확인
 * @param {functions.https.CallableContext} context Cloud Functions 호출 컨텍스트
 * @param {string|string[]} roles 필요한 역할 또는 역할 배열
 * @returns {Promise<string>} 사용자 ID
 * @throws {functions.https.HttpsError} 필요한 역할이 없는 경우 오류 발생
 */
async function assertRole(context, roles) {
  const uid = assertAuthenticated(context);
  
  // 관리자는 모든 역할을 가짐
  const isAdmin = await checkIfAdmin(uid);
  if (isAdmin) {
    return uid;
  }
  
  // 사용자 프로필에서 역할 확인
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(uid)
    .get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      '사용자 프로필을 찾을 수 없습니다.'
    );
  }
  
  const userData = userDoc.data();
  const userRoles = userData.roles || ['user']; // 기본 역할은 'user'
  
  // 단일 역할 확인
  if (typeof roles === 'string') {
    if (!userRoles.includes(roles)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        `이 기능을 사용하려면 '${roles}' 역할이 필요합니다.`
      );
    }
  }
  // 여러 역할 중 하나라도 있는지 확인
  else if (Array.isArray(roles)) {
    const hasAnyRole = roles.some(role => userRoles.includes(role));
    if (!hasAnyRole) {
      throw new functions.https.HttpsError(
        'permission-denied',
        `이 기능을 사용하려면 다음 역할 중 하나가 필요합니다: ${roles.join(', ')}`
      );
    }
  }
  
  return uid;
}

/**
 * 사용자가 관리자인지 확인
 * @param {string} uid 사용자 ID
 * @returns {Promise<boolean>} 관리자 여부
 */
async function checkIfAdmin(uid) {
  const adminDoc = await admin.firestore()
    .collection('admins')
    .doc(uid)
    .get();
    
  return adminDoc.exists;
}

/**
 * API 사용 제한 확인
 * @param {string} userId 사용자 ID
 * @param {string} apiType API 유형 ('maps', 'places', 'weather', 'default')
 * @returns {Promise<void>}
 * @throws {functions.https.HttpsError} 제한 초과 시 오류 발생
 */
async function checkApiLimit(userId, apiType = 'default') {
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
 * 입력 데이터 검증
 * @param {Object} data 검증할 데이터
 * @param {Object} schema 검증 스키마 (필드명과 검증 함수)
 * @returns {void}
 * @throws {functions.https.HttpsError} 유효하지 않은 데이터 시 오류 발생
 */
function validateData(data, schema) {
  const errors = {};
  
  // 스키마의 각 필드 검증
  for (const [field, validator] of Object.entries(schema)) {
    if (typeof validator === 'function') {
      const result = validator(data[field]);
      
      if (result !== true) {
        errors[field] = result;
      }
    }
  }
  
  // 오류가 있으면 예외 발생
  if (Object.keys(errors).length > 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '입력 데이터가 유효하지 않습니다.',
      errors
    );
  }
}

/**
 * MBTI 유형 검증
 * @param {string} mbti 검증할 MBTI 문자열
 * @returns {boolean|string} 유효성 여부 또는 오류 메시지
 */
function isValidMBTI(mbti) {
  if (!mbti || typeof mbti !== 'string') {
    return '유효한 MBTI 유형이 필요합니다.';
  }
  
  const isValid = /^[EI][NS][TF][JP]$/.test(mbti);
  return isValid || 'MBTI 유형은 E/I, N/S, T/F, J/P 조합이어야 합니다.';
}

/**
 * 위치 정보 검증
 * @param {Object} location 검증할 위치 {latitude, longitude}
 * @returns {boolean|string} 유효성 여부 또는 오류 메시지
 */
function isValidLocation(location) {
  if (!location || typeof location !== 'object') {
    return '위치 정보가 필요합니다.';
  }
  
  const { latitude, longitude } = location;
  
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return '위도와 경도는 숫자여야 합니다.';
  }
  
  if (latitude < -90 || latitude > 90) {
    return '위도는 -90에서 90 사이여야 합니다.';
  }
  
  if (longitude < -180 || longitude > 180) {
    return '경도는 -180에서 180 사이여야 합니다.';
  }
  
  return true;
}

/**
 * XSS 방지를 위한 문자열 정화
 * @param {string} input 정화할 입력 문자열
 * @returns {string} 정화된 문자열
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // HTML 태그 제거 (또는 escape)
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * XSS 방지를 위한 객체 정화
 * @param {Object} obj 정화할 객체
 * @returns {Object} 정화된 객체
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : 
        typeof item === 'object' ? sanitizeObject(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 관리자 전용 작업 수행
 * @param {functions.https.CallableContext} context Cloud Functions 호출 컨텍스트
 * @param {Function} action 수행할 작업 함수
 * @returns {Promise<any>} 작업 결과
 */
async function performAdminAction(context, action) {
  await assertAdmin(context);
  return await action();
}

// 모듈 내보내기
module.exports = {
  assertAuthenticated,
  assertAdmin,
  assertRole,
  checkIfAdmin,
  checkApiLimit,
  validateData,
  isValidMBTI,
  isValidLocation,
  sanitizeString,
  sanitizeObject,
  performAdminAction
};
