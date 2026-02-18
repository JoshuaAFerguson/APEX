import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ApexOrchestrator } from '../index';
import { TaskStore, ToolActionStore } from '../store';
import { createHooks, FILE_MODIFYING_TOOLS } from '../hooks';
import type { Task, ToolExecution, FileSnapshot, HookContext } from '@apexcli/core';

describe('Tool Action Store Snapshot Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_integration`,
    description: 'Integration test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/integration-test',
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
    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  };

  beforeEach(async () => {
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apex-tool-action-test-'));
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    taskStore = (orchestrator as any).store;
    toolActionStore = (orchestrator as any).toolActionStore;

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

  describe('End-to-End Tool Action Recording', () => {
    it('should create complete tool action record with linked snapshots', async () => {
      const filePath = await createTestFile('e2e-test.txt', 'original content');
      const newContent = 'modified content after tool execution';

      // Set up hook context to simulate pre-tool snapshot capture
      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, 'original content');

      const hookContext: HookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      (orchestrator as any).currentHookContext = hookContext;

      // Simulate tool execution modifying the file
      await fs.promises.writeFile(filePath, newContent, 'utf8');

      const toolExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath, content: newContent },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
        duration: 1000,
        result: { success: true },
        status: 'completed',
      };

      // Record the tool action
      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      // Verify the complete tool action record
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.id).toBeDefined();
      expect(action.execution).toEqual(toolExecution);
      expect(action.modifiedFiles).toEqual([filePath]);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);
      expect(action.canUndo).toBe(true);
      expect(action.wasUndone).toBe(false);
      expect(action.sequenceNumber).toBe(0);

      // Verify before snapshot
      const beforeSnapshot = action.beforeSnapshots[0];
      expect(beforeSnapshot.filePath).toBe(filePath);
      expect(beforeSnapshot.content).toBe('original content');
      expect(beforeSnapshot.existed).toBe(true);

      // Verify after snapshot
      const afterSnapshot = action.afterSnapshots[0];
      expect(afterSnapshot.filePath).toBe(filePath);
      expect(afterSnapshot.content).toBe(newContent);
      expect(afterSnapshot.existed).toBe(true);
    });

    it('should handle complex multi-file tool execution', async () => {
      const file1Path = await createTestFile('multi1.ts', 'export const a = 1;');
      const file2Path = await createTestFile('multi2.ts', 'export const b = 2;');
      const file3Path = await createTestFile('multi3.ts', 'export const c = 3;');

      // Set up snapshots for all files
      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(file1Path, 'export const a = 1;');
      fileSnapshots.set(file2Path, 'export const b = 2;');
      fileSnapshots.set(file3Path, 'export const c = 3;');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Modify all files
      await fs.promises.writeFile(file1Path, 'export const a = 10;', 'utf8');
      await fs.promises.writeFile(file2Path, 'export const b = 20;', 'utf8');
      await fs.promises.writeFile(file3Path, 'export const c = 30;', 'utf8');

      const toolExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'MultiEdit',
        input: {
          edits: [
            { file_path: file1Path, old_string: 'a = 1', new_string: 'a = 10' },
            { file_path: file2Path, old_string: 'b = 2', new_string: 'b = 20' },
            { file_path: file3Path, old_string: 'c = 3', new_string: 'c = 30' },
          ],
        },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 500,
        result: { success: true },
        status: 'completed',
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.modifiedFiles).toHaveLength(3);
      expect(action.beforeSnapshots).toHaveLength(3);
      expect(action.afterSnapshots).toHaveLength(3);

      // Verify all files are tracked
      expect(action.modifiedFiles).toContain(file1Path);
      expect(action.modifiedFiles).toContain(file2Path);
      expect(action.modifiedFiles).toContain(file3Path);

      // Test undo functionality for multi-file action
      await toolActionStore.undoAction(testTask.id, action.id);

      // Verify all files were restored
      const restored1 = await fs.promises.readFile(file1Path, 'utf8');
      const restored2 = await fs.promises.readFile(file2Path, 'utf8');
      const restored3 = await fs.promises.readFile(file3Path, 'utf8');

      expect(restored1).toBe('export const a = 1;');
      expect(restored2).toBe('export const b = 2;');
      expect(restored3).toBe('export const c = 3;');
    });

    it('should maintain action sequence across multiple tool executions', async () => {
      const filePath = await createTestFile('sequence.txt', 'initial');

      // Execute multiple tool actions in sequence
      const actions = [];
      for (let i = 1; i <= 3; i++) {
        const content = `step ${i}`;

        // Set up snapshot for current state
        const currentContent = await fs.promises.readFile(filePath, 'utf8');
        const fileSnapshots = new Map<string, string>();
        fileSnapshots.set(filePath, currentContent);

        (orchestrator as any).currentHookContext = {
          taskId: testTask.id,
          store: taskStore,
          fileSnapshots,
        };

        // Modify file
        await fs.promises.writeFile(filePath, content, 'utf8');

        const toolExecution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: 'Edit',
          input: { file_path: filePath, old_string: currentContent, new_string: content },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          status: 'completed',
        };

        await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify sequence numbers
      const recordedActions = await toolActionStore.getToolActions(testTask.id);
      expect(recordedActions).toHaveLength(3);

      // Actions should be returned in reverse order (newest first)
      expect(recordedActions[0].sequenceNumber).toBe(2);
      expect(recordedActions[1].sequenceNumber).toBe(1);
      expect(recordedActions[2].sequenceNumber).toBe(0);

      // Verify the content progression
      expect(recordedActions[2].afterSnapshots[0].content).toBe('step 1');
      expect(recordedActions[1].afterSnapshots[0].content).toBe('step 2');
      expect(recordedActions[0].afterSnapshots[0].content).toBe('step 3');
    });
  });

  describe('Snapshot Storage and Retrieval', () => {
    it('should store and retrieve snapshots with complete metadata', async () => {
      const filePath = await createTestFile('metadata-test.js', '// Original comment\nconsole.log("hello");');

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(filePath, '// Original comment\nconsole.log("hello");');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      const newContent = '// Updated comment\nconsole.log("world");';
      await fs.promises.writeFile(filePath, newContent, 'utf8');

      const toolExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Edit',
        input: {
          file_path: filePath,
          old_string: 'hello',
          new_string: 'world'
        },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 200,
        result: { success: true },
        status: 'completed',
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const actions = await toolActionStore.getToolActions(testTask.id);
      const action = actions[0];

      // Verify snapshot metadata
      const beforeSnapshot = action.beforeSnapshots[0];
      expect(beforeSnapshot.id).toBeDefined();
      expect(beforeSnapshot.checksum).toBeDefined();
      expect(beforeSnapshot.fileSize).toBe('// Original comment\nconsole.log("hello");'.length);
      expect(beforeSnapshot.lastModified).toBeInstanceOf(Date);
      expect(beforeSnapshot.snapshotTime).toBeInstanceOf(Date);
      expect(beforeSnapshot.existed).toBe(true);

      const afterSnapshot = action.afterSnapshots[0];
      expect(afterSnapshot.checksum).not.toBe(beforeSnapshot.checksum);
      expect(afterSnapshot.fileSize).toBe(newContent.length);
      expect(afterSnapshot.content).toBe(newContent);
    });

    it('should handle snapshot storage statistics correctly', async () => {
      const file1Path = await createTestFile('stats1.txt', 'content1');
      const file2Path = await createTestFile('stats2.txt', 'content2');

      // Create multiple actions with snapshots
      for (let i = 1; i <= 2; i++) {
        const filePath = i === 1 ? file1Path : file2Path;
        const originalContent = `content${i}`;
        const newContent = `modified${i}`;

        const fileSnapshots = new Map<string, string>();
        fileSnapshots.set(filePath, originalContent);

        (orchestrator as any).currentHookContext = {
          taskId: testTask.id,
          store: taskStore,
          fileSnapshots,
        };

        await fs.promises.writeFile(filePath, newContent, 'utf8');

        const toolExecution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: 'Write',
          input: { file_path: filePath, content: newContent },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          status: 'completed',
        };

        await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);
      }

      // Check storage statistics
      const stats = await toolActionStore.getStorageStats(testTask.id);
      expect(stats.totalActions).toBe(2);
      expect(stats.totalSnapshots).toBe(4); // 2 before + 2 after
      expect(stats.storageUsageMB).toBeGreaterThan(0);
    });
  });

  describe('Hook Integration', () => {
    it('should integrate with captureFileSnapshot hook', async () => {
      const filePath = await createTestFile('hook-test.txt', 'hook content');

      // Create hook context
      const hookContext: HookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots: new Map(),
      };

      // Create hooks
      const hooks = createHooks(hookContext);

      // Verify captureFileSnapshot hook exists for file-modifying tools
      const preToolUseHooks = hooks.PreToolUse;
      expect(preToolUseHooks).toBeDefined();

      const fileSnapshotHook = preToolUseHooks?.find(hook =>
        hook.matcher && Array.isArray(hook.matcher) &&
        hook.matcher.every(tool => FILE_MODIFYING_TOOLS.includes(tool))
      );
      expect(fileSnapshotHook).toBeDefined();
    });

    it('should properly capture snapshots through hook system', async () => {
      const filePath = await createTestFile('hook-capture.txt', 'original hook content');

      // Initialize fileSnapshots map
      const fileSnapshots = new Map<string, string>();

      const hookContext: HookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Simulate hook execution for captureFileSnapshot
      const hookInput = {
        tool_name: 'Write',
        tool_input: { file_path: filePath },
      };

      // This would normally be called by the SDK, but we'll simulate it
      // The captureFileSnapshot hook should read the file and store it
      const fs_mock = vi.spyOn(fs, 'readFileSync').mockReturnValue('original hook content');

      try {
        // Simulate the hook execution
        hookContext.fileSnapshots!.set(filePath, 'original hook content');

        // Now simulate tool execution
        const newContent = 'modified hook content';
        await fs.promises.writeFile(filePath, newContent, 'utf8');

        (orchestrator as any).currentHookContext = hookContext;

        const toolExecution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: 'Write',
          input: { file_path: filePath, content: newContent },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 150,
          result: { success: true },
          status: 'completed',
        };

        await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

        const actions = await toolActionStore.getToolActions(testTask.id);
        expect(actions).toHaveLength(1);

        const action = actions[0];
        expect(action.beforeSnapshots[0].content).toBe('original hook content');
        expect(action.afterSnapshots[0].content).toBe(newContent);
      } finally {
        fs_mock.mockRestore();
      }
    });
  });

  describe('Error Recovery and Consistency', () => {
    it('should maintain consistency when snapshot creation partially fails', async () => {
      const file1Path = await createTestFile('consistent1.txt', 'content1');
      const file2Path = await createTestFile('consistent2.txt', 'content2');

      const fileSnapshots = new Map<string, string>();
      fileSnapshots.set(file1Path, 'content1');
      fileSnapshots.set(file2Path, 'content2');

      (orchestrator as any).currentHookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots,
      };

      // Modify first file normally
      await fs.promises.writeFile(file1Path, 'modified1', 'utf8');

      // Delete second file to cause after snapshot failure
      await fs.promises.unlink(file2Path);

      const toolExecution: ToolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'MultiEdit',
        input: {
          edits: [
            { file_path: file1Path, old_string: 'content1', new_string: 'modified1' },
            { file_path: file2Path, old_string: 'content2', new_string: 'modified2' },
          ],
        },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        status: 'completed',
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      // Should only record action for the file that succeeded
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      const action = actions[0];
      expect(action.modifiedFiles).toEqual([file1Path]);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);
      expect(action.beforeSnapshots[0].filePath).toBe(file1Path);
      expect(action.afterSnapshots[0].filePath).toBe(file1Path);

      // Verify error was logged
      const logs = await taskStore.getLogs(testTask.id);
      const errorLog = logs.find(log =>
        log.message.includes('Failed to create after snapshot') &&
        log.message.includes(file2Path)
      );
      expect(errorLog).toBeDefined();
      expect(errorLog?.level).toBe('warn');
    });

    it('should handle complete undo/redo workflow', async () => {
      const filePath = await createTestFile('undo-redo.txt', 'step 0');

      // Create a series of modifications
      const steps = ['step 1', 'step 2', 'step 3'];
      const actionIds = [];

      for (const [index, step] of steps.entries()) {
        const currentContent = await fs.promises.readFile(filePath, 'utf8');

        const fileSnapshots = new Map<string, string>();
        fileSnapshots.set(filePath, currentContent);

        (orchestrator as any).currentHookContext = {
          taskId: testTask.id,
          store: taskStore,
          fileSnapshots,
        };

        await fs.promises.writeFile(filePath, step, 'utf8');

        const toolExecution: ToolExecution = {
          callId: crypto.randomUUID(),
          toolName: 'Edit',
          input: { file_path: filePath, old_string: currentContent, new_string: step },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          status: 'completed',
        };

        await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

        const actions = await toolActionStore.getToolActions(testTask.id);
        actionIds.push(actions[0].id);
      }

      // Verify final state
      let content = await fs.promises.readFile(filePath, 'utf8');
      expect(content).toBe('step 3');

      // Undo last action (step 3 -> step 2)
      await toolActionStore.undoAction(testTask.id, actionIds[2]);
      content = await fs.promises.readFile(filePath, 'utf8');
      expect(content).toBe('step 2');

      // Undo middle action (step 2 -> step 1)
      await toolActionStore.undoAction(testTask.id, actionIds[1]);
      content = await fs.promises.readFile(filePath, 'utf8');
      expect(content).toBe('step 1');

      // Undo first action (step 1 -> step 0)
      await toolActionStore.undoAction(testTask.id, actionIds[0]);
      content = await fs.promises.readFile(filePath, 'utf8');
      expect(content).toBe('step 0');

      // Verify all actions are marked as undone
      const finalActions = await toolActionStore.getToolActions(testTask.id);
      expect(finalActions.every(action => action.wasUndone)).toBe(true);
    });
  });
});