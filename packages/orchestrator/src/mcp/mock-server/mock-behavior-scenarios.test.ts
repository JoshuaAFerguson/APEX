/**
 * @fileoverview Behavior Engine Scenario Tests for MockMCPServer
 *
 * This test suite validates complex behavior scenarios and state machine
 * transitions in the MockMCPServer behavior engine:
 * - State machine transitions with complex conditions
 * - Error injection patterns
 * - Notification triggering scenarios
 * - Tool handler matching and execution
 * - Response delay calculations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type { MockMCPServerDefinition, MockBehaviorConfig } from '@apexcli/core';
import type { JSONRPCRequest } from '../types.js';

describe('MockMCPServer Behavior Engine Scenarios', () => {
  let server: MockMCPServer;

  afterEach(async () => {
    if (server?.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('Complex State Machine Scenarios', () => {
    beforeEach(() => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'state-machine-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'state-machine-server', version: '1.0.0' },
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          responseDelay: { fixedMs: 0 },
          errorInjection: { enabled: false },
          toolHandlers: [],
          notificationTriggers: [],
          defaultToolResponse: undefined,
          statefulBehavior: {
            initialState: 'idle',
            stateBehaviors: [
              {
                state: 'processing',
                responseDelay: { fixedMs: 100 },
                toolHandlers: [
                  {
                    toolName: 'status-check',
                    response: {
                      content: [{ type: 'text', text: 'Processing in progress...' }],
                      isError: false,
                    },
                  },
                ],
              },
              {
                state: 'error',
                errorInjection: {
                  enabled: true,
                  probability: 1.0,
                  methods: [],
                  afterRequestCount: 0,
                  maxErrors: 0,
                  errorCode: -32000,
                  errorMessage: 'System in error state',
                  simulateConnectionFailure: false,
                },
              },
              {
                state: 'maintenance',
                responseDelay: { fixedMs: 500 },
                toolHandlers: [
                  {
                    toolName: 'maintenance-status',
                    response: {
                      content: [{ type: 'text', text: 'System under maintenance' }],
                      isError: false,
                    },
                  },
                ],
              },
            ],
            transitions: [
              {
                from: 'idle',
                to: 'processing',
                onMethod: 'tools/call',
                whenArgs: { operation: 'start' },
              },
              {
                from: 'processing',
                to: 'idle',
                onMethod: 'tools/call',
                whenArgs: { operation: 'complete' },
              },
              {
                from: 'idle',
                to: 'error',
                onMethod: 'tools/call',
                whenArgs: { operation: 'error' },
              },
              {
                from: 'processing',
                to: 'error',
                onMethod: 'tools/call',
                whenArgs: { operation: 'error' },
              },
              {
                from: 'error',
                to: 'idle',
                onMethod: 'tools/call',
                whenArgs: { operation: 'reset' },
              },
              {
                from: 'idle',
                to: 'maintenance',
                onMethod: 'tools/call',
                whenArgs: { operation: 'maintenance' },
              },
              {
                from: 'maintenance',
                to: 'idle',
                onMethod: 'tools/call',
                whenArgs: { operation: 'maintenance-complete' },
              },
            ],
          },
        },
        scenarios: [],
      };

      server = new MockMCPServer(definition);
    });

    it('should handle complex state transitions', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const stateChangeSpy = vi.fn();
      server.on('state:change', stateChangeSpy);

      // Start in idle state
      expect(server.getStats().currentState).toBe('idle');

      // Transition to processing
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'start-operation',
          arguments: { operation: 'start' },
        },
      });

      expect(stateChangeSpy).toHaveBeenCalledWith('idle', 'processing', 'tools/call');
      expect(server.getStats().currentState).toBe('processing');

      // In processing state, status-check should give processing response
      const statusResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'status-check',
          arguments: {},
        },
      });

      expect(statusResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: 'Processing in progress...' }],
          isError: false,
        },
      });

      // Complete the operation
      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'complete-operation',
          arguments: { operation: 'complete' },
        },
      });

      expect(stateChangeSpy).toHaveBeenCalledWith('processing', 'idle', 'tools/call');
      expect(server.getStats().currentState).toBe('idle');
    });

    it('should handle error state transitions and recovery', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Transition to error state
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'trigger-error',
          arguments: { operation: 'error' },
        },
      });

      expect(server.getStats().currentState).toBe('error');

      // In error state, requests should fail
      const errorResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'any-operation',
          arguments: {},
        },
      });

      expect(errorResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32000,
          message: 'System in error state',
        },
      });

      // Reset to recover
      const resetResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'reset-system',
          arguments: { operation: 'reset' },
        },
      });

      expect(server.getStats().currentState).toBe('idle');

      // Should work normally now
      expect(resetResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: expect.any(Object),
      });
    });

    it('should handle maintenance state with delays', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Enter maintenance state
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'enter-maintenance',
          arguments: { operation: 'maintenance' },
        },
      });

      expect(server.getStats().currentState).toBe('maintenance');

      // Operations should be slower in maintenance mode
      const start = Date.now();
      const maintenanceResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'maintenance-status',
          arguments: {},
        },
      });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(450); // Should have 500ms delay
      expect(maintenanceResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: 'System under maintenance' }],
          isError: false,
        },
      });

      // Exit maintenance
      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'exit-maintenance',
          arguments: { operation: 'maintenance-complete' },
        },
      });

      expect(server.getStats().currentState).toBe('idle');
    });
  });

  describe('Advanced Error Injection Scenarios', () => {
    beforeEach(() => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'error-injection-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'error-injection-server', version: '1.0.0' },
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          responseDelay: { fixedMs: 0 },
          errorInjection: {
            enabled: true,
            probability: 0.3,
            methods: ['tools/call'],
            afterRequestCount: 2,
            maxErrors: 3,
            errorCode: -32603,
            errorMessage: 'Simulated random error',
            errorDelayMs: 50,
            simulateConnectionFailure: false,
          },
          toolHandlers: [
            {
              toolName: 'reliable-tool',
              response: {
                content: [{ type: 'text', text: 'This tool always works' }],
                isError: false,
              },
            },
          ],
          notificationTriggers: [],
          defaultToolResponse: {
            content: [{ type: 'text', text: 'Default response' }],
            isError: false,
          },
        },
        scenarios: [
          {
            name: 'high-error-mode',
            behaviorConfig: {
              responseDelay: { fixedMs: 0 },
              errorInjection: {
                enabled: true,
                probability: 0.8,
                methods: ['tools/call'],
                afterRequestCount: 0,
                maxErrors: 0,
                errorCode: -32000,
                errorMessage: 'High error rate scenario',
                simulateConnectionFailure: false,
              },
              toolHandlers: [],
              notificationTriggers: [],
              defaultToolResponse: undefined,
            },
          },
        ],
      };

      server = new MockMCPServer(definition);
    });

    it('should respect error injection probability and limits', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const errorSpy = vi.fn();
      server.on('error:injected', errorSpy);

      // First two requests should not have errors (afterRequestCount: 2)
      const earlyResults = await Promise.all([
        transport.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'test-tool', arguments: {} },
        }),
        transport.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'test-tool', arguments: {} },
        }),
      ]);

      earlyResults.forEach(result => {
        expect(result).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });
      });

      expect(errorSpy).not.toHaveBeenCalled();

      // Subsequent requests might have errors (probability 0.3)
      const laterRequests = Array.from({ length: 20 }, (_, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: i + 10,
          method: 'tools/call',
          params: { name: 'test-tool', arguments: {} },
        })
      );

      const laterResults = await Promise.allSettled(laterRequests);

      const successCount = laterResults.filter(r => r.status === 'fulfilled').length;
      const errorCount = laterResults.filter(r => r.status === 'rejected').length;

      // Should have some errors, but not all (probability 0.3, maxErrors 3)
      expect(errorCount).toBeGreaterThan(0);
      expect(errorCount).toBeLessThanOrEqual(3);
      expect(successCount).toBeGreaterThan(0);

      const stats = server.getStats();
      expect(stats.totalErrorsInjected).toBeLessThanOrEqual(3);
    });

    it('should handle scenario-based error injection', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Normal mode first
      const normalResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'reliable-tool', arguments: {} },
      });

      expect(normalResponse).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: 'This tool always works' }],
          isError: false,
        },
      });

      // Switch to high error mode
      server.activateScenario('high-error-mode');

      // Should now have high error rate
      const highErrorRequests = Array.from({ length: 10 }, (_, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: i + 10,
          method: 'tools/call',
          params: { name: 'test-tool', arguments: {} },
        })
      );

      const highErrorResults = await Promise.allSettled(highErrorRequests);

      const errorRate = highErrorResults.filter(r => r.status === 'rejected').length / 10;

      // With 0.8 probability, should have high error rate
      expect(errorRate).toBeGreaterThan(0.5);
    });

    it('should handle error injection with delays', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Make enough requests to trigger error injection
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'test-tool', arguments: {} },
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'test-tool', arguments: {} },
      });

      // Mock random to ensure error injection
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.1); // Less than 0.3 probability

      try {
        const errorStart = Date.now();
        const errorResult = await transport.send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'test-tool', arguments: {} },
        });
        const errorDuration = Date.now() - errorStart;

        // Should be an error response with delay
        expect(errorResult).toMatchObject({
          jsonrpc: '2.0',
          id: 3,
          error: {
            code: -32603,
            message: 'Simulated random error',
          },
        });

        // Should have taken at least the error delay time
        expect(errorDuration).toBeGreaterThanOrEqual(40);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('Complex Notification Scenarios', () => {
    beforeEach(() => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'notification-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'notification-server', version: '1.0.0' },
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          responseDelay: { fixedMs: 0 },
          errorInjection: { enabled: false },
          toolHandlers: [
            {
              toolName: 'process-data',
              response: {
                content: [{ type: 'text', text: 'Data processed successfully' }],
                isError: false,
              },
            },
          ],
          notificationTriggers: [
            {
              condition: 'after_method',
              conditionValue: 'tools/call',
              method: 'notifications/tool-completed',
              params: { status: 'success' },
              once: false,
              delayMs: 100,
            },
            {
              condition: 'after_request_count',
              conditionValue: '3',
              method: 'notifications/milestone',
              params: { milestone: '3-requests' },
              once: true,
              delayMs: 50,
            },
            {
              condition: 'periodic',
              conditionValue: '2',
              method: 'notifications/heartbeat',
              params: { timestamp: Date.now() },
              once: false,
              delayMs: 0,
            },
            {
              condition: 'after_delay',
              conditionValue: '200',
              method: 'notifications/timer',
              params: { message: 'Timer expired' },
              once: true,
              delayMs: 0,
            },
          ],
          defaultToolResponse: undefined,
        },
        scenarios: [],
      };

      server = new MockMCPServer(definition);
    });

    it('should handle complex notification triggering patterns', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const notificationSpy = vi.fn();
      server.on('notification:sent', notificationSpy);

      // First tool call - should trigger after_method notification
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'process-data', arguments: { data: 'test1' } },
      });

      // Second tool call - should trigger after_method and periodic (2nd request)
      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'process-data', arguments: { data: 'test2' } },
      });

      // Third tool call - should trigger after_method, after_request_count, and periodic (4th overall request including __connect__)
      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'process-data', arguments: { data: 'test3' } },
      });

      // Wait for all notifications to be sent
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(notificationSpy).toHaveBeenCalled();

      const notifications = notificationSpy.mock.calls.map(call => call[0]);

      // Should have after_method notifications for each tool call
      const toolCompletedNotifications = notifications.filter(n =>
        n.method === 'notifications/tool-completed'
      );
      expect(toolCompletedNotifications).toHaveLength(3);

      // Should have milestone notification after 3rd request
      const milestoneNotifications = notifications.filter(n =>
        n.method === 'notifications/milestone'
      );
      expect(milestoneNotifications).toHaveLength(1);

      // Should have periodic notifications
      const heartbeatNotifications = notifications.filter(n =>
        n.method === 'notifications/heartbeat'
      );
      expect(heartbeatNotifications.length).toBeGreaterThan(0);
    });

    it('should handle timer-based notifications', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const notificationSpy = vi.fn();
      server.on('notification:sent', notificationSpy);

      // Wait for timer notification (after_delay: 200ms)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Check any method to trigger notification check
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      const notifications = notificationSpy.mock.calls.map(call => call[0]);
      const timerNotifications = notifications.filter(n =>
        n.method === 'notifications/timer'
      );

      expect(timerNotifications).toHaveLength(1);
      expect(timerNotifications[0].params).toEqual({ message: 'Timer expired' });
    });

    it('should handle once-only notifications correctly', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const notificationSpy = vi.fn();
      server.on('notification:sent', notificationSpy);

      // Trigger milestone multiple times
      for (let i = 0; i < 6; i++) {
        await transport.send({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'tools/call',
          params: { name: 'process-data', arguments: { data: `test${i}` } },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      const notifications = notificationSpy.mock.calls.map(call => call[0]);
      const milestoneNotifications = notifications.filter(n =>
        n.method === 'notifications/milestone'
      );

      // Should only fire once, even though we passed the threshold multiple times
      expect(milestoneNotifications).toHaveLength(1);
    });
  });

  describe('Advanced Tool Handler Scenarios', () => {
    beforeEach(() => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'tool-handler-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'tool-handler-server', version: '1.0.0' },
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          responseDelay: { fixedMs: 0 },
          errorInjection: { enabled: false },
          toolHandlers: [
            {
              toolName: 'file-operations',
              matchArgs: { operation: 'read', format: 'json' },
              response: {
                content: [{ type: 'text', text: '{"data": "json file content"}' }],
                isError: false,
              },
            },
            {
              toolName: 'file-operations',
              matchArgs: { operation: 'read', format: 'text' },
              response: {
                content: [{ type: 'text', text: 'Plain text file content' }],
                isError: false,
              },
            },
            {
              toolName: 'file-operations',
              matchArgs: { operation: 'write' },
              response: {
                content: [{ type: 'text', text: 'File written successfully' }],
                isError: false,
              },
            },
            {
              toolName: 'limited-tool',
              maxInvocations: 2,
              response: {
                content: [{ type: 'text', text: 'Limited resource accessed' }],
                isError: false,
              },
            },
            {
              toolName: 'complex-matcher',
              matchArgs: {
                config: {
                  database: { host: 'localhost', port: 5432 },
                  auth: { type: 'oauth' },
                },
                options: ['verbose', 'strict'],
              },
              response: {
                content: [{ type: 'text', text: 'Complex match successful' }],
                isError: false,
              },
            },
          ],
          notificationTriggers: [],
          defaultToolResponse: {
            content: [{ type: 'text', text: 'Fallback response' }],
            isError: false,
          },
        },
        scenarios: [],
      };

      server = new MockMCPServer(definition);
    });

    it('should handle complex argument matching', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Test JSON file read
      const jsonResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'file-operations',
          arguments: {
            operation: 'read',
            format: 'json',
            path: '/data.json',
          },
        },
      });

      expect(jsonResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: '{"data": "json file content"}' }],
          isError: false,
        },
      });

      // Test text file read
      const textResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'file-operations',
          arguments: {
            operation: 'read',
            format: 'text',
            path: '/readme.txt',
          },
        },
      });

      expect(textResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: 'Plain text file content' }],
          isError: false,
        },
      });

      // Test write operation
      const writeResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'file-operations',
          arguments: {
            operation: 'write',
            path: '/output.txt',
            content: 'Hello world',
          },
        },
      });

      expect(writeResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: {
          content: [{ type: 'text', text: 'File written successfully' }],
          isError: false,
        },
      });
    });

    it('should enforce tool invocation limits', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // First two invocations should succeed
      const first = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'limited-tool', arguments: {} },
      });

      const second = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'limited-tool', arguments: {} },
      });

      expect(first).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: 'Limited resource accessed' }],
          isError: false,
        },
      });

      expect(second).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: 'Limited resource accessed' }],
          isError: false,
        },
      });

      // Third should fall back to default
      const third = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'limited-tool', arguments: {} },
      });

      expect(third).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: 'Fallback response' }],
          isError: false,
        },
      });
    });

    it('should handle deeply nested argument matching', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Exact match should work
      const exactMatch = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'complex-matcher',
          arguments: {
            config: {
              database: { host: 'localhost', port: 5432 },
              auth: { type: 'oauth' },
            },
            options: ['verbose', 'strict'],
            extra: 'ignored',
          },
        },
      });

      expect(exactMatch).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: 'Complex match successful' }],
          isError: false,
        },
      });

      // Partial mismatch should fall back to default
      const partialMismatch = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'complex-matcher',
          arguments: {
            config: {
              database: { host: 'localhost', port: 3306 }, // Wrong port
              auth: { type: 'oauth' },
            },
            options: ['verbose', 'strict'],
          },
        },
      });

      expect(partialMismatch).toMatchObject({
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: 'Fallback response' }],
          isError: false,
        },
      });
    });
  });
});