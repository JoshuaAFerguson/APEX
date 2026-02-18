/**
 * Test Suite for ESLintPlugin
 *
 * Tests the ESLint linter plugin implementation to ensure proper:
 * - Plugin metadata and configuration
 * - ESLint execution with various options
 * - JSON output parsing and issue conversion
 * - Auto-fix functionality
 * - Error handling and edge cases
 *
 * @module orchestrator/linter/plugins/eslint.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { SpawnOptions } from 'child_process';
import { ESLintPlugin } from './eslint';
import type {
  LinterExecuteOptions,
  LintResult,
  LintIssue,
  FixResult,
  LintSeverity,
  ProcessResult,
} from '../plugin';

// Mock child_process spawn
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

describe('ESLintPlugin', () => {
  let plugin: ESLintPlugin;

  beforeEach(() => {
    plugin = new ESLintPlugin();
    vi.clearAllMocks();
  });

  afterEach(() => {
    plugin.removeAllListeners();
  });

  // ============================================================================
  // Plugin Metadata Tests
  // ============================================================================

  describe('metadata', () => {
    it('should return correct plugin metadata', () => {
      const metadata = plugin.metadata;

      expect(metadata.id).toBe('eslint');
      expect(metadata.name).toBe('ESLint');
      expect(metadata.description).toBe('JavaScript and TypeScript linter for identifying and fixing code quality issues');
      expect(metadata.supportedExtensions).toEqual(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue']);
      expect(metadata.supportsAutoFix).toBe(true);
      expect(metadata.pluginVersion).toBe('1.0.0');
    });

    it('should extend EventEmitter', () => {
      expect(plugin).toBeInstanceOf(EventEmitter);
    });
  });

  // ============================================================================
  // Parse Method Tests
  // ============================================================================

  describe('parse', () => {
    it('should parse valid ESLint JSON output', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 2,
              message: 'Variable is defined but never used.',
              line: 10,
              column: 5,
              endLine: 10,
              endColumn: 15,
              nodeType: 'Identifier',
              messageId: 'unusedVar',
            },
            {
              ruleId: 'prefer-const',
              severity: 1,
              message: 'Prefer const for variables that are never modified.',
              line: 20,
              column: 3,
              nodeType: 'VariableDeclarator',
              fix: {
                range: [100, 103],
                text: 'const',
              },
            },
          ],
          errorCount: 1,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 1,
        },
      ]);

      const issues = plugin.parse(eslintOutput);

      expect(issues).toHaveLength(2);

      // Test error issue
      expect(issues[0]).toEqual({
        filePath: '/test/file.js',
        line: 10,
        column: 5,
        endLine: 10,
        endColumn: 15,
        severity: 'error',
        ruleId: 'no-unused-vars',
        message: 'Variable is defined but never used.',
      });

      // Test warning issue with fix
      expect(issues[1]).toEqual({
        filePath: '/test/file.js',
        line: 20,
        column: 3,
        severity: 'warning',
        ruleId: 'prefer-const',
        message: 'Prefer const for variables that are never modified.',
        fix: {
          description: 'Auto-fix suggestion from ESLint',
          replacements: [
            {
              startOffset: 100,
              endOffset: 103,
              text: 'const',
            },
          ],
        },
      });
    });

    it('should handle empty output', () => {
      const issues = plugin.parse('');
      expect(issues).toEqual([]);

      const issuesWhitespace = plugin.parse('   \n\t  ');
      expect(issuesWhitespace).toEqual([]);
    });

    it('should handle output with no issues', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/clean-file.js',
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      const issues = plugin.parse(eslintOutput);
      expect(issues).toEqual([]);
    });

    it('should handle messages with null ruleId', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            {
              ruleId: null,
              severity: 2,
              message: 'Parsing error: Unexpected token',
              line: 1,
              column: 1,
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      const issues = plugin.parse(eslintOutput);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe('unknown');
    });

    it('should handle suggestions in messages', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            {
              ruleId: 'prefer-object-spread',
              severity: 1,
              message: 'Use object spread instead of Object.assign.',
              line: 5,
              column: 1,
              suggestions: [
                {
                  desc: 'Use object spread syntax',
                  fix: {
                    range: [50, 70],
                    text: '{ ...obj }',
                  },
                },
              ],
            },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      const issues = plugin.parse(eslintOutput);

      expect(issues).toHaveLength(1);
      expect(issues[0].suggestions).toEqual([
        {
          description: 'Use object spread syntax',
          fix: {
            description: 'Auto-fix suggestion from ESLint',
            replacements: [
              {
                startOffset: 50,
                endOffset: 70,
                text: '{ ...obj }',
              },
            ],
          },
        },
      ]);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        plugin.parse('invalid json {');
      }).toThrow('Failed to parse ESLint JSON output:');
    });

    it('should emit lint:issue events for each issue', () => {
      const issueEvents: any[] = [];
      plugin.on('lint:issue', (event) => issueEvents.push(event));

      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            {
              ruleId: 'no-console',
              severity: 1,
              message: 'Unexpected console statement.',
              line: 1,
              column: 1,
            },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      plugin.parse(eslintOutput);

      expect(issueEvents).toHaveLength(1);
      expect(issueEvents[0]).toEqual({
        linterId: 'eslint',
        issue: expect.objectContaining({
          filePath: '/test/file.js',
          ruleId: 'no-console',
          severity: 'warning',
        }),
      });
    });
  });

  // ============================================================================
  // Execute Method Tests (using mocked spawnProcess)
  // ============================================================================

  describe('execute', () => {
    beforeEach(() => {
      // Mock the spawnProcess method
      const mockSpawnProcess = vi.fn();
      (plugin as any).spawnProcess = mockSpawnProcess;
    });

    it('should execute ESLint with correct arguments', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['src/index.ts', 'src/utils.ts'],
        fix: false,
        cwd: '/test/project',
        timeout: 30000,
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--format', 'json', 'src/index.ts', 'src/utils.ts'],
        {
          cwd: '/test/project',
          timeout: 30000,
          env: undefined,
        }
      );
    });

    it('should include --fix flag when fix option is true', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        patterns: ['**/*.ts'],
        fix: true,
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--format', 'json', '--fix', '**/*.ts'],
        expect.any(Object)
      );
    });

    it('should include config path when specified', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['test.js'],
        configPath: '.eslintrc.custom.json',
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--format', 'json', '--config', '.eslintrc.custom.json', 'test.js'],
        expect.any(Object)
      );
    });

    it('should include no-ignore flag when specified', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['test.js'],
        noIgnore: true,
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--format', 'json', '--no-ignore', 'test.js'],
        expect.any(Object)
      );
    });

    it('should include extra arguments when provided', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['test.js'],
        extraArgs: ['--quiet', '--ext', '.ts,.tsx'],
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--format', 'json', '--quiet', '--ext', '.ts,.tsx', 'test.js'],
        expect.any(Object)
      );
    });

    it('should default to current directory when no files or patterns provided', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      await plugin.execute({});

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--format', 'json', '.'],
        expect.any(Object)
      );
    });

    it('should emit lint:started and lint:completed events', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const events: any[] = [];
      plugin.on('lint:started', (event) => events.push({ type: 'started', event }));
      plugin.on('lint:completed', (event) => events.push({ type: 'completed', event }));

      const result = await plugin.execute({ files: ['test.js'] });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('started');
      expect(events[0].event).toEqual({
        linterId: 'eslint',
        files: ['test.js'],
        timestamp: expect.any(Date),
      });

      expect(events[1].type).toBe('completed');
      expect(events[1].event).toEqual({
        linterId: 'eslint',
        result: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });

    it('should return successful result with issues', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            {
              ruleId: 'no-console',
              severity: 1,
              message: 'Unexpected console statement.',
              line: 1,
              column: 1,
            },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1, // ESLint returns non-zero when issues found
        stdout: eslintOutput,
        stderr: '',
        timedOut: false,
      });

      const result = await plugin.execute({ files: ['test.js'] });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.filesChecked).toBe(1);
      expect(result.filesWithIssues).toBe(1);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.rawOutput).toBe(eslintOutput);
    });

    it('should handle execution errors gracefully', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockRejectedValueOnce(new Error('ESLint not found'));

      const result = await plugin.execute({ files: ['test.js'] });

      expect(result.success).toBe(false);
      expect(result.issues).toEqual([]);
      expect(result.error).toBe('ESLint execution failed: ESLint not found');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Fix Method Tests
  // ============================================================================

  describe('fix', () => {
    beforeEach(() => {
      const mockSpawnProcess = vi.fn();
      (plugin as any).spawnProcess = mockSpawnProcess;
    });

    it('should apply fixes and return result', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;

      // Mock the fix execution result (fewer issues after fix)
      const fixedOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            // Only one unfixed issue remains
            {
              ruleId: 'no-console',
              severity: 1,
              message: 'Unexpected console statement.',
              line: 1,
              column: 1,
            },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: fixedOutput,
        stderr: '',
        timedOut: false,
      });

      // Original issues to fix
      const originalIssues: LintIssue[] = [
        {
          filePath: '/test/file.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'no-console',
          message: 'Unexpected console statement.',
        },
        {
          filePath: '/test/file.js',
          line: 5,
          column: 3,
          severity: 'warning',
          ruleId: 'prefer-const',
          message: 'Prefer const for variables that are never modified.',
        },
      ];

      const result = await plugin.fix(originalIssues);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--fix', '--format', 'json', '/test/file.js'],
        expect.any(Object)
      );

      expect(result.success).toBe(true);
      expect(result.issuesFixed).toBeGreaterThan(0);
      expect(result.unfixedIssues).toHaveLength(1);
      expect(result.unfixedIssues[0].ruleId).toBe('no-console');
    });

    it('should handle empty issues array', async () => {
      const result = await plugin.fix([]);

      expect(result).toEqual({
        success: true,
        filesFixed: 0,
        issuesFixed: 0,
        unfixedIssues: [],
      });
    });

    it('should handle fix errors gracefully', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockRejectedValueOnce(new Error('Fix failed'));

      const issues: LintIssue[] = [
        {
          filePath: '/test/file.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'prefer-const',
          message: 'Prefer const for variables that are never modified.',
        },
      ];

      const result = await plugin.fix(issues);

      expect(result.success).toBe(false);
      expect(result.filesFixed).toBe(0);
      expect(result.issuesFixed).toBe(0);
      expect(result.unfixedIssues).toEqual(issues);
      expect(result.error).toBe('Fix failed');
    });

    it('should emit fix:applied events', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]', // All issues fixed
        stderr: '',
        timedOut: false,
      });

      const fixEvents: any[] = [];
      plugin.on('fix:applied', (event) => fixEvents.push(event));

      const issues: LintIssue[] = [
        {
          filePath: '/test/file.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'prefer-const',
          message: 'Prefer const for variables that are never modified.',
        },
      ];

      await plugin.fix(issues);

      expect(fixEvents).toHaveLength(1);
      expect(fixEvents[0]).toEqual({
        linterId: 'eslint',
        filePath: '/test/file.js',
        issuesFixed: 1,
      });
    });
  });

  // ============================================================================
  // Tool Availability Tests
  // ============================================================================

  describe('isAvailable', () => {
    beforeEach(() => {
      const mockCommandExists = vi.fn();
      (plugin as any).commandExists = mockCommandExists;
    });

    it('should return true when ESLint is available', async () => {
      const mockCommandExists = (plugin as any).commandExists;
      mockCommandExists.mockResolvedValueOnce(true);

      const available = await plugin.isAvailable();

      expect(available).toBe(true);
      expect(mockCommandExists).toHaveBeenCalledWith('eslint');
    });

    it('should return false when ESLint is not available', async () => {
      const mockCommandExists = (plugin as any).commandExists;
      mockCommandExists.mockResolvedValueOnce(false);

      const available = await plugin.isAvailable();

      expect(available).toBe(false);
    });
  });

  // ============================================================================
  // Version Detection Tests
  // ============================================================================

  describe('getToolVersion', () => {
    beforeEach(() => {
      const mockSpawnProcess = vi.fn();
      (plugin as any).spawnProcess = mockSpawnProcess;
    });

    it('should return version when ESLint is available', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'v8.45.0\n',
        stderr: '',
        timedOut: false,
      });

      const version = await plugin.getToolVersion();

      expect(version).toBe('v8.45.0');
      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'eslint',
        ['--version'],
        { timeout: 5000 }
      );
    });

    it('should return null when version command fails', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'Command not found',
        timedOut: false,
      });

      const version = await plugin.getToolVersion();

      expect(version).toBeNull();
    });

    it('should return null when version command throws', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockRejectedValueOnce(new Error('Spawn failed'));

      const version = await plugin.getToolVersion();

      expect(version).toBeNull();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases', () => {
    it('should handle severity mapping correctly', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file.js',
          messages: [
            { ruleId: 'rule1', severity: 2, message: 'Error', line: 1, column: 1 },
            { ruleId: 'rule2', severity: 1, message: 'Warning', line: 2, column: 1 },
            { ruleId: 'rule3', severity: 0, message: 'Info', line: 3, column: 1 },
          ],
          errorCount: 1,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      const issues = plugin.parse(eslintOutput);

      expect(issues[0].severity).toBe('error');
      expect(issues[1].severity).toBe('warning');
      expect(issues[2].severity).toBe('hint');
    });

    it('should handle multiple files in output', () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/file1.js',
          messages: [
            { ruleId: 'rule1', severity: 2, message: 'Error', line: 1, column: 1 },
          ],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
        {
          filePath: '/test/file2.js',
          messages: [
            { ruleId: 'rule2', severity: 1, message: 'Warning', line: 5, column: 3 },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      const issues = plugin.parse(eslintOutput);

      expect(issues).toHaveLength(2);
      expect(issues[0].filePath).toBe('/test/file1.js');
      expect(issues[1].filePath).toBe('/test/file2.js');
    });

    it('should estimate files checked correctly', async () => {
      const mockSpawnProcess = vi.fn();
      (plugin as any).spawnProcess = mockSpawnProcess;

      // Test with specific files
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
      });

      const result = await plugin.execute({
        files: ['file1.js', 'file2.js', 'file3.js'],
      });

      expect(result.filesChecked).toBe(3);

      // Test with patterns (estimates based on issues found)
      const outputWithIssues = JSON.stringify([
        {
          filePath: '/test/file1.js',
          messages: [{ ruleId: 'rule1', severity: 1, message: 'Warning', line: 1, column: 1 }],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
        {
          filePath: '/test/file2.js',
          messages: [{ ruleId: 'rule2', severity: 1, message: 'Warning', line: 1, column: 1 }],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]);

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: outputWithIssues,
        stderr: '',
        timedOut: false,
      });

      const result2 = await plugin.execute({
        patterns: ['**/*.js'],
      });

      expect(result2.filesChecked).toBe(2); // Based on files with issues
    });
  });
});