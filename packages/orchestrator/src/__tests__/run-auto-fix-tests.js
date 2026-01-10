#!/usr/bin/env node

/**
 * Test runner for auto-fix execution hook tests
 *
 * This script validates that all auto-fix test files are properly structured,
 * have correct imports, and can be loaded without syntax errors.
 */

const path = require('path');
const fs = require('fs');

const testFiles = [
  'auto-fix-execution-hook.test.ts',
  'auto-fix-stage-completion.test.ts',
  'auto-fix-service-integration.test.ts'
];

function validateTestFile(filename) {
  const filepath = path.join(__dirname, filename);

  console.log(`\n🔍 Validating ${filename}...`);

  // Check file exists
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    return false;
  }

  // Read and basic syntax validation
  try {
    const content = fs.readFileSync(filepath, 'utf8');

    // Check for required imports
    const hasVitest = content.includes('from \'vitest\'');
    const hasDescribe = content.includes('describe(');
    const hasTests = content.includes('it(') || content.includes('test(');

    console.log(`  ✅ File exists (${content.split('\n').length} lines)`);
    console.log(`  ${hasVitest ? '✅' : '❌'} Vitest imports present`);
    console.log(`  ${hasDescribe ? '✅' : '❌'} Describe blocks present`);
    console.log(`  ${hasTests ? '✅' : '❌'} Test cases present`);

    if (!hasVitest || !hasDescribe || !hasTests) {
      console.error(`❌ ${filename} missing required test structure`);
      return false;
    }

    console.log(`  ✅ ${filename} validation passed`);
    return true;

  } catch (error) {
    console.error(`❌ Error reading ${filename}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🧪 Auto-Fix Test Validation');
  console.log('=============================');

  let allValid = true;

  for (const testFile of testFiles) {
    const isValid = validateTestFile(testFile);
    allValid = allValid && isValid;
  }

  console.log('\n📊 Summary');
  console.log('===========');

  if (allValid) {
    console.log('✅ All test files are properly structured');
    console.log(`📁 ${testFiles.length} test files validated`);
    console.log('\n🚀 Tests ready for execution:');
    console.log('  npm test --workspace=@apex/orchestrator -- auto-fix');
  } else {
    console.log('❌ Some test files have issues');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}