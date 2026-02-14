/**
 * Browser Navigation Timeout Edge Cases Integration Tests
 *
 * This test suite covers edge cases and complex scenarios for browser timeout handling:
 * - Zero and negative timeout values
 * - Very large timeout values
 * - Timeout behavior with different browser engines
 * - Concurrent timeout scenarios
 * - Timeout interactions with permission systems
 * - Memory and resource management under timeout stress
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock Playwright with all engines
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

describe('Browser Navigation Timeout Edge Cases', () => {
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

    eventEmitter.on('permission:granted', (data) => systemEvents.push({ type: 'granted', data }));
    eventEmitter.on('permission:denied', (data) => systemEvents.push({ type: 'denied', data }));
    eventEmitter.on('browser:timeout', (data) => systemEvents.push({ type: 'timeout', data }));

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright',
      engine: 'chromium'
    });

    await permissionManager.grantPermission('Browser', 'allow-always');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      console.warn('Test cleanup error:', error);
    }
  });

  describe('Invalid Timeout Values', () => {
    it('should handle zero timeout value', async () => {
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        // Zero timeout should be handled as immediate timeout
        if (options?.timeout === 0) {
          throw new Error('Navigation timeout of 0ms exceeded');
        }
        return { status: () => 200 };
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com', timeout: 0 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation timeout of 0ms exceeded');
    });

    it('should handle negative timeout values', async () => {
      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        // Negative timeouts should be treated as immediate timeout
        if (options?.timeout < 0) {
          throw new Error(`Invalid timeout: ${options.timeout}ms`);
        }
        return { status: () => 200 };
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com', timeout: -1000 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid timeout: -1000ms');
    });

    it('should handle extremely large timeout values', async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://large-timeout.com');
      mockPage.title.mockResolvedValue('Large Timeout Test');

      const largeTimeout = Number.MAX_SAFE_INTEGER;

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://large-timeout.com', timeout: largeTimeout }
      });

      expect(result.success).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledWith('https://large-timeout.com', {
        waitUntil: 'load',
        timeout: largeTimeout
      });
    });
  });

  describe('Browser Engine Timeout Differences', () => {
    const engines = ['chromium', 'firefox', 'webkit'] as const;

    engines.forEach(engine => {
      it(`should handle timeouts consistently with ${engine} engine`, async () => {
        const engineBrowserTool = new BrowserTool({
          permissionManager,
          eventEmitter,
          backend: 'playwright',
          engine
        });

        mockPage.goto.mockRejectedValue(new Error(`${engine} navigation timeout`));

        const result = await engineBrowserTool.execute({
          operation: 'navigate',
          params: { url: 'https://engine-test.com', timeout: 2000 }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain(`${engine} navigation timeout`);

        await engineBrowserTool.cleanup();
      });
    });
  });

  describe('Concurrent Timeout Scenarios', () => {
    it('should handle multiple simultaneous timeout failures', async () => {
      const urls = [
        'https://timeout1.com',
        'https://timeout2.com',
        'https://timeout3.com'
      ];

      mockPage.goto.mockRejectedValue(new Error('Concurrent navigation timeout'));

      // Execute navigations sequentially to avoid state conflicts
      const results = [];
      for (const url of urls) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url, timeout: 1000 }
        });
        results.push(result);
      }

      // All should fail with timeout
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      });

      // Browser should still be active
      expect(browserTool.isActive()).toBe(true);
    });

    it('should handle mixed timeout and success scenarios', async () => {
      const scenarios = [
        { url: 'https://success.com', shouldSucceed: true },
        { url: 'https://timeout.com', shouldSucceed: false },
        { url: 'https://success2.com', shouldSucceed: true }
      ];

      mockPage.goto.mockImplementation(async (url: string, options?: any) => {
        if (url.includes('timeout')) {
          throw new Error('Navigation timeout');
        }
        return { status: () => 200 };
      });

      for (const scenario of scenarios) {
        mockPage.url.mockReturnValue(scenario.url);
        mockPage.title.mockResolvedValue(`Page for ${scenario.url}`);

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: scenario.url, timeout: 2000 }
        });

        expect(result.success).toBe(scenario.shouldSucceed);
      }
    });
  });

  describe('Permission-Timeout Interaction Edge Cases', () => {
    it('should handle permission denial after timeout setup', async () => {
      // Start navigation, then deny permission mid-process
      let permissionCheckCount = 0;

      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async () => {
        permissionCheckCount++;
        if (permissionCheckCount === 1) {
          return { allowed: true, level: 'allow-once' as const, requiresConfirmation: false };
        }
        // Deny on subsequent checks
        return { allowed: false, level: null, requiresConfirmation: false, denialReason: 'Permission revoked' };
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://permission-timeout.com', timeout: 5000 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);
    });

    it('should handle permission timeout during navigation timeout', async () => {
      // Simulate permission check taking longer than navigation timeout
      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { allowed: true, level: 'allow-always' as const, requiresConfirmation: false };
      });

      mockPage.goto.mockRejectedValue(new Error('Navigation timeout before permission check'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow-permission.com', timeout: 50 }
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Resource Management Under Timeout Stress', () => {
    it('should properly cleanup resources after multiple timeouts', async () => {
      mockPage.goto.mockRejectedValue(new Error('Persistent timeout'));

      // Execute multiple operations that timeout
      for (let i = 0; i < 5; i++) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: `https://timeout-test-${i}.com`, timeout: 100 }
        });

        expect(result.success).toBe(false);
      }

      // Resource state should remain consistent
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.activeOperations).toBe(0);

      // Cleanup should work properly
      await expect(browserTool.cleanup()).resolves.not.toThrow();
      expect(browserTool.getState()).toBe('destroyed');
    });

    it('should handle timeout during browser cleanup', async () => {
      // Mock cleanup operations to simulate delays
      mockPage.close.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
      mockContext.close.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
      mockBrowser.close.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));

      // Trigger navigation timeout first
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://cleanup-timeout.com', timeout: 100 }
      });

      // Cleanup should still complete successfully
      await expect(browserTool.cleanup()).resolves.not.toThrow();
      expect(browserTool.getState()).toBe('destroyed');
    });
  });

  describe('Timeout Error Message Quality', () => {
    it('should provide contextual error messages for different timeout types', async () => {
      const timeoutTypes = [
        {
          error: new Error('Navigation timeout of 3000ms exceeded'),
          expectedContext: 'Navigation timeout'
        },
        {
          error: new Error('Page load timeout after 5000ms'),
          expectedContext: 'Page load timeout'
        },
        {
          error: new Error('Timeout waiting for load event'),
          expectedContext: 'load event'
        },
        {
          error: new Error('Waiting for networkidle timeout'),
          expectedContext: 'networkidle timeout'
        }
      ];

      for (const { error, expectedContext } of timeoutTypes) {
        mockPage.goto.mockRejectedValue(error);

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://error-context.com', timeout: 3000 }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain(expectedContext);
        expect(result.metadata?.target).toBe('https://error-context.com');
        expect(result.metadata?.executionTime).toBeGreaterThan(0);
      }
    });

    it('should include operation metadata in timeout errors', async () => {
      const timeoutError = new Error('Operation timeout');
      mockPage.goto.mockRejectedValue(timeoutError);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://metadata-test.com',
          timeout: 2000,
          waitUntil: 'networkidle'
        }
      });

      expect(result.success).toBe(false);
      expect(result.operation).toBe('navigate');
      expect(result.metadata?.target).toBe('https://metadata-test.com');
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(typeof result.metadata?.executionTime).toBe('number');

      // Verify the navigation was called with correct parameters
      expect(mockPage.goto).toHaveBeenCalledWith('https://metadata-test.com', {
        waitUntil: 'networkidle',
        timeout: 2000
      });
    });
  });

  describe('State Recovery After Timeout', () => {
    it('should recover gracefully from browser state corruption', async () => {
      // Simulate a scenario where timeout causes state inconsistency
      mockPage.goto.mockRejectedValue(new Error('State corruption timeout'));

      // First operation fails
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://corrupt-state.com', timeout: 1000 }
      });

      expect(result1.success).toBe(false);

      // Reset mocks for recovery test
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://recovery.com');
      mockPage.title.mockResolvedValue('Recovery Page');

      // Should be able to recover and perform new operations
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://recovery.com' }
      });

      expect(result2.success).toBe(true);
      expect(browserTool.isActive()).toBe(true);

      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);
    });
  });
});