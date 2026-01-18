/**
 * Unit Tests for MCPConnectionManager.executeTool() Method
 *
 * Comprehensive testing of the tool execution routing functionality
 * that ensures MCP tool invocations go through MCPConnectionManager.executeTool()
 * with proper error handling and event emission.
 *
 * Test Coverage:
 * ✓ Success path - tool execution returns result
 * ✓ Tool start event emission
 * ✓ Tool complete event emission on success
 * ✓ Tool error event emission on failure
 * ✓ MCPToolExecutionError throwing on failure
 * ✓ Connection state validation before execution
 * ✓ Metrics updates on success/failure
 * ✓ Error categorization and retryability
 * ✓ Connection not found error handling
 * ✓ Connection not ready error handling
 * ✓ Timeout error handling
 * ✓ Disconnection error handling
 * ✓ Generic execution errors
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import {
  MCPConnectionManager,
  MCPToolExecutionError,
  type MCPConnectionManagerOptions,
  type MCPConnectionManagerEvents,
  type MCPToolStartEvent,
  type MCPToolCompleteEvent,
  type MCPToolErrorEvent,
} from '../connection-manager.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock transport with enhanced functionality for tool execution tests
class MockTransport extends EventEmitter {
  public isConnectedState = true;
  public shouldFailConnect = false;
  public callToolResponse: any = { success: true, result: 'Mock tool result' };
  public callToolError: Error | null = null;
  public callToolDelay = 0;

  async connect(): Promise<void> {
    if (this.shouldFailConnect) {
      throw new Error('Mock transport connection failed');
    }
    this.isConnectedState = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.isConnectedState = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.isConnectedState;
  }

  getState(): string {
    return this.isConnectedState ? 'connected' : 'disconnected';
  }

  async send(message: any): Promise<void> {
    // Mock send implementation
  }
}

// Mock MCP client with enhanced tool execution capabilities
class MockMCPClient {
  public transport: MockTransport;
  public callToolMock: Mock;

  constructor(transport: MockTransport) {
    this.transport = transport;
    this.callToolMock = vi.fn();
  }

  async listTools(): Promise<any[]> {
    return [
      { name: 'test-tool', description: 'A test tool for unit tests' },
      { name: 'another-tool', description: 'Another test tool' },
    ];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    // Call the mock to track invocations
    this.callToolMock(name, args);

    // Apply artificial delay if configured
    if (this.transport.callToolDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.transport.callToolDelay));
    }

    // Throw error if configured
    if (this.transport.callToolError) {
      throw this.transport.callToolError;
    }

    // Return configured response
    return this.transport.callToolResponse;
  }

  async ping(): Promise<boolean> {
    return this.transport.isConnected();
  }
}

// Mock the transport and client modules
vi.mock('../transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => new MockTransport()),
}));

vi.mock('../client.js', () => ({
  MCPClient: vi.fn().mockImplementation((config) => new MockMCPClient(config.transport)),
}));

// ============================================================================
// Test Suite
// ============================================================================

describe('MCPConnectionManager.executeTool()', () => {
  let manager: MCPConnectionManager;
  let mockConfig: ApexConfig;
  let mockTransport: MockTransport;
  let mockClient: MockMCPClient;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create test configuration
    mockConfig = {
      mcp: {
        servers: {
          'test-server': {
            id: 'test-server',
            name: 'Test MCP Server',
            command: 'test-server',
            args: [],
            env: {},
          } as MCPServerConfig,
        },
      },
    } as ApexConfig;

    // Create manager
    const options: MCPConnectionManagerOptions = {
      projectPath: '/test/project',
      config: mockConfig,
      autoReconnect: false, // Disable auto-reconnect for predictable tests
    };

    manager = new MCPConnectionManager(options);

    // Connect to test server to set up the connection
    await manager.connect('test-server');

    // Get references to the mocked transport and client
    const connections = (manager as any).connections;
    const context = connections.get('test-server');
    mockTransport = context.transport;
    mockClient = context.client;
  });

  afterEach(async () => {
    // Clean up connections
    if (manager) {
      await manager.disconnect('test-server');
    }
  });

  describe('successful tool execution', () => {
    it('should execute tool and return result', async () => {
      // Configure successful response
      mockTransport.callToolResponse = { data: 'test result', status: 'success' };

      // Execute tool
      const result = await manager.executeTool('test-server', 'test-tool', { param1: 'value1' });

      // Verify result
      expect(result).toEqual({ data: 'test result', status: 'success' });

      // Verify client was called with correct parameters
      expect(mockClient.callToolMock).toHaveBeenCalledWith('test-tool', { param1: 'value1' });
      expect(mockClient.callToolMock).toHaveBeenCalledTimes(1);
    });

    it('should emit tool:start event before execution', async () => {
      const startEventSpy = vi.fn();
      manager.on('tool:start', startEventSpy);

      mockTransport.callToolResponse = 'success result';

      await manager.executeTool('test-server', 'test-tool', { input: 'data' });

      expect(startEventSpy).toHaveBeenCalledTimes(1);

      const startEvent: MCPToolStartEvent = startEventSpy.mock.calls[0][0];
      expect(startEvent.serverId).toBe('test-server');
      expect(startEvent.serverName).toBe('Test MCP Server');
      expect(startEvent.toolName).toBe('test-tool');
      expect(startEvent.args).toEqual({ input: 'data' });
      expect(startEvent.callId).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      expect(startEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should emit tool:complete event after successful execution', async () => {
      const completeEventSpy = vi.fn();
      manager.on('tool:complete', completeEventSpy);

      mockTransport.callToolResponse = { result: 'completed successfully' };
      mockTransport.callToolDelay = 100; // Add delay to test duration measurement

      const startTime = Date.now();
      await manager.executeTool('test-server', 'test-tool', { test: 'params' });
      const endTime = Date.now();

      expect(completeEventSpy).toHaveBeenCalledTimes(1);

      const completeEvent: MCPToolCompleteEvent = completeEventSpy.mock.calls[0][0];
      expect(completeEvent.serverId).toBe('test-server');
      expect(completeEvent.serverName).toBe('Test MCP Server');
      expect(completeEvent.toolName).toBe('test-tool');
      expect(completeEvent.result).toEqual({ result: 'completed successfully' });
      expect(completeEvent.callId).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      expect(completeEvent.timestamp).toBeInstanceOf(Date);
      expect(completeEvent.durationMs).toBeGreaterThanOrEqual(90); // Account for timing variations
      expect(completeEvent.durationMs).toBeLessThanOrEqual(endTime - startTime + 50);
    });

    it('should update connection metrics on successful execution', async () => {
      mockTransport.callToolResponse = 'success';

      // Get initial metrics
      const connections = (manager as any).connections;
      const context = connections.get('test-server');
      const initialRequests = context.metrics.totalRequests;

      // Execute tool
      await manager.executeTool('test-server', 'test-tool', {});

      // Verify metrics were updated
      expect(context.metrics.totalRequests).toBe(initialRequests + 1);
    });
  });

  describe('error handling', () => {
    it('should throw MCPToolExecutionError when connection not found', async () => {
      await expect(
        manager.executeTool('nonexistent-server', 'test-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      try {
        await manager.executeTool('nonexistent-server', 'test-tool', {});
      } catch (error) {
        expect(error).toBeInstanceOf(MCPToolExecutionError);
        expect((error as MCPToolExecutionError).code).toBe('CONNECTION_NOT_FOUND');
        expect((error as MCPToolExecutionError).retriable).toBe(false);
        expect(error.message).toContain("Connection 'nonexistent-server' not found");
      }
    });

    it('should throw MCPToolExecutionError when connection not ready', async () => {
      // Disconnect the server to make it not ready
      await manager.disconnect('test-server');

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      try {
        await manager.executeTool('test-server', 'test-tool', {});
      } catch (error) {
        expect(error).toBeInstanceOf(MCPToolExecutionError);
        expect((error as MCPToolExecutionError).code).toBe('CONNECTION_NOT_READY');
        expect((error as MCPToolExecutionError).retriable).toBe(true);
        expect(error.message).toContain('is not connected');
      }
    });

    it('should emit tool:error event and throw on execution failure', async () => {
      const errorEventSpy = vi.fn();
      manager.on('tool:error', errorEventSpy);

      // Configure client to throw error
      const testError = new Error('Tool execution failed');
      mockTransport.callToolError = testError;

      await expect(
        manager.executeTool('test-server', 'test-tool', { input: 'data' })
      ).rejects.toThrow(MCPToolExecutionError);

      // Verify error event was emitted
      expect(errorEventSpy).toHaveBeenCalledTimes(1);

      const errorEvent: MCPToolErrorEvent = errorEventSpy.mock.calls[0][0];
      expect(errorEvent.serverId).toBe('test-server');
      expect(errorEvent.serverName).toBe('Test MCP Server');
      expect(errorEvent.toolName).toBe('test-tool');
      expect(errorEvent.error).toBe('Tool execution failed');
      expect(errorEvent.errorCode).toBe('EXECUTION_ERROR');
      expect(errorEvent.retriable).toBe(false);
      expect(errorEvent.callId).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      expect(errorEvent.timestamp).toBeInstanceOf(Date);
      expect(errorEvent.durationMs).toBeGreaterThan(0);
    });

    it('should categorize timeout errors as retriable', async () => {
      const errorEventSpy = vi.fn();
      manager.on('tool:error', errorEventSpy);

      // Configure client to throw timeout error
      mockTransport.callToolError = new Error('Request timeout after 30s');

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      const errorEvent: MCPToolErrorEvent = errorEventSpy.mock.calls[0][0];
      expect(errorEvent.errorCode).toBe('TIMEOUT');
      expect(errorEvent.retriable).toBe(true);
    });

    it('should categorize disconnect errors as retriable', async () => {
      const errorEventSpy = vi.fn();
      manager.on('tool:error', errorEventSpy);

      // Configure client to throw disconnect error
      mockTransport.callToolError = new Error('Connection was disconnected');

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      const errorEvent: MCPToolErrorEvent = errorEventSpy.mock.calls[0][0];
      expect(errorEvent.errorCode).toBe('DISCONNECTED');
      expect(errorEvent.retriable).toBe(true);
    });

    it('should categorize tool not found errors as non-retriable', async () => {
      const errorEventSpy = vi.fn();
      manager.on('tool:error', errorEventSpy);

      // Configure client to throw tool not found error
      mockTransport.callToolError = new Error('Tool not found: invalid-tool');

      await expect(
        manager.executeTool('test-server', 'invalid-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      const errorEvent: MCPToolErrorEvent = errorEventSpy.mock.calls[0][0];
      expect(errorEvent.errorCode).toBe('TOOL_NOT_FOUND');
      expect(errorEvent.retriable).toBe(false);
    });

    it('should update error metrics on failure', async () => {
      // Configure client to throw error
      mockTransport.callToolError = new Error('Test execution failure');

      // Get initial metrics
      const connections = (manager as any).connections;
      const context = connections.get('test-server');
      const initialRequests = context.metrics.totalRequests;
      const initialErrors = context.metrics.totalErrors;

      // Execute tool (should fail)
      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow();

      // Verify metrics were updated
      expect(context.metrics.totalRequests).toBe(initialRequests + 1);
      expect(context.metrics.totalErrors).toBe(initialErrors + 1);
      expect(context.metrics.lastError).toEqual({
        message: 'Test execution failure',
        timestamp: expect.any(Date),
        code: 'EXECUTION_ERROR',
      });
    });
  });

  describe('call ID generation', () => {
    it('should generate unique call IDs for each execution', async () => {
      const startEventSpy = vi.fn();
      manager.on('tool:start', startEventSpy);

      mockTransport.callToolResponse = 'result';

      // Execute multiple tools
      await manager.executeTool('test-server', 'tool1', {});
      await manager.executeTool('test-server', 'tool2', {});
      await manager.executeTool('test-server', 'tool3', {});

      expect(startEventSpy).toHaveBeenCalledTimes(3);

      // Extract call IDs
      const callId1 = startEventSpy.mock.calls[0][0].callId;
      const callId2 = startEventSpy.mock.calls[1][0].callId;
      const callId3 = startEventSpy.mock.calls[2][0].callId;

      // Verify uniqueness
      expect(callId1).not.toBe(callId2);
      expect(callId2).not.toBe(callId3);
      expect(callId1).not.toBe(callId3);

      // Verify format
      expect(callId1).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      expect(callId2).toMatch(/^mcp-\d+-[a-z0-9]+$/);
      expect(callId3).toMatch(/^mcp-\d+-[a-z0-9]+$/);
    });
  });

  describe('event correlation', () => {
    it('should use same call ID across start/complete events for successful execution', async () => {
      const startEventSpy = vi.fn();
      const completeEventSpy = vi.fn();
      manager.on('tool:start', startEventSpy);
      manager.on('tool:complete', completeEventSpy);

      mockTransport.callToolResponse = 'success';

      await manager.executeTool('test-server', 'test-tool', {});

      expect(startEventSpy).toHaveBeenCalledTimes(1);
      expect(completeEventSpy).toHaveBeenCalledTimes(1);

      const startCallId = startEventSpy.mock.calls[0][0].callId;
      const completeCallId = completeEventSpy.mock.calls[0][0].callId;

      expect(startCallId).toBe(completeCallId);
    });

    it('should use same call ID across start/error events for failed execution', async () => {
      const startEventSpy = vi.fn();
      const errorEventSpy = vi.fn();
      manager.on('tool:start', startEventSpy);
      manager.on('tool:error', errorEventSpy);

      mockTransport.callToolError = new Error('Execution failed');

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow();

      expect(startEventSpy).toHaveBeenCalledTimes(1);
      expect(errorEventSpy).toHaveBeenCalledTimes(1);

      const startCallId = startEventSpy.mock.calls[0][0].callId;
      const errorCallId = errorEventSpy.mock.calls[0][0].callId;

      expect(startCallId).toBe(errorCallId);
    });
  });

  describe('edge cases', () => {
    it('should handle non-Error exceptions', async () => {
      const errorEventSpy = vi.fn();
      manager.on('tool:error', errorEventSpy);

      // Configure client to throw non-Error object
      mockTransport.callToolError = 'String error' as any;

      await expect(
        manager.executeTool('test-server', 'test-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      const errorEvent: MCPToolErrorEvent = errorEventSpy.mock.calls[0][0];
      expect(errorEvent.error).toBe('String error');
      expect(errorEvent.errorCode).toBe('EXECUTION_ERROR');
    });

    it('should handle complex tool arguments', async () => {
      mockTransport.callToolResponse = { success: true };

      const complexArgs = {
        nested: {
          object: { value: 42 },
          array: [1, 2, 3],
        },
        stringValue: 'test',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
      };

      await manager.executeTool('test-server', 'complex-tool', complexArgs);

      expect(mockClient.callToolMock).toHaveBeenCalledWith('complex-tool', complexArgs);
    });

    it('should handle empty tool arguments', async () => {
      mockTransport.callToolResponse = 'empty args result';

      await manager.executeTool('test-server', 'no-args-tool', {});

      expect(mockClient.callToolMock).toHaveBeenCalledWith('no-args-tool', {});
    });
  });
});