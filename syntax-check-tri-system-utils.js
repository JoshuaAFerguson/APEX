/**
 * Syntax check and import validation for tri-system-integration test utilities
 * This script validates the browser-permission basic E2E test file and its dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating tri-system integration test file syntax...\n');

// Files to check
const testFiles = [
  'tests/e2e/tri-system-integration/browser-permission-basic.e2e.test.ts',
  'tests/e2e/tri-system-integration/test-utils.ts'
];

// Check if files exist
console.log('📁 Checking file existence...');
testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

// Check dependency paths
console.log('\n📦 Validating dependency paths...');
const dependencyPaths = [
  'packages/core/src/types.ts',
  'packages/orchestrator/src/index.ts',
  'packages/orchestrator/src/store.ts',
  'packages/core/src/test-fixtures/mock-factories.ts'
];

dependencyPaths.forEach(depPath => {
  const fullPath = path.join(__dirname, depPath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${depPath} exists`);
  } else {
    console.log(`❌ ${depPath} missing`);
  }
});

// Try to run TypeScript type checking
console.log('\n🔧 Running TypeScript type checking...');
try {
  // Use the project's TypeScript config for type checking
  const tscCommand = 'npx tsc --noEmit --project tsconfig.json tests/e2e/tri-system-integration/browser-permission-basic.e2e.test.ts';
  const result = execSync(tscCommand, {
    encoding: 'utf8',
    cwd: __dirname
  });
  console.log('✅ TypeScript type checking passed');
} catch (error) {
  console.log('❌ TypeScript type checking failed:');
  console.log(error.stdout || error.message);

  // Check if it's an import issue
  if (error.message.includes('Cannot find module')) {
    console.log('\n💡 Possible solutions:');
    console.log('1. Check if alias paths in vitest config match tsconfig.json');
    console.log('2. Verify the imported modules exist at the specified paths');
    console.log('3. Try using relative imports instead of alias imports');
  }
}

// Check vitest E2E config
console.log('\n⚙️ Checking vitest E2E configuration...');
const vitestConfigPath = path.join(__dirname, 'vitest.e2e.config.ts');
if (fs.existsSync(vitestConfigPath)) {
  console.log('✅ vitest.e2e.config.ts exists');

  // Read and check alias configuration
  const configContent = fs.readFileSync(vitestConfigPath, 'utf8');
  if (configContent.includes('@apex/core') && configContent.includes('@apex/orchestrator')) {
    console.log('✅ Alias paths configured in vitest config');
  } else {
    console.log('⚠️ Alias paths may be missing in vitest config');
  }
} else {
  console.log('❌ vitest.e2e.config.ts missing');
}

console.log('\n✨ Validation complete!');