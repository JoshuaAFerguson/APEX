#!/usr/bin/env node

/**
 * Validation script for custom wait condition tests
 * Checks syntax and basic structure of the new integration test files
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test files to validate
const testFiles = [
  'tests/browser-integration/custom-wait-conditions.integration.test.ts',
  'tests/browser-integration/custom-predicate-wait-conditions.integration.test.ts'
];

console.log('🔍 Validating Custom Wait Condition Integration Tests\n');

let allValid = true;

for (const testFile of testFiles) {
  const fullPath = join(__dirname, testFile);

  console.log(`📄 Checking ${testFile}...`);

  // Check if file exists
  if (!existsSync(fullPath)) {
    console.log(`  ❌ File not found: ${fullPath}`);
    allValid = false;
    continue;
  }

  try {
    // Read file content
    const content = readFileSync(fullPath, 'utf-8');

    // Basic syntax checks
    const checks = [
      {
        name: 'Has describe blocks',
        test: content.includes('describe('),
        required: true
      },
      {
        name: 'Has it blocks',
        test: content.includes('it('),
        required: true
      },
      {
        name: 'Imports vitest',
        test: content.includes('from \'vitest\''),
        required: true
      },
      {
        name: 'Imports playwright',
        test: content.includes('from \'playwright\''),
        required: true
      },
      {
        name: 'Has beforeEach/afterEach',
        test: content.includes('beforeEach') && content.includes('afterEach'),
        required: true
      },
      {
        name: 'Has waitForFunction tests',
        test: content.includes('waitForFunction'),
        required: true
      },
      {
        name: 'Uses expect assertions',
        test: content.includes('expect('),
        required: true
      },
      {
        name: 'Has proper file header comment',
        test: content.startsWith('/**'),
        required: false
      },
      {
        name: 'No obvious syntax errors (basic)',
        test: !content.includes('}}}}') && !content.includes(')))'),
        required: true
      },
      {
        name: 'Has async/await usage',
        test: content.includes('async ') && content.includes('await '),
        required: true
      }
    ];

    let fileValid = true;

    for (const check of checks) {
      const status = check.test ? '✅' : (check.required ? '❌' : '⚠️');
      console.log(`  ${status} ${check.name}`);

      if (!check.test && check.required) {
        fileValid = false;
        allValid = false;
      }
    }

    // Check line count (should be substantial)
    const lineCount = content.split('\n').length;
    const hasSubstantialContent = lineCount > 100;
    console.log(`  ${hasSubstantialContent ? '✅' : '⚠️'} File has ${lineCount} lines (substantial content)`);

    // Check for test count
    const testCount = (content.match(/it\(/g) || []).length;
    const hasMultipleTests = testCount >= 10;
    console.log(`  ${hasMultipleTests ? '✅' : '⚠️'} File has ${testCount} test cases`);

    if (fileValid) {
      console.log('  ✅ File validation passed\n');
    } else {
      console.log('  ❌ File validation failed\n');
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}\n`);
    allValid = false;
  }
}

// Summary
console.log('📋 Validation Summary');
console.log('═══════════════════');

if (allValid) {
  console.log('✅ All test files passed validation');
  console.log('✅ Files are ready for build and test execution');
} else {
  console.log('❌ Some test files failed validation');
  console.log('⚠️  Please review and fix the issues above');
}

// Check TypeScript configuration
const tsconfigPath = join(__dirname, 'tsconfig.json');
if (existsSync(tsconfigPath)) {
  console.log('✅ TypeScript configuration found');
} else {
  console.log('⚠️  TypeScript configuration not found at project root');
}

// Check package.json scripts
const packageJsonPath = join(__dirname, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const hasTestScripts = packageJson.scripts && (
    packageJson.scripts.test ||
    packageJson.scripts['test:browser-integration'] ||
    packageJson.scripts.build
  );

  if (hasTestScripts) {
    console.log('✅ Test scripts found in package.json');
  } else {
    console.log('⚠️  Test scripts not found in package.json');
  }
}

console.log('\n🎯 Next Steps:');
console.log('1. Run `npm run build` to check for TypeScript compilation errors');
console.log('2. Run `npm run test:browser-integration` to execute the integration tests');
console.log('3. Verify all tests pass with the new custom wait condition functionality');

process.exit(allValid ? 0 : 1);