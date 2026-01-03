import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, HookContext } from '../hooks';
import { TaskStore, ToolActionStore } from '../store';
import type { Task } from '@apexcli/core';

/**
 * Supplemental tests for snapshot capture functionality
 * Focusing on additional edge cases and coverage gaps
 */
describe('Snapshot Capture - Supplemental Tests', () => {
  let testDir: string;
  let store: TaskStore;
  let toolActionStore: ToolActionStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_supplemental`,
    description: 'Supplemental test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/supplemental-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-supplemental-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    store = new TaskStore(testDir);
    await store.initialize();

    toolActionStore = new ToolActionStore(store);

    const task = createTestTask();
    taskId = task.id;
    await store.createTask(task);
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('File Path Edge Cases', () => {
    it('should handle files with special characters in name', async () => {
      const specialFileName = 'test file & [special] (chars).txt';
      const testFilePath = path.join(testDir, specialFileName);
      const content = 'content with special file name';
      await fs.writeFile(testFilePath, content);

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const input = {
        tool_name: 'Write',
        tool_input: { file_path: testFilePath, content: 'new content' },
      };

      await fileSnapshotHook?.hooks[0](input, 'special-chars-test', { signal: new AbortController().signal });

      expect(context.fileSnapshots?.get(testFilePath)).toBe(content);
    });

    it('should handle deeply nested file paths', async () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', 'd', 'e', 'deep-file.txt');
      await fs.mkdir(path.dirname(deepPath), { recursive: true });
      await fs.writeFile(deepPath, 'deep content');

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Edit')
      );

      const input = {
        tool_name: 'Edit',
        tool_input: {
          file_path: deepPath,
          old_string: 'deep',
          new_string: 'deeper'
        },
      };

      await fileSnapshotHook?.hooks[0](input, 'deep-path-test', { signal: new AbortController().signal });

      expect(context.fileSnapshots?.get(deepPath)).toBe('deep content');
    });

    it('should handle relative path normalization', async () => {
      const relativeInputPath = './relative-test.txt';
      const absolutePath = path.resolve(testDir, 'relative-test.txt');
      await fs.writeFile(absolutePath, 'relative content');

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };

      // Change working directory to testDir for relative path test
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);

        const hooks = createHooks(context);

        const fileSnapshotHook = hooks.PreToolUse?.find(h =>
          Array.isArray(h.matcher) && h.matcher.includes('Write')
        );

        const input = {
          tool_name: 'Write',
          tool_input: { file_path: relativeInputPath, content: 'new content' },
        };

        await fileSnapshotHook?.hooks[0](input, 'relative-path-test', { signal: new AbortController().signal });

        // Should capture content using the relative path as provided
        expect(context.fileSnapshots?.get(relativeInputPath)).toBe('relative content');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Tool Input Variations', () => {
    it('should handle Edit tool with path field instead of file_path', async () => {
      const testFilePath = path.join(testDir, 'path-field.txt');
      await fs.writeFile(testFilePath, 'path field content');

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Edit')
      );

      const input = {
        tool_name: 'Edit',
        tool_input: {
          path: testFilePath, // Using 'path' instead of 'file_path'
          old_string: 'path',
          new_string: 'modified'
        },
      };

      await fileSnapshotHook?.hooks[0](input, 'path-field-test', { signal: new AbortController().signal });

      expect(context.fileSnapshots?.get(testFilePath)).toBe('path field content');
    });

    it('should skip snapshot for tools with no file path', async () => {
      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const input = {
        tool_name: 'Write',
        tool_input: { content: 'content without file path' }, // Missing file_path
      };

      const result = await fileSnapshotHook?.hooks[0](input, 'no-path-test', { signal: new AbortController().signal });

      expect(result).toEqual({});
      expect(context.fileSnapshots).toBeUndefined(); // Should not initialize map
    });

    it('should handle malformed tool input gracefully', async () => {
      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const malformedInputs = [
        { tool_name: 'Write', tool_input: null },
        { tool_name: 'Write', tool_input: undefined },
        { tool_name: 'Write', tool_input: 'not an object' },
        { tool_name: 'Write', tool_input: { file_path: null } },
        { tool_name: 'Write', tool_input: { file_path: 123 } },
        { tool_name: 'Write', tool_input: { file_path: [] } },
      ];

      for (const input of malformedInputs) {
        const result = await fileSnapshotHook?.hooks[0](input as any, 'malformed-test', { signal: new AbortController().signal });
        expect(result).toEqual({});
      }
    });
  });

  describe('Context Initialization Edge Cases', () => {
    it('should handle context without toolActionStore', async () => {
      const testFilePath = path.join(testDir, 'no-store.txt');
      await fs.writeFile(testFilePath, 'content without store');

      const context: HookContext = {
        taskId,
        store,
        // toolActionStore: undefined (missing)
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const input = {
        tool_name: 'Write',
        tool_input: { file_path: testFilePath, content: 'new content' },
      };

      // Should still capture snapshot even without toolActionStore
      await fileSnapshotHook?.hooks[0](input, 'no-store-test', { signal: new AbortController().signal });

      expect(context.fileSnapshots?.get(testFilePath)).toBe('content without store');
    });

    it('should handle context without current agent/stage', async () => {
      const testFilePath = path.join(testDir, 'no-agent.txt');
      await fs.writeFile(testFilePath, 'content without agent');

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        // currentAgent: undefined
        // currentStage: undefined
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const input = {
        tool_name: 'Write',
        tool_input: { file_path: testFilePath, content: 'new content' },
      };

      await fileSnapshotHook?.hooks[0](input, 'no-agent-test', { signal: new AbortController().signal });

      expect(context.fileSnapshots?.get(testFilePath)).toBe('content without agent');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent snapshot captures for different files', async () => {
      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      // Create multiple test files
      const filePromises = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `concurrent-${i}.txt`);
        filePromises.push(fs.writeFile(filePath, `content-${i}`));
      }
      await Promise.all(filePromises);

      // Capture snapshots concurrently
      const capturePromises = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `concurrent-${i}.txt`);
        const input = {
          tool_name: 'Write',
          tool_input: { file_path: filePath, content: `new-content-${i}` },
        };
        capturePromises.push(
          fileSnapshotHook?.hooks[0](input, `concurrent-${i}`, { signal: new AbortController().signal })
        );
      }

      await Promise.all(capturePromises);

      // Verify all snapshots captured
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `concurrent-${i}.txt`);
        expect(context.fileSnapshots?.get(filePath)).toBe(`content-${i}`);
      }

      expect(context.fileSnapshots?.size).toBe(5);
    });

    it('should handle concurrent captures of same file gracefully', async () => {
      const testFilePath = path.join(testDir, 'same-file.txt');
      await fs.writeFile(testFilePath, 'original');

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      // Attempt multiple concurrent captures of same file
      const capturePromises = [];
      for (let i = 0; i < 3; i++) {
        const input = {
          tool_name: 'Write',
          tool_input: { file_path: testFilePath, content: `attempt-${i}` },
        };
        capturePromises.push(
          fileSnapshotHook?.hooks[0](input, `same-file-${i}`, { signal: new AbortController().signal })
        );
      }

      await Promise.all(capturePromises);

      // Should capture the content (last write wins in map)
      expect(context.fileSnapshots?.has(testFilePath)).toBe(true);
      expect(context.fileSnapshots?.get(testFilePath)).toBe('original');
      expect(context.fileSnapshots?.size).toBe(1);
    });
  });

  describe('Logging Verification', () => {
    it('should create properly structured log entries', async () => {
      const testFilePath = path.join(testDir, 'log-structure.txt');
      const content = 'structured log content';
      await fs.writeFile(testFilePath, content);

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const input = {
        tool_name: 'Write',
        tool_input: { file_path: testFilePath, content: 'new content' },
      };

      await fileSnapshotHook?.hooks[0](input, 'log-structure-test', { signal: new AbortController().signal });

      // Verify log structure
      const task = await store.getTask(taskId);
      const snapshotLogs = task?.logs.filter(l =>
        l.message.includes('File snapshot captured') && !l.message.includes('(new file)')
      );

      expect(snapshotLogs?.length).toBeGreaterThan(0);

      const logEntry = snapshotLogs?.[0];
      expect(logEntry?.level).toBe('debug');
      expect(logEntry?.metadata?.tool).toBe('Write');
      expect(logEntry?.metadata?.filePath).toBe(testFilePath);
      expect(logEntry?.metadata?.contentLength).toBe(content.length);
      expect(typeof logEntry?.metadata?.contentLength).toBe('number');
    });

    it('should log errors appropriately', async () => {
      // Mock fs.readFileSync to throw an error
      const originalReadFileSync = require('fs').readFileSync;
      const mockReadFileSync = vi.fn().mockImplementation((filePath: string) => {
        if (filePath.includes('error-test')) {
          throw new Error('Mock filesystem error');
        }
        return originalReadFileSync(filePath, 'utf8');
      });

      // Replace fs.readFileSync
      require('fs').readFileSync = mockReadFileSync;

      try {
        const errorFilePath = path.join(testDir, 'error-test.txt');

        const context: HookContext = {
          taskId,
          store,
          toolActionStore,
          currentAgent: 'tester',
          currentStage: 'testing'
        };
        const hooks = createHooks(context);

        const fileSnapshotHook = hooks.PreToolUse?.find(h =>
          Array.isArray(h.matcher) && h.matcher.includes('Write')
        );

        const input = {
          tool_name: 'Write',
          tool_input: { file_path: errorFilePath, content: 'content' },
        };

        // Should not throw
        await expect(
          fileSnapshotHook?.hooks[0](input, 'error-logging-test', { signal: new AbortController().signal })
        ).resolves.toBeDefined();

        // Should log error
        const task = await store.getTask(taskId);
        const errorLogs = task?.logs.filter(l =>
          l.level === 'warn' && l.message.includes('Failed to capture file snapshot')
        );
        expect(errorLogs?.length).toBeGreaterThan(0);

        const errorLog = errorLogs?.[0];
        expect(errorLog?.metadata?.error).toContain('Mock filesystem error');
        expect(errorLog?.metadata?.filePath).toBe(errorFilePath);

      } finally {
        // Restore original function
        require('fs').readFileSync = originalReadFileSync;
      }
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large files efficiently', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB file
      const testFilePath = path.join(testDir, 'large-file.txt');
      await fs.writeFile(testFilePath, largeContent);

      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };

      const startTime = Date.now();

      const hooks = createHooks(context);
      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      const input = {
        tool_name: 'Write',
        tool_input: { file_path: testFilePath, content: 'new content' },
      };

      await fileSnapshotHook?.hooks[0](input, 'large-file-test', { signal: new AbortController().signal });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 1 second for 100KB)
      expect(duration).toBeLessThan(1000);

      // Should capture complete content
      expect(context.fileSnapshots?.get(testFilePath)).toBe(largeContent);
      expect(context.fileSnapshots?.get(testFilePath)?.length).toBe(largeContent.length);
    });

    it('should not leak memory with many snapshot operations', async () => {
      const context: HookContext = {
        taskId,
        store,
        toolActionStore,
        currentAgent: 'tester',
        currentStage: 'testing'
      };
      const hooks = createHooks(context);

      const fileSnapshotHook = hooks.PreToolUse?.find(h =>
        Array.isArray(h.matcher) && h.matcher.includes('Write')
      );

      // Perform many snapshot operations
      for (let i = 0; i < 50; i++) {
        const testFilePath = path.join(testDir, `memory-test-${i}.txt`);
        await fs.writeFile(testFilePath, `content-${i}`);

        const input = {
          tool_name: 'Write',
          tool_input: { file_path: testFilePath, content: `new-content-${i}` },
        };

        await fileSnapshotHook?.hooks[0](input, `memory-test-${i}`, { signal: new AbortController().signal });
      }

      // Should have accumulated all snapshots in memory
      expect(context.fileSnapshots?.size).toBe(50);

      // Verify some snapshots are correct
      expect(context.fileSnapshots?.get(path.join(testDir, 'memory-test-0.txt'))).toBe('content-0');
      expect(context.fileSnapshots?.get(path.join(testDir, 'memory-test-49.txt'))).toBe('content-49');
    });
  });
});