/**
 * @fileoverview MockTransport - In-process MCP Transport for Testing
 *
 * Implements the MCPTransport abstract class for in-process testing.
 * Allows testing the real MCPClient code path without spawning external processes.
 *
 * @module orchestrator/mcp/mock-server/mock-transport
 */

import { JSONRPCMessage, MCPTransportError } from '../types.js';
import { MCPTransport } from '../transports/transport.js';
import type { MockTransportOptions } from './types.js';

// ============================================================================
// MockTransport Implementation
// ============================================================================

/**
 * In-process transport implementation for testing MCP client interactions.
 *
 * MockTransport simulates a transport connection without spawning external processes.
 * It implements the MCPTransport interface so it can be used directly with the real
 * MCPClient class for integration testing.
 *
 * Features:
 * - Configurable connection latency and failure simulation
 * - Message interception and injection for testing
 * - Supports all MCPTransport events (message, error, connected, disconnected)
 * - Request handler registration for simulating server responses
 *
 * @example
 * ```typescript
 * const transport = new MockTransport({ connectionLatencyMs: 50 });
 * transport.setRequestHandler(async (request) => {
 *   if (request.method === 'tools/list') {
 *     return { jsonrpc: '2.0', id: request.id, result: { tools: [] } };
 *   }
 * });
 *
 * const client = new MCPClient({ transport });
 * await client.connect();
 * const tools = await client.listTools(); // Returns []
 * ```
 */
export class MockTransport extends MCPTransport {
  private options: Required<MockTransportOptions>;
  private requestHandler?: (message: JSONRPCMessage) => Promise<JSONRPCMessage | undefined>;
  private sentMessages: JSONRPCMessage[] = [];
  private connected = false;

  constructor(options: MockTransportOptions = {}) {
    super({
      connectionTimeout: options.connectionTimeout ?? 30000,
      autoReconnect: options.autoReconnect ?? false,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 3,
      reconnectDelay: options.reconnectDelay ?? 1000,
    });

    this.options = {
      connectionLatencyMs: options.connectionLatencyMs ?? 0,
      shouldFailConnect: options.shouldFailConnect ?? false,
      connectError: options.connectError ?? new Error('Mock connection failure'),
      shouldFailSend: options.shouldFailSend ?? false,
      sendError: options.sendError ?? new Error('Mock send failure'),
      transportType: options.transportType ?? 'stdio',
      connectionTimeout: options.connectionTimeout ?? 30000,
      autoReconnect: options.autoReconnect ?? false,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 3,
      reconnectDelay: options.reconnectDelay ?? 1000,
    };
  }

  // ==========================================================================
  // MCPTransport Interface Implementation
  // ==========================================================================

  /**
   * Simulate establishing a connection.
   * Respects configured latency and failure settings.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new MCPTransportError(
        'Already connected',
        'ALREADY_CONNECTED'
      );
    }

    this.setState('connecting');

    // Simulate connection latency
    if (this.options.connectionLatencyMs > 0) {
      await this.delay(this.options.connectionLatencyMs);
    }

    // Simulate connection failure
    if (this.options.shouldFailConnect) {
      this.setState('error');
      throw new MCPTransportError(
        this.options.connectError.message,
        'CONNECTION_FAILED',
        this.options.connectError
      );
    }

    this.connected = true;
    this.setState('connected');
  }

  /**
   * Simulate disconnecting.
   */
  async disconnect(reason?: string): Promise<void> {
    if (!this.connected) {
      return; // Already disconnected, no-op
    }

    this.setState('disconnecting');
    this.connected = false;
    this.setState('disconnected', reason ?? 'Client disconnect');
  }

  /**
   * Send a message through the mock transport.
   * If a request handler is registered, it processes the message and
   * emits the response as a received message.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.connected) {
      throw new MCPTransportError(
        'Not connected',
        'NOT_CONNECTED'
      );
    }

    if (this.options.shouldFailSend) {
      throw new MCPTransportError(
        this.options.sendError.message,
        'SEND_FAILED',
        this.options.sendError
      );
    }

    // Record the sent message
    this.sentMessages.push(message);

    // If we have a request handler, process the message and emit response
    if (this.requestHandler) {
      try {
        const response = await this.requestHandler(message);
        if (response) {
          // Emit the response as a received message (simulates server response)
          this.emit('message', response);
        }
      } catch (error) {
        this.emit('error', new MCPTransportError(
          `Handler error: ${(error as Error).message}`,
          'SEND_FAILED',
          error as Error
        ));
      }
    }
  }

  // ==========================================================================
  // Test Control Methods
  // ==========================================================================

  /**
   * Set the request handler that processes incoming messages.
   * The handler receives a message and optionally returns a response message.
   *
   * @param handler - Function that processes messages and returns responses
   */
  setRequestHandler(
    handler: (message: JSONRPCMessage) => Promise<JSONRPCMessage | undefined>
  ): void {
    this.requestHandler = handler;
  }

  /**
   * Inject a message as if it were received from the server.
   * Useful for testing notification handling and unsolicited messages.
   *
   * @param message - The JSON-RPC message to inject
   */
  injectMessage(message: JSONRPCMessage): void {
    if (!this.connected) {
      throw new MCPTransportError(
        'Cannot inject message when not connected',
        'NOT_CONNECTED'
      );
    }
    this.emit('message', message);
  }

  /**
   * Simulate an unexpected disconnection from the server side.
   *
   * @param reason - Reason for disconnection
   */
  simulateDisconnect(reason?: string): void {
    if (this.connected) {
      this.connected = false;
      this.setState('disconnected', reason ?? 'Simulated disconnect');
    }
  }

  /**
   * Simulate a transport-level error.
   *
   * @param error - The error to emit
   */
  simulateError(error?: MCPTransportError): void {
    const err = error ?? new MCPTransportError(
      'Simulated transport error',
      'SEND_FAILED'
    );
    this.emit('error', err);
  }

  /**
   * Get all messages that were sent through this transport.
   */
  getSentMessages(): JSONRPCMessage[] {
    return [...this.sentMessages];
  }

  /**
   * Clear the sent messages history.
   */
  clearSentMessages(): void {
    this.sentMessages = [];
  }

  /**
   * Update transport options at runtime (for dynamic test scenarios).
   */
  updateOptions(updates: Partial<MockTransportOptions>): void {
    Object.assign(this.options, updates);
  }

  /**
   * Reset the transport to its initial state.
   */
  reset(): void {
    this.connected = false;
    this.sentMessages = [];
    this._state = 'disconnected';
    this.reconnectAttempts = 0;
    this.requestHandler = undefined;
  }

  /**
   * Check if the transport is currently connected.
   */
  override isConnected(): boolean {
    return this.connected;
  }
}
