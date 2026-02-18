#!/usr/bin/env node
/**
 * Validation script for withMalformedResponse test coverage
 *
 * Verifies that we have comprehensive test coverage for the withMalformedResponse
 * builder method including all malformed response types and edge cases.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Validating withMalformedResponse test coverage...\n');

const testFile = path.join(__dirname, 'packages/orchestrator/src/mcp/mock-server/__tests__/mock-mcp-server-builder.test.ts');

if (!fs.existsSync(testFile)) {
  console.error('❌ Test file not found:', testFile);
  process.exit(1);
}

const content = fs.readFileSync(testFile, 'utf8');

// Check for required test sections
const requiredSections = [
  'Malformed Response Configuration',
  'Malformed Response Edge Cases and Validation'
];

const requiredTestCases = [
  'should configure truncated JSON malformed responses',
  'should configure invalid JSON malformed responses',
  'should configure wrong schema malformed responses',
  'should configure empty response malformed responses',
  'should configure with minimal required options',
  'should configure all malformed response types',
  'should work with buildServer() method',
  'should work in combination with other configurations',
  'should support fluent chaining after malformed response configuration',
  'should handle malformed response configuration with default values',
  'should handle percentage-based truncation patterns',
  'should handle various byte position truncation values',
  'should handle various probability values',
  'should handle various affected methods configurations',
  'should handle complex wrong schema payloads',
  'should handle various invalid JSON content',
  'should handle malformed response overwriting',
  'should handle malformed response in combination with scenarios',
  'should apply malformed response configuration to built facade',
  'should apply malformed response configuration to built server',
  'should handle complex configuration with malformed responses'
];

// Check for malformed response types
const malformedTypes = [
  'truncated_json',
  'invalid_json',
  'wrong_schema',
  'empty_response'
];

console.log('✅ Checking test sections...');
let passedSections = 0;
requiredSections.forEach(section => {
  if (content.includes(section)) {
    console.log(`  ✓ ${section}`);
    passedSections++;
  } else {
    console.log(`  ✗ ${section} - MISSING`);
  }
});

console.log('\n✅ Checking individual test cases...');
let passedTestCases = 0;
requiredTestCases.forEach(testCase => {
  if (content.includes(testCase)) {
    console.log(`  ✓ ${testCase}`);
    passedTestCases++;
  } else {
    console.log(`  ✗ ${testCase} - MISSING`);
  }
});

console.log('\n✅ Checking malformed response type coverage...');
let coveredTypes = 0;
malformedTypes.forEach(type => {
  if (content.includes(`type: '${type}'`)) {
    console.log(`  ✓ ${type}`);
    coveredTypes++;
  } else {
    console.log(`  ✗ ${type} - MISSING`);
  }
});

// Check for withMalformedResponse usage
const withMalformedResponseCount = (content.match(/\.withMalformedResponse\(/g) || []).length;
console.log(`\n✅ withMalformedResponse method calls: ${withMalformedResponseCount}`);

// Check for proper imports
const hasBuilderImport = content.includes('MockMCPServerBuilder');
const hasFacadeImport = content.includes('MockMCPServerFacade');
const hasServerImport = content.includes('MockMCPServer');

console.log('\n✅ Checking imports...');
console.log(`  MockMCPServerBuilder: ${hasBuilderImport ? '✓' : '✗'}`);
console.log(`  MockMCPServerFacade: ${hasFacadeImport ? '✓' : '✗'}`);
console.log(`  MockMCPServer: ${hasServerImport ? '✓' : '✗'}`);

// Summary
console.log('\n📊 SUMMARY');
console.log(`Test sections: ${passedSections}/${requiredSections.length}`);
console.log(`Test cases: ${passedTestCases}/${requiredTestCases.length}`);
console.log(`Malformed types covered: ${coveredTypes}/${malformedTypes.length}`);
console.log(`withMalformedResponse calls: ${withMalformedResponseCount}`);

const allPassed = passedSections === requiredSections.length &&
                  passedTestCases === requiredTestCases.length &&
                  coveredTypes === malformedTypes.length &&
                  withMalformedResponseCount >= 20 &&
                  hasBuilderImport && hasFacadeImport && hasServerImport;

if (allPassed) {
  console.log('\n🎉 All validation checks passed! Test coverage looks comprehensive.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some validation checks failed. Please review the missing items above.');
  process.exit(1);
}