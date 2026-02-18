/**
 * Integration Tests for MCP Tool Invocation
 *
 * This test suite provides comprehensive integration testing for MCP tool
 * invocation functionality, testing the end-to-end flow from tool discovery
 * through execution across various scenarios and error conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ApexConfig } from '@apexcli/core';
import { MCPConnectionManager, MCPToolExecutionError } from '../mcp/connection-manager.js';
import { MCPToolRegistry } from '../mcp-tool-registry.js';
import {
  createMockServer,
  createMockClient,
  createTestScenario,
  type MockMCPServer,
} from './utils/mock-mcp-server.js';

describe('MCP Tool Invocation Integration', () => {
  let connectionManager: MCPConnectionManager;
  let toolRegistry: MCPToolRegistry;
  let mockConfig: ApexConfig;
  let mockServers: Map<string, MockMCPServer>;

  const TEST_PROJECT_PATH = '/test/project';

  beforeEach(async () => {
    // Create mock configuration
    mockConfig = {
      mcp: {
        enabled: true,
        connection: {
          maxRetries: 3,
          retryDelayMs: 100,
          backoffFactor: 2,
          maxRetryDelayMs: 1000,
          connectionTimeoutMs: 5000,
          requestTimeoutMs: 10000,
          idleTimeoutMs: 300000,
          poolSize: 1,
          poolMinSize: 0,
          healthCheckIntervalMs: 1000,
          healthCheckTimeoutMs: 500,
          healthCheckFailureThreshold: 3,
          autoReconnect: true,
          keepAlive: true,
          keepAliveIntervalMs: 15000,
          heartbeatEnabled: true,
          heartbeatIntervalMs: 30000,
        },
        servers: {
          filesystem: {
            name: 'File System Server',
            type: 'stdio',
            command: 'mock-filesystem-server',
            args: [],
            env: {},
          },
          database: {
            name: 'Database Server',
            type: 'stdio',
            command: 'mock-database-server',
            args: [],
            env: {},
          },
          utilities: {
            name: 'Utilities Server',
            type: 'stdio',
            command: 'mock-utilities-server',
            args: [],
            env: {},
          },
        },
      },
    } as ApexConfig;

    // Create mock servers
    mockServers = createTestScenario()
      .addServer('filesystem', 'filesystem')
      .addServer('database', 'database')
      .addServer('utilities', 'utilities')
      .build();

    // Initialize connection manager
    connectionManager = new MCPConnectionManager({
      projectPath: TEST_PROJECT_PATH,
      config: mockConfig,
    });

    // Initialize tool registry
    toolRegistry = new MCPToolRegistry({
      autoRefresh: false,
      operationTimeoutMs: 5000,
    });

    toolRegistry.setConnectionManager(connectionManager);

    // Mock the transport creation
    await mockTransportCreation();

    // Connect all servers
    await connectionManager.connect('filesystem');
    await connectionManager.connect('database');
    await connectionManager.connect('utilities');

    // Register connections with tool registry
    for (const serverId of ['filesystem', 'database', 'utilities']) {
      const connection = connectionManager.getConnection(serverId)!;
      await toolRegistry.addConnection(connection);
    }
  });

  afterEach(async () => {
    await connectionManager.disconnectAll();
    toolRegistry.shutdown();
    mockServers.clear();
  });

  async function mockTransportCreation() {
    const originalCreateTransport = (connectionManager as any).createTransport;
    (connectionManager as any).createTransport = vi.fn((serverConfig: any) => {
      const serverId = Object.keys(mockConfig.mcp!.servers!).find(
        id => mockConfig.mcp!.servers![id].command === serverConfig.command
      );

      if (serverId && mockServers.has(serverId)) {
        const mockServer = mockServers.get(serverId)!;
        return createMockClient(mockServer);
      }

      return originalCreateTransport.call(connectionManager, serverConfig);
    });
  }

  describe('tool discovery and availability', () => {
    it('should discover tools from all connected servers', async () => {
      const allTools = toolRegistry.getAllTools();

      // Should have tools from filesystem, database, and utilities servers
      expect(allTools.length).toBeGreaterThan(5);

      // Check for specific tools from each server
      const toolNames = allTools.map(t => t.mcpTool.name);
      expect(toolNames).toContain('file-system-scan');
      expect(toolNames).toContain('file-read');
      expect(toolNames).toContain('database-backup');
      expect(toolNames).toContain('database-query');
      expect(toolNames).toContain('slow-operation');
      expect(toolNames).toContain('error-tool');
    });

    it('should correctly map tools to their servers', async () => {
      const filesystemTools = toolRegistry.getToolsByConnection('filesystem');
      const databaseTools = toolRegistry.getToolsByConnection('database');
      const utilitiesTools = toolRegistry.getToolsByConnection('utilities');

      expect(filesystemTools.length).toBeGreaterThan(0);
      expect(databaseTools.length).toBeGreaterThan(0);
      expect(utilitiesTools.length).toBeGreaterThan(0);

      // Filesystem tools should be file-related
      const filesystemToolNames = filesystemTools.map(t => t.mcpTool.name);
      expect(filesystemToolNames).toContain('file-system-scan');
      expect(filesystemToolNames).toContain('file-read');

      // Database tools should be database-related
      const databaseToolNames = databaseTools.map(t => t.mcpTool.name);
      expect(databaseToolNames).toContain('database-backup');
      expect(databaseToolNames).toContain('database-query');
    });

    it('should mark all tools as available when servers are connected', async () => {
      const availableTools = toolRegistry.getAvailableTools();
      const allTools = toolRegistry.getAllTools();

      expect(availableTools.length).toBe(allTools.length);
      expect(availableTools.every(tool => tool.available)).toBe(true);
    });
  });

  describe('successful tool execution', () => {
    it('should execute filesystem tools successfully', async () => {
      // Test file-system-scan
      const scanResult = await connectionManager.executeTool('filesystem', 'file-system-scan', {
        path: '/test/directory',
        maxFiles: 5,
        pattern: '*.txt',
      });

      expect(scanResult).toMatchObject({
        path: '/test/directory',
        files: expect.any(Array),
        totalFound: expect.any(Number),
        scanDuration: expect.any(String),
      });

      // Test file-read
      const readResult = await connectionManager.executeTool('filesystem', 'file-read', {
        path: '/test/file.txt',
      });

      expect(readResult).toMatchObject({
        content: expect.any(String),
        size: expect.any(Number),
        encoding: 'utf8',
        lastModified: expect.any(String),
      });
    });

    it('should execute database tools successfully', async () => {
      // Test database-backup
      const backupResult = await connectionManager.executeTool('database', 'database-backup', {
        database: 'test_db',
        compression: true,
      });

      expect(backupResult).toMatchObject({
        backupId: expect.any(String),
        database: 'test_db',
        size: expect.any(String),
        compression: true,
        duration: expect.any(String),
        location: expect.any(String),
      });

      // Test database-query
      const queryResult = await connectionManager.executeTool('database', 'database-query', {
        query: 'SELECT * FROM users WHERE active = true',
        params: [],
      });

      expect(queryResult).toMatchObject({
        query: 'SELECT * FROM users WHERE active = true',
        rows: expect.any(Array),
        rowCount: expect.any(Number),
        executionTime: expect.any(String),
      });
    });

    it('should emit tool execution events', async () => {
      const toolStartSpy = vi.fn();
      const toolCompleteSpy = vi.fn();
      connectionManager.on('tool:start', toolStartSpy);
      connectionManager.on('tool:complete', toolCompleteSpy);

      await connectionManager.executeTool('filesystem', 'file-read', {
        path: '/test/file.txt',
      });

      expect(toolStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'filesystem',
          serverName: 'File System Server',
          toolName: 'file-read',
          args: { path: '/test/file.txt' },
          callId: expect.any(String),
          timestamp: expect.any(Date),
        })
      );

      expect(toolCompleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'filesystem',
          serverName: 'File System Server',
          toolName: 'file-read',
          callId: expect.any(String),
          result: expect.any(Object),
          durationMs: expect.any(Number),
          timestamp: expect.any(Date),
        })
      );
    });

    it('should track metrics for successful executions', async () => {
      const initialMetrics = connectionManager.getMetrics('filesystem')!;
      const initialRequests = initialMetrics.totalRequests;

      await connectionManager.executeTool('filesystem', 'file-read', {
        path: '/test/file.txt',
      });

      const updatedMetrics = connectionManager.getMetrics('filesystem')!;
      expect(updatedMetrics.totalRequests).toBe(initialRequests + 1);
      expect(updatedMetrics.totalErrors).toBe(initialMetrics.totalErrors);
    });
  });

  describe('tool execution errors', () => {
    it('should handle missing required parameters', async () => {
      const toolErrorSpy = vi.fn();
      connectionManager.on('tool:error', toolErrorSpy);

      await expect(
        connectionManager.executeTool('filesystem', 'file-read', {
          // Missing required 'path' parameter
        })
      ).rejects.toThrow();

      expect(toolErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'filesystem',
          toolName: 'file-read',
          error: expect.stringContaining('Missing required parameter'),
        })
      );
    });

    it('should handle tools that always fail', async () => {
      const toolErrorSpy = vi.fn();
      connectionManager.on('tool:error', toolErrorSpy);

      await expect(
        connectionManager.executeTool('utilities', 'error-tool', {})
      ).rejects.toThrow(MCPToolExecutionError);

      expect(toolErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'utilities',
          toolName: 'error-tool',
          error: 'This tool is designed to always fail',
          retriable: false,
        })
      );
    });

    it('should handle non-existent tools', async () => {
      await expect(
        connectionManager.executeTool('filesystem', 'non-existent-tool', {})
      ).rejects.toThrow();
    });

    it('should handle execution on disconnected servers', async () => {
      await connectionManager.disconnect('filesystem');

      await expect(
        connectionManager.executeTool('filesystem', 'file-read', {
          path: '/test/file.txt',
        })
      ).rejects.toThrow(MCPToolExecutionError);
    });

    it('should track metrics for failed executions', async () => {
      const initialMetrics = connectionManager.getMetrics('utilities')!;
      const initialErrors = initialMetrics.totalErrors;

      await expect(
        connectionManager.executeTool('utilities', 'error-tool', {})
      ).rejects.toThrow();

      const updatedMetrics = connectionManager.getMetrics('utilities')!;
      expect(updatedMetrics.totalErrors).toBe(initialErrors + 1);
      expect(updatedMetrics.lastError).toBeDefined();
    });
  });

  describe('tool execution with special behaviors', () => {
    it('should handle slow operations', async () => {
      const startTime = Date.now();

      const result = await connectionManager.executeTool('utilities', 'slow-operation', {
        delay: 100, // 100ms delay
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);

      expect(result).toMatchObject({
        result: 'Operation completed',
        delay: 100,
        completedAt: expect.any(String),
      });
    });

    it('should handle memory-intensive operations', async () => {
      const result = await connectionManager.executeTool('utilities', 'memory-intensive', {
        size: 50, // 50MB simulation
      });

      expect(result).toMatchObject({
        result: 'Memory operation completed',
        memoryUsed: '50MB',
        duration: expect.any(String),
      });
    });

    it('should handle operations with complex parameters', async () => {
      const result = await connectionManager.executeTool('database', 'database-query', {
        query: 'SELECT name, email FROM users WHERE created_at > ? AND status = ?',
        params: ['2024-01-01', 'active'],
        timeout: 5000,
      });

      expect(result.query).toBe(
        'SELECT name, email FROM users WHERE created_at > ? AND status = ?'
      );
      expect(result.rows).toBeDefined();
    });
  });

  describe('concurrent tool execution', () => {
    it('should handle multiple concurrent executions on the same server', async () => {
      const promises = [
        connectionManager.executeTool('filesystem', 'file-read', { path: '/file1.txt' }),
        connectionManager.executeTool('filesystem', 'file-read', { path: '/file2.txt' }),
        connectionManager.executeTool('filesystem', 'file-read', { path: '/file3.txt' }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toMatchObject({
          content: expect.any(String),
          size: expect.any(Number),
        });
      });
    });

    it('should handle concurrent executions across different servers', async () => {
      const promises = [
        connectionManager.executeTool('filesystem', 'file-read', { path: '/test.txt' }),
        connectionManager.executeTool('database', 'database-query', { query: 'SELECT 1' }),
        connectionManager.executeTool('utilities', 'slow-operation', { delay: 50 }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('content');
      expect(results[1]).toHaveProperty('rows');
      expect(results[2]).toHaveProperty('result', 'Operation completed');
    });

    it('should handle mixed success and failure scenarios', async () => {
      const promises = [
        connectionManager.executeTool('filesystem', 'file-read', { path: '/test.txt' }),
        connectionManager.executeTool('utilities', 'error-tool', {}),
        connectionManager.executeTool('database', 'database-backup', { database: 'test' }),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('tool execution under stress', () => {
    it('should handle unreliable server scenarios', async () => {
      // Configure utilities server to have 30% error rate
      const utilitiesServer = mockServers.get('utilities')!;
      utilitiesServer.updateBehavior({ errorRate: 0.3 });

      const executionPromises = Array.from({ length: 10 }, (_, i) =>
        connectionManager.executeTool('utilities', 'slow-operation', { delay: 10 })
          .catch(err => ({ error: err.message }))
      );

      const results = await Promise.all(executionPromises);

      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);

      // Should have some successes and some failures
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should handle server with limited concurrency', async () => {
      // Create a new server with limited concurrency
      const limitedServers = createTestScenario()
        .addServer('limited', 'utilities')
        .withLimitedConcurrency('limited', 2) // Max 2 concurrent requests
        .build();

      const limitedServer = limitedServers.get('limited')!;
      mockServers.set('limited', limitedServer);

      // Add to config and connect
      mockConfig.mcp!.servers!.limited = {
        name: 'Limited Server',
        type: 'stdio',
        command: 'mock-limited-server',
        args: [],
        env: {},
      };

      await connectionManager.connect('limited');
      const connection = connectionManager.getConnection('limited')!;
      await toolRegistry.addConnection(connection);

      // Try to execute more tools than the server can handle concurrently
      const promises = Array.from({ length: 5 }, () =>
        connectionManager.executeTool('limited', 'slow-operation', { delay: 100 })
          .catch(err => ({ error: err.message }))
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => 'error' in r);

      // Some requests should fail due to concurrency limits
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err: any) =>
        err.error.includes('too many concurrent requests')
      )).toBe(true);
    });
  });

  describe('tool parameter validation', () => {
    it('should handle destructive operations safely', async () => {
      // Database tools should reject destructive operations
      await expect(
        connectionManager.executeTool('database', 'database-query', {
          query: 'DROP TABLE users', // Destructive operation
        })
      ).rejects.toThrow();
    });

    it('should handle missing required parameters gracefully', async () => {
      const testCases = [
        {
          server: 'filesystem',
          tool: 'file-system-scan',
          args: {}, // Missing required 'path'
        },
        {
          server: 'database',
          tool: 'database-backup',
          args: {}, // Missing required 'database'
        },
      ];

      for (const testCase of testCases) {
        await expect(
          connectionManager.executeTool(testCase.server, testCase.tool, testCase.args)
        ).rejects.toThrow();
      }
    });

    it('should handle invalid parameter types', async () => {
      // Test with invalid parameter types
      await expect(
        connectionManager.executeTool('filesystem', 'file-system-scan', {
          path: 123, // Should be string
          maxFiles: 'invalid', // Should be number
        })
      ).rejects.toThrow();
    });
  });

  describe('tool execution state management', () => {
    it('should properly update tool availability when server state changes', async () => {
      // Initially all tools should be available
      expect(toolRegistry.isToolAvailable('file-read')).toBe(true);
      expect(toolRegistry.isToolAvailable('database-backup')).toBe(true);

      // Disconnect filesystem server
      await connectionManager.disconnect('filesystem');
      toolRegistry.updateConnectionState('filesystem', 'disconnected');

      // Filesystem tools should be unavailable
      expect(toolRegistry.isToolAvailable('file-read')).toBe(false);
      // Database tools should still be available
      expect(toolRegistry.isToolAvailable('database-backup')).toBe(true);
    });

    it('should prevent tool execution when tools are not available', async () => {
      await connectionManager.disconnect('filesystem');

      await expect(
        connectionManager.executeTool('filesystem', 'file-read', { path: '/test.txt' })
      ).rejects.toThrow(MCPToolExecutionError);
    });
  });
});