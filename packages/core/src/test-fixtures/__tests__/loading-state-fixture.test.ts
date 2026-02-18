/**
 * @fileoverview Tests for Loading State Fixture
 *
 * This test suite validates the loading state fixture implementation,
 * covering all core functionality, scenarios, and integration helpers.
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

describe('LoadingStateFixture', () => {
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

  describe('Basic Lifecycle', () => {
    it('should initialize with clean state', () => {
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.isLoading()).toBe(false);
      expect(fixture.getPendingRequests()).toHaveLength(0);

      const progress = fixture.getLoadingProgress();
      expect(progress.percentage).toBe(0);
      expect(progress.phase).toBe('initializing');
    });

    it('should setup with basic configuration', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Test Loading',
        description: 'Test loading scenario',
        scenario: 'api-request',
        expectedDuration: 1000,
      };

      await fixture.setup(config);

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config).toEqual(config);

      const browserState = fixture.getBrowserState();
      expect(browserState.isLoading).toBe(true);
      expect(browserState.title).toContain('Loading');
    });

    it('should prevent double setup', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Test Loading',
        description: 'Test loading scenario',
        scenario: 'api-request',
      };

      await fixture.setup(config);

      await expect(fixture.setup(config))
        .rejects.toThrow('Loading state fixture is already set up');
    });

    it('should teardown cleanly', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Test Loading',
        description: 'Test loading scenario',
        scenario: 'api-request',
      };

      await fixture.setup(config);
      expect(fixture.isSetup()).toBe(true);

      await fixture.teardown();
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.isLoading()).toBe(false);
    });

    it('should handle teardown when not setup', async () => {
      // Should not throw
      await expect(fixture.teardown()).resolves.toBeUndefined();
    });
  });

  describe('Loading State Management', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Test Loading',
        description: 'Test loading scenario',
        scenario: 'api-request',
        expectedDuration: 1000,
      };
      await fixture.setup(config);
    });

    it('should start loading', () => {
      const state = fixture.startLoading({
        message: 'Custom loading message',
        initialProgress: 25,
      });

      expect(state.isLoading).toBe(true);
      expect(state.hasError).toBe(false);
      expect(fixture.getLoadingProgress().percentage).toBe(25);
      expect(fixture.getLoadingProgress().message).toBe('Custom loading message');
    });

    it('should finish loading successfully', () => {
      fixture.startLoading();

      const state = fixture.finishLoading({
        success: true,
        data: { result: 'success' },
        progress: 100,
      });

      expect(state.isLoading).toBe(false);
      expect(state.hasError).toBe(false);
      expect(fixture.getLoadingProgress().percentage).toBe(100);
      expect(fixture.getLoadingProgress().phase).toBe('complete');
    });

    it('should finish loading with error', () => {
      fixture.startLoading();

      const state = fixture.finishLoading({
        success: false,
        error: 'Test error occurred',
      });

      expect(state.isLoading).toBe(false);
      expect(state.hasError).toBe(true);
      expect(fixture.getLoadingProgress().message).toContain('Loading failed');
    });

    it('should simulate loading error directly', () => {
      fixture.startLoading();

      const state = fixture.simulateLoadingError('Network failure');

      expect(state.isLoading).toBe(false);
      expect(state.hasError).toBe(true);
      expect(fixture.getLoadingProgress().message).toContain('Network failure');
    });

    it('should update browser state', () => {
      const updates = {
        url: 'https://example.com/test',
        title: 'Test Page',
      };

      fixture.updateBrowserState(updates);

      const state = fixture.getBrowserState();
      expect(state.url).toBe(updates.url);
      expect(state.title).toBe(updates.title);
    });
  });

  describe('Pending Request Simulation', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Test Loading',
        description: 'Test loading scenario',
        scenario: 'api-request',
        cancellable: true,
      };
      await fixture.setup(config);
    });

    it('should simulate pending request', () => {
      const request: PendingRequest = {
        id: 'test-request',
        url: 'https://api.example.com/data',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      };

      const cancel = fixture.simulatePendingRequest(request);

      const pendingRequests = fixture.getPendingRequests();
      expect(pendingRequests).toHaveLength(1);
      expect(pendingRequests[0].id).toBe('test-request');
      expect(pendingRequests[0].abortController).toBeDefined();

      // Test cancellation
      cancel();
      expect(pendingRequests[0].status).toBe('cancelled');
    });

    it('should add requests to browser state network requests', () => {
      const request: PendingRequest = {
        id: 'test-request',
        url: 'https://api.example.com/data',
        method: 'POST',
        status: 'pending',
        startedAt: new Date(),
      };

      fixture.simulatePendingRequest(request);

      const browserState = fixture.getBrowserState();
      const networkRequest = browserState.networkRequests.find(
        req => req.url === request.url && req.method === request.method
      );
      expect(networkRequest).toBeDefined();
    });

    it('should handle multiple pending requests', () => {
      const requests: PendingRequest[] = [
        {
          id: 'request-1',
          url: 'https://api.example.com/data1',
          method: 'GET',
          status: 'pending',
          startedAt: new Date(),
        },
        {
          id: 'request-2',
          url: 'https://api.example.com/data2',
          method: 'POST',
          status: 'pending',
          startedAt: new Date(),
        },
      ];

      requests.forEach(request => fixture.simulatePendingRequest(request));

      expect(fixture.getPendingRequests()).toHaveLength(2);
    });
  });

  describe('Progressive Loading', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Progressive Test',
        description: 'Progressive loading test',
        scenario: 'progressive-load',
        useFakeTimers: true,
      };
      await fixture.setup(config);
    });

    it('should simulate progressive loading steps', async () => {
      const steps: LoadingStep[] = [
        {
          name: 'Initialize',
          duration: 100,
          progressAfter: 20,
          message: 'Initializing...',
        },
        {
          name: 'Fetch Data',
          duration: 200,
          progressAfter: 60,
          message: 'Fetching data...',
        },
        {
          name: 'Process',
          duration: 150,
          progressAfter: 100,
          message: 'Processing...',
        },
      ];

      let stepCallbacks = 0;
      const stepsWithCallbacks = steps.map(step => ({
        ...step,
        callback: () => { stepCallbacks++; },
      }));

      fixture.startLoading();

      await fixture.simulateProgressiveLoading(stepsWithCallbacks);

      const progress = fixture.getLoadingProgress();
      expect(progress.percentage).toBe(100);
      expect(progress.message).toBe('Processing...');
      expect(stepCallbacks).toBe(3);
    });
  });

  describe('Timer Integration', () => {
    it('should work with fake timers', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Timer Test',
        description: 'Timer test scenario',
        scenario: 'api-request',
        useFakeTimers: true,
        expectedDuration: 1000,
      };

      await fixture.setup(config);
      fixture.startLoading();

      expect(fixture.isLoading()).toBe(true);

      // Simulate timeout
      await fixture.simulateLoadingTimeout();

      const progress = fixture.getLoadingProgress();
      expect(progress.message).toContain('Loading timeout exceeded');
    });

    it('should handle delayed response with fake timers', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Delay Test',
        description: 'Delayed response test',
        scenario: 'api-request',
        useFakeTimers: true,
      };

      await fixture.setup(config);

      const responsePromise = fixture.simulateDelayedResponse(500, { data: 'test' });

      // Response should not be ready yet
      let resolved = false;
      responsePromise.then(() => { resolved = true; });

      await vi.runAllTimersAsync();

      const response = await responsePromise;
      expect(resolved).toBe(true);
      expect(response).toEqual({ data: 'test' });
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      const config: LoadingFixtureConfig = {
        name: 'Validation Test',
        description: 'Validation test scenario',
        scenario: 'api-request',
        timeout: 5000,
        expectedDuration: 1000,
        cancellable: true,
      };
      await fixture.setup(config);
    });

    it('should pass validation for valid state', async () => {
      fixture.startLoading();

      const result = await fixture.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid progress', async () => {
      fixture.startLoading();

      // Manually corrupt progress state for testing
      (fixture.state as any).progress.percentage = 150; // Invalid percentage

      const result = await fixture.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Progress percentage should be 0-100, got 150');
    });

    it('should fail validation for inconsistent loading state', async () => {
      fixture.startLoading();
      fixture.updateBrowserState({ isLoading: false });

      const result = await fixture.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(error =>
        error.includes('Browser state isLoading should be true')
      )).toBe(true);
    });
  });

  describe('Predefined Scenarios', () => {
    it('should have all expected scenarios', () => {
      const expectedScenarios: LoadingScenario[] = [
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

      expectedScenarios.forEach(scenario => {
        expect(LOADING_SCENARIOS[scenario]).toBeDefined();
        expect(LOADING_SCENARIOS[scenario].scenario).toBe(scenario);
      });
    });

    it('should setup with predefined scenario', async () => {
      const scenarioConfig = LOADING_SCENARIOS['file-upload'];
      const config: LoadingFixtureConfig = {
        name: 'File Upload Test',
        description: 'File upload scenario test',
        ...scenarioConfig,
      };

      await fixture.setup(config);

      expect(fixture.isSetup()).toBe(true);
      expect(fixture.state.config.scenario).toBe('file-upload');
      expect(fixture.state.config.indicatorType).toBe('progress');
      expect(fixture.state.config.cancellable).toBe(true);
    });
  });

  describe('Integration Helpers', () => {
    describe('createLoadingFixtureHooks', () => {
      it('should create setup and teardown hooks', async () => {
        const { setup, teardown, fixture: hookFixture } = createLoadingFixtureHooks('api-request');

        expect(hookFixture).toBe(null);

        const createdFixture = await setup();
        expect(createdFixture).toBeInstanceOf(LoadingStateFixture);
        expect(createdFixture.isSetup()).toBe(true);

        await teardown();
        expect(hookFixture).toBe(null);
      });

      it('should handle multiple setup/teardown cycles', async () => {
        const { setup, teardown } = createLoadingFixtureHooks('api-request');

        const fixture1 = await setup();
        expect(fixture1.isSetup()).toBe(true);

        const fixture2 = await setup(); // Should teardown previous
        expect(fixture2.isSetup()).toBe(true);

        await teardown();
        expect(fixture2.isSetup()).toBe(false);
      });
    });

    describe('withLoadingFixture', () => {
      it('should wrap test function with fixture setup', async () => {
        const testFn = vi.fn().mockImplementation((fixture) => {
          expect(fixture.isSetup()).toBe(true);
          expect(fixture.state.config.scenario).toBe('api-request');
          return 'test result';
        });

        const wrappedTest = withLoadingFixture('api-request', testFn);
        const result = await wrappedTest();

        expect(result).toBe('test result');
        expect(testFn).toHaveBeenCalledTimes(1);
      });

      it('should teardown even if test throws', async () => {
        const testFn = vi.fn().mockRejectedValue(new Error('Test error'));
        const wrappedTest = withLoadingFixture('api-request', testFn);

        await expect(wrappedTest()).rejects.toThrow('Test error');
        expect(testFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('createMultiLoadingFixture', () => {
      it('should create fixture for supported scenarios', async () => {
        const scenarios: LoadingScenario[] = ['api-request', 'file-upload'];
        const createFixture = createMultiLoadingFixture(scenarios);

        const fixture1 = await createFixture('api-request');
        expect(fixture1.state.config.scenario).toBe('api-request');
        await fixture1.teardown();

        const fixture2 = await createFixture('file-upload');
        expect(fixture2.state.config.scenario).toBe('file-upload');
        await fixture2.teardown();
      });

      it('should reject unsupported scenarios', async () => {
        const scenarios: LoadingScenario[] = ['api-request'];
        const createFixture = createMultiLoadingFixture(scenarios);

        await expect(createFixture('file-upload'))
          .rejects.toThrow('Scenario file-upload is not supported');
      });
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clean up timers on teardown', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Timer Cleanup Test',
        description: 'Timer cleanup test',
        scenario: 'api-request',
        expectedDuration: 5000,
        timeout: 10000,
      };

      await fixture.setup(config);

      expect(fixture.state.activeTimers.size).toBeGreaterThan(0);

      await fixture.teardown();

      expect(fixture.state.activeTimers.size).toBe(0);
    });

    it('should cancel pending requests on teardown', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Request Cleanup Test',
        description: 'Request cleanup test',
        scenario: 'api-request',
        cancellable: true,
      };

      await fixture.setup(config);

      const request: PendingRequest = {
        id: 'test-request',
        url: 'https://api.example.com/data',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      };

      fixture.simulatePendingRequest(request);
      expect(request.status).toBe('pending');

      await fixture.teardown();
      expect(request.status).toBe('cancelled');
    });

    it('should run custom cleanup tasks', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Custom Cleanup Test',
        description: 'Custom cleanup test',
        scenario: 'api-request',
      };

      await fixture.setup(config);

      const cleanupMock = vi.fn();
      fixture.addCleanupTask(cleanupMock);

      await fixture.teardown();

      expect(cleanupMock).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup errors gracefully', async () => {
      const config: LoadingFixtureConfig = {
        name: 'Cleanup Error Test',
        description: 'Cleanup error test',
        scenario: 'api-request',
      };

      await fixture.setup(config);

      const failingCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      const successfulCleanup = vi.fn();

      fixture.addCleanupTask(failingCleanup);
      fixture.addCleanupTask(successfulCleanup);

      // Should not throw despite cleanup failure
      await expect(fixture.teardown()).resolves.toBeUndefined();

      expect(failingCleanup).toHaveBeenCalledTimes(1);
      expect(successfulCleanup).toHaveBeenCalledTimes(1);
    });
  });
});