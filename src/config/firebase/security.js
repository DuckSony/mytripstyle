/**
 * Firebase 보안 유틸리티
 * 
 * 이 모듈은 인증, 권한 확인, 데이터 보안과 관련된 유틸리티 함수를 제공합니다.
 * 사용자 인증 상태 확인, 관리자 권한 확인, 요청 검증 등의 기능을 포함합니다.
 */

import { auth, firestore } from './config';
import { doc, getDoc } from 'firebase/firestore';

// 보안 관련 상수
const ADMIN_COLLECTION = 'admins';
const USER_COLLECTION = 'users';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15분

// 사용자 권한 캐시 (성능 최적화)
const userRolesCache = new Map();
const adminStatusCache = new Map();

/**
 * 현재 사용자가 인증되었는지 확인
 * @returns {boolean} 인증 여부
 */
export function isAuthenticated() {
    return auth.currentUser !== null;
  }
  
  /**
   * 현재 사용자의 ID 가져오기
   * @returns {string|null} 사용자 ID 또는 null
   */
  export function getCurrentUserId() {
    return auth.currentUser ? auth.currentUser.uid : null;
  }
  
  /**
   * 사용자의 관리자 여부 확인
   * @param {string} userId 확인할 사용자 ID (없으면 현재 사용자)
   * @returns {Promise<boolean>} 관리자 여부
   */
  export async function isAdmin(userId = null) {
    const uid = userId || getCurrentUserId();
    
    if (!uid) {
      return false;
    }
    
    // 캐시 확인
    if (adminStatusCache.has(uid)) {
      // 캐시된 값이 5분 이내면 그대로 사용
      const cachedValue = adminStatusCache.get(uid);
      if (Date.now() - cachedValue.timestamp < 5 * 60 * 1000) {
        return cachedValue.isAdmin;
      }
    }
    
    try {
      const adminDoc = await getDoc(doc(firestore, ADMIN_COLLECTION, uid));
      const isAdminUser = adminDoc.exists();
      
      // 결과 캐싱
      adminStatusCache.set(uid, {
        isAdmin: isAdminUser,
        timestamp: Date.now()
      });
      
      return isAdminUser;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
  
  /**
   * 사용자 권한 확인
   * @param {string} userId 확인할 사용자 ID
   * @param {string} role 확인할 권한 ('admin', 'moderator', 'user', 등)
   * @returns {Promise<boolean>} 권한 보유 여부
   */
  export async function hasRole(userId, role) {
    if (!userId) {
      return false;
    }
    
    // 관리자 확인은 별도 함수 사용
    if (role === 'admin') {
      return await isAdmin(userId);
    }
    
    // 캐시 확인
    const cacheKey = `${userId}_roles`;
    if (userRolesCache.has(cacheKey)) {
      const cachedValue = userRolesCache.get(cacheKey);
      // 캐시된 값이 15분 이내면 그대로 사용
      if (Date.now() - cachedValue.timestamp < 15 * 60 * 1000) {
        return cachedValue.roles.includes(role);
      }
    }
    
    try {
      const userDoc = await getDoc(doc(firestore, USER_COLLECTION, userId));
      
      if (!userDoc.exists()) {
        return false;
      }
      
      const userData = userDoc.data();
      const userRoles = userData.roles || ['user']; // 기본 역할은 'user'
      
      // 결과 캐싱
      userRolesCache.set(cacheKey, {
        roles: userRoles,
        timestamp: Date.now()
      });
      
      return userRoles.includes(role);
    } catch (error) {
      console.error('Error checking user role:', error);
      return false;
    }
  }

  /**
 * 사용자가 문서에 접근 권한이 있는지 확인
 * @param {string} collection 컬렉션 이름
 * @param {string} docId 문서 ID
 * @param {string} action 액션 유형 ('read', 'write', 'delete')
 * @param {string} userId 확인할 사용자 ID (없으면 현재 사용자)
 * @returns {Promise<boolean>} 접근 권한 여부
 */
export async function canAccessDocument(collection, docId, action, userId = null) {
    const uid = userId || getCurrentUserId();
    
    if (!uid) {
      return false;
    }
    
    // 관리자는 모든 문서에 접근 가능
    if (await isAdmin(uid)) {
      return true;
    }
    
    try {
      // 문서 소유자 확인
      const document = await getDoc(doc(firestore, collection, docId));
      
      if (!document.exists()) {
        return false;
      }
      
      const data = document.data();
      
      // 컬렉션별 접근 제어 로직
      switch (collection) {
        case 'users':
          // 자신의 프로필에만 접근 가능
          return docId === uid;
          
        case 'places':
          // places는 읽기만 허용
          return action === 'read';
          
        case 'reviews':
          // 자신이 작성한 리뷰만 수정/삭제 가능
          if (action === 'read') {
            return true; // 모든 리뷰는 읽기 가능
          } else {
            return data.userId === uid;
          }
          
        case 'savedPlaces':
          // 자신의 저장 목록만 접근 가능
          return data.userId === uid;
          
        default:
          // 기본적으로는 접근 거부
          return false;
      }
    } catch (error) {
      console.error(`Error checking access to ${collection}/${docId}:`, error);
      return false;
    }
  }
  
  /**
   * 데이터 유효성 검증
   * @param {Object} data 검증할 데이터
   * @param {Object} schema 스키마 객체 (필드명과 유효성 검사 함수)
   * @returns {Object} 유효성 검사 결과 { isValid, errors }
   */
  export function validateData(data, schema) {
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
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
 * MBTI 유형 검증
 * @param {string} mbti 검증할 MBTI 문자열
 * @returns {boolean|string} 유효성 여부 또는 오류 메시지
 */
export function isValidMBTI(mbti) {
    if (!mbti || typeof mbti !== 'string') {
      return '유효한 MBTI 유형이 필요합니다.';
    }
    
    const isValid = /^[EI][NS][TF][JP]$/.test(mbti);
    return isValid || 'MBTI 유형은 E/I, N/S, T/F, J/P 조합이어야 합니다.';
  }
  
  /**
   * XSS 공격 방지를 위한 문자열 정화
   * @param {string} input 정화할 입력 문자열
   * @returns {string} 정화된 문자열
   */
  export function sanitizeInput(input) {
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
   * 객체의 모든 문자열 속성 정화
   * @param {Object} obj 정화할 객체
   * @returns {Object} 정화된 객체
   */
  export function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = sanitizeInput(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'string' ? sanitizeInput(item) : 
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
   * 좌표 데이터 유효성 검사
   * @param {Object} location 검증할 좌표 { latitude, longitude }
   * @returns {boolean|string} 유효성 여부 또는 오류 메시지
   */
  export function isValidLocation(location) {
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

  // 로그인 시도 추적
const loginAttempts = new Map();

/**
 * 로그인 시도 추적 및 제한
 * @param {string} email 이메일 주소
 * @returns {Object} 로그인 시도 가능 여부 및 대기 시간
 */
export function trackLoginAttempt(email) {
  if (!email) {
    return { allowed: false, message: '이메일이 필요합니다.' };
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  
  // 이메일에 대한 시도 정보 가져오기
  const attemptInfo = loginAttempts.get(normalizedEmail) || {
    count: 0,
    lastAttempt: 0,
    lockUntil: 0
  };
  
  // 계정 잠금 확인
  if (attemptInfo.lockUntil > now) {
    const waitTime = Math.ceil((attemptInfo.lockUntil - now) / 1000 / 60);
    return {
      allowed: false,
      message: `너무 많은 로그인 시도가 있었습니다. ${waitTime}분 후에 다시 시도해주세요.`,
      waitTime
    };
  }
  
  // 시도 횟수 증가
  attemptInfo.count += 1;
  attemptInfo.lastAttempt = now;
  
  // 최대 시도 횟수 초과 시 계정 잠금
  if (attemptInfo.count >= MAX_FAILED_ATTEMPTS) {
    attemptInfo.lockUntil = now + LOCKOUT_DURATION;
    attemptInfo.count = 0;
    
    loginAttempts.set(normalizedEmail, attemptInfo);
    
    const waitTime = Math.ceil(LOCKOUT_DURATION / 1000 / 60);
    return {
      allowed: false,
      message: `너무 많은 로그인 시도가 있었습니다. ${waitTime}분 후에 다시 시도해주세요.`,
      waitTime
    };
  }
  
  loginAttempts.set(normalizedEmail, attemptInfo);
  return { allowed: true };
}

/**
 * 로그인 성공 처리 (시도 횟수 초기화)
 * @param {string} email 이메일 주소
 */
export function resetLoginAttempts(email) {
  if (!email) return;
  
  const normalizedEmail = email.toLowerCase().trim();
  loginAttempts.delete(normalizedEmail);
}

/**
 * 주기적으로 오래된 로그인 시도 기록 정리
 * 12시간 이상 지난 기록 삭제
 */
setInterval(() => {
  const now = Date.now();
  const OLD_RECORD_THRESHOLD = 12 * 60 * 60 * 1000; // 12시간
  
  for (const [email, attemptInfo] of loginAttempts.entries()) {
    if (now - attemptInfo.lastAttempt > OLD_RECORD_THRESHOLD) {
      loginAttempts.delete(email);
    }
  }
}, 60 * 60 * 1000); // 1시간마다 실행

/**
 * 관리자 전용 작업 수행
 * @param {Function} action 수행할 작업 함수
 * @param {Object} options 옵션 객체
 * @returns {Promise<any>} 작업 결과
 */
export async function performAdminAction(action, options = {}) {
    const { requiredRole = 'admin', userId = null } = options;
    const uid = userId || getCurrentUserId();
    
    if (!uid) {
      throw new Error('인증이 필요합니다.');
    }
    
    // 관리자 또는 특정 역할 확인
    const hasPermission = requiredRole === 'admin' 
      ? await isAdmin(uid)
      : await hasRole(uid, requiredRole);
    
    if (!hasPermission) {
      throw new Error('이 작업을 수행할 권한이 없습니다.');
    }
    
    // 권한이 있으면 작업 수행
    return await action();
  }
  
  /**
   * 보안 캐시 초기화
   */
  export function clearSecurityCache() {
    userRolesCache.clear();
    adminStatusCache.clear();
  }
  
  // 기본 내보내기
  export default {
    isAuthenticated,
    getCurrentUserId,
    isAdmin,
    hasRole,
    canAccessDocument,
    validateData,
    sanitizeInput,
    sanitizeObject,
    isValidMBTI,
    isValidLocation,
    trackLoginAttempt,
    resetLoginAttempts,
    performAdminAction,
    clearSecurityCache
  };
