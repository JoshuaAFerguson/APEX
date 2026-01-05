import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type {
  Task,
  AuditLogEntry,
  AuditEventType,
  AuditSeverity,
} from '@apexcli/core';

describe('TaskStore - Audit Logs Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-edge-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestTask = async (): Promise<Task> => {
    const task: Task = {
      id: `task_${Date.now()}_edge`,
      description: 'Test task for edge cases',
      workflow: 'feature',
      autonomy: 'full',
      status: 'pending',
      priority: 'normal',
      projectPath: testDir,
      branchName: 'apex/edge-test',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      logs: [],
      artifacts: [],
    };
    await store.createTask(task);
    return task;
  };

  describe('Boundary conditions', () => {
    it('should handle empty string values correctly', async () => {
      const task = await createTestTask();
      const auditEntry: AuditLogEntry = {
        id: '',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: '',
        message: '',
        stage: '',
        agent: '',
        success: true,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs).toHaveLength(1);
      expect(logs[0].actor).toBe('');
      expect(logs[0].message).toBe('');
      expect(logs[0].stage).toBe('');
      expect(logs[0].agent).toBe('');
    });

    it('should handle maximum length strings', async () => {
      const task = await createTestTask();
      const maxString = 'x'.repeat(65535); // Large string

      const auditEntry: AuditLogEntry = {
        id: 'long-test',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: maxString,
        message: maxString,
        stage: maxString,
        agent: maxString,
        success: true,
      };

      await expect(store.addAuditLog(auditEntry)).resolves.not.toThrow();

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0].actor).toHaveLength(65535);
      expect(logs[0].message).toHaveLength(65535);
    });

    it('should handle Unicode and special characters', async () => {
      const task = await createTestTask();
      const specialChars = '🚀 ñáéíóú 中文 العربية ∑∏∆ "quotes" \'apostrophes\' <tags> &amp; \\backslash';

      const auditEntry: AuditLogEntry = {
        id: 'unicode-test',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: specialChars,
        message: specialChars,
        success: true,
        metadata: {
          unicode: specialChars,
          symbols: '™®©¿¡§¶•…–—""''‚„‹›«»',
          emoji: '🔥💯✨🎯🚀⭐️💖🎉🌟💫'
        }
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].actor).toBe(specialChars);
      expect(logs[0].message).toBe(specialChars);
      expect(logs[0].metadata?.unicode).toBe(specialChars);
    });

    it('should handle extreme timestamp values', async () => {
      const task = await createTestTask();

      // Test with very old timestamp
      const oldDate = new Date('1970-01-01T00:00:00.000Z');
      const oldEntry: AuditLogEntry = {
        id: 'old-timestamp',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: oldDate,
        actor: 'old-actor',
        message: 'Very old audit entry',
        success: true,
      };

      // Test with far future timestamp
      const futureDate = new Date('2100-12-31T23:59:59.999Z');
      const futureEntry: AuditLogEntry = {
        id: 'future-timestamp',
        taskId: task.id,
        eventType: 'task.completed',
        severity: 'info',
        timestamp: futureDate,
        actor: 'future-actor',
        message: 'Future audit entry',
        success: true,
      };

      await store.addAuditLog(oldEntry);
      await store.addAuditLog(futureEntry);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      // Should be sorted by timestamp (newest first)
      expect(logs[0].timestamp.getTime()).toBe(futureDate.getTime());
      expect(logs[1].timestamp.getTime()).toBe(oldDate.getTime());
    });
  });

  describe('Complex metadata handling', () => {
    it('should handle deeply nested metadata objects', async () => {
      const task = await createTestTask();

      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep value',
                  array: [1, 2, 3, { nested: 'object' }],
                  boolean: true,
                  null: null,
                  undefined: undefined,
                }
              }
            }
          }
        },
        arrays: [
          [1, 2, [3, 4, [5, 6]]],
          { complex: 'array', items: ['a', 'b', 'c'] }
        ]
      };

      const auditEntry: AuditLogEntry = {
        id: 'deep-metadata',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Deep metadata test',
        success: true,
        metadata: deepMetadata,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].metadata?.level1.level2.level3.level4.level5.value).toBe('deep value');
      expect(logs[0].metadata?.arrays[0][2][2][1]).toBe(6);
    });

    it('should handle circular references in metadata', async () => {
      const task = await createTestTask();

      const circularObj: any = { name: 'parent' };
      circularObj.self = circularObj;
      circularObj.children = [
        { name: 'child1', parent: circularObj },
        { name: 'child2', parent: circularObj }
      ];

      const auditEntry: AuditLogEntry = {
        id: 'circular-metadata',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Circular metadata test',
        success: true,
        metadata: circularObj,
      };

      // Should not throw error when handling circular reference
      await expect(store.addAuditLog(auditEntry)).resolves.not.toThrow();

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
      // Note: circular references may be serialized differently or cause truncation
    });

    it('should handle metadata with functions and non-serializable values', async () => {
      const task = await createTestTask();

      const complexMetadata = {
        func: () => 'function',
        symbol: Symbol('test'),
        date: new Date(),
        regexp: /test/gi,
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
        buffer: Buffer.from('test'),
        class: class TestClass {},
        bigint: BigInt(123),
      };

      const auditEntry: AuditLogEntry = {
        id: 'complex-metadata',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Complex metadata test',
        success: true,
        metadata: complexMetadata,
      };

      await expect(store.addAuditLog(auditEntry)).resolves.not.toThrow();

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
      // Functions and other non-serializable values should be handled gracefully
    });
  });

  describe('State change edge cases', () => {
    it('should handle identical previous and new states', async () => {
      const task = await createTestTask();

      const sameState = { status: 'running', progress: 50 };
      const auditEntry: AuditLogEntry = {
        id: 'same-state',
        taskId: task.id,
        eventType: 'task.status_changed',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'State change to same state',
        success: true,
        previousState: sameState,
        newState: sameState,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].previousState).toEqual(logs[0].newState);
    });

    it('should handle null/undefined state values', async () => {
      const task = await createTestTask();

      const auditEntry: AuditLogEntry = {
        id: 'null-states',
        taskId: task.id,
        eventType: 'task.status_changed',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Null state changes',
        success: true,
        previousState: null,
        newState: undefined,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].previousState).toBeNull();
      expect(logs[0].newState).toBeUndefined();
    });

    it('should handle very large state objects', async () => {
      const task = await createTestTask();

      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
        metadata: { index: i, generated: true }
      }));

      const largeState = {
        items: largeArray,
        metadata: {
          count: largeArray.length,
          generated: new Date(),
          settings: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`]))
        }
      };

      const auditEntry: AuditLogEntry = {
        id: 'large-state',
        taskId: task.id,
        eventType: 'task.status_changed',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Large state change',
        success: true,
        previousState: { items: [] },
        newState: largeState,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].newState?.items).toHaveLength(1000);
      expect(logs[0].newState?.metadata.count).toBe(1000);
    });
  });

  describe('Duration and performance edge cases', () => {
    it('should handle zero and negative durations', async () => {
      const task = await createTestTask();

      const testCases = [
        { durationMs: 0, description: 'Zero duration' },
        { durationMs: -1, description: 'Negative duration' },
        { durationMs: -999999, description: 'Large negative duration' },
        { durationMs: Number.MAX_SAFE_INTEGER, description: 'Maximum duration' },
        { durationMs: Number.MIN_SAFE_INTEGER, description: 'Minimum duration' },
      ];

      for (const testCase of testCases) {
        const auditEntry: AuditLogEntry = {
          id: `duration-${testCase.durationMs}`,
          taskId: task.id,
          eventType: 'task.completed',
          severity: 'info',
          timestamp: new Date(),
          actor: 'test-actor',
          message: testCase.description,
          success: true,
          durationMs: testCase.durationMs,
        };

        await store.addAuditLog(auditEntry);
      }

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(testCases.length);
    });

    it('should handle fractional durations', async () => {
      const task = await createTestTask();

      const auditEntry: AuditLogEntry = {
        id: 'fractional-duration',
        taskId: task.id,
        eventType: 'task.completed',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Fractional duration',
        success: true,
        durationMs: 123.456,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].durationMs).toBe(123.456);
    });
  });

  describe('Query edge cases', () => {
    it('should handle queries with non-existent task IDs', async () => {
      const nonExistentTaskId = 'non-existent-task-id';
      const logs = await store.getAuditLogs(nonExistentTaskId);
      expect(logs).toEqual([]);
    });

    it('should handle queries with invalid date ranges', async () => {
      const task = await createTestTask();

      // Add a log
      const auditEntry: AuditLogEntry = {
        id: 'date-range-test',
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-actor',
        message: 'Date range test',
        success: true,
      };
      await store.addAuditLog(auditEntry);

      // Query with invalid date range (end before start)
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01');

      const logs = await store.getAuditLogs(task.id, { startDate, endDate });
      expect(logs).toEqual([]);
    });

    it('should handle very large limit and offset values', async () => {
      const task = await createTestTask();

      // Add a few logs
      for (let i = 0; i < 5; i++) {
        const auditEntry: AuditLogEntry = {
          id: `large-query-${i}`,
          taskId: task.id,
          eventType: 'task.created',
          severity: 'info',
          timestamp: new Date(),
          actor: 'test-actor',
          message: `Log ${i}`,
          success: true,
        };
        await store.addAuditLog(auditEntry);
      }

      // Query with very large limit
      const logs1 = await store.getAuditLogs(task.id, { limit: Number.MAX_SAFE_INTEGER });
      expect(logs1).toHaveLength(5);

      // Query with large offset
      const logs2 = await store.getAuditLogs(task.id, { offset: 1000 });
      expect(logs2).toEqual([]);

      // Query with negative values (should be handled gracefully)
      const logs3 = await store.getAuditLogs(task.id, { limit: -1, offset: -1 });
      expect(logs3).toHaveLength(5); // Should return all logs
    });
  });

  describe('Concurrency edge cases', () => {
    it('should handle rapid successive audit log additions', async () => {
      const task = await createTestTask();
      const logCount = 100;

      // Add logs as fast as possible
      const promises = Array.from({ length: logCount }, (_, index) => {
        const auditEntry: AuditLogEntry = {
          id: `rapid-${index}`,
          taskId: task.id,
          eventType: 'task.progress',
          severity: 'info',
          timestamp: new Date(Date.now() + index), // Slightly different timestamps
          actor: 'rapid-actor',
          message: `Rapid log ${index}`,
          success: true,
        };
        return store.addAuditLog(auditEntry);
      });

      await Promise.all(promises);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(logCount);

      // Verify all logs have unique IDs
      const ids = logs.map(log => log.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(logCount);
    });

    it('should handle concurrent cleanup operations', async () => {
      const task = await createTestTask();

      // Add some old logs
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      for (let i = 0; i < 10; i++) {
        const auditEntry: AuditLogEntry = {
          id: `concurrent-cleanup-${i}`,
          taskId: task.id,
          eventType: 'task.old',
          severity: 'info',
          timestamp: oldDate,
          actor: 'cleanup-actor',
          message: `Old log ${i}`,
          success: true,
        };
        await store.addAuditLog(auditEntry);
      }

      // Run multiple cleanup operations concurrently
      const cleanupPromises = Array.from({ length: 5 }, () => store.cleanupAuditLogs(30));
      const results = await Promise.all(cleanupPromises);

      // Only one should actually delete (others should return 0)
      const totalDeleted = results.reduce((sum, count) => sum + count, 0);
      expect(totalDeleted).toBe(10); // All old logs should be deleted once

      const remainingLogs = await store.getAuditLogs(task.id);
      expect(remainingLogs).toHaveLength(0);
    });
  });

  describe('Error message edge cases', () => {
    it('should handle very long error messages', async () => {
      const task = await createTestTask();
      const longError = 'Error: '.repeat(1000) + 'Very long error message with stack trace\n'.repeat(100);

      const auditEntry: AuditLogEntry = {
        id: 'long-error',
        taskId: task.id,
        eventType: 'task.error',
        severity: 'error',
        timestamp: new Date(),
        actor: 'error-actor',
        message: 'Task failed with long error',
        success: false,
        error: longError,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].error).toHaveLength(longError.length);
    });

    it('should handle error messages with special formatting', async () => {
      const task = await createTestTask();
      const formattedError = `
        TypeError: Cannot read property 'foo' of undefined
            at Object.exports.createError (/app/node_modules/http-errors/index.js:158:15)
            at Router.handle (/app/node_modules/express/lib/router/index.js:176:15)
            at next (/app/node_modules/express/lib/router/index.js:137:14)
            at Function.handle (/app/node_modules/express/lib/application.js:174:10)
            at router (/app/node_modules/express/lib/router/index.js:47:12)
            at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)

        Caused by: DatabaseError
            at Database.query (/app/database.js:42:11)
            ... 15 more lines

        Environment:
          - Node.js: v18.15.0
          - Memory: 512MB / 1GB
          - CPU: 45%
      `;

      const auditEntry: AuditLogEntry = {
        id: 'formatted-error',
        taskId: task.id,
        eventType: 'task.error',
        severity: 'error',
        timestamp: new Date(),
        actor: 'error-actor',
        message: 'Task failed with formatted error',
        success: false,
        error: formattedError,
      };

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].error).toBe(formattedError);
    });
  });
});