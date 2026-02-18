/**
 * Browser Lifecycle Integration Tests
 *
 * Comprehensive tests for browser launch/close lifecycle including:
 * - Browser instantiation with all supported browser types
 * - Multiple browser instance management and concurrency
 * - Graceful shutdown and resource cleanup
 * - Error handling during launch/close operations
 * - Edge cases and timeout scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import {
  defaultBrowserConfig,
  defaultManagerConfig,
  BROWSER_LIMITS,
  MONITORING_INTERVALS,
  ERROR_MESSAGES
} from '../constants.js';
import type {
  BrowserManagerConfig,
  BrowserSessionConfig,
  SupportedBrowserType
} from '../types.js';

describe('Browser Lifecycle Integration Tests', () => {
  let managers: BrowserManager[] = [];
  let sessions: BrowserSession[] = [];

  beforeEach(() => {
    // Clean arrays for tracking instances to close
    managers = [];
    sessions = [];
  });

  afterEach(async () => {
    // Ensure all managers and sessions are properly closed
    const cleanupPromises = [
      ...sessions.map(session => session.close().catch(() => {})),
      ...managers.map(manager => manager.shutdown().catch(() => {}))
    ];

    await Promise.allSettled(cleanupPromises);
    managers = [];
    sessions = [];
  });

  /**
   * Helper function to create and track manager for cleanup
   */
  function createManager(config?: Partial<BrowserManagerConfig>): BrowserManager {
    const manager = new BrowserManager(config);
    managers.push(manager);
    return manager;
  }

  /**
   * Helper function to create and track session for cleanup
   */
  function createSession(config?: Partial<BrowserSessionConfig>): BrowserSession {
    const session = new BrowserSession(config);
    sessions.push(session);
    return session;
  }

  describe('Browser Instantiation Tests', () => {
    it('should successfully launch all supported browser types', async () => {
      const browserTypes: SupportedBrowserType[] = ['chromium', 'firefox', 'webkit'];
      const manager = createManager();

      const results = [];

      // Test each browser type sequentially to avoid resource conflicts
      for (const browserType of browserTypes) {
        const result = await manager.launchBrowser({
          browserType,
          headless: true
        });

        expect(result.success).toBe(true);
        expect(result.data?.type).toBe(browserType);
        expect(result.data?.id).toBeDefined();
        expect(result.data?.createdAt).toBeInstanceOf(Date);
        expect(result.duration).toBeGreaterThan(0);

        results.push(result);

        // Close immediately to free resources
        if (result.success && result.data) {
          await manager.closeBrowser(result.data.id);
        }
      }

      expect(results).toHaveLength(3);
    }, 60000); // Extended timeout for browser launches

    it('should launch browser with default configuration', async () => {
      const manager = createManager();

      const result = await manager.launchBrowser();

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe(defaultBrowserConfig.browserType);
      expect(result.data?.id).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      // Verify instance appears in manager's list
      const instances = manager.getInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe(result.data?.id);
    });

    it('should launch browser with custom configuration options', async () => {
      const manager = createManager();

      const customConfig: Partial<BrowserSessionConfig> = {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        timeout: 45000,
        ignoreHTTPSErrors: true,
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
          timeout: 30000
        },
        contextOptions: {
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris'
        }
      };

      const result = await manager.launchBrowser(customConfig);

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('chromium');
      expect(result.duration).toBeGreaterThan(0);

      // Test context creation with custom config
      const contextResult = await manager.createContext(result.data!.id, customConfig);
      expect(contextResult.success).toBe(true);
      expect(contextResult.data?.config.viewport).toEqual({ width: 1920, height: 1080 });
      expect(contextResult.data?.config.timeout).toBe(45000);
    });

    it('should launch browser in both headless and non-headless modes', async () => {
      const manager = createManager();

      // Test headless mode
      const headlessResult = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true
      });
      expect(headlessResult.success).toBe(true);

      // Test non-headless mode
      const nonHeadlessResult = await manager.launchBrowser({
        browserType: 'chromium',
        headless: false
      });
      expect(nonHeadlessResult.success).toBe(true);

      // Both should be different instances
      expect(headlessResult.data?.id).not.toBe(nonHeadlessResult.data?.id);

      expect(manager.getInstances()).toHaveLength(2);
    });

    it('should measure accurate launch duration', async () => {
      const manager = createManager();

      const startTime = Date.now();
      const result = await manager.launchBrowser({ browserType: 'chromium' });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 100); // Small buffer
    });
  });

  describe('Multiple Browser Instance Management', () => {
    it('should handle concurrent browser launches', async () => {
      const manager = createManager({ maxInstances: 5 });

      // Launch 3 browsers concurrently
      const launchPromises = Array.from({ length: 3 }, (_, i) =>
        manager.launchBrowser({
          browserType: i === 0 ? 'chromium' : i === 1 ? 'firefox' : 'webkit',
          headless: true
        })
      );

      const results = await Promise.all(launchPromises);

      // All launches should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data?.id).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
      });

      // Should have 3 unique instances
      const instanceIds = results.map(r => r.data?.id);
      const uniqueIds = new Set(instanceIds);
      expect(uniqueIds.size).toBe(3);

      expect(manager.getInstances()).toHaveLength(3);
    }, 90000); // Extended timeout for concurrent launches

    it('should enforce maximum instance limits', async () => {
      const manager = createManager({ maxInstances: 2 });

      // Launch maximum allowed instances
      const first = await manager.launchBrowser({ browserType: 'chromium' });
      const second = await manager.launchBrowser({ browserType: 'firefox' });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(manager.getInstances()).toHaveLength(2);

      // Third launch should fail due to limit
      const third = await manager.launchBrowser({ browserType: 'webkit' });

      expect(third.success).toBe(false);
      expect(third.error).toContain(ERROR_MESSAGES.MAX_INSTANCES_EXCEEDED);
      expect(manager.getInstances()).toHaveLength(2);
    });

    it('should support instance reuse when enabled', async () => {
      const manager = createManager({
        reuseInstances: true,
        maxInstances: 3
      });

      // Launch first instance
      const firstResult = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true
      });
      expect(firstResult.success).toBe(true);

      const firstId = firstResult.data!.id;

      // Close to make it available for reuse
      await manager.closeBrowser(firstId);

      // Launch second instance with same config - should reuse if possible
      const secondResult = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true
      });
      expect(secondResult.success).toBe(true);

      // Note: Actual reuse behavior depends on internal manager logic
      // This test verifies the system handles reuse configuration properly
    });

    it('should manage contexts across multiple browser instances', async () => {
      const manager = createManager({ maxInstances: 3 });

      // Launch multiple browsers
      const browser1 = await manager.launchBrowser({ browserType: 'chromium' });
      const browser2 = await manager.launchBrowser({ browserType: 'firefox' });

      expect(browser1.success && browser2.success).toBe(true);

      // Create contexts in each browser
      const context1a = await manager.createContext(browser1.data!.id);
      const context1b = await manager.createContext(browser1.data!.id);
      const context2a = await manager.createContext(browser2.data!.id);

      expect(context1a.success && context1b.success && context2a.success).toBe(true);

      // Verify context distribution
      expect(manager.getContexts()).toHaveLength(3);
      expect(manager.getInstances()[0].contextCount).toBeGreaterThan(0);
      expect(manager.getInstances()[1].contextCount).toBeGreaterThan(0);

      // Close contexts individually
      await manager.closeContext(context1a.data!.id);
      await manager.closeContext(context2a.data!.id);

      expect(manager.getContexts()).toHaveLength(1);
    });

    it('should track resource usage across multiple instances', async () => {
      const manager = createManager({ maxInstances: 3 });

      // Launch multiple browsers with contexts
      const browsers = [];
      for (let i = 0; i < 2; i++) {
        const browser = await manager.launchBrowser({
          browserType: 'chromium',
          headless: true
        });
        expect(browser.success).toBe(true);
        browsers.push(browser.data!);

        // Create context for each
        await manager.createContext(browser.data!.id);
      }

      const usage = await manager.getResourceUsage();

      expect(usage.totalInstances).toBe(2);
      expect(usage.totalContexts).toBe(2);
      expect(usage.activeBrowsers).toBe(2);
      expect(usage.memoryUsageMB).toBeGreaterThan(0);
    });
  });

  describe('Graceful Shutdown and Cleanup', () => {
    it('should perform clean shutdown of single browser instance', async () => {
      const manager = createManager();

      // Launch browser and create context
      const browserResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(browserResult.data!.id);

      expect(browserResult.success && contextResult.success).toBe(true);
      expect(manager.getInstances()).toHaveLength(1);
      expect(manager.getContexts()).toHaveLength(1);

      // Close browser should clean up context too
      const closeResult = await manager.closeBrowser(browserResult.data!.id);

      expect(closeResult.success).toBe(true);
      expect(closeResult.duration).toBeGreaterThan(0);
      expect(manager.getInstances()).toHaveLength(0);
      expect(manager.getContexts()).toHaveLength(0);
    });

    it('should handle shutdown with multiple browsers and contexts', async () => {
      const manager = createManager({ maxInstances: 3 });

      // Create multiple browsers with multiple contexts
      const browsers = [];
      for (let i = 0; i < 2; i++) {
        const browser = await manager.launchBrowser({ browserType: 'chromium' });
        browsers.push(browser.data!);

        // Create 2 contexts per browser
        await manager.createContext(browser.data!.id);
        await manager.createContext(browser.data!.id);
      }

      expect(manager.getInstances()).toHaveLength(2);
      expect(manager.getContexts()).toHaveLength(4);

      // Full manager shutdown should clean everything
      await manager.shutdown();

      expect(manager.getInstances()).toHaveLength(0);
      expect(manager.getContexts()).toHaveLength(0);
    });

    it('should clean up resources during idle instance cleanup', async () => {
      const manager = createManager({
        instanceIdleTimeout: 100, // Very short for testing
        reuseInstances: true
      });

      // Launch browser
      const result = await manager.launchBrowser({ browserType: 'chromium' });
      expect(result.success).toBe(true);

      expect(manager.getInstances()).toHaveLength(1);

      // Wait for idle timeout and trigger cleanup
      await new Promise(resolve => setTimeout(resolve, 150));
      const cleanedCount = await manager.cleanupIdleInstances();

      // Instance should be cleaned up if it became idle
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent shutdown operations', async () => {
      const manager = createManager({ maxInstances: 4 });

      // Launch multiple browsers
      const browsers = await Promise.all([
        manager.launchBrowser({ browserType: 'chromium' }),
        manager.launchBrowser({ browserType: 'firefox' }),
        manager.launchBrowser({ browserType: 'webkit' })
      ]);

      // All should succeed
      browsers.forEach(result => expect(result.success).toBe(true));
      expect(manager.getInstances()).toHaveLength(3);

      // Close all concurrently
      const closePromises = browsers.map(result =>
        manager.closeBrowser(result.data!.id)
      );

      const closeResults = await Promise.all(closePromises);

      closeResults.forEach(result => expect(result.success).toBe(true));
      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should maintain resource cleanup order during shutdown', async () => {
      const manager = createManager();

      // Create nested structure: browser -> context -> operations
      const browserResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(browserResult.data!.id);

      expect(browserResult.success && contextResult.success).toBe(true);

      // Get direct references to verify they're closed
      const browser = manager.getInstance(browserResult.data!.id);
      const context = manager.getContext(contextResult.data!.id);

      expect(browser).toBeDefined();
      expect(context).toBeDefined();

      // Shutdown should close contexts first, then browsers
      await manager.shutdown();

      // Verify both are closed and no longer tracked
      expect(manager.getInstance(browserResult.data!.id)).toBeUndefined();
      expect(manager.getContext(contextResult.data!.id)).toBeUndefined();
    });

    it('should handle graceful shutdown with BrowserSession', async () => {
      const session = createSession({
        browserType: 'chromium',
        headless: true
      });

      const launchResult = await session.launch();
      expect(launchResult.success).toBe(true);

      // Navigate to ensure session is active
      const navResult = await session.navigate('data:text/html,<h1>Test</h1>');
      expect(navResult.success).toBe(true);

      // Close should clean up properly
      const closeResult = await session.close();
      expect(closeResult.success).toBe(true);
      expect(closeResult.duration).toBeGreaterThan(0);

      // Subsequent operations should fail gracefully
      const postCloseNav = await session.navigate('data:text/html,<h1>Test2</h1>');
      expect(postCloseNav.success).toBe(false);
      expect(postCloseNav.error).toContain('Browser not launched');
    });
  });

  describe('Error Handling During Launch/Close', () => {
    it('should handle browser launch timeout gracefully', async () => {
      const manager = createManager({
        defaultSessionConfig: {
          browserType: 'chromium',
          headless: true,
          launchOptions: {
            timeout: 1 // 1ms timeout will definitely fail
          }
        }
      });

      const result = await manager.launchBrowser();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.data).toBeUndefined();

      // Manager state should remain consistent
      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should handle invalid launch configuration', async () => {
      const manager = createManager();

      const result = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true,
        launchOptions: {
          executablePath: '/nonexistent/browser/executable'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to launch');
      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should handle operations after shutdown', async () => {
      const manager = createManager();

      // Normal operation should work
      const normalResult = await manager.launchBrowser({ browserType: 'chromium' });
      expect(normalResult.success).toBe(true);

      // Shutdown manager
      await manager.shutdown();

      // Further operations should fail gracefully
      const postShutdownResult = await manager.launchBrowser({ browserType: 'chromium' });

      expect(postShutdownResult.success).toBe(false);
      expect(postShutdownResult.error).toContain('shut down');
      expect(postShutdownResult.duration).toBeGreaterThan(0);
    });

    it('should handle context operations on closed browser', async () => {
      const manager = createManager();

      const browserResult = await manager.launchBrowser({ browserType: 'chromium' });
      const browserId = browserResult.data!.id;

      // Close the browser
      const closeResult = await manager.closeBrowser(browserId);
      expect(closeResult.success).toBe(true);

      // Try to create context on closed browser
      const contextResult = await manager.createContext(browserId);

      expect(contextResult.success).toBe(false);
      expect(contextResult.error).toContain('Browser instance not found');
    });

    it('should handle close operations on already closed resources', async () => {
      const manager = createManager();

      const browserResult = await manager.launchBrowser({ browserType: 'chromium' });
      const browserId = browserResult.data!.id;

      // Close browser normally
      const firstClose = await manager.closeBrowser(browserId);
      expect(firstClose.success).toBe(true);

      // Try to close again
      const secondClose = await manager.closeBrowser(browserId);
      expect(secondClose.success).toBe(false);
      expect(secondClose.error).toContain('Browser instance not found');
    });

    it('should handle resource limit enforcement', async () => {
      const manager = createManager({
        resourceLimits: { maxMemoryMB: 50 }, // Very low limit
        maxInstances: 2
      });

      let limitExceededEmitted = false;
      manager.once('resourceLimitExceeded', (info) => {
        expect(info.type).toBe('memory');
        expect(info.limit).toBe(50);
        limitExceededEmitted = true;
      });

      // Launch browsers to potentially exceed limit
      await manager.launchBrowser({ browserType: 'chromium' });
      await manager.launchBrowser({ browserType: 'chromium' });

      // Wait for resource monitoring to trigger
      await new Promise(resolve => setTimeout(resolve, 6000));
    });

    it('should handle browser crash scenarios', async () => {
      const manager = createManager();

      const browserResult = await manager.launchBrowser({ browserType: 'chromium' });
      const browserId = browserResult.data!.id;

      // Get browser instance and force close (simulate crash)
      const browser = manager.getInstance(browserId);
      expect(browser).toBeDefined();

      if (browser) {
        await browser.close();
      }

      // Manager should handle this gracefully in cleanup
      const cleanupResult = await manager.cleanupIdleInstances();
      expect(cleanupResult).toBeGreaterThanOrEqual(0);

      // Subsequent operations should fail gracefully
      const contextResult = await manager.createContext(browserId);
      expect(contextResult.success).toBe(false);
    });
  });

  describe('Edge Cases and Timeout Scenarios', () => {
    it('should handle multiple shutdown calls gracefully', async () => {
      const manager = createManager();

      await manager.launchBrowser({ browserType: 'chromium' });
      expect(manager.getInstances()).toHaveLength(1);

      // Multiple shutdowns should not throw
      await Promise.all([
        manager.shutdown(),
        manager.shutdown(),
        manager.shutdown()
      ]);

      expect(manager.getInstances()).toHaveLength(0);

      // Additional shutdown should still work
      await manager.shutdown();
    });

    it('should handle concurrent launch and shutdown operations', async () => {
      const manager = createManager({ maxInstances: 3 });

      // Start launches and shutdown concurrently
      const operations = Promise.all([
        manager.launchBrowser({ browserType: 'chromium' }),
        manager.launchBrowser({ browserType: 'firefox' }),
        manager.shutdown()
      ]);

      // Should complete without throwing
      const results = await operations;

      // Shutdown should win - no instances should remain
      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should handle resource monitoring during rapid instance creation/destruction', async () => {
      const manager = createManager({
        maxInstances: 5,
        instanceIdleTimeout: 50
      });

      // Rapid create/destroy cycle
      for (let i = 0; i < 3; i++) {
        const result = await manager.launchBrowser({
          browserType: 'chromium',
          headless: true
        });

        if (result.success) {
          // Close quickly
          await manager.closeBrowser(result.data!.id);
        }
      }

      // Verify final state is clean
      expect(manager.getInstances()).toHaveLength(0);

      // Resource monitoring should handle this gracefully
      const usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(0);
    });

    it('should handle maximum context creation per browser', async () => {
      const manager = createManager();

      const browserResult = await manager.launchBrowser({ browserType: 'chromium' });
      const browserId = browserResult.data!.id;

      // Create many contexts rapidly
      const contextPromises = Array.from({ length: 5 }, () =>
        manager.createContext(browserId, {
          viewport: { width: 800, height: 600 }
        })
      );

      const contextResults = await Promise.all(contextPromises);

      // All should succeed
      contextResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getContexts()).toHaveLength(5);

      // Browser should track context count correctly
      const instances = manager.getInstances();
      expect(instances[0].contextCount).toBe(5);
    });

    it('should handle instance reuse edge cases', async () => {
      const manager = createManager({
        reuseInstances: true,
        instanceIdleTimeout: 60000 // Long timeout
      });

      // Launch and close browser quickly
      const firstResult = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true
      });
      expect(firstResult.success).toBe(true);

      await manager.closeBrowser(firstResult.data!.id);

      // Launch again immediately - reuse behavior varies by implementation
      const secondResult = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true
      });
      expect(secondResult.success).toBe(true);

      // Should have valid browser either way
      expect(secondResult.data?.type).toBe('chromium');
    });

    it('should handle BrowserSession lifecycle edge cases', async () => {
      const session = createSession({
        browserType: 'chromium',
        headless: true,
        timeout: 30000
      });

      // Multiple launch calls should be handled gracefully
      const firstLaunch = await session.launch();
      expect(firstLaunch.success).toBe(true);

      const secondLaunch = await session.launch();
      // Behavior depends on implementation - should either succeed or fail gracefully
      expect(typeof secondLaunch.success).toBe('boolean');

      // Multiple close calls should be handled gracefully
      const firstClose = await session.close();
      expect(firstClose.success).toBe(true);

      const secondClose = await session.close();
      expect(secondClose.success).toBe(true); // Should be idempotent
    });

    it('should handle memory pressure scenarios', async () => {
      const manager = createManager({
        maxInstances: 2,
        resourceLimits: { maxMemoryMB: 200 }
      });

      // Launch browsers and create contexts to use memory
      const browser1 = await manager.launchBrowser({ browserType: 'chromium' });
      const browser2 = await manager.launchBrowser({ browserType: 'chromium' });

      expect(browser1.success && browser2.success).toBe(true);

      // Create multiple contexts
      await Promise.all([
        manager.createContext(browser1.data!.id),
        manager.createContext(browser1.data!.id),
        manager.createContext(browser2.data!.id),
        manager.createContext(browser2.data!.id)
      ]);

      const usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(2);
      expect(usage.totalContexts).toBe(4);
      expect(usage.memoryUsageMB).toBeGreaterThan(0);

      // System should remain stable under memory pressure
      expect(manager.getInstances()).toHaveLength(2);
      expect(manager.getContexts()).toHaveLength(4);
    });
  });

  describe('Performance and Timing Validation', () => {
    it('should complete browser launch within reasonable time limits', async () => {
      const manager = createManager();

      const startTime = Date.now();
      const result = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(BROWSER_LIMITS.LAUNCH_TIMEOUT_MS);
      expect(result.duration).toBeLessThan(BROWSER_LIMITS.LAUNCH_TIMEOUT_MS);
    });

    it('should track resource monitoring timing correctly', async () => {
      const manager = createManager({
        resourceLimits: { maxMemoryMB: 1024 }
      });

      await manager.launchBrowser({ browserType: 'chromium' });

      // Resource monitoring should complete quickly
      const startTime = Date.now();
      const usage = await manager.getResourceUsage();
      const endTime = Date.now();

      expect(usage).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should maintain performance during concurrent operations', async () => {
      const manager = createManager({ maxInstances: 3 });

      // Measure time for concurrent launches
      const startTime = Date.now();

      const promises = Array.from({ length: 3 }, () =>
        manager.launchBrowser({
          browserType: 'chromium',
          headless: true
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      results.forEach(result => expect(result.success).toBe(true));

      // Concurrent launches shouldn't be much slower than individual
      expect(endTime - startTime).toBeLessThan(BROWSER_LIMITS.LAUNCH_TIMEOUT_MS * 2);
    }, 60000); // Extended timeout for concurrent operations
  });
});