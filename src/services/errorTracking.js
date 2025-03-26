// src/services/errorTracking.js

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// 환경 설정 가져오기
const env = process.env.REACT_APP_ENV || 'development';
const isErrorTrackingEnabled = process.env.REACT_APP_ENABLE_ERROR_REPORTING === 'true';
const sampleRate = parseFloat(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || '0.1');

/**
 * Sentry 초기화 함수
 * 오류 추적 및 성능 모니터링 설정
 */
export const initSentry = () => {
  if (!isErrorTrackingEnabled || !process.env.REACT_APP_SENTRY_DSN) {
    console.log('[ErrorTracking] 오류 추적이 비활성화되었거나 DSN이 설정되지 않았습니다.');
    return false;
  }

  try {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      integrations: [new BrowserTracing()],
      tracesSampleRate: sampleRate,
      environment: env,
      release: `mytripstyle@${process.env.REACT_APP_VERSION || '1.0.0'}`,
      // 개발 환경에서는 콘솔에만 출력
      beforeSend(event, hint) {
        if (env === 'development') {
          console.error('[ErrorTracking] 오류 발생:', hint.originalException || hint.syntheticException);
          return null;
        }
        return event;
      }
    });

    // 현재 환경 정보 및 브라우저 정보 태그 추가
    Sentry.setTags({
      app_env: env,
      browser: navigator.userAgent,
      platform: 'web',
      screen_width: window.innerWidth,
      screen_height: window.innerHeight
    });

    console.log('[ErrorTracking] Sentry가 성공적으로 초기화되었습니다.');
    return true;
  } catch (error) {
    console.error('[ErrorTracking] Sentry 초기화 실패:', error);
    return false;
  }
};

/**
 * 오류 로깅 함수
 * @param {Error} error - 오류 객체
 * @param {Object} context - 추가 컨텍스트 정보
 */
export const logError = (error, context = {}) => {
  if (!isErrorTrackingEnabled) {
    console.error('[ErrorTracking] 오류 발생:', error, context);
    return;
  }

  try {
    Sentry.withScope(scope => {
      // 추가 컨텍스트 정보
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });

      // 오류 심각도 설정
      if (context.level) {
        scope.setLevel(context.level);
      }

      // 오류 그룹화를 위한 지문(fingerprint) 설정
      if (context.fingerprint) {
        scope.setFingerprint(context.fingerprint);
      }

      // 오류 범주 설정
      if (context.category) {
        scope.setTag('category', context.category);
      }

      // 오류 캡처
      Sentry.captureException(error);
    });
  } catch (sentryError) {
    console.error('[ErrorTracking] 오류 로깅 실패:', sentryError);
    // 오류 백업 - 원래 오류 콘솔에 출력
    console.error('원래 오류:', error, context);
  }
};

/**
 * 사용자 정보 설정 함수
 * @param {Object} user - 사용자 정보 객체
 */
export const setUserInfo = (user) => {
  if (!isErrorTrackingEnabled) return;

  try {
    if (user && user.uid) {
      // 사용자 정보 설정
      Sentry.setUser({
        id: user.uid,
        email: user.email || undefined,
        mbti: user.mbti || undefined,
        username: user.displayName || undefined
      });
    } else {
      // 로그아웃 시 사용자 정보 제거
      Sentry.setUser(null);
    }
  } catch (error) {
    console.error('[ErrorTracking] 사용자 정보 설정 실패:', error);
  }
};

/**
 * 성능 추적 함수
 * @param {string} name - 추적 이름
 * @param {Function} operation - 추적할 작업 함수
 * @param {Object} options - 추가 옵션
 * @returns {any} - 작업 결과
 */
export const trackPerformance = async (name, operation, options = {}) => {
  if (!isErrorTrackingEnabled) {
    return await operation();
  }

  // Sentry.startTransaction 대신 Sentry.startSpan 사용
  const span = Sentry.startSpan({
    name,
    op: options.op || 'function',
    data: options.data || {}
  });

  try {
    // 현재 트랜잭션을 활성 스팬으로 설정 - configureScope 대신 withScope 사용
    // 작업 실행
    const result = await operation();
    span.setStatus('ok');
    return result;
  } catch (error) {
    span.setStatus('error');
    // 오류 정보를 트랜잭션에 추가
    span.setData('error', error.message);
    throw error;
  } finally {
    // 스팬 완료
    span.end();
  }
};

/**
 * 사용자 피드백 제출 함수
 * @param {string} feedback - 사용자 피드백 내용
 * @param {string} name - 이름 (선택사항)
 * @param {string} email - 이메일 (선택사항)
 * @param {string} eventId - 이벤트 ID (선택사항)
 */
export const submitUserFeedback = (feedback, name = '', email = '', eventId = null) => {
  if (!isErrorTrackingEnabled) {
    console.log('[ErrorTracking] 사용자 피드백:', feedback, { name, email });
    return;
  }

  try {
    const id = eventId || Sentry.lastEventId();
    
    if (!id) {
      console.warn('[ErrorTracking] 이벤트 ID가 없어 사용자 피드백을 제출할 수 없습니다.');
      return;
    }
    
    // captureUserFeedback 대신 sendFeedback 사용
    Sentry.sendFeedback({
      event_id: id,
      name,
      email,
      comments: feedback
    });
  } catch (error) {
    console.error('[ErrorTracking] 사용자 피드백 제출 실패:', error);
  }
};

/**
 * Sentry 오류 경계 컴포넌트
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

/**
 * withProfiler HOC - 컴포넌트 성능 프로파일링
 */
export const withProfiler = Sentry.withProfiler;

// 기본 내보내기
export default {
  initSentry,
  logError,
  setUserInfo,
  trackPerformance,
  submitUserFeedback,
  ErrorBoundary,
  withProfiler
};
