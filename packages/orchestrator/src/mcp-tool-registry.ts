/**
 * MCP Tool Registry - Fetches tools from connected MCP servers and maintains a registry
 *
 * This class provides a centralized registry for MCP tools from connected servers,
 * with schema translation to Claude Agent SDK format and connection lifecycle management.
 *
 * @module orchestrator/mcp-tool-registry
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MCPConnection,
  MCPTool,
  MCPToolSchema,
  MCPConnectionState,
} from '@apexcli/core';
import { MCPClient, type MCPToolDefinition } from './mcp/client.js';
import { SchemaTranslator, type ClaudeSDKTool } from './schema-translator.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Registry entry for an MCP tool with connection and translation metadata
 */
export interface MCPToolRegistryEntry {
  /** Original MCP tool definition */
  mcpTool: MCPToolDefinition;
  /** Translated Claude Agent SDK tool */
  claudeTool: ClaudeSDKTool;
  /** Connection ID that provides this tool */
  connectionId: string;
  /** Server name for display purposes */
  serverName: string;
  /** Timestamp when tool was discovered */
  discoveredAt: Date;
  /** Last time tool was refreshed */
  lastRefreshed: Date;
  /** Whether the tool is currently available (connection active) */
  available: boolean;
}

/**
 * Registry statistics for monitoring and debugging
 */
export interface MCPToolRegistryStats {
  /** Total number of registered tools */
  totalTools: number;
  /** Number of available tools (from active connections) */
  availableTools: number;
  /** Number of active connections */
  activeConnections: number;
  /** Tools grouped by connection ID */
  toolsByConnection: Record<string, number>;
  /** Last registry refresh time */
  lastRefresh: Date;
}

/**
 * Events emitted by MCPToolRegistry
 */
export interface MCPToolRegistryEvents {
  /** Tool was discovered and registered */
  'tool:registered': {
    toolName: string;
    connectionId: string;
    entry: MCPToolRegistryEntry;
  };
  /** Tool was removed from registry */
  'tool:unregistered': {
    toolName: string;
    connectionId: string;
  };
  /** Registry was refreshed */
  'registry:refreshed': {
    connectionsRefreshed: number;
    toolsDiscovered: number;
    duration: number;
  };
  /** Connection was added to registry */
  'connection:added': {
    connectionId: string;
    serverName: string;
  };
  /** Connection was removed from registry */
  'connection:removed': {
    connectionId: string;
    reason?: string;
  };
  /** Error occurred during registry operations */
  'error': {
    operation: string;
    connectionId?: string;
    error: string;
  };
}

/**
 * Options for MCPToolRegistry
 */
export interface MCPToolRegistryOptions {
  /** Schema translator for converting MCP schemas to Claude Agent SDK format */
  schemaTranslator?: SchemaTranslator;
  /** Timeout for MCP operations in milliseconds */
  operationTimeoutMs?: number;
  /** Whether to auto-refresh tools when connections change state */
  autoRefresh?: boolean;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  autoRefreshInterval?: number;
}

/**
 * Connection manager interface for dependency injection
 */
export interface MCPConnectionManager {
  /** Get all current connections */
  listConnections(): MCPConnection[];
  /** Get a specific connection by ID */
  getConnection(connectionId: string): MCPConnection | undefined;
  /** Create MCP client for a connection */
  getClient(connectionId: string): MCPClient | undefined;
}

// ============================================================================
// MCPToolRegistry Class
// ============================================================================

/**
 * Registry for MCP tools from connected servers with schema translation
 *
 * Provides centralized management of tools discovered from MCP connections,
 * maintains tool availability based on connection state, and translates
 * schemas for use with Claude Agent SDK.
 */
export class MCPToolRegistry extends EventEmitter<MCPToolRegistryEvents> {
  private schemaTranslator: SchemaTranslator;
  private operationTimeoutMs: number;
  private autoRefresh: boolean;
  private autoRefreshInterval: number;
  private autoRefreshTimer?: NodeJS.Timer;

  /** Map of tool name -> registry entry */
  private toolRegistry: Map<string, MCPToolRegistryEntry> = new Map();

  /** Map of connection ID -> Set of tool names */
  private connectionTools: Map<string, Set<string>> = new Map();

  /** Map of connection ID -> connection metadata */
  private connections: Map<string, MCPConnection> = new Map();

  /** Connection manager for accessing MCP connections */
  private connectionManager?: MCPConnectionManager;

