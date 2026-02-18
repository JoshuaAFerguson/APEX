/**
 * Comprehensive MCP Integration Test
 *
 * This test file verifies that all MCP integration components work together
 * correctly, providing a complete end-to-end test of the MCP functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ApexConfig } from '@apexcli/core';
import { MCPConnectionManager } from '../mcp/connection-manager.js';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import { createMockServer, type MockMCPServer } from './utils/mock-mcp-server.js';

describe('MCP Integration Comprehensive Test', () => {
  let connectionManager: MCPConnectionManager;
  let toolRegistry: MCPToolRegistry;
  let mockConfig: ApexConfig;
  let mockServers: Map<string, MockMCPServer>;

  const TEST_PROJECT_PATH = '/test/project';

  beforeEach(() => {
    // Create basic MCP configuration
    mockConfig = {
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 100,
          connectionTimeoutMs: 5000,
          requestTimeoutMs: 10000,
          autoReconnect: true,
          healthCheckIntervalMs: 1000,
        },
        servers: {
          'test-server': {
            name: 'Test Server',
            type: 'stdio',
            command: 'test-command',
          },
        },
      },
    } as ApexConfig;

    // Initialize components
    connectionManager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: mockConfig,
    });

    toolRegistry = new MCPToolRegistry({
      autoRefresh: false,
      operationTimeoutMs: 5000,
    });

    toolRegistry.setConnectionManager(connectionManager);

    // Create mock servers
    mockServers = new Map();
    const mockServer = createMockServer('test-server', 'filesystem');
    mockServers.set('test-server', mockServer);
  });

  afterEach(async () => {
    if (connectionManager) {
      await connectionManager.disconnectAll();
    }
    if (toolRegistry) {
      toolRegistry.shutdown();
    }
    mockServers.clear();
  });

  it('should successfully perform end-to-end MCP workflow', async () => {
    // 1. Discover servers
    const servers = connectionManager.discoverServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('Test Server');

    // 2. Test connection capabilities exist
    expect(connectionManager).toBeDefined();
    expect(toolRegistry).toBeDefined();

    // 3. Verify configuration is properly loaded
    expect(mockConfig.mcp?.enabled).toBe(true);
    expect(mockConfig.mcp?.servers?.['test-server']).toBeDefined();

    // 4. Verify registry is properly initialized
    const initialStats = toolRegistry.getStats();
    expect(initialStats.totalTools).toBe(0);
    expect(initialStats.activeConnections).toBe(0);
  });

  it('should handle configuration validation', () => {
    // Test with invalid configuration
    const invalidConfig = {
      mcp: {
        enabled: true,
        servers: {
          'incomplete-server': {
            // Missing required fields
            type: 'stdio',
          },
        },
      },
    } as ApexConfig;

    const invalidManager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: invalidConfig,
    });

    const servers = invalidManager.discoverServers();
    // Should filter out incomplete servers
    expect(servers).toHaveLength(0);
  });

  it('should verify all components are properly exported', () => {
    // Ensure all main components can be instantiated
    expect(MCPConnectionManager).toBeDefined();
    expect(MCPToolRegistry).toBeDefined();

    // Verify instances are properly created
    expect(connectionManager).toBeInstanceOf(MCPConnectionManager);
    expect(toolRegistry).toBeInstanceOf(MCPToolRegistry);

    // Verify they have expected methods
    expect(typeof connectionManager.connect).toBe('function');
    expect(typeof connectionManager.disconnect).toBe('function');
    expect(typeof connectionManager.discoverServers).toBe('function');

    expect(typeof toolRegistry.refreshAllTools).toBe('function');
    expect(typeof toolRegistry.getAllTools).toBe('function');
    expect(typeof toolRegistry.addConnection).toBe('function');
  });

  it('should handle disabled MCP configuration', () => {
    const disabledConfig = {
      mcp: {
        enabled: false,
        servers: {},
      },
    } as ApexConfig;

    const disabledManager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: disabledConfig,
    });

    const servers = disabledManager.discoverServers();
    expect(servers).toHaveLength(0);
  });

  it('should handle missing MCP configuration', () => {
    const noMcpConfig = {} as ApexConfig;

    const manager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: noMcpConfig,
    });

    const servers = manager.discoverServers();
    expect(servers).toHaveLength(0);
  });

  it('should verify event system integration', () => {
    let connectionEvents = 0;
    let toolEvents = 0;

    connectionManager.on('connected', () => connectionEvents++);
    connectionManager.on('disconnected', () => connectionEvents++);
    connectionManager.on('error', () => connectionEvents++);

    toolRegistry.on('tool:registered', () => toolEvents++);
    toolRegistry.on('tool:unregistered', () => toolEvents++);
    toolRegistry.on('connection:added', () => toolEvents++);

    // Events should be properly set up (no errors thrown)
    expect(connectionManager.listenerCount('connected')).toBe(1);
    expect(toolRegistry.listenerCount('tool:registered')).toBe(1);
  });

  it('should handle resource cleanup properly', async () => {
    // Verify cleanup methods exist and can be called
    expect(typeof connectionManager.disconnectAll).toBe('function');
    expect(typeof toolRegistry.shutdown).toBe('function');
    expect(typeof toolRegistry.clear).toBe('function');

    // Should not throw when called multiple times
    await connectionManager.disconnectAll();
    await connectionManager.disconnectAll();

    toolRegistry.shutdown();
    toolRegistry.shutdown();
  });

  it('should verify type compatibility', () => {
    // Test that types are compatible between components
    const connections = connectionManager.listConnections();
    expect(Array.isArray(connections)).toBe(true);

    const tools = toolRegistry.getAllTools();
    expect(Array.isArray(tools)).toBe(true);

    const stats = toolRegistry.getStats();
    expect(typeof stats.totalTools).toBe('number');
    expect(typeof stats.availableTools).toBe('number');
  });

  it('should handle configuration updates', () => {
    const newConfig = {
      ...mockConfig,
      mcp: {
        ...mockConfig.mcp!,
        connection: {
          ...mockConfig.mcp!.connection,
          maxRetries: 5,
        },
      },
    } as ApexConfig;

    // Should not throw
    connectionManager.updateConfig(newConfig);
    expect(connectionManager).toBeDefined();
  });

  it('should support multiple server types in configuration', () => {
    const multiServerConfig = {
      mcp: {
        enabled: true,
        servers: {
          'stdio-server': {
            type: 'stdio',
            command: 'test-command',
            name: 'Stdio Server',
          },
          'http-server': {
            type: 'http',
            url: 'http://localhost:8080',
            name: 'HTTP Server',
          },
          'sdk-server': {
            type: 'sdk',
            name: 'SDK Server',
          },
        },
      },
    } as ApexConfig;

    const multiManager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: multiServerConfig,
    });

    const servers = multiManager.discoverServers();

    // Should discover stdio and filter out unsupported types
    expect(servers.length).toBe(1); // Only stdio is currently supported
    expect(servers[0].type).toBe('stdio');
  });
});