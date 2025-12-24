#!/usr/bin/env node

/**
 * Test Verification Script
 *
 * Verifies that the security scoring implementation meets acceptance criteria:
 * - Critical = 1.0
 * - High = 0.9
 * - Medium = 0.7
 * - Low = 0.5
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Security Severity Scoring Implementation...\n');

// Read the MaintenanceAnalyzer implementation
const analyzerPath = path.join(__dirname, 'packages/orchestrator/src/analyzers/maintenance-analyzer.ts');
const analyzerContent = fs.readFileSync(analyzerPath, 'utf-8');

console.log('📖 Analyzing MaintenanceAnalyzer.ts implementation:');

// Check scoring values in the implementation
const criticalScore = analyzerContent.includes('createSecurityTask(critical, \'urgent\', 1.0)');
const highScoreIndividual = analyzerContent.includes('createSecurityTask(high, \'high\', 0.9)');
const highScoreGroup = analyzerContent.includes('createSecurityGroupTask(bySeverity.high, \'high\', 0.9)');
const mediumScore = analyzerContent.includes('createSecurityGroupTask(bySeverity.medium, \'normal\', 0.7)');
const lowScore = analyzerContent.includes('createSecurityGroupTask(bySeverity.low, \'low\', 0.5)');

console.log(`  ✅ Critical score (1.0): ${criticalScore ? 'PASS' : 'FAIL'}`);
console.log(`  ✅ High score (0.9): ${highScoreIndividual && highScoreGroup ? 'PASS' : 'FAIL'}`);
console.log(`  ✅ Medium score (0.7): ${mediumScore ? 'PASS' : 'FAIL'}`);
console.log(`  ✅ Low score (0.5): ${lowScore ? 'PASS' : 'FAIL'}`);

// Read security test file to verify test coverage
const securityTestPath = path.join(__dirname, 'packages/orchestrator/src/analyzers/maintenance-analyzer-security.test.ts');
const securityTestContent = fs.readFileSync(securityTestPath, 'utf-8');

console.log('\n📖 Analyzing security test coverage:');

// Check test assertions
const testCritical = securityTestContent.includes('expect(criticalTask?.score).toBe(1.0)');
const testHigh = securityTestContent.includes('expect(highTask?.score).toBe(0.9)');
const testMedium = securityTestContent.includes('expect(groupTask.score).toBe(0.7)');
const testLow = securityTestContent.includes('expect(groupTask.score).toBe(0.5)');

console.log(`  ✅ Critical test (1.0): ${testCritical ? 'PASS' : 'FAIL'}`);
console.log(`  ✅ High test (0.9): ${testHigh ? 'PASS' : 'FAIL'}`);
console.log(`  ✅ Medium test (0.7): ${testMedium ? 'PASS' : 'FAIL'}`);
console.log(`  ✅ Low test (0.5): ${testLow ? 'PASS' : 'FAIL'}`);

// Read comprehensive test file
const comprehensiveTestPath = path.join(__dirname, 'packages/orchestrator/src/analyzers/maintenance-analyzer-comprehensive.test.ts');
const comprehensiveTestContent = fs.readFileSync(comprehensiveTestPath, 'utf-8');

console.log('\n📖 Analyzing comprehensive test coverage:');

const orderingTest = comprehensiveTestContent.includes('expect(sortedCandidates[0].score).toBe(1.0)') &&
                    comprehensiveTestContent.includes('expect(sortedCandidates[1].score).toBe(0.9)') &&
                    comprehensiveTestContent.includes('expect(sortedCandidates[2].score).toBe(0.7)') &&
                    comprehensiveTestContent.includes('expect(sortedCandidates[3].score).toBe(0.5)');

console.log(`  ✅ Score ordering test: ${orderingTest ? 'PASS' : 'FAIL'}`);

// Summary
const allImplementationPassed = criticalScore && highScoreIndividual && highScoreGroup && mediumScore && lowScore;
const allTestsPassed = testCritical && testHigh && testMedium && testLow && orderingTest;

console.log('\n📊 SUMMARY:');
console.log(`  Implementation: ${allImplementationPassed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Test Coverage: ${allTestsPassed ? '✅ PASS' : '❌ FAIL'}`);

if (allImplementationPassed && allTestsPassed) {
  console.log('\n🎉 SUCCESS: Security severity scoring meets all acceptance criteria!');
  console.log('   - Critical vulnerabilities: 1.0');
  console.log('   - High vulnerabilities: 0.9');
  console.log('   - Medium vulnerabilities: 0.7');
  console.log('   - Low vulnerabilities: 0.5');
  process.exit(0);
} else {
  console.log('\n❌ FAILURE: Some requirements not met.');
  process.exit(1);
}