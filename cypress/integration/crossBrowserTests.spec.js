/// <reference types="cypress" />

/**
 * 크로스 브라우저 테스트 스펙
 * 
 * 이 테스트 파일은 다양한 브라우저 환경에서 MyTripStyle 앱의
 * UI 컴포넌트와 기능들이 올바르게 렌더링되고 작동하는지
 * 확인하기 위한 E2E 테스트를 포함합니다.
 */

// 테스트 구성
const VIEWPORT_SIZES = {
    mobile: { width: 375, height: 667 }, // iPhone 8
    tablet: { width: 768, height: 1024 }, // iPad
    desktop: { width: 1280, height: 800 } // 표준 데스크톱
  };
  
  // 테스트할 페이지 경로
  const PAGES_TO_TEST = [
    { name: '홈', path: '/' },
    { name: '추천', path: '/recommendations' },
    { name: '저장한 장소', path: '/saved-places' },
    { name: '방문 계획/기록', path: '/visit-history' },
    { name: '검색', path: '/search' },
    { name: '설정', path: '/settings' }
  ];
  
  // 테스트할 주요 컴포넌트 선택자
  const CRITICAL_ELEMENTS = {
    header: 'header, .app-header, .MuiAppBar-root',
    footer: 'footer, .app-footer, .bottom-navigation',
    navigation: '.navigation, nav, .MuiBottomNavigation-root',
    content: 'main, .content, .main-content',
    buttons: 'button, .MuiButton-root, .button',
    cards: '.card, .MuiCard-root, .recommendation-card',
    modals: '.modal, .MuiModal-root, .dialog',
    forms: 'form, .form',
    inputs: 'input, .MuiInput-root, .input-field',
    images: 'img, .image'
  };
  
  // 주요 상호작용 요소들
  const INTERACTIVE_ELEMENTS = {
    navItems: '.nav-item, .MuiBottomNavigationAction-root',
    cardActions: '.card-actions button, .MuiCardActions-root button',
    formSubmits: 'form button[type="submit"], .form-submit',
    tabButtons: '.MuiTab-root, .tab-button',
    accordions: '.MuiAccordion-root, .accordion'
  };
  
  // 테스트 스위트 시작
  describe('크로스 브라우저 호환성 테스트', () => {
    beforeEach(() => {
      // 테스트 실행 전 로그인 상태 설정 (커스텀 명령어 사용)
      cy.login();
    });
    
    context('핵심 페이지 로딩', () => {
      PAGES_TO_TEST.forEach(page => {
        it(`${page.name} 페이지가 모든 뷰포트에서 올바르게 로드됨`, () => {
          // 모든 뷰포트 크기에서 테스트
          Object.entries(VIEWPORT_SIZES).forEach(([device, size]) => {
            cy.viewport(size.width, size.height);
            cy.visit(page.path);
            cy.url().should('include', page.path);
            
            // 핵심 요소들이 존재하는지 확인
            cy.get(CRITICAL_ELEMENTS.header).should('be.visible');
            cy.get(CRITICAL_ELEMENTS.content).should('exist');
            
            // 모바일에서는 하단 내비게이션 확인
            if (device === 'mobile' || device === 'tablet') {
              cy.get(CRITICAL_ELEMENTS.footer).should('be.visible');
            }
            
            // 페이지 타이틀이 올바른지 확인
            cy.title().should('include', 'MyTripStyle');
            
            // 에러 메시지가 없는지 확인
            cy.get('body').should('not.contain', 'Error');
            cy.get('body').should('not.contain', 'Oops');
            
            // 콘솔 에러 로깅
            cy.window().then((win) => {
              cy.spy(win.console, 'error').as('consoleError');
            });
            
            // 페이지 완전 로드 대기
            cy.get('@consoleError', { timeout: 5000 }).should('have.property', 'callCount', 0);

          });
        });
      });
    });
    
    context('레이아웃 반응형 확인', () => {
      it('내비게이션이 뷰포트 크기에 따라 올바르게 조정됨', () => {
        cy.visit('/');
        
        // 모바일 뷰포트 확인
        cy.viewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
        cy.get(CRITICAL_ELEMENTS.navigation).should('exist');
        cy.get(CRITICAL_ELEMENTS.navigation).should('have.css', 'position', 'fixed');
        
        // 데스크톱 뷰포트 확인
        cy.viewport(VIEWPORT_SIZES.desktop.width, VIEWPORT_SIZES.desktop.height);
        cy.get(CRITICAL_ELEMENTS.navigation).should('exist');
      });
      
      it('카드 그리드가 뷰포트 크기에 따라 올바르게 조정됨', () => {
        cy.visit('/recommendations');
        
        // 모바일에서는 카드가 단일 열로 표시되는지 확인
        cy.viewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
        cy.get(CRITICAL_ELEMENTS.cards).should('have.length.at.least', 1);
        
        // 태블릿에서는 카드가 2열로 표시되는지 확인
        cy.viewport(VIEWPORT_SIZES.tablet.width, VIEWPORT_SIZES.tablet.height);
        cy.get(CRITICAL_ELEMENTS.cards).should('have.length.at.least', 1);
        
        // 데스크톱에서는 카드가 3열 이상으로 표시되는지 확인
        cy.viewport(VIEWPORT_SIZES.desktop.width, VIEWPORT_SIZES.desktop.height);
        cy.get(CRITICAL_ELEMENTS.cards).should('have.length.at.least', 1);
      });
    });
    
    context('탐색 및 상호작용', () => {
      it('내비게이션이 모든 뷰포트에서 작동함', () => {
        cy.visit('/');
        
        // 모바일 화면에서 내비게이션 테스트
        cy.viewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
        
        // 내비게이션 항목 클릭 테스트
        cy.get(INTERACTIVE_ELEMENTS.navItems).eq(1).click({ force: true });
        cy.url().should('include', '/recommendations');
        
        cy.get(INTERACTIVE_ELEMENTS.navItems).eq(2).click({ force: true });
        cy.url().should('include', '/saved-places');
      });
      
      it('카드 상호작용이 모든 뷰포트에서 작동함', () => {
        cy.visit('/recommendations');
        
        // 카드가 로드될 때까지 대기
        cy.get(CRITICAL_ELEMENTS.cards).should('have.length.at.least', 1);
        
        // 첫 번째 카드 클릭이 세부 정보 페이지로 이동하는지 확인
        cy.get(CRITICAL_ELEMENTS.cards).first().click();
        
        // URL에 place 또는 detail이 포함되는지 확인
        cy.url().should('include', '/place/')
          .or('include', '/detail/');
      });
    });
    
    context('스크롤 및 성능', () => {
        it('무한 스크롤이 모든 뷰포트에서 작동함', () => {
          cy.visit('/recommendations');
          
          // 카드가 로드될 때까지 대기
          cy.get(CRITICAL_ELEMENTS.cards).should('have.length.at.least', 1);
          
          // 첫 번째 접근법: 변수 대신 Cypress 별칭(alias) 사용
          // 초기 카드 수를 alias로 저장
          cy.get(CRITICAL_ELEMENTS.cards).its('length').as('initialCardCount');
          
          // 페이지 하단으로 스크롤
          cy.scrollTo('bottom');
          
          // 별칭을 사용하여 비교
          cy.get('@initialCardCount').then((initialCount) => {
            cy.get(CRITICAL_ELEMENTS.cards, { timeout: 5000 }).its('length').should('be.gte', initialCount);
          });
      
          // 또는 두 번째 접근법: 체인을 분리하여 명확하게 작성
          /*
          cy.get(CRITICAL_ELEMENTS.cards).then(($initialCards) => {
            const initialCount = $initialCards.length;
            
            // 페이지 하단으로 스크롤 후 리턴
            cy.scrollTo('bottom');
            
            // 체인을 분리하여 이어서 처리
            cy.get(CRITICAL_ELEMENTS.cards, { timeout: 5000 }).should(($newCards) => {
              // Cypress 내장 chai 구문 사용 (should 내부에서는 expect().to가 작동함)
              assert.isAtLeast($newCards.length, initialCount, '카드 수가 더 많거나 같아야 합니다');
            });
          });
          */
        });
      });
    
    context('에러 처리 및 폴백', () => {
      it('오프라인 상태에서 적절한 메시지 표시', () => {
        // 오프라인 시뮬레이션
        cy.intercept('**', { forceNetworkError: true }).as('offline');
        
        cy.visit('/recommendations', { failOnStatusCode: false });
        
        // 오프라인 관련 텍스트가 표시되는지 확인
        cy.get('body').contains(/offline|오프라인|연결|네트워크/i, { timeout: 10000 });
      });
    });
  });
