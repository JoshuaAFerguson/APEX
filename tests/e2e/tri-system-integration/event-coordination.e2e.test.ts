/**
 * E2E tests for tri-system event coordination and concurrent operations
 *
 * This test suite focuses specifically on event coordination across all three integrated systems:
 * - Tool System (Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, Browser)
 * - Permission System (access control and authorization)
 * - Browser Automation (web operations)
 *
 * Tests cover:
 * 1. Event propagation across all three systems
 * 2. Concurrent operations with permission checks
 * 3. Event ordering validation
 * 4. System state consistency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createPermissionDeniedScenario,
  createBrowserToolIntegrationScenario,
  createFullAutonomyScenario,
  assertTriSystemEventSequence,
  assertPermissionEnforced,
  assertBrowserPermissionRespected,
  assertTriSystemReady,
  assertCrossSystemEventPropagation,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type ToolExecutionResult,
  type SystemType
} from './test-utils';

describe('Tri-System Event Coordination E2E Tests', () => {
  let env: TriSystemTestEnvironment | null = null;

  afterEach(async () => {
    if (env) {
      await env.cleanup();
      env = null;
    }
    vi.clearAllMocks();
  });

  describe('Event Propagation Across All Systems', () => {
    it('should propagate events across tool, permission, and browser systems in correct sequence', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Execute a complex operation that involves all three systems
      const browserResult = await env.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://example.com' }
        }
      );

      // Wait for all events to propagate
      await new Promise(resolve => setTimeout(resolve, 150));

      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(6);

      // Verify the expected event sequence across all systems
      assertTriSystemEventSequence(allEvents, [
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:granted', system: 'permission' },
        { type: 'tool:execution:start', system: 'tool' },
        { type: 'browser:operation:start', system: 'browser' },
        { type: 'browser:operation:complete', system: 'browser' },
        { type: 'tool:execution:complete', system: 'tool' }
      ]);

      // Verify cross-system correlation exists
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThan(0);

      const mainGroup = correlatedGroups.find(group =>
        group.systems.has('tool') &&
        group.systems.has('permission') &&
        group.systems.has('browser')
      );
      expect(mainGroup).toBeDefined();
      expect(mainGroup?.events.length).toBeGreaterThanOrEqual(3);
    }, 10000);

    it('should maintain event ordering under high load', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true,
          maxEvents: 100
        }
      });

      env.systemEvents.start();

      // Generate rapid-fire events from all systems
      const eventPromises = [];

      // Tool system events
      for (let i = 0; i < 10; i++) {
        eventPromises.push(
          env.toolSystem.executor.execute('Read', { filePath: `/test/file${i}.txt` })
        );
      }

      // Browser system events
      for (let i = 0; i < 5; i++) {
        eventPromises.push(
          env.browserSystem.tool.execute({
            operation: 'navigate',
            params: { url: `https://site${i}.com` }
          })
        );
      }

      // Permission events (direct emission)
      for (let i = 0; i < 8; i++) {
        env.eventEmitter.emit('permission:requested', {
          tool: 'Write',
          scope: `file${i}`,
          timestamp: new Date()
        });
      }

      await Promise.all(eventPromises);
      await new Promise(resolve => setTimeout(resolve, 200));

      const allEvents = env.systemEvents.getAllEvents();

      // Verify events are ordered by timestamp
      for (let i = 1; i < allEvents.length; i++) {
        expect(allEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          allEvents[i - 1].timestamp.getTime()
        );
      }

      // Verify all three systems have events
      const toolEvents = env.systemEvents.getEventsBySystem('tool');
      const permissionEvents = env.systemEvents.getEventsBySystem('permission');
      const browserEvents = env.systemEvents.getEventsBySystem('browser');

      expect(toolEvents.length).toBeGreaterThan(5);
      expect(permissionEvents.length).toBeGreaterThan(5);
      expect(browserEvents.length).toBeGreaterThan(3);
    }, 15000);

    it('should handle event correlation across multiple concurrent workflows', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Execute multiple workflows concurrently
      const workflow1 = (async () => {
        await env!.toolSystem.executor.execute('Read', { filePath: '/workflow1/input.txt' });
        await env!.browserSystem.tool.execute({
          operation: 'navigate',
          params: { url: 'https://workflow1.com' }
        });
        await env!.toolSystem.executor.execute('Write', {
          filePath: '/workflow1/output.txt',
          content: 'workflow1 result'
        });
      })();

      const workflow2 = (async () => {
        await env!.toolSystem.executor.execute('Read', { filePath: '/workflow2/input.txt' });
        await env!.browserSystem.tool.execute({
          operation: 'click',
          params: { selector: '#workflow2-button' }
        });
        await env!.toolSystem.executor.execute('Write', {
          filePath: '/workflow2/output.txt',
          content: 'workflow2 result'
        });
      })();

      await Promise.all([workflow1, workflow2]);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify separate correlation groups exist
      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThanOrEqual(2);

      // Verify each workflow has its own correlated events
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(12); // 6 events per workflow

      // Check for proper system coverage in correlation
      assertCrossSystemEventPropagation(env, 'tool', 'browser', 'tool:execution:start');
    }, 15000);
  });

  describe('Concurrent Operations with Permission Checks', () => {
    it('should handle concurrent permission requests without race conditions', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'allow-once'
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Set up permission manager to require approval for each operation
      const mockCheckPermission = vi.fn()
        .mockResolvedValueOnce({
          allowed: true,
          level: 'allow-once',
          denialReason: null
        })
        .mockResolvedValueOnce({
          allowed: false,
          level: null,
          denialReason: 'Rate limit exceeded'
        })
        .mockResolvedValueOnce({
          allowed: true,
          level: 'allow-once',
          denialReason: null
        });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // Execute concurrent operations with permission checks
      const operations = [
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', {
          operation: 'navigate',
          params: { url: 'https://site1.com' }
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Write', 'write', {
          filePath: '/test1.txt',
          content: 'content1'
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'screenshot', {
          operation: 'screenshot',
          params: { fullPage: true }
        })
      ];

      const results = await Promise.all(operations);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify permission checks were called for each operation
      expect(mockCheckPermission).toHaveBeenCalledTimes(3);

      // Verify results match permission decisions
      expect(results[0].success).toBe(true); // First: allowed
      expect(results[1].success).toBe(false); // Second: denied
      expect(results[1].permissionDenied).toBe(true);
      expect(results[2].success).toBe(true); // Third: allowed

      // Verify permission events were emitted correctly
      const permissionEvents = env.systemEvents.getEventsBySystem('permission');

      const requestedEvents = permissionEvents.filter(e => e.type === 'permission:requested');
      const grantedEvents = permissionEvents.filter(e => e.type === 'permission:granted');
      const deniedEvents = permissionEvents.filter(e => e.type === 'permission:denied');

      expect(requestedEvents.length).toBe(3);
      expect(grantedEvents.length).toBe(2);
      expect(deniedEvents.length).toBe(1);
    }, 12000);

    it('should maintain system consistency during permission failures', async () => {
      env = await createPermissionDeniedScenario({
        deniedTools: ['Browser', 'Write'],
        blockedDomains: ['blocked.com']
      });

      env.systemEvents.start();

      // Attempt operations that will be denied
      const deniedOperations = [
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', {
          operation: 'navigate',
          params: { url: 'https://blocked.com' }
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Write', 'write', {
          filePath: '/blocked/file.txt',
          content: 'blocked content'
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'click', {
          operation: 'click',
          params: { selector: '#blocked-element' }
        })
      ];

      const results = await Promise.all(deniedOperations);
      await new Promise(resolve => setTimeout(resolve, 150));

      // All operations should be denied
      results.forEach(result => {
        assertPermissionEnforced(result, 'denied');
      });

      // Verify system remains stable
      assertTriSystemReady(env);

      // Verify permission denial events were properly recorded
      const allEvents = env.systemEvents.getAllEvents();
      const denialEvents = allEvents.filter(e => e.type === 'permission:denied');
      expect(denialEvents.length).toBeGreaterThanOrEqual(3);

      // Verify no browser operations actually executed
      const browserEvents = env.systemEvents.getEventsBySystem('browser');
      const browserCompleteEvents = browserEvents.filter(e => e.type === 'browser:operation:complete');
      expect(browserCompleteEvents.length).toBe(0);
    }, 10000);

    it('should handle mixed permission scenarios in concurrent operations', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          blockedDomains: ['restricted.com']
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Mock selective permission responses
      const mockCheckPermission = vi.fn()
        .mockImplementation(async (tool: string, options: { scope: string }) => {
          if (options.scope.includes('restricted.com')) {
            return {
              allowed: false,
              level: null,
              denialReason: 'Domain blocked'
            };
          }
          if (tool === 'Write' && options.scope.includes('readonly')) {
            return {
              allowed: false,
              level: null,
              denialReason: 'Read-only file'
            };
          }
          return {
            allowed: true,
            level: 'allow-once',
            denialReason: null
          };
        });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // Execute mixed operations - some allowed, some denied
      const operations = [
        env.toolSystem.executor.executeWithPermissionCheck('Read', 'read', {
          filePath: '/allowed/file.txt'
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', {
          operation: 'navigate',
          params: { url: 'https://restricted.com' }
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Write', 'write', {
          filePath: '/readonly/file.txt',
          content: 'attempt to write'
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Browser', 'screenshot', {
          operation: 'screenshot',
          params: { fullPage: true }
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Read', 'read', {
          filePath: '/another/allowed.txt'
        })
      ];

      const results = await Promise.all(operations);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify selective enforcement
      expect(results[0].success).toBe(true);  // Read allowed
      expect(results[1].success).toBe(false); // Browser blocked domain
      expect(results[1].permissionDenied).toBe(true);
      expect(results[2].success).toBe(false); // Write readonly
      expect(results[2].permissionDenied).toBe(true);
      expect(results[3].success).toBe(true);  // Browser screenshot allowed
      expect(results[4].success).toBe(true);  // Read allowed

      // Verify event flow consistency
      const allEvents = env.systemEvents.getAllEvents();
      const successEvents = allEvents.filter(e =>
        e.type === 'tool:execution:complete' || e.type === 'browser:operation:complete'
      );
      const errorEvents = allEvents.filter(e =>
        e.type === 'tool:execution:error' || e.type === 'browser:operation:error'
      );

      expect(successEvents.length).toBe(3); // 3 allowed operations
      expect(errorEvents.length).toBe(2);   // 2 denied operations
    }, 15000);
  });

  describe('Event Ordering Validation', () => {
    it('should maintain strict event ordering for sequential operations', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Execute operations sequentially
      await env.toolSystem.executor.execute('Read', { filePath: '/step1.txt' });
      await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://step2.com' }
      });
      await env.toolSystem.executor.execute('Write', {
        filePath: '/step3.txt',
        content: 'step3 data'
      });
      await env.browserSystem.tool.execute({
        operation: 'click',
        params: { selector: '#step4' }
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const allEvents = env.systemEvents.getAllEvents();

      // Find key events for each step
      const step1Start = allEvents.find(e =>
        e.type === 'tool:execution:start' && e.data?.params?.filePath === '/step1.txt'
      );
      const step1Complete = allEvents.find(e =>
        e.type === 'tool:execution:complete' &&
        e.data?.result?.metadata?.tool === 'Read'
      );

      const step2Start = allEvents.find(e =>
        e.type === 'browser:operation:start' && e.data?.operation === 'navigate'
      );
      const step2Complete = allEvents.find(e =>
        e.type === 'browser:operation:complete' && e.data?.operation === 'navigate'
      );

      const step3Start = allEvents.find(e =>
        e.type === 'tool:execution:start' && e.data?.params?.filePath === '/step3.txt'
      );

      const step4Start = allEvents.find(e =>
        e.type === 'browser:operation:start' && e.data?.operation === 'click'
      );

      // Verify ordering: step1 complete < step2 start < step2 complete < step3 start < step4 start
      expect(step1Start).toBeDefined();
      expect(step1Complete).toBeDefined();
      expect(step2Start).toBeDefined();
      expect(step2Complete).toBeDefined();
      expect(step3Start).toBeDefined();
      expect(step4Start).toBeDefined();

      if (step1Complete && step2Start && step2Complete && step3Start && step4Start) {
        expect(step1Complete.timestamp.getTime()).toBeLessThanOrEqual(step2Start.timestamp.getTime());
        expect(step2Complete.timestamp.getTime()).toBeLessThanOrEqual(step3Start.timestamp.getTime());
        expect(step3Start.timestamp.getTime()).toBeLessThan(step4Start.timestamp.getTime());
      }
    }, 12000);

    it('should handle event ordering with permission delays', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Mock permission manager with artificial delays
      const mockCheckPermission = vi.fn().mockImplementation(async (tool: string, options: any) => {
        // Simulate permission check delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          allowed: true,
          level: 'allow-once',
          denialReason: null
        };
      });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // Execute operations that require permission checks
      await env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', {
        operation: 'navigate',
        params: { url: 'https://test1.com' }
      });

      await env.toolSystem.executor.executeWithPermissionCheck('Write', 'write', {
        filePath: '/test1.txt',
        content: 'content1'
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const allEvents = env.systemEvents.getAllEvents();

      // Find permission events for verification
      const permissionRequests = allEvents.filter(e => e.type === 'permission:requested');
      const permissionGrants = allEvents.filter(e => e.type === 'permission:granted');
      const toolStarts = allEvents.filter(e => e.type === 'tool:execution:start');

      expect(permissionRequests.length).toBe(2);
      expect(permissionGrants.length).toBe(2);

      // Verify each permission request is followed by grant before tool execution
      permissionRequests.forEach((request, index) => {
        const correspondingGrant = permissionGrants[index];
        const correspondingStart = toolStarts[index];

        if (correspondingGrant && correspondingStart) {
          expect(request.timestamp.getTime()).toBeLessThan(correspondingGrant.timestamp.getTime());
          expect(correspondingGrant.timestamp.getTime()).toBeLessThanOrEqual(correspondingStart.timestamp.getTime());
        }
      });
    }, 15000);
  });

  describe('System State Consistency', () => {
    it('should maintain consistent state across concurrent system failures', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Simulate system failures
      env.toolSystem.mocks.read.mockRejectedValue(new Error('File system failure'));
      env.browserSystem.mockPage.goto.mockRejectedValue(new Error('Navigation failure'));

      const mockCheckPermission = vi.fn().mockRejectedValue(new Error('Permission system failure'));
      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // Execute operations that will fail
      const failingOperations = [
        env.toolSystem.executor.execute('Read', { filePath: '/failing.txt' }),
        env.browserSystem.tool.execute({
          operation: 'navigate',
          params: { url: 'https://failing.com' }
        }),
        env.toolSystem.executor.executeWithPermissionCheck('Write', 'write', {
          filePath: '/test.txt',
          content: 'content'
        })
      ];

      const results = await Promise.all(failingOperations.map(op =>
        op.catch(error => ({ success: false, error: error.message }))
      ));

      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify system remains stable despite failures
      assertTriSystemReady(env);

      // Verify error events were captured
      const allEvents = env.systemEvents.getAllEvents();
      const errorEvents = allEvents.filter(e =>
        e.type.includes('error') || e.type.includes('failed')
      );
      expect(errorEvents.length).toBeGreaterThan(0);

      // Verify no dangling operations
      const startEvents = allEvents.filter(e => e.type.endsWith(':start'));
      const endEvents = allEvents.filter(e =>
        e.type.endsWith(':complete') || e.type.endsWith(':error')
      );

      // Each started operation should have a corresponding end event
      expect(endEvents.length).toBeGreaterThanOrEqual(startEvents.length - 1); // Allow for one permission failure
    }, 12000);

    it('should handle state consistency during partial system recovery', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      // Initially fail browser operations
      env.browserSystem.mockPage.goto.mockRejectedValueOnce(new Error('Initial failure'));
      env.browserSystem.mockPage.goto.mockResolvedValue({ status: () => 200 });

      // Execute operations - first browser op fails, second succeeds
      const operation1 = env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://test1.com' }
      });

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for first op to fail

      const operation2 = env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://test2.com' }
      });

      const toolOperation = env.toolSystem.executor.execute('Read', {
        filePath: '/recovery.txt'
      });

      const [result1, result2, result3] = await Promise.all([
        operation1.catch(e => ({ success: false, error: e.message })),
        operation2,
        toolOperation
      ]);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify mixed results
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verify system recovered and maintained consistency
      assertTriSystemReady(env);

      const allEvents = env.systemEvents.getAllEvents();
      const browserEvents = env.systemEvents.getEventsBySystem('browser');
      const toolEvents = env.systemEvents.getEventsBySystem('tool');

      // Should have both error and success events for browser
      const browserErrors = browserEvents.filter(e => e.type === 'browser:operation:error');
      const browserSuccess = browserEvents.filter(e => e.type === 'browser:operation:complete');

      expect(browserErrors.length).toBe(1);
      expect(browserSuccess.length).toBe(1);
      expect(toolEvents.length).toBeGreaterThan(0);
    }, 15000);

    it('should maintain event correlation integrity across system state changes', async () => {
      env = await createTriSystemTestEnvironment({
        eventConfig: {
          captureAll: true,
          enableCorrelation: true,
          maxEvents: 50
        }
      });

      env.systemEvents.start();

      // Execute a series of correlated operations
      const correlatedWorkflow = async (workflowId: string) => {
        await env!.toolSystem.executor.execute('Read', {
          filePath: `/workflow/${workflowId}/input.txt`
        });

        await env!.browserSystem.tool.execute({
          operation: 'navigate',
          params: { url: `https://${workflowId}.com` }
        });

        await env!.toolSystem.executor.execute('Write', {
          filePath: `/workflow/${workflowId}/output.txt`,
          content: `${workflowId} completed`
        });
      };

      // Execute multiple workflows
      await Promise.all([
        correlatedWorkflow('workflow1'),
        correlatedWorkflow('workflow2'),
        correlatedWorkflow('workflow3')
      ]);

      await new Promise(resolve => setTimeout(resolve, 200));

      const correlatedGroups = env.systemEvents.correlatedEvents;
      expect(correlatedGroups.length).toBeGreaterThanOrEqual(3);

      // Verify each correlation group maintains integrity
      correlatedGroups.forEach(group => {
        expect(group.events.length).toBeGreaterThan(0);
        expect(group.systems.size).toBeGreaterThan(0);
        expect(group.startTime).toBeDefined();
        expect(group.endTime).toBeDefined();
        expect(group.correlationId).toBeDefined();

        // Events within group should be properly ordered
        for (let i = 1; i < group.events.length; i++) {
          expect(group.events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            group.events[i - 1].timestamp.getTime()
          );
        }
      });

      // Verify cross-system propagation worked correctly
      assertCrossSystemEventPropagation(env, 'tool', 'browser', 'tool:execution:start');
    }, 18000);
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle complex multi-system workflow with error recovery', async () => {
      env = await createFullAutonomyScenario();
      env.systemEvents.start();

      // Step 1: Read configuration (success)
      const configResult = await env.toolSystem.executor.execute('Read', {
        filePath: '/config/settings.json'
      });
      expect(configResult.success).toBe(true);

      // Step 2: Navigate to website (simulate failure then recovery)
      env.browserSystem.mockPage.goto
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue({ status: () => 200 });

      const navResult1 = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://api.example.com' }
      }).catch(e => ({ success: false, error: e.message }));
      expect(navResult1.success).toBe(false);

      // Retry navigation (should succeed)
      const navResult2 = await env.browserSystem.tool.execute({
        operation: 'navigate',
        params: { url: 'https://api.example.com' }
      });
      expect(navResult2.success).toBe(true);

      // Step 3: Extract data
      const extractResult = await env.browserSystem.tool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      expect(extractResult.success).toBe(true);

      // Step 4: Save results
      const saveResult = await env.toolSystem.executor.execute('Write', {
        filePath: '/output/results.json',
        content: JSON.stringify({ title: 'Extracted Data', success: true })
      });
      expect(saveResult.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify complete workflow was captured
      const allEvents = env.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(10);

      // Verify recovery was captured
      const browserErrors = env.systemEvents.getEventsBySystem('browser')
        .filter(e => e.type === 'browser:operation:error');
      const browserSuccess = env.systemEvents.getEventsBySystem('browser')
        .filter(e => e.type === 'browser:operation:complete');

      expect(browserErrors.length).toBe(1); // One failure
      expect(browserSuccess.length).toBe(2); // Two successes (retry + extract)
    }, 20000);

    it('should coordinate events during permission escalation workflow', async () => {
      env = await createTriSystemTestEnvironment({
        permissionConfig: {
          preset: 'selective',
          defaultLevel: 'deny'
        },
        eventConfig: {
          captureAll: true,
          enableCorrelation: true
        }
      });

      env.systemEvents.start();

      let permissionLevel = 'deny';
      const mockCheckPermission = vi.fn().mockImplementation(async (tool: string) => {
        if (permissionLevel === 'deny') {
          return {
            allowed: false,
            level: null,
            denialReason: 'Permission denied - escalation required'
          };
        }
        return {
          allowed: true,
          level: 'allow-once',
          denialReason: null
        };
      });

      env.permissionSystem.manager.checkToolPermission = mockCheckPermission;

      // Attempt 1: Should be denied
      const result1 = await env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', {
        operation: 'navigate',
        params: { url: 'https://restricted.com' }
      });
      expect(result1.success).toBe(false);
      expect(result1.permissionDenied).toBe(true);

      // Simulate permission escalation
      permissionLevel = 'allow-once';

      // Attempt 2: Should succeed after escalation
      const result2 = await env.toolSystem.executor.executeWithPermissionCheck('Browser', 'navigate', {
        operation: 'navigate',
        params: { url: 'https://restricted.com' }
      });
      expect(result2.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify permission escalation flow in events
      const permissionEvents = env.systemEvents.getEventsBySystem('permission');
      const deniedEvents = permissionEvents.filter(e => e.type === 'permission:denied');
      const grantedEvents = permissionEvents.filter(e => e.type === 'permission:granted');

      expect(deniedEvents.length).toBe(1);
      expect(grantedEvents.length).toBe(1);

      // Verify the timeline: denied -> granted -> successful operation
      const allEvents = env.systemEvents.getAllEvents();
      const deniedEvent = allEvents.find(e => e.type === 'permission:denied');
      const grantedEvent = allEvents.find(e => e.type === 'permission:granted');
      const successEvent = allEvents.find(e =>
        e.type === 'browser:operation:complete' && e.data?.operation === 'navigate'
      );

      expect(deniedEvent).toBeDefined();
      expect(grantedEvent).toBeDefined();
      expect(successEvent).toBeDefined();

      if (deniedEvent && grantedEvent && successEvent) {
        expect(deniedEvent.timestamp.getTime()).toBeLessThan(grantedEvent.timestamp.getTime());
        expect(grantedEvent.timestamp.getTime()).toBeLessThan(successEvent.timestamp.getTime());
      }
    }, 15000);
  });
});