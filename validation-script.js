/**
 * Simple validation script to test ProjectContextAnalyzer implementation
 */

// Import the class to verify it compiles and exports correctly
try {
  console.log('✓ Testing basic import...');

  // This will fail if there are compilation issues
  const { ProjectContextAnalyzer } = require('./packages/core/dist/project-context-analyzer.js');

  console.log('✓ Import successful');

  // Test basic instantiation
  const analyzer = new ProjectContextAnalyzer(process.cwd());
  console.log('✓ Class instantiation successful');

  // Verify methods exist
  const methods = [
    'analyze',
    'getGitStatus',
    'getProjectStructure',
    'detectFrameworks',
    'getConfigurationInfoList',
    'getTestFrameworkInfoList',
    'getProjectPath',
    'getOptions'
  ];

  for (const method of methods) {
    if (typeof analyzer[method] !== 'function') {
      throw new Error(`Method ${method} is not a function`);
    }
  }
  console.log('✓ All expected methods exist');

  console.log('\n🎉 Basic validation successful!');
  console.log('   - ProjectContextAnalyzer class can be imported');
  console.log('   - Class can be instantiated');
  console.log('   - All expected methods are present');

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}