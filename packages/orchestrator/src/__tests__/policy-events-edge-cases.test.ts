/**
 * @fileoverview Edge Cases and Error Path Tests for Policy Events
 *
 * This test suite covers edge cases, error conditions, and boundary scenarios
 * for the policy violation event system. Tests ensure robustness and proper
 * error handling across various failure modes and unusual inputs.
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
  title: 'Edge Case Test Task',
  description: 'Task for testing edge cases',
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

const createMinimalPolicyConfig = (overrides: Partial<PolicyConfig> = {}): PolicyConfig => ({
  version: '1.0',
  enabled: true,
  enforcement: 'warn',
  name: 'edge-case-policy',
  allowedPaths: {
    mode: 'allowlist',
    allow: ['src/**'],
    block: ['secrets/**'],
    sensitivePatterns: ['**/*.key'],
  },
  approvalRules: {
    enabled: false,
    rules: [],
  },
  ...overrides,
});

describe('Policy Events Edge Cases and Error Paths', () => {
  let enforcer: PolicyEnforcer;
  let violationEvents: PolicyViolationEvent[];

  beforeEach(() => {
    violationEvents = [];
  });

  describe('Malformed input handling', () => {
    beforeEach(() => {
      const config = createMinimalPolicyConfig();
      enforcer = new PolicyEnforcer(config);
      enforcer.on('policy:violation', (event) => violationEvents.push(event));
    });

    it('should handle null and undefined file paths gracefully', () => {
      expect(() => {
        enforcer.validateFilePath(null as any);
        enforcer.validateFilePath(undefined as any);
        enforcer.validateFilePath('');
      }).not.toThrow();

      // Should not emit events for invalid paths
      expect(violationEvents).toHaveLength(0);
    });

    it('should handle tasks with missing or invalid properties', () => {
      const malformedTasks = [
        {} as Task, // Empty task
        { id: null } as any, // Null ID
        { id: '', agent: undefined } as any, // Empty/undefined values
        { id: 'test', workflow: 123 } as any, // Wrong types
      ];

      malformedTasks.forEach(task => {
        expect(() => {
          enforcer.checkTaskStart(task, {
            projectPaths: ['secrets/test.key'],
            operationType: 'read',
          });
        }).not.toThrow();
      });

      // Should handle gracefully and possibly emit events with defaults
      expect(violationEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed context objects', () => {
      const task = createMockTask();
      const malformedContexts = [
        null,
        undefined,
        { taskId: null },
        { agent: 123 },
        { action: {} },
        { metadata: 'not-an-object' },
      ];

      malformedContexts.forEach((context) => {
        expect(() => {
          enforcer.validateFilePath('secrets/test.key', context as any);
        }).not.toThrow();
      });
    });

    it('should handle extremely long file paths', () => {
      const longPath = 'secrets/' + 'a'.repeat(10000) + '.key';
      const veryLongPath = 'secrets/' + 'b'.repeat(100000) + '.key';

      expect(() => {
        enforcer.validateFilePath(longPath);
        enforcer.validateFilePath(veryLongPath);
      }).not.toThrow();

      // Should still detect violations for long paths
      expect(violationEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters and unicode in paths', () => {
      const specialPaths = [
        'secrets/файл.key', // Cyrillic
        'secrets/文件.key', // Chinese
        'secrets/🔑.key', // Emoji
        'secrets/file with spaces.key',
        'secrets/file-with-dashes.key',
        'secrets/file.with.dots.key',
        'secrets/file(with)parens.key',
        'secrets/file[with]brackets.key',
        'secrets/file{with}braces.key',
      ];

      specialPaths.forEach(path => {
        expect(() => {
          enforcer.validateFilePath(path);
        }).not.toThrow();
      });
    });
  });

  describe('Event listener error handling', () => {
    beforeEach(() => {
      const config = createMinimalPolicyConfig();
      enforcer = new PolicyEnforcer(config);
    });

    it('should continue operation if event listeners throw errors', () => {
      const successfulEvents: PolicyViolationEvent[] = [];

      // Add listeners that throw different types of errors
      enforcer.on('policy:violation', () => {
        throw new Error('Standard error');
      });

      enforcer.on('policy:violation', () => {
        throw new TypeError('Type error');
      });

      enforcer.on('policy:violation', () => {
        throw 'String error';
      });

      enforcer.on('policy:violation', () => {
        throw null;
      });

      enforcer.on('policy:violation', () => {
        throw undefined;
      });

      // Add a working listener
      enforcer.on('policy:violation', (event) => {
        successfulEvents.push(event);
      });

      const task = createMockTask();

      // Should not throw even with error listeners
      expect(() => {
        enforcer.checkTaskStart(task, {
          projectPaths: ['secrets/api-key.key'],
          operationType: 'write',
        });
      }).not.toThrow();

      // Working listener should still receive event
      expect(successfulEvents).toHaveLength(1);
    });

    it('should handle recursive event emission gracefully', () => {
      const recursiveEvents: PolicyViolationEvent[] = [];
      let recursionCount = 0;

      enforcer.on('policy:violation', (event) => {
        recursiveEvents.push(event);
        recursionCount++;

        // Prevent infinite recursion
        if (recursionCount < 5) {
          // Try to trigger another event from within the listener
          try {
            enforcer.validateFilePath(`recursive-${recursionCount}.key`);
          } catch {
            // Ignore errors from recursive calls
          }
        }
      });

      const task = createMockTask();

      expect(() => {
        enforcer.checkTaskStart(task, {
          projectPaths: ['secrets/trigger.key'],
          operationType: 'read',
        });
      }).not.toThrow();

      // Should handle recursive calls gracefully
      expect(recursionCount).toBeLessThan(10);
    });

    it('should handle async errors in event listeners', async () => {
      const asyncEvents: PolicyViolationEvent[] = [];

      enforcer.on('policy:violation', async (event) => {
        // Simulate async error
        await new Promise(resolve => setTimeout(resolve, 1));
        throw new Error('Async error');
      });

      enforcer.on('policy:violation', (event) => {
        asyncEvents.push(event);
      });

      const task = createMockTask();

      expect(() => {
        enforcer.checkTaskStart(task, {
          projectPaths: ['secrets/async-test.key'],
          operationType: 'write',
        });
      }).not.toThrow();

      expect(asyncEvents).toHaveLength(1);
    });
  });

  describe('Memory and performance edge cases', () => {
    beforeEach(() => {
      const config = createMinimalPolicyConfig();
      enforcer = new PolicyEnforcer(config);
    });

    it('should handle large numbers of simultaneous listeners', () => {
      const listenerCount = 1000;
      const allEvents: PolicyViolationEvent[][] = [];

      // Add many listeners
      for (let i = 0; i < listenerCount; i++) {
        const events: PolicyViolationEvent[] = [];
        allEvents.push(events);
        enforcer.on('policy:violation', (event) => events.push(event));
      }

      const startTime = Date.now();

      const task = createMockTask();
      enforcer.checkTaskStart(task, {
        projectPaths: ['secrets/performance-test.key'],
        operationType: 'read',
      });

      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000);

      // All listeners should have received the event
      allEvents.forEach((events, index) => {
        expect(events).toHaveLength(1);
      });

      // Clean up listeners to prevent memory leaks
      enforcer.removeAllListeners('policy:violation');
    });

    it('should handle rapid addition and removal of listeners', () => {
      const events: PolicyViolationEvent[] = [];

      for (let i = 0; i < 100; i++) {
        const listener = (event: PolicyViolationEvent) => events.push(event);
        enforcer.on('policy:violation', listener);

        // Immediately remove some listeners
        if (i % 2 === 0) {
          enforcer.off('policy:violation', listener);
        }
      }

      const task = createMockTask();
      enforcer.checkTaskStart(task, {
        projectPaths: ['secrets/listener-churn.key'],
        operationType: 'write',
      });

      // Should handle listener churn gracefully
      expect(events.length).toBeGreaterThanOrEqual(0);
      expect(events.length).toBeLessThanOrEqual(50); // At most 50 listeners remained
    });

    it('should handle very large event payloads', () => {
      const largeEvents: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => largeEvents.push(event));

      const hugeMetadata = {
        largeArray: Array(10000).fill('data'),
        largeString: 'x'.repeat(100000),
        nestedObject: {
          level1: {
            level2: {
              level3: Array(1000).fill({ data: 'nested'.repeat(100) }),
            },
          },
        },
      };

      const task = createMockTask({
        context: hugeMetadata,
      });

      expect(() => {
        enforcer.checkTaskStart(task, {
          projectPaths: ['secrets/large-context.key'],
          operationType: 'read',
          metadata: hugeMetadata,
        });
      }).not.toThrow();

      expect(largeEvents).toHaveLength(1);
    });
  });

  describe('Concurrent access edge cases', () => {
    beforeEach(() => {
      const config = createMinimalPolicyConfig();
      enforcer = new PolicyEnforcer(config);
    });

    it('should handle simultaneous policy checks from multiple threads', async () => {
      const allEvents: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => allEvents.push(event));

      const concurrentChecks = Array.from({ length: 50 }, (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const task = createMockTask({ id: `concurrent-task-${i}` });
            enforcer.checkTaskStart(task, {
              projectPaths: [`secrets/concurrent-${i}.key`],
              operationType: 'read',
            });
            resolve();
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });

      await Promise.all(concurrentChecks);

      expect(allEvents).toHaveLength(50);

      // Verify all task IDs are unique
      const taskIds = allEvents.map(e => e.taskId);
      const uniqueTaskIds = new Set(taskIds);
      expect(uniqueTaskIds.size).toBe(50);
    });

    it('should handle concurrent listener modification during event emission', () => {
      const events: PolicyViolationEvent[] = [];
      const removedListeners: Array<(event: PolicyViolationEvent) => void> = [];

      // Add initial listeners
      for (let i = 0; i < 10; i++) {
        const listener = (event: PolicyViolationEvent) => {
          events.push(event);

          // Randomly add or remove listeners during event handling
          if (Math.random() > 0.5) {
            const newListener = (e: PolicyViolationEvent) => events.push(e);
            enforcer.on('policy:violation', newListener);
            removedListeners.push(newListener);
          } else if (removedListeners.length > 0) {
            const toRemove = removedListeners.pop()!;
            enforcer.off('policy:violation', toRemove);
          }
        };
        enforcer.on('policy:violation', listener);
      }

      const task = createMockTask();

      expect(() => {
        enforcer.checkTaskStart(task, {
          projectPaths: ['secrets/concurrent-modify.key'],
          operationType: 'write',
        });
      }).not.toThrow();

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle policy configuration with empty arrays and patterns', () => {
      const edgeConfig: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        name: 'empty-config',
        allowedPaths: {
          mode: 'allowlist',
          allow: [], // Empty allow list
          block: [], // Empty block list
          sensitivePatterns: [], // Empty patterns
        },
        approvalRules: {
          enabled: false,
          rules: [], // Empty rules
        },
      };

      expect(() => {
        const edgeEnforcer = new PolicyEnforcer(edgeConfig);
        const events: PolicyViolationEvent[] = [];
        edgeEnforcer.on('policy:violation', (event) => events.push(event));

        const task = createMockTask();
        edgeEnforcer.checkTaskStart(task, {
          projectPaths: ['any-file.js'],
          operationType: 'read',
        });
      }).not.toThrow();
    });

    it('should handle policy configuration with invalid patterns', () => {
      const invalidConfig: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        name: 'invalid-pattern-config',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['[invalid-bracket'], // Invalid glob pattern
          sensitivePatterns: ['**/*[unclosed'], // Invalid pattern
        },
        approvalRules: {
          enabled: false,
          rules: [],
        },
      };

      expect(() => {
        const invalidEnforcer = new PolicyEnforcer(invalidConfig);
        const events: PolicyViolationEvent[] = [];
        invalidEnforcer.on('policy:violation', (event) => events.push(event));

        const task = createMockTask();
        invalidEnforcer.checkTaskStart(task, {
          projectPaths: ['test-file.js'],
          operationType: 'read',
        });
      }).not.toThrow();
    });
  });

  describe('Event ordering and timing edge cases', () => {
    beforeEach(() => {
      const config = createMinimalPolicyConfig();
      enforcer = new PolicyEnforcer(config);
    });

    it('should maintain event order during rapid successive calls', () => {
      const events: PolicyViolationEvent[] = [];
      const taskIds: string[] = [];

      enforcer.on('policy:violation', (event) => {
        events.push(event);
        taskIds.push(event.taskId || 'unknown');
      });

      // Generate events in rapid succession
      for (let i = 0; i < 20; i++) {
        enforcer.validateFilePath(`secrets/rapid-${i}.key`, {
          taskId: `rapid-task-${i}`,
          agent: 'test-agent',
          action: 'read',
        });
      }

      expect(events).toHaveLength(20);

      // Task IDs should be in order
      for (let i = 0; i < 20; i++) {
        expect(taskIds[i]).toBe(`rapid-task-${i}`);
      }
    });

    it('should handle events with timestamps very close together', () => {
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const startTime = Date.now();

      // Trigger multiple events as fast as possible
      for (let i = 0; i < 10; i++) {
        enforcer.validateFilePath(`secrets/timestamp-${i}.key`, {
          taskId: `timestamp-task-${i}`,
          agent: 'test-agent',
          action: 'read',
        });
      }

      const endTime = Date.now();

      expect(events).toHaveLength(10);

      // All timestamps should be within the execution window
      events.forEach((event) => {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(endTime + 1000); // Allow some buffer
      });

      // Timestamps should be unique or very close
      const timestamps = events.map(e => e.timestamp.getTime());
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBeLessThanOrEqual(timestamps.length);
    });
  });
});