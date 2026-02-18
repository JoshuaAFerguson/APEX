/**
 * Browser Tool Resource Cleanup Tests
 *
 * Tests the resource cleanup and destroy functionality of BrowserTool:
 * - cleanup() method for graceful resource release
 * - destroy() method for forceful resource reset
 * - Idempotency of both methods (safe to call multiple times)
 * - Proper resource state management and reference nullification
 * - Console stream cleanup integration
 * - Error handling during cleanup scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool, BrowserToolConfig } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionLevel, ApexError, ApexErrorCode } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';

// Mock Console Stream
const mockConsoleStream = {
  stopStream: vi.fn(),
  clearBuffers: vi.fn(),
  on: vi.fn(),
  startStream: vi.fn(),
};

// Mock BrowserConsoleStream
vi.mock('../browser-console-stream', () => ({
  BrowserConsoleStream: vi.fn(() => mockConsoleStream),
}));

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  close: vi.fn(),
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

// Mock Puppeteer
const mockPuppeteerPage = {
  close: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: 200 })),
  on: vi.fn(),
  setViewport: vi.fn(),
  setUserAgent: vi.fn(),
};

const mockPuppeteerBrowser = {
  newPage: vi.fn(() => Promise.resolve(mockPuppeteerPage)),
  close: vi.fn(),
};

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(() => Promise.resolve(mockPuppeteerBrowser)),
  },
}));

describe('BrowserTool Resource Cleanup', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock implementations to success by default
    mockPage.close.mockResolvedValue(undefined);
    mockContext.close.mockResolvedValue(undefined);
    mockBrowser.close.mockResolvedValue(undefined);
    mockPuppeteerPage.close.mockResolvedValue(undefined);
    mockPuppeteerBrowser.close.mockResolvedValue(undefined);
    mockConsoleStream.stopStream.mockReturnValue(undefined);

    // Setup mock browser responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockBrowserType.launch.mockResolvedValue(mockBrowser);

    // Create mock permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: [],
        blockedDomains: [],
        consoleStream: { enabled: true },
      } as BrowserToolConfig)),
    } as any;

    eventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter,
    });
  });

  afterEach(async () => {
    // Cleanup any remaining resources
    try {
      await browserTool.destroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('cleanup() method', () => {
    it('should cleanup resources when no browser has been initialized', async () => {
      const initialResourceState = browserTool.getResourceState();
      expect(initialResourceState.browserActive).toBe(false);
      expect(initialResourceState.contextActive).toBe(false);
      expect(initialResourceState.pageActive).toBe(false);

      // Should complete without error even with no resources
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // State should remain clean
      const finalResourceState = browserTool.getResourceState();
      expect(finalResourceState.browserActive).toBe(false);
      expect(finalResourceState.contextActive).toBe(false);
      expect(finalResourceState.pageActive).toBe(false);
    });

    it('should cleanup resources after browser initialization', async () => {
      // Initialize browser by performing an operation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Verify resources are active
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.contextActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);

      // Cleanup should succeed
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Verify resources are properly closed
      expect(mockConsoleStream.stopStream).toHaveBeenCalled();
      expect(mockConsoleStream.clearBuffers).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();

      // Verify resource state is updated
      const finalResourceState = browserTool.getResourceState();
      expect(finalResourceState.browserActive).toBe(false);
      expect(finalResourceState.contextActive).toBe(false);
      expect(finalResourceState.pageActive).toBe(false);
      expect(finalResourceState.activeOperations).toBe(0);
    });

    it('should cleanup puppeteer resources when using puppeteer backend', async () => {
      // Create browser tool with puppeteer backend
      const puppeteerTool = new BrowserTool({
        permissionManager: mockPermissionManager,
        backend: 'puppeteer',
      });

      // Initialize by performing an operation
      await puppeteerTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Cleanup should handle puppeteer resources
      await expect(puppeteerTool.cleanup()).resolves.not.toThrow();

      expect(mockPuppeteerPage.close).toHaveBeenCalled();
      expect(mockPuppeteerBrowser.close).toHaveBeenCalled();
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // First cleanup
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Second cleanup should also succeed without error
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Third cleanup should also succeed
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Resources should still be in clean state
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
    });

    it('should handle partial cleanup failures gracefully', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Make page close fail but others succeed
      mockPage.close.mockRejectedValue(new Error('Page close failed'));

      // Cleanup should still proceed and complete
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Other resources should still be cleaned up
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();

      // Resource state should still be updated correctly
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
    });

    it('should handle console stream cleanup failure gracefully', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Make console stream stop fail
      mockConsoleStream.stopStream.mockImplementation(() => {
        throw new Error('Stream stop failed');
      });

      // Cleanup should still proceed
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Other cleanup should still proceed
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should throw ApexError if cleanup completely fails', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Make all close operations fail
      const errorMessage = 'Complete cleanup failure';
      mockPage.close.mockRejectedValue(new Error(errorMessage));
      mockContext.close.mockRejectedValue(new Error(errorMessage));
      mockBrowser.close.mockRejectedValue(new Error(errorMessage));
      mockConsoleStream.stopStream.mockRejectedValue(new Error(errorMessage));

      // Simulate a failure that prevents the try-catch from working
      // by mocking clearConsoleBuffers to throw
      const originalClearBuffers = browserTool.clearConsoleBuffers;
      browserTool.clearConsoleBuffers = vi.fn(() => {
        throw new Error('Buffer clear failed');
      });

      await expect(browserTool.cleanup()).rejects.toThrow(ApexError);

      // Restore original method
      browserTool.clearConsoleBuffers = originalClearBuffers;
    });
  });

  describe('destroy() method', () => {
    it('should successfully destroy clean browser tool', async () => {
      // Should succeed even without any initialization
      await expect(browserTool.destroy()).resolves.not.toThrow();

      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
    });

    it('should destroy resources after browser initialization', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const originalSessionId = browserTool.getResourceState().sessionId;

      // Destroy should succeed
      await expect(browserTool.destroy()).resolves.not.toThrow();

      // Verify cleanup was called
      expect(mockConsoleStream.stopStream).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();

      // Verify resource state is clean
      const finalResourceState = browserTool.getResourceState();
      expect(finalResourceState.browserActive).toBe(false);
      expect(finalResourceState.contextActive).toBe(false);
      expect(finalResourceState.pageActive).toBe(false);
      expect(finalResourceState.activeOperations).toBe(0);
      expect(finalResourceState.currentUrl).toBeUndefined();
      expect(finalResourceState.lastAllocation).toBeUndefined();
    });

    it('should force reset when normal cleanup fails', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const originalSessionId = browserTool.getResourceState().sessionId;

      // Make cleanup fail by making console stream operations throw
      mockConsoleStream.stopStream.mockImplementation(() => {
        throw new Error('Stream stop failed');
      });

      // Mock clearConsoleBuffers to throw during cleanup
      const originalClearBuffers = browserTool.clearConsoleBuffers;
      browserTool.clearConsoleBuffers = vi.fn(() => {
        throw new Error('Buffer clear failed');
      });

      // Destroy should still succeed by force resetting
      await expect(browserTool.destroy()).resolves.not.toThrow();

      // Verify resource state is clean after force reset
      const finalResourceState = browserTool.getResourceState();
      expect(finalResourceState.browserActive).toBe(false);
      expect(finalResourceState.contextActive).toBe(false);
      expect(finalResourceState.pageActive).toBe(false);
      expect(finalResourceState.activeOperations).toBe(0);
      expect(finalResourceState.currentUrl).toBeUndefined();
      expect(finalResourceState.lastAllocation).toBeUndefined();

      // Session ID should be regenerated
      expect(finalResourceState.sessionId).not.toBe(originalSessionId);

      // Console messages should be cleared
      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      expect(browserTool.getEnhancedRuntimeErrors()).toHaveLength(0);

      // Restore original method
      browserTool.clearConsoleBuffers = originalClearBuffers;
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // First destroy
      await expect(browserTool.destroy()).resolves.not.toThrow();

      // Second destroy should also succeed
      await expect(browserTool.destroy()).resolves.not.toThrow();

      // Third destroy should also succeed
      await expect(browserTool.destroy()).resolves.not.toThrow();

      // Resources should remain clean
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
    });

    it('should handle mixed backend cleanup properly', async () => {
      // Initialize with playwright
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Manually set some puppeteer references to simulate mixed state
      const tool = browserTool as any;
      tool.puppeteerPage = { close: vi.fn() };
      tool.puppeteerBrowser = { close: vi.fn() };

      // Destroy should clean up both
      await expect(browserTool.destroy()).resolves.not.toThrow();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should regenerate session ID on force reset', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      const originalSessionId = browserTool.getResourceState().sessionId;

      // Force cleanup to fail
      const originalClearBuffers = browserTool.clearConsoleBuffers;
      browserTool.clearConsoleBuffers = vi.fn(() => {
        throw new Error('Force failure');
      });

      await browserTool.destroy();

      // Session ID should be different
      const newSessionId = browserTool.getResourceState().sessionId;
      expect(newSessionId).not.toBe(originalSessionId);
      expect(newSessionId).toMatch(/^browser_/);

      // Restore original method
      browserTool.clearConsoleBuffers = originalClearBuffers;
    });
  });

  describe('Resource State Consistency', () => {
    it('should maintain consistent resource state through cleanup cycles', async () => {
      // Start clean
      let resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);

      // Initialize
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.contextActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);
      expect(resourceState.currentUrl).toBe('https://example.com');

      // Cleanup
      await browserTool.cleanup();

      resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
      expect(resourceState.currentUrl).toBeUndefined();
      expect(resourceState.activeOperations).toBe(0);

      // Initialize again
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' },
      });

      resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.contextActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);

      // Destroy
      await browserTool.destroy();

      resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should clear console buffers during cleanup and destroy', async () => {
      // Initialize and potentially populate buffers
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Add some mock console messages
      const tool = browserTool as any;
      tool.consoleMessages = [{ type: 'log', text: 'test', timestamp: new Date() }];
      tool.enhancedConsoleMessages = [{ level: 'info', message: 'test' }];

      expect(browserTool.getEnhancedConsoleMessages().length).toBeGreaterThan(0);

      // Cleanup should clear buffers
      await browserTool.cleanup();

      expect(browserTool.getEnhancedConsoleMessages()).toHaveLength(0);
      expect(browserTool.getEnhancedRuntimeErrors()).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle cleanup when resources are already null', async () => {
      // Manually null out resources to simulate edge case
      const tool = browserTool as any;
      tool.page = null;
      tool.context = null;
      tool.browser = null;
      tool.consoleStream = null;

      // Should still complete without error
      await expect(browserTool.cleanup()).resolves.not.toThrow();
      await expect(browserTool.destroy()).resolves.not.toThrow();
    });

    it('should handle cleanup when resources throw unexpected errors', async () => {
      // Initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Make close operations throw non-Error objects
      mockPage.close.mockRejectedValue('String error');
      mockContext.close.mockRejectedValue({ error: 'Object error' });
      mockBrowser.close.mockRejectedValue(123);

      // Should handle gracefully
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
    });

    it('should maintain proper resource tracking across backend switches', async () => {
      // Start with playwright
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      let resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);

      // Cleanup
      await browserTool.cleanup();

      resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);

      // Switch to puppeteer backend (would require new tool instance in practice)
      // but this tests the cleanup logic
      const puppeteerTool = new BrowserTool({
        permissionManager: mockPermissionManager,
        backend: 'puppeteer',
      });

      await puppeteerTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      await expect(puppeteerTool.destroy()).resolves.not.toThrow();
    });
  });
});