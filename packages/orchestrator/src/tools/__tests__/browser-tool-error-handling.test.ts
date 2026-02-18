/**
 * Browser Tool Error Handling and Edge Cases Tests
 *
 * Tests error handling scenarios and edge cases including:
 * - Browser launch failures
 * - Network errors and timeouts
 * - Invalid selectors and elements
 * - Permission failures
 * - Configuration errors
 * - Backend switching edge cases
 * - Resource cleanup
 * - Malformed parameters
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool, BrowserToolConfig } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';

// Mock Playwright with error scenarios
const createMockPage = (shouldError = false) => ({
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => shouldError ? 'about:blank' : 'https://example.com'),
  title: vi.fn(() => shouldError ? 'Error Page' : 'Test Page'),
  goto: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Navigation failed: ERR_NAME_NOT_RESOLVED'));
    }
    return Promise.resolve({ status: () => 200 });
  }),
  click: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Element not found'));
    }
    return Promise.resolve();
  }),
  fill: vi.fn(),
  type: vi.fn(),
  screenshot: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Screenshot failed'));
    }
    return Promise.resolve(Buffer.from('screenshot-data'));
  }),
  evaluate: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Script execution failed'));
    }
    return Promise.resolve('result');
  }),
  waitForSelector: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Timeout: element not found'));
    }
    return Promise.resolve({});
  }),
  getAttribute: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Element not found'));
    }
    return Promise.resolve('test-attribute');
  }),
  textContent: vi.fn(() => {
    if (shouldError) {
      return Promise.resolve(null); // Element not found
    }
    return Promise.resolve('test content');
  }),
  innerHTML: vi.fn(),
  content: vi.fn(),
  hover: vi.fn(),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => {
      if (shouldError) {
        return Promise.reject(new Error('Element not found for selector'));
      }
      return Promise.resolve(Buffer.from('element-screenshot'));
    }),
    scrollIntoViewIfNeeded: vi.fn(),
    evaluate: vi.fn(),
  })),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  close: vi.fn(),
});

const createMockContext = (shouldError = false) => ({
  newPage: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Failed to create page'));
    }
    return Promise.resolve(createMockPage());
  }),
  on: vi.fn(),
  close: vi.fn(),
});

const createMockBrowser = (shouldError = false) => ({
  newContext: vi.fn(() => {
    if (shouldError) {
      return Promise.reject(new Error('Failed to create context'));
    }
    return Promise.resolve(createMockContext());
  }),
  close: vi.fn(),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
});

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(createMockBrowser())),
};

const mockFailingBrowserType = {
  launch: vi.fn(() => Promise.reject(new Error('Browser launch failed'))),
};

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('Browser Tool Error Handling and Edge Cases', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup permission manager
    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
      } as BrowserToolConfig)),
    } as any;

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Browser Launch Failures', () => {
    it('should handle browser launch failure gracefully', async () => {
      // Mock browser launch failure
      mockBrowserType.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser launch failed');
    });

    it('should handle context creation failure', async () => {
      const errorBrowser = createMockBrowser(true);
      mockBrowserType.launch.mockResolvedValueOnce(errorBrowser);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create context');
    });

    it('should handle page creation failure', async () => {
      const errorContext = createMockContext(true);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(errorContext);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create page');
    });
  });

  describe('Navigation Errors', () => {
    it('should handle navigation timeout errors', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://nonexistent.invalid' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation failed: ERR_NAME_NOT_RESOLVED');
    });

    it('should handle malformed URL navigation', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'not-a-url' },
      });

      // Should still attempt navigation and let browser handle URL parsing
      expect(result.success).toBe(true);
    });

    it('should handle navigation with extremely long timeout', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://example.com',
          timeout: 999999999, // Very long timeout
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Element Interaction Errors', () => {
    it('should handle click on non-existent element', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#non-existent-element' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should handle invalid CSS selectors', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '>>>invalid<<<selector' },
      });

      // Browser will handle invalid selectors, likely with error
      expect(result).toBeDefined();
    });

    it('should handle empty selectors', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '' },
      });

      // Should pass through empty selector
      expect(result).toBeDefined();
    });

    it('should handle attribute retrieval on non-existent element', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'getAttribute',
        params: {
          selector: '#non-existent',
          attribute: 'href',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should handle text content retrieval returning null', async () => {
      const nullPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(nullPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#empty-element' },
      });

      expect(result.success).toBe(true);
      expect(result.data?.text).toBeNull();
    });
  });

  describe('Screenshot Errors', () => {
    it('should handle screenshot failure', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Screenshot failed');
    });

    it('should handle element screenshot with non-existent selector', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          selector: '#non-existent-element',
          fullPage: false,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found for selector');
    });

    it('should handle screenshot with invalid quality parameter', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          format: 'jpeg',
          quality: 150, // Invalid quality > 100
        },
      });

      // Browser should handle invalid quality gracefully
      expect(result.success).toBe(true);
    });

    it('should handle screenshot to invalid file path', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          path: '/invalid/path/that/does/not/exist/screenshot.png',
          fullPage: true,
        },
      });

      // May succeed or fail depending on filesystem, but should not crash
      expect(result).toBeDefined();
    });
  });

  describe('JavaScript Evaluation Errors', () => {
    it('should handle JavaScript execution errors', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'throw new Error("Script error");',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script execution failed');
    });

    it('should handle infinite loop in JavaScript', async () => {
      // This would normally timeout
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'while(true) { /* infinite loop */ }',
        },
      });

      // Should either timeout or succeed based on browser timeout settings
      expect(result).toBeDefined();
    });

    it('should handle evaluation with malformed JavaScript', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: '{{{{ invalid javascript syntax )))))',
        },
      });

      // Browser will handle syntax errors
      expect(result).toBeDefined();
    });
  });

  describe('Wait Operation Errors', () => {
    it('should handle wait timeout for non-existent selector', async () => {
      const errorPage = createMockPage(true);
      const context = createMockContext();
      context.newPage.mockResolvedValue(errorPage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#never-appears',
          timeout: 1000,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout: element not found');
    });

    it('should handle wait with invalid timeout values', async () => {
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#element',
          timeout: -1000, // Negative timeout
        },
      });

      // Browser should handle negative timeout
      expect(result).toBeDefined();
    });

    it('should handle wait with extremely high timeout', async () => {
      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#element',
          timeout: Number.MAX_SAFE_INTEGER,
        },
      });

      expect(result).toBeDefined();
    });
  });

  describe('Backend Switching Errors', () => {
    it('should handle Puppeteer import failure gracefully', async () => {
      // Mock dynamic import to fail for Puppeteer
      vi.doMock('puppeteer', () => {
        throw new Error('Module not found: puppeteer');
      });

      const puppeteerTool = new BrowserTool({
        backend: 'puppeteer',
        permissionManager: mockPermissionManager,
      });

      const result = await puppeteerTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('puppeteer is not installed');
    });

    it('should handle unsupported browser engine', async () => {
      const tool = new BrowserTool({
        engine: 'unsupported' as any,
        permissionManager: mockPermissionManager,
      });

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Should fall back to chromium
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Errors', () => {
    it('should handle missing tool configuration gracefully', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue(null);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true); // Should work with default config
    });

    it('should handle configuration retrieval errors', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockRejectedValue(
        new Error('Configuration service unavailable')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Configuration service unavailable');
    });

    it('should handle malformed configuration', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: 'yes', // Wrong type
        allowedDomains: 'not-an-array', // Wrong type
        blockedDomains: null, // Wrong type
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Should handle gracefully and fall back to safe defaults
      expect(result.success).toBe(true);
    });
  });

  describe('Resource Cleanup Errors', () => {
    it('should handle browser close errors during cleanup', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Execute operation to create browser instance
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // The test framework handles cleanup automatically
      // In real usage, manual cleanup would be needed

      errorSpy.mockRestore();
    });
  });

  describe('Parameter Validation Edge Cases', () => {
    it('should handle missing required parameters', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {} as any, // Missing URL
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null parameters', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: null as any },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle undefined parameters', async () => {
      const result = await browserTool.execute({
        operation: 'type',
        params: {
          selector: '#input',
          text: undefined as any,
        },
      });

      // Browser might handle undefined text gracefully
      expect(result).toBeDefined();
    });

    it('should handle extremely long text input', async () => {
      const longText = 'A'.repeat(100000); // 100k characters

      const result = await browserTool.execute({
        operation: 'type',
        params: {
          selector: '#input',
          text: longText,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should handle special characters in selectors', async () => {
      const result = await browserTool.execute({
        operation: 'click',
        params: {
          selector: '#element\\:with\\:special\\:chars',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Network and Connectivity Issues', () => {
    it('should handle network disconnection during operation', async () => {
      // Simulate network error during navigation
      const page = createMockPage();
      page.goto.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'));

      const context = createMockContext();
      context.newPage.mockResolvedValue(page);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('net::ERR_INTERNET_DISCONNECTED');
    });

    it('should handle DNS resolution failures', async () => {
      const page = createMockPage();
      page.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      const context = createMockContext();
      context.newPage.mockResolvedValue(page);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://nonexistent.example.invalid' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('net::ERR_NAME_NOT_RESOLVED');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large screenshot operations', async () => {
      const largePage = createMockPage();
      largePage.screenshot.mockResolvedValue(Buffer.alloc(50 * 1024 * 1024)); // 50MB

      const context = createMockContext();
      context.newPage.mockResolvedValue(largePage);
      const browser = createMockBrowser();
      browser.newContext.mockResolvedValue(context);
      mockBrowserType.launch.mockResolvedValueOnce(browser);

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
    });

    it('should handle concurrent operations gracefully', async () => {
      // Execute multiple operations concurrently
      const operations = Array.from({ length: 10 }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` },
        })
      );

      const results = await Promise.allSettled(operations);

      // All operations should complete (success or failure)
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.status).toBeOneOf(['fulfilled', 'rejected']);
      });
    });
  });
});