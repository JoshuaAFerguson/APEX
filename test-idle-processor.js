#!/usr/bin/env node

// Simple test runner to verify the idle processor database integration tests
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🧪 Running IdleProcessor database integration tests...\n');

  // Build first to ensure TypeScript compilation
  console.log('📦 Building packages...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n🔍 Running specific idle processor database tests...');

  // Run the specific test files I created
  const testFiles = [
    'packages/orchestrator/src/__tests__/idle-processor-database-integration.test.ts',
    'packages/orchestrator/src/__tests__/idle-task-persistence.integration.test.ts',
    'packages/orchestrator/src/__tests__/idle-processor-edge-cases.test.ts'
  ];

  for (const testFile of testFiles) {
    console.log(`\n🧪 Running ${testFile}...`);
    try {
      execSync(`npx vitest run ${testFile} --reporter=verbose`, { stdio: 'inherit' });
      console.log(`✅ ${testFile} passed!`);
    } catch (error) {
      console.log(`❌ ${testFile} failed!`);
      process.exit(1);
    }
  }

  console.log('\n🎉 All IdleProcessor database integration tests passed!');

  // Run coverage for the orchestrator package
  console.log('\n📊 Running coverage analysis...');
  execSync('npx vitest run packages/orchestrator/src --coverage --reporter=verbose', { stdio: 'inherit' });

} catch (error) {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
}