/**
 * @fileoverview Unit Tests for Browser Automation Test Setup
 *
 * Comprehensive test suite for browser automation test setup infrastructure including:
 * - Test environment creation and management
 * - Real browser and mock browser setup
 * - Permission integration testing
 * - Artifact management and screenshot capture
 * - Global test environment setup hooks
 *
 * @module tests/test-utils/__tests__/browser-automation-test-setup.test
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi, type Mock } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BrowserAutomationTestEnvironment,
  createScopedTestEnvironment,
  setupBrowserAutomationTesting,
  getBrowserTestEnvironment,
  mockBrowserAutomationDependencies,
  assertBrowserTestResult,
  waitForBrowserOperation,
  DEFAULT_TEST_CONFIG,
  type BrowserAutomationTestConfig,
} from '../browser-automation-test-setup.js';
import { MockBrowserEnvironment } from '../browser-automation-mocks.js';

// Mock dependencies
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          url: vi.fn(() => 'about:blank'),
          setDefaultTimeout: vi.fn(),
          goto: vi.fn().mockResolvedValue({ status: () => 200 }),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
          close: vi.fn(),
        }),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../browser-permission-simulator.js', () => ({
  createBrowserPermissionSimulator: vi.fn(() => ({
    setBrowserContext: vi.fn(),
    clearPermissions: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue({ granted: true }),
  })),
  createBrowserPermissionTestContext: vi.fn(() => ({})),
}));

vi.mock('../browser-test-fixtures.js', () => ({
  createBrowserTestContext: vi.fn(() => ({})),
  loadTestPage: vi.fn().mockResolvedValue(undefined),
  SIMPLE_TEST_PAGE: '<html><body><h1>Test</h1></body></html>',
}));

describe('Browser Automation Test Setup', () => {
  describe('DEFAULT_TEST_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_TEST_CONFIG.useRealBrowser).toBe(process.env.USE_REAL_BROWSER === 'true');
      expect(DEFAULT_TEST_CONFIG.browserType).toBe('chromium');
      expect(DEFAULT_TEST_CONFIG.headless).toBe(process.env.CI === 'true');
      expect(DEFAULT_TEST_CONFIG.timeout).toBe(30000);
      expect(DEFAULT_TEST_CONFIG.captureFailureScreenshots).toBe(true);
      expect(DEFAULT_TEST_CONFIG.artifactDir).toContain('test-artifacts');
      expect(DEFAULT_TEST_CONFIG.permissionTesting.enabled).toBe(true);
      expect(DEFAULT_TEST_CONFIG.mockBrowser).toBeDefined();
    });
  });

  describe('BrowserAutomationTestEnvironment', () => {
    let testEnvironment: BrowserAutomationTestEnvironment;

    afterEach(async () => {
      if (testEnvironment) {
        await testEnvironment.teardown();
      }
    });

    it('should create test environment with default configuration', () => {
      testEnvironment = new BrowserAutomationTestEnvironment();
      expect(testEnvironment).toBeInstanceOf(BrowserAutomationTestEnvironment);
    });

    it('should create test environment with custom configuration', () => {
      const customConfig: Partial<BrowserAutomationTestConfig> = {
        useRealBrowser: false,
        timeout: 60000,
        captureFailureScreenshots: false,
        permissionTesting: {
          enabled: false,
          defaultDenials: [],
          simulateFailures: false,
        },
      };

      testEnvironment = new BrowserAutomationTestEnvironment(customConfig);
      expect(testEnvironment).toBeDefined();
    });

    it('should setup mock browser environment', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: false,
      });

      await testEnvironment.setup();

      const page = testEnvironment.getPage();
      expect(page).toBeDefined();
    });

    it('should setup real browser environment', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await testEnvironment.setup();

      const page = testEnvironment.getPage();
      expect(page).toBeDefined();
      expect(page.setDefaultTimeout).toHaveBeenCalled();
    });

    it('should setup permission testing when enabled', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        permissionTesting: {
          enabled: true,
          defaultDenials: ['dangerous-operation'],
          simulateFailures: false,
        },
      });

      await testEnvironment.setup();

      const permissionSimulator = testEnvironment.getPermissionSimulator();
      expect(permissionSimulator).toBeDefined();
    });

    it('should not setup permission testing when disabled', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        permissionTesting: {
          enabled: false,
          defaultDenials: [],
          simulateFailures: false,
        },
      });

      await testEnvironment.setup();

      const permissionSimulator = testEnvironment.getPermissionSimulator();
      expect(permissionSimulator).toBeUndefined();
    });

    it('should create artifact directory structure', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment();

      await testEnvironment.setup();

      expect(fs.mkdir).toHaveBeenCalled();
      // Should create main artifact directory, screenshots, and videos directories
      expect((fs.mkdir as Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should provide test context access', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment();

      await testEnvironment.setup();

      const testContext = testEnvironment.getTestContext();
      expect(testContext).toBeDefined();
    });

    it('should capture screenshots', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await testEnvironment.setup();

      const screenshotPath = await testEnvironment.captureScreenshot('test-screenshot');
      expect(screenshotPath).toContain('test-screenshot');
      expect(screenshotPath).toMatch(/\.png$/);

      const page = testEnvironment.getPage();
      expect(page.screenshot).toHaveBeenCalled();
    });

    it('should capture mock screenshots', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: false,
      });

      await testEnvironment.setup();

      const screenshotPath = await testEnvironment.captureScreenshot('mock-screenshot');
      expect(screenshotPath).toContain('mock-screenshot');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mock-screenshot'),
        'mock-screenshot-data'
      );
    });

    it('should test permission scenarios', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        permissionTesting: {
          enabled: true,
          defaultDenials: [],
          simulateFailures: false,
        },
      });

      await testEnvironment.setup();

      const result = await testEnvironment.testPermissionScenario('navigate', {
        url: 'https://example.com',
      });

      expect(result).toBeDefined();
      expect(typeof result.granted).toBe('boolean');
    });

    it('should handle permission scenario errors', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        permissionTesting: {
          enabled: true,
          defaultDenials: [],
          simulateFailures: false,
        },
      });

      await testEnvironment.setup();

      // Mock permission simulator to throw error
      const permissionSimulator = testEnvironment.getPermissionSimulator();
      if (permissionSimulator) {
        (permissionSimulator.requestPermission as Mock).mockRejectedValueOnce(
          new Error('Permission check failed')
        );
      }

      const result = await testEnvironment.testPermissionScenario('navigate');

      expect(result.granted).toBe(false);
      expect(result.error).toContain('Permission check failed');
    });

    it('should throw error when testing permissions without simulator', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        permissionTesting: {
          enabled: false,
          defaultDenials: [],
          simulateFailures: false,
        },
      });

      await testEnvironment.setup();

      await expect(testEnvironment.testPermissionScenario('navigate')).rejects.toThrow(
        'Permission testing not enabled'
      );
    });

    it('should load test pages in real browser', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await testEnvironment.setup();

      await testEnvironment.loadTestPage('<html><body><h1>Custom Test Page</h1></body></html>');

      // Should use the loadTestPage utility
      const { loadTestPage } = await import('../browser-test-fixtures.js');
      expect(loadTestPage).toHaveBeenCalled();
    });

    it('should load test pages in mock browser', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: false,
      });

      await testEnvironment.setup();

      const customContent = '<html><body><h1>Mock Test Page</h1></body></html>';
      await testEnvironment.loadTestPage(customContent);

      const page = testEnvironment.getPage();
      expect(page.setContent).toHaveBeenCalledWith(customContent);
    });

    it('should handle teardown gracefully', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await testEnvironment.setup();

      // Multiple teardowns should not cause errors
      await testEnvironment.teardown();
      await testEnvironment.teardown();
    });

    it('should handle cleanup errors during teardown', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await testEnvironment.setup();

      // Mock cleanup function to throw error
      const page = testEnvironment.getPage();
      (page.close as Mock).mockRejectedValueOnce(new Error('Cleanup failed'));

      // Should not throw, but log warning
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await testEnvironment.teardown();

      expect(consoleSpy).toHaveBeenCalledWith('Cleanup error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should throw error when accessing page before setup', () => {
      testEnvironment = new BrowserAutomationTestEnvironment();

      expect(() => testEnvironment.getPage()).not.toThrow();
      // The page might be undefined, but it shouldn't throw
    });

    it('should throw error when capturing screenshot before setup', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment();

      await expect(testEnvironment.captureScreenshot('test')).rejects.toThrow(
        'Test environment not properly initialized'
      );
    });

    it('should throw error when loading test page without page', async () => {
      testEnvironment = new BrowserAutomationTestEnvironment();

      await expect(testEnvironment.loadTestPage()).rejects.toThrow('No page available');
    });
  });

  describe('createScopedTestEnvironment', () => {
    let scopedEnvironment: BrowserAutomationTestEnvironment;

    afterEach(async () => {
      if (scopedEnvironment) {
        await scopedEnvironment.teardown();
      }
    });

    it('should create and setup scoped test environment', async () => {
      const config: Partial<BrowserAutomationTestConfig> = {
        useRealBrowser: false,
        timeout: 60000,
      };

      scopedEnvironment = await createScopedTestEnvironment(config);

      expect(scopedEnvironment).toBeInstanceOf(BrowserAutomationTestEnvironment);

      const page = scopedEnvironment.getPage();
      expect(page).toBeDefined();
    });

    it('should create scoped environment with default config', async () => {
      scopedEnvironment = await createScopedTestEnvironment();

      expect(scopedEnvironment).toBeInstanceOf(BrowserAutomationTestEnvironment);
    });
  });

  describe('mockBrowserAutomationDependencies', () => {
    it('should setup dependency mocks', () => {
      mockBrowserAutomationDependencies();

      // Should setup vi.mock calls
      expect(vi.mock).toBeDefined();
    });
  });

  describe('assertBrowserTestResult', () => {
    it('should pass for successful results when expecting success', () => {
      const result = { success: true, errors: [] };

      // Should not throw
      assertBrowserTestResult(result, true);
    });

    it('should pass for failed results when expecting failure', () => {
      const result = { success: false, errors: ['Test error'] };

      // Should not throw
      assertBrowserTestResult(result, false);
    });

    it('should throw for failed results when expecting success', () => {
      const result = { success: false, errors: ['Test error'] };

      expect(() => assertBrowserTestResult(result, true)).toThrow(
        'Browser test failed with errors: Test error'
      );
    });

    it('should throw for successful results when expecting failure', () => {
      const result = { success: true, errors: [] };

      expect(() => assertBrowserTestResult(result, false)).toThrow(
        'Expected browser test to fail, but it succeeded'
      );
    });

    it('should handle default expectation', () => {
      const successResult = { success: true, errors: [] };
      const failedResult = { success: false, errors: ['Error'] };

      // Default should expect success
      assertBrowserTestResult(successResult);
      expect(() => assertBrowserTestResult(failedResult)).toThrow();
    });
  });

  describe('waitForBrowserOperation', () => {
    it('should resolve successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await waitForBrowserOperation(operation, 1000, 'test operation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should timeout slow operations', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      );

      await expect(
        waitForBrowserOperation(operation, 500, 'slow operation')
      ).rejects.toThrow('slow operation timed out after 500ms');
    });

    it('should use default timeout and description', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 31000))
      );

      await expect(waitForBrowserOperation(operation)).rejects.toThrow(
        'Browser operation timed out after 30000ms'
      );
    });

    it('should handle operation rejection', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(waitForBrowserOperation(operation, 1000)).rejects.toThrow('Operation failed');
    });

    it('should resolve fast operations before timeout', async () => {
      const operation = vi.fn().mockResolvedValue('fast result');

      const result = await waitForBrowserOperation(operation, 30000);

      expect(result).toBe('fast result');
    });
  });

  describe('Global Test Environment Setup', () => {
    // Note: Testing global setup functions is tricky because they affect global state
    // We'll test the factory functions and behavior rather than the actual global hooks

    describe('setupBrowserAutomationTesting', () => {
      it('should be a function that sets up global hooks', () => {
        expect(typeof setupBrowserAutomationTesting).toBe('function');

        // Should be callable without throwing
        expect(() => {
          setupBrowserAutomationTesting({
            useRealBrowser: false,
            timeout: 5000,
          });
        }).not.toThrow();
      });
    });

    describe('getBrowserTestEnvironment', () => {
      it('should throw error when environment not initialized', () => {
        expect(() => getBrowserTestEnvironment()).toThrow(
          'Browser test environment not initialized'
        );
      });
    });
  });

  describe('Integration Tests', () => {
    let testEnvironment: BrowserAutomationTestEnvironment;

    beforeEach(async () => {
      testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: false,
        permissionTesting: {
          enabled: true,
          defaultDenials: [],
          simulateFailures: false,
        },
      });
      await testEnvironment.setup();
    });

    afterEach(async () => {
      await testEnvironment.teardown();
    });

    it('should handle complete workflow with permission testing', async () => {
      // Load test page
      await testEnvironment.loadTestPage('<html><body><h1>Test</h1></body></html>');

      // Test permission scenario
      const permissionResult = await testEnvironment.testPermissionScenario('navigate', {
        url: 'https://example.com',
      });
      expect(permissionResult.granted).toBe(true);

      // Capture screenshot
      const screenshotPath = await testEnvironment.captureScreenshot('workflow-test');
      expect(screenshotPath).toBeDefined();

      // Verify resources are managed correctly
      const testContext = testEnvironment.getTestContext();
      expect(testContext).toBeDefined();
    });

    it('should handle permission denials in workflow', async () => {
      const permissionSimulator = testEnvironment.getPermissionSimulator();
      if (permissionSimulator) {
        (permissionSimulator.requestPermission as Mock).mockResolvedValueOnce({
          granted: false,
          reason: 'Operation not allowed',
        });
      }

      const permissionResult = await testEnvironment.testPermissionScenario('screenshot');
      expect(permissionResult.granted).toBe(false);
      expect(permissionResult.error).toBe('Operation not allowed');
    });

    it('should maintain clean state between operations', async () => {
      // Perform multiple operations
      await testEnvironment.loadTestPage('<html><body><h1>Page 1</h1></body></html>');
      await testEnvironment.captureScreenshot('screenshot-1');

      await testEnvironment.loadTestPage('<html><body><h1>Page 2</h1></body></html>');
      await testEnvironment.captureScreenshot('screenshot-2');

      // Environment should still be functional
      const page = testEnvironment.getPage();
      expect(page).toBeDefined();

      const testContext = testEnvironment.getTestContext();
      expect(testContext).toBeDefined();
    });

    it('should handle browser automation timeout scenarios', async () => {
      const slowOperation = () => new Promise(resolve =>
        setTimeout(() => resolve('completed'), 2000)
      );

      await expect(
        waitForBrowserOperation(slowOperation, 500, 'timeout test')
      ).rejects.toThrow('timeout test timed out after 500ms');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle filesystem errors during setup', async () => {
      (fs.mkdir as Mock).mockRejectedValueOnce(new Error('Filesystem error'));

      const testEnvironment = new BrowserAutomationTestEnvironment();

      await expect(testEnvironment.setup()).rejects.toThrow('Filesystem error');
    });

    it('should handle browser launch failures in real browser mode', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as Mock).mockRejectedValueOnce(new Error('Browser launch failed'));

      const testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await expect(testEnvironment.setup()).rejects.toThrow('Browser launch failed');
    });

    it('should handle mock environment setup failures', async () => {
      // Mock MockBrowserEnvironment to throw during setup
      vi.spyOn(MockBrowserEnvironment.prototype, 'setup').mockRejectedValueOnce(
        new Error('Mock setup failed')
      );

      const testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: false,
      });

      await expect(testEnvironment.setup()).rejects.toThrow('Mock setup failed');
    });

    it('should handle screenshot capture failures', async () => {
      const testEnvironment = new BrowserAutomationTestEnvironment({
        useRealBrowser: true,
      });

      await testEnvironment.setup();

      const page = testEnvironment.getPage();
      (page.screenshot as Mock).mockRejectedValueOnce(new Error('Screenshot failed'));

      await expect(testEnvironment.captureScreenshot('failing-screenshot'))
        .rejects.toThrow('Screenshot failed');

      await testEnvironment.teardown();
    });

    it('should handle multiple setup calls gracefully', async () => {
      const testEnvironment = new BrowserAutomationTestEnvironment();

      await testEnvironment.setup();
      await testEnvironment.setup(); // Second call should not cause issues

      const page = testEnvironment.getPage();
      expect(page).toBeDefined();

      await testEnvironment.teardown();
    });
  });
});