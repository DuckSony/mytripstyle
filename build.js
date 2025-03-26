// build.js
const { execSync } = require('child_process');

try {
  // npm ci 대신 npm install --legacy-peer-deps 실행
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  // 빌드 실행
  execSync('CI=false react-scripts build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
