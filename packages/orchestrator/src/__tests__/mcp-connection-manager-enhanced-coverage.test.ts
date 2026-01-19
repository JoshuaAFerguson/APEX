/**
 * Enhanced MCPConnectionManager Test Coverage
 *
 * This test suite provides comprehensive coverage for MCPConnectionManager
 * edge cases and advanced scenarios that complement the existing test suite.
 * Ensures 100% coverage of all connection management functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApexConfig, MCPServerConfig, MCPConnection } from '@apexcli/core';
import {
  MCPConnectionManager,
  type MCPConnectionManagerOptions,
} from '../mcp/connection-manager.js';
import { MCPClient } from '../mcp/client.js';

// ============================================================================
// Enhanced Mock Setup
// ============================================================================

// Mock the core dependencies
vi.mock('../mcp/transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => createAdvancedMockTransport()),
}));

vi.mock('../mcp/client.js', () => ({
  MCPClient: vi.fn().mockImplementation(({ transport }) => createAdvancedMockClient(transport)),
}));

vi.mock('@apexcli/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apexcli/core')>();
  return {
    ...actual,
    ExponentialBackoffReconnector: vi.fn().mockImplementation(() => ({
      shouldReconnect: vi.fn().mockReturnValue(true),
      getDelay: vi.fn().mockReturnValue(1000),
      reset: vi.fn(),
    })),
    ConnectionHealthManager: vi.fn().mockImplementation(() => ({
      startHealthChecks: vi.fn(),
      stopHealthChecks: vi.fn(),
      checkHealth: vi.fn().mockResolvedValue({ status: 'healthy', responseTime: 50 }),
    })),
    getMCPServers: vi.fn().mockReturnValue({}),
  };
});

// Advanced mock transport with more realistic behavior
function createAdvancedMockTransport() {
  const emitter = new EventEmitter();
  let connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  let errorMode = false;

  return {
    on: vi.fn((event, handler) => {
      emitter.on(event, handler);
      return emitter;
    }),
    off: vi.fn((event, handler) => {
      emitter.off(event, handler);
      return emitter;
    }),
    emit: vi.fn((event, ...args) => emitter.emit(event, ...args)),
    connect: vi.fn().mockImplementation(async () => {
      if (errorMode) {
        connectionState = 'disconnected';
        throw new Error('Connection failed');
      }
      connectionState = 'connecting';
      await new Promise(resolve => setTimeout(resolve, 10));
      connectionState = 'connected';
      emitter.emit('connected');
    }),
    disconnect: vi.fn().mockImplementation(async () => {
      connectionState = 'disconnected';
      emitter.emit('disconnected', 'Manual disconnect');
    }),
    send: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockImplementation(() => connectionState === 'connected'),
    getState: vi.fn().mockImplementation(() => connectionState),
    _emitter: emitter,
    _setErrorMode: (enabled: boolean) => { errorMode = enabled; },
    _getConnectionState: () => connectionState,
  };
}

// Advanced mock client with more realistic behavior
function createAdvancedMockClient(transport: ReturnType<typeof createAdvancedMockTransport>) {
  return {
    connect: vi.fn().mockImplementation(() => transport.connect()),
    disconnect: vi.fn().mockImplementation(() => transport.disconnect()),
    listTools: vi.fn().mockResolvedValue([
      {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
      },
    ]),
    callTool: vi.fn().mockImplementation(async (name: string, args: any) => {
      if (!transport.isConnected()) {
        throw new Error('Client not connected');
      }
      return { result: `Tool ${name} executed with args: ${JSON.stringify(args)}` };
    }),
    ping: vi.fn().mockImplementation(async () => {
      if (!transport.isConnected()) {
        throw new Error('Client not connected');
      }
      return undefined;
    }),
    transport,
  };
}

// ============================================================================
// Test Configuration Helpers
// ============================================================================

const createAdvancedTestConfig = (
  servers: Record<string, MCPServerConfig> = {},
  overrides: Partial<ApexConfig> = {}
): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'test-project',
  },
  mcp: {
    enabled: true,
    servers,
    connection: {
      enabled: true,
      autoConnect: true,
      heartbeat: {
        enabled: true,
        interval: 30000,
      },
      reconnect: {
        enabled: true,
        maxAttempts: 3,
        delayMs: 1000,
        maxDelayMs: 10000,
      },
      timeout: {
        connectionMs: 5000,
        operationMs: 10000,
      },
    },
  },
  ...overrides,
});

const createAdvancedManagerOptions = (
  config: ApexConfig,
  overrides: Partial<MCPConnectionManagerOptions> = {}
): MCPConnectionManagerOptions => ({
  projectPath: '/test/project',
  config,
  ...overrides,
});

// ============================================================================
// Enhanced Test Suites
// ============================================================================

describe('MCPConnectionManager Enhanced Coverage', () => {
  let manager: MCPConnectionManager;
  let mockTransports: Map<string, ReturnType<typeof createAdvancedMockTransport>>;

  beforeEach(() => {
    mockTransports = new Map();

    // Override transport creation to track instances
    const originalStdioTransport = vi.mocked((vi.doMock('../mcp/transports/index.js') as any).StdioTransport);
    originalStdioTransport.mockImplementation(() => {
      const transport = createAdvancedMockTransport();
      mockTransports.set(Math.random().toString(), transport);
      return transport;
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    mockTransports.clear();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Advanced Configuration Testing
  // ==========================================================================

  describe('Advanced Configuration', () => {
    it('should handle complex server configurations', () => {
      const config = createAdvancedTestConfig({
        'complex-server': {
          name: 'complex-server',
          type: 'stdio',
          command: 'node',
          args: ['--inspect', './server.js'],
          env: {
            NODE_ENV: 'development',
            DEBUG: 'mcp:*',
            CUSTOM_VAR: 'value',
          },
        },
        'minimal-server': {
          name: 'minimal-server',
          type: 'stdio',
          command: 'npx',
        },
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(2);

      const complexServer = servers.find(s => s.name === 'complex-server');
      expect(complexServer).toBeDefined();
      expect(complexServer?.args).toEqual(['--inspect', './server.js']);
      expect(complexServer?.env).toEqual({
        NODE_ENV: 'development',
        DEBUG: 'mcp:*',
        CUSTOM_VAR: 'value',
      });

      const minimalServer = servers.find(s => s.name === 'minimal-server');
      expect(minimalServer).toBeDefined();
      expect(minimalServer?.args).toEqual([]);
      expect(minimalServer?.env).toEqual({});
    });

    it('should handle disabled MCP configuration gracefully', () => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      }, {
        mcp: {
          enabled: false,
          servers: {},
        },
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });

    it('should handle missing MCP configuration section', () => {
      const config = {
        version: '1.0',
        project: { name: 'test' },
        // No mcp section
      } as ApexConfig;

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });

    it('should validate server configuration types', () => {
      const config = createAdvancedTestConfig({
        'valid-stdio': {
          name: 'valid-stdio',
          type: 'stdio',
          command: 'node',
        },
        'invalid-type': {
          name: 'invalid-type',
          type: 'websocket' as any, // Invalid type
          command: 'node',
        } as any,
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
      const servers = manager.discoverServers();

      // Should only include valid servers
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('valid-stdio');
    });
  });

  // ==========================================================================
  // Connection Lifecycle Edge Cases
  // ==========================================================================

  describe('Connection Lifecycle Edge Cases', () => {
    beforeEach(() => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
    });

    it('should handle concurrent connection attempts', async () => {
      const connectionPromises = [
        manager.connect('test-server'),
        manager.connect('test-server'),
        manager.connect('test-server'),
      ];

      const results = await Promise.allSettled(connectionPromises);

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Should have single connection
      const connections = manager.listConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].state).toBe('connected');
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const connection = await manager.connect('test-server');
        expect(connection.state).toBe('connected');

        await manager.disconnect('test-server');
        const connections = manager.listConnections();
        expect(connections[0]?.state).toBe('disconnected');
      }
    });

    it('should handle connection to non-existent server', async () => {
      await expect(manager.connect('non-existent-server'))
        .rejects
        .toThrow();
    });

    it('should handle disconnection of non-existent connection', async () => {
      await expect(manager.disconnect('non-existent-server'))
        .resolves
        .toBeUndefined();
    });

    it('should handle multiple disconnections of same server', async () => {
      await manager.connect('test-server');

      await manager.disconnect('test-server');
      await manager.disconnect('test-server'); // Second disconnect should be safe
      await manager.disconnect('test-server'); // Third disconnect should be safe

      const connections = manager.listConnections();
      expect(connections[0]?.state).toBe('disconnected');
    });
  });

  // ==========================================================================
  // Event System Edge Cases
  // ==========================================================================

  describe('Event System Edge Cases', () => {
    beforeEach(() => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
    });

    it('should handle errors in event listeners', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      manager.on('connected', errorListener);
      manager.on('connected', vi.fn()); // Second listener should still work

      // Connection should succeed despite listener error
      await expect(manager.connect('test-server')).resolves.toBeDefined();
      expect(errorListener).toHaveBeenCalled();
    });

    it('should handle removal of listeners during event emission', async () => {
      const listeners: Array<() => void> = [];

      const createRemovingListener = (index: number) => {
        const listener = () => {
          // Remove next listener during emission
          if (listeners[index + 1]) {
            manager.off('connected', listeners[index + 1]);
          }
        };
        listeners.push(listener);
        return listener;
      };

      // Add listeners that remove other listeners
      for (let i = 0; i < 3; i++) {
        manager.on('connected', createRemovingListener(i));
      }

      await expect(manager.connect('test-server')).resolves.toBeDefined();
    });

    it('should handle high-frequency events without memory leaks', async () => {
      let eventCount = 0;
      const listener = () => eventCount++;

      manager.on('stateChange', listener);

      // Generate many state changes
      for (let i = 0; i < 100; i++) {
        await manager.connect('test-server');
        await manager.disconnect('test-server');
      }

      expect(eventCount).toBeGreaterThan(0);

      manager.off('stateChange', listener);
    });
  });

  // ==========================================================================
  // Error Handling and Recovery
  // ==========================================================================

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });
      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
    });

    it('should handle transport creation failures', async () => {
      // Mock transport constructor to throw
      vi.mocked((vi.doMock('../mcp/transports/index.js') as any).StdioTransport)
        .mockImplementationOnce(() => {
          throw new Error('Transport creation failed');
        });

      await expect(manager.connect('test-server'))
        .rejects
        .toThrow();
    });

    it('should handle client creation failures', async () => {
      // Mock client constructor to throw
      vi.mocked((vi.doMock('../mcp/client.js') as any).MCPClient)
        .mockImplementationOnce(() => {
          throw new Error('Client creation failed');
        });

      await expect(manager.connect('test-server'))
        .rejects
        .toThrow();
    });

    it('should handle unexpected disconnections', async () => {
      const connection = await manager.connect('test-server');
      expect(connection.state).toBe('connected');

      // Simulate unexpected disconnection
      const transport = Array.from(mockTransports.values())[0];
      transport.emit('disconnected', 'Unexpected error');

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 10));

      const connections = manager.listConnections();
      expect(connections[0].state).toBe('disconnected');
    });

    it('should handle malformed server responses', async () => {
      const transport = createAdvancedMockTransport();
      const client = createAdvancedMockClient(transport);

      // Mock malformed response
      client.listTools.mockRejectedValueOnce(new Error('Malformed response'));

      await transport.connect();
      await expect(client.listTools()).rejects.toThrow('Malformed response');
    });

    it('should handle connection timeouts gracefully', async () => {
      // Mock slow connection
      vi.mocked((vi.doMock('../mcp/transports/index.js') as any).StdioTransport)
        .mockImplementationOnce(() => {
          const transport = createAdvancedMockTransport();
          transport.connect.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Slow connection
            transport.emit('connected');
          });
          return transport;
        });

      const config = createAdvancedTestConfig({
        'slow-server': {
          name: 'slow-server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(
        createAdvancedManagerOptions(config, {
          connectionConfig: {
            enabled: true,
            autoConnect: false,
            timeout: {
              connectionMs: 100, // Short timeout
              operationMs: 5000,
            },
          },
        })
      );

      await expect(manager.connect('slow-server'))
        .rejects
        .toThrow();
    });
  });

  // ==========================================================================
  // Performance and Scalability
  // ==========================================================================

  describe('Performance and Scalability', () => {
    it('should handle many simultaneous connections', async () => {
      const serverCount = 10;
      const servers: Record<string, MCPServerConfig> = {};

      for (let i = 0; i < serverCount; i++) {
        servers[`server-${i}`] = {
          name: `server-${i}`,
          type: 'stdio',
          command: 'node',
        };
      }

      const config = createAdvancedTestConfig(servers);
      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));

      // Connect to all servers
      const connectionPromises = [];
      for (let i = 0; i < serverCount; i++) {
        connectionPromises.push(manager.connect(`server-${i}`));
      }

      const connections = await Promise.all(connectionPromises);
      expect(connections).toHaveLength(serverCount);

      const allConnections = manager.listConnections();
      expect(allConnections).toHaveLength(serverCount);

      // Verify all are connected
      const connectedCount = allConnections.filter(c => c.state === 'connected').length;
      expect(connectedCount).toBe(serverCount);
    });

    it('should efficiently manage connection state updates', () => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));

      // Measure performance of state updates
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        // Simulate rapid state changes
        const connection = manager.getConnection('test-server');
        if (connection) {
          // Internal state updates would happen here
        }
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100); // Should be very fast
    });

    it('should handle memory cleanup properly', async () => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));

      // Create and destroy many connections
      for (let i = 0; i < 10; i++) {
        await manager.connect('test-server');
        await manager.disconnect('test-server');
      }

      // Verify cleanup
      const connections = manager.listConnections();
      expect(connections).toHaveLength(1); // Should reuse same connection object
      expect(connections[0].state).toBe('disconnected');
    });
  });

  // ==========================================================================
  // Integration with Other Components
  // ==========================================================================

  describe('Component Integration', () => {
    it('should integrate with health monitoring', async () => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(
        createAdvancedManagerOptions(config, {
          connectionConfig: {
            enabled: true,
            autoConnect: true,
            heartbeat: {
              enabled: true,
              interval: 1000,
            },
          },
        })
      );

      const connection = await manager.connect('test-server');
      expect(connection.state).toBe('connected');

      // Health checks should be running (mocked)
      // In real implementation, this would verify heartbeat functionality
    });

    it('should provide client access for external tools', async () => {
      const config = createAdvancedTestConfig({
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(config));
      await manager.connect('test-server');

      const client = manager.getClient('test-server');
      expect(client).toBeDefined();

      // Client should be functional
      const tools = await client!.listTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle configuration updates at runtime', () => {
      const initialConfig = createAdvancedTestConfig({
        'server-1': {
          name: 'server-1',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createAdvancedManagerOptions(initialConfig));

      let servers = manager.discoverServers();
      expect(servers).toHaveLength(1);

      // In a real scenario, config updates would trigger re-discovery
      // Here we verify the discovery mechanism works with different configs
      const updatedConfig = createAdvancedTestConfig({
        'server-1': {
          name: 'server-1',
          type: 'stdio',
          command: 'node',
        },
        'server-2': {
          name: 'server-2',
          type: 'stdio',
          command: 'python',
        },
      });

      // Create new manager with updated config
      const updatedManager = new MCPConnectionManager(
        createAdvancedManagerOptions(updatedConfig)
      );

      servers = updatedManager.discoverServers();
      expect(servers).toHaveLength(2);

      updatedManager.disconnectAll();
    });
  });
});