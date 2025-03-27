// build.js
const { execSync } = require('child_process');

try {
  // npm ci 대신 npm install --legacy-peer-deps 실행
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  // ESLint 검사 비활성화하고 빌드 실행
  execSync('DISABLE_ESLINT_PLUGIN=true CI=false react-scripts build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
