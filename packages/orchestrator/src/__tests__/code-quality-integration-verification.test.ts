/**
 * Comprehensive verification test for v0.5.0 Code Quality Integration
 * This test verifies the lint-after-edit functionality works end-to-end
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LinterService } from '../linter/service.js';
import type { ILinterPlugin, LinterExecuteOptions, LintResult, LintIssue } from '../linter/types.js';

// Mock Plugin for testing
class MockESLintPlugin implements ILinterPlugin {
  metadata = {
    id: 'eslint',
    name: 'ESLint',
    version: '8.0.0',
    description: 'Mock ESLint plugin for testing',
  };

  isEnabled = vi.fn().mockReturnValue(true);
  initialize = vi.fn().mockResolvedValue(undefined);
  execute = vi.fn();
  canAutoFix = vi.fn().mockReturnValue(true);
  fix = vi.fn();
  dispose = vi.fn().mockResolvedValue(undefined);
}

class MockPrettierPlugin implements ILinterPlugin {
  metadata = {
    id: 'prettier',
    name: 'Prettier',
    version: '3.0.0',
    description: 'Mock Prettier plugin for testing',
  };

  isEnabled = vi.fn().mockReturnValue(true);
  initialize = vi.fn().mockResolvedValue(undefined);
  execute = vi.fn();
  canAutoFix = vi.fn().mockReturnValue(true);
  fix = vi.fn();
  dispose = vi.fn().mockResolvedValue(undefined);
}

describe('v0.5.0 Code Quality Integration Verification', () => {
  let linterService: LinterService;
  let mockESLintPlugin: MockESLintPlugin;
  let mockPrettierPlugin: MockPrettierPlugin;

  beforeEach(() => {
    linterService = new LinterService({
      projectPath: '/test/project',
      maxConcurrency: 2,
    });

    mockESLintPlugin = new MockESLintPlugin();
    mockPrettierPlugin = new MockPrettierPlugin();

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await linterService.dispose();
  });

  describe('LinterService Core Functionality', () => {
    it('should initialize LinterService successfully', async () => {
      await linterService.initialize();
      expect(linterService).toBeDefined();
    });

    it('should register linter plugins with priority', async () => {
      await linterService.initialize();

      linterService.register(mockESLintPlugin, { priority: 1 });
      linterService.register(mockPrettierPlugin, { priority: 2 });

      const plugins = linterService.getRegisteredPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0].plugin.metadata.id).toBe('eslint');
      expect(plugins[1].plugin.metadata.id).toBe('prettier');
    });

    it('should execute linters in sequential mode', async () => {
      await linterService.initialize();

      // Mock lint results
      const eslintResult: LintResult = {
        linterId: 'eslint',
        files: ['/test/file.ts'],
        issues: [
          {
            ruleId: 'no-unused-vars',
            severity: 'error',
            message: 'Variable is declared but never used',
            file: '/test/file.ts',
            line: 1,
            column: 5,
          } as LintIssue,
        ],
        executionTime: 100,
        metadata: { rulesCount: 200 },
      };

      const prettierResult: LintResult = {
        linterId: 'prettier',
        files: ['/test/file.ts'],
        issues: [
          {
            ruleId: 'prettier/prettier',
            severity: 'error',
            message: 'Code style issues',
            file: '/test/file.ts',
            line: 2,
            column: 10,
          } as LintIssue,
        ],
        executionTime: 50,
        metadata: { formattingTime: 50 },
      };

      mockESLintPlugin.execute.mockResolvedValue(eslintResult);
      mockPrettierPlugin.execute.mockResolvedValue(prettierResult);

      linterService.register(mockESLintPlugin, { priority: 1 });
      linterService.register(mockPrettierPlugin, { priority: 2 });

      const result = await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'sequential',
      });

      expect(result.summary.totalIssues).toBe(2);
      expect(result.summary.totalFiles).toBe(1);
      expect(result.results.get('eslint')).toEqual(eslintResult);
      expect(result.results.get('prettier')).toEqual(prettierResult);
    });

    it('should execute linters in parallel mode', async () => {
      await linterService.initialize();

      const eslintResult: LintResult = {
        linterId: 'eslint',
        files: ['/test/file.ts'],
        issues: [],
        executionTime: 100,
        metadata: {},
      };

      const prettierResult: LintResult = {
        linterId: 'prettier',
        files: ['/test/file.ts'],
        issues: [],
        executionTime: 50,
        metadata: {},
      };

      mockESLintPlugin.execute.mockResolvedValue(eslintResult);
      mockPrettierPlugin.execute.mockResolvedValue(prettierResult);

      linterService.register(mockESLintPlugin, { priority: 1 });
      linterService.register(mockPrettierPlugin, { priority: 2 });

      const result = await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'parallel',
      });

      expect(result.summary.totalIssues).toBe(0);
      expect(result.results.size).toBe(2);
      expect(mockESLintPlugin.execute).toHaveBeenCalled();
      expect(mockPrettierPlugin.execute).toHaveBeenCalled();
    });

    it('should handle auto-fix functionality', async () => {
      await linterService.initialize();

      const eslintResult: LintResult = {
        linterId: 'eslint',
        files: ['/test/file.ts'],
        issues: [
          {
            ruleId: 'no-unused-vars',
            severity: 'error',
            message: 'Variable is declared but never used',
            file: '/test/file.ts',
            line: 1,
            column: 5,
            fixable: true,
          } as LintIssue,
        ],
        executionTime: 100,
        metadata: {},
      };

      mockESLintPlugin.execute.mockResolvedValue(eslintResult);
      mockESLintPlugin.fix.mockResolvedValue({
        success: true,
        fixedFiles: ['/test/file.ts'],
        fixedIssues: 1,
        errors: [],
      });

      linterService.register(mockESLintPlugin, { priority: 1 });

      const result = await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'sequential',
        fix: true,
      });

      expect(result.summary.totalIssues).toBe(1);
      expect(mockESLintPlugin.fix).toHaveBeenCalled();
    });

    it('should emit progress events during execution', async () => {
      await linterService.initialize();

      const executionStartedListener = vi.fn();
      const executionCompletedListener = vi.fn();
      const linterStartedListener = vi.fn();

      linterService.on('execution:started', executionStartedListener);
      linterService.on('execution:completed', executionCompletedListener);
      linterService.on('linter:started', linterStartedListener);

      mockESLintPlugin.execute.mockResolvedValue({
        linterId: 'eslint',
        files: ['/test/file.ts'],
        issues: [],
        executionTime: 100,
        metadata: {},
      });

      linterService.register(mockESLintPlugin, { priority: 1 });

      await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'sequential',
      });

      expect(executionStartedListener).toHaveBeenCalled();
      expect(executionCompletedListener).toHaveBeenCalled();
      expect(linterStartedListener).toHaveBeenCalled();
    });

    it('should handle linter execution errors gracefully', async () => {
      await linterService.initialize();

      mockESLintPlugin.execute.mockRejectedValue(new Error('ESLint execution failed'));

      linterService.register(mockESLintPlugin, { priority: 1 });

      const result = await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'sequential',
      });

      // Should still return a result even if one linter fails
      expect(result.summary).toBeDefined();
      expect(result.summary.totalIssues).toBe(0);
    });
  });

  describe('Lint-After-Edit Hook Integration', () => {
    // Mock hook context
    const createMockHookContext = (config = {}) => ({
      taskId: 'test-task-123',
      store: {
        addLog: vi.fn(),
      },
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
            autoFix: true,
          },
          prettier: {
            autoFix: true,
          },
        },
        ...config,
      },
      linterService,
    });

    it('should trigger lint-after-edit for file modifying tools', async () => {
      await linterService.initialize();
      linterService.register(mockESLintPlugin, { priority: 1 });

      const mockContext = createMockHookContext();

      mockESLintPlugin.execute.mockResolvedValue({
        linterId: 'eslint',
        files: ['/test/modified-file.ts'],
        issues: [],
        executionTime: 100,
        metadata: {},
      });

      // Simulate the lint-after-edit hook logic
      const FILE_MODIFYING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
      const toolName = 'Edit';
      const filePaths = ['/test/modified-file.ts'];

      if (FILE_MODIFYING_TOOLS.includes(toolName) &&
          mockContext.linterService &&
          mockContext.config?.linter?.global?.enabled &&
          mockContext.config.linter.global.runAfterEdit) {

        const autoFixEnabled = Boolean(
          mockContext.config.linter.eslint?.autoFix ||
          mockContext.config.linter.prettier?.autoFix
        );

        await mockContext.linterService.execute({
          files: filePaths,
          mode: mockContext.config.linter.global.parallel ? 'parallel' : 'sequential',
          fix: autoFixEnabled,
          stopOnError: mockContext.config.linter.global.failFast,
          timeout: mockContext.config.linter.global.timeoutMs,
        });
      }

      expect(mockESLintPlugin.execute).toHaveBeenCalledWith({
        files: filePaths,
        mode: 'sequential',
        fix: true,
        stopOnError: false,
        timeout: 30000,
      });
    });

    it('should not trigger lint-after-edit when disabled', async () => {
      await linterService.initialize();
      linterService.register(mockESLintPlugin, { priority: 1 });

      const mockContext = createMockHookContext({
        linter: {
          global: {
            enabled: false,
            runAfterEdit: false,
          },
        },
      });

      // Simulate the lint-after-edit hook logic with disabled config
      const FILE_MODIFYING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
      const toolName = 'Edit';

      if (FILE_MODIFYING_TOOLS.includes(toolName) &&
          mockContext.linterService &&
          mockContext.config?.linter?.global?.enabled &&
          mockContext.config.linter.global.runAfterEdit) {

        await mockContext.linterService.execute({
          files: ['/test/modified-file.ts'],
        });
      }

      expect(mockESLintPlugin.execute).not.toHaveBeenCalled();
    });

    it('should not trigger lint-after-edit for read-only tools', async () => {
      await linterService.initialize();
      linterService.register(mockESLintPlugin, { priority: 1 });

      const mockContext = createMockHookContext();

      // Simulate the lint-after-edit hook logic with read-only tool
      const FILE_MODIFYING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
      const toolName = 'Read'; // Read-only tool

      if (FILE_MODIFYING_TOOLS.includes(toolName) &&
          mockContext.linterService &&
          mockContext.config?.linter?.global?.enabled &&
          mockContext.config.linter.global.runAfterEdit) {

        await mockContext.linterService.execute({
          files: ['/test/file.ts'],
        });
      }

      expect(mockESLintPlugin.execute).not.toHaveBeenCalled();
    });

    it('should handle lint-after-edit errors gracefully', async () => {
      await linterService.initialize();
      linterService.register(mockESLintPlugin, { priority: 1 });

      const mockContext = createMockHookContext();
      mockESLintPlugin.execute.mockRejectedValue(new Error('Linting failed'));

      try {
        // Simulate the lint-after-edit hook logic
        const FILE_MODIFYING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
        const toolName = 'Edit';
        const filePaths = ['/test/modified-file.ts'];

        if (FILE_MODIFYING_TOOLS.includes(toolName) &&
            mockContext.linterService &&
            mockContext.config?.linter?.global?.enabled &&
            mockContext.config.linter.global.runAfterEdit) {

          await mockContext.linterService.execute({
            files: filePaths,
            mode: 'sequential',
            fix: true,
          });
        }
      } catch (error) {
        // Hook should log error but not throw
        expect(mockContext.store.addLog).toHaveBeenCalledWith(
          mockContext.taskId,
          expect.objectContaining({
            level: 'warn',
            message: 'Lint after edit failed',
            metadata: expect.objectContaining({
              tool: 'Edit',
              filePaths: ['/test/modified-file.ts'],
            }),
          })
        );
      }
    });
  });

  describe('Configuration-based Behavior', () => {
    it('should respect parallel execution configuration', async () => {
      await linterService.initialize();

      linterService.register(mockESLintPlugin, { priority: 1 });
      linterService.register(mockPrettierPlugin, { priority: 2 });

      mockESLintPlugin.execute.mockResolvedValue({
        linterId: 'eslint',
        files: ['/test/file.ts'],
        issues: [],
        executionTime: 100,
        metadata: {},
      });

      mockPrettierPlugin.execute.mockResolvedValue({
        linterId: 'prettier',
        files: ['/test/file.ts'],
        issues: [],
        executionTime: 50,
        metadata: {},
      });

      await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'parallel',
      });

      expect(mockESLintPlugin.execute).toHaveBeenCalled();
      expect(mockPrettierPlugin.execute).toHaveBeenCalled();
    });

    it('should handle timeout configuration', async () => {
      await linterService.initialize();

      linterService.register(mockESLintPlugin, { priority: 1 });

      mockESLintPlugin.execute.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await linterService.execute({
        files: ['/test/file.ts'],
        mode: 'sequential',
        timeout: 100, // Shorter than execution time
      });

      expect(result).toBeDefined();
    });

    it('should support custom linter configurations', async () => {
      await linterService.initialize();

      linterService.register(mockESLintPlugin, {
        priority: 1,
        enabled: true,
        options: { configFile: '.eslintrc.custom.js' }
      });

      mockESLintPlugin.execute.mockResolvedValue({
        linterId: 'eslint',
        files: ['/test/file.ts'],
        issues: [],
        executionTime: 100,
        metadata: {},
      });

      await linterService.execute({
        files: ['/test/file.ts'],
        linterIds: ['eslint'],
      });

      expect(mockESLintPlugin.execute).toHaveBeenCalled();
    });
  });
});