/**
 * @fileoverview Comprehensive unit tests for MCPClientUtility
 *
 * Test Coverage:
 * - Basic functionality (connection, disconnection, tool discovery)
 * - Error handling and edge cases
 * - Concurrent connection management
 * - Process lifecycle management
 * - Event emission and handling
 * - Resource cleanup
 * - Configuration validation
 * - Timeout handling
 * - Integration scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ChildProcess } from 'child_process';
import type { MCPServerConfig, MCPEnvironmentVar } from '@apexcli/core';
import {
  MCPClientUtility,
  createMCPClientUtility,
  connectAndDiscoverMCPServer,
  type MCPClientUtilityOptions,
  type MCPServerConnection,
  type MCPConnectionResult,
  type MCPToolDiscoveryResult,
} from './mcp-client.js';

// Mock dependencies
vi.mock('child_process');
vi.mock('./mcp/index.js');

// Mock implementations
const mockChildProcess = {
  on: vi.fn(),
  kill: vi.fn(),
  killed: false,
  stderr: {
    on: vi.fn(),
  },
} as unknown as ChildProcess;

const mockMCPClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  listTools: vi.fn(),
  on: vi.fn(),
};

const mockStdioTransport = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  send: vi.fn(),
};

const mockSpawn = vi.fn(() => mockChildProcess);

describe('MCPClientUtility', () => {
  let utility: MCPClientUtility;
  let mockServerConfig: MCPServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMCPClient.connect.mockResolvedValue(undefined);
    mockMCPClient.disconnect.mockResolvedValue(undefined);
    mockMCPClient.listTools.mockResolvedValue([
      { name: 'test-tool', description: 'A test tool', inputSchema: {} },
    ]);

    vi.doMock('child_process', () => ({
      spawn: mockSpawn,
    }));

    vi.doMock('./mcp/index.js', () => ({
      MCPClient: vi.fn(() => mockMCPClient),
      StdioTransport: vi.fn(() => mockStdioTransport),
    }));

    utility = new MCPClientUtility({
      enableLogging: false,
      defaultTimeoutMs: 5000,
      maxConcurrentConnections: 2,
    });

    mockServerConfig = {
      name: 'test-server',
      command: 'node',
      args: ['./test-server.js'],
      envVars: [
        { name: 'TEST_VAR', value: 'test-value' },
      ],
      autoStart: true,
    };

    mockChildProcess.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (event === 'spawn') {
        setTimeout(() => callback(), 10);
      }
      return mockChildProcess;
    });
  });

  afterEach(async () => {
    await utility.disconnectAll();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create utility with default options', () => {
      const defaultUtility = new MCPClientUtility();
      expect(defaultUtility).toBeInstanceOf(MCPClientUtility);
      expect(defaultUtility.getConnections()).toHaveLength(0);
    });

    it('should create utility with custom options', () => {
      const options: MCPClientUtilityOptions = {
        defaultTimeoutMs: 10000,
        maxConcurrentConnections: 5,
        enableLogging: true,
      };

      const customUtility = new MCPClientUtility(options);
      expect(customUtility).toBeInstanceOf(MCPClientUtility);
    });
  });

  describe('connectServer', () => {
    it('should successfully connect to MCP server', async () => {
      const result = await utility.connectServer(mockServerConfig);

      expect(result.success).toBe(true);
      expect(result.connection).toBeDefined();
      expect(result.connection?.state).toBe('connected');
      expect(result.connection?.tools).toHaveLength(1);
      expect(result.connection?.tools[0].name).toBe('test-tool');
      expect(mockMCPClient.connect).toHaveBeenCalled();
      expect(mockMCPClient.listTools).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockMCPClient.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await utility.connectServer(mockServerConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.connection).toBeUndefined();
    });

    it('should validate server configuration', async () => {
      const invalidConfig = { ...mockServerConfig, command: '' };

      const result = await utility.connectServer(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server command is required');
    });

    it('should respect connection limits', async () => {
      await utility.connectServer(mockServerConfig);
      await utility.connectServer({ ...mockServerConfig, name: 'server-2' });

      const result = await utility.connectServer({ ...mockServerConfig, name: 'server-3' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum concurrent connections reached');
    });
  });

  describe('disconnectServer', () => {
    it('should disconnect from server successfully', async () => {
      const connectionResult = await utility.connectServer(mockServerConfig);
      const connectionId = connectionResult.connection!.id;

      await utility.disconnectServer(connectionId);

      expect(mockMCPClient.disconnect).toHaveBeenCalled();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(utility.getConnection(connectionId)).toBeUndefined();
    });

    it('should handle disconnection from non-existent connection', async () => {
      await expect(utility.disconnectServer('non-existent')).resolves.not.toThrow();
    });
  });

  describe('discoverTools', () => {
    it('should discover tools from connected server', async () => {
      const connectionResult = await utility.connectServer(mockServerConfig);
      const connectionId = connectionResult.connection!.id;

      const result = await utility.discoverTools(connectionId);

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('test-tool');
      expect(result.serverId).toBe(connectionId);
    });

    it('should handle discovery from non-existent connection', async () => {
      const result = await utility.discoverTools('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection non-existent not found');
      expect(result.tools).toHaveLength(0);
    });
  });

  describe('connection management', () => {
    it('should track connections correctly', async () => {
      expect(utility.getConnections()).toHaveLength(0);
      expect(utility.hasActiveConnections()).toBe(false);

      await utility.connectServer(mockServerConfig);

      expect(utility.getConnections()).toHaveLength(1);
      expect(utility.hasActiveConnections()).toBe(true);

      const connections = utility.getConnections();
      expect(connections[0].state).toBe('connected');
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      await utility.connectServer(mockServerConfig);
      await utility.connectServer({ ...mockServerConfig, name: 'server-2' });

      expect(utility.getConnections()).toHaveLength(2);

      await utility.disconnectAll();

      expect(utility.getConnections()).toHaveLength(0);
      expect(utility.hasActiveConnections()).toBe(false);
    });
  });
});

describe('convenience functions', () => {
  describe('createMCPClientUtility', () => {
    it('should create utility with options', () => {
      const options: MCPClientUtilityOptions = {
        defaultTimeoutMs: 15000,
        maxConcurrentConnections: 3,
      };

      const utility = createMCPClientUtility(options);
      expect(utility).toBeInstanceOf(MCPClientUtility);
    });
  });

  describe('connectAndDiscoverMCPServer', () => {
    beforeEach(() => {
      mockMCPClient.connect.mockResolvedValue(undefined);
      mockMCPClient.disconnect.mockResolvedValue(undefined);
      mockMCPClient.listTools.mockResolvedValue([
        { name: 'quick-tool', description: 'Quick tool', inputSchema: {} },
      ]);

      mockChildProcess.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'spawn') {
          setTimeout(() => callback(), 10);
        }
        return mockChildProcess;
      });
    });

    it('should connect and discover tools in one call', async () => {
      const config: MCPServerConfig = {
        name: 'quick-server',
        command: 'node',
        args: ['./quick-server.js'],
        autoStart: true,
      };

      const result = await connectAndDiscoverMCPServer(config);

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('quick-tool');
      expect(result.connection).toBeDefined();
    });

    it('should handle connection failures in one call', async () => {
      mockMCPClient.connect.mockRejectedValue(new Error('Connection failed'));

      const config: MCPServerConfig = {
        name: 'failing-server',
        command: 'node',
        args: ['./failing-server.js'],
        autoStart: true,
      };

      const result = await connectAndDiscoverMCPServer(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.tools).toHaveLength(0);
    });
  });
});

// ============================================================================
// Enhanced Test Suites for Better Coverage
// ============================================================================

describe('MCPClientUtility - Enhanced Error Handling', () => {
  let utility: MCPClientUtility;
  let mockServerConfig: MCPServerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock behavior
    mockMCPClient.connect.mockResolvedValue(undefined);
    mockMCPClient.disconnect.mockResolvedValue(undefined);
    mockMCPClient.listTools.mockResolvedValue([]);

    vi.doMock('child_process', () => ({
      spawn: mockSpawn,
    }));

    vi.doMock('./mcp/index.js', () => ({
      MCPClient: vi.fn(() => mockMCPClient),
      StdioTransport: vi.fn(() => mockStdioTransport),
    }));

    utility = new MCPClientUtility({
      enableLogging: false,
      defaultTimeoutMs: 5000,
      maxConcurrentConnections: 2,
    });

    mockServerConfig = {
      name: 'test-server',
      command: 'node',
      args: ['./test-server.js'],
      autoStart: true,
    };

    mockChildProcess.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (event === 'spawn') {
        setTimeout(() => callback(), 10);
      }
      return mockChildProcess;
    });
  });

  afterEach(async () => {
    await utility.disconnectAll();
    vi.restoreAllMocks();
  });

  describe('process lifecycle management', () => {
    it('should handle process spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        const errorProcess = {
          ...mockChildProcess,
          on: vi.fn((event: string, callback: (...args: any[]) => void) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('Spawn failed')), 10);
            }
            return errorProcess;
          }),
        };
        return errorProcess;
      });

      const result = await utility.connectServer(mockServerConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spawn failed');
    });

    it('should handle process spawn timeout', async () => {
      mockSpawn.mockImplementation(() => {
        const timeoutProcess = {
          ...mockChildProcess,
          kill: vi.fn(),
          on: vi.fn(() => timeoutProcess), // Never calls spawn callback
        };
        return timeoutProcess;
      });

      const result = await utility.connectServer(mockServerConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should force kill stubborn processes during disconnect', async () => {
      const mockKilledProcess = {
        ...mockChildProcess,
        killed: false,
        kill: vi.fn(),
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(() => callback(), 10);
          }
          // Don't emit 'exit' event to simulate stubborn process
          return mockKilledProcess;
        }),
      };

      mockSpawn.mockReturnValue(mockKilledProcess);

      const connectionResult = await utility.connectServer(mockServerConfig);
      const connectionId = connectionResult.connection!.id;

      // Mock setTimeout for the force kill timeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((fn, delay) => {
        if (delay === 5000) {
          // Simulate force kill timeout
          setTimeout(fn, 10);
          return 'timeout-id' as any;
        }
        return originalSetTimeout(fn, delay);
      }) as any;

      await utility.disconnectServer(connectionId);

      expect(mockKilledProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockKilledProcess.kill).toHaveBeenCalledWith('SIGKILL');

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('event handling', () => {
    it('should emit connection established event', async () => {
      const eventSpy = vi.fn();
      utility.on('connection:established', eventSpy);

      await utility.connectServer(mockServerConfig);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        state: 'connected',
        config: mockServerConfig,
      }));
    });

    it('should emit connection lost event on disconnect', async () => {
      const eventSpy = vi.fn();
      utility.on('connection:lost', eventSpy);

      const connectionResult = await utility.connectServer(mockServerConfig);
      const connectionId = connectionResult.connection!.id;

      await utility.disconnectServer(connectionId);

      expect(eventSpy).toHaveBeenCalledWith(connectionId);
    });

    it('should emit connection error event', async () => {
      const errorSpy = vi.fn();
      utility.on('connection:error', errorSpy);

      const connectionResult = await utility.connectServer(mockServerConfig);
      const connection = connectionResult.connection!;

      // Simulate MCP client error
      const errorCallback = mockMCPClient.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorCallback) {
        const testError = new Error('MCP client error');
        errorCallback(testError);

        expect(errorSpy).toHaveBeenCalledWith(connection.id, testError);
      }
    });

    it('should emit tools discovered event', async () => {
      const toolsSpy = vi.fn();
      utility.on('tools:discovered', toolsSpy);

      mockMCPClient.listTools.mockResolvedValue([
        { name: 'tool1', description: 'Test tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Test tool 2', inputSchema: {} },
      ]);

      const connectionResult = await utility.connectServer(mockServerConfig);

      expect(toolsSpy).toHaveBeenCalledWith(
        connectionResult.connection!.id,
        expect.arrayContaining([
          expect.objectContaining({ name: 'tool1' }),
          expect.objectContaining({ name: 'tool2' }),
        ])
      );
    });

    it('should emit process spawned event', async () => {
      const processSpy = vi.fn();
      utility.on('process:spawned', processSpy);

      await utility.connectServer(mockServerConfig);

      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(processSpy).toHaveBeenCalledWith(
        expect.stringMatching(/mcp-conn-\d+-\d+/),
        mockChildProcess
      );
    });
  });

  describe('configuration validation', () => {
    it('should validate server name length', async () => {
      const invalidConfig = {
        ...mockServerConfig,
        name: 'a'.repeat(101), // Too long
      };

      const result = await utility.connectServer(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('name must be 100 characters or less');
    });

    it('should handle missing command', async () => {
      const invalidConfig = {
        ...mockServerConfig,
        command: '',
      };

      const result = await utility.connectServer(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server command is required');
    });

    it('should handle undefined command', async () => {
      const invalidConfig = {
        ...mockServerConfig,
        command: undefined as any,
      };

      const result = await utility.connectServer(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server command is required');
    });
  });

  describe('environment variable handling', () => {
    it('should build environment variables correctly', async () => {
      const configWithEnvVars: MCPServerConfig = {
        ...mockServerConfig,
        envVars: [
          { name: 'TEST_VAR1', value: 'value1' },
          { name: 'TEST_VAR2', value: 'value2' },
          { name: 'UNDEFINED_VAR', value: undefined },
        ],
      };

      await utility.connectServer(configWithEnvVars);

      // Verify spawn was called with correct environment
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['./test-server.js'],
        expect.objectContaining({
          env: expect.objectContaining({
            TEST_VAR1: 'value1',
            TEST_VAR2: 'value2',
          }),
        })
      );

      // Undefined values should not be included
      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[2].env).not.toHaveProperty('UNDEFINED_VAR');
    });

    it('should preserve existing environment variables', async () => {
      const originalEnv = process.env;
      process.env = { EXISTING_VAR: 'existing-value' };

      await utility.connectServer(mockServerConfig);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['./test-server.js'],
        expect.objectContaining({
          env: expect.objectContaining({
            EXISTING_VAR: 'existing-value',
          }),
        })
      );

      process.env = originalEnv;
    });
  });

  describe('timeout handling', () => {
    it('should use custom timeout from config', async () => {
      const configWithTimeout: MCPServerConfig = {
        ...mockServerConfig,
        connection: {
          timeoutMs: 15000,
        },
      };

      await utility.connectServer(configWithTimeout);

      // Verify MCPClient was created with custom timeout
      const { MCPClient } = await import('./mcp/index.js');
      expect(MCPClient).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 15000,
        })
      );
    });

    it('should use custom timeout parameter', async () => {
      await utility.connectServer(mockServerConfig, 25000);

      const { MCPClient } = await import('./mcp/index.js');
      expect(MCPClient).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 25000,
        })
      );
    });
  });
});

describe('MCPClientUtility - Tool Discovery Edge Cases', () => {
  let utility: MCPClientUtility;

  beforeEach(() => {
    vi.clearAllMocks();
    utility = new MCPClientUtility({ enableLogging: false });

    mockChildProcess.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (event === 'spawn') {
        setTimeout(() => callback(), 10);
      }
      return mockChildProcess;
    });
  });

  afterEach(async () => {
    await utility.disconnectAll();
  });

  it('should handle tool discovery failure gracefully', async () => {
    mockMCPClient.connect.mockResolvedValue(undefined);
    mockMCPClient.listTools.mockRejectedValue(new Error('Tool discovery failed'));

    const config: MCPServerConfig = {
      name: 'test-server',
      command: 'node',
      args: ['./test-server.js'],
      autoStart: true,
    };

    const result = await utility.connectServer(config);

    // Connection should succeed even if tool discovery fails
    expect(result.success).toBe(true);
    expect(result.connection?.tools).toHaveLength(0);
  });

  it('should discover tools from disconnected connection', async () => {
    const result = await utility.discoverTools('non-existent-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.tools).toHaveLength(0);
  });

  it('should handle malformed tool response', async () => {
    mockMCPClient.listTools.mockResolvedValue('not an array' as any);

    const config: MCPServerConfig = {
      name: 'test-server',
      command: 'node',
      args: ['./test-server.js'],
      autoStart: true,
    };

    const result = await utility.connectServer(config);

    expect(result.success).toBe(true);
    expect(result.connection?.tools).toHaveLength(0);
  });

  it('should refresh tools for all connected servers', async () => {
    const config1: MCPServerConfig = {
      name: 'server-1',
      command: 'node',
      args: ['./server1.js'],
      autoStart: true,
    };

    const config2: MCPServerConfig = {
      name: 'server-2',
      command: 'node',
      args: ['./server2.js'],
      autoStart: true,
    };

    mockMCPClient.listTools.mockResolvedValue([
      { name: 'refresh-tool', description: 'Refreshed tool', inputSchema: {} },
    ]);

    const conn1 = await utility.connectServer(config1);
    const conn2 = await utility.connectServer(config2);

    const refreshResults = await utility.refreshAllTools();

    expect(refreshResults.size).toBe(2);
    expect(refreshResults.get(conn1.connection!.id)?.success).toBe(true);
    expect(refreshResults.get(conn2.connection!.id)?.success).toBe(true);

    // Check that connection tools were updated
    expect(utility.getConnection(conn1.connection!.id)?.tools).toHaveLength(1);
    expect(utility.getConnection(conn2.connection!.id)?.tools).toHaveLength(1);
  });
});

describe('MCPClientUtility - Concurrent Operations', () => {
  let utility: MCPClientUtility;

  beforeEach(() => {
    vi.clearAllMocks();
    utility = new MCPClientUtility({
      enableLogging: false,
      maxConcurrentConnections: 3,
    });

    mockMCPClient.connect.mockResolvedValue(undefined);
    mockMCPClient.listTools.mockResolvedValue([
      { name: 'concurrent-tool', description: 'Concurrent tool', inputSchema: {} },
    ]);

    mockChildProcess.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (event === 'spawn') {
        setTimeout(() => callback(), 10);
      }
      return mockChildProcess;
    });
  });

  afterEach(async () => {
    await utility.disconnectAll();
  });

  it('should handle concurrent connections', async () => {
    const configs = [
      { name: 'server-1', command: 'node', args: ['./server1.js'], autoStart: true },
      { name: 'server-2', command: 'node', args: ['./server2.js'], autoStart: true },
      { name: 'server-3', command: 'node', args: ['./server3.js'], autoStart: true },
    ] as MCPServerConfig[];

    const promises = configs.map(config => utility.connectServer(config));
    const results = await Promise.all(promises);

    expect(results.every(result => result.success)).toBe(true);
    expect(utility.getConnections()).toHaveLength(3);
    expect(utility.hasActiveConnections()).toBe(true);
  });

  it('should handle concurrent disconnections', async () => {
    const configs = [
      { name: 'server-1', command: 'node', args: ['./server1.js'], autoStart: true },
      { name: 'server-2', command: 'node', args: ['./server2.js'], autoStart: true },
    ] as MCPServerConfig[];

    const connectionResults = await Promise.all(
      configs.map(config => utility.connectServer(config))
    );

    const connectionIds = connectionResults.map(result => result.connection!.id);

    await Promise.all(
      connectionIds.map(id => utility.disconnectServer(id))
    );

    expect(utility.getConnections()).toHaveLength(0);
    expect(utility.hasActiveConnections()).toBe(false);
  });

  it('should aggregate tools from multiple servers', async () => {
    mockMCPClient.listTools
      .mockResolvedValueOnce([
        { name: 'tool-1a', description: 'Tool 1A', inputSchema: {} },
        { name: 'tool-1b', description: 'Tool 1B', inputSchema: {} },
      ])
      .mockResolvedValueOnce([
        { name: 'tool-2a', description: 'Tool 2A', inputSchema: {} },
      ]);

    const configs = [
      { name: 'server-1', command: 'node', args: ['./server1.js'], autoStart: true },
      { name: 'server-2', command: 'node', args: ['./server2.js'], autoStart: true },
    ] as MCPServerConfig[];

    await Promise.all(configs.map(config => utility.connectServer(config)));

    const allTools = utility.getAllTools();
    expect(allTools.size).toBe(2);

    const toolNames = Array.from(allTools.values()).flat().map(tool => tool.name);
    expect(toolNames).toContain('tool-1a');
    expect(toolNames).toContain('tool-1b');
    expect(toolNames).toContain('tool-2a');
  });
});

describe('MCPClientUtility - Memory and Resource Management', () => {
  let utility: MCPClientUtility;

  beforeEach(() => {
    vi.clearAllMocks();
    utility = new MCPClientUtility({ enableLogging: false });

    mockChildProcess.on = vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (event === 'spawn') {
        setTimeout(() => callback(), 10);
      }
      return mockChildProcess;
    });
  });

  afterEach(async () => {
    await utility.disconnectAll();
  });

  it('should clean up resources on failed connections', async () => {
    mockMCPClient.connect.mockRejectedValue(new Error('Connection failed'));

    const config: MCPServerConfig = {
      name: 'failing-server',
      command: 'node',
      args: ['./failing-server.js'],
      autoStart: true,
    };

    const result = await utility.connectServer(config);

    expect(result.success).toBe(false);
    expect(utility.getConnections()).toHaveLength(0);
    expect(utility.hasActiveConnections()).toBe(false);
  });

  it('should handle connection ID generation', async () => {
    const config: MCPServerConfig = {
      name: 'id-test-server',
      command: 'node',
      args: ['./test-server.js'],
      autoStart: true,
    };

    const conn1 = await utility.connectServer(config);
    const conn2 = await utility.connectServer({ ...config, name: 'server-2' });

    expect(conn1.connection!.id).toMatch(/mcp-conn-\d+-\d+/);
    expect(conn2.connection!.id).toMatch(/mcp-conn-\d+-\d+/);
    expect(conn1.connection!.id).not.toBe(conn2.connection!.id);
  });

  it('should handle graceful shutdown with disconnectAll', async () => {
    const configs = Array.from({ length: 5 }, (_, i) => ({
      name: `server-${i}`,
      command: 'node',
      args: [`./server${i}.js`],
      autoStart: true,
    })) as MCPServerConfig[];

    await Promise.all(configs.map(config => utility.connectServer(config)));

    expect(utility.getConnections()).toHaveLength(5);

    await utility.disconnectAll();

    expect(utility.getConnections()).toHaveLength(0);
    expect(utility.hasActiveConnections()).toBe(false);
    expect(mockMCPClient.disconnect).toHaveBeenCalledTimes(5);
  });
});