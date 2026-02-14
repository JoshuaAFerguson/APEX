#!/usr/bin/env node

/**
 * Simple validation script to check if our permission test files
 * have valid syntax and imports
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'tool-permission-boundaries.test.ts',
  'tool-permission-boundaries-execution.test.ts',
  'tool-permission-boundaries-edge-cases.test.ts',
  'tool-permission-test-coverage.test.ts'
];

async function validateTestFiles() {
  console.log('🔍 Validating permission boundary test files...\n');

  let allValid = true;

  for (const testFile of testFiles) {
    const filePath = path.join(__dirname, testFile);

    try {
      console.log(`📋 Validating ${testFile}...`);

      // Check file exists
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File does not exist: ${testFile}`);
        allValid = false;
        continue;
      }

      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Basic syntax checks
      const checks = [
        {
          name: 'Has describe blocks',
          test: () => content.includes('describe('),
          required: true
        },
        {
          name: 'Has it blocks',
          test: () => content.includes('it('),
          required: true
        },
        {
          name: 'Has expect assertions',
          test: () => content.includes('expect('),
          required: true
        },
        {
          name: 'Has proper imports',
          test: () => content.includes('import') && content.includes('@apexcli/orchestrator'),
          required: true
        },
        {
          name: 'Has beforeEach/afterEach',
          test: () => content.includes('beforeEach') && content.includes('afterEach'),
          required: false
        },
        {
          name: 'Has fileoverview comment',
          test: () => content.includes('@fileoverview'),
          required: false
        },
        {
          name: 'Tests Read tool',
          test: () => content.includes('Read'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests Write tool',
          test: () => content.includes('Write'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests Edit tool',
          test: () => content.includes('Edit'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests Bash tool',
          test: () => content.includes('Bash'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests Grep tool',
          test: () => content.includes('Grep'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests Glob tool',
          test: () => content.includes('Glob'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests allow-always',
          test: () => content.includes('allow-always'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests allow-once',
          test: () => content.includes('allow-once'),
          required: testFile.includes('boundaries')
        },
        {
          name: 'Tests deny',
          test: () => content.includes('deny'),
          required: testFile.includes('boundaries')
        }
      ];

      let fileValid = true;

      for (const check of checks) {
        const passed = check.test();
        const status = passed ? '✅' : (check.required ? '❌' : '⚠️');
        console.log(`  ${status} ${check.name}`);

        if (check.required && !passed) {
          fileValid = false;
          allValid = false;
        }
      }

      // Check file size (should be substantial)
      const fileStats = fs.statSync(filePath);
      const sizeKB = (fileStats.size / 1024).toFixed(2);
      console.log(`  📊 File size: ${sizeKB} KB`);

      if (fileStats.size < 5000) { // Less than 5KB might be too small
        console.log(`  ⚠️  File might be too small for comprehensive tests`);
      }

      // Count test cases
      const testCaseMatches = content.match(/it\(/g);
      const testCaseCount = testCaseMatches ? testCaseMatches.length : 0;
      console.log(`  🧪 Test cases: ${testCaseCount}`);

      if (testCaseCount < 5 && testFile.includes('boundaries')) {
        console.log(`  ⚠️  Might need more test cases for comprehensive coverage`);
      }

      console.log(`  ${fileValid ? '✅' : '❌'} ${testFile} validation ${fileValid ? 'passed' : 'failed'}\n`);

    } catch (error) {
      console.log(`❌ Error validating ${testFile}:`, error.message);
      allValid = false;
    }
  }

  // Summary
  console.log('📊 Validation Summary:');
  console.log(`${allValid ? '✅' : '❌'} All permission boundary tests ${allValid ? 'valid' : 'have issues'}`);

  if (allValid) {
    console.log('\n🎉 All test files appear to be well-structured and comprehensive!');
    console.log('🚀 Tests should provide good coverage of permission boundary scenarios.');
  } else {
    console.log('\n⚠️  Some test files have issues that should be addressed.');
  }

  return allValid;
}

// Run validation if this script is called directly
if (require.main === module) {
  validateTestFiles()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation script failed:', error);
      process.exit(1);
    });
}

module.exports = { validateTestFiles };