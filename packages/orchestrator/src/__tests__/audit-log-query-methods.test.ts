import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type { Task, AuditLogEntry } from '@apexcli/core';

describe('TaskStore - Audit Log Query Methods', () => {
  let testDir: string;
  let store: TaskStore;
  let task1: Task;
  let task2: Task;

  beforeEach(async () => {
    // Create a temporary directory for the test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-query-test-'));
    store = new TaskStore(testDir);
    await store.initialize();

    // Create test tasks
    task1 = {
      id: 'task-1',
      description: 'Test task 1',
      workflow: 'feature',
      autonomy: 'autonomous',
      status: 'pending',
      priority: 'normal',
      effort: 'medium',
      projectPath: '/tmp/test',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
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

    task2 = {
      id: 'task-2',
      description: 'Test task 2',
      workflow: 'feature',
      autonomy: 'autonomous',
      status: 'pending',
      priority: 'normal',
      effort: 'medium',
      projectPath: '/tmp/test',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
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

    await store.createTask(task1);
    await store.createTask(task2);
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestAuditEntry = (
    taskId?: string,
    overrides: Partial<AuditLogEntry> = {}
  ): AuditLogEntry => ({
    id: `audit-${Date.now()}-${Math.random()}`,
    taskId,
    eventType: 'task.created',
    severity: 'info',
    timestamp: new Date(),
    actor: 'system',
    message: 'Test audit entry',
    success: true,
    ...overrides,
  });

  describe('getAuditLog', () => {
    test('should return audit logs for a specific task', async () => {
      const entry1 = createTestAuditEntry(task1.id, { message: 'Entry 1' });
      const entry2 = createTestAuditEntry(task1.id, { message: 'Entry 2' });
      const entry3 = createTestAuditEntry(task2.id, { message: 'Entry 3' });

      await store.addAuditLog(entry1);
      await store.addAuditLog(entry2);
      await store.addAuditLog(entry3);

      const logs = await store.getAuditLog(task1.id);

      expect(logs).toHaveLength(2);
      expect(logs.map(log => log.message)).toContain('Entry 1');
      expect(logs.map(log => log.message)).toContain('Entry 2');
      expect(logs.map(log => log.message)).not.toContain('Entry 3');
    });

    test('should return logs in descending timestamp order', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);
      const later = new Date(now.getTime() + 1000);

      const entry1 = createTestAuditEntry(task1.id, {
        timestamp: earlier,
        message: 'Earlier entry',
      });
      const entry2 = createTestAuditEntry(task1.id, {
        timestamp: later,
        message: 'Later entry',
      });

      await store.addAuditLog(entry1);
      await store.addAuditLog(entry2);

      const logs = await store.getAuditLog(task1.id);

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Later entry');
      expect(logs[1].message).toBe('Earlier entry');
    });

    test('should return empty array for task with no logs', async () => {
      const logs = await store.getAuditLog('non-existent-task');
      expect(logs).toEqual([]);
    });
  });

  describe('queryAuditLog', () => {
    beforeEach(async () => {
      // Set up test data
      const entries = [
        createTestAuditEntry(task1.id, {
          eventType: 'task.created',
          actor: 'user1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        }),
        createTestAuditEntry(task1.id, {
          eventType: 'task.updated',
          actor: 'user2',
          timestamp: new Date('2024-01-02T10:00:00Z'),
        }),
        createTestAuditEntry(task2.id, {
          eventType: 'task.completed',
          actor: 'user1',
          timestamp: new Date('2024-01-03T10:00:00Z'),
        }),
        createTestAuditEntry(task2.id, {
          eventType: 'task.approved',
          actor: 'approver1',
          timestamp: new Date('2024-01-04T10:00:00Z'),
        }),
      ];

      for (const entry of entries) {
        await store.addAuditLog(entry);
      }
    });

    test('should return all logs when no filters provided', async () => {
      const logs = await store.queryAuditLog();
      expect(logs.length).toBeGreaterThanOrEqual(4);
    });

    test('should filter by taskId', async () => {
      const logs = await store.queryAuditLog({ taskId: task1.id });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.taskId === task1.id)).toBe(true);
    });

    test('should filter by actionType', async () => {
      const logs = await store.queryAuditLog({ actionType: 'task.created' });
      expect(logs).toHaveLength(1);
      expect(logs[0].eventType).toBe('task.created');
    });

    test('should filter by approver', async () => {
      const logs = await store.queryAuditLog({ approver: 'user1' });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.actor === 'user1')).toBe(true);
    });

    test('should filter by startDate', async () => {
      const startDate = new Date('2024-01-02T00:00:00Z');
      const logs = await store.queryAuditLog({ startDate });
      expect(logs).toHaveLength(3);
      expect(logs.every(log => log.timestamp >= startDate)).toBe(true);
    });

    test('should filter by endDate', async () => {
      const endDate = new Date('2024-01-02T23:59:59Z');
      const logs = await store.queryAuditLog({ endDate });
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.timestamp <= endDate)).toBe(true);
    });

    test('should combine multiple filters', async () => {
      const logs = await store.queryAuditLog({
        taskId: task1.id,
        approver: 'user1',
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].taskId).toBe(task1.id);
      expect(logs[0].actor).toBe('user1');
    });

    test('should return logs in descending timestamp order', async () => {
      const logs = await store.queryAuditLog();
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          logs[i].timestamp.getTime()
        );
      }
    });
  });

  describe('getApprovalHistory', () => {
    beforeEach(async () => {
      // Set up approval test data
      const entries = [
        createTestAuditEntry(task1.id, {
          eventType: 'task.approved',
          actor: 'approver1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        }),
        createTestAuditEntry(task1.id, {
          eventType: 'task.rejected',
          actor: 'approver2',
          timestamp: new Date('2024-01-02T10:00:00Z'),
        }),
        createTestAuditEntry(task2.id, {
          eventType: 'stage.approved',
          actor: 'approver1',
          timestamp: new Date('2024-01-03T10:00:00Z'),
        }),
        createTestAuditEntry(task2.id, {
          eventType: 'stage.rejected',
          actor: 'approver3',
          timestamp: new Date('2024-01-04T10:00:00Z'),
        }),
        createTestAuditEntry(task1.id, {
          eventType: 'task.created',
          actor: 'system',
          timestamp: new Date('2024-01-05T10:00:00Z'),
        }),
      ];

      for (const entry of entries) {
        await store.addAuditLog(entry);
      }
    });

    test('should return all approval-related events when no approver specified', async () => {
      const history = await store.getApprovalHistory();
      expect(history).toHaveLength(4);

      const eventTypes = history.map(entry => entry.eventType);
      expect(eventTypes).toContain('task.approved');
      expect(eventTypes).toContain('task.rejected');
      expect(eventTypes).toContain('stage.approved');
      expect(eventTypes).toContain('stage.rejected');
      expect(eventTypes).not.toContain('task.created');
    });

    test('should filter by approver when specified', async () => {
      const history = await store.getApprovalHistory('approver1');
      expect(history).toHaveLength(2);
      expect(history.every(entry => entry.actor === 'approver1')).toBe(true);
    });

    test('should return empty array for non-existent approver', async () => {
      const history = await store.getApprovalHistory('non-existent-approver');
      expect(history).toEqual([]);
    });

    test('should return history in descending timestamp order', async () => {
      const history = await store.getApprovalHistory();
      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          history[i].timestamp.getTime()
        );
      }
    });

    test('should only include approval/rejection event types', async () => {
      const history = await store.getApprovalHistory();
      const allowedEventTypes = ['task.approved', 'task.rejected', 'stage.approved', 'stage.rejected'];

      for (const entry of history) {
        expect(allowedEventTypes).toContain(entry.eventType);
      }
    });
  });

  describe('method return type consistency', () => {
    test('all methods should return properly typed AuditLogEntry arrays', async () => {
      const entry = createTestAuditEntry(task1.id);
      await store.addAuditLog(entry);

      const getAuditLogResult = await store.getAuditLog(task1.id);
      const queryAuditLogResult = await store.queryAuditLog({ taskId: task1.id });
      const approvalHistoryResult = await store.getApprovalHistory();

      // Verify all methods return arrays
      expect(Array.isArray(getAuditLogResult)).toBe(true);
      expect(Array.isArray(queryAuditLogResult)).toBe(true);
      expect(Array.isArray(approvalHistoryResult)).toBe(true);

      // Verify returned objects have expected AuditLogEntry properties
      for (const result of [getAuditLogResult, queryAuditLogResult]) {
        if (result.length > 0) {
          const firstEntry = result[0];
          expect(firstEntry).toHaveProperty('id');
          expect(firstEntry).toHaveProperty('taskId');
          expect(firstEntry).toHaveProperty('eventType');
          expect(firstEntry).toHaveProperty('severity');
          expect(firstEntry).toHaveProperty('timestamp');
          expect(firstEntry).toHaveProperty('actor');
          expect(firstEntry).toHaveProperty('message');
          expect(firstEntry).toHaveProperty('success');
        }
      }
    });
  });
});