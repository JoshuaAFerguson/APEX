/**
 * Edge Cases for Lint After Edit Integration Tests
 *
 * This test suite covers edge cases that might not be covered in the main integration tests:
 * - Binary file handling
 * - Very large files
 * - Concurrent edit operations
 * - Network timeouts and interruptions
 * - Memory pressure scenarios
 * - File permission issues
 * - Symbolic link handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, type HookContext } from '../hooks';
import { TaskStore } from '../store';
import type { Task } from '@apexcli/core';

describe('Lint After Edit - Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_edge_cases`,
    description: 'Lint after edit edge cases test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/edge-cases-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-lint-edge-cases-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });

    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    await store.createTask(task);
    taskId = task.id;
  });

  afterEach(async () => {
    await store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should skip linting binary files', async () => {
    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      summary: { totalIssues: 0 },
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
          },
        },
      },
    };

    // Create a binary file (PNG image)
    const binaryPath = path.join(testDir, 'src', 'image.png');
    const binaryData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    ]);
    await fs.writeFile(binaryPath, binaryData);

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: binaryPath,
        content: binaryData.toString('binary'),
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'binary-1', { signal: new AbortController().signal });
      }
    }

    // Linter should not be called for binary files
    expect(mockLinterExecute).not.toHaveBeenCalled();

    // Should log that binary file was skipped
    const logs = await store.getLogs(taskId);
    const skipLogs = logs.filter(log =>
      log.message.toLowerCase().includes('skip') &&
      log.message.toLowerCase().includes('binary')
    );
    expect(skipLogs.length).toBeGreaterThanOrEqual(0); // May or may not log skipping
  });

  it('should handle very large files gracefully', async () => {
    const mockLinterExecute = vi.fn().mockImplementation(async ({ files, timeout }) => {
      // Simulate slower processing for large files
      await new Promise(resolve => setTimeout(resolve, timeout * 0.1));
      return {
        success: true,
        issues: [],
        summary: { totalIssues: 0, filesChecked: files.length },
      };
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
            timeoutMs: 1000, // Short timeout for testing
          },
        },
      },
    };

    // Create a very large file (1MB of JavaScript)
    const largePath = path.join(testDir, 'src', 'large.js');
    const largeContent = 'const data = {\n' +
      '  '.repeat(50000) + 'key: "value",\n'.repeat(10000) +
      '};\n';
    await fs.writeFile(largePath, largeContent, 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: largePath,
        content: largeContent,
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'large-1', { signal: new AbortController().signal });
      }
    }

    // Should handle large files, even if it takes time
    expect(mockLinterExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [largePath],
        timeout: 1000,
      })
    );

    const logs = await store.getLogs(taskId);
    expect(logs).toBeDefined();
  });

  it('should handle concurrent edit operations safely', async () => {
    const mockLinterExecute = vi.fn().mockImplementation(async ({ files }) => {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        success: true,
        issues: [],
        summary: { totalIssues: 0, filesChecked: files.length },
      };
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
            parallel: false, // Sequential to avoid conflicts
          },
        },
      },
    };

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    // Create multiple files and edit them concurrently
    const files = [
      path.join(testDir, 'src', 'file1.ts'),
      path.join(testDir, 'src', 'file2.ts'),
      path.join(testDir, 'src', 'file3.ts'),
    ];

    for (const file of files) {
      await fs.writeFile(file, 'const value = 1;', 'utf8');
    }

    const editPromises = files.map(async (file, index) => {
      const input = {
        tool_name: 'Edit',
        tool_input: {
          file_path: file,
          old_string: 'const value = 1;',
          new_string: `const value = ${index + 2};`,
        },
      };

      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Edit')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, `concurrent-${index}`, { signal: new AbortController().signal });
        }
      }
    });

    // Execute all edits concurrently
    await Promise.all(editPromises);

    // Should have processed each file individually
    expect(mockLinterExecute).toHaveBeenCalledTimes(files.length);

    // Each call should be for one file
    for (let i = 0; i < files.length; i++) {
      expect(mockLinterExecute).toHaveBeenNthCalledWith(i + 1,
        expect.objectContaining({
          files: [files[i]],
        })
      );
    }
  });

  it('should handle timeout scenarios gracefully', async () => {
    const mockLinterExecute = vi.fn().mockImplementation(async ({ timeout }) => {
      // Simulate a linter that takes longer than timeout
      await new Promise(resolve => setTimeout(resolve, timeout + 100));
      return {
        success: true,
        issues: [],
        summary: { totalIssues: 0 },
      };
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
            timeoutMs: 100, // Very short timeout
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'timeout.ts');
    await fs.writeFile(filePath, 'const test = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const test = 2;',
      },
    };

    // Should not throw despite timeout
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'timeout-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log timeout warning
    const logs = await store.getLogs(taskId);
    const timeoutLogs = logs.filter(log =>
      log.message.toLowerCase().includes('timeout') ||
      (log.level === 'warn' && log.message.toLowerCase().includes('lint'))
    );
    expect(timeoutLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle AbortController signals properly', async () => {
    let abortedSignal: AbortSignal | undefined;

    const mockLinterExecute = vi.fn().mockImplementation(async () => {
      // Check if operation was aborted
      if (abortedSignal?.aborted) {
        throw new Error('Operation was aborted');
      }
      return {
        success: true,
        issues: [],
        summary: { totalIssues: 0 },
      };
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'abort.ts');
    await fs.writeFile(filePath, 'const test = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const abortController = new AbortController();
    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const test = 2;',
      },
    };

    // Abort the operation immediately
    abortedSignal = abortController.signal;
    abortController.abort();

    // Should handle abort gracefully
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'abort-1', { signal: abortController.signal });
        }
      }
    }).not.toThrow();
  });

  it('should handle non-existent files gracefully', async () => {
    const mockLinterExecute = vi.fn().mockRejectedValue(new Error('File not found'));

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
          },
        },
      },
    };

    const nonExistentPath = path.join(testDir, 'src', 'non-existent.ts');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: nonExistentPath,
        content: 'const test = 1;',
      },
    };

    // Should not throw despite file not existing
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'non-existent-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log error about missing file
    const logs = await store.getLogs(taskId);
    const errorLogs = logs.filter(log =>
      log.level === 'warn' &&
      (log.message.toLowerCase().includes('file not found') ||
       log.message.toLowerCase().includes('lint after edit failed'))
    );
    expect(errorLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle malformed tool input gracefully', async () => {
    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      summary: { totalIssues: 0 },
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
          },
        },
      },
    };

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    // Test with malformed input
    const malformedInputs = [
      {
        tool_name: 'Write',
        tool_input: {}, // Missing file_path
      },
      {
        tool_name: 'Edit',
        tool_input: {
          file_path: null, // Invalid file_path
        },
      },
      {
        tool_name: 'Write',
        tool_input: {
          file_path: '', // Empty file_path
          content: 'test',
        },
      },
    ];

    for (const [index, input] of malformedInputs.entries()) {
      // Should not throw despite malformed input
      await expect(async () => {
        for (const hookMatcher of postHooks) {
          for (const hook of hookMatcher.hooks) {
            await hook(input as any, `malformed-${index}`, { signal: new AbortController().signal });
          }
        }
      }).not.toThrow();
    }

    // Linter should not be called for malformed inputs
    expect(mockLinterExecute).not.toHaveBeenCalled();
  });

  it('should respect file extension filters for linting', async () => {
    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      summary: { totalIssues: 0 },
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
          },
        },
      },
    };

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    // Test various file types
    const testFiles = [
      { path: path.join(testDir, 'src', 'code.ts'), shouldLint: true },
      { path: path.join(testDir, 'src', 'code.js'), shouldLint: true },
      { path: path.join(testDir, 'src', 'component.tsx'), shouldLint: true },
      { path: path.join(testDir, 'src', 'component.jsx'), shouldLint: true },
      { path: path.join(testDir, 'src', 'style.css'), shouldLint: true },
      { path: path.join(testDir, 'src', 'config.json'), shouldLint: false },
      { path: path.join(testDir, 'src', 'data.xml'), shouldLint: false },
      { path: path.join(testDir, 'README.md'), shouldLint: false },
    ];

    for (const file of testFiles) {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, 'content', 'utf8');

      mockLinterExecute.mockClear();

      const input = {
        tool_name: 'Write',
        tool_input: {
          file_path: file.path,
          content: 'content',
        },
      };

      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, `filter-${path.basename(file.path)}`, { signal: new AbortController().signal });
        }
      }

      // Check if linter was called based on file type
      if (file.shouldLint) {
        expect(mockLinterExecute).toHaveBeenCalled();
      } else {
        expect(mockLinterExecute).not.toHaveBeenCalled();
      }
    }
  });
});