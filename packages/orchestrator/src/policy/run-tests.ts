/**
 * @fileoverview Simple test runner to verify PolicyEnforcer functionality
 *
 * This script runs basic functionality tests to ensure the PolicyEnforcer
 * is working correctly with event emission.
 */

import { PolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, PolicyViolationEvent } from '@apexcli/core';

/**
 * Simple test runner function
 */
function runBasicTests(): boolean {
  console.log('Running basic PolicyEnforcer tests...\n');

  let allTestsPassed = true;

  // Test 1: Basic Event Emission
  console.log('Test 1: Basic Event Emission');
  try {
    const config: PolicyConfig = {
      enforcement: 'enforce',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**'],
      },
    };

    const enforcer = new PolicyEnforcer(config);
    let eventReceived = false;

    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      console.log('  ✓ Event received:', event.type);
      eventReceived = true;
    });

    enforcer.validateFilePath('blocked/file.ts');

    if (eventReceived) {
      console.log('  ✓ Test 1 PASSED\n');
    } else {
      console.log('  ✗ Test 1 FAILED - No event received\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Test 1 FAILED -', error);
    allTestsPassed = false;
  }

  // Test 2: Event Structure Verification
  console.log('Test 2: Event Structure Verification');
  try {
    const config: PolicyConfig = {
      enforcement: 'warn',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**'],
      },
    };

    const enforcer = new PolicyEnforcer(config);
    let capturedEvent: PolicyViolationEvent | null = null;

    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      capturedEvent = event;
    });

    const context = {
      taskId: 'test-task',
      agentId: 'test-agent',
      metadata: { test: true },
    };

    enforcer.validateFilePath('blocked/file.ts', context);

    if (capturedEvent) {
      const hasRequiredFields = (
        capturedEvent.type === 'policy_violation' &&
        typeof capturedEvent.id === 'string' &&
        capturedEvent.timestamp instanceof Date &&
        capturedEvent.violation &&
        capturedEvent.taskId === 'test-task' &&
        capturedEvent.agentId === 'test-agent'
      );

      if (hasRequiredFields) {
        console.log('  ✓ All required fields present');
        console.log('  ✓ Test 2 PASSED\n');
      } else {
        console.log('  ✗ Test 2 FAILED - Missing required fields');
        console.log('  Event:', capturedEvent);
        allTestsPassed = false;
      }
    } else {
      console.log('  ✗ Test 2 FAILED - No event captured\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Test 2 FAILED -', error);
    allTestsPassed = false;
  }

  // Test 3: Multiple Event Types
  console.log('Test 3: Multiple Event Types');
  try {
    const config: PolicyConfig = {
      enforcement: 'enforce',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**'],
        sensitivePatterns: ['**/.env*'],
      },
    };

    const enforcer = new PolicyEnforcer(config);
    const events: PolicyViolationEvent[] = [];

    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      events.push(event);
    });

    // Trigger different types of violations
    enforcer.validateFilePath('blocked/file.ts'); // Path violation
    enforcer.validateFilePath('src/.env.local'); // Sensitive file

    if (events.length === 2) {
      const pathViolation = events[0];
      const sensitiveViolation = events[1];

      const correctTypes = (
        pathViolation.violation.ruleId === 'path-validation' &&
        sensitiveViolation.violation.ruleId === 'sensitive-path'
      );

      if (correctTypes) {
        console.log('  ✓ Both violation types detected correctly');
        console.log('  ✓ Test 3 PASSED\n');
      } else {
        console.log('  ✗ Test 3 FAILED - Incorrect violation types');
        console.log('  Path rule ID:', pathViolation.violation.ruleId);
        console.log('  Sensitive rule ID:', sensitiveViolation.violation.ruleId);
        allTestsPassed = false;
      }
    } else {
      console.log('  ✗ Test 3 FAILED - Expected 2 events, got', events.length);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Test 3 FAILED -', error);
    allTestsPassed = false;
  }

  // Test 4: EventEmitter Methods
  console.log('Test 4: EventEmitter Methods');
  try {
    const config: PolicyConfig = { enforcement: 'warn' };
    const enforcer = new PolicyEnforcer(config);

    const hasEventEmitterMethods = (
      typeof enforcer.on === 'function' &&
      typeof enforcer.off === 'function' &&
      typeof enforcer.emit === 'function' &&
      typeof enforcer.removeAllListeners === 'function'
    );

    if (hasEventEmitterMethods) {
      console.log('  ✓ All EventEmitter methods present');
      console.log('  ✓ Test 4 PASSED\n');
    } else {
      console.log('  ✗ Test 4 FAILED - Missing EventEmitter methods');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ✗ Test 4 FAILED -', error);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

/**
 * Main function
 */
function main(): void {
  console.log('PolicyEnforcer Event Emission Test Suite');
  console.log('=' .repeat(50));

  const success = runBasicTests();

  console.log('=' .repeat(50));
  if (success) {
    console.log('✓ ALL TESTS PASSED - PolicyEnforcer event emission working correctly');
  } else {
    console.log('✗ SOME TESTS FAILED - Check output above for details');
  }
  console.log('=' .repeat(50));
}

// Run if this is the main module
if (typeof require !== 'undefined' && require.main === module) {
  main();
}

export { runBasicTests, main };