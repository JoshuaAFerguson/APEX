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
  TaskStatus,
} from '@apexcli/core';

describe('TaskStore - Audit Logs Integration', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-integration-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestTask = async (suffix = ''): Promise<Task> => {
    const task: Task = {
      id: `task_${Date.now()}_${suffix}`,
      description: `Test task ${suffix}`,
      workflow: 'feature',
      autonomy: 'full',
      status: 'pending',
      priority: 'normal',
      projectPath: testDir,
      branchName: `apex/test-${suffix}`,
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

  const createAuditLog = async (
    taskId: string,
    eventType: AuditEventType,
    options: Partial<AuditLogEntry> = {}
  ): Promise<AuditLogEntry> => {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random()}`,
      taskId,
      eventType,
      severity: 'info',
      timestamp: new Date(),
      actor: 'test-actor',
      message: `${eventType} event`,
      success: true,
      ...options,
    };
    await store.addAuditLog(entry);
    return entry;
  };

  describe('Task lifecycle audit logging', () => {
    it('should maintain audit trail throughout task lifecycle', async () => {
      const task = await createTestTask('lifecycle');

      // Log task creation
      await createAuditLog(task.id, 'task.created', {
        message: 'Task created in planning stage',
        stage: 'planning',
        agent: 'planner',
      });

      // Log task start
      task.status = 'running';
      await store.updateTask(task.id, task);
      await createAuditLog(task.id, 'task.status_changed', {
        message: 'Task status changed to running',
        previousState: { status: 'pending' },
        newState: { status: 'running' },
        stage: 'implementation',
        agent: 'developer',
      });

      // Log some errors during execution
      await createAuditLog(task.id, 'task.error', {
        message: 'Compilation error during task execution',
        severity: 'error',
        success: false,
        error: 'TypeScript compilation failed',
        stage: 'implementation',
        agent: 'developer',
      });

      // Log task completion
      task.status = 'completed';
      await store.updateTask(task.id, task);
      await createAuditLog(task.id, 'task.completed', {
        message: 'Task completed successfully',
        stage: 'testing',
        agent: 'tester',
        durationMs: 45000,
      });

      // Verify complete audit trail
      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(4);

      // Verify chronological order (newest first)
      const eventTypes = logs.map(log => log.eventType);
      expect(eventTypes).toEqual([
        'task.completed',
        'task.error',
        'task.status_changed',
        'task.created',
      ]);

      // Verify stage progression
      const stages = logs.map(log => log.stage).filter(Boolean);
      expect(stages).toEqual(['testing', 'implementation', 'implementation', 'planning']);

      // Verify agent involvement
      const agents = logs.map(log => log.agent).filter(Boolean);
      expect(agents).toEqual(['tester', 'developer', 'developer', 'planner']);
    });

    it('should track task state changes accurately', async () => {
      const task = await createTestTask('state-changes');

      const statusProgression: TaskStatus[] = ['running', 'paused', 'running', 'completed'];

      let previousStatus: TaskStatus = 'pending';
      for (const status of statusProgression) {
        task.status = status;
        await store.updateTask(task.id, task);

        await createAuditLog(task.id, 'task.status_changed', {
          previousState: { status: previousStatus },
          newState: { status },
          message: `Status changed from ${previousStatus} to ${status}`,
        });

        previousStatus = status;
      }

      const statusChangeLogs = await store.getAuditLogs(task.id, {
        eventType: 'task.started',
      });

      expect(statusChangeLogs).toHaveLength(4);

      // Verify state transitions are recorded correctly
      const transitions = statusChangeLogs.reverse().map(log => ({
        from: log.previousState?.status,
        to: log.newState?.status,
      }));

      expect(transitions).toEqual([
        { from: 'pending', to: 'running' },
        { from: 'running', to: 'paused' },
        { from: 'paused', to: 'running' },
        { from: 'running', to: 'completed' },
      ]);
    });
  });

  describe('Multi-task audit correlation', () => {
    it('should support correlation between related tasks', async () => {
      const parentTask = await createTestTask('parent');
      const childTask1 = await createTestTask('child1');
      const childTask2 = await createTestTask('child2');

      const correlationId = `correlation_${Date.now()}`;
      const sessionId = `session_${Date.now()}`;

      // Log parent task creation
      await createAuditLog(parentTask.id, 'task.created', {
        correlationId,
        sessionId,
        message: 'Parent task created',
      });

      // Log child task creation with same correlation
      await createAuditLog(childTask1.id, 'task.created', {
        correlationId,
        sessionId,
        message: 'Child task 1 created',
        metadata: { parentTaskId: parentTask.id },
      });

      await createAuditLog(childTask2.id, 'task.created', {
        correlationId,
        sessionId,
        message: 'Child task 2 created',
        metadata: { parentTaskId: parentTask.id },
      });

      // Query by correlation ID to get related logs
      const correlatedLogs = await store.getAllAuditLogs({ correlationId });
      expect(correlatedLogs).toHaveLength(3);

      // Verify session grouping
      const sessionLogs = await store.getAllAuditLogs({ sessionId });
      expect(sessionLogs).toHaveLength(3);

      // Verify parent-child relationships in metadata
      const childLogs = correlatedLogs.filter(log => log.eventType === 'task.created' && log.metadata?.parentTaskId);
      childLogs.forEach(log => {
        expect(log.metadata?.parentTaskId).toBe(parentTask.id);
      });
    });

    it('should handle concurrent audit logging from multiple tasks', async () => {
      const tasks = await Promise.all([
        createTestTask('concurrent1'),
        createTestTask('concurrent2'),
        createTestTask('concurrent3'),
      ]);

      // Simulate concurrent audit logging
      const auditPromises = tasks.flatMap((task, index) =>
        Array.from({ length: 5 }, (_, eventIndex) =>
          createAuditLog(task.id, 'task.progress', {
            message: `Progress update ${eventIndex} for task ${index}`,
            metadata: { taskIndex: index, eventIndex },
          })
        )
      );

      await Promise.all(auditPromises);

      // Verify all logs were recorded correctly
      const allLogs = await store.getAllAuditLogs();
      expect(allLogs).toHaveLength(15); // 3 tasks × 5 events each

      // Verify logs are properly attributed to their tasks
      for (const task of tasks) {
        const taskLogs = await store.getAuditLogs(task.id);
        expect(taskLogs).toHaveLength(5);
      }
    });
  });

  describe('Performance and retention', () => {
    it('should handle large volume of audit logs efficiently', async () => {
      const task = await createTestTask('volume');
      const logCount = 1000;

      // Add many audit logs
      const startTime = Date.now();
      const promises = Array.from({ length: logCount }, (_, index) =>
        createAuditLog(task.id, 'task.progress', {
          message: `Progress update ${index}`,
          metadata: { iteration: index },
        })
      );

      await Promise.all(promises);
      const insertTime = Date.now() - startTime;

      // Query should still be fast
      const queryStart = Date.now();
      const logs = await store.getAuditLogs(task.id);
      const queryTime = Date.now() - queryStart;

      expect(logs).toHaveLength(logCount);
      expect(insertTime).toBeLessThan(5000); // Should insert 1000 logs in under 5 seconds
      expect(queryTime).toBeLessThan(500); // Should query in under 500ms
    });

    it('should efficiently clean up old audit logs', async () => {
      const task = await createTestTask('cleanup');

      // Add old logs (older than 30 days)
      const oldTimestamp = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < 50; i++) {
        await createAuditLog(task.id, 'task.legacy', {
          timestamp: oldTimestamp,
          message: `Old log ${i}`,
        });
      }

      // Add recent logs
      for (let i = 0; i < 50; i++) {
        await createAuditLog(task.id, 'task.recent', {
          message: `Recent log ${i}`,
        });
      }

      // Verify total count
      let allLogs = await store.getAuditLogs(task.id);
      expect(allLogs).toHaveLength(100);

      // Cleanup old logs
      const deletedCount = await store.cleanupAuditLogs(30);
      expect(deletedCount).toBe(50);

      // Verify only recent logs remain
      allLogs = await store.getAuditLogs(task.id);
      expect(allLogs).toHaveLength(50);
      allLogs.forEach(log => {
        expect(log.eventType).toBe('task.recent');
      });
    });
  });

  describe('Complex filtering and statistics', () => {
    it('should support complex audit log queries', async () => {
      const task = await createTestTask('complex-filtering');

      // Create logs with various combinations of attributes
      const testCases = [
        { eventType: 'task.created', severity: 'info', agent: 'planner', success: true },
        { eventType: 'task.error', severity: 'error', agent: 'developer', success: false },
        { eventType: 'task.warning', severity: 'warning', agent: 'developer', success: true },
        { eventType: 'task.completed', severity: 'info', agent: 'tester', success: true },
        { eventType: 'task.failed', severity: 'error', agent: 'tester', success: false },
      ];

      for (const testCase of testCases) {
        await createAuditLog(task.id, testCase.eventType, {
          severity: testCase.severity,
          agent: testCase.agent,
          success: testCase.success,
        });
      }

      // Test complex filtering combinations
      const errorLogs = await store.getAuditLogs(task.id, {
        severity: 'error',
        success: false,
      });
      expect(errorLogs).toHaveLength(2);

      const developerLogs = await store.getAllAuditLogs({
        taskId: task.id,
        agent: 'developer',
      });
      expect(developerLogs).toHaveLength(2);

      const successfulLogs = await store.getAuditLogs(task.id, { success: true });
      expect(successfulLogs).toHaveLength(3);
    });

    it('should provide accurate audit log statistics', async () => {
      const tasks = await Promise.all([
        createTestTask('stats1'),
        createTestTask('stats2'),
      ]);

      // Create a variety of logs for statistics
      const logConfigs = [
        { taskId: tasks[0].id, eventType: 'task.created', severity: 'info' },
        { taskId: tasks[0].id, eventType: 'task.error', severity: 'error' },
        { taskId: tasks[1].id, eventType: 'task.created', severity: 'info' },
        { taskId: tasks[1].id, eventType: 'task.completed', severity: 'info' },
        { taskId: null, eventType: 'system.startup', severity: 'info' }, // System log
      ];

      for (const config of logConfigs) {
        await createAuditLog(
          config.taskId || '',
          config.eventType,
          {
            severity: config.severity,
            ...(config.taskId ? {} : { taskId: undefined }),
          }
        );
      }

      const stats = await store.getAuditLogStatistics();
      expect(stats.total).toBe(5);

      // Verify event type breakdown
      const eventTypeMap = new Map(
        stats.byEventType.map(item => [item.eventType, item.count])
      );
      expect(eventTypeMap.get('task.created')).toBe(2);
      expect(eventTypeMap.get('task.error')).toBe(1);
      expect(eventTypeMap.get('task.completed')).toBe(1);
      expect(eventTypeMap.get('system.startup')).toBe(1);

      // Verify severity breakdown
      const severityMap = new Map(
        stats.bySeverity.map(item => [item.severity, item.count])
      );
      expect(severityMap.get('info')).toBe(4);
      expect(severityMap.get('error')).toBe(1);
    });
  });

  describe('Database consistency and recovery', () => {
    it('should maintain audit log integrity during database operations', async () => {
      const task = await createTestTask('integrity');

      // Add some audit logs
      await createAuditLog(task.id, 'task.created');
      await createAuditLog(task.id, 'task.progress');

      // Verify logs exist
      let logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      // Close and reopen the store (simulating restart)
      await store.close();
      store = new TaskStore(testDir);
      await store.initialize();

      // Verify logs persist after restart
      logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      // Verify we can still add new logs
      await createAuditLog(task.id, 'task.resumed', {
        message: 'Task resumed after restart',
      });

      logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(3);
    });

    it('should handle concurrent access to audit logs', async () => {
      const task = await createTestTask('concurrent-access');

      // Simulate concurrent reads and writes
      const readPromises = Array.from({ length: 10 }, () =>
        store.getAuditLogs(task.id)
      );

      const writePromises = Array.from({ length: 10 }, (_, index) =>
        createAuditLog(task.id, 'task.concurrent', {
          message: `Concurrent log ${index}`,
        })
      );

      // Should not throw errors
      await Promise.all([...readPromises, ...writePromises]);

      const finalLogs = await store.getAuditLogs(task.id);
      expect(finalLogs).toHaveLength(10);
    });
  });
});