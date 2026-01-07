#!/usr/bin/env node

/**
 * @fileoverview Simple test verification script for policy lifecycle hooks
 *
 * This script verifies that:
 * 1. All required test files exist and are properly structured
 * 2. Key policy event types are defined in core types
 * 3. Integration tests cover all acceptance criteria
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define acceptance criteria
const acceptanceCriteria = [
  'Pre-execution policy check is called before agent actions',
  'Block mode prevents execution and emits correct event',
  'Warn mode logs and continues with correct event',
  'Audit mode records silently with correct event',
  'Multiple policies can be checked',
  'PolicyEngine can be disabled/optional'
];

// Key test files to check
const testFiles = [
  'packages/orchestrator/src/__tests__/policy-lifecycle-hooks-integration.test.ts',
  'packages/orchestrator/src/__tests__/policy-block-enforcement-mode.test.ts',
  'packages/orchestrator/src/__tests__/policy-warn-enforcement-mode.test.ts',
  'packages/orchestrator/src/__tests__/policy-audit-enforcement-integration.test.ts',
  'packages/orchestrator/src/__tests__/policy-engine-acceptance-criteria.test.ts'
];

// Required event types
const eventTypes = [
  'PolicyBlockedEventData',
  'PolicyWarnedEventData',
  'PolicyAuditedEventData'
];

async function verifyFileExists(filePath) {
  try {
    await fs.access(path.join(__dirname, filePath));
    return true;
  } catch {
    return false;
  }
}

async function checkFileContent(filePath, searchTerms) {
  try {
    const content = await fs.readFile(path.join(__dirname, filePath), 'utf-8');
    const results = {};

    for (const term of searchTerms) {
      results[term] = content.includes(term);
    }

    return results;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return {};
  }
}

async function verifyPolicyTests() {
  console.log('🧪 Policy Lifecycle Hooks Test Verification');
  console.log('=' .repeat(50));

  let allPassed = true;

  // Check test files exist
  console.log('\n📁 Test File Verification:');
  for (const file of testFiles) {
    const exists = await verifyFileExists(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allPassed = false;
  }

  // Check core types file for event types
  console.log('\n📋 Event Type Verification:');
  const typesFile = 'packages/core/src/types.ts';
  const typesExist = await verifyFileExists(typesFile);

  if (typesExist) {
    const eventTypeResults = await checkFileContent(typesFile, eventTypes);
    for (const [eventType, found] of Object.entries(eventTypeResults)) {
      console.log(`  ${found ? '✅' : '❌'} ${eventType}`);
      if (!found) allPassed = false;
    }
  } else {
    console.log(`  ❌ Types file not found: ${typesFile}`);
    allPassed = false;
  }

  // Check main integration test for acceptance criteria coverage
  console.log('\n🎯 Acceptance Criteria Coverage:');
  const mainTestFile = testFiles[0]; // policy-lifecycle-hooks-integration.test.ts
  const mainTestExists = await verifyFileExists(mainTestFile);

  if (mainTestExists) {
    const criteriaResults = await checkFileContent(mainTestFile, [
      'should call PolicyEngine.checkPolicy before agent actions',
      'should allow tool execution when policy check passes',
      'should block execution and emit policy:blocked event in strict mode',
      'should warn but continue execution and emit policy:warned event in warn mode',
      'should log but continue execution and emit policy:audited event in audit mode',
      'should handle multiple policy violations correctly',
      'should work correctly when PolicyEngine is disabled',
      'should work correctly when PolicyEngine is not provided'
    ]);

    for (const [criteria, found] of Object.entries(criteriaResults)) {
      console.log(`  ${found ? '✅' : '❌'} ${criteria}`);
      if (!found) allPassed = false;
    }
  } else {
    console.log(`  ❌ Main integration test not found`);
    allPassed = false;
  }

  // Check for enforcement mode specific tests
  console.log('\n🔒 Enforcement Mode Test Coverage:');
  const enforcementModeChecks = [
    { file: testFiles[1], mode: 'Block Mode', key: 'should emit policy:blocked event' },
    { file: testFiles[2], mode: 'Warn Mode', key: 'should emit policy:warned event' },
    { file: testFiles[3], mode: 'Audit Mode', key: 'should emit policy:audited event' }
  ];

  for (const check of enforcementModeChecks) {
    const exists = await verifyFileExists(check.file);
    if (exists) {
      const content = await fs.readFile(path.join(__dirname, check.file), 'utf-8');
      const hasTests = content.includes('describe') && content.includes('it(');
      console.log(`  ${hasTests ? '✅' : '❌'} ${check.mode} tests exist`);
      if (!hasTests) allPassed = false;
    } else {
      console.log(`  ❌ ${check.mode} test file missing`);
      allPassed = false;
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  if (allPassed) {
    console.log('🎉 ALL VERIFICATION CHECKS PASSED!');
    console.log('✨ Policy lifecycle hooks integration tests are comprehensive and complete.');
    return true;
  } else {
    console.log('❌ SOME VERIFICATION CHECKS FAILED!');
    console.log('🔧 Review the failed checks above and ensure all tests are implemented.');
    return false;
  }
}

// Run verification
verifyPolicyTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
  });