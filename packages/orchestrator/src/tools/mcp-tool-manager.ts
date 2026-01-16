/**
 * MCP Tool Manager - Manages MCP servers and exposes tools via APEX tool system
 *
 * This module integrates MCP (Model Context Protocol) servers with APEX's tool
 * system, providing discovery, connection, permission management, and execution
 * of MCP tools through APEX agents.
 *
 * @module orchestrator/tools/mcp-tool-manager
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MCPServerConfig,
  ToolDefinition,
  ToolExecution,
  PermissionLevel,
  MCPTool,
  MCPToolSchema,
} from '@apexcli/core';
import type { ToolRegistry, ToolInterface } from '@apexcli/core/tools';
import type { PermissionManager } from '../permission-manager';
import { MCPClient, type MCPClientOptions, type MCPToolDefinition } from '../mcp/client.js';
import { StdioTransport } from '../mcp/transports/stdio-transport.js';
import { SchemaTranslator } from '../schema-translator.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MCPToolManagerOptions {
  /** Permission manager for tool access control */
  permissionManager: PermissionManager;
  /** Tool registry for registering discovered tools */
  toolRegistry: ToolRegistry;
  /** Whether to automatically discover tools when servers connect */
  enableAutoDiscovery?: boolean;
  /** Timeout for MCP operations in milliseconds */
  operationTimeoutMs?: number;
  /** Schema translator for converting MCP schemas to Claude Agent SDK format */
  schemaTranslator?: SchemaTranslator;
}

export interface MCPToolManagerEvents {
  /** Emitted when a tool is discovered from an MCP server */
  'tool:discovered': {
    tool: ToolDefinition;
    serverId: string;
    capabilities?: Record<string, unknown>;
  };
  /** Emitted when a tool is registered with the tool registry */
  'tool:registered': {
    toolName: string;
    serverId: string;
  };
  /** Emitted when an MCP server connects successfully */
  'server:connected': {
    serverId: string;
    serverName: string;
  };
  /** Emitted when an MCP server disconnects */
  'server:disconnected': {
    serverId: string;
    reason?: string;
  };
  /** Emitted when a tool execution starts */
  'tool:execution-start': {
    toolName: string;
    serverId: string;
    params: Record<string, unknown>;
  };
  /** Emitted when a tool execution completes */
  'tool:execution-complete': {
    toolName: string;
    serverId: string;
    success: boolean;
    duration: number;
  };
}

interface ConnectedServer {
  id: string;
  config: MCPServerConfig;
  client: MCPClient;
  tools: Map<string, MCPToolDefinition>;
  connected: boolean;
}

interface MCPToolExecutionContext {
  toolName: string;
  serverId: string;
  params: Record<string, unknown>;
}

interface MCPToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration?: number;
}

type MCPToolHookType = 'beforeExecute' | 'afterExecute' | 'onError';

interface MCPToolHook {
  type: MCPToolHookType;
  handler: (context: MCPToolExecutionContext, ...args: any[]) => Promise<any>;
}

// ============================================================================
// MCPToolManager Class
// ============================================================================

/**
 * Manages MCP server connections and tool discovery/execution
 *
 * The MCPToolManager provides:
 * - Connection management for MCP servers
 * - Automatic tool discovery and registration
 * - Permission-aware tool execution
 * - Hook system for custom behavior
 * - Integration with APEX tool registry
 */
export class MCPToolManager extends EventEmitter<MCPToolManagerEvents> {
  private permissionManager: PermissionManager;
  private toolRegistry: ToolRegistry;
  private enableAutoDiscovery: boolean;
  private operationTimeoutMs: number;
  private schemaTranslator: SchemaTranslator;

  private servers: Map<string, ConnectedServer> = new Map();
  private hooks: MCPToolHook[] = [];

  constructor(options: MCPToolManagerOptions) {
    super();

    this.permissionManager = options.permissionManager;
    this.toolRegistry = options.toolRegistry;
    this.enableAutoDiscovery = options.enableAutoDiscovery ?? true;
    this.operationTimeoutMs = options.operationTimeoutMs ?? 30000;
    this.schemaTranslator = options.schemaTranslator ?? new SchemaTranslator();
  }

  // ==========================================================================
  // Server Management
  // ==========================================================================

