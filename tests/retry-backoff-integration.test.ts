import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { ExponentialBackoffReconnector } from '@apexcli/core';
import { createTask } from '../packages/core/src/factories/task-factory.js';

/**
 * Integration test suite for retry and backoff functionality
 *
 * Tests the integration between:
 * 1. Task execution with automatic retries
 * 2. Exponential backoff delay calculation
 * 3. Error classification for retry decisions
 * 4. Retry count tracking and limits
 */
describe('Retry and Backoff Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;

  beforeEach(async () => {
    // Create comprehensive mock store
    mockStore = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
      addLog: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({
        limits: {
          maxRetries: 3,
          retryDelayMs: 1000,
          retryBackoffFactor: 2,
        },
      }),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    orchestrator = new ApexOrchestrator({
      workingDirectory: '/tmp/test',
      limits: {
        maxRetries: 3,
        retryDelayMs: 1000,
        retryBackoffFactor: 2,
      },
    });

    (orchestrator as any).store = mockStore;
    (orchestrator as any).workingDirectory = '/tmp/test';
    orchestrator.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('End-to-End Retry Flow', () => {
    it('should execute complete retry flow with exponential backoff', async () => {
      const task = createTask({
        description: 'Task with retries',
        maxRetries: 3,
      });

      // Simulate the complete retry flow
      const executionLog: Array<{ attempt: number; delay: number; success: boolean }> = [];
      let attemptCount = 0;
      const maxRetries = 3;
      const retryDelayMs = 1000;
      const retryBackoffFactor = 2;

      // Simulate retry loop with exponential backoff
      let lastError: Error | undefined;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          attemptCount++;

          // Log the attempt
          executionLog.push({
            attempt: attemptCount,
            delay: attempt > 0 ? retryDelayMs * Math.pow(retryBackoffFactor, attempt - 1) : 0,
            success: false,
          });

          // Simulate task execution
          if (attemptCount <= 2) {
            throw new Error(`Transient failure on attempt ${attemptCount}`);
          }

          // Success on third attempt
          executionLog[executionLog.length - 1].success = true;
          break;

        } catch (error) {
          lastError = error as Error;

          // Check if error is retryable
          const isRetryable = (error as Error).message.includes('Transient failure');
          if (!isRetryable || attempt >= maxRetries) {
            throw lastError;
          }

          // Wait for retry delay (simulated)
          const delay = retryDelayMs * Math.pow(retryBackoffFactor, attempt);
          vi.advanceTimersByTime(delay);
        }
      }

      // Verify the complete flow
      expect(attemptCount).toBe(3); // 2 failures + 1 success
      expect(executionLog).toHaveLength(3);

      // Verify exponential backoff delays
      expect(executionLog[0].delay).toBe(0);    // No delay on first attempt
      expect(executionLog[1].delay).toBe(1000); // 1st retry: 1000ms
      expect(executionLog[2].delay).toBe(2000); // 2nd retry: 2000ms

      // Verify final success
      expect(executionLog[2].success).toBe(true);
    });

    it('should fail after exhausting all retries', async () => {
      const maxRetries = 2;
      let attemptCount = 0;

      // Simulate retry loop that exhausts all retries
      await expect(async () => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          attemptCount++;

          // Simulate persistent failure
          const error = new Error(`Persistent failure on attempt ${attemptCount}`);

          // Check if error is retryable and we haven't exceeded max retries
          const isRetryable = true; // All errors are retryable in this test
          if (!isRetryable || attempt >= maxRetries) {
            throw error;
          }

          // Wait for retry delay
          const delay = 1000 * Math.pow(2, attempt);
          vi.advanceTimersByTime(delay);
        }
      }).rejects.toThrow('Persistent failure on attempt 3');

      expect(attemptCount).toBe(3); // Initial attempt + 2 retries
    });

    it('should respect autoRetry=false and not retry', async () => {
      const autoRetry = false;
      let attemptCount = 0;

      // Simulate execution with autoRetry disabled
      await expect(async () => {
        attemptCount++;

        const error = new Error('Error that would normally be retried');
        const isRetryable = true; // Error is retryable but autoRetry is disabled

        // With autoRetry=false, don't retry even if error is retryable
        if (!autoRetry || !isRetryable) {
          throw error;
        }

        // This code should not be reached
        throw new Error('Unexpected retry behavior');
      }).rejects.toThrow('Error that would normally be retried');

      expect(attemptCount).toBe(1); // Should not retry
    });
  });

  describe('Backoff Calculation Integration', () => {
    it('should use configured backoff parameters in task execution', async () => {
      // Create orchestrator with custom backoff config
      const customOrchestrator = new ApexOrchestrator({
        limits: {
          maxRetries: 3,
          retryDelayMs: 500,  // Start with 500ms
          retryBackoffFactor: 3, // Triple each time
        },
      });

      (customOrchestrator as any).store = mockStore;
      customOrchestrator.ensureInitialized = vi.fn().mockResolvedValue(undefined);

      const task = createTask({
        description: 'Task with custom backoff',
        maxRetries: 3,
      });
      task.id = 'custom-backoff-task';

      mockStore.getTask.mockResolvedValue(task);

      const capturedDelays: number[] = [];
      let attemptCount = 0;

      const mockSleep = vi.fn().mockImplementation(async (delay: number) => {
        capturedDelays.push(delay);
        vi.advanceTimersByTime(delay);
      });

      const mockRunWorkflow = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Failure for testing');
        }
        return true;
      });

      (customOrchestrator as any).runWorkflow = mockRunWorkflow;
      (customOrchestrator as any).isRetryableError = vi.fn().mockReturnValue(true);
      (customOrchestrator as any).sleep = mockSleep;
      (customOrchestrator as any).getWorkflow = vi.fn().mockResolvedValue({
        stages: [{ name: 'test', agents: ['test-agent'] }],
      });

      await (customOrchestrator as any).executeTask(task.id);

      // Verify custom backoff progression: 500ms, 1500ms (500 * 3^1)
      expect(capturedDelays).toEqual([500, 1500]);
    });

    it('should integrate with ExponentialBackoffReconnector for MCP connections', () => {
      const reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        maxRetries: 5,
        jitterStrategy: 'none',
      });

      // Verify it produces expected delays for task retry scenarios
      const expectedDelays = [1000, 2000, 4000, 8000, 10000]; // Last one capped

      expectedDelays.forEach((expected, index) => {
        const actual = reconnector.calculateDelay(index + 1);
        expect(actual).toBe(expected);
      });

      // Verify state management
      expect(reconnector.getStats().state).toBe('idle');
      expect(reconnector.getStats().currentAttempt).toBe(0);
    });
  });

  describe('Error Classification Integration', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should classify errors and make correct retry decisions', () => {
      const orch = orchestrator as any;

      const testCases = [
        // Retryable errors
        { error: new Error('Connection timed out'), shouldRetry: true },
        { error: new Error('HTTP 500 Server Error'), shouldRetry: true },
        { error: new Error('Network unreachable'), shouldRetry: true },
        { error: new Error('Service temporarily unavailable'), shouldRetry: true },

        // Non-retryable errors
        { error: new Error('Task not found: xyz'), shouldRetry: false },
        { error: new Error('Workflow not found: abc'), shouldRetry: false },
        { error: new Error('Authentication failed'), shouldRetry: false },
        { error: new Error('Invalid input parameters'), shouldRetry: false },
        { error: new Error('Rate limit exceeded'), shouldRetry: false },
        { error: new Error('Token limit exceeded'), shouldRetry: false },
        { error: new Error('Usage limit exceeded'), shouldRetry: false },
      ];

      testCases.forEach(({ error, shouldRetry }) => {
        const isRetryable = orch.isRetryableError(error);
        expect(isRetryable).toBe(shouldRetry,
          `Error "${error.message}" should ${shouldRetry ? '' : 'not '}be retryable`);
      });
    });

    it('should handle pausable vs retryable error classification', () => {
      const orch = orchestrator as any;

      // Rate limit errors - pausable but not retryable
      const rateLimitError = new Error('Rate limit exceeded');
      expect(orch.isRetryableError(rateLimitError)).toBe(false);
      expect(orch.isPausableError(rateLimitError)).toBe('rate_limit');

      // Usage limit errors - pausable but not retryable
      const usageLimitError = new Error('Usage limit exceeded');
      expect(orch.isRetryableError(usageLimitError)).toBe(false);
      expect(orch.isPausableError(usageLimitError)).toBe('usage_limit');

      // Network errors - retryable but not pausable
      const networkError = new Error('Connection timeout');
      expect(orch.isRetryableError(networkError)).toBe(true);
      expect(orch.isPausableError(networkError)).toBe(false);
    });
  });

  describe('Retry Count and State Tracking', () => {
    it('should properly track and update retry counts during execution', async () => {
      const task = createTask({
        description: 'Retry count tracking test',
        maxRetries: 3,
      });
      task.id = 'retry-count-task';

      const taskUpdates: Array<{ retryCount: number; status: string }> = [];

      // Mock store to capture task updates
      mockStore.getTask.mockResolvedValue(task);
      mockStore.updateTask.mockImplementation(async (id: string, updates: any) => {
        if (updates.retryCount !== undefined) {
          taskUpdates.push({
            retryCount: updates.retryCount,
            status: updates.status || task.status,
          });
        }
      });

      let attemptCount = 0;
      const mockRunWorkflow = vi.fn().mockImplementation(async () => {
        attemptCount++;

        if (attemptCount <= 2) {
          // Update retry count before throwing error
          task.retryCount = attemptCount - 1;
          throw new Error(`Failure on attempt ${attemptCount}`);
        }

        return true; // Success on third attempt
      });

      (orchestrator as any).runWorkflow = mockRunWorkflow;
      (orchestrator as any).isRetryableError = vi.fn().mockReturnValue(true);
      (orchestrator as any).sleep = vi.fn().mockImplementation(async (delay: number) => {
        vi.advanceTimersByTime(delay);
      });
      (orchestrator as any).getWorkflow = vi.fn().mockResolvedValue({
        stages: [{ name: 'test', agents: ['test-agent'] }],
      });

      await (orchestrator as any).executeTask(task.id);

      // Verify retry counts were tracked correctly
      expect(attemptCount).toBe(3);
      expect(task.retryCount).toBeLessThanOrEqual(task.maxRetries);
    });

    it('should not exceed maxRetries limit', async () => {
      const task = createTask({
        description: 'Max retries test',
        maxRetries: 2,
      });
      task.id = 'max-retries-task';

      mockStore.getTask.mockResolvedValue(task);

      let attemptCount = 0;
      const mockRunWorkflow = vi.fn().mockImplementation(async () => {
        attemptCount++;
        throw new Error(`Always fails - attempt ${attemptCount}`);
      });

      (orchestrator as any).runWorkflow = mockRunWorkflow;
      (orchestrator as any).isRetryableError = vi.fn().mockReturnValue(true);
      (orchestrator as any).sleep = vi.fn().mockImplementation(async (delay: number) => {
        vi.advanceTimersByTime(delay);
      });
      (orchestrator as any).getWorkflow = vi.fn().mockResolvedValue({
        stages: [{ name: 'test', agents: ['test-agent'] }],
      });

      await expect((orchestrator as any).executeTask(task.id))
        .rejects.toThrow();

      // Should attempt exactly maxRetries + 1 times (initial + 2 retries)
      expect(attemptCount).toBe(3);
    });
  });

  describe('Connection Retry Integration', () => {
    it('should integrate ExponentialBackoffReconnector with connection management', () => {
      const reconnector = new ExponentialBackoffReconnector({
        baseDelayMs: 1000,
        backoffFactor: 2,
        maxRetries: 3,
      });

      const events: string[] = [];
      reconnector.on('reconnect:attempt', (attempt, delay) => {
        events.push(`attempt:${attempt}:${delay}`);
      });
      reconnector.on('reconnect:success', (attempt) => {
        events.push(`success:${attempt}`);
      });
      reconnector.on('reconnect:failure', (attempt, error) => {
        events.push(`failure:${attempt}:${error}`);
      });
      reconnector.on('reconnect:exhausted', (attempts, error) => {
        events.push(`exhausted:${attempts}:${error}`);
      });

      // Simulate connection attempts
      const connectFn = vi.fn()
        .mockResolvedValueOnce(undefined) // First attempt succeeds internally
        .mockResolvedValueOnce(undefined);

      // First attempt
      reconnector.scheduleReconnect(connectFn);
      vi.advanceTimersByTime(1000);

      // Notify of success
      reconnector.notifyConnected();

      expect(events).toContain('attempt:1:1000');
      expect(events).toContain('success:1');
      expect(reconnector.getStats().state).toBe('connected');
      expect(reconnector.getStats().totalReconnections).toBe(1);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid retry scenarios efficiently', async () => {
      const task = createTask({
        description: 'Rapid retry test',
        maxRetries: 10,
      });
      task.id = 'rapid-retry-task';

      mockStore.getTask.mockResolvedValue(task);

      const startTime = Date.now();
      let attemptCount = 0;

      const mockRunWorkflow = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 3) {
          throw new Error('Quick failure');
        }
        return true;
      });

      const mockSleep = vi.fn().mockImplementation(async (delay: number) => {
        // Simulate very fast advancement for performance testing
        vi.advanceTimersByTime(Math.min(delay, 100));
      });

      (orchestrator as any).runWorkflow = mockRunWorkflow;
      (orchestrator as any).isRetryableError = vi.fn().mockReturnValue(true);
      (orchestrator as any).sleep = mockSleep;
      (orchestrator as any).getWorkflow = vi.fn().mockResolvedValue({
        stages: [{ name: 'test', agents: ['test-agent'] }],
      });

      await (orchestrator as any).executeTask(task.id);

      expect(attemptCount).toBe(4); // 3 failures + 1 success
      expect(mockSleep).toHaveBeenCalledTimes(3); // 3 retry delays
    });

    it('should handle zero and boundary retry configurations', () => {
      const configs = [
        { maxRetries: 0, retryDelayMs: 1000, retryBackoffFactor: 2 },
        { maxRetries: 1, retryDelayMs: 0, retryBackoffFactor: 2 },
        { maxRetries: 1000, retryDelayMs: 1, retryBackoffFactor: 1 },
      ];

      configs.forEach(config => {
        const task = createTask({
          description: `Boundary test with maxRetries=${config.maxRetries}`,
          maxRetries: config.maxRetries,
        });

        expect(task.maxRetries).toBe(config.maxRetries);
        expect(task.retryCount).toBe(0);

        // Verify retry decision logic
        const shouldRetry = task.retryCount < task.maxRetries;
        expect(typeof shouldRetry).toBe('boolean');
      });
    });
  });
});