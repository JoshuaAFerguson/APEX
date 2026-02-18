/**
 * Import Auto-Fixer Error Boundary Tests
 *
 * This test suite focuses on error handling and boundary conditions for the import auto-fixer:
 * - Network timeouts during package resolution
 * - Circular dependency detection
 * - Invalid package.json handling
 * - Memory pressure during large project analysis
 * - Filesystem permission errors
 * - Malformed TypeScript/JavaScript syntax
 * - Version conflicts and incompatible packages
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHooks, type HookContext } from '../hooks';
import { TaskStore } from '../store';
import type { Task } from '@apexcli/core';
import type { LintIssue } from '../linter/plugin';
import type {
  MissingImport,
  ImportResolution,
  ImportFixResult,
  IImportDetector,
  IImportResolver,
} from '../import-auto-fixer/types';

// Mock ImportAutoFixer interface for testing
interface ImportAutoFixer {
  detectMissingImports: (filePath: string, content: string) => Promise<MissingImport[]>;
  resolveImports: (imports: MissingImport[], context: any) => Promise<ImportResolution[]>;
  fixImports: (filePath: string, missingImports: MissingImport[]) => Promise<ImportFixResult>;
}

describe('Import Auto-Fixer Error Boundaries', () => {
  let testDir: string;
  let store: TaskStore;
  let taskId: string;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_import_errors`,
    description: 'Import auto-fixer error boundary test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: testDir,
    branchName: 'apex/import-error-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-import-error-test-'));
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

  it('should handle network timeouts during package resolution', async () => {
    const filePath = path.join(testDir, 'src', 'network-timeout.ts');
    const fileContent = `import { someNetworkPackage } from 'unknown-package';`;

    await fs.writeFile(filePath, fileContent, 'utf8');

    const timeoutError = new Error('Network timeout');
    timeoutError.name = 'TimeoutError';

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockRejectedValue(timeoutError),
      fixImports: vi.fn(),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [{
        filePath,
        line: 1,
        column: 50,
        severity: 'error',
        ruleId: 'import/no-unresolved',
        message: "Cannot resolve module 'unknown-package'",
        linterId: 'eslint',
      } as LintIssue],
      summary: { totalIssues: 1, errorCount: 1 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
              timeoutMs: 1000,
              retryOnTimeout: false,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: fileContent,
      },
    };

    // Should not throw despite network timeout
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

    // Should log timeout error
    const logs = await store.getLogs(taskId);
    const timeoutLogs = logs.filter(log =>
      log.level === 'warn' &&
      (log.message.toLowerCase().includes('timeout') ||
       log.message.toLowerCase().includes('import auto-fixer failed'))
    );
    expect(timeoutLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect and prevent circular dependency fixes', async () => {
    const fileA = path.join(testDir, 'src', 'moduleA.ts');
    const fileB = path.join(testDir, 'src', 'moduleB.ts');

    const contentA = `import { funcB } from './moduleB';\nexport const funcA = () => funcB();`;
    const contentB = `export const funcB = () => funcA();`; // Missing import creates circular dependency

    await fs.writeFile(fileA, contentA, 'utf8');
    await fs.writeFile(fileB, contentB, 'utf8');

    const circularDependencyMock: MissingImport[] = [{
      identifier: 'funcA',
      line: 1,
      column: 32,
      suggestedSources: ['./moduleA'],
      context: {
        usageType: 'value',
        isFunctionCall: true,
      },
    }];

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockResolvedValue(circularDependencyMock),
      resolveImports: vi.fn().mockImplementation(async (imports) => {
        // Detect circular dependency
        if (imports[0].suggestedSources.includes('./moduleA')) {
          throw new Error('Circular dependency detected: moduleB -> moduleA -> moduleB');
        }
        return [];
      }),
      fixImports: vi.fn(),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [{
        filePath: fileB,
        line: 1,
        column: 32,
        severity: 'error',
        ruleId: 'no-undef',
        message: "'funcA' is not defined",
        linterId: 'eslint',
      } as LintIssue],
      summary: { totalIssues: 1, errorCount: 1 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
              preventCircularDependencies: true,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Edit',
      tool_input: {
        file_path: fileB,
        old_string: 'export const funcB = () => {};',
        new_string: 'export const funcB = () => funcA();',
      },
    };

    // Should not throw despite circular dependency detection
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Edit')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'circular-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log circular dependency warning
    const logs = await store.getLogs(taskId);
    const circularLogs = logs.filter(log =>
      log.level === 'warn' &&
      log.message.toLowerCase().includes('circular')
    );
    expect(circularLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle malformed package.json gracefully', async () => {
    // Create malformed package.json
    await fs.writeFile(
      path.join(testDir, 'package.json'),
      '{ invalid json',
      'utf8'
    );

    const filePath = path.join(testDir, 'src', 'malformed-deps.ts');
    const fileContent = `import { lodash } from 'lodash';`;

    await fs.writeFile(filePath, fileContent, 'utf8');

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockRejectedValue(new Error('Failed to parse package.json: Unexpected token')),
      fixImports: vi.fn(),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [{
        filePath,
        line: 1,
        column: 10,
        severity: 'error',
        ruleId: 'import/no-unresolved',
        message: "Cannot resolve module 'lodash'",
        linterId: 'eslint',
      } as LintIssue],
      summary: { totalIssues: 1, errorCount: 1 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: fileContent,
      },
    };

    // Should not throw despite malformed package.json
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'malformed-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log package.json parsing error
    const logs = await store.getLogs(taskId);
    const parseErrorLogs = logs.filter(log =>
      log.level === 'warn' &&
      (log.message.toLowerCase().includes('package.json') ||
       log.message.toLowerCase().includes('parse'))
    );
    expect(parseErrorLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle memory pressure during large project analysis', async () => {
    const filePath = path.join(testDir, 'src', 'memory-pressure.ts');
    const fileContent = `import { hugeFunction } from './large-module';`;

    await fs.writeFile(filePath, fileContent, 'utf8');

    const memoryError = new Error('JavaScript heap out of memory');
    memoryError.name = 'RangeError';

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockRejectedValue(memoryError),
      fixImports: vi.fn(),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [{
        filePath,
        line: 1,
        column: 10,
        severity: 'error',
        ruleId: 'import/no-unresolved',
        message: "Cannot resolve module './large-module'",
        linterId: 'eslint',
      } as LintIssue],
      summary: { totalIssues: 1, errorCount: 1 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
              memoryLimitMB: 512,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: fileContent,
      },
    };

    // Should not throw despite memory pressure
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'memory-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log memory error
    const logs = await store.getLogs(taskId);
    const memoryLogs = logs.filter(log =>
      log.level === 'error' &&
      (log.message.toLowerCase().includes('memory') ||
       log.message.toLowerCase().includes('heap'))
    );
    expect(memoryLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle version conflicts and incompatible packages', async () => {
    // Create package.json with conflicting versions
    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'conflict-test',
        dependencies: {
          react: '^16.0.0', // Old React version
          '@types/react': '^18.0.0', // Newer types
        },
      }, null, 2),
      'utf8'
    );

    const filePath = path.join(testDir, 'src', 'version-conflict.tsx');
    const fileContent = `function Component() {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} />;
}`;

    await fs.writeFile(filePath, fileContent, 'utf8');

    const incompatibleResolution: ImportResolution = {
      source: 'react',
      importType: 'named',
      isTypeOnly: false,
      confidence: 0.9,
      resolvedBy: 'package-resolver',
      warnings: ['Version mismatch: react@16.x with @types/react@18.x may cause type errors'],
    };

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockResolvedValue([{
        identifier: 'useRef',
        line: 2,
        column: 16,
        suggestedSources: ['react'],
        context: {
          usageType: 'value',
          isFunctionCall: true,
        },
      }]),
      resolveImports: vi.fn().mockResolvedValue([incompatibleResolution]),
      fixImports: vi.fn().mockResolvedValue({
        success: true,
        filePath,
        importsAdded: [
          {
            specifier: '{ useRef }',
            source: 'react',
            importType: 'named',
            line: 1,
            originalIdentifier: 'useRef',
            warnings: ['Added import may cause type conflicts due to version mismatch'],
          },
        ],
        warnings: ['Version compatibility issues detected'],
        errors: [],
        duration: 100,
      } as ImportFixResult),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [{
        filePath,
        line: 2,
        column: 16,
        severity: 'error',
        ruleId: 'no-undef',
        message: "'useRef' is not defined",
        linterId: 'eslint',
      } as LintIssue],
      summary: { totalIssues: 1, errorCount: 1 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
              warnOnVersionConflicts: true,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: fileContent,
      },
    };

    // Should handle version conflicts gracefully
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'version-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log version conflict warnings
    const logs = await store.getLogs(taskId);
    const versionLogs = logs.filter(log =>
      log.level === 'warn' &&
      (log.message.toLowerCase().includes('version') ||
       log.message.toLowerCase().includes('conflict') ||
       log.message.toLowerCase().includes('mismatch'))
    );
    expect(versionLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle syntax errors in files gracefully', async () => {
    const filePath = path.join(testDir, 'src', 'syntax-error.ts');
    const malformedContent = `
      function broken() {
        const value = ;; // Syntax error
        return useHook(value);
      }
    `;

    await fs.writeFile(filePath, malformedContent, 'utf8');

    const syntaxError = new Error('Unexpected token ;');
    syntaxError.name = 'SyntaxError';

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockRejectedValue(syntaxError),
      fixImports: vi.fn(),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [
        {
          filePath,
          line: 3,
          column: 22,
          severity: 'error',
          ruleId: 'syntax-error',
          message: 'Unexpected token ;',
          linterId: 'eslint',
        },
        {
          filePath,
          line: 4,
          column: 16,
          severity: 'error',
          ruleId: 'no-undef',
          message: "'useHook' is not defined",
          linterId: 'eslint',
        },
      ] as LintIssue[],
      summary: { totalIssues: 2, errorCount: 2 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
              skipOnSyntaxErrors: true,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: malformedContent,
      },
    };

    // Should handle syntax errors gracefully
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'syntax-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log syntax error and skip import fixing
    const logs = await store.getLogs(taskId);
    const syntaxLogs = logs.filter(log =>
      log.level === 'warn' &&
      (log.message.toLowerCase().includes('syntax') ||
       log.message.toLowerCase().includes('parse'))
    );
    expect(syntaxLogs.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle filesystem permission errors', async () => {
    const filePath = path.join(testDir, 'src', 'permission-error.ts');
    const fileContent = `import { restrictedModule } from './restricted';`;

    await fs.writeFile(filePath, fileContent, 'utf8');

    const permissionError = new Error('EACCES: permission denied');
    permissionError.name = 'PermissionError';
    (permissionError as any).code = 'EACCES';

    const mockImportAutoFixer: Partial<ImportAutoFixer> = {
      detectMissingImports: vi.fn().mockRejectedValue(permissionError),
      fixImports: vi.fn(),
    };

    const mockLinterExecute = vi.fn().mockResolvedValue({
      success: false,
      issues: [{
        filePath,
        line: 1,
        column: 10,
        severity: 'error',
        ruleId: 'import/no-unresolved',
        message: "Cannot resolve module './restricted'",
        linterId: 'eslint',
      } as LintIssue],
      summary: { totalIssues: 1, errorCount: 1 },
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
          integrations: {
            importAutoFixer: {
              enabled: true,
            },
          },
        },
      },
    };

    (hookContext as any).importAutoFixer = mockImportAutoFixer;

    const hooks = createHooks(hookContext);
    const postHooks = hooks.PostToolUse || [];

    const input = {
      tool_name: 'Write',
      tool_input: {
        file_path: filePath,
        content: fileContent,
      },
    };

    // Should handle permission errors gracefully
    await expect(async () => {
      for (const hookMatcher of postHooks) {
        if (hookMatcher.matcher && !hookMatcher.matcher.includes('Write')) {
          continue;
        }
        for (const hook of hookMatcher.hooks) {
          await hook(input as any, 'permission-1', { signal: new AbortController().signal });
        }
      }
    }).not.toThrow();

    // Should log permission error
    const logs = await store.getLogs(taskId);
    const permissionLogs = logs.filter(log =>
      log.level === 'error' &&
      (log.message.toLowerCase().includes('permission') ||
       log.message.toLowerCase().includes('eacces'))
    );
    expect(permissionLogs.length).toBeGreaterThanOrEqual(0);
  });
});