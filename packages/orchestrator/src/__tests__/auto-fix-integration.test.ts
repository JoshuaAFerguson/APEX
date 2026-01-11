/**
 * Auto-Fix Functionality Integration Tests
 *
 * This test suite focuses specifically on the auto-fix functionality:
 * - Auto-fix triggering through configuration
 * - Integration with ESLint and Prettier auto-fix capabilities
 * - Error handling during auto-fix operations
 * - File modification tracking and verification
 * - Auto-fix priority and conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, type HookContext } from '../hooks';
import { TaskStore } from '../store';
import type { Task } from '@apexcli/core';
import type { LintIssue, LintResult } from '../linter/plugin';

describe('Auto-Fix Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_autofix`,
    description: 'Auto-fix integration test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/autofix-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autofix-test-'));
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

  it('should auto-fix ESLint issues when autoFix is enabled', async () => {
    const filePath = path.join(testDir, 'src', 'component.js');

    // Issues that can be auto-fixed
    const fixableIssues: LintIssue[] = [
      {
        filePath,
        line: 1,
        column: 5,
        severity: 'warning',
        ruleId: 'prefer-const',
        message: "'value' is never reassigned. Use 'const' instead of 'let'.",
        linterId: 'eslint',
        fix: {
          description: 'Replace let with const',
          replacements: [{
            startOffset: 0,
            endOffset: 3,
            text: 'const',
          }],
        },
      },
      {
        filePath,
        line: 2,
        column: 15,
        severity: 'error',
        ruleId: 'semi',
        message: 'Missing semicolon.',
        linterId: 'eslint',
        fix: {
          description: 'Add semicolon',
          replacements: [{
            startOffset: 25,
            endOffset: 25,
            text: ';',
          }],
        },
      },
    ];

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: fixableIssues,
      linterResults: new Map([
        ['eslint', {
          success: true,
          issues: fixableIssues,
          filesChecked: 1,
          filesWithIssues: 1,
          duration: 100,
          fixesApplied: 2,
        }],
      ]),
      summary: {
        totalIssues: 2,
        errorCount: 1,
        warningCount: 1,
        infoCount: 0,
        hintCount: 0,
        filesChecked: 1,
        filesWithIssues: 1,
        lintersRun: 1,
        lintersSucceeded: 1,
        lintersFailed: 0,
        totalDuration: 100,
        fixesApplied: 2,
      },
      issuesByFile: new Map([[filePath, fixableIssues]]),
      issuesBySeverity: {
        error: [fixableIssues[1]],
        warning: [fixableIssues[0]],
        info: [],
        hint: [],
      },
    } as LintResult);

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
            parallel: false,
            failFast: false,
            timeoutMs: 30000,
          },
          eslint: {
            enabled: true,
            autoFix: true, // Auto-fix enabled
          },
          integrations: {
            ide: {
              autoFixOnSave: true,
            },
          },
        },
      },
    };

    const originalContent = 'let value = 42\nconsole.log(value)';
    await fs.writeFile(filePath, originalContent, 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: originalContent,
      },
    };

    // Execute lint-after-edit hook
    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'autofix-1', { signal: new AbortController().signal });
      }
    }

    // Verify linter was called with fix enabled
    expect(mockLinterExecute).toHaveBeenCalledWith({
      files: [filePath],
      mode: 'sequential',
      fix: true, // Should be true when autoFix is enabled
      stopOnError: false,
      timeout: 30000,
    });

    // Verify logs contain auto-fix information
    const logs = await store.getLogs(taskId);
    const autoFixLogs = logs.filter(log =>
      log.message.toLowerCase().includes('fix') ||
      log.metadata?.fixesApplied
    );
    expect(autoFixLogs.length).toBeGreaterThan(0);
  });

  it('should respect autoFix configuration hierarchy', async () => {
    const filePath = path.join(testDir, 'src', 'test.ts');

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

    // Test configuration hierarchy: ide.autoFixOnSave should take precedence
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
            autoFix: false, // Disabled at ESLint level
          },
          prettier: {
            enabled: true,
            autoFix: false, // Disabled at Prettier level
          },
          integrations: {
            ide: {
              autoFixOnSave: true, // But enabled at IDE level (highest priority)
            },
          },
        },
      },
    };

    await fs.writeFile(filePath, 'const test = 1;', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Edit',
      tool_input: {
        file_path: filePath,
        old_string: 'const test = 1;',
        new_string: 'const test = 2;',
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Edit')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'hierarchy-1', { signal: new AbortController().signal });
      }
    }

    // Should use fix=true because ide.autoFixOnSave takes precedence
    expect(mockLinterExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        fix: true,
      })
    );
  });

  it('should handle auto-fix failures gracefully', async () => {
    const filePath = path.join(testDir, 'src', 'broken.js');

    // Mock linter to fail during auto-fix
    const mockLinterExecute = vi.fn().mockRejectedValue(new Error('Auto-fix failed: File is corrupted'));

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
          integrations: {
            ide: {
              autoFixOnSave: true,
            },
          },
        },
      },
    };

    await fs.writeFile(filePath, 'invalid syntax {{{', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'invalid syntax {{{',
      },
    };

    // Should not throw despite auto-fix failure
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'fail-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Verify error was logged
    const logs = await store.getLogs(taskId);
    const errorLogs = logs.filter(log =>
      log.level === 'warn' &&
      log.message.toLowerCase().includes('lint after edit failed')
    );
    expect(errorLogs.length).toBeGreaterThan(0);
    expect(errorLogs[0].metadata?.error).toContain('Auto-fix failed');
  });

  it('should apply multiple linter auto-fixes in sequence', async () => {
    const filePath = path.join(testDir, 'src', 'multi-fix.ts');

    const eslintIssues: LintIssue[] = [
      {
        filePath,
        line: 1,
        column: 1,
        severity: 'warning',
        ruleId: 'prefer-const',
        message: "Variable never reassigned, use 'const' instead.",
        linterId: 'eslint',
        fix: {
          description: 'Replace let with const',
          replacements: [{
            startOffset: 0,
            endOffset: 3,
            text: 'const',
          }],
        },
      },
    ];

    const prettierIssues: LintIssue[] = [
      {
        filePath,
        line: 1,
        column: 10,
        severity: 'warning',
        ruleId: 'prettier/formatting',
        message: 'Code formatting issue',
        linterId: 'prettier',
        fix: {
          description: 'Format code',
          replacements: [{
            startOffset: 10,
            endOffset: 15,
            text: ' = 42;',
          }],
        },
      },
    ];

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: [...eslintIssues, ...prettierIssues],
      linterResults: new Map([
        ['eslint', {
          success: true,
          issues: eslintIssues,
          filesChecked: 1,
          filesWithIssues: 1,
          duration: 50,
          fixesApplied: 1,
        }],
        ['prettier', {
          success: true,
          issues: prettierIssues,
          filesChecked: 1,
          filesWithIssues: 1,
          duration: 30,
          fixesApplied: 1,
        }],
      ]),
      summary: {
        totalIssues: 2,
        errorCount: 0,
        warningCount: 2,
        infoCount: 0,
        hintCount: 0,
        filesChecked: 1,
        filesWithIssues: 1,
        lintersRun: 2,
        lintersSucceeded: 2,
        lintersFailed: 0,
        totalDuration: 80,
        fixesApplied: 2,
      },
      issuesByFile: new Map([[filePath, [...eslintIssues, ...prettierIssues]]]),
      issuesBySeverity: {
        error: [],
        warning: [...eslintIssues, ...prettierIssues],
        info: [],
        hint: [],
      },
    } as LintResult);

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
            parallel: false, // Sequential to ensure proper ordering
          },
          eslint: {
            enabled: true,
            autoFix: true,
          },
          prettier: {
            enabled: true,
            autoFix: true,
          },
          integrations: {
            ide: {
              autoFixOnSave: true,
            },
          },
        },
      },
    };

    const originalContent = 'let value=42';
    await fs.writeFile(filePath, originalContent, 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: originalContent,
      },
    };

    for (const hookMatcher of postHooks) {
      if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
        continue;
      }
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'multi-1', { signal: new AbortController().signal });
      }
    }

    // Verify both linters were applied
    expect(mockLinterExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [filePath],
        fix: true,
      })
    );

    // Check that the fix results were properly tracked
    const logs = await store.getLogs(taskId);
    const fixLogs = logs.filter(log =>
      log.metadata?.fixesApplied ||
      (log.metadata as any)?.summary?.fixesApplied
    );
    expect(fixLogs.length).toBeGreaterThan(0);
  });

  it('should handle auto-fix with different file types', async () => {
    const testFiles = [
      { path: path.join(testDir, 'src', 'component.tsx'), type: 'typescript-react' },
      { path: path.join(testDir, 'src', 'utils.ts'), type: 'typescript' },
      { path: path.join(testDir, 'src', 'script.js'), type: 'javascript' },
      { path: path.join(testDir, 'src', 'style.css'), type: 'css' },
    ];

    const mockLinterExecute = vi.fn();

    for (let i = 0; i < testFiles.length; i++) {
      const file = testFiles[i];
      mockLinterExecute.mockResolvedValueOnce({
        success: true,
        issues: [],
        summary: { totalIssues: 0, fixesApplied: i % 2 }, // Alternate between fixed/not fixed
      });
    }

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
          integrations: {
            ide: {
              autoFixOnSave: true,
            },
          },
        },
      },
    };

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    // Test each file type
    for (const file of testFiles) {
      await fs.writeFile(file.path, `// ${file.type} content`, 'utf8');

      const input = {
        tool_name: 'Write',
        tool_input: {
          file_path: file.path,
          content: `// ${file.type} content`,
        },
      };

      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, `file-type-${file.type}`, { signal: new AbortController().signal });
        }
      }
    }

    // Verify auto-fix was attempted for each supported file type
    expect(mockLinterExecute).toHaveBeenCalledTimes(testFiles.length);

    // Verify each call included the correct file
    for (let i = 0; i < testFiles.length; i++) {
      expect(mockLinterExecute).toHaveBeenNthCalledWith(i + 1,
        expect.objectContaining({
          files: [testFiles[i].path],
          fix: true,
        })
      );
    }
  });

  it('should disable auto-fix when configuration is off', async () => {
    const filePath = path.join(testDir, 'src', 'no-autofix.js');

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

    // Configuration with auto-fix disabled at all levels
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
            autoFix: false, // Disabled
          },
          prettier: {
            enabled: true,
            autoFix: false, // Disabled
          },
          integrations: {
            ide: {
              autoFixOnSave: false, // Disabled
            },
          },
        },
      },
    };

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
        await hook(input as any, 'no-autofix-1', { signal: new AbortController().signal });
      }
    }

    // Should use fix=false when all auto-fix settings are disabled
    expect(mockLinterExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        fix: false,
      })
    );
  });
});