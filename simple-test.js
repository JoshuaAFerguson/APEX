// Test basic module loading
try {
  console.log('Testing module import...');
  const { ProjectContextAnalyzer } = require('./packages/core/dist/project-context-analyzer.js');
  console.log('✅ Successfully imported ProjectContextAnalyzer');
  console.log('Class methods:', Object.getOwnPropertyNames(ProjectContextAnalyzer.prototype).filter(m => m !== 'constructor'));

  console.log('\nCreating analyzer instance...');
  const analyzer = new ProjectContextAnalyzer(process.cwd());
  console.log('✅ Successfully created analyzer instance');

  console.log('✅ Test completed successfully');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}