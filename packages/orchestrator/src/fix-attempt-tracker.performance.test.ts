import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FixAttemptTracker, FixAttemptTrackerOptions } from './fix-attempt-tracker';
import { TaskStore } from './store';
import { FixAttemptHistory } from '@apexcli/core';

/**
 * Performance and stress tests for FixAttemptTracker
 * These tests ensure the tracker performs well under various load conditions
 */

// Mock TaskStore optimized for performance tests
const createPerformanceMockStore = () => {
  const store: Partial<TaskStore> = {
    getFixAttemptHistory: vi.fn(),
    addFixAttempt: vi.fn(),
    clearFixAttempts: vi.fn(),
  };
  return store as TaskStore;
};

describe('FixAttemptTracker Performance Tests', () => {
  let tracker: FixAttemptTracker;
  let store: TaskStore;
  let options: FixAttemptTrackerOptions;

  beforeEach(async () => {
    vi.clearAllMocks();
    store = createPerformanceMockStore();

    options = {
      taskId: 'performance-test-task',
      store,
      config: {
        maxAttemptsPerError: 5,
        maxTotalAttempts: 1000,
        backoffStrategy: 'exponential',
        baseDelayMs: 0, // No delay for performance tests
        maxDelayMs: 0,
        groupSimilarErrors: true,
        similarityThreshold: 0.8,
      },
    };

    // Mock empty history by default
    vi.mocked(store.getFixAttemptHistory).mockResolvedValue({
      entries: [],
      totalAttempts: 0,
      resolvedCount: 0,
      failedCount: 0,
      errorAttemptCounts: {},
    });

    tracker = new FixAttemptTracker(options);
    await tracker.initialize();
  });

  describe('High Volume Error Processing', () => {
    it('should handle 1000 unique errors efficiently', async () => {
      const startTime = performance.now();

      // Generate 1000 unique errors
      const errors = Array.from({ length: 1000 }, (_, i) =>
        tracker.createErrorFingerprint(
          `Error ${i}: Something went wrong in operation ${i}`,
          i % 10 === 0 ? 'critical' : 'warning',
          { filePath: `/src/file_${i % 100}.ts`, line: i % 500 + 1 }
        )
      );

      const fingerprintTime = performance.now();
      console.log(`Created 1000 fingerprints in ${fingerprintTime - startTime}ms`);

      // Process each error
      for (const error of errors) {
        await tracker.startFixAttempt(error, `Fix for error ${error.hash.slice(0, 8)}`);
        await tracker.completeFixAttempt({
          success: Math.random() > 0.3, // 70% success rate
          resolved: Math.random() > 0.2, // 80% resolution rate
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerError = totalTime / 1000;

      console.log(`Processed 1000 errors in ${totalTime}ms (${avgTimePerError}ms per error)`);

      // Performance assertions
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(avgTimePerError).toBeLessThan(10); // Should average less than 10ms per error

      // Verify correctness
      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(1000);
      expect(Object.keys(history.errorAttemptCounts)).toHaveLength(1000);
    });

    it('should handle rapid-fire attempts on the same error', async () => {
      const error = tracker.createErrorFingerprint(
        'Rapidly repeated error',
        'test'
      );

      const startTime = performance.now();

      // Make 100 rapid attempts on the same error (within retry limits)
      const maxAttempts = Math.min(100, options.config!.maxAttemptsPerError!);
      for (let i = 0; i < maxAttempts; i++) {
        await tracker.startFixAttempt(error, `Rapid attempt ${i + 1}`);
        await tracker.completeFixAttempt({
          success: false,
          resolved: false,
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Processed ${maxAttempts} rapid attempts in ${totalTime}ms`);

      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(maxAttempts);
      expect(history.errorAttemptCounts[error.hash]).toBe(maxAttempts);
    });
  });

  describe('Memory Usage and Efficiency', () => {
    it('should handle large existing histories efficiently', async () => {
      // Generate large history
      const largeHistory: FixAttemptHistory = {
        entries: Array.from({ length: 10000 }, (_, i) => ({
          id: `perf-test-${i}`,
          taskId: 'performance-test-task',
          attemptNumber: i + 1,
          error: {
            hash: `hash-${i % 1000}`, // 1000 different error types, each with ~10 attempts
            message: `Performance test error ${i}`,
            category: 'test',
          },
          startedAt: new Date(Date.now() - (10000 - i) * 100),
          completedAt: new Date(Date.now() - (10000 - i - 1) * 100),
          approach: `Approach ${i}`,
          result: {
            success: i % 3 !== 0,
            resolved: i % 5 !== 0,
          },
        })),
        totalAttempts: 10000,
        resolvedCount: 8000,
        failedCount: 2000,
        errorAttemptCounts: Array.from({ length: 1000 }, (_, i) => [`hash-${i}`, 10])
          .reduce((acc, [hash, count]) => ({ ...acc, [hash]: count }), {}),
      };

      vi.mocked(store.getFixAttemptHistory).mockResolvedValue(largeHistory);

      const startTime = performance.now();
      const largeTracker = new FixAttemptTracker(options);
      await largeTracker.initialize();
      const initTime = performance.now() - startTime;

      console.log(`Initialized with 10,000 entry history in ${initTime}ms`);

      expect(initTime).toBeLessThan(1000); // Should initialize within 1 second

      // Test operations on large tracker
      const operationStartTime = performance.now();

      const newError = largeTracker.createErrorFingerprint('New error on large tracker', 'test');
      const decision = largeTracker.shouldAttemptFix(newError);
      const loopResult = largeTracker.detectLoop();
      const history = largeTracker.getHistory();

      const operationTime = performance.now() - operationStartTime;

      console.log(`Core operations on large tracker took ${operationTime}ms`);

      expect(operationTime).toBeLessThan(100); // Operations should be fast even with large history
      expect(decision.shouldAttempt).toBe(true);
      expect(loopResult).toBeDefined();
      expect(history.totalAttempts).toBe(10000);
    });

    it('should efficiently handle similarity calculations on many errors', async () => {
      // Create many similar errors to stress the similarity algorithm
      const baseMessage = 'TypeError: Cannot read property "foo" of undefined';
      const similarErrors = Array.from({ length: 500 }, (_, i) =>
        tracker.createErrorFingerprint(
          `${baseMessage} at line ${i + 1}`,
          'runtime',
          { line: i + 1 }
        )
      );

      // Add first error to history
      await tracker.startFixAttempt(similarErrors[0], 'First similar error');
      await tracker.completeFixAttempt({ success: false, resolved: false });

      const startTime = performance.now();

      // Test similarity matching for all other errors
      const decisions = similarErrors.slice(1).map(error => {
        return tracker.shouldAttemptFix(error);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Processed 499 similarity checks in ${totalTime}ms`);

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(decisions).toHaveLength(499);

      // Many should be grouped together due to similarity
      const groupedDecisions = decisions.filter(d => d.attemptCount > 1);
      expect(groupedDecisions.length).toBeGreaterThan(0);
    });
  });

  describe('Loop Detection Performance', () => {
    it('should efficiently detect loops in large attempt histories', async () => {
      // Create a history that will trigger different types of loops
      const loopHistory: FixAttemptHistory = {
        entries: [
          // Create oscillating pattern with many entries
          ...Array.from({ length: 1000 }, (_, i) => ({
            id: `loop-test-${i}`,
            taskId: 'performance-test-task',
            attemptNumber: i + 1,
            error: {
              hash: `hash-${i % 4}`, // Oscillate between 4 errors
              message: `Loop error ${i % 4}`,
              category: 'test',
            },
            startedAt: new Date(Date.now() - (1000 - i) * 10),
            completedAt: new Date(Date.now() - (1000 - i - 1) * 10),
            approach: `Approach ${i}`,
            result: {
              success: false,
              resolved: false,
            },
          })),
        ],
        totalAttempts: 1000,
        resolvedCount: 0,
        failedCount: 1000,
        errorAttemptCounts: {
          'hash-0': 250,
          'hash-1': 250,
          'hash-2': 250,
          'hash-3': 250,
        },
      };

      vi.mocked(store.getFixAttemptHistory).mockResolvedValue(loopHistory);

      const loopTracker = new FixAttemptTracker(options);
      await loopTracker.initialize();

      const startTime = performance.now();

      // Run loop detection multiple times
      const detectionResults = Array.from({ length: 100 }, () =>
        loopTracker.detectLoop()
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 100;

      console.log(`100 loop detections on 1000-entry history: ${totalTime}ms (${avgTime}ms avg)`);

      expect(avgTime).toBeLessThan(10); // Average detection should be under 10ms
      expect(detectionResults.every(result => result.loopDetected)).toBe(true);
    });
  });

  describe('Concurrent Operations Simulation', () => {
    it('should handle simulated concurrent error processing', async () => {
      // Simulate multiple "agents" processing errors concurrently
      // Note: This is simulation since we can't have true concurrency in vitest

      const errors = Array.from({ length: 100 }, (_, i) =>
        tracker.createErrorFingerprint(`Concurrent error ${i}`, 'test', { line: i })
      );

      const startTime = performance.now();

      // Process errors in batches to simulate concurrency
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < errors.length; i += batchSize) {
        const batch = errors.slice(i, i + batchSize);
        batches.push(batch);
      }

      // Process each batch sequentially, but simulate rapid processing
      for (const batch of batches) {
        const batchPromises = batch.map(async (error, index) => {
          await tracker.startFixAttempt(error, `Concurrent fix ${index}`);
          return tracker.completeFixAttempt({
            success: Math.random() > 0.3,
            resolved: Math.random() > 0.2,
          });
        });

        // Wait for batch to complete
        await Promise.all(batchPromises);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Processed 100 errors in batches: ${totalTime}ms`);

      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(100);
      expect(Object.keys(history.errorAttemptCounts)).toHaveLength(100);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle very long error messages efficiently', async () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000); // 10KB message

      const startTime = performance.now();

      const errors = Array.from({ length: 100 }, (_, i) =>
        tracker.createErrorFingerprint(`${longMessage} ${i}`, 'test')
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Created 100 long-message fingerprints: ${totalTime}ms`);

      expect(totalTime).toBeLessThan(1000);
      expect(errors.every(e => e.message.length === 500)).toBe(true); // Should be truncated
      expect(errors.every(e => e.hash)).toBeTruthy();
    });

    it('should handle deep file path hierarchies efficiently', async () => {
      const deepPath = 'src/' + Array.from({ length: 50 }, (_, i) => `level${i}`).join('/') + '/file.js';

      const startTime = performance.now();

      const errors = Array.from({ length: 1000 }, (_, i) =>
        tracker.createErrorFingerprint(
          `Error in deep file ${i}`,
          'test',
          { filePath: `${deepPath}/${i}.js`, line: i }
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Created 1000 deep-path fingerprints: ${totalTime}ms`);

      expect(totalTime).toBeLessThan(2000);
      expect(errors.every(e => e.filePath?.includes(deepPath))).toBe(true);
    });
  });

  describe('Memory Cleanup and Resource Management', () => {
    it('should not accumulate memory leaks during reset operations', async () => {
      // Simulate multiple reset cycles with different workloads
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add some data
        const errors = Array.from({ length: 50 }, (_, i) =>
          tracker.createErrorFingerprint(`Cycle ${cycle} Error ${i}`, 'test')
        );

        for (const error of errors) {
          await tracker.startFixAttempt(error, `Cycle ${cycle} fix`);
          await tracker.completeFixAttempt({
            success: Math.random() > 0.5,
            resolved: Math.random() > 0.5,
          });
        }

        expect(tracker.getHistory().totalAttempts).toBe(50);

        // Reset
        await tracker.reset();

        expect(tracker.getHistory().totalAttempts).toBe(0);
        expect(tracker.getHistory().errorAttemptCounts).toEqual({});
      }

      // Final verification that tracker is clean
      const finalHistory = tracker.getHistory();
      expect(finalHistory.totalAttempts).toBe(0);
      expect(Object.keys(finalHistory.errorAttemptCounts)).toHaveLength(0);
    });
  });
});