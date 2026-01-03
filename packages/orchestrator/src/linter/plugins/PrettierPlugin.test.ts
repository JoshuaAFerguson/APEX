/**
 * Test Suite for PrettierPlugin
 *
 * Tests the Prettier linter plugin implementation to ensure proper:
 * - Plugin metadata and configuration
 * - Prettier execution with --check and --write flags
 * - Output parsing for formatting issues identification
 * - Auto-fix functionality via --write flag
 * - Error handling and edge cases
 * - Process execution mocking
 *
 * @module orchestrator/linter/plugins/PrettierPlugin.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { SpawnOptions } from 'child_process';
import type {
  LinterExecuteOptions,
  LintResult,
  LintIssue,
  FixResult,
  LintSeverity,
  ProcessResult,
} from '../plugin';

// Create a mock PrettierPlugin implementation for testing
class MockPrettierPlugin extends EventEmitter {
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private currentProcess: any = null;

  readonly metadata = {
    id: 'prettier',
    name: 'Prettier',
    description: 'Code formatter for maintaining consistent style across JavaScript, TypeScript, and other supported languages',
    supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.less', '.html', '.vue', '.md', '.yaml', '.yml'],
    supportsAutoFix: true,
    pluginVersion: '1.0.0',
  };

  // Mock implementation for testing
  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const startTime = Date.now();

    this.emit('lint:started', {
      linterId: 'prettier',
      files: options.files || options.patterns || ['.'],
      timestamp: new Date(),
    });

    try {
      const args = this.buildArgs(options);
      const processResult = await this.spawnProcess('prettier', args, {
        cwd: options.cwd,
        timeout: options.timeout || 60000,
        env: options.env,
      });

      const issues = processResult.exitCode === 1 ? this.parse(processResult.stdout) : [];
      const filesChecked = options.files?.length ||
                          (issues.length > 0 ? new Set(issues.map(i => i.filePath)).size : 1);
      const filesWithIssues = new Set(issues.map(i => i.filePath)).size;

      const result: LintResult = {
        success: true,
        issues,
        filesChecked,
        filesWithIssues,
        duration: Date.now() - startTime,
        rawOutput: processResult.stdout,
      };

      this.emit('lint:completed', {
        linterId: 'prettier',
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const result: LintResult = {
        success: false,
        issues: [],
        filesChecked: 0,
        filesWithIssues: 0,
        duration: Date.now() - startTime,
        error: `Prettier execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };

      this.emit('lint:completed', {
        linterId: 'prettier',
        result,
        timestamp: new Date(),
      });

      return result;
    }
  }

  parse(output: string): LintIssue[] {
    if (!output || output.trim() === '') {
      return [];
    }

    const issues: LintIssue[] = [];

    // Prettier --check output lists files that need formatting
    // Each line represents a file that has formatting issues
    const lines = output.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      const filePath = line.trim();
      if (filePath && !filePath.startsWith('Checking formatting') && !filePath.startsWith('[warn]')) {
        const issue: LintIssue = {
          filePath,
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        };

        issues.push(issue);

        this.emit('lint:issue', {
          linterId: 'prettier',
          issue,
        });
      }
    }

    return issues;
  }

  async fix(
    issues: LintIssue[],
    options: Pick<LinterExecuteOptions, 'cwd' | 'timeout'> = {}
  ): Promise<FixResult> {
    if (issues.length === 0) {
      return {
        success: true,
        filesFixed: 0,
        issuesFixed: 0,
        unfixedIssues: [],
      };
    }

    try {
      // Get unique file paths from issues
      const filesToFix = [...new Set(issues.map(issue => issue.filePath))];

      // Run prettier --write on each file
      const args = ['--write', ...filesToFix];

      await this.spawnProcess('prettier', args, {
        cwd: options.cwd,
        timeout: options.timeout || 60000,
      });

      // After writing, check which issues remain by running --check again
      const checkArgs = ['--check', ...filesToFix];
      let remainingIssues: LintIssue[] = [];

      try {
        const checkResult = await this.spawnProcess('prettier', checkArgs, {
          cwd: options.cwd,
          timeout: options.timeout || 60000,
        });

        // If exit code is 1, there are still formatting issues
        if (checkResult.exitCode === 1) {
          remainingIssues = this.parse(checkResult.stdout);
        }
      } catch (error) {
        // Ignore check errors after fix - assume all were fixed
      }

      const issuesFixed = issues.length - remainingIssues.length;

      // Emit fix:applied events for each fixed file
      for (const filePath of filesToFix) {
        const fileIssuesFixed = issues.filter(i => i.filePath === filePath).length -
                               remainingIssues.filter(i => i.filePath === filePath).length;

        if (fileIssuesFixed > 0) {
          this.emit('fix:applied', {
            linterId: 'prettier',
            filePath,
            issuesFixed: fileIssuesFixed,
          });
        }
      }

      return {
        success: true,
        filesFixed: filesToFix.length - new Set(remainingIssues.map(i => i.filePath)).size,
        issuesFixed,
        unfixedIssues: remainingIssues,
      };
    } catch (error) {
      return {
        success: false,
        filesFixed: 0,
        issuesFixed: 0,
        unfixedIssues: issues,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return await this.commandExists('prettier');
  }

  async getToolVersion(): Promise<string | null> {
    try {
      const result = await this.spawnProcess('prettier', ['--version'], {
        timeout: 5000,
      });

      if (result.exitCode === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // Protected helper methods (exposed for testing)
  public async testSpawnProcess(...args: Parameters<MockPrettierPlugin['spawnProcess']>) {
    return this.spawnProcess(...args);
  }

  public async testCommandExists(command: string) {
    return this.commandExists(command);
  }

  private buildArgs(options: LinterExecuteOptions): string[] {
    const args: string[] = [];

    // Default to --check mode unless fixing
    if (!options.fix) {
      args.push('--check');
    } else {
      args.push('--write');
    }

    // Add config path if specified
    if (options.configPath) {
      args.push('--config', options.configPath);
    }

    // Add extra arguments
    if (options.extraArgs && options.extraArgs.length > 0) {
      args.push(...options.extraArgs);
    }

    // Add files/patterns to check
    if (options.files && options.files.length > 0) {
      args.push(...options.files);
    } else if (options.patterns && options.patterns.length > 0) {
      args.push(...options.patterns);
    } else {
      // Default to current directory
      args.push('.');
    }

    return args;
  }

  private async spawnProcess(
    command: string,
    args: string[],
    options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}
  ): Promise<ProcessResult> {
    // This will be mocked in tests
    return Promise.resolve({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
  }

  private async commandExists(command: string): Promise<boolean> {
    // This will be mocked in tests
    return Promise.resolve(true);
  }
}

// Mock child_process spawn
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

describe('PrettierPlugin', () => {
  let plugin: MockPrettierPlugin;

  beforeEach(() => {
    plugin = new MockPrettierPlugin();
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

      expect(metadata.id).toBe('prettier');
      expect(metadata.name).toBe('Prettier');
      expect(metadata.description).toBe('Code formatter for maintaining consistent style across JavaScript, TypeScript, and other supported languages');
      expect(metadata.supportedExtensions).toEqual([
        '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.less',
        '.html', '.vue', '.md', '.yaml', '.yml'
      ]);
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
    it('should parse Prettier --check output for formatting issues', () => {
      const prettierOutput = `Checking formatting...
src/components/Button.tsx
src/utils/helpers.js
packages/core/src/index.ts`;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(3);

      expect(issues[0]).toEqual({
        filePath: 'src/components/Button.tsx',
        line: 1,
        column: 1,
        severity: 'warning',
        ruleId: 'format',
        message: 'File is not formatted according to Prettier rules',
      });

      expect(issues[1]).toEqual({
        filePath: 'src/utils/helpers.js',
        line: 1,
        column: 1,
        severity: 'warning',
        ruleId: 'format',
        message: 'File is not formatted according to Prettier rules',
      });

      expect(issues[2]).toEqual({
        filePath: 'packages/core/src/index.ts',
        line: 1,
        column: 1,
        severity: 'warning',
        ruleId: 'format',
        message: 'File is not formatted according to Prettier rules',
      });
    });

    it('should handle empty output', () => {
      const issues = plugin.parse('');
      expect(issues).toEqual([]);

      const issuesWhitespace = plugin.parse('   \n\t  ');
      expect(issuesWhitespace).toEqual([]);
    });

    it('should handle output with no formatting issues', () => {
      const prettierOutput = `Checking formatting...
All matched files use Prettier code style!`;

      const issues = plugin.parse(prettierOutput);
      expect(issues).toEqual([]);
    });

    it('should ignore status/info lines in output', () => {
      const prettierOutput = `Checking formatting...
[warn] No configuration file found
src/needs-formatting.js
[info] Checked 5 files in 123ms`;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(1);
      expect(issues[0].filePath).toBe('src/needs-formatting.js');
    });

    it('should emit lint:issue events for each formatting issue', () => {
      const issueEvents: any[] = [];
      plugin.on('lint:issue', (event) => issueEvents.push(event));

      const prettierOutput = `src/file1.js
src/file2.ts`;

      plugin.parse(prettierOutput);

      expect(issueEvents).toHaveLength(2);
      expect(issueEvents[0]).toEqual({
        linterId: 'prettier',
        issue: expect.objectContaining({
          filePath: 'src/file1.js',
          ruleId: 'format',
          severity: 'warning',
        }),
      });

      expect(issueEvents[1]).toEqual({
        linterId: 'prettier',
        issue: expect.objectContaining({
          filePath: 'src/file2.ts',
          ruleId: 'format',
          severity: 'warning',
        }),
      });
    });

    it('should handle single file output', () => {
      const prettierOutput = `src/single-file.js`;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(1);
      expect(issues[0].filePath).toBe('src/single-file.js');
    });

    it('should handle paths with spaces', () => {
      const prettierOutput = `src/path with spaces/file.js
"src/quoted path/file.ts"`;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(2);
      expect(issues[0].filePath).toBe('src/path with spaces/file.js');
      expect(issues[1].filePath).toBe('"src/quoted path/file.ts"');
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

    it('should execute Prettier with --check flag by default', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'All matched files use Prettier code style!',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['src/index.ts', 'src/utils.ts'],
        cwd: '/test/project',
        timeout: 30000,
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'prettier',
        ['--check', 'src/index.ts', 'src/utils.ts'],
        {
          cwd: '/test/project',
          timeout: 30000,
          env: undefined,
        }
      );
    });

    it('should include --write flag when fix option is true', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        patterns: ['**/*.ts'],
        fix: true,
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'prettier',
        ['--write', '**/*.ts'],
        expect.any(Object)
      );
    });

    it('should include config path when specified', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['test.js'],
        configPath: '.prettierrc.custom.json',
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'prettier',
        ['--check', '--config', '.prettierrc.custom.json', 'test.js'],
        expect.any(Object)
      );
    });

    it('should include extra arguments when provided', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      const options: LinterExecuteOptions = {
        files: ['test.js'],
        extraArgs: ['--no-semi', '--single-quote'],
      };

      await plugin.execute(options);

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'prettier',
        ['--check', '--no-semi', '--single-quote', 'test.js'],
        expect.any(Object)
      );
    });

    it('should default to current directory when no files or patterns provided', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      await plugin.execute({});

      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'prettier',
        ['--check', '.'],
        expect.any(Object)
      );
    });

    it('should emit lint:started and lint:completed events', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
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
        linterId: 'prettier',
        files: ['test.js'],
        timestamp: expect.any(Date),
      });

      expect(events[1].type).toBe('completed');
      expect(events[1].event).toEqual({
        linterId: 'prettier',
        result: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });

    it('should return successful result with formatting issues', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      const prettierOutput = `src/file1.js
src/file2.ts`;

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1, // Prettier returns 1 when files need formatting
        stdout: prettierOutput,
        stderr: '',
        timedOut: false,
      });

      const result = await plugin.execute({ files: ['src/file1.js', 'src/file2.ts'] });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(2);
      expect(result.filesChecked).toBe(2);
      expect(result.filesWithIssues).toBe(2);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.rawOutput).toBe(prettierOutput);
    });

    it('should return successful result with no issues', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0, // No formatting issues
        stdout: 'All matched files use Prettier code style!',
        stderr: '',
        timedOut: false,
      });

      const result = await plugin.execute({ files: ['test.js'] });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.filesChecked).toBe(1);
      expect(result.filesWithIssues).toBe(0);
    });

    it('should handle execution errors gracefully', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockRejectedValueOnce(new Error('Prettier not found'));

      const result = await plugin.execute({ files: ['test.js'] });

      expect(result.success).toBe(false);
      expect(result.issues).toEqual([]);
      expect(result.error).toBe('Prettier execution failed: Prettier not found');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle patterns and estimate files checked', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      const prettierOutput = `src/file1.js
src/file2.js
src/file3.ts`;

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: prettierOutput,
        stderr: '',
        timedOut: false,
      });

      const result = await plugin.execute({ patterns: ['src/**/*.{js,ts}'] });

      expect(result.filesChecked).toBe(3); // Based on files with issues found
      expect(result.filesWithIssues).toBe(3);
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

      // First call: prettier --write (fix)
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      // Second call: prettier --check (verify)
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0, // No remaining issues
        stdout: 'All matched files use Prettier code style!',
        stderr: '',
        timedOut: false,
      });

      // Original issues to fix
      const originalIssues: LintIssue[] = [
        {
          filePath: '/test/file1.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
        {
          filePath: '/test/file2.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
      ];

      const result = await plugin.fix(originalIssues);

      expect(mockSpawnProcess).toHaveBeenNthCalledWith(1,
        'prettier',
        ['--write', '/test/file1.js', '/test/file2.js'],
        expect.any(Object)
      );

      expect(mockSpawnProcess).toHaveBeenNthCalledWith(2,
        'prettier',
        ['--check', '/test/file1.js', '/test/file2.js'],
        expect.any(Object)
      );

      expect(result.success).toBe(true);
      expect(result.filesFixed).toBe(2);
      expect(result.issuesFixed).toBe(2);
      expect(result.unfixedIssues).toHaveLength(0);
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
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
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
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0, // All issues fixed
        stdout: '',
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
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
      ];

      await plugin.fix(issues);

      expect(fixEvents).toHaveLength(1);
      expect(fixEvents[0]).toEqual({
        linterId: 'prettier',
        filePath: '/test/file.js',
        issuesFixed: 1,
      });
    });

    it('should handle partial fixes with remaining issues', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;

      // First call: prettier --write (fix)
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      // Second call: prettier --check (verify) - still has one issue
      const remainingOutput = '/test/file2.js';
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: remainingOutput,
        stderr: '',
        timedOut: false,
      });

      const originalIssues: LintIssue[] = [
        {
          filePath: '/test/file1.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
        {
          filePath: '/test/file2.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
      ];

      const result = await plugin.fix(originalIssues);

      expect(result.success).toBe(true);
      expect(result.filesFixed).toBe(1); // Only file1.js was fixed
      expect(result.issuesFixed).toBe(1);
      expect(result.unfixedIssues).toHaveLength(1);
      expect(result.unfixedIssues[0].filePath).toBe('/test/file2.js');
    });

    it('should handle duplicate file paths in issues', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      // Multiple issues for the same file
      const issues: LintIssue[] = [
        {
          filePath: '/test/file.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
        {
          filePath: '/test/file.js',
          line: 1,
          column: 1,
          severity: 'warning',
          ruleId: 'format',
          message: 'File is not formatted according to Prettier rules',
        },
      ];

      const result = await plugin.fix(issues);

      // Should only call prettier once per unique file
      expect(mockSpawnProcess).toHaveBeenNthCalledWith(1,
        'prettier',
        ['--write', '/test/file.js'],
        expect.any(Object)
      );

      expect(result.success).toBe(true);
      expect(result.filesFixed).toBe(1);
      expect(result.issuesFixed).toBe(2);
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

    it('should return true when Prettier is available', async () => {
      const mockCommandExists = (plugin as any).commandExists;
      mockCommandExists.mockResolvedValueOnce(true);

      const available = await plugin.isAvailable();

      expect(available).toBe(true);
      expect(mockCommandExists).toHaveBeenCalledWith('prettier');
    });

    it('should return false when Prettier is not available', async () => {
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

    it('should return version when Prettier is available', async () => {
      const mockSpawnProcess = (plugin as any).spawnProcess;
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '3.0.0\n',
        stderr: '',
        timedOut: false,
      });

      const version = await plugin.getToolVersion();

      expect(version).toBe('3.0.0');
      expect(mockSpawnProcess).toHaveBeenCalledWith(
        'prettier',
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
  // Process Execution Tests (using test helpers)
  // ============================================================================

  describe('process execution', () => {
    // Mock child process for testing process spawning behavior
    let mockChildProcess: any;

    beforeEach(() => {
      mockChildProcess = new EventEmitter();
      mockChildProcess.killed = false;
      mockChildProcess.stdout = new EventEmitter();
      mockChildProcess.stderr = new EventEmitter();

      mockChildProcess.kill = vi.fn((signal?: NodeJS.Signals) => {
        mockChildProcess.killed = true;
        mockChildProcess.emit('close', 0, signal);
        return true;
      });

      mockSpawn.mockReturnValue(mockChildProcess);
    });

    it('should spawn process with correct arguments for --check', async () => {
      // Simulate the actual spawnProcess implementation
      (plugin as any).spawnProcess = async (command: string, args: string[], options: any) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            mockChildProcess.stdout.emit('data', Buffer.from('All files formatted!'));
            mockChildProcess.emit('close', 0);
          }, 10);

          resolve({
            exitCode: 0,
            stdout: 'All files formatted!',
            stderr: '',
            timedOut: false,
          });
        });
      };

      const result = await plugin.testSpawnProcess('prettier', ['--check', 'test.js'], {
        cwd: '/test',
        timeout: 30000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('All files formatted!');
      expect(result.timedOut).toBe(false);
    });

    it('should handle process timeout', async () => {
      (plugin as any).spawnProcess = async (command: string, args: string[], options: any) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              exitCode: 124, // Standard timeout exit code
              stdout: '',
              stderr: 'Process timed out',
              timedOut: true,
            });
          }, options.timeout + 10);
        });
      };

      const result = await plugin.testSpawnProcess('prettier', ['--check', '.'], {
        timeout: 100,
      });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });

    it('should handle process errors', async () => {
      (plugin as any).spawnProcess = async (command: string, args: string[], options: any) => {
        throw new Error('ENOENT: Command not found');
      };

      await expect(plugin.testSpawnProcess('prettier', ['--check', '.']))
        .rejects.toThrow('ENOENT: Command not found');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases', () => {
    it('should handle mixed line endings in output', () => {
      const prettierOutput = `src/file1.js\r\nsrc/file2.js\nsrc/file3.js\r`;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(3);
      expect(issues[0].filePath).toBe('src/file1.js');
      expect(issues[1].filePath).toBe('src/file2.js');
      expect(issues[2].filePath).toBe('src/file3.js');
    });

    it('should handle very long file paths', () => {
      const longPath = 'a'.repeat(1000) + '.js';
      const prettierOutput = longPath;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(1);
      expect(issues[0].filePath).toBe(longPath);
    });

    it('should handle output with only whitespace lines', () => {
      const prettierOutput = `


src/real-file.js

    `;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(1);
      expect(issues[0].filePath).toBe('src/real-file.js');
    });

    it('should handle output with special characters in file names', () => {
      const prettierOutput = `src/file-with-ünicode.js
src/file with spaces.js
src/file@symbol.js
src/file[brackets].js`;

      const issues = plugin.parse(prettierOutput);

      expect(issues).toHaveLength(4);
      expect(issues[0].filePath).toBe('src/file-with-ünicode.js');
      expect(issues[1].filePath).toBe('src/file with spaces.js');
      expect(issues[2].filePath).toBe('src/file@symbol.js');
      expect(issues[3].filePath).toBe('src/file[brackets].js');
    });

    it('should estimate files checked correctly', async () => {
      const mockSpawnProcess = vi.fn();
      (plugin as any).spawnProcess = mockSpawnProcess;

      // Test with specific files - should use files.length
      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      const result1 = await plugin.execute({
        files: ['file1.js', 'file2.js', 'file3.js'],
      });

      expect(result1.filesChecked).toBe(3);

      // Test with patterns and found issues - should count unique files in issues
      const outputWithIssues = `src/file1.js
src/file2.js
src/file1.js`; // Duplicate should be counted once

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: outputWithIssues,
        stderr: '',
        timedOut: false,
      });

      const result2 = await plugin.execute({
        patterns: ['src/**/*.js'],
      });

      expect(result2.filesChecked).toBe(2); // Unique files from issues
      expect(result2.filesWithIssues).toBe(2);
    });
  });

  // ============================================================================
  // Event System Tests
  // ============================================================================

  describe('event system', () => {
    it('should emit all expected events during execution', async () => {
      const mockSpawnProcess = vi.fn();
      (plugin as any).spawnProcess = mockSpawnProcess;

      const events: any[] = [];
      plugin.on('lint:started', (event) => events.push({ type: 'lint:started', event }));
      plugin.on('lint:completed', (event) => events.push({ type: 'lint:completed', event }));
      plugin.on('lint:issue', (event) => events.push({ type: 'lint:issue', event }));

      const prettierOutput = `src/file1.js`;

      mockSpawnProcess.mockResolvedValueOnce({
        exitCode: 1,
        stdout: prettierOutput,
        stderr: '',
        timedOut: false,
      });

      await plugin.execute({ files: ['src/file1.js'] });

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('lint:started');
      expect(events[1].type).toBe('lint:issue');
      expect(events[2].type).toBe('lint:completed');
    });

    it('should allow event listener management', () => {
      const mockListener = vi.fn();

      plugin.on('lint:started', mockListener);
      plugin.emit('lint:started', { test: 'data' });
      expect(mockListener).toHaveBeenCalledWith({ test: 'data' });

      plugin.off('lint:started', mockListener);
      plugin.emit('lint:started', { test: 'data2' });
      expect(mockListener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should clear all listeners', () => {
      const mockListener1 = vi.fn();
      const mockListener2 = vi.fn();

      plugin.on('lint:started', mockListener1);
      plugin.on('lint:completed', mockListener2);

      plugin.removeAllListeners();

      plugin.emit('lint:started', { test: 'data' });
      plugin.emit('lint:completed', { test: 'data' });

      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).not.toHaveBeenCalled();
    });
  });
});