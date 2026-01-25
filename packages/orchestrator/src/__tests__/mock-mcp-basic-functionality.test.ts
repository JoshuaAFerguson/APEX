/**
 * @fileoverview Basic Mock MCP Server Functionality Test
 *
 * Simple test to verify the core mock server functionality works as expected.
 * This serves as a smoke test for the implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockMCPServerFacade,
  createSimpleMockServer,
  type MockToolHandler,
} from '../mcp/mock-server/index.js';

describe('Mock MCP Server - Basic Functionality', () => {
  let server: MockMCPServerFacade;

  afterEach(async () => {
    if (server?.isStarted()) {
      await server.stop();
    }
  });

  it('should create and start a basic mock server', async () => {
    // Arrange
    const toolHandlers: MockToolHandler[] = [
      {
        toolName: 'echo',
        response: {
          content: [{ type: 'text', text: 'Hello from mock server!' }],
          isError: false,
        },
      },
    ];

    // Act
    server = createSimpleMockServer('basic-test-server', toolHandlers);

    // Assert
    expect(server).toBeDefined();
    expect(server.isStarted()).toBe(false);

    await server.start();
    expect(server.isStarted()).toBe(true);

    const transport = server.getTransport();
    expect(transport).toBeDefined();
    expect(transport.isConnected()).toBe(false);

    await transport.connect();
    expect(transport.isConnected()).toBe(true);
  });

  it('should handle basic MCP protocol messages', async () => {
    // Arrange
    server = createSimpleMockServer('protocol-test-server', [
      {
        toolName: 'test_tool',
        response: {
          content: [{ type: 'text', text: 'Test response' }],
          isError: false,
        },
      },
    ]);

    await server.start();
    const transport = server.getTransport();
    await transport.connect();

    // Act & Assert - Initialize
    const initResponse = await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    expect(initResponse.jsonrpc).toBe('2.0');
    expect(initResponse.id).toBe(1);
    expect(initResponse.result).toMatchObject({
      protocolVersion: '2024-11-05',
      capabilities: expect.any(Object),
      serverInfo: expect.any(Object),
    });

    // Act & Assert - List Tools
    const listResponse = await transport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(listResponse.result.tools).toBeInstanceOf(Array);
    expect(listResponse.result.tools).toHaveLength(1);
    expect(listResponse.result.tools[0].name).toBe('test_tool');

    // Act & Assert - Call Tool
    const callResponse = await transport.send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'test_tool',
        arguments: {},
      },
    });

    expect(callResponse.result).toMatchObject({
      content: [{ type: 'text', text: 'Test response' }],
      isError: false,
    });

    // Verify assertions work
    server.assertMethodCalled('initialize', 1);
    server.assertMethodCalled('tools/list', 1);
    server.assertToolCalled('test_tool', 1);
  });

  it('should provide request history and statistics', async () => {
    // Arrange
    server = createSimpleMockServer('stats-test-server');
    await server.start();
    const transport = server.getTransport();
    await transport.connect();

    // Act
    await transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });

    await transport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
      params: {},
    });

    // Assert
    const history = server.getRequestHistory();
    expect(history).toHaveLength(2);

    const stats = server.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.requestsByMethod['tools/list']).toBe(1);
    expect(stats.requestsByMethod['ping']).toBe(1);
    expect(stats.totalErrorsInjected).toBe(0);
    expect(stats.uptimeMs).toBeGreaterThan(0);
  });

  it('should handle connection lifecycle correctly', async () => {
    // Arrange
    server = createSimpleMockServer('lifecycle-test-server');

    // Act & Assert - Server lifecycle
    expect(server.isStarted()).toBe(false);
    await server.start();
    expect(server.isStarted()).toBe(true);

    // Act & Assert - Transport lifecycle
    const transport = server.getTransport();
    expect(transport.isConnected()).toBe(false);

    await transport.connect();
    expect(transport.isConnected()).toBe(true);

    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);

    await server.stop();
    expect(server.isStarted()).toBe(false);
  });
});