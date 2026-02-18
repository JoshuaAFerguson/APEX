/**
 * @fileoverview Integration Tests for MockMCPServer Transport Types
 *
 * This test suite validates MockMCPServer integration with different transport types
 * and comprehensive end-to-end workflows as specified in acceptance criteria:
 * - SSE transport simulation
 * - Multi-client workflow scenarios
 * - Cross-transport compatibility
 * - Real-world usage patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockMCPServer } from './mock-mcp-server.js';
import type { MockMCPServerDefinition } from '@apexcli/core';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

describe('MockMCPServer Integration Tests', () => {
  let servers: MockMCPServer[] = [];
  let baseDefinition: MockMCPServerDefinition;

  beforeEach(() => {
    baseDefinition = {
      serverConfig: {
        name: 'integration-test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true, subscribe: true },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'integration-test-server',
          version: '1.0.0',
        },
        maxConnections: 10,
        shutdownTimeoutMs: 5000,
      },
      defaultBehavior: {
        responseDelay: { fixedMs: 50 },
        errorInjection: { enabled: false },
        toolHandlers: [
          {
            toolName: 'file-read',
            response: {
              content: [{ type: 'text', text: 'File content' }],
              isError: false,
            },
          },
          {
            toolName: 'file-write',
            matchArgs: { mode: 'append' },
            response: {
              content: [{ type: 'text', text: 'File appended successfully' }],
              isError: false,
            },
          },
          {
            toolName: 'database-query',
            response: {
              content: [{ type: 'text', text: 'Query executed: 5 rows affected' }],
              isError: false,
            },
          },
        ],
        notificationTriggers: [
          {
            condition: 'after_method',
            conditionValue: 'tools/call',
            method: 'notifications/tool-executed',
            params: { message: 'Tool execution completed' },
            once: false,
            delayMs: 100,
          },
        ],
        defaultToolResponse: {
          content: [{ type: 'text', text: 'Default tool response' }],
          isError: false,
        },
      },
      scenarios: [
        {
          name: 'slow-mode',
          behaviorConfig: {
            responseDelay: { fixedMs: 500 },
            errorInjection: { enabled: false },
            toolHandlers: [],
            notificationTriggers: [],
            defaultToolResponse: {
              content: [{ type: 'text', text: 'Slow response' }],
              isError: false,
            },
          },
        },
        {
          name: 'error-mode',
          behaviorConfig: {
            responseDelay: { fixedMs: 0 },
            errorInjection: {
              enabled: true,
              probability: 0.5,
              methods: ['tools/call'],
              afterRequestCount: 0,
              maxErrors: 0,
              errorCode: -32603,
              errorMessage: 'Simulated error',
              simulateConnectionFailure: false,
            },
            toolHandlers: [],
            notificationTriggers: [],
            defaultToolResponse: undefined,
          },
        },
      ],
    };
  });

  afterEach(async () => {
    // Clean up all servers
    await Promise.all(servers.map(async (server) => {
      if (server.isListening()) {
        await server.stop();
      }
    }));
    servers = [];
    vi.clearAllMocks();
  });

  describe('SSE Transport Integration', () => {
    it('should support SSE transport lifecycle', async () => {
      const sseServer = new MockMCPServer({
        ...baseDefinition,
        serverConfig: {
          ...baseDefinition.serverConfig,
          transport: 'http',
          name: 'sse-test-server',
        },
      });

      servers.push(sseServer);

      const startedSpy = vi.fn();
      const stoppedSpy = vi.fn();

      sseServer.on('started', startedSpy);
      sseServer.on('stopped', stoppedSpy);

      await sseServer.start();

      expect(sseServer.getTransportType()).toBe('http');
      expect(sseServer.isListening()).toBe(true);
      expect(startedSpy).toHaveBeenCalledOnce();

      // SSE should support client connections
      const transport = sseServer.createClientTransport();
      await transport.connect();

      expect(sseServer.getConnectionCount()).toBe(1);

      // SSE should handle requests normally
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

      await sseServer.stop();
      expect(stoppedSpy).toHaveBeenCalledOnce();
    });

    it('should handle SSE-specific notifications', async () => {
      const sseServer = new MockMCPServer({
        ...baseDefinition,
        serverConfig: {
          ...baseDefinition.serverConfig,
          transport: 'http',
        },
      });

      servers.push(sseServer);
      await sseServer.start();

      const transport = sseServer.createClientTransport();
      await transport.connect();

      const notificationSpy = vi.fn();
      sseServer.on('notification:sent', notificationSpy);

      // Trigger notification through tool call
      await transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'file-read',
          arguments: { path: '/test.txt' },
        },
      });

      // Allow time for notification to be processed
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(notificationSpy).toHaveBeenCalled();
      const notification = notificationSpy.mock.calls[0][0];
      expect(notification.method).toBe('notifications/tool-executed');
    });

    it('should support concurrent SSE clients', async () => {
      const sseServer = new MockMCPServer({
        ...baseDefinition,
        serverConfig: {
          ...baseDefinition.serverConfig,
          transport: 'http',
          maxConnections: 5,
        },
      });

      servers.push(sseServer);
      await sseServer.start();

      // Create multiple SSE clients
      const clientCount = 4;
      const transports = await Promise.all(
        Array.from({ length: clientCount }, async () => {
          const transport = sseServer.createClientTransport();
          await transport.connect();
          return transport;
        })
      );

      expect(sseServer.getConnectionCount()).toBe(clientCount);

      // Each client should be able to communicate independently
      const responses = await Promise.all(
        transports.map((transport, i) =>
          transport.send({
            jsonrpc: '2.0',
            id: i + 1,
            method: 'tools/call',
            params: {
              name: 'database-query',
              arguments: { query: `SELECT * FROM table${i}` },
            },
          })
        )
      );

      responses.forEach((response, i) => {
        expect(response).toEqual({
          jsonrpc: '2.0',
          id: i + 1,
          result: {
            content: [{ type: 'text', text: 'Query executed: 5 rows affected' }],
            isError: false,
          },
        });
      });
    });
  });

  describe('Multi-Client Workflow Scenarios', () => {
    it('should handle complex file processing workflow', async () => {
      const server = new MockMCPServer(baseDefinition);
      servers.push(server);

      await server.start();

      // Create two clients: one for reading, one for writing
      const readerTransport = server.createClientTransport();
      const writerTransport = server.createClientTransport();

      await readerTransport.connect();
      await writerTransport.connect();

      // Initialize both clients
      await readerTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'reader-client', version: '1.0.0' },
          capabilities: { tools: true },
        },
      });

      await writerTransport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'writer-client', version: '1.0.0' },
          capabilities: { tools: true },
        },
      });

      // Verify initialization
      server.assertInitialized();

      // Reader reads a file
      const readResponse = await readerTransport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'file-read',
          arguments: { path: '/input.txt' },
        },
      }) as JSONRPCResponse;

      expect(readResponse.result).toEqual({
        content: [{ type: 'text', text: 'File content' }],
        isError: false,
      });

      // Writer processes and writes result
      const writeResponse = await writerTransport.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'file-write',
          arguments: { path: '/output.txt', content: 'processed content', mode: 'append' },
        },
      }) as JSONRPCResponse;

      expect(writeResponse.result).toEqual({
        content: [{ type: 'text', text: 'File appended successfully' }],
        isError: false,
      });

      // Verify both clients tracked their requests
      const clients = server.getConnectedClients();
      expect(clients).toHaveLength(2);

      const readerClient = clients.find(c => c.clientInfo?.name === 'reader-client');
      const writerClient = clients.find(c => c.clientInfo?.name === 'writer-client');

      expect(readerClient?.requestCount).toBe(2); // initialize + tool call
      expect(writerClient?.requestCount).toBe(2); // initialize + tool call

      // Check server statistics
      const stats = server.getStats();
      expect(stats.totalRequests).toBe(4);
      expect(stats.requestsByMethod).toEqual({
        'initialize': 2,
        'tools/call': 2,
      });
    });

    it('should handle database transaction workflow across multiple clients', async () => {
      const server = new MockMCPServer(baseDefinition);
      servers.push(server);

      await server.start();

      // Create transaction coordinator and two workers
      const coordinator = server.createClientTransport();
      const worker1 = server.createClientTransport();
      const worker2 = server.createClientTransport();

      await Promise.all([
        coordinator.connect(),
        worker1.connect(),
        worker2.connect(),
      ]);

      // Coordinator starts transaction
      const startTxResponse = await coordinator.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'database-query',
          arguments: { query: 'BEGIN TRANSACTION' },
        },
      });

      expect(startTxResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: expect.any(Object),
      });

      // Workers perform operations in parallel
      const [op1Result, op2Result] = await Promise.all([
        worker1.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'database-query',
            arguments: { query: 'INSERT INTO users (name) VALUES ("Alice")' },
          },
        }),
        worker2.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'database-query',
            arguments: { query: 'INSERT INTO users (name) VALUES ("Bob")' },
          },
        }),
      ]);

      expect(op1Result).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });
      expect(op2Result).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });

      // Coordinator commits transaction
      const commitResponse = await coordinator.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'database-query',
          arguments: { query: 'COMMIT' },
        },
      });

      expect(commitResponse).toMatchObject({
        jsonrpc: '2.0',
        result: expect.any(Object),
      });

      // Verify all operations were tracked
      expect(server.getConnectionCount()).toBe(3);

      const stats = server.getStats();
      expect(stats.totalRequests).toBe(4); // 1 from coordinator + 1 from each worker + 1 commit
      expect(stats.toolCallsByName['database-query']).toBe(4);
    });

    it('should handle client failure and recovery in workflow', async () => {
      const server = new MockMCPServer(baseDefinition);
      servers.push(server);

      await server.start();

      const client1 = server.createClientTransport();
      const client2 = server.createClientTransport();
      const client3 = server.createClientTransport();

      await Promise.all([
        client1.connect(),
        client2.connect(),
        client3.connect(),
      ]);

      // All clients start working
      const task1Promise = client1.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'file-read', arguments: { path: '/task1.txt' } },
      });

      const task2Promise = client2.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'file-read', arguments: { path: '/task2.txt' } },
      });

      // Client 2 fails
      client2.simulateDisconnect('Connection lost');

      // Client 1 and 3 should continue working
      const result1 = await task1Promise;
      expect(result1).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });

      const result3 = await client3.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'file-read', arguments: { path: '/task3.txt' } },
      });
      expect(result3).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });

      // Server should reflect the disconnection
      expect(server.getConnectionCount()).toBe(2);

      // New client can take over failed client's work
      const recoveryClient = server.createClientTransport();
      await recoveryClient.connect();

      const recoveryResult = await recoveryClient.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'file-read', arguments: { path: '/recovery-task.txt' } },
      });

      expect(recoveryResult).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });
      expect(server.getConnectionCount()).toBe(3);
    });
  });

  describe('Cross-Transport Scenarios', () => {
    it('should support simultaneous stdio and SSE servers', async () => {
      // Create one stdio server and one SSE server
      const stdioServer = new MockMCPServer({
        ...baseDefinition,
        serverConfig: {
          ...baseDefinition.serverConfig,
          name: 'stdio-server',
          transport: 'stdio',
        },
      });

      const sseServer = new MockMCPServer({
        ...baseDefinition,
        serverConfig: {
          ...baseDefinition.serverConfig,
          name: 'sse-server',
          transport: 'http',
        },
      });

      servers.push(stdioServer, sseServer);

      await Promise.all([stdioServer.start(), sseServer.start()]);

      // Create clients for each server
      const stdioClient = stdioServer.createClientTransport();
      const sseClient = sseServer.createClientTransport();

      await Promise.all([stdioClient.connect(), sseClient.connect()]);

      // Both should work independently
      const [stdioResponse, sseResponse] = await Promise.all([
        stdioClient.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'file-read', arguments: { path: '/stdio-test.txt' } },
        }),
        sseClient.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'file-read', arguments: { path: '/sse-test.txt' } },
        }),
      ]);

      expect(stdioResponse).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });
      expect(sseResponse).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });

      // Verify server isolation
      expect(stdioServer.getConnectionCount()).toBe(1);
      expect(sseServer.getConnectionCount()).toBe(1);

      expect(stdioServer.getTransportType()).toBe('stdio');
      expect(sseServer.getTransportType()).toBe('http');
    });
  });

  describe('Scenario Switching Integration', () => {
    it('should handle scenario changes during active workflows', async () => {
      const server = new MockMCPServer(baseDefinition);
      servers.push(server);

      await server.start();

      const client = server.createClientTransport();
      await client.connect();

      // Normal operation
      const normalResponse = await client.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'file-read', arguments: { path: '/test.txt' } },
      }) as JSONRPCResponse;

      expect(normalResponse.result).toEqual({
        content: [{ type: 'text', text: 'File content' }],
        isError: false,
      });

      // Switch to slow mode
      server.activateScenario('slow-mode');
      expect(server.getActiveScenario()).toBe('slow-mode');

      const slowStart = Date.now();
      const slowResponse = await client.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'unknown-tool', arguments: {} },
      }) as JSONRPCResponse;

      const slowDuration = Date.now() - slowStart;

      expect(slowResponse.result).toEqual({
        content: [{ type: 'text', text: 'Slow response' }],
        isError: false,
      });

      // Should have taken longer due to delay
      expect(slowDuration).toBeGreaterThanOrEqual(450); // Allow for some variance

      // Switch to error mode
      server.activateScenario('error-mode');
      expect(server.getActiveScenario()).toBe('error-mode');

      // Some requests should fail now (probability 0.5)
      const errorModeResults = await Promise.allSettled([
        client.send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'file-read', arguments: { path: '/test.txt' } },
        }),
        client.send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'file-read', arguments: { path: '/test.txt' } },
        }),
        client.send({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: { name: 'file-read', arguments: { path: '/test.txt' } },
        }),
        client.send({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: { name: 'file-read', arguments: { path: '/test.txt' } },
        }),
      ]);

      // At least some should succeed (not all should fail)
      const successful = errorModeResults.filter(result => result.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Reset to default
      server.resetToDefault();
      expect(server.getActiveScenario()).toBeUndefined();

      // Should work normally again
      const resetResponse = await client.send({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'file-read', arguments: { path: '/test.txt' } },
      }) as JSONRPCResponse;

      expect(resetResponse.result).toEqual({
        content: [{ type: 'text', text: 'File content' }],
        isError: false,
      });
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should handle typical development workflow', async () => {
      const server = new MockMCPServer(baseDefinition);
      servers.push(server);

      await server.start();

      // Developer connects
      const devClient = server.createClientTransport();
      await devClient.connect();

      await devClient.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'dev-client', version: '1.0.0' },
          capabilities: { tools: true },
        },
      });

      // 1. Developer lists available tools
      const toolsResponse = await devClient.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }) as JSONRPCResponse;

      expect(toolsResponse.result).toEqual({
        tools: [
          {
            name: 'file-read',
            description: 'Mock tool: file-read',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'file-write',
            description: 'Mock tool: file-write',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'database-query',
            description: 'Mock tool: database-query',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      // 2. Developer reads source files
      const sourceFiles = ['src/index.ts', 'src/utils.ts', 'src/config.ts'];
      const readResults = await Promise.all(
        sourceFiles.map((file, i) =>
          devClient.send({
            jsonrpc: '2.0',
            id: i + 10,
            method: 'tools/call',
            params: { name: 'file-read', arguments: { path: file } },
          })
        )
      );

      readResults.forEach(result => {
        expect(result).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });
      });

      // 3. Developer queries database for schema
      const schemaResponse = await devClient.send({
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: {
          name: 'database-query',
          arguments: { query: 'DESCRIBE users' },
        },
      });

      expect(schemaResponse).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });

      // 4. Developer writes updated files
      const writeResponse = await devClient.send({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
          name: 'file-write',
          arguments: {
            path: 'src/updated.ts',
            content: 'export const updated = true;',
            mode: 'append',
          },
        },
      });

      expect(writeResponse).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });

      // Verify comprehensive statistics
      const stats = server.getStats();
      expect(stats.totalRequests).toBeGreaterThan(5);
      expect(stats.requestsByMethod['tools/call']).toBeGreaterThan(3);
      expect(stats.toolCallsByName['file-read']).toBe(3);
      expect(stats.toolCallsByName['database-query']).toBe(1);
      expect(stats.toolCallsByName['file-write']).toBe(1);

      // Check request history
      const history = server.getRequestHistory();
      expect(history.length).toBeGreaterThan(5);

      // Verify tool call assertions
      server.assertToolCalled('file-read', 3);
      server.assertToolCalled('database-query', 1);
      server.assertToolCalled('file-write', 1);
      server.assertMethodCalled('initialize', 1);
      server.assertMethodCalled('tools/list', 1);
    });

    it('should handle monitoring and health check workflow', async () => {
      const server = new MockMCPServer({
        ...baseDefinition,
        defaultBehavior: {
          ...baseDefinition.defaultBehavior,
          toolHandlers: [
            {
              toolName: 'health-check',
              response: {
                content: [{ type: 'text', text: 'All systems operational' }],
                isError: false,
              },
            },
            {
              toolName: 'metrics',
              response: {
                content: [{ type: 'text', text: 'CPU: 45%, Memory: 60%, Disk: 30%' }],
                isError: false,
              },
            },
          ],
          notificationTriggers: [
            {
              condition: 'periodic',
              conditionValue: '2',
              method: 'notifications/health-status',
              params: { status: 'healthy', timestamp: Date.now() },
              once: false,
              delayMs: 50,
            },
          ],
        },
      });

      servers.push(server);
      await server.start();

      const monitorClient = server.createClientTransport();
      await monitorClient.connect();

      const notificationSpy = vi.fn();
      server.on('notification:sent', notificationSpy);

      // Periodic health checks
      const healthResults = await Promise.all([
        monitorClient.send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'health-check', arguments: {} },
        }),
        monitorClient.send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'metrics', arguments: {} },
        }),
        // These should trigger periodic notifications
        monitorClient.send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'health-check', arguments: {} },
        }),
        monitorClient.send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'metrics', arguments: {} },
        }),
      ]);

      healthResults.forEach(result => {
        expect(result).toMatchObject({ jsonrpc: '2.0', result: expect.any(Object) });
      });

      // Wait for periodic notifications
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received periodic notifications
      expect(notificationSpy).toHaveBeenCalled();

      const stats = server.getStats();
      expect(stats.toolCallsByName['health-check']).toBe(2);
      expect(stats.toolCallsByName['metrics']).toBe(2);
    });
  });
});