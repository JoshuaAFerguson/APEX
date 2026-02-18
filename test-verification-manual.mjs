#!/usr/bin/env node

/**
 * Manual test verification script for utility functions
 * This script validates that our utility functions are working as expected
 */

import {
  formatDuration,
  formatElapsed,
  formatTokens,
  formatCost,
  truncate,
  truncateToolOutput,
  generateTaskId,
  generateIdleTaskId,
  generateTaskTemplateId,
  generateApprovalId,
} from './packages/core/dist/utils.js';

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    testsFailed++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toMatch: (regex) => {
      if (!regex.test(actual)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to match ${regex}`);
      }
    },
    toContain: (substring) => {
      if (!actual.includes(substring)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(substring)}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    }
  };
}

console.log('🧪 Running utility function tests...\n');

// Test formatDuration
test('formatDuration - milliseconds', () => {
  expect(formatDuration(500)).toBe('500ms');
});

test('formatDuration - seconds', () => {
  expect(formatDuration(2500)).toBe('2.5s');
});

test('formatDuration - minutes', () => {
  expect(formatDuration(125000)).toBe('2m 5s');
});

test('formatDuration - hours', () => {
  expect(formatDuration(3725000)).toBe('1h 2m');
});

// Test formatElapsed
test('formatElapsed - seconds', () => {
  const startTime = new Date('2024-01-01T10:00:00Z');
  const currentTime = new Date('2024-01-01T10:00:05Z');
  expect(formatElapsed(startTime, currentTime)).toBe('5s');
});

test('formatElapsed - minutes and seconds', () => {
  const startTime = new Date('2024-01-01T10:00:00Z');
  const currentTime = new Date('2024-01-01T10:02:30Z');
  expect(formatElapsed(startTime, currentTime)).toBe('2m 30s');
});

// Test formatTokens
test('formatTokens - simple number', () => {
  expect(formatTokens(1234)).toBe('1,234');
});

test('formatTokens - large number', () => {
  expect(formatTokens(5678901)).toBe('5,678,901');
});

// Test formatCost
test('formatCost - basic cost', () => {
  expect(formatCost(0.0042)).toBe('$0.0042');
});

test('formatCost - rounded cost', () => {
  expect(formatCost(10)).toBe('$10.0000');
});

// Test truncate
test('truncate - basic truncation', () => {
  expect(truncate('This is a long string', 10)).toBe('This is...');
});

test('truncate - short string unchanged', () => {
  expect(truncate('Short', 10)).toBe('Short');
});

// Test truncateToolOutput
test('truncateToolOutput - short content unchanged', () => {
  const shortContent = 'This is short content';
  const result = truncateToolOutput(shortContent);
  expect(result.truncated).toBe(false);
  expect(result.output).toBe(shortContent);
});

test('truncateToolOutput - long content truncated', () => {
  const longContent = 'A'.repeat(15000);
  const result = truncateToolOutput(longContent, { maxLength: 100 });
  expect(result.truncated).toBe(true);
  expect(result.output).toContain('... [truncated]');
});

// Test ID generation functions
test('generateTaskId - correct format', () => {
  const id = generateTaskId();
  expect(id).toMatch(/^task_[a-z0-9]+_[a-f0-9]{8}$/);
});

test('generateIdleTaskId - correct format', () => {
  const id = generateIdleTaskId();
  expect(id).toMatch(/^idle_[a-z0-9]+_[a-f0-9]{8}$/);
});

test('generateTaskTemplateId - correct format', () => {
  const id = generateTaskTemplateId();
  expect(id).toMatch(/^template_[a-z0-9]+_[a-f0-9]{8}$/);
});

test('generateApprovalId - correct format', () => {
  const id = generateApprovalId();
  expect(id).toMatch(/^apr_[a-z0-9]+_[a-f0-9]{8}$/);
});

// Test ID uniqueness
test('ID generation uniqueness', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    ids.add(generateTaskId());
    ids.add(generateIdleTaskId());
    ids.add(generateTaskTemplateId());
    ids.add(generateApprovalId());
  }
  expect(ids.size).toBe(200); // 50 * 4 types
});

console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);

if (testsFailed === 0) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some tests failed!');
  process.exit(1);
}