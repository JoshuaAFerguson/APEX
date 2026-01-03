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
  ToolActionRetentionConfig,
  ToolExecution
} from '@apexcli/core';

describe('ToolActionStore Coverage Tests', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_coverage`,
    description: 'Coverage test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/coverage-test-branch',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-coverage-test-'));
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    testTask = createTestTask();
    await taskStore.addTask(testTask);

    toolActionStore = new ToolActionStore(taskStore);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('API method coverage', () => {
    it('should cover all public ToolActionStore methods', async () => {
      // Test createFileSnapshot method
      const testFile = path.join(testDir, 'api-test.txt');
      await fs.writeFile(testFile, 'API test content', 'utf8');

      const snapshot = await toolActionStore.createFileSnapshot(testFile, { test: 'metadata' });
      expect(snapshot).toBeDefined();
      expect(typeof snapshot.id).toBe('string');
      expect(typeof snapshot.filePath).toBe('string');
      expect(typeof snapshot.content).toBe('string');
      expect(typeof snapshot.checksum).toBe('string');
      expect(typeof snapshot.fileSize).toBe('number');
      expect(snapshot.lastModified).toBeInstanceOf(Date);
      expect(snapshot.snapshotTime).toBeInstanceOf(Date);
      expect(snapshot.metadata).toBeDefined();

      // Test recordToolAction method with all parameters
      const execution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'apiTestTool',
        input: { test: 'input' },
        taskId: testTask.id,
        agentName: 'apiAgent',
        stageName: 'testing',
        startTime: new Date(),
        endTime: new Date(),
        duration: 150,
        result: { success: true, data: 'result' },
        error: undefined,
        status: 'completed',
        metadata: { apiTest: true },
      };

      await fs.writeFile(testFile, 'Modified content', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [testFile],
        [snapshot],
        [afterSnapshot],
        'api-test-group'
      );

      expect(action).toBeDefined();
      expect(action.id).toBeDefined();
      expect(action.execution).toEqual(execution);
      expect(action.modifiedFiles).toEqual([testFile]);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);
      expect(action.canUndo).toBe(true);
      expect(action.wasUndone).toBe(false);
      expect(action.sequenceNumber).toBe(0);
      expect(action.actionGroup).toBe('api-test-group');

      // Test getToolActions method with all parameters
      const allActions = await toolActionStore.getToolActions(testTask.id);
      expect(allActions).toHaveLength(1);

      const limitedActions = await toolActionStore.getToolActions(testTask.id, 1);
      expect(limitedActions).toHaveLength(1);

      const offsetActions = await toolActionStore.getToolActions(testTask.id, 10, 1);
      expect(offsetActions).toHaveLength(0);

      // Test getUndoableActions method
      const undoableActions = await toolActionStore.getUndoableActions(testTask.id);
      expect(undoableActions).toHaveLength(1);
      expect(undoableActions[0].canUndo).toBe(true);
      expect(undoableActions[0].wasUndone).toBe(false);

      // Test undoAction method
      await toolActionStore.undoAction(testTask.id, action.id);

      const updatedActions = await toolActionStore.getToolActions(testTask.id);
      expect(updatedActions[0].wasUndone).toBe(true);
      expect(updatedActions[0].undoneAt).toBeInstanceOf(Date);

      // Test undoLastAction method with no undoable actions
      await expect(toolActionStore.undoLastAction(testTask.id))
        .rejects.toThrow('No undoable actions found for task');

      // Test getStorageStats method for specific task
      const taskStats = await toolActionStore.getStorageStats(testTask.id);
      expect(taskStats).toBeDefined();
      expect(typeof taskStats.totalActions).toBe('number');
      expect(typeof taskStats.totalSnapshots).toBe('number');
      expect(typeof taskStats.storageUsageMB).toBe('number');

      // Test getStorageStats method for all tasks
      const allStats = await toolActionStore.getStorageStats();
      expect(allStats).toBeDefined();
      expect(allStats.totalActions).toBeGreaterThanOrEqual(taskStats.totalActions);

      // Test cleanup method for specific task
      await toolActionStore.cleanup(testTask.id);

      // Test cleanup method for all tasks
      await toolActionStore.cleanup();
    });

    it('should cover all ToolExecution status values', async () => {
      const statuses: Array<ToolExecution['status']> = [
        'pending',
        'in_progress',
        'completed',
        'failed',
        'cancelled'
      ];

      for (const status of statuses) {
        const execution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: `statusTest_${status}`,
          input: { status },
          taskId: testTask.id,
          agentName: 'statusAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: status === 'pending' ? undefined : new Date(),
          duration: status === 'pending' ? undefined : 100,
          result: status === 'completed' ? { success: true } : undefined,
          error: status === 'failed' ? 'Test error' : undefined,
          status,
        };

        const action = await toolActionStore.recordToolAction(testTask.id, execution);
        expect(action.execution.status).toBe(status);
      }

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(statuses.length);
    });
  });

  describe('data type coverage', () => {
    it('should handle all possible ToolExecution field combinations', async () => {
      // Test minimal execution
      const minimalExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'minimalTool',
        input: {},
        taskId: testTask.id,
        startTime: new Date(),
        status: 'pending',
      };

      let action = await toolActionStore.recordToolAction(testTask.id, minimalExecution);
      expect(action.execution.agentName).toBeUndefined();
      expect(action.execution.stageName).toBeUndefined();
      expect(action.execution.endTime).toBeUndefined();
      expect(action.execution.duration).toBeUndefined();
      expect(action.execution.result).toBeUndefined();
      expect(action.execution.error).toBeUndefined();
      expect(action.execution.metadata).toBeUndefined();

      // Test maximal execution
      const maximalExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'maximalTool',
        input: {
          stringField: 'test',
          numberField: 42,
          booleanField: true,
          arrayField: [1, 2, 3],
          objectField: { nested: { value: 'deep' } },
          nullField: null,
        },
        taskId: testTask.id,
        agentName: 'maximalAgent',
        stageName: 'maximalStage',
        startTime: new Date(),
        endTime: new Date(),
        duration: 250,
        result: {
          success: true,
          data: {
            complex: {
              structure: ['with', 'nested', 'arrays'],
              numbers: [1.1, 2.2, 3.3],
              flags: { flag1: true, flag2: false },
            },
          },
        },
        error: undefined,
        status: 'completed',
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          tags: ['test', 'coverage', 'maximal'],
          config: {
            enableFeatureA: true,
            maxRetries: 3,
          },
        },
      };

      action = await toolActionStore.recordToolAction(testTask.id, maximalExecution);
      expect(action.execution).toEqual(maximalExecution);

      // Test failed execution
      const failedExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'failedTool',
        input: { attempt: 'doomed to fail' },
        taskId: testTask.id,
        agentName: 'failureAgent',
        stageName: 'failure',
        startTime: new Date(),
        endTime: new Date(),
        duration: 50,
        result: undefined,
        error: 'Intentional test failure with detailed error message',
        status: 'failed',
        metadata: {
          errorCode: 'TEST_FAILURE',
          retryable: false,
        },
      };

      action = await toolActionStore.recordToolAction(testTask.id, failedExecution);
      expect(action.execution.error).toBe('Intentional test failure with detailed error message');
      expect(action.execution.result).toBeUndefined();
    });

    it('should handle all FileSnapshot metadata variations', async () => {
      const testFile = path.join(testDir, 'metadata-test.txt');
      await fs.writeFile(testFile, 'Metadata test content', 'utf8');

      // Test with no metadata
      let snapshot = await toolActionStore.createFileSnapshot(testFile);
      expect(snapshot.metadata).toBeUndefined();

      // Test with empty metadata
      snapshot = await toolActionStore.createFileSnapshot(testFile, {});
      expect(snapshot.metadata).toEqual({});

      // Test with simple metadata
      snapshot = await toolActionStore.createFileSnapshot(testFile, {
        simple: 'value',
        number: 123,
        boolean: true,
      });
      expect(snapshot.metadata).toEqual({
        simple: 'value',
        number: 123,
        boolean: true,
      });

      // Test with complex nested metadata
      const complexMetadata = {
        level1: {
          level2: {
            level3: {
              deepValue: 'found',
              array: [
                { item: 1, active: true },
                { item: 2, active: false },
              ],
            },
          },
        },
        topLevelArray: ['a', 'b', 'c'],
        mixedTypes: {
          string: 'text',
          number: 42.5,
          boolean: false,
          nullValue: null,
          date: new Date().toISOString(),
        },
      };

      snapshot = await toolActionStore.createFileSnapshot(testFile, complexMetadata);
      expect(snapshot.metadata).toEqual(complexMetadata);
    });

    it('should handle all ToolActionRetentionConfig combinations', async () => {
      // Test default configuration
      const defaultStore = new ToolActionStore(taskStore);
      // Default values should be used (can't directly test private config, but behavior should be consistent)

      // Test minimal configuration
      const minimalStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: 1,
      });

      // Test maximal configuration
      const maximalStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: 10000,
        maxAgeDays: 365,
        keepUndoneSnapshots: true,
        maxSnapshotStorageMB: 1000,
      });

      // Test all stores work with same operations
      const execution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'configTool',
        input: {},
        taskId: testTask.id,
        startTime: new Date(),
        status: 'completed',
      };

      const stores = [defaultStore, minimalStore, maximalStore];
      for (const store of stores) {
        const action = await store.recordToolAction(testTask.id, execution);
        expect(action).toBeDefined();

        const actions = await store.getToolActions(testTask.id);
        expect(actions).toHaveLength(1);

        await store.cleanup(testTask.id);
      }
    });
  });

  describe('error path coverage', () => {
    it('should cover all error conditions in createFileSnapshot', async () => {
      // Non-existent file
      await expect(toolActionStore.createFileSnapshot('/nonexistent/path/file.txt'))
        .rejects.toThrow('File not found:');

      // Directory instead of file
      await expect(toolActionStore.createFileSnapshot(testDir))
        .rejects.toThrow();

      // Invalid path characters (depending on OS)
      const invalidPath = path.join(testDir, 'invalid\x00file.txt');
      await expect(toolActionStore.createFileSnapshot(invalidPath))
        .rejects.toThrow();
    });

    it('should cover all error conditions in undo operations', async () => {
      // Undo non-existent action
      await expect(toolActionStore.undoAction(testTask.id, 'nonexistent-action-id'))
        .rejects.toThrow('Tool action not found');

      // Undo last action when none exist
      await expect(toolActionStore.undoLastAction(testTask.id))
        .rejects.toThrow('No undoable actions found for task');

      // Create non-undoable action and try to undo
      const execution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'nonUndoableTool',
        input: {},
        taskId: testTask.id,
        startTime: new Date(),
        status: 'completed',
      };

      const action = await toolActionStore.recordToolAction(testTask.id, execution);
      expect(action.canUndo).toBe(false);

      await expect(toolActionStore.undoAction(testTask.id, action.id))
        .rejects.toThrow('Action cannot be undone');

      // Create undoable action, undo it, then try to undo again
      const testFile = path.join(testDir, 'undo-error-test.txt');
      await fs.writeFile(testFile, 'Original', 'utf8');

      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
      await fs.writeFile(testFile, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

      const undoableExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'undoableTool',
        input: {},
        taskId: testTask.id,
        startTime: new Date(),
        status: 'completed',
      };

      const undoableAction = await toolActionStore.recordToolAction(
        testTask.id,
        undoableExecution,
        [testFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      await toolActionStore.undoAction(testTask.id, undoableAction.id);

      await expect(toolActionStore.undoAction(testTask.id, undoableAction.id))
        .rejects.toThrow('Action has already been undone');

      // Try to undo action from different task
      const otherTask = createTestTask();
      otherTask.id = 'other-task-id';
      await taskStore.addTask(otherTask);

      await expect(toolActionStore.undoAction(otherTask.id, undoableAction.id))
        .rejects.toThrow('Action does not belong to specified task');
    });

    it('should cover error conditions in cleanup operations', async () => {
      // Create store with invalid retention config values (should handle gracefully)
      const invalidStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: -1, // Invalid negative value
        maxAgeDays: 0,         // Zero days
        keepUndoneSnapshots: true,
        maxSnapshotStorageMB: -1, // Invalid negative value
      } as any);

      // Should still work despite invalid config
      const execution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'invalidConfigTool',
        input: {},
        taskId: testTask.id,
        startTime: new Date(),
        status: 'completed',
      };

      // These operations should not throw despite invalid config
      const action = await invalidStore.recordToolAction(testTask.id, execution);
      expect(action).toBeDefined();

      await expect(invalidStore.cleanup(testTask.id)).resolves.not.toThrow();
      await expect(invalidStore.cleanup()).resolves.not.toThrow();
    });
  });

  describe('boundary value coverage', () => {
    it('should handle edge case values in sequence numbers', async () => {
      // Test sequence number boundary conditions by creating many actions
      const actionCount = 1000;
      const actions = [];

      for (let i = 0; i < actionCount; i++) {
        const execution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: `boundaryTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          startTime: new Date(),
          status: 'completed',
        };

        const action = await toolActionStore.recordToolAction(testTask.id, execution);
        actions.push(action);

        expect(action.sequenceNumber).toBe(i);
      }

      // Verify sequence integrity
      const retrievedActions = await toolActionStore.getToolActions(testTask.id);
      expect(retrievedActions).toHaveLength(actionCount);

      const sequenceNumbers = retrievedActions.map(a => a.sequenceNumber).sort((a, b) => a - b);
      for (let i = 0; i < sequenceNumbers.length; i++) {
        expect(sequenceNumbers[i]).toBe(i);
      }
    });

    it('should handle edge cases in pagination', async () => {
      const actionCount = 10;

      // Create test actions
      for (let i = 0; i < actionCount; i++) {
        const execution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: `pageTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          startTime: new Date(),
          status: 'completed',
        };

        await toolActionStore.recordToolAction(testTask.id, execution);
      }

      // Test edge cases in pagination

      // Limit = 0 (should return empty array)
      let actions = await toolActionStore.getToolActions(testTask.id, 0);
      expect(actions).toHaveLength(0);

      // Limit > total actions
      actions = await toolActionStore.getToolActions(testTask.id, 50);
      expect(actions).toHaveLength(actionCount);

      // Offset > total actions
      actions = await toolActionStore.getToolActions(testTask.id, 10, 50);
      expect(actions).toHaveLength(0);

      // Offset = total actions
      actions = await toolActionStore.getToolActions(testTask.id, 10, actionCount);
      expect(actions).toHaveLength(0);

      // Large limit and offset values
      actions = await toolActionStore.getToolActions(testTask.id, Number.MAX_SAFE_INTEGER, 0);
      expect(actions).toHaveLength(actionCount);

      // Negative values (should be handled gracefully)
      actions = await toolActionStore.getToolActions(testTask.id, -1, -1);
      expect(actions).toHaveLength(actionCount); // Should behave as no limit/offset
    });

    it('should handle storage statistics edge cases', async () => {
      // Test statistics for task with no actions
      let stats = await toolActionStore.getStorageStats(testTask.id);
      expect(stats.totalActions).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.storageUsageMB).toBe(0);

      // Test statistics for non-existent task
      stats = await toolActionStore.getStorageStats('nonexistent-task');
      expect(stats.totalActions).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.storageUsageMB).toBe(0);

      // Test overall statistics with no actions
      stats = await toolActionStore.getStorageStats();
      expect(stats.totalActions).toBeGreaterThanOrEqual(0);
      expect(stats.totalSnapshots).toBeGreaterThanOrEqual(0);
      expect(stats.storageUsageMB).toBeGreaterThanOrEqual(0);

      // Create action with snapshots and verify statistics
      const testFile = path.join(testDir, 'stats-edge-test.txt');
      await fs.writeFile(testFile, 'Stats test content', 'utf8');

      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
      await fs.writeFile(testFile, 'Modified stats content', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

      const execution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'statsTool',
        input: {},
        taskId: testTask.id,
        startTime: new Date(),
        status: 'completed',
      };

      await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [testFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      stats = await toolActionStore.getStorageStats(testTask.id);
      expect(stats.totalActions).toBe(1);
      expect(stats.totalSnapshots).toBeGreaterThan(0);
      expect(stats.storageUsageMB).toBeGreaterThan(0);
    });
  });
});