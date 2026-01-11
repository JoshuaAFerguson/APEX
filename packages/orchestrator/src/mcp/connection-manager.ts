/**
 * MCPConnectionManager - Centralized manager for MCP server connections
 *
 * This class provides a unified interface for managing connections to
 * MCP (Model Context Protocol) servers. It handles connection lifecycle,
 * automatic reconnection, and event emission for connection state changes.
 *
 * @module orchestrator/mcp/connection-manager
 *
 * @example
 * ```typescript
 * import { MCPConnectionManager } from '@apexcli/orchestrator/mcp';
 *
 * const manager = new MCPConnectionManager({
 *   projectPath: '/path/to/project',
 *   config: apexConfig,
 *   autoReconnect: true,
 * });
 *
 * // Listen for connection events
 * manager.on('connected', (connection) => {
 *   console.log(`Connected to ${connection.serverName}`);
 * });
 *
 * manager.on('error', (serverId, error) => {
 *   console.error(`Error with ${serverId}:`, error);
 * });
 *
 * // Discover available servers
 * const servers = manager.discoverServers();
 *
 * // Connect to a server
 * const connection = await manager.connect('filesystem');
 *
 * // List all connections
 * const connections = manager.listConnections();
 *
 * // Disconnect from a server
 * await manager.disconnect('filesystem');
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import type {
  ApexConfig,
  MCPServerConfig,
  MCPConnection,
  MCPConnectionState,
} from '@apexcli/core';
import { StdioTransport, type StdioTransportOptions } from './transports/index.js';
import { MCPClient } from './client.js';
import type { MCPTransport } from './transports/transport.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for MCPConnectionManager initialization
 */
export interface MCPConnectionManagerOptions {
  /** Project root path */
  projectPath: string;
  /** APEX configuration */
  config: ApexConfig;
  /** Whether to automatically reconnect on disconnection (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 3) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelayMs?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelayMs?: number;
  /** Connection timeout in ms (default: 30000) */
  connectionTimeoutMs?: number;
}

/**
 * Events emitted by MCPConnectionManager
 */
export interface MCPConnectionManagerEvents {
  /** Emitted when a server is successfully connected */
  'connected': (connection: MCPConnection) => void;
  /** Emitted when a server is disconnected */
  'disconnected': (serverId: string, reason?: string) => void;
  /** Emitted when a connection error occurs */
  'error': (serverId: string, error: Error) => void;
  /** Emitted when attempting to reconnect */
  'reconnecting': (serverId: string, attempt: number, maxAttempts: number) => void;
}

/**
 * Internal context for tracking connection state and resources
 */
interface ConnectionContext {
  /** The public connection data */
  connection: MCPConnection;
  /** The transport instance */
  transport: MCPTransport;
  /** The client instance */
  client: MCPClient;
  /** Reconnection timer reference */
  reconnectTimer?: NodeJS.Timeout;
  /** Whether we're intentionally disconnecting (not for reconnect) */
  intentionalDisconnect: boolean;
}

// ============================================================================
// MCPConnectionManager Class
// ============================================================================

/**
 * Centralized manager for MCP server connections
 *
 * MCPConnectionManager provides a unified interface for managing connections
 * to MCP servers. It handles:
 * - Server discovery from configuration
 * - Connection establishment
 * - Connection state tracking
 * - Automatic reconnection with exponential backoff
 * - Event emission for connection lifecycle
 *
 * The manager uses the existing transport infrastructure (StdioTransport)
 * and MCPClient for communication with MCP servers.
 */
export class MCPConnectionManager extends EventEmitter<MCPConnectionManagerEvents> {
  /** Project root path */
  private projectPath: string;

  /** APEX configuration */
  private config: ApexConfig;

  /** Auto-reconnect setting */
  private autoReconnect: boolean;

  /** Maximum reconnection attempts */
  private maxReconnectAttempts: number;

  /** Initial reconnection delay in ms */
  private reconnectDelayMs: number;

  /** Maximum reconnection delay in ms */
  private maxReconnectDelayMs: number;

  /** Connection timeout in ms */
  private connectionTimeoutMs: number;

  /** Map of server ID to connection context */
  private connections: Map<string, ConnectionContext> = new Map();

