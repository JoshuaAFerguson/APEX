import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import type { Task, ToolExecution, HookContext } from '@apexcli/core';
import { captureFileSnapshot } from '../hooks';

describe('Snapshot Capture Edge Cases', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_edge_cases`,
    description: 'Edge cases test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/edge-cases-test',
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
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'apex-edge-cases-test-'));
    orchestrator = new ApexOrchestrator(testDir);
    await orchestrator.initialize();
    taskStore = (orchestrator as any).store;

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

  describe('File Path Extraction Edge Cases', () => {
    it('should extract file paths from nested edit structures', () => {
      const toolInput = {
        edits: [
          { file_path: '/path/to/file1.ts', old_string: 'old1', new_string: 'new1' },
          { file_path: '/path/to/file2.ts', old_string: 'old2', new_string: 'new2' },
          { other_prop: 'value' }, // Invalid edit without file_path
        ],
      };

      const extractedPaths = (orchestrator as any).extractFilePathsFromToolInput(
        'MultiEdit',
        toolInput
      );

      expect(extractedPaths).toEqual(['/path/to/file1.ts', '/path/to/file2.ts']);
    });

    it('should handle NotebookEdit tool with notebook_path', () => {
      const toolInput = { notebook_path: '/path/to/notebook.ipynb' };

      const extractedPaths = (orchestrator as any).extractFilePathsFromToolInput(
        'NotebookEdit',
        toolInput
      );

      expect(extractedPaths).toEqual(['/path/to/notebook.ipynb']);
    });

    it('should handle tool with generic path parameter', () => {
      const toolInput = { path: '/generic/path.txt' };

      const extractedPaths = (orchestrator as any).extractFilePathsFromToolInput(
        'GenericTool',
        toolInput
      );

      expect(extractedPaths).toEqual(['/generic/path.txt']);
    });

    it('should return empty array when no valid file paths found', () => {
      const toolInput = { content: 'some content', other: 'value' };

      const extractedPaths = (orchestrator as any).extractFilePathsFromToolInput(
        'SomeTool',
        toolInput
      );

      expect(extractedPaths).toEqual([]);
    });

    it('should handle malformed MultiEdit edits gracefully', () => {
      const toolInput = {
        edits: [
          'not an object',
          { file_path: 123 }, // Wrong type
          { file_path: '/valid/path.ts' },
          null,
          undefined,
        ],
      };

      const extractedPaths = (orchestrator as any).extractFilePathsFromToolInput(
        'MultiEdit',
        toolInput
      );

      expect(extractedPaths).toEqual(['/valid/path.ts']);
    });
  });

  describe('File Snapshot Creation Edge Cases', () => {
    it('should create snapshot for file with unicode content', async () => {
      const content = '🚀 Hello 世界! 🎉';
      const filePath = await createTestFile('unicode.txt', content);

      const snapshot = await (orchestrator as any).createFileSnapshot(filePath, true);

      expect(snapshot).toBeDefined();
      expect(snapshot.content).toBe(content);
      expect(snapshot.fileSize).toBe(Buffer.from(content, 'utf8').length);
      expect(snapshot.checksum).toBe(
        crypto.createHash('sha256').update(content, 'utf8').digest('hex')
      );
    });

    it('should create snapshot for very large file', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB file
      const filePath = await createTestFile('large.txt', largeContent);

      const snapshot = await (orchestrator as any).createFileSnapshot(filePath, true);

      expect(snapshot).toBeDefined();
      expect(snapshot.content).toBe(largeContent);
      expect(snapshot.fileSize).toBe(largeContent.length);
    });

    it('should handle file with special characters in path', async () => {
      const content = 'test content';
      const specialPath = path.join(testDir, 'special file & name [1].txt');
      await fs.promises.writeFile(specialPath, content, 'utf8');

      const snapshot = await (orchestrator as any).createFileSnapshot(specialPath, true);

      expect(snapshot).toBeDefined();
      expect(snapshot.filePath).toBe(specialPath);
      expect(snapshot.content).toBe(content);
    });

    it('should create snapshot from content with proper existed flag', async () => {
      const content = 'existing content';
      const snapshot = await (orchestrator as any).createFileSnapshotFromContent(
        '/some/path.txt',
        content,
        true
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.content).toBe(content);
      expect(snapshot.existed).toBe(true);
      expect(snapshot.checksum).toBe(
        crypto.createHash('sha256').update(content).digest('hex')
      );
    });

    it('should create snapshot for new file with existed=false', async () => {
      const content = '';
      const snapshot = await (orchestrator as any).createFileSnapshotFromContent(
        '/new/file.txt',
        content,
        false
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.content).toBe('');
      expect(snapshot.existed).toBe(false);
      expect(snapshot.fileSize).toBe(0);
    });

    it('should handle createFileSnapshot with missing file gracefully', async () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.txt');

      await expect(
        (orchestrator as any).createFileSnapshot(nonExistentPath, true)
      ).rejects.toThrow();
    });
  });

  describe('Hook Context and Snapshot Map Edge Cases', () => {
    it('should handle empty fileSnapshots map', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const context: HookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots: new Map(),
      };

      (orchestrator as any).currentHookContext = context;

      await fs.promises.writeFile(filePath, 'modified', 'utf8');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath },
        taskId: testTask.id,
        agentName: 'test',
        stageName: 'test',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        status: 'completed' as const,
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      // Should still create action but with empty before snapshots
      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);
      expect(actions[0].beforeSnapshots).toHaveLength(0);
      expect(actions[0].afterSnapshots).toHaveLength(1);
    });

    it('should handle undefined fileSnapshots map', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const context: HookContext = {
        taskId: testTask.id,
        store: taskStore,
        fileSnapshots: undefined,
      };

      (orchestrator as any).currentHookContext = context;

      await fs.promises.writeFile(filePath, 'modified', 'utf8');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath },
        taskId: testTask.id,
        agentName: 'test',
        stageName: 'test',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        status: 'completed' as const,
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);
      expect(actions[0].beforeSnapshots).toHaveLength(0);
    });
  });

  describe('Tool Execution Status Edge Cases', () => {
    it('should skip recording for tool with pending status', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath },
        taskId: testTask.id,
        agentName: 'test',
        stageName: 'test',
        startTime: new Date(),
        endTime: undefined,
        duration: undefined,
        result: undefined,
        status: 'pending' as const,
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });

    it('should skip recording for tool with failed result', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath },
        taskId: testTask.id,
        agentName: 'test',
        stageName: 'test',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: false, error: 'Write failed' },
        status: 'completed' as const,
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });

    it('should skip recording for tool with error status', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath },
        taskId: testTask.id,
        agentName: 'test',
        stageName: 'test',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: undefined,
        error: 'Tool execution failed',
        status: 'error' as const,
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });

    it('should handle tool with null result gracefully', async () => {
      const filePath = await createTestFile('test.txt', 'content');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Write',
        input: { file_path: filePath },
        taskId: testTask.id,
        agentName: 'test',
        stageName: 'test',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: null,
        status: 'completed' as const,
      };

      await (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution);

      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(0);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle permission denied errors gracefully', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as permission handling is different
        return;
      }

      const filePath = await createTestFile('readonly.txt', 'content');

      // Make file read-only
      await fs.promises.chmod(filePath, 0o444);

      try {
        const snapshot = await (orchestrator as any).createFileSnapshot(filePath, true);
        expect(snapshot).toBeDefined();
        expect(snapshot.content).toBe('content');
      } finally {
        // Restore permissions for cleanup
        await fs.promises.chmod(filePath, 0o644);
      }
    });

    it('should handle symlinks correctly', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows as symlink handling may differ
        return;
      }

      const content = 'symlink target content';
      const targetPath = await createTestFile('target.txt', content);
      const symlinkPath = path.join(testDir, 'symlink.txt');

      await fs.promises.symlink(targetPath, symlinkPath);

      const snapshot = await (orchestrator as any).createFileSnapshot(symlinkPath, true);

      expect(snapshot).toBeDefined();
      expect(snapshot.content).toBe(content);
      expect(snapshot.filePath).toBe(symlinkPath);
    });

    it('should handle concurrent file modifications during snapshot creation', async () => {
      const filePath = await createTestFile('concurrent.txt', 'initial');

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          (async () => {
            await fs.promises.writeFile(filePath, `content-${i}`, 'utf8');
            return (orchestrator as any).createFileSnapshot(filePath, true);
          })()
        );
      }

      const snapshots = await Promise.all(promises);

      expect(snapshots).toHaveLength(5);
      snapshots.forEach(snapshot => {
        expect(snapshot).toBeDefined();
        expect(snapshot.content).toMatch(/^content-\d$/);
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle multiple rapid tool executions', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const filePath = await createTestFile(`rapid-${i}.txt`, `content-${i}`);

        const toolExecution = {
          callId: crypto.randomUUID(),
          toolName: 'Write',
          input: { file_path: filePath },
          taskId: testTask.id,
          agentName: 'test',
          stageName: 'test',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          status: 'completed' as const,
        };

        promises.push(
          (orchestrator as any).recordFileModifyingToolAction(testTask.id, toolExecution)
        );
      }

      await Promise.all(promises);

      const toolActionStore = (orchestrator as any).toolActionStore;
      const actions = await toolActionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(10);
    });

    it('should handle binary file snapshot gracefully', async () => {
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
      const filePath = path.join(testDir, 'binary.png');
      await fs.promises.writeFile(filePath, binaryContent);

      // This will read the binary file as UTF-8, which may produce garbled text
      // but should not crash
      const snapshot = await (orchestrator as any).createFileSnapshot(filePath, true);

      expect(snapshot).toBeDefined();
      expect(snapshot.fileSize).toBe(binaryContent.length);
      expect(typeof snapshot.content).toBe('string');
    });
  });
});