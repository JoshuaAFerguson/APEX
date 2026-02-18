/**
 * @fileoverview Performance and Benchmarking Tests for Loading State Fixture
 *
 * This test suite focuses on performance characteristics, memory usage,
 * and scalability of the loading state fixture implementation.
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
} from '../loading-state-fixture.js';

describe('LoadingStateFixture Performance Tests', () => {
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

  describe('Initialization Performance', () => {
    it('should initialize fixture quickly', () => {
      const startTime = performance.now();

      const newFixture = new LoadingStateFixture();

      const initTime = performance.now() - startTime;
      expect(initTime).toBeLessThan(5); // Should initialize in under 5ms

      expect(newFixture.isSetup()).toBe(false);
      expect(newFixture.isLoading()).toBe(false);
    });

    it('should setup with minimal configuration quickly', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Performance Test',
        description: 'Minimal setup performance test',
        scenario: 'api-request',
      };

      const startTime = performance.now();
      await fixture.setup(config);
      const setupTime = performance.now() - startTime;

      expect(setupTime).toBeLessThan(10); // Should setup in under 10ms
      expect(fixture.isSetup()).toBe(true);
    });

    it('should setup with complex configuration efficiently', async () => {
      const complexConfig: LoadingFixtureConfig = {
        name: 'Complex Performance Test',
        description: 'Complex setup performance test',
        scenario: 'file-upload',
        expectedDuration: 5000,
        timeout: 15000,
        useFakeTimers: true,
        initialProgress: 10,
        indicatorType: 'progress',
        customData: {
          metadata: new Array(1000).fill(0).reduce((acc, _, i) => {
            acc[`key_${i}`] = `value_${i}`;
            return acc;
          }, {} as Record<string, string>)
        },
        mockResponses: {
          'https://api.example.com/upload': { status: 'success' },
          'https://api.example.com/validate': { valid: true },
          'https://api.example.com/process': { processed: true }
        },
        cancellable: true,
      };

      const startTime = performance.now();
      await fixture.setup(complexConfig);
      const setupTime = performance.now() - startTime;

      expect(setupTime).toBeLessThan(50); // Should setup in under 50ms even with complex config
      expect(fixture.isSetup()).toBe(true);
    });
  });

  describe('State Management Performance', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'State Performance Test',
        description: 'Testing state management performance',
        scenario: 'api-request',
      };
      await fixture.setup(config);
    });

    it('should handle rapid state transitions efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        fixture.startLoading({ message: `Loading ${i}`, initialProgress: (i % 100) });
        fixture.updateProgress({ percentage: ((i + 1) % 100), message: `Updated ${i}` });
        fixture.finishLoading({ success: true, progress: 100 });
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(0.1); // Less than 0.1ms per state transition
      expect(totalTime).toBeLessThan(100); // Total under 100ms for 1000 iterations
    });

    it('should update progress efficiently with large datasets', () => {
      const largeMessage = 'Loading '.repeat(1000) + 'large dataset...';

      const startTime = performance.now();

      fixture.startLoading({ message: largeMessage, initialProgress: 0 });

      for (let i = 1; i <= 100; i++) {
        fixture.updateProgress({
          percentage: i,
          message: `${largeMessage} ${i}%`,
          phase: i < 25 ? 'initializing' : i < 50 ? 'fetching' : i < 75 ? 'processing' : 'rendering'
        });
      }

      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(50); // Should complete updates in under 50ms
    });
  });

  describe('Request Management Performance', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Request Performance Test',
        description: 'Testing request management performance',
        scenario: 'multiple-requests',
        cancellable: true,
      };
      await fixture.setup(config);
    });

    it('should handle many concurrent requests efficiently', () => {
      const requestCount = 500;
      const requests: PendingRequest[] = [];

      // Create requests
      const createStartTime = performance.now();
      for (let i = 0; i < requestCount; i++) {
        requests.push({
          id: `perf-request-${i}`,
          url: `https://api.example.com/data/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        });
      }
      const createTime = performance.now() - createStartTime;

      // Add requests to fixture
      const addStartTime = performance.now();
      const cancelFunctions = requests.map(request => fixture.simulatePendingRequest(request));
      const addTime = performance.now() - addStartTime;

      expect(createTime).toBeLessThan(10); // Creating requests should be fast
      expect(addTime).toBeLessThan(50); // Adding to fixture should be reasonably fast
      expect(fixture.getPendingRequests()).toHaveLength(requestCount);

      // Cancel all requests
      const cancelStartTime = performance.now();
      cancelFunctions.forEach(cancel => cancel());
      const cancelTime = performance.now() - cancelStartTime;

      expect(cancelTime).toBeLessThan(100); // Cancelling all requests should be fast

      const cancelledCount = fixture.getPendingRequests().filter(req => req.status === 'cancelled').length;
      expect(cancelledCount).toBe(requestCount);
    });

    it('should efficiently query request status', () => {
      const requestCount = 100;

      // Add requests
      for (let i = 0; i < requestCount; i++) {
        fixture.simulatePendingRequest({
          id: `query-test-${i}`,
          url: `https://api.example.com/query/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        });
      }

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const pendingRequests = fixture.getPendingRequests();
        expect(pendingRequests.length).toBe(requestCount);

        // Query specific request
        const targetId = `query-test-${i % requestCount}`;
        const targetRequest = pendingRequests.find(req => req.id === targetId);
        expect(targetRequest).toBeDefined();
      }

      const queryTime = performance.now() - startTime;
      const avgQueryTime = queryTime / iterations;

      expect(avgQueryTime).toBeLessThan(0.5); // Less than 0.5ms per query operation
    });
  });

  describe('Progressive Loading Performance', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Progressive Performance Test',
        description: 'Testing progressive loading performance',
        scenario: 'progressive-load',
        useFakeTimers: true,
      };
      await fixture.setup(config);
    });

    it('should handle large number of loading steps efficiently', async () => {
      const stepCount = 200;
      const steps: LoadingStep[] = [];

      // Create steps
      const createStartTime = performance.now();
      for (let i = 0; i < stepCount; i++) {
        steps.push({
          name: `step-${i}`,
          duration: 10,
          progressAfter: Math.min(100, (i + 1) * (100 / stepCount)),
          message: `Processing step ${i + 1} of ${stepCount}`,
          callback: () => {
            // Minimal work to test callback overhead
            return i * 2;
          },
        });
      }
      const createTime = performance.now() - createStartTime;

      expect(createTime).toBeLessThan(20); // Step creation should be fast

      fixture.startLoading();

      // Execute progressive loading
      const executeStartTime = performance.now();
      await fixture.simulateProgressiveLoading(steps);
      const executeTime = performance.now() - executeStartTime;

      expect(executeTime).toBeLessThan(1000); // Should execute reasonably quickly even with fake timers
      expect(fixture.getLoadingProgress().percentage).toBe(100);
    });

    it('should efficiently handle steps with complex callbacks', async () => {
      const complexSteps: LoadingStep[] = Array.from({ length: 50 }, (_, i) => ({
        name: `complex-step-${i}`,
        duration: 20,
        progressAfter: (i + 1) * 2,
        message: `Complex processing ${i + 1}`,
        callback: () => {
          // Simulate some computational work
          const data = new Array(1000).fill(0).map((_, idx) => ({
            id: idx,
            value: Math.random(),
            computed: idx * i + Math.sqrt(idx)
          }));
          return data.reduce((sum, item) => sum + item.computed, 0);
        },
      }));

      fixture.startLoading();

      const startTime = performance.now();
      await fixture.simulateProgressiveLoading(complexSteps);
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(2000); // Should complete within reasonable time
      expect(fixture.getLoadingProgress().percentage).toBe(100);
    });
  });

  describe('Memory Usage and Cleanup Performance', () => {
    it('should cleanup efficiently after heavy usage', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Cleanup Performance Test',
        description: 'Testing cleanup performance',
        scenario: 'multiple-requests',
        cancellable: true,
      };

      await fixture.setup(config);

      // Add many requests
      const requestCount = 200;
      const requests: PendingRequest[] = [];

      for (let i = 0; i < requestCount; i++) {
        const request: PendingRequest = {
          id: `cleanup-request-${i}`,
          url: `https://api.example.com/cleanup/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        };
        requests.push(request);
        fixture.simulatePendingRequest(request);
      }

      // Add many cleanup tasks
      const cleanupTaskCount = 100;
      for (let i = 0; i < cleanupTaskCount; i++) {
        fixture.addCleanupTask(async () => {
          // Simulate cleanup work
          await new Promise(resolve => setTimeout(resolve, 1));
        });
      }

      // Add many timers
      const timerCount = 50;
      for (let i = 0; i < timerCount; i++) {
        const timer = setTimeout(() => {}, 1000);
        fixture.state.activeTimers.add(timer);
      }

      // Measure cleanup performance
      const cleanupStartTime = performance.now();
      await fixture.teardown();
      const cleanupTime = performance.now() - cleanupStartTime;

      expect(cleanupTime).toBeLessThan(500); // Cleanup should complete in under 500ms
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.state.activeTimers.size).toBe(0);
    });

    it('should handle multiple setup/teardown cycles without memory leaks', async () => {
      const cycles = 50;
      const config: LoadingFixtureConfig = {
        name: 'Memory Cycle Test',
        description: 'Testing for memory leaks',
        scenario: 'file-upload',
        cancellable: true,
      };

      const startTime = performance.now();

      for (let cycle = 0; cycle < cycles; cycle++) {
        await fixture.setup(config);

        // Add some load to each cycle
        fixture.startLoading();
        for (let i = 0; i < 10; i++) {
          fixture.simulatePendingRequest({
            id: `cycle-${cycle}-req-${i}`,
            url: `https://api.example.com/cycle/${cycle}/${i}`,
            method: 'GET',
            status: 'pending',
            startedAt: new Date(),
          });
        }

        fixture.finishLoading({ success: true });
        await fixture.teardown();

        // Verify clean state after each cycle
        expect(fixture.isSetup()).toBe(false);
        expect(fixture.getPendingRequests()).toHaveLength(0);
      }

      const totalTime = performance.now() - startTime;
      const avgCycleTime = totalTime / cycles;

      expect(avgCycleTime).toBeLessThan(20); // Each cycle should average under 20ms
      expect(totalTime).toBeLessThan(1000); // Total time should be under 1 second
    });
  });

  describe('Integration Helper Performance', () => {
    it('should handle rapid hook creation and usage', async () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const { setup, teardown } = createLoadingFixtureHooks('api-request');

        const fixture = await setup();
        expect(fixture.isSetup()).toBe(true);

        fixture.startLoading({ message: `Hook test ${i}` });
        fixture.finishLoading({ success: true });

        await teardown();
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(10); // Less than 10ms per hook cycle
      expect(totalTime).toBeLessThan(1000); // Total under 1 second
    });

    it('should efficiently handle withLoadingFixture wrapper', async () => {
      const iterations = 50;
      const testFn = vi.fn().mockImplementation(async (fixture: LoadingStateFixture) => {
        fixture.startLoading({ message: 'Wrapper test' });

        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 1));

        fixture.finishLoading({ success: true });
        return 'test-result';
      });

      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < iterations; i++) {
        const wrappedTest = withLoadingFixture('api-request', testFn);
        promises.push(wrappedTest());
      }

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(iterations);
      expect(results.every(result => result === 'test-result')).toBe(true);
      expect(testFn).toHaveBeenCalledTimes(iterations);
      expect(totalTime).toBeLessThan(2000); // Should complete within reasonable time
    });

    it('should efficiently handle multi-scenario factory', async () => {
      const scenarios: LoadingScenario[] = [
        'api-request', 'file-upload', 'multiple-requests', 'progressive-load'
      ];

      const createFixture = createMultiLoadingFixture(scenarios);
      const iterations = 20;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const scenario of scenarios) {
          const fixture = await createFixture(scenario);
          expect(fixture.state.config.scenario).toBe(scenario);

          fixture.startLoading({ message: `Multi-scenario test ${i}` });
          fixture.finishLoading({ success: true });

          await fixture.teardown();
        }
      }

      const totalTime = performance.now() - startTime;
      const avgTimePerFixture = totalTime / (iterations * scenarios.length);

      expect(avgTimePerFixture).toBeLessThan(15); // Less than 15ms per fixture
      expect(totalTime).toBeLessThan(1200); // Total under 1.2 seconds
    });
  });

  describe('Validation Performance', () => {
    it('should perform validation efficiently', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Validation Performance Test',
        description: 'Testing validation performance',
        scenario: 'multiple-requests',
        expectedDuration: 1000,
        timeout: 5000,
        cancellable: true,
      };

      await fixture.setup(config);
      fixture.startLoading();

      // Add complexity for validation
      for (let i = 0; i < 50; i++) {
        fixture.simulatePendingRequest({
          id: `validation-request-${i}`,
          url: `https://api.example.com/validation/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        });
      }

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = await fixture.validate();
        expect(result.valid).toBe(true);
      }

      const totalTime = performance.now() - startTime;
      const avgValidationTime = totalTime / iterations;

      expect(avgValidationTime).toBeLessThan(2); // Less than 2ms per validation
      expect(totalTime).toBeLessThan(200); // Total under 200ms
    });

    it('should handle validation with errors efficiently', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Error Validation Performance',
        description: 'Testing validation performance with errors',
        scenario: 'api-request',
        expectedDuration: 1000,
        timeout: 500, // Intentionally less than expected duration
      };

      await fixture.setup(config);
      fixture.startLoading();

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = await fixture.validate();
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }

      const totalTime = performance.now() - startTime;
      const avgValidationTime = totalTime / iterations;

      expect(avgValidationTime).toBeLessThan(5); // Even with errors, should be under 5ms
      expect(totalTime).toBeLessThan(250); // Total under 250ms
    });
  });
});