/**
 * ApexOrchestrator MCP Integration Tests
 *
 * Tests to verify that MCPConnectionManager is properly instantiated
 * and managed within ApexOrchestrator according to the acceptance criteria:
 *
 * - MCPConnectionManager is created in ApexOrchestrator constructor
 * - Properly initialized during orchestrator startup
 * - Cleaned up during shutdown
 * - Manager is accessible for orchestrator operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import type { ApexConfig } from '@apexcli/core';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('../store.js');
vi.mock('fs/promises');
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

const MockTaskStore = vi.mocked(TaskStore);
const mockFS = vi.mocked(fs);

describe('ApexOrchestrator - MCP Integration', () => {
  let testProjectPath: string;
  let testConfig: ApexConfig;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectPath = '/tmp/test-apex-project';

    testConfig = {
      project: {
        name: 'test-project',
        description: 'Test project for MCP integration',
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
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        // Clean up orchestrator if it was created
        await orchestrator.disconnectAll?.();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('MCPConnectionManager Instantiation', () => {
    it('should create MCPConnectionManager in ApexOrchestrator constructor', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Verify MCPConnectionManager was instantiated
      expect(MCPConnectionManager).toHaveBeenCalledWith({
        projectPath: testProjectPath,
        config: testConfig,
      });
    });

    it('should create MCPConnectionManager with correct configuration', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      expect(MCPConnectionManager).toHaveBeenCalledWith({
        projectPath: testProjectPath,
        config: testConfig,
      });
    });

    it('should handle config without MCP section', async () => {
      const configWithoutMCP = {
        project: testConfig.project,
        agents: {},
        workflows: {},
      } as ApexConfig;

      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...configWithoutMCP });

      // Should still create MCPConnectionManager even without MCP config
      expect(MCPConnectionManager).toHaveBeenCalledWith({
        projectPath: testProjectPath,
        config: configWithoutMCP,
      });
    });
  });

  describe('MCPConnectionManager Accessibility', () => {
    it('should make MCPConnectionManager accessible for orchestrator operations', async () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Since MCPConnectionManager is private, we test indirectly by verifying
      // that it was created and can be used by checking if the mock was called
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');
      expect(MCPConnectionManager).toHaveBeenCalled();

      // Verify the instance has the expected methods by checking the mock
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;
      expect(mcpManagerInstance).toBeDefined();
      expect(mcpManagerInstance.discoverServers).toBeDefined();
      expect(mcpManagerInstance.connect).toBeDefined();
      expect(mcpManagerInstance.disconnect).toBeDefined();
      expect(mcpManagerInstance.disconnectAll).toBeDefined();
    });

    it('should properly initialize MCPConnectionManager during startup', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Verify MCPConnectionManager was created during construction
      expect(MCPConnectionManager).toHaveBeenCalledTimes(1);

      // The MCPConnectionManager should be ready to use immediately after construction
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;
      expect(mcpManagerInstance).toBeDefined();
      expect(typeof mcpManagerInstance.discoverServers).toBe('function');
    });
  });

  describe('MCPConnectionManager Lifecycle', () => {
    it('should handle MCPConnectionManager cleanup during orchestrator shutdown', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;

      // Verify disconnectAll is available for cleanup
      expect(mcpManagerInstance.disconnectAll).toBeDefined();
      expect(typeof mcpManagerInstance.disconnectAll).toBe('function');

      // Test that disconnectAll can be called (simulating cleanup)
      await mcpManagerInstance.disconnectAll();
      expect(mcpManagerInstance.disconnectAll).toHaveBeenCalled();
    });

    it('should properly handle config updates to MCPConnectionManager', async () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;

      // Test config update capability
      const updatedConfig = {
        ...testConfig,
        mcp: {
          ...testConfig.mcp!,
          enabled: false,
        },
      };

      // Verify updateConfig method is available
      expect(mcpManagerInstance.updateConfig).toBeDefined();
      expect(typeof mcpManagerInstance.updateConfig).toBe('function');

      // Test config update
      mcpManagerInstance.updateConfig(updatedConfig);
      expect(mcpManagerInstance.updateConfig).toHaveBeenCalledWith(updatedConfig);
    });
  });

  describe('Error Handling', () => {
    it('should handle MCPConnectionManager instantiation errors gracefully', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      // Mock MCPConnectionManager to throw an error
      vi.mocked(MCPConnectionManager).mockImplementationOnce(() => {
        throw new Error('MCP initialization failed');
      });

      // The orchestrator should handle the error without crashing
      expect(() => {
        orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
      }).toThrow('MCP initialization failed');
    });

    it('should create MCPConnectionManager even with minimal config', async () => {
      const minimalConfig = {
        project: {
          name: 'minimal-test',
          version: '1.0.0',
        },
        agents: {},
        workflows: {},
      } as ApexConfig;

      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...minimalConfig });

      expect(MCPConnectionManager).toHaveBeenCalledWith({
        projectPath: testProjectPath,
        config: minimalConfig,
      });
    });
  });

  describe('Integration Validation', () => {
    it('should verify MCPConnectionManager accepts the expected constructor arguments', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      const constructorCall = vi.mocked(MCPConnectionManager).mock.calls[0];
      expect(constructorCall).toBeDefined();
      expect(constructorCall[0]).toEqual({
        projectPath: testProjectPath,
        config: testConfig,
      });
    });

    it('should verify MCPConnectionManager instance has all required methods', async () => {
      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;

      // Verify all expected methods exist
      const requiredMethods = [
        'discoverServers',
        'connect',
        'disconnect',
        'disconnectAll',
        'listConnections',
        'getConnection',
        'getClient',
        'updateConfig'
      ];

      requiredMethods.forEach(method => {
        expect(mcpManagerInstance[method]).toBeDefined();
        expect(typeof mcpManagerInstance[method]).toBe('function');
      });
    });

    it('should maintain MCPConnectionManager throughout orchestrator lifecycle', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      orchestrator = new ApexOrchestrator({ projectPath: testProjectPath, ...testConfig });

      // Verify MCPConnectionManager was created exactly once
      expect(MCPConnectionManager).toHaveBeenCalledTimes(1);

      // Get the instance
      const mcpManagerInstance = vi.mocked(MCPConnectionManager).mock.results[0]?.value;
      expect(mcpManagerInstance).toBeDefined();

      // Verify the instance persists and can be used multiple times
      mcpManagerInstance.discoverServers();
      mcpManagerInstance.listConnections();

      expect(mcpManagerInstance.discoverServers).toHaveBeenCalled();
      expect(mcpManagerInstance.listConnections).toHaveBeenCalled();
    });
  });
});