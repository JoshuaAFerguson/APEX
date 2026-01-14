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
  MCPConnectionConfig,
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
  /** Override connection configuration (uses config.mcp.connection if not provided) */
  connectionConfig?: MCPConnectionConfig;
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
  /** Emitted when a health check is performed */
  'healthCheck': (serverId: string, result: HealthCheckResult) => void;
  /** Emitted when connection state changes */
  'stateChange': (serverId: string, previousState: MCPConnectionState, newState: MCPConnectionState) => void;
  /** Emitted when connection pool size changes */
  'poolChange': (serverId: string, poolSize: number, activeConnections: number) => void;
}

/**
 * Result of a health check operation
 */
export interface HealthCheckResult {
  /** Whether the health check was successful */
  success: boolean;
  /** Response latency in milliseconds (if successful) */
  latencyMs?: number;
  /** Error that occurred during health check (if failed) */
  error?: Error;
  /** Number of consecutive failures leading up to this check */
  consecutiveFailures: number;
  /** Whether the connection is considered healthy */
  isHealthy: boolean;
  /** Timestamp when the check was performed */
  timestamp: Date;
}

/**
 * Health state tracking for a connection
 */
export interface HealthState {
  /** Last successful health check timestamp */
  lastHealthyAt?: Date;
  /** Last health check timestamp (regardless of result) */
  lastCheckAt?: Date;
  /** Consecutive health check failures */
  consecutiveFailures: number;
  /** Whether connection is currently healthy */
  isHealthy: boolean;
  /** Average response latency in ms */
  averageLatencyMs: number;
  /** Response latencies for rolling average (last 10 checks) */
  latencyHistory: number[];
  /** Health check timer */
  healthCheckTimer?: NodeJS.Timeout;
}

/**
 * Connection metrics tracking
 */
export interface ConnectionMetrics {
  /** Total number of connections made */
  totalConnections: number;
  /** Total number of reconnections */
  totalReconnections: number;
  /** Average latency over all health checks */
  averageLatencyMs: number;
  /** Uptime since last connection */
  uptimeMs: number;
  /** Connection start time */
  connectedAt?: Date;
  /** Last error encountered */
  lastError?: {
    message: string;
    timestamp: Date;
    code?: string;
  };
  /** Total requests made */
  totalRequests: number;
  /** Total errors encountered */
  totalErrors: number;
}

/**
 * Pooled connection wrapper
 */
export interface PooledConnection {
  /** Unique identifier for this pooled connection */
  id: string;
  /** The underlying connection */
  connection: MCPConnection;
  /** The transport instance */
  transport: MCPTransport;
  /** The client instance */
  client: MCPClient;
  /** Whether this connection is currently in use */
  inUse: boolean;
  /** When this connection was last used */
  lastUsedAt: Date;
  /** When this connection was created */
  createdAt: Date;
  /** Number of requests served by this connection */
  requestCount: number;
}

/**
 * Connection pool management
 */
export interface ConnectionPool {
  /** All connections in the pool */
  connections: Map<string, PooledConnection>;
  /** Connection selection strategy */
  strategy: 'round-robin' | 'least-busy' | 'random';
  /** Current round-robin index */
  roundRobinIndex: number;
  /** Pool configuration */
  config: {
    minConnections: number;
    maxConnections: number;
    idleTimeoutMs: number;
  };
  /** Idle connection cleanup timer */
  cleanupTimer?: NodeJS.Timeout;
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
  /** Health state tracking */
  health: HealthState;
  /** Connection metrics */
  metrics: ConnectionMetrics;
  /** Connection pool (if pooling is enabled) */
  pool?: ConnectionPool;
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

  /** Connection configuration with defaults */
  private connectionConfig: Required<MCPConnectionConfig>;

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

    // Use provided connection config or fall back to config default, then apply all defaults
    const baseConfig = options.connectionConfig ?? options.config.mcp?.connection ?? {};

