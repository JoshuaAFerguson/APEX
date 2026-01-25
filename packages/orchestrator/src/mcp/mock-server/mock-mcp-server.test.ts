/**
 * @fileoverview Tests for MockMCPServer - Base Mock MCP Server with Connection Lifecycle
 *
 * Tests the core MockMCPServer class functionality including:
 * - Server lifecycle management (start/stop)
 * - Client connection tracking and management
 * - Event emission for lifecycle events (connect, disconnect, error)
 * - Protocol message processing
 * - Support for both stdio and SSE transport simulation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer, type ConnectedClient, type MockServerState } from './mock-mcp-server.js';
import type { MockMCPServerDefinition, MockMCPServerConfig, MockBehaviorConfig } from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types.js';

describe('MockMCPServer', () => {
  let server: MockMCPServer;
  let serverDefinition: MockMCPServerDefinition;

  beforeEach(() => {
    serverDefinition = {
      serverConfig: {
        name: 'test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'test-server',
          version: '1.0.0',
        },
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
        stdioConfig: {
          startupDelayMs: 0,
        },
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 0 },
        errorInjection: { enabled: false },
        toolHandlers: [
          {
            toolName: 'test_tool',
            response: {
              content: [{ type: 'text', text: 'test response' }],
              isError: false,
            },
          },
        ],
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

  describe('Server Lifecycle', () => {
    it('should initialize in stopped state', () => {
      expect(server.getState()).toBe('stopped');
      expect(server.isListening()).toBe(false);
    });

    it('should start successfully and transition to listening state', async () => {
      const startedSpy = vi.fn();
      server.on('started', startedSpy);

      await server.start();

      expect(server.getState()).toBe('listening');
      expect(server.isListening()).toBe(true);
      expect(startedSpy).toHaveBeenCalledOnce();
    });

    it('should stop successfully and transition to stopped state', async () => {
      const stoppedSpy = vi.fn();
      server.on('stopped', stoppedSpy);

      await server.start();
      await server.stop();

      expect(server.getState()).toBe('stopped');
      expect(server.isListening()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledOnce();
    });

    it('should be idempotent for multiple start calls', async () => {
      await server.start();
      const state1 = server.getState();

      await server.start(); // Should be no-op
      const state2 = server.getState();

      expect(state1).toBe(state2);
      expect(state1).toBe('listening');
    });

    it('should be idempotent for multiple stop calls', async () => {
      await server.start();
      await server.stop();
      const state1 = server.getState();

      await server.stop(); // Should be no-op
      const state2 = server.getState();

      expect(state1).toBe(state2);
      expect(state1).toBe('stopped');
    });

    it('should throw error when starting from invalid state', async () => {
      // Force the server into an invalid state
      (server as any).serverState = 'starting';

      await expect(server.start()).rejects.toThrow(
        `Cannot start server in state 'starting'. Must be 'stopped'.`
      );
    });

    it('should handle stdio startup delay', async () => {
      const serverWithDelay = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          stdioConfig: {
            startupDelayMs: 50,
          },
        },
      });

      const startTime = Date.now();
      await serverWithDelay.start();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
      await serverWithDelay.stop();
    });
  });

  describe('Client Connection Management', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should create client transport when server is listening', () => {
      const transport = server.createClientTransport();
      expect(transport).toBeDefined();
    });

    it('should throw error when creating client transport while not listening', async () => {
      await server.stop();

      expect(() => server.createClientTransport()).toThrow(
        `Cannot create client transport: server is not listening (state: 'stopped')`
      );
    });

    it('should track connected clients', async () => {
      expect(server.getConnectionCount()).toBe(0);
      expect(server.getConnectedClients()).toHaveLength(0);

      const transport = server.createClientTransport();
      await transport.connect();

      expect(server.getConnectionCount()).toBe(1);
      expect(server.getConnectedClients()).toHaveLength(1);

      const client = server.getConnectedClients()[0];
      expect(client.id).toBeDefined();
      expect(client.transport).toBe(transport);
      expect(client.connectedAt).toBeTypeOf('number');
      expect(client.requestCount).toBe(0);
      expect(client.protocolState).toBe('uninitialized');
    });

    it('should enforce maximum connections limit', () => {
      const serverWithLimit = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          maxConnections: 1,
        },
      });

      const transport1 = serverWithLimit.createClientTransport();
      expect(() => serverWithLimit.createClientTransport()).toThrow(
        'Cannot create client transport: maximum connections reached (1)'
      );
    });

    it('should disconnect all clients on server stop', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      expect(server.getConnectionCount()).toBe(1);

      await server.stop();

      expect(server.getConnectionCount()).toBe(0);
    });

    it('should allow disconnecting individual clients', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const clients = server.getConnectedClients();
      expect(clients).toHaveLength(1);

      await server.disconnectClient(clients[0].id, 'test disconnect');

      expect(server.getConnectionCount()).toBe(0);
    });

    it('should return client by ID', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const clients = server.getConnectedClients();
      const clientId = clients[0].id;

      const foundClient = server.getClient(clientId);
      expect(foundClient).toBeDefined();
      expect(foundClient!.id).toBe(clientId);

      const notFoundClient = server.getClient('non-existent-id');
      expect(notFoundClient).toBeUndefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit started event', async () => {
      const startedSpy = vi.fn();
      server.on('started', startedSpy);

      await server.start();

      expect(startedSpy).toHaveBeenCalledOnce();
    });

    it('should emit stopped event', async () => {
      const stoppedSpy = vi.fn();
      server.on('stopped', stoppedSpy);

      await server.start();
      await server.stop();

      expect(stoppedSpy).toHaveBeenCalledOnce();
    });

    it('should emit request and response events', async () => {
      const requestSpy = vi.fn();
      const responseSpy = vi.fn();
      server.on('request', requestSpy);
      server.on('response', responseSpy);

      await server.start();

      const transport = server.createClientTransport();
      await transport.connect();

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      };

      await transport.send(request);

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'ping',
        })
      );
      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'ping' }),
        expect.objectContaining({ result: {} })
      );
    });
  });

  describe('Protocol Message Processing', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle initialize request', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const initRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
          capabilities: {},
        },
      };

      const response = (await transport.send(initRequest)) as JSONRPCResponse;

      expect(response.result).toEqual({
        protocolVersion: '2024-11-05',
        capabilities: serverDefinition.serverConfig.capabilities,
        serverInfo: serverDefinition.serverConfig.serverInfo,
      });

      // Check that client state was updated
      const clients = server.getConnectedClients();
      expect(clients[0].protocolState).toBe('initialized');
      expect(clients[0].clientInfo).toEqual({
        name: 'test-client',
        version: '1.0.0',
      });
    });

    it('should handle ping request', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const pingRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      };

      const response = (await transport.send(pingRequest)) as JSONRPCResponse;

      expect(response.result).toEqual({});
    });

    it('should handle tools/list request', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const toolsListRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      };

      const response = (await transport.send(toolsListRequest)) as JSONRPCResponse;

      expect(response.result).toEqual({
        tools: [
          {
            name: 'test_tool',
            description: 'Mock tool: test_tool',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });
    });

    it('should handle tools/call request', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const toolCallRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: {},
        },
      };

      const response = (await transport.send(toolCallRequest)) as JSONRPCResponse;

      expect(response.result).toEqual({
        content: [{ type: 'text', text: 'test response' }],
        isError: false,
      });
    });

    it('should return error for unknown method', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const unknownRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'unknown/method',
      };

      const response = (await transport.send(unknownRequest)) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.message).toContain('Method not found: unknown/method');
    });

    it('should increment request count for connected clients', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      const clients = server.getConnectedClients();
      expect(clients[0].requestCount).toBe(0);

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      await transport.send(request);

      const updatedClients = server.getConnectedClients();
      expect(updatedClients[0].requestCount).toBe(1);
    });
  });

  describe('Statistics and Configuration', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should provide server statistics', () => {
      const stats = server.getStats();

      expect(stats).toEqual({
        totalRequests: 0,
        totalErrorsInjected: 0,
        totalNotificationsSent: 0,
        requestsByMethod: {},
        toolCallsByName: {},
        currentState: expect.any(String),
        activeScenario: undefined,
        uptimeMs: expect.any(Number),
      });
    });

    it('should provide server configuration', () => {
      const config = server.getServerConfig();
      expect(config).toEqual(serverDefinition.serverConfig);
    });

    it('should provide server name and transport type', () => {
      expect(server.getName()).toBe('test-server');
      expect(server.getTransportType()).toBe('stdio');
    });

    it('should track request statistics', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.requestsByMethod).toEqual({
        ping: 1,
        'tools/call': 1,
      });
      expect(stats.toolCallsByName).toEqual({
        test_tool: 1,
      });
    });
  });

  describe('Assertion Helpers', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should provide tool call assertions', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      expect(() => server.assertToolCalled('test_tool')).not.toThrow();
      expect(() => server.assertToolCalled('test_tool', 1)).not.toThrow();
      expect(() => server.assertToolCalled('test_tool', 2)).toThrow(
        `Expected tool 'test_tool' to be called 2 time(s), but was called 1 time(s)`
      );
      expect(() => server.assertToolCalled('nonexistent_tool')).toThrow(
        `Expected tool 'nonexistent_tool' to be called at least once, but it was never called`
      );
    });

    it('should provide method call assertions', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });

      expect(() => server.assertMethodCalled('ping')).not.toThrow();
      expect(() => server.assertMethodCalled('ping', 1)).not.toThrow();
      expect(() => server.assertMethodCalled('ping', 2)).toThrow(
        `Expected method 'ping' to be called 2 time(s), but was called 1 time(s)`
      );
      expect(() => server.assertMethodCalled('unknown')).toThrow(
        `Expected method 'unknown' to be called at least once, but it was never called`
      );
    });

    it('should provide initialization assertions', async () => {
      const transport = server.createClientTransport();
      await transport.connect();

      expect(() => server.assertInitialized()).toThrow(
        'Expected at least one client to be initialized, but none are'
      );

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test', version: '1.0.0' },
          capabilities: {},
        },
      });

      expect(() => server.assertInitialized()).not.toThrow();
    });
  });

  describe('Transport Type Support', () => {
    it('should support stdio transport', () => {
      const stdioServer = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          transport: 'stdio',
        },
      });

      expect(stdioServer.getTransportType()).toBe('stdio');
    });

    it('should support http transport', () => {
      const httpServer = new MockMCPServer({
        ...serverDefinition,
        serverConfig: {
          ...serverDefinition.serverConfig,
          transport: 'http',
        },
      });

      expect(httpServer.getTransportType()).toBe('http');
    });
  });
});