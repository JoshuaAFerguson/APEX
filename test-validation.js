#!/usr/bin/env node

/**
 * Quick validation script to verify withMockMCP() functionality
 * This runs a basic smoke test to ensure the implementation works
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Validating withMockMCP() implementation...\n');

try {
  // Change to orchestrator directory
  const orchestratorDir = path.join(__dirname, 'packages/orchestrator');
  process.chdir(orchestratorDir);

  console.log('📦 Running TypeScript compilation check...');
  execSync('npm run typecheck', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation passed\n');

  console.log('🧪 Running withMockMCP test suite...');

  // Run specific test files related to withMockMCP
  const testFiles = [
    'src/mcp/mock-server/__tests__/with-mock-mcp.test.ts',
    'src/mcp/mock-server/__tests__/with-mock-mcp.edge-cases.test.ts',
    'src/mcp/mock-server/__tests__/withMockMCP-acceptance-criteria.test.ts',
    'src/mcp/mock-server/__tests__/with-mock-mcp.coverage-report.test.ts',
  ];

  for (const testFile of testFiles) {
    console.log(`   Running: ${testFile}...`);
    try {
      execSync(`npx vitest run "${testFile}" --reporter=basic`, { stdio: 'inherit' });
      console.log(`   ✅ ${testFile} passed`);
    } catch (error) {
      console.log(`   ❌ ${testFile} failed`);
      throw error;
    }
  }

  console.log('\n🎉 All withMockMCP tests passed!');
  console.log('✅ Implementation is working correctly');

} catch (error) {
  console.error('\n❌ Validation failed:', error.message);
  process.exit(1);
}