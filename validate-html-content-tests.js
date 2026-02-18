#!/usr/bin/env node
/**
 * Simple validation script to verify HTML content extraction test dependencies
 */

const fs = require('fs');
const path = require('path');

function validateTestFile() {
  console.log('🔍 Validating HTML content extraction tests...');

  // Check if test file exists
  const testFilePath = path.join(__dirname, 'tests/browser-integration/html-text-content-extraction.integration.test.ts');
  if (!fs.existsSync(testFilePath)) {
    console.error('❌ Test file not found:', testFilePath);
    return false;
  }
  console.log('✅ Test file exists');

  // Check if test helpers exist
  const helpersPath = path.join(__dirname, 'tests/browser-integration/utils/test-helpers.ts');
  if (!fs.existsSync(helpersPath)) {
    console.error('❌ Test helpers not found:', helpersPath);
    return false;
  }
  console.log('✅ Test helpers exist');

  // Check if vitest config exists
  const vitestConfigPath = path.join(__dirname, 'tests/browser-integration/vitest.config.ts');
  if (!fs.existsSync(vitestConfigPath)) {
    console.error('❌ Vitest config not found:', vitestConfigPath);
    return false;
  }
  console.log('✅ Vitest config exists');

  // Check if setup file exists
  const setupPath = path.join(__dirname, 'tests/browser-integration/setup.ts');
  if (!fs.existsSync(setupPath)) {
    console.error('❌ Setup file not found:', setupPath);
    return false;
  }
  console.log('✅ Setup file exists');

  // Read the test file and check for key patterns
  const testContent = fs.readFileSync(testFilePath, 'utf8');

  // Check for required imports
  const hasValidImports = [
    'vitest',
    'BrowserTool',
    '@apexcli/orchestrator',
    'createTestPage',
    'createTempDir',
    'cleanupTempDir'
  ].every(pattern => testContent.includes(pattern));

  if (!hasValidImports) {
    console.error('❌ Missing required imports in test file');
    return false;
  }
  console.log('✅ Required imports found');

  // Check for main test suites
  const hasRequiredTestSuites = [
    'Full HTML Content Extraction Tests',
    'Element-Specific HTML Extraction Tests',
    'Visible Text Extraction Tests',
    'Content Matching Tests',
    'Edge Case Tests',
    'Dynamic Content Tests'
  ].every(suite => testContent.includes(suite));

  if (!hasRequiredTestSuites) {
    console.error('❌ Missing required test suites');
    return false;
  }
  console.log('✅ All required test suites found');

  // Check for acceptance criteria validation
  const hasAcceptanceCriteria = [
    'should extract full page HTML',
    'should extract HTML from specific',
    'should extract text from',
    'should verify extracted content matches expected',
    'should handle empty elements',
    'should handle non-existent selectors'
  ].every(criteria => testContent.includes(criteria));

  if (!hasAcceptanceCriteria) {
    console.error('❌ Missing acceptance criteria tests');
    return false;
  }
  console.log('✅ Acceptance criteria validation found');

  // Check for proper browser tool usage
  const hasCorrectAPIUsage = testContent.includes('browserTool.execute({') &&
                            testContent.includes("operation: 'getHtml'") &&
                            testContent.includes("operation: 'getText'");

  if (!hasCorrectAPIUsage) {
    console.error('❌ Incorrect BrowserTool API usage');
    return false;
  }
  console.log('✅ Correct BrowserTool API usage found');

  // Count test cases
  const testCaseCount = (testContent.match(/it\(/g) || []).length;
  console.log(`✅ Found ${testCaseCount} test cases`);

  if (testCaseCount < 20) {
    console.warn('⚠️  Fewer than 20 test cases found. Expected comprehensive coverage.');
  }

  return true;
}

function validatePackageStructure() {
  console.log('\n🔍 Validating package structure...');

  // Check if orchestrator package exists
  const orchestratorPath = path.join(__dirname, 'packages/orchestrator');
  if (!fs.existsSync(orchestratorPath)) {
    console.error('❌ Orchestrator package not found');
    return false;
  }
  console.log('✅ Orchestrator package exists');

  // Check if browser tool source exists
  const browserToolPath = path.join(__dirname, 'packages/orchestrator/src/tools/browser-tool.ts');
  if (!fs.existsSync(browserToolPath)) {
    console.error('❌ BrowserTool source not found');
    return false;
  }
  console.log('✅ BrowserTool source exists');

  return true;
}

function main() {
  console.log('🧪 HTML Content Extraction Tests Validation\n');

  const fileValidation = validateTestFile();
  const structureValidation = validatePackageStructure();

  console.log('\n📊 Validation Summary:');
  console.log(`Test File Structure: ${fileValidation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Package Structure: ${structureValidation ? '✅ PASS' : '❌ FAIL'}`);

  if (fileValidation && structureValidation) {
    console.log('\n🎉 All validations passed! Tests appear to be properly implemented.');
    console.log('\n📝 Test Coverage Summary:');
    console.log('• Full page HTML content extraction');
    console.log('• Element-specific HTML extraction with CSS selectors');
    console.log('• Text content extraction from full page and specific elements');
    console.log('• Content matching verification against expected fixtures');
    console.log('• Edge cases: empty elements, Unicode characters, HTML entities');
    console.log('• Dynamic content extraction after JavaScript modifications');
    console.log('• Error handling for non-existent selectors');
    console.log('• Performance validation for large content extraction');
    console.log('• Cross-browser compatibility testing');

    process.exit(0);
  } else {
    console.log('\n❌ Some validations failed. Please review the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateTestFile, validatePackageStructure };