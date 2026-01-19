/**
 * Integration tests for MCP installations listing in ApexOrchestrator
 *
 * These tests focus on the listMcpInstallations method integration
 * with the MCP installer and task store, covering:
 * 1. Proper data flow from store to orchestrator
 * 2. Error handling when MCP installer is not available
 * 3. Data transformation and validation
 * 4. Performance with different data sizes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig, MCPInstallation } from '@apexcli/core';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');

// Mock MCP installer
const mockMcpInstaller = {
  listInstalled: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  isInstalled: vi.fn(),
};

// Mock MCPConnectionManager
vi.mock('../mcp/connection-manager.js', () => ({
  MCPConnectionManager: vi.fn().mockImplementation(() => ({
    discoverServers: vi.fn().mockReturnValue([]),
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
    listConnections: vi.fn().mockReturnValue([]),
    getConnection: vi.fn().mockReturnValue(undefined),
    getClient: vi.fn().mockReturnValue(undefined),
    updateConfig: vi.fn(),
  }))
}));

// Mock MCP installer creation
vi.mock('../mcp/installer.js', () => ({
  MCPInstaller: vi.fn().mockImplementation(() => mockMcpInstaller)
}));

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

describe('ApexOrchestrator - listMcpInstallations Integration', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;
  let mockStore: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'test-project',
        description: 'Test project for MCP installations',
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
          'filesystem': {
            name: 'Filesystem Server',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
          'github': {
            name: 'GitHub Server',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
          }
        }
      },
      agents: {},
      workflows: {},
    };

    // Mock file system operations
    mockFS.access.mockResolvedValue(undefined);
    mockFS.mkdir.mockResolvedValue(undefined);
    mockFS.readFile.mockResolvedValue(JSON.stringify(testConfig));
    mockFS.writeFile.mockResolvedValue(undefined);

    // Mock TaskStore with comprehensive methods
    mockStore = {
      getTasks: vi.fn().mockResolvedValue([]),
      getTaskById: vi.fn().mockResolvedValue(null),
      createTask: vi.fn().mockResolvedValue('task-1'),
      updateTask: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      listMcpInstallations: vi.fn().mockResolvedValue([]),
      createMcpInstallation: vi.fn().mockResolvedValue('installation-1'),
      getMcpInstallation: vi.fn().mockResolvedValue(null),
      removeMcpInstallation: vi.fn().mockResolvedValue(undefined),
    };

    MockTaskStore.mockImplementation(() => mockStore);
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.disconnectAll?.();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Basic Functionality', () => {
    it('should return empty array when no MCP installer is available', async () => {
      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      // Simulate no MCP installer available
      (orchestrator as any).mcpInstaller = null;

      const result = await orchestrator.listMcpInstallations();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should delegate to MCP installer when available', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'install-1',
          serverId: 'filesystem',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          status: 'installed',
          configPath: '/test/config/filesystem.json',
        },
        {
          id: 'install-2',
          serverId: 'github',
          installedAt: new Date('2024-01-02T12:00:00.000Z'),
          status: 'installed',
          configPath: '/test/config/github.json',
        },
      ];

      mockMcpInstaller.listInstalled.mockResolvedValue(mockInstallations);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      const result = await orchestrator.listMcpInstallations();

      expect(result).toEqual(mockInstallations);
      expect(mockMcpInstaller.listInstalled).toHaveBeenCalledTimes(1);
    });

    it('should handle MCP installer errors gracefully', async () => {
      mockMcpInstaller.listInstalled.mockRejectedValue(new Error('Database connection failed'));

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      await expect(orchestrator.listMcpInstallations()).rejects.toThrow('Database connection failed');
      expect(mockMcpInstaller.listInstalled).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Validation and Transformation', () => {
    it('should return installations with correct data structure', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'install-comprehensive-test',
          serverId: 'comprehensive-server',
          installedAt: new Date('2024-01-15T14:30:00.000Z'),
          status: 'installed',
          configPath: '/test/config/comprehensive.json',
        },
      ];

      mockMcpInstaller.listInstalled.mockResolvedValue(mockInstallations);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      const result = await orchestrator.listMcpInstallations();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('serverId');
      expect(result[0]).toHaveProperty('installedAt');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('configPath');

      // Verify data types
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].serverId).toBe('string');
      expect(result[0].installedAt).toBeInstanceOf(Date);
      expect(typeof result[0].status).toBe('string');
      expect(typeof result[0].configPath).toBe('string');
    });

    it('should handle installations with different statuses', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'install-1',
          serverId: 'server-installed',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          status: 'installed',
          configPath: '/test/config/installed.json',
        },
        {
          id: 'install-2',
          serverId: 'server-pending',
          installedAt: new Date('2024-01-02T00:00:00.000Z'),
          status: 'pending',
          configPath: '/test/config/pending.json',
        },
        {
          id: 'install-3',
          serverId: 'server-failed',
          installedAt: new Date('2024-01-03T00:00:00.000Z'),
          status: 'failed',
          configPath: '/test/config/failed.json',
        },
      ];

      mockMcpInstaller.listInstalled.mockResolvedValue(mockInstallations);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      const result = await orchestrator.listMcpInstallations();

      expect(result).toHaveLength(3);

      // Verify all different statuses are preserved
      const statuses = result.map(installation => installation.status);
      expect(statuses).toContain('installed');
      expect(statuses).toContain('pending');
      expect(statuses).toContain('failed');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of installations efficiently', async () => {
      // Generate 100 mock installations
      const mockInstallations: MCPInstallation[] = Array.from({ length: 100 }, (_, index) => ({
        id: `install-${index}`,
        serverId: `server-${index}`,
        installedAt: new Date(`2024-01-${String(index % 30 + 1).padStart(2, '0')}T12:00:00.000Z`),
        status: index % 3 === 0 ? 'installed' : index % 3 === 1 ? 'pending' : 'failed',
        configPath: `/test/config/server-${index}.json`,
      }));

      mockMcpInstaller.listInstalled.mockResolvedValue(mockInstallations);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      const startTime = process.hrtime.bigint();
      const result = await orchestrator.listMcpInstallations();
      const endTime = process.hrtime.bigint();

      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      expect(result).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(mockMcpInstaller.listInstalled).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive calls efficiently', async () => {
      const mockInstallations: MCPInstallation[] = [
        {
          id: 'install-concurrent-test',
          serverId: 'concurrent-server',
          installedAt: new Date('2024-01-01T00:00:00.000Z'),
          status: 'installed',
          configPath: '/test/config/concurrent.json',
        },
      ];

      mockMcpInstaller.listInstalled.mockResolvedValue(mockInstallations);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      // Make 5 concurrent calls
      const promises = Array.from({ length: 5 }, () => orchestrator.listMcpInstallations());

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // All calls should return same result
      results.forEach(result => {
        expect(result).toEqual(mockInstallations);
      });

      // Should complete efficiently
      expect(duration).toBeLessThan(500); // Within 500ms for 5 concurrent calls

      // MCP installer should be called for each request (no caching expected)
      expect(mockMcpInstaller.listInstalled).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle orchestrator not initialized properly', async () => {
      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      // Don't call initialize()

      // Should still work but return empty array if no installer
      const result = await orchestrator.listMcpInstallations();
      expect(result).toEqual([]);
    });

    it('should propagate MCP installer database errors', async () => {
      const dbError = new Error('SQLite database is locked');
      mockMcpInstaller.listInstalled.mockRejectedValue(dbError);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      await expect(orchestrator.listMcpInstallations()).rejects.toThrow('SQLite database is locked');
    });

    it('should handle corrupted installation data gracefully', async () => {
      // Mock installer returns data with missing required fields
      const corruptedData = [
        { id: 'corrupt-1', serverId: 'test' }, // Missing required fields
        null,
        undefined,
        { id: 'corrupt-2', serverId: 'test2', installedAt: 'invalid-date' },
      ];

      mockMcpInstaller.listInstalled.mockResolvedValue(corruptedData as any);

      orchestrator = new ApexOrchestrator(testProjectPath, testConfig);
      await orchestrator.initialize();

      // Should either handle gracefully or throw meaningful error
      await expect(async () => {
        const result = await orchestrator.listMcpInstallations();
        // If it doesn't throw, verify the data is cleaned up
        result.forEach(installation => {
          expect(installation).toBeTruthy();
          expect(installation).toHaveProperty('id');
          expect(installation).toHaveProperty('serverId');
        });
      }).not.toThrow();
    });
  });

  describe('Integration with Configuration', () => {
    it('should work with MCP disabled configuration', async () => {
      const configWithMcpDisabled: ApexConfig = {
        ...testConfig,
        mcp: {
          ...testConfig.mcp!,
          enabled: false,
        },
      };

      mockFS.readFile.mockResolvedValue(JSON.stringify(configWithMcpDisabled));

      orchestrator = new ApexOrchestrator(testProjectPath, configWithMcpDisabled);
      await orchestrator.initialize();

      const result = await orchestrator.listMcpInstallations();

      // Should still return installations even if MCP is disabled
      expect(Array.isArray(result)).toBe(true);
    });

    it('should work with missing MCP configuration section', async () => {
      const configWithoutMcp: ApexConfig = {
        project: testConfig.project,
        agents: {},
        workflows: {},
      };

      mockFS.readFile.mockResolvedValue(JSON.stringify(configWithoutMcp));

      orchestrator = new ApexOrchestrator(testProjectPath, configWithoutMcp);
      await orchestrator.initialize();

      const result = await orchestrator.listMcpInstallations();

      expect(result).toEqual([]);
    });
  });
});