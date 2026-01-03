/**
 * Test Suite for Linter Plugin Interface and Base Class
 *
 * This test suite provides comprehensive coverage for:
 * - ILinterPlugin interface compliance
 * - BaseLinterPlugin abstract class functionality
 * - Process spawning and management
 * - Event emission and handling
 * - Utility methods and error handling
 *
 * @module orchestrator/linter/plugin.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import {
  BaseLinterPlugin,
  type ILinterPlugin,
  type LinterPluginMetadata,
  type LinterExecuteOptions,
  type LintResult,
  type LintIssue,
  type FixResult,
  type ProcessResult,
  type LintSeverity,
  type LintFix,
  type LintSuggestion,
  type LintReplacement,
  type LinterPluginEvents,
} from './plugin';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock EventEmitter
const mockSpawn = spawn as MockedFunction<typeof spawn>;

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Mock child process for testing
 */
class MockChildProcess extends EventEmitter {
  killed = false;
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill(signal?: NodeJS.Signals) {
    this.killed = true;
    this.emit('close', 0, signal);
    return true;
  }
}

/**
 * Concrete implementation of BaseLinterPlugin for testing
 */
class TestLinterPlugin extends BaseLinterPlugin {
  private mockMetadata: LinterPluginMetadata = {
    id: 'test-linter',
    name: 'Test Linter',
    description: 'A test linter for unit testing',
    supportedExtensions: ['.js', '.ts', '.test.js'],
    supportsAutoFix: true,
    pluginVersion: '1.0.0-test',
  };

  private mockParseResult: LintIssue[] = [];
  private mockExecuteResult: LintResult = {
    success: true,
    issues: [],
    filesChecked: 0,
    filesWithIssues: 0,
    duration: 0,
  };
  private mockFixResult: FixResult = {
    success: true,
    filesFixed: 0,
    issuesFixed: 0,
    unfixedIssues: [],
  };
  private mockIsAvailable = true;
  private mockToolVersion = '1.0.0';

  get metadata(): LinterPluginMetadata {
    return this.mockMetadata;
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    return this.mockExecuteResult;
  }

  parse(output: string): LintIssue[] {
    return this.mockParseResult;
  }

  async fix(
    issues: LintIssue[],
    options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>
  ): Promise<FixResult> {
    return this.mockFixResult;
  }

  async isAvailable(): Promise<boolean> {
    return this.mockIsAvailable;
  }

  async getToolVersion(): Promise<string | null> {
    return this.mockToolVersion;
  }

  // Test helpers to modify mock behavior
  setMetadata(metadata: Partial<LinterPluginMetadata>) {
    this.mockMetadata = { ...this.mockMetadata, ...metadata };
  }

  setParseResult(issues: LintIssue[]) {
    this.mockParseResult = issues;
  }

  setExecuteResult(result: Partial<LintResult>) {
    this.mockExecuteResult = { ...this.mockExecuteResult, ...result };
  }

  setFixResult(result: Partial<FixResult>) {
    this.mockFixResult = { ...this.mockFixResult, ...result };
  }

  setIsAvailable(available: boolean) {
    this.mockIsAvailable = available;
  }

  setToolVersion(version: string | null) {
    this.mockToolVersion = version;
  }

  // Expose protected methods for testing
  public testSpawnProcess(...args: Parameters<BaseLinterPlugin['spawnProcess']>) {
    return this.spawnProcess(...args);
  }

  public testKillProcess(signal?: NodeJS.Signals) {
    return this.killProcess(signal);
  }

  public testCommandExists(command: string) {
    return this.commandExists(command);
  }

  public testParseSeverity(severity: string | number) {
    return this.parseSeverity(severity);
  }

  public testCreateIssue(params: Parameters<BaseLinterPlugin['createIssue']>[0]) {
    return this.createIssue(params);
  }

  public testCreateLintResult(...args: Parameters<BaseLinterPlugin['createLintResult']>) {
    return this.createLintResult(...args);
  }

  public testCreateErrorResult(...args: Parameters<BaseLinterPlugin['createErrorResult']>) {
    return this.createErrorResult(...args);
  }

  public get testStdoutBuffer() {
    return this.stdoutBuffer;
  }

  public get testStderrBuffer() {
    return this.stderrBuffer;
  }

