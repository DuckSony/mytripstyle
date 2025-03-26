// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// 네트워크 요청 모킹을 위한 MSW(Mock Service Worker) 설정
beforeAll(() => {
  // 테스트 전에 모의 서버 활성화
  server.listen();
  // 환경 변수 설정
  process.env.REACT_APP_ENV = 'test';
  process.env.REACT_APP_ENABLE_ANALYTICS = 'false';
  process.env.REACT_APP_ENABLE_ERROR_REPORTING = 'false';
  
  // window.matchMedia 모킹
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }))
  });
  
  // IntersectionObserver 모킹
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() { return null; }
    unobserve() { return null; }
    disconnect() { return null; }
  };
  
  // localStorage 모킹
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: jest.fn(key => store[key] || null),
      setItem: jest.fn((key, value) => {
        store[key] = value.toString();
      }),
      removeItem: jest.fn(key => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
      length: 0,
      key: jest.fn(index => null)
    };
  })();
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });
});

afterEach(() => {
  // 각 테스트 이후 요청 핸들러 재설정
  server.resetHandlers();
});

afterAll(() => {
  // 모든 테스트 이후 모의 서버 종료
  server.close();
});

// 콘솔 오류 필터링
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  // React 18 act() 경고 무시
  if (/Warning.*not wrapped in act/.test(args[0])) {
    return;
  }
  // 다른 오류는 정상적으로 출력
  originalError.call(console, ...args);
};

console.warn = (...args) => {
  // 특정 경고 메시지 무시
  if (/ReactDOM.render is no longer supported/.test(args[0])) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Firebase 모킹
jest.mock('firebase/app', () => {
  return {
    initializeApp: jest.fn().mockReturnValue({
      name: 'testApp'
    }),
    getApps: jest.fn().mockReturnValue([])
  };
});

jest.mock('firebase/auth', () => {
  return {
    getAuth: jest.fn().mockReturnValue({
      currentUser: null
    }),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn()
  };
});

jest.mock('firebase/firestore', () => {
  return {
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    serverTimestamp: jest.fn().mockReturnValue(new Date().toISOString()),
    GeoPoint: jest.fn().mockImplementation((lat, lng) => ({ lat, lng }))
  };
});

// OpenAI API 모킹 추가
jest.mock('../src/services/openaiService', () => ({
  callOpenAI: jest.fn().mockResolvedValue('이것은 AI 응답입니다'),
  generateMbtiBasedRecommendation: jest.fn().mockResolvedValue('MBTI 기반 추천 이유입니다'),
  generateMoodBasedRecommendation: jest.fn().mockResolvedValue('기분 기반 추천 이유입니다'),
  generateInterestBasedRecommendation: jest.fn().mockResolvedValue('관심사 기반 추천 이유입니다'),
  getSimilarPlaceRecommendations: jest.fn().mockResolvedValue([]),
  generateCustomTravelPlan: jest.fn().mockResolvedValue({ plan: '여행 계획입니다' })
}));

// 날씨 API 모킹 추가
jest.mock('../src/services/weatherService', () => ({
  getCurrentWeather: jest.fn().mockResolvedValue({
    temperature: 22,
    feelsLike: 23,
    humidity: 50,
    weather: {
      id: 800,
      main: 'Clear',
      description: '맑음',
      icon: '01d'
    }
  }),
  translateWeatherCondition: jest.fn(condition => condition === 'Clear' ? '맑음' : condition),
  getWeatherIconUrl: jest.fn().mockReturnValue('https://example.com/weather-icon.png'),
  calculateWeatherScore: jest.fn().mockReturnValue(8),
  getWeatherRecommendationText: jest.fn().mockReturnValue('좋은 날씨에 방문하기 좋은 장소입니다')
}));

// 분석 서비스 모킹 추가
jest.mock('../src/services/analyticsService', () => ({
  trackEvent: jest.fn(),
  trackScreenView: jest.fn(),
  trackPlaceView: jest.fn(),
  trackPlaceSave: jest.fn(),
  trackRecommendationClick: jest.fn(),
  trackSearch: jest.fn(),
  trackFeedbackSubmit: jest.fn(),
  trackProfileUpdate: jest.fn(),
  trackError: jest.fn(),
  trackWeatherApiUse: jest.fn(),
  trackOfflineMode: jest.fn(),
  trackAiRecommendation: jest.fn(),
  initializeAnalytics: jest.fn().mockReturnValue(true)
}));

// Sentry 모킹 추가
jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTags: jest.fn(),
  setExtra: jest.fn(),
  withScope: jest.fn(callback => callback({ setExtra: jest.fn(), setLevel: jest.fn() })),
  startSpan: jest.fn().mockReturnValue({
    end: jest.fn(),
    setStatus: jest.fn(),
    setData: jest.fn()
  }),
  lastEventId: jest.fn().mockReturnValue('mock-event-id'),
  sendFeedback: jest.fn(),
  ErrorBoundary: ({ children }) => children,
  withProfiler: Component => Component
}));

// 글로벌 모킹
global.fetch = jest.fn();
global.navigator.geolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn()
};

// 추가 CI 환경 탐지 및 설정
if (process.env.CI === 'true') {
  console.log('CI 환경에서 테스트를 실행 중입니다');
  
  // CI 환경에서 타임아웃 증가
  jest.setTimeout(30000);
  
  // 화면 크기 설정
  Object.defineProperty(window, 'innerWidth', { value: 1920 });
  Object.defineProperty(window, 'innerHeight', { value: 1080 });
}
