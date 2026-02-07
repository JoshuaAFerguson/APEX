#!/usr/bin/env node

/**
 * Validation script to check fixture test syntax and imports
 */

import { createRequire } from 'module';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

async function validateTestFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');

    // Check for basic syntax issues
    const issues = [];

    // Check imports
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length === 0) {
      issues.push('No imports found');
    }

    // Check for vitest imports
    const hasVitestImport = importLines.some(line => line.includes('vitest'));
    if (!hasVitestImport) {
      issues.push('Missing vitest import');
    }

    // Check for describe blocks
    if (!content.includes('describe(')) {
      issues.push('No describe blocks found');
    }

    // Check for test blocks
    if (!content.includes('test(')) {
      issues.push('No test blocks found');
    }

    // Check for expect assertions
    if (!content.includes('expect(')) {
      issues.push('No expect assertions found');
    }

    return { filePath, issues };
  } catch (error) {
    return { filePath, issues: [`Failed to read file: ${error.message}`] };
  }
}

async function main() {
  const testFiles = [
    'packages/core/src/fixtures/__tests__/marketplace-scenarios-comprehensive.test.ts',
    'packages/core/src/fixtures/__tests__/fixture-schema-validation.test.ts',
    'packages/core/src/fixtures/__tests__/fixture-exports.test.ts'
  ];

  console.log('Validating fixture test files...\n');

  const results = await Promise.all(testFiles.map(validateTestFile));

  let hasErrors = false;

  for (const result of results) {
    if (result.issues.length === 0) {
      console.log(`✅ ${result.filePath} - OK`);
    } else {
      console.log(`❌ ${result.filePath} - Issues found:`);
      result.issues.forEach(issue => console.log(`   - ${issue}`));
      hasErrors = true;
    }
  }

  console.log('\nValidation Summary:');
  if (hasErrors) {
    console.log('❌ Some test files have issues that need to be addressed');
    process.exit(1);
  } else {
    console.log('✅ All test files passed basic validation');
  }

  console.log('\nTest File Statistics:');
  for (const result of results) {
    try {
      const content = await readFile(result.filePath, 'utf-8');
      const lines = content.split('\n').length;
      const describeBlocks = (content.match(/describe\(/g) || []).length;
      const testBlocks = (content.match(/test\(/g) || []).length;
      const expectAssertions = (content.match(/expect\(/g) || []).length;

      console.log(`\n📊 ${result.filePath}:`);
      console.log(`   Lines: ${lines}`);
      console.log(`   Describe blocks: ${describeBlocks}`);
      console.log(`   Test cases: ${testBlocks}`);
      console.log(`   Assertions: ${expectAssertions}`);
    } catch (error) {
      console.log(`   Could not read statistics: ${error.message}`);
    }
  }
}

main().catch(console.error);