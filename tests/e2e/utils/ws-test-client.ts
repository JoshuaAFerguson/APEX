/**
 * WebSocket test client utility for E2E testing
 *
 * Provides a test-oriented wrapper around WebSocket for E2E test scenarios,
 * with event buffering, filtering, and timeout handling.
 *
 * Based on ADR-076 implementation design.
 */

import WebSocket from 'ws';

export interface WSEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface WebSocketTestClient {
  /** Connect to WebSocket server */
  connect(): Promise<void>;

  /** Disconnect and cleanup */
  disconnect(): Promise<void>;

  /** Wait for a specific event type (throws on timeout) */
  waitForEvent(type: string, timeoutMs?: number): Promise<WSEvent>;

  /** Collect all events matching a predicate (non-blocking snapshot) */
  collectEvents(predicate?: (e: WSEvent) => boolean): WSEvent[];

  /** Get all received events */
  getAllEvents(): WSEvent[];

  /** Clear event buffer */
  clearEvents(): void;

  /** Check if connected */
  isConnected(): boolean;

  /** Set message handler for incoming events */
  onMessage(handler: (event: WSEvent) => void): void;

  /** Wait for events matching a condition */
  waitForEvents(predicate: (events: WSEvent[]) => boolean, timeoutMs?: number): Promise<void>;
}

/**
 * Implementation of WebSocketTestClient
 *
 * Provides robust WebSocket testing with event buffering, timeout handling,
 * and JSON parsing error management.
 */
class WebSocketTestClientImpl implements WebSocketTestClient {
  private ws: WebSocket | null = null;
  private events: WSEvent[] = [];
  private isConnecting = false;
  private isDisconnecting = false;
  private eventWaiters: Array<{
    type: string;
    resolve: (event: WSEvent) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }> = [];
  private messageHandlers: Array<(event: WSEvent) => void> = [];
  private eventPredicateWaiters: Array<{
    predicate: (events: WSEvent[]) => boolean;
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }> = [];

  constructor(private url: string) {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        const connectionTimeout = setTimeout(() => {
          this.isConnecting = false;
          reject(new Error(`WebSocket connection timeout after 10s: ${this.url}`));
          this.ws?.terminate();
        }, 10000); // 10 second connection timeout

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          resolve();
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          reject(new Error(`WebSocket connection error: ${error.message}`));
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', () => {
          this.handleClose();
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.ws || this.isDisconnecting) {
      return;
    }

    this.isDisconnecting = true;

