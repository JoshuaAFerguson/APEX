import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import type { ApexConfig, Task, ToolAction } from '@apexcli/core';

describe('ToolActionStore Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let config: ApexConfig;

  const createTestConfig = (): ApexConfig => ({
    projectPath: testDir,
    agents: {},
    workflows: {},
    limits: {
      maxConcurrentTasks: 5,
      maxRetries: 3,
      timeoutMinutes: 30,
    },
    autonomy: {
      level: 'high',
      autoApprove: ['low', 'medium'],
      requireConfirmation: ['high', 'critical'],
      maxTokensPerTask: 100000,
      allowedTools: [],
    },
    notifications: {
      email: {
        enabled: false,
      },
      webhook: {
        enabled: false,
      },
    },
    // Configure tool action retention for testing
    toolActionRetention: {
      maxActionsPerTask: 100,
      maxAgeDays: 7,
      keepUndoneSnapshots: true,
      maxSnapshotStorageMB: 10,
    },
  });

  beforeEach(async () => {
    // Create temporary directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-test-'));

    // Create .apex directory
    const apexDir = path.join(testDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create config
    config = createTestConfig();

    // Write config file
    await fs.writeFile(
      path.join(apexDir, 'config.yaml'),
      `
projectPath: ${testDir}
limits:
  maxConcurrentTasks: 5
  maxRetries: 3
  timeoutMinutes: 30
autonomy:
  level: high
  autoApprove:
    - low
    - medium
  requireConfirmation:
    - high
    - critical
  maxTokensPerTask: 100000
  allowedTools: []
notifications:
  email:
    enabled: false
  webhook:
    enabled: false
toolActionRetention:
  maxActionsPerTask: 100
  maxAgeDays: 7
  keepUndoneSnapshots: true
  maxSnapshotStorageMB: 10
`,
      'utf8'
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(config);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (orchestrator) {
      await orchestrator.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('orchestrator integration', () => {
    it('should have access to tool action store from orchestrator', async () => {
      const toolActionStore = orchestrator.getToolActionStore();
      expect(toolActionStore).toBeDefined();
    });

    it('should use configured retention settings', async () => {
      const toolActionStore = orchestrator.getToolActionStore();

      // Create a test file
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Original content', 'utf8');

      // Create a file snapshot
      const snapshot = await toolActionStore.createFileSnapshot(testFile);

      expect(snapshot).toBeDefined();
      expect(snapshot.content).toBe('Original content');
    });

    it('should handle task lifecycle with tool action tracking', async () => {
      const task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        description: 'Test task with tool actions',
        workflow: 'feature',
        autonomy: 'high',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      };

      // Create task
      const createdTask = await orchestrator.store.addTask(task);
      expect(createdTask.id).toBeDefined();

      // Get tool action store and verify it can work with the task
      const toolActionStore = orchestrator.getToolActionStore();
      const actions = await toolActionStore.getToolActions(createdTask.id);

      expect(actions).toEqual([]);
    });
  });

  describe('file tracking integration', () => {
    it('should track file changes during task execution', async () => {
      // Create test files
      const sourceFile = path.join(testDir, 'source.txt');
      const targetFile = path.join(testDir, 'target.txt');

      await fs.writeFile(sourceFile, 'Source content', 'utf8');
      await fs.writeFile(targetFile, 'Original target content', 'utf8');

      const toolActionStore = orchestrator.getToolActionStore();

      // Simulate a tool action that modifies files
      const task = await orchestrator.store.addTask({
        description: 'File modification task',
        workflow: 'feature',
        autonomy: 'high',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      });

      // Create before snapshots
      const beforeSnapshot = await toolActionStore.createFileSnapshot(targetFile);

      // Modify the file
      await fs.writeFile(targetFile, 'Modified content', 'utf8');

      // Create after snapshot
      const afterSnapshot = await toolActionStore.createFileSnapshot(targetFile);

      // Record the tool action
      const mockExecution = {
        callId: 'test-call-id',
        toolName: 'fileModification',
        input: { source: sourceFile, target: targetFile },
        taskId: task.id,
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
      };

      const action = await toolActionStore.recordToolAction(
        task.id,
        mockExecution,
        [targetFile],
        [beforeSnapshot],
        [afterSnapshot],
        'file-operations'
      );

      expect(action.canUndo).toBe(true);
      expect(action.modifiedFiles).toEqual([targetFile]);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);

      // Verify we can retrieve the action
      const actions = await toolActionStore.getToolActions(task.id);
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(action.id);
    });

    it('should support undo operations in task context', async () => {
      const testFile = path.join(testDir, 'undo-test.txt');
      await fs.writeFile(testFile, 'Original content', 'utf8');

      const toolActionStore = orchestrator.getToolActionStore();

      const task = await orchestrator.store.addTask({
        description: 'Undo test task',
        workflow: 'feature',
        autonomy: 'high',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      });

      // Perform multiple file modifications
      const modifications = ['Modified 1', 'Modified 2', 'Modified 3'];
      const actions: ToolAction[] = [];

      for (let i = 0; i < modifications.length; i++) {
        const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
        await fs.writeFile(testFile, modifications[i], 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

        const mockExecution = {
          callId: `call-${i}`,
          toolName: `modification${i}`,
          input: { content: modifications[i] },
          taskId: task.id,
          startTime: new Date(),
          endTime: new Date(),
          duration: 50,
          result: { success: true },
        };

        const action = await toolActionStore.recordToolAction(
          task.id,
          mockExecution,
          [testFile],
          [beforeSnapshot],
          [afterSnapshot]
        );

        actions.push(action);
      }

      // Verify final state
      let content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Modified 3');

      // Undo the last action
      await toolActionStore.undoLastAction(task.id);
      content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Modified 2');

      // Undo the second-to-last action
      await toolActionStore.undoLastAction(task.id);
      content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Modified 1');

      // Undo the first action
      await toolActionStore.undoLastAction(task.id);
      content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Original content');

      // Verify no more undoable actions
      await expect(toolActionStore.undoLastAction(task.id))
        .rejects.toThrow('No undoable actions found for task');
    });
  });

  describe('storage and cleanup integration', () => {
    it('should respect configured retention policies during cleanup', async () => {
      const toolActionStore = orchestrator.getToolActionStore();

      const task = await orchestrator.store.addTask({
        description: 'Retention policy test',
        workflow: 'feature',
        autonomy: 'high',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      });

      // Create multiple actions (more than maxActionsPerTask)
      const actionCount = 120; // Exceeds configured limit of 100
      for (let i = 0; i < actionCount; i++) {
        const mockExecution = {
          callId: `call-${i}`,
          toolName: `tool${i}`,
          input: { index: i },
          taskId: task.id,
          startTime: new Date(),
          endTime: new Date(),
          duration: 10,
          result: { success: true },
        };

        await toolActionStore.recordToolAction(task.id, mockExecution);
      }

      // Verify all actions exist before cleanup
      let actions = await toolActionStore.getToolActions(task.id);
      expect(actions.length).toBe(actionCount);

      // Run cleanup
      await toolActionStore.cleanup(task.id);

      // Verify actions are limited to maxActionsPerTask
      actions = await toolActionStore.getToolActions(task.id);
      expect(actions.length).toBe(100); // Should match configured maxActionsPerTask

      // Verify the newest actions are kept
      expect(actions[0].execution.toolName).toBe('tool119');
      expect(actions[99].execution.toolName).toBe('tool20');
    });

    it('should provide storage statistics', async () => {
      const toolActionStore = orchestrator.getToolActionStore();

      // Create test file
      const testFile = path.join(testDir, 'stats-test.txt');
      await fs.writeFile(testFile, 'Test content for stats', 'utf8');

      const task = await orchestrator.store.addTask({
        description: 'Storage stats test',
        workflow: 'feature',
        autonomy: 'high',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      });

      // Create actions with file snapshots
      for (let i = 0; i < 5; i++) {
        const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
        await fs.writeFile(testFile, `Modified content ${i}`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

        const mockExecution = {
          callId: `stats-call-${i}`,
          toolName: `statsTool${i}`,
          input: { iteration: i },
          taskId: task.id,
          startTime: new Date(),
          endTime: new Date(),
          duration: 25,
          result: { success: true },
        };

        await toolActionStore.recordToolAction(
          task.id,
          mockExecution,
          [testFile],
          [beforeSnapshot],
          [afterSnapshot]
        );
      }

      // Get storage statistics
      const stats = await toolActionStore.getStorageStats(task.id);

      expect(stats.totalActions).toBe(5);
      expect(stats.totalSnapshots).toBeGreaterThan(0);
      expect(stats.storageUsageMB).toBeGreaterThan(0);

      // Get overall storage statistics
      const overallStats = await toolActionStore.getStorageStats();
      expect(overallStats.totalActions).toBeGreaterThanOrEqual(5);
      expect(overallStats.totalSnapshots).toBeGreaterThanOrEqual(stats.totalSnapshots);
      expect(overallStats.storageUsageMB).toBeGreaterThanOrEqual(stats.storageUsageMB);
    });
  });

  describe('error handling integration', () => {
    it('should handle database errors gracefully', async () => {
      const toolActionStore = orchestrator.getToolActionStore();

      // Close the orchestrator to potentially cause database issues
      await orchestrator.close();

      // Attempting operations should handle errors appropriately
      const nonExistentFile = path.join(testDir, 'nonexistent.txt');

      await expect(toolActionStore.createFileSnapshot(nonExistentFile))
        .rejects.toThrow('File not found:');
    });

    it('should handle concurrent access correctly', async () => {
      const toolActionStore = orchestrator.getToolActionStore();

      const task = await orchestrator.store.addTask({
        description: 'Concurrency test',
        workflow: 'feature',
        autonomy: 'high',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      });

      // Create multiple concurrent actions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const mockExecution = {
          callId: `concurrent-${i}`,
          toolName: `concurrentTool${i}`,
          input: { index: i },
          taskId: task.id,
          startTime: new Date(),
          endTime: new Date(),
          duration: 15,
          result: { success: true },
        };

        promises.push(toolActionStore.recordToolAction(task.id, mockExecution));
      }

      // Wait for all actions to complete
      const actions = await Promise.all(promises);

      expect(actions).toHaveLength(10);

      // Verify all actions have unique sequence numbers
      const sequenceNumbers = actions.map(a => a.sequenceNumber);
      const uniqueSequenceNumbers = new Set(sequenceNumbers);
      expect(uniqueSequenceNumbers.size).toBe(10);

      // Verify actions can be retrieved
      const retrievedActions = await toolActionStore.getToolActions(task.id);
      expect(retrievedActions).toHaveLength(10);
    });
  });
});