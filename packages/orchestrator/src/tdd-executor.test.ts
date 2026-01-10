/**
 * Tests for TDDExecutor - Comprehensive test coverage for TDD execution loop
 *
 * This test suite covers:
 * - TDD executor initialization and configuration
 * - Test execution and failure parsing
 * - Claude integration for fix generation
 * - Fix application and iteration logic
 * - Event emission during TDD execution
 * - Error handling and edge cases
 *
 * @module tdd-executor.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  TDDExecutor,
  createTDDExecutor,
  executeTDD,
  type TDDExecutorConfig,
  type TDDExecutionResult,
  type TDDIterationResult,
  type TestResult,
  type TestFailure,
  type SuggestedFix,
  type FixResult,
} from './tdd-executor';
import type { AgentDefinition } from '@apexcli/core';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs/promises');
vi.mock('@anthropic-ai/claude-agent-sdk');

const mockExec = exec as unknown as Mock;
const mockFs = {
  readFile: vi.mocked(fs.readFile),
  writeFile: vi.mocked(fs.writeFile),
};
const mockQuery = vi.mocked(query);

describe('TDDExecutor', () => {
  let config: TDDExecutorConfig;
  let agents: Record<string, AgentDefinition>;
  let executor: TDDExecutor;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      maxIterations: 3,
      testCommand: 'npm test',
      workingDirectory: '/test/project',
      testTimeout: 30000,
      enableEvents: true,
    };

    agents = {
      developer: {
        name: 'developer',
        role: 'Software Developer',
        description: 'Writes and fixes code',
        instructions: 'Follow TDD practices and write clean code',
      },
    };

    executor = new TDDExecutor(config, agents);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with provided config and agents', () => {
      expect(executor).toBeInstanceOf(TDDExecutor);
      expect(executor).toBeInstanceOf(EventEmitter);
    });

    it('should create executor with createTDDExecutor helper', () => {
      const testExecutor = createTDDExecutor('vitest run', 5, agents);
      expect(testExecutor).toBeInstanceOf(TDDExecutor);
    });

    it('should execute TDD with executeTDD helper', async () => {
      // Mock successful test execution
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {
          stdout: 'All tests passed',
          stderr: '',
        };
      });

      const result = await executeTDD('npm test', 1, agents);
      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(1);
    });
  });

  describe('Test Execution', () => {
    it('should run tests successfully when all tests pass', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {
          stdout: 'All tests passed',
          stderr: '',
        };
      });

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(1);
      expect(result.finalTestResult.success).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    it('should parse test failures from output', async () => {
      const failureOutput = `
FAIL src/calculator.test.ts
  × should add two numbers
    TypeError: calculator.add is not a function
      at Object.<anonymous> (src/calculator.test.ts:5:23)
`;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = failureOutput;
        (error as any).stderr = '';
        if (callback) {
          callback(error);
        }
        return {};
      });

      // Mock fix generation and application
      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Add missing add method',
          file: 'src/calculator.ts',
          originalContent: 'export class Calculator {',
          newContent: 'export class Calculator {\n  add(a: number, b: number) {\n    return a + b;\n  }',
          confidence: 0.9,
        }),
      });

      mockFs.readFile.mockResolvedValue('export class Calculator {\n}');
      mockFs.writeFile.mockResolvedValue(undefined);

      // Second execution should pass
      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // First run fails
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = failureOutput;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Second run passes
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(2);
      expect(result.iterations[0].testResult.failures).toHaveLength(1);
      expect(result.iterations[0].testResult.failures[0]).toMatchObject({
        file: 'src/calculator.test.ts',
        test: 'should add two numbers',
        message: expect.stringContaining('TypeError: calculator.add is not a function'),
      });
    });

    it('should handle test command timeout', async () => {
      const shortConfig = { ...config, testTimeout: 100 };
      const timeoutExecutor = new TDDExecutor(shortConfig, agents);

      mockExec.mockImplementation((command, options, callback) => {
        setTimeout(() => {
          const error = new Error('Command timeout');
          (error as any).code = 'TIMEOUT';
          if (callback) callback(error);
        }, 150);
        return {};
      });

      await expect(timeoutExecutor.execute()).rejects.toThrow();
    });
  });

  describe('Fix Generation', () => {
    it('should generate fix using Claude when tests fail', async () => {
      const failureOutput = `
FAIL src/math.test.ts
  × multiply function should work
    ReferenceError: multiply is not defined
`;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = failureOutput;
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Add missing multiply function',
          file: 'src/math.ts',
          originalContent: 'export function add(a: number, b: number) { return a + b; }',
          newContent: 'export function add(a: number, b: number) { return a + b; }\nexport function multiply(a: number, b: number) { return a * b; }',
          confidence: 0.8,
          reasoning: 'The test expects a multiply function that is not defined',
        }),
      });

      mockFs.readFile.mockResolvedValue('export function add(a: number, b: number) { return a + b; }');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(mockQuery).toHaveBeenCalledWith({
        agent: expect.objectContaining({
          name: 'developer',
          role: 'Software Developer',
        }),
        message: expect.stringContaining('ReferenceError: multiply is not defined'),
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(result.iterations[0].suggestedFix).toMatchObject({
        description: 'Add missing multiply function',
        file: 'src/math.ts',
        confidence: 0.8,
      });
    });

    it('should handle Claude API errors gracefully', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × some test\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(executor.execute()).rejects.toThrow('Failed to generate fix: API rate limit exceeded');
    });

    it('should handle invalid JSON response from Claude', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × some test\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: 'This is not valid JSON',
      });

      await expect(executor.execute()).rejects.toThrow('Failed to generate fix');
    });

    it('should throw error when no developer agent is available', async () => {
      const executorWithoutAgent = new TDDExecutor(config, {});

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × some test\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      await expect(executorWithoutAgent.execute()).rejects.toThrow('No developer agent available for generating fixes');
    });
  });

  describe('Fix Application', () => {
    it('should apply fix to correct file', async () => {
      const fix: SuggestedFix = {
        description: 'Fix syntax error',
        file: 'src/app.ts',
        originalContent: 'function broken() {',
        newContent: 'function fixed() {',
        confidence: 0.9,
      };

      mockFs.readFile.mockResolvedValue('function broken() {\n  return "hello";\n}');
      mockFs.writeFile.mockResolvedValue(undefined);

      const fixResult = await (executor as any).applyFix(fix);

      expect(fixResult.success).toBe(true);
      expect(fixResult.modifiedFiles).toEqual(['src/app.ts']);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('src/app.ts'),
        'function fixed() {\n  return "hello";\n}',
        'utf-8'
      );
    });

    it('should fail when original content not found', async () => {
      const fix: SuggestedFix = {
        description: 'Fix non-existent content',
        file: 'src/app.ts',
        originalContent: 'function notFound() {',
        newContent: 'function fixed() {',
        confidence: 0.9,
      };

      mockFs.readFile.mockResolvedValue('function different() {\n  return "hello";\n}');

      const fixResult = await (executor as any).applyFix(fix);

      expect(fixResult.success).toBe(false);
      expect(fixResult.error).toContain('Original content not found in file');
      expect(fixResult.modifiedFiles).toEqual([]);
    });

    it('should handle file system errors', async () => {
      const fix: SuggestedFix = {
        description: 'Fix file',
        file: 'src/nonexistent.ts',
        originalContent: 'original',
        newContent: 'new',
        confidence: 0.9,
      };

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const fixResult = await (executor as any).applyFix(fix);

      expect(fixResult.success).toBe(false);
      expect(fixResult.error).toContain('File not found');
      expect(fixResult.modifiedFiles).toEqual([]);
    });
  });

  describe('Iteration Logic', () => {
    it('should stop after max iterations when tests keep failing', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × persistent test\n Error persists';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Attempted fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.5,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.totalIterations).toBe(config.maxIterations);
      expect(result.stopReason).toBe('max_iterations');
      expect(result.iterations).toHaveLength(config.maxIterations);
    });

    it('should stop when fix application fails', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix',
          file: 'src/app.ts',
          originalContent: 'nonexistent',
          newContent: 'new',
          confidence: 0.5,
        }),
      });

      mockFs.readFile.mockResolvedValue('different content');

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.totalIterations).toBe(1);
      expect(result.stopReason).toBe('fix_failed');
      expect(result.iterations[0].fixResult?.success).toBe(false);
    });

    it('should stop when no test failures are detected', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Unknown test error');
        (error as any).code = 1;
        (error as any).stdout = 'Unexpected error format';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.totalIterations).toBe(1);
      expect(result.iterations[0].testResult.failures).toHaveLength(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit all TDD events during execution', async () => {
      const events: string[] = [];

      executor.on('tdd:started', () => events.push('started'));
      executor.on('tdd:iteration-started', () => events.push('iteration-started'));
      executor.on('tdd:test-run', () => events.push('test-run'));
      executor.on('tdd:completed', () => events.push('completed'));

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {};
      });

      await executor.execute();

      expect(events).toEqual(['started', 'iteration-started', 'test-run', 'completed']);
    });

    it('should emit fix-related events when fixes are applied', async () => {
      const events: string[] = [];

      executor.on('tdd:fix-generated', () => events.push('fix-generated'));
      executor.on('tdd:fix-applied', () => events.push('fix-applied'));
      executor.on('tdd:iteration-completed', () => events.push('iteration-completed'));

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      await executor.execute();

      expect(events).toContain('fix-generated');
      expect(events).toContain('fix-applied');
      expect(events).toContain('iteration-completed');
    });

    it('should emit failure event on errors', async () => {
      const errors: Error[] = [];

      executor.on('tdd:failed', (error) => errors.push(error));

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Command failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockRejectedValue(new Error('Claude API error'));

      await expect(executor.execute()).rejects.toThrow();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Claude API error');
    });

    it('should not emit events when events are disabled', async () => {
      const noEventsConfig = { ...config, enableEvents: false };
      const noEventsExecutor = new TDDExecutor(noEventsConfig, agents);

      const events: string[] = [];
      noEventsExecutor.on('tdd:started', () => events.push('started'));

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {};
      });

      await noEventsExecutor.execute();

      expect(events).toHaveLength(0);
    });
  });

  describe('Test Failure Parsing', () => {
    it('should parse different test failure formats', () => {
      const viTestOutput = `
FAIL src/utils.test.ts
  ✕ should format date correctly (5ms)
    AssertionError: expected '2023-01-01' to equal '2024-01-01'
      at Object.<anonymous> (src/utils.test.ts:10:23)
`;

      const jestOutput = `
FAIL src/math.test.ts
  × should calculate percentage
    Expected: 50
    Received: 0.5
      at Object.<anonymous> (src/math.test.ts:15:12)
`;

      const failures = (executor as any).parseTestFailures(viTestOutput + jestOutput, '');

      expect(failures).toHaveLength(2);
      expect(failures[0]).toMatchObject({
        file: 'src/utils.test.ts',
        test: 'should format date correctly (5ms)',
        message: expect.stringContaining('AssertionError'),
      });
      expect(failures[1]).toMatchObject({
        file: 'src/math.test.ts',
        test: 'should calculate percentage',
        message: expect.stringContaining('Expected: 50'),
      });
    });

    it('should handle test output with no parseable failures', () => {
      const genericOutput = 'Tests failed with unknown error';

      const failures = (executor as any).parseTestFailures('', genericOutput);

      expect(failures).toHaveLength(1);
      expect(failures[0].message).toContain('Tests failed but could not parse specific failures');
    });

    it('should return empty array for successful test output', () => {
      const successOutput = 'All tests passed!\n✓ 5 tests completed';

      const failures = (executor as any).parseTestFailures(successOutput, '');

      expect(failures).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing task ID gracefully', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {};
      });

      const result = await executor.execute();

      expect(result.success).toBe(true);
      // Should generate a task ID internally
      expect(result).toBeDefined();
    });

    it('should handle working directory configuration', () => {
      const customConfig = {
        ...config,
        workingDirectory: '/custom/path',
      };

      const customExecutor = new TDDExecutor(customConfig, agents);
      expect(customExecutor).toBeInstanceOf(TDDExecutor);
    });

    it('should handle agents without developer role', () => {
      const otherAgents = {
        implementer: {
          name: 'implementer',
          role: 'Code Implementer',
          description: 'Implements features',
          instructions: 'Write code',
        },
      };

      const executorWithOtherAgent = new TDDExecutor(config, otherAgents);
      expect(executorWithOtherAgent).toBeInstanceOf(TDDExecutor);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple test files with different failures', async () => {
      const complexOutput = `
FAIL src/user.test.ts
  ✕ should create user
    TypeError: User is not a constructor
      at Object.<anonymous> (src/user.test.ts:5:23)

FAIL src/auth.test.ts
  ✕ should authenticate user
    ReferenceError: authenticate is not defined
      at Object.<anonymous> (src/auth.test.ts:8:15)
`;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = complexOutput;
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      // Mock fix for first failure
      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Add User constructor',
          file: 'src/user.ts',
          originalContent: 'export const User = {};',
          newContent: 'export class User {\n  constructor(name: string) {\n    this.name = name;\n  }\n}',
          confidence: 0.9,
        }),
      });

      mockFs.readFile.mockResolvedValue('export const User = {};');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      const failures = result.iterations[0].testResult.failures;
      expect(failures).toHaveLength(2);
      expect(failures.map(f => f.file)).toEqual(['src/user.test.ts', 'src/auth.test.ts']);

      // Should target the first (most critical) failure
      expect(result.iterations[0].suggestedFix?.file).toBe('src/user.ts');
    });

    it('should provide detailed iteration results', async () => {
      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.7,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.iterations).toHaveLength(2);

      // First iteration should have failure, fix, and fix result
      const firstIteration = result.iterations[0];
      expect(firstIteration.iteration).toBe(1);
      expect(firstIteration.testResult.success).toBe(false);
      expect(firstIteration.suggestedFix).toBeDefined();
      expect(firstIteration.fixResult).toBeDefined();
      expect(firstIteration.resolved).toBe(false);
      expect(firstIteration.duration).toBeGreaterThan(0);

      // Second iteration should have success
      const secondIteration = result.iterations[1];
      expect(secondIteration.iteration).toBe(2);
      expect(secondIteration.testResult.success).toBe(true);
      expect(secondIteration.resolved).toBe(true);
    });
  });
});