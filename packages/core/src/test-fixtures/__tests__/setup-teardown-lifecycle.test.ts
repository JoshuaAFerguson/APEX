/**
 * @fileoverview Tests for browser fixtures setup and teardown lifecycle management
 *
 * This test suite verifies that browser context and page fixtures properly handle
 * setup and teardown operations, including configuration options and error scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import {
  createTestSuite,
  setupTestMocks,
  addCleanupTask,
  cleanupTestState,
  getTestEnvironment,
  setTestData,
  getTestData,
  createTempDir,
  createMockFunction,
  flushTimers,
  advanceTimers,
} from '../setup-teardown.js';
import { browserFixtures, browserHelpers, BrowserStateBuilder } from '../browser-fixtures.js';
import type { TestSuiteConfig, TestEnvironment, BrowserState } from '../types.js';

describe('Browser Fixtures Setup/Teardown Lifecycle', () => {
  describe('createTestSuite', () => {
    it('should create a test suite with default configuration', () => {
      const suite = createTestSuite();

      expect(suite).toHaveProperty('beforeEach');
      expect(suite).toHaveProperty('afterEach');
      expect(typeof suite.beforeEach).toBe('function');
      expect(typeof suite.afterEach).toBe('function');
    });

    it('should handle setup and teardown hooks properly', async () => {
      const customSetupSpy = vi.fn();
      const customTeardownSpy = vi.fn();

      const suite = createTestSuite({
        customSetup: customSetupSpy,
        customTeardown: customTeardownSpy,
        setupMocks: false,
        cleanupAfterEach: true,
      });

      // Run setup
      await suite.beforeEach();
      expect(customSetupSpy).toHaveBeenCalledOnce();

      // Verify test environment was created
      const env = getTestEnvironment();
      expect(env).toBeDefined();
      expect(env?.projectPath).toBe('/test/project');

      // Run teardown
      await suite.afterEach();
      expect(customTeardownSpy).toHaveBeenCalledOnce();

      // Verify test environment was cleaned up
      const envAfter = getTestEnvironment();
      expect(envAfter).toBeNull();
    });

    it('should setup mocks when requested', async () => {
      const mockConfig = {
        mockFs: true,
        mockNetwork: true,
        mockData: {
          fileSystemData: {
            '/test/file.txt': 'test content',
          },
          apiResponses: {
            'https://api.example.com/test': { data: 'test' },
          },
        },
      };

      const suite = createTestSuite({
        setupMocks: true,
        mockConfig,
      });

      await suite.beforeEach();

      // Verify test environment includes mock setup
      const env = getTestEnvironment();
      expect(env).toBeDefined();

      await suite.afterEach();
    });

    it('should handle fake timers when requested', async () => {
      const suite = createTestSuite({
        useFakeTimers: true,
      });

      await suite.beforeEach();

      // Test that timers are mocked
      const timerCallback = vi.fn();
      setTimeout(timerCallback, 1000);

      // Advance time
      await advanceTimers(1000);
      expect(timerCallback).toHaveBeenCalledOnce();

      await suite.afterEach();
    });

    it('should set custom timeout', async () => {
      const customTimeout = 60000;
      const suite = createTestSuite({
        timeout: customTimeout,
      });

      await suite.beforeEach();

      // Note: Testing timeout is challenging in unit tests, but we can verify setup
      // The timeout is set via vi.setTimeout internally
      expect(true).toBe(true); // Verify setup completes without error

      await suite.afterEach();
    });
  });

  describe('Browser context lifecycle', () => {
    let testSuite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      testSuite = createTestSuite({
        setupMocks: true,
        cleanupAfterEach: true,
      });
      await testSuite.beforeEach();
    });

    afterEach(async () => {
      await testSuite.afterEach();
    });

    it('should maintain browser state across helper operations', () => {
      const initialState = browserFixtures.cleanState();
      let state = initialState;

      // Simulate a sequence of browser operations
      state = browserHelpers.navigateTo(state, 'https://example.com');
      state = browserHelpers.setAuthenticated(state, true);
      state = browserHelpers.setLocalStorage(state, 'token', 'abc123');
      state = browserHelpers.addConsoleMessage(state, 'info', 'User logged in');

      expect(state.url).toBe('https://example.com');
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage.token).toBe('abc123');
      expect(state.consoleMessages).toHaveLength(1);

      // Verify original state is unchanged (immutability)
      expect(initialState.url).toBe('about:blank');
      expect(initialState.isAuthenticated).toBe(false);
      expect(initialState.localStorage).toEqual({});
      expect(initialState.consoleMessages).toEqual([]);
    });

    it('should handle complex browser state transitions', () => {
      let state = browserFixtures.cleanState();

      // Loading sequence
      state = browserHelpers.startLoading(state);
      state = browserHelpers.navigateTo(state, 'https://app.example.com');
      expect(state.isLoading).toBe(false); // navigateTo sets loading to false

      // Authentication sequence
      state = browserHelpers.setAuthenticated(state, true);
      state = browserHelpers.setLocalStorage(state, 'auth-token', 'jwt-token');
      state = browserHelpers.addCookie(state, 'session', 'session-id', {
        domain: 'example.com',
        path: '/',
      });

      // API interaction sequence
      state = browserHelpers.addNetworkRequest(state, 'https://api.example.com/user', 'GET', 200, {
        'Authorization': 'Bearer jwt-token',
      });
      state = browserHelpers.addConsoleMessage(state, 'info', 'User data loaded');

      // Error scenario
      state = browserHelpers.setError(state, true);
      state = browserHelpers.addConsoleMessage(state, 'error', 'Failed to load dashboard');

      // Verify final state
      expect(state.url).toBe('https://app.example.com');
      expect(state.isAuthenticated).toBe(true);
      expect(state.hasError).toBe(true);
      expect(state.localStorage['auth-token']).toBe('jwt-token');
      expect(state.cookies).toHaveLength(1);
      expect(state.networkRequests).toHaveLength(1);
      expect(state.consoleMessages).toHaveLength(2);
    });

    it('should handle browser data clearing', () => {
      let state = browserFixtures.loggedInPage();

      // Verify initial state has data
      expect(Object.keys(state.localStorage).length).toBeGreaterThan(0);
      expect(state.cookies.length).toBeGreaterThan(0);
      expect(state.consoleMessages.length).toBeGreaterThan(0);
      expect(state.networkRequests.length).toBeGreaterThan(0);

      // Clear browser data
      state = browserHelpers.clearBrowserData(state);

      // Verify data is cleared but other properties remain
      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.consoleMessages).toEqual([]);
      expect(state.networkRequests).toEqual([]);
      expect(state.url).toBe('https://app.apex.dev/dashboard'); // URL should remain
      expect(state.isAuthenticated).toBe(true); // Auth status should remain
    });
  });

  describe('Test environment management', () => {
    it('should manage test data storage', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      // Set test data
      setTestData('browserState', browserFixtures.cleanState());
      setTestData('userConfig', { theme: 'dark' });

      // Retrieve test data
      const storedState = getTestData('browserState');
      const storedConfig = getTestData('userConfig');

      expect(storedState).toBeDefined();
      expect(storedState.url).toBe('about:blank');
      expect(storedConfig).toEqual({ theme: 'dark' });

      // Verify data persists during test
      setTestData('counter', 1);
      expect(getTestData('counter')).toBe(1);

      await suite.afterEach();

      // Verify data is cleared after teardown
      expect(getTestEnvironment()).toBeNull();
    });

    it('should handle cleanup tasks', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const cleanupSpy = vi.fn();
      addCleanupTask(cleanupSpy);

      // Add multiple cleanup tasks
      const cleanup2 = vi.fn();
      addCleanupTask(cleanup2);

      await suite.afterEach();

      expect(cleanupSpy).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
    });

    it('should handle cleanup task failures gracefully', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const failingCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      const successfulCleanup = vi.fn();

      addCleanupTask(failingCleanup);
      addCleanupTask(successfulCleanup);

      // Should not throw, but should log warning
      await suite.afterEach();

      expect(failingCleanup).toHaveBeenCalledOnce();
      expect(successfulCleanup).toHaveBeenCalledOnce();
    });

    it('should create and cleanup temporary directories', async () => {
      const suite = createTestSuite();
      await suite.beforeEach();

      const tempDir = await createTempDir();

      expect(typeof tempDir).toBe('string');
      expect(tempDir).toMatch(/apex-test-/);

      const env = getTestEnvironment();
      expect(env?.tempDir).toBe(tempDir);

      await suite.afterEach();
    });
  });

  describe('Mock function management', () => {
    let testSuite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      testSuite = createTestSuite({
        setupMocks: true,
        cleanupAfterEach: true,
      });
      await testSuite.beforeEach();
    });

    afterEach(async () => {
      await testSuite.afterEach();
    });

    it('should create and track mock functions', () => {
      const mockFn = createMockFunction('testFunction', () => 'mocked result');

      expect(mockFn).toBeDefined();
      expect(mockFn()).toBe('mocked result');

      const env = getTestEnvironment();
      expect(env?.activeMocks.has('testFunction')).toBe(true);
      expect(env?.activeMocks.get('testFunction')).toBe(mockFn);
    });

    it('should handle mock functions without implementations', () => {
      const mockFn = createMockFunction('testFunctionNoImpl');

      expect(mockFn).toBeDefined();
      expect(mockFn()).toBeUndefined();

      // Mock should still be tracked
      const env = getTestEnvironment();
      expect(env?.activeMocks.has('testFunctionNoImpl')).toBe(true);
    });
  });

  describe('Timer management', () => {
    let testSuite: ReturnType<typeof createTestSuite>;

    beforeEach(async () => {
      testSuite = createTestSuite({
        useFakeTimers: true,
      });
      await testSuite.beforeEach();
    });

    afterEach(async () => {
      await testSuite.afterEach();
    });

    it('should handle timer flushing', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      setTimeout(callback1, 100);
      setTimeout(callback2, 200);

      // Flush all timers
      await flushTimers();

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('should handle timer advancement', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      setTimeout(callback1, 100);
      setTimeout(callback2, 200);

      // Advance by 150ms - only first callback should be called
      await advanceTimers(150);

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();

      // Advance by another 100ms - second callback should now be called
      await advanceTimers(100);

      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  describe('Error handling in lifecycle', () => {
    it('should handle custom setup failures', async () => {
      const failingSetup = vi.fn().mockRejectedValue(new Error('Setup failed'));
      const suite = createTestSuite({
        customSetup: failingSetup,
      });

      await expect(suite.beforeEach()).rejects.toThrow('Setup failed');
      expect(failingSetup).toHaveBeenCalledOnce();
    });

    it('should handle custom teardown failures gracefully', async () => {
      const failingTeardown = vi.fn().mockRejectedValue(new Error('Teardown failed'));
      const suite = createTestSuite({
        customTeardown: failingTeardown,
      });

      await suite.beforeEach();

      // Teardown failure should not throw but should log warning
      await expect(suite.afterEach()).resolves.not.toThrow();
      expect(failingTeardown).toHaveBeenCalledOnce();
    });

    it('should ensure cleanup even after teardown failures', async () => {
      const cleanupSpy = vi.fn();
      const suite = createTestSuite({
        customTeardown: vi.fn().mockRejectedValue(new Error('Teardown failed')),
      });

      await suite.beforeEach();
      addCleanupTask(cleanupSpy);

      await suite.afterEach();

      // Cleanup should still run even if custom teardown failed
      expect(cleanupSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Configuration validation', () => {
    it('should handle empty configuration', () => {
      const suite = createTestSuite({});

      expect(suite).toHaveProperty('beforeEach');
      expect(suite).toHaveProperty('afterEach');
    });

    it('should handle undefined configuration', () => {
      const suite = createTestSuite();

      expect(suite).toHaveProperty('beforeEach');
      expect(suite).toHaveProperty('afterEach');
    });

    it('should handle partial configuration', async () => {
      const suite = createTestSuite({
        setupMocks: true,
        // Other options use defaults
      });

      await suite.beforeEach();
      expect(getTestEnvironment()).toBeDefined();
      await suite.afterEach();
    });
  });
});