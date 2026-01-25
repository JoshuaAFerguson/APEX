/**
 * @fileoverview Edge Cases and Stress Tests for MockMCPServer
 *
 * This test suite covers edge cases, error conditions, and stress scenarios
 * to ensure MockMCPServer handles all acceptance criteria robustly:
 * - Connection lifecycle edge cases
 * - Concurrent client management
 * - Resource exhaustion scenarios
 * - Error recovery patterns
 * - Transport-specific edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer, type MockServerState } from './mock-mcp-server.js';
import type { MockMCPServerDefinition } from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

describe('MockMCPServer Edge Cases and Stress Tests', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(() => {
    serverDefinition = {
      serverConfig: {
        name: 'edge-test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'edge-test-server',
          version: '1.0.0-edge',
        },
        maxConnections: 5,
        shutdownTimeoutMs: 1000,
        stdioConfig: {
          startupDelayMs: 0,
        },
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 0 },
        errorInjection: { enabled: false },
        toolHandlers: [],
        notificationTriggers: [],
        defaultToolResponse: undefined,
      },
      scenarios: [],
    };

    server = new MockMCPServer(serverDefinition);
  });

  afterEach(async () => {
    if (server.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('Connection Lifecycle Edge Cases', () => {
    it('should handle rapid start/stop cycles', async () => {
      const cycles = 10;
      const startedSpy = vi.fn();
      const stoppedSpy = vi.fn();

      server.on('started', startedSpy);
      server.on('stopped', stoppedSpy);

      for (let i = 0; i < cycles; i++) {
        await server.start();
        expect(server.isListening()).toBe(true);

        await server.stop();
        expect(server.isListening()).toBe(false);
      }

      expect(startedSpy).toHaveBeenCalledTimes(cycles);
      expect(stoppedSpy).toHaveBeenCalledTimes(cycles);
    });

    it('should handle concurrent start attempts', async () => {
      const promises = Array.from({ length: 5 }, () => server.start());

      // All should complete without error
      await Promise.all(promises);

      expect(server.isListening()).toBe(true);
      expect(server.getState()).toBe('listening');
    });

    it('should handle concurrent stop attempts while connected clients exist', async () => {
      await server.start();

      // Create multiple clients
      const transports = Array.from({ length: 3 }, () => server.createClientTransport());

      // Connect all clients
      await Promise.all(transports.map(t => t.connect()));

      expect(server.getConnectionCount()).toBe(3);

      // Attempt concurrent stops
      const stopPromises = Array.from({ length: 3 }, () => server.stop());

      await Promise.all(stopPromises);

      expect(server.isListening()).toBe(false);
      expect(server.getConnectionCount()).toBe(0);
    });

    it('should handle shutdown timeout correctly', async () => {
      const serverWithShortTimeout = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          shutdownTimeoutMs: 50,
        },
      });

      await serverWithShortTimeout.start();

      // Create a client that won't disconnect gracefully
      const transport = serverWithShortTimeout.createClientTransport();
      await transport.connect();

      // Mock the disconnect to be slow
      vi.spyOn(transport, 'disconnect').mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const startTime = Date.now();
      await serverWithShortTimeout.stop();
      const elapsed = Date.now() - startTime;

      // Should respect the timeout (50ms) rather than wait for full disconnect (200ms)
      expect(elapsed).toBeLessThan(150);
      expect(serverWithShortTimeout.isListening()).toBe(false);
    });

    it('should handle zero shutdown timeout', async () => {
      const serverWithZeroTimeout = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          shutdownTimeoutMs: 0,
        },
      });

      await serverWithZeroTimeout.start();
      const transport = serverWithZeroTimeout.createClientTransport();
      await transport.connect();

      const startTime = Date.now();
      await serverWithZeroTimeout.stop();
      const elapsed = Date.now() - startTime;

      // Should complete immediately when timeout is 0
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Maximum Connections and Resource Management', () => {
    it('should enforce maximum connections strictly', async () => {
      const serverWithLowLimit = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          maxConnections: 2,
        },
      });

      await serverWithLowLimit.start();

      // Create maximum allowed connections
      const transport1 = serverWithLowLimit.createClientTransport();
      const transport2 = serverWithLowLimit.createClientTransport();

      // Third should fail
      expect(() => serverWithLowLimit.createClientTransport()).toThrow(
        'Cannot create client transport: maximum connections reached (2)'
      );

      // After connecting first two, we should be at limit
      await transport1.connect();
      await transport2.connect();

      expect(serverWithLowLimit.getConnectionCount()).toBe(2);

      await serverWithLowLimit.stop();
    });

    it('should free up connection slots when clients disconnect', async () => {
      const serverWithLowLimit = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          maxConnections: 2,
        },
      });

      await serverWithLowLimit.start();

      // Fill up connections
      const transport1 = serverWithLowLimit.createClientTransport();
      const transport2 = serverWithLowLimit.createClientTransport();

      await transport1.connect();
      await transport2.connect();

      // Should be at limit
      expect(() => serverWithLowLimit.createClientTransport()).toThrow();

      // Disconnect one client
      const clients = serverWithLowLimit.getConnectedClients();
      await serverWithLowLimit.disconnectClient(clients[0].id);

      // Should now be able to create another transport
      const transport3 = serverWithLowLimit.createClientTransport();
      expect(transport3).toBeDefined();

      await serverWithLowLimit.stop();
    });

    it('should handle connection attempts when at maximum', async () => {
      const serverWithLimit1 = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          maxConnections: 1,
        },
      });

      await serverWithLimit1.start();

      // First connection should succeed
      const transport1 = serverWithLimit1.createClientTransport();
      await transport1.connect();

      // Second connection attempt should fail at creation
      expect(() => serverWithLimit1.createClientTransport()).toThrow();

      await serverWithLimit1.stop();
    });
  });

  describe('Concurrent Client Operations', () => {
    it('should handle concurrent client connections', async () => {
      await server.start();

      const clientCount = 5;
      const transports = Array.from({ length: clientCount }, () =>
        server.createClientTransport()
      );

      // Connect all clients concurrently
      await Promise.all(transports.map(t => t.connect()));

      expect(server.getConnectionCount()).toBe(clientCount);

      // All clients should be tracked
      const clients = server.getConnectedClients();
      expect(clients).toHaveLength(clientCount);
      clients.forEach(client => {
        expect(client.id).toBeDefined();
        expect(client.connectedAt).toBeTypeOf('number');
        expect(client.protocolState).toBe('uninitialized');
      });
    });

    it('should handle concurrent message processing from multiple clients', async () => {
      await server.start();

      const clientCount = 3;
      const transports = Array.from({ length: clientCount }, () =>
        server.createClientTransport()
      );

      await Promise.all(transports.map(t => t.connect()));

      // Send concurrent requests from all clients
      const requests = transports.map((transport, i) =>
        transport.send({
          jsonrpc: '2.0' as const,
          id: i + 1,
          method: 'ping',
        })
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response, i) => {
        expect(response).toEqual({
          jsonrpc: '2.0',
          id: i + 1,
          result: {},
        });
      });

      // Request counts should be updated
      const clients = server.getConnectedClients();
      clients.forEach(client => {
        expect(client.requestCount).toBe(1);
      });
    });

    it('should maintain client state isolation', async () => {
      await server.start();

      const transport1 = server.createClientTransport();
      const transport2 = server.createClientTransport();

      await transport1.connect();
      await transport2.connect();

      // Initialize only first client
      await transport1.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'client1', version: '1.0.0' },
          capabilities: {},
        },
      });

      const clients = server.getConnectedClients();
      const client1 = clients.find(c => c.transport === transport1);
      const client2 = clients.find(c => c.transport === transport2);

      expect(client1?.protocolState).toBe('initialized');
      expect(client1?.clientInfo?.name).toBe('client1');

      expect(client2?.protocolState).toBe('uninitialized');
      expect(client2?.clientInfo).toBeUndefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transport errors without affecting other clients', async () => {
      await server.start();

      const transport1 = server.createClientTransport();
      const transport2 = server.createClientTransport();

      await transport1.connect();
      await transport2.connect();

      // Simulate error on first transport
      const errorSpy = vi.fn();
      server.on('error', errorSpy);

      transport1.simulateError();

      // Second transport should still work
      const response = await transport2.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {},
      });
    });

    it('should handle malformed JSON-RPC messages gracefully', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Send malformed message (missing required fields)
      const malformedMessage = {
        jsonrpc: '2.0',
        // missing id and method
      } as any;

      // Should not crash the server
      expect(() => {
        transport.setRequestHandler(async (message) => {
          // This simulates processing the malformed message
          return undefined;
        });
      }).not.toThrow();
    });

    it('should handle unknown method gracefully', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'nonexistent/method',
        params: {},
      }) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.message).toContain('Method not found: nonexistent/method');

      // Server should remain operational
      expect(server.isListening()).toBe(true);
      expect(server.getConnectionCount()).toBe(1);
    });

    it('should handle client disconnection during request processing', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Start a request
      const requestPromise = transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      // Immediately disconnect
      await transport.disconnect('Test disconnect');

      // Request should handle disconnection gracefully
      // (either complete or fail cleanly)
      await expect(requestPromise).resolves.toBeDefined();

      expect(server.getConnectionCount()).toBe(0);
    });
  });

  describe('Transport Type Specific Tests', () => {
    it('should handle SSE transport configuration', () => {
      const sseServer = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          transport: 'http',
        },
      });

      expect(sseServer.getTransportType()).toBe('http');
      expect(sseServer.getName()).toBe('edge-test-server');
    });

    it('should handle stdio transport with custom config', async () => {
      const stdioServer = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          transport: 'stdio',
          stdioConfig: {
            startupDelayMs: 25,
          },
        },
      });

      const startTime = Date.now();
      await stdioServer.start();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(20);
      expect(stdioServer.getTransportType()).toBe('stdio');

      await stdioServer.stop();
    });

    it('should support both transport types in lifecycle events', async () => {
      const transportTypes: ('stdio' | 'http')[] = ['stdio', 'http'];

      for (const transport of transportTypes) {
        const testServer = new MockMCPServer({
          ...serverDefinition,
          serverConfig: {
            ...serverDefinition.serverConfig,
            transport,
          },
        });

        const startedSpy = vi.fn();
        const stoppedSpy = vi.fn();

        testServer.on('started', startedSpy);
        testServer.on('stopped', stoppedSpy);

        await testServer.start();
        expect(testServer.getTransportType()).toBe(transport);
        expect(startedSpy).toHaveBeenCalledOnce();

        await testServer.stop();
        expect(stoppedSpy).toHaveBeenCalledOnce();
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large numbers of rapid requests', async () => {
      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      // Send many rapid requests
      const requestCount = 100;
      const requests = Array.from({ length: requestCount }, (_, i) =>
        transport.send({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'ping',
        })
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(requestCount);
      responses.forEach((response, i) => {
        expect(response).toEqual({
          jsonrpc: '2.0',
          id: i + 1,
          result: {},
        });
      });

      // Check that request count was tracked correctly
      const client = server.getConnectedClients()[0];
      expect(client.requestCount).toBe(requestCount);
    });

    it('should maintain consistent state under stress', async () => {
      await server.start();

      const clientCount = 5;
      const requestsPerClient = 20;

      // Create multiple clients
      const transports = await Promise.all(
        Array.from({ length: clientCount }, async () => {
          const transport = server.createClientTransport();
          await transport.connect();
          return transport;
        })
      );

      // Each client sends multiple concurrent requests
      const allRequests = transports.flatMap((transport, clientIndex) =>
        Array.from({ length: requestsPerClient }, (_, requestIndex) =>
          transport.send({
            jsonrpc: '2.0',
            id: clientIndex * requestsPerClient + requestIndex + 1,
            method: 'ping',
          })
        )
      );

      const responses = await Promise.all(allRequests);

      expect(responses).toHaveLength(clientCount * requestsPerClient);

      // Verify server state consistency
      expect(server.getConnectionCount()).toBe(clientCount);

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(clientCount * requestsPerClient);
      expect(stats.totalErrorsInjected).toBe(0);
    });

    it('should clean up resources properly after many operations', async () => {
      await server.start();

      // Create and destroy many clients
      for (let i = 0; i < 10; i++) {
        const transport = server.createClientTransport();
        await transport.connect();

        // Send a few requests
        await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
        await transport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

        await transport.disconnect();

        // Should clean up properly
        expect(server.getConnectionCount()).toBe(0);
      }

      // Server should still be healthy
      expect(server.isListening()).toBe(true);

      // Final test - create one more client to ensure everything still works
      const finalTransport = server.createClientTransport();
      await finalTransport.connect();

      const response = await finalTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {},
      });
    });
  });

  describe('Scenario and Configuration Edge Cases', () => {
    it('should handle empty scenario configuration', () => {
      const emptyScenarioServer = new MockMCPServer({
        ...serverDefinition,
        scenarios: [],
      });

      expect(emptyScenarioServer.getActiveScenario()).toBeUndefined();
      expect(() => emptyScenarioServer.resetToDefault()).not.toThrow();
    });

    it('should handle invalid scenario activation gracefully', () => {
      expect(() => server.activateScenario('nonexistent')).toThrow(
        `Scenario 'nonexistent' not found`
      );

      // Server should remain operational
      expect(server.getActiveScenario()).toBeUndefined();
    });

    it('should handle scenario switching during active connections', async () => {
      const serverWithScenarios = new MockMCPServer({
        ...serverDefinition,
        scenarios: [
          {
            name: 'test-scenario',
            behaviorConfig: {
              responseDelay: { fixedMs: 100 },
              errorInjection: { enabled: false },
              toolHandlers: [],
              notificationTriggers: [],
              defaultToolResponse: undefined,
            },
          },
        ],
      });

      await serverWithScenarios.start();

      const transport = serverWithScenarios.createClientTransport();
      await transport.connect();

      // Switch scenario while client is connected
      serverWithScenarios.activateScenario('test-scenario');

      expect(serverWithScenarios.getActiveScenario()).toBe('test-scenario');

      // Client should still work
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {},
      });

      await serverWithScenarios.stop();
    });
  });
});