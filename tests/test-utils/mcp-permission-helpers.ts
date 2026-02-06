/**
 * MCP Permission Test Helpers
 *
 * Specialized test utilities for MCP (Model Context Protocol) permission scenarios.
 * Provides mock MCP servers, permission managers, and assertion helpers
 * specifically designed for testing MCP tool permissions and access control.
 *
 * @module tests/test-utils/mcp-permission-helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  PermissionLevel,
  ToolPermissionResult,
  McpServer,
  McpTool,
  McpResource,
} from '../../packages/core/src/types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for mock MCP permission manager
 */
export interface MockMcpPermissionManagerConfig {
  /** MCP servers to allow/deny access to */
  allowedServers?: string[];
  deniedServers?: string[];
  /** MCP tools to allow/deny */
  allowedTools?: string[];
  deniedTools?: string[];
  /** MCP resources to allow/deny access to */
  allowedResources?: string[];
  deniedResources?: string[];
  /** Default permission level */
  defaultPermissionLevel?: PermissionLevel;
  /** Whether to simulate MCP connection failures */
  simulateConnectionFailures?: boolean;
  /** Whether to simulate permission check failures */
  simulatePermissionFailures?: boolean;
}

/**
 * Mock MCP permission manager
 */
export interface MockMcpPermissionManager {
  checkServerPermission: MockedFunction<(serverId: string) => Promise<ToolPermissionResult>>;
  checkToolPermission: MockedFunction<(serverId: string, toolName: string) => Promise<ToolPermissionResult>>;
  checkResourcePermission: MockedFunction<(serverId: string, resourceUri: string) => Promise<ToolPermissionResult>>;
  grantServerAccess: MockedFunction<(serverId: string, level?: PermissionLevel) => Promise<void>>;
  denyServerAccess: MockedFunction<(serverId: string) => Promise<void>>;
  listAllowedServers: MockedFunction<() => Promise<string[]>>;
  listDeniedServers: MockedFunction<() => Promise<string[]>>;
}

/**
 * Mock MCP server for testing
 */
export interface MockMcpServer {
  id: string;
  name: string;
  version: string;
  tools: MockMcpTool[];
  resources: MockMcpResource[];
  connect: MockedFunction<() => Promise<void>>;
  disconnect: MockedFunction<() => Promise<void>>;
  listTools: MockedFunction<() => Promise<MockMcpTool[]>>;
  listResources: MockedFunction<() => Promise<MockMcpResource[]>>;
  callTool: MockedFunction<(name: string, args: any) => Promise<any>>;
  readResource: MockedFunction<(uri: string) => Promise<any>>;
  isConnected: boolean;
}

/**
 * Mock MCP tool
 */
export interface MockMcpTool {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  permissions?: PermissionLevel[];
  sensitive?: boolean;
}

/**
 * Mock MCP resource
 */
export interface MockMcpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  sensitive?: boolean;
  permissions?: PermissionLevel[];
}

/**
 * MCP permission event
 */
