// src/utils/performanceUtils.js
/**
 * 애플리케이션 성능 측정 및 최적화를 위한 유틸리티
 * Lighthouse 성능 점수 측정, Core Web Vitals 모니터링, 
 * 최적화 권장사항 생성 등의 기능을 제공합니다.
 */

// Core Web Vitals 상수 (ms 단위)
const CORE_WEB_VITALS = {
    LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
    FID: { good: 100, needsImprovement: 300 },  // First Input Delay
    CLS: { good: 0.1, needsImprovement: 0.25 }, // Cumulative Layout Shift
    FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
    TTI: { good: 3800, needsImprovement: 7300 }, // Time to Interactive
    TBT: { good: 200, needsImprovement: 600 }    // Total Blocking Time
  };
  
  /**
   * Lighthouse 성능 측정
   * 현재 페이지의 성능 점수를 측정합니다.
   * 
   * @param {Object} options - 옵션 객체
   * @param {string} options.page - 측정할 페이지 이름 (기본값: 'current')
   * @param {boolean} options.simulated - 시뮬레이션 모드 (개발 환경용, 기본값: true)
   * @returns {Promise<Object>} 측정 결과
   */
  export const measureLighthousePerformance = async (options = {}) => {
    const { page = 'current', simulated = true } = options;
    
    // 개발 환경에서는 시뮬레이션된 점수 반환 (실제로는 Lighthouse CI 또는 API 연동 필요)
    if (simulated || process.env.NODE_ENV === 'development') {
      console.log(`[성능] ${page} 페이지의 Lighthouse 성능 측정 (시뮬레이션)`);
      
      // 임의의 점수 생성 (실제 구현에서는 제거)
      const getRandomScore = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      
      // 성능 지표 - 실제로는 performance API와 PerformanceObserver를 통해 수집
      const metrics = {
        fcp: getRandomScore(1600, 3500),
        lcp: getRandomScore(2000, 4500),
        tti: getRandomScore(3200, 7800),
        cls: parseFloat((Math.random() * 0.3).toFixed(3)),
        tbt: getRandomScore(150, 700)
      };
      
      // 임의의 개선 권장사항 (실제 구현에서는 실제 성능 데이터 기반으로 생성)
      const generateImprovements = () => {
        const improvements = [];
        
        if (metrics.lcp > CORE_WEB_VITALS.LCP.needsImprovement) {
          improvements.push({
            title: 'LCP 개선 필요',
            description: '주요 콘텐츠 로딩 속도를 높이기 위해 이미지 최적화 및 리소스 우선순위 설정을 검토하세요.',
            impact: 'high'
          });
        }
        
        if (metrics.cls > CORE_WEB_VITALS.CLS.needsImprovement) {
          improvements.push({
            title: '레이아웃 시프트 감소 필요',
            description: '이미지 및 광고에 크기 속성을 지정하고, 동적 콘텐츠를 위한 공간을 미리 확보하세요.',
            impact: 'medium'
          });
        }
        
        if (metrics.tbt > CORE_WEB_VITALS.TBT.needsImprovement) {
          improvements.push({
            title: '메인 스레드 차단 시간 감소 필요',
            description: '긴 JavaScript 작업을 분할하고, 코드 분할을 통해 초기 번들 크기를 줄이세요.',
            impact: 'high'
          });
        }
        
        // 기본 개선 사항
        improvements.push({
          title: '이미지 최적화',
          description: 'WebP 또는 AVIF 형식을 사용하고, 지연 로딩을 적용하세요.',
          impact: 'medium'
        });
        
        improvements.push({
          title: '사용하지 않는 JavaScript 줄이기',
          description: '번들 분석을 통해 사용하지 않는 코드를 식별하고 제거하세요.',
          impact: 'medium'
        });
        
        return improvements;
      };
      
      // 측정 결과
      return {
        timestamp: Date.now(),
        page,
        performance: getRandomScore(60, 95),
        accessibility: getRandomScore(70, 98),
        bestPractices: getRandomScore(75, 95),
        seo: getRandomScore(80, 98),
        pwa: getRandomScore(50, 90),
        metrics,
        improvements: generateImprovements()
      };
    }
    
    // 실제 Lighthouse 측정 (Chrome 확장 프로그램 API 또는 Puppeteer 통합 필요)
    throw new Error('실제 Lighthouse 측정은 아직 구현되지 않았습니다.');
  };
  
  /**
   * Lighthouse 점수 기록 저장
   * 
   * @param {Object} scores - Lighthouse 점수 객체
   * @returns {boolean} 성공 여부
   */
  export const saveLighthouseScores = (scores) => {
    try {
      if (!scores || !scores.timestamp) return false;
      
      // 기존 기록 로드
      const existingScores = localStorage.getItem('lighthouse_scores');
      const scoresHistory = existingScores ? JSON.parse(existingScores) : {};
      
      // 페이지별 점수 저장
      const page = scores.page || 'default';
      if (!scoresHistory[page]) {
        scoresHistory[page] = [];
      }
      
      // 최대 10개까지만 저장
      scoresHistory[page].push(scores);
      if (scoresHistory[page].length > 10) {
        scoresHistory[page] = scoresHistory[page].slice(-10);
      }
      
      // 저장
      localStorage.setItem('lighthouse_scores', JSON.stringify(scoresHistory));
      
      return true;
    } catch (error) {
      console.error('Lighthouse 점수 저장 오류:', error);
      return false;
    }
  };
  
  /**
   * 저장된 Lighthouse 점수 이력 가져오기
   * 
   * @param {string} page - 페이지 이름 (기본값: 모든 페이지)
   * @returns {Array} 점수 이력
   */
  export const getLighthouseScoresHistory = (page) => {
    try {
      const existingScores = localStorage.getItem('lighthouse_scores');
      if (!existingScores) return [];
      
      const scoresHistory = JSON.parse(existingScores);
      
      // 특정 페이지 점수만 반환
      if (page && scoresHistory[page]) {
        return scoresHistory[page];
      }
      
      // 모든 페이지 점수 병합하여 반환
      if (!page) {
        return Object.values(scoresHistory).flat();
      }
      
      return [];
    } catch (error) {
      console.error('Lighthouse 점수 이력 가져오기 오류:', error);
      return [];
    }
  };
  
  /**
   * Core Web Vitals 상태 평가
   * 
   * @param {string} name - 지표 이름 (LCP, FID, CLS 등)
   * @param {number} value - 측정값
   * @returns {string} 상태 ('good', 'needs-improvement', 'poor')
   */
  export const getVitalsStatus = (name, value) => {
    if (!CORE_WEB_VITALS[name]) return 'unknown';
    
    const thresholds = CORE_WEB_VITALS[name];
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  };
  
  /**
   * Core Web Vitals 개선 권장사항 생성
   * 
   * @param {Object} metrics - 측정된 지표 객체
   * @returns {Array} 권장사항 목록
   */
  export const generateVitalsImprovements = (metrics) => {
    const improvements = [];
    
    // LCP 개선 권장사항
    if (metrics.LCP && metrics.LCP.value > CORE_WEB_VITALS.LCP.good) {
      improvements.push({
        metric: 'LCP',
        value: metrics.LCP.value,
        status: getVitalsStatus('LCP', metrics.LCP.value),
        suggestions: [
          '주요 이미지 사전 로딩 (preload) 구현',
          '서버 응답 시간 개선',
          '렌더링 차단 리소스 제거',
          'CDN 사용 고려'
        ]
      });
    }
    
    // FID 개선 권장사항
    if (metrics.FID && metrics.FID.value > CORE_WEB_VITALS.FID.good) {
      improvements.push({
        metric: 'FID',
        value: metrics.FID.value,
        status: getVitalsStatus('FID', metrics.FID.value),
        suggestions: [
          '긴 실행 JavaScript 코드 분할',
          '사용자 상호작용 처리 최적화',
          '불필요한 JavaScript 줄이기',
          'Web Workers 활용'
        ]
      });
    }
    
    // CLS 개선 권장사항
    if (metrics.CLS && metrics.CLS.value > CORE_WEB_VITALS.CLS.good) {
      improvements.push({
        metric: 'CLS',
        value: metrics.CLS.value,
        status: getVitalsStatus('CLS', metrics.CLS.value),
        suggestions: [
          '이미지 및 미디어 요소에 크기 속성 추가',
          '동적 콘텐츠를 위한 공간 미리 확보',
          '폰트 로딩 최적화',
          '애니메이션 전환 개선'
        ]
      });
    }
    
    return improvements;
  };
  
  /**
   * Lighthouse 최적화 체크리스트 가져오기
   * 
   * @returns {Object} 카테고리별 최적화 체크리스트
   */
  export const getLighthouseOptimizationChecklist = () => {
    return {
      performance: [
        '이미지 최적화 (WebP/AVIF 형식, 적절한 크기, 압축)',
        '중요하지 않은 CSS/JS 지연 로딩',
        'JavaScript 번들 크기 감소',
        '서비스 워커를 통한 캐싱 전략 개선',
        'Tree Shaking 및 코드 분할 최적화',
        '웹 폰트 최적화 (font-display 사용)'
      ],
      accessibility: [
        '적절한 색상 대비 확보',
        '모든 이미지에 대체 텍스트 제공',
        '키보드 접근성 개선',
        'ARIA 레이블 및 속성 적절히 사용',
        '의미 있는 시맨틱 HTML 사용'
      ],
      bestPractices: [
        'HTTPS 사용',
        '보안 취약점이 있는 라이브러리 업데이트',
        '콘솔 오류 제거',
        'doctype 선언 확인',
        '올바른 HTTP 헤더 설정'
      ],
      seo: [
        '적절한 메타 태그 사용',
        '모바일 친화적인 디자인',
        '구조화된 데이터 마크업 추가',
        '내부 링크 최적화',
        '사이트맵 제공'
      ]
    };
  };
  
  /**
   * 연속적인 래이아웃 시프트 (CLS) 모니터링
   */
  export const monitorCLS = () => {
    if (!window.PerformanceObserver) return;
    
    try {
      let clsValue = 0;
      let clsEntries = [];
      
      // CLS 관찰자 설정
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          // 무시해야 할 엔트리인지 확인
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsEntries.push(entry);
          }
        }
      });
      
      observer.observe({ type: 'layout-shift', buffered: true });
      
      // 결과 보고 함수
      const reportCLS = () => ({
        value: clsValue,
        entries: clsEntries,
        status: getVitalsStatus('CLS', clsValue)
      });
      
      return reportCLS;
    } catch (error) {
      console.error('CLS 모니터링 오류:', error);
      return () => ({ value: 0, entries: [], status: 'error' });
    }
  };
  
  /**
   * 최대 콘텐츠풀 페인트 (LCP) 모니터링
   */
  export const monitorLCP = () => {
    if (!window.PerformanceObserver) return;
    
    try {
      let lcpValue = 0;
      let lcpEntry = null;
      
      // LCP 관찰자 설정
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        if (lastEntry) {
          lcpEntry = lastEntry;
          lcpValue = lastEntry.startTime;
        }
      });
      
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      
      // 결과 보고 함수
      const reportLCP = () => ({
        value: lcpValue,
        entry: lcpEntry,
        status: getVitalsStatus('LCP', lcpValue)
      });
      
      return reportLCP;
    } catch (error) {
      console.error('LCP 모니터링 오류:', error);
      return () => ({ value: 0, entry: null, status: 'error' });
    }
  };
  
  /**
   * 첫 입력 지연 (FID) 모니터링
   */
  export const monitorFID = () => {
    if (!window.PerformanceObserver) return;
    
    try {
      let fidValue = 0;
      let fidEntry = null;
      
      // FID 관찰자 설정
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const firstEntry = entries[0];
        
        if (firstEntry) {
          fidEntry = firstEntry;
          fidValue = firstEntry.processingStart - firstEntry.startTime;
        }
      });
      
      observer.observe({ type: 'first-input', buffered: true });
      
      // 결과 보고 함수
      const reportFID = () => ({
        value: fidValue,
        entry: fidEntry,
        status: getVitalsStatus('FID', fidValue)
      });
      
      return reportFID;
    } catch (error) {
      console.error('FID 모니터링 오류:', error);
      return () => ({ value: 0, entry: null, status: 'error' });
    }
  };
  
  /**
   * 총 차단 시간 (TBT) 추정
   * 실제 TBT는 Lighthouse에서 측정되지만 이 함수는 근사치를 제공합니다.
   */
  export const estimateTBT = () => {
    if (!window.performance || !window.performance.timing) return 0;
    
    try {
      const navStart = window.performance.timing.navigationStart;
      const fcp = window.performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
      const tti = window.performance.getEntriesByName('interactive')[0]?.startTime || 0;
      
      if (!fcp || !tti) return 0;
      
      // 긴 작업 항목 검사
      const longTasks = window.performance.getEntriesByType('longtask') || [];
      
      let blockingTime = 0;
      for (const task of longTasks) {
        if (task.startTime > fcp && task.startTime < tti) {
          // 50ms 이상인 작업만 계산
          const taskDuration = task.duration;
          if (taskDuration > 50) {
            blockingTime += taskDuration - 50;
          }
        }
      }
      
      return blockingTime;
    } catch (error) {
      console.error('TBT 추정 오류:', error);
      return 0;
    }
  };
  
  /**
   * 성능 도우미 초기화
   * 
   * @returns {Function} 정리 함수
   */
  export const initPerformanceHelpers = () => {
    const cleanupFunctions = [];
    
    // CLS 모니터링
    const clsReporter = monitorCLS();
    if (clsReporter) {
      window.__CLS_REPORTER__ = clsReporter;
      cleanupFunctions.push(() => {
        delete window.__CLS_REPORTER__;
      });
    }
    
    // LCP 모니터링
    const lcpReporter = monitorLCP();
    if (lcpReporter) {
      window.__LCP_REPORTER__ = lcpReporter;
      cleanupFunctions.push(() => {
        delete window.__LCP_REPORTER__;
      });
    }
    
    // FID 모니터링
    const fidReporter = monitorFID();
    if (fidReporter) {
      window.__FID_REPORTER__ = fidReporter;
      cleanupFunctions.push(() => {
        delete window.__FID_REPORTER__;
      });
    }
    
    // 콘솔 명령어 추가
    window.getPerformanceReport = () => {
      const report = {
        cls: window.__CLS_REPORTER__ ? window.__CLS_REPORTER__() : null,
        lcp: window.__LCP_REPORTER__ ? window.__LCP_REPORTER__() : null,
        fid: window.__FID_REPORTER__ ? window.__FID_REPORTER__() : null,
        tbt: {
          value: estimateTBT(),
          status: getVitalsStatus('TBT', estimateTBT())
        },
        timestamp: Date.now()
      };
      
      console.table({
        'CLS': report.cls ? `${report.cls.value.toFixed(3)} (${report.cls.status})` : 'N/A',
        'LCP': report.lcp ? `${(report.lcp.value / 1000).toFixed(2)}s (${report.lcp.status})` : 'N/A',
        'FID': report.fid ? `${report.fid.value.toFixed(1)}ms (${report.fid.status})` : 'N/A',
        'TBT': `${report.tbt.value.toFixed(1)}ms (${report.tbt.status})`
      });
      
      return report;
    };
    
    // 정리 함수 반환
    return () => {
      cleanupFunctions.forEach(fn => fn());
      delete window.getPerformanceReport;
    };
  };
  
  /**
   * 메모리 사용량 측정
   * 
   * @returns {Object} 메모리 사용량 정보
   */
  export const getMemoryUsage = () => {
    if (!window.performance || !window.performance.memory) {
      return {
        used: 0,
        total: 0,
        percentage: 0,
        available: false
      };
    }
    
    try {
      const memory = window.performance.memory;
      const used = Math.round(memory.usedJSHeapSize / (1024 * 1024));
      const total = Math.round(memory.jsHeapSizeLimit / (1024 * 1024));
      const percentage = Math.round((used / total) * 100);
      
      return {
        used,
        total,
        percentage,
        available: true
      };
    } catch (error) {
      console.error('메모리 사용량 측정 오류:', error);
      return {
        used: 0,
        total: 0,
        percentage: 0,
        available: false,
        error: error.message
      };
    }
  };
  
  /**
   * 리소스 사용량 측정
   * 
   * @returns {Object} 리소스 사용량 정보
   */
  export const getResourceUsage = () => {
    if (!window.performance || !window.performance.getEntriesByType) {
      return {
        count: 0,
        totalSize: 0,
        available: false
      };
    }
    
    try {
      const resources = window.performance.getEntriesByType('resource');
      let totalSize = 0;
      
      // 리소스 유형별 분류
      const types = {};
      
      resources.forEach(resource => {
        // 리소스 크기 계산
        const resourceSize = resource.transferSize || resource.encodedBodySize || 0;
        totalSize += resourceSize;
        
        // 리소스 유형 파악
        const type = resource.initiatorType || 'other';
        types[type] = (types[type] || 0) + 1;
      });
      
      return {
        count: resources.length,
        totalSize,
        types,
        available: true
      };
    } catch (error) {
      console.error('리소스 사용량 측정 오류:', error);
      return {
        count: 0,
        totalSize: 0,
        available: false,
        error: error.message
      };
    }
  };
  
  /**
   * 메인 스레드 차단 시간 측정
   * 
   * @returns {Promise<Object>} 메인 스레드 차단 시간 정보
   */
  export const measureMainThreadBlocking = async () => {
    return new Promise(resolve => {
      // 지원하지 않는 브라우저 처리
      if (!window.requestIdleCallback) {
        resolve({ available: false });
        return;
      }
      
      const measurements = [];
      let measuring = true;
      let lastTimestamp = performance.now();
      
      // 측정 함수
      const measure = () => {
        const now = performance.now();
        const delta = now - lastTimestamp;
        
        // 16ms(60fps)보다 오래 걸린 경우 차단으로 간주
        if (delta > 16.7) {
          measurements.push({
            duration: delta,
            timestamp: now
          });
        }
        
        lastTimestamp = now;
        
        if (measuring) {
          requestAnimationFrame(measure);
        }
      };
      
      // 측정 시작
      requestAnimationFrame(measure);
      
      // 일정 시간 후 측정 종료 (2초)
      setTimeout(() => {
        measuring = false;
        
        // 결과 분석
        const totalBlocks = measurements.length;
        const totalBlockingTime = measurements.reduce((sum, m) => sum + m.duration, 0);
        const avgBlockingTime = totalBlocks > 0 ? totalBlockingTime / totalBlocks : 0;
        
        resolve({
          available: true,
          totalBlocks,
          totalBlockingTime,
          avgBlockingTime,
          measurements
        });
      }, 2000);
    });
  };
  
  /**
   * 애플리케이션 로딩 성능 측정
   * 
   * @returns {Object} 로딩 성능 정보
   */
  export const getLoadingPerformance = () => {
    if (!window.performance || !window.performance.timing) {
      return { available: false };
    }
    
    try {
      const timing = window.performance.timing;
      
      // 주요 로딩 지표 계산
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const dnsTime = timing.domainLookupEnd - timing.domainLookupStart;
      const connectTime = timing.connectEnd - timing.connectStart;
      const ttfb = timing.responseStart - timing.requestStart;
      const processingTime = timing.loadEventStart - timing.responseEnd;
      const domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
      
      return {
        available: true,
        loadTime,
        dnsTime,
        connectTime,
        ttfb,
        processingTime,
        domContentLoaded
      };
    } catch (error) {
      console.error('로딩 성능 측정 오류:', error);
      return { available: false, error: error.message };
    }
  };
  
  // 기본 내보내기
  export default {
    measureLighthousePerformance,
    saveLighthouseScores,
    getLighthouseScoresHistory,
    getVitalsStatus,
    generateVitalsImprovements,
    getLighthouseOptimizationChecklist,
    monitorCLS,
    monitorLCP,
    monitorFID,
    estimateTBT,
    initPerformanceHelpers,
    getMemoryUsage,
    getResourceUsage,
    measureMainThreadBlocking,
    getLoadingPerformance
  };
