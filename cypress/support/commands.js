// 자주 사용하는 커스텀 명령을 이곳에 추가하세요

// 로그인 헬퍼 명령
Cypress.Commands.add('login', (email = 'test@example.com', password = 'password123') => {
    cy.visit('/login');
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/login');
  });
  
  // 특정 페이지로 이동 명령
  Cypress.Commands.add('navigateTo', (page) => {
    const routes = {
      'home': '/',
      'recommendations': '/recommendations',
      'saved': '/saved-places',
      'history': '/visit-history',
      'search': '/search',
      'settings': '/settings'
    };
    
    const path = routes[page] || page;
    cy.visit(path);
  });
  
  // 반응형 테스트를 위한 뷰포트 전환 명령
  Cypress.Commands.add('setViewport', (device) => {
    const viewports = {
      'mobile': { width: 375, height: 667 },
      'tablet': { width: 768, height: 1024 },
      'desktop': { width: 1280, height: 800 }
    };
    
    const size = viewports[device] || { width: 1280, height: 800 };
    cy.viewport(size.width, size.height);
  });
