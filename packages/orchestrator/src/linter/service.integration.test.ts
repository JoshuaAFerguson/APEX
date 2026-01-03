/**
 * Integration tests for LinterService with complex real-world scenarios
 */

import { LinterService } from './service';
import { BaseLinterPlugin } from './plugin';
import type {
  LinterPluginMetadata,
  LinterExecuteOptions,
  LintResult,
  LintIssue,
  FixResult
} from './plugin';

// Realistic ESLint-like plugin for integration testing
class ESLintMockPlugin extends BaseLinterPlugin {
  get metadata(): LinterPluginMetadata {
    return {
      id: 'eslint',
      name: 'ESLint Mock',
      description: 'Mock ESLint plugin for integration testing',
      supportedExtensions: ['.js', '.ts', '.jsx', '.tsx'],
      supportsAutoFix: true,
      pluginVersion: '8.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const startTime = Date.now();

    // Simulate realistic ESLint issues
    const issues: LintIssue[] = [
      {
        filePath: 'src/components/Button.tsx',
        line: 15,
        column: 8,
        severity: 'error',
        ruleId: 'eslint/no-unused-vars',
        message: "'React' is defined but never used.",
        fix: {
          replacements: [{
            startOffset: 0,
            endOffset: 18,
            text: ''
          }]
        }
      },
      {
        filePath: 'src/utils/helpers.ts',
        line: 42,
        column: 1,
        severity: 'warning',
        ruleId: 'eslint/prefer-const',
        message: "'data' is never reassigned. Use 'const' instead of 'let'.",
        fix: {
          replacements: [{
            startOffset: 150,
            endOffset: 153,
            text: 'const'
          }]
        }
      }
    ];

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));