    return new Promise((resolve) => {
      if (this.ws!.readyState === WebSocket.CLOSED) {
        this.isDisconnecting = false;
        resolve();
        return;
      }

      const closeTimeout = setTimeout(() => {
        // Force terminate if clean close takes too long
        this.ws!.terminate();
      }, 2000); // 2 second close timeout

      this.ws!.on('close', () => {
        clearTimeout(closeTimeout);
        this.isDisconnecting = false;
        resolve();
      });

      this.ws!.close();
    });
  }

  async waitForEvent(type: string, timeoutMs: number = 10000): Promise<WSEvent> {
    // Check existing buffer first
    const existingEvent = this.events.find(event => event.type === type);
    if (existingEvent) {
      // Remove from buffer to avoid duplicate processing
      const index = this.events.indexOf(existingEvent);
      this.events.splice(index, 1);
      return existingEvent;
    }

    // Set up waiter for new events
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove waiter from list
        const index = this.eventWaiters.findIndex(w => w.timeoutId === timeoutId);
        if (index >= 0) {
          this.eventWaiters.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for event '${type}' after ${timeoutMs}ms. Received events: ${this.events.map(e => e.type).join(', ')}`));
      }, timeoutMs);

      this.eventWaiters.push({
        type,
        resolve,
        reject,
        timeoutId
      });
    });
  }

  collectEvents(predicate?: (e: WSEvent) => boolean): WSEvent[] {
    if (!predicate) {
      return [...this.events]; // Return snapshot copy
    }
    return this.events.filter(predicate);
  }

  getAllEvents(): WSEvent[] {
    return [...this.events]; // Return snapshot copy
  }

  clearEvents(): void {
    this.events = [];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onMessage(handler: (event: WSEvent) => void): void {
    this.messageHandlers.push(handler);
  }

  async waitForEvents(predicate: (events: WSEvent[]) => boolean, timeoutMs: number = 10000): Promise<void> {
    // Check existing events first
    if (predicate(this.events)) {
      return;
    }

    // Set up waiter for new events
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove waiter from list
        const index = this.eventPredicateWaiters.findIndex(w => w.timeoutId === timeoutId);
        if (index >= 0) {
          this.eventPredicateWaiters.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for events after ${timeoutMs}ms. Received ${this.events.length} events: ${this.events.map(e => e.type).join(', ')}`));
      }, timeoutMs);

      this.eventPredicateWaiters.push({
        predicate,
        resolve,
        reject,
        timeoutId
      });
    });
  }

  private handleMessage(data: Buffer | ArrayBuffer | Buffer[]): void {
    try {
      const messageStr = data.toString();
      const messageData = JSON.parse(messageStr);

      const event: WSEvent = {
        type: messageData.type || 'unknown',
        data: messageData.data || messageData, // Support both structured and flat messages
        timestamp: messageData.timestamp ? new Date(messageData.timestamp).getTime() : Date.now()
      };

      // Add to buffer
      this.events.push(event);

      // Check for waiting promises
      this.checkWaiters(event);

    } catch (error) {
      // JSON parse errors are captured as error events, not thrown
      const errorEvent: WSEvent = {
        type: 'parse-error',
        data: {
          error: error instanceof Error ? error.message : String(error),
          rawMessage: data.toString()
        },
        timestamp: Date.now()
      };

      this.events.push(errorEvent);
      this.checkWaiters(errorEvent);
    }
  }

  private checkWaiters(event: WSEvent): void {
    // Call all message handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        // Don't let handler errors break the client
        console.error('WebSocket message handler error:', error);
      }
    });

    // Find matching waiters
    const matchingWaiters = this.eventWaiters.filter(waiter => waiter.type === event.type);

    // Resolve first matching waiter (FIFO)
    if (matchingWaiters.length > 0) {
      const waiter = matchingWaiters[0];
      const index = this.eventWaiters.indexOf(waiter);

      // Remove waiter and clear timeout
      this.eventWaiters.splice(index, 1);
      clearTimeout(waiter.timeoutId);

      // Resolve with event
      waiter.resolve(event);
    }

    // Check predicate waiters
    const matchingPredicateWaiters = this.eventPredicateWaiters.filter(waiter =>
      waiter.predicate(this.events)
    );

    // Resolve all matching predicate waiters
    matchingPredicateWaiters.forEach(waiter => {
      const index = this.eventPredicateWaiters.indexOf(waiter);
      if (index >= 0) {
        this.eventPredicateWaiters.splice(index, 1);
        clearTimeout(waiter.timeoutId);
        waiter.resolve();
      }
    });
  }

  private handleClose(): void {
    // Reject any remaining waiters
    this.eventWaiters.forEach(waiter => {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error(`WebSocket connection closed while waiting for '${waiter.type}'`));
    });
    this.eventWaiters = [];

    // Reject any remaining predicate waiters
    this.eventPredicateWaiters.forEach(waiter => {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error('WebSocket connection closed while waiting for events'));
    });
    this.eventPredicateWaiters = [];
  }
}

/**
 * Factory function to create a WebSocket test client
 *
 * @param url - WebSocket URL to connect to
 * @returns WebSocketTestClient instance
 *
 * @example
 * ```typescript
 * const client = createWebSocketTestClient('ws://localhost:3000/ws');
 * await client.connect();
 *
 * // Wait for specific event
 * const installEvent = await client.waitForEvent('mcp:install-complete');
 *
 * // Collect all error events
 * const errors = client.collectEvents(e => e.type.includes('error'));
 *
 * await client.disconnect();
 * ```
 */
export function createWebSocketTestClient(url: string): WebSocketTestClient {
  return new WebSocketTestClientImpl(url);
}