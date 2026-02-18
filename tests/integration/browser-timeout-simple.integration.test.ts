/**
 * Simple Browser Timeout Integration Tests
 *
 * Basic timeout testing for browser navigation functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  }
}));

// Mock console stream
vi.mock('../../packages/orchestrator/src/browser-console-stream', () => ({
  BrowserConsoleStream: vi.fn(() => ({
    startStream: vi.fn(),
    stopStream: vi.fn(),
    clearBuffers: vi.fn(),
    on: vi.fn(),
  }))
}));

const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve())
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve())
};

describe('Simple Browser Timeout Integration', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;

  beforeEach(async () => {
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium'
    });

    // Grant permissions for browser operations
    await permissionManager.grantPermission('Browser', 'allow-always');

    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Basic Timeout Scenarios', () => {
    it('should handle navigation timeout error', async () => {
      // Configure mock to simulate timeout
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout exceeded'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow-site.example.com', timeout: 1000 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation timeout');
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should handle successful navigation with custom timeout', async () => {
      // Configure mock for successful navigation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Example Site');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com', timeout: 5000 }
      });

      expect(result.success).toBe(true);
      expect(result.data?.url).toBe('https://example.com');
      expect(result.data?.status).toBe(200);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 5000
      });
    });

    it('should pass through different timeout values', async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://timeout-test.com');
      mockPage.title.mockResolvedValue('Timeout Test');

      const timeouts = [500, 2000, 10000, 30000];

      for (const timeout of timeouts) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://timeout-test.com', timeout }
        });

        expect(mockPage.goto).toHaveBeenLastCalledWith('https://timeout-test.com', {
          waitUntil: 'load',
          timeout
        });
      }
    });

    it('should handle different wait conditions with timeout', async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://waituntil-test.com');
      mockPage.title.mockResolvedValue('Wait Until Test');

      const waitConditions = ['load', 'domcontentloaded', 'networkidle'] as const;

      for (const waitUntil of waitConditions) {
        await browserTool.execute({
          operation: 'navigate',
          params: {
            url: 'https://waituntil-test.com',
            waitUntil,
            timeout: 3000
          }
        });

        const expectedWaitUntil = waitUntil === 'networkidle' ? 'networkidle' : waitUntil;
        expect(mockPage.goto).toHaveBeenLastCalledWith('https://waituntil-test.com', {
          waitUntil: expectedWaitUntil,
          timeout: 3000
        });
      }
    });

    it('should handle timeout without custom value', async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://no-timeout.com');
      mockPage.title.mockResolvedValue('No Timeout Test');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://no-timeout.com' }
      });

      expect(mockPage.goto).toHaveBeenCalledWith('https://no-timeout.com', {
        waitUntil: 'load',
        timeout: undefined
      });
    });
  });

  describe('Error Handling', () => {
    it('should provide clear timeout error messages', async () => {
      const timeoutError = new Error('Navigation timeout of 2000ms exceeded');
      mockPage.goto.mockRejectedValue(timeoutError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://timeout-error.com', timeout: 2000 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation timeout of 2000ms exceeded');
      expect(result.metadata?.target).toBe('https://timeout-error.com');
    });

    it('should handle network timeout errors', async () => {
      const networkError = new Error('net::ERR_CONNECTION_TIMED_OUT');
      mockPage.goto.mockRejectedValue(networkError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://unreachable.com', timeout: 1000 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ERR_CONNECTION_TIMED_OUT');
    });

    it('should maintain browser state after timeout', async () => {
      const timeoutError = new Error('Timeout occurred');
      mockPage.goto.mockRejectedValue(timeoutError);

      // First request times out
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://timeout1.com', timeout: 1000 }
      });

      expect(result1.success).toBe(false);
      expect(browserTool.isActive()).toBe(true);

      // Second request should work
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://success.com');
      mockPage.title.mockResolvedValue('Success Page');

      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://success.com' }
      });

      expect(result2.success).toBe(true);
    });
  });
});