import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, type HookContext } from './hooks';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';
import type { LinterService } from './linter';

describe('lint-after-edit hook', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_lint`,
    description: 'Lint after edit test task',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-lint-hook-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
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

  it('runs lint after edit when enabled', async () => {
    const lintExecute = vi.fn().mockResolvedValue({});
    const linterService = { execute: lintExecute } as unknown as LinterService;

    const filePath = path.join(testDir, 'src', 'index.ts');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'const value = 1;\n', 'utf8');

    const hookContext: HookContext = {
      taskId,
      store,
      linterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: true,
            parallel: false,
            failFast: false,
            timeoutMs: 60000,
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
    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value = 2;\n',
      },
    };

    for (const hookMatcher of postHooks) {
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'tool-1', { signal: new AbortController().signal });
      }
    }

    expect(lintExecute).toHaveBeenCalledWith({
      files: [filePath],
      mode: 'sequential',
      fix: true,
      stopOnError: false,
      timeout: 60000,
    });
  });

  it('skips lint after edit when disabled', async () => {
    const lintExecute = vi.fn().mockResolvedValue({});
    const linterService = { execute: lintExecute } as unknown as LinterService;

    const filePath = path.join(testDir, 'src', 'skip.ts');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'const value = 3;\n', 'utf8');

    const hookContext: HookContext = {
      taskId,
      store,
      linterService,
      config: {
        linter: {
          global: {
            enabled: true,
            runAfterEdit: false,
            parallel: false,
            failFast: false,
            timeoutMs: 60000,
          },
        },
      },
    };

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];
    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: 'const value = 4;\n',
      },
    };

    for (const hookMatcher of postHooks) {
      for (const hook of hookMatcher.hooks) {
        await hook(input as any, 'tool-2', { signal: new AbortController().signal });
      }
    }

    expect(lintExecute).not.toHaveBeenCalled();
  });
});
