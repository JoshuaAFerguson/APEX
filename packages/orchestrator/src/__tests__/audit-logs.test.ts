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

describe('TaskStore - Audit Logs', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    // Create a temporary directory for the test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestTask = async (): Promise<Task> => {
    const task: Task = {
      id: `task_${Date.now()}_audit`,
      description: 'Test task for audit logging',
      workflow: 'feature',
      autonomy: 'full',
      status: 'pending',
      priority: 'normal',
      projectPath: testDir,
      branchName: 'apex/audit-test',
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

  const createTestAuditLogEntry = (taskId?: string): AuditLogEntry => ({
    id: `audit_${Date.now()}_${Math.random()}`,
    taskId,
    eventType: 'task.created',
    severity: 'info',
    timestamp: new Date(),
    actor: 'test-agent',
    message: 'Test audit log entry',
    stage: 'planning',
    agent: 'planner',
    metadata: { test: 'data' },
    success: true,
    correlationId: 'test-correlation',
    sessionId: 'test-session',
  });

  describe('addAuditLog', () => {
    it('should add an audit log entry successfully', async () => {
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);

      await store.addAuditLog(auditEntry);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: auditEntry.id,
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        actor: 'test-agent',
        message: 'Test audit log entry',
        stage: 'planning',
        agent: 'planner',
        success: true,
        correlationId: 'test-correlation',
        sessionId: 'test-session',
      });
      expect(logs[0].metadata).toEqual({ test: 'data' });
    });

    it('should add system-wide audit log entry without taskId', async () => {
      const auditEntry = createTestAuditLogEntry();
      auditEntry.eventType = 'config.updated';
      auditEntry.message = 'System started';

      await store.addAuditLog(auditEntry);

      const logs = await store.getAllAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        eventType: 'config.updated',
        message: 'System started',
      });
      expect(logs[0].taskId).toBeUndefined();
    });

    it('should handle audit log with duration and state changes', async () => {
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);
      auditEntry.eventType = 'task.started';
      auditEntry.previousState = { status: 'pending' };
      auditEntry.newState = { status: 'running' };
      auditEntry.durationMs = 1500;

      await store.addAuditLog(auditEntry);

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0]).toMatchObject({
        eventType: 'task.started',
        durationMs: 1500,
      });
      expect(logs[0].previousState).toEqual({ status: 'pending' });
      expect(logs[0].newState).toEqual({ status: 'running' });
    });

    it('should handle audit log with error information', async () => {
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);
      auditEntry.success = false;
      auditEntry.error = 'Test error occurred';
      auditEntry.severity = 'error';

      await store.addAuditLog(auditEntry);

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0]).toMatchObject({
        success: false,
        error: 'Test error occurred',
        severity: 'error',
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should return empty array for task with no audit logs', async () => {
      const task = await createTestTask();
      const logs = await store.getAuditLogs(task.id);
      expect(logs).toEqual([]);
    });

    it('should filter logs by event type', async () => {
      const task = await createTestTask();

      // Add multiple audit logs with different event types
      const entry1 = createTestAuditLogEntry(task.id);
      entry1.eventType = 'task.created';

      const entry2 = createTestAuditLogEntry(task.id);
      entry2.eventType = 'task.completed';

      await store.addAuditLog(entry1);
      await store.addAuditLog(entry2);

      const createdLogs = await store.getAuditLogs(task.id, { eventType: 'task.created' });
      expect(createdLogs).toHaveLength(1);
      expect(createdLogs[0].eventType).toBe('task.created');

      const completedLogs = await store.getAuditLogs(task.id, { eventType: 'task.completed' });
      expect(completedLogs).toHaveLength(1);
      expect(completedLogs[0].eventType).toBe('task.completed');
    });

    it('should filter logs by severity', async () => {
      const task = await createTestTask();

      const infoEntry = createTestAuditLogEntry(task.id);
      infoEntry.severity = 'info';

      const errorEntry = createTestAuditLogEntry(task.id);
      errorEntry.severity = 'error';

      await store.addAuditLog(infoEntry);
      await store.addAuditLog(errorEntry);

      const errorLogs = await store.getAuditLogs(task.id, { severity: 'error' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].severity).toBe('error');
    });

    it('should filter logs by success status', async () => {
      const task = await createTestTask();

      const successEntry = createTestAuditLogEntry(task.id);
      successEntry.success = true;

      const failureEntry = createTestAuditLogEntry(task.id);
      failureEntry.success = false;

      await store.addAuditLog(successEntry);
      await store.addAuditLog(failureEntry);

      const failureLogs = await store.getAuditLogs(task.id, { success: false });
      expect(failureLogs).toHaveLength(1);
      expect(failureLogs[0].success).toBe(false);
    });

    it('should filter logs by date range', async () => {
      const task = await createTestTask();

      const oldDate = new Date('2024-01-01');
      const recentDate = new Date();

      const oldEntry = createTestAuditLogEntry(task.id);
      oldEntry.timestamp = oldDate;

      const recentEntry = createTestAuditLogEntry(task.id);
      recentEntry.timestamp = recentDate;

      await store.addAuditLog(oldEntry);
      await store.addAuditLog(recentEntry);

      // Filter for recent logs only
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const recentLogs = await store.getAuditLogs(task.id, { startDate });
      expect(recentLogs).toHaveLength(1);
      expect(recentLogs[0].timestamp.getTime()).toBeGreaterThan(startDate.getTime());
    });

    it('should limit and offset results', async () => {
      const task = await createTestTask();

      // Add multiple audit logs
      for (let i = 0; i < 5; i++) {
        const entry = createTestAuditLogEntry(task.id);
        entry.id = `audit_${i}`;
        entry.message = `Entry ${i}`;
        await store.addAuditLog(entry);
      }

      // Test limit
      const limitedLogs = await store.getAuditLogs(task.id, { limit: 3 });
      expect(limitedLogs).toHaveLength(3);

      // Test offset
      const offsetLogs = await store.getAuditLogs(task.id, { offset: 2, limit: 2 });
      expect(offsetLogs).toHaveLength(2);
    });

    it('should sort logs by timestamp descending by default', async () => {
      const task = await createTestTask();

      const timestamps = [
        new Date('2024-01-01'),
        new Date('2024-01-03'),
        new Date('2024-01-02'),
      ];

      for (let i = 0; i < timestamps.length; i++) {
        const entry = createTestAuditLogEntry(task.id);
        entry.timestamp = timestamps[i];
        entry.message = `Entry ${i}`;
        await store.addAuditLog(entry);
      }

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(3);

      // Should be sorted by timestamp descending (newest first)
      expect(logs[0].timestamp.getTime()).toBeGreaterThan(logs[1].timestamp.getTime());
      expect(logs[1].timestamp.getTime()).toBeGreaterThan(logs[2].timestamp.getTime());
    });
  });

  describe('getAllAuditLogs', () => {
    it('should return all audit logs across all tasks', async () => {
      const task1 = await createTestTask();
      const task2 = await createTestTask();

      const entry1 = createTestAuditLogEntry(task1.id);
      const entry2 = createTestAuditLogEntry(task2.id);
      const systemEntry = createTestAuditLogEntry(); // No task ID

      await store.addAuditLog(entry1);
      await store.addAuditLog(entry2);
      await store.addAuditLog(systemEntry);

      const allLogs = await store.getAllAuditLogs();
      expect(allLogs).toHaveLength(3);
    });

    it('should filter across all logs by event type', async () => {
      const task1 = await createTestTask();
      const task2 = await createTestTask();

      const entry1 = createTestAuditLogEntry(task1.id);
      entry1.eventType = 'task.created';

      const entry2 = createTestAuditLogEntry(task2.id);
      entry2.eventType = 'task.completed';

      await store.addAuditLog(entry1);
      await store.addAuditLog(entry2);

      const createdLogs = await store.getAllAuditLogs({ eventType: 'task.created' });
      expect(createdLogs).toHaveLength(1);
      expect(createdLogs[0].eventType).toBe('task.created');
    });
  });

  describe('cleanupAuditLogs', () => {
    it('should delete old audit logs based on retention days', async () => {
      const task = await createTestTask();

      // Add old logs
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      const oldEntry = createTestAuditLogEntry(task.id);
      oldEntry.timestamp = oldDate;

      // Add recent logs
      const recentEntry = createTestAuditLogEntry(task.id);
      recentEntry.timestamp = new Date();

      await store.addAuditLog(oldEntry);
      await store.addAuditLog(recentEntry);

      // Cleanup logs older than 30 days
      const deletedCount = await store.cleanupAuditLogs(30);
      expect(deletedCount).toBe(1);

      const remainingLogs = await store.getAuditLogs(task.id);
      expect(remainingLogs).toHaveLength(1);
      expect(remainingLogs[0].timestamp.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should not delete recent logs within retention period', async () => {
      const task = await createTestTask();

      const recentEntry = createTestAuditLogEntry(task.id);
      await store.addAuditLog(recentEntry);

      const deletedCount = await store.cleanupAuditLogs(30);
      expect(deletedCount).toBe(0);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
    });
  });

  describe('getAuditLogStatistics', () => {
    it('should return statistics for audit logs', async () => {
      const task = await createTestTask();

      // Add logs with different event types and severities
      const entries = [
        { eventType: 'task.created', severity: 'info' },
        { eventType: 'task.created', severity: 'info' },
        { eventType: 'task.failed', severity: 'error' },
        { eventType: 'task.completed', severity: 'info' },
      ];

      for (const entryData of entries) {
        const entry = createTestAuditLogEntry(task.id);
        entry.eventType = entryData.eventType;
        entry.severity = entryData.severity;
        await store.addAuditLog(entry);
      }

      const stats = await store.getAuditLogStatistics();
      expect(stats.total).toBe(4);

      // Check event type breakdown
      const eventTypeMap = new Map(stats.byEventType.map(item => [item.eventType, item.count]));
      expect(eventTypeMap.get('task.created')).toBe(2);
      expect(eventTypeMap.get('task.failed')).toBe(1);
      expect(eventTypeMap.get('task.completed')).toBe(1);

      // Check severity breakdown
      const severityMap = new Map(stats.bySeverity.map(item => [item.severity, item.count]));
      expect(severityMap.get('info')).toBe(3);
      expect(severityMap.get('error')).toBe(1);
    });

    it('should return zero statistics when no logs exist', async () => {
      const stats = await store.getAuditLogStatistics();
      expect(stats.total).toBe(0);
      expect(stats.byEventType).toEqual([]);
      expect(stats.bySeverity).toEqual([]);
    });
  });

  describe('table schema and foreign key relationships', () => {
    it('should have proper foreign key relationship to tasks table', async () => {
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);

      await store.addAuditLog(auditEntry);

      // Verify the audit log was created with correct task reference
      const logs = await store.getAuditLogs(task.id);
      expect(logs[0].taskId).toBe(task.id);

      // Delete the task and verify orphaned audit logs can still be queried
      await store.deleteTask(task.id);

      // Audit logs should still exist even if task is deleted (no CASCADE)
      const orphanedLogs = await store.getAllAuditLogs({ taskId: task.id });
      expect(orphanedLogs).toHaveLength(1);
    });

    it('should create proper indexes for query performance', async () => {
      // This is more of a schema validation test
      // In a real implementation, you might check EXPLAIN QUERY PLAN
      // For now, we'll verify that queries work efficiently with multiple logs

      const task = await createTestTask();

      // Add many audit logs to test index performance
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const entry = createTestAuditLogEntry(task.id);
        entry.eventType = i % 2 === 0 ? 'task.created' : 'task.completed';
        entry.severity = i % 3 === 0 ? 'error' : 'info';
        promises.push(store.addAuditLog(entry));
      }
      await Promise.all(promises);

      // Test that filtered queries are still fast
      const start = Date.now();
      const errorLogs = await store.getAuditLogs(task.id, { severity: 'error' });
      const duration = Date.now() - start;

      expect(errorLogs.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be fast with proper indexes
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON in metadata gracefully', async () => {
      // This test verifies the store can handle edge cases in JSON serialization
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);

      // Test with complex metadata that might cause issues
      auditEntry.metadata = {
        circular: {} as any,
        date: new Date(),
        number: 42,
        nested: { deep: { object: 'value' } }
      };
      auditEntry.metadata.circular.ref = auditEntry.metadata.circular;

      // Should not throw even with circular reference (JSON.stringify handles this)
      await expect(store.addAuditLog(auditEntry)).resolves.not.toThrow();
    });

    it('should handle very long messages', async () => {
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);

      // Test with very long message
      auditEntry.message = 'x'.repeat(10000);

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);
      expect(logs[0].message).toHaveLength(10000);
    });

    it('should handle null and undefined values appropriately', async () => {
      const task = await createTestTask();
      const auditEntry = createTestAuditLogEntry(task.id);

      // Test with undefined/null optional fields
      auditEntry.stage = undefined;
      auditEntry.agent = undefined;
      auditEntry.metadata = undefined;
      auditEntry.previousState = undefined;
      auditEntry.newState = undefined;
      auditEntry.durationMs = undefined;
      auditEntry.error = undefined;
      auditEntry.correlationId = undefined;
      auditEntry.sessionId = undefined;

      await store.addAuditLog(auditEntry);
      const logs = await store.getAuditLogs(task.id);

      expect(logs[0].stage).toBeUndefined();
      expect(logs[0].agent).toBeUndefined();
      expect(logs[0].metadata).toBeUndefined();
    });
  });
});