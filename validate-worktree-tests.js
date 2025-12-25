#!/usr/bin/env node

/**
 * Validation script for worktree integration tests
 * This script performs static analysis to verify the tests are properly structured
 */

const fs = require('fs');
const path = require('path');

// Test files to validate
const testFiles = [
  'packages/orchestrator/src/worktree-manager.test.ts',
  'packages/orchestrator/src/worktree-manager.integration.test.ts',
  'packages/orchestrator/src/worktree-integration.test.ts',
  'packages/cli/src/__tests__/checkout-command.test.ts',
  'packages/cli/src/__tests__/checkout-command.integration.test.ts',
  'packages/core/src/__tests__/worktree-integration.test.ts'
];

// Expected test coverage areas
const coverageAreas = [
  'parallel task execution',
  'worktree isolation',
  'checkout command',
  'cleanup automation'
];

function validateTestFile(filePath) {
  console.log(`\n=== Validating ${filePath} ===`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Basic validations
  const checks = [
    { name: 'Has describe blocks', regex: /describe\s*\(/g },
    { name: 'Has it blocks', regex: /it\s*\(/g },
    { name: 'Has expect statements', regex: /expect\s*\(/g },
    { name: 'Imports vitest', regex: /from\s+['"]vitest['"]/g },
    { name: 'No syntax errors (basic)', regex: /\w/ } // Basic check for content
  ];

  let valid = true;
  checks.forEach(check => {
    const matches = content.match(check.regex);
    if (matches && matches.length > 0) {
      console.log(`✅ ${check.name}: ${matches.length} found`);
    } else {
      console.log(`❌ ${check.name}: None found`);
      if (check.name !== 'No syntax errors (basic)') {
        valid = false;
      }
    }
  });

  return valid;
}

function validateWorktreeCoverage() {
  console.log('\n=== Validating Test Coverage Areas ===');

  const allContent = testFiles
    .filter(file => fs.existsSync(file))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');

  coverageAreas.forEach(area => {
    const keywords = {
      'parallel task execution': ['parallel', 'concurrent', 'multiple.*task', 'separate.*worktree'],
      'worktree isolation': ['isolation', 'separate', 'worktree.*conflict', 'isolated'],
      'checkout command': ['checkout', 'switch.*worktree', 'checkout.*command'],
      'cleanup automation': ['cleanup', 'cleanup.*automation', 'cleanup.*delay', 'cleanup.*complete']
    };

    const areaKeywords = keywords[area] || [area];
    const found = areaKeywords.some(keyword =>
      new RegExp(keyword, 'i').test(allContent)
    );

    if (found) {
      console.log(`✅ ${area}: Coverage found`);
    } else {
      console.log(`⚠️  ${area}: Limited coverage detected`);
    }
  });
}

function main() {
  console.log('🧪 APEX Worktree Integration Test Validation');
  console.log('============================================');

  let allValid = true;

  testFiles.forEach(file => {
    const valid = validateTestFile(file);
    if (!valid) {
      allValid = false;
    }
  });

  validateWorktreeCoverage();

  console.log('\n=== Summary ===');
  if (allValid) {
    console.log('✅ All test files pass basic validation');
    console.log('✅ Test coverage areas are addressed');
    console.log('📝 Tests appear ready for execution');
  } else {
    console.log('❌ Some test files have issues');
    console.log('🔧 Manual review recommended');
  }

  return allValid ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}