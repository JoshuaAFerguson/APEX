/**
 * @fileoverview Performance Tests for Navigation Test Utilities
 *
 * This file focuses on performance testing, load testing, and benchmarking
 * of the navigation test utilities under various load conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NavigationTestHelper,
  NavigationTestFixture,
  NavigationTestFixtureFactory,
  createNavigationTestHelper,
  NavigationTestSetup,
} from '../navigation-test-utils.js';

describe('NavigationTestUtils - Performance Tests', () => {
  let helper: NavigationTestHelper | null = null;
  let fixture: NavigationTestFixture | null = null;

  afterEach(async () => {
    if (helper) {
      await helper.teardown().catch(console.warn);
      helper = null;
    }
    if (fixture) {
      await fixture.teardown().catch(console.warn);
      fixture = null;
    }
  });

  describe('Navigation Performance Benchmarks', () => {
    it('should measure navigation timing across multiple attempts', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 10000,
      });
      await helper.setup();

      const iterations = 10;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = await helper.goto('about:blank');
        const endTime = performance.now();

        results.push({
          attempt: i + 1,
          duration: result.duration,
          totalTime: endTime - startTime,
          success: result.success,
          metrics: result.metrics,
        });

        expect(result.success).toBe(true);
      }

      // Calculate performance statistics
      const durations = results.map(r => r.duration);
      const totalTimes = results.map(r => r.totalTime);

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const avgTotalTime = totalTimes.reduce((a, b) => a + b) / totalTimes.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log('Navigation Performance Benchmark:', {
        iterations,
        avgNavigationDuration: avgDuration,
        avgTotalTime,
        minDuration,
        maxDuration,
        standardDeviation: calculateStandardDeviation(durations),
      });

      // Performance assertions
      expect(avgDuration).toBeLessThan(5000); // Should average under 5 seconds
      expect(maxDuration).toBeLessThan(10000); // Max should be under 10 seconds
      expect(minDuration).toBeGreaterThan(0); // Should always take some time
    });

    it('should handle rapid successive navigations', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 5000,
      });
      await helper.setup();

      const rapidNavigations = 20;
      const urls = Array.from({ length: rapidNavigations }, (_, i) =>
        `data:text/html,<html><body><h1>Page ${i + 1}</h1></body></html>`
      );

      const startTime = performance.now();
      const results = [];

      for (const url of urls) {
        const result = await helper.goto(url);
        results.push(result);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all navigations succeeded
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(rapidNavigations);

      console.log('Rapid Navigation Performance:', {
        totalNavigations: rapidNavigations,
        totalTime,
        avgTimePerNavigation: totalTime / rapidNavigations,
        successRate: (successCount / rapidNavigations) * 100,
      });

      // Should complete all navigations in reasonable time
      expect(totalTime).toBeLessThan(30000); // 30 seconds max for 20 navigations
    });

    it('should benchmark different navigation patterns', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 8000,
      });
      await helper.setup();

      const patterns = {
        simple: 'data:text/html,<html><body>Simple</body></html>',
        withImages: `data:text/html,<html><body>
          <h1>Images Test</h1>
          ${Array.from({ length: 10 }, (_, i) =>
            `<img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><text x='10' y='50'>${i}</text></svg>" alt="Test ${i}">`
          ).join('')}
        </body></html>`,
        withScripts: `data:text/html,<html><body>
          <h1>Scripts Test</h1>
          <script>
            for (let i = 0; i < 1000; i++) {
              console.log('Script execution', i);
            }
          </script>
        </body></html>`,
        largePage: `data:text/html,<html><body>
          <h1>Large Page Test</h1>
          ${Array.from({ length: 500 }, (_, i) =>
            `<div id="element-${i}">Element ${i} with some content</div>`
          ).join('')}
        </body></html>`,
      };

      const benchmarkResults: Record<string, any> = {};

      for (const [patternName, url] of Object.entries(patterns)) {
        const iterations = 5;
        const results = [];

        for (let i = 0; i < iterations; i++) {
          const result = await helper.goto(url);
          results.push(result);
        }

        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        const successRate = results.filter(r => r.success).length / results.length;

        benchmarkResults[patternName] = {
          avgDuration,
          successRate,
          samples: iterations,
        };
      }

      console.log('Navigation Pattern Benchmarks:', benchmarkResults);

      // All patterns should have high success rate
      Object.values(benchmarkResults).forEach((result: any) => {
        expect(result.successRate).toBeGreaterThan(0.8); // 80% success rate minimum
      });
    });
  });

  describe('Concurrent Load Testing', () => {
    it('should handle multiple concurrent navigation helpers', async () => {
      const concurrency = 5;
      const helpers: NavigationTestHelper[] = [];

      try {
        // Create multiple helpers concurrently
        const setupPromises = Array.from({ length: concurrency }, async () => {
          const h = createNavigationTestHelper({ headless: true });
          await h.setup();
          return h;
        });

        const setupResults = await Promise.all(setupPromises);
        helpers.push(...setupResults);

        // Perform concurrent navigations
        const navigationPromises = helpers.map((h, index) =>
          h.goto(`data:text/html,<html><body><h1>Helper ${index + 1}</h1></body></html>`)
        );

        const startTime = performance.now();
        const results = await Promise.all(navigationPromises);
        const endTime = performance.now();

        // Verify all navigations succeeded
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBe(concurrency);

        console.log('Concurrent Navigation Performance:', {
          concurrency,
          totalTime: endTime - startTime,
          avgTimePerHelper: (endTime - startTime) / concurrency,
          successRate: (successCount / concurrency) * 100,
        });

      } finally {
        // Cleanup all helpers
        await Promise.all(
          helpers.map(h => h.teardown().catch(console.warn))
        );
      }
    });

    it('should handle multiple concurrent fixtures', async () => {
      const concurrency = 3;
      const fixtures: NavigationTestFixture[] = [];

      try {
        // Create multiple fixtures
        for (let i = 0; i < concurrency; i++) {
          const f = NavigationTestFixtureFactory.createUnitTestFixture();
          await f.setup();
          fixtures.push(f);
        }

        // Perform concurrent operations
        const operations = fixtures.map(async (f, index) => {
          const page = await f.createPage({
            content: `<html><body><h1>Fixture ${index + 1}</h1></body></html>`,
          });

          await f.navigationHelper.assertPageContent({ text: `Fixture ${index + 1}` });

          return {
            fixture: index + 1,
            success: true,
          };
        });

        const startTime = performance.now();
        const results = await Promise.all(operations);
        const endTime = performance.now();

        // Verify all operations succeeded
        expect(results.length).toBe(concurrency);
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        console.log('Concurrent Fixture Performance:', {
          concurrency,
          totalTime: endTime - startTime,
          avgTimePerFixture: (endTime - startTime) / concurrency,
        });

      } finally {
        // Cleanup all fixtures
        await Promise.all(
          fixtures.map(f => f.teardown().catch(console.warn))
        );
      }
    });
  });

  describe('Memory and Resource Testing', () => {
    it('should handle large page content efficiently', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 15000,
      });
      await helper.setup();

      if (helper.page) {
        // Create increasingly large pages
        const sizes = [100, 500, 1000, 2000];
        const results = [];

        for (const size of sizes) {
          const largeContent = `
            <html>
            <head><title>Large Page ${size}</title></head>
            <body>
              <h1>Large Page Test - ${size} elements</h1>
              ${Array.from({ length: size }, (_, i) => `
                <div class="item" id="item-${i}" data-index="${i}">
                  <h3>Item ${i}</h3>
                  <p>This is content for item number ${i}</p>
                  <button onclick="alert('Item ${i} clicked')">Click me</button>
                  <input type="text" value="Input ${i}" />
                </div>
              `).join('')}
            </body>
            </html>
          `;

          const startTime = performance.now();
          await helper.page.setContent(largeContent);

          // Wait for page to be fully loaded
          await helper.page.waitForLoadState('domcontentloaded');

          // Test that we can still interact with the page
          await helper.assertPageContent({
            selector: '.item',
            count: size,
            timeout: 10000,
          });

          const endTime = performance.now();

          results.push({
            size,
            loadTime: endTime - startTime,
          });
        }

        console.log('Large Page Performance:', results);

        // Performance should degrade somewhat linearly
        results.forEach((result, index) => {
          if (index > 0) {
            const previousResult = results[index - 1];
            const sizeRatio = result.size / previousResult.size;
            const timeRatio = result.loadTime / previousResult.loadTime;

            // Time ratio should not be dramatically worse than size ratio
            expect(timeRatio).toBeLessThan(sizeRatio * 3);
          }
        });
      }
    });

    it('should handle repeated navigation cycles without memory leaks', async () => {
      helper = createNavigationTestHelper({
        headless: true,
        navigationTimeout: 8000,
      });
      await helper.setup();

      const cycles = 50;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < cycles; i++) {
        // Navigate to a page with some content
        await helper.goto(`data:text/html,<html><body>
          <h1>Cycle ${i + 1}</h1>
          ${Array.from({ length: 100 }, (_, j) =>
            `<div id="elem-${j}">Element ${j}</div>`
          ).join('')}
        </body></html>`);

        // Perform some interactions
        await helper.assertPageContent({ text: `Cycle ${i + 1}` });

        // Take memory snapshot (basic check)
        if (global.gc) {
          global.gc();
        }

        // Record memory usage (simplified)
        const memoryUsage = process.memoryUsage().heapUsed;
        memorySnapshots.push(memoryUsage);

        // Every 10 cycles, check memory trend
        if ((i + 1) % 10 === 0 && i > 10) {
          const recentAvg = memorySnapshots.slice(-10).reduce((a, b) => a + b) / 10;
          const olderAvg = memorySnapshots.slice(-20, -10).reduce((a, b) => a + b) / 10;

          // Memory should not be consistently growing
          const growthRatio = recentAvg / olderAvg;
          expect(growthRatio).toBeLessThan(2); // Should not double in memory usage
        }
      }

      console.log('Memory Usage Test:', {
        cycles,
        initialMemory: memorySnapshots[0],
        finalMemory: memorySnapshots[memorySnapshots.length - 1],
        peakMemory: Math.max(...memorySnapshots),
        avgMemory: memorySnapshots.reduce((a, b) => a + b) / memorySnapshots.length,
      });
    });
  });

  describe('Setup and Teardown Performance', () => {
    it('should measure setup and teardown times', async () => {
      const iterations = 10;
      const setupTimes: number[] = [];
      const teardownTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Measure setup time
        const setupStart = performance.now();
        const h = createNavigationTestHelper({ headless: true });
        await h.setup();
        const setupEnd = performance.now();

        setupTimes.push(setupEnd - setupStart);

        // Measure teardown time
        const teardownStart = performance.now();
        await h.teardown();
        const teardownEnd = performance.now();

        teardownTimes.push(teardownEnd - teardownStart);
      }

      const avgSetupTime = setupTimes.reduce((a, b) => a + b) / setupTimes.length;
      const avgTeardownTime = teardownTimes.reduce((a, b) => a + b) / teardownTimes.length;

      console.log('Setup/Teardown Performance:', {
        iterations,
        avgSetupTime,
        avgTeardownTime,
        maxSetupTime: Math.max(...setupTimes),
        maxTeardownTime: Math.max(...teardownTimes),
      });

      // Setup and teardown should complete in reasonable time
      expect(avgSetupTime).toBeLessThan(10000); // 10 seconds average
      expect(avgTeardownTime).toBeLessThan(5000); // 5 seconds average
    });

    it('should benchmark different setup configurations', async () => {
      const configurations = [
        { name: 'minimal', config: { headless: true } },
        { name: 'with_debugging', config: { headless: false, devtools: true, slowMo: 100 } },
        { name: 'fast_ci', config: { headless: true, slowMo: 0, devtools: false } },
      ];

      const benchmarks: Record<string, any> = {};

      for (const { name, config } of configurations) {
        const iterations = 5;
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          const h = createNavigationTestHelper(config);
          await h.setup();
          await h.teardown();
          const endTime = performance.now();

          times.push(endTime - startTime);
        }

        benchmarks[name] = {
          avgTime: times.reduce((a, b) => a + b) / times.length,
          minTime: Math.min(...times),
          maxTime: Math.max(...times),
          iterations,
        };
      }

      console.log('Configuration Benchmarks:', benchmarks);

      // All configurations should complete setup/teardown
      Object.values(benchmarks).forEach((benchmark: any) => {
        expect(benchmark.avgTime).toBeLessThan(20000); // 20 seconds max
        expect(benchmark.avgTime).toBeGreaterThan(0);
      });
    });
  });
});

/**
 * Helper function to calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDifference = squaredDifferences.reduce((a, b) => a + b) / squaredDifferences.length;
  return Math.sqrt(avgSquaredDifference);
}