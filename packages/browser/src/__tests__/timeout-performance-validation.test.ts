/**
 * @file packages/browser/src/__tests__/timeout-performance-validation.test.ts
 *
 * Performance validation tests for timeout configurations
 *
 * Tests performance characteristics and validates that:
 * - Timeout accuracy is within acceptable bounds
 * - Memory usage remains stable during timeout operations
 * - Concurrent timeout operations don't interfere with each other
 * - Browser responsiveness is maintained during timeouts
 * - Resource cleanup happens properly after timeout operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserManager, createBrowserSession } from '../index.js';
import type {
  BrowserManager,
  BrowserSession,
  BrowserSessionConfig
} from '../types.js';

describe('Timeout Performance Validation', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    await manager.shutdown();
  });

  describe('Timing Accuracy Validation', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 10000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Timing accuracy test</div>');
    });

    it('should maintain consistent timeout accuracy across multiple iterations', async () => {
      const targetTimeout = 1000;
      const iterations = 10;
      const tolerance = 0.3; // 30% tolerance
      const measurements: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await session.click(`#nonexistent-${i}`, { timeout: targetTimeout });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        measurements.push(duration);
      }

      // Calculate statistics
      const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const variance = measurements.reduce((a, b) => a + Math.pow(b - average, 2), 0) / measurements.length;
      const stdDev = Math.sqrt(variance);

      // Validate average timing
      const expectedMin = targetTimeout * (1 - tolerance);
      const expectedMax = targetTimeout * (1 + tolerance);

      expect(average).toBeGreaterThanOrEqual(expectedMin);
      expect(average).toBeLessThan(expectedMax);

      // Validate consistency (standard deviation should be reasonable)
      expect(stdDev).toBeLessThan(targetTimeout * 0.2); // 20% of target timeout
    });

    it('should scale timeout accuracy proportionally across different durations', async () => {
      const timeouts = [200, 500, 800, 1200, 1800];
      const tolerance = 0.35; // 35% tolerance for shorter timeouts

      const results = [];

      for (const timeout of timeouts) {
        const measurements = [];

        // Take 3 measurements per timeout value
        for (let i = 0; i < 3; i++) {
          const startTime = Date.now();
          await session.waitForElement(`#scale-test-${timeout}-${i}`, { timeout });
          const duration = Date.now() - startTime;
          measurements.push(duration);
        }

        const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        results.push({ timeout, avgDuration, measurements });
      }

      // Validate each timeout
      for (const { timeout, avgDuration } of results) {
        const expectedMin = timeout * (1 - tolerance);
        const expectedMax = timeout * (1 + tolerance);

        expect(avgDuration).toBeGreaterThanOrEqual(expectedMin);
        expect(avgDuration).toBeLessThan(expectedMax);
      }
    });

    it('should handle rapid timeout sequence efficiently', async () => {
      const sequenceTimeout = 300;
      const sequenceCount = 15;

      const totalStartTime = Date.now();
      const individualTimes: number[] = [];

      for (let i = 0; i < sequenceCount; i++) {
        const startTime = Date.now();
        const result = await session.click(`#sequence-${i}`, { timeout: sequenceTimeout });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(false);
        individualTimes.push(duration);
      }

      const totalDuration = Date.now() - totalStartTime;

      // Individual times should be close to timeout
      const avgIndividualTime = individualTimes.reduce((a, b) => a + b, 0) / individualTimes.length;
      expect(avgIndividualTime).toBeGreaterThanOrEqual(sequenceTimeout * 0.7);
      expect(avgIndividualTime).toBeLessThan(sequenceTimeout * 1.3);

      // Total time should be approximately sum of individual operations
      const expectedTotalMin = sequenceTimeout * sequenceCount * 0.8;
      const expectedTotalMax = sequenceTimeout * sequenceCount * 1.4;

      expect(totalDuration).toBeGreaterThanOrEqual(expectedTotalMin);
      expect(totalDuration).toBeLessThan(expectedTotalMax);
    });
  });

  describe('Concurrent Timeout Operations', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Concurrent test page</div>');
    });

    it('should handle concurrent operations with different timeouts correctly', async () => {
      const operations = [
        { name: 'fast1', timeout: 300, selector: '#fast1' },
        { name: 'fast2', timeout: 350, selector: '#fast2' },
        { name: 'medium1', timeout: 700, selector: '#medium1' },
        { name: 'medium2', timeout: 750, selector: '#medium2' },
        { name: 'slow1', timeout: 1200, selector: '#slow1' },
        { name: 'slow2', timeout: 1300, selector: '#slow2' },
      ];

      const startTime = Date.now();

      // Start all operations concurrently
      const promises = operations.map(op =>
        session.click(op.selector, { timeout: op.timeout }).then(result => ({
          ...op,
          result,
          completedAt: Date.now(),
        }))
      );

      const completedOps = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // All should fail due to missing elements
      completedOps.forEach(op => {
        expect(op.result.success).toBe(false);
        expect(op.result.duration).toBeGreaterThanOrEqual(op.timeout * 0.7);
        expect(op.result.duration).toBeLessThan(op.timeout * 1.4);
      });

      // Total duration should be close to the longest timeout
      const maxTimeout = Math.max(...operations.map(op => op.timeout));
      expect(totalDuration).toBeGreaterThanOrEqual(maxTimeout * 0.8);
      expect(totalDuration).toBeLessThan(maxTimeout * 1.5);

      // Faster operations should complete first (within timing variance)
      const sortedByTimeout = [...completedOps].sort((a, b) => a.timeout - b.timeout);
      const sortedByCompletion = [...completedOps].sort((a, b) => a.completedAt - b.completedAt);

      // Check that at least the fastest and slowest are in correct order
      expect(sortedByCompletion[0].timeout).toBeLessThanOrEqual(
        sortedByCompletion[sortedByCompletion.length - 1].timeout + 200 // Allow some variance
      );
    });

    it('should maintain browser responsiveness during concurrent timeouts', async () => {
      // Start multiple timeout operations
      const timeoutOps = [];
      for (let i = 0; i < 8; i++) {
        timeoutOps.push(
          session.waitForElement(`#concurrent-timeout-${i}`, { timeout: 800 })
        );
      }

      // While timeouts are running, perform quick successful operations
      await session.navigate('data:text/html,<button id="responsive-btn">Quick Button</button>');

      const quickOps = [];
      for (let i = 0; i < 5; i++) {
        quickOps.push(session.click('#responsive-btn'));
      }

      // Both timeout and successful operations should complete
      const [timeoutResults, quickResults] = await Promise.all([
        Promise.all(timeoutOps),
        Promise.all(quickOps)
      ]);

      // Timeout operations should fail
      timeoutResults.forEach(result => {
        expect(result.success).toBe(false);
      });

      // Quick operations should succeed
      quickResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.duration).toBeLessThan(1000);
      });
    });

    it('should handle timeout operations across different method types concurrently', async () => {
      const mixedOperations = [
        { name: 'click', op: () => session.click('#mixed1', { timeout: 600 }) },
        { name: 'type', op: () => session.type('#mixed2', 'test', { timeout: 650 }) },
        { name: 'hover', op: () => session.hover('#mixed3', { timeout: 700 }) },
        { name: 'focus', op: () => session.focus('#mixed4', { timeout: 750 }) },
        { name: 'waitElement', op: () => session.waitForElement('#mixed5', { timeout: 800 }) },
        { name: 'waitSelector', op: () => session.waitForSelector('#mixed6', { timeout: 850 }) },
        { name: 'waitFunction', op: () => session.waitForFunction(() => false, { timeout: 900 }) },
      ];

      const startTime = Date.now();
      const promises = mixedOperations.map(({ name, op }) =>
        op().then(result => ({ name, result, completedAt: Date.now() - startTime }))
      );

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // All operations should fail due to missing elements/false conditions
      results.forEach(({ name, result }) => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThan(0);
      });

      // Total duration should be close to the longest timeout
      expect(totalDuration).toBeGreaterThanOrEqual(800); // Close to longest timeout
      expect(totalDuration).toBeLessThan(1500);
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 2000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Memory test page</div>');
    });

    it('should not create memory leaks with repeated timeout operations', async () => {
      // Force garbage collection before measurement
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage();

      // Perform many timeout operations
      const operations = [];
      for (let batch = 0; batch < 5; batch++) {
        const batchOps = [];
        for (let i = 0; i < 10; i++) {
          batchOps.push(
            session.click(`#memory-test-${batch}-${i}`, { timeout: 200 })
          );
        }
        operations.push(...batchOps);

        // Wait for this batch to complete
        await Promise.all(batchOps);

        // Allow some time for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Force garbage collection after operations
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const externalGrowth = finalMemory.external - initialMemory.external;

      // Memory growth should be reasonable (less than 20MB heap, 5MB external)
      expect(heapGrowth).toBeLessThan(20 * 1024 * 1024);
      expect(externalGrowth).toBeLessThan(5 * 1024 * 1024);
    });

    it('should clean up resources after timeout errors', async () => {
      const resourceCountBefore = {
        handles: process._getActiveHandles().length,
        requests: process._getActiveRequests().length,
      };

      // Perform operations that will timeout
      const timeoutOps = [];
      for (let i = 0; i < 10; i++) {
        timeoutOps.push(
          session.waitForFunction(() => false, { timeout: 300 })
        );
      }

      await Promise.all(timeoutOps);

      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      const resourceCountAfter = {
        handles: process._getActiveHandles().length,
        requests: process._getActiveRequests().length,
      };

      // Resource counts should not grow significantly
      const handleGrowth = resourceCountAfter.handles - resourceCountBefore.handles;
      const requestGrowth = resourceCountAfter.requests - resourceCountBefore.requests;

      expect(handleGrowth).toBeLessThan(5);
      expect(requestGrowth).toBeLessThan(5);
    });

    it('should maintain stable performance over extended timeout operations', async () => {
      const rounds = 8;
      const opsPerRound = 5;
      const targetTimeout = 400;
      const tolerance = 0.3;

      const roundResults = [];

      for (let round = 0; round < rounds; round++) {
        const roundStart = Date.now();
        const roundOps = [];

        for (let i = 0; i < opsPerRound; i++) {
          roundOps.push(
            session.click(`#perf-round-${round}-${i}`, { timeout: targetTimeout })
          );
        }

        const results = await Promise.all(roundOps);
        const roundDuration = Date.now() - roundStart;

        roundResults.push({
          round,
          duration: roundDuration,
          avgOpDuration: roundDuration / opsPerRound,
          allFailed: results.every(r => !r.success),
        });
      }

      // All operations should have failed
      roundResults.forEach(result => {
        expect(result.allFailed).toBe(true);
      });

      // Performance should remain stable across rounds
      const avgDurations = roundResults.map(r => r.avgOpDuration);
      const overallAvg = avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length;

      // Each round's average should be within tolerance of overall average
      avgDurations.forEach(avgDuration => {
        const deviation = Math.abs(avgDuration - overallAvg) / overallAvg;
        expect(deviation).toBeLessThan(tolerance);
      });

      // Overall average should be close to target timeout
      expect(overallAvg).toBeGreaterThanOrEqual(targetTimeout * 0.7);
      expect(overallAvg).toBeLessThan(targetTimeout * 1.3);
    });
  });

  describe('Browser State Stability During Timeouts', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 3000,
      });
      await session.launch();
    });

    it('should maintain navigation capabilities after timeout operations', async () => {
      await session.navigate('data:text/html,<div>Initial page</div>');

      // Cause multiple timeout errors
      const timeoutOps = [
        session.click('#timeout1', { timeout: 300 }),
        session.waitForElement('#timeout2', { timeout: 300 }),
        session.type('#timeout3', 'text', { timeout: 300 }),
      ];

      await Promise.all(timeoutOps);

      // Navigation should still work
      const nav1 = await session.navigate('data:text/html,<h1>Page 1</h1>');
      expect(nav1.success).toBe(true);

      const nav2 = await session.navigate('data:text/html,<h1>Page 2</h1>');
      expect(nav2.success).toBe(true);

      const title = await session.getTitle();
      expect(title.success).toBe(true);
    });

    it('should handle timeout operations during page transitions', async () => {
      // Start with a page that has transitions
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div id="transitioning" style="opacity: 0; transition: opacity 2s;">
          Transitioning Element
        </div>
        <script>
          setTimeout(() => {
            document.getElementById('transitioning').style.opacity = '1';
          }, 1000);
        </script>
      `));

      // Perform operations with various timings during transition
      const operations = [
        session.click('#transitioning', { timeout: 500 }), // Should timeout before visible
        session.waitForElement('#transitioning', { timeout: 1500, state: 'visible' }), // Should succeed after transition
        session.click('#nonexistent', { timeout: 800 }), // Should timeout
      ];

      const results = await Promise.all(operations);

      expect(results[0].success).toBe(false); // First click times out
      expect(results[1].success).toBe(true);  // Wait succeeds after transition
      expect(results[2].success).toBe(false); // Nonexistent element times out

      // Browser should still be responsive
      const finalState = await session.getText('#transitioning');
      expect(finalState.success).toBe(true);
    });
  });

  describe('Edge Case Performance', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 5000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Edge case test</div>');
    });

    it('should handle extremely short timeout values efficiently', async () => {
      const shortTimeouts = [1, 5, 10, 25, 50];
      const results = [];

      for (const timeout of shortTimeouts) {
        const startTime = Date.now();
        const result = await session.click('#nonexistent', { timeout });
        const duration = Date.now() - startTime;

        results.push({ timeout, duration, success: result.success });
      }

      // All should fail
      results.forEach(({ success }) => {
        expect(success).toBe(false);
      });

      // Durations should be reasonable (not excessive)
      results.forEach(({ timeout, duration }) => {
        expect(duration).toBeLessThan(Math.max(500, timeout * 10));
      });
    });

    it('should handle timeout with very slow page responses', async () => {
      // Create a page that responds very slowly
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div>Slow page</div>
        <script>
          // Simulate slow processing
          let counter = 0;
          const slowInterval = setInterval(() => {
            counter++;
            // Add element after many iterations
            if (counter > 1000) {
              const div = document.createElement('div');
              div.id = 'very-slow-element';
              div.textContent = 'Finally loaded';
              document.body.appendChild(div);
              clearInterval(slowInterval);
            }
          }, 10);
        </script>
      `));

      // Try to interact with various timeouts
      const fastTimeout = await session.click('#very-slow-element', { timeout: 500 });
      expect(fastTimeout.success).toBe(false);

      const mediumTimeout = await session.click('#very-slow-element', { timeout: 2000 });
      expect(mediumTimeout.success).toBe(false);

      // Browser should remain responsive for other operations
      const quickOp = await session.getText('body');
      expect(quickOp.success).toBe(true);
    });
  });
});