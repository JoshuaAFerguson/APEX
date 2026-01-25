/**
 * Cross-Package MCP Type Compatibility Integration Test
 *
 * ADR-027: Cross-Package MCP Type Compatibility Verification
 *
 * ## Context
 * The @apexcli/core package defines MCP types (protocol types, mock types, connection types,
 * tool types) that are consumed by the orchestrator package's MCP infrastructure
 * (MCPConnectionManager, MCPToolRegistry, MCPInstaller, MCPProxyServer).
 *
 * ## Decision
 * Create integration tests that verify:
 * 1. All MCP types from @apexcli/core can be imported without errors
 * 2. Valid instances of core MCP types are accepted by orchestrator MCP components
 * 3. Protocol types, mock types, and connection/tool types are structurally compatible
 * 4. Zod schemas from core correctly validate data used by orchestrator components
 *
 * ## Consequences
 * - Early detection of type incompatibilities between packages
 * - Contract verification between core type definitions and orchestrator consumers
 * - Regression protection when either package evolves its MCP types
 *
 * @module orchestrator/__tests__/v050-integration/mcp-cross-package-type-compatibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Type Imports from @apexcli/core - Verifies all MCP types are importable
// ============================================================================

import type {
  // Connection types
  MCPConnection,
  MCPConnectionState,
  MCPConnectionConfig,
  MCPConnectionEvent,
  MCPConnectionEventType,
  MCPConnectionInfo,
  MCPServerConfig,
  ApexConfig,

  // Tool types
  MCPTool,
  MCPToolSchema,
  MCPToolCapabilities,
  MCPToolRegistryEntry as CoreMCPToolRegistryEntry,
  MCPToolInvocationRequest,
  MCPToolInvocationResponse,
  MCPToolResultContent as CoreMCPToolResultContent,

  // Installation types
  MCPMarketplaceEntry,
  MCPInstallation,
  MCPInstallationStatus,
  MCPServer,
} from '@apexcli/core';

// Protocol types from core MCP module
import {
  // JSON-RPC base types
  JsonRpcIdSchema,
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcErrorSchema,
  JsonRpcNotificationSchema,

  // Protocol types - Initialize
  MCPInitializeParamsSchema,
  MCPInitializeResultSchema,

  // Protocol types - Tools
  MCPProtocolToolDefinitionSchema,
  MCPToolsListResultSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPToolResultContentItemSchema,

  // Protocol types - Resources
  MCPProtocolResourceDefinitionSchema,
  MCPResourcesListResultSchema,
  MCPResourcesReadResultSchema,

  // Protocol types - Prompts
  MCPProtocolPromptDefinitionSchema,
  MCPPromptsListResultSchema,
  MCPPromptsGetResultSchema,

  // Protocol types - Logging & Completion
  MCPLoggingSetLevelParamsSchema,
  MCPCompletionCompleteParamsSchema,

  // Protocol constants
  MCPProtocolMethod,
  MCPErrorCode,

  // Capabilities
  MCPServerCapabilitiesSchema,
  MCPClientCapabilitiesSchema,

  // TypeScript types inferred from schemas
  type MCPProtocolToolDefinition,
  type MCPToolsListResult,
  type MCPToolsCallParams,
  type MCPToolsCallResult,
  type MCPToolResultContentItem,
  type MCPServerCapabilities,
  type MCPClientCapabilities,
  type MCPInitializeParams,
  type MCPInitializeResult,
  type MCPLogLevel,
  type MCPProtocolMethodName,
  type MCPErrorCodeValue,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@apexcli/core';

// Mock types from core MCP module
import {
  MockMCPServerConfigSchema,
  MockBehaviorConfigSchema,
  MockScenarioSchema,
  MockRequestResponsePairSchema,
  MockToolHandlerSchema,
  MockMCPServerDefinitionSchema,
  type MockMCPServerConfig,
  type MockBehaviorConfig,
  type MockScenario,
  type MockRequestResponsePair,
  type MockToolHandler,
  type MockMCPServerDefinition,
} from '@apexcli/core';

// Zod validation schemas from core types.ts
import {
  MCPConnectionStateSchema,
  MCPConnectionInfoSchema,
  MCPServerConfigSchema,
  MCPToolSchema as MCPToolZodSchema,
  MCPToolSchemaSchema,
  MCPToolCapabilitiesSchema,
} from '@apexcli/core';

// ============================================================================
// Orchestrator MCP Component Imports
// ============================================================================

import { MCPToolRegistry } from '../../mcp-tool-registry.js';
import type { MCPToolRegistryEntry, MCPToolRegistryStats } from '../../mcp-tool-registry.js';
import { MCPConnectionManager } from '../../mcp/connection-manager.js';
import type { MCPConnectionManagerOptions } from '../../mcp/connection-manager.js';

// ============================================================================
// Mock Dependencies
// ============================================================================

vi.mock('../../mcp/client.js');
vi.mock('../../mcp/transports/stdio-transport.js');
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
  spawn: vi.fn(),
  execFile: vi.fn(),
  fork: vi.fn(),
  default: { exec: vi.fn(), spawn: vi.fn() },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a valid MCPConnection instance using core types
 */
