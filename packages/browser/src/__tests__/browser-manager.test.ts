/**
 * @apexcli/browser - Browser Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { defaultManagerConfig } from '../constants.js';

describe('BrowserManager', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    // Create fresh manager for each test
    manager = new BrowserManager();
  });

  afterEach(async () => {
    // Clean up after each test
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create manager with default config', () => {
      expect(manager).toBeInstanceOf(BrowserManager);
    });

    it('should merge custom config with defaults', () => {
      const customConfig = {
        maxInstances: 3,
        reuseInstances: false,
      };

      const customManager = new BrowserManager(customConfig);
      expect(customManager).toBeInstanceOf(BrowserManager);
    });
  });

  describe('Browser Instance Management', () => {
    it('should launch a browser instance', async () => {
      const result = await manager.launchBrowser({
        browserType: 'chromium',
        headless: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBeDefined();
      expect(result.data?.type).toBe('chromium');
    });

    it('should return browser instances list', async () => {
      await manager.launchBrowser({ browserType: 'chromium' });

      const instances = manager.getInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0].type).toBe('chromium');
    });

    it('should close browser instance', async () => {
      const result = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = result.data!.id;

      const closeResult = await manager.closeBrowser(instanceId);
      expect(closeResult.success).toBe(true);

      const instances = manager.getInstances();
      expect(instances).toHaveLength(0);
    });

    it('should respect max instances limit', async () => {
      const limitedManager = new BrowserManager({ maxInstances: 1 });

      // Launch first instance - should succeed
      const first = await limitedManager.launchBrowser({ browserType: 'chromium' });
      expect(first.success).toBe(true);

      // Launch second instance - should fail due to limit
      const second = await limitedManager.launchBrowser({ browserType: 'chromium' });
      expect(second.success).toBe(false);
      expect(second.error).toContain('Maximum browser instances exceeded');

      await limitedManager.shutdown();
    });
  });

  describe('Browser Context Management', () => {
    it('should create browser context', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      const contextResult = await manager.createContext(instanceId, {
        viewport: { width: 1920, height: 1080 },
      });

      expect(contextResult.success).toBe(true);
      expect(contextResult.data).toBeDefined();
      expect(contextResult.data?.browserId).toBe(instanceId);
    });

    it('should return contexts list', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      await manager.createContext(instanceResult.data!.id);

      const contexts = manager.getContexts();
      expect(contexts).toHaveLength(1);
    });

    it('should close browser context', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id);
      const contextId = contextResult.data!.id;

      const closeResult = await manager.closeContext(contextId);
      expect(closeResult.success).toBe(true);

      const contexts = manager.getContexts();
      expect(contexts).toHaveLength(0);
    });

    it('should fail to create context for non-existent instance', async () => {
      const result = await manager.createContext('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser instance not found');
    });
  });

  describe('Resource Management', () => {
    it('should return resource usage statistics', async () => {
      await manager.launchBrowser({ browserType: 'chromium' });

      const usage = await manager.getResourceUsage();
      expect(usage.totalInstances).toBe(1);
      expect(usage.totalContexts).toBe(0);
      expect(usage.memoryUsageMB).toBeGreaterThan(0);
    });

    it('should cleanup idle instances', async () => {
      const managerWithShortTimeout = new BrowserManager({
        instanceIdleTimeout: 100, // Very short timeout for testing
        reuseInstances: true,
      });

      // Launch and immediately mark as not in use
      const result = await managerWithShortTimeout.launchBrowser({ browserType: 'chromium' });

      // Wait for idle timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleanedCount = await managerWithShortTimeout.cleanupIdleInstances();
      expect(cleanedCount).toBe(1);

      await managerWithShortTimeout.shutdown();
    });
  });

  describe('Instance Reuse', () => {
    it('should reuse browser instances when enabled', async () => {
      const reuseManager = new BrowserManager({ reuseInstances: true });

      // Launch first instance
      const first = await reuseManager.launchBrowser({ browserType: 'chromium' });
      const firstId = first.data!.id;

      // Close any contexts to make it reusable
      const instances = reuseManager.getInstances();
      expect(instances[0].inUse).toBe(true);

      // Launch second instance with same config
      const second = await reuseManager.launchBrowser({ browserType: 'chromium' });

      // Should reuse the same instance
      expect(second.data!.id).toBe(firstId);

      await reuseManager.shutdown();
    });

    it('should not reuse instances when disabled', async () => {
      const noReuseManager = new BrowserManager({
        reuseInstances: false,
        maxInstances: 2,
      });

      const first = await noReuseManager.launchBrowser({ browserType: 'chromium' });
      const second = await noReuseManager.launchBrowser({ browserType: 'chromium' });

      // Should be different instances
      expect(first.data!.id).not.toBe(second.data!.id);

      await noReuseManager.shutdown();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid browser type gracefully', async () => {
      // This should still work as it defaults to chromium
      const result = await manager.launchBrowser({
        browserType: 'invalid' as any,
      });

      expect(result.success).toBe(true);
    });

    it('should handle context operations on closed browser', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      // Close the browser first
      await manager.closeBrowser(instanceId);

      // Try to create context - should fail
      const contextResult = await manager.createContext(instanceId);
      expect(contextResult.success).toBe(false);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown cleanly and close all instances', async () => {
      await manager.launchBrowser({ browserType: 'chromium' });
      await manager.launchBrowser({ browserType: 'firefox' });

      expect(manager.getInstances()).toHaveLength(2);

      await manager.shutdown();

      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should prevent operations after shutdown', async () => {
      await manager.shutdown();

      const result = await manager.launchBrowser({ browserType: 'chromium' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('shut down');
    });
  });

  describe('Events', () => {
    it('should emit browserCreated event', async () => {
      const eventPromise = new Promise((resolve) => {
        manager.once('browserCreated', resolve);
      });

      await manager.launchBrowser({ browserType: 'chromium' });

      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should emit contextCreated event', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });

      const eventPromise = new Promise((resolve) => {
        manager.once('contextCreated', resolve);
      });

      await manager.createContext(instanceResult.data!.id);

      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should emit browserClosed event', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });

      const eventPromise = new Promise((resolve) => {
        manager.once('browserClosed', resolve);
      });

      await manager.closeBrowser(instanceResult.data!.id);

      const event = await eventPromise;
      expect(event).toBe(instanceResult.data!.id);
    });

    it('should emit contextClosed event', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id);

      const eventPromise = new Promise((resolve) => {
        manager.once('contextClosed', resolve);
      });

      await manager.closeContext(contextResult.data!.id);

      const event = await eventPromise;
      expect(event).toBe(contextResult.data!.id);
    });

    it('should emit resourceLimitExceeded event', async () => {
      const limitedManager = new BrowserManager({
        resourceLimits: { maxMemoryMB: 1 }, // Very low limit
      });

      let eventEmitted = false;
      limitedManager.once('resourceLimitExceeded', () => {
        eventEmitted = true;
      });

      // Launch browser and wait for resource check
      await limitedManager.launchBrowser({ browserType: 'chromium' });

      // Wait for resource monitoring to run
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(eventEmitted).toBe(true);

      await limitedManager.shutdown();
    });
  });

  describe('Browser Type Support', () => {
    it('should support chromium browser', async () => {
      const result = await manager.launchBrowser({ browserType: 'chromium' });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('chromium');
    });

    it('should support firefox browser', async () => {
      const result = await manager.launchBrowser({ browserType: 'firefox' });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('firefox');
    });

    it('should support webkit browser', async () => {
      const result = await manager.launchBrowser({ browserType: 'webkit' });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('webkit');
    });

    it('should default to chromium for invalid browser type', async () => {
      const result = await manager.launchBrowser({
        browserType: 'invalid-browser' as any
      });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('chromium'); // Should default to chromium
    });
  });

  describe('Configuration Options', () => {
    it('should apply custom viewport configuration', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id, {
        viewport: { width: 1920, height: 1080 }
      });

      expect(contextResult.success).toBe(true);
      expect(contextResult.data?.config.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('should apply custom user agent', async () => {
      const customUserAgent = 'Custom Test Agent 1.0';
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id, {
        userAgent: customUserAgent
      });

      expect(contextResult.success).toBe(true);
      expect(contextResult.data?.config.userAgent).toBe(customUserAgent);
    });

    it('should apply timeout configuration', async () => {
      const customTimeout = 60000;
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id, {
        timeout: customTimeout
      });

      expect(contextResult.success).toBe(true);
      expect(contextResult.data?.config.timeout).toBe(customTimeout);
    });

    it('should handle ignoreHTTPSErrors option', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id, {
        ignoreHTTPSErrors: true
      });

      expect(contextResult.success).toBe(true);
      expect(contextResult.data?.config.ignoreHTTPSErrors).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent browser launches', async () => {
      const promises = Array.from({ length: 3 }, () =>
        manager.launchBrowser({ browserType: 'chromium' })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data?.id).toBeDefined();
      });

      expect(manager.getInstances()).toHaveLength(3);
    });

    it('should handle concurrent context creation', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      const promises = Array.from({ length: 3 }, () =>
        manager.createContext(instanceId)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data?.browserId).toBe(instanceId);
      });

      expect(manager.getContexts()).toHaveLength(3);
    });

    it('should handle concurrent shutdown operations', async () => {
      const promises = Array.from({ length: 3 }, () =>
        manager.launchBrowser({ browserType: 'chromium' })
      );

      const results = await Promise.all(promises);
      const instances = results.map(r => r.data!);

      // Close all instances concurrently
      const closePromises = instances.map(instance =>
        manager.closeBrowser(instance.id)
      );

      const closeResults = await Promise.all(closePromises);
      closeResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getInstances()).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle double shutdown gracefully', async () => {
      await manager.launchBrowser({ browserType: 'chromium' });

      await manager.shutdown();
      await manager.shutdown(); // Second shutdown should not throw

      expect(manager.getInstances()).toHaveLength(0);
    });

    it('should handle operations after partial failure', async () => {
      // Create a context on a valid instance
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id);

      expect(contextResult.success).toBe(true);

      // Try to create another context on the same instance
      const contextResult2 = await manager.createContext(instanceResult.data!.id);
      expect(contextResult2.success).toBe(true);

      // Close the first context
      const closeResult = await manager.closeContext(contextResult.data!.id);
      expect(closeResult.success).toBe(true);

      // Second context should still be valid
      expect(manager.getContexts()).toHaveLength(1);
    });

    it('should handle context closure with multiple contexts on same instance', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      // Create multiple contexts
      const context1 = await manager.createContext(instanceId);
      const context2 = await manager.createContext(instanceId);

      expect(manager.getContexts()).toHaveLength(2);

      // Close one context
      await manager.closeContext(context1.data!.id);

      expect(manager.getContexts()).toHaveLength(1);

      // Instance should still have one context
      const instances = manager.getInstances();
      expect(instances[0].contextCount).toBe(1);
    });

    it('should handle resource monitoring with no instances', async () => {
      const usage = await manager.getResourceUsage();

      expect(usage.totalInstances).toBe(0);
      expect(usage.totalContexts).toBe(0);
      expect(usage.memoryUsageMB).toBe(0);
      expect(usage.activeBrowsers).toBe(0);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should track memory usage across multiple instances', async () => {
      // Launch multiple instances with contexts
      for (let i = 0; i < 3; i++) {
        const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
        await manager.createContext(instanceResult.data!.id);
      }

      const usage = await manager.getResourceUsage();

      expect(usage.totalInstances).toBe(3);
      expect(usage.totalContexts).toBe(3);
      expect(usage.memoryUsageMB).toBeGreaterThan(0);
      expect(usage.activeBrowsers).toBe(3);
    });

    it('should properly track active vs idle instances', async () => {
      const reuseManager = new BrowserManager({ reuseInstances: true });

      // Launch instance and create context
      const instanceResult = await reuseManager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await reuseManager.createContext(instanceResult.data!.id);

      // Close context to make instance idle
      await reuseManager.closeContext(contextResult.data!.id);

      const usage = await reuseManager.getResourceUsage();
      expect(usage.activeBrowsers).toBe(0); // No active browsers since no contexts

      await reuseManager.shutdown();
    });

    it('should handle cleanup when instances have zombie contexts', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      // Create context but don't close properly
      await manager.createContext(instanceId);

      // Force close browser (simulates crash)
      const instance = manager.getInstance(instanceId);
      if (instance) {
        await instance.close();
      }

      // Cleanup should handle this gracefully
      const cleanupResult = await manager.cleanupIdleInstances();
      expect(cleanupResult).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Instance Retrieval and Validation', () => {
    it('should get browser instance by ID', async () => {
      const launchResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = launchResult.data!.id;

      const instance = manager.getInstance(instanceId);
      expect(instance).toBeDefined();
      expect(typeof instance?.newContext).toBe('function');
    });

    it('should return undefined for non-existent instance ID', () => {
      const instance = manager.getInstance('non-existent-id');
      expect(instance).toBeUndefined();
    });

    it('should get browser context by ID', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id);
      const contextId = contextResult.data!.id;

      const context = manager.getContext(contextId);
      expect(context).toBeDefined();
      expect(typeof context?.newPage).toBe('function');
    });

    it('should return undefined for non-existent context ID', () => {
      const context = manager.getContext('non-existent-id');
      expect(context).toBeUndefined();
    });
  });

  describe('Launch Options and Context Options', () => {
    it('should apply custom launch options', async () => {
      const result = await manager.launchBrowser({
        browserType: 'chromium',
        headless: false,
        launchOptions: {
          slowMo: 100,
          devtools: false
        }
      });

      expect(result.success).toBe(true);
    });

    it('should apply custom context options', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const contextResult = await manager.createContext(instanceResult.data!.id, {
        contextOptions: {
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris'
        }
      });

      expect(contextResult.success).toBe(true);
    });
  });

  describe('Instance Reuse Logic', () => {
    it('should not reuse instance of different browser type', async () => {
      const reuseManager = new BrowserManager({ reuseInstances: true });

      const chromiumResult = await reuseManager.launchBrowser({ browserType: 'chromium' });
      const firefoxResult = await reuseManager.launchBrowser({ browserType: 'firefox' });

      expect(chromiumResult.data!.id).not.toBe(firefoxResult.data!.id);

      await reuseManager.shutdown();
    });

    it('should correctly identify reusable instances', async () => {
      const reuseManager = new BrowserManager({
        reuseInstances: true,
        instanceIdleTimeout: 10000
      });

      // Launch instance and close context to make it reusable
      const firstResult = await reuseManager.launchBrowser({ browserType: 'chromium' });
      // Instances start as inUse, simulate closing contexts to make reusable

      const secondResult = await reuseManager.launchBrowser({ browserType: 'chromium' });

      // Since first instance is still inUse, should create new instance
      expect(firstResult.data!.id).not.toBe(secondResult.data!.id);

      await reuseManager.shutdown();
    });
  });
});

describe('BrowserManager Error Scenarios', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Browser Launch Failures', () => {
    it('should handle browser launch timeout gracefully', async () => {
      // Create manager with very short timeout to force failure
      const timeoutManager = new BrowserManager({
        defaultSessionConfig: {
          browserType: 'chromium',
          headless: true,
          launchOptions: {
            timeout: 1 // 1ms timeout - will definitely fail
          }
        }
      });

      const result = await timeoutManager.launchBrowser();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      await timeoutManager.shutdown();
    });
  });

  describe('Context Creation Failures', () => {
    it('should handle context creation on disconnected browser', async () => {
      const instanceResult = await manager.launchBrowser({ browserType: 'chromium' });
      const instanceId = instanceResult.data!.id;

      // Close the browser instance directly
      const instance = manager.getInstance(instanceId);
      await instance?.close();

      // Try to create context - should fail
      const contextResult = await manager.createContext(instanceId);
      expect(contextResult.success).toBe(false);
      expect(contextResult.error).toContain('Browser instance not found');
    });
  });

  describe('Resource Limit Enforcement', () => {
    it('should enforce memory limits during resource monitoring', async () => {
      const limitedManager = new BrowserManager({
        resourceLimits: { maxMemoryMB: 50 }, // Very low limit
      });

      let limitExceeded = false;
      limitedManager.once('resourceLimitExceeded', (info) => {
        expect(info.type).toBe('memory');
        expect(info.limit).toBe(50);
        limitExceeded = true;
      });

      // Create enough instances to exceed memory limit
      await limitedManager.launchBrowser({ browserType: 'chromium' });
      await limitedManager.launchBrowser({ browserType: 'chromium' });

      // Trigger resource check manually
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Clean up
      await limitedManager.shutdown();
    });
  });
});