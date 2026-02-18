/**
 * Comprehensive tests for TDD executor regression guard functionality
 *
 * This test suite specifically covers the regression guard feature:
 * - Baseline test result capture before TDD iterations
 * - Regression detection when existing tests fail after fix attempts
 * - Automatic reversion of fixes that cause regressions
 * - Edge cases in regression detection logic
 * - Integration with the main TDD workflow
 *
 * The regression guard is critical for ensuring that fixes don't break
 * existing functionality while attempting to resolve test failures.
 *
 * @module tdd-executor-regression-guard.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  TDDExecutor,
  type TDDExecutorConfig,
  type TDDExecutionResult,
  type TestFailure,
  type RegressionResult,
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

describe('TDD Executor Regression Guard', () => {
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
      regressionGuard: true, // Enable regression guard for these tests
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

  describe('Baseline Test Result Capture', () => {
    it('should capture baseline test results before starting TDD iterations', async () => {
      let callCount = 0;
      const baselineOutput = 'All baseline tests passed successfully';

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline test run - all tests pass
          if (callback) {
            callback(null, { stdout: baselineOutput, stderr: '' });
          }
        } else {
          // Subsequent test runs fail
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × new test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix new test',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      await executor.execute();

      // Should have captured baseline (callCount > 1 indicates baseline + iteration tests)
      expect(callCount).toBeGreaterThan(1);
    });

    it('should handle baseline test failure gracefully', async () => {
      let callCount = 0;
      const baselineFailure = 'FAIL baseline.js\n × baseline test\n Baseline error';

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline test run fails
          const error = new Error('Baseline tests failed');
          (error as any).code = 1;
          (error as any).stdout = baselineFailure;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Subsequent test runs also fail (different error)
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × new test\n New error';
          (error as any).stderr = '';
          if (callback) callback(error);
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

      const result = await executor.execute();

      // Should still work even with baseline failures
      expect(result).toBeDefined();
      expect(callCount).toBeGreaterThan(1);
    });

    it('should not capture baseline when regression guard is disabled', async () => {
      const noRegressionConfig = { ...config, regressionGuard: false };
      const noRegressionExecutor = new TDDExecutor(noRegressionConfig, agents);

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {};
      });

      await noRegressionExecutor.execute();

      // Should only call tests once (no baseline capture)
      expect(callCount).toBe(1);
    });
  });

  describe('Regression Detection', () => {
    it('should detect regression when previously passing tests now fail', async () => {
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - all tests pass
          if (callback) {
            callback(null, { stdout: 'All baseline tests passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration - new test fails
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL new-test.js\n × new feature test\n New test error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - existing tests now fail
          const error = new Error('Regression detected');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing test\n Regression error\nFAIL new-test.js\n × new feature test\n Still failing';
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix that causes regression',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.iterations[0].regressionResult?.detected).toBe(true);
      expect(result.iterations[0].regressionResult?.error).toContain('Regression detected');
      expect(result.iterations[0].fixReverted).toBe(true);
    });

    it('should detect regression when more failures appear than in baseline', async () => {
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - one test fails
          const error = new Error('Baseline failure');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing test\n Existing error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else if (callCount === 2) {
          // First iteration - still one test fails
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing test\n Existing error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - more tests fail now
          const error = new Error('More failures');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing test\n Existing error\nFAIL new-broken.js\n × newly broken test\n New failure';
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix that breaks other tests',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.iterations[0].regressionResult?.detected).toBe(true);
      expect(result.iterations[0].fixReverted).toBe(true);
    });

    it('should detect regression when test success changes to failure', async () => {
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - all tests pass
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration - one test fails (expected)
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL target.js\n × target test\n Target error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - different tests fail now
          const error = new Error('Regression');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL other.js\n × other test\n Regression error';
          (error as any).stderr = '';
          if (callback) callback(error);
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

      const result = await executor.execute();

      expect(result.iterations[0].regressionResult?.detected).toBe(true);
    });

    it('should NOT detect regression when only expected failures remain', async () => {
      let callCount = 0;
      const baselineFailures = 'FAIL existing.js\n × existing test\n Existing error\nFAIL another.js\n × another test\n Another error';

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - some tests fail
          const error = new Error('Baseline failures');
          (error as any).code = 1;
          (error as any).stdout = baselineFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else if (callCount === 2) {
          // First iteration - same tests fail
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = baselineFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - one test fixed, one still fails (no regression)
          const error = new Error('Partial fix');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL another.js\n × another test\n Another error';
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix one test',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.iterations[0].regressionResult?.detected).toBe(false);
      expect(result.iterations[0].fixReverted).toBeFalsy();
    });

    it('should handle regression detection test failures', async () => {
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - tests pass
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration - test fails
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - command fails completely
          throw new Error('Test command crashed during regression check');
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

      const result = await executor.execute();

      expect(result.iterations[0].regressionResult?.detected).toBe(true);
      expect(result.iterations[0].regressionResult?.error).toContain('Failed to run regression check');
    });
  });

  describe('Fix Reversion', () => {
    it('should revert fix when regression is detected', async () => {
      let callCount = 0;
      const originalContent = 'original file content';
      let currentFileContent = originalContent;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - regression detected
          const error = new Error('Regression');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing\n Regression';
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix that causes regression',
          file: 'src/app.ts',
          originalContent: 'old line',
          newContent: 'new line',
          confidence: 0.8,
        }),
      });

      // Simulate file operations
      mockFs.readFile.mockImplementation(async () => currentFileContent);
      mockFs.writeFile.mockImplementation(async (path, content) => {
        currentFileContent = content as string;
      });

      const result = await executor.execute();

      expect(result.iterations[0].fixReverted).toBe(true);
      expect(result.iterations[0].fixResult?.success).toBe(false);
      expect(result.iterations[0].fixResult?.error).toContain('reverted due to regression');

      // File should be reverted to original content
      expect(currentFileContent).toBe(originalContent);
    });

    it('should handle revert failure gracefully', async () => {
      let callCount = 0;
      let writeCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check
          const error = new Error('Regression');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing\n Regression';
          (error as any).stderr = '';
          if (callback) callback(error);
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
      mockFs.writeFile.mockImplementation(async () => {
        writeCount++;
        if (writeCount === 1) {
          // First write (applying fix) succeeds
          return;
        } else {
          // Second write (reverting) fails
          throw new Error('Permission denied during revert');
        }
      });

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.iterations[0].fixResult?.error).toContain('Regression detected but revert failed');
    });

    it('should handle missing backup during revert', async () => {
      // This test verifies the backup system works correctly
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check
          const error = new Error('Regression');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing\n Regression';
          (error as any).stderr = '';
          if (callback) callback(error);
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

      const result = await executor.execute();

      // Should create proper backup and be able to revert
      expect(result.iterations[0].fixResult?.backup).toBeDefined();
      expect(result.iterations[0].fixResult?.backup?.files).toMatchObject({
        'src/app.ts': 'old content'
      });
    });
  });

  describe('Event Emission for Regression Guard', () => {
    it('should emit regression detection and fix reversion events', async () => {
      const events: Array<{ type: string; data: any }> = [];

      executor.on('tdd:regression-detected', (regressionResult, iteration, taskId) => {
        events.push({
          type: 'regression-detected',
          data: { regressionResult, iteration, taskId }
        });
      });

      executor.on('tdd:fix-reverted', (fixResult, iteration, taskId) => {
        events.push({
          type: 'fix-reverted',
          data: { fixResult, iteration, taskId }
        });
      });

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check
          const error = new Error('Regression');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing\n Regression';
          (error as any).stderr = '';
          if (callback) callback(error);
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

      await executor.execute('test-task-123');

      expect(events).toHaveLength(2);

      const regressionEvent = events.find(e => e.type === 'regression-detected');
      expect(regressionEvent).toBeDefined();
      expect(regressionEvent?.data.regressionResult.detected).toBe(true);
      expect(regressionEvent?.data.iteration).toBe(1);
      expect(regressionEvent?.data.taskId).toBe('test-task-123');

      const revertEvent = events.find(e => e.type === 'fix-reverted');
      expect(revertEvent).toBeDefined();
      expect(revertEvent?.data.fixResult.success).toBe(true);
      expect(revertEvent?.data.iteration).toBe(1);
      expect(revertEvent?.data.taskId).toBe('test-task-123');
    });

    it('should not emit regression events when regression guard is disabled', async () => {
      const noRegressionConfig = { ...config, regressionGuard: false };
      const noRegressionExecutor = new TDDExecutor(noRegressionConfig, agents);

      const events: string[] = [];
      noRegressionExecutor.on('tdd:regression-detected', () => events.push('regression-detected'));
      noRegressionExecutor.on('tdd:fix-reverted', () => events.push('fix-reverted'));

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // First test run fails
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Second test run passes
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

      await noRegressionExecutor.execute();

      expect(events).toHaveLength(0);
    });
  });

  describe('Regression Detection Logic Edge Cases', () => {
    it('should handle identical test failure signatures correctly', async () => {
      const identicalFailures = 'FAIL test.js\n × identical test\n Identical error message';
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount <= 2) {
          // Baseline and first iteration - same failures
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = identicalFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - still same failures (no regression)
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = identicalFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix attempt',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      // Should not detect regression for identical failures
      expect(result.iterations[0].regressionResult?.detected).toBe(false);
      expect(result.iterations[0].fixReverted).toBeFalsy();
    });

    it('should handle complex test failure output with multiple files', async () => {
      let callCount = 0;

      const baselineFailures = `
FAIL src/user.test.ts
  × should create user
    TypeError: User is not a constructor

FAIL src/auth.test.ts
  × should validate token
    ReferenceError: validateToken is not defined
`;

      const regressionFailures = `
FAIL src/user.test.ts
  × should create user
    TypeError: User is not a constructor

FAIL src/auth.test.ts
  × should validate token
    ReferenceError: validateToken is not defined

FAIL src/database.test.ts
  × should connect to db
    Error: Connection refused
`;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - two failures
          const error = new Error('Baseline failures');
          (error as any).code = 1;
          (error as any).stdout = baselineFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else if (callCount === 2) {
          // First iteration - same failures
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = baselineFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check - additional failure (regression)
          const error = new Error('More failures');
          (error as any).code = 1;
          (error as any).stdout = regressionFailures;
          (error as any).stderr = '';
          if (callback) callback(error);
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix that breaks database',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.iterations[0].regressionResult?.detected).toBe(true);
      expect(result.iterations[0].fixReverted).toBe(true);
    });

    it('should handle empty or missing baseline test results', async () => {
      // Simulate scenario where baseline capture fails or returns empty results
      const executor = new TDDExecutor(config, agents);

      // Access private method to test directly
      const detectRegression = (executor as any).detectRegression.bind(executor);

      // Clear baseline (simulate failure to capture)
      (executor as any).baselineTestResult = undefined;

      const regressionResult: RegressionResult = await detectRegression();

      expect(regressionResult.detected).toBe(false);
      expect(regressionResult.skipped).toBe(true);
      expect(regressionResult.error).toContain('No baseline test result available');
    });
  });

  describe('Integration with TDD Workflow', () => {
    it('should continue TDD iterations after successful regression check', async () => {
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline - tests pass
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration - test fails
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else if (callCount === 3) {
          // Regression check - no regression
          const error = new Error('Still failing');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Next iteration - tests pass
          if (callback) {
            callback(null, { stdout: 'All tests passed', stderr: '' });
          }
        }
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Good fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.9,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.totalIterations).toBe(2);
      expect(result.iterations[0].regressionResult?.detected).toBe(false);
      expect(result.iterations[0].fixReverted).toBeFalsy();
    });

    it('should stop TDD execution when fix reversion fails', async () => {
      let callCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        if (callCount === 1) {
          // Baseline
          if (callback) {
            callback(null, { stdout: 'Baseline passed', stderr: '' });
          }
        } else if (callCount === 2) {
          // First iteration
          const error = new Error('Tests failed');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL test.js\n × test\n Error';
          (error as any).stderr = '';
          if (callback) callback(error);
        } else {
          // Regression check
          const error = new Error('Regression');
          (error as any).code = 1;
          (error as any).stdout = 'FAIL existing.js\n × existing\n Regression';
          (error as any).stderr = '';
          if (callback) callback(error);
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

      // Simulate revert failure
      let writeCount = 0;
      mockFs.writeFile.mockImplementation(async () => {
        writeCount++;
        if (writeCount === 2) { // Revert operation fails
          throw new Error('Cannot revert: disk full');
        }
      });

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.totalIterations).toBe(1);
      expect(result.stopReason).toBe('fix_failed');
      expect(result.iterations[0].fixResult?.error).toContain('Regression detected but revert failed');
    });
  });
});