  /**
   * Connects to an MCP server and discovers its tools
   *
   * @param config - MCP server configuration
   * @param clientOverride - Optional pre-configured client (for testing)
   * @returns Connection result with success status
   */
  async connectServer(
    config: MCPServerConfig,
    clientOverride?: MCPClient
  ): Promise<MCPToolExecutionResult> {
    try {
      // Check if we have permission to start MCP servers
      const hasPermission = await this.checkPermission('mcp-server', {});
      if (!hasPermission.allowed) {
        return {
          success: false,
          error: `MCP server connection not allowed: ${hasPermission.reason || 'permission denied'}`,
        };
      }

      const serverId = config.name || config.command || 'unknown';

      // Check if server is already connected
      if (this.servers.has(serverId)) {
        const existing = this.servers.get(serverId)!;
        if (existing.connected) {
          return { success: true, result: 'Already connected' };
        }
      }

      // Create MCP client
      let client: MCPClient;
      if (clientOverride) {
        client = clientOverride;
      } else {
        const transport = new StdioTransport({
          command: config.command!,
          args: config.args || [],
          env: config.env || {},
        });

        client = new MCPClient({
          transport,
          timeoutMs: this.operationTimeoutMs,
        });
      }

      // Connect to server
      await client.connect();

      // Create server entry
      const server: ConnectedServer = {
        id: serverId,
        config,
        client,
        tools: new Map(),
        connected: true,
      };

      this.servers.set(serverId, server);

      // Discover tools if auto-discovery is enabled
      if (this.enableAutoDiscovery) {
        await this.discoverServerTools(serverId);
      }

      this.emit('server:connected', {
        serverId,
        serverName: config.name || serverId,
      });

      return { success: true, result: 'Connected successfully' };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Disconnects from an MCP server
   *
   * @param serverId - ID of the server to disconnect
   */
  async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    try {
      if (server.connected) {
        await server.client.disconnect();
      }
    } catch (error) {
      // Log error but continue with cleanup
      console.warn(`Error disconnecting from MCP server ${serverId}:`, error);
    }

    // Unregister tools from this server
    for (const toolName of server.tools.keys()) {
      try {
        if (this.toolRegistry.has(toolName)) {
          this.toolRegistry.unregister(toolName);
        }
      } catch (error) {
        console.warn(`Error unregistering tool ${toolName}:`, error);
      }
    }

    server.connected = false;
    this.servers.delete(serverId);

    this.emit('server:disconnected', { serverId });
  }

  /**
   * Gets the list of connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.servers.keys()).filter(serverId => {
      const server = this.servers.get(serverId);
      return server?.connected;
    });
  }

  // ==========================================================================
  // Tool Discovery and Registration
  // ==========================================================================

  /**
   * Discovers tools from a connected MCP server
   *
   * @param serverId - ID of the server to discover tools from
   */
  private async discoverServerTools(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || !server.connected) {
      return;
    }

    try {
      // List tools from MCP server
      const mcpTools = await server.client.listTools();

      // Convert MCP tools to APEX tool definitions and register them
      for (const mcpTool of mcpTools) {
        const toolDefinition = this.convertMcpToolToApexTool(mcpTool, serverId);

        // Store MCP tool reference
        server.tools.set(mcpTool.name, mcpTool);

        // Emit discovery event
        this.emit('tool:discovered', {
          tool: toolDefinition,
          serverId,
          capabilities: mcpTool.inputSchema,
        });

        // Register with tool registry if not already registered
        if (!this.toolRegistry.has(toolDefinition.name)) {
          // Create a tool interface wrapper for the MCP tool
          const toolInterface = this.createMcpToolInterface(toolDefinition, serverId);
          this.toolRegistry.register(toolInterface);

          this.emit('tool:registered', {
            toolName: toolDefinition.name,
            serverId,
          });
        }
      }

    } catch (error) {
      console.error(`Error discovering tools from MCP server ${serverId}:`, error);
    }
  }

