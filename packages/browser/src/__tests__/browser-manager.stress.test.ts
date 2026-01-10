/**
 * @apexcli/browser - Browser Manager Stress Tests
 *
 * Performance and load testing for browser manager under stress
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';

describe('BrowserManager Stress Tests', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager({
      maxInstances: 10, // Allow more instances for stress testing
      instanceIdleTimeout: 5000,
      resourceLimits: {
        maxMemoryMB: 2048 // Higher limit for stress tests
      }
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Load Testing', () => {
    it('should handle maximum concurrent instances', async () => {
      const maxInstances = 5; // Reasonable limit for CI
      const launchPromises: Promise<any>[] = [];

      // Launch maximum instances concurrently
      for (let i = 0; i < maxInstances; i++) {
        launchPromises.push(
          manager.launchBrowser({
            browserType: i % 2 === 0 ? 'chromium' : 'firefox'
          })
        );
      }

      const results = await Promise.all(launchPromises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getInstances()).toHaveLength(maxInstances);

      // Verify resource tracking under load
      const usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(maxInstances);
      expect(usage.memoryUsageMB).toBeGreaterThan(0);
    }, 60000);

    it('should handle context creation under load', async () => {
      // Launch multiple browsers
      const browsers = await Promise.all([
        manager.launchBrowser({ browserType: 'chromium' }),
        manager.launchBrowser({ browserType: 'firefox' })
      ]);

      const contextsPerBrowser = 5;
      const contextPromises: Promise<any>[] = [];

      // Create multiple contexts per browser
      browsers.forEach(browserResult => {
        if (browserResult.success) {
          for (let i = 0; i < contextsPerBrowser; i++) {
            contextPromises.push(
              manager.createContext(browserResult.data!.id, {
                viewport: { width: 1280 + i * 100, height: 720 + i * 50 }
              })
            );
          }
        }
      });

      const contextResults = await Promise.all(contextPromises);

      contextResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getContexts()).toHaveLength(browsers.length * contextsPerBrowser);
    }, 45000);

    it('should maintain performance under rapid operations', async () => {
      const operations = 20;
      const timings: number[] = [];

      for (let i = 0; i < operations; i++) {
        const startTime = Date.now();

        const launchResult = await manager.launchBrowser({ browserType: 'chromium' });
        expect(launchResult.success).toBe(true);

        const contextResult = await manager.createContext(launchResult.data!.id);
        expect(contextResult.success).toBe(true);

        await manager.closeContext(contextResult.data!.id);
        await manager.closeBrowser(launchResult.data!.id);

        const duration = Date.now() - startTime;
        timings.push(duration);

        // Each operation should complete within reasonable time
        expect(duration).toBeLessThan(10000); // 10 seconds
      }

      // Performance should not degrade significantly over time
      const avgFirst5 = timings.slice(0, 5).reduce((a, b) => a + b) / 5;
      const avgLast5 = timings.slice(-5).reduce((a, b) => a + b) / 5;

      // Last operations should not be more than 3x slower than first
      expect(avgLast5).toBeLessThan(avgFirst5 * 3);
    }, 120000);
  });

  describe('Memory Pressure Testing', () => {
    it('should handle cleanup under memory pressure', async () => {
      const iterations = 10;
      let peakInstances = 0;

      for (let i = 0; i < iterations; i++) {
        // Create instance with context
        const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
        const contextResult = await manager.createContext(instanceResult.data!.id);

        peakInstances = Math.max(peakInstances, manager.getInstances().length);

        // Occasionally cleanup (simulate varying usage patterns)
        if (i % 3 === 0) {
          await manager.closeContext(contextResult.data!.id);
          await manager.closeBrowser(instanceResult.data!.id);
        }
      }

      expect(peakInstances).toBeGreaterThan(0);

      // Force cleanup of remaining instances
      const cleanupCount = await manager.cleanupIdleInstances();
      expect(cleanupCount).toBeGreaterThanOrEqual(0);

      // Final cleanup
      await manager.shutdown();
      expect(manager.getInstances()).toHaveLength(0);
    }, 60000);

    it('should handle resource monitoring under load', async () => {
      const instances: string[] = [];

      try {
        // Create multiple instances and contexts
        for (let i = 0; i < 5; i++) {
          const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
          const contextResult = await manager.createContext(instanceResult.data!.id);

          instances.push(instanceResult.data!.id);

          // Check resource usage periodically
          const usage = await manager.getResourceUsage();
          expect(usage.totalInstances).toBe(i + 1);
          expect(usage.totalContexts).toBe(i + 1);
        }

        // Resource usage should be accurately tracked
        const finalUsage = await manager.getResourceUsage();
        expect(finalUsage.totalInstances).toBe(5);
        expect(finalUsage.activeBrowsers).toBe(5);

      } finally {
        // Clean up instances
        for (const instanceId of instances) {
          try {
            await manager.closeBrowser(instanceId);
          } catch (error) {
            // Ignore cleanup errors in stress test
          }
        }
      }
    }, 45000);
  });

  describe('Error Recovery Under Stress', () => {
    it('should recover from multiple browser crashes', async () => {
      const instanceIds: string[] = [];

      // Launch multiple instances
      for (let i = 0; i < 3; i++) {
        const result = await manager.launchBrowser({ browserType: 'chromium' });
        expect(result.success).toBe(true);
        instanceIds.push(result.data!.id);
      }

      // Force crash some browsers
      for (let i = 0; i < 2; i++) {
        const browser = manager.getInstance(instanceIds[i]);
        if (browser) {
          await browser.close();
        }
      }

      // Manager should still be operational
      const newResult = await manager.launchBrowser({ browserType: 'firefox' });
      expect(newResult.success).toBe(true);

      // Cleanup should handle crashed and working instances
      await manager.shutdown();
    });

    it('should handle concurrent shutdown scenarios', async () => {
      // Launch multiple instances
      const launchPromises = Array.from({ length: 5 }, () =>
        manager.launchBrowser({ browserType: 'chromium' })
      );

      const results = await Promise.all(launchPromises);
      results.forEach(result => expect(result.success).toBe(true));

      // Trigger multiple shutdowns concurrently (should be handled gracefully)
      const shutdownPromises = [
        manager.shutdown(),
        manager.shutdown(),
        manager.shutdown()
      ];

      // Should not throw errors
      await Promise.allSettled(shutdownPromises);

      expect(manager.getInstances()).toHaveLength(0);
    });
  });

  describe('Configuration Stress Testing', () => {
    it('should handle extreme configuration values', async () => {
      const extremeManager = new BrowserManager({
        maxInstances: 1000, // Very high
        instanceIdleTimeout: 1, // Very low
        reuseInstances: true,
        resourceLimits: {
          maxMemoryMB: 10000 // Very high
        }
      });

      try {
        // Should handle extreme config gracefully
        const result = await extremeManager.launchBrowser({ browserType: 'chromium' });
        expect(result.success).toBe(true);

        // Cleanup should work with extreme timeout
        await new Promise(resolve => setTimeout(resolve, 10)); // Wait longer than idle timeout
        const cleanedCount = await extremeManager.cleanupIdleInstances();
        expect(cleanedCount).toBeGreaterThanOrEqual(0);

      } finally {
        await extremeManager.shutdown();
      }
    });

    it('should handle rapid configuration changes', async () => {
      // Multiple managers with different configs
      const managers = [
        new BrowserManager({ maxInstances: 1 }),
        new BrowserManager({ reuseInstances: false }),
        new BrowserManager({ instanceIdleTimeout: 1000 })
      ];

      try {
        // Launch browsers with different managers
        const promises = managers.map(mgr =>
          mgr.launchBrowser({ browserType: 'chromium' })
        );

        const results = await Promise.all(promises);
        results.forEach(result => expect(result.success).toBe(true));

      } finally {
        // Clean up all managers
        await Promise.all(managers.map(mgr => mgr.shutdown()));
      }
    });
  });

  describe('Long-Running Stability', () => {
    it('should maintain stability over extended operations', async () => {
      const duration = 30000; // 30 seconds
      const startTime = Date.now();
      let operationCount = 0;
      const errors: any[] = [];

      while (Date.now() - startTime < duration) {
        try {
          const result = await manager.launchBrowser({ browserType: 'chromium' });
          if (result.success) {
            await manager.closeBrowser(result.data!.id);
          }
          operationCount++;

          // Prevent too rapid execution in CI
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          errors.push(error);
        }
      }

      expect(operationCount).toBeGreaterThan(0);
      expect(errors.length).toBe(0); // No errors should occur

      // Manager should still be responsive
      const usage = await manager.getResourceUsage();
      expect(usage).toBeDefined();
    }, 45000);
  });
});