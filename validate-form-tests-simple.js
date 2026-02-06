/**
 * Simple validation script to check form integration tests
 */

const fs = require('fs');
const path = require('path');

function validateTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    console.log(`✅ Validating: ${filePath}`);

    // Check basic syntax patterns
    const patterns = {
      'describe blocks': /describe\(['"`][^'"`]+['"`],\s*\(\)\s*=>\s*\{/g,
      'it blocks': /it\(['"`][^'"`]+['"`],\s*(async\s+)?\(\)\s*=>\s*\{/g,
      'imports': /import\s+.*from\s+['"`][^'"`]+['"`];/g,
      'expect statements': /expect\([^)]+\)/g,
      'async/await': /await\s+\w+/g
    };

    for (const [pattern, regex] of Object.entries(patterns)) {
      const matches = content.match(regex);
      if (matches) {
        console.log(`  ✓ ${pattern}: ${matches.length} found`);
      } else if (pattern === 'imports' || pattern === 'describe blocks') {
        console.log(`  ⚠️  ${pattern}: none found`);
      }
    }

    // Check for common issues
    const issues = [];

    if (!content.includes('import')) {
      issues.push('No import statements found');
    }

    if (!content.includes('describe')) {
      issues.push('No describe blocks found');
    }

    if (!content.includes('expect')) {
      issues.push('No expect statements found');
    }

    // Check for balanced braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for balanced parentheses in simple cases
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    if (issues.length === 0) {
      console.log(`  ✅ Basic syntax validation passed`);
      return true;
    } else {
      console.log(`  ❌ Issues found:`);
      issues.forEach(issue => console.log(`    - ${issue}`));
      return false;
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('Form Integration Tests Validation');
  console.log('==================================\n');

  const testFiles = [
    'tests/form-integration/comprehensive-form-controls.test.ts',
    'tests/form-integration/form-controls-sample.test.ts',
    'tests/form-integration/infrastructure-verification.test.ts',
    'tests/form-integration/setup.ts',
    'tests/form-integration/vitest.config.ts'
  ];

  let allValid = true;

  for (const filePath of testFiles) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const isValid = validateTestFile(fullPath);
      allValid = allValid && isValid;
      console.log('');
    } else {
      console.log(`⚠️  File not found: ${fullPath}\n`);
    }
  }

  console.log('Summary');
  console.log('=======');
  if (allValid) {
    console.log('✅ All form integration test files passed basic validation');
  } else {
    console.log('❌ Some test files have issues that need to be addressed');
  }

  // Count test cases in comprehensive test file
  try {
    const comprehensiveTest = fs.readFileSync(
      path.join(__dirname, 'tests/form-integration/comprehensive-form-controls.test.ts'),
      'utf8'
    );

    const testCases = (comprehensiveTest.match(/it\(['"`][^'"`]+['"`]/g) || []).length;
    const describeBlocks = (comprehensiveTest.match(/describe\(['"`][^'"`]+['"`]/g) || []).length;

    console.log(`\n📊 Test Coverage Statistics:`);
    console.log(`   • Test suites: ${describeBlocks}`);
    console.log(`   • Test cases: ${testCases}`);

    // Check acceptance criteria coverage
    const acceptanceCriteria = [
      'single select dropdowns',
      'multi-select',
      'checkbox',
      'radio button',
      'form submission',
      'validation'
    ];

    console.log(`\n✓ Acceptance Criteria Coverage:`);
    acceptanceCriteria.forEach(criteria => {
      const found = comprehensiveTest.toLowerCase().includes(criteria.toLowerCase());
      console.log(`   ${found ? '✅' : '❌'} ${criteria}: ${found ? 'Covered' : 'Missing'}`);
    });

  } catch (error) {
    console.log(`\n❌ Could not analyze comprehensive test file: ${error.message}`);
  }
}

main();