/**
 * Integration tests for MCP Tools with Permission System
 *
 * Tests verify:
 * 1. MCP tools respect permission levels
 * 2. MCP tool discovery registers tools with permission requirements
 * 3. Custom tool hooks run before permission check
 * 4. MCP server connection requires appropriate permissions
 * 5. MCP tool execution tracks in ToolActionStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

import {
  createTestEnvironment,
  createTestTask,
  MockMCPServer,
  createTestMCPTools,
  expectPermissionGranted,
  expectPermissionDenied,
} from './test-utils';
import { MCPToolManager } from '../../tools/mcp-tool-manager';
import { ToolRegistry } from '../../tools/tool-registry';

import type {
  Task,
  ToolDefinition,
  ToolExecution,
  MCPServerConfig,
} from '@apexcli/core';

describe('MCP + Permission System Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let mockMCPServer: MockMCPServer;
  let mcpToolManager: MCPToolManager;
  let toolRegistry: ToolRegistry;
  let discoveryEvents: any[] = [];

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    // Create mock MCP server with test tools
    const testTools = createTestMCPTools();
    mockMCPServer = new MockMCPServer(testTools);

    // Create tool registry
    toolRegistry = new ToolRegistry();

    // Create MCP tool manager
    mcpToolManager = new MCPToolManager({
      permissionManager: testEnv.permissionManager,
      toolRegistry,
      enableAutoDiscovery: true,
    });

    // Track discovery events
    discoveryEvents = [];
    mcpToolManager.on('tool:discovered', (event) => {
      discoveryEvents.push({ type: 'discovered', ...event });
    });
    mcpToolManager.on('tool:registered', (event) => {
      discoveryEvents.push({ type: 'registered', ...event });
    });
    mcpToolManager.on('server:connected', (event) => {
      discoveryEvents.push({ type: 'connected', ...event });
    });
  });

  afterEach(async () => {
    if (mockMCPServer) {
      await mockMCPServer.stop();
    }
    if (mcpToolManager) {
      await mcpToolManager.shutdown();
    }
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  describe('MCP Tool Permission Requirements', () => {
    it('should check permissions for discovered MCP tools', async () => {
      // Start mock MCP server
      await mockMCPServer.start();

      // Connect MCP tool manager to server
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      // Wait for discovery
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(discoveryEvents.some(e => e.type === 'discovered')).toBe(true);
      expect(discoveryEvents.some(e => e.type === 'connected')).toBe(true);

      // Verify tools were discovered with permission requirements
      const fileReaderTool = toolRegistry.getTool('test-file-reader');
      expect(fileReaderTool).toBeDefined();
      expect(fileReaderTool?.permissions).toContain('read');

      const apiClientTool = toolRegistry.getTool('test-api-client');
      expect(apiClientTool).toBeDefined();
      expect(apiClientTool?.permissions).toContain('network');
    });

    it('should apply per-tool permission configuration', async () => {
      // Configure specific permissions for MCP tools
      await testEnv.permissionManager.setToolPermissionConfig('test-file-reader', {
        requireConfirmation: true,
        allowedPaths: ['src/**', 'test/**'],
        blockedPaths: ['node_modules/**', '.git/**'],
      });

      await testEnv.permissionManager.denyPermission('test-api-client');
      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');

      // Start server and discover tools
      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Execute tools through permission system
      const fileReaderResult = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/example.ts',
      });

      const apiClientResult = await mcpToolManager.executeTool('test-api-client', {
        url: 'https://api.example.com',
        method: 'GET',
      });

      expect(fileReaderResult.success).toBe(true);
      expect(apiClientResult.success).toBe(false);
      expect(apiClientResult.error).toContain('permission');
    });

    it('should respect directory access rules for MCP tools', async () => {
      // Set up directory access rules
      await testEnv.permissionManager.setDirectoryAccess({
        allowedPaths: ['src/**', 'test/**'],
        blockedPaths: ['node_modules/**', 'config/**'],
        requireConfirmation: ['scripts/**'],
      });

      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Test allowed path
      const allowedResult = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/allowed.ts',
      });

      // Test blocked path
      const blockedResult = await mcpToolManager.executeTool('test-file-reader', {
        path: 'node_modules/package.json',
      });

      expect(allowedResult.success).toBe(true);
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toContain('path access');
    });
  });

  describe('MCP Server Management', () => {
    it('should require permission to start MCP servers', async () => {
      // Deny MCP server permission
      await testEnv.permissionManager.denyPermission('mcp-server');

      const connectionResult = await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      expect(connectionResult.success).toBe(false);
      expect(connectionResult.error).toContain('permission');
    });

    it('should emit tool discovery events with capability info', async () => {
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      const discoveredEvents = discoveryEvents.filter(e => e.type === 'discovered');
      expect(discoveredEvents.length).toBe(2); // Two test tools

      discoveredEvents.forEach(event => {
        expect(event.tool).toBeDefined();
        expect(event.tool.name).toBeDefined();
        expect(event.tool.description).toBeDefined();
        expect(event.tool.inputSchema).toBeDefined();
        expect(event.capabilities).toBeDefined();
      });
    });

    it('should register MCP tools with ToolRegistry', async () => {
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify tools are registered
      const registeredTools = toolRegistry.getAllTools();
      expect(registeredTools.some(t => t.name === 'test-file-reader')).toBe(true);
      expect(registeredTools.some(t => t.name === 'test-api-client')).toBe(true);

      // Verify registration events
      const registeredEvents = discoveryEvents.filter(e => e.type === 'registered');
      expect(registeredEvents.length).toBe(2);
    });
  });

  describe('Tool Hooks with MCP', () => {
    it('should run beforeExecute hook before MCP tool execution', async () => {
      let beforeHookCalled = false;
      let hookContext: any = null;

      // Register before hook
      mcpToolManager.addHook('beforeExecute', async (context) => {
        beforeHookCalled = true;
        hookContext = context;
        return { allowed: true };
      });

      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Execute tool
      const result = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/example.ts',
      });

      expect(result.success).toBe(true);
      expect(beforeHookCalled).toBe(true);
      expect(hookContext).toMatchObject({
        toolName: 'test-file-reader',
        params: { path: 'src/example.ts' },
        serverId: 'test-server',
      });
    });

    it('should run afterExecute hook after MCP tool completion', async () => {
      let afterHookCalled = false;
      let hookResult: any = null;

      // Register after hook
      mcpToolManager.addHook('afterExecute', async (context, result) => {
        afterHookCalled = true;
        hookResult = result;
        return result; // Pass through
      });

      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/example.ts',
      });

      expect(result.success).toBe(true);
      expect(afterHookCalled).toBe(true);
      expect(hookResult).toEqual(result);
    });

    it('should handle MCP tool errors in onError hook', async () => {
      let errorHookCalled = false;
      let hookError: any = null;

      // Register error hook
      mcpToolManager.addHook('onError', async (context, error) => {
        errorHookCalled = true;
        hookError = error;
        return { handled: true, result: { success: false, error: 'Handled by hook' } };
      });

      // Mock tool that throws error
      mockMCPServer.executeTool = vi.fn().mockRejectedValue(new Error('Tool execution failed'));

      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/example.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handled by hook');
      expect(errorHookCalled).toBe(true);
      expect(hookError.message).toBe('Tool execution failed');
    });
  });

  describe('Tool Execution Tracking', () => {
    it('should record MCP tool execution in ToolActionStore', async () => {
      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Execute MCP tool
      const result = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/example.ts',
      });

      expect(result.success).toBe(true);

      // Verify execution was recorded
      const taskActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      expect(taskActions.some(action =>
        action.execution.toolName === 'test-file-reader' &&
        action.execution.input.path === 'src/example.ts'
      )).toBe(true);
    });

    it('should track MCP tool execution metadata', async () => {
      await testEnv.permissionManager.grantPermission('test-api-client', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      const startTime = Date.now();
      const result = await mcpToolManager.executeTool('test-api-client', {
        url: 'https://api.example.com',
        method: 'GET',
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);

      // Verify metadata
      const taskActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      const apiAction = taskActions.find(action => action.execution.toolName === 'test-api-client');

      expect(apiAction).toBeDefined();
      expect(apiAction?.execution.startTime.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(apiAction?.execution.endTime.getTime()).toBeLessThanOrEqual(endTime);
      expect(apiAction?.execution.duration).toBeGreaterThan(0);
      expect(apiAction?.execution.agentName).toBeDefined();
      expect(apiAction?.execution.stageName).toBeDefined();
    });

    it('should handle MCP tool execution failures in tracking', async () => {
      // Mock tool that fails
      mockMCPServer.executeTool = vi.fn().mockResolvedValue({
        success: false,
        error: 'API endpoint not found',
      });

      await testEnv.permissionManager.grantPermission('test-api-client', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await mcpToolManager.executeTool('test-api-client', {
        url: 'https://invalid.api.com',
        method: 'GET',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API endpoint not found');

      // Verify failed execution was recorded
      const taskActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      const failedAction = taskActions.find(action =>
        action.execution.toolName === 'test-api-client' &&
        action.execution.status === 'failed'
      );

      expect(failedAction).toBeDefined();
      expect(failedAction?.execution.error).toBe('API endpoint not found');
      expect(failedAction?.canUndo).toBe(false); // Failed actions can't be undone
    });
  });

  describe('Complex MCP Integration Scenarios', () => {
    it('should handle multiple MCP servers with different permissions', async () => {
      // Create second MCP server with different tools
      const serverTwoTools: ToolDefinition[] = [
        {
          name: 'database-query',
          description: 'Query database',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'SQL query' },
            },
            required: ['query'],
          },
          category: 'database',
          permissions: ['database'],
        },
      ];

      const mockMCPServer2 = new MockMCPServer(serverTwoTools);

      // Set different permissions for each server's tools
      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');
      await testEnv.permissionManager.denyPermission('database-query');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      // Start both servers
      await mockMCPServer.start();
      await mockMCPServer2.start();

      await mcpToolManager.connectServer({
        id: 'file-server',
        name: 'File MCP Server',
        command: 'file-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await mcpToolManager.connectServer({
        id: 'db-server',
        name: 'Database MCP Server',
        command: 'db-server',
        args: [],
        env: {},
      }, mockMCPServer2 as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Test execution with different permissions
      const fileResult = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/data.ts',
      });

      const dbResult = await mcpToolManager.executeTool('database-query', {
        query: 'SELECT * FROM users',
      });

      expect(fileResult.success).toBe(true);
      expect(dbResult.success).toBe(false);
      expect(dbResult.error).toContain('permission');

      // Cleanup
      await mockMCPServer2.stop();
    });

    it('should coordinate MCP tools with policy enforcement', async () => {
      await testEnv.permissionManager.grantPermission('test-file-reader', 'allow-always');
      await testEnv.permissionManager.grantPermission('mcp-server', 'allow-always');

      await mockMCPServer.start();
      await mcpToolManager.connectServer({
        id: 'test-server',
        name: 'Test MCP Server',
        command: 'mock-server',
        args: [],
        env: {},
      }, mockMCPServer as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Test with policy-allowed path
      const allowedResult = await mcpToolManager.executeTool('test-file-reader', {
        path: 'src/allowed.ts', // In allowed src/ directory
      });

      // Test with policy-blocked path
      const blockedResult = await mcpToolManager.executeTool('test-file-reader', {
        path: 'node_modules/blocked.js', // In blocked directory
      });

      expect(allowedResult.success).toBe(true);
      expect(blockedResult.success).toBe(false);

      // Verify policy integration
      const violations = testEnv.policyEnforcer.validateFilePath('node_modules/blocked.js');
      expect(violations.length).toBeGreaterThan(0);
    });
  });
});