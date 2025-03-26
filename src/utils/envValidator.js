/**
 * 환경 변수 검증 유틸리티
 * 
 * 이 모듈은 애플리케이션에 필요한 모든 환경 변수가 올바르게 설정되어 있는지 확인합니다.
 * 개발 환경에서는 누락된 변수에 대해 오류를 발생시키고,
 * 프로덕션 환경에서는 경고를 기록합니다.
 */

// 환경 변수 검증 결과 타입 정의 (TypeScript 사용 시 활성화)
// type ValidationResult = {
//   isValid: boolean;
//   missingVars: string[];
//   invalidVars: string[];
// };

/**
 * 필수 환경 변수가 존재하는지 확인
 * @returns {string[]} 누락된 환경 변수 목록
 */
function checkRequiredVars() {
    const requiredVars = [
      // Firebase 설정
      'REACT_APP_FIREBASE_API_KEY',
      'REACT_APP_FIREBASE_AUTH_DOMAIN',
      'REACT_APP_FIREBASE_PROJECT_ID',
      'REACT_APP_FIREBASE_STORAGE_BUCKET',
      'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
      'REACT_APP_FIREBASE_APP_ID',
      
      // 지도 API
      'REACT_APP_MAPS_API_KEY',
      
      // 앱 설정
      'REACT_APP_API_URL',
      'REACT_APP_DEFAULT_LOCATION_LAT',
      'REACT_APP_DEFAULT_LOCATION_LNG',
      'REACT_APP_DEFAULT_ZOOM'
    ];
    
    const missingVars = requiredVars.filter(
      varName => !process.env[varName]
    );
    
    return missingVars;
  }

  /**
 * 숫자형 환경 변수가 유효한 범위의 값인지 확인
 * @returns {string[]} 유효하지 않은 숫자형 환경 변수 목록
 */
function checkNumericVars() {
    const numericVars = {
      REACT_APP_DEFAULT_LOCATION_LAT: [-90, 90], // 위도 범위
      REACT_APP_DEFAULT_LOCATION_LNG: [-180, 180], // 경도 범위
      REACT_APP_DEFAULT_ZOOM: [1, 20], // 줌 레벨 범위
      REACT_APP_CACHE_TTL: [0, Infinity], // 캐시 TTL (0 이상)
      REACT_APP_MAX_PLACES_PER_REQUEST: [1, 100] // 요청당 최대 장소 수
    };
    
    const invalidNumericVars = Object.entries(numericVars)
      .filter(([varName, [min, max]]) => {
        // 환경 변수가 없으면 필수 변수 검사에서 처리되므로 여기서는 검사하지 않음
        if (!process.env[varName]) return false;
        
        const value = parseFloat(process.env[varName]);
        return isNaN(value) || value < min || value > max;
      })
      .map(([varName]) => varName);
    
    return invalidNumericVars;
  }

  /**
 * 불리언 환경 변수가 'true' 또는 'false' 문자열인지 확인
 * @returns {string[]} 유효하지 않은 불리언 환경 변수 목록
 */
function checkBooleanVars() {
    const booleanVars = [
      'REACT_APP_ENABLE_WEATHER',
      'REACT_APP_ENABLE_MULTI_AGENT',
      'REACT_APP_ENABLE_ANALYTICS',
      'REACT_APP_ENABLE_DEBUG',
      'REACT_APP_ENABLE_MOCK_DATA',
      'REACT_APP_ERROR_REPORTING'
    ];
    
    const invalidBooleanVars = booleanVars
      .filter(varName => {
        // 환경 변수가 없으면 건너뜀 (선택적 변수일 수 있음)
        if (!process.env[varName]) return false;
        
        const value = process.env[varName];
        return value !== 'true' && value !== 'false';
      });
    
    return invalidBooleanVars;
  }

  /**
 * 모든 환경 변수 검증 수행
 * @returns {object} 검증 결과 객체
 */
export function validateEnv() {
    const missingVars = checkRequiredVars();
    const invalidNumericVars = checkNumericVars();
    const invalidBooleanVars = checkBooleanVars();
    
    const isValid = missingVars.length === 0 && 
                   invalidNumericVars.length === 0 && 
                   invalidBooleanVars.length === 0;
    
    // 문제가 있는 경우 로그 출력
    if (!isValid) {
      if (missingVars.length > 0) {
        console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
      
      if (invalidNumericVars.length > 0) {
        console.error(`Invalid numeric environment variables: ${invalidNumericVars.join(', ')}`);
      }
      
      if (invalidBooleanVars.length > 0) {
        console.error(`Invalid boolean environment variables (should be 'true' or 'false'): ${invalidBooleanVars.join(', ')}`);
      }
      
      // 개발 환경에서는 오류 발생
      if (process.env.NODE_ENV === 'development') {
        throw new Error('Environment variables validation failed. Check console for details.');
      }
      
      // 프로덕션 환경에서는 경고 표시를 위해 전역 변수 설정
      if (process.env.NODE_ENV === 'production') {
        window.envValidationErrors = {
          missingVars,
          invalidNumericVars,
          invalidBooleanVars
        };
      }
    }
    
    return {
      isValid,
      missingVars,
      invalidNumericVars,
      invalidBooleanVars
    };
  }
  
  // 환경 변수를 타입 변환하여 제공하는 객체
  export const Env = {
    // Firebase 설정
    firebase: {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_FIREBASE_APP_ID,
      measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
    },
    
    // 지도 설정
    maps: {
      apiKey: process.env.REACT_APP_MAPS_API_KEY,
      defaultLocation: {
        lat: parseFloat(process.env.REACT_APP_DEFAULT_LOCATION_LAT || '37.5642135'),
        lng: parseFloat(process.env.REACT_APP_DEFAULT_LOCATION_LNG || '127.0016985')
      },
      defaultZoom: parseInt(process.env.REACT_APP_DEFAULT_ZOOM || '13')
    },
    
    // API 설정
    api: {
      url: process.env.REACT_APP_API_URL,
      maxPlacesPerRequest: parseInt(process.env.REACT_APP_MAX_PLACES_PER_REQUEST || '20')
    },
    
    // 기능 플래그
    features: {
      enableWeather: process.env.REACT_APP_ENABLE_WEATHER === 'true',
      enableMultiAgent: process.env.REACT_APP_ENABLE_MULTI_AGENT === 'true',
      enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
      enableDebug: process.env.REACT_APP_ENABLE_DEBUG === 'true',
      enableMockData: process.env.REACT_APP_ENABLE_MOCK_DATA === 'true'
    },
    
    // 캐싱 설정
    cache: {
      ttl: parseInt(process.env.REACT_APP_CACHE_TTL || '86400')
    },
    
    // 에러 설정
    error: {
      enableReporting: process.env.REACT_APP_ERROR_REPORTING === 'true',
      logLevel: process.env.REACT_APP_ERROR_LOG_LEVEL || 'error'
    },
    
    // 환경 헬퍼
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test'
  };
  
  // 기본 내보내기
  export default validateEnv;
