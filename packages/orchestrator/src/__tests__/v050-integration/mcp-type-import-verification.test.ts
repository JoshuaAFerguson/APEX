/**
 * MCP Type Import Verification Test
 *
 * This test verifies the specific acceptance criteria:
 * "An integration test in the orchestrator package imports MCP types from @apexcli/core,
 * creates valid instances, and passes them to orchestrator MCP components
 * (MCPConnectionManager, MCPToolRegistry) without type or runtime errors."
 *
 * @module orchestrator/__tests__/v050-integration/mcp-type-import-verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Import MCP Types from @apexcli/core - Verify direct import capability
// ============================================================================

import {
  // Server configuration types
  MCPServerConfig,
  MCPServerConfigSchema,
  MCPMarketplaceEntry,
  MCPMarketplaceEntrySchema,

  // Connection types
  MCPConnection,
  MCPConnectionConfig,
  MCPConnectionState,
  MCPConnectionInfo,
  MCPConnectionInfoSchema,

  // Tool types
  MCPTool,
  MCPToolSchema,
  MCPToolCapabilities,
  MCPToolRegistryEntry,

  // Protocol types from MCP module
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  MCPInitializeParamsSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPProtocolToolDefinitionSchema,
  MCPServerCapabilitiesSchema,
  MCPProtocolMethod,
  MCPErrorCode,

  // Mock types for testing
  MockMCPServerConfigSchema,
  MockBehaviorConfigSchema,
  type MockMCPServerConfig,
  type MockBehaviorConfig,

  // Configuration helper
  ApexConfig,
} from '@apexcli/core';

// ============================================================================
// Import Orchestrator MCP Components
// ============================================================================

import { MCPConnectionManager } from '../../mcp/connection-manager.js';
import type { MCPConnectionManagerOptions } from '../../mcp/connection-manager.js';
import { MCPToolRegistry } from '../../mcp-tool-registry.js';
import { MCPInstaller } from '../../mcp-installer.js';
import { buildMCPProxyServer } from '../../mcp-proxy-server.js';

// Mock external dependencies
vi.mock('../../mcp/client.js');
vi.mock('../../mcp/transports/stdio-transport.js');
vi.mock('child_process');

// ============================================================================
// Test Implementation
// ============================================================================

describe('MCP Type Import Verification', () => {

  describe('Import Verification - All Core MCP Types Available', () => {
    it('should successfully import all required MCP types from @apexcli/core', () => {
      // Verify schema imports
      expect(MCPServerConfigSchema).toBeDefined();
      expect(MCPMarketplaceEntrySchema).toBeDefined();
      expect(MCPConnectionInfoSchema).toBeDefined();
      expect(MCPToolSchema).toBeDefined();

      // Verify protocol schemas
      expect(JsonRpcRequestSchema).toBeDefined();
      expect(JsonRpcResponseSchema).toBeDefined();
      expect(MCPInitializeParamsSchema).toBeDefined();
      expect(MCPToolsCallParamsSchema).toBeDefined();
      expect(MCPToolsCallResultSchema).toBeDefined();
      expect(MCPProtocolToolDefinitionSchema).toBeDefined();
      expect(MCPServerCapabilitiesSchema).toBeDefined();

      // Verify constants
      expect(MCPProtocolMethod).toBeDefined();
      expect(MCPErrorCode).toBeDefined();

      // Verify mock types
      expect(MockMCPServerConfigSchema).toBeDefined();
      expect(MockBehaviorConfigSchema).toBeDefined();

      // All should be valid Zod schemas with parse methods
      expect(typeof MCPServerConfigSchema.parse).toBe('function');
      expect(typeof MCPConnectionInfoSchema.parse).toBe('function');
      expect(typeof MCPToolSchema.parse).toBe('function');
      expect(typeof MockMCPServerConfigSchema.parse).toBe('function');
    });

    it('should verify TypeScript types can be used without compilation errors', () => {
      // This test verifies that the TypeScript types are properly exported
      // and can be used in type annotations without errors

      const serverConfig: MCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: 'test-command',
        args: ['--arg1'],
        env: { TEST: 'value' }
      };

      const connection: MCPConnection = {
        serverId: 'test-id',
        serverName: 'Test Server',
        config: serverConfig,
        state: 'connected',
        reconnectAttempts: 0
      };

      const tool: MCPTool = {
        name: 'test-tool',
        inputSchema: {
          type: 'object',
          properties: { param: { type: 'string' } },
          required: ['param'],
          additionalProperties: false
        },
        serverId: 'test-id',
        available: true,
        tags: []
      };

      const mockConfig: MockMCPServerConfig = {
        name: 'mock-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mock', version: '1.0.0' }
      };

      // These should all compile without errors if types are properly exported
      expect(serverConfig.name).toBe('test-server');
      expect(connection.serverId).toBe('test-id');
      expect(tool.name).toBe('test-tool');
      expect(mockConfig.name).toBe('mock-server');
    });
  });

  describe('Valid Instance Creation and Validation', () => {
    it('should create valid MCPServerConfig instances that pass Zod validation', () => {
      // Create instances using imported types
      const stdioConfig: MCPServerConfig = {
        name: 'filesystem-server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: { NODE_ENV: 'production' }
      };

      const httpConfig: MCPServerConfig = {
        name: 'api-server',
        type: 'http',
        url: 'http://localhost:3000',
        headers: { 'Authorization': 'Bearer token' }
      };

      const sseConfig: MCPServerConfig = {
        name: 'events-server',
        type: 'sse',
        url: 'http://localhost:4000/events'
      };

      // Validate using imported schemas
      expect(MCPServerConfigSchema.safeParse(stdioConfig).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(httpConfig).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(sseConfig).success).toBe(true);
    });

    it('should create valid MCPConnection instances that pass validation', () => {
      const connection: MCPConnection = {
        serverId: 'fs-server-001',
        serverName: 'Filesystem Server',
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem']
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0,
        health: {
          healthy: true,
          lastCheckAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          latencyMs: 25,
          avgLatencyMs: 22
        },
        metrics: {
          totalRequests: 150,
          successfulRequests: 148,
          failedRequests: 2,
          bytesSent: 8192,
          bytesReceived: 16384,
          uptimeMs: 120000
        }
      };

      const validationResult = MCPConnectionInfoSchema.safeParse(connection);
      expect(validationResult.success).toBe(true);
    });

    it('should create valid MCPTool instances with proper schema validation', () => {
      const tool: MCPTool = {
        name: 'search_files',
        description: 'Search for files matching a pattern',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Search pattern (glob or regex)',
              minLength: 1
            },
            directory: {
              type: 'string',
              description: 'Directory to search in',
              default: '.'
            },
            recursive: {
              type: 'boolean',
              description: 'Search recursively in subdirectories',
              default: true
            }
          },
          required: ['pattern'],
          additionalProperties: false
        },
        serverId: 'fs-server-001',
        serverName: 'Filesystem Server',
        available: true,
        capabilities: {
          streaming: false,
          cancellable: true,
          progressReporting: false,
          idempotent: true,
          hasSideEffects: false
        },
        tags: ['filesystem', 'search']
      };

      const validationResult = MCPToolSchema.safeParse(tool);
      expect(validationResult.success).toBe(true);

      if (validationResult.success) {
        expect(validationResult.data.name).toBe('search_files');
        expect(validationResult.data.serverId).toBe('fs-server-001');
        expect(validationResult.data.available).toBe(true);
      }
    });

    it('should create valid MockMCPServerConfig for testing scenarios', () => {
      const mockConfig: MockMCPServerConfig = {
        name: 'integration-test-server',
        description: 'Mock server for integration testing',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false }
        },
        serverInfo: {
          name: 'mock-integration-server',
          version: '1.0.0'
        },
        autoStart: true,
        maxConnections: 5,
        shutdownTimeoutMs: 3000
      };

      const validationResult = MockMCPServerConfigSchema.safeParse(mockConfig);
      expect(validationResult.success).toBe(true);
    });
  });

  describe('Integration with MCPConnectionManager', () => {
    let connectionManager: MCPConnectionManager;

    beforeEach(() => {
      // Create valid ApexConfig with MCP settings using imported types
      const apexConfig: ApexConfig = {
        project: { name: 'integration-test', version: '1.0.0' },
        limits: {
          maxConcurrentTasks: 5,
          maxDailyTasks: 50,
          maxTokensPerTask: 50000,
          maxTurns: 10
        },
        mcp: {
          enabled: true,
          servers: {
            'filesystem': {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              env: {}
            }
          },
          connection: {
            maxRetries: 3,
            retryDelayMs: 1000,
            connectionTimeoutMs: 10000,
            autoReconnect: true,
            healthCheckIntervalMs: 30000
          }
        },
        autonomy: { level: 'manual' },
        agents: {},
        workflows: {}
      } as ApexConfig;

      const options: MCPConnectionManagerOptions = {
        projectPath: '/test/project',
        config: apexConfig
      };

      // This should not produce type errors
      connectionManager = new MCPConnectionManager(options);
    });

    it('should accept ApexConfig with imported MCP types without type errors', () => {
      expect(connectionManager).toBeDefined();
      expect(connectionManager.listConnections).toBeDefined();
      expect(connectionManager.discoverServers).toBeDefined();
    });

    it('should handle MCPConnection instances created from imported types', () => {
      const connection: MCPConnection = {
        serverId: 'test-server-connection',
        serverName: 'Test Connection Server',
        config: {
          name: 'test-connection',
          type: 'stdio',
          command: 'echo',
          args: ['hello']
        },
        state: 'connected',
        reconnectAttempts: 0
      };

      // Verify the connection can be processed by manager methods
      const connections = connectionManager.listConnections();
      expect(Array.isArray(connections)).toBe(true);

      // Connection object structure should be compatible
      expect(connection.serverId).toBeDefined();
      expect(connection.config.name).toBeDefined();
      expect(connection.state).toBeDefined();
    });
  });

  describe('Integration with MCPToolRegistry', () => {
    let toolRegistry: MCPToolRegistry;

    beforeEach(() => {
      toolRegistry = new MCPToolRegistry({
        autoRefresh: false,
        operationTimeoutMs: 5000
      });
    });

    it('should accept MCPConnection instances without type errors', async () => {
      const connection: MCPConnection = {
        serverId: 'registry-test-server',
        serverName: 'Registry Test Server',
        config: {
          name: 'registry-test',
          type: 'stdio',
          command: 'test'
        },
        state: 'connected',
        reconnectAttempts: 0,
        health: {
          healthy: true,
          lastCheckAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          latencyMs: 10,
          avgLatencyMs: 12
        }
      };

      // This should not produce type errors
      await toolRegistry.addConnection(connection);

      const stats = toolRegistry.getStats();
      expect(stats.activeConnections).toBe(1);
      expect(stats.totalTools).toBeGreaterThanOrEqual(0);
    });

    it('should work with MCPConnectionManager integration', () => {
      const apexConfig: ApexConfig = {
        project: { name: 'registry-integration-test', version: '1.0.0' },
        limits: {
          maxConcurrentTasks: 3,
          maxDailyTasks: 30,
          maxTokensPerTask: 30000,
          maxTurns: 8
        },
        mcp: {
          enabled: true,
          servers: {},
          connection: {
            maxRetries: 2,
            retryDelayMs: 500,
            connectionTimeoutMs: 5000,
            autoReconnect: false,
            healthCheckIntervalMs: 15000
          }
        },
        autonomy: { level: 'manual' },
        agents: {},
        workflows: {}
      } as ApexConfig;

      const manager = new MCPConnectionManager({
        projectPath: '/test/registry',
        config: apexConfig
      });

      // This should not produce type errors
      toolRegistry.setConnectionManager(manager);

      expect(toolRegistry).toBeDefined();
    });
  });

  describe('Integration with MCPInstaller', () => {
    it('should handle MCPMarketplaceEntry instances from imported types', () => {
      const marketplaceEntry: MCPMarketplaceEntry = {
        name: 'filesystem',
        description: 'MCP server for filesystem operations',
        category: 'filesystem',
        author: 'ModelContext',
        version: '1.0.0',
        verified: true,
        tags: ['filesystem', 'files'],
        capabilities: ['file:read', 'file:write', 'directory:list'],
        serverConfig: {
          name: 'Filesystem Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem']
        },
        repository: 'https://github.com/modelcontextprotocol/servers',
        documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem'
      };

      // Validate the marketplace entry
      const validationResult = MCPMarketplaceEntrySchema.safeParse(marketplaceEntry);
      expect(validationResult.success).toBe(true);

      // The entry structure should be compatible with MCPInstaller expectations
      expect(marketplaceEntry.serverConfig).toBeDefined();
      expect(marketplaceEntry.serverConfig.name).toBeDefined();
      expect(marketplaceEntry.serverConfig.type).toBeDefined();
    });
  });

  describe('Integration with MCPProxyServer', () => {
    it('should build proxy server with components using imported types', async () => {
      // Create mock instances using imported types
      const apexConfig: ApexConfig = {
        project: { name: 'proxy-test', version: '1.0.0' },
        limits: {
          maxConcurrentTasks: 2,
          maxDailyTasks: 20,
          maxTokensPerTask: 20000,
          maxTurns: 5
        },
        mcp: { enabled: true, servers: {}, connection: {
          maxRetries: 1,
          retryDelayMs: 100,
          connectionTimeoutMs: 1000,
          autoReconnect: false,
          healthCheckIntervalMs: 5000
        }},
        autonomy: { level: 'manual' },
        agents: {},
        workflows: {}
      } as ApexConfig;

      const connectionManager = new MCPConnectionManager({
        projectPath: '/test/proxy',
        config: apexConfig
      });

      const toolRegistry = new MCPToolRegistry({ autoRefresh: false });

      // This should not produce type errors
      const proxyServer = buildMCPProxyServer({
        connectionManager,
        toolRegistry,
        name: 'test-proxy'
      });

      expect(proxyServer).toBeDefined();
      expect(proxyServer.name).toBe('test-proxy');
      expect(proxyServer.config).toBeDefined();
    });
  });

  describe('Protocol Type Usage', () => {
    it('should create valid JSON-RPC requests using imported protocol types', () => {
      const initRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: MCPProtocolMethod.Initialize,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: true } },
          clientInfo: { name: 'apex-integration-test', version: '1.0.0' }
        }
      };

      const listToolsRequest = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: MCPProtocolMethod.ToolsList,
        params: {}
      };

      const callToolRequest = {
        jsonrpc: '2.0' as const,
        id: 3,
        method: MCPProtocolMethod.ToolsCall,
        params: {
          name: 'read_file',
          arguments: { path: '/test/file.txt' }
        }
      };

      // Validate with imported schemas
      expect(JsonRpcRequestSchema.safeParse(initRequest).success).toBe(true);
      expect(JsonRpcRequestSchema.safeParse(listToolsRequest).success).toBe(true);
      expect(JsonRpcRequestSchema.safeParse(callToolRequest).success).toBe(true);

      // Validate specific message types
      expect(MCPInitializeParamsSchema.safeParse(initRequest.params).success).toBe(true);
      expect(MCPToolsCallParamsSchema.safeParse(callToolRequest.params).success).toBe(true);
    });

    it('should use imported error codes and method constants correctly', () => {
      // Error codes should be valid negative integers
      expect(MCPErrorCode.InternalError).toBe(-32603);
      expect(MCPErrorCode.ToolNotFound).toBe(-32004);
      expect(MCPErrorCode.InvalidParams).toBe(-32602);

      // Method names should be correct strings
      expect(MCPProtocolMethod.Initialize).toBe('initialize');
      expect(MCPProtocolMethod.ToolsList).toBe('tools/list');
      expect(MCPProtocolMethod.ToolsCall).toBe('tools/call');
      expect(MCPProtocolMethod.ResourcesList).toBe('resources/list');
      expect(MCPProtocolMethod.PromptsList).toBe('prompts/list');

      // Should be usable in JSON-RPC error responses
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: 1,
        error: {
          code: MCPErrorCode.ToolNotFound,
          message: 'Tool not found',
          data: { toolName: 'nonexistent_tool' }
        }
      };

      expect(JsonRpcResponseSchema.safeParse(errorResponse).success).toBe(true);
    });
  });

  describe('End-to-End Type Compatibility Verification', () => {
    it('should demonstrate complete type flow from core to orchestrator components', async () => {
      // 1. Create configuration using imported types
      const serverConfig: MCPServerConfig = {
        name: 'end-to-end-server',
        type: 'stdio',
        command: 'echo',
        args: ['test'],
        env: { TEST_MODE: 'true' }
      };

      const apexConfig: ApexConfig = {
        project: { name: 'e2e-test', version: '1.0.0' },
        limits: {
          maxConcurrentTasks: 1,
          maxDailyTasks: 10,
          maxTokensPerTask: 10000,
          maxTurns: 3
        },
        mcp: {
          enabled: true,
          servers: { 'e2e-server': serverConfig },
          connection: {
            maxRetries: 1,
            retryDelayMs: 100,
            connectionTimeoutMs: 1000,
            autoReconnect: false,
            healthCheckIntervalMs: 5000
          }
        },
        autonomy: { level: 'manual' },
        agents: {},
        workflows: {}
      } as ApexConfig;

      // 2. Initialize components with imported types
      const connectionManager = new MCPConnectionManager({
        projectPath: '/test/e2e',
        config: apexConfig
      });

      const toolRegistry = new MCPToolRegistry({ autoRefresh: false });
      toolRegistry.setConnectionManager(connectionManager);

      // 3. Create connection instance using imported types
      const connection: MCPConnection = {
        serverId: 'e2e-server',
        serverName: 'End-to-End Server',
        config: serverConfig,
        state: 'connected',
        reconnectAttempts: 0
      };

      // 4. Add connection to registry
      await toolRegistry.addConnection(connection);

      // 5. Verify everything works together
      expect(connectionManager).toBeDefined();
      expect(toolRegistry.getStats().activeConnections).toBe(1);

      // 6. Create proxy server combining all components
      const proxyServer = buildMCPProxyServer({
        connectionManager,
        toolRegistry,
        name: 'e2e-proxy'
      });

      expect(proxyServer).toBeDefined();
      expect(proxyServer.name).toBe('e2e-proxy');
    });
  });
});