// jest.config.js
module.exports = {
    // 테스트 환경 설정
    testEnvironment: 'jsdom',
    
    // 테스트 파일 패턴
    testMatch: [
      '**/__tests__/**/*.js?(x)',
      '**/?(*.)+(spec|test).js?(x)'
    ],
    
    // 테스트 제외 패턴
    testPathIgnorePatterns: [
      '/node_modules/',
      '/build/',
      '/.github/'
    ],
    
    // 코드 변환 설정
    transform: {
      '^.+\\.(js|jsx)$': 'babel-jest',
      '^.+\\.(css|scss|sass)$': '<rootDir>/config/jest/cssTransform.js',
      '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/config/jest/fileTransform.js'
    },
    
    // 변환하지 않을 모듈 패턴
    transformIgnorePatterns: [
      '/node_modules/(?!(@mui|swiper|ssr-window|dom7|framer-motion)/)'
    ],
    
    // 모듈 이름 매핑
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    
    // 테스트 설정 파일
    setupFilesAfterEnv: [
      '<rootDir>/src/setupTests.js'
    ],
    
    // 코드 커버리지 설정
    collectCoverageFrom: [
      'src/**/*.{js,jsx}',
      '!src/**/*.d.ts',
      '!src/index.js',
      '!src/reportWebVitals.js',
      '!src/serviceWorkerRegistration.js',
      '!src/setupTests.js',
      '!src/**/stories/**',
      '!src/utils/serviceWorkerRegistration.js',
      '!src/config/firebase.js'
    ],
    
    // 커버리지 출력 설정
    coverageReporters: ['text', 'lcov'],
    
    // 커버리지 임계값 설정
    coverageThreshold: {
      global: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    },
    
    // 테스트 환경 타임아웃 설정 (기본 5초)
    testTimeout: 10000,
    
    // 에러 포맷팅 설정
    errorOnDeprecated: true,
    
    // watch 모드에서 사용할 플러그인
    watchPlugins: [
      'jest-watch-typeahead/filename',
      'jest-watch-typeahead/testname'
    ],
    
    // 테스트 결과 보고 설정
    verbose: true,
    
    // 모의(mock) 설정
    resetMocks: true,
    restoreMocks: true,
    
    // 글로벌 모의 객체 설정
    globals: {
      'ts-jest': {
        isolatedModules: true
      }
    },
    
    // CI 환경에서의 설정
    ...(process.env.CI && {
      reporters: [
        'default',
        ['jest-junit', {
          outputDirectory: './test-results/jest',
          outputName: 'results.xml'
        }]
      ],
      bail: 1,
      ci: true
    })
  };
