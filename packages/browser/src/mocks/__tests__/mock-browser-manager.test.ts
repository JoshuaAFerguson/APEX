/**
 * @apexcli/browser/mocks - MockBrowserManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockBrowserManager } from '../mock-browser-manager.js';
import { MockBrowserSession } from '../mock-browser-session.js';
import type { BrowserManagerConfig } from '../../types.js';

describe('MockBrowserManager', () => {
  let manager: MockBrowserManager;

  beforeEach(() => {
    manager = new MockBrowserManager();
  });

  describe('constructor and configuration', () => {
    it('should create manager with default config', () => {
      const defaultManager = new MockBrowserManager();
      const config = defaultManager.getConfig();

      expect(config.maxInstances).toBe(5);
      expect(config.reuseInstances).toBe(true);
      expect(config.instanceIdleTimeout).toBe(300000);
    });

    it('should create manager with custom config', () => {
      const customConfig: Partial<BrowserManagerConfig> = {
        maxInstances: 10,
        reuseInstances: false,
        instanceIdleTimeout: 600000,
        resourceLimits: {
          maxMemoryMB: 2048,
          maxCpuPercent: 90,
        },
      };

      const customManager = new MockBrowserManager(customConfig);
      const config = customManager.getConfig();

      expect(config.maxInstances).toBe(10);
      expect(config.reuseInstances).toBe(false);
      expect(config.instanceIdleTimeout).toBe(600000);
      expect(config.resourceLimits?.maxMemoryMB).toBe(2048);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(manager.isInitialized()).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      await manager.initialize();
      const result = await manager.initialize();

      expect(result.success).toBe(true);
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('session creation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should create session successfully', async () => {
      const result = await manager.createSession();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(MockBrowserSession);
      expect(manager.getActiveSessionCount()).toBe(1);
    });

    it('should create session with custom config', async () => {
      const sessionConfig = {
        browserType: 'firefox' as const,
        headless: false,
        viewport: { width: 1920, height: 1080 },
      };

      const result = await manager.createSession(sessionConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(MockBrowserSession);

      const session = result.data!;
      const config = session.getConfig();
      expect(config.browserType).toBe('firefox');
      expect(config.headless).toBe(false);
    });

    it('should emit events when creating sessions', async () => {
      const browserCreatedSpy = vi.fn();
      const contextCreatedSpy = vi.fn();

      manager.on('browserCreated', browserCreatedSpy);
      manager.on('contextCreated', contextCreatedSpy);

      await manager.createSession();

      expect(browserCreatedSpy).toHaveBeenCalledTimes(1);
      expect(contextCreatedSpy).toHaveBeenCalledTimes(1);

      const browserInfo = browserCreatedSpy.mock.calls[0][0];
      expect(browserInfo.id).toBeDefined();
      expect(browserInfo.type).toBe('chromium');
      expect(browserInfo.createdAt).toBeInstanceOf(Date);
    });

    it('should respect maximum instance limits', async () => {
      const limitedManager = new MockBrowserManager({ maxInstances: 2 });
      await limitedManager.initialize();

      // Create maximum allowed sessions
      const result1 = await limitedManager.createSession();
      const result2 = await limitedManager.createSession();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(limitedManager.getActiveSessionCount()).toBe(2);

      // Try to create one more - should fail
      const result3 = await limitedManager.createSession();

      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Maximum number of browser instances');
    });

    it('should auto-initialize if not already initialized', async () => {
      const uninitializedManager = new MockBrowserManager();
      expect(uninitializedManager.isInitialized()).toBe(false);

      const result = await uninitializedManager.createSession();

      expect(result.success).toBe(true);
      expect(uninitializedManager.isInitialized()).toBe(true);
    });
  });

  describe('session management', () => {
    let session: MockBrowserSession;

    beforeEach(async () => {
      await manager.initialize();
      const result = await manager.createSession();
      session = result.data!;
    });

    it('should close session successfully', async () => {
      const result = await manager.closeSession(session);

      expect(result.success).toBe(true);
      expect(manager.getActiveSessionCount()).toBe(0);
    });

    it('should emit events when closing sessions', async () => {
      const contextClosedSpy = vi.fn();
      const browserClosedSpy = vi.fn();

      manager.on('contextClosed', contextClosedSpy);
      manager.on('browserClosed', browserClosedSpy);

      await manager.closeSession(session);

      expect(contextClosedSpy).toHaveBeenCalledTimes(1);
      expect(browserClosedSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle closing non-existent session', async () => {
      const otherSession = new MockBrowserSession();
      const result = await manager.closeSession(otherSession);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should track browser instances and contexts', async () => {
      const instances = manager.getBrowserInstances();
      const contexts = manager.getBrowserContexts();

      expect(instances).toHaveLength(1);
      expect(contexts).toHaveLength(1);

      expect(instances[0]).toMatchObject({
        type: 'chromium',
        contextCount: 1,
        inUse: false,
      });

      expect(contexts[0]).toMatchObject({
        browserId: instances[0].id,
        pageCount: 0,
      });
    });
  });

  describe('cleanup operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should cleanup all resources', async () => {
      // Create multiple sessions
      await manager.createSession();
      await manager.createSession();

      expect(manager.getActiveSessionCount()).toBe(2);
      expect(manager.getBrowserInstances()).toHaveLength(2);

      const result = await manager.cleanup();

      expect(result.success).toBe(true);
      expect(manager.getActiveSessionCount()).toBe(0);
      expect(manager.getBrowserInstances()).toHaveLength(0);
      expect(manager.getBrowserContexts()).toHaveLength(0);
      expect(manager.isInitialized()).toBe(false);
    });
  });

  describe('resource monitoring', () => {
    beforeEach(async () => {
      await manager.initialize();
      await manager.createSession();
    });

    it('should check resource usage', async () => {
      const result = await manager.checkResourceUsage();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        memory: expect.any(Number),
        cpu: expect.any(Number),
      });

      expect(result.data!.memory).toBeGreaterThan(0);
      expect(result.data!.cpu).toBeGreaterThan(0);
    });

    it('should emit resource limit exceeded events', async () => {
      const resourceLimitSpy = vi.fn();
      manager.on('resourceLimitExceeded', resourceLimitSpy);

      // Create a manager with very low limits
      const lowLimitManager = new MockBrowserManager({
        resourceLimits: {
          maxMemoryMB: 50, // Very low limit
          maxCpuPercent: 5,  // Very low limit
        },
      });

      await lowLimitManager.initialize();
      await lowLimitManager.createSession();
      await lowLimitManager.checkResourceUsage();

      // Should have triggered at least one limit exceeded event
      expect(resourceLimitSpy).toHaveBeenCalled();
    });

    it('should handle multiple instances in resource calculation', async () => {
      // Create multiple sessions
      await manager.createSession();
      await manager.createSession();

      const result = await manager.checkResourceUsage();

      expect(result.success).toBe(true);
      expect(result.data!.memory).toBeGreaterThan(0);

      // Memory should be sum of all instances
      const instances = manager.getBrowserInstances();
      const expectedMemory = instances.reduce((sum, instance) =>
        sum + (instance.resourceUsage?.memoryMB || 0), 0);

      expect(result.data!.memory).toBe(expectedMemory);
    });
  });

  describe('state management', () => {
    it('should track manager state correctly', async () => {
      let state = manager.getState();

      expect(state.activeSessions).toBe(0);
      expect(state.initialized).toBe(false);
      expect(state.sessions.size).toBe(0);

      await manager.initialize();
      await manager.createSession();

      state = manager.getState();

      expect(state.activeSessions).toBe(1);
      expect(state.initialized).toBe(true);
      expect(state.sessions.size).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle session creation errors gracefully', async () => {
      // Don't initialize the manager
      const result = await manager.createSession();

      // Should auto-initialize, so this should actually succeed
      expect(result.success).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Test cleanup without initialization
      const result = await manager.cleanup();

      expect(result.success).toBe(true);
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle concurrent session creation', async () => {
      const promises = Array.from({ length: 3 }, () => manager.createSession());
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(MockBrowserSession);
      });

      expect(manager.getActiveSessionCount()).toBe(3);
    });

    it('should handle concurrent session closure', async () => {
      // Create sessions
      const sessions = await Promise.all([
        manager.createSession(),
        manager.createSession(),
        manager.createSession(),
      ]);

      const sessionInstances = sessions.map(result => result.data!);

      // Close them concurrently
      const closePromises = sessionInstances.map(session => manager.closeSession(session));
      const closeResults = await Promise.all(closePromises);

      closeResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(manager.getActiveSessionCount()).toBe(0);
    });
  });
});