  /**
   * Converts an MCP tool definition to APEX tool definition
   *
   * @param mcpTool - MCP tool definition
   * @param serverId - Server ID that provides this tool
   * @returns APEX tool definition
   */
  private convertMcpToolToApexTool(mcpTool: MCPToolDefinition, serverId: string): ToolDefinition {
    // Convert MCPToolDefinition to MCPTool format for SchemaTranslator
    const mcpToolForTranslator: MCPTool = {
      name: mcpTool.name,
      description: mcpTool.description,
      serverId: serverId,
      inputSchema: (mcpTool.inputSchema as MCPToolSchema) || {
        type: 'object',
        properties: {},
        required: []
      },
    };

    // Use SchemaTranslator to create Claude Agent SDK compatible tool
    const claudeSDKTool = this.schemaTranslator.translateTool(mcpToolForTranslator);

    return {
      name: mcpTool.name,
      description: mcpTool.description || `MCP tool from ${serverId}`,
      category: 'custom', // MCP tools are categorized as custom
      parameters: mcpTool.inputSchema || { type: 'object', properties: {} },
      enabled: true,
      version: '1.0.0',
      permissions: this.inferPermissionsFromTool(mcpTool),
      metadata: {
        mcpServerId: serverId,
        mcpTool: true,
        claudeSDKTool: claudeSDKTool, // Store translated tool for Claude Agent SDK usage
      },
    };
  }

  /**
   * Infers required permissions from MCP tool definition
   *
   * @param mcpTool - MCP tool definition
   * @returns Array of inferred permission names
   */
  private inferPermissionsFromTool(mcpTool: MCPToolDefinition): string[] {
    const permissions: string[] = [];

    // Add basic MCP permission
    permissions.push('mcp-tool');

    // Infer specific permissions based on tool name patterns
    const toolName = mcpTool.name.toLowerCase();

    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) {
      permissions.push('read', 'write');
    }

    if (toolName.includes('network') || toolName.includes('http') || toolName.includes('api')) {
      permissions.push('network');
    }

    if (toolName.includes('exec') || toolName.includes('command') || toolName.includes('shell')) {
      permissions.push('execute');
    }

    if (toolName.includes('database') || toolName.includes('db')) {
      permissions.push('database');
    }

