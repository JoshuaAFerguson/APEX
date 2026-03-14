/**
 * Mock WebSocket server for tool visualization E2E testing
 * Provides a lightweight server to test WebSocket communication without full API server
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { ToolVisualizationMockOrchestrator } from './orchestrator-event-emitter.js';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  taskId?: string;
}

export interface MockWebSocketServerOptions {
  /** Port to bind to (0 = dynamic port) */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Maximum number of concurrent clients */
  maxClients?: number;
  /** Connection timeout in ms */
  connectionTimeout?: number;
}

/**
 * Mock WebSocket server that bridges orchestrator events
 * for testing without real API server dependency
 */
export class MockWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private orchestrator: ToolVisualizationMockOrchestrator | null = null;
  private clients: Set<WebSocket> = new Set();
  private messageHistory: WebSocketMessage[] = [];
  private options: Required<MockWebSocketServerOptions>;
  private startPromise: Promise<void> | null = null;
  private isStarted = false;
  private isClosed = false;

  constructor(options: MockWebSocketServerOptions = {}) {
    super();
    this.options = {
      port: options.port ?? 0,
      host: options.host ?? '127.0.0.1',
      maxClients: options.maxClients ?? 10,
      connectionTimeout: options.connectionTimeout ?? 5000,
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = new Promise((resolve, reject) => {
      if (this.isStarted) {
        resolve();
        return;
      }

      this.wss = new WebSocketServer({
        port: this.options.port,
        host: this.options.host,
        maxClients: this.options.maxClients,
      });

      this.wss.on('listening', () => {
        this.isStarted = true;
        this.emit('listening');
        resolve();
      });

      this.wss.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.wss.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });
    });

    return this.startPromise;
  }

  /**
   * Handle new WebSocket connections
   */
  private handleConnection(ws: WebSocket, request: any): void {
    if (this.clients.size >= this.options.maxClients) {
      ws.close(1008, 'Server full');
      return;
    }

    this.clients.add(ws);
    this.emit('client:connected', ws, request);

    // Set connection timeout
    const timeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close(1002, 'Connection timeout');
      }
    }, this.options.connectionTimeout);

    ws.on('open', () => {
      clearTimeout(timeoutId);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(ws, message);
      } catch (error) {
        this.emit('client:error', ws, error);
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeoutId);
      this.clients.delete(ws);
      this.emit('client:disconnected', ws, code, reason);
    });

    ws.on('error', (error) => {
      clearTimeout(timeoutId);
      this.clients.delete(ws);
      this.emit('client:error', ws, error);
    });

    // Send any existing message history to new client
    this.messageHistory.forEach(message => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Handle messages from WebSocket clients
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    this.emit('client:message', ws, message);

    // Handle client ping
    if (message.type === 'ping') {
      this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
    }

    // Handle subscription requests
    if (message.type === 'subscribe') {
      const subscription = {
        type: 'subscribed',
        data: { channels: message.channels || ['all'] },
        timestamp: Date.now(),
      };
      this.sendToClient(ws, subscription);
    }
  }

  /**
   * Connect mock orchestrator to broadcast events
   */
  attachOrchestrator(orchestrator: ToolVisualizationMockOrchestrator): void {
    if (this.orchestrator) {
      this.detachOrchestrator();
    }

    this.orchestrator = orchestrator;

    // Listen for tool events and broadcast to all connected clients
    this.orchestrator.on('tool:start', (data) => {
      this.broadcast({
        type: 'tool:start',
        data,
        timestamp: Date.now(),
        taskId: data.taskId,
      });
    });

    this.orchestrator.on('tool:complete', (data) => {
      this.broadcast({
        type: 'tool:complete',
        data,
        timestamp: Date.now(),
        taskId: data.taskId,
      });
    });

    this.orchestrator.on('tool:error', (data) => {
      this.broadcast({
        type: 'tool:error',
        data,
        timestamp: Date.now(),
        taskId: data.taskId,
      });
    });

    this.orchestrator.on('tool:progress', (data) => {
      this.broadcast({
        type: 'tool:progress',
        data,
        timestamp: Date.now(),
        taskId: data.taskId,
      });
    });

    this.orchestrator.on('tool:timing', (data) => {
      this.broadcast({
        type: 'tool:timing',
        data,
        timestamp: Date.now(),
        taskId: data.taskId,
      });
    });

    this.emit('orchestrator:attached', orchestrator);
  }

  /**
   * Disconnect orchestrator
   */
  detachOrchestrator(): void {
    if (this.orchestrator) {
      this.orchestrator.removeAllListeners();
      this.orchestrator = null;
      this.emit('orchestrator:detached');
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    // Safe JSON stringify with circular reference handling
    const messageString = this.safeStringify(message);

    // Store in history for new connections
    this.messageHistory.push(message);
    if (this.messageHistory.length > 1000) {
      this.messageHistory.shift(); // Keep last 1000 messages
    }

    // Send to all connected clients
    let sentCount = 0;
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
          sentCount++;
        } catch (error) {
          this.emit('broadcast:error', client, error);
        }
      }
    });

    this.emit('broadcast', message, sentCount);
  }

  /**
   * Send message to specific client
   */
  sendToClient(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(this.safeStringify(message));
        this.emit('client:sent', client, message);
      } catch (error) {
        this.emit('client:error', client, error);
      }
    }
  }

  /**
   * Safe JSON stringify with circular reference handling
   */
  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, val) => {
      if (val !== null && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    });
  }

  /**
   * Get the server URL
   */
  get url(): string {
    if (!this.wss || !this.isStarted) {
      throw new Error('Server not started');
    }
    const address = this.wss.address();
    if (typeof address === 'string') {
      return address;
    }
    return `ws://${address?.address}:${address?.port}`;
  }

  /**
   * Get the port the server is listening on
   */
  get port(): number {
    if (!this.wss || !this.isStarted) {
      throw new Error('Server not started');
    }
    const address = this.wss.address();
    if (typeof address === 'string') {
      throw new Error('Server bound to named pipe, no port available');
    }
    return address?.port ?? 0;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get message history
   */
  getMessageHistory(): WebSocketMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Wait for a specific number of clients to connect
   */
  waitForClients(count: number, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.clients.size >= count) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        this.removeListener('client:connected', checkClients);
        reject(new Error(`Timeout waiting for ${count} clients (current: ${this.clients.size})`));
      }, timeout);

      const checkClients = () => {
        if (this.clients.size >= count) {
          clearTimeout(timeoutId);
          this.removeListener('client:connected', checkClients);
          resolve();
        }
      };

      this.on('client:connected', checkClients);
    });
  }

  /**
   * Wait for a specific number of messages to be broadcast
   */
  waitForMessages(count: number, timeout = 5000): Promise<WebSocketMessage[]> {
    return new Promise((resolve, reject) => {
      if (this.messageHistory.length >= count) {
        resolve(this.messageHistory.slice(-count));
        return;
      }

      const timeoutId = setTimeout(() => {
        this.removeListener('broadcast', checkMessages);
        reject(new Error(`Timeout waiting for ${count} messages (current: ${this.messageHistory.length})`));
      }, timeout);

      const checkMessages = () => {
        if (this.messageHistory.length >= count) {
          clearTimeout(timeoutId);
          this.removeListener('broadcast', checkMessages);
          resolve(this.messageHistory.slice(-count));
        }
      };

      this.on('broadcast', checkMessages);
    });
  }

  /**
   * Close server and all connections
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    // Detach orchestrator
    this.detachOrchestrator();

    // Close all client connections
    this.clients.forEach(client => {
      try {
        client.close(1000, 'Server shutting down');
      } catch (error) {
        // Ignore errors during shutdown
      }
    });
    this.clients.clear();

    // Close server
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      this.wss.close((error) => {
        this.isStarted = false;
        this.startPromise = null;
        this.emit('closed', error);
        resolve();
      });
    });
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      isStarted: this.isStarted,
      isClosed: this.isClosed,
      clientCount: this.clients.size,
      messageHistoryCount: this.messageHistory.length,
      orchestratorAttached: this.orchestrator !== null,
      url: this.isStarted ? this.url : null,
      port: this.isStarted ? this.port : null,
    };
  }
}

/**
 * Utility function to create a mock WebSocket server for testing
 */
export function createMockWebSocketServer(options?: MockWebSocketServerOptions): MockWebSocketServer {
  return new MockWebSocketServer(options);
}

/**
 * Utility function to wait for WebSocket connection
 */
export function waitForConnection(ws: WebSocket, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, timeout);

    ws.addEventListener('open', () => {
      clearTimeout(timeoutId);
      resolve();
    });

    ws.addEventListener('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Utility function to wait for specific messages
 */
export function waitForMessages(
  messages: WebSocketMessage[],
  count: number,
  timeout = 5000
): Promise<WebSocketMessage[]> {
  return new Promise((resolve, reject) => {
    if (messages.length >= count) {
      resolve(messages.slice(-count));
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (messages.length >= count) {
        clearInterval(checkInterval);
        resolve(messages.slice(-count));
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for ${count} messages (current: ${messages.length})`));
      }
    }, 10);
  });
}