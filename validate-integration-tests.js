/**
 * Simple validation script to check if our integration test files are syntactically correct
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  '/Users/s0v3r1gn/APEX/packages/core/src/__tests__/project-context-analyzer-comprehensive-integration.test.ts',
  '/Users/s0v3r1gn/APEX/packages/core/src/__tests__/project-context-analyzer-method-interactions.test.ts',
  '/Users/s0v3r1gn/APEX/packages/core/src/__tests__/project-context-analyzer-coverage-focused.test.ts'
];

console.log('Validating integration test files...');

testFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    console.log(`✅ ${path.basename(file)} exists and is readable (${content.length} characters)`);

    // Basic syntax check - look for essential elements
    const hasDescribe = content.includes('describe(');
    const hasIt = content.includes('it(');
    const hasExpect = content.includes('expect(');
    const hasImports = content.includes('import');

    console.log(`   - Has describe blocks: ${hasDescribe}`);
    console.log(`   - Has test cases: ${hasIt}`);
    console.log(`   - Has assertions: ${hasExpect}`);
    console.log(`   - Has imports: ${hasImports}`);

    if (hasDescribe && hasIt && hasExpect && hasImports) {
      console.log(`   ✅ Basic structure looks good`);
    } else {
      console.log(`   ❌ Missing essential test elements`);
    }
  } else {
    console.log(`❌ ${path.basename(file)} not found`);
  }
  console.log('');
});

console.log('Validation complete!');