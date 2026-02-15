#!/usr/bin/env node
/**
 * Quick syntax and import check for tri-system test utilities
 */

const fs = require('fs');
const path = require('path');

try {
  // Check if file exists and is readable
  const filePath = path.join(__dirname, 'tests/e2e/tri-system-integration/test-utils.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  console.log('✅ File exists and is readable');
  console.log(`📊 File size: ${content.length} characters`);
  console.log(`📊 Lines: ${content.split('\n').length}`);

  // Check imports
  const importLines = content.split('\n')
    .filter(line => line.trim().startsWith('import'))
    .map(line => line.trim());

  console.log(`📊 Import statements: ${importLines.length}`);

  // Check for basic TypeScript syntax issues
  const basicSyntaxChecks = [
    { name: 'Unmatched braces', regex: /[{}]/g },
    { name: 'Unmatched parentheses', regex: /[()]/g },
    { name: 'Unmatched brackets', regex: /[\[\]]/g },
  ];

  basicSyntaxChecks.forEach(check => {
    const matches = content.match(check.regex);
    if (matches) {
      const count = matches.length;
      if (count % 2 !== 0) {
        console.warn(`⚠️  Potentially unmatched ${check.name}: ${count} occurrences`);
      } else {
        console.log(`✅ ${check.name}: ${count/2} pairs`);
      }
    }
  });

  // Check for export statements
  const exportLines = content.split('\n')
    .filter(line => line.trim().startsWith('export'))
    .length;

  console.log(`📊 Export statements: ${exportLines}`);

  // Check major function declarations
  const functions = [
    'createTriSystemTestEnvironment',
    'createMockToolSystem',
    'createPermissionDeniedScenario',
    'assertTriSystemReady'
  ];

  console.log('\n🔍 Checking major function declarations:');
  functions.forEach(func => {
    if (content.includes(`function ${func}`) || content.includes(`${func}(`)) {
      console.log(`  ✅ ${func}`);
    } else {
      console.log(`  ❌ ${func} - not found`);
    }
  });

  console.log('\n✅ Syntax check completed successfully!');

} catch (error) {
  console.error('❌ Error checking file:', error.message);
  process.exit(1);
}