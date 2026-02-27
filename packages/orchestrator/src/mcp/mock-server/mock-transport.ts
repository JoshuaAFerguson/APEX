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
import type {
  MockTransportOptions,
  MalformedBytesInjectionConfig,
  MalformedResponseInterceptorConfig
} from './types.js';

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
/**
 * Internal type for tracking malformed response interception
 */
interface MalformedResponseInterceptor {
  targetMethods: string[];
  injection: MalformedBytesInjectionConfig;
  probability: number;
  maxInjections: number;
  currentInjections: number;
}

export class MockTransport extends MCPTransport {
  private options: Required<MockTransportOptions>;
  private requestHandler?: (message: JSONRPCMessage) => Promise<JSONRPCMessage | undefined>;
  private sentMessages: JSONRPCMessage[] = [];
  private connected = false;
  private malformedInterceptors: MalformedResponseInterceptor[] = [];

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
          // Check if we should inject malformed response
          const interceptor = this.shouldInjectMalformed(message);
          if (interceptor) {
            await this.injectMalformedForRequest(message, response, interceptor);
          } else {
            // Emit the response as a received message (simulates server response)
            this.emit('message', response);
          }
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
  // Private Helper Methods
  // ==========================================================================

  /**
   * Truncate data at the specified position.
   *
   * @param data - Data to truncate
   * @param truncateAt - Position to truncate (number or percentage string)
   */
  private truncateData(data: string, truncateAt: number | string): string {
    let position: number;

    if (typeof truncateAt === 'string' && truncateAt.endsWith('%')) {
      const percentage = parseFloat(truncateAt.slice(0, -1)) / 100;
      position = Math.floor(data.length * percentage);
    } else {
      position = typeof truncateAt === 'number' ? truncateAt : parseInt(String(truncateAt));
    }

    return data.slice(0, Math.max(0, position));
  }

  /**
   * Check if malformed injection should occur for a given request.
   */
  private shouldInjectMalformed(request: JSONRPCMessage): MalformedResponseInterceptor | null {
    const method = 'method' in request ? request.method : '';

    for (const interceptor of this.malformedInterceptors) {
      // Check if we've exceeded max injections
      if (interceptor.maxInjections > 0 &&
          interceptor.currentInjections >= interceptor.maxInjections) {
        continue;
      }

      // Check method match
      const methodMatch = interceptor.targetMethods.length === 0 ||
                         interceptor.targetMethods.includes(method);

      // Check probability match
      const probabilityMatch = Math.random() < interceptor.probability;

      if (methodMatch && probabilityMatch) {
        return interceptor;
      }
    }
    return null;
  }

  /**
   * Inject malformed response for a specific request.
   */
  private async injectMalformedForRequest(
    request: JSONRPCMessage,
    originalResponse: JSONRPCMessage,
    interceptor: MalformedResponseInterceptor
  ): Promise<void> {
    // Increment injection count
    interceptor.currentInjections++;

    // Apply delay if specified
    if (interceptor.injection.delayMs && interceptor.injection.delayMs > 0) {
      await this.delay(interceptor.injection.delayMs);
    }

    const config = interceptor.injection;

    if (config.type === 'truncated_json') {
      // Truncate the actual response that would have been sent
      const fullResponse = JSON.stringify(originalResponse);
      const truncated = this.truncateData(fullResponse, config.truncateAt ?? '50%');

      // Emit as raw data first
      this.emit('rawData', truncated);

      // Then emit parse error since truncated JSON can't be parsed
      this.emit('error', new MCPTransportError(
        'Truncated response received',
        'PARSE_ERROR'
      ));
    } else {
      // Use the general injectMalformedBytes method for other types
      this.injectMalformedBytes(config);
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
    this.malformedInterceptors = [];
  }

  /**
   * Check if the transport is currently connected.
   */
  override isConnected(): boolean {
    return this.connected;
  }

  // ==========================================================================
  // Malformed Bytes Injection Methods (ADR-073)
  // ==========================================================================

  /**
   * Inject raw malformed bytes at the transport layer.
   * This bypasses normal message handling to simulate transport corruption.
   *
   * @param config - Configuration for the malformed data injection
   */
  injectMalformedBytes(config: MalformedBytesInjectionConfig): void {
    if (!this.connected) {
      throw new MCPTransportError(
        'Cannot inject bytes when not connected',
        'NOT_CONNECTED'
      );
    }

    let data: string | Buffer;

    switch (config.type) {
      case 'invalid_json':
        data = config.invalidContent ?? '{"result": undefined, broken json here}';
        break;

      case 'truncated_json':
        // Generate a valid response then truncate it
        const fullResponse = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { data: 'some response data that will be truncated' }
        });
        data = this.truncateData(fullResponse, config.truncateAt ?? '50%');
        break;

      case 'empty_response':
        data = '';
        break;

      case 'binary_data':
        data = Buffer.from([0x00, 0x01, 0xFF, 0xFE, 0x89, 0x50, 0x4E, 0x47]);
        break;

      case 'custom':
        data = config.rawBytes ?? '';
        break;

      default:
        throw new MCPTransportError(
          `Unknown malformed data type: ${(config as any).type}`,
          'SEND_FAILED'
        );
    }

    // Apply delay if specified
    if (config.delayMs && config.delayMs > 0) {
      setTimeout(() => {
        this.performMalformedInjection(data);
      }, config.delayMs);
    } else {
      this.performMalformedInjection(data);
    }
  }

  /**
   * Configure automatic malformed response injection for specific requests.
   * When a matching request is received, the response will be malformed.
   *
   * @param config - Configuration for automatic malformed injection
   */
  setMalformedResponseInjection(config: MalformedResponseInterceptorConfig): void {
    this.malformedInterceptors.push({
      targetMethods: config.targetMethods ?? [],
      injection: config.injection,
      probability: config.probability ?? 1.0,
      maxInjections: config.maxInjections ?? 0,
      currentInjections: 0,
    });
  }

  /**
   * Clear all malformed response injection configurations.
   */
  clearMalformedResponseInjection(): void {
    this.malformedInterceptors = [];
  }

  /**
   * Perform the actual malformed data injection and emit appropriate events.
   *
   * @param data - The malformed data to inject
   */
  private performMalformedInjection(data: string | Buffer): void {
    // Emit raw data event for clients that handle raw transport data
    this.emit('rawData', data);

    // Also try to emit as 'message' to trigger normal error handling
    // This allows testing both raw data handlers and JSON parse error handling
    try {
      const message = JSON.parse(typeof data === 'string' ? data : data.toString());
      this.emit('message', message);
    } catch (parseError) {
      // Emit as transport error since the data couldn't be parsed
      this.emit('error', new MCPTransportError(
        `Malformed data received: ${(parseError as Error).message}`,
        'PARSE_ERROR',
        parseError as Error
      ));
    }
  }
}
