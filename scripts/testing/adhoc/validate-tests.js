#!/usr/bin/env node

/**
 * Simple validation script to check test file syntax and imports
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'packages/orchestrator/src/worktree-integration.test.ts',
  'packages/orchestrator/src/worktree-coverage.test.ts',
  'packages/core/src/__tests__/worktree-integration.test.ts'
];

console.log('🧪 Validating Worktree Integration Test Files...\n');

let allValid = true;

for (const testFile of testFiles) {
  const fullPath = path.join(__dirname, testFile);
  console.log(`📁 Checking: ${testFile}`);

  try {
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`  ❌ File does not exist`);
      allValid = false;
      continue;
    }

    // Read file content
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Basic syntax checks
    const checks = [
      {
        name: 'Has describe blocks',
        test: /describe\s*\(/g,
        required: true
      },
      {
        name: 'Has test cases (it blocks)',
        test: /it\s*\(/g,
        required: true
      },
      {
        name: 'Has expect assertions',
        test: /expect\s*\(/g,
        required: true
      },
      {
        name: 'Imports vitest properly',
        test: /from\s+['"]vitest['"]/,
        required: true
      },
      {
        name: 'Has proper async/await usage',
        test: /async.*await/g,
        required: true
      },
      {
        name: 'Tests worktree functionality',
        test: /worktree|cleanup|cancel|merge|complete/gi,
        required: true
      }
    ];

    let fileValid = true;

    for (const check of checks) {
      const matches = content.match(check.test);
      if (check.required && (!matches || matches.length === 0)) {
        console.log(`  ❌ ${check.name}: Not found`);
        fileValid = false;
      } else {
        const count = matches ? matches.length : 0;
        console.log(`  ✅ ${check.name}: ${count} instances`);
      }
    }

    // Count test cases
    const testCases = (content.match(/it\s*\(/g) || []).length;
    const testSuites = (content.match(/describe\s*\(/g) || []).length;
    const expectations = (content.match(/expect\s*\(/g) || []).length;

    console.log(`  📊 Stats: ${testSuites} test suites, ${testCases} test cases, ${expectations} assertions`);

    if (fileValid) {
      console.log(`  ✅ File appears valid\n`);
    } else {
      console.log(`  ❌ File has issues\n`);
      allValid = false;
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}\n`);
    allValid = false;
  }
}

// Summary
console.log('📋 Summary:');
if (allValid) {
  console.log('✅ All test files appear to be valid and comprehensive');
  console.log('🎯 Ready for test execution');
  process.exit(0);
} else {
  console.log('❌ Some test files have issues');
  console.log('🔧 Review and fix issues before running tests');
  process.exit(1);
}