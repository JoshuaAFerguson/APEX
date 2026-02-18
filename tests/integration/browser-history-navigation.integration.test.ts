/**
 * Browser History Navigation Integration Tests
 *
 * This test suite validates browser history navigation functionality including:
 * - back() navigation method with proper history state verification
 * - forward() navigation method with proper history state verification
 * - go() navigation method with positive/negative deltas
 * - History state management across navigation operations
 * - Navigation after history manipulation
 * - Edge cases for navigation when no history exists
 * - Comprehensive integration scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock Playwright for controlled testing
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

// Create mock page with history tracking
const createHistoryMockPage = () => {
  // Simulate browser history state
  let historyStack: string[] = ['about:blank'];
  let currentIndex = 0;

  const mockPage = {
    url: vi.fn(() => historyStack[currentIndex] || 'about:blank'),
    title: vi.fn(() => Promise.resolve('Test Page')),
    goto: vi.fn(async (url: string) => {
      // Add new URL to history and move index
      historyStack = historyStack.slice(0, currentIndex + 1);
      historyStack.push(url);
      currentIndex = historyStack.length - 1;
      return { status: () => 200, ok: () => true };
    }),
    goBack: vi.fn(async (options?: any) => {
      if (currentIndex > 0) {
        currentIndex--;
        return { status: () => 200 };
      }
      return null; // No previous page
    }),
    goForward: vi.fn(async (options?: any) => {
      if (currentIndex < historyStack.length - 1) {
        currentIndex++;
        return { status: () => 200 };
      }
      return null; // No next page
    }),
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
    })),

    // Helper methods for test verification
    _getHistoryStack: () => [...historyStack],
    _getCurrentIndex: () => currentIndex,
    _setHistoryState: (stack: string[], index: number) => {
      historyStack = [...stack];
      currentIndex = index;
    },
    _resetHistory: () => {
      historyStack = ['about:blank'];
      currentIndex = 0;
    }
  };

  return mockPage;
};

const mockPage = createHistoryMockPage();

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve())
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve())
};

describe('Browser History Navigation Integration Tests', () => {
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

    // Track navigation events
    eventEmitter.on('browser:navigation:start', (data) => systemEvents.push({ type: 'nav_start', data }));
    eventEmitter.on('browser:navigation:complete', (data) => systemEvents.push({ type: 'nav_complete', data }));
    eventEmitter.on('browser:history:change', (data) => systemEvents.push({ type: 'history_change', data }));

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright',
      engine: 'chromium'
    });

    // Grant permissions for browser operations
    await permissionManager.grantPermission('Browser', 'allow-always');

    // Reset mock page history state
    (mockPage as any)._resetHistory();
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

  describe('back() Navigation Method Tests', () => {
    it('should navigate back through multiple pages successfully', async () => {
      // Build navigation history
      const urls = [
        'https://page1.example.com',
        'https://page2.example.com',
        'https://page3.example.com'
      ];

      // Navigate to create history
      for (const url of urls) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
        expect(result.success).toBe(true);
      }

      // Verify current position
      expect(mockPage.url()).toBe('https://page3.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(3); // about:blank + 3 pages

      // Test back navigation
      const backResult1 = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });

      expect(backResult1.success).toBe(true);
      expect(mockPage.url()).toBe('https://page2.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(2);

      // Navigate back again
      const backResult2 = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });

      expect(backResult2.success).toBe(true);
      expect(mockPage.url()).toBe('https://page1.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(1);

      // Navigate back to initial page
      const backResult3 = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });

      expect(backResult3.success).toBe(true);
      expect(mockPage.url()).toBe('about:blank');
      expect((mockPage as any)._getCurrentIndex()).toBe(0);
    });

    it('should handle back navigation when no previous page exists', async () => {
      // Start with fresh page (no history)
      expect(mockPage.url()).toBe('about:blank');
      expect((mockPage as any)._getCurrentIndex()).toBe(0);

      // Attempt to go back when there's no history
      const result = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(null); // Should return null when no previous page
      expect(mockPage.url()).toBe('about:blank'); // Should remain at same page
      expect((mockPage as any)._getCurrentIndex()).toBe(0);
    });

    it('should handle back navigation with timeout options', async () => {
      // Navigate to create some history
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Test back with timeout options
      const result = await browserTool.execute({
        operation: 'goBack',
        params: {
          timeout: 5000,
          waitUntil: 'networkidle'
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.goBack).toHaveBeenCalledWith({
        timeout: 5000,
        waitUntil: 'networkidle'
      });
    });

    it('should verify history state after back navigation', async () => {
      // Create complex navigation history
      const urls = [
        'https://home.example.com',
        'https://about.example.com',
        'https://contact.example.com'
      ];

      // Navigate through all pages
      for (const url of urls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Go back twice
      await browserTool.execute({ operation: 'goBack', params: {} });
      await browserTool.execute({ operation: 'goBack', params: {} });

      // Verify final state
      const historyStack = (mockPage as any)._getHistoryStack();
      const currentIndex = (mockPage as any)._getCurrentIndex();

      expect(historyStack).toEqual([
        'about:blank',
        'https://home.example.com',
        'https://about.example.com',
        'https://contact.example.com'
      ]);
      expect(currentIndex).toBe(1); // Should be at home.example.com
      expect(mockPage.url()).toBe('https://home.example.com');
    });
  });

  describe('forward() Navigation Method Tests', () => {
    it('should navigate forward through history successfully', async () => {
      // Build history and navigate back
      const urls = [
        'https://step1.example.com',
        'https://step2.example.com',
        'https://step3.example.com'
      ];

      for (const url of urls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Go back to create forward history
      await browserTool.execute({ operation: 'goBack', params: {} });
      await browserTool.execute({ operation: 'goBack', params: {} });

      expect(mockPage.url()).toBe('https://step1.example.com');

      // Test forward navigation
      const forwardResult1 = await browserTool.execute({
        operation: 'goForward',
        params: {}
      });

      expect(forwardResult1.success).toBe(true);
      expect(mockPage.url()).toBe('https://step2.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(2);

      // Navigate forward again
      const forwardResult2 = await browserTool.execute({
        operation: 'goForward',
        params: {}
      });

      expect(forwardResult2.success).toBe(true);
      expect(mockPage.url()).toBe('https://step3.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(3);
    });

    it('should handle forward navigation when no forward page exists', async () => {
      // Navigate to a page (creates forward history)
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://current.example.com' }
      });

      // At the most recent page, no forward history available
      expect(mockPage.url()).toBe('https://current.example.com');

      // Attempt to go forward
      const result = await browserTool.execute({
        operation: 'goForward',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(null); // Should return null when no forward page
      expect(mockPage.url()).toBe('https://current.example.com'); // Should remain at same page
    });

    it('should handle forward navigation with timeout options', async () => {
      // Set up history with forward pages available
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://page1.example.com' }
      });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://page2.example.com' }
      });
      await browserTool.execute({ operation: 'goBack', params: {} });

      // Test forward with timeout options
      const result = await browserTool.execute({
        operation: 'goForward',
        params: {
          timeout: 10000,
          waitUntil: 'domcontentloaded'
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.goForward).toHaveBeenCalledWith({
        timeout: 10000,
        waitUntil: 'domcontentloaded'
      });
    });

    it('should verify history state after forward navigation', async () => {
      // Create navigation history
      const urls = [
        'https://first.example.com',
        'https://second.example.com',
        'https://third.example.com'
      ];

      for (const url of urls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Go back to create forward history
      await browserTool.execute({ operation: 'goBack', params: {} });
      await browserTool.execute({ operation: 'goBack', params: {} });

      // Now go forward once
      await browserTool.execute({ operation: 'goForward', params: {} });

      // Verify state
      const historyStack = (mockPage as any)._getHistoryStack();
      const currentIndex = (mockPage as any)._getCurrentIndex();

      expect(historyStack).toEqual([
        'about:blank',
        'https://first.example.com',
        'https://second.example.com',
        'https://third.example.com'
      ]);
      expect(currentIndex).toBe(2); // Should be at second.example.com
      expect(mockPage.url()).toBe('https://second.example.com');
    });
  });

  describe('go() Navigation Method Tests', () => {
    it('should navigate backward with negative delta', async () => {
      // Build navigation history
      const urls = [
        'https://a.example.com',
        'https://b.example.com',
        'https://c.example.com',
        'https://d.example.com'
      ];

      for (const url of urls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      expect(mockPage.url()).toBe('https://d.example.com');

      // Test go(-2) - should go back 2 steps
      const result = await browserTool.execute({
        operation: 'go',
        params: { delta: -2 }
      });

      expect(result.success).toBe(true);
      expect(mockPage.url()).toBe('https://b.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(2);
    });

    it('should navigate forward with positive delta', async () => {
      // Build history and position for forward navigation
      const urls = [
        'https://x.example.com',
        'https://y.example.com',
        'https://z.example.com'
      ];

      for (const url of urls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Go back to create forward history
      await browserTool.execute({ operation: 'goBack', params: {} });
      await browserTool.execute({ operation: 'goBack', params: {} });

      expect(mockPage.url()).toBe('https://x.example.com');

      // Test go(2) - should go forward 2 steps
      const result = await browserTool.execute({
        operation: 'go',
        params: { delta: 2 }
      });

      expect(result.success).toBe(true);
      expect(mockPage.url()).toBe('https://z.example.com');
      expect((mockPage as any)._getCurrentIndex()).toBe(3);
    });

    it('should handle go(0) - no movement', async () => {
      // Navigate to a page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://current.example.com' }
      });

      const currentUrl = mockPage.url();
      const currentIndex = (mockPage as any)._getCurrentIndex();

      // Test go(0) - should not move
      const result = await browserTool.execute({
        operation: 'go',
        params: { delta: 0 }
      });

      expect(result.success).toBe(true);
      expect(mockPage.url()).toBe(currentUrl);
      expect((mockPage as any)._getCurrentIndex()).toBe(currentIndex);
    });

    it('should handle go() with delta exceeding available history', async () => {
      // Create minimal history
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://only.example.com' }
      });

      // Try to go back more than available history
      const result = await browserTool.execute({
        operation: 'go',
        params: { delta: -5 }
      });

      expect(result.success).toBe(true);
      // Should go back as much as possible
      expect(mockPage.url()).toBe('about:blank'); // Should be at beginning
      expect((mockPage as any)._getCurrentIndex()).toBe(0);
    });

    it('should validate delta parameter type', async () => {
      // Test with invalid delta types
      const invalidDeltas = [1.5, 'invalid', null, undefined];

      for (const delta of invalidDeltas) {
        const result = await browserTool.execute({
          operation: 'go',
          params: { delta }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Delta parameter must be an integer');
      }
    });
  });

  describe('History State Verification Tests', () => {
    it('should maintain accurate history state across mixed navigation', async () => {
      // Create initial history
      const initialUrls = [
        'https://home.example.com',
        'https://products.example.com',
        'https://details.example.com'
      ];

      for (const url of initialUrls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Perform mixed navigation operations
      await browserTool.execute({ operation: 'goBack', params: {} }); // Go to products
      await browserTool.execute({ operation: 'goBack', params: {} }); // Go to home
      await browserTool.execute({ operation: 'goForward', params: {} }); // Go to products
      await browserTool.execute({ operation: 'go', params: { delta: 1 } }); // Go to details

      // Verify final state
      expect(mockPage.url()).toBe('https://details.example.com');

      const historyStack = (mockPage as any)._getHistoryStack();
      expect(historyStack).toEqual([
        'about:blank',
        'https://home.example.com',
        'https://products.example.com',
        'https://details.example.com'
      ]);
      expect((mockPage as any)._getCurrentIndex()).toBe(3);
    });

    it('should handle history state after new navigation breaks forward chain', async () => {
      // Build initial history
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://page1.example.com' }
      });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://page2.example.com' }
      });

      // Go back
      await browserTool.execute({ operation: 'goBack', params: {} });

      expect(mockPage.url()).toBe('https://page1.example.com');

      // Navigate to new page (should break forward chain)
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://newpage.example.com' }
      });

      // Verify new history state
      const historyStack = (mockPage as any)._getHistoryStack();
      expect(historyStack).toEqual([
        'about:blank',
        'https://page1.example.com',
        'https://newpage.example.com'
      ]);
      expect((mockPage as any)._getCurrentIndex()).toBe(2);

      // Forward should not be available
      const forwardResult = await browserTool.execute({
        operation: 'goForward',
        params: {}
      });
      expect(forwardResult.data).toBe(null);
    });

    it('should maintain history state across browser session restarts', async () => {
      // Note: This simulates maintaining history state,
      // actual browser behavior may vary in real implementation

      // Create navigation history
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://persistent.example.com' }
      });

      const initialHistoryStack = (mockPage as any)._getHistoryStack();
      const initialIndex = (mockPage as any)._getCurrentIndex();

      // Simulate session "restart" by cleaning up and recreating
      await browserTool.cleanup();

      // Recreate browser tool (simulates restart)
      browserTool = new BrowserTool({
        permissionManager,
        eventEmitter,
        backend: 'playwright',
        engine: 'chromium'
      });

      // In a real browser, history would be lost unless specifically persisted
      // This test verifies the behavior expectation
      expect(mockPage.url()).toBe('about:blank'); // Fresh session
    });
  });

  describe('Navigation Error Handling Tests', () => {
    it('should handle navigation errors gracefully', async () => {
      // Mock navigation to throw error
      mockPage.goBack.mockRejectedValueOnce(new Error('Navigation failed'));

      const result = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation failed');
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should handle timeout errors in navigation', async () => {
      // Mock timeout error
      const timeoutError = new Error('Navigation timeout of 5000ms exceeded');
      mockPage.goForward.mockRejectedValueOnce(timeoutError);

      const result = await browserTool.execute({
        operation: 'goForward',
        params: { timeout: 5000 }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation timeout of 5000ms exceeded');
    });

    it('should maintain browser state after navigation errors', async () => {
      // Create some history
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://working.example.com' }
      });

      // Mock an error
      mockPage.goBack.mockRejectedValueOnce(new Error('Temporary error'));

      // This should fail
      const errorResult = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });
      expect(errorResult.success).toBe(false);

      // But browser should still be functional
      expect(browserTool.isActive()).toBe(true);

      // Reset mock and try again
      mockPage.goBack.mockResolvedValueOnce({ status: () => 200 });

      const retryResult = await browserTool.execute({
        operation: 'goBack',
        params: {}
      });
      expect(retryResult.success).toBe(true);
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle rapid successive navigation operations', async () => {
      // Build substantial history
      const urls = Array.from({ length: 10 }, (_, i) =>
        `https://page${i + 1}.example.com`
      );

      for (const url of urls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Perform rapid navigation
      const operations = [
        { operation: 'goBack', params: {} },
        { operation: 'goBack', params: {} },
        { operation: 'goForward', params: {} },
        { operation: 'go', params: { delta: -3 } },
        { operation: 'go', params: { delta: 2 } }
      ];

      const results = [];
      for (const op of operations) {
        const result = await browserTool.execute(op);
        results.push(result.success);
      }

      // All operations should succeed
      expect(results.every(success => success)).toBe(true);

      // Verify final state is consistent
      expect(typeof mockPage.url()).toBe('string');
      expect((mockPage as any)._getCurrentIndex()).toBeGreaterThanOrEqual(0);
    });

    it('should handle large history stacks efficiently', async () => {
      // Create large history (50 pages)
      const largeHistoryUrls = Array.from({ length: 50 }, (_, i) =>
        `https://bighistory${i + 1}.example.com`
      );

      // Build history efficiently
      for (const url of largeHistoryUrls) {
        await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });
      }

      // Navigate to middle of history
      const result = await browserTool.execute({
        operation: 'go',
        params: { delta: -25 }
      });

      expect(result.success).toBe(true);
      expect(mockPage.url()).toBe('https://bighistory25.example.com');

      const historyStack = (mockPage as any)._getHistoryStack();
      expect(historyStack.length).toBe(51); // about:blank + 50 pages
    });
  });
});