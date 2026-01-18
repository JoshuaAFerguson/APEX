/**
 * MCP Client Utility
 *
 * A utility for connecting to MCP servers and discovering tools.
 * Provides a simplified interface for spawning MCP server processes,
 * establishing JSON-RPC connections, and retrieving available tools.
 *
 * @example
 * ```typescript
 * import { createMCPClientUtility } from '@apexcli/orchestrator';
 *
 * // Create a utility instance
 * const mcpClient = createMCPClientUtility({
 *   enableLogging: true,
 *   maxConcurrentConnections: 5
 * });
 *
 * // Connect to an MCP server
 * const serverConfig = {
 *   name: 'filesystem-server',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/root']
 * };
 *
 * const result = await mcpClient.connectServer(serverConfig);
 * if (result.success) {
 *   console.log('Connected! Available tools:', result.connection.tools);
 * }
 *
 * // Clean up
 * await mcpClient.disconnectAll();
 * ```
 *
 * @example
 * ```typescript
 * // Quick one-shot connection and discovery
 * import { connectAndDiscoverMCPServer } from '@apexcli/orchestrator';
 *
 * const { success, tools } = await connectAndDiscoverMCPServer({
 *   name: 'git-server',
 *   command: 'mcp-git-server'
 * });
 *
 * if (success) {
 *   console.log('Discovered tools:', tools.map(t => t.name));
 * }
 * ```
 *
 * @module orchestrator/mcp-client
 */

import { EventEmitter } from 'eventemitter3';
import { spawn, ChildProcess } from 'child_process';
import type {
  MCPServerConfig,
  MCPConnectionConfig,
  MCPEnvironmentVar,
} from '@apexcli/core';
import { MCPClient, StdioTransport, type MCPToolDefinition } from './mcp/index.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MCPClientUtilityOptions {
  /** Default timeout for MCP operations in milliseconds */
  defaultTimeoutMs?: number;
  /** Maximum number of concurrent connections */
  maxConcurrentConnections?: number;
  /** Whether to enable verbose logging */
  enableLogging?: boolean;
}

export interface MCPServerConnection {
  /** Unique identifier for this connection */
  id: string;
  /** Server configuration used for this connection */
  config: MCPServerConfig;
  /** MCP client instance */
  client: MCPClient;
  /** Child process (if spawned by this utility) */
  process?: ChildProcess;
  /** Connection state */
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Connection timestamp */
  connectedAt?: Date;
  /** Last error (if any) */
  lastError?: string;
  /** Available tools from this server */
  tools: MCPToolDefinition[];
}

export interface MCPConnectionResult {
  /** Whether the connection was successful */
  success: boolean;
  /** Connection details if successful */
  connection?: MCPServerConnection;
  /** Error message if failed */
  error?: string;
}

export interface MCPToolDiscoveryResult {
  /** Whether discovery was successful */
  success: boolean;
  /** Discovered tools */
  tools: MCPToolDefinition[];
  /** Server ID that provided the tools */
  serverId?: string;
  /** Error message if failed */
  error?: string;
}

export interface MCPClientUtilityEvents {
  'connection:established': (connection: MCPServerConnection) => void;
  'connection:lost': (connectionId: string, reason?: string) => void;
  'connection:error': (connectionId: string, error: Error) => void;
  'tools:discovered': (connectionId: string, tools: MCPToolDefinition[]) => void;
  'process:spawned': (connectionId: string, process: ChildProcess) => void;
  'process:error': (connectionId: string, error: Error) => void;
}

// ============================================================================
// MCPClientUtility Class
// ============================================================================

/**
 * MCP Client Utility for spawning servers and discovering tools
 *
 * This utility provides a high-level interface for:
 * - Spawning MCP server processes
 * - Establishing JSON-RPC connections
 * - Discovering available tools via tools/list
 * - Managing multiple concurrent connections
 */
export class MCPClientUtility extends EventEmitter<MCPClientUtilityEvents> {
  private readonly options: Required<MCPClientUtilityOptions>;
  private readonly connections: Map<string, MCPServerConnection> = new Map();
  private connectionCounter = 0;

