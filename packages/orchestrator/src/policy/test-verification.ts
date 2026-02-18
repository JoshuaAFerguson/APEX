/**
 * @fileoverview Test verification script for PolicyEnforcer event emission
 *
 * This script verifies that all acceptance criteria are met:
 * 1. PolicyEnforcer extends EventEmitter
 * 2. Emits 'policy:violation' events with PolicyViolationEvent payload
 * 3. Events include violation type, severity, context, and suggested remediation
 * 4. Integration tests verify event emission
 */

import { PolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, PolicyViolationEvent } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Acceptance Criteria Verification
// ============================================================================

/**
 * Verifies that PolicyEnforcer extends EventEmitter
 */
function verifyEventEmitterInheritance(): boolean {
  try {
    const config: PolicyConfig = { enforcement: 'warn' };
    const enforcer = new PolicyEnforcer(config);

    // Check if it's an instance of EventEmitter
    const isEventEmitter = enforcer instanceof EventEmitter;

    // Check if it has the required EventEmitter methods
    const hasRequiredMethods = [
      'on', 'off', 'emit', 'removeAllListeners', 'listeners'
    ].every(method => typeof (enforcer as any)[method] === 'function');

    console.log('✓ PolicyEnforcer extends EventEmitter:', isEventEmitter && hasRequiredMethods);
    return isEventEmitter && hasRequiredMethods;
  } catch (error) {
    console.log('✗ PolicyEnforcer EventEmitter inheritance failed:', error);
    return false;
  }
}

/**
 * Verifies that policy:violation events are emitted with correct payload
 */
function verifyEventEmission(): boolean {
  try {
    const config: PolicyConfig = {
      enforcement: 'enforce',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**'],
      },
    };

    const enforcer = new PolicyEnforcer(config);
    let eventReceived: PolicyViolationEvent | null = null;

    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      eventReceived = event;
    });

    // Trigger a violation
    enforcer.validateFilePath('blocked/file.ts');

    if (!eventReceived) {
      console.log('✗ No policy:violation event was emitted');
      return false;
    }

    console.log('✓ policy:violation event emitted successfully');
    return true;
  } catch (error) {
    console.log('✗ Event emission verification failed:', error);
    return false;
  }
}

/**
 * Verifies the structure of PolicyViolationEvent payload
 */
function verifyEventPayloadStructure(): boolean {
  try {
    const config: PolicyConfig = {
      enforcement: 'enforce',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**'],
      },
    };

    const enforcer = new PolicyEnforcer(config);
    let eventReceived: PolicyViolationEvent | null = null;

    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      eventReceived = event;
    });

    // Trigger a violation with context
    const context = {
      taskId: 'task-123',
      agentId: 'agent-456',
      workflowId: 'workflow-789',
      metadata: { source: 'test' },
    };

    enforcer.validateFilePath('blocked/file.ts', context);

    if (!eventReceived) {
      console.log('✗ No event received for payload verification');
      return false;
    }

    // Verify required fields
    const requiredFields = [
      'type', 'id', 'timestamp', 'violation'
    ];

    const missingFields = requiredFields.filter(field => !(field in eventReceived));
    if (missingFields.length > 0) {
      console.log('✗ Missing required fields in event:', missingFields);
      return false;
    }

    // Verify event type
    if (eventReceived.type !== 'policy_violation') {
      console.log('✗ Incorrect event type:', eventReceived.type);
      return false;
    }

    // Verify violation object structure
    const violationRequiredFields = [
      'id', 'ruleId', 'policyType', 'severity', 'message', 'timestamp', 'resolved'
    ];

    const missingViolationFields = violationRequiredFields.filter(
      field => !(field in eventReceived.violation)
    );

    if (missingViolationFields.length > 0) {
      console.log('✗ Missing required fields in violation object:', missingViolationFields);
      return false;
    }

    // Verify context propagation
    if (eventReceived.taskId !== context.taskId) {
      console.log('✗ Context not properly propagated - taskId mismatch');
      return false;
    }

    console.log('✓ Event payload structure is correct');
    return true;
  } catch (error) {
    console.log('✗ Event payload verification failed:', error);
    return false;
  }
}

/**
 * Verifies that events include violation type, severity, context, and suggested remediation
 */
function verifyEventContent(): boolean {
  try {
    const config: PolicyConfig = {
      enforcement: 'warn',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**'],
        sensitivePatterns: ['**/*.env*'],
      },
    };

    const enforcer = new PolicyEnforcer(config);
    const events: PolicyViolationEvent[] = [];

    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      events.push(event);
    });

    // Test different violation types
    enforcer.validateFilePath('blocked/file.ts'); // Path violation
    enforcer.validateFilePath('src/.env.local'); // Sensitive file

    if (events.length < 2) {
      console.log('✗ Expected 2 events, got:', events.length);
      return false;
    }

    // Verify violation types are included
    const pathViolation = events[0];
    const sensitiveViolation = events[1];

    if (pathViolation.violation.policyType !== 'path') {
      console.log('✗ Violation type not correctly set for path violation');
      return false;
    }

    if (sensitiveViolation.violation.policyType !== 'path') {
      console.log('✗ Violation type not correctly set for sensitive violation');
      return false;
    }

    // Verify severity is included
    const validSeverities = ['info', 'warning', 'error'];
    if (!validSeverities.includes(pathViolation.violation.severity)) {
      console.log('✗ Invalid severity in path violation:', pathViolation.violation.severity);
      return false;
    }

    // Verify context information
    if (!pathViolation.violation.context) {
      console.log('✗ Context missing from violation event');
      return false;
    }

    // Verify suggested remediation (message should contain helpful information)
    if (!pathViolation.violation.message || pathViolation.violation.message.trim() === '') {
      console.log('✗ No message/remediation provided in violation');
      return false;
    }

    if (!pathViolation.violation.description || pathViolation.violation.description.trim() === '') {
      console.log('✗ No description provided in violation');
      return false;
    }

    console.log('✓ Event content includes required information');
    return true;
  } catch (error) {
    console.log('✗ Event content verification failed:', error);
    return false;
  }
}

/**
 * Verifies integration test coverage exists
 */
function verifyIntegrationTestCoverage(): boolean {
  try {
    // Check if integration test file exists
    const fs = require('fs');
    const path = require('path');

    const integrationTestPath = path.join(__dirname, 'policy-enforcer.integration.test.ts');
    const unitTestPath = path.join(__dirname, 'policy-enforcer.test.ts');

    const integrationTestExists = fs.existsSync(integrationTestPath);
    const unitTestExists = fs.existsSync(unitTestPath);

    if (!unitTestExists) {
      console.log('✗ Unit test file missing');
      return false;
    }

    if (!integrationTestExists) {
      console.log('✗ Integration test file missing');
      return false;
    }

    // Check if integration tests contain event emission tests
    const integrationTestContent = fs.readFileSync(integrationTestPath, 'utf8');

    const hasEventEmissionTests = integrationTestContent.includes('policy:violation');
    const hasEventListenerTests = integrationTestContent.includes('on(\'policy:violation\'');
    const hasEventStructureTests = integrationTestContent.includes('PolicyViolationEvent');

    if (!hasEventEmissionTests || !hasEventListenerTests || !hasEventStructureTests) {
      console.log('✗ Integration tests missing required event emission coverage');
      return false;
    }

    console.log('✓ Integration test coverage exists and includes event emission tests');
    return true;
  } catch (error) {
    console.log('✗ Integration test coverage verification failed:', error);
    return false;
  }
}

/**
 * Main verification function
 */
export function verifyAcceptanceCriteria(): boolean {
  console.log('='.repeat(70));
  console.log('PolicyEnforcer Event Emission - Acceptance Criteria Verification');
  console.log('='.repeat(70));

  const checks = [
    { name: 'EventEmitter Inheritance', test: verifyEventEmitterInheritance },
    { name: 'Event Emission', test: verifyEventEmission },
    { name: 'Event Payload Structure', test: verifyEventPayloadStructure },
    { name: 'Event Content', test: verifyEventContent },
    { name: 'Integration Test Coverage', test: verifyIntegrationTestCoverage },
  ];

  let allPassed = true;

  for (const check of checks) {
    console.log(`\n${check.name}:`);
    const passed = check.test();
    allPassed = allPassed && passed;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Overall Result: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log('='.repeat(70));

  return allPassed;
}

// Run verification if this file is executed directly
if (require.main === module) {
  const success = verifyAcceptanceCriteria();
  process.exit(success ? 0 : 1);
}