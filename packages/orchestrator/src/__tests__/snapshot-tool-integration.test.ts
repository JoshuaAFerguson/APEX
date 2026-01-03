import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ApexOrchestrator } from '../index';
import { TaskStore, ToolActionStore } from '../store';
import type { Task, ToolExecution, FileSnapshot } from '@apexcli/core';
import { FILE_MODIFYING_TOOLS } from '../hooks';

describe('Snapshot Tool Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_snapshot_integration`,
    description: 'Snapshot integration test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/snapshot-test',
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

  const createMockToolExecution = (
    taskId: string,
    toolName: string = 'Write',
    input: Record<string, unknown> = {},
    success: boolean = true
  ): ToolExecution => ({
    callId: crypto.randomUUID(),
    toolName,
    input,
    taskId,
    agentName: 'testAgent',
    stageName: 'testStage',
    startTime: new Date(),
    endTime: new Date(),
    duration: 100,
    result: { success },
    error: undefined,
    status: 'completed',
  });

  const createTestFile = async (fileName: string, content: string): Promise<string> => {
    const filePath = path.join(testDir, fileName);
    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  };

  beforeEach(async () => {
    // Create temporary directory
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apex-snapshot-tool-test-'));

    // Initialize orchestrator (this will create stores)
    orchestrator = new ApexOrchestrator(testDir);
    await orchestrator.initialize();

    // Get store references
    taskStore = (orchestrator as any).store;
    toolActionStore = (orchestrator as any).toolActionStore;

    // Create test task
    testTask = createTestTask();
    await taskStore.createTask(testTask);
  });

  afterEach(async () => {
    if (taskStore) {
      await taskStore.close();
    }
    if (testDir && fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('recordFileModifyingToolAction Integration', () => {
    it('should record tool action with snapshots for Write tool', async () => {
      const filePath = await createTestFile('test.txt', 'original content');
      const newContent = 'modified content';

      // Create mock file snapshots map (simulating hook capture)
      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, 'original content');

      // Set up hook context
      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Modify the file to simulate tool execution
      await fs.promises.writeFile(filePath, newContent, 'utf8');

      const toolExecution = createMockToolExecution(testTask.id, 'Write', {
        file_path: filePath,
        content: newContent,
      });

      // Call the private method using type assertion
      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      // Verify tool action was recorded
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.execution.toolName).toBe('Write');
      expect(action.modifiedFiles).toEqual([filePath]);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);
      expect(action.canUndo).toBe(true);

      // Verify snapshot contents
      expect(action.beforeSnapshots[0].content).toBe('original content');
      expect(action.afterSnapshots[0].content).toBe(newContent);
      expect(action.beforeSnapshots[0].filePath).toBe(filePath);
      expect(action.afterSnapshots[0].filePath).toBe(filePath);
    });

    it('should record tool action for Edit tool with multiple files', async () => {
      const file1Path = await createTestFile('file1.txt', 'original 1');
      const file2Path = await createTestFile('file2.txt', 'original 2');

      // Set up hook context with snapshots
      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(file1Path, 'original 1');
      fileSnapshots.set(file2Path, 'original 2');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Modify files
      await fs.promises.writeFile(file1Path, 'modified 1', 'utf8');
      await fs.promises.writeFile(file2Path, 'modified 2', 'utf8');

      const toolExecution = createMockToolExecution(testTask.id, 'MultiEdit', {
        edits: [
          { file_path: file1Path, old_string: 'original 1', new_string: 'modified 1' },
          { file_path: file2Path, old_string: 'original 2', new_string: 'modified 2' },
        ],
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.modifiedFiles).toHaveLength(2);
      expect(action.beforeSnapshots).toHaveLength(2);
      expect(action.afterSnapshots).toHaveLength(2);
      expect(action.modifiedFiles).toContain(file1Path);
      expect(action.modifiedFiles).toContain(file2Path);
    });

    it('should handle new file creation in Write tool', async () => {
      const newFilePath = path.join(testDir, 'newfile.txt');
      const content = 'new file content';

      // Set up hook context with empty string for new file
      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(newFilePath, '');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Create the file
      await fs.promises.writeFile(newFilePath, content, 'utf8');

      const toolExecution = createMockToolExecution(testTask.id, 'Write', {
        file_path: newFilePath,
        content,
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.beforeSnapshots[0].content).toBe('');
      expect(action.beforeSnapshots[0].existed).toBe(false);
      expect(action.afterSnapshots[0].content).toBe(content);
      expect(action.afterSnapshots[0].existed).toBe(true);
    });

    it('should skip recording for non-file-modifying tools', async () => {
      const toolExecution = createMockToolExecution(testTask.id, 'Read', {
        file_path: '/some/path.txt',
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });

    it('should skip recording for failed tool executions', async () => {
      const filePath = await createTestFile('test.txt', 'original');

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, 'original');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      const toolExecution = createMockToolExecution(testTask.id, 'Write', {
        file_path: filePath,
        content: 'modified',
      }, false); // failed execution

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });

    it('should handle missing hook context gracefully', async () => {
      const filePath = await createTestFile('test.txt', 'original');
      await fs.promises.writeFile(filePath, 'modified', 'utf8');

      // Clear hook context
      (orchestrator as any).currentHookContext = undefined;

      const toolExecution = createMockToolExecution(testTask.id, 'Write', {
        file_path: filePath,
        content: 'modified',
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      // Should still record the action but with empty before snapshots
      const action = actions[0];
      expect(action.beforeSnapshots).toHaveLength(0);
      expect(action.afterSnapshots).toHaveLength(1);
    });

    it('should handle file read errors during after snapshot creation', async () => {
      const filePath = await createTestFile('test.txt', 'original');

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, 'original');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Delete file to cause read error during after snapshot
      await fs.promises.unlink(filePath);

      const toolExecution = createMockToolExecution(testTask.id, 'Write', {
        file_path: filePath,
        content: 'modified',
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      // Should not record action if after snapshot fails
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);

      // Should log the error
      const logs = await taskStore.getLogs(testTask.id);
      const errorLog = logs.find(log => log.message.includes('Failed to create after snapshot'));
      expect(errorLog).toBeDefined();
      expect(errorLog?.level).toBe('warn');
    });

    it('should record action with NotebookEdit tool', async () => {
      const notebookPath = await createTestFile('test.ipynb', '{"cells": []}');
      const modifiedContent = '{"cells": [{"cell_type": "code", "source": ["print(\\"hello\\")"]}]}';

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(notebookPath, '{"cells": []}');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      await fs.promises.writeFile(notebookPath, modifiedContent, 'utf8');

      const toolExecution = createMockToolExecution(testTask.id, 'NotebookEdit', {
        notebook_path: notebookPath,
        new_source: 'print("hello")',
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.execution.toolName).toBe('NotebookEdit');
      expect(action.modifiedFiles).toEqual([notebookPath]);
    });
  });

  describe('FILE_MODIFYING_TOOLS constant', () => {
    it('should include all expected file-modifying tools', () => {
      expect(FILE_MODIFYING_TOOLS).toContain('Write');
      expect(FILE_MODIFYING_TOOLS).toContain('Edit');
      expect(FILE_MODIFYING_TOOLS).toContain('MultiEdit');
      expect(FILE_MODIFYING_TOOLS).toContain('NotebookEdit');
    });

    it('should only contain file-modifying tools', () => {
      const nonFileModifyingTools = ['Read', 'Bash', 'WebFetch', 'Glob', 'Grep'];
      for (const tool of nonFileModifyingTools) {
        expect(FILE_MODIFYING_TOOLS).not.toContain(tool);
      }
    });
  });

  describe('Integration with ToolActionStore.recordToolAction', () => {
    it('should properly link snapshots to tool action record', async () => {
      const filePath = await createTestFile('link-test.txt', 'original');

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, 'original');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      await fs.promises.writeFile(filePath, 'modified', 'utf8');

      const toolExecution = createMockToolExecution(testTask.id, 'Edit', {
        file_path: filePath,
        old_string: 'original',
        new_string: 'modified',
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];

      // Verify the action can be undone
      expect(action.canUndo).toBe(true);

      // Test undo functionality
      await toolActionStore.undoAction(testTask.id, action.id);

      // Verify file was restored
      const restoredContent = await fs.promises.readFile(filePath, 'utf8');
      expect(restoredContent).toBe('original');

      // Verify action is marked as undone
      const updatedActions = await toolActionStore.getToolActions(testTask.id);
      expect(updatedActions[0].wasUndone).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error on recordFileModifyingToolAction failure', async () => {
      const filePath = await createTestFile('error-test.txt', 'content');

      // Mock a scenario that will cause recordToolAction to fail
      const invalidExecution = {
        ...createMockToolExecution(testTask.id, 'Write'),
        callId: null, // Invalid callId
      } as any;

      await expect(
        (orchestrator as any).recordFileModifyingToolAction(testTask.id, invalidExecution)
      ).rejects.toThrow('Failed to record tool action');
    });

    it('should log success when tool action is recorded', async () => {
      const filePath = await createTestFile('success-test.txt', 'original');

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, 'original');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      await fs.promises.writeFile(filePath, 'modified', 'utf8');

      const toolExecution = createMockToolExecution(testTask.id, 'Write', {
        file_path: filePath,
        content: 'modified',
      });

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      // Verify success log was created
      const logs = await taskStore.getLogs(testTask.id);
      const successLog = logs.find(log =>
        log.message.includes('Recorded tool action for Write with 1 file(s)')
      );
      expect(successLog).toBeDefined();
      expect(successLog?.level).toBe('debug');
    });
  });
});