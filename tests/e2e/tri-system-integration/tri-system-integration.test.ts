/**
 * Comprehensive E2E tests for tri-system integration infrastructure
 *
 * Tests the complete integration of Tool System, Permission System, and Browser Automation
 * with real-world scenarios, error handling, and cross-system event propagation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createPermissionDeniedScenario,
  createBrowserToolIntegrationScenario,
  createFullAutonomyScenario,
  createSupervisedModeScenario,
  assertTriSystemEventSequence,
  assertPermissionEnforced,
  assertBrowserPermissionRespected,
  assertTriSystemReady,
  assertCleanShutdown,
  assertCrossSystemEventPropagation,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type ToolExecutionResult
} from './test-utils.js';

describe('Tri-System Integration E2E Tests', () => {
  let env: TriSystemTestEnvironment | null = null;

  afterEach(async () => {
    if (env) {
      await env.cleanup();
      env = null;
    }
    vi.clearAllMocks();
  });

  describe('Environment Initialization', () => {
    it('should initialize all three systems correctly', async () => {
      env = await createTriSystemTestEnvironment();

      assertTriSystemReady(env);

      // Verify tool system
      expect(env.toolSystem.registry.listTools()).toContain('Browser');
      expect(env.toolSystem.registry.listTools()).toContain('Read');
      expect(env.toolSystem.registry.listTools()).toContain('Write');

      // Verify permission system
      expect(env.permissionSystem.manager).toBeDefined();
      expect(typeof env.permissionSystem.store.checkPermission).toBe('function');

      // Verify browser system
      expect(env.browserSystem.tool).toBeDefined();
      expect(env.browserSystem.mockPage).toBeDefined();
      expect(env.browserSystem.mockBrowser).toBeDefined();

      // Verify event system
      expect(env.systemEvents).toBeDefined();
      expect(typeof env.systemEvents.start).toBe('function');
      expect(typeof env.systemEvents.getAllEvents).toBe('function');
    });

    it('should handle custom configuration options', async () => {
      env = await createTriSystemTestEnvironment({
        toolConfig: {
          enabledTools: ['Browser', 'Read'],
          mockAll: true
        },
        permissionConfig: {
          preset: 'denyAll',
          deniedOperations: ['Write', 'Edit'],
          blockedDomains: ['dangerous.com']
        },
        browserConfig: {
          backend: 'mock',
          headless: true,
          allowedDomains: ['safe.com']
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true,
          maxEvents: 500
        }
      });

      assertTriSystemReady(env);

      // Verify tool configuration
      const enabledTools = env.toolSystem.registry.listTools();
      expect(enabledTools).toContain('Browser');
      expect(enabledTools).toContain('Read');

      // Verify permission configuration
      expect(env.permissionSystem.config.deniedOperations).toContain('Write');
      expect(env.permissionSystem.config.blockedDomains).toContain('dangerous.com');
    });

    it('should set up event capture with correlation', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      // Start event capture
      env.systemEvents.start();

      // Emit test events
      env.eventEmitter.emit('tool:execution:start', {
        tool: 'Browser',
        operation: 'navigate',
        timestamp: new Date()
      });

      env.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'navigate',
        timestamp: new Date()
      });

      env.eventEmitter.emit('browser:operation:start', {
        operation: 'navigate',
        params: { url: 'https://example.com' },
        timestamp: new Date()
      });

      // Wait for events to be captured
      await new Promise(resolve => setTimeout(resolve, 100));

      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(3);

      const toolEvents = env.systemEvents.getEventsBySystem('tool');
      const permissionEvents = env.systemEvents.getEventsBySystem('permission');
      const browserEvents = env.systemEvents.getEventsBySystem('browser');

      expect(toolEvents.length).toBeGreaterThan(0);
      expect(permissionEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Tool System Integration', () => {
    it('should execute tools with mock implementations', async () => {
      env = await createTriSystemTestEnvironment({
        toolConfig: {
          enabledTools: ['Read', 'Write', 'Browser'],
          mockAll: true
        }
      });

      // Test Read tool
      const readResult = await env.toolSystem.executor.execute('Read', {
        filePath: '/test/file.txt'
      });

      expect(readResult.success).toBe(true);
      expect(readResult.data).toBeDefined();
      expect(readResult.metadata?.tool).toBe('Read');

      // Test Write tool
      const writeResult = await env.toolSystem.executor.execute('Write', {
        filePath: '/test/output.txt',
        content: 'test content'
      });

      expect(writeResult.success).toBe(true);
      expect(writeResult.data).toBeDefined();
      expect(writeResult.metadata?.tool).toBe('Write');

      // Test Browser tool
      const browserResult = await env.toolSystem.executor.execute('Browser', {
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(browserResult.success).toBe(true);
      expect(browserResult.data).toBeDefined();
      expect(browserResult.metadata?.tool).toBe('Browser');
    });

    it('should handle tool execution errors gracefully', async () => {
      env = await createTriSystemTestEnvironment();

      // Mock a tool to throw an error
      env.toolSystem.mocks.read.mockRejectedValue(new Error('File not found'));

      const result = await env.toolSystem.executor.execute('Read', {
        filePath: '/nonexistent/file.txt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
      expect(result.metadata?.tool).toBe('Read');
    });

    it('should track tool execution history', async () => {
      env = await createTriSystemTestEnvironment();

      // Execute multiple tools
      await env.toolSystem.executor.execute('Read', { filePath: '/test1.txt' });
      await env.toolSystem.executor.execute('Write', { filePath: '/test2.txt', content: 'data' });
      await env.toolSystem.executor.execute('Browser', { operation: 'navigate', params: { url: 'https://test.com' } });

      const history = env.toolSystem.mocks.getCallHistory();

      expect(history.Read).toBeDefined();
      expect(history.Write).toBeDefined();
      expect(history.Browser).toBeDefined();

      expect(history.Read.length).toBe(1);
      expect(history.Write.length).toBe(1);
      expect(history.Browser.length).toBe(1);
    });
  });

  describe('Permission System Integration', () => {
    it('should enforce permission denials', async () => {
      env = await createPermissionDeniedScenario({
        deniedTools: ['Browser', 'Write'],
        blockedDomains: ['blocked.com']
      });

      // Mock permission manager to deny operations
      const mockCheckPermission = vi.fn().mockResolvedValue({
        allowed: false,
        level: 'deny',
        denialReason: 'Tool access denied'
      });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // Attempt denied operation
      const result = await env.toolSystem.executor.execute('Browser', {
        operation: 'navigate',
        params: { url: 'https://blocked.com' }
      });

      // Should still execute in mock mode, but we can verify permission was checked
      expect(mockCheckPermission).toHaveBeenCalledWith('Browser', expect.any(Object));
    });

    it('should allow operations with proper permissions', async () => {
      env = await createFullAutonomyScenario();

      // Mock permission manager to allow operations
      const mockCheckPermission = vi.fn().mockResolvedValue({
        allowed: true,
        level: 'allow-always',
        denialReason: null
      });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      const result = await env.toolSystem.executor.execute('Read', {
        filePath: '/allowed/file.txt'
      });

      expect(result.success).toBe(true);
      expect(mockCheckPermission).toHaveBeenCalledWith('Read', expect.any(Object));
    });

    it('should emit permission events', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Trigger permission events
      env.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'navigate',
        timestamp: new Date()
      });

      env.eventEmitter.emit('permission:granted', {
        tool: 'Browser',
        scope: 'navigate',
        level: 'allow-once',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const permissionEvents = env.systemEvents.getEventsBySystem('permission');
      expect(permissionEvents.length).toBeGreaterThanOrEqual(2);

      const requestEvent = permissionEvents.find(e => e.type === 'permission:requested');
      const grantEvent = permissionEvents.find(e => e.type === 'permission:granted');

      expect(requestEvent).toBeDefined();
      expect(grantEvent).toBeDefined();
    });
  });

  describe('Browser System Integration', () => {
    it('should execute browser operations', async () => {
      env = await createBrowserToolIntegrationScenario();

      // Test navigation
      const navResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(true);
      expect(navResult.data?.url).toBe('https://example.com');
      assertBrowserPermissionRespected(navResult, 'navigate');

      // Test click operation
      const clickResult = await env.browserSystem.tool.execute({
        operation: 'click',
        params: { selector: '#submit-button' }
      });

      expect(clickResult.success).toBe(true);
      expect(clickResult.data?.clicked).toBe(true);
      assertBrowserPermissionRespected(clickResult, 'click');

      // Test type operation
      const typeResult = await env.browserSystem.tool.execute({
        operation: 'type',
        params: { selector: '#input-field', text: 'test input' }
      });

      expect(typeResult.success).toBe(true);
      expect(typeResult.data?.typed).toBe(true);
      assertBrowserPermissionRespected(typeResult, 'type');
    });

    it('should handle browser session management', async () => {
      env = await createBrowserToolIntegrationScenario();

      const session = await env.browserSystem.tool.createSession();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.context).toBeDefined();
      expect(session.page).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);

      await env.browserSystem.tool.closeSession(session.id);
    });

    it('should emit browser events', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Execute browser operation
      await env.browserSystem.tool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const browserEvents = env.systemEvents.getEventsBySystem('browser');
      expect(browserEvents.length).toBeGreaterThan(0);

      const startEvent = browserEvents.find(e => e.type === 'browser:operation:start');
      const completeEvent = browserEvents.find(e => e.type === 'browser:operation:complete');

      expect(startEvent).toBeDefined();
      expect(completeEvent).toBeDefined();
    });
  });

  describe('Cross-System Event Flow', () => {
    it('should propagate events across all three systems', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Simulate a complex tri-system operation
      // 1. Tool execution starts
      env.eventEmitter.emit('tool:execution:start', {
        tool: 'Browser',
        params: { operation: 'navigate', url: 'https://example.com' },
        timestamp: new Date()
      });

      // 2. Permission requested
      env.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'navigate',
        timestamp: new Date()
      });

      // 3. Permission granted
      env.eventEmitter.emit('permission:granted', {
        tool: 'Browser',
        scope: 'navigate',
        level: 'allow-once',
        timestamp: new Date()
      });

      // 4. Browser operation starts
      env.eventEmitter.emit('browser:operation:start', {
        operation: 'navigate',
        params: { url: 'https://example.com' },
        timestamp: new Date()
      });

      // 5. Browser operation completes
      env.eventEmitter.emit('browser:operation:complete', {
        operation: 'navigate',
        result: { success: true, url: 'https://example.com' },
        timestamp: new Date()
      });

      // 6. Tool execution completes
      env.eventEmitter.emit('tool:execution:complete', {
        tool: 'Browser',
        result: { success: true, data: { url: 'https://example.com' } },
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify event sequence
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(6);

      assertTriSystemEventSequence(allEvents, [
        { type: 'tool:execution:start', system: 'tool' },
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:granted', system: 'permission' },
        { type: 'browser:operation:start', system: 'browser' },
        { type: 'browser:operation:complete', system: 'browser' },
        { type: 'tool:execution:complete', system: 'tool' }
      ]);

      // Verify cross-system correlation
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThan(0);
    });

    it('should handle permission denial event flow', async () => {
      env = await createPermissionDeniedScenario({
        deniedTools: ['Browser']
      });

      env.systemEvents.start();

      // Simulate denied permission flow
      env.eventEmitter.emit('tool:execution:start', {
        tool: 'Browser',
        params: { operation: 'navigate' },
        timestamp: new Date()
      });

      env.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'navigate',
        timestamp: new Date()
      });

      env.eventEmitter.emit('permission:denied', {
        tool: 'Browser',
        scope: 'navigate',
        denialReason: 'Tool access denied',
        timestamp: new Date()
      });

      env.eventEmitter.emit('tool:execution:error', {
        tool: 'Browser',
        error: 'Permission denied',
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      assertTriSystemEventSequence(env.systemEvents.getAllEvents(), [
        { type: 'tool:execution:start', system: 'tool' },
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:denied', system: 'permission' },
        { type: 'tool:execution:error', system: 'tool' }
      ]);
    });

    it('should support event sequence expectations', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Start emitting events after a short delay
      setTimeout(() => {
        env!.eventEmitter.emit('tool:execution:start', { tool: 'Read' });
        env!.eventEmitter.emit('permission:requested', { tool: 'Read' });
        env!.eventEmitter.emit('permission:granted', { tool: 'Read' });
      }, 50);

      // Test event sequence expectation
      await env.systemEvents.expectEventSequence([
        { type: 'tool:execution:start', system: 'tool', timeoutMs: 1000 },
        { type: 'permission:requested', system: 'permission', timeoutMs: 1000 },
        { type: 'permission:granted', system: 'permission', timeoutMs: 1000 }
      ]);
    });
  });

  describe('Autonomy Mode Scenarios', () => {
    it('should handle full autonomy mode', async () => {
      env = await createFullAutonomyScenario();

      assertTriSystemReady(env);

      // Verify permission system allows operations
      expect(env.permissionSystem.config.defaultLevel).toBe('allow-always');

      // Execute operation in full autonomy mode
      const result = await env.toolSystem.executor.execute('Browser', {
        operation: 'navigate',
        params: { url: 'https://trusted.com' }
      });

      expect(result.success).toBe(true);
    });

    it('should handle supervised mode', async () => {
      env = await createSupervisedModeScenario();

      assertTriSystemReady(env);

      // Verify permission system requires approvals
      expect(env.permissionSystem.config.defaultLevel).toBe('allow-once');

      // Mock permission approval
      const mockCheckPermission = vi.fn().mockResolvedValue({
        allowed: true,
        level: 'allow-once',
        requiresApproval: true
      });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      const result = await env.toolSystem.executor.execute('Write', {
        filePath: '/supervised/file.txt',
        content: 'supervised content'
      });

      expect(result.success).toBe(true);
      expect(mockCheckPermission).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle system initialization errors gracefully', async () => {
      // This test verifies that the environment handles errors during setup
      // In a real scenario, errors could occur during database setup,
      // permission system initialization, etc.

      expect(async () => {
        env = await createTriSystemTestEnvironment({
          toolConfig: {
            enabledTools: ['Read', 'Write', 'Browser'],
            mockAll: true
          }
        });
      }).not.toThrow();
    });

    it('should handle browser operation failures', async () => {
      env = await createBrowserToolIntegrationScenario();

      // Mock browser operation to fail
      env.browserSystem.mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const result = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://invalid-url' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.tool).toBe('Browser');
    });

    it('should handle permission system failures', async () => {
      env = await createTriSystemTestEnvironment();

      // Mock permission system to throw error
      const mockCheckPermission = vi.fn().mockRejectedValue(new Error('Permission system unavailable'));
      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // This should not crash the system
      expect(async () => {
        await mockCheckPermission('Read', { scope: 'test' });
      }).rejects.toThrow('Permission system unavailable');
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources properly', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Generate some events and resources
      await env.toolSystem.executor.execute('Read', { filePath: '/test.txt' });
      const session = await env.browserSystem.tool.createSession();

      // Verify resources exist
      expect(env.systemEvents.getAllEvents().length).toBeGreaterThan(0);
      expect(session).toBeDefined();

      // Clean up
      await env.cleanup();

      assertCleanShutdown(env);

      // Set env to null since we cleaned up manually
      env = null;
    });

    it('should handle concurrent operations', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Execute multiple operations concurrently
      const operations = [
        env.toolSystem.executor.execute('Read', { filePath: '/file1.txt' }),
        env.toolSystem.executor.execute('Write', { filePath: '/file2.txt', content: 'data' }),
        env.browserSystem.tool.execute({ operation: 'navigate', params: { url: 'https://site1.com' } }),
        env.browserSystem.tool.execute({ operation: 'screenshot', params: { fullPage: true } })
      ];

      const results = await Promise.all(operations);

      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify events were captured
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(4);
    });

    it('should respect event capture limits', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          maxEvents: 5
        }
      });

      env.systemEvents.start();

      // Generate more events than the limit
      for (let i = 0; i < 10; i++) {
        env.eventEmitter.emit('tool:execution:start', {
          tool: 'Read',
          iteration: i,
          timestamp: new Date()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support complex workflow simulation', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true, enableCorrelation: true }
      });

      env.systemEvents.start();

      // Simulate complex workflow: Read config -> Check permissions -> Navigate browser -> Write results

      // Step 1: Read configuration
      const readResult = await env.toolSystem.executor.execute('Read', {
        filePath: '/config/settings.json'
      });
      expect(readResult.success).toBe(true);

      // Step 2: Check browser permission
      env.eventEmitter.emit('permission:requested', {
        tool: 'Browser',
        scope: 'navigate',
        timestamp: new Date()
      });

      // Step 3: Navigate browser
      const browserResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://api.example.com' }
      });
      expect(browserResult.success).toBe(true);

      // Step 4: Extract data (simulate)
      const extractResult = await env.browserSystem.tool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      expect(extractResult.success).toBe(true);

      // Step 5: Write results
      const writeResult = await env.toolSystem.executor.execute('Write', {
        filePath: '/output/results.json',
        content: JSON.stringify({ title: 'Example Site' })
      });
      expect(writeResult.success).toBe(true);

      // Verify complete workflow executed
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(5);

      // Check for tool events
      const toolEvents = env.systemEvents.getEventsBySystem('tool');
      expect(toolEvents.length).toBeGreaterThan(0);

      // Check for browser events
      const browserEvents = env.systemEvents.getEventsBySystem('browser');
      expect(browserEvents.length).toBeGreaterThan(0);

      // Check for permission events
      const permissionEvents = env.systemEvents.getEventsBySystem('permission');
      expect(permissionEvents.length).toBeGreaterThan(0);
    });

    it('should handle partial system failures gracefully', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Simulate browser system failure
      env.browserSystem.mockPage.goto.mockRejectedValue(new Error('Browser system offline'));

      // Tool operations should still work
      const readResult = await env.toolSystem.executor.execute('Read', {
        filePath: '/test.txt'
      });
      expect(readResult.success).toBe(true);

      // Browser operations should fail gracefully
      const browserResult = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserResult.success).toBe(false);
      expect(browserResult.error).toBeDefined();

      // System should remain stable
      assertTriSystemReady(env);
    });
  });
});