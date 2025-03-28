// build.js
const { execSync } = require('child_process');
const isWindows = process.platform === 'win32';

try {
  // npm ci 대신 npm install --legacy-peer-deps 실행
  console.log('Installing dependencies...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  // OS에 따라 다른 환경변수 설정 방식 사용
  console.log('Building the app...');
  if (isWindows) {
    // Windows 환경
    execSync('set "DISABLE_ESLINT_PLUGIN=false" && set "CI=false" && react-scripts build', { stdio: 'inherit' });
  } else {
    // Unix/Linux/MacOS 환경
    execSync('DISABLE_ESLINT_PLUGIN=false CI=false react-scripts build', { stdio: 'inherit' });
  }
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