  /**
   * Create a new MCPConnectionManager instance
   *
   * @param options - Manager configuration options
   */
  constructor(options: MCPConnectionManagerOptions) {
    super();
    this.projectPath = options.projectPath;
    this.config = options.config;
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 30000;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 30000;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Discover available MCP servers from configuration
   *
   * Reads from config.mcp.servers and returns enabled server configs.
   * SDK-type servers are filtered out as they're managed differently.
   *
   * @returns Array of server configurations available for connection
   */
  discoverServers(): MCPServerConfig[] {
    if (!this.config.mcp?.enabled) {
      return [];
    }

    const servers = this.config.mcp?.servers ?? {};
    const discoveredServers: MCPServerConfig[] = [];

    for (const [serverId, serverConfig] of Object.entries(servers)) {
      const type = serverConfig.type ?? 'stdio';

      // Skip SDK type servers - they're managed by the SDK directly
      if (type === 'sdk') {
        continue;
      }

      // Validate required fields based on type
      if (type === 'stdio' && !serverConfig.command) {
        continue;
      }

      if ((type === 'http' || type === 'sse') && !serverConfig.url) {
        continue;
      }

      // Add to discovered servers with serverId preserved as name if not set
      discoveredServers.push({
        ...serverConfig,
        name: serverConfig.name ?? serverId,
      });
    }

    return discoveredServers;
  }

  /**
   * Connect to a specific MCP server
   *
   * Creates a transport and client, establishes the connection,
   * and tracks the connection state. Emits 'connected' on success
   * or 'error' on failure.
   *
   * @param serverId - The server identifier (config key name)
   * @returns Promise resolving to the MCPConnection object
   * @throws Error if server not found or connection fails
   */
  async connect(serverId: string): Promise<MCPConnection> {
    // Check if already connected or connecting
    const existing = this.connections.get(serverId);
    if (existing) {
      if (existing.connection.state === 'connected') {
        return existing.connection;
      }
      if (existing.connection.state === 'connecting') {
        throw new Error(`Connection to server '${serverId}' is already in progress`);
      }
    }

    // Get server configuration
    const serverConfig = this.getServerConfig(serverId);
    if (!serverConfig) {
      throw new Error(`MCP server '${serverId}' not found in configuration`);
    }

    // Create connection object
    const connection: MCPConnection = {
      serverId,
      serverName: serverConfig.name ?? serverId,
      config: serverConfig,
      state: 'connecting',
      reconnectAttempts: 0,
    };

    try {
      // Create transport based on type
      const transport = this.createTransport(serverConfig);

      // Create client
      const client = new MCPClient({
        transport,
        timeoutMs: this.connectionTimeoutMs,
      });

      // Create context
      const context: ConnectionContext = {
        connection,
        transport,
        client,
        intentionalDisconnect: false,
      };

      // Store context
      this.connections.set(serverId, context);

      // Set up transport event handlers
      this.setupTransportHandlers(serverId, context);

      // Connect
      await client.connect();

      // Update connection state
      const now = new Date();
      connection.state = 'connected';
      connection.connectedAt = now;
      connection.lastActivityAt = now;
      connection.reconnectAttempts = 0;
      connection.lastError = undefined;

      // Emit connected event
      this.emit('connected', connection);

      return connection;
    } catch (error) {
      // Update connection state to error
      connection.state = 'error';
      connection.lastError = error instanceof Error ? error.message : String(error);

      // Clean up on failure
      this.connections.delete(serverId);

      // Emit error event
      this.emit('error', serverId, error instanceof Error ? error : new Error(String(error)));

      throw error;
    }
  }

  /**
   * Disconnect from a specific MCP server
   *
   * Gracefully closes the connection and cleans up resources.
   * Emits 'disconnected' event on completion.
   *
   * @param serverId - The server identifier
   */
  async disconnect(serverId: string): Promise<void> {
    const context = this.connections.get(serverId);
    if (!context) {
      return; // Already disconnected
    }

    // Mark as intentional disconnect to prevent reconnection
    context.intentionalDisconnect = true;

    // Clear any pending reconnection timer
    if (context.reconnectTimer) {
      clearTimeout(context.reconnectTimer);
      context.reconnectTimer = undefined;
    }

    const previousState = context.connection.state;

    try {
      // Disconnect client
      await context.client.disconnect();
    } catch (error) {
      // Log but don't throw - we're cleaning up anyway
      console.error(`Error disconnecting from ${serverId}:`, error);
    }

    // Update state
    context.connection.state = 'disconnected';

    // Remove from connections map
    this.connections.delete(serverId);

    // Emit disconnected event
    this.emit('disconnected', serverId, `Disconnected from state: ${previousState}`);
  }

  /**
   * Get a connection by server ID
   *
   * @param serverId - The server identifier
   * @returns The MCPConnection object or undefined if not connected
   */
  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId)?.connection;
  }

  /**
   * List all current connections
   *
   * Returns array of all active and pending connections,
   * including those in connecting, reconnecting, or error states.
   *
   * @returns Array of MCPConnection objects
   */
  listConnections(): MCPConnection[] {
    return Array.from(this.connections.values()).map(ctx => ctx.connection);
  }

  /**
   * Get the MCPClient for a connected server
   *
   * This allows direct access to the client for tool invocation.
   *
   * @param serverId - The server identifier
   * @returns The MCPClient or undefined if not connected
   */
  getClient(serverId: string): MCPClient | undefined {
    return this.connections.get(serverId)?.client;
  }

  /**
   * Update the configuration
   *
   * Use this to update the configuration after initialization.
   *
   * @param config - The new APEX configuration
   */
  updateConfig(config: ApexConfig): void {
    this.config = config;
  }

  /**
   * Disconnect all servers and clean up resources
   */
  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());
    await Promise.all(serverIds.map(id => this.disconnect(id)));
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get server configuration from the config
   */
  private getServerConfig(serverId: string): MCPServerConfig | undefined {
    const servers = this.config.mcp?.servers ?? {};
    const config = servers[serverId];
    if (!config) {
      return undefined;
    }
    return {
      ...config,
      name: config.name ?? serverId,
    };
  }

  /**
   * Create a transport based on server configuration
   */
  private createTransport(serverConfig: MCPServerConfig): MCPTransport {
    const type = serverConfig.type ?? 'stdio';

    switch (type) {
      case 'stdio': {
        if (!serverConfig.command) {
          throw new Error('Stdio transport requires a command');
        }

        const options: StdioTransportOptions = {
          command: serverConfig.command,
          args: serverConfig.args,
          cwd: this.projectPath,
          env: serverConfig.env,
          connectionTimeout: this.connectionTimeoutMs,
          autoReconnect: false, // We handle reconnection at the manager level
        };

        return new StdioTransport(options);
      }

      case 'http':
      case 'sse':
        // SSE/HTTP transports not yet implemented
        throw new Error(`Transport type '${type}' is not yet implemented`);

      case 'sdk':
        throw new Error('SDK type servers should not use MCPConnectionManager');

      default:
        throw new Error(`Unknown transport type: ${type}`);
    }
  }

  /**
   * Set up event handlers for the transport
   */
  private setupTransportHandlers(serverId: string, context: ConnectionContext): void {
    const { transport, connection } = context;

    // Handle transport errors
    transport.on('error', (error) => {
      connection.lastError = error.message;
      this.emit('error', serverId, error);
    });

    // Handle transport disconnection
    transport.on('disconnected', (reason) => {
      // Don't handle if we intentionally disconnected
      if (context.intentionalDisconnect) {
        return;
      }

      const previousState = connection.state;
      connection.state = 'disconnected';

      this.emit('disconnected', serverId, reason);

      // Attempt reconnection if enabled
      if (this.autoReconnect && connection.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnection(serverId, context);
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnection(serverId: string, context: ConnectionContext): void {
    const { connection } = context;

    // Calculate delay with exponential backoff
    const attempt = connection.reconnectAttempts;
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, attempt),
      this.maxReconnectDelayMs
    );

    // Add jitter (up to 25% of delay)
    const jitter = Math.random() * delay * 0.25;
    const totalDelay = delay + jitter;

    // Update state
    connection.state = 'reconnecting';
    connection.reconnectAttempts++;

    // Emit reconnecting event
    this.emit('reconnecting', serverId, connection.reconnectAttempts, this.maxReconnectAttempts);

    // Schedule reconnection
    context.reconnectTimer = setTimeout(async () => {
      try {
        // Remove old context
        this.connections.delete(serverId);

        // Attempt reconnection
        await this.connect(serverId);
      } catch (error) {
        // Check if we should try again
        const newContext = this.connections.get(serverId);
        if (newContext && newContext.connection.reconnectAttempts < this.maxReconnectAttempts) {
          // Preserve reconnect attempts count
          newContext.connection.reconnectAttempts = connection.reconnectAttempts;
          this.scheduleReconnection(serverId, newContext);
        }
      }
    }, totalDelay);
  }

  /**
   * Helper to create a delay promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
