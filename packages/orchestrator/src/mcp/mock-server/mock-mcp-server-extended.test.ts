/**
 * @fileoverview Extended Tests for MockMCPServer Core Functionality
 *
 * Additional comprehensive tests for MockMCPServer covering:
 * - Advanced scenario management
 * - Behavior configuration updates
 * - Dynamic handler management
 * - Complex client lifecycle scenarios
 * - Resource and prompt handling
 * - Notification system
 * - Request history and statistics
 *
 * @module orchestrator/mcp/mock-server/mock-mcp-server-extended.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type {
  MockMCPServerDefinition,
  MockBehaviorConfig,
  MockScenario,
} from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

describe('MockMCPServer - Extended Functionality', () => {
  let server: MockMCPServer;
  let baseDefinition: MockMCPServerDefinition;

  beforeEach(async () => {
    baseDefinition = {
      serverConfig: {
        name: 'extended-test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'extended-test-server',
          version: '1.0.0',
        },
        instructions: 'Test server for extended functionality',
        maxConnections: 5,
        shutdownTimeoutMs: 3000,
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 0 },
        toolHandlers: [
          {
            toolName: 'read_file',
            response: {
              content: [{ type: 'text', text: 'file content' }],
              isError: false,
            },
          },
          {
            toolName: 'write_file',
            response: {
              content: [{ type: 'text', text: 'file written successfully' }],
              isError: false,
            },
            matchArgs: { action: 'write' },
          },
        ],
        defaultToolResponse: {
          content: [{ type: 'text', text: 'default tool response' }],
          isError: false,
        },
        recordRequests: true,
        maxRecordedRequests: 100,
      },
      scenarios: [
        {
          name: 'slow-server',
          description: 'Simulates a slow server with delays',
          serverConfig: {
            name: 'slow-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            responseDelay: { fixedMs: 100, jitter: true },
          },
        },
        {
          name: 'error-server',
          description: 'Simulates a server with errors',
          serverConfig: {
            name: 'error-server',
            transport: 'stdio',
          },
          behaviorConfig: {
            errorInjection: {
              enabled: true,
              probability: 1.0,
              errorMessage: 'Scenario error',
            },
          },
        },
      ],
    };

    server = new MockMCPServer(baseDefinition);
    await server.start();
  });

  afterEach(async () => {
    if (server.isListening()) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('Advanced Scenario Management', () => {
    it('should activate scenario and update behavior', async () => {
      expect(server.getActiveScenario()).toBeUndefined();

      const scenarioActivatedSpy = vi.fn();
      server.on('scenario:activated', scenarioActivatedSpy);

      server.activateScenario('slow-server');

      expect(server.getActiveScenario()).toBe('slow-server');
      expect(scenarioActivatedSpy).toHaveBeenCalledWith('slow-server');

      // Test that the scenario behavior is applied
      const transport = server.createClientTransport();
      await transport.connect();

      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });
      const elapsed = Date.now() - startTime;

      // Should have delay from scenario
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow tolerance
    });

    it('should reset to default behavior', async () => {
      server.activateScenario('slow-server');
      expect(server.getActiveScenario()).toBe('slow-server');

      server.resetToDefault();
      expect(server.getActiveScenario()).toBeUndefined();

      // Test that default behavior is restored
      const transport = server.createClientTransport();
      await transport.connect();

      const startTime = Date.now();
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      });
      const elapsed = Date.now() - startTime;

      // Should be fast again (no delay)
      expect(elapsed).toBeLessThan(50);
    });

    it('should throw error for non-existent scenario', () => {
      expect(() => server.activateScenario('non-existent')).toThrow(
        "Scenario 'non-existent' not found"
      );
    });

    it('should handle scenario with error injection', async () => {
      server.activateScenario('error-server');

      const transport = server.createClientTransport();
      await transport.connect();

      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.message).toBe('Scenario error');
    });
  });

  describe('Dynamic Behavior Updates', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should update behavior configuration', async () => {
      // Initial request should succeed
      let response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response.result).toBeDefined();

      // Update behavior to inject errors
      server.updateBehavior({
        errorInjection: {
          enabled: true,
          probability: 1.0,
          errorMessage: 'Dynamic error injection',
        },
      });

      // Now requests should fail
      response = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      }) as JSONRPCResponse;
      expect(response.error).toBeDefined();
      expect(response.error!.message).toBe('Dynamic error injection');
    });

    it('should reset behavior state', async () => {
      // Make some requests to build up state
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await transport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

      let stats = server.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);

      server.resetBehavior();

      stats = server.getStats();
      expect(stats.totalRequests).toBe(0);
    });

    it('should maintain configuration across behavior updates', async () => {
      const originalConfig = server.getServerConfig();

      server.updateBehavior({
        responseDelay: { fixedMs: 50 },
      });

      const updatedConfig = server.getServerConfig();
      expect(updatedConfig).toEqual(originalConfig);
    });
  });

  describe('Resource and Prompt Handling', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should handle resources/list request', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
      }) as JSONRPCResponse;

      expect(response.result).toEqual({ resources: [] });
    });

    it('should handle resources/read request', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: { uri: 'file:///test.txt' },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        contents: [{
          uri: 'file:///test.txt',
          mimeType: 'text/plain',
          text: 'Mock resource content for file:///test.txt',
        }],
      });
    });

    it('should handle resources/read without uri', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {},
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        contents: [{
          uri: 'unknown',
          mimeType: 'text/plain',
          text: 'Mock resource content for unknown',
        }],
      });
    });

    it('should handle prompts/list request', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/list',
      }) as JSONRPCResponse;

      expect(response.result).toEqual({ prompts: [] });
    });

    it('should handle prompts/get request', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/get',
        params: { name: 'test-prompt' },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        description: 'Mock prompt: test-prompt',
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Mock prompt content for test-prompt' },
        }],
      });
    });
  });

  describe('Tool Handler Matching', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should match tool handler by name only', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/test/file.txt' },
        },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        content: [{ type: 'text', text: 'file content' }],
        isError: false,
      });
    });

    it('should match tool handler by name and arguments', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: { action: 'write', path: '/test/file.txt' },
        },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        content: [{ type: 'text', text: 'file written successfully' }],
        isError: false,
      });
    });

    it('should fall back to default tool response for unmatched args', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: { action: 'delete' }, // Doesn't match matchArgs
        },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        content: [{ type: 'text', text: 'default tool response' }],
        isError: false,
      });
    });

    it('should fall back to default response for unknown tool', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        content: [{ type: 'text', text: 'default tool response' }],
        isError: false,
      });
    });

    it('should handle missing tool name', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          arguments: {},
        },
      }) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.message).toBe('Tool name is required');
    });

    it('should return generic error when no default response configured', async () => {
      // Create server without default tool response
      const serverWithoutDefault = new MockMCPServer({
        ...baseDefinition,
        defaultBehavior: {
          ...baseDefinition.defaultBehavior,
          defaultToolResponse: undefined,
        },
      });

      await serverWithoutDefault.start();
      const testTransport = serverWithoutDefault.createClientTransport();
      await testTransport.connect();

      const response = await testTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        content: [{ type: 'text', text: 'No handler for tool: unknown_tool' }],
        isError: true,
      });

      await serverWithoutDefault.stop();
    });
  });

  describe('Request History and Statistics', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should record request history when enabled', async () => {
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await transport.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

      const history = server.getRequestHistory();
      expect(history).toHaveLength(2);

      expect(history[0].request.method).toBe('ping');
      expect(history[0].response.result).toBeDefined();
      expect(history[0].durationMs).toBeTypeOf('number');

      expect(history[1].request.method).toBe('tools/list');
    });

    it('should provide detailed statistics', async () => {
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });
      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'read_file', arguments: {} },
      });

      const stats = server.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.requestsByMethod).toEqual({
        ping: 1,
        'tools/call': 2,
      });
      expect(stats.toolCallsByName).toEqual({
        read_file: 2,
      });
      expect(stats.currentState).toBeTypeOf('string');
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should limit recorded requests based on maxRecordedRequests', async () => {
      // Create server with small limit
      const limitedServer = new MockMCPServer({
        ...baseDefinition,
        defaultBehavior: {
          ...baseDefinition.defaultBehavior,
          maxRecordedRequests: 2,
        },
      });

      await limitedServer.start();
      const limitedTransport = limitedServer.createClientTransport();
      await limitedTransport.connect();

      // Send more requests than the limit
      await limitedTransport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
      await limitedTransport.send({ jsonrpc: '2.0', id: 2, method: 'ping' });
      await limitedTransport.send({ jsonrpc: '2.0', id: 3, method: 'ping' });

      const history = limitedServer.getRequestHistory();
      expect(history.length).toBeLessThanOrEqual(2);

      await limitedServer.stop();
    });

    it('should disable request recording when configured', async () => {
      const noRecordServer = new MockMCPServer({
        ...baseDefinition,
        defaultBehavior: {
          ...baseDefinition.defaultBehavior,
          recordRequests: false,
        },
      });

      await noRecordServer.start();
      const noRecordTransport = noRecordServer.createClientTransport();
      await noRecordTransport.connect();

      await noRecordTransport.send({ jsonrpc: '2.0', id: 1, method: 'ping' });

      const history = noRecordServer.getRequestHistory();
      expect(history).toHaveLength(0);

      await noRecordServer.stop();
    });
  });

  describe('Client Protocol State Tracking', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should track client protocol state through initialization', async () => {
      const clients = server.getConnectedClients();
      expect(clients[0].protocolState).toBe('uninitialized');

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'test-client', version: '1.0.0' },
          capabilities: {},
        },
      });

      const updatedClients = server.getConnectedClients();
      expect(updatedClients[0].protocolState).toBe('initialized');
      expect(updatedClients[0].clientInfo).toEqual({
        name: 'test-client',
        version: '1.0.0',
      });
    });

    it('should handle initialized notification as request', async () => {
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialized',
      });

      const clients = server.getConnectedClients();
      expect(clients[0].protocolState).toBe('initialized');
    });

    it('should track client info from initialization', async () => {
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'advanced-client',
            version: '2.1.0',
          },
        },
      });

      const clients = server.getConnectedClients();
      expect(clients[0].clientInfo).toEqual({
        name: 'advanced-client',
        version: '2.1.0',
      });
    });

    it('should handle initialize without clientInfo', async () => {
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
        },
      });

      const clients = server.getConnectedClients();
      expect(clients[0].protocolState).toBe('initialized');
      expect(clients[0].clientInfo).toBeUndefined();
    });

    it('should return server instructions in initialize response', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
        },
      }) as JSONRPCResponse;

      expect(response.result).toEqual({
        protocolVersion: '2024-11-05',
        capabilities: baseDefinition.serverConfig.capabilities,
        serverInfo: baseDefinition.serverConfig.serverInfo,
        instructions: 'Test server for extended functionality',
      });
    });
  });

  describe('Server Configuration Access', () => {
    it('should provide access to server name', () => {
      expect(server.getName()).toBe('extended-test-server');
    });

    it('should provide access to transport type', () => {
      expect(server.getTransportType()).toBe('stdio');
    });

    it('should provide complete server configuration', () => {
      const config = server.getServerConfig();
      expect(config).toEqual(baseDefinition.serverConfig);
    });

    it('should provide server state information', () => {
      expect(server.getState()).toBe('listening');
      expect(server.isListening()).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let transport: any;

    beforeEach(async () => {
      transport = server.createClientTransport();
      await transport.connect();
    });

    it('should handle malformed JSON-RPC requests gracefully', async () => {
      const response = await transport.send({
        // Missing required jsonrpc field
        id: 1,
        method: 'ping',
      } as any) as JSONRPCResponse;

      // Should still process despite missing jsonrpc field
      expect(response.result).toBeDefined();
    });

    it('should handle requests with undefined params', async () => {
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: undefined,
      }) as JSONRPCResponse;

      expect(response.result).toBeDefined();
    });

    it('should handle exceptions in request processing', async () => {
      // Force an error by calling a method that doesn't exist
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'nonexistent/method',
      }) as JSONRPCResponse;

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32603);
      expect(response.error!.message).toContain('Method not found');
    });

    it('should handle transport-level errors', async () => {
      const errorSpy = vi.fn();
      server.on('error', errorSpy);

      // Simulate a transport error
      transport.emit('error', new Error('Transport error'));

      // Server should continue functioning
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }) as JSONRPCResponse;

      expect(response.result).toBeDefined();
    });
  });
});