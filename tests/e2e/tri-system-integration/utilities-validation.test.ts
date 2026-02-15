/**
 * Validation tests for tri-system integration utilities
 *
 * Tests utility functions, mock factories, scenario builders, and assertion helpers
 * to ensure they work correctly and handle edge cases appropriately.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createMockToolSystem,
  createMockPermissionSystem,
  createMockBrowserSystem,
  createMockTriSystemTask,
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
  type ToolExecutionResult,
  type SystemEvent,
  type BrowserOperation
} from './test-utils.js';

describe('Tri-System Utilities Validation', () => {
  let env: TriSystemTestEnvironment | null = null;

  afterEach(async () => {
    if (env) {
      await env.cleanup();
      env = null;
    }
    vi.clearAllMocks();
  });

  describe('Mock Factory Functions', () => {
    describe('createMockToolSystem', () => {
      it('should create mock tool system with default tools', () => {
        const toolSystem = createMockToolSystem();

        expect(toolSystem).toBeDefined();
        expect(toolSystem.registry).toBeDefined();
        expect(toolSystem.executor).toBeDefined();
        expect(toolSystem.mocks).toBeDefined();

        // Check registry methods
        expect(typeof toolSystem.registry.registerTool).toBe('function');
        expect(typeof toolSystem.registry.getTool).toBe('function');
        expect(typeof toolSystem.registry.isRegistered).toBe('function');
        expect(typeof toolSystem.registry.listTools).toBe('function');

        // Check executor methods
        expect(typeof toolSystem.executor.execute).toBe('function');
        expect(typeof toolSystem.executor.executeWithPermissionCheck).toBe('function');

        // Check mock collection
        expect(toolSystem.mocks.read).toBeDefined();
        expect(toolSystem.mocks.write).toBeDefined();
        expect(toolSystem.mocks.browser).toBeDefined();
      });

      it('should create mock tool system with custom configuration', () => {
        const customTools = ['Read', 'Write'];
        const customResponses = {
          'Read': { success: true, data: { content: 'custom content' } },
          'Write': { success: true, data: { bytesWritten: 42 } }
        };

        const toolSystem = createMockToolSystem({
          enabledTools: customTools,
          defaultResponses: customResponses
        });

        expect(toolSystem.registry.listTools()).toEqual(customTools);
      });

      it('should handle empty tool configuration', () => {
        const toolSystem = createMockToolSystem({
          enabledTools: [],
          defaultResponses: {}
        });

        expect(toolSystem.registry.listTools()).toEqual([]);
      });
    });

    describe('createMockPermissionSystem', () => {
      it('should create mock permission system with default config', () => {
        const permissionSystem = createMockPermissionSystem();

        expect(permissionSystem).toBeDefined();
        expect(permissionSystem.manager).toBeDefined();
        expect(permissionSystem.store).toBeDefined();
        expect(permissionSystem.config).toBeDefined();

        // Check manager methods
        expect(typeof permissionSystem.manager.checkToolPermission).toBe('function');
        expect(typeof permissionSystem.manager.grantPermission).toBe('function');

        // Check store methods
        expect(typeof permissionSystem.store.checkPermission).toBe('function');
        expect(typeof permissionSystem.store.grantPermission).toBe('function');

        // Check config properties
        expect(permissionSystem.config.defaultLevel).toBeDefined();
        expect(Array.isArray(permissionSystem.config.blockedDomains)).toBe(true);
        expect(Array.isArray(permissionSystem.config.deniedOperations)).toBe(true);
      });

      it('should create mock permission system with custom config', () => {
        const customConfig = {
          defaultPermissionLevel: 'allow-once',
          denyOperations: ['Browser', 'Write'],
          blockedDomains: ['malicious.com', 'spam.net'],
          simulateFailures: true
        };

        const permissionSystem = createMockPermissionSystem(customConfig);

        expect(permissionSystem.config.defaultLevel).toBe('allow-once');
        expect(permissionSystem.config.blockedDomains).toContain('malicious.com');
        expect(permissionSystem.config.deniedOperations).toContain('Browser');
      });
    });

    describe('createMockBrowserSystem', () => {
      it('should create mock browser system with default config', () => {
        const browserSystem = createMockBrowserSystem();

        expect(browserSystem).toBeDefined();
        expect(browserSystem.tool).toBeDefined();
        expect(browserSystem.mockPage).toBeDefined();
        expect(browserSystem.mockBrowser).toBeDefined();

        // Check tool methods
        expect(typeof browserSystem.tool.execute).toBe('function');
        expect(typeof browserSystem.tool.createSession).toBe('function');
        expect(typeof browserSystem.tool.closeSession).toBe('function');
        expect(typeof browserSystem.tool.cleanup).toBe('function');

        // Check mock page methods
        expect(browserSystem.mockPage.url).toBeDefined();
        expect(browserSystem.mockPage.goto).toBeDefined();
        expect(browserSystem.mockPage.click).toBeDefined();
      });

      it('should create mock browser system with custom config', () => {
        const customConfig = {
          headless: false,
          allowedDomains: ['trusted.com'],
          defaultResponses: {
            'navigate': { success: true, url: 'custom-url' }
          }
        };

        const browserSystem = createMockBrowserSystem(customConfig);

        expect(browserSystem.tool).toBeDefined();
        expect(browserSystem.mockPage).toBeDefined();
      });
    });

    describe('createMockTriSystemTask', () => {
      it('should create task with default values', () => {
        const task = createMockTriSystemTask();

        expect(task).toBeDefined();
        expect(task.description).toBe('Tri-system integration test task');
        expect(task.workflow).toBe('tri-system-test');
        expect(task.autonomy).toBe('supervised');
        expect(task.id).toBeDefined();
        expect(task.status).toBeDefined();
        expect(task.createdAt).toBeDefined();
      });

      it('should create task with custom overrides', () => {
        const customTask = createMockTriSystemTask({
          description: 'Custom test task',
          autonomy: 'full',
          priority: 'high'
        });

        expect(customTask.description).toBe('Custom test task');
        expect(customTask.autonomy).toBe('full');
        expect(customTask.priority).toBe('high');
        expect(customTask.workflow).toBe('tri-system-test'); // Should maintain default
      });
    });
  });

  describe('Scenario Factory Functions', () => {
    describe('createPermissionDeniedScenario', () => {
      it('should create permission denied scenario with defaults', async () => {
        env = await createPermissionDeniedScenario();

        expect(env).toBeDefined();
        expect(env.permissionSystem.config.deniedOperations).toContain('Browser');
        expect(env.permissionSystem.config.blockedDomains).toContain('dangerous.com');
      });

      it('should create permission denied scenario with custom options', async () => {
        env = await createPermissionDeniedScenario({
          deniedTools: ['Write', 'Edit'],
          deniedOperations: ['delete', 'modify'],
          blockedDomains: ['evil.com', 'phishing.net']
        });

        expect(env.permissionSystem.config.deniedOperations).toContain('Write');
        expect(env.permissionSystem.config.deniedOperations).toContain('Edit');
        expect(env.permissionSystem.config.deniedOperations).toContain('delete');
        expect(env.permissionSystem.config.blockedDomains).toContain('evil.com');
      });
    });

    describe('createBrowserToolIntegrationScenario', () => {
      it('should create browser integration scenario', async () => {
        env = await createBrowserToolIntegrationScenario();

        expect(env).toBeDefined();
        expect(env.toolSystem.registry.listTools()).toContain('Browser');
        expect(env.permissionSystem.config.defaultLevel).toBe('allow-always');
        expect(env.browserSystem.tool).toBeDefined();
      });
    });

    describe('createFullAutonomyScenario', () => {
      it('should create full autonomy scenario', async () => {
        env = await createFullAutonomyScenario();

        expect(env).toBeDefined();
        expect(env.permissionSystem.config.defaultLevel).toBe('allow-always');
        expect(env.systemEvents).toBeDefined();
      });
    });

    describe('createSupervisedModeScenario', () => {
      it('should create supervised mode scenario', async () => {
        env = await createSupervisedModeScenario();

        expect(env).toBeDefined();
        expect(env.permissionSystem.config.defaultLevel).toBe('allow-once');
        expect(env.systemEvents).toBeDefined();
      });
    });
  });

  describe('Assertion Helper Functions', () => {
    describe('assertTriSystemEventSequence', () => {
      it('should validate correct event sequence', () => {
        const events: SystemEvent[] = [
          {
            id: '1',
            type: 'tool:execution:start',
            system: 'tool',
            data: { tool: 'Read' },
            timestamp: new Date('2023-01-01T10:00:00Z')
          },
          {
            id: '2',
            type: 'permission:requested',
            system: 'permission',
            data: { tool: 'Read' },
            timestamp: new Date('2023-01-01T10:00:01Z')
          },
          {
            id: '3',
            type: 'tool:execution:complete',
            system: 'tool',
            data: { result: 'success' },
            timestamp: new Date('2023-01-01T10:00:02Z')
          }
        ];

        const expectedSequence = [
          { type: 'tool:execution:start', system: 'tool' as const },
          { type: 'permission:requested', system: 'permission' as const },
          { type: 'tool:execution:complete', system: 'tool' as const }
        ];

        expect(() => {
          assertTriSystemEventSequence(events, expectedSequence);
        }).not.toThrow();
      });

      it('should fail on incorrect event sequence', () => {
        const events: SystemEvent[] = [
          {
            id: '1',
            type: 'tool:execution:start',
            system: 'tool',
            data: {},
            timestamp: new Date()
          }
        ];

        const expectedSequence = [
          { type: 'tool:execution:start', system: 'tool' as const },
          { type: 'permission:requested', system: 'permission' as const }
        ];

        expect(() => {
          assertTriSystemEventSequence(events, expectedSequence);
        }).toThrow();
      });

      it('should validate event data when specified', () => {
        const events: SystemEvent[] = [
          {
            id: '1',
            type: 'tool:execution:start',
            system: 'tool',
            data: { tool: 'Read', filePath: '/test.txt' },
            timestamp: new Date()
          }
        ];

        const expectedSequence = [
          {
            type: 'tool:execution:start',
            system: 'tool' as const,
            data: { tool: 'Read' }
          }
        ];

        expect(() => {
          assertTriSystemEventSequence(events, expectedSequence);
        }).not.toThrow();
      });
    });

    describe('assertPermissionEnforced', () => {
      it('should validate permission granted result', () => {
        const grantedResult: ToolExecutionResult = {
          success: true,
          data: { content: 'file content' },
          metadata: {
            tool: 'Read',
            timestamp: new Date().toISOString()
          }
        };

        expect(() => {
          assertPermissionEnforced(grantedResult, 'granted');
        }).not.toThrow();
      });

      it('should validate permission denied result', () => {
        const deniedResult: ToolExecutionResult = {
          success: false,
          error: 'Permission denied',
          permissionDenied: true,
          metadata: {
            tool: 'Browser',
            timestamp: new Date().toISOString()
          }
        };

        expect(() => {
          assertPermissionEnforced(deniedResult, 'denied');
        }).not.toThrow();
      });

      it('should fail when permission expectation is wrong', () => {
        const grantedResult: ToolExecutionResult = {
          success: true,
          data: {},
          metadata: {
            tool: 'Read',
            timestamp: new Date().toISOString()
          }
        };

        expect(() => {
          assertPermissionEnforced(grantedResult, 'denied');
        }).toThrow();
      });
    });

    describe('assertBrowserPermissionRespected', () => {
      it('should validate successful browser operation', () => {
        const browserResult: ToolExecutionResult = {
          success: true,
          data: { url: 'https://example.com' },
          metadata: {
            tool: 'Browser',
            operation: 'navigate',
            timestamp: new Date().toISOString()
          }
        };

        expect(() => {
          assertBrowserPermissionRespected(browserResult, 'navigate');
        }).not.toThrow();
      });

      it('should validate failed browser operation', () => {
        const browserResult: ToolExecutionResult = {
          success: false,
          error: 'Navigation failed',
          metadata: {
            tool: 'Browser',
            operation: 'click',
            timestamp: new Date().toISOString()
          }
        };

        expect(() => {
          assertBrowserPermissionRespected(browserResult, 'click');
        }).not.toThrow();
      });

      it('should fail when metadata is missing', () => {
        const invalidResult: ToolExecutionResult = {
          success: true,
          data: {}
        };

        expect(() => {
          assertBrowserPermissionRespected(invalidResult, 'navigate');
        }).toThrow();
      });
    });

    describe('assertTriSystemReady', () => {
      it('should validate ready tri-system environment', async () => {
        env = await createTriSystemTestEnvironment();

        expect(() => {
          assertTriSystemReady(env);
        }).not.toThrow();
      });

      it('should fail when system components are missing', () => {
        const incompleteEnv = {
          testDir: '/tmp/test',
          orchestrator: null,
          taskStore: null,
          eventEmitter: null,
          toolSystem: null,
          permissionSystem: null,
          browserSystem: null,
          systemEvents: null,
          cleanup: async () => {}
        } as any;

        expect(() => {
          assertTriSystemReady(incompleteEnv);
        }).toThrow();
      });
    });

    describe('assertCleanShutdown', () => {
      it('should validate clean environment shutdown', async () => {
        env = await createTriSystemTestEnvironment({
          eventConfig: { captureAll: true }
        });

        // Generate some events
        env.systemEvents.start();
        env.eventEmitter.emit('tool:execution:start', { tool: 'Read' });
        env.eventEmitter.emit('tool:execution:complete', { tool: 'Read' });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(() => {
          assertCleanShutdown(env!);
        }).not.toThrow();
      });
    });

    describe('assertCrossSystemEventPropagation', () => {
      it('should validate cross-system event correlation', async () => {
        env = await createTriSystemTestEnvironment({
          eventConfig: { captureAll: true, enableCorrelation: true }
        });

        env.systemEvents.start();

        // Create correlated events
        const correlationId = `test_${Date.now()}`;

        const toolEvent: SystemEvent = {
          id: 'tool_1',
          type: 'tool:execution:start',
          system: 'tool',
          data: { tool: 'Browser' },
          timestamp: new Date(),
          correlationId
        };

        const browserEvent: SystemEvent = {
          id: 'browser_1',
          type: 'browser:operation:start',
          system: 'browser',
          data: { operation: 'navigate' },
          timestamp: new Date(),
          correlationId
        };

        // Simulate correlated events
        env.systemEvents.correlatedEvents.push({
          correlationId,
          events: [toolEvent, browserEvent],
          systems: new Set(['tool', 'browser']),
          startTime: toolEvent.timestamp,
          endTime: browserEvent.timestamp,
          complete: true
        });

        expect(() => {
          assertCrossSystemEventPropagation(env!, 'tool', 'browser', 'tool:execution:start');
        }).not.toThrow();
      });

      it('should fail when cross-system correlation is missing', async () => {
        env = await createTriSystemTestEnvironment({
          eventConfig: { captureAll: true, enableCorrelation: true }
        });

        env.systemEvents.start();

        expect(() => {
          assertCrossSystemEventPropagation(env!, 'tool', 'browser', 'nonexistent:event');
        }).toThrow();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid tool names gracefully', async () => {
      env = await createTriSystemTestEnvironment();

      const result = await env.toolSystem.executor.execute('NonexistentTool' as any, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('should handle empty event sequences', () => {
      expect(() => {
        assertTriSystemEventSequence([], []);
      }).not.toThrow();
    });

    it('should handle malformed events gracefully', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: { captureAll: true }
      });

      env.systemEvents.start();

      // Emit malformed events
      env.eventEmitter.emit('invalid:event', null);
      env.eventEmitter.emit('another:invalid', undefined);

      await new Promise(resolve => setTimeout(resolve, 100));

      // System should remain stable
      expect(env.systemEvents.getAllEvents).not.toThrow();
    });

    it('should handle concurrent cleanup calls', async () => {
      env = await createTriSystemTestEnvironment();

      // Call cleanup multiple times concurrently
      const cleanupPromises = [
        env.cleanup(),
        env.cleanup(),
        env.cleanup()
      ];

      await expect(Promise.all(cleanupPromises)).resolves.toBeDefined();
      env = null; // Mark as cleaned up manually
    });

    it('should handle resource exhaustion scenarios', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          maxEvents: 2 // Very low limit
        }
      });

      env.systemEvents.start();

      // Generate many events
      for (let i = 0; i < 10; i++) {
        env.eventEmitter.emit('tool:execution:start', {
          tool: 'Read',
          iteration: i
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const events = env.systemEvents.getAllEvents();
      expect(events.length).toBeLessThanOrEqual(2);
    });

    it('should handle browser session creation failures', async () => {
      env = await createTriSystemTestEnvironment();

      // Mock session creation to fail
      const mockCreateSession = vi.fn().mockRejectedValue(new Error('Session creation failed'));
      env.browserSystem.tool.createSession = mockCreateSession;

      await expect(env.browserSystem.tool.createSession()).rejects.toThrow('Session creation failed');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of events efficiently', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          maxEvents: 1000
        }
      });

      env.systemEvents.start();

      const startTime = Date.now();

      // Generate 100 events
      for (let i = 0; i < 100; i++) {
        env.eventEmitter.emit('tool:execution:start', {
          tool: 'Read',
          iteration: i,
          timestamp: new Date()
        });

        if (i % 10 === 0) {
          env.eventEmitter.emit('permission:requested', {
            tool: 'Read',
            iteration: i
          });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process events reasonably quickly
      expect(processingTime).toBeLessThan(1000);

      const events = env.systemEvents.getAllEvents();
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle concurrent tool executions', async () => {
      env = await createTriSystemTestEnvironment();

      const concurrentExecutions = 20;
      const operations = [];

      for (let i = 0; i < concurrentExecutions; i++) {
        operations.push(
          env.toolSystem.executor.execute('Read', {
            filePath: `/test/file${i}.txt`
          })
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      // All operations should complete
      expect(results.length).toBe(concurrentExecutions);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('TypeScript Compilation', () => {
    it('should have proper type exports', () => {
      // This test ensures that all the TypeScript types are properly exported
      // and can be imported without compilation errors

      // These should not cause TypeScript compilation errors
      const envPromise: Promise<TriSystemTestEnvironment> = createTriSystemTestEnvironment();
      const toolResult: ToolExecutionResult = {
        success: true,
        data: {},
        metadata: {
          tool: 'Read',
          timestamp: new Date().toISOString()
        }
      };

      const browserOp: BrowserOperation = 'navigate';

      expect(envPromise).toBeDefined();
      expect(toolResult).toBeDefined();
      expect(browserOp).toBe('navigate');
    });
  });
});