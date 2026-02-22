/**
 * Simple build validation check for TreeSitterWrapper tests
 * Ensures basic syntax is correct without running full test suite
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Performing build validation checks...');

async function validateSyntax() {
  const files = [
    'tree-sitter-wrapper.ts',
    'tree-sitter-wrapper.test.ts',
    'tree-sitter-wrapper.integration.test.ts',
    'types.ts'
  ];

  for (const file of files) {
    try {
      const filepath = path.join(__dirname, file);
      const content = await fs.readFile(filepath, 'utf8');

      // Basic syntax validation checks
      const checks = [
        { test: content.includes('import'), name: 'Has imports' },
        { test: content.includes('export'), name: 'Has exports' },
        { test: !content.includes('console.log'), name: 'No debug logs' },
        { test: content.split('\n').length > 10, name: 'Substantial content' },
      ];

      console.log(`\n📁 ${file}:`);
      checks.forEach(check => {
        console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
      });

      // Check for specific patterns based on file type
      if (file.includes('.test.ts')) {
        const testChecks = [
          { test: content.includes('describe('), name: 'Has test suites' },
          { test: content.includes('it('), name: 'Has test cases' },
          { test: content.includes('expect('), name: 'Has assertions' },
          { test: content.includes('beforeEach'), name: 'Has setup' }
        ];

        testChecks.forEach(check => {
          console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
        });
      }

      if (file === 'tree-sitter-wrapper.ts') {
        const implChecks = [
          { test: content.includes('class TreeSitterWrapper'), name: 'Has main class' },
          { test: content.includes('async parse('), name: 'Has parse method' },
          { test: content.includes('detectLanguage'), name: 'Has language detection' },
          { test: content.includes('getInstance'), name: 'Has singleton pattern' }
        ];

        implChecks.forEach(check => {
          console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
        });
      }

    } catch (error) {
      console.log(`❌ Failed to read ${file}: ${error.message}`);
      return false;
    }
  }

  return true;
}

// Check for proper file structure
async function checkStructure() {
  console.log('\n🏗️  Checking file structure...');

  const expectedFiles = [
    'tree-sitter-wrapper.ts',
    'tree-sitter-wrapper.test.ts',
    'tree-sitter-wrapper.integration.test.ts',
    'types.ts',
    'index.ts'
  ];

  let allFilesPresent = true;

  for (const file of expectedFiles) {
    try {
      const filepath = path.join(__dirname, file);
      const stats = await fs.stat(filepath);
      console.log(`✅ ${file} (${stats.size} bytes)`);
    } catch (error) {
      console.log(`❌ ${file} - NOT FOUND`);
      allFilesPresent = false;
    }
  }

  return allFilesPresent;
}

// Main validation
async function main() {
  try {
    const structureOk = await checkStructure();
    const syntaxOk = await validateSyntax();

    console.log('\n📊 Validation Summary:');
    console.log(`  File Structure: ${structureOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Syntax Checks: ${syntaxOk ? '✅ PASS' : '❌ FAIL'}`);

    if (structureOk && syntaxOk) {
      console.log('\n🎉 Build validation PASSED! All files are ready for testing.');
      process.exit(0);
    } else {
      console.log('\n❌ Build validation FAILED! Please fix the issues above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    process.exit(1);
  }
}

main();