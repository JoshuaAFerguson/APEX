const { ProjectContextAnalyzer } = require('./packages/core/dist/project-context-analyzer.js');
const path = require('path');

async function testFrameworkDetection() {
  console.log('Testing framework detection...');

  try {
    const analyzer = new ProjectContextAnalyzer(process.cwd());
    const detection = await analyzer.detectFrameworks();

    console.log('Framework detection successful!');
    console.log('Detected frameworks:', detection.frameworks?.length || 0);
    console.log('Primary framework:', detection.primary?.name || 'None');
    console.log('Languages:', detection.languages?.length || 0);
    console.log('Package manager:', detection.packageManager || 'Not detected');

    return true;
  } catch (error) {
    console.error('Framework detection failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testFrameworkDetection().then(success => {
  process.exit(success ? 0 : 1);
});