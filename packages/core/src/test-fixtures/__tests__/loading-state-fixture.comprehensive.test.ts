/**
 * @fileoverview Comprehensive Tests for Loading State Fixture
 *
 * This test suite provides additional comprehensive coverage for the loading state fixture,
 * focusing on complex scenarios, performance characteristics, and real-world usage patterns.
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
  type LoadingValidationResult,
} from '../loading-state-fixture.js';

describe('LoadingStateFixture Comprehensive Tests', () => {
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

  describe('Complex Loading Patterns', () => {
    it('should handle nested loading states with different phases', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Nested Loading Pattern',
        description: 'Testing nested loading states and phase transitions',
        scenario: 'progressive-load',
        expectedDuration: 2000,
        useFakeTimers: true,
      };

      await fixture.setup(config);

      // Start with initialization
      let state = fixture.startLoading({ message: 'Initializing application...' });
      expect(fixture.getLoadingProgress().phase).toBe('initializing');

      // Move to fetching phase
      fixture.updateProgress({
        percentage: 25,
        phase: 'fetching',
        message: 'Fetching configuration...'
      });
      expect(fixture.getLoadingProgress().phase).toBe('fetching');

      // Simulate a nested loading within the main loading
      const nestedSteps: LoadingStep[] = [
        { name: 'auth-check', duration: 300, progressAfter: 40, message: 'Checking authentication...' },
        { name: 'permissions', duration: 200, progressAfter: 60, message: 'Loading permissions...' },
        { name: 'user-data', duration: 500, progressAfter: 80, message: 'Loading user data...' },
      ];

      await fixture.simulateProgressiveLoading(nestedSteps);

      // Final processing phase
      fixture.updateProgress({
        percentage: 90,
        phase: 'processing',
        message: 'Processing user interface...'
      });

      state = fixture.finishLoading({ success: true, progress: 100 });
      expect(state.isLoading).toBe(false);
      expect(fixture.getLoadingProgress().phase).toBe('complete');
    });

    it('should handle interleaved request cancellations and completions', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Interleaved Operations',
        description: 'Testing mixed request cancellations and completions',
        scenario: 'multiple-requests',
        cancellable: true,
      };

      await fixture.setup(config);
      fixture.startLoading({ message: 'Loading dashboard components...' });

      // Create multiple requests
      const requests: PendingRequest[] = [
        {
          id: 'user-profile',
          url: 'https://api.example.com/user',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
        {
          id: 'notifications',
          url: 'https://api.example.com/notifications',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
        {
          id: 'recent-activity',
          url: 'https://api.example.com/activity',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
        {
          id: 'settings',
          url: 'https://api.example.com/settings',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
      ];

      const cancelFunctions = requests.map(request => fixture.simulatePendingRequest(request));
      expect(fixture.getPendingRequests()).toHaveLength(4);

      // Cancel every other request
      cancelFunctions[0](); // Cancel user-profile
      cancelFunctions[2](); // Cancel recent-activity

      const pendingAfterCancellation = fixture.getPendingRequests();
      const cancelledRequests = pendingAfterCancellation.filter(req => req.status === 'cancelled');
      expect(cancelledRequests).toHaveLength(2);

      // Complete the remaining requests
      const remainingRequests = pendingAfterCancellation.filter(req => req.status === 'pending');
      remainingRequests.forEach(req => {
        req.status = 'resolved';
        req.completedAt = new Date();
      });

      fixture.finishLoading({ success: true });

      const finalValidation = await fixture.validate();
      expect(finalValidation.valid).toBe(true);
    });

    it('should handle rapid state transitions and validate consistency', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Rapid Transitions',
        description: 'Testing rapid state changes',
        scenario: 'api-request',
        useFakeTimers: true,
      };

      await fixture.setup(config);

      // Perform rapid state transitions
      for (let i = 0; i < 10; i++) {
        fixture.startLoading({ message: `Loading step ${i + 1}...`, initialProgress: i * 10 });

        // Validate state after each transition
        expect(fixture.isLoading()).toBe(true);
        expect(fixture.getLoadingProgress().percentage).toBe(i * 10);
        expect(fixture.getLoadingProgress().message).toBe(`Loading step ${i + 1}...`);

        // Finish loading immediately
        fixture.finishLoading({ success: true, progress: (i + 1) * 10 });
        expect(fixture.getLoadingProgress().percentage).toBe((i + 1) * 10);
      }

      const finalValidation = await fixture.validate();
      expect(finalValidation.valid).toBe(true);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large numbers of concurrent requests efficiently', async () => {
      const config: LoadingFixtureConfig = {
        name: 'High Concurrency',
        description: 'Testing performance with many concurrent requests',
        scenario: 'multiple-requests',
        cancellable: true,
      };

      await fixture.setup(config);
      fixture.startLoading({ message: 'Loading large dataset...' });

      // Create many concurrent requests
      const requestCount = 100;
      const requests: PendingRequest[] = [];
      const cancelFunctions: (() => void)[] = [];

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        const request: PendingRequest = {
          id: `request-${i}`,
          url: `https://api.example.com/data/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        };

        requests.push(request);
        const cancel = fixture.simulatePendingRequest(request);
        cancelFunctions.push(cancel);
      }

      const setupTime = Date.now() - startTime;
      expect(setupTime).toBeLessThan(1000); // Should setup quickly

      expect(fixture.getPendingRequests()).toHaveLength(requestCount);

      // Cancel half the requests
      const cancelStartTime = Date.now();
      for (let i = 0; i < requestCount / 2; i++) {
        cancelFunctions[i]();
      }
      const cancelTime = Date.now() - cancelStartTime;
      expect(cancelTime).toBeLessThan(500); // Should cancel quickly

      // Complete the rest
      const completeStartTime = Date.now();
      const remainingRequests = fixture.getPendingRequests().filter(req => req.status === 'pending');
      remainingRequests.forEach(req => {
        req.status = 'resolved';
        req.completedAt = new Date();
      });
      const completeTime = Date.now() - completeStartTime;
      expect(completeTime).toBeLessThan(500); // Should complete quickly

      fixture.finishLoading({ success: true });

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
    });

    it('should properly clean up memory after multiple setup/teardown cycles', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Memory Cleanup Cycles',
        description: 'Testing memory cleanup across multiple cycles',
        scenario: 'file-upload',
        expectedDuration: 1000,
        cancellable: true,
      };

      // Perform multiple setup/teardown cycles
      for (let cycle = 0; cycle < 20; cycle++) {
        await fixture.setup(config);

        fixture.startLoading({ message: `Upload cycle ${cycle + 1}` });

        // Add some requests and cleanup tasks
        const request: PendingRequest = {
          id: `upload-${cycle}`,
          url: `https://api.example.com/upload/${cycle}`,
          method: 'POST',
          status: 'pending',
          startedAt: new Date(),
        };

        fixture.simulatePendingRequest(request);
        fixture.addCleanupTask(() => {
          // Simulate cleanup work
          return Promise.resolve();
        });

        fixture.finishLoading({ success: true });

        // Verify state before teardown
        expect(fixture.isSetup()).toBe(true);

        await fixture.teardown();

        // Verify complete cleanup
        expect(fixture.isSetup()).toBe(false);
        expect(fixture.isLoading()).toBe(false);
        expect(fixture.getPendingRequests()).toHaveLength(0);
        expect(fixture.state.activeTimers.size).toBe(0);
      }
    });

    it('should maintain performance with complex progressive loading', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Complex Progressive Loading',
        description: 'Performance test for complex progressive loading',
        scenario: 'progressive-load',
        useFakeTimers: true,
      };

      await fixture.setup(config);
      fixture.startLoading({ message: 'Starting complex operation...' });

      // Create complex progressive loading steps
      const complexSteps: LoadingStep[] = [];
      for (let i = 0; i < 50; i++) {
        complexSteps.push({
          name: `step-${i}`,
          duration: 50,
          progressAfter: (i + 1) * 2, // 2% progress per step
          message: `Processing step ${i + 1} of 50...`,
          callback: () => {
            // Simulate some work
            const data = new Array(1000).fill(i).map((val, idx) => val + idx);
            return data.length; // Return something to prevent optimization
          },
        });
      }

      const startTime = Date.now();
      await fixture.simulateProgressiveLoading(complexSteps);
      const executionTime = Date.now() - startTime;

      // Should complete in reasonable time even with fake timers
      expect(executionTime).toBeLessThan(5000);
      expect(fixture.getLoadingProgress().percentage).toBe(100);

      fixture.finishLoading({ success: true });

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from validation errors and continue operation', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Error Recovery',
        description: 'Testing recovery from validation errors',
        scenario: 'api-request',
        expectedDuration: 1000,
        timeout: 5000,
      };

      await fixture.setup(config);
      fixture.startLoading();

      // Intentionally corrupt state to trigger validation errors
      (fixture.state as any).progress.percentage = 150; // Invalid percentage
      (fixture.state as any).progress.phase = 'invalid-phase'; // Invalid phase

      let validation = await fixture.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Fix the state
      fixture.updateProgress({ percentage: 50, phase: 'fetching' });

      validation = await fixture.validate();
      expect(validation.valid).toBe(true);

      // Continue with normal operation
      fixture.finishLoading({ success: true });

      const finalValidation = await fixture.validate();
      expect(finalValidation.valid).toBe(true);
    });

    it('should handle teardown errors gracefully without affecting other fixtures', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Teardown Error Handling',
        description: 'Testing graceful handling of teardown errors',
        scenario: 'api-request',
      };

      await fixture.setup(config);

      // Add cleanup tasks that will fail
      fixture.addCleanupTask(() => {
        throw new Error('Cleanup failure 1');
      });

      fixture.addCleanupTask(async () => {
        throw new Error('Cleanup failure 2');
      });

      // Add a successful cleanup task
      const successfulCleanup = vi.fn();
      fixture.addCleanupTask(successfulCleanup);

      // Teardown should not throw despite cleanup failures
      await expect(fixture.teardown()).resolves.toBeUndefined();

      // Successful cleanup should still have been called
      expect(successfulCleanup).toHaveBeenCalledTimes(1);

      // Fixture should be cleaned up
      expect(fixture.isSetup()).toBe(false);
    });

    it('should handle timeout scenarios correctly across all phases', async () => {
      const scenarios: LoadingScenario[] = ['api-request', 'file-upload', 'page-load', 'data-refresh'];

      for (const scenario of scenarios) {
        const config: LoadingFixtureConfig = {
          name: `Timeout Test - ${scenario}`,
          description: `Testing timeout handling for ${scenario}`,
          scenario,
          timeout: 1000,
          useFakeTimers: true,
        };

        await fixture.setup(config);
        fixture.startLoading({ message: `Loading with ${scenario} scenario...` });

        // Simulate timeout
        const timeoutState = await fixture.simulateLoadingTimeout();

        expect(timeoutState.isLoading).toBe(false);
        expect(timeoutState.hasError).toBe(true);
        expect(fixture.getLoadingProgress().message).toContain('timeout');

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true); // Should still be valid after timeout

        await fixture.teardown();
      }
    });
  });

  describe('Integration Helper Robustness', () => {
    it('should handle rapid successive calls to helper functions', async () => {
      const { setup, teardown } = createLoadingFixtureHooks('api-request');

      // Rapid setup/teardown cycles
      for (let i = 0; i < 10; i++) {
        const fixture1 = await setup();
        expect(fixture1.isSetup()).toBe(true);

        const fixture2 = await setup(); // Should teardown previous
        expect(fixture2.isSetup()).toBe(true);

        await teardown();
      }
    });

    it('should handle withLoadingFixture with async operations and errors', async () => {
      const asyncTestWithError = withLoadingFixture('file-upload', async (fixture) => {
        fixture.startLoading({ message: 'Starting async test...' });

        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));

        // Simulate an error partway through
        throw new Error('Simulated test error');
      });

      await expect(asyncTestWithError()).rejects.toThrow('Simulated test error');

      // Verify fixture was cleaned up despite the error
      const asyncTestSuccess = withLoadingFixture('api-request', async (fixture) => {
        expect(fixture.isSetup()).toBe(true);
        return 'success';
      });

      const result = await asyncTestSuccess();
      expect(result).toBe('success');
    });

    it('should handle createMultiLoadingFixture with all supported scenarios', async () => {
      const allScenarios: LoadingScenario[] = [
        'page-load', 'api-request', 'multiple-requests', 'progressive-load',
        'lazy-component', 'infinite-scroll', 'file-upload', 'background-sync',
        'auth-check', 'data-refresh'
      ];

      const createFixture = createMultiLoadingFixture(allScenarios);

      // Test each scenario
      for (const scenario of allScenarios) {
        const fixture = await createFixture(scenario);
        expect(fixture.state.config.scenario).toBe(scenario);

        // Verify scenario-specific configuration
        const scenarioConfig = LOADING_SCENARIOS[scenario];
        expect(fixture.state.config.expectedDuration).toBe(scenarioConfig.expectedDuration);
        expect(fixture.state.config.timeout).toBe(scenarioConfig.timeout);

        await fixture.teardown();
      }
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should simulate a complete e-commerce checkout flow', async () => {
      const checkoutSteps = [
        { scenario: 'auth-check' as LoadingScenario, message: 'Verifying user authentication...' },
        { scenario: 'api-request' as LoadingScenario, message: 'Validating cart items...' },
        { scenario: 'api-request' as LoadingScenario, message: 'Calculating taxes and shipping...' },
        { scenario: 'api-request' as LoadingScenario, message: 'Processing payment...' },
        { scenario: 'api-request' as LoadingScenario, message: 'Creating order...' },
        { scenario: 'background-sync' as LoadingScenario, message: 'Syncing order data...' },
      ];

      for (let i = 0; i < checkoutSteps.length; i++) {
        const step = checkoutSteps[i];
        const config: LoadingFixtureConfig = {
          name: `Checkout Step ${i + 1}`,
          description: step.message,
          scenario: step.scenario,
          ...LOADING_SCENARIOS[step.scenario],
        };

        await fixture.setup(config);
        fixture.startLoading({ message: step.message, initialProgress: (i / checkoutSteps.length) * 100 });

        // Simulate the step processing
        await new Promise(resolve => setTimeout(resolve, 5));

        fixture.finishLoading({
          success: true,
          progress: ((i + 1) / checkoutSteps.length) * 100,
          data: { step: i + 1, completed: true }
        });

        const validation = await fixture.validate();
        expect(validation.valid).toBe(true);

        await fixture.teardown();
      }
    });

    it('should simulate social media feed loading with infinite scroll', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Social Media Feed',
        description: 'Simulating infinite scroll feed loading',
        scenario: 'infinite-scroll',
        expectedDuration: 800,
        cancellable: true,
      };

      await fixture.setup(config);

      // Load initial posts
      fixture.startLoading({ message: 'Loading initial posts...' });

      const initialRequest: PendingRequest = {
        id: 'initial-posts',
        url: 'https://api.example.com/posts?page=1',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
        expectedResponse: { posts: new Array(10).fill(null).map((_, i) => ({ id: i + 1 })) }
      };

      fixture.simulatePendingRequest(initialRequest);
      fixture.finishLoading({ success: true, data: { posts: 10 } });

      // Simulate infinite scroll - load more posts
      for (let page = 2; page <= 5; page++) {
        fixture.startLoading({ message: `Loading more posts (page ${page})...` });

        const morePostsRequest: PendingRequest = {
          id: `posts-page-${page}`,
          url: `https://api.example.com/posts?page=${page}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
          expectedResponse: { posts: new Array(10).fill(null).map((_, i) => ({ id: (page - 1) * 10 + i + 1 })) }
        };

        fixture.simulatePendingRequest(morePostsRequest);
        fixture.finishLoading({ success: true, data: { posts: page * 10 } });

        // Small delay to simulate scroll
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const finalValidation = await fixture.validate();
      expect(finalValidation.valid).toBe(true);
    });

    it('should simulate complex dashboard loading with multiple data sources', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Dashboard Loading',
        description: 'Loading dashboard with multiple components',
        scenario: 'multiple-requests',
        expectedDuration: 2000,
        cancellable: true,
      };

      await fixture.setup(config);
      fixture.startLoading({ message: 'Loading dashboard...' });

      // Dashboard components
      const dashboardRequests: PendingRequest[] = [
        { id: 'user-stats', url: 'https://api.example.com/stats', method: 'GET', status: 'pending', startedAt: new Date() },
        { id: 'recent-orders', url: 'https://api.example.com/orders/recent', method: 'GET', status: 'pending', startedAt: new Date() },
        { id: 'analytics-data', url: 'https://api.example.com/analytics', method: 'GET', status: 'pending', startedAt: new Date() },
        { id: 'notifications', url: 'https://api.example.com/notifications', method: 'GET', status: 'pending', startedAt: new Date() },
        { id: 'system-health', url: 'https://api.example.com/health', method: 'GET', status: 'pending', startedAt: new Date() },
      ];

      dashboardRequests.forEach(request => fixture.simulatePendingRequest(request));

      // Simulate progressive completion
      const progressSteps: LoadingStep[] = [
        { name: 'stats', duration: 200, progressAfter: 20, message: 'Loading statistics...' },
        { name: 'orders', duration: 300, progressAfter: 40, message: 'Loading recent orders...' },
        { name: 'analytics', duration: 400, progressAfter: 70, message: 'Loading analytics...' },
        { name: 'notifications', duration: 100, progressAfter: 85, message: 'Loading notifications...' },
        { name: 'health', duration: 150, progressAfter: 100, message: 'Checking system health...' },
      ];

      await fixture.simulateProgressiveLoading(progressSteps);

      fixture.finishLoading({
        success: true,
        data: {
          componentsLoaded: dashboardRequests.length,
          totalLoadTime: fixture.getLoadingProgress().elapsedTime
        }
      });

      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
    });
  });
});