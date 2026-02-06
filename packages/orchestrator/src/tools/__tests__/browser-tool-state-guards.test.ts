/**
 * BrowserTool State Guards Test Suite
 *
 * Comprehensive tests for the state guard implementation in BrowserTool.
 * Focuses specifically on the state checking logic in ensurePage() and execute() methods
 * to ensure proper protection against invalid operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserTool } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { EventEmitter } from 'eventemitter3';
import { ApexError, ApexErrorCode } from '@apexcli/core';

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot-data'))),
  evaluate: vi.fn(),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(() => Promise.resolve('test-attribute')),
  textContent: vi.fn(() => Promise.resolve('test content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>test</div>')),
  content: vi.fn(() => Promise.resolve('<!DOCTYPE html><html><body>test</body></html>')),
  hover: vi.fn(),
  close: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
    scrollIntoViewIfNeeded: vi.fn(),
    evaluate: vi.fn(),
  })),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('BrowserTool State Guards', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock browser responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create mock permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: [],
        blockedDomains: [],
      })),
    } as any;

    eventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter,
    });
  });

  afterEach(async () => {
    try {
      await browserTool.destroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Execute State Guards', () => {
    it('should block all operation types when destroyed', async () => {
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'compareScreenshot', params: { baselinePath: '/tmp/baseline.png' } },
        { operation: 'evaluate', params: { script: 'document.title' } },
        { operation: 'submit', params: { selector: '#form' } },
        { operation: 'waitForSelector', params: { selector: '#element' } },
        { operation: 'getAttribute', params: { selector: '#link', attribute: 'href' } },
        { operation: 'getText', params: { selector: '#content' } },
        { operation: 'getHtml', params: { selector: '#container' } },
        { operation: 'scroll', params: { x: 0, y: 100 } },
        { operation: 'hover', params: { selector: '#menu' } },
      ] as const;

      for (const operationParams of operations) {
        const result = await browserTool.execute(operationParams);

        expect(result.success).toBe(false);
        expect(result.operation).toBe(operationParams.operation);
        expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');
        expect(result.metadata).toMatchObject({
          url: 'about:blank',
          executionTime: expect.any(Number),
          permissionGranted: false,
          target: expect.any(String),
        });
      }
    });

    it('should block all operation types when cleaning up', async () => {
      // First activate the tool
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock slow cleanup
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);

      // Start cleanup
      const cleanupInProgress = browserTool.cleanup();

      // Wait for cleanup to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(browserTool.getState()).toBe('cleaning_up');

      const operations = [
        { operation: 'navigate', params: { url: 'https://example2.com' } },
        { operation: 'click', params: { selector: '#button2' } },
        { operation: 'type', params: { selector: '#input2', text: 'test2' } },
        { operation: 'screenshot', params: { fullPage: false } },
        { operation: 'evaluate', params: { script: 'console.log("test")' } },
      ] as const;

      for (const operationParams of operations) {
        const result = await browserTool.execute(operationParams);

        expect(result.success).toBe(false);
        expect(result.operation).toBe(operationParams.operation);
        expect(result.error).toBe('Cannot execute operation: BrowserTool instance is currently cleaning up');
        expect(result.metadata).toMatchObject({
          url: 'about:blank',
          executionTime: expect.any(Number),
          permissionGranted: false,
          target: expect.any(String),
        });
      }

      // Complete cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });

    it('should allow operations in valid states (idle, active)', async () => {
      // Test idle state (first operation)
      expect(browserTool.getState()).toBe('idle');

      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result1.success).toBe(true);
      expect(browserTool.getState()).toBe('active');

      // Test active state (subsequent operation)
      const result2 = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(result2.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
    });

    it('should provide correct metadata for blocked operations', async () => {
      await browserTool.destroy();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com/page' },
      });

      expect(result.metadata).toMatchObject({
        url: 'about:blank',
        executionTime: expect.any(Number),
        permissionGranted: false,
        target: 'https://test.com/page',
      });

      // Execution time should be very short since operation was blocked
      expect(result.metadata!.executionTime).toBeLessThan(100);
    });
  });

  describe('EnsurePage State Guards (via Execute)', () => {
    it('should block page launch attempts when destroyed', async () => {
      await browserTool.destroy();
      expect(browserTool.getState()).toBe('destroyed');

      // Operations that would trigger page launch
      const pageRequiringOperations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'document.title' } },
      ] as const;

      for (const operationParams of pageRequiringOperations) {
        const result = await browserTool.execute(operationParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');

        // Verify browser was not launched
        expect(mockBrowserType.launch).not.toHaveBeenCalled();
      }
    });

    it('should block page launch attempts during cleanup', async () => {
      // First activate
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Clear launch calls from activation
      vi.clearAllMocks();

      // Mock slow cleanup
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);

      // Start cleanup
      const cleanupInProgress = browserTool.cleanup();

      // Wait for cleanup to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(browserTool.getState()).toBe('cleaning_up');

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance is currently cleaning up');

      // Verify no new browser launch was attempted
      expect(mockBrowserType.launch).not.toHaveBeenCalled();

      // Complete cleanup
      cleanupResolve!();
      await cleanupInProgress;
    });

    it('should allow page launch in valid states', async () => {
      expect(browserTool.getState()).toBe('idle');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(browserTool.getState()).toBe('active');
      expect(mockBrowserType.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Guard Error Consistency', () => {
    it('should provide consistent error messages across different operation types', async () => {
      await browserTool.destroy();

      const operations = [
        'navigate', 'click', 'type', 'screenshot', 'evaluate'
      ] as const;

      const results: Array<{ operation: string; error: string }> = [];

      for (const operation of operations) {
        const result = await browserTool.execute({
          operation,
          params: operation === 'navigate'
            ? { url: 'https://example.com' }
            : operation === 'click'
            ? { selector: '#button' }
            : operation === 'type'
            ? { selector: '#input', text: 'test' }
            : operation === 'screenshot'
            ? { fullPage: true }
            : { script: 'test' }
        });

        results.push({ operation, error: result.error || 'no error' });
      }

      // All operations should have the same error message
      const expectedError = 'Cannot execute operation: BrowserTool instance has been destroyed';
      for (const result of results) {
        expect(result.error).toBe(expectedError);
      }
    });

    it('should provide consistent error format for different states', async () => {
      // Test destroyed state
      await browserTool.destroy();

      const destroyedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(destroyedResult.error).toMatch(/^Cannot execute operation: BrowserTool instance has been destroyed$/);

      // Reset and test cleaning_up state
      browserTool = new BrowserTool({
        permissionManager: mockPermissionManager,
        eventEmitter,
      });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Mock slow cleanup
      let cleanupResolve: Function;
      const cleanupPromise = new Promise((resolve) => {
        cleanupResolve = resolve;
      });

      mockPage.close.mockImplementation(() => cleanupPromise);
      const cleanupInProgress = browserTool.cleanup();
      await new Promise(resolve => setTimeout(resolve, 5));

      const cleanupResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      expect(cleanupResult.error).toMatch(/^Cannot execute operation: BrowserTool instance is currently cleaning up$/);

      cleanupResolve!();
      await cleanupInProgress;
    });
  });

  describe('State Guard Integration with Permission System', () => {
    it('should check state before permission checks', async () => {
      await browserTool.destroy();

      // Mock permission manager to track if it's called
      const permissionCheckSpy = vi.spyOn(mockPermissionManager, 'checkToolPermission');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot execute operation: BrowserTool instance has been destroyed');

      // Permission check should not have been called because state guard blocked it first
      expect(permissionCheckSpy).not.toHaveBeenCalled();
    });

    it('should allow permission checks to proceed when state is valid', async () => {
      const permissionCheckSpy = vi.spyOn(mockPermissionManager, 'checkToolPermission');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(permissionCheckSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Case: Rapid State Changes', () => {
    it('should handle rapid execute/destroy cycles', async () => {
      for (let i = 0; i < 3; i++) {
        // Activate
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example${i}.com` },
        });

        expect(result.success).toBe(true);
        expect(browserTool.getState()).toBe('active');

        // Destroy
        await browserTool.destroy();
        expect(browserTool.getState()).toBe('destroyed');

        // Try operation after destroy
        const blockedResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#button' },
        });

        expect(blockedResult.success).toBe(false);

        // Create new instance for next iteration
        if (i < 2) {
          browserTool = new BrowserTool({
            permissionManager: mockPermissionManager,
            eventEmitter,
          });
        }
      }
    });

    it('should maintain state consistency during concurrent operations', async () => {
      // Start multiple operations simultaneously on fresh instance
      const operations = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example1.com' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example2.com' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example3.com' } }),
      ];

      const results = await Promise.all(operations);

      // All should succeed and tool should be in active state
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      expect(browserTool.getState()).toBe('active');
    });
  });
});