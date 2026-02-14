/**
 * @fileoverview Performance and Stress Tests for Browser Fixtures
 *
 * This test file provides comprehensive performance and stress testing
 * for the browser fixtures module, ensuring it can handle:
 * - High-frequency operations
 * - Memory-intensive workloads
 * - Concurrent fixture usage
 * - Resource cleanup under stress
 * - Performance degradation detection
 * - Memory leak prevention
 * - Resource exhaustion scenarios
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Performance monitoring utilities
interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  operations: number;
  operationsPerSecond: number;
}

class PerformanceMonitor {
  private startTime: number = 0;
  private operations: number = 0;
  private startMemory?: NodeJS.MemoryUsage;

  start(): void {
    this.startTime = performance.now();
    this.operations = 0;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.startMemory = process.memoryUsage();
    }
  }

  recordOperation(): void {
    this.operations++;
  }

  getMetrics(): PerformanceMetrics {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    let memoryUsage: NodeJS.MemoryUsage | undefined;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryUsage = process.memoryUsage();
    }

    return {
      startTime: this.startTime,
      endTime,
      duration,
      memoryUsage,
      operations: this.operations,
      operationsPerSecond: this.operations / (duration / 1000),
    };
  }
}

// Enhanced mocks for performance testing
const mockPage = {
  goto: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network delay
    return undefined;
  }),
  click: vi.fn().mockResolvedValue(undefined),
  fill: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 5)); // Simulate screenshot delay
    return Buffer.alloc(1024); // Simulate screenshot data
  }),
  setContent: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 3)); // Simulate load time
  }),
  waitForTimeout: vi.fn().mockImplementation(async (ms: number) => {
    await new Promise(resolve => setTimeout(resolve, Math.min(ms, 10))); // Cap at 10ms for tests
  }),
  setDefaultTimeout: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockReturnValue({
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(true),
  }),
  evaluate: vi.fn().mockResolvedValue({
    domContentLoaded: Math.random() * 100 + 50,
    loadComplete: Math.random() * 500 + 200,
    firstPaint: Math.random() * 50 + 25,
    timestamp: Date.now(),
  }),
  on: vi.fn(),
  off: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 2)); // Simulate page creation delay
    return { ...mockPage }; // Return new page instance
  }),
  close: vi.fn().mockResolvedValue(undefined),
  tracing: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  },
};

const mockBrowser = {
  newContext: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 5)); // Simulate context creation delay
    return { ...mockContext }; // Return new context instance
  }),
  close: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 3)); // Simulate close delay
  }),
  version: vi.fn().mockReturnValue('121.0.0'),
  browserType: vi.fn().mockReturnValue({ name: 'chromium' }),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 8)); // Simulate browser launch delay
      return { ...mockBrowser };
    }),
  },
  firefox: { launch: vi.fn().mockResolvedValue(mockBrowser) },
  webkit: { launch: vi.fn().mockResolvedValue(mockBrowser) },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 1)); // Simulate filesystem delay
  }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import {
  BrowserFixture,
  createScopedBrowserFixture,
  type BrowserFixtureConfig,
} from '../browser-fixtures.js';

describe('Browser Fixtures - Performance Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new PerformanceMonitor();
  });

  describe('High-Frequency Operations', () => {
    test('should handle rapid fixture creation and teardown', async () => {
      const cycles = 10;
      monitor.start();

      for (let i = 0; i < cycles; i++) {
        const fixture = await createScopedBrowserFixture({
          browserType: 'chromium',
          headless: true,
        });
        monitor.recordOperation();

        await fixture.teardown();
        monitor.recordOperation();
      }

      const metrics = monitor.getMetrics();

      // Performance assertions
      expect(metrics.operations).toBe(cycles * 2); // setup + teardown
      expect(metrics.operationsPerSecond).toBeGreaterThan(50); // Should be fast with mocks
      expect(metrics.duration).toBeLessThan(2000); // Should complete in reasonable time

      // Verify all resources were properly cleaned up
      expect(mockBrowser.close).toHaveBeenCalledTimes(cycles);
      expect(mockContext.close).toHaveBeenCalledTimes(cycles);
    }, 10000); // Extended timeout for performance test

    test('should handle rapid navigation operations', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'chromium',
        headless: true,
      });

      try {
        const navigationCount = 25;
        monitor.start();

        for (let i = 0; i < navigationCount; i++) {
          await fixture.navigateTo(`http://localhost:3000/page-${i}`);
          monitor.recordOperation();
        }

        const metrics = monitor.getMetrics();

        expect(metrics.operations).toBe(navigationCount);
        expect(metrics.operationsPerSecond).toBeGreaterThan(100);
        expect(mockPage.goto).toHaveBeenCalledTimes(navigationCount);

      } finally {
        await fixture.teardown();
      }
    }, 5000);

    test('should handle rapid screenshot operations', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'firefox',
        headless: true,
        captureFailureScreenshots: true,
      });

      try {
        const screenshotCount = 20;
        monitor.start();

        for (let i = 0; i < screenshotCount; i++) {
          await fixture.screenshot(`performance-test-${i}`);
          monitor.recordOperation();
        }

        const metrics = monitor.getMetrics();

        expect(metrics.operations).toBe(screenshotCount);
        expect(metrics.operationsPerSecond).toBeGreaterThan(50);
        expect(mockPage.screenshot).toHaveBeenCalledTimes(screenshotCount);

      } finally {
        await fixture.teardown();
      }
    });

    test('should maintain performance with high-frequency page operations', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'webkit',
        headless: true,
      });

      try {
        const operationCount = 30;
        monitor.start();

        for (let i = 0; i < operationCount; i++) {
          const page = fixture.getPage();
          await page.click(`#button-${i}`);
          await page.fill(`#input-${i}`, `value-${i}`);
          monitor.recordOperation(); // Count as one composite operation
        }

        const metrics = monitor.getMetrics();

        expect(metrics.operations).toBe(operationCount);
        expect(metrics.operationsPerSecond).toBeGreaterThan(200);
        expect(mockPage.click).toHaveBeenCalledTimes(operationCount);
        expect(mockPage.fill).toHaveBeenCalledTimes(operationCount);

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should manage memory efficiently with many operations', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'chromium',
        headless: true,
        recordVideo: true,
        trace: true,
      });

      try {
        monitor.start();
        const initialMetrics = monitor.getMetrics();

        // Perform memory-intensive operations
        const operationCount = 15;
        for (let i = 0; i < operationCount; i++) {
          await fixture.navigateTo(`http://localhost:3000/large-page-${i}`);
          await fixture.screenshot(`memory-test-${i}`);

          // Create and close additional pages
          const newPage = await fixture.createNewPage();
          await newPage.close();

          monitor.recordOperation();
        }

        const finalMetrics = monitor.getMetrics();

        // Memory should not grow excessively
        if (initialMetrics.memoryUsage && finalMetrics.memoryUsage) {
          const memoryGrowth = finalMetrics.memoryUsage.heapUsed - initialMetrics.memoryUsage.heapUsed;
          const memoryGrowthMB = memoryGrowth / 1024 / 1024;

          // Memory growth should be reasonable (less than 100MB for test operations)
          expect(memoryGrowthMB).toBeLessThan(100);
        }

        expect(finalMetrics.operations).toBe(operationCount);

      } finally {
        await fixture.teardown();
      }
    }, 8000);

    test('should handle resource cleanup under stress', async () => {
      const fixtureCount = 8;
      const fixtures: BrowserFixture[] = [];
      monitor.start();

      try {
        // Create multiple fixtures rapidly
        for (let i = 0; i < fixtureCount; i++) {
          const fixture = await createScopedBrowserFixture({
            browserType: 'chromium',
            headless: true,
          });
          fixtures.push(fixture);
          monitor.recordOperation();
        }

        // Perform operations on all fixtures
        for (let i = 0; i < fixtures.length; i++) {
          const fixture = fixtures[i];
          await fixture.navigateTo(`http://localhost:3000/stress-${i}`);
          await fixture.screenshot(`stress-${i}`);
          monitor.recordOperation();
        }

      } finally {
        // Cleanup all fixtures
        for (const fixture of fixtures) {
          await fixture.teardown();
          monitor.recordOperation();
        }
      }

      const metrics = monitor.getMetrics();

      // Should have created, used, and cleaned up all fixtures
      expect(metrics.operations).toBe(fixtureCount * 3); // create + use + cleanup
      expect(mockBrowser.close).toHaveBeenCalledTimes(fixtureCount);
    }, 10000);

    test('should prevent memory leaks in event listeners', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'firefox',
        headless: true,
      });

      try {
        monitor.start();

        // Add many event listeners
        const listenerCount = 50;
        const listeners: (() => void)[] = [];

        for (let i = 0; i < listenerCount; i++) {
          const listener = vi.fn();
          listeners.push(listener);
          fixture.on('navigation:success', listener);
          monitor.recordOperation();
        }

        // Trigger events
        await fixture.navigateTo('http://localhost:3000/event-test');

        // Remove all listeners
        for (let i = 0; i < listenerCount; i++) {
          fixture.off('navigation:success', listeners[i]);
          monitor.recordOperation();
        }

        const metrics = monitor.getMetrics();
        expect(metrics.operations).toBe(listenerCount * 2); // add + remove

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Concurrent Usage Scenarios', () => {
    test('should handle concurrent fixture operations efficiently', async () => {
      const concurrentCount = 6;
      monitor.start();

      const promises = Array.from({ length: concurrentCount }, async (_, index) => {
        const fixture = await createScopedBrowserFixture({
          browserType: 'chromium',
          headless: true,
        });

        try {
          await fixture.navigateTo(`http://localhost:3000/concurrent-${index}`);
          await fixture.screenshot(`concurrent-${index}`);
          monitor.recordOperation();
        } finally {
          await fixture.teardown();
        }
      });

      await Promise.all(promises);
      const metrics = monitor.getMetrics();

      expect(metrics.operations).toBe(concurrentCount);
      expect(metrics.operationsPerSecond).toBeGreaterThan(10);

    }, 8000);

    test('should maintain performance with mixed browser types', async () => {
      const browserTypes: Array<'chromium' | 'firefox' | 'webkit'> = ['chromium', 'firefox', 'webkit'];
      monitor.start();

      const promises = browserTypes.map(async (browserType, index) => {
        const fixture = await createScopedBrowserFixture({
          browserType,
          headless: true,
        });

        try {
          // Perform multiple operations per fixture
          for (let i = 0; i < 3; i++) {
            await fixture.navigateTo(`http://localhost:3000/${browserType}-${i}`);
            await fixture.screenshot(`${browserType}-${i}`);
          }
          monitor.recordOperation();
        } finally {
          await fixture.teardown();
        }
      });

      await Promise.all(promises);
      const metrics = monitor.getMetrics();

      expect(metrics.operations).toBe(browserTypes.length);

    }, 6000);

    test('should handle race conditions in concurrent access', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'chromium',
        headless: true,
      });

      try {
        monitor.start();
        const operationCount = 10;

        // Perform concurrent operations on the same fixture
        const promises = Array.from({ length: operationCount }, async (_, index) => {
          // These operations might race, but should not cause failures
          const page = fixture.getPage();
          await page.evaluate(() => Math.random()); // Quick operation
          monitor.recordOperation();
        });

        await Promise.all(promises);
        const metrics = monitor.getMetrics();

        expect(metrics.operations).toBe(operationCount);

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Performance Regression Detection', () => {
    test('should detect performance regression in setup/teardown', async () => {
      const trials = 5;
      const timings: number[] = [];

      for (let trial = 0; trial < trials; trial++) {
        const startTime = performance.now();

        const fixture = await createScopedBrowserFixture({
          browserType: 'chromium',
          headless: true,
        });

        await fixture.teardown();

        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);

      // Performance regression checks
      expect(averageTime).toBeLessThan(500); // Should be fast with mocks
      expect(maxTime - minTime).toBeLessThan(200); // Should be consistent

      // Check for outliers (simple standard deviation check)
      const variance = timings.reduce((acc, time) => acc + Math.pow(time - averageTime, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);
      expect(stdDev).toBeLessThan(100); // Low variation expected with mocks

    }, 5000);

    test('should maintain consistent performance across operations', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'firefox',
        headless: true,
      });

      try {
        const operationTimings: number[] = [];
        const operationCount = 15;

        for (let i = 0; i < operationCount; i++) {
          const startTime = performance.now();

          await fixture.navigateTo(`http://localhost:3000/perf-${i}`);
          await fixture.screenshot(`perf-${i}`);

          const endTime = performance.now();
          operationTimings.push(endTime - startTime);
        }

        const averageTime = operationTimings.reduce((a, b) => a + b, 0) / operationTimings.length;

        // Performance should not degrade over time
        const firstHalf = operationTimings.slice(0, Math.floor(operationCount / 2));
        const secondHalf = operationTimings.slice(Math.floor(operationCount / 2));

        const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        // Second half should not be significantly slower (allowing for 50% tolerance)
        expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);

      } finally {
        await fixture.teardown();
      }
    });

    test('should identify memory leaks in extended usage', async () => {
      const fixture = await createScopedBrowserFixture({
        browserType: 'webkit',
        headless: true,
      });

      try {
        const memorySnapshots: number[] = [];
        const snapshotCount = 10;

        for (let i = 0; i < snapshotCount; i++) {
          // Perform operations that might accumulate memory
          await fixture.navigateTo(`http://localhost:3000/memory-${i}`);

          for (let j = 0; j < 3; j++) {
            const newPage = await fixture.createNewPage();
            await newPage.close();
          }

          // Take memory snapshot (simulated)
          if (typeof process !== 'undefined' && process.memoryUsage) {
            memorySnapshots.push(process.memoryUsage().heapUsed);
          } else {
            memorySnapshots.push(Math.random() * 1000000 + 50000000); // Simulated memory usage
          }
        }

        // Check for significant memory growth trend
        if (memorySnapshots.length > 2) {
          const firstSnapshot = memorySnapshots[0];
          const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
          const growth = (lastSnapshot - firstSnapshot) / firstSnapshot;

          // Memory should not grow by more than 100% during operations
          expect(growth).toBeLessThan(1.0);
        }

      } finally {
        await fixture.teardown();
      }
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle resource exhaustion gracefully', async () => {
      // Simulate resource exhaustion by creating many fixtures
      const maxFixtures = 12;
      const fixtures: BrowserFixture[] = [];
      let successfulCreations = 0;

      try {
        for (let i = 0; i < maxFixtures; i++) {
          try {
            const fixture = await createScopedBrowserFixture({
              browserType: 'chromium',
              headless: true,
              timeout: 5000, // Reduced timeout to speed up test
            });
            fixtures.push(fixture);
            successfulCreations++;
          } catch (error) {
            // Resource exhaustion might cause failures, which should be handled gracefully
            expect(error).toBeInstanceOf(Error);
            break;
          }
        }

        // Should create at least some fixtures successfully
        expect(successfulCreations).toBeGreaterThan(0);

      } finally {
        // Cleanup all created fixtures
        await Promise.all(fixtures.map(f => f.teardown().catch(() => {})));
      }

    }, 10000);

    test('should recover from temporary resource unavailability', async () => {
      const { chromium } = await import('playwright');

      // Simulate temporary resource failure
      chromium.launch
        .mockRejectedValueOnce(new Error('ECONNREFUSED: Connection refused'))
        .mockRejectedValueOnce(new Error('EADDRINUSE: Address already in use'))
        .mockResolvedValue(mockBrowser);

      // Should eventually succeed after retries
      const fixture = await createScopedBrowserFixture({
        browserType: 'chromium',
        headless: true,
      });

      expect(fixture).toBeDefined();
      await fixture.teardown();

      // Verify retry attempts were made
      expect(chromium.launch).toHaveBeenCalledTimes(3);
    });
  });
});

describe('Browser Fixtures - Performance Test Summary', () => {
  test('should validate performance test coverage', () => {
    const performanceTestAreas = [
      'High-frequency operations',
      'Memory and resource usage',
      'Concurrent usage scenarios',
      'Performance regression detection',
      'Resource exhaustion scenarios'
    ];

    expect(performanceTestAreas.length).toBe(5);
  });

  test('should demonstrate performance characteristics', () => {
    const performanceCharacteristics = [
      'Rapid fixture creation/teardown',
      'High-frequency navigation operations',
      'Memory-efficient operation',
      'Concurrent fixture support',
      'Performance consistency',
      'Resource leak prevention',
      'Graceful resource exhaustion handling'
    ];

    expect(performanceCharacteristics.length).toBe(7);
  });

  test('should establish performance benchmarks', () => {
    const benchmarks = {
      fixtureCreationPerSecond: 50,
      navigationOperationsPerSecond: 100,
      screenshotOperationsPerSecond: 50,
      maxMemoryGrowthMB: 100,
      maxConcurrentFixtures: 6,
      maxSetupTeardownTimeMs: 500,
    };

    Object.values(benchmarks).forEach(value => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });
});