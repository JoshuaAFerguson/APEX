/**
 * Tests for LinterService orchestration class
 */

import { LinterService, type LinterServiceOptions, type ExecuteOptions } from './service';
import { type ILinterPlugin, type LintResult, type LinterPluginMetadata, type LinterExecuteOptions, type LintIssue, type FixResult, BaseLinterPlugin } from './plugin';

// Mock linter plugin for testing
class MockLinterPlugin extends BaseLinterPlugin {
  constructor(
    private id: string,
    private issues: LintIssue[] = []
  ) {
    super();
  }

  get metadata(): LinterPluginMetadata {
    return {
      id: this.id,
      name: `Mock ${this.id}`,
      description: `Mock linter for ${this.id}`,
      supportedExtensions: ['.js', '.ts'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const startTime = Date.now();

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));

    return this.createLintResult(
      this.issues,
      options.files?.length || 1,
      Date.now() - startTime
    );
  }

  parse(output: string): LintIssue[] {
    return this.issues;
  }

  async fix(
    issues: LintIssue[],
    options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>
  ): Promise<FixResult> {
    return {
      success: true,
      filesFixed: issues.length > 0 ? 1 : 0,
      issuesFixed: issues.length,
      unfixedIssues: [],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getToolVersion(): Promise<string | null> {
    return '1.0.0';
  }
}

describe('LinterService', () => {
  let service: LinterService;
  let mockPlugin1: MockLinterPlugin;
  let mockPlugin2: MockLinterPlugin;

  beforeEach(async () => {
    const options: LinterServiceOptions = {
      projectPath: '/test/project',
      defaultTimeout: 30000,
      maxConcurrency: 2,
    };

    service = new LinterService(options);
    await service.initialize();

    mockPlugin1 = new MockLinterPlugin('eslint');
    mockPlugin2 = new MockLinterPlugin('prettier');
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('Plugin Management', () => {
    test('should register a plugin successfully', () => {
      service.register(mockPlugin1);

      const registered = service.getRegisteredPlugins();
      expect(registered).toHaveLength(1);
      expect(registered[0].plugin).toBe(mockPlugin1);
      expect(registered[0].enabled).toBe(true);
      expect(registered[0].priority).toBe(100);
    });

    test('should register plugin with custom configuration', () => {
      service.register(mockPlugin1, {
        priority: 1,
        enabled: false,
        timeout: 45000,
      });

      const registered = service.getRegisteredPlugins();
      expect(registered[0].priority).toBe(1);
      expect(registered[0].enabled).toBe(false);
      expect(registered[0].config.timeout).toBe(45000);
    });

    test('should prevent duplicate plugin registration', () => {
      service.register(mockPlugin1);

      expect(() => {
        service.register(mockPlugin1);
      }).toThrow("Plugin with ID 'eslint' is already registered");
    });

    test('should unregister a plugin', () => {
      service.register(mockPlugin1);
      expect(service.getRegisteredPlugins()).toHaveLength(1);

      const result = service.unregister('eslint');
      expect(result).toBe(true);
      expect(service.getRegisteredPlugins()).toHaveLength(0);
    });

    test('should return false when unregistering non-existent plugin', () => {
      const result = service.unregister('nonexistent');
      expect(result).toBe(false);
    });

    test('should enable and disable plugins', () => {
      service.register(mockPlugin1);
      service.disable('eslint');

      const registered = service.getRegisteredPlugins();
      expect(registered[0].enabled).toBe(false);

      service.enable('eslint');
      expect(registered[0].enabled).toBe(true);
    });
  });

  describe('Execution', () => {
    test('should execute linters sequentially', async () => {
      const issue1: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'eslint/no-unused-vars',
        message: 'Unused variable',
      };

      const issue2: LintIssue = {
        filePath: 'test.js',
        line: 2,
        column: 1,
        severity: 'warning',
        ruleId: 'prettier/formatting',
        message: 'Formatting issue',
      };

      const plugin1 = new MockLinterPlugin('eslint', [issue1]);
      const plugin2 = new MockLinterPlugin('prettier', [issue2]);

      service.register(plugin1, { priority: 1 });
      service.register(plugin2, { priority: 2 });

      const options: ExecuteOptions = {
        mode: 'sequential',
        files: ['test.js'],
      };

      const result = await service.execute(options);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(2);
      expect(result.summary.totalIssues).toBe(2);
      expect(result.summary.lintersRun).toBe(2);
      expect(result.summary.lintersSucceeded).toBe(2);
      expect(result.summary.lintersFailed).toBe(0);
    });

    test('should execute linters in parallel', async () => {
      const issue1: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'eslint/no-unused-vars',
        message: 'Unused variable',
      };

      const plugin1 = new MockLinterPlugin('eslint', [issue1]);
      const plugin2 = new MockLinterPlugin('prettier', []);

      service.register(plugin1);
      service.register(plugin2);

      const options: ExecuteOptions = {
        mode: 'parallel',
        files: ['test.js'],
      };

      const result = await service.execute(options);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.summary.totalIssues).toBe(1);
      expect(result.summary.lintersRun).toBe(2);
    });

    test('should run only specified linters', async () => {
      service.register(mockPlugin1);
      service.register(mockPlugin2);

      const options: ExecuteOptions = {
        linterIds: ['eslint'],
        files: ['test.js'],
      };

      const result = await service.execute(options);

      expect(result.success).toBe(true);
      expect(result.summary.lintersRun).toBe(1);
      expect(Array.from(result.linterResults.keys())).toEqual(['eslint']);
    });

    test('should handle empty execution when no linters are enabled', async () => {
      const result = await service.execute({ files: ['test.js'] });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.summary.lintersRun).toBe(0);
    });

    test('should aggregate results correctly', async () => {
      const issue1: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'rule1',
        message: 'Error 1',
      };

      const issue2: LintIssue = {
        filePath: 'other.js',
        line: 5,
        column: 10,
        severity: 'warning',
        ruleId: 'rule2',
        message: 'Warning 1',
      };

      const plugin1 = new MockLinterPlugin('eslint', [issue1]);
      const plugin2 = new MockLinterPlugin('prettier', [issue2]);

      service.register(plugin1);
      service.register(plugin2);

      const result = await service.execute({ files: ['test.js', 'other.js'] });

      // Check aggregated results
      expect(result.issues).toHaveLength(2);
      expect(result.issuesByFile.get('test.js')).toEqual([issue1]);
      expect(result.issuesByFile.get('other.js')).toEqual([issue2]);
      expect(result.issuesBySeverity.error).toEqual([issue1]);
      expect(result.issuesBySeverity.warning).toEqual([issue2]);

      // Check summary
      expect(result.summary.totalIssues).toBe(2);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.warningCount).toBe(1);
      expect(result.summary.infoCount).toBe(0);
      expect(result.summary.hintCount).toBe(0);
      expect(result.summary.filesWithIssues).toBe(2);
    });
  });

  describe('Event Emission', () => {
    test('should emit plugin registration events', (done) => {
      service.on('plugin:registered', (event) => {
        expect(event.linterId).toBe('eslint');
        expect(event.pluginName).toBe('Mock eslint');
        expect(event.priority).toBe(100);
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      service.register(mockPlugin1);
    });

    test('should emit execution events', (done) => {
      service.register(mockPlugin1);

      let startedEmitted = false;

      service.on('execution:started', (event) => {
        expect(event.executionId).toBeDefined();
        expect(event.mode).toBe('sequential');
        expect(event.linters).toEqual(['eslint']);
        startedEmitted = true;
      });

      service.on('execution:completed', (event) => {
        expect(startedEmitted).toBe(true);
        expect(event.result).toBeDefined();
        expect(event.result.success).toBe(true);
        done();
      });

      service.execute({ files: ['test.js'] });
    });
  });

  describe('Utility Methods', () => {
    test('should get supported extensions from all plugins', () => {
      service.register(mockPlugin1);
      service.register(mockPlugin2);

      const extensions = service.getSupportedExtensions();
      expect(extensions).toEqual(['.js', '.ts']);
    });

    test('should check plugin availability', async () => {
      service.register(mockPlugin1);

      const available = await service.isPluginAvailable('eslint');
      expect(available).toBe(true);

      const unavailable = await service.isPluginAvailable('nonexistent');
      expect(unavailable).toBe(false);
    });

    test('should retrieve registered plugin', () => {
      service.register(mockPlugin1);

      const plugin = service.getPlugin('eslint');
      expect(plugin).toBe(mockPlugin1);

      const notFound = service.getPlugin('nonexistent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Fix Operations', () => {
    test('should apply fixes successfully', async () => {
      const fixableIssue: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'eslint/no-unused-vars',
        message: 'Unused variable',
        fix: {
          replacements: [{
            startOffset: 0,
            endOffset: 10,
            text: 'fixed text'
          }]
        }
      };

      const plugin = new MockLinterPlugin('eslint', [fixableIssue]);
      service.register(plugin);

      const result = await service.fix([fixableIssue]);

      expect(result.success).toBe(true);
      expect(result.totalIssuesFixed).toBe(1);
      expect(result.totalFilesFixed).toBe(1);
      expect(result.conflicts).toHaveLength(0);
      expect(result.unfixedIssues).toHaveLength(0);
    });

    test('should detect fix conflicts', async () => {
      const conflictingIssue1: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'rule1',
        message: 'Issue 1',
        fix: {
          replacements: [{
            startOffset: 0,
            endOffset: 10,
            text: 'fix1'
          }]
        }
      };

      const conflictingIssue2: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 5,
        severity: 'error',
        ruleId: 'rule2',
        message: 'Issue 2',
        fix: {
          replacements: [{
            startOffset: 5,
            endOffset: 15,
            text: 'fix2'
          }]
        }
      };

      const plugin = new MockLinterPlugin('eslint', []);
      service.register(plugin);

      const result = await service.fix([conflictingIssue1, conflictingIssue2]);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toBe('overlapping-range');
      expect(result.conflicts[0].issues).toHaveLength(2);
    });

    test('should handle fix failures gracefully', async () => {
      class FailingPlugin extends MockLinterPlugin {
        async fix(): Promise<FixResult> {
          throw new Error('Fix failed');
        }
      }

      const issue: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'failing/rule',
        message: 'Issue',
        fix: {
          replacements: [{
            startOffset: 0,
            endOffset: 1,
            text: 'x'
          }]
        }
      };

      const plugin = new FailingPlugin('failing', [issue]);
      service.register(plugin);

      const result = await service.fix([issue]);

      expect(result.success).toBe(false);
      expect(result.unfixedIssues).toHaveLength(1);
      expect(result.totalIssuesFixed).toBe(0);
    });

    test('should emit fix events', (done) => {
      const issue: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'rule',
        message: 'Issue',
        fix: {
          replacements: [{
            startOffset: 0,
            endOffset: 1,
            text: 'x'
          }]
        }
      };

      const plugin = new MockLinterPlugin('eslint', []);
      service.register(plugin);

      let startedEmitted = false;

      service.on('fix:started', (event) => {
        expect(event.totalIssues).toBe(1);
        expect(event.totalFiles).toBe(1);
        startedEmitted = true;
      });

      service.on('fix:completed', (event) => {
        expect(startedEmitted).toBe(true);
        expect(event.result.success).toBe(true);
        done();
      });

      service.fix([issue]);
    });
  });

  describe('Error Handling', () => {
    test('should handle plugin execution errors in sequential mode', async () => {
      class ErrorPlugin extends MockLinterPlugin {
        async execute(): Promise<LintResult> {
          throw new Error('Plugin execution failed');
        }
      }

      const errorPlugin = new ErrorPlugin('error-plugin', []);
      const normalPlugin = new MockLinterPlugin('normal-plugin', []);

      service.register(errorPlugin);
      service.register(normalPlugin);

      const result = await service.execute({
        mode: 'sequential',
        files: ['test.js']
      });

      // Should continue execution despite error
      expect(result.summary.lintersRun).toBe(2);
      expect(result.summary.lintersFailed).toBe(1);
      expect(result.summary.lintersSucceeded).toBe(1);
    });

    test('should handle plugin execution errors in parallel mode', async () => {
      class ErrorPlugin extends MockLinterPlugin {
        async execute(): Promise<LintResult> {
          throw new Error('Plugin execution failed');
        }
      }

      const errorPlugin = new ErrorPlugin('error-plugin', []);
      service.register(errorPlugin);

      const result = await service.execute({
        mode: 'parallel',
        files: ['test.js']
      });

      expect(result.summary.lintersFailed).toBe(1);
      expect(result.summary.lintersSucceeded).toBe(0);
    });

    test('should stop on error when stopOnError is true', async () => {
      class ErrorPlugin extends MockLinterPlugin {
        async execute(): Promise<LintResult> {
          throw new Error('Plugin execution failed');
        }
      }

      const errorPlugin = new ErrorPlugin('error-plugin', []);
      const normalPlugin = new MockLinterPlugin('normal-plugin', []);

      service.register(errorPlugin, { priority: 1 });
      service.register(normalPlugin, { priority: 2 });

      await expect(service.execute({
        mode: 'sequential',
        stopOnError: true,
        files: ['test.js']
      })).rejects.toThrow('Plugin execution failed');
    });

    test('should emit error events', (done) => {
      class ErrorPlugin extends MockLinterPlugin {
        async execute(): Promise<LintResult> {
          throw new Error('Test error');
        }
      }

      const errorPlugin = new ErrorPlugin('error-plugin', []);
      service.register(errorPlugin);

      service.on('execution:error', (event) => {
        expect(event.linterId).toBe('error-plugin');
        expect(event.error.message).toBe('Test error');
        expect(event.executionId).toBeDefined();
        done();
      });

      service.execute({ files: ['test.js'] });
    });
  });

  describe('Configuration and Edge Cases', () => {
    test('should handle initialization idempotently', async () => {
      await service.initialize();
      await service.initialize(); // Should not throw or cause issues
      expect(service).toBeDefined();
    });

    test('should handle disposal safely when not initialized', async () => {
      const newService = new LinterService({ projectPath: '/test' });
      await newService.dispose(); // Should not throw
    });

    test('should validate plugin configuration', () => {
      expect(() => service.enable('nonexistent')).toThrow("Plugin with ID 'nonexistent' is not registered");
      expect(() => service.disable('nonexistent')).toThrow("Plugin with ID 'nonexistent' is not registered");
    });

    test('should handle timeout configurations', () => {
      service.register(mockPlugin1, { timeout: 5000 });

      const registered = service.getRegisteredPlugins();
      expect(registered[0].config.timeout).toBe(5000);
    });

    test('should handle include/exclude patterns', () => {
      service.register(mockPlugin1, {
        include: ['*.ts'],
        exclude: ['*.test.ts']
      });

      const registered = service.getRegisteredPlugins();
      expect(registered[0].config.include).toEqual(['*.ts']);
      expect(registered[0].config.exclude).toEqual(['*.test.ts']);
    });

    test('should handle autofix configuration per plugin', () => {
      service.register(mockPlugin1, { autoFix: false });

      const registered = service.getRegisteredPlugins();
      expect(registered[0].config.autoFix).toBe(false);
    });
  });

  describe('Concurrency and Performance', () => {
    test('should respect maxConcurrency setting', async () => {
      const concurrencyService = new LinterService({
        projectPath: '/test',
        maxConcurrency: 1
      });
      await concurrencyService.initialize();

      const plugin1 = new MockLinterPlugin('plugin1', []);
      const plugin2 = new MockLinterPlugin('plugin2', []);
      const plugin3 = new MockLinterPlugin('plugin3', []);

      concurrencyService.register(plugin1);
      concurrencyService.register(plugin2);
      concurrencyService.register(plugin3);

      const startTime = Date.now();
      const result = await concurrencyService.execute({
        mode: 'parallel',
        files: ['test.js']
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.summary.lintersRun).toBe(3);
      // With maxConcurrency=1 and 10ms delay per plugin, should take at least 30ms
      expect(duration).toBeGreaterThan(25);

      await concurrencyService.dispose();
    });

    test('should handle large number of issues efficiently', async () => {
      const manyIssues: LintIssue[] = Array.from({ length: 1000 }, (_, i) => ({
        filePath: `file${i % 10}.js`,
        line: i + 1,
        column: 1,
        severity: 'warning' as const,
        ruleId: `rule${i % 5}`,
        message: `Issue ${i}`,
      }));

      const plugin = new MockLinterPlugin('bulk-plugin', manyIssues);
      service.register(plugin);

      const result = await service.execute({ files: ['*.js'] });

      expect(result.issues).toHaveLength(1000);
      expect(result.issuesByFile.size).toBe(10);
      expect(result.summary.totalIssues).toBe(1000);
    });
  });

  describe('Plugin Lifecycle Events', () => {
    test('should emit all plugin lifecycle events', (done) => {
      let events: string[] = [];

      service.on('plugin:registered', () => events.push('registered'));
      service.on('plugin:enabled', () => events.push('enabled'));
      service.on('plugin:disabled', () => events.push('disabled'));
      service.on('plugin:unregistered', () => events.push('unregistered'));

      service.register(mockPlugin1);
      service.disable('eslint');
      service.enable('eslint');
      service.unregister('eslint');

      // Give events time to emit
      setTimeout(() => {
        expect(events).toEqual(['registered', 'disabled', 'enabled', 'unregistered']);
        done();
      }, 10);
    });
  });

  describe('Result Aggregation Edge Cases', () => {
    test('should handle empty results correctly', async () => {
      const result = await service.execute({ files: ['nonexistent.js'] });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.issuesByFile.size).toBe(0);
      expect(result.summary.totalIssues).toBe(0);
      expect(result.summary.lintersRun).toBe(0);
    });

    test('should aggregate issues by severity correctly', async () => {
      const issues: LintIssue[] = [
        { filePath: 'test.js', line: 1, column: 1, severity: 'error', ruleId: 'rule1', message: 'Error' },
        { filePath: 'test.js', line: 2, column: 1, severity: 'warning', ruleId: 'rule2', message: 'Warning' },
        { filePath: 'test.js', line: 3, column: 1, severity: 'info', ruleId: 'rule3', message: 'Info' },
        { filePath: 'test.js', line: 4, column: 1, severity: 'hint', ruleId: 'rule4', message: 'Hint' },
      ];

      const plugin = new MockLinterPlugin('severity-test', issues);
      service.register(plugin);

      const result = await service.execute({ files: ['test.js'] });

      expect(result.issuesBySeverity.error).toHaveLength(1);
      expect(result.issuesBySeverity.warning).toHaveLength(1);
      expect(result.issuesBySeverity.info).toHaveLength(1);
      expect(result.issuesBySeverity.hint).toHaveLength(1);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.warningCount).toBe(1);
      expect(result.summary.infoCount).toBe(1);
      expect(result.summary.hintCount).toBe(1);
    });
  });

  describe('Service Configuration Options', () => {
    test('should use default configuration when not specified', () => {
      const defaultService = new LinterService({ projectPath: '/test' });
      expect(defaultService).toBeDefined();
    });

    test('should respect autoFix global configuration', async () => {
      const autoFixService = new LinterService({
        projectPath: '/test',
        autoFix: { enabled: true, maxAttempts: 5, backoffMs: 500 }
      });
      await autoFixService.initialize();

      const issue: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'rule',
        message: 'Issue',
        fix: {
          replacements: [{
            startOffset: 0,
            endOffset: 1,
            text: 'x'
          }]
        }
      };

      const plugin = new MockLinterPlugin('auto-fix-test', [issue]);
      autoFixService.register(plugin);

      const result = await autoFixService.execute({ fix: true, files: ['test.js'] });

      expect(result.success).toBe(true);

      await autoFixService.dispose();
    });
  });
});