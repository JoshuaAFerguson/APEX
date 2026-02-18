/**
 * @fileoverview Mock MCP Server Integration Tests
 *
 * Comprehensive tests to verify that the mock MCP server implementation
 * works correctly and meets all acceptance criteria for testing infrastructure.
 *
 * Acceptance Criteria:
 * 1. ✅ Mock MCP server implementation that can simulate MCP protocol responses
 * 2. ✅ Supports configurable responses, error simulation, and connection lifecycle
 * 3. ✅ Can be used to test MCP client interactions without real servers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockMCPServerFacade,
  MockMCPServer,
  MockTransport,
  createSimpleMockServer,
  createErrorMockServer,
  createSlowMockServer,
  MockAssertionError,
  type MockToolHandler,
  type MockMCPServerDefinition,
} from '../mcp/mock-server/index.js';

describe('Mock MCP Server Integration', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server?.isStarted()) {
      await server.stop();
    }
  });

  describe('Basic Mock Server Functionality', () => {
    it('should create and start a mock server successfully', async () => {
      server = createSimpleMockServer('test-server');

      expect(server).toBeInstanceOf(MockMCPServerFacade);
      expect(server.isStarted()).toBe(false);

      await server.start();
      expect(server.isStarted()).toBe(true);

      await server.stop();
      expect(server.isStarted()).toBe(false);
    });

    it('should provide a mock transport for client connection', async () => {
      server = createSimpleMockServer('test-server');
      await server.start();

      const transport = server.getTransport();
      expect(transport).toBeInstanceOf(MockTransport);
      expect(transport.isConnected()).toBe(false);

      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });

    it('should handle MCP protocol initialization', async () => {
      const toolHandlers: MockToolHandler[] = [
        {
          toolName: 'test_tool',
          response: {
            content: [{ type: 'text', text: 'test response' }],
            isError: false,
          },
        },
      ];

      server = createSimpleMockServer('test-server', toolHandlers);
      await server.start();

      const transport = server.getTransport();
      await transport.connect();

      // Simulate MCP initialization handshake
      const initResponse = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      });

      expect(initResponse).toBeDefined();
      expect(initResponse.jsonrpc).toBe('2.0');
      expect(initResponse.id).toBe(1);
      expect(initResponse.result).toMatchObject({
        protocolVersion: '2024-11-05',
        capabilities: expect.any(Object),
        serverInfo: expect.objectContaining({
          name: expect.any(String),
          version: expect.any(String),
        }),
      });

      server.assertMethodCalled('initialize', 1);
    });

    it('should handle tool listing and execution', async () => {
      const toolHandlers: MockToolHandler[] = [
        {
          toolName: 'read_file',
          response: {
            content: [{ type: 'text', text: 'mock file content' }],
            isError: false,
          },
        },
        {
          toolName: 'write_file',
          response: {
            content: [{ type: 'text', text: 'file written' }],
            isError: false,
          },
        },
      ];

      server = createSimpleMockServer('test-server', toolHandlers);
      await server.start();

      const transport = server.getTransport();
      await transport.connect();

      // List available tools
      const listResponse = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      expect(listResponse.result).toMatchObject({
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'read_file' }),
          expect.objectContaining({ name: 'write_file' }),
        ]),
      });

      // Call a tool
      const callResponse = await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/test/file.txt' },
        },
      });

      expect(callResponse.result).toMatchObject({
        content: [{ type: 'text', text: 'mock file content' }],
        isError: false,
      });

      server.assertMethodCalled('tools/list', 1);
      server.assertToolCalled('read_file', 1);
    });
  });

  describe('Configurable Response Behavior', () => {
    it('should support conditional responses based on arguments', async () => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'conditional-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'test', version: '1.0.0' },
          autoStart: true,
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          toolHandlers: [
            {
              toolName: 'read_file',
              matchArgs: { path: '/existing/file.txt' },
              response: {
                content: [{ type: 'text', text: 'file exists' }],
                isError: false,
              },
            },
            {
              toolName: 'read_file',
              response: {
                content: [{ type: 'text', text: 'file not found' }],
                isError: true,
              },
            },
          ],
          recordRequests: true,
          maxRecordedRequests: 1000,
          validateRequests: true,
          enableDebugLogging: false,
          notificationTriggers: [],
          expectations: [],
        },
        scenarios: [],
      };

      server = new MockMCPServerFacade(definition);
      await server.start();

      const transport = server.getTransport();
      await transport.connect();

      // Call with matching arguments
      const response1 = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/existing/file.txt' },
        },
      });

      expect(response1.result.content[0].text).toBe('file exists');
      expect(response1.result.isError).toBe(false);

      // Call with different arguments
      const response2 = await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: { path: '/other/file.txt' },
        },
      });

      expect(response2.result.content[0].text).toBe('file not found');
      expect(response2.result.isError).toBe(true);
    });

    it('should support custom response delays', async () => {
      server = createSlowMockServer('slow-server', {
        fixedMs: 100,
        jitter: false,
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      const startTime = Date.now();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
    });
  });

  describe('Error Simulation', () => {
    it('should inject errors according to configuration', async () => {
      server = createErrorMockServer('error-server', {
        enabled: true,
        probability: 1.0, // Always inject errors
        errorCode: -32603,
        errorMessage: 'Mock server error',
        methods: ['tools/call'],
        afterRequestCount: 0,
        maxErrors: 0,
        simulateConnectionFailure: false,
        errorDelayMs: 0,
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      // This should return an error due to error injection
      const response = await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'any_tool',
          arguments: {},
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toBe('Mock server error');
      expect(response.result).toBeUndefined();

      const stats = server.getStats();
      expect(stats.totalErrorsInjected).toBeGreaterThan(0);
    });

    it('should respect error injection probability', async () => {
      server = createErrorMockServer('random-error-server', {
        enabled: true,
        probability: 0.5, // 50% chance
        errorCode: -32603,
        errorMessage: 'Random error',
        methods: ['tools/call'],
        afterRequestCount: 0,
        maxErrors: 0,
        simulateConnectionFailure: false,
        errorDelayMs: 0,
      });

      await server.start();
      const transport = server.getTransport();
      await transport.connect();

      let errorCount = 0;
      let successCount = 0;
      const totalCalls = 20;

      for (let i = 0; i < totalCalls; i++) {
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'tools/call',
          params: {
            name: 'test_tool',
            arguments: {},
          },
        });

        if (response.error) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      // With probability 0.5, we should get roughly half errors and half successes
      // Allow for some variance due to randomness
      expect(errorCount).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);
      expect(errorCount + successCount).toBe(totalCalls);
    });
  });

  describe('Connection Lifecycle Management', () => {
    it('should track connection state correctly', async () => {
      server = createSimpleMockServer('lifecycle-server');
      await server.start();

      const transport = server.getTransport();
      expect(transport.isConnected()).toBe(false);

      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });

    it('should handle multiple connect/disconnect cycles', async () => {
      server = createSimpleMockServer('cycle-server');
      await server.start();

      const transport = server.getTransport();

      for (let i = 0; i < 3; i++) {
        expect(transport.isConnected()).toBe(false);

        await transport.connect();
        expect(transport.isConnected()).toBe(true);

        // Send a request to verify connection works
        const response = await transport.send({
          jsonrpc: '2.0',
          id: i + 1,
          method: 'ping',
          params: {},
        });

        expect(response.result).toBeDefined();

        await transport.disconnect();
        expect(transport.isConnected()).toBe(false);
      }
    });

    it('should reset state between connections when configured', async () => {
      server = createSimpleMockServer('reset-server', [
        {
          toolName: 'increment',
          response: {
            content: [{ type: 'text', text: 'incremented' }],
            isError: false,
          },
        },
      ]);

      await server.start();
      const transport = server.getTransport();

      // First connection - call tool twice
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'increment', arguments: {} },
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'increment', arguments: {} },
      });

      server.assertToolCalled('increment', 2);

      await transport.disconnect();

      // Reset the server between connections
      await server.reset();

      // Second connection - should start fresh
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'increment', arguments: {} },
      });

      // Should only see the new call, not the previous ones
      server.assertToolCalled('increment', 1);
    });
  });

  describe('Assertion Helpers', () => {
    beforeEach(async () => {
      server = createSimpleMockServer('assertion-server', [
        {
          toolName: 'test_tool',
          response: {
            content: [{ type: 'text', text: 'test response' }],
            isError: false,
          },
        },
      ]);
      await server.start();
    });

    it('should provide assertion helpers for method calls', async () => {
      const transport = server.getTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      // These should pass
      server.assertMethodCalled('tools/list');
      server.assertMethodCalled('tools/list', 1);
      server.assertMethodCalled('tools/call', 1);
      server.assertToolCalled('test_tool', 1);

      // These should throw
      expect(() => server.assertMethodCalled('tools/list', 2)).toThrow(MockAssertionError);
      expect(() => server.assertMethodCalled('nonexistent/method')).toThrow(MockAssertionError);
      expect(() => server.assertToolCalled('nonexistent_tool')).toThrow(MockAssertionError);
    });

    it('should provide request history for inspection', async () => {
      const transport = server.getTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: { param: 'value' } },
      });

      const history = server.getRequestHistory();
      expect(history).toHaveLength(1);

      const request = history[0];
      expect(request.request.method).toBe('tools/call');
      expect(request.request.params).toMatchObject({
        name: 'test_tool',
        arguments: { param: 'value' },
      });
      expect(request.response).toBeDefined();
      expect(request.timestamp).toBeInstanceOf(Number);
      expect(request.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should provide usage statistics', async () => {
      const transport = server.getTransport();
      await transport.connect();

      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      });

      await transport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.requestsByMethod).toMatchObject({
        'tools/list': 1,
        'tools/call': 1,
      });
      expect(stats.toolCallsByName).toMatchObject({
        'test_tool': 1,
      });
      expect(stats.totalErrorsInjected).toBe(0);
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Client Server Support', () => {
    let multiServer: MockMCPServer;

    afterEach(async () => {
      if (multiServer?.isListening()) {
        await multiServer.stop();
      }
    });

    it('should support multiple concurrent client connections', async () => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'multi-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'multi-server', version: '1.0.0' },
          autoStart: true,
          maxConnections: 3,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          toolHandlers: [
            {
              toolName: 'test_tool',
              response: {
                content: [{ type: 'text', text: 'response' }],
                isError: false,
              },
            },
          ],
          recordRequests: true,
          maxRecordedRequests: 1000,
          validateRequests: true,
          enableDebugLogging: false,
          notificationTriggers: [],
          expectations: [],
        },
        scenarios: [],
      };

      multiServer = new MockMCPServer(definition);
      await multiServer.start();

      // Create multiple client connections
      const client1 = multiServer.createClientTransport();
      const client2 = multiServer.createClientTransport();
      const client3 = multiServer.createClientTransport();

      await client1.connect();
      await client2.connect();
      await client3.connect();

      expect(multiServer.getConnectionCount()).toBe(3);

      // Send requests from different clients
      await client1.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      await client2.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      multiServer.assertToolCalled('test_tool', 2);

      await client1.disconnect();
      await client2.disconnect();
      await client3.disconnect();

      expect(multiServer.getConnectionCount()).toBe(0);
    });
  });
});