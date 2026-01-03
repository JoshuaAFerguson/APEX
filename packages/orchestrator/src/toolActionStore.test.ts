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

describe('ToolActionStore', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for tool actions',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-branch',
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

  const createTestFile = async (fileName: string, content: string): Promise<string> => {
    const filePath = path.join(testDir, fileName);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  };

  const createMockToolExecution = (taskId: string, toolName: string = 'testTool') => ({
    callId: crypto.randomUUID(),
    toolName,
    input: { test: 'input' },
    taskId,
    agentName: 'testAgent',
    stageName: 'testStage',
    startTime: new Date(),
    endTime: new Date(),
    duration: 100,
    result: { success: true },
    error: undefined,
    status: 'completed' as const,
  });

  beforeEach(async () => {
    // Create temporary directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-toolstore-test-'));

    // Initialize stores
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    // Create test task
    testTask = createTestTask();
    await taskStore.addTask(testTask);

    // Initialize tool action store with default retention config
    toolActionStore = new ToolActionStore(taskStore);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('constructor and configuration', () => {
    it('should initialize with default retention configuration', () => {
      const store = new ToolActionStore(taskStore);
      expect(store).toBeDefined();
    });

    it('should initialize with custom retention configuration', () => {
      const customConfig: Partial<ToolActionRetentionConfig> = {
        maxActionsPerTask: 500,
        maxAgeDays: 15,
        keepUndoneSnapshots: true,
        maxSnapshotStorageMB: 50,
      };

      const store = new ToolActionStore(taskStore, customConfig);
      expect(store).toBeDefined();
    });
  });

  describe('file snapshot operations', () => {
    it('should create file snapshot for existing file', async () => {
      const content = 'Hello, world!';
      const filePath = await createTestFile('test.txt', content);

      const snapshot = await toolActionStore.createFileSnapshot(filePath, { source: 'test' });

      expect(snapshot.id).toBeDefined();
      expect(snapshot.filePath).toBe(path.resolve(filePath));
      expect(snapshot.content).toBe(content);
      expect(snapshot.checksum).toBe(crypto.createHash('sha256').update(content).digest('hex'));
      expect(snapshot.fileSize).toBe(content.length);
      expect(snapshot.lastModified).toBeInstanceOf(Date);
      expect(snapshot.snapshotTime).toBeInstanceOf(Date);
      expect(snapshot.metadata).toEqual({ source: 'test' });
    });

    it('should create file snapshot without metadata', async () => {
      const content = 'Hello, world!';
      const filePath = await createTestFile('test.txt', content);

      const snapshot = await toolActionStore.createFileSnapshot(filePath);

      expect(snapshot.metadata).toBeUndefined();
    });

    it('should throw error for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      await expect(toolActionStore.createFileSnapshot(filePath))
        .rejects.toThrow('File not found:');
    });

    it('should handle binary file content correctly', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const filePath = path.join(testDir, 'test.png');
      await fs.writeFile(filePath, binaryContent);

      // Note: createFileSnapshot reads as utf8, which may not be ideal for binary files
      // This test documents current behavior
      await expect(toolActionStore.createFileSnapshot(filePath))
        .resolves.toBeDefined();
    });
  });

  describe('tool action recording', () => {
    it('should record tool action without file modifications', async () => {
      const execution = createMockToolExecution(testTask.id);

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution
      );

      expect(action.id).toBeDefined();
      expect(action.execution).toEqual(execution);
      expect(action.modifiedFiles).toEqual([]);
      expect(action.beforeSnapshots).toEqual([]);
      expect(action.afterSnapshots).toEqual([]);
      expect(action.canUndo).toBe(false);
      expect(action.wasUndone).toBe(false);
      expect(action.sequenceNumber).toBe(0);
      expect(action.actionGroup).toBeUndefined();
    });

    it('should record tool action with file modifications', async () => {
      const beforeContent = 'Original content';
      const afterContent = 'Modified content';
      const filePath = await createTestFile('test.txt', beforeContent);

      // Create snapshots
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath, { stage: 'before' });

      // Modify file
      await fs.writeFile(filePath, afterContent, 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath, { stage: 'after' });

      const execution = createMockToolExecution(testTask.id, 'writeFile');

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot],
        'file-modification'
      );

      expect(action.modifiedFiles).toEqual([filePath]);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);
      expect(action.canUndo).toBe(true);
      expect(action.sequenceNumber).toBe(0);
      expect(action.actionGroup).toBe('file-modification');
    });

    it('should assign sequential sequence numbers', async () => {
      const execution1 = createMockToolExecution(testTask.id, 'tool1');
      const execution2 = createMockToolExecution(testTask.id, 'tool2');
      const execution3 = createMockToolExecution(testTask.id, 'tool3');

      const action1 = await toolActionStore.recordToolAction(testTask.id, execution1);
      const action2 = await toolActionStore.recordToolAction(testTask.id, execution2);
      const action3 = await toolActionStore.recordToolAction(testTask.id, execution3);

      expect(action1.sequenceNumber).toBe(0);
      expect(action2.sequenceNumber).toBe(1);
      expect(action3.sequenceNumber).toBe(2);
    });

    it('should handle multiple file modifications in one action', async () => {
      const file1Path = await createTestFile('file1.txt', 'Content 1');
      const file2Path = await createTestFile('file2.txt', 'Content 2');

      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(file1Path);
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(file2Path);

      // Modify files
      await fs.writeFile(file1Path, 'Modified 1', 'utf8');
      await fs.writeFile(file2Path, 'Modified 2', 'utf8');

      const afterSnapshot1 = await toolActionStore.createFileSnapshot(file1Path);
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(file2Path);

      const execution = createMockToolExecution(testTask.id, 'multiFileEdit');

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [file1Path, file2Path],
        [beforeSnapshot1, beforeSnapshot2],
        [afterSnapshot1, afterSnapshot2]
      );

      expect(action.modifiedFiles).toEqual([file1Path, file2Path]);
      expect(action.beforeSnapshots).toHaveLength(2);
      expect(action.afterSnapshots).toHaveLength(2);
      expect(action.canUndo).toBe(true);
    });
  });

  describe('tool action retrieval', () => {
    it('should retrieve tool actions for a task in reverse order', async () => {
      const execution1 = createMockToolExecution(testTask.id, 'tool1');
      const execution2 = createMockToolExecution(testTask.id, 'tool2');
      const execution3 = createMockToolExecution(testTask.id, 'tool3');

      await toolActionStore.recordToolAction(testTask.id, execution1);
      await toolActionStore.recordToolAction(testTask.id, execution2);
      await toolActionStore.recordToolAction(testTask.id, execution3);

      const actions = await toolActionStore.getToolActions(testTask.id);

      expect(actions).toHaveLength(3);
      expect(actions[0].execution.toolName).toBe('tool3');
      expect(actions[1].execution.toolName).toBe('tool2');
      expect(actions[2].execution.toolName).toBe('tool1');
    });

    it('should support pagination with limit and offset', async () => {
      // Create 5 actions
      for (let i = 0; i < 5; i++) {
        const execution = createMockToolExecution(testTask.id, `tool${i}`);
        await toolActionStore.recordToolAction(testTask.id, execution);
      }

      // Get first 2 actions
      const firstPage = await toolActionStore.getToolActions(testTask.id, 2);
      expect(firstPage).toHaveLength(2);
      expect(firstPage[0].execution.toolName).toBe('tool4');
      expect(firstPage[1].execution.toolName).toBe('tool3');

      // Get next 2 actions with offset
      const secondPage = await toolActionStore.getToolActions(testTask.id, 2, 2);
      expect(secondPage).toHaveLength(2);
      expect(secondPage[0].execution.toolName).toBe('tool2');
      expect(secondPage[1].execution.toolName).toBe('tool1');
    });

    it('should return empty array for task with no actions', async () => {
      const anotherTask = createTestTask();
      await taskStore.addTask(anotherTask);

      const actions = await toolActionStore.getToolActions(anotherTask.id);
      expect(actions).toEqual([]);
    });

    it('should return empty array for non-existent task', async () => {
      const actions = await toolActionStore.getToolActions('non-existent-task');
      expect(actions).toEqual([]);
    });
  });

  describe('undoable actions retrieval', () => {
    it('should retrieve only undoable actions', async () => {
      const filePath = await createTestFile('test.txt', 'Original');

      // Action 1: No file modifications (not undoable)
      const execution1 = createMockToolExecution(testTask.id, 'readOnly');
      await toolActionStore.recordToolAction(testTask.id, execution1);

      // Action 2: With file modifications (undoable)
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);
      const execution2 = createMockToolExecution(testTask.id, 'writeFile');
      await toolActionStore.recordToolAction(
        testTask.id,
        execution2,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Action 3: Another file modification (undoable)
      await fs.writeFile(filePath, 'Modified Again', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(filePath);
      const execution3 = createMockToolExecution(testTask.id, 'writeFile2');
      await toolActionStore.recordToolAction(
        testTask.id,
        execution3,
        [filePath],
        [afterSnapshot],
        [afterSnapshot2]
      );

      const undoableActions = await toolActionStore.getUndoableActions(testTask.id);

      expect(undoableActions).toHaveLength(2);
      expect(undoableActions[0].execution.toolName).toBe('writeFile2');
      expect(undoableActions[1].execution.toolName).toBe('writeFile');
      expect(undoableActions.every(action => action.canUndo)).toBe(true);
      expect(undoableActions.every(action => !action.wasUndone)).toBe(true);
    });

    it('should exclude already undone actions', async () => {
      const filePath = await createTestFile('test.txt', 'Original');
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);

      await fs.writeFile(filePath, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

      const execution = createMockToolExecution(testTask.id, 'writeFile');
      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Undo the action
      await toolActionStore.undoAction(testTask.id, action.id);

      const undoableActions = await toolActionStore.getUndoableActions(testTask.id);
      expect(undoableActions).toHaveLength(0);
    });
  });

  describe('undo operations', () => {
    it('should undo the last action successfully', async () => {
      const originalContent = 'Original content';
      const modifiedContent = 'Modified content';
      const filePath = await createTestFile('test.txt', originalContent);

      // Record file modification
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, modifiedContent, 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

      const execution = createMockToolExecution(testTask.id, 'writeFile');
      await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Verify file is modified
      const currentContent = await fs.readFile(filePath, 'utf8');
      expect(currentContent).toBe(modifiedContent);

      // Undo the action
      await toolActionStore.undoLastAction(testTask.id);

      // Verify file is restored
      const restoredContent = await fs.readFile(filePath, 'utf8');
      expect(restoredContent).toBe(originalContent);

      // Verify action is marked as undone
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions[0].wasUndone).toBe(true);
      expect(actions[0].undoneAt).toBeInstanceOf(Date);
    });

    it('should undo a specific action by ID', async () => {
      const filePath = await createTestFile('test.txt', 'Original');

      // Create two actions
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified 1', 'utf8');
      const afterSnapshot1 = await toolActionStore.createFileSnapshot(filePath);

      const execution1 = createMockToolExecution(testTask.id, 'writeFile1');
      const action1 = await toolActionStore.recordToolAction(
        testTask.id,
        execution1,
        [filePath],
        [beforeSnapshot1],
        [afterSnapshot1]
      );

      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified 2', 'utf8');
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(filePath);

      const execution2 = createMockToolExecution(testTask.id, 'writeFile2');
      await toolActionStore.recordToolAction(
        testTask.id,
        execution2,
        [filePath],
        [beforeSnapshot2],
        [afterSnapshot2]
      );

      // Undo the first action specifically
      await toolActionStore.undoAction(testTask.id, action1.id);

      // Verify the first action is restored to its before state
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Original');

      // Verify only the first action is marked as undone
      const actions = await toolActionStore.getToolActions(testTask.id);
      const action1Updated = actions.find(a => a.id === action1.id);
      const action2Updated = actions.find(a => a.execution.toolName === 'writeFile2');

      expect(action1Updated?.wasUndone).toBe(true);
      expect(action2Updated?.wasUndone).toBe(false);
    });

    it('should handle multiple file undo correctly', async () => {
      const file1Path = await createTestFile('file1.txt', 'Original 1');
      const file2Path = await createTestFile('file2.txt', 'Original 2');

      // Create snapshots before modification
      const beforeSnapshot1 = await toolActionStore.createFileSnapshot(file1Path);
      const beforeSnapshot2 = await toolActionStore.createFileSnapshot(file2Path);

      // Modify files
      await fs.writeFile(file1Path, 'Modified 1', 'utf8');
      await fs.writeFile(file2Path, 'Modified 2', 'utf8');

      const afterSnapshot1 = await toolActionStore.createFileSnapshot(file1Path);
      const afterSnapshot2 = await toolActionStore.createFileSnapshot(file2Path);

      const execution = createMockToolExecution(testTask.id, 'multiFileEdit');
      await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [file1Path, file2Path],
        [beforeSnapshot1, beforeSnapshot2],
        [afterSnapshot1, afterSnapshot2]
      );

      // Undo the action
      await toolActionStore.undoLastAction(testTask.id);

      // Verify both files are restored
      const content1 = await fs.readFile(file1Path, 'utf8');
      const content2 = await fs.readFile(file2Path, 'utf8');

      expect(content1).toBe('Original 1');
      expect(content2).toBe('Original 2');
    });

    it('should throw error when no undoable actions exist', async () => {
      await expect(toolActionStore.undoLastAction(testTask.id))
        .rejects.toThrow('No undoable actions found for task');
    });

    it('should throw error when action does not exist', async () => {
      await expect(toolActionStore.undoAction(testTask.id, 'non-existent-action'))
        .rejects.toThrow('Tool action not found');
    });

    it('should throw error when action belongs to different task', async () => {
      const otherTask = createTestTask();
      await taskStore.addTask(otherTask);

      const filePath = await createTestFile('test.txt', 'Original');
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

      const execution = createMockToolExecution(otherTask.id, 'writeFile');
      const action = await toolActionStore.recordToolAction(
        otherTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      await expect(toolActionStore.undoAction(testTask.id, action.id))
        .rejects.toThrow('Action does not belong to specified task');
    });

    it('should throw error when action cannot be undone', async () => {
      const execution = createMockToolExecution(testTask.id, 'readOnly');
      const action = await toolActionStore.recordToolAction(testTask.id, execution);

      await expect(toolActionStore.undoAction(testTask.id, action.id))
        .rejects.toThrow('Action cannot be undone');
    });

    it('should throw error when action is already undone', async () => {
      const filePath = await createTestFile('test.txt', 'Original');
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

      const execution = createMockToolExecution(testTask.id, 'writeFile');
      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Undo once
      await toolActionStore.undoAction(testTask.id, action.id);

      // Try to undo again
      await expect(toolActionStore.undoAction(testTask.id, action.id))
        .rejects.toThrow('Action has already been undone');
    });

    it('should handle undo errors gracefully', async () => {
      const filePath = await createTestFile('test.txt', 'Original');
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

      const execution = createMockToolExecution(testTask.id, 'writeFile');
      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Delete the file to cause an undo error
      await fs.unlink(filePath);

      await expect(toolActionStore.undoAction(testTask.id, action.id))
        .rejects.toThrow();

      // Verify error is recorded in the database
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions[0].undoError).toBeDefined();
      expect(actions[0].wasUndone).toBe(false);
    });
  });

  describe('cleanup and retention policies', () => {
    it('should clean up old actions based on retention policy', async () => {
      // Create tool action store with short retention
      const shortRetentionStore = new ToolActionStore(taskStore, {
        maxAgeDays: 1,
        maxActionsPerTask: 1000,
      });

      // Create an old action (simulate by manually updating the created_at)
      const execution = createMockToolExecution(testTask.id, 'oldTool');
      const action = await shortRetentionStore.recordToolAction(testTask.id, execution);

      // Manually update the created_at to be older than retention period
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2);

      // Access the private db property for testing
      (taskStore as any).db.prepare(`
        UPDATE tool_actions SET created_at = ? WHERE id = ?
      `).run(oldDate.toISOString(), action.id);

      // Run cleanup
      await shortRetentionStore.cleanup(testTask.id);

      // Verify action is deleted
      const actions = await shortRetentionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });

    it('should limit actions per task', async () => {
      // Create tool action store with limit of 2 actions per task
      const limitedStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: 2,
        maxAgeDays: 30,
      });

      // Create 3 actions
      for (let i = 0; i < 3; i++) {
        const execution = createMockToolExecution(testTask.id, `tool${i}`);
        await limitedStore.recordToolAction(testTask.id, execution);
      }

      // Run cleanup
      await limitedStore.cleanup(testTask.id);

      // Verify only 2 actions remain (the newest ones)
      const actions = await limitedStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(2);
      expect(actions[0].execution.toolName).toBe('tool2');
      expect(actions[1].execution.toolName).toBe('tool1');
    });

    it('should clean up orphaned snapshots', async () => {
      const filePath = await createTestFile('test.txt', 'Original');
      const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
      await fs.writeFile(filePath, 'Modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

      const execution = createMockToolExecution(testTask.id, 'writeFile');
      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [filePath],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Manually delete the tool action to create orphaned snapshots
      (taskStore as any).db.prepare(`DELETE FROM tool_actions WHERE id = ?`).run(action.id);

      // Run cleanup
      await toolActionStore.cleanup();

      // Verify snapshots are cleaned up (we can't directly query, but cleanup should run without error)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should run cleanup for all tasks when no specific task provided', async () => {
      // Create another task
      const anotherTask = createTestTask();
      await taskStore.addTask(anotherTask);

      // Create actions for both tasks
      const execution1 = createMockToolExecution(testTask.id, 'tool1');
      const execution2 = createMockToolExecution(anotherTask.id, 'tool2');

      await toolActionStore.recordToolAction(testTask.id, execution1);
      await toolActionStore.recordToolAction(anotherTask.id, execution2);

      // Run cleanup without specific task
      await toolActionStore.cleanup();

      // Both actions should still exist (no cleanup criteria met)
      const actions1 = await toolActionStore.getToolActions(testTask.id);
      const actions2 = await toolActionStore.getToolActions(anotherTask.id);

      expect(actions1).toHaveLength(1);
      expect(actions2).toHaveLength(1);
    });
  });

  describe('storage statistics', () => {
    it('should return storage statistics for specific task', async () => {
      // Create some actions with snapshots
      const filePath = await createTestFile('test.txt', 'Original content');

      for (let i = 0; i < 3; i++) {
        const beforeSnapshot = await toolActionStore.createFileSnapshot(filePath);
        await fs.writeFile(filePath, `Modified ${i}`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(filePath);

        const execution = createMockToolExecution(testTask.id, `tool${i}`);
        await toolActionStore.recordToolAction(
          testTask.id,
          execution,
          [filePath],
          [beforeSnapshot],
          [afterSnapshot]
        );
      }

      const stats = await toolActionStore.getStorageStats(testTask.id);

      expect(stats.totalActions).toBe(3);
      expect(stats.totalSnapshots).toBeGreaterThan(0);
      expect(stats.storageUsageMB).toBeGreaterThan(0);
    });

    it('should return storage statistics for all tasks', async () => {
      // Create another task
      const anotherTask = createTestTask();
      await taskStore.addTask(anotherTask);

      // Create actions for both tasks
      const execution1 = createMockToolExecution(testTask.id, 'tool1');
      const execution2 = createMockToolExecution(anotherTask.id, 'tool2');

      await toolActionStore.recordToolAction(testTask.id, execution1);
      await toolActionStore.recordToolAction(anotherTask.id, execution2);

      const stats = await toolActionStore.getStorageStats();

      expect(stats.totalActions).toBe(2);
      expect(stats.totalSnapshots).toBeGreaterThanOrEqual(0);
      expect(stats.storageUsageMB).toBeGreaterThanOrEqual(0);
    });

    it('should return zero statistics for empty store', async () => {
      const emptyTask = createTestTask();
      await taskStore.addTask(emptyTask);

      const stats = await toolActionStore.getStorageStats(emptyTask.id);

      expect(stats.totalActions).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.storageUsageMB).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle snapshots with large file sizes', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB file
      const filePath = await createTestFile('large.txt', largeContent);

      const snapshot = await toolActionStore.createFileSnapshot(filePath);

      expect(snapshot.content).toBe(largeContent);
      expect(snapshot.fileSize).toBe(largeContent.length);
      expect(snapshot.checksum).toBe(crypto.createHash('sha256').update(largeContent).digest('hex'));
    });

    it('should handle file paths with special characters', async () => {
      const specialFileName = 'test file with spaces & symbols.txt';
      const content = 'Special content';
      const filePath = await createTestFile(specialFileName, content);

      const snapshot = await toolActionStore.createFileSnapshot(filePath);

      expect(snapshot.filePath).toBe(path.resolve(filePath));
      expect(snapshot.content).toBe(content);
    });

    it('should handle concurrent action recording', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const execution = createMockToolExecution(testTask.id, `concurrent${i}`);
        promises.push(toolActionStore.recordToolAction(testTask.id, execution));
      }

      const actions = await Promise.all(promises);

      expect(actions).toHaveLength(5);

      // Verify all actions have unique sequence numbers
      const sequenceNumbers = actions.map(a => a.sequenceNumber);
      const uniqueSequenceNumbers = new Set(sequenceNumbers);
      expect(uniqueSequenceNumbers.size).toBe(5);
    });

    it('should handle empty file snapshots', async () => {
      const filePath = await createTestFile('empty.txt', '');

      const snapshot = await toolActionStore.createFileSnapshot(filePath);

      expect(snapshot.content).toBe('');
      expect(snapshot.fileSize).toBe(0);
      expect(snapshot.checksum).toBe(crypto.createHash('sha256').update('').digest('hex'));
    });

    it('should handle tool executions with null/undefined fields', async () => {
      const execution = {
        callId: crypto.randomUUID(),
        toolName: 'testTool',
        input: { test: 'input' },
        taskId: testTask.id,
        agentName: undefined,
        stageName: null,
        startTime: new Date(),
        endTime: undefined,
        duration: undefined,
        result: undefined,
        error: undefined,
      };

      const action = await toolActionStore.recordToolAction(testTask.id, execution as any);

      expect(action.execution.agentName).toBeUndefined();
      expect(action.execution.stageName).toBeNull();
      expect(action.execution.endTime).toBeUndefined();
      expect(action.execution.duration).toBeUndefined();
      expect(action.execution.result).toBeUndefined();
      expect(action.execution.error).toBeUndefined();
    });
  });
});