/**
 * MCPTransport - Abstract base class for MCP transport implementations
 *
 * This module defines the contract for MCP transport implementations.
 * Transports handle the low-level communication with MCP servers,
 * providing connection lifecycle management and message passing.
 *
 * @module orchestrator/mcp/transports/transport
 */

import { EventEmitter } from 'eventemitter3';
import {
  JSONRPCMessage,
  MCPTransportEvents,
  MCPTransportError,
} from '../types.js';

// ============================================================================
// Transport State
// ============================================================================

/**
 * Possible states of an MCP transport connection
 */
export type TransportState =
  | 'disconnected'  // Not connected, ready to connect
  | 'connecting'    // Connection in progress
  | 'connected'     // Connected and ready for communication
  | 'disconnecting' // Disconnection in progress
  | 'error';        // Error state, may need reset

// ============================================================================
// Base Transport Options
// ============================================================================

/**
 * Base options shared by all transport implementations
 */
export interface MCPTransportBaseOptions {
  /**
   * Timeout for connection establishment in milliseconds
   * @default 30000
   */
  connectionTimeout?: number;

  /**
   * Whether to automatically reconnect on unexpected disconnection
   * @default false
   */
  autoReconnect?: boolean;

  /**
   * Maximum number of reconnection attempts
   * @default 3
   */
  maxReconnectAttempts?: number;

  /**
   * Delay between reconnection attempts in milliseconds
   * @default 1000
   */
  reconnectDelay?: number;
}

// ============================================================================
// MCPTransport Abstract Class
// ============================================================================

/**
 * Abstract base class for MCP transport implementations
 *
 * MCPTransport provides the contract for communication with MCP servers.
 * Subclasses implement specific transport mechanisms (stdio, HTTP, WebSocket).
 *
 * Features:
 * - Connection lifecycle management (connect, disconnect)
 * - Event-based message reception (via EventEmitter3)
 * - State tracking
 * - Error handling
 *
 * Events:
 * - 'message': Emitted when a message is received
 * - 'error': Emitted when an error occurs
 * - 'connected': Emitted when connection is established
 * - 'disconnected': Emitted when connection is closed
 *
 * @example
 * ```typescript
 * const transport = new StdioTransport({ command: 'node', args: ['server.js'] });
 *
 * transport.on('message', (message) => {
 *   console.log('Received:', message);
 * });
 *
 * transport.on('error', (error) => {
 *   console.error('Transport error:', error);
 * });
 *
 * await transport.connect();
 * await transport.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
 *
 * // Later...
 * await transport.disconnect();
 * ```
 */
export abstract class MCPTransport extends EventEmitter<MCPTransportEvents> {
  /**
   * Current connection state
   */
  protected _state: TransportState = 'disconnected';

  /**
   * Base configuration options
   */
  protected baseOptions: Required<MCPTransportBaseOptions>;

  /**
   * Current reconnection attempt count
   */
  protected reconnectAttempts = 0;

  /**
   * Create a new MCPTransport instance
   *
   * @param options - Base transport options
   */
  constructor(options: MCPTransportBaseOptions = {}) {
    super();
    this.baseOptions = {
      connectionTimeout: options.connectionTimeout ?? 30000,
      autoReconnect: options.autoReconnect ?? false,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 3,
      reconnectDelay: options.reconnectDelay ?? 1000,
    };
  }

  // ==========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ==========================================================================

  /**
   * Establish connection to the MCP server
   *
   * Implementations should:
   * 1. Set state to 'connecting'
   * 2. Perform connection-specific setup
   * 3. Set state to 'connected' on success
   * 4. Emit 'connected' event
   * 5. Throw MCPTransportError on failure
   *
   * @throws {MCPTransportError} If connection fails or times out
   */
  abstract connect(): Promise<void>;

