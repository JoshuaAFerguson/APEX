/**
 * @fileoverview Integration Tests for Loading State Fixture
 *
 * These tests validate the loading state fixture in realistic scenarios
 * with actual async operations, timers, and browser-like behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LoadingStateFixture,
  withLoadingFixture,
  createLoadingFixtureHooks,
  type LoadingFixtureConfig,
  type PendingRequest,
  type LoadingStep,
} from '../loading-state-fixture.js';

describe('LoadingStateFixture Integration', () => {
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

  describe('Real-world Loading Scenarios', () => {
    it('should simulate complete API request lifecycle', async () => {
      const config: LoadingFixtureConfig = {
        name: 'API Request Lifecycle',
        description: 'Complete API request with loading states',
        scenario: 'api-request',
        expectedDuration: 1000,
        cancellable: true,
        mockResponses: {
          'https://api.example.com/users': { users: ['Alice', 'Bob'] },
        },
      };

      await fixture.setup(config);

      // Start loading
      fixture.startLoading({ message: 'Fetching users...' });
      expect(fixture.isLoading()).toBe(true);

      // Simulate API request
      const request: PendingRequest = {
        id: 'fetch-users',
        url: 'https://api.example.com/users',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
        expectedResponse: { users: ['Alice', 'Bob'] },
      };

      const cancelRequest = fixture.simulatePendingRequest(request);
      expect(fixture.getPendingRequests()).toHaveLength(1);

      // Simulate successful completion
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      fixture.finishLoading({
        success: true,
        data: { users: ['Alice', 'Bob'] },
      });

      expect(fixture.isLoading()).toBe(false);
      expect(fixture.getLoadingProgress().percentage).toBe(100);
      expect(fixture.getLoadingProgress().phase).toBe('complete');

      // Validate final state
      const validation = await fixture.validate();
      expect(validation.valid).toBe(true);
    });

    it('should handle file upload with progress tracking', async () => {
      const config: LoadingFixtureConfig = {
        name: 'File Upload Progress',
        description: 'File upload with progress tracking',
        scenario: 'file-upload',
        expectedDuration: 3000,
        cancellable: true,
        useFakeTimers: true,
      };

      await fixture.setup(config);
      fixture.startLoading({ message: 'Uploading file...' });

      // Simulate progressive upload
      const uploadSteps: LoadingStep[] = [
        { name: 'preparing', duration: 200, progressAfter: 10, message: 'Preparing upload...' },
        { name: 'uploading', duration: 2000, progressAfter: 80, message: 'Uploading...' },
        { name: 'processing', duration: 500, progressAfter: 95, message: 'Processing...' },
        { name: 'finalizing', duration: 300, progressAfter: 100, message: 'Finalizing...' },
      ];

      await fixture.simulateProgressiveLoading(uploadSteps);

      expect(fixture.getLoadingProgress().percentage).toBe(100);
      expect(fixture.getLoadingProgress().message).toBe('Finalizing...');
    });

    it('should handle multiple concurrent requests', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Multiple Requests',
        description: 'Multiple concurrent API requests',
        scenario: 'multiple-requests',
        expectedDuration: 2000,
        cancellable: true,
      };

      await fixture.setup(config);
      fixture.startLoading({ message: 'Loading dashboard data...' });

      // Simulate multiple concurrent requests
      const requests: PendingRequest[] = [
        {
          id: 'user-profile',
          url: 'https://api.example.com/profile',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
        {
          id: 'user-projects',
          url: 'https://api.example.com/projects',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
        {
          id: 'user-notifications',
          url: 'https://api.example.com/notifications',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
      ];

      const cancelFunctions = requests.map(request =>
        fixture.simulatePendingRequest(request)
      );

      expect(fixture.getPendingRequests()).toHaveLength(3);

      // Simulate completion of all requests
      fixture.finishLoading({ success: true });

      // Check that all requests are marked as resolved
      const finalRequests = fixture.getPendingRequests();
      finalRequests.forEach(request => {
        expect(['resolved', 'rejected']).toContain(request.status);
        expect(request.completedAt).toBeDefined();
      });
    });

    it('should handle network timeout scenario', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Network Timeout',
        description: 'Network request timeout scenario',
        scenario: 'api-request',
        timeout: 1000,
        useFakeTimers: true,
      };

      await fixture.setup(config);
      fixture.startLoading();

      // Simulate timeout
      const timeoutState = await fixture.simulateLoadingTimeout();

      expect(timeoutState.isLoading).toBe(false);
      expect(timeoutState.hasError).toBe(true);
      expect(fixture.getLoadingProgress().message).toContain('timeout');
    });

    it('should handle request cancellation', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Request Cancellation',
        description: 'User cancels loading request',
        scenario: 'api-request',
        cancellable: true,
      };

      await fixture.setup(config);
      fixture.startLoading();

      const request: PendingRequest = {
        id: 'cancellable-request',
        url: 'https://api.example.com/slow-endpoint',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      };

      const cancelRequest = fixture.simulatePendingRequest(request);

      // User cancels the request
      cancelRequest();

      const pendingRequests = fixture.getPendingRequests();
      const cancelledRequest = pendingRequests.find(req => req.id === 'cancellable-request');
      expect(cancelledRequest?.status).toBe('cancelled');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors gracefully', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Network Error',
        description: 'Network error during loading',
        scenario: 'api-request',
      };

      await fixture.setup(config);
      fixture.startLoading();

      const errorState = fixture.simulateLoadingError('Network connection lost');

      expect(errorState.isLoading).toBe(false);
      expect(errorState.hasError).toBe(true);
      expect(fixture.getLoadingProgress().message).toContain('Network connection lost');

      // Check console messages include error
      const consoleErrors = errorState.consoleMessages.filter(msg => msg.type === 'error');
      expect(consoleErrors.some(msg => msg.message.includes('Network connection lost'))).toBe(true);
    });

    it('should handle validation errors in realistic scenarios', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Validation Error Test',
        description: 'Test validation errors',
        scenario: 'api-request',
        timeout: 1000,
        expectedDuration: 2000, // Invalid: timeout < expectedDuration
      };

      await fixture.setup(config);

      const validation = await fixture.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error =>
        error.includes('Timeout should be greater than expected duration')
      )).toBe(true);
    });
  });

  describe('Integration Helper Usage', () => {
    it('should work with test hooks pattern', async () => {
      const { setup, teardown, fixture: hookFixture } = createLoadingFixtureHooks(
        'page-load',
        { expectedDuration: 1000 }
      );

      // Simulate beforeEach
      const createdFixture = await setup();

      expect(createdFixture.isSetup()).toBe(true);
      expect(createdFixture.state.config.scenario).toBe('page-load');

      // Test actual loading behavior
      createdFixture.startLoading();
      expect(createdFixture.isLoading()).toBe(true);

      const state = createdFixture.finishLoading({ success: true });
      expect(state.isLoading).toBe(false);

      // Simulate afterEach
      await teardown();
      expect(hookFixture).toBe(null);
    });

    it('should work with higher-order function pattern', async () => {
      const testResult = await withLoadingFixture(
        'lazy-component',
        async (loadingFixture) => {
          expect(loadingFixture.isSetup()).toBe(true);
          expect(loadingFixture.state.config.scenario).toBe('lazy-component');

          // Simulate lazy component loading
          loadingFixture.startLoading({ message: 'Loading component...' });

          // Progressive loading simulation
          const componentSteps: LoadingStep[] = [
            { name: 'fetch-code', duration: 100, progressAfter: 40, message: 'Fetching code...' },
            { name: 'parse', duration: 50, progressAfter: 70, message: 'Parsing...' },
            { name: 'render', duration: 30, progressAfter: 100, message: 'Rendering...' },
          ];

          await loadingFixture.simulateProgressiveLoading(componentSteps);

          const finalProgress = loadingFixture.getLoadingProgress();
          expect(finalProgress.percentage).toBe(100);
          expect(finalProgress.message).toBe('Rendering...');

          return 'component-loaded';
        }
      );

      expect(testResult).toBe('component-loaded');
    });

    it('should handle realistic auth check scenario', async () => {
      await withLoadingFixture(
        'auth-check',
        async (authFixture) => {
          authFixture.startLoading({ message: 'Verifying authentication...' });

          // Simulate auth request
          const authRequest: PendingRequest = {
            id: 'verify-token',
            url: 'https://api.example.com/auth/verify',
            method: 'POST',
            status: 'pending',
            startedAt: new Date(),
          };

          authFixture.simulatePendingRequest(authRequest);

          // Simulate short auth check delay
          await new Promise(resolve => setTimeout(resolve, 50));

          // Auth successful
          const finalState = authFixture.finishLoading({
            success: true,
            data: { authenticated: true, user: 'test-user' },
          });

          expect(finalState.isLoading).toBe(false);
          expect(finalState.hasError).toBe(false);

          const browserState = authFixture.getBrowserState();
          expect(browserState.title).toContain('auth');
        },
        { expectedDuration: 300 }
      );
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid setup/teardown cycles', async () => {
      const cycles = 10;

      for (let i = 0; i < cycles; i++) {
        const testFixture = new LoadingStateFixture();

        const config: LoadingFixtureConfig = {
          name: `Cycle ${i}`,
          description: `Performance test cycle ${i}`,
          scenario: 'api-request',
        };

        await testFixture.setup(config);
        expect(testFixture.isSetup()).toBe(true);

        testFixture.startLoading();
        testFixture.finishLoading({ success: true });

        await testFixture.teardown();
        expect(testFixture.isSetup()).toBe(false);
      }
    });

    it('should clean up resources properly with many requests', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Many Requests Test',
        description: 'Test with many concurrent requests',
        scenario: 'multiple-requests',
        cancellable: true,
      };

      await fixture.setup(config);

      // Create many requests
      const requestCount = 50;
      const requests: PendingRequest[] = [];

      for (let i = 0; i < requestCount; i++) {
        const request: PendingRequest = {
          id: `request-${i}`,
          url: `https://api.example.com/data/${i}`,
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        };

        requests.push(request);
        fixture.simulatePendingRequest(request);
      }

      expect(fixture.getPendingRequests()).toHaveLength(requestCount);

      // Teardown should clean up all requests
      await fixture.teardown();

      // All requests should be cancelled
      requests.forEach(request => {
        expect(request.status).toBe('cancelled');
      });
    });
  });

  describe('Real Timer Integration', () => {
    it('should work with real timers for delayed responses', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Real Timer Test',
        description: 'Test with real timers',
        scenario: 'api-request',
        useFakeTimers: false, // Use real timers
      };

      await fixture.setup(config);

      const startTime = Date.now();
      const delay = 100; // Small delay for test performance

      const responsePromise = fixture.simulateDelayedResponse(delay, { data: 'delayed' });

      const response = await responsePromise;
      const elapsed = Date.now() - startTime;

      expect(response).toEqual({ data: 'delayed' });
      expect(elapsed).toBeGreaterThanOrEqual(delay - 10); // Allow small variance
    });

    it('should handle real-time progress updates', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Real Progress Test',
        description: 'Real-time progress updates',
        scenario: 'progressive-load',
        useFakeTimers: false,
      };

      await fixture.setup(config);
      fixture.startLoading();

      const progressUpdates: number[] = [];
      const updateInterval = 20; // Update every 20ms
      const totalDuration = 100; // 100ms total

      let elapsed = 0;
      while (elapsed < totalDuration) {
        const progress = Math.min(100, (elapsed / totalDuration) * 100);

        fixture.state.progress.percentage = progress;
        progressUpdates.push(progress);

        await new Promise(resolve => setTimeout(resolve, updateInterval));
        elapsed += updateInterval;
      }

      expect(progressUpdates.length).toBeGreaterThan(1);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });
});