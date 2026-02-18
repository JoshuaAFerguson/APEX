/**
 * @fileoverview Integration tests for PolicyEnforcer event emission functionality
 *
 * These tests verify that PolicyEnforcer properly integrates with the broader system
 * and emits policy violation events according to the acceptance criteria:
 *
 * - PolicyEnforcer extends EventEmitter
 * - Emits 'policy:violation' events with PolicyViolationEvent payload
 * - Events include violation type, severity, context, and suggested remediation
 * - Integration tests verify event emission
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, PolicyViolationEvent, Task } from '@apexcli/core';

describe('PolicyEnforcer Integration Tests', () => {
  // ============================================================================
  // Event Emission Integration Tests
  // ============================================================================

  describe('PolicyViolationEvent structure and compliance', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['node_modules/**'],
          sensitivePatterns: ['**/*.env*', '**/*.key'],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should emit events with all required fields per PolicyViolationEvent schema', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const context = {
        taskId: 'task-123',
        agentId: 'agent-456',
        workflowId: 'workflow-789',
        metadata: { source: 'integration-test' },
      };

      enforcer.validateFilePath('blocked/sensitive.env', context);

      expect(events).toHaveLength(1);
      const event = events[0];

      // Verify required fields
      expect(event.type).toBe('policy_violation');
      expect(typeof event.id).toBe('string');
      expect(event.id.length).toBeGreaterThan(0);
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.violation).toBeDefined();

      // Verify violation object structure
      expect(event.violation.id).toBeDefined();
      expect(event.violation.ruleId).toBe('path-validation');
      expect(event.violation.policyType).toBe('path');
      expect(['info', 'warning', 'error']).toContain(event.violation.severity);
      expect(event.violation.message).toBeTruthy();
      expect(event.violation.timestamp).toBeInstanceOf(Date);
      expect(event.violation.resolved).toBe(false);

      // Verify context propagation
      expect(event.taskId).toBe('task-123');
      expect(event.agentId).toBe('agent-456');
      expect(event.workflowId).toBe('workflow-789');
      expect(event.metadata?.source).toBe('integration-test');
    });

    it('should include violation type information in events', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      // Test different violation types
      enforcer.validateFilePath('blocked/file.ts'); // Path violation
      enforcer.validateFilePath('allowed/.env.secret'); // Sensitive file

      expect(events).toHaveLength(2);

      // First event: path violation
      expect(events[0].violation.policyType).toBe('path');
      expect(events[0].violation.ruleId).toBe('path-validation');
      expect(events[0].violation.message).toContain('not in the allowed paths list');

      // Second event: sensitive file violation
      expect(events[1].violation.policyType).toBe('path');
      expect(events[1].violation.ruleId).toBe('sensitive-path');
      expect(events[1].violation.message).toContain('requires approval');
    });

    it('should include severity based on enforcement mode', () => {
      const configs = [
        { enforcement: 'audit' as const, expectedSeverity: 'info' as const },
        { enforcement: 'warn' as const, expectedSeverity: 'warning' as const },
        { enforcement: 'enforce' as const, expectedSeverity: 'error' as const },
        { enforcement: 'strict' as const, expectedSeverity: 'error' as const },
      ];

      for (const { enforcement, expectedSeverity } of configs) {
        const config: PolicyConfig = {
          enforcement,
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
        };

        const testEnforcer = new PolicyEnforcer(config);
        const events: PolicyViolationEvent[] = [];
        testEnforcer.on('policy:violation', (event) => events.push(event));

        testEnforcer.validateFilePath('blocked/file.ts');

        expect(events).toHaveLength(1);
        expect(events[0].violation.severity).toBe(expectedSeverity);
      }
    });

    it('should include context and suggested remediation', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      enforcer.validateFilePath('node_modules/package/index.js');

      expect(events).toHaveLength(1);
      const event = events[0];

      // Verify context includes helpful information
      expect(event.violation.context?.matchedPattern).toBe('node_modules/**');
      expect(event.violation.context?.matchType).toBe('block');
      expect(event.violation.description).toContain('blocked pattern');

      // Verify message suggests remediation
      expect(event.violation.message).toContain('blocked by pattern');
    });
  });

  // ============================================================================
  // EventEmitter Integration Tests
  // ============================================================================

  describe('EventEmitter integration', () => {
    it('should properly extend EventEmitter with typed events', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Verify it has EventEmitter methods
      expect(typeof enforcer.on).toBe('function');
      expect(typeof enforcer.off).toBe('function');
      expect(typeof enforcer.emit).toBe('function');
      expect(typeof enforcer.removeAllListeners).toBe('function');

      // Verify event listener functionality
      let eventReceived = false;
      const listener = () => { eventReceived = true; };

      enforcer.on('policy:violation', listener);
      enforcer.validateFilePath('blocked/file.ts');
      expect(eventReceived).toBe(true);

      // Verify listener removal
      eventReceived = false;
      enforcer.off('policy:violation', listener);
      enforcer.validateFilePath('blocked/file2.ts');
      expect(eventReceived).toBe(false);
    });

    it('should support multiple concurrent listeners', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const listener1Events: PolicyViolationEvent[] = [];
      const listener2Events: PolicyViolationEvent[] = [];
      const listener3Events: PolicyViolationEvent[] = [];

      enforcer.on('policy:violation', (event) => listener1Events.push(event));
      enforcer.on('policy:violation', (event) => listener2Events.push(event));
      enforcer.on('policy:violation', (event) => listener3Events.push(event));

      enforcer.validateFilePath('blocked/file.ts');

      // All listeners should receive the same event
      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener3Events).toHaveLength(1);

      // Events should be identical
      expect(listener1Events[0].id).toBe(listener2Events[0].id);
      expect(listener2Events[0].id).toBe(listener3Events[0].id);
    });

    it('should handle listener errors gracefully', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const workingListener = vi.fn();
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      enforcer.on('policy:violation', errorListener);
      enforcer.on('policy:violation', workingListener);

      // Should not throw even if one listener errors
      expect(() => {
        enforcer.validateFilePath('blocked/file.ts');
      }).not.toThrow();

      // Working listener should still be called
      expect(workingListener).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Workflow Integration Tests
  // ============================================================================

  describe('workflow context integration', () => {
    it('should propagate task and workflow context correctly', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const workflowContext = {
        taskId: 'feature-task-001',
        agentId: 'developer-agent',
        workflowId: 'feature-development',
        metadata: {
          stage: 'implementation',
          priority: 'high',
          estimatedCost: 0.05,
        },
      };

      enforcer.validateFilePath('blocked/unauthorized.ts', workflowContext);

      expect(events).toHaveLength(1);
      const event = events[0];

      expect(event.taskId).toBe('feature-task-001');
      expect(event.agentId).toBe('developer-agent');
      expect(event.workflowId).toBe('feature-development');
      expect(event.metadata?.stage).toBe('implementation');
      expect(event.metadata?.priority).toBe('high');
      expect(event.metadata?.estimatedCost).toBe(0.05);
    });

    it('should handle missing context gracefully', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      // Call without context
      enforcer.validateFilePath('blocked/file.ts');

      expect(events).toHaveLength(1);
      const event = events[0];

      expect(event.taskId).toBeUndefined();
      expect(event.agentId).toBeUndefined();
      expect(event.workflowId).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });
  });

  // ============================================================================
  // Approval System Integration Tests
  // ============================================================================

  describe('approval system integration', () => {
    let mockTask: Task;

    beforeEach(() => {
      mockTask = {
        id: 'test-task-1',
        description: 'Test task description',
        workflow: 'feature',
        autonomy: 'autonomous',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: '/project',
        branchName: 'feature/test',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05,
        },
        logs: [],
        artifacts: [],
      };
    });

    it('should integrate with approval rules without interference', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'test-rule',
            name: 'Test Approval Rule',
            conditions: [{
              type: 'operation',
              operations: ['deploy'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      // Test path validation (should emit events)
      enforcer.validateFilePath('blocked/file.ts');
      expect(events).toHaveLength(1);

      // Test approval checking (should not emit events)
      const approvalResult = enforcer.checkApprovalRequired(mockTask, 'deploy');
      expect(approvalResult.required).toBe(true);
      expect(events).toHaveLength(1); // No additional events
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe('performance and memory', () => {
    it('should handle many events efficiently', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const startTime = Date.now();

      // Trigger many violations
      for (let i = 0; i < 100; i++) {
        enforcer.validateFilePath(`blocked/file${i}.ts`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(events).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      // Verify all events have unique IDs
      const eventIds = new Set(events.map(e => e.id));
      expect(eventIds.size).toBe(100);
    });

    it('should properly clean up listeners', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Add many listeners
      const listeners = Array.from({ length: 50 }, (_, i) => {
        const listener = vi.fn();
        enforcer.on('policy:violation', listener);
        return listener;
      });

      // Trigger event to verify all listeners work
      enforcer.validateFilePath('blocked/file.ts');
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      // Remove all listeners
      enforcer.removeAllListeners('policy:violation');

      // Trigger another event - no listeners should be called
      enforcer.validateFilePath('blocked/file2.ts');
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
      });
    });
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  describe('real-world scenarios', () => {
    it('should handle complex policy configurations correctly', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'lib/**', 'tests/**'],
          block: ['src/secrets/**', '**/*.private'],
          sensitivePatterns: ['**/.env*', '**/*.key', '**/credentials.*'],
        },
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'sensitive-files',
            name: 'Sensitive File Access',
            conditions: [{
              type: 'file-pattern',
              patterns: ['**/.env*', '**/*.key'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      // Test various scenarios
      enforcer.validateFilePath('src/index.ts'); // Allowed - no events
      enforcer.validateFilePath('src/secrets/api.key'); // Blocked - 1 event
      enforcer.validateFilePath('lib/.env.local'); // Sensitive - 1 event
      enforcer.validateFilePath('tests/data/test.private'); // Blocked - 1 event
      enforcer.validateFilePath('docs/readme.md'); // Not allowed - 1 event

      expect(events).toHaveLength(4);

      // Verify event types
      expect(events[0].violation.message).toContain('blocked by pattern');
      expect(events[1].violation.message).toContain('requires approval');
      expect(events[2].violation.message).toContain('blocked by pattern');
      expect(events[3].violation.message).toContain('not in the allowed paths list');
    });

    it('should emit events with proper timestamps in chronological order', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const startTime = new Date();

      // Trigger multiple violations with small delays
      enforcer.validateFilePath('blocked/file1.ts');

      setTimeout(() => {
        enforcer.validateFilePath('blocked/file2.ts');

        setTimeout(() => {
          enforcer.validateFilePath('blocked/file3.ts');

          expect(events).toHaveLength(3);

          // Verify timestamps are in order and after start time
          expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
          expect(events[1].timestamp.getTime()).toBeGreaterThanOrEqual(events[0].timestamp.getTime());
          expect(events[2].timestamp.getTime()).toBeGreaterThanOrEqual(events[1].timestamp.getTime());
        }, 10);
      }, 10);
    });
  });
});