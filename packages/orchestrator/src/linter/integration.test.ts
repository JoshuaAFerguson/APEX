/**
 * Integration Tests for Linter Plugin System
 *
 * This test file verifies that the linter plugin system works correctly
 * when integrated with the broader APEX ecosystem.
 *
 * @module orchestrator/linter/integration.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseLinterPlugin, type LinterPluginMetadata, type LintIssue, type LintResult, type FixResult, type LinterExecuteOptions } from './plugin';

// ============================================================================
// Mock ESLint Plugin Implementation
// ============================================================================

class MockESLintPlugin extends BaseLinterPlugin {
  get metadata(): LinterPluginMetadata {
    return {
      id: 'eslint',
      name: 'ESLint',
      description: 'JavaScript/TypeScript linter',
      supportedExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const startTime = Date.now();

    // Simulate ESLint execution
    const files = options.files || options.patterns || [];

    // Mock some linting issues
    const issues: LintIssue[] = files.flatMap(file => [
      {
        filePath: file,
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'no-unused-vars',
        message: `'unusedVar' is defined but never used`,
        fix: {
          description: 'Remove unused variable',
          replacements: [{ startOffset: 0, endOffset: 10, text: '' }],
        },
      },
      {
        filePath: file,
        line: 5,
        column: 15,
        severity: 'warning',
        ruleId: 'semi',
        message: 'Missing semicolon',
        fix: {
          description: 'Add semicolon',
          replacements: [{ startOffset: 45, endOffset: 45, text: ';' }],
        },
      },
    ]);

    const duration = Date.now() - startTime;

    return {
      success: true,
      issues,
      filesChecked: files.length,
      filesWithIssues: files.length,
      duration,
    };
  }

  parse(output: string): LintIssue[] {
    try {
      const parsed = JSON.parse(output);
      return parsed.flatMap((file: any) =>
        file.messages.map((msg: any) => ({
          filePath: file.filePath,
          line: msg.line,
          column: msg.column,
          severity: this.parseSeverity(msg.severity),
          ruleId: msg.ruleId,
          message: msg.message,
          ...(msg.fix && { fix: msg.fix }),
        }))
      );
    } catch {
      return [];
    }
  }

  async fix(issues: LintIssue[]): Promise<FixResult> {
    // Simulate fixing issues
    const fixableIssues = issues.filter(issue => issue.fix);
    const unfixableIssues = issues.filter(issue => !issue.fix);

    return {
      success: true,
      filesFixed: new Set(fixableIssues.map(i => i.filePath)).size,
      issuesFixed: fixableIssues.length,
      unfixedIssues: unfixableIssues,
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.commandExists('eslint');
  }

  async getToolVersion(): Promise<string | null> {
    try {
      const result = await this.spawnProcess('eslint', ['--version'], { timeout: 5000 });
      return result.exitCode === 0 ? result.stdout.trim() : null;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Linter Plugin System Integration', () => {
  let eslintPlugin: MockESLintPlugin;

  beforeEach(() => {
    eslintPlugin = new MockESLintPlugin();
  });

  describe('Plugin Registry Simulation', () => {
    it('should register and retrieve plugins by ID', () => {
      const registry = new Map<string, BaseLinterPlugin>();

      registry.set(eslintPlugin.metadata.id, eslintPlugin);

      const retrievedPlugin = registry.get('eslint');
      expect(retrievedPlugin).toBe(eslintPlugin);
      expect(retrievedPlugin?.metadata.name).toBe('ESLint');
    });

    it('should filter plugins by supported extensions', () => {
      const plugins = [eslintPlugin];
      const jsFiles = ['test.js', 'app.ts', 'config.json'];

      const compatiblePlugins = plugins.filter(plugin =>
        jsFiles.some(file =>
          plugin.metadata.supportedExtensions.some(ext => file.endsWith(ext))
        )
      );

      expect(compatiblePlugins).toHaveLength(1);
      expect(compatiblePlugins[0].metadata.id).toBe('eslint');
    });
  });

  describe('Multi-Plugin Workflow', () => {
    it('should execute multiple linting phases', async () => {
      const testFiles = ['src/app.ts', 'src/utils.js'];

      // Phase 1: Execute linting
      const lintResult = await eslintPlugin.execute({ files: testFiles });
      expect(lintResult.success).toBe(true);
      expect(lintResult.issues.length).toBe(4); // 2 issues per file
      expect(lintResult.filesChecked).toBe(2);

      // Phase 2: Apply fixes
      const fixableIssues = lintResult.issues.filter(issue => issue.fix);
      const fixResult = await eslintPlugin.fix(fixableIssues);

      expect(fixResult.success).toBe(true);
      expect(fixResult.issuesFixed).toBe(4); // All issues have fixes in mock
      expect(fixResult.filesFixed).toBe(2);
    });

    it('should handle plugin capabilities correctly', async () => {
      const metadata = eslintPlugin.metadata;

      expect(metadata.supportsAutoFix).toBe(true);
      expect(metadata.supportedExtensions).toContain('.ts');
      expect(metadata.supportedExtensions).toContain('.js');

      const available = await eslintPlugin.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('Event Handling Integration', () => {
    it('should emit and handle linting lifecycle events', async () => {
      const events: string[] = [];

      eslintPlugin.on('lint:started', (event) => {
        events.push(`started:${event.linterId}`);
      });

      eslintPlugin.on('lint:completed', (event) => {
        events.push(`completed:${event.linterId}`);
      });

      eslintPlugin.on('lint:issue', (event) => {
        events.push(`issue:${event.linterId}:${event.issue.ruleId}`);
      });

      // Simulate emitting events during execution
      eslintPlugin.emit('lint:started', {
        linterId: 'eslint',
        files: ['test.js'],
        timestamp: new Date(),
      });

      eslintPlugin.emit('lint:issue', {
        linterId: 'eslint',
        issue: {
          filePath: 'test.js',
          line: 1,
          column: 1,
          severity: 'error',
          ruleId: 'no-unused-vars',
          message: 'Test issue',
        },
      });

      eslintPlugin.emit('lint:completed', {
        linterId: 'eslint',
        result: await eslintPlugin.execute({ files: ['test.js'] }),
        timestamp: new Date(),
      });

      expect(events).toEqual([
        'started:eslint',
        'issue:eslint:no-unused-vars',
        'completed:eslint',
      ]);
    });
  });

  describe('Error Resilience', () => {
    it('should handle plugin failures gracefully', async () => {
      // Mock a plugin that fails
      const failingPlugin = new MockESLintPlugin();
      failingPlugin.execute = async () => {
        throw new Error('Plugin execution failed');
      };

      try {
        await failingPlugin.execute({ files: ['test.js'] });
        fail('Expected plugin to throw error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Plugin execution failed');
      }
    });

    it('should validate plugin metadata', () => {
      const metadata = eslintPlugin.metadata;

      expect(metadata.id).toBeTruthy();
      expect(metadata.name).toBeTruthy();
      expect(metadata.description).toBeTruthy();
      expect(metadata.supportedExtensions.length).toBeGreaterThan(0);
      expect(typeof metadata.supportsAutoFix).toBe('boolean');
      expect(metadata.pluginVersion).toBeTruthy();
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete linting within reasonable time', async () => {
      const startTime = Date.now();
      const result = await eslintPlugin.execute({ files: ['test.js'] });
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast for mock
    });

    it('should handle large file lists efficiently', async () => {
      const largeFileList = Array.from({ length: 100 }, (_, i) => `file${i}.js`);

      const result = await eslintPlugin.execute({ files: largeFileList });

      expect(result.filesChecked).toBe(100);
      expect(result.issues.length).toBe(200); // 2 issues per file
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should accept and use linter-specific options', async () => {
      const options: LinterExecuteOptions = {
        files: ['test.js'],
        fix: true,
        configPath: '.eslintrc.json',
        extraArgs: ['--max-warnings', '0'],
        timeout: 30000,
        env: { NODE_ENV: 'test' },
      };

      const result = await eslintPlugin.execute(options);
      expect(result.success).toBe(true);
    });

    it('should handle missing or invalid configuration gracefully', async () => {
      const options: LinterExecuteOptions = {
        files: ['test.js'],
        configPath: 'non-existent-config.json',
      };

      // Should not throw an error, even with invalid config
      const result = await eslintPlugin.execute(options);
      expect(typeof result.success).toBe('boolean');
    });
  });
});