  public get testCurrentProcess() {
    return this.currentProcess;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('LinterPlugin', () => {
  let plugin: TestLinterPlugin;
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = new TestLinterPlugin();
    mockChildProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  afterEach(() => {
    if (plugin.testCurrentProcess) {
      plugin.testKillProcess();
    }
  });

  // ==========================================================================
  // Interface Compliance Tests
  // ==========================================================================

  describe('ILinterPlugin Interface Compliance', () => {
    it('should implement all required interface methods', () => {
      // Type check - these should not cause TypeScript errors
      const linter: ILinterPlugin = plugin;

      expect(typeof linter.metadata).toBe('object');
      expect(typeof linter.execute).toBe('function');
      expect(typeof linter.parse).toBe('function');
      expect(typeof linter.fix).toBe('function');
      expect(typeof linter.isAvailable).toBe('function');
      expect(typeof linter.getToolVersion).toBe('function');
    });

    it('should have correct metadata structure', () => {
      const metadata = plugin.metadata;

      expect(metadata).toMatchObject({
        id: 'test-linter',
        name: 'Test Linter',
        description: 'A test linter for unit testing',
        supportedExtensions: ['.js', '.ts', '.test.js'],
        supportsAutoFix: true,
        pluginVersion: '1.0.0-test',
      });
    });

    it('should execute and return LintResult', async () => {
      const options: LinterExecuteOptions = {
        files: ['test.js'],
        cwd: '/test/path',
      };

      const result = await plugin.execute(options);

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        issues: expect.any(Array),
        filesChecked: expect.any(Number),
        filesWithIssues: expect.any(Number),
        duration: expect.any(Number),
      });
    });

    it('should parse output and return LintIssue array', () => {
      const mockIssues: LintIssue[] = [
        {
          filePath: 'test.js',
          line: 1,
          column: 1,
          severity: 'error',
          ruleId: 'test-rule',
          message: 'Test error',
        },
      ];

      plugin.setParseResult(mockIssues);
      const result = plugin.parse('mock output');

      expect(result).toEqual(mockIssues);
    });

    it('should fix issues and return FixResult', async () => {
      const issues: LintIssue[] = [
        {
          filePath: 'test.js',
          line: 1,
          column: 1,
          severity: 'error',
          ruleId: 'test-rule',
          message: 'Test error',
        },
      ];

      const result = await plugin.fix(issues);

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        filesFixed: expect.any(Number),
        issuesFixed: expect.any(Number),
        unfixedIssues: expect.any(Array),
      });
    });

    it('should check tool availability', async () => {
      const available = await plugin.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should get tool version', async () => {
      const version = await plugin.getToolVersion();
      expect(version === null || typeof version === 'string').toBe(true);
    });
  });

  // ==========================================================================
  // BaseLinterPlugin Tests
  // ==========================================================================

  describe('BaseLinterPlugin Abstract Class', () => {
    it('should extend EventEmitter', () => {
      expect(plugin).toBeInstanceOf(EventEmitter);
    });

    it('should initialize with empty buffers and no current process', () => {
      expect(plugin.testStdoutBuffer).toBe('');
      expect(plugin.testStderrBuffer).toBe('');
      expect(plugin.testCurrentProcess).toBeNull();
    });

    it('should require concrete implementation of abstract methods', () => {
      // This is checked at compile time, but we can verify the methods exist
      expect(() => plugin.metadata).not.toThrow();
      expect(() => plugin.execute({} as any)).not.toThrow();
      expect(() => plugin.parse('')).not.toThrow();
      expect(() => plugin.fix([])).not.toThrow();
      expect(() => plugin.isAvailable()).not.toThrow();
      expect(() => plugin.getToolVersion()).not.toThrow();
    });
  });

  // ==========================================================================
  // Process Spawning Tests
  // ==========================================================================

  describe('Process Spawning', () => {
    it('should spawn a process with correct arguments', async () => {
      const resultPromise = plugin.testSpawnProcess('test-command', ['arg1', 'arg2'], {
        cwd: '/test/path',
        env: { TEST_VAR: 'value' },
      });

      // Simulate successful process completion
      setTimeout(() => {
        mockChildProcess.emit('close', 0, null);
      }, 10);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'test-command',
        ['arg1', 'arg2'],
        expect.objectContaining({
          cwd: '/test/path',
          env: expect.objectContaining({ TEST_VAR: 'value' }),
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        })
      );
    });

    it('should capture stdout and stderr', async () => {
      const resultPromise = plugin.testSpawnProcess('test-command', []);

      // Simulate process output
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('stdout output'));
        mockChildProcess.stderr.emit('data', Buffer.from('stderr output'));
        mockChildProcess.emit('close', 0, null);
      }, 10);

      const result = await resultPromise;

      expect(result.stdout).toBe('stdout output');
      expect(result.stderr).toBe('stderr output');
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it('should handle process timeout', async () => {
      const resultPromise = plugin.testSpawnProcess('test-command', [], { timeout: 100 });

      // Don't emit close event to simulate hanging process
      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124); // Standard timeout exit code
    });

    it('should handle process errors', async () => {
      const errorPromise = plugin.testSpawnProcess('test-command', []);

      setTimeout(() => {
        mockChildProcess.emit('error', new Error('Process failed'));
      }, 10);

      await expect(errorPromise).rejects.toThrow('Process failed');
    });

    it('should limit buffer size', async () => {
      const resultPromise = plugin.testSpawnProcess('test-command', [], { maxBuffer: 10 });

      setTimeout(() => {
        // Send more data than buffer allows
        mockChildProcess.stdout.emit('data', Buffer.from('0123456789')); // 10 bytes - should fit
        mockChildProcess.stdout.emit('data', Buffer.from('ABCDEF')); // 6 more bytes - should be ignored
        mockChildProcess.emit('close', 0, null);
      }, 10);

      const result = await resultPromise;

      expect(result.stdout).toBe('0123456789');
    });

    it('should kill process with specified signal', () => {
      plugin.testSpawnProcess('test-command', []);

      const killSpy = vi.spyOn(mockChildProcess, 'kill');
      plugin.testKillProcess('SIGKILL');

      expect(killSpy).toHaveBeenCalledWith('SIGKILL');
    });

    it('should not kill already killed process', () => {
      plugin.testSpawnProcess('test-command', []);
      mockChildProcess.killed = true;

      const killSpy = vi.spyOn(mockChildProcess, 'kill');
      plugin.testKillProcess();

      expect(killSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Utility Methods Tests
  // ==========================================================================

  describe('Utility Methods', () => {
    describe('commandExists', () => {
      it('should return true when command exists', async () => {
        // Mock successful command check
        const resultPromise = plugin.testCommandExists('node');

        setTimeout(() => {
          mockChildProcess.emit('close', 0, null);
        }, 10);

        const exists = await resultPromise;
        expect(exists).toBe(true);
      });

      it('should return false when command does not exist', async () => {
        const resultPromise = plugin.testCommandExists('non-existent-command');

        setTimeout(() => {
          mockChildProcess.emit('close', 1, null);
        }, 10);

        const exists = await resultPromise;
        expect(exists).toBe(false);
      });

      it('should use correct check command for platform', async () => {
        const originalPlatform = process.platform;

        // Test Windows
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const windowsPromise = plugin.testCommandExists('test');
        setTimeout(() => mockChildProcess.emit('close', 0, null), 10);
        await windowsPromise;

        expect(mockSpawn).toHaveBeenCalledWith(
          'where',
          ['test'],
          expect.anything()
        );

        vi.clearAllMocks();
        mockSpawn.mockReturnValue(new MockChildProcess() as any);

        // Test Unix
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const unixPromise = plugin.testCommandExists('test');
        setTimeout(() => mockChildProcess.emit('close', 0, null), 10);
        await unixPromise;

        expect(mockSpawn).toHaveBeenCalledWith(
          'which',
          ['test'],
          expect.anything()
        );

        // Restore platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });
    });

    describe('parseSeverity', () => {
      it('should parse string severities correctly', () => {
        expect(plugin.testParseSeverity('error')).toBe('error');
        expect(plugin.testParseSeverity('ERROR')).toBe('error');
        expect(plugin.testParseSeverity('warning')).toBe('warning');
        expect(plugin.testParseSeverity('warn')).toBe('warning');
        expect(plugin.testParseSeverity('info')).toBe('info');
        expect(plugin.testParseSeverity('information')).toBe('info');
        expect(plugin.testParseSeverity('hint')).toBe('hint');
        expect(plugin.testParseSeverity('suggestion')).toBe('hint');
      });

      it('should parse numeric severities correctly', () => {
        expect(plugin.testParseSeverity(2)).toBe('error');
        expect(plugin.testParseSeverity(1)).toBe('warning');
        expect(plugin.testParseSeverity(0)).toBe('hint');
      });

      it('should default to warning for unknown severities', () => {
        expect(plugin.testParseSeverity('unknown')).toBe('warning');
        expect(plugin.testParseSeverity(99)).toBe('warning');
      });
    });

    describe('createIssue', () => {
      it('should create a properly formatted LintIssue', () => {
        const params = {
          filePath: 'test.js',
          line: 5,
          column: 10,
          severity: 'error' as LintSeverity,
          ruleId: 'no-unused-vars',
          message: 'Unused variable',
        };

        const issue = plugin.testCreateIssue(params);

        expect(issue).toMatchObject({
          filePath: 'test.js',
          line: 5,
          column: 10,
          severity: 'error',
          ruleId: 'no-unused-vars',
          message: 'Unused variable',
        });
      });

      it('should ensure minimum line and column values', () => {
        const issue = plugin.testCreateIssue({
          filePath: 'test.js',
          line: 0,
          column: -1,
          severity: 'error',
          ruleId: 'test',
          message: 'Test',
        });

        expect(issue.line).toBe(1);
        expect(issue.column).toBe(1);
      });

      it('should include optional properties when provided', () => {
        const fix: LintFix = {
          description: 'Fix description',
          replacements: [{ startOffset: 0, endOffset: 5, text: 'fixed' }],
        };

        const suggestions: LintSuggestion[] = [
          { description: 'Suggestion', fix },
        ];

        const issue = plugin.testCreateIssue({
          filePath: 'test.js',
          line: 1,
          column: 1,
          severity: 'error',
          ruleId: 'test',
          message: 'Test',
          endLine: 2,
          endColumn: 5,
          fix,
          suggestions,
        });

        expect(issue).toMatchObject({
          endLine: 2,
          endColumn: 5,
          fix,
          suggestions,
        });
      });
    });

    describe('createLintResult', () => {
      it('should create a successful LintResult', () => {
        const issues: LintIssue[] = [
          {
            filePath: 'file1.js',
            line: 1,
            column: 1,
            severity: 'error',
            ruleId: 'test',
            message: 'Test',
          },
          {
            filePath: 'file2.js',
            line: 1,
            column: 1,
            severity: 'warning',
            ruleId: 'test',
            message: 'Test',
          },
        ];

        const result = plugin.testCreateLintResult(issues, 5, 1000, 'raw output');

        expect(result).toMatchObject({
          success: true,
          issues,
          filesChecked: 5,
          filesWithIssues: 2, // Two different files
          duration: 1000,
          rawOutput: 'raw output',
        });
      });

      it('should calculate files with issues correctly', () => {
        const issues: LintIssue[] = [
          { filePath: 'file1.js', line: 1, column: 1, severity: 'error', ruleId: 'test', message: 'Test' },
          { filePath: 'file1.js', line: 2, column: 1, severity: 'warning', ruleId: 'test', message: 'Test' },
          { filePath: 'file2.js', line: 1, column: 1, severity: 'error', ruleId: 'test', message: 'Test' },
        ];

        const result = plugin.testCreateLintResult(issues, 10, 500);

        expect(result.filesWithIssues).toBe(2); // file1.js and file2.js
      });
    });

    describe('createErrorResult', () => {
      it('should create a failed LintResult', () => {
        const result = plugin.testCreateErrorResult('Test error', 500, 'error output');

        expect(result).toMatchObject({
          success: false,
          issues: [],
          filesChecked: 0,
          filesWithIssues: 0,
          duration: 500,
          error: 'Test error',
          rawOutput: 'error output',
        });
      });
    });
  });

  // ==========================================================================
  // Type System Tests
  // ==========================================================================

  describe('Type System', () => {
    it('should have correct LintIssue structure', () => {
      const issue: LintIssue = {
        filePath: 'test.js',
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'test-rule',
        message: 'Test message',
      };

      expect(issue).toMatchObject({
        filePath: expect.any(String),
        line: expect.any(Number),
        column: expect.any(Number),
        severity: expect.any(String),
        ruleId: expect.any(String),
        message: expect.any(String),
      });
    });

    it('should have correct LintResult structure', () => {
      const result: LintResult = {
        success: true,
        issues: [],
        filesChecked: 0,
        filesWithIssues: 0,
        duration: 0,
      };

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        issues: expect.any(Array),
        filesChecked: expect.any(Number),
        filesWithIssues: expect.any(Number),
        duration: expect.any(Number),
      });
    });

    it('should have correct FixResult structure', () => {
      const result: FixResult = {
        success: true,
        filesFixed: 0,
        issuesFixed: 0,
        unfixedIssues: [],
      };

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        filesFixed: expect.any(Number),
        issuesFixed: expect.any(Number),
        unfixedIssues: expect.any(Array),
      });
    });

    it('should have correct ProcessResult structure', () => {
      const result: ProcessResult = {
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
      };

      expect(result).toMatchObject({
        exitCode: expect.any(Number),
        stdout: expect.any(String),
        stderr: expect.any(String),
        timedOut: expect.any(Boolean),
      });
    });
  });

  // ==========================================================================
  // Event System Tests
  // ==========================================================================

  describe('Event System', () => {
    it('should be able to emit and listen to events', () => {
      const mockListener = vi.fn();
      plugin.on('lint:started', mockListener);

      const event = {
        linterId: 'test-linter',
        files: ['test.js'],
        timestamp: new Date(),
      };

      plugin.emit('lint:started', event);

      expect(mockListener).toHaveBeenCalledWith(event);
    });

    it('should support all defined event types', () => {
      const events: Array<keyof LinterPluginEvents> = [
        'lint:started',
        'lint:progress',
        'lint:completed',
        'lint:issue',
        'fix:applied',
      ];

      events.forEach((eventType) => {
        const mockListener = vi.fn();
        plugin.on(eventType, mockListener);
        expect(() => plugin.emit(eventType, {} as any)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should work with realistic linter output', () => {
      const eslintOutput = `[
        {
          "filePath": "/project/src/file.js",
          "messages": [
            {
              "line": 1,
              "column": 1,
              "severity": 2,
              "message": "Missing semicolon",
              "ruleId": "semi"
            }
          ]
        }
      ]`;

      // This would be implemented by a concrete ESLint plugin
      // We're just testing that the types work correctly
      const mockIssues: LintIssue[] = [
        {
          filePath: '/project/src/file.js',
          line: 1,
          column: 1,
          severity: 'error',
          ruleId: 'semi',
          message: 'Missing semicolon',
        },
      ];

      plugin.setParseResult(mockIssues);
      const result = plugin.parse(eslintOutput);

      expect(result).toEqual(mockIssues);
    });

    it('should handle complex fix operations', async () => {
      const issues: LintIssue[] = [
        {
          filePath: 'test.js',
          line: 1,
          column: 10,
          severity: 'error',
          ruleId: 'semi',
          message: 'Missing semicolon',
          fix: {
            description: 'Add semicolon',
            replacements: [
              { startOffset: 9, endOffset: 9, text: ';' },
            ],
          },
        },
      ];

      const mockFixResult: FixResult = {
        success: true,
        filesFixed: 1,
        issuesFixed: 1,
        unfixedIssues: [],
      };

      plugin.setFixResult(mockFixResult);
      const result = await plugin.fix(issues);

      expect(result).toEqual(mockFixResult);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(plugin.testSpawnProcess('bad-command', [])).rejects.toThrow(
        /Failed to spawn process.*Spawn failed/
      );
    });

    it('should handle timeout gracefully', async () => {
      const resultPromise = plugin.testSpawnProcess('test-command', [], { timeout: 50 });

      // Process hangs - don't emit close
      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
      expect(mockChildProcess.killed).toBe(true);
    });

    it('should handle buffer overflow', async () => {
      const resultPromise = plugin.testSpawnProcess('test-command', [], { maxBuffer: 5 });

      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('12345')); // Exactly at limit
        mockChildProcess.stdout.emit('data', Buffer.from('67890')); // Should be ignored
        mockChildProcess.emit('close', 0, null);
      }, 10);

      const result = await resultPromise;
      expect(result.stdout).toBe('12345');
    });

    it('should handle command not found', async () => {
      const exists = await plugin.testCommandExists('definitely-not-a-command');
      expect(exists).toBe(false);
    });
  });
});