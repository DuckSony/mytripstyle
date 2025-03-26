// src/utils/envConfig.js

// 환경 변수 가져오기 (기본값 제공)
export const getEnvVariable = (name, defaultValue = '') => {
    return process.env[name] || defaultValue;
  };
  
  // Firebase 설정
  export const firebaseConfig = {
    apiKey: getEnvVariable('REACT_APP_FIREBASE_API_KEY'),
    authDomain: getEnvVariable('REACT_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVariable('REACT_APP_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVariable('REACT_APP_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVariable('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVariable('REACT_APP_FIREBASE_APP_ID')
  };
  
  // 지도 API 설정
  export const mapConfig = {
    kakaoApiKey: getEnvVariable('REACT_APP_KAKAO_MAP_API_KEY'),
    googleApiKey: getEnvVariable('REACT_APP_GOOGLE_MAP_API_KEY'),
    kakaoMapDailyLimit: parseInt(getEnvVariable('REACT_APP_KAKAO_MAP_DAILY_LIMIT', '10000')),
    googleMapDailyLimit: parseInt(getEnvVariable('REACT_APP_GOOGLE_MAP_DAILY_LIMIT', '5000'))
  };
  
  // 앱 설정
  export const appConfig = {
    version: getEnvVariable('REACT_APP_VERSION', '1.0.0'),
    environment: getEnvVariable('REACT_APP_ENVIRONMENT', 'development'),
    forceHttps: getEnvVariable('REACT_APP_FORCE_HTTPS', 'false') === 'true',
    cacheDuration: parseInt(getEnvVariable('REACT_APP_CACHE_DURATION', '86400')),
    offlineCacheEnabled: getEnvVariable('REACT_APP_OFFLINE_CACHE_ENABLED', 'true') === 'true'
  };
  
  // 기능 플래그
  export const featureFlags = {
    enableOfflineMode: getEnvVariable('REACT_APP_ENABLE_OFFLINE_MODE', 'true') === 'true',
    enablePushNotifications: getEnvVariable('REACT_APP_ENABLE_PUSH_NOTIFICATIONS', 'false') === 'true',
    enableAnalytics: getEnvVariable('REACT_APP_ENABLE_ANALYTICS', 'false') === 'true',
    enableErrorReporting: getEnvVariable('REACT_APP_ENABLE_ERROR_REPORTING', 'true') === 'true'
  };
  
  // 현재 환경이 프로덕션인지 확인
  export const isProduction = appConfig.environment === 'production';