  constructor(options: MCPClientUtilityOptions = {}) {
    super();

    this.options = {
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30000,
      maxConcurrentConnections: options.maxConcurrentConnections ?? 10,
      enableLogging: options.enableLogging ?? false,
    };
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to an MCP server and discover its tools
   *
   * @param config - MCP server configuration
   * @param customTimeoutMs - Custom timeout for this connection
   * @returns Connection result with tools discovery
   */
  async connectServer(
    config: MCPServerConfig,
    customTimeoutMs?: number
  ): Promise<MCPConnectionResult> {
    const connectionId = this.generateConnectionId();
    const timeoutMs = customTimeoutMs ?? this.getTimeoutFromConfig(config);

    this.log(`Connecting to MCP server: ${config.name || config.command}`);

    try {
      // Check connection limits
      if (this.connections.size >= this.options.maxConcurrentConnections) {
        return {
          success: false,
          error: `Maximum concurrent connections reached (${this.options.maxConcurrentConnections})`,
        };
      }

      // Validate server configuration
      const validationError = this.validateServerConfig(config);
      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      // Create connection entry
      const connection: MCPServerConnection = {
        id: connectionId,
        config,
        client: null as any, // Will be set below
        state: 'connecting',
        tools: [],
      };

      this.connections.set(connectionId, connection);

      // Spawn process if needed
      let childProcess: ChildProcess | undefined;
      if (config.command) {
        childProcess = await this.spawnServerProcess(config, connectionId);
        connection.process = childProcess;
      }

      // Create transport and client
      const transport = new StdioTransport({
        command: config.command!,
        args: config.args || [],
        env: this.buildEnvironmentVariables(config.envVars),
        process: childProcess,
      });

      const client = new MCPClient({
        transport,
        timeoutMs,
      });

      connection.client = client;

      // Set up error handling
      client.on('error', (error) => {
        this.handleConnectionError(connectionId, error);
      });

      // Connect to server
      await client.connect();
      connection.state = 'connected';
      connection.connectedAt = new Date();

      this.log(`Connected to MCP server: ${connectionId}`);
      this.emit('connection:established', connection);

      // Discover tools
      const discoveryResult = await this.discoverTools(connectionId);
      if (discoveryResult.success) {
        connection.tools = discoveryResult.tools;
        this.log(`Discovered ${discoveryResult.tools.length} tools from ${connectionId}`);
        this.emit('tools:discovered', connectionId, discoveryResult.tools);
      } else {
        this.log(`Warning: Failed to discover tools from ${connectionId}: ${discoveryResult.error}`);
      }

      return {
        success: true,
        connection,
      };

    } catch (error) {
      this.log(`Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`);

      // Clean up failed connection
      this.connections.delete(connectionId);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Disconnect from an MCP server
   *
   * @param connectionId - Connection ID to disconnect
   */
  async disconnectServer(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.log(`Connection ${connectionId} not found`);
      return;
    }

    this.log(`Disconnecting from MCP server: ${connectionId}`);

    try {
      // Disconnect client
      if (connection.client) {
        await connection.client.disconnect();
      }

      // Terminate process
      if (connection.process && !connection.process.killed) {
        connection.process.kill('SIGTERM');

        // Give the process some time to terminate gracefully
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (connection.process && !connection.process.killed) {
              connection.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          connection.process!.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

    } catch (error) {
      this.log(`Error during disconnection: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Always remove from connections map
      this.connections.delete(connectionId);
      this.emit('connection:lost', connectionId);
    }
  }

  /**
   * Disconnect all active connections
   */
  async disconnectAll(): Promise<void> {
    const connectionIds = Array.from(this.connections.keys());
    await Promise.allSettled(
      connectionIds.map(id => this.disconnectServer(id))
    );
  }

  // ==========================================================================
  // Tool Discovery
  // ==========================================================================

  /**
   * Discover tools from a connected MCP server
   *
   * @param connectionId - Connection ID to discover tools from
   * @returns Tool discovery result
   */
  async discoverTools(connectionId: string): Promise<MCPToolDiscoveryResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return {
        success: false,
        tools: [],
        error: `Connection ${connectionId} not found`,
      };
    }

    if (connection.state !== 'connected') {
      return {
        success: false,
        tools: [],
        error: `Connection ${connectionId} is not in connected state`,
      };
    }

    try {
      this.log(`Discovering tools from MCP server: ${connectionId}`);
      const tools = await connection.client.listTools();

      this.log(`Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);

      return {
        success: true,
        tools,
        serverId: connectionId,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Tool discovery failed for ${connectionId}: ${errorMessage}`);

      return {
        success: false,
        tools: [],
        serverId: connectionId,
        error: errorMessage,
      };
    }
  }

  /**
   * Refresh tool discovery for all connected servers
   *
   * @returns Map of connection IDs to discovery results
   */
  async refreshAllTools(): Promise<Map<string, MCPToolDiscoveryResult>> {
    const results = new Map<string, MCPToolDiscoveryResult>();

    const connectedIds = Array.from(this.connections.keys()).filter(id => {
      const connection = this.connections.get(id);
      return connection?.state === 'connected';
    });

    for (const connectionId of connectedIds) {
      const result = await this.discoverTools(connectionId);
      results.set(connectionId, result);

      // Update connection tools cache
      if (result.success) {
        const connection = this.connections.get(connectionId);
        if (connection) {
          connection.tools = result.tools;
        }
      }
    }

    return results;
  }

  // ==========================================================================
  // Connection Information
  // ==========================================================================

  /**
   * Get all active connections
   */
  getConnections(): MCPServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get a specific connection by ID
   */
  getConnection(connectionId: string): MCPServerConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all tools from all connected servers
   */
  getAllTools(): Map<string, MCPToolDefinition[]> {
    const toolsByServer = new Map<string, MCPToolDefinition[]>();

    for (const [connectionId, connection] of this.connections) {
      if (connection.state === 'connected' && connection.tools.length > 0) {
        toolsByServer.set(connectionId, connection.tools);
      }
    }

    return toolsByServer;
  }

  /**
   * Check if any servers are currently connected
   */
  hasActiveConnections(): boolean {
    return Array.from(this.connections.values()).some(conn => conn.state === 'connected');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateConnectionId(): string {
    return `mcp-conn-${++this.connectionCounter}-${Date.now()}`;
  }

  private validateServerConfig(config: MCPServerConfig): string | null {
    if (!config.command) {
      return 'Server command is required';
    }

    if (config.name && config.name.length > 100) {
      return 'Server name must be 100 characters or less';
    }

    return null;
  }

  private getTimeoutFromConfig(config: MCPServerConfig): number {
    return config.connection?.timeoutMs ?? this.options.defaultTimeoutMs;
  }

  private buildEnvironmentVariables(envVars?: MCPEnvironmentVar[]): Record<string, string> {
    const env: Record<string, string> = { ...process.env };

    if (envVars) {
      for (const envVar of envVars) {
        if (envVar.value !== undefined) {
          env[envVar.name] = envVar.value;
        }
      }
    }

    return env;
  }

  private async spawnServerProcess(config: MCPServerConfig, connectionId: string): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const env = this.buildEnvironmentVariables(config.envVars);

      this.log(`Spawning MCP server process: ${config.command} ${(config.args || []).join(' ')}`);

      const childProcess = spawn(config.command!, config.args || [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle process startup
      let resolved = false;

      const onError = (error: Error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
        this.emit('process:error', connectionId, error);
      };

      const onSpawn = () => {
        if (!resolved) {
          resolved = true;
          this.emit('process:spawned', connectionId, childProcess);
          resolve(childProcess);
        }
      };

      childProcess.on('error', onError);
      childProcess.on('spawn', onSpawn);

      // Set a timeout for process startup
      const startupTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          childProcess.kill();
          reject(new Error('MCP server process startup timeout'));
        }
      }, 10000);

      childProcess.on('spawn', () => clearTimeout(startupTimeout));
      childProcess.on('error', () => clearTimeout(startupTimeout));

      // Log stderr for debugging
      if (this.options.enableLogging && childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          this.log(`MCP server stderr: ${data.toString().trim()}`);
        });
      }
    });
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    this.log(`Connection error for ${connectionId}: ${error.message}`);

    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.state = 'error';
      connection.lastError = error.message;
    }

    this.emit('connection:error', connectionId, error);
  }

  private log(message: string): void {
    if (this.options.enableLogging) {
      console.log(`[MCPClientUtility] ${message}`);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new MCP client utility with default options
 */
export function createMCPClientUtility(options?: MCPClientUtilityOptions): MCPClientUtility {
  return new MCPClientUtility(options);
}

/**
 * Quick utility to connect to a single MCP server and discover its tools
 *
 * @param config - MCP server configuration
 * @param options - Optional utility options
 * @returns Promise with connection and discovery result
 */
export async function connectAndDiscoverMCPServer(
  config: MCPServerConfig,
  options?: MCPClientUtilityOptions
): Promise<{
  success: boolean;
  connection?: MCPServerConnection;
  tools: MCPToolDefinition[];
  error?: string;
}> {
  const client = createMCPClientUtility(options);

  try {
    const connectionResult = await client.connectServer(config);

    if (!connectionResult.success) {
      return {
        success: false,
        tools: [],
        error: connectionResult.error,
      };
    }

    const tools = connectionResult.connection?.tools || [];

    return {
      success: true,
      connection: connectionResult.connection,
      tools,
    };

  } finally {
    await client.disconnectAll();
  }
}