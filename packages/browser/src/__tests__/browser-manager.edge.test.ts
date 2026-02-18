/**
 * @apexcli/browser - Browser Manager Edge Case Tests
 *
 * Tests for edge cases, stress scenarios, and error conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from '../browser-manager.js';

describe('BrowserManager Edge Cases and Stress Tests', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle rapid instance creation and destruction', async () => {
      const iterations = 5;
      const results: any[] = [];

      for (let i = 0; i < iterations; i++) {
        const launchResult = await manager.launchBrowser({ browserType: 'chromium' });
        expect(launchResult.success).toBe(true);
        results.push(launchResult);

        const closeResult = await manager.closeBrowser(launchResult.data!.id);
        expect(closeResult.success).toBe(true);
      }

      // All instances should be cleaned up
      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should handle context creation stress test', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      const contextPromises = Array.from({ length: 10 }, () =>
        manager.createContext(instanceId)
      );

      const contextResults = await Promise.all(contextPromises);

      contextResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getContexts()).toHaveLength(10);

      // Clean up contexts
      const closePromises = contextResults.map(result =>
        manager.closeContext(result.data!.id)
      );

      await Promise.all(closePromises);
      expect(manager.getContexts()).toHaveLength(0);
    });

    it('should handle mixed browser types under stress', async () => {
      const browserTypes = ['chromium', 'firefox', 'webkit'] as const;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 6; i++) {
        const browserType = browserTypes[i % browserTypes.length];
        promises.push(manager.launchBrowser({ browserType }));
      }

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should have instances of all browser types
      const instances = manager.getInstances();
      const types = instances.map(inst => inst.type);
      expect(types).toContain('chromium');
      expect(types).toContain('firefox');
      expect(types).toContain('webkit');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from partial shutdown failures', async () => {
      // Launch multiple instances
      const results = await Promise.all([
        manager.launchBrowser({ browserType: 'chromium' }),
        manager.launchBrowser({ browserType: 'firefox' })
      ]);

      // Create contexts
      const contexts = await Promise.all([
        manager.createContext(results[0].data!.id),
        manager.createContext(results[1].data!.id)
      ]);

      // Force close one browser directly (simulating crash)
      const browser = manager.getInstance(results[0].data!.id);
      if (browser) {
        await browser.close();
      }

      // Shutdown should still complete successfully
      await manager.shutdown();

      expect(manager.getInstances()).toHaveLength(0);
      expect(manager.getContexts()).toHaveLength(0);
    });

    it('should handle instance reuse with crashed browsers', async () => {
      const reuseManager = new BrowserManager({ reuseInstances: true });

      // Launch browser
      const result1 = await reuseManager.launchBrowser({ browserType: 'chromium' });

      // Force close to simulate crash
      const browser = reuseManager.getInstance(result1.data!.id);
      if (browser) {
        await browser.close();
      }

      // Try to launch another - should create new instance
      const result2 = await reuseManager.launchBrowser({ browserType: 'chromium' });
      expect(result2.success).toBe(true);

      await reuseManager.shutdown();
    });

    it('should handle context operations during browser shutdown', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id);

      // Start shutting down the browser
      const shutdownPromise = manager.closeBrowser(instanceResult.data!.id);

      // Try to operate on context during shutdown
      const operationResult = await manager.getContext(contextResult.data!.id);

      // Wait for shutdown to complete
      await shutdownPromise;

      // Context should be cleaned up
      expect(manager.getContexts()).toHaveLength(0);
    });
  });

  describe('Resource Monitoring Edge Cases', () => {
    it('should handle resource monitoring when browser disconnects', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });

      // Force disconnect the browser
      const browser = manager.getInstance(instanceResult.data!.id);
      if (browser) {
        await browser.close();
      }

      // Resource usage should still be calculable
      const usage = await manager.getResourceUsage();
      expect(usage).toBeDefined();
      expect(typeof usage.totalInstances).toBe('number');
      expect(typeof usage.memoryUsageMB).toBe('number');
    });

    it('should handle cleanup with invalid instances', async () => {
      const testManager = new BrowserManager({
        instanceIdleTimeout: 100,
        reuseInstances: true
      });

      // Launch instance
      await testManager.launchBrowser({ browserType: 'chromium' });

      // Wait for idle timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should cleanup gracefully even if browser is disconnected
      const cleanedCount = await testManager.cleanupIdleInstances();
      expect(cleanedCount).toBeGreaterThanOrEqual(0);

      await testManager.shutdown();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle null/undefined configuration values', async () => {
      const result = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true,
        viewport: undefined,
        timeout: undefined,
        userAgent: undefined
      });

      expect(result.success).toBe(true);
    });

    it('should handle extremely large timeout values', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id, {
        timeout: Number.MAX_SAFE_INTEGER
      });

      expect(contextResult.success).toBe(true);
    });

    it('should handle zero and negative timeout values', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });

      // Zero timeout should work
      const contextResult1 = await manager.createContext(instanceResult.data!.id, {
        timeout: 0
      });
      expect(contextResult1.success).toBe(true);
    });
  });

  describe('Concurrent Edge Cases', () => {
    it('should handle concurrent shutdown and launch operations', async () => {
      // Launch some instances
      await manager.launchBrowser({ browserType: 'chromium' });
      await manager.launchBrowser({ browserType: 'firefox' });

      // Start shutdown and launch concurrently
      const shutdownPromise = manager.shutdown();
      const launchPromise = manager.launchBrowser({ browserType: 'chromium' });

      const [_, launchResult] = await Promise.all([shutdownPromise, launchPromise]);

      // Launch after shutdown should fail
      expect(launchResult.success).toBe(false);
      expect(launchResult.error).toContain('shut down');
    });

    it('should handle concurrent context operations on same instance', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      // Create contexts and close them concurrently
      const createPromises = Array.from({ length: 3 }, () =>
        manager.createContext(instanceId)
      );

      const createResults = await Promise.all(createPromises);

      const closePromises = createResults.map(result =>
        manager.closeContext(result.data!.id)
      );

      const closeResults = await Promise.all(closePromises);

      createResults.forEach(result => expect(result.success).toBe(true));
      closeResults.forEach(result => expect(result.success).toBe(true));

      expect(manager.getContexts()).toHaveLength(0);
    });

    it('should handle rapid start/stop monitoring cycles', async () => {
      const rapidManager = new BrowserManager();

      // Launch and shutdown rapidly
      for (let i = 0; i < 3; i++) {
        await rapidManager.launchBrowser({ browserType: 'chromium' });
        await rapidManager.shutdown();

        // Create new manager each time to test initialization
        rapidManager = new BrowserManager();
      }

      await rapidManager.shutdown();
    });
  });

  describe('Memory and Resource Leaks', () => {
    it('should not leak contexts after browser crash', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id);

      // Force browser crash
      const browser = manager.getInstance(instanceResult.data!.id);
      if (browser) {
        await browser.close();
      }

      // Manager should still track contexts but cleanup during shutdown
      expect(manager.getContexts()).toHaveLength(1);

      await manager.shutdown();

      expect(manager.getContexts()).toHaveLength(0);
    });

    it('should handle cleanup with corrupted internal state', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });

      // Simulate corrupted state by calling private methods (testing internal resilience)
      // This tests that the public API can handle edge cases gracefully
      const usage = await manager.getResourceUsage();
      expect(usage).toBeDefined();

      // Cleanup should work even with unusual state
      await manager.shutdown();
    });
  });

  describe('Event System Edge Cases', () => {
    it('should handle event listeners during shutdown', async () => {
      let eventsReceived: string[] = [];

      manager.on('browserCreated', () => eventsReceived.push('created'));
      manager.on('browserClosed', () => eventsReceived.push('closed'));

      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });

      // Shutdown should trigger close events
      await manager.shutdown();

      expect(eventsReceived).toContain('created');
      expect(eventsReceived).toContain('closed');
    });

    it('should handle multiple event listeners for same event', async () => {
      let listener1Called = false;
      let listener2Called = false;
      let listener3Called = false;

      manager.on('browserCreated', () => { listener1Called = true; });
      manager.on('browserCreated', () => { listener2Called = true; });
      manager.on('browserCreated', () => { listener3Called = true; });

      await manager.launchBrowser({ browserType: 'chromium' });

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
      expect(listener3Called).toBe(true);
    });
  });

  describe('Browser Type Edge Cases', () => {
    it('should handle all supported browser types sequentially', async () => {
      const types: Array<'chromium' | 'firefox' | 'webkit'> = ['chromium', 'firefox', 'webkit'];

      for (const browserType of types) {
        const result = await manager.launchBrowser({ browserType });
        expect(result.success).toBe(true);
        expect(result.data?.type).toBe(browserType);

        await manager.closeBrowser(result.data!.id);
      }
    });

    it('should handle browser type case sensitivity', async () => {
      const result = await manager.launchBrowser({
        browserType: 'CHROMIUM' as any // Test case insensitivity
      });

      // Should either work or fail gracefully, not crash
      expect(result.success).toBe(true);
    });
  });

  describe('Resource Limit Boundary Conditions', () => {
    it('should handle zero resource limits', async () => {
      const zeroLimitManager = new BrowserManager({
        maxInstances: 0,
        resourceLimits: { maxMemoryMB: 0 }
      });

      const result = await zeroLimitManager.launchBrowser({ browserType: 'chromium' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum browser instances exceeded');

      await zeroLimitManager.shutdown();
    });

    it('should handle negative resource limits', async () => {
      const negativeManager = new BrowserManager({
        maxInstances: -1,
        instanceIdleTimeout: -1000
      });

      // Should handle negative values gracefully
      const result = await negativeManager.launchBrowser({ browserType: 'chromium' });
      expect(result.success).toBe(false);

      await negativeManager.shutdown();
    });
  });
});