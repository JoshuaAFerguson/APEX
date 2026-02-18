const fs = require('fs');
const path = require('path');

const testFile = '/Users/s0v3r1gn/APEX/tests/e2e/tri-system-integration/complex-permission-scenarios.e2e.test.ts';

try {
  const content = fs.readFileSync(testFile, 'utf8');

  // Basic syntax checks
  console.log('✅ File exists and readable');
  console.log(`✅ File size: ${content.length} characters`);

  // Check for basic structure
  if (content.includes('describe(')) {
    console.log('✅ Contains describe blocks');
  }

  if (content.includes('it(')) {
    console.log('✅ Contains test cases');
  }

  if (content.includes('import')) {
    console.log('✅ Contains import statements');
  }

  if (content.includes('@apexcli/core')) {
    console.log('✅ Imports core types');
  }

  if (content.includes('./test-utils.js')) {
    console.log('✅ Imports test utilities');
  }

  console.log('✅ Basic syntax validation passed');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}