    // Apply all default values to ensure Required<MCPConnectionConfig>
    this.connectionConfig = {
      maxRetries: baseConfig.maxRetries ?? 3,
      retryDelayMs: baseConfig.retryDelayMs ?? 1000,
      backoffFactor: baseConfig.backoffFactor ?? 2,
      maxRetryDelayMs: baseConfig.maxRetryDelayMs ?? 30000,
      connectionTimeoutMs: baseConfig.connectionTimeoutMs ?? 10000,
      requestTimeoutMs: baseConfig.requestTimeoutMs ?? 30000,
      idleTimeoutMs: baseConfig.idleTimeoutMs ?? 300000,
      poolSize: baseConfig.poolSize ?? 1,
      poolMinSize: baseConfig.poolMinSize ?? 0,
      healthCheckIntervalMs: baseConfig.healthCheckIntervalMs ?? 30000,
      healthCheckTimeoutMs: baseConfig.healthCheckTimeoutMs ?? 5000,
      healthCheckFailureThreshold: baseConfig.healthCheckFailureThreshold ?? 3,
      autoReconnect: baseConfig.autoReconnect ?? true,
      keepAlive: baseConfig.keepAlive ?? true,
      keepAliveIntervalMs: baseConfig.keepAliveIntervalMs ?? 15000,
    };
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
        timeoutMs: this.connectionConfig.requestTimeoutMs,
      });

      // Initialize health state
      const health: HealthState = {
        consecutiveFailures: 0,
        isHealthy: true,
        averageLatencyMs: 0,
        latencyHistory: [],
      };

      // Initialize metrics
      const metrics: ConnectionMetrics = {
        totalConnections: 1,
        totalReconnections: 0,
        averageLatencyMs: 0,
        uptimeMs: 0,
        totalRequests: 0,
        totalErrors: 0,
      };

      // Initialize connection pool if enabled
      let pool: ConnectionPool | undefined;
      if (this.connectionConfig.poolSize > 1) {
        pool = {
          connections: new Map(),
          strategy: 'round-robin', // Default strategy
          roundRobinIndex: 0,
          config: {
            minConnections: this.connectionConfig.poolMinSize,
            maxConnections: this.connectionConfig.poolSize,
            idleTimeoutMs: this.connectionConfig.idleTimeoutMs,
          },
        };
      }

      // Create context
      const context: ConnectionContext = {
        connection,
        transport,
        client,
        intentionalDisconnect: false,
        health,
        metrics,
        pool,
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

      // Update metrics
      context.metrics.connectedAt = now;

      // Start health monitoring if enabled
      if (this.connectionConfig.healthCheckIntervalMs > 0) {
        this.startHealthMonitoring(serverId, context);
      }

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

    // Stop health monitoring
    this.stopHealthMonitoring(context);

    // Clean up connection pool if it exists
    if (context.pool) {
      await this.cleanupConnectionPool(context.pool);
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

  /**
   * Get health state for a specific connection
   *
   * @param serverId - The server identifier
   * @returns HealthState object or undefined if connection not found
   */
  getHealth(serverId: string): HealthState | undefined {
    return this.connections.get(serverId)?.health;
  }

  /**
   * Perform a manual health check on a specific connection
   *
   * @param serverId - The server identifier
   * @returns Promise resolving to health check result
   */
  async checkHealth(serverId: string): Promise<HealthCheckResult> {
    const context = this.connections.get(serverId);
    if (!context) {
      throw new Error(`Connection '${serverId}' not found`);
    }

    return this.performHealthCheck(serverId, context);
  }

  /**
   * Get connection metrics for a specific connection
   *
   * @param serverId - The server identifier
   * @returns ConnectionMetrics object or undefined if connection not found
   */
  getMetrics(serverId: string): ConnectionMetrics | undefined {
    const context = this.connections.get(serverId);
    if (!context) {
      return undefined;
    }

    // Calculate uptime
    if (context.metrics.connectedAt) {
      context.metrics.uptimeMs = Date.now() - context.metrics.connectedAt.getTime();
    }

    return { ...context.metrics };
  }

  /**
   * Acquire a pooled connection (if pooling is enabled)
   *
   * @param serverId - The server identifier
   * @returns Promise resolving to a pooled connection
   */
  async acquirePooledConnection(serverId: string): Promise<PooledConnection> {
    const context = this.connections.get(serverId);
    if (!context) {
      throw new Error(`Connection '${serverId}' not found`);
    }

    if (!context.pool) {
      throw new Error(`Connection pooling is not enabled for '${serverId}'`);
    }

    return this.acquireFromPool(serverId, context);
  }

  /**
   * Release a pooled connection back to the pool
   *
   * @param serverId - The server identifier
   * @param connectionId - The ID of the pooled connection to release
   */
  releasePooledConnection(serverId: string, connectionId: string): void {
    const context = this.connections.get(serverId);
    if (!context?.pool) {
      return;
    }

    const pooledConnection = context.pool.connections.get(connectionId);
    if (pooledConnection) {
      pooledConnection.inUse = false;
      pooledConnection.lastUsedAt = new Date();

      // Emit pool change event
      this.emit('poolChange', serverId, context.pool.connections.size,
                Array.from(context.pool.connections.values()).filter(c => c.inUse).length);
    }
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
          connectionTimeout: this.connectionConfig.connectionTimeoutMs,
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
      if (this.connectionConfig.autoReconnect && connection.reconnectAttempts < this.connectionConfig.maxRetries) {
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
      this.connectionConfig.retryDelayMs * Math.pow(this.connectionConfig.backoffFactor, attempt),
      this.connectionConfig.maxRetryDelayMs
    );

    // Add jitter (up to 25% of delay)
    const jitter = Math.random() * delay * 0.25;
    const totalDelay = delay + jitter;

    // Update state
    connection.state = 'reconnecting';
    connection.reconnectAttempts++;

    // Update metrics
    context.metrics.totalReconnections++;

    // Emit reconnecting event
    this.emit('reconnecting', serverId, connection.reconnectAttempts, this.connectionConfig.maxRetries);

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
        if (newContext && newContext.connection.reconnectAttempts < this.connectionConfig.maxRetries) {
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

  // ==========================================================================
  // Health Monitoring Methods
  // ==========================================================================

  /**
   * Start health monitoring for a connection
   */
  private startHealthMonitoring(serverId: string, context: ConnectionContext): void {
    if (context.health.healthCheckTimer) {
      clearInterval(context.health.healthCheckTimer);
    }

    context.health.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck(serverId, context);
      } catch (error) {
        // Health check errors are handled within performHealthCheck
        console.error(`Health check error for ${serverId}:`, error);
      }
    }, this.connectionConfig.healthCheckIntervalMs);
  }

  /**
   * Stop health monitoring for a connection
   */
  private stopHealthMonitoring(context: ConnectionContext): void {
    if (context.health.healthCheckTimer) {
      clearInterval(context.health.healthCheckTimer);
      context.health.healthCheckTimer = undefined;
    }
  }

  /**
   * Perform a health check on a connection
   */
  private async performHealthCheck(serverId: string, context: ConnectionContext): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Use a simple ping-like request to check health
      // In a real implementation, this might use an MCP-specific ping method
      const client = context.client;

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.connectionConfig.healthCheckTimeoutMs);
      });

      // Try to list tools as a health check
      const healthPromise = client.listTools();

      // Race between health check and timeout
      await Promise.race([healthPromise, timeoutPromise]);

      // Health check succeeded
      const latencyMs = Date.now() - startTime;

      // Update health state
      context.health.consecutiveFailures = 0;
      context.health.isHealthy = true;
      context.health.lastHealthyAt = timestamp;
      context.health.lastCheckAt = timestamp;

      // Update latency history (keep last 10)
      context.health.latencyHistory.push(latencyMs);
      if (context.health.latencyHistory.length > 10) {
        context.health.latencyHistory.shift();
      }

      // Update average latency
      context.health.averageLatencyMs =
        context.health.latencyHistory.reduce((sum, lat) => sum + lat, 0) / context.health.latencyHistory.length;

      const result: HealthCheckResult = {
        success: true,
        latencyMs,
        consecutiveFailures: context.health.consecutiveFailures,
        isHealthy: context.health.isHealthy,
        timestamp,
      };

      // Emit health check event
      this.emit('healthCheck', serverId, result);

      return result;

    } catch (error) {
      // Health check failed
      context.health.consecutiveFailures++;
      context.health.lastCheckAt = timestamp;

      // Mark as unhealthy if we've exceeded the failure threshold
      if (context.health.consecutiveFailures >= this.connectionConfig.healthCheckFailureThreshold) {
        context.health.isHealthy = false;

        // If this connection was healthy and is now unhealthy, trigger reconnection
        if (this.connectionConfig.autoReconnect && !context.intentionalDisconnect) {
          // Mark connection as disconnected and attempt reconnection
          const previousState = context.connection.state;
          context.connection.state = 'disconnected';

          this.emit('stateChange', serverId, previousState, 'disconnected');
          this.scheduleReconnection(serverId, context);
        }
      }

      const result: HealthCheckResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        consecutiveFailures: context.health.consecutiveFailures,
        isHealthy: context.health.isHealthy,
        timestamp,
      };

      // Update metrics
      context.metrics.totalErrors++;
      context.metrics.lastError = {
        message: result.error?.message ?? 'Unknown error',
        timestamp,
        code: 'HEALTH_CHECK_FAILED',
      };

      // Emit health check event
      this.emit('healthCheck', serverId, result);

      return result;
    }
  }

  // ==========================================================================
  // Connection Pooling Methods
  // ==========================================================================

  /**
   * Acquire a connection from the pool
   */
  private async acquireFromPool(serverId: string, context: ConnectionContext): Promise<PooledConnection> {
    if (!context.pool) {
      throw new Error('Connection pool not initialized');
    }

    const pool = context.pool;

    // Find an available connection
    let availableConnection: PooledConnection | undefined;

    switch (pool.strategy) {
      case 'round-robin':
        availableConnection = this.findRoundRobinConnection(pool);
        break;
      case 'least-busy':
        availableConnection = this.findLeastBusyConnection(pool);
        break;
      case 'random':
        availableConnection = this.findRandomConnection(pool);
        break;
    }

    // If no available connection and we haven't reached max, create a new one
    if (!availableConnection && pool.connections.size < pool.config.maxConnections) {
      availableConnection = await this.createPooledConnection(serverId, context);
    }

    // If still no available connection, wait or throw error
    if (!availableConnection) {
      throw new Error(`No available connections in pool for ${serverId}`);
    }

    // Mark as in use
    availableConnection.inUse = true;
    availableConnection.lastUsedAt = new Date();
    availableConnection.requestCount++;

    // Emit pool change event
    this.emit('poolChange', serverId, pool.connections.size,
              Array.from(pool.connections.values()).filter(c => c.inUse).length);

    return availableConnection;
  }

  /**
   * Find an available connection using round-robin strategy
   */
  private findRoundRobinConnection(pool: ConnectionPool): PooledConnection | undefined {
    const connections = Array.from(pool.connections.values()).filter(c => !c.inUse);
    if (connections.length === 0) return undefined;

    const connection = connections[pool.roundRobinIndex % connections.length];
    pool.roundRobinIndex = (pool.roundRobinIndex + 1) % connections.length;
    return connection;
  }

  /**
   * Find the least busy connection
   */
  private findLeastBusyConnection(pool: ConnectionPool): PooledConnection | undefined {
    const availableConnections = Array.from(pool.connections.values()).filter(c => !c.inUse);
    if (availableConnections.length === 0) return undefined;

    return availableConnections.reduce((least, current) =>
      current.requestCount < least.requestCount ? current : least
    );
  }

  /**
   * Find a random available connection
   */
  private findRandomConnection(pool: ConnectionPool): PooledConnection | undefined {
    const connections = Array.from(pool.connections.values()).filter(c => !c.inUse);
    if (connections.length === 0) return undefined;

    return connections[Math.floor(Math.random() * connections.length)];
  }

  /**
   * Create a new pooled connection
   */
  private async createPooledConnection(serverId: string, context: ConnectionContext): Promise<PooledConnection> {
    if (!context.pool) {
      throw new Error('Connection pool not initialized');
    }

    // Get server config
    const serverConfig = this.getServerConfig(serverId);
    if (!serverConfig) {
      throw new Error(`Server config not found for ${serverId}`);
    }

    // Create transport and client
    const transport = this.createTransport(serverConfig);
    const client = new MCPClient({
      transport,
      timeoutMs: this.connectionConfig.requestTimeoutMs,
    });

    // Connect
    await client.connect();

    // Create pooled connection
    const pooledConnection: PooledConnection = {
      id: `${serverId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      connection: {
        serverId,
        serverName: serverConfig.name ?? serverId,
        config: serverConfig,
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 0,
      },
      transport,
      client,
      inUse: false,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      requestCount: 0,
    };

    // Add to pool
    context.pool.connections.set(pooledConnection.id, pooledConnection);

    return pooledConnection;
  }

  /**
   * Clean up a connection pool
   */
  private async cleanupConnectionPool(pool: ConnectionPool): Promise<void> {
    // Stop cleanup timer
    if (pool.cleanupTimer) {
      clearInterval(pool.cleanupTimer);
      pool.cleanupTimer = undefined;
    }

    // Close all connections
    const closePromises = Array.from(pool.connections.values()).map(async (conn) => {
      try {
        await conn.client.disconnect();
      } catch (error) {
        console.error(`Error closing pooled connection ${conn.id}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    pool.connections.clear();
  }
}
