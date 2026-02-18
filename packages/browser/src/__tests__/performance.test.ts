/**
 * @apexcli/browser - Performance Tests
 *
 * Tests for performance characteristics, benchmarks, and load scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  launchBrowser,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Browser Automation - Performance Tests', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = createBrowserManager({
      maxInstances: 10, // Higher limit for performance tests
      reuseInstances: true,
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Launch Performance', () => {
    it('should launch browser within acceptable time limits', async () => {
      const startTime = Date.now();

      const session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });

      const result = await session.launch();
      const launchTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(launchTime).toBeLessThan(10000); // Should launch within 10 seconds

      await session.close();
    });

    it('should demonstrate launch time consistency across multiple attempts', async () => {
      const launchTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();

        const result = await launchBrowser({
          browserType: 'chromium',
          headless: true,
        });

        const launchTime = Date.now() - startTime;
        launchTimes.push(launchTime);

        expect(result.success).toBe(true);

        if (result.data) {
          await result.data.close();
        }
      }

      // Calculate statistics
      const avgTime = launchTimes.reduce((a, b) => a + b, 0) / launchTimes.length;
      const maxTime = Math.max(...launchTimes);
      const minTime = Math.min(...launchTimes);

      expect(avgTime).toBeLessThan(8000); // Average should be reasonable
      expect(maxTime).toBeLessThan(15000); // Max should not be excessive
      expect(minTime).toBeGreaterThan(100); // Min should be realistic

      // Variance should not be too high (consistency check)
      const variance = launchTimes.reduce((acc, time) =>
        acc + Math.pow(time - avgTime, 2), 0) / launchTimes.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeLessThan(avgTime * 0.5); // Standard deviation < 50% of average
    });

    it('should benefit from instance reuse', async () => {
      const reuseManager = createBrowserManager({ reuseInstances: true });

      try {
        // First launch (cold start)
        const startTime1 = Date.now();
        const session1 = createBrowserSession(reuseManager);
        await session1.launch();
        const firstLaunchTime = Date.now() - startTime1;
        await session1.close();

        // Second launch (should reuse instance)
        const startTime2 = Date.now();
        const session2 = createBrowserSession(reuseManager);
        await session2.launch();
        const secondLaunchTime = Date.now() - startTime2;
        await session2.close();

        // Reused launch should be faster (or at least not significantly slower)
        expect(secondLaunchTime).toBeLessThanOrEqual(firstLaunchTime * 1.5);

      } finally {
        await reuseManager.shutdown();
      }
    });
  });

  describe('Operation Performance', () => {
    let session: BrowserSession;

    beforeEach(async () => {
      session = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
      });
      await session.launch();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it('should perform navigation operations efficiently', async () => {
      const testUrls = [
        'data:text/html,<h1>Page 1</h1>',
        'data:text/html,<h1>Page 2</h1>',
        'data:text/html,<h1>Page 3</h1>',
        'data:text/html,<h1>Page 4</h1>',
        'data:text/html,<h1>Page 5</h1>',
      ];

      const navTimes: number[] = [];

      for (const url of testUrls) {
        const startTime = Date.now();
        const result = await session.navigate(url);
        const navTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        navTimes.push(navTime);
      }

      const avgNavTime = navTimes.reduce((a, b) => a + b, 0) / navTimes.length;
      expect(avgNavTime).toBeLessThan(2000); // Average navigation < 2 seconds

      // Each individual navigation should be reasonable
      navTimes.forEach(time => expect(time).toBeLessThan(5000));
    });

    it('should perform DOM interactions efficiently', async () => {
      const complexPage = `
        data:text/html,
        <html>
          <body>
            ${Array.from({ length: 100 }, (_, i) =>
              `<div id="item${i}">
                 <input id="input${i}" type="text" />
                 <button id="btn${i}" onclick="this.textContent='Clicked ${i}'">Button ${i}</button>
               </div>`
            ).join('')}
          </body>
        </html>
      `;

      await session.navigate(complexPage);

      // Perform multiple interactions
      const interactions = [];
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        interactions.push(
          session.type(`#input${i}`, `Test text ${i}`).then(result => {
            expect(result.success).toBe(true);
            return session.click(`#btn${i}`);
          }).then(result => {
            expect(result.success).toBe(true);
            return session.getText(`#btn${i}`);
          })
        );
      }

      await Promise.all(interactions);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(10000); // 10 interactions in < 10 seconds
    });

    it('should take screenshots efficiently', async () => {
      await session.navigate('data:text/html,<h1 style="padding: 100px;">Screenshot Test</h1>');

      const screenshotTimes: number[] = [];

      // Take multiple screenshots to test consistency
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const result = await session.screenshot();
        const screenshotTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        screenshotTimes.push(screenshotTime);
      }

      const avgTime = screenshotTimes.reduce((a, b) => a + b, 0) / screenshotTimes.length;
      expect(avgTime).toBeLessThan(3000); // Average screenshot < 3 seconds

      // Individual screenshots should be reasonable
      screenshotTimes.forEach(time => expect(time).toBeLessThan(5000));
    });

    it('should handle rapid sequential operations', async () => {
      await session.navigate('data:text/html,<div id="test">Test Content</div>');

      const operationCount = 50;
      const startTime = Date.now();

      const operations = Array.from({ length: operationCount }, (_, i) =>
        session.getText('#test').then(result => {
          expect(result.success).toBe(true);
          return result;
        })
      );

      const results = await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(operationCount);
      results.forEach(result => expect(result.success).toBe(true));

      // Should handle 50 operations in reasonable time
      expect(totalTime).toBeLessThan(15000);

      const avgTimePerOp = totalTime / operationCount;
      expect(avgTimePerOp).toBeLessThan(500); // < 500ms per operation on average
    });
  });

  describe('Concurrent Session Performance', () => {
    it('should handle multiple concurrent sessions efficiently', async () => {
      const sessionCount = 3;
      const sessions: BrowserSession[] = [];

      try {
        const startTime = Date.now();

        // Launch sessions concurrently
        const launchPromises = Array.from({ length: sessionCount }, () => {
          const session = createBrowserSession(manager, {
            browserType: 'chromium',
            headless: true,
          });
          sessions.push(session);
          return session.launch();
        });

        const launchResults = await Promise.all(launchPromises);
        const launchTime = Date.now() - startTime;

        // All should succeed
        launchResults.forEach(result => expect(result.success).toBe(true));

        // Concurrent launch should be more efficient than sequential
        expect(launchTime).toBeLessThan(sessionCount * 8000); // Should be better than sequential

        // Perform operations on all sessions concurrently
        const operationStartTime = Date.now();

        const operationPromises = sessions.map(async (session, index) => {
          await session.navigate(`data:text/html,<h1>Session ${index}</h1>`);
          const screenshot = await session.screenshot();
          expect(screenshot.success).toBe(true);
          const text = await session.getText('h1');
          expect(text.success).toBe(true);
          expect(text.data).toBe(`Session ${index}`);
        });

        await Promise.all(operationPromises);
        const operationTime = Date.now() - operationStartTime;

        expect(operationTime).toBeLessThan(10000); // Concurrent operations < 10 seconds

      } finally {
        await Promise.all(sessions.map(session => session.close()));
      }
    });

    it('should maintain resource efficiency under load', async () => {
      const sessionCount = 5;
      const sessions: BrowserSession[] = [];

      try {
        // Launch sessions and track resource usage
        for (let i = 0; i < sessionCount; i++) {
          const session = createBrowserSession(manager);
          await session.launch();
          sessions.push(session);

          const usage = await manager.getResourceUsage();
          expect(usage.totalInstances).toBeGreaterThan(0);
          expect(usage.totalContexts).toBe(i + 1);
          expect(usage.memoryUsageMB).toBeGreaterThan(0);

          // Memory usage should grow reasonably
          expect(usage.memoryUsageMB).toBeLessThan((i + 1) * 500); // < 500MB per session
        }

        // Perform work on all sessions
        const workPromises = sessions.map(async (session, index) => {
          const complexPage = `
            data:text/html,
            <h1>Session ${index}</h1>
            <div style="height: 2000px; background: linear-gradient(red, blue);"></div>
          `;

          await session.navigate(complexPage);
          await session.screenshot({ fullPage: true });
          await session.scroll({ y: 1000 });
          await session.getText('h1');
        });

        await Promise.all(workPromises);

        // Check final resource usage
        const finalUsage = await manager.getResourceUsage();
        expect(finalUsage.totalContexts).toBe(sessionCount);
        expect(finalUsage.memoryUsageMB).toBeLessThan(sessionCount * 600); // Reasonable memory limit

      } finally {
        await Promise.all(sessions.map(session => session.close()));
      }
    });

    it('should demonstrate cleanup efficiency', async () => {
      const initialUsage = await manager.getResourceUsage();
      const sessionCount = 3;

      // Create and use sessions
      for (let i = 0; i < sessionCount; i++) {
        const session = createBrowserSession(manager);
        await session.launch();
        await session.navigate('data:text/html,<h1>Cleanup Test</h1>');
        await session.screenshot();
        await session.close();
      }

      // Check resource cleanup
      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(initialUsage.totalContexts);

      // Memory should not have accumulated significantly
      const memoryIncrease = finalUsage.memoryUsageMB - initialUsage.memoryUsageMB;
      expect(memoryIncrease).toBeLessThan(200); // < 200MB net increase after cleanup
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst session creation and destruction', async () => {
      const burstSize = 5;
      const burstCount = 3;

      for (let burst = 0; burst < burstCount; burst++) {
        const startTime = Date.now();

        // Create burst of sessions
        const sessions = Array.from({ length: burstSize }, () =>
          createBrowserSession(manager, { browserType: 'chromium', headless: true })
        );

        // Launch all sessions in burst
        const launchPromises = sessions.map(session => session.launch());
        const launchResults = await Promise.all(launchPromises);

        // All should succeed
        launchResults.forEach(result => expect(result.success).toBe(true);

        // Quick operations
        const workPromises = sessions.map(session =>
          session.navigate('data:text/html,<h1>Burst Test</h1>')
        );
        await Promise.all(workPromises);

        // Close all sessions
        const closePromises = sessions.map(session => session.close());
        await Promise.all(closePromises);

        const burstTime = Date.now() - startTime;
        expect(burstTime).toBeLessThan(20000); // Each burst < 20 seconds
      }

      // System should be stable after bursts
      const finalUsage = await manager.getResourceUsage();
      expect(finalUsage.totalContexts).toBe(0);
    });

    it('should maintain stability under sustained load', async () => {
      const duration = 10000; // 10 seconds of sustained load
      const startTime = Date.now();
      let operationCount = 0;
      let errorCount = 0;

      const workers = Array.from({ length: 3 }, async () => {
        while (Date.now() - startTime < duration) {
          try {
            const session = createBrowserSession(manager);
            await session.launch();
            await session.navigate('data:text/html,<h1>Load Test</h1>');
            await session.getText('h1');
            await session.close();
            operationCount++;
          } catch (error) {
            errorCount++;
          }
        }
      });

      await Promise.all(workers);

      // Should complete significant work with low error rate
      expect(operationCount).toBeGreaterThan(5); // At least some work done
      expect(errorCount / (operationCount + errorCount)).toBeLessThan(0.1); // < 10% error rate

      // System should be stable after load test
      const usage = await manager.getResourceUsage();
      expect(usage.totalContexts).toBe(0);
    }, 15000);
  });

  describe('Memory and Resource Performance', () => {
    it('should demonstrate efficient memory usage patterns', async () => {
      const measurements: Array<{
        operation: string;
        memoryMB: number;
        contexts: number;
      }> = [];

      // Baseline measurement
      let usage = await manager.getResourceUsage();
      measurements.push({
        operation: 'baseline',
        memoryMB: usage.memoryUsageMB,
        contexts: usage.totalContexts
      });

      // Launch session
      const session = createBrowserSession(manager);
      await session.launch();

      usage = await manager.getResourceUsage();
      measurements.push({
        operation: 'session_launched',
        memoryMB: usage.memoryUsageMB,
        contexts: usage.totalContexts
      });

      // Navigate to complex page
      const complexPage = `
        data:text/html,
        <html>
          <body>
            <div style="height: 5000px; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>') repeat;"></div>
            ${Array.from({ length: 1000 }, (_, i) => `<div>Item ${i}</div>`).join('')}
          </body>
        </html>
      `;

      await session.navigate(complexPage);

      usage = await manager.getResourceUsage();
      measurements.push({
        operation: 'complex_page_loaded',
        memoryMB: usage.memoryUsageMB,
        contexts: usage.totalContexts
      });

      // Take screenshots
      await session.screenshot({ fullPage: true });

      usage = await manager.getResourceUsage();
      measurements.push({
        operation: 'screenshot_taken',
        memoryMB: usage.memoryUsageMB,
        contexts: usage.totalContexts
      });

      // Close session
      await session.close();

      usage = await manager.getResourceUsage();
      measurements.push({
        operation: 'session_closed',
        memoryMB: usage.memoryUsageMB,
        contexts: usage.totalContexts
      });

      // Analyze memory usage patterns
      const maxMemory = Math.max(...measurements.map(m => m.memoryMB));
      const finalMemory = measurements[measurements.length - 1].memoryMB;
      const baselineMemory = measurements[0].memoryMB;

      // Memory should not grow excessively
      expect(maxMemory).toBeLessThan(1000); // < 1GB peak

      // Memory should be cleaned up after session close
      expect(finalMemory - baselineMemory).toBeLessThan(100); // < 100MB net increase

      // Contexts should be properly cleaned up
      expect(measurements[measurements.length - 1].contexts).toBe(0);
    });

    it('should handle instance reuse efficiently', async () => {
      const reuseManager = createBrowserManager({
        reuseInstances: true,
        maxInstances: 2
      });

      try {
        const usageMeasurements: number[] = [];

        // Create multiple sessions that should reuse instances
        for (let i = 0; i < 5; i++) {
          const session = createBrowserSession(reuseManager);
          await session.launch();
          await session.navigate(`data:text/html,<h1>Reuse Test ${i}</h1>`);

          const usage = await reuseManager.getResourceUsage();
          usageMeasurements.push(usage.totalInstances);

          await session.close();
        }

        // Should not create unlimited instances
        const maxInstances = Math.max(...usageMeasurements);
        expect(maxInstances).toBeLessThanOrEqual(2); // Respect max limit

        // Should demonstrate reuse (not creating new instance each time)
        const instanceCounts = [...new Set(usageMeasurements)];
        expect(instanceCounts.length).toBeLessThan(5); // Should reuse instances

      } finally {
        await reuseManager.shutdown();
      }
    });
  });
});