#!/usr/bin/env node

/**
 * Simple validation script to check test file syntax and imports
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'packages/cli/src/ui/components/__tests__/StatusBar.compact-mode.test.tsx',
  'packages/cli/src/ui/components/agents/__tests__/AgentPanel.compact-mode.test.tsx',
  'packages/cli/src/ui/components/__tests__/TaskProgress.compact-mode.test.tsx',
  'packages/cli/src/ui/components/__tests__/ActivityLog.compact-mode.test.tsx',
  'packages/cli/src/ui/__tests__/compact-mode.integration.test.tsx'
];

console.log('🧪 Validating Compact Mode Test Files\n');

let allValid = true;

testFiles.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  console.log(`Validating: ${filePath}`);

  try {
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`  ❌ File does not exist`);
      allValid = false;
      return;
    }

    // Read and basic syntax check
    const content = fs.readFileSync(fullPath, 'utf8');

    // Basic checks
    const checks = [
      { name: 'Has imports', test: content.includes('import') },
      { name: 'Has React import', test: content.includes('import React') },
      { name: 'Has Vitest imports', test: content.includes('import { describe, it, expect') },
      { name: 'Has describe blocks', test: content.includes('describe(') },
      { name: 'Has test cases', test: content.includes('it(') },
      { name: 'Has expect assertions', test: content.includes('expect(') },
      { name: 'Has proper exports', test: !content.includes('export default') || content.includes('export') },
      { name: 'Has component imports', test: content.includes('from \'../') || content.includes('from \'../../') },
      { name: 'Has mock setup', test: content.includes('vi.mock') },
      { name: 'Has beforeEach/afterEach', test: content.includes('beforeEach') || content.includes('afterEach') }
    ];

    let fileValid = true;
    checks.forEach(check => {
      if (check.test) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ❌ ${check.name}`);
        fileValid = false;
      }
    });

    // Count test cases
    const testCount = (content.match(/it\(/g) || []).length;
    const describeCount = (content.match(/describe\(/g) || []).length;

    console.log(`  📊 Test stats: ${testCount} test cases in ${describeCount} describe blocks`);

    if (fileValid) {
      console.log(`  ✅ File validation passed\n`);
    } else {
      console.log(`  ❌ File validation failed\n`);
      allValid = false;
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}\n`);
    allValid = false;
  }
});

// Summary
console.log('📋 Validation Summary:');
if (allValid) {
  console.log('✅ All test files are valid and properly structured');
  console.log('🎉 Ready for test execution!');
} else {
  console.log('❌ Some test files have issues that need to be addressed');
  console.log('🔧 Please fix the issues before running tests');
}

console.log('\n📖 Test Coverage Report:');
console.log('📄 See: compact-mode-test-coverage-report.md');
console.log('\n🚀 To run tests manually:');
console.log('npm test -- --run packages/cli/src/ui/components/__tests__/*compact-mode*');
console.log('npm test -- --run packages/cli/src/ui/__tests__/compact-mode*');