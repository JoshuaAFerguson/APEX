/**
 * @file packages/browser/src/__tests__/timeout-stress-testing.test.ts
 *
 * Stress tests for timeout configurations under high load conditions
 *
 * Tests timeout behavior under:
 * - High concurrency scenarios
 * - Memory pressure conditions
 * - Rapid successive timeout operations
 * - Mixed success/failure patterns
 * - Extended duration testing
 * - Resource exhaustion scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserManager, createBrowserSession } from '../index.js';
import type {
  BrowserManager,
  BrowserSession,
  BrowserSessionConfig
} from '../types.js';

// Increase timeout for stress tests
const STRESS_TEST_TIMEOUT = 30000;

describe('Timeout Stress Testing', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
  }, STRESS_TEST_TIMEOUT);

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    await manager.shutdown();
  }, STRESS_TEST_TIMEOUT);

  describe('High Concurrency Stress Tests', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 3000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Concurrency stress test</div>');
    });

    it('should handle 50 concurrent timeout operations without degradation', async () => {
      const concurrentOps = 50;
      const operationTimeout = 400;

      const operations = Array.from({ length: concurrentOps }, (_, i) => ({
        id: i,
        operation: session.click(`#concurrent-stress-${i}`, { timeout: operationTimeout })
      }));

      const startTime = Date.now();
      const results = await Promise.all(operations.map(op =>
        op.operation.then(result => ({
          id: op.id,
          success: result.success,
          duration: result.duration,
          error: result.error
        }))
      ));
      const totalDuration = Date.now() - startTime;

      // All operations should fail due to missing elements
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
        expect(result.duration).toBeLessThan(operationTimeout * 1.6);
        expect(result.error).toBeDefined();
      });

      // Total time should be close to individual operation timeout (concurrent execution)
      expect(totalDuration).toBeGreaterThanOrEqual(operationTimeout * 0.7);
      expect(totalDuration).toBeLessThan(operationTimeout * 2); // Allow some overhead

      // Verify no significant performance degradation
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
      expect(avgDuration).toBeLessThan(operationTimeout * 1.4);
    }, STRESS_TEST_TIMEOUT);

    it('should maintain accuracy with mixed operation types under high load', async () => {
      const operationsPerType = 15;
      const operationTimeout = 350;

      const operationTypes = [
        (i: number) => session.click(`#mixed-click-${i}`, { timeout: operationTimeout }),
        (i: number) => session.type(`#mixed-type-${i}`, `text-${i}`, { timeout: operationTimeout }),
        (i: number) => session.hover(`#mixed-hover-${i}`, { timeout: operationTimeout }),
        (i: number) => session.focus(`#mixed-focus-${i}`, { timeout: operationTimeout }),
        (i: number) => session.waitForElement(`#mixed-wait-${i}`, { timeout: operationTimeout }),
      ];

      const allOperations = operationTypes.flatMap(opType =>
        Array.from({ length: operationsPerType }, (_, i) => opType(i))
      );

      const startTime = Date.now();
      const results = await Promise.all(allOperations);
      const totalDuration = Date.now() - startTime;

      // All operations should timeout
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThan(0);
      });

      // Performance should remain consistent
      const durations = results.map(r => r.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(avgDuration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
      expect(avgDuration).toBeLessThan(operationTimeout * 1.5);
    }, STRESS_TEST_TIMEOUT);

    it('should handle burst patterns of timeout operations', async () => {
      const burstSize = 20;
      const burstsCount = 5;
      const operationTimeout = 300;
      const burstInterval = 50; // Short interval between bursts

      const burstResults = [];

      for (let burst = 0; burst < burstsCount; burst++) {
        const burstOps = Array.from({ length: burstSize }, (_, i) =>
          session.click(`#burst-${burst}-${i}`, { timeout: operationTimeout })
        );

        const burstStart = Date.now();
        const results = await Promise.all(burstOps);
        const burstDuration = Date.now() - burstStart;

        burstResults.push({
          burst,
          results,
          duration: burstDuration,
          avgOpDuration: burstDuration / burstSize
        });

        // Short pause between bursts
        if (burst < burstsCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      // Validate each burst
      burstResults.forEach(({ burst, results, avgOpDuration }) => {
        // All operations should timeout
        results.forEach(result => {
          expect(result.success).toBe(false);
        });

        // Performance should be consistent across bursts
        expect(avgOpDuration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
        expect(avgOpDuration).toBeLessThan(operationTimeout * 1.6);
      });

      // Performance shouldn't degrade significantly across bursts
      const avgDurations = burstResults.map(b => b.avgOpDuration);
      const overallAvg = avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length;
      const maxDeviation = Math.max(...avgDurations.map(d => Math.abs(d - overallAvg)));

      expect(maxDeviation).toBeLessThan(overallAvg * 0.3); // Max 30% deviation
    }, STRESS_TEST_TIMEOUT);
  });

  describe('Memory Pressure Stress Tests', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 2000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Memory pressure test</div>');
    });

    it('should handle timeout operations under memory pressure', async () => {
      // Create memory pressure with large objects
      const memoryPressure = Array.from({ length: 1000 }, () =>
        new Array(1000).fill('memory-pressure-string')
      );

      const operationTimeout = 500;
      const operations = Array.from({ length: 30 }, (_, i) =>
        session.waitForElement(`#memory-pressure-${i}`, { timeout: operationTimeout })
      );

      const results = await Promise.all(operations);

      // All should timeout
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
        expect(result.duration).toBeLessThan(operationTimeout * 1.8);
      });

      // Clean up memory pressure
      memoryPressure.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }, STRESS_TEST_TIMEOUT);

    it('should maintain performance with repeated timeout cycles', async () => {
      const cycles = 10;
      const operationsPerCycle = 8;
      const operationTimeout = 300;

      const cycleResults = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const cycleOps = Array.from({ length: operationsPerCycle }, (_, i) =>
          session.click(`#cycle-${cycle}-${i}`, { timeout: operationTimeout })
        );

        const cycleStart = Date.now();
        const results = await Promise.all(cycleOps);
        const cycleDuration = Date.now() - cycleStart;

        cycleResults.push({
          cycle,
          duration: cycleDuration,
          avgOpDuration: cycleDuration / operationsPerCycle,
          allFailed: results.every(r => !r.success)
        });

        // Small pause between cycles
        await new Promise(resolve => setTimeout(resolve, 25));
      }

      // All cycles should have consistent performance
      const avgDurations = cycleResults.map(c => c.avgOpDuration);
      const overallAvg = avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length;

      cycleResults.forEach(({ cycle, avgOpDuration, allFailed }) => {
        expect(allFailed).toBe(true);
        expect(avgOpDuration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
        expect(avgOpDuration).toBeLessThan(operationTimeout * 1.5);

        // Deviation from average should be reasonable
        const deviation = Math.abs(avgOpDuration - overallAvg) / overallAvg;
        expect(deviation).toBeLessThan(0.4); // Max 40% deviation
      });
    }, STRESS_TEST_TIMEOUT);
  });

  describe('Extended Duration Stress Tests', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 2500,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Extended duration test</div>');
    });

    it('should maintain timeout accuracy over extended test duration', async () => {
      const testDurationMs = 15000; // 15 seconds
      const operationTimeout = 400;
      const operationInterval = 200;

      const startTime = Date.now();
      const results = [];

      while (Date.now() - startTime < testDurationMs) {
        const operationStart = Date.now();
        const result = await session.click(`#extended-${Date.now()}`, { timeout: operationTimeout });
        const operationDuration = Date.now() - operationStart;

        results.push({
          timestamp: Date.now() - startTime,
          success: result.success,
          duration: operationDuration,
          result
        });

        // Wait before next operation
        await new Promise(resolve => setTimeout(resolve, operationInterval));
      }

      // Validate results
      expect(results.length).toBeGreaterThan(5); // Should have multiple operations

      results.forEach(({ success, duration }) => {
        expect(success).toBe(false); // All should timeout
        expect(duration).toBeGreaterThanOrEqual(operationTimeout * 0.6);
        expect(duration).toBeLessThan(operationTimeout * 1.6);
      });

      // Check for consistency over time
      const firstHalf = results.slice(0, Math.floor(results.length / 2));
      const secondHalf = results.slice(Math.floor(results.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.duration, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.duration, 0) / secondHalf.length;

      // Performance should not degrade significantly over time
      const performanceDeviation = Math.abs(secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      expect(performanceDeviation).toBeLessThan(0.3); // Max 30% deviation
    }, STRESS_TEST_TIMEOUT);

    it('should handle mixed success and timeout patterns efficiently', async () => {
      await session.navigate('data:text/html,' + encodeURIComponent(`
        <div>
          <button id="success-btn-1">Success 1</button>
          <button id="success-btn-2">Success 2</button>
          <button id="success-btn-3">Success 3</button>
        </div>
      `));

      const mixedOperations = [
        // Successful operations (existing elements)
        () => session.click('#success-btn-1'),
        () => session.click('#success-btn-2'),
        () => session.click('#success-btn-3'),

        // Timeout operations (missing elements)
        () => session.click('#timeout-1', { timeout: 300 }),
        () => session.click('#timeout-2', { timeout: 350 }),
        () => session.waitForElement('#timeout-3', { timeout: 400 }),
      ];

      const iterations = 25;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        // Randomly select operation type
        const operation = mixedOperations[i % mixedOperations.length];
        const result = await operation();

        results.push({
          iteration: i,
          operation: i % mixedOperations.length,
          success: result.success,
          duration: result.duration
        });
      }

      // Validate success/failure patterns
      const successResults = results.filter(r => r.success);
      const timeoutResults = results.filter(r => !r.success);

      // Should have both successes and timeouts
      expect(successResults.length).toBeGreaterThan(0);
      expect(timeoutResults.length).toBeGreaterThan(0);

      // Successful operations should be fast
      successResults.forEach(result => {
        expect(result.duration).toBeLessThan(1000);
      });

      // Timeout operations should take expected time
      timeoutResults.forEach(result => {
        expect(result.duration).toBeGreaterThan(200);
        expect(result.duration).toBeLessThan(800);
      });
    }, STRESS_TEST_TIMEOUT);
  });

  describe('Resource Exhaustion Resistance', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 1500,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Resource exhaustion test</div>');
    });

    it('should handle timeout operations when approaching resource limits', async () => {
      const operationTimeout = 250;
      const highConcurrency = 40;

      // Create high concurrency load
      const promises = Array.from({ length: highConcurrency }, (_, i) => {
        const operations = [
          session.click(`#resource-click-${i}`, { timeout: operationTimeout }),
          session.waitForElement(`#resource-wait-${i}`, { timeout: operationTimeout }),
          session.type(`#resource-type-${i}`, `text-${i}`, { timeout: operationTimeout })
        ];
        return Promise.all(operations);
      });

      const startTime = Date.now();
      const allResults = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // Flatten results
      const results = allResults.flat();

      // All operations should timeout
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.duration).toBeLessThan(operationTimeout * 2);
      });

      // Overall performance should still be reasonable
      expect(totalDuration).toBeGreaterThanOrEqual(operationTimeout * 0.7);
      expect(totalDuration).toBeLessThan(operationTimeout * 2.5);
    }, STRESS_TEST_TIMEOUT);

    it('should recover gracefully after high-stress timeout scenarios', async () => {
      // Phase 1: High stress
      const stressOps = Array.from({ length: 25 }, (_, i) =>
        session.click(`#stress-recovery-${i}`, { timeout: 200 })
      );

      await Promise.all(stressOps);

      // Phase 2: Recovery validation
      await session.navigate('data:text/html,<button id="recovery-btn">Recovery Test</button>');

      // Should still work normally
      const recoveryResult = await session.click('#recovery-btn');
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.duration).toBeLessThan(1000);

      // Additional recovery operations
      const additionalOps = [
        session.getText('#recovery-btn'),
        session.getTitle(),
        session.navigate('data:text/html,<div>Final recovery</div>')
      ];

      const recoveryResults = await Promise.all(additionalOps);
      recoveryResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    }, STRESS_TEST_TIMEOUT);
  });

  describe('Edge Case Stress Scenarios', () => {
    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        timeout: 2000,
      });
      await session.launch();
      await session.navigate('data:text/html,<div>Edge case stress test</div>');
    });

    it('should handle extremely short timeouts under stress', async () => {
      const shortTimeouts = [1, 5, 10, 25, 50];
      const operationsPerTimeout = 8;

      const allPromises = shortTimeouts.flatMap(timeout =>
        Array.from({ length: operationsPerTimeout }, (_, i) =>
          session.click(`#short-stress-${timeout}-${i}`, { timeout })
        )
      );

      const results = await Promise.all(allPromises);

      // All should fail
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.duration).toBeLessThan(1000); // Should fail quickly
      });

      // Group by timeout value and validate
      const resultsByTimeout = shortTimeouts.map(timeout => ({
        timeout,
        results: results.filter((_, index) => {
          const timeoutIndex = Math.floor(index / operationsPerTimeout);
          return shortTimeouts[timeoutIndex] === timeout;
        })
      }));

      resultsByTimeout.forEach(({ timeout, results: timeoutResults }) => {
        const avgDuration = timeoutResults.reduce((sum, r) => sum + r.duration, 0) / timeoutResults.length;
        // Very short timeouts should complete very quickly
        expect(avgDuration).toBeLessThan(Math.max(200, timeout * 20));
      });
    }, STRESS_TEST_TIMEOUT);

    it('should maintain session stability under timeout stress', async () => {
      // Heavy timeout load
      const heavyLoad = Array.from({ length: 100 }, (_, i) =>
        session.waitForElement(`#stability-${i}`, { timeout: 150 })
      );

      await Promise.all(heavyLoad);

      // Verify session is still stable
      const stabilityTests = [
        () => session.navigate('data:text/html,<h1>Stability Test</h1>'),
        () => session.getTitle(),
        () => session.navigate('data:text/html,<button id="stable-btn">Stable</button>'),
        () => session.click('#stable-btn'),
      ];

      for (const test of stabilityTests) {
        const result = await test();
        expect(result.success).toBe(true);
      }

      // Additional stress after stability verification
      const postStabilityOps = Array.from({ length: 20 }, (_, i) =>
        session.hover(`#post-stability-${i}`, { timeout: 200 })
      );

      const postResults = await Promise.all(postStabilityOps);
      postResults.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.duration).toBeGreaterThan(0);
      });
    }, STRESS_TEST_TIMEOUT);
  });
});