/**
 * Basic Unit Tests for MCPConnectionManager
 *
 * Simple test to verify the test setup and basic functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';
import { MCPConnectionManager, type MCPConnectionManagerOptions } from '../connection-manager.js';

// Simple mock setup
vi.mock('../transports/index.js', () => ({
  StdioTransport: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../client.js', () => ({
  MCPClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue({ pong: true }),
  })),
}));

const createTestConfig = (servers: Record<string, MCPServerConfig> = {}): ApexConfig => ({
  version: '1.0',
  project: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project',
  },
  mcp: {
    enabled: true,
    servers,
  },
});

const createManagerOptions = (config: ApexConfig): MCPConnectionManagerOptions => ({
  projectPath: '/test/project',
  config,
});

describe('MCPConnectionManager - Basic Tests', () => {
  let manager: MCPConnectionManager;

  afterEach(async () => {
    if (manager) {
      await manager.disconnectAll();
    }
    vi.clearAllMocks();
  });

  describe('Server Discovery', () => {
    it('should create manager instance', () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager).toBeDefined();
      expect(typeof manager.discoverServers).toBe('function');
      expect(typeof manager.connect).toBe('function');
      expect(typeof manager.disconnect).toBe('function');
    });

    it('should discover servers from configuration', () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
          args: ['test.js'],
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Test Server');
      expect(servers[0].type).toBe('stdio');
    });

    it('should return empty array when MCP is disabled', () => {
      const config = createTestConfig();
      config.mcp!.enabled = false;

      manager = new MCPConnectionManager(createManagerOptions(config));
      const servers = manager.discoverServers();

      expect(servers).toEqual([]);
    });
  });

  describe('Connection Management', () => {
    it('should connect to a server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      const connection = await manager.connect('test-server');

      expect(connection).toBeDefined();
      expect(connection.serverId).toBe('test-server');
      expect(connection.serverName).toBe('Test Server');
      expect(connection.state).toBe('connected');
    });

    it('should disconnect from a server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('test-server');

      expect(manager.getConnection('test-server')).toBeDefined();

      await manager.disconnect('test-server');

      expect(manager.getConnection('test-server')).toBeUndefined();
    });

    it('should throw error for non-existent server', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.connect('non-existent')).rejects.toThrow(
        "MCP server 'non-existent' not found in configuration"
      );
    });
  });

  describe('Utility Methods', () => {
    it('should list connections', async () => {
      const config = createTestConfig({
        'server1': {
          name: 'Server 1',
          type: 'stdio',
          command: 'node',
        },
        'server2': {
          name: 'Server 2',
          type: 'stdio',
          command: 'python',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.listConnections()).toHaveLength(0);

      await manager.connect('server1');
      expect(manager.listConnections()).toHaveLength(1);

      await manager.connect('server2');
      expect(manager.listConnections()).toHaveLength(2);
    });

    it('should get client for connected server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));

      expect(manager.getClient('test-server')).toBeUndefined();

      await manager.connect('test-server');
      const client = manager.getClient('test-server');

      expect(client).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on connected server', async () => {
      const config = createTestConfig({
        'test-server': {
          name: 'Test Server',
          type: 'stdio',
          command: 'node',
        },
      });

      manager = new MCPConnectionManager(createManagerOptions(config));
      await manager.connect('test-server');

      const result = await manager.checkHealth('test-server');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.isHealthy).toBe(true);
    });

    it('should throw error when checking health of non-connected server', async () => {
      const config = createTestConfig();
      manager = new MCPConnectionManager(createManagerOptions(config));

      await expect(manager.checkHealth('non-existent')).rejects.toThrow();
    });
  });
});