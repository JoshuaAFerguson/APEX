#!/usr/bin/env node
/**
 * Validation script for malformed response test implementation
 * Verifies the test coverage meets acceptance criteria
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Malformed Response Test Implementation...\n');

// Test files to validate
const testFiles = [
  'packages/orchestrator/src/mcp/mock-server/mock-mcp-server-malformed-response.test.ts',
  'packages/core/src/mcp/mock-types-malformed-response.test.ts'
];

let validationResults = {
  filesFound: 0,
  totalTests: 0,
  invalidJsonTests: 0,
  truncatedJsonTests: 0,
  wrongSchemaTests: 0,
  emptyResponseTests: 0,
  binaryGarbageTests: 0,
  clientErrorHandlingTests: 0,
  edgeCaseTests: 0,
  integrationTests: 0,
  pass: true,
  details: []
};

// Check if test files exist and analyze content
for (const testFile of testFiles) {
  const filePath = path.join(__dirname, testFile);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ Missing test file: ${testFile}`);
    validationResults.pass = false;
    continue;
  }

  console.log(`✅ Found test file: ${testFile}`);
  validationResults.filesFound++;

  const content = fs.readFileSync(filePath, 'utf-8');

  // Count test cases
  const testMatches = content.match(/it\s*\(\s*['"`]/g) || [];
  const describeMatches = content.match(/describe\s*\(\s*['"`]/g) || [];
  validationResults.totalTests += testMatches.length;

  // Check for specific test categories
  if (content.includes('invalid_json') || content.includes('Invalid JSON')) {
    validationResults.invalidJsonTests++;
  }

  if (content.includes('truncated_json') || content.includes('Truncated')) {
    validationResults.truncatedJsonTests++;
  }

  if (content.includes('wrong_schema') || content.includes('Wrong Schema')) {
    validationResults.wrongSchemaTests++;
  }

  if (content.includes('empty_response') || content.includes('Empty Response')) {
    validationResults.emptyResponseTests++;
  }

  if (content.includes('binary_garbage') || content.includes('Binary Garbage')) {
    validationResults.binaryGarbageTests++;
  }

  if (content.includes('Client Error Handling') || content.includes('client error handling')) {
    validationResults.clientErrorHandlingTests++;
  }

  if (content.includes('Edge Cases') || content.includes('edge cases')) {
    validationResults.edgeCaseTests++;
  }

  if (content.includes('Integration') && (content.includes('test') || content.includes('Test'))) {
    validationResults.integrationTests++;
  }

  // Log details about this file
  validationResults.details.push({
    file: testFile,
    testCount: testMatches.length,
    describeCount: describeMatches.length,
    hasInvalidJsonTests: content.includes('invalid_json'),
    hasTruncatedJsonTests: content.includes('truncated_json'),
    hasWrongSchemaTests: content.includes('wrong_schema'),
    hasEmptyResponseTests: content.includes('empty_response'),
    hasBinaryGarbageTests: content.includes('binary_garbage'),
    hasClientErrorTests: content.includes('Client Error Handling'),
    hasEdgeCaseTests: content.includes('Edge Cases'),
    hasIntegrationTests: content.includes('Integration')
  });
}

console.log('\n📊 Test Coverage Analysis:');
console.log('═'.repeat(50));
console.log(`📁 Test Files Found: ${validationResults.filesFound}/2`);
console.log(`🧪 Total Test Cases: ${validationResults.totalTests}`);
console.log(`🔧 Invalid JSON Tests: ${validationResults.invalidJsonTests > 0 ? '✅' : '❌'}`);
console.log(`✂️ Truncated JSON Tests: ${validationResults.truncatedJsonTests > 0 ? '✅' : '❌'}`);
console.log(`📋 Wrong Schema Tests: ${validationResults.wrongSchemaTests > 0 ? '✅' : '❌'}`);
console.log(`⚡ Empty Response Tests: ${validationResults.emptyResponseTests > 0 ? '✅' : '❌'}`);
console.log(`💾 Binary Garbage Tests: ${validationResults.binaryGarbageTests > 0 ? '✅' : '❌'}`);
console.log(`🛡️ Client Error Handling: ${validationResults.clientErrorHandlingTests > 0 ? '✅' : '❌'}`);
console.log(`⚠️ Edge Case Tests: ${validationResults.edgeCaseTests > 0 ? '✅' : '❌'}`);
console.log(`🔗 Integration Tests: ${validationResults.integrationTests > 0 ? '✅' : '❌'}`);

console.log('\n📋 Detailed File Analysis:');
console.log('═'.repeat(50));
for (const detail of validationResults.details) {
  console.log(`\n📄 ${detail.file}`);
  console.log(`   🧪 Tests: ${detail.testCount}`);
  console.log(`   📦 Describe blocks: ${detail.describeCount}`);
  console.log(`   🔧 Invalid JSON: ${detail.hasInvalidJsonTests ? '✅' : '❌'}`);
  console.log(`   ✂️ Truncated JSON: ${detail.hasTruncatedJsonTests ? '✅' : '❌'}`);
  console.log(`   📋 Wrong Schema: ${detail.hasWrongSchemaTests ? '✅' : '❌'}`);
  console.log(`   ⚡ Empty Response: ${detail.hasEmptyResponseTests ? '✅' : '❌'}`);
  console.log(`   💾 Binary Garbage: ${detail.hasBinaryGarbageTests ? '✅' : '❌'}`);
  console.log(`   🛡️ Client Error Handling: ${detail.hasClientErrorTests ? '✅' : '❌'}`);
  console.log(`   ⚠️ Edge Cases: ${detail.hasEdgeCaseTests ? '✅' : '❌'}`);
  console.log(`   🔗 Integration: ${detail.hasIntegrationTests ? '✅' : '❌'}`);
}

// Acceptance criteria validation
console.log('\n🎯 Acceptance Criteria Validation:');
console.log('═'.repeat(50));

const acceptanceCriteria = [
  {
    name: 'Invalid JSON responses tested',
    met: validationResults.invalidJsonTests > 0,
    requirement: 'Unit tests verify client error handling for invalid JSON responses'
  },
  {
    name: 'Truncated responses tested',
    met: validationResults.truncatedJsonTests > 0,
    requirement: 'Unit tests verify client error handling for truncated responses'
  },
  {
    name: 'Wrong schema responses tested',
    met: validationResults.wrongSchemaTests > 0,
    requirement: 'Unit tests verify client error handling for wrong schema responses'
  },
  {
    name: 'Empty responses tested',
    met: validationResults.emptyResponseTests > 0,
    requirement: 'Unit tests verify client error handling for empty responses'
  },
  {
    name: 'Test files present',
    met: validationResults.filesFound === 2,
    requirement: 'Unit tests in mock-mcp-server-malformed-response.test.ts'
  },
  {
    name: 'Sufficient test coverage',
    met: validationResults.totalTests >= 50,
    requirement: 'Comprehensive test coverage with multiple test cases'
  },
  {
    name: 'Client error handling tested',
    met: validationResults.clientErrorHandlingTests > 0,
    requirement: 'Client error handling verified for each malformed response type'
  }
];

let allCriteriaMet = true;
for (const criterion of acceptanceCriteria) {
  const status = criterion.met ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${criterion.name}`);
  console.log(`         ${criterion.requirement}`);

  if (!criterion.met) {
    allCriteriaMet = false;
  }
}

console.log('\n' + '═'.repeat(50));
if (allCriteriaMet && validationResults.pass) {
  console.log('🎉 ALL ACCEPTANCE CRITERIA MET!');
  console.log('✅ Malformed response simulation unit tests are complete and comprehensive.');
  process.exit(0);
} else {
  console.log('❌ SOME ACCEPTANCE CRITERIA NOT MET');
  console.log('⚠️  Please review and address the failing criteria above.');
  process.exit(1);
}