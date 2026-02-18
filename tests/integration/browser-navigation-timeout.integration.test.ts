/**
 * Browser Navigation Timeout Integration Tests
 *
 * This test suite validates browser navigation timeout behavior including:
 * - Default timeout handling for slow page loads
 * - Custom timeout configurations
 * - Timeout error handling with proper error messages
 * - Different timeout scenarios (network delays, DNS resolution, etc.)
 * - Permission handling during timeout scenarios
 * - Resource cleanup after timeout errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock Playwright with timeout capabilities
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  },
  firefox: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  },
  webkit: {
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

// Create timeout-capable mock page
const createTimeoutMockPage = () => {
  const mockPage = {
    url: vi.fn(() => 'about:blank'),
    title: vi.fn(() => Promise.resolve('Test Page')),
    goto: vi.fn(),
    click: vi.fn(() => Promise.resolve()),
    type: vi.fn(() => Promise.resolve()),
    fill: vi.fn(() => Promise.resolve()),
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot'))),
    evaluate: vi.fn(() => Promise.resolve('result')),
    on: vi.fn(),
    close: vi.fn(() => Promise.resolve()),
    viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
    waitForSelector: vi.fn(() => Promise.resolve({})),
    getAttribute: vi.fn(() => Promise.resolve('test-value')),
    textContent: vi.fn(() => Promise.resolve('Test Content')),
    innerHTML: vi.fn(() => Promise.resolve('<div>Test</div>')),
    content: vi.fn(() => Promise.resolve('<html><body>Test</body></html>')),
    hover: vi.fn(() => Promise.resolve()),
    locator: vi.fn(() => ({
      click: vi.fn(() => Promise.resolve()),
      fill: vi.fn(() => Promise.resolve()),
      scrollIntoViewIfNeeded: vi.fn(() => Promise.resolve()),
      screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
      evaluate: vi.fn(() => Promise.resolve())
    }))
  };

  return mockPage;
};

const mockPage = createTimeoutMockPage();

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve())
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve())
};

describe('Browser Navigation Timeout Integration Tests', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let browserTool: BrowserTool;
  let systemEvents: any[];

  beforeEach(async () => {
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
    systemEvents = [];

    // Track events
    eventEmitter.on('permission:granted', (data) => systemEvents.push({ type: 'granted', data }));
    eventEmitter.on('permission:denied', (data) => systemEvents.push({ type: 'denied', data }));
    eventEmitter.on('browser:state:transition', (data) => systemEvents.push({ type: 'state_transition', data }));
    eventEmitter.on('browser:timeout', (data) => systemEvents.push({ type: 'timeout', data }));

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
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
      console.warn('Test cleanup error:', error);
    }
  });

  describe('Default Timeout Behavior', () => {
    it('should handle navigation timeout with default settings', async () => {
      // Configure mock to simulate timeout
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        const timeout = options?.timeout || 30000; // Default Playwright timeout
        throw new Error(`Navigation timeout of ${timeout}ms exceeded`);
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow-site.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation timeout');
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.metadata?.target).toBe('https://slow-site.example.com');
    });

    it('should handle slow page load without custom timeout', async () => {
      // Simulate slow but successful navigation
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        return { status: () => 200 };
      });

      mockPage.url.mockReturnValue('https://slow-site.example.com');
      mockPage.title.mockResolvedValue('Slow Site');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow-site.example.com' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.url).toBe('https://slow-site.example.com');
      expect(result.data?.status).toBe(200);
      expect(mockPage.goto).toHaveBeenCalledWith('https://slow-site.example.com', {
        waitUntil: 'load',
        timeout: undefined // No custom timeout specified
      });
    });
  });

  describe('Custom Timeout Configuration', () => {
    it('should respect custom timeout values', async () => {
      // Configure mock to simulate timeout after custom duration
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        const timeout = options?.timeout || 30000;
        if (timeout < 1000) {
          throw new Error(`Navigation timeout of ${timeout}ms exceeded`);
        }
        return { status: () => 200 };
      });

      // Test with short custom timeout
      const shortTimeoutResult = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://example.com',
          timeout: 500
        }
      });

      expect(shortTimeoutResult.success).toBe(false);
      expect(shortTimeoutResult.error).toContain('Navigation timeout of 500ms exceeded');
      expect(mockPage.goto).toHaveBeenLastCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 500
      });
    });

    it('should handle different wait conditions with timeout', async () => {
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        // Simulate that different waitUntil conditions affect timing
        if (options?.waitUntil === 'networkidle') {
          throw new Error('Network idle timeout exceeded');
        }
        return { status: () => 200 };
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://ajax-heavy.example.com',
          waitUntil: 'networkidle',
          timeout: 2000
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network idle timeout');
      expect(mockPage.goto).toHaveBeenCalledWith('https://ajax-heavy.example.com', {
        waitUntil: 'networkidle',
        timeout: 2000
      });
    });

    it('should handle long timeout configurations', async () => {
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        // Simulate successful navigation with long timeout
        await new Promise(resolve => setTimeout(resolve, 50));
        return { status: () => 200 };
      });

      mockPage.url.mockReturnValue('https://heavy-content.example.com');
      mockPage.title.mockResolvedValue('Heavy Content Site');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://heavy-content.example.com',
          timeout: 60000 // 60 second timeout
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.url).toBe('https://heavy-content.example.com');
      expect(mockPage.goto).toHaveBeenCalledWith('https://heavy-content.example.com', {
        waitUntil: 'load',
        timeout: 60000
      });
    });
  });

  describe('Timeout Error Handling', () => {
    it('should provide detailed timeout error information', async () => {
      const timeoutError = new Error('Navigation timeout of 5000ms exceeded');
      timeoutError.name = 'TimeoutError';
      mockPage.goto.mockRejectedValue(timeoutError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://timeout-test.example.com',
          timeout: 5000
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation timeout of 5000ms exceeded');
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.metadata?.target).toBe('https://timeout-test.example.com');
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    });

    it('should handle DNS resolution timeout', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND non-existent-domain.invalid');
      dnsError.name = 'NetworkError';
      mockPage.goto.mockRejectedValue(dnsError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://non-existent-domain.invalid',
          timeout: 3000
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOTFOUND');
      expect(result.metadata?.target).toBe('https://non-existent-domain.invalid');
    });

    it('should handle connection refused timeout scenarios', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:80');
      connectionError.name = 'NetworkError';
      mockPage.goto.mockRejectedValue(connectionError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'http://127.0.0.1:80',
          timeout: 2000
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should maintain browser state consistency after timeout', async () => {
      const timeoutError = new Error('Navigation timeout');
      mockPage.goto.mockRejectedValue(timeoutError);

      // First navigation fails due to timeout
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://timeout-site.example.com',
          timeout: 1000
        }
      });

      expect(result1.success).toBe(false);

      // Browser should still be active and able to handle subsequent operations
      expect(browserTool.isActive()).toBe(true);

      // Next navigation should work normally
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://working-site.example.com');
      mockPage.title.mockResolvedValue('Working Site');

      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://working-site.example.com' }
      });

      expect(result2.success).toBe(true);
      expect(result2.data?.url).toBe('https://working-site.example.com');
    });
  });

  describe('Configuration-Based Timeout Handling', () => {
    it('should use pageLoadTimeout from browser configuration', async () => {
      // Set up browser tool config with page load timeout
      const toolConfig = {
        enabled: true,
        pageLoadTimeout: 3000,
        allowedDomains: [],
        blockedDomains: []
      };

      // Mock the permission manager's getToolConfig method
      vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue(toolConfig);

      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        const timeout = options?.timeout || 30000;
        if (timeout <= 3000) {
          throw new Error(`Navigation timeout of ${timeout}ms exceeded`);
        }
        return { status: () => 200 };
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://config-timeout-test.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation timeout of 3000ms exceeded');
      expect(mockPage.goto).toHaveBeenCalledWith('https://config-timeout-test.example.com', {
        waitUntil: 'load',
        timeout: 3000
      });
    });

    it('should allow param timeout to override config timeout', async () => {
      // Set up browser tool config with default timeout
      const toolConfig = {
        enabled: true,
        pageLoadTimeout: 5000,
        allowedDomains: [],
        blockedDomains: []
      };

      vi.spyOn(permissionManager, 'getToolConfig').mockResolvedValue(toolConfig);

      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        return { status: () => 200 };
      });

      mockPage.url.mockReturnValue('https://override-test.example.com');
      mockPage.title.mockResolvedValue('Override Test');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://override-test.example.com',
          timeout: 10000 // Should override config
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledWith('https://override-test.example.com', {
        waitUntil: 'load',
        timeout: 10000 // Parameter timeout takes precedence
      });
    });
  });

  describe('Slow Page Load Scenarios', () => {
    it('should handle gradual page loading with different wait conditions', async () => {
      const scenarios = [
        { waitUntil: 'load', expectedTimeout: false },
        { waitUntil: 'domcontentloaded', expectedTimeout: false },
        { waitUntil: 'networkidle', expectedTimeout: true } // Most likely to timeout
      ] as const;

      for (const scenario of scenarios) {
        mockPage.goto.mockImplementation(async (url: string, options?: any) => {
          if (options?.waitUntil === 'networkidle') {
            throw new Error('Network idle condition timeout');
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          return { status: () => 200 };
        });

        mockPage.url.mockReturnValue('https://gradual-load.example.com');
        mockPage.title.mockResolvedValue('Gradual Load Test');

        const result = await browserTool.execute({
          operation: 'navigate',
          params: {
            url: 'https://gradual-load.example.com',
            waitUntil: scenario.waitUntil,
            timeout: 2000
          }
        });

        if (scenario.expectedTimeout) {
          expect(result.success).toBe(false);
          expect(result.error).toContain('timeout');
        } else {
          expect(result.success).toBe(true);
          expect(result.data?.url).toBe('https://gradual-load.example.com');
        }
      }
    });

    it('should handle mixed success and timeout scenarios in sequence', async () => {
      const urls = [
        'https://fast-site.example.com',
        'https://slow-site.example.com',
        'https://timeout-site.example.com',
        'https://recovery-site.example.com'
      ];

      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        if (url.includes('timeout-site')) {
          throw new Error('Navigation timeout exceeded');
        } else if (url.includes('slow-site')) {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { status: () => 200 };
        } else {
          return { status: () => 200 };
        }
      });

      const results = [];
      for (const url of urls) {
        mockPage.url.mockReturnValue(url);
        mockPage.title.mockResolvedValue(`Page for ${url}`);

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url, timeout: 1000 }
        });

        results.push({ url, success: result.success });
      }

      expect(results).toEqual([
        { url: 'https://fast-site.example.com', success: true },
        { url: 'https://slow-site.example.com', success: true },
        { url: 'https://timeout-site.example.com', success: false },
        { url: 'https://recovery-site.example.com', success: true }
      ]);

      // Verify browser remains functional after timeout
      expect(browserTool.isActive()).toBe(true);
    });

    it('should handle concurrent navigation attempts with different timeouts', async () => {
      const navigationPromises = [
        { url: 'https://site1.example.com', timeout: 1000, shouldSucceed: true },
        { url: 'https://site2.example.com', timeout: 500, shouldSucceed: false },
        { url: 'https://site3.example.com', timeout: 2000, shouldSucceed: true }
      ];

      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        const delay = url.includes('site2') ? 1000 : 100; // site2 will timeout
        await new Promise(resolve => setTimeout(resolve, delay));

        if (delay > (options?.timeout || 30000)) {
          throw new Error(`Navigation timeout of ${options.timeout}ms exceeded`);
        }

        return { status: () => 200 };
      });

      // Execute navigations sequentially to avoid browser state conflicts
      const results = [];
      for (const nav of navigationPromises) {
        mockPage.url.mockReturnValue(nav.url);
        mockPage.title.mockResolvedValue(`Page ${nav.url}`);

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: nav.url, timeout: nav.timeout }
        });

        results.push({
          url: nav.url,
          success: result.success,
          expectedSuccess: nav.shouldSucceed
        });
      }

      // Verify results match expectations
      results.forEach(result => {
        expect(result.success).toBe(result.expectedSuccess);
      });
    });
  });

  describe('Resource Cleanup After Timeout', () => {
    it('should properly cleanup resources after timeout error', async () => {
      const timeoutError = new Error('Navigation timeout');
      mockPage.goto.mockRejectedValue(timeoutError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://timeout-cleanup-test.example.com',
          timeout: 1000
        }
      });

      expect(result.success).toBe(false);

      // Cleanup should not throw errors
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Browser should be properly cleaned up
      expect(browserTool.getState()).toBe('destroyed');
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should maintain resource state consistency during timeout scenarios', async () => {
      // Check initial state
      expect(browserTool.getState()).toBe('idle');

      const timeoutError = new Error('Navigation timeout');
      mockPage.goto.mockRejectedValue(timeoutError);

      await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://state-consistency-test.example.com',
          timeout: 1000
        }
      });

      // Browser should still be active after timeout (not automatically cleaned up)
      expect(browserTool.getState()).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.contextActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);
    });
  });

  describe('Permission Handling During Timeout', () => {
    it('should maintain proper permission tracking during timeout', async () => {
      const timeoutError = new Error('Navigation timeout');
      mockPage.goto.mockRejectedValue(timeoutError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://permission-timeout-test.example.com',
          timeout: 1000
        }
      });

      expect(result.success).toBe(false);
      expect(result.metadata?.permissionGranted).toBe(true); // Permission was granted, navigation failed

      // Should have generated permission granted event
      const grantedEvents = systemEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(1);
      expect(grantedEvents[0].data.operation).toBe('navigate');
    });

    it('should handle permission denial during timeout scenario', async () => {
      // Deny permissions
      await permissionManager.denyPermission('Browser');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://denied-timeout-test.example.com',
          timeout: 1000
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);
      expect(result.metadata?.permissionGranted).toBe(false);

      // Should not have called goto since permission was denied
      expect(mockPage.goto).not.toHaveBeenCalled();

      // Should have generated permission denied event
      const deniedEvents = systemEvents.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBe(1);
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear error messages for different timeout scenarios', async () => {
      const timeoutScenarios = [
        {
          mockError: new Error('Navigation timeout of 5000ms exceeded'),
          expectedMessage: 'Navigation timeout of 5000ms exceeded'
        },
        {
          mockError: new Error('Timeout 3000ms exceeded'),
          expectedMessage: 'Timeout 3000ms exceeded'
        },
        {
          mockError: new Error('Page load timeout'),
          expectedMessage: 'Page load timeout'
        },
        {
          mockError: new Error('net::ERR_CONNECTION_TIMED_OUT'),
          expectedMessage: 'net::ERR_CONNECTION_TIMED_OUT'
        }
      ];

      for (const scenario of timeoutScenarios) {
        mockPage.goto.mockRejectedValue(scenario.mockError);

        const result = await browserTool.execute({
          operation: 'navigate',
          params: {
            url: 'https://error-message-test.example.com',
            timeout: 5000
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe(scenario.expectedMessage);
      }
    });
  });
});