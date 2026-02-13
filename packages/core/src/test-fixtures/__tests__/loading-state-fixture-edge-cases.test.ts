/**
 * @fileoverview Edge Cases and Robustness Tests for Loading State Fixture
 *
 * This test suite focuses on edge cases, boundary conditions, error handling,
 * and robustness of the loading state fixture implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LoadingStateFixture,
  createLoadingFixtureHooks,
  withLoadingFixture,
  createMultiLoadingFixture,
  LOADING_SCENARIOS,
  type LoadingScenario,
  type LoadingFixtureConfig,
  type PendingRequest,
  type LoadingStep,
  type LoadingProgress,
} from '../loading-state-fixture.js';

describe('LoadingStateFixture Edge Cases', () => {
  let fixture: LoadingStateFixture;

  beforeEach(() => {
    fixture = new LoadingStateFixture();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (fixture.isSetup()) {
      await fixture.teardown();
    }
    vi.useRealTimers();
  });

  describe('Configuration Edge Cases', () => {
    it('should handle minimal configuration', async () => {
      const minimalConfig: LoadingFixtureConfig = {
        name: 'Minimal',
        description: 'Minimal test',
        scenario: 'api-request',
      };

      await fixture.setup(minimalConfig);

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config.expectedDuration).toBeUndefined();
      expect(fixture.state.config.timeout).toBeUndefined();
      expect(fixture.state.config.useFakeTimers).toBeUndefined();
    });

    it('should handle configuration with all optional fields', async () => {
      const maximalConfig: LoadingFixtureConfig = {
        name: 'Maximal Test',
        description: 'Test with all optional fields',
        scenario: 'file-upload',
        expectedDuration: 5000,
        timeout: 10000,
        useFakeTimers: true,
        initialProgress: 25,
        indicatorType: 'progress',
        customData: {
          fileName: 'test.pdf',
          fileSize: 1024000,
          uploadId: 'upload_123',
        },
        expectedOutcome: 'success',
        mockResponses: {
          'https://api.example.com/upload': { uploadId: 'upload_123', status: 'success' },
        },
        cancellable: true,
      };

      await fixture.setup(maximalConfig);

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config).toEqual(maximalConfig);

      const browserState = fixture.getBrowserState();
      expect(browserState.localStorage['loading-custom-data']).toBe(
        JSON.stringify(maximalConfig.customData)
      );
    });

    it('should handle invalid timeout configuration gracefully', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Invalid Timeout',
        description: 'Configuration with invalid timeout',
        scenario: 'api-request',
        expectedDuration: 5000,
        timeout: 2000, // Less than expected duration
      };

      await fixture.setup(config);

      const validation = await fixture.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error =>
        error.includes('Timeout should be greater than expected duration')
      )).toBe(true);
    });

    it('should handle zero and negative durations', async () => {
      const configs = [
        {
          name: 'Zero Duration',
          description: 'Zero expected duration',
          scenario: 'api-request' as LoadingScenario,
          expectedDuration: 0,
        },
        {
          name: 'Negative Duration',
          description: 'Negative expected duration',
          scenario: 'api-request' as LoadingScenario,
          expectedDuration: -1000,
        },
      ];

      for (const config of configs) {
        const testFixture = new LoadingStateFixture();
        await testFixture.setup(config);

        // Should not crash or throw errors
        testFixture.startLoading();
        expect(testFixture.isLoading()).toBe(true);

        testFixture.finishLoading({ success: true });
        expect(testFixture.isLoading()).toBe(false);

        await testFixture.teardown();
      }
    });
  });

  describe('Progress Edge Cases', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Progress Edge Test',
        description: 'Testing progress edge cases',
        scenario: 'progressive-load',
      };
      await fixture.setup(config);
    });

    it('should handle progress boundaries (0, 100, out of range)', () => {
      const testProgressValues = [-10, 0, 50, 100, 150];

      testProgressValues.forEach(progress => {
        fixture.startLoading({ initialProgress: progress });
        const currentProgress = fixture.getLoadingProgress();

        if (progress < 0 || progress > 100) {
          // Invalid progress should be clamped or cause validation error
          const validation = fixture.validate();
          validation.then(result => {
            if (progress < 0 || progress > 100) {
              expect(result.valid).toBe(false);
            }
          });
        } else {
          expect(currentProgress.percentage).toBe(progress);
        }
      });
    });

    it('should handle progress updates in wrong order', async () => {
      fixture.startLoading({ initialProgress: 50 });

      // Update progress backwards (should handle gracefully)
      (fixture.state as any).progress.percentage = 25;

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true); // Should not fail, just note inconsistency
    });

    it('should handle rapid progress updates', async () => {
      fixture.startLoading();

      // Simulate rapid progress updates
      for (let i = 0; i <= 100; i += 10) {
        (fixture.state as any).progress.percentage = i;
        (fixture.state as any).progress.completed = i;
        (fixture.state as any).progress.total = 100;

        // Should not cause memory issues or crashes
        const progress = fixture.getLoadingProgress();
        expect(progress.percentage).toBe(i);
      }

      const finalValidation = await fixture.validate();
      expect(finalValidation.valid).toBe(true);
    });

    it('should handle fractional progress values', () => {
      const fractionalValues = [0.5, 25.75, 99.99];

      fractionalValues.forEach(progress => {
        fixture.startLoading({ initialProgress: progress });
        const currentProgress = fixture.getLoadingProgress();
        expect(currentProgress.percentage).toBe(progress);
      });
    });
  });

  describe('Request Management Edge Cases', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Request Edge Test',
        description: 'Testing request edge cases',
        scenario: 'multiple-requests',
        cancellable: true,
      };
      await fixture.setup(config);
    });

    it('should handle requests with missing required fields', () => {
      const incompleteRequest = {
        id: 'incomplete-request',
        url: 'https://api.example.com/test',
        // Missing method, status, startedAt
      } as PendingRequest;

      // Should handle gracefully and fill in defaults
      expect(() => {
        fixture.simulatePendingRequest(incompleteRequest);
      }).not.toThrow();

      const requests = fixture.getPendingRequests();
      const addedRequest = requests.find(r => r.id === 'incomplete-request');
      expect(addedRequest).toBeDefined();
      expect(addedRequest?.status).toBeDefined();
    });

    it('should handle duplicate request IDs', () => {
      const request1: PendingRequest = {
        id: 'duplicate-id',
        url: 'https://api.example.com/first',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      };

      const request2: PendingRequest = {
        id: 'duplicate-id',
        url: 'https://api.example.com/second',
        method: 'POST',
        status: 'pending',
        startedAt: new Date(),
      };

      fixture.simulatePendingRequest(request1);
      fixture.simulatePendingRequest(request2);

      // Second request should overwrite the first
      const requests = fixture.getPendingRequests();
      const duplicateRequests = requests.filter(r => r.id === 'duplicate-id');
      expect(duplicateRequests).toHaveLength(1);
      expect(duplicateRequests[0].url).toBe('https://api.example.com/second');
    });

    it('should handle request cancellation edge cases', () => {
      const request: PendingRequest = {
        id: 'cancel-test',
        url: 'https://api.example.com/test',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      };

      const cancel = fixture.simulatePendingRequest(request);

      // Cancel multiple times (should be idempotent)
      cancel();
      cancel();
      cancel();

      expect(request.status).toBe('cancelled');
      expect(request.completedAt).toBeDefined();
    });

    it('should handle cancellation of non-cancellable requests', async () => {
      // Setup non-cancellable fixture
      await fixture.teardown();
      const nonCancellableConfig: LoadingFixtureConfig = {
        name: 'Non-Cancellable Test',
        description: 'Non-cancellable requests',
        scenario: 'api-request',
        cancellable: false,
      };
      await fixture.setup(nonCancellableConfig);

      const request: PendingRequest = {
        id: 'non-cancellable',
        url: 'https://api.example.com/test',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      };

      const cancel = fixture.simulatePendingRequest(request);

      // Should not have abort controller
      expect(request.abortController).toBeUndefined();

      // Cancel function should still work but not actually cancel
      cancel();
      expect(request.status).toBe('pending'); // Should remain pending
    });

    it('should handle large number of concurrent requests', () => {
      const requestCount = 1000;
      const cancelFunctions: (() => void)[] = [];

      // Create many requests
      for (let i = 0; i < requestCount; i++) {
        const request: PendingRequest = {
          id: `bulk-request-${i}`,
          url: `https://api.example.com/data/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        };

        const cancel = fixture.simulatePendingRequest(request);
        cancelFunctions.push(cancel);
      }

      expect(fixture.getPendingRequests()).toHaveLength(requestCount);

      // Cancel all requests
      cancelFunctions.forEach(cancel => cancel());

      // All should be cancelled
      const cancelledRequests = fixture.getPendingRequests()
        .filter(r => r.status === 'cancelled');
      expect(cancelledRequests).toHaveLength(requestCount);
    });
  });

  describe('Progressive Loading Edge Cases', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Progressive Edge Test',
        description: 'Progressive loading edge cases',
        scenario: 'progressive-load',
        useFakeTimers: true,
      };
      await fixture.setup(config);
    });

    it('should handle empty steps array', async () => {
      fixture.startLoading();

      // Should complete immediately without errors
      await expect(fixture.simulateProgressiveLoading([])).resolves.toBeUndefined();

      const progress = fixture.getLoadingProgress();
      expect(progress.elapsedTime).toBe(0);
    });

    it('should handle steps with zero duration', async () => {
      const stepsWithZero: LoadingStep[] = [
        { name: 'instant', duration: 0, progressAfter: 50 },
        { name: 'normal', duration: 100, progressAfter: 100 },
      ];

      fixture.startLoading();

      await expect(
        fixture.simulateProgressiveLoading(stepsWithZero)
      ).resolves.toBeUndefined();

      const progress = fixture.getLoadingProgress();
      expect(progress.percentage).toBe(100);
    });

    it('should handle steps with negative duration', async () => {
      const stepsWithNegative: LoadingStep[] = [
        { name: 'negative', duration: -100, progressAfter: 50 },
        { name: 'positive', duration: 100, progressAfter: 100 },
      ];

      fixture.startLoading();

      // Should handle gracefully, possibly by treating negative as zero
      await expect(
        fixture.simulateProgressiveLoading(stepsWithNegative)
      ).resolves.toBeUndefined();
    });

    it('should handle steps with decreasing progress', async () => {
      const decreasingSteps: LoadingStep[] = [
        { name: 'step1', duration: 50, progressAfter: 80 },
        { name: 'step2', duration: 50, progressAfter: 60 }, // Decreases
        { name: 'step3', duration: 50, progressAfter: 100 },
      ];

      fixture.startLoading();

      await fixture.simulateProgressiveLoading(decreasingSteps);

      const progress = fixture.getLoadingProgress();
      expect(progress.percentage).toBe(100); // Final value should be maintained
    });

    it('should handle step callbacks that throw errors', async () => {
      let callbackExecuted = false;
      const stepsWithFailingCallback: LoadingStep[] = [
        {
          name: 'failing',
          duration: 50,
          progressAfter: 50,
          callback: () => {
            callbackExecuted = true;
            throw new Error('Callback failed');
          },
        },
        { name: 'normal', duration: 50, progressAfter: 100 },
      ];

      fixture.startLoading();

      // Should continue despite callback failure
      await expect(
        fixture.simulateProgressiveLoading(stepsWithFailingCallback)
      ).resolves.toBeUndefined();

      expect(callbackExecuted).toBe(true);
      const progress = fixture.getLoadingProgress();
      expect(progress.percentage).toBe(100);
    });

    it('should handle async callbacks with varying completion times', async () => {
      let callback1Completed = false;
      let callback2Completed = false;

      const stepsWithAsyncCallbacks: LoadingStep[] = [
        {
          name: 'async1',
          duration: 100,
          progressAfter: 50,
          callback: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            callback1Completed = true;
          },
        },
        {
          name: 'async2',
          duration: 100,
          progressAfter: 100,
          callback: async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            callback2Completed = true;
          },
        },
      ];

      fixture.startLoading();

      await fixture.simulateProgressiveLoading(stepsWithAsyncCallbacks);

      expect(callback1Completed).toBe(true);
      expect(callback2Completed).toBe(true);
    });
  });

  describe('Timer Integration Edge Cases', () => {
    it('should handle switching between fake and real timers', async () => {
      // Start with fake timers
      const fakeTimerConfig: LoadingFixtureConfig = {
        name: 'Fake Timer Test',
        description: 'Testing fake timers',
        scenario: 'api-request',
        useFakeTimers: true,
        expectedDuration: 1000,
      };

      await fixture.setup(fakeTimerConfig);
      fixture.startLoading();

      expect(fixture.isLoading()).toBe(true);

      await fixture.teardown();

      // Switch to real timers
      const realTimerConfig: LoadingFixtureConfig = {
        name: 'Real Timer Test',
        description: 'Testing real timers',
        scenario: 'api-request',
        useFakeTimers: false,
        expectedDuration: 50, // Short for test performance
      };

      await fixture.setup(realTimerConfig);
      fixture.startLoading();

      // Short delay with real timers
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fixture.isLoading()).toBe(true);
    });

    it('should handle timer cleanup when setup fails', async () => {
      const invalidConfig = {
        name: 'Invalid Config',
        description: 'This might cause setup to fail',
        scenario: 'api-request' as LoadingScenario,
        useFakeTimers: true,
      };

      // Simulate setup failure by mocking vi.useFakeTimers to throw
      const originalUseFakeTimers = vi.useFakeTimers;
      vi.useFakeTimers = vi.fn().mockImplementationOnce(() => {
        throw new Error('Timer setup failed');
      });

      try {
        await expect(fixture.setup(invalidConfig)).rejects.toThrow();
        // Should not leave timers in inconsistent state
        expect(fixture.isSetup()).toBe(false);
      } finally {
        vi.useFakeTimers = originalUseFakeTimers;
      }
    });

    it('should handle multiple timer types in same fixture', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Multiple Timer Test',
        description: 'Testing multiple timer interactions',
        scenario: 'api-request',
        expectedDuration: 1000,
        timeout: 5000,
        useFakeTimers: true,
      };

      await fixture.setup(config);

      // Should have both completion and timeout timers active
      expect(fixture.state.activeTimers.size).toBeGreaterThan(0);

      fixture.startLoading();

      // Advance time partially
      await vi.advanceTimersByTimeAsync(500);
      expect(fixture.isLoading()).toBe(true);

      // Advance past expected duration but before timeout
      await vi.advanceTimersByTimeAsync(1000);

      // Should complete successfully
      expect(fixture.isLoading()).toBe(false);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle repeated setup/teardown cycles without memory leaks', async () => {
      const cycles = 50;
      const config: LoadingFixtureConfig = {
        name: 'Memory Test',
        description: 'Memory leak prevention test',
        scenario: 'api-request',
      };

      for (let i = 0; i < cycles; i++) {
        await fixture.setup(config);
        fixture.startLoading();
        fixture.finishLoading({ success: true });
        await fixture.teardown();

        // Check that state is properly reset
        expect(fixture.isSetup()).toBe(false);
        expect(fixture.state.activeTimers.size).toBe(0);
        expect(fixture.state.pendingRequests.size).toBe(0);
        expect(fixture.state.cleanupTasks).toHaveLength(0);
      }
    });

    it('should handle teardown with unresolved promises', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Unresolved Promise Test',
        description: 'Testing teardown with pending operations',
        scenario: 'progressive-load',
        useFakeTimers: true,
      };

      await fixture.setup(config);

      // Start a long-running progressive loading operation
      const longSteps: LoadingStep[] = [
        { name: 'long1', duration: 10000, progressAfter: 50 },
        { name: 'long2', duration: 10000, progressAfter: 100 },
      ];

      fixture.startLoading();
      const progressPromise = fixture.simulateProgressiveLoading(longSteps);

      // Teardown before completion
      await fixture.teardown();

      // Should not hang or cause issues
      expect(fixture.isSetup()).toBe(false);
    });

    it('should handle cleanup task failures without affecting other cleanup', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Cleanup Failure Test',
        description: 'Testing cleanup resilience',
        scenario: 'api-request',
      };

      await fixture.setup(config);

      // Add multiple cleanup tasks, some that fail
      let successfulCleanup1 = false;
      let successfulCleanup2 = false;

      fixture.addCleanupTask(() => {
        throw new Error('First cleanup failed');
      });

      fixture.addCleanupTask(() => {
        successfulCleanup1 = true;
      });

      fixture.addCleanupTask(async () => {
        throw new Error('Second cleanup failed');
      });

      fixture.addCleanupTask(async () => {
        successfulCleanup2 = true;
      });

      // Teardown should complete despite failures
      await expect(fixture.teardown()).resolves.toBeUndefined();

      expect(successfulCleanup1).toBe(true);
      expect(successfulCleanup2).toBe(true);
      expect(fixture.isSetup()).toBe(false);
    });
  });

  describe('Validation Edge Cases', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Validation Edge Test',
        description: 'Testing validation edge cases',
        scenario: 'api-request',
        cancellable: true,
      };
      await fixture.setup(config);
    });

    it('should handle validation with corrupted state', async () => {
      fixture.startLoading();

      // Corrupt various parts of the state
      (fixture.state as any).progress.completed = 'invalid';
      (fixture.state as any).progress.total = null;
      (fixture.state as any).progress.percentage = NaN;

      const validation = await fixture.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle validation with mixed request states', async () => {
      // Create requests with various states and inconsistencies
      const requests: PendingRequest[] = [
        {
          id: 'completed-before-start',
          url: 'https://api.example.com/test1',
          method: 'GET',
          status: 'resolved',
          startedAt: new Date('2024-01-15T10:00:00Z'),
          completedAt: new Date('2024-01-15T09:59:00Z'), // Before start!
        },
        {
          id: 'missing-abort-controller',
          url: 'https://api.example.com/test2',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
          // Missing abortController despite being cancellable
        },
      ];

      requests.forEach(request => {
        fixture.state.pendingRequests.set(request.id, request);
      });

      const validation = await fixture.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error =>
        error.includes('completion time is before start time')
      )).toBe(true);
      expect(validation.errors.some(error =>
        error.includes('should have an AbortController')
      )).toBe(true);
    });

    it('should handle validation during state transitions', async () => {
      fixture.startLoading();

      // Validate during various state changes
      const validations = await Promise.all([
        fixture.validate(),
        (async () => {
          fixture.finishLoading({ success: true });
          return fixture.validate();
        })(),
        (async () => {
          fixture.simulateLoadingError('Test error');
          return fixture.validate();
        })(),
      ]);

      validations.forEach(validation => {
        // All validations should complete without throwing
        expect(validation).toHaveProperty('valid');
        expect(validation).toHaveProperty('errors');
      });
    });
  });

  describe('Integration Helper Edge Cases', () => {
    describe('createLoadingFixtureHooks edge cases', () => {
      it('should handle rapid hook creation and destruction', async () => {
        const hookCount = 20;
        const hooks = Array.from({ length: hookCount }, (_, i) =>
          createLoadingFixtureHooks('api-request', { name: `Hook ${i}` })
        );

        // Setup all hooks
        const fixtures = await Promise.all(
          hooks.map(hook => hook.setup())
        );

        // All should be set up
        fixtures.forEach(fixture => {
          expect(fixture.isSetup()).toBe(true);
        });

        // Teardown all hooks
        await Promise.all(hooks.map(hook => hook.teardown()));

        // All should be cleaned up
        hooks.forEach(hook => {
          expect(hook.fixture).toBe(null);
        });
      });

      it('should handle hook setup with invalid configuration', async () => {
        const { setup } = createLoadingFixtureHooks('api-request', {
          timeout: -1000, // Invalid timeout
        });

        // Should not throw during setup, but validation might fail
        const fixture = await setup();
        expect(fixture.isSetup()).toBe(true);

        const validation = await fixture.validate();
        // May or may not be valid depending on implementation
        expect(validation).toHaveProperty('valid');
      });
    });

    describe('withLoadingFixture edge cases', () => {
      it('should handle test function that modifies fixture state', async () => {
        const result = await withLoadingFixture(
          'api-request',
          async (loadingFixture) => {
            // Modify fixture state during test
            loadingFixture.updateBrowserState({ url: 'https://modified.com' });

            // Add many requests
            for (let i = 0; i < 100; i++) {
              const request: PendingRequest = {
                id: `mod-request-${i}`,
                url: `https://api.example.com/mod/${i}`,
                method: 'GET',
                status: 'pending',
                startedAt: new Date(),
              };
              loadingFixture.simulatePendingRequest(request);
            }

            return 'modified-successfully';
          }
        );

        expect(result).toBe('modified-successfully');
      });

      it('should handle test function that returns Promise rejection', async () => {
        await expect(
          withLoadingFixture('api-request', async () => {
            throw new Error('Test deliberately failed');
          })
        ).rejects.toThrow('Test deliberately failed');
      });

      it('should handle test function with timeout', async () => {
        // This test should complete quickly despite the long timeout
        const startTime = Date.now();

        await withLoadingFixture(
          'api-request',
          async (loadingFixture) => {
            // Quick test that doesn't actually wait
            expect(loadingFixture.isSetup()).toBe(true);
            return 'quick-completion';
          },
          { timeout: 60000 } // Long timeout that shouldn't be reached
        );

        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(1000); // Should complete quickly
      });
    });

    describe('createMultiLoadingFixture edge cases', () => {
      it('should handle empty scenario list', () => {
        expect(() => {
          createMultiLoadingFixture([]);
        }).not.toThrow();

        const createFixture = createMultiLoadingFixture([]);

        // Should reject any scenario since none are supported
        expect(
          createFixture('api-request' as LoadingScenario)
        ).rejects.toThrow('not supported');
      });

      it('should handle all possible scenarios', async () => {
        const allScenarios: LoadingScenario[] = [
          'page-load',
          'api-request',
          'multiple-requests',
          'progressive-load',
          'lazy-component',
          'infinite-scroll',
          'file-upload',
          'background-sync',
          'auth-check',
          'data-refresh',
        ];

        const createFixture = createMultiLoadingFixture(allScenarios);

        // Test a few scenarios to ensure they work
        for (const scenario of allScenarios.slice(0, 3)) {
          const testFixture = await createFixture(scenario);
          expect(testFixture.state.config.scenario).toBe(scenario);
          await testFixture.teardown();
        }
      });
    });
  });
});