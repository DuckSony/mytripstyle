// src/utils/webVitalsUtils.js

import { getCLS, getFID, getLCP, getTTFB, getFCP } from 'web-vitals';

// Core Web Vitals 지표 측정 및 보고
export const measureWebVitals = (onReport) => {
  getCLS(onReport);  // Cumulative Layout Shift
  getFID(onReport);  // First Input Delay
  getLCP(onReport);  // Largest Contentful Paint
  getTTFB(onReport); // Time to First Byte
  getFCP(onReport);  // First Contentful Paint
};

// 지표 점수에 따른 상태 평가
export const getVitalsStatus = (name, value) => {
  switch (name) {
    case 'LCP': // Largest Contentful Paint
      return value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor';
    case 'FID': // First Input Delay
      return value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor';
    case 'CLS': // Cumulative Layout Shift
      return value < 0.1 ? 'good' : value < 0.25 ? 'needs-improvement' : 'poor';
    case 'TTFB': // Time to First Byte
      return value < 500 ? 'good' : value < 1000 ? 'needs-improvement' : 'poor';
    case 'FCP': // First Contentful Paint
      return value < 1800 ? 'good' : value < 3000 ? 'needs-improvement' : 'poor';
    default:
      return 'unknown';
  }
};

// 지표 개선 방안
export const getVitalsImprovements = (metrics) => {
  const improvements = [];
  
  // LCP 개선 방안
  if (metrics.LCP && metrics.LCP.value > 2500) {
    improvements.push({
      metric: 'LCP',
      value: metrics.LCP.value,
      status: getVitalsStatus('LCP', metrics.LCP.value),
      suggestions: [
        '이미지 사전 로딩 (preload) 구현',
        '서버 응답 시간 개선',
        '렌더링 차단 리소스 제거',
        '주요 이미지 최적화'
      ]
    });
  }
  
  // FID 개선 방안
  if (metrics.FID && metrics.FID.value > 100) {
    improvements.push({
      metric: 'FID',
      value: metrics.FID.value,
      status: getVitalsStatus('FID', metrics.FID.value),
      suggestions: [
        '긴 실행 JavaScript 코드 분할',
        '사용자 상호작용 최적화',
        '불필요한 JavaScript 줄이기',
        'Web Workers 활용'
      ]
    });
  }
  
  // CLS 개선 방안
  if (metrics.CLS && metrics.CLS.value > 0.1) {
    improvements.push({
      metric: 'CLS',
      value: metrics.CLS.value,
      status: getVitalsStatus('CLS', metrics.CLS.value),
      suggestions: [
        '이미지 및 미디어 요소에 크기 속성 추가',
        '동적 콘텐츠에 공간 예약',
        '아이콘 및 폰트 최적화',
        '레이아웃 전환 애니메이션 개선'
      ]
    });
  }
  
  return improvements;
};
