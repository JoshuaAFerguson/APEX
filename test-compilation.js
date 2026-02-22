// Simple test to check if Python extractor can be imported
try {
  // Test TypeScript compilation by trying to import
  console.log('Testing Python extractor import...');

  // This will fail if there are TypeScript compilation errors
  const { PythonExtractor } = require('./packages/orchestrator/dist/codebase-intelligence/extractors/python-extractor.js');

  console.log('✅ PythonExtractor imported successfully');

  // Test basic instantiation
  const extractor = PythonExtractor.getInstance();
  console.log('✅ PythonExtractor singleton created successfully');

  console.log('✅ All basic compilation tests passed');

} catch (error) {
  console.error('❌ Compilation test failed:', error.message);
  process.exit(1);
}