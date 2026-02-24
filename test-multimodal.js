#!/usr/bin/env node

/**
 * Simple test runner to verify multimodal integration tests
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Testing MultimodalInputHandler Integration...\n');

try {
  // Change to project directory
  process.chdir(path.dirname(__filename));

  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful\n');

  console.log('🧪 Running multimodal integration tests...');

  // Run specific test files
  const testFiles = [
    'packages/orchestrator/src/multimodal-input-validation.test.ts',
    'packages/orchestrator/src/createTask-multimodal.test.ts',
    'packages/orchestrator/src/multimodal-integration-comprehensive.test.ts',
    'packages/orchestrator/src/multimodal-error-handling.test.ts'
  ];

  for (const testFile of testFiles) {
    console.log(`Running: ${testFile}`);
    try {
      execSync(`npm test -- ${testFile}`, { stdio: 'inherit' });
      console.log(`✅ ${testFile} passed\n`);
    } catch (error) {
      console.error(`❌ ${testFile} failed`);
      console.error(error.message);
    }
  }

  console.log('🎯 Running all tests to verify no regressions...');
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ All tests passed!\n');

  console.log('📊 Generating coverage report...');
  try {
    execSync('npm test -- --coverage', { stdio: 'inherit' });
    console.log('✅ Coverage report generated\n');
  } catch (error) {
    console.log('⚠️ Coverage report generation failed (optional)');
  }

  console.log('🎉 Multimodal integration testing complete!');

} catch (error) {
  console.error('❌ Test execution failed:');
  console.error(error.message);
  process.exit(1);
}