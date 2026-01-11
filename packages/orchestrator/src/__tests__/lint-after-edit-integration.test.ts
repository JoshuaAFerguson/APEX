/**
 * Integration test for lint-after-edit functionality with plugin system
 *
 * This test verifies that:
 * - The lint-after-edit hook properly triggers linter plugins
 * - Auto-fix functionality works through the hook
 * - Multiple plugins work together in the hook
 * - Configuration properly controls hook behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { createHooks, type HookContext } from '../hooks';
import { TaskStore } from '../store';
import type { Task, LintIssue } from '@apexcli/core';

describe('Lint After Edit Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_lint_integration`,
    description: 'Lint after edit integration test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/test-branch',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-lint-integration-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });

    // Create config with linter enabled
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `linter:
  global:
    enabled: true
    runAfterEdit: true
    parallel: false
    failFast: false
    timeoutMs: 30000
  eslint:
    enabled: true
    autoFix: true
  prettier:
    enabled: true
    autoFix: true
  integrations:
    ide:
      autoFixOnSave: true`,
      'utf8'
    );

    store = new TaskStore(testDir);
    await store.initialize();

    const task = createTestTask();
    await store.createTask(task);
    taskId = task.id;

    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'http://localhost:3000',
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should execute linters through hook when editing files', async () => {
    // Mock linter plugins to track execution
    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: [],
      linterResults: new Map(),
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        filesChecked: 1,
        filesWithIssues: 0,
        lintersRun: 1,
        lintersSucceeded: 1,
        lintersFailed: 0,
        totalDuration: 100,
      },
      issuesByFile: new Map(),
      issuesBySeverity: {
        error: [],
        warning: [],
        info: [],
        hint: [],
      },
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    // Mock the orchestrator's linter service
    (orchestrator as any).linterService = mockLinterService;

    await orchestrator.initialize();

    // Create a hook context
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
          integrations: {
            ide: {
              autoFixOnSave: true,
            },
          },
        },
      },
    };

    // Create test file
    const filePath = path.join(testDir, 'src', 'test.ts');
    await fs.writeFile(filePath, 'const value = 1;\n', 'utf8');

    // Get hooks and execute the post-tool-use hook
    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    // Find the lint-after-edit hook
    const lintHook = postHooks.find(hookMatcher =>
      hookMatcher.hooks.some(h => h.name?.includes('lintAfterEdit'))
    );

    expect(lintHook).toBeDefined();

    // Simulate a Write tool being used
    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value = 2;\n',
      },
    };

    // Execute the hook
    for (const hook of lintHook!.hooks) {
      await hook(input as any, 'tool-1', { signal: new AbortController().signal });
    }

    // Verify linter was executed
    expect(mockLinterExecute).toHaveBeenCalledWith({
      files: [filePath],
      mode: 'sequential',
      fix: true,
      stopOnError: false,
      timeout: 30000,
    });
  });

  it('should handle linter issues and attempt auto-fix', async () => {
    // Mock linter to return some issues
    const mockIssues: LintIssue[] = [
      {
        filePath: path.join(testDir, 'src', 'test.ts'),
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 10,
        severity: 'warning',
        ruleId: 'prettier/formatting',
        message: 'Code should be formatted',
        linterId: 'prettier',
        fix: {
          description: 'Auto-format code',
          replacements: [
            {
              startOffset: 0,
              endOffset: 15,
              text: 'const value = 2;\n',
            },
          ],
        },
      },
    ];

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: true,
      issues: mockIssues,
      linterResults: new Map([
        ['prettier', {
          success: true,
          issues: mockIssues,
          filesChecked: 1,
          filesWithIssues: 1,
          duration: 100,
        }],
      ]),
      summary: {
        totalIssues: 1,
        errorCount: 0,
        warningCount: 1,
        infoCount: 0,
        hintCount: 0,
        filesChecked: 1,
        filesWithIssues: 1,
        lintersRun: 1,
        lintersSucceeded: 1,
        lintersFailed: 0,
        totalDuration: 100,
      },
      issuesByFile: new Map([
        [mockIssues[0].filePath, mockIssues],
      ]),
      issuesBySeverity: {
        error: [],
        warning: mockIssues,
        info: [],
        hint: [],
      },
    });

    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    (orchestrator as any).linterService = mockLinterService;
    await orchestrator.initialize();

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
          integrations: {
            ide: {
              autoFixOnSave: true,
            },
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'test.ts');
    await fs.writeFile(filePath, 'const value=1;\n', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];
    const lintHook = postHooks.find(hookMatcher =>
      hookMatcher.hooks.some(h => h.name?.includes('lintAfterEdit'))
    );

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value=2;\n',
      },
    };

    for (const hook of lintHook!.hooks) {
      await hook(input as any, 'tool-1', { signal: new AbortController().signal });
    }

    // Verify linter was called with fix enabled
    expect(mockLinterExecute).toHaveBeenCalledWith({
      files: [filePath],
      mode: 'sequential',
      fix: true,
      stopOnError: false,
      timeout: 30000,
    });
  });

  it('should skip linting when runAfterEdit is disabled', async () => {
    const mockLinterExecute = vi.fn();
    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    (orchestrator as any).linterService = mockLinterService;
    await orchestrator.initialize();

    const hookContext: HookContext = {
      taskId,
      store,
      linterService: mockLinterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: false, // Disabled
          },
        },
      },
    };

    const filePath = path.join(testDir, 'src', 'test.ts');
    await fs.writeFile(filePath, 'const value = 1;\n', 'utf8');

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];
    const lintHook = postHooks.find(hookMatcher =>
      hookMatcher.hooks.some(h => h.name?.includes('lintAfterEdit'))
    );

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value = 2;\n',
      },
    };

    for (const hook of lintHook!.hooks) {
      await hook(input as any, 'tool-1', { signal: new AbortController().signal });
    }

    // Verify linter was NOT called
    expect(mockLinterExecute).not.toHaveBeenCalled();
  });

  it('should only trigger for file-modifying tools', async () => {
    const mockLinterExecute = vi.fn();
    const mockLinterService = {
      execute: mockLinterExecute,
      initialize: vi.fn(),
      register: vi.fn(),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
    };

    (orchestrator as any).linterService = mockLinterService;
    await orchestrator.initialize();

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
    const lintHook = postHooks.find(hookMatcher =>
      hookMatcher.hooks.some(h => h.name?.includes('lintAfterEdit'))
    );

    // Test with non-file-modifying tool
    const input = {
      tool_name: 'Bash',
      tool_input: {
        command: 'echo "hello"',
      },
    };

    for (const hook of lintHook!.hooks) {
      await hook(input as any, 'tool-1', { signal: new AbortController().signal });
    }

    // Verify linter was NOT called for non-file tools
    expect(mockLinterExecute).not.toHaveBeenCalled();
  });
});