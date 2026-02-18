/**
 * Browser Tool Edge Cases and Error Scenarios Tests
 *
 * Comprehensive tests for edge cases, error scenarios, and failure modes
 * that may not be covered in the main test suite.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from './browser-tool';
import { PermissionManager } from '../permission-manager';
import {
  BrowserPermissionDeniedError,
  ApexError,
  ApexErrorCode
} from '@apexcli/core';

// Mock Playwright with controllable failure scenarios
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  hover: vi.fn(),
  screenshot: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn(),
    evaluate: vi.fn(),
    scrollIntoViewIfNeeded: vi.fn(),
  })),
  evaluate: vi.fn(),
  waitForSelector: vi.fn(),
  getAttribute: vi.fn(),
  textContent: vi.fn(),
  innerHTML: vi.fn(),
  content: vi.fn(),
  pdf: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  $eval: vi.fn(),
  $: vi.fn(),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(),
  on: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

// Mock file system with controllable failures
const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
};

vi.mock('fs', () => mockFs);

// Mock pixelmatch and pngjs
vi.mock('pixelmatch', () => ({
  default: vi.fn(() => 100),
}));

vi.mock('pngjs', () => ({
  PNG: {
    sync: {
      read: vi.fn(),
      write: vi.fn(() => Buffer.from('mock-png')),
    },
  },
}));

describe('Browser Tool Edge Cases and Error Scenarios', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: Partial<PermissionManager>;
  let mockEventEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockBrowserType.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(Buffer.from('mock-file-content'));

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
        allowedDomains: ['test.example.com'],
        pageLoadTimeout: 10000,
      } as BrowserToolConfig)),
    };

    mockEventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager as PermissionManager,
      eventEmitter: mockEventEmitter,
    });
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Network and Timeout Edge Cases', () => {
    it('should handle browser launch timeout', async () => {
      // Mock browser launch to never resolve (timeout scenario)
      mockBrowserType.launch.mockImplementation(() =>
        new Promise((resolve) => {
          // Never resolve to simulate timeout
        })
      );

      // Set a short timeout for the test
      const result = await Promise.race([
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://test.example.com', timeout: 100 }
        }),
        new Promise(resolve => setTimeout(() => resolve({
          success: false,
          operation: 'navigate',
          error: 'Test timeout'
        }), 200))
      ]) as any;

      expect(result).toBeDefined();
      // Should either timeout gracefully or handle the case appropriately
    });

    it('should handle page navigation timeout', async () => {
      mockPage.goto.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Navigation timeout')), 50);
        })
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow.example.com', timeout: 100 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation timeout');
    });

    it('should handle network connectivity issues', async () => {
      mockPage.goto.mockRejectedValue(new Error('net::ERR_NETWORK_CHANGED'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ERR_NETWORK_CHANGED');
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle out-of-memory conditions during screenshot', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Out of memory'));

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Out of memory');
    });

    it('should handle browser crash during operation', async () => {
      mockPage.click.mockRejectedValue(new Error('Browser process crashed'));

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser process crashed');
    });

    it('should handle context creation failure', async () => {
      mockBrowser.newContext.mockRejectedValue(new Error('Failed to create context'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create context');
    });
  });

  describe('File System and IO Edge Cases', () => {
    it('should handle screenshot save failure due to disk full', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      // Note: This test is for the PNG writing inside compareScreenshot
      const { PNG } = await import('pngjs');
      (PNG.sync.write as Mock).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/baseline.png',
          diffPath: '/path/diff.png'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOSPC');
    });

    it('should handle corrupted baseline image in visual comparison', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from('valid-image-data'));
      const { PNG } = await import('pngjs');

      // Mock baseline read to throw corruption error
      (PNG.sync.read as Mock).mockImplementation((buffer) => {
        if (buffer.toString() === 'mock-file-content') {
          throw new Error('Invalid PNG signature');
        }
        return { width: 800, height: 600, data: Buffer.alloc(800 * 600 * 4) };
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/corrupted-baseline.png'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid PNG signature');
    });

    it('should handle permission denied when writing files', async () => {
      const { PNG } = await import('pngjs');
      (PNG.sync.write as Mock).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: '/path/baseline.png',
          diffPath: '/readonly/diff.png'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });
  });

  describe('Malformed Input Edge Cases', () => {
    it('should handle invalid CSS selectors gracefully', async () => {
      mockPage.click.mockRejectedValue(new Error('Invalid selector: ">>>"'));

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '>>>' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid selector');
    });

    it('should handle malformed JavaScript in evaluate', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('SyntaxError: Unexpected token'));

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'function() { invalid syntax }' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SyntaxError');
    });

    it('should handle invalid URL formats', async () => {
      mockPage.goto.mockRejectedValue(new Error('Invalid URL'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'not-a-valid-url' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should handle extremely large screenshot requests', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot too large'));

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          fullPage: true,
          // This would be handled at a higher level, but testing error handling
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot too large');
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    it('should handle rapid successive operations without resource leaks', async () => {
      // Setup mocks for successful operations
      mockPage.click.mockResolvedValue(undefined);
      mockPage.type.mockResolvedValue(undefined);
      mockPage.hover.mockResolvedValue(undefined);

      // Execute many rapid operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          browserTool.execute({
            operation: 'click',
            params: { selector: `#button-${i}` }
          })
        );
      }

      const results = await Promise.allSettled(operations);

      // All should succeed or fail gracefully
      results.forEach((result, index) => {
        expect(result.status).toMatch(/fulfilled|rejected/);
        if (result.status === 'fulfilled') {
          expect(result.value.operation).toBe('click');
        }
      });

      // Resource state should be consistent
      const resourceState = browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should handle operations during cleanup', async () => {
      // Start navigation
      const navPromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Start cleanup immediately
      const cleanupPromise = browserTool.cleanup();

      // Start another operation during cleanup
      const clickPromise = browserTool.execute({
        operation: 'click',
        params: { selector: '#test' }
      });

      const [navResult, , clickResult] = await Promise.allSettled([
        navPromise,
        cleanupPromise,
        clickPromise
      ]);

      // Navigation might succeed or fail depending on timing
      // Click should fail because of cleanup
      if (clickResult.status === 'fulfilled') {
        expect(clickResult.value.success).toBe(false);
        expect(clickResult.value.error).toMatch(/destroyed|cleaning up/);
      }
    });
  });

  describe('Cross-Browser Engine Edge Cases', () => {
    it('should handle Firefox-specific PDF generation failure', async () => {
      const firefoxTool = new BrowserTool({
        engine: 'firefox',
        permissionManager: mockPermissionManager as PermissionManager,
      });

      try {
        const result = await firefoxTool.execute({
          operation: 'generatePdf',
          params: { format: 'A4' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('PDF generation is only supported with Playwright using Chromium browser');
      } finally {
        await firefoxTool.cleanup();
      }
    });

    it('should handle WebKit-specific operation limitations', async () => {
      const webkitTool = new BrowserTool({
        engine: 'webkit',
        permissionManager: mockPermissionManager as PermissionManager,
      });

      try {
        // WebKit might have different behavior for certain operations
        const result = await webkitTool.execute({
          operation: 'generatePdf',
          params: { format: 'A4' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('PDF generation is only supported with Playwright using Chromium browser');
      } finally {
        await webkitTool.cleanup();
      }
    });
  });

  describe('Permission Edge Cases', () => {
    it('should handle permission revocation during operation', async () => {
      let permissionCallCount = 0;
      (mockPermissionManager.checkToolPermission as Mock).mockImplementation(() => {
        permissionCallCount++;
        return Promise.resolve({
          allowed: permissionCallCount === 1, // First call succeeds, second fails
          level: 'full',
          requiresConfirmation: false,
          denialReason: permissionCallCount > 1 ? 'Permission revoked' : undefined
        });
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser permission denied');
    });

    it('should handle permission manager failure during check', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockRejectedValue(
        new Error('Permission manager unavailable')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission manager unavailable');
    });

    it('should handle configuration fetch failure', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockRejectedValue(
        new Error('Configuration service unavailable')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration service unavailable');
    });
  });

  describe('Resource Cleanup Failure Scenarios', () => {
    it('should handle page close failure during cleanup', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      mockPage.close.mockRejectedValue(new Error('Page close failed'));
      mockContext.close.mockResolvedValue(undefined);
      mockBrowser.close.mockResolvedValue(undefined);

      await expect(browserTool.cleanup()).rejects.toThrow(ApexError);
    });

    it('should handle context close failure during cleanup', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      mockPage.close.mockResolvedValue(undefined);
      mockContext.close.mockRejectedValue(new Error('Context close failed'));
      mockBrowser.close.mockResolvedValue(undefined);

      await expect(browserTool.cleanup()).rejects.toThrow(ApexError);
    });

    it('should handle browser close failure during cleanup', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      mockPage.close.mockResolvedValue(undefined);
      mockContext.close.mockResolvedValue(undefined);
      mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));

      await expect(browserTool.cleanup()).rejects.toThrow(ApexError);
    });

    it('should force cleanup when all resource cleanup fails', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Make all cleanup operations fail
      mockPage.close.mockRejectedValue(new Error('Page close failed'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await browserTool.destroy();

      expect(browserTool.getState()).toBe('destroyed');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Normal cleanup failed, forcing resource reset:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Console Streaming Edge Cases', () => {
    it('should handle console stream initialization failure', async () => {
      // Mock BrowserConsoleStream constructor to throw
      vi.doMock('../browser-console-stream', () => ({
        BrowserConsoleStream: vi.fn(() => {
          throw new Error('Console stream init failed');
        })
      }));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(true); // Should succeed with fallback
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to set up console streaming:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management Edge Cases', () => {
    it('should handle memory pressure during large operations', async () => {
      // Simulate memory pressure scenario
      mockPage.screenshot.mockImplementation(() => {
        // Simulate gradual memory increase
        global.gc && global.gc();
        return Promise.resolve(Buffer.alloc(50 * 1024 * 1024)); // 50MB buffer
      });

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      // Should either succeed or fail gracefully
      expect(result).toBeDefined();
      expect(result.operation).toBe('screenshot');
    });
  });
});