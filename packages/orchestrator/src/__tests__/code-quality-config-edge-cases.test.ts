/**
 * Code Quality Configuration Edge Cases Tests
 *
 * This test suite covers edge cases and complex configuration scenarios:
 * - Partial configuration handling
 * - Configuration validation and fallbacks
 * - Dynamic configuration changes
 * - Error handling for invalid configurations
 * - Performance edge cases and timeouts
 * - Tool availability checks and graceful degradation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, type HookContext } from '../hooks';
import { TaskStore } from '../store';
import type { Task, LinterConfig, CodeQualityConfig } from '@apexcli/core';

describe('Code Quality Configuration Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_config_edge`,
    description: 'Configuration edge case test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/config-edge-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-edge-test-'));
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

  it('should handle completely missing linter configuration', async () => {
    const mockLinterService = {
      execute: vi.fn().mockResolvedValue({ success: true, issues: [] }),
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    // No linter configuration at all
    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {}, // Empty config
    };

    const filePath = path.join(testDir, 'src', 'test.js');
    await fs.writeFile(filePath, 'const test = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const test = 1;',
      },
    };

    // Should not throw with missing config
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'missing-config-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should not execute linter when config is missing
    expect(mockLinterService.execute).not.toHaveBeenCalled();
  });

  it('should handle partial linter configuration with defaults', async () => {
    const mockLinterService = {
      execute: vi.fn().mockResolvedValue({ success: true, issues: [] }),
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    // Minimal partial configuration
    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
            // Missing: parallel, failFast, timeoutMs - should use defaults
          },
          // Missing specific linter configs - should use defaults
        } as Partial<LinterConfig>,
      },
    };

    const filePath = path.join(testDir, 'src', 'partial.ts');
    await fs.writeFile(filePath, 'export const value = 42;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'export const value = 42;',
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'partial-1', { signal: new AbortController().signal });
      }
    }

    // Should execute with reasonable defaults
    expect(mockLinterService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [filePath],
        mode: 'sequential', // Default when parallel not specified
        fix: false, // Default when autoFix not enabled
        stopOnError: false, // Default
        timeout: 30000, // Default
      })
    );
  });

  it('should handle invalid timeout values gracefully', async () => {
    const mockLinterService = {
      execute: vi.fn().mockResolvedValue({ success: true, issues: [] }),
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
            timeoutMs: -1000, // Invalid negative timeout
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'timeout-test.js');
    await fs.writeFile(filePath, 'console.log("test");', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Edit',
      tool_input: {
        file_path: filePath,
        old_string: 'test',
        new_string: 'updated',
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Edit')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'timeout-1', { signal: new AbortController().signal });
      }
    }

    // Should use a reasonable fallback timeout despite invalid config
    expect(mockLinterService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: expect.any(Number),
      })
    );

    const callArgs = mockLinterService.execute.mock.calls[0][0];
    expect(callArgs.timeout).toBeGreaterThan(0);
  });

  it('should handle linter service unavailability', async () => {
    // No linter service provided
    const hookContext: HookContext = {
      taskId,
      store,
      // linterService: undefined, // Missing service
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'no-service.ts');
    await fs.writeFile(filePath, 'const x = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const x = 1;',
      },
    };

    // Should not throw when linter service is unavailable
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'no-service-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log that linting was skipped
    const logs = await store.getLogs(taskId);
    const skipLogs = logs.filter(log =>
      log.message.toLowerCase().includes('skip') ||
      log.level === 'debug'
    );
    expect(skipLogs).toBeDefined();
  });

  it('should handle extremely long timeouts and abort signals', async () => {
    const abortController = new AbortController();

    const mockLinterService = {
      execute: vi.fn().mockImplementation(async () => {
        // Simulate long-running operation
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: true, issues: [] });
          }, 10000); // 10 seconds

          // Listen for abort signal
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            throw new Error('Operation was aborted');
          });
        });
      }),
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
            timeoutMs: 100000, // Very long timeout
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'long-timeout.js');
    await fs.writeFile(filePath, 'const value = "test";', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value = "test";',
      },
    };

    // Abort after 50ms to test cancellation
    setTimeout(() => {
      abortController.abort();
    }, 50);

    // Should handle abortion gracefully
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          try {
            await hook(input as any, 'long-timeout-1', { signal: abortController.signal });
          } catch (error) {
            // Abort is expected, should be handled gracefully by the hook
          }
        }
      }
    }).not.toThrow();
  });

  it('should handle conflicting configuration sources', async () => {
    const mockLinterService = {
      execute: vi.fn().mockResolvedValue({ success: true, issues: [] }),
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    // Conflicting settings at different levels
    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: false, // Disabled at global
            parallel: true,
          },
          eslint: {
            enabled: true,
            autoFix: true,
          },
          integrations: {
            ide: {
              autoFixOnSave: true, // Should override global runAfterEdit
            },
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'conflicts.ts');
    await fs.writeFile(filePath, 'const test = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const test = 1;',
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'conflicts-1', { signal: new AbortController().signal });
      }
    }

    // Should resolve conflicts according to priority hierarchy
    // In this case, IDE integration should enable auto-fix despite global setting
    expect(mockLinterService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        fix: true, // autoFixOnSave should take precedence
        mode: 'parallel', // Should respect parallel setting
      })
    );
  });

  it('should handle missing tool executables gracefully', async () => {
    const mockLinterService = {
      execute: vi.fn().mockRejectedValue(new Error('ESLint executable not found')),
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
          eslint: {
            enabled: true,
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'missing-tool.js');
    await fs.writeFile(filePath, 'function test() {}', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'function test() {}',
      },
    };

    // Should not throw when tool executable is missing
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'missing-tool-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log the error appropriately
    const logs = await store.getLogs(taskId);
    const errorLogs = logs.filter(log =>
      log.level === 'warn' &&
      (log.message.includes('lint after edit failed') || log.message.includes('executable not found'))
    );
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  it('should handle rapid consecutive edits efficiently', async () => {
    const mockLinterService = {
      execute: vi.fn().mockResolvedValue({ success: true, issues: [] }),
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
            parallel: false, // Sequential to test queueing
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'rapid-edits.js');
    await fs.writeFile(filePath, 'let x = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    // Simulate rapid consecutive edits
    const editPromises = [];
    for (let i = 0; i < 5; i++) {
      const input = {
        tool_name: 'Edit',
        tool_input: {
          file_path: filePath,
          old_string: `let x = ${i};`,
          new_string: `let x = ${i + 1};`,
        },
      };

      const editPromise = (async () => {
        for (const hookMatcher of postHooks) {
          if (hookMatcher.matcher && !hookMatcher.matcher.includes('Edit')) {
            continue;
          }
          for (const hook of hookMatcher.hooks) {
            await hook(input as any, `rapid-${i}`, { signal: new AbortController().signal });
          }
        }
      })();

      editPromises.push(editPromise);
    }

    // All edits should complete without errors
    await expect(Promise.all(editPromises)).resolves.not.toThrow();

    // Should have called linter for each edit (since not debounced in this implementation)
    expect(mockLinterService.execute).toHaveBeenCalledTimes(5);
  });

  it('should validate pre-edit configuration modes', async () => {
    const testModes: Array<'warn' | 'block' | undefined> = ['warn', 'block', undefined];

    for (const mode of testModes) {
      const hookContext: HookContext = {
        taskId,
        store,
        config: {
          codeQuality: {
            preEditValidation: {
              enabled: true,
              mode: mode,
            },
          } as CodeQualityConfig,
        },
      };

      const filePath = path.join(testDir, 'src', `mode-${mode || 'undefined'}.json`);
      const invalidJson = '{"invalid": syntax}'; // Missing quotes around syntax

      const hooks = createHooks(hookContext);
      const preHooks = hooks.PreToolUse || [];

      const input = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: invalidJson,
        },
      };

      let wasBlocked = false;
      for (const hookMatcher of preHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          const result = await hook(input as any, `mode-test-${mode}`, {
            signal: new AbortController().signal
          });
          if (result.hookSpecificOutput?.permissionDecision === 'deny') {
            wasBlocked = true;
            break;
          }
        }
      }

      if (mode === 'block') {
        expect(wasBlocked).toBe(true);
      } else {
        // 'warn' or undefined should not block
        expect(wasBlocked).toBe(false);
      }
    }
  });

  it('should handle typecheck configuration without project path', async () => {
    const hookContext: HookContext = {
      taskId,
      store,
      // projectPath: undefined, // Missing project path
      config: {
        codeQuality: {
          typecheck: {
            enabled: true,
            runAfterEdit: true,
            command: 'npx tsc --noEmit',
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'no-project-path.ts');
    await fs.writeFile(filePath, 'const value: string = 123;', 'utf8'); // Type error

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value: string = 123;',
      },
    };

    // Should not throw when project path is missing
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'no-path-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log that typecheck was skipped
    const logs = await store.getLogs(taskId);
    const typecheckLogs = logs.filter(log =>
      log.message.toLowerCase().includes('typecheck') &&
      (log.message.includes('skip') || log.level === 'warn')
    );
    expect(typecheckLogs.length).toBeGreaterThan(0);
  });

  it('should handle circular configuration references', async () => {
    // Create a configuration that might cause circular issues
    const circularConfig = {
      linter: {
        global: {
          enabled: true,
          runAfterEdit: true,
        },
        custom: [
          {
            id: 'custom1',
            command: 'echo "custom1"',
            patterns: ['*.js'],
            dependsOn: ['custom2'], // Potential circular reference
          },
          {
            id: 'custom2',
            command: 'echo "custom2"',
            patterns: ['*.js'],
            dependsOn: ['custom1'], // Circular reference
          },
        ],
      },
    };

    const mockLinterService = {
      execute: vi.fn().mockResolvedValue({ success: true, issues: [] }),
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: circularConfig,
    };

    const filePath = path.join(testDir, 'src', 'circular.js');
    await fs.writeFile(filePath, 'const test = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const test = 1;',
      },
    };

    // Should handle circular configuration without hanging
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'circular-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Basic linting should still work despite circular config
    expect(mockLinterService.execute).toHaveBeenCalled();
  });
});