#!/usr/bin/env node

/**
 * @fileoverview Standalone validation script for form integration infrastructure
 *
 * This script verifies that all required dependencies and configurations
 * are properly set up for form integration testing.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Form Integration Test Infrastructure...\n');

// Check required files exist
const requiredFiles = [
  'vitest.config.ts',
  'setup.ts',
  'form-controls-sample.test.ts',
  'infrastructure-verification.test.ts',
  'comprehensive-form-controls.test.ts',
  'README.md'
];

let allFilesExist = true;

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check package.json scripts
console.log('\n📦 Checking package.json scripts:');
const packagePath = path.join(__dirname, '../../package.json');
const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const requiredScripts = [
  'test:form-integration',
  'test:form-integration:watch',
  'test:form-integration:coverage',
  'validate:form-infrastructure'
];

let allScriptsExist = true;
requiredScripts.forEach(script => {
  const exists = packageContent.scripts && packageContent.scripts[script];
  console.log(`  ${exists ? '✅' : '❌'} ${script}`);
  if (!exists) allScriptsExist = false;
});

// Check dependencies
console.log('\n📚 Checking dependencies:');
const requiredDeps = [
  'vitest',
  '@vitest/coverage-v8'
];

const allDeps = {
  ...packageContent.dependencies || {},
  ...packageContent.devDependencies || {}
};

let allDepsExist = true;
requiredDeps.forEach(dep => {
  const exists = allDeps[dep];
  console.log(`  ${exists ? '✅' : '❌'} ${dep}${exists ? ` (${allDeps[dep]})` : ''}`);
  if (!exists) allDepsExist = false;
});

// Check vitest config syntax
console.log('\n⚙️  Checking configuration:');
try {
  const vitestConfigPath = path.join(__dirname, 'vitest.config.ts');
  const vitestConfig = fs.readFileSync(vitestConfigPath, 'utf8');

  // Basic syntax checks
  const hasImports = vitestConfig.includes('import') && vitestConfig.includes('vitest');
  const hasConfig = vitestConfig.includes('defineConfig') && vitestConfig.includes('mergeConfig');
  const hasSetup = vitestConfig.includes('setupFiles') && vitestConfig.includes('./setup.ts');
  const hasJSDOM = vitestConfig.includes('jsdom');

  console.log(`  ${hasImports ? '✅' : '❌'} Vitest imports`);
  console.log(`  ${hasConfig ? '✅' : '❌'} Configuration structure`);
  console.log(`  ${hasSetup ? '✅' : '❌'} Setup file reference`);
  console.log(`  ${hasJSDOM ? '✅' : '❌'} JSDOM environment`);

} catch (error) {
  console.log(`  ❌ Error reading vitest config: ${error.message}`);
  allFilesExist = false;
}

// Summary
console.log('\n📋 Validation Summary:');
const overallStatus = allFilesExist && allScriptsExist && allDepsExist;
console.log(`  ${overallStatus ? '✅' : '❌'} Overall Status: ${overallStatus ? 'READY' : 'NEEDS ATTENTION'}`);

if (overallStatus) {
  console.log('\n🎉 Form integration test infrastructure is properly configured!');
  console.log('\n📚 Available commands:');
  console.log('  npm run test:form-integration              # Run all form tests');
  console.log('  npm run test:form-integration:watch        # Watch mode');
  console.log('  npm run test:form-integration:coverage     # With coverage');
  console.log('  npm run validate:form-infrastructure        # Quick validation');
  console.log('\n📖 See tests/form-integration/README.md for detailed usage');
} else {
  console.log('\n⚠️  Some components need attention. Please check the items marked with ❌ above.');
  process.exit(1);
}