function createValidMCPConnection(overrides: Partial<MCPConnection> = {}): MCPConnection {
  const connection: MCPConnection = {
    serverId: 'test-server-1',
    serverName: 'Test MCP Server',
    config: {
      name: 'Test Server',
      type: 'stdio',
      command: 'test-mcp-server',
      args: ['--verbose'],
      env: { NODE_ENV: 'test' },
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
      latencyMs: 15,
      avgLatencyMs: 12,
    },
    metrics: {
      totalRequests: 42,
      successfulRequests: 40,
      failedRequests: 2,
      bytesSent: 1024,
      bytesReceived: 4096,
      uptimeMs: 60000,
    },
    ...overrides,
  };
  return connection;
}

/**
 * Creates a valid MCPTool instance using core types
 */
function createValidMCPTool(overrides: Partial<MCPTool> = {}): MCPTool {
  const tool: MCPTool = {
    name: 'read_file',
    description: 'Reads a file from the filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
        encoding: {
          type: 'string',
          description: 'File encoding',
          default: 'utf-8',
          enum: ['utf-8', 'ascii', 'binary'],
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    serverId: 'test-server-1',
    serverName: 'Test MCP Server',
    capabilities: {
      streaming: false,
      cancellable: false,
      progressReporting: false,
      idempotent: true,
      hasSideEffects: false,
    },
    available: true,
    tags: ['filesystem', 'io'],
    ...overrides,
  };
  return tool;
}

/**
 * Creates a valid ApexConfig with MCP settings for orchestrator components
 */
function createValidApexConfig(overrides: Partial<ApexConfig> = {}): ApexConfig {
  return {
    project: {
      name: 'type-compat-test',
      version: '1.0.0',
    },
    limits: {
      maxConcurrentTasks: 5,
      maxDailyTasks: 50,
      maxTokensPerTask: 50000,
      maxTurns: 10,
    },
    mcp: {
      enabled: true,
      servers: {
        'filesystem': {
          name: 'Filesystem Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {},
        },
        'github': {
          name: 'GitHub Server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { MCP_SERVER_MODE: 'test' },
        },
      },
      connection: {
        maxRetries: 3,
        retryDelayMs: 1000,
        connectionTimeoutMs: 10000,
        autoReconnect: true,
        healthCheckIntervalMs: 30000,
      },
    },
    autonomy: { level: 'manual' as const },
    agents: {},
    workflows: {},
    ...overrides,
  } as ApexConfig;
}

// ============================================================================
// Tests
// ============================================================================

describe('Cross-Package MCP Type Compatibility', () => {

  describe('Core MCP Type Imports Verification', () => {
    it('should successfully import all connection-related types from @apexcli/core', () => {
      // Verify schemas are importable and are Zod schemas
      expect(MCPConnectionStateSchema).toBeDefined();
      expect(MCPConnectionInfoSchema).toBeDefined();
      expect(MCPServerConfigSchema).toBeDefined();

      // Verify schema parse methods exist (they are Zod schemas)
      expect(typeof MCPConnectionStateSchema.parse).toBe('function');
      expect(typeof MCPConnectionInfoSchema.parse).toBe('function');
      expect(typeof MCPServerConfigSchema.parse).toBe('function');
    });

    it('should successfully import all tool-related types from @apexcli/core', () => {
      expect(MCPToolZodSchema).toBeDefined();
      expect(MCPToolSchemaSchema).toBeDefined();
      expect(MCPToolCapabilitiesSchema).toBeDefined();

      expect(typeof MCPToolZodSchema.parse).toBe('function');
      expect(typeof MCPToolSchemaSchema.parse).toBe('function');
      expect(typeof MCPToolCapabilitiesSchema.parse).toBe('function');
    });

    it('should successfully import all protocol types from @apexcli/core', () => {
      // JSON-RPC base schemas
      expect(JsonRpcIdSchema).toBeDefined();
      expect(JsonRpcRequestSchema).toBeDefined();
      expect(JsonRpcResponseSchema).toBeDefined();
      expect(JsonRpcErrorSchema).toBeDefined();
      expect(JsonRpcNotificationSchema).toBeDefined();

      // Protocol message schemas
      expect(MCPInitializeParamsSchema).toBeDefined();
      expect(MCPInitializeResultSchema).toBeDefined();
      expect(MCPProtocolToolDefinitionSchema).toBeDefined();
      expect(MCPToolsListResultSchema).toBeDefined();
      expect(MCPToolsCallParamsSchema).toBeDefined();
      expect(MCPToolsCallResultSchema).toBeDefined();
      expect(MCPToolResultContentItemSchema).toBeDefined();

      // Resource schemas
      expect(MCPProtocolResourceDefinitionSchema).toBeDefined();
      expect(MCPResourcesListResultSchema).toBeDefined();
      expect(MCPResourcesReadResultSchema).toBeDefined();

      // Prompt schemas
      expect(MCPProtocolPromptDefinitionSchema).toBeDefined();
      expect(MCPPromptsListResultSchema).toBeDefined();
      expect(MCPPromptsGetResultSchema).toBeDefined();

      // Other schemas
      expect(MCPLoggingSetLevelParamsSchema).toBeDefined();
      expect(MCPCompletionCompleteParamsSchema).toBeDefined();
      expect(MCPServerCapabilitiesSchema).toBeDefined();
      expect(MCPClientCapabilitiesSchema).toBeDefined();
    });

    it('should successfully import protocol constants from @apexcli/core', () => {
      // Method constants
      expect(MCPProtocolMethod.Initialize).toBe('initialize');
      expect(MCPProtocolMethod.ToolsList).toBe('tools/list');
      expect(MCPProtocolMethod.ToolsCall).toBe('tools/call');
      expect(MCPProtocolMethod.ResourcesList).toBe('resources/list');
      expect(MCPProtocolMethod.ResourcesRead).toBe('resources/read');
      expect(MCPProtocolMethod.PromptsList).toBe('prompts/list');
      expect(MCPProtocolMethod.PromptsGet).toBe('prompts/get');
      expect(MCPProtocolMethod.LoggingSetLevel).toBe('logging/setLevel');
      expect(MCPProtocolMethod.CompletionComplete).toBe('completion/complete');

      // Error codes
      expect(MCPErrorCode.ParseError).toBe(-32700);
      expect(MCPErrorCode.InvalidRequest).toBe(-32600);
      expect(MCPErrorCode.MethodNotFound).toBe(-32601);
      expect(MCPErrorCode.InvalidParams).toBe(-32602);
      expect(MCPErrorCode.InternalError).toBe(-32603);
      expect(MCPErrorCode.ResourceNotFound).toBe(-32002);
      expect(MCPErrorCode.ToolNotFound).toBe(-32004);
      expect(MCPErrorCode.ToolExecutionError).toBe(-32005);
    });

    it('should successfully import all mock types from @apexcli/core', () => {
      expect(MockMCPServerConfigSchema).toBeDefined();
      expect(MockBehaviorConfigSchema).toBeDefined();
      expect(MockScenarioSchema).toBeDefined();
      expect(MockRequestResponsePairSchema).toBeDefined();
      expect(MockToolHandlerSchema).toBeDefined();
      expect(MockMCPServerDefinitionSchema).toBeDefined();

      expect(typeof MockMCPServerConfigSchema.parse).toBe('function');
      expect(typeof MockBehaviorConfigSchema.parse).toBe('function');
      expect(typeof MockScenarioSchema.parse).toBe('function');
    });
  });

  describe('Core Type Validation with Orchestrator Data Shapes', () => {
    it('should validate MCPConnection instances used by MCPConnectionManager', () => {
      const connection = createValidMCPConnection();

      // Validate using core Zod schema
      const result = MCPConnectionInfoSchema.safeParse(connection);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.serverId).toBe('test-server-1');
        expect(result.data.state).toBe('connected');
        expect(result.data.config.type).toBe('stdio');
      }
    });

    it('should validate all MCPConnectionState values used by orchestrator', () => {
      const validStates: MCPConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'error',
      ];

      for (const state of validStates) {
        const result = MCPConnectionStateSchema.safeParse(state);
        expect(result.success).toBe(true);
      }
    });

    it('should validate MCPServerConfig shapes used by MCPConnectionManager', () => {
      const stdioConfig: MCPServerConfig = {
        name: 'Filesystem Server',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: { HOME: '/home/user' },
      };

      const httpConfig: MCPServerConfig = {
        name: 'HTTP Server',
        type: 'http',
        url: 'http://localhost:3000',
      };

      expect(MCPServerConfigSchema.safeParse(stdioConfig).success).toBe(true);
      expect(MCPServerConfigSchema.safeParse(httpConfig).success).toBe(true);
    });

    it('should validate MCPTool instances used by MCPToolRegistry', () => {
      const tool = createValidMCPTool();

      const result = MCPToolZodSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('read_file');
        expect(result.data.serverId).toBe('test-server-1');
        expect(result.data.inputSchema.type).toBe('object');
      }
    });

    it('should validate MCPToolSchema shapes with nested properties', () => {
      const schema: MCPToolSchema = {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
            minLength: 1,
            maxLength: 500,
          },
          limit: {
            type: 'number',
            description: 'Maximum results',
            minimum: 1,
            maximum: 100,
          },
          options: {
            type: 'object',
            description: 'Additional options',
            properties: {
              caseSensitive: { type: 'boolean' },
            },
          },
        },
        required: ['query'],
        additionalProperties: false,
      };

      const result = MCPToolSchemaSchema.safeParse(schema);
      expect(result.success).toBe(true);
    });

    it('should validate MCPToolCapabilities used in tool metadata', () => {
      const capabilities: MCPToolCapabilities = {
        streaming: true,
        cancellable: true,
        progressReporting: true,
        idempotent: false,
        hasSideEffects: true,
      };

      const result = MCPToolCapabilitiesSchema.safeParse(capabilities);
      expect(result.success).toBe(true);
    });
  });

  describe('MCPConnectionManager Type Compatibility', () => {
    it('should accept ApexConfig with MCP configuration', () => {
      const config = createValidApexConfig();
      const options: MCPConnectionManagerOptions = {
        projectPath: '/test/project',
        config,
      };

      // MCPConnectionManager constructor should accept this without type errors
      const manager = new MCPConnectionManager(options);
      expect(manager).toBeDefined();
    });

    it('should accept ApexConfig with custom connection settings', () => {
      const connectionConfig: MCPConnectionConfig = {
        maxRetries: 5,
        retryDelayMs: 2000,
        connectionTimeoutMs: 15000,
        autoReconnect: true,
        healthCheckIntervalMs: 60000,
      };

      const config = createValidApexConfig();
      const options: MCPConnectionManagerOptions = {
        projectPath: '/test/project',
        config,
        connectionConfig,
      };

      const manager = new MCPConnectionManager(options);
      expect(manager).toBeDefined();
    });

    it('should handle MCPConnection objects from connection events', () => {
      const config = createValidApexConfig();
      const manager = new MCPConnectionManager({
        projectPath: '/test/project',
        config,
      });

      // Verify listConnections returns MCPConnection-compatible objects
      const connections = manager.listConnections();
      expect(Array.isArray(connections)).toBe(true);

      // Each connection should satisfy the MCPConnection type structure
      for (const conn of connections) {
        expect(conn).toHaveProperty('serverId');
        expect(conn).toHaveProperty('state');
        expect(conn).toHaveProperty('config');
      }
    });

    it('should emit events with correct MCPConnectionState types', () => {
      const config = createValidApexConfig();
      const manager = new MCPConnectionManager({
        projectPath: '/test/project',
        config,
      });

      const stateChanges: Array<{ prev: string; next: string }> = [];

      manager.on('stateChange', (serverId, previousState, newState) => {
        stateChanges.push({ prev: previousState, next: newState });
        // Both states should be valid MCPConnectionState values
        expect(MCPConnectionStateSchema.safeParse(previousState).success).toBe(true);
        expect(MCPConnectionStateSchema.safeParse(newState).success).toBe(true);
      });

      // Manager is correctly typed - no errors
      expect(manager).toBeDefined();
    });
  });

  describe('MCPToolRegistry Type Compatibility', () => {
    let toolRegistry: MCPToolRegistry;

    beforeEach(() => {
      toolRegistry = new MCPToolRegistry({
        autoRefresh: false,
        operationTimeoutMs: 5000,
      });
    });

    it('should accept MCPConnection for addConnection', async () => {
      const connection = createValidMCPConnection();

      // addConnection should accept the core MCPConnection type without type errors
      await toolRegistry.addConnection(connection);

      // Verify the connection was tracked
      const stats = toolRegistry.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('should handle MCPConnection in different states', async () => {
      const states: MCPConnectionState[] = ['connected', 'connecting', 'disconnected', 'reconnecting', 'error'];

      for (const state of states) {
        const registry = new MCPToolRegistry({ autoRefresh: false });
        const connection = createValidMCPConnection({
          serverId: `server-${state}`,
          state,
        });

        await registry.addConnection(connection);
        const stats = registry.getStats();
        expect(stats.activeConnections).toBe(1);
      }
    });

    it('should handle MCPConnection with full health and metrics data', async () => {
      const connection = createValidMCPConnection({
        health: {
          healthy: true,
          lastCheckAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          latencyMs: 25,
          avgLatencyMs: 20,
        },
        pool: {
          activeConnections: 2,
          idleConnections: 1,
          totalConnections: 3,
          pendingRequests: 0,
        },
        metrics: {
          totalRequests: 100,
          successfulRequests: 98,
          failedRequests: 2,
          bytesSent: 50000,
          bytesReceived: 200000,
          uptimeMs: 3600000,
        },
      });

      await toolRegistry.addConnection(connection);
      const stats = toolRegistry.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('should emit typed events when connections are added', async () => {
      const events: Array<{ connectionId: string; serverName: string }> = [];

      toolRegistry.on('connection:added', (event) => {
        events.push(event);
      });

      const connection = createValidMCPConnection();
      await toolRegistry.addConnection(connection);

      expect(events).toHaveLength(1);
      expect(events[0].connectionId).toBe('test-server-1');
      expect(events[0].serverName).toBe('Test MCP Server');
    });

    it('should return MCPToolRegistryStats with correct types', () => {
      const stats: MCPToolRegistryStats = toolRegistry.getStats();

      expect(typeof stats.totalTools).toBe('number');
      expect(typeof stats.availableTools).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
      expect(typeof stats.toolsByConnection).toBe('object');
      expect(stats.lastRefresh).toBeInstanceOf(Date);
    });

    it('should accept setConnectionManager with MCPConnectionManager', () => {
      const config = createValidApexConfig();
      const connectionManager = new MCPConnectionManager({
        projectPath: '/test/project',
        config,
      });

      // setConnectionManager should accept MCPConnectionManager without type errors
      toolRegistry.setConnectionManager(connectionManager);
      expect(toolRegistry).toBeDefined();
    });
  });

  describe('Protocol Types Compatibility with Orchestrator Message Handling', () => {
    it('should create valid initialize request params', () => {
      const params: MCPInitializeParams = {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'apex-mcp-client',
          version: '0.5.0',
        },
      };

      const result = MCPInitializeParamsSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should create valid initialize result matching server capabilities', () => {
      const initResult: MCPInitializeResult = {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: false },
          logging: {},
        },
        serverInfo: {
          name: 'test-mcp-server',
          version: '1.0.0',
        },
        instructions: 'This is a test MCP server',
      };

      const result = MCPInitializeResultSchema.safeParse(initResult);
      expect(result.success).toBe(true);
    });

    it('should create valid tools/list result compatible with MCPToolRegistry', () => {
      const toolsListResult: MCPToolsListResult = {
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
              },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write to a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['path', 'content'],
            },
          },
        ],
      };

      const result = MCPToolsListResultSchema.safeParse(toolsListResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toHaveLength(2);
      }
    });

    it('should create valid tools/call params for tool invocation', () => {
      const callParams: MCPToolsCallParams = {
        name: 'read_file',
        arguments: { path: '/test/file.txt', encoding: 'utf-8' },
      };

      const result = MCPToolsCallParamsSchema.safeParse(callParams);
      expect(result.success).toBe(true);
    });

    it('should create valid tools/call result with different content types', () => {
      const textResult: MCPToolsCallResult = {
        content: [
          { type: 'text', text: 'File contents here' },
        ],
        isError: false,
      };

      const imageResult: MCPToolsCallResult = {
        content: [
          { type: 'image', data: 'base64encodeddata', mimeType: 'image/png' },
        ],
      };

      const resourceResult: MCPToolsCallResult = {
        content: [
          {
            type: 'resource',
            resource: {
              uri: 'file:///test.txt',
              mimeType: 'text/plain',
              text: 'Resource content',
            },
          },
        ],
      };

      expect(MCPToolsCallResultSchema.safeParse(textResult).success).toBe(true);
      expect(MCPToolsCallResultSchema.safeParse(imageResult).success).toBe(true);
      expect(MCPToolsCallResultSchema.safeParse(resourceResult).success).toBe(true);
    });

    it('should validate JSON-RPC request envelopes for MCP communication', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: MCPProtocolMethod.ToolsList,
        params: {},
      };

      const result = JsonRpcRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate server capabilities matching orchestrator expectations', () => {
      const capabilities: MCPServerCapabilities = {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: false },
        logging: {},
        experimental: { customFeature: true },
      };

      const result = MCPServerCapabilitiesSchema.safeParse(capabilities);
      expect(result.success).toBe(true);
    });
  });

  describe('Mock Types Compatibility with Test Infrastructure', () => {
    it('should create valid MockMCPServerConfig for test scenarios', () => {
      const mockConfig: MockMCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
        },
        serverInfo: {
          name: 'mock-test-server',
          version: '1.0.0',
        },
        autoStart: true,
        maxConnections: 5,
        shutdownTimeoutMs: 3000,
      };

      const result = MockMCPServerConfigSchema.safeParse(mockConfig);
      expect(result.success).toBe(true);
    });

    it('should create valid MockBehaviorConfig for error injection testing', () => {
      const behavior: MockBehaviorConfig = {
        responseDelay: { fixedMs: 50, jitter: false },
        errorInjection: {
          enabled: true,
          probability: 0.1,
          errorCode: MCPErrorCode.InternalError,
          errorMessage: 'Simulated error',
          methods: [MCPProtocolMethod.ToolsCall],
          afterRequestCount: 5,
          maxErrors: 3,
          simulateConnectionFailure: false,
          errorDelayMs: 0,
        },
        toolHandlers: [
          {
            toolName: 'read_file',
            response: {
              content: [{ type: 'text', text: 'mock file content' }],
              isError: false,
            },
          },
        ],
        recordRequests: true,
        maxRecordedRequests: 100,
        validateRequests: true,
        enableDebugLogging: false,
      };

      const result = MockBehaviorConfigSchema.safeParse(behavior);
      expect(result.success).toBe(true);
    });

    it('should create valid MockScenario combining server config and behavior', () => {
      const scenario: MockScenario = {
        name: 'flaky-connection',
        description: 'Simulates a server with intermittent failures',
        serverConfig: {
          name: 'flaky-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'flaky', version: '1.0.0' },
          autoStart: true,
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        behaviorConfig: {
          errorInjection: {
            enabled: true,
            probability: 0.3,
            errorCode: -32603,
            errorMessage: 'Transient error',
            methods: [],
            afterRequestCount: 0,
            maxErrors: 0,
            simulateConnectionFailure: false,
            errorDelayMs: 0,
          },
          toolHandlers: [],
          notificationTriggers: [],
          expectations: [],
          recordRequests: true,
          maxRecordedRequests: 1000,
          validateRequests: true,
          enableDebugLogging: false,
        },
        tags: ['resilience', 'error-handling'],
        onConnect: [],
        onDisconnect: [],
      };

      const result = MockScenarioSchema.safeParse(scenario);
      expect(result.success).toBe(true);
    });

    it('should create valid MockRequestResponsePair for protocol verification', () => {
      const pair: MockRequestResponsePair = {
        name: 'tools-list-response',
        request: {
          method: MCPProtocolMethod.ToolsList,
          strictParamMatch: false,
        },
        response: {
          result: {
            tools: [
              {
                name: 'test_tool',
                description: 'A test tool',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
          delayMs: 10,
        },
        expectedCallCount: 1,
        required: true,
      };

      const result = MockRequestResponsePairSchema.safeParse(pair);
      expect(result.success).toBe(true);
    });

    it('should create valid MockMCPServerDefinition for full mock setup', () => {
      const definition: MockMCPServerDefinition = {
        serverConfig: {
          name: 'full-mock-server',
          transport: 'stdio',
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'mock', version: '2.0.0' },
          autoStart: true,
          maxConnections: 10,
          shutdownTimeoutMs: 5000,
        },
        defaultBehavior: {
          toolHandlers: [
            {
              toolName: 'search',
              response: {
                content: [{ type: 'text', text: 'search result' }],
                isError: false,
              },
            },
          ],
          recordRequests: true,
          maxRecordedRequests: 500,
          validateRequests: true,
          enableDebugLogging: false,
          notificationTriggers: [],
          expectations: [],
        },
        scenarios: [],
      };

      const result = MockMCPServerDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Compatibility Edge Cases', () => {
    it('should handle MCPConnection with minimal required fields', async () => {
      const minimalConnection: MCPConnection = {
        serverId: 'minimal',
        serverName: 'Minimal Server',
        config: {
          name: 'minimal',
          type: 'stdio',
          command: 'test',
        },
        state: 'disconnected',
        reconnectAttempts: 0,
      };

      const result = MCPConnectionInfoSchema.safeParse(minimalConnection);
      expect(result.success).toBe(true);

      // Should be accepted by MCPToolRegistry
      const registry = new MCPToolRegistry({ autoRefresh: false });
      await registry.addConnection(minimalConnection);
      expect(registry.getStats().activeConnections).toBe(1);
    });

    it('should handle MCPTool with minimal required fields', () => {
      const minimalTool: MCPTool = {
        name: 'minimal_tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        serverId: 'server-1',
        available: true,
        tags: [],
      };

      const result = MCPToolZodSchema.safeParse(minimalTool);
      expect(result.success).toBe(true);
    });

    it('should reject invalid MCPConnectionState values', () => {
      const invalidState = 'invalid-state';
      const result = MCPConnectionStateSchema.safeParse(invalidState);
      expect(result.success).toBe(false);
    });

    it('should reject MCPServerConfig missing required fields', () => {
      const invalidConfig = { type: 'stdio' }; // missing name
      const result = MCPServerConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should handle MCPConnection state transitions through all states', async () => {
      const registry = new MCPToolRegistry({ autoRefresh: false });
      const transitions: MCPConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'connected',
        'error',
        'disconnected',
      ];

      for (let i = 0; i < transitions.length; i++) {
        const connection = createValidMCPConnection({
          serverId: 'transition-test',
          state: transitions[i],
        });

        // Remove previous entry and add updated
        await registry.removeConnection('transition-test');
        await registry.addConnection(connection);
      }

      // Final state should be tracked
      expect(registry.getStats().activeConnections).toBe(1);
    });
  });

  describe('Protocol Type and MCPTool Type Structural Compatibility', () => {
    it('MCPProtocolToolDefinition should be structurally compatible with MCPTool inputSchema', () => {
      // Protocol tool definition (from tools/list response)
      const protocolTool: MCPProtocolToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            arg1: { type: 'string', description: 'First argument' },
          },
          required: ['arg1'],
        },
      };

      // Validate the protocol definition
      const protocolResult = MCPProtocolToolDefinitionSchema.safeParse(protocolTool);
      expect(protocolResult.success).toBe(true);

      // The protocol tool inputSchema should be compatible with MCPToolSchema
      // (MCPToolSchema is a superset with additional metadata fields)
      const toolSchemaResult = MCPToolSchemaSchema.safeParse(protocolTool.inputSchema);
      expect(toolSchemaResult.success).toBe(true);
    });

    it('MCPToolsCallResult content items should match MCPToolResultContentItem type', () => {
      const contentItems: MCPToolResultContentItem[] = [
        { type: 'text', text: 'Hello world' },
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
        {
          type: 'resource',
          resource: { uri: 'file:///test', text: 'content' },
        },
      ];

      for (const item of contentItems) {
        const result = MCPToolResultContentItemSchema.safeParse(item);
        expect(result.success).toBe(true);
      }
    });

    it('should verify MCPErrorCode values are valid JSON-RPC error codes', () => {
      // All error codes should be negative numbers per JSON-RPC spec
      const allCodes: MCPErrorCodeValue[] = [
        MCPErrorCode.ParseError,
        MCPErrorCode.InvalidRequest,
        MCPErrorCode.MethodNotFound,
        MCPErrorCode.InvalidParams,
        MCPErrorCode.InternalError,
        MCPErrorCode.ResourceNotFound,
        MCPErrorCode.ToolNotFound,
        MCPErrorCode.ToolExecutionError,
      ];

      for (const code of allCodes) {
        expect(code).toBeLessThan(0);
        expect(Number.isInteger(code)).toBe(true);
      }
    });

    it('should verify MCPProtocolMethod values cover all standard methods', () => {
      const methods: MCPProtocolMethodName[] = [
        MCPProtocolMethod.Initialize,
        MCPProtocolMethod.Initialized,
        MCPProtocolMethod.ToolsList,
        MCPProtocolMethod.ToolsCall,
        MCPProtocolMethod.ResourcesList,
        MCPProtocolMethod.ResourcesRead,
        MCPProtocolMethod.PromptsList,
        MCPProtocolMethod.PromptsGet,
        MCPProtocolMethod.LoggingSetLevel,
        MCPProtocolMethod.CompletionComplete,
        MCPProtocolMethod.NotificationMessage,
        MCPProtocolMethod.NotificationToolsListChanged,
        MCPProtocolMethod.NotificationResourcesListChanged,
        MCPProtocolMethod.NotificationPromptsListChanged,
        MCPProtocolMethod.NotificationResourcesUpdated,
      ];

      // All methods should be non-empty strings
      for (const method of methods) {
        expect(method.length).toBeGreaterThan(0);
        expect(typeof method).toBe('string');
      }

      // Methods should be unique
      const uniqueMethods = new Set(methods);
      expect(uniqueMethods.size).toBe(methods.length);
    });
  });

  describe('End-to-End Type Flow: Core Types through Orchestrator Components', () => {
    it('should flow MCPServerConfig from ApexConfig to MCPConnectionManager', () => {
      const config = createValidApexConfig();

      // Config should contain MCP server configurations
      expect(config.mcp?.servers).toBeDefined();
      expect(config.mcp?.servers?.['filesystem']).toBeDefined();

      // Each server config should be valid
      for (const [, serverConfig] of Object.entries(config.mcp?.servers || {})) {
        const result = MCPServerConfigSchema.safeParse(serverConfig);
        expect(result.success).toBe(true);
      }

      // MCPConnectionManager should accept the config
      const manager = new MCPConnectionManager({
        projectPath: '/test/project',
        config,
      });
      expect(manager).toBeDefined();
    });

    it('should flow MCPConnection from Manager to ToolRegistry', async () => {
      const config = createValidApexConfig();
      const manager = new MCPConnectionManager({
        projectPath: '/test/project',
        config,
      });
      const registry = new MCPToolRegistry({ autoRefresh: false });

      // Set the connection manager on the registry
      registry.setConnectionManager(manager);

      // Simulate a connection being established
      const connection = createValidMCPConnection();
      await registry.addConnection(connection);

      // Registry should track the connection
      expect(registry.getStats().activeConnections).toBe(1);
    });

    it('should validate complete type chain from protocol to tool registry', () => {
      // 1. Protocol-level tool definition (from MCP server)
      const protocolTool: MCPProtocolToolDefinition = {
        name: 'search',
        description: 'Search files',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            path: { type: 'string', description: 'Base path' },
          },
          required: ['query'],
        },
      };

      // 2. Validate as protocol type
      expect(MCPProtocolToolDefinitionSchema.safeParse(protocolTool).success).toBe(true);

      // 3. Transform to core MCPTool type (as orchestrator would do)
      const mcpTool: MCPTool = {
        name: protocolTool.name,
        description: protocolTool.description,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            path: {
              type: 'string',
              description: 'Base path',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
        serverId: 'search-server',
        serverName: 'Search Server',
        available: true,
        capabilities: {
          streaming: false,
          cancellable: false,
          progressReporting: false,
          idempotent: true,
          hasSideEffects: false,
        },
        tags: ['search'],
      };

      // 4. Validate as core MCPTool type
      expect(MCPToolZodSchema.safeParse(mcpTool).success).toBe(true);

      // 5. Verify tool can be used with MCPToolRegistry MCPConnection
      const connection = createValidMCPConnection({ serverId: 'search-server' });
      expect(MCPConnectionInfoSchema.safeParse(connection).success).toBe(true);
    });
  });
});