  constructor(options: MCPToolRegistryOptions = {}) {
    super();

    this.schemaTranslator = options.schemaTranslator || new SchemaTranslator();
    this.operationTimeoutMs = options.operationTimeoutMs || 30000;
    this.autoRefresh = options.autoRefresh ?? true;
    this.autoRefreshInterval = options.autoRefreshInterval || 60000; // 1 minute default

    // Start auto-refresh timer if enabled
    if (this.autoRefresh && this.autoRefreshInterval > 0) {
      this.startAutoRefresh();
    }
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Set the connection manager for accessing MCP connections
   */
  setConnectionManager(connectionManager: MCPConnectionManager): void {
    this.connectionManager = connectionManager;
  }

  /**
   * Add a connection to the registry and discover its tools
   */
  async addConnection(connection: MCPConnection): Promise<void> {
    try {
      this.connections.set(connection.serverId, connection);
      this.connectionTools.set(connection.serverId, new Set());

      this.emit('connection:added', {
        connectionId: connection.serverId,
        serverName: connection.serverName || connection.serverId,
      });

      // Discover tools if connection is active
      if (connection.state === 'connected') {
        await this.refreshConnectionTools(connection.serverId);
      }
    } catch (error) {
      this.emit('error', {
        operation: 'addConnection',
        connectionId: connection.serverId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove a connection from the registry
   */
  async removeConnection(connectionId: string, reason?: string): Promise<void> {
    try {
      // Remove all tools from this connection
      const toolNames = this.connectionTools.get(connectionId) || new Set();
      for (const toolName of toolNames) {
        this.unregisterTool(toolName, connectionId);
      }

      // Clean up connection metadata
      this.connections.delete(connectionId);
      this.connectionTools.delete(connectionId);

      this.emit('connection:removed', {
        connectionId,
        reason,
      });
    } catch (error) {
      this.emit('error', {
        operation: 'removeConnection',
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update connection state and tool availability
   */
  updateConnectionState(connectionId: string, state: MCPConnectionState): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.state = state;

    // Update tool availability based on connection state
    const toolNames = this.connectionTools.get(connectionId) || new Set();
    const isAvailable = state === 'connected';

    for (const toolName of toolNames) {
      const entry = this.toolRegistry.get(toolName);
      if (entry && entry.connectionId === connectionId) {
        entry.available = isAvailable;
      }
    }

    // Auto-refresh tools if connection became active
    if (this.autoRefresh && state === 'connected') {
      this.refreshConnectionTools(connectionId).catch(error => {
        this.emit('error', {
          operation: 'autoRefreshOnConnect',
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  // ==========================================================================
  // Tool Discovery and Registration
  // ==========================================================================

  /**
   * Refresh all tools from all connections
   */
  async refreshAllTools(): Promise<void> {
    const startTime = Date.now();
    let connectionsRefreshed = 0;
    let toolsDiscovered = 0;

    try {
      // Use connection manager if available, otherwise use stored connections
      let connections: MCPConnection[];
      if (this.connectionManager) {
        connections = this.connectionManager.listConnections();
        // Update stored connections
        for (const conn of connections) {
          this.connections.set(conn.serverId, conn);
        }
      } else {
        connections = Array.from(this.connections.values());
      }

      // Refresh tools from each active connection
      for (const connection of connections) {
        if (connection.state === 'connected') {
          try {
            const toolCount = await this.refreshConnectionTools(connection.serverId);
            connectionsRefreshed++;
            toolsDiscovered += toolCount;
          } catch (error) {
            this.emit('error', {
              operation: 'refreshConnectionTools',
              connectionId: connection.serverId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      this.emit('registry:refreshed', {
        connectionsRefreshed,
        toolsDiscovered,
        duration,
      });
    } catch (error) {
      this.emit('error', {
        operation: 'refreshAllTools',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Refresh tools from a specific connection
   */
  private async refreshConnectionTools(connectionId: string): Promise<number> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== 'connected') {
      return 0;
    }

    try {
      // Get MCP client for this connection
      let client: MCPClient | undefined;
      if (this.connectionManager) {
        client = this.connectionManager.getClient(connectionId);
      }

      if (!client) {
        throw new Error(`No MCP client available for connection ${connectionId}`);
      }

      // Fetch tools from MCP server
      const mcpTools = await Promise.race([
        client.listTools(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), this.operationTimeoutMs)
        ),
      ]);

      // Clear existing tools for this connection
      const existingToolNames = this.connectionTools.get(connectionId) || new Set();
      for (const toolName of existingToolNames) {
        this.unregisterTool(toolName, connectionId);
      }
      this.connectionTools.set(connectionId, new Set());

      // Register discovered tools
      let toolCount = 0;
      for (const mcpTool of mcpTools) {
        try {
          await this.registerTool(mcpTool, connectionId);
          toolCount++;
        } catch (error) {
          console.warn(`Failed to register tool ${mcpTool.name} from ${connectionId}:`, error);
        }
      }

      return toolCount;
    } catch (error) {
      throw new Error(`Failed to refresh tools from ${connectionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Register a single MCP tool in the registry
   */
  private async registerTool(mcpTool: MCPToolDefinition, connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      // Convert MCPToolDefinition to MCPTool for SchemaTranslator
      const mcpToolForTranslator: MCPTool = {
        name: mcpTool.name,
        description: mcpTool.description || `Tool from ${connection.serverName || connectionId}`,
        serverId: connectionId,
        serverName: connection.serverName,
        inputSchema: (mcpTool.inputSchema as MCPToolSchema) || {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      // Translate to Claude Agent SDK format
      const claudeTool = this.schemaTranslator.translateTool(mcpToolForTranslator);

      // Create registry entry
      const now = new Date();
      const entry: MCPToolRegistryEntry = {
        mcpTool,
        claudeTool,
        connectionId,
        serverName: connection.serverName || connectionId,
        discoveredAt: now,
        lastRefreshed: now,
        available: connection.state === 'connected',
      };

      // Register the tool
      this.toolRegistry.set(mcpTool.name, entry);

      // Add to connection's tool set
      const connectionToolSet = this.connectionTools.get(connectionId) || new Set();
      connectionToolSet.add(mcpTool.name);
      this.connectionTools.set(connectionId, connectionToolSet);

      this.emit('tool:registered', {
        toolName: mcpTool.name,
        connectionId,
        entry,
      });
    } catch (error) {
      throw new Error(`Failed to register tool ${mcpTool.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Unregister a tool from the registry
   */
  private unregisterTool(toolName: string, connectionId: string): void {
    const entry = this.toolRegistry.get(toolName);
    if (entry && entry.connectionId === connectionId) {
      this.toolRegistry.delete(toolName);

      const connectionToolSet = this.connectionTools.get(connectionId);
      if (connectionToolSet) {
        connectionToolSet.delete(toolName);
      }

      this.emit('tool:unregistered', {
        toolName,
        connectionId,
      });
    }
  }

  // ==========================================================================
  // Registry Access
  // ==========================================================================

  /**
   * Get all registered tools
   */
  getAllTools(): MCPToolRegistryEntry[] {
    return Array.from(this.toolRegistry.values());
  }

  /**
   * Get available tools (from active connections only)
   */
  getAvailableTools(): MCPToolRegistryEntry[] {
    return Array.from(this.toolRegistry.values()).filter(entry => entry.available);
  }

  /**
   * Get tools from a specific connection
   */
  getToolsByConnection(connectionId: string): MCPToolRegistryEntry[] {
    const toolNames = this.connectionTools.get(connectionId) || new Set();
    return Array.from(toolNames)
      .map(name => this.toolRegistry.get(name))
      .filter((entry): entry is MCPToolRegistryEntry => entry !== undefined);
  }

  /**
   * Get a specific tool by name
   */
  getTool(toolName: string): MCPToolRegistryEntry | undefined {
    return this.toolRegistry.get(toolName);
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Check if a tool is available (from active connection)
   */
  isToolAvailable(toolName: string): boolean {
    const entry = this.toolRegistry.get(toolName);
    return entry ? entry.available : false;
  }

  /**
   * Get registry statistics
   */
  getStats(): MCPToolRegistryStats {
    const entries = Array.from(this.toolRegistry.values());
    const toolsByConnection: Record<string, number> = {};

    for (const [connectionId, toolNames] of this.connectionTools) {
      toolsByConnection[connectionId] = toolNames.size;
    }

    return {
      totalTools: entries.length,
      availableTools: entries.filter(entry => entry.available).length,
      activeConnections: Array.from(this.connections.values()).filter(
        conn => conn.state === 'connected'
      ).length,
      toolsByConnection,
      lastRefresh: new Date(),
    };
  }

  // ==========================================================================
  // Auto-Refresh Management
  // ==========================================================================

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }

    if (this.autoRefreshInterval > 0) {
      this.autoRefreshTimer = setInterval(() => {
        this.refreshAllTools().catch(error => {
          this.emit('error', {
            operation: 'autoRefresh',
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, this.autoRefreshInterval);
    }
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
  }

  /**
   * Set auto-refresh interval
   */
  setAutoRefreshInterval(intervalMs: number): void {
    this.autoRefreshInterval = intervalMs;
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  // ==========================================================================
  // Cleanup and Shutdown
  // ==========================================================================

  /**
   * Clear all registered tools and connections
   */
  clear(): void {
    this.toolRegistry.clear();
    this.connectionTools.clear();
    this.connections.clear();
  }

  /**
   * Shutdown the registry
   */
  shutdown(): void {
    this.stopAutoRefresh();
    this.clear();
    this.removeAllListeners();
  }
}