    return permissions;
  }

  /**
   * Creates a tool interface wrapper for an MCP tool
   *
   * @param definition - APEX tool definition
   * @param serverId - Server ID that provides this tool
   * @returns Tool interface for registration
   */
  private createMcpToolInterface(definition: ToolDefinition, serverId: string): any {
    return {
      getDefinition: () => definition,
      execute: async (params: Record<string, unknown>) => {
        return this.executeTool(definition.name, params);
      },
    };
  }

  // ==========================================================================
  // Tool Execution
  // ==========================================================================

  /**
   * Executes an MCP tool with permission checking and hooks
   *
   * @param toolName - Name of the tool to execute
   * @param params - Tool execution parameters
   * @returns Tool execution result
   */
  async executeTool(toolName: string, params: Record<string, unknown>): Promise<MCPToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Find the server that provides this tool
      let serverId: string | null = null;
      let server: ConnectedServer | null = null;

      for (const [id, srv] of this.servers) {
        if (srv.tools.has(toolName) && srv.connected) {
          serverId = id;
          server = srv;
          break;
        }
      }

      if (!server || !serverId) {
        return {
          success: false,
          error: `Tool ${toolName} not found in any connected MCP server`,
        };
      }

      const context: MCPToolExecutionContext = {
        toolName,
        serverId,
        params,
      };

      // Emit execution start event
      this.emit('tool:execution-start', context);

      // Check permissions
      const hasPermission = await this.checkPermission(toolName, params);
      if (!hasPermission.allowed) {
        const duration = Date.now() - startTime;
        this.emit('tool:execution-complete', {
          toolName,
          serverId,
          success: false,
          duration,
        });

        return {
          success: false,
          error: `Permission denied: ${hasPermission.reason || 'access not allowed'}`,
          duration,
        };
      }

      // Run beforeExecute hooks
      try {
        const beforeHooks = this.hooks.filter(h => h.type === 'beforeExecute');
        for (const hook of beforeHooks) {
          const hookResult = await hook.handler(context);
          if (hookResult && !hookResult.allowed) {
            return {
              success: false,
              error: `Execution blocked by hook: ${hookResult.reason || 'unknown reason'}`,
              duration: Date.now() - startTime,
            };
          }
        }
      } catch (hookError) {
        return {
          success: false,
          error: `Hook error: ${hookError instanceof Error ? hookError.message : String(hookError)}`,
          duration: Date.now() - startTime,
        };
      }

      // Execute the tool via MCP client
      let result: unknown;
      try {
        result = await server.client.callTool(toolName, params);
      } catch (mcpError) {
        // Run onError hooks
        const errorHooks = this.hooks.filter(h => h.type === 'onError');
        for (const hook of errorHooks) {
          try {
            const hookResult = await hook.handler(context, mcpError);
            if (hookResult && hookResult.handled) {
              return hookResult.result;
            }
          } catch (hookErr) {
            console.error('Error in onError hook:', hookErr);
          }
        }

        const duration = Date.now() - startTime;
        this.emit('tool:execution-complete', {
          toolName,
          serverId,
          success: false,
          duration,
        });

        return {
          success: false,
          error: mcpError instanceof Error ? mcpError.message : String(mcpError),
          duration,
        };
      }

      const duration = Date.now() - startTime;
      const executionResult: MCPToolExecutionResult = {
        success: true,
        result,
        duration,
      };

      // Run afterExecute hooks
      const afterHooks = this.hooks.filter(h => h.type === 'afterExecute');
      for (const hook of afterHooks) {
        try {
          const hookResult = await hook.handler(context, executionResult);
          if (hookResult) {
            // Allow hooks to modify the result
            Object.assign(executionResult, hookResult);
          }
        } catch (hookError) {
          console.error('Error in afterExecute hook:', hookError);
        }
      }

      this.emit('tool:execution-complete', {
        toolName,
        serverId,
        success: true,
        duration,
      });

      return executionResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('tool:execution-complete', {
        toolName,
        serverId: serverId || 'unknown',
        success: false,
        duration,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  // ==========================================================================
  // Permission Management
  // ==========================================================================

  /**
   * Checks if a tool execution is permitted
   *
   * @param toolName - Name of the tool
   * @param params - Tool execution parameters
   * @returns Permission check result
   */
  private async checkPermission(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check if the tool requires permission
      const hasToolPermission = await this.permissionManager.hasPermission(toolName);

      if (!hasToolPermission) {
        // Check for MCP-specific permissions
        const hasMcpPermission = await this.permissionManager.hasPermission('mcp-tool');
        if (!hasMcpPermission) {
          return {
            allowed: false,
            reason: 'MCP tool execution not permitted',
          };
        }
      }

      // Additional path-based checks for file operations
      if (params.path && typeof params.path === 'string') {
        const pathPermitted = await this.permissionManager.checkPathAccess?.(params.path);
        if (pathPermitted === false) {
          return {
            allowed: false,
            reason: `Path access denied: ${params.path}`,
          };
        }
      }

      return { allowed: true };

    } catch (error) {
      return {
        allowed: false,
        reason: `Permission check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ==========================================================================
  // Hook System
  // ==========================================================================

  /**
   * Adds a hook for tool execution lifecycle events
   *
   * @param type - Type of hook to add
   * @param handler - Hook handler function
   */
  addHook(
    type: MCPToolHookType,
    handler: (context: MCPToolExecutionContext, ...args: any[]) => Promise<any>
  ): void {
    this.hooks.push({ type, handler });
  }

  /**
   * Removes a hook
   *
   * @param type - Type of hook to remove
   * @param handler - Hook handler function to remove
   */
  removeHook(
    type: MCPToolHookType,
    handler: (context: MCPToolExecutionContext, ...args: any[]) => Promise<any>
  ): void {
    const index = this.hooks.findIndex(h => h.type === type && h.handler === handler);
    if (index >= 0) {
      this.hooks.splice(index, 1);
    }
  }

  /**
   * Clears all hooks of a specific type
   *
   * @param type - Type of hooks to clear
   */
  clearHooks(type?: MCPToolHookType): void {
    if (type) {
      this.hooks = this.hooks.filter(h => h.type !== type);
    } else {
      this.hooks = [];
    }
  }

  // ==========================================================================
  // Cleanup and Shutdown
  // ==========================================================================

  /**
   * Shuts down the MCP tool manager and disconnects all servers
   */
  async shutdown(): Promise<void> {
    const serverIds = Array.from(this.servers.keys());

    await Promise.allSettled(
      serverIds.map(serverId => this.disconnectServer(serverId))
    );

    this.clearHooks();
    this.removeAllListeners();
  }
}