export interface McpPermissionEvent {
  type: 'server_access_requested' | 'server_access_granted' | 'server_access_denied' |
        'tool_access_requested' | 'tool_access_granted' | 'tool_access_denied' |
        'resource_access_requested' | 'resource_access_granted' | 'resource_access_denied';
  serverId?: string;
  toolName?: string;
  resourceUri?: string;
  level?: PermissionLevel;
  denialReason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * MCP permission test context
 */
export interface McpPermissionTestContext {
  permissionManager: MockMcpPermissionManager;
  mockServers: Map<string, MockMcpServer>;
  eventEmitter: EventEmitter;
  events: McpPermissionEvent[];
  connectionManager: MockMcpConnectionManager;
}

/**
 * Mock MCP connection manager
 */
export interface MockMcpConnectionManager {
  connect: MockedFunction<(serverId: string) => Promise<MockMcpServer>>;
  disconnect: MockedFunction<(serverId: string) => Promise<void>>;
  getServer: MockedFunction<(serverId: string) => MockMcpServer | undefined>;
  listConnectedServers: MockedFunction<() => string[]>;
  isConnected: MockedFunction<(serverId: string) => boolean>;
}

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Create a mock MCP permission manager
 */
export function createMockMcpPermissionManager(config: MockMcpPermissionManagerConfig = {}): MockMcpPermissionManager {
  const {
    allowedServers = [],
    deniedServers = [],
    allowedTools = [],
    deniedTools = [],
    allowedResources = [],
    deniedResources = [],
    defaultPermissionLevel = 'full',
    simulateConnectionFailures = false,
    simulatePermissionFailures = false,
  } = config;

  return {
    checkServerPermission: vi.fn(async (serverId: string): Promise<ToolPermissionResult> => {
      if (simulatePermissionFailures) {
        throw new Error('MCP permission system temporarily unavailable');
      }

      if (deniedServers.includes(serverId) || deniedServers.includes('*')) {
        return {
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: `MCP server '${serverId}' access denied by policy`,
        };
      }

      if (allowedServers.includes(serverId) || allowedServers.includes('*') || allowedServers.length === 0) {
        return {
          allowed: true,
          level: defaultPermissionLevel,
          requiresConfirmation: defaultPermissionLevel === 'limited',
        };
      }

      return {
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: `MCP server '${serverId}' not in allowed list`,
      };
    }),

    checkToolPermission: vi.fn(async (serverId: string, toolName: string): Promise<ToolPermissionResult> => {
      if (simulatePermissionFailures) {
        throw new Error('MCP tool permission check failed');
      }

      const toolKey = `${serverId}:${toolName}`;

      if (deniedTools.includes(toolName) || deniedTools.includes(toolKey) || deniedTools.includes('*')) {
        return {
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: `MCP tool '${toolName}' on server '${serverId}' is denied by policy`,
        };
      }

      if (allowedTools.includes(toolName) || allowedTools.includes(toolKey) || allowedTools.includes('*') || allowedTools.length === 0) {
        return {
          allowed: true,
          level: defaultPermissionLevel,
          requiresConfirmation: toolName.includes('sensitive') || defaultPermissionLevel === 'limited',
        };
      }

      return {
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: `MCP tool '${toolName}' not in allowed list`,
      };
    }),

    checkResourcePermission: vi.fn(async (serverId: string, resourceUri: string): Promise<ToolPermissionResult> => {
      if (simulatePermissionFailures) {
        throw new Error('MCP resource permission check failed');
      }

      const resourceKey = `${serverId}:${resourceUri}`;

      if (deniedResources.some(denied => resourceUri.includes(denied)) || deniedResources.includes('*')) {
        return {
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: `MCP resource '${resourceUri}' access denied by policy`,
        };
      }

      if (allowedResources.some(allowed => resourceUri.includes(allowed)) || allowedResources.includes('*') || allowedResources.length === 0) {
        return {
          allowed: true,
          level: defaultPermissionLevel,
          requiresConfirmation: resourceUri.includes('sensitive') || defaultPermissionLevel === 'limited',
        };
      }

      return {
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: `MCP resource '${resourceUri}' not in allowed list`,
      };
    }),

    grantServerAccess: vi.fn(async (serverId: string, level: PermissionLevel = 'full'): Promise<void> => {
      const index = deniedServers.indexOf(serverId);
      if (index >= 0) {
        deniedServers.splice(index, 1);
      }
      if (!allowedServers.includes(serverId)) {
        allowedServers.push(serverId);
      }
    }),

    denyServerAccess: vi.fn(async (serverId: string): Promise<void> => {
      const index = allowedServers.indexOf(serverId);
      if (index >= 0) {
        allowedServers.splice(index, 1);
      }
      if (!deniedServers.includes(serverId)) {
        deniedServers.push(serverId);
      }
    }),

    listAllowedServers: vi.fn(async (): Promise<string[]> => {
      return [...allowedServers];
    }),

    listDeniedServers: vi.fn(async (): Promise<string[]> => {
      return [...deniedServers];
    }),
  };
}

/**
 * Create a mock MCP server
 */
export function createMockMcpServer(
  id: string,
  config: {
    name?: string;
    version?: string;
    tools?: Partial<MockMcpTool>[];
    resources?: Partial<MockMcpResource>[];
    simulateConnectionFailures?: boolean;
  } = {}
): MockMcpServer {
  const {
    name = `Mock MCP Server ${id}`,
    version = '1.0.0',
    tools = [],
    resources = [],
    simulateConnectionFailures = false,
  } = config;

  const defaultTools: MockMcpTool[] = [
    {
      name: 'read_file',
      description: 'Read a file from the filesystem',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      permissions: ['read-only', 'limited', 'full'],
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
      permissions: ['limited', 'full'],
    },
    {
      name: 'list_files',
      description: 'List files in a directory',
      inputSchema: { type: 'object', properties: { directory: { type: 'string' } } },
      permissions: ['read-only', 'limited', 'full'],
    },
  ];

  const defaultResources: MockMcpResource[] = [
    {
      uri: 'file:///project/config.json',
      name: 'Project Configuration',
      description: 'Main project configuration file',
      mimeType: 'application/json',
    },
    {
      uri: 'file:///project/secrets.env',
      name: 'Environment Secrets',
      description: 'Sensitive environment variables',
      mimeType: 'text/plain',
      sensitive: true,
      permissions: ['full'],
    },
  ];

  const mockTools = [...defaultTools, ...tools.map(tool => ({ ...defaultTools[0], ...tool }))];
  const mockResources = [...defaultResources, ...resources.map(resource => ({ ...defaultResources[0], ...resource }))];

  let isConnected = false;

  return {
    id,
    name,
    version,
    tools: mockTools,
    resources: mockResources,
    isConnected,

    connect: vi.fn(async (): Promise<void> => {
      if (simulateConnectionFailures) {
        throw new Error(`Failed to connect to MCP server '${id}': Connection refused`);
      }
      isConnected = true;
    }),

    disconnect: vi.fn(async (): Promise<void> => {
      isConnected = false;
    }),

    listTools: vi.fn(async (): Promise<MockMcpTool[]> => {
      if (!isConnected) {
        throw new Error(`MCP server '${id}' is not connected`);
      }
      return mockTools;
    }),

    listResources: vi.fn(async (): Promise<MockMcpResource[]> => {
      if (!isConnected) {
        throw new Error(`MCP server '${id}' is not connected`);
      }
      return mockResources;
    }),

    callTool: vi.fn(async (toolName: string, args: any): Promise<any> => {
      if (!isConnected) {
        throw new Error(`MCP server '${id}' is not connected`);
      }

      const tool = mockTools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found on server '${id}'`);
      }

      // Simulate tool execution
      switch (toolName) {
        case 'read_file':
          return { content: `Mock content of ${args.path}`, size: 1024 };
        case 'write_file':
          return { success: true, bytesWritten: args.content?.length || 0 };
        case 'list_files':
          return {
            files: [
              { name: 'file1.txt', size: 100, modified: new Date() },
              { name: 'file2.json', size: 256, modified: new Date() },
            ]
          };
        default:
          return { result: `Mock result for ${toolName}` };
      }
    }),

    readResource: vi.fn(async (uri: string): Promise<any> => {
      if (!isConnected) {
        throw new Error(`MCP server '${id}' is not connected`);
      }

      const resource = mockResources.find(r => r.uri === uri);
      if (!resource) {
        throw new Error(`Resource '${uri}' not found on server '${id}'`);
      }

      // Simulate resource reading
      if (uri.includes('config.json')) {
        return {
          content: JSON.stringify({ name: 'test-project', version: '1.0.0' }),
          mimeType: 'application/json'
        };
      } else if (uri.includes('secrets.env')) {
        return {
          content: 'API_KEY=secret123\nDATABASE_URL=postgresql://...',
          mimeType: 'text/plain'
        };
      } else {
        return {
          content: `Mock content for resource ${uri}`,
          mimeType: resource.mimeType || 'text/plain'
        };
      }
    }),
  };
}

/**
 * Create a mock MCP connection manager
 */
export function createMockMcpConnectionManager(servers: Map<string, MockMcpServer> = new Map()): MockMcpConnectionManager {
  const connectedServers = new Set<string>();

  return {
    connect: vi.fn(async (serverId: string): Promise<MockMcpServer> => {
      const server = servers.get(serverId);
      if (!server) {
        throw new Error(`MCP server '${serverId}' not found`);
      }

      await server.connect();
      connectedServers.add(serverId);
      return server;
    }),

    disconnect: vi.fn(async (serverId: string): Promise<void> => {
      const server = servers.get(serverId);
      if (server) {
        await server.disconnect();
        connectedServers.delete(serverId);
      }
    }),

    getServer: vi.fn((serverId: string): MockMcpServer | undefined => {
      return servers.get(serverId);
    }),

    listConnectedServers: vi.fn((): string[] => {
      return Array.from(connectedServers);
    }),

    isConnected: vi.fn((serverId: string): boolean => {
      return connectedServers.has(serverId);
    }),
  };
}

/**
 * Create a complete MCP permission test context
 */
export function createMcpPermissionTestContext(config: MockMcpPermissionManagerConfig = {}): McpPermissionTestContext {
  const permissionManager = createMockMcpPermissionManager(config);
  const eventEmitter = new EventEmitter();
  const events: McpPermissionEvent[] = [];
  const mockServers = new Map<string, MockMcpServer>();
  const connectionManager = createMockMcpConnectionManager(mockServers);

  // Setup event tracking
  const eventTypes: McpPermissionEvent['type'][] = [
    'server_access_requested',
    'server_access_granted',
    'server_access_denied',
    'tool_access_requested',
    'tool_access_granted',
    'tool_access_denied',
    'resource_access_requested',
    'resource_access_granted',
    'resource_access_denied',
  ];

  eventTypes.forEach(eventType => {
    eventEmitter.on(eventType, (event) => {
      events.push({ type: eventType, timestamp: new Date(), ...event });
    });
  });

  // Add some default mock servers
  const defaultServers = [
    createMockMcpServer('filesystem', {
      name: 'Filesystem Server',
      tools: [
        { name: 'read_file', permissions: ['read-only', 'limited', 'full'] },
        { name: 'write_file', permissions: ['limited', 'full'] },
        { name: 'delete_file', permissions: ['full'], sensitive: true },
      ],
    }),
    createMockMcpServer('database', {
      name: 'Database Server',
      tools: [
        { name: 'query', permissions: ['read-only', 'limited', 'full'] },
        { name: 'execute', permissions: ['full'], sensitive: true },
      ],
    }),
    createMockMcpServer('web', {
      name: 'Web API Server',
      tools: [
        { name: 'fetch', permissions: ['read-only', 'limited', 'full'] },
        { name: 'post', permissions: ['limited', 'full'] },
      ],
    }),
  ];

  defaultServers.forEach(server => {
    mockServers.set(server.id, server);
  });

  return {
    permissionManager,
    mockServers,
    eventEmitter,
    events,
    connectionManager,
  };
}

// ============================================================================
// Scenario Generators
// ============================================================================

/**
 * Generate MCP permission test scenarios
 */
export function createMcpPermissionTestScenarios() {
  return {
    // Server access scenarios
    allowAllServers: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      defaultPermissionLevel: 'full',
    }),

    denyAllServers: () => createMcpPermissionTestContext({
      deniedServers: ['*'],
    }),

    allowSpecificServers: () => createMcpPermissionTestContext({
      allowedServers: ['filesystem', 'web'],
      deniedServers: ['database'],
    }),

    // Tool-level restrictions
    readOnlyTools: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      allowedTools: ['read_file', 'query', 'fetch'],
      deniedTools: ['write_file', 'delete_file', 'execute', 'post'],
      defaultPermissionLevel: 'read-only',
    }),

    safeModeTools: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      deniedTools: ['delete_file', 'execute', 'drop_table'],
      defaultPermissionLevel: 'limited',
    }),

    // Resource-level restrictions
    noSensitiveResources: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      deniedResources: ['secrets', 'credentials', '.env'],
      defaultPermissionLevel: 'full',
    }),

    publicResourcesOnly: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      allowedResources: ['public', 'docs', 'assets'],
      deniedResources: ['private', 'internal', 'admin'],
      defaultPermissionLevel: 'limited',
    }),

    // Failure simulation scenarios
    connectionFailures: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      simulateConnectionFailures: true,
    }),

    permissionCheckFailures: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      simulatePermissionFailures: true,
    }),

    // Complex mixed scenarios
    developmentEnvironment: () => createMcpPermissionTestContext({
      allowedServers: ['filesystem', 'web', 'database'],
      allowedTools: ['*'],
      deniedResources: ['/prod/', '/production/'],
      defaultPermissionLevel: 'full',
    }),

    productionEnvironment: () => createMcpPermissionTestContext({
      allowedServers: ['web'],
      allowedTools: ['fetch'],
      deniedTools: ['delete_file', 'execute', 'drop_table'],
      deniedResources: ['secrets', 'credentials', 'config'],
      defaultPermissionLevel: 'read-only',
    }),

    testingEnvironment: () => createMcpPermissionTestContext({
      allowedServers: ['*'],
      allowedTools: ['*'],
      allowedResources: ['*'],
      defaultPermissionLevel: 'limited',
    }),
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that MCP server access was handled correctly
 */
export function assertMcpServerAccess(
  result: ToolPermissionResult,
  expectedOutcome: 'allowed' | 'denied',
  serverId: string
): void {
  if (expectedOutcome === 'allowed') {
    expect(result.allowed).toBe(true);
    expect(result.level).toBeDefined();
    expect(result.level).not.toBeNull();
  } else {
    expect(result.allowed).toBe(false);
    expect(result.level).toBeNull();
    expect(result.denialReason).toBeDefined();
    expect(result.denialReason).toContain(serverId);
  }
}

/**
 * Assert that MCP tool access was handled correctly
 */
export function assertMcpToolAccess(
  result: ToolPermissionResult,
  expectedOutcome: 'allowed' | 'denied',
  toolName: string
): void {
  if (expectedOutcome === 'allowed') {
    expect(result.allowed).toBe(true);
    expect(result.level).toBeDefined();
  } else {
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBeDefined();
    expect(result.denialReason).toContain(toolName);
  }
}

/**
 * Assert that MCP resource access was handled correctly
 */
export function assertMcpResourceAccess(
  result: ToolPermissionResult,
  expectedOutcome: 'allowed' | 'denied',
  resourceUri: string
): void {
  if (expectedOutcome === 'allowed') {
    expect(result.allowed).toBe(true);
    expect(result.level).toBeDefined();
  } else {
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBeDefined();
    expect(result.denialReason).toContain(resourceUri.split('/').pop() || resourceUri);
  }
}

/**
 * Assert that MCP permission events were emitted correctly
 */
export function assertMcpPermissionEvents(
  events: McpPermissionEvent[],
  expectedType: McpPermissionEvent['type'],
  expectedCount: number = 1
): void {
  const relevantEvents = events.filter(e => e.type === expectedType);
  expect(relevantEvents).toHaveLength(expectedCount);

  relevantEvents.forEach(event => {
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
}

/**
 * Assert that MCP server is in correct connection state
 */
export function assertMcpServerState(
  server: MockMcpServer,
  expectedState: 'connected' | 'disconnected'
): void {
  if (expectedState === 'connected') {
    expect(server.isConnected).toBe(true);
  } else {
    expect(server.isConnected).toBe(false);
  }
}

/**
 * Assert that MCP tool response is correct
 */
export function assertMcpToolResponse(
  response: any,
  toolName: string,
  expectedSuccess: boolean = true
): void {
  if (expectedSuccess) {
    expect(response).toBeDefined();
    expect(response).not.toBeNull();

    // Check for common response patterns
    if (toolName === 'read_file') {
      expect(response).toHaveProperty('content');
    } else if (toolName === 'write_file') {
      expect(response).toHaveProperty('success');
      expect(response.success).toBe(true);
    } else if (toolName === 'list_files') {
      expect(response).toHaveProperty('files');
      expect(Array.isArray(response.files)).toBe(true);
    }
  } else {
    expect(response).toBeUndefined();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simulate MCP server workflow
 */
export async function simulateMcpWorkflow(
  context: McpPermissionTestContext,
  workflow: Array<{
    serverId: string;
    action: 'connect' | 'list_tools' | 'call_tool' | 'read_resource' | 'disconnect';
    params?: any;
    expectedOutcome?: 'success' | 'denied' | 'error';
  }>
): Promise<{ results: any[]; events: McpPermissionEvent[] }> {
  const results: any[] = [];
  const startingEvents = [...context.events];

  for (const step of workflow) {
    const { serverId, action, params, expectedOutcome = 'success' } = step;

    try {
      let result: any = null;

      switch (action) {
        case 'connect':
          // Check server permission first
          const serverPermission = await context.permissionManager.checkServerPermission(serverId);
          context.eventEmitter.emit('server_access_requested', { serverId });

          if (serverPermission.allowed) {
            context.eventEmitter.emit('server_access_granted', { serverId, level: serverPermission.level });
            result = await context.connectionManager.connect(serverId);
          } else {
            context.eventEmitter.emit('server_access_denied', {
              serverId,
              denialReason: serverPermission.denialReason
            });
            result = { error: serverPermission.denialReason };
          }
          break;

        case 'list_tools':
          const server = context.connectionManager.getServer(serverId);
          if (server && server.isConnected) {
            result = await server.listTools();
          } else {
            result = { error: `Server ${serverId} not connected` };
          }
          break;

        case 'call_tool':
          const callServer = context.connectionManager.getServer(serverId);
          if (callServer && callServer.isConnected) {
            const toolPermission = await context.permissionManager.checkToolPermission(serverId, params.toolName);
            context.eventEmitter.emit('tool_access_requested', {
              serverId,
              toolName: params.toolName
            });

            if (toolPermission.allowed) {
              context.eventEmitter.emit('tool_access_granted', {
                serverId,
                toolName: params.toolName,
                level: toolPermission.level
              });
              result = await callServer.callTool(params.toolName, params.args);
            } else {
              context.eventEmitter.emit('tool_access_denied', {
                serverId,
                toolName: params.toolName,
                denialReason: toolPermission.denialReason
              });
              result = { error: toolPermission.denialReason };
            }
          } else {
            result = { error: `Server ${serverId} not connected` };
          }
          break;

        case 'read_resource':
          const resourceServer = context.connectionManager.getServer(serverId);
          if (resourceServer && resourceServer.isConnected) {
            const resourcePermission = await context.permissionManager.checkResourcePermission(serverId, params.uri);
            context.eventEmitter.emit('resource_access_requested', {
              serverId,
              resourceUri: params.uri
            });

            if (resourcePermission.allowed) {
              context.eventEmitter.emit('resource_access_granted', {
                serverId,
                resourceUri: params.uri,
                level: resourcePermission.level
              });
              result = await resourceServer.readResource(params.uri);
            } else {
              context.eventEmitter.emit('resource_access_denied', {
                serverId,
                resourceUri: params.uri,
                denialReason: resourcePermission.denialReason
              });
              result = { error: resourcePermission.denialReason };
            }
          } else {
            result = { error: `Server ${serverId} not connected` };
          }
          break;

        case 'disconnect':
          result = await context.connectionManager.disconnect(serverId);
          break;

        default:
          result = { error: `Unknown action: ${action}` };
      }

      results.push({
        serverId,
        action,
        params,
        result,
        success: !result?.error,
      });

    } catch (error: any) {
      results.push({
        serverId,
        action,
        params,
        error: error.message,
        success: false,
      });
    }
  }

  const newEvents = context.events.slice(startingEvents.length);
  return { results, events: newEvents };
}

/**
 * Reset MCP test context
 */
export function resetMcpTestContext(context: McpPermissionTestContext): void {
  // Clear events
  context.events.length = 0;

  // Remove all event listeners
  context.eventEmitter.removeAllListeners();

  // Re-setup event tracking
  const eventTypes: McpPermissionEvent['type'][] = [
    'server_access_requested',
    'server_access_granted',
    'server_access_denied',
    'tool_access_requested',
    'tool_access_granted',
    'tool_access_denied',
    'resource_access_requested',
    'resource_access_granted',
    'resource_access_denied',
  ];

  eventTypes.forEach(eventType => {
    context.eventEmitter.on(eventType, (event) => {
      context.events.push({ type: eventType, timestamp: new Date(), ...event });
    });
  });

  // Disconnect all servers
  context.mockServers.forEach(async (server) => {
    if (server.isConnected) {
      await server.disconnect();
    }
  });

  // Reset mocks
  vi.clearAllMocks();
}