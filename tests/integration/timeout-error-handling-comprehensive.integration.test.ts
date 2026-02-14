/**
 * @fileoverview Integration Tests for Timeout Error Handling and Descriptive Messages
 *
 * This test file verifies that:
 * 1. Timeout errors are properly thrown when operations exceed timeout
 * 2. Error messages are descriptive and include relevant context (timeout value, operation type, wait strategy)
 * 3. Timeout errors can be caught and handled appropriately
 *
 * Tests the integration of APEX timeout utilities and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Core imports
import { ApexError, ApexErrorCode, isApexError } from '@apexcli/core';

// Orchestrator imports - using relative paths as per existing test patterns
import {
  TimeoutUtils,
  PromiseRaceTimeoutPattern,
  PollingWaitPattern,
  ExponentialBackoffPattern,
  TimeoutDebugUtils,
} from '../../packages/orchestrator/src/timeout-documentation';

describe('Timeout Error Handling Integration Tests', () => {
  beforeEach(() => {
    // Use fake timers for deterministic timeout testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();

    // Clear timeout debug tracking
    TimeoutDebugUtils.getActiveTimeouts().forEach(timeout => {
      TimeoutDebugUtils.unregisterTimeout(timeout.id);
    });
  });

  describe('Basic Timeout Error Handling', () => {
    it('should throw timeout error with descriptive message', async () => {
      const timeoutMs = 1000;
      const operation = 'test operation';

      // Create a promise that never resolves
      const neverResolves = new Promise(() => {});

      const timeoutPromise = TimeoutUtils.withTimeout(
        neverResolves,
        timeoutMs,
        `${operation} timed out after ${timeoutMs}ms`
      );

      // Advance time past timeout
      vi.advanceTimersByTime(timeoutMs + 100);

      await expect(timeoutPromise).rejects.toThrow(
        `${operation} timed out after ${timeoutMs}ms`
      );
    });

    it('should include operation context in timeout error message', async () => {
      const timeout = 500;
      const operation = 'file processing';
      const filename = 'large-file.json';

      const slowOperation = new Promise(() => {}); // Never resolves

      const timedOperation = TimeoutUtils.withTimeout(
        slowOperation,
        timeout,
        `Operation '${operation}' on file '${filename}' timed out after ${timeout}ms`
      );

      vi.advanceTimersByTime(timeout + 50);

      await expect(timedOperation).rejects.toThrow(
        `Operation '${operation}' on file '${filename}' timed out after ${timeout}ms`
      );
    });

    it('should successfully complete before timeout', async () => {
      const timeout = 1000;
      const completionTime = 500;

      const quickOperation = new Promise(resolve => {
        setTimeout(() => resolve('success'), completionTime);
      });

      const timedOperation = TimeoutUtils.withTimeout(
        quickOperation,
        timeout,
        'Operation should not timeout'
      );

      // Advance to just before completion
      vi.advanceTimersByTime(completionTime);

      await expect(timedOperation).resolves.toBe('success');
    });
  });

  describe('ApexError Integration with Timeouts', () => {
    it('should create ApexError with TASK_TIMEOUT code and context', async () => {
      const taskId = 'task-123';
      const operation = 'data analysis';
      const timeout = 2000;

      const slowTask = new Promise(() => {}); // Never resolves

      const executeWithTimeout = async () => {
        try {
          await TimeoutUtils.withTimeout(slowTask, timeout);
        } catch (error) {
          throw new ApexError(
            `Task execution timed out after ${timeout}ms`,
            ApexErrorCode.TASK_TIMEOUT,
            {
              taskId,
              operation,
              stage: 'implementation',
              metadata: {
                timeout,
                elapsed: timeout + 100,
                operationType: 'async-operation'
              }
            },
            error instanceof Error ? error : undefined
          );
        }
      };

      const errorPromise = executeWithTimeout();

      vi.advanceTimersByTime(timeout + 100);

      await expect(errorPromise).rejects.toThrow((error: any) => {
        expect(isApexError(error)).toBe(true);
        expect(error.code).toBe(ApexErrorCode.TASK_TIMEOUT);
        expect(error.context.taskId).toBe(taskId);
        expect(error.context.operation).toBe(operation);
        expect(error.context.stage).toBe('implementation');
        expect(error.context.metadata?.timeout).toBe(timeout);
        expect(error.message).toContain(`${timeout}ms`);
        return true;
      });
    });

    it('should preserve error chain when timeout occurs', async () => {
      const originalError = new Error('Database connection failed');
      const timeout = 1000;

      const failingOperation = new Promise((_, reject) => {
        setTimeout(() => reject(originalError), 500);
      });

      const timedOperation = async () => {
        try {
          await TimeoutUtils.withTimeout(failingOperation, timeout);
        } catch (error) {
          if (error === originalError) {
            // Operation failed before timeout
            throw new ApexError(
              'Database operation failed',
              ApexErrorCode.DATABASE_CONNECTION_FAILED,
              { operation: 'database-query' },
              error
            );
          }
          // This was a timeout
          throw new ApexError(
            'Database operation timed out',
            ApexErrorCode.TASK_TIMEOUT,
            { operation: 'database-query', metadata: { timeout } },
            error instanceof Error ? error : undefined
          );
        }
      };

      // Advance to trigger the failure, not the timeout
      vi.advanceTimersByTime(500);

      await expect(timedOperation()).rejects.toThrow((error: any) => {
        expect(isApexError(error)).toBe(true);
        expect(error.code).toBe(ApexErrorCode.DATABASE_CONNECTION_FAILED);
        expect(error.cause).toBe(originalError);
        expect(error.message).toContain('Database operation failed');
        return true;
      });
    });
  });

  describe('Different Timeout Patterns', () => {
    describe('PromiseRaceTimeoutPattern', () => {
      it('should timeout with descriptive error for complex operation', async () => {
        const operation = 'machine learning model training';
        const timeout = 1500;
        const dataset = 'large-dataset.csv';

        const slowOperation = new Promise(() => {}); // Never resolves

        const trainModel = PromiseRaceTimeoutPattern.withTimeout(
          slowOperation,
          timeout,
          `Training operation on dataset '${dataset}' exceeded timeout of ${timeout}ms. ` +
          `Consider reducing dataset size or increasing timeout for '${operation}'.`
        );

        vi.advanceTimersByTime(timeout + 100);

        await expect(trainModel).rejects.toThrow((error: Error) => {
          expect(error.message).toContain(operation);
          expect(error.message).toContain(dataset);
          expect(error.message).toContain(`${timeout}ms`);
          expect(error.message).toContain('Consider reducing dataset size');
          return true;
        });
      });
    });

    describe('PollingWaitPattern', () => {
      it('should timeout when condition never becomes true', async () => {
        const condition = () => false; // Always false
        const timeout = 800;
        const operation = 'service health check';

        const waitForHealthy = PollingWaitPattern.waitForCondition(condition, {
          timeoutMs: timeout,
          intervalMs: 100,
          timeoutError: `Service '${operation}' failed to become healthy within ${timeout}ms. ` +
            `Check service logs and network connectivity.`
        });

        vi.advanceTimersByTime(timeout + 50);

        await expect(waitForHealthy).rejects.toThrow((error: Error) => {
          expect(error.message).toContain(operation);
          expect(error.message).toContain(`${timeout}ms`);
          expect(error.message).toContain('Check service logs');
          return true;
        });
      });

      it('should succeed when condition becomes true before timeout', async () => {
        let conditionMet = false;
        const condition = () => conditionMet;

        const waitForCondition = PollingWaitPattern.waitForCondition(condition, {
          timeoutMs: 1000,
          intervalMs: 100,
          timeoutError: 'Condition not met in time'
        });

        // Make condition true after 300ms
        setTimeout(() => { conditionMet = true; }, 300);

        vi.advanceTimersByTime(300);

        await expect(waitForCondition).resolves.toBeUndefined();
      });
    });

    describe('ExponentialBackoffPattern', () => {
      it('should timeout with descriptive error after all retries', async () => {
        let attemptCount = 0;
        const operation = 'API endpoint connection';
        const endpoint = '/api/v1/data';

        const unreliableOperation = async () => {
          attemptCount++;
          throw new Error(`Connection refused to ${endpoint} (attempt ${attemptCount})`);
        };

        const retryWithBackoff = ExponentialBackoffPattern.withRetry(
          unreliableOperation,
          {
            maxAttempts: 3,
            baseDelayMs: 100,
            backoffMultiplier: 2,
            maxDelayMs: 500,
          }
        );

        // Run all retry attempts
        vi.advanceTimersByTime(1000); // Enough time for all retries

        await expect(retryWithBackoff).rejects.toThrow((error: Error) => {
          expect(error.message).toContain(endpoint);
          expect(error.message).toContain('attempt 3'); // Should be the last attempt
          expect(attemptCount).toBe(3);
          return true;
        });
      });
    });
  });

  describe('Timeout Context and Metadata', () => {
    it('should include comprehensive timeout context in error', async () => {
      const taskId = 'complex-task-789';
      const agentId = 'data-processor';
      const stage = 'analysis';
      const operation = 'statistical-computation';
      const timeout = 1200;
      const userId = 'user-456';

      const computationTask = new Promise(() => {}); // Never resolves

      const executeWithContext = async () => {
        try {
          await TimeoutUtils.withTimeout(computationTask, timeout);
        } catch (error) {
          throw new ApexError(
            `Statistical computation exceeded maximum allowed time of ${timeout}ms. ` +
            `Dataset may be too large or computation too complex.`,
            ApexErrorCode.TASK_TIMEOUT,
            {
              taskId,
              agentId,
              stage,
              operation,
              userId,
              timestamp: new Date(),
              metadata: {
                timeout,
                elapsed: timeout + 200,
                datasetSize: 50000,
                operationType: 'statistical-analysis',
                memoryUsage: '512MB',
                suggestion: 'Consider data sampling or distributed processing'
              }
            },
            error instanceof Error ? error : undefined
          );
        }
      };

      const contextPromise = executeWithContext();

      vi.advanceTimersByTime(timeout + 200);

      await expect(contextPromise).rejects.toThrow((error: any) => {
        expect(isApexError(error)).toBe(true);
        expect(error.code).toBe(ApexErrorCode.TASK_TIMEOUT);

        // Check all context fields
        expect(error.context.taskId).toBe(taskId);
        expect(error.context.agentId).toBe(agentId);
        expect(error.context.stage).toBe(stage);
        expect(error.context.operation).toBe(operation);
        expect(error.context.userId).toBe(userId);

        // Check metadata
        expect(error.context.metadata?.timeout).toBe(timeout);
        expect(error.context.metadata?.datasetSize).toBe(50000);
        expect(error.context.metadata?.operationType).toBe('statistical-analysis');
        expect(error.context.metadata?.suggestion).toBeTruthy();

        // Check descriptive message
        expect(error.message).toContain(`${timeout}ms`);
        expect(error.message).toContain('Dataset may be too large');

        return true;
      });
    });

    it('should format timeout durations in human-readable form', () => {
      // Test TimeoutUtils formatting
      expect(TimeoutUtils.formatTimeout(500)).toBe('500ms');
      expect(TimeoutUtils.formatTimeout(1000)).toBe('1s');
      expect(TimeoutUtils.formatTimeout(1500)).toBe('2s');
      expect(TimeoutUtils.formatTimeout(60000)).toBe('1m');
      expect(TimeoutUtils.formatTimeout(90000)).toBe('2m');
      expect(TimeoutUtils.formatTimeout(3600000)).toBe('60m');
    });

    it('should convert between minutes and milliseconds correctly', () => {
      expect(TimeoutUtils.minutesToMs(1)).toBe(60000);
      expect(TimeoutUtils.minutesToMs(0.5)).toBe(30000);
      expect(TimeoutUtils.minutesToMs(2.5)).toBe(150000);

      expect(TimeoutUtils.msToMinutes(60000)).toBe(1);
      expect(TimeoutUtils.msToMinutes(30000)).toBe(0.5);
      expect(TimeoutUtils.msToMinutes(90000)).toBe(1.5);
    });
  });

  describe('Timeout Error Recovery and Handling', () => {
    it('should allow proper error handling and recovery', async () => {
      const primaryTimeout = 800;
      const fallbackTimeout = 400;

      const primaryOperation = new Promise(() => {}); // Never resolves
      const fallbackOperation = new Promise(resolve => {
        setTimeout(() => resolve('fallback-result'), 200);
      });

      const withFallback = async () => {
        try {
          return await TimeoutUtils.withTimeout(
            primaryOperation,
            primaryTimeout,
            'Primary operation timed out'
          );
        } catch (primaryError) {
          if (primaryError instanceof Error && primaryError.message.includes('timed out')) {
            // Try fallback operation
            try {
              return await TimeoutUtils.withTimeout(
                fallbackOperation,
                fallbackTimeout,
                'Fallback operation also timed out'
              );
            } catch (fallbackError) {
              throw new ApexError(
                'Both primary and fallback operations failed',
                ApexErrorCode.TASK_EXECUTION_FAILED,
                {
                  operation: 'multi-tier-operation',
                  metadata: {
                    primaryTimeout,
                    fallbackTimeout,
                    primaryError: primaryError.message,
                    fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown'
                  }
                }
              );
            }
          }
          throw primaryError;
        }
      };

      // Advance past primary timeout but not fallback completion
      vi.advanceTimersByTime(primaryTimeout + 100);

      // Advance to complete fallback
      vi.advanceTimersByTime(200);

      await expect(withFallback()).resolves.toBe('fallback-result');
    });

    it('should handle concurrent timeout operations correctly', async () => {
      const operations = [
        { name: 'fast-op', timeout: 300, delay: 200 },
        { name: 'medium-op', timeout: 600, delay: 400 },
        { name: 'slow-op', timeout: 500, delay: 800 }, // This should timeout
      ];

      const results = await Promise.allSettled(
        operations.map(async ({ name, timeout, delay }) => {
          const operation = new Promise(resolve => {
            setTimeout(() => resolve(`${name}-result`), delay);
          });

          return TimeoutUtils.withTimeout(
            operation,
            timeout,
            `Operation '${name}' timed out after ${timeout}ms (expected completion: ${delay}ms)`
          );
        })
      );

      // Advance time to complete all possible operations
      vi.advanceTimersByTime(1000);

      // First operation should succeed
      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as any).value).toBe('fast-op-result');

      // Second operation should succeed
      expect(results[1].status).toBe('fulfilled');
      expect((results[1] as any).value).toBe('medium-op-result');

      // Third operation should timeout
      expect(results[2].status).toBe('rejected');
      expect((results[2] as any).reason.message).toContain('slow-op');
      expect((results[2] as any).reason.message).toContain('500ms');
      expect((results[2] as any).reason.message).toContain('expected completion: 800ms');
    });
  });

  describe('Timeout Debug Utilities Integration', () => {
    it('should track and monitor active timeouts', async () => {
      const timeout1Id = 'operation-1';
      const timeout2Id = 'operation-2';

      // Register timeouts
      TimeoutDebugUtils.registerTimeout(timeout1Id, 1000, 'Database query');
      TimeoutDebugUtils.registerTimeout(timeout2Id, 2000, 'File processing');

      // Check initial state
      let activeTimeouts = TimeoutDebugUtils.getActiveTimeouts();
      expect(activeTimeouts).toHaveLength(2);

      const timeout1Info = activeTimeouts.find(t => t.id === timeout1Id);
      const timeout2Info = activeTimeouts.find(t => t.id === timeout2Id);

      expect(timeout1Info?.operation).toBe('Database query');
      expect(timeout1Info?.timeoutMs).toBe(1000);
      expect(timeout1Info?.elapsedMs).toBe(0);
      expect(timeout1Info?.remainingMs).toBe(1000);

      expect(timeout2Info?.operation).toBe('File processing');
      expect(timeout2Info?.timeoutMs).toBe(2000);

      // Advance time by 500ms
      vi.advanceTimersByTime(500);

      activeTimeouts = TimeoutDebugUtils.getActiveTimeouts();
      const updatedTimeout1 = activeTimeouts.find(t => t.id === timeout1Id);

      expect(updatedTimeout1?.elapsedMs).toBe(500);
      expect(updatedTimeout1?.remainingMs).toBe(500);

      // Complete first timeout
      TimeoutDebugUtils.unregisterTimeout(timeout1Id);

      activeTimeouts = TimeoutDebugUtils.getActiveTimeouts();
      expect(activeTimeouts).toHaveLength(1);
      expect(activeTimeouts[0].id).toBe(timeout2Id);

      // Clean up
      TimeoutDebugUtils.unregisterTimeout(timeout2Id);
      expect(TimeoutDebugUtils.getActiveTimeouts()).toHaveLength(0);
    });
  });

  describe('Real-world Timeout Scenarios', () => {
    it('should handle network request timeout with retry logic', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;
      const requestTimeout = 400;
      const retryDelay = 100;

      const simulateNetworkRequest = async (): Promise<string> => {
        attemptCount++;

        // Simulate network delay that's longer than timeout
        await new Promise(resolve => setTimeout(resolve, 600));
        return `Success on attempt ${attemptCount}`;
      };

      const requestWithRetry = async (): Promise<string> => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await TimeoutUtils.withTimeout(
              simulateNetworkRequest(),
              requestTimeout,
              `Network request attempt ${attempt} timed out after ${requestTimeout}ms`
            );
          } catch (error) {
            if (attempt === maxAttempts) {
              throw new ApexError(
                `All ${maxAttempts} network request attempts failed due to timeout`,
                ApexErrorCode.NETWORK_ERROR,
                {
                  operation: 'api-request',
                  metadata: {
                    attempts: maxAttempts,
                    timeoutMs: requestTimeout,
                    totalElapsedMs: maxAttempts * (requestTimeout + retryDelay)
                  }
                },
                error instanceof Error ? error : undefined
              );
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
        throw new Error('Unexpected error in retry logic');
      };

      const requestPromise = requestWithRetry();

      // Fast forward through all timeouts and retries
      for (let i = 0; i < maxAttempts; i++) {
        vi.advanceTimersByTime(requestTimeout + 50); // Trigger timeout
        if (i < maxAttempts - 1) {
          vi.advanceTimersByTime(retryDelay); // Wait for retry delay
        }
      }

      await expect(requestPromise).rejects.toThrow((error: any) => {
        expect(isApexError(error)).toBe(true);
        expect(error.code).toBe(ApexErrorCode.NETWORK_ERROR);
        expect(error.message).toContain(`${maxAttempts} network request attempts`);
        expect(error.context.metadata?.attempts).toBe(maxAttempts);
        expect(error.context.metadata?.timeoutMs).toBe(requestTimeout);
        expect(attemptCount).toBe(maxAttempts);
        return true;
      });
    });

    it('should handle file processing timeout with progress tracking', async () => {
      let progress = 0;
      const totalFiles = 100;
      const processingTimeout = 1000;
      const progressUpdateInterval = 50;

      const processFiles = new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          progress += 10;
          if (progress >= totalFiles) {
            clearInterval(interval);
            resolve(`Processed ${totalFiles} files`);
          }
        }, progressUpdateInterval);
      });

      const processWithTimeout = async () => {
        try {
          return await TimeoutUtils.withTimeout(
            processFiles,
            processingTimeout,
            `File processing timed out after ${processingTimeout}ms. ` +
            `Processed ${progress}/${totalFiles} files (${Math.round(progress/totalFiles*100)}%). ` +
            `Consider processing in smaller batches or increasing timeout.`
          );
        } catch (error) {
          throw new ApexError(
            `Batch file processing incomplete due to timeout`,
            ApexErrorCode.TASK_TIMEOUT,
            {
              operation: 'file-processing',
              metadata: {
                totalFiles,
                processedFiles: progress,
                completionPercentage: Math.round(progress/totalFiles*100),
                timeoutMs: processingTimeout,
                estimatedRemainingMs: ((totalFiles - progress) / 10) * progressUpdateInterval
              }
            },
            error instanceof Error ? error : undefined
          );
        }
      };

      const processingPromise = processWithTimeout();

      // Let it process for a while, then timeout
      vi.advanceTimersByTime(processingTimeout + 100);

      await expect(processingPromise).rejects.toThrow((error: any) => {
        expect(isApexError(error)).toBe(true);
        expect(error.code).toBe(ApexErrorCode.TASK_TIMEOUT);
        expect(error.context.metadata?.totalFiles).toBe(totalFiles);
        expect(error.context.metadata?.processedFiles).toBeGreaterThan(0);
        expect(error.context.metadata?.completionPercentage).toBeGreaterThan(0);
        expect(error.context.metadata?.estimatedRemainingMs).toBeGreaterThan(0);
        return true;
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle zero timeout gracefully', async () => {
      const operation = new Promise(resolve => {
        setTimeout(() => resolve('should-not-complete'), 10);
      });

      const zeroTimeoutOperation = TimeoutUtils.withTimeout(
        operation,
        0,
        'Operation with zero timeout should fail immediately'
      );

      await expect(zeroTimeoutOperation).rejects.toThrow(
        'Operation with zero timeout should fail immediately'
      );
    });

    it('should handle negative timeout values', async () => {
      const operation = new Promise(resolve => {
        setTimeout(() => resolve('should-not-complete'), 10);
      });

      const negativeTimeoutOperation = TimeoutUtils.withTimeout(
        operation,
        -100,
        'Negative timeout should fail immediately'
      );

      await expect(negativeTimeoutOperation).rejects.toThrow(
        'Negative timeout should fail immediately'
      );
    });

    it('should handle very large timeout values', async () => {
      const quickOperation = new Promise(resolve => {
        setTimeout(() => resolve('completed'), 100);
      });

      const largeTimeoutOperation = TimeoutUtils.withTimeout(
        quickOperation,
        Number.MAX_SAFE_INTEGER,
        'Should not timeout with very large value'
      );

      vi.advanceTimersByTime(100);

      await expect(largeTimeoutOperation).resolves.toBe('completed');
    });

    it('should handle promise that throws during timeout', async () => {
      const faultyOperation = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Internal operation error')), 300);
      });

      const timedFaultyOperation = TimeoutUtils.withTimeout(
        faultyOperation,
        500,
        'Operation should fail before timeout'
      );

      vi.advanceTimersByTime(300);

      await expect(timedFaultyOperation).rejects.toThrow('Internal operation error');
    });

    it('should handle concurrent timeout with same ID', () => {
      const timeoutId = 'duplicate-id';

      // Register first timeout
      TimeoutDebugUtils.registerTimeout(timeoutId, 1000, 'First operation');

      // Register second timeout with same ID (should overwrite)
      TimeoutDebugUtils.registerTimeout(timeoutId, 2000, 'Second operation');

      const activeTimeouts = TimeoutDebugUtils.getActiveTimeouts();
      const duplicateTimeout = activeTimeouts.find(t => t.id === timeoutId);

      expect(activeTimeouts.filter(t => t.id === timeoutId)).toHaveLength(1);
      expect(duplicateTimeout?.operation).toBe('Second operation');
      expect(duplicateTimeout?.timeoutMs).toBe(2000);

      TimeoutDebugUtils.unregisterTimeout(timeoutId);
    });
  });
});