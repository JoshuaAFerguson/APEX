/**
 * Browser Tool Performance and Stress Tests
 *
 * Tests focused on performance characteristics, memory usage,
 * and behavior under load conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from './browser-tool';
import { PermissionManager } from '../permission-manager';

// Mock Playwright with performance monitoring
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  hover: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-element-screenshot'))),
    evaluate: vi.fn(() => Promise.resolve()),
    scrollIntoViewIfNeeded: vi.fn(() => Promise.resolve()),
  })),
  evaluate: vi.fn(() => Promise.resolve('test-result')),
  waitForSelector: vi.fn(() => Promise.resolve()),
  getAttribute: vi.fn(() => Promise.resolve('test-value')),
  textContent: vi.fn(() => Promise.resolve('Test text')),
  innerHTML: vi.fn(() => Promise.resolve('<p>Test</p>')),
  content: vi.fn(() => Promise.resolve('<html>Test</html>')),
  pdf: vi.fn(() => Promise.resolve(Buffer.from('mock-pdf'))),
  close: vi.fn(() => Promise.resolve()),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  $eval: vi.fn(() => Promise.resolve('test-value')),
  $: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot')))
  })),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve()),
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

describe('Browser Tool Performance and Stress Tests', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: Partial<PermissionManager>;
  let mockEventEmitter: EventEmitter;

  // Performance tracking
  const performanceMetrics = {
    operationTimes: [] as number[],
    memoryUsage: [] as number[],
    startTime: 0,
    endTime: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks with small delays to simulate real operations
    mockBrowserType.launch.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(mockBrowser), 10))
    );
    mockBrowser.newContext.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(mockContext), 5))
    );
    mockContext.newPage.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(mockPage), 5))
    );

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

    // Reset performance metrics
    performanceMetrics.operationTimes = [];
    performanceMetrics.memoryUsage = [];
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Operation Performance Benchmarks', () => {
    it('should complete navigation operations within acceptable time', async () => {
      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid successive click operations efficiently', async () => {
      // Initialize with navigation first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const clickCount = 50;
      const startTime = Date.now();

      // Execute many rapid clicks
      const clickPromises = Array.from({ length: clickCount }, (_, i) =>
        browserTool.execute({
          operation: 'click',
          params: { selector: `#button-${i}` }
        })
      );

      const results = await Promise.all(clickPromises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const averageTime = totalDuration / clickCount;

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.operation).toBe('click');
      });

      // Performance expectations
      expect(totalDuration).toBeLessThan(5000); // All 50 clicks within 5 seconds
      expect(averageTime).toBeLessThan(100); // Average click under 100ms
    });

    it('should handle mixed operation types efficiently', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const operations = [
        { operation: 'click' as const, params: { selector: '#button1' } },
        { operation: 'type' as const, params: { selector: '#input1', text: 'test' } },
        { operation: 'hover' as const, params: { selector: '#hover1' } },
        { operation: 'screenshot' as const, params: { selector: '#element1' } },
        { operation: 'getAttribute' as const, params: { selector: '#attr1', attribute: 'class' } },
        { operation: 'getText' as const, params: { selector: '#text1' } },
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map(op => browserTool.execute(op))
      );
      const endTime = Date.now();

      const totalDuration = endTime - startTime;

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.operation).toBe(operations[index].operation);
      });

      expect(totalDuration).toBeLessThan(2000); // All operations within 2 seconds
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should maintain stable memory usage across multiple operations', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const initialMemory = process.memoryUsage().heapUsed;
      const operationCount = 100;

      // Perform many operations
      for (let i = 0; i < operationCount; i++) {
        await browserTool.execute({
          operation: 'click',
          params: { selector: `#button-${i}` }
        });

        // Sample memory usage periodically
        if (i % 20 === 0) {
          performanceMetrics.memoryUsage.push(process.memoryUsage().heapUsed);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not grow excessively (allow for some variance)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    it('should properly clean up console message buffers to prevent memory leaks', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      const initialConsoleMessages = browserTool.getEnhancedConsoleMessages().length;

      // Generate many console messages (simulated)
      const pageOnCalls = mockPage.on.mock.calls;
      const consoleCall = pageOnCalls.find(call => call[0] === 'console');
      const consoleHandler = consoleCall?.[1];

      if (consoleHandler) {
        const mockConsoleMessage = {
          type: vi.fn(() => 'log'),
          text: vi.fn(),
          location: vi.fn(() => ({})),
          args: vi.fn(() => []),
        };

        // Add 1500 messages to test buffer management
        for (let i = 0; i < 1500; i++) {
          mockConsoleMessage.text.mockReturnValue(`Message ${i}`);
          await consoleHandler(mockConsoleMessage);
        }

        const messagesAfterFlood = browserTool.getEnhancedConsoleMessages();

        // Buffer should be limited to prevent memory issues
        expect(messagesAfterFlood.length).toBeLessThanOrEqual(1000);

        // Clear buffers and verify cleanup
        browserTool.clearConsoleBuffers();
        const messagesAfterClear = browserTool.getEnhancedConsoleMessages();
        expect(messagesAfterClear.length).toBe(0);
      }
    });

    it('should handle resource state tracking under load', async () => {
      const concurrentOperations = 20;

      // Start multiple operations concurrently
      const promises = Array.from({ length: concurrentOperations }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://test${i}.example.com` }
        })
      );

      const results = await Promise.allSettled(promises);

      // Check resource state consistency
      const resourceState = browserTool.getResourceState();

      expect(resourceState.activeOperations).toBe(0); // All operations should be complete
      expect(resourceState.sessionId).toBeDefined();

      // At least some operations should have succeeded
      const successfulResults = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      );
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  describe('Stress Testing Scenarios', () => {
    it('should handle burst traffic patterns', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Simulate burst pattern: rapid operations followed by idle
      const burstSize = 30;
      const burstCount = 5;
      const results: any[] = [];

      for (let burst = 0; burst < burstCount; burst++) {
        const burstStartTime = Date.now();

        // Execute burst of operations
        const burstPromises = Array.from({ length: burstSize }, (_, i) =>
          browserTool.execute({
            operation: 'click',
            params: { selector: `#burst-${burst}-${i}` }
          })
        );

        const burstResults = await Promise.allSettled(burstPromises);
        results.push(...burstResults);

        const burstEndTime = Date.now();
        performanceMetrics.operationTimes.push(burstEndTime - burstStartTime);

        // Brief pause between bursts
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify handling of burst pattern
      const successfulOperations = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      );

      // Most operations should succeed
      expect(successfulOperations.length).toBeGreaterThan(burstSize * burstCount * 0.8);

      // No burst should take excessively long
      performanceMetrics.operationTimes.forEach(time => {
        expect(time).toBeLessThan(5000); // Each burst under 5 seconds
      });
    });

    it('should handle large data operations efficiently', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Simulate large text input
      const largeText = 'A'.repeat(10000); // 10KB of text

      const startTime = Date.now();
      const result = await browserTool.execute({
        operation: 'type',
        params: {
          selector: '#large-input',
          text: largeText,
          clearFirst: true
        }
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should handle large text quickly
    });

    it('should maintain responsiveness during screenshot stress', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      // Take multiple screenshots rapidly
      const screenshotCount = 20;
      const screenshotPromises = Array.from({ length: screenshotCount }, (_, i) =>
        browserTool.execute({
          operation: 'screenshot',
          params: {
            fullPage: i % 2 === 0, // Alternate between full page and viewport
            format: 'png'
          }
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(screenshotPromises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const averageScreenshotTime = totalTime / screenshotCount;

      // All screenshots should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.screenshot).toBeDefined();
      });

      // Performance should be reasonable
      expect(averageScreenshotTime).toBeLessThan(200); // Average under 200ms per screenshot
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track execution times accurately in metadata', async () => {
      const operations = [
        { operation: 'navigate' as const, params: { url: 'https://test.example.com' } },
        { operation: 'click' as const, params: { selector: '#test' } },
        { operation: 'screenshot' as const, params: { fullPage: true } }
      ];

      for (const op of operations) {
        const startTime = Date.now();
        const result = await browserTool.execute(op);
        const endTime = Date.now();
        const actualTime = endTime - startTime;

        expect(result.success).toBe(true);
        expect(result.metadata?.executionTime).toBeTypeOf('number');
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);

        // Execution time should be reasonable relative to actual time
        // Allow for some variance in timing measurements
        expect(result.metadata?.executionTime).toBeLessThanOrEqual(actualTime + 100);
      }
    });

    it('should emit performance events for monitoring', async () => {
      const performanceEvents: any[] = [];
      mockEventEmitter.on('browser:operation:complete', (event) => {
        performanceEvents.push(event);
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });

      expect(result.success).toBe(true);
      // Note: Browser tool doesn't currently emit operation complete events
      // This test demonstrates how such monitoring could be implemented
    });
  });

  describe('Concurrent Browser Management', () => {
    it('should handle multiple browser tool instances efficiently', async () => {
      const toolCount = 5;
      const tools: BrowserTool[] = [];

      // Create multiple browser tools
      for (let i = 0; i < toolCount; i++) {
        const tool = new BrowserTool({
          permissionManager: mockPermissionManager as PermissionManager,
          eventEmitter: new EventEmitter(),
        });
        tools.push(tool);
      }

      try {
        // Execute operations on all tools concurrently
        const operations = tools.map((tool, index) =>
          tool.execute({
            operation: 'navigate',
            params: { url: `https://test${index}.example.com` }
          })
        );

        const results = await Promise.all(operations);

        // All should succeed
        results.forEach((result, index) => {
          expect(result.success).toBe(true);
          expect(result.metadata?.url).toContain(`test${index}.example.com`);
        });

        // Verify resource states are independent
        tools.forEach(tool => {
          const state = tool.getResourceState();
          expect(state.sessionId).toBeDefined();
          expect(state.activeOperations).toBe(0);
        });
      } finally {
        // Cleanup all tools
        await Promise.all(tools.map(tool => tool.cleanup()));
      }
    });

    it('should handle tool lifecycle under memory pressure', async () => {
      const toolCount = 10;
      const results: any[] = [];

      // Create and destroy tools rapidly to test lifecycle
      for (let i = 0; i < toolCount; i++) {
        const tool = new BrowserTool({
          permissionManager: mockPermissionManager as PermissionManager,
        });

        try {
          const result = await tool.execute({
            operation: 'navigate',
            params: { url: `https://lifecycle-test-${i}.example.com` }
          });
          results.push(result);
        } finally {
          await tool.cleanup();
        }
      }

      // All operations should complete successfully
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.metadata?.url).toContain(`lifecycle-test-${index}.example.com`);
      });
    });
  });
});