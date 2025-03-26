// ***********************************************************
// 이 파일은 모든 spec 파일 전에 로드됩니다.
// 여기서 커스텀 명령이나 전역 구성을 추가할 수 있습니다.
// ***********************************************************

// 커스텀 명령 예시: 키보드 탭 이동 명령
Cypress.Commands.add('tab', { prevSubject: 'optional' }, (subject) => {
    const tab = subject 
      ? cy.wrap(subject).trigger('keydown', { keyCode: 9, which: 9 })
      : cy.focused().trigger('keydown', { keyCode: 9, which: 9 });
    
    return tab;
  });
  
  // 실패한 테스트의 자동 스크린샷 설정
  Cypress.Screenshot.defaults({
    capture: 'viewport',
    scale: false
  });
  
  // 브라우저 콘솔 로그를 Cypress 로그에 표시
  Cypress.on('window:before:load', (win) => {
    cy.spy(win.console, 'log').as('consoleLog');
    cy.spy(win.console, 'error').as('consoleError');
    cy.spy(win.console, 'warn').as('consoleWarn');
  });
  
  // 전역 예외 처리
  Cypress.on('uncaught:exception', (err, runnable) => {
    // 예외를 테스트 실패로 처리하지 않으려면 false 반환
    // 개발 중 유용하지만 프로덕션 테스트에서는 주의해서 사용
    return false;
  });
