/**
 * Unit Tests for MCP Proxy Server
 *
 * Tests the MCP proxy server that routes Claude Agent SDK tool calls
 * through MCPConnectionManager.executeTool() for centralized handling.
 *
 * Test Coverage:
 * ✓ Proxy server creation with tools from registry
 * ✓ Tool definition mapping from MCP to SDK format
 * ✓ Tool execution routing through connection manager
 * ✓ Successful result formatting for SDK
 * ✓ Error formatting for SDK
 * ✓ Tool registry integration
 * ✓ Connection manager integration
 * ✓ Server name and configuration
 * ✓ Dynamic server refresh functionality
 * ✓ Edge cases and error scenarios
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { z } from 'zod';
import {
  buildMCPProxyServer,
  refreshMCPProxyServer,
  type MCPProxyServerOptions,
  type MCPProxyServer,
} from '../mcp-proxy-server.js';
import type {
  MCPConnectionManager,
  MCPToolExecutionError,
} from '../mcp/connection-manager.js';
import type {
  MCPToolRegistry,
  MCPToolRegistryEntry,
} from '../mcp-tool-registry.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Claude Agent SDK
const mockTool = vi.fn();
const mockCreateSdkMcpServer = vi.fn();

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: mockTool,
  createSdkMcpServer: mockCreateSdkMcpServer,
}));

// Mock connection manager
class MockMCPConnectionManager {
  public executeToolMock: Mock;

  constructor() {
    this.executeToolMock = vi.fn();
  }

  async executeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<any> {
    return this.executeToolMock(serverId, toolName, args);
  }
}

// Mock tool registry
class MockMCPToolRegistry {
  public tools: MCPToolRegistryEntry[] = [];

  getAvailableTools(): MCPToolRegistryEntry[] {
    return this.tools;
  }

  addTool(tool: MCPToolRegistryEntry): void {
    this.tools.push(tool);
  }

  clear(): void {
    this.tools = [];
  }
}

// Sample tool definitions for testing
const createSampleTool = (name: string, connectionId: string = 'test-server'): MCPToolRegistryEntry => ({
  mcpTool: {
    name,
    description: `Test tool: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
  },
  claudeTool: {
    name,
    description: `Test tool: ${name}`,
    parameters: z.object({
      input: z.string(),
    }),
  },
  connectionId,
  serverName: 'Test MCP Server',
});

// ============================================================================
// Test Suite
// ============================================================================

describe('MCP Proxy Server', () => {
  let mockConnectionManager: MockMCPConnectionManager;
  let mockToolRegistry: MockMCPToolRegistry;
  let proxyOptions: MCPProxyServerOptions;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockTool.mockClear();
    mockCreateSdkMcpServer.mockClear();

    // Create fresh mock instances
    mockConnectionManager = new MockMCPConnectionManager();
    mockToolRegistry = new MockMCPToolRegistry();

    // Setup proxy options
    proxyOptions = {
      connectionManager: mockConnectionManager as any,
      toolRegistry: mockToolRegistry as any,
      name: 'test-proxy',
    };

    // Configure SDK mocks to return predictable values
    mockTool.mockImplementation((name, description, schema, handler) => ({
      name,
      description,
      schema,
      handler,
    }));

    mockCreateSdkMcpServer.mockImplementation((config) => ({
      name: config.name,
      tools: config.tools,
    }));
  });

  describe('buildMCPProxyServer', () => {
    it('should create proxy server with default name when not specified', () => {
      const optionsWithoutName = {
        connectionManager: mockConnectionManager as any,
        toolRegistry: mockToolRegistry as any,
      };

      const proxyServer = buildMCPProxyServer(optionsWithoutName);

      expect(proxyServer.name).toBe('mcp-proxy');
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'mcp-proxy',
        tools: [],
      });
    });

    it('should create proxy server with specified name', () => {
      const proxyServer = buildMCPProxyServer(proxyOptions);

      expect(proxyServer.name).toBe('test-proxy');
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'test-proxy',
        tools: [],
      });
    });

    it('should create tool definitions from registry entries', () => {
      // Add sample tools to registry
      const tool1 = createSampleTool('file-reader', 'server1');
      const tool2 = createSampleTool('api-client', 'server2');
      mockToolRegistry.addTool(tool1);
      mockToolRegistry.addTool(tool2);

      const proxyServer = buildMCPProxyServer(proxyOptions);

      expect(mockTool).toHaveBeenCalledTimes(2);

      // Verify first tool
      expect(mockTool).toHaveBeenNthCalledWith(
        1,
        'file-reader',
        'Test tool: file-reader',
        tool1.claudeTool.parameters,
        expect.any(Function)
      );

      // Verify second tool
      expect(mockTool).toHaveBeenNthCalledWith(
        2,
        'api-client',
        'Test tool: api-client',
        tool2.claudeTool.parameters,
        expect.any(Function)
      );

      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'test-proxy',
        tools: [
          expect.objectContaining({ name: 'file-reader' }),
          expect.objectContaining({ name: 'api-client' }),
        ],
      });
    });
  });

  describe('tool execution routing', () => {
    let toolHandler: Function;

    beforeEach(() => {
      // Setup a tool and capture its handler
      const testTool = createSampleTool('test-tool', 'test-server');
      mockToolRegistry.addTool(testTool);

      buildMCPProxyServer(proxyOptions);

      // Extract the handler function
      const toolCall = mockTool.mock.calls[0];
      toolHandler = toolCall[3]; // Fourth parameter is the handler
    });

    it('should route tool execution through connection manager', async () => {
      mockConnectionManager.executeToolMock.mockResolvedValue({
        success: true,
        data: 'test result',
      });

      const args = { input: 'test data' };
      const result = await toolHandler(args);

      // Verify connection manager was called
      expect(mockConnectionManager.executeToolMock).toHaveBeenCalledWith(
        'test-server',
        'test-tool',
        args
      );

      // Verify result format for Claude Agent SDK
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data: 'test result' }, null, 2),
          },
        ],
      });
    });

    it('should format string results correctly', async () => {
      mockConnectionManager.executeToolMock.mockResolvedValue('Simple string result');

      const result = await toolHandler({ input: 'test' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Simple string result',
          },
        ],
      });
    });

    it('should format object results as JSON', async () => {
      const complexResult = {
        success: true,
        data: {
          items: [1, 2, 3],
          metadata: { count: 3 },
        },
      };

      mockConnectionManager.executeToolMock.mockResolvedValue(complexResult);

      const result = await toolHandler({ input: 'test' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(complexResult, null, 2),
          },
        ],
      });
    });

    it('should handle connection manager errors gracefully', async () => {
      const testError = new Error('Connection failed') as MCPToolExecutionError;
      testError.code = 'CONNECTION_NOT_READY';
      testError.retriable = true;

      mockConnectionManager.executeToolMock.mockRejectedValue(testError);

      const result = await toolHandler({ input: 'test' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error: Connection failed',
          },
        ],
        isError: true,
      });
    });

    it('should handle generic errors gracefully', async () => {
      mockConnectionManager.executeToolMock.mockRejectedValue(new Error('Generic error'));

      const result = await toolHandler({ input: 'test' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error: Generic error',
          },
        ],
        isError: true,
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockConnectionManager.executeToolMock.mockRejectedValue('String error');

      const result = await toolHandler({ input: 'test' });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error: String error',
          },
        ],
        isError: true,
      });
    });
  });

  describe('refreshMCPProxyServer', () => {
    it('should create new server config with updated tools', () => {
      // Create initial server
      const initialTool = createSampleTool('initial-tool');
      mockToolRegistry.addTool(initialTool);

      const initialServer = buildMCPProxyServer(proxyOptions);
      expect(mockTool).toHaveBeenCalledTimes(1);

      // Reset mocks and add new tool
      vi.clearAllMocks();
      mockTool.mockClear();
      const newTool = createSampleTool('new-tool');
      mockToolRegistry.addTool(newTool);

      // Refresh server
      const refreshedServer = refreshMCPProxyServer(initialServer, proxyOptions);

      // Verify new server was created with all tools
      expect(refreshedServer.name).toBe(initialServer.name);
      expect(mockTool).toHaveBeenCalledTimes(2); // Both tools registered
    });

    it('should preserve server name when refreshing', () => {
      const initialServer: MCPProxyServer = {
        name: 'custom-proxy-name',
        config: {} as any,
      };

      const refreshedServer = refreshMCPProxyServer(initialServer, proxyOptions);

      expect(refreshedServer.name).toBe('custom-proxy-name');
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'custom-proxy-name' })
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple tools from different servers', () => {
      const tools = [
        createSampleTool('server1-tool', 'server1'),
        createSampleTool('server2-tool', 'server2'),
        createSampleTool('server3-tool', 'server3'),
      ];

      tools.forEach(tool => mockToolRegistry.addTool(tool));

      buildMCPProxyServer(proxyOptions);

      // Verify all tools were registered
      expect(mockTool).toHaveBeenCalledTimes(3);

      // Verify tools route to correct servers
      const handlers = mockTool.mock.calls.map(call => call[3]);

      // Mock execution and test routing
      mockConnectionManager.executeToolMock
        .mockResolvedValueOnce('result from server1')
        .mockResolvedValueOnce('result from server2')
        .mockResolvedValueOnce('result from server3');

      handlers[0]({ input: 'test1' });
      handlers[1]({ input: 'test2' });
      handlers[2]({ input: 'test3' });

      expect(mockConnectionManager.executeToolMock).toHaveBeenNthCalledWith(
        1, 'server1', 'server1-tool', { input: 'test1' }
      );
      expect(mockConnectionManager.executeToolMock).toHaveBeenNthCalledWith(
        2, 'server2', 'server2-tool', { input: 'test2' }
      );
      expect(mockConnectionManager.executeToolMock).toHaveBeenNthCalledWith(
        3, 'server3', 'server3-tool', { input: 'test3' }
      );
    });

    it('should handle empty tool registry', () => {
      const proxyServer = buildMCPProxyServer(proxyOptions);

      expect(mockTool).not.toHaveBeenCalled();
      expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
        name: 'test-proxy',
        tools: [],
      });
      expect(proxyServer.name).toBe('test-proxy');
    });

    it('should handle complex tool schemas', () => {
      const complexTool: MCPToolRegistryEntry = {
        mcpTool: {
          name: 'complex-tool',
          description: 'A tool with complex schema',
          inputSchema: {
            type: 'object',
            properties: {
              required_string: { type: 'string' },
              optional_number: { type: 'number' },
              nested_object: {
                type: 'object',
                properties: {
                  inner_prop: { type: 'boolean' },
                },
              },
              array_prop: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['required_string'],
          },
        },
        claudeTool: {
          name: 'complex-tool',
          description: 'A tool with complex schema',
          parameters: z.object({
            required_string: z.string(),
            optional_number: z.number().optional(),
            nested_object: z.object({
              inner_prop: z.boolean(),
            }).optional(),
            array_prop: z.array(z.string()).optional(),
          }),
        },
        connectionId: 'complex-server',
        serverName: 'Complex Test Server',
      };

      mockToolRegistry.addTool(complexTool);
      buildMCPProxyServer(proxyOptions);

      expect(mockTool).toHaveBeenCalledWith(
        'complex-tool',
        'A tool with complex schema',
        complexTool.claudeTool.parameters,
        expect.any(Function)
      );
    });
  });

  describe('error edge cases', () => {
    it('should handle tool registry returning undefined/null entries', () => {
      // Mock registry to return some invalid entries
      mockToolRegistry.getAvailableTools = vi.fn().mockReturnValue([
        createSampleTool('valid-tool'),
        null,
        undefined,
        createSampleTool('another-valid-tool'),
      ].filter(Boolean)); // This simulates registry filtering out invalid entries

      buildMCPProxyServer(proxyOptions);

      // Should only register valid tools
      expect(mockTool).toHaveBeenCalledTimes(2);
      expect(mockTool).toHaveBeenNthCalledWith(1, 'valid-tool', expect.any(String), expect.any(Object), expect.any(Function));
      expect(mockTool).toHaveBeenNthCalledWith(2, 'another-valid-tool', expect.any(String), expect.any(Object), expect.any(Function));
    });
  });
});