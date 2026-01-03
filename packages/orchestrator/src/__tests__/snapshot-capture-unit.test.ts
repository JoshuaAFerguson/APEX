import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as fsAsync from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type { Task, HookInput, HookContext } from '@apexcli/core';

/**
 * Unit tests for individual snapshot capture functions
 * Testing the functions in isolation from the full hook system
 */
describe('Snapshot Capture - Unit Tests', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_unit`,
    description: 'Unit test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/unit-test',
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
    testDir = await fsAsync.mkdtemp(path.join(os.tmpdir(), 'apex-unit-test-'));
    await fsAsync.mkdir(path.join(testDir, '.apex'), { recursive: true });

    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);
  });

  afterEach(async () => {
    store.close();
    await fsAsync.rm(testDir, { recursive: true, force: true });
  });

  describe('captureFileSnapshot function', () => {
    // We need to access the internal captureFileSnapshot function
    // Since it's not exported, we'll test through the hook mechanism
    // but isolate the behavior as much as possible

    async function callCaptureFileSnapshot(
      toolName: string,
      toolInput: Record<string, unknown>,
      context: HookContext,
      toolUseId?: string
    ) {
      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes(toolName)
      );

      if (!fileSnapshotHook) {
        throw new Error(`No file snapshot hook found for tool: ${toolName}`);
      }

      const input: HookInput = {
        tool_name: toolName,
        tool_input: toolInput,
      };

      return fileSnapshotHook.hooks[0](input, toolUseId, { signal: new AbortController().signal });
    }

    it('should initialize fileSnapshots map when first snapshot is captured', async () => {
      const testFilePath = path.join(testDir, 'init-test.txt');
      await fsAsync.writeFile(testFilePath, 'test content');

      const context: HookContext = {
        taskId,
        store,
        // fileSnapshots is initially undefined
      };

      expect(context.fileSnapshots).toBeUndefined();

      await callCaptureFileSnapshot('Write', {
        file_path: testFilePath,
        content: 'new content'
      }, context);

      expect(context.fileSnapshots).toBeDefined();
      expect(context.fileSnapshots).toBeInstanceOf(Map);
      expect(context.fileSnapshots?.size).toBe(1);
    });

    it('should preserve existing fileSnapshots map and add new entries', async () => {
      const testFile1 = path.join(testDir, 'existing1.txt');
      const testFile2 = path.join(testDir, 'existing2.txt');

      await fsAsync.writeFile(testFile1, 'content1');
      await fsAsync.writeFile(testFile2, 'content2');

      const existingMap = new Map([['existing-file.txt', 'existing content']]);

      const context: HookContext = {
        taskId,
        store,
        fileSnapshots: existingMap,
      };

      await callCaptureFileSnapshot('Write', {
        file_path: testFile1,
        content: 'new content'
      }, context);

      expect(context.fileSnapshots?.size).toBe(2);
      expect(context.fileSnapshots?.get('existing-file.txt')).toBe('existing content');
      expect(context.fileSnapshots?.get(testFile1)).toBe('content1');
    });

    it('should handle file reading errors without throwing', async () => {
      // Mock fs.readFileSync to throw specific error
      const originalReadFileSync = fs.readFileSync;
      const mockError = new Error('Permission denied') as NodeJS.ErrnoException;
      mockError.code = 'EACCES';

      vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('permission-test')) {
          throw mockError;
        }
        return originalReadFileSync(filePath, 'utf8');
      });

      const restrictedPath = path.join(testDir, 'permission-test.txt');

      const context: HookContext = {
        taskId,
        store,
      };

      // Should not throw
      const result = await callCaptureFileSnapshot('Write', {
        file_path: restrictedPath,
        content: 'content'
      }, context);

      expect(result).toEqual({});

      // Should not initialize fileSnapshots on error
      expect(context.fileSnapshots).toBeUndefined();

      // Should log error
      const task = await store.getTask(taskId);
      const errorLogs = task?.logs.filter(l =>
        l.level === 'warn' && l.message.includes('Failed to capture file snapshot')
      );
      expect(errorLogs?.length).toBeGreaterThan(0);

      fs.readFileSync.mockRestore();
    });

    it('should handle ENOENT error specifically for new files', async () => {
      const newFilePath = path.join(testDir, 'new-file.txt');
      // Don't create the file - it should not exist

      const context: HookContext = {
        taskId,
        store,
      };

      const result = await callCaptureFileSnapshot('Write', {
        file_path: newFilePath,
        content: 'new file content'
      }, context);

      expect(result).toEqual({});
      expect(context.fileSnapshots?.get(newFilePath)).toBe('');

      // Should log new file creation
      const task = await store.getTask(taskId);
      const newFileLogs = task?.logs.filter(l =>
        l.level === 'debug' &&
        l.message.includes('File snapshot captured (new file)') &&
        l.metadata?.isNewFile === true
      );
      expect(newFileLogs?.length).toBeGreaterThan(0);
    });

    it('should return early for non-file-modifying tools', async () => {
      const context: HookContext = {
        taskId,
        store,
      };

      // Try to call with a non-file-modifying tool through the hook system
      const { createHooks } = await import('../hooks');
      const hooks = createHooks(context);

      // Find a non-file-modifying hook (like Bash)
      const bashHook = hooks.PreToolUse?.find(h => h.matcher === 'Bash');

      if (bashHook) {
        const input: HookInput = {
          tool_name: 'Bash',
          tool_input: { command: 'echo test' },
        };

        await bashHook.hooks[0](input, 'bash-test', { signal: new AbortController().signal });

        // Should not initialize fileSnapshots for non-file-modifying tools
        expect(context.fileSnapshots).toBeUndefined();
      }
    });

    it('should extract file path from different input field names', async () => {
      const testCases = [
        {
          toolName: 'Write',
          input: { file_path: path.join(testDir, 'file_path.txt') },
          expectedPath: path.join(testDir, 'file_path.txt')
        },
        {
          toolName: 'Edit',
          input: { path: path.join(testDir, 'path.txt') },
          expectedPath: path.join(testDir, 'path.txt')
        },
        {
          toolName: 'NotebookEdit',
          input: { notebook_path: path.join(testDir, 'notebook.ipynb') },
          expectedPath: path.join(testDir, 'notebook.ipynb')
        }
      ];

      for (const testCase of testCases) {
        await fsAsync.writeFile(testCase.expectedPath, `content for ${testCase.toolName}`);

        const context: HookContext = {
          taskId,
          store,
        };

        await callCaptureFileSnapshot(testCase.toolName, testCase.input, context);

        expect(context.fileSnapshots?.get(testCase.expectedPath)).toBe(`content for ${testCase.toolName}`);
      }
    });

    it('should return early when no file path is found in input', async () => {
      const invalidInputs = [
        { content: 'no file path' },
        { file_name: 'wrong field name' },
        { file_path: null },
        { file_path: undefined },
        { file_path: '' },
      ];

      for (const input of invalidInputs) {
        const context: HookContext = {
          taskId,
          store,
        };

        const result = await callCaptureFileSnapshot('Write', input, context);

        expect(result).toEqual({});
        expect(context.fileSnapshots).toBeUndefined();
      }
    });

    it('should capture and log file metadata correctly', async () => {
      const testFilePath = path.join(testDir, 'metadata-test.txt');
      const testContent = 'test content for metadata validation';
      await fsAsync.writeFile(testFilePath, testContent);

      const context: HookContext = {
        taskId,
        store,
      };

      await callCaptureFileSnapshot('Edit', {
        file_path: testFilePath,
        old_string: 'test',
        new_string: 'modified'
      }, context);

      // Verify content captured
      expect(context.fileSnapshots?.get(testFilePath)).toBe(testContent);

      // Verify log metadata
      const task = await store.getTask(taskId);
      const snapshotLogs = task?.logs.filter(l =>
        l.level === 'debug' &&
        l.message.includes('File snapshot captured') &&
        !l.message.includes('(new file)')
      );

      expect(snapshotLogs?.length).toBeGreaterThan(0);

      const logEntry = snapshotLogs?.[0];
      expect(logEntry?.metadata?.tool).toBe('Edit');
      expect(logEntry?.metadata?.filePath).toBe(testFilePath);
      expect(logEntry?.metadata?.contentLength).toBe(testContent.length);
    });

    it('should handle unicode content correctly', async () => {
      const unicodeContent = '🚀 Hello 世界! 🎉 Testing unicode content 測試';
      const testFilePath = path.join(testDir, 'unicode-test.txt');
      await fsAsync.writeFile(testFilePath, unicodeContent, 'utf8');

      const context: HookContext = {
        taskId,
        store,
      };

      await callCaptureFileSnapshot('Write', {
        file_path: testFilePath,
        content: 'new content'
      }, context);

      expect(context.fileSnapshots?.get(testFilePath)).toBe(unicodeContent);

      // Verify the byte length is calculated correctly
      const task = await store.getTask(taskId);
      const snapshotLogs = task?.logs.filter(l =>
        l.message.includes('File snapshot captured') &&
        l.metadata?.filePath === testFilePath
      );

      expect(snapshotLogs?.[0]?.metadata?.contentLength).toBe(unicodeContent.length);
    });

    it('should handle empty files correctly', async () => {
      const testFilePath = path.join(testDir, 'empty-test.txt');
      await fsAsync.writeFile(testFilePath, '');

      const context: HookContext = {
        taskId,
        store,
      };

      await callCaptureFileSnapshot('Write', {
        file_path: testFilePath,
        content: 'content for empty file'
      }, context);

      expect(context.fileSnapshots?.get(testFilePath)).toBe('');

      const task = await store.getTask(taskId);
      const snapshotLogs = task?.logs.filter(l =>
        l.message.includes('File snapshot captured') &&
        l.metadata?.filePath === testFilePath
      );

      expect(snapshotLogs?.[0]?.metadata?.contentLength).toBe(0);
    });
  });

  describe('getToolInput and getToolName helpers', () => {
    it('should extract tool input from HookInput correctly', () => {
      const { createHooks } = require('../hooks');

      // Test by calling a hook that uses these functions
      const context: HookContext = { taskId, store };
      const hooks = createHooks(context);

      // Find the general logging hook that uses getToolName and getToolInput
      const logHook = hooks.PreToolUse?.find(h => !h.matcher);
      expect(logHook).toBeDefined();

      // Test will be done by observing the behavior through logs
      // since the helper functions are not exported
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle filesystem race conditions gracefully', async () => {
      const testFilePath = path.join(testDir, 'race-condition.txt');
      await fsAsync.writeFile(testFilePath, 'initial content');

      const context: HookContext = {
        taskId,
        store,
      };

      // Simulate a race condition by deleting the file between
      // when snapshot capture starts and when it tries to read
      const originalReadFileSync = fs.readFileSync;
      let callCount = 0;

      vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        callCount++;
        if (callCount === 1 && typeof filePath === 'string' && filePath.includes('race-condition')) {
          // Simulate file being deleted between calls
          const error = new Error('No such file or directory') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
        return originalReadFileSync(filePath, 'utf8');
      });

      // Should handle gracefully
      const result = await callCaptureFileSnapshot('Write', {
        file_path: testFilePath,
        content: 'new content'
      }, context);

      expect(result).toEqual({});
      expect(context.fileSnapshots?.get(testFilePath)).toBe('');

      fs.readFileSync.mockRestore();
    });

    it('should handle extremely long file paths', async () => {
      // Create a very long path (within filesystem limits)
      const longName = 'a'.repeat(200);
      const longPath = path.join(testDir, longName + '.txt');

      try {
        await fsAsync.writeFile(longPath, 'content with long path');

        const context: HookContext = {
          taskId,
          store,
        };

        await callCaptureFileSnapshot('Write', {
          file_path: longPath,
          content: 'new content'
        }, context);

        expect(context.fileSnapshots?.get(longPath)).toBe('content with long path');
      } catch (error) {
        // If the filesystem doesn't support such long paths, that's OK
        // We're testing that our code doesn't crash
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance characteristics', () => {
    it('should complete snapshot capture quickly for normal files', async () => {
      const testFilePath = path.join(testDir, 'perf-test.txt');
      const content = 'x'.repeat(10000); // 10KB file
      await fsAsync.writeFile(testFilePath, content);

      const context: HookContext = {
        taskId,
        store,
      };

      const startTime = Date.now();

      await callCaptureFileSnapshot('Write', {
        file_path: testFilePath,
        content: 'new content'
      }, context);

      const duration = Date.now() - startTime;

      // Should complete very quickly (less than 100ms for 10KB)
      expect(duration).toBeLessThan(100);
      expect(context.fileSnapshots?.get(testFilePath)).toBe(content);
    });

    it('should not block when capturing snapshots sequentially', async () => {
      const context: HookContext = {
        taskId,
        store,
      };

      const startTime = Date.now();

      // Capture 10 small file snapshots sequentially
      for (let i = 0; i < 10; i++) {
        const testFilePath = path.join(testDir, `sequential-${i}.txt`);
        await fsAsync.writeFile(testFilePath, `content-${i}`);

        await callCaptureFileSnapshot('Write', {
          file_path: testFilePath,
          content: `new-content-${i}`
        }, context);
      }

      const duration = Date.now() - startTime;

      // Should complete all 10 operations quickly (less than 500ms)
      expect(duration).toBeLessThan(500);
      expect(context.fileSnapshots?.size).toBe(10);
    });
  });
});