  /**
   * Close connection to the MCP server
   *
   * Implementations should:
   * 1. Set state to 'disconnecting'
   * 2. Perform graceful shutdown
   * 3. Set state to 'disconnected'
   * 4. Emit 'disconnected' event
   *
   * Should not throw - log errors instead
   *
   * @param reason - Optional reason for disconnection
   */
  abstract disconnect(reason?: string): Promise<void>;

  /**
   * Send a JSON-RPC message to the MCP server
   *
   * Implementations should:
   * 1. Validate connection state
   * 2. Serialize and transmit the message
   * 3. Throw MCPTransportError on failure
   *
   * @param message - JSON-RPC message to send
   * @throws {MCPTransportError} If not connected or send fails
   */
  abstract send(message: JSONRPCMessage): Promise<void>;

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Check if the transport is currently connected
   *
   * @returns true if connected and ready for communication
   */
  isConnected(): boolean {
    return this._state === 'connected';
  }

  /**
   * Get the current transport state
   *
   * @returns Current connection state
   */
  getState(): TransportState {
    return this._state;
  }

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Set the transport state and emit appropriate events
   *
   * @param newState - New state to transition to
   * @param reason - Optional reason for state change (for disconnected state)
   */
  protected setState(newState: TransportState, reason?: string): void {
    const oldState = this._state;
    this._state = newState;

    // Emit events based on state transitions
    if (newState === 'connected' && oldState !== 'connected') {
      this.reconnectAttempts = 0; // Reset on successful connection
      this.emit('connected');
    } else if (newState === 'disconnected' && oldState !== 'disconnected') {
      this.emit('disconnected', reason);
    }
  }

  /**
   * Handle unexpected disconnection with optional auto-reconnect
   *
   * @param reason - Reason for disconnection
   */
  protected async handleUnexpectedDisconnect(reason: string): Promise<void> {
    this.setState('disconnected', reason);

    if (this.baseOptions.autoReconnect &&
        this.reconnectAttempts < this.baseOptions.maxReconnectAttempts) {
      this.reconnectAttempts++;

      // Wait before attempting reconnection
      await this.delay(this.baseOptions.reconnectDelay);

      try {
        await this.connect();
      } catch (error) {
        // Emit error and try again if attempts remain
        this.emit('error', new MCPTransportError(
          `Reconnection attempt ${this.reconnectAttempts} failed: ${(error as Error).message}`,
          'CONNECTION_FAILED',
          error as Error
        ));

        // Recursive retry
        if (this.reconnectAttempts < this.baseOptions.maxReconnectAttempts) {
          await this.handleUnexpectedDisconnect(reason);
        }
      }
    }
  }

  /**
   * Helper to create a delay promise
   *
   * @param ms - Milliseconds to delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a timeout promise for connection operations
   *
   * @param timeoutMs - Timeout in milliseconds
   * @param operation - Name of the operation for error message
   * @returns Promise that rejects after timeout
   */
  protected createTimeoutPromise(timeoutMs: number, operation: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new MCPTransportError(
          `${operation} timed out after ${timeoutMs}ms`,
          'TIMEOUT'
        ));
      }, timeoutMs);
    });
  }

  /**
   * Parse a JSON string into a JSONRPCMessage
   *
   * @param data - JSON string to parse
   * @returns Parsed message
   * @throws {MCPTransportError} If parsing fails
   */
  protected parseMessage(data: string): JSONRPCMessage {
    try {
      const parsed = JSON.parse(data) as JSONRPCMessage;

      // Basic validation
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Message must be an object');
      }

      if (parsed.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }

      return parsed;
    } catch (error) {
      throw new MCPTransportError(
        `Failed to parse message: ${(error as Error).message}`,
        'PARSE_ERROR',
        error as Error
      );
    }
  }

  /**
   * Serialize a JSONRPCMessage to a JSON string
   *
   * @param message - Message to serialize
   * @returns JSON string
   */
  protected serializeMessage(message: JSONRPCMessage): string {
    return JSON.stringify(message);
  }
}