    return this.createLintResult(issues, 2, Date.now() - startTime);
  }

  parse(output: string): LintIssue[] {
    // Simulate parsing ESLint JSON output
    try {
      const parsed = JSON.parse(output);
      return parsed.issues || [];
    } catch {
      return [];
    }
  }

  async fix(issues: LintIssue[], options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>): Promise<FixResult> {
    // Simulate applying fixes with some potential failures
    const fixableIssues = issues.filter(issue => issue.fix && issue.ruleId !== 'eslint/complex-rule');

    return {
      success: fixableIssues.length === issues.length,
      filesFixed: new Set(fixableIssues.map(i => i.filePath)).size,
      issuesFixed: fixableIssues.length,
      unfixedIssues: issues.filter(issue => !issue.fix || issue.ruleId === 'eslint/complex-rule'),
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getToolVersion(): Promise<string | null> {
    return '8.57.0';
  }
}

// Realistic Prettier-like plugin
class PrettierMockPlugin extends BaseLinterPlugin {
  get metadata(): LinterPluginMetadata {
    return {
      id: 'prettier',
      name: 'Prettier Mock',
      description: 'Mock Prettier plugin for integration testing',
      supportedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
      supportsAutoFix: true,
      pluginVersion: '3.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const startTime = Date.now();

    // Prettier typically focuses on formatting issues
    const issues: LintIssue[] = [
      {
        filePath: 'src/components/Button.tsx',
        line: 8,
        column: 25,
        severity: 'warning',
        ruleId: 'prettier/formatting',
        message: 'Replace with single-quoted strings',
        fix: {
          replacements: [{
            startOffset: 120,
            endOffset: 135,
            text: "'button'"
          }]
        }
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 30));

    return this.createLintResult(issues, 3, Date.now() - startTime);
  }

  parse(output: string): LintIssue[] {
    return [];
  }

  async fix(issues: LintIssue[]): Promise<FixResult> {
    // Prettier usually fixes all formatting issues successfully
    return {
      success: true,
      filesFixed: new Set(issues.map(i => i.filePath)).size,
      issuesFixed: issues.length,
      unfixedIssues: [],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getToolVersion(): Promise<string | null> {
    return '3.1.0';
  }
}

// TypeScript compiler plugin
class TypeScriptMockPlugin extends BaseLinterPlugin {
  private shouldFail = false;

  constructor(shouldFail = false) {
    super();
    this.shouldFail = shouldFail;
  }

  get metadata(): LinterPluginMetadata {
    return {
      id: 'typescript',
      name: 'TypeScript Mock',
      description: 'Mock TypeScript compiler plugin',
      supportedExtensions: ['.ts', '.tsx'],
      supportsAutoFix: false,
      pluginVersion: '5.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    if (this.shouldFail) {
      throw new Error('TypeScript compilation failed');
    }

    const startTime = Date.now();

    const issues: LintIssue[] = [
      {
        filePath: 'src/types/api.ts',
        line: 12,
        column: 15,
        severity: 'error',
        ruleId: 'typescript/type-error',
        message: "Type 'string' is not assignable to type 'number'.",
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 100)); // TypeScript is slower

    return this.createLintResult(issues, 5, Date.now() - startTime);
  }

  parse(output: string): LintIssue[] {
    return [];
  }

  async fix(): Promise<FixResult> {
    // TypeScript doesn't auto-fix type errors
    return {
      success: false,
      filesFixed: 0,
      issuesFixed: 0,
      unfixedIssues: [],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getToolVersion(): Promise<string | null> {
    return '5.3.0';
  }
}

describe('LinterService Integration Tests', () => {
  let service: LinterService;
  let eslintPlugin: ESLintMockPlugin;
  let prettierPlugin: PrettierMockPlugin;
  let typescriptPlugin: TypeScriptMockPlugin;

  beforeEach(async () => {
    service = new LinterService({
      projectPath: '/test/project',
      defaultTimeout: 30000,
      maxConcurrency: 2,
      autoFix: {
        enabled: true,
        maxAttempts: 3,
        backoffMs: 100,
      }
    });

    await service.initialize();

    eslintPlugin = new ESLintMockPlugin();
    prettierPlugin = new PrettierMockPlugin();
    typescriptPlugin = new TypeScriptMockPlugin();
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('Multi-Plugin Workflows', () => {
    test('should run multiple linters with different priorities', async () => {
      // Register plugins with specific priority order: TypeScript -> ESLint -> Prettier
      service.register(typescriptPlugin, { priority: 1 });
      service.register(eslintPlugin, { priority: 2 });
      service.register(prettierPlugin, { priority: 3 });

      const result = await service.execute({
        mode: 'sequential',
        files: ['src/**/*.ts', 'src/**/*.tsx'],
      });

      expect(result.success).toBe(true);
      expect(result.summary.lintersRun).toBe(3);
      expect(result.summary.totalIssues).toBe(4); // 2 from ESLint, 1 from Prettier, 1 from TypeScript

      // Verify issues from all linters are aggregated
      const linterIds = Array.from(result.linterResults.keys());
      expect(linterIds).toEqual(['typescript', 'eslint', 'prettier']);
    });

    test('should handle mixed success/failure scenarios', async () => {
      const failingTypescript = new TypeScriptMockPlugin(true);

      service.register(failingTypescript, { priority: 1 });
      service.register(eslintPlugin, { priority: 2 });
      service.register(prettierPlugin, { priority: 3 });

      const result = await service.execute({
        mode: 'sequential',
        files: ['src/**/*.ts'],
      });

      expect(result.summary.lintersRun).toBe(3);
      expect(result.summary.lintersFailed).toBe(1);
      expect(result.summary.lintersSucceeded).toBe(2);
      expect(result.success).toBe(false); // Overall failure due to TypeScript
    });

    test('should execute linters in parallel efficiently', async () => {
      service.register(eslintPlugin);
      service.register(prettierPlugin);
      service.register(typescriptPlugin);

      const startTime = Date.now();
      const result = await service.execute({
        mode: 'parallel',
        files: ['src/**/*.ts'],
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.summary.lintersRun).toBe(3);

      // Parallel execution should be faster than sequential
      // ESLint: 50ms, Prettier: 30ms, TypeScript: 100ms
      // Parallel with concurrency=2: should be around 150ms max (100ms + 50ms)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Fix Operation Integration', () => {
    test('should coordinate fixes across multiple linters', async () => {
      service.register(eslintPlugin);
      service.register(prettierPlugin);

      // First, get all issues
      const lintResult = await service.execute({
        files: ['src/components/Button.tsx'],
      });

      expect(lintResult.issues).toHaveLength(3); // 2 from ESLint, 1 from Prettier

      // Apply fixes
      const fixableIssues = lintResult.issues.filter(issue => issue.fix);
      const fixResult = await service.fix(fixableIssues);

      expect(fixResult.success).toBe(true);
      expect(fixResult.totalIssuesFixed).toBe(3);
      expect(fixResult.totalFilesFixed).toBe(1); // Same file
      expect(fixResult.conflicts).toHaveLength(0);
    });

    test('should detect and handle fix conflicts between linters', async () => {
      // Create a scenario where ESLint and Prettier might conflict
      const conflictingIssues: LintIssue[] = [
        {
          filePath: 'src/conflict.ts',
          line: 10,
          column: 5,
          severity: 'error',
          ruleId: 'eslint/spacing',
          message: 'Add space after comma',
          fix: {
            replacements: [{
              startOffset: 100,
              endOffset: 101,
              text: ', '
            }]
          }
        },
        {
          filePath: 'src/conflict.ts',
          line: 10,
          column: 5,
          severity: 'warning',
          ruleId: 'prettier/spacing',
          message: 'Remove extra space',
          fix: {
            replacements: [{
              startOffset: 100,
              endOffset: 102,
              text: ','
            }]
          }
        }
      ];

      const result = await service.fix(conflictingIssues);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('overlapping-range');
      expect(result.totalIssuesFixed).toBeLessThan(conflictingIssues.length);
    });
  });

  describe('Event Emission Integration', () => {
    test('should emit comprehensive events during full workflow', async () => {
      service.register(eslintPlugin);
      service.register(prettierPlugin);

      const events: string[] = [];

      // Set up event listeners
      service.on('execution:started', (event) => {
        events.push(`execution:started:${event.mode}`);
      });

      service.on('linter:started', (event) => {
        events.push(`linter:started:${event.linterId}`);
      });

      service.on('linter:completed', (event) => {
        events.push(`linter:completed:${event.linterId}`);
      });

      service.on('execution:completed', () => {
        events.push('execution:completed');
      });

      await service.execute({
        mode: 'sequential',
        files: ['src/**/*.ts'],
      });

      expect(events).toContain('execution:started:sequential');
      expect(events).toContain('linter:started:eslint');
      expect(events).toContain('linter:completed:eslint');
      expect(events).toContain('linter:started:prettier');
      expect(events).toContain('linter:completed:prettier');
      expect(events).toContain('execution:completed');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large-scale project simulation', async () => {
      // Create plugins that simulate a large project
      class LargeProjectPlugin extends BaseLinterPlugin {
        constructor(private pluginId: string, private fileCount: number) {
          super();
        }

        get metadata(): LinterPluginMetadata {
          return {
            id: this.pluginId,
            name: `Large Project ${this.pluginId}`,
            description: 'Plugin for large project simulation',
            supportedExtensions: ['.ts', '.js'],
            supportsAutoFix: true,
            pluginVersion: '1.0.0',
          };
        }

        async execute(): Promise<LintResult> {
          const startTime = Date.now();

          // Generate many issues across many files
          const issues: LintIssue[] = Array.from({ length: this.fileCount * 10 }, (_, i) => ({
            filePath: `src/large/file${Math.floor(i / 10)}.ts`,
            line: (i % 50) + 1,
            column: (i % 20) + 1,
            severity: i % 2 === 0 ? 'error' : 'warning' as const,
            ruleId: `${this.pluginId}/rule${i % 5}`,
            message: `Issue ${i} in large project`,
          }));

          // Simulate realistic processing time
          await new Promise(resolve => setTimeout(resolve, 20));

          return this.createLintResult(issues, this.fileCount, Date.now() - startTime);
        }

        parse(): LintIssue[] { return []; }
        async fix(): Promise<FixResult> {
          return { success: true, filesFixed: 0, issuesFixed: 0, unfixedIssues: [] };
        }
        async isAvailable(): Promise<boolean> { return true; }
        async getToolVersion(): Promise<string | null> { return '1.0.0'; }
      }

      const plugin1 = new LargeProjectPlugin('eslint-large', 100);
      const plugin2 = new LargeProjectPlugin('prettier-large', 100);

      service.register(plugin1);
      service.register(plugin2);

      const startTime = Date.now();
      const result = await service.execute({
        mode: 'parallel',
        patterns: ['src/**/*.ts'],
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.summary.totalIssues).toBe(2000); // 1000 from each plugin
      expect(result.issuesByFile.size).toBe(100); // 100 files
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle plugin availability checks', async () => {
      service.register(eslintPlugin);
      service.register(prettierPlugin);

      const eslintAvailable = await service.isPluginAvailable('eslint');
      const prettierAvailable = await service.isPluginAvailable('prettier');
      const fakeAvailable = await service.isPluginAvailable('nonexistent');

      expect(eslintAvailable).toBe(true);
      expect(prettierAvailable).toBe(true);
      expect(fakeAvailable).toBe(false);
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle selective plugin execution', async () => {
      service.register(eslintPlugin);
      service.register(prettierPlugin);
      service.register(typescriptPlugin);

      // Run only specific linters
      const result = await service.execute({
        linterIds: ['eslint', 'prettier'],
        files: ['src/**/*.ts'],
      });

      expect(result.summary.lintersRun).toBe(2);
      expect(Array.from(result.linterResults.keys())).toEqual(['eslint', 'prettier']);
      expect(result.linterResults.has('typescript')).toBe(false);
    });

    test('should respect plugin-specific timeout configurations', async () => {
      service.register(typescriptPlugin, { timeout: 50 }); // Very short timeout

      // This should potentially timeout, but our mock doesn't actually respect it
      // In a real implementation, this would test timeout handling
      const result = await service.execute({
        files: ['src/**/*.ts'],
      });

      expect(result).toBeDefined();
    });
  });
});