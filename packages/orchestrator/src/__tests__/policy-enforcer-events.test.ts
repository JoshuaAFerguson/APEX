/**
 * @fileoverview Event Emission Tests for PolicyEnforcer Integration
 *
 * This test suite verifies that PolicyEnforcer properly emits events during
 * policy checking and that these events are correctly propagated through
 * the ApexOrchestrator system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PolicyEnforcer } from '../policy/policy-enforcer';
import type {
  PolicyConfig,
  Task,
  PolicyViolationEvent,
} from '@apexcli/core';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Event Test Task',
  description: 'A test task for event emission testing',
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
  name: 'event-test-policy',
  allowedPaths: {
    mode: 'allowlist',
    allow: ['src/**', 'tests/**'],
    block: ['src/secrets/**', '**/*.key'],
    sensitivePatterns: ['**/.env*', '**/config/production.*'],
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

describe('PolicyEnforcer Event Emission', () => {
  let enforcer: PolicyEnforcer;
  let violationEvents: PolicyViolationEvent[];

  beforeEach(() => {
    const config = createPolicyConfig();
    enforcer = new PolicyEnforcer(config);
    violationEvents = [];

    // Set up event listener
    enforcer.on('policy:violation', (event: PolicyViolationEvent) => {
      violationEvents.push(event);
    });
  });

  describe('Path Violation Events', () => {
    it('should emit events for blocked path violations', () => {
      const task = createMockTask({ id: 'test-task-blocked' });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/api-key.ts'],
        operationType: 'read',
        metadata: { testRun: true },
      });

      expect(result.passed).toBe(false);
      expect(violationEvents.length).toBeGreaterThan(0);

      const event = violationEvents.find(e =>
        e.violation.ruleId === 'path-validation'
      );
      expect(event).toBeDefined();

      // Verify event structure
      expect(event!.type).toBe('policy_violation');
      expect(event!.id).toBeDefined();
      expect(event!.timestamp).toBeInstanceOf(Date);
      expect(event!.violation.resource).toBe('src/secrets/api-key.ts');
      expect(event!.violation.message).toContain('blocked');
      expect(event!.violation.severity).toBe('warning');
      expect(event!.metadata?.testRun).toBe(true);
    });

    it('should emit events for allowlist violations', () => {
      const task = createMockTask({ id: 'test-task-allowlist' });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['config/database.yml'], // Not in allowlist
        operationType: 'modify',
      });

      expect(result.passed).toBe(false);
      expect(violationEvents.length).toBeGreaterThan(0);

      const pathEvent = violationEvents.find(e =>
        e.violation.ruleId === 'path-validation' &&
        e.violation.resource === 'config/database.yml'
      );
      expect(pathEvent).toBeDefined();
      expect(pathEvent!.violation.message).toContain('not in the allowed paths list');
    });

    it('should emit events for sensitive file patterns', () => {
      const task = createMockTask({ id: 'test-task-sensitive' });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['.env.production'], // Sensitive pattern
      });

      expect(violationEvents.length).toBeGreaterThan(0);

      const sensitiveEvent = violationEvents.find(e =>
        e.violation.ruleId === 'sensitive-path'
      );
      expect(sensitiveEvent).toBeDefined();
      expect(sensitiveEvent!.violation.message).toContain('sensitive file pattern');
      expect(sensitiveEvent!.violation.context?.isSensitive).toBe(true);
    });

    it('should emit events with correct task context', () => {
      const taskId = randomUUID();
      const workflowId = 'test-workflow-123';
      const agentId = 'test-agent-456';

      const task = createMockTask({
        id: taskId,
        workflow: workflowId,
        agent: agentId,
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['blocked/file.ts'],
      });

      expect(violationEvents.length).toBeGreaterThan(0);

      const event = violationEvents[0];
      expect(event.taskId).toBe(taskId);
      expect(event.workflowId).toBe(workflowId);
      expect(event.agentId).toBe(agentId);
    });

    it('should emit separate events for multiple path violations', () => {
      const task = createMockTask();

      const violatingPaths = [
        'src/secrets/key1.ts',
        'src/secrets/key2.ts',
        'config/production.env',
      ];

      const result = enforcer.checkTaskStart(task, {
        projectPaths: violatingPaths,
      });

      expect(result.passed).toBe(false);

      // Should have events for each path violation
      const pathViolationEvents = violationEvents.filter(e =>
        e.violation.ruleId === 'path-validation' || e.violation.ruleId === 'sensitive-path'
      );
      expect(pathViolationEvents.length).toBeGreaterThanOrEqual(violatingPaths.length);

      // Each path should be represented in events
      for (const path of violatingPaths) {
        const pathEvent = violationEvents.find(e =>
          e.violation.resource === path
        );
        expect(pathEvent).toBeDefined();
      }
    });
  });

  describe('Task Policy Violation Events', () => {
    it('should emit events for urgent task violations', () => {
      const task = createMockTask({
        priority: 'urgent',
        workflow: 'emergency-hotfix',
      });

      const result = enforcer.checkTaskStart(task);

      expect(violationEvents.length).toBeGreaterThan(0);

      const urgentEvent = violationEvents.find(e =>
        e.violation.message.includes('Urgent priority tasks')
      );
      expect(urgentEvent).toBeDefined();
      expect(urgentEvent!.violation.severity).toBe('warning');
    });

    it('should emit events for large effort task violations', () => {
      const task = createMockTask({
        effort: 'xlarge',
        title: 'Large Refactoring Task',
      });

      const result = enforcer.checkTaskStart(task);

      expect(violationEvents.length).toBeGreaterThan(0);

      const effortEvent = violationEvents.find(e =>
        e.violation.message.includes('xlarge effort require review')
      );
      expect(effortEvent).toBeDefined();
      expect(effortEvent!.violation.severity).toBe('info');
    });

    it('should emit events for high-cost task violations', () => {
      const task = createMockTask({
        usage: {
          estimatedCost: 25.0,
          totalTokens: 50000,
          inputTokens: 30000,
          outputTokens: 20000,
        },
      });

      const result = enforcer.checkTaskStart(task);

      expect(violationEvents.length).toBeGreaterThan(0);

      const costEvent = violationEvents.find(e =>
        e.violation.message.includes('estimated cost over $10')
      );
      expect(costEvent).toBeDefined();
      expect(costEvent!.violation.severity).toBe('warning');
    });

    it('should emit events for production deployment violations', () => {
      const task = createMockTask({
        workflow: 'production-deployment',
        title: 'Deploy to Production',
      });

      const result = enforcer.checkTaskStart(task);

      expect(violationEvents.length).toBeGreaterThan(0);

      const prodEvent = violationEvents.find(e =>
        e.violation.message.includes('Production-related workflows')
      );
      expect(prodEvent).toBeDefined();
      expect(prodEvent!.violation.severity).toBe('error');
    });
  });

  describe('Approval Requirement Events', () => {
    it('should emit events when approval is required', () => {
      const task = createMockTask({
        usage: {
          estimatedCost: 8.0,  // Above threshold
          totalTokens: 15000,
          inputTokens: 9000,
          outputTokens: 6000,
        },
      });

      const result = enforcer.checkTaskStart(task, {
        operationType: 'deploy',
      });

      expect(result.requiresApproval).toBe(true);
      expect(violationEvents.length).toBeGreaterThan(0);

      const approvalEvent = violationEvents.find(e =>
        e.violation.message.includes('approval') ||
        e.violation.details?.urgency
      );
      expect(approvalEvent).toBeDefined();
    });

    it('should include approval details in event metadata', () => {
      const config = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'detailed-approval',
              name: 'Detailed Approval Rule',
              enabled: true,
              conditions: [{ type: 'cost-threshold', threshold: 3.0 }],
              urgency: 'high',
              timeoutMinutes: 15,
              minApprovals: 2,
              approvers: ['lead-dev', 'tech-lead'],
            },
          ],
        },
      });

      enforcer = new PolicyEnforcer(config);
      violationEvents = [];
      enforcer.on('policy:violation', (event) => {
        violationEvents.push(event);
      });

      const task = createMockTask({
        usage: {
          estimatedCost: 5.0,
          totalTokens: 10000,
          inputTokens: 6000,
          outputTokens: 4000,
        },
      });

      const result = enforcer.checkTaskStart(task);

      expect(result.requiresApproval).toBe(true);

      const approvalEvent = violationEvents.find(e =>
        e.violation.details?.urgency === 'high'
      );
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.violation.details?.minApprovals).toBe(2);
      expect(approvalEvent!.violation.details?.requiredApprovers).toContain('lead-dev');
      expect(approvalEvent!.violation.details?.requiredApprovers).toContain('tech-lead');
    });
  });

  describe('Event Timing and Ordering', () => {
    it('should emit events in chronological order', () => {
      const task = createMockTask({
        priority: 'urgent',
        effort: 'large',
        workflow: 'production-deploy',
        usage: { estimatedCost: 15.0, totalTokens: 30000, inputTokens: 18000, outputTokens: 12000 },
      });

      const beforeTime = Date.now();
      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/key.ts', 'config/.env'],
      });
      const afterTime = Date.now();

      expect(violationEvents.length).toBeGreaterThan(2);

      // All events should be within the execution timeframe
      for (const event of violationEvents) {
        const eventTime = event.timestamp.getTime();
        expect(eventTime).toBeGreaterThanOrEqual(beforeTime);
        expect(eventTime).toBeLessThanOrEqual(afterTime);
      }

      // Events should be ordered chronologically
      for (let i = 1; i < violationEvents.length; i++) {
        expect(violationEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          violationEvents[i - 1].timestamp.getTime()
        );
      }
    });

    it('should emit events with unique IDs', () => {
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['path1/blocked.ts', 'path2/blocked.ts'],
      });

      expect(violationEvents.length).toBeGreaterThan(0);

      const eventIds = violationEvents.map(e => e.id);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(eventIds.length);
    });
  });

  describe('Event Filtering and Conditional Emission', () => {
    it('should not emit events when policy is disabled', () => {
      const config = createPolicyConfig({ enabled: false });
      enforcer = new PolicyEnforcer(config);
      violationEvents = [];
      enforcer.on('policy:violation', (event) => {
        violationEvents.push(event);
      });

      const task = createMockTask({
        workflow: 'production-deployment',
        priority: 'urgent',
        effort: 'xlarge',
        usage: { estimatedCost: 100.0, totalTokens: 200000, inputTokens: 120000, outputTokens: 80000 },
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['blocked/everything.ts'],
      });

      expect(result.passed).toBe(true);
      expect(violationEvents.length).toBe(0);
    });

    it('should emit events even in audit mode', () => {
      const config = createPolicyConfig({ enforcement: 'audit' });
      enforcer = new PolicyEnforcer(config);
      violationEvents = [];
      enforcer.on('policy:violation', (event) => {
        violationEvents.push(event);
      });

      const task = createMockTask({
        workflow: 'production-deployment',
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/key.ts'],
      });

      expect(result.passed).toBe(true); // Passes in audit mode
      expect(violationEvents.length).toBeGreaterThan(0); // But events still emitted
    });

    it('should handle event listener errors gracefully', () => {
      const task = createMockTask();

      // Add a listener that throws an error
      enforcer.on('policy:violation', () => {
        throw new Error('Event listener error');
      });

      // Policy checking should not crash due to listener errors
      expect(() => {
        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['src/secrets/key.ts'],
        });
      }).not.toThrow();
    });
  });

  describe('Event Data Integrity', () => {
    it('should include all required violation data in events', () => {
      const task = createMockTask({
        id: 'integrity-test-task',
        workflow: 'test-workflow',
        agent: 'test-agent',
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['src/secrets/sensitive.key'],
        operationType: 'read',
        metadata: {
          source: 'test',
          requestId: 'req-123',
        },
      });

      expect(violationEvents.length).toBeGreaterThan(0);

      for (const event of violationEvents) {
        // Verify event structure
        expect(event.type).toBe('policy_violation');
        expect(event.id).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.violation).toBeDefined();

        // Verify violation structure
        const violation = event.violation;
        expect(violation.id).toBeDefined();
        expect(violation.ruleId).toBeDefined();
        expect(violation.policyType).toBeDefined();
        expect(violation.severity).toBeDefined();
        expect(violation.message).toBeDefined();
        expect(violation.timestamp).toBeInstanceOf(Date);
        expect(violation.resolved).toBe(false);

        // Verify context propagation
        expect(event.taskId).toBe('integrity-test-task');
        expect(event.workflowId).toBe('test-workflow');
        expect(event.agentId).toBe('test-agent');
        expect(event.metadata?.source).toBe('test');
        expect(event.metadata?.requestId).toBe('req-123');
      }
    });

    it('should maintain event data consistency across multiple calls', () => {
      const task = createMockTask({ effort: 'large' });

      // Run the same check multiple times
      for (let i = 0; i < 3; i++) {
        violationEvents = [];
        const result = enforcer.checkTaskStart(task);

        // Should get consistent results each time
        expect(violationEvents.length).toBe(1);
        expect(violationEvents[0].violation.ruleId).toBe('large-effort-review');
        expect(violationEvents[0].violation.severity).toBe('info');
      }
    });

    it('should handle edge cases in event data', () => {
      const edgeTask = createMockTask({
        id: '',  // Empty ID
        title: 'Task with "special" \'characters\'',
        description: 'Description with\nnewlines\tand\rtabs',
        workflow: 'workflow-with-unicode-🚀',
      });

      const result = enforcer.checkTaskStart(edgeTask, {
        projectPaths: ['path/with spaces/file.ts', 'path/with/émojis-🔥.ts'],
        metadata: {
          complexObject: {
            nested: { value: 123 },
            array: [1, 'two', null],
            nullValue: null,
            undefinedValue: undefined,
          },
        },
      });

      // Should handle edge cases without throwing
      expect(() => {
        for (const event of violationEvents) {
          JSON.stringify(event); // Should be serializable
        }
      }).not.toThrow();
    });
  });
});