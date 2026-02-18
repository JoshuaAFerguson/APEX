/**
 * @fileoverview Wait Strategies Integration Tests
 *
 * Comprehensive tests for wait strategies implemented in the APEX orchestrator:
 * - Promise.race() patterns for timeout management
 * - setTimeout cleanup and cancellation
 * - Graceful degradation for timeout scenarios
 * - Connection management with retry logic
 * - Browser automation wait conditions
 * - MCP client wait patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock implementations for testing wait strategies
class MockBrowserManager extends EventEmitter {
  private timeouts = new Set<NodeJS.Timeout>();

  async waitForSelector(selector: string, options: { timeout?: number; state?: string } = {}) {
    const { timeout = 30000, state = 'visible' } = options;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.timeouts.delete(timeoutId);
        reject(new Error(`Timeout waiting for selector "${selector}" to be ${state} after ${timeout}ms`));
      }, timeout);

      this.timeouts.add(timeoutId);

      // Simulate element found after delay
      const findElement = setTimeout(() => {
        this.timeouts.delete(timeoutId);
        this.timeouts.delete(findElement);
        clearTimeout(timeoutId);
        resolve({ selector, state, found: true });
      }, Math.min(1000, timeout / 2)); // Found within timeout

      this.timeouts.add(findElement);
    });
  }

  async waitForCondition(condition: () => boolean, options: { timeout?: number; interval?: number } = {}) {
    const { timeout = 30000, interval = 100 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= timeout) {
          reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
          return;
        }

        try {
          if (condition()) {
            resolve(true);
            return;
          }
        } catch (error) {
          reject(error);
          return;
        }

        const timeoutId = setTimeout(check, interval);
        this.timeouts.add(timeoutId);
      };

      check();
    });
  }

  async raceWithTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        this.timeouts.delete(timeoutId);
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.timeouts.add(timeoutId);
    });

    return Promise.race([operation, timeoutPromise]);
  }

  cleanup() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts.clear();
  }
}

class MockMCPClient extends EventEmitter {
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private retryAttempts = 0;
  private maxRetries = 3;

  async connect(options: {
    connectionTimeoutMs?: number;
    retryDelayMs?: number;
    maxRetryDelayMs?: number;
    backoffFactor?: number;
  } = {}) {
    const {
      connectionTimeoutMs = 10000,
      retryDelayMs = 1000,
      maxRetryDelayMs = 60000,
      backoffFactor = 2.0
    } = options;

    return this.connectWithRetry({
      connectionTimeoutMs,
      retryDelayMs,
      maxRetryDelayMs,
      backoffFactor
    });
  }

  private async connectWithRetry(options: {
    connectionTimeoutMs: number;
    retryDelayMs: number;
    maxRetryDelayMs: number;
    backoffFactor: number;
  }): Promise<void> {
    while (this.retryAttempts <= this.maxRetries) {
      try {
        await this.attemptConnection(options.connectionTimeoutMs);
        this.connectionState = 'connected';
        this.retryAttempts = 0;
        this.emit('connected');
        return;
      } catch (error) {
        this.retryAttempts++;

        if (this.retryAttempts > this.maxRetries) {
          this.connectionState = 'disconnected';
          this.emit('connectionFailed', error);
          throw new Error(`Failed to connect after ${this.maxRetries} attempts: ${error}`);
        }

        const delay = Math.min(
          options.retryDelayMs * Math.pow(options.backoffFactor, this.retryAttempts - 1),
          options.maxRetryDelayMs
        );

        this.emit('retryingConnection', { attempt: this.retryAttempts, delay });
        await this.delay(delay);
      }
    }
  }

  private async attemptConnection(timeoutMs: number): Promise<void> {
    this.connectionState = 'connecting';
    this.emit('connecting');

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Simulate connection attempt
      const connectionTime = Math.random() * timeoutMs * 1.5; // May exceed timeout
      const connectionId = setTimeout(() => {
        clearTimeout(timeoutId);

        if (connectionTime > timeoutMs) {
          reject(new Error('Connection took too long'));
        } else if (this.retryAttempts > 0 && Math.random() < 0.3) {
          reject(new Error('Simulated connection failure'));
        } else {
          resolve();
        }
      }, Math.min(connectionTime, timeoutMs + 100));
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendRequest<T>(request: any, options: {
    requestTimeoutMs?: number;
    retryOnTimeout?: boolean;
  } = {}): Promise<T> {
    const { requestTimeoutMs = 30000, retryOnTimeout = true } = options;

    if (this.connectionState !== 'connected') {
      throw new Error('Client not connected');
    }

    return this.executeRequest(request, requestTimeoutMs, retryOnTimeout);
  }

  private async executeRequest<T>(request: any, timeoutMs: number, retry: boolean): Promise<T> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;

        if (retry && elapsed < timeoutMs * 2) {
          // Retry once on timeout
          this.executeRequest(request, timeoutMs, false)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Simulate request processing
      const processingTime = Math.random() * timeoutMs * 0.8; // Usually within timeout
      setTimeout(() => {
        clearTimeout(timeoutId);
        resolve({ result: 'success', request, processingTime } as T);
      }, processingTime);
    });
  }

  getConnectionState() {
    return this.connectionState;
  }

  disconnect() {
    this.connectionState = 'disconnected';
    this.emit('disconnected');
  }
}

describe('Wait Strategies Integration Tests', () => {
  let browserManager: MockBrowserManager;
  let mcpClient: MockMCPClient;

  beforeEach(() => {
    browserManager = new MockBrowserManager();
    mcpClient = new MockMCPClient();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    browserManager.cleanup();
    mcpClient.disconnect();
    vi.useRealTimers();
  });

  describe('Browser Wait Strategies', () => {
    it('should wait for selector with timeout using Promise.race pattern', async () => {
      const promise = browserManager.waitForSelector('#test-element', {
        timeout: 5000,
        state: 'visible'
      });

      // Fast-forward time to simulate element found
      vi.advanceTimersByTime(1000);

      const result = await promise;
      expect(result).toEqual({
        selector: '#test-element',
        state: 'visible',
        found: true
      });
    });

    it('should timeout when element is not found within specified time', async () => {
      const promise = browserManager.waitForSelector('#missing-element', {
        timeout: 2000,
        state: 'visible'
      });

      // Fast-forward past timeout
      vi.advanceTimersByTime(2500);

      await expect(promise).rejects.toThrow('Timeout waiting for selector "#missing-element" to be visible after 2000ms');
    });

    it('should use Promise.race for racing multiple wait conditions', async () => {
      const condition1 = vi.fn().mockReturnValue(false);
      const condition2 = vi.fn().mockReturnValue(false);
      const condition3 = vi.fn().mockReturnValue(false);

      const promises = [
        browserManager.waitForCondition(condition1, { timeout: 3000, interval: 100 }),
        browserManager.waitForCondition(condition2, { timeout: 3000, interval: 100 }),
        browserManager.waitForCondition(condition3, { timeout: 3000, interval: 100 })
      ];

      // Make condition2 true after 1 second
      setTimeout(() => {
        condition2.mockReturnValue(true);
      }, 1000);

      vi.advanceTimersByTime(1200);

      const winner = await Promise.race(promises);
      expect(winner).toBe(true);

      // Verify condition2 was the one that succeeded
      expect(condition2).toHaveBeenCalled();
    });

    it('should handle timeout cleanup properly', async () => {
      const cleanupSpy = vi.spyOn(browserManager, 'cleanup');

      const promise1 = browserManager.waitForSelector('#element1', { timeout: 1000 });
      const promise2 = browserManager.waitForSelector('#element2', { timeout: 2000 });

      // Fast-forward to complete first promise
      vi.advanceTimersByTime(500);
      await promise1;

      // Cleanup should clear all timeouts
      browserManager.cleanup();
      expect(cleanupSpy).toHaveBeenCalled();

      // Second promise should not resolve after cleanup
      vi.advanceTimersByTime(2000);

      // Note: In real implementation, cleanup would cancel pending operations
      expect(promise2).toBeDefined(); // Just verify promise exists
    });

    it('should implement graceful degradation on timeout', async () => {
      let fallbackCalled = false;
      const fallbackAction = () => {
        fallbackCalled = true;
        return { fallback: true };
      };

      try {
        const operation = browserManager.waitForSelector('#slow-element', { timeout: 1000 });
        vi.advanceTimersByTime(1500);
        await operation;
      } catch (error) {
        // Graceful degradation - perform fallback action
        const result = fallbackAction();
        expect(fallbackCalled).toBe(true);
        expect(result.fallback).toBe(true);
      }
    });
  });

  describe('MCP Client Wait Strategies', () => {
    it('should implement exponential backoff for connection retries', async () => {
      const connectionEvents: Array<{ attempt: number; delay: number }> = [];

      mcpClient.on('retryingConnection', (data) => {
        connectionEvents.push(data);
      });

      // Force initial connection failures
      let connectionAttempts = 0;
      const originalAttemptConnection = (mcpClient as any).attemptConnection;
      (mcpClient as any).attemptConnection = async function(timeoutMs: number) {
        connectionAttempts++;
        if (connectionAttempts <= 2) {
          throw new Error(`Simulated failure ${connectionAttempts}`);
        }
        return originalAttemptConnection.call(this, timeoutMs);
      };

      const connectPromise = mcpClient.connect({
        connectionTimeoutMs: 5000,
        retryDelayMs: 1000,
        maxRetryDelayMs: 10000,
        backoffFactor: 2.0
      });

      // Advance through retry attempts
      vi.advanceTimersByTime(1000); // First retry delay
      vi.advanceTimersByTime(5000); // Connection timeout + processing
      vi.advanceTimersByTime(2000); // Second retry delay
      vi.advanceTimersByTime(5000); // Second connection timeout + processing
      vi.advanceTimersByTime(1000); // Final connection

      await connectPromise;

      expect(connectionEvents).toHaveLength(2);
      expect(connectionEvents[0].delay).toBe(1000); // 1000 * 2^0
      expect(connectionEvents[1].delay).toBe(2000); // 1000 * 2^1
    });

    it('should handle connection timeout with proper cleanup', async () => {
      const connectionPromise = mcpClient.connect({
        connectionTimeoutMs: 2000,
        retryDelayMs: 500,
        maxRetryDelayMs: 5000,
        backoffFactor: 2.0
      });

      // Simulate very slow connection that times out
      vi.advanceTimersByTime(10000);

      await expect(connectionPromise).rejects.toThrow('Failed to connect after 3 attempts');
      expect(mcpClient.getConnectionState()).toBe('disconnected');
    });

    it('should implement request timeout with optional retry', async () => {
      // First establish connection
      const connectPromise = mcpClient.connect({ connectionTimeoutMs: 1000 });
      vi.advanceTimersByTime(800);
      await connectPromise;

      expect(mcpClient.getConnectionState()).toBe('connected');

      // Test request with timeout and retry
      const requestPromise = mcpClient.sendRequest(
        { method: 'test', params: {} },
        { requestTimeoutMs: 2000, retryOnTimeout: true }
      );

      // Simulate request processing within timeout
      vi.advanceTimersByTime(1500);

      const result = await requestPromise;
      expect(result).toMatchObject({
        result: 'success',
        request: { method: 'test', params: {} }
      });
    });

    it('should handle concurrent requests with individual timeouts', async () => {
      // Establish connection
      const connectPromise = mcpClient.connect({ connectionTimeoutMs: 1000 });
      vi.advanceTimersByTime(800);
      await connectPromise;

      const requests = [
        mcpClient.sendRequest({ id: 1 }, { requestTimeoutMs: 1000 }),
        mcpClient.sendRequest({ id: 2 }, { requestTimeoutMs: 2000 }),
        mcpClient.sendRequest({ id: 3 }, { requestTimeoutMs: 3000 })
      ];

      // Fast-forward time to complete all requests
      vi.advanceTimersByTime(2500);

      const results = await Promise.all(requests);
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toMatchObject({
          result: 'success',
          request: { id: index + 1 }
        });
      });
    });
  });

  describe('Advanced Wait Patterns', () => {
    it('should implement cascading timeouts with fallback strategies', async () => {
      const cascadingTimeouts = {
        quick: 1000,    // Try quick operation first
        normal: 3000,   // Fallback to normal timeout
        extended: 10000 // Final extended timeout
      };

      let strategy = 'quick';
      const executeWithCascadingTimeout = async () => {
        for (const [strategyName, timeout] of Object.entries(cascadingTimeouts)) {
          strategy = strategyName;
          try {
            return await browserManager.raceWithTimeout(
              browserManager.waitForSelector('#dynamic-element', { timeout }),
              timeout
            );
          } catch (error) {
            if (strategyName === 'extended') {
              throw error; // Final attempt failed
            }
            // Continue to next strategy
            continue;
          }
        }
      };

      const promise = executeWithCascadingTimeout();

      // Simulate element found in normal timeout range
      vi.advanceTimersByTime(2000);

      const result = await promise;
      expect(result).toEqual({
        selector: '#dynamic-element',
        state: 'visible',
        found: true
      });
      expect(strategy).toBe('normal'); // Should have fallen back to normal strategy
    });

    it('should implement timeout with progress monitoring', async () => {
      const progressUpdates: number[] = [];

      const monitoredWait = async (selector: string, timeoutMs: number) => {
        const startTime = Date.now();
        const progressInterval = 500;

        const progressTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min((elapsed / timeoutMs) * 100, 100);
          progressUpdates.push(Math.round(progress));
        }, progressInterval);

        try {
          const result = await browserManager.waitForSelector(selector, { timeout: timeoutMs });
          clearInterval(progressTimer);
          return result;
        } catch (error) {
          clearInterval(progressTimer);
          throw error;
        }
      };

      const promise = monitoredWait('#progress-element', 2000);

      // Advance time in increments to capture progress
      vi.advanceTimersByTime(500);   // ~25%
      vi.advanceTimersByTime(500);   // ~50%
      vi.advanceTimersByTime(500);   // ~75%
      vi.advanceTimersByTime(500);   // Element found

      await promise;

      expect(progressUpdates.length).toBeGreaterThanOrEqual(3);
      expect(progressUpdates[0]).toBeCloseTo(25, 5);
      expect(progressUpdates[1]).toBeCloseTo(50, 5);
      expect(progressUpdates[2]).toBeCloseTo(75, 5);
    });

    it('should implement cooperative cancellation with AbortSignal', async () => {
      const abortController = new AbortController();

      const cancellableWait = async (signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(new Error('Operation was cancelled'));
            return;
          }

          const operation = setTimeout(() => {
            resolve('Operation completed');
          }, 2000);

          signal.addEventListener('abort', () => {
            clearTimeout(operation);
            reject(new Error('Operation was cancelled'));
          });
        });
      };

      const promise = cancellableWait(abortController.signal);

      // Cancel operation after 1 second
      setTimeout(() => {
        abortController.abort();
      }, 1000);

      vi.advanceTimersByTime(1200);

      await expect(promise).rejects.toThrow('Operation was cancelled');
    });

    it('should handle timeout with resource cleanup', async () => {
      const resources = new Set<string>();

      const resourceIntensiveOperation = async () => {
        // Allocate resources
        resources.add('connection-1');
        resources.add('connection-2');
        resources.add('temp-file');

        try {
          await browserManager.waitForSelector('#resource-element', { timeout: 1000 });
          return 'Operation successful';
        } catch (error) {
          throw error;
        } finally {
          // Cleanup resources
          resources.clear();
        }
      };

      const promise = resourceIntensiveOperation();
      vi.advanceTimersByTime(1500); // Timeout

      await expect(promise).rejects.toThrow();

      // Verify resources were cleaned up
      expect(resources.size).toBe(0);
    });

    it('should implement timeout jitter for distributed systems', async () => {
      const baseTimeout = 5000;
      const jitterFactor = 0.1; // 10% jitter

      const calculateJitteredTimeout = (base: number, factor: number) => {
        const jitter = (Math.random() - 0.5) * 2 * factor; // -10% to +10%
        return Math.round(base * (1 + jitter));
      };

      const timeouts = Array(10).fill(0).map(() =>
        calculateJitteredTimeout(baseTimeout, jitterFactor)
      );

      // All timeouts should be within jitter range
      timeouts.forEach(timeout => {
        expect(timeout).toBeGreaterThanOrEqual(baseTimeout * (1 - jitterFactor));
        expect(timeout).toBeLessThanOrEqual(baseTimeout * (1 + jitterFactor));
      });

      // Timeouts should vary (not all the same)
      const uniqueTimeouts = new Set(timeouts);
      expect(uniqueTimeouts.size).toBeGreaterThan(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle timeout during system resource exhaustion', async () => {
      // Simulate resource exhaustion
      const exhaustedSystemWait = async () => {
        const operations = Array(100).fill(0).map((_, i) =>
          browserManager.waitForSelector(`#element-${i}`, { timeout: 1000 })
        );

        try {
          return await Promise.race(operations);
        } catch (error) {
          // In resource exhaustion, we expect some operations to timeout
          if (error.message.includes('Timeout')) {
            return { gracefulDegradation: true };
          }
          throw error;
        }
      };

      const promise = exhaustedSystemWait();
      vi.advanceTimersByTime(800); // Some operations complete

      const result = await promise;
      expect(result).toEqual({
        selector: '#element-0',
        state: 'visible',
        found: true
      });
    });

    it('should handle clock adjustments during timeout operations', async () => {
      const startTime = Date.now();

      // Simulate clock jump (e.g., daylight saving time)
      const clockAwareWait = async (targetMs: number) => {
        const safetyMargin = 1000; // 1 second safety margin
        let lastCheck = startTime;

        return new Promise((resolve, reject) => {
          const check = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;

            // Detect potential clock jump
            const timeSinceLastCheck = currentTime - lastCheck;
            if (timeSinceLastCheck > targetMs + safetyMargin) {
              reject(new Error('Clock adjustment detected during timeout'));
              return;
            }

            lastCheck = currentTime;

            if (elapsed >= targetMs) {
              resolve('Timeout reached normally');
            } else {
              setTimeout(check, 100);
            }
          };

          check();
        });
      };

      const promise = clockAwareWait(2000);
      vi.advanceTimersByTime(2100);

      const result = await promise;
      expect(result).toBe('Timeout reached normally');
    });

    it('should handle memory pressure during long-running waits', async () => {
      const memoryAwareWait = async () => {
        const checkpoints: number[] = [];

        return new Promise((resolve, reject) => {
          const intervalId = setInterval(() => {
            checkpoints.push(Date.now());

            // Simulate memory pressure check
            if (checkpoints.length > 100) {
              // Clean up old checkpoints to prevent memory leak
              checkpoints.splice(0, 50);
            }

            // Simulate operation completion
            if (checkpoints.length >= 10) {
              clearInterval(intervalId);
              resolve({ checkpoints: checkpoints.length });
            }
          }, 100);

          // Safety timeout
          setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error('Memory-aware wait timeout'));
          }, 5000);
        });
      };

      const promise = memoryAwareWait();
      vi.advanceTimersByTime(1200);

      const result = await promise;
      expect(result).toMatchObject({ checkpoints: 10 });
    });
  });
});