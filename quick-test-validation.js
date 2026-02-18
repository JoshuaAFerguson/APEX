/**
 * Quick validation of element interaction infrastructure
 */

console.log('🔍 Validating Element Interaction Test Infrastructure');
console.log('===================================================');

const fs = require('fs');
const path = require('path');

// Check key files exist
const keyFiles = [
  'tests/browser-integration/element-interaction-infrastructure-complete.test.ts',
  'tests/browser-integration/utils/element-interaction-helpers.ts',
  'tests/browser-integration/fixtures/dom-element-test-fixtures.ts',
  'tests/browser-integration/utils/test-helpers.ts',
  'tests/test-utils/browser-test-base.ts'
];

let allExist = true;

console.log('\n📁 File Validation:');
for (const file of keyFiles) {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allExist = false;
}

// Check file sizes (non-empty)
console.log('\n📊 File Size Check:');
for (const file of keyFiles) {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`📄 ${path.basename(file)}: ${sizeKB}KB`);
  }
}

if (allExist) {
  console.log('\n✅ All key infrastructure files present!');

  // Check test content
  const testFile = fs.readFileSync('tests/browser-integration/element-interaction-infrastructure-complete.test.ts', 'utf8');
  const testCount = (testFile.match(/it\(/g) || []).length;
  const describeCount = (testFile.match(/describe\(/g) || []).length;

  console.log(`\n🧪 Test Structure:`);
  console.log(`   Describe blocks: ${describeCount}`);
  console.log(`   Test cases: ${testCount}`);

  // Check helper functions
  const helpersFile = fs.readFileSync('tests/browser-integration/utils/element-interaction-helpers.ts', 'utf8');
  const functionCount = (helpersFile.match(/export async function|export function/g) || []).length;

  console.log(`\n🛠️  Helper Functions: ${functionCount}`);

  console.log('\n🎯 Infrastructure Status: READY ✅');
} else {
  console.log('\n❌ Missing infrastructure files!');
}

console.log('\nDone.');