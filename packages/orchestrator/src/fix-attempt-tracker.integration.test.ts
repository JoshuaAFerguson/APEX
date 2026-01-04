import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FixAttemptTracker, FixAttemptTrackerOptions } from './fix-attempt-tracker';
import { TaskStore } from './store';
import {
  FixAttempt,
  FixAttemptHistory,
  ErrorFingerprint,
  TaskStatus,
  TaskUsage,
} from '@apexcli/core';

/**
 * Integration tests for FixAttemptTracker
 * These tests focus on real-world scenarios and integration with other components
 */

// Mock TaskStore with realistic behavior
const createMockTaskStore = () => {
  const store: Partial<TaskStore> = {
    getFixAttemptHistory: vi.fn(),
    addFixAttempt: vi.fn(),
    clearFixAttempts: vi.fn(),
  };
  return store as TaskStore;
};

describe('FixAttemptTracker Integration Tests', () => {
  let tracker: FixAttemptTracker;
  let store: TaskStore;
  let options: FixAttemptTrackerOptions;

  beforeEach(async () => {
    vi.clearAllMocks();
    store = createMockTaskStore();

    options = {
      taskId: 'integration-test-task',
      store,
      config: {
        maxAttemptsPerError: 3,
        maxTotalAttempts: 10,
        backoffStrategy: 'exponential',
        baseDelayMs: 100, // Shorter delays for testing
        maxDelayMs: 5000,
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

  describe('Real-world Error Handling Scenarios', () => {
    it('should handle typical TypeScript compilation errors', async () => {
      const typescriptErrors = [
        tracker.createErrorFingerprint(
          'TS2322: Type "string" is not assignable to type "number"',
          'compilation',
          { filePath: 'src/utils.ts', line: 42, code: 'TS2322' }
        ),
        tracker.createErrorFingerprint(
          'TS2339: Property "foo" does not exist on type "{}"',
          'compilation',
          { filePath: 'src/components/Button.tsx', line: 15, code: 'TS2339' }
        ),
        tracker.createErrorFingerprint(
          'TS2304: Cannot find name "React"',
          'compilation',
          { filePath: 'src/App.tsx', line: 1, code: 'TS2304' }
        ),
      ];

      // Simulate fixing these errors one by one
      for (const error of typescriptErrors) {
        await tracker.startFixAttempt(error, 'Fix TypeScript error', {
          agent: 'developer',
          stage: 'compilation',
        });

        await tracker.completeFixAttempt({
          success: true,
          resolved: true,
        });
      }

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(3);
      expect(history.resolvedCount).toBe(3);
      expect(history.failedCount).toBe(0);
    });

    it('should handle build pipeline errors with retries', async () => {
      const buildError = tracker.createErrorFingerprint(
        'Module not found: Error: Can\'t resolve \'./missing-file\'',
        'bundler',
        { filePath: 'webpack.config.js' }
      );

      // First attempt fails
      await tracker.startFixAttempt(buildError, 'Add missing import');
      await tracker.completeFixAttempt({
        success: false,
        resolved: false,
        reason: 'File still missing',
      });

      // Second attempt fails with different approach
      await tracker.startFixAttempt(buildError, 'Create missing file');
      await tracker.completeFixAttempt({
        success: false,
        resolved: false,
        reason: 'Wrong file location',
      });

      // Third attempt succeeds
      await tracker.startFixAttempt(buildError, 'Fix file path and create file');
      await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(3);
      expect(history.resolvedCount).toBe(1);
      expect(history.failedCount).toBe(2);
      expect(history.errorAttemptCounts[buildError.hash]).toBe(3);
    });

    it('should handle cascading error chains', async () => {
      const primaryError = tracker.createErrorFingerprint(
        'ReferenceError: Cannot access "myVar" before initialization',
        'runtime',
        { filePath: 'src/main.js', line: 10 }
      );

      const secondaryError = tracker.createErrorFingerprint(
        'TypeError: Cannot read properties of undefined',
        'runtime',
        { filePath: 'src/main.js', line: 15 }
      );

      // Fix primary error but introduce secondary error
      await tracker.startFixAttempt(primaryError, 'Initialize variable earlier');
      await tracker.completeFixAttempt({
        success: true,
        resolved: false,
        newErrors: [secondaryError],
        reason: 'Fixed initialization but created null reference',
      });

      // Fix secondary error successfully
      await tracker.startFixAttempt(secondaryError, 'Add null check');
      await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(2);
      expect(history.resolvedCount).toBe(1);
      expect(history.failedCount).toBe(1);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle many rapid fix attempts efficiently', async () => {
      const errors = Array.from({ length: 20 }, (_, i) =>
        tracker.createErrorFingerprint(
          `Test error ${i}`,
          'test',
          { line: i }
        )
      );

      const startTime = Date.now();

      // Rapidly process many errors
      for (const error of errors) {
        await tracker.startFixAttempt(error, `Fix ${error.hash}`);
        await tracker.completeFixAttempt({
          success: Math.random() > 0.3, // 70% success rate
          resolved: Math.random() > 0.3,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust based on expected performance)
      expect(duration).toBeLessThan(1000); // 1 second for 20 errors

      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(20);
      expect(history.resolvedCount + history.failedCount).toBe(20);
    });

    it('should handle memory efficiently with large histories', async () => {
      // Simulate loading large existing history
      const largeHistory: FixAttemptHistory = {
        entries: Array.from({ length: 1000 }, (_, i) => ({
          id: `large-test-${i}`,
          taskId: 'integration-test-task',
          attemptNumber: i + 1,
          error: {
            hash: `hash-${i % 100}`, // 100 different error types
            message: `Error message ${i}`,
            category: 'test',
          },
          startedAt: new Date(Date.now() - (1000 - i) * 1000),
          completedAt: new Date(Date.now() - (1000 - i - 1) * 1000),
          approach: `Approach ${i}`,
          result: {
            success: i % 3 !== 0,
            resolved: i % 4 !== 0,
          },
        })),
        totalAttempts: 1000,
        resolvedCount: 750,
        failedCount: 250,
        errorAttemptCounts: Array.from({ length: 100 }, (_, i) => [`hash-${i}`, 10])
          .reduce((acc, [hash, count]) => ({ ...acc, [hash]: count }), {}),
      };

      vi.mocked(store.getFixAttemptHistory).mockResolvedValue(largeHistory);

      const startTime = Date.now();
      const largeTracker = new FixAttemptTracker(options);
      await largeTracker.initialize();
      const initTime = Date.now() - startTime;

      // Initialization should be reasonably fast even with large history
      expect(initTime).toBeLessThan(100); // 100ms

      const history = largeTracker.getHistory();
      expect(history.totalAttempts).toBe(1000);

      // Loop detection should still work efficiently
      const loopResult = largeTracker.detectLoop();
      expect(loopResult).toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from store failures gracefully', async () => {
      // Simulate store failure during persistence
      vi.mocked(store.addFixAttempt).mockRejectedValueOnce(new Error('Database connection failed'));

      const error = tracker.createErrorFingerprint('Store failure test', 'test');

      await tracker.startFixAttempt(error, 'Test store failure recovery');

      // Should propagate the error but maintain internal state
      await expect(
        tracker.completeFixAttempt({
          success: true,
          resolved: true,
        })
      ).rejects.toThrow('Database connection failed');

      // But internal state should be consistent
      const history = tracker.getHistory();
      expect(history.totalAttempts).toBe(1);

      // Subsequent operations should work when store is restored
      vi.mocked(store.addFixAttempt).mockResolvedValue(undefined);

      await tracker.startFixAttempt(error, 'Test after recovery');
      await expect(
        tracker.completeFixAttempt({
          success: true,
          resolved: true,
        })
      ).resolves.toBeDefined();
    });

    it('should handle corrupted history data gracefully', async () => {
      // Simulate corrupted history from store
      vi.mocked(store.getFixAttemptHistory).mockResolvedValue({
        entries: [
          // Corrupted entry with missing fields
          {
            id: 'corrupted-1',
            taskId: 'integration-test-task',
            attemptNumber: 1,
            error: {
              hash: 'corrupted-hash',
              message: '',
              category: '',
            },
            startedAt: new Date('invalid-date'),
            approach: '',
            result: {
              success: false,
              resolved: false,
            },
          } as any,
        ],
        totalAttempts: 1,
        resolvedCount: 0,
        failedCount: 1,
        errorAttemptCounts: { 'corrupted-hash': 1 },
      });

      // Should still initialize without throwing
      const corruptedTracker = new FixAttemptTracker(options);
      await expect(corruptedTracker.initialize()).resolves.not.toThrow();

      // Should still be able to add new attempts
      const newError = corruptedTracker.createErrorFingerprint('New error after corruption', 'test');
      await expect(
        corruptedTracker.startFixAttempt(newError, 'Test after corruption')
      ).resolves.toBeDefined();
    });
  });

  describe('Integration with TaskStore', () => {
    it('should properly interact with store lifecycle', async () => {
      const error = tracker.createErrorFingerprint('Store integration test', 'test');

      // Starting an attempt should not call store yet
      await tracker.startFixAttempt(error, 'Store integration test');
      expect(store.addFixAttempt).not.toHaveBeenCalled();

      // Completing should call store
      const completed = await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      expect(store.addFixAttempt).toHaveBeenCalledWith(
        'integration-test-task',
        completed
      );
      expect(store.addFixAttempt).toHaveBeenCalledTimes(1);
    });

    it('should respect store data on initialization', async () => {
      const existingHistory: FixAttemptHistory = {
        entries: [
          {
            id: 'existing-1',
            taskId: 'integration-test-task',
            attemptNumber: 1,
            error: {
              hash: 'existing-hash',
              message: 'Existing error',
              category: 'test',
            },
            startedAt: new Date('2024-01-01T10:00:00Z'),
            completedAt: new Date('2024-01-01T10:01:00Z'),
            approach: 'Existing approach',
            result: {
              success: false,
              resolved: false,
            },
          },
        ],
        totalAttempts: 1,
        resolvedCount: 0,
        failedCount: 1,
        errorAttemptCounts: { 'existing-hash': 1 },
        currentError: {
          fingerprint: {
            hash: 'existing-hash',
            message: 'Existing error',
            category: 'test',
          },
          attemptCount: 1,
          firstSeenAt: new Date('2024-01-01T10:00:00Z'),
          lastAttemptAt: new Date('2024-01-01T10:00:00Z'),
        },
      };

      vi.mocked(store.getFixAttemptHistory).mockResolvedValue(existingHistory);

      const newTracker = new FixAttemptTracker(options);
      await newTracker.initialize();

      const history = newTracker.getHistory();
      expect(history.totalAttempts).toBe(1);
      expect(history.currentError).toBeDefined();
      expect(history.currentError!.fingerprint.hash).toBe('existing-hash');

      // Should respect existing attempt counts for decision making
      const existingError = newTracker.createErrorFingerprint('Existing error', 'test');
      const decision = newTracker.shouldAttemptFix(existingError);
      expect(decision.attemptCount).toBeGreaterThan(1);
    });

    it('should handle store reset operations correctly', async () => {
      const error = tracker.createErrorFingerprint('Reset test', 'test');

      // Add some history
      await tracker.startFixAttempt(error, 'Before reset');
      await tracker.completeFixAttempt({
        success: false,
        resolved: false,
      });

      expect(tracker.getHistory().totalAttempts).toBe(1);

      // Reset should clear store and internal state
      await tracker.reset();

      expect(store.clearFixAttempts).toHaveBeenCalledWith('integration-test-task');
      expect(tracker.getHistory().totalAttempts).toBe(0);
      expect(tracker.getHistory().errorAttemptCounts).toEqual({});
    });
  });

  describe('Event System Integration', () => {
    it('should emit events in correct sequence for complex scenarios', async () => {
      const events: Array<{ type: string; data: any }> = [];

      tracker.on('fix:started', (attempt) => events.push({ type: 'started', data: attempt.id }));
      tracker.on('fix:completed', (attempt) => events.push({ type: 'completed', data: attempt.id }));
      tracker.on('fix:resolved', (attempt) => events.push({ type: 'resolved', data: attempt.id }));
      tracker.on('fix:failed', (attempt) => events.push({ type: 'failed', data: attempt.id }));
      tracker.on('error:max-attempts', (error) => events.push({ type: 'max-attempts', data: error.hash }));
      tracker.on('loop:detected', (result) => events.push({ type: 'loop-detected', data: result.loopType }));

      const error = tracker.createErrorFingerprint('Event integration test', 'test');

      // First attempt - successful
      await tracker.startFixAttempt(error, 'First attempt');
      await tracker.completeFixAttempt({
        success: true,
        resolved: true,
      });

      expect(events).toEqual([
        { type: 'started', data: expect.any(String) },
        { type: 'completed', data: expect.any(String) },
        { type: 'resolved', data: expect.any(String) },
      ]);

      events.length = 0; // Clear events

      // Create new error that will hit max attempts
      const maxError = tracker.createErrorFingerprint('Max attempts test', 'test');

      // Add attempts up to the limit
      for (let i = 0; i < 3; i++) {
        await tracker.startFixAttempt(maxError, `Attempt ${i + 1}`);
        await tracker.completeFixAttempt({
          success: false,
          resolved: false,
        });
      }

      // Clear events and try one more time (should trigger max-attempts)
      events.length = 0;
      const decision = tracker.shouldAttemptFix(maxError);

      expect(decision.shouldAttempt).toBe(false);
      expect(events).toContainEqual({ type: 'max-attempts', data: maxError.hash });
    });
  });
});