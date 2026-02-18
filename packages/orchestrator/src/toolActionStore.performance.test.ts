import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { TaskStore, ToolActionStore } from './store';
import type {
  Task,
  ToolAction,
  FileSnapshot,
  ToolActionRetentionConfig
} from '@apexcli/core';

describe('ToolActionStore Performance Tests', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_perf`,
    description: 'Performance test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/perf-test-branch',
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
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-perf-test-'));
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    testTask = createTestTask();
    await taskStore.addTask(testTask);

    toolActionStore = new ToolActionStore(taskStore, {
      maxActionsPerTask: 10000,
      maxAgeDays: 1,
      keepUndoneSnapshots: false,
      maxSnapshotStorageMB: 500,
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('high volume operations', () => {
    it('should handle large numbers of tool actions efficiently', async () => {
      const actionCount = 1000;
      const startTime = Date.now();

      // Create many tool actions
      const promises = [];
      for (let i = 0; i < actionCount; i++) {
        const execution = {
          callId: crypto.randomUUID(),
          toolName: `perfTool${i}`,
          input: { index: i, data: `test data for action ${i}` },
          taskId: testTask.id,
          agentName: 'perfAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: Math.floor(Math.random() * 100),
          result: { success: true, output: `result-${i}` },
          error: undefined,
          status: 'completed' as const,
        };

        promises.push(toolActionStore.recordToolAction(testTask.id, execution));
      }

      await Promise.all(promises);
      const recordingTime = Date.now() - startTime;

      // Verify all actions were recorded
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(actionCount);

      // Verify performance is reasonable (should complete within 10 seconds for 1000 actions)
      expect(recordingTime).toBeLessThan(10000);

      console.log(`Performance: Recorded ${actionCount} actions in ${recordingTime}ms`);
    });

    it('should handle large file snapshots efficiently', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB file
      const filePath = path.join(testDir, 'large-perf-test.txt');
      await fs.writeFile(filePath, largeContent, 'utf8');

      const startTime = Date.now();

      // Create multiple snapshots of the large file
      const snapshotCount = 10;
      const snapshots = [];

      for (let i = 0; i < snapshotCount; i++) {
        const snapshot = await toolActionStore.createFileSnapshot(filePath, { iteration: i });
        snapshots.push(snapshot);
      }

      const snapshotTime = Date.now() - startTime;

      // Verify checksums are consistent
      const firstChecksum = snapshots[0].checksum;
      expect(snapshots.every(s => s.checksum === firstChecksum)).toBe(true);

      // Performance should be reasonable
      expect(snapshotTime).toBeLessThan(5000); // 5 seconds for 10MB total

      console.log(`Performance: Created ${snapshotCount} large file snapshots in ${snapshotTime}ms`);
    });

    it('should handle concurrent access under load', async () => {
      const concurrentTasks = 5;
      const actionsPerTask = 100;

      // Create multiple tasks
      const tasks = [];
      for (let i = 0; i < concurrentTasks; i++) {
        const task = createTestTask();
        task.id = `task_concurrent_${i}`;
        await taskStore.addTask(task);
        tasks.push(task);
      }

      const startTime = Date.now();

      // Create actions concurrently across multiple tasks
      const allPromises = [];

      for (const task of tasks) {
        for (let i = 0; i < actionsPerTask; i++) {
          const execution = {
            callId: crypto.randomUUID(),
            toolName: `concurrentTool${i}`,
            input: { taskId: task.id, index: i },
            taskId: task.id,
            agentName: 'concurrentAgent',
            stageName: 'testing',
            startTime: new Date(),
            endTime: new Date(),
            duration: 50,
            result: { success: true },
            error: undefined,
            status: 'completed' as const,
          };

          allPromises.push(toolActionStore.recordToolAction(task.id, execution));
        }
      }

      await Promise.all(allPromises);
      const totalTime = Date.now() - startTime;

      // Verify all actions were recorded correctly
      for (const task of tasks) {
        const actions = await toolActionStore.getToolActions(task.id);
        expect(actions).toHaveLength(actionsPerTask);

        // Verify sequence numbers are unique and sequential
        const sequenceNumbers = actions.map(a => a.sequenceNumber).sort((a, b) => a - b);
        for (let i = 0; i < sequenceNumbers.length; i++) {
          expect(sequenceNumbers[i]).toBe(i);
        }
      }

      console.log(`Performance: Concurrent access with ${concurrentTasks * actionsPerTask} total actions in ${totalTime}ms`);
    });
  });

  describe('cleanup performance', () => {
    it('should clean up large datasets efficiently', async () => {
      // Create many actions with file snapshots
      const actionCount = 500;
      const testFile = path.join(testDir, 'cleanup-test.txt');

      for (let i = 0; i < actionCount; i++) {
        await fs.writeFile(testFile, `Content ${i}`, 'utf8');

        const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
        await fs.writeFile(testFile, `Modified ${i}`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

        const execution = {
          callId: crypto.randomUUID(),
          toolName: `cleanupTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          agentName: 'cleanupAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 25,
          result: { success: true },
          error: undefined,
          status: 'completed' as const,
        };

        await toolActionStore.recordToolAction(
          testTask.id,
          execution,
          [testFile],
          [beforeSnapshot],
          [afterSnapshot]
        );
      }

      // Verify actions exist
      let actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(actionCount);

      // Perform cleanup with tight limits
      const limitedStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: 50,
        maxAgeDays: 0.001, // Very short retention
        keepUndoneSnapshots: false,
        maxSnapshotStorageMB: 1,
      });

      const cleanupStart = Date.now();
      await limitedStore.cleanup(testTask.id);
      const cleanupTime = Date.now() - cleanupStart;

      // Verify cleanup worked
      actions = await limitedStore.getToolActions(testTask.id);
      expect(actions.length).toBeLessThanOrEqual(50);

      // Cleanup should be reasonably fast
      expect(cleanupTime).toBeLessThan(2000);

      console.log(`Performance: Cleaned up ${actionCount} actions in ${cleanupTime}ms`);
    });
  });

  describe('memory usage', () => {
    it('should not leak memory with many snapshots', async () => {
      const testFile = path.join(testDir, 'memory-test.txt');
      const content = 'Memory test content that is not too large but significant enough';
      await fs.writeFile(testFile, content, 'utf8');

      // Track initial memory
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many snapshots
      const snapshotCount = 1000;
      for (let i = 0; i < snapshotCount; i++) {
        await toolActionStore.createFileSnapshot(testFile, { iteration: i });

        // Force garbage collection every 100 snapshots if available
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Check memory usage after snapshots
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerSnapshot = memoryIncrease / snapshotCount;

      // Memory per snapshot should be reasonable (less than 10KB per snapshot)
      expect(memoryPerSnapshot).toBeLessThan(10 * 1024);

      console.log(`Memory: ${memoryPerSnapshot} bytes per snapshot average`);
    });
  });

  describe('database query performance', () => {
    it('should efficiently query actions with pagination', async () => {
      const actionCount = 2000;

      // Create many actions
      for (let i = 0; i < actionCount; i++) {
        const execution = {
          callId: crypto.randomUUID(),
          toolName: `queryTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          agentName: 'queryAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 10,
          result: { success: true },
          error: undefined,
          status: 'completed' as const,
        };

        await toolActionStore.recordToolAction(testTask.id, execution);
      }

      // Test pagination performance
      const pageSize = 50;
      const pageCount = 10;
      const queryStart = Date.now();

      for (let page = 0; page < pageCount; page++) {
        const actions = await toolActionStore.getToolActions(
          testTask.id,
          pageSize,
          page * pageSize
        );
        expect(actions).toHaveLength(pageSize);
      }

      const queryTime = Date.now() - queryStart;

      // Queries should be fast
      expect(queryTime).toBeLessThan(1000);

      console.log(`Performance: ${pageCount} paginated queries in ${queryTime}ms`);
    });

    it('should efficiently calculate storage statistics', async () => {
      const testFile = path.join(testDir, 'stats-test.txt');
      const actionCount = 100;

      // Create actions with snapshots
      for (let i = 0; i < actionCount; i++) {
        const content = `Test content iteration ${i} with some additional data`;
        await fs.writeFile(testFile, content, 'utf8');

        const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
        await fs.writeFile(testFile, `${content} - modified`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

        const execution = {
          callId: crypto.randomUUID(),
          toolName: `statsTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          agentName: 'statsAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 15,
          result: { success: true },
          error: undefined,
          status: 'completed' as const,
        };

        await toolActionStore.recordToolAction(
          testTask.id,
          execution,
          [testFile],
          [beforeSnapshot],
          [afterSnapshot]
        );
      }

      // Test statistics calculation performance
      const statsStart = Date.now();
      const stats = await toolActionStore.getStorageStats(testTask.id);
      const statsTime = Date.now() - statsStart;

      expect(stats.totalActions).toBe(actionCount);
      expect(stats.totalSnapshots).toBeGreaterThan(0);
      expect(stats.storageUsageMB).toBeGreaterThan(0);

      // Statistics calculation should be fast
      expect(statsTime).toBeLessThan(500);

      console.log(`Performance: Storage statistics calculated in ${statsTime}ms`);
    });
  });
});