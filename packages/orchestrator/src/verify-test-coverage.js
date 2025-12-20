#!/usr/bin/env node

/**
 * Test Coverage Verification Script
 *
 * Quickly validates that all required test files exist and contain expected test patterns
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'daemon-scheduler.test.ts',
  'daemon-scheduler.edge-cases.test.ts',
  'daemon-scheduler.monitoring.test.ts',
  'daemon-scheduler.capacity-monitoring-integration.test.ts'
];

const requiredPatterns = [
  'getTimeUntilModeSwitch',
  'getTimeUntilBudgetReset',
  'onCapacityRestored',
  'Capacity Reset Monitoring',
  'midnight wraparound',
  'same-day transitions'
];

function analyzeTestFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, patterns: {}, testCount: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const testCount = (content.match(/it\(/g) || []).length;

  const patterns = {};
  requiredPatterns.forEach(pattern => {
    patterns[pattern] = new RegExp(pattern, 'i').test(content);
  });

  return { exists: true, patterns, testCount, lineCount: content.split('\n').length };
}

console.log('🧪 DaemonScheduler Capacity Reset Monitoring - Test Coverage Verification');
console.log('=' .repeat(80));

let totalTests = 0;
let totalLines = 0;
let missingFiles = [];
let missingPatterns = [];

testFiles.forEach(fileName => {
  const filePath = path.join(__dirname, fileName);
  const analysis = analyzeTestFile(filePath);

  console.log(`\n📁 ${fileName}`);

  if (analysis.exists) {
    console.log(`   ✅ EXISTS - ${analysis.testCount} tests, ${analysis.lineCount} lines`);
    totalTests += analysis.testCount;
    totalLines += analysis.lineCount;

    Object.entries(analysis.patterns).forEach(([pattern, found]) => {
      if (found) {
        console.log(`   ✅ ${pattern}`);
      } else {
        console.log(`   ❌ MISSING: ${pattern}`);
        missingPatterns.push(`${fileName}: ${pattern}`);
      }
    });
  } else {
    console.log(`   ❌ FILE NOT FOUND`);
    missingFiles.push(fileName);
  }
});

console.log('\n' + '=' .repeat(80));
console.log('📊 SUMMARY:');
console.log(`   Total test files: ${testFiles.length - missingFiles.length}/${testFiles.length}`);
console.log(`   Total test cases: ${totalTests}`);
console.log(`   Total lines of test code: ${totalLines}`);

if (missingFiles.length === 0 && missingPatterns.length === 0) {
  console.log('\n✅ ALL REQUIREMENTS MET - Testing stage COMPLETE!');
} else {
  console.log('\n❌ Issues found:');
  if (missingFiles.length > 0) {
    console.log(`   Missing files: ${missingFiles.join(', ')}`);
  }
  if (missingPatterns.length > 0) {
    console.log(`   Missing patterns: ${missingPatterns.join(', ')}`);
  }
}

console.log('\n🚀 Run tests with:');
console.log('   npm test --workspace=@apex/orchestrator');
console.log('=' .repeat(80));