/**
 * @fileoverview Validates browser integration test infrastructure structure
 *
 * This validation script checks that all required files and dependencies
 * are in place for the browser automation integration tests.
 */

const fs = require('fs');
const path = require('path');

// Define expected structure
const expectedFiles = [
  'vitest.config.ts',
  'setup.ts',
  'example.test.ts',
  'fixtures/common-scenarios.ts',
  'utils/test-helpers.ts',
  'README.md'
];

const expectedDependencies = [
  'vitest',
  'playwright',
  '@types/node'
];

function checkFileExists(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const exists = fs.existsSync(fullPath);
    console.log(`✓ ${filePath}: ${exists ? 'EXISTS' : 'MISSING'}`);
    return exists;
  } catch (error) {
    console.log(`✗ ${filePath}: ERROR - ${error.message}`);
    return false;
  }
}

function checkDependency(depName) {
  try {
    // Check if dependency is available in orchestrator package
    const orchestratorPackagePath = path.join(__dirname, '../../packages/orchestrator/package.json');
    const orchestratorPkg = JSON.parse(fs.readFileSync(orchestratorPackagePath, 'utf8'));

    const hasInDeps = orchestratorPkg.dependencies && orchestratorPkg.dependencies[depName];
    const hasInDevDeps = orchestratorPkg.devDependencies && orchestratorPkg.devDependencies[depName];

    // Check root package for test dependencies
    const rootPackagePath = path.join(__dirname, '../../package.json');
    const rootPkg = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));

    const hasInRootDeps = rootPkg.dependencies && rootPkg.dependencies[depName];
    const hasInRootDevDeps = rootPkg.devDependencies && rootPkg.devDependencies[depName];

    const available = hasInDeps || hasInDevDeps || hasInRootDeps || hasInRootDevDeps;

    console.log(`✓ ${depName}: ${available ? 'AVAILABLE' : 'MISSING'}`);
    return available;
  } catch (error) {
    console.log(`✗ ${depName}: ERROR - ${error.message}`);
    return false;
  }
}

function checkPackageJsonScript() {
  try {
    const rootPackagePath = path.join(__dirname, '../../package.json');
    const rootPkg = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));

    const hasTestScript = rootPkg.scripts && rootPkg.scripts['test:browser-integration'];
    const hasWatchScript = rootPkg.scripts && rootPkg.scripts['test:browser-integration:watch'];
    const hasCoverageScript = rootPkg.scripts && rootPkg.scripts['test:browser-integration:coverage'];

    console.log(`✓ test:browser-integration script: ${hasTestScript ? 'EXISTS' : 'MISSING'}`);
    console.log(`✓ test:browser-integration:watch script: ${hasWatchScript ? 'EXISTS' : 'MISSING'}`);
    console.log(`✓ test:browser-integration:coverage script: ${hasCoverageScript ? 'EXISTS' : 'MISSING'}`);

    return hasTestScript && hasWatchScript && hasCoverageScript;
  } catch (error) {
    console.log(`✗ Package.json scripts: ERROR - ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔍 Validating Browser Integration Test Infrastructure\n');

  console.log('📁 Checking file structure:');
  const fileResults = expectedFiles.map(checkFileExists);

  console.log('\n📦 Checking dependencies:');
  const depResults = expectedDependencies.map(checkDependency);

  console.log('\n📜 Checking package.json scripts:');
  const scriptResult = checkPackageJsonScript();

  console.log('\n📊 Summary:');
  const allFilesExist = fileResults.every(Boolean);
  const allDepsAvailable = depResults.every(Boolean);

  console.log(`Files: ${allFilesExist ? '✅ All present' : '❌ Some missing'}`);
  console.log(`Dependencies: ${allDepsAvailable ? '✅ All available' : '❌ Some missing'}`);
  console.log(`Scripts: ${scriptResult ? '✅ All configured' : '❌ Some missing'}`);

  const overallResult = allFilesExist && allDepsAvailable && scriptResult;
  console.log(`\n🎯 Overall: ${overallResult ? '✅ READY' : '❌ NEEDS ATTENTION'}`);

  if (overallResult) {
    console.log('\n🚀 Browser integration test infrastructure is ready to use!');
    console.log('Run: npm run test:browser-integration');
  } else {
    console.log('\n⚠️  Please address missing items before running tests.');
  }

  return overallResult;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { main };