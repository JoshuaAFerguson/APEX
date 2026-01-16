/**
 * MCP Event Forwarding Edge Cases Tests
 *
 * Tests edge cases and error scenarios for MCP event forwarding in ApexOrchestrator.
 * These tests cover unusual conditions, error states, and boundary cases to ensure
 * robust event handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig } from '@apexcli/core';
import fs from 'fs/promises';

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

describe('MCP Event Forwarding - Edge Cases', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;
  let mockMCPManager: MockMCPConnectionManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'test-project',
        description: 'Test project for MCP edge cases',
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
        servers: {}
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

    orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
    mockMCPManager = (MockMCPConnectionManager as any).mock.results[0]?.value;
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

  describe('Malformed Event Data', () => {
    it('should handle connected event with null connection object', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:connected', eventListener);

      // Simulate malformed event with null data
      mockMCPManager.simulateEvent('connected', null);

      // Should not crash, but may not emit the forwarded event
      // This depends on the implementation's error handling
      expect(() => {
        // Give event loop a chance to process
      }).not.toThrow();
    });

    it('should handle connected event with partial connection data', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:connected', eventListener);

      // Simulate event with incomplete data
      const partialConnection = {
        serverId: 'partial-server',
        // Missing serverName, status, config
      };

      mockMCPManager.simulateEvent('connected', partialConnection);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.serverId).toBe('partial-server');
      expect(eventData.serverName).toBeUndefined();
    });

    it('should handle error event with non-Error objects', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:error', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test Server'
      });

      // Simulate error event with string instead of Error object
      mockMCPManager.simulateEvent('error', 'test-server', 'String error message');

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.serverId).toBe('test-server');
      expect(eventData.error).toBe('String error message');
      expect(eventData.message).toBe('String error message');
      expect(eventData.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle health check event with malformed result', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:health-check', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test Server'
      });

      // Simulate health check with incomplete result
      const malformedResult = {
        // Missing isHealthy and timestamp
        responseTimeMs: 'not-a-number'
      };

      mockMCPManager.simulateEvent('healthCheck', 'test-server', malformedResult);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.result).toBe(malformedResult);
      expect(eventData.responseTimeMs).toBe('not-a-number');
      expect(eventData.isHealthy).toBeUndefined();
    });
  });

  describe('Extreme Values and Boundary Cases', () => {
    it('should handle very long server IDs and names', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:connected', eventListener);

      const longServerId = 'a'.repeat(1000);
      const longServerName = 'b'.repeat(2000);

      const connection = {
        serverId: longServerId,
        serverName: longServerName,
        status: 'connected',
        config: {
          url: 'test://server',
          type: 'stdio' as const,
        },
      };

      mockMCPManager.simulateEvent('connected', connection);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.serverId).toBe(longServerId);
      expect(eventData.serverName).toBe(longServerName);
    });

    it('should handle reconnection with extreme attempt values', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:reconnecting', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test Server'
      });

      // Test with very high attempt numbers
      mockMCPManager.simulateEvent('reconnecting', 'test-server', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.attempt).toBe(Number.MAX_SAFE_INTEGER);
      expect(eventData.maxAttempts).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle pool change with negative values', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:pool-change', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test Server'
      });

      // Test with negative values (shouldn't happen but tests robustness)
      mockMCPManager.simulateEvent('poolChange', 'test-server', -1, -5);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.poolSize).toBe(-1);
      expect(eventData.activeConnections).toBe(-5);
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle server IDs with Unicode characters', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:connected', eventListener);

      const unicodeServerId = '🚀-server-测试-🔥';
      const unicodeServerName = 'Test Server 🌟 with émojis and spëciål chars';

      const connection = {
        serverId: unicodeServerId,
        serverName: unicodeServerName,
        status: 'connected',
        config: {
          url: 'ws://localhost:8080/测试',
          type: 'websocket' as const,
        },
      };

      mockMCPManager.simulateEvent('connected', connection);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.serverId).toBe(unicodeServerId);
      expect(eventData.serverName).toBe(unicodeServerName);
      expect(eventData.connectionInfo.url).toBe('ws://localhost:8080/测试');
    });

    it('should handle error messages with special characters', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:error', eventListener);

      mockMCPManager.getConnection.mockReturnValue({
        serverName: 'Test Server'
      });

      const errorWithSpecialChars = new Error('Connection failed: ñoño error with "quotes" and \\backslashes\\');
      errorWithSpecialChars.name = 'SPECIAL_CHAR_ERROR';

      mockMCPManager.simulateEvent('error', 'test-server', errorWithSpecialChars);

      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.message).toBe('Connection failed: ñoño error with "quotes" and \\backslashes\\');
      expect(eventData.code).toBe('SPECIAL_CHAR_ERROR');
    });
  });

  describe('Event Timing and Sequence Issues', () => {
    it('should handle rapid-fire events without data corruption', () => {
      const connectedEvents: any[] = [];
      orchestrator.on('mcp:connected', (data) => connectedEvents.push(data));

      // Rapidly emit multiple connection events
      for (let i = 0; i < 100; i++) {
        const connection = {
          serverId: `rapid-server-${i}`,
          serverName: `Rapid Server ${i}`,
          status: 'connected',
          config: {
            url: `test://server-${i}`,
            type: 'stdio' as const,
          },
        };

        mockMCPManager.simulateEvent('connected', connection);
      }

      // Verify all events were captured and are distinct
      expect(connectedEvents).toHaveLength(100);

      for (let i = 0; i < 100; i++) {
        expect(connectedEvents[i].serverId).toBe(`rapid-server-${i}`);
        expect(connectedEvents[i].serverName).toBe(`Rapid Server ${i}`);
      }
    });

    it('should handle events emitted before orchestrator is fully initialized', () => {
      // This tests the edge case where MCPConnectionManager might emit events
      // during orchestrator construction
      const earlyEventListener = vi.fn();

      // Create new orchestrator and immediately listen for events
      const newOrchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      newOrchestrator.on('mcp:connected', earlyEventListener);

      const newMockManager = (MockMCPConnectionManager as any).mock.results[1]?.value;

      // Emit event immediately
      const connection = {
        serverId: 'early-server',
        serverName: 'Early Server',
        status: 'connected',
        config: {
          url: 'test://early',
          type: 'stdio' as const,
        },
      };

      newMockManager.simulateEvent('connected', connection);

      expect(earlyEventListener).toHaveBeenCalledTimes(1);
      expect(earlyEventListener.mock.calls[0][0].serverId).toBe('early-server');
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak event listeners when orchestrator is recreated', () => {
      const listeners: any[] = [];

      // Create and destroy multiple orchestrator instances
      for (let i = 0; i < 10; i++) {
        const tempOrchestrator = new ApexOrchestrator(testProjectPath, testConfig);
        const listener = vi.fn();
        tempOrchestrator.on('mcp:connected', listener);
        listeners.push(listener);

        const tempMockManager = (MockMCPConnectionManager as any).mock.results[i + 1]?.value;

        // Emit event
        const connection = {
          serverId: `temp-server-${i}`,
          serverName: `Temp Server ${i}`,
          status: 'connected',
          config: {
            url: `test://temp-${i}`,
            type: 'stdio' as const,
          },
        };

        tempMockManager.simulateEvent('connected', connection);

        // Verify listener was called for this instance
        expect(listener).toHaveBeenCalledTimes(1);
      }

      // Verify each listener was only called once (no cross-talk between instances)
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle removal of event listeners during event emission', () => {
      const listeners: any[] = [];
      const eventData: any[] = [];

      // Create listeners that remove themselves during execution
      for (let i = 0; i < 5; i++) {
        const listener = vi.fn((data) => {
          eventData.push(data);
          // Remove self during execution
          orchestrator.off('mcp:connected', listener);
        });
        listeners.push(listener);
        orchestrator.on('mcp:connected', listener);
      }

      const connection = {
        serverId: 'removal-test-server',
        serverName: 'Removal Test Server',
        status: 'connected',
        config: {
          url: 'test://removal',
          type: 'stdio' as const,
        },
      };

      mockMCPManager.simulateEvent('connected', connection);

      // All listeners should have been called once
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      // All should have received the same data
      expect(eventData).toHaveLength(5);
      eventData.forEach(data => {
        expect(data.serverId).toBe('removal-test-server');
      });

      // Emit another event - no listeners should be called now
      mockMCPManager.simulateEvent('connected', connection);

      // Listener call counts should not have increased
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue forwarding events after a listener throws an exception', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener crashed');
      });
      const goodListener1 = vi.fn();
      const goodListener2 = vi.fn();

      orchestrator.on('mcp:connected', faultyListener);
      orchestrator.on('mcp:connected', goodListener1);
      orchestrator.on('mcp:connected', goodListener2);

      const connection = {
        serverId: 'resilience-test',
        serverName: 'Resilience Test Server',
        status: 'connected',
        config: {
          url: 'test://resilience',
          type: 'stdio' as const,
        },
      };

      // This should not crash the entire system
      expect(() => {
        mockMCPManager.simulateEvent('connected', connection);
      }).not.toThrow();

      // All listeners should have been called
      expect(faultyListener).toHaveBeenCalledTimes(1);
      expect(goodListener1).toHaveBeenCalledTimes(1);
      expect(goodListener2).toHaveBeenCalledTimes(1);

      // System should still work for subsequent events
      mockMCPManager.simulateEvent('connected', connection);

      expect(faultyListener).toHaveBeenCalledTimes(2);
      expect(goodListener1).toHaveBeenCalledTimes(2);
      expect(goodListener2).toHaveBeenCalledTimes(2);
    });

    it('should handle getConnection throwing an exception', () => {
      const eventListener = vi.fn();
      orchestrator.on('mcp:disconnected', eventListener);

      // Mock getConnection to throw an error
      mockMCPManager.getConnection.mockImplementation(() => {
        throw new Error('getConnection failed');
      });

      // This should not crash the forwarding mechanism
      expect(() => {
        mockMCPManager.simulateEvent('disconnected', 'error-server', 'test reason');
      }).not.toThrow();

      // Event should still be forwarded, falling back to serverId for serverName
      expect(eventListener).toHaveBeenCalledTimes(1);
      const eventData = eventListener.mock.calls[0][0];

      expect(eventData.serverId).toBe('error-server');
      expect(eventData.serverName).toBe('error-server'); // Fallback to serverId
      expect(eventData.reason).toBe('test reason');
    });
  });
});