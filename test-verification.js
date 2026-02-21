#!/usr/bin/env node

/**
 * Manual verification script for ProjectContextAnalyzer integration tests
 */

const fs = require('fs');
const path = require('path');

// Check if integration test files exist and are properly structured
function verifyTestFiles() {
  const testFiles = [
    'packages/core/src/__tests__/project-context-analyzer-comprehensive-integration.test.ts',
    'packages/core/src/__tests__/project-context-analyzer-method-interactions.test.ts',
    'packages/core/src/__tests__/project-context-analyzer-coverage-focused.test.ts'
  ];

  console.log('🔍 Verifying integration test files...\n');

  let allExists = true;
  let totalTestCases = 0;

  testFiles.forEach(testFile => {
    const filePath = path.join(__dirname, testFile);

    if (fs.existsSync(filePath)) {
      console.log(`✅ ${testFile} - EXISTS`);

      // Count test cases
      const content = fs.readFileSync(filePath, 'utf8');
      const testCases = (content.match(/it\(/g) || []).length;
      const describeBlocks = (content.match(/describe\(/g) || []).length;
      totalTestCases += testCases;

      console.log(`   📊 Test cases: ${testCases}, Describe blocks: ${describeBlocks}`);

      // Check for key coverage areas
      const hasAnalyzeMethod = content.includes('analyzer.analyze()');
      const hasGetProjectStructure = content.includes('getProjectStructure');
      const hasDetectFrameworks = content.includes('detectFrameworks');
      const hasGetGitStatus = content.includes('getGitStatus');
      const hasConfigurationTests = content.includes('getConfigurationInfoList');
      const hasTestFrameworkTests = content.includes('detectTestFrameworks');

      console.log(`   🔧 Coverage areas:`);
      console.log(`      - analyze(): ${hasAnalyzeMethod ? '✅' : '❌'}`);
      console.log(`      - getProjectStructure(): ${hasGetProjectStructure ? '✅' : '❌'}`);
      console.log(`      - detectFrameworks(): ${hasDetectFrameworks ? '✅' : '❌'}`);
      console.log(`      - getGitStatus(): ${hasGetGitStatus ? '✅' : '❌'}`);
      console.log(`      - Configuration tests: ${hasConfigurationTests ? '✅' : '❌'}`);
      console.log(`      - Test framework tests: ${hasTestFrameworkTests ? '✅' : '❌'}`);

    } else {
      console.log(`❌ ${testFile} - MISSING`);
      allExists = false;
    }
    console.log('');
  });

  console.log(`📈 Total integration test cases: ${totalTestCases}`);
  console.log(`📋 Integration test files status: ${allExists ? 'ALL PRESENT' : 'SOME MISSING'}\n`);

  return { allExists, totalTestCases };
}

// Check if main implementation file exists
function verifyImplementation() {
  console.log('🔍 Verifying main implementation...\n');

  const implFile = 'packages/core/src/project-context-analyzer.ts';
  const filePath = path.join(__dirname, implFile);

  if (fs.existsSync(filePath)) {
    console.log(`✅ ${implFile} - EXISTS`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    console.log(`   📏 File size: ${lines} lines`);

    // Check for key public methods
    const publicMethods = [
      'analyze(',
      'getGitStatus(',
      'getProjectStructure(',
      'analyzeProjectStructure(',
      'detectFrameworks(',
      'getConfigurationInfoList(',
      'parseConfigurations(',
      'getTestFrameworkInfoList(',
      'detectTestFrameworks(',
      'getProjectPath(',
      'getOptions('
    ];

    console.log(`   🔧 Public method coverage:`);
    publicMethods.forEach(method => {
      const exists = content.includes(method);
      console.log(`      - ${method.replace('(', '()')}: ${exists ? '✅' : '❌'}`);
    });

    return true;
  } else {
    console.log(`❌ ${implFile} - MISSING`);
    return false;
  }
}

// Check package.json for test scripts
function verifyTestScripts() {
  console.log('\n🔍 Verifying test scripts in package.json...\n');

  const packageJsonPath = path.join(__dirname, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};

    const testScripts = Object.keys(scripts).filter(script => script.includes('test'));
    console.log(`✅ Found ${testScripts.length} test-related scripts:`);
    testScripts.forEach(script => {
      console.log(`   - ${script}: ${scripts[script]}`);
    });

    return testScripts.length > 0;
  } else {
    console.log('❌ package.json not found');
    return false;
  }
}

// Main verification
function main() {
  console.log('🧪 ProjectContextAnalyzer Integration Test Verification\n');
  console.log('=' .repeat(60));

  const { allExists: testsExist, totalTestCases } = verifyTestFiles();
  const implementationExists = verifyImplementation();
  const scriptsExist = verifyTestScripts();

  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=' .repeat(60));

  console.log(`Integration test files: ${testsExist ? '✅ All present' : '❌ Some missing'}`);
  console.log(`Main implementation: ${implementationExists ? '✅ Present' : '❌ Missing'}`);
  console.log(`Test scripts: ${scriptsExist ? '✅ Available' : '❌ Missing'}`);
  console.log(`Total test cases: ${totalTestCases}`);

  const allGood = testsExist && implementationExists && scriptsExist;

  console.log(`\n🎯 Overall status: ${allGood ? '✅ READY FOR TESTING' : '❌ ISSUES FOUND'}`);

  if (allGood) {
    console.log('\n💡 Recommendations:');
    console.log('   - Run integration tests with: npm run test:integration');
    console.log('   - Check coverage with: npm run test:coverage');
    console.log('   - Run specific tests with: npx vitest run --config vitest.integration.config.ts');
  }

  return allGood;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { verifyTestFiles, verifyImplementation, verifyTestScripts };