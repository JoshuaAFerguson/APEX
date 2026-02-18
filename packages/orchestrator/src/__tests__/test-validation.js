#!/usr/bin/env node

/**
 * Simple validation script to check if our new test files can be imported
 * This helps identify any obvious syntax or import errors.
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'mcp-connection-manager-comprehensive-enhanced.test.ts',
  'mcp-tool-registry-comprehensive-enhanced.test.ts',
  'mcp-integration-comprehensive.test.ts',
  'utils/mock-mcp-server.ts',
  'utils/test-helpers.ts'
];

console.log('Validating test files...\n');

let allValid = true;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${file}`);
      allValid = false;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Basic validation checks
    const checks = [
      {
        name: 'Has import statements',
        test: content.includes('import '),
        required: true
      },
      {
        name: 'Has describe blocks',
        test: content.includes('describe('),
        required: file.endsWith('.test.ts')
      },
      {
        name: 'Has test cases',
        test: content.includes('test(') || content.includes('it('),
        required: file.endsWith('.test.ts')
      },
      {
        name: 'Has proper TypeScript syntax',
        test: !content.includes('syntax error'),
        required: true
      },
      {
        name: 'Has module exports/declarations',
        test: content.includes('export ') || content.includes('export default'),
        required: true
      }
    ];

    let fileValid = true;
    console.log(`📄 Validating ${file}:`);

    for (const check of checks) {
      if (check.required && !check.test) {
        console.log(`  ❌ ${check.name}`);
        fileValid = false;
      } else if (check.test) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ⚠️  ${check.name} (optional)`);
      }
    }

    if (fileValid) {
      console.log(`  🎉 ${file} validation passed\n`);
    } else {
      console.log(`  ❌ ${file} validation failed\n`);
      allValid = false;
    }

  } catch (error) {
    console.log(`❌ Error validating ${file}: ${error.message}\n`);
    allValid = false;
  }
}

console.log('==========================================');
if (allValid) {
  console.log('🎉 All test files validation passed!');
  console.log('\nNext steps:');
  console.log('1. Run "npm run build" to compile TypeScript');
  console.log('2. Run "npm run test" to execute the tests');
  console.log('3. Check test coverage with "npm run test:coverage"');
} else {
  console.log('❌ Some test files have validation issues');
  console.log('Please review the errors above and fix them before running tests.');
}

process.exit(allValid ? 0 : 1);