/**
 * MCP Event Forwarding Tests
 *
 * Comprehensive test suite for MCP event forwarding functionality in ApexOrchestrator.
 * Tests that all MCPConnectionManager events are properly forwarded through the
 * ApexOrchestrator's EventEmitter with consistent naming conventions and complete metadata.
 *
 * Tested Events:
 * - mcp:connected
 * - mcp:disconnected
 * - mcp:error
 * - mcp:reconnecting
 * - mcp:health-check
 * - mcp:state-change
 * - mcp:pool-change
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig } from '@apexcli/core';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Create a mock MCPConnectionManager that extends EventEmitter
class MockMCPConnectionManager extends EventEmitter {
  public discoverServers = vi.fn().mockReturnValue([]);
  public connect = vi.fn().mockResolvedValue({});
  public disconnect = vi.fn().mockResolvedValue(undefined);
  public disconnectAll = vi.fn().mockResolvedValue(undefined);
  public listConnections = vi.fn().mockReturnValue([]);
  public getConnection = vi.fn().mockReturnValue(undefined);
  public getClient = vi.fn().mockReturnValue(undefined);
  public updateConfig = vi.fn();

  constructor() {
    super();
  }

  // Helper method to simulate MCP events for testing
  public simulateEvent(eventName: string, ...args: any[]) {
    this.emit(eventName, ...args);
  }
}

// Mock the MCPConnectionManager module
vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: MockMCPConnectionManager
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

describe('MCP Event Forwarding', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;
  let mockMCPManager: MockMCPConnectionManager;
  let eventListener: vi.MockedFunction<(...args: any[]) => void>;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'test-project',
        description: 'Test project for MCP event forwarding',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          connectionTimeoutMs: 10000,
          healthCheckIntervalMs: 30000,
          autoReconnect: true,
        },
        servers: {
          'test-server': {
            name: 'Test MCP Server',
            type: 'stdio',
            command: 'node',
            args: ['test-server.js'],
          }
        }
      },
      agents: {},
      workflows: {},
    };

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.readFile.mockResolvedValue('{}');
    mockFS.writeFile.mockResolvedValue(undefined);

    // Mock TaskStore
    const mockStore = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTaskById: vi.fn().mockResolvedValue(null),
      createTask: vi.fn().mockResolvedValue('task-1'),
      updateTask: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    MockTaskStore.mockImplementation(() => mockStore as any);

    // Create orchestrator and get the mock MCP manager
    orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
    // Access the mock through the constructor call
    mockMCPManager = (MockMCPConnectionManager as any).mock.results[0]?.value;

    // Setup event listener spy
    eventListener = vi.fn();
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.disconnectAll?.();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    vi.clearAllMocks();
  });

  describe('Connection Events', () => {
    it('should forward mcp:connected event with complete metadata', () => {
      // Listen for the forwarded event
      orchestrator.on('mcp:connected', eventListener);

      // Simulate connection event from MCPConnectionManager
      const mockConnection = {
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        status: 'connected',
        config: {
          url: 'stdio://test-server.js',
          type: 'stdio' as const,
        },
      };

      mockMCPManager.simulateEvent('connected', mockConnection);

      // Verify the event was forwarded with correct structure
      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        status: 'connected',
        timestamp: expect.any(Date),
        connectionInfo: {
          type: 'stdio',
          url: 'stdio://test-server.js',
        },
      });
    });

    it('should forward mcp:disconnected event with reason and metadata', () => {
      // Listen for the forwarded event
      orchestrator.on('mcp:disconnected', eventListener);

      // Mock getConnection to return connection info
      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate disconnection event
      mockMCPManager.simulateEvent('disconnected', 'test-server-1', 'Connection timeout');

      // Verify the event was forwarded
      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        reason: 'Connection timeout',
        timestamp: expect.any(Date),
      });
    });

    it('should handle disconnection when connection info is not available', () => {
      orchestrator.on('mcp:disconnected', eventListener);

      // Mock getConnection to return null (connection not found)
      mockMCPManager.getConnection.mockReturnValue(null);

      // Simulate disconnection event
      mockMCPManager.simulateEvent('disconnected', 'unknown-server', 'Server not found');

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'unknown-server',
        serverName: 'unknown-server', // Falls back to serverId
        reason: 'Server not found',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Error Events', () => {
    it('should forward mcp:error event with error details', () => {
      orchestrator.on('mcp:error', eventListener);

      // Mock getConnection to return connection info
      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate error event
      const testError = new Error('Connection failed');
      testError.name = 'CONNECTION_ERROR';
      mockMCPManager.simulateEvent('error', 'test-server-1', testError);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        error: testError,
        message: 'Connection failed',
        timestamp: expect.any(Date),
        code: 'CONNECTION_ERROR',
      });
    });

    it('should handle error event with unknown error type', () => {
      orchestrator.on('mcp:error', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate error with no name property
      const testError = new Error('Unknown error');
      mockMCPManager.simulateEvent('error', 'test-server-1', testError);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.code).toBe('UNKNOWN_ERROR');
      expect(eventData.error).toBe(testError);
      expect(eventData.message).toBe('Unknown error');
    });
  });

  describe('Reconnection Events', () => {
    it('should forward mcp:reconnecting event with attempt details', () => {
      orchestrator.on('mcp:reconnecting', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate reconnection event
      mockMCPManager.simulateEvent('reconnecting', 'test-server-1', 2, 5);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        attempt: 2,
        maxAttempts: 5,
        timestamp: expect.any(Date),
      });
    });

    it('should handle reconnecting event with fallback server name', () => {
      orchestrator.on('mcp:reconnecting', eventListener);

      // Mock getConnection to return null
      mockMCPManager.getConnection.mockReturnValue(null);

      mockMCPManager.simulateEvent('reconnecting', 'fallback-server', 1, 3);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.serverId).toBe('fallback-server');
      expect(eventData.serverName).toBe('fallback-server'); // Falls back to serverId
    });
  });

  describe('Health Check Events', () => {
    it('should forward mcp:health-check event with health status', () => {
      orchestrator.on('mcp:health-check', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate health check event
      const healthResult = {
        isHealthy: true,
        responseTimeMs: 150,
        timestamp: new Date(),
      };
      mockMCPManager.simulateEvent('healthCheck', 'test-server-1', healthResult);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        result: healthResult,
        responseTimeMs: 150,
        isHealthy: true,
        timestamp: healthResult.timestamp,
      });
    });

    it('should forward mcp:health-check event for unhealthy server', () => {
      orchestrator.on('mcp:health-check', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Failing Server'
      });

      const healthResult = {
        isHealthy: false,
        responseTimeMs: null,
        error: 'Timeout',
        timestamp: new Date(),
      };
      mockMCPManager.simulateEvent('healthCheck', 'failing-server', healthResult);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.isHealthy).toBe(false);
      expect(eventData.result.error).toBe('Timeout');
    });
  });

  describe('State Change Events', () => {
    it('should forward mcp:state-change event with state transition', () => {
      orchestrator.on('mcp:state-change', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate state change event
      mockMCPManager.simulateEvent('stateChange', 'test-server-1', 'connecting', 'connected');

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        previousState: 'connecting',
        newState: 'connected',
        timestamp: expect.any(Date),
      });
    });

    it('should handle state change for various connection states', () => {
      orchestrator.on('mcp:state-change', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Test multiple state transitions
      const stateTransitions = [
        ['disconnected', 'connecting'],
        ['connecting', 'connected'],
        ['connected', 'error'],
        ['error', 'reconnecting'],
        ['reconnecting', 'connected']
      ];

      stateTransitions.forEach(([prevState, newState], index) => {
        mockMCPManager.simulateEvent('stateChange', 'test-server-1', prevState, newState);

        expect(eventListener).toHaveBeenCalledTimes(index + 1);
        const eventData = eventListener.mock.calls[index][0];

        expect(eventData.previousState).toBe(prevState);
        expect(eventData.newState).toBe(newState);
      });
    });
  });

  describe('Pool Change Events', () => {
    it('should forward mcp:pool-change event with pool statistics', () => {
      orchestrator.on('mcp:pool-change', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Simulate pool change event
      mockMCPManager.simulateEvent('poolChange', 'test-server-1', 5, 3);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData).toEqual({
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        poolSize: 5,
        activeConnections: 3,
        timestamp: expect.any(Date),
      });
    });

    it('should handle pool changes with zero connections', () => {
      orchestrator.on('mcp:pool-change', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Empty Pool Server'
      });

      mockMCPManager.simulateEvent('poolChange', 'empty-server', 0, 0);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.poolSize).toBe(0);
      expect(eventData.activeConnections).toBe(0);
    });
  });

  describe('Event System Integration', () => {
    it('should maintain event ordering when multiple events are emitted', () => {
      const events: string[] = [];

      // Listen to all MCP events
      orchestrator.on('mcp:connected', () => events.push('connected'));
      orchestrator.on('mcp:state-change', () => events.push('state-change'));
      orchestrator.on('mcp:health-check', () => events.push('health-check'));

      // Mock connection for all events
      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test MCP Server'
      });

      // Emit events in sequence
      mockMCPManager.simulateEvent('connected', {
        serverId: 'test-server-1',
        serverName: 'Test MCP Server',
        status: 'connected',
        config: { url: 'test://server', type: 'stdio' }
      });

      mockMCPManager.simulateEvent('stateChange', 'test-server-1', 'connecting', 'connected');

      mockMCPManager.simulateEvent('healthCheck', 'test-server-1', {
        isHealthy: true,
        responseTimeMs: 100,
        timestamp: new Date()
      });

      // Verify all events were emitted in correct order
      expect(events).toEqual(['connected', 'state-change', 'health-check']);
    });

    it('should handle multiple concurrent event listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      // Add multiple listeners to the same event
      orchestrator.on('mcp:connected', listener1);
      orchestrator.on('mcp:connected', listener2);
      orchestrator.on('mcp:connected', listener3);

      // Emit event
      mockMCPManager.simulateEvent('connected', {
        serverId: 'multi-listener-test',
        serverName: 'Multi Listener Server',
        status: 'connected',
        config: { url: 'test://server', type: 'stdio' }
      });

      // Verify all listeners were called
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      // Verify they all received the same event data
      expect(listener1.mock.calls[0][0]).toEqual(listener2.mock.calls[0][0]);
      expect(listener2.mock.calls[0][0]).toEqual(listener3.mock.calls[0][0]);
    });

    it('should not interfere with other orchestrator events', () => {
      const mcpListener = vi.fn();
      const otherListener = vi.fn();

      // Listen to both MCP and non-MCP events
      orchestrator.on('mcp:connected', mcpListener);
      orchestrator.on('task:created', otherListener);

      // Emit MCP event
      mockMCPManager.simulateEvent('connected', {
        serverId: 'interference-test',
        serverName: 'Interference Test Server',
        status: 'connected',
        config: { url: 'test://server', type: 'stdio' }
      });

      // Emit other orchestrator event
      orchestrator.emit('task:created', { taskId: 'test-task', status: 'pending' });

      // Verify both listeners were called independently
      expect(mcpListener).toHaveBeenCalledTimes(1);
      expect(otherListener).toHaveBeenCalledTimes(1);

      // Verify event data is correct for each
      expect(mcpListener.mock.calls[0][0].serverId).toBe('interference-test');
      expect(otherListener.mock.calls[0][0].taskId).toBe('test-task');
    });
  });

  describe('Error Handling in Event Forwarding', () => {
    it('should handle missing connection information gracefully', () => {
      orchestrator.on('mcp:error', eventListener);

      // Mock getConnection to return null for all calls
      mockMCPManager.getConnection.mockReturnValue(null);

      const testError = new Error('Test error');
      mockMCPManager.simulateEvent('error', 'missing-connection', testError);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      // Should use serverId as fallback for serverName
      expect(eventData.serverId).toBe('missing-connection');
      expect(eventData.serverName).toBe('missing-connection');
      expect(eventData.error).toBe(testError);
    });

    it('should handle event emission errors gracefully', () => {
      // Create a listener that throws an error
      const faultyListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      orchestrator.on('mcp:connected', faultyListener);
      orchestrator.on('mcp:connected', eventListener); // Good listener

      // This should not crash the event forwarding
      expect(() => {
        mockMCPManager.simulateEvent('connected', {
          serverId: 'error-test',
          serverName: 'Error Test Server',
          status: 'connected',
          config: { url: 'test://server', type: 'stdio' }
        });
      }).not.toThrow();

      // Both listeners should have been called despite one throwing
      expect(faultyListener).toHaveBeenCalledTimes(1);
      expect(eventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Data Consistency', () => {
    it('should ensure all forwarded events have consistent timestamp format', () => {
      const events: any[] = [];

      // Collect all event data
      ['connected', 'disconnected', 'error', 'reconnecting', 'health-check', 'state-change', 'pool-change'].forEach(eventType => {
        orchestrator.on(`mcp:${eventType}`, (data) => events.push({ type: eventType, data }));
      });

      // Mock connection for all events
      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Consistency Test Server'
      });

      // Emit all types of events
      mockMCPManager.simulateEvent('connected', {
        serverId: 'consistency-test',
        serverName: 'Consistency Test Server',
        status: 'connected',
        config: { url: 'test://server', type: 'stdio' }
      });

      mockMCPManager.simulateEvent('disconnected', 'consistency-test', 'test reason');
      mockMCPManager.simulateEvent('error', 'consistency-test', new Error('test error'));
      mockMCPManager.simulateEvent('reconnecting', 'consistency-test', 1, 3);
      mockMCPManager.simulateEvent('healthCheck', 'consistency-test', {
        isHealthy: true,
        responseTimeMs: 100,
        timestamp: new Date()
      });
      mockMCPManager.simulateEvent('stateChange', 'consistency-test', 'prev', 'new');
      mockMCPManager.simulateEvent('poolChange', 'consistency-test', 5, 3);

      // Verify all events have timestamps and consistent serverId
      events.forEach(({ type, data }) => {
        expect(data.timestamp).toBeInstanceOf(Date);
        expect(data.serverId).toBe('consistency-test');
        expect(data.serverName).toBe('Consistency Test Server');
      });

      // Verify we got all expected events
      expect(events).toHaveLength(7);
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toEqual(
        expect.arrayContaining(['connected', 'disconnected', 'error', 'reconnecting', 'health-check', 'state-change', 'pool-change'])
      );
    });

    it('should preserve original event data without modification', () => {
      orchestrator.on('mcp:connected', eventListener);

      const originalConnection = Object.freeze({
        serverId: 'preserve-test',
        serverName: 'Preserve Test Server',
        status: 'connected',
        config: Object.freeze({
          url: 'test://preserve',
          type: 'stdio' as const,
        }),
      });

      mockMCPManager.simulateEvent('connected', originalConnection);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const forwardedData = eventListener.mock.calls[0][0];

      // Original connection data should be preserved in connectionInfo
      expect(forwardedData.connectionInfo).toEqual(originalConnection.config);
      expect(forwardedData.serverId).toBe(originalConnection.serverId);
      expect(forwardedData.serverName).toBe(originalConnection.serverName);
      expect(forwardedData.status).toBe(originalConnection.status);
    });
  });
});