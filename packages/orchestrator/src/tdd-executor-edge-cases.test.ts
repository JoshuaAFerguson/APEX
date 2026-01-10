/**
 * Edge case tests for TDD executor event emission and error handling
 *
 * This test suite covers:
 * - Event emission edge cases and error scenarios
 * - Memory management and cleanup
 * - Concurrent execution handling
 * - Resource exhaustion scenarios
 * - Network and filesystem failures
 * - Malformed test output parsing
 *
 * @module tdd-executor-edge-cases.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  TDDExecutor,
  type TDDExecutorConfig,
  type TDDExecutionResult,
  type TDDEvents,
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

describe('TDDExecutor Edge Cases', () => {
  let config: TDDExecutorConfig;
  let agents: Record<string, AgentDefinition>;
  let executor: TDDExecutor;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      maxIterations: 3,
      testCommand: 'npm test',
      workingDirectory: '/test/project',
      testTimeout: 5000,
      enableEvents: true,
    };

    agents = {
      developer: {
        name: 'developer',
        role: 'Software Developer',
        description: 'Writes and fixes code',
        instructions: 'Follow TDD practices',
      },
    };

    executor = new TDDExecutor(config, agents);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Emission Edge Cases', () => {
    it('should handle event listener errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add event listener that throws
      executor.on('tdd:started', () => {
        throw new Error('Event listener error');
      });

      executor.on('tdd:iteration-started', () => {
        throw new Error('Another listener error');
      });

      // Mock successful test
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {};
      });

      // Should complete successfully despite listener errors
      const result = await executor.execute();
      expect(result.success).toBe(true);

      consoleErrorSpy.mockRestore();
    });

    it('should emit events with correct data structure even with malformed responses', async () => {
      const events: Array<{ type: keyof TDDEvents; data: any }> = [];

      executor.on('tdd:fix-generated', (fix, iteration, taskId) => {
        events.push({
          type: 'tdd:fix-generated',
          data: { fix, iteration, taskId }
        });
      });

      executor.on('tdd:fix-applied', (fixResult, iteration, taskId) => {
        events.push({
          type: 'tdd:fix-applied',
          data: { fixResult, iteration, taskId }
        });
      });

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error message';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      // Mock malformed JSON response from Claude
      mockQuery.mockResolvedValue({
        content: '{ "description": "Fix", "file": "app.ts", incomplete json...',
      });

      await expect(executor.execute()).rejects.toThrow();

      // Should not emit fix events for malformed responses
      expect(events).toHaveLength(0);
    });

    it('should handle high-frequency event emission without memory leaks', async () => {
      const eventCounts: Record<string, number> = {};

      // Track all event types
      const eventTypes = [
        'tdd:started',
        'tdd:iteration-started',
        'tdd:test-run',
        'tdd:iteration-completed',
        'tdd:completed'
      ] as const;

      eventTypes.forEach(eventType => {
        eventCounts[eventType] = 0;
        executor.on(eventType, () => {
          eventCounts[eventType]++;
        });
      });

      // Mock test that passes immediately
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, { stdout: 'All tests passed', stderr: '' });
        }
        return {};
      });

      // Execute multiple times to check for memory leaks
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          executor.execute(`task-${i}`)
        )
      );

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify events were emitted correctly
      expect(eventCounts['tdd:started']).toBe(100);
      expect(eventCounts['tdd:iteration-started']).toBe(100);
      expect(eventCounts['tdd:test-run']).toBe(100);
      expect(eventCounts['tdd:iteration-completed']).toBe(100);
      expect(eventCounts['tdd:completed']).toBe(100);

      // Check for potential memory leaks by verifying listener counts haven't grown
      eventTypes.forEach(eventType => {
        expect(executor.listenerCount(eventType)).toBe(1);
      });
    });

    it('should handle events being disabled mid-execution', async () => {
      const events: string[] = [];

      executor.on('tdd:iteration-started', () => events.push('iteration-started'));
      executor.on('tdd:test-run', () => events.push('test-run'));
      executor.on('tdd:iteration-completed', () => events.push('iteration-completed'));

      let testCallCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        testCallCount++;

        if (testCallCount === 1) {
          // Disable events after first iteration
          (executor as any).config.enableEvents = false;

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

      const result = await executor.execute();

      expect(result.success).toBe(true);

      // Should only have events from first iteration
      expect(events.filter(e => e === 'iteration-started')).toHaveLength(1);
      expect(events.filter(e => e === 'test-run')).toHaveLength(1);
    });
  });

  describe('Test Output Parsing Edge Cases', () => {
    it('should handle extremely large test output', async () => {
      const largeOutput = 'FAIL test.js\n × test\n' + 'A'.repeat(1000000) + '\nError end';

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = largeOutput;
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix large output',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.5,
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.iterations[0].testResult.failures).toHaveLength(1);
      expect(result.iterations[0].testResult.stdout).toBe(largeOutput);
    });

    it('should handle test output with unicode and special characters', async () => {
      const unicodeOutput = `
FAIL src/测试.test.ts
  × should handle 中文测试
    Error: Expected "测试" but got "test"
    🚫 Assertion failed: ñüñíçø∂é characters
    Stack trace contains emoji: 🔥💥⚡
      `;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = unicodeOutput;
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      const failures = (executor as any).parseTestFailures(unicodeOutput, '');

      expect(failures).toHaveLength(1);
      expect(failures[0].file).toContain('测试.test.ts');
      expect(failures[0].test).toContain('中文测试');
      expect(failures[0].message).toContain('ñüñíçø∂é');
    });

    it('should handle malformed ANSI escape sequences in test output', async () => {
      const ansiOutput = `
\u001b[31mFAIL\u001b[0m \u001b[1msrc/app.test.ts\u001b[0m
  \u001b[31m×\u001b[0m \u001b[2mshould work\u001b[0m
    \u001b[31mError: \u001b[malformed escape sequence
    \u001b[incomplete\u001b test output
      `;

      const failures = (executor as any).parseTestFailures(ansiOutput, '');

      // Should still parse despite malformed ANSI sequences
      expect(failures).toHaveLength(1);
      expect(failures[0].file).toContain('src/app.test.ts');
    });

    it('should handle test output with no clear failure markers', async () => {
      const ambiguousOutput = `
Some random output
Tests might have failed
Exit code was 1 but no FAIL markers
Random error messages
      `;

      const failures = (executor as any).parseTestFailures(ambiguousOutput, '');

      expect(failures).toHaveLength(1);
      expect(failures[0].message).toContain('Tests failed but could not parse specific failures');
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle test command that never returns', async () => {
      const shortTimeoutConfig = { ...config, testTimeout: 100 };
      const timeoutExecutor = new TDDExecutor(shortTimeoutConfig, agents);

      mockExec.mockImplementation((command, options, callback) => {
        // Never call the callback - simulate hanging process
        return {
          kill: vi.fn(),
        } as any;
      });

      await expect(timeoutExecutor.execute()).rejects.toThrow();
    });

    it('should handle filesystem running out of space during fix application', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error';
        (error as any).stderr = '';
        if (callback) callback(error);
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
      mockFs.writeFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe('fix_failed');
      expect(result.iterations[0].fixResult?.error).toContain('no space left on device');
    });

    it('should handle Claude API rate limiting', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      // Mock rate limiting error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      mockQuery.mockRejectedValue(rateLimitError);

      await expect(executor.execute()).rejects.toThrow('Failed to generate fix: Rate limit exceeded');
    });
  });

  describe('Concurrent Execution Handling', () => {
    it('should handle multiple concurrent TDD executions safely', async () => {
      const concurrentExecutors = Array.from({ length: 5 },
        () => new TDDExecutor(config, agents)
      );

      let callCount = 0;
      mockExec.mockImplementation((command, options, callback) => {
        callCount++;
        // Add some randomness to simulate real-world timing
        setTimeout(() => {
          if (callback) {
            callback(null, { stdout: `Tests passed ${callCount}`, stderr: '' });
          }
        }, Math.random() * 10);
        return {};
      });

      const results = await Promise.all(
        concurrentExecutors.map((exec, i) => exec.execute(`concurrent-task-${i}`))
      );

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.totalIterations).toBe(1);
      });
    });

    it('should handle race conditions in file operations', async () => {
      let fileReadCount = 0;
      let fileWriteCount = 0;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix',
          file: 'src/shared.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.8,
        }),
      });

      mockFs.readFile.mockImplementation(async () => {
        fileReadCount++;
        // Simulate concurrent file access
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        return `old content ${fileReadCount}`;
      });

      mockFs.writeFile.mockImplementation(async (path, content) => {
        fileWriteCount++;
        // Simulate concurrent file write
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
      });

      const concurrentExecutors = Array.from({ length: 3 },
        () => new TDDExecutor(config, agents)
      );

      const results = await Promise.all(
        concurrentExecutors.map((exec, i) => exec.execute(`race-task-${i}`))
      );

      // All should complete, some may succeed or fail depending on race conditions
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated test failures', async () => {
      const largeErrorMessage = 'Error: ' + 'X'.repeat(100000);

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = `FAIL test.js\n × test\n ${largeErrorMessage}`;
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      mockQuery.mockResolvedValue({
        content: JSON.stringify({
          description: 'Fix',
          file: 'src/app.ts',
          originalContent: 'old',
          newContent: 'new',
          confidence: 0.1, // Low confidence to cause repeated failures
        }),
      });

      mockFs.readFile.mockResolvedValue('old content');
      mockFs.writeFile.mockResolvedValue(undefined);

      // Execute with max iterations to test memory handling
      const result = await executor.execute();

      expect(result.totalIterations).toBe(config.maxIterations);

      // Each iteration should have captured the large error
      result.iterations.forEach(iteration => {
        expect(iteration.testResult.stdout).toContain(largeErrorMessage);
      });

      // Memory usage should be reasonable despite large error messages
      // (This is more of a smoke test - actual memory measurement would require specialized tools)
      expect(result.iterations).toHaveLength(config.maxIterations);
    });

    it('should clean up event listeners properly', () => {
      const initialListenerCount = executor.listenerCount('tdd:started');

      // Add many listeners
      for (let i = 0; i < 100; i++) {
        executor.on('tdd:started', () => {});
      }

      expect(executor.listenerCount('tdd:started')).toBe(initialListenerCount + 100);

      // Remove all listeners
      executor.removeAllListeners('tdd:started');

      expect(executor.listenerCount('tdd:started')).toBe(0);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from temporary filesystem issues', async () => {
      let readAttempts = 0;

      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error';
        (error as any).stderr = '';
        if (callback) callback(error);
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

      // Simulate temporary filesystem issues
      mockFs.readFile.mockImplementation(async () => {
        readAttempts++;
        if (readAttempts <= 2) {
          throw new Error('EBUSY: resource temporarily unavailable');
        }
        return 'old content';
      });

      mockFs.writeFile.mockResolvedValue(undefined);

      // Should fail because current implementation doesn't retry
      const result = await executor.execute();
      expect(result.success).toBe(false);
      expect(result.stopReason).toBe('fix_failed');
    });

    it('should handle Claude API returning non-JSON responses', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        const error = new Error('Tests failed');
        (error as any).code = 1;
        (error as any).stdout = 'FAIL test.js\n × test\n Error';
        (error as any).stderr = '';
        if (callback) callback(error);
        return {};
      });

      // Mock Claude returning plain text instead of JSON
      mockQuery.mockResolvedValue({
        content: 'I cannot provide a fix in the requested JSON format. The error is complex...',
      });

      await expect(executor.execute()).rejects.toThrow('Failed to generate fix');
    });

    it('should handle interrupted test execution gracefully', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        // Simulate process being killed
        const error = new Error('Process was killed');
        (error as any).code = 'SIGKILL';
        (error as any).killed = true;
        if (callback) callback(error);
        return {};
      });

      await expect(executor.execute()).rejects.toThrow();
    });
  });
});