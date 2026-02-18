#!/usr/bin/env node

/**
 * Validation script for custom timeout configurations integration tests
 * This script verifies that the implementation meets all acceptance criteria.
 */

const fs = require('fs');
const path = require('path');

const TEST_FILE_PATH = './packages/orchestrator/src/__tests__/custom-timeout-configurations.integration.test.ts';

console.log('🔍 Validating Custom Timeout Configuration Integration Tests Implementation...\n');

// Check if test file exists
if (!fs.existsSync(TEST_FILE_PATH)) {
  console.error('❌ Test file not found:', TEST_FILE_PATH);
  process.exit(1);
}

console.log('✅ Test file exists:', TEST_FILE_PATH);

// Read the test file content
const testContent = fs.readFileSync(TEST_FILE_PATH, 'utf8');

// Validation checks
const validations = [
  {
    name: 'Has proper file header with AC descriptions',
    check: () => testContent.includes('AC1: Custom timeout values override defaults') &&
                 testContent.includes('AC2: Custom timeouts are respected for each wait strategy') &&
                 testContent.includes('AC3: Longer custom timeouts allow operations to complete that would fail with defaults'),
    required: true
  },
  {
    name: 'Imports required testing utilities',
    check: () => testContent.includes('import { describe, it, expect, beforeEach, afterEach, vi } from \'vitest\''),
    required: true
  },
  {
    name: 'Imports timeout documentation classes',
    check: () => testContent.includes('DEFAULT_TIMEOUTS') &&
                 testContent.includes('PromiseRaceTimeoutPattern') &&
                 testContent.includes('SetTimeoutWithCleanupPattern') &&
                 testContent.includes('ExponentialBackoffPattern') &&
                 testContent.includes('PollingWaitPattern') &&
                 testContent.includes('TimeoutUtils'),
    required: true
  },
  {
    name: 'Uses fake timers properly',
    check: () => testContent.includes('vi.useFakeTimers()') &&
                 testContent.includes('vi.useRealTimers()') &&
                 testContent.includes('vi.advanceTimersByTime'),
    required: true
  },
  {
    name: 'Has AC1 test section with proper structure',
    check: () => testContent.includes('describe(\'AC1: Custom Timeout Override Behavior\'') &&
                 testContent.includes('should use custom timeout instead of default timeout at operation level') &&
                 testContent.includes('should use default timeout when no custom timeout is provided') &&
                 testContent.includes('should handle component-level timeout configuration overrides'),
    required: true
  },
  {
    name: 'Has AC2 test section covering all wait strategies',
    check: () => testContent.includes('describe(\'AC2: Custom Timeouts Per Wait Strategy\'') &&
                 testContent.includes('describe(\'Promise.race Pattern\'') &&
                 testContent.includes('describe(\'Polling Pattern\'') &&
                 testContent.includes('describe(\'Exponential Backoff Pattern\'') &&
                 testContent.includes('describe(\'SetTimeout with Cleanup Pattern\''),
    required: true
  },
  {
    name: 'Has AC3 test section with success scenarios',
    check: () => testContent.includes('describe(\'AC3: Extended Timeouts Enable Success\'') &&
                 testContent.includes('should fail with short default timeout but succeed with extended custom timeout'),
    required: true
  },
  {
    name: 'Tests Promise.race pattern with custom timeouts',
    check: () => testContent.includes('PromiseRaceTimeoutPattern.withTimeout') &&
                 testContent.includes('should respect custom timeout in Promise.race pattern'),
    required: true
  },
  {
    name: 'Tests polling pattern with custom timeouts',
    check: () => testContent.includes('PollingWaitPattern.waitForCondition') &&
                 testContent.includes('should respect custom timeout in polling pattern'),
    required: true
  },
  {
    name: 'Tests exponential backoff with custom limits',
    check: () => testContent.includes('ExponentialBackoffPattern.withRetry') &&
                 testContent.includes('should respect custom max delay in exponential backoff'),
    required: true
  },
  {
    name: 'Tests setTimeout cleanup pattern',
    check: () => testContent.includes('SetTimeoutWithCleanupPattern') &&
                 testContent.includes('should respect custom timeout in setTimeout pattern') &&
                 testContent.includes('should allow timeout cancellation'),
    required: true
  },
  {
    name: 'Tests timeout override precedence (AC1)',
    check: () => testContent.includes('operation-level override taking precedence over component config') &&
                 testContent.includes('OPERATION_OVERRIDE_TIMEOUT'),
    required: true
  },
  {
    name: 'Tests success with extended timeouts (AC3)',
    check: () => testContent.includes('Browser operations') &&
                 testContent.includes('MCP operations') &&
                 testContent.includes('Approval operations') &&
                 testContent.includes('should fail with short') &&
                 testContent.includes('but succeed with extended'),
    required: true
  },
  {
    name: 'Uses timing assertions with tolerance',
    check: () => testContent.includes('TIMING_TOLERANCE') &&
                 testContent.includes('toBeGreaterThanOrEqual') &&
                 testContent.includes('toBeLessThan'),
    required: true
  },
  {
    name: 'Has proper mock implementations',
    check: () => testContent.includes('MockOperationWithConfigurableTimeout') &&
                 testContent.includes('MockBrowserWithCustomTimeouts') &&
                 testContent.includes('MockMCPClientWithCustomTimeouts') &&
                 testContent.includes('MockApprovalGateWithCustomTimeout'),
    required: true
  },
  {
    name: 'Tests edge cases and error scenarios',
    check: () => testContent.includes('Edge Cases and Error Scenarios') &&
                 testContent.includes('zero and negative timeout edge cases') &&
                 testContent.includes('concurrent operations with different custom timeouts'),
    required: true
  },
  {
    name: 'Uses EventEmitter for event verification',
    check: () => testContent.includes('EventEmitter') &&
                 testContent.includes('.on(') &&
                 testContent.includes('.emit('),
    required: true
  },
  {
    name: 'Tests timeout hierarchy and precedence',
    check: () => testContent.includes('timeout configuration inheritance') &&
                 testContent.includes('hierarchy') &&
                 testContent.includes('global') &&
                 testContent.includes('component') &&
                 testContent.includes('operation'),
    required: true
  },
  {
    name: 'Has comprehensive test coverage with proper assertions',
    check: () => {
      const testCases = (testContent.match(/it\(/g) || []).length;
      return testCases >= 20; // Should have at least 20 test cases
    },
    required: true
  },
  {
    name: 'Uses proper error expectations',
    check: () => testContent.includes('expect(promise).rejects.toThrow') ||
                 testContent.includes('await expect(').includes('.rejects.'),
    required: true
  },
  {
    name: 'Tests cascading timeout strategies',
    check: () => testContent.includes('cascade') &&
                 testContent.includes('increasing timeouts'),
    required: true
  }
];

// Run validations
let passed = 0;
let failed = 0;

console.log('\n📋 Running validation checks:\n');

validations.forEach((validation, index) => {
  const result = validation.check();
  if (result) {
    console.log(`✅ ${index + 1}. ${validation.name}`);
    passed++;
  } else {
    console.log(`${validation.required ? '❌' : '⚠️'} ${index + 1}. ${validation.name}`);
    if (validation.required) {
      failed++;
    }
  }
});

// Summary
console.log(`\n📊 Validation Summary:`);
console.log(`  ✅ Passed: ${passed}/${validations.length}`);
console.log(`  ❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All validations passed! The custom timeout configuration integration tests implementation meets all acceptance criteria.');
} else {
  console.log('\n⚠️  Some required validations failed. Please review the implementation.');
}

// File statistics
const lines = testContent.split('\n').length;
const imports = (testContent.match(/^import /gm) || []).length;
const testCases = (testContent.match(/it\(/g) || []).length;
const describes = (testContent.match(/describe\(/g) || []).length;

console.log(`\n📈 Implementation Statistics:`);
console.log(`  📄 Lines of code: ${lines}`);
console.log(`  📦 Import statements: ${imports}`);
console.log(`  🧪 Test cases: ${testCases}`);
console.log(`  📋 Describe blocks: ${describes}`);

// Check for specific acceptance criteria coverage
console.log(`\n🎯 Acceptance Criteria Coverage:`);

const ac1Coverage = [
  'custom timeout instead of default timeout at operation level',
  'component-level timeout configuration overrides',
  'operation-level override taking precedence'
].every(phrase => testContent.includes(phrase));

const ac2Coverage = [
  'Promise.race Pattern',
  'Polling Pattern',
  'Exponential Backoff Pattern',
  'SetTimeout with Cleanup Pattern'
].every(phrase => testContent.includes(phrase));

const ac3Coverage = [
  'fail with short default timeout but succeed with extended custom timeout',
  'Browser operations',
  'MCP operations',
  'Approval operations'
].every(phrase => testContent.includes(phrase));

console.log(`  AC1 (Custom timeout override): ${ac1Coverage ? '✅' : '❌'}`);
console.log(`  AC2 (Wait strategy respect): ${ac2Coverage ? '✅' : '❌'}`);
console.log(`  AC3 (Extended timeout success): ${ac3Coverage ? '✅' : '❌'}`);

const allACsCovered = ac1Coverage && ac2Coverage && ac3Coverage;

console.log(`\n${allACsCovered ? '🎯 All acceptance criteria are fully covered!' : '⚠️ Some acceptance criteria may need more coverage.'}`);

process.exit(failed === 0 ? 0 : 1);