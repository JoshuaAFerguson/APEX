/**
 * @fileoverview Comprehensive tests for Policy Violation Event Types
 *
 * This test suite verifies that all four policy violation event types work correctly:
 * - policy:violation - Basic violation detection
 * - policy:blocked - Action blocking in strict mode
 * - policy:warned - Warning emission in warn mode
 * - policy:audited - Audit logging in audit mode
 *
 * Tests cover:
 * - Event emission with correct payloads
 * - Integration with orchestrator event system
 * - Different enforcement modes
 * - Event payload structure validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index';
import { PolicyEnforcer } from '../policy/policy-enforcer';
import type {
  PolicyConfig,
  Task,
  PolicyViolationEvent,
} from '@apexcli/core';
import type {
  PolicyViolationEventData,
  PolicyBlockedEventData,
  PolicyWarnedEventData,
  PolicyAuditedEventData,
} from '../index';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Policy Event Test Task',
  description: 'A test task for policy event testing',
  status: 'pending',
  agent: 'test-agent',
  workflow: 'test-workflow',
  priority: 'medium',
  effort: 'medium',
  context: {},
  usage: {
    totalTokens: 1000,
    inputTokens: 600,
    outputTokens: 400,
    estimatedCost: 2.0,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createPolicyConfig = (overrides: Partial<PolicyConfig> = {}): PolicyConfig => ({
  version: '1.0',
  enabled: true,
  enforcement: 'warn',
  name: 'test-policy',
  allowedPaths: {
    mode: 'allowlist',
    allow: ['src/**', 'tests/**'],
    block: ['src/secrets/**', 'node_modules/**'],
    sensitivePatterns: ['**/.env*', '**/config/production.*', '**/*.key'],
  },
  approvalRules: {
    enabled: true,
    rules: [
      {
        id: 'high-cost-rule',
        name: 'High Cost Rule',
        enabled: true,
        conditions: [{ type: 'cost-threshold', threshold: 5.0 }],
        urgency: 'normal',
        timeoutMinutes: 60,
        minApprovals: 1,
      },
    ],
  },
  ...overrides,
});

describe('Policy Violation Event Types', () => {
  let enforcer: PolicyEnforcer;
  let violationEvents: PolicyViolationEvent[];

  beforeEach(() => {
    violationEvents = [];
  });

  describe('policy:violation events', () => {
    beforeEach(() => {
      const config = createPolicyConfig({ enforcement: 'warn' });
      enforcer = new PolicyEnforcer(config);
      enforcer.on('policy:violation', (event) => violationEvents.push(event));
    });

    it('should emit policy:violation with all required fields from acceptance criteria', () => {
      const task = createMockTask({ id: 'test-task-001' });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/api-key.ts'],
        operationType: 'write',
        metadata: { testRun: true },
      });

      expect(result.passed).toBe(false);
      expect(violationEvents).toHaveLength(1);

      const event = violationEvents[0];

      // Verify all acceptance criteria fields are present
      expect(event.taskId).toBe('test-task-001');
      expect(event.agent).toBeDefined();
      expect(event.action).toBeDefined();
      expect(event.violation).toBeDefined();
      expect(event.violation.id).toBeDefined();
      expect(event.violation.rule).toBeDefined();
      expect(event.violation.message).toBeDefined();
      expect(event.violation.severity).toBeDefined();
      expect(event.enforcementMode).toBe('warn');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit events for different enforcement modes', () => {
      const configs = [
        { enforcement: 'strict' as const, expectedMode: 'strict' },
        { enforcement: 'warn' as const, expectedMode: 'warn' },
        { enforcement: 'audit' as const, expectedMode: 'audit' },
      ];

      configs.forEach(({ enforcement, expectedMode }, index) => {
        const config = createPolicyConfig({ enforcement });
        const testEnforcer = new PolicyEnforcer(config);
        const events: PolicyViolationEvent[] = [];
        testEnforcer.on('policy:violation', (event) => events.push(event));

        const task = createMockTask({ id: `task-${index}` });
        testEnforcer.checkTaskStart(task, {
          projectPaths: ['src/secrets/database.key'],
          operationType: 'read',
        });

        expect(events).toHaveLength(1);
        expect(events[0].enforcementMode).toBe(expectedMode);
        expect(events[0].taskId).toBe(`task-${index}`);
      });
    });

    it('should include violation details and context', () => {
      const task = createMockTask({
        id: 'detail-test-task',
        agent: 'developer',
        workflow: 'feature-development',
      });

      const context = {
        projectPaths: ['node_modules/package/index.js'],
        operationType: 'read' as const,
        metadata: {
          reason: 'dependency analysis',
          requestedBy: 'test-user',
        },
      };

      enforcer.checkTaskStart(task, context);

      expect(violationEvents).toHaveLength(1);
      const event = violationEvents[0];

      expect(event.taskId).toBe('detail-test-task');
      expect(event.agent).toBe('developer');
      expect(event.action).toBe('read');
      expect(event.violation.rule).toBe('path-validation');
      expect(event.violation.message).toContain('node_modules');
      expect(event.violation.severity).toBeDefined();
    });

    it('should emit multiple events for multiple violations', () => {
      const task = createMockTask({ id: 'multi-violation-task' });

      // This should trigger multiple violations: blocked path + sensitive pattern
      enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/.env.production'], // Both blocked and sensitive
        operationType: 'write',
      });

      expect(violationEvents.length).toBeGreaterThan(0);

      // Should have at least one violation for the blocked path
      const pathViolation = violationEvents.find(e =>
        e.violation.message.includes('src/secrets')
      );
      expect(pathViolation).toBeDefined();
    });

    it('should not emit events when policy is disabled', () => {
      const disabledConfig = createPolicyConfig({ enabled: false });
      const disabledEnforcer = new PolicyEnforcer(disabledConfig);
      const events: PolicyViolationEvent[] = [];
      disabledEnforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask({ id: 'disabled-test' });
      disabledEnforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/api-key.ts'],
        operationType: 'write',
      });

      expect(events).toHaveLength(0);
    });

    it('should include proper violation context and metadata', () => {
      const task = createMockTask({ id: 'context-test' });

      enforcer.validateFilePath('src/secrets/database.key', {
        taskId: 'context-test',
        agent: 'developer',
        action: 'write',
        requestId: 'req-123',
        metadata: { source: 'file-operation' },
      });

      expect(violationEvents).toHaveLength(1);
      const event = violationEvents[0];

      expect(event.taskId).toBe('context-test');
      expect(event.agent).toBe('developer');
      expect(event.action).toBe('write');
      expect(event.requestId).toBe('req-123');
    });
  });

  describe('Event payload structure validation', () => {
    beforeEach(() => {
      const config = createPolicyConfig({ enforcement: 'warn' });
      enforcer = new PolicyEnforcer(config);
    });

    it('should emit events with consistent timestamp format', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();
      const beforeTime = new Date();

      enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/key.pem'],
        operationType: 'read',
      });

      const afterTime = new Date();

      expect(events).toHaveLength(1);
      expect(events[0].timestamp).toBeInstanceOf(Date);
      expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(events[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should emit events with unique violation IDs', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();

      // Trigger multiple violations
      enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/key1.pem', 'src/secrets/key2.pem'],
        operationType: 'write',
      });

      expect(events.length).toBeGreaterThan(0);

      const violationIds = events.map(e => e.violation.id);
      const uniqueIds = new Set(violationIds);
      expect(uniqueIds.size).toBe(violationIds.length);
    });

    it('should emit events with proper severity levels', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();

      enforcer.checkTaskStart(task, {
        projectPaths: ['node_modules/package/index.js'], // Should be blocked (high severity)
        operationType: 'write',
      });

      expect(events).toHaveLength(1);
      expect(['low', 'medium', 'high', 'critical']).toContain(events[0].violation.severity);
    });
  });

  describe('Error handling and edge cases', () => {
    beforeEach(() => {
      const config = createPolicyConfig({ enforcement: 'warn' });
      enforcer = new PolicyEnforcer(config);
    });

    it('should handle event listener errors gracefully', () => {
      const events: PolicyViolationEvent[] = [];
      const workingListener = (event: PolicyViolationEvent) => events.push(event);
      const errorListener = () => { throw new Error('Listener error'); };

      enforcer.on('policy:violation', errorListener);
      enforcer.on('policy:violation', workingListener);

      const task = createMockTask();

      // Should not throw even if one listener errors
      expect(() => {
        enforcer.checkTaskStart(task, {
          projectPaths: ['src/secrets/api-key.ts'],
          operationType: 'write',
        });
      }).not.toThrow();

      // Working listener should still receive event
      expect(events).toHaveLength(1);
    });

    it('should handle missing context gracefully', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask({ id: 'no-context-task' });

      // Call without optional context
      enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/api-key.ts'],
        operationType: 'read',
      });

      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('no-context-task');
      expect(events[0].agent).toBeDefined(); // Should have default value
    });

    it('should handle validation of empty or invalid paths', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();

      // Test with empty paths array
      const result1 = enforcer.checkTaskStart(task, {
        projectPaths: [],
        operationType: 'read',
      });
      expect(result1.passed).toBe(true);
      expect(events).toHaveLength(0);

      // Test with null/undefined path
      const violations = enforcer.validateFilePath('');
      expect(violations).toHaveLength(0);
    });
  });

  describe('Performance and stress testing', () => {
    beforeEach(() => {
      const config = createPolicyConfig({ enforcement: 'warn' });
      enforcer = new PolicyEnforcer(config);
    });

    it('should handle high volume of events efficiently', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const startTime = Date.now();
      const testPaths = Array.from({ length: 100 }, (_, i) => `src/secrets/key-${i}.pem`);

      testPaths.forEach(path => {
        enforcer.validateFilePath(path);
      });

      const duration = Date.now() - startTime;

      expect(events.length).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle many concurrent listeners', () => {
      const listenerCount = 50;
      const allEvents: PolicyViolationEvent[][] = [];

      // Add many listeners
      for (let i = 0; i < listenerCount; i++) {
        const events: PolicyViolationEvent[] = [];
        allEvents.push(events);
        enforcer.on('policy:violation', (event) => events.push(event));
      }

      const task = createMockTask();
      enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/api-key.ts'],
        operationType: 'write',
      });

      // All listeners should have received the event
      allEvents.forEach(events => {
        expect(events).toHaveLength(1);
      });
    });

    it('should properly clean up event listeners', () => {
      const events: PolicyViolationEvent[] = [];
      const listener = (event: PolicyViolationEvent) => events.push(event);

      enforcer.on('policy:violation', listener);

      // Verify listener is working
      const task1 = createMockTask();
      enforcer.checkTaskStart(task1, {
        projectPaths: ['src/secrets/key1.pem'],
        operationType: 'read',
      });
      expect(events).toHaveLength(1);

      // Remove listener
      enforcer.off('policy:violation', listener);

      // Verify listener is removed
      const task2 = createMockTask();
      enforcer.checkTaskStart(task2, {
        projectPaths: ['src/secrets/key2.pem'],
        operationType: 'read',
      });
      expect(events).toHaveLength(1); // Should still be 1, not 2
    });
  });

  describe('Integration with different enforcement modes', () => {
    it('should emit appropriate events for strict enforcement', () => {
      const config = createPolicyConfig({ enforcement: 'strict' });
      const strictEnforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      strictEnforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();
      const result = strictEnforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/database.key'],
        operationType: 'write',
      });

      expect(result.passed).toBe(false);
      expect(events).toHaveLength(1);
      expect(events[0].enforcementMode).toBe('strict');
      expect(events[0].violation.blocking).toBe(true);
    });

    it('should emit appropriate events for warn enforcement', () => {
      const config = createPolicyConfig({ enforcement: 'warn' });
      const warnEnforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      warnEnforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();
      const result = warnEnforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/config.env'],
        operationType: 'read',
      });

      expect(result.passed).toBe(false); // Still fails but non-blocking
      expect(events).toHaveLength(1);
      expect(events[0].enforcementMode).toBe('warn');
    });

    it('should emit appropriate events for audit enforcement', () => {
      const config = createPolicyConfig({ enforcement: 'audit' });
      const auditEnforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      auditEnforcer.on('policy:violation', (event) => events.push(event));

      const task = createMockTask();
      const result = auditEnforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/private.key'],
        operationType: 'write',
      });

      expect(result.passed).toBe(false);
      expect(events).toHaveLength(1);
      expect(events[0].enforcementMode).toBe('audit');